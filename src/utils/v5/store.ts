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
