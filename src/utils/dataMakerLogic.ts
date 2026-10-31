import { Idol, LeagueSeasonState, LeagueSeasonArchive, LeagueStanding } from '../types';
import { DataMakerDrawMode, DataMakerOutputFormat } from './developmentGates';
import { getIdolRating } from './ratingHelper';

export interface PyramidRankedIdol {
  rank: number;
  idol: Idol;
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  rating: number;
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
  currentDivisionId?: number;
}

export interface PotTier {
  potNumber: number; // 1 to 20
  rankStart: number; // e.g. 1
  rankEnd: number;   // e.g. 6
  idols: PyramidRankedIdol[];
  assignedLeagueIds?: number[]; // [1, 2, 3, 4, 5, 6]
}

export interface GeneratedDataList {
  listIndex: number; // 0 to 5
  leagueId: number;  // 1 to 6
  leagueName: string;
  color: string;
  idols: PyramidRankedIdol[];
  formattedText: string; // 1 name per line
  averageRating: number;
  totalCareerPoints: number;
}

export interface DataMakerResult {
  timestamp: number;
  drawMode: DataMakerDrawMode;
  rankingMetric: string;
  pots: PotTier[];
  lists: GeneratedDataList[];
  allRankedIdols: PyramidRankedIdol[];
}

/**
 * Calculates career statistics across all active and archived league pyramid seasons,
 * returning all 120 idols ranked from #1 to #120.
 */
