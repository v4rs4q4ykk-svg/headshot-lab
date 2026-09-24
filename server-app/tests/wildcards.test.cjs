const test=require('node:test'),assert=require('node:assert/strict'),W=require('../public/wildcards.js');
const now=Date.parse('2026-09-24T00:00:00Z');
function sample(){
 const offer={id:'p1',bo3_player_id:1,name:'Player',team:'Alpha',opponent:'Bravo',line:15,starts_at:'2026-09-24T09:00:00Z'};
 const matches=Array.from({length:20},(_,i)=>({id:i+1,played_at:new Date(now-(i+1)*86400000).toISOString(),team_id:11,team:'Alpha',opponent:{id:i<4?12:13,name:i<4?'Bravo':'Other'},map1:10,map2:10,headshots:20,maps:[{name:'de_nuke',rounds:24},{name:'de_mirage',rounds:24}]}));
 const data={bo3_player_id:1,player:{team_id:11},retrieved_at:new Date(now-1000).toISOString(),coverage:{full_player_scan:true},matches};
 const metadata={retrieved_at:new Date(now-1000).toISOString(),upcoming:[{id:100,status:'upcoming',bo_type:3,start_date:offer.starts_at,teams:[{id:11,name:'Alpha'},{id:12,name:'Bravo'}],confirmed_maps:['de_nuke','de_mirage']}],team_profiles:{}};
 return {offer,data,metadata};
}
const run=x=>W.evaluate(x.offer,x.data,x.metadata,now);
test('only complete agreement qualifies, with all reasons and numbers retained',()=>{const r=run(sample());assert.equal(r.qualified,true);assert.equal(r.support,8);assert.equal(r.summary.over,10);assert.equal(r.effect.baseline,20);assert.equal(r.h2h.n,4);assert.equal(r.matches.length,10);});
test('strong recent form cannot hide missing opponent or map evidence',()=>{for(const change of [x=>x.metadata.upcoming[0].confirmed_maps=[],x=>x.data.matches.forEach(m=>m.opponent.id=13)]){const x=sample();change(x);const r=run(x);assert.equal(r.candidate,true);assert.equal(r.qualified,false);assert.ok(r.checks.some(c=>c.status==='missing'));}});
test('wrong opponent, wrong start, scenarios, stale schedule and stale history do not qualify',()=>{for(const change of [x=>x.offer.opponent='Other',x=>x.metadata.upcoming[0].start_date='2026-09-25T09:00:00Z',x=>x.metadata.upcoming[0].hypothetical=true,x=>x.metadata.retrieved_at='2026-09-23T00:00:00Z',x=>x.data.retrieved_at='2026-09-22T00:00:00Z',x=>x.offer.starts_at='2026-09-23T09:00:00Z']){const x=sample();change(x);assert.equal(run(x).qualified,false);}});
test('pushes are not overs, changes to lines immediately remove qualification',()=>{const x=sample();x.offer.line=20;const r=run(x);assert.equal(r.summary.push,10);assert.equal(r.summary.over,0);assert.equal(r.qualified,false);assert.equal(r.candidate,false);});
test('a big outlier cannot replace consistent results and small map samples stay missing',()=>{const x=sample();x.data.matches[0].map1=100;x.data.matches[0].headshots=110;for(let i=1;i<6;i++){x.data.matches[i].map1=5;x.data.matches[i].map2=5;x.data.matches[i].headshots=10;}assert.equal(run(x).qualified,false);const y=sample();y.metadata.upcoming[0].confirmed_maps=['de_nuke','de_ancient'];assert.equal(run(y).checks.find(c=>c.key==='maps').status,'missing');});
test('team changes and cross-player history cannot silently qualify',()=>{const x=sample();x.data.matches[0].team_id=99;assert.equal(run(x).checks.find(c=>c.key==='team').status,'against');x.data.bo3_player_id=2;assert.equal(run(x).qualified,false);});
