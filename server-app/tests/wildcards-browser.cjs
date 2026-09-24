const {chromium}=require('playwright'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const server=spawn('node',['dev.mjs'],{cwd:require('node:path').resolve(__dirname,'..'),stdio:'inherit'});
(async()=>{let browser;try{
 for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:8765');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,...(process.env.CS2_CHROME_BIN?{executablePath:process.env.CS2_CHROME_BIN}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=Date.now(),stamp=new Date(now).toISOString(),start=new Date(now+3600000).toISOString();
 const data={bo3_player_id:25467,nickname:'SELLTER',player:{team_id:11},retrieved_at:stamp,coverage:{full_player_scan:true},matches:Array.from({length:20},(_,i)=>({id:i+1,played_at:new Date(now-(i+1)*86400000).toISOString(),team_id:11,team:'Nemesis',opponent:{id:12,name:'Bravo'},map1:10,map2:10,headshots:20,maps:[{name:'de_nuke',rounds:24},{name:'de_mirage',rounds:24}]}))};
 let maps=true,available=true;
 await page.addInitScript(d=>localStorage.setItem('cs2-board-history-v1',JSON.stringify({25467:d})),data);
 await page.route('**/api/lines',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({retrieved_at:stamp,expires_at:new Date(now+90000).toISOString(),complete:true,lines:available?[{id:'offer',bo3_player_id:25467,name:'SELLTER',team:'Nemesis',opponent:'Bravo',line:15,starts_at:start}]:[]})}));
 await page.route('**/api/matchup',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({upcoming:[{id:123,status:'upcoming',bo_type:3,start_date:start,teams:[{id:11,name:'Nemesis'},{id:12,name:'Bravo'}],confirmed_maps:maps?['de_nuke','de_mirage']:[]}],team_profiles:{}})}));
 await page.goto('http://127.0.0.1:8765');await page.locator('#wildcard-list .wildcard-card').waitFor();
 assert.equal(await page.locator('#wildcard-list .support').count(),8);assert.equal(await page.locator('#wildcard-watch').isVisible(),false);
 await page.locator('#wildcard-list details summary').click();assert.ok((await page.locator('#wildcard-list details').textContent()).includes('Nuke'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 maps=false;await page.reload();await page.waitForFunction(()=>document.querySelector('#wildcard-watch-list .wildcard-card'));
 assert.equal(await page.locator('#wildcard-list .wildcard-card').count(),0);assert.ok((await page.locator('#wildcard-watch-list').textContent()).includes('Missing evidence'));
 available=false;await page.locator('#refresh-lines').click();await page.waitForFunction(()=>document.querySelectorAll('.wildcard-card').length===0);assert.deepEqual(errors,[]);
 console.log('PASS wildcard qualification, missing maps, evidence details, mobile layout, withdrawn lines');
 }finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
