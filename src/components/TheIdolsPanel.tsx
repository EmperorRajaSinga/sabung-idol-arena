import React, { useState, useMemo, useEffect } from 'react';
import {
  Idol,
  GirlGroup,
  TheIdolsSeasonState,
  TheIdolsMatch,
  TheIdolsPlayoffMatch,
  TheIdolsStanding,
  TheIdolsSeasonArchive,
} from '../types';
import {
  Sparkles,
  Trophy,
  Swords,
  Crown,
  Flame,
  Shield,
  Play,
  RotateCcw,
  FastForward,
  Tv,
  Edit3,
  CheckCircle2,
  Award,
  Medal,
  Users,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  BarChart2,
  RefreshCw,
  Sliders,
  Check,
  ShieldAlert,
  Gamepad2,
  Download,
} from 'lucide-react';
import { MatchdayDownloadModal } from './MatchdayDownloadModal';
import { getCountryFlag } from '../utils/nationalityHelper';
import { getIdolRating } from '../utils/ratingHelper';
import { isIdolActive } from '../utils/tournamentLogic';
import {
  calculateTheIdolsStandings,
  recalculateTheIdolsPlayoff,
  simulateTheIdolsMatch,
  simulateTheIdolsPlayoffSeries,
  computeTheIdolsHonors,
  archiveTheIdolsSeason,
  initializeTheIdolsPlayoffMatches,
  syncTheIdolsStateWithLatestIdols,
  rebuildTheIdolsRoster,
  getTop20IdolsByRating,
  ensureTheIdolsHas38Matchdays,
} from '../utils/theIdolsLogic';
import { TheIdolsLiveSimulatorModal } from './TheIdolsLiveSimulatorModal';
import { TheIdolsPlayoffLiveModal } from './TheIdolsPlayoffLiveModal';
import { TheIdolsPlayoffSimulcastModal } from './TheIdolsPlayoffSimulcastModal';
import { MatchModal } from './MatchModal';
import { FormBadge } from './FormBadge';

interface TheIdolsPanelProps {
  idols: Idol[];
  girlGroups?: GirlGroup[];
  theIdolsState: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  favoriteIdolIds?: string[];
  onUpdateState: (newState: TheIdolsSeasonState) => void;
  onUpdateArchives?: (newArchives: TheIdolsSeasonArchive[]) => void;
  onSelectIdolProfile?: (idolId: string) => void;
  onNavigateToArchive?: () => void;
}

