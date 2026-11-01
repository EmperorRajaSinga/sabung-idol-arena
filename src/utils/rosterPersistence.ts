/**
 * Small, independent persistence for roster membership.
 *
 * Do not store match fixtures, standings, images, or competition brackets here.
 * This snapshot exists so a quota failure in the large application stores cannot
 * silently roll back Division 1 or Division 2 roster assignments after refresh.
 */
export interface RosterMembership {
  id: number;
  memberIds: string[];
}

export interface RosterSnapshot {
  version: 1;
  updatedAt: number;
  division1: RosterMembership[] | null;
  division2: RosterMembership[] | null;
}

const PRIMARY_KEY = 'sabung_roster_membership_v1';
const BACKUP_KEY = 'sabung_roster_membership_backup_v1';

function parseSnapshot(raw: string | null): RosterSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      value.version !== 1 ||
      typeof value.updatedAt !== 'number' ||
      (!Array.isArray(value.division1) && value.division1 !== null) ||
      (!Array.isArray(value.division2) && value.division2 !== null)
    ) return null;

    const normalize = (items: unknown): RosterMembership[] | null => {
      if (!Array.isArray(items)) return null;
      return items
        .filter((item: any) => item && Number.isFinite(Number(item.id)) && Array.isArray(item.memberIds))
        .map((item: any) => ({
          id: Number(item.id),
          memberIds: item.memberIds.filter((id: unknown) => typeof id === 'string' && id.length > 0),
        }));
    };

    return {
      version: 1,
      updatedAt: value.updatedAt,
      division1: value.division1 === null ? null : normalize(value.division1),
      division2: value.division2 === null ? null : normalize(value.division2),
    };
  } catch {
    return null;
  }
}

export function loadRosterSnapshot(): RosterSnapshot | null {
  try {
    const primary = parseSnapshot(localStorage.getItem(PRIMARY_KEY));
    const backup = parseSnapshot(localStorage.getItem(BACKUP_KEY));
    if (!primary) return backup;
    if (!backup) return primary;
    return backup.updatedAt > primary.updatedAt ? backup : primary;
  } catch {
    return null;
  }
}

function writeSnapshot(next: RosterSnapshot): boolean {
  const serialized = JSON.stringify(next);
  let primarySaved = false;
  let backupSaved = false;
  try {
    localStorage.setItem(PRIMARY_KEY, serialized);
    primarySaved = true;
  } catch { /* independent backup write below */ }
  try {
    localStorage.setItem(BACKUP_KEY, serialized);
    backupSaved = true;
  } catch { /* primary may still be available */ }
  if (!primarySaved && !backupSaved) {
    console.error('[Persistence] Could not save the independent roster membership snapshot.');
  }
  return primarySaved || backupSaved;
}

function toMemberships<T extends { id: number; memberIds: string[] }>(leagues: T[]): RosterMembership[] {
  return leagues.map((league) => ({
    id: Number(league.id),
    memberIds: Array.isArray(league.memberIds) ? [...league.memberIds] : [],
  }));
}

export function saveDivisionOneRosterSnapshot<T extends { id: number; memberIds: string[] }>(leagues: T[]): boolean {
  if (!Array.isArray(leagues) || leagues.length !== 6 || new Set(leagues.map((league) => Number(league.id))).size !== 6) {
    console.error('[Persistence] Division 1 roster snapshot rejected because the six-league source is incomplete.');
    return false;
  }
  const current = loadRosterSnapshot();
  return writeSnapshot({
    version: 1,
    updatedAt: Date.now(),
    division1: toMemberships(leagues),
    division2: current?.division2 ?? null,
  });
}

export function saveDivisionTwoRosterSnapshot<T extends { id: number; memberIds: string[] }>(leagues: T[]): boolean {
  if (!Array.isArray(leagues) || (leagues.length > 0 && new Set(leagues.map((league) => Number(league.id))).size !== leagues.length)) {
    console.error('[Persistence] Division 2 roster snapshot rejected because the source is invalid.');
    return false;
  }
  const current = loadRosterSnapshot();
  return writeSnapshot({
    version: 1,
    updatedAt: Date.now(),
    division1: current?.division1 ?? null,
    division2: toMemberships(leagues),
  });
}

export function restoreDivisionOneRoster<T extends { id: number; memberIds: string[] }>(
  leagues: T[] | null | undefined,
  snapshot: RosterSnapshot | null
): T[] | null | undefined {
  if (!Array.isArray(leagues) || !snapshot?.division1) return leagues;
  const saved = new Map(snapshot.division1.map((item) => [item.id, item.memberIds]));
  return leagues.map((league) => saved.has(Number(league.id))
    ? { ...league, memberIds: [...saved.get(Number(league.id))!] }
    : league);
}

export function restoreDivisionTwoRoster<T extends { id: number; memberIds: string[] }>(
  leagues: T[] | null | undefined,
  snapshot: RosterSnapshot | null
): T[] | null | undefined {
  if (!Array.isArray(leagues) || !snapshot?.division2) return leagues;
  const saved = new Map(snapshot.division2.map((item) => [item.id, item.memberIds]));
  return leagues.map((league) => saved.has(Number(league.id))
    ? { ...league, memberIds: [...saved.get(Number(league.id))!] }
    : league);
}
