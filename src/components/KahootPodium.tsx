import React from 'react';
import { CombinedStatsRecord } from '../utils/leagueLogic';
import { Trophy, Crown, Medal, Flame, Sparkles, TrendingUp } from 'lucide-react';
import { getCountryFlag } from '../utils/nationalityHelper';

type PodiumRankRecord = CombinedStatsRecord & { v5Titles?: number };

interface KahootPodiumProps {
  records: PodiumRankRecord[];
  type: 'idol' | 'group';
  title?: string;
  subtitle?: string;
}

export const KahootPodium: React.FC<KahootPodiumProps> = ({
  records,
  type,
  title,
  subtitle,
}) => {
  const first = records[0];
  const second = records[1];
  const third = records[2];

  if (!first && !second && !third) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#140e0a] border-2 border-black text-amber-300/60 font-bold text-xs">
        No tournament or league data available yet for podium calculation.
      </div>
    );
  }

  const renderCard = (
    rec: PodiumRankRecord | undefined,
    place: 1 | 2 | 3,
    stepHeight: string,
    pillarBg: string,
    badgeBg: string,
    badgeBorder: string,
    textColor: string
  ) => {
    if (!rec) {
      return (
        <div className="flex-1 flex flex-col items-center justify-end">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 mb-3 bg-black/40" />
          <div className={`w-full ${stepHeight} ${pillarBg} rounded-t-2xl border-2 border-b-0 border-black flex items-center justify-center`}>
            <span className="font-poster-title text-2xl text-slate-600">{place}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-end min-w-[110px] sm:min-w-[150px]">
        {/* Crown for 1st Place */}
        {place === 1 && (
          <div className="animate-bounce mb-1 flex items-center gap-1 text-amber-400">
            <Crown className="w-6 h-6 fill-amber-400 drop-shadow-md" />
          </div>
        )}

        {/* Avatar / Logo with Podium Ring */}
        <div className="relative group mb-2.5">
          <div
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 ${badgeBorder} bg-black overflow-hidden shadow-xl transform transition-transform group-hover:scale-105`}
          >
            {rec.photoUrl ? (
              <img
                src={rec.photoUrl}
                alt={rec.name || 'Idol'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-poster-title text-base sm:text-lg text-amber-300 bg-gradient-to-br from-amber-950 to-black">
                {(rec.name || 'ID').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Place Badge */}
          <div
            className={`absolute -bottom-2 -right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-black ${badgeBg} flex items-center justify-center font-poster-title text-xs sm:text-sm font-black shadow-lg`}
          >
            {place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
          </div>
        </div>

        {/* Name & Subtitle */}
        <div className="text-center px-1 mb-2 w-full">
          <div className="flex items-center justify-center gap-1">
            <span className={`font-poster-title text-xs sm:text-sm truncate font-black ${textColor}`}>
              {rec.name}
            </span>
            {rec.nationality && (
              <span className="text-[11px] shrink-0">{getCountryFlag(rec.nationality)}</span>
            )}
          </div>
          {rec.girlGroup && rec.girlGroup !== 'Solo' && (
            <p className="text-[10px] font-bold text-amber-400/80 truncate">
              {rec.girlGroup}
            </p>
          )}
        </div>

        {/* The Kahoot Visual Podium Pillar */}
        <div
          className={`w-full ${stepHeight} ${pillarBg} rounded-t-2xl border-2 border-b-0 border-black p-2 sm:p-3 flex flex-col items-center justify-between shadow-2xl relative overflow-hidden`}
        >
          {/* Subtle background glow/stripes */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

          {/* Place Big Number */}
          <div className="relative font-poster-title text-3xl sm:text-4xl text-white/90 drop-shadow">
            {place}
          </div>

          {/* Key Stats Chips */}
          <div className="relative w-full space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 bg-black/60 rounded-lg px-1.5 py-0.5 border border-black/80">
              <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="font-mono text-[10px] sm:text-xs font-black text-amber-300">
                {rec.titles} {rec.titles === 1 ? 'Title' : 'Titles'}
              </span>
            </div>
            {(rec.v5Titles || 0) > 0 && (
              <div className="flex items-center justify-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-1.5 py-0.5">
                <span className="text-[9px] font-black text-cyan-300">V5 TITLES {rec.v5Titles}</span>
              </div>
            )}
            <div className="flex items-center justify-center gap-1 bg-black/40 rounded-lg px-1.5 py-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-300">
                ⭐ {rec.totalPoints} PTS
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-400">
                &bull; {rec.winRate}% W
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border-2 border-black bg-[#18110b] p-4 sm:p-6 poster-shadow space-y-4">
      {(title || subtitle) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black pb-3">
          <div>
            {title && (
              <h3 className="font-poster-title text-base sm:text-lg text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{title}</span>
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-amber-200/70 font-semibold">{subtitle}</p>
            )}
          </div>
          <div className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-black uppercase">
            All-Time Combined Big Three
          </div>
        </div>
      )}

      {/* Podium Stage: 2nd on Left, 1st in Center, 3rd on Right */}
      <div className="flex items-end justify-center gap-2 sm:gap-4 pt-4 px-2 sm:px-6">
        {/* 2nd Place (Silver) */}
        {renderCard(
          second,
          2,
          'h-36 sm:h-44',
          'bg-gradient-to-t from-slate-700 to-slate-500',
          'bg-slate-300 text-slate-950',
          'border-slate-300',
          'text-slate-200'
        )}

        {/* 1st Place (Gold) - Highest & Center */}
        {renderCard(
          first,
          1,
          'h-48 sm:h-56',
          'bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400',
          'bg-amber-400 text-slate-950',
          'border-amber-400 ring-4 ring-amber-400/30',
          'text-amber-300'
        )}

        {/* 3rd Place (Bronze) */}
        {renderCard(
          third,
          3,
          'h-28 sm:h-36',
          'bg-gradient-to-t from-amber-900 to-amber-700',
          'bg-amber-700 text-white',
          'border-amber-700',
          'text-amber-200'
        )}
      </div>
    </div>
  );
};
