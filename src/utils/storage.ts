import {
  Idol,
  GirlGroup,
  TournamentConfig,
  Group,
  KnockoutMatch,
  ArchivedMatch,
  TournamentArchive,
  PersonalRankingEntry,
  LeagueSeasonState,
  LeagueSeasonArchive,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from '../types';
import { INITIAL_IDOLS, INITIAL_GIRL_GROUPS } from '../data/initialData';
import {
  loadPersonalRankings,
  savePersonalRankings,
  loadLeagueSeasonState,
  saveLeagueSeasonState,
  loadLeagueArchives,
  saveLeagueArchives,
  loadCustomLeagueBranding,
  saveCustomLeagueBranding,
  initializeLeagueSeason,
  DEFAULT_LEAGUE_DEFS,
  saveSavedTop32Qualifiers,
  LeagueBrandingItem,
} from './leagueLogic';
import {
  loadTheIdolsState,
  saveTheIdolsState,
  loadTheIdolsArchives,
  saveTheIdolsArchives,
  initializeTheIdolsSeason,
} from './theIdolsLogic';

const STORAGE_KEY = 'idol_tournament_app_v2';
const IDB_NAME = 'IdolTournamentDB';
const IDB_STORE = 'app_state_store';
const IDB_KEY = 'current_app_state';

export interface AppState {
  appLogoUrl?: string;
  idols: Idol[];
  girlGroups: GirlGroup[];
  config: TournamentConfig;
  selectedParticipantIds: string[];
  groups: Group[];
  knockoutMatches: KnockoutMatch[];
  matchDatabase: ArchivedMatch[];
  archives: TournamentArchive[];
  customNationalities?: string[];
  favoriteIdolIds?: string[];
  personalRankings?: PersonalRankingEntry[];
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  customLeagueBranding?: LeagueBrandingItem[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
}

export const DEFAULT_CONFIG: TournamentConfig = {
  seasonId: 1,
  seasonNumber: 1,
  seasonName: 'Season 1',
  totalParticipants: 64,
  numGroups: 16,
  participantsPerGroup: 4,
  qualifiedPerGroup: 2,
  isStarted: false,
  isGroupStageFinished: false,
  isKnockoutFinished: false,
  favoriteIdolIds: [],
};

export const DEFAULT_COUNTRIES = [
  'South Korea',
  'Japan',
  'China',
  'USA',
  'Australia',
  'Thailand',
  'Taiwan',
];

export const createDefaultState = (): AppState => {
  const defaultLeague = initializeLeagueSeason(INITIAL_IDOLS, INITIAL_GIRL_GROUPS, 1);
  const defaultTheIdols = initializeTheIdolsSeason(INITIAL_IDOLS, 1);
  return {
    idols: INITIAL_IDOLS,
    girlGroups: INITIAL_GIRL_GROUPS,
    config: { ...DEFAULT_CONFIG },
    selectedParticipantIds: [],
    groups: [],
    knockoutMatches: [],
    matchDatabase: [],
    archives: [],
    customNationalities: DEFAULT_COUNTRIES,
    favoriteIdolIds: [],
    leagueState: defaultLeague,
    leagueArchives: [],
    personalRankings: [],
    customLeagueBranding: DEFAULT_LEAGUE_DEFS,
    theIdolsState: defaultTheIdols,
    theIdolsArchives: [],
  };
};

export const DEFAULT_APP_STATE: AppState = createDefaultState();

// --- INDEXEDDB HELPER FOR ROBUST LARGE DATA STORAGE (PHOTOS, HISTORICAL MATCHES, ARCHIVES) ---
let idbSaveTimeout: any = null;
let isIdbSaveInProgress = false;
let pendingStateToSave: (AppState & { _savedAt?: number }) | null = null;
let idbInstancePromise: Promise<IDBDatabase> | null = null;

function openIndexedDB(): Promise<IDBDatabase> {
  if (idbInstancePromise) return idbInstancePromise;

  idbInstancePromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      idbInstancePromise = null;
      return reject(new Error('IndexedDB is not supported'));
    }

    try {
      const request = window.indexedDB.open(IDB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          idbInstancePromise = null;
        };
        db.onerror = () => {
          idbInstancePromise = null;
        };
        db.onversionchange = () => {
          db.close();
          idbInstancePromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        idbInstancePromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        idbInstancePromise = null;
        console.warn('IndexedDB database upgrade was blocked.');
      };
    } catch (err) {
      idbInstancePromise = null;
      reject(err);
    }
  });

  return idbInstancePromise;
}

