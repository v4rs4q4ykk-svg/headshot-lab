// Public-source snapshots make the current board useful on the first visit.
// Run explicitly or from a scheduled repository job; no account credentials.
import {readFileSync,writeFileSync} from 'node:fs';
import {Client,search,historyBatch} from '../server/api.mjs';
import {liveLines,attachPlayers} from '../server/lines.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const index=read('public/data/bo3_players.json'),catalog=read('public/data/research_catalog.json');
const values=new Map(),cache={async match(k){return values.get(k.url)?.clone();},async put(k,v){values.set(k.url,v.clone());}};
let feed=attachPlayers(await liveLines({cache:null}),index.players,catalog.players);
for(const p of feed.lines.filter(x=>!x.bo3_player_id)){
 const xs=(await search(new Client({cache}),p.name)).filter(x=>x.name.toLowerCase()===p.name.toLowerCase());
 if(xs.length===1){const i=index.players.findIndex(x=>x.id===xs[0].id);if(i<0)index.players.push(xs[0]);else index.players[i]=xs[0];}
}
feed=attachPlayers(feed,index.players,catalog.players);
writeFileSync('public/data/bo3_players.json',JSON.stringify(index));
const work=[...new Map(feed.lines.filter(x=>x.bo3_player_id).map(x=>[x.bo3_player_id,x])).values()];
console.log(JSON.stringify({offers:feed.lines.length,players:work.length,unmatched:feed.lines.filter(x=>!x.bo3_player_id).map(x=>x.name)}));
async function next(){while(work.length){const p=work.shift(),id=p.bo3_player_id,matches=[];let offset=0,player=null,checked=0;
 try{do{const batch=await historyBatch(new Client({cache}),id,offset);for(const m of batch.matches)if(!matches.some(x=>x.id===m.id))matches.push(m);offset=batch.next_offset;player=batch.player||player;checked+=batch.checked;}while(offset!==null&&matches.length<20);
  matches.sort((a,b)=>b.played_at.localeCompare(a.played_at));const data={schema_version:3,kind:'cs2_player_research',bo3_player_id:id,nickname:p.name,player,matches:matches.slice(0,20),retrieved_at:new Date().toISOString(),coverage:{full_player_scan:true,candidates_checked:checked},source:'BO3.gg public match and per-game player records'};
  if(!matches.length){console.log(JSON.stringify({name:p.name,series:0}));continue;}
  writeFileSync('public/data/player_histories/'+id+'.json',JSON.stringify(data));
  const row={id,name:p.name,team:matches[0].team,team_id:player?.team_id,series:data.matches.length,retrieved_at:data.retrieved_at,full_player_scan:true,recent_totals:data.matches.map(x=>x.headshots)};
  const i=catalog.players.findIndex(x=>x.id===id);if(i<0)catalog.players.push(row);else catalog.players[i]=row;
  console.log(JSON.stringify({name:p.name,series:data.matches.length}));
 }catch(e){console.log(JSON.stringify({name:p.name,error:e.message}));}
}}
await Promise.all([next(),next()]);catalog.updated_at=new Date().toISOString();writeFileSync('public/data/research_catalog.json',JSON.stringify(catalog));
