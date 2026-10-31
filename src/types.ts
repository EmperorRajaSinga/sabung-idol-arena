/**
 * Core Data Models for Idol Tournament Manager
 */

export interface Idol {
  id: string;
  name: string;
  girlGroup: string;
  seed: string; // 'Seed 1' | 'Seed 2' | 'Seed 3' | 'Seed 4'
  nationality: string;
  photoUrl?: string;
  createdAt: number;
  inactive?: boolean; // When true, marked inactive and excluded from competition random selection
  rating?: number; // 0 - 100 skill & performance rating scale (e.g. 85)
}

export interface GirlGroup {
  id: string;
  name: string;
  logoUrl?: string;
  members: string[]; // Idol names or IDs
  inactive?: boolean; // When true, whole group is marked inactive
}

export type SeedTier = 'Seed 1' | 'Seed 2' | 'Seed 3' | 'Seed 4';

export interface TournamentConfig {
  seasonId: number;
  seasonNumber: number;
  seasonName: string;
  totalParticipants: number; // e.g., 64, 96, 128, 160, 192
  numGroups: number; // e.g., 16
  participantsPerGroup: number; // e.g., 4
  qualifiedPerGroup: 2 | 3; // Top 2 or Top 3
  isStarted: boolean;
  isGroupStageFinished: boolean;
  isKnockoutFinished: boolean;
  favoriteIdolIds?: string[]; // 1 or 2 chosen player/main idols for the season
  customTournamentTitle?: string; // Persistent custom user tournament name (e.g. "Icon Cup")
}

export interface GroupMatch {
  id: string;
  groupIndex: number;
  groupName: string;
  round: number;
  idolAId: string;
  idolBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  completed: boolean;
  updatedAt?: string;
}

export interface GroupStanding {
  idolId: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number; // 3 for win, 1 for draw, 0 for loss
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  rank: number;
  qualified: boolean;
}

export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  matches: GroupMatch[];
  standings: GroupStanding[];
}

export interface KnockoutMatch {
  id: string;
  roundIndex: number; // 0 = Play-In, 1 = Round of 32, 2 = Round of 16, 3 = Quarter Final, 4 = Semi Final, 5 = Grand Final / 3rd Place
  roundName: string; // "Play-In", "Round of 32", "Round of 16", "Quarter Finals", "Semi Finals", "Third Place Match", "Grand Final"
  matchNumber: number;
  idolAId: string | null;
  idolBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  isBye?: boolean;
  completed: boolean;
  feedsIntoMatchId?: string;
  feedsIntoSlot?: 'A' | 'B';
  isThirdPlaceMatch?: boolean;
  updatedAt?: string;
}

export interface ArchivedMatch {
  matchId: string;
  seasonId: number;
  seasonName: string;
  stage: string; // 'Group Stage' | 'Play-In' | 'Round of 32' | 'Round of 16' | 'Quarter Finals' | 'Semi Finals' | 'Third Place' | 'Grand Final'
  groupName?: string;
  idolAId: string;
  idolAName: string;
  idolAGroup: string;
  idolAPhoto?: string;
  idolBId: string;
  idolBName: string;
  idolBGroup: string;
  idolBPhoto?: string;
  scoreA: number;
  scoreB: number;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  isDraw?: boolean;
  date: string;
}

export interface TournamentArchive {
  seasonId: number;
  seasonName: string;
  totalParticipants: number;
  numGroups?: number;
  qualifiedPerGroup?: number;
  championId: string;
  championName: string;
  runnerUpId: string;
  runnerUpName: string;
  thirdPlaceId?: string;
  thirdPlaceName?: string;
  fourthPlaceId?: string;
  fourthPlaceName?: string;
  groups: any[];
  matches?: ArchivedMatch[];
  knockoutMatches?: KnockoutMatch[];
  completedAt: string;
}

