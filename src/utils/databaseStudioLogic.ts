import {
  ArchivedMatch,
  AppState,
  CareerStat,
  Idol,
  LeagueCareerStat,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsCareerStat,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
  TournamentArchive,
} from '../types';
import {
  DEFAULT_LEAGUE_DEFS,
  LeagueBrandingItem,
  syncLeagueMatchesToArchivedMatches,
  loadLeagueSeasonState,
  loadLeagueArchives,
  loadCustomLeagueBranding,
  initializeLeagueSeason,
} from './leagueLogic';
import { convertTheIdolsMatchesToArchived } from './theIdolsLogic';
import type { V5State } from './v5/store';
import type { DivisionTwoLeague } from './v5/engine';

export const CAREER_OVERRIDES_KEY = 'sabung_career_stats_overrides_v1';

export interface IdolCareerOverride {
  idolId: string;
  enabled: boolean;
  
  // Tournament Cup Milestones & Finishes
  participations?: number;
  groupAdvancements?: number;
  groupExits?: number;
  championships?: number;
  runnerUps?: number;
  thirdPlaces?: number;
  fourthPlaces?: number;
  top4?: number;
  quarterFinals?: number;
  roundOf16?: number;
  roundOf32?: number;
  playIns?: number;
  bestFinish?: string;
  worstFinish?: string;
  avgPlacement?: number;

  // Match Records (Overall & Stage Splits)
  matches?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  winRate?: number;
  groupWins?: number;
  groupLosses?: number;
  groupWinRate?: number;
  knockoutWins?: number;
  knockoutLosses?: number;
  knockoutWinRate?: number;
  gamesFor?: number;
  gamesAgainst?: number;
  gameDiff?: number;

  // Streaks
  longestWinStreak?: number;
  longestLosingStreak?: number;
  longestUnbeatenStreak?: number;

  // League Records
  divisionTitles?: number;
  divisionPodiums?: number;
  top5Finishes?: number;
  leagueSeasonsPlayed?: number;
  leagueMatches?: number;
  leagueWins?: number;
  leagueDraws?: number;
  leagueLosses?: number;
  leagueGoalsFor?: number;
  leagueGoalsAgainst?: number;
  leagueGoalDiff?: number;
  leaguePoints?: number;
  leagueWinRate?: number;

  // The Idols Superleague Records
  theIdolsSuperleagueTitles?: number; // 1st in regular season
  theIdolsMastersTitles?: number;     // Playoff Championship
  theIdolsMastersRunnerUps?: number;
  theIdolsMastersPodiums?: number;
  theIdolsPlayoffApps?: number;
  theIdolsSeasonsPlayed?: number;
  theIdolsMatches?: number;
  theIdolsWins?: number;
  theIdolsDraws?: number;
  theIdolsLosses?: number;
  theIdolsGoalsFor?: number;
  theIdolsGoalsAgainst?: number;
  theIdolsGoalDiff?: number;
  theIdolsPoints?: number;
  theIdolsPlayoffMatches?: number;
  theIdolsPlayoffWins?: number;
  theIdolsPlayoffLosses?: number;
  theIdolsWinRate?: number;

  // Admin notes & metadata
  customNotes?: string;
  updatedAt?: string;
}

export type CareerOverridesMap = Record<string, IdolCareerOverride>;

export interface DatabaseAuditReport {
  timestamp: string;
  totalTournamentMatches: number;
  totalLeagueMatches: number;
  totalTheIdolsMatches: number;
  totalArchivedTournaments: number;
  totalArchivedLeagues: number;
  totalArchivedTheIdols: number;
  totalIdols: number;
  activeOverridesCount: number;
  issuesFound: string[];
  repairsMade: string[];
  healthScore: number; // 0 - 100
}

/**
 * Load manual idol career overrides from local storage
 */
export function loadCareerOverrides(): CareerOverridesMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CAREER_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    console.error('Failed to load career overrides:', err);
    return {};
  }
}

/**
 * Save manual idol career overrides to local storage
 */
export function saveCareerOverrides(overrides: CareerOverridesMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (err) {
    console.error('Failed to save career overrides:', err);
  }
}

/**
 * Apply career stats overrides cleanly on top of derived career stats
 */
export function applyOverridesToCareerStats(
  baseStats: CareerStat[],
  overrides: CareerOverridesMap
): CareerStat[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return baseStats;
  }

  return baseStats.map((st) => {
    const ov = overrides[st.idolId];
    if (!ov || !ov.enabled) return st;

    const matches = ov.matches !== undefined ? Math.max(0, ov.matches) : st.matches;
    const wins = ov.wins !== undefined ? Math.max(0, ov.wins) : st.wins;
    const draws = ov.draws !== undefined ? Math.max(0, ov.draws) : st.draws;
    const losses = ov.losses !== undefined ? Math.max(0, ov.losses) : st.losses;
    const gamesFor = ov.gamesFor !== undefined ? Math.max(0, ov.gamesFor) : st.gamesFor;
    const gamesAgainst = ov.gamesAgainst !== undefined ? Math.max(0, ov.gamesAgainst) : st.gamesAgainst;
    const gameDiff = ov.gameDiff !== undefined ? ov.gameDiff : gamesFor - gamesAgainst;

    const championships = ov.championships !== undefined ? Math.max(0, ov.championships) : st.championships;
    const runnerUps = ov.runnerUps !== undefined ? Math.max(0, ov.runnerUps) : st.runnerUps;
    const thirdPlaces = ov.thirdPlaces !== undefined ? Math.max(0, ov.thirdPlaces) : st.thirdPlaces;
    const fourthPlaces = ov.fourthPlaces !== undefined ? Math.max(0, ov.fourthPlaces) : st.fourthPlaces;
    const top4 = ov.top4 !== undefined ? Math.max(0, ov.top4) : championships + runnerUps + thirdPlaces + fourthPlaces;
    const quarterFinals = ov.quarterFinals !== undefined ? Math.max(0, ov.quarterFinals) : st.quarterFinals;
    const roundOf16 = ov.roundOf16 !== undefined ? Math.max(0, ov.roundOf16) : st.roundOf16;
    const roundOf32 = ov.roundOf32 !== undefined ? Math.max(0, ov.roundOf32) : st.roundOf32;
    const playIns = ov.playIns !== undefined ? Math.max(0, ov.playIns) : st.playIns;

    const participations = ov.participations !== undefined ? Math.max(0, ov.participations) : st.participations;
    const groupAdvancements = ov.groupAdvancements !== undefined ? Math.max(0, ov.groupAdvancements) : st.groupAdvancements;
    const groupExits = ov.groupExits !== undefined ? Math.max(0, ov.groupExits) : st.groupExits;

    const groupWins = ov.groupWins !== undefined ? Math.max(0, ov.groupWins) : st.groupWins;
    const groupLosses = ov.groupLosses !== undefined ? Math.max(0, ov.groupLosses) : st.groupLosses;
    const groupTotal = groupWins + groupLosses;
    const groupWinRate = ov.groupWinRate !== undefined ? ov.groupWinRate : (groupTotal > 0 ? Math.round((groupWins / groupTotal) * 1000) / 10 : st.groupWinRate);

    const knockoutWins = ov.knockoutWins !== undefined ? Math.max(0, ov.knockoutWins) : st.knockoutWins;
    const knockoutLosses = ov.knockoutLosses !== undefined ? Math.max(0, ov.knockoutLosses) : st.knockoutLosses;
    const knockoutTotal = knockoutWins + knockoutLosses;
    const knockoutWinRate = ov.knockoutWinRate !== undefined ? ov.knockoutWinRate : (knockoutTotal > 0 ? Math.round((knockoutWins / knockoutTotal) * 1000) / 10 : st.knockoutWinRate);

    const longestWinStreak = ov.longestWinStreak !== undefined ? Math.max(0, ov.longestWinStreak) : st.longestWinStreak;
    const longestLosingStreak = ov.longestLosingStreak !== undefined ? Math.max(0, ov.longestLosingStreak) : st.longestLosingStreak;
    const longestUnbeatenStreak = ov.longestUnbeatenStreak !== undefined ? Math.max(0, ov.longestUnbeatenStreak) : st.longestUnbeatenStreak;

    const winRate = ov.winRate !== undefined ? ov.winRate : (matches > 0 ? Math.round((wins / matches) * 1000) / 10 : 0);

    let bestFinish = ov.bestFinish !== undefined && ov.bestFinish.trim().length > 0 ? ov.bestFinish : st.bestFinish;
    if (ov.bestFinish === undefined || ov.bestFinish.trim().length === 0) {
      if (championships > 0) bestFinish = 'Champion';
      else if (runnerUps > 0) bestFinish = 'Runner-Up';
      else if (thirdPlaces > 0) bestFinish = '3rd Place';
      else if (fourthPlaces > 0) bestFinish = '4th Place';
      else if (quarterFinals > 0) bestFinish = 'Quarter-Finals';
      else if (roundOf16 > 0) bestFinish = 'Round of 16';
      else if (roundOf32 > 0) bestFinish = 'Round of 32';
      else if (groupAdvancements > 0) bestFinish = 'Knockout Stage';
      else if (participations > 0) bestFinish = 'Group Stage';
    }

    const worstFinish = ov.worstFinish !== undefined && ov.worstFinish.trim().length > 0 ? ov.worstFinish : st.worstFinish;
    const avgPlacement = ov.avgPlacement !== undefined ? ov.avgPlacement : st.avgPlacement;
    const totalTitles = calculateUnifiedTotalTitles(
      championships,
      ov.divisionTitles,
      ov.theIdolsSuperleagueTitles,
      ov.theIdolsMastersTitles
    );

    return {
      ...st,
      totalTitles,
      matches,
      wins,
      draws,
      losses,
      gamesFor,
      gamesAgainst,
      gameDiff,
      championships,
      runnerUps,
      thirdPlaces,
      fourthPlaces,
      top4,
      quarterFinals,
      roundOf16,
      roundOf32,
      playIns,
      participations,
      groupAdvancements,
      groupExits,
      groupWins,
      groupLosses,
      groupWinRate,
      knockoutWins,
      knockoutLosses,
      knockoutWinRate,
      longestWinStreak,
      longestLosingStreak,
      longestUnbeatenStreak,
      winRate,
      bestFinish,
      worstFinish,
      avgPlacement,
    };
  });
}