export const TheIdolsPanel: React.FC<TheIdolsPanelProps> = ({
  idols,
  girlGroups = [],
  theIdolsState,
  theIdolsArchives,
  favoriteIdolIds = [],
  onUpdateState,
  onUpdateArchives,
  onSelectIdolProfile,
  onNavigateToArchive,
}) => {
  const [activeTab, setActiveTab] = useState<'superleague' | 'playoffs' | 'stats' | 'roster_rules'>('superleague');
  const [selectedMatchday, setSelectedMatchday] = useState<number>(theIdolsState?.currentMatchday || 1);
  const [showMatchdayDownloadModal, setShowMatchdayDownloadModal] = useState<boolean>(false);
  const [isLiveModalOpen, setIsLiveModalOpen] = useState<boolean>(false);
  const [isPlayoffSimulcastOpen, setIsPlayoffSimulcastOpen] = useState<boolean>(false);
  const [livePlayoffMatch, setLivePlayoffMatch] = useState<TheIdolsPlayoffMatch | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Automatically ensure The Idols has all 38 matchdays (380 matches)
  useEffect(() => {
    if (!theIdolsState || !theIdolsState.memberIds || theIdolsState.memberIds.length === 0) return;
    const currentMatches = theIdolsState.matches || [];
    const maxMd = Math.max(0, ...currentMatches.map((m) => m.matchday || 0));
    if (currentMatches.length < 380 || maxMd < 38) {
      const fullMatches = ensureTheIdolsHas38Matchdays(currentMatches, theIdolsState.memberIds);
      const updatedStandings = calculateTheIdolsStandings(theIdolsState.memberIds, fullMatches, idols);
      const updatedState: TheIdolsSeasonState = {
        ...theIdolsState,
        matches: fullMatches,
        standings: updatedStandings,
      };
      onUpdateState(updatedState);
    }
  }, [theIdolsState, idols, onUpdateState]);

  // Interactive Mini-Game / Match Modal State
  const [modalLeagueMatch, setModalLeagueMatch] = useState<TheIdolsMatch | null>(null);
  const [modalPlayoffMatch, setModalPlayoffMatch] = useState<TheIdolsPlayoffMatch | null>(null);

  // Manual Score Edit Modal State
  const [editingMatch, setEditingMatch] = useState<TheIdolsMatch | null>(null);
  const [editScoreA, setEditScoreA] = useState<number>(0);
  const [editScoreB, setEditScoreB] = useState<number>(0);

  // Manual Playoff Series Edit Modal State
  const [editingPlayoffMatch, setEditingPlayoffMatch] = useState<TheIdolsPlayoffMatch | null>(null);
  const [editSeriesWinsA, setEditSeriesWinsA] = useState<number>(0);
  const [editSeriesWinsB, setEditSeriesWinsB] = useState<number>(0);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => {
      map.set(i.id, i);
      if (i.name) map.set(i.name.trim().toLowerCase(), i);
    });
    return map;
  }, [idols]);

  // Robust idol resolver to prevent missing names or photos
  const resolveIdol = useMemo(() => {
    return (id?: string | null, fallbackName?: string | null): Idol | null => {
      if (id && idolsMap.has(id)) return idolsMap.get(id)!;
      if (id) {
        const lowerId = id.trim().toLowerCase();
        for (const idol of idols) {
          if (idol.id.toLowerCase() === lowerId || (idol.name && idol.name.trim().toLowerCase() === lowerId)) {
            return idol;
          }
        }
      }
      if (fallbackName) {
        const lowerName = fallbackName.trim().toLowerCase();
        for (const idol of idols) {
          if (idol.name && idol.name.trim().toLowerCase() === lowerName) {
            return idol;
          }
        }
      }
      return null;
    };
  }, [idolsMap, idols]);

  // Check for inactive members in current roster
  const inactiveMemberIds = useMemo(() => {
    if (!theIdolsState?.memberIds) return [];
    return theIdolsState.memberIds.filter((id) => {
      const idol = resolveIdol(id);
      return !idol || !isIdolActive(idol, girlGroups);
    });
  }, [theIdolsState?.memberIds, resolveIdol, girlGroups]);

  // Sync / Refresh roster with Rating Manager
  const handleSyncRosterWithRatings = (forceRebuild: boolean = false) => {
    if (!theIdolsState) return;
    const newState = syncTheIdolsStateWithLatestIdols(
      theIdolsState,
      idols,
      girlGroups,
      forceRebuild
    );
    onUpdateState(newState);
    const activeCount = idols.filter((i) => isIdolActive(i, girlGroups)).length;
    const inactiveCount = idols.length - activeCount;
    setSyncFeedback(
      forceRebuild
        ? `✓ Roster refreshed! Top 20 active idols generated from current ratings (${inactiveCount} inactive idols ignored).`
        : `✓ Synced with Rating Manager! Standings ratings & details updated (${inactiveCount} inactive idols ignored).`
    );
    setTimeout(() => setSyncFeedback(null), 4500);
  };

  if (!theIdolsState) {
    return (
      <div className="p-8 text-center bg-[#180f09] rounded-3xl border-3 border-black poster-shadow-lg">
        <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-3 animate-pulse" />
        <h2 className="text-xl font-poster-title text-amber-300">The Idols Tournament Not Initialized</h2>
        <p className="text-xs text-amber-200/70 mt-1 font-bold">Please wait while the arena initializes the roster.</p>
      </div>
    );
  }

  // Safe arrays
  const safeMatches = theIdolsState?.matches || [];
  const safeStandings = theIdolsState?.standings || [];
  const safeMemberIds = theIdolsState?.memberIds || [];
  const safePlayoffMatches = theIdolsState?.playoffMatches || [];

  // Matches for selected matchday
  const matchdayMatches = safeMatches.filter((m) => m.matchday === selectedMatchday);
  const isMatchdayFinished = matchdayMatches.length > 0 && matchdayMatches.every((m) => m.completed);
  const totalCompletedMatches = safeMatches.filter((m) => m.completed).length;
  const isAllLeagueFinished = safeMatches.length > 0 && totalCompletedMatches === safeMatches.length;

  const honors = computeTheIdolsHonors(theIdolsState, idols || []);

  // --- ACTIONS: SIMULATE SINGLE LEAGUE MATCH ---
  const handleSimulateSingleMatch = (match: TheIdolsMatch) => {
    const idolA = idolsMap.get(match.idolAId);
    const idolB = idolsMap.get(match.idolBId);
    if (!idolA || !idolB) return;

    const standingA = safeStandings.find((s) => s.idolId === idolA.id);
    const standingB = safeStandings.find((s) => s.idolId === idolB.id);

    const result = simulateTheIdolsMatch(idolA, idolB, standingA?.form || [], standingB?.form || []);

    const updatedMatches = safeMatches.map((m) =>
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

    const updatedStandings = calculateTheIdolsStandings(safeMemberIds, updatedMatches, idols || []);
    const isCompleted = updatedMatches.every((m) => m.completed);

    // If all matches finished, initialize/update playoff bracket
    const updatedPlayoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, updatedStandings);

    onUpdateState({
      ...theIdolsState,
      matches: updatedMatches,
      standings: updatedStandings,
      playoffMatches: updatedPlayoffs,
      isLeagueCompleted: isCompleted,
    });
  };

  // --- ACTIONS: SIMULATE CURRENT MATCHDAY ---
  const handleSimulateMatchday = () => {
    let currentMatches = [...safeMatches];
    let currentStandings = [...safeStandings];

    matchdayMatches.forEach((match) => {
      if (match.completed) return;
      const idolA = idolsMap.get(match.idolAId);
      const idolB = idolsMap.get(match.idolBId);
      if (!idolA || !idolB) return;

      const standingA = currentStandings.find((s) => s.idolId === idolA.id);
      const standingB = currentStandings.find((s) => s.idolId === idolB.id);

      const result = simulateTheIdolsMatch(idolA, idolB, standingA?.form || [], standingB?.form || []);

      currentMatches = currentMatches.map((m) =>
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
      currentStandings = calculateTheIdolsStandings(safeMemberIds, currentMatches, idols || []);
    });

    const isCompleted = currentMatches.every((m) => m.completed);
    const nextMatchday = Math.min(38, selectedMatchday + 1);
    const updatedPlayoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, currentStandings);

    onUpdateState({
      ...theIdolsState,
      matches: currentMatches,
      standings: currentStandings,
      playoffMatches: updatedPlayoffs,
      currentMatchday: isCompleted ? 38 : nextMatchday,
      isLeagueCompleted: isCompleted,
    });

    if (!isCompleted && selectedMatchday < 38) {
      setSelectedMatchday(nextMatchday);
    }
  };

  // --- ACTIONS: SIMULATE ALL 38 MATCHDAYS ---
  const handleSimulateAllMatchdays = () => {
    let currentMatches = [...safeMatches];
    let currentStandings = [...safeStandings];

    // Sort by matchday to preserve true form timeline
    const sorted = [...currentMatches].sort((a, b) => a.matchday - b.matchday);

    sorted.forEach((match) => {
      if (match.completed) return;
      const idolA = idolsMap.get(match.idolAId);
      const idolB = idolsMap.get(match.idolBId);
      if (!idolA || !idolB) return;

      const standingA = currentStandings.find((s) => s.idolId === idolA.id);
      const standingB = currentStandings.find((s) => s.idolId === idolB.id);

      const result = simulateTheIdolsMatch(idolA, idolB, standingA?.form || [], standingB?.form || []);

      currentMatches = currentMatches.map((m) =>
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
      currentStandings = calculateTheIdolsStandings(safeMemberIds, currentMatches, idols || []);
    });

    const updatedPlayoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, currentStandings);

    onUpdateState({
      ...theIdolsState,
      matches: currentMatches,
      standings: currentStandings,
      playoffMatches: updatedPlayoffs,
      currentMatchday: 38,
      isLeagueCompleted: true,
    });
  };

  // --- ACTIONS: RESET SUPERLEAGUE MATCHES ---
  const handleResetSuperleague = () => {
    if (!window.confirm('Reset all 38 matchday scores back to unplayed (0-0)? Idol roster and schedule will be kept.')) {
      return;
    }

    const resetMatches = safeMatches.map((m) => ({
      ...m,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      completed: false,
    }));

    const resetStandings = calculateTheIdolsStandings(safeMemberIds, resetMatches, idols || []);
    const resetPlayoffs = initializeTheIdolsPlayoffMatches(resetStandings);

    onUpdateState({
      ...theIdolsState,
      matches: resetMatches,
      standings: resetStandings,
      playoffMatches: resetPlayoffs,
      currentMatchday: 1,
      isLeagueCompleted: false,
      isPlayoffCompleted: false,
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
    });
    setSelectedMatchday(1);
  };

  // --- ACTIONS: COMMIT EDIT LEAGUE SCORE ---
  const handleSaveEditScore = () => {
    if (!editingMatch) return;
    const isDraw = editScoreA === editScoreB;
    const winnerId = isDraw
      ? null
      : editScoreA > editScoreB
      ? editingMatch.idolAId
      : editingMatch.idolBId;

    const updatedMatches = safeMatches.map((m) =>
      m.id === editingMatch.id
        ? {
            ...m,
            scoreA: editScoreA,
            scoreB: editScoreB,
            winnerId,
            completed: true,
            updatedAt: new Date().toISOString(),
          }
        : m
    );

    const updatedStandings = calculateTheIdolsStandings(safeMemberIds, updatedMatches, idols || []);
    const updatedPlayoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, updatedStandings);
    const isCompleted = updatedMatches.every((m) => m.completed);

    onUpdateState({
      ...theIdolsState,
      matches: updatedMatches,
      standings: updatedStandings,
      playoffMatches: updatedPlayoffs,
      isLeagueCompleted: isCompleted,
    });

    setEditingMatch(null);
  };

  // --- ACTIONS: FINISH LEAGUE MATCH MODAL / MINIGAME ---
  const handleCompleteLeagueModal = (scoreA: number, scoreB: number, winnerId: string) => {
    if (!modalLeagueMatch) return;
    const isDraw = scoreA === scoreB;
    const resolvedWinnerId = isDraw ? null : winnerId || (scoreA > scoreB ? modalLeagueMatch.idolAId : modalLeagueMatch.idolBId);

    const updatedMatches = safeMatches.map((m) =>
      m.id === modalLeagueMatch.id
        ? {
            ...m,
            scoreA,
            scoreB,
            winnerId: resolvedWinnerId,
            completed: true,
            updatedAt: new Date().toISOString(),
          }
        : m
    );

    const updatedStandings = calculateTheIdolsStandings(safeMemberIds, updatedMatches, idols || []);
    const updatedPlayoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, updatedStandings);
    const isCompleted = updatedMatches.every((m) => m.completed);

    onUpdateState({
      ...theIdolsState,
      matches: updatedMatches,
      standings: updatedStandings,
      playoffMatches: updatedPlayoffs,
      isLeagueCompleted: isCompleted,
    });

    setModalLeagueMatch(null);
  };

  // --- ACTIONS: FINISH PLAYOFF MATCH MODAL / MINIGAME ---
  const handleCompletePlayoffModal = (scoreA: number, scoreB: number, winnerId: string) => {
    if (!modalPlayoffMatch || !modalPlayoffMatch.idolAId || !modalPlayoffMatch.idolBId) return;
    const targetWins = modalPlayoffMatch.targetWins || (modalPlayoffMatch.bestOf === 7 ? 4 : 3);
    
    // If scoreA === scoreB, ensure one reaches targetWins based on winnerId
    let finalScoreA = scoreA;
    let finalScoreB = scoreB;
    if (finalScoreA < targetWins && finalScoreB < targetWins) {
      if (winnerId === modalPlayoffMatch.idolAId) {
        finalScoreA = targetWins;
      } else {
        finalScoreB = targetWins;
      }
    }

    const resolvedWinnerId = finalScoreA > finalScoreB ? modalPlayoffMatch.idolAId : modalPlayoffMatch.idolBId;
    const resolvedLoserId = resolvedWinnerId === modalPlayoffMatch.idolAId ? modalPlayoffMatch.idolBId : modalPlayoffMatch.idolAId;

    const updatedPlayoff = safePlayoffMatches.map((m) =>
      m.id === modalPlayoffMatch.id
        ? {
            ...m,
            scoreA: finalScoreA,
            scoreB: finalScoreB,
            winnerId: resolvedWinnerId,
            loserId: resolvedLoserId,
            completed: true,
            updatedAt: new Date().toISOString(),
          }
        : m
    );

    const propagated = recalculateTheIdolsPlayoff(updatedPlayoff, safeStandings);
    const gf1 = propagated.find((m) => m.id === 'ti_po_gf_set1');
    const gf2 = propagated.find((m) => m.id === 'ti_po_gf_set2');
    const isPlayoffFinished =
      (gf1?.completed && !gf1?.isResetActive) ||
      (gf2?.isResetActive && gf2?.completed);

    onUpdateState({
      ...theIdolsState,
      playoffMatches: propagated,
      isPlayoffCompleted: Boolean(isPlayoffFinished),
    });

    setModalPlayoffMatch(null);
  };

  // --- ACTIONS: COMMIT LIVE MATCHDAY RESULTS ---
  const handleCommitLiveMatchday = (committedMatches: TheIdolsMatch[]) => {
    const updatedMap = new Map<string, TheIdolsMatch>();
    committedMatches.forEach((m) => updatedMap.set(m.id, m));

    const updatedMatches = safeMatches.map((m) => updatedMap.get(m.id) || m);
    const updatedStandings = calculateTheIdolsStandings(safeMemberIds, updatedMatches, idols || []);
    const updatedPlayoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, updatedStandings);
    const isCompleted = updatedMatches.every((m) => m.completed);

    onUpdateState({
      ...theIdolsState,
      matches: updatedMatches,
      standings: updatedStandings,
      playoffMatches: updatedPlayoffs,
      isLeagueCompleted: isCompleted,
    });
  };

  // --- ACTIONS: SIMULATE PLAYOFF SERIES ---
  const handleSimulatePlayoffMatch = (match: TheIdolsPlayoffMatch) => {
    if (!match.idolAId || !match.idolBId) return;
    const idolA = idolsMap.get(match.idolAId);
    const idolB = idolsMap.get(match.idolBId);
    if (!idolA || !idolB) return;

    const standingA = safeStandings.find((s) => s.idolId === idolA.id);
    const standingB = safeStandings.find((s) => s.idolId === idolB.id);

    const result = simulateTheIdolsPlayoffSeries(
      idolA,
      idolB,
      match.bestOf,
      standingA?.form || [],
      standingB?.form || []
    );

    const updatedPlayoff = safePlayoffMatches.map((m) =>
      m.id === match.id
        ? {
            ...m,
            scoreA: result.scoreA,
            scoreB: result.scoreB,
            winnerId: result.winnerId,
            loserId: result.loserId,
            games: result.games,
            completed: true,
            updatedAt: new Date().toISOString(),
          }
        : m
    );

    const propagated = recalculateTheIdolsPlayoff(updatedPlayoff, safeStandings);

    // Check if playoff completed
    const gf1 = propagated.find((m) => m.id === 'ti_po_gf_set1');
    const gf2 = propagated.find((m) => m.id === 'ti_po_gf_set2');
    const isPlayoffFinished =
      (gf1?.completed && !gf1?.isResetActive) ||
      (gf2?.isResetActive && gf2?.completed);

    onUpdateState({
      ...theIdolsState,
      playoffMatches: propagated,
      isPlayoffCompleted: Boolean(isPlayoffFinished),
    });
  };

  // --- ACTIONS: COMMIT LIVE PLAYOFF SERIES RESULT ---
  const handleCommitLivePlayoffSeries = (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string,
    games: Array<{ gameNumber: number; scoreA: number; scoreB: number; winnerId: string }>
  ) => {
    const updatedPlayoff = theIdolsState.playoffMatches.map((m) => {
      if (m.id === matchId) {
        const loserId = winnerId === m.idolAId ? m.idolBId : m.idolAId;
        return {
          ...m,
          scoreA,
          scoreB,
          winnerId,
          loserId,
          games,
          completed: true,
          updatedAt: new Date().toISOString(),
        };
      }
      return m;
    });

    const propagated = recalculateTheIdolsPlayoff(updatedPlayoff, theIdolsState.standings);
    const gf1 = propagated.find((m) => m.id === 'ti_po_gf_set1');
    const gf2 = propagated.find((m) => m.id === 'ti_po_gf_set2');
    const isPlayoffFinished =
      (gf1?.completed && !gf1?.isResetActive) ||
      (gf2?.isResetActive && gf2?.completed);

    onUpdateState({
      ...theIdolsState,
      playoffMatches: propagated,
      isPlayoffCompleted: Boolean(isPlayoffFinished),
    });
  };

  // --- ACTIONS: COMMIT PLAYOFF SIMULCAST RESULTS ---
  const handleCommitPlayoffSimulcastMatches = (updatedMatches: TheIdolsPlayoffMatch[]) => {
    const propagated = recalculateTheIdolsPlayoff(updatedMatches, theIdolsState.standings);
    const gf1 = propagated.find((m) => m.id === 'ti_po_gf_set1');
    const gf2 = propagated.find((m) => m.id === 'ti_po_gf_set2');
    const isPlayoffFinished =
      (gf1?.completed && !gf1?.isResetActive && gf1?.winnerId === gf1?.idolAId) ||
      (gf2?.isResetActive && gf2?.completed);

    onUpdateState({
      ...theIdolsState,
      playoffMatches: propagated,
      isPlayoffCompleted: Boolean(isPlayoffFinished),
    });
  };

  // --- ACTIONS: SIMULATE ENTIRE PLAYOFF ---
  const handleSimulateEntirePlayoff = () => {
    let currentPlayoffs = [...theIdolsState.playoffMatches];

    // Iteratively simulate ready matches until finished
    for (let iteration = 0; iteration < 20; iteration++) {
      let simulatedAny = false;
      for (const m of currentPlayoffs) {
        if (!m.completed && m.idolAId && m.idolBId) {
          // If Grand Final Set 2, only simulate if reset is active
          if (m.id === 'ti_po_gf_set2' && !m.isResetActive) {
            continue;
          }

          const idolA = idolsMap.get(m.idolAId);
          const idolB = idolsMap.get(m.idolBId);
          if (!idolA || !idolB) continue;

          const res = simulateTheIdolsPlayoffSeries(idolA, idolB, m.bestOf);
          currentPlayoffs = currentPlayoffs.map((item) =>
            item.id === m.id
              ? {
                  ...item,
                  scoreA: res.scoreA,
                  scoreB: res.scoreB,
                  winnerId: res.winnerId,
                  loserId: res.loserId,
                  games: res.games,
                  completed: true,
                  updatedAt: new Date().toISOString(),
                }
              : item
          );
          currentPlayoffs = recalculateTheIdolsPlayoff(currentPlayoffs, theIdolsState.standings);
          simulatedAny = true;
          break; // restart loop after propagation
        }
      }
      if (!simulatedAny) break;
    }

    const gf = currentPlayoffs.find((m) => m.id === 'ti_po_gf' || m.id === 'ti_po_gf_set1' || m.bracket === 'grand_final');
    const isPlayoffFinished = Boolean(gf?.completed);

    onUpdateState({
      ...theIdolsState,
      playoffMatches: currentPlayoffs,
      isPlayoffCompleted: isPlayoffFinished,
    });
  };

  // --- ACTIONS: RESET PLAYOFFS ---
  const handleResetPlayoffs = () => {
    if (!window.confirm('Reset all playoff match results back to starting seeds?')) return;
    const fresh = initializeTheIdolsPlayoffMatches(theIdolsState.standings);
    onUpdateState({
      ...theIdolsState,
      playoffMatches: fresh,
      isPlayoffCompleted: false,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border-3 border-black bg-gradient-to-br from-[#241308] via-[#1a0e06] to-[#0f0803] p-6 md:p-8 poster-shadow-lg">
        {/* Glow ambient background accents */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -ml-16 -mb-16 w-60 h-60 rounded-full bg-yellow-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Premier Apex Circuit</span>
              </span>
              <span className="text-xs font-mono font-bold text-amber-200/70">
                Top 20 Rating Idols
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-poster-title text-amber-300 drop-shadow-[2px_2px_0px_#000]">
              The Idols
            </h1>
            <p className="text-xs md:text-sm text-amber-200/80 font-bold max-w-2xl mt-1.5 leading-relaxed">
              The supreme single round-robin superleague followed by the elite 10-idol Double Elimination Masters Playoff with a single Best of 7 Grand Final.
            </p>

            {/* Quick Status Chips */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <div className="flex items-center gap-2 bg-[#120b07] px-3.5 py-1.5 rounded-2xl border-2 border-black">
                <span className="text-[10px] text-amber-200/60 font-bold uppercase">Superleague:</span>
                <span className="text-xs font-mono font-black text-amber-300">
                  {totalCompletedMatches} / {safeMatches.length} Matches ({Math.round((totalCompletedMatches / Math.max(1, safeMatches.length)) * 100)}%)
                </span>
              </div>

              <div className="flex items-center gap-2 bg-[#120b07] px-3.5 py-1.5 rounded-2xl border-2 border-black">
                <span className="text-[10px] text-purple-200/60 font-bold uppercase">Masters Playoff:</span>
                <span className={`text-xs font-mono font-black ${theIdolsState.isPlayoffCompleted ? 'text-emerald-400' : 'text-purple-300'}`}>
                  {theIdolsState.isPlayoffCompleted ? 'Champion Crowned!' : theIdolsState.isLeagueCompleted ? 'Active in Bracket' : 'Awaiting Superleague'}
                </span>
              </div>

              {theIdolsState.isPlayoffCompleted && honors.championName && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/30 px-4 py-1.5 rounded-2xl border-2 border-amber-500/60">
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-poster-title text-amber-300">
                    Champion: {honors.championName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Roster Preview */}
          <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2.5 min-w-[220px]">
            <button
              onClick={() => handleSyncRosterWithRatings(totalCompletedMatches === 0)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-black bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 text-xs font-poster-body font-black hover:brightness-110 transition-all poster-shadow-sm"
              title="Synchronize live ratings and active status with Rating Manager"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sync with Rating Manager</span>
            </button>

            {onNavigateToArchive && (
              <button
                onClick={onNavigateToArchive}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-black bg-[#20140c] text-amber-300 text-xs font-poster-body font-black hover:bg-amber-950/80 transition-colors poster-shadow-sm"
              >
                <Crown className="w-4 h-4 text-amber-400" />
                <span>The Idols Archive</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync / Feedback Alert Banner */}
      {syncFeedback && (
        <div className="p-3.5 rounded-2xl border-2 border-emerald-500/80 bg-emerald-950/90 text-emerald-200 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-emerald-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Inactive Member Detected Warning Banner */}
      {inactiveMemberIds.length > 0 && (
        <div className="p-4 rounded-3xl border-3 border-amber-500/80 bg-amber-950/90 text-amber-200 text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 poster-shadow-md">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <div>
              <span className="font-black text-amber-300 block">
                {inactiveMemberIds.length} Inactive {inactiveMemberIds.length === 1 ? 'Idol' : 'Idols'} in Current Roster
              </span>
              <span className="text-[11px] text-amber-200/70">
                Inactive idols or members from inactive girl groups are detected. Click to replace with the highest-rated active idols.
              </span>
            </div>
          </div>
          <button
            onClick={() => handleSyncRosterWithRatings(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-400 text-amber-950 font-black text-xs hover:bg-amber-300 transition-colors border-2 border-black shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Auto-Fix &amp; Update Roster</span>
          </button>
        </div>
      )}

      {/* Champion Coronation Banner (When playoff is completed) */}
      {theIdolsState.isPlayoffCompleted && honors.championId && (
        <div className="p-6 rounded-3xl border-3 border-amber-500/80 bg-gradient-to-r from-amber-950/90 via-[#26160c] to-amber-950/90 poster-shadow-lg animate-in zoom-in-95 duration-300">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={idolsMap.get(honors.championId)?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={honors.championName}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl object-cover border-3 border-amber-400 poster-shadow-md"
                />
                <div className="absolute -top-2 -right-2 p-1 rounded-full bg-amber-400 border-2 border-black text-amber-950">
                  <Crown className="w-4 h-4" />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300/80 block">
                  Reigning Superleague &amp; Masters Champion
                </span>
                <h3 className="text-2xl font-poster-title text-amber-300 drop-shadow">
                  {honors.championName}
                </h3>
                <p className="text-xs text-amber-200/70 font-bold mt-0.5">
                  {idolsMap.get(honors.championId)?.girlGroup || 'Independent'} • Rating {getIdolRating(idolsMap.get(honors.championId)!)}
                </p>
              </div>
            </div>

            {/* Awards Strip */}
            <div className="flex items-center gap-3">
              {honors.runnerUpName && (
                <div className="flex items-center gap-2 bg-[#140b06] px-3.5 py-2 rounded-2xl border-2 border-black">
                  <Medal className="w-4 h-4 text-slate-300" />
                  <div>
                    <span className="text-[9px] text-amber-200/50 uppercase font-bold block">Runner-Up</span>
                    <span className="text-xs font-black text-slate-200">{honors.runnerUpName}</span>
                  </div>
                </div>
              )}

              {honors.thirdPlaceName && (
                <div className="flex items-center gap-2 bg-[#140b06] px-3.5 py-2 rounded-2xl border-2 border-black">
                  <Medal className="w-4 h-4 text-amber-600" />
                  <div>
                    <span className="text-[9px] text-amber-200/50 uppercase font-bold block">3rd Place</span>
                    <span className="text-xs font-black text-amber-300/90">{honors.thirdPlaceName}</span>
                  </div>
                </div>
              )}

              {honors.topScorerName && (
                <div className="flex items-center gap-2 bg-[#140b06] px-3.5 py-2 rounded-2xl border-2 border-black">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-[9px] text-amber-200/50 uppercase font-bold block">Golden Mic ({honors.topScorerGoals}G)</span>
                    <span className="text-xs font-black text-amber-300">{honors.topScorerName}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-1.5 bg-[#160f0b] p-1.5 rounded-2xl border-2 border-black poster-shadow-sm overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('superleague')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'superleague'
                ? 'poster-pill-gold text-amber-950 shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Superleague (Round-Robin)</span>
          </button>

          <button
            onClick={() => setActiveTab('playoffs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'playoffs'
                ? 'poster-pill-red text-white shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span>Masters Playoff (Top 10)</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'stats'
                ? 'bg-amber-600 text-amber-950 font-black shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Stats &amp; Awards</span>
          </button>

          <button
            onClick={() => setActiveTab('roster_rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'roster_rules'
                ? 'bg-[#281c14] text-amber-300 border border-amber-500/50 shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Top 20 Roster &amp; Rules</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SUPERLEAGUE (ROUND-ROBIN) */}
      {/* ========================================================================= */}
      {activeTab === 'superleague' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Standings Table (Left / Top on mobile) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-poster-title text-amber-300 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>The Idols Standings</span>
                </h3>
                <p className="text-[11px] text-amber-200/70 font-bold">
                  Tiebreakers: Goal Difference $\rightarrow$ Head-to-Head $\rightarrow$ Rating
                </p>
              </div>

              {/* Tier Legend Quick Badges */}
              <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1 text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  <Crown className="w-3 h-3" /> UB R3 (1-2)
                </span>
                <span className="flex items-center gap-1 text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                  UB R2 (3-4)
                </span>
                <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  UB R1 (5-8)
                </span>
                <span className="flex items-center gap-1 text-amber-200 bg-[#281b12] px-2 py-0.5 rounded border border-black">
                  LB R1 (9-10)
                </span>
              </div>
            </div>

            {/* Standings Table Card */}
            <div className="rounded-3xl border-3 border-black bg-[#180f0a] overflow-hidden poster-shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead>
                    <tr className="bg-[#24150d] border-b-2 border-black text-amber-300 font-black uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3 text-center">#</th>
                      <th className="py-3 px-3">Idol</th>
                      <th className="py-3 px-2 text-center">Rating</th>
                      <th className="py-3 px-2 text-center">P</th>
                      <th className="py-3 px-2 text-center">W</th>
                      <th className="py-3 px-2 text-center">D</th>
                      <th className="py-3 px-2 text-center">L</th>
                      <th className="py-3 px-2 text-center">GF</th>
                      <th className="py-3 px-2 text-center">GA</th>
                      <th className="py-3 px-2 text-center">GD</th>
                      <th className="py-3 px-3 text-center font-black text-amber-400">Pts</th>
                      <th className="py-3 px-3 text-center">Form</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/60">
                    {theIdolsState.standings.map((st) => {
                      const idol = resolveIdol(st.idolId, st.idolName);
                      const photoUrl = idol?.photoUrl || st.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80';
                      const idolName = idol?.name || st.idolName || 'Unknown Idol';
                      const displayRating = idol ? getIdolRating(idol) : st.rating;
                      const nationality = idol?.nationality || st.nationality || 'South Korea';
                      const girlGroup = idol?.girlGroup || st.girlGroup || 'Independent';

                      const isRank1_2 = st.rank <= 2;
                      const isRank3_4 = st.rank >= 3 && st.rank <= 4;
                      const isRank5_8 = st.rank >= 5 && st.rank <= 8;
                      const isRank9_10 = st.rank >= 9 && st.rank <= 10;

                      let rowBg = 'bg-[#180f0a] hover:bg-[#20140d]';
                      if (isRank1_2) rowBg = 'bg-amber-950/20 hover:bg-amber-950/40';
                      else if (isRank3_4) rowBg = 'bg-purple-950/20 hover:bg-purple-950/40';
                      else if (isRank5_8) rowBg = 'bg-emerald-950/20 hover:bg-emerald-950/40';
                      else if (isRank9_10) rowBg = 'bg-[#22160d] hover:bg-[#2a1b10]';

                      return (
                        <tr key={st.idolId} className={`${rowBg} transition-colors`}>
                          {/* Rank with qualification badge indicator */}
                          <td className="py-2.5 px-3 text-center font-mono font-black">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs border ${
                                isRank1_2
                                  ? 'bg-amber-500 text-amber-950 border-amber-400 font-black'
                                  : isRank3_4
                                  ? 'bg-purple-600 text-purple-100 border-purple-400'
                                  : isRank5_8
                                  ? 'bg-emerald-600 text-emerald-100 border-emerald-400'
                                  : isRank9_10
                                  ? 'bg-[#2d1e14] text-amber-200 border-black'
                                  : 'bg-black/40 text-slate-400 border-black'
                              }`}
                            >
                              {st.rank}
                            </span>
                          </td>

                          {/* Idol Name & Photo */}
                          <td className="py-2.5 px-3">
                            <div
                              onClick={() => onSelectIdolProfile && onSelectIdolProfile(idol?.id || st.idolId)}
                              className="flex items-center gap-2.5 cursor-pointer group"
                            >
                              <img
                                src={photoUrl}
                                alt={idolName}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80';
                                }}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-xl object-cover border-2 border-black group-hover:border-amber-400 transition-colors"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-black text-amber-200 group-hover:text-amber-300 truncate">
                                    {idolName}
                                  </span>
                                  <span className="text-xs">{getCountryFlag(nationality)}</span>
                                </div>
                                <span className="text-[10px] text-amber-200/50 font-bold block truncate">
                                  {girlGroup}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Rating */}
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-300">
                            {displayRating}
                          </td>

                          {/* Played, W, D, L */}
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-200/70">{st.played}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-400">{st.wins}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-200/60">{st.draws}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-400">{st.losses}</td>

                          {/* GF, GA, GD */}
                          <td className="py-2.5 px-2 text-center font-mono text-amber-200/60">{st.gamesFor}</td>
                          <td className="py-2.5 px-2 text-center font-mono text-amber-200/60">{st.gamesAgainst}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-300">
                            {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                          </td>

                          {/* Points */}
                          <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-amber-400">
                            {st.points}
                          </td>

                          {/* Form Badges */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center">
                              <FormBadge form={st.form || []} size="sm" showTooltip={true} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Matchday Controls & Fixtures (Right / Bottom on mobile) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Matchday Selector Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1f130b] p-3 rounded-2xl border-2 border-black poster-shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-poster-title text-amber-300">Matchday</span>
                <select
                  value={selectedMatchday}
                  onChange={(e) => setSelectedMatchday(Number(e.target.value))}
                  className="bg-[#120b07] text-amber-300 border-2 border-black rounded-xl px-3 py-1.5 text-xs font-mono font-black focus:outline-none focus:border-amber-400"
                >
                  {Array.from({ length: 38 }, (_, i) => i + 1).map((md) => {
                    const mdMatches = theIdolsState.matches.filter((m) => m.matchday === md);
                    const done = mdMatches.length > 0 && mdMatches.every((m) => m.completed);
                    return (
                      <option key={md} value={md}>
                        Matchday {md} {done ? '✓ (Finished)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Simulation Quick Buttons & View Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Download Matchday Button */}
                <button
                  onClick={() => setShowMatchdayDownloadModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all poster-shadow-sm hover:scale-105"
                  title="Download Matchday Card (PNG/CSV/Text)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => setIsLiveModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-black bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 text-xs font-black hover:brightness-110 transition-all poster-shadow-sm"
                  title="Broadcast Live Matchday Simulcast"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Broadcast</span>
                </button>

                <button
                  onClick={handleSimulateMatchday}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-black bg-amber-600 text-amber-950 text-xs font-black hover:bg-amber-500 transition-colors poster-shadow-sm"
                  title="Simulate all 10 matches on this matchday"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Simulate MD</span>
                </button>
              </div>
            </div>

            {/* Batch Controls Bar */}
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                onClick={handleSimulateAllMatchdays}
                disabled={isAllLeagueFinished}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl border-2 border-black text-xs font-black transition-all poster-shadow-sm ${
                  isAllLeagueFinished
                    ? 'bg-black/40 text-amber-200/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-purple-100 hover:brightness-110'
                }`}
              >
                <FastForward className="w-4 h-4" />
                <span>Simulate All 38 Matchdays</span>
              </button>

              <button
                onClick={handleResetSuperleague}
                className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border-2 border-black bg-[#281a12] text-amber-200/70 text-xs font-bold hover:bg-red-950/60 hover:text-red-300 transition-colors"
                title="Reset Matchday Scores"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Scores</span>
              </button>
            </div>

            {/* Fixture Match Cards for Selected Matchday - 1-Column Layout, No Scrolling Box */}
            <div className="space-y-2.5">
              {matchdayMatches.map((match) => {
                const idolA = resolveIdol(match.idolAId);
                const idolB = resolveIdol(match.idolBId);
                const standingA = theIdolsState.standings.find((s) => s.idolId === match.idolAId);
                const standingB = theIdolsState.standings.find((s) => s.idolId === match.idolBId);

                const nameA = idolA?.name || standingA?.idolName || 'Idol A';
                const nameB = idolB?.name || standingB?.idolName || 'Idol B';
                const photoA = idolA?.photoUrl || standingA?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80';
                const photoB = idolB?.photoUrl || standingB?.photoUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80';
                const ratingA = idolA ? getIdolRating(idolA) : (standingA?.rating || 75);
                const ratingB = idolB ? getIdolRating(idolB) : (standingB?.rating || 75);
                const groupA = idolA?.girlGroup || standingA?.girlGroup || 'Independent';
                const groupB = idolB?.girlGroup || standingB?.girlGroup || 'Independent';

                const isWinnerA = match.completed && match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB;
                const isWinnerB = match.completed && match.scoreA !== null && match.scoreB !== null && match.scoreB > match.scoreA;
                const isDraw = match.completed && match.scoreA !== null && match.scoreB !== null && match.scoreA === match.scoreB;

                return (
                  <div
                    key={match.id}
                    className="p-3 sm:p-3.5 rounded-2xl border-2 border-black bg-[#1c120a] hover:border-amber-500/50 transition-colors poster-shadow-sm flex items-center justify-between gap-2 sm:gap-3"
                  >
                    {/* Idol A */}
                    <div
                      onClick={() => onSelectIdolProfile && onSelectIdolProfile(idolA?.id || match.idolAId)}
                      className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer group"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={photoA}
                          alt={nameA}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80';
                          }}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border-2 border-black group-hover:border-amber-400 transition-colors"
                        />
                        <span className="absolute -bottom-1 -right-1 text-[8px] bg-black/90 px-1 rounded border border-black text-amber-300 font-mono font-bold">
                          {ratingA}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs sm:text-sm font-black truncate block ${isWinnerA ? 'text-amber-300' : 'text-amber-200'}`}>
                          {nameA}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-amber-200/50 font-bold truncate max-w-[90px] sm:max-w-none">
                            {groupA}
                          </span>
                          <FormBadge form={standingA?.form || []} size="xs" />
                        </div>
                      </div>
                    </div>

                    {/* Score / Simulation Controls */}
                    <div className="flex flex-col items-center justify-center px-1 shrink-0">
                      {match.completed && match.scoreA !== null && match.scoreB !== null ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingMatch(match);
                              setEditScoreA(match.scoreA || 0);
                              setEditScoreB(match.scoreB || 0);
                            }}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-xl bg-[#120b07] border-2 border-black font-mono font-black text-xs sm:text-sm hover:border-amber-400 transition-colors"
                            title="Click to edit score"
                          >
                            <span className={isWinnerA ? 'text-emerald-400 font-black' : isDraw ? 'text-amber-200' : 'text-amber-300'}>
                              {match.scoreA}
                            </span>
                            <span className="text-amber-200/40">:</span>
                            <span className={isWinnerB ? 'text-emerald-400 font-black' : isDraw ? 'text-amber-200' : 'text-amber-300'}>
                              {match.scoreB}
                            </span>
                          </button>
                          <button
                            onClick={() => setModalLeagueMatch(match)}
                            className="p-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black border border-black shadow-sm"
                            title="Re-Play with Mini-Games"
                          >
                            <Gamepad2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setModalLeagueMatch(match)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl border-2 border-black bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 text-[11px] font-black hover:brightness-110 transition-all poster-shadow-sm"
                            title="Play Match with 20+ Mini-Games or Live Sim"
                          >
                            <Gamepad2 className="w-3 h-3" />
                            <span>Play</span>
                          </button>
                          <button
                            onClick={() => handleSimulateSingleMatch(match)}
                            className="flex items-center gap-1 px-2 py-1 rounded-xl border-2 border-black bg-amber-600 text-amber-950 text-[11px] font-black hover:bg-amber-500 transition-colors poster-shadow-sm"
                            title="Quick Simulate"
                          >
                            <Play className="w-3 h-3" />
                            <span>Sim</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Idol B */}
                    <div
                      onClick={() => onSelectIdolProfile && onSelectIdolProfile(idolB?.id || match.idolBId)}
                      className="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs sm:text-sm font-black truncate block ${isWinnerB ? 'text-amber-300' : 'text-amber-200'}`}>
                          {nameB}
                        </span>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <FormBadge form={standingB?.form || []} size="xs" />
                          <span className="text-[10px] text-amber-200/50 font-bold truncate max-w-[90px] sm:max-w-none">
                            {groupB}
                          </span>
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <img
                          src={photoB}
                          alt={nameB}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80';
                          }}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border-2 border-black group-hover:border-amber-400 transition-colors"
                        />
                        <span className="absolute -bottom-1 -right-1 text-[8px] bg-black/90 px-1 rounded border border-black text-amber-300 font-mono font-bold">
                          {ratingB}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTERS PLAYOFF (DOUBLE ELIMINATION STEPPED BRACKET) */}
      {/* ========================================================================= */}
      {activeTab === 'playoffs' && (
        <div className="space-y-6">
          {/* Playoff Top Bar Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#1f130b] p-4 rounded-3xl border-2 border-black poster-shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Double Elimination Rules
                </span>
                <span className="text-xs font-bold text-amber-200/80">
                  All matches Best of 5 • Grand Final Best of 7 (Option B Bracket Reset)
                </span>
              </div>
              <h3 className="text-xl font-poster-title text-amber-300 mt-1">
                Masters Playoff Arena
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsPlayoffSimulcastOpen(true)}
                disabled={theIdolsState.isPlayoffCompleted}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-black text-xs font-black transition-all poster-shadow-sm ${
                  theIdolsState.isPlayoffCompleted
                    ? 'bg-black/40 text-amber-200/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:brightness-110'
                }`}
                title="Open live multi-series playoff simulcast"
              >
                <Tv className="w-4 h-4" />
                <span>Simulcast Playoffs</span>
              </button>

              <button
                onClick={handleSimulateEntirePlayoff}
                disabled={theIdolsState.isPlayoffCompleted}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-black text-xs font-black transition-all poster-shadow-sm ${
                  theIdolsState.isPlayoffCompleted
                    ? 'bg-black/40 text-amber-200/30 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 hover:brightness-110'
                }`}
              >
                <FastForward className="w-4 h-4" />
                <span>Quick Sim All</span>
              </button>

              <button
                onClick={handleResetPlayoffs}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border-2 border-black bg-[#281a12] text-amber-200/70 text-xs font-bold hover:bg-red-950/60 hover:text-red-300 transition-colors"
                title="Reset Playoff Matches"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Bracket</span>
              </button>
            </div>
          </div>

          {/* Stepped Double Elimination Bracket Visual Grid */}
          <div className="space-y-8">
            {/* Tournament Progression Ribbon (Matching mockup-03-double-elimination.png) */}
            {(() => {
              const matches = theIdolsState.playoffMatches || [];
              const completedCount = matches.filter((m) => m.completed).length;
              const totalMatches = matches.length || 10;
              const percent = Math.min(100, Math.round((completedCount / totalMatches) * 100));

              return (
                <div className="rounded-2xl border-2 border-black bg-[#100a06] p-4 poster-shadow space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                      <span className="font-poster-title text-amber-400 uppercase tracking-wider">
                        {theIdolsState.isPlayoffCompleted ? 'Masters Playoff Complete' : 'Playoffs in Progress'}
                      </span>
                    </div>
                    <div className="font-mono text-slate-300">
                      Matches Completed: <strong className="text-lime-300">{completedCount}</strong> / {totalMatches} ({percent}%)
                    </div>
                  </div>

                  <div className="w-full h-2.5 bg-black/80 rounded-full overflow-hidden border border-black">
                    <div
                      className="h-full bg-gradient-to-r from-lime-500 via-emerald-400 to-amber-400 transition-all duration-500 shadow-[0_0_12px_rgba(163,230,53,0.5)]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Section 1: UPPER BRACKET */}
            <div className="rounded-3xl border-3 border-black bg-[#160f0a] p-6 poster-shadow-md space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <h4 className="text-base font-poster-title text-amber-300 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span>Upper Bracket (Winners Path - Best of 5)</span>
                </h4>
                <span className="text-[11px] text-amber-200/60 font-bold">
                  Top 8 Qualifiers from Superleague
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Upper Round 1 (UB R1) */}
                <div className="space-y-3">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-500/30 text-center">
                    UB R1 (Seeds 5–8)
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'UB_R1')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Upper Round 2 (Quarterfinals) */}
                <div className="space-y-3">
                  <div className="text-[11px] font-black uppercase tracking-wider text-purple-300 bg-purple-950/40 px-3 py-1 rounded-xl border border-purple-500/30 text-center">
                    UB Quarterfinals (Seeds 3–4)
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'UB_R2')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Upper Round 3 (Semifinals) */}
                <div className="space-y-3">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/40 px-3 py-1 rounded-xl border border-amber-500/30 text-center">
                    UB Semifinals (Seeds 1–2)
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'UB_R3')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Upper Final */}
                <div className="space-y-3">
                  <div className="text-[11px] font-black uppercase tracking-wider text-yellow-300 bg-yellow-950/40 px-3 py-1 rounded-xl border border-yellow-500/40 text-center">
                    Upper Final (To Grand Final)
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'UB_FINAL')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>
              </div>
            </div>

            {/* Section 2: LOWER BRACKET */}
            <div className="rounded-3xl border-3 border-black bg-[#160f0a] p-6 poster-shadow-md space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <h4 className="text-base font-poster-title text-purple-300 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span>Lower Bracket (Elimination Path - Best of 5)</span>
                </h4>
                <span className="text-[11px] text-amber-200/60 font-bold">
                  Seeds 9–10 + Dropdowns from Upper Bracket
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
                {/* Lower Round 1 */}
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/80 bg-[#24170e] px-2.5 py-1 rounded-xl border border-black text-center">
                    LB R1 (Seeds 9–10)
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'LB_R1')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Lower Round 2 */}
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/80 bg-[#24170e] px-2.5 py-1 rounded-xl border border-black text-center">
                    LB R2 (vs UB R2 Drops)
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'LB_R2')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Lower Round 3 (Quarterfinals) */}
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/80 bg-[#24170e] px-2.5 py-1 rounded-xl border border-black text-center">
                    LB Quarterfinals
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'LB_R3')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Lower Semifinal */}
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-xl border border-purple-500/30 text-center">
                    LB Semifinal
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'LB_SEMI')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>

                {/* Lower Final */}
                <div className="space-y-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-yellow-300 bg-yellow-950/40 px-2.5 py-1 rounded-xl border border-yellow-500/40 text-center">
                    Lower Final
                  </div>
                  {theIdolsState.playoffMatches
                    .filter((m) => m.roundCode === 'LB_FINAL')
                    .map((m) => renderPlayoffMatchCard(m))}
                </div>
              </div>
            </div>

            {/* Section 3: GRAND FINAL */}
            <div className="rounded-3xl border-3 border-amber-500/60 bg-gradient-to-br from-[#241408] via-[#1c0f06] to-[#120a04] p-6 poster-shadow-lg space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500 text-amber-950 border-2 border-black font-black">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-poster-title text-amber-300">
                      The Idols Grand Final (Best of 7)
                    </h4>
                    <p className="text-xs text-amber-200/80 font-bold">
                      Upper Bracket Champion vs Lower Bracket Champion • Winner Takes All Championship
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-poster-title font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    First to 4 Wins (BO7)
                  </span>
                </div>
              </div>

              <div className="max-w-xl mx-auto space-y-3">
                {theIdolsState.playoffMatches
                  .filter((m) => m.bracket === 'grand_final' || m.roundCode === 'GF' || m.roundCode === 'GF_SET1')
                  .slice(0, 1)
                  .map((m) => renderPlayoffMatchCard(m, true))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STATS & AWARDS */}
      {/* ========================================================================= */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Golden Mic / Top Scorers */}
          <div className="rounded-3xl border-3 border-black bg-[#180f0a] p-6 poster-shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <div className="p-2 rounded-xl bg-amber-500 text-amber-950 border border-black">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-poster-title text-base text-amber-300">Golden Mic Leaderboard</h4>
                <p className="text-[10px] text-amber-200/60 font-bold">Goals scored in Superleague</p>
              </div>
            </div>

            <div className="space-y-2">
              {[...theIdolsState.standings]
                .sort((a, b) => b.gamesFor - a.gamesFor)
                .slice(0, 10)
                .map((st, idx) => {
                  const idol = resolveIdol(st.idolId, st.idolName);
                  const photo = idol?.photoUrl || st.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                  const name = idol?.name || st.idolName || 'Idol';

                  return (
                    <div
                      key={st.idolId}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-[#20140c] border-2 border-black"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 text-center font-mono font-black text-amber-400 text-xs">
                          {idx + 1}
                        </span>
                        <img
                          src={photo}
                          alt={name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                          }}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-lg object-cover border border-black"
                        />
                        <span className="text-xs font-black text-amber-200">{name}</span>
                      </div>
                      <span className="text-sm font-mono font-black text-amber-400">{st.gamesFor}G</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Clean Sheets / Defensive Walls */}
          <div className="rounded-3xl border-3 border-black bg-[#180f0a] p-6 poster-shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <div className="p-2 rounded-xl bg-emerald-500 text-emerald-950 border border-black">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-poster-title text-base text-emerald-300">Defensive Fortress</h4>
                <p className="text-[10px] text-amber-200/60 font-bold">Fewest goals conceded</p>
              </div>
            </div>

            <div className="space-y-2">
              {[...theIdolsState.standings]
                .filter((s) => s.played > 0)
                .sort((a, b) => a.gamesAgainst - b.gamesAgainst)
                .slice(0, 10)
                .map((st, idx) => {
                  const idol = resolveIdol(st.idolId, st.idolName);
                  const photo = idol?.photoUrl || st.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                  const name = idol?.name || st.idolName || 'Idol';

                  return (
                    <div
                      key={st.idolId}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-[#20140c] border-2 border-black"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 text-center font-mono font-black text-emerald-400 text-xs">
                          {idx + 1}
                        </span>
                        <img
                          src={photo}
                          alt={name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                          }}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-lg object-cover border border-black"
                        />
                        <span className="text-xs font-black text-amber-200">{name}</span>
                      </div>
                      <span className="text-sm font-mono font-black text-emerald-400">{st.gamesAgainst}GA</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Tournament Overview Stats */}
          <div className="rounded-3xl border-3 border-black bg-[#180f0a] p-6 poster-shadow-md space-y-4">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <div className="p-2 rounded-xl bg-purple-500 text-purple-950 border border-black">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-poster-title text-base text-purple-300">Tournament Telemetry</h4>
                <p className="text-[10px] text-amber-200/60 font-bold">Global stats &amp; metrics</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#20140c] border-2 border-black flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200/70">Total Superleague Goals:</span>
                <span className="text-lg font-mono font-black text-amber-300">
                  {safeMatches.reduce((sum, m) => sum + (m.scoreA || 0) + (m.scoreB || 0), 0)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#20140c] border-2 border-black flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200/70">Avg Goals Per Match:</span>
                <span className="text-lg font-mono font-black text-amber-300">
                  {totalCompletedMatches > 0
                    ? (
                        safeMatches.reduce((sum, m) => sum + (m.scoreA || 0) + (m.scoreB || 0), 0) /
                        totalCompletedMatches
                      ).toFixed(2)
                    : '0.00'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#20140c] border-2 border-black flex items-center justify-between">
                <span className="text-xs font-bold text-amber-200/70">Playoff Series Played:</span>
                <span className="text-lg font-mono font-black text-purple-300">
                  {safePlayoffMatches.filter((m) => m.completed).length} / {safePlayoffMatches.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ROSTER & RULES */}
      {/* ========================================================================= */}
      {activeTab === 'roster_rules' && (
        <div className="space-y-6">
          {/* Rules & Sync Management Bar */}
          <div className="p-6 rounded-3xl border-3 border-black bg-[#1a100a] poster-shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
              <div>
                <h4 className="text-lg font-poster-title text-amber-300 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-400" />
                  <span>The Idols Tournament Rules &amp; Seeding Matrix</span>
                </h4>
                <p className="text-xs text-amber-200/70 font-bold mt-0.5">
                  The Idols roster is automatically integrated with Rating Manager and always ignores inactive idols.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSyncRosterWithRatings(false)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border-2 border-black bg-amber-600 text-amber-950 font-black text-xs hover:bg-amber-500 transition-colors poster-shadow-sm"
                  title="Update ratings and names of existing competitors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Ratings</span>
                </button>

                <button
                  onClick={() => handleSyncRosterWithRatings(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border-2 border-black bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 font-black text-xs hover:brightness-110 transition-all poster-shadow-sm"
                  title="Re-evaluate all idols and select the Top 20 highest-rated active idols"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Refresh Top 20 Active</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-amber-200/80 leading-relaxed">
              <div className="p-4 rounded-2xl bg-[#20140c] border-2 border-black space-y-2">
                <span className="text-amber-400 font-black uppercase block">Phase 1: Superleague</span>
                <p>• Roster consists of the Top 20 highest-rated active idols in the arena, auto-filled dynamically every season.</p>
                <p>• Inactive idols and members from inactive groups are strictly excluded from participation.</p>
                <p>• 38-matchday double round-robin schedule (380 matches total, Home & Away).</p>
                <p>• 3 points for a win, 1 for a draw, 0 for a loss.</p>
                <p>• Tiebreakers: Goal Difference $\rightarrow$ Head-to-Head points/goals $\rightarrow$ Rating.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#20140c] border-2 border-black space-y-2">
                <span className="text-purple-300 font-black uppercase block">Phase 2: Masters Playoff (Top 10 Double Elimination)</span>
                <p>• <strong>Seeds 1–2</strong>: Fast-tracked directly into Upper Bracket Round 3 (UB Semifinals).</p>
                <p>• <strong>Seeds 3–4</strong>: Seeded into Upper Bracket Round 2 (UB Quarterfinals).</p>
                <p>• <strong>Seeds 5–8</strong>: Battle in Upper Bracket Round 1 (5 vs 8, 6 vs 7).</p>
                <p>• <strong>Seeds 9–10</strong>: Wait in Lower Bracket Round 1.</p>
                <p>• <strong>Grand Final (Single BO7)</strong>: Upper Bracket Winner vs Lower Bracket Winner in a direct Best of 7 (first to 4 wins).</p>
              </div>
            </div>
          </div>

          {/* Top 20 Roster Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-poster-title text-amber-300 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Top 20 Active Rating Idols Roster</span>
              </h4>
              <span className="text-xs font-mono font-bold text-amber-200/60">
                {safeMemberIds.length} Idols Enrolled • Active Status Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              {safeMemberIds.map((id, idx) => {
                const idol = resolveIdol(id);
                const standing = safeStandings.find((s) => s.idolId === id);
                const photo = idol?.photoUrl || standing?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                const name = idol?.name || standing?.idolName || `Idol ${id}`;
                const rating = idol ? getIdolRating(idol) : (standing?.rating || 75);
                const nationality = idol?.nationality || standing?.nationality || 'South Korea';
                const girlGroup = idol?.girlGroup || standing?.girlGroup || 'Independent';
                const active = idol ? isIdolActive(idol, girlGroups) : true;

                return (
                  <div
                    key={id}
                    onClick={() => onSelectIdolProfile && onSelectIdolProfile(idol?.id || id)}
                    className="p-3 rounded-2xl border-2 border-black bg-[#1a100a] hover:border-amber-400 transition-all cursor-pointer poster-shadow-sm flex items-center gap-3 group"
                  >
                    <div className="relative">
                      <img
                        src={photo}
                        alt={name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
                        }}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-xl object-cover border-2 border-black group-hover:border-amber-400 transition-colors"
                      />
                      <span className="absolute -bottom-1 -right-1 text-[9px] bg-black/90 px-1.5 py-0.5 rounded border border-black text-amber-300 font-mono font-bold">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-amber-200 group-hover:text-amber-300 truncate">
                          {name}
                        </span>
                        <span className="text-xs">{getCountryFlag(nationality)}</span>
                      </div>
                      <span className="text-[10px] text-amber-200/50 font-bold truncate block">
                        {girlGroup}
                      </span>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="text-[10px] font-mono font-bold text-amber-400">
                          Rating {rating}
                        </span>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                          active
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                            : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
                        }`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Helper function to render playoff match cards */}
      {/* Embedded inside component to access handlers and idolsMap */}
      {/* Live Simulcast Modal for Matchdays */}
      {isLiveModalOpen && (
        <TheIdolsLiveSimulatorModal
          isOpen={isLiveModalOpen}
          onClose={() => setIsLiveModalOpen(false)}
          matchday={selectedMatchday}
          matches={matchdayMatches}
          idolsMap={idolsMap}
          standings={theIdolsState.standings}
          onCommitResults={handleCommitLiveMatchday}
        />
      )}

      {/* Live Playoff Multi-Series Simulcast Modal */}
      {isPlayoffSimulcastOpen && (
        <TheIdolsPlayoffSimulcastModal
          isOpen={isPlayoffSimulcastOpen}
          onClose={() => setIsPlayoffSimulcastOpen(false)}
          playoffMatches={theIdolsState.playoffMatches}
          idolsMap={idolsMap}
          standings={theIdolsState.standings}
          onCommitMatches={handleCommitPlayoffSimulcastMatches}
        />
      )}

      {/* Single Series Live Broadcast Modal */}
      {livePlayoffMatch && (
        <TheIdolsPlayoffLiveModal
          isOpen={Boolean(livePlayoffMatch)}
          onClose={() => setLivePlayoffMatch(null)}
          match={livePlayoffMatch}
          idolsMap={idolsMap}
          onCommitSeriesResult={handleCommitLivePlayoffSeries}
        />
      )}

      {/* Manual League Match Score Editor Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border-3 border-black bg-[#1c120a] p-6 poster-shadow-lg space-y-4">
            <h3 className="text-lg font-poster-title text-amber-300">Edit Matchday Score</h3>
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="text-center w-1/2">
                <span className="text-xs font-black text-amber-200 block truncate mb-1">
                  {idolsMap.get(editingMatch.idolAId)?.name || 'Idol A'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={editScoreA}
                  onChange={(e) => setEditScoreA(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center font-mono text-xl font-black bg-[#120b07] text-amber-300 border-2 border-black rounded-xl p-2"
                />
              </div>

              <span className="text-lg font-bold text-amber-200/50">:</span>

              <div className="text-center w-1/2">
                <span className="text-xs font-black text-amber-200 block truncate mb-1">
                  {idolsMap.get(editingMatch.idolBId)?.name || 'Idol B'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={editScoreB}
                  onChange={(e) => setEditScoreB(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 text-center font-mono text-xl font-black bg-[#120b07] text-amber-300 border-2 border-black rounded-xl p-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 rounded-xl border-2 border-black bg-[#281b12] text-amber-200 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditScore}
                className="px-5 py-2 rounded-xl border-2 border-black bg-amber-500 text-amber-950 text-xs font-black"
              >
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Superleague Match Modal (20+ Mini-Games / Live Engine) */}
      {modalLeagueMatch && (
        <MatchModal
          isOpen={Boolean(modalLeagueMatch)}
          onClose={() => setModalLeagueMatch(null)}
          idolA={idolsMap.get(modalLeagueMatch.idolAId) || null}
          idolB={idolsMap.get(modalLeagueMatch.idolBId) || null}
          currentScoreA={modalLeagueMatch.scoreA}
          currentScoreB={modalLeagueMatch.scoreB}
          matchTitle={`The Idols Superleague • Matchday ${modalLeagueMatch.matchday}`}
          stageName="Phase 1: Superleague"
          isKnockout={false}
          isCompleted={modalLeagueMatch.completed}
          favoriteIdolIds={favoriteIdolIds}
          formHistoryA={safeStandings.find((s) => s.idolId === modalLeagueMatch.idolAId)?.form || []}
          formHistoryB={safeStandings.find((s) => s.idolId === modalLeagueMatch.idolBId)?.form || []}
          onFinish={(scoreA, scoreB, winnerId) => handleCompleteLeagueModal(scoreA, scoreB, winnerId)}
          onResetMatch={() => {
            if (!modalLeagueMatch) return;
            const updated = safeMatches.map((m) =>
              m.id === modalLeagueMatch.id
                ? { ...m, scoreA: null, scoreB: null, winnerId: null, completed: false }
                : m
            );
            const standings = calculateTheIdolsStandings(safeMemberIds, updated, idols || []);
            const playoffs = recalculateTheIdolsPlayoff(safePlayoffMatches, standings);
            onUpdateState({
              ...theIdolsState,
              matches: updated,
              standings,
              playoffMatches: playoffs,
              isLeagueCompleted: false,
            });
            setModalLeagueMatch(null);
          }}
        />
      )}

      {/* Interactive Playoff Match Modal (20+ Mini-Games / Knockout Engine) */}
      {modalPlayoffMatch && (
        <MatchModal
          isOpen={Boolean(modalPlayoffMatch)}
          onClose={() => setModalPlayoffMatch(null)}
          idolA={modalPlayoffMatch.idolAId ? idolsMap.get(modalPlayoffMatch.idolAId) || null : null}
          idolB={modalPlayoffMatch.idolBId ? idolsMap.get(modalPlayoffMatch.idolBId) || null : null}
          currentScoreA={modalPlayoffMatch.scoreA}
          currentScoreB={modalPlayoffMatch.scoreB}
          matchTitle={`The Idols Masters Playoff • ${modalPlayoffMatch.roundName}`}
          stageName={`BO${modalPlayoffMatch.bestOf} Series (First to ${modalPlayoffMatch.targetWins || (modalPlayoffMatch.bestOf === 7 ? 4 : 3)})`}
          isKnockout={true}
          isGrandFinal={modalPlayoffMatch.roundCode === 'GF_SET1' || modalPlayoffMatch.roundCode === 'GF_SET2'}
          isCompleted={modalPlayoffMatch.completed}
          favoriteIdolIds={favoriteIdolIds}
          formHistoryA={modalPlayoffMatch.idolAId ? safeStandings.find((s) => s.idolId === modalPlayoffMatch.idolAId)?.form || [] : []}
          formHistoryB={modalPlayoffMatch.idolBId ? safeStandings.find((s) => s.idolId === modalPlayoffMatch.idolBId)?.form || [] : []}
          onFinish={(scoreA, scoreB, winnerId) => handleCompletePlayoffModal(scoreA, scoreB, winnerId)}
          onResetMatch={() => {
            if (!modalPlayoffMatch) return;
            const updated = safePlayoffMatches.map((m) =>
              m.id === modalPlayoffMatch.id
                ? { ...m, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false, games: [] }
                : m
            );
            const propagated = recalculateTheIdolsPlayoff(updated, safeStandings);
            onUpdateState({
              ...theIdolsState,
              playoffMatches: propagated,
              isPlayoffCompleted: false,
            });
            setModalPlayoffMatch(null);
          }}
        />
      )}
      {/* Matchday Download & Export Modal */}
      {showMatchdayDownloadModal && (
        <MatchdayDownloadModal
          isOpen={showMatchdayDownloadModal}
          onClose={() => setShowMatchdayDownloadModal(false)}
          idols={idols}
          initialMatchday={selectedMatchday}
          seasonNumber={theIdolsState.season}
          customTitle="The Idols Superleague"
          customMatches={theIdolsState.matches}
          customTotalMatchdays={38}
        />
      )}
    </div>
  );

  // Helper render for Playoff Match Card (Knockout Bracket Style)
  function renderPlayoffMatchCard(m: TheIdolsPlayoffMatch, isGrandFinal: boolean = false) {
    const idolA = m.idolAId ? resolveIdol(m.idolAId) : null;
    const idolB = m.idolBId ? resolveIdol(m.idolBId) : null;
    const isWinnerA = m.completed && m.winnerId === m.idolAId;
    const isWinnerB = m.completed && m.winnerId === m.idolBId;
    const canSimulate = !m.completed && m.idolAId && m.idolBId && (!m.isGrandFinalReset || m.isResetActive);
    const targetWins = m.targetWins || (m.bestOf === 7 ? 4 : 3);

    return (
      <div
        key={m.id}
        className={`p-3.5 rounded-2xl border-2 transition-all poster-shadow-sm space-y-2.5 ${
          isGrandFinal
            ? 'border-amber-400 bg-gradient-to-br from-[#24150c] to-[#140b06] ring-1 ring-amber-400/30'
            : m.completed
            ? 'bg-[#1a110a] border-black'
            : canSimulate
            ? 'bg-[#22150c] border-purple-500/50 hover:border-purple-400 ring-1 ring-purple-500/20'
            : 'bg-[#120a06] border-black/60 opacity-60'
        }`}
      >
        {/* Header Strip */}
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-purple-300 font-poster-title truncate max-w-[140px]">{m.roundName}</span>
          <span className="font-mono text-amber-300 px-1.5 py-0.5 rounded bg-black/50 border border-black/60">
            BO{m.bestOf} (FT {targetWins})
          </span>
        </div>

        {/* Competitor A */}
        <div
          className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
            isWinnerA
              ? 'ring-2 ring-lime-400 bg-lime-950/40 border-lime-500/60 text-lime-300 font-black shadow-[0_0_10px_rgba(163,230,53,0.3)]'
              : 'bg-black/30 border-black/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {idolA ? (
              <>
                <img
                  src={idolA.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                  alt={idolA.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                  }}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-lg object-cover border border-black shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs truncate ${isWinnerA ? 'text-lime-300 font-black' : 'text-amber-100 font-bold'}`}>
                      {idolA.name}
                    </span>
                    <span className="text-[9px]">{getCountryFlag(idolA.nationality)}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[9px] ${isWinnerA ? 'text-lime-400/80 font-bold' : 'text-amber-200/50'}`}>
                    <span className="font-mono font-bold text-amber-400">R{getIdolRating(idolA)}</span>
                    <span className="truncate">• {idolA.girlGroup || 'Solo'}</span>
                    <FormBadge form={safeStandings.find((s) => s.idolId === idolA.id)?.form || []} size="xs" />
                  </div>
                </div>
              </>
            ) : (
              <span className="text-xs text-amber-200/40 italic font-bold">TBD</span>
            )}
          </div>
          <span className={`font-mono text-sm font-black px-2 ${isWinnerA ? 'text-lime-300' : 'text-amber-200/60'}`}>
            {m.scoreA !== null ? m.scoreA : '-'}
          </span>
        </div>

        {/* Competitor B */}
        <div
          className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
            isWinnerB
              ? 'ring-2 ring-lime-400 bg-lime-950/40 border-lime-500/60 text-lime-300 font-black shadow-[0_0_10px_rgba(163,230,53,0.3)]'
              : 'bg-black/30 border-black/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {idolB ? (
              <>
                <img
                  src={idolB.photoUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&auto=format&fit=crop&q=80'}
                  alt={idolB.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&auto=format&fit=crop&q=80';
                  }}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-lg object-cover border border-black shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs truncate ${isWinnerB ? 'text-lime-300 font-black' : 'text-amber-100 font-bold'}`}>
                      {idolB.name}
                    </span>
                    <span className="text-[9px]">{getCountryFlag(idolB.nationality)}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[9px] ${isWinnerB ? 'text-lime-400/80 font-bold' : 'text-amber-200/50'}`}>
                    <span className="font-mono font-bold text-amber-400">R{getIdolRating(idolB)}</span>
                    <span className="truncate">• {idolB.girlGroup || 'Solo'}</span>
                    <FormBadge form={safeStandings.find((s) => s.idolId === idolB.id)?.form || []} size="xs" />
                  </div>
                </div>
              </>
            ) : (
              <span className="text-xs text-amber-200/40 italic font-bold">TBD</span>
            )}
          </div>
          <span className={`font-mono text-sm font-black px-2 ${isWinnerB ? 'text-lime-300' : 'text-amber-200/60'}`}>
            {m.scoreB !== null ? m.scoreB : '-'}
          </span>
        </div>

        {/* Playoff Match Controls */}
        {canSimulate && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-black/60 flex-wrap">
            <button
              onClick={() => setModalPlayoffMatch(m)}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-black bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 text-[11px] font-black hover:brightness-110 transition-all poster-shadow-sm"
              title="Play Series with 20+ Mini-Games or Interactive Engine"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Play</span>
            </button>
            <button
              onClick={() => handleSimulatePlayoffMatch(m)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl border border-black bg-amber-600 text-amber-950 text-[11px] font-black hover:bg-amber-500 transition-colors"
            >
              <Play className="w-3 h-3" />
              <span>Sim</span>
            </button>
            <button
              onClick={() => setLivePlayoffMatch(m)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-black bg-[#281b12] text-amber-300 text-[11px] font-black hover:bg-amber-950 transition-colors"
              title="Broadcast Live Series"
            >
              <Tv className="w-3 h-3" />
              <span>Live</span>
            </button>
          </div>
        )}
      </div>
    );
  }
};
