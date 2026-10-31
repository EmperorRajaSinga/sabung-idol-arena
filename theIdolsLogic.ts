import {
  Idol,
  GirlGroup,
  TheIdolsMatch,
  TheIdolsStanding,
  TheIdolsPlayoffMatch,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsPlayoffGameScore,
  TheIdolsPlayoffTier,
  ArchivedMatch,
} from '../types';
import { isIdolActive } from './tournamentLogic';
import { incrementSeasonName } from './seasonNameHelper';
import { getIdolRating, calculateRatingWinProbability, simulateBo4Score } from './ratingHelper';
import { calculateIdolForm } from './formHelper';

export function getFormModifier(form: Array<'W' | 'D' | 'L'> = []): number {
  return calculateIdolForm(form).ratingModifier;
}

export const THE_IDOLS_STORAGE_KEY = 'sabung_the_idols_season_state_v1';
export const THE_IDOLS_ARCHIVES_KEY = 'sabung_the_idols_archives_v1';

/**
 * Filter and select Top 20 highest-rated active idols in the arena.
 * Strictly excludes inactive idols and idols belonging to inactive girl groups.
 */
export function getTop20IdolsByRating(idols: Idol[], girlGroups: GirlGroup[] = []): Idol[] {
  const activeIdols = (idols || []).filter((i) => isIdolActive(i, girlGroups));
  return [...activeIdols]
    .sort((a, b) => {
      const rA = getIdolRating(a);
      const rB = getIdolRating(b);
      if (rB !== rA) return rB - rA;
      return (a.name || '').localeCompare(b.name || '');
    })
    .slice(0, 20);
}

/**
 * Generate 38-matchday Double Round-Robin Fixtures for 20 teams (380 matches total, 10 matches per matchday)
 * Leg 1 (MD 1-19) & Leg 2 (MD 20-38) with reversed home/away venues, exactly matching the 6-division league standard.
 */
