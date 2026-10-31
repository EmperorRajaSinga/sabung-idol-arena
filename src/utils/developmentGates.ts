/**
 * Development Gates & Feature Flags Architecture
 * 
 * Provides extensible hooks, configuration gates, and non-breaking adapters for future expansions:
 * 1. League Expansion Gate (add new leagues/divisions, custom tier sizing, dynamic round-robin scheduling)
 * 2. Champions Tournament Qualification Gate (flexible direct qualification quotas, total bracket sizing 32/48/64)
 * 3. Play-In & Wildcard Format Gate (multiple play-in tournament engines: mini-groups, gauntlets, single-elim brackets)
 * 4. Postseason & Side Cup Tournament Gates (Domestic Cup, Tier-2 Secondary Cup / Europa-style)
 * 5. Idol Transfer Market & Roster Gate (Fixed vs. Dynamic Seasonal Rosters)
 */

export type PlayInFormatType =
  | 'four_idol_dual_finals' // Default current: 4 idols -> SF1/SF2 -> Final 1 / Final 2 (2 advance)
  | 'eight_idol_knockout'   // 8 idols single-elimination bracket (2 or 4 advance)
  | 'mini_group_round_robin'// 4 or 6 idols in a group table, top 2 advance
  | 'stepladder_gauntlet'   // Bottom seeds battle upwards
  | 'swiss_system';         // Swiss rounds for play-in stage

export interface LeagueSystemGateConfig {
  /** Total number of parallel divisions in active season (default: 6) */
  divisionCount: number;
  /** Number of idols per division (default: 20) */
  divisionRosterSize: number;
  /** Custom division metadata if extended beyond the standard 6 */
  customLeaguesEnabled: boolean;
  /** Double round robin matchdays multiplier (default: 2 -> 38 MDs for 20 idols) */
  roundRobinLaps: number;
}

export interface TournamentQualificationGateConfig {
  /** Total slots in the Champions Tournament (default: 32) */
  championsTournamentSize: 32 | 48 | 64 | 128;
  /** Direct qualifying rank per division (default: 5 -> 6 divisions * 5 = 30 idols) */
  directQualifiersPerDivision: number;
  /** Number of wildcard/play-in slots granted to Champions Tournament (default: 2) */
  wildcardPlayInQuota: number;
  /** Number of candidates invited to participate in the Wildcard Play-In (default: 4) */
  wildcardCandidatesCount: number;
  /** Whether to allow cross-division highest-points wildcards instead of fixed rank 6 */
  useBestOverallWildcards: boolean;
}

export interface PlayInFormatGateConfig {
  /** Active format for wildcard play-in tournament */
  format: PlayInFormatType;
  /** Best-of series length for play-in matches (default: 1) */
  seriesLength: 1 | 3 | 5;
  /** Title/branding for the play-in event */
  customTitle: string;
}

export interface ExperimentalFeatureGates {
  /** Enable Tier-2 Secondary Tournament (e.g. for ranks 6-10 in each division) */
  enableSecondaryCupTournament: boolean;
  /** Enable All-Division Domestic Cup (single knockout across all 120+ idols) */
  enableDomesticAllIdolCup: boolean;
  /** Enable Seasonal Idol Transfer Window / Trade Market */
  enableSeasonalTransferMarket: boolean;
  /** Enable Live Commentary / Match Breakdown ticker in match views */
  enableRichMatchTelemetry: boolean;
  /** Enable Form & Momentum Engine (Hot Streaks, Slumps, and Rating Modifiers) */
  enableFormMomentumEngine: boolean;
  /** Enable Live Match Visualizer and Minute-by-Minute Matchday Simulcast */
  enableLiveMatchVisualizer: boolean;
  /** Enable Data Maker & Pot Draw Generator Tool in Settings */
  enableDataMakerGenerator: boolean;
}

export type DataMakerDrawMode = 'random_pot' | 'snake' | 'direct' | 'rating_weighted';
export type DataMakerOutputFormat = 'plain_names' | 'numbered' | 'with_group' | 'with_rating' | 'with_pot_tag';

export interface DataMakerGateConfig {
  /** Enables Data Maker / List Generator in settings & system menus */
  enabled: boolean;
  /** Number of target generated lists (default: 6) */
  targetListCount: number;
  /** Number of items per list (default: 20) */
  itemsPerList: number;
  /** Number of pot tiers (default: 20) */
  potsCount: number;
  /** Idols per pot tier (default: 6) */
  idolsPerPot: number;
  /** Default draw algorithm */
  defaultDrawMode: DataMakerDrawMode;
  /** Default ranking metric used to build the 120-idol pyramid ranking */
  rankingMetric: 'career_points' | 'division_titles' | 'win_rate' | 'overall_rating' | 'champions_qualifiers';
  /** Allow 1-click roster injection directly into Division 1-6 */
  enableDirectRosterInjection: boolean;
  /** Output formatting style */
  defaultOutputFormat: DataMakerOutputFormat;
  /** Optional custom group distribution balance */
  balanceGirlGroups: boolean;
  /** Future expansion tags and custom parameters */
  futureExpansionTags: string[];
}