export interface CareerStat {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  seed: string;
  photoUrl?: string;
  participations: number;
  championships: number;
  runnerUps: number;
  thirdPlaces: number;
  fourthPlaces: number;
  top4: number;
  quarterFinals: number;
  roundOf16: number;
  roundOf32: number;
  playIns: number;
  groupAdvancements: number;
  groupExits: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // percentage
  groupWins: number;
  groupLosses: number;
  groupWinRate: number;
  knockoutWins: number;
  knockoutLosses: number;
  knockoutWinRate: number;
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  longestWinStreak: number;
  longestLosingStreak: number;
  longestUnbeatenStreak: number;
  avgPlacement: number;
  bestFinish: string;
  worstFinish: string;
  totalTitles?: number;
}

export type ActiveTab =
  | 'dashboard'
  | 'season_simulator'
  | 'rank_panel'
  | 'settings'
  | 'data_studio'
  | 'idols'
  | 'groups'
  | 'ratings'
  | 'seeds'
  | 'nationalities'
  | 'inactive_manager'
  | 'competition'
  | 'draw'
  | 'group_stage'
  | 'knockout'
  | 'league_system'
  | 'the_idols'
  | 'public_results'
  | 'match_db'
  | 'career_stats'
  | 'girl_group_stats'
  | 'season_profile'
  | 'idol_profile'
  | 'h2h'
  | 'hall_of_champions'
  | 'all_time_records'
  | 'archive'
  | 'the_idols_archive'
  | 'system_info'
  | 'gacha'
  | 'gwent';

export type AchievementTier = 'legendary' | 'epic' | 'rare' | 'gold' | 'silver';

export interface MilestoneBadge {
  id: string;
  name: string;
  category: 'championship' | 'streak' | 'record' | 'longevity' | 'mastery';
  tier: AchievementTier;
  iconName: string;
  description: string;
  criteria: string;
  xpValue: number;
}

export interface IdolAchievementEarned {
  badge: MilestoneBadge;
  unlockedAtSeason?: number | string;
  unlockedContext?: string;
  progressPercent?: number;
}

export type GachaRarity = 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';

export type GachaBannerType =
  | 'all_idols'
  | 'seed_1'
  | 'seed_2'
  | 'seed_3'
  | 'seed_4';

export interface GachaCard {
  id: string; // Unique card identifier (e.g. idol id or dummy item code)
  type: 'idol' | 'dummy_item';
  name: string;
  rarity: GachaRarity;
  seedTier?: string; // 'Seed 1' | 'Seed 2' | 'Seed 3' | 'Seed 4'
  girlGroup?: string;
  nationality?: string;
  photoUrl?: string;
  description?: string;
  iconName?: string;
  obtainedAt: number;
  count: number;
}

export interface GachaPullResult {
  card: GachaCard;
  isNew: boolean;
  pullIndex: number;
}

export interface GachaHistoryEntry {
  id: string;
  timestamp: number;
  bannerType: GachaBannerType;
  bannerName: string;
  results: GachaCard[];
}

export interface GachaInventory {
  totalPulls: number;
  inventory: Record<string, GachaCard>; // Keyed by card id
  history: GachaHistoryEntry[];
}

// --- GWENT (SABUNG CARD DUEL) TYPES ---
export type GwentFactionId = string;

export type GwentRow = 'melee' | 'ranged' | 'siege' | 'agile';

export type GwentCardType = 'hero' | 'unit' | 'weather' | 'special' | 'leader';

export type GwentSpecialType = 'horn' | 'scorch' | 'decoy' | 'clear_weather' | 'frost' | 'fog' | 'rain';

export type GwentAbility =
  | 'hero'
  | 'tight_bond'
  | 'morale_boost'
  | 'muster'
  | 'spy'
  | 'medic'
  | 'avenger'
  | 'scorch_melee'
  | 'horn'
  | 'none';

export interface GwentCard {
  id: string; // Unique instance id
  cardCode: string; // Base card template id
  name: string;
  faction: GwentFactionId | 'neutral';
  cardType: GwentCardType;
  row: GwentRow;
  baseStrength: number;
  currentStrength?: number;
  ability: GwentAbility;
  specialType?: GwentSpecialType;
  idolId?: string;
  photoUrl?: string;
  seedTier?: string;
  girlGroup?: string;
  flavorText?: string;
  musterGroup?: string;
  isHero: boolean;
}

