import assert from 'node:assert/strict';
import type { Idol } from '../src/types';
import { emptyV5 } from '../src/utils/v5/store';
import { simulateV5Season } from '../src/utils/v5/engine';
import { createV5ArchiveSnapshot } from '../src/utils/v5/archive';

const idols = Array.from({ length: 96 }, (_, index) => ({
  id: `v5-idol-${index + 1}`,
  name: `V5 Idol ${index + 1}`,
  girlGroup: `Group ${Math.floor(index / 4) + 1}`,
  seed: 'Seed 1',
  nationality: 'South Korea',
  photoUrl: '',
  rating: 70 + (index % 25),
} as unknown as Idol));
const d1 = Array.from({ length: 6 }, (_, leagueIndex) => {
  const memberIds = idols.slice(leagueIndex * 16, leagueIndex * 16 + 16).map((idol) => idol.id);
  return {
    id: leagueIndex + 1,
    name: `Division 1 League ${leagueIndex + 1}`,
    tierName: 'Division 1',
    color: '#000000',
    memberIds,
    matches: [],
    standings: [],
  } as any;
});
const grandWinner = idols[0].id;
const grandRunner = idols[1].id;
const v5 = simulateV5Season(
  emptyV5(),
  d1,
  idols,
  [{ id: 'grand-final', roundName: 'Grand Final', idolAId: grandWinner, idolBId: grandRunner, winnerId: grandWinner, completed: true }],
  idols[2].id
);

assert.equal(v5.champsCup?.matches.find((match) => match.id === 'cc_gf')?.completed, true);
assert.equal(Boolean(v5.leagueCup?.championId), true);
assert.equal(Object.keys(v5.miniCups).length, 6);
assert.equal(v5.superA?.completed, true);
assert.equal(v5.superB.length, 6);
assert.equal(v5.d2.length, 0);

const snapshot = createV5ArchiveSnapshot(v5, [], [], idols, 7, 'Season 7');
assert.ok(snapshot.matches.length > 0);
assert.ok(snapshot.titles.some((title) => title.competition === 'League Champions Cup'));
assert.ok(snapshot.titles.some((title) => title.competition === 'All-League Knockout Cup'));
assert.ok(snapshot.titles.some((title) => title.competition === 'Super Cup A'));
assert.equal(snapshot.titles.filter((title) => title.competition.startsWith('Super Cup B')).length, 6);
assert.equal(snapshot.resetState.champsCup, null);
assert.equal(snapshot.resetState.leagueCup, null);
assert.equal(Object.keys(snapshot.resetState.miniCups).length, 0);
assert.equal(snapshot.resetState.superA, null);
assert.equal(snapshot.resetState.superB.length, 0);

console.log('V5 full-season simulation and archive tests passed.');