export function getLeaguePyramidRankedIdols(
  allIdols: Idol[],
  leagueState?: LeagueSeasonState | null,
  leagueArchives?: LeagueSeasonArchive[],
  metric: 'career_points' | 'division_titles' | 'win_rate' | 'overall_rating' | 'champions_qualifiers' = 'career_points'
): PyramidRankedIdol[] {
  const idolsMap = new Map<string, Idol>();
  allIdols.forEach((i) => idolsMap.set(i.id, i));

  // Determine current division assignments
  const currentDivMap = new Map<string, number>();
  if (leagueState?.leagues) {
    leagueState.leagues.forEach((l) => {
      l.memberIds.forEach((id) => currentDivMap.set(id, l.id));
    });
  }

  const statMap = new Map<
    string,
    {
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
    }
  >();

  const getOrInit = (id: string) => {
    if (!statMap.has(id)) {
      statMap.set(id, {
        divisionTitles: 0,
        podiums: 0,
        championsQualifiers: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
      });
    }
    return statMap.get(id)!;
  };

  // 1. Process active season
  if (leagueState && Array.isArray(leagueState.leagues)) {
    const isSeasonFinished = Boolean(leagueState.isCompleted);
    leagueState.leagues.forEach((league) => {
      (league.standings || []).forEach((entry) => {
        const st = getOrInit(entry.idolId);
        const played = entry.played || 0;
        st.matches += played;
        st.wins += entry.wins || 0;
        st.draws += entry.draws || 0;
        st.losses += entry.losses || 0;
        st.points += entry.points || 0;
        st.goalsFor += entry.gamesFor || 0;
        st.goalsAgainst += entry.gamesAgainst || 0;
        st.goalDiff += entry.gameDiff || 0;

        if (isSeasonFinished && played > 0) {
          if (entry.rank === 1) st.divisionTitles += 1;
          if (entry.rank <= 3) st.podiums += 1;
          if (entry.rank <= 5) st.championsQualifiers += 1;
        }
      });
    });
  }

  // 2. Process historical archives
  (leagueArchives || []).forEach((arch) => {
    let processedStandings = false;
    const titlesAwarded = new Set<string>();

    if (arch?.allStandings && Object.keys(arch.allStandings).length > 0) {
      processedStandings = true;
      Object.entries(arch.allStandings).forEach(([, standingsList]) => {
        const list = (standingsList as LeagueStanding[]) || [];
        list.forEach((entry) => {
          const st = getOrInit(entry.idolId);
          const played = entry.played || 0;
          st.matches += played;
          st.wins += entry.wins || 0;
          st.draws += entry.draws || 0;
          st.losses += entry.losses || 0;
          st.points += entry.points || 0;
          st.goalsFor += entry.gamesFor || 0;
          st.goalsAgainst += entry.gamesAgainst || 0;
          st.goalDiff += entry.gameDiff || 0;

          if (entry.rank === 1 && played > 0) {
            st.divisionTitles += 1;
            titlesAwarded.add(entry.idolId);
          }
          if (entry.rank <= 3 && played > 0) st.podiums += 1;
          if (entry.rank <= 5 && played > 0) st.championsQualifiers += 1;
        });
      });
    }

    const winners = arch.leagueWinners || (arch as any).leagueChampions || [];
    if (Array.isArray(winners) && !processedStandings) {
      winners.forEach((w: any) => {
        const champId = w.championId || w.idolId;
        if (champId && !titlesAwarded.has(champId)) {
          const st = getOrInit(champId);
          st.divisionTitles += 1;
          st.podiums += 1;
          st.championsQualifiers += 1;
          titlesAwarded.add(champId);
        }
      });
    }
  });

  // 3. Build comprehensive list prioritizing idols assigned in the 6 leagues, then all idols
  const leagueMemberIdSet = new Set<string>();
  if (leagueState?.leagues) {
    leagueState.leagues.forEach((l) => l.memberIds.forEach((id) => leagueMemberIdSet.add(id)));
  }

  // Combine idols: league members first, then other available idols to ensure 120
  const candidateIdols: Idol[] = [];
  const addedIds = new Set<string>();

  // Add league members first
  if (leagueState?.leagues) {
    leagueState.leagues.forEach((l) => {
      l.memberIds.forEach((id) => {
        const idol = idolsMap.get(id);
        if (idol && !addedIds.has(id)) {
          candidateIdols.push(idol);
          addedIds.add(id);
        }
      });
    });
  }

  // Add remaining idols up to at least 120 (or all available)
  allIdols.forEach((idol) => {
    if (!addedIds.has(idol.id)) {
      candidateIdols.push(idol);
      addedIds.add(idol.id);
    }
  });

  // Convert to PyramidRankedIdol
  const ranked: PyramidRankedIdol[] = candidateIdols.map((idol) => {
    const st = statMap.get(idol.id) || {
      divisionTitles: 0,
      podiums: 0,
      championsQualifiers: 0,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
    };
    const rating = getIdolRating(idol);
    const winRate = st.matches > 0 ? Math.round((st.wins / st.matches) * 100) : 0;

    return {
      rank: 0,
      idol,
      idolId: idol.id,
      idolName: idol.name,
      girlGroup: idol.girlGroup || 'Solo',
      nationality: idol.nationality || 'South Korea',
      rating,
      divisionTitles: st.divisionTitles,
      podiums: st.podiums,
      championsQualifiers: st.championsQualifiers,
      matches: st.matches,
      wins: st.wins,
      draws: st.draws,
      losses: st.losses,
      points: st.points,
      goalsFor: st.goalsFor,
      goalsAgainst: st.goalsAgainst,
      goalDiff: st.goalDiff,
      winRate,
      currentDivisionId: currentDivMap.get(idol.id),
    };
  });

  // Sort based on selected ranking metric with comprehensive tiebreakers
  ranked.sort((a, b) => {
    if (metric === 'division_titles') {
      if (b.divisionTitles !== a.divisionTitles) return b.divisionTitles - a.divisionTitles;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.rating !== a.rating) return b.rating - a.rating;
    } else if (metric === 'overall_rating') {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.points !== a.points) return b.points - a.points;
      if (b.divisionTitles !== a.divisionTitles) return b.divisionTitles - a.divisionTitles;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    } else if (metric === 'win_rate') {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.points !== a.points) return b.points - a.points;
      if (b.rating !== a.rating) return b.rating - a.rating;
    } else if (metric === 'champions_qualifiers') {
      if (b.championsQualifiers !== a.championsQualifiers) return b.championsQualifiers - a.championsQualifiers;
      if (b.divisionTitles !== a.divisionTitles) return b.divisionTitles - a.divisionTitles;
      if (b.points !== a.points) return b.points - a.points;
      if (b.rating !== a.rating) return b.rating - a.rating;
    } else {
      // Default: career_points (League Pyramid all-time standard)
      if (b.points !== a.points) return b.points - a.points;
      if (b.divisionTitles !== a.divisionTitles) return b.divisionTitles - a.divisionTitles;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (b.rating !== a.rating) return b.rating - a.rating;
    }

    return a.idolName.localeCompare(b.idolName);
  });

  // Assign 1-indexed ranks
  ranked.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  // Return the top 120 idols
  return ranked.slice(0, 120);
}

