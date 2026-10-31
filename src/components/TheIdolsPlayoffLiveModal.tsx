import React, { useState, useEffect, useRef } from 'react';
import { TheIdolsPlayoffMatch, Idol } from '../types';
import {
  Sparkles,
  Swords,
  Trophy,
  Play,
  Pause,
  FastForward,
  CheckCircle,
  X,
  Flame,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { getCountryFlag } from '../utils/nationalityHelper';
import { getIdolRating } from '../utils/ratingHelper';

interface TheIdolsPlayoffLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: TheIdolsPlayoffMatch | null;
  idolsMap: Map<string, Idol>;
  onCommitSeriesResult: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string,
    games: Array<{ gameNumber: number; scoreA: number; scoreB: number; winnerId: string }>
  ) => void;
}

export const TheIdolsPlayoffLiveModal: React.FC<TheIdolsPlayoffLiveModalProps> = ({
  isOpen,
  onClose,
  match,
  idolsMap,
  onCommitSeriesResult,
}) => {
  const [currentGameIdx, setCurrentGameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [simulatedGames, setSimulatedGames] = useState<
    Array<{ gameNumber: number; scoreA: number; scoreB: number; winnerId: string }>
  >([]);
  const [isSeriesOver, setIsSeriesOver] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  const resolvedMap = idolsMap && typeof idolsMap.get === 'function' ? idolsMap : new Map<string, Idol>();
  const idolA = match?.idolAId ? resolvedMap.get(match.idolAId) : null;
  const idolB = match?.idolBId ? resolvedMap.get(match.idolBId) : null;
  const targetWins = match?.targetWins || (match?.bestOf === 7 ? 4 : 3);

  // Pre-generate the full series outcomes on open
  useEffect(() => {
    if (!isOpen || !match || !idolA || !idolB) {
      setIsPlaying(false);
      setCurrentGameIdx(0);
      setIsSeriesOver(false);
      setSimulatedGames([]);
      return;
    }

    const ratingA = getIdolRating(idolA);
    const ratingB = getIdolRating(idolB);
    const diff = ratingA - ratingB;
    const probA = 1 / (1 + Math.pow(10, -diff / 25));

    let winsA = 0;
    let winsB = 0;
    const gamesList: Array<{ gameNumber: number; scoreA: number; scoreB: number; winnerId: string }> = [];

    let gNum = 1;
    while (winsA < targetWins && winsB < targetWins) {
      const momentumA = gNum > 1 && gamesList[gamesList.length - 1]?.winnerId === idolA.id ? 0.05 : 0;
      const effectiveProbA = Math.max(0.2, Math.min(0.8, probA + momentumA));
      const isWinA = Math.random() < effectiveProbA;

      let scA = 0;
      let scB = 0;
      if (isWinA) {
        winsA++;
        scB = Math.floor(Math.random() * 2);
        scA = scB + (Math.random() < 0.65 ? 1 : 2);
        gamesList.push({
          gameNumber: gNum,
          scoreA: scA,
          scoreB: scB,
          winnerId: idolA.id,
        });
      } else {
        winsB++;
        scA = Math.floor(Math.random() * 2);
        scB = scA + (Math.random() < 0.65 ? 1 : 2);
        gamesList.push({
          gameNumber: gNum,
          scoreA: scA,
          scoreB: scB,
          winnerId: idolB.id,
        });
      }
      gNum++;
    }

    setSimulatedGames(gamesList);
    setCurrentGameIdx(0);
    setIsSeriesOver(false);
    setIsPlaying(true);
  }, [isOpen, match, idolA, idolB, targetWins]);

  // Tick games
  useEffect(() => {
    if (!isPlaying || simulatedGames.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = speed === 1 ? 1200 : speed === 2 ? 600 : 250;

    timerRef.current = setInterval(() => {
      setCurrentGameIdx((prev) => {
        const next = prev + 1;
        if (next >= simulatedGames.length) {
          setIsPlaying(false);
          setIsSeriesOver(true);
          return simulatedGames.length;
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, simulatedGames]);

  if (!isOpen || !match || !idolA || !idolB) return null;

  const visibleGames = simulatedGames.slice(0, currentGameIdx);
  const currentWinsA = visibleGames.filter((g) => g.winnerId === idolA.id).length;
  const currentWinsB = visibleGames.filter((g) => g.winnerId === idolB.id).length;

  const handleInstantFinish = () => {
    setCurrentGameIdx(simulatedGames.length);
    setIsPlaying(false);
    setIsSeriesOver(true);
  };

  const handleCommit = () => {
    const totalWinsA = simulatedGames.filter((g) => g.winnerId === idolA.id).length;
    const totalWinsB = simulatedGames.filter((g) => g.winnerId === idolB.id).length;
    const winnerId = totalWinsA > totalWinsB ? idolA.id : idolB.id;

    onCommitSeriesResult(match.id, totalWinsA, totalWinsB, winnerId, simulatedGames);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl flex flex-col rounded-3xl border-3 border-black bg-[#160f0a] poster-shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black bg-[#20140c] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 border-2 border-black text-amber-950 font-black shadow">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Masters Playoff Broadcast
                </span>
                <span className="text-xs font-mono font-black text-amber-400">
                  Best of {match.bestOf} (First to {targetWins})
                </span>
              </div>
              <h2 className="font-poster-title text-xl text-amber-300">
                {match.roundName}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-amber-400 hover:bg-amber-950 border-2 border-black transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Big Series Scoreboard */}
        <div className="p-6 bg-gradient-to-b from-[#20140c] to-[#160f0a] border-b-2 border-black">
          <div className="flex items-center justify-between">
            {/* Idol A */}
            <div className="flex flex-col items-center text-center w-[38%]">
              <div className="relative mb-2">
                <img
                  src={idolA.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                  alt={idolA.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
                  }}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-3 border-black poster-shadow-sm"
                />
                <span className="absolute -bottom-1 -right-1 text-[10px] bg-black/90 px-1.5 py-0.5 rounded border border-black text-amber-300 font-mono font-bold">
                  {getIdolRating(idolA)}
                </span>
              </div>
              <span className="text-sm font-black text-amber-200 truncate max-w-full">
                {idolA.name}
              </span>
              <span className="text-[11px] text-amber-200/60 font-bold truncate">
                {idolA.girlGroup || 'Independent'}
              </span>
            </div>

            {/* Live Series Score */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 px-6 py-2 rounded-2xl bg-[#120b07] border-3 border-black poster-shadow-sm">
                <span
                  className={`text-4xl font-mono font-black ${
                    currentWinsA >= targetWins ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {currentWinsA}
                </span>
                <span className="text-xl font-bold text-amber-200/40">-</span>
                <span
                  className={`text-4xl font-mono font-black ${
                    currentWinsB >= targetWins ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {currentWinsB}
                </span>
              </div>
              <span className="text-[10px] uppercase font-black tracking-widest text-amber-400/80 mt-1.5">
                {isSeriesOver
                  ? currentWinsA > currentWinsB
                    ? `${idolA.name} Advances!`
                    : `${idolB.name} Advances!`
                  : `Game ${Math.min(simulatedGames.length, currentGameIdx + 1)} in progress`}
              </span>
            </div>

            {/* Idol B */}
            <div className="flex flex-col items-center text-center w-[38%]">
              <div className="relative mb-2">
                <img
                  src={idolB.photoUrl || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80'}
                  alt={idolB.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80';
                  }}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-3 border-black poster-shadow-sm"
                />
                <span className="absolute -bottom-1 -right-1 text-[10px] bg-black/90 px-1.5 py-0.5 rounded border border-black text-amber-300 font-mono font-bold">
                  {getIdolRating(idolB)}
                </span>
              </div>
              <span className="text-sm font-black text-amber-200 truncate max-w-full">
                {idolB.name}
              </span>
              <span className="text-[11px] text-amber-200/60 font-bold truncate">
                {idolB.girlGroup || 'Independent'}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#1a100a] border-b-2 border-black">
          <div className="flex items-center gap-2">
            {!isSeriesOver && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border-2 border-black bg-amber-500 text-amber-950 text-xs font-black hover:bg-amber-400 transition-colors poster-shadow-sm"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause' : 'Resume'}</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-[#120b07] p-1 rounded-xl border border-black">
              {[1, 2, 4].map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpeed(sp)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black transition-all ${
                    speed === sp
                      ? 'bg-amber-500 text-amber-950'
                      : 'text-amber-200/60 hover:text-amber-200'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>

            {!isSeriesOver && (
              <button
                onClick={handleInstantFinish}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black bg-[#281b12] text-amber-300 text-xs font-bold hover:bg-amber-950 transition-colors"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Simulate Series End</span>
              </button>
            )}
          </div>

          <div>
            {isSeriesOver && (
              <button
                onClick={handleCommit}
                className="flex items-center gap-2 px-5 py-2 rounded-xl border-2 border-black bg-gradient-to-r from-emerald-500 to-teal-500 text-emerald-950 text-xs font-black hover:brightness-110 transition-all poster-shadow-sm animate-pulse"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Save Series Result</span>
              </button>
            )}
          </div>
        </div>

        {/* Game-by-Game Log */}
        <div className="p-6 space-y-2 max-h-60 overflow-y-auto">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-400/80 mb-2">
            Game By Game Breakdown
          </h4>
          {visibleGames.map((g) => {
            const isWinnerA = g.winnerId === idolA.id;
            return (
              <div
                key={g.gameNumber}
                className="flex items-center justify-between p-2.5 rounded-xl border-2 border-black bg-[#1f140d] text-xs font-bold font-mono"
              >
                <span className="text-amber-300/70">Game {g.gameNumber}</span>
                <div className="flex items-center gap-3">
                  <span className={isWinnerA ? 'text-emerald-400 font-black' : 'text-amber-200/80'}>
                    {g.scoreA}
                  </span>
                  <span className="text-amber-200/40">-</span>
                  <span className={!isWinnerA ? 'text-emerald-400 font-black' : 'text-amber-200/80'}>
                    {g.scoreB}
                  </span>
                </div>
                <span className={isWinnerA ? 'text-amber-300 font-black' : 'text-purple-300 font-black'}>
                  {isWinnerA ? idolA.name : idolB.name} Win
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
