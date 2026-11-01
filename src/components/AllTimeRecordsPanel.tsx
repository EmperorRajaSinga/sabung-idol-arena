import React, { useState, useMemo } from 'react';
import { V5CompetitionStatsPanel } from './V5CompetitionStatsPanel';
import {
  CareerStat,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
  Idol,
  TournamentArchive,
  ArchivedMatch,
  MilestoneBadge,
} from '../types';
import {
  Flame,
  Crown,
  Trophy,
  Award,
  Zap,
  Swords,
  Table,
  Star,
  ShieldCheck,
  Medal,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Shield,
  Target,
} from 'lucide-react';
import { loadCareerOverrides, calculateUnifiedTotalTitles } from '../utils/databaseStudioLogic';
import {
  ALL_MILESTONE_BADGES,
  computeAllIdolAchievements,
  IdolAchievementReport,
} from '../utils/achievementEngine';

interface AllTimeRecordsPanelProps {
  careerStats: CareerStat[];
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  idols?: Idol[];
  archives?: TournamentArchive[];
  matchDatabase?: ArchivedMatch[];
}

interface LeagueAggregatedStat {
  idolId: string;
  idolName: string;
  photoUrl?: string;
  girlGroup: string;
  nationality: string;
  leagueTitles: number;
  leagueMatches: number;
  leagueWins: number;
  leagueDraws: number;
  leagueLosses: number;
  leagueGF: number;
  leagueGA: number;
  leagueGD: number;
  leaguePts: number;
  bestSeasonPts: number;
  winRate?: number;
}

interface TheIdolsAggregatedStat {
  idolId: string;
  idolName: string;
  photoUrl?: string;
  girlGroup: string;
  nationality: string;
  theIdolsTitles: number;
  theIdolsMatches: number;
  theIdolsWins: number;
  theIdolsDraws: number;
  theIdolsLosses: number;
  theIdolsGF: number;
  theIdolsGA: number;
  theIdolsGD: number;
  theIdolsPts: number;
  bestSeasonPts: number;
  playoffAppearances: number;
  winRate?: number;
}

type CombinedMetricKey = 'totalTitles' | 'totalWins' | 'totalMatches' | 'winRate' | 'totalGF';

