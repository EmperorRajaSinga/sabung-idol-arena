import React from 'react';
import { Idol } from '../types';
import { getIdolRating, getRatingTierInfo } from '../utils/ratingHelper';

export interface RatingBadgeProps {
  rating?: number;
  idol?: Partial<Idol> | null;
  seed?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTier?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  rating,
  idol,
  seed,
  size = 'sm',
  showTier = false,
  showLabel = false,
  className = '',
}) => {
  const numericRating =
    typeof rating === 'number' && !Number.isNaN(rating)
      ? Math.max(0, Math.min(100, Math.round(rating)))
      : idol
      ? getIdolRating(idol)
      : getIdolRating({ seed } as Partial<Idol>);

  const tierInfo = getRatingTierInfo(numericRating);

  // Simple, clean, eyesafe color mapping with subtle borders and tints
  let tierStyles = {
    badgeBg: 'bg-slate-900/80',
    borderColor: 'border-slate-700/70',
    textColor: 'text-slate-300',
    tierTextColor: 'text-slate-400',
  };

  if (numericRating >= 95) {
    // S+
    tierStyles = {
      badgeBg: 'bg-amber-950/40',
      borderColor: 'border-amber-400/80',
      textColor: 'text-amber-300 font-bold',
      tierTextColor: 'text-amber-400',
    };
  } else if (numericRating >= 90) {
    // S
    tierStyles = {
      badgeBg: 'bg-amber-950/30',
      borderColor: 'border-amber-500/70',
      textColor: 'text-amber-300 font-bold',
      tierTextColor: 'text-amber-400',
    };
  } else if (numericRating >= 80) {
    // A
    tierStyles = {
      badgeBg: 'bg-emerald-950/35',
      borderColor: 'border-emerald-500/70',
      textColor: 'text-emerald-300 font-bold',
      tierTextColor: 'text-emerald-400',
    };
  } else if (numericRating >= 70) {
    // B
    tierStyles = {
      badgeBg: 'bg-sky-950/35',
      borderColor: 'border-sky-500/70',
      textColor: 'text-sky-300 font-bold',
      tierTextColor: 'text-sky-400',
    };
  } else if (numericRating >= 60) {
    // C
    tierStyles = {
      badgeBg: 'bg-orange-950/35',
      borderColor: 'border-orange-500/70',
      textColor: 'text-orange-300 font-bold',
      tierTextColor: 'text-orange-400',
    };
  } else {
    // D
    tierStyles = {
      badgeBg: 'bg-slate-900/70',
      borderColor: 'border-slate-700/70',
      textColor: 'text-slate-300 font-medium',
      tierTextColor: 'text-slate-400',
    };
  }

  // Sizing definitions
  let sizeClasses = 'text-[10px] px-1.5 py-0.5 rounded gap-1';
  if (size === 'xs') {
    sizeClasses = 'text-[9px] px-1 py-0.5 rounded-[4px] gap-0.5';
  } else if (size === 'md') {
    sizeClasses = 'text-xs px-2 py-0.5 rounded-md gap-1.5';
  } else if (size === 'lg') {
    sizeClasses = 'text-sm px-2.5 py-1 rounded-lg gap-2';
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-mono select-none border shrink-0 ${tierStyles.badgeBg} ${tierStyles.borderColor} ${tierStyles.textColor} ${sizeClasses} ${className}`}
      title={`Rating: ${numericRating}/100 (${tierInfo.tier} - ${tierInfo.label})`}
    >
      {showLabel && <span className="text-[9px] font-sans uppercase text-slate-400 tracking-wider">OVR</span>}
      {showTier && (
        <span className={`font-black text-[9px] ${tierStyles.tierTextColor}`}>
          {tierInfo.tier}
        </span>
      )}
      <span className="font-extrabold tracking-tight">{numericRating}</span>
    </span>
  );
};
