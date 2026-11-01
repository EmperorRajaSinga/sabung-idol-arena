import React, { useState, useMemo } from 'react';
import {
  Idol,
  GirlGroup,
  TournamentConfig,
  LeagueInfo,
  LeagueMatch,
  LeagueStanding,
  LeagueSeasonState,
  LeagueSeasonArchive,
  LeagueQualifierEntry,
  ActiveTab,
  WildcardPlayInState,
  SwissPlayInState,
  PostseasonFormatType,
} from '../types';
import {
  calculateLeagueStandings,
  getTop32Qualifiers,
  getLeagueWinners,
  initializeLeagueSeason,
  resetLeagueSeasonMatchesOnly,
  saveLeagueSeasonState,
  saveLeagueArchives,
  loadLeagueArchives,
  saveSavedTop32Qualifiers,
  simulateLeagueMatch,
  loadCustomLeagueBranding,
  DEFAULT_LEAGUE_DEFS,
  generateWildcardPlayIn,
  simulateWildcardMatch,
  updateWildcardMatchResult,
  simulateAllWildcardMatches,
  resetWildcardPlayIn,
} from '../utils/leagueLogic';
import {
  generateSwissPlayIn,
  getGrandCup64Qualifiers,
  randomizeSwissRound1Draw,
} from '../utils/swissLogic';
import { exportLeagueDatabaseToJSON } from '../utils/storage';
import { getIdolRating } from '../utils/ratingHelper';
import { MatchModal } from './MatchModal';
import { LeagueRosterModal } from './LeagueRosterModal';
import { WildcardPlayInBracket } from './WildcardPlayInBracket';
import { SwissPlayInBracket } from './SwissPlayInBracket';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { MatchdayLiveSimulatorModal } from './MatchdayLiveSimulatorModal';
import { LiveMatchVisualizer } from './LiveMatchVisualizer';
import { LeagueStandingsDownloadModal } from './LeagueStandingsDownloadModal';
import { MatchdayDownloadModal } from './MatchdayDownloadModal';
import { getCountryFlag } from '../utils/nationalityHelper';
import {
  Trophy,
  Swords,
  Table,
  Play,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Crown,
  FastForward,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Star,
  Gamepad2,
  X,
  Users,
  Shuffle,
  ArrowUpDown,
  Clipboard,
  Trash2,
  Download,
  Radio,
  Tv,
  Activity,
  Flame,
  Layers,
  Calendar,
} from 'lucide-react';

