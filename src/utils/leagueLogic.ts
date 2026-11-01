import {
  Idol,
  GirlGroup,
  LeagueInfo,
  LeagueMatch,
  LeagueStanding,
  LeagueSeasonState,
  LeagueSeasonArchive,
  LeagueWinnerEntry,
  LeagueQualifierEntry,
  PersonalRankingEntry,
  ArchivedMatch,
  TournamentArchive,
  CareerStat,
  WildcardMatch,
  WildcardParticipant,
  WildcardPlayInState,
  SwissMatch,
  SwissPlayInState,
  PostseasonFormatType,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from '../types';
import { isIdolActive } from './tournamentLogic';
import { incrementSeasonName } from './seasonNameHelper';
import {
  getIdolRating,
  calculateRatingWinProbability,
  simulateLeagueMatchScore,
  simulateSeriesMatches,
} from './ratingHelper';
import { loadDevelopmentGates } from './developmentGates';
import {
  generateSwissPlayIn,
  getGrandCup64Qualifiers,
} from './swissLogic';
import { INITIAL_IDOLS } from '../data/initialData';

export const LEAGUE_STORAGE_KEY = 'sabung_league_season_state_v1';
export const LEAGUE_ARCHIVES_KEY = 'sabung_league_archives_v1';
export const PERSONAL_RANKINGS_KEY = 'sabung_personal_rankings_v1';
export const LEAGUE_TOP32_KEY = 'sabung_league_top32_qualifiers_v1';
export const LEAGUE_BRANDING_KEY = 'sabung_league_branding_custom_v1';

export interface LeagueBrandingItem {
  id: number;
  name: string;
  tierName: string;
  color: string;
  logoUrl?: string;
  description?: string;
}

export function loadSavedTop32Qualifiers(): LeagueQualifierEntry[] {
  try {
    const raw = localStorage.getItem(LEAGUE_TOP32_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSavedTop32Qualifiers(qualifiers: LeagueQualifierEntry[]): void {
  try {
    if (qualifiers && qualifiers.length > 0) {
      localStorage.setItem(LEAGUE_TOP32_KEY, JSON.stringify(qualifiers));
    }
  } catch (e) {
    console.warn('Failed to save top 32 qualifiers:', e);
  }
}

export const DEFAULT_LEAGUE_DEFS: LeagueBrandingItem[] = [
  {
    id: 1,
    name: 'Idol Premier League',
    tierName: 'League Division 1',
    color: '#3b82f6',
    logoUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=60',
    description: 'Premier Division featuring top-tier idols in a 38-matchday round-robin battling for division glory.',
  },
  {
    id: 2,
    name: 'Idol La Liga',
    tierName: 'League Division 2',
    color: '#f97316',
    logoUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=150&auto=format&fit=crop&q=60',
    description: 'High-octane parallel division contending for the title and Champions Tournament qualification.',
  },
  {
    id: 3,
    name: 'Idol Serie A',
    tierName: 'League Division 3',
    color: '#06b6d4',
    logoUrl: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=150&auto=format&fit=crop&q=60',
    description: 'Tactical and seasoned division showcasing elite rivalries and postseason contention.',
  },
  {
    id: 4,
    name: 'Idol Bundesliga',
    tierName: 'League Division 4',
    color: '#ef4444',
    logoUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=150&auto=format&fit=crop&q=60',
    description: 'High-tempo division filled with electrifying clashes and top-spot pursuit.',
  },
  {
    id: 5,
    name: 'Idol Ligue 1',
    tierName: 'League Division 5',
    color: '#8b5cf6',
    logoUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=150&auto=format&fit=crop&q=60',
    description: 'Dynamic parallel division showcasing superstar contenders and fierce matchups.',
  },
  {
    id: 6,
    name: 'Idol Eredivisie',
    tierName: 'League Division 6',
    color: '#eab308',
    logoUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=150&auto=format&fit=crop&q=60',
    description: 'Prestigious division contending for championship glory and postseason berths.',
  },
];

export function loadCustomLeagueBranding(): LeagueBrandingItem[] {
  try {
    const raw = localStorage.getItem(LEAGUE_BRANDING_KEY);
    if (!raw) return DEFAULT_LEAGUE_DEFS;
    const parsed: LeagueBrandingItem[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return DEFAULT_LEAGUE_DEFS.map((def) => {
        const found = parsed.find((p) => p.id === def.id);
        return found ? { ...def, ...found } : def;
      });
    }
    return DEFAULT_LEAGUE_DEFS;
  } catch {
    return DEFAULT_LEAGUE_DEFS;
  }
}

export function saveCustomLeagueBranding(brandingList: LeagueBrandingItem[]): void {
  try {
    localStorage.setItem(LEAGUE_BRANDING_KEY, JSON.stringify(brandingList));
  } catch (e) {
    console.warn('Failed to save custom league branding:', e);
  }
}

export function getLeagueDefinitions(): LeagueBrandingItem[] {
  return loadCustomLeagueBranding();
}

/**
 * Standard Circle Round-Robin Fixture Generator for 20 teams (Double Round-Robin: 38 Matchdays, Home & Away)
 */
export function generateRoundRobinMatches(leagueId: number, memberIds: string[]): LeagueMatch[] {
  const matches: LeagueMatch[] = [];
  const teams = [...memberIds];
  const n = teams.length;

  if (n < 2) return matches;

  // If odd, add a dummy bye
  if (n % 2 !== 0) {
    teams.push('BYE');
  }

  const numTeams = teams.length;
  const numRounds = numTeams - 1; // 19 rounds for 20 teams
  const matchesPerRound = numTeams / 2;

  // Store first leg rounds to invert cleanly for the second leg
  const leg1Rounds: Array<Array<{ home: string; away: string }>> = [];

  for (let round = 0; round < numRounds; round++) {
    const roundPairs: Array<{ home: string; away: string }> = [];
    for (let i = 0; i < matchesPerRound; i++) {
      const home = teams[i];
      const away = teams[numTeams - 1 - i];

      if (home !== 'BYE' && away !== 'BYE') {
        const isHomeRound = (i + round) % 2 === 0;
        const idolAId = isHomeRound ? home : away;
        const idolBId = isHomeRound ? away : home;
        roundPairs.push({ home: idolAId, away: idolBId });
      }
    }
    leg1Rounds.push(roundPairs);

    // Rotate teams in circle (keep teams[0] fixed)
    const fixed = teams[0];
    const rest = teams.slice(1);
    const last = rest.pop()!;
    rest.unshift(last);
    teams.splice(0, teams.length, fixed, ...rest);
  }

  // Generate First Leg (Matchdays 1 to 19)
  leg1Rounds.forEach((roundPairs, rIdx) => {
    const matchday = rIdx + 1;
    roundPairs.forEach((pair, mIdx) => {
      matches.push({
        id: `league_${leagueId}_md${matchday}_m${mIdx + 1}_${pair.home}_vs_${pair.away}`,
        leagueId,
        matchday,
        idolAId: pair.home,
        idolBId: pair.away,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      });
    });
  });

  // Generate Second Leg / Reverse Fixtures (Matchdays 20 to 38)
  leg1Rounds.forEach((roundPairs, rIdx) => {
    const matchday = rIdx + 1 + numRounds; // e.g. 1 + 19 = 20, up to 19 + 19 = 38
    roundPairs.forEach((pair, mIdx) => {
      matches.push({
        id: `league_${leagueId}_md${matchday}_m${mIdx + 1}_${pair.away}_vs_${pair.home}`,
        leagueId,
        matchday,
        idolAId: pair.away, // Inverted: Away team is now home
        idolBId: pair.home, // Inverted: Home team is now away
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      });
    });
  });

  return matches;
}

/**
 * Calculates standings table for a single league
 */
export function calculateLeagueStandings(
  leagueId: number,
  memberIds: string[],
  matches: LeagueMatch[],
  idols: Idol[]
): LeagueStanding[] {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  // Initialize stats for each member
  const statsMap = new Map<
    string,
    {
      idolId: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      points: number;
      gamesFor: number;
      gamesAgainst: number;
      form: Array<'W' | 'D' | 'L'>;
    }
  >();

  memberIds.forEach((id) => {
    statsMap.set(id, {
      idolId: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      form: [],
    });
  });

  // Process completed matches sorted by matchday
  const completedMatches = matches
    .filter((m) => m.completed && m.scoreA !== null && m.scoreB !== null)
    .sort((a, b) => a.matchday - b.matchday);

  completedMatches.forEach((m) => {
    const statA = statsMap.get(m.idolAId);
    const statB = statsMap.get(m.idolBId);
    const sA = m.scoreA ?? 0;
    const sB = m.scoreB ?? 0;

    if (statA) {
      statA.played += 1;
      statA.gamesFor += sA;
      statA.gamesAgainst += sB;

      if (sA > sB) {
        statA.wins += 1;
        statA.points += 3;
        statA.form.push('W');
      } else if (sA === sB) {
        statA.draws += 1;
        statA.points += 1;
        statA.form.push('D');
      } else {
        statA.losses += 1;
        statA.form.push('L');
      }
      if (statA.form.length > 5) statA.form.shift(); // Keep last 5
    }

    if (statB) {
      statB.played += 1;
      statB.gamesFor += sB;
      statB.gamesAgainst += sA;

      if (sB > sA) {
        statB.wins += 1;
        statB.points += 3;
        statB.form.push('W');
      } else if (sB === sA) {
        statB.draws += 1;
        statB.points += 1;
        statB.form.push('D');
      } else {
        statB.losses += 1;
        statB.form.push('L');
      }
      if (statB.form.length > 5) statB.form.shift(); // Keep last 5
    }
  });

  // Convert to array and sort
  const standings: LeagueStanding[] = Array.from(statsMap.values()).map((st) => {
    const idol = idolsMap.get(st.idolId);
    const gameDiff = st.gamesFor - st.gamesAgainst;
    return {
      idolId: st.idolId,
      idolName: idol?.name || 'Unknown Idol',
      girlGroup: idol?.girlGroup || 'Solo',
      seed: idol?.seed || 'Seed 2',
      nationality: idol?.nationality || 'South Korea',
      photoUrl: idol?.photoUrl,
      played: st.played,
      wins: st.wins,
      draws: st.draws,
      losses: st.losses,
      points: st.points,
      gamesFor: st.gamesFor,
      gamesAgainst: st.gamesAgainst,
      gameDiff,
      rank: 1,
      form: st.form,
      qualified: false,
    };
  });

  // Sort by: Points desc, Game Diff desc, Games For desc, Wins desc, Name asc
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.idolName.localeCompare(b.idolName);
  });

  // Assign ranks & qualify top 5
  standings.forEach((st, idx) => {
    st.rank = idx + 1;
    if (st.rank <= 5) {
      st.qualified = true;
    }
  });

  return standings;
}

/**
 * Initializes a full 6-league season with clean rosters connected to each league branding
 */
export function initializeLeagueSeason(
  idols: Idol[],
  girlGroups: GirlGroup[],
  seasonNumber: number = 1
): LeagueSeasonState {
  // Connect directly to custom league branding definitions
  const leagueDefs = getLeagueDefinitions();
  const leagues: LeagueInfo[] = leagueDefs.map((def) => {
    return {
      id: def.id,
      name: def.name,
      tierName: def.tierName,
      color: def.color,
      logoUrl: def.logoUrl || '',
      description: def.description || '',
      memberIds: [],
      matches: [],
      standings: [],
    };
  });

  return {
    seasonNumber,
    seasonName: `League Season ${seasonNumber}`,
    isStarted: true,
    isCompleted: false,
    currentMatchday: 1,
    leagues,
    postseasonFormat: 'grand_cup_64',
    championsAdvancementDone: false,
  };
}

/**
 * Generates or initializes the Wildcard Play-In Double Elimination Bracket
 * for the 6 6th-place contenders from each of the 6 leagues.
 *
 * Seeding Rules (user spec):
 * - 4 highest point scorers in the league start in Upper Bracket (Seeds 1-4)
 * - 2 lowest point scorers in the league start in Lower Bracket (Seeds 5-6)
 * - Draw: Highest point vs lowest point (Seed 1 vs Seed 4 in UB R1; Seed 2 vs Seed 3 in UB R1)
 * - LB R1: Loser M1 vs Seed 6; Loser M2 vs Seed 5
 * - LB R2: Winner M4 vs Winner M5
 * - UB Final: Winner M1 vs Winner M2 (Winner is Qualifier #1!)
 * - LB Final: Loser UB Final (M3) vs Winner LB R2 (M6) (Winner is Qualifier #2!)
 */
export function generateWildcardPlayIn(
  leagues: LeagueInfo[],
  idols: Idol[],
  existingPlayIn?: WildcardPlayInState
): WildcardPlayInState {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  // Extract 6th place finishers
  const contenders: Array<{
    st: LeagueStanding;
    leagueId: number;
    leagueName: string;
  }> = [];

  leagues.forEach((l) => {
    const st6 = l.standings[5] || (l.standings.length >= 6 ? l.standings[5] : undefined);
    if (st6) {
      contenders.push({
        st: st6,
        leagueId: l.id,
        leagueName: l.name,
      });
    }
  });

  // Sort 6th place contenders by: points > gameDiff > gamesFor > idolName
  contenders.sort((a, b) => {
    if (b.st.points !== a.st.points) return b.st.points - a.st.points;
    if (b.st.gameDiff !== a.st.gameDiff) return b.st.gameDiff - a.st.gameDiff;
    if (b.st.gamesFor !== a.st.gamesFor) return b.st.gamesFor - a.st.gamesFor;
    return a.st.idolName.localeCompare(b.st.idolName);
  });

  const participants: WildcardParticipant[] = contenders.map((c, idx) => {
    const idol = idolsMap.get(c.st.idolId);
    const playInSeed = idx + 1; // 1 to 6
    const bracketStart: 'upper' | 'lower' = playInSeed <= 4 ? 'upper' : 'lower';
    return {
      idolId: c.st.idolId,
      idolName: c.st.idolName,
      girlGroup: c.st.girlGroup,
      nationality: c.st.nationality || idol?.nationality || 'South Korea',
      photoUrl: c.st.photoUrl || idol?.photoUrl,
      seed: c.st.seed || idol?.seed || 'Unseeded',
      leagueId: c.leagueId,
      leagueName: c.leagueName,
      points: c.st.points,
      gameDiff: c.st.gameDiff,
      gamesFor: c.st.gamesFor,
      playInSeed,
      bracketStart,
    };
  });

  const p1 = participants.find((p) => p.playInSeed === 1)?.idolId || null;
  const p2 = participants.find((p) => p.playInSeed === 2)?.idolId || null;
  const p3 = participants.find((p) => p.playInSeed === 3)?.idolId || null;
  const p4 = participants.find((p) => p.playInSeed === 4)?.idolId || null;
  const p5 = participants.find((p) => p.playInSeed === 5)?.idolId || null;
  const p6 = participants.find((p) => p.playInSeed === 6)?.idolId || null;

  // Check if existing matches can be preserved if participants haven't changed
  const existingMatchMap = new Map<string, WildcardMatch>();
  if (existingPlayIn && Array.isArray(existingPlayIn.matches)) {
    existingPlayIn.matches.forEach((m) => existingMatchMap.set(m.id, m));
  }

  const getSavedMatch = (id: string, defMatch: WildcardMatch): WildcardMatch => {
    const found = existingMatchMap.get(id);
    if (found && found.completed) {
      return {
        ...defMatch,
        idolAId: found.idolAId,
        idolBId: found.idolBId,
        scoreA: found.scoreA,
        scoreB: found.scoreB,
        winnerId: found.winnerId,
        loserId: found.loserId,
        completed: found.completed,
        updatedAt: found.updatedAt,
      };
    }
    return defMatch;
  };

  // 1. UB Semifinal 1 (Seed 1 vs Seed 4)
  const m1Def: WildcardMatch = {
    id: 'wc_ub_r1_m1',
    bracket: 'upper',
    roundName: 'UB Semifinals',
    matchNumber: 1,
    idolAId: p1,
    idolBId: p4,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    feedsWinnerToMatchId: 'wc_ub_final',
    feedsWinnerToSlot: 'A',
    feedsLoserToMatchId: 'wc_lb_r1_m1',
    feedsLoserToSlot: 'A',
  };
  const m1 = getSavedMatch('wc_ub_r1_m1', m1Def);

  // 2. UB Semifinal 2 (Seed 2 vs Seed 3)
  const m2Def: WildcardMatch = {
    id: 'wc_ub_r1_m2',
    bracket: 'upper',
    roundName: 'UB Semifinals',
    matchNumber: 2,
    idolAId: p2,
    idolBId: p3,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    feedsWinnerToMatchId: 'wc_ub_final',
    feedsWinnerToSlot: 'B',
    feedsLoserToMatchId: 'wc_lb_r1_m2',
    feedsLoserToSlot: 'A',
  };
  const m2 = getSavedMatch('wc_ub_r1_m2', m2Def);

  // 3. UB Final (Winner M1 vs Winner M2) -> Winner is Qualifier #1
  const m3Def: WildcardMatch = {
    id: 'wc_ub_final',
    bracket: 'upper',
    roundName: 'UB Final',
    matchNumber: 3,
    idolAId: m1.completed ? m1.winnerId : null,
    idolBId: m2.completed ? m2.winnerId : null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    qualifierSlot: 1,
    feedsLoserToMatchId: 'wc_lb_final',
    feedsLoserToSlot: 'A',
  };
  const m3 = getSavedMatch('wc_ub_final', m3Def);

  // 4. LB Round 1 Match 1 (Loser M1 vs Seed 6)
  const m4Def: WildcardMatch = {
    id: 'wc_lb_r1_m1',
    bracket: 'lower',
    roundName: 'LB Round 1',
    matchNumber: 4,
    idolAId: m1.completed ? (m1.loserId || (m1.winnerId === m1.idolAId ? m1.idolBId : m1.idolAId)) : null,
    idolBId: p6,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    feedsWinnerToMatchId: 'wc_lb_r2',
    feedsWinnerToSlot: 'A',
  };
  const m4 = getSavedMatch('wc_lb_r1_m1', m4Def);

  // 5. LB Round 1 Match 2 (Loser M2 vs Seed 5)
  const m5Def: WildcardMatch = {
    id: 'wc_lb_r1_m2',
    bracket: 'lower',
    roundName: 'LB Round 1',
    matchNumber: 5,
    idolAId: m2.completed ? (m2.loserId || (m2.winnerId === m2.idolAId ? m2.idolBId : m2.idolAId)) : null,
    idolBId: p5,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    feedsWinnerToMatchId: 'wc_lb_r2',
    feedsWinnerToSlot: 'B',
  };
  const m5 = getSavedMatch('wc_lb_r1_m2', m5Def);

  // 6. LB Semifinal / Round 2 (Winner M4 vs Winner M5)
  const m6Def: WildcardMatch = {
    id: 'wc_lb_r2',
    bracket: 'lower',
    roundName: 'LB Semifinal',
    matchNumber: 6,
    idolAId: m4.completed ? m4.winnerId : null,
    idolBId: m5.completed ? m5.winnerId : null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    feedsWinnerToMatchId: 'wc_lb_final',
    feedsWinnerToSlot: 'B',
  };
  const m6 = getSavedMatch('wc_lb_r2', m6Def);

  // 7. LB Final (Loser UB Final M3 vs Winner LB Semifinal M6) -> Winner is Qualifier #2
  const m7Def: WildcardMatch = {
    id: 'wc_lb_final',
    bracket: 'lower',
    roundName: 'LB Final',
    matchNumber: 7,
    idolAId: m3.completed ? (m3.loserId || (m3.winnerId === m3.idolAId ? m3.idolBId : m3.idolAId)) : null,
    idolBId: m6.completed ? m6.winnerId : null,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    completed: false,
    qualifierSlot: 2,
  };
  const m7 = getSavedMatch('wc_lb_final', m7Def);

  const matches: WildcardMatch[] = [m1, m2, m3, m4, m5, m6, m7];
  const isCompleted = matches.every((m) => m.completed);
  const qualifier1Id = m3.completed && m3.winnerId ? m3.winnerId : undefined;
  const qualifier2Id = m7.completed && m7.winnerId ? m7.winnerId : undefined;

  return {
    isInitialized: participants.length > 0,
    isCompleted,
    participants,
    matches,
    qualifier1Id,
    qualifier2Id,
  };
}

/**
 * Updates a Wildcard Match result and automatically propagates winners and losers across the double elimination bracket
 */
export function updateWildcardMatchResult(
  playIn: WildcardPlayInState,
  matchId: string,
  scoreA: number,
  scoreB: number
): WildcardPlayInState {
  let sA = scoreA;
  let sB = scoreB;
  if (sA === sB) {
    sA += 1; // Playoff elimination matches cannot end in a draw
  }

  if (!playIn || !Array.isArray(playIn.matches)) return playIn;
  const updatedMatches = playIn.matches.map((m) => ({ ...m }));
  const targetIdx = updatedMatches.findIndex((m) => m.id === matchId);
  if (targetIdx === -1) return playIn;

  const match = updatedMatches[targetIdx];
  if (!match.idolAId || !match.idolBId) return playIn;

  const winnerId = sA > sB ? match.idolAId : match.idolBId;
  const loserId = sA > sB ? match.idolBId : match.idolAId;

  match.scoreA = sA;
  match.scoreB = sB;
  match.winnerId = winnerId;
  match.loserId = loserId;
  match.completed = true;
  match.updatedAt = new Date().toISOString();

  // Re-link propagation across bracket
  const m1 = updatedMatches.find((m) => m.id === 'wc_ub_r1_m1');
  const m2 = updatedMatches.find((m) => m.id === 'wc_ub_r1_m2');
  const m3 = updatedMatches.find((m) => m.id === 'wc_ub_final');
  const m4 = updatedMatches.find((m) => m.id === 'wc_lb_r1_m1');
  const m5 = updatedMatches.find((m) => m.id === 'wc_lb_r1_m2');
  const m6 = updatedMatches.find((m) => m.id === 'wc_lb_r2');
  const m7 = updatedMatches.find((m) => m.id === 'wc_lb_final');

  if (m3) {
    if (m1?.completed && m1.winnerId) m3.idolAId = m1.winnerId;
    if (m2?.completed && m2.winnerId) m3.idolBId = m2.winnerId;
  }
  if (m4) {
    if (m1?.completed) m4.idolAId = m1.loserId || null;
  }
  if (m5) {
    if (m2?.completed) m5.idolAId = m2.loserId || null;
  }
  if (m6) {
    if (m4?.completed && m4.winnerId) m6.idolAId = m4.winnerId;
    if (m5?.completed && m5.winnerId) m6.idolBId = m5.winnerId;
  }
  if (m7) {
    if (m3?.completed) m7.idolAId = m3.loserId || null;
    if (m6?.completed && m6.winnerId) m7.idolBId = m6.winnerId;
  }

  const isCompleted = updatedMatches.every((m) => m.completed);
  const qualifier1Id = m3?.completed && m3.winnerId ? m3.winnerId : undefined;
  const qualifier2Id = m7?.completed && m7.winnerId ? m7.winnerId : undefined;

  return {
    ...playIn,
    matches: updatedMatches,
    isCompleted,
    qualifier1Id,
    qualifier2Id,
  };
}

/**
 * Simulates a single wildcard match between two participants in Best of 5 (BO5) series format
 */
export function simulateWildcardMatch(
  playIn: WildcardPlayInState,
  matchId: string,
  idols: Idol[]
): WildcardPlayInState {
  if (!playIn || !Array.isArray(playIn.matches)) return playIn;
  const match = playIn.matches.find((m) => m.id === matchId);
  if (!match || !match.idolAId || !match.idolBId) return playIn;

  const idolMap = new Map<string, Idol>();
  (idols || []).forEach((i) => i && idolMap.set(i.id, i));
  const idolA = idolMap.get(match.idolAId);
  const idolB = idolMap.get(match.idolBId);
  if (!idolA || !idolB) return playIn;

  // Rating-based series simulation (Best of 5)
  const rA = getIdolRating(idolA);
  const rB = getIdolRating(idolB);
  const { scoreA: sA, scoreB: sB } = simulateSeriesMatches(rA, rB, 3);

  return updateWildcardMatchResult(playIn, matchId, sA, sB);
}

/**
 * Simulates the entire double-elimination Wildcard Play-In tournament bracket in order
 */
export function simulateAllWildcardMatches(
  playIn: WildcardPlayInState,
  idols: Idol[]
): WildcardPlayInState {
  let cur = { ...playIn };
  // Round 1
  ['wc_ub_r1_m1', 'wc_ub_r1_m2'].forEach((id) => {
    cur = simulateWildcardMatch(cur, id, idols);
  });
  ['wc_lb_r1_m1', 'wc_lb_r1_m2'].forEach((id) => {
    cur = simulateWildcardMatch(cur, id, idols);
  });
  // Round 2
  ['wc_ub_final', 'wc_lb_r2'].forEach((id) => {
    cur = simulateWildcardMatch(cur, id, idols);
  });
  // Round 3
  cur = simulateWildcardMatch(cur, 'wc_lb_final', idols);

  return cur;
}

/**
 * Resets the Wildcard Play-In bracket
 */
export function resetWildcardPlayIn(
  leagues: LeagueInfo[],
  idols: Idol[]
): WildcardPlayInState {
  return generateWildcardPlayIn(leagues, idols);
}

/**
 * Computes Top 32 Combined Qualifiers across all 6 leagues
 * - 30 automatic qualifiers (Top 5 from each of the 6 leagues)
 * - 2 Wildcard qualifiers (Upper Bracket Champion & Lower Bracket Champion from Wildcard Play-In)
 */
export function getTop32Qualifiers(
  leagues: LeagueInfo[],
  idols: Idol[],
  wildcardPlayIn?: WildcardPlayInState
): LeagueQualifierEntry[] {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  const qualifiers: LeagueQualifierEntry[] = [];
  const directSlotsPerDiv = 5;
  const wildcardQuota = 2;

  // 1. Direct qualifiers from each league based on development gate
  leagues.forEach((l) => {
    const directQuals = l.standings.slice(0, directSlotsPerDiv);
    directQuals.forEach((st) => {
      const idol = idolsMap.get(st.idolId);
      qualifiers.push({
        idolId: st.idolId,
        idolName: st.idolName,
        girlGroup: st.girlGroup,
        seed: st.seed,
        nationality: st.nationality,
        photoUrl: st.photoUrl || idol?.photoUrl,
        leagueId: l.id,
        leagueName: l.name,
        rankInLeague: st.rank,
        points: st.points,
        gameDiff: st.gameDiff,
        qualificationType: `Automatic (Top ${directSlotsPerDiv})`,
      });
    });
  });

  // 2. The Wildcard spots:
  // First check if Wildcard Play-In has determined winners
  let wildcard1Id = wildcardPlayIn?.qualifier1Id;
  let wildcard2Id = wildcardPlayIn?.qualifier2Id;

  // Fallback candidate ranking for play-in contenders (next eligible rank across leagues)
  const contenders: Array<{
    st: LeagueStanding;
    leagueId: number;
    leagueName: string;
  }> = [];

  leagues.forEach((l) => {
    const candidateStanding = l.standings[directSlotsPerDiv];
    if (candidateStanding) {
      contenders.push({
        st: candidateStanding,
        leagueId: l.id,
        leagueName: l.name,
      });
    }
  });

  contenders.sort((a, b) => {
    if (b.st.points !== a.st.points) return b.st.points - a.st.points;
    if (b.st.gameDiff !== a.st.gameDiff) return b.st.gameDiff - a.st.gameDiff;
    return b.st.gamesFor - a.st.gamesFor;
  });

  if (!wildcard1Id && contenders[0]) {
    wildcard1Id = contenders[0].st.idolId;
  }
  if (!wildcard2Id && contenders[1]) {
    wildcard2Id = contenders[1].st.idolId;
  }

  // Find info for wildcard 1
  if (wildcard1Id) {
    const wc1Idol = idolsMap.get(wildcard1Id);
    const wc1Standing = contenders.find((c) => c.st.idolId === wildcard1Id);
    if (wc1Idol) {
      qualifiers.push({
        idolId: wc1Idol.id,
        idolName: wc1Idol.name,
        girlGroup: wc1Idol.girlGroup,
        seed: wc1Idol.seed,
        nationality: wc1Idol.nationality,
        photoUrl: wc1Idol.photoUrl,
        leagueId: wc1Standing?.leagueId || 1,
        leagueName: wc1Standing?.leagueName || 'Wildcard',
        rankInLeague: 6,
        points: wc1Standing?.st.points || 0,
        gameDiff: wc1Standing?.st.gameDiff || 0,
        qualificationType: wildcardPlayIn?.isCompleted
          ? 'Wildcard (Play-In Qualifier)'
          : 'Wildcard (Play-In Qualifier)',
      });
    }
  }

  // Find info for wildcard 2
  if (wildcard2Id && wildcard2Id !== wildcard1Id) {
    const wc2Idol = idolsMap.get(wildcard2Id);
    const wc2Standing = contenders.find((c) => c.st.idolId === wildcard2Id);
    if (wc2Idol) {
      qualifiers.push({
        idolId: wc2Idol.id,
        idolName: wc2Idol.name,
        girlGroup: wc2Idol.girlGroup,
        seed: wc2Idol.seed,
        nationality: wc2Idol.nationality,
        photoUrl: wc2Idol.photoUrl,
        leagueId: wc2Standing?.leagueId || 2,
        leagueName: wc2Standing?.leagueName || 'Wildcard',
        rankInLeague: 6,
        points: wc2Standing?.st.points || 0,
        gameDiff: wc2Standing?.st.gameDiff || 0,
        qualificationType: wildcardPlayIn?.isCompleted
          ? 'Wildcard (Play-In Qualifier)'
          : 'Wildcard (Play-In Qualifier)',
      });
    }
  }

  if (qualifiers.length >= 32) {
    saveSavedTop32Qualifiers(qualifiers);
  }

  return qualifiers;
}

/**
 * Generates League Winners info
 */
export function getLeagueWinners(
  leagues: LeagueInfo[],
  idols: Idol[]
): LeagueWinnerEntry[] {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  return leagues.map((l) => {
    const champStanding = l.standings[0];
    const idol = champStanding ? idolsMap.get(champStanding.idolId) : undefined;
    return {
      leagueId: l.id,
      leagueName: l.name,
      tierName: l.tierName,
      championId: champStanding?.idolId || '',
      championName: champStanding?.idolName || 'TBD',
      championGroup: champStanding?.girlGroup || 'Solo',
      championPhoto: champStanding?.photoUrl || idol?.photoUrl,
      championNationality: champStanding?.nationality || idol?.nationality,
      championSeed: champStanding?.seed || idol?.seed,
      points: champStanding?.points || 0,
      played: champStanding?.played || 0,
      wins: champStanding?.wins || 0,
      draws: champStanding?.draws || 0,
      losses: champStanding?.losses || 0,
      gameDiff: champStanding?.gameDiff || 0,
    };
  });
}

/**
 * LocalStorage Helpers for League System
 */
const LEAGUE_STORAGE_BACKUP_KEY = 'sabung_league_season_state_backup_v1';

function parseLeagueSeasonState(raw: string | null): LeagueSeasonState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.leagues)) return null;
    return parsed as LeagueSeasonState;
  } catch {
    return null;
  }
}

