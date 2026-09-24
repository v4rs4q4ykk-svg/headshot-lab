import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLines,attachPlayers,liveLines} from '../server/lines.mjs';
const now=Date.parse('2026-09-24T00:00:00Z');
function payload(){return {meta:{total_pages:1},included:[{type:'new_player',id:'1',attributes:{name:'SELLTER',team:'Nemesis',league:'CS2'}}],data:[{id:'p1',attributes:{stat_type:'MAPS 1-2 Headshots',odds_type:'standard',status:'pre_game',line_score:15,start_time:'2026-09-24T09:00:00Z',description:'Rune Eaters MAPS 1-2'},relationships:{new_player:{data:{type:'new_player',id:'1'}}}}]};}
test('normalizes only upcoming standard CS2 Maps 1–2 headshot offers',()=>{
 const p=payload(),good=p.data[0];for(const change of [{stat_type:'MAPS 1-2 Kills'},{odds_type:'goblin'},{status:'suspended'},{start_time:'2026-09-23T09:00:00Z'},{line_score:null},{is_promo:true},{is_live:true}])p.data.push({...good,id:JSON.stringify(change),attributes:{...good.attributes,...change}});
 const x=normalizeLines(p,now);assert.equal(x.lines.length,1);assert.equal(x.lines[0].line,15);assert.equal(x.lines[0].opponent,'Rune Eaters');assert.equal(x.complete,true);
});
test('duplicate names require team disambiguation; unknown identities stay unmatched',()=>{
 const feed=normalizeLines(payload(),now),idx=[{id:1,name:'sellter'},{id:2,name:'SELLTER'}];
 assert.equal(attachPlayers(feed,idx,[]).lines[0].bo3_player_id,null);
 assert.equal(attachPlayers(feed,idx,[{id:2,team:'Nemesis'}]).lines[0].bo3_player_id,2);
 assert.equal(attachPlayers(feed,[],[]).lines[0].bo3_player_id,null);
});
test('an expired cache cannot silently return old lines on a source failure',async()=>{
 const cache={match:async()=>new Response(JSON.stringify(normalizeLines(payload(),now-120000)))};
 await assert.rejects(liveLines({now,cache,fetcher:async()=>new Response('',{status:403})}),/unavailable/);
});
test('cache failure does not prevent retrieving current lines',async()=>{
 const cache={match:async()=>{throw Error('denied');}};
 const x=await liveLines({now,cache,fetcher:async()=>new Response(JSON.stringify(payload()))});assert.equal(x.lines[0].line,15);
});
