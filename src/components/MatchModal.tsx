import React, { useState, useEffect, useMemo } from 'react';
import { Idol } from '../types';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import {
  X,
  Trophy,
  AlertCircle,
  Dices,
  Edit3,
  RotateCcw,
  CircleDot,
  Flame,
  Layers,
  Mic,
  Sun,
  Hand,
  Star,
  Activity,
  Sparkles,
  Swords,
  Gauge,
  Gamepad2,
  Waves,
  Tv,
} from 'lucide-react';

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  idolA: Idol | null;
  idolB: Idol | null;
  currentScoreA: number | null;
  currentScoreB: number | null;
  matchTitle?: string;
  stageName?: string;
  isKnockout?: boolean;
  isGrandFinal?: boolean;
  isThirdPlace?: boolean;
  isCompleted?: boolean;
  favoriteIdolIds?: string[];
  formHistoryA?: Array<'W' | 'D' | 'L'>;
  formHistoryB?: Array<'W' | 'D' | 'L'>;
  onFinish: (scoreA: number, scoreB: number, winnerId: string) => void;
  onResetMatch?: () => void;
}

export type GameModeType =
  | 'livesim'
  | 'deckbuilder'
  | 'fighter'
  | 'hackslash'
  | 'racing'
  | 'bossraid'
  | 'bullethell'
  | 'lasersmash'
  | 'blackjack'
  | 'flip7'
  | 'tidepool'
  | 'fortyone'
  | 'wheel'
  | 'pachinko'
  | 'tugofwar'
  | 'cardclash'
  | 'vocal'
  | 'lightstick'
  | 'dice'
  | 'janken'
  | 'manual';

export type SeriesFormat = 'bo1' | 'bo3' | 'bo4' | 'bo5' | 'bo7' | 'bo9';

