'use strict';
const $ = id => document.getElementById(id);
const REPO = 'v4rs4q4ykk-svg/headshot-lab';
const historyCache = {};
let searchTimer, searchController, loadController;
const state = {index: [], catalog: [], player: null, matches: [], fixtures: [], fixture: null, pendingTimer: null, loadSerial: 0};
const storage = {get(k) {try {return JSON.parse(localStorage.getItem(k));} catch {return null;}}, set(k,v) {try {localStorage.setItem(k,JSON.stringify(v));} catch {}}, remove(k) {try {localStorage.removeItem(k);} catch {}}};
const lines = storage.get('cs2-lines-v1') || {};
const fmt = (n, digits=1) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—';
const pct = n => fmt(n * 100, 1) + '%';
const date = s => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'Date unavailable';
const when = s => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Time unavailable';
function el(tag, text, cls) {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e;}
function option(value,text) {const o=el('option',text);o.value=String(value);return o;}
function link(url,text,cls) {const a=el('a',text,cls);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function button(text, action, cls='secondary') {const b=el('button',text,cls);b.type='button';b.addEventListener('click',action);return b;}
function lineFor(pid) {const n=lines[pid];return typeof n==='number' && Number.isFinite(n) && n>=0 && n<=200 ? n : null;}
function currentLine() {return state.player ? lineFor(state.player.bo3_player_id) : null;}
async function json(path) {const r=await fetch('./'+path,{cache:'no-cache'});if(!r.ok){const e=Error(r.status===404?'No saved research yet':'Could not load data (HTTP '+r.status+')');e.status=r.status;throw e;}return r.json();}
function table(headers, rows) {const t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);const body=el('tbody');for(const row of rows){const r=el('tr');for(const v of row){const c=el('td');if(v instanceof Node)c.append(v);else c.textContent=String(v??'—');r.append(c);}body.append(r);}t.append(body);return t;}
function allPeople() {const people=new Map(state.index.map(p=>[p.id,{...p}]));for(const p of state.catalog)people.set(p.id,{...(people.get(p.id)||{}),...p});return [...people.values()];}
function renderSearch() {
  const root=$('search-results');root.replaceChildren();const query=$('player-search').value.trim().toLocaleLowerCase();if(!query)return;
  const matches=allPeople().filter(p=>p.name.toLocaleLowerCase().includes(query)).sort((a,b)=>Number(b.name.toLocaleLowerCase()===query)-Number(a.name.toLocaleLowerCase()===query)||(b.series||0)-(a.series||0)||a.name.localeCompare(b.name));
  for(const p of matches.slice(0,20)){
    const b=button('',()=>loadPlayer(p.id,p.name),'search-result'),left=el('div');left.append(el('strong',p.name),el('small',(p.team||('Source ID '+p.id))+(p.team_id?' · team '+p.team_id:'')));b.append(left,el('span',p.series?p.series+' series':'Load stats','pill'));root.append(b);
  }
  if(!matches.some(p=>p.name.toLocaleLowerCase()===query))root.append(button('Search the source for “'+$('player-search').value.trim()+'”',()=>sourceSearch($('player-search').value.trim(),true),'search-result'));
  if(matches.length>20)root.append(el('p','Showing 20 matches. Type more letters to narrow the search.','small muted'));
}
function renderCatalog() {
  $('catalog-status').textContent=state.catalog.length+' players with saved history · '+allPeople().length.toLocaleString()+' indexed names · other names are searched automatically';
  const quick=$('quick-players');quick.replaceChildren();
  state.catalog.slice().sort((a,b)=>Number(b.full_player_scan)-Number(a.full_player_scan)||b.series-a.series).slice(0,6).forEach(p=>quick.append(button(p.name+' · '+p.series,()=>loadPlayer(p.id,p.name),'chip')));
  renderBoard();
}
function renderBoard() {
  const sort=$('board-sort').value;
  const rows=state.catalog.map(p=>{const totals=p.recent_totals||[],xs=totals.slice(0,10),line=lineFor(p.id),eligible=totals.slice(0,20);return {...p,line,average:xs.length===10?CS2.avg(xs):null,rate:line!==null&&eligible.length>=10?eligible.filter(x=>x>line).length/eligible.length:null,rateN:eligible.length};});
  rows.sort((a,b)=>(sort==='average'?(b.average??-1)-(a.average??-1):sort==='over'?(b.rate??-1)-(a.rate??-1):b.series-a.series)||a.name.localeCompare(b.name));
  const rendered=rows.slice(0,40).map(p=>{
    const name=el('div');name.append(button(p.name,()=>loadPlayer(p.id,p.name),'board-name'),el('span',p.full_player_scan?'Player researched':'Partial match coverage','team-cell'));
    const input=el('input');input.type='number';input.min='0';input.max='200';input.step='.5';input.className='board-line';input.placeholder='Line';input.value=p.line??'';input.setAttribute('aria-label',p.name+' projection line');
    input.addEventListener('change',()=>{const n=Number(input.value);if(input.value.trim()&&Number.isFinite(n)&&n>=0&&n<=200)lines[p.id]=n;else delete lines[p.id];storage.set('cs2-lines-v1',lines);renderBoard();if(state.player?.bo3_player_id===p.id){$('projection').value=lineFor(p.id)??'';renderPlayerData();}});
    return [name,p.series,fmt(p.average),input,p.rate===null?'—':pct(p.rate)+' ('+p.rateN+')'];
  });
  $('board-table').replaceChildren(rendered.length?table(['Player','Series','L10 avg','Your line','Over rate (n)'],rendered):el('p','Saved players appear here after collection.','empty'));
}
function remember(data) {
  historyCache[data.bo3_player_id]=data;
  const ids=(storage.get('cs2-history-ids')||[]).filter(x=>x!==data.bo3_player_id);ids.unshift(data.bo3_player_id);
  ids.slice(20).forEach(id=>storage.remove('cs2-history-'+id));storage.set('cs2-history-ids',ids.slice(0,20));storage.set('cs2-history-'+data.bo3_player_id,data);
  const row={id:data.bo3_player_id,name:data.nickname,team:data.matches[0]?.team,team_id:data.player?.team_id,series:data.matches.length,full_player_scan:data.coverage?.full_player_scan,recent_totals:data.matches.slice(0,20).map(m=>m.headshots)};
  const i=state.catalog.findIndex(x=>x.id===row.id);if(i<0)state.catalog.push(row);else state.catalog[i]={...state.catalog[i],...row};renderCatalog();
}
function showPlayer(data,keepFilters=false) {
  const opponent=$('opponent-select').value,fixture=$('fixture-select').value;
  state.player=data;state.matches=CS2.records(data);
  $('player-view').hidden=false;$('player-name').textContent=data.nickname;$('player-team').textContent=state.matches[0]?.team||'CS2 player';
  $('player-meta').textContent='Source ID '+data.bo3_player_id+' · updated '+when(data.retrieved_at);
  $('projection').value=lineFor(data.bo3_player_id)??'';
  const params=new URLSearchParams(location.search);params.set('player',data.bo3_player_id);history.replaceState(null,'','?'+params.toString());
  setupFixtures();setupOpponents();setupScenario();
  if(keepFilters){if([...$('fixture-select').options].some(x=>x.value===fixture)){ $('fixture-select').value=fixture;state.fixture=state.fixtures.find(f=>String(f.id)===fixture)||null;}if([...$('opponent-select').options].some(x=>x.value===opponent))$('opponent-select').value=opponent;}
  else $('opponent-select').value='';
  renderPlayerData();
}
function loadNotice(message,failed=false){const p=$('request-panel');p.hidden=false;p.replaceChildren(el('p',message,failed?'notice':'small muted'));}
async function streamPage(id,offset,onItem,signal){
  const r=await fetch('./api/history?id='+id+'&offset='+offset,{signal});if(!r.ok){const e=await r.json().catch(()=>({}));throw Error(e.message||'Could not load stats.');}
  const reader=r.body.getReader(),decoder=new TextDecoder();let pending='',done;
  function accept(line){if(!line.trim())return;const item=JSON.parse(line);if(item.type==='error')throw Error(item.message);if(item.type==='done')done=item;onItem(item);}
  try{while(true){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});let n;while((n=pending.indexOf('\n'))>=0){accept(pending.slice(0,n));pending=pending.slice(n+1);}}pending+=decoder.decode();if(pending.trim())accept(pending);if(!done)throw Error('Stats connection was interrupted. Please retry.');return done;}finally{await reader.cancel().catch(()=>{});}
}
async function loadPlayer(id,name,force=false) {
  if(!Number.isSafeInteger(id)||id<=0)return;
  searchController?.abort();clearTimeout(searchTimer);loadController?.abort();loadController=new AbortController();const signal=loadController.signal,serial=++state.loadSerial;
  $('search-results').replaceChildren();$('player-search').value=name||'';$('player-view').hidden=true;
  loadNotice('Loading '+(name||'player')+'’s headshots…');
  let saved=historyCache[id]||storage.get('cs2-history-'+id);
  if(saved?.bo3_player_id!==id||!saved?.matches?.length)saved=null;
  if(!saved){try{const d=await json('data/player_histories/'+id+'.json');if(d.bo3_player_id===id&&CS2.records(d).length)saved=d;}catch{}}
  if(serial!==state.loadSerial)return;
  if(saved){showPlayer(saved);if(!force&&saved.coverage?.full_player_scan&&Date.now()-Date.parse(saved.retrieved_at)<15*60000){$('request-panel').hidden=true;refreshMetadata(saved,serial,signal);return;}}
  const data={schema_version:3,kind:'cs2_player_research',bo3_player_id:id,nickname:name||saved?.nickname||String(id),player:saved?.player||{id,name,team_id:null},retrieved_at:new Date().toISOString(),source:'BO3.gg public match and per-game player records',matches:[],upcoming:saved?.upcoming||[],team_profiles:saved?.team_profiles||{},coverage:{full_player_scan:false,excluded:[],candidates_checked:0,loading:true}};
  let offset=0,checked=0,metadataStarted=false;
  try{
    do{
      loadNotice((saved&&!data.matches.length?'Showing saved stats. Updating ':data.matches.length+' of 20 available series loaded. Loading ')+data.nickname+'…');
      const batch=await streamPage(id,offset,item=>{
        if(serial!==state.loadSerial||signal.aborted)return;
        if(item.record&&!data.matches.some(m=>m.id===item.record.id)){
          data.matches.push(item.record);data.matches.sort((a,b)=>b.played_at.localeCompare(a.played_at));data.player=item.player||data.player;data.nickname=item.player?.name||data.nickname;
          showPlayer(data,Boolean(state.player?.bo3_player_id===id));loadNotice(Math.min(20,data.matches.length)+' of 20 available series loaded. More stats are loading automatically…');
        }
      },signal);
      if(serial!==state.loadSerial)return;
      checked+=batch.checked;data.coverage.excluded.push(...batch.excluded);data.coverage.candidates_checked=checked;offset=batch.next_offset;
      if(!metadataStarted&&data.matches.length){metadataStarted=true;refreshMetadata(data,serial,signal);}
    }while(offset!==null&&data.matches.length<20);
    if(!data.matches.length)throw Error('The source has no completed Maps 1–2 headshot records for this player.');
    data.matches=data.matches.slice(0,20);data.coverage.full_player_scan=true;data.coverage.loading=false;data.coverage.available=data.matches.length;data.retrieved_at=new Date().toISOString();showPlayer(data,true);remember(data);$('request-panel').hidden=true;
  }catch(e){if(serial!==state.loadSerial||signal.aborted)return;data.coverage.loading=false;if(data.matches.length){showPlayer(data,true);remember(data);}loadNotice(e.message+(data.matches.length?' Loaded matches are shown below.':saved?' Your saved stats remain visible.':''),true);$('request-panel').append(button('Retry loading',()=>loadPlayer(id,name,true)));}
}
async function refreshMetadata(data,serial,signal){
  if(!data.matches.length)return;const latest=data.matches[0],tid=data.player?.team_id||latest.team_id;
  try{const r=await fetch('./api/matchup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({team_id:tid,recent:{team_id:latest.team_id,team:latest.team,opponent:latest.opponent}}),signal});if(!r.ok)return;const x=await r.json();if(serial!==state.loadSerial||signal.aborted)return;data.upcoming=x.upcoming||[];data.team_profiles=x.team_profiles||{};if(state.player===data){showPlayer(data,true);if(!data.coverage?.loading)remember(data);}}catch{}}
async function sourceSearch(query,selectExact=false){
  query=query.trim();if(!query||query.length>90)return;
  searchController?.abort();searchController=new AbortController();const signal=searchController.signal;
  const root=$('search-results'),status=el('p','Searching player records…','small muted');root.append(status);
  try{const r=await fetch('./api/search?q='+encodeURIComponent(query),{signal});const x=await r.json();if(!r.ok)throw Error(x.message||'Source search is unavailable.');if(signal.aborted||$('player-search').value.trim()!==query)return;
    for(const p of x.players||[]){const i=state.index.findIndex(y=>y.id===p.id);if(i<0)state.index.push(p);else state.index[i]={...state.index[i],...p};}
    const exact=(x.players||[]).filter(p=>p.name.toLowerCase()===query.toLowerCase());
    if(selectExact&&exact.length===1){loadPlayer(exact[0].id,exact[0].name);return;}renderSearch();
    if(!x.players?.length)root.append(el('p','No matching player was returned by the stats source. Check the spelling.','small muted'));
  }catch(e){if(!signal.aborted){status.textContent=e.message;}}
}
function searchChanged(){clearTimeout(searchTimer);searchController?.abort();renderSearch();const q=$('player-search').value.trim();if(q.length>=2)searchTimer=setTimeout(()=>sourceSearch(q),350);}
function setupFixtures() {
  const now=Date.now(),data=state.player;
  state.fixtures=(data.upcoming||[]).filter(f=>f.status==='current'||Date.parse(f.start_date)>now-2*3600000);
  const own=data.player?.team_id||state.matches[0]?.team_id, profiles=data.team_profiles||{};
  if(own){for(const profile of Object.values(profiles)){if(profile.team.id!==own&&!state.fixtures.some(f=>f.teams.some(t=>t.id===profile.team.id)))state.fixtures.push({id:'scenario-'+profile.team.id,bo_type:3,teams:[{id:own,name:state.matches[0].team},profile.team],hypothetical:true});}}
  const sel=$('fixture-select');sel.replaceChildren();
  for(const f of state.fixtures)sel.append(option(f.id,f.teams.map(t=>t.name).join(' vs ')+' · '+(f.hypothetical?'research scenario':when(f.start_date))));
  if(!state.fixtures.length)sel.append(option('','No upcoming fixture saved'));
  state.fixture=state.fixtures[0]||null;
}
function setupOpponents() {
  const seen=new Map();for(const m of state.matches)if(m.opponent?.id)seen.set(m.opponent.id,m.opponent.name);
  for(const f of state.fixtures)for(const t of f.teams)if(t.id!==state.player.player?.team_id)seen.set(t.id,t.name);
  const sel=$('opponent-select');sel.replaceChildren(option('','All opponents'));
  for(const [id,name] of [...seen].sort((a,b)=>a[1].localeCompare(b[1])))sel.append(option(id,name));
  syncOpponent();
}
function syncOpponent() {if(!state.fixture)return;const own=state.player.player?.team_id||state.matches[0]?.team_id;const other=state.fixture.teams.find(t=>t.id!==own);if(other)$('opponent-select').value=String(other.id);}
function setupScenario(){const maps=CS2.mapStats(state.matches);for(const [id,label] of [['scenario-one','Choose Map 1'],['scenario-two','Choose Map 2']]){$(id).replaceChildren(option('',label));maps.forEach(m=>$(id).append(option(m.map,CS2.mapName(m.map))));}}
function renderWindows() {
  const root=$('window-stats');root.replaceChildren();const line=currentLine();
  for(const w of CS2.windows(state.matches,line)){const box=el('div',undefined,'metric');box.append(el('div','Last '+w.window+' available','label'),el('div',w.complete?fmt(w.mean):'—','value'));const detail=el('div',undefined,'detail');detail.append(el('div',w.complete?'Average headshots':w.n+' of '+w.window+' series saved'));if(w.complete&&line!==null){detail.append(el('div',w.over+' over · '+w.under+' under · '+w.push+' push'),el('div',pct(w.over/w.n)+' over rate','green'));}box.append(detail);root.append(box);}
  const c=state.player.coverage||{},excluded=c.excluded?.length??state.player.excluded_checked??0;
  $('coverage-note').textContent=state.matches.length+' complete available series · '+date(state.matches.at(-1)?.played_at)+' – '+date(state.matches[0]?.played_at)+'. '+(c.full_player_scan===false?'Partial history. Additional records load automatically when the source is available.':excluded+' checked candidates lacked two complete maps or verified player statistics. Available series may skip matches.');
}
function renderForecast() {
  const root=$('forecast-output');root.replaceChildren();const f=state.fixture;
  if(!f){$('fixture-status').textContent='NO FIXTURE';$('fixture-summary').textContent='The team schedule and map history load automatically with the player.';root.append(el('p','No upcoming matchup is currently available from the source.','empty'));return;}
  $('fixture-status').textContent=f.hypothetical?'SCENARIO':f.status==='current'?'IN PROGRESS':'UPCOMING';
  $('fixture-summary').textContent=(f.hypothetical?'Hypothetical matchup against a recently faced team.':f.teams.map(t=>t.name).join(' vs ')+' · '+when(f.start_date))+(f.tournament?' · '+f.tournament:'');
  const prediction=CS2.forecast(f,state.player.team_profiles);
  if(!prediction.available){root.append(el('p',prediction.reason,'empty'));if(prediction.samples)root.append(el('p','Complete veto samples: '+prediction.samples.join(' / '),'small muted'));return;}
  const grid=el('div',undefined,'forecast-grid'),pick=prediction.pairs[0],card=el('div',undefined,'forecast-card');
  card.append(el('div',prediction.confirmed?'SOURCE-CONFIRMED MAPS':'MOST LIKELY ORDERED PAIR','eyebrow'),el('div',CS2.mapName(pick.map1)+' + '+CS2.mapName(pick.map2),'value'),el('p',prediction.confirmed?'Map 1 and Map 2 as currently recorded.':pct(pick.probability)+' model estimate for this exact ordered pair','small muted'));
  grid.append(card);
  const relevantProfiles=Object.fromEntries(f.teams.map(t=>[t.id,state.player.team_profiles?.[t.id]]).filter(x=>x[1]));
  const effect=CS2.mapEffect(state.matches,prediction,relevantProfiles);
  if(effect){const c=el('div',undefined,'forecast-card');c.append(el('div','MAP-WEIGHTED HS BASELINE','eyebrow'),el('div',fmt(effect.baseline)+' HS','value'),el('p','Overall saved-series average: '+fmt(effect.overall)+' HS','small muted'),el('p','Model estimate using past HS/round and typical map length.','small muted'));if(effect.fallbackMass>0)c.append(el('p',pct(effect.fallbackMass)+' of map weight uses the player’s overall rate because map history is missing.','small muted'));grid.append(c);}
  root.append(grid);
  if(!prediction.confirmed)root.append(el('p',prediction.samples.join(' / ')+' complete vetoes · pool inferred from recent matches · acting order unconfirmed','notice'));
  const mapRows=prediction.maps.map(m=>{const chance=el('div',pct(m.inclusion));const bar=el('div',undefined,'model-bar'),fill=el('span');fill.style.width=pct(m.inclusion);bar.append(fill);chance.append(bar);const sample=CS2.mapStats(state.matches).find(x=>x.map===m.map);return [CS2.mapName(m.map),chance,pct(m.map1),pct(m.map2),sample?sample.n+' maps · '+fmt(sample.average)+' HS':'No player sample'];});
  const wrap=el('div',undefined,'table-wrap');wrap.append(table(['Map','In maps 1–2','Map 1','Map 2','Player history'],mapRows));root.append(wrap);
}
function selection() {const opponent=Number($('opponent-select').value),days=Number($('date-range').value);return state.matches.filter(m=>(!opponent||m.opponent?.id===opponent)&&(!days||Date.parse(m.played_at)>=Date.now()-days*86400000));}
function drawChart(matches,line) {
  const root=$('history-chart');root.replaceChildren();if(!matches.length)return;
  const xs=matches.slice(0,20).reverse(),width=850,height=215,pad=30,max=Math.max(1,...xs.map(m=>m.headshots),line??0),step=(width-2*pad)/xs.length;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('role','img');svg.setAttribute('aria-label','Headshots across '+xs.length+' saved series, oldest to newest');
  function shape(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;}
  const y=v=>height-35-v/max*(height-65);
  xs.forEach((m,i)=>{const color=line===null?'#739bfa':m.headshots>line?'#a6f35f':m.headshots<line?'#ef8e8e':'#f3c66e';const r=shape('rect',{x:pad+i*step+3,y:y(m.headshots),width:Math.max(1,step-6),height:height-35-y(m.headshots),fill:color,rx:3});const title=document.createElementNS(ns,'title');title.textContent=date(m.played_at)+' vs '+(m.opponent?.name||'unknown opponent')+': '+m.headshots+' HS';r.append(title);shape('text',{x:pad+(i+.5)*step,y:y(m.headshots)-6,'text-anchor':'middle',fill:'#cdd8df','font-size':11},m.headshots);});
  if(line!==null){shape('line',{x1:pad,x2:width-pad,y1:y(line),y2:y(line),stroke:'#f3c66e','stroke-width':2,'stroke-dasharray':'5 4'});shape('text',{x:width-pad,y:Math.max(13,y(line)-6),'text-anchor':'end',fill:'#f3c66e','font-size':11},'Line '+line);}
  shape('text',{x:pad,y:height-8,fill:'#98a9b2','font-size':11},date(xs[0].played_at));shape('text',{x:width-pad,y:height-8,'text-anchor':'end',fill:'#98a9b2','font-size':11},date(xs.at(-1).played_at));root.append(svg);
}
function renderHistory() {
  const selected=selection(),line=currentLine(),s=CS2.summarize(selected,line),opponent=$('opponent-select').selectedOptions[0]?.textContent;
  $('opponent-summary').replaceChildren(el('p',selected.length?s.n+' saved series'+(opponent!=='All opponents'?' vs '+opponent:'')+' · '+fmt(s.mean)+' HS average · range '+s.low+'–'+s.high+(line!==null?' · '+s.over+' over / '+s.under+' under / '+s.push+' push':''):'No saved meetings in this selection.','notice'));
  drawChart(selected,line);
  const maps=CS2.mapStats(selected);$('map-table').replaceChildren(maps.length?table(['Map','Maps','Avg HS','HS/round','Avg rounds'],maps.map(m=>[CS2.mapName(m.map),m.n,fmt(m.average),fmt(m.hsPerRound,3),fmt(m.averageRounds)])):el('p','No map records in this selection.','empty'));
  const historyRows=selected.map(m=>{const match=el('div');const source=m.slug&&/^[a-zA-Z0-9_-]+$/.test(m.slug)?link('https://bo3.gg/matches/'+m.slug,date(m.played_at)+' ↗'):el('span',date(m.played_at));match.append(source,el('span',m.team+' vs '+(m.opponent?.name||'Unknown'),'team-cell'));const total=el('span',m.headshots,'num '+(line===null?'':m.headshots>line?'positive':m.headshots<line?'negative':'push'));return [match,CS2.mapName(m.maps?.[0]?.name||'Map 1')+' · '+m.map1,CS2.mapName(m.maps?.[1]?.name||'Map 2')+' · '+m.map2,total];});
  $('history-table').replaceChildren(historyRows.length?table(['Match','Map 1','Map 2','HS'],historyRows):el('p','No saved matches for this filter.','empty'));
}
function renderScenario() {const a=$('scenario-one').value,b=$('scenario-two').value,root=$('scenario-output');if(!a||!b||a===b){root.textContent='Select two different maps. This uses separate historical map averages; the selection is your scenario.';return;}const stats=CS2.mapStats(state.matches),one=stats.find(x=>x.map===a),two=stats.find(x=>x.map===b);root.textContent=fmt(one.average+two.average)+' combined historical HS · '+CS2.mapName(a)+' n='+one.n+' / '+CS2.mapName(b)+' n='+two.n+'. The opponent and future round count can change the outcome.';}
function renderPlayerData(){if(!state.player)return;renderWindows();renderForecast();renderHistory();renderScenario();}
$('player-search').addEventListener('input',searchChanged);
$('player-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(searchTimer);const q=$('player-search').value.trim(),exact=allPeople().filter(p=>p.name.toLowerCase()===q.toLowerCase());if(exact.length===1)loadPlayer(exact[0].id,exact[0].name);else sourceSearch(q,true);}});
$('projection').addEventListener('input',()=>{if(!state.player)return;const n=Number($('projection').value);if($('projection').value.trim()&&Number.isFinite(n)&&n>=0&&n<=200)lines[state.player.bo3_player_id]=n;else delete lines[state.player.bo3_player_id];storage.set('cs2-lines-v1',lines);renderPlayerData();renderBoard();});
$('clear-line').addEventListener('click',()=>{if(!state.player)return;delete lines[state.player.bo3_player_id];$('projection').value='';storage.set('cs2-lines-v1',lines);renderPlayerData();renderBoard();});
$('refresh-player').addEventListener('click',()=>state.player&&loadPlayer(state.player.bo3_player_id,state.player.nickname,true));
$('fixture-select').addEventListener('change',()=>{state.fixture=state.fixtures.find(f=>String(f.id)===$('fixture-select').value)||null;syncOpponent();renderForecast();renderHistory();});
$('opponent-select').addEventListener('change',renderHistory);$('date-range').addEventListener('change',renderHistory);
$('scenario-one').addEventListener('change',renderScenario);$('scenario-two').addEventListener('change',renderScenario);$('board-sort').addEventListener('change',renderBoard);
(async()=>{
  const results=await Promise.allSettled([json('data/bo3_players.json'),json('data/research_catalog.json')]);
  if(results[0].status==='fulfilled')state.index=(results[0].value.players||[]).filter(p=>Number.isSafeInteger(p.id)&&p.id>0&&typeof p.name==='string');
  if(results[1].status==='fulfilled')state.catalog=results[1].value.players||[];
  renderCatalog();
  if(!state.index.length&&!state.catalog.length)$('catalog-status').textContent='Type a nickname to search the stats source directly.';
  storage.remove('cs2-pending');
  {const id=Number(new URLSearchParams(location.search).get('player'));const person=allPeople().find(p=>p.id===id);if(person)loadPlayer(id,person.name);}
})();