export interface SystemDevelopmentGateState {
  version: number;
  leagueGate: LeagueSystemGateConfig;
  qualificationGate: TournamentQualificationGateConfig;
  playInGate: PlayInFormatGateConfig;
  dataMakerGate?: DataMakerGateConfig;
  experimentalGates: ExperimentalFeatureGates;
}

export const DEVELOPMENT_GATES_STORAGE_KEY = 'sabung_system_development_gates_v1';

export const DEFAULT_DATA_MAKER_GATE: DataMakerGateConfig = {
  enabled: true,
  targetListCount: 6,
  itemsPerList: 20,
  potsCount: 20,
  idolsPerPot: 6,
  defaultDrawMode: 'random_pot',
  rankingMetric: 'career_points',
  enableDirectRosterInjection: true,
  defaultOutputFormat: 'plain_names',
  balanceGirlGroups: false,
  futureExpansionTags: ['custom_pot_size', 'group_stage_generator', 'elo_balance', 'export_presets'],
};

export const DEFAULT_DEVELOPMENT_GATES: SystemDevelopmentGateState = {
  version: 1,
  leagueGate: {
    divisionCount: 6,
    divisionRosterSize: 20,
    customLeaguesEnabled: false,
    roundRobinLaps: 2,
  },
  qualificationGate: {
    championsTournamentSize: 64,
    directQualifiersPerDivision: 6,
    wildcardPlayInQuota: 28,
    wildcardCandidatesCount: 60,
    useBestOverallWildcards: false,
  },
  playInGate: {
    format: 'four_idol_dual_finals',
    seriesLength: 1,
    customTitle: 'Champions Wildcard Play-In',
  },
  dataMakerGate: DEFAULT_DATA_MAKER_GATE,
  experimentalGates: {
    enableSecondaryCupTournament: false,
    enableDomesticAllIdolCup: false,
    enableSeasonalTransferMarket: false,
    enableRichMatchTelemetry: true,
    enableFormMomentumEngine: true,
    enableLiveMatchVisualizer: true,
    enableDataMakerGenerator: true,
  },
};

/**
 * Loads current development gate configuration from storage with safe fallback defaults
 */
export function loadDevelopmentGates(): SystemDevelopmentGateState {
  try {
    const raw = localStorage.getItem(DEVELOPMENT_GATES_STORAGE_KEY);
    if (!raw) return DEFAULT_DEVELOPMENT_GATES;
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || 1,
      leagueGate: { ...DEFAULT_DEVELOPMENT_GATES.leagueGate, ...(parsed.leagueGate || {}) },
      qualificationGate: { ...DEFAULT_DEVELOPMENT_GATES.qualificationGate, ...(parsed.qualificationGate || {}) },
      playInGate: { ...DEFAULT_DEVELOPMENT_GATES.playInGate, ...(parsed.playInGate || {}) },
      dataMakerGate: { ...DEFAULT_DATA_MAKER_GATE, ...(parsed.dataMakerGate || {}) },
      experimentalGates: { ...DEFAULT_DEVELOPMENT_GATES.experimentalGates, ...(parsed.experimentalGates || {}) },
    };
  } catch (e) {
    console.warn('Failed to load development gates, falling back to standard system config:', e);
    return DEFAULT_DEVELOPMENT_GATES;
  }
}

/**
 * Saves updated development gates to persistent storage
 */
export function saveDevelopmentGates(config: SystemDevelopmentGateState): void {
  try {
    localStorage.setItem(DEVELOPMENT_GATES_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to persist development gates:', e);
  }
}

/**
 * Gate Helper: Calculates expected total direct qualifiers and wildcard slots based on current gate config
 */
export function computeQualificationCapacity(gate: TournamentQualificationGateConfig, divisionCount: number) {
  const directSlots = divisionCount * gate.directQualifiersPerDivision;
  const wildcardSlots = gate.wildcardPlayInQuota;
  const totalQualifiers = directSlots + wildcardSlots;
  return {
    directSlots,
    wildcardSlots,
    totalQualifiers,
    targetTournamentSize: gate.championsTournamentSize,
    isBalanced: totalQualifiers === gate.championsTournamentSize,
  };
}

/**
 * Gate Helper: Evaluates if a given feature flag is active without side-effects
 */
export function isFeatureGateActive(gateKey: keyof ExperimentalFeatureGates): boolean {
  const gates = loadDevelopmentGates();
  return Boolean(gates.experimentalGates[gateKey]);
}
