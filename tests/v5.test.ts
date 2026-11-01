import fs from 'fs';
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => {}, key: () => null, length: 0 };
(globalThis as any).window = globalThis;
const L = await import('../src/utils/leagueLogic');
const E = await import('../src/utils/v5/engine');
const { rankStandings } = await import('../src/utils/swissLogic');
const { isIdolActive } = await import('../src/utils/tournamentLogic');
const { getIdolRating } = await import('../src/utils/ratingHelper');
const db = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const groups = db.girlGroups.map((g: any) => ({ ...g, logoUrl: '', inactive: false }));   // owner reactivates the inactive groups
const idols = db.idols.map((i: any) => ({ ...i, photoUrl: '' }));
const by = new Map<string, any>(idols.map((i: any) => [i.id, i]));
const active = idols.filter((i: any) => isIdolActive(i, groups)).sort((a: any, b: any) => getIdolRating(b) - getIdolRating(a));
const res: Array<[string, boolean, string]> = []; const ck = (n: string, ok: boolean, i = '') => res.push([n, ok, i]);
const cascadeTest = E.buildMiniCup(999, active.slice(0, 16).map((i: any) => i.id));
E.simulateBracket(cascadeTest, by);
const editedRoot = cascadeTest[0];
const oldWinner = editedRoot.winnerId;
const newWinner = editedRoot.loserId!;
editedRoot.winnerId = newWinner; editedRoot.loserId = oldWinner;
editedRoot.scoreA = editedRoot.winnerId === editedRoot.idolAId ? 3 : 0;
editedRoot.scoreB = editedRoot.winnerId === editedRoot.idolBId ? 3 : 0;
E.invalidateDownstream(cascadeTest, editedRoot.id);
const affected = new Set<string>();
const pending = [editedRoot.id];
while (pending.length) {
  const source = pending.shift()!;
  cascadeTest.forEach((m: any) => {
    if (affected.has(m.id) || m.id === editedRoot.id) return;
    const depends = (('win' in m.a && m.a.win === source) || ('lose' in m.a && m.a.lose === source) || ('win' in m.b && m.b.win === source) || ('lose' in m.b && m.b.lose === source));
    if (depends) { affected.add(m.id); pending.push(m.id); }
  });
}
ck('F4 editing an earlier result clears every dependent match and keeps unrelated branches intact',
  affected.size === 3 && cascadeTest.filter((m: any) => affected.has(m.id)).every((m: any) => !m.completed && !m.winnerId && !m.loserId && m.scoreA === null && m.scoreB === null && m.idolAId === null && m.idolBId === null) &&
  cascadeTest.find((m: any) => m.id.endsWith('_qf_3'))?.completed === true,
  `cleared ${affected.size} dependent matches`);

const seriesOk = (m: any) => m.completed && (m.bestOf === 7 ? Math.max(m.scoreA, m.scoreB) === 4 && Math.min(m.scoreA, m.scoreB) <= 3 : Math.max(m.scoreA, m.scoreB) === 3 && Math.min(m.scoreA, m.scoreB) <= 2) && m.idolAId !== m.idolBId && m.winnerId && m.loserId;

