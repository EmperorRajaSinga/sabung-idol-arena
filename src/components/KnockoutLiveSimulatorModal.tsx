import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Idol, KnockoutMatch, TournamentConfig } from '../types';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { LiveMatchVisualizer } from './LiveMatchVisualizer';
import { getCountryFlag } from '../utils/nationalityHelper';
import { getIdolRating } from '../utils/ratingHelper';
import { updateKnockoutMatchScore } from '../utils/tournamentLogic';
import {
  generateMatchSimulation,
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
  Swords,
  Crown,
  ShieldAlert,
} from 'lucide-react';

export interface KnockoutLiveSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  knockoutMatches: KnockoutMatch[];
  idolsMap: Map<string, Idol>;
  config: TournamentConfig;
  onCommitMatches: (updatedMatches: KnockoutMatch[]) => void;
}

interface SimulatedSeriesGame {
  gameNumber: number;
  sim: PreGeneratedMatchSimulation;
}

interface SimulatedKnockoutSeries {
  match: KnockoutMatch;
  idolA: Idol;
  idolB: Idol;
  targetWins: number;
  games: SimulatedSeriesGame[];
  finalWinsA: number;
  finalWinsB: number;
  winnerId: string;
  loserId: string;
  totalFrames: number;
}

export const KnockoutLiveSimulatorModal: React.FC<KnockoutLiveSimulatorModalProps> = ({
  isOpen,
  onClose,
  knockoutMatches = [],
  idolsMap,
  config,
  onCommitMatches,
}) => {
  const favoriteSet = useMemo(() => new Set(config.favoriteIdolIds || []), [config.favoriteIdolIds]);

  // Collect all rounds available in knockout
  const roundIndices = useMemo(() => {
    const rounds = new Set<number>();
    (knockoutMatches || []).forEach((m) => {
      if (m.roundIndex !== undefined) rounds.add(m.roundIndex);
    });
    return Array.from(rounds).sort((a, b) => a - b);
  }, [knockoutMatches]);

  // Find initial active uncompleted round
  const defaultRound = useMemo(() => {
    for (const rIdx of roundIndices) {
      const pendingInRound = knockoutMatches.filter(
        (m) => m.roundIndex === rIdx && m.idolAId && m.idolBId && !m.completed
      );
      if (pendingInRound.length > 0) return `round_${rIdx}`;
    }
    return 'all_ready';
  }, [knockoutMatches, roundIndices]);

  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>(defaultRound);
  const [simulatedSeriesList, setSimulatedSeriesList] = useState<SimulatedKnockoutSeries[]>([]);

  // Filter playable matches (both idols present and not completed)
  const playableMatches: KnockoutMatch[] = useMemo(() => {
    const ready = (knockoutMatches || []).filter(
      (m) => m.idolAId && m.idolBId && !m.completed
    );

    if (selectedRoundFilter.startsWith('round_')) {
      const rIdx = Number(selectedRoundFilter.replace('round_', ''));
      return ready.filter((m) => m.roundIndex === rIdx);
    }
    return ready;
  }, [knockoutMatches, selectedRoundFilter]);

  // Form history lookup map from tournament groups and prior knockout matches
  const idolFormMap = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    (config?.groups || []).forEach((g) => {
      (g.matches || []).forEach((m) => {
        if (m.completed && m.scoreA !== null && m.scoreB !== null) {
          const listA = map.get(m.idolAId) || [];
          listA.push(m.scoreA > m.scoreB ? 'W' : m.scoreA < m.scoreB ? 'L' : 'D');
          map.set(m.idolAId, listA);

          const listB = map.get(m.idolBId) || [];
          listB.push(m.scoreB > m.scoreA ? 'W' : m.scoreB < m.scoreA ? 'L' : 'D');
          map.set(m.idolBId, listB);
        }
      });
    });

    (knockoutMatches || []).forEach((km) => {
      if (km.completed && km.winnerId && km.idolAId && km.idolBId) {
        const listA = map.get(km.idolAId) || [];
        listA.push(km.winnerId === km.idolAId ? 'W' : 'L');
        map.set(km.idolAId, listA);

        const listB = map.get(km.idolBId) || [];
        listB.push(km.winnerId === km.idolBId ? 'W' : 'L');
        map.set(km.idolBId, listB);
      }
    });

    return map;
  }, [config?.groups, knockoutMatches]);

  // Stable generator for Series simulations
  const generateSeriesSimulations = useCallback(
    (matches: KnockoutMatch[]) => {
      return matches.map((m) => {
        const idolA = idolsMap.get(m.idolAId || '') || ({
          id: m.idolAId || '',
          name: 'Idol A',
          girlGroup: 'Solo',
          seed: 'Seed 1',
        } as Idol);

        const idolB = idolsMap.get(m.idolBId || '') || ({
          id: m.idolBId || '',
          name: 'Idol B',
          girlGroup: 'Solo',
          seed: 'Seed 2',
        } as Idol);

        const formA = (idolFormMap.get(idolA.id) || []).slice(-5);
        const formB = (idolFormMap.get(idolB.id) || []).slice(-5);

        const isFinal =
          (m.roundName || '').toLowerCase().includes('grand final') ||
          (m.roundName || '').toLowerCase().includes('third');

        const targetWins = m.bestOf === 7 || isFinal ? 4 : 3; // Best of 7 or Best of 5

        let winsA = 0;
        let winsB = 0;
        let gameNumber = 1;
        const games: SimulatedSeriesGame[] = [];

        // Simulate game by game until target wins reached
        while (winsA < targetWins && winsB < targetWins && gameNumber <= targetWins * 2 - 1) {
          const gameSim = generateMatchSimulation(
            `${m.id}-g${gameNumber}`,
            idolA,
            idolB,
            formA,
            formB
          );

          let gWinner = gameSim.winnerId;
          // In knockout, every game must have a decisive outcome
          if (!gWinner || gameSim.finalScoreA === gameSim.finalScoreB) {
            const rA = getIdolRating(idolA);
            const rB = getIdolRating(idolB);
            gWinner = Math.random() < 0.5 + (rA - rB) * 0.008 ? idolA.id : idolB.id;
            if (gWinner === idolA.id && gameSim.finalScoreA <= gameSim.finalScoreB) {
              gameSim.finalScoreA = gameSim.finalScoreB + 1;
            } else if (gWinner === idolB.id && gameSim.finalScoreB <= gameSim.finalScoreA) {
              gameSim.finalScoreB = gameSim.finalScoreA + 1;
            }
          }

          gameSim.winnerId = gWinner;

          // Synchronize final frame scores to match decisive game outcome
          if (gameSim.frames && gameSim.frames.length > 0) {
            const lastFrame = gameSim.frames[gameSim.frames.length - 1];
            if (lastFrame) {
              lastFrame.scoreA = gameSim.finalScoreA;
              lastFrame.scoreB = gameSim.finalScoreB;
            }
          }

          if (gWinner === idolA.id) winsA++;
          else winsB++;

          games.push({
            gameNumber,
            sim: gameSim,
          });

          gameNumber++;
        }

        const totalFrames = games.reduce((acc, g) => acc + (g?.sim?.frames?.length || 0), 0);
        const winnerId = winsA > winsB ? idolA.id : idolB.id;
        const loserId = winsA > winsB ? idolB.id : idolA.id;

        return {
          match: m,
          idolA,
          idolB,
          targetWins,
          games,
          finalWinsA: winsA,
          finalWinsB: winsB,
          winnerId,
          loserId,
          totalFrames,
        };
      });
    },
    [idolsMap]
  );

  // Initialize and preserve simulations upon modal open or round filter change
  useEffect(() => {
    if (!isOpen) return;
    if (playableMatches.length === 0) {
      setSimulatedSeriesList([]);
      return;
    }
    const generated = generateSeriesSimulations(playableMatches);
    setSimulatedSeriesList(generated);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setRecentBreakingNews([]);
    setSpotlightMatchId(null);
  }, [isOpen, selectedRoundFilter, playableMatches.length]);

  const maxTotalFrames = useMemo(() => {
    if (simulatedSeriesList.length === 0) return 95;
    return Math.max(...simulatedSeriesList.map((s) => s.totalFrames));
  }, [simulatedSeriesList]);

  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [spotlightMatchId, setSpotlightMatchId] = useState<string | null>(null);
  const [recentBreakingNews, setRecentBreakingNews] = useState<MatchLiveEvent[]>([]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isFinished = currentFrameIdx >= maxTotalFrames - 1;

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

  // Compute live series status for each clash at currentFrameIdx
  const liveSeriesStates = useMemo(() => {
    return simulatedSeriesList.map((series) => {
      let accumulatedFrames = 0;
      let winsA = 0;
      let winsB = 0;
      let activeGameIdx = 0;
      let activeGameFrameIdx = 0;
      let activeGameFrame: MinuteTimelineFrame | null = null;
      let isSeriesOver = false;

      for (let i = 0; i < (series.games || []).length; i++) {
        const game = series.games[i];
        const gLen = game?.sim?.frames?.length || 0;

        if (currentFrameIdx >= accumulatedFrames + gLen) {
          // Game already finished in the timeline - evaluate winner strictly by game.sim.winnerId
          if (game.sim.winnerId === series.idolA.id) {
            winsA++;
          } else {
            winsB++;
          }
          accumulatedFrames += gLen;
          activeGameIdx = Math.min((series.games?.length || 1) - 1, i + 1);
        } else {
          // This is the active game right now
          activeGameIdx = i;
          activeGameFrameIdx = currentFrameIdx - accumulatedFrames;
          activeGameFrame = game?.sim?.frames && game.sim.frames.length > 0
            ? game.sim.frames[Math.min(activeGameFrameIdx, gLen - 1)]
            : null;
          break;
        }
      }

      if (winsA >= series.targetWins || winsB >= series.targetWins) {
        isSeriesOver = true;
      }

      // If all games finished
      if (currentFrameIdx >= series.totalFrames - 1) {
        winsA = series.finalWinsA;
        winsB = series.finalWinsB;
        isSeriesOver = true;
      }

      const activeGame = series.games[activeGameIdx] || series.games[0];
      const activeGameMinute = activeGameFrame ? activeGameFrame.minute : isSeriesOver ? 90 : 0;
      const liveGameScoreA = activeGameFrame ? activeGameFrame.scoreA : 0;
      const liveGameScoreB = activeGameFrame ? activeGameFrame.scoreB : 0;

      return {
        series,
        matchId: series.match.id,
        winsA,
        winsB,
        activeGameNumber: activeGame?.gameNumber || 1,
        activeGameMinute,
        liveGameScoreA,
        liveGameScoreB,
        activeGameFrame,
        isSeriesOver,
      };
    });
  }, [simulatedSeriesList, currentFrameIdx]);

  // Live goals & match points tracking for news ticker
  useEffect(() => {
    if (!isOpen) return;
    const newGoals: MatchLiveEvent[] = [];

    liveSeriesStates.forEach((st) => {
      if (st.activeGameFrame?.event?.type === 'goal') {
        newGoals.push(st.activeGameFrame.event);
      }
    });

    if (newGoals.length > 0) {
      setRecentBreakingNews((prev) => [...newGoals, ...prev].slice(0, 6));
    }
  }, [liveSeriesStates, isOpen]);

  // Handle Restart Simulation
  const handleRestartSimulation = () => {
    if (playableMatches.length > 0) {
      const generated = generateSeriesSimulations(playableMatches);
      setSimulatedSeriesList(generated);
    }
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setRecentBreakingNews([]);
    setSpotlightMatchId(null);
  };

  // Handle Commit & Advance Bracket
  const handleCommit = () => {
    let updated = knockoutMatches.map((km) => ({ ...km }));

    // Sort series by round index so feeding matches in order advances winners accurately
    const sortedSeries = [...simulatedSeriesList].sort(
      (a, b) => (a.match.roundIndex ?? 0) - (b.match.roundIndex ?? 0)
    );

    sortedSeries.forEach((series) => {
      updated = updateKnockoutMatchScore(
        updated,
        series.match.id,
        series.finalWinsA,
        series.finalWinsB,
        series.winnerId
      );
    });

    onCommitMatches(updated);
    onClose();
  };

  const spotlightSeries = simulatedSeriesList.find((s) => s.match.id === spotlightMatchId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl max-h-[96vh] flex flex-col bg-[#140810] border-3 border-black rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Top Broadcast Banner Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-purple-950 via-[#1f0a1d] to-red-950 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/30 border border-purple-500/50 rounded-2xl animate-pulse">
              <Swords className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                  Knockout Arena Simulcast
                </span>
                <h2 className="text-xl sm:text-2xl font-poster-title text-purple-100 drop-shadow-[2px_2px_0px_#000]">
                  Playoff Series Multi-Broadcast
                </h2>
              </div>
              <p className="text-xs text-purple-200/70 font-bold mt-0.5">
                Simulating {playableMatches.length} knockout series matches simultaneously in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Round filter pills */}
            <div className="flex items-center gap-1.5 bg-[#090308] p-1 rounded-2xl border border-purple-500/30">
              <button
                onClick={() => setSelectedRoundFilter('all_ready')}
                className={`px-3 py-1 text-xs font-black rounded-xl transition-all ${
                  selectedRoundFilter === 'all_ready'
                    ? 'bg-purple-500 text-white shadow'
                    : 'text-purple-200/70 hover:text-purple-100'
                }`}
              >
                All Ready ({playableMatches.length})
              </button>
              {roundIndices.map((rIdx) => {
                const roundMatches = knockoutMatches.filter((m) => m.roundIndex === rIdx);
                const rName = roundMatches[0]?.roundName || `Round ${rIdx + 1}`;
                return (
                  <button
                    key={rIdx}
                    onClick={() => setSelectedRoundFilter(`round_${rIdx}`)}
                    className={`px-3 py-1 text-xs font-black rounded-xl transition-all ${
                      selectedRoundFilter === `round_${rIdx}`
                        ? 'bg-purple-500 text-white shadow'
                        : 'text-purple-200/70 hover:text-purple-100'
                    }`}
                  >
                    {rName}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="p-2 bg-black/60 hover:bg-black text-purple-300 hover:text-purple-100 rounded-full border border-purple-500/30 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Broadcast Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[#190b17] border-b-2 border-black">
          {/* Series Timeline Bar */}
          <div className="flex items-center gap-3 min-w-[240px] flex-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black border border-purple-500/40">
              <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="font-mono text-sm font-black text-purple-300">
                {Math.round((currentFrameIdx / (maxTotalFrames - 1 || 1)) * 100)}% Series
              </span>
            </div>

            <div className="flex-1 h-3 bg-[#0a0309] rounded-full overflow-hidden border border-purple-500/30">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 transition-all duration-150"
                style={{ width: `${Math.min(100, (currentFrameIdx / (maxTotalFrames - 1 || 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Controls: Play, Pause, Speeds, Sound */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl font-black flex items-center gap-1.5 transition-all shadow"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
              <span className="text-xs font-black uppercase">{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              onClick={handleRestartSimulation}
              className="p-2 bg-[#090308] hover:bg-black text-purple-300 rounded-xl border border-purple-500/30 transition-all"
              title="Restart Series Simulation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 bg-[#090308] p-1 rounded-xl border border-purple-500/30">
              {[1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-0.5 text-[11px] font-black rounded-lg transition-all ${
                    simSpeed === spd
                      ? 'bg-purple-500 text-white'
                      : 'text-purple-200/70 hover:text-purple-100'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentFrameIdx(maxTotalFrames - 1)}
              className="px-3 py-1.5 bg-[#090308] hover:bg-black text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Instant Finish</span>
            </button>

            <button
              onClick={handleCommit}
              disabled={!isFinished}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>Commit &amp; Advance Bracket</span>
            </button>
          </div>
        </div>

        {/* Breaking News Ticker */}
        {recentBreakingNews.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-1.5 bg-purple-950/80 border-b border-purple-500/30 overflow-x-auto text-xs">
            <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 animate-pulse">
              <Zap className="w-3 h-3 fill-white" /> Knockout Alert
            </span>
            <div className="flex items-center gap-4 text-purple-200 font-bold whitespace-nowrap">
              {recentBreakingNews.map((ev, i) => (
                <span key={ev.id || i} className="flex items-center gap-1">
                  <span className="text-pink-400 font-black">{ev.minute}&apos;</span> {ev.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Spotlight Pitch View */}
          {spotlightSeries && (
            <div className="bg-[#1b0a1a] border-2 border-purple-500/50 rounded-3xl p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/20 mb-4">
                <div className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-black text-purple-100">
                    Spotlight Series: {spotlightSeries.idolA.name} vs {spotlightSeries.idolB.name} ({spotlightSeries.match.roundName})
                  </h3>
                </div>
                <button
                  onClick={() => setSpotlightMatchId(null)}
                  className="px-3 py-1 bg-black/60 hover:bg-black text-purple-300 rounded-xl border border-purple-500/30 text-xs font-bold"
                >
                  Close Spotlight
                </button>
              </div>

              <LiveMatchVisualizer
                idolA={spotlightSeries.idolA}
                idolB={spotlightSeries.idolB}
                formHistoryA={(idolFormMap.get(spotlightSeries.idolA.id) || []).slice(-5)}
                formHistoryB={(idolFormMap.get(spotlightSeries.idolB.id) || []).slice(-5)}
                isKnockout={true}
                stageLabel={spotlightSeries.match.roundName || 'Knockout Series'}
                onMatchComplete={() => {}}
              />
            </div>
          )}

          {/* Knockout Clash Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <Swords className="w-4 h-4 text-purple-400" />
                <span>Simultaneous Knockout Series ({playableMatches.length})</span>
              </h3>
              <span className="text-xs text-purple-200/60 font-bold">
                Click any series to expand with Spotlight Camera
              </span>
            </div>

            {playableMatches.length === 0 ? (
              <div className="p-8 text-center bg-[#130712] rounded-2xl border border-purple-500/20 text-purple-200/60 font-bold">
                No uncompleted matches found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveSeriesStates.map((st) => {
                  const { series, winsA, winsB, activeGameNumber, activeGameMinute, liveGameScoreA, liveGameScoreB, isSeriesOver } = st;
                  const isFavA = favoriteSet.has(series.idolA.id);
                  const isFavB = favoriteSet.has(series.idolB.id);
                  const isSpotlight = spotlightMatchId === series.match.id;

                  const isMatchPointA = winsA === series.targetWins - 1 && !isSeriesOver;
                  const isMatchPointB = winsB === series.targetWins - 1 && !isSeriesOver;

                  return (
                    <div
                      key={series.match.id}
                      onClick={() => setSpotlightMatchId(series.match.id)}
                      className={`relative bg-[#110510] border-2 rounded-3xl p-4 shadow-xl cursor-pointer transition-all hover:scale-[1.01] hover:border-purple-400 ${
                        isSpotlight
                          ? 'border-purple-400 ring-2 ring-purple-400/40 bg-[#1c0a1a]'
                          : 'border-black'
                      }`}
                    >
                      {/* Header row: Round name, Best of X, Active game */}
                      <div className="flex items-center justify-between text-xs font-bold pb-2 border-b border-purple-500/20 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-purple-500/40 text-purple-300 font-black">
                            {series.match.roundName}
                          </span>
                          <span className="text-[11px] text-purple-200/60">
                            Best of {series.targetWins * 2 - 1} (First to {series.targetWins})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isMatchPointA && (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-black animate-pulse">
                              {series.idolA.name} Match Point
                            </span>
                          )}
                          {isMatchPointB && (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-black animate-pulse">
                              {series.idolB.name} Match Point
                            </span>
                          )}
                          {isSeriesOver ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                              Series Final
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 border border-purple-500/30 text-[10px] font-mono font-black">
                              Game {activeGameNumber} &bull; {activeGameMinute}&apos;
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Series Showcase */}
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        {/* Idol A */}
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {series.idolA.photoUrl ? (
                            <img
                              src={series.idolA.photoUrl}
                              alt={series.idolA.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-black shrink-0 shadow"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-red-950 border-2 border-black flex items-center justify-center font-bold text-sm text-red-300 shrink-0">
                              {series.idolA.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className={`text-sm font-black truncate ${isFavA ? 'text-amber-300' : 'text-purple-100'}`}>
                                {series.idolA.name}
                              </span>
                              {isFavA && <span className="text-xs text-amber-400">★</span>}
                            </div>
                            <span className="text-[11px] text-purple-200/60 font-bold block truncate">
                              {series.idolA.girlGroup || 'Solo'}
                            </span>
                          </div>
                        </div>

                        {/* Series Score (Wins Counter) */}
                        <div className="flex flex-col items-center justify-center px-4 py-2 bg-black/80 border border-purple-500/40 rounded-2xl shrink-0">
                          <div className="flex items-center gap-3">
                            <span className={`text-2xl font-mono font-black ${winsA > winsB ? 'text-amber-400' : 'text-purple-100'}`}>
                              {winsA}
                            </span>
                            <span className="text-xs text-purple-400/50 font-black">-</span>
                            <span className={`text-2xl font-mono font-black ${winsB > winsA ? 'text-amber-400' : 'text-purple-100'}`}>
                              {winsB}
                            </span>
                          </div>
                          <span className="text-[9px] text-purple-200/50 uppercase font-black tracking-widest mt-0.5">
                            Series Score
                          </span>
                        </div>

                        {/* Idol B */}
                        <div className="flex items-center justify-end gap-2.5 overflow-hidden text-right">
                          <div className="min-w-0">
                            <div className="flex items-center justify-end gap-1">
                              {isFavB && <span className="text-xs text-amber-400">★</span>}
                              <span className={`text-sm font-black truncate ${isFavB ? 'text-amber-300' : 'text-purple-100'}`}>
                                {series.idolB.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-purple-200/60 font-bold block truncate">
                              {series.idolB.girlGroup || 'Solo'}
                            </span>
                          </div>
                          {series.idolB.photoUrl ? (
                            <img
                              src={series.idolB.photoUrl}
                              alt={series.idolB.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-black shrink-0 shadow"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-blue-950 border-2 border-black flex items-center justify-center font-bold text-sm text-blue-300 shrink-0">
                              {series.idolB.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active Game Miniature Ticker */}
                      {!isSeriesOver && (
                        <div className="mt-3 pt-2.5 border-t border-purple-500/10 flex items-center justify-between text-xs bg-black/40 px-3 py-1.5 rounded-xl">
                          <div className="flex items-center gap-1.5 text-purple-200/70">
                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                            <span>Game {activeGameNumber} Live:</span>
                          </div>

                          <div className="font-mono font-black text-amber-300 flex items-center gap-2">
                            <span>{series.idolA.name.split(' ')[0]} {liveGameScoreA}</span>
                            <span className="text-purple-400/40">:</span>
                            <span>{liveGameScoreB} {series.idolB.name.split(' ')[0]}</span>
                          </div>

                          <span className="font-mono text-purple-300 font-bold text-[11px]">
                            {activeGameMinute}&apos;
                          </span>
                        </div>
                      )}

                      {/* Series Winner Crown if finished */}
                      {isSeriesOver && (
                        <div className="mt-3 pt-2.5 border-t border-purple-500/10 flex items-center justify-center gap-2 text-xs font-black text-amber-300 bg-amber-950/40 py-1.5 rounded-xl border border-amber-500/30">
                          <Crown className="w-4 h-4 text-amber-400" />
                          <span>
                            {winsA > winsB ? series.idolA.name : series.idolB.name} advances to Next Round ({Math.max(winsA, winsB)} - {Math.min(winsA, winsB)})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