export function generateTheIdolsRoundRobinMatches(memberIds: string[]): TheIdolsMatch[] {
  const matches: TheIdolsMatch[] = [];
  const teams = [...memberIds];
  const n = teams.length;

  if (n < 2) return matches;

  // For 20 teams: 19 rounds per leg
  const rounds = n - 1; // 19
  const matchesPerRound = n / 2; // 10

  const rotation = [...teams];
  const leg1Rounds: Array<Array<{ home: string; away: string }>> = [];

  for (let r = 0; r < rounds; r++) {
    const roundPairs: Array<{ home: string; away: string }> = [];

    for (let m = 0; m < matchesPerRound; m++) {
      const home = rotation[m];
      const away = rotation[n - 1 - m];

      // Alternate home/away for balance
      const [idolAId, idolBId] = (r + m) % 2 === 0 ? [home, away] : [away, home];
      roundPairs.push({ home: idolAId, away: idolBId });
    }

    leg1Rounds.push(roundPairs);

    // Rotate array, keeping the first element fixed
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    const last = rest.pop()!;
    rest.unshift(last);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  // Generate First Leg (Matchdays 1 to 19)
  leg1Rounds.forEach((roundPairs, rIdx) => {
    const matchday = rIdx + 1;
    roundPairs.forEach((pair, mIdx) => {
      matches.push({
        id: `ti_md${matchday}_m${mIdx + 1}_${pair.home}_vs_${pair.away}`,
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
    const matchday = rIdx + 1 + rounds; // 20 to 38
    roundPairs.forEach((pair, mIdx) => {
      matches.push({
        id: `ti_md${matchday}_m${mIdx + 1}_${pair.away}_vs_${pair.home}`,
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
 * Ensures The Idols matches collection has all 38 matchdays (380 matches),
 * safely migrating existing 19-matchday data without losing any played scores.
 */
export function ensureTheIdolsHas38Matchdays(
  matches: TheIdolsMatch[],
  memberIds: string[]
): TheIdolsMatch[] {
  if (!matches || matches.length === 0) {
    return generateTheIdolsRoundRobinMatches(memberIds);
  }
  const maxMd = Math.max(0, ...matches.map((m) => m.matchday || 0));
  if (maxMd >= 38 && matches.length >= 380) {
    return matches;
  }
  const full38 = generateTheIdolsRoundRobinMatches(memberIds);
  const existingMap = new Map<string, TheIdolsMatch>();
  matches.forEach((m) => {
    existingMap.set(`md${m.matchday}_${m.idolAId}_${m.idolBId}`, m);
    existingMap.set(m.id, m);
  });

  return full38.map((m) => {
    const matchPairKey = `md${m.matchday}_${m.idolAId}_${m.idolBId}`;
    const found = existingMap.get(m.id) || existingMap.get(matchPairKey);
    if (found && found.completed) {
      return { ...m, ...found };
    }
    return m;
  });
}

/**
 * Calculate Standings for The Idols with Goal Difference -> Head-to-Head -> Rating tiebreaker
 */
export function calculateTheIdolsStandings(
  memberIds: string[],
  matches: TheIdolsMatch[],
  idols: Idol[]
): TheIdolsStanding[] {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => {
    idolsMap.set(i.id, i);
    if (i.name) {
      idolsMap.set(i.name.trim().toLowerCase(), i);
    }
  });

  const resolveIdol = (id: string): Idol | undefined => {
    return idolsMap.get(id) || idolsMap.get(id.trim().toLowerCase());
  };

  // Initialize stats dictionary
  const statsMap = new Map<string, {
    idolId: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    gamesFor: number;
    gamesAgainst: number;
    form: Array<'W' | 'D' | 'L'>;
  }>();

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

  // Sort matches chronologically by matchday to preserve true form streaks
  const sortedMatches = [...matches].sort((a, b) => a.matchday - b.matchday);

  // Process completed matches
  sortedMatches.forEach((m) => {
    if (!m.completed || m.scoreA === null || m.scoreB === null) return;

    const statA = statsMap.get(m.idolAId);
    const statB = statsMap.get(m.idolBId);

    if (statA) {
      statA.played += 1;
      statA.gamesFor += m.scoreA;
      statA.gamesAgainst += m.scoreB;
      if (m.scoreA > m.scoreB) {
        statA.wins += 1;
        statA.points += 3;
        statA.form.push('W');
      } else if (m.scoreA < m.scoreB) {
        statA.losses += 1;
        statA.form.push('L');
      } else {
        statA.draws += 1;
        statA.points += 1;
        statA.form.push('D');
      }
    }

    if (statB) {
      statB.played += 1;
      statB.gamesFor += m.scoreB;
      statB.gamesAgainst += m.scoreA;
      if (m.scoreB > m.scoreA) {
        statB.wins += 1;
        statB.points += 3;
        statB.form.push('W');
      } else if (m.scoreB < m.scoreA) {
        statB.losses += 1;
        statB.form.push('L');
      } else {
        statB.draws += 1;
        statB.points += 1;
        statB.form.push('D');
      }
    }
  });

  // Build standing objects
  const standings: TheIdolsStanding[] = memberIds.map((id) => {
    const idol = resolveIdol(id);
    const stat = statsMap.get(id) || {
      idolId: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      form: [],
    };
    const gameDiff = stat.gamesFor - stat.gamesAgainst;
    const rating = idol ? getIdolRating(idol) : 75;

    return {
      idolId: id,
      idolName: idol?.name || 'Unknown Idol',
      girlGroup: idol?.girlGroup || 'Independent',
      seed: idol?.seed || 'Seed 1',
      nationality: idol?.nationality || 'South Korea',
      photoUrl: idol?.photoUrl || '',
      rating,
      played: stat.played,
      wins: stat.wins,
      draws: stat.draws,
      losses: stat.losses,
      points: stat.points,
      gamesFor: stat.gamesFor,
      gamesAgainst: stat.gamesAgainst,
      gameDiff,
      rank: 1,
      form: stat.form.slice(-5), // latest 5 matches
    };
  });

  // Helper for Head-to-Head between two idols
  const getH2HPoints = (idA: string, idB: string): { ptsA: number; ptsB: number; gdA: number } => {
    let ptsA = 0;
    let ptsB = 0;
    let gfA = 0;
    let gfB = 0;
    matches.forEach((m) => {
      if (!m.completed || m.scoreA === null || m.scoreB === null) return;
      if (m.idolAId === idA && m.idolBId === idB) {
        gfA += m.scoreA;
        gfB += m.scoreB;
        if (m.scoreA > m.scoreB) ptsA += 3;
        else if (m.scoreA < m.scoreB) ptsB += 3;
        else {
          ptsA += 1;
          ptsB += 1;
        }
      } else if (m.idolAId === idB && m.idolBId === idA) {
        gfB += m.scoreA;
        gfA += m.scoreB;
        if (m.scoreA > m.scoreB) ptsB += 3;
        else if (m.scoreA < m.scoreB) ptsA += 3;
        else {
          ptsA += 1;
          ptsB += 1;
        }
      }
    });
    return { ptsA, ptsB, gdA: gfA - gfB };
  };

  // Sort with tiebreaking rules: Points -> Goal Diff -> Head-to-Head -> Goals For -> Rating -> Name
  standings.sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points;

    // 2. Goal Difference
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;

    // 3. Head-to-Head
    const h2h = getH2HPoints(a.idolId, b.idolId);
    if (h2h.ptsB !== h2h.ptsA) return h2h.ptsB - h2h.ptsA;
    if (h2h.gdA !== 0) return -h2h.gdA;

    // 4. Goals For
    if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;

    // 5. Rating
    if (b.rating !== a.rating) return b.rating - a.rating;

    // 6. Alphabetical
    return a.idolName.localeCompare(b.idolName);
  });

  // Assign Ranks and Playoff Tiers
  standings.forEach((st, idx) => {
    const rank = idx + 1;
    st.rank = rank;

    if (rank <= 2) {
      st.playoffSeed = rank;
      st.playoffTier = 'upper_r3'; // Wait in Upper Bracket Round 3
    } else if (rank <= 4) {
      st.playoffSeed = rank;
      st.playoffTier = 'upper_r2'; // Wait in Upper Bracket Round 2
    } else if (rank <= 8) {
      st.playoffSeed = rank;
      st.playoffTier = 'upper_r1'; // Play in Upper Bracket Round 1 (5 vs 8, 6 vs 7)
    } else if (rank <= 10) {
      st.playoffSeed = rank;
      st.playoffTier = 'lower_r1'; // Wait in Lower Bracket Round 1
    } else {
      st.playoffSeed = undefined;
      st.playoffTier = 'eliminated';
    }
  });

  return standings;
}

/**
 * Initialize the Double Elimination Stepped Playoff Bracket for Top 10 Idols
 */
export function initializeTheIdolsPlayoffMatches(standings: TheIdolsStanding[]): TheIdolsPlayoffMatch[] {
  const seedMap = new Map<number, string>();
  standings.forEach((st) => {
    if (st.playoffSeed) {
      seedMap.set(st.playoffSeed, st.idolId);
    }
  });

  const s1 = seedMap.get(1) || null;
  const s2 = seedMap.get(2) || null;
  const s3 = seedMap.get(3) || null;
  const s4 = seedMap.get(4) || null;
  const s5 = seedMap.get(5) || null;
  const s6 = seedMap.get(6) || null;
  const s7 = seedMap.get(7) || null;
  const s8 = seedMap.get(8) || null;
  const s9 = seedMap.get(9) || null;
  const s10 = seedMap.get(10) || null;

  const matches: TheIdolsPlayoffMatch[] = [
    // --- UPPER BRACKET ROUND 1 (Best of 5) ---
    {
      id: 'ti_po_ub_r1_m1',
      bracket: 'upper',
      roundCode: 'UB_R1',
      roundName: 'UB Round 1 (Match 1)',
      matchNumber: 1,
      bestOf: 5,
      targetWins: 3,
      idolAId: s5, // Seed 5
      idolBId: s8, // Seed 8
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_ub_r2_m1',
      feedsWinnerToSlot: 'B',
      feedsLoserToMatchId: 'ti_po_lb_r1_m1',
      feedsLoserToSlot: 'A',
    },
    {
      id: 'ti_po_ub_r1_m2',
      bracket: 'upper',
      roundCode: 'UB_R1',
      roundName: 'UB Round 1 (Match 2)',
      matchNumber: 2,
      bestOf: 5,
      targetWins: 3,
      idolAId: s6, // Seed 6
      idolBId: s7, // Seed 7
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_ub_r2_m2',
      feedsWinnerToSlot: 'B',
      feedsLoserToMatchId: 'ti_po_lb_r1_m2',
      feedsLoserToSlot: 'A',
    },

    // --- UPPER BRACKET ROUND 2 (UB Quarterfinals, Best of 5) ---
    {
      id: 'ti_po_ub_r2_m1',
      bracket: 'upper',
      roundCode: 'UB_R2',
      roundName: 'UB Quarterfinals (Match 1)',
      matchNumber: 3,
      bestOf: 5,
      targetWins: 3,
      idolAId: s3, // Seed 3 waits here
      idolBId: null, // Winner of UB R1 M1
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_ub_r3_m1',
      feedsWinnerToSlot: 'B',
      feedsLoserToMatchId: 'ti_po_lb_r2_m1',
      feedsLoserToSlot: 'B',
    },
    {
      id: 'ti_po_ub_r2_m2',
      bracket: 'upper',
      roundCode: 'UB_R2',
      roundName: 'UB Quarterfinals (Match 2)',
      matchNumber: 4,
      bestOf: 5,
      targetWins: 3,
      idolAId: s4, // Seed 4 waits here
      idolBId: null, // Winner of UB R1 M2
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_ub_r3_m2',
      feedsWinnerToSlot: 'B',
      feedsLoserToMatchId: 'ti_po_lb_r2_m2',
      feedsLoserToSlot: 'B',
    },

    // --- UPPER BRACKET ROUND 3 (UB Semifinals, Best of 5) ---
    {
      id: 'ti_po_ub_r3_m1',
      bracket: 'upper',
      roundCode: 'UB_R3',
      roundName: 'UB Semifinals (Match 1)',
      matchNumber: 5,
      bestOf: 5,
      targetWins: 3,
      idolAId: s1, // Seed 1 waits here
      idolBId: null, // Winner of UB R2 M1
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_ub_final',
      feedsWinnerToSlot: 'A',
      feedsLoserToMatchId: 'ti_po_lb_r3_m1',
      feedsLoserToSlot: 'B',
    },
    {
      id: 'ti_po_ub_r3_m2',
      bracket: 'upper',
      roundCode: 'UB_R3',
      roundName: 'UB Semifinals (Match 2)',
      matchNumber: 6,
      bestOf: 5,
      targetWins: 3,
      idolAId: s2, // Seed 2 waits here
      idolBId: null, // Winner of UB R2 M2
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_ub_final',
      feedsWinnerToSlot: 'B',
      feedsLoserToMatchId: 'ti_po_lb_r3_m2',
      feedsLoserToSlot: 'B',
    },

    // --- UPPER BRACKET FINAL (Best of 5) ---
    {
      id: 'ti_po_ub_final',
      bracket: 'upper',
      roundCode: 'UB_FINAL',
      roundName: 'Upper Bracket Final',
      matchNumber: 7,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner UB R3 M1
      idolBId: null, // Winner UB R3 M2
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_gf',
      feedsWinnerToSlot: 'A', // Upper Bracket Champion
      feedsLoserToMatchId: 'ti_po_lb_final',
      feedsLoserToSlot: 'B',
    },

    // --- LOWER BRACKET ROUND 1 (Best of 5) ---
    {
      id: 'ti_po_lb_r1_m1',
      bracket: 'lower',
      roundCode: 'LB_R1',
      roundName: 'LB Round 1 (Match 1)',
      matchNumber: 8,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Loser UB R1 M1
      idolBId: s9, // Seed 9 waits here
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_r2_m1',
      feedsWinnerToSlot: 'A',
    },
    {
      id: 'ti_po_lb_r1_m2',
      bracket: 'lower',
      roundCode: 'LB_R1',
      roundName: 'LB Round 1 (Match 2)',
      matchNumber: 9,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Loser UB R1 M2
      idolBId: s10, // Seed 10 waits here
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_r2_m2',
      feedsWinnerToSlot: 'A',
    },

    // --- LOWER BRACKET ROUND 2 (Best of 5) ---
    {
      id: 'ti_po_lb_r2_m1',
      bracket: 'lower',
      roundCode: 'LB_R2',
      roundName: 'LB Round 2 (Match 1)',
      matchNumber: 10,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner LB R1 M1
      idolBId: null, // Loser UB R2 M1
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_r3_m1',
      feedsWinnerToSlot: 'A',
    },
    {
      id: 'ti_po_lb_r2_m2',
      bracket: 'lower',
      roundCode: 'LB_R2',
      roundName: 'LB Round 2 (Match 2)',
      matchNumber: 11,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner LB R1 M2
      idolBId: null, // Loser UB R2 M2
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_r3_m2',
      feedsWinnerToSlot: 'A',
    },

    // --- LOWER BRACKET ROUND 3 (LB Quarterfinals, Best of 5) ---
    {
      id: 'ti_po_lb_r3_m1',
      bracket: 'lower',
      roundCode: 'LB_R3',
      roundName: 'LB Quarterfinals (Match 1)',
      matchNumber: 12,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner LB R2 M1
      idolBId: null, // Loser UB R3 M1
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_semi',
      feedsWinnerToSlot: 'A',
    },
    {
      id: 'ti_po_lb_r3_m2',
      bracket: 'lower',
      roundCode: 'LB_R3',
      roundName: 'LB Quarterfinals (Match 2)',
      matchNumber: 13,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner LB R2 M2
      idolBId: null, // Loser UB R3 M2
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_semi',
      feedsWinnerToSlot: 'B',
    },

    // --- LOWER BRACKET SEMIFINAL (Best of 5) ---
    {
      id: 'ti_po_lb_semi',
      bracket: 'lower',
      roundCode: 'LB_SEMI',
      roundName: 'Lower Bracket Semifinal',
      matchNumber: 14,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner LB R3 M1
      idolBId: null, // Winner LB R3 M2
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_lb_final',
      feedsWinnerToSlot: 'A',
    },

    // --- LOWER BRACKET FINAL (Best of 5) ---
    {
      id: 'ti_po_lb_final',
      bracket: 'lower',
      roundCode: 'LB_FINAL',
      roundName: 'Lower Bracket Final',
      matchNumber: 15,
      bestOf: 5,
      targetWins: 3,
      idolAId: null, // Winner LB Semifinal
      idolBId: null, // Loser UB Final
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
      feedsWinnerToMatchId: 'ti_po_gf',
      feedsWinnerToSlot: 'B', // Lower Bracket Champion
    },

    // --- GRAND FINAL (Best of 7) ---
    {
      id: 'ti_po_gf',
      bracket: 'grand_final',
      roundCode: 'GF',
      roundName: 'Grand Final',
      matchNumber: 16,
      bestOf: 7,
      targetWins: 4,
      idolAId: null, // Upper Bracket Champion
      idolBId: null, // Lower Bracket Champion
      scoreA: 0,
      scoreB: 0,
      games: [],
      winnerId: null,
      loserId: null,
      completed: false,
    },
  ];

  return matches;
}

/**
 * Propagate winners and losers through The Idols Playoff Bracket
 */
export function recalculateTheIdolsPlayoff(
  playoffMatches: TheIdolsPlayoffMatch[],
  standings: TheIdolsStanding[]
): TheIdolsPlayoffMatch[] {
  const seedMap = new Map<number, string>();
  standings.forEach((st) => {
    if (st.playoffSeed) {
      seedMap.set(st.playoffSeed, st.idolId);
    }
  });

  const updated = playoffMatches.map((m) => ({ ...m }));
  const matchMap = new Map<string, TheIdolsPlayoffMatch>();
  updated.forEach((m) => matchMap.set(m.id, m));

  // Reset base seeded slots if not locked by previous winners
  const ub1 = matchMap.get('ti_po_ub_r1_m1');
  if (ub1) {
    ub1.idolAId = seedMap.get(5) || null;
    ub1.idolBId = seedMap.get(8) || null;
  }
  const ub2 = matchMap.get('ti_po_ub_r1_m2');
  if (ub2) {
    ub2.idolAId = seedMap.get(6) || null;
    ub2.idolBId = seedMap.get(7) || null;
  }
  const ub3 = matchMap.get('ti_po_ub_r2_m1');
  if (ub3) {
    ub3.idolAId = seedMap.get(3) || null;
  }
  const ub4 = matchMap.get('ti_po_ub_r2_m2');
  if (ub4) {
    ub4.idolAId = seedMap.get(4) || null;
  }
  const ub5 = matchMap.get('ti_po_ub_r3_m1');
  if (ub5) {
    ub5.idolAId = seedMap.get(1) || null;
  }
  const ub6 = matchMap.get('ti_po_ub_r3_m2');
  if (ub6) {
    ub6.idolAId = seedMap.get(2) || null;
  }
  const lb1 = matchMap.get('ti_po_lb_r1_m1');
  if (lb1) {
    lb1.idolBId = seedMap.get(9) || null;
  }
  const lb2 = matchMap.get('ti_po_lb_r1_m2');
  if (lb2) {
    lb2.idolBId = seedMap.get(10) || null;
  }

  // Iterate to propagate feeds forward
  for (let pass = 0; pass < 6; pass++) {
    updated.forEach((m) => {
      // If match is completed, determine winner and loser
      if (m.completed && m.winnerId) {
        m.loserId = m.winnerId === m.idolAId ? m.idolBId : m.idolAId;

        // Feed winner
        if (m.feedsWinnerToMatchId && m.feedsWinnerToSlot) {
          let target = matchMap.get(m.feedsWinnerToMatchId);
          // Handle legacy/updated ID compatibility
          if (!target && m.feedsWinnerToMatchId === 'ti_po_gf_set1') {
            target = matchMap.get('ti_po_gf');
          }
          if (target) {
            if (m.feedsWinnerToSlot === 'A') target.idolAId = m.winnerId;
            else if (m.feedsWinnerToSlot === 'B') target.idolBId = m.winnerId;
          }
        }

        // Feed loser
        if (m.feedsLoserToMatchId && m.feedsLoserToSlot) {
          const target = matchMap.get(m.feedsLoserToMatchId);
          if (target) {
            if (m.feedsLoserToSlot === 'A') target.idolAId = m.loserId;
            else if (m.feedsLoserToSlot === 'B') target.idolBId = m.loserId;
          }
        }
      }
    });
  }

  // Ensure Grand Final feeds from UB Final and LB Final
  const gf = matchMap.get('ti_po_gf') || matchMap.get('ti_po_gf_set1');
  const ubFinal = matchMap.get('ti_po_ub_final');
  const lbFinal = matchMap.get('ti_po_lb_final');

  if (gf) {
    if (ubFinal && ubFinal.completed && ubFinal.winnerId) {
      gf.idolAId = ubFinal.winnerId;
    }
    if (lbFinal && lbFinal.completed && lbFinal.winnerId) {
      gf.idolBId = lbFinal.winnerId;
    }
    if (gf.completed && gf.winnerId) {
      gf.loserId = gf.winnerId === gf.idolAId ? gf.idolBId : gf.idolAId;
    }
  }

  return updated;

  return updated;
}

/**
 * Simulate a single league match in The Idols
 */
export function simulateTheIdolsMatch(
  idolA: Idol,
  idolB: Idol,
  formA: Array<'W' | 'D' | 'L'> = [],
  formB: Array<'W' | 'D' | 'L'> = []
): { scoreA: number; scoreB: number; winnerId: string | null } {
  const ratingA = getIdolRating(idolA) + getFormModifier(formA);
  const ratingB = getIdolRating(idolB) + getFormModifier(formB);

  // v4: Best of 4, draws allowed (2-2)
  const { scoreA, scoreB } = simulateBo4Score(ratingA, ratingB);
  const winnerId = scoreA === scoreB ? null : scoreA > scoreB ? idolA.id : idolB.id;
  return { scoreA, scoreB, winnerId };
}

/**
 * Simulate an entire Playoff Series (Best of 5 or Best of 7)
 */
export function simulateTheIdolsPlayoffSeries(
  idolA: Idol,
  idolB: Idol,
  bestOf: 5 | 7,
  formA: Array<'W' | 'D' | 'L'> = [],
  formB: Array<'W' | 'D' | 'L'> = []
): {
  scoreA: number;
  scoreB: number;
  winnerId: string;
  loserId: string;
  games: TheIdolsPlayoffGameScore[];
} {
  const targetWins = bestOf === 7 ? 4 : 3;
  let winsA = 0;
  let winsB = 0;
  const games: TheIdolsPlayoffGameScore[] = [];

  const baseRatingA = getIdolRating(idolA) + getFormModifier(formA);
  const baseRatingB = getIdolRating(idolB) + getFormModifier(formB);

  let gameNum = 1;
  while (winsA < targetWins && winsB < targetWins) {
    // Slight momentum swing based on previous game winner
    const momentumA = gameNum > 1 && games[games.length - 1]?.winnerId === idolA.id ? 1.5 : 0;
    const momentumB = gameNum > 1 && games[games.length - 1]?.winnerId === idolB.id ? 1.5 : 0;

    const probA = calculateRatingWinProbability(baseRatingA + momentumA, baseRatingB + momentumB);
    const isWinA = Math.random() < probA;

    let gScoreA = 0;
    let gScoreB = 0;
    if (isWinA) {
      winsA++;
      gScoreB = Math.floor(Math.random() * 2);
      gScoreA = gScoreB + (Math.random() < 0.65 ? 1 : 2);
      games.push({
        gameNumber: gameNum,
        scoreA: gScoreA,
        scoreB: gScoreB,
        winnerId: idolA.id,
      });
    } else {
      winsB++;
      gScoreA = Math.floor(Math.random() * 2);
      gScoreB = gScoreA + (Math.random() < 0.65 ? 1 : 2);
      games.push({
        gameNumber: gameNum,
        scoreA: gScoreA,
        scoreB: gScoreB,
        winnerId: idolB.id,
      });
    }
    gameNum++;
  }

  const winnerId = winsA > winsB ? idolA.id : idolB.id;
  const loserId = winnerId === idolA.id ? idolB.id : idolA.id;

  return {
    scoreA: winsA,
    scoreB: winsB,
    winnerId,
    loserId,
    games,
  };
}

/**
 * Initialize a brand new season of The Idols with Top 20 Active Idols automatically selected by rating
 */
export function initializeTheIdolsSeason(
  idolsOrSeason: Idol[] | number,
  seasonOrIdols: number | Idol[] = 1,
  girlGroups: GirlGroup[] = []
): TheIdolsSeasonState {
  const idols: Idol[] = Array.isArray(idolsOrSeason)
    ? idolsOrSeason
    : Array.isArray(seasonOrIdols)
    ? seasonOrIdols
    : [];
  const seasonNumber: number = typeof idolsOrSeason === 'number'
    ? idolsOrSeason
    : typeof seasonOrIdols === 'number'
    ? seasonOrIdols
    : 1;

  const top20 = getTop20IdolsByRating(idols, girlGroups);
  const memberIds = top20.map((i) => i.id);

  const matches = generateTheIdolsRoundRobinMatches(memberIds);
  const standings = calculateTheIdolsStandings(memberIds, matches, idols);
  const playoffMatches = initializeTheIdolsPlayoffMatches(standings);

  return {
    seasonNumber,
    seasonName: `The Idols Season ${seasonNumber}`,
    isStarted: true,
    isLeagueCompleted: false,
    isPlayoffCompleted: false,
    currentMatchday: 1,
    memberIds,
    matches,
    standings,
    playoffMatches,
  };
}

/**
 * Determine Champion, Runner-Up, 3rd, 4th, MVP, and Top Scorer for The Idols
 */
export function computeTheIdolsHonors(
  state: TheIdolsSeasonState,
  idols: Idol[]
): {
  championId?: string;
  championName?: string;
  runnerUpId?: string;
  runnerUpName?: string;
  thirdPlaceId?: string;
  thirdPlaceName?: string;
  fourthPlaceId?: string;
  fourthPlaceName?: string;
  mvpId?: string;
  mvpName?: string;
  topScorerId?: string;
  topScorerName?: string;
  topScorerGoals?: number;
} {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  let championId: string | undefined;
  let runnerUpId: string | undefined;
  let thirdPlaceId: string | undefined;
  let fourthPlaceId: string | undefined;

  const playoffMatches = Array.isArray(state.playoffMatches) ? state.playoffMatches : [];
  const gf = playoffMatches.find((m) => m.id === 'ti_po_gf' || m.id === 'ti_po_gf_set1' || m.bracket === 'grand_final');
  const gfSet2 = playoffMatches.find((m) => m.id === 'ti_po_gf_set2');
  const lbFinal = playoffMatches.find((m) => m.id === 'ti_po_lb_final');
  const lbSemi = playoffMatches.find((m) => m.id === 'ti_po_lb_semi');

  // Champion & Runner Up from Grand Final
  if (gfSet2 && gfSet2.isResetActive && gfSet2.completed && gfSet2.winnerId) {
    championId = gfSet2.winnerId;
    runnerUpId = gfSet2.loserId || undefined;
  } else if (gf && gf.completed && gf.winnerId) {
    championId = gf.winnerId;
    runnerUpId = gf.loserId || (gf.winnerId === gf.idolAId ? gf.idolBId : gf.idolAId) || undefined;
  }

  // 3rd Place from Loser of LB Final
  if (lbFinal && lbFinal.completed && lbFinal.loserId) {
    thirdPlaceId = lbFinal.loserId;
  }

  // 4th Place from Loser of LB Semifinal
  if (lbSemi && lbSemi.completed && lbSemi.loserId) {
    fourthPlaceId = lbSemi.loserId;
  }

  // Top Scorer across all single round-robin matches
  const goalsMap = new Map<string, number>();
  (state.matches || []).forEach((m) => {
    if (m.completed && m.scoreA !== null && m.scoreB !== null) {
      goalsMap.set(m.idolAId, (goalsMap.get(m.idolAId) || 0) + m.scoreA);
      goalsMap.set(m.idolBId, (goalsMap.get(m.idolBId) || 0) + m.scoreB);
    }
  });

  let topScorerId: string | undefined;
  let topScorerGoals = 0;
  goalsMap.forEach((goals, id) => {
    if (goals > topScorerGoals) {
      topScorerGoals = goals;
      topScorerId = id;
    }
  });

  // MVP (Champion idol by default, or top standing performer)
  const mvpId = championId || state.standings[0]?.idolId;

  return {
    championId,
    championName: championId ? idolsMap.get(championId)?.name || 'Champion' : undefined,
    runnerUpId,
    runnerUpName: runnerUpId ? idolsMap.get(runnerUpId)?.name || 'Runner-Up' : undefined,
    thirdPlaceId,
    thirdPlaceName: thirdPlaceId ? idolsMap.get(thirdPlaceId)?.name || '3rd Place' : undefined,
    fourthPlaceId,
    fourthPlaceName: fourthPlaceId ? idolsMap.get(fourthPlaceId)?.name || '4th Place' : undefined,
    mvpId,
    mvpName: mvpId ? idolsMap.get(mvpId)?.name || 'MVP' : undefined,
    topScorerId,
    topScorerName: topScorerId ? idolsMap.get(topScorerId)?.name : undefined,
    topScorerGoals,
  };
}

/**
 * Archive completed season of The Idols
 */
export function archiveTheIdolsSeason(
  state: TheIdolsSeasonState,
  idols: Idol[]
): TheIdolsSeasonArchive {
  const honors = computeTheIdolsHonors(state, idols);
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  const champ = honors.championId ? idolsMap.get(honors.championId) : undefined;

  const totalGoals = (state.matches || []).reduce((sum, m) => sum + (m.scoreA || 0) + (m.scoreB || 0), 0);

  return {
    seasonNumber: state.seasonNumber,
    seasonName: state.seasonName,
    completedAt: new Date().toISOString(),
    championId: honors.championId || '',
    championName: honors.championName || 'Unknown',
    championGroup: champ?.girlGroup || '',
    championPhoto: champ?.photoUrl || '',
    championNationality: champ?.nationality || '',
    runnerUpId: honors.runnerUpId || '',
    runnerUpName: honors.runnerUpName || 'Unknown',
    thirdPlaceId: honors.thirdPlaceId,
    thirdPlaceName: honors.thirdPlaceName,
    mvpId: honors.mvpId,
    mvpName: honors.mvpName,
    topScorerId: honors.topScorerId,
    topScorerName: honors.topScorerName,
    topScorerGoals: honors.topScorerGoals,
    memberIds: state.memberIds || [],
    standings: state.standings || [],
    matches: state.matches || [],
    playoffMatches: state.playoffMatches || [],
    totalMatches: (state.matches || []).length + (state.playoffMatches || []).length,
    totalGoals,
  };
}

/**
 * Advance The Idols to next season with updated Top 20 roster based on fresh post-season ratings
 */
export function advanceTheIdolsSeason(
  currentState: TheIdolsSeasonState,
  idols: Idol[],
  nextSeasonNumber: number,
  girlGroups: GirlGroup[] = []
): TheIdolsSeasonState {
  const initialized = initializeTheIdolsSeason(idols, nextSeasonNumber, girlGroups);
  return {
    ...initialized,
    seasonName: incrementSeasonName(currentState.seasonName, nextSeasonNumber, 'The Idols Season'),
  };
}

/**
 * Rebuild Top 20 active roster completely for The Idols season state using current ratings
 */
export function rebuildTheIdolsRoster(
  currentState: TheIdolsSeasonState,
  idols: Idol[],
  girlGroups: GirlGroup[] = []
): TheIdolsSeasonState {
  const top20 = getTop20IdolsByRating(idols, girlGroups);
  const memberIds = top20.map((i) => i.id);

  const matches = generateTheIdolsRoundRobinMatches(memberIds);
  const standings = calculateTheIdolsStandings(memberIds, matches, idols);
  const playoffMatches = initializeTheIdolsPlayoffMatches(standings);

  return {
    ...currentState,
    memberIds,
    matches,
    standings,
    playoffMatches,
    isLeagueCompleted: false,
    isPlayoffCompleted: false,
    currentMatchday: 1,
  };
}

/**
 * Synchronize The Idols season state with the latest Rating Manager ratings, photos, names, and active statuses.
 * - Automatically updates standings ratings and photos to match Rating Manager.
 * - If 0 matches have been completed, or if any current member is now inactive or missing,
 *   it updates the Top 20 roster with the highest-rated active idols, strictly excluding inactive idols.
 */
export function syncTheIdolsStateWithLatestIdols(
  currentState: TheIdolsSeasonState,
  idols: Idol[],
  girlGroups: GirlGroup[] = [],
  forceRosterRebuild: boolean = false
): TheIdolsSeasonState {
  if (!currentState) {
    return initializeTheIdolsSeason(idols, 1, girlGroups);
  }

  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => {
    idolsMap.set(i.id, i);
    if (i.name) idolsMap.set(i.name.trim().toLowerCase(), i);
  });

  const totalMatchesCompleted = (currentState.matches || []).filter((m) => m.completed).length;
  const isUnstarted = totalMatchesCompleted === 0;

  // Check if any current member is inactive or missing
  const hasInactiveOrMissingMember = (currentState.memberIds || []).some((id) => {
    const idol = idolsMap.get(id) || idolsMap.get(id.trim().toLowerCase());
    return !idol || !isIdolActive(idol, girlGroups);
  });

  // Rebuild roster only if explicitly requested by user, or if memberIds is empty/uninitialized.
  // This guarantees the roster stays intact across page refreshes and only changes on manual sync.
  const hasNoMembers = !currentState.memberIds || currentState.memberIds.length === 0;
  if (forceRosterRebuild || hasNoMembers) {
    return rebuildTheIdolsRoster(currentState, idols, girlGroups);
  }

  // Ensure matches array is upgraded to 38 matchdays (380 matches)
  const matches = ensureTheIdolsHas38Matchdays(
    currentState.matches || [],
    currentState.memberIds || []
  );

  // If season matches are in progress, update standings with current idol metadata & live ratings
  const standings = calculateTheIdolsStandings(
    currentState.memberIds || [],
    matches,
    idols
  );

  const playoffMatches = recalculateTheIdolsPlayoff(
    currentState.playoffMatches || [],
    standings
  );

  return {
    ...currentState,
    matches,
    standings,
    playoffMatches,
  };
}

/**
 * Convert all The Idols matches (league + playoff games) into ArchivedMatch objects for the Match Database
 */
export function convertTheIdolsMatchesToArchived(
  state: TheIdolsSeasonState | null | undefined,
  idols: Idol[],
  archives: TheIdolsSeasonArchive[] = []
): ArchivedMatch[] {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  const list: ArchivedMatch[] = [];

  const processSeason = (sNum: number, sName: string, matches: TheIdolsMatch[], playoffMatches: TheIdolsPlayoffMatch[]) => {
    // Single round-robin matches
    (matches || []).forEach((m) => {
      if (!m || !m.completed || m.scoreA === null || m.scoreB === null || !m.idolAId || !m.idolBId) return;
      const idolA = idolsMap.get(m.idolAId);
      const idolB = idolsMap.get(m.idolBId);
      if (!idolA || !idolB) return;

      const isDraw = m.scoreA === m.scoreB;
      const winnerId = isDraw ? '' : m.scoreA > m.scoreB ? idolA.id : idolB.id;
      const winnerName = isDraw ? 'Draw' : m.scoreA > m.scoreB ? idolA.name : idolB.name;
      const loserId = isDraw ? '' : m.scoreA > m.scoreB ? idolB.id : idolA.id;
      const loserName = isDraw ? 'Draw' : m.scoreA > m.scoreB ? idolB.name : idolA.name;

      list.push({
        matchId: `the_idols_s${sNum}_${m.id || Math.random().toString(36).substring(2, 7)}`,
        seasonId: sNum,
        seasonName: sName,
        stage: `The Idols - Matchday ${m.matchday || 1}`,
        groupName: 'The Idols Superleague',
        idolAId: idolA.id,
        idolAName: idolA.name,
        idolAGroup: idolA.girlGroup,
        idolAPhoto: idolA.photoUrl,
        idolBId: idolB.id,
        idolBName: idolB.name,
        idolBGroup: idolB.girlGroup,
        idolBPhoto: idolB.photoUrl,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winnerId,
        winnerName,
        loserId,
        loserName,
        isDraw,
        date: m.updatedAt || new Date().toISOString(),
      });
    });

    // Playoff series matches
    (playoffMatches || []).forEach((m) => {
      if (!m || !m.completed || !m.winnerId || !m.idolAId || !m.idolBId) return;
      const idolA = idolsMap.get(m.idolAId);
      const idolB = idolsMap.get(m.idolBId);
      if (!idolA || !idolB) return;

      const winnerName = m.winnerId === idolA.id ? idolA.name : idolB.name;
      const loserId = m.winnerId === idolA.id ? idolB.id : idolA.id;
      const loserName = m.winnerId === idolA.id ? idolB.name : idolA.name;

      list.push({
        matchId: `the_idols_s${sNum}_po_${m.id || Math.random().toString(36).substring(2, 7)}`,
        seasonId: sNum,
        seasonName: sName,
        stage: `The Idols - ${m.roundName || 'Playoff'}`,
        groupName: 'The Idols Masters Playoff',
        idolAId: idolA.id,
        idolAName: idolA.name,
        idolAGroup: idolA.girlGroup,
        idolAPhoto: idolA.photoUrl,
        idolBId: idolB.id,
        idolBName: idolB.name,
        idolBGroup: idolB.girlGroup,
        idolBPhoto: idolB.photoUrl,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winnerId: m.winnerId,
        winnerName,
        loserId,
        loserName,
        isDraw: false,
        date: m.updatedAt || new Date().toISOString(),
      });
    });
  };

  // 1. Process current season
  if (state) {
    processSeason(state.seasonNumber, state.seasonName, state.matches || [], state.playoffMatches || []);
  }

  // 2. Process all past archives
  (archives || []).forEach((arch) => {
    if (!arch) return;
    processSeason(arch.seasonNumber, arch.seasonName, arch.matches || [], arch.playoffMatches || []);
  });

  return list;
}

/**
 * Storage helpers for The Idols
 */
export function loadTheIdolsState(): TheIdolsSeasonState | null {
  try {
    const raw = localStorage.getItem(THE_IDOLS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTheIdolsState(state: TheIdolsSeasonState): void {
  try {
    localStorage.setItem(THE_IDOLS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save The Idols state:', e);
  }
}

export function loadTheIdolsArchives(): TheIdolsSeasonArchive[] {
  try {
    const raw = localStorage.getItem(THE_IDOLS_ARCHIVES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTheIdolsArchives(archives: TheIdolsSeasonArchive[]): void {
  try {
    localStorage.setItem(THE_IDOLS_ARCHIVES_KEY, JSON.stringify(archives));
  } catch {
    try {
      const total = (archives || []).length;
      const compactArchives = (archives || []).map((a, idx) => {
        const isRecent = idx >= total - 2;
        return {
          seasonNumber: a.seasonNumber,
          seasonName: a.seasonName || `The Idols Season ${a.seasonNumber}`,
          completedAt: a.completedAt,
          memberIds: a.memberIds || [],
          standings: a.standings || [],
          matches: isRecent ? (a.matches || []).slice(0, 30) : [],
          playoffMatches: a.playoffMatches || [],
          championId: a.championId,
          championName: a.championName,
          runnerUpId: a.runnerUpId,
          runnerUpName: a.runnerUpName,
          thirdPlaceId: a.thirdPlaceId,
          thirdPlaceName: a.thirdPlaceName,
          mvpId: a.mvpId,
          mvpName: a.mvpName,
          topScorerId: a.topScorerId,
          topScorerName: a.topScorerName,
          topScorerGoals: a.topScorerGoals,
          totalMatches: a.totalMatches || 0,
          totalGoals: a.totalGoals || 0,
        };
      });
      localStorage.setItem(THE_IDOLS_ARCHIVES_KEY, JSON.stringify(compactArchives));
    } catch (e) {
      console.warn('Failed to save The Idols archives compact fallback:', e);
    }
  }
}

/**
 * Resets all The Idols matches and playoff matches back to 0-0 unplayed state,
 * keeping the current Top 20 active roster intact and resetting standings.
 */
export function resetTheIdolsSeasonMatchesOnly(
  currentState: TheIdolsSeasonState,
  idols: Idol[]
): TheIdolsSeasonState {
  const memberIds = [...(currentState.memberIds || [])];
  const freshMatches = generateTheIdolsRoundRobinMatches(memberIds);
  const freshStandings = calculateTheIdolsStandings(memberIds, freshMatches, idols);
  const freshPlayoffs = initializeTheIdolsPlayoffMatches(freshStandings);

  return {
    ...currentState,
    isStarted: true,
    isLeagueCompleted: false,
    isPlayoffCompleted: false,
    currentMatchday: 1,
    matches: freshMatches,
    standings: freshStandings,
    playoffMatches: freshPlayoffs,
    championId: undefined,
    championName: undefined,
    runnerUpId: undefined,
    runnerUpName: undefined,
    thirdPlaceId: undefined,
    thirdPlaceName: undefined,
    mvpId: undefined,
    mvpName: undefined,
    topScorerId: undefined,
    topScorerName: undefined,
    topScorerGoals: undefined,
  };
}