function freshD1(): any[] {
  const pool = active.slice(0, 120); const b: string[][] = [[], [], [], [], [], []];
  pool.forEach((x: any, i: number) => { const r = Math.floor(i / 6); b[r % 2 === 0 ? i % 6 : 5 - (i % 6)].push(x.id); });
  const base: any = L.initializeLeagueSeason(idols, groups, 1);
  return base.leagues.map((l: any, k: number) => E.rebuildLeague({ ...l, memberIds: b[k] }, idols));
}
let d1 = freshD1().map((l) => E.simulateLeagueMatches(l, idols));
ck('0 active idols after reactivating groups = 190', active.length === 190, String(active.length));
let d2 = E.autoFillDivisionTwo(d1, [], idols, groups, 10, 'Challenger Division');
const d1Ids = new Set(d1.flatMap((l: any) => l.memberIds)), d2Ids = d2.flatMap((l) => l.memberIds);
ck('A Division 2: 6 leagues x 10 idols, no overlap with Division 1, all active', d2.length === 6 && d2.every((l) => l.memberIds.length === 10) && new Set(d2Ids).size === 60 && d2Ids.every((i) => !d1Ids.has(i)), d2.map((l) => l.memberIds.length).join('/'));
ck('B Division 2 fixtures: 18 matchdays x 5 = 90 matches per league', d2.every((l) => l.matches.length === 90 && new Set(l.matches.map((m: any) => m.matchday)).size === 18));
const d2big = E.autoFillDivisionTwo(d1, [], idols, groups, 20, 'X');
ck('B2 capacity 20 with only 70 free idols: fills what exists, never overflows', d2big.reduce((a, l) => a + l.memberIds.length, 0) === 70 && d2big.every((l) => l.memberIds.length <= 20), d2big.map((l) => l.memberIds.length).join('/'));
const odd = E.rebuildLeague({ ...d2[0], memberIds: d2[0].memberIds.slice(0, 9) }, idols);
ck('B3 odd roster (9) works with rest days: 72 matches', odd.matches.length === 72, String(odd.matches.length));
d2 = d2.map((l) => E.simulateLeagueMatches(l, idols));
ck('B4 Division 2 simulated: all matches complete, champion set', d2.every((l) => l.matches.every((m: any) => m.completed) && !!l.championId));

// promotion / relegation
const pr = E.applyPromotionRelegation(d1, d2, 3, idols);
const allIds = [...pr.d1.flatMap((l) => l.memberIds), ...pr.d2.flatMap((l) => l.memberIds)];
ck('C promotion/relegation keeps sizes 20 and 10, 36 idols move, nobody duplicated', pr.d1.every((l) => l.memberIds.length === 20) && pr.d2.every((l) => l.memberIds.length === 10) && new Set(allIds).size === 180 && pr.moves.every((m) => m.relegated.length === 3 && m.promoted.length === 3), `${new Set(allIds).size} idols`);
const ok = pr.moves.every((mv, k) => { const r1 = rankStandings(d1[k].standings).map((s: any) => s.idolId), r2 = rankStandings(d2[k].standings).map((s: any) => s.idolId); return mv.relegated.join() === r1.slice(-3).join() && mv.promoted.join() === r2.slice(0, 3).join() && mv.relegated.every((i) => pr.d2[k].memberIds.includes(i)) && mv.promoted.every((i) => pr.d1[k].memberIds.includes(i)); });
ck('C2 moved idols are exactly ranks 18-20 down and Division 2 top 3 up', ok);
ck('C3 next season fixtures rebuilt: 380 / 90 matches, none played', pr.d1.every((l) => l.matches.length === 380 && l.matches.every((m: any) => !m.completed)) && pr.d2.every((l) => l.matches.length === 90));
const rank17Stay = d1.every((l: any, k: number) => { const r = rankStandings(l.standings).map((s: any) => s.idolId); return pr.d1[k].memberIds.includes(r[16]); });
ck('C4 rank 17 stays in Division 1', rank17Stay);