export const MatchModal: React.FC<MatchModalProps> = ({
  isOpen,
  onClose,
  idolA,
  idolB,
  currentScoreA,
  currentScoreB,
  matchTitle = 'Match Entry',
  stageName = 'Group Stage',
  isKnockout = false,
  isGrandFinal = false,
  isThirdPlace = false,
  isCompleted = false,
  favoriteIdolIds = [],
  formHistoryA = [],
  formHistoryB = [],
  onFinish,
  onResetMatch,
}) => {
  const isThirdPlaceMatch =
    isThirdPlace ||
    stageName.toLowerCase().includes('3rd') ||
    stageName.toLowerCase().includes('third') ||
    matchTitle.toLowerCase().includes('3rd') ||
    matchTitle.toLowerCase().includes('third') ||
    matchTitle.toLowerCase().includes('bronze');

  const isGrandFinalMatch =
    !isThirdPlaceMatch &&
    (isGrandFinal ||
      stageName.toLowerCase().includes('grand final') ||
      matchTitle.toLowerCase().includes('grand final'));

  // v4 formats: Third Place and Grand Final Bo7, other knockouts Bo5, Swiss Bo3,
  // league, group stage, LCQ and The Idols phase 1 Bo4 (4 games, draws allowed).
  const isSwissStage = stageName.toLowerCase().includes('swiss');
  const defaultSeriesFormat: SeriesFormat =
    isGrandFinalMatch || isThirdPlaceMatch
      ? 'bo7'
      : isKnockout
      ? 'bo5'
      : isSwissStage
      ? 'bo3'
      : 'bo4';

  const [seriesFormat, setSeriesFormat] = useState<SeriesFormat>(defaultSeriesFormat);

  const targetWins = useMemo(() => {
    switch (seriesFormat) {
      case 'bo1':
        return 1;
      case 'bo3':
        return 2;
      case 'bo4':
        return 3;
      case 'bo5':
        return 3;
      case 'bo7':
        return 4;
      case 'bo9':
        return 5;
      default:
        return 2;
    }
  }, [seriesFormat]);

  const defaultWinnerScore = targetWins;
  const defaultLoserScore = Math.max(0, targetWins - 2);

  const safeScoreA = (val: number | null | undefined) =>
    val === null || val === undefined || Number.isNaN(val) ? (isCompleted ? defaultWinnerScore : 0) : val;
  const safeScoreB = (val: number | null | undefined) =>
    val === null || val === undefined || Number.isNaN(val) ? (isCompleted ? defaultLoserScore : 0) : val;

  const [scoreA, setScoreA] = useState<number>(safeScoreA(currentScoreA));
  const [scoreB, setScoreB] = useState<number>(safeScoreB(currentScoreB));
  const [error, setError] = useState<string | null>(null);

  const isFavA = idolA ? favoriteIdolIds?.includes(idolA.id) : false;
  const isFavB = idolB ? favoriteIdolIds?.includes(idolB.id) : false;
  const hasFavoriteIdol = isFavA || isFavB;
  const bothAreFavorites = isFavA && isFavB;

  // Pool of all interactive / playable mini game modes
  const PLAYABLE_MINIGAMES: GameModeType[] = [
    'deckbuilder',
    'fighter',
    'hackslash',
    'racing',
    'bossraid',
    'bullethell',
    'lasersmash',
    'blackjack',
    'flip7',
    'tidepool',
    'fortyone',
  ];

  // Helper to pick 7 unique different game modes for Grand Final Best of 7
  const pick7DistinctGrandFinalModes = (): GameModeType[] => {
    const pool = [...PLAYABLE_MINIGAMES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 7);
  };

  const [grandFinalModes, setGrandFinalModes] = useState<GameModeType[]>(() => pick7DistinctGrandFinalModes());
  const [grandFinalRoundIndex, setGrandFinalRoundIndex] = useState<number>(0);

  const [activeMode, setActiveMode] = useState<GameModeType>('manual');

  const [playerControlledSide, setPlayerControlledSide] = useState<'A' | 'B'>(() => {
    if (isFavB && !isFavA) return 'B';
    return 'A';
  });

  useEffect(() => {
    setScoreA(safeScoreA(currentScoreA));
    setScoreB(safeScoreB(currentScoreB));
    setError(null);
    // Manual score is the default mode to prevent unnecessary scrolling
    setActiveMode('manual');

    if (isFavB && !isFavA) {
      setPlayerControlledSide('B');
    } else {
      setPlayerControlledSide('A');
    }

    if (isGrandFinalMatch) {
      const distinct7 = pick7DistinctGrandFinalModes();
      setGrandFinalModes(distinct7);
      setGrandFinalRoundIndex(0);
    }
  }, [isOpen, currentScoreA, currentScoreB, isGrandFinalMatch, isKnockout, isThirdPlaceMatch, hasFavoriteIdol, bothAreFavorites, isFavA, isFavB]);

  const handleFinish = () => {
    if (!idolA || !idolB) return;

    if (scoreA === null || scoreB === null || isNaN(scoreA) || isNaN(scoreB)) {
      setError('Please enter valid scores for both players.');
      return;
    }

    if (scoreA < 0 || scoreB < 0) {
      setError('Scores cannot be negative.');
      return;
    }

    if (seriesFormat === 'bo4') {
      if (scoreA + scoreB !== 4) {
        setError('Best of 4 always plays 4 games. Valid results: 4-0, 3-1, 2-2 (draw), 1-3 or 0-4.');
        return;
      }
    } else if (Math.max(scoreA, scoreB) !== targetWins || Math.min(scoreA, scoreB) >= targetWins) {
      if (!(scoreA === scoreB && !isKnockout && !isSwissStage && seriesFormat === 'bo1')) {
        setError(`Best of ${seriesFormat.replace('bo', '')} ends when one idol reaches ${targetWins} wins.`);
        return;
      }
    }

    if (isKnockout && scoreA === scoreB) {
      setError('Knockout matches cannot end in a draw! One idol must win to advance to the next round.');
      return;
    }

    let winnerId = '';
    if (scoreA > scoreB) winnerId = idolA.id;
    else if (scoreB > scoreA) winnerId = idolB.id;
    else winnerId = 'DRAW'; // For group stage if draw allowed

    setError(null);
    onFinish(scoreA, scoreB, winnerId);
    onClose();
  };

  const handleWheelResult = React.useCallback(
    (winner: 'A' | 'B' | 'DRAW', scA: number, scB: number) => {
      // For Grand Final at knockout stage, score should not change automatically or be impacted by minigame result
      if (isGrandFinalMatch && isKnockout) {
        return;
      }
      setScoreA(scA);
      setScoreB(scB);
      setError(null);
    },
    [isGrandFinalMatch, isKnockout]
  );

  if (!isOpen || !idolA || !idolB) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border-3 border-black bg-[#1c1510] poster-shadow-lg my-auto">
        {/* Top Checkered Banner */}
        <div className="h-2 checkered-banner border-b border-black flex-shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-black p-4 sm:p-6 pb-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full poster-pill-gold px-3 py-1 text-xs font-black">
                {stageName}
              </span>
              <h2 className="text-xl sm:text-2xl font-poster-title text-red-500 drop-shadow-[2px_2px_0px_#000]">
                {matchTitle}
              </h2>
            </div>
            <p className="mt-1 text-xs text-amber-200/80 font-bold">
              Use the seed-weighted Wheel Picker or manual inputs to determine the outcome.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-amber-300 hover:bg-red-950 border-2 border-black transition-colors poster-shadow-sm flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* Favorite Idol Match Announcement Banner */}
          {bothAreFavorites ? (
            <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-950 via-[#2d1f14] to-amber-950 p-3 text-center shadow-lg animate-pulse">
              <div className="flex items-center justify-center gap-2 text-amber-300 font-poster-title text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-300" />
                <span>ALL-STAR FAVORITE DUEL (DEFAULT POP-UP MODE)</span>
                <Star className="h-4 w-4 fill-amber-400 text-amber-300" />
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5 font-bold">
                Both <strong>{idolA.name}</strong> and <strong>{idolB.name}</strong> are your chosen favorites! Standard picker and default score entry are active.
              </p>
            </div>
          ) : hasFavoriteIdol ? (
            <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-emerald-200 font-bold">
                <Sparkles className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Favorite Idol Match: Controlling{' '}
                  <strong className="text-emerald-300">
                    {isFavA ? idolA.name : idolB.name}
                  </strong>{' '}
                  vs AI Opponent (difficulty scaled to seed)!
                </span>
              </div>
              {isGrandFinalMatch ? (
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2.5 py-0.5 text-[10px] font-black text-amber-300 flex-shrink-0 self-start sm:self-auto">
                  GRAND FINAL: 7 RANDOM MODES
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-300 flex-shrink-0 self-start sm:self-auto">
                  RANDOM MODE PICKED
                </span>
              )}
            </div>
          ) : null}

          {/* Grand Final 7-Game Series Selector Banner */}
          {isGrandFinalMatch && hasFavoriteIdol && !bothAreFavorites && grandFinalModes.length >= 7 && (
            <div className="rounded-xl border-2 border-amber-400/80 bg-[#160f0a] p-3 space-y-2 poster-shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Grand Final Best of 7: 7 Unique Game Modes
                </span>
                <span className="text-[10px] font-mono font-black text-amber-400">
                  Game {grandFinalRoundIndex + 1} of 7
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {grandFinalModes.map((m, idx) => {
                  const isActive = activeMode === m;
                  const modeLabels: Record<GameModeType, string> = {
                    livesim: '🎬 Live',
                    deckbuilder: '🎴 Deck',
                    fighter: '🥊 Fight',
                    hackslash: '🗡️ Slash',
                    racing: '🏎️ Drift',
                    bossraid: '🎯 Raid',
                    bullethell: '🚀 Blaster',
                    lasersmash: '🏓 Smash',
                    blackjack: '♠️ 21',
                    flip7: '🎲 Flip7',
                    tidepool: '🌊 Tide',
                    fortyone: '🃏 41',
                    wheel: '🎡 Wheel',
                    pachinko: '🎯 Pinball',
                    tugofwar: '🪢 Tug',
                    cardclash: '🎴 Clash',
                    vocal: '🎤 Vocal',
                    lightstick: '✨ Light',
                    dice: '🎲 Dice',
                    janken: '✊ RPS',
                    manual: '✍️ Manual',
                  };
                  return (
                    <button
                      key={m + idx}
                      type="button"
                      onClick={() => {
                        setGrandFinalRoundIndex(idx);
                        setActiveMode(m);
                      }}
                      className={`px-1 py-1.5 rounded-lg border text-[10px] font-black truncate transition-all text-center ${
                        isActive
                          ? 'border-amber-400 bg-amber-500/30 text-amber-200 ring-2 ring-amber-400'
                          : 'border-black bg-[#241710] text-amber-300/80 hover:bg-[#301f15]'
                      }`}
                    >
                      <div className="text-[9px] text-amber-400/80">G{idx + 1}</div>
                      <div className="truncate">{modeLabels[m] || m}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Series Format Selector Bar (Compact & Sleek) */}
          <div className="rounded-xl border border-amber-500/40 bg-[#160f0a] px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                Series Format:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 font-black text-[10px] font-poster-body shadow-sm">
                {seriesFormat.toUpperCase()} &bull; {seriesFormat === 'bo4' ? '4 games, draws allowed' : targetWins === 1 ? '1 Win' : `First to ${targetWins}`}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'bo1', tag: 'BO1' },
                  { id: 'bo3', tag: 'BO3' },
                  { id: 'bo5', tag: 'BO5' },
                  { id: 'bo7', tag: 'BO7' },
                  { id: 'bo9', tag: 'BO9' },
                ] as const
              ).map((fmt) => {
                const isSelected = seriesFormat === fmt.id;
                const winCount = fmt.id === 'bo1' ? 1 : fmt.id === 'bo3' ? 2 : fmt.id === 'bo5' ? 3 : fmt.id === 'bo7' ? 4 : 5;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      setSeriesFormat(fmt.id);
                      if (scoreA > scoreB) {
                        setScoreA(winCount);
                        setScoreB(Math.max(0, winCount - 2));
                      } else if (scoreB > scoreA) {
                        setScoreB(winCount);
                        setScoreA(Math.max(0, winCount - 2));
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                      isSelected
                        ? 'border border-amber-400 bg-amber-400 text-amber-950 font-black scale-105 shadow-sm ring-1 ring-amber-400'
                        : 'border border-black bg-[#221710] text-amber-300 hover:bg-[#302015] hover:text-white'
                    }`}
                  >
                    {fmt.tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Players Showcase */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4 text-center">
            {/* Idol A */}
            <div className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 border-black bg-[#120e0b] p-3.5 sm:p-5 poster-shadow transition-all relative ${
              scoreA > scoreB ? 'ring-2 ring-emerald-400/80' : ''
            }`}>
              {isFavA && (
                <div className="absolute -top-2 -left-2 z-10 flex items-center gap-1 rounded-full poster-pill-gold px-2.5 py-0.5 text-[10px] font-black text-amber-950 shadow-md">
                  <Star className="h-3.5 w-3.5 fill-amber-950" />
                  <span>FAVORITE</span>
                </div>
              )}
              <div className="relative h-28 w-28 sm:h-36 sm:w-36 overflow-hidden rounded-2xl border-2 border-black shadow-xl poster-shadow-sm">
                {idolA.photoUrl ? (
                  <img
                    src={idolA.photoUrl}
                    alt={idolA.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center font-poster-title text-3xl text-amber-300 bg-black">
                    {idolA.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="w-full truncate">
                <h3 className="font-poster-title text-base sm:text-xl text-amber-100 leading-tight truncate">
                  {idolA.name}
                </h3>
                <p className="text-xs sm:text-sm text-red-400 font-extrabold mt-0.5 truncate">{idolA.girlGroup}</p>
                <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <RatingBadge idol={idolA} size="sm" showTier={true} />
                  {formHistoryA && formHistoryA.length > 0 && (
                    <FormBadge formHistory={formHistoryA} size="xs" showModifier={true} showLabel={false} />
                  )}
                  <span className="rounded-md bg-[#282018] border border-black px-2 py-0.5 text-[11px] font-black text-amber-200">
                    {idolA.seed}
                  </span>
                  <span className="rounded-md bg-[#282018] border border-black px-2 py-0.5 text-[11px] font-black text-amber-200">
                    {idolA.nationality}
                  </span>
                </div>
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full poster-pill-red font-poster-title text-white text-base sm:text-xl tracking-wider border-2 border-black poster-shadow">
                VS
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 poster-pill-gold px-2.5 py-0.5 rounded-full border border-black mt-0.5">
                {isKnockout ? 'Knockout' : 'Group Match'}
              </span>
            </div>

            {/* Idol B */}
            <div className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 border-black bg-[#120e0b] p-3.5 sm:p-5 poster-shadow transition-all relative ${
              scoreB > scoreA ? 'ring-2 ring-emerald-400/80' : ''
            }`}>
              {isFavB && (
                <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 rounded-full poster-pill-gold px-2.5 py-0.5 text-[10px] font-black text-amber-950 shadow-md">
                  <Star className="h-3.5 w-3.5 fill-amber-950" />
                  <span>FAVORITE</span>
                </div>
              )}
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-2xl border-2 border-black shadow-xl poster-shadow-sm">
                {idolB.photoUrl ? (
                  <img
                    src={idolB.photoUrl}
                    alt={idolB.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center font-poster-title text-2xl text-amber-300 bg-black">
                    {idolB.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="w-full truncate">
                <h3 className="font-poster-title text-base sm:text-xl text-amber-100 leading-tight truncate">
                  {idolB.name}
                </h3>
                <p className="text-xs sm:text-sm text-blue-400 font-extrabold mt-0.5 truncate">{idolB.girlGroup}</p>
                <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <RatingBadge idol={idolB} size="sm" showTier={true} />
                  {formHistoryB && formHistoryB.length > 0 && (
                    <FormBadge formHistory={formHistoryB} size="xs" showModifier={true} showLabel={false} />
                  )}
                  <span className="rounded-md bg-[#282018] border border-black px-2 py-0.5 text-[11px] font-black text-amber-200">
                    {idolB.seed}
                  </span>
                  <span className="rounded-md bg-[#282018] border border-black px-2 py-0.5 text-[11px] font-black text-amber-200">
                    {idolB.nationality}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PRIMARY: Manual Score Controls (Default & Positioned at Top to Prevent Scrolling) */}
          <div className="rounded-2xl border-2 border-black bg-[#120e0b] p-3.5 sm:p-4 poster-shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-amber-300 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Edit3 className="h-4 w-4 text-amber-400" />
                <span>Match Score Entry</span>
              </span>
              <span className="text-[10px] text-amber-200/70 lowercase font-mono">
                {scoreA > scoreB
                  ? `${idolA.name} leading (${scoreA}-${scoreB})`
                  : scoreB > scoreA
                  ? `${idolB.name} leading (${scoreB}-${scoreA})`
                  : 'Scores tied'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6 items-center">
              {/* Score A Input */}
              <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[#1c1510] border-2 border-black p-2.5">
                <label className="text-xs font-extrabold text-red-400 uppercase tracking-wider font-poster-body text-center truncate w-full">
                  {idolA.name}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScoreA(Math.max(0, scoreA - 1))}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#282018] border-2 border-black text-base font-black text-amber-200 hover:bg-red-900 transition-colors poster-shadow-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={Number.isNaN(scoreA) ? 0 : scoreA}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      setScoreA(Number.isNaN(parsed) ? 0 : parsed);
                    }}
                    className="h-10 w-14 sm:h-11 sm:w-18 rounded-xl border-2 border-black bg-[#120e0b] text-center text-xl sm:text-2xl font-poster-title text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 poster-shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setScoreA(scoreA + 1)}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#282018] border-2 border-black text-base font-black text-amber-200 hover:bg-red-900 transition-colors poster-shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Score B Input */}
              <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[#1c1510] border-2 border-black p-2.5">
                <label className="text-xs font-extrabold text-blue-400 uppercase tracking-wider font-poster-body text-center truncate w-full">
                  {idolB.name}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScoreB(Math.max(0, scoreB - 1))}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#282018] border-2 border-black text-base font-black text-amber-200 hover:bg-red-900 transition-colors poster-shadow-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={Number.isNaN(scoreB) ? 0 : scoreB}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      setScoreB(Number.isNaN(parsed) ? 0 : parsed);
                    }}
                    className="h-10 w-14 sm:h-11 sm:w-18 rounded-xl border-2 border-black bg-[#120e0b] text-center text-xl sm:text-2xl font-poster-title text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 poster-shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setScoreB(scoreB + 1)}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#282018] border-2 border-black text-base font-black text-amber-200 hover:bg-red-900 transition-colors poster-shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Series Format Selector Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-black pb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Series: <strong className="text-amber-400 font-mono">Best of {seriesFormat.replace('bo', '')}</strong> (First to {targetWins})
                </span>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {(['bo1', 'bo3', 'bo4', 'bo5', 'bo7', 'bo9'] as SeriesFormat[]).map((fmt) => {
                  const isSelected = seriesFormat === fmt;
                  const winCount = fmt === 'bo1' ? 1 : fmt === 'bo3' ? 2 : fmt === 'bo4' ? 3 : fmt === 'bo5' ? 3 : fmt === 'bo7' ? 4 : 5;
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        setSeriesFormat(fmt);
                        if (!isCompleted) {
                          setScoreA(winCount);
                          setScoreB(Math.max(0, winCount - 2));
                        }
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all border ${
                        isSelected
                          ? 'poster-pill-gold text-amber-950 border-amber-300 ring-1 ring-amber-400 scale-105 shadow-sm'
                          : 'bg-[#201710] border-black text-amber-300/70 hover:text-white hover:bg-[#2c1e15]'
                      }`}
                    >
                      {fmt === 'bo4' ? 'BO4 (draw ok)' : `${fmt.toUpperCase()} (${winCount}W)`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Score Preset Buttons */}
            <div className="pt-0.5 flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-amber-200/60 mr-1 font-poster-body">
                Presets:
              </span>

              {seriesFormat === 'bo4' &&
                ([[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]] as Array<[number, number]>).map(([a, b]) => (
                  <button
                    key={`bo4-${a}-${b}`}
                    type="button"
                    onClick={() => {
                      setScoreA(a);
                      setScoreB(b);
                      setError(null);
                    }}
                    className="rounded-lg bg-[#261d16] border border-black px-2 py-0.5 text-[10px] font-black text-amber-200 hover:bg-[#33261b] font-mono"
                  >
                    {a}-{b}{a === b ? ' (Draw)' : a > b ? ' (A)' : ' (B)'}
                  </button>
                ))}
              {seriesFormat !== 'bo4' && (
                <>
              {/* Idols A Wins Presets */}
              {Array.from({ length: targetWins }).map((_, loserScore) => (
                <button
                  key={`winA-${targetWins}-${loserScore}`}
                  type="button"
                  onClick={() => {
                    setScoreA(targetWins);
                    setScoreB(loserScore);
                    setError(null);
                  }}
                  className="rounded-lg bg-[#261d16] border border-black px-2 py-0.5 text-[10px] font-black text-red-300 hover:bg-red-950 transition-colors poster-shadow-sm"
                >
                  {targetWins}-{loserScore} (A)
                </button>
              ))}

              {/* Draw Preset (for Bo1 or Group Stage non-knockout) */}
              {!isKnockout && (
                <button
                  type="button"
                  onClick={() => {
                    setScoreA(1);
                    setScoreB(1);
                    setError(null);
                  }}
                  className="rounded-lg bg-[#261d16] border border-black px-2 py-0.5 text-[10px] font-black text-amber-300 hover:bg-amber-950 transition-colors poster-shadow-sm"
                >
                  1-1 (Draw)
                </button>
              )}

              {/* Idol B Wins Presets */}
              {Array.from({ length: targetWins }).map((_, loserScoreRev) => {
                const loserScore = targetWins - 1 - loserScoreRev;
                return (
                  <button
                    key={`winB-${loserScore}-${targetWins}`}
                    type="button"
                    onClick={() => {
                      setScoreA(loserScore);
                      setScoreB(targetWins);
                      setError(null);
                    }}
                    className="rounded-lg bg-[#261d16] border border-black px-2 py-0.5 text-[10px] font-black text-blue-300 hover:bg-blue-950 transition-colors poster-shadow-sm"
                  >
                    {loserScore}-{targetWins} (B)
                  </button>
                );
              })}
                </>
              )}
            </div>

            {error && (
              <div className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-red-950 p-2 text-xs font-extrabold text-red-300 border-2 border-black">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t-2 border-black p-4 sm:p-5 bg-[#160f0c] flex-shrink-0">
          <div className="text-xs text-amber-200/70 font-bold flex items-center gap-2">
            {scoreA > scoreB ? (
              <span className="text-emerald-400">
                {isGrandFinalMatch
                  ? `Champion: ${idolA.name}`
                  : isThirdPlaceMatch
                  ? `3rd Place Winner: ${idolA.name}`
                  : `Winner: ${idolA.name}`}
              </span>
            ) : scoreB > scoreA ? (
              <span className="text-emerald-400">
                {isGrandFinalMatch
                  ? `Champion: ${idolB.name}`
                  : isThirdPlaceMatch
                  ? `3rd Place Winner: ${idolB.name}`
                  : `Winner: ${idolB.name}`}
              </span>
            ) : isKnockout ? (
              <span className="text-amber-400">Draw not allowed in Knockout</span>
            ) : (
              <span className="text-amber-400">Result: Draw (1 pt each)</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {onResetMatch && isCompleted && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset this match to unplayed (0-0)?')) {
                    onResetMatch();
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border-2 border-amber-600/60 bg-[#241710] px-3.5 py-2.5 text-xs font-black text-amber-300 hover:bg-amber-950/60 transition-colors poster-shadow-sm"
              >
                <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                <span>Reset Match</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-black bg-[#282018] px-4 sm:px-5 py-2.5 text-xs font-black text-amber-200 hover:bg-red-950 transition-colors poster-shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinish}
              className="flex items-center gap-2 rounded-xl poster-pill-red px-5 sm:px-6 py-2.5 text-xs font-black hover:scale-105 active:scale-95 transition-all shadow-md"
            >
              <Trophy className="h-4 w-4 text-amber-300" />
              <span>
                {isGrandFinalMatch
                  ? 'Crown Champion & Save'
                  : isThirdPlaceMatch
                  ? 'Confirm 3rd Place & Save'
                  : isKnockout
                  ? 'Advance Winner & Finish'
                  : 'Finish & Save Match'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

