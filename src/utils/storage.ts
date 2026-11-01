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
import { loadV5State, saveV5State, hasStoredV5State } from './v5/store';
import type { V5State, V5TitleArchive } from './v5/store';
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
  v5State?: V5State;
  v5TitleArchives?: V5TitleArchive[];
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
    v5State: loadV5State(),
    v5TitleArchives: [],
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

  let currentSeasonNumber = 1;
  if (maxArchivedSeason > 0) {
    if (highestActiveCandidate <= maxArchivedSeason) {
      currentSeasonNumber = maxArchivedSeason + 1;
    } else {
      currentSeasonNumber = highestActiveCandidate;
    }
  } else {
    currentSeasonNumber = Math.max(1, highestActiveCandidate);
  }

  return {
    currentSeasonNumber,
    totalCompletedSeasons,
    allDistinctArchivedSeasons,
  };
}

// Normalizes state object to ensure all required fields exist
export function normalizeAppState(parsed: any, isFullRestore: boolean = false): AppState {
  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_APP_STATE;
  }

  const parsedConfig = parsed.config || {};
  const configSeasonId = Number(parsedConfig.seasonId || parsedConfig.seasonNumber || DEFAULT_CONFIG.seasonId);
  const config: TournamentConfig = {
    ...DEFAULT_CONFIG,
    ...parsedConfig,
    seasonId: Number.isNaN(configSeasonId) || configSeasonId < 1 ? 1 : configSeasonId,
    seasonNumber: Number.isNaN(configSeasonId) || configSeasonId < 1 ? 1 : configSeasonId,
    seasonName:
      parsedConfig.seasonName ||
      `Season ${configSeasonId}`,
  };

  const matchDatabase: ArchivedMatch[] = (parsed.matchDatabase || []).map((m: any, idx: number) => {
    const sId = Number(m.seasonId || 1);
    return {
      ...m,
      matchId: m.matchId || `match-${sId}-${idx}-${Date.now()}`,
      seasonId: Number.isNaN(sId) ? 1 : sId,
      seasonName: m.seasonName || `Season ${sId}`,
      idolAName: m.idolAName || 'Unknown',
      idolBName: m.idolBName || 'Unknown',
      winnerName: m.winnerName || '',
    };
  });

  let archives: TournamentArchive[] = (parsed.archives || []).map((a: any) => {
    const sId = Number(a.seasonId || 1);
    return {
      ...a,
      seasonId: Number.isNaN(sId) ? 1 : sId,
      seasonName: a.seasonName || `Season ${sId}`,
      groups: Array.isArray(a.groups) ? a.groups : [],
      knockoutMatches: Array.isArray(a.knockoutMatches) ? a.knockoutMatches : [],
    };
  });
  if (!isFullRestore) {
    const fallbackArch = loadTournamentArchives();
    if (fallbackArch && fallbackArch.length > 0) {
      const archMap = new Map<number, TournamentArchive>();
      fallbackArch.forEach((a) => {
        if (a && a.seasonId) archMap.set(Number(a.seasonId), a);
      });
      archives.forEach((a) => {
        if (a && a.seasonId) {
          const existing = archMap.get(Number(a.seasonId));
          archMap.set(Number(a.seasonId), { ...existing, ...a });
        }
      });
      archives = Array.from(archMap.values()).sort((a, b) => Number(a.seasonId) - Number(b.seasonId));
    }
  }

  // Preserve all idols, ensuring valid fields, inactive status, and ratings
  const rawIdols: Idol[] = Array.isArray(parsed.idols) && parsed.idols.length > 0 ? parsed.idols : INITIAL_IDOLS;
  const idols: Idol[] = rawIdols.map((i, idx) => ({
    id: i.id || `idol-${idx}-${Date.now()}`,
    name: i.name || `Idol ${idx + 1}`,
    girlGroup: i.girlGroup || 'Solo / Independent',
    seed: i.seed || 'Seed 3',
    nationality: i.nationality || 'South Korea',
    photoUrl: i.photoUrl || '',
    createdAt: i.createdAt || Date.now(),
    inactive: i.inactive === true || String(i.inactive).toLowerCase() === 'true' || (i.inactive as any) === 1,
    rating:
      typeof i.rating === 'number' && !Number.isNaN(i.rating)
        ? Math.max(0, Math.min(100, Math.round(i.rating)))
        : undefined,
  }));

  const rawGroups: GirlGroup[] = Array.isArray(parsed.girlGroups) && parsed.girlGroups.length > 0
    ? parsed.girlGroups
    : INITIAL_GIRL_GROUPS;
  const girlGroups: GirlGroup[] = rawGroups.map((g, idx) => ({
    id: g.id || `group-${idx}-${Date.now()}`,
    name: g.name || `Group ${idx + 1}`,
    logoUrl: g.logoUrl || '',
    members: Array.isArray(g.members) ? g.members : [],
    inactive: g.inactive === true || String(g.inactive).toLowerCase() === 'true' || (g.inactive as any) === 1,
  }));

  const customNationalities: string[] = Array.isArray(parsed.customNationalities) && parsed.customNationalities.length > 0
    ? Array.from(new Set([...DEFAULT_COUNTRIES, ...parsed.customNationalities]))
    : DEFAULT_COUNTRIES;

  const favoriteIdolIds: string[] = Array.isArray(parsed.favoriteIdolIds)
    ? parsed.favoriteIdolIds.slice(0, 2)
    : Array.isArray(parsed.config?.favoriteIdolIds)
    ? parsed.config.favoriteIdolIds.slice(0, 2)
    : [];

  // Restore personal rankings if included in backup
  let personalRankings: PersonalRankingEntry[] = [];
  if (Array.isArray(parsed.personalRankings) && parsed.personalRankings.length > 0) {
    personalRankings = parsed.personalRankings;
    if (isFullRestore) savePersonalRankings(personalRankings);
  } else if (Array.isArray(parsed.personalIdolRankings) && parsed.personalIdolRankings.length > 0) {
    personalRankings = parsed.personalIdolRankings;
    if (isFullRestore) savePersonalRankings(personalRankings);
  } else {
    personalRankings = loadPersonalRankings();
  }

  // Restore custom league branding
  let customLeagueBranding: LeagueBrandingItem[] = DEFAULT_LEAGUE_DEFS;
  if (Array.isArray(parsed.customLeagueBranding) && parsed.customLeagueBranding.length > 0) {
    customLeagueBranding = parsed.customLeagueBranding;
    if (isFullRestore) saveCustomLeagueBranding(customLeagueBranding);
  } else {
    customLeagueBranding = loadCustomLeagueBranding();
  }

  // Restore league state and archives
  let leagueState: LeagueSeasonState | null = null;
  let leagueArchives: LeagueSeasonArchive[] = [];

  const incomingLeagueState = parsed.leagueState || parsed.leagueSeasonState;
  if (incomingLeagueState && typeof incomingLeagueState === 'object' && Array.isArray(incomingLeagueState.leagues)) {
    leagueState = incomingLeagueState;
    if (isFullRestore) saveLeagueSeasonState(leagueState);
  } else {
    leagueState = isFullRestore
      ? initializeLeagueSeason(idols, girlGroups, config.seasonId || 1)
      : (loadLeagueSeasonState() || initializeLeagueSeason(idols, girlGroups, config.seasonId || 1));
    if (isFullRestore && leagueState) saveLeagueSeasonState(leagueState);
  }

  if (Array.isArray(parsed.leagueArchives)) {
    leagueArchives = parsed.leagueArchives;
    if (isFullRestore) saveLeagueArchives(leagueArchives);
  } else {
    leagueArchives = isFullRestore ? [] : loadLeagueArchives();
    if (isFullRestore) saveLeagueArchives([]);
  }

  // Restore The Idols state and archives
  let theIdolsState: TheIdolsSeasonState | null = null;
  let theIdolsArchives: TheIdolsSeasonArchive[] = [];

  const incomingTheIdolsState = parsed.theIdolsState || parsed.theIdolsSeasonState;
  if (incomingTheIdolsState && typeof incomingTheIdolsState === 'object' && Array.isArray(incomingTheIdolsState.matches)) {
    theIdolsState = incomingTheIdolsState;
    if (isFullRestore) saveTheIdolsState(theIdolsState);
  } else {
    theIdolsState = isFullRestore
      ? initializeTheIdolsSeason(idols, config.seasonId || 1, girlGroups)
      : (loadTheIdolsState() || initializeTheIdolsSeason(idols, config.seasonId || 1, girlGroups));
    if (isFullRestore && theIdolsState) saveTheIdolsState(theIdolsState);
  }

  if (Array.isArray(parsed.theIdolsArchives)) {
    theIdolsArchives = parsed.theIdolsArchives;
    if (isFullRestore) saveTheIdolsArchives(theIdolsArchives);
  } else {
    theIdolsArchives = isFullRestore ? [] : loadTheIdolsArchives();
    if (isFullRestore) saveTheIdolsArchives([]);
  }

  // Dynamically synchronize active season count with actual database reality
  const { currentSeasonNumber } = calculateCurrentSeasonNumber(
    archives,
    leagueArchives,
    theIdolsArchives,
    matchDatabase,
    config.seasonNumber,
    leagueState,
    theIdolsState
  );

  const resolvedSeasonName =
    config.seasonName &&
    !config.seasonName.toLowerCase().startsWith('season ') &&
    config.seasonName.trim() !== ''
      ? config.seasonName
      : `Season ${currentSeasonNumber}`;

  config.seasonNumber = currentSeasonNumber;
  config.seasonId = currentSeasonNumber;
  config.seasonName = resolvedSeasonName;

  if (leagueState && (leagueState.seasonNumber < currentSeasonNumber || !leagueState.seasonNumber)) {
    leagueState = {
      ...leagueState,
      seasonNumber: currentSeasonNumber,
      seasonName: resolvedSeasonName,
    };
  }

  if (theIdolsState && (theIdolsState.seasonNumber < currentSeasonNumber || !theIdolsState.seasonNumber)) {
    theIdolsState = {
      ...theIdolsState,
      seasonNumber: currentSeasonNumber,
      seasonName: `The Idols: ${resolvedSeasonName}`,
    };
  }

  const normalized: AppState & { _savedAt?: number } = {
    appLogoUrl: parsed.appLogoUrl || '',
    idols,
    girlGroups,
    config: {
      ...config,
      favoriteIdolIds,
    },
    selectedParticipantIds: Array.isArray(parsed.selectedParticipantIds) ? parsed.selectedParticipantIds : [],
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    knockoutMatches: Array.isArray(parsed.knockoutMatches) ? parsed.knockoutMatches : [],
    matchDatabase,
    archives,
    customNationalities,
    favoriteIdolIds,
    personalRankings,
    leagueState,
    leagueArchives,
    customLeagueBranding,
    theIdolsState,
    theIdolsArchives,
    // The dedicated V5 key is written synchronously after every competition edit, so prefer it over a possibly older main snapshot.
    v5State: hasStoredV5State() ? loadV5State() : (parsed.v5State && typeof parsed.v5State === 'object' ? parsed.v5State as V5State : loadV5State()),
    _savedAt: typeof parsed._savedAt === 'number' ? parsed._savedAt : Date.now(),
  };

  return normalized;
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_STATE;
    const parsed = JSON.parse(raw);
    return normalizeAppState(parsed, false);
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return DEFAULT_APP_STATE;
  }
}