export function loadLeagueSeasonState(): LeagueSeasonState | null {
  try {
    const primary = parseLeagueSeasonState(localStorage.getItem(LEAGUE_STORAGE_KEY));
    const backup = parseLeagueSeasonState(localStorage.getItem(LEAGUE_STORAGE_BACKUP_KEY));
    const primaryRevision = Number((primary as any)?.updatedAt || 0);
    const backupRevision = Number((backup as any)?.updatedAt || 0);
    const parsed = backup && (!primary || backupRevision > primaryRevision) ? backup : primary || backup;
    if (!parsed) return null;
    if (parsed !== primary) {
      try { localStorage.setItem(LEAGUE_STORAGE_KEY, JSON.stringify(parsed)); } catch { /* recovery copy remains intact */ }
    }

    // Merge latest custom league branding onto loaded state if available
    if (parsed && Array.isArray(parsed.leagues)) {
      const customDefs = loadCustomLeagueBranding();
      parsed.leagues = parsed.leagues.map((l) => {
        const customDef = customDefs.find((c) => c.id === l.id);
        const defaultDef = DEFAULT_LEAGUE_DEFS.find((d) => d.id === l.id) || DEFAULT_LEAGUE_DEFS[0];
        return {
          ...l,
          name: customDef?.name || l.name || defaultDef.name,
          tierName: customDef?.tierName || l.tierName || defaultDef.tierName,
          color: customDef?.color || l.color || defaultDef.color,
          logoUrl: customDef?.logoUrl !== undefined ? customDef.logoUrl : (l.logoUrl || defaultDef.logoUrl || ''),
          description: customDef?.description !== undefined ? customDef.description : (l.description || defaultDef.description || ''),
        };
      });
    }

    // Auto-migrate legacy 19-matchday league seasons into full 38-matchday double round-robin
    if (parsed && Array.isArray(parsed.leagues)) {
      let needsMigration = false;
      parsed.leagues.forEach((l) => {
        if (l.memberIds && l.memberIds.length === 20 && (!l.matches || l.matches.length < 380)) {
          needsMigration = true;
        }
      });

      if (needsMigration) {
        parsed.leagues = parsed.leagues.map((l) => {
          if (l.memberIds && l.memberIds.length > 0 && (!l.matches || l.matches.length < 380)) {
            const fullMatches = generateRoundRobinMatches(l.id, l.memberIds);
            const existingMatches = l.matches || [];
            const existingCompletedMap = new Map<string, LeagueMatch>();

            existingMatches.forEach((m) => {
              if (m.completed) {
                existingCompletedMap.set(`${m.matchday}_${m.idolAId}_${m.idolBId}`, m);
              }
            });

            const mergedMatches = fullMatches.map((newM) => {
              const matched = existingCompletedMap.get(`${newM.matchday}_${newM.idolAId}_${newM.idolBId}`);
              if (matched) {
                return {
                  ...newM,
                  scoreA: matched.scoreA,
                  scoreB: matched.scoreB,
                  winnerId: matched.winnerId,
                  completed: true,
                };
              }
              return newM;
            });

            const existingStandingsMap = new Map<string, any>();
            (l.standings || []).forEach((s) => {
              if (s && s.idolId) existingStandingsMap.set(s.idolId, s);
            });

            const rebuiltStandings = calculateLeagueStandings(l.id, l.memberIds, mergedMatches, []).map((st) => {
              const prev = existingStandingsMap.get(st.idolId);
              if (prev) {
                return {
                  ...st,
                  idolName: prev.idolName || st.idolName,
                  girlGroup: prev.girlGroup || st.girlGroup,
                  photoUrl: prev.photoUrl || st.photoUrl,
                  nationality: prev.nationality || st.nationality,
                };
              }
              return st;
            });

            return {
              ...l,
              matches: mergedMatches,
              standings: rebuiltStandings,
            };
          }
          return l;
        });

        saveLeagueSeasonState(parsed);
      }
    }

    return parsed;
  } catch (e) {
    console.warn('Failed to load league season state:', e);
    return null;
  }
}

