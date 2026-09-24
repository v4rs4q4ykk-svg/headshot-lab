const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const root=require('node:path').resolve(__dirname,'..');
const server=spawn('node',['dev.mjs'],{cwd:root,stdio:'inherit'});
(async()=>{let browser;try{
 for(let n=0;n<60;n++){try{await fetch('http://127.0.0.1:8765');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({headless:true,...(process.env.CS2_CHROME_BIN?{executablePath:process.env.CS2_CHROME_BIN}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const saved=JSON.parse(fs.readFileSync(root+'/public/data/player_histories/25467.json','utf8'));saved.retrieved_at=new Date().toISOString();saved.coverage.full_player_scan=true;
 let line=saved.matches[0].headshots,fail=false;
 await page.route('**/api/lines',r=>r.fulfill({status:fail?502:200,contentType:'application/json',body:JSON.stringify(fail?{message:'Feed unavailable'}:{lines:[{id:'test-offer',bo3_player_id:25467,name:'SELLTER',team:'Nemesis',opponent:'Test opponent',line,starts_at:new Date(Date.now()+3600000).toISOString()}],retrieved_at:new Date().toISOString(),expires_at:new Date(Date.now()+90000).toISOString(),complete:true})}));
 await page.route('**/api/matchup',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({upcoming:[],team_profiles:{}})}));
 await page.addInitScript(d=>{localStorage.setItem('cs2-history-25467',JSON.stringify(d));localStorage.setItem('cs2-board-history-v1',JSON.stringify({25467:d}));},saved);
 await page.goto('http://127.0.0.1:8765/?player=25467');
 await page.waitForFunction(()=>document.querySelector('#projection')?.selectedOptions[0]?.textContent.includes('HS'));
 assert.equal(await page.locator('input[type=number]').count(),0,'No manual line entry');
 for(const n of [10,15,20]){await page.locator('#board-sort').selectOption(String(n));const expected=(saved.matches.slice(0,n).filter(x=>x.headshots>line).length/n*100).toFixed(1)+'%';assert.ok((await page.locator('#board-table').textContent()).includes(expected));}
 assert.ok((await page.locator('#window-stats').textContent()).includes('push'));
 const old=await page.locator('#window-stats').textContent();line=199;await page.locator('#refresh-lines').click();await page.waitForFunction(()=>document.querySelector('#projection').textContent.includes('199 HS'));assert.notEqual(await page.locator('#window-stats').textContent(),old);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No phone overflow');
 fail=true;await page.locator('#refresh-lines').click();await page.waitForFunction(()=>document.querySelector('#board-status').textContent==='Feed unavailable');assert.equal(await page.locator('#projection').isDisabled(),true);assert.equal(await page.locator('#board-table tbody tr').count(),0,'Unavailable lines cannot remain ranked');
 assert.deepEqual(errors,[]);console.log('PASS automatic lines, changed lines, L10/L15/L20 ranks, pushes, failed feed, mobile layout');
 }finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