/**
 * Safely compacts tournament archives for localStorage persistence without losing ANY season.
 * Recent seasons (last 3) retain full groups and knockout bracket data for interactive inspection.
 * Older historical seasons retain all championship, podium, and metadata records while stripping heavy match payload.
 */
export function compactArchivesForStorage(archives: TournamentArchive[]): TournamentArchive[] {
  if (!Array.isArray(archives)) return [];
  const total = archives.length;
  return archives.map((a, idx) => {
    if (!a) return a;
    const isRecent = idx >= total - 3;
    if (isRecent) return a;
    return {
      seasonId: Number(a.seasonId || 1),
      seasonName: a.seasonName || `Season ${a.seasonId || 1}`,
      completedAt: a.completedAt || new Date().toISOString(),
      championId: a.championId || '',
      championName: a.championName || 'Unknown',
      runnerUpId: a.runnerUpId || '',
      runnerUpName: a.runnerUpName || 'Unknown',
      thirdPlaceId: a.thirdPlaceId || '',
      thirdPlaceName: a.thirdPlaceName || 'Unknown',
      fourthPlaceId: a.fourthPlaceId || '',
      fourthPlaceName: a.fourthPlaceName || 'Unknown',
      totalParticipants: a.totalParticipants || 64,
      numGroups: a.numGroups,
      qualifiedPerGroup: a.qualifiedPerGroup,
      groups: [],
      knockoutMatches: [],
    };
  });
}