/**
 * Safely sanitizes state into a clean, serializable plain object without circular references or non-cloneable objects.
 */
function sanitizeStateForIndexedDB(state: any): any {
  if (!state || typeof state !== 'object') return state;

  try {
    // Fast path: standard JSON serialization
    return JSON.parse(JSON.stringify(state));
  } catch {
    // Fallback path: cycle-safe JSON replacer
    try {
      const seen = new WeakSet();
      const cleanString = JSON.stringify(state, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return undefined;
          }
          seen.add(value);
        }
        if (typeof value === 'function' || typeof value === 'symbol') {
          return undefined;
        }
        return value;
      });
      return JSON.parse(cleanString);
    } catch (e) {
      console.warn('Error during state sanitization for IndexedDB:', e);
      return null;
    }
  }
}

/**
 * Executes a single atomic write transaction to IndexedDB with fallback serialization.
 */
async function executeIndexedDBSave(stateToSave: AppState & { _savedAt?: number }): Promise<void> {
  if (isIdbSaveInProgress) {
    pendingStateToSave = stateToSave;
    return;
  }

  isIdbSaveInProgress = true;
  try {
    const db = await openIndexedDB();
    const cleanState = sanitizeStateForIndexedDB(stateToSave);
    if (!cleanState) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);

        let req: IDBRequest | null = null;
        try {
          // Attempt standard structured clone put
          req = store.put(cleanState, IDB_KEY);
        } catch (cloneErr) {
          // If browser structured clone hits memory limit, store as stringified payload
          console.warn('Structured clone failed in IDB put, using string payload fallback:', cloneErr);
          try {
            const stringified = JSON.stringify(cleanState);
            req = store.put(stringified, IDB_KEY);
          } catch (stringErr) {
            console.warn('String fallback also failed in IDB put:', stringErr);
          }
        }

        if (req) {
          req.onsuccess = () => resolve();
          req.onerror = () => {
            console.warn('IndexedDB store.put request error:', req?.error);
            resolve();
          };
        } else {
          resolve();
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => {
          idbInstancePromise = null;
          console.warn('IndexedDB transaction error:', tx.error);
          resolve();
        };
        tx.onabort = () => {
          idbInstancePromise = null;
          console.warn('IndexedDB transaction aborted:', tx.error);
          resolve();
        };
      } catch (txErr) {
        console.warn('Failed to execute IndexedDB write transaction:', txErr);
        resolve();
      }
    });
  } catch (err) {
    console.warn('Failed to save to IndexedDB:', err);
  } finally {
    isIdbSaveInProgress = false;
    if (pendingStateToSave) {
      const nextToSave = pendingStateToSave;
      pendingStateToSave = null;
      setTimeout(() => {
        executeIndexedDBSave(nextToSave);
      }, 50);
    }
  }
}

/**
 * Debounced save to IndexedDB to prevent overwhelming the browser's structured clone buffer with rapid concurrent writes.
 */
export function saveAppStateToIndexedDB(state: AppState & { _savedAt?: number }, immediate: boolean = false): void {
  pendingStateToSave = state;

  if (idbSaveTimeout) {
    clearTimeout(idbSaveTimeout);
    idbSaveTimeout = null;
  }

  if (immediate) {
    if (pendingStateToSave) {
      const toSave = pendingStateToSave;
      pendingStateToSave = null;
      executeIndexedDBSave(toSave);
    }
  } else {
    idbSaveTimeout = setTimeout(() => {
      if (pendingStateToSave) {
        const toSave = pendingStateToSave;
        pendingStateToSave = null;
        executeIndexedDBSave(toSave);
      }
    }, 350);
  }
}