export function saveLeagueSeasonState(state: LeagueSeasonState): void {
  // Persist an explicit revision so IndexedDB hydration cannot replace a newer roster
  // with an older snapshot that happens to contain the same number of played matches.
  const persistedState = { ...state, updatedAt: Date.now() };
  const serialized = JSON.stringify(persistedState);
  let primarySaved = false;
  let backupSaved = false;
  try {
    localStorage.setItem(LEAGUE_STORAGE_KEY, serialized);
    primarySaved = true;
  } catch {
    try {
      const compactState = {
        ...persistedState,
        leagues: (persistedState.leagues || []).map((l) => ({
          ...l,
          standings: (l.standings || []).map((standing) => ({
            ...standing,
            photoUrl: standing.photoUrl && standing.photoUrl.length > 400 ? '' : standing.photoUrl,
          })),
        })),
      };
      localStorage.setItem(LEAGUE_STORAGE_KEY, JSON.stringify(compactState));
      primarySaved = true;
    } catch { /* try the independent recovery copy below */ }
  }
  try {
    localStorage.setItem(LEAGUE_STORAGE_BACKUP_KEY, serialized);
    backupSaved = true;
  } catch {
    try {
      const compactBackup = {
        ...persistedState,
        leagues: (persistedState.leagues || []).map((l) => ({
          ...l,
          standings: (l.standings || []).map((standing) => ({
            ...standing,
            photoUrl: standing.photoUrl && standing.photoUrl.length > 400 ? '' : standing.photoUrl,
          })),
        })),
      };
      localStorage.setItem(LEAGUE_STORAGE_BACKUP_KEY, JSON.stringify(compactBackup));
      backupSaved = true;
    } catch { /* report below */ }
  }
  if (!primarySaved || !backupSaved) {
    console.error('[Persistence] League roster save incomplete. At least one storage copy could not be written.');
  }
}