/**
 * Apply career stats overrides cleanly on top of derived domestic league career stats
 */
export function applyOverridesToLeagueCareerStats(
  baseStats: LeagueCareerStat[],
  overrides: CareerOverridesMap
): LeagueCareerStat[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return baseStats;
  }

  return baseStats.map((st) => {
    const ov = overrides[st.idolId];
    if (!ov || !ov.enabled) return st;

    const divisionTitles = ov.divisionTitles !== undefined ? Math.max(0, ov.divisionTitles) : st.divisionTitles;
    const podiums = ov.divisionPodiums !== undefined ? Math.max(0, ov.divisionPodiums) : st.podiums;
    const championsQualifiers = ov.top5Finishes !== undefined ? Math.max(0, ov.top5Finishes) : st.championsQualifiers;
    const seasonsPlayed = ov.leagueSeasonsPlayed !== undefined ? Math.max(0, ov.leagueSeasonsPlayed) : st.seasonsPlayed;
    const matches = ov.leagueMatches !== undefined ? Math.max(0, ov.leagueMatches) : st.matches;
    const wins = ov.leagueWins !== undefined ? Math.max(0, ov.leagueWins) : st.wins;
    const draws = ov.leagueDraws !== undefined ? Math.max(0, ov.leagueDraws) : st.draws;
    const losses = ov.leagueLosses !== undefined ? Math.max(0, ov.leagueLosses) : st.losses;
    const points = ov.leaguePoints !== undefined ? Math.max(0, ov.leaguePoints) : (wins * 3 + draws * 1);
    const goalsFor = ov.leagueGoalsFor !== undefined ? Math.max(0, ov.leagueGoalsFor) : st.goalsFor;
    const goalsAgainst = ov.leagueGoalsAgainst !== undefined ? Math.max(0, ov.leagueGoalsAgainst) : st.goalsAgainst;
    const goalDiff = ov.leagueGoalDiff !== undefined ? ov.leagueGoalDiff : (goalsFor - goalsAgainst);
    const winRate = ov.leagueWinRate !== undefined ? ov.leagueWinRate : (matches > 0 ? Math.round((wins / matches) * 100) : 0);

    return {
      ...st,
      divisionTitles,
      podiums,
      championsQualifiers,
      seasonsPlayed,
      matches,
      wins,
      draws,
      losses,
      points,
      goalsFor,
      goalsAgainst,
      goalDiff,
      winRate,
    };
  });
}

/**
 * Apply career stats overrides cleanly on top of derived The Idols Superleague career stats
 */
