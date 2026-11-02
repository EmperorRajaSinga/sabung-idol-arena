import type { DivisionTwoLeague, BNode, LeagueCupState, PromotionMove } from './engine';
export interface V5TitleArchive { id: string; seasonNumber: number; seasonName: string; competition: string; winnerId: string; winnerName: string; winnerGroup: string; winnerPhoto?: string; runnerUpId?: string; runnerUpName?: string; runnerUpGroup?: string; runnerUpPhoto?: string; isDivision: boolean; archivedAt: string; }
export interface V5PromotionHistoryEntry { seasonNumber: number; seasonName: string; appliedAt: string; moves: PromotionMove[]; }
export interface V5State {
  d2: DivisionTwoLeague[]; perLeague: number; promotionCount: number; pendingMoves: PromotionMove[] | null;
  promotionHistory?: V5PromotionHistoryEntry[];
  champsCup: { matches: BNode[]; byeIds: string[]; seedOrder?: string[] } | null; leagueCup: LeagueCupState | null;
  miniCups: Record<string, BNode[]>; superA: BNode | null; superB: BNode[];
}
export const emptyV5 = (): V5State => ({ d2: [], perLeague: 20, promotionCount: 3, pendingMoves: null, promotionHistory: [], champsCup: null, leagueCup: null, miniCups: {}, superA: null, superB: [] });

// PERSISTENCE CONTRACT: user-entered data must survive refresh. Keep the primary
// key and a recovery copy in sync synchronously. Never treat a failed write as saved.
const KEY = 'sabung_v5_state_v1';
const BACKUP_KEY = 'sabung_v5_state_backup_v1';
function parseState(raw: string | null): V5State | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.d2)) return null;
    return { ...emptyV5(), ...parsed };
  } catch {
    return null;
  }
}
export function hasStoredV5State(): boolean {
  try { return Boolean(parseState(localStorage.getItem(KEY)) || parseState(localStorage.getItem(BACKUP_KEY))); }
  catch { return false; }
}
export function loadV5State(): V5State {
  try {
    const primary = parseState(localStorage.getItem(KEY));
    const backup = parseState(localStorage.getItem(BACKUP_KEY));
    const primaryRevision = Number((primary as any)?.updatedAt || 0);
    const backupRevision = Number((backup as any)?.updatedAt || 0);
    const selected = backup && (!primary || backupRevision > primaryRevision) ? backup : primary || backup;
    if (!selected) return emptyV5();
    if (selected !== primary) {
      // Repair the primary key from the newest valid recovery copy.
      try { localStorage.setItem(KEY, JSON.stringify(selected)); } catch { /* backup remains available */ }
    }
    return selected;
  } catch { return emptyV5(); }
}
export function saveV5State(s: V5State): boolean {
  let serialized: string;
  try { serialized = JSON.stringify({ ...s, updatedAt: Date.now() }); } catch { return false; }

  // Keep one full V5 snapshot only. A second full copy consumed too much localStorage
  // quota and could make both copies fail. Roster membership now has its own compact,
  // independent recovery store in rosterPersistence.ts. BACKUP_KEY remains readable
  // only for migration from older versions.
  try {
    localStorage.setItem(KEY, serialized);
    // Once the current primary write succeeds, release the legacy duplicate full-state
    // backup. The compact independent roster snapshot is the recovery path for rosters.
    try { localStorage.removeItem(BACKUP_KEY); } catch { /* the primary save already succeeded */ }
    return true;
  } catch {
    console.error('[Persistence] Full V5 snapshot could not fit in localStorage. The independent roster snapshot remains available.');
    return false;
  }
}


/**
 * Independent permanent history for V5 career records.
 * Active brackets live in sabung_v5_state_v1; completed match logs and title
 * records must not depend on the size/quota behavior of the main app snapshot.
 */
import type { ArchivedMatch } from '../../types';
export interface V5CareerArchive {
  matches: ArchivedMatch[];
  titles: V5TitleArchive[];
  updatedAt: number;
}
const CAREER_ARCHIVE_KEY = 'sabung_v5_career_archive_v1';
export function loadV5CareerArchive(): V5CareerArchive {
  try {
    const raw = localStorage.getItem(CAREER_ARCHIVE_KEY);
    if (!raw) return { matches: [], titles: [], updatedAt: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { matches: [], titles: [], updatedAt: 0 };
    return {
      matches: Array.isArray(parsed.matches) ? parsed.matches : [],
      titles: Array.isArray(parsed.titles) ? parsed.titles : [],
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch {
    return { matches: [], titles: [], updatedAt: 0 };
  }
}
export function saveV5CareerArchive(matches: ArchivedMatch[], titles: V5TitleArchive[]): boolean {
  try {
    const current = loadV5CareerArchive();
    const matchMap = new Map<string, ArchivedMatch>();
    [...current.matches, ...(matches || [])].forEach((match) => {
      if (!match?.matchId || !String(match.stage || '').toLowerCase().startsWith('cups & divisions:')) return;
      // Base64 portraits are already retained in the full IndexedDB AppState.
      // Keep the localStorage recovery copy compact to avoid quota failures.
      matchMap.set(match.matchId, {
        ...match,
        idolAPhoto: undefined,
        idolBPhoto: undefined,
      });
    });
    const titleMap = new Map<string, V5TitleArchive>();
    [...current.titles, ...(titles || [])].forEach((title) => {
      if (title?.id) titleMap.set(title.id, title);
    });
    const payload: V5CareerArchive = {
      matches: Array.from(matchMap.values()),
      titles: Array.from(titleMap.values()).map((title) => ({
        ...title,
        winnerPhoto: undefined,
        runnerUpPhoto: undefined,
      })),
      updatedAt: Date.now(),
    };
    localStorage.setItem(CAREER_ARCHIVE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('[V5 Career Archive] Permanent history save failed:', error);
    return false;
  }
}