export interface GwentLeader {
  id: string;
  name: string;
  title: string;
  faction: GwentFactionId;
  photoUrl?: string;
  description: string;
  abilityType:
    | 'clear_weather'
    | 'horn_siege'
    | 'fog_ranged'
    | 'frost_melee'
    | 'scorch_melee_heavy'
    | 'draw_card'
    | 'scorch_highest_ranged'
    | 'cancel_leader';
}

export interface GwentFactionInfo {
  id: GwentFactionId;
  name: string;
  groupName: string;
  subtitle: string;
  logoUrl?: string;
  emblemColor: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  passiveName: string;
  passiveDescription: string;
  passiveType: 'win_draw' | 'encore_draw' | 'retain_unit' | 'opening_tempo';
  leaders: GwentLeader[];
}

export interface GwentPlayerState {
  name: string;
  isAI: boolean;
  avatarUrl?: string;
  faction: GwentFactionId;
  leader: GwentLeader;
  leaderUsed: boolean;
  lives: number; // Lives / gems (starts at 2)
  passed: boolean;
  hand: GwentCard[];
  deck: GwentCard[];
  discard: GwentCard[];
  board: {
    melee: GwentCard[];
    ranged: GwentCard[];
    siege: GwentCard[];
  };
  horns: {
    melee: boolean;
    ranged: boolean;
    siege: boolean;
  };
}

export interface GwentWeatherState {
  frost: boolean; // Garis Depan / Melee
  fog: boolean; // Panggung Vokal / Ranged
  rain: boolean; // Tata Panggung / Siege
}

export interface GwentRoundResult {
  round: number;
  playerScore: number;
  opponentScore: number;
  winner: 'player' | 'opponent' | 'draw';
}

export interface GwentMatchState {
  phase: 'mulligan' | 'playing' | 'round_end' | 'match_end';
  roundNumber: number;
  activePlayer: 'player' | 'opponent';
  player: GwentPlayerState;
  opponent: GwentPlayerState;
  weather: GwentWeatherState;
  mulligansRemaining: number;
  winner: 'player' | 'opponent' | 'draw' | null;
  roundResults: GwentRoundResult[];
  log: Array<{
    id: string;
    text: string;
    type: 'info' | 'combat' | 'weather' | 'ability' | 'pass';
    timestamp: number;
  }>;
}

export interface GwentSavedDeck {
  factionId: GwentFactionId;
  leaderId: string;
  cardCodes: string[]; // List of card codes in deck
  updatedAt: number;
}

export interface GwentCardOverride {
  name?: string;
  baseStrength?: number;
  row?: GwentRow;
  ability?: GwentAbility;
  cardType?: GwentCardType;
  isHero?: boolean;
  photoUrl?: string;
  flavorText?: string;
  musterGroup?: string;
  seedTier?: string;
  faction?: GwentFactionId | 'neutral';
}

export interface GwentCustomLeaderConfig {
  id: string;
  name?: string;
  title?: string;
  photoUrl?: string;
  description?: string;
  abilityType?: GwentLeader['abilityType'];
}

export interface GwentCustomFactionConfig {
  id: string;
  name?: string;
  groupName?: string;
  subtitle?: string;
  logoUrl?: string;
  emblemColor?: string;
  accentColor?: string;
  bgColor?: string;
  borderColor?: string;
  passiveName?: string;
  passiveDescription?: string;
  passiveType?: 'win_draw' | 'encore_draw' | 'retain_unit' | 'opening_tempo';
  leaders?: GwentCustomLeaderConfig[];
}

// --- LEAGUE SYSTEM TYPES ---
export interface LeagueMatch {
  id: string;
  leagueId: number; // 1 to 6
  matchday: number; // 1 to 38
  idolAId: string;
  idolBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  completed: boolean;
  updatedAt?: string;
}

export interface LeagueStanding {
  idolId: string;
  idolName: string;
  girlGroup: string;
  seed: string;
  nationality: string;
  photoUrl?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number; // 3 for win, 1 for draw, 0 for loss
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  rank: number;
  form: Array<'W' | 'D' | 'L'>;
  qualified: boolean; // Top qualifiers for Champions Tournament
}

