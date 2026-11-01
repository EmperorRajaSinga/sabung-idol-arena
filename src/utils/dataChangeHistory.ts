export type DataHistoryAction = 'created' | 'updated' | 'deleted' | 'roster_updated' | 'imported' | 'duplicate_blocked';
export type DataHistoryEntity = 'idol' | 'girl_group' | 'division_1_roster' | 'division_2_roster' | 'league_branding' | 'database_import';

export interface DataHistoryEntry {
  id: string;
  timestamp: string;
  action: DataHistoryAction;
  entity: DataHistoryEntity;
  entityName: string;
  source: string;
  details: string;
}

const HISTORY_KEY = 'sabung_data_change_history_v1';
const HISTORY_LIMIT = 5000;

/**
 * Normalizes names for duplicate checks. Unicode accents, punctuation, repeated
 * whitespace, and letter casing do not create separate identities.
 */
export function normalizeDataName(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function loadDataHistory(): DataHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordDataHistory(
  entry: Omit<DataHistoryEntry, 'id' | 'timestamp'> & { timestamp?: string }
): DataHistoryEntry | null {
  try {
    const history = loadDataHistory();
    const record: DataHistoryEntry = {
      ...entry,
      id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    history.unshift(record);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    return record;
  } catch {
    return null;
  }
}

export function clearDataHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Storage may be unavailable or blocked by the browser.
  }
}

export interface RosterLocation {
  division: 'Division 1' | 'Division 2';
  leagueId: number;
  leagueName: string;
}

export interface RosterConflict {
  name: string;
  locations: RosterLocation[];
  reason: 'already_assigned' | 'duplicate_in_input';
}

export function findRosterNameConflicts(
  names: string[],
  target: RosterLocation,
  existing: Array<{ name: string; location: RosterLocation }>,
): RosterConflict[] {
  const byName = new Map<string, RosterLocation[]>();
  existing.forEach(({ name, location }) => {
    const key = normalizeDataName(name);
    if (!key) return;
    const locations = byName.get(key) || [];
    locations.push(location);
    byName.set(key, locations);
  });

  const conflicts: RosterConflict[] = [];
  const seenInput = new Set<string>();
  names.forEach((name) => {
    const key = normalizeDataName(name);
    if (!key) return;
    if (seenInput.has(key)) {
      conflicts.push({ name, locations: [target], reason: 'duplicate_in_input' });
      return;
    }
    seenInput.add(key);
    const locations = byName.get(key) || [];
    const otherLocations = locations.filter(
      (location) => location.division !== target.division || location.leagueId !== target.leagueId
    );
    if (otherLocations.length) {
      conflicts.push({ name, locations: otherLocations, reason: 'already_assigned' });
    }
  });
  return conflicts;
}

function getChangedFields(before: Record<string, any>, after: Record<string, any>): string[] {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return Array.from(keys).filter((key) => {
    if (key === 'updatedAt') return false;
    return JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]);
  });
}

export function auditAppStateDataChanges(
  previous: { idols?: any[]; girlGroups?: any[] },
  next: { idols?: any[]; girlGroups?: any[] },
  source: string,
): void {
  const compare = (
    before: any[],
    after: any[],
    entity: 'idol' | 'girl_group',
    getName: (item: any) => string,
  ) => {
    const beforeMap = new Map(before.map((item) => [String(item.id), item]));
    const afterMap = new Map(after.map((item) => [String(item.id), item]));
    afterMap.forEach((item, id) => {
      const old = beforeMap.get(id);
      if (!old) {
        recordDataHistory({
          action: 'created',
          entity,
          entityName: getName(item),
          source,
          details: `New ${entity === 'idol' ? 'idol' : 'girl group'} added to the database.`,
        });
      } else {
        const changedFields = getChangedFields(old, item);
        if (!changedFields.length) return;
        const oldName = getName(old);
        const newName = getName(item);
        const renameNote = oldName !== newName ? ` Name changed from "${oldName}" to "${newName}".` : '';
        recordDataHistory({
          action: 'updated',
          entity,
          entityName: newName,
          source,
          details: `Updated fields: ${changedFields.join(', ')}.${renameNote}`,
        });
      }
    });
    beforeMap.forEach((item, id) => {
      if (!afterMap.has(id)) {
        recordDataHistory({
          action: 'deleted',
          entity,
          entityName: getName(item),
          source,
          details: `${entity === 'idol' ? 'Idol' : 'Girl group'} removed from the database.`,
        });
      }
    });
  };

  compare(previous.idols || [], next.idols || [], 'idol', (item) => item.name || item.id);
  compare(previous.girlGroups || [], next.girlGroups || [], 'girl_group', (item) => item.name || item.id);
}
