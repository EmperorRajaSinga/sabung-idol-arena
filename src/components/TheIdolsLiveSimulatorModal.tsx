import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TheIdolsMatch, Idol, TheIdolsStanding } from '../types';
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
import { calculateTheIdolsStandings } from '../utils/theIdolsLogic';
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
} from 'lucide-react';

export interface TheIdolsLiveSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchday: number;
  matches: TheIdolsMatch[];
  idolsMap: Map<string, Idol>;
  standings?: TheIdolsStanding[];
  onCommitResults: (updatedMatches: TheIdolsMatch[]) => void;
}

export const TheIdolsLiveSimulatorModal: React.FC<TheIdolsLiveSimulatorModalProps> = ({
  isOpen,
  onClose,
  matchday,
  matches,
  idolsMap,
  standings = [],
  onCommitResults,
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

  const [matchSims, setMatchSims] = useState<PreGeneratedMatchSimulation[]>([]);

  // Simulation generation helper
  const generateSimulations = useCallback(
    (fixtures: TheIdolsMatch[]) => {
      return fixtures.map((match) => {
        const idolA = resolvedMap.get(match.idolAId) || ({
          id: match.idolAId,
          name: 'Idol A',
          girlGroup: 'Solo',
          nationality: 'South Korea',
          seed: 'Seed 1',
        } as Idol);
        const idolB = resolvedMap.get(match.idolBId) || ({
          id: match.idolBId,
          name: 'Idol B',
          girlGroup: 'Solo',
          nationality: 'South Korea',
          seed: 'Seed 2',
        } as Idol);

        const formA = idolFormMap.get(match.idolAId) || [];
        const formB = idolFormMap.get(match.idolBId) || [];

        return generateBo4MatchSimulation(match.id, idolA, idolB, formA, formB);
      });
    },
    [resolvedMap, idolFormMap]
  );

  // Playback Control States
  const [currentMinute, setCurrentMinute] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [focusedMatchId, setFocusedMatchId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'simulcast' | 'radar' | 'table'>('simulcast');
  const [goalAlert, setGoalAlert] = useState<{
    matchId: string;
    scorerName: string;
    scorerGroup: string;
    scorerPhoto?: string;
    minute: number;
    team: 'A' | 'B';
    currentScoreA: number;
    currentScoreB: number;
  } | null>(null);

  const prevMinuteRef = useRef<number>(0);
  const playTimerRef = useRef<any>(null);

  // Initialize simulations when modal opens
  useEffect(() => {
    if (!isOpen || matches.length === 0) {
      setIsPlaying(false);
      setCurrentMinute(0);
      setGoalAlert(null);
      return;
    }

    const sims = generateSimulations(matches);
    setMatchSims(sims);
    if (sims.length > 0) {
      setFocusedMatchId(sims[0].matchId);
    }
    setCurrentMinute(0);
    prevMinuteRef.current = 0;
    setIsPlaying(true);
  }, [isOpen, matches, generateSimulations]);

  // Master Clock Timer (90 minutes simulation)
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      return;
    }

    const tickIntervalMs = Math.max(25, 450 / playbackSpeed);

    playTimerRef.current = setInterval(() => {
      setCurrentMinute((prev) => {
        if (prev >= 90) {
          setIsPlaying(false);
          return 90;
        }
        return prev + 1;
      });
    }, tickIntervalMs);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Audio synthesizer trigger
  useEffect(() => {
    if (currentMinute === 0) return;
    if (currentMinute === prevMinuteRef.current) return;

    const minFrom = prevMinuteRef.current + 1;
    const minTo = currentMinute;
    prevMinuteRef.current = currentMinute;

    matchSims.forEach((sim) => {
      const eventsInWindow = sim.allEvents.filter(
        (ev) => ev.minute >= minFrom && ev.minute <= minTo
      );

      eventsInWindow.forEach((ev) => {
        if (ev.type === 'goal') {
          const frame = sim?.frames && sim.frames.length > 0 ? sim.frames[Math.min(ev.minute, sim.frames.length - 1)] : undefined;
          const scorer = ev.team === 'A' ? sim.idolA : sim.idolB;

          setGoalAlert({
            matchId: sim.matchId,
            scorerName: scorer.name,
            scorerGroup: scorer.girlGroup || 'Superleague',
            scorerPhoto: scorer.photoUrl,
            minute: ev.minute,
            team: ev.team === 'A' ? 'A' : 'B',
            currentScoreA: frame ? frame.scoreA : 0,
            currentScoreB: frame ? frame.scoreB : 0,
          });

          setTimeout(() => {
            setGoalAlert((prev) => (prev?.matchId === sim.matchId ? null : prev));
          }, 3500);
        }
      });
    });
  }, [currentMinute, matchSims]);

  // Focused Match Simulation & Live Frame
  const currentFocusedSim = useMemo(() => {
    return matchSims.find((s) => s.matchId === focusedMatchId) || matchSims[0];
  }, [matchSims, focusedMatchId]);

  const focusedLiveFrame = useMemo<MinuteTimelineFrame | undefined>(() => {
    if (!currentFocusedSim || !currentFocusedSim.frames || currentFocusedSim.frames.length === 0) return undefined;
    const idx = Math.min(currentMinute, currentFocusedSim.frames.length - 1);
    return currentFocusedSim.frames[idx];
  }, [currentFocusedSim, currentMinute]);

  // Live Live Standings Projection
  const liveProjectedStandings = useMemo(() => {
    if (matches.length === 0) return standings;

    const projectedMatches: TheIdolsMatch[] = matches.map((m) => {
      const sim = matchSims.find((s) => s.matchId === m.id);
      if (!sim) return m;

      const frame = sim.frames && sim.frames.length > 0 ? sim.frames[Math.min(currentMinute, sim.frames.length - 1)] : undefined;
      const sA = frame ? frame.scoreA : 0;
      const sB = frame ? frame.scoreB : 0;
      const winnerId = sA > sB ? m.idolAId : sB > sA ? m.idolBId : null;

      return {
        ...m,
        scoreA: sA,
        scoreB: sB,
        winnerId,
        completed: currentMinute >= 90,
      };
    });

    const idolList = Array.from(resolvedMap.values()) as Idol[];
    const memberIds = standings.length > 0 ? standings.map((s) => s.idolId) : Array.from(resolvedMap.keys()).slice(0, 20);
    return calculateTheIdolsStandings(memberIds, projectedMatches, idolList);
  }, [matches, matchSims, currentMinute, standings, resolvedMap]);

  // Instant Jump to Final Whistle
  const handleJumpToFullTime = () => {
    setCurrentMinute(90);
    setIsPlaying(false);
  };

  // Reset Simulcast
  const handleRestart = () => {
    const freshSims = generateSimulations(matches);
    setMatchSims(freshSims);
    setCurrentMinute(0);
    prevMinuteRef.current = 0;
    setGoalAlert(null);
    setIsPlaying(true);
  };

  // Commit and Save Results
  const handleCommitResults = () => {
    const finalizedMatches: TheIdolsMatch[] = matches.map((m) => {
      const sim = matchSims.find((s) => s.matchId === m.id);
      const finalFrame = sim?.frames && sim.frames.length > 0 ? sim.frames[sim.frames.length - 1] : undefined;
      const sA = finalFrame ? finalFrame.scoreA : (sim?.finalScoreA ?? 0);
      const sB = finalFrame ? finalFrame.scoreB : (sim?.finalScoreB ?? 0);
      const winnerId = sA > sB ? m.idolAId : sB > sA ? m.idolBId : null;

      return {
        ...m,
        scoreA: sA,
        scoreB: sB,
        winnerId,
        completed: true,
        updatedAt: new Date().toISOString(),
      };
    });

    onCommitResults(finalizedMatches);
    onClose();
  };

  if (!isOpen) return null;

  const isFullTime = currentMinute >= 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl rounded-3xl border-3 border-black bg-[#160f0b] text-amber-50 poster-shadow-lg flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-black bg-gradient-to-r from-[#26150b] via-[#1c1008] to-[#26150b]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-black bg-gradient-to-br from-amber-500 to-yellow-600 text-amber-950 poster-shadow-sm font-black">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  The Idols Superleague Live Simulcast
                </span>
                <span className="text-xs font-mono font-bold text-amber-200/70">
                  Matchday {matchday} of 19
                </span>
              </div>
              <h2 className="text-lg font-poster-title text-amber-300 flex items-center gap-2">
                Live Broadcast Arena ({matches.length} Matches In Play)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-black bg-[#281a12] text-amber-200 hover:bg-rose-900/60 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Goal Flash Banner */}
        {goalAlert && (
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-amber-950 px-4 py-2 border-b-2 border-black font-black flex items-center justify-between animate-bounce">
            <div className="flex items-center gap-3">
              <span className="text-lg">⚽</span>
              <span className="text-xs uppercase tracking-widest font-black bg-black text-amber-300 px-2 py-0.5 rounded-md">
                GOAL! {goalAlert.minute}&apos;
              </span>
              <span className="text-sm font-poster-title">
                {goalAlert.scorerName} ({goalAlert.scorerGroup}) strikes!
              </span>
            </div>
            <div className="text-sm font-mono font-black bg-black/10 px-3 py-0.5 rounded-lg">
              Score: {goalAlert.currentScoreA} - {goalAlert.currentScoreB}
            </div>
          </div>
        )}

        {/* Playback Control Strip */}
        <div className="px-5 py-3 bg-[#1e130c] border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
          {/* Minute & Timeline Slider */}
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="flex items-center gap-2 bg-[#120a06] px-3.5 py-1.5 rounded-2xl border-2 border-black">
              <Activity className="h-4 w-4 text-red-500 animate-pulse" />
              <span className="font-mono text-sm font-black text-amber-300">
                {isFullTime ? 'FT 90\'' : `${currentMinute}'`}
              </span>
            </div>

            <div className="flex-1 relative flex items-center">
              <input
                type="range"
                min="0"
                max="90"
                value={currentMinute}
                onChange={(e) => {
                  setCurrentMinute(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full h-2.5 bg-[#120a06] rounded-lg appearance-none cursor-pointer accent-amber-400 border border-black"
              />
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={isFullTime}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl border-2 border-black text-xs font-black transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                  : 'bg-[#2b1c13] text-amber-300 hover:bg-[#382519]'
              } ${isFullTime ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Simulate'}</span>
            </button>

            {/* Speed Pills */}
            <div className="flex items-center bg-[#120a06] p-1 rounded-2xl border-2 border-black">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-black transition-colors ${
                    playbackSpeed === s ? 'bg-amber-500 text-amber-950' : 'text-amber-200/60 hover:text-amber-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={handleJumpToFullTime}
              className="flex items-center gap-1 px-3 py-2 rounded-2xl border-2 border-black bg-[#2b1c13] text-amber-300 text-xs font-bold hover:bg-[#382519]"
              title="Skip to Full Time (90')"
            >
              <FastForward className="h-4 w-4" />
              <span className="hidden sm:inline">Full Time</span>
            </button>

            <button
              onClick={handleRestart}
              className="flex items-center gap-1 px-3 py-2 rounded-2xl border-2 border-black bg-[#2b1c13] text-amber-200/70 text-xs font-bold hover:text-white"
              title="Restart Simulation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub Navigation: Simulcast / Live Pitch Radar / Standings Table */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#170e09] border-b-2 border-black">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('simulcast')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'simulcast'
                  ? 'bg-amber-500 text-amber-950 font-black shadow'
                  : 'text-amber-200/60 hover:text-amber-200'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Simulcast Multi-Match</span>
            </button>

            <button
              onClick={() => setActiveTab('radar')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'radar'
                  ? 'bg-amber-500 text-amber-950 font-black shadow'
                  : 'text-amber-200/60 hover:text-amber-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Pitch Radar</span>
            </button>

            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'table'
                  ? 'bg-amber-500 text-amber-950 font-black shadow'
                  : 'text-amber-200/60 hover:text-amber-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Live Standings Table</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-amber-200/60 hidden md:block">
            Simultaneous 10-Fixture Superleague Telemetry
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar bg-[#120a06]">
          {/* TAB 1: MULTI-MATCH SIMULCAST TILES */}
          {activeTab === 'simulcast' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {matchSims.map((sim) => {
                const isFocused = sim.matchId === focusedMatchId;
                const frameIdx = Math.min(currentMinute, (sim?.frames?.length || 1) - 1);
                const frame = sim?.frames && sim.frames.length > 0 ? sim.frames[frameIdx] : undefined;
                const scoreA = frame ? frame.scoreA : 0;
                const scoreB = frame ? frame.scoreB : 0;
                const isLeadingA = scoreA > scoreB;
                const isLeadingB = scoreB > scoreA;

                const eventsUpToNow = sim.allEvents.filter((ev) => ev.minute <= currentMinute);
                const latestEvent = eventsUpToNow[eventsUpToNow.length - 1];

                return (
                  <div
                    key={sim.matchId}
                    onClick={() => setFocusedMatchId(sim.matchId)}
                    className={`rounded-2xl border-2 transition-all cursor-pointer p-3.5 poster-shadow-sm flex flex-col justify-between gap-3 ${
                      isFocused
                        ? 'border-amber-400 bg-[#22150c] ring-2 ring-amber-400/30'
                        : 'border-black bg-[#1a100a] hover:border-amber-500/40'
                    }`}
                  >
                    {/* Top Row: Fixture Status & Focus Button */}
                    <div className="flex items-center justify-between text-[10px] text-amber-200/60 font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Match {sim.matchId}</span>
                      </span>

                      <div className="flex items-center gap-2">
                        {latestEvent && latestEvent.minute >= currentMinute - 3 && (
                          <span className="text-amber-400 font-mono font-black text-[9px] animate-pulse">
                            🔥 {latestEvent.type.toUpperCase()} ({latestEvent.minute}&apos;)
                          </span>
                        )}
                        <span className="font-mono text-amber-300">
                          {isFullTime ? 'FT' : `${currentMinute}'`}
                        </span>
                      </div>
                    </div>

                    {/* Competitors and Live Score */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Competitor A */}
                      <div className="flex items-center gap-2.5 w-[42%] min-w-0">
                        <img
                          src={sim.idolA.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80'}
                          alt={sim.idolA.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80';
                          }}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover border-2 border-black flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`text-xs font-black truncate ${isLeadingA ? 'text-amber-300 font-black' : 'text-amber-100'}`}>
                              {sim.idolA.name}
                            </span>
                            <span className="text-[10px]">{getCountryFlag(sim.idolA.nationality)}</span>
                          </div>
                          <span className="text-[10px] text-amber-200/50 font-bold block truncate">
                            {sim.idolA.girlGroup || 'Superleague'}
                          </span>
                        </div>
                      </div>

                      {/* Score Box */}
                      <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#120a06] border-2 border-black flex-shrink-0">
                        <span className={`font-mono text-lg font-black ${isLeadingA ? 'text-amber-400 font-black' : 'text-amber-200'}`}>
                          {scoreA}
                        </span>
                        <span className="text-xs text-amber-200/40 font-bold">:</span>
                        <span className={`font-mono text-lg font-black ${isLeadingB ? 'text-amber-400 font-black' : 'text-amber-200'}`}>
                          {scoreB}
                        </span>
                      </div>

                      {/* Competitor B */}
                      <div className="flex items-center justify-end gap-2.5 w-[42%] min-w-0 text-right">
                        <div className="min-w-0">
                          <div className="flex items-center justify-end gap-1">
                            <span className={`text-xs font-black truncate ${isLeadingB ? 'text-amber-300 font-black' : 'text-amber-100'}`}>
                              {sim.idolB.name}
                            </span>
                            <span className="text-[10px]">{getCountryFlag(sim.idolB.nationality)}</span>
                          </div>
                          <span className="text-[10px] text-amber-200/50 font-bold block truncate">
                            {sim.idolB.girlGroup || 'Superleague'}
                          </span>
                        </div>
                        <img
                          src={sim.idolB.photoUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80'}
                          alt={sim.idolB.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&auto=format&fit=crop&q=80';
                          }}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover border-2 border-black flex-shrink-0"
                        />
                      </div>
                    </div>

                    {/* Possession / Momentum Bar */}
                    {frame && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-mono text-amber-200/50">
                          <span>Poss: {frame.stats?.possessionPctA ?? 50}%</span>
                          <span>Poss: {frame.stats?.possessionPctB ?? 50}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#120a06] rounded-full overflow-hidden flex border border-black/60">
                          <div
                            style={{ width: `${frame.stats?.possessionPctA ?? 50}%` }}
                            className="bg-amber-500 h-full transition-all duration-300"
                          />
                          <div
                            style={{ width: `${frame.stats?.possessionPctB ?? 50}%` }}
                            className="bg-purple-500 h-full transition-all duration-300"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: LIVE PITCH RADAR */}
          {activeTab === 'radar' && currentFocusedSim && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#1a100a] p-3 rounded-2xl border-2 border-black">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-amber-200/70">Focused Fixture:</span>
                  <select
                    value={focusedMatchId}
                    onChange={(e) => setFocusedMatchId(e.target.value)}
                    className="bg-[#120a06] text-amber-300 text-xs font-black border-2 border-black rounded-xl px-3 py-1.5"
                  >
                    {matchSims.map((sim) => {
                      const f = sim?.frames && sim.frames.length > 0 ? sim.frames[Math.min(currentMinute, sim.frames.length - 1)] : undefined;
                      return (
                        <option key={sim.matchId} value={sim.matchId}>
                          {sim.idolA.name} vs {sim.idolB.name} ({f?.scoreA ?? 0} - {f?.scoreB ?? 0})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="text-xs font-mono font-black text-amber-400">
                  Minute {currentMinute}&apos; / 90&apos;
                </div>
              </div>

              {/* Pitch Visualizer Component */}
              <div className="rounded-3xl border-3 border-black bg-[#1a100a] p-4 poster-shadow-md">
                <LiveMatchVisualizer
                  idolA={currentFocusedSim.idolA}
                  idolB={currentFocusedSim.idolB}
                  formHistoryA={currentFocusedSim.formA.formArray}
                  formHistoryB={currentFocusedSim.formB.formArray}
                  matchTitle={`The Idols Matchday ${matchday}: ${currentFocusedSim.idolA.name} vs ${currentFocusedSim.idolB.name}`}
                  stageName="The Idols Superleague"
                  autoStart={false}
                />
              </div>
            </div>
          )}

          {/* TAB 3: LIVE STANDINGS TABLE */}
          {activeTab === 'table' && (
            <div className="rounded-3xl border-3 border-black bg-[#1a100a] overflow-hidden poster-shadow-md">
              <div className="p-3 bg-[#24150d] border-b-2 border-black flex items-center justify-between">
                <span className="text-xs font-poster-title text-amber-300">
                  Live Projecting Standings (Minute {currentMinute}&apos;)
                </span>
                <span className="text-[10px] text-amber-200/60 font-bold">
                  Top 10 Qualify for Masters Playoff
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead>
                    <tr className="bg-[#1c1109] border-b-2 border-black text-amber-300 font-black uppercase text-[10px]">
                      <th className="py-2.5 px-3 text-center">#</th>
                      <th className="py-2.5 px-3">Idol</th>
                      <th className="py-2.5 px-2 text-center">P</th>
                      <th className="py-2.5 px-2 text-center">W</th>
                      <th className="py-2.5 px-2 text-center">D</th>
                      <th className="py-2.5 px-2 text-center">L</th>
                      <th className="py-2.5 px-2 text-center">GD</th>
                      <th className="py-2.5 px-3 text-center text-amber-400">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/60">
                    {liveProjectedStandings.map((st) => {
                      const isTop2 = st.rank <= 2;
                      const isTop4 = st.rank >= 3 && st.rank <= 4;
                      const isTop8 = st.rank >= 5 && st.rank <= 8;
                      const isTop10 = st.rank >= 9 && st.rank <= 10;

                      return (
                        <tr
                          key={st.idolId}
                          className={`hover:bg-[#26160d] transition-colors ${
                            isTop2
                              ? 'bg-amber-950/20'
                              : isTop4
                              ? 'bg-purple-950/20'
                              : isTop8
                              ? 'bg-emerald-950/20'
                              : isTop10
                              ? 'bg-[#22160d]'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center font-mono font-black">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] border ${
                                isTop2
                                  ? 'bg-amber-500 text-amber-950 border-amber-400 font-black'
                                  : isTop4
                                  ? 'bg-purple-600 text-purple-100 border-purple-400'
                                  : isTop8
                                  ? 'bg-emerald-600 text-emerald-100 border-emerald-400'
                                  : isTop10
                                  ? 'bg-[#2d1e14] text-amber-200 border-black'
                                  : 'bg-black/40 text-slate-400 border-black'
                              }`}
                            >
                              {st.rank}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <img
                                src={st.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                                alt={st.idolName}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                                }}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-md object-cover border border-black"
                              />
                              <span className="font-black text-amber-100 truncate">{st.idolName}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-amber-200/70">{st.played}</td>
                          <td className="py-2 px-2 text-center font-mono text-emerald-400">{st.wins}</td>
                          <td className="py-2 px-2 text-center font-mono text-amber-200/60">{st.draws}</td>
                          <td className="py-2 px-2 text-center font-mono text-rose-400">{st.losses}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-amber-300">
                            {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-black text-sm text-amber-400">
                            {st.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t-2 border-black bg-[#1a100a]">
          <div className="text-xs font-bold text-amber-200/70">
            {isFullTime ? '✅ All 10 matches concluded' : `Simulation active • Minute ${currentMinute}'`}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-2xl border-2 border-black bg-[#281b12] text-amber-200 text-xs font-bold hover:bg-[#342318] transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleCommitResults}
              disabled={!isFullTime}
              className={`flex items-center gap-2 px-5 py-2 rounded-2xl border-2 border-black text-xs font-black transition-all poster-shadow-sm ${
                isFullTime
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 hover:brightness-110'
                  : 'bg-black/40 text-amber-200/40 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Matchday Results</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
