import { buildSeason } from './helpers';
const { generateSwissPlayIn } = await import('../src/utils/swissLogic');
const r = await buildSeason(process.argv[2]); const ls = r.summary.updatedLeagueState;
const results: Array<[string, boolean, string]> = []; const check = (n: string, ok: boolean, i = '') => results.push([n, ok, i]);
const topIds = (leagues: any[]) => new Set<string>(leagues.flatMap((l: any) => [...l.standings].sort((a: any, b: any) => (b.points - a.points) || (b.gameDiff - a.gameDiff) || (b.gamesFor - a.gamesFor) || (b.wins - a.wins) || a.idolName.localeCompare(b.idolName)).slice(0, 6).map((x: any) => x.idolId)));
const bad = (sw: any, top: Set<string>) => sw.participants.filter((p: any) => top.has(p.idolId)).length;

// a) normal
const sw1 = generateSwissPlayIn(ls.leagues, r.idols); const top = topIds(ls.leagues);
check('a) normal: 64 Swiss participants, none from league ranks 1-6', sw1.participants.length === 64 && bad(sw1, top) === 0, `${sw1.participants.length} / ${bad(sw1, top)}`);
// b) standings stored in the wrong order (shuffled)
const shuffled = ls.leagues.map((l: any) => ({ ...l, standings: [...l.standings].reverse() }));
const sw2 = generateSwissPlayIn(shuffled, r.idols);
check('b) shuffled standings arrays: still no ranks 1-6', sw2.participants.length === 64 && bad(sw2, top) === 0, `${sw2.participants.length} / ${bad(sw2, top)}`);
// c) stale stored Swiss that contains direct qualifiers, nothing played yet
const stale = { ...sw1, matches: sw1.matches.map((m: any) => ({ ...m, completed: false })), lastChanceMatches: [], participants: sw1.participants.map((p: any, i: number) => i < 3 ? { ...p, idolId: [...top][i] } : p) };
const sw3 = generateSwissPlayIn(ls.leagues, r.idols, stale as any);
check('c) stale stored Swiss containing top-6 idols is rebuilt', bad(sw3, top) === 0, String(bad(sw3, top)));
// d) short rosters (12 idols per league): padding must not pull in ranks 1-6
const short = ls.leagues.map((l: any) => ({ ...l, standings: l.standings.slice(0, 12) }));
const sw4 = generateSwissPlayIn(short, r.idols);
check('d) short rosters: no ranks 1-6 added as padding', bad(sw4, topIds(short)) === 0, `${sw4.participants.length} participants, ${bad(sw4, topIds(short))} direct`);
// e) full season: legacy wildcard play-in is not played in the 64 format
const wc = (r.summary.syncedMatchDatabase || []).filter((m: any) => String(m.matchId).startsWith('wildcard_'));
check('e) no legacy Wildcard Play-In matches in the 64-idol format', wc.length === 0, String(wc.length));
let f = 0; for (const [n, ok, i] of results) { if (!ok) f++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? '   [' + i + ']' : ''}`); }
process.exit(f ? 1 : 0);
