import React, { useState, useEffect, useMemo } from 'react';
import {
  Idol,
  GirlGroup,
  TournamentConfig,
  Group,
  KnockoutMatch,
  ArchivedMatch,
  TournamentArchive,
  ActiveTab,
  LeagueSeasonState,
  LeagueSeasonArchive,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  CareerStat,
} from '../types';
import type { V5State, V5TitleArchive } from '../utils/v5/store';
import {
  Trophy,
  Users,
  Swords,
  Play,
  ArrowRight,
  Flame,
  Crown,
  Table,
  BarChart3,
  Sparkles,
  Edit2,
  Check,
  X,
  Medal,
  Percent,
  Shield,
  ExternalLink,
  Star,
  Target,
  HeartCrack,
  Zap,
  Activity,
  Award,
} from 'lucide-react';
import { getTopH2HRecordsForIdol } from '../utils/h2hHelper';
import { getCountryFlag } from '../utils/nationalityHelper';
import { getAllSeasonArchives, deriveCareerStats } from '../utils/tournamentLogic';
import { computeCombinedTopRankings, getLeagueWinners, DEFAULT_LEAGUE_DEFS, loadCustomLeagueBranding } from '../utils/leagueLogic';
import { loadCareerOverrides } from '../utils/databaseStudioLogic';
import { KahootPodium } from './KahootPodium';
import { RatingBadge } from './RatingBadge';

interface DashboardPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  config: TournamentConfig;
  groups: Group[];
  knockoutMatches: KnockoutMatch[];
  matchDatabase: ArchivedMatch[];
  archives: TournamentArchive[];
  setActiveTab: (tab: ActiveTab) => void;
  updateConfig?: (newConfig: Partial<TournamentConfig>) => void;
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  v5State?: V5State;
  v5TitleArchives?: V5TitleArchive[];
  onCrownChampionAndArchive?: () => void;
}