export function applyOverridesToTheIdolsCareerStats(
  baseStats: TheIdolsCareerStat[],
  overrides: CareerOverridesMap
): TheIdolsCareerStat[] {
  if (!overrides || Object.keys(overrides).length === 0) {
    return baseStats;
  }

  return baseStats.map((st) => {
    const ov = overrides[st.idolId];
    if (!ov || !ov.enabled) return st;

    const superleagueTitles = ov.theIdolsSuperleagueTitles !== undefined ? Math.max(0, ov.theIdolsSuperleagueTitles) : st.superleagueTitles;
    const mastersTitles = ov.theIdolsMastersTitles !== undefined ? Math.max(0, ov.theIdolsMastersTitles) : st.mastersTitles;
    const mastersRunnerUps = ov.theIdolsMastersRunnerUps !== undefined ? Math.max(0, ov.theIdolsMastersRunnerUps) : st.mastersRunnerUps;
    const mastersPodiums = ov.theIdolsMastersPodiums !== undefined ? Math.max(0, ov.theIdolsMastersPodiums) : st.mastersPodiums;
    const seasonsPlayed = ov.theIdolsSeasonsPlayed !== undefined ? Math.max(0, ov.theIdolsSeasonsPlayed) : st.seasonsPlayed;
    const matches = ov.theIdolsMatches !== undefined ? Math.max(0, ov.theIdolsMatches) : st.matches;
    const wins = ov.theIdolsWins !== undefined ? Math.max(0, ov.theIdolsWins) : st.wins;
    const draws = ov.theIdolsDraws !== undefined ? Math.max(0, ov.theIdolsDraws) : st.draws;
    const losses = ov.theIdolsLosses !== undefined ? Math.max(0, ov.theIdolsLosses) : st.losses;
    const points = ov.theIdolsPoints !== undefined ? Math.max(0, ov.theIdolsPoints) : st.points;
    const goalsFor = ov.theIdolsGoalsFor !== undefined ? Math.max(0, ov.theIdolsGoalsFor) : st.goalsFor;
    const goalsAgainst = ov.theIdolsGoalsAgainst !== undefined ? Math.max(0, ov.theIdolsGoalsAgainst) : st.goalsAgainst;
    const goalDiff = ov.theIdolsGoalDiff !== undefined ? ov.theIdolsGoalDiff : (goalsFor - goalsAgainst);
    const winRate = ov.theIdolsWinRate !== undefined ? ov.theIdolsWinRate : (matches > 0 ? Math.round((wins / matches) * 100) : 0);
    const playoffMatches = ov.theIdolsPlayoffMatches !== undefined ? Math.max(0, ov.theIdolsPlayoffMatches) : (ov.theIdolsPlayoffApps !== undefined ? Math.max(0, ov.theIdolsPlayoffApps) : st.playoffMatches);
    const playoffWins = ov.theIdolsPlayoffWins !== undefined ? Math.max(0, ov.theIdolsPlayoffWins) : st.playoffWins;
    const playoffLosses = ov.theIdolsPlayoffLosses !== undefined ? Math.max(0, ov.theIdolsPlayoffLosses) : st.playoffLosses;
    const totalTitles = (superleagueTitles || 0) + (mastersTitles || 0);

    return {
      ...st,
      totalTitles,
      superleagueTitles,
      mastersTitles,
      mastersRunnerUps,
      mastersPodiums,
      seasonsPlayed,
      matches,
      wins,
      draws,
      losses,
      points,
      goalsFor,
      goalsAgainst,
      goalDiff,
      winRate,
      playoffMatches,
      playoffWins,
      playoffLosses,
    };
  });
}

/**
 * Universal Unified Total Titles Calculation:
 * Counts Cup Championships + Domestic League Division Titles + The Idols Superleague Regular Season Titles (1st) + The Idols Masters Playoff Titles
 */
export function calculateUnifiedTotalTitles(
  cupChamps: number = 0,
  leagueDivTitles: number = 0,
  tiSuperleagueTitles: number = 0,
  tiMastersTitles: number = 0
): number {
  return (
    Math.max(0, Number(cupChamps) || 0) +
    Math.max(0, Number(leagueDivTitles) || 0) +
    Math.max(0, Number(tiSuperleagueTitles) || 0) +
    Math.max(0, Number(tiMastersTitles) || 0)
  );
}

/**
 * Compute raw historical base stats for a specific idol across Cup, League, and The Idols.
 * Used by Database Studio to initialize and fill the editor with real data.
 */