interface LeagueSystemPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  config: TournamentConfig;
  leagueState: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  onUpdateLeagueState: (newState: LeagueSeasonState) => void;
  onUpdateLeagueArchives?: (archives: LeagueSeasonArchive[]) => void;
  onAdvanceToChampionsTournament: (qualifiers: LeagueQualifierEntry[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onUpdateFavoriteIdols?: (favoriteIds: string[]) => void;
  onUpdateIdols?: (idols: Idol[]) => void;
  persistState?: boolean;
  divisionLabel?: string;
  hidePostseason?: boolean;
}

export const LeagueSystemPanel: React.FC<LeagueSystemPanelProps> = ({
  idols,
  girlGroups,
  config,
  leagueState,
  leagueArchives = [],
  onUpdateLeagueState,
  onUpdateLeagueArchives,
  onAdvanceToChampionsTournament,
  setActiveTab,
  onUpdateFavoriteIdols,
  onUpdateIdols,
  persistState = true,
  divisionLabel = 'Division 1',
  hidePostseason = false,
}) => {
  // Ensure we have a valid state
  const state: LeagueSeasonState = useMemo(() => {
    const customDefs = loadCustomLeagueBranding();
    if (leagueState && leagueState.leagues && leagueState.leagues.length === 6) {
      const mergedLeagues = leagueState.leagues.map((l) => {
        const c = customDefs.find((item) => item.id === l.id);
        const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === l.id) || DEFAULT_LEAGUE_DEFS[0];
        return {
          ...l,
          name: c?.name || l.name || def.name,
          tierName: c?.tierName || l.tierName || def.tierName,
          color: c?.color || l.color || def.color,
          logoUrl: c?.logoUrl !== undefined ? c.logoUrl : (l.logoUrl || def.logoUrl || ''),
          description: c?.description !== undefined ? c.description : (l.description || def.description || ''),
        };
      });
      return {
        ...leagueState,
        leagues: mergedLeagues,
      };
    }
    return initializeLeagueSeason(idols, girlGroups, 1);
  }, [leagueState, idols, girlGroups]);

  const [activeLeagueId, setActiveLeagueId] = useState<number>(() => state.leagues[0]?.id || 1);
  const [selectedMatchday, setSelectedMatchday] = useState<number>(1);
  const [leagueViewMode, setLeagueViewMode] = useState<'divisions' | 'wildcard'>('divisions');
  const [postseasonFormat, setPostseasonFormat] = useState<PostseasonFormatType>(
    state?.postseasonFormat || 'grand_cup_64'
  );
  const [selectedMatch, setSelectedMatch] = useState<{
    leagueId: number;
    match: LeagueMatch;
  } | null>(null);
  const [showQualifiersModal, setShowQualifiersModal] = useState<boolean>(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState<boolean>(false);
  const [showRosterModal, setShowRosterModal] = useState<boolean>(false);
  const [showStandingsDownloadModal, setShowStandingsDownloadModal] = useState<boolean>(false);
  const [showMatchdayDownloadModal, setShowMatchdayDownloadModal] = useState<boolean>(false);
  const [favoriteSearch, setFavoriteSearch] = useState<string>('');
  const [simAlertMessage, setSimAlertMessage] = useState<string | null>(null);

  const [showMatchdayLiveSimModal, setShowMatchdayLiveSimModal] = useState<boolean>(false);
  const [liveSpotlightMatch, setLiveSpotlightMatch] = useState<{
    leagueId: number;
    match: LeagueMatch;
    idolA: Idol;
    idolB: Idol;
  } | null>(null);

  const favoriteSet = useMemo(() => {
    return new Set<string>(config?.favoriteIdolIds || []);
  }, [config?.favoriteIdolIds]);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  const activeLeague = useMemo(() => {
    return state.leagues.find((l) => l.id === activeLeagueId) || state.leagues[0];
  }, [state.leagues, activeLeagueId]);

  // Form history lookup map per idol from active league standings
  const idolFormMap = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    if (activeLeague && activeLeague.standings) {
      activeLeague.standings.forEach((st) => {
        map.set(st.idolId, st.form || []);
      });
    }
    return map;
  }, [activeLeague]);

  // Wildcard Play-In State (Double Elimination Bracket for 6th-place contenders)
  const wildcardPlayIn: WildcardPlayInState = useMemo(() => {
    return generateWildcardPlayIn(state.leagues, idols, state.wildcardPlayIn);
  }, [state.leagues, idols, state.wildcardPlayIn]);

  // Swiss Play-In State (6 Swiss Pools of 10 Idols for 7th-16th contenders)
  const swissPlayIn: SwissPlayInState = useMemo(() => {
    return generateSwissPlayIn(state.leagues, idols, state.swissPlayIn);
  }, [state.leagues, idols, state.swissPlayIn]);

  // Matches for active league and selected matchday
  const matchdayMatches = useMemo(() => {
    if (!activeLeague) return [];
    return activeLeague.matches.filter((m) => m.matchday === selectedMatchday);
  }, [activeLeague, selectedMatchday]);

  // Overall statistics for active league
  const activeLeagueCompletedMatches = useMemo(() => {
    if (!activeLeague || !Array.isArray(activeLeague.matches)) return 0;
    return activeLeague.matches.filter((m) => m?.completed).length;
  }, [activeLeague]);

  const totalMatchesInLeague = activeLeague && Array.isArray(activeLeague.matches) ? activeLeague.matches.length : 380;
  const isLeagueComplete = activeLeagueCompletedMatches === totalMatchesInLeague && totalMatchesInLeague > 0;

  // Max matchdays in active league
  const totalMatchdays = useMemo(() => {
    if (!activeLeague || !Array.isArray(activeLeague.matches) || activeLeague.matches.length === 0) return 38;
    const maxMd = Math.max(...activeLeague.matches.map((m) => m?.matchday || 1), 38);
    return maxMd;
  }, [activeLeague]);

  // Top 32 qualifiers across all 6 leagues (30 Automatic Top 5 + 2 Wildcard Play-In Qualifiers)
  const top32Qualifiers = useMemo(() => {
    const quals = getTop32Qualifiers(state?.leagues || [], idols, wildcardPlayIn);
    if (quals && quals.length >= 32 && postseasonFormat === 'classic_32') {
      saveSavedTop32Qualifiers(quals);
    }
    return quals;
  }, [state?.leagues, idols, wildcardPlayIn, postseasonFormat]);

  // Grand Cup 64 qualifiers (36 Automatic Top 6 + 28 Swiss Play-In Qualifiers)
  const grandCup64Qualifiers = useMemo(() => {
    const quals = getGrandCup64Qualifiers(state?.leagues || [], idols, swissPlayIn);
    if (quals && quals.length >= 64 && postseasonFormat === 'grand_cup_64') {
      saveSavedTop32Qualifiers(quals);
    }
    return quals;
  }, [state?.leagues, idols, swissPlayIn, postseasonFormat]);

  // Active qualifiers according to the selected format
  const activeQualifiers = useMemo(() => {
    return postseasonFormat === 'grand_cup_64' ? grandCup64Qualifiers : top32Qualifiers;
  }, [postseasonFormat, grandCup64Qualifiers, top32Qualifiers]);

  // Top 4 17th-place wildcard qualifiers across all 6 leagues
  const rank17WildcardIdolIds = useMemo(() => {
    if (!state?.leagues || state.leagues.length === 0) return new Set<string>();
    const candidates: Array<{
      idolId: string;
      points: number;
      gameDiff: number;
      gamesFor: number;
      rating: number;
    }> = [];
    state.leagues.forEach((l) => {
      const st17 = l.standings?.[16];
      if (st17) {
        const idol = idolsMap.get(st17.idolId);
        candidates.push({
          idolId: st17.idolId,
          points: st17.points || 0,
          gameDiff: st17.gameDiff || 0,
          gamesFor: st17.gamesFor || 0,
          rating: idol ? getIdolRating(idol) : 75,
        });
      }
    });
    candidates.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.gamesFor - a.gamesFor;
    });
    return new Set(candidates.slice(0, 4).map((c) => c.idolId));
  }, [state?.leagues, idolsMap]);

  // Total completed matches across all 6 leagues
  const totalAllMatches = useMemo(() => {
    return (state?.leagues || []).reduce((acc, l) => acc + (l?.matches?.length || 0), 0) || 2280;
  }, [state?.leagues]);
  const completedAllMatches = useMemo(() => {
    return (state?.leagues || []).reduce(
      (acc, l) => acc + (l?.matches || []).filter((m) => m?.completed).length,
      0
    );
  }, [state?.leagues]);

  const isAllLeaguesFinished = completedAllMatches === totalAllMatches && totalAllMatches > 0;

  // Toggle favorite idol
  const handleToggleFavorite = (idolId: string) => {
    if (!onUpdateFavoriteIdols) return;
    const currentFavs = config?.favoriteIdolIds || [];
    if (currentFavs.includes(idolId)) {
      onUpdateFavoriteIdols(currentFavs.filter((id) => id !== idolId));
    } else {
      if (currentFavs.length >= 4) {
        alert('You can select up to 4 favorite idols.');
        return;
      }
      onUpdateFavoriteIdols([...currentFavs, idolId]);
    }
  };

  // Update match handler
  const handleUpdateMatch = (
    leagueId: number,
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string
  ) => {
    const updatedLeagues = state.leagues.map((l) => {
      if (l.id !== leagueId) return l;

      const updatedMatches = l.matches.map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA,
            scoreB,
            winnerId: scoreA === scoreB ? null : winnerId,
            completed: true,
            updatedAt: new Date().toISOString(),
          };
        }
        return m;
      });

      const updatedStandings = calculateLeagueStandings(
        l.id,
        l.memberIds,
        updatedMatches,
        idols
      );

      return {
        ...l,
        matches: updatedMatches,
        standings: updatedStandings,
      };
    });

    const isAllComplete = updatedLeagues.every((l) =>
      l.matches.every((m) => m.completed)
    );

    const newState: LeagueSeasonState = {
      ...state,
      leagues: updatedLeagues,
      isCompleted: isAllComplete,
    };

    onUpdateLeagueState(newState);
    if (persistState) saveLeagueSeasonState(newState);
  };

  // Quick simulate single match
  const handleSimulateMatch = (leagueId: number, match: LeagueMatch) => {
    const idolA = idolsMap.get(match.idolAId);
    const idolB = idolsMap.get(match.idolBId);
    if (!idolA || !idolB) return;

    const formA = idolFormMap.get(idolA.id) || [];
    const formB = idolFormMap.get(idolB.id) || [];
    const sim = simulateLeagueMatch(idolA, idolB, formA, formB);
    handleUpdateMatch(leagueId, match.id, sim.scoreA, sim.scoreB, sim.winnerId || '');
  };

  // Apply all 10 results from the Matchday Live Simulcast
  const handleApplyLiveSimulatedMatchday = (completedMatchList: LeagueMatch[]) => {
    if (!activeLeague) return;

    const completedMap = new Map<string, LeagueMatch>();
    completedMatchList.forEach((m) => completedMap.set(m.id, m));

    const updatedMatches = activeLeague.matches.map((m) => {
      const liveRes = completedMap.get(m.id);
      if (liveRes && liveRes.completed) {
        return {
          ...m,
          scoreA: liveRes.scoreA,
          scoreB: liveRes.scoreB,
          winnerId: liveRes.winnerId,
          completed: true,
          updatedAt: new Date().toISOString(),
        };
      }
      return m;
    });

    const updatedStandings = calculateLeagueStandings(
      activeLeague.id,
      activeLeague.memberIds,
      updatedMatches,
      idols
    );

    const updatedLeagues = state.leagues.map((l) =>
      l.id === activeLeague.id
        ? { ...l, matches: updatedMatches, standings: updatedStandings }
        : l
    );

    const isAllComplete = updatedLeagues.every((l) =>
      l.matches.every((m) => m.completed)
    );

    const newState: LeagueSeasonState = {
      ...state,
      leagues: updatedLeagues,
      isCompleted: isAllComplete,
    };

    onUpdateLeagueState(newState);
    if (persistState) saveLeagueSeasonState(newState);
    setShowMatchdayLiveSimModal(false);
  };

  // Simulate current matchday (10 matches) - pausing for favorite idols
  const handleSimulateMatchday = () => {
    if (!activeLeague) return;

    const uncompleted = matchdayMatches.filter((m) => !m.completed);
    if (uncompleted.length === 0) return;

    const updatedMatches = [...activeLeague.matches];
    let skippedFavoritesCount = 0;

    uncompleted.forEach((match) => {
      if (favoriteSet.has(match.idolAId) || favoriteSet.has(match.idolBId)) {
        skippedFavoritesCount++;
        return;
      }
      const idolA = idolsMap.get(match.idolAId);
      const idolB = idolsMap.get(match.idolBId);
      if (idolA && idolB) {
        const formA = idolFormMap.get(idolA.id) || [];
        const formB = idolFormMap.get(idolB.id) || [];
        const sim = simulateLeagueMatch(idolA, idolB, formA, formB);
        const idx = updatedMatches.findIndex((m) => m.id === match.id);
        if (idx !== -1) {
          updatedMatches[idx] = {
            ...match,
            scoreA: sim.scoreA,
            scoreB: sim.scoreB,
            winnerId: sim.scoreA === sim.scoreB ? null : sim.winnerId,
            completed: true,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    });

    const updatedStandings = calculateLeagueStandings(
      activeLeague.id,
      activeLeague.memberIds,
      updatedMatches,
      idols
    );

    const updatedLeagues = state.leagues.map((l) =>
      l.id === activeLeague.id
        ? { ...l, matches: updatedMatches, standings: updatedStandings }
        : l
    );

    const isAllComplete = updatedLeagues.every((l) =>
      l.matches.every((m) => m.completed)
    );

    const newState: LeagueSeasonState = {
      ...state,
      leagues: updatedLeagues,
      isCompleted: isAllComplete,
    };

    onUpdateLeagueState(newState);
    if (persistState) saveLeagueSeasonState(newState);

    if (skippedFavoritesCount > 0) {
      setSimAlertMessage(
        `Simulation paused for ${skippedFavoritesCount} match(es) featuring your favorite idol(s) on Matchday ${selectedMatchday}! Please play them manually.`
      );
    } else {
      setSimAlertMessage(null);
    }
  };

  // Simulate entire active league (all 38 matchdays) chronologically with dynamic form progression
  const handleSimulateActiveLeague = () => {
    if (!activeLeague) return;

    let skippedFavoritesCount = 0;

    // Build rolling form map initialized from currently completed matches
    const rollingFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();
    (activeLeague.standings || []).forEach((st) => {
      rollingFormMap.set(st.idolId, [...(st.form || [])]);
    });

    // Group matches by matchday and sort chronologically
    const allMatches = [...activeLeague.matches];
    const matchdays = Array.from(new Set(allMatches.map((m) => m.matchday))).sort((a, b) => a - b);

    matchdays.forEach((md) => {
      const mdMatches = allMatches.filter((m) => m.matchday === md && !m.completed);
      mdMatches.forEach((match) => {
        if (favoriteSet.has(match.idolAId) || favoriteSet.has(match.idolBId)) {
          skippedFavoritesCount++;
          return;
        }
        const idolA = idolsMap.get(match.idolAId);
        const idolB = idolsMap.get(match.idolBId);
        if (idolA && idolB) {
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
          }

          // Update dynamic rolling form for both idols
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
        }
      });
    });

    const updatedStandings = calculateLeagueStandings(
      activeLeague.id,
      activeLeague.memberIds,
      allMatches,
      idols
    );

    const updatedLeagues = state.leagues.map((l) =>
      l.id === activeLeague.id
        ? { ...l, matches: allMatches, standings: updatedStandings }
        : l
    );

    const isAllComplete = updatedLeagues.every((l) =>
      l.matches.every((m) => m.completed)
    );

    const newState: LeagueSeasonState = {
      ...state,
      leagues: updatedLeagues,
      isCompleted: isAllComplete,
    };

    onUpdateLeagueState(newState);
    if (persistState) saveLeagueSeasonState(newState);

    if (skippedFavoritesCount > 0) {
      setSimAlertMessage(
        `Simulation finished for other matches! ${skippedFavoritesCount} match(es) involving your favorite idol(s) in ${activeLeague.name} require manual play.`
      );
    } else {
      setSimAlertMessage(null);
    }
  };

  // Simulate all 6 leagues in the season chronologically with dynamic form progression
  const handleSimulateAllLeagues = () => {
    let totalSkippedFavorites = 0;

    const updatedLeagues = state.leagues.map((l) => {
      const rollingFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();
      (l.standings || []).forEach((st) => rollingFormMap.set(st.idolId, [...(st.form || [])]));

      const allMatches = [...l.matches];
      const matchdays = Array.from(new Set(allMatches.map((m) => m.matchday))).sort((a, b) => a - b);

      matchdays.forEach((md) => {
        const mdMatches = allMatches.filter((m) => m.matchday === md && !m.completed);
        mdMatches.forEach((match) => {
          if (favoriteSet.has(match.idolAId) || favoriteSet.has(match.idolBId)) {
            totalSkippedFavorites++;
            return;
          }
          const idolA = idolsMap.get(match.idolAId);
          const idolB = idolsMap.get(match.idolBId);
          if (idolA && idolB) {
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
            }

            // Update dynamic rolling form
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
          }
        });
      });

      const updatedStandings = calculateLeagueStandings(
        l.id,
        l.memberIds,
        allMatches,
        idols
      );

      return {
        ...l,
        matches: allMatches,
        standings: updatedStandings,
      };
    });

    const isAllComplete = updatedLeagues.every((l) =>
      l.matches.every((m) => m.completed)
    );

    const newState: LeagueSeasonState = {
      ...state,
      leagues: updatedLeagues,
      isCompleted: isAllComplete,
    };

    onUpdateLeagueState(newState);
    if (persistState) saveLeagueSeasonState(newState);

    if (totalSkippedFavorites > 0) {
      setSimAlertMessage(
        `All leagues simulated! ${totalSkippedFavorites} fixture(s) involving your favorite idol(s) are waiting for you to play.`
      );
    } else {
      setSimAlertMessage(null);
    }
  };

  // Wildcard Play-In Handlers
  const handleSimulateWildcardMatch = (matchId: string) => {
    const updatedPlayIn = simulateWildcardMatch(wildcardPlayIn, matchId, idols);
    const updatedState: LeagueSeasonState = {
      ...state,
      wildcardPlayIn: updatedPlayIn,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleUpdateWildcardScore = (matchId: string, scoreA: number, scoreB: number) => {
    const updatedPlayIn = updateWildcardMatchResult(wildcardPlayIn, matchId, scoreA, scoreB);
    const updatedState: LeagueSeasonState = {
      ...state,
      wildcardPlayIn: updatedPlayIn,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleSimulateAllWildcardMatches = () => {
    const updatedPlayIn = simulateAllWildcardMatches(wildcardPlayIn, idols);
    const updatedState: LeagueSeasonState = {
      ...state,
      wildcardPlayIn: updatedPlayIn,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleResetWildcardPlayIn = () => {
    const freshPlayIn = resetWildcardPlayIn(state.leagues, idols);
    const updatedState: LeagueSeasonState = {
      ...state,
      wildcardPlayIn: freshPlayIn,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleUpdateSwissPlayIn = (updatedSwiss: SwissPlayInState) => {
    const updatedState: LeagueSeasonState = {
      ...state,
      swissPlayIn: updatedSwiss,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleResetSwissPlayIn = () => {
    const freshSwiss = generateSwissPlayIn(state.leagues, idols);
    const updatedState: LeagueSeasonState = {
      ...state,
      swissPlayIn: freshSwiss,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleRandomizeSwissDraw = () => {
    const randomized = randomizeSwissRound1Draw(swissPlayIn, state.leagues, idols);
    const updatedState: LeagueSeasonState = {
      ...state,
      swissPlayIn: randomized,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  const handleChangePostseasonFormat = (fmt: PostseasonFormatType) => {
    setPostseasonFormat(fmt);
    const updatedState: LeagueSeasonState = {
      ...state,
      postseasonFormat: fmt,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);
  };

  // Reset Season Matches Only (Preserves All Division Rosters)
  const handleResetSeason = () => {
    if (!window.confirm('Are you sure you want to reset all league match scores back to unplayed (0-0)? Division rosters and idol assignments will stay exactly the same.')) {
      return;
    }
    const fresh = resetLeagueSeasonMatchesOnly(state, idols);
    onUpdateLeagueState(fresh);
    saveLeagueSeasonState(fresh);
    setSimAlertMessage(null);
  };

  // Advance Qualifiers (32 or 64) to Champions / Grand Cup Tournament
  const handleAdvanceToChampions = () => {
    const targetCount = postseasonFormat === 'grand_cup_64' ? 64 : 32;
    if (activeQualifiers.length < targetCount) {
      alert(`Could not compute all ${targetCount} qualifiers yet. Please ensure all 6 leagues are populated and play-ins completed.`);
      return;
    }

    // 1. Archive current league season
    const winners = getLeagueWinners(state.leagues, idols);
    const standingsRecord: Record<number, LeagueStanding[]> = {};
    state.leagues.forEach((l) => {
      standingsRecord[l.id] = l.standings;
    });

    const allMatchesFlat: LeagueMatch[] = [];
    state.leagues.forEach((l) => allMatchesFlat.push(...l.matches));

    const archiveEntry = {
      seasonNumber: state.seasonNumber,
      seasonName: state.seasonName,
      completedAt: new Date().toISOString(),
      postseasonFormat,
      leagueWinners: winners,
      allStandings: standingsRecord,
      allMatches: allMatchesFlat,
      top32Qualifiers,
      qualifiers: activeQualifiers,
      wildcardPlayIn: wildcardPlayIn,
      swissPlayIn: swissPlayIn,
    };

    const existingArchives = (leagueArchives && leagueArchives.length > 0 ? leagueArchives : loadLeagueArchives())
      .filter((a) => a.seasonNumber !== state.seasonNumber);
    const updatedArchives = [archiveEntry, ...existingArchives];
    if (persistState) saveLeagueArchives(updatedArchives);
    onUpdateLeagueArchives?.(updatedArchives);

    // Save Top Qualifiers specifically to storage
    saveSavedTop32Qualifiers(activeQualifiers);

    // 2. Mark state as advanced
    const updatedState: LeagueSeasonState = {
      ...state,
      championsAdvancementDone: true,
      wildcardPlayIn: wildcardPlayIn,
      swissPlayIn: swissPlayIn,
      postseasonFormat,
    };
    onUpdateLeagueState(updatedState);
    saveLeagueSeasonState(updatedState);

    // 3. Trigger parent callback to populate tournament with these entrants
    onAdvanceToChampionsTournament(activeQualifiers);
  };

  return (
    <div className="space-y-6 select-none max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#22170f] via-[#1a120b] to-[#120d09] p-6 poster-shadow flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center border-2 border-black poster-shadow-sm text-black">
            <Trophy className="w-8 h-8 fill-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-poster-title text-2xl sm:text-3xl text-amber-400 tracking-wide">
                IDOL {divisionLabel.toUpperCase()} LEAGUE SYSTEM
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase">
                Season {state.seasonNumber}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-200/80 font-bold">
              {postseasonFormat === 'grand_cup_64'
                ? '6 Parallel Divisions • 20 Idols Each • Top 6 Auto + 6 Swiss Pools of 12 Idols (72 Contenders) • Top 64 Grand Cup'
                : '6 Division Leagues • 20 Idols Per Division • Round Robin • Top 32 Qualify for Champions Tournament'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download Standings Image / CSV */}
          <button
            onClick={() => setShowStandingsDownloadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-poster-title text-xs font-black shadow-lg transition-all border border-emerald-400/40 poster-shadow-sm hover:scale-105"
            title="Download high-resolution Standings PNG image, export CSV, or copy text standings for any division and matchday"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            <span>Download Standings</span>
          </button>

          {/* Download Matchday Fixtures & Scores */}
          <button
            onClick={() => setShowMatchdayDownloadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black font-poster-title text-xs font-black shadow-lg transition-all border border-amber-400/40 poster-shadow-sm hover:scale-105"
            title="Download high-resolution Matchday PNG card, export CSV, or copy text fixtures for any matchday"
          >
            <Calendar className="w-4 h-4 text-black" />
            <span>Download Matchday</span>
          </button>

          {/* Download League Database Button */}
          <button
            onClick={() => exportLeagueDatabaseToJSON(state, undefined, undefined, idols)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 hover:text-white font-poster-title text-xs font-black transition-all poster-shadow-sm"
            title="Download League Database (.json) including rosters, branding, fixtures, standings & archives"
          >
            <Download className="w-4 h-4 text-amber-400" />
            <span>Download League DB</span>
          </button>

          {/* League Roster Manager Button */}
          <button
            onClick={() => setShowRosterModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-poster-title text-xs font-black shadow-lg transition-all border-2 border-black poster-shadow-sm hover:scale-105"
            title="Open League Roster Manager to distribute, sort by seed, paste rosters, or edit divisions"
          >
            <Users className="w-4 h-4 text-black" />
            <span>Roster Manager</span>
          </button>

          {/* Favorite Idols Button */}
          <button
            onClick={() => setShowFavoriteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-poster-title text-xs font-black shadow-lg transition-all border border-amber-300/40"
            title="Select Favorite Idols to play their matches manually"
          >
            <Star className="w-4 h-4 fill-black" />
            <span>Favorites ({config?.favoriteIdolIds?.length || 0})</span>
          </button>

          {!hidePostseason && <button
            onClick={() => setShowQualifiersModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 hover:text-white font-poster-title text-xs font-black transition-all"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>View {postseasonFormat === 'grand_cup_64' ? 'Top 64' : 'Top 32'} Qualifiers</span>
          </button>}

          <button
            onClick={handleSimulateAllLeagues}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black transition-all shadow-md"
            title="Simulate all matches in all 6 divisions (pauses for favorite idols)"
          >
            <FastForward className="w-4 h-4" />
            <span>Simulate All Leagues</span>
          </button>

          <button
            onClick={handleResetSeason}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950 border border-slate-700 text-slate-400 hover:text-red-300 transition-all"
            title="Reset All Match Scores (Keeps Division Rosters Intact)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!hidePostseason && <>
      {/* Postseason Format Selection Card */}
      <div className="rounded-2xl border-2 border-black bg-[#150f0b] p-4 poster-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
            <Shuffle className="w-5 h-5" />
          </div>
          <div>
            <div className="font-poster-title text-sm text-amber-300 font-bold flex items-center gap-2">
              <span>POSTSEASON &amp; PLAY-IN FORMAT OPTION</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-black font-black uppercase">
                {postseasonFormat === 'grand_cup_64' ? 'Option 2 Active' : 'Option 1 Active'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold">
              Select between the Classic 32-Idol Cup or the expanded 64-Idol Grand Cup with 4 Swiss Pools of 16 Idols (64 Contenders &bull; 28 Grand Cup Tickets).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-black/60 p-1.5 rounded-2xl border border-black shrink-0">
          <button
            onClick={() => handleChangePostseasonFormat('classic_32')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-poster-title text-xs font-black transition-all ${
              postseasonFormat === 'classic_32'
                ? 'bg-amber-500 text-black border border-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Option 1: Classic 32 Cup</span>
          </button>

          <button
            onClick={() => handleChangePostseasonFormat('grand_cup_64')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-poster-title text-xs font-black transition-all ${
              postseasonFormat === 'grand_cup_64'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black border border-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-black" />
            <span>Option 2: 64 Grand Cup (4 Swiss Pools)</span>
          </button>
        </div>
      </div>

      </>}

      {/* Simulation Pause / Alert Banner */}
      {simAlertMessage && (
        <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-950/40 p-4 poster-shadow flex items-center justify-between gap-3 text-amber-200 text-xs font-bold animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" />
            <span>{simAlertMessage}</span>
          </div>
          <button
            onClick={() => setSimAlertMessage(null)}
            className="p-1 rounded-lg hover:bg-amber-900/50 text-amber-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!hidePostseason && <>
      {/* 2. Sub-View Switcher: Divisions vs Postseason Play-In */}
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-black pb-3">
        <button
          onClick={() => setLeagueViewMode('divisions')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-poster-title text-xs sm:text-sm font-black border-2 transition-all ${
            leagueViewMode === 'divisions'
              ? 'bg-amber-500 text-black border-black shadow-lg'
              : 'bg-[#18110b] text-slate-400 border-black hover:text-white'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>6 Division Leagues &amp; Fixtures</span>
        </button>

        <button
          onClick={() => setLeagueViewMode('wildcard')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-poster-title text-xs sm:text-sm font-black border-2 transition-all relative ${
            leagueViewMode === 'wildcard'
              ? 'bg-amber-500 text-black border-black shadow-lg'
              : 'bg-[#18110b] text-slate-400 border-black hover:text-white'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>
            {postseasonFormat === 'grand_cup_64'
              ? '4 Swiss Pools Play-In Stage'
              : 'Wildcard Play-In Stage'}
          </span>
          <span
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
              (postseasonFormat === 'grand_cup_64' ? swissPlayIn.isCompleted : wildcardPlayIn.isCompleted)
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-950 text-amber-300 border border-amber-500/40'
            }`}
          >
            {postseasonFormat === 'grand_cup_64'
              ? swissPlayIn.isCompleted
                ? 'Completed (28 Qualifiers)'
                : '4 Pools of 16 Idols (64 Contenders)'
              : wildcardPlayIn.isCompleted
              ? 'Completed (2 Qualifiers)'
              : 'Double Elimination (6 Idols)'}
          </span>
        </button>
      </div>

      </>}
      {(!hidePostseason && leagueViewMode === 'wildcard') ? (
        <div className="space-y-6">
          {/* Postseason Format Quick-Selector Bar in Wildcard View */}
          <div className="rounded-2xl border-2 border-black bg-[#160f0b] p-3.5 flex flex-wrap items-center justify-between gap-3 poster-shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Play-In Bracket Format:</span>
              <span className="text-xs text-amber-300 font-poster-title font-black">
                {postseasonFormat === 'grand_cup_64' ? '4 Swiss Pools (64 Contenders • 28 Grand Cup Tickets)' : 'Double Elimination (6 Contenders • 2 Top 32 Tickets)'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-black/60 p-1 rounded-xl border border-black">
              <button
                onClick={() => handleChangePostseasonFormat('classic_32')}
                className={`px-3 py-1.5 rounded-lg font-poster-title text-xs font-black transition-all flex items-center gap-1.5 ${
                  postseasonFormat === 'classic_32'
                    ? 'bg-amber-500 text-black border border-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>Double Elimination (Classic 32)</span>
              </button>
              <button
                onClick={() => handleChangePostseasonFormat('grand_cup_64')}
                className={`px-3 py-1.5 rounded-lg font-poster-title text-xs font-black transition-all flex items-center gap-1.5 ${
                  postseasonFormat === 'grand_cup_64'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black border border-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>4 Swiss Pools (Grand Cup 64)</span>
              </button>
            </div>
          </div>

          {postseasonFormat === 'grand_cup_64' ? (
            <SwissPlayInBracket
              playIn={swissPlayIn}
              idols={idols}
              isInteractive={true}
              config={config}
              favoriteIdolIds={config?.favoriteIdolIds || []}
              onUpdateState={handleUpdateSwissPlayIn}
              onReset={handleResetSwissPlayIn}
              onRandomizeDraw={handleRandomizeSwissDraw}
            />
          ) : (
            <WildcardPlayInBracket
              playIn={wildcardPlayIn}
              idols={idols}
              isInteractive={true}
              config={config}
              favoriteIdolIds={config?.favoriteIdolIds || []}
              onSimulateMatch={handleSimulateWildcardMatch}
              onUpdateScore={handleUpdateWildcardScore}
              onSimulateAll={handleSimulateAllWildcardMatches}
              onReset={handleResetWildcardPlayIn}
            />
          )}
        </div>
      ) : (
        <>
          {/* 3. Division League Navigation Tabs (6 Divisions) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(state?.leagues || []).map((league) => {
          const isActive = league.id === activeLeagueId;
          const completedCount = (league.matches || []).filter((m) => m?.completed).length;
          const isDone = completedCount === (league.matches?.length || 0) && (league.matches?.length || 0) > 0;

          return (
            <button
              key={league.id}
              onClick={() => setActiveLeagueId(league.id)}
              className={`p-3 rounded-2xl border-2 transition-all text-left flex flex-col justify-between relative overflow-hidden ${
                isActive
                  ? 'border-amber-400 bg-[#22160d] shadow-lg ring-2 ring-amber-400/30'
                  : 'border-black bg-[#16100b] hover:bg-[#1c140e] text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: league.color }}
                />
                <span className="text-[10px] font-mono font-bold text-amber-400/80">
                  {completedCount}/{league.matches?.length || 380}
                </span>
              </div>
              <div>
                <div
                  className={`font-poster-title text-xs sm:text-sm font-black truncate ${
                    isActive ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {league.name}
                </div>
                <div className="text-[10px] font-bold text-amber-400/60 truncate">
                  {league.tierName}
                </div>
              </div>

              {isDone && (
                <div className="absolute top-1 right-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Main League Workspace: Split into Standings Table & Matchday Fixtures */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Full Football Standings Table */}
        <div className="lg:col-span-7 space-y-3">
          <div className="rounded-3xl border-2 border-black bg-[#16100b] p-4 sm:p-5 poster-shadow space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activeLeague?.color }}
                  />
                  <h3 className="font-poster-title text-base sm:text-lg text-white">
                    {activeLeague?.name} Standings
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {hidePostseason ? 'League Division' : postseasonFormat === 'grand_cup_64' ? 'Grand Cup 64 Format' : 'Classic 32 Format'}
                  </span>
                </div>
                <p className="text-[11px] text-amber-300/80 font-semibold mt-0.5">
                  {postseasonFormat === 'grand_cup_64'
                    ? 'Top 6 advance directly to Grand Cup 64 • 7th–16th (and top 4 rank 17s) enter 4 Swiss Pools Play-In (64 Contenders) • 28 Qualifiers advance'
                    : 'Top 5 advance directly to Champions 32 • 6th enters Double Elimination Wildcard Play-In • 7th–20th Eliminated'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">
                  Matches: {activeLeagueCompletedMatches}/{totalMatchesInLeague}
                </span>
                <button
                  onClick={() => setShowStandingsDownloadModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#241710] hover:bg-amber-950 border border-amber-600/50 text-amber-300 text-[11px] font-black transition-all poster-shadow-sm hover:scale-105"
                  title="Export or download standings table as PNG, CSV or text"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download / Share</span>
                </button>
              </div>
            </div>

            {/* Football Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[580px]">
                <thead>
                  <tr className="border-b border-black/80 bg-black/40 text-[10px] font-poster-title text-amber-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2 text-center w-10">Pos</th>
                    <th className="py-2.5 px-3">Idol</th>
                    <th className="py-2.5 px-2 text-center">P</th>
                    <th className="py-2.5 px-2 text-center">W</th>
                    <th className="py-2.5 px-2 text-center">D</th>
                    <th className="py-2.5 px-2 text-center">L</th>
                    <th className="py-2.5 px-2 text-center">GF</th>
                    <th className="py-2.5 px-2 text-center">GA</th>
                    <th className="py-2.5 px-2 text-center">GD</th>
                    <th className="py-2.5 px-2 text-center">Form</th>
                    <th className="py-2.5 px-3 text-center">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/60 text-xs">
                  {activeLeague?.standings.map((st) => {
                    const idol = idolsMap.get(st.idolId);
                    const isGrandCup = postseasonFormat === 'grand_cup_64';
                    const isChampion = st.rank === 1;
                    const isDirectQual = isGrandCup ? st.rank <= 6 : st.rank <= 5;
                    const isGuaranteedSwiss = isGrandCup && st.rank >= 7 && st.rank <= 16;
                    const isRank17Wildcard = isGrandCup && st.rank === 17 && rank17WildcardIdolIds.has(st.idolId);
                    const isClassicWildcard = !isGrandCup && st.rank === 6;
                    const isPlayIn = isGuaranteedSwiss || isRank17Wildcard || isClassicWildcard;
                    const isFav = favoriteSet.has(st.idolId);

                    return (
                      <React.Fragment key={st.idolId}>
                        <tr
                          className={`hover:bg-amber-950/20 transition-colors ${
                            isChampion
                              ? 'bg-amber-500/10'
                              : isDirectQual
                              ? 'bg-emerald-950/20'
                              : isGuaranteedSwiss
                              ? 'bg-cyan-950/20'
                              : isRank17Wildcard
                              ? 'bg-teal-950/25'
                              : isClassicWildcard
                              ? 'bg-indigo-950/20'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          {/* Position */}
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg font-poster-title text-[11px] font-black border ${
                                isChampion
                                  ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                  : isDirectQual
                                  ? 'bg-emerald-600 text-white border-emerald-400'
                                  : isGuaranteedSwiss
                                  ? 'bg-cyan-600 text-white border-cyan-400'
                                  : isRank17Wildcard
                                  ? 'bg-teal-600 text-white border-teal-300 ring-1 ring-teal-400/50'
                                  : isClassicWildcard
                                  ? 'bg-indigo-600 text-white border-indigo-400'
                                  : 'bg-black/60 text-slate-500 border-black'
                              }`}
                            >
                              {st.rank}
                            </span>
                          </td>

                          {/* Idol Name & Details */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-black bg-black overflow-hidden shrink-0 shadow relative">
                                {st.photoUrl || idol?.photoUrl ? (
                                  <img
                                    src={st.photoUrl || idol?.photoUrl}
                                    alt={st.idolName}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center font-poster-title text-[10px] text-amber-300 bg-black">
                                    {(st.idolName || 'ID').slice(0, 2)}
                                  </div>
                                )}
                                {isFav && (
                                  <span className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5 shadow">
                                    <Star className="w-2.5 h-2.5 fill-black" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-poster-title text-xs text-white font-bold truncate">
                                    {st.idolName}
                                  </span>
                                  {idol && <RatingBadge idol={idol} seed={st.seed} size="xs" showTier={true} />}
                                  {isFav && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-400 font-bold px-1 rounded border border-amber-500/30">
                                      Fav
                                    </span>
                                  )}
                                  {st.nationality && (
                                    <span className="text-[10px] shrink-0">
                                      {getCountryFlag(st.nationality)}
                                    </span>
                                  )}
                                  {isChampion && (
                                    <span className="text-[8px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.2 rounded border border-amber-500/40 uppercase">
                                      Champion
                                    </span>
                                  )}
                                  {isDirectQual && !isChampion && (
                                    <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-black px-1.5 py-0.2 rounded border border-emerald-500/30 uppercase">
                                      Direct Qual
                                    </span>
                                  )}
                                  {isGuaranteedSwiss && (
                                    <span className="text-[8px] font-black px-1.5 py-0.2 rounded border uppercase bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                                      Swiss Play-In
                                    </span>
                                  )}
                                  {isRank17Wildcard && (
                                    <span className="text-[8px] font-black px-1.5 py-0.2 rounded border uppercase bg-teal-500/20 text-teal-300 border-teal-500/40">
                                      Swiss Wildcard
                                    </span>
                                  )}
                                  {isClassicWildcard && (
                                    <span className="text-[8px] font-black px-1.5 py-0.2 rounded border uppercase bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                                      Wildcard Play-In
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] font-bold text-amber-400/80 truncate">
                                  {st.girlGroup} &bull; {st.seed}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Played, W, D, L, GF, GA, GD */}
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300">
                            {st.played}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-400">
                            {st.wins}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-300">
                            {st.draws}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-red-400">
                            {st.losses}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                            {st.gamesFor}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                            {st.gamesAgainst}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold">
                            <span
                              className={
                                st.gameDiff > 0
                                  ? 'text-emerald-400'
                                  : st.gameDiff < 0
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                              }
                            >
                              {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                            </span>
                          </td>

                          {/* Form Last 5 & Status */}
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <FormBadge formHistory={st.form || []} size="sm" showDetails={true} />
                              <div className="flex items-center gap-0.5">
                                {(st.form || []).map((res, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className={`w-3 h-3 rounded-full flex items-center justify-center font-poster-title text-[7px] font-black text-white ${
                                      res === 'W'
                                        ? 'bg-emerald-600'
                                        : res === 'D'
                                        ? 'bg-amber-600'
                                        : 'bg-rose-600'
                                    }`}
                                  >
                                    {res}
                                  </span>
                                ))}
                                {(!st.form || st.form.length === 0) && (
                                  <span className="text-[10px] text-slate-600">-</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Points */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-poster-title text-sm font-black text-amber-300 bg-black/60 px-2 py-0.5 rounded-lg border border-black">
                              {st.points}
                            </span>
                          </td>
                        </tr>

                        {/* Grand Cup 64 Threshold Lines */}
                        {isGrandCup && st.rank === 6 && (
                          <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                            <td colSpan={11} className="py-1 px-3 text-[9px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                              ▼ DIRECT QUALIFICATION CUTOFF (Top 6 Advance to Grand Cup 64 • 36 Total Direct Spots)
                            </td>
                          </tr>
                        )}

                        {isGrandCup && st.rank === 16 && (
                          <tr className="bg-cyan-950/40 border-y-2 border-cyan-500/60">
                            <td colSpan={11} className="py-1 px-3 text-[9px] font-poster-title font-bold text-cyan-300 tracking-wider text-center">
                              ▼ SWISS PLAY-IN GUARANTEED CUTOFF (Ranks 7–16 Advance to 4 Swiss Pools • 60 Total Spots)
                            </td>
                          </tr>
                        )}

                        {isGrandCup && st.rank === 17 && (
                          <tr className="bg-teal-950/40 border-y border-teal-500/40">
                            <td colSpan={11} className="py-1 px-3 text-[9px] font-poster-title font-bold text-teal-300 tracking-wider text-center">
                              ▼ WILDCARD CUTOFF (Top 4 Rank-17s Advance to Swiss Play-In • Others Eliminated)
                            </td>
                          </tr>
                        )}

                        {/* Classic 32 Threshold Lines */}
                        {!isGrandCup && st.rank === 5 && (
                          <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                            <td colSpan={11} className="py-1 px-3 text-[9px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                              ▼ DIRECT CHAMPIONS 32 CUTOFF (Top 5 Advance to Champions Tournament • 30 Direct Spots)
                            </td>
                          </tr>
                        )}

                        {!isGrandCup && st.rank === 6 && (
                          <tr className="bg-indigo-950/40 border-y-2 border-indigo-500/60">
                            <td colSpan={11} className="py-1 px-3 text-[9px] font-poster-title font-bold text-indigo-300 tracking-wider text-center">
                              ▼ WILDCARD PLAY-IN CUTOFF (Rank 6 Enters Double Elimination Play-In • 2 Spots)
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Comprehensive Dynamic Postseason Qualification Legend */}
            <div className="pt-3 border-t-2 border-black/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-poster-title font-bold text-amber-300">
                <span>{postseasonFormat === 'grand_cup_64' ? 'Grand Cup 64 Qualification Thresholds' : 'Champions 32 Qualification Thresholds'}</span>
                <span className="text-[10px] text-slate-400 font-mono">6 Parallel Leagues &bull; 120 Idols Total</span>
              </div>

              {postseasonFormat === 'grand_cup_64' ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10px] font-bold">
                  <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-2 text-emerald-300">
                    <span className="w-5 h-5 rounded-lg bg-emerald-600 border border-emerald-400 text-white font-black text-[9px] flex items-center justify-center shrink-0">1-6</span>
                    <div>
                      <span className="font-black text-white block">Direct Grand Cup 64 (36 Spots)</span>
                      <span className="text-[9px] text-emerald-400/80">Top 6 from each of 6 divisions</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center gap-2 text-cyan-300">
                    <span className="w-5 h-5 rounded-lg bg-cyan-600 border border-cyan-400 text-white font-black text-[9px] flex items-center justify-center shrink-0">7-16</span>
                    <div>
                      <span className="font-black text-white block">Swiss Stage Play-In (60 Spots)</span>
                      <span className="text-[9px] text-cyan-400/80">Guaranteed 4-Pool Swiss spots</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-teal-950/40 border border-teal-500/40 flex items-center gap-2 text-teal-300">
                    <span className="w-5 h-5 rounded-lg bg-teal-600 border border-teal-400 text-white font-black text-[9px] flex items-center justify-center shrink-0">17*</span>
                    <div>
                      <span className="font-black text-white block">Top 4 Wildcards (4 Spots)</span>
                      <span className="text-[9px] text-teal-400/80">Best 4 rank-17s make 64</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-black/50 border border-slate-800 flex items-center gap-2 text-slate-400">
                    <span className="w-5 h-5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-black text-[9px] flex items-center justify-center shrink-0">18-20</span>
                    <div>
                      <span className="font-black text-slate-300 block">Season Ended</span>
                      <span className="text-[9px] text-slate-500">Eliminated from postseason</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-bold">
                  <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-2 text-emerald-300">
                    <span className="w-4 h-4 rounded-lg bg-emerald-600 border border-emerald-400 text-white font-black text-[9px] flex items-center justify-center shrink-0">1-5</span>
                    <div>
                      <span className="font-black text-white block">Direct Champions 32 (30 Spots)</span>
                      <span className="text-[9px] text-emerald-400/80">Top 5 from each division</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex items-center gap-2 text-indigo-300">
                    <span className="w-4 h-4 rounded-lg bg-indigo-600 border border-indigo-400 text-white font-black text-[9px] flex items-center justify-center shrink-0">6</span>
                    <div>
                      <span className="font-black text-white block">Wildcard Play-In (6 Idols)</span>
                      <span className="text-[9px] text-indigo-400/80">Double Elimination &rarr; 2 Tickets</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-black/50 border border-slate-800 flex items-center gap-2 text-slate-400">
                    <span className="w-4 h-4 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-black text-[9px] flex items-center justify-center shrink-0">7-20</span>
                    <div>
                      <span className="font-black text-slate-300 block">Season Ended</span>
                      <span className="text-[9px] text-slate-500">Eliminated from postseason</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Matchday Fixtures & Match Engine */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border-2 border-black bg-[#16100b] p-4 sm:p-5 poster-shadow space-y-4">
            {/* Matchday Selector Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMatchday((prev) => Math.max(1, prev - 1))}
                  disabled={selectedMatchday <= 1}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-center">
                  <span className="font-poster-title text-sm sm:text-base text-amber-400 font-bold block">
                    Matchday {selectedMatchday} of {totalMatchdays}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {matchdayMatches.filter((m) => m.completed).length}/{matchdayMatches.length} Matches Played
                  </span>
                </div>

                <button
                  onClick={() => setSelectedMatchday((prev) => Math.min(totalMatchdays, prev + 1))}
                  disabled={selectedMatchday >= totalMatchdays}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Matchday Quick Actions & View Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Download Matchday Fixtures Card & CSV */}
                <button
                  onClick={() => setShowMatchdayDownloadModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-poster-title text-[11px] sm:text-xs font-black shadow border border-emerald-400/40 transition-all hover:scale-105"
                  title="Download Matchday PNG card, CSV, or Discord text summary"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => setShowMatchdayLiveSimModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-poster-title text-[11px] sm:text-xs font-black shadow-lg shadow-rose-950/50 border border-rose-500/40 transition-all ring-1 ring-amber-400/40"
                  title="Open interactive 10-match live simulcast with play-by-play commentary, momentum meters, and goal flashes"
                >
                  <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>Live Simulcast</span>
                </button>

                <button
                  onClick={handleSimulateMatchday}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-[11px] sm:text-xs font-black shadow transition-all"
                  title="Simulate all unplayed matches in this matchday (pauses for favorite idols)"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Fast Sim</span>
                </button>

                <button
                  onClick={handleSimulateActiveLeague}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700"
                  title="Simulate all matches in this division (pauses for favorite idols)"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List of 10 Matches for this matchday - Clean 1-Column Layout, No Scrolling Box */}
            <div className="space-y-2.5">
              {matchdayMatches.map((match) => {
                const idolA = idolsMap.get(match.idolAId);
                const idolB = idolsMap.get(match.idolBId);
                const isFavMatch =
                  favoriteSet.has(match.idolAId) || favoriteSet.has(match.idolBId);
                const formA = idolFormMap.get(match.idolAId) || [];
                const formB = idolFormMap.get(match.idolBId) || [];

                return (
                  <div
                    key={match.id}
                    className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                      isFavMatch && !match.completed
                        ? 'border-amber-400 bg-gradient-to-r from-amber-950/40 via-[#18110b] to-amber-950/30 shadow-lg ring-1 ring-amber-400/40'
                        : match.completed
                        ? 'border-black bg-[#1a130d] hover:border-amber-500/40'
                        : 'border-black bg-[#120e0a] hover:border-slate-700'
                    }`}
                  >
                    {isFavMatch && !match.completed && (
                      <div className="absolute top-1 right-2 text-[9px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1 z-10">
                        <Star className="w-3 h-3 fill-amber-300" /> Favorite Match
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {/* Home Idol A */}
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2 border-black bg-black overflow-hidden shrink-0 relative shadow-sm">
                          {idolA?.photoUrl ? (
                            <img
                              src={idolA.photoUrl}
                              alt={idolA.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-poster-title text-[11px] text-amber-300 bg-black">
                              {idolA?.name?.slice(0, 2)}
                            </div>
                          )}
                          {favoriteSet.has(match.idolAId) && (
                            <span className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5">
                              <Star className="w-2.5 h-2.5 fill-black" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-poster-title text-xs sm:text-sm text-white truncate font-bold flex items-center gap-1.5">
                            <span className="truncate">{idolA?.name || 'Unknown'}</span>
                            {favoriteSet.has(match.idolAId) && (
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-amber-400/80 font-semibold truncate max-w-[90px] sm:max-w-none">
                              {idolA?.girlGroup}
                            </span>
                            {idolA && <RatingBadge idol={idolA} size="xs" showTier={false} />}
                            <FormBadge formHistory={formA} size="xs" showDetails={false} />
                          </div>
                        </div>
                      </div>

                      {/* Center: Score / VS & Action Buttons */}
                      <div className="flex flex-col items-center justify-center px-1.5 sm:px-3 shrink-0">
                        {match.completed ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 border border-black/80 shadow-inner">
                            <span
                              className={`font-poster-title text-sm sm:text-base font-black ${
                                match.scoreA! > match.scoreB!
                                  ? 'text-emerald-400'
                                  : match.scoreA! === match.scoreB!
                                  ? 'text-amber-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {match.scoreA}
                            </span>
                            <span className="text-slate-600 font-bold text-xs">-</span>
                            <span
                              className={`font-poster-title text-sm sm:text-base font-black ${
                                match.scoreB! > match.scoreA!
                                  ? 'text-emerald-400'
                                  : match.scoreA! === match.scoreB!
                                  ? 'text-amber-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {match.scoreB}
                            </span>
                          </div>
                        ) : (
                          <span className="font-poster-title text-[11px] sm:text-xs text-amber-400/70 font-bold px-2.5 py-0.5 rounded-lg bg-black/60 border border-black/80">
                            VS
                          </span>
                        )}

                        <div className="flex items-center gap-1 mt-1.5">
                          <button
                            onClick={() =>
                              setSelectedMatch({
                                leagueId: activeLeague!.id,
                                match,
                              })
                            }
                            className={`px-2 py-0.5 rounded-lg font-poster-title text-[10px] font-black shadow transition-all flex items-center gap-1 ${
                              isFavMatch && !match.completed
                                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-500/30'
                                : 'bg-amber-500 hover:bg-amber-400 text-black'
                            }`}
                          >
                            <Gamepad2 className="w-2.5 h-2.5" />
                            <span>{match.completed ? 'Edit' : 'Play'}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (idolA && idolB) {
                                setLiveSpotlightMatch({
                                  leagueId: activeLeague!.id,
                                  match,
                                  idolA,
                                  idolB,
                                });
                              }
                            }}
                            className="px-1.5 py-0.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 font-poster-title text-[10px] font-bold flex items-center gap-1 shadow"
                            title="Live Match Visualizer"
                          >
                            <Tv className="w-2.5 h-2.5 text-rose-400" />
                            <span>Live</span>
                          </button>

                          {!match.completed && (
                            <button
                              onClick={() => handleSimulateMatch(activeLeague!.id, match)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Quick Simulate"
                            >
                              <FastForward className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Away Idol B */}
                      <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0 text-right">
                        <div className="min-w-0 flex-1">
                          <div className="font-poster-title text-xs sm:text-sm text-white truncate font-bold flex items-center justify-end gap-1.5">
                            {favoriteSet.has(match.idolBId) && (
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                            )}
                            <span className="truncate">{idolB?.name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <FormBadge formHistory={formB} size="xs" showDetails={false} />
                            {idolB && <RatingBadge idol={idolB} size="xs" showTier={false} />}
                            <span className="text-[10px] text-amber-400/80 font-semibold truncate max-w-[90px] sm:max-w-none">
                              {idolB?.girlGroup}
                            </span>
                          </div>
                        </div>
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2 border-black bg-black overflow-hidden shrink-0 relative shadow-sm">
                          {idolB?.photoUrl ? (
                            <img
                              src={idolB.photoUrl}
                              alt={idolB.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-poster-title text-[11px] text-amber-300 bg-black">
                              {idolB?.name?.slice(0, 2)}
                            </div>
                          )}
                          {favoriteSet.has(match.idolBId) && (
                            <span className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5">
                              <Star className="w-2.5 h-2.5 fill-black" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {!hidePostseason && <>
      {/* 4. Champions Qualification Advance Banner */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#1e150f] via-[#16100b] to-[#120d09] p-6 poster-shadow flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-poster-title text-lg sm:text-xl text-amber-400 flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400 fill-amber-400" />
            <span>
              {postseasonFormat === 'grand_cup_64'
                ? 'End of Season: 64-Idol Grand Cup Qualification'
                : 'End of Season: Champions Tournament Qualification'}
            </span>
          </h3>
          <p className="text-xs text-slate-300 font-medium">
            {postseasonFormat === 'grand_cup_64'
              ? 'When ready, advance the 64 qualifiers (36 Direct + 28 Swiss Stage Qualifiers) into the 16-group Grand Cup knockout system.'
              : 'When you\'re ready, advance the 32 qualifiers directly into the original tournament bracket system.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQualifiersModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-poster-title font-bold"
          >
            Review {postseasonFormat === 'grand_cup_64' ? '64' : '32'} Qualifiers
          </button>

          <button
            onClick={handleAdvanceToChampions}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-poster-title text-sm font-black shadow-xl border-2 border-black"
          >
            <Trophy className="w-4 h-4" />
            <span>Advance Top {postseasonFormat === 'grand_cup_64' ? '64 to Grand Cup' : '32 to Champions Tournament'}</span>
          </button>
        </div>
      </div>

      {/* 5. Qualifiers Review Modal (32 or 64) */}
      {showQualifiersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-3xl border-2 border-black bg-[#18110b] p-6 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-black">
                  <Crown className="w-6 h-6 fill-black" />
                </div>
                <div>
                  <h3 className="font-poster-title text-xl text-amber-400">
                    {postseasonFormat === 'grand_cup_64'
                      ? 'TOP 64 GRAND CUP QUALIFIERS'
                      : 'TOP 32 CHAMPIONS QUALIFIERS'}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    {postseasonFormat === 'grand_cup_64'
                      ? '36 Direct Qualifiers (Top 6 per Division) + 28 Swiss Play-In Qualifiers (Top 4 per Pool + 4 Last Chance)'
                      : '30 Automatic Qualifiers (Top 5 per Division) + 2 Wildcard Play-In Champions (Double Elimination)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQualifiersModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Qualifiers Grid */}
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {activeQualifiers.map((qual, idx) => {
                const isPlayIn =
                  qual.qualificationReason?.toLowerCase().includes('wildcard') ||
                  qual.qualificationReason?.toLowerCase().includes('swiss') ||
                  qual.qualificationReason?.toLowerCase().includes('play-in') ||
                  qual.qualificationReason?.toLowerCase().includes('chance') ||
                  (postseasonFormat === 'classic_32' && qual.leagueRank === 6);

                return (
                  <div
                    key={`${qual.idolId}_${idx}`}
                    className={`p-3 rounded-2xl border-2 border-black flex items-center gap-2.5 shadow ${
                      isPlayIn
                        ? 'bg-gradient-to-br from-[#24170e] to-[#140c06] ring-1 ring-amber-400/50'
                        : 'bg-[#120e0a]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl border border-black bg-black overflow-hidden shadow">
                        {qual.photoUrl ? (
                          <img
                            src={qual.photoUrl}
                            alt={qual.idolName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-poster-title text-xs text-amber-300 bg-black">
                            {(qual.idolName || 'ID').slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-black font-poster-title text-[10px] font-black flex items-center justify-center border border-black ${
                          isPlayIn ? 'bg-amber-400 ring-1 ring-white/50' : 'bg-amber-500'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-poster-title text-xs text-white truncate font-bold">
                          {qual.idolName}
                        </span>
                        {idolsMap.get(qual.idolId) && (
                          <RatingBadge idol={idolsMap.get(qual.idolId)} size="xs" showTier={true} />
                        )}
                        {qual.nationality && (
                          <span className="text-[10px] shrink-0">
                            {getCountryFlag(qual.nationality)}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-bold text-amber-400/80 truncate">
                        {qual.girlGroup}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 truncate flex items-center gap-1">
                        <span>{qual.leagueName}</span>
                        {isPlayIn ? (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[7px] font-black border border-amber-500/30 uppercase">
                            {qual.qualificationReason || 'Play-In'}
                          </span>
                        ) : (
                          <span>&bull; {qual.points} PTS</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-black">
              <span className="text-xs font-bold text-slate-400">
                Total Qualifiers: {activeQualifiers.length} / {postseasonFormat === 'grand_cup_64' ? 64 : 32} Ready
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQualifiersModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowQualifiersModal(false);
                    handleAdvanceToChampions();
                  }}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow-lg"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Advance to {postseasonFormat === 'grand_cup_64' ? 'Grand Cup (64)' : 'Champions Tournament (32)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* 6. Favorite Idols Selector Modal */}
      {showFavoriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border-2 border-black bg-[#18110b] p-6 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-black">
                  <Star className="w-6 h-6 fill-black" />
                </div>
                <div>
                  <h3 className="font-poster-title text-xl text-amber-400">
                    CHOOSE FAVORITE IDOLS
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">
                    When simulating leagues, matches featuring your favorites will pause so you can play them manually.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFavoriteModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Currently Selected Favorites Badges */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                Active Favorites ({config?.favoriteIdolIds?.length || 0}/4):
              </span>
              <div className="flex flex-wrap gap-2 min-h-[36px] p-2 rounded-xl bg-black/40 border border-black">
                {(config?.favoriteIdolIds || []).map((favId) => {
                  const favIdol = idolsMap.get(favId);
                  return (
                    <span
                      key={favId}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-black font-poster-title text-xs font-black shadow"
                    >
                      <Star className="w-3 h-3 fill-black" />
                      <span>{favIdol?.name || 'Unknown'}</span>
                      <button
                        onClick={() => handleToggleFavorite(favId)}
                        className="hover:opacity-75 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
                {(config?.favoriteIdolIds || []).length === 0 && (
                  <span className="text-xs text-slate-500 font-semibold italic py-0.5 px-1">
                    No favorite idols selected. Click an idol below to set as favorite.
                  </span>
                )}
              </div>
            </div>

            {/* Search Idols */}
            <input
              type="text"
              placeholder="Search idol by name, girl group, or seed..."
              value={favoriteSearch}
              onChange={(e) => setFavoriteSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            {/* Idols Selection List */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72">
              {idols
                .filter(
                  (i) =>
                    i.name.toLowerCase().includes(favoriteSearch.toLowerCase()) ||
                    i.girlGroup.toLowerCase().includes(favoriteSearch.toLowerCase()) ||
                    (i.seed && i.seed.toLowerCase().includes(favoriteSearch.toLowerCase()))
                )
                .slice(0, 50)
                .map((idol) => {
                  const isFav = favoriteSet.has(idol.id);
                  return (
                    <button
                      key={idol.id}
                      onClick={() => handleToggleFavorite(idol.id)}
                      className={`p-2.5 rounded-xl border-2 text-left flex items-center justify-between gap-2.5 transition-all ${
                        isFav
                          ? 'border-amber-400 bg-amber-950/40 text-white'
                          : 'border-black bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg border border-black bg-black overflow-hidden shrink-0">
                          {idol.photoUrl ? (
                            <img
                              src={idol.photoUrl}
                              alt={idol.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-poster-title text-[10px] text-amber-300 bg-black">
                              {idol.name.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-poster-title text-xs font-bold truncate">
                            {idol.name}
                          </div>
                          <div className="text-[9px] text-amber-400/80 truncate">
                            {idol.girlGroup} &bull; {idol.seed}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                          isFav
                            ? 'bg-amber-500 text-black border-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-black' : ''}`} />
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="flex justify-end border-t border-black pt-3">
              <button
                onClick={() => setShowFavoriteModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Active Match Modal for playing/editing match */}
      {selectedMatch && (
        <MatchModal
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          idolA={idolsMap.get(selectedMatch.match.idolAId) || null}
          idolB={idolsMap.get(selectedMatch.match.idolBId) || null}
          currentScoreA={selectedMatch.match.scoreA}
          currentScoreB={selectedMatch.match.scoreB}
          matchTitle={`${activeLeague?.name} - Matchday ${selectedMatch.match.matchday}`}
          stageName="League Match"
          isKnockout={false}
          isCompleted={selectedMatch.match.completed}
          favoriteIdolIds={config.favoriteIdolIds}
          onFinish={(scoreA, scoreB, winnerId) => {
            handleUpdateMatch(
              selectedMatch.leagueId,
              selectedMatch.match.id,
              scoreA,
              scoreB,
              winnerId
            );
          }}
        />
      )}
      {/* 8. League Roster Manager Modal */}
      {showRosterModal && (
        <LeagueRosterModal
          isOpen={showRosterModal}
          onClose={() => setShowRosterModal(false)}
          idols={idols}
          girlGroups={girlGroups}
          leagueState={state}
          onUpdateLeagueState={onUpdateLeagueState}
          onUpdateIdols={onUpdateIdols}
        />
      )}

      {/* Standings Download & Export Modal */}
      {showStandingsDownloadModal && (
        <LeagueStandingsDownloadModal
          isOpen={showStandingsDownloadModal}
          onClose={() => setShowStandingsDownloadModal(false)}
          leagues={state.leagues}
          idols={idols}
          initialLeagueId={activeLeagueId}
          initialMatchday={selectedMatchday}
          seasonNumber={state.seasonNumber}
        />
      )}

      {/* 8b. Matchday Download & Export Modal */}
      {showMatchdayDownloadModal && (
        <MatchdayDownloadModal
          isOpen={showMatchdayDownloadModal}
          onClose={() => setShowMatchdayDownloadModal(false)}
          leagues={state.leagues}
          idols={idols}
          initialLeagueId={activeLeagueId}
          initialMatchday={selectedMatchday}
          seasonNumber={state.seasonNumber}
        />
      )}

      {/* 9. Interactive 10-Match Live Simulcast Modal */}
      {showMatchdayLiveSimModal && activeLeague && (
        <MatchdayLiveSimulatorModal
          isOpen={showMatchdayLiveSimModal}
          onClose={() => setShowMatchdayLiveSimModal(false)}
          league={activeLeague}
          matchday={selectedMatchday}
          idols={idols}
          favoriteIdolIds={config.favoriteIdolIds || []}
          onApplyMatchdayResults={handleApplyLiveSimulatedMatchday}
        />
      )}

      {/* 10. Single Match Live Visualizer Spotlight Modal */}
      {liveSpotlightMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border-2 border-black bg-[#16100b] p-4 sm:p-6 poster-shadow overflow-hidden relative">
            <div className="flex items-center justify-between border-b border-black pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="font-poster-title text-sm sm:text-base text-amber-400 font-bold uppercase tracking-wider">
                  Live Match Broadcast Spotlight &bull; {activeLeague?.name} MD {liveSpotlightMatch.match.matchday}
                </span>
              </div>
              <button
                onClick={() => setLiveSpotlightMatch(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <LiveMatchVisualizer
                idolA={liveSpotlightMatch.idolA}
                idolB={liveSpotlightMatch.idolB}
                formHistoryA={idolFormMap.get(liveSpotlightMatch.idolA.id) || []}
                formHistoryB={idolFormMap.get(liveSpotlightMatch.idolB.id) || []}
                isKnockout={false}
                stageLabel={`${activeLeague?.name} - MD ${liveSpotlightMatch.match.matchday}`}
                onMatchComplete={(scoreA, scoreB, winnerId) => {
                  handleUpdateMatch(
                    liveSpotlightMatch.leagueId,
                    liveSpotlightMatch.match.id,
                    scoreA,
                    scoreB,
                    winnerId
                  );
                  setLiveSpotlightMatch(null);
                }}
                onClose={() => setLiveSpotlightMatch(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
