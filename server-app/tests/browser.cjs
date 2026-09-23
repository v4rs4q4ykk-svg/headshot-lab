const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=spawn('node',['dev.mjs'],{cwd:root,stdio:'inherit'});
(async()=>{let browser;try{
 for(let n=0;n<60;n++){try{await fetch('http://127.0.0.1:8765');break;}catch{await new Promise(r=>setTimeout(r,200));}}
 browser=await chromium.launch({headless:true,...(process.env.CS2_CHROME_BIN?{executablePath:process.env.CS2_CHROME_BIN}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let issueRequests=0;page.on('request',r=>{if(r.url().includes('/issues/'))issueRequests++;});
 await page.goto('http://127.0.0.1:8765');await page.locator('#quick-players button').first().waitFor();
 assert.ok(!fs.existsSync(path.join(root,'public/data/player_histories/29224.json')),'Cold test must not contain saved Dragon stats');
 await page.locator('#player-search').fill('Dragon');const button=page.locator('#search-results button').filter({has:page.locator('strong',{hasText:/^Dragon$/})}).first();
 const start=Date.now();await button.click();await page.waitForFunction(()=>!document.getElementById('player-view').hidden&&document.getElementById('history-table').querySelectorAll('tbody tr').length>0,{},{timeout:60000});const firstMs=Date.now()-start;
 await page.waitForFunction(()=>document.getElementById('request-panel').hidden,{},{timeout:150000});const fullMs=Date.now()-start;
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('cs2-history-29224')));assert.ok(data.matches.length>=20,'Expected full twenty-series Dragon history');assert.equal(data.nickname,'Dragon');
 const values=await page.locator('#window-stats .value').allTextContents();assert.equal(values[0],(data.matches.slice(0,10).reduce((s,m)=>s+m.headshots,0)/10).toFixed(1));assert.equal(values[2],(data.matches.slice(0,20).reduce((s,m)=>s+m.headshots,0)/20).toFixed(1));
 await page.locator('#projection').fill(String(data.matches[0].headshots));assert.ok((await page.locator('#window-stats').textContent()).includes('push'));
 await page.locator('#opponent-select').selectOption(String(data.matches[0].opponent.id));assert.equal(await page.locator('#history-table tbody tr').count(),data.matches.filter(m=>m.opponent.id===data.matches[0].opponent.id).length);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/phone.png'),fullPage:true});
 const warm=Date.now();await page.reload();await page.waitForFunction(()=>!document.getElementById('player-view').hidden&&document.getElementById('request-panel').hidden);const warmMs=Date.now()-warm;assert.ok(warmMs<3500,'Repeat search should use saved results');
 await page.setViewportSize({width:1280,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // A new source identity can load without an index entry or an issue request.
 await page.route('**/api/search?q=testnew*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({players:[{id:29224,name:'testnew',team_id:22185}]})}));
 await page.locator('#player-search').fill('testnew');await page.locator('#search-results button').filter({has:page.locator('strong',{hasText:/^testnew$/})}).first().click();await page.waitForFunction(()=>document.getElementById('player-name').textContent==='Dragon');
 assert.equal(issueRequests,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,uncachedPlayer:'Dragon',series:data.matches.length,firstMs,fullMs,warmMs,issueRequests}));
 }finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
