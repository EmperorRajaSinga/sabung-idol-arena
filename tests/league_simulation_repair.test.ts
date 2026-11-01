import assert from 'node:assert/strict';
import type { Idol, LeagueInfo } from '../src/types';
import {
  calculateLeagueStandings,
  generateRoundRobinMatches,
  repairLeagueFixturesForSimulation,
} from '../src/utils/leagueLogic';

const idols = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name, index) => ({
  id: `idol-${index + 1}`,
  name,
  girlGroup: 'Test Group',
  seed: 'Seed 1',
  nationality: 'South Korea',
  photoUrl: '',
  rating: 80,
} as unknown as Idol));
const memberIds = idols.map((idol) => idol.id);
const matches = generateRoundRobinMatches(3, memberIds);
const standings = calculateLeagueStandings(3, memberIds, matches, idols);
const league: LeagueInfo = {
  id: 3,
  name: 'Challenger Division 3',
  tierName: 'Division 2',
  color: '#000000',
  memberIds: ['old-idol-alpha', ...memberIds.slice(1)],
  matches: matches.map((match, index) => index === 0
    ? { ...match, idolAId: 'old-idol-alpha', scoreA: 3, scoreB: 1, winnerId: 'old-idol-alpha', completed: true }
    : match),
  standings: [
    { ...standings[0], idolId: 'old-idol-alpha', idolName: 'Alpha' },
    ...standings.slice(1),
  ],
};

const repaired = repairLeagueFixturesForSimulation(league, idols);
assert.deepEqual(repaired.unresolvedMemberIds, []);
assert.deepEqual(repaired.league.memberIds, memberIds);
assert.equal(repaired.league.matches.length, 12);
assert.equal(repaired.league.matches.every((match) =>
  memberIds.includes(match.idolAId) && memberIds.includes(match.idolBId)
), true);
const retained = repaired.league.matches.find((match) =>
  match.idolAId === 'idol-1' && match.idolBId === 'idol-4'
);
assert.equal(retained?.completed, true);
assert.equal(retained?.scoreA, 3);
assert.equal(retained?.scoreB, 1);

const broken = repairLeagueFixturesForSimulation({
  ...league,
  standings: league.standings.map((standing) => standing.idolId === 'old-idol-alpha'
    ? { ...standing, idolName: 'Name Not In Database' }
    : standing),
}, idols);
assert.deepEqual(broken.unresolvedMemberIds, ['old-idol-alpha']);
assert.equal(broken.league.matches, league.matches);

console.log('League simulation fixture repair tests passed.');
