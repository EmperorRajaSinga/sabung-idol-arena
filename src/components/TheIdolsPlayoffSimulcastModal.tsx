import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Idol, TheIdolsPlayoffMatch, TheIdolsStanding } from '../types';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { LiveMatchVisualizer } from './LiveMatchVisualizer';
import { getIdolRating } from '../utils/ratingHelper';
import {
  generateMatchSimulation,
  PreGeneratedMatchSimulation,
  MatchLiveEvent,
} from '../utils/liveMatchSimulator';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Activity,
  Zap,
  Tv,
  Swords,
  Crown,
  Sparkles,
} from 'lucide-react';

export interface TheIdolsPlayoffSimulcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  playoffMatches: TheIdolsPlayoffMatch[];
  idolsMap: Map<string, Idol>;
  standings?: TheIdolsStanding[];
  onCommitMatches: (updatedMatches: TheIdolsPlayoffMatch[]) => void;
}

interface SimulatedPlayoffGame {
  gameNumber: number;
  sim: PreGeneratedMatchSimulation;
}

interface SimulatedPlayoffSeries {
  match: TheIdolsPlayoffMatch;
  idolA: Idol;
  idolB: Idol;
  targetWins: number;
  games: SimulatedPlayoffGame[];
  finalWinsA: number;
  finalWinsB: number;
  winnerId: string;
  loserId: string;
  totalFrames: number;
}