export function compactLeagueArchivesForStorage(archives: LeagueSeasonArchive[]): LeagueSeasonArchive[] {
  if (!Array.isArray(archives)) return [];
  const total = archives.length;
  return archives.map((a, idx) => {
    if (!a) return a;
    const isRecent = idx >= total - 2;
    if (isRecent) return a;
    return {
      ...a,
      seasonNumber: a.seasonNumber,
      seasonName: a.seasonName || `Season ${a.seasonNumber}`,
      completedAt: a.completedAt,
      leagueWinners: a.leagueWinners || [],
      allStandings: a.allStandings || {},
      allMatches: [], // Compact: empty matches for older seasons in localStorage
      top32Qualifiers: a.top32Qualifiers || [],
    };
  });
}

export function compactTheIdolsArchivesForStorage(archives: TheIdolsSeasonArchive[]): TheIdolsSeasonArchive[] {
  if (!Array.isArray(archives)) return [];
  const total = archives.length;
  return archives.map((a, idx) => {
    if (!a) return a;
    const isRecent = idx >= total - 2;
    if (isRecent) return a;
    return {
      ...a,
      seasonNumber: a.seasonNumber,
      seasonName: a.seasonName || `The Idols Season ${a.seasonNumber}`,
      completedAt: a.completedAt,
      memberIds: a.memberIds || [],
      standings: a.standings || [],
      matches: [], // Compact: empty round-robin matches for older seasons in localStorage
      playoffMatches: a.playoffMatches || [],
      totalMatches: a.totalMatches || 0,
      totalGoals: a.totalGoals || 0,
    };
  });
}

/**
 * Safely saves app state to localStorage with intelligent multi-tiered compaction to respect browser storage quotas (~5MB).
 * Full fidelity data (including all base64 photos, complete match histories, and deep archives) is reliably saved to IndexedDB.
 */
