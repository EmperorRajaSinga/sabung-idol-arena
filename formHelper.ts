import { Idol } from '../types';
import { getIdolRating } from './ratingHelper';

export type FormStatusType = 'on_fire' | 'confident' | 'steady' | 'cold_slump' | 'deep_freeze';

export interface FormDetails {
  status: FormStatusType;
  emoji: string;
  label: string;
  ratingModifier: number; // e.g. +3.5, +1.5, 0, -1.8, -3.5
  momentumScore: number; // -100 to +100
  description: string;
  streakText: string;
  recentRecord: string; // e.g. "4W-1D-0L"
  formArray: Array<'W' | 'D' | 'L'>;
  badgeBg: string;
  borderColor: string;
  textColor: string;
  arrowIcon: 'up-double' | 'up' | 'flat' | 'down' | 'down-double';
}

/**
 * Calculates Form & Momentum based on an idol's last 5 league match results and streaks
 */
export function calculateIdolForm(
  formHistory: Array<'W' | 'D' | 'L'> = [],
  options?: {
    recentGameDiff?: number;
    extraMatches?: Array<'W' | 'D' | 'L'>;
  }
): FormDetails {
  const form = (formHistory || []).slice(-5); // focus on last 5 matches
  const total = form.length;

  if (total === 0) {
    return {
      status: 'steady',
      emoji: '➡️',
      label: 'Steady',
      ratingModifier: 0,
      momentumScore: 0,
      description: 'Neutral season opener form. Ready for competition.',
      streakText: 'Neutral Form',
      recentRecord: '0W-0D-0L',
      formArray: [],
      badgeBg: 'bg-slate-900/80',
      borderColor: 'border-slate-700',
      textColor: 'text-slate-300',
      arrowIcon: 'flat',
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;

  // Weight recent matches slightly higher (recency weighting)
  let weightedPoints = 0;
  let maxPossiblePoints = 0;

  form.forEach((res, idx) => {
    const weight = 1 + idx * 0.25; // 1.0, 1.25, 1.5, 1.75, 2.0
    maxPossiblePoints += 3 * weight;

    if (res === 'W') {
      wins++;
      weightedPoints += 3 * weight;
    } else if (res === 'D') {
      draws++;
      weightedPoints += 1 * weight;
    } else {
      losses++;
    }
  });

  const rawScore = maxPossiblePoints > 0 ? (weightedPoints / maxPossiblePoints) * 100 : 50;

  // Calculate current active streak (looking backwards from latest)
  let activeStreakType: 'W' | 'D' | 'L' | null = null;
  let activeStreakCount = 0;

  for (let i = form.length - 1; i >= 0; i--) {
    const r = form[i];
    if (activeStreakType === null) {
      activeStreakType = r;
      activeStreakCount = 1;
    } else if (r === activeStreakType) {
      activeStreakCount++;
    } else {
      break;
    }
  }

  // Calculate streak text
  let streakText = 'Even Form';
  if (activeStreakType === 'W') {
    streakText = activeStreakCount >= 3 ? `${activeStreakCount}W Hot Streak!` : `${activeStreakCount}W Streak`;
  } else if (activeStreakType === 'L') {
    streakText = activeStreakCount >= 3 ? `${activeStreakCount}L Cold Slump` : `${activeStreakCount}L Streak`;
  } else if (activeStreakType === 'D') {
    streakText = `${activeStreakCount}D Streak`;
  }

  // Unbeaten streak check
  let unbeatenCount = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (form[i] !== 'L') unbeatenCount++;
    else break;
  }

  // Determine Form Tier
  let status: FormStatusType = 'steady';
  let emoji = '➡️';
  let label = 'Steady';
  let ratingModifier = 0;
  let momentumScore = 0;
  let description = 'Consistent baseline form. Performing according to standard ratings.';
  let badgeBg = 'bg-[#1e1711]';
  let borderColor = 'border-amber-900/40';
  let textColor = 'text-amber-200/90';
  let arrowIcon: 'up-double' | 'up' | 'flat' | 'down' | 'down-double' = 'flat';

  if (wins >= 4 || (wins >= 3 && activeStreakType === 'W' && activeStreakCount >= 3)) {
    // 🔥 ON FIRE
    status = 'on_fire';
    emoji = '🔥';
    label = 'On Fire';
    ratingModifier = Math.min(5.5, 3.2 + (wins >= 4 ? 1.2 : 0.6) + (activeStreakCount >= 4 ? 0.8 : 0.3));
    momentumScore = Math.min(100, Math.round(rawScore + 12));
    description = `Blazing momentum (${wins} wins in last ${total})! Lethal attacking instinct, boosted matchday odds (+${ratingModifier.toFixed(1)} OVR).`;
    badgeBg = 'bg-amber-950/60';
    borderColor = 'border-amber-400';
    textColor = 'text-amber-300 font-bold';
    arrowIcon = 'up-double';
  } else if (wins >= 3 || unbeatenCount >= 3 || rawScore >= 65) {
    // ⚡ CONFIDENT
    status = 'confident';
    emoji = '⚡';
    label = 'Confident';
    ratingModifier = Math.min(3.2, 1.8 + (unbeatenCount >= 3 ? 0.6 : 0));
    momentumScore = Math.min(75, Math.round(rawScore));
    description = `High confidence and sharp execution (${wins}W-${draws}D-${losses}L). Positive momentum (+${ratingModifier.toFixed(1)} OVR).`;
    badgeBg = 'bg-emerald-950/60';
    borderColor = 'border-emerald-500';
    textColor = 'text-emerald-300 font-bold';
    arrowIcon = 'up';
  } else if (losses >= 4 || (losses >= 3 && activeStreakType === 'L' && activeStreakCount >= 3)) {
    // ❄️ DEEP FREEZE
    status = 'deep_freeze';
    emoji = '❄️';
    label = 'Deep Freeze';
    ratingModifier = Math.max(-5.5, -3.2 - (losses >= 4 ? 1.2 : 0.6));
    momentumScore = Math.max(-100, Math.round((rawScore - 50) * 2));
    description = `Severe slump (${losses} losses in last ${total}). Shaken confidence, sluggish execution (${ratingModifier.toFixed(1)} OVR).`;
    badgeBg = 'bg-cyan-950/60';
    borderColor = 'border-cyan-400';
    textColor = 'text-cyan-300 font-bold';
    arrowIcon = 'down-double';
  } else if (losses >= 3 || (losses >= 2 && activeStreakType === 'L' && activeStreakCount >= 2)) {
    // 🌧️ COLD SLUMP
    status = 'cold_slump';
    emoji = '🌧️';
    label = 'Cold Slump';
    ratingModifier = Math.max(-3.0, -1.8 - (activeStreakCount >= 2 ? 0.5 : 0));
    momentumScore = Math.max(-65, Math.round((rawScore - 50) * 1.5));
    description = `Struggling for form (${losses} defeats recently). Vulnerable to high-tempo attacks (${ratingModifier.toFixed(1)} OVR).`;
    badgeBg = 'bg-rose-950/60';
    borderColor = 'border-rose-500';
    textColor = 'text-rose-300 font-bold';
    arrowIcon = 'down';
  } else {
    // ➡️ STEADY
    status = 'steady';
    emoji = '➡️';
    label = 'Steady';
    ratingModifier = 0;
    momentumScore = Math.round((rawScore - 50) * 0.8);
    description = `Balanced baseline form (${wins}W-${draws}D-${losses}L). Even execution.`;
    badgeBg = 'bg-[#18110b]';
    borderColor = 'border-black';
    textColor = 'text-amber-200/80';
    arrowIcon = 'flat';
  }

  return {
    status,
    emoji,
    label,
    ratingModifier,
    momentumScore,
    description,
    streakText,
    recentRecord: `${wins}W-${draws}D-${losses}L`,
    formArray: form,
    badgeBg,
    borderColor,
    textColor,
    arrowIcon,
  };
}

/**
 * Returns effective rating taking into account base rating and active form modifier
 */
export function getEffectiveIdolRating(
  idol?: Partial<Idol> | null,
  formHistory?: Array<'W' | 'D' | 'L'>
): {
  baseRating: number;
  effectiveRating: number;
  form: FormDetails;
} {
  const baseRating = getIdolRating(idol);
  const form = calculateIdolForm(formHistory);
  const effectiveRating = Math.max(25, Math.min(99, Math.round(baseRating + form.ratingModifier)));

  return {
    baseRating,
    effectiveRating,
    form,
  };
}

/**
 * Pre-match Form Comparison Breakdown between two idols
 */
export function compareMatchupForm(
  idolA?: Partial<Idol> | null,
  formA: Array<'W' | 'D' | 'L'> = [],
  idolB?: Partial<Idol> | null,
  formB: Array<'W' | 'D' | 'L'> = []
): {
  idolAForm: FormDetails;
  idolBForm: FormDetails;
  effectiveRatingA: number;
  effectiveRatingB: number;
  formAdvantage: 'A' | 'B' | 'EQUAL';
  formAdvantageDelta: number;
  summaryText: string;
} {
  const formDetailsA = calculateIdolForm(formA);
  const formDetailsB = calculateIdolForm(formB);

  const baseA = getIdolRating(idolA);
  const baseB = getIdolRating(idolB);

  const effectiveRatingA = Math.max(25, Math.min(99, Math.round(baseA + formDetailsA.ratingModifier)));
  const effectiveRatingB = Math.max(25, Math.min(99, Math.round(baseB + formDetailsB.ratingModifier)));

  const formDelta = formDetailsA.ratingModifier - formDetailsB.ratingModifier;

  let formAdvantage: 'A' | 'B' | 'EQUAL' = 'EQUAL';
  if (formDelta >= 1.0) formAdvantage = 'A';
  else if (formDelta <= -1.0) formAdvantage = 'B';

  let summaryText = 'Both competitors enter the arena with comparable recent momentum.';
  if (formAdvantage === 'A') {
    summaryText = `${idolA?.name || 'Idol A'} carries a form & momentum advantage (${formDetailsA.emoji} vs ${formDetailsB.emoji}) granting a +${formDelta.toFixed(1)} OVR swing.`;
  } else if (formAdvantage === 'B') {
    summaryText = `${idolB?.name || 'Idol B'} holds the hot-streak advantage (${formDetailsB.emoji} vs ${formDetailsA.emoji}) providing an edge in clutch moments.`;
  }

  return {
    idolAForm: formDetailsA,
    idolBForm: formDetailsB,
    effectiveRatingA,
    effectiveRatingB,
    formAdvantage,
    formAdvantageDelta: Math.abs(formDelta),
    summaryText,
  };
}
