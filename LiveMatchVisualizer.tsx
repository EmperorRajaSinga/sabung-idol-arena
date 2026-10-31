import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Idol } from '../types';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { getCountryFlag } from '../utils/nationalityHelper';
import {
  generateMatchSimulation,
  PreGeneratedMatchSimulation,
  MinuteTimelineFrame,
  MatchLiveEvent,
} from '../utils/liveMatchSimulator';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Flame,
  Zap,
  Shield,
  Activity,
  CheckCircle2,
  Trophy,
  Swords,
  Gauge,
  Sparkles,
  ChevronRight,
  Maximize2,
} from 'lucide-react';

export interface LiveMatchVisualizerProps {
  idolA: Idol;
  idolB: Idol;
  formHistoryA?: Array<'W' | 'D' | 'L'>;
  formHistoryB?: Array<'W' | 'D' | 'L'>;
  matchTitle?: string;
  stageName?: string;
  stageLabel?: string; // alias
  isKnockout?: boolean;
  onFinishMatch?: (scoreA: number, scoreB: number, winnerId: string | null) => void;
  onMatchComplete?: (scoreA: number, scoreB: number, winnerId: string | null) => void; // alias
  onClose?: () => void;
  autoStart?: boolean;
}

export const LiveMatchVisualizer: React.FC<LiveMatchVisualizerProps> = ({
  idolA,
  idolB,
  formHistoryA = [],
  formHistoryB = [],
  matchTitle = 'Matchday Clash',
  stageName,
  stageLabel,
  isKnockout = false,
  onFinishMatch,
  onMatchComplete,
  onClose,
  autoStart = true,
}) => {
  const displayStage = stageName || stageLabel || 'Idol League Arena';
  const matchId = useMemo(() => `match_${idolA.id}_${idolB.id}_${Date.now()}`, [idolA.id, idolB.id]);

  // Pre-generate the 90-minute narrative
  const sim: PreGeneratedMatchSimulation = useMemo(() => {
    return generateMatchSimulation(matchId, idolA, idolB, formHistoryA, formHistoryB);
  }, [matchId, idolA, idolB, formHistoryA, formHistoryB]);

  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoStart);
  const [simSpeed, setSimSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [goalFlashTeam, setGoalFlashTeam] = useState<'A' | 'B' | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const commentaryEndRef = useRef<HTMLDivElement | null>(null);

  const totalFrames = sim.frames.length;
  const currentFrame: MinuteTimelineFrame = sim.frames[Math.min(currentFrameIdx, totalFrames - 1)] || sim.frames[0];
  const isFinished = currentFrameIdx >= totalFrames - 1;

  // Flash trigger on goal events
  useEffect(() => {
    if (!currentFrame || !currentFrame.event) return;
    const ev = currentFrame.event;

    if (ev.type === 'goal') {
      setGoalFlashTeam(ev.team as 'A' | 'B');
      setTimeout(() => setGoalFlashTeam(null), 1200);
    }
  }, [currentFrameIdx, currentFrame]);

  // Simulation tick loop
  useEffect(() => {
    if (!isPlaying || isFinished) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Determine interval in ms based on speed
    // 1x = 700ms per minute, 2x = 350ms, 5x = 140ms, 10x = 60ms
    const intervalMs = Math.max(40, Math.round(700 / simSpeed));

    timerRef.current = setInterval(() => {
      setCurrentFrameIdx((prev) => {
        if (prev >= totalFrames - 1) {
          setIsPlaying(false);
          return totalFrames - 1;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isFinished, simSpeed, totalFrames]);

  // Auto-scroll commentary feed to latest
  useEffect(() => {
    if (commentaryEndRef.current) {
      commentaryEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentFrameIdx]);

  // Filter events up to current minute
  const eventsSoFar = useMemo(() => {
    return sim.allEvents.filter((e) => e.minute <= currentFrame.minute);
  }, [sim.allEvents, currentFrame.minute]);

  // Jump to specific frame
  const handleJumpToFrame = (idx: number) => {
    setCurrentFrameIdx(Math.max(0, Math.min(totalFrames - 1, idx)));
  };

  const handleInstantSkip = () => {
    setCurrentFrameIdx(totalFrames - 1);
    setIsPlaying(false);
  };

  const handleReset = () => {
    setCurrentFrameIdx(0);
    setIsPlaying(false);
  };

  const handleApplyResult = () => {
    const scA = isFinished ? sim.finalScoreA : currentFrame.scoreA;
    const scB = isFinished ? sim.finalScoreB : currentFrame.scoreB;
    let winId: string | null = null;
    if (scA > scB) winId = idolA.id;
    else if (scB > scA) winId = idolB.id;
    else winId = isKnockout ? (sim.finalScoreA > sim.finalScoreB ? idolA.id : idolB.id) : null;

    if (onFinishMatch) {
      onFinishMatch(scA, scB, winId);
    }
    if (onMatchComplete) {
      onMatchComplete(scA, scB, winId);
    }
    if (onClose) onClose();
  };

  // Momentum bar math (-100 to +100 => 0% to 100% split)
  const momentumNormalized = Math.max(5, Math.min(95, Math.round((currentFrame.momentum + 100) / 2)));

  return (
    <div className="rounded-3xl border-3 border-black bg-gradient-to-b from-[#1c120a] via-[#150d07] to-[#0d0804] text-white p-4 sm:p-6 poster-shadow-lg max-w-4xl mx-auto space-y-5 select-none relative overflow-hidden">
      {/* Background Arena Ambient Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          goalFlashTeam === 'A'
            ? 'bg-amber-500/20'
            : goalFlashTeam === 'B'
            ? 'bg-emerald-500/20'
            : 'opacity-0'
        }`}
      />

      {/* 1. Header Bar: Stage & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-poster-title text-sm sm:text-base text-amber-400 font-bold uppercase tracking-wide">
                {matchTitle}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-black/60 border border-amber-500/30 text-[10px] font-mono text-amber-300 font-bold">
                {displayStage}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Live Minute-by-Minute Telemetry &bull; Form &amp; Momentum Simulation
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-black text-slate-400 hover:text-white font-poster-title text-xs font-bold transition-all"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Center-Stage Scoreboard */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#24170d] via-[#1a1109] to-[#24170d] p-4 sm:p-6 poster-shadow relative overflow-hidden">
        {/* Live Clock Badge */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-black/80 border-2 border-black poster-shadow-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isFinished
                  ? 'bg-emerald-500'
                  : isPlaying
                  ? 'bg-rose-500 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-sm sm:text-base font-black text-amber-300 tracking-wider">
              {currentFrame.minute}&apos;
              {currentFrame.minute > 45 && currentFrame.minute <= 45 + sim.stoppageTime1
                ? `+${currentFrame.minute - 45}`
                : currentFrame.minute > 90
                ? `+${currentFrame.minute - 90}`
                : ''}
            </span>
            <span className="text-[10px] font-poster-title uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
              {currentFrame.phase === 'first_half'
                ? '1st Half'
                : currentFrame.phase === 'stoppage_1'
                ? '1st Half ET'
                : currentFrame.phase === 'half_time'
                ? 'Halftime'
                : currentFrame.phase === 'second_half'
                ? '2nd Half'
                : currentFrame.phase === 'stoppage_2'
                ? '2nd Half ET'
                : 'Full Time'}
            </span>
          </div>
        </div>

        {/* Competitor Cards & Massive Score Display */}
        <div className="grid grid-cols-12 gap-3 items-center">
          {/* Competitor A */}
          <div className="col-span-5 flex items-center gap-3 justify-end text-right">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 justify-end flex-wrap">
                {idolA.nationality && (
                  <span className="text-xs">{getCountryFlag(idolA.nationality)}</span>
                )}
                <span className="font-poster-title text-sm sm:text-lg font-black text-white truncate">
                  {idolA.name}
                </span>
                <RatingBadge rating={sim.effectiveRatingA} size="xs" showTier={true} />
              </div>
              <div className="text-[11px] font-bold text-amber-400/80 truncate">
                {idolA.girlGroup} &bull; {idolA.seed}
              </div>
              <div className="mt-1 flex justify-end">
                <FormBadge formDetails={sim.formA} size="xs" showLabel={true} showModifier={true} />
              </div>
            </div>

            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 overflow-hidden shrink-0 bg-black poster-shadow relative transition-all ${
                goalFlashTeam === 'A'
                  ? 'ring-4 ring-amber-400 scale-105 border-amber-300'
                  : 'border-black'
              }`}
            >
              {idolA.photoUrl ? (
                <img
                  src={idolA.photoUrl}
                  alt={idolA.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-poster-title text-base text-amber-300">
                  {idolA.name.slice(0, 2)}
                </div>
              )}
            </div>
          </div>

          {/* Big Score Box */}
          <div className="col-span-2 flex items-center justify-center">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-2xl bg-black/90 border-3 border-black poster-shadow">
              <span
                className={`font-mono text-2xl sm:text-4xl font-black transition-all ${
                  goalFlashTeam === 'A'
                    ? 'text-amber-400 scale-125 animate-bounce'
                    : 'text-amber-300'
                }`}
              >
                {currentFrame.scoreA}
              </span>
              <span className="font-mono text-slate-500 font-bold text-lg sm:text-2xl">-</span>
              <span
                className={`font-mono text-2xl sm:text-4xl font-black transition-all ${
                  goalFlashTeam === 'B'
                    ? 'text-emerald-400 scale-125 animate-bounce'
                    : 'text-amber-300'
                }`}
              >
                {currentFrame.scoreB}
              </span>
            </div>
          </div>

          {/* Competitor B */}
          <div className="col-span-5 flex items-center gap-3 justify-start text-left">
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 overflow-hidden shrink-0 bg-black poster-shadow relative transition-all ${
                goalFlashTeam === 'B'
                  ? 'ring-4 ring-emerald-400 scale-105 border-emerald-300'
                  : 'border-black'
              }`}
            >
              {idolB.photoUrl ? (
                <img
                  src={idolB.photoUrl}
                  alt={idolB.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-poster-title text-base text-amber-300">
                  {idolB.name.slice(0, 2)}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 justify-start flex-wrap">
                <span className="font-poster-title text-sm sm:text-lg font-black text-white truncate">
                  {idolB.name}
                </span>
                <RatingBadge rating={sim.effectiveRatingB} size="xs" showTier={true} />
                {idolB.nationality && (
                  <span className="text-xs">{getCountryFlag(idolB.nationality)}</span>
                )}
              </div>
              <div className="text-[11px] font-bold text-amber-400/80 truncate">
                {idolB.girlGroup} &bull; {idolB.seed}
              </div>
              <div className="mt-1 flex justify-start">
                <FormBadge formDetails={sim.formB} size="xs" showLabel={true} showModifier={true} />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Stage Possession & Dynamic Momentum Tug-of-War Bar */}
        <div className="mt-5 pt-4 border-t border-black/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-bold">
            <span className="text-amber-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              {idolA.name} ({currentFrame.stats.possessionPctA}%)
            </span>

            <span className="text-slate-400 text-[10px] uppercase font-poster-title flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-amber-400" />
              Live Stage Momentum
              {currentFrame.momentum > 25 ? (
                <span className="text-amber-400 font-bold">&bull; {idolA.name} Pressure</span>
              ) : currentFrame.momentum < -25 ? (
                <span className="text-emerald-400 font-bold">&bull; {idolB.name} Pressure</span>
              ) : (
                <span className="text-slate-500 font-bold">&bull; Balanced</span>
              )}
            </span>

            <span className="text-emerald-400 flex items-center gap-1 justify-end">
              {idolB.name} ({currentFrame.stats.possessionPctB}%)
              <Zap className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Dual Tug of War Momentum Bar */}
          <div className="w-full h-3 rounded-full bg-black/90 border-2 border-black overflow-hidden flex relative shadow-inner">
            {/* Center marker */}
            <div className="absolute left-1/2 -top-1 bottom-1 w-0.5 bg-white/40 z-10" />

            <div
              className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-300"
              style={{ width: `${momentumNormalized}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-600 transition-all duration-300"
              style={{ width: `${100 - momentumNormalized}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Interactive Horizontal Event Timeline */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
          <span>0&apos;</span>
          <span className="text-amber-300 font-poster-title uppercase tracking-wider">
            Match Highlights Timeline (Click to Scrub)
          </span>
          <span>90&apos;+</span>
        </div>

        <div className="relative w-full h-6 rounded-xl bg-black/80 border-2 border-black flex items-center px-2 cursor-pointer">
          {/* Progress fill */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-amber-500/20 rounded-lg pointer-events-none transition-all"
            style={{ width: `${(currentFrameIdx / (totalFrames - 1)) * 100}%` }}
          />

          {/* Markers for key events */}
          {sim.allEvents.map((ev) => {
            const leftPct = (ev.minute / 90) * 100;
            const isPassed = ev.minute <= currentFrame.minute;
            return (
              <button
                key={ev.id}
                onClick={() => handleJumpToFrame(ev.minute)}
                className={`absolute -translate-x-1/2 p-0.5 rounded-full border transition-all z-20 hover:scale-125 ${
                  ev.type === 'goal'
                    ? ev.team === 'A'
                      ? 'bg-amber-500 border-amber-300 text-black shadow-lg shadow-amber-500/50'
                      : 'bg-emerald-500 border-emerald-300 text-black shadow-lg shadow-emerald-500/50'
                    : ev.type === 'save'
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : ev.type === 'signature_move'
                    ? 'bg-purple-600 border-purple-400 text-white'
                    : 'bg-slate-700 border-slate-500 text-slate-300'
                } ${isPassed ? 'opacity-100 scale-110' : 'opacity-40 scale-90'}`}
                style={{ left: `${Math.min(96, Math.max(4, leftPct))}%` }}
                title={`${ev.minute}' - ${ev.title}`}
              >
                <span className="text-[9px] block leading-none">
                  {ev.type === 'goal' ? '⚽' : ev.type === 'save' ? '🧤' : ev.type === 'signature_move' ? '🔥' : '⚡'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Live Commentary Feed & Telemetry Box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Left 7 Cols: Minute-by-Minute Live Commentary */}
        <div className="md:col-span-7 rounded-2xl border-2 border-black bg-[#16100a] p-4 poster-shadow space-y-3">
          <div className="flex items-center justify-between border-b border-black pb-2">
            <span className="font-poster-title text-xs text-amber-400 font-bold uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Live Highlight Commentary
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-bold">
              {eventsSoFar.length} Highlights Logged
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
            {eventsSoFar.map((ev) => (
              <div
                key={ev.id}
                className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                  ev.type === 'goal'
                    ? ev.team === 'A'
                      ? 'bg-amber-950/40 border-amber-400/80 text-amber-100'
                      : 'bg-emerald-950/40 border-emerald-400/80 text-emerald-100'
                    : ev.type === 'save'
                    ? 'bg-blue-950/30 border-blue-500/50 text-blue-100'
                    : ev.type === 'signature_move'
                    ? 'bg-purple-950/30 border-purple-500/50 text-purple-100'
                    : 'bg-black/50 border-black text-slate-300'
                }`}
              >
                <span className="font-mono font-black text-amber-400 shrink-0 bg-black/60 px-1.5 py-0.5 rounded border border-black text-[10px]">
                  {ev.minute}&apos;
                </span>

                <div className="min-w-0 flex-1">
                  <div className="font-poster-title text-[11px] font-black text-white flex items-center gap-1.5 mb-0.5">
                    <span>{ev.title}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-200">{ev.description}</p>
                </div>
              </div>
            ))}
            <div ref={commentaryEndRef} />
          </div>
        </div>

        {/* Right 5 Cols: Live Match Stats Telemetry */}
        <div className="md:col-span-5 rounded-2xl border-2 border-black bg-[#16100a] p-4 poster-shadow space-y-3">
          <div className="flex items-center justify-between border-b border-black pb-2">
            <span className="font-poster-title text-xs text-amber-400 font-bold uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Live Stage Stats
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {/* Shots */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{currentFrame.stats.shotsA}</span>
              <span className="text-[10px] text-slate-400 font-sans">Total Shots</span>
              <span className="font-bold text-emerald-400">{currentFrame.stats.shotsB}</span>
            </div>

            {/* Shots On Target */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{currentFrame.stats.shotsOnTargetA}</span>
              <span className="text-[10px] text-slate-400 font-sans">On Target</span>
              <span className="font-bold text-emerald-400">{currentFrame.stats.shotsOnTargetB}</span>
            </div>

            {/* Miracle Saves */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{currentFrame.stats.savesA}</span>
              <span className="text-[10px] text-slate-400 font-sans">Miracle Saves</span>
              <span className="font-bold text-emerald-400">{currentFrame.stats.savesB}</span>
            </div>

            {/* High Note Surges */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{currentFrame.stats.highNotesA}</span>
              <span className="text-[10px] text-slate-400 font-sans">High Note Surges</span>
              <span className="font-bold text-emerald-400">{currentFrame.stats.highNotesB}</span>
            </div>

            {/* Tactical Fouls */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">{currentFrame.stats.foulsA}</span>
              <span className="text-[10px] text-slate-400 font-sans">Tactical Fouls</span>
              <span className="font-bold text-emerald-400">{currentFrame.stats.foulsB}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Playback Control Footer */}
      <div className="rounded-2xl border-2 border-black bg-gradient-to-r from-[#20150d] via-[#170e08] to-[#20150d] p-4 poster-shadow flex flex-wrap items-center justify-between gap-3">
        {/* Play/Pause & Speed Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((prev) => !prev)}
            disabled={isFinished}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-poster-title text-xs font-black border-2 border-black transition-all ${
              isPlaying
                ? 'bg-amber-500 text-black shadow-lg'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            <span>{isPlaying ? 'Pause Sim' : isFinished ? 'Match Finished' : 'Play Live'}</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-black text-xs font-mono font-bold">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  simSpeed === spd
                    ? 'bg-amber-500 text-black font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            onClick={handleInstantSkip}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-black text-amber-300 font-poster-title text-xs font-bold transition-all"
            title="Instant finish to 90' full time"
          >
            <FastForward className="w-4 h-4" />
            <span>Instant</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-black text-slate-400 hover:text-white transition-all"
            title="Restart Matchday Sim from 0'"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Apply & Commit Score Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleApplyResult}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-poster-title text-xs sm:text-sm font-black border-2 border-black poster-shadow-sm shadow-xl transition-all hover:scale-105"
          >
            <CheckCircle2 className="w-4 h-4 text-black" />
            <span>Apply Score ({currentFrame.scoreA} - {currentFrame.scoreB})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
