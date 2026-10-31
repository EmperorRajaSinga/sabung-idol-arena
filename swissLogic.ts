import {
  Idol,
  LeagueInfo,
  LeagueStanding,
  LeagueQualifierEntry,
  SwissParticipant,
  SwissMatch,
  SwissPoolState,
  SwissPlayInState,
  SwissPoolId,
} from '../types';
import {
  getIdolRating,
  simulateSeriesMatches,
  simulateLeagueMatchScore,
} from './ratingHelper';
import { getEffectiveIdolRating } from './formHelper';

/** Swiss series length 1/3/5 means Best of 1/3/5. Returns the wins needed (v4: Swiss is Best of 3, first to 2). */
const swissTargetWins = (len?: number): number => (len === 1 ? 1 : len === 5 ? 3 : 2);

export const SWISS_POOL_IDS: SwissPoolId[] = [
  'pool_a',
  'pool_b',
  'pool_c',
  'pool_d',
];

export const SWISS_POOL_NAMES: Record<SwissPoolId, string> = {
  pool_a: 'Swiss Pool A',
  pool_b: 'Swiss Pool B',
  pool_c: 'Swiss Pool C',
  pool_d: 'Swiss Pool D',
};

/**
 * Fisher-Yates shuffle helper
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Official league ranking order (same comparator as calculateLeagueStandings). Never trust stored array order. */
const rankStandings = (standings: LeagueStanding[] | undefined): LeagueStanding[] =>
  [...(standings || [])].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    if ((b.gameDiff || 0) !== (a.gameDiff || 0)) return (b.gameDiff || 0) - (a.gameDiff || 0);
    if ((b.gamesFor || 0) !== (a.gamesFor || 0)) return (b.gamesFor || 0) - (a.gamesFor || 0);
    if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
    return String(a.idolName || '').localeCompare(String(b.idolName || ''));
  });


/**
 * Extracts 64 contenders across the 6 parallel leagues:
 * - 6 leagues x 10 idols (ranks 7 through 16) = 60 idols
 * - 4 extra wildcards: top 4 ranking 17th idols across all 6 leagues sorted by points, goalDiff, rating
 * Total = 64 Contenders (4 Pots of 16 Idols) -> Distributed into 4 Swiss Pools of 16 idols each.
 */