export const TheIdolsPlayoffSimulcastModal: React.FC<TheIdolsPlayoffSimulcastModalProps> = ({
  isOpen,
  onClose,
  playoffMatches = [],
  idolsMap,
  standings = [],
  onCommitMatches,
}) => {
  const resolvedMap = useMemo(() => {
    return idolsMap && typeof idolsMap.get === 'function' ? idolsMap : new Map<string, Idol>();
  }, [idolsMap]);

  // Form history lookup map from standings
  const idolFormMap = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    (standings || []).forEach((st) => {
      map.set(st.idolId, st.form || []);
    });
    return map;
  }, [standings]);

  // Round codes available in playoff
  const availableRounds = useMemo(() => {
    const rounds: string[] = [];
    playoffMatches.forEach((m) => {
      if (m.roundCode && !rounds.includes(m.roundCode)) {
        rounds.push(m.roundCode);
      }
    });
    return rounds;
  }, [playoffMatches]);

  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>('all_ready');
  const [simulatedSeriesList, setSimulatedSeriesList] = useState<SimulatedPlayoffSeries[]>([]);
  const [spotlightMatchId, setSpotlightMatchId] = useState<string | null>(null);

  // Ready matches with both idols present and not finished
  const readyMatches = useMemo(() => {
    let filtered = playoffMatches.filter(
      (m) => m.idolAId && m.idolBId && (!m.completed || m.winnerId === null)
    );

    if (selectedRoundFilter !== 'all_ready') {
      filtered = filtered.filter((m) => m.roundCode === selectedRoundFilter);
    }

    return filtered;
  }, [playoffMatches, selectedRoundFilter]);

  // Playback Control States
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Series Simulation Generator
  const generateSeriesSimulations = useCallback(
    (matches: TheIdolsPlayoffMatch[]) => {
      return matches.map((match) => {
        const idolA = resolvedMap.get(match.idolAId || '') || ({
          id: match.idolAId || 'A',
          name: 'Contender A',
          girlGroup: 'Group A',
          seed: 'Seed 1',
        } as Idol);

        const idolB = resolvedMap.get(match.idolBId || '') || ({
          id: match.idolBId || 'B',
          name: 'Contender B',
          girlGroup: 'Group B',
          seed: 'Seed 2',
        } as Idol);

        const formA = (idolFormMap.get(idolA.id) || []).slice(-5);
        const formB = (idolFormMap.get(idolB.id) || []).slice(-5);

        const isFinalOrGrand =
          match.roundCode.toLowerCase().includes('final') ||
          match.roundCode.toLowerCase().includes('grand');
        const targetWins = isFinalOrGrand ? 4 : 3; // BO7 or BO5

        let winsA = 0;
        let winsB = 0;
        let gameIndex = 1;
        const games: SimulatedPlayoffGame[] = [];
        let totalSeriesFrames = 0;

        while (winsA < targetWins && winsB < targetWins && gameIndex <= (targetWins * 2 - 1)) {
          const gameSim = generateMatchSimulation(
            `${match.id}_g${gameIndex}`,
            idolA,
            idolB,
            formA,
            formB
          );

          let gWinner = gameSim.winnerId;
          // In playoffs, resolve decisive outcome
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

          if (gameSim.frames && gameSim.frames.length > 0) {
            const lastFrame = gameSim.frames[gameSim.frames.length - 1];
            if (lastFrame) {
              lastFrame.scoreA = gameSim.finalScoreA;
              lastFrame.scoreB = gameSim.finalScoreB;
            }
          }

          if (gameSim.finalScoreA > gameSim.finalScoreB) {
            winsA++;
          } else {
            winsB++;
          }

          games.push({ gameNumber: gameIndex, sim: gameSim });
          totalSeriesFrames += gameSim.frames.length;
          gameIndex++;
        }

        const winnerId = winsA > winsB ? idolA.id : idolB.id;
        const loserId = winsA > winsB ? idolB.id : idolA.id;

        return {
          match,
          idolA,
          idolB,
          targetWins,
          games,
          finalWinsA: winsA,
          finalWinsB: winsB,
          winnerId,
          loserId,
          totalFrames: totalSeriesFrames,
        };
      });
    },
    [resolvedMap, idolFormMap]
  );

  // Initialize simulations upon open or filter change
  useEffect(() => {
    if (!isOpen) return;
    if (readyMatches.length === 0) {
      setSimulatedSeriesList([]);
      setCurrentFrameIdx(0);
      return;
    }
    const sims = generateSeriesSimulations(readyMatches);
    setSimulatedSeriesList(sims);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setSpotlightMatchId(null);
  }, [isOpen, readyMatches, generateSeriesSimulations]);

  // Max total timeline frames across all series
  const maxTotalFrames = useMemo(() => {
    if (simulatedSeriesList.length === 0) return 90;
    return Math.max(...simulatedSeriesList.map((s) => s.totalFrames), 90);
  }, [simulatedSeriesList]);

  const isFinished = currentFrameIdx >= maxTotalFrames - 1;

  // Real-time animation playback loop
  useEffect(() => {
    if (!isPlaying || isFinished) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = Math.max(30, Math.round(500 / simSpeed));

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
  }, [isPlaying, isFinished, simSpeed, maxTotalFrames]);

  // Compute live states of all series at current frame
  const liveSeriesStates = useMemo(() => {
    return simulatedSeriesList.map((series) => {
      let cumulativeFrames = 0;
      let activeGame: SimulatedPlayoffGame = series.games[0];
      let activeGameNumber = 1;
      let winsA = 0;
      let winsB = 0;
      let liveGameScoreA = 0;
      let liveGameScoreB = 0;
      let activeGameMinute = 0;
      let isSeriesOver = false;

      for (let gIdx = 0; gIdx < series.games.length; gIdx++) {
        const game = series.games[gIdx];
        const gFrames = game.sim.frames.length;

        if (currentFrameIdx >= cumulativeFrames + gFrames) {
          // Game already completed
          const finalScoreA = game.sim.finalScoreA;
          const finalScoreB = game.sim.finalScoreB;
          if (finalScoreA > finalScoreB) winsA++;
          else winsB++;

          cumulativeFrames += gFrames;
          if (winsA >= series.targetWins || winsB >= series.targetWins) {
            isSeriesOver = true;
            break;
          }
        } else {
          // Current active game
          activeGame = game;
          activeGameNumber = game.gameNumber;
          const frameInGame = Math.min(
            currentFrameIdx - cumulativeFrames,
            gFrames - 1
          );
          const currentTimelineFrame = game.sim.frames[frameInGame] || game.sim.frames[0];
          liveGameScoreA = currentTimelineFrame?.scoreA || 0;
          liveGameScoreB = currentTimelineFrame?.scoreB || 0;
          activeGameMinute = currentTimelineFrame?.minute || 0;
          break;
        }
      }

      if (winsA >= series.targetWins || winsB >= series.targetWins) {
        isSeriesOver = true;
        winsA = series.finalWinsA;
        winsB = series.finalWinsB;
      }

      return {
        series,
        activeGame,
        winsA,
        winsB,
        activeGameNumber,
        activeGameMinute,
        liveGameScoreA,
        liveGameScoreB,
        isSeriesOver,
      };
    });
  }, [simulatedSeriesList, currentFrameIdx]);

  // Breaking news ticker items
  const recentBreakingNews = useMemo(() => {
    const events: MatchLiveEvent[] = [];
    liveSeriesStates.forEach(({ activeGame, series }) => {
      if (!activeGame?.sim?.frames) return;
      const fIdx = Math.min(currentFrameIdx, activeGame.sim.frames.length - 1);
      const frame = activeGame.sim.frames[fIdx];
      if (frame && frame.event) {
        events.push({
          ...frame.event,
          title: `${series.idolA.name.split(' ')[0]} vs ${series.idolB.name.split(' ')[0]}: ${frame.event.title}`,
        });
      }
    });
    return events.slice(-4);
  }, [liveSeriesStates, currentFrameIdx]);

  // Spotlight series
  const spotlightSeries = useMemo(() => {
    if (!spotlightMatchId) return null;
    return simulatedSeriesList.find((s) => s.match.id === spotlightMatchId) || null;
  }, [spotlightMatchId, simulatedSeriesList]);

  // Commit handler: updates matches and closes modal
  const handleCommitResults = () => {
    const updated: TheIdolsPlayoffMatch[] = simulatedSeriesList.map((s) => {
      return {
        ...s.match,
        winsA: s.finalWinsA,
        winsB: s.finalWinsB,
        winnerId: s.winnerId,
        loserId: s.loserId,
        completed: true,
      };
    });

    onCommitMatches(updated);
    onClose();
  };

  const handleRestartSimulation = () => {
    const sims = generateSeriesSimulations(readyMatches);
    setSimulatedSeriesList(sims);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl max-h-[96vh] flex flex-col bg-[#140810] border-3 border-black rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Broadcast Banner Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-purple-950 via-[#1f0a1d] to-red-950 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-600/30 border border-purple-500/40 text-purple-300 shadow-inner animate-pulse">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase tracking-wider">
                  Masters Playoff Simulcast
                </span>
                <span className="text-xs text-purple-300/80 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Multi-Series Championship
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-poster-title tracking-tight drop-shadow">
                Playoff Broadcast Arena
              </h2>
              <p className="text-xs text-purple-200/70">
                Simulating {readyMatches.length} Playoff series simultaneously in real-time.
              </p>
            </div>
          </div>

          {/* Round Filter Pills + Close */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#090308] p-1 rounded-2xl border border-purple-500/30">
              <button
                onClick={() => setSelectedRoundFilter('all_ready')}
                className={`px-3 py-1 text-xs font-black rounded-xl transition-all ${
                  selectedRoundFilter === 'all_ready'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-purple-300/70 hover:text-purple-100'
                }`}
              >
                All Ready ({readyMatches.length})
              </button>
              {availableRounds.map((rc) => (
                <button
                  key={rc}
                  onClick={() => setSelectedRoundFilter(rc)}
                  className={`px-2.5 py-1 text-xs font-black rounded-xl transition-all ${
                    selectedRoundFilter === rc
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-purple-300/70 hover:text-purple-100'
                  }`}
                >
                  {rc.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-black/60 hover:bg-black text-purple-300 hover:text-white border border-purple-500/40 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Broadcast Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-[#190b17] border-b-2 border-black">
          {/* Timeline Bar */}
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black border border-purple-500/40">
              <Activity className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="font-mono text-sm font-black text-purple-300">
                {Math.round((currentFrameIdx / (maxTotalFrames - 1 || 1)) * 100)}% Series
              </span>
            </div>

            <div className="flex-1 h-3 bg-[#0a0309] rounded-full overflow-hidden border border-purple-500/30">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 transition-all duration-150"
                style={{
                  width: `${Math.min(100, (currentFrameIdx / (maxTotalFrames - 1 || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Controls */}
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
              onClick={handleCommitResults}
              disabled={!isFinished || readyMatches.length === 0}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>Apply Playoff Results to Bracket</span>
            </button>
          </div>
        </div>

        {/* Breaking News Ticker */}
        {recentBreakingNews.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-1.5 bg-purple-950/80 border-b border-purple-500/30 overflow-x-auto text-xs">
            <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 animate-pulse">
              <Zap className="w-3 h-3 fill-white" /> Playoff Alert
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
                    Spotlight Series: {spotlightSeries.idolA.name} vs {spotlightSeries.idolB.name} (
                    {spotlightSeries.match.roundCode.replace('_', ' ').toUpperCase()})
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
                stageLabel={`Playoff ${spotlightSeries.match.roundCode}`}
                onMatchComplete={() => {}}
              />
            </div>
          )}

          {/* Series Clash Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <Swords className="w-4 h-4 text-purple-400" />
                <span>Simultaneous Playoff Series ({readyMatches.length})</span>
              </h3>
              <span className="text-xs text-purple-200/60 font-bold">
                Click any series to expand with Spotlight Camera
              </span>
            </div>

            {readyMatches.length === 0 ? (
              <div className="p-8 text-center bg-[#130712] rounded-2xl border border-purple-500/20 text-purple-200/60 font-bold">
                No uncompleted playoff matches found for this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveSeriesStates.map((st) => {
                  const {
                    series,
                    winsA,
                    winsB,
                    activeGameNumber,
                    activeGameMinute,
                    liveGameScoreA,
                    liveGameScoreB,
                    isSeriesOver,
                  } = st;
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
                      {/* Header row: Round name, Best of, Status */}
                      <div className="flex items-center justify-between text-xs font-bold pb-2 border-b border-purple-500/20 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-purple-500/40 text-purple-300 font-black">
                            {series.match.roundCode.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-[11px] text-purple-200/60">
                            Best of {series.targetWins * 2 - 1}
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
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-black truncate text-purple-100">
                                {series.idolA.name}
                              </span>
                              <RatingBadge idol={series.idolA} size="xs" showTier={false} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-purple-200/60 font-bold truncate">
                                {series.idolA.girlGroup || 'Solo'}
                              </span>
                              <FormBadge formHistory={idolFormMap.get(series.idolA.id) || []} size="xs" />
                            </div>
                          </div>
                        </div>

                        {/* Series Score (Wins Counter) */}
                        <div className="flex flex-col items-center justify-center px-4 py-2 bg-black/80 border border-purple-500/40 rounded-2xl shrink-0">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-2xl font-mono font-black ${
                                winsA > winsB ? 'text-amber-400' : 'text-purple-100'
                              }`}
                            >
                              {winsA}
                            </span>
                            <span className="text-xs text-purple-400/50 font-black">-</span>
                            <span
                              className={`text-2xl font-mono font-black ${
                                winsB > winsA ? 'text-amber-400' : 'text-purple-100'
                              }`}
                            >
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
                            <div className="flex items-center justify-end gap-1.5">
                              <RatingBadge idol={series.idolB} size="xs" showTier={false} />
                              <span className="text-sm font-black truncate text-purple-100">
                                {series.idolB.name}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              <FormBadge formHistory={idolFormMap.get(series.idolB.id) || []} size="xs" />
                              <span className="text-[11px] text-purple-200/60 font-bold truncate">
                                {series.idolB.girlGroup || 'Solo'}
                              </span>
                            </div>
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
                            <span>
                              {series.idolA.name.split(' ')[0]} {liveGameScoreA}
                            </span>
                            <span className="text-purple-400/40">:</span>
                            <span>
                              {liveGameScoreB} {series.idolB.name.split(' ')[0]}
                            </span>
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
                            {winsA > winsB ? series.idolA.name : series.idolB.name} wins series ({Math.max(winsA, winsB)} - {Math.min(winsA, winsB)})
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
