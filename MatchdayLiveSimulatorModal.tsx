import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Idol, LeagueMatch, LeagueInfo, LeagueStanding } from '../types';
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
import { calculateLeagueStandings } from '../utils/leagueLogic';
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
} from 'lucide-react';

export interface MatchdayLiveSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  league: LeagueInfo;
  matchday: number;
  idols: Idol[];
  favoriteIdolIds?: string[];
  onCommitMatchdayResults?: (updatedMatches: LeagueMatch[]) => void;
  onApplyMatchdayResults?: (updatedMatches: LeagueMatch[]) => void;
}

export const MatchdayLiveSimulatorModal: React.FC<MatchdayLiveSimulatorModalProps> = ({
  isOpen,
  onClose,
  league,
  matchday,
  idols,
  favoriteIdolIds = [],
  onCommitMatchdayResults,
  onApplyMatchdayResults,
}) => {
  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  const favoriteSet = useMemo(() => new Set(favoriteIdolIds), [favoriteIdolIds]);

  // Matchday matches (usually 10 fixtures)
  const matchesToSim = useMemo(() => {
    return league.matches.filter((m) => m.matchday === matchday);
  }, [league.matches, matchday]);

  // Standings lookup map for idol form history
  const idolFormMap = useMemo(() => {
    const map = new Map<string, Array<'W' | 'D' | 'L'>>();
    league.standings.forEach((st) => {
      map.set(st.idolId, st.form || []);
    });
    return map;
  }, [league.standings]);

  const [matchSims, setMatchSims] = useState<PreGeneratedMatchSimulation[]>([]);

  // Stable generator for matchday fixtures
  const generateSimulations = useCallback(
    (fixtures: LeagueMatch[]) => {
      return fixtures.map((match) => {
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

        const formA = idolFormMap.get(match.idolAId) || [];
        const formB = idolFormMap.get(match.idolBId) || [];

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

  // Initialize simulations upon open or matchday change
  useEffect(() => {
    if (!isOpen) return;
    if (matchesToSim.length === 0) {
      setMatchSims([]);
      return;
    }
    const sims = generateSimulations(matchesToSim);
    setMatchSims(sims);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setRecentBreakingNews([]);
    setSpotlightMatchId(null);
  }, [isOpen, matchday, matchesToSim.length]);

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

  // Global simulation tick loop
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

  // Track breaking goal events across all 10 matches at this frame
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
      setRecentBreakingNews((prev) => [...newGoals, ...prev].slice(0, 5));
    }
  }, [currentFrameIdx, matchSims, isOpen]);

  // Compute live current match scores
  const liveMatchesSnapshot = useMemo(() => {
    return matchesToSim.map((m) => {
      const sim = matchSims.find((s) => s.matchId === m.id);
      if (!sim) return m;
      const frame = sim.frames[Math.min(currentFrameIdx, sim.frames.length - 1)] || sim.frames[0];
      return {
        ...m,
        scoreA: frame.scoreA,
        scoreB: frame.scoreB,
        completed: isFinished,
        winnerId:
          frame.scoreA === frame.scoreB
            ? null
            : frame.scoreA > frame.scoreB
            ? m.idolAId
            : m.idolBId,
      };
    });
  }, [matchesToSim, matchSims, currentFrameIdx, isFinished]);

  // Compute "As It Stands" Virtual Division Standings
  const liveVirtualStandings = useMemo(() => {
    // Merge live matchday snapshot with other completed matches in the league
    const otherMatches = league.matches.filter((m) => m.matchday !== matchday);
    const combinedMatches = [...otherMatches, ...liveMatchesSnapshot];
    return calculateLeagueStandings(league.id, league.memberIds, combinedMatches, idols);
  }, [league, matchday, liveMatchesSnapshot, idols]);

  const handleInstantSkip = () => {
    setCurrentFrameIdx(maxTotalFrames - 1);
    setIsPlaying(false);
  };

  const handleReset = () => {
    if (matchesToSim.length > 0) {
      const sims = generateSimulations(matchesToSim);
      setMatchSims(sims);
    }
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setRecentBreakingNews([]);
    setSpotlightMatchId(null);
  };

  const handleCommitAll = () => {
    const finalMatches = matchesToSim.map((m) => {
      const sim = matchSims.find((s) => s.matchId === m.id);
      if (!sim) return m;
      return {
        ...m,
        scoreA: sim.finalScoreA,
        scoreB: sim.finalScoreB,
        completed: true,
        winnerId: sim.winnerId,
        updatedAt: new Date().toISOString(),
      };
    });
    if (onApplyMatchdayResults) {
      onApplyMatchdayResults(finalMatches);
    } else if (onCommitMatchdayResults) {
      onCommitMatchdayResults(finalMatches);
    }
    onClose();
  };

  if (!isOpen) return null;

  // If a spotlight match is active, render Spotlight View
  const activeSpotlightSim = matchSims.find((s) => s.matchId === spotlightMatchId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto select-none">
      <div className="w-full max-w-6xl rounded-3xl border-3 border-black bg-gradient-to-b from-[#1b1109] via-[#130b06] to-[#0a0603] text-white poster-shadow-lg p-5 sm:p-7 space-y-6 my-auto max-h-[92vh] overflow-y-auto">
        {/* 1. Top Simulcast Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 border-2 border-black flex items-center justify-center text-black poster-shadow-sm">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-poster-title text-xl sm:text-2xl text-amber-400 font-bold uppercase tracking-wide">
                  Matchday {matchday} Live Simulcast
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-red-950 border border-red-500/50 text-red-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Live Simulcast
                </span>
              </div>
              <p className="text-xs text-amber-200/70 font-semibold">
                {league.name} &bull; 10 Simultaneous Matchday Fixtures &bull; Real-time &quot;As It Stands&quot; Table
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-black text-slate-400 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Spotlight Overlay if user clicked spotlight */}
        {activeSpotlightSim && (
          <div className="rounded-3xl border-2 border-amber-400/50 bg-[#160e08] p-4 poster-shadow space-y-3">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <span className="font-poster-title text-xs text-amber-300 font-bold uppercase flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-amber-400" /> Spotlight Match Camera
              </span>
              <button
                onClick={() => setSpotlightMatchId(null)}
                className="text-xs text-amber-400 font-bold hover:underline"
              >
                &larr; Return to Multi-Match Grid
              </button>
            </div>
            <LiveMatchVisualizer
              idolA={activeSpotlightSim.idolA}
              idolB={activeSpotlightSim.idolB}
              formHistoryA={activeSpotlightSim.formA.formArray}
              formHistoryB={activeSpotlightSim.formB.formArray}
              matchTitle={`Matchday ${matchday} Spotlight: ${activeSpotlightSim.idolA.name} vs ${activeSpotlightSim.idolB.name}`}
              stageName={league.name}
              onClose={() => setSpotlightMatchId(null)}
              autoStart={false}
            />
          </div>
        )}

        {/* 2. Global Synchronized Clock & Breaking Goal Alerts Ticker */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Clock Box */}
          <div className="md:col-span-4 rounded-2xl border-2 border-black bg-black/80 p-3 flex items-center justify-between gap-3 poster-shadow">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isFinished ? 'bg-emerald-400' : isPlaying ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span className="font-mono text-xl sm:text-2xl font-black text-amber-300">
                {currentFrameIdx}&apos;
                {currentFrameIdx > 90 ? `+${currentFrameIdx - 90}` : ''}
              </span>
            </div>
            <span className="font-poster-title text-xs uppercase px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40">
              {currentFrameIdx <= 45
                ? '1st Half'
                : currentFrameIdx <= 48
                ? 'Halftime'
                : currentFrameIdx <= 90
                ? '2nd Half'
                : 'Stoppage Time'}
            </span>
          </div>

          {/* Breaking News Ticker */}
          <div className="md:col-span-8 rounded-2xl border-2 border-black bg-[#180f08] p-2.5 flex items-center gap-2.5 overflow-hidden poster-shadow">
            <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-black font-poster-title text-[10px] font-black shrink-0 uppercase tracking-wide">
              Live Goal Alert
            </span>
            <div className="text-xs text-amber-100 font-bold truncate">
              {recentBreakingNews.length > 0 ? (
                <span>
                  {recentBreakingNews[0].minute}&apos; &bull; {recentBreakingNews[0].title} -{' '}
                  {recentBreakingNews[0].description}
                </span>
              ) : (
                <span className="text-slate-400 font-medium">
                  Matches in play across all 10 pitches. Waiting for opening goal...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Main Workspace: 10 Match Grid & Live Virtual Standings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Cols: 10 Match Fixtures Grid */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h3 className="font-poster-title text-sm sm:text-base text-amber-400 font-bold uppercase flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" />
                Around The Grounds (10 Pitches)
              </h3>
              <span className="text-[10px] text-slate-400 font-mono font-bold">
                Click any match for Spotlight Cam
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {matchSims.map((sim, idx) => {
                const frame = sim.frames[Math.min(currentFrameIdx, sim.frames.length - 1)] || sim.frames[0];
                const idolA = sim.idolA;
                const idolB = sim.idolB;
                const isFav = favoriteSet.has(idolA.id) || favoriteSet.has(idolB.id);

                return (
                  <div
                    key={sim.matchId}
                    onClick={() => setSpotlightMatchId(sim.matchId)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      isFav
                        ? 'border-amber-400 bg-[#22160d] hover:border-amber-300 shadow-md ring-1 ring-amber-400/30'
                        : 'border-black bg-[#160f09] hover:bg-[#1f150d] hover:border-amber-500/40'
                    }`}
                  >
                    {/* Pitch number & Fav badge */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-mono font-bold text-slate-400">
                        Pitch {idx + 1}
                      </span>
                      {isFav && (
                        <span className="text-[9px] font-poster-title uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          ★ Favorite
                        </span>
                      )}
                      <Eye className="w-3 h-3 text-slate-500 hover:text-amber-400" />
                    </div>

                    {/* Competitors & Score */}
                    <div className="space-y-1.5 my-1">
                      {/* Competitor A */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-poster-title text-xs font-black text-white truncate">
                            {idolA.name}
                          </span>
                          <FormBadge formDetails={sim.formA} size="xs" />
                        </div>
                        <span className="font-mono text-base font-black text-amber-300">
                          {frame.scoreA}
                        </span>
                      </div>

                      {/* Competitor B */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-poster-title text-xs font-black text-white truncate">
                            {idolB.name}
                          </span>
                          <FormBadge formDetails={sim.formB} size="xs" />
                        </div>
                        <span className="font-mono text-base font-black text-amber-300">
                          {frame.scoreB}
                        </span>
                      </div>
                    </div>

                    {/* Mini momentum bar */}
                    <div className="mt-2 pt-1.5 border-t border-black/60 flex items-center justify-between text-[9px] font-mono text-slate-400">
                      <span>Poss: {frame.stats.possessionPctA}%</span>
                      <span>Shots: {frame.stats.shotsA}-{frame.stats.shotsB}</span>
                      <span>Poss: {frame.stats.possessionPctB}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 5 Cols: "As It Stands" Virtual Division Standings */}
          <div className="lg:col-span-5 rounded-3xl border-2 border-black bg-[#160f09] p-4 poster-shadow space-y-3">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h3 className="font-poster-title text-xs sm:text-sm text-amber-400 font-bold uppercase flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5" />
                Live Standings (As It Stands)
              </h3>
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                Updating Live ⚡
              </span>
            </div>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/80 bg-black/40 text-[9px] font-poster-title text-amber-400 uppercase tracking-wider">
                    <th className="py-2 px-1 text-center w-6">#</th>
                    <th className="py-2 px-2">Idol</th>
                    <th className="py-2 px-1 text-center">P</th>
                    <th className="py-2 px-1 text-center">GD</th>
                    <th className="py-2 px-2 text-center">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/60 font-mono text-[11px]">
                  {liveVirtualStandings.map((st) => {
                    const isTop5 = st.rank <= 5;
                    const is6th = st.rank === 6;

                    return (
                      <tr
                        key={st.idolId}
                        className={`transition-colors ${
                          isTop5 ? 'bg-emerald-950/20' : is6th ? 'bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="py-1.5 px-1 text-center font-bold">
                          <span
                            className={`inline-block w-4 h-4 rounded text-center leading-4 text-[9px] font-black ${
                              st.rank === 1
                                ? 'bg-amber-500 text-black'
                                : isTop5
                                ? 'bg-emerald-600 text-white'
                                : is6th
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400'
                            }`}
                          >
                            {st.rank}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-poster-title text-xs font-bold text-white truncate max-w-[120px]">
                          {st.idolName}
                        </td>
                        <td className="py-1.5 px-1 text-center text-slate-300">{st.played}</td>
                        <td
                          className={`py-1.5 px-1 text-center font-bold ${
                            st.gameDiff > 0
                              ? 'text-emerald-400'
                              : st.gameDiff < 0
                              ? 'text-red-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                        </td>
                        <td className="py-1.5 px-2 text-center font-black text-amber-300">
                          {st.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. Footer Controls & Finalize Action */}
        <div className="rounded-2xl border-2 border-black bg-[#1d120a] p-4 poster-shadow flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              disabled={isFinished}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-poster-title text-xs font-black border-2 border-black transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-black shadow-lg'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
              } disabled:opacity-40`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isPlaying ? 'Pause Simulcast' : isFinished ? 'Matchday Finished' : 'Play Live'}</span>
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
              title="Instant skip to full time"
            >
              <FastForward className="w-4 h-4" />
              <span>Instant Finish</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-black text-slate-400 hover:text-white transition-all"
              title="Restart Matchday Simulcast"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCommitAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-poster-title text-xs sm:text-sm font-black border-2 border-black poster-shadow-sm shadow-xl transition-all hover:scale-105"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>Apply All 10 Matchday Results</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