export interface LeagueInfo {
  id: number; // 1 to 6
  name: string;
  tierName: string;
  color: string;
  logoUrl?: string;
  description?: string;
  memberIds: string[]; // 20 idol IDs
  matches: LeagueMatch[];
  standings: LeagueStanding[];
  championId?: string;
  championName?: string;
  isCompleted?: boolean;
}

export interface WildcardMatch {
  id: string; // e.g. "wc_ub_r1_m1", "wc_ub_r1_m2", "wc_ub_final", "wc_lb_r1_m1", "wc_lb_r1_m2", "wc_lb_r2", "wc_lb_final"
  bracket: 'upper' | 'lower';
  roundName: string; // "UB Semifinals" | "UB Final" | "LB Round 1" | "LB Semifinal" | "LB Final"
  matchNumber: number; // 1 to 7
  idolAId: string | null;
  idolBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  loserId?: string | null;
  completed: boolean;
  updatedAt?: string;
  feedsWinnerToMatchId?: string;
  feedsWinnerToSlot?: 'A' | 'B';
  feedsLoserToMatchId?: string;
  feedsLoserToSlot?: 'A' | 'B';
  qualifierSlot?: number; // 1 for UB Champion, 2 for LB Champion
}

export type PostseasonFormatType = 'classic_32' | 'grand_cup_64';

export interface WildcardParticipant {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  photoUrl?: string;
  seed: string;
  leagueId: number;
  leagueName: string;
  points: number;
  gameDiff: number;
  gamesFor: number;
  playInSeed: number; // 1 to 6 (1 = highest points, 6 = lowest)
  bracketStart: 'upper' | 'lower'; // Seeds 1-4 start in Upper Bracket, Seeds 5-6 start in Lower Bracket
}

export interface WildcardPlayInState {
  isInitialized: boolean;
  isCompleted: boolean;
  participants: WildcardParticipant[];
  matches: WildcardMatch[];
  qualifier1Id?: string; // Winner of Upper Bracket Final
  qualifier2Id?: string; // Winner of Lower Bracket Final
}

// --- SWISS PLAY-IN TYPES (4 Pools of 16 Idols -> 24 Direct + 4 Last Chance = 28 Qualifiers) ---
export type SwissPoolId = 'pool_a' | 'pool_b' | 'pool_c' | 'pool_d';

export interface SwissParticipant {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  photoUrl?: string;
  seed: string;
  leagueId: number;
  leagueName: string;
  leagueRank: number; // 7 to 18
  points: number; // League points
  gameDiff: number;
  gamesFor: number;
  poolId: SwissPoolId;
  potNumber: number; // 1 to 4
  poolSeed: number; // 1 to 16 within pool
  swissWins: number;
  swissLosses: number;
  swissGameDiff: number;
  swissGamesFor: number;
  swissGamesAgainst: number;
  buchholzScore: number; // Combined wins of opponents faced
  status: 'qualified' | 'last_chance' | 'contention' | 'eliminated';
  poolRank?: number; // 1 to 16 in pool
  qualificationReason?: string;
  lastChanceGroupId?: 'group_1' | 'group_2';
  lastChancePlayed?: number;
  lastChanceWon?: number;
  lastChanceDrawn?: number;
  lastChanceLost?: number;
  lastChancePoints?: number;
  lastChanceGF?: number;
  lastChanceGA?: number;
  lastChanceGD?: number;
}

export interface SwissMatch {
  id: string;
  poolId: SwissPoolId | 'last_chance';
  poolName: string;
  roundNumber: number; // 1, 2, 3, 4, 5
  roundName: string;
  matchNumber: number;
  matchday?: number; // 1 to 5 for Last Chance Round Robin
  idolAId: string | null;
  idolBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  loserId: string | null;
  completed: boolean;
  seriesLength?: 1 | 3 | 5;
  updatedAt?: string;
  isLastChance?: boolean;
  qualifierSlot?: number;
  bracketType?: 'high' | 'mid' | 'low' | 'decider';
}

export interface SwissPoolState {
  poolId: SwissPoolId;
  poolName: string;
  participantIds: string[];
  standings: SwissParticipant[];
  isCompleted: boolean;
  directQualifierIds: string[]; // 6 direct qualifiers per pool
  lastChanceCandidateIds?: string[]; // 3 contenders per pool (12 idols total across 4 pools)
  lastChanceCandidateId?: string; // backward-compat single id
}

