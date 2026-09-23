const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=spawn('python3',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
const chelo=JSON.parse(fs.readFileSync(path.join(root,'data/player_histories/17729.json')));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/research_catalog.json')));
(async()=>{
 let browser;
 try{
  for(let n=0;n<40;n++){try{await fetch('http://127.0.0.1:8765');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  browser=await chromium.launch({headless:true,...(process.env.CS2_CHROME_BIN?{executablePath:process.env.CS2_CHROME_BIN}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765');
  await page.locator('#quick-players button').first().waitFor();
  await page.locator('#player-search').fill('chelo');
  await page.locator('#search-results button').filter({has:page.locator('strong',{hasText:/^chelo$/})}).first().click();
  await page.waitForFunction(()=>document.getElementById('player-name').textContent==='chelo'&&!document.getElementById('player-view').hidden);
  const expected=(chelo.matches.slice(0,10).reduce((s,m)=>s+m.headshots,0)/10).toFixed(1);
  assert.equal(await page.locator('#window-stats .value').first().textContent(),expected);
  const line=chelo.matches[0].headshots;
  await page.locator('#projection').fill(String(line));
  assert.ok((await page.locator('#window-stats').textContent()).includes('push'));
  const opponent=chelo.matches[0].opponent.id;
  await page.locator('#opponent-select').selectOption(String(opponent));
  assert.equal(await page.locator('#history-table tbody tr').count(),chelo.matches.filter(m=>m.opponent?.id===opponent).length);
  const scenarioOptions=await page.locator('#fixture-select option').evaluateAll(xs=>xs.filter(x=>x.value.startsWith('scenario-')).map(x=>x.value));
  if(scenarioOptions.length){await page.locator('#fixture-select').selectOption(scenarioOptions[0]);assert.ok((await page.locator('#forecast-output').textContent()).trim().length>0);}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile page overflows horizontally');
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.screenshot({path:path.join(root,'test-results/mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(root,'test-results/desktop.png'),fullPage:true});
  // Exercise a missing-name request and its automatic result, without posting to GitHub.
  await page.context().route('https://github.com/**/issues/new?**',r=>r.fulfill({status:200,body:'Mock request submitted'}));
  await page.context().route('https://raw.githubusercontent.com/**/data/requests/*.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({status:'ready',player_id:17729,player_name:'chelo'})}));
  await page.context().route('https://raw.githubusercontent.com/**/data/player_histories/17729.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(chelo)}));
  await page.context().route('https://raw.githubusercontent.com/**/data/research_catalog.json?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(catalog)}));
  await page.locator('#player-search').fill('test_missing_nickname_771');
  await page.locator('#search-results button').last().click();
  const href=await page.locator('#request-panel a.primary').getAttribute('href');
  assert.ok(href.includes('Request%20ID'));assert.ok(decodeURIComponent(href).includes('Nickname: test_missing_nickname_771'));
  await page.locator('#request-panel a.primary').click();
  await page.waitForFunction(()=>document.getElementById('request-panel').hidden);
  assert.equal(await page.locator('#player-name').textContent(),'chelo');
  assert.deepEqual(errors,[]);
  console.log('PASS: player lookup, line comparison, opponent filtering, map section, mobile/desktop layout, and automatic request result.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
