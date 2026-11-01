import {
  Idol,
  GirlGroup,
  TournamentConfig,
  Group,
  KnockoutMatch,
  ArchivedMatch,
  AppState,
  LeagueSeasonState,
  LeagueSeasonArchive,
  LeagueStanding,
  LeagueQualifierEntry,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsStanding,
  TheIdolsPlayoffMatch,
  PostseasonFormatType,
  TournamentArchive,
} from '../types';
import {
  DEFAULT_LEAGUE_DEFS,
  calculateLeagueStandings,
  simulateLeagueMatch,
  simulateAllWildcardMatches,
  generateWildcardPlayIn,
  getTop32Qualifiers,
  loadCustomLeagueBranding,
  initializeLeagueSeason,
  syncLeagueMatchesToArchivedMatches,
  archiveLeagueSeason,
} from './leagueLogic';
import {
  generateSwissPlayIn,
  simulateAllSwissMatches,
  getGrandCup64Qualifiers,
} from './swissLogic';
import {
  initializeTheIdolsSeason,
  calculateTheIdolsStandings,
  recalculateTheIdolsPlayoff,
  simulateTheIdolsMatch,
  simulateTheIdolsPlayoffSeries,
  computeTheIdolsHonors,
  convertTheIdolsMatchesToArchived,
  archiveTheIdolsSeason,
} from './theIdolsLogic';
import {
  drawGroups,
  buildKnockoutBracket,
  calculateGroupStandings,
  simulateGroupMatchScore,
  syncAllMatchesToDatabase,
} from './tournamentLogic';
import {
  simulateSeriesMatches,
} from './ratingHelper';
import { getEffectiveIdolRating } from './formHelper';

export interface SeasonSimulationSummary {
  seasonNumber: number;
  seasonName: string;
  completedAt: string;
  totalMatchesSimulated: number;
  postseasonFormat: PostseasonFormatType;
  qualifiersCount: number;
  qualifiers: LeagueQualifierEntry[];

  // 1. Champions Tournament (Postseason)
  championsTournament: {
    championIdol?: Idol;
    runnerUpIdol?: Idol;
    thirdPlaceIdol?: Idol;
    fourthPlaceIdol?: Idol;
    grandFinalScore?: {
      idolAName: string;
      idolBName: string;
      scoreA: number;
      scoreB: number;
      winnerName: string;
    };
    thirdPlaceScore?: {
      idolAName: string;
      idolBName: string;
      scoreA: number;
      scoreB: number;
      winnerName: string;
    };
    groups: Group[];
    knockoutMatches: KnockoutMatch[];
    goldenBoot?: {
      idol: Idol;
      goals: number;
    };
  };

  // 2. 6-Division Leagues
  leagues: {
    leagueId: number;
    name: string;
    tierName: string;
    color: string;
    logoUrl: string;
    description: string;
    championIdol?: Idol;
    runnerUpIdol?: Idol;
    thirdPlaceIdol?: Idol;
    standings: LeagueStanding[];
    topScorer?: { idol: Idol; goals: number };
    totalMatches: number;
  }[];

  // 3. Play-In Stages
  wildcardPlayIn?: {
    qualifierA?: Idol;
    qualifierB?: Idol;
    totalMatches: number;
  };
  swissPlayIn?: {
    totalMatches: number;
    qualifiersCount: number;
    isCompleted: boolean;
    directQualifiersCount: number;
    lastChanceQualifiersCount: number;
  };

  // 4. The Idols Superleague & Masters
  theIdols?: {
    superleagueWinner?: Idol;
    mastersChampion?: Idol;
    mastersRunnerUp?: Idol;
    thirdPlace?: Idol;
    fourthPlace?: Idol;
    mvp?: Idol;
    topScorer?: { idol: Idol; goals: number };
    standings: TheIdolsStanding[];
    playoffMatches: TheIdolsPlayoffMatch[];
  };

  // Official Archive Records
  tournamentArchive: TournamentArchive;
  leagueArchive: LeagueSeasonArchive;
  theIdolsArchive: TheIdolsSeasonArchive;
  updatedTournamentArchives: TournamentArchive[];
  updatedLeagueArchives: LeagueSeasonArchive[];
  updatedTheIdolsArchives: TheIdolsSeasonArchive[];

  // States to persist
  updatedAppState: AppState;
  updatedLeagueState: LeagueSeasonState;
  updatedTheIdolsState: TheIdolsSeasonState;
  syncedMatchDatabase: ArchivedMatch[];
}