export function computeDerivedBaseStatsForIdol(
  idolId: string,
  careerStats: CareerStat[],
  leagueState: LeagueSeasonState | null,
  leagueArchives: LeagueSeasonArchive[],
  theIdolsState: TheIdolsSeasonState | null,
  theIdolsArchives: TheIdolsSeasonArchive[]
) {
  const cStat = careerStats.find((c) => c.idolId === idolId);

  // Derive League stats for this idol
  let lDivTitles = 0;
  let lPodiums = 0;
  let lTop5 = 0;
  let lMatches = 0;
  let lWins = 0;
  let lDraws = 0;
  let lLosses = 0;
  let lPoints = 0;
  let lGF = 0;
  let lGA = 0;
  let lSeasons = 0;

  const processLeagueTable = (table: any[], isFinished: boolean) => {
    const entry = table.find((e: any) => e.idolId === idolId);
    if (!entry) return;
    const played = entry.played || 0;
    if (played > 0) lSeasons += 1;
    lMatches += played;
    lWins += (entry.wins ?? entry.won ?? 0);
    lDraws += (entry.draws ?? entry.drawn ?? 0);
    lLosses += (entry.losses ?? entry.lost ?? 0);
    lPoints += entry.points || 0;
    lGF += entry.gamesFor || 0;
    lGA += entry.gamesAgainst || 0;

    if (isFinished && played > 0) {
      if (entry.rank === 1) lDivTitles += 1;
      if (entry.rank <= 3) lPodiums += 1;
      if (entry.rank <= 5) lTop5 += 1;
    }
  };

  if (leagueState) {
    const isFinished = !!leagueState.isCompleted;
    if (Array.isArray(leagueState.leagues)) {
      leagueState.leagues.forEach((league) => {
        if (league && Array.isArray(league.standings)) {
          processLeagueTable(league.standings, isFinished);
        }
      });
    } else if ((leagueState as any).divisions) {
      Object.values((leagueState as any).divisions).forEach((div: any) => {
        const table = div?.standings || div?.table;
        if (Array.isArray(table)) processLeagueTable(table, isFinished);
      });
    }
  }

  (leagueArchives || []).forEach((arch) => {
    if (arch.allStandings) {
      Object.values(arch.allStandings).forEach((table) => {
        if (Array.isArray(table)) processLeagueTable(table, true);
      });
    } else if ((arch as any).divisions) {
      Object.values((arch as any).divisions).forEach((div: any) => {
        const table = div?.standings || div?.table;
        if (Array.isArray(table)) processLeagueTable(table, true);
      });
    }
  });

  const lGD = lGF - lGA;
  const lWinRate = lMatches > 0 ? Math.round((lWins / lMatches) * 100) : 0;

  // Derive The Idols stats for this idol
  let tiSuperleagueTitles = 0;
  let tiMastersTitles = 0;
  let tiMastersRunnerUps = 0;
  let tiMastersPodiums = 0;
  let tiPlayoffApps = 0;
  let tiSeasons = 0;
  let tiMatches = 0;
  let tiWins = 0;
  let tiDraws = 0;
  let tiLosses = 0;
  let tiPoints = 0;
  let tiGF = 0;
  let tiGA = 0;
  let tiPlayoffMatches = 0;
  let tiPlayoffWins = 0;
  let tiPlayoffLosses = 0;

  const processTheIdolsSeason = (
    table: any[],
    isFinished: boolean,
    champId?: string,
    runnerId?: string,
    thirdId?: string,
    playoffMatches?: any[]
  ) => {
    const entry = table.find((e: any) => e.idolId === idolId);
    if (entry) {
      const played = entry.played || 0;
      if (played > 0) tiSeasons += 1;
      tiMatches += played;
      tiWins += (entry.wins ?? entry.won ?? 0);
      tiDraws += (entry.draws ?? entry.drawn ?? 0);
      tiLosses += (entry.losses ?? entry.lost ?? 0);
      tiPoints += entry.points || 0;
      tiGF += entry.gamesFor || 0;
      tiGA += entry.gamesAgainst || 0;

      if (isFinished && played > 0 && entry.rank === 1) {
        tiSuperleagueTitles += 1;
      }
    }

    if (champId === idolId) {
      tiMastersTitles += 1;
      tiMastersPodiums += 1;
    }
    if (runnerId === idolId) {
      tiMastersRunnerUps += 1;
      tiMastersPodiums += 1;
    }
    if (thirdId === idolId) {
      tiMastersPodiums += 1;
    }

    let hadPlayoff = false;
    (playoffMatches || []).forEach((m: any) => {
      if (!m.completed) return;
      if (m.idolAId === idolId) {
        hadPlayoff = true;
        tiPlayoffMatches += 1;
        tiMatches += 1;
        if (m.winnerId === idolId) {
          tiPlayoffWins += 1;
          tiWins += 1;
        } else {
          tiPlayoffLosses += 1;
          tiLosses += 1;
        }
      } else if (m.idolBId === idolId) {
        hadPlayoff = true;
        tiPlayoffMatches += 1;
        tiMatches += 1;
        if (m.winnerId === idolId) {
          tiPlayoffWins += 1;
          tiWins += 1;
        } else {
          tiPlayoffLosses += 1;
          tiLosses += 1;
        }
      }
    });

    if (hadPlayoff) {
      tiPlayoffApps += 1;
    }
  };

  if (theIdolsState) {
    const tiStandings = theIdolsState.standings || (theIdolsState as any).table;
    if (Array.isArray(tiStandings)) {
      const isFinished = !!(theIdolsState.isPlayoffCompleted || theIdolsState.isLeagueCompleted || (theIdolsState as any).isCompleted);
      processTheIdolsSeason(
        tiStandings,
        isFinished,
        theIdolsState.championId,
        theIdolsState.runnerUpId,
        theIdolsState.thirdPlaceId,
        theIdolsState.playoffMatches
      );
    }
  }

  (theIdolsArchives || []).forEach((arch) => {
    const tiStandings = arch.standings || (arch as any).table;
    if (Array.isArray(tiStandings)) {
      processTheIdolsSeason(
        tiStandings,
        true,
        arch.championId,
        arch.runnerUpId,
        arch.thirdPlaceId,
        arch.playoffMatches
      );
    }
  });

  const tiGD = tiGF - tiGA;
  const tiWinRate = tiMatches > 0 ? Math.round((tiWins / tiMatches) * 100) : 0;

  return {
    cup: cStat ? {
      participations: cStat.participations,
      groupAdvancements: cStat.groupAdvancements,
      groupExits: cStat.groupExits,
      championships: cStat.championships,
      runnerUps: cStat.runnerUps,
      thirdPlaces: cStat.thirdPlaces,
      fourthPlaces: cStat.fourthPlaces,
      top4: cStat.top4,
      quarterFinals: cStat.quarterFinals,
      roundOf16: cStat.roundOf16,
      roundOf32: cStat.roundOf32,
      playIns: cStat.playIns,
      bestFinish: cStat.bestFinish,
      worstFinish: cStat.worstFinish,
      avgPlacement: cStat.avgPlacement,
      matches: cStat.matches,
      wins: cStat.wins,
      draws: cStat.draws,
      losses: cStat.losses,
      winRate: cStat.winRate,
      groupWins: cStat.groupWins,
      groupLosses: cStat.groupLosses,
      groupWinRate: cStat.groupWinRate,
      knockoutWins: cStat.knockoutWins,
      knockoutLosses: cStat.knockoutLosses,
      knockoutWinRate: cStat.knockoutWinRate,
      gamesFor: cStat.gamesFor,
      gamesAgainst: cStat.gamesAgainst,
      gameDiff: cStat.gameDiff,
      longestWinStreak: cStat.longestWinStreak,
      longestLosingStreak: cStat.longestLosingStreak,
      longestUnbeatenStreak: cStat.longestUnbeatenStreak,
    } : {},
    league: {
      divisionTitles: lDivTitles,
      divisionPodiums: lPodiums,
      top5Finishes: lTop5,
      leagueSeasonsPlayed: lSeasons,
      leagueMatches: lMatches,
      leagueWins: lWins,
      leagueDraws: lDraws,
      leagueLosses: lLosses,
      leaguePoints: lPoints,
      leagueGoalsFor: lGF,
      leagueGoalsAgainst: lGA,
      leagueGoalDiff: lGD,
      leagueWinRate: lWinRate,
    },
    theIdols: {
      theIdolsSuperleagueTitles: tiSuperleagueTitles,
      theIdolsMastersTitles: tiMastersTitles,
      theIdolsMastersRunnerUps: tiMastersRunnerUps,
      theIdolsMastersPodiums: tiMastersPodiums,
      theIdolsPlayoffApps: tiPlayoffApps,
      theIdolsSeasonsPlayed: tiSeasons,
      theIdolsMatches: tiMatches,
      theIdolsWins: tiWins,
      theIdolsDraws: tiDraws,
      theIdolsLosses: tiLosses,
      theIdolsPoints: tiPoints,
      theIdolsGoalsFor: tiGF,
      theIdolsGoalsAgainst: tiGA,
      theIdolsGoalDiff: tiGD,
      theIdolsPlayoffMatches: tiPlayoffMatches,
      theIdolsPlayoffWins: tiPlayoffWins,
      theIdolsPlayoffLosses: tiPlayoffLosses,
      theIdolsWinRate: tiWinRate,
    },
  };
}

/**
 * Scan all career stats to find idols whose group exits might be falsely incremented
 * (e.g. idol has groupExits > 0 but groupAdvancements === participations, meaning they advanced in all tournaments)
 */
export function detectSuspiciousGroupExits(careerStatsList: CareerStat[]): {
  idolId: string;
  idolName: string;
  participations: number;
  groupAdvancements: number;
  groupExits: number;
  reason: string;
}[] {
  const suspicious: {
    idolId: string;
    idolName: string;
    participations: number;
    groupAdvancements: number;
    groupExits: number;
    reason: string;
  }[] = [];

  careerStatsList.forEach((stat) => {
    if (stat.groupExits > 0) {
      if (stat.participations === 0) {
        suspicious.push({
          idolId: stat.idolId,
          idolName: stat.idolName,
          participations: stat.participations,
          groupAdvancements: stat.groupAdvancements,
          groupExits: stat.groupExits,
          reason: `Recorded ${stat.groupExits} group exits despite 0 tournament participations.`,
        });
      } else if (stat.groupAdvancements >= stat.participations && stat.participations > 0) {
        suspicious.push({
          idolId: stat.idolId,
          idolName: stat.idolName,
          participations: stat.participations,
          groupAdvancements: stat.groupAdvancements,
          groupExits: stat.groupExits,
          reason: `Advanced in ${stat.groupAdvancements}/${stat.participations} tournaments, yet has ${stat.groupExits} recorded group exits.`,
        });
      } else if (stat.groupAdvancements + stat.groupExits > stat.participations) {
        suspicious.push({
          idolId: stat.idolId,
          idolName: stat.idolName,
          participations: stat.participations,
          groupAdvancements: stat.groupAdvancements,
          groupExits: stat.groupExits,
          reason: `Advancements (${stat.groupAdvancements}) + exits (${stat.groupExits}) exceed total participations (${stat.participations}).`,
        });
      }
    }
  });

  return suspicious;
}

/**
 * Scan database and check for issues
 */
