/** All competition names live here, so renaming never touches the logic. Owner can override in the UI (saved in localStorage). */
export interface CompetitionNames {
  division2: string; champsCup: string; leagueCup: string; miniCup: string; superCupA: string; superCupB: string;
}
export const DEFAULT_NAMES: CompetitionNames = {
  division2: 'Challenger Division', champsCup: 'Crown Cup', leagueCup: 'Open Arena Cup',
  miniCup: 'Spotlight Cup', superCupA: 'Supreme Cup', superCupB: 'Champions Shield',
};
const KEY = 'sabung_v5_names_v1';
export function loadNames(): CompetitionNames {
  try { const raw = localStorage.getItem(KEY); return { ...DEFAULT_NAMES, ...(raw ? JSON.parse(raw) : {}) }; } catch { return { ...DEFAULT_NAMES }; }
}
export function saveNames(n: CompetitionNames) { try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* ignore */ } }