/**
 * Simulates an entire season across ALL formats in a single pass:
 * 1. 6 Parallel Divisions (Double round-robin, 38 matchdays per division)
 * 2. Wildcard Play-In (6th place contenders playoff for the 2 final spots)
 * 3. Champions Tournament Group Stage (32 qualifiers, 8 groups of 4)
 * 4. Champions Tournament Knockout Bracket (R16 -> QF -> SF -> 3rd Place -> Grand Final)
 * 5. The Idols Superleague (Top 20 idols by rating, 38 matchdays) + Masters Playoff (Top 10)
 * 6. Synchronizes everything into the permanent match database
 */
export function simulateEntireSeason(
  currentAppState: AppState,
  currentLeagueState: LeagueSeasonState | null,
  currentTheIdolsState: TheIdolsSeasonState | null,
  customSeasonName?: string,
  chosenPostseasonFormat?: PostseasonFormatType,
  externalLeagueArchives?: LeagueSeasonArchive[],
  externalTheIdolsArchives?: TheIdolsSeasonArchive[]
): SeasonSimulationSummary {
  const idols = [...currentAppState.idols];
  const girlGroups = [...currentAppState.girlGroups];
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  const seasonNumber = Number(
    currentAppState.config.seasonNumber ||
      currentAppState.config.seasonId ||
      currentLeagueState?.seasonNumber ||
      1
  );

  const resolvedSeasonName =
    customSeasonName?.trim() ||
    currentAppState.config.seasonName ||
    currentAppState.config.customTournamentTitle ||
    `Season ${seasonNumber}`;

  // Default to 64 Qualifiers (Grand Cup 64)
  const resolvedPostseasonFormat: PostseasonFormatType =
    chosenPostseasonFormat ||
    currentLeagueState?.postseasonFormat ||
    'grand_cup_64';

  let totalSimulatedMatchesCount = 0;

  // -------------------------------------------------------------
  // PHASE 1: 6 PARALLEL DIVISIONS (LEAGUE SYSTEM)
  // -------------------------------------------------------------
  const leagueSeason: LeagueSeasonState = currentLeagueState
    ? { ...currentLeagueState, leagues: currentLeagueState.leagues.map((l) => ({ ...l })) }
    : initializeLeagueSeason(idols, girlGroups, seasonNumber);

  // Apply custom branding
  const brandingDefs = loadCustomLeagueBranding();

  const simulatedLeagues = leagueSeason.leagues.map((league) => {
    const customDef = brandingDefs.find((b) => b.id === league.id);
    const defaultDef = DEFAULT_LEAGUE_DEFS.find((d) => d.id === league.id) || DEFAULT_LEAGUE_DEFS[0];

    const rollingFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();
    (league.standings || []).forEach((st) =>
      rollingFormMap.set(st.idolId, [...(st.form || [])])
    );

    const allMatches = [...league.matches];
    const matchdays = Array.from(new Set(allMatches.map((m) => m.matchday))).sort(
      (a, b) => a - b
    );

    matchdays.forEach((md) => {
      const mdMatches = allMatches.filter((m) => m.matchday === md);
      mdMatches.forEach((match) => {
        if (match.completed) return; // already completed

        const idolA = idolsMap.get(match.idolAId);
        const idolB = idolsMap.get(match.idolBId);
        if (!idolA || !idolB) return;

        const formA = rollingFormMap.get(idolA.id) || [];
        const formB = rollingFormMap.get(idolB.id) || [];
        const sim = simulateLeagueMatch(idolA, idolB, formA, formB);

        const idx = allMatches.findIndex((m) => m.id === match.id);
        if (idx !== -1) {
          allMatches[idx] = {
            ...match,
            scoreA: sim.scoreA,
            scoreB: sim.scoreB,
            winnerId: sim.scoreA === sim.scoreB ? null : sim.winnerId,
            completed: true,
            updatedAt: new Date().toISOString(),
          };
          totalSimulatedMatchesCount++;
        }

        // Update form history
        const curA = rollingFormMap.get(idolA.id) || [];
        const curB = rollingFormMap.get(idolB.id) || [];
        if (sim.scoreA > sim.scoreB) {
          curA.push('W');
          curB.push('L');
        } else if (sim.scoreB > sim.scoreA) {
          curA.push('L');
          curB.push('W');
        } else {
          curA.push('D');
          curB.push('D');
        }
        rollingFormMap.set(idolA.id, curA.slice(-5));
        rollingFormMap.set(idolB.id, curB.slice(-5));
      });
    });

    const updatedStandings = calculateLeagueStandings(
      league.id,
      league.memberIds,
      allMatches,
      idols
    );

    return {
      ...league,
      name: customDef?.name || league.name || defaultDef.name,
      tierName: customDef?.tierName || league.tierName || defaultDef.tierName,
      color: customDef?.color || league.color || defaultDef.color,
      logoUrl: customDef?.logoUrl || league.logoUrl || defaultDef.logoUrl,
      description: customDef?.description || league.description || defaultDef.description,
      matches: allMatches,
      standings: updatedStandings,
    };
  });

  leagueSeason.leagues = simulatedLeagues;
  leagueSeason.isCompleted = true;
  leagueSeason.seasonName = resolvedSeasonName;
  leagueSeason.postseasonFormat = resolvedPostseasonFormat;

  // -------------------------------------------------------------
  // PHASE 2 & 3: PLAY-IN STAGE & QUALIFIERS ADVANCEMENT
  // -------------------------------------------------------------
  let qualifiers: LeagueQualifierEntry[] = [];
  let swissPlayIn = leagueSeason.swissPlayIn;
  let wildcardPlayIn = leagueSeason.wildcardPlayIn;

  if (resolvedPostseasonFormat === 'grand_cup_64') {
    // Grand Cup 64: 36 Direct Top 6 + 28 Swiss Play-In Qualifiers = 64
    if (!swissPlayIn || !swissPlayIn.pools || Object.keys(swissPlayIn.pools).length === 0) {
      swissPlayIn = generateSwissPlayIn(leagueSeason.leagues, idols);
    }
    swissPlayIn = simulateAllSwissMatches(swissPlayIn, idols);
    leagueSeason.swissPlayIn = swissPlayIn;

    // Count simulated Swiss & Last Chance matches
    const swissMatchesCount =
      (swissPlayIn.matches || []).filter((m) => m.completed).length +
      (swissPlayIn.lastChanceMatches || []).filter((m) => m.completed).length;
    totalSimulatedMatchesCount += swissMatchesCount;

    // v4: ranks 1-6 qualify directly, so the legacy 6th-place Wildcard Play-In is NOT played in this format.
    qualifiers = getGrandCup64Qualifiers(leagueSeason.leagues, idols, swissPlayIn);
  } else {
    // Classic 32: 30 Direct Top 5 + 2 Wildcard Play-In Qualifiers = 32
    if (!wildcardPlayIn || !wildcardPlayIn.matches || wildcardPlayIn.matches.length === 0) {
      wildcardPlayIn = generateWildcardPlayIn(leagueSeason.leagues, idols);
    }
    wildcardPlayIn = simulateAllWildcardMatches(wildcardPlayIn, idols);
    leagueSeason.wildcardPlayIn = wildcardPlayIn;
    totalSimulatedMatchesCount += (wildcardPlayIn.matches || []).filter((m) => m.completed).length;

    qualifiers = getTop32Qualifiers(leagueSeason.leagues, idols, wildcardPlayIn);
  }

  const qualifierIds = qualifiers.map((q) => q.idolId);
  leagueSeason.championsAdvancementDone = true;

  const is64 = resolvedPostseasonFormat === 'grand_cup_64';
  const tournamentConfig: TournamentConfig = {
    ...currentAppState.config,
    seasonId: seasonNumber,
    seasonNumber: seasonNumber,
    seasonName: resolvedSeasonName,
    customTournamentTitle: resolvedSeasonName,
    totalParticipants: (is64 ? 64 : 32) as 32 | 64,
    numGroups: is64 ? 16 : 8,
    participantsPerGroup: 4,
    qualifiedPerGroup: 2,
    isStarted: true,
    isGroupStageFinished: true,
    isKnockoutFinished: true,
  };

  // Draw groups of 4 (16 groups for 64, 8 groups for 32)
  const drawnGroups = drawGroups(idols, qualifierIds, tournamentConfig);

  // Simulate all group stage matches
  const simulatedGroups = drawnGroups.map((group) => {
    const rollingFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();
    const updatedMatches = group.matches.map((m) => {
      if (m.completed && m.scoreA !== null && m.scoreB !== null) {
        return m;
      }
      const idolA = idolsMap.get(m.idolAId);
      const idolB = idolsMap.get(m.idolBId);
      if (!idolA || !idolB) return m;

      const formA = rollingFormMap.get(idolA.id) || [];
      const formB = rollingFormMap.get(idolB.id) || [];

      const sim = simulateGroupMatchScore(idolA, idolB, formA, formB);

      totalSimulatedMatchesCount++;

      // Update rolling form
      const curA = rollingFormMap.get(idolA.id) || [];
      const curB = rollingFormMap.get(idolB.id) || [];
      if (sim.scoreA > sim.scoreB) {
        curA.push('W');
        curB.push('L');
      } else if (sim.scoreB > sim.scoreA) {
        curA.push('L');
        curB.push('W');
      } else {
        curA.push('D');
        curB.push('D');
      }
      rollingFormMap.set(idolA.id, curA.slice(-5));
      rollingFormMap.set(idolB.id, curB.slice(-5));

      return {
        ...m,
        scoreA: sim.scoreA,
        scoreB: sim.scoreB,
        winnerId: sim.winnerSlot === 'A' ? m.idolAId : sim.winnerSlot === 'B' ? m.idolBId : null,
        completed: true,
      };
    });

    const standings = calculateGroupStandings(group.memberIds, updatedMatches, 2);

    return {
      ...group,
      matches: updatedMatches,
      standings,
    };
  });

  // -------------------------------------------------------------
  // PHASE 4: KNOCKOUT BRACKET (ROUND OF 16 TO GRAND FINAL)
  // -------------------------------------------------------------
  const initialKnockout = buildKnockoutBracket(simulatedGroups, tournamentConfig, idolsMap);
  const knockoutMatches: KnockoutMatch[] = initialKnockout.map((km) => ({ ...km }));
  const koFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();

  const roundIndices = Array.from(new Set(knockoutMatches.map((m) => m.roundIndex))).sort(
    (a, b) => a - b
  );

  for (const rIdx of roundIndices) {
    const currentRoundMatches = knockoutMatches.filter((m) => m.roundIndex === rIdx);

    for (const m of currentRoundMatches) {
      if (m.idolAId && m.idolBId && !m.completed) {
        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);

        const formA = koFormMap.get(m.idolAId) || [];
        const formB = koFormMap.get(m.idolBId) || [];

        const effA = getEffectiveIdolRating(idolA, formA);
        const effB = getEffectiveIdolRating(idolB, formB);

        const isFinal =
          (m.roundName || '').toLowerCase().includes('grand final') ||
          (m.roundName || '').toLowerCase().includes('third');

        const targetWins = isFinal ? 4 : 3; // Best of 7 for finals, best of 5 earlier
        const { scoreA, scoreB, winnerIdIsA } = simulateSeriesMatches(
          effA.effectiveRating,
          effB.effectiveRating,
          targetWins
        );

        const winnerId = winnerIdIsA ? m.idolAId : m.idolBId;
        const loserId = winnerIdIsA ? m.idolBId : m.idolAId;

        m.scoreA = scoreA;
        m.scoreB = scoreB;
        m.winnerId = winnerId;
        m.completed = true;
        totalSimulatedMatchesCount++;

        // Update form tracker
        const curA = koFormMap.get(m.idolAId) || [];
        const curB = koFormMap.get(m.idolBId) || [];
        curA.push(winnerIdIsA ? 'W' : 'L');
        curB.push(winnerIdIsA ? 'L' : 'W');
        koFormMap.set(m.idolAId, curA.slice(-5));
        koFormMap.set(m.idolBId, curB.slice(-5));

        // Feed winner into next match
        if (m.feedsIntoMatchId) {
          const nextMatch = knockoutMatches.find((nm) => nm.id === m.feedsIntoMatchId);
          if (nextMatch) {
            if (m.feedsIntoSlot === 'A') {
              nextMatch.idolAId = winnerId;
            } else if (m.feedsIntoSlot === 'B') {
              nextMatch.idolBId = winnerId;
            }
          }
        }

        // If semi-final, feed loser into 3rd place match if present
        const isSemi = (m.roundName || '').toLowerCase().includes('semi');
        if (isSemi) {
          const thirdMatch = knockoutMatches.find(
            (nm) =>
              Boolean(nm.isThirdPlaceMatch) ||
              (nm.roundName || '').toLowerCase().includes('3rd') ||
              (nm.roundName || '').toLowerCase().includes('third')
          );
          if (thirdMatch) {
            if (m.matchNumber === 1 || m.id.endsWith('1')) {
              thirdMatch.idolAId = loserId;
            } else {
              thirdMatch.idolBId = loserId;
            }
          }
        }
      }
    }
  }

  // Find Champions Tournament Grand Final & 3rd Place match
  const grandFinalMatch = knockoutMatches.find(
    (m) =>
      !m.isThirdPlaceMatch &&
      !(m.roundName || '').toLowerCase().includes('3rd') &&
      !(m.roundName || '').toLowerCase().includes('third') &&
      !(m.roundName || '').toLowerCase().includes('bronze') &&
      ((m.roundName || '').toLowerCase().includes('grand final') ||
        (m.roundName || '').toLowerCase() === 'final' ||
        ((m.roundName || '').toLowerCase().includes('final') &&
          !(m.roundName || '').toLowerCase().includes('semi') &&
          !(m.roundName || '').toLowerCase().includes('quarter')))
  );

  const thirdPlaceMatch = knockoutMatches.find(
    (m) =>
      Boolean(m.isThirdPlaceMatch) ||
      (m.roundName || '').toLowerCase().includes('3rd') ||
      (m.roundName || '').toLowerCase().includes('third') ||
      (m.roundName || '').toLowerCase().includes('bronze')
  );

  const championId = grandFinalMatch?.winnerId || '';
  const runnerUpId =
    grandFinalMatch?.winnerId === grandFinalMatch?.idolAId
      ? grandFinalMatch?.idolBId || ''
      : grandFinalMatch?.idolAId || '';
  const thirdPlaceId = thirdPlaceMatch?.winnerId || '';
  const fourthPlaceId =
    thirdPlaceMatch && thirdPlaceMatch.winnerId
      ? thirdPlaceMatch.winnerId === thirdPlaceMatch.idolAId
        ? thirdPlaceMatch.idolBId || ''
        : thirdPlaceMatch.idolAId || ''
      : '';

  const grandFinalScore = grandFinalMatch
    ? {
        idolAName: idolsMap.get(grandFinalMatch.idolAId || '')?.name || 'TBD',
        idolBName: idolsMap.get(grandFinalMatch.idolBId || '')?.name || 'TBD',
        scoreA: grandFinalMatch.scoreA ?? 0,
        scoreB: grandFinalMatch.scoreB ?? 0,
        winnerName: idolsMap.get(grandFinalMatch.winnerId || '')?.name || 'Unknown',
      }
    : undefined;

  const thirdPlaceScore = thirdPlaceMatch
    ? {
        idolAName: idolsMap.get(thirdPlaceMatch.idolAId || '')?.name || 'TBD',
        idolBName: idolsMap.get(thirdPlaceMatch.idolBId || '')?.name || 'TBD',
        scoreA: thirdPlaceMatch.scoreA ?? 0,
        scoreB: thirdPlaceMatch.scoreB ?? 0,
        winnerName: idolsMap.get(thirdPlaceMatch.winnerId || '')?.name || 'Unknown',
      }
    : undefined;

  // -------------------------------------------------------------
  // PHASE 5: THE IDOLS SUPERLEAGUE (20 IDOLS) & MASTERS PLAYOFF
  // -------------------------------------------------------------
  const theIdolsSeason: TheIdolsSeasonState =
    currentTheIdolsState && (currentTheIdolsState.memberIds || []).length === 20
      ? { ...currentTheIdolsState }
      : initializeTheIdolsSeason(idols, seasonNumber, girlGroups);

  theIdolsSeason.seasonName = `The Idols: ${resolvedSeasonName}`;

  // Simulate all 38 matchdays of The Idols Superleague
  let theIdolsMatches = [...theIdolsSeason.matches];
  let theIdolsStandings = [...theIdolsSeason.standings];
  const sortedTiMatches = [...theIdolsMatches].sort((a, b) => a.matchday - b.matchday);

  sortedTiMatches.forEach((match) => {
    if (match.completed) return;
    const idolA = idolsMap.get(match.idolAId);
    const idolB = idolsMap.get(match.idolBId);
    if (!idolA || !idolB) return;

    const standingA = theIdolsStandings.find((s) => s.idolId === idolA.id);
    const standingB = theIdolsStandings.find((s) => s.idolId === idolB.id);

    const result = simulateTheIdolsMatch(
      idolA,
      idolB,
      standingA?.form || [],
      standingB?.form || []
    );

    theIdolsMatches = theIdolsMatches.map((m) =>
      m.id === match.id
        ? {
            ...m,
            scoreA: result.scoreA,
            scoreB: result.scoreB,
            winnerId: result.winnerId,
            completed: true,
            updatedAt: new Date().toISOString(),
          }
        : m
    );
    totalSimulatedMatchesCount++;
    theIdolsStandings = calculateTheIdolsStandings(
      theIdolsSeason.memberIds,
      theIdolsMatches,
      idols
    );
  });

  theIdolsSeason.matches = theIdolsMatches;
  theIdolsSeason.standings = theIdolsStandings;
  theIdolsSeason.currentMatchday = 38;
  theIdolsSeason.isLeagueCompleted = true;

  // Simulate entire Masters Playoff (Top 10)
  let theIdolsPlayoffs = recalculateTheIdolsPlayoff(
    theIdolsSeason.playoffMatches,
    theIdolsStandings
  );

  for (let iter = 0; iter < 25; iter++) {
    let simulatedAny = false;
    for (const m of theIdolsPlayoffs) {
      if (!m.completed && m.idolAId && m.idolBId) {
        if (m.id === 'ti_po_gf_set2' && !m.isResetActive) {
          continue;
        }
        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);
        if (!idolA || !idolB) continue;

        const stA = theIdolsStandings.find((s) => s.idolId === idolA.id);
        const stB = theIdolsStandings.find((s) => s.idolId === idolB.id);

        const res = simulateTheIdolsPlayoffSeries(
          idolA,
          idolB,
          m.bestOf,
          stA?.form || [],
          stB?.form || []
        );

        theIdolsPlayoffs = theIdolsPlayoffs.map((item) =>
          item.id === m.id
            ? {
                ...item,
                scoreA: res.scoreA,
                scoreB: res.scoreB,
                winnerId: res.winnerId,
                loserId: res.loserId,
                completed: true,
                updatedAt: new Date().toISOString(),
              }
            : item
        );
        theIdolsPlayoffs = recalculateTheIdolsPlayoff(theIdolsPlayoffs, theIdolsStandings);
        simulatedAny = true;
        totalSimulatedMatchesCount++;
        break; // restart loop after bracket propagation
      }
    }
    if (!simulatedAny) break;
  }

  theIdolsSeason.playoffMatches = theIdolsPlayoffs;
  theIdolsSeason.isPlayoffCompleted = true;

  const theIdolsHonors = computeTheIdolsHonors(theIdolsSeason, idols);
  theIdolsSeason.championId = theIdolsHonors.championId;
  theIdolsSeason.championName = theIdolsHonors.championName;
  theIdolsSeason.runnerUpId = theIdolsHonors.runnerUpId;
  theIdolsSeason.runnerUpName = theIdolsHonors.runnerUpName;
  theIdolsSeason.thirdPlaceId = theIdolsHonors.thirdPlaceId;
  theIdolsSeason.thirdPlaceName = theIdolsHonors.thirdPlaceName;
  theIdolsSeason.mvpId = theIdolsHonors.mvpId;
  theIdolsSeason.mvpName = theIdolsHonors.mvpName;
  theIdolsSeason.topScorerId = theIdolsHonors.topScorerId;
  theIdolsSeason.topScorerName = theIdolsHonors.topScorerName;

  // -------------------------------------------------------------
  // BUILD OFFICIAL ARCHIVE RECORDS FOR ALL FORMATS
  // -------------------------------------------------------------
  const championName = (championId && idolsMap.get(championId)?.name) || 'Unknown';
  const runnerUpName = (runnerUpId && idolsMap.get(runnerUpId)?.name) || '';
  const thirdPlaceName = (thirdPlaceId && idolsMap.get(thirdPlaceId)?.name) || '';
  const fourthPlaceName = (fourthPlaceId && idolsMap.get(fourthPlaceId)?.name) || '';

  const tournamentArchive: TournamentArchive = {
    seasonId: seasonNumber,
    seasonName: resolvedSeasonName,
    completedAt: new Date().toISOString(),
    championId,
    championName,
    runnerUpId,
    runnerUpName,
    thirdPlaceId,
    thirdPlaceName,
    fourthPlaceId,
    fourthPlaceName,
    totalParticipants: tournamentConfig.totalParticipants,
    groups: simulatedGroups,
    knockoutMatches,
  };

  const leagueArchive = archiveLeagueSeason(leagueSeason, idols);
  const theIdolsArchive = archiveTheIdolsSeason(theIdolsSeason, idols);

  const existingLeagueArchives = externalLeagueArchives || currentAppState.leagueArchives || [];
  const existingTheIdolsArchives = externalTheIdolsArchives || currentAppState.theIdolsArchives || [];

  const updatedTournamentArchives: TournamentArchive[] = [
    ...(currentAppState.archives || []).filter((a) => Number(a.seasonId) !== seasonNumber),
    tournamentArchive,
  ];

  const updatedLeagueArchives: LeagueSeasonArchive[] = [
    ...existingLeagueArchives.filter((a) => a.seasonNumber !== leagueSeason.seasonNumber),
    leagueArchive,
  ];

  const updatedTheIdolsArchives: TheIdolsSeasonArchive[] = [
    ...existingTheIdolsArchives.filter((a) => a.seasonNumber !== theIdolsSeason.seasonNumber),
    theIdolsArchive,
  ];

  // -------------------------------------------------------------
  // SYNC ALL MATCHES TO UNIFIED MATCH DATABASE
  // -------------------------------------------------------------
  const syncedTournamentMatches = syncAllMatchesToDatabase(
    currentAppState.matchDatabase || [],
    updatedTournamentArchives,
    tournamentConfig,
    simulatedGroups,
    knockoutMatches,
    idols
  );

  const syncedLeagueMatches = syncLeagueMatchesToArchivedMatches(
    leagueSeason,
    updatedLeagueArchives,
    idols
  );

  const syncedTheIdolsMatches = convertTheIdolsMatchesToArchived(
    theIdolsSeason,
    idols,
    updatedTheIdolsArchives
  );

  const unifiedDbMap = new Map<string, ArchivedMatch>();
  // Seed with all existing historical matches (excluding previous unarchived runs of this same season to prevent match duplicates on re-simulation)
  (currentAppState.matchDatabase || []).forEach((m) => {
    if (m && m.matchId && Number(m.seasonId) !== seasonNumber) {
      unifiedDbMap.set(m.matchId, m);
    }
  });
  syncedTournamentMatches.forEach((m) => {
    if (m && m.matchId) unifiedDbMap.set(m.matchId, m);
  });
  syncedLeagueMatches.forEach((m) => {
    if (m && m.matchId) unifiedDbMap.set(m.matchId, m);
  });
  syncedTheIdolsMatches.forEach((m) => {
    if (m && m.matchId) unifiedDbMap.set(m.matchId, m);
  });
  const finalMatchDatabase = Array.from(unifiedDbMap.values());

  const updatedAppState: AppState = {
    ...currentAppState,
    archives: updatedTournamentArchives,
    leagueArchives: updatedLeagueArchives,
    theIdolsArchives: updatedTheIdolsArchives,
    config: {
      ...tournamentConfig,
      isStarted: true,
      isGroupStageFinished: true,
      isKnockoutFinished: true,
    },
    selectedParticipantIds: qualifierIds,
    groups: simulatedGroups,
    knockoutMatches,
    matchDatabase: finalMatchDatabase,
    leagueState: leagueSeason,
    theIdolsState: theIdolsSeason,
  };

  // Build Leagues Summary with accurate data
  const leaguesSummary = simulatedLeagues.map((l) => {
    const champ = l.standings && l.standings.length > 0 ? idolsMap.get(l.standings[0].idolId) : undefined;
    const runnerUp = l.standings && l.standings.length > 1 ? idolsMap.get(l.standings[1].idolId) : undefined;
    const third = l.standings && l.standings.length > 2 ? idolsMap.get(l.standings[2].idolId) : undefined;

    // Top scorer in league
    let topScorer: { idol: Idol; goals: number } | undefined;
    if (l.standings && l.standings.length > 0) {
      const highestGoals = [...l.standings].sort((a, b) => (b.gamesFor || 0) - (a.gamesFor || 0))[0];
      if (highestGoals && highestGoals.gamesFor > 0) {
        const scorerIdol = idolsMap.get(highestGoals.idolId);
        if (scorerIdol) {
          topScorer = { idol: scorerIdol, goals: highestGoals.gamesFor };
        }
      }
    }

    return {
      leagueId: l.id,
      name: l.name,
      tierName: l.tierName,
      color: l.color,
      logoUrl: l.logoUrl || '',
      description: l.description,
      championIdol: champ,
      runnerUpIdol: runnerUp,
      thirdPlaceIdol: third,
      standings: l.standings || [],
      topScorer,
      totalMatches: l.matches.length,
    };
  });

  // Calculate Golden Boot across Champions Tournament
  const tournamentGoalsMap = new Map<string, number>();
  simulatedGroups.forEach((g) => {
    g.matches.forEach((m) => {
      if (m.completed) {
        if (m.idolAId) {
          tournamentGoalsMap.set(
            m.idolAId,
            (tournamentGoalsMap.get(m.idolAId) || 0) + (m.scoreA || 0)
          );
        }
        if (m.idolBId) {
          tournamentGoalsMap.set(
            m.idolBId,
            (tournamentGoalsMap.get(m.idolBId) || 0) + (m.scoreB || 0)
          );
        }
      }
    });
  });
  knockoutMatches.forEach((m) => {
    if (m.completed) {
      if (m.idolAId) {
        tournamentGoalsMap.set(
          m.idolAId,
          (tournamentGoalsMap.get(m.idolAId) || 0) + (m.scoreA || 0)
        );
      }
      if (m.idolBId) {
        tournamentGoalsMap.set(
          m.idolBId,
          (tournamentGoalsMap.get(m.idolBId) || 0) + (m.scoreB || 0)
        );
      }
    }
  });

  let goldenBootIdol: Idol | undefined;
  let maxGoals = 0;
  tournamentGoalsMap.forEach((goals, idolId) => {
    if (goals > maxGoals) {
      maxGoals = goals;
      goldenBootIdol = idolsMap.get(idolId);
    }
  });

  return {
    seasonNumber,
    seasonName: resolvedSeasonName,
    completedAt: new Date().toISOString(),
    totalMatchesSimulated: totalSimulatedMatchesCount,
    postseasonFormat: resolvedPostseasonFormat,
    qualifiersCount: qualifierIds.length,
    qualifiers,
    championsTournament: {
      championIdol: idolsMap.get(championId),
      runnerUpIdol: idolsMap.get(runnerUpId),
      thirdPlaceIdol: idolsMap.get(thirdPlaceId),
      fourthPlaceIdol: idolsMap.get(fourthPlaceId),
      grandFinalScore,
      thirdPlaceScore,
      groups: simulatedGroups,
      knockoutMatches,
      goldenBoot: goldenBootIdol ? { idol: goldenBootIdol, goals: maxGoals } : undefined,
    },
    leagues: leaguesSummary,
    wildcardPlayIn: {
      qualifierA: wildcardPlayIn?.qualifier1Id ? idolsMap.get(wildcardPlayIn.qualifier1Id) : undefined,
      qualifierB: wildcardPlayIn?.qualifier2Id ? idolsMap.get(wildcardPlayIn.qualifier2Id) : undefined,
      totalMatches: wildcardPlayIn?.matches?.length || 0,
    },
    swissPlayIn: swissPlayIn
      ? {
          totalMatches:
            (swissPlayIn.matches || []).filter((m) => m.completed).length +
            (swissPlayIn.lastChanceMatches || []).filter((m) => m.completed).length,
          qualifiersCount: (swissPlayIn.allQualifiers || []).length,
          isCompleted: swissPlayIn.isCompleted,
          directQualifiersCount: (swissPlayIn.directQualifiers || []).length,
          lastChanceQualifiersCount: (swissPlayIn.lastChanceQualifiers || []).length,
        }
      : undefined,
    theIdols: {
      superleagueWinner: theIdolsStandings.length > 0 ? idolsMap.get(theIdolsStandings[0].idolId) : undefined,
      mastersChampion: theIdolsHonors.championId ? idolsMap.get(theIdolsHonors.championId) : undefined,
      mastersRunnerUp: theIdolsHonors.runnerUpId ? idolsMap.get(theIdolsHonors.runnerUpId) : undefined,
      thirdPlace: theIdolsHonors.thirdPlaceId ? idolsMap.get(theIdolsHonors.thirdPlaceId) : undefined,
      fourthPlace: theIdolsHonors.fourthPlaceId ? idolsMap.get(theIdolsHonors.fourthPlaceId) : undefined,
      mvp: theIdolsHonors.mvpId ? idolsMap.get(theIdolsHonors.mvpId) : undefined,
      topScorer: theIdolsHonors.topScorerId
        ? {
            idol: idolsMap.get(theIdolsHonors.topScorerId) || idols[0],
            goals: theIdolsHonors.topScorerGoals || 0,
          }
        : undefined,
      standings: theIdolsStandings,
      playoffMatches: theIdolsPlayoffs,
    },
    tournamentArchive,
    leagueArchive,
    theIdolsArchive,
    updatedTournamentArchives,
    updatedLeagueArchives,
    updatedTheIdolsArchives,
    updatedAppState,
    updatedLeagueState: leagueSeason,
    updatedTheIdolsState: theIdolsSeason,
    syncedMatchDatabase: finalMatchDatabase,
  };
}
