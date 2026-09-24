/* An explainable screening rule, not a calibrated betting probability. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./analysis.js'));else root.Wildcards=factory(root.CS2);})(globalThis,function(C){
 const day=86400000,normal=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),f=x=>Number.isFinite(x)?x.toFixed(1):'—';
 function evaluate(offer,data,metadata,now=Date.now()){
  const checks=[],add=(key,title,status,reason)=>checks.push({key,title,status,reason});
  const line=offer.line,valid=Number.isFinite(line)&&line>=0&&Date.parse(offer.starts_at)>now;
  const matches=data?.bo3_player_id===offer.bo3_player_id?C.records(data).filter(m=>Date.parse(m.played_at)<=now):[],ten=matches.slice(0,10),s=C.summarize(ten,line),five=C.summarize(ten.slice(0,5),line),sorted=ten.map(m=>m.headshots).sort((a,b)=>a-b),median=ten.length===10?(sorted[4]+sorted[5])/2:null;
  const fresh=now-Date.parse(data?.retrieved_at),recent=ten.length===10&&now-Date.parse(ten[0].played_at)<=14*day&&now-Date.parse(ten[9].played_at)<=90*day;
  add('coverage','Current, complete history',valid&&data?.coverage?.full_player_scan&&fresh>=0&&fresh<=day&&recent?'support':'missing',!valid?'Current line is unavailable or the match has started.':`${ten.length}/10 verified series. Requires a full scan checked within 24 hours, a match within 14 days, and all ten within 90 days.`);
  const candidate=valid&&ten.length===10&&s.over>=7&&s.mean>line;
  add('form','Last 10 series',ten.length<10?'missing':candidate?'support':'against',`${s.over??0}/${ten.length} above ${line}; average ${f(s.mean)} HS (${f((s.mean??0)-line)} vs line), ${s.push??0} pushes. Requires at least 7/10 overs and an average above the line.`);
  add('consistency','Typical result & last five',ten.length<10?'missing':median>line&&five.mean>line?'support':'against',`Median ${f(median)} HS; last-five average ${f(five.mean)} HS, ${five.over??0}/${five.n} overs. Both averages must stay above ${line}; a few large games alone are not enough.`);
  const n=matches.length>=20?20:15,long=C.summarize(matches.slice(0,n),line);
  add('longer','Longer history',long.n<n?'missing':long.mean>line&&long.over/n>=.6?'support':'against',`${long.over??0}/${long.n} overs; ${f(long.mean)} HS average. Requires at least 15 series, 60% overs and an average above the line; uses 20 when available.`);
  const own=data?.player?.team_id||matches[0]?.team_id,metaAge=now-Date.parse(metadata?.retrieved_at);
  const fixtures=(metadata?.upcoming||[]).filter(x=>!x.hypothetical&&x.status==='upcoming'&&x.bo_type===3&&Math.abs(Date.parse(x.start_date)-Date.parse(offer.starts_at))<=3*3600000&&x.teams?.length===2&&x.teams.some(t=>t.id===own&&normal(t.name)===normal(offer.team))&&x.teams.some(t=>t.id!==own&&normal(t.name)===normal(offer.opponent)));
  const fixture=fixtures.length===1&&metaAge>=0&&metaAge<=15*60000?fixtures[0]:null,opponent=fixture?.teams.find(t=>t.id!==own);
  add('fixture','Correct upcoming matchup',fixture?'support':'missing',fixture?`${offer.team} vs ${opponent.name}; both source team identities and start time match the current offer. BO3 fixture verified.`:'Awaiting one verified BO3 fixture matching both team names and the offer start time. Scenarios, live matches and stale schedule data cannot qualify.');
  const h2h=opponent?matches.filter(m=>m.opponent?.id===opponent.id&&m.team_id===own&&now-Date.parse(m.played_at)<=180*day):[],h=C.summarize(h2h,line);
  add('opponent','Against this opponent',h.n<3?'missing':h.mean>line&&h.over/h.n>=2/3?'support':'against',opponent?`${h.over??0}/${h.n} overs vs ${opponent.name}, ${f(h.mean)} HS average, ${h.push??0} pushes. Requires three meetings on the current team within 180 days, at least two-thirds overs and an average above ${line}. Only meetings in the saved history are counted.`:'Opponent-specific evidence is unavailable until the exact matchup is verified.');
  const profiles=fixture?Object.fromEntries(fixture.teams.map(t=>[t.id,metadata.team_profiles?.[t.id]]).filter(x=>x[1])):{},prediction=fixture?C.forecast(fixture,profiles,now):null;
  const effect=prediction?.available?C.mapEffect(matches,prediction,profiles):null;
  const coverage=effect?effect.pieces.filter(p=>p.sample>=3).reduce((n,p)=>n+p.inclusion/2,0):0,top=effect?[...effect.pieces].sort((a,b)=>b.inclusion-a.inclusion).slice(0,2):[];
  const mapReady=effect&&coverage>=.8&&top.length===2&&top.every(p=>p.sample>=3),margin=effect?effect.baseline-line:null;
  add('maps','Map choices & headshot baseline',!mapReady?'missing':margin>=Math.max(1,line*.1)?'support':'against',!prediction?.available?(prediction?.reason||'Map assessment waits for the verified fixture.'):!mapReady?`Only ${f(coverage*100)}% of map weight has three or more player samples. Requires 80% coverage and three samples on each of the two most likely maps.`:`${prediction.confirmed?'Confirmed maps':'Estimated veto'}: ${top.map(p=>C.mapName(p.map)).join(' + ')}. Map-weighted baseline ${f(effect.baseline)} HS (${f(margin)} vs line). Requires at least ${f(Math.max(1,line*.1))} HS above the line. ${prediction.confirmed?'':'Veto samples: '+prediction.samples.join(' / ')+'. ' }This baseline is an estimate, not an over probability.`);
  add('team','Recent team continuity',!fixture||five.n<5?'missing':ten.slice(0,5).every(m=>m.team_id===own)?'support':'against','Checks that the last five series were played on the team in this offer. Individual role changes, substitutions and the other four roster slots are not verified.');
  return {offer,checks,candidate,qualified:checks.every(x=>x.status==='support'),support:checks.filter(x=>x.status==='support').length,summary:s,median,five,long,h2h:h,matches:ten,prediction,effect,fixture,margin};
 }
 function compare(a,b){return Number(b.qualified)-Number(a.qualified)||b.support-a.support||(b.summary.over/b.summary.n||0)-(a.summary.over/a.summary.n||0)||(b.margin??-Infinity)-(a.margin??-Infinity)||a.offer.name.localeCompare(b.offer.name);}
 return {evaluate,compare};
});
