import assert from 'node:assert/strict';
import {
  loadRosterSnapshot,
  saveDivisionOneRosterSnapshot,
  saveDivisionTwoRosterSnapshot,
  restoreDivisionOneRoster,
  restoreDivisionTwoRoster,
} from '../src/utils/rosterPersistence';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
  },
});

const d1 = Array.from({ length: 6 }, (_, index) => ({
  id: index + 1,
  memberIds: [`d1-idol-${index + 1}`],
}));
const d2 = Array.from({ length: 6 }, (_, index) => ({
  id: index + 101,
  memberIds: [`d2-idol-${index + 1}`],
}));

assert.equal(saveDivisionOneRosterSnapshot(d1), true);
assert.equal(saveDivisionTwoRosterSnapshot(d2), true);

// Recovery must still work if the primary snapshot is damaged.
values.set('sabung_roster_membership_v1', '{invalid json');
assert.deepEqual(loadRosterSnapshot()?.division1, d1);
values.delete('sabung_roster_membership_v1');
assert.equal(saveDivisionOneRosterSnapshot(d1), true);

const snapshot = loadRosterSnapshot();
assert.ok(snapshot);
assert.deepEqual(
  restoreDivisionOneRoster(d1.map((league) => ({ ...league, memberIds: [] })), snapshot)?.map((league) => league.memberIds),
  d1.map((league) => league.memberIds),
);
assert.deepEqual(
  restoreDivisionTwoRoster(d2.map((league) => ({ ...league, memberIds: [] })), snapshot)?.map((league) => league.memberIds),
  d2.map((league) => league.memberIds),
);

// Updating one division must not overwrite the other division's saved roster.
const changedD1 = d1.map((league, index) => ({
  ...league,
  memberIds: [`changed-d1-${index + 1}`],
}));
assert.equal(saveDivisionOneRosterSnapshot(changedD1), true);
assert.deepEqual(loadRosterSnapshot()?.division2, d2);

// A stale panel update with empty YG/JYP arrays must not erase their last
// committed membership while the other four divisions remain unchanged.
const staleRender = changedD1.map((league) => ({
  ...league,
  memberIds: [3, 4].includes(league.id) ? [] : [...league.memberIds],
}));
assert.equal(saveDivisionOneRosterSnapshot(staleRender), true);
assert.deepEqual(
  loadRosterSnapshot()?.division1?.map((league) => league.memberIds),
  changedD1.map((league) => league.memberIds),
);

// Legacy league records with empty memberIds but populated standings must recover.
const legacyWithStandings = d1.map((league) => ({
  ...league,
  memberIds: [],
  standings: [{ idolId: `standing-idol-${league.id}` }],
}));
const recoveredLegacy = restoreDivisionOneRoster(legacyWithStandings, null);
assert.deepEqual(
  recoveredLegacy?.map((league) => league.memberIds),
  d1.map((league) => [`standing-idol-${league.id}`]),
);

// Explicitly clearing one division must be allowed to persist as empty.
const explicitlyCleared = changedD1.map((league) => ({
  ...league,
  memberIds: league.id === 6 ? [] : [...league.memberIds],
}));
assert.equal(saveDivisionOneRosterSnapshot(explicitlyCleared, { allowEmptyRosterIds: [6] }), true);
assert.deepEqual(loadRosterSnapshot()?.division1?.find((league) => league.id === 6)?.memberIds, []);

// Partial data and accidental empty Division 2 state must not erase a complete roster.
assert.equal(saveDivisionOneRosterSnapshot(d1.slice(0, 5)), false);
assert.equal(saveDivisionTwoRosterSnapshot([]), false);
assert.deepEqual(loadRosterSnapshot()?.division2, d2);

// A stale D2 update with empty league membership must not erase saved idols.
const staleD2 = d2.map((league, index) => ({
  ...league,
  memberIds: index === 1 || index === 4 ? [] : [...league.memberIds],
}));
assert.equal(saveDivisionTwoRosterSnapshot(staleD2), true);
assert.deepEqual(
  loadRosterSnapshot()?.division2?.map((league) => league.memberIds),
  d2.map((league) => league.memberIds),
);

// A deliberate clear from the D2 roster manager must still be persisted.
const clearedD2 = d2.map((league) => ({
  ...league,
  memberIds: league.id === 106 ? [] : [...league.memberIds],
}));
assert.equal(saveDivisionTwoRosterSnapshot(clearedD2, { allowEmptyRosterIds: [106] }), true);
assert.deepEqual(loadRosterSnapshot()?.division2?.find((league) => league.id === 106)?.memberIds, []);

console.log('Roster persistence tests passed.');
