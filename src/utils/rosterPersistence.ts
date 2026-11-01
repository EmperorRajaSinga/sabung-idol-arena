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

export function clearRosterSnapshot(): void {
  try { localStorage.removeItem(PRIMARY_KEY); } catch { /* storage may be unavailable */ }
  try { localStorage.removeItem(BACKUP_KEY); } catch { /* storage may be unavailable */ }
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

function toMemberships<T extends { id: number; memberIds: string[]; standings?: Array<{ idolId?: string }> }>(leagues: T[]): RosterMembership[] {
  return leagues.map((league) => {
    const memberIds = Array.isArray(league.memberIds) ? [...league.memberIds] : [];
    // Older league records can have an empty memberIds array while their
    // standings still contain the actual roster. Recover that legacy shape.
    const recoveredIds = memberIds.length > 0
      ? memberIds
      : (league.standings || []).map((standing) => standing.idolId).filter((id): id is string => typeof id === 'string' && id.length > 0);
    return { id: Number(league.id), memberIds: Array.from(new Set(recoveredIds)) };
  });
}

export function saveDivisionOneRosterSnapshot<T extends { id: number; memberIds: string[]; standings?: Array<{ idolId?: string }> }>(
  leagues: T[],
  options: { allowEmptyRosterIds?: number[] } = {}
): boolean {
  const expectedIds = new Set([1, 2, 3, 4, 5, 6]);
  if (
    !Array.isArray(leagues) ||
    leagues.length !== 6 ||
    new Set(leagues.map((league) => Number(league.id))).size !== 6 ||
    !leagues.every((league) => expectedIds.has(Number(league.id)))
  ) {
    console.error('[Persistence] Division 1 roster snapshot rejected because the six-league source is incomplete.');
    return false;
  }
  const current = loadRosterSnapshot();
  const incoming = toMemberships(leagues);
  const savedById = new Map((current?.division1 || []).map((league) => [league.id, league.memberIds]));
  // LeagueSystemPanel can emit an older render snapshot while another roster
  // update is still settling. Never let an accidental empty array erase a
  // populated division. Explicit roster replacement still writes non-empty
  // membership normally; intentional clearing is handled by the dedicated
  // clearDivisionOneRosterSnapshot operation.
  const protectedMembership = incoming.map((league) => {
    const savedMembers = savedById.get(league.id) || [];
    const explicitlyCleared = (options.allowEmptyRosterIds || []).includes(league.id);
    if (league.memberIds.length === 0 && savedMembers.length > 0 && !explicitlyCleared) {
      return { ...league, memberIds: [...savedMembers] };
    }
    return league;
  });
  return writeSnapshot({
    version: 1,
    updatedAt: Date.now(),
    division1: protectedMembership,
    division2: current?.division2 ?? null,
  });
}

export function saveDivisionTwoRosterSnapshot<T extends { id: number; memberIds: string[] }>(
  leagues: T[],
  options: { allowEmptyRosterIds?: number[] } = {}
): boolean {
  if (
    !Array.isArray(leagues) ||
    (leagues.length > 0 && (leagues.length !== 6 || new Set(leagues.map((league) => Number(league.id))).size !== 6))
  ) {
    console.error('[Persistence] Division 2 roster snapshot rejected because the six-league source is incomplete.');
    return false;
  }
  const current = loadRosterSnapshot();
  // An empty/partial V5 payload can occur during legacy hydration. Never let it
  // erase an already saved Division 2 membership snapshot.
  if (
    leagues.length === 0 &&
    current?.division2?.some((league) => league.memberIds.length > 0)
  ) {
    console.error('[Persistence] Empty Division 2 state rejected because a populated roster snapshot already exists.');
    return false;
  }
  const incoming = toMemberships(leagues);
  const savedById = new Map((current?.division2 || []).map((league) => [league.id, league.memberIds]));
  const protectedMembership = incoming.map((league) => {
    const savedMembers = savedById.get(league.id) || [];
    const explicitlyCleared = (options.allowEmptyRosterIds || []).includes(league.id);
    if (league.memberIds.length === 0 && savedMembers.length > 0 && !explicitlyCleared) {
      return { ...league, memberIds: [...savedMembers] };
    }
    return league;
  });
  return writeSnapshot({
    version: 1,
    updatedAt: Date.now(),
    division1: current?.division1 ?? null,
    division2: protectedMembership,
  });
}

export function restoreDivisionOneRoster<T extends { id: number; memberIds: string[]; standings?: Array<{ idolId?: string }> }>(
  leagues: T[] | null | undefined,
  snapshot: RosterSnapshot | null
): T[] | null | undefined {
  if (!Array.isArray(leagues)) return leagues;
  const saved = new Map((snapshot?.division1 || []).map((item) => [item.id, item.memberIds]));
  return leagues.map((league) => {
    const savedIds = saved.get(Number(league.id)) || [];
    const currentIds = Array.isArray(league.memberIds) ? league.memberIds : [];
    const standingsIds = (league.standings || [])
      .map((standing) => standing.idolId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    // Prefer a populated independent snapshot. If it is empty or missing,
    // recover from the league's standings instead of silently showing 0/20.
    const memberIds = savedIds.length > 0
      ? [...savedIds]
      : currentIds.length > 0
        ? [...currentIds]
        : Array.from(new Set(standingsIds));
    return memberIds.length > 0 ? { ...league, memberIds } : league;
  });
}

export function restoreDivisionTwoRoster<T extends { id: number; memberIds: string[] }>(
  leagues: T[] | null | undefined,
  snapshot: RosterSnapshot | null
): T[] | null | undefined {
  if (!Array.isArray(leagues)) return leagues;
  const saved = new Map((snapshot?.division2 || []).map((item) => [item.id, item.memberIds]));
  return leagues.map((league) => {
    const savedIds = saved.get(Number(league.id)) || [];
    const currentIds = Array.isArray(league.memberIds) ? league.memberIds : [];
    // An empty snapshot must not erase a populated V5 state during recovery.
    const memberIds = savedIds.length > 0 ? [...savedIds] : [...currentIds];
    return memberIds.length > 0 ? { ...league, memberIds } : league;
  });
}
