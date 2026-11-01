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

// Partial data and accidental empty Division 2 state must not erase a complete roster.
assert.equal(saveDivisionOneRosterSnapshot(d1.slice(0, 5)), false);
assert.equal(saveDivisionTwoRosterSnapshot([]), false);
assert.deepEqual(loadRosterSnapshot()?.division2, d2);

console.log('Roster persistence tests passed.');