export const AllTimeRecordsPanel: React.FC<AllTimeRecordsPanelProps> = ({
  careerStats,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  idols = [],
  archives = [],
  matchDatabase = [],
}) => {
  const [activeTab, setActiveTab] = useState<
    'tournament' | 'league' | 'the_idols' | 'combined' | 'achievements' | 'v5_competitions'
  >('tournament');

  const [showAllRows, setShowAllRows] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<string>('all');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>('all');

  // Compute Idol Achievements from all historical data
  const achievementReports: Map<string, IdolAchievementReport> = useMemo(() => {
    return computeAllIdolAchievements({
      idols,
      careerStats,
      tournamentArchives: archives,
      leagueArchives,
      leagueState,
      theIdolsArchives,
      theIdolsState,
      matchDatabase,
    });
  }, [idols, careerStats, archives, leagueArchives, leagueState, theIdolsArchives, theIdolsState, matchDatabase]);

  // Sorted Idols by Achievement Points
  const achievementLeaderboard: IdolAchievementReport[] = useMemo(() => {
    return Array.from(achievementReports.values())
      .filter((r: IdolAchievementReport) => r.badgeCount > 0)
      .sort((a: IdolAchievementReport, b: IdolAchievementReport) => b.totalScore - a.totalScore);
  }, [achievementReports]);

  // 1. Tournament Categories
  const [activeTournamentCat, setActiveTournamentCat] =
    useState<keyof CareerStat>('championships');

  const tournamentCategories: { key: keyof CareerStat; label: string; unit: string }[] = [
    { key: 'championships', label: 'Most Cup Championships', unit: 'Cups' },
    { key: 'runnerUps', label: 'Most Runner-Ups', unit: 'Finishes' },
    { key: 'thirdPlaces', label: 'Most Third Places', unit: 'Finishes' },
    { key: 'participations', label: 'Most Appearances', unit: 'Seasons' },
    { key: 'matches', label: 'Most Tournament Matches', unit: 'Matches' },
    { key: 'wins', label: 'Most Tournament Wins', unit: 'Wins' },
    { key: 'winRate', label: 'Highest Cup Win Rate', unit: '%' },
    { key: 'longestWinStreak', label: 'Longest Win Streak', unit: 'Wins' },
    { key: 'longestUnbeatenStreak', label: 'Longest Unbeaten Streak', unit: 'Games' },
    { key: 'groupWins', label: 'Most Group Stage Wins', unit: 'Wins' },
    { key: 'knockoutWins', label: 'Most Knockout Wins', unit: 'Wins' },
    { key: 'gamesFor', label: 'Highest Cup Points Scored', unit: 'Pts' },
  ];

  const fullTournamentLeaderboard = useMemo(() => {
    return [...(careerStats || [])]
      .filter((s) => {
        if (!s) return false;
        if (!searchFilter) return true;
        return (
          String(s.idolName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(searchFilter.toLowerCase())
        );
      })
      .sort((a, b) => {
        const valA = (a[activeTournamentCat] as number) || 0;
        const valB = (b[activeTournamentCat] as number) || 0;
        return valB - valA;
      });
  }, [careerStats, activeTournamentCat, searchFilter]);

  const displayedTournamentLeaderboard = showAllRows
    ? fullTournamentLeaderboard
    : fullTournamentLeaderboard.slice(0, 10);

  // 2. League Stats Aggregation (Accurate Sync)
  const leagueStatsMap = useMemo(() => {
    const map = new Map<string, LeagueAggregatedStat>();

    const safeIdols = Array.isArray(idols) ? idols : [];
    const idolsMap = new Map<string, Idol>(safeIdols.map((i) => [i.id, i]));

    const getOrInit = (id: string) => {
      if (!map.has(id)) {
        const idol = idolsMap.get(id);
        map.set(id, {
          idolId: id,
          idolName: idol?.name || 'Unknown',
          photoUrl: idol?.photoUrl,
          girlGroup: idol?.girlGroup || '',
          nationality: idol?.nationality || 'South Korea',
          leagueTitles: 0,
          leagueMatches: 0,
          leagueWins: 0,
          leagueDraws: 0,
          leagueLosses: 0,
          leagueGF: 0,
          leagueGA: 0,
          leagueGD: 0,
          leaguePts: 0,
          bestSeasonPts: 0,
        });
      }
      return map.get(id)!;
    };

    // Process current active league state
    if (leagueState && Array.isArray(leagueState.leagues)) {
      leagueState.leagues.forEach((l) => {
        if (l && Array.isArray(l.standings)) {
          l.standings.forEach((st) => {
            if (!st) return;
            const existing = getOrInit(st.idolId);
            existing.leagueMatches += st.played || 0;
            existing.leagueWins += st.wins || 0;
            existing.leagueDraws += st.draws || 0;
            existing.leagueLosses += st.losses || 0;
            existing.leagueGF += st.gamesFor || 0;
            existing.leagueGA += st.gamesAgainst || 0;
            existing.leagueGD += st.gameDiff || 0;
            existing.leaguePts += st.points || 0;
            if (st.points > existing.bestSeasonPts) existing.bestSeasonPts = st.points;
            if (l.isCompleted && st.rank === 1 && (st.played || 0) > 0) {
              existing.leagueTitles += 1;
            }
          });
        }
      });
    }

    // Process archived league seasons
    (leagueArchives || []).forEach((arch) => {
      if (!arch) return;
      const titlesAwardedInArchive = new Set<string>();
      const winners = arch.leagueWinners || (arch as any).leagueChampions || [];
      if (Array.isArray(winners)) {
        winners.forEach((w: any) => {
          if (!w) return;
          const id = w.championId || w.idolId;
          if (id && !titlesAwardedInArchive.has(id)) {
            const existing = getOrInit(id);
            existing.leagueTitles += 1;
            titlesAwardedInArchive.add(id);
          }
        });
      }

      if (arch.allStandings && typeof arch.allStandings === 'object') {
        Object.values(arch.allStandings).forEach((standingsList: any) => {
          if (Array.isArray(standingsList)) {
            standingsList.forEach((st: any) => {
              if (st && st.idolId) {
                const existing = getOrInit(st.idolId);
                existing.leagueMatches += st.played || 0;
                existing.leagueWins += st.wins || 0;
                existing.leagueDraws += st.draws || 0;
                existing.leagueLosses += st.losses || 0;
                existing.leagueGF += st.gamesFor || 0;
                existing.leagueGA += st.gamesAgainst || 0;
                existing.leagueGD += st.gameDiff || 0;
                existing.leaguePts += st.points || 0;
                if (st.points > existing.bestSeasonPts) existing.bestSeasonPts = st.points;
                if (st.rank === 1 && (st.played || 0) > 0 && !titlesAwardedInArchive.has(st.idolId)) {
                  existing.leagueTitles += 1;
                  titlesAwardedInArchive.add(st.idolId);
                }
              }
            });
          }
        });
      }
    });

    return map;
  }, [idols, leagueState, leagueArchives]);

  type LeagueMetricKey =
    | 'leagueTitles'
    | 'leagueWins'
    | 'leaguePts'
    | 'bestSeasonPts'
    | 'leagueGF'
    | 'leagueGD'
    | 'winRate';

  const [activeLeagueCat, setActiveLeagueCat] = useState<LeagueMetricKey>('leagueTitles');

  const leagueCategories: { key: LeagueMetricKey; label: string; unit: string }[] = [
    { key: 'leagueTitles', label: 'Most Division Titles', unit: 'Titles' },
    { key: 'leagueWins', label: 'Most League Match Wins', unit: 'Wins' },
    { key: 'leaguePts', label: 'All-Time Total League Points', unit: 'PTS' },
    { key: 'bestSeasonPts', label: 'Best Single-Season Points', unit: 'PTS' },
    { key: 'leagueGF', label: 'Most Goals/Games For', unit: 'GF' },
    { key: 'leagueGD', label: 'Best All-Time Goal Difference', unit: 'GD' },
    { key: 'winRate', label: 'Highest League Win Rate', unit: '%' },
  ];

  const fullLeagueLeaderboard: (LeagueAggregatedStat & { winRate: number })[] = useMemo(() => {
    return Array.from(leagueStatsMap.values())
      .map((item: LeagueAggregatedStat) => ({
        ...item,
        winRate:
          item.leagueMatches > 0
            ? Math.round((item.leagueWins / item.leagueMatches) * 100)
            : 0,
      }))
      .filter((s) => {
        if (s.leagueMatches === 0 && s.leagueTitles === 0) return false;
        if (!searchFilter) return true;
        return (
          String(s.idolName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(searchFilter.toLowerCase())
        );
      })
      .sort((a, b) => {
        const valA = (a[activeLeagueCat] as number) || 0;
        const valB = (b[activeLeagueCat] as number) || 0;
        return valB - valA;
      });
  }, [leagueStatsMap, activeLeagueCat, searchFilter]);

  const displayedLeagueLeaderboard = showAllRows
    ? fullLeagueLeaderboard
    : fullLeagueLeaderboard.slice(0, 10);

  // 3. The Idols Superleague Aggregation
  const theIdolsStatsMap = useMemo(() => {
    const map = new Map<string, TheIdolsAggregatedStat>();

    const safeIdols = Array.isArray(idols) ? idols : [];
    safeIdols.forEach((idol) => {
      if (!idol) return;
      map.set(idol.id, {
        idolId: idol.id,
        idolName: idol.name,
        photoUrl: idol.photoUrl,
        girlGroup: idol.girlGroup,
        nationality: idol.nationality,
        theIdolsTitles: 0,
        theIdolsMatches: 0,
        theIdolsWins: 0,
        theIdolsDraws: 0,
        theIdolsLosses: 0,
        theIdolsGF: 0,
        theIdolsGA: 0,
        theIdolsGD: 0,
        theIdolsPts: 0,
        bestSeasonPts: 0,
        playoffAppearances: 0,
      });
    });

    const getOrInit = (id: string, name?: string, photo?: string, gg?: string, nat?: string) => {
      if (!map.has(id)) {
        map.set(id, {
          idolId: id,
          idolName: name || 'Unknown',
          photoUrl: photo,
          girlGroup: gg || '',
          nationality: nat || '',
          theIdolsTitles: 0,
          theIdolsMatches: 0,
          theIdolsWins: 0,
          theIdolsDraws: 0,
          theIdolsLosses: 0,
          theIdolsGF: 0,
          theIdolsGA: 0,
          theIdolsGD: 0,
          theIdolsPts: 0,
          bestSeasonPts: 0,
          playoffAppearances: 0,
        });
      }
      return map.get(id)!;
    };

    // Process current active The Idols state
    if (theIdolsState && Array.isArray(theIdolsState.standings)) {
      theIdolsState.standings.forEach((st) => {
        if (!st) return;
        const item = getOrInit(st.idolId, st.idolName, st.photoUrl, st.girlGroup);
        item.theIdolsMatches += st.played || 0;
        item.theIdolsWins += st.wins || 0;
        item.theIdolsDraws += st.draws || 0;
        item.theIdolsLosses += st.losses || 0;
        item.theIdolsGF += st.gamesFor || 0;
        item.theIdolsGA += st.gamesAgainst || 0;
        item.theIdolsGD += st.goalDiff || 0;
        item.theIdolsPts += st.points || 0;
        item.bestSeasonPts = Math.max(item.bestSeasonPts, st.points || 0);

        if ((theIdolsState.isLeagueCompleted || theIdolsState.isCompleted) && (st.played || 0) > 0 && st.rank === 1) {
          item.theIdolsTitles += 1;
        }
        if ((theIdolsState.isPlayoffCompleted || theIdolsState.isCompleted) && theIdolsState.championId === st.idolId) {
          item.theIdolsTitles += 1;
        }
        if (st.rank <= 4) {
          item.playoffAppearances += 1;
        }
      });

      if (Array.isArray(theIdolsState.playoffMatches)) {
        theIdolsState.playoffMatches.forEach((pm) => {
          if (pm && pm.completed && pm.winnerId) {
            const itemWinner = getOrInit(pm.winnerId);
            itemWinner.theIdolsMatches += 1;
            itemWinner.theIdolsWins += 1;
            const scoreWinner = pm.scoreA !== undefined && pm.scoreB !== undefined ? Math.max(pm.scoreA, pm.scoreB) : 0;
            const scoreLoser = pm.scoreA !== undefined && pm.scoreB !== undefined ? Math.min(pm.scoreA, pm.scoreB) : 0;
            itemWinner.theIdolsGF += scoreWinner;
            itemWinner.theIdolsGA += scoreLoser;
            itemWinner.theIdolsGD += scoreWinner - scoreLoser;

            const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
            if (loserId) {
              const itemLoser = getOrInit(loserId);
              itemLoser.theIdolsMatches += 1;
              itemLoser.theIdolsLosses += 1;
              itemLoser.theIdolsGF += scoreLoser;
              itemLoser.theIdolsGA += scoreWinner;
              itemLoser.theIdolsGD += scoreLoser - scoreWinner;
            }
          }
        });
      }
    }

    // Process archived The Idols seasons
    (theIdolsArchives || []).forEach((arch) => {
      if (!arch) return;
      if (arch.championId) {
        const item = getOrInit(arch.championId, arch.championName);
        item.theIdolsTitles += 1;
      }
      if (Array.isArray(arch.standings) && arch.standings.length > 0) {
        const topReg = arch.standings[0];
        if (topReg && topReg.idolId) {
          const itemReg = getOrInit(topReg.idolId, topReg.idolName, topReg.photoUrl, topReg.girlGroup);
          itemReg.theIdolsTitles += 1;
        }
      }

      if (Array.isArray(arch.standings)) {
        arch.standings.forEach((st) => {
          if (!st) return;
          const item = getOrInit(st.idolId, st.idolName, st.photoUrl, st.girlGroup);
          item.theIdolsMatches += st.played || 0;
          item.theIdolsWins += st.wins || 0;
          item.theIdolsDraws += st.draws || 0;
          item.theIdolsLosses += st.losses || 0;
          item.theIdolsGF += st.gamesFor || 0;
          item.theIdolsGA += st.gamesAgainst || 0;
          item.theIdolsGD += st.goalDiff || 0;
          item.theIdolsPts += st.points || 0;
          item.bestSeasonPts = Math.max(item.bestSeasonPts, st.points || 0);

          if (st.rank <= 4) {
            item.playoffAppearances += 1;
          }
        });
      }

      if (Array.isArray(arch.playoffMatches)) {
        arch.playoffMatches.forEach((pm) => {
          if (pm && pm.completed && pm.winnerId) {
            const itemWinner = getOrInit(pm.winnerId);
            itemWinner.theIdolsMatches += 1;
            itemWinner.theIdolsWins += 1;
            const scoreWinner = pm.scoreA !== undefined && pm.scoreB !== undefined ? Math.max(pm.scoreA, pm.scoreB) : 0;
            const scoreLoser = pm.scoreA !== undefined && pm.scoreB !== undefined ? Math.min(pm.scoreA, pm.scoreB) : 0;
            itemWinner.theIdolsGF += scoreWinner;
            itemWinner.theIdolsGA += scoreLoser;
            itemWinner.theIdolsGD += scoreWinner - scoreLoser;

            const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
            if (loserId) {
              const itemLoser = getOrInit(loserId);
              itemLoser.theIdolsMatches += 1;
              itemLoser.theIdolsLosses += 1;
              itemLoser.theIdolsGF += scoreLoser;
              itemLoser.theIdolsGA += scoreWinner;
              itemLoser.theIdolsGD += scoreLoser - scoreWinner;
            }
          }
        });
      }
    });

    return map;
  }, [idols, theIdolsState, theIdolsArchives]);

  type TheIdolsMetricKey =
    | 'theIdolsTitles'
    | 'theIdolsWins'
    | 'theIdolsPts'
    | 'bestSeasonPts'
    | 'theIdolsGF'
    | 'theIdolsGD'
    | 'theIdolsMatches'
    | 'playoffAppearances'
    | 'winRate';

  const [activeTheIdolsCat, setActiveTheIdolsCat] = useState<TheIdolsMetricKey>('theIdolsTitles');

  const theIdolsCategories: { key: TheIdolsMetricKey; label: string; unit: string }[] = [
    { key: 'theIdolsTitles', label: 'Most Superleague Titles', unit: 'Titles' },
    { key: 'theIdolsWins', label: 'Most Superleague Match Wins', unit: 'Wins' },
    { key: 'theIdolsPts', label: 'All-Time Superleague Points', unit: 'PTS' },
    { key: 'bestSeasonPts', label: 'Best Single-Season Points', unit: 'PTS' },
    { key: 'theIdolsGF', label: 'Most Goals / Games For', unit: 'GF' },
    { key: 'theIdolsGD', label: 'Best All-Time Goal Difference', unit: 'GD' },
    { key: 'theIdolsMatches', label: 'Most Superleague Matches', unit: 'Matches' },
    { key: 'playoffAppearances', label: 'Masters Playoff Qualifications', unit: 'Times' },
    { key: 'winRate', label: 'Highest Superleague Win Rate', unit: '%' },
  ];

  const fullTheIdolsLeaderboard: (TheIdolsAggregatedStat & { winRate: number })[] = useMemo(() => {
    return Array.from(theIdolsStatsMap.values())
      .map((item: TheIdolsAggregatedStat) => ({
        ...item,
        winRate:
          item.theIdolsMatches > 0
            ? Math.round((item.theIdolsWins / item.theIdolsMatches) * 100)
            : 0,
      }))
      .filter((s) => {
        if (s.theIdolsMatches === 0 && s.theIdolsTitles === 0) return false;
        if (!searchFilter) return true;
        return (
          String(s.idolName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(searchFilter.toLowerCase())
        );
      })
      .sort((a, b) => {
        const valA = (a[activeTheIdolsCat] as number) || 0;
        const valB = (b[activeTheIdolsCat] as number) || 0;
        return valB - valA;
      });
  }, [theIdolsStatsMap, activeTheIdolsCat, searchFilter]);

  const displayedTheIdolsLeaderboard = showAllRows
    ? fullTheIdolsLeaderboard
    : fullTheIdolsLeaderboard.slice(0, 10);

  // 4. Combined Stats Leaderboard
  const [activeCombinedCat, setActiveCombinedCat] = useState<CombinedMetricKey>('totalTitles');

  const combinedCategories: { key: CombinedMetricKey; label: string; unit: string }[] = [
    { key: 'totalTitles', label: 'Most Major Titles (Cups + Leagues + The Idols)', unit: 'Titles' },
    { key: 'totalWins', label: 'Most Total Match Wins', unit: 'Wins' },
    { key: 'totalMatches', label: 'Most Matches Played', unit: 'Matches' },
    { key: 'winRate', label: 'Highest Career Win Rate', unit: '%' },
    { key: 'totalGF', label: 'Highest Total Game Points Scored', unit: 'Points' },
  ];

  const fullCombinedLeaderboard = useMemo(() => {
    const safeIdols = Array.isArray(idols) ? idols : [];
    const safeCareer = Array.isArray(careerStats) ? careerStats : [];
    const idolsMap = new Map<string, Idol>(safeIdols.map((i) => [i.id, i]));
    const careerMap = new Map<string, CareerStat>(safeCareer.map((c) => [c.idolId, c]));

    const allIdolIds = new Set<string>([
      ...safeIdols.map((i) => i.id),
      ...safeCareer.map((c) => c.idolId),
      ...Array.from(leagueStatsMap.keys()),
      ...Array.from(theIdolsStatsMap.keys()),
    ]);

    const careerOverrides = loadCareerOverrides();

    const list = Array.from(allIdolIds).map((id) => {
      const idol = idolsMap.get(id);
      const cStat = careerMap.get(id);
      const lStat = leagueStatsMap.get(id);
      const tiStat = theIdolsStatsMap.get(id);
      const ov = careerOverrides[id];
      const isOv = ov && ov.enabled;

      const idolName = idol?.name || cStat?.idolName || lStat?.idolName || tiStat?.idolName || 'Unknown';
      const girlGroup = idol?.girlGroup || cStat?.girlGroup || lStat?.girlGroup || tiStat?.girlGroup || '';
      const photoUrl = idol?.photoUrl || cStat?.photoUrl || lStat?.photoUrl || tiStat?.photoUrl;

      const cupTitles = isOv && ov.championships !== undefined ? ov.championships : (cStat?.championships || 0);
      const leagueTitles = isOv && ov.divisionTitles !== undefined ? ov.divisionTitles : (lStat?.leagueTitles || 0);
      const theIdolsSuperleagueTitles = isOv && ov.theIdolsSuperleagueTitles !== undefined
        ? ov.theIdolsSuperleagueTitles
        : (tiStat?.theIdolsTitles || 0);
      const theIdolsMastersTitles = isOv && ov.theIdolsMastersTitles !== undefined
        ? ov.theIdolsMastersTitles
        : 0;
      const theIdolsTitles = theIdolsSuperleagueTitles + theIdolsMastersTitles;
      const totalTitles = calculateUnifiedTotalTitles(cupTitles, leagueTitles, theIdolsSuperleagueTitles, theIdolsMastersTitles);

      const totalMatches = isOv && ov.matches !== undefined
        ? ov.matches + (lStat?.leagueMatches || 0) + (tiStat?.theIdolsMatches || 0)
        : ((cStat?.matches || 0) + (lStat?.leagueMatches || 0) + (tiStat?.theIdolsMatches || 0));
      const totalWins = isOv && ov.wins !== undefined
        ? ov.wins + (lStat?.leagueWins || 0) + (tiStat?.theIdolsWins || 0)
        : ((cStat?.wins || 0) + (lStat?.leagueWins || 0) + (tiStat?.theIdolsWins || 0));
      const totalGF = (cStat?.gamesFor || 0) + (lStat?.leagueGF || 0) + (tiStat?.theIdolsGF || 0);
      const winRate =
        totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

      return {
        idolId: id,
        idolName,
        photoUrl,
        girlGroup,
        totalTitles,
        cupTitles,
        leagueTitles,
        theIdolsTitles,
        totalMatches,
        totalWins,
        totalGF,
        winRate,
      };
    });

    return list
      .filter((s) => {
        if (s.totalMatches === 0 && s.totalTitles === 0) return false;
        if (!searchFilter) return true;
        return (
          String(s.idolName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(searchFilter.toLowerCase())
        );
      })
      .sort((a, b) => {
        const valA = (a as any)[activeCombinedCat] || 0;
        const valB = (b as any)[activeCombinedCat] || 0;
        return valB - valA;
      });
  }, [idols, careerStats, leagueStatsMap, theIdolsStatsMap, activeCombinedCat, searchFilter]);

  const displayedCombinedLeaderboard = showAllRows
    ? fullCombinedLeaderboard
    : fullCombinedLeaderboard.slice(0, 10);

  // Helper to render milestone badge icon
  const renderBadgeIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Crown':
        return <Crown className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Flame':
        return <Flame className={className} />;
      case 'ShieldCheck':
        return <ShieldCheck className={className} />;
      case 'Trophy':
        return <Trophy className={className} />;
      case 'Award':
        return <Award className={className} />;
      case 'Zap':
        return <Zap className={className} />;
      case 'Swords':
        return <Swords className={className} />;
      case 'Shield':
        return <Shield className={className} />;
      case 'Star':
        return <Star className={className} />;
      case 'Medal':
        return <Medal className={className} />;
      case 'Target':
        return <Target className={className} />;
      case 'Table':
        return <Table className={className} />;
      default:
        return <Award className={className} />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'legendary':
        return {
          bg: 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-amber-400 text-amber-300',
          badge: 'bg-amber-400 text-black font-black',
        };
      case 'epic':
        return {
          bg: 'bg-purple-950/40 border-purple-500 text-purple-300',
          badge: 'bg-purple-500 text-white font-bold',
        };
      case 'gold':
        return {
          bg: 'bg-yellow-950/40 border-yellow-500 text-yellow-300',
          badge: 'bg-yellow-500 text-black font-bold',
        };
      case 'rare':
        return {
          bg: 'bg-cyan-950/40 border-cyan-500 text-cyan-300',
          badge: 'bg-cyan-500 text-black font-bold',
        };
      default:
        return {
          bg: 'bg-slate-900 border-slate-700 text-slate-300',
          badge: 'bg-slate-700 text-white font-bold',
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Flame className="h-7 w-7 text-amber-400" />
            <span>All-Time Records &amp; Milestones</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Historical leaderboards across Tournament Cups, League Divisions, Combined Career records, and Idol Achievement Badges.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#160f0b] p-1.5 rounded-2xl border-2 border-black poster-shadow-sm">
          <button
            onClick={() => setActiveTab('tournament')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'tournament'
                ? 'poster-pill-red text-white shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>Tournament Cups</span>
          </button>
          <button
            onClick={() => setActiveTab('league')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'league'
                ? 'poster-pill-gold text-amber-950 shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>League Divisions</span>
          </button>
          <button
            onClick={() => setActiveTab('the_idols')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'the_idols'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow ring-2 ring-fuchsia-400/50'
                : 'text-fuchsia-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>The Idols (Superleague)</span>
          </button>
          <button
            onClick={() => setActiveTab('combined')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'combined'
                ? 'bg-amber-400 text-black shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Combined Career</span>
          </button>
          <button onClick={() => setActiveTab('v5_competitions')} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${activeTab === 'v5_competitions' ? 'bg-amber-500 text-black shadow' : 'text-amber-200/70 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>New V5 Competitions</span>
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'achievements'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow ring-2 ring-purple-400/50'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>Achievement Badges</span>
          </button>
        </div>
      </div>

      {/* Global Filter & Expand Bar (For Leaderboard tabs) */}
      {activeTab !== 'achievements' && activeTab !== 'v5_competitions' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#17100b] p-3 rounded-2xl border-2 border-black poster-shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/60" />
            <input
              type="text"
              placeholder="Search by Idol Name or Girl Group..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/60 border border-black rounded-xl text-xs font-bold text-white placeholder-amber-200/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setShowAllRows(!showAllRows)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-black ${
                showAllRows
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-black/50 text-slate-300 hover:text-white'
              }`}
            >
              {showAllRows ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Showing All Champions &amp; Contenders</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Showing Top 10 Only</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'v5_competitions' && <V5CompetitionStatsPanel matchDatabase={matchDatabase} idols={idols} />}

      {/* 1. TOURNAMENT CUP RECORDS */}
      {activeTab === 'tournament' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {tournamentCategories.map((cat) => {
              const isActive = activeTournamentCat === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveTournamentCat(cat.key)}
                  className={`p-3 rounded-xl border-2 text-xs font-poster-body font-bold transition-all text-left ${
                    isActive
                      ? 'border-red-500 bg-red-950/60 text-white shadow poster-shadow-sm'
                      : 'border-black bg-[#1b130e] text-amber-200/70 hover:text-white hover:bg-[#251911]'
                  }`}
                >
                  <span className="block truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 gap-2">
              <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span>
                  {tournamentCategories.find((c) => c.key === activeTournamentCat)?.label} Table
                </span>
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400/80">
                {displayedTournamentLeaderboard.length} Idols on record
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-poster-body">
                <thead className="bg-[#120d09] text-[10px] font-black uppercase tracking-wider text-amber-300 border-b-2 border-black">
                  <tr>
                    <th className="px-4 py-3 text-center">Rank</th>
                    <th className="px-4 py-3">Idol Name &amp; Badges</th>
                    <th className="px-4 py-3">Girl Group</th>
                    <th className="px-4 py-3 text-right font-black text-amber-400">Record Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40 font-medium">
                  {displayedTournamentLeaderboard.map((stat, idx) => {
                    const catObj = tournamentCategories.find((c) => c.key === activeTournamentCat);
                    const val = stat[activeTournamentCat];
                    const report = achievementReports.get(stat.idolId);

                    return (
                      <tr key={stat.idolId} className="hover:bg-[#251a13] transition-colors">
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                              idx === 0
                                ? 'bg-amber-400 text-black font-black'
                                : idx === 1
                                ? 'bg-slate-300 text-black font-black'
                                : idx === 2
                                ? 'bg-amber-700 text-white font-black'
                                : 'bg-black text-amber-300'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {stat.photoUrl ? (
                              <img
                                src={stat.photoUrl}
                                alt={stat.idolName}
                                className="h-8 w-8 rounded-lg object-cover border border-black"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-black border border-black flex items-center justify-center font-bold text-xs text-amber-300">
                                {stat.idolName.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-sm">{stat.idolName}</span>
                                {report && report.earnedBadges.slice(0, 3).map((eb) => (
                                  <span
                                    key={eb.badge.id}
                                    title={`${eb.badge.name}: ${eb.badge.description}`}
                                    className="p-1 rounded bg-black/60 border border-amber-400/40 text-amber-300 inline-flex items-center"
                                  >
                                    {renderBadgeIcon(eb.badge.iconName, 'w-3 h-3')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-amber-400 font-bold">{stat.girlGroup}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-sm text-amber-300">
                          {val} {catObj?.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. LEAGUE DIVISION RECORDS */}
      {activeTab === 'league' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {leagueCategories.map((cat) => {
              const isActive = activeLeagueCat === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveLeagueCat(cat.key)}
                  className={`p-3 rounded-xl border-2 text-xs font-poster-body font-bold transition-all text-left ${
                    isActive
                      ? 'border-amber-400 bg-amber-950/60 text-white shadow poster-shadow-sm'
                      : 'border-black bg-[#1b130e] text-amber-200/70 hover:text-white hover:bg-[#251911]'
                  }`}
                >
                  <span className="block truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 gap-2">
              <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2">
                <Table className="h-5 w-5 text-amber-400" />
                <span>
                  {leagueCategories.find((c) => c.key === activeLeagueCat)?.label} Table
                </span>
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400/80">
                {displayedLeagueLeaderboard.length} League Competitors on record
              </span>
            </div>

            {displayedLeagueLeaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead className="bg-[#120d09] text-[10px] font-black uppercase tracking-wider text-amber-300 border-b-2 border-black">
                    <tr>
                      <th className="px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Idol Name &amp; Badges</th>
                      <th className="px-4 py-3">Girl Group</th>
                      <th className="px-4 py-3 text-center">Record (W-D-L)</th>
                      <th className="px-4 py-3 text-right font-black text-amber-400">Record Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/40 font-medium">
                    {displayedLeagueLeaderboard.map((stat, idx) => {
                      const catObj = leagueCategories.find((c) => c.key === activeLeagueCat);
                      const val = (stat as any)[activeLeagueCat];
                      const report = achievementReports.get(stat.idolId);

                      return (
                        <tr key={stat.idolId} className="hover:bg-[#251a13] transition-colors">
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                                idx === 0
                                  ? 'bg-amber-400 text-black font-black'
                                  : idx === 1
                                  ? 'bg-slate-300 text-black font-black'
                                  : idx === 2
                                  ? 'bg-amber-700 text-white font-black'
                                  : 'bg-black text-amber-300'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {stat.photoUrl ? (
                                <img
                                  src={stat.photoUrl}
                                  alt={stat.idolName}
                                  className="h-8 w-8 rounded-lg object-cover border border-black"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-black border border-black flex items-center justify-center font-bold text-xs text-amber-300">
                                  {stat.idolName.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white text-sm">{stat.idolName}</span>
                                  {report && report.earnedBadges.slice(0, 3).map((eb) => (
                                    <span
                                      key={eb.badge.id}
                                      title={`${eb.badge.name}: ${eb.badge.description}`}
                                      className="p-1 rounded bg-black/60 border border-amber-400/40 text-amber-300 inline-flex items-center"
                                    >
                                      {renderBadgeIcon(eb.badge.iconName, 'w-3 h-3')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-amber-400 font-bold">{stat.girlGroup}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-300">
                            {stat.leagueWins}W - {stat.leagueDraws}D - {stat.leagueLosses}L
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-sm text-amber-300">
                            {val} {catObj?.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-bold text-amber-200/50">
                No league matches played or recorded yet. Simulate or play matches in the League System to populate league records!
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. THE IDOLS SUPERLEAGUE RECORDS */}
      {activeTab === 'the_idols' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {theIdolsCategories.map((cat) => {
              const isActive = activeTheIdolsCat === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveTheIdolsCat(cat.key)}
                  className={`p-3 rounded-xl border-2 text-xs font-poster-body font-bold transition-all text-left ${
                    isActive
                      ? 'border-fuchsia-400 bg-fuchsia-950/70 text-white shadow poster-shadow-sm font-black'
                      : 'border-black bg-[#1b130e] text-amber-200/70 hover:text-white hover:bg-[#251911]'
                  }`}
                >
                  <span className="block truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 gap-2">
              <h3 className="font-poster-title text-base sm:text-lg text-fuchsia-300 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-fuchsia-400" />
                <span>
                  {theIdolsCategories.find((c) => c.key === activeTheIdolsCat)?.label} Table
                </span>
              </h3>
              <span className="text-xs font-mono font-bold text-fuchsia-300/80">
                {displayedTheIdolsLeaderboard.length} Superleague Competitors on record
              </span>
            </div>

            {displayedTheIdolsLeaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead className="bg-[#120d09] text-[10px] font-black uppercase tracking-wider text-amber-300 border-b-2 border-black">
                    <tr>
                      <th className="px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Idol Name &amp; Badges</th>
                      <th className="px-4 py-3">Girl Group</th>
                      <th className="px-4 py-3 text-center">Superleague Record</th>
                      <th className="px-4 py-3 text-center">Playoffs</th>
                      <th className="px-4 py-3 text-right font-black text-fuchsia-300">Record Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/40 font-medium">
                    {displayedTheIdolsLeaderboard.map((stat, idx) => {
                      const catObj = theIdolsCategories.find((c) => c.key === activeTheIdolsCat);
                      const val = (stat as any)[activeTheIdolsCat];
                      const report = achievementReports.get(stat.idolId);

                      return (
                        <tr key={stat.idolId} className="hover:bg-[#251a13] transition-colors">
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                                idx === 0
                                  ? 'bg-fuchsia-400 text-black font-black'
                                  : idx === 1
                                  ? 'bg-slate-300 text-black font-black'
                                  : idx === 2
                                  ? 'bg-amber-700 text-white font-black'
                                  : 'bg-black text-fuchsia-300'
                              }`}
                            >
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {stat.photoUrl ? (
                                <img
                                  src={stat.photoUrl}
                                  alt={stat.idolName}
                                  className="h-8 w-8 rounded-lg object-cover border border-black"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-black border border-black flex items-center justify-center font-bold text-xs text-amber-300">
                                  {stat.idolName.slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white text-sm">{stat.idolName}</span>
                                  {report && report.earnedBadges.slice(0, 3).map((eb) => (
                                    <span
                                      key={eb.badge.id}
                                      title={`${eb.badge.name}: ${eb.badge.description}`}
                                      className="p-1 rounded bg-black/60 border border-amber-400/40 text-amber-300 inline-flex items-center"
                                    >
                                      {renderBadgeIcon(eb.badge.iconName, 'w-3 h-3')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-amber-400 font-bold">{stat.girlGroup}</td>
                          <td className="px-4 py-3 text-center font-mono text-slate-300">
                            {stat.theIdolsWins}W - {stat.theIdolsDraws}D - {stat.theIdolsLosses}L
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-fuchsia-300 font-bold">
                            {stat.playoffAppearances} Apps
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-sm text-fuchsia-300">
                            {val} {catObj?.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-bold text-amber-200/50">
                No Superleague matches recorded yet. Simulate or play matches in The Idols system to populate records!
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. COMBINED CAREER RECORDS */}
      {activeTab === 'combined' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {combinedCategories.map((cat) => {
              const isActive = activeCombinedCat === cat.key;

              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCombinedCat(cat.key)}
                  className={`p-3 rounded-xl border-2 text-xs font-poster-body font-bold transition-all text-left ${
                    isActive
                      ? 'border-amber-400 bg-amber-400 text-black shadow poster-shadow-sm font-black'
                      : 'border-black bg-[#1b130e] text-amber-200/70 hover:text-white hover:bg-[#251911]'
                  }`}
                >
                  <span className="block truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 gap-2">
              <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" />
                <span>
                  {combinedCategories.find((c) => c.key === activeCombinedCat)?.label} Table
                </span>
              </h3>
              <span className="text-xs font-mono font-bold text-amber-400/80">
                {displayedCombinedLeaderboard.length} Idols ranked
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-poster-body">
                <thead className="bg-[#120d09] text-[10px] font-black uppercase tracking-wider text-amber-300 border-b-2 border-black">
                  <tr>
                    <th className="px-4 py-3 text-center">Rank</th>
                    <th className="px-4 py-3">Idol Name &amp; Badges</th>
                    <th className="px-4 py-3">Girl Group</th>
                    <th className="px-4 py-3 text-center">Cups / Leagues / The Idols</th>
                    <th className="px-4 py-3 text-center">Win Rate</th>
                    <th className="px-4 py-3 text-right font-black text-amber-400">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40 font-medium">
                  {displayedCombinedLeaderboard.map((stat, idx) => {
                    const catObj = combinedCategories.find((c) => c.key === activeCombinedCat);
                    const val = (stat as any)[activeCombinedCat];
                    const report = achievementReports.get(stat.idolId);

                    return (
                      <tr key={stat.idolId} className="hover:bg-[#251a13] transition-colors">
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                              idx === 0
                                ? 'bg-amber-400 text-black font-black'
                                : idx === 1
                                ? 'bg-slate-300 text-black font-black'
                                : idx === 2
                                ? 'bg-amber-700 text-white font-black'
                                : 'bg-black text-amber-300'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {stat.photoUrl ? (
                              <img
                                src={stat.photoUrl}
                                alt={stat.idolName}
                                className="h-8 w-8 rounded-lg object-cover border border-black"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-black border border-black flex items-center justify-center font-bold text-xs text-amber-300">
                                {stat.idolName.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-sm">{stat.idolName}</span>
                                {report && report.earnedBadges.slice(0, 3).map((eb) => (
                                  <span
                                    key={eb.badge.id}
                                    title={`${eb.badge.name}: ${eb.badge.description}`}
                                    className="p-1 rounded bg-black/60 border border-amber-400/40 text-amber-300 inline-flex items-center"
                                  >
                                    {renderBadgeIcon(eb.badge.iconName, 'w-3 h-3')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-amber-400 font-bold">{stat.girlGroup}</td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className="font-black text-amber-300">{stat.cupTitles} Cups</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="font-black text-emerald-400">{stat.leagueTitles} Leagues</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="font-black text-fuchsia-400">{stat.theIdolsTitles} The Idols</span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-amber-300">
                          {stat.winRate}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-sm text-amber-300">
                          {val} {catObj?.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ACHIEVEMENT & MILESTONE BADGES TAB */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17100b] p-3 rounded-2xl border-2 border-black poster-shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-300">Filter Tier:</span>
              <div className="flex items-center gap-1">
                {['all', 'legendary', 'epic', 'gold', 'rare'].map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTierFilter(tier)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                      selectedTierFilter === tier
                        ? 'bg-amber-400 text-black font-black'
                        : 'bg-black/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs font-bold text-amber-200/70">
              Total Badges In System: {ALL_MILESTONE_BADGES.length}
            </span>
          </div>

          {/* Badges Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_MILESTONE_BADGES.filter(
              (b) => selectedTierFilter === 'all' || b.tier === selectedTierFilter
            ).map((badge) => {
              const tierStyle = getTierColor(badge.tier);

              // Idols who unlocked this badge
              const unlockedIdols: IdolAchievementReport[] = Array.from(achievementReports.values()).filter((r: IdolAchievementReport) =>
                r.earnedBadges.some((eb) => eb.badge.id === badge.id)
              );

              return (
                <div
                  key={badge.id}
                  className={`rounded-2xl border-2 p-4 flex flex-col justify-between space-y-3 shadow-lg ${tierStyle.bg}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-black/60 border border-current shadow-inner text-amber-300">
                          {renderBadgeIcon(badge.iconName, 'w-6 h-6')}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-white leading-tight">
                            {badge.name}
                          </h4>
                          <span
                            className={`inline-block text-[9px] px-2 py-0.5 rounded-full uppercase mt-1 ${tierStyle.badge}`}
                          >
                            {badge.tier} &bull; +{badge.xpValue} XP
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      {badge.description}
                    </p>

                    <div className="bg-black/40 rounded-xl p-2 border border-black/40 text-[11px] text-amber-300/90 font-mono">
                      <span className="font-bold text-white">Requirement:</span> {badge.criteria}
                    </div>
                  </div>

                  {/* Unlocked Idols Count / Avatars */}
                  <div className="pt-2 border-t border-black/40 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-200">
                      Unlocked by {unlockedIdols.length} Idol(s)
                    </span>
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {unlockedIdols.slice(0, 5).map((idol) => (
                        <div
                          key={idol.idolId}
                          title={idol.idolName}
                          className="h-6 w-6 rounded-full border border-black overflow-hidden bg-black shrink-0"
                        >
                          {idol.photoUrl ? (
                            <img
                              src={idol.photoUrl}
                              alt={idol.idolName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-amber-300">
                              {idol.idolName.slice(0, 1)}
                            </div>
                          )}
                        </div>
                      ))}
                      {unlockedIdols.length > 5 && (
                        <div className="h-6 w-6 rounded-full border border-black bg-amber-500 text-black text-[9px] font-black flex items-center justify-center shrink-0">
                          +{unlockedIdols.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Idols with Most Achievement Badges Leaderboard */}
          <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
            <h3 className="font-poster-title text-base sm:text-lg text-amber-300 border-b-2 border-black pb-3 flex items-center gap-2">
              <Medal className="h-5 w-5 text-amber-400" />
              <span>Idols Hall of Milestones &bull; Most Achievement Points</span>
            </h3>

            {achievementLeaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead className="bg-[#120d09] text-[10px] font-black uppercase tracking-wider text-amber-300 border-b-2 border-black">
                    <tr>
                      <th className="px-4 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Idol</th>
                      <th className="px-4 py-3">Girl Group</th>
                      <th className="px-4 py-3">Badges Earned</th>
                      <th className="px-4 py-3 text-right font-black text-amber-400">Milestone Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/40 font-medium">
                    {achievementLeaderboard.map((report, idx) => (
                      <tr key={report.idolId} className="hover:bg-[#251a13] transition-colors">
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                              idx === 0
                                ? 'bg-amber-400 text-black font-black'
                                : idx === 1
                                ? 'bg-slate-300 text-black font-black'
                                : idx === 2
                                ? 'bg-amber-700 text-white font-black'
                                : 'bg-black text-amber-300'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {report.photoUrl ? (
                              <img
                                src={report.photoUrl}
                                alt={report.idolName}
                                className="h-8 w-8 rounded-lg object-cover border border-black"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-black border border-black flex items-center justify-center font-bold text-xs text-amber-300">
                                {report.idolName.slice(0, 2)}
                              </div>
                            )}
                            <span className="font-bold text-white text-sm">{report.idolName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-amber-400 font-bold">{report.girlGroup}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {report.earnedBadges.map((eb) => {
                              const tierStyle = getTierColor(eb.badge.tier);
                              return (
                                <span
                                  key={eb.badge.id}
                                  title={`${eb.badge.name}: ${eb.badge.description} (${eb.unlockedContext || ''})`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-current shadow-sm ${tierStyle.bg}`}
                                >
                                  {renderBadgeIcon(eb.badge.iconName, 'w-3 h-3')}
                                  <span>{eb.badge.name}</span>
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-sm text-amber-300">
                          {report.totalScore} XP
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-bold text-amber-200/50">
                No milestone badges unlocked yet. Compete in Tournament Cups and League Divisions to earn achievements!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