export function generateSwissPlayIn(
  leagues: LeagueInfo[],
  idols: Idol[],
  existingPlayIn?: SwissPlayInState,
  randomizeRound1: boolean = false
): SwissPlayInState {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => i && idolsMap.set(i.id, i));

  // Extract contenders: ranks 7 to 16 in each of the 6 leagues (indexes 6 to 15)
  const contenders: Array<{
    st: LeagueStanding;
    leagueId: number;
    leagueName: string;
    leagueRank: number;
    points: number;
    gameDiff: number;
    gamesFor: number;
  }> = [];

  const rank17Candidates: Array<{
    st: LeagueStanding;
    leagueId: number;
    leagueName: string;
    leagueRank: number;
    points: number;
    gameDiff: number;
    gamesFor: number;
    rating: number;
  }> = [];

  (leagues || []).forEach((l) => {
    const standings = rankStandings(l.standings);
    for (let r = 7; r <= 16; r++) {
      const st = standings[r - 1];
      if (st) {
        contenders.push({
          st,
          leagueId: l.id,
          leagueName: l.name,
          leagueRank: r,
          points: st.points || 0,
          gameDiff: st.gameDiff || 0,
          gamesFor: st.gamesFor || 0,
        });
      }
    }

    // 17th rank candidate
    const st17 = standings[16];
    if (st17) {
      const idol = idolsMap.get(st17.idolId);
      rank17Candidates.push({
        st: st17,
        leagueId: l.id,
        leagueName: l.name,
        leagueRank: 17,
        points: st17.points || 0,
        gameDiff: st17.gameDiff || 0,
        gamesFor: st17.gamesFor || 0,
        rating: idol ? getIdolRating(idol) : 75,
      });
    }
  });

  // Sort rank 17 candidates and pick top 4 to complete 64 contenders
  rank17Candidates.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return b.gamesFor - a.gamesFor;
  });

  const selected17 = rank17Candidates.slice(0, 4);
  selected17.forEach((c) => contenders.push(c));

  // If still under 64 (e.g. mock test data), pad with any remaining idols
  if (contenders.length < 64) {
    const usedIds = new Set(contenders.map((c) => c.st.idolId));
    (leagues || []).forEach((l) => {
      rankStandings(l.standings).forEach((st, idx) => {
        // v4: ranks 1-6 are direct Unzure Cup qualifiers and must never enter the Swiss stage.
        if (idx < 6) return;
        if (contenders.length < 64 && !usedIds.has(st.idolId)) {
          usedIds.add(st.idolId);
          contenders.push({
            st,
            leagueId: l.id,
            leagueName: l.name,
            leagueRank: idx + 1,
            points: st.points || 0,
            gameDiff: st.gameDiff || 0,
            gamesFor: st.gamesFor || 0,
          });
        }
      });
    });
  }

  // Sort all 64 contenders globally by leagueRank > points > gameDiff > rating
  contenders.sort((a, b) => {
    if (a.leagueRank !== b.leagueRank) return a.leagueRank - b.leagueRank;
    if (b.points !== a.points) return b.points - a.points;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    const idolA = idolsMap.get(a.st.idolId);
    const idolB = idolsMap.get(b.st.idolId);
    const ratA = idolA ? getIdolRating(idolA) : 75;
    const ratB = idolB ? getIdolRating(idolB) : 75;
    return ratB - ratA;
  });

  // Group into 4 Pots of 16 Idols each:
  // Pot 1: Contenders 1-16 (Highest Seeds)
  // Pot 2: Contenders 17-32
  // Pot 3: Contenders 33-48
  // Pot 4: Contenders 49-64
  const potGroups: Record<number, typeof contenders> = { 1: [], 2: [], 3: [], 4: [] };
  contenders.slice(0, 64).forEach((c, idx) => {
    const potNum = Math.floor(idx / 16) + 1;
    potGroups[potNum].push(c);
  });

  // Distribute into 4 Pools (Pool A through Pool D)
  // Each pool gets 4 from Pot 1, 4 from Pot 2, 4 from Pot 3, 4 from Pot 4 = 16 idols
  const poolParticipants: Record<SwissPoolId, SwissParticipant[]> = {
    pool_a: [],
    pool_b: [],
    pool_c: [],
    pool_d: [],
  };

  // If existingPlayIn already has all 64 participants populated, preserve each idol's pool!
  // A stored Swiss list is stale when it contains a direct qualifier (league rank 1-6) and no Swiss match was played yet.
  const directIds = new Set<string>();
  (leagues || []).forEach((l) => rankStandings(l.standings).slice(0, 6).forEach((st) => directIds.add(st.idolId)));
  const swissStarted = !!existingPlayIn && [
    ...(existingPlayIn.matches || []),
    ...(existingPlayIn.lastChanceMatches || []),
  ].some((m: any) => m && m.completed);
  const existingIsStale =
    !!existingPlayIn &&
    !swissStarted &&
    (existingPlayIn.participants || []).some((p) => directIds.has(p.idolId));

  if (
    existingPlayIn &&
    !existingIsStale &&
    Array.isArray(existingPlayIn.participants) &&
    existingPlayIn.participants.length === 64
  ) {
    existingPlayIn.participants.forEach((p) => {
      if (poolParticipants[p.poolId]) {
        poolParticipants[p.poolId].push({
          ...p,
          swissWins: randomizeRound1 ? 0 : p.swissWins,
          swissLosses: randomizeRound1 ? 0 : p.swissLosses,
          swissGameDiff: randomizeRound1 ? 0 : p.swissGameDiff,
          swissGamesFor: randomizeRound1 ? 0 : p.swissGamesFor,
          swissGamesAgainst: randomizeRound1 ? 0 : p.swissGamesAgainst,
          buchholzScore: randomizeRound1 ? 0 : p.buchholzScore,
          status: randomizeRound1 ? 'contention' : p.status,
        });
      }
    });
  } else {
    for (let pot = 1; pot <= 4; pot++) {
      const rawPotList = potGroups[pot];
      const potList = rawPotList;
      // 4 rounds of distribution per pot (snake-draft style for balance)
      for (let round = 0; round < 4; round++) {
        const startIndex = round * 4;
        const roundSlice = potList.slice(startIndex, startIndex + 4);
        const poolOrder = round % 2 === 0 ? SWISS_POOL_IDS : [...SWISS_POOL_IDS].reverse();

        roundSlice.forEach((c, i) => {
          const pId = poolOrder[i];
          if (pId) {
            const idol = idolsMap.get(c.st.idolId);
            poolParticipants[pId].push({
              idolId: c.st.idolId,
              idolName: c.st.idolName,
              girlGroup: c.st.girlGroup,
              nationality: c.st.nationality || idol?.nationality || 'South Korea',
              photoUrl: c.st.photoUrl || idol?.photoUrl,
              seed: c.st.seed || idol?.seed || 'Unseeded',
              leagueId: c.leagueId,
              leagueName: c.leagueName,
              leagueRank: c.leagueRank,
              points: c.points,
              gameDiff: c.gameDiff,
              gamesFor: c.gamesFor,
              poolId: pId,
              potNumber: pot,
              poolSeed: 0,
              swissWins: 0,
              swissLosses: 0,
              swissGameDiff: 0,
              swissGamesFor: 0,
              swissGamesAgainst: 0,
              buchholzScore: 0,
              status: 'contention',
            });
          }
        });
      }
    }
  }

  // Assign seeds (1 to 16) in each pool
  SWISS_POOL_IDS.forEach((pId) => {
    const list = poolParticipants[pId];
    list.sort((a, b) => {
      if (a.potNumber !== b.potNumber) return a.potNumber - b.potNumber;
      if (a.leagueRank !== b.leagueRank) return a.leagueRank - b.leagueRank;
      if (b.points !== a.points) return b.points - a.points;
      return b.gameDiff - a.gameDiff;
    });
    list.forEach((p, idx) => {
      p.poolSeed = idx + 1;
    });
  });

  const existingMatchMap = new Map<string, SwissMatch>();
  if (!randomizeRound1 && existingPlayIn && Array.isArray(existingPlayIn.matches)) {
    existingPlayIn.matches.forEach((m) => existingMatchMap.set(m.id, m));
  }
  if (!randomizeRound1 && existingPlayIn && Array.isArray(existingPlayIn.lastChanceMatches)) {
    existingPlayIn.lastChanceMatches.forEach((m) => existingMatchMap.set(m.id, m));
  }

  const allMatches: SwissMatch[] = [];

  // Generate Round 1 matches for each pool (8 matches per pool, all 16 idols play)
  // Seed 1 vs 16, 2 vs 15, 3 vs 14, 4 vs 13, 5 vs 12, 6 vs 11, 7 vs 10, 8 vs 9, OR preserved/randomized draw
  SWISS_POOL_IDS.forEach((pId) => {
    const pList = poolParticipants[pId];
    const poolName = SWISS_POOL_NAMES[pId];
    const pairs: [string, string][] = [];

    // Check for existing Round 1 matches for this pool to preserve manual or randomized draws
    const existingR1ForPool = (existingPlayIn?.matches || []).filter(
      (m) => m.poolId === pId && m.roundNumber === 1 && m.idolAId && m.idolBId
    );

    if (!randomizeRound1 && existingR1ForPool.length === 8) {
      // Preserve the established pairings from existing state
      existingR1ForPool.forEach((m) => {
        pairs.push([m.idolAId, m.idolBId]);
      });
    } else if (randomizeRound1) {
      const shuffledIds = shuffleArray(pList.map((p) => p.idolId));
      for (let i = 0; i < shuffledIds.length; i += 2) {
        if (shuffledIds[i] && shuffledIds[i + 1]) {
          pairs.push([shuffledIds[i], shuffledIds[i + 1]]);
        }
      }
    } else {
      const seedPairs: [number, number][] = [
        [1, 16],
        [2, 15],
        [3, 14],
        [4, 13],
        [5, 12],
        [6, 11],
        [7, 10],
        [8, 9],
      ];
      seedPairs.forEach(([sA, sB]) => {
        const idA = pList.find((p) => p.poolSeed === sA)?.idolId;
        const idB = pList.find((p) => p.poolSeed === sB)?.idolId;
        if (idA && idB) {
          pairs.push([idA, idB]);
        }
      });
    }

    pairs.forEach(([idA, idB], mIdx) => {
      const matchId = `swiss_${pId}_r1_m${mIdx + 1}`;
      const existing = existingMatchMap.get(matchId);

      if (
        !randomizeRound1 &&
        existing &&
        existing.idolAId === idA &&
        existing.idolBId === idB
      ) {
        allMatches.push({ ...existing, poolId: pId, poolName, roundNumber: 1 });
      } else {
        allMatches.push({
          id: matchId,
          poolId: pId,
          poolName,
          roundNumber: 1,
          roundName: 'Round 1 (Opening Stage)',
          matchNumber: mIdx + 1,
          idolAId: idA,
          idolBId: idB,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          loserId: null,
          completed: false,
          seriesLength: 3,
        });
      }
    });
  });

  // Dynamically resolve Rounds 2 through 5 for each pool
  const allGeneratedMatches = resolveAllSwissRounds(allMatches, poolParticipants, existingMatchMap);

  // Compute standings & status for each pool
  const poolStates: Record<string, SwissPoolState> = {};
  const flatParticipants: SwissParticipant[] = [];
  const directQualifiers: string[] = [];
  const lastChanceCandidatesByPool: Record<SwissPoolId, string[]> = {
    pool_a: [],
    pool_b: [],
    pool_c: [],
    pool_d: [],
  };

  SWISS_POOL_IDS.forEach((pId) => {
    const pMatches = allGeneratedMatches.filter((m) => m.poolId === pId);
    const standings = computeSwissPoolStandings(poolParticipants[pId], pMatches);
    const isCompleted = isSwissPoolFinished(standings, pMatches);

    // Direct qualifiers: idols who reached 3 wins with <= 1 loss (5 per pool)
    const directQuals = standings
      .filter((s) => s.status === 'qualified')
      .map((s) => s.idolId);

    // Last chance candidates: 3 idols per pool who won Round 5 Decider (3-2)
    const lcCandidates = standings
      .filter((s) => s.status === 'last_chance')
      .map((s) => s.idolId)
      .slice(0, 3);

    lastChanceCandidatesByPool[pId] = lcCandidates;

    directQuals.forEach((id) => {
      if (!directQualifiers.includes(id)) {
        directQualifiers.push(id);
      }
    });

    poolStates[pId] = {
      poolId: pId,
      poolName: SWISS_POOL_NAMES[pId],
      participantIds: poolParticipants[pId].map((p) => p.idolId),
      standings,
      isCompleted,
      directQualifierIds: directQuals,
      lastChanceCandidateIds: lcCandidates,
      lastChanceCandidateId: lcCandidates[0],
    };

    flatParticipants.push(...standings);
  });

  // Generate the 12-idol Last Chance Round Robin (2 groups of 6 idols)
  const lastChanceMatches = generateLastChanceRoundRobinMatches(
    poolStates,
    flatParticipants,
    existingMatchMap
  );

  const { group1Standings, group2Standings, combinedStandings, lastChanceQualifiers } =
    computeLastChanceStandings(flatParticipants, lastChanceMatches);

  const allQualifiers = Array.from(new Set([...directQualifiers, ...lastChanceQualifiers]));

  const allSwissDone =
    SWISS_POOL_IDS.every((pId) => poolStates[pId]?.isCompleted) &&
    lastChanceMatches.length > 0 &&
    lastChanceMatches.every((m) => m.completed);

  return {
    isInitialized: true,
    isCompleted: allSwissDone,
    participants: flatParticipants,
    pools: poolStates,
    matches: allGeneratedMatches,
    lastChanceMatches,
    lastChanceStandings: combinedStandings,
    lastChanceGroup1Standings: group1Standings,
    lastChanceGroup2Standings: group2Standings,
    directQualifiers,
    lastChanceQualifiers,
    allQualifiers,
  };
}

/**
 * Resolves rounds 2 through 5 dynamically for 16-idol Swiss Pools.
 * Progression:
 * - Round 1: 8 matches (16 idols) -> 8 at 1-0, 8 at 0-1
 * - Round 2: 8 matches (4 High: 1-0 vs 1-0 -> 4 reach 2-0, 4 drop to 1-1; 4 Low: 0-1 vs 0-1 -> 4 rise to 1-1, 4 drop to 0-2)
 * - Round 3: 8 matches (2 High: 2-0 vs 2-0 -> 2 reach 3-0 QUALIFIED; 4 Mid: 1-1 vs 1-1; 2 Low: 0-2 vs 0-2 -> 2 drop to 0-3 ELIMINATED)
 * - Round 4: 6 matches (3 High: 2-1 vs 2-1 -> 3 reach 3-1 QUALIFIED; 3 Low: 1-2 vs 1-2 -> 3 drop to 1-3 ELIMINATED)
 * - Round 5: 3 matches (3 Deciders: 2-2 vs 2-2 -> 3 reach 3-2; 3 finish 2-3 -> to Last Chance Decider)
 */
