import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import worker from './dist/server/index.js';
const cache=new Map();globalThis.caches={default:{async match(r){const x=cache.get(r.url);return x&&x.exp>Date.now()?x.response.clone():undefined;},async put(r,response){cache.set(r.url,{response:response.clone(),exp:Date.now()+Number(response.headers.get('Cache-Control').match(/max-age=(\d+)/)?.[1]||300)*1000});}}};
createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const r=await worker.fetch(new Request('http://localhost:'+ (process.env.PORT||8765)+req.url,{method:req.method,headers:req.headers,...(body.length?{body}: {})}),{},{waitUntil(p){p.catch(()=>{});}});res.writeHead(r.status,Object.fromEntries(r.headers));if(r.body)Readable.fromWeb(r.body).pipe(res);else res.end();}).listen(Number(process.env.PORT||8765),'127.0.0.1',()=>console.log('Headshot Lab server listening'));