function saveToLocalStorageSafely(fullState: AppState & { _savedAt: number }): void {
  // Always compact archives for localStorage so ALL seasons are permanently preserved without exceeding quota
  const compactedArchives = compactArchivesForStorage(fullState.archives || []);
  const compactedLeagueArchives = compactLeagueArchivesForStorage(fullState.leagueArchives || []);
  const compactedTheIdolsArchives = compactTheIdolsArchivesForStorage(fullState.theIdolsArchives || []);

  const baseState = {
    ...fullState,
    archives: compactedArchives,
    leagueArchives: compactedLeagueArchives,
    theIdolsArchives: compactedTheIdolsArchives,
  };

  // Tier 0: Attempt full save with compacted archives
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseState));
    return;
  } catch {
    // Quota exceeded on full state, proceed to tiered compaction
  }

  // Tier 1: Strip large base64/data URIs (> 400 chars) from idol photos, group logos, and app logo
  try {
    const tier1State = {
      ...baseState,
      idols: baseState.idols.map((i) => ({
        ...i,
        photoUrl: i.photoUrl && i.photoUrl.length > 400 ? '' : i.photoUrl,
      })),
      girlGroups: baseState.girlGroups.map((g) => ({
        ...g,
        logoUrl: g.logoUrl && g.logoUrl.length > 400 ? '' : g.logoUrl,
      })),
      appLogoUrl: baseState.appLogoUrl && baseState.appLogoUrl.length > 400 ? '' : baseState.appLogoUrl,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tier1State));
    return;
  } catch {
    // Tier 1 still exceeded quota
  }

  // Tier 2: Strip large images + prune matchDatabase (keep latest 100 matches) but KEEP ALL COMPACTED ARCHIVES!
  try {
    const tier2State = {
      ...baseState,
      idols: baseState.idols.map((i) => ({
        ...i,
        photoUrl: i.photoUrl && i.photoUrl.length > 400 ? '' : i.photoUrl,
      })),
      girlGroups: baseState.girlGroups.map((g) => ({
        ...g,
        logoUrl: g.logoUrl && g.logoUrl.length > 400 ? '' : g.logoUrl,
      })),
      appLogoUrl: baseState.appLogoUrl && baseState.appLogoUrl.length > 400 ? '' : baseState.appLogoUrl,
      matchDatabase: (baseState.matchDatabase || []).slice(-100),
      archives: compactedArchives, // Keep ALL seasons!
      leagueArchives: compactedLeagueArchives, // Keep ALL seasons!
      theIdolsArchives: compactedTheIdolsArchives, // Keep ALL seasons!
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tier2State));
    return;
  } catch {
    // Tier 2 still exceeded quota
  }

  // Tier 3: Compact down to essential workspace metadata, STILL PRESERVING ALL ARCHIVES
  try {
    const tier3State = {
      idols: baseState.idols.map((i) => ({
        id: i.id,
        name: i.name,
        girlGroup: i.girlGroup,
        seed: i.seed,
        nationality: i.nationality,
        inactive: i.inactive,
      })),
      girlGroups: baseState.girlGroups.map((g) => ({
        id: g.id,
        name: g.name,
        members: g.members,
        inactive: g.inactive,
      })),
      config: baseState.config,
      selectedParticipantIds: baseState.selectedParticipantIds,
      groups: baseState.groups,
      knockoutMatches: baseState.knockoutMatches,
      matchDatabase: (baseState.matchDatabase || []).slice(-30),
      archives: compactedArchives, // Always keep all seasons!
      customNationalities: baseState.customNationalities,
      favoriteIdolIds: baseState.favoriteIdolIds,
      personalRankings: baseState.personalRankings,
      customLeagueBranding: baseState.customLeagueBranding,
      leagueState: baseState.leagueState,
      leagueArchives: compactedLeagueArchives,
      theIdolsState: baseState.theIdolsState,
      theIdolsArchives: compactedTheIdolsArchives,
      v5State: baseState.v5State,
      v5TitleArchives: baseState.v5TitleArchives || [],
      _savedAt: baseState._savedAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tier3State));
    return;
  } catch {
    // Tier 3 still exceeded quota; proceed to Tier 4 emergency compaction
  }

  // Tier 4: Emergency fallback if localStorage quota is tight:
  // Prune older completed league matches (retain current matchday & standings) while strictly preserving ALL compacted archives and season config
  try {
    const compactedActiveLeagueState = baseState.leagueState
      ? {
          ...baseState.leagueState,
          leagues: (baseState.leagueState.leagues || []).map((l: any) => ({
            ...l,
            matches: (l.matches || []).filter(
              (m: any) => !m.completed || Number(m.matchday || 1) >= Number(l.currentMatchday || 1)
            ),
          })),
        }
      : null;

    const tier4State = {
      idols: baseState.idols.map((i) => ({
        id: i.id,
        name: i.name,
        girlGroup: i.girlGroup,
        seed: i.seed,
        nationality: i.nationality,
        inactive: i.inactive,
      })),
      girlGroups: baseState.girlGroups.map((g) => ({
        id: g.id,
        name: g.name,
        members: g.members,
        inactive: g.inactive,
      })),
      config: baseState.config,
      selectedParticipantIds: baseState.selectedParticipantIds,
      groups: baseState.groups,
      knockoutMatches: baseState.knockoutMatches,
      matchDatabase: (baseState.matchDatabase || []).slice(-15),
      archives: compactedArchives, // Always strictly preserve all seasons!
      leagueArchives: compactedLeagueArchives,
      theIdolsArchives: compactedTheIdolsArchives,
      leagueState: compactedActiveLeagueState,
      theIdolsState: baseState.theIdolsState,
      v5State: baseState.v5State,
      v5TitleArchives: baseState.v5TitleArchives || [],
      _savedAt: baseState._savedAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tier4State));
  } catch {
    console.warn('LocalStorage quota limit reached; IndexedDB remains active as primary persistent storage.');
  }
}