export function resolveAllSwissRounds(
  baseMatches: SwissMatch[],
  participantsMap: Record<SwissPoolId, SwissParticipant[]>,
  existingMatchMap: Map<string, SwissMatch>
): SwissMatch[] {
  const resultMatches: SwissMatch[] = [...baseMatches];

  SWISS_POOL_IDS.forEach((pId) => {
    const participants = participantsMap[pId] || [];
    const poolName = SWISS_POOL_NAMES[pId];

    for (let rNum = 2; rNum <= 5; rNum++) {
      const priorMatches = resultMatches.filter(
        (m) => m.poolId === pId && m.roundNumber < rNum
      );
      const immediatePriorMatches = resultMatches.filter(
        (m) => m.poolId === pId && m.roundNumber === rNum - 1
      );
      const isPriorRoundDone =
        immediatePriorMatches.length > 0 &&
        immediatePriorMatches.every((m) => m.completed && m.winnerId && m.loserId);

      const roundMatches = generateDynamicSwissRound(
        pId,
        poolName,
        rNum,
        participants,
        priorMatches,
        isPriorRoundDone,
        existingMatchMap
      );

      resultMatches.push(...roundMatches);
    }
  });

  return resultMatches;
}

/**
 * Pairs a subgroup of idols ensuring NO REMATCHES occur.
 */
function pairSubgroupWithoutRematches(
  idols: SwissParticipant[],
  priorMatches: SwissMatch[]
): Array<[SwissParticipant, SwissParticipant]> {
  if (idols.length < 2) return [];

  // Build opponent lookup set
  const playedPairs = new Set<string>();
  priorMatches.forEach((m) => {
    if (m.idolAId && m.idolBId) {
      playedPairs.add(`${m.idolAId}_${m.idolBId}`);
      playedPairs.add(`${m.idolBId}_${m.idolAId}`);
    }
  });

  // v4: never repeat an opponent. Search all combinations (groups hold 2 to 8 idols) before falling back.
  const solve = (list: SwissParticipant[]): Array<[SwissParticipant, SwissParticipant]> | null => {
    if (list.length === 0) return [];
    const [head, ...rest] = list;
    for (let i = 0; i < rest.length; i++) {
      if (playedPairs.has(`${head.idolId}_${rest[i].idolId}`)) continue;
      const sub = solve(rest.filter((_, k) => k !== i));
      if (sub) return [[head, rest[i]], ...sub];
    }
    return null;
  };
  if (idols.length % 2 === 0) {
    const perfect = solve(idols);
    if (perfect) return perfect;
  }

  const available = [...idols];
  const pairs: Array<[SwissParticipant, SwissParticipant]> = [];

  while (available.length >= 2) {
    const first = available.shift()!;
    let oppIdx = -1;

    // First try to find an opponent that has not been played yet
    for (let i = 0; i < available.length; i++) {
      const opp = available[i];
      if (!playedPairs.has(`${first.idolId}_${opp.idolId}`)) {
        oppIdx = i;
        break;
      }
    }

    // If all available have been played (extremely rare), fallback to first available
    if (oppIdx === -1) {
      oppIdx = 0;
    }

    const opp = available.splice(oppIdx, 1)[0];
    pairs.push([first, opp]);
  }

  return pairs;
}

/**
 * Dynamic Swiss Round Pairing Engine for 16 Idols
 */
