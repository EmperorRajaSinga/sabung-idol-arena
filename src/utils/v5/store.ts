import type { DivisionTwoLeague, BNode, LeagueCupState, PromotionMove } from './engine';
export interface V5TitleArchive { id: string; seasonNumber: number; seasonName: string; competition: string; winnerId: string; winnerName: string; winnerGroup: string; winnerPhoto?: string; runnerUpId?: string; runnerUpName?: string; runnerUpGroup?: string; runnerUpPhoto?: string; isDivision: boolean; archivedAt: string; }
export interface V5PromotionHistoryEntry { seasonNumber: number; seasonName: string; appliedAt: string; moves: PromotionMove[]; }
export interface V5State {
  d2: DivisionTwoLeague[]; perLeague: number; promotionCount: number; pendingMoves: PromotionMove[] | null;
  promotionHistory?: V5PromotionHistoryEntry[];
  champsCup: { matches: BNode[]; byeIds: string[] } | null; leagueCup: LeagueCupState | null;
  miniCups: Record<string, BNode[]>; superA: BNode | null; superB: BNode[];
}
export const emptyV5 = (): V5State => ({ d2: [], perLeague: 20, promotionCount: 3, pendingMoves: null, promotionHistory: [], champsCup: null, leagueCup: null, miniCups: {}, superA: null, superB: [] });
const KEY = 'sabung_v5_state_v1';
export function hasStoredV5State(): boolean { try { return localStorage.getItem(KEY) !== null; } catch { return false; } }
export function loadV5State(): V5State {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...emptyV5(), ...JSON.parse(raw) } : emptyV5(); } catch { return emptyV5(); }
}
export function saveV5State(s: V5State): boolean { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; } }