/**
 * Flushes any pending debounced writes to IndexedDB immediately.
 */
export function flushAppStateToIndexedDB(): void {
  if (idbSaveTimeout) {
    clearTimeout(idbSaveTimeout);
    idbSaveTimeout = null;
  }
  if (pendingStateToSave) {
    const toSave = pendingStateToSave;
    pendingStateToSave = null;
    executeIndexedDBSave(toSave);
  }
}

export async function loadAppStateFromIndexedDB(): Promise<AppState | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(IDB_KEY);

        req.onsuccess = () => {
          if (req.result) {
            try {
              let parsedResult = req.result;
              if (typeof parsedResult === 'string') {
                parsedResult = JSON.parse(parsedResult);
              }
              resolve(normalizeAppState(parsedResult));
            } catch (parseErr) {
              console.warn('Failed to parse state from IndexedDB result:', parseErr);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        req.onerror = () => {
          console.warn('Failed to read state from IndexedDB:', req.error);
          resolve(null);
        };
      } catch (txErr) {
        console.warn('Failed to start IndexedDB read transaction:', txErr);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn('Failed to load from IndexedDB:', err);
    return null;
  }
}

/**
 * Dynamically computes the true current active season and total completed seasons
 * based on all historical database archives, league records, and match logs.
 */
export function calculateCurrentSeasonNumber(
  archives: TournamentArchive[] = [],
  leagueArchives: LeagueSeasonArchive[] = [],
  theIdolsArchives: TheIdolsSeasonArchive[] = [],
  matchDatabase: ArchivedMatch[] = [],
  configSeasonNumber?: number,
  leagueState?: LeagueSeasonState | null,
  theIdolsState?: TheIdolsSeasonState | null
): {
  currentSeasonNumber: number;
  totalCompletedSeasons: number;
  allDistinctArchivedSeasons: number[];
} {
  const distinctArchivedSet = new Set<number>();
  (archives || []).forEach((a) => {
    const s = Number(a?.seasonId || 0);
    if (!Number.isNaN(s) && s > 0) distinctArchivedSet.add(s);
  });
  (leagueArchives || []).forEach((a) => {
    const s = Number(a?.seasonNumber || 0);
    if (!Number.isNaN(s) && s > 0) distinctArchivedSet.add(s);
  });
  (theIdolsArchives || []).forEach((a) => {
    const s = Number(a?.seasonNumber || 0);
    if (!Number.isNaN(s) && s > 0) distinctArchivedSet.add(s);
  });

  const allDistinctArchivedSeasons = Array.from(distinctArchivedSet).sort((a, b) => a - b);
  const totalCompletedSeasons = allDistinctArchivedSeasons.length;
  const maxArchivedSeason = allDistinctArchivedSeasons.length > 0 ? Math.max(...allDistinctArchivedSeasons) : 0;

  const matchSeasonIds = Array.from(
    new Set((matchDatabase || []).map((m) => Number(m?.seasonId || 0)).filter((s) => !Number.isNaN(s) && s > 0))
  );
  const maxMatchSeason = matchSeasonIds.length > 0 ? Math.max(...matchSeasonIds) : 0;

  const activeCandidates = [
    Number(configSeasonNumber || 0),
    Number(leagueState?.seasonNumber || 0),
    Number(theIdolsState?.seasonNumber || 0),
    maxMatchSeason,
  ].filter((s) => !Number.isNaN(s) && s > 0);

  const highestActiveCandidate = activeCandidates.length > 0 ? Math.max(...activeCandidates) : 1;
  const currentSeasonNumber = Math.max(highestActiveCandidate, maxArchivedSeason + 1, 1);

  return {
    currentSeasonNumber,
    totalCompletedSeasons,
    allDistinctArchivedSeasons,
  };
}

/**
 * Normalizes an arbitrary app state object to ensure every expected field exists and has the right type.
 */
export function normalizeAppState(raw: any): AppState {
  const defaults = createDefaultState();
  if (!raw || typeof raw !== 'object') return defaults;

  const safeArray = <T>(value: any, fallback: T[] = []): T[] => Array.isArray(value) ? value : fallback;

  const normalized: AppState = {
    ...defaults,
    ...raw,
    idols: safeArray<Idol>(raw.idols, defaults.idols),
    girlGroups: safeArray<GirlGroup>(raw.girlGroups, defaults.girlGroups),
    config: raw.config && typeof raw.config === 'object' ? { ...defaults.config, ...raw.config } : defaults.config,
    selectedParticipantIds: safeArray<string>(raw.selectedParticipantIds),
    groups: safeArray<Group>(raw.groups),
    knockoutMatches: safeArray<KnockoutMatch>(raw.knockoutMatches),
    matchDatabase: safeArray<ArchivedMatch>(raw.matchDatabase),
    archives: safeArray<TournamentArchive>(raw.archives),
    customNationalities: safeArray<string>(raw.customNationalities, defaults.customNationalities),
    favoriteIdolIds: safeArray<string>(raw.favoriteIdolIds),
    personalRankings: safeArray<PersonalRankingEntry>(raw.personalRankings),
    leagueArchives: safeArray<LeagueSeasonArchive>(raw.leagueArchives),
    customLeagueBranding: safeArray<LeagueBrandingItem>(raw.customLeagueBranding, defaults.customLeagueBranding),
    theIdolsArchives: safeArray<TheIdolsSeasonArchive>(raw.theIdolsArchives),
  };

  try {
    normalized.leagueState = raw.leagueState && typeof raw.leagueState === 'object'
      ? raw.leagueState
      : loadLeagueSeasonState() || defaults.leagueState;
  } catch {
    normalized.leagueState = defaults.leagueState;
  }

  try {
    normalized.theIdolsState = raw.theIdolsState && typeof raw.theIdolsState === 'object'
      ? raw.theIdolsState
      : loadTheIdolsState() || defaults.theIdolsState;
  } catch {
    normalized.theIdolsState = defaults.theIdolsState;
  }

  return normalized;
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_STATE;

    const parsed = JSON.parse(raw);
    return normalizeAppState(parsed);
  } catch (e) {
    console.warn('Failed to load app state from localStorage:', e);
    return DEFAULT_APP_STATE;
  }
}