type RecordCategoryKey =
  | 'cup_titles'
  | 'league_cups'
  | 'superleague'
  | 'masters'
  | 'most_wins'
  | 'highest_winrate'
  | 'most_losses';

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  idols,
  girlGroups,
  config,
  groups,
  knockoutMatches,
  matchDatabase,
  archives,
  setActiveTab,
  updateConfig,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  v5State,
  v5TitleArchives = [],
  onCrownChampionAndArchive,
}) => {
  const safeArchives = archives || [];
  const safeMatchDatabase = matchDatabase || [];
  const safeGroups = groups || [];
  const safeKnockoutMatches = knockoutMatches || [];
  const safeIdols = idols || [];
  const safeGirlGroups = girlGroups || [];
  const safeConfig = config || {
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
  };

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(safeConfig.seasonName);
  const [selectedRecordTab, setSelectedRecordTab] = useState<RecordCategoryKey>('cup_titles');
  const [podiumView, setPodiumView] = useState<'idols' | 'groups'>('idols');
  const [recentMatchFilter, setRecentMatchFilter] = useState<'all' | 'cup' | 'league' | 'the_idols'>('all');
  const [selectedDashboardDivision, setSelectedDashboardDivision] = useState<number>(1);
  const [dashboardLeagueViewMode, setDashboardLeagueViewMode] = useState<'both' | 'standings' | 'champions'>('both');

  const customLeagueDefs = useMemo(() => {
    return loadCustomLeagueBranding();
  }, []);

  useEffect(() => {
    setNameInput(safeConfig.seasonName);
  }, [safeConfig.seasonName]);

  const handleSaveName = () => {
    if (nameInput.trim() && updateConfig) {
      updateConfig({ seasonName: nameInput.trim() });
    }
    setIsEditingName(false);
  };

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    safeIdols.forEach((i) => map.set(i.id, i));
    return map;
  }, [safeIdols]);

  // Derive all season archives & career stats accurately
  const allSeasonArchives = useMemo(() => {
    return getAllSeasonArchives(
      safeArchives,
      safeMatchDatabase,
      idolsMap,
      undefined,
      undefined,
      undefined,
      Number(safeConfig?.seasonNumber || safeConfig?.seasonId || 1)
    );
  }, [safeArchives, safeMatchDatabase, idolsMap, safeConfig]);

  const careerStats = useMemo(() => {
    return deriveCareerStats(
      safeIdols,
      safeMatchDatabase,
      safeArchives,
      safeKnockoutMatches,
      safeConfig,
      safeGroups,
      undefined,
      leagueState,
      leagueArchives,
      theIdolsState,
      theIdolsArchives
    );
  }, [safeIdols, safeMatchDatabase, safeArchives, safeKnockoutMatches, safeConfig, safeGroups, leagueState, leagueArchives, theIdolsState, theIdolsArchives]);

  const crownedArchives = useMemo(() => {
    return allSeasonArchives.filter(
      (a) =>
        a.championName &&
        a.championName !== 'Pending' &&
        a.championName !== 'In Progress' &&
        a.championName !== 'Unknown'
    );
  }, [allSeasonArchives]);

  const latestCupArchive = crownedArchives.length > 0 ? crownedArchives[crownedArchives.length - 1] : undefined;
  const latestV5Title = useMemo(() => {
    if (!v5TitleArchives?.length) return undefined;
    return [...v5TitleArchives].sort((a, b) => new Date(b.archivedAt || 0).getTime() - new Date(a.archivedAt || 0).getTime())[0];
  }, [v5TitleArchives]);

  // Latest The Idols Masters champion
  const latestTheIdolsChampion = useMemo(() => {
    if (theIdolsArchives && theIdolsArchives.length > 0) {
      return theIdolsArchives[theIdolsArchives.length - 1];
    }
    if (theIdolsState && theIdolsState.championId) {
      return {
        seasonNumber: theIdolsState.seasonNumber || 1,
        championId: theIdolsState.championId,
        championName: theIdolsState.championName || 'Champion',
        runnerUpName: theIdolsState.runnerUpName || 'Runner-Up',
        thirdPlaceName: theIdolsState.thirdPlaceName || '3rd Place',
      };
    }
    return undefined;
  }, [theIdolsArchives, theIdolsState]);

  // Check if active season has a completed Grand Final that has not yet been archived
  const grandFinalMatch = (safeKnockoutMatches || []).find(
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
  const championIdol = grandFinalMatch?.winnerId ? idolsMap.get(grandFinalMatch.winnerId) : null;
  const isCurrentSeasonArchived = safeArchives.some(
    (a) => Number(a.seasonId) === Number(safeConfig.seasonId || safeConfig.seasonNumber)
  );
  const hasPendingArchival = Boolean(grandFinalMatch?.completed && championIdol && !isCurrentSeasonArchived);

  // Filtered recent matches
  const filteredRecentMatches = useMemo(() => {
    let list = safeMatchDatabase;
    if (recentMatchFilter === 'cup') {
      list = list.filter((m) => {
        const stageLower = (m.stage || '').toLowerCase();
        const idLower = (m.matchId || '').toLowerCase();
        return (
          !stageLower.includes('league') &&
          !stageLower.includes('division') &&
          !stageLower.includes('superleague') &&
          !idLower.startsWith('league_') &&
          !idLower.startsWith('the_idols_')
        );
      });
    } else if (recentMatchFilter === 'league') {
      list = list.filter((m) => {
        const stageLower = (m.stage || '').toLowerCase();
        const idLower = (m.matchId || '').toLowerCase();
        return stageLower.includes('league') || stageLower.includes('division') || idLower.startsWith('league_');
      });
    } else if (recentMatchFilter === 'the_idols') {
      list = list.filter((m) => {
        const stageLower = (m.stage || '').toLowerCase();
        const idLower = (m.matchId || '').toLowerCase();
        return stageLower.includes('superleague') || stageLower.includes('the idols') || stageLower.includes('masters') || idLower.startsWith('the_idols_');
      });
    }
    return list.slice(-6).reverse();
  }, [safeMatchDatabase, recentMatchFilter]);

  const combinedRankings = useMemo(() => {
    return computeCombinedTopRankings(
      safeIdols,
      safeGirlGroups,
      careerStats,
      leagueState || null,
      leagueArchives || [],
      theIdolsState || null,
      theIdolsArchives || []
    );
  }, [safeIdols, safeGirlGroups, careerStats, leagueState, leagueArchives, theIdolsState, theIdolsArchives]);

  const leagueWinners = useMemo(() => {
    if (!leagueState || !leagueState.leagues) return [];
    return getLeagueWinners(leagueState.leagues, safeIdols);
  }, [leagueState, safeIdols]);

  const activeDashboardLeague = useMemo(() => {
    if (!leagueState || !leagueState.leagues || leagueState.leagues.length === 0) return null;
    return (
      leagueState.leagues.find((l) => l.id === selectedDashboardDivision) ||
      leagueState.leagues[0]
    );
  }, [leagueState, selectedDashboardDivision]);

  // Division 2 is a promotion-only competition. It shares each Division 1 league's
  // parent id, but has its own roster, fixtures and standings in the V5 state.
  const divisionTwoLeagues = useMemo(() => (v5State?.d2 || []).map((league) => ({
    ...league,
    standings: [...(league.standings || [])].sort((a, b) => (a.rank || 999) - (b.rank || 999)),
  })), [v5State?.d2]);
  const activeDashboardDivisionTwo = useMemo(() =>
    divisionTwoLeagues.find((league) => league.parentLeagueId === selectedDashboardDivision) || null,
  [divisionTwoLeagues, selectedDashboardDivision]);
  const promotionSlots = Math.max(0, Number(v5State?.promotionCount ?? 3));
  const divisionTwoCompletedMatches = divisionTwoLeagues.reduce((total, league) =>
    total + (league.matches || []).filter((match) => match.completed).length, 0);
  const divisionTwoTotalMatches = divisionTwoLeagues.reduce((total, league) =>
    total + (league.matches || []).length, 0);
  const v5CupMatchCount = (v5State?.champsCup?.matches || []).length
    + (v5State?.leagueCup?.rounds || []).reduce((total, round) => total + round.length, 0)
    + Object.values(v5State?.miniCups || {}).reduce((total, matches) => total + matches.length, 0)
    + (v5State?.superA ? 1 : 0)
    + (v5State?.superB || []).length;
  const v5CompletedCupMatches = (v5State?.champsCup?.matches || []).filter((match) => match.completed).length
    + (v5State?.leagueCup?.rounds || []).reduce((total, round) => total + round.filter((match) => match.completed).length, 0)
    + Object.values(v5State?.miniCups || {}).reduce((total, matches) => total + matches.filter((match) => match.completed).length, 0)
    + (v5State?.superA?.completed ? 1 : 0)
    + (v5State?.superB || []).filter((match) => match.completed).length;

  // Unified Match Completed Counter
  const totalMatchesCompletedInActiveTournament =
    safeGroups.reduce(
      (acc, g) => acc + (g?.matches ? g.matches.filter((m) => m?.completed).length : 0),
      0
    ) + safeKnockoutMatches.filter((km) => km?.completed).length;

  const totalMatchesAll = Math.max(
    safeMatchDatabase.length + totalMatchesCompletedInActiveTournament,
    combinedRankings.topIdols.reduce((acc, i) => acc + (i.matches || 0), 0) / 2
  );

  // Total Distinct Seasons Completed across all formats
  const totalCompletedSeasons = useMemo(() => {
    const set = new Set<number>();
    safeArchives.forEach((a) => {
      const s = Number(a?.seasonId || 0);
      if (s > 0) set.add(s);
    });
    (leagueArchives || []).forEach((a) => {
      const s = Number(a?.seasonNumber || 0);
      if (s > 0) set.add(s);
    });
    (theIdolsArchives || []).forEach((a) => {
      const s = Number(a?.seasonNumber || 0);
      if (s > 0) set.add(s);
    });
    (v5TitleArchives || []).forEach((title) => {
      const s = Number(title?.seasonNumber || 0);
      if (s > 0) set.add(s);
    });
    return set.size;
  }, [safeArchives, leagueArchives, theIdolsArchives, v5TitleArchives]);

  // ---------------------------------------------------------------------------
  // PINNACLE RECORDS & ALL-TIME HONORS ENGINE (The 7 Pillars Requested by User)
  // 1. Most Cup Titles
  // 2. Most League Cups (Division League Titles)
  // 3. Most Superleague Titles (Regular Season #1)
  // 4. Most Masters Champions (Playoff Championship)
  // 5. Most Match Wins
  // 6. Highest Win Rate
  // 7. Most Match Losses
  // ---------------------------------------------------------------------------
  interface AggregatedRecord {
    idol: Idol;
    cupTitles: number;
    cupRunnerUps: number;
    cupMatches: number;
    cupWins: number;
    cupWinRate: number;

    leagueTitles: number;
    leagueMatches: number;
    leagueWins: number;
    leagueDraws: number;
    leagueLosses: number;
    leaguePts: number;

    superleagueTitles: number;
    superleagueMatches: number;
    superleagueWins: number;
    superleagueDraws: number;
    superleagueLosses: number;
    superleaguePts: number;

    mastersTitles: number;
    mastersRunnerUps: number;
    mastersMatches: number;
    mastersWins: number;
    mastersLosses: number;

    totalTitles: number;
    totalMatches: number;
    totalWins: number;
    totalDraws: number;
    totalLosses: number;
    winRate: number;
    gameDiff: number;
  }

  const pinnacleRecords = useMemo(() => {
    const careerOverrides = loadCareerOverrides();
    const map = new Map<string, AggregatedRecord>();

    safeIdols.forEach((idol) => {
      map.set(idol.id, {
        idol,
        cupTitles: 0,
        cupRunnerUps: 0,
        cupMatches: 0,
        cupWins: 0,
        cupWinRate: 0,
        leagueTitles: 0,
        leagueMatches: 0,
        leagueWins: 0,
        leagueDraws: 0,
        leagueLosses: 0,
        leaguePts: 0,
        superleagueTitles: 0,
        superleagueMatches: 0,
        superleagueWins: 0,
        superleagueDraws: 0,
        superleagueLosses: 0,
        superleaguePts: 0,
        mastersTitles: 0,
        mastersRunnerUps: 0,
        mastersMatches: 0,
        mastersWins: 0,
        mastersLosses: 0,
        totalTitles: 0,
        totalMatches: 0,
        totalWins: 0,
        totalDraws: 0,
        totalLosses: 0,
        winRate: 0,
        gameDiff: 0,
      });
    });

    // V5 title archive is the authoritative source for Division 2 and the
    // newer cup circuit. Count each archived title once by its stable archive id.
    const processedV5TitleIds = new Set<string>();
    (v5TitleArchives || []).forEach((title) => {
      if (!title?.id || processedV5TitleIds.has(title.id)) return;
      processedV5TitleIds.add(title.id);
      const winner = map.get(title.winnerId);
      if (winner) {
        if (title.isDivision) winner.leagueTitles += 1;
        else winner.cupTitles += 1;
      }
      if (!title.isDivision && title.runnerUpId) {
        const runnerUp = map.get(title.runnerUpId);
        if (runnerUp) runnerUp.cupRunnerUps += 1;
      }
    });

    // 1. Process Cup stats from careerStats
    careerStats.forEach((cs) => {
      const rec = map.get(cs.idolId);
      if (!rec) return;
      rec.cupTitles += cs.championships || 0;
      rec.cupRunnerUps += cs.runnerUps || 0;
      rec.cupMatches = cs.matches || 0;
      rec.cupWins = cs.wins || 0;
      rec.cupWinRate = cs.winRate || 0;

      rec.totalWins += cs.wins || 0;
      rec.totalLosses += cs.losses || 0;
      rec.totalDraws += cs.draws || 0;
      rec.totalMatches += cs.matches || 0;
      rec.gameDiff += cs.gameDiff || 0;
    });

    // Add pending active tournament champion if completed
    if (hasPendingArchival && championIdol) {
      const rec = map.get(championIdol.id);
      if (rec) {
        rec.cupTitles += 1;
      }
    }

    // 2. Process League stats from leagueArchives + current leagueState
    (leagueArchives || []).forEach((arch) => {
      const awardedInArchive = new Set<string>();
      (arch.leagueWinners || []).forEach((w) => {
        const champId = w.championId || (w as any).idolId;
        if (champId && map.has(champId) && !awardedInArchive.has(champId)) {
          map.get(champId)!.leagueTitles += 1;
          awardedInArchive.add(champId);
        }
      });

      if (arch.allStandings) {
        Object.values(arch.allStandings).forEach((standingsList: any) => {
          if (Array.isArray(standingsList)) {
            standingsList.forEach((st: any) => {
              if (st && st.idolId && map.has(st.idolId)) {
                const rec = map.get(st.idolId)!;
                rec.leagueMatches += st.played || 0;
                rec.leagueWins += st.wins || 0;
                rec.leagueDraws += st.draws || 0;
                rec.leagueLosses += st.losses || 0;
                rec.leaguePts += st.points || 0;
                rec.totalWins += st.wins || 0;
                rec.totalDraws += st.draws || 0;
                rec.totalLosses += st.losses || 0;
                rec.totalMatches += st.played || 0;
                rec.gameDiff += st.gameDiff || 0;

                if (st.rank === 1 && (st.played || 0) > 0 && !awardedInArchive.has(st.idolId)) {
                  rec.leagueTitles += 1;
                  awardedInArchive.add(st.idolId);
                }
              }
            });
          }
        });
      }
    });

    if (leagueState && Array.isArray(leagueState.leagues)) {
      leagueState.leagues.forEach((l) => {
        (l.standings || []).forEach((st) => {
          if (st && st.idolId && map.has(st.idolId)) {
            const rec = map.get(st.idolId)!;
            rec.leagueMatches += st.played || 0;
            rec.leagueWins += st.wins || 0;
            rec.leagueDraws += st.draws || 0;
            rec.leagueLosses += st.losses || 0;
            rec.leaguePts += st.points || 0;
            rec.totalWins += st.wins || 0;
            rec.totalDraws += st.draws || 0;
            rec.totalLosses += st.losses || 0;
            rec.totalMatches += st.played || 0;
            rec.gameDiff += st.gameDiff || 0;

            if (l.isCompleted && st.rank === 1 && (st.played || 0) > 0) {
              rec.leagueTitles += 1;
            }
          }
        });
      });
    }

    // 3. Process The Idols Superleague & Masters
    (theIdolsArchives || []).forEach((arch) => {
      if (arch.standings && arch.standings.length > 0) {
        const topRegId = arch.standings[0]?.idolId;
        if (topRegId && map.has(topRegId)) {
          map.get(topRegId)!.superleagueTitles += 1;
        }
      }
      if (arch.championId && map.has(arch.championId)) {
        map.get(arch.championId)!.mastersTitles += 1;
      }
      if (arch.runnerUpId && map.has(arch.runnerUpId)) {
        map.get(arch.runnerUpId)!.mastersRunnerUps += 1;
      }

      (arch.standings || []).forEach((st) => {
        if (st && st.idolId && map.has(st.idolId)) {
          const rec = map.get(st.idolId)!;
          rec.superleagueMatches += st.played || 0;
          rec.superleagueWins += st.wins || 0;
          rec.superleagueDraws += st.draws || 0;
          rec.superleagueLosses += st.losses || 0;
          rec.superleaguePts += st.points || 0;
          rec.totalWins += st.wins || 0;
          rec.totalDraws += st.draws || 0;
          rec.totalLosses += st.losses || 0;
          rec.totalMatches += st.played || 0;
          rec.gameDiff += st.goalDiff || 0;
        }
      });

      (arch.playoffMatches || []).forEach((pm) => {
        if (pm && pm.completed && pm.winnerId && map.has(pm.winnerId)) {
          const recWin = map.get(pm.winnerId)!;
          recWin.mastersMatches += 1;
          recWin.mastersWins += 1;
          recWin.totalWins += 1;
          recWin.totalMatches += 1;

          const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
          if (loserId && map.has(loserId)) {
            const recLose = map.get(loserId)!;
            recLose.mastersMatches += 1;
            recLose.mastersLosses += 1;
            recLose.totalLosses += 1;
            recLose.totalMatches += 1;
          }
        }
      });
    });

    if (theIdolsState) {
      if (theIdolsState.isLeagueCompleted && theIdolsState.standings && theIdolsState.standings.length > 0) {
        const topRegId = theIdolsState.standings[0]?.idolId;
        if (topRegId && map.has(topRegId)) {
          map.get(topRegId)!.superleagueTitles += 1;
        }
      }
      if ((theIdolsState.isPlayoffCompleted || theIdolsState.championId) && theIdolsState.championId && map.has(theIdolsState.championId)) {
        map.get(theIdolsState.championId)!.mastersTitles += 1;
      }
      if (theIdolsState.runnerUpId && map.has(theIdolsState.runnerUpId)) {
        map.get(theIdolsState.runnerUpId)!.mastersRunnerUps += 1;
      }

      (theIdolsState.standings || []).forEach((st) => {
        if (st && st.idolId && map.has(st.idolId)) {
          const rec = map.get(st.idolId)!;
          rec.superleagueMatches += st.played || 0;
          rec.superleagueWins += st.wins || 0;
          rec.superleagueDraws += st.draws || 0;
          rec.superleagueLosses += st.losses || 0;
          rec.superleaguePts += st.points || 0;
          rec.totalWins += st.wins || 0;
          rec.totalDraws += st.draws || 0;
          rec.totalLosses += st.losses || 0;
          rec.totalMatches += st.played || 0;
          rec.gameDiff += st.goalDiff || 0;
        }
      });

      (theIdolsState.playoffMatches || []).forEach((pm) => {
        if (pm && pm.completed && pm.winnerId && map.has(pm.winnerId)) {
          const recWin = map.get(pm.winnerId)!;
          recWin.mastersMatches += 1;
          recWin.mastersWins += 1;
          recWin.totalWins += 1;
          recWin.totalMatches += 1;

          const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
          if (loserId && map.has(loserId)) {
            const recLose = map.get(loserId)!;
            recLose.mastersMatches += 1;
            recLose.mastersLosses += 1;
            recLose.totalLosses += 1;
            recLose.totalMatches += 1;
          }
        }
      });
    }

    // Apply Career Overrides if active
    Object.keys(careerOverrides).forEach((id) => {
      const ov = careerOverrides[id];
      if (ov && ov.enabled && map.has(id)) {
        const rec = map.get(id)!;
        if (ov.championships !== undefined) rec.cupTitles = ov.championships;
        if (ov.divisionTitles !== undefined) rec.leagueTitles = ov.divisionTitles;
        if (ov.theIdolsSuperleagueTitles !== undefined) rec.superleagueTitles = ov.theIdolsSuperleagueTitles;
        if (ov.theIdolsMastersTitles !== undefined) rec.mastersTitles = ov.theIdolsMastersTitles;
        if (ov.wins !== undefined) rec.totalWins = ov.wins + (rec.leagueWins || 0) + (rec.superleagueWins || 0);
        if (ov.losses !== undefined) rec.totalLosses = ov.losses + (rec.leagueLosses || 0) + (rec.superleagueLosses || 0);
      }
    });

    // Finalize totals & win rates
    const allRecords = Array.from(map.values()).map((r) => {
      r.totalTitles = r.cupTitles + r.leagueTitles + r.superleagueTitles + r.mastersTitles;
      r.winRate = r.totalMatches > 0 ? Math.round((r.totalWins / r.totalMatches) * 1000) / 10 : 0;
      return r;
    });

    const fallback = allRecords[0] || {
      idol: safeIdols[0] || ({} as Idol),
      cupTitles: 0,
      cupRunnerUps: 0,
      cupMatches: 0,
      cupWins: 0,
      cupWinRate: 0,
      leagueTitles: 0,
      leagueMatches: 0,
      leagueWins: 0,
      leagueDraws: 0,
      leagueLosses: 0,
      leaguePts: 0,
      superleagueTitles: 0,
      superleagueMatches: 0,
      superleagueWins: 0,
      superleagueDraws: 0,
      superleagueLosses: 0,
      superleaguePts: 0,
      mastersTitles: 0,
      mastersRunnerUps: 0,
      mastersMatches: 0,
      mastersWins: 0,
      mastersLosses: 0,
      totalTitles: 0,
      totalMatches: 0,
      totalWins: 0,
      totalDraws: 0,
      totalLosses: 0,
      winRate: 0,
      gameDiff: 0,
    };

    // 1. Most Cup Titles
    const mostCupTitlesRec =
      [...allRecords].sort((a, b) => {
        if (b.cupTitles !== a.cupTitles) return b.cupTitles - a.cupTitles;
        if (b.cupRunnerUps !== a.cupRunnerUps) return b.cupRunnerUps - a.cupRunnerUps;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        return b.winRate - a.winRate;
      })[0] || fallback;

    // 2. Most League Cups (Division Titles)
    const mostLeagueCupsRec =
      [...allRecords].sort((a, b) => {
        if (b.leagueTitles !== a.leagueTitles) return b.leagueTitles - a.leagueTitles;
        if (b.leaguePts !== a.leaguePts) return b.leaguePts - a.leaguePts;
        if (b.leagueWins !== a.leagueWins) return b.leagueWins - a.leagueWins;
        return b.winRate - a.winRate;
      })[0] || fallback;

    // 3. Most Superleague Titles
    const mostSuperleagueRec =
      [...allRecords].sort((a, b) => {
        if (b.superleagueTitles !== a.superleagueTitles) return b.superleagueTitles - a.superleagueTitles;
        if (b.superleaguePts !== a.superleaguePts) return b.superleaguePts - a.superleaguePts;
        if (b.superleagueWins !== a.superleagueWins) return b.superleagueWins - a.superleagueWins;
        return b.winRate - a.winRate;
      })[0] || fallback;

    // 4. Most Masters Champions
    const mostMastersRec =
      [...allRecords].sort((a, b) => {
        if (b.mastersTitles !== a.mastersTitles) return b.mastersTitles - a.mastersTitles;
        if (b.mastersWins !== a.mastersWins) return b.mastersWins - a.mastersWins;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        return b.winRate - a.winRate;
      })[0] || fallback;

    // 5. Most Wins
    const mostWinsRec =
      [...allRecords].sort((a, b) => {
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.totalMatches - a.totalMatches;
      })[0] || fallback;

    // 6. Highest Win Rate (with min matches threshold)
    const maxMatches = Math.max(...allRecords.map((r) => r.totalMatches), 0);
    const minThreshold = maxMatches >= 10 ? 10 : maxMatches >= 5 ? 5 : 1;
    const eligibleWinRateRecords = allRecords.filter((r) => r.totalMatches >= minThreshold);
    const highestWinRateRec =
      [...(eligibleWinRateRecords.length > 0 ? eligibleWinRateRecords : allRecords)].sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
        return b.totalMatches - a.totalMatches;
      })[0] || fallback;

    // 7. Most Losses
    const mostLossesRec =
      [...allRecords].sort((a, b) => {
        if (b.totalLosses !== a.totalLosses) return b.totalLosses - a.totalLosses;
        return b.totalMatches - a.totalMatches;
      })[0] || fallback;

    return {
      allRecords,
      mostCupTitlesRec,
      mostLeagueCupsRec,
      mostSuperleagueRec,
      mostMastersRec,
      mostWinsRec,
      highestWinRateRec,
      mostLossesRec,
    };
  }, [
    safeIdols,
    careerStats,
    leagueArchives,
    leagueState,
    theIdolsArchives,
    theIdolsState,
    hasPendingArchival,
    championIdol,
    v5TitleArchives,
  ]);

  // Record categories definition array
  const recordCategories = useMemo(() => {
    return [
      {
        key: 'cup_titles' as const,
        label: 'Most Cup Titles',
        shortLabel: 'Cup Titles',
        icon: Trophy,
        color: 'amber',
        borderColor: 'border-amber-500/60',
        activeBorder: 'border-amber-400 ring-2 ring-amber-400/40',
        activeBg: 'bg-gradient-to-br from-[#28180c] via-[#1c120a] to-[#120c06]',
        textColor: 'text-amber-300',
        badgeBg: 'bg-amber-500 text-black',
        rec: pinnacleRecords.mostCupTitlesRec,
        statNumber: `${pinnacleRecords.mostCupTitlesRec.cupTitles}`,
        statUnit: `Cup Title${pinnacleRecords.mostCupTitlesRec.cupTitles === 1 ? '' : 's'}`,
        description: 'Champions Tournament & Grand Cup Titles',
      },
      {
        key: 'league_cups' as const,
        label: 'Most League Cups',
        shortLabel: 'League Cups',
        icon: Shield,
        color: 'emerald',
        borderColor: 'border-emerald-500/60',
        activeBorder: 'border-emerald-400 ring-2 ring-emerald-400/40',
        activeBg: 'bg-gradient-to-br from-[#0c2419] via-[#091911] to-[#06110b]',
        textColor: 'text-emerald-300',
        badgeBg: 'bg-emerald-500 text-black',
        rec: pinnacleRecords.mostLeagueCupsRec,
        statNumber: `${pinnacleRecords.mostLeagueCupsRec.leagueTitles}`,
        statUnit: `Division Title${pinnacleRecords.mostLeagueCupsRec.leagueTitles === 1 ? '' : 's'}`,
        description: '6-Division Parallel League Championships',
      },
      {
        key: 'superleague' as const,
        label: 'Most Superleague',
        shortLabel: 'Superleague',
        icon: Star,
        color: 'yellow',
        borderColor: 'border-yellow-500/60',
        activeBorder: 'border-yellow-400 ring-2 ring-yellow-400/40',
        activeBg: 'bg-gradient-to-br from-[#272109] via-[#1b1706] to-[#100e04]',
        textColor: 'text-yellow-300',
        badgeBg: 'bg-yellow-400 text-black',
        rec: pinnacleRecords.mostSuperleagueRec,
        statNumber: `${pinnacleRecords.mostSuperleagueRec.superleagueTitles}`,
        statUnit: `Superleague Title${pinnacleRecords.mostSuperleagueRec.superleagueTitles === 1 ? '' : 's'}`,
        description: 'The Idols 20-Idol Regular Season #1 Finishes',
      },
      {
        key: 'masters' as const,
        label: 'Most Masters Champions',
        shortLabel: 'Masters Champs',
        icon: Crown,
        color: 'purple',
        borderColor: 'border-purple-500/60',
        activeBorder: 'border-purple-400 ring-2 ring-purple-400/40',
        activeBg: 'bg-gradient-to-br from-[#20102b] via-[#150a1d] to-[#0c0512]',
        textColor: 'text-purple-300',
        badgeBg: 'bg-purple-500 text-white',
        rec: pinnacleRecords.mostMastersRec,
        statNumber: `${pinnacleRecords.mostMastersRec.mastersTitles}`,
        statUnit: `Masters Title${pinnacleRecords.mostMastersRec.mastersTitles === 1 ? '' : 's'}`,
        description: 'The Idols Stepped Masters Playoff Championship',
      },
      {
        key: 'most_wins' as const,
        label: 'Most Match Wins',
        shortLabel: 'Most Wins',
        icon: Swords,
        color: 'cyan',
        borderColor: 'border-cyan-500/60',
        activeBorder: 'border-cyan-400 ring-2 ring-cyan-400/40',
        activeBg: 'bg-gradient-to-br from-[#0a232c] via-[#07181f] to-[#040e12]',
        textColor: 'text-cyan-300',
        badgeBg: 'bg-cyan-400 text-black',
        rec: pinnacleRecords.mostWinsRec,
        statNumber: `${pinnacleRecords.mostWinsRec.totalWins}`,
        statUnit: `Total Wins`,
        description: 'All-Time Victory Leader Across All Formats',
      },
      {
        key: 'highest_winrate' as const,
        label: 'Highest Win Rate',
        shortLabel: 'Highest Win%',
        icon: Target,
        color: 'teal',
        borderColor: 'border-teal-500/60',
        activeBorder: 'border-teal-400 ring-2 ring-teal-400/40',
        activeBg: 'bg-gradient-to-br from-[#092520] via-[#061915] to-[#040e0c]',
        textColor: 'text-teal-300',
        badgeBg: 'bg-teal-400 text-black',
        rec: pinnacleRecords.highestWinRateRec,
        statNumber: `${pinnacleRecords.highestWinRateRec.winRate}%`,
        statUnit: `Win Rate`,
        description: 'All-Time Precision & Match Dominance Leader',
      },
      {
        key: 'most_losses' as const,
        label: 'Most Match Losses',
        shortLabel: 'Most Losses',
        icon: HeartCrack,
        color: 'rose',
        borderColor: 'border-rose-500/60',
        activeBorder: 'border-rose-400 ring-2 ring-rose-400/40',
        activeBg: 'bg-gradient-to-br from-[#2b0e14] via-[#1c090d] to-[#110508]',
        textColor: 'text-rose-300',
        badgeBg: 'bg-rose-500 text-white',
        rec: pinnacleRecords.mostLossesRec,
        statNumber: `${pinnacleRecords.mostLossesRec.totalLosses}`,
        statUnit: `Match Losses`,
        description: 'Battle-Tested Resilience & Arena Endurance Veteran',
      },
    ];
  }, [pinnacleRecords]);

  const activeCategory =
    recordCategories.find((c) => c.key === selectedRecordTab) || recordCategories[0];
  const activeRecord = activeCategory.rec;
  const activeIdol = activeRecord.idol;

  // Head to head matches for currently highlighted pinnacle idol
  const activeIdolH2H = useMemo(() => {
    if (!activeIdol?.id) return [];
    return getTopH2HRecordsForIdol(activeIdol.id, safeMatchDatabase, safeIdols, 5);
  }, [activeIdol, safeMatchDatabase, safeIdols]);

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* ---------------------------------------------------------------------
          TIER 1: ARENA COMMAND HEADER & LIVE ACTION STRIP
      --------------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-black bg-gradient-to-r from-[#991b1b] via-[#7f1d1d] to-[#1c1510] p-6 md:p-8 poster-shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-1.5 checkered-banner border-b border-black" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 mt-1">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full poster-pill-gold px-3.5 py-1 text-xs font-black">
              <Sparkles className="h-3.5 w-3.5 text-black" />
              <span>SABUNG IDOL OFFICIAL ARENA PLATFORM</span>
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-2 my-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  autoFocus
                  className="rounded-xl border-2 border-black bg-[#120e0b] px-3 py-1.5 text-xl md:text-2xl font-poster-title text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={handleSaveName}
                  title="Save Tournament Name"
                  className="rounded-lg poster-pill-red p-2 text-white hover:scale-105 transition-all cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  title="Cancel"
                  className="rounded-lg bg-[#282018] border-2 border-black p-2 text-amber-200 hover:text-white transition-all poster-shadow-sm cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-poster-title text-white tracking-wide drop-shadow-[2px_2px_0px_#000]">
                  {safeConfig.seasonName} Headquarters
                </h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  title="Rename Season"
                  className="rounded-lg bg-black/40 p-2 text-amber-300 border-2 border-black hover:bg-black/60 transition-all poster-shadow-sm cursor-pointer"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}

            <p className="text-sm font-poster-body text-amber-100/90 max-w-3xl leading-relaxed font-medium">
              Managing {safeIdols.length} idols across six Division 1 leagues, six Division 2 promotion leagues, and the complete cup circuit.
            </p>
          </div>

          {/* Action Quick Launchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('season_simulator')}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-3 text-xs font-black text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-black"
            >
              <Zap className="h-4 w-4 fill-black" />
              <span>Season Simulator</span>
            </button>

            {!safeConfig.isStarted ? (
              <button
                onClick={() => setActiveTab('competition')}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-black"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Start Cup</span>
              </button>
            ) : !safeConfig.isGroupStageFinished ? (
              <button
                onClick={() => setActiveTab('group_stage')}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-black"
              >
                <Table className="h-4 w-4" />
                <span>Group Stage</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('knockout')}
                className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-xs font-black text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-black"
              >
                <Swords className="h-4 w-4" />
                <span>Knockout Bracket</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('league_system')}
              className="flex items-center gap-2 rounded-xl bg-[#1f1712] hover:bg-[#2c2018] px-4 py-3 text-xs font-bold text-amber-200 hover:text-white border border-black transition-all cursor-pointer"
            >
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Leagues</span>
            </button>

            <button
              onClick={() => setActiveTab('the_idols')}
              className="flex items-center gap-2 rounded-xl bg-[#1f1712] hover:bg-[#2c2018] px-4 py-3 text-xs font-bold text-amber-200 hover:text-white border border-black transition-all cursor-pointer"
            >
              <Star className="h-4 w-4 text-yellow-400" />
              <span>The Idols</span>
            </button>

            <button
              onClick={() => setActiveTab('public_results')}
              className="flex items-center gap-2 rounded-xl border border-black bg-black/50 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-black/70 hover:text-white transition-all cursor-pointer"
            >
              <span>Public View</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          PENDING ARCHIVAL BANNER (Grand Final Ready to Crown)
      --------------------------------------------------------------------- */}
      {hasPendingArchival && (
        <div className="rounded-2xl border-2 border-amber-500 bg-gradient-to-r from-amber-950/80 via-black to-amber-950/80 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-amber-950/40">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl border-2 border-amber-400 overflow-hidden bg-black flex-shrink-0 flex items-center justify-center">
              {championIdol?.photoUrl ? (
                <img src={championIdol.photoUrl} alt={championIdol.name} className="h-full w-full object-cover" />
              ) : (
                <Crown className="h-7 w-7 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-300 uppercase tracking-wider">
                  Season {safeConfig.seasonNumber || safeConfig.seasonId} Grand Final Complete
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                Champion: <span className="text-amber-300">{championIdol?.name}</span> ({championIdol?.girlGroup || 'Solo'})
              </h3>
              <p className="text-xs text-amber-200/70">
                The tournament final has concluded. Crown the champion and archive this season to finalize records and advance.
              </p>
            </div>
          </div>
          {onCrownChampionAndArchive && (
            <button
              onClick={onCrownChampionAndArchive}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 px-6 py-3 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/30 hover:scale-[1.03] active:scale-[0.98] transition-all flex-shrink-0 cursor-pointer border border-black"
            >
              <Crown className="h-4 w-4 fill-slate-950" />
              <span>Crown Champion &amp; Archive Season</span>
            </button>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          TIER 2: ARENA TELEMETRY METRICS (5 High-Contrast Cards)
      --------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border-2 border-black bg-[#16100b] p-4 poster-shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-poster-title text-slate-400 uppercase tracking-wider">
              Total Idols
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-poster-title text-white">{safeIdols.length}</div>
            <p className="mt-0.5 text-[11px] text-amber-300/70 font-semibold truncate">
              Across {safeGirlGroups.length} Girl Groups
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#16100b] p-4 poster-shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-poster-title text-slate-400 uppercase tracking-wider">
              Matches Played
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Swords className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-poster-title text-cyan-300">{totalMatchesAll}</div>
            <p className="mt-0.5 text-[11px] text-slate-400 font-semibold truncate">
              {safeMatchDatabase.length} in historic archive
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#16100b] p-4 poster-shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-poster-title text-slate-400 uppercase tracking-wider">
              Titles Awarded
            </span>
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-poster-title text-amber-300">
              {crownedArchives.length +
                (leagueArchives || []).reduce((acc, a) => acc + (a.leagueWinners?.length || 0), 0) +
                (theIdolsArchives || []).reduce((acc, a) => acc + (a.championId ? 1 : 0) + (a.standings?.length ? 1 : 0), 0) +
                (v5TitleArchives || []).length}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400 font-semibold truncate">
              Cups, Division titles &amp; season honours
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#16100b] p-4 poster-shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-poster-title text-slate-400 uppercase tracking-wider">
              Seasons Completed
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Trophy className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-poster-title text-emerald-300">{totalCompletedSeasons}</div>
            <p className="mt-0.5 text-[11px] text-slate-400 font-semibold truncate">
              {latestCupArchive ? `Latest: ${latestCupArchive.championName}` : 'Season 1 active'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#16100b] p-4 poster-shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-poster-title text-slate-400 uppercase tracking-wider">
              Girl Groups
            </span>
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Crown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl lg:text-3xl font-poster-title text-purple-300">{safeGirlGroups.length}</div>
            <p className="mt-0.5 text-[11px] text-slate-400 font-semibold truncate">Active rosters managed</p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          TIER 3: ARENA PINNACLE RECORDS & ALL-TIME HONORS SHOWCASE (The 7 Pillars!)
      --------------------------------------------------------------------- */}
      <div className="rounded-3xl border-2 border-black bg-[#170e08] p-6 md:p-7 poster-shadow space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-400">
                <Flame className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                ARENA PINNACLE RECORDS &amp; HALL OF HONORS
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-poster-title text-white mt-1">
              All-Time Arena Record Holders
            </h2>
            <p className="text-xs text-amber-100/70 font-medium">
              Click any of the 7 official honors below to inspect their full trophy breakdown and head-to-head records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('all_time_records')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#25170f] hover:bg-[#332015] border-2 border-black text-amber-300 text-xs font-bold transition-all cursor-pointer"
            >
              <span>Full Records Table</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 7 Interactive Record Showcase Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {recordCategories.map((cat) => {
            const isSelected = selectedRecordTab === cat.key;
            const Icon = cat.icon;
            const idol = cat.rec.idol;
            return (
              <div
                key={cat.key}
                onClick={() => setSelectedRecordTab(cat.key)}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer poster-shadow-sm group ${
                  isSelected
                    ? `${cat.activeBorder} ${cat.activeBg} shadow-lg scale-[1.02]`
                    : 'border-black bg-[#120c08] hover:border-amber-500/50 hover:bg-[#18100a]'
                }`}
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border border-black text-[10px] font-black ${cat.badgeBg}`}>
                    <Icon className="h-3 w-3" />
                    <span className="truncate">{cat.shortLabel}</span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-black/60 px-1.5 py-0.5 rounded border border-black font-mono">
                    #1
                  </span>
                </div>

                {/* Idol Avatar & Identity */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-black bg-black shrink-0">
                    {idol?.photoUrl ? (
                      <img
                        src={idol.photoUrl}
                        alt={idol.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs text-amber-300">
                        {(idol?.name || 'ID').slice(0, 2)}
                      </div>
                    )}
                    {idol?.nationality && (
                      <div className="absolute bottom-0 right-0 text-[10px] bg-black/70 px-0.5 rounded">
                        {getCountryFlag(idol.nationality)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-amber-100 truncate font-poster-title">
                      {idol?.name || 'In Progress'}
                    </p>
                    <p className="text-[10px] text-amber-300/70 truncate font-semibold">
                      {idol?.girlGroup || 'Solo'}
                    </p>
                  </div>
                </div>

                {/* Prominent Stat */}
                <div className="pt-2 border-t border-black/60">
                  <div className="text-[10px] font-poster-title text-slate-400 uppercase tracking-wider">
                    {cat.label}
                  </div>
                  <div className={`text-xl font-poster-title font-black ${cat.textColor} leading-tight mt-0.5`}>
                    {cat.statNumber}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {cat.key === 'cup_titles' && `${cat.rec.cupWins} Wins • ${cat.rec.cupWinRate}% Win%`}
                    {cat.key === 'league_cups' && `${cat.rec.leagueWins} Wins • ${cat.rec.leaguePts} PTS`}
                    {cat.key === 'superleague' && `${cat.rec.superleagueWins} Wins • ${cat.rec.superleaguePts} PTS`}
                    {cat.key === 'masters' && `${cat.rec.mastersWins} Playoff Match Wins`}
                    {cat.key === 'most_wins' && `${cat.rec.totalMatches} Matches • ${cat.rec.winRate}%`}
                    {cat.key === 'highest_winrate' && `${cat.rec.totalWins}W - ${cat.rec.totalLosses}L record`}
                    {cat.key === 'most_losses' && `${cat.rec.totalMatches} Matches Fought`}
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-400" />
                )}
              </div>
            );
          })}
        </div>

        {/* Featured Deep-Dive Spotlight Card for the Selected Pinnacle Record */}
        <div className="rounded-2xl border-2 border-black bg-[#120e0b] p-5 md:p-6 poster-shadow-sm space-y-6">
          {/* Spotlight Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black/80 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl border-2 border-black ${activeCategory.badgeBg} shadow-md`}>
                <activeCategory.icon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/40">
                    PINNACLE CATEGORY SPOTLIGHT
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-poster-title text-amber-100 mt-0.5">
                  Idol with the {activeCategory.label}: {activeIdol?.name || 'Season Underway'}
                </h3>
                <p className="text-xs text-slate-400">{activeCategory.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-xl poster-pill-gold px-4 py-2 border-2 border-black text-slate-950 text-xs font-black shadow-md flex items-center gap-1.5">
                <Medal className="h-4 w-4" />
                <span>
                  {activeCategory.statNumber} {activeCategory.statUnit}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Idol Spotlight Profile */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-center gap-4 bg-[#18110c] p-5 rounded-2xl border-2 border-black poster-shadow-sm text-center sm:text-left lg:text-center">
              <div className="relative h-28 w-28 md:h-32 md:w-32 overflow-hidden rounded-2xl border-2 border-black shadow-xl poster-shadow-sm flex-shrink-0 bg-black">
                {activeIdol?.photoUrl ? (
                  <img
                    src={activeIdol.photoUrl}
                    alt={activeIdol.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center font-poster-title text-2xl text-amber-300 bg-black">
                    {(activeIdol?.name || 'ID').slice(0, 2)}
                  </div>
                )}
                {activeIdol?.nationality && (
                  <div className="absolute top-1 right-1 text-xl">
                    {getCountryFlag(activeIdol.nationality)}
                  </div>
                )}
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start lg:justify-center gap-2 flex-wrap">
                  <h4 className="font-poster-title text-xl text-amber-200 leading-tight truncate">
                    {activeIdol?.name || 'Competitor'}
                  </h4>
                  {activeIdol && <RatingBadge idol={activeIdol} size="sm" showTier={true} />}
                </div>

                <p className="text-xs text-red-400 font-black truncate">
                  {activeIdol?.girlGroup || 'Soloist'} &bull; {activeIdol?.seed || 'Seed'}
                </p>

                <p className="text-[11px] text-amber-300/80 font-bold">
                  {activeIdol?.nationality ? `${getCountryFlag(activeIdol.nationality)} ${activeIdol.nationality}` : 'Arena Competitor'}
                </p>

                {/* Overall Splits */}
                <div className="pt-2 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl bg-[#120c08] p-2 border border-black">
                    <span className="text-[10px] text-slate-400 block font-bold">Overall W-D-L</span>
                    <span className="font-poster-title text-sm text-emerald-400 font-mono">
                      {activeRecord.totalWins}-{activeRecord.totalDraws}-{activeRecord.totalLosses}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#120c08] p-2 border border-black">
                    <span className="text-[10px] text-slate-400 block font-bold">All-Time Win%</span>
                    <span className="font-poster-title text-sm text-amber-300 font-mono">
                      {activeRecord.winRate}%
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => setActiveTab('career_stats')}
                  className="w-full mt-2 py-1.5 rounded-xl bg-[#24170f] hover:bg-[#321f14] border border-black text-amber-300 text-xs font-bold transition-all cursor-pointer"
                >
                  View Full Career Profile &rarr;
                </button>
              </div>
            </div>

            {/* Performance Splits & Top Rivalries */}
            <div className="lg:col-span-8 space-y-4">
              {/* 4 Competition Milestone Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#18110c] border border-black/80">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold mb-1">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Tournament Cups</span>
                  </div>
                  <div className="text-lg font-poster-title text-white font-extrabold">
                    {activeRecord.cupTitles} <span className="text-xs text-slate-400 font-normal">Cups</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {activeRecord.cupWins} Wins &bull; {activeRecord.cupMatches} Games
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#18110c] border border-black/80">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold mb-1">
                    <Shield className="h-3.5 w-3.5" />
                    <span>League Cups</span>
                  </div>
                  <div className="text-lg font-poster-title text-white font-extrabold">
                    {activeRecord.leagueTitles} <span className="text-xs text-slate-400 font-normal">Titles</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {activeRecord.leagueWins} Wins &bull; {activeRecord.leaguePts} PTS
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#18110c] border border-black/80">
                  <div className="flex items-center gap-1.5 text-yellow-400 text-xs font-bold mb-1">
                    <Star className="h-3.5 w-3.5" />
                    <span>Superleague</span>
                  </div>
                  <div className="text-lg font-poster-title text-white font-extrabold">
                    {activeRecord.superleagueTitles} <span className="text-xs text-slate-400 font-normal">#1s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {activeRecord.superleagueWins} Wins &bull; {activeRecord.superleaguePts} PTS
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#18110c] border border-black/80">
                  <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold mb-1">
                    <Crown className="h-3.5 w-3.5" />
                    <span>Masters Playoff</span>
                  </div>
                  <div className="text-lg font-poster-title text-white font-extrabold">
                    {activeRecord.mastersTitles} <span className="text-xs text-slate-400 font-normal">Champs</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {activeRecord.mastersWins} Playoff Match Wins
                  </div>
                </div>
              </div>

              {/* Top 5 Head-to-Head Rivalries */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-poster-title text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Swords className="h-3.5 w-3.5 text-red-400" />
                    <span>Signature Head-to-Head Records for {activeIdol?.name}</span>
                  </h4>
                  <span className="text-[11px] text-amber-400/80 font-bold">
                    {activeIdolH2H.length} Rivalries
                  </span>
                </div>

                {activeIdolH2H.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {activeIdolH2H.map((rec) => (
                      <div
                        key={rec.opponentId}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-black bg-[#16100b] hover:border-amber-500/50 transition-all poster-shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 overflow-hidden rounded-xl border border-black bg-slate-900 flex-shrink-0">
                            {rec.opponentPhoto ? (
                              <img
                                src={rec.opponentPhoto}
                                alt={rec.opponentName}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center font-bold text-xs text-amber-400">
                                {(rec.opponentName || 'OP').slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white leading-tight">
                                vs {rec.opponentName}
                              </span>
                              <span className="text-xs">{getCountryFlag(rec.opponentNationality)}</span>
                            </div>
                            <span className="text-[10px] text-amber-400/70 font-semibold">
                              {rec.opponentGroup} &bull; {rec.opponentSeed}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <div className="text-xs font-black text-amber-200 font-mono">
                              {rec.wins}W - {rec.draws}D - {rec.losses}L
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold">
                              {rec.played} Match{rec.played === 1 ? '' : 'es'} &bull; Diff:{' '}
                              {rec.gamesFor - rec.gamesAgainst > 0
                                ? `+${rec.gamesFor - rec.gamesAgainst}`
                                : rec.gamesFor - rec.gamesAgainst}
                            </div>
                          </div>

                          <div className="w-14 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black border font-mono ${
                                rec.winRate >= 60
                                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                                  : rec.winRate >= 40
                                  ? 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                                  : 'bg-red-950/70 text-red-300 border-red-500/40'
                              }`}
                            >
                              {rec.winRate}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-black/80 bg-[#16100b]/50 p-5 text-center text-xs text-slate-500">
                    No head-to-head match history recorded for this idol yet. Complete tournament or league matches to populate rivalry statistics.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          TIER 4: THE BIG THREE ALL-TIME LEGENDS PODIUM
      --------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <h3 className="text-xl font-poster-title text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span>The Big Three: All-Time Legends Podium</span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Combined performance across all tournament brackets and league divisions (Titles, Points &amp; Win Rates).
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#16100b] border-2 border-black">
            <button
              onClick={() => setPodiumView('idols')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                podiumView === 'idols'
                  ? 'bg-amber-500 text-black font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Top Idols
            </button>
            <button
              onClick={() => setPodiumView('groups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                podiumView === 'groups'
                  ? 'bg-amber-500 text-black font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Top Girl Groups
            </button>
          </div>
        </div>

        <KahootPodium
          records={podiumView === 'idols' ? combinedRankings.topIdols : combinedRankings.topGroups}
          type={podiumView === 'idols' ? 'idol' : 'group'}
          title={podiumView === 'idols' ? 'All-Time Greatest Idols' : 'All-Time Greatest Girl Groups'}
          subtitle={
            podiumView === 'idols'
              ? 'Ranked by Championships (100 PTS) + Top 4 / Qualifiers (25 PTS) + Match Wins (3 PTS)'
              : 'Ranked by Total Championships, Combined Group Points & Win Rate across all members'
          }
        />
      </div>

      {/* ---------------------------------------------------------------------
          TIER 5: 6-DIVISION LEAGUES: BRANDED CHAMPIONS & FIFA STANDINGS
      --------------------------------------------------------------------- */}
      {leagueState && leagueState.leagues && (
        <div className="rounded-3xl border-2 border-black bg-[#16100b] p-6 md:p-7 poster-shadow space-y-6">
          {/* Header & View Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-400">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                  6-DIVISION PARALLEL LEAGUE SYSTEM
                </span>
              </div>
              <h3 className="font-poster-title text-2xl md:text-3xl text-white mt-1 flex items-center gap-2">
                <span>Official Champions &amp; FIFA Standings</span>
              </h3>
              <p className="text-xs text-amber-100/70 font-medium">
                Season {leagueState.seasonId || 1} &bull; 6 Parallel Divisions &bull; 20 Idols Per League (Double Round-Robin 38 Matchdays)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex rounded-xl bg-black/50 p-1 border border-black text-xs font-bold">
                <button
                  onClick={() => setDashboardLeagueViewMode('both')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    dashboardLeagueViewMode === 'both'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Both
                </button>
                <button
                  onClick={() => setDashboardLeagueViewMode('standings')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    dashboardLeagueViewMode === 'standings'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Standings Table
                </button>
                <button
                  onClick={() => setDashboardLeagueViewMode('champions')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    dashboardLeagueViewMode === 'champions'
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Champions Banners
                </button>
              </div>

              <button
                onClick={() => setActiveTab('league_system')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow transition-all cursor-pointer border border-black"
              >
                <span>Open League Hub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 6 Branded Division Champions Banner Cards */}
          {(dashboardLeagueViewMode === 'both' || dashboardLeagueViewMode === 'champions') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-poster-title text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Division Champions &amp; Leaders</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  Click any division to inspect its full FIFA-style standings table below
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {leagueWinners.map((win) => {
                  const league = (leagueState?.leagues || []).find((l) => l.id === win.leagueId);
                  const customDef = customLeagueDefs.find((d) => d.id === win.leagueId);
                  const fallbackDef = DEFAULT_LEAGUE_DEFS.find((d) => d.id === win.leagueId);
                  const leagueName = league?.name || customDef?.name || fallbackDef?.name || win.leagueName;
                  const leagueColor = league?.color || customDef?.color || fallbackDef?.color || '#eab308';
                  const leagueLogo = league?.logoUrl || customDef?.logoUrl || fallbackDef?.logoUrl;
                  const tierName = league?.tierName || customDef?.tierName || fallbackDef?.tierName || win.tierName;

                  const completedCount = league?.matches ? league.matches.filter((m) => m?.completed).length : 0;
                  const isFinished = completedCount === (league?.matches?.length || 380) && completedCount > 0;
                  const isSelectedDiv = selectedDashboardDivision === win.leagueId;

                  return (
                    <div
                      key={win.leagueId}
                      onClick={() => setSelectedDashboardDivision(win.leagueId)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 shadow cursor-pointer relative overflow-hidden ${
                        isSelectedDiv
                          ? 'border-amber-400 ring-2 ring-amber-400/40 bg-gradient-to-br from-[#1e150c] to-[#120d08]'
                          : 'border-black bg-[#120e0a] hover:border-amber-500/50 hover:bg-[#18110c]'
                      }`}
                    >
                      {/* Top Bar: Actual League Logo + League Name + Matchday Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {leagueLogo ? (
                            <img
                              src={leagueLogo}
                              alt={leagueName}
                              className="w-7 h-7 rounded-lg object-contain bg-black/60 p-0.5 border border-white/20 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-poster-title text-xs font-black text-black shrink-0 border border-black shadow"
                              style={{ backgroundColor: leagueColor }}
                            >
                              D{win.leagueId}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="font-poster-title text-sm text-white font-bold truncate leading-tight">
                              {leagueName}
                            </div>
                            <div className="text-[10px] text-amber-400 font-medium truncate">
                              {tierName}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                            isFinished
                              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isFinished ? '🏆 Champion' : `MD ${Math.min(38, Math.floor(completedCount / 10) + 1)}/38`}
                        </span>
                      </div>

                      {/* Winner Idol Info */}
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl border-2 border-amber-400/80 bg-black overflow-hidden shadow-lg">
                            {win.championPhoto ? (
                              <img
                                src={win.championPhoto}
                                alt={win.championName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-base text-amber-300 bg-black">
                                {(win.championName || 'ID').slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center font-poster-title text-xs font-black border border-black shadow">
                            #1
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-poster-title text-sm text-white truncate font-bold">
                              {win.championName}
                            </span>
                            {win.championNationality && (
                              <span className="text-xs shrink-0">{getCountryFlag(win.championNationality)}</span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-amber-400/90 truncate">
                            {win.championGroup} {win.championSeed ? `• ${win.championSeed}` : ''}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                            {win.wins}W &bull; {win.draws}D &bull; {win.losses}L &bull; GD {win.gameDiff > 0 ? `+${win.gameDiff}` : win.gameDiff}
                          </div>
                        </div>
                      </div>

                      {/* Points & Stats Footer */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-black/60 text-xs">
                        <span className="font-poster-title text-amber-300 font-bold">
                          {win.points} PTS
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-emerald-400">
                            {win.played > 0 ? Math.round((win.wins / win.played) * 100) : 0}% Win Rate
                          </span>
                          <span className="text-[10px] text-amber-400/80 font-bold underline">
                            View Table &rarr;
                          </span>
                        </div>
                      </div>

                      {isSelectedDiv && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FIFA-Style Full Football Standings Table */}
          {(dashboardLeagueViewMode === 'both' || dashboardLeagueViewMode === 'standings') && (
            <div className="space-y-4 pt-2">
              {/* Division Selector Tabs with Logos */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-poster-title text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>FIFA-Style Complete League Standings</span>
                </h4>

                {/* Division Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-black">
                  {[1, 2, 3, 4, 5, 6].map((divId) => {
                    const l = (leagueState?.leagues || []).find((x) => x.id === divId);
                    const customDef = customLeagueDefs.find((d) => d.id === divId);
                    const fallbackDef = DEFAULT_LEAGUE_DEFS.find((d) => d.id === divId);
                    const lName = l?.name || customDef?.name || fallbackDef?.name || `Division ${divId}`;
                    const lColor = l?.color || customDef?.color || fallbackDef?.color || '#eab308';
                    const lLogo = l?.logoUrl || customDef?.logoUrl || fallbackDef?.logoUrl;
                    const isSelected = selectedDashboardDivision === divId;

                    return (
                      <button
                        key={divId}
                        onClick={() => setSelectedDashboardDivision(divId)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-black shadow-md font-poster-title'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {lLogo ? (
                          <img
                            src={lLogo}
                            alt=""
                            className="w-4 h-4 rounded object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: lColor }}
                          />
                        )}
                        <span>{lName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Division Summary Strip */}
              {activeDashboardLeague && (() => {
                const customDef = customLeagueDefs.find((d) => d.id === activeDashboardLeague.id);
                const fallbackDef = DEFAULT_LEAGUE_DEFS.find((d) => d.id === activeDashboardLeague.id);
                const lName = activeDashboardLeague.name || customDef?.name || fallbackDef?.name || `Division ${activeDashboardLeague.id}`;
                const lLogo = activeDashboardLeague.logoUrl || customDef?.logoUrl || fallbackDef?.logoUrl;
                const lTier = activeDashboardLeague.tierName || customDef?.tierName || fallbackDef?.tierName || 'Tier';
                const completedMatches = activeDashboardLeague.matches
                  ? activeDashboardLeague.matches.filter((m) => m.completed).length
                  : 0;
                const totalMatches = activeDashboardLeague.matches?.length || 380;
                const currentMD = Math.min(38, Math.floor(completedMatches / 10) + (completedMatches % 10 > 0 ? 1 : 0));

                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/40 border border-black">
                    <div className="flex items-center gap-3">
                      {lLogo ? (
                        <img
                          src={lLogo}
                          alt={lName}
                          className="w-9 h-9 rounded-xl object-contain bg-black/80 p-1 border border-white/20 shadow"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-poster-title text-sm font-black text-black border border-black shadow"
                          style={{ backgroundColor: activeDashboardLeague.color || '#eab308' }}
                        >
                          D{activeDashboardLeague.id}
                        </div>
                      )}
                      <div>
                        <div className="font-poster-title text-base text-white font-bold flex items-center gap-2">
                          <span>{lName}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {lTier}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Matchday {currentMD}/38 &bull; {completedMatches}/{totalMatches} matches completed &bull; 20 idols competing
                        </p>
                      </div>
                    </div>

                    {/* Cutoff Legend */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>#1 Champion</span>
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Top 6 Champions Q</span>
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span>7-16 Swiss Play-In</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* The FIFA Table */}
              <div className="overflow-x-auto rounded-2xl border-2 border-black bg-[#100b07] shadow">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-black/70 text-slate-400 font-poster-title uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                      <th className="py-2.5 px-3">Idol / Team</th>
                      <th className="py-2.5 px-2 text-center w-10">P</th>
                      <th className="py-2.5 px-2 text-center w-10">W</th>
                      <th className="py-2.5 px-2 text-center w-10">D</th>
                      <th className="py-2.5 px-2 text-center w-10">L</th>
                      <th className="py-2.5 px-2 text-center w-12 hidden sm:table-cell">GF</th>
                      <th className="py-2.5 px-2 text-center w-12 hidden sm:table-cell">GA</th>
                      <th className="py-2.5 px-2 text-center w-12">GD</th>
                      <th className="py-2.5 px-3 text-center w-14 font-black text-amber-400">PTS</th>
                      <th className="py-2.5 px-3 text-center hidden md:table-cell w-28">Form</th>
                      <th className="py-2.5 px-3 text-right hidden lg:table-cell w-36">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/50">
                    {activeDashboardLeague && activeDashboardLeague.standings && activeDashboardLeague.standings.length > 0 ? (
                      activeDashboardLeague.standings.map((st, idx) => {
                        const rank = st.rank || idx + 1;
                        const idol = idolsMap.get(st.idolId);
                        const isChamp = rank === 1;
                        const isDirectQ = rank <= 6;
                        const isSwissPlayIn = rank >= 7 && rank <= 16;

                        return (
                          <tr
                            key={st.idolId}
                            className={`hover:bg-white/[0.04] transition-colors ${
                              isChamp
                                ? 'bg-amber-950/30 font-semibold'
                                : idx % 2 === 0
                                ? 'bg-transparent'
                                : 'bg-black/20'
                            }`}
                          >
                            {/* Pos */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-black border ${
                                    isChamp
                                      ? 'bg-amber-500 text-black border-black shadow'
                                      : isDirectQ
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                      : isSwissPlayIn
                                      ? 'bg-indigo-950 text-indigo-300 border-indigo-500/40'
                                      : 'bg-slate-900 text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {rank}
                                </span>
                              </div>
                            </td>

                            {/* Idol Profile */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-black bg-black shrink-0">
                                  {st.photoUrl || idol?.photoUrl ? (
                                    <img
                                      src={st.photoUrl || idol?.photoUrl}
                                      alt={st.idolName}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-amber-300">
                                      {(st.idolName || 'ID').slice(0, 2)}
                                    </div>
                                  )}
                                  {isChamp && (
                                    <div className="absolute -top-1 -right-1 text-[10px]">
                                      👑
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-poster-title text-sm text-white font-bold truncate">
                                      {st.idolName}
                                    </span>
                                    {st.nationality && (
                                      <span className="text-xs shrink-0">{getCountryFlag(st.nationality)}</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-amber-300/80 font-medium truncate">
                                    {st.girlGroup || 'Solo'} {st.seed ? `• ${st.seed}` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* P, W, D, L */}
                            <td className="py-2.5 px-2 text-center font-mono text-slate-300">{st.played}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-emerald-400 font-bold">{st.wins}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400">{st.draws}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-rose-400 font-bold">{st.losses}</td>

                            {/* GF, GA, GD */}
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400 hidden sm:table-cell">
                              {st.gamesFor ?? 0}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400 hidden sm:table-cell">
                              {st.gamesAgainst ?? 0}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold">
                              <span
                                className={
                                  (st.gameDiff ?? 0) > 0
                                    ? 'text-emerald-400'
                                    : (st.gameDiff ?? 0) < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-400'
                                }
                              >
                                {(st.gameDiff ?? 0) > 0 ? `+${st.gameDiff}` : st.gameDiff ?? 0}
                              </span>
                            </td>

                            {/* Points */}
                            <td className="py-2.5 px-3 text-center font-mono font-black text-amber-300 text-sm">
                              {st.points}
                            </td>

                            {/* Form */}
                            <td className="py-2.5 px-3 text-center hidden md:table-cell">
                              <div className="flex items-center justify-center gap-1">
                                {st.form && st.form.length > 0 ? (
                                  st.form.slice(-5).map((res, fIdx) => (
                                    <span
                                      key={fIdx}
                                      className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center border ${
                                        res === 'W'
                                          ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50'
                                          : res === 'D'
                                          ? 'bg-slate-800 text-slate-300 border-slate-600'
                                          : 'bg-rose-950 text-rose-400 border-rose-500/50'
                                      }`}
                                    >
                                      {res}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-600 font-mono text-[10px]">-</span>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 text-right hidden lg:table-cell">
                              {isChamp ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black border border-black shadow">
                                  👑 Champion
                                </span>
                              ) : isDirectQ ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                  ✓ Champions 64
                                </span>
                              ) : isSwissPlayIn ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                  ⚡ Swiss Play-In
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-700">
                                  League Stage
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                          No standings generated yet for this division. Run matches in League System or use 1-Click Season Simulator!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          DIVISION 2: PROMOTION RACE OVERVIEW
      --------------------------------------------------------------------- */}
      <section className="rounded-3xl border-2 border-black bg-[#170e08] p-5 md:p-6 poster-shadow space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b-2 border-black pb-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-[11px] font-black uppercase tracking-wider">
              <ArrowRight className="h-4 w-4" /> DIVISION 2 / PROMOTION TRACKER
            </div>
            <h2 className="mt-1 text-2xl md:text-3xl font-poster-title text-white">Division 2 Promotion Race</h2>
            <p className="mt-1 text-xs text-amber-100/65">Top {promotionSlots} in each Division 2 league earn promotion to the corresponding Division 1 league. Division 2 has no Swiss Play-In or Grand Cup qualification route.</p>
          </div>
          <button onClick={() => setActiveTab('division_two')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-black border border-black hover:bg-amber-400 transition-colors">
            Manage Division 2 <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#100b07] border border-black p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">D2 Leagues</div><div className="mt-1 text-2xl font-poster-title text-white">{divisionTwoLeagues.length}/6</div></div>
          <div className="rounded-xl bg-[#100b07] border border-black p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Idols in D2</div><div className="mt-1 text-2xl font-poster-title text-white">{divisionTwoLeagues.reduce((n, league) => n + (league.memberIds || []).length, 0)}</div></div>
          <div className="rounded-xl bg-[#100b07] border border-black p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Promotion Slots</div><div className="mt-1 text-2xl font-poster-title text-emerald-300">{promotionSlots * divisionTwoLeagues.length}</div></div>
          <div className="rounded-xl bg-[#100b07] border border-black p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">D2 Matches</div><div className="mt-1 text-2xl font-poster-title text-amber-300">{divisionTwoCompletedMatches}<span className="text-sm text-slate-500">/{divisionTwoTotalMatches}</span></div></div>
        </div>

        {divisionTwoLeagues.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {divisionTwoLeagues.map((league) => {
                const top = league.standings.slice(0, promotionSlots);
                const completed = (league.matches || []).filter((match) => match.completed).length;
                const total = (league.matches || []).length;
                const isSelected = league.parentLeagueId === selectedDashboardDivision;
                return <button key={league.id} onClick={() => setSelectedDashboardDivision(league.parentLeagueId)} className={`text-left rounded-2xl border-2 p-4 transition-colors ${isSelected ? 'border-amber-400 bg-[#21170d]' : 'border-black bg-[#100b07] hover:border-amber-500/50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="text-[10px] text-amber-400 uppercase tracking-wider font-black">{league.name}</div><div className="mt-1 text-xs text-slate-500">{league.memberIds.length} registered idols · {completed}/{total} matches</div></div>
                    <span className="text-[10px] rounded-lg bg-emerald-950 px-2 py-1 text-emerald-300 border border-emerald-800">{top.length} promotion candidates</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {top.length ? top.map((standing, index) => {
                      const idol = idolsMap.get(standing.idolId);
                      return <div key={standing.idolId} className="flex items-center gap-2 text-xs"><span className="w-5 text-center font-mono font-black text-emerald-300">{index + 1}</span><span className="h-7 w-7 rounded-lg overflow-hidden bg-black border border-black shrink-0">{(idol?.photoUrl || standing.photoUrl) ? <img src={idol?.photoUrl || standing.photoUrl} alt="" className="h-full w-full object-cover" /> : null}</span><span className="min-w-0 flex-1 truncate text-white font-bold">{standing.idolName || idol?.name || 'Unknown Idol'}</span><span className="font-mono text-amber-300">{standing.points ?? 0} PTS</span></div>;
                    }) : <p className="text-xs text-slate-500">Standings are not available yet.</p>}
                  </div>
                </button>;
              })}
            </div>

            {activeDashboardDivisionTwo && <div className="overflow-hidden rounded-2xl border-2 border-black bg-[#100b07]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border-b border-black">
                <div><h3 className="font-poster-title text-lg text-white">{activeDashboardDivisionTwo.name} Standings</h3><p className="text-[11px] text-slate-500">Top {promotionSlots} promote to {leagueState?.leagues.find((league) => league.id === activeDashboardDivisionTwo.parentLeagueId)?.name || `Division 1 League ${activeDashboardDivisionTwo.parentLeagueId}`}. No Swiss stage is used in Division 2.</p></div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Promotion zone: 1-{promotionSlots}</span>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-black/60 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2 text-center">Pos</th><th className="px-3 py-2">Idol</th><th className="px-2 py-2 text-center">P</th><th className="px-2 py-2 text-center">W</th><th className="px-2 py-2 text-center">D</th><th className="px-2 py-2 text-center">L</th><th className="px-2 py-2 text-center">GD</th><th className="px-3 py-2 text-center">PTS</th><th className="px-3 py-2 text-right">Status</th></tr></thead><tbody className="divide-y divide-black/60">{activeDashboardDivisionTwo.standings.map((standing, index) => { const rank = standing.rank || index + 1; const promoted = rank <= promotionSlots; const idol = idolsMap.get(standing.idolId); return <tr key={standing.idolId} className={promoted ? 'bg-emerald-950/20' : 'hover:bg-white/[0.03]'}><td className="px-3 py-2 text-center font-mono text-slate-400">{rank}</td><td className="px-3 py-2"><div className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg overflow-hidden bg-black shrink-0">{(idol?.photoUrl || standing.photoUrl) ? <img src={idol?.photoUrl || standing.photoUrl} alt="" className="h-full w-full object-cover" /> : null}</span><span className="font-bold text-white">{standing.idolName || idol?.name || 'Unknown Idol'}</span></div></td><td className="px-2 py-2 text-center font-mono text-slate-300">{standing.played ?? 0}</td><td className="px-2 py-2 text-center font-mono text-emerald-300">{standing.wins ?? 0}</td><td className="px-2 py-2 text-center font-mono text-slate-400">{standing.draws ?? 0}</td><td className="px-2 py-2 text-center font-mono text-rose-300">{standing.losses ?? 0}</td><td className="px-2 py-2 text-center font-mono text-slate-300">{(standing.gameDiff ?? 0) > 0 ? `+${standing.gameDiff}` : standing.gameDiff ?? 0}</td><td className="px-3 py-2 text-center font-mono font-black text-amber-300">{standing.points ?? 0}</td><td className="px-3 py-2 text-right">{promoted ? <span className="rounded-full bg-emerald-950 px-2 py-1 text-[10px] font-black text-emerald-300 border border-emerald-800">PROMOTION ZONE</span> : <span className="text-[10px] text-slate-500">Division 2</span>}</td></tr>; })}</tbody></table></div>
            </div>}
          </>
        ) : <div className="rounded-2xl border border-dashed border-amber-500/30 bg-[#100b07] p-8 text-center"><h3 className="font-poster-title text-lg text-white">Division 2 has not been configured</h3><p className="mt-2 text-xs text-slate-500">Create and configure the six Division 2 rosters in Settings. The dashboard will display promotion standings here.</p><button onClick={() => setActiveTab('settings')} className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-black">Open Settings</button></div>}

        <div className="rounded-xl border border-black bg-black/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-[11px] text-slate-400">Cup circuit activity: <span className="font-bold text-amber-300">{v5CompletedCupMatches}/{v5CupMatchCount}</span> V5 cup matches completed across Champions Cup, League Cup, Mini Cups and Super Cups.</div>
          <button onClick={() => setActiveTab('v5_cups')} className="text-xs font-bold text-amber-300 hover:text-white inline-flex items-center gap-1">Open Cup Circuit <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      </section>

      {/* ---------------------------------------------------------------------
          TIER 6: REIGNING CHAMPIONS & RECENT MATCH ACTIVITY
      --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reigning Champions Spotlight Card */}
        <div className="rounded-2xl border-2 border-black bg-[#16100b] p-6 flex flex-col justify-between poster-shadow-sm space-y-4">
          <div>
            <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                <h3 className="font-poster-title text-lg text-white">Reigning Champions</h3>
              </div>
              {latestCupArchive && (
                <span className="text-xs text-amber-300 font-mono font-bold">
                  Season {latestCupArchive.seasonId}
                </span>
              )}
            </div>

            {/* Cup Champion */}
            {latestCupArchive ? (
              <div className="flex flex-col items-center text-center py-2 border-b border-black pb-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-4 border-amber-400/80 shadow-xl ring-4 ring-amber-400/10 mb-3 bg-black flex items-center justify-center">
                  {idols.find((i) => i.id === latestCupArchive.championId)?.photoUrl || (latestCupArchive as any).championPhoto ? (
                    <img
                      src={
                        idols.find((i) => i.id === latestCupArchive.championId)?.photoUrl ||
                        (latestCupArchive as any).championPhoto
                      }
                      alt={latestCupArchive.championName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-poster-title text-2xl text-amber-300 bg-black">
                      {latestCupArchive.championName?.slice(0, 2) || 'CH'}
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-poster-title text-white">
                  {latestCupArchive.championName}
                </h4>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mt-0.5">
                  Champions Tournament Cup Winner
                </p>

                <div className="mt-4 w-full grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-[#120e0b] p-2 border border-black text-center">
                    <span className="text-slate-400 block text-[10px]">Runner-Up</span>
                    <span className="font-bold text-slate-200 truncate block">{latestCupArchive.runnerUpName}</span>
                  </div>
                  <div className="rounded-xl bg-[#120e0b] p-2 border border-black text-center">
                    <span className="text-slate-400 block text-[10px]">3rd Place</span>
                    <span className="font-bold text-slate-200 truncate block">{latestCupArchive.thirdPlaceName}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 space-y-1">
                <Trophy className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold">No Cup Champion crowned yet</p>
                <p className="text-[11px] text-slate-500">Complete the Cup Tournament to crown Season 1 champion!</p>
              </div>
            )}

            {/* Masters Champion (if exists) */}
            {latestV5Title && (
              <div className="pt-3 border-t border-black/60">
                <div className="flex items-center gap-2 mb-2">
                  <Medal className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-poster-title text-emerald-300">Latest Cup Circuit / Division Champion: {latestV5Title.winnerName}</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2 bg-[#120e0b] p-2 rounded-xl border border-black">
                  <span className="truncate">{latestV5Title.competition}</span>
                  <span className="shrink-0">Season {latestV5Title.seasonNumber}</span>
                </div>
              </div>
            )}

            {latestTheIdolsChampion && (
              <div className="pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-poster-title text-yellow-300">
                    The Idols Masters Champion: {latestTheIdolsChampion.championName}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between bg-[#120e0b] p-2 rounded-xl border border-black">
                  <span>Runner-up: {latestTheIdolsChampion.runnerUpName || 'N/A'}</span>
                  <span>Season {latestTheIdolsChampion.seasonNumber}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setActiveTab('hall_of_champions')}
            className="w-full py-2.5 rounded-xl border-2 border-black bg-[#1e150f] hover:bg-[#2c1d14] text-xs font-bold text-amber-300 hover:text-white transition-colors cursor-pointer"
          >
            View Hall of Champions &rarr;
          </button>
        </div>

        {/* Recent Matches Feed with Competition Filters */}
        <div className="lg:col-span-2 rounded-2xl border-2 border-black bg-[#16100b] p-6 poster-shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-400" />
                <h3 className="font-poster-title text-lg text-white">Recent Match Results Feed</h3>
              </div>

              {/* Competition Filter Buttons */}
              <div className="flex items-center gap-1 bg-[#120e0b] p-1 rounded-xl border border-black text-xs font-bold">
                <button
                  onClick={() => setRecentMatchFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    recentMatchFilter === 'all'
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRecentMatchFilter('cup')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    recentMatchFilter === 'cup'
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cups
                </button>
                <button
                  onClick={() => setRecentMatchFilter('league')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    recentMatchFilter === 'league'
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Leagues
                </button>
                <button
                  onClick={() => setRecentMatchFilter('the_idols')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    recentMatchFilter === 'the_idols'
                      ? 'bg-amber-500 text-black font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Superleague
                </button>
              </div>
            </div>

            {filteredRecentMatches.length > 0 ? (
              <div className="space-y-2.5">
                {filteredRecentMatches.map((m) => (
                  <div
                    key={m.matchId}
                    className="flex items-center justify-between p-3 rounded-xl border border-black bg-[#120e0b] hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-indigo-500/15 px-2 py-1 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                        {m.stage}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        Season {m.seasonId}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold">
                      <span
                        className={
                          m.winnerId === m.idolAId
                            ? 'text-emerald-400 font-black'
                            : 'text-slate-300'
                        }
                      >
                        {m.idolAName}
                      </span>
                      <span className="rounded-lg bg-black px-2.5 py-1 font-mono text-xs text-amber-300 border border-black">
                        {m.scoreA} - {m.scoreB}
                      </span>
                      <span
                        className={
                          m.winnerId === m.idolBId
                            ? 'text-emerald-400 font-black'
                            : 'text-slate-300'
                        }
                      >
                        {m.idolBName}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <BarChart3 className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold">No matches recorded for this filter yet</p>
                <p className="text-xs text-slate-500">
                  Matches simulated across tournaments, leagues, and superleagues will populate live here.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-black/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing latest {filteredRecentMatches.length} match outcomes
            </span>
            <button
              onClick={() => setActiveTab('match_db')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Explore Match Database</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