/**
 * Formats a single idol according to the requested text style.
 */
export function formatIdolLine(idol: PyramidRankedIdol, format: DataMakerOutputFormat = 'plain_names', index?: number, potNumber?: number): string {
  switch (format) {
    case 'numbered':
      return `${(index ?? 0) + 1}. ${idol.idolName}`;
    case 'with_group':
      return `${idol.idolName} (${idol.girlGroup})`;
    case 'with_rating':
      return `${idol.idolName} [OVR: ${idol.rating}]`;
    case 'with_pot_tag':
      return `${idol.idolName} (Pot ${potNumber || '?'})`;
    case 'plain_names':
    default:
      return idol.idolName;
  }
}

/**
 * Formats an array of idols into a multi-line string (1 name per line).
 */
export function formatListToText(idols: PyramidRankedIdol[], format: DataMakerOutputFormat = 'plain_names', potNumberMap?: Map<string, number>): string {
  return idols
    .map((idol, idx) => formatIdolLine(idol, format, idx, potNumberMap?.get(idol.idolId)))
    .join('\n');
}

/**
 * Fisher-Yates shuffle helper
 */
function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const DEFAULT_LEAGUE_COLORS = ['#3b82f6', '#f97316', '#06b6d4', '#ef4444', '#8b5cf6', '#eab308'];

/**
 * Executes the Pot-Based Draw distribution of the 120 career pyramid idols into 6 lists of 20 idols each.
 *
 * Algorithm:
 * 1. Takes 120 idols, creates 20 Pots of 6 idols each (Pot 1: 1-6, Pot 2: 7-12, ... Pot 20: 115-120).
 * 2. Distributes exactly 1 idol from each Pot to each of the 6 Lists.
 * 3. Supports Random Pot Draw, Snake Seeding, Direct Seeding, and Rating-Weighted Balancing.
 */
