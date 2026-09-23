/* Pure research calculations, shared by browser and node verification. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CS2 = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const mapName = s => String(s || '').replace(/^de_/, '').replace(/^./, c => c.toUpperCase());
  function records(data) {
    const seen = new Set();
    return (data.matches || []).filter(m => {
      if (!Number.isSafeInteger(m.id) || seen.has(m.id) || !Number.isFinite(Date.parse(m.played_at))) return false;
      if (![m.map1, m.map2].every(x => Number.isSafeInteger(x) && x >= 0 && x <= 200) || m.headshots !== m.map1 + m.map2) return false;
      seen.add(m.id); return true;
    }).sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at));
  }
  function summarize(matches, line) {
    const values = matches.map(m => m.headshots);
    return {n: values.length, mean: avg(values), low: values.length ? Math.min(...values) : null,
      high: values.length ? Math.max(...values) : null,
      over: finite(line) ? values.filter(v => v > line).length : null,
      under: finite(line) ? values.filter(v => v < line).length : null,
      push: finite(line) ? values.filter(v => v === line).length : null};
  }
  function windows(matches, line) {
    return [10, 15, 20].map(n => ({window: n, complete: matches.length >= n, ...summarize(matches.slice(0, n), line)}));
  }
  function mapStats(matches) {
    const result = new Map();
    for (const match of matches) {
      for (let i = 0; i < 2; i++) {
        const m = match.maps?.[i];
        if (!m || typeof m.name !== 'string' || !Number.isSafeInteger(m.rounds) || m.rounds <= 0) continue;
        if (!result.has(m.name)) result.set(m.name, {map: m.name, n: 0, hs: 0, rounds: 0, totals: []});
        const row = result.get(m.name); row.n++; row.hs += match['map' + (i + 1)]; row.rounds += m.rounds;
        row.totals.push(match['map' + (i + 1)]);
      }
    }
    return [...result.values()].map(m => ({...m, average: m.hs / m.n, hsPerRound: m.hs / m.rounds, averageRounds: m.rounds / m.n})).sort((a, b) => b.n - a.n || a.map.localeCompare(b.map));
  }
  function validVeto(v) {
    return Array.isArray(v) && v.length === 7 && new Set(v.map(x => x.map)).size === 7 &&
      v.every((x, i) => x.order === i + 1 && typeof x.map === 'string' && x.map.startsWith('de_')) &&
      v.map(x => x.action).join(',') === 'ban,ban,pick,pick,ban,ban,decider' &&
      Number.isSafeInteger(v[0].team_id) && Number.isSafeInteger(v[1].team_id) && v[0].team_id !== v[1].team_id &&
      v.slice(0, 6).every((x, i) => x.team_id === v[i % 2].team_id);
  }
  const samePool = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  function profileRows(profile, asOf) {
    const seen = new Set();
    return (profile?.matches || []).filter(m => {
      const when = Date.parse(m.played_at), age = (asOf - when) / 86400000;
      if (!Number.isFinite(when) || age < 0 || age > 180 || !validVeto(m.veto) || seen.has(m.id)) return false;
      seen.add(m.id); return true;
    }).sort((a, b) => Date.parse(b.played_at) - Date.parse(a.played_at));
  }
  function forecast(fixture, profiles, asOf = Date.now()) {
    if (!fixture || fixture.bo_type !== 3) return {available: false, reason: 'Map estimates require a BO3 matchup.'};
    const confirmed = fixture.confirmed_maps;
    if (Array.isArray(confirmed) && confirmed.length === 2 && confirmed.every(x => typeof x === 'string' && x.startsWith('de_')) && confirmed[0] !== confirmed[1]) {
      return {available: true, confirmed: true, maps: confirmed.map((map, i) => ({map, map1: i === 0 ? 1 : 0, map2: i === 1 ? 1 : 0, inclusion: 1})),
        pairs: [{map1: confirmed[0], map2: confirmed[1], probability: 1}], samples: [], pool: confirmed};
    }
    if (!Array.isArray(fixture.teams) || fixture.teams.length !== 2) return {available: false, reason: 'Both team identities are needed.'};
    const ids = fixture.teams.map(t => t.id), histories = ids.map(id => profileRows(profiles?.[id], asOf).filter(m => m.veto.slice(0, 2).some(x => x.team_id === id)));
    if (histories.some(h => !h.length)) return {available: false, reason: 'Recent complete pick/ban history is unavailable for one of these teams.'};
    const pools = histories.map(h => h[0].veto.map(x => x.map));
    if (!samePool(...pools)) return {available: false, reason: 'The teams’ latest vetoes used different map pools. Wait for confirmed maps.'};
    if (histories.some(h => asOf - Date.parse(h[0].played_at) > 30 * 86400000)) return {available: false, reason: 'The latest complete veto is over 30 days old; a current map pool cannot be inferred.'};
    const pool = [...pools[0]].sort();
    const sets = histories.map(h => h.filter(m => samePool(m.veto.map(x => x.map), pool)));
    if (sets.some(h => h.length < 5)) return {available: false, reason: 'At least five recent complete vetoes per team in the same pool are needed.', samples: sets.map(x => x.length)};
    const weights = sets.map((h, index) => {
      const result = {ban: {}, pick: {}};
      for (const m of h) {
        const weight = 2 ** (-(asOf - Date.parse(m.played_at)) / (60 * 86400000));
        for (const action of ['ban', 'pick']) {
          const first = m.veto.find(x => x.team_id === ids[index] && x.action === action);
          if (first) result[action][first.map] = (result[action][first.map] || 0) + weight;
        }
      }
      return result;
    });
    const pairs = new Map();
    function walk(order, step, available, picks, prob) {
      if (step === 4) {
        const key = picks.join('|'); pairs.set(key, (pairs.get(key) || 0) + prob); return;
      }
      const action = step < 2 ? 'ban' : 'pick', who = order[step % 2];
      const scores = available.map(map => (weights[who][action][map] || 0) + 0.5);
      const total = scores.reduce((a, b) => a + b, 0);
      available.forEach((map, i) => walk(order, step + 1, available.filter(x => x !== map), action === 'pick' ? [...picks, map] : picks, prob * scores[i] / total));
    }
    walk([0, 1], 0, pool, [], 0.5); walk([1, 0], 0, pool, [], 0.5);
    const distribution = [...pairs].map(([key, probability]) => ({map1: key.split('|')[0], map2: key.split('|')[1], probability})).sort((a, b) => b.probability - a.probability);
    const maps = pool.map(map => {
      const map1 = distribution.filter(x => x.map1 === map).reduce((s, x) => s + x.probability, 0);
      const map2 = distribution.filter(x => x.map2 === map).reduce((s, x) => s + x.probability, 0);
      return {map, map1, map2, inclusion: map1 + map2};
    }).sort((a, b) => b.inclusion - a.inclusion);
    return {available: true, confirmed: false, maps, pairs: distribution, samples: sets.map(x => x.length), pool,
      latest: histories.map(h => h[0].played_at), tendencies: weights, model: 'Empirical BO3 veto v1; 60-day half-life; 0.5 smoothing; equal acting-order prior.'};
  }
  function mapEffect(matches, prediction, profiles = {}) {
    const stats = mapStats(matches), rounds = stats.reduce((s, m) => s + m.rounds, 0), hs = stats.reduce((s, m) => s + m.hs, 0);
    const n = stats.reduce((s, m) => s + m.n, 0);
    if (!prediction?.available || n < 10 || !rounds) return null;
    const overallRate = hs / rounds, typicalRounds = rounds / n;
    let total = 0, fallbackMass = 0;
    const pieces = prediction.maps.map(p => {
      const s = stats.find(x => x.map === p.map), sample = s?.n || 0;
      // Shrink five map-equivalents toward the player's overall rate.
      const rate = ((s?.hs || 0) + overallRate * 5 * typicalRounds) / ((s?.rounds || 0) + 5 * typicalRounds);
      const teamRounds = [];
      const seenGames = new Set();
      for (const profile of Object.values(profiles)) {
        for (const m of profile.matches || []) {
          for (const game of m.maps || []) {
            const key = m.id + ':' + game.name;
            if (game.name === p.map && Number.isSafeInteger(game.rounds) && game.rounds > 0 && !seenGames.has(key)) {
              seenGames.add(key); teamRounds.push(game.rounds);
            }
          }
        }
      }
      const length = teamRounds.length >= 5 ? avg(teamRounds) : (s?.averageRounds || typicalRounds);
      total += p.inclusion * rate * length;
      if (!sample) fallbackMass += p.inclusion / 2;
      return {map: p.map, sample, rate, rounds: length, hs: rate * length, inclusion: p.inclusion};
    });
    return {baseline: total, overall: summarize(matches).mean, pieces, fallbackMass};
  }
  return {avg, mapName, records, summarize, windows, mapStats, validVeto, forecast, mapEffect};
});