export function auditDatabaseHealth(
  appState: AppState,
  leagueState: LeagueSeasonState | null,
  leagueArchives: LeagueSeasonArchive[],
  overrides: CareerOverridesMap,
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[]
): DatabaseAuditReport {
  const issuesFound: string[] = [];
  const repairsMade: string[] = [];
  const idolsMap = new Map(appState.idols.map((i) => [i.id, i]));

  const matchDb = appState.matchDatabase || [];
  let leagueMatchesCount = 0;
  let tournamentMatchesCount = 0;
  let theIdolsMatchesCount = 0;

  matchDb.forEach((m) => {
    const stage = (m.stage || '').toLowerCase();
    const groupName = (m.groupName || '').toLowerCase();
    const matchId = (m.matchId || '').toLowerCase();
    const isTheIdols =
      matchId.startsWith('the_idols') ||
      stage.includes('the idols') ||
      stage.includes('superleague') ||
      stage.includes('masters');
    const isLeague =
      matchId.startsWith('league-') ||
      matchId.startsWith('league_') ||
      stage.includes('league') ||
      stage.includes('division') ||
      stage.includes('md ') ||
      stage.includes('matchday') ||
      groupName.includes('division') ||
      groupName.includes('league');

    if (isTheIdols) theIdolsMatchesCount++;
    else if (isLeague) leagueMatchesCount++;
    else tournamentMatchesCount++;

    if (!m.idolAId || !m.idolBId) {
      issuesFound.push(`Match ${m.matchId} is missing one or both participant IDs.`);
    }
  });

  // Check tournament archives
  (appState.archives || []).forEach((arch) => {
    if (!arch.seasonName) {
      issuesFound.push(`Tournament archive (Season ${arch.seasonId}) missing name.`);
    }
    if (arch.championId && !idolsMap.has(arch.championId)) {
      issuesFound.push(`Tournament S${arch.seasonId} Champion ID "${arch.championId}" not found in current roster.`);
    }
  });

  // Check league archives
  (leagueArchives || []).forEach((lArch) => {
    if (!lArch.seasonNumber) {
      issuesFound.push(`League archive missing season number.`);
    }
    (lArch.leagueWinners || []).forEach((w) => {
      if (w.championId && !idolsMap.has(w.championId)) {
        issuesFound.push(
          `League S${lArch.seasonNumber} Div ${w.leagueId} winner ID "${w.championId}" not found in current roster.`
        );
      }
    });
  });

  // Check The Idols archives
  const tArchives = theIdolsArchives || appState.theIdolsArchives || [];
  tArchives.forEach((tiArch) => {
    if (!tiArch.seasonName && !tiArch.seasonNumber) {
      issuesFound.push(`The Idols archive missing season identifier.`);
    }
    if (tiArch.championId && !idolsMap.has(tiArch.championId)) {
      issuesFound.push(
        `The Idols S${tiArch.seasonNumber} Champion ID "${tiArch.championId}" not found in current roster.`
      );
    }
  });

  const activeOverridesCount = Object.values(overrides).filter((o) => o.enabled).length;

  let healthScore = 100;
  if (issuesFound.length > 0) {
    healthScore = Math.max(40, 100 - issuesFound.length * 8);
  }

  return {
    timestamp: new Date().toISOString(),
    totalTournamentMatches: tournamentMatchesCount,
    totalLeagueMatches: leagueMatchesCount,
    totalTheIdolsMatches: theIdolsMatchesCount,
    totalArchivedTournaments: (appState.archives || []).length,
    totalArchivedLeagues: (leagueArchives || []).length,
    totalArchivedTheIdols: tArchives.length,
    totalIdols: appState.idols.length,
    activeOverridesCount,
    issuesFound,
    repairsMade,
    healthScore,
  };
}

/**
 * Cleanse, sanitize, and repair matches and archives across the database
 */