export interface SwissPlayInState {
  isInitialized: boolean;
  isCompleted: boolean;
  participants: SwissParticipant[];
  pools: Record<string, SwissPoolState>;
  matches: SwissMatch[];
  lastChanceMatches: SwissMatch[];
  lastChanceStandings?: SwissParticipant[]; // 12-idol / 2-group Round Robin Standings
  lastChanceGroup1Standings?: SwissParticipant[]; // Group Alpha (6 idols)
  lastChanceGroup2Standings?: SwissParticipant[]; // Group Beta (6 idols)
  directQualifiers: string[]; // 24 idols (6 per pool * 4 pools)
  lastChanceQualifiers: string[]; // 4 idols (Top 2 from Group 1 + Top 2 from Group 2)
  allQualifiers: string[]; // 28 idols total
}

export interface LeagueSeasonState {
  seasonNumber: number;
  seasonName: string;
  isStarted: boolean;
  isCompleted: boolean;
  currentMatchday: number; // 1 to 38
  leagues: LeagueInfo[];
  championsAdvancementDone?: boolean;
  postseasonFormat?: PostseasonFormatType;
  wildcardPlayIn?: WildcardPlayInState;
  swissPlayIn?: SwissPlayInState;
}

export interface LeagueWinnerEntry {
  leagueId: number;
  leagueName: string;
  tierName: string;
  championId: string;
  championName: string;
  championGroup: string;
  championPhoto?: string;
  championNationality?: string;
  championSeed?: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gameDiff: number;
}

export interface LeagueQualifierEntry {
  idolId: string;
  idolName: string;
  girlGroup: string;
  seed: string;
  nationality: string;
  photoUrl?: string;
  leagueId: number;
  leagueName: string;
  rankInLeague: number;
  points: number;
  gameDiff: number;
  qualificationType: 'Automatic (Top 5)' | 'Automatic (Top 6)' | 'Wildcard (Play-In Qualifier)' | 'Wildcard (Swiss Top 4)' | 'Wildcard (Swiss Last Chance)' | 'Wildcard (Best 6th)' | string;
}

export interface LeagueSeasonArchive {
  seasonNumber: number;
  seasonName: string;
  completedAt: string;
  postseasonFormat?: PostseasonFormatType;
  leagueWinners: LeagueWinnerEntry[];
  allStandings: Record<number, LeagueStanding[]>;
  allMatches: LeagueMatch[];
  top32Qualifiers: LeagueQualifierEntry[];
  qualifiers?: LeagueQualifierEntry[];
  wildcardPlayIn?: WildcardPlayInState;
  swissPlayIn?: SwissPlayInState;
}

// --- PERSONAL RANKING TYPES ---
export interface PersonalRankingEntry {
  id: string;
  idolId: string;
  rank: number;
  tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  customRating: number; // e.g. 1-100 or 1-10
  notes: string;
  favoriteSong?: string;
  updatedAt: number;
}

export interface IdolAchievementSummary {
  idolId: string;
  idolName: string;
  photoUrl?: string;
  girlGroup: string;
  earnedBadges: IdolAchievementEarned[];
  totalScore: number;
  badgeCount: number;
}

// --- THE IDOLS (SUPERLEAGUE & MASTERS PLAYOFF) TYPES ---
export interface TheIdolsMatch {
  id: string; // e.g. "ti_md1_m1"
  matchday: number; // 1 to 19 (Single Round-Robin)
  idolAId: string;
  idolBId: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null; // null for draw or unplayed
  completed: boolean;
  updatedAt?: string;
}

export type TheIdolsPlayoffTier = 'upper_r3' | 'upper_r2' | 'upper_r1' | 'lower_r1' | 'eliminated';

export interface TheIdolsStanding {
  idolId: string;
  idolName: string;
  girlGroup: string;
  seed: string;
  nationality: string;
  photoUrl?: string;
  rating: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number; // 3 for win, 1 for draw, 0 for loss
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  rank: number;
  form: Array<'W' | 'D' | 'L'>;
  playoffSeed?: number; // 1 to 10 for qualifiers
  playoffTier?: TheIdolsPlayoffTier;
  playoffSpot?: boolean;
}