export function saveAppState(
  state: AppState,
  explicitLeagueState?: LeagueSeasonState | null,
  explicitLeagueArchives?: LeagueSeasonArchive[],
  explicitTheIdolsState?: TheIdolsSeasonState | null,
  explicitTheIdolsArchives?: TheIdolsSeasonArchive[],
  immediate: boolean = false
): void {
  const loadedLeagueState = loadLeagueSeasonState();
  const currentLeagueState =
    explicitLeagueState !== undefined
      ? explicitLeagueState
      : state.leagueState !== undefined && state.leagueState !== null
      ? state.leagueState
      : loadedLeagueState;

  const loadedLeagueArchives = loadLeagueArchives();
  const currentLeagueArchives =
    explicitLeagueArchives !== undefined
      ? explicitLeagueArchives
      : Array.isArray(state.leagueArchives)
      ? state.leagueArchives
      : (loadedLeagueArchives || []);

  const loadedTheIdolsState = loadTheIdolsState();
  const currentTheIdolsState =
    explicitTheIdolsState !== undefined
      ? explicitTheIdolsState
      : state.theIdolsState !== undefined && state.theIdolsState !== null
      ? state.theIdolsState
      : loadedTheIdolsState;

  const loadedTheIdolsArchives = loadTheIdolsArchives();
  const currentTheIdolsArchives =
    explicitTheIdolsArchives !== undefined
      ? explicitTheIdolsArchives
      : Array.isArray(state.theIdolsArchives)
      ? state.theIdolsArchives
      : (loadedTheIdolsArchives || []);

  const currentBranding =
    state.customLeagueBranding !== undefined
      ? state.customLeagueBranding
      : loadCustomLeagueBranding();
  const currentRankings =
    state.personalRankings !== undefined ? state.personalRankings : loadPersonalRankings();

  // Also write to dedicated individual storage keys safely
  if (currentLeagueState) {
    saveLeagueSeasonState(currentLeagueState);
  }
  if (currentBranding && currentBranding.length > 0) {
    saveCustomLeagueBranding(currentBranding);
  }
  if (currentLeagueArchives !== undefined) {
    saveLeagueArchives(currentLeagueArchives);
  }
  if (currentRankings) {
    savePersonalRankings(currentRankings);
  }
  if (currentTheIdolsState) {
    saveTheIdolsState(currentTheIdolsState);
  }
  if (currentTheIdolsArchives !== undefined) {
    saveTheIdolsArchives(currentTheIdolsArchives);
  }
  if (Array.isArray(state.archives)) {
    saveTournamentArchives(state.archives);
  }

  const timestamp = Date.now();
  const fullState: AppState & { _savedAt: number } = {
    ...state,
    leagueState: currentLeagueState,
    leagueArchives: currentLeagueArchives,
    theIdolsState: currentTheIdolsState,
    theIdolsArchives: currentTheIdolsArchives,
    customLeagueBranding: currentBranding,
    personalRankings: currentRankings,
    _savedAt: timestamp,
  };

  // Keep the dedicated V5 store synchronized with the main persisted snapshot.
  if (fullState.v5State) saveV5State(fullState.v5State);

  // 1. Primary storage: Asynchronously save full complete state (with all base64 photos, entire match history, archives) to IndexedDB
  saveAppStateToIndexedDB(fullState, immediate);

  // 2. Synchronously save lightweight / fallback state to localStorage with multi-tier quota management
  saveToLocalStorageSafely(fullState);
}

export const TOURNAMENT_ARCHIVES_KEY = 'sabung_tournament_archives_v1';

