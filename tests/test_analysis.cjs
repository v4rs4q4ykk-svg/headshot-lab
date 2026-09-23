const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../analysis.js');
const now=Date.parse('2026-09-23T12:00:00Z');
const pool=['de_mirage','de_nuke','de_inferno','de_dust2','de_cache','de_anubis','de_ancient'];
function veto(a=1,b=2,rotate=0){return pool.map((_,i)=>({order:i+1,map:pool[(i+rotate)%7],action:['ban','ban','pick','pick','ban','ban','decider'][i],team_id:i%2?a:b}));}
function profile(id,other){return {team:{id,name:'Team '+id},matches:Array.from({length:10},(_,i)=>({id:id*100+i,played_at:new Date(now-(i+1)*86400000).toISOString(),veto:veto(id,other,i%2),maps:[]}))};}
const fixture={bo_type:3,teams:[{id:1},{id:2}],confirmed_maps:[]};
const profiles={1:profile(1,2),2:profile(2,1)};
const records=Array.from({length:20},(_,i)=>({id:i+1,played_at:new Date(now-i*86400000).toISOString(),map1:5,map2:5+i%3,headshots:10+i%3,maps:[{name:'de_nuke',rounds:20},{name:'de_mirage',rounds:22}]}));
test('pushes are counted separately; incomplete L20 stays incomplete',()=>{const s=C.windows(records.slice(0,15),11);assert.equal(s[0].over+s[0].under+s[0].push,10);assert.ok(s[0].push>0);assert.equal(s[2].complete,false);});
test('invalid or duplicate totals are excluded rather than zero filled',()=>{assert.equal(C.records({matches:[...records,records[0],{...records[1],id:22,headshots:999}]}).length,20);});
test('map rates weight actual rounds',()=>{const s=C.mapStats(records);assert.equal(s.find(x=>x.map==='de_nuke').hsPerRound,.25);});
test('veto enumeration sums to one pair and two included maps',()=>{const p=C.forecast(fixture,profiles,now);assert.equal(p.available,true);assert.ok(Math.abs(p.pairs.reduce((s,x)=>s+x.probability,0)-1)<1e-10);assert.ok(Math.abs(p.maps.reduce((s,x)=>s+x.inclusion,0)-2)<1e-10);assert.ok(p.pairs.every(x=>x.map1!==x.map2));assert.ok(p.maps.every(x=>x.inclusion<=1+1e-10));});
test('confirmed maps override tendencies',()=>{const p=C.forecast({...fixture,confirmed_maps:['de_nuke','de_mirage']},{},now);assert.equal(p.confirmed,true);assert.equal(p.pairs[0].probability,1);});
test('different pools, sparse samples, and future history cannot generate a forecast',()=>{let q=structuredClone(profiles);q[2].matches.forEach(m=>m.veto[0].map='de_train');assert.equal(C.forecast(fixture,q,now).available,false);q=structuredClone(profiles);q[2].matches=q[2].matches.slice(0,4);assert.equal(C.forecast(fixture,q,now).available,false);q=structuredClone(profiles);q[2].matches.forEach(m=>m.played_at='2027-01-01');assert.equal(C.forecast(fixture,q,now).available,false);});
test('non BO3 and outdated pools remain unavailable',()=>{assert.equal(C.forecast({...fixture,bo_type:1},profiles,now).available,false);assert.equal(C.forecast(fixture,profiles,now+40*86400000).available,false);});
test('model reports fallback for maps with no player history',()=>{const p=C.forecast(fixture,profiles,now);const e=C.mapEffect(records,p,profiles);assert.ok(Number.isFinite(e.baseline));assert.ok(e.fallbackMass>0&&e.fallbackMass<1);assert.equal(C.mapEffect([],p,profiles),null);});