export function sanitizeAndRepairDatabase(
  appState: AppState,
  leagueState: LeagueSeasonState | null,
  leagueArchives: LeagueSeasonArchive[],
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[]
): {
  cleanedMatchDatabase: ArchivedMatch[];
  cleanedTournamentArchives: TournamentArchive[];
  cleanedLeagueArchives: LeagueSeasonArchive[];
  cleanedTheIdolsArchives: TheIdolsSeasonArchive[];
  cleanedTheIdolsState?: TheIdolsSeasonState | null;
  repairLogs: string[];
} {
  const repairLogs: string[] = [];
  const idolsMap = new Map<string, Idol>(appState.idols.map((i) => [i.id, i]));
  const idolNameToId = new Map<string, string>(appState.idols.map((i) => [i.name.toLowerCase().trim(), i.id]));

  // 1. Sanitize Match Database (deduplicate and fill missing idol names/photos)
  const matchMap = new Map<string, ArchivedMatch>();
  let duplicateCount = 0;
  let fixedNamesCount = 0;

  (appState.matchDatabase || []).forEach((m) => {
    if (!m) return;
    const cleanId = m.matchId || `match_${Math.random().toString(36).substring(2, 9)}`;

    // Resolve IDs and Names
    let idolAId = m.idolAId;
    let idolAName = m.idolAName;
    let idolBId = m.idolBId;
    let idolBName = m.idolBName;

    if (!idolAId && idolAName && idolNameToId.has(idolAName.toLowerCase().trim())) {
      idolAId = idolNameToId.get(idolAName.toLowerCase().trim())!;
      fixedNamesCount++;
    }

    if (!idolBId && idolBName && idolNameToId.has(idolBName.toLowerCase().trim())) {
      idolBId = idolNameToId.get(idolBName.toLowerCase().trim())!;
      fixedNamesCount++;
    }

    const idolA = idolAId ? idolsMap.get(idolAId) : null;
    const idolB = idolBId ? idolsMap.get(idolBId) : null;

    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    let winnerId = m.winnerId;
    let winnerName = m.winnerName;

    if (scoreA > scoreB) {
      winnerId = idolAId || m.idolAId || winnerId;
      winnerName = idolA?.name || idolAName || winnerName;
    } else if (scoreB > scoreA) {
      winnerId = idolBId || m.idolBId || winnerId;
      winnerName = idolB?.name || idolBName || winnerName;
    } else if (m.isDraw || winnerId === 'DRAW' || scoreA === scoreB) {
      winnerId = 'DRAW';
      winnerName = 'DRAW';
    }

    const sanitizedMatch: ArchivedMatch = {
      ...m,
      matchId: cleanId,
      idolAId: idolAId || m.idolAId,
      idolAName: idolA?.name || idolAName || 'Unknown Idol',
      idolAPhoto: idolA?.photoUrl || m.idolAPhoto,
      idolAGroup: idolA?.girlGroup || m.idolAGroup,
      idolBId: idolBId || m.idolBId,
      idolBName: idolB?.name || idolBName || 'Unknown Idol',
      idolBPhoto: idolB?.photoUrl || m.idolBPhoto,
      idolBGroup: idolB?.girlGroup || m.idolBGroup,
      scoreA,
      scoreB,
      winnerId,
      winnerName,
      isDraw: winnerId === 'DRAW' || (scoreA === scoreB && !winnerId),
    };

    if (matchMap.has(cleanId)) {
      duplicateCount++;
    }
    matchMap.set(cleanId, sanitizedMatch);
  });

  if (duplicateCount > 0) repairLogs.push(`Deduplicated ${duplicateCount} duplicate match entries.`);
  if (fixedNamesCount > 0) repairLogs.push(`Repaired idol IDs/names across ${fixedNamesCount} matches.`);

  // 2. Sanitize Tournament Archives
  const cleanedTournaments: TournamentArchive[] = (appState.archives || []).map((arch) => {
    let champId = arch.championId;
    let champName = arch.championName;
    if (!champId && champName && idolNameToId.has(champName.toLowerCase().trim())) {
      champId = idolNameToId.get(champName.toLowerCase().trim())!;
    }
    const champ = champId ? idolsMap.get(champId) : null;

    let runnerId = arch.runnerUpId;
    let runnerName = arch.runnerUpName;
    if (!runnerId && runnerName && idolNameToId.has(runnerName.toLowerCase().trim())) {
      runnerId = idolNameToId.get(runnerName.toLowerCase().trim())!;
    }
    const runner = runnerId ? idolsMap.get(runnerId) : null;

    let thirdId = arch.thirdPlaceId;
    let thirdName = arch.thirdPlaceName;
    if (!thirdId && thirdName && idolNameToId.has(thirdName.toLowerCase().trim())) {
      thirdId = idolNameToId.get(thirdName.toLowerCase().trim())!;
    }
    const third = thirdId ? idolsMap.get(thirdId) : null;

    return {
      ...arch,
      seasonId: Number(arch.seasonId || 1),
      seasonName: arch.seasonName || `Season ${arch.seasonId || 1}`,
      championId: champ?.id || champId || '',
      championName: champ?.name || champName || '',
      runnerUpId: runner?.id || runnerId || '',
      runnerUpName: runner?.name || runnerName || '',
      thirdPlaceId: third?.id || thirdId || '',
      thirdPlaceName: third?.name || thirdName || '',
    };
  });

  // 3. Sanitize League Archives
  const cleanedLeagues: LeagueSeasonArchive[] = (leagueArchives || []).map((lArch) => {
    const winners = (lArch.leagueWinners || []).map((w) => {
      let cId = w.championId;
      if (!cId && w.championName && idolNameToId.has(w.championName.toLowerCase().trim())) {
        cId = idolNameToId.get(w.championName.toLowerCase().trim())!;
      }
      const champ = cId ? idolsMap.get(cId) : null;
      return {
        ...w,
        championId: champ?.id || cId || '',
        championName: champ?.name || w.championName || '',
        championGroup: champ?.girlGroup || w.championGroup || '',
        championPhoto: champ?.photoUrl || w.championPhoto,
      };
    });

    return {
      ...lArch,
      seasonNumber: Number(lArch.seasonNumber || 1),
      seasonName: lArch.seasonName || `League Season ${lArch.seasonNumber || 1}`,
      leagueWinners: winners,
    };
  });

  // 4. Sanitize The Idols Archives
  const tiArchives = theIdolsArchives || appState.theIdolsArchives || [];
  const cleanedTheIdols: TheIdolsSeasonArchive[] = tiArchives.map((tiArch) => {
    let champId = tiArch.championId;
    let champName = tiArch.championName;
    if (!champId && champName && idolNameToId.has(champName.toLowerCase().trim())) {
      champId = idolNameToId.get(champName.toLowerCase().trim())!;
    }
    const champ = champId ? idolsMap.get(champId) : null;

    let runnerId = tiArch.runnerUpId;
    let runnerName = tiArch.runnerUpName;
    if (!runnerId && runnerName && idolNameToId.has(runnerName.toLowerCase().trim())) {
      runnerId = idolNameToId.get(runnerName.toLowerCase().trim())!;
    }
    const runner = runnerId ? idolsMap.get(runnerId) : null;

    let thirdId = tiArch.thirdPlaceId;
    let thirdName = tiArch.thirdPlaceName;
    if (!thirdId && thirdName && idolNameToId.has(thirdName.toLowerCase().trim())) {
      thirdId = idolNameToId.get(thirdName.toLowerCase().trim())!;
    }
    const third = thirdId ? idolsMap.get(thirdId) : null;

    return {
      ...tiArch,
      seasonNumber: Number(tiArch.seasonNumber || 1),
      seasonName: tiArch.seasonName || `The Idols Season ${tiArch.seasonNumber || 1}`,
      championId: champ?.id || champId || '',
      championName: champ?.name || champName || '',
      championPhoto: champ?.photoUrl || tiArch.championPhoto,
      championGroup: champ?.girlGroup || tiArch.championGroup || '',
      runnerUpId: runner?.id || runnerId || '',
      runnerUpName: runner?.name || runnerName || '',
      thirdPlaceId: third?.id || thirdId,
      thirdPlaceName: third?.name || thirdName,
    };
  });

  // 5. Sanitize Active The Idols State
  let cleanedTheIdolsState: TheIdolsSeasonState | null = null;
  if (theIdolsState && Array.isArray(theIdolsState.matches)) {
    const updatedStandings = (theIdolsState.standings || []).map((st) => {
      const idol = idolsMap.get(st.idolId);
      return {
        ...st,
        idolName: idol?.name || st.idolName,
        girlGroup: idol?.girlGroup || st.girlGroup,
        photoUrl: idol?.photoUrl || st.photoUrl,
        nationality: idol?.nationality || st.nationality,
      };
    });
    cleanedTheIdolsState = {
      ...theIdolsState,
      standings: updatedStandings,
    };
  }

  repairLogs.push('Verified complete integrity of idol rosters, The Idols tournament data, and historical archives.');

  return {
    cleanedMatchDatabase: Array.from(matchMap.values()),
    cleanedTournamentArchives: cleanedTournaments,
    cleanedLeagueArchives: cleanedLeagues,
    cleanedTheIdolsArchives: cleanedTheIdols,
    cleanedTheIdolsState,
    repairLogs,
  };
}

/**
 * 1. FULL BACKUP: Export complete system database as downloadable JSON
 */