export function loadTournamentArchives(): TournamentArchive[] {
  try {
    const raw = localStorage.getItem(TOURNAMENT_ARCHIVES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTournamentArchives(archives: TournamentArchive[]): void {
  try {
    const compacted = compactArchivesForStorage(archives);
    localStorage.setItem(TOURNAMENT_ARCHIVES_KEY, JSON.stringify(compacted));
  } catch (e) {
    console.warn('Failed to save tournament archives dedicated key:', e);
  }
}

export function saveIdols(idols: Idol[]): void {
  const current = loadAppState();
  current.idols = idols;
  saveAppState(current);
}

export function saveGirlGroups(groups: GirlGroup[]): void {
  const current = loadAppState();
  current.girlGroups = groups;
  saveAppState(current);
}

export function saveMatchDatabase(matchDatabase: ArchivedMatch[]): void {
  const current = loadAppState();
  current.matchDatabase = matchDatabase;
  saveAppState(current);
}

/**
 * Helper to download JSON or text content safely via Blob & Object URL (prevents memory exhaustion on large states).
 */
function downloadFileSafely(content: string, filename: string, mimeType: string = 'application/json'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute('download', filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function exportAppStateToJSON(
  state: AppState,
  leagueState?: LeagueSeasonState | null,
  leagueArchives?: LeagueSeasonArchive[],
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[]
): void {
  const currentLeagueState = leagueState !== undefined ? leagueState : (state.leagueState || loadLeagueSeasonState());
  const currentLeagueArchives = leagueArchives !== undefined ? leagueArchives : (state.leagueArchives || loadLeagueArchives());
  const currentTheIdolsState = theIdolsState !== undefined ? theIdolsState : (state.theIdolsState || loadTheIdolsState());
  const currentTheIdolsArchives = theIdolsArchives !== undefined ? theIdolsArchives : (state.theIdolsArchives || loadTheIdolsArchives());
  const currentRankings = state.personalRankings || loadPersonalRankings();
  const currentBranding = state.customLeagueBranding || loadCustomLeagueBranding();

  const fullBackupPayload: AppState & {
    exportVersion: string;
    exportedAt: string;
    personalRankings: PersonalRankingEntry[];
    personalIdolRankings: PersonalRankingEntry[];
    leagueState: LeagueSeasonState | null;
    leagueArchives: LeagueSeasonArchive[];
    theIdolsState: TheIdolsSeasonState | null;
    theIdolsArchives: TheIdolsSeasonArchive[];
    customLeagueBranding: LeagueBrandingItem[];
  } = {
    ...state,
    exportVersion: '3.0_full_db_with_ranks_leagues_and_the_idols',
    exportedAt: new Date().toISOString(),
    personalRankings: currentRankings,
    personalIdolRankings: currentRankings,
    leagueState: currentLeagueState,
    leagueArchives: currentLeagueArchives,
    theIdolsState: currentTheIdolsState,
    theIdolsArchives: currentTheIdolsArchives,
    customLeagueBranding: currentBranding,
  };

  downloadFileSafely(
    JSON.stringify(fullBackupPayload, null, 2),
    `idol_tournament_full_backup_${Date.now()}.json`
  );
}

/**
 * Exports an optimized, ultra-lean JSON backup by deduplicating base64 idol photos from match records
 * and historical archives (photos resolve dynamically by idol ID).
 */
export function exportOptimizedAppStateToJSON(
  state: AppState,
  leagueState?: LeagueSeasonState | null,
  leagueArchives?: LeagueSeasonArchive[],
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[]
): void {
  const currentLeagueState = leagueState !== undefined ? leagueState : (state.leagueState || loadLeagueSeasonState());
  const currentLeagueArchives = leagueArchives !== undefined ? leagueArchives : (state.leagueArchives || loadLeagueArchives());
  const currentTheIdolsState = theIdolsState !== undefined ? theIdolsState : (state.theIdolsState || loadTheIdolsState());
  const currentTheIdolsArchives = theIdolsArchives !== undefined ? theIdolsArchives : (state.theIdolsArchives || loadTheIdolsArchives());
  const currentRankings = state.personalRankings || loadPersonalRankings();
  const currentBranding = state.customLeagueBranding || loadCustomLeagueBranding();

  // Strip duplicate base64 photo properties from match lists (resolved dynamically from idols array)
  const leanMatches = (state.matchDatabase || []).map((m) => ({
    ...m,
    idolAPhoto: m.idolAPhoto && m.idolAPhoto.startsWith('data:image') ? '' : m.idolAPhoto,
    idolBPhoto: m.idolBPhoto && m.idolBPhoto.startsWith('data:image') ? '' : m.idolBPhoto,
  }));

  const leanPayload = {
    ...state,
    exportVersion: '3.0_optimized_lean_backup',
    exportedAt: new Date().toISOString(),
    matchDatabase: leanMatches,
    personalRankings: currentRankings,
    personalIdolRankings: currentRankings,
    leagueState: currentLeagueState,
    leagueArchives: currentLeagueArchives,
    theIdolsState: currentTheIdolsState,
    theIdolsArchives: currentTheIdolsArchives,
    customLeagueBranding: currentBranding,
  };

  downloadFileSafely(
    JSON.stringify(leanPayload, null, 2),
    `idol_tournament_optimized_backup_${Date.now()}.json`
  );
}

/**
 * Completely resets all databases (Idols, Tournament Matches & Archives, League Divisions & Historical League Archives, The Idols Superleague & Masters Archives, Personal Rankings, Branding)
 * to a clean preloaded default state.
 */
export function clearAllAppDataAndStorage(): {
  appState: AppState;
  leagueState: LeagueSeasonState;
  leagueArchives: LeagueSeasonArchive[];
  theIdolsState: TheIdolsSeasonState;
  theIdolsArchives: TheIdolsSeasonArchive[];
} {
  const freshLeague = initializeLeagueSeason(INITIAL_IDOLS, INITIAL_GIRL_GROUPS, 1);
  saveLeagueSeasonState(freshLeague);
  saveLeagueArchives([]);
  savePersonalRankings([]);
  saveCustomLeagueBranding(DEFAULT_LEAGUE_DEFS);
  saveSavedTop32Qualifiers([]);

  const freshTheIdols = initializeTheIdolsSeason(INITIAL_IDOLS, 1, INITIAL_GIRL_GROUPS);
  saveTheIdolsState(freshTheIdols);
  saveTheIdolsArchives([]);

  const cleanState: AppState = {
    appLogoUrl: '',
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
    leagueState: freshLeague,
    leagueArchives: [],
    theIdolsState: freshTheIdols,
    theIdolsArchives: [],
    personalRankings: [],
    customLeagueBranding: DEFAULT_LEAGUE_DEFS,
  };

  saveAppState(cleanState, freshLeague, [], freshTheIdols, []);
  return {
    appState: cleanState,
    leagueState: freshLeague,
    leagueArchives: [],
    theIdolsState: freshTheIdols,
    theIdolsArchives: [],
  };
}

/**
 * Exports complete The Idols Superleague & Masters Database
 */
export function exportTheIdolsDatabaseToJSON(
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[],
  idols?: Idol[]
): void {
  const stateToExport = theIdolsState || loadTheIdolsState();
  const archivesToExport = theIdolsArchives || loadTheIdolsArchives();

  const idolsMap = new Map<string, Idol>();
  if (Array.isArray(idols)) {
    idols.forEach((i) => idolsMap.set(i.id, i));
  }

  const payload = {
    type: 'the_idols_superleague_database',
    exportedAt: new Date().toISOString(),
    theIdolsState: stateToExport,
    theIdolsArchives: archivesToExport,
    totalArchivedSeasons: archivesToExport.length,
    activeSeasonCompetitorsCount: stateToExport?.standings?.length || 0,
  };

  downloadFileSafely(
    JSON.stringify(payload, null, 2),
    `the_idols_database_${Date.now()}.json`
  );
}

export function exportIdolRosterToJSON(state: AppState): void {
  const rosterData = {
    type: 'idol_roster_database',
    exportedAt: new Date().toISOString(),
    idolsCount: state.idols.length,
    groupsCount: state.girlGroups.length,
    idols: state.idols.map((i) => ({
      id: i.id,
      name: i.name,
      girlGroup: i.girlGroup,
      seed: i.seed,
      rating: i.rating,
      nationality: i.nationality,
      photoUrl: i.photoUrl,
      inactive: Boolean(i.inactive),
      createdAt: i.createdAt,
    })),
    girlGroups: state.girlGroups.map((g) => ({
      id: g.id,
      name: g.name,
      logoUrl: g.logoUrl,
      members: g.members,
      inactive: Boolean(g.inactive),
    })),
  };

  downloadFileSafely(
    JSON.stringify(rosterData, null, 2),
    `idol_roster_database_${Date.now()}.json`
  );
}

/**
 * Exports complete League Database (Rosters for all 6 divisions, branding & logos, active season standings & fixtures, and historical archives)
 */
export function exportLeagueDatabaseToJSON(
  leagueState?: LeagueSeasonState | null,
  leagueArchives?: LeagueSeasonArchive[],
  customLeagueBranding?: LeagueBrandingItem[],
  idols?: Idol[]
): void {
  const stateToExport = leagueState || loadLeagueSeasonState();
  const archivesToExport = leagueArchives || loadLeagueArchives();
  const brandingToExport = customLeagueBranding || loadCustomLeagueBranding();

  const effectiveIdols = (Array.isArray(idols) && idols.length > 0) ? idols : (loadAppState()?.idols || []);
  const idolsMap = new Map<string, Idol>();
  effectiveIdols.forEach((i) => idolsMap.set(i.id, i));

  // Build division rosters with full idol info (guaranteed 20 idols per division)
  const divisionRosters = (stateToExport?.leagues || []).map((league, lIdx) => {
    let memberIds = league.memberIds || [];
    if (memberIds.length === 0 && league.standings && league.standings.length > 0) {
      memberIds = league.standings.map((s) => s.idolId);
    }
    if (memberIds.length < 20 && effectiveIdols.length >= 120) {
      const sliceStart = lIdx * 20;
      const sliceEnd = sliceStart + 20;
      const fallbackSlice = effectiveIdols.slice(sliceStart, sliceEnd).map((i) => i.id);
      memberIds = Array.from(new Set([...memberIds, ...fallbackSlice])).slice(0, 20);
    }
    return {
      divisionId: league.id,
      divisionName: league.name,
      tierName: league.tierName,
      color: league.color,
      logoUrl: league.logoUrl,
      description: league.description,
      memberCount: memberIds.length,
      rosterCount: memberIds.length,
      memberIds: memberIds,
      members: memberIds.map((id, idx) => {
        const idol = idolsMap.get(id);
        const standing = league.standings?.find((s) => s.idolId === id);
        return {
          memberIndex: idx + 1,
          idolId: id,
          name: idol?.name || standing?.idolName || 'Unknown Idol',
          girlGroup: idol?.girlGroup || standing?.girlGroup || 'Solo',
          seed: idol?.seed || standing?.seed || 'Seed 2',
          rating: idol?.rating,
          nationality: idol?.nationality || standing?.nationality || 'South Korea',
          photoUrl: idol?.photoUrl || standing?.photoUrl || '',
        };
      }),
      roster: memberIds.map((id, idx) => {
        const idol = idolsMap.get(id);
        const standing = league.standings?.find((s) => s.idolId === id);
        return {
          memberIndex: idx + 1,
          id,
          idolId: id,
          name: idol?.name || standing?.idolName || 'Unknown Idol',
          girlGroup: idol?.girlGroup || standing?.girlGroup || 'Solo',
          seed: idol?.seed || standing?.seed || 'Unseeded',
          rating: idol?.rating,
          nationality: idol?.nationality || standing?.nationality || 'South Korea',
          photoUrl: idol?.photoUrl || standing?.photoUrl || '',
        };
      }),
    };
  });

  const payload = {
    type: 'league_permanent_database',
    exportedAt: new Date().toISOString(),
    seasonNumber: stateToExport?.seasonNumber || 1,
    seasonName: stateToExport?.seasonName || 'League Season 1',
    brandingAndLogos: brandingToExport,
    divisionRosters,
    activeSeason: stateToExport,
    historicalArchives: archivesToExport,
    historicalArchivesCount: archivesToExport.length,
  };

  downloadFileSafely(
    JSON.stringify(payload, null, 2),
    `league_database_s${stateToExport?.seasonNumber || 1}_${Date.now()}.json`
  );
}

/**
 * Exports League Branding, Division Names, Logos, and Tier Descriptions
 */
export function exportLeagueBrandingToJSON(
  customLeagueBranding?: LeagueBrandingItem[]
): void {
  const branding = customLeagueBranding || loadCustomLeagueBranding();
  const payload = {
    type: 'league_branding_and_logos_database',
    exportedAt: new Date().toISOString(),
    branding,
  };

  downloadFileSafely(
    JSON.stringify(payload, null, 2),
    `league_branding_and_logos_${Date.now()}.json`
  );
}

/**
 * Exports Personal Idol Rankings Database (Ranks, tiers, custom ratings, notes, favorite songs, idol info)
 */
export function exportPersonalRankingsToJSON(
  personalRankings?: PersonalRankingEntry[],
  idols?: Idol[]
): void {
  const rankings = personalRankings || loadPersonalRankings();
  const idolsMap = new Map<string, Idol>();
  if (Array.isArray(idols)) {
    idols.forEach((i) => idolsMap.set(i.id, i));
  }

  const enrichedRankings = rankings.map((r, idx) => {
    const idol = idolsMap.get(r.idolId);
    return {
      rank: r.rank || idx + 1,
      idolId: r.idolId,
      idolName: idol?.name || 'Unknown Idol',
      girlGroup: idol?.girlGroup || 'Solo',
      nationality: idol?.nationality || 'South Korea',
      photoUrl: idol?.photoUrl || '',
      tier: r.tier || 'S',
      customRating: r.customRating ?? 90,
      notes: r.notes || '',
      favoriteSong: r.favoriteSong || '',
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    };
  });

  const payload = {
    type: 'personal_idol_rankings_database',
    exportedAt: new Date().toISOString(),
    totalRankedIdols: enrichedRankings.length,
    personalRankings: enrichedRankings,
  };

  downloadFileSafely(
    JSON.stringify(payload, null, 2),
    `personal_idol_rankings_database_${Date.now()}.json`
  );
}

/**
 * Exports Combined Permanent Match Database (Tournament + League Matches) to JSON
 */
export function exportMatchDatabaseToJSON(
  matchDatabase: ArchivedMatch[]
): void {
  const payload = {
    type: 'combined_match_database',
    exportedAt: new Date().toISOString(),
    totalMatches: matchDatabase.length,
    matches: matchDatabase,
  };

  downloadFileSafely(
    JSON.stringify(payload, null, 2),
    `combined_match_database_${Date.now()}.json`
  );
}

/**
 * Exports Combined Match Database to CSV for spreadsheet programs
 */
export function exportMatchDatabaseToCSV(
  matchDatabase: ArchivedMatch[]
): void {
  const headers = [
    'Match ID',
    'Season ID',
    'Season Name',
    'Stage / Division',
    'Format Type',
    'Idol A Name',
    'Idol A Group',
    'Score A',
    'Score B',
    'Idol B Group',
    'Idol B Name',
    'Winner Name',
    'Is Draw',
    'Date / Time',
  ];

  const escapeCSV = (str: any) => {
    if (str === null || str === undefined) return '""';
    const val = String(str).replace(/"/g, '""');
    return `"${val}"`;
  };

  const rows = matchDatabase.map((m) => {
    const isLeague = m.matchId?.startsWith('league_') || m.stage?.includes('Division') || m.stage?.includes('League');
    const isTheIdols = m.matchId?.startsWith('the_idols_') || m.stage?.includes('The Idols');
    const formatType = isTheIdols ? 'The Idols' : isLeague ? 'League Division' : 'Tournament Cup';

    return [
      escapeCSV(m.matchId),
      escapeCSV(m.seasonId),
      escapeCSV(m.seasonName),
      escapeCSV(m.stage),
      escapeCSV(formatType),
      escapeCSV(m.idolAName),
      escapeCSV((m as any).idolAGirlGroup || m.idolAGroup || ''),
      escapeCSV(m.scoreA),
      escapeCSV(m.scoreB),
      escapeCSV((m as any).idolBGirlGroup || m.idolBGroup || ''),
      escapeCSV(m.idolBName),
      escapeCSV(m.winnerName || (m.isDraw ? 'Draw' : '')),
      escapeCSV(m.isDraw ? 'Yes' : 'No'),
      escapeCSV(m.date || ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\\r\\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', url);
  downloadAnchor.setAttribute(
    'download',
    `combined_match_database_${Date.now()}.csv`
  );
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Exports All Historical Stats, Tournament Archives, League Archives & Champion Hall
 */
export function exportHistoricalStatsToJSON(
  appState: AppState,
  leagueArchives?: LeagueSeasonArchive[],
  theIdolsArchives?: TheIdolsSeasonArchive[]
): void {
  const lArchives = leagueArchives || loadLeagueArchives();
  const tiArchives = theIdolsArchives || loadTheIdolsArchives();
  const payload = {
    type: 'historical_stats_and_archives_database',
    exportedAt: new Date().toISOString(),
    currentSeasonNumber: appState.config.seasonNumber,
    tournamentArchives: appState.archives,
    leagueArchives: lArchives,
    theIdolsArchives: tiArchives,
    totalTournamentSeasonsArchived: appState.archives.length,
    totalLeagueSeasonsArchived: lArchives.length,
    totalTheIdolsSeasonsArchived: tiArchives.length,
  };

  downloadFileSafely(
    JSON.stringify(payload, null, 2),
    `historical_stats_and_archives_${Date.now()}.json`
  );
}