export function saveAppState(state: AppState): void {
  try {
    const stateToSave = {
      ...state,
      _savedAt: Date.now(),
    };
    const serialized = JSON.stringify(stateToSave);
    localStorage.setItem(STORAGE_KEY, serialized);

    // Keep IndexedDB in sync for large data
    saveAppStateToIndexedDB(stateToSave);
  } catch (e) {
    console.warn('Failed to save app state to localStorage:', e);
  }
}

// --- INITIALIZATION & BACKWARD COMPATIBILITY ---
export function migrateOldData(): void {
  try {
    const oldKeys = ['idol_tournament_app', 'tournament_app_data', 'idol_app_state'];
    for (const oldKey of oldKeys) {
      const oldData = localStorage.getItem(oldKey);
      if (oldData && !localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, oldData);
        console.info(`Migrated legacy data from ${oldKey}`);
        break;
      }
    }
  } catch (e) {
    console.warn('Data migration error:', e);
  }
}

// --- GLOBAL SEASON NUMBER HELPERS ---
export function getGlobalSeasonNumber(state: AppState): number {
  const stats = calculateCurrentSeasonNumber(
    state.archives,
    state.leagueArchives || [],
    state.theIdolsArchives || [],
    state.matchDatabase,
    state.config?.seasonNumber,
    state.leagueState,
    state.theIdolsState
  );
  return stats.currentSeasonNumber;
}

export function getTotalCompletedSeasons(state: AppState): number {
  return calculateCurrentSeasonNumber(
    state.archives,
    state.leagueArchives || [],
    state.theIdolsArchives || [],
    state.matchDatabase,
    state.config?.seasonNumber,
    state.leagueState,
    state.theIdolsState
  ).totalCompletedSeasons;
}