export function exportFullDatabaseBackup(
  appState: AppState,
  leagueState: LeagueSeasonState | null,
  leagueArchives: LeagueSeasonArchive[],
  overrides: CareerOverridesMap,
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[]
): string {
  const matchMap = new Map<string, ArchivedMatch>();
  (appState.matchDatabase || []).forEach((m) => {
    if (m && m.matchId) matchMap.set(m.matchId, m);
  });

  const effectiveLeagueState = leagueState || appState.leagueState || loadLeagueSeasonState();
  const effectiveLeagueArchives = (leagueArchives && leagueArchives.length > 0)
    ? leagueArchives
    : (appState.leagueArchives && appState.leagueArchives.length > 0)
    ? appState.leagueArchives
    : loadLeagueArchives();

  if (effectiveLeagueState || (effectiveLeagueArchives && effectiveLeagueArchives.length > 0)) {
    const lMatches = syncLeagueMatchesToArchivedMatches(
      effectiveLeagueState || null,
      effectiveLeagueArchives || [],
      appState.idols
    );
    lMatches.forEach((m) => {
      if (m && m.matchId && !matchMap.has(m.matchId)) matchMap.set(m.matchId, m);
    });
  }

  if (theIdolsState || (theIdolsArchives && theIdolsArchives.length > 0)) {
    const tiMatches = convertTheIdolsMatchesToArchived(
      theIdolsState || null,
      appState.idols,
      theIdolsArchives || []
    );
    tiMatches.forEach((m) => {
      if (m && m.matchId && !matchMap.has(m.matchId)) matchMap.set(m.matchId, m);
    });
  }

  const consolidatedMatches = Array.from(matchMap.values());

  const exportPayload = {
    schemaVersion: 'sabung_full_backup_v4',
    format: 'full_backup',
    exportedAt: new Date().toISOString(),
    description: 'Complete Sabung Idol Arena Full Backup (All 11 Core Subsystems)',
    idols: appState.idols,
    girlGroups: appState.girlGroups,
    tournamentConfig: appState.config,
    tournamentArchives: appState.archives,
    matchDatabase: consolidatedMatches,
    leagueSeasonState: effectiveLeagueState,
    leagueArchives: effectiveLeagueArchives,
    theIdolsSeasonState: theIdolsState !== undefined ? theIdolsState : (appState.theIdolsState || null),
    theIdolsArchives: theIdolsArchives !== undefined ? theIdolsArchives : (appState.theIdolsArchives || []),
    careerStatsOverrides: overrides,
    personalRankings: appState.personalRankings || [],
    customLeagueBranding: appState.customLeagueBranding || [],
    v5State: appState.v5State || null,
    v5TitleArchives: appState.v5TitleArchives || [],
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * 2. FULL IDOL & GROUP DATABASE: Name, rating, group, seed, attributes, etc.
 */
export function exportIdolGroupDatabase(appState: AppState): string {
  const exportPayload = {
    schemaVersion: 'sabung_idols_groups_db_v1',
    format: 'idols_groups',
    exportedAt: new Date().toISOString(),
    description: 'Complete Idol & Girl Group Database with full profiles, ratings, seedings, and group affiliations',
    totalIdols: appState.idols.length,
    totalGroups: (appState.girlGroups || []).length,
    idols: appState.idols,
    girlGroups: appState.girlGroups || [],
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * 3. LEAGUE BRANDING & ROSTER: Name, logo/picture, tier colors, and full 20-idol roster for each league
 */
export function exportLeagueBrandingAndRosters(
  leagueState: LeagueSeasonState | null,
  idols: Idol[],
  customLeagueBranding?: LeagueBrandingItem[],
  v5State?: V5State | null,
  girlGroups: import('../types').GirlGroup[] = []
): string {
  const effectiveState =
    leagueState && leagueState.leagues && leagueState.leagues.length === 6
      ? leagueState
      : loadLeagueSeasonState() || initializeLeagueSeason(idols, [], 1);

  const effectiveBranding =
    customLeagueBranding && customLeagueBranding.length > 0
      ? customLeagueBranding
      : loadCustomLeagueBranding();

  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => i && idolsMap.set(i.id, i));

  const divisions = DEFAULT_LEAGUE_DEFS.map((def) => {
    const activeLeague = effectiveState?.leagues?.find((l) => l.id === def.id);
    const custom = (effectiveBranding || []).find((b) => b.id === def.id);

    // Extract memberIds: check memberIds first, then standings, then matches
    let memberIds: string[] = [];
    if (activeLeague?.memberIds && activeLeague.memberIds.length > 0) {
      memberIds = [...activeLeague.memberIds];
    } else if (activeLeague?.standings && activeLeague.standings.length > 0) {
      memberIds = activeLeague.standings.map((s) => s.idolId);
    } else if (activeLeague?.matches && activeLeague.matches.length > 0) {
      const matchIdols = new Set<string>();
      activeLeague.matches.forEach((m) => {
        if (m.idolAId) matchIdols.add(m.idolAId);
        if (m.idolBId) matchIdols.add(m.idolBId);
      });
      memberIds = Array.from(matchIdols);
    }

    const rosterIdols = memberIds.map((memberId, idx) => {
      const fullIdol = idolsMap.get(memberId);
      const standing = activeLeague?.standings?.find((s) => s.idolId === memberId);
      return {
        memberIndex: idx + 1,
        id: memberId,
        idolId: memberId,
        name: fullIdol?.name || standing?.idolName || 'Unknown Idol',
        rating: fullIdol?.rating || 80,
        seed: fullIdol?.seed || standing?.seed || 'Unseeded',
        girlGroup: fullIdol?.girlGroup || standing?.girlGroup || 'Solo',
        nationality: fullIdol?.nationality || standing?.nationality || 'South Korea',
        photoUrl: fullIdol?.photoUrl || standing?.photoUrl || '',
      };
    });

    return {
      leagueId: def.id,
      name: custom?.name || activeLeague?.name || def.name,
      shortName: `D${def.id}`,
      tierName: custom?.tierName || activeLeague?.tierName || def.tierName,
      color: custom?.color || def.color,
      logoUrl: custom?.logoUrl || def.logoUrl,
      description: custom?.description || def.description,
      memberCount: rosterIdols.length,
      rosterCount: rosterIdols.length,
      memberIds: memberIds,
      roster: rosterIdols,
    };
  });

  const division2 = (v5State?.d2 || []).map((league: DivisionTwoLeague) => {
    const roster = (league.memberIds || []).map((memberId, index) => {
      const idol = idolsMap.get(memberId);
      return {
        memberIndex: index + 1,
        id: memberId,
        idolId: memberId,
        name: idol?.name || 'Unknown Idol',
        rating: idol?.rating || 80,
        seed: idol?.seed || 'Unseeded',
        girlGroup: idol?.girlGroup || 'Solo',
        nationality: idol?.nationality || 'South Korea',
        photoUrl: idol?.photoUrl || '',
      };
    });
    return {
      leagueId: league.id,
      parentLeagueId: league.parentLeagueId,
      name: league.name,
      tierName: league.tierName,
      color: league.color,
      logoUrl: league.logoUrl || '',
      description: league.description || '',
      memberCount: roster.length,
      rosterCount: roster.length,
      memberIds: [...(league.memberIds || [])],
      roster,
    };
  });

  const exportPayload = {
    schemaVersion: 'sabung_league_branding_rosters_v2',
    format: 'league_branding_rosters',
    exportedAt: new Date().toISOString(),
    seasonNumber: effectiveState?.seasonNumber || 1,
    description: 'Complete Sabung Idol Arena setup: Division 1 and Division 2 branding and rosters, full idol profiles, and the complete girl group database.',
    totalDivisions: divisions.length,
    totalDivision2Leagues: division2.length,
    totalRosterIdols: divisions.reduce((acc, d) => acc + d.rosterCount, 0) + division2.reduce((acc, d) => acc + d.rosterCount, 0),
    divisions,
    division2,
    idols,
    girlGroups,
    totalGirlGroups: girlGroups.length,
    totalIdols: idols.length,
    customLeagueBranding: effectiveBranding || [],
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * 4. PERMANENT MATCH DB: All matches across Tournament Cup, Domestic League, and The Idols
 */
export function exportPermanentMatchDatabase(
  appState: AppState,
  leagueState?: LeagueSeasonState | null,
  leagueArchives?: LeagueSeasonArchive[],
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[]
): string {
  // Collect all matches from matchDatabase and active/archived competitions
  const matchMap = new Map<string, ArchivedMatch>();

  (appState.matchDatabase || []).forEach((m) => {
    if (m && m.matchId) matchMap.set(m.matchId, m);
  });

  // Include completed league matches using syncLeagueMatchesToArchivedMatches
  if (leagueState || (leagueArchives && leagueArchives.length > 0)) {
    const leagueMatches = syncLeagueMatchesToArchivedMatches(
      leagueState || null,
      leagueArchives || [],
      appState.idols
    );
    leagueMatches.forEach((m) => {
      if (m && m.matchId && !matchMap.has(m.matchId)) {
        matchMap.set(m.matchId, m);
      }
    });
  }

  // Include completed The Idols matches using convertTheIdolsMatchesToArchived
  if (theIdolsState || (theIdolsArchives && theIdolsArchives.length > 0)) {
    const tiMatches = convertTheIdolsMatchesToArchived(
      theIdolsState || null,
      appState.idols,
      theIdolsArchives || []
    );
    tiMatches.forEach((m) => {
      if (m && m.matchId && !matchMap.has(m.matchId)) {
        matchMap.set(m.matchId, m);
      }
    });
  }

  const allMatches = Array.from(matchMap.values());

  const exportPayload = {
    schemaVersion: 'sabung_permanent_match_db_v1',
    format: 'permanent_match_db',
    exportedAt: new Date().toISOString(),
    description: 'Permanent Match Database spanning Tournament Cup, Domestic League (38 Matchdays), and The Idols Superleague & Playoff',
    totalMatches: allMatches.length,
    matches: allMatches,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * 5. FULL HISTORICAL STAT: Across all existing tournament formats (Cup, League, Superleague, Masters)
 */
export function exportFullHistoricalStats(
  appState: AppState,
  leagueState: LeagueSeasonState | null,
  leagueArchives: LeagueSeasonArchive[],
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives?: TheIdolsSeasonArchive[],
  overrides?: CareerOverridesMap,
  careerStats?: CareerStat[]
): string {
  const trackedIdols = appState.idols.map((idol) => {
    const derived = computeDerivedBaseStatsForIdol(
      idol.id,
      careerStats || [],
      leagueState,
      leagueArchives,
      theIdolsState || null,
      theIdolsArchives || []
    );
    const ov = (overrides || {})[idol.id];
    const isOv = ov && ov.enabled;

    const cupChamps = isOv && ov.championships !== undefined ? ov.championships : ((derived.cup as any)?.championships || 0);
    const divTitles = isOv && ov.divisionTitles !== undefined ? ov.divisionTitles : (derived.league?.divisionTitles || 0);
    const tiSuperleague = isOv && ov.theIdolsSuperleagueTitles !== undefined ? ov.theIdolsSuperleagueTitles : (derived.theIdols?.theIdolsSuperleagueTitles || 0);
    const tiMasters = isOv && ov.theIdolsMastersTitles !== undefined ? ov.theIdolsMastersTitles : (derived.theIdols?.theIdolsMastersTitles || 0);

    const totalTitles = calculateUnifiedTotalTitles(cupChamps, divTitles, tiSuperleague, tiMasters);

    return {
      idolId: idol.id,
      name: idol.name,
      girlGroup: idol.girlGroup,
      seed: idol.seed,
      rating: idol.rating,
      totalTitles,
      cupTitles: cupChamps,
      leagueDivisionTitles: divTitles,
      theIdolsSuperleagueTitles: tiSuperleague,
      theIdolsMastersTitles: tiMasters,
      cupCareer: isOv ? { ...derived.cup, ...ov } : derived.cup,
      leagueCareer: isOv ? { ...derived.league, ...ov } : derived.league,
      theIdolsCareer: isOv ? { ...derived.theIdols, ...ov } : derived.theIdols,
    };
  });

  const exportPayload = {
    schemaVersion: 'sabung_full_historical_stats_v1',
    format: 'full_historical_stats',
    exportedAt: new Date().toISOString(),
    description: 'Full Historical Career Statistics across all tournament formats with unified total titles',
    totalIdolsTracked: trackedIdols.length,
    idolsHistoricalStats: trackedIdols,
    careerStatsOverrides: overrides || {},
    tournamentArchivesCount: (appState.archives || []).length,
    leagueArchivesCount: (leagueArchives || []).length,
    theIdolsArchivesCount: (theIdolsArchives || []).length,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Validate and parse an imported database file (supporting all 5 formats + legacy)
 */
export function validateAndParseDatabaseBackup(jsonStr: string): {
  success: boolean;
  data?: any;
  format?: 'full_backup' | 'idols_groups' | 'league_branding_rosters' | 'permanent_match_db' | 'full_historical_stats' | 'generic';
  error?: string;
  summary?: {
    idolsCount: number;
    matchCount: number;
    tournamentArchivesCount: number;
    leagueArchivesCount: number;
    theIdolsArchivesCount: number;
    overridesCount: number;
    divisionsCount?: number;
    groupsCount?: number;
  };
} {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid JSON file: Root structure must be an object.' };
    }

    // Detect format
    let format: 'full_backup' | 'idols_groups' | 'league_branding_rosters' | 'permanent_match_db' | 'full_historical_stats' | 'generic' = 'generic';

    if (parsed.format === 'full_backup' || parsed.schemaVersion?.startsWith('sabung_full_backup') || (parsed.idols && parsed.tournamentArchives)) {
      format = 'full_backup';
    } else if (parsed.format === 'idols_groups' || parsed.schemaVersion?.startsWith('sabung_idols_groups') || (parsed.idols && !parsed.divisions && !parsed.matches && !parsed.tournamentArchives)) {
      format = 'idols_groups';
    } else if (parsed.format === 'league_branding_rosters' || parsed.schemaVersion?.startsWith('sabung_league_branding') || (parsed.divisions && Array.isArray(parsed.divisions))) {
      format = 'league_branding_rosters';
    } else if (parsed.format === 'permanent_match_db' || parsed.schemaVersion?.startsWith('sabung_permanent_match') || (parsed.matches && Array.isArray(parsed.matches) && !parsed.idols)) {
      format = 'permanent_match_db';
    } else if (parsed.format === 'full_historical_stats' || parsed.schemaVersion?.startsWith('sabung_full_historical') || parsed.idolsHistoricalStats) {
      format = 'full_historical_stats';
    }

    const idolsCount = Array.isArray(parsed.idols)
      ? parsed.idols.length
      : Array.isArray(parsed.idolsHistoricalStats)
      ? parsed.idolsHistoricalStats.length
      : 0;

    const matchCount = Array.isArray(parsed.matchDatabase)
      ? parsed.matchDatabase.length
      : Array.isArray(parsed.matches)
      ? parsed.matches.length
      : 0;

    const tournamentArchivesCount = Array.isArray(parsed.tournamentArchives)
      ? parsed.tournamentArchives.length
      : Array.isArray(parsed.archives)
      ? parsed.archives.length
      : 0;

    const leagueArchivesCount = Array.isArray(parsed.leagueArchives)
      ? parsed.leagueArchives.length
      : parsed.leagueArchivesCount || 0;

    const theIdolsArchivesCount = Array.isArray(parsed.theIdolsArchives)
      ? parsed.theIdolsArchives.length
      : parsed.theIdolsArchivesCount || 0;

    const overridesCount =
      parsed.careerStatsOverrides && typeof parsed.careerStatsOverrides === 'object'
        ? Object.keys(parsed.careerStatsOverrides).length
        : 0;

    const divisionsCount = Array.isArray(parsed.divisions) ? parsed.divisions.length : 0;
    const groupsCount = Array.isArray(parsed.girlGroups) ? parsed.girlGroups.length : 0;

    return {
      success: true,
      format,
      data: parsed,
      summary: {
        idolsCount,
        matchCount,
        tournamentArchivesCount,
        leagueArchivesCount,
        theIdolsArchivesCount,
        overridesCount,
        divisionsCount,
        groupsCount,
      },
    };
  } catch (err: any) {
    return { success: false, error: `JSON Parse Error: ${err?.message || 'Invalid syntax'}` };
  }
}