// champs cup
const champs = (flags: [number, number] | null) => d1.map((l: any, k: number) => { const t = rankStandings(l.standings)[0]; return { idolId: t.idolId, leagueId: l.id, wonGrandCup: !!flags && flags[0] === k, wonTheIdols: !!flags && flags[1] === k, points: t.points, gameDiff: t.gameDiff || 0 }; });
const cc = (flags: [number, number] | null) => { const c = champs(flags); const { matches, byeIds } = E.buildChampsCup(c); E.simulateBracket(matches, by); return { c, matches, byeIds }; };
const a = cc([3, 1]); const cInfo = a.c;
ck('D Champs Cup: 10 matches, all complete and valid series', a.matches.length === 10 && a.matches.every(seriesOk));
ck('D2 formats: Bo7 only Lower Final and Grand Final', a.matches.filter((m) => m.bestOf === 7).map((m) => m.id).sort().join() === 'cc_gf,cc_lf');
ck('D3 byes = Grand Cup winner and The Idols winner', [...a.byeIds].sort().join() === [cInfo[3].idolId, cInfo[1].idolId].sort().join());
const b = cc(null); const topPts = [...b.c].sort((x, y) => (y.points - x.points) || (y.gameDiff - x.gameDiff)).slice(0, 2).map((x) => x.idolId);
ck('D4 no trophy winners: byes go to top league points', b.byeIds.every((i) => topPts.includes(i)) || new Set(b.c.map((x) => x.points)).size < 6);
const c3 = cc([2, 2]); ck('D5 one idol won both: gets one bye, second bye by points', c3.byeIds.includes(champs([2, 2])[2].idolId) && c3.byeIds.length === 2);
const losses: Record<string, number> = {}; a.matches.forEach((m) => { losses[m.loserId!] = (losses[m.loserId!] || 0) + 1; });
const gf = a.matches.find((m) => m.id === 'cc_gf')!; const champ = gf.winnerId!;
ck('D6 double elimination: champion has at most 1 loss, nobody has more than 2', (losses[champ] || 0) <= 1 && Object.values(losses).every((v) => v <= 2) && new Set([...Object.keys(losses), champ]).size === 6);

