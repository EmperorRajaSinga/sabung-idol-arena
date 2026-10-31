import { buildSeason } from './helpers';
// Mirrors the Idol Profile league-total filter (2a) after the fix, on a real simulated season.
const r = await buildSeason(process.argv[2]); const s = r.summary; const ls = s.updatedLeagueState;
const inIdols = new Set(s.updatedTheIdolsState.memberIds);
let bad = 0, checked = 0;
for (const l of ls.leagues) for (const id of l.memberIds) {
  const idol = r.idols.find((i: any) => i.id === id);
  const rows = (s.syncedMatchDatabase || []).filter((m: any) => m.idolAId === id || m.idolBId === id);
  const map = new Map<string, any>();
  rows.forEach((m: any) => {
    const stage = String(m.stage || '').toLowerCase(); const mid = String(m.matchId || '').toLowerCase();
    const isLeague = /league|division|wildcard|premier|championship|md |matchday/.test(stage) || mid.includes('league');
    const other = mid.startsWith('the_idols') || mid.startsWith('swiss_') || stage.startsWith('the idols') || stage.includes('swiss') || stage.includes('last chance') || stage.includes('superleague') || stage.includes('masters');
    if (isLeague && !other) map.set(m.matchId, m);
  });
  checked++; if (map.size !== 38) bad++;
}
console.log(bad === 0 ? 'PASS' : 'FAIL', `idols checked ${checked}, idols not at 38 league matches: ${bad}, of which also in The Idols: ${[...inIdols].length}`);
process.exit(bad ? 1 : 0);
