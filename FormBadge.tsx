import React, { useState } from 'react';
import { FormDetails, calculateIdolForm } from '../utils/formHelper';
import { Flame, Zap, ArrowRight, CloudRain, Snowflake, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface FormBadgeProps {
  formHistory?: Array<'W' | 'D' | 'L'>;
  form?: Array<'W' | 'D' | 'L'>;
  formDetails?: FormDetails;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showModifier?: boolean;
  showLabel?: boolean;
  showStreak?: boolean;
  showDetails?: boolean;
  interactiveTooltip?: boolean;
  showTooltip?: boolean;
  momentum?: number;
  className?: string;
}

export const FormBadge: React.FC<FormBadgeProps> = ({
  formHistory,
  form,
  formDetails,
  size = 'sm',
  showModifier = false,
  showLabel = false,
  showStreak = false,
  showDetails = false,
  interactiveTooltip,
  showTooltip: propShowTooltip,
  momentum,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const effectiveFormArray = form || formHistory || [];
  const details = formDetails || calculateIdolForm(Array.isArray(effectiveFormArray) ? effectiveFormArray : []);
  const enableTooltip = interactiveTooltip !== undefined ? interactiveTooltip : (propShowTooltip !== undefined ? propShowTooltip : true);

  const effectiveShowModifier = showModifier || showDetails;
  const effectiveShowLabel = showLabel || (showDetails && size !== 'xs');

  const getIcon = () => {
    switch (details.status) {
      case 'on_fire':
        return <Flame className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />;
      case 'confident':
        return <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />;
      case 'cold_slump':
        return <CloudRain className="w-3 h-3 text-rose-400" />;
      case 'deep_freeze':
        return <Snowflake className="w-3 h-3 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />;
      default:
        return <Minus className="w-3 h-3 text-amber-200/60" />;
    }
  };

  const getArrow = () => {
    switch (details.arrowIcon) {
      case 'up-double':
        return <TrendingUp className="w-3 h-3 text-amber-400 stroke-[2.5]" />;
      case 'up':
        return <TrendingUp className="w-3 h-3 text-emerald-400 stroke-[2.2]" />;
      case 'down-double':
        return <TrendingDown className="w-3 h-3 text-cyan-300 stroke-[2.5]" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-rose-400 stroke-[2.2]" />;
      default:
        return <ArrowRight className="w-3 h-3 text-amber-200/60" />;
    }
  };

  let sizeClasses = 'text-[10px] px-1.5 py-0.5 rounded-lg gap-1';
  if (size === 'xs') {
    sizeClasses = 'text-[9px] px-1 py-0.5 rounded-[5px] gap-0.5';
  } else if (size === 'md') {
    sizeClasses = 'text-xs px-2 py-1 rounded-xl gap-1.5';
  } else if (size === 'lg') {
    sizeClasses = 'text-sm px-2.5 py-1 rounded-xl gap-2';
  }

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => enableTooltip && setIsHovered(true)}
      onMouseLeave={() => enableTooltip && setIsHovered(false)}
    >
      <span
        className={`inline-flex items-center justify-center font-mono font-bold select-none border-2 border-black poster-shadow-sm cursor-help ${details.badgeBg} ${details.textColor} ${sizeClasses} ${className}`}
      >
        <span className="shrink-0">{getIcon()}</span>

        {effectiveShowLabel && (
          <span className="font-poster-title text-[10px] uppercase tracking-wider">
            {details.label}
          </span>
        )}

        {effectiveShowModifier && details.ratingModifier !== 0 && (
          <span
            className={`font-black text-[9px] ${
              details.ratingModifier > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {details.ratingModifier > 0 ? `+${details.ratingModifier.toFixed(1)}` : details.ratingModifier.toFixed(1)}
          </span>
        )}

        {showStreak && details.streakText && (
          <span className="text-[9px] font-sans font-bold text-amber-300/80">
            {details.streakText}
          </span>
        )}
      </span>

      {/* Interactive Tooltip Popover */}
      {enableTooltip && isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-2xl bg-[#1a120c] border-2 border-black poster-shadow text-left shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-2 border-b border-black pb-1.5 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{details.emoji}</span>
              <span className="font-poster-title text-xs text-amber-400 font-bold uppercase">
                {details.label} Form
              </span>
            </div>
            {details.ratingModifier !== 0 && (
              <span
                className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded-md border border-black ${
                  details.ratingModifier > 0
                    ? 'bg-emerald-950 text-emerald-300'
                    : 'bg-rose-950 text-rose-300'
                }`}
              >
                {details.ratingModifier > 0 ? `+${details.ratingModifier.toFixed(1)}` : details.ratingModifier.toFixed(1)} OVR
              </span>
            )}
          </div>

          <p className="text-[10px] text-amber-100/90 font-medium leading-tight mb-2">
            {details.description}
          </p>

          <div className="flex items-center justify-between text-[9px] font-mono font-bold text-amber-400/80 bg-black/60 p-1.5 rounded-xl border border-black">
            <span>Last 5: {details.recentRecord}</span>
            <div className="flex items-center gap-1">
              {details.formArray.map((r, i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-poster-title text-[8px] font-black text-white ${
                    r === 'W' ? 'bg-emerald-600' : r === 'D' ? 'bg-amber-600' : 'bg-red-600'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