export interface TheIdolsPlayoffGameScore {
  gameNumber: number;
  scoreA: number;
  scoreB: number;
  winnerId: string;
}

export interface TheIdolsPlayoffMatch {
  id: string; // e.g. "ti_po_ub_r1_m1", "ti_po_gf"
  bracket: 'upper' | 'lower' | 'grand_final';
  roundCode: 'UB_R1' | 'UB_R2' | 'UB_R3' | 'UB_FINAL' | 'LB_R1' | 'LB_R2' | 'LB_R3' | 'LB_SEMI' | 'LB_FINAL' | 'GF' | 'GF_SET1' | 'GF_SET2';
  roundName: string; // "UB Round 1", "UB Quarterfinals", "UB Semifinals", "UB Final", "LB Round 1", "LB Quarterfinals", "LB Semifinals", "LB Final", "Grand Final"
  matchNumber: number;
  bestOf: 5 | 7; // Bo5 for all playoff matches, Bo7 for Grand Final
  targetWins: 3 | 4; // 3 for Bo5, 4 for Bo7
  idolAId: string | null;
  idolBId: string | null;
  scoreA: number; // Series score (games won by A)
  scoreB: number; // Series score (games won by B)
  games?: TheIdolsPlayoffGameScore[];
  winnerId: string | null;
  loserId?: string | null;
  completed: boolean;
  isBye?: boolean;
  isGrandFinalReset?: boolean; // Set 2 if bracket reset is triggered
  isResetActive?: boolean; // Whether GF Set 2 needs to be played
  feedsWinnerToMatchId?: string;
  feedsWinnerToSlot?: 'A' | 'B';
  feedsLoserToMatchId?: string;
  feedsLoserToSlot?: 'A' | 'B';
  updatedAt?: string;
}

export interface TheIdolsSeasonState {
  seasonNumber: number;
  seasonName: string;
  isStarted: boolean;
  isLeagueCompleted: boolean;
  isPlayoffCompleted: boolean;
  currentMatchday: number; // 1 to 19
  memberIds: string[]; // Top 20 highest-rated idol IDs
  matches: TheIdolsMatch[];
  standings: TheIdolsStanding[];
  playoffMatches: TheIdolsPlayoffMatch[];
  championId?: string;
  championName?: string;
  runnerUpId?: string;
  runnerUpName?: string;
  thirdPlaceId?: string;
  thirdPlaceName?: string;
  mvpId?: string;
  mvpName?: string;
  topScorerId?: string;
  topScorerName?: string;
  topScorerGoals?: number;
}

export interface TheIdolsSeasonArchive {
  seasonNumber: number;
  seasonName: string;
  completedAt: string;
  championId: string;
  championName: string;
  championGroup?: string;
  championPhoto?: string;
  championNationality?: string;
  runnerUpId: string;
  runnerUpName: string;
  thirdPlaceId?: string;
  thirdPlaceName?: string;
  mvpId?: string;
  mvpName?: string;
  topScorerId?: string;
  topScorerName?: string;
  topScorerGoals?: number;
  memberIds: string[];
  standings: TheIdolsStanding[];
  matches: TheIdolsMatch[];
  playoffMatches: TheIdolsPlayoffMatch[];
  totalMatches: number;
  totalGoals: number;
}

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
  customLeagueBranding?: any[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
}

export interface LeagueCareerStat {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  photoUrl?: string;
  seasonsPlayed: number;
  divisionTitles: number;
  podiums: number;
  championsQualifiers: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winRate: number;
}

export interface TheIdolsCareerStat {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  photoUrl?: string;
  seasonsPlayed: number;
  mastersTitles: number;
  mastersRunnerUps: number;
  mastersPodiums: number;
  superleagueTitles: number; // 1st in regular season
  totalTitles?: number; // combined mastersTitles + superleagueTitles
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winRate: number;
  playoffMatches: number;
  playoffWins: number;
  playoffLosses: number;
}


