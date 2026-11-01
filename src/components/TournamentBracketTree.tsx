import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { KnockoutMatch, Idol } from '../types';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { Trophy, Swords, Crown, Sparkles, LayoutGrid, GitMerge } from 'lucide-react';

interface TournamentBracketTreeProps {
  knockoutMatches: KnockoutMatch[];
  idolsMap: Map<string, Idol>;
  onSelectMatch?: (match: KnockoutMatch) => void;
  showTitleHeader?: boolean;
  initialLayoutMode?: 'split' | 'linear';
}

interface SVGPathData {
  id: string;
  d: string;
  isActive: boolean;
  isWinnerPath: boolean;
}

export const TournamentBracketTree: React.FC<TournamentBracketTreeProps> = ({
  knockoutMatches,
  idolsMap,
  onSelectMatch,
  showTitleHeader = true,
  initialLayoutMode,
}) => {
  const [layoutMode, setLayoutMode] = useState<'split' | 'linear'>(initialLayoutMode ?? (showTitleHeader ? 'split' : 'linear'));
  const [svgPaths, setSvgPaths] = useState<SVGPathData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group matches by roundIndex
  const roundIndices = Array.from(
    new Set(knockoutMatches.map((m) => m.roundIndex))
  ).sort((a: number, b: number) => a - b);

  // Helper to re-calculate SVG paths whenever container resizes or matches change
  const updateSvgLines = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    const paths: SVGPathData[] = [];

    knockoutMatches.forEach((match) => {
      if (!match.feedsIntoMatchId || match.isThirdPlaceMatch) return;

      const targetMatch = knockoutMatches.find(
        (m) => m.id === match.feedsIntoMatchId
      );
      if (!targetMatch) return;

      const sourceEl = container.querySelector<HTMLElement>(`[data-match-card-id="${CSS.escape(match.id)}"]`);
      const targetEl = container.querySelector<HTMLElement>(`[data-match-card-id="${CSS.escape(targetMatch.id)}"]`);

      if (!sourceEl || !targetEl) return;

      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      // Determine if source is to the left or right of target
      const isLeftToRight = sRect.left < tRect.left;

      let x1 = 0;
      let y1 = sRect.top + sRect.height / 2 - containerRect.top;
      let x2 = 0;
      let y2 = 0;

      // Slot A (top half of target) vs Slot B (bottom half of target)
      if (match.feedsIntoSlot === 'A') {
        y2 = tRect.top + tRect.height * 0.3 - containerRect.top;
      } else if (match.feedsIntoSlot === 'B') {
        y2 = tRect.top + tRect.height * 0.7 - containerRect.top;
      } else {
        y2 = tRect.top + tRect.height / 2 - containerRect.top;
      }

      if (isLeftToRight) {
        x1 = sRect.right - containerRect.left;
        x2 = tRect.left - containerRect.left;
      } else {
        x1 = sRect.left - containerRect.left;
        x2 = tRect.right - containerRect.left;
      }

      const dx = Math.abs(x2 - x1);
      const midX = isLeftToRight ? x1 + dx * 0.5 : x1 - dx * 0.5;

      // Rounded elbow corner path
      const pathD = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;

      const isWinnerPath =
        match.completed &&
        match.winnerId !== null &&
        (targetMatch.idolAId === match.winnerId ||
          targetMatch.idolBId === match.winnerId);

      paths.push({
        id: `line-${match.id}-${targetMatch.id}`,
        d: pathD,
        isActive: match.completed,
        isWinnerPath,
      });
    });

    setSvgPaths(paths);
  };

  useLayoutEffect(() => {
    updateSvgLines();
  }, [knockoutMatches, layoutMode]);

  useEffect(() => {
    const handleResize = () => updateSvgLines();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => updateSvgLines());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Delayed trigger for dynamic layout rendering / font loading
    const timer = setTimeout(() => updateSvgLines(), 150);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [knockoutMatches, layoutMode]);

  // Identify Grand Final & Third Place
  const grandFinalMatch = knockoutMatches.find(
    (m) =>
      !m.isThirdPlaceMatch &&
      !(m.roundName || '').toLowerCase().includes('3rd') &&
      !(m.roundName || '').toLowerCase().includes('third') &&
      !(m.roundName || '').toLowerCase().includes('bronze') &&
      ((m.roundName || '').toLowerCase().includes('grand final') ||
        (m.roundName || '').toLowerCase() === 'final' ||
        ((m.roundName || '').toLowerCase().includes('final') &&
          !(m.roundName || '').toLowerCase().includes('semi') &&
          !(m.roundName || '').toLowerCase().includes('quarter')))
  );

  const thirdPlaceMatch = knockoutMatches.find(
    (m) =>
      Boolean(m.isThirdPlaceMatch) ||
      (m.roundName || '').toLowerCase().includes('3rd') ||
      (m.roundName || '').toLowerCase().includes('third') ||
      (m.roundName || '').toLowerCase().includes('bronze')
  );

  // Filter regular rounds (excluding standalone final / 3rd place which are rendered in the center column in split view)
  const regularRoundIndices = roundIndices.filter((idx) => {
    const roundMatches = knockoutMatches.filter((m) => m.roundIndex === idx);
    return !roundMatches.every(
      (m) =>
        m.id === grandFinalMatch?.id ||
        m.id === thirdPlaceMatch?.id ||
        m.isThirdPlaceMatch ||
        (m.roundName || '').toLowerCase() === 'grand final' ||
        (m.roundName || '').toLowerCase() === 'third place match'
    );
  });

  // Helper to compute rolling form history from completed knockout matches
  const getKnockoutFormHistory = (idolId?: string | null): Array<'W' | 'D' | 'L'> => {
    if (!idolId) return [];
    const form: Array<'W' | 'D' | 'L'> = [];
    (knockoutMatches || []).forEach((m) => {
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

  // Render match card helper
  const renderMatchCard = (m: KnockoutMatch, widthClass = 'w-56') => {
    const idolA = m.idolAId ? idolsMap.get(m.idolAId) : null;
    const idolB = m.idolBId ? idolsMap.get(m.idolBId) : null;
    const isClickable = !!(idolA && idolB && onSelectMatch);
    const formA = getKnockoutFormHistory(m.idolAId);
    const formB = getKnockoutFormHistory(m.idolBId);

    return (
      <div
        id={`match-card-${m.id}`}
        data-match-card-id={m.id}
        key={m.id}
        onClick={() => {
          if (isClickable) onSelectMatch(m);
        }}
        className={`relative z-20 rounded-xl border-2 border-black p-2.5 transition-all poster-shadow ${widthClass} ${
          m.completed
            ? 'bg-[#231812]'
            : idolA && idolB
            ? 'bg-[#1c1510] hover:bg-[#281e17] cursor-pointer'
            : 'bg-[#120e0b] opacity-80'
        }`}
      >
        <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1.5">
          <span className="text-[10px] font-black text-amber-300 tracking-wider uppercase truncate font-poster-body">
            {m.roundName} #{m.matchNumber}
          </span>
          {m.completed && (
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-black poster-shadow-sm">
              Final
            </span>
          )}
        </div>

        {/* Idol A Row */}
        <div
          className={`flex items-center justify-between p-1.5 rounded-lg border-2 border-black transition-colors mb-1 ${
            m.completed && m.winnerId === m.idolAId
              ? 'bg-[#047857] text-white font-black poster-shadow-sm'
              : 'bg-[#120e0b] text-amber-100'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {idolA ? (
              <>
                {idolA.photoUrl ? (
                  <img
                    src={idolA.photoUrl}
                    alt={idolA.name}
                    className="h-6 w-6 rounded-full object-cover border border-black flex-shrink-0"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-black border border-black flex items-center justify-center text-[9px] font-bold text-amber-300 flex-shrink-0">
                    {idolA.name.slice(0, 1)}
                  </div>
                )}
                <div className="truncate flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs truncate font-poster-body font-bold leading-tight">
                      {idolA.name}
                    </span>
                    <RatingBadge idol={idolA} size="xs" showTier={false} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-amber-200/70 truncate">
                      {idolA.girlGroup}
                    </span>
                    {formA.length > 0 && (
                      <FormBadge formHistory={formA} size="xs" showStreak={false} showModifier={false} />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-xs text-amber-200/50 italic">TBD</span>
            )}
          </div>
          <span className="font-poster-title text-xs text-amber-300 ml-1 px-1.5 py-0.5 rounded bg-[#282018] border border-black flex-shrink-0">
            {m.scoreA !== null ? m.scoreA : '-'}
          </span>
        </div>

        {/* Idol B Row */}
        <div
          className={`flex items-center justify-between p-1.5 rounded-lg border-2 border-black transition-colors ${
            m.completed && m.winnerId === m.idolBId
              ? 'bg-[#047857] text-white font-black poster-shadow-sm'
              : 'bg-[#120e0b] text-amber-100'
          }`}
        >
          <div className="flex items-center gap-2 truncate flex-1 min-w-0">
            {idolB ? (
              <>
                {idolB.photoUrl ? (
                  <img
                    src={idolB.photoUrl}
                    alt={idolB.name}
                    className="h-6 w-6 rounded-full object-cover border border-black flex-shrink-0"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-black border border-black flex items-center justify-center text-[9px] font-bold text-amber-300 flex-shrink-0">
                    {idolB.name.slice(0, 1)}
                  </div>
                )}
                <div className="truncate flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs truncate font-poster-body font-bold leading-tight">
                      {idolB.name}
                    </span>
                    <RatingBadge idol={idolB} size="xs" showTier={false} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-amber-200/70 truncate">
                      {idolB.girlGroup}
                    </span>
                    {formB.length > 0 && (
                      <FormBadge formHistory={formB} size="xs" showStreak={false} showModifier={false} />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-xs text-amber-200/50 italic">TBD</span>
            )}
          </div>
          <span className="font-poster-title text-xs text-amber-300 ml-1 px-1.5 py-0.5 rounded bg-[#282018] border border-black flex-shrink-0">
            {m.scoreB !== null ? m.scoreB : '-'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {showTitleHeader && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-extrabold text-white">
              Knockout Stage Tournament Tree
            </h3>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setLayoutMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-colors ${
                layoutMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitMerge className="h-3.5 w-3.5" />
              <span>World Cup Bracket</span>
            </button>
            <button
              onClick={() => setLayoutMode('linear')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-colors ${
                layoutMode === 'linear'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Linear View</span>
            </button>
          </div>
        </div>
      )}

      {/* Bracket Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto p-6 rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl custom-scrollbar"
      >
        {/* SVG Connector Overlay */}
        <svg
          className="absolute inset-0 pointer-events-none w-full h-full z-10 overflow-visible"
          style={{ minWidth: '100%' }}
        >
          <defs>
            <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {svgPaths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              fill="none"
              stroke={
                path.isWinnerPath
                  ? '#eab308' // Gold for advancing winner
                  : path.isActive
                  ? '#6366f1' // Indigo for completed matches
                  : '#334155' // Slate for pending matches
              }
              strokeWidth={path.isWinnerPath ? 3 : path.isActive ? 2 : 1.5}
              strokeDasharray={path.isActive ? 'none' : '4 3'}
              filter={path.isWinnerPath ? 'url(#glow-gold)' : undefined}
              className="transition-all duration-300"
            />
          ))}
        </svg>

        {layoutMode === 'split' ? (
          /* WORLD CUP SPLIT BRACKET LAYOUT (Left Side -> Center Final <- Right Side) */
          <div className="flex gap-12 min-w-max justify-center items-center py-4 relative z-20">
            {/* LEFT BRACKET HALF */}
            {regularRoundIndices.map((roundIdx) => {
              const allMatchesInRound = knockoutMatches.filter(
                (m) => m.roundIndex === roundIdx
              );
              // Left half = first half of matches
              const leftMatches = allMatchesInRound.slice(
                0,
                Math.ceil(allMatchesInRound.length / 2)
              );
              if (leftMatches.length === 0) return null;

              const roundTitle =
                leftMatches[0]?.roundName || `Round ${roundIdx}`;

              return (
                <div
                  key={`left-${roundIdx}`}
                  className="flex flex-col gap-6 w-56 flex-shrink-0"
                >
                  <div className="text-center py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-extrabold text-indigo-400 tracking-wider uppercase">
                    {roundTitle} (Left)
                  </div>
                  <div className="flex flex-col justify-around gap-8 flex-1 py-2">
                    {leftMatches.map((m) => renderMatchCard(m, 'w-56'))}
                  </div>
                </div>
              );
            })}

            {/* CENTER COLUMN: GRAND FINAL & 3RD PLACE */}
            <div className="flex flex-col gap-6 w-64 flex-shrink-0 justify-center items-center relative z-20 mx-2">
              <div className="text-center py-1.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 text-[11px] font-black text-amber-300 tracking-widest uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>Championship Final</span>
              </div>

              {/* Grand Final Match Box */}
              {grandFinalMatch && (
                <div className="w-full relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider z-30 shadow-md">
                    Grand Final
                  </div>
                  {renderMatchCard(grandFinalMatch, 'w-full')}
                </div>
              )}

              {/* Third Place Match Box */}
              {thirdPlaceMatch && (
                <div className="w-full relative mt-2">
                  <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    3rd Place Playoff
                  </div>
                  {renderMatchCard(thirdPlaceMatch, 'w-full')}
                </div>
              )}
            </div>

            {/* RIGHT BRACKET HALF (REVERSED COLUMN ORDER) */}
            {[...regularRoundIndices].reverse().map((roundIdx) => {
              const allMatchesInRound = knockoutMatches.filter(
                (m) => m.roundIndex === roundIdx
              );
              // Right half = second half of matches
              const rightMatches = allMatchesInRound.slice(
                Math.ceil(allMatchesInRound.length / 2)
              );
              if (rightMatches.length === 0) return null;

              const roundTitle =
                rightMatches[0]?.roundName || `Round ${roundIdx}`;

              return (
                <div
                  key={`right-${roundIdx}`}
                  className="flex flex-col gap-6 w-56 flex-shrink-0"
                >
                  <div className="text-center py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-extrabold text-indigo-400 tracking-wider uppercase">
                    {roundTitle} (Right)
                  </div>
                  <div className="flex flex-col justify-around gap-8 flex-1 py-2">
                    {rightMatches.map((m) => renderMatchCard(m, 'w-56'))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LINEAR BRACKET LAYOUT (Play-In -> R32 -> R16 -> Quarters -> Semis -> Final) */
          <div className="flex gap-10 min-w-max py-4 items-center relative z-20">
            {roundIndices.map((roundIdx) => {
              const matchesInRound = knockoutMatches.filter(
                (m) => m.roundIndex === roundIdx
              );
              const roundTitle =
                matchesInRound[0]?.roundName || `Round ${roundIdx}`;

              return (
                <div
                  key={roundIdx}
                  className="flex flex-col gap-6 w-56 flex-shrink-0"
                >
                  <div className="text-center py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-extrabold text-indigo-400 tracking-wider uppercase">
                    {roundTitle}
                  </div>

                  <div className="flex flex-col justify-around gap-8 flex-1 py-2">
                    {matchesInRound.map((m) => renderMatchCard(m, 'w-56'))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
