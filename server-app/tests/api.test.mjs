import test from 'node:test';
import assert from 'node:assert/strict';
import {Client,normalizeStats,completedSeries,historyBatch} from '../server/api.mjs';
const player={id:123,name:'renamed',nickname:'renamed',team_id:7};
const stat=(hs=5,overrides={})=>({steam_profile:{player_id:123,player},steam_profile_id:99,team_clan:{team_id:7},headshots:hs,kills:15,...overrides});
const match={id:12,slug:'test-match',game_version:2,status:'finished',start_date:'2026-09-21T12:00:00Z',team1:{id:7,name:'One'},team2:{id:8,name:'Two'},games:[{id:2,number:2,status:'finished',rounds_count:20,map_name:'de_mirage'},{id:1,number:1,status:'finished',rounds_count:23,map_name:'de_nuke'}]};
test('uses verified identity across two ordered maps and rejects crossed identities',()=>{
 const stats={1:normalizeStats([stat(5)]),2:normalizeStats([stat(7)])};const r=completedSeries(match,stats)[123];assert.equal(r.record.headshots,12);assert.equal(r.record.map1,5);assert.equal(r.record.maps[0].name,'de_nuke');
 assert.equal(normalizeStats([stat(20)]).length,0);assert.equal(normalizeStats([stat(5,{steam_profile:{player_id:1,player}})]).length,0);
 assert.deepEqual(completedSeries(match,{1:stats[1],2:normalizeStats([stat(7,{steam_profile_id:11})])}),{});
 assert.deepEqual(completedSeries(match,{1:[...stats[1],...stats[1]],2:stats[2]}),{});
 assert.deepEqual(completedSeries({...match,game_version:1},stats),{});
});
test('uncached history emits real records and reuses completed-match cache',async()=>{
 const map=new Map(),cache={async match(r){return map.get(r.url)?.clone();},async put(r,v){map.set(r.url,v.clone());}};let calls=0;
 const fetcher=async url=>{calls++;const p=new URL(url).pathname;return Response.json(p.endsWith('/matches')?{results:[{id:12,slug:'test-match'}]}:p.endsWith('/matches/test-match')?match:{results:[stat(p.includes('/games/1/')?5:7)]});};
 const events=[],result=await historyBatch(new Client({fetcher,cache}),123,0,x=>events.push(x));assert.equal(result.matches[0].headshots,12);assert.equal(result.next_offset,null);assert.equal(events[0].record.id,12);assert.equal(calls,4);
 await historyBatch(new Client({fetcher,cache}),123,0);assert.equal(calls,4);
});
test('a blocked source stops subsequent requests and missing maps are excluded',async()=>{
 let calls=0;const c=new Client({cache:null,fetcher:async()=>{calls++;return new Response('',{status:429});}});await assert.rejects(c.get('/test-limit'),/busy/);await assert.rejects(c.get('/test-limit-again'),/busy/);assert.equal(calls,1);
 const fetcher=async url=>Response.json(new URL(url).pathname.endsWith('/matches')?{results:[{id:12,slug:'test-match'}]}:{...match,games:[match.games[0]]});const result=await historyBatch(new Client({cache:null,fetcher}),123,0);assert.equal(result.matches.length,0);assert.equal(result.excluded.length,1);
});
test('rejects arbitrary player IDs and out-of-range pagination',async()=>{await assert.rejects(historyBatch(new Client(),-1,0),/Invalid/);await assert.rejects(historyBatch(new Client(),123,60),/Invalid/);});
test('restricted default cache never blocks history and named cache is reused',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'caches');let defaultReads=0,opens=0,calls=0;
 const map=new Map(),cache={async match(r){return map.get(r.url)?.clone();},async put(r,v){map.set(r.url,v.clone());}};
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{get default(){defaultReads++;throw Error('This Worker is not permitted to access the default cache.');},async open(name){opens++;assert.equal(name,'headshot-public-source-v1');return cache;}}});
 const fetcher=async url=>{calls++;const p=new URL(url).pathname;return Response.json(p.endsWith('/matches')?{results:[{id:12,slug:'test-match'}]}:p.endsWith('/matches/test-match')?match:{results:[stat(6)]});};
 try{const result=await historyBatch(new Client({fetcher}),123,0);assert.equal(result.matches[0].headshots,12);await historyBatch(new Client({fetcher}),123,0);assert.equal(calls,4);assert.equal(defaultReads,0);assert.equal(opens,2);}
 finally{if(previous)Object.defineProperty(globalThis,'caches',previous);else delete globalThis.caches;}
});
test('cache opening, reading and writing failures preserve valid source data',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'caches');
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{open(){throw Error('Cache unavailable');}}});
 try{
  const cases=[undefined,{match(){throw Error('Read denied');},put(){throw Error('Write denied');}},{async match(){throw Error('Read rejected');}},{async match(){},put(){throw Error('Write denied');}},{async match(){},async put(){throw Error('Write rejected');}},{async match(){return new Response('bad JSON');}}];
  for(let i=0;i<cases.length;i++){let calls=0;const c=new Client({cache:cases[i],fetcher:async()=>{calls++;return Response.json({headshots:17});}});assert.deepEqual(await c.get('/cache-failure-'+i),{headshots:17});assert.equal(calls,1);}
 }finally{if(previous)Object.defineProperty(globalThis,'caches',previous);else delete globalThis.caches;}
});
