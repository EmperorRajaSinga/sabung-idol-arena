import React, { useState } from 'react';
import {
  Trophy,
  Crown,
  Swords,
  Zap,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Shield,
  Edit2,
  Gamepad2,
  FastForward,
  Star,
} from 'lucide-react';
import { Idol, WildcardMatch, WildcardPlayInState, TournamentConfig } from '../types';
import { getCountryFlag } from '../utils/nationalityHelper';
import { MatchModal } from './MatchModal';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';

interface WildcardPlayInBracketProps {
  playIn: WildcardPlayInState | undefined;
  idols: Idol[];
  isInteractive?: boolean;
  favoriteIdolIds?: string[];
  config?: TournamentConfig;
  onSimulateMatch?: (matchId: string) => void;
  onUpdateScore?: (matchId: string, scoreA: number, scoreB: number) => void;
  onSimulateAll?: () => void;
  onReset?: () => void;
}

export const WildcardPlayInBracket: React.FC<WildcardPlayInBracketProps> = ({
  playIn,
  idols,
  isInteractive = false,
  favoriteIdolIds = [],
  config,
  onSimulateMatch,
  onUpdateScore,
  onSimulateAll,
  onReset,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<WildcardMatch | null>(null);

  const favSet = React.useMemo(() => {
    const list = favoriteIdolIds.length > 0 ? favoriteIdolIds : config?.favoriteIdolIds || [];
    return new Set(list);
  }, [favoriteIdolIds, config?.favoriteIdolIds]);

  const idolsMap = React.useMemo(() => {
    const map = new Map<string, Idol>();
    (idols || []).forEach((i) => i && map.set(i.id, i));
    return map;
  }, [idols]);

  if (!playIn || !playIn.isInitialized || !playIn.participants || playIn.participants.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-black bg-[#160f0a] p-8 text-center space-y-3 poster-shadow">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="font-poster-title text-lg text-amber-400">
          Wildcard Play-In Stage Not Ready Yet
        </h3>
        <p className="text-xs text-slate-400 font-medium max-w-md mx-auto">
          The 6th-place contenders from each of the 6 leagues will automatically enter this double-elimination play-in stage once the league season standings are established.
        </p>
      </div>
    );
  }

  const { participants = [], matches = [], qualifier1Id, qualifier2Id, isCompleted } = playIn;

  const matchMap = new Map<string, WildcardMatch>();
  (matches || []).forEach((m) => m && matchMap.set(m.id, m));

  const m1 = matchMap.get('wc_ub_r1_m1');
  const m2 = matchMap.get('wc_ub_r1_m2');
  const m3 = matchMap.get('wc_ub_final');
  const m4 = matchMap.get('wc_lb_r1_m1');
  const m5 = matchMap.get('wc_lb_r1_m2');
  const m6 = matchMap.get('wc_lb_r2');
  const m7 = matchMap.get('wc_lb_final');

  const q1Idol = qualifier1Id ? idolsMap.get(qualifier1Id) : undefined;
  const q2Idol = qualifier2Id ? idolsMap.get(qualifier2Id) : undefined;

  // Compute rolling form history for wildcard play-in matches
  const getWildcardFormHistory = (idolId?: string | null): Array<'W' | 'D' | 'L'> => {
    if (!idolId) return [];
    const form: Array<'W' | 'D' | 'L'> = [];
    (matches || []).forEach((m) => {
      if (m.completed && m.scoreA !== null && m.scoreB !== null) {
        if (m.idolAId === idolId) {
          if (m.scoreA > m.scoreB) form.push('W');
          else if (m.scoreA < m.scoreB) form.push('L');
          else form.push('D');
        } else if (m.idolBId === idolId) {
          if (m.scoreB > m.scoreA) form.push('W');
          else if (m.scoreB < m.scoreA) form.push('L');
          else form.push('D');
        }
      }
    });
    return form.slice(-5);
  };

  // Sub-component to render a match card in the bracket tree
  const renderMatchCard = (
    match: WildcardMatch | undefined,
    title: string,
    badgeText?: string,
    isFinal = false
  ) => {
    if (!match) return null;

    const idolA = match.idolAId ? idolsMap.get(match.idolAId) : null;
    const idolB = match.idolBId ? idolsMap.get(match.idolBId) : null;
    const isReady = !!match.idolAId && !!match.idolBId;
    const isDone = match.completed && match.scoreA !== null && match.scoreB !== null;
    const aWon = isDone && match.winnerId === match.idolAId;
    const bWon = isDone && match.winnerId === match.idolBId;

    const partA = participants.find((p) => p.idolId === match.idolAId);
    const partB = participants.find((p) => p.idolId === match.idolBId);
    const formA = getWildcardFormHistory(match.idolAId);
    const formB = getWildcardFormHistory(match.idolBId);

    const isFavMatch =
      (match.idolAId && favSet.has(match.idolAId)) ||
      (match.idolBId && favSet.has(match.idolBId));

    return (
      <div
        className={`rounded-2xl border-2 p-3.5 space-y-2.5 transition-all shadow-md relative ${
          isFinal
            ? 'bg-gradient-to-br from-[#24170d] via-[#1c1209] to-[#120b06] border-amber-500/80 ring-1 ring-amber-400/40'
            : isFavMatch && !isDone
            ? 'bg-gradient-to-br from-[#251910] via-[#18110b] to-[#120b07] border-amber-400/70 ring-1 ring-amber-400/30'
            : 'bg-[#130c07] border-black/90 hover:border-amber-500/30'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-1 border-b border-black/80 pb-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 font-poster-title">
            <span className="text-amber-400 font-bold tracking-wide">{title}</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[8px] font-black text-amber-300 border border-amber-500/30 uppercase">
              BO5
            </span>
            {badgeText && (
              <span className="px-1.5 py-0.2 rounded bg-black/50 text-[8px] font-bold text-slate-300 border border-slate-700 uppercase hidden sm:inline">
                {badgeText}
              </span>
            )}
          </div>
          <span
            className={`font-black text-[9px] uppercase px-2 py-0.5 rounded-full ${
              isDone
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                : isReady
                ? 'bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-black/60 text-slate-500'
            }`}
          >
            {isDone ? 'Final' : isReady ? 'Live' : 'Pending'}
          </span>
        </div>

        {/* Competitor A */}
        <div
          className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
            aWon
              ? 'ring-2 ring-lime-400 bg-lime-950/40 border-lime-500/60 text-lime-300 font-black shadow-[0_0_10px_rgba(163,230,53,0.3)]'
              : 'bg-black/40 border-black/60 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg border border-black bg-black overflow-hidden shrink-0 relative">
              {idolA?.photoUrl ? (
                <img
                  src={idolA.photoUrl}
                  alt={idolA.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-poster-title text-[9px] text-amber-300 bg-black">
                  {idolA ? idolA.name.slice(0, 2) : '?'}
                </div>
              )}
              {match.idolAId && favSet.has(match.idolAId) && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5 shadow">
                  <Star className="w-2 h-2 fill-black" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`font-poster-title text-xs truncate ${aWon ? 'text-lime-300 font-black' : 'text-white'}`}>
                  {idolA?.name || 'TBD'}
                </span>
                {idolA && <RatingBadge idol={idolA} size="xs" showTier={false} />}
                {idolA?.nationality && (
                  <span className="text-[9px] shrink-0">
                    {getCountryFlag(idolA.nationality)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[8px] truncate ${aWon ? 'text-lime-400/80 font-bold' : 'text-amber-400/80 font-medium'}`}>
                  {partA ? `Seed #${partA.playInSeed} (${partA.leagueName})` : idolA?.girlGroup || 'Competitor'}
                </span>
                {formA.length > 0 && (
                  <FormBadge formHistory={formA} size="xs" showStreak={false} showModifier={false} />
                )}
              </div>
            </div>
          </div>
          <div className={`font-mono text-sm font-black px-1.5 ${aWon ? 'text-lime-300' : 'text-slate-400'}`}>
            {isDone ? match.scoreA : '-'}
          </div>
        </div>

        {/* Competitor B */}
        <div
          className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
            bWon
              ? 'ring-2 ring-lime-400 bg-lime-950/40 border-lime-500/60 text-lime-300 font-black shadow-[0_0_10px_rgba(163,230,53,0.3)]'
              : 'bg-black/40 border-black/60 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg border border-black bg-black overflow-hidden shrink-0 relative">
              {idolB?.photoUrl ? (
                <img
                  src={idolB.photoUrl}
                  alt={idolB.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&auto=format&fit=crop&q=80';
                  }}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-poster-title text-[9px] text-amber-300 bg-black">
                  {idolB ? idolB.name.slice(0, 2) : '?'}
                </div>
              )}
              {match.idolBId && favSet.has(match.idolBId) && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5 shadow">
                  <Star className="w-2 h-2 fill-black" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`font-poster-title text-xs truncate ${bWon ? 'text-lime-300 font-black' : 'text-white'}`}>
                  {idolB?.name || 'TBD'}
                </span>
                {idolB && <RatingBadge idol={idolB} size="xs" showTier={false} />}
                {idolB?.nationality && (
                  <span className="text-[9px] shrink-0">
                    {getCountryFlag(idolB.nationality)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[8px] truncate ${bWon ? 'text-lime-400/80 font-bold' : 'text-amber-400/80 font-medium'}`}>
                  {partB ? `Seed #${partB.playInSeed} (${partB.leagueName})` : idolB?.girlGroup || 'Competitor'}
                </span>
                {formB.length > 0 && (
                  <FormBadge formHistory={formB} size="xs" showStreak={false} showModifier={false} />
                )}
              </div>
            </div>
          </div>
          <div className={`font-mono text-sm font-black px-1.5 ${bWon ? 'text-lime-300' : 'text-slate-400'}`}>
            {isDone ? match.scoreB : '-'}
          </div>
        </div>

        {/* Interactive Controls / Game Modal Launchers */}
        {isInteractive && isReady && (
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-black/50">
            <button
              onClick={() => setSelectedMatch(match)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl font-poster-title text-[10px] font-black shadow transition-all hover:scale-[1.02] ${
                isDone
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                  : isFavMatch
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-black shadow-amber-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>{isDone ? 'Edit / Mini-Games (BO5)' : 'Play Match (BO5)'}</span>
            </button>

            {!isDone && onSimulateMatch && (
              <button
                onClick={() => onSimulateMatch(match.id)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 text-[10px] font-bold"
                title="Quick Simulate BO5 Match"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Bar */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#20150d] via-[#1a1109] to-[#120b06] p-5 poster-shadow flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-black font-poster-title font-black text-sm border border-black shadow">
              <Swords className="w-4 h-4 fill-black" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-poster-title text-xl sm:text-2xl text-amber-400 tracking-wide">
                  WILDCARD PLAY-IN STAGE
                </h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  Double Elimination &bull; Best of 5 (BO5)
                </span>
              </div>
              <p className="text-xs text-amber-200/80 font-bold">
                6th-place division contenders battle in Best-of-5 series with full mini-game modal support for the final 2 spots in the Top 32 Champions Tournament.
              </p>
            </div>
          </div>
        </div>

        {/* Global Play-In Simulator Buttons */}
        {isInteractive && (
          <div className="flex items-center gap-2">
            {onReset && (
              <button
                onClick={onReset}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold font-poster-title"
                title="Reset all play-in matches"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            {onSimulateAll && !isCompleted && (
              <button
                onClick={onSimulateAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-poster-title text-xs font-black shadow-lg border border-black"
              >
                <Zap className="w-3.5 h-3.5 fill-black" />
                <span>Simulate Entire Play-In (BO5)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Six Contender Seed Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span className="font-poster-title text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>6th-Place Contenders &amp; Seeding</span>
          </span>
          <span className="text-[11px] text-amber-200/70">
            Seeds #1–#4 in Upper Bracket &bull; Seeds #5–#6 in Lower Bracket &bull; All Matches BO5 (First to 3)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {participants.map((p) => {
            const idol = idolsMap.get(p.idolId);
            const isUpper = p.bracketStart === 'upper';
            const isQualified = p.idolId === qualifier1Id || p.idolId === qualifier2Id;

            return (
              <div
                key={p.idolId}
                className={`p-2.5 rounded-2xl border-2 border-black flex flex-col justify-between space-y-2 relative poster-shadow-sm ${
                  isQualified
                    ? 'bg-gradient-to-b from-[#2e1d0e] to-[#1a1109] ring-2 ring-amber-400'
                    : isUpper
                    ? 'bg-[#18110b]'
                    : 'bg-[#130d09]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-poster-title text-[10px] font-black border border-black ${
                      isUpper ? 'bg-amber-500 text-black' : 'bg-slate-700 text-amber-300'
                    }`}
                  >
                    #{p.playInSeed}
                  </span>
                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                      isUpper
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isUpper ? 'Upper' : 'Lower'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl border border-black bg-black overflow-hidden shrink-0 relative">
                    {p.photoUrl ? (
                      <img
                        src={p.photoUrl}
                        alt={p.idolName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-poster-title text-[10px] text-amber-300 bg-black">
                        {p.idolName.slice(0, 2)}
                      </div>
                    )}
                    {favSet.has(p.idolId) && (
                      <span className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5 shadow">
                        <Star className="w-2 h-2 fill-black" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-poster-title text-xs text-white truncate font-bold">
                      {p.idolName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] font-bold text-amber-400/80 truncate">
                        {p.girlGroup}
                      </span>
                      {getWildcardFormHistory(p.idolId).length > 0 && (
                        <FormBadge formHistory={getWildcardFormHistory(p.idolId)} size="xs" showStreak={false} showModifier={false} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-black/50 text-[9px] flex items-center justify-between text-slate-400 font-bold">
                  <span>{p.leagueName}</span>
                  <span className="text-amber-300 font-black">{p.points} PTS</span>
                </div>

                {isQualified && (
                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-black px-1.5 py-0.5 rounded-full text-[8px] font-poster-title font-black flex items-center gap-0.5 border border-black shadow">
                    <Crown className="w-2.5 h-2.5 fill-black" />
                    <span>QUALIFIED</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Double Elimination Bracket Tree */}
      <div className="space-y-6">
        {/* UPPER BRACKET (WINNERS BRACKET) */}
        <div className="rounded-3xl border-3 border-black bg-[#160f0a] p-5 md:p-6 space-y-4 poster-shadow-lg">
          <div className="flex items-center justify-between border-b border-black pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500 text-black font-poster-title text-xs font-black flex items-center justify-center border border-black">
                UB
              </span>
              <h3 className="font-poster-title text-lg text-amber-400 tracking-wide">
                WINNERS BRACKET (BO5)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              Winner of Upper Bracket Final qualifies as <strong className="text-amber-300">Wildcard Spot #1</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* UB Semifinals (Round 1) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/80">
                  UB Semifinals (BO5)
                </span>
                <span className="text-[9px] text-rose-400/80 font-mono font-bold">
                  ↘ Losers drop to LB R1
                </span>
              </div>
              <div className="space-y-3">
                {renderMatchCard(m1, 'Match 1', 'UB Semi 1 (#1 vs #4)')}
                {renderMatchCard(m2, 'Match 2', 'UB Semi 2 (#2 vs #3)')}
              </div>
            </div>

            {/* UB Final */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Upper Bracket Final (BO5)
                </span>
                <span className="text-[9px] text-rose-400/80 font-mono font-bold">
                  ↘ Loser drops to LB Final
                </span>
              </div>
              <div>
                {renderMatchCard(m3, 'Match 3', 'UB FINAL (QUALIFIER #1)', true)}
              </div>
            </div>
          </div>
        </div>

        {/* LOWER BRACKET (LOSERS BRACKET) */}
        <div className="rounded-3xl border-3 border-black bg-[#120d09] p-5 md:p-6 space-y-4 poster-shadow-lg">
          <div className="flex items-center justify-between border-b border-black pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-700 text-amber-300 font-poster-title text-xs font-black flex items-center justify-center border border-black">
                LB
              </span>
              <h3 className="font-poster-title text-lg text-amber-400 tracking-wide">
                LOSERS BRACKET (BO5)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              Winner of Lower Bracket Final qualifies as <strong className="text-amber-300">Wildcard Spot #2</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* LB Round 1 */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                LB Round 1 (Best of 5)
              </div>
              <div className="space-y-3">
                {renderMatchCard(m4, 'Match 4', 'Loser M1 vs #6')}
                {renderMatchCard(m5, 'Match 5', 'Loser M2 vs #5')}
              </div>
            </div>

            {/* LB Semifinal */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                LB Semifinal (Best of 5)
              </div>
              <div>
                {renderMatchCard(m6, 'Match 6', 'Winner M4 vs Winner M5')}
              </div>
            </div>

            {/* LB Final */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Lower Bracket Final (Best of 5) &bull; Winner Qualifies
              </div>
              <div>
                {renderMatchCard(m7, 'Match 7', 'LB FINAL (QUALIFIER #2)', true)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tournament Progression Ribbon (Matching mockup-03-double-elimination.png) */}
      {(() => {
        const completedCount = (matches || []).filter((m) => m.completed).length;
        const totalMatches = 7;
        const percent = Math.round((completedCount / totalMatches) * 100);

        return (
          <div className="rounded-2xl border-2 border-black bg-[#100a06] p-4 poster-shadow space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                <span className="font-poster-title text-amber-400 uppercase tracking-wider">
                  {completedCount === totalMatches ? 'Play-In Stage Complete' : 'Tournament in Progress'}
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

      {/* 4. Official Qualified Idols Banner */}
      <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#29190d] via-[#1c1108] to-[#120b06] p-6 poster-shadow flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <Trophy className="w-6 h-6 text-amber-400 fill-amber-400" />
            <h3 className="font-poster-title text-xl text-amber-400">
              TOP 32 CHAMPIONS QUALIFIERS VIA PLAY-IN
            </h3>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            These 2 victorious idols advance alongside the 30 Automatic Qualifiers (Top 5 per division) into the Champions Tournament.
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          {/* Qualifier 1 */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-black bg-[#160e08] shadow-lg min-w-[200px]">
            <div className="w-12 h-12 rounded-xl border border-black bg-black overflow-hidden relative shadow shrink-0">
              {q1Idol?.photoUrl ? (
                <img
                  src={q1Idol.photoUrl}
                  alt={q1Idol.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-poster-title text-xs text-amber-300 bg-black">
                  {q1Idol ? q1Idol.name.slice(0, 2) : 'Q1'}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-poster-title text-[9px] font-black border border-black">
                #1
              </span>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase text-amber-400">
                UB Champion (Spot #1)
              </div>
              <div className="font-poster-title text-sm text-white font-bold truncate">
                {q1Idol?.name || 'TBD'}
              </div>
              <div className="text-[9px] font-bold text-slate-400">
                {q1Idol?.girlGroup || 'Play-In Winner'}
              </div>
            </div>
          </div>

          {/* Qualifier 2 */}
          <div className="flex items-center gap-3 p-3 rounded-2xl border-2 border-black bg-[#160e08] shadow-lg min-w-[200px]">
            <div className="w-12 h-12 rounded-xl border border-black bg-black overflow-hidden relative shadow shrink-0">
              {q2Idol?.photoUrl ? (
                <img
                  src={q2Idol.photoUrl}
                  alt={q2Idol.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-poster-title text-xs text-amber-300 bg-black">
                  {q2Idol ? q2Idol.name.slice(0, 2) : 'Q2'}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-poster-title text-[9px] font-black border border-black">
                #2
              </span>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase text-amber-400">
                LB Champion (Spot #2)
              </div>
              <div className="font-poster-title text-sm text-white font-bold truncate">
                {q2Idol?.name || 'TBD'}
              </div>
              <div className="text-[9px] font-bold text-slate-400">
                {q2Idol?.girlGroup || 'Play-In Winner'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Full Mini-Games Match Modal (Best of 5 Elimination Format) */}
      {selectedMatch && (
        <MatchModal
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          idolA={selectedMatch.idolAId ? idolsMap.get(selectedMatch.idolAId) || null : null}
          idolB={selectedMatch.idolBId ? idolsMap.get(selectedMatch.idolBId) || null : null}
          currentScoreA={selectedMatch.scoreA}
          currentScoreB={selectedMatch.scoreB}
          formHistoryA={getWildcardFormHistory(selectedMatch.idolAId)}
          formHistoryB={getWildcardFormHistory(selectedMatch.idolBId)}
          matchTitle={`${selectedMatch.roundName} - Match ${selectedMatch.matchNumber}`}
          stageName="Wildcard Play-In (Best of 5)"
          isKnockout={true}
          isCompleted={selectedMatch.completed}
          favoriteIdolIds={favoriteIdolIds.length > 0 ? favoriteIdolIds : config?.favoriteIdolIds || []}
          onFinish={(scoreA, scoreB, winnerId) => {
            if (onUpdateScore) {
              onUpdateScore(selectedMatch.id, scoreA, scoreB);
            }
            setSelectedMatch(null);
          }}
        />
      )}
    </div>
  );
};