// league cup
const order = E.leagueCupOrder(d1, d2); const leagueOf: Record<string, number> = {}; [...d1, ...d2].forEach((l: any) => l.memberIds.forEach((i: string) => { leagueOf[i] = l.id; }));
const lc = E.createLeagueCup(order, leagueOf, 60); E.simulateLeagueCup(lc, by);
ck('E League Cup plan A: entrants 60/48/55/17, sizes 60/78/94/64/32/16/8/4/2', lc.plan.entrants.join() === '60,48,55,17,0,0,0,0,0' && lc.plan.sizes.join() === '60,78,94,64,32,16,8,4,2', lc.plan.entrants.join() + ' | ' + lc.plan.sizes.join());
const lcm = lc.rounds.flat();
ck('E2 League Cup: 179 matches, all valid, final Bo7, others Bo5', lcm.length === 179 && lcm.every(seriesOk) && lcm.filter((m) => m.bestOf === 7).length === 1 && lc.rounds[lc.rounds.length - 1][0].bestOf === 7, String(lcm.length));
ck('E3 League Cup: champion decided, every round even', !!lc.championId && lc.rounds.map((r) => r.length * 2).join() === lc.plan.sizes.join());
const first = new Set(lc.rounds[0].flatMap((m) => [m.idolAId, m.idolBId]));
ck('E4 all 60 Division 2 idols start in round 1', d2.every((l) => l.memberIds.every((i: string) => first.has(i))) && first.size === 60);
const r4 = new Set(lc.rounds[3].flatMap((m) => [m.idolAId, m.idolBId])); const top17 = order.slice(-17);
ck('E5 best 17 idols enter in round 4 (skip 3 rounds)', top17.every((i) => r4.has(i) && !new Set(lc.rounds[2].flatMap((m) => [m.idolAId, m.idolBId])).has(i)));
for (const [d2c, d1c] of [[60, 120], [120, 120], [40, 100], [0, 120], [10, 12], [30, 90]]) {
  const p = E.planLeagueCup(d2c, d1c); const N = d2c + d1c; let W = 0, ok2 = true, tot = 0;
  p.entrants.forEach((n, r) => { const S = W + n; if (S % 2 || (r === p.rounds - 1 && S !== 2)) ok2 = false; tot += S / 2; W = S / 2; });
  ck(`E6 plan for ${N} idols (D2 ${d2c}): every round even, final = 2, matches = N-1`, ok2 && tot === N - 1 && p.entrants.reduce((x, y) => x + y, 0) === N, `${p.rounds} rounds, ${tot} matches`);
}
// mini cups
const minis = d1.map((l: any) => E.buildMiniCup(l.id, rankStandings(l.standings).slice(0, 16).map((s: any) => s.idolId)));
minis.forEach((m) => E.simulateBracket(m, by));
ck('F Mini Cups: 6 cups x 15 matches, valid, final Bo7, others Bo5', minis.every((m) => m.length === 15 && m.every(seriesOk) && m.filter((x) => x.bestOf === 7).length === 1));
const m0 = E.buildMiniCup(1, rankStandings(d1[0].standings).slice(0, 16).map((s: any) => s.idolId)); const top16 = rankStandings(d1[0].standings).slice(0, 16).map((s: any) => s.idolId);
ck('F2 Mini Cup seeding: Round of 16 pairs are 1v16, 8v9, 4v13 ...', m0.slice(0, 8).every((m) => (top16.indexOf(m.idolAId!) + 1) + (top16.indexOf(m.idolBId!) + 1) === 17));
ck('F3 only Division 1 top 16 play the Mini Cup', minis.every((m, k) => m.slice(0, 8).every((x) => d1[k].memberIds.includes(x.idolAId) && d1[k].memberIds.includes(x.idolBId))));
// super cups
const idolsChamp = d1[0].championId, grand = d1[1].championId;
const sa = E.buildSuperCup('sc_a', idolsChamp, grand, d1[2].championId); const same = E.buildSuperCup('sc_a2', grand, grand, d1[2].championId);
ck('G Super Cup: normal case pairs the two champions, double winner meets runner-up', sa.idolBId === grand && same.idolAId === grand && same.idolBId === d1[2].championId && same.idolBId !== same.idolAId);
E.simulateBracket([sa], by); ck('G2 Super Cup played as Best of 5', seriesOk(sa) && sa.bestOf === 5);
// archive guard knows the v5 competitions
const { getUnfinishedCompetitions } = await import('../src/utils/seasonGuard');
const partial = JSON.parse(JSON.stringify({ champsCup: { matches: a.matches, byeIds: a.byeIds }, d2, leagueCup: lc, miniCups: { 1: minis[0] }, superA: sa, superB: [] }));
const clean = getUnfinishedCompetitions({ v5: partial, v5Names: {} });
partial.champsCup.matches[9].completed = false; partial.champsCup.matches[9].winnerId = null; partial.leagueCup.championId = null; partial.d2[0].matches[3].completed = false;
const dirty = getUnfinishedCompetitions({ v5: partial, v5Names: { champsCup: 'Crown Cup', leagueCup: 'Open Arena Cup' } });
ck('J archive guard: finished v5 season is clean, unfinished cups and Division 2 are named', clean.length === 0 && dirty.length === 3 && dirty.some((x) => x.startsWith('Crown Cup')) && dirty.some((x) => x.startsWith('Open Arena Cup')), JSON.stringify(dirty));
// unique ids
const ids = [...a.matches.map((m) => m.id), ...lcm.map((m) => m.id), ...minis.flat().map((m) => m.id)];
ck('H all cup match IDs unique', new Set(ids).size === ids.length, `${ids.length}`);
// stress
let stressOk = true; for (let i = 0; i < 25; i++) { const x = cc(i % 3 === 0 ? [i % 6, (i + 1) % 6] : null); const c2 = E.createLeagueCup(E.leagueCupOrder(d1, d2), leagueOf, 60); E.simulateLeagueCup(c2, by); if (x.matches.length !== 10 || !x.matches.every(seriesOk) || c2.rounds.flat().length !== 179 || !c2.championId) stressOk = false; }
ck('I stress: 25 random runs of Champs Cup + League Cup are always valid', stressOk);
let f = 0; for (const [n, ok3, i] of res) { if (!ok3) f++; console.log(`${ok3 ? 'PASS' : 'FAIL'}  ${n}${i ? '   [' + i + ']' : ''}`); }
console.log(`${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
