import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Idol, Group, GroupMatch } from '../types';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { LiveMatchVisualizer } from './LiveMatchVisualizer';
import { getCountryFlag } from '../utils/nationalityHelper';
import {
  generateMatchSimulation,
  generateBo4MatchSimulation,
  PreGeneratedMatchSimulation,
  MinuteTimelineFrame,
  MatchLiveEvent,
} from '../utils/liveMatchSimulator';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Trophy,
  Activity,
  Flame,
  Zap,
  CheckCircle2,
  Table,
  Eye,
  Radio,
  Sparkles,
  ArrowRight,
  Tv,
  Users,
} from 'lucide-react';

export interface GroupLiveSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  activeGroupId?: string;
  idolsMap: Map<string, Idol>;
  favoriteIdolIds?: string[];
  onCommitMatches: (
    results: Array<{
      groupId: string;
      matchId: string;
      scoreA: number;
      scoreB: number;
      winnerId: string;
    }>
  ) => void;
}

interface FlattenedGroupMatch {
  groupId: string;
  groupName: string;
  match: GroupMatch;
}

export const GroupLiveSimulatorModal: React.FC<GroupLiveSimulatorModalProps> = ({
  isOpen,
  onClose,
  groups = [],
  activeGroupId,
  idolsMap,
  favoriteIdolIds = [],
  onCommitMatches,
}) => {
  const favoriteSet = useMemo(() => new Set(favoriteIdolIds), [favoriteIdolIds]);

  // Extract all uncompleted matches across groups
  const allPendingMatches: FlattenedGroupMatch[] = useMemo(() => {
    const list: FlattenedGroupMatch[] = [];
    (groups || []).forEach((g) => {
      (g.matches || []).forEach((m) => {
        if (!m.completed || m.scoreA === null || m.scoreB === null) {
          list.push({
            groupId: g.id,
            groupName: g.name,
            match: m,
          });
        }
      });
    });
    return list;
  }, [groups]);

  // Round options available in pending matches
  const availableRounds = useMemo(() => {
    const rounds = new Set<number>();
    allPendingMatches.forEach((pm) => rounds.add(pm.match.round));
    return Array.from(rounds).sort((a, b) => a - b);
  }, [allPendingMatches]);

  const [selectedFilter, setSelectedFilter] = useState<string>('all_pending');

  // Filter matches to simulate
  const filteredMatches: FlattenedGroupMatch[] = useMemo(() => {
    if (selectedFilter === 'active_group' && activeGroupId) {
      return allPendingMatches.filter((pm) => pm.groupId === activeGroupId);
    }
    if (selectedFilter.startsWith('round_')) {
      const rNum = Number(selectedFilter.replace('round_', ''));
      return allPendingMatches.filter((pm) => pm.match.round === rNum);
    }
    return allPendingMatches;
  }, [allPendingMatches, selectedFilter, activeGroupId]);

  // Calculate idol form history from prior completed group matches
  const idolFormMap = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    (groups || []).forEach((g) => {
      (g.matches || []).forEach((m) => {
        if (m.completed && m.scoreA !== null && m.scoreB !== null) {
          const listA = map.get(m.idolAId) || [];
          const listB = map.get(m.idolBId) || [];
          if (m.scoreA > m.scoreB) {
            listA.push('W');
            listB.push('L');
          } else if (m.scoreA < m.scoreB) {
            listA.push('L');
            listB.push('W');
          } else {
            listA.push('D');
            listB.push('D');
          }
          map.set(m.idolAId, listA);
          map.set(m.idolBId, listB);
        }
      });
    });
    return map;
  }, [groups]);

  const [matchSims, setMatchSims] = useState<PreGeneratedMatchSimulation[]>([]);

  // Pre-generate match simulation timelines with stable generator
  const generateSimulations = useCallback(
    (matchesToSim: FlattenedGroupMatch[]) => {
      return matchesToSim.map(({ match }) => {
        const idolA = idolsMap.get(match.idolAId) || ({
          id: match.idolAId,
          name: 'Idol A',
          girlGroup: 'Group A',
          seed: 'Seed 1',
        } as Idol);
        const idolB = idolsMap.get(match.idolBId) || ({
          id: match.idolBId,
          name: 'Idol B',
          girlGroup: 'Group B',
          seed: 'Seed 2',
        } as Idol);

        const formA = (idolFormMap.get(match.idolAId) || []).slice(-5);
        const formB = (idolFormMap.get(match.idolBId) || []).slice(-5);

        const sim = generateBo4MatchSimulation(match.id, idolA, idolB, formA, formB);

        // Ensure final frame score matches decisive score
        if (sim?.frames && sim.frames.length > 0) {
          const lastFrame = sim.frames[sim.frames.length - 1];
          if (lastFrame) {
            lastFrame.scoreA = sim.finalScoreA;
            lastFrame.scoreB = sim.finalScoreB;
          }
        }

        return sim;
      });
    },
    [idolsMap, idolFormMap]
  );

  // Initialize simulations upon open or filter change
  useEffect(() => {
    if (!isOpen) return;
    if (filteredMatches.length === 0) {
      setMatchSims([]);
      return;
    }
    const sims = generateSimulations(filteredMatches);
    setMatchSims(sims);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setRecentBreakingNews([]);
    setSpotlightMatchId(null);
  }, [isOpen, selectedFilter, filteredMatches.length]);

  const maxTotalFrames = useMemo(() => {
    if (matchSims.length === 0) return 95;
    return Math.max(...matchSims.map((s) => s.frames.length));
  }, [matchSims]);

  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [spotlightMatchId, setSpotlightMatchId] = useState<string | null>(null);
  const [recentBreakingNews, setRecentBreakingNews] = useState<MatchLiveEvent[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isFinished = currentFrameIdx >= maxTotalFrames - 1;

  // Handle restart simulation
  const handleRestartSimulation = () => {
    if (filteredMatches.length > 0) {
      const sims = generateSimulations(filteredMatches);
      setMatchSims(sims);
    }
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setRecentBreakingNews([]);
    setSpotlightMatchId(null);
  };

  // Simulation tick loop
  useEffect(() => {
    if (!isOpen) return;

    if (!isPlaying || isFinished) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(40, Math.round(700 / simSpeed));

    timerRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => {
        if (prev >= maxTotalFrames - 1) {
          setIsPlaying(false);
          return maxTotalFrames - 1;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, isPlaying, isFinished, simSpeed, maxTotalFrames]);

  // Track breaking goal events for news ticker
  useEffect(() => {
    if (!isOpen) return;
    const newGoals: MatchLiveEvent[] = [];

    matchSims.forEach((sim) => {
      const frame = sim.frames[Math.min(currentFrameIdx, sim.frames.length - 1)];
      if (frame && frame.event && frame.event.type === 'goal') {
        newGoals.push(frame.event);
      }
    });

    if (newGoals.length > 0) {
      setRecentBreakingNews((prev) => [...newGoals, ...prev].slice(0, 6));
    }
  }, [currentFrameIdx, matchSims, isOpen]);

  // Get current minute representation
  const currentMinute = useMemo(() => {
    if (matchSims.length === 0) return 0;
    const firstSim = matchSims[0];
    const frame = firstSim.frames[Math.min(currentFrameIdx, firstSim.frames.length - 1)];
    return frame ? frame.minute : currentFrameIdx;
  }, [matchSims, currentFrameIdx]);

  // Match status for current frame
  const currentSimStateMap = useMemo(() => {
    const map = new Map<
      string,
      {
        scoreA: number;
        scoreB: number;
        possession: 'A' | 'B' | 'neutral';
        momentum: number;
        lastEvent: MatchLiveEvent | null;
      }
    >();

    matchSims.forEach((sim) => {
      const frame = sim.frames[Math.min(currentFrameIdx, sim.frames.length - 1)];
      if (frame) {
        map.set(sim.matchId, {
          scoreA: frame.scoreA,
          scoreB: frame.scoreB,
          possession: frame.possession,
          momentum: frame.momentum,
          lastEvent: frame.event,
        });
      }
    });

    return map;
  }, [matchSims, currentFrameIdx]);

  // Live standings recalculation based on simulated results
  const liveStandingsPreview = useMemo(() => {
    // Recalculate standings per group based on original completed matches + currently simulated frames
    return (groups || []).map((grp) => {
      const statsMap = new Map<
        string,
        {
          idolId: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          points: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDiff: number;
        }
      >();

      (grp.idols || []).forEach((id) => {
        statsMap.set(id, {
          idolId: id,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
        });
      });

      // 1. Process already completed matches
      (grp.matches || []).forEach((m) => {
        const liveSim = currentSimStateMap.get(m.id);
        const hasLive = liveSim !== undefined;

        const scoreA = hasLive ? liveSim.scoreA : m.completed ? m.scoreA : null;
        const scoreB = hasLive ? liveSim.scoreB : m.completed ? m.scoreB : null;

        if (scoreA !== null && scoreB !== null && (hasLive || m.completed)) {
          const stA = statsMap.get(m.idolAId);
          const stB = statsMap.get(m.idolBId);

          if (stA) {
            stA.played += 1;
            stA.goalsFor += scoreA;
            stA.goalsAgainst += scoreB;
            stA.goalDiff += scoreA - scoreB;
            if (scoreA > scoreB) {
              stA.wins += 1;
              stA.points += 3;
            } else if (scoreA === scoreB) {
              stA.draws += 1;
              stA.points += 1;
            } else {
              stA.losses += 1;
            }
          }

          if (stB) {
            stB.played += 1;
            stB.goalsFor += scoreB;
            stB.goalsAgainst += scoreA;
            stB.goalDiff += scoreB - scoreA;
            if (scoreB > scoreA) {
              stB.wins += 1;
              stB.points += 3;
            } else if (scoreB === scoreA) {
              stB.draws += 1;
              stB.points += 1;
            } else {
              stB.losses += 1;
            }
          }
        }
      });

      const sorted = Array.from(statsMap.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return 0;
      });

      return {
        groupId: grp.id,
        groupName: grp.name,
        standings: sorted,
      };
    });
  }, [groups, currentSimStateMap]);

  // Handle Commit Results
  const handleCommit = () => {
    const results = filteredMatches.map((fm) => {
      const sim = matchSims.find((s) => s.matchId === fm.match.id);
      const finalA = sim ? sim.finalScoreA : 0;
      const finalB = sim ? sim.finalScoreB : 0;
      let winnerId = '';
      if (finalA > finalB) winnerId = fm.match.idolAId;
      else if (finalB > finalA) winnerId = fm.match.idolBId;
      else winnerId = 'draw';

      return {
        groupId: fm.groupId,
        matchId: fm.match.id,
        scoreA: finalA,
        scoreB: finalB,
        winnerId,
      };
    });

    onCommitMatches(results);
    onClose();
  };

  const spotlightSim = matchSims.find((s) => s.matchId === spotlightMatchId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl max-h-[96vh] flex flex-col bg-[#160d07] border-3 border-black rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Broadcast Banner Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-red-950 via-[#261309] to-amber-950 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/30 border border-red-500/50 rounded-2xl animate-pulse">
              <Radio className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                  Live Simulcast
                </span>
                <h2 className="text-xl sm:text-2xl font-poster-title text-amber-100 drop-shadow-[2px_2px_0px_#000]">
                  Group Stage Multi-Pitch Broadcast
                </h2>
              </div>
              <p className="text-xs text-amber-200/70 font-bold mt-0.5">
                Simulating {filteredMatches.length} group matches simultaneously with real-time standings shifts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-[#0d0603] p-1 rounded-2xl border border-amber-500/30">
              <button
                onClick={() => setSelectedFilter('all_pending')}
                className={`px-3 py-1 text-xs font-black rounded-xl transition-all ${
                  selectedFilter === 'all_pending'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-amber-200/70 hover:text-amber-100'
                }`}
              >
                All Pending ({allPendingMatches.length})
              </button>
              {availableRounds.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedFilter(`round_${r}`)}
                  className={`px-3 py-1 text-xs font-black rounded-xl transition-all ${
                    selectedFilter === `round_${r}`
                      ? 'bg-amber-500 text-black shadow'
                      : 'text-amber-200/70 hover:text-amber-100'
                  }`}
                >
                  Round {r}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-2 bg-black/60 hover:bg-black text-amber-300 hover:text-amber-100 rounded-full border border-amber-500/30 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Broadcast Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[#1c100a] border-b-2 border-black">
          {/* Minute Progress Bar */}
          <div className="flex items-center gap-3 min-w-[240px] flex-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black border border-amber-500/40">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-mono text-sm font-black text-amber-300">
                {currentMinute >= 90 ? `90'+` : `${currentMinute}'`}
              </span>
              <span className="text-[10px] text-amber-200/60 font-bold uppercase">
                {currentMinute < 45 ? '1st Half' : currentMinute === 45 ? 'Half Time' : currentMinute < 90 ? '2nd Half' : 'Full Time'}
              </span>
            </div>

            <div className="flex-1 h-3 bg-[#0c0603] rounded-full overflow-hidden border border-amber-500/30">
              <div
                className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 transition-all duration-150"
                style={{ width: `${Math.min(100, (currentFrameIdx / (maxTotalFrames - 1 || 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Controls: Play, Pause, Speeds, Sound */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black flex items-center gap-1.5 transition-all shadow"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
              <span className="text-xs font-black uppercase">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={handleRestartSimulation}
              className="p-2 bg-[#0c0603] hover:bg-black text-amber-300 rounded-xl border border-amber-500/30 transition-all"
              title="Restart Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 bg-[#0c0603] p-1 rounded-xl border border-amber-500/30">
              {[1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-0.5 text-[11px] font-black rounded-lg transition-all ${
                    simSpeed === spd
                      ? 'bg-amber-500 text-black'
                      : 'text-amber-200/70 hover:text-amber-100'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentFrameIdx(maxTotalFrames - 1)}
              className="px-3 py-1.5 bg-[#0c0603] hover:bg-black text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Instant Finish</span>
            </button>

            <button
              onClick={handleCommit}
              disabled={!isFinished}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Commit &amp; Apply All Scores</span>
            </button>
          </div>
        </div>

        {/* Breaking News Goal Ticker */}
        {recentBreakingNews.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-1.5 bg-red-950/80 border-b border-red-500/30 overflow-x-auto text-xs">
            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 animate-pulse">
              <Zap className="w-3 h-3 fill-white" /> Goal Alert
            </span>
            <div className="flex items-center gap-4 text-amber-200 font-bold whitespace-nowrap">
              {recentBreakingNews.map((ev, i) => (
                <span key={ev.id || i} className="flex items-center gap-1">
                  <span className="text-amber-400 font-black">{ev.minute}&apos;</span> {ev.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area: Multi-Match Grid + Live Standings + Spotlight */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Spotlight Modal / Drawer if a match is clicked */}
          {spotlightSim && (
            <div className="bg-[#1b0f09] border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-4">
                <div className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-black text-amber-100">
                    Spotlight Pitch: {spotlightSim.idolA.name} vs {spotlightSim.idolB.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSpotlightMatchId(null)}
                  className="px-3 py-1 bg-black/60 hover:bg-black text-amber-300 rounded-xl border border-amber-500/30 text-xs font-bold"
                >
                  Close Spotlight
                </button>
              </div>

              <LiveMatchVisualizer
                idolA={spotlightSim.idolA}
                idolB={spotlightSim.idolB}
                formHistoryA={spotlightSim.formA.formArray}
                formHistoryB={spotlightSim.formB.formArray}
                isKnockout={false}
                stageLabel="Group Stage Spotlight"
                onMatchComplete={() => {}}
              />
            </div>
          )}

          {/* Multi-Match Simultaneous Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <Table className="w-4 h-4 text-amber-400" />
                <span>Simultaneous Group Fixtures ({filteredMatches.length})</span>
              </h3>
              <span className="text-xs text-amber-200/60 font-bold">
                Click any fixture to zoom in with Spotlight Camera
              </span>
            </div>

            {filteredMatches.length === 0 ? (
              <div className="p-8 text-center bg-[#180e08] rounded-2xl border border-amber-500/20 text-amber-200/60 font-bold">
                No uncompleted matches found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredMatches.map((fm) => {
                  const sim = matchSims.find((s) => s.matchId === fm.match.id);
                  const idolA = idolsMap.get(fm.match.idolAId);
                  const idolB = idolsMap.get(fm.match.idolBId);
                  const liveState = currentSimStateMap.get(fm.match.id) || {
                    scoreA: 0,
                    scoreB: 0,
                    possession: 'neutral',
                    momentum: 0,
                    lastEvent: null,
                  };

                  const isFavA = favoriteSet.has(fm.match.idolAId);
                  const isFavB = favoriteSet.has(fm.match.idolBId);

                  const isSpotlight = spotlightMatchId === fm.match.id;

                  return (
                    <div
                      key={fm.match.id}
                      onClick={() => setSpotlightMatchId(fm.match.id)}
                      className={`relative bg-[#140b06] border-2 rounded-2xl p-3.5 shadow-lg cursor-pointer transition-all hover:scale-[1.01] hover:border-amber-400 ${
                        isSpotlight
                          ? 'border-amber-400 ring-2 ring-amber-400/40 bg-[#1c0f09]'
                          : 'border-black'
                      }`}
                    >
                      {/* Header row: Group & Round & Possession indicator */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-200/60 pb-2 border-b border-amber-500/20 mb-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-black/60 border border-amber-500/30 text-amber-300">
                          {fm.groupName} &bull; R{fm.match.round}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {liveState.lastEvent?.type === 'goal' && (
                            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-black animate-bounce">
                              GOAL!
                            </span>
                          )}
                          <span className="font-mono text-amber-300 font-black">
                            {currentMinute}&apos;
                          </span>
                        </div>
                      </div>

                      {/* Scoreboard row */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        {/* Idol A */}
                        <div className="flex items-center gap-2 overflow-hidden">
                          {idolA?.photoUrl ? (
                            <img
                              src={idolA.photoUrl}
                              alt={idolA.name}
                              className="w-9 h-9 rounded-full object-cover border-2 border-black shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-red-950 border-2 border-black flex items-center justify-center font-bold text-xs text-red-300 shrink-0">
                              {idolA?.name?.charAt(0) || 'A'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className={`text-xs font-black truncate ${isFavA ? 'text-amber-300' : 'text-amber-100'}`}>
                                {idolA?.name || 'Idol A'}
                              </span>
                              {isFavA && <span className="text-[10px] text-amber-400">★</span>}
                            </div>
                            <span className="text-[10px] text-amber-200/60 font-bold block truncate">
                              {idolA?.girlGroup || 'Solo'}
                            </span>
                          </div>
                        </div>

                        {/* Live Score */}
                        <div className="px-3 py-1.5 bg-black/80 border border-amber-500/40 rounded-xl flex items-center gap-2 shrink-0">
                          <span className={`text-base font-mono font-black ${liveState.scoreA > liveState.scoreB ? 'text-emerald-400' : 'text-amber-100'}`}>
                            {liveState.scoreA}
                          </span>
                          <span className="text-xs text-amber-200/40 font-black">-</span>
                          <span className={`text-base font-mono font-black ${liveState.scoreB > liveState.scoreA ? 'text-emerald-400' : 'text-amber-100'}`}>
                            {liveState.scoreB}
                          </span>
                        </div>

                        {/* Idol B */}
                        <div className="flex items-center justify-end gap-2 overflow-hidden text-right">
                          <div className="min-w-0">
                            <div className="flex items-center justify-end gap-1">
                              {isFavB && <span className="text-[10px] text-amber-400">★</span>}
                              <span className={`text-xs font-black truncate ${isFavB ? 'text-amber-300' : 'text-amber-100'}`}>
                                {idolB?.name || 'Idol B'}
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-200/60 font-bold block truncate">
                              {idolB?.girlGroup || 'Solo'}
                            </span>
                          </div>
                          {idolB?.photoUrl ? (
                            <img
                              src={idolB.photoUrl}
                              alt={idolB.name}
                              className="w-9 h-9 rounded-full object-cover border-2 border-black shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-blue-950 border-2 border-black flex items-center justify-center font-bold text-xs text-blue-300 shrink-0">
                              {idolB?.name?.charAt(0) || 'B'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Momentum meter */}
                      <div className="mt-2.5 pt-2 border-t border-amber-500/10 flex items-center justify-between text-[10px] text-amber-200/50">
                        <span>Momentum:</span>
                        <div className="w-24 h-1.5 bg-[#0a0503] rounded-full overflow-hidden flex border border-amber-500/20">
                          <div
                            className="bg-red-500 h-full transition-all"
                            style={{ width: `${Math.max(0, 50 + (liveState.momentum || 0) / 2)}%` }}
                          />
                          <div
                            className="bg-blue-500 h-full transition-all"
                            style={{ width: `${Math.max(0, 50 - (liveState.momentum || 0) / 2)}%` }}
                          />
                        </div>
                        <span className="font-mono text-amber-400 font-bold">
                          {liveState.possession === 'A' ? '◀ Attacking' : liveState.possession === 'B' ? 'Attacking ▶' : 'Midfield'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Standings Telemetry Grid */}
          <div className="bg-[#180e08] border-2 border-black rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/20">
              <h3 className="text-base font-black text-amber-100 flex items-center gap-2">
                <Table className="w-5 h-5 text-amber-400" />
                <span>Live Group Standings Telemetry</span>
              </h3>
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Updating live with match scores
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveStandingsPreview.map((grp) => (
                <div
                  key={grp.groupId}
                  className="bg-[#120804] border border-amber-500/30 rounded-2xl p-3 space-y-2 shadow"
                >
                  <div className="flex items-center justify-between text-xs font-black text-amber-300 pb-1.5 border-b border-amber-500/20">
                    <span>{grp.groupName}</span>
                    <span className="text-[10px] text-amber-200/50 uppercase">Top 2 Advance</span>
                  </div>

                  <div className="space-y-1">
                    {grp.standings.map((st, idx) => {
                      const idol = idolsMap.get(st.idolId);
                      const isQualifying = idx < 2;

                      return (
                        <div
                          key={st.idolId}
                          className={`flex items-center justify-between text-xs p-1.5 rounded-lg border ${
                            isQualifying
                              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                              : 'bg-black/40 border-transparent text-amber-200/70'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-4 font-mono font-black text-center text-[11px] ${isQualifying ? 'text-emerald-400' : 'text-amber-200/40'}`}>
                              {idx + 1}
                            </span>
                            <span className="font-bold truncate max-w-[100px]">
                              {idol?.name || 'Idol'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                            <span className="text-amber-200/50">{st.played}P</span>
                            <span className={st.goalDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {st.goalDiff > 0 ? `+${st.goalDiff}` : st.goalDiff}
                            </span>
                            <span className="text-amber-300 font-black px-1.5 py-0.5 bg-black/60 rounded">
                              {st.points}pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