export function loadLeagueArchives(): LeagueSeasonArchive[] {
  try {
    const raw = localStorage.getItem(LEAGUE_ARCHIVES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLeagueArchives(archives: LeagueSeasonArchive[]): void {
  try {
    localStorage.setItem(LEAGUE_ARCHIVES_KEY, JSON.stringify(archives));
  } catch {
    try {
      // Quota fallback: preserve ALL seasons without slicing the array!
      // Recent seasons keep brief matches; older seasons keep full standings and winners with allMatches emptied.
      const total = (archives || []).length;
      const compactArchives = (archives || []).map((a, idx) => {
        const isRecent = idx >= total - 2;
        return {
          seasonNumber: a.seasonNumber,
          seasonName: a.seasonName || `Season ${a.seasonNumber}`,
          completedAt: a.completedAt,
          leagueWinners: a.leagueWinners || [],
          allStandings: a.allStandings || {},
          allMatches: isRecent ? (a.allMatches || []).slice(0, 50) : [],
          top32Qualifiers: a.top32Qualifiers || [],
          postseasonFormat: a.postseasonFormat,
          wildcardPlayIn: a.wildcardPlayIn,
          swissPlayIn: a.swissPlayIn,
        };
      });
      localStorage.setItem(LEAGUE_ARCHIVES_KEY, JSON.stringify(compactArchives));
    } catch {
      console.warn('LocalStorage quota reached for league archives; IndexedDB handles persistence.');
    }
  }
}

export function loadPersonalRankings(): PersonalRankingEntry[] {
  try {
    const raw = localStorage.getItem(PERSONAL_RANKINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePersonalRankings(rankings: PersonalRankingEntry[]): void {
  try {
    localStorage.setItem(PERSONAL_RANKINGS_KEY, JSON.stringify(rankings));
  } catch (e) {
    console.warn('Failed to save personal rankings:', e);
  }
}

/**
 * Combined Big Three / Top 10 Records (Original Tournament + League System)
 */
export interface CombinedStatsRecord {
  id: string; // idolId or group name
  name: string;
  type: 'idol' | 'group';
  girlGroup?: string;
  photoUrl?: string;
  nationality?: string;
  seed?: string;
  titles: number; // Original championships + League championships + The Idols championships
  originalTitles: number;
  leagueTitles: number;
  theIdolsTitles?: number;
  totalPoints: number; // Total points earned across tournaments and leagues
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  gameDiff: number;
}

export function computeCombinedTopRankings(
  idols: Idol[] = [],
  girlGroups: GirlGroup[] = [],
  careerStats: CareerStat[] = [],
  leagueState: LeagueSeasonState | null = null,
  leagueArchives: LeagueSeasonArchive[] = [],
  theIdolsState?: TheIdolsSeasonState | null,
  theIdolsArchives: TheIdolsSeasonArchive[] = []
): {
  topIdols: CombinedStatsRecord[];
  topGroups: CombinedStatsRecord[];
} {
  const idolMap = new Map<string, CombinedStatsRecord>();
  const groupMap = new Map<string, CombinedStatsRecord>();

  const safeIdols = idols || [];
  const safeGirlGroups = girlGroups || [];
  const safeCareerStats = careerStats || [];
  const safeLeagueArchives = leagueArchives || [];
  const safeTheIdolsArchives = theIdolsArchives || [];

  // 1. Initialize from all idols
  safeIdols.forEach((idol) => {
    if (!idol || !idol.id) return;
    idolMap.set(idol.id, {
      id: idol.id,
      name: idol.name || 'Unknown',
      type: 'idol',
      girlGroup: idol.girlGroup || '',
      photoUrl: idol.photoUrl || '',
      nationality: idol.nationality || 'South Korea',
      seed: idol.seed || 'Unseeded',
      titles: 0,
      originalTitles: 0,
      leagueTitles: 0,
      totalPoints: 0,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      gameDiff: 0,
    });
  });

  // 2. Initialize from all girl groups
  safeGirlGroups.forEach((group) => {
    if (!group || !group.name) return;
    groupMap.set(group.name, {
      id: group.id || group.name,
      name: group.name,
      type: 'group',
      photoUrl: group.logoUrl || '',
      titles: 0,
      originalTitles: 0,
      leagueTitles: 0,
      totalPoints: 0,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRate: 0,
      gameDiff: 0,
    });
  });

  // 3. Merge Career Stats from Original Tournaments
  safeCareerStats.forEach((cs) => {
    if (!cs) return;
    const rec = idolMap.get(cs.idolId);
    if (rec) {
      rec.originalTitles += cs.championships || 0;
      rec.titles += cs.championships || 0;
      rec.matches += cs.matches || 0;
      rec.wins += cs.wins || 0;
      rec.draws += cs.draws || 0;
      rec.losses += cs.losses || 0;
      rec.gameDiff += cs.gameDiff || 0;
      // Points formula: 3 for win, 1 for draw, + 10 for championship, + 5 for runner-up
      rec.totalPoints += (cs.wins || 0) * 3 + (cs.draws || 0) * 1 + (cs.championships || 0) * 10 + (cs.runnerUps || 0) * 5;
    }

    // Merge to group
    if (cs.girlGroup && cs.girlGroup !== 'Solo') {
      let gRec = groupMap.get(cs.girlGroup);
      if (!gRec) {
        gRec = {
          id: cs.girlGroup,
          name: cs.girlGroup,
          type: 'group',
          titles: 0,
          originalTitles: 0,
          leagueTitles: 0,
          totalPoints: 0,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          winRate: 0,
          gameDiff: 0,
        };
        groupMap.set(cs.girlGroup, gRec);
      }
      gRec.originalTitles += cs.championships || 0;
      gRec.titles += cs.championships || 0;
      gRec.matches += cs.matches || 0;
      gRec.wins += cs.wins || 0;
      gRec.draws += cs.draws || 0;
      gRec.losses += cs.losses || 0;
      gRec.gameDiff += cs.gameDiff || 0;
      gRec.totalPoints += (cs.wins || 0) * 3 + (cs.draws || 0) * 1 + (cs.championships || 0) * 10;
    }
  });

  // 4. Merge Current Active League Season Stats
  if (leagueState && Array.isArray(leagueState.leagues)) {
    leagueState.leagues.forEach((l) => {
      (l.standings || []).forEach((st) => {
        if (!st) return;
        const rec = idolMap.get(st.idolId);
        if (rec) {
          rec.matches += st.played || 0;
          rec.wins += st.wins || 0;
          rec.draws += st.draws || 0;
          rec.losses += st.losses || 0;
          rec.gameDiff += st.gameDiff || 0;
          rec.totalPoints += st.points || 0;
          if (l.isCompleted && st.rank === 1 && (st.played || 0) > 0) {
            rec.leagueTitles += 1;
            rec.titles += 1;
            rec.totalPoints += 15; // League champion bonus
          }
        }

        if (st.girlGroup && st.girlGroup !== 'Solo') {
          let gRec = groupMap.get(st.girlGroup);
          if (gRec) {
            gRec.matches += st.played || 0;
            gRec.wins += st.wins || 0;
            gRec.draws += st.draws || 0;
            gRec.losses += st.losses || 0;
            gRec.gameDiff += st.gameDiff || 0;
            gRec.totalPoints += st.points || 0;
            if (l.isCompleted && st.rank === 1 && (st.played || 0) > 0) {
              gRec.leagueTitles += 1;
              gRec.titles += 1;
              gRec.totalPoints += 15;
            }
          }
        }
      });
    });
  }

  // 5. Merge League Archives
  safeLeagueArchives.forEach((arch) => {
    if (!arch) return;
    const titlesCountedInArch = new Set<string>();
    (arch.leagueWinners || []).forEach((w) => {
      if (!w) return;
      const champId = w.championId;
      if (champId && !titlesCountedInArch.has(champId)) {
        titlesCountedInArch.add(champId);
        const rec = idolMap.get(champId);
        if (rec) {
          rec.leagueTitles += 1;
          rec.titles += 1;
          rec.totalPoints += 15;
        }
      }
      if (w.championGroup && w.championGroup !== 'Solo') {
        const gRec = groupMap.get(w.championGroup);
        if (gRec) {
          gRec.leagueTitles += 1;
          gRec.titles += 1;
          gRec.totalPoints += 15;
        }
      }
    });

    if (arch.allStandings) {
      Object.values(arch.allStandings).forEach((standingsList) => {
        (standingsList || []).forEach((st) => {
          if (!st) return;
          const rec = idolMap.get(st.idolId);
          if (rec) {
            rec.matches += st.played || 0;
            rec.wins += st.wins || 0;
            rec.draws += st.draws || 0;
            rec.losses += st.losses || 0;
            rec.gameDiff += st.gameDiff || 0;
            rec.totalPoints += st.points || 0;
            if (st.rank === 1 && (st.played || 0) > 0 && !titlesCountedInArch.has(st.idolId)) {
              titlesCountedInArch.add(st.idolId);
              rec.leagueTitles += 1;
              rec.titles += 1;
              rec.totalPoints += 15;
            }
          }
        });
      });
    }
  });

  // 6. Include The Idols Current Season Standings & Playoffs
  if (theIdolsState) {
    (theIdolsState.standings || []).forEach((st) => {
      if (!st || !st.idolId) return;
      const rec = idolMap.get(st.idolId);
      if (rec) {
        rec.matches += st.played || 0;
        rec.wins += st.wins || 0;
        rec.draws += st.draws || 0;
        rec.losses += st.losses || 0;
        rec.gameDiff += st.gameDiff || 0;
        rec.totalPoints += st.points || 0;

        // If Superleague league completed and finished #1
        if (theIdolsState.isLeagueCompleted && st.rank === 1) {
          rec.totalPoints += 10;
        }

        // Group aggregation
        if (rec.girlGroup && groupMap.has(rec.girlGroup)) {
          const gRec = groupMap.get(rec.girlGroup)!;
          gRec.matches += st.played || 0;
          gRec.wins += st.wins || 0;
          gRec.draws += st.draws || 0;
          gRec.losses += st.losses || 0;
          gRec.gameDiff += st.gameDiff || 0;
          gRec.totalPoints += st.points || 0;
        }
      }
    });

    // Process Playoff Matches for Current The Idols Season
    (theIdolsState.playoffMatches || []).forEach((pm) => {
      if (!pm.completed) return;
      if (pm.idolAId && idolMap.has(pm.idolAId)) {
        const recA = idolMap.get(pm.idolAId)!;
        recA.matches += 1;
        if (pm.winnerId === pm.idolAId) {
          recA.wins += 1;
          recA.totalPoints += 3;
        } else {
          recA.losses += 1;
        }
        recA.gameDiff += (pm.scoreA || 0) - (pm.scoreB || 0);
      }
      if (pm.idolBId && idolMap.has(pm.idolBId)) {
        const recB = idolMap.get(pm.idolBId)!;
        recB.matches += 1;
        if (pm.winnerId === pm.idolBId) {
          recB.wins += 1;
          recB.totalPoints += 3;
        } else {
          recB.losses += 1;
        }
        recB.gameDiff += (pm.scoreB || 0) - (pm.scoreA || 0);
      }
    });

    // Check if Regular Season completed and award 1 title to regular season winner
    if (theIdolsState.isLeagueCompleted && theIdolsState.standings && theIdolsState.standings.length > 0) {
      const regularChampId = theIdolsState.standings[0]?.idolId;
      if (regularChampId && idolMap.has(regularChampId)) {
        const regChampRec = idolMap.get(regularChampId)!;
        regChampRec.titles += 1;
        regChampRec.theIdolsTitles = (regChampRec.theIdolsTitles || 0) + 1;
        regChampRec.totalPoints += 15;

        if (regChampRec.girlGroup && groupMap.has(regChampRec.girlGroup)) {
          const gRec = groupMap.get(regChampRec.girlGroup)!;
          gRec.titles += 1;
          gRec.theIdolsTitles = (gRec.theIdolsTitles || 0) + 1;
          gRec.totalPoints += 15;
        }
      }
    }

    // Check if Playoff completed and champion crowned
    if (theIdolsState.isPlayoffCompleted) {
      const grandFinals = (theIdolsState.playoffMatches || []).filter(
        (m) => m.bracket === 'grand_final' && m.completed
      );
      const lastGf = grandFinals[grandFinals.length - 1];
      if (lastGf && lastGf.winnerId && idolMap.has(lastGf.winnerId)) {
        const champRec = idolMap.get(lastGf.winnerId)!;
        champRec.titles += 1;
        champRec.theIdolsTitles = (champRec.theIdolsTitles || 0) + 1;
        champRec.totalPoints += 20;

        if (champRec.girlGroup && groupMap.has(champRec.girlGroup)) {
          const gRec = groupMap.get(champRec.girlGroup)!;
          gRec.titles += 1;
          gRec.theIdolsTitles = (gRec.theIdolsTitles || 0) + 1;
          gRec.totalPoints += 20;
        }
      }
    }
  }

  // 7. Include The Idols Historical Archives
  safeTheIdolsArchives.forEach((arch) => {
    if (!arch) return;
    (arch.standings || []).forEach((st) => {
      if (!st || !st.idolId) return;
      const rec = idolMap.get(st.idolId);
      if (rec) {
        rec.matches += st.played || 0;
        rec.wins += st.wins || 0;
        rec.draws += st.draws || 0;
        rec.losses += st.losses || 0;
        rec.gameDiff += st.gameDiff || 0;
        rec.totalPoints += st.points || 0;

        if (rec.girlGroup && groupMap.has(rec.girlGroup)) {
          const gRec = groupMap.get(rec.girlGroup)!;
          gRec.matches += st.played || 0;
          gRec.wins += st.wins || 0;
          gRec.draws += st.draws || 0;
          gRec.losses += st.losses || 0;
          gRec.gameDiff += st.gameDiff || 0;
          gRec.totalPoints += st.points || 0;
        }
      }
    });

    // Add Regular Season 1st Place Title from The Idols Archive
    if (arch.standings && arch.standings.length > 0) {
      const regularChampId = arch.standings[0]?.idolId;
      if (regularChampId && idolMap.has(regularChampId)) {
        const regChampRec = idolMap.get(regularChampId)!;
        regChampRec.titles += 1;
        regChampRec.theIdolsTitles = (regChampRec.theIdolsTitles || 0) + 1;
        regChampRec.totalPoints += 15;

        if (regChampRec.girlGroup && groupMap.has(regChampRec.girlGroup)) {
          const gRec = groupMap.get(regChampRec.girlGroup)!;
          gRec.titles += 1;
          gRec.theIdolsTitles = (gRec.theIdolsTitles || 0) + 1;
          gRec.totalPoints += 15;
        }
      }
    }

    // Add Champion Title and Honors from The Idols Archive (Playoff/Cup Champion)
    if (arch.championId && idolMap.has(arch.championId)) {
      const champRec = idolMap.get(arch.championId)!;
      champRec.titles += 1;
      champRec.theIdolsTitles = (champRec.theIdolsTitles || 0) + 1;
      champRec.totalPoints += 20;

      if (champRec.girlGroup && groupMap.has(champRec.girlGroup)) {
        const gRec = groupMap.get(champRec.girlGroup)!;
        gRec.titles += 1;
        gRec.theIdolsTitles = (gRec.theIdolsTitles || 0) + 1;
        gRec.totalPoints += 20;
      }
    }
    if (arch.runnerUpId && idolMap.has(arch.runnerUpId)) {
      const ruRec = idolMap.get(arch.runnerUpId)!;
      ruRec.totalPoints += 8;
    }
    if (arch.mvpId && idolMap.has(arch.mvpId)) {
      const mvpRec = idolMap.get(arch.mvpId)!;
      mvpRec.totalPoints += 5;
    }
  });

  // Calculate final win rates
  const finalizeRecords = (records: CombinedStatsRecord[]) => {
    (records || []).forEach((r) => {
      if (!r) return;
      r.winRate = r.matches > 0 ? Math.round((r.wins / r.matches) * 1000) / 10 : 0;
    });

    // Sort by: Titles desc, Total Points desc, Win Rate desc, Wins desc, Matches desc
    return records.sort((a, b) => {
      if (b.titles !== a.titles) return b.titles - a.titles;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.matches - a.matches;
    });
  };

  const topIdols = finalizeRecords(Array.from(idolMap.values()));
  const topGroups = finalizeRecords(Array.from(groupMap.values()));

  return { topIdols, topGroups };
}

/**
 * Simulate a single match between two idols in a league with realistic score distributions (0 to 4 goals)
 * Uses idol ratings (0-100) for authentic competitive results while retaining matchday drama.
 */
export function simulateLeagueMatch(
  idolA: Idol,
  idolB: Idol,
  formHistoryA?: Array<'W' | 'D' | 'L'>,
  formHistoryB?: Array<'W' | 'D' | 'L'>
): { scoreA: number; scoreB: number; winnerId: string | null } {
  return simulateLeagueMatchScore(idolA, idolB, formHistoryA, formHistoryB);
}

/**
 * Converts completed League Matches into standard ArchivedMatch records
 */
export function syncLeagueMatchesToArchivedMatches(
  leagueState: LeagueSeasonState | null,
  leagueArchives: LeagueSeasonArchive[],
  idols: Idol[]
): ArchivedMatch[] {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));
  const results: ArchivedMatch[] = [];

  const addLeagueMatch = (
    m: LeagueMatch,
    seasonNumber: number,
    seasonName: string,
    leagueName: string
  ) => {
    if (!m.completed || m.scoreA === null || m.scoreB === null) return;
    const idolA = idolsMap.get(m.idolAId);
    const idolB = idolsMap.get(m.idolBId);
    const idolAId = m.idolAId || idolA?.id || '';
    const idolBId = m.idolBId || idolB?.id || '';
    const idolAName = idolA?.name || `Idol ${m.idolAId}`;
    const idolBName = idolB?.name || `Idol ${m.idolBId}`;
    const idolAGroup = idolA?.girlGroup || 'Solo';
    const idolBGroup = idolB?.girlGroup || 'Solo';

    const winnerId =
      m.winnerId ||
      (m.scoreA > m.scoreB ? idolAId : m.scoreB > m.scoreA ? idolBId : '');
    const isDraw = m.scoreA === m.scoreB;
    const winnerName = isDraw
      ? 'Draw'
      : winnerId === idolAId
      ? idolAName
      : idolBName;
    const loserId = isDraw ? '' : winnerId === idolAId ? idolBId : idolAId;
    const loserName = isDraw ? '' : winnerId === idolAId ? idolBName : idolAName;

    const matchKey = (m.id && m.id.startsWith('league_s'))
      ? m.id
      : `league_s${seasonNumber}_div${m.leagueId || '1'}_${m.id || Math.random().toString(36).substring(2, 7)}`;

    results.push({
      matchId: matchKey,
      seasonId: seasonNumber,
      seasonName,
      stage: `League - ${leagueName} (MD ${m.matchday})`,
      groupName: leagueName,
      idolAId,
      idolAName,
      idolAGroup,
      idolBId,
      idolBName,
      idolBGroup,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerId,
      winnerName,
      loserId,
      loserName,
      isDraw,
      date: m.updatedAt || new Date().toISOString(),
    });
  };

  const addWildcardMatch = (
    wm: WildcardMatch,
    seasonNumber: number,
    seasonName: string
  ) => {
    if (!wm || !wm.completed || wm.scoreA === null || wm.scoreB === null || !wm.idolAId || !wm.idolBId) return;
    const idolA = idolsMap.get(wm.idolAId);
    const idolB = idolsMap.get(wm.idolBId);
    const idolAId = wm.idolAId || idolA?.id || '';
    const idolBId = wm.idolBId || idolB?.id || '';
    const idolAName = idolA?.name || `Idol ${wm.idolAId}`;
    const idolBName = idolB?.name || `Idol ${wm.idolBId}`;
    const idolAGroup = idolA?.girlGroup || 'Solo';
    const idolBGroup = idolB?.girlGroup || 'Solo';

    const winnerId = wm.winnerId || (wm.scoreA > wm.scoreB ? idolAId : idolBId);
    const winnerName = winnerId === idolAId ? idolAName : idolBName;
    const loserId = wm.loserId || (winnerId === idolAId ? idolBId : idolAId);
    const loserName = winnerId === idolAId ? idolBName : idolAName;

    const matchKey = (wm.id && wm.id.startsWith('wildcard_s'))
      ? wm.id
      : `wildcard_s${seasonNumber}_${wm.id || Math.random().toString(36).substring(2, 7)}`;

    results.push({
      matchId: matchKey,
      seasonId: seasonNumber,
      seasonName,
      stage: `League - Wildcard Play-In (${wm.roundName})`,
      groupName: 'Wildcard Play-In',
      idolAId,
      idolAName,
      idolAGroup,
      idolBId,
      idolBName,
      idolBGroup,
      scoreA: wm.scoreA,
      scoreB: wm.scoreB,
      winnerId,
      winnerName,
      loserId,
      loserName,
      isDraw: false,
      date: wm.updatedAt || new Date().toISOString(),
    });
  };

  const addSwissMatch = (
    sm: SwissMatch,
    seasonNumber: number,
    seasonName: string
  ) => {
    if (!sm || !sm.completed || sm.scoreA === null || sm.scoreB === null || !sm.idolAId || !sm.idolBId) return;
    const idolA = idolsMap.get(sm.idolAId);
    const idolB = idolsMap.get(sm.idolBId);
    const idolAId = sm.idolAId || idolA?.id || '';
    const idolBId = sm.idolBId || idolB?.id || '';
    const idolAName = idolA?.name || `Idol ${sm.idolAId}`;
    const idolBName = idolB?.name || `Idol ${sm.idolBId}`;
    const idolAGroup = idolA?.girlGroup || 'Solo';
    const idolBGroup = idolB?.girlGroup || 'Solo';

    const winnerId = sm.winnerId || (sm.scoreA > sm.scoreB ? idolAId : idolBId);
    const winnerName = winnerId === idolAId ? idolAName : idolBName;
    const loserId = sm.loserId || (winnerId === idolAId ? idolBId : idolAId);
    const loserName = winnerId === idolAId ? idolBName : idolAName;

    const matchKey = (sm.id && sm.id.startsWith('swiss_s'))
      ? sm.id
      : `swiss_s${seasonNumber}_${sm.id || Math.random().toString(36).substring(2, 7)}`;

    results.push({
      matchId: matchKey,
      seasonId: seasonNumber,
      seasonName,
      stage: `League - Swiss Play-In (${sm.poolName} - ${sm.roundName})`,
      groupName: sm.poolName,
      idolAId,
      idolAName,
      idolAGroup,
      idolBId,
      idolBName,
      idolBGroup,
      scoreA: sm.scoreA,
      scoreB: sm.scoreB,
      winnerId,
      winnerName,
      loserId,
      loserName,
      isDraw: false,
      date: sm.updatedAt || new Date().toISOString(),
    });
  };

  // From archives
  (leagueArchives || []).forEach((arch) => {
    if (!arch) return;
    (arch.allMatches || []).forEach((m) => {
      if (!m) return;
      const leagueDef = DEFAULT_LEAGUE_DEFS.find((d) => d.id === m.leagueId);
      addLeagueMatch(
        m,
        arch.seasonNumber,
        arch.seasonName,
        leagueDef?.name || `Division ${m.leagueId}`
      );
    });

    if (arch.wildcardPlayIn?.matches) {
      arch.wildcardPlayIn.matches.forEach((wm) => {
        if (!wm) return;
        addWildcardMatch(wm, arch.seasonNumber, arch.seasonName);
      });
    }

    if (arch.swissPlayIn?.matches) {
      arch.swissPlayIn.matches.forEach((sm) => {
        if (!sm) return;
        addSwissMatch(sm, arch.seasonNumber, arch.seasonName);
      });
    }
    if (arch.swissPlayIn?.lastChanceMatches) {
      arch.swissPlayIn.lastChanceMatches.forEach((sm) => {
        if (!sm) return;
        addSwissMatch(sm, arch.seasonNumber, arch.seasonName);
      });
    }
  });

  // From active league
  if (leagueState && Array.isArray(leagueState.leagues)) {
    leagueState.leagues.forEach((l) => {
      if (!l) return;
      (l.matches || []).forEach((m) => {
        if (!m) return;
        addLeagueMatch(m, leagueState.seasonNumber, leagueState.seasonName, l.name);
      });
    });

    if (leagueState.wildcardPlayIn?.matches) {
      leagueState.wildcardPlayIn.matches.forEach((wm) => {
        if (!wm) return;
        addWildcardMatch(wm, leagueState.seasonNumber, leagueState.seasonName);
      });
    }

    if (leagueState.swissPlayIn?.matches) {
      leagueState.swissPlayIn.matches.forEach((sm) => {
        if (!sm) return;
        addSwissMatch(sm, leagueState.seasonNumber, leagueState.seasonName);
      });
    }
    if (leagueState.swissPlayIn?.lastChanceMatches) {
      leagueState.swissPlayIn.lastChanceMatches.forEach((sm) => {
        if (!sm) return;
        addSwissMatch(sm, leagueState.seasonNumber, leagueState.seasonName);
      });
    }
  }

  return results;
}

/**
 * Calculates a precise chronological weight for sorting matches across all formats and seasons.
 * Higher weight = Newer match.
 * Ensures newer seasons have higher weights, and league matchdays and tournament matches
 * within a season are properly indexed without pushing league matches to the back/oldest.
 */
export function getMatchChronologicalWeight(m: {
  seasonId?: number | string;
  seasonName?: string;
  stage?: string;
  stageOrDivision?: string;
  groupName?: string;
  date?: string;
  type?: string;
}): number {
  let sId = 1;
  if (m.seasonId !== undefined && m.seasonId !== null) {
    sId = Number(m.seasonId) || 1;
  } else if (m.seasonName) {
    const sMatch = m.seasonName.match(/(\d+)/);
    if (sMatch) sId = parseInt(sMatch[1], 10);
  }

  const stageText = (m.stage || m.stageOrDivision || m.groupName || '').toLowerCase();
  const isLeague =
    m.type === 'League Division' ||
    stageText.includes('league') ||
    stageText.includes('division') ||
    stageText.includes('wildcard') ||
    stageText.includes('swiss') ||
    stageText.includes('last chance') ||
    stageText.includes('premier') ||
    stageText.includes('championship') ||
    stageText.includes('md ') ||
    stageText.includes('matchday');

  let stageScore = 0;
  if (isLeague) {
    if (stageText.includes('last chance')) {
      stageScore = 89000;
    } else if (stageText.includes('swiss')) {
      let rNum = 1;
      const rMatch = stageText.match(/round\s*(\d+)/i) || stageText.match(/r(\d+)/i);
      if (rMatch) rNum = parseInt(rMatch[1], 10);
      stageScore = 88000 + Math.min(rNum, 4) * 200;
    } else if (stageText.includes('wildcard')) {
      stageScore = 88000;
    } else {
      let md = 1;
      const mdMatch = stageText.match(/md\s*(\d+)/i) || stageText.match(/matchday\s*(\d+)/i);
      if (mdMatch) {
        md = parseInt(mdMatch[1], 10);
      }
      // Give league matches high chronological scores so newest matchdays are properly weighted at the top
      stageScore = 80000 + Math.min(md, 99) * 150;
    }
  } else {
    // Tournament Cup stages
    if (
      stageText.includes('final') &&
      !stageText.includes('semi') &&
      !stageText.includes('quarter') &&
      !stageText.includes('round of')
    ) {
      stageScore = 90000;
    } else if (stageText.includes('3rd') || stageText.includes('third')) {
      stageScore = 85000;
    } else if (stageText.includes('semi')) {
      stageScore = 80000;
    } else if (stageText.includes('quarter')) {
      stageScore = 70000;
    } else if (
      stageText.includes('16') ||
      stageText.includes('round of 16') ||
      stageText.includes('r16')
    ) {
      stageScore = 60000;
    } else if (
      stageText.includes('32') ||
      stageText.includes('round of 32') ||
      stageText.includes('r32')
    ) {
      stageScore = 50000;
    } else if (
      stageText.includes('64') ||
      stageText.includes('round of 64') ||
      stageText.includes('r64')
    ) {
      stageScore = 40000;
    } else if (stageText.includes('knockout')) {
      stageScore = 55000;
    } else {
      // Group Stage
      let gMd = 1;
      const gMdMatch = stageText.match(/round\s*(\d+)/i) || stageText.match(/md\s*(\d+)/i);
      if (gMdMatch) gMd = parseInt(gMdMatch[1], 10);
      stageScore = 20000 + gMd * 100;
    }
  }

  return sId * 1000000 + stageScore;
}

/**
 * Universal match comparator sorting newest data first.
 * Compares by season, timestamp (if present), and chronological weight.
 */
export function compareMatchesNewestFirst(
  a: {
    seasonId?: number | string;
    seasonName?: string;
    stage?: string;
    stageOrDivision?: string;
    groupName?: string;
    date?: string;
    type?: string;
    chronologicalWeight?: number;
  },
  b: {
    seasonId?: number | string;
    seasonName?: string;
    stage?: string;
    stageOrDivision?: string;
    groupName?: string;
    date?: string;
    type?: string;
    chronologicalWeight?: number;
  }
): number {
  // 1. If both matches have actual timestamps (ISO date or valid timestamp string), sort by exact played time (newest first)
  if (a.date && b.date) {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeA > 0 && timeB > 0 && Math.abs(timeB - timeA) > 100) {
      return timeB - timeA;
    }
  } else if (a.date && !b.date) {
    const timeA = new Date(a.date).getTime();
    if (!isNaN(timeA) && timeA > 0) return -1;
  } else if (!a.date && b.date) {
    const timeB = new Date(b.date).getTime();
    if (!isNaN(timeB) && timeB > 0) return 1;
  }

  // 2. Fall back to chronological weight and season hierarchy
  const weightA = a.chronologicalWeight ?? getMatchChronologicalWeight(a);
  const weightB = b.chronologicalWeight ?? getMatchChronologicalWeight(b);

  const seasonA = Math.floor(weightA / 1000000);
  const seasonB = Math.floor(weightB / 1000000);
  if (seasonB !== seasonA) {
    return seasonB - seasonA;
  }

  return weightB - weightA;
}

/**
 * Archives a completed or active League Season into a LeagueSeasonArchive record
 */
export function archiveLeagueSeason(
  leagueState: LeagueSeasonState,
  idols: Idol[]
): LeagueSeasonArchive {
  const winners = getLeagueWinners(leagueState.leagues, idols);
  const standingsRecord: Record<number, LeagueStanding[]> = {};
  leagueState.leagues.forEach((l) => {
    standingsRecord[l.id] = l.standings;
  });

  const allMatchesFlat: LeagueMatch[] = [];
  leagueState.leagues.forEach((l) => allMatchesFlat.push(...(l.matches || [])));

  const format = leagueState.postseasonFormat || 'grand_cup_64';
  const top32 = getTop32Qualifiers(leagueState.leagues, idols, leagueState.wildcardPlayIn);
  const allQuals = format === 'grand_cup_64'
    ? getGrandCup64Qualifiers(leagueState.leagues, idols, leagueState.swissPlayIn)
    : top32;

  return {
    seasonNumber: leagueState.seasonNumber,
    seasonName: leagueState.seasonName || `League Season ${leagueState.seasonNumber}`,
    completedAt: new Date().toISOString(),
    postseasonFormat: format,
    leagueWinners: winners,
    allStandings: standingsRecord,
    allMatches: allMatchesFlat,
    top32Qualifiers: top32,
    qualifiers: allQuals,
    wildcardPlayIn: leagueState.wildcardPlayIn ? { ...leagueState.wildcardPlayIn } : undefined,
    swissPlayIn: leagueState.swissPlayIn ? { ...leagueState.swissPlayIn } : undefined,
  };
}

/**
 * Advances to the next League Season while STRICTLY PRESERVING league division rosters.
 * Division rosters remain 100% stable unless the user explicitly edits them.
 * Resets matches (fresh round-robin unplayed 0-0) and resets standings for the new season.
 */
export function advanceLeagueSeason(
  currentState: LeagueSeasonState,
  idols: Idol[],
  _girlGroups: GirlGroup[],
  targetSeasonNumber?: number
): LeagueSeasonState {
  const nextSeasonNumber = targetSeasonNumber || currentState.seasonNumber + 1;
  const currentLeagues = currentState.leagues || [];

  const updatedLeagues: LeagueInfo[] = currentLeagues.map((oldL) => {
    // Preserve the exact roster assigned to this division
    const members = [...(oldL.memberIds || [])];

    const freshMatches = generateRoundRobinMatches(oldL.id, members);
    const freshStandings = calculateLeagueStandings(oldL.id, members, freshMatches, idols);

    return {
      ...oldL,
      memberIds: members,
      isCompleted: false,
      matches: freshMatches,
      standings: freshStandings,
    };
  });

  const freshWildcard = generateWildcardPlayIn(updatedLeagues, idols);
  const freshSwiss = generateSwissPlayIn(updatedLeagues, idols);

  return {
    seasonNumber: nextSeasonNumber,
    seasonName: incrementSeasonName(currentState.seasonName, nextSeasonNumber, 'League Season'),
    isStarted: true,
    isCompleted: false,
    currentMatchday: 1,
    leagues: updatedLeagues,
    postseasonFormat: currentState.postseasonFormat || 'grand_cup_64',
    wildcardPlayIn: freshWildcard,
    swissPlayIn: freshSwiss,
    championsAdvancementDone: false,
  };
}

/**
 * Resets all league matches back to 0-0 unplayed and resets division standings,
 * keeping EVERY division's roster (memberIds) 100% intact and unchanged.
 */
export function resetLeagueSeasonMatchesOnly(
  currentState: LeagueSeasonState,
  idols: Idol[]
): LeagueSeasonState {
  const updatedLeagues: LeagueInfo[] = (currentState.leagues || []).map((l) => {
    const members = [...(l.memberIds || [])];
    const freshMatches = generateRoundRobinMatches(l.id, members);
    const freshStandings = calculateLeagueStandings(l.id, members, freshMatches, idols);
    return {
      ...l,
      isCompleted: false,
      matches: freshMatches,
      standings: freshStandings,
    };
  });

  const freshWildcard = generateWildcardPlayIn(updatedLeagues, idols);
  const freshSwiss = generateSwissPlayIn(updatedLeagues, idols);

  return {
    ...currentState,
    isCompleted: false,
    currentMatchday: 1,
    leagues: updatedLeagues,
    wildcardPlayIn: freshWildcard,
    swissPlayIn: freshSwiss,
    championsAdvancementDone: false,
  };
}
