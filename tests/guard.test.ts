import { buildSeason } from './helpers';
import { getUnfinishedCompetitions } from '../src/utils/seasonGuard';
const r = await buildSeason(process.argv[2]); const s = r.summary;
const args = { groups: s.championsTournament.groups, knockoutMatches: s.championsTournament.knockoutMatches, leagueState: s.updatedLeagueState, theIdolsState: s.updatedTheIdolsState };
const full = getUnfinishedCompetitions(args);
const c = JSON.parse(JSON.stringify(args));
c.leagueState.leagues[2].matches.slice(0, 7).forEach((m: any) => { m.completed = false; m.winnerId = null; });
c.knockoutMatches[c.knockoutMatches.length - 1].completed = false; c.knockoutMatches[c.knockoutMatches.length - 1].winnerId = null;
const part = getUnfinishedCompetitions(c);
const none = getUnfinishedCompetitions({});
// Retired legacy Wildcard Play-In data must never block archiving.
const legacyWildcard = JSON.parse(JSON.stringify(args));
legacyWildcard.leagueState.wildcardPlayIn = {
  participants: Array.from({ length: 6 }, (_, i) => ({ idolId: `legacy-${i}` })),
  matches: Array.from({ length: 7 }, (_, i) => ({ id: `legacy-${i}`, completed: false })),
};
const legacyOnly = getUnfinishedCompetitions(legacyWildcard);
// The active Swiss Play-In must still block archiving when it has unfinished matches.
const activeSwiss = JSON.parse(JSON.stringify(args));
activeSwiss.leagueState.swissPlayIn = {
  participants: [{ idolId: 'swiss-entrant' }],
  matches: [{ id: 'swiss-pending', completed: false }],
  lastChanceMatches: [],
};
const swissBlocked = getUnfinishedCompetitions(activeSwiss);
const { advanceLeagueSeason, resetLeagueSeasonMatchesOnly } = await import('../src/utils/leagueLogic');
const nextSeason = advanceLeagueSeason(s.updatedLeagueState, s.updatedAppState.idols, s.updatedAppState.girlGroups);
const resetSeason = resetLeagueSeasonMatchesOnly(s.updatedLeagueState, s.updatedAppState.idols);
const ok = full.length === 0 && part.length === 2 && none.length === 0 &&
  legacyOnly.length === 0 && swissBlocked.some((x) => x.startsWith('Swiss Play-In')) &&
  !nextSeason.wildcardPlayIn && !resetSeason.wildcardPlayIn &&
  !!nextSeason.swissPlayIn && !!resetSeason.swissPlayIn;
console.log(ok ? 'PASS' : 'FAIL', JSON.stringify({ full, part, none, legacyOnly, swissBlocked }));
process.exit(ok ? 0 : 1);
