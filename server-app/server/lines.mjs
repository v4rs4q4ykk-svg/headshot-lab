import {SourceError} from './api.mjs';
export const LINE_URL='https://partner-api.prizepicks.com/projections?per_page=100';
const norm=x=>String(x||'').trim().toLowerCase();
export function normalizeLines(payload,now=Date.now()){
 if(!Array.isArray(payload?.data)||!Array.isArray(payload?.included))throw new SourceError('The line feed returned an unreadable response.');
 const included=new Map(payload.included.map(x=>[x.type+':'+x.id,x.attributes||{}]));
 const related=(x,k)=>{const r=x.relationships?.[k]?.data;return r?included.get(r.type+':'+r.id)||{}:{};};
 const seen=new Set(),lines=[];
 for(const x of payload.data){
  const a=x.attributes||{},p=related(x,'new_player'),league=related(x,'league');
  if(norm(league.name||p.league)!=='cs2'||a.stat_type!=='MAPS 1-2 Headshots'||a.odds_type!=='standard'||a.status!=='pre_game'||a.in_game||a.is_live||a.is_promo||p.combo)continue;
  if(typeof a.line_score!=='number'||!Number.isFinite(a.line_score)||a.line_score<0||a.line_score>200||Date.parse(a.start_time)<=now||!Number.isFinite(Date.parse(a.start_time)))continue;
  if(typeof p.name!=='string'||!p.name.trim()||seen.has(x.id))continue;
  seen.add(x.id);lines.push({id:String(x.id),player_id:String(x.relationships.new_player.data.id),name:p.name,team:p.team_name||p.team||'',line:a.line_score,opponent:String(a.description||'').replace(/\s*MAPS 1-2\s*$/i,''),starts_at:a.start_time,updated_at:a.updated_at||null});
 }
 return {source:'PrizePicks public projection feed',retrieved_at:new Date(now).toISOString(),expires_at:new Date(now+90000).toISOString(),complete:payload.meta?.total_pages===1,lines:lines.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)||a.name.localeCompare(b.name))};
}
export function attachPlayers(feed,index,catalog){
 return {...feed,lines:feed.lines.map(line=>{
  let candidates=index.filter(p=>norm(p.name)===norm(line.name));
  if(candidates.length>1)candidates=candidates.filter(p=>catalog.some(c=>c.id===p.id&&norm(c.team)===norm(line.team)));
  const p=candidates.length===1?candidates[0]:null;
  return {...line,bo3_player_id:p?.id||null};
 })};
}
export async function liveLines({fetcher=(...args)=>globalThis.fetch(...args),cache,now=Date.now()}={}){
 if(cache===undefined){try{cache=await globalThis.caches?.open?.('headshot-lines-v1');}catch{cache=null;}}
 const key=new Request('https://headshot.internal/current-lines');
 try{const hit=await cache?.match(key);if(hit){const value=await hit.json();if(now-Date.parse(value.retrieved_at)<60000)return {...value,lines:value.lines.filter(x=>Date.parse(x.starts_at)>now)};}}catch{cache=null;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const r=await fetcher(LINE_URL,{headers:{Accept:'application/json','User-Agent':'Headshot-Lab/1.0'},signal:controller.signal});
  if(!r.ok)throw new SourceError('Current PrizePicks lines are unavailable (HTTP '+r.status+'). Please retry shortly.');
  const body=await r.text();if(body.length>40_000_000)throw new SourceError('The line feed response is too large.');
  const result=normalizeLines(JSON.parse(body),now);
  try{await cache?.put(key,new Response(JSON.stringify(result),{headers:{'Cache-Control':'public, max-age=60'}}));}catch{}
  return result;
 }catch(e){if(e instanceof SourceError)throw e;throw new SourceError('Could not refresh PrizePicks lines. Please retry shortly.');}finally{clearTimeout(timer);}
}