export function generatePyramidPotDraw(
  rankedIdols: PyramidRankedIdol[],
  options: {
    drawMode?: DataMakerDrawMode;
    outputFormat?: DataMakerOutputFormat;
    leagueNames?: string[];
    leagueColors?: string[];
    rankingMetric?: string;
  } = {}
): DataMakerResult {
  const drawMode = options.drawMode || 'random_pot';
  const outputFormat = options.outputFormat || 'plain_names';
  const rankingMetric = options.rankingMetric || 'career_points';

  const defaultNames = [
    'Division 1 (Premier League)',
    'Division 2 (Championship)',
    'Division 3 (League One)',
    'Division 4 (League Two)',
    'Division 5 (National)',
    'Division 6 (Regional)',
  ];
  const leagueNames = options.leagueNames || defaultNames;
  const leagueColors = options.leagueColors || DEFAULT_LEAGUE_COLORS;

  const totalIdols = rankedIdols.length;
  const potsCount = 20;
  const idolsPerPot = 6;
  const listsCount = 6;

  // 1. Group into 20 Pots
  const pots: PotTier[] = [];
  const potNumberMap = new Map<string, number>();

  for (let p = 0; p < potsCount; p++) {
    const startIdx = p * idolsPerPot;
    const endIdx = Math.min(startIdx + idolsPerPot, totalIdols);
    const potIdols = rankedIdols.slice(startIdx, endIdx);

    potIdols.forEach((idol) => {
      potNumberMap.set(idol.idolId, p + 1);
    });

    pots.push({
      potNumber: p + 1,
      rankStart: startIdx + 1,
      rankEnd: startIdx + potIdols.length,
      idols: potIdols,
    });
  }

  // 2. Initialize 6 empty lists
  const generatedListsData: PyramidRankedIdol[][] = Array.from({ length: listsCount }, () => []);

  // 3. Distribute each pot across the 6 lists
  pots.forEach((pot, potIdx) => {
    let distribution: PyramidRankedIdol[] = [...pot.idols];

    if (drawMode === 'random_pot') {
      // Random draw from this pot tier
      distribution = shuffleArray(pot.idols);
    } else if (drawMode === 'snake') {
      // Snake order: forward on even pots, backward on odd pots
      if (potIdx % 2 === 1) {
        distribution = [...pot.idols].reverse();
      } else {
        distribution = [...pot.idols];
      }
    } else if (drawMode === 'rating_weighted') {
      // Balance lists by assigning higher seeds in this pot to lists with currently lower average ratings
      const listAverages = generatedListsData.map((list, idx) => {
        const avg = list.length > 0 ? list.reduce((sum, i) => sum + i.rating, 0) / list.length : 0;
        return { idx, avg };
      });
      // Sort lists from lowest current average to highest
      listAverages.sort((a, b) => a.avg - b.avg);

      // Sort pot idols by rating descending
      const sortedPot = [...pot.idols].sort((a, b) => b.rating - a.rating);
      const assigned: PyramidRankedIdol[] = new Array(listsCount);

      sortedPot.forEach((idol, i) => {
        if (i < listAverages.length) {
          const targetListIdx = listAverages[i].idx;
          assigned[targetListIdx] = idol;
        }
      });

      distribution = assigned;
    } else {
      // Direct seeding: Rank 1->L1, 2->L2, ... 6->L6
      distribution = [...pot.idols];
    }

    // Assign 1 idol to each list
    const assignedLeagues: number[] = [];
    for (let listIdx = 0; listIdx < listsCount; listIdx++) {
      const drawnIdol = distribution[listIdx];
      if (drawnIdol) {
        generatedListsData[listIdx].push(drawnIdol);
        assignedLeagues.push(listIdx + 1);
      }
    }
    pot.assignedLeagueIds = assignedLeagues;
  });

  // 4. Construct Final GeneratedDataList objects
  const lists: GeneratedDataList[] = generatedListsData.map((idolsList, idx) => {
    const leagueId = idx + 1;
    const name = leagueNames[idx] || `Division ${leagueId}`;
    const color = leagueColors[idx] || DEFAULT_LEAGUE_COLORS[idx % DEFAULT_LEAGUE_COLORS.length];
    const totalPoints = idolsList.reduce((acc, i) => acc + i.points, 0);
    const avgRating =
      idolsList.length > 0
        ? Math.round((idolsList.reduce((acc, i) => acc + i.rating, 0) / idolsList.length) * 10) / 10
        : 0;

    return {
      listIndex: idx,
      leagueId,
      leagueName: name,
      color,
      idols: idolsList,
      formattedText: formatListToText(idolsList, outputFormat, potNumberMap),
      averageRating: avgRating,
      totalCareerPoints: totalPoints,
    };
  });

  return {
    timestamp: Date.now(),
    drawMode,
    rankingMetric,
    pots,
    lists,
    allRankedIdols: rankedIdols,
  };
}

/**
 * Formats all 6 lists into a unified export text string.
 */
export function formatAllListsCombinedText(
  lists: GeneratedDataList[],
  delimiter: 'section_headers' | 'simple_blank_line' | 'csv_columns' = 'section_headers'
): string {
  if (delimiter === 'simple_blank_line') {
    return lists.map((l) => l.formattedText).join('\n\n');
  }

  if (delimiter === 'csv_columns') {
    // 6 columns side-by-side
    const headers = lists.map((l) => `"${l.leagueName}"`).join(',');
    const rows: string[] = [];
    for (let row = 0; row < 20; row++) {
      const rowCols = lists.map((l) => `"${l.idols[row]?.idolName || ''}"`);
      rows.push(rowCols.join(','));
    }
    return [headers, ...rows].join('\n');
  }

  // Default: section headers
  return lists
    .map((l) => {
      const header = `=== ${l.leagueName.toUpperCase()} (${l.idols.length} IDOLS - AVG OVR: ${l.averageRating}) ===`;
      return `${header}\n${l.formattedText}\n`;
    })
    .join('\n');
}
