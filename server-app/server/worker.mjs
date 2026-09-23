import assets from './assets.js';
import {Client,SourceError,search,historyBatch,matchup,positive} from './api.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default {async fetch(request,env,ctx){
 const u=new URL(request.url),p=u.pathname;
 if(!['GET','HEAD','POST'].includes(request.method))return json({message:'Method not allowed.'},405);
 try{
  if(p==='/api/search')return json({players:await search(new Client({signal:request.signal}),u.searchParams.get('q'))});
  if(p==='/api/history'){
   const id=Number(u.searchParams.get('id')),offset=Number(u.searchParams.get('offset')||0);
   if(!positive(id)||!Number.isInteger(offset)||offset<0||offset>50||offset%10)return json({message:'Invalid player or page.'},400);
   const encoder=new TextEncoder(),controller=new AbortController();
   const stream=new ReadableStream({start(c){const send=x=>{try{c.enqueue(encoder.encode(JSON.stringify(x)+'\n'));}catch{controller.abort();}};
    const run=historyBatch(new Client({signal:controller.signal}),id,offset,send).then(result=>send({type:'done',...result})).catch(e=>{console.error('History load failed',{player_id:id,offset,message:e.message});send({type:'error',message:e instanceof SourceError?e.message:'Could not load stats. Please retry.'});}).finally(()=>{try{c.close();}catch{}});ctx?.waitUntil?.(run);},cancel(){controller.abort();}});
   return new Response(stream,{headers:{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(p==='/api/matchup'&&request.method==='POST'){
   const text=await request.text();if(text.length>3000)return json({message:'Request too large.'},400);let body;try{body=JSON.parse(text);}catch{return json({message:'Invalid request.'},400);}
   const id=body.team_id,r=body.recent;
   if(!positive(id)||!r||!positive(r.team_id)||!positive(r.opponent?.id)||typeof r.team!=='string'||typeof r.opponent?.name!=='string')return json({message:'Invalid team.'},400);
   return json(await matchup(new Client({signal:request.signal}),id,{team_id:r.team_id,team:r.team.slice(0,90),opponent:{id:r.opponent.id,name:r.opponent.name.slice(0,90)}}));
  }
  if(p.startsWith('/api/'))return json({message:'Not found.'},404);
  const name=p==='/'?'/index.html':p,body=assets[name];if(body===undefined)return new Response('Not found',{status:404});
  const ext=name.split('.').at(-1),type={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml'}[ext]||'text/plain';
  return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':ext==='html'?'no-cache':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
 }catch(e){return json({message:e instanceof SourceError?e.message:'Unable to load the requested stats.'},e instanceof SourceError?e.status:500);}
}};
