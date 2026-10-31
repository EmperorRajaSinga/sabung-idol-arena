import { buildSeason } from './helpers';
const { applyLeagueRosterImport } = await import('../src/utils/leagueRosterImport');
const { exportLeagueBrandingAndRosters } = await import('../src/utils/databaseStudioLogic');
const L = await import('../src/utils/leagueLogic');
const r = await buildSeason(process.argv[2]);
const full = r.ls; // season with 6 rosters, 380 fixtures each
const json = JSON.parse(exportLeagueBrandingAndRosters(full, r.idols, []));
const res: Array<[string, boolean, string]> = []; const ck = (n: string, ok: boolean, i = '') => res.push([n, ok, i]);
const sizes = (s: any) => s.leagues.map((l: any) => l.memberIds.length).join('/');
const empty: any = L.initializeLeagueSeason(r.idols, r.groups, 1);
ck('0 fresh state starts with empty rosters', empty.leagues.every((l: any) => l.memberIds.length === 0));

const a = applyLeagueRosterImport(empty, json, r.idols, r.groups);
ck('1 export -> import into empty leagues: 6 x 20 members', sizes(a.state) === '20/20/20/20/20/20', sizes(a.state));
ck('1 fixtures rebuilt: 380 matches per league, 20 standings rows', a.state.leagues.every((l: any) => l.matches.length === 380 && l.standings.length === 20));
ck('1 no warnings', a.report.unknownEntries.length === 0 && a.report.duplicateEntries.length === 0);
const b = applyLeagueRosterImport(null, json, r.idols, r.groups);
ck('2 works when no league season exists yet (state = null)', sizes(b.state) === '20/20/20/20/20/20', sizes(b.state));
const noIds = { divisions: json.divisions.map((d: any) => ({ leagueId: d.leagueId ?? d.id, roster: d.roster.map((x: any) => ({ name: x.name, girlGroup: x.girlGroup })) })) };
const c = applyLeagueRosterImport(empty, noIds, r.idols, r.groups);
ck('3 names only (no IDs): all 120 idols resolved', sizes(c.state) === '20/20/20/20/20/20' && c.report.unknownEntries.length === 0, sizes(c.state));
const dup = JSON.parse(JSON.stringify(json)); dup.divisions[1].memberIds[0] = dup.divisions[0].memberIds[0]; delete dup.divisions[1].roster;
const d = applyLeagueRosterImport(empty, dup, r.idols, r.groups);
ck('4 duplicate idol across leagues: skipped and reported', d.report.duplicateEntries.length === 1 && d.state.leagues[1].memberIds.length === 19, `${d.report.duplicateEntries.length} dup, league2=${d.state.leagues[1].memberIds.length}`);
const unk = JSON.parse(JSON.stringify(json)); unk.divisions[0].memberIds[0] = 'idol-does-not-exist'; delete unk.divisions[0].roster;
const e = applyLeagueRosterImport(empty, unk, r.idols, r.groups);
ck('5 unknown idol: reported, not silent', e.report.unknownEntries.length === 1 && e.state.leagues[0].memberIds.length === 19, `${e.report.unknownEntries}`);
const again = applyLeagueRosterImport(a.state, json, r.idols, r.groups);
ck('6 importing the same file twice keeps fixtures (no rebuild)', again.report.rebuiltFixtures.length === 0);
const branded = JSON.parse(JSON.stringify(json)); branded.divisions[0].name = 'Test League';
ck('7 branding fields are applied', applyLeagueRosterImport(a.state, branded, r.idols, r.groups).state.leagues[0].name === 'Test League');
let f = 0; for (const [n, ok, i] of res) { if (!ok) f++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${i ? '   [' + i + ']' : ''}`); }
process.exit(f ? 1 : 0);
