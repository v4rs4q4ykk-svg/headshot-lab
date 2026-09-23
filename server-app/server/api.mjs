const BASE='https://api.bo3.gg/api/v1';
const DAY=86400000;
export const positive=n=>Number.isSafeInteger(n)&&n>0;
export const rows=x=>Array.isArray(x)?x:Array.isArray(x?.results)?x.results:Array.isArray(x?.data)?x.data:[];
export function identity(x){const name=x?.nickname||x?.name;return positive(x?.id)&&typeof name==='string'&&name.trim().length>0&&name.length<=90?{id:x.id,name:name.trim(),slug:x.slug,team_id:positive(x.team_id)?x.team_id:null}:null;}
const team=x=>{const p=identity(x);return p?{id:p.id,name:p.name,slug:p.slug}:null;};
export class SourceError extends Error{constructor(message,status=502){super(message);this.status=status;}}
const inflight=new Map();let active=0;const waiting=[];
async function slot(fn){if(active>=4)await new Promise(r=>waiting.push(r));active++;try{return await fn();}finally{active--;waiting.shift()?.();}}
export class Client{
 constructor({fetcher=fetch,cache=globalThis.caches?.default,signal}={}){this.fetcher=fetcher;this.cache=cache;this.signal=signal;this.calls=0;this.blocked=null;}
 async get(path,params={},ttl=300,transform=x=>x){
  if(this.signal?.aborted)throw new SourceError('Search cancelled.',499);
  if(this.blocked)throw this.blocked;
  const url=new URL(BASE+path);Object.keys(params).sort().forEach(k=>url.searchParams.set(k,String(params[k])));
  const key=new Request(url.href);const hit=await this.cache?.match(key);if(hit)return hit.json();
  if(inflight.has(url.href))return inflight.get(url.href);
  const task=slot(async()=>{
   if(this.blocked)throw this.blocked;
   if(++this.calls>40)throw new SourceError('Source request limit reached.');
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
   const cancel=()=>controller.abort();this.signal?.addEventListener('abort',cancel,{once:true});
   try{
    const response=await this.fetcher(url.href,{headers:{Accept:'application/json'},signal:controller.signal});
    if(!response.ok){const e=new SourceError(response.status===429?'The stats source is busy. Try again shortly.':'Stats source returned HTTP '+response.status+'.',response.status===429?429:502);if([401,403,429].includes(response.status))this.blocked=e;throw e;}
    const body=await response.text();if(body.length>5_000_000)throw new SourceError('Source response is too large.');
    let value;try{value=transform(JSON.parse(body));}catch{throw new SourceError('The stats source returned an unreadable response.');}
    if(this.cache)await this.cache.put(key,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age='+ttl}})).catch(()=>{});
    return value;
   }catch(e){if(e instanceof SourceError)throw e;throw new SourceError(controller.signal.aborted?'The stats source took too long. Please retry.':'Could not connect to the stats source.');}
   finally{clearTimeout(timeout);this.signal?.removeEventListener('abort',cancel);}
  });inflight.set(url.href,task);try{return await task;}finally{inflight.delete(url.href);}
 }
}
export async function search(client,q){if(typeof q!=='string'||!q.trim()||q.length>90||/[\r\n<>]/.test(q))throw new SourceError('Enter a player nickname.',400);return rows(await client.get('/filters/players',{'search_text':q.trim(),'page[limit]':30,'filter[discipline_id][eq]':1},900)).map(identity).filter(Boolean);}
export function vetoes(m){return (m.match_maps||[]).filter(x=>x&&/^[a-z0-9_]{3,40}$/.test(x.maps?.map_name||'')&&positive(x.order)&&[1,2,3].includes(x.choice_type)).map(x=>({order:x.order,action:{1:'pick',2:'ban',3:'decider'}[x.choice_type],team_id:x.team_id,map:x.maps.map_name})).sort((a,b)=>a.order-b.order);}
export function fixture(m){const a=team(m?.team1),b=team(m?.team2);if(!a||!b||a.id===b.id||!positive(m.id))return null;const games=m.games||[],actions=vetoes(m);let maps=[1,2].map(n=>games.find(g=>g.number===n)?.map_name).filter(x=>/^de_[a-z0-9_]+$/.test(x||''));if(maps.length!==2&&m.bo_type===3)maps=actions.filter(x=>x.action==='pick').slice(0,2).map(x=>x.map);return {id:m.id,slug:m.slug,start_date:m.start_date,status:m.status,bo_type:m.bo_type,teams:[a,b],confirmed_maps:maps,veto:actions,tournament:m.tournament?.name};}
export function normalizeStats(data){return rows(data).flatMap(r=>{const profile=r.steam_profile||{},p=identity(profile.player),tid=r.team_clan?.team_id,hs=r.headshots,kills=r.kills;if(!p||profile.player_id!==p.id||!positive(tid)||!Number.isInteger(hs)||hs<0||(Number.isInteger(kills)&&(hs>kills||kills<0))||!positive(r.steam_profile_id))return [];return [{player:p,team_id:tid,headshots:hs,kills,profile_id:r.steam_profile_id}];});}
export function completedSeries(m,stats){
 if(m?.game_version!==2||m.status!=='finished'||!Number.isFinite(Date.parse(m.start_date)))return {};
 const f=fixture(m);if(!f)return {};const games=(m.games||[]).filter(g=>[1,2].includes(g.number));if(games.length!==2||new Set(games.map(g=>g.number)).size!==2||games.some(g=>g.status!=='finished'||!positive(g.rounds_count)))return {};
 const maps={};for(const n of [1,2]){const found=new Map(),duplicates=new Set();for(const r of stats[n]||[]){if(found.has(r.player.id))duplicates.add(r.player.id);found.set(r.player.id,r);}duplicates.forEach(id=>found.delete(id));maps[n]=found;}
 const out={};for(const [id,a] of maps[1]){const b=maps[2].get(id),own=f.teams.find(t=>t.id===a.team_id);if(!b||!own||b.team_id!==a.team_id||b.profile_id!==a.profile_id)continue;const mapData=[1,2].map(n=>{const g=games.find(g=>g.number===n),s=maps[n].get(id);return {id:g.id,name:g.map_name,rounds:g.rounds_count,headshots:s.headshots,kills:s.kills};});out[id]={player:a.player,record:{id:m.id,slug:m.slug,played_at:m.start_date,team:own.name,team_id:own.id,opponent:f.teams.find(t=>t.id!==own.id),maps:mapData,map1:a.headshots,map2:b.headshots,headshots:a.headshots+b.headshots,veto:f.veto}};}return out;
}
const query=extra=>({'scope':'widget-matches','page[limit]':10,'page[offset]':0,'sort':'-start_date','filter[matches.status][in]':'finished','filter[matches.discipline_id][eq]':1,'with':'teams',...extra});
export async function historyBatch(client,id,offset,emit=()=>{}){
 if(!positive(id)||!Number.isInteger(offset)||offset<0||offset>50||offset%10)throw new SourceError('Invalid player or history page.',400);
 const candidates=rows(await client.get('/matches',query({'page[offset]':offset,'filter[matches.player_ids][overlap]':id,with:'teams,games'}),300));
 const seen=new Set(),matches=[],excluded=[];let player=null,index=0;
 async function next(){while(index<candidates.length){if(client.blocked)throw client.blocked;const c=candidates[index++];if(seen.has(c.id))continue;seen.add(c.id);if(!/^[a-zA-Z0-9_-]{1,180}$/.test(c.slug||''))continue;
  // The listing gives map IDs, so fetch stats alongside match verification.
  // Only matching, completed CS2 maps from the detail response are accepted.
  const listed=(c.games||[]).filter(g=>[1,2].includes(g.number)&&positive(g.id));
  const ready=listed.length===2&&new Set(listed.map(g=>g.number)).size===2;
  const [m,early]=await Promise.all([
   client.get('/matches/'+c.slug,{with:'teams,games,match_maps'},86400),
   ready?Promise.all(listed.map(async g=>[g.id,await client.get('/games/'+g.id+'/players_stats',{},86400,normalizeStats)])):Promise.resolve([])
  ]);const prefetched=new Map(early);
  const games=(m.games||[]).filter(g=>[1,2].includes(g.number));let record=null;
  if(m.game_version===2&&m.status==='finished'&&games.length===2&&new Set(games.map(g=>g.number)).size===2&&games.every(g=>g.status==='finished'&&positive(g.rounds_count)&&positive(g.id))){const all=await Promise.all(games.map(async g=>[g.number,prefetched.get(g.id)||await client.get('/games/'+g.id+'/players_stats',{},86400,normalizeStats)]));const found=completedSeries(m,Object.fromEntries(all));if(found[id]){player=found[id].player;record=found[id].record;matches.push(record);}}
  if(!record)excluded.push({id:m.id,date:m.start_date,reason:'No two completed CS2 maps with verified player headshots'});
  emit({type:'progress',record,player:record?player:null,checked:matches.length+excluded.length});
 }}
 await Promise.all([next(),next(),next()]);matches.sort((a,b)=>b.played_at.localeCompare(a.played_at));
 return {matches,player,excluded,checked:seen.size,next_offset:candidates.length===10&&offset<50?offset+10:null};
}
function validVeto(v){return v.length===7&&new Set(v.map(x=>x.map)).size===7&&v.every((x,i)=>x.order===i+1&&x.action===['ban','ban','pick','pick','ban','ban','decider'][i])&&positive(v[0].team_id)&&positive(v[1].team_id)&&v[0].team_id!==v[1].team_id&&v.slice(0,6).every((x,i)=>x.team_id===v[i%2].team_id);}
export async function matchup(client,tid,recent){
 if(!positive(tid))return {upcoming:[],team_profiles:{}};
 const upcoming=[];for(const m of rows(await client.get('/matches',query({'page[limit]':3,'sort':'start_date','filter[matches.status][in]':'upcoming,current','filter[matches.team_ids][overlap]':tid,'with':'teams,games'}),300))){if(!/^[a-zA-Z0-9_-]{1,180}$/.test(m.slug||''))continue;const f=fixture(await client.get('/matches/'+m.slug,{with:'teams,games,match_maps'},300));if(f&&f.teams.some(t=>t.id===tid)&&['current','upcoming'].includes(f.status))upcoming.push(f);}
 const wanted=new Map(upcoming.flatMap(f=>f.teams).map(t=>[t.id,t]));if(recent){wanted.set(recent.team_id,{id:recent.team_id,name:recent.team});wanted.set(recent.opponent.id,recent.opponent);}
 const profiles={};for(const t of [...wanted.values()].slice(0,4)){const all=rows(await client.get('/matches',query({'scope':'widget-map-pool','page[limit]':30,'filter[matches.team_ids][overlap]':t.id,'filter[matches.start_date][gt]':new Date(Date.now()-180*DAY).toISOString().slice(0,10),'with':'teams,games,match_maps'}),7200));const seen=new Set();profiles[t.id]={team:t,retrieved_at:new Date().toISOString(),matches:all.filter(m=>{const v=vetoes(m);if(seen.has(m.id)||!validVeto(v)||![v[0].team_id,v[1].team_id].includes(t.id))return false;seen.add(m.id);return true;}).slice(0,20).map(m=>({id:m.id,played_at:m.start_date,veto:vetoes(m),maps:(m.games||[]).filter(g=>g.status==='finished').map(g=>({name:g.map_name,rounds:g.rounds_count}))}))};}
 return {upcoming,team_profiles:profiles};
}