function generateDynamicSwissRound(
  poolId: SwissPoolId,
  poolName: string,
  roundNumber: number,
  participants: SwissParticipant[],
  priorMatches: SwissMatch[],
  isPriorDone: boolean,
  existingMatchMap: Map<string, SwissMatch>
): SwissMatch[] {
  const expectedMatchCount =
    roundNumber === 2 ? 8 : roundNumber === 3 ? 8 : roundNumber === 4 ? 6 : 3;

  if (!isPriorDone) {
    const placeholderMatches: SwissMatch[] = [];
    for (let mIdx = 1; mIdx <= expectedMatchCount; mIdx++) {
      const matchId = `swiss_${poolId}_r${roundNumber}_m${mIdx}`;
      let rName = `Round ${roundNumber} Match ${mIdx}`;
      let bracketType: 'high' | 'mid' | 'low' | 'decider' = 'mid';

      if (roundNumber === 2) {
        if (mIdx <= 4) {
          rName = `Round 2 High Match ${mIdx}`;
          bracketType = 'high';
        } else {
          rName = `Round 2 Low Match ${mIdx - 4}`;
          bracketType = 'low';
        }
      } else if (roundNumber === 3) {
        if (mIdx <= 2) {
          rName = `Round 3 High Match ${mIdx}`;
          bracketType = 'high';
        } else if (mIdx <= 6) {
          rName = `Round 3 Mid Match ${mIdx - 2}`;
          bracketType = 'mid';
        } else {
          rName = `Round 3 Low Match ${mIdx - 6}`;
          bracketType = 'low';
        }
      } else if (roundNumber === 4) {
        if (mIdx <= 3) {
          rName = `Round 4 High Match ${mIdx}`;
          bracketType = 'high';
        } else {
          rName = `Round 4 Low Match ${mIdx - 3}`;
          bracketType = 'low';
        }
      } else if (roundNumber === 5) {
        rName = `Round 5 Decider Match ${mIdx}`;
        bracketType = 'decider';
      }

      placeholderMatches.push({
        id: matchId,
        poolId,
        poolName,
        roundNumber,
        roundName: rName,
        matchNumber: mIdx,
        idolAId: null,
        idolBId: null,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        loserId: null,
        completed: false,
        seriesLength: 3,
        bracketType,
      });
    }
    return placeholderMatches;
  }

  const currentStandings = computeSwissPoolStandings(participants, priorMatches);
  const pairs: Array<{
    idA: string;
    idB: string;
    roundName: string;
    bracketType: 'high' | 'mid' | 'low' | 'decider';
  }> = [];

  if (roundNumber === 2) {
    // 8 Idols at 1-0 (High), 8 Idols at 0-1 (Low)
    const pool10 = currentStandings.filter((p) => p.swissWins === 1 && p.swissLosses === 0);
    const pool01 = currentStandings.filter((p) => p.swissWins === 0 && p.swissLosses === 1);

    const highPairs = pairSubgroupWithoutRematches(pool10, priorMatches);
    highPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 2 High Match ${idx + 1}`,
        bracketType: 'high',
      });
    });

    const lowPairs = pairSubgroupWithoutRematches(pool01, priorMatches);
    lowPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 2 Low Match ${idx + 1}`,
        bracketType: 'low',
      });
    });
  } else if (roundNumber === 3) {
    // 4 Idols at 2-0 (High), 8 Idols at 1-1 (Mid), 4 Idols at 0-2 (Low)
    const pool20 = currentStandings.filter((p) => p.swissWins === 2 && p.swissLosses === 0);
    const pool11 = currentStandings.filter((p) => p.swissWins === 1 && p.swissLosses === 1);
    const pool02 = currentStandings.filter((p) => p.swissWins === 0 && p.swissLosses === 2);

    const highPairs = pairSubgroupWithoutRematches(pool20, priorMatches);
    highPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 3 High Match ${idx + 1}`,
        bracketType: 'high',
      });
    });

    const midPairs = pairSubgroupWithoutRematches(pool11, priorMatches);
    midPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 3 Mid Match ${idx + 1}`,
        bracketType: 'mid',
      });
    });

    const lowPairs = pairSubgroupWithoutRematches(pool02, priorMatches);
    lowPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 3 Low Match ${idx + 1}`,
        bracketType: 'low',
      });
    });
  } else if (roundNumber === 4) {
    // 6 Idols at 2-1 (High), 6 Idols at 1-2 (Low)
    const pool21 = currentStandings.filter((p) => p.swissWins === 2 && p.swissLosses === 1);
    const pool12 = currentStandings.filter((p) => p.swissWins === 1 && p.swissLosses === 2);

    const highPairs = pairSubgroupWithoutRematches(pool21, priorMatches);
    highPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 4 High Match ${idx + 1}`,
        bracketType: 'high',
      });
    });

    const lowPairs = pairSubgroupWithoutRematches(pool12, priorMatches);
    lowPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 4 Low Match ${idx + 1}`,
        bracketType: 'low',
      });
    });
  } else if (roundNumber === 5) {
    // 6 Idols at 2-2 (Deciders)
    const pool22 = currentStandings.filter((p) => p.swissWins === 2 && p.swissLosses === 2);
    const deciderPairs = pairSubgroupWithoutRematches(pool22, priorMatches);
    deciderPairs.forEach(([pA, pB], idx) => {
      pairs.push({
        idA: pA.idolId,
        idB: pB.idolId,
        roundName: `Round 5 Decider Match ${idx + 1}`,
        bracketType: 'decider',
      });
    });
  }

  const roundMatches: SwissMatch[] = [];

  pairs.forEach(({ idA, idB, roundName, bracketType }, idx) => {
    const matchId = `swiss_${poolId}_r${roundNumber}_m${idx + 1}`;
    
    // Match lookup: ONLY match if the idol IDs actually match this pair (in either orientation)
    const existing = Array.from(existingMatchMap.values()).find(
      (m) =>
        m.poolId === poolId &&
        m.roundNumber === roundNumber &&
        ((m.idolAId === idA && m.idolBId === idB) || (m.idolAId === idB && m.idolBId === idA))
    );

    if (existing && existing.completed && existing.scoreA !== null && existing.scoreB !== null) {
      const isReversed = existing.idolAId === idB && existing.idolBId === idA;
      const sA = isReversed ? existing.scoreB : existing.scoreA;
      const sB = isReversed ? existing.scoreA : existing.scoreB;
      let winnerId = existing.winnerId;
      let loserId = existing.loserId;

      // Ensure winnerId and loserId strictly match idA or idB
      if (winnerId !== idA && winnerId !== idB) {
        winnerId = sA > sB ? idA : sB > sA ? idB : null;
        loserId = winnerId === idA ? idB : idA;
      }

      roundMatches.push({
        ...existing,
        id: matchId,
        poolId,
        poolName,
        roundNumber,
        roundName: existing.roundName || roundName,
        matchNumber: idx + 1,
        idolAId: idA,
        idolBId: idB,
        scoreA: sA,
        scoreB: sB,
        winnerId,
        loserId,
        completed: true,
        seriesLength: existing.seriesLength || 3,
        bracketType,
      });
    } else {
      roundMatches.push({
        id: matchId,
        poolId,
        poolName,
        roundNumber,
        roundName,
        matchNumber: idx + 1,
        idolAId: idA,
        idolBId: idB,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        loserId: null,
        completed: false,
        seriesLength: 3,
        bracketType,
      });
    }
  });

  return roundMatches;
}

/**
 * Computes standings for a single Swiss Pool of 16 participants.
 */
export function computeSwissPoolStandings(
  participants: SwissParticipant[],
  poolMatches: SwissMatch[]
): SwissParticipant[] {
  const statsMap = new Map<
    string,
    {
      wins: number;
      losses: number;
      gamesFor: number;
      gamesAgainst: number;
      opponentsFaced: string[];
    }
  >();

  participants.forEach((p) => {
    statsMap.set(p.idolId, {
      wins: 0,
      losses: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      opponentsFaced: [],
    });
  });

  poolMatches.forEach((m) => {
    if (m.completed && m.winnerId && m.loserId && m.scoreA !== null && m.scoreB !== null) {
      if (m.idolAId && statsMap.has(m.idolAId)) {
        const stA = statsMap.get(m.idolAId)!;
        stA.gamesFor += m.scoreA;
        stA.gamesAgainst += m.scoreB;
        if (m.winnerId === m.idolAId) stA.wins += 1;
        else stA.losses += 1;
        if (m.idolBId) stA.opponentsFaced.push(m.idolBId);
      }

      if (m.idolBId && statsMap.has(m.idolBId)) {
        const stB = statsMap.get(m.idolBId)!;
        stB.gamesFor += m.scoreB;
        stB.gamesAgainst += m.scoreA;
        if (m.winnerId === m.idolBId) stB.wins += 1;
        else stB.losses += 1;
        if (m.idolAId) stB.opponentsFaced.push(m.idolAId);
      }
    }
  });

  const updatedParticipants: SwissParticipant[] = participants.map((p) => {
    const st = statsMap.get(p.idolId)!;
    const wins = st.wins;
    const losses = st.losses;
    const gamesFor = st.gamesFor;
    const gamesAgainst = st.gamesAgainst;
    const gameDiff = gamesFor - gamesAgainst;

    let buchholz = 0;
    st.opponentsFaced.forEach((oppId) => {
      const oppStats = statsMap.get(oppId);
      if (oppStats) buchholz += oppStats.wins;
    });

    let status: 'qualified' | 'last_chance' | 'contention' | 'eliminated' = 'contention';
    let qualificationReason = undefined;

    if (wins === 3) {
      if (losses <= 1) {
        // Reached 3-0 in R3 or 3-1 in R4 -> Direct Grand Cup Qualifier (5 idols per pool)
        status = 'qualified';
        qualificationReason = `Direct Grand Cup Qualifier (${wins}-${losses})`;
      } else if (losses === 2) {
        // Won Round 5 Decider (3-2) -> Advances to Last Chance Decider (3 idols per pool)
        status = 'last_chance';
        qualificationReason = `Won Round 5 Decider (3-2) - Advanced to Last Chance`;
      }
    } else if (losses === 3) {
      if (wins === 2) {
        status = 'eliminated';
        qualificationReason = `Eliminated in Round 5 Decider (2-3)`;
      } else {
        status = 'eliminated';
        qualificationReason = `Eliminated (${wins}-${losses})`;
      }
    }

    return {
      ...p,
      swissWins: wins,
      swissLosses: losses,
      swissGamesFor: gamesFor,
      swissGamesAgainst: gamesAgainst,
      swissGameDiff: gameDiff,
      buchholzScore: buchholz,
      status,
      qualificationReason,
    };
  });

  // Sort standings:
  // 1. Swiss Wins (descending)
  // 2. Swiss Losses (ascending)
  // 3. Buchholz Score (descending)
  // 4. Swiss Game Diff (descending)
  // 5. League Points (descending)
  // 6. Pool Seed (ascending)
  updatedParticipants.sort((a, b) => {
    if (b.swissWins !== a.swissWins) return b.swissWins - a.swissWins;
    if (a.swissLosses !== b.swissLosses) return a.swissLosses - b.swissLosses;
    if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
    if (b.swissGameDiff !== a.swissGameDiff) return b.swissGameDiff - a.swissGameDiff;
    if (b.points !== a.points) return b.points - a.points;
    return a.poolSeed - b.poolSeed;
  });

  updatedParticipants.forEach((p, idx) => {
    p.poolRank = idx + 1;
  });

  return updatedParticipants;
}

export function isSwissPoolFinished(
  standings: SwissParticipant[],
  poolMatches: SwissMatch[]
): boolean {
  if (!poolMatches || poolMatches.length === 0) return false;
  // A pool is finished when all 16 participants have reached either qualified (3-0/3-1), last_chance (3-2), or eliminated
  if (
    standings &&
    standings.length === 16 &&
    standings.every(
      (p) => p.status === 'qualified' || p.status === 'last_chance' || p.status === 'eliminated'
    )
  ) {
    return true;
  }
  const playableMatches = poolMatches.filter((m) => m.idolAId && m.idolBId);
  return (
    playableMatches.length >= 33 &&
    playableMatches.every((m) => m.completed)
  );
}

/**
 * Generates the 12-Idol Last Chance Decider Round Robin Matches:
 * 12 Idols (3 from each of the 4 Swiss Pools) -> 2 Groups of 6 Idols (Group Alpha & Group Beta).
 * 5 Matchdays Round Robin for each group (3 matches per matchday per group = 15 matches/group = 30 matches total).
 * Top 2 from Group Alpha and Top 2 from Group Beta punch tickets to the Grand Cup 64 (4 total qualifiers).
 */
export function generateLastChanceRoundRobinMatches(
  pools: Record<string, SwissPoolState>,
  allParticipants: SwissParticipant[],
  existingMatchMap: Map<string, SwissMatch>
): SwissMatch[] {
  // Collect top 3 Last Chance contenders from each of the 4 pools
  const poolAContenders = pools.pool_a?.lastChanceCandidateIds || [];
  const poolBContenders = pools.pool_b?.lastChanceCandidateIds || [];
  const poolCContenders = pools.pool_c?.lastChanceCandidateIds || [];
  const poolDContenders = pools.pool_d?.lastChanceCandidateIds || [];

  // Group Alpha (6 idols): Pool A #1, Pool B #2, Pool C #1, Pool D #2, Pool A #3, Pool C #3
  const group1Ids: Array<string | null> = [
    poolAContenders[0] || null,
    poolBContenders[1] || null,
    poolCContenders[0] || null,
    poolDContenders[1] || null,
    poolAContenders[2] || null,
    poolCContenders[2] || null,
  ];

  // Group Beta (6 idols): Pool B #1, Pool A #2, Pool D #1, Pool C #2, Pool B #3, Pool D #3
  const group2Ids: Array<string | null> = [
    poolBContenders[0] || null,
    poolAContenders[1] || null,
    poolDContenders[0] || null,
    poolCContenders[1] || null,
    poolBContenders[2] || null,
    poolDContenders[2] || null,
  ];

  // Standard 6-team round robin pairings (5 matchdays)
  const roundRobinSchedule: Array<Array<[number, number]>> = [
    // Matchday 1
    [[1, 6], [2, 5], [3, 4]],
    // Matchday 2
    [[1, 5], [6, 4], [2, 3]],
    // Matchday 3
    [[1, 4], [5, 3], [6, 2]],
    // Matchday 4
    [[1, 3], [4, 2], [5, 6]],
    // Matchday 5
    [[1, 2], [3, 6], [4, 5]],
  ];

  const matches: SwissMatch[] = [];

  // Group 1 (Alpha)
  roundRobinSchedule.forEach((mdPairs, mdIdx) => {
    const md = mdIdx + 1;
    mdPairs.forEach(([idxA, idxB], pIdx) => {
      const matchId = `lc_g1_md${md}_m${pIdx + 1}`;
      const idA = group1Ids[idxA - 1] || null;
      const idB = group1Ids[idxB - 1] || null;

      const existing = (idA && idB)
        ? Array.from(existingMatchMap.values()).find(
            (m) =>
              m.isLastChance &&
              m.roundNumber === md &&
              ((m.idolAId === idA && m.idolBId === idB) || (m.idolAId === idB && m.idolBId === idA))
          )
        : null;

      if (idA && idB && existing && existing.completed && existing.scoreA !== null && existing.scoreB !== null) {
        const isReversed = existing.idolAId === idB && existing.idolBId === idA;
        const sA = isReversed ? existing.scoreB : existing.scoreA;
        const sB = isReversed ? existing.scoreA : existing.scoreB;
        const isDraw = sA === sB;
        const winnerId = isDraw ? null : sA > sB ? idA : idB;
        const loserId = isDraw ? null : sA > sB ? idB : idA;

        matches.push({
          ...existing,
          id: matchId,
          poolId: 'last_chance',
          poolName: 'Last Chance Decider (Group Alpha)',
          roundNumber: md,
          matchday: md,
          roundName: existing.roundName || `Group Alpha &bull; Matchday ${md}`,
          matchNumber: pIdx + 1,
          idolAId: idA,
          idolBId: idB,
          scoreA: sA,
          scoreB: sB,
          winnerId,
          loserId,
          completed: true,
          isLastChance: true,
        });
      } else {
        matches.push({
          id: matchId,
          poolId: 'last_chance',
          poolName: 'Last Chance Decider (Group Alpha)',
          roundNumber: md,
          matchday: md,
          roundName: `Group Alpha &bull; Matchday ${md}`,
          matchNumber: pIdx + 1,
          idolAId: idA,
          idolBId: idB,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          loserId: null,
          completed: false,
          seriesLength: 3,
          isLastChance: true,
        });
      }
    });
  });

  // Group 2 (Beta)
  roundRobinSchedule.forEach((mdPairs, mdIdx) => {
    const md = mdIdx + 1;
    mdPairs.forEach(([idxA, idxB], pIdx) => {
      const matchId = `lc_g2_md${md}_m${pIdx + 1}`;
      const idA = group2Ids[idxA - 1] || null;
      const idB = group2Ids[idxB - 1] || null;

      const existing = (idA && idB)
        ? Array.from(existingMatchMap.values()).find(
            (m) =>
              m.isLastChance &&
              m.roundNumber === md &&
              ((m.idolAId === idA && m.idolBId === idB) || (m.idolAId === idB && m.idolBId === idA))
          )
        : null;

      if (idA && idB && existing && existing.completed && existing.scoreA !== null && existing.scoreB !== null) {
        const isReversed = existing.idolAId === idB && existing.idolBId === idA;
        const sA = isReversed ? existing.scoreB : existing.scoreA;
        const sB = isReversed ? existing.scoreA : existing.scoreB;
        const isDraw = sA === sB;
        const winnerId = isDraw ? null : sA > sB ? idA : idB;
        const loserId = isDraw ? null : sA > sB ? idB : idA;

        matches.push({
          ...existing,
          id: matchId,
          poolId: 'last_chance',
          poolName: 'Last Chance Decider (Group Beta)',
          roundNumber: md,
          matchday: md,
          roundName: existing.roundName || `Group Beta &bull; Matchday ${md}`,
          matchNumber: pIdx + 1,
          idolAId: idA,
          idolBId: idB,
          scoreA: sA,
          scoreB: sB,
          winnerId,
          loserId,
          completed: true,
          isLastChance: true,
        });
      } else {
        matches.push({
          id: matchId,
          poolId: 'last_chance',
          poolName: 'Last Chance Decider (Group Beta)',
          roundNumber: md,
          matchday: md,
          roundName: `Group Beta &bull; Matchday ${md}`,
          matchNumber: pIdx + 1,
          idolAId: idA,
          idolBId: idB,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          loserId: null,
          completed: false,
          seriesLength: 3,
          isLastChance: true,
        });
      }
    });
  });

  return matches;
}

/**
 * Computes standings for the Last Chance 2-Group Deciders
 */
export function computeLastChanceStandings(
  allParticipants: SwissParticipant[],
  lastChanceMatches: SwissMatch[]
): {
  group1Standings: SwissParticipant[];
  group2Standings: SwissParticipant[];
  combinedStandings: SwissParticipant[];
  lastChanceQualifiers: string[];
} {
  const g1Matches = lastChanceMatches.filter((m) => m.id.startsWith('lc_g1_'));
  const g2Matches = lastChanceMatches.filter((m) => m.id.startsWith('lc_g2_'));

  const computeGroup = (
    matches: SwissMatch[],
    groupId: 'group_1' | 'group_2'
  ): SwissParticipant[] => {
    const idolIdSet = new Set<string>();
    matches.forEach((m) => {
      if (m.idolAId) idolIdSet.add(m.idolAId);
      if (m.idolBId) idolIdSet.add(m.idolBId);
    });

    const statsMap = new Map<
      string,
      {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        gamesFor: number;
        gamesAgainst: number;
        points: number;
      }
    >();

    idolIdSet.forEach((id) => {
      statsMap.set(id, {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        points: 0,
      });
    });

    matches.forEach((m) => {
      if (m.completed && m.scoreA !== null && m.scoreB !== null) {
        const isDraw = m.scoreA === m.scoreB;
        if (m.idolAId && statsMap.has(m.idolAId)) {
          const stA = statsMap.get(m.idolAId)!;
          stA.played += 1;
          stA.gamesFor += m.scoreA;
          stA.gamesAgainst += m.scoreB;
          if (isDraw) {
            stA.drawn += 1;
            stA.points += 1;
          } else if (m.winnerId === m.idolAId || m.scoreA > m.scoreB) {
            stA.won += 1;
            stA.points += 3;
          } else {
            stA.lost += 1;
          }
        }
        if (m.idolBId && statsMap.has(m.idolBId)) {
          const stB = statsMap.get(m.idolBId)!;
          stB.played += 1;
          stB.gamesFor += m.scoreB;
          stB.gamesAgainst += m.scoreA;
          if (isDraw) {
            stB.drawn += 1;
            stB.points += 1;
          } else if (m.winnerId === m.idolBId || m.scoreB > m.scoreA) {
            stB.won += 1;
            stB.points += 3;
          } else {
            stB.lost += 1;
          }
        }
      }
    });

    const groupList: SwissParticipant[] = [];
    idolIdSet.forEach((id) => {
      const part = allParticipants.find((p) => p.idolId === id) || ({
        idolId: id,
        idolName: 'Unknown Contender',
        girlGroup: 'Unknown',
        nationality: 'South Korea',
        seed: 'Unseeded',
        leagueId: 1,
        leagueName: 'League',
        leagueRank: 10,
        points: 0,
        gameDiff: 0,
        gamesFor: 0,
        poolId: 'pool_a',
        potNumber: 1,
        poolSeed: 1,
        swissWins: 0,
        swissLosses: 0,
        swissGameDiff: 0,
        swissGamesFor: 0,
        swissGamesAgainst: 0,
        buchholzScore: 0,
        status: 'last_chance',
      } as SwissParticipant);

      const st = statsMap.get(id)!;
      groupList.push({
        ...part,
        lastChanceGroupId: groupId,
        lastChancePlayed: st.played,
        lastChanceWon: st.won,
        lastChanceDrawn: st.drawn,
        lastChanceLost: st.lost,
        lastChancePoints: st.points,
        lastChanceGF: st.gamesFor,
        lastChanceGA: st.gamesAgainst,
        lastChanceGD: st.gamesFor - st.gamesAgainst,
        swissWins: st.won,
        swissLosses: st.lost,
        swissGamesFor: st.gamesFor,
        swissGamesAgainst: st.gamesAgainst,
        swissGameDiff: st.gamesFor - st.gamesAgainst,
      });
    });

    groupList.sort((a, b) => {
      const ptsA = a.lastChancePoints ?? 0;
      const ptsB = b.lastChancePoints ?? 0;
      if (ptsB !== ptsA) return ptsB - ptsA;

      const gdA = a.lastChanceGD ?? 0;
      const gdB = b.lastChanceGD ?? 0;
      if (gdB !== gdA) return gdB - gdA;

      const gfA = a.lastChanceGF ?? 0;
      const gfB = b.lastChanceGF ?? 0;
      if (gfB !== gfA) return gfB - gfA;

      const wonA = a.lastChanceWon ?? 0;
      const wonB = b.lastChanceWon ?? 0;
      if (wonB !== wonA) return wonB - wonA;

      return b.points - a.points;
    });

    const isGroupFinished =
      matches.length > 0 &&
      matches.every((m) => m.completed && m.idolAId && m.idolBId);

    groupList.forEach((p, idx) => {
      p.poolRank = idx + 1;
      if (idx < 4 && isGroupFinished) {
        p.status = 'qualified';
        p.qualificationReason = `Top 4 in Last Chance ${groupId === 'group_1' ? 'Group Alpha' : 'Group Beta'} (Grand Cup 64)`;
      } else if (idx >= 4 && isGroupFinished) {
        p.status = 'eliminated';
        p.qualificationReason = `Eliminated in Last Chance Decider (${idx + 1}th Place)`;
      }
    });

    return groupList;
  };

  const group1Standings = computeGroup(g1Matches, 'group_1');
  const group2Standings = computeGroup(g2Matches, 'group_2');

  const g1Quals = group1Standings.slice(0, 4).map((p) => p.idolId);
  const g2Quals = group2Standings.slice(0, 4).map((p) => p.idolId);
  const lastChanceQualifiers = [...g1Quals, ...g2Quals];

  return {
    group1Standings,
    group2Standings,
    combinedStandings: [...group1Standings, ...group2Standings],
    lastChanceQualifiers,
  };
}

/**
 * Simulates a single Swiss Match (BO3) or Last Chance Match (Single Match with Draw capability)
 */
export function simulateSwissMatch(
  playIn: SwissPlayInState,
  matchId: string,
  idols: Idol[]
): SwissPlayInState {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => i && idolsMap.set(i.id, i));

  let matchFound = playIn.matches?.find((m) => m.id === matchId);
  const isLastChance = !matchFound;
  if (!matchFound) {
    matchFound = playIn.lastChanceMatches?.find((m) => m.id === matchId);
  }

  if (!matchFound || !matchFound.idolAId || !matchFound.idolBId) {
    return playIn;
  }

  const idolA = idolsMap.get(matchFound.idolAId);
  const idolB = idolsMap.get(matchFound.idolBId);

  // Compute rolling form histories for both idols across all Swiss & Last Chance matches played so far
  const allM = [...(playIn.matches || []), ...(playIn.lastChanceMatches || [])];
  const formA: Array<'W' | 'D' | 'L'> = [];
  const formB: Array<'W' | 'D' | 'L'> = [];
  allM.forEach((m) => {
    if (m.completed && m.scoreA !== null && m.scoreB !== null) {
      if (m.idolAId === matchFound!.idolAId) {
        if (m.scoreA > m.scoreB) formA.push('W');
        else if (m.scoreA < m.scoreB) formA.push('L');
        else formA.push('D');
      } else if (m.idolBId === matchFound!.idolAId) {
        if (m.scoreB > m.scoreA) formA.push('W');
        else if (m.scoreB < m.scoreA) formA.push('L');
        else formA.push('D');
      }

      if (m.idolAId === matchFound!.idolBId) {
        if (m.scoreA > m.scoreB) formB.push('W');
        else if (m.scoreA < m.scoreB) formB.push('L');
        else formB.push('D');
      } else if (m.idolBId === matchFound!.idolBId) {
        if (m.scoreB > m.scoreA) formB.push('W');
        else if (m.scoreB < m.scoreA) formB.push('L');
        else formB.push('D');
      }
    }
  });

  const ratingA = idolA ? getEffectiveIdolRating(idolA, formA.slice(-5)).effectiveRating : 75;
  const ratingB = idolB ? getEffectiveIdolRating(idolB, formB.slice(-5)).effectiveRating : 75;

  let simScoreA = 0;
  let simScoreB = 0;
  let winnerId: string | null = null;
  let loserId: string | null = null;

  if (isLastChance) {
    // Round-robin match with authentic soccer/arena draw capability
    const simResult = simulateLeagueMatchScore(idolA, idolB, formA.slice(-5), formB.slice(-5));
    simScoreA = simResult.scoreA;
    simScoreB = simResult.scoreB;
    if (simScoreA === simScoreB) {
      winnerId = null;
      loserId = null;
    } else if (simScoreA > simScoreB) {
      winnerId = matchFound.idolAId;
      loserId = matchFound.idolBId;
    } else {
      winnerId = matchFound.idolBId;
      loserId = matchFound.idolAId;
    }
  } else {
    const simResult = simulateSeriesMatches(ratingA, ratingB, swissTargetWins(matchFound.seriesLength));
    simScoreA = simResult.scoreA;
    simScoreB = simResult.scoreB;
    winnerId = simResult.winnerIdIsA ? matchFound.idolAId : matchFound.idolBId;
    loserId = simResult.winnerIdIsA ? matchFound.idolBId : matchFound.idolAId;
  }

  const updatedMatch: SwissMatch = {
    ...matchFound,
    scoreA: simScoreA,
    scoreB: simScoreB,
    winnerId,
    loserId,
    completed: true,
    updatedAt: new Date().toISOString(),
  };

  const updatedMatches = isLastChance
    ? playIn.matches
    : playIn.matches.map((m) => (m.id === matchId ? updatedMatch : m));

  const updatedLcMatches = isLastChance
    ? playIn.lastChanceMatches.map((m) => (m.id === matchId ? updatedMatch : m))
    : playIn.lastChanceMatches;

  return recalculateSwissState({
    ...playIn,
    matches: updatedMatches,
    lastChanceMatches: updatedLcMatches,
  });
}

/**
 * Simulates a specific round in a Swiss Pool or all pools
 */
export function simulateSwissRound(
  playIn: SwissPlayInState,
  roundNumber: number,
  idols: Idol[],
  poolId?: SwissPoolId
): SwissPlayInState {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => i && idolsMap.set(i.id, i));

  const matchesToSimulate = playIn.matches.filter((m) => {
    if (m.completed) return false;
    if (m.roundNumber !== roundNumber) return false;
    if (poolId && m.poolId !== poolId) return false;
    return !!m.idolAId && !!m.idolBId;
  });

  if (matchesToSimulate.length === 0) {
    return playIn;
  }

  const matchSimMap = new Map<string, SwissMatch>();
  matchesToSimulate.forEach((matchFound) => {
    const idolA = idolsMap.get(matchFound.idolAId!);
    const idolB = idolsMap.get(matchFound.idolBId!);
    const formA: ('W' | 'L' | 'D')[] = [];
    const formB: ('W' | 'L' | 'D')[] = [];
    const ratingA = idolA ? getEffectiveIdolRating(idolA, formA).effectiveRating : 75;
    const ratingB = idolB ? getEffectiveIdolRating(idolB, formB).effectiveRating : 75;

    const simResult = simulateSeriesMatches(ratingA, ratingB, swissTargetWins(matchFound.seriesLength));
    const simScoreA = simResult.scoreA;
    const simScoreB = simResult.scoreB;
    const winnerId = simResult.winnerIdIsA ? matchFound.idolAId : matchFound.idolBId;
    const loserId = simResult.winnerIdIsA ? matchFound.idolBId : matchFound.idolAId;

    matchSimMap.set(matchFound.id, {
      ...matchFound,
      scoreA: simScoreA,
      scoreB: simScoreB,
      winnerId,
      loserId,
      completed: true,
      updatedAt: new Date().toISOString(),
    });
  });

  const updatedMatches = playIn.matches.map((m) => matchSimMap.get(m.id) || m);

  return recalculateSwissState({
    ...playIn,
    matches: updatedMatches,
  });
}

/**
 * Simulates all Swiss stages + Last Chance matches
 */
export function simulateAllSwissMatches(
  playIn: SwissPlayInState,
  idols: Idol[]
): SwissPlayInState {
  let state = { ...playIn };

  // Sequentially resolve Rounds 1 through 5 for all pools
  for (let r = 1; r <= 5; r++) {
    state = simulateSwissRound(state, r, idols);
  }

  // Then simulate all Last Chance matchdays
  for (let md = 1; md <= 5; md++) {
    state = simulateLastChanceMatchday(state, md, idols);
  }

  return state;
}

/**
 * Simulates all Last Chance matches
 */
export function simulateAllLastChanceMatches(
  playIn: SwissPlayInState,
  idols: Idol[]
): SwissPlayInState {
  let state = { ...playIn };
  for (let md = 1; md <= 5; md++) {
    state = simulateLastChanceMatchday(state, md, idols);
  }
  return state;
}

/**
 * Simulates a specific Matchday in Last Chance Deciders
 */
export function simulateLastChanceMatchday(
  playIn: SwissPlayInState,
  matchday: number,
  idols: Idol[]
): SwissPlayInState {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => i && idolsMap.set(i.id, i));

  const matchesToSim = (playIn.lastChanceMatches || []).filter(
    (m) => (m.matchday === matchday || m.roundNumber === matchday) && !m.completed && m.idolAId && m.idolBId
  );

  if (matchesToSim.length === 0) return playIn;

  const matchSimMap = new Map<string, SwissMatch>();
  matchesToSim.forEach((m) => {
    const idolA = idolsMap.get(m.idolAId!);
    const idolB = idolsMap.get(m.idolBId!);
    const simResult = simulateLeagueMatchScore(idolA, idolB, [], []);
    let winnerId: string | null = null;
    let loserId: string | null = null;
    if (simResult.scoreA > simResult.scoreB) {
      winnerId = m.idolAId;
      loserId = m.idolBId;
    } else if (simResult.scoreB > simResult.scoreA) {
      winnerId = m.idolBId;
      loserId = m.idolAId;
    }
    matchSimMap.set(m.id, {
      ...m,
      scoreA: simResult.scoreA,
      scoreB: simResult.scoreB,
      winnerId,
      loserId,
      completed: true,
      updatedAt: new Date().toISOString(),
    });
  });

  const updatedLcMatches = (playIn.lastChanceMatches || []).map(
    (m) => matchSimMap.get(m.id) || m
  );

  return recalculateSwissState({
    ...playIn,
    lastChanceMatches: updatedLcMatches,
  });
}

/**
 * Updates a match result manually
 */
export function updateSwissMatchResult(
  playIn: SwissPlayInState,
  matchId: string,
  scoreA: number,
  scoreB: number
): SwissPlayInState {
  let matchFound = playIn.matches?.find((m) => m.id === matchId);
  const isLastChance = !matchFound;
  if (!matchFound) {
    matchFound = playIn.lastChanceMatches?.find((m) => m.id === matchId);
  }

  if (!matchFound || !matchFound.idolAId || !matchFound.idolBId) {
    return playIn;
  }

  const isDraw = isLastChance && scoreA === scoreB;
  const winnerId = isDraw ? null : scoreA > scoreB ? matchFound.idolAId : matchFound.idolBId;
  const loserId = isDraw ? null : scoreA > scoreB ? matchFound.idolBId : matchFound.idolAId;

  const updatedMatch: SwissMatch = {
    ...matchFound,
    scoreA,
    scoreB,
    winnerId,
    loserId,
    completed: true,
    updatedAt: new Date().toISOString(),
  };

  const updatedMatches = isLastChance
    ? playIn.matches
    : playIn.matches.map((m) => (m.id === matchId ? updatedMatch : m));

  const updatedLcMatches = isLastChance
    ? playIn.lastChanceMatches.map((m) => (m.id === matchId ? updatedMatch : m))
    : playIn.lastChanceMatches;

  return recalculateSwissState({
    ...playIn,
    matches: updatedMatches,
    lastChanceMatches: updatedLcMatches,
  });
}

/**
 * Resets a match result back to unplayed
 */
export function resetSwissMatch(
  playIn: SwissPlayInState,
  matchId: string
): SwissPlayInState {
  let matchFound = playIn.matches?.find((m) => m.id === matchId);
  const isLastChance = !matchFound;
  if (!matchFound) {
    matchFound = playIn.lastChanceMatches?.find((m) => m.id === matchId);
  }

  if (!matchFound) {
    return playIn;
  }

  const updatedMatch: SwissMatch = {
    ...matchFound,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    loserId: null,
    completed: false,
    updatedAt: new Date().toISOString(),
  };

  const updatedMatches = isLastChance
    ? playIn.matches
    : playIn.matches.map((m) => (m.id === matchId ? updatedMatch : m));

  const updatedLcMatches = isLastChance
    ? playIn.lastChanceMatches.map((m) => (m.id === matchId ? updatedMatch : m))
    : playIn.lastChanceMatches;

  return recalculateSwissState({
    ...playIn,
    matches: updatedMatches,
    lastChanceMatches: updatedLcMatches,
  });
}


/**
 * Batch update match results (e.g. from live multi-pitch simulcast)
 */
export function updateSwissMatchesBatch(
  playIn: SwissPlayInState,
  results: Array<{ matchId: string; scoreA: number; scoreB: number }>
): SwissPlayInState {
  const resultMap = new Map(results.map((r) => [r.matchId, r]));

  const updatedMatches = playIn.matches.map((m) => {
    const res = resultMap.get(m.id);
    if (res && m.idolAId && m.idolBId) {
      const winnerId = res.scoreA > res.scoreB ? m.idolAId : m.idolBId;
      const loserId = res.scoreA > res.scoreB ? m.idolBId : m.idolAId;
      return {
        ...m,
        scoreA: res.scoreA,
        scoreB: res.scoreB,
        winnerId,
        loserId,
        completed: true,
        updatedAt: new Date().toISOString(),
      };
    }
    return m;
  });

  const updatedLcMatches = (playIn.lastChanceMatches || []).map((m) => {
    const res = resultMap.get(m.id);
    if (res && m.idolAId && m.idolBId) {
      const isDraw = res.scoreA === res.scoreB;
      const winnerId = isDraw ? null : res.scoreA > res.scoreB ? m.idolAId : m.idolBId;
      const loserId = isDraw ? null : res.scoreA > res.scoreB ? m.idolBId : m.idolAId;
      return {
        ...m,
        scoreA: res.scoreA,
        scoreB: res.scoreB,
        winnerId,
        loserId,
        completed: true,
        updatedAt: new Date().toISOString(),
      };
    }
    return m;
  });

  return recalculateSwissState({
    ...playIn,
    matches: updatedMatches,
    lastChanceMatches: updatedLcMatches,
  });
}

/**
 * Recalculates all pool standings, dynamic matchups, and qualifications.
 */
function recalculateSwissState(playIn: SwissPlayInState): SwissPlayInState {
  const poolParticipantsMap: Record<SwissPoolId, SwissParticipant[]> = {
    pool_a: [],
    pool_b: [],
    pool_c: [],
    pool_d: [],
  };

  (playIn.participants || []).forEach((p) => {
    if (poolParticipantsMap[p.poolId]) {
      poolParticipantsMap[p.poolId].push(p);
    }
  });

  const existingMatchMap = new Map<string, SwissMatch>();
  playIn.matches.forEach((m) => existingMatchMap.set(m.id, m));
  (playIn.lastChanceMatches || []).forEach((m) => existingMatchMap.set(m.id, m));

  const r1Matches = playIn.matches.filter((m) => m.roundNumber === 1);
  const allResolvedMatches = resolveAllSwissRounds(r1Matches, poolParticipantsMap, existingMatchMap);

  const updatedPools: Record<string, SwissPoolState> = {};
  const updatedFlatParticipants: SwissParticipant[] = [];
  const directQualifiers: string[] = [];

  SWISS_POOL_IDS.forEach((pId) => {
    const pMatches = allResolvedMatches.filter((m) => m.poolId === pId);
    const standings = computeSwissPoolStandings(poolParticipantsMap[pId], pMatches);
    const isCompleted = isSwissPoolFinished(standings, pMatches);

    let directQuals = standings
      .filter((s) => s.status === 'qualified')
      .map((s) => s.idolId);
    if (directQuals.length < 5 && isCompleted) {
      directQuals = standings.slice(0, 5).map((s) => s.idolId);
    }

    let lcCandidates = standings
      .filter((s) => s.status === 'last_chance')
      .map((s) => s.idolId)
      .slice(0, 3);
    if (lcCandidates.length < 3 && isCompleted) {
      lcCandidates = standings.slice(5, 8).map((s) => s.idolId);
    }

    directQuals.forEach((id) => {
      if (!directQualifiers.includes(id)) {
        directQualifiers.push(id);
      }
    });

    updatedPools[pId] = {
      poolId: pId,
      poolName: SWISS_POOL_NAMES[pId],
      participantIds: poolParticipantsMap[pId].map((p) => p.idolId),
      standings,
      isCompleted,
      directQualifierIds: directQuals,
      lastChanceCandidateIds: lcCandidates,
      lastChanceCandidateId: lcCandidates[0],
    };

    updatedFlatParticipants.push(...standings);
  });

  // Re-link Last Chance matches with newly determined candidates
  const updatedLcMatches = generateLastChanceRoundRobinMatches(
    updatedPools,
    updatedFlatParticipants,
    existingMatchMap
  );

  const { group1Standings, group2Standings, combinedStandings, lastChanceQualifiers } =
    computeLastChanceStandings(updatedFlatParticipants, updatedLcMatches);

  const allQualifiers = Array.from(new Set([...directQualifiers, ...lastChanceQualifiers]));

  const allSwissDone =
    SWISS_POOL_IDS.every((pId) => updatedPools[pId]?.isCompleted) &&
    updatedLcMatches.length > 0 &&
    updatedLcMatches.every((m) => m.completed);

  return {
    ...playIn,
    isCompleted: allSwissDone,
    participants: updatedFlatParticipants,
    pools: updatedPools,
    matches: allResolvedMatches,
    lastChanceMatches: updatedLcMatches,
    lastChanceStandings: combinedStandings,
    lastChanceGroup1Standings: group1Standings,
    lastChanceGroup2Standings: group2Standings,
    directQualifiers,
    lastChanceQualifiers,
    allQualifiers,
  };
}

/**
 * Extracts and consolidates all 64 Grand Cup qualifiers:
 * - 36 Automatic Direct Qualifiers (Top 6 from each of 6 Leagues)
 * - 28 Play-In Qualifiers (20 from 4 Swiss Pools [5 each] + 8 from 2 Last Chance Decider groups [Top 4 each])
 * Guarantees exactly 64 unique qualifiers under all conditions.
 */
export function getGrandCup64Qualifiers(
  leagues: LeagueInfo[],
  idols: Idol[],
  swissPlayIn?: SwissPlayInState | null
): LeagueQualifierEntry[] {
  const qualifiers: LeagueQualifierEntry[] = [];
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => i && idolsMap.set(i.id, i));
  const seenIdolIds = new Set<string>();

  // 1. Direct automatic qualifiers: Top 6 from each of 6 leagues (36 idols)
  leagues.forEach((l) => {
    const standings = l.standings || [];
    for (let r = 1; r <= 6; r++) {
      const st = standings[r - 1];
      if (st && !seenIdolIds.has(st.idolId)) {
        seenIdolIds.add(st.idolId);
        const idol = idolsMap.get(st.idolId);
        qualifiers.push({
          idolId: st.idolId,
          idolName: st.idolName,
          girlGroup: st.girlGroup,
          seed: st.seed || idol?.seed || 'Unseeded',
          nationality: st.nationality || idol?.nationality || 'South Korea',
          photoUrl: idol?.photoUrl || st.photoUrl,
          leagueId: l.id,
          leagueName: l.name,
          rankInLeague: r,
          points: st.points,
          gameDiff: st.gameDiff || 0,
          qualificationType: 'Automatic (Top 6)',
        });
      }
    }
  });

  // 2. Play-In Qualifiers: 28 idols (20 from Swiss Pools + 8 from Last Chance)
  if (swissPlayIn && swissPlayIn.allQualifiers && swissPlayIn.allQualifiers.length > 0) {
    swissPlayIn.allQualifiers.forEach((qId, idx) => {
      if (seenIdolIds.has(qId)) return;
      const idol = idolsMap.get(qId);
      if (idol) {
        seenIdolIds.add(qId);
        const isLastChance = swissPlayIn.lastChanceQualifiers?.includes(qId);
        qualifiers.push({
          idolId: idol.id,
          idolName: idol.name,
          girlGroup: idol.girlGroup,
          seed: idol.seed || 'Unseeded',
          nationality: idol.nationality || 'South Korea',
          photoUrl: idol.photoUrl,
          leagueId: 0,
          leagueName: isLastChance ? 'Last Chance Decider' : 'Swiss Stage Play-In',
          rankInLeague: 7 + idx,
          points: 0,
          gameDiff: 0,
          qualificationType: isLastChance
            ? 'Wildcard (Last Chance Top 4)'
            : 'Wildcard (Swiss Top 5)',
        });
      }
    });
  }

  // 3. Fallback padding: Guarantee EXACTLY 64 unique qualifiers under all conditions!
  if (qualifiers.length < 64) {
    // 3a. From Swiss participants sorted by performance
    if (swissPlayIn?.participants) {
      const sortedSwiss = [...swissPlayIn.participants].sort((a, b) => {
        if (b.swissWins !== a.swissWins) return b.swissWins - a.swissWins;
        if (a.swissLosses !== b.swissLosses) return a.swissLosses - b.swissLosses;
        if (b.buchholzScore !== a.buchholzScore) return b.buchholzScore - a.buchholzScore;
        return (b.points || 0) - (a.points || 0);
      });
      for (const p of sortedSwiss) {
        if (qualifiers.length >= 64) break;
        if (!seenIdolIds.has(p.idolId)) {
          seenIdolIds.add(p.idolId);
          const idol = idolsMap.get(p.idolId);
          qualifiers.push({
            idolId: p.idolId,
            idolName: p.idolName,
            girlGroup: p.girlGroup,
            seed: p.seed || idol?.seed || 'Unseeded',
            nationality: p.nationality || idol?.nationality || 'South Korea',
            photoUrl: idol?.photoUrl || p.photoUrl,
            leagueId: p.leagueId || 0,
            leagueName: p.leagueName || 'Swiss Stage Wildcard',
            rankInLeague: p.leagueRank || 17,
            points: p.points || 0,
            gameDiff: p.gameDiff || 0,
            qualificationType: 'Wildcard (Play-In Fallback)',
          });
        }
      }
    }

    // 3b. From league standings ranks 7 through 20 across all 6 leagues
    if (qualifiers.length < 64) {
      const remainingLeagueContenders: Array<{ st: LeagueStanding; l: LeagueInfo; rank: number }> = [];
      (leagues || []).forEach((l) => {
        (l.standings || []).forEach((st, idx) => {
          if (!seenIdolIds.has(st.idolId)) {
            remainingLeagueContenders.push({ st, l, rank: idx + 1 });
          }
        });
      });
      remainingLeagueContenders.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (b.st.points !== a.st.points) return b.st.points - a.st.points;
        return (b.st.gameDiff || 0) - (a.st.gameDiff || 0);
      });
      for (const item of remainingLeagueContenders) {
        if (qualifiers.length >= 64) break;
        seenIdolIds.add(item.st.idolId);
        const idol = idolsMap.get(item.st.idolId);
        qualifiers.push({
          idolId: item.st.idolId,
          idolName: item.st.idolName,
          girlGroup: item.st.girlGroup,
          seed: item.st.seed || idol?.seed || 'Unseeded',
          nationality: item.st.nationality || idol?.nationality || 'South Korea',
          photoUrl: idol?.photoUrl || item.st.photoUrl,
          leagueId: item.l.id,
          leagueName: item.l.name,
          rankInLeague: item.rank,
          points: item.st.points,
          gameDiff: item.st.gameDiff || 0,
          qualificationType: 'Wildcard (League Standings)',
        });
      }
    }

    // 3c. From all available idols
    if (qualifiers.length < 64) {
      for (const idol of idols) {
        if (qualifiers.length >= 64) break;
        if (!seenIdolIds.has(idol.id)) {
          seenIdolIds.add(idol.id);
          qualifiers.push({
            idolId: idol.id,
            idolName: idol.name,
            girlGroup: idol.girlGroup || 'Solo',
            seed: idol.seed || 'Unseeded',
            nationality: idol.nationality || 'South Korea',
            photoUrl: idol.photoUrl,
            leagueId: 0,
            leagueName: 'Wildcard Entrant',
            rankInLeague: 20,
            points: 0,
            gameDiff: 0,
            qualificationType: 'Wildcard Entrant',
          });
        }
      }
    }
  }

  return qualifiers;
}

/**
 * Randomizes Round 1 draw pairings across all 4 Swiss Pools
 */
export function randomizeSwissRound1Draw(
  playIn: SwissPlayInState,
  leagues: LeagueInfo[],
  idols: Idol[]
): SwissPlayInState {
  return generateSwissPlayIn(leagues, idols, playIn, true);
}

/**
 * Resets all Last Chance Decider match results
 */
export function resetLastChanceMatches(state: SwissPlayInState): SwissPlayInState {
  const resetMatches = (state.lastChanceMatches || []).map((m) => ({
    ...m,
    completed: false,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    loserId: null,
  }));

  const intermediateState: SwissPlayInState = {
    ...state,
    lastChanceMatches: resetMatches,
    lastChanceQualifiers: [],
    lastChanceGroup1Standings: [],
    lastChanceGroup2Standings: [],
    lastChanceStandings: [],
    isCompleted: false,
  };

  return recalculateSwissState(intermediateState);
}

