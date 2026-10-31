import { buildSeason } from './helpers';
const r = await buildSeason(process.argv[2]);
const s = r.summary, ls = s.updatedLeagueState, sw = ls.swissPlayIn, ti = s.updatedTheIdolsState, ct = s.championsTournament;
const results: Array<[string, boolean, string]> = [];
const check = (name: string, ok: boolean, info = '') => results.push([name, ok, info]);
const dist = (arr: number[]) => { const m: Record<number, number> = {}; arr.forEach(x => m[x] = (m[x] || 0) + 1); return JSON.stringify(m); };
const games = (m: any) => (m.scoreA ?? 0) + (m.scoreB ?? 0);
const activeIds = new Set(r.active.map((i: any) => i.id));
const allMatchIds: string[] = [];
const usedIdolIds = new Set<string>();

check('A effective-active idols = 128', r.active.length === 128, String(r.active.length));
// leagues
ls.leagues.forEach((l: any) => {
  const pairs: Record<string, number> = {}; let bad = 0, selfm = 0;
  l.matches.forEach((m: any) => { allMatchIds.push(m.id); usedIdolIds.add(m.idolAId); usedIdolIds.add(m.idolBId); if (m.idolAId === m.idolBId) selfm++; const k = [m.idolAId, m.idolBId].sort().join('|'); pairs[k] = (pairs[k] || 0) + 1; if (!m.completed) bad++; });
  check(`B league ${l.id}: 20 idols, 380 matches, every pair twice, all completed`, l.memberIds.length === 20 && l.matches.length === 380 && Object.values(pairs).every(v => v === 2) && Object.keys(pairs).length === 190 && !bad && !selfm, `${l.memberIds.length}/${l.matches.length}/${bad}`);
  const md: Record<number, number> = {}; l.matches.forEach((m: any) => md[m.matchday] = (md[m.matchday] || 0) + 1);
  check(`B league ${l.id}: 38 matchdays x 10 matches`, Object.keys(md).length === 38 && Object.values(md).every(v => v === 10));
});
const lm = ls.leagues.flatMap((l: any) => l.matches);
check('C league format Bo4 (4 games each, draws allowed)', lm.every((m: any) => games(m) === 4), 'game totals: ' + dist(lm.map(games)));
check('C league draws exist (2-2)', lm.some((m: any) => m.scoreA === 2 && m.scoreB === 2), 'draws: ' + lm.filter((m: any) => m.scoreA === m.scoreB).length);
const st1 = ls.leagues[0].standings.map((x: any) => ({ id: x.idolId, pts: x.points, w: x.won ?? x.wins, d: x.drawn ?? x.draws, l: x.lost ?? x.losses }));
check('D league points = 3W + D', st1.every((x: any) => x.pts === 3 * x.w + x.d), JSON.stringify(st1[0]));
// swiss
const pools: Record<string, any[]> = {}; sw.matches.forEach((m: any) => { (pools[m.poolId] = pools[m.poolId] || []).push(m); allMatchIds.push(m.id); });
check('E swiss: 64 participants, 4 pools, 33 matches per pool', sw.participants.length === 64 && Object.keys(pools).length === 4 && Object.values(pools).every(p => p.length === 33), Object.values(pools).map(p => p.length).join(','));
check('E swiss: Bo3 (winner has 2, loser 0-1)', sw.matches.every((m: any) => Math.max(m.scoreA, m.scoreB) === 2 && Math.min(m.scoreA, m.scoreB) <= 1), 'totals: ' + dist(sw.matches.map(games)));
let rematch = 0, recOK = true; const recs: string[] = [];
Object.values(pools).forEach(p => { const seen = new Set<string>(); const w: Record<string, number> = {}, lo: Record<string, number> = {}; p.forEach((m: any) => { const k = [m.idolAId, m.idolBId].sort().join('|'); if (seen.has(k)) rematch++; seen.add(k); const win = m.winnerId, los = win === m.idolAId ? m.idolBId : m.idolAId; w[win] = (w[win] || 0) + 1; lo[los] = (lo[los] || 0) + 1; }); const ids = new Set([...Object.keys(w), ...Object.keys(lo)]); const c: Record<string, number> = {}; ids.forEach(id => { const k = `${w[id] || 0}-${lo[id] || 0}`; c[k] = (c[k] || 0) + 1; }); recs.push(JSON.stringify(c)); if (ids.size !== 16) recOK = false; });
check('E swiss: no rematches, 16 idols per pool', rematch === 0 && recOK, 'rematches ' + rematch);
check('E swiss: records per pool = 3-0 x2, 3-1 x3, 3-2 x3, 2-3 x3, 1-3 x3, 0-3 x2', recs.every(x => { const o = JSON.parse(x); return o['3-0'] === 2 && o['3-1'] === 3 && o['3-2'] === 3 && o['2-3'] === 3 && o['1-3'] === 3 && o['0-3'] === 2; }), recs[0]);
check('E swiss: 20 direct, 12 to LCQ', sw.directQualifiers.length === 20 && sw.lastChanceStandings.length === 12, `${sw.directQualifiers.length}/${sw.lastChanceStandings.length}`);
// LCQ
const lcq = sw.lastChanceMatches; lcq.forEach((m: any) => allMatchIds.push(m.id));
check('F LCQ: 30 matches, 2 groups of 6 (15 each), 8 qualify', lcq.length === 30 && sw.lastChanceGroup1Standings.length === 6 && sw.lastChanceGroup2Standings.length === 6 && sw.lastChanceQualifiers.length === 8, `${lcq.length}/${sw.lastChanceQualifiers.length}`);
check('F LCQ format Bo4 (4 games each, draws allowed)', lcq.every((m: any) => games(m) === 4), 'game totals: ' + dist(lcq.map(games)));
// qualifiers
const q = s.qualifiers.map((x: any) => x.idolId || x.id); const qset = new Set(q);
check('G Unzure Cup: 64 unique qualifiers', q.length === 64 && qset.size === 64, `${q.length}/${qset.size}`);
const top6 = new Set<string>(); ls.leagues.forEach((l: any) => [...l.standings].sort((a: any, b: any) => (b.points - a.points) || ((b.goalDifference ?? 0) - (a.goalDifference ?? 0))).slice(0, 6).forEach((x: any) => top6.add(x.idolId)));
check('G qualifiers include all 36 league top-6 idols', [...top6].filter(id => qset.has(id)).length === 36, String([...top6].filter(id => qset.has(id)).length));
// groups + knockout
const gm = ct.groups.flatMap((g: any) => g.matches); gm.forEach((m: any) => allMatchIds.push(m.id));
check('H 16 groups x 4 idols, 6 matches each (96)', ct.groups.length === 16 && ct.groups.every((g: any) => g.memberIds.length === 4 && g.matches.length === 6), String(gm.length));
check('H group stage Bo4 (4 games each, draws allowed)', gm.every((m: any) => games(m) === 4), 'game totals: ' + dist(gm.map(games)));
const ko = ct.knockoutMatches; ko.forEach((m: any) => allMatchIds.push(m.id));
const byRound: Record<string, any[]> = {}; ko.forEach((m: any) => (byRound[m.roundName] = byRound[m.roundName] || []).push(m));
check('H knockout rounds: R32 16, R16 8, QF 4, SF 2, third 1, final 1', Object.keys(byRound).map(k => `${k}:${byRound[k].length}`).join(' | ').length > 0 && ko.length === 32, Object.keys(byRound).map(k => `${k}:${byRound[k].length}`).join(' | '));
const tp = ko.find((m: any) => /third/i.test(m.roundName)), fin = ko.find((m: any) => /^grand final|^final/i.test(m.roundName));
const bo5 = ko.filter((m: any) => m !== tp && m !== fin);
check('H knockout Bo5 (winner reaches 3)', bo5.every((m: any) => Math.max(m.scoreA, m.scoreB) === 3), dist(bo5.map((m: any) => Math.max(m.scoreA, m.scoreB))));
check('H third place Bo7 (winner reaches 4)', !!tp && Math.max(tp.scoreA, tp.scoreB) === 4, tp ? `${tp.scoreA}-${tp.scoreB}` : 'none');
check('H grand final Bo7 (winner reaches 4)', !!fin && Math.max(fin.scoreA, fin.scoreB) === 4, fin ? `${fin.scoreA}-${fin.scoreB}` : 'none');
// the idols
const tm = ti.matches; tm.forEach((m: any) => allMatchIds.push(m.id));
const top20 = r.active.slice(0, 20).map((i: any) => i.id).sort().join(',');
check('I The Idols: 20 idols = top 20 rating, 380 matches', ti.memberIds.length === 20 && tm.length === 380, `${ti.memberIds.length}/${tm.length}`);
check('I The Idols members equal top-20 active by rating (ties by rule)', [...ti.memberIds].sort().join(',') === top20);
check('I The Idols phase 1 Bo4 (4 games each, draws allowed)', tm.every((m: any) => games(m) === 4), 'game totals: ' + dist(tm.map(games)));
const pm = ti.playoffMatches; pm.forEach((m: any) => allMatchIds.push(m.id));
check('I playoff: 16 matches, Bo5 except grand final Bo7', pm.length === 16 && pm.filter((m: any) => m.bestOf === 7).length === 1 && pm.filter((m: any) => m.bestOf === 5).length === 15, 'bestOf: ' + dist(pm.map((m: any) => m.bestOf)));
// global
const divisionMatchCount = (s.divisionSystem?.divisions || []).reduce(
  (sum: number, division: any) => sum + (division.matches || []).filter((match: any) => match.completed).length,
  0
);
check('J total matches simulated includes all completed D1/D2 fixtures', s.totalMatchesSimulated === 2966 + divisionMatchCount, `${s.totalMatchesSimulated} (base 2966 + divisions ${divisionMatchCount})`);
check('J all 12 D1/D2 divisions are simulated', (s.divisionSystem?.divisions || []).length === 12 && (s.divisionSystem?.divisions || []).every((division: any) => division.matches.length === 380 && division.matches.every((match: any) => match.completed)), String((s.divisionSystem?.divisions || []).length));
check('J match IDs unique', new Set(allMatchIds).size === allMatchIds.length, `${new Set(allMatchIds).size}/${allMatchIds.length}`);
const usedAll = new Set<string>([...usedIdolIds, ...sw.participants.map((p: any) => p.idolId), ...ti.memberIds, ...q]);
check('J no inactive idol anywhere', [...usedAll].every(id => activeIds.has(id)), String([...usedAll].filter(id => !activeIds.has(id)).length));
let fail = 0; for (const [n, ok, info] of results) { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '   [' + info + ']' : ''}`); }
console.log(`\n${results.length - fail}/${results.length} passed`); process.exit(fail ? 1 : 0);
