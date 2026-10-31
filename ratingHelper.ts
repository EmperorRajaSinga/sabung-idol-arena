import {
  Idol,
  TournamentArchive,
  ArchivedMatch,
  LeagueSeasonArchive,
  LeagueSeasonState,
  Group,
  KnockoutMatch,
  TournamentConfig,
} from '../types';
import { calculateIdolForm } from './formHelper';

/**
 * Default rating based on seed or fallback
 */
export function getDefaultIdolRating(seed?: string): number {
  if (!seed) return 70;
  const s = seed.toLowerCase();
  if (s.includes('1')) return 90;
  if (s.includes('2')) return 80;
  if (s.includes('3')) return 70;
  if (s.includes('4')) return 60;
  return 70;
}

/**
 * Returns an idol's current numeric rating clamped between 0 and 100
 */
export function getIdolRating(idol?: Partial<Idol> | null): number {
  if (!idol) return 70;
  if (typeof idol.rating === 'number' && !isNaN(idol.rating)) {
    return Math.max(0, Math.min(100, Math.round(idol.rating)));
  }
  return getDefaultIdolRating(idol.seed);
}

/**
 * Rating Tier categories
 */
export interface RatingTierInfo {
  tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
  label: string;
  minScore: number;
  maxScore: number;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  description: string;
}

export function getRatingTierInfo(rating: number): RatingTierInfo {
  if (rating >= 95) {
    return {
      tier: 'S+',
      label: 'Immortal / God Tier',
      minScore: 95,
      maxScore: 100,
      badgeBg: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500',
      textColor: 'text-amber-950 font-black',
      borderColor: 'border-amber-400 shadow-amber-500/50',
      description: 'Dominant superstar capable of dictating any tournament.',
    };
  }
  if (rating >= 90) {
    return {
      tier: 'S',
      label: 'Superstar / Elite',
      minScore: 90,
      maxScore: 94,
      badgeBg: 'bg-amber-400 text-amber-950',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-400',
      description: 'Championship contender with exceptional form.',
    };
  }
  if (rating >= 80) {
    return {
      tier: 'A',
      label: 'All-Star Powerhouse',
      minScore: 80,
      maxScore: 89,
      badgeBg: 'bg-emerald-500 text-white',
      textColor: 'text-emerald-400',
      borderColor: 'border-emerald-500',
      description: 'Strong frontrunner with consistent playoff prowess.',
    };
  }
  if (rating >= 70) {
    return {
      tier: 'B',
      label: 'Solid Contender',
      minScore: 70,
      maxScore: 79,
      badgeBg: 'bg-indigo-500 text-white',
      textColor: 'text-indigo-400',
      borderColor: 'border-indigo-500',
      description: 'Dependable competitor capable of major upsets.',
    };
  }
  if (rating >= 60) {
    return {
      tier: 'C',
      label: 'Challenger',
      minScore: 60,
      maxScore: 69,
      badgeBg: 'bg-amber-600 text-white',
      textColor: 'text-amber-400',
      borderColor: 'border-amber-600',
      description: 'Developing talent seeking breakthrough victories.',
    };
  }
  return {
    tier: 'D',
    label: 'Underdog',
    minScore: 0,
    maxScore: 59,
    badgeBg: 'bg-slate-700 text-slate-200',
    textColor: 'text-slate-400',
    borderColor: 'border-slate-700',
    description: 'Underdog looking for miracle upsets.',
  };
}

/**
 * Calculates win probability for Idol A vs Idol B given their 0-100 ratings.
 * Uses a logistic Elo formula calibrated to the 0-100 rating scale:
 * Δ = ratingA - ratingB
 * P(A) = 1 / (1 + 10^(-Δ / 34.0))
 * 
 * Calibration (Fine-tuned to grant underdogs an authentic, balanced fighting chance):
 * - Δ = 0 (Equal ratings, e.g. 85 vs 85): P(A) = 50.0% (Underdog: 50.0%)
 * - Δ = +3 (Minor gap, e.g. 85 vs 82): P(A) = 55.0% (Underdog: 45.0%)
 * - Δ = +5 (Slight edge, e.g. 85 vs 80): P(A) = 58.4% (Underdog: 41.6%)
 * - Δ = +10 (1 Tier difference, e.g. 90 [S] vs 80 [A]): P(A) = 66.3% (Underdog: 33.7%)
 * - Δ = +15 (e.g. 95 [S+] vs 80 [A]): P(A) = 73.5% (Underdog: 26.5%)
 * - Δ = +20 (2 Tiers, e.g. 90 [S] vs 70 [B]): P(A) = 79.8% (Underdog: 20.2%)
 * - Δ = +30 (3 Tiers, e.g. 95 [S+] vs 65 [C]): P(A) = 89.0% (Underdog: 11.0%)
 * - Δ = +40 (God tier vs bottom underdog, e.g. 98 vs 58): P(A) = 94.6% (Underdog: 5.4%)
 * 
 * Clamped between 0.035 and 0.965 to preserve authentic underdog breakthroughs and title contention!
 */
export function calculateRatingWinProbability(ratingA: number, ratingB: number): number {
  const rA = Math.max(0, Math.min(100, ratingA));
  const rB = Math.max(0, Math.min(100, ratingB));
  const delta = rA - rB;

  // Calibrated logistic win curve (scale factor 34.0: allows close-rating parity and underdog title runs)
  const prob = 1 / (1 + Math.pow(10, -delta / 34.0));

  // Underdogs retain authentic fighting chance
  return Math.max(0.035, Math.min(0.965, prob));
}

/**
 * Calculates comprehensive match outcome probabilities (Win A, Draw, Win B)
 * Takes into account rating parity for realistic draw frequencies:
 * - High parity (|Δ| <= 5): ~25% draw probability
 * - Moderate gap (|Δ| = 10-15): ~16-20% draw probability
 * - Large gap (|Δ| >= 25): ~6-10% draw probability
 */
export function calculateMatchOutcomes(
  ratingA: number,
  ratingB: number,
  options?: { allowsDraw?: boolean; customDrawScale?: number }
): { winProbA: number; drawProb: number; winProbB: number; rawWinProbA: number } {
  const allowsDraw = options?.allowsDraw ?? true;
  const rawWinProbA = calculateRatingWinProbability(ratingA, ratingB);

  if (!allowsDraw) {
    return {
      winProbA: rawWinProbA,
      drawProb: 0,
      winProbB: 1 - rawWinProbA,
      rawWinProbA,
    };
  }

  const delta = Math.abs(ratingA - ratingB);
  // Dynamic draw curve based on rating gap
  // At delta = 0: drawProb = 0.25
  // At delta = 10: drawProb = 0.19
  // At delta = 20: drawProb = 0.13
  // At delta >= 30: drawProb = 0.06
  const baseDraw = Math.max(0.05, 0.25 - (delta / 35) * 0.20);
  const drawScale = options?.customDrawScale ?? 1.0;
  const drawProb = Math.min(0.30, baseDraw * drawScale);

  const nonDraw = 1 - drawProb;
  const winProbA = nonDraw * rawWinProbA;
  const winProbB = nonDraw * (1 - rawWinProbA);

  return {
    winProbA,
    drawProb,
    winProbB,
    rawWinProbA,
  };
}

/**
 * Simulates a single League Match (0-4 goals) using Poisson-inspired rating dynamics
 * and form/momentum amplification.
 * Enables in-form underdogs and close-rating contenders to win key matches and mount title runs.
 */
export function simulateLeagueMatchScoreLegacy(
  idolA?: Partial<Idol> | null,
  idolB?: Partial<Idol> | null,
  formHistoryA?: Array<'W' | 'D' | 'L'>,
  formHistoryB?: Array<'W' | 'D' | 'L'>
): { scoreA: number; scoreB: number; winnerId: string | null } {
  let rA = getIdolRating(idolA);
  let rB = getIdolRating(idolB);

  // Apply Form & Momentum modifiers
  let formModA = 0;
  let formModB = 0;
  if (formHistoryA && formHistoryA.length > 0) {
    const fA = calculateIdolForm(formHistoryA);
    formModA = fA.ratingModifier;
    rA = Math.max(25, Math.min(99, rA + formModA));
  }
  if (formHistoryB && formHistoryB.length > 0) {
    const fB = calculateIdolForm(formHistoryB);
    formModB = fB.ratingModifier;
    rB = Math.max(25, Math.min(99, rB + formModB));
  }

  // Matchday subtle variance (tactical prep, crowd resonance, day form: +/- 2.0 OVR)
  const matchdayVariance = (Math.random() - Math.random()) * 2.0;
  const effectiveRatingA = rA + matchdayVariance;
  const effectiveRatingB = rB;

  const delta = effectiveRatingA - effectiveRatingB; // positive means A is favored

  const { winProbA, drawProb } = calculateMatchOutcomes(effectiveRatingA, effectiveRatingB, {
    allowsDraw: true,
  });

  const roll = Math.random();

  let scoreA = 0;
  let scoreB = 0;

  if (roll < winProbA) {
    // Idol A Wins
    if (delta >= 22) {
      // Dominant blowout win
      const scRoll = Math.random();
      if (scRoll < 0.35) { scoreA = 3; scoreB = 0; }
      else if (scRoll < 0.65) { scoreA = 4; scoreB = 0; }
      else if (scRoll < 0.85) { scoreA = 3; scoreB = 1; }
      else if (scRoll < 0.95) { scoreA = 4; scoreB = 1; }
      else { scoreA = 2; scoreB = 0; }
    } else if (delta >= 10) {
      // Solid comfortable win
      const scRoll = Math.random();
      if (scRoll < 0.35) { scoreA = 2; scoreB = 0; }
      else if (scRoll < 0.65) { scoreA = 3; scoreB = 1; }
      else if (scRoll < 0.85) { scoreA = 2; scoreB = 1; }
      else if (scRoll < 0.95) { scoreA = 3; scoreB = 0; }
      else { scoreA = 4; scoreB = 2; }
    } else {
      // Tight / Competitive win (close matches often 1-0, 2-1, 3-2)
      const scRoll = Math.random();
      if (scRoll < 0.45) { scoreA = 2; scoreB = 1; }
      else if (scRoll < 0.75) { scoreA = 1; scoreB = 0; }
      else if (scRoll < 0.90) { scoreA = 3; scoreB = 2; }
      else { scoreA = 2; scoreB = 0; }
    }
  } else if (roll < winProbA + drawProb) {
    // Match ends in a Draw
    const avgRating = (effectiveRatingA + effectiveRatingB) / 2;
    const scRoll = Math.random();
    if (avgRating >= 82) {
      // High rating matches often produce high quality 1-1 or 2-2 draws
      if (scRoll < 0.50) { scoreA = 1; scoreB = 1; }
      else if (scRoll < 0.85) { scoreA = 2; scoreB = 2; }
      else { scoreA = 0; scoreB = 0; }
    } else {
      if (scRoll < 0.55) { scoreA = 1; scoreB = 1; }
      else if (scRoll < 0.85) { scoreA = 0; scoreB = 0; }
      else { scoreA = 2; scoreB = 2; }
    }
  } else {
    // Idol B Wins
    const negDelta = effectiveRatingB - effectiveRatingA;
    if (negDelta >= 22) {
      const scRoll = Math.random();
      if (scRoll < 0.35) { scoreA = 0; scoreB = 3; }
      else if (scRoll < 0.65) { scoreA = 0; scoreB = 4; }
      else if (scRoll < 0.85) { scoreA = 1; scoreB = 3; }
      else if (scRoll < 0.95) { scoreA = 1; scoreB = 4; }
      else { scoreA = 0; scoreB = 2; }
    } else if (negDelta >= 10) {
      const scRoll = Math.random();
      if (scRoll < 0.35) { scoreA = 0; scoreB = 2; }
      else if (scRoll < 0.65) { scoreA = 1; scoreB = 3; }
      else if (scRoll < 0.85) { scoreA = 1; scoreB = 2; }
      else if (scRoll < 0.95) { scoreA = 0; scoreB = 3; }
      else { scoreA = 2; scoreB = 4; }
    } else {
      const scRoll = Math.random();
      if (scRoll < 0.45) { scoreA = 1; scoreB = 2; }
      else if (scRoll < 0.75) { scoreA = 0; scoreB = 1; }
      else if (scRoll < 0.90) { scoreA = 2; scoreB = 3; }
      else { scoreA = 0; scoreB = 2; }
    }
  }

  let winnerId: string | null = null;
  if (scoreA > scoreB) winnerId = idolA?.id || 'A';
  else if (scoreB > scoreA) winnerId = idolB?.id || 'B';

  return { scoreA, scoreB, winnerId };
}

/**
 * Simulates a multi-game series (Best of 3, 5, 7, 9) between two competitors.
 * In a series, each individual game's win probability is influenced by the rating differential
 * with a subtle momentum factor as games unfold.
 */
export function simulateSeriesMatches(
  ratingA: number,
  ratingB: number,
  targetWins: number
): { scoreA: number; scoreB: number; winnerIdIsA: boolean } {
  const baseProbA = calculateRatingWinProbability(ratingA, ratingB);
  let scoreA = 0;
  let scoreB = 0;

  while (scoreA < targetWins && scoreB < targetWins) {
    // Apply slight momentum adjustment (+2% per game lead)
    const momentum = (scoreA - scoreB) * 0.02;
    const gameProbA = Math.max(0.02, Math.min(0.98, baseProbA + momentum));

    if (Math.random() < gameProbA) {
      scoreA++;
    } else {
      scoreB++;
    }
  }

  return {
    scoreA,
    scoreB,
    winnerIdIsA: scoreA >= targetWins,
  };
}

/**
 * Auto-calculates an idol's rating (0-100) from their career win rate, championships, and match experience
 */
export function calculateDynamicRatingFromStats(stat: {
  wins: number;
  matches: number;
  winRate: number;
  championships?: number;
  seed?: string;
}): number {
  if (!stat.matches || stat.matches === 0) {
    return getDefaultIdolRating(stat.seed);
  }

  // Base on win rate (e.g. 60% win rate -> ~72 rating)
  const baseWinRate = Math.min(100, Math.max(0, stat.winRate));
  
  // Rating starts around 50 + (winRate * 0.45)
  let calculated = 50 + (baseWinRate * 0.45);

  // Bonus for match sample size (confidence multiplier up to +5)
  const experienceBonus = Math.min(5, (stat.matches / 20) * 5);
  calculated += experienceBonus;

  // Bonus for championships (+3 per title, capped at +10)
  if (stat.championships && stat.championships > 0) {
    calculated += Math.min(10, stat.championships * 3.5);
  }

  return Math.max(25, Math.min(99, Math.round(calculated)));
}

/**
 * Performance metrics for an individual idol across seasons or in a specific season
 */
export interface SeasonPerformanceRecord {
  seasonId: number | string;
  seasonName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0-100%
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  groupMatches: number;
  groupWins: number;
  groupLosses: number;
  groupDraws: number;
  knockoutMatches: number;
  knockoutWins: number;
  knockoutLosses: number;
  deepestKnockoutStage?: string;
  leagueMatches: number;
  leagueWins: number;
  leagueLosses: number;
  leagueDraws: number;
  finishTitle?: string; // 'Champion' | 'Runner-Up' | 'Third Place' | 'Semi-Finalist' | 'Quarter-Finalist' | 'Round of 16' | 'Round of 32' | 'Group Stage'
  leagueDiv?: number;
  leagueRank?: number;
  isLeagueChampion?: boolean;
  isLeaguePodium?: boolean;
  isChampionsQualifier?: boolean;
  isBottomFinish?: boolean;
}

/**
 * Result of progression evaluation for a single idol
 */
export interface SeasonProgressionItem {
  idolId: string;
  idolName: string;
  girlGroup: string;
  seed?: string;
  photoUrl?: string;
  previousRating: number;
  newRating: number;
  delta: number;
  previousTier: RatingTierInfo;
  newTier: RatingTierInfo;
  performance: SeasonPerformanceRecord | null;
  reasons: string[];
}

/**
 * Available season option for progression review
 */
export interface ProgressionSeasonOption {
  id: string | number;
  name: string;
  matchCount: number;
  type: 'tournament' | 'league' | 'active' | 'all';
}

/**
 * Overall summary across the roster for seasonal progression update
 */
export interface SeasonProgressionAnalysis {
  seasonId: number | string;
  seasonName: string;
  totalIdols: number;
  activeParticipants: number;
  risersCount: number;
  fallersCount: number;
  steadyCount: number;
  averageDelta: number;
  items: SeasonProgressionItem[];
  availableSeasons: ProgressionSeasonOption[];
  hasMatches: boolean;
}

/**
 * Core Algorithm for Realistic Seasonal Progression:
 * Calculates organic, balanced rating adjustments (-4 to +4 pts max per season).
 * Incorporates:
 * 1. Elo-calibrated Win Rate vs Tier Expectation (e.g., S+ 95 rating expects ~84% win rate, B 75 rating expects 50%)
 * 2. Asymmetric Scaling:
 *    - Higher ratings face heavy diminishing returns on growth (hard to climb at 90+)
 *    - Higher ratings are more fragile to losing points when underperforming or suffering early exits
 *    - Underdogs (<70) have high upside on breakthrough runs and are protected against severe drops
 * 3. Match Volume Confidence (scales impact smoothly with sample size)
 * 4. Multi-Source Integration: Group Stages, Knockouts, and League Divisions
 * 5. Milestone adjustments (Tournament Champion, Runner-Up, Semis, Quarters, League Championship, Podium & Qualification)
 * 6. Gentle regression to mean (74) to prevent long-term runaway inflation/deflation
 */
export function calculateSeasonalProgressionRating(
  currentRating: number,
  perf: SeasonPerformanceRecord | null
): { newRating: number; delta: number; reasons: string[] } {
  const cur = Math.max(0, Math.min(100, Math.round(currentRating)));
  if (!perf || perf.matchesPlayed === 0) {
    return {
      newRating: cur,
      delta: 0,
      reasons: ['No active match participation in analyzed season — rating maintained.'],
    };
  }

  const reasons: string[] = [];
  let rawDelta = 0;

  // 1. Elo-calibrated Expected Win Rate based on current rating
  // Continuous logistic expectation curve with base center at rating 74
  // E.g.
  // 95 rating -> ~83.8% expected win rate
  // 90 rating -> ~77.5% expected win rate
  // 85 rating -> ~69.9% expected win rate
  // 80 rating -> ~60.5% expected win rate
  // 75 rating -> ~50.0% expected win rate
  // 65 rating -> ~30.0% expected win rate
  // 55 rating -> ~15.0% expected win rate
  const expectedWinRate = 1 / (1 + Math.pow(10, (74 - cur) / 28));
  
  // Actual win rate counting draws as 0.5 win
  const effectiveWins = perf.wins + 0.5 * (perf.draws || 0);
  const actualWinRate = effectiveWins / perf.matchesPlayed;
  const winRateDiff = actualWinRate - expectedWinRate;

  // 2. Asymmetric Difficulty & Fragility factors
  // Growth Resistance: As rating rises above 75, gaining rating becomes exponentially harder
  // Fragility Multiplier: As rating rises above 75, losing to lower seeds or underperforming penalizes more severely
  let growthFactor = 1.0;
  let fragilityFactor = 1.0;

  if (cur >= 75) {
    // Top tier growth resistance: at 95 it is ~0.18, at 90 ~0.28, at 85 ~0.45, at 80 ~0.70
    growthFactor = Math.max(0.18, Math.pow((101 - cur) / 26, 1.35));
    // Top tier fragility: at 95 it is ~1.65, at 90 ~1.50, at 85 ~1.35, at 80 ~1.20
    fragilityFactor = Math.min(1.65, 1.0 + ((cur - 75) / 20) * 0.65);
  } else {
    // Underdog growth acceleration (room to blossom): at 55 it is ~1.40
    growthFactor = Math.min(1.50, 1.0 + ((75 - cur) / 50));
    // Underdog protection (expected to lose to top seeds, so drops are mild)
    fragilityFactor = Math.max(0.50, 1.0 - ((75 - cur) / 50) * 0.50);
  }

  // 3. Sample Size / Confidence Weight
  // If only 1-2 matches played, avoid huge swings; at 8+ matches full confidence is applied
  const confidence = Math.min(1.0, Math.sqrt(perf.matchesPlayed / 8));

  // 4. Base Performance Delta from Match Results (Win Rate vs Expectation)
  let winRateDelta = 0;
  if (winRateDiff >= 0) {
    winRateDelta = winRateDiff * 3.0 * growthFactor * confidence;
    if (winRateDelta >= 0.25) {
      reasons.push(
        `Form (${perf.wins}W-${perf.losses}L${perf.draws ? `-${perf.draws}D` : ''}, ${(actualWinRate * 100).toFixed(0)}% vs ${(expectedWinRate * 100).toFixed(0)}% expected): +${winRateDelta.toFixed(1)}${cur >= 85 ? ` (Growth dampened at ${cur} rating)` : ''}`
      );
    }
  } else {
    winRateDelta = winRateDiff * 3.0 * fragilityFactor * confidence;
    if (winRateDelta <= -0.25) {
      reasons.push(
        `Underperformed (${perf.wins}W-${perf.losses}L${perf.draws ? `-${perf.draws}D` : ''}, ${(actualWinRate * 100).toFixed(0)}% vs ${(expectedWinRate * 100).toFixed(0)}% expected): ${winRateDelta.toFixed(1)}${cur >= 85 ? ` (High-tier fragility applied)` : ''}`
      );
    }
  }
  rawDelta += winRateDelta;

  // 5. Tournament Knockout & Playoff Milestone Adjustments
  if (perf.finishTitle) {
    const f = perf.finishTitle.toLowerCase();
    if (f.includes('champion') && !f.includes('league')) {
      const champBonus = 1.6 * growthFactor;
      rawDelta += champBonus;
      reasons.push(`Tournament Champion bonus: +${champBonus.toFixed(1)}`);
    } else if (f.includes('runner-up') || f.includes('grand final')) {
      const ruBonus = 1.1 * growthFactor;
      rawDelta += ruBonus;
      reasons.push(`Grand Finalist / Runner-Up bonus: +${ruBonus.toFixed(1)}`);
    } else if (f.includes('third') || f.includes('semi')) {
      const semiBonus = 0.7 * growthFactor;
      rawDelta += semiBonus;
      reasons.push(`Semi-Finals podium finish: +${semiBonus.toFixed(1)}`);
    } else if (f.includes('quarter')) {
      const qfBonus = 0.35 * growthFactor;
      rawDelta += qfBonus;
      reasons.push(`Quarter-Finals playoff run: +${qfBonus.toFixed(1)}`);
    } else if (f.includes('round of 16') || f.includes('r16')) {
      const r16Bonus = 0.15 * growthFactor;
      rawDelta += r16Bonus;
      reasons.push(`Round of 16 playoff appearance: +${r16Bonus.toFixed(1)}`);
    }
  }

  // Knockout match performance bonus
  if (perf.knockoutMatches > 0 && perf.knockoutWins > 0) {
    const koWinBonus = Math.min(0.8, perf.knockoutWins * 0.25 * growthFactor);
    rawDelta += koWinBonus;
    if (koWinBonus >= 0.2) {
      reasons.push(`Knockout stage victories (${perf.knockoutWins}W): +${koWinBonus.toFixed(1)}`);
    }
  }

  // Group Stage elimination penalty if high seed failed to qualify
  if (perf.groupMatches >= 3 && perf.knockoutMatches === 0 && !perf.finishTitle?.includes('Champion') && !perf.finishTitle?.includes('Semi')) {
    if (cur >= 85 && actualWinRate < 0.50) {
      const groupExitPenalty = 0.6 * fragilityFactor;
      rawDelta -= groupExitPenalty;
      reasons.push(`High-tier Group Stage early exit penalty: -${groupExitPenalty.toFixed(1)}`);
    }
  }

  // 6. League Division Performance Adjustments
  if (perf.isLeagueChampion) {
    const lChampBonus = 1.4 * growthFactor;
    rawDelta += lChampBonus;
    reasons.push(`League Division Champion: +${lChampBonus.toFixed(1)}`);
  } else if (perf.isLeaguePodium) {
    const podiumBonus = 0.8 * growthFactor;
    rawDelta += podiumBonus;
    reasons.push(`League Top-3 Podium Finish: +${podiumBonus.toFixed(1)}`);
  } else if (perf.isChampionsQualifier) {
    const qualBonus = 0.5 * growthFactor;
    rawDelta += qualBonus;
    reasons.push(`Champions Tournament Qualified (Top 5): +${qualBonus.toFixed(1)}`);
  } else if (perf.isBottomFinish && perf.winRate < 35) {
    const strugglePenalty = 0.6 * fragilityFactor;
    rawDelta -= strugglePenalty;
    reasons.push(`League lower-table underperformance: -${strugglePenalty.toFixed(1)}`);
  }

  // 7. Subtle Natural Regression to Mean (74)
  const regression = (74 - cur) * 0.016;
  rawDelta += regression;

  // 8. Hard clamping for realistic seasonal progression (-4 to +4 pts max)
  // Higher ratings have a tighter positive ceiling (+2 to +3 max) but can drop -3 to -4 if they collapsed
  const maxGain = cur >= 92 ? 2 : cur >= 85 ? 3 : 4;
  const maxLoss = cur >= 85 ? -4 : cur >= 70 ? -3.5 : -2.5;

  const clampedDelta = Math.max(maxLoss, Math.min(maxGain, rawDelta));
  const roundedNewRating = Math.max(35, Math.min(99, Math.round(cur + clampedDelta)));
  const finalDelta = roundedNewRating - cur;

  if (reasons.length === 0) {
    reasons.push(`Consistent performance maintained rating (${perf.wins}W-${perf.losses}L).`);
  }

  return {
    newRating: roundedNewRating,
    delta: finalDelta,
    reasons,
  };
}

/**
 * Analyzes seasons across tournament archives, match database, and league records
 * to generate a comprehensive progression report for all idols.
 * Incorporates:
 * - Tournament Group Stages
 * - Tournament Knockouts (Grand Finals, Semis, Quarters, etc.)
 * - League Divisions (All 38 matchdays across 6 leagues)
 */
export function buildSeasonProgressionAnalysis(
  idols: Idol[],
  archives: TournamentArchive[] = [],
  matchDatabase: ArchivedMatch[] = [],
  leagueArchives: LeagueSeasonArchive[] = [],
  leagueState?: LeagueSeasonState | null,
  currentGroups?: Group[],
  currentKnockoutMatches?: KnockoutMatch[],
  currentConfig?: TournamentConfig,
  selectedSeasonId?: number | string | 'ALL'
): SeasonProgressionAnalysis {
  // 1. Discover all available seasons across all systems
  const availableSeasons: ProgressionSeasonOption[] = [];
  const seasonMatchCountMap = new Map<string, number>();

  // Safe arrays
  const safeMatchDb = matchDatabase || [];
  const safeArchives = archives || [];
  const safeLeagueArchives = leagueArchives || [];

  // Check matchDatabase
  safeMatchDb.forEach((m) => {
    const sId = String(m.seasonId || '1');
    seasonMatchCountMap.set(sId, (seasonMatchCountMap.get(sId) || 0) + 1);
  });

  // Check tournament archives
  safeArchives.forEach((arch) => {
    const sId = String(arch.seasonId);
    let count = 0;
    arch.groups?.forEach((g) => {
      count += g.matches?.filter((m) => m.completed).length || 0;
    });
    count += arch.knockoutMatches?.filter((m) => m.completed).length || 0;
    seasonMatchCountMap.set(sId, Math.max(seasonMatchCountMap.get(sId) || 0, count));
    if (!availableSeasons.some((opt) => String(opt.id) === sId)) {
      availableSeasons.push({
        id: arch.seasonId,
        name: arch.seasonName || `Tournament Season ${arch.seasonId}`,
        matchCount: count,
        type: 'tournament',
      });
    }
  });

  // Check league archives
  safeLeagueArchives.forEach((la) => {
    const sId = String(la.seasonNumber);
    const count = la.allMatches?.filter((m) => m.completed).length || 0;
    seasonMatchCountMap.set(sId, (seasonMatchCountMap.get(sId) || 0) + count);
    if (!availableSeasons.some((opt) => String(opt.id) === sId)) {
      availableSeasons.push({
        id: la.seasonNumber,
        name: `League Season ${la.seasonNumber}`,
        matchCount: count,
        type: 'league',
      });
    }
  });

  // Check active tournament
  let activeTournamentMatchCount = 0;
  currentGroups?.forEach((g) => {
    activeTournamentMatchCount += g.matches?.filter((m) => m.completed).length || 0;
  });
  currentKnockoutMatches?.forEach((m) => {
    if (m.completed) activeTournamentMatchCount++;
  });

  const activeSeasonId = currentConfig?.seasonId || currentConfig?.seasonNumber || 1;
  if (activeTournamentMatchCount > 0 && !availableSeasons.some((opt) => String(opt.id) === String(activeSeasonId))) {
    availableSeasons.push({
      id: activeSeasonId,
      name: `${currentConfig?.seasonName || `Season ${activeSeasonId}`} (Active)`,
      matchCount: activeTournamentMatchCount,
      type: 'active',
    });
  }

  // Add "All Completed Seasons" option if there are multiple seasons
  if (availableSeasons.length > 1 || safeMatchDb.length > 0) {
    availableSeasons.unshift({
      id: 'ALL',
      name: 'Combined All-Time / Latest Cycle',
      matchCount: safeMatchDb.length,
      type: 'all',
    });
  }

  // 2. Determine target season to analyze
  let targetSeasonId: number | string = 'ALL';
  let targetSeasonName = 'Latest Performance Cycle';

  if (selectedSeasonId !== undefined) {
    targetSeasonId = selectedSeasonId;
    if (selectedSeasonId === 'ALL') {
      targetSeasonName = 'Combined All Matches (Tournament + League)';
    } else {
      const matchOpt = availableSeasons.find((opt) => String(opt.id) === String(selectedSeasonId));
      targetSeasonName = matchOpt?.name || `Season ${selectedSeasonId}`;
    }
  } else {
    // Default to most recent tournament or league archive
    if (archives && archives.length > 0) {
      const latestArch = archives[archives.length - 1];
      targetSeasonId = latestArch?.seasonId ?? 'ALL';
      targetSeasonName = latestArch?.seasonName || `Season ${latestArch?.seasonId || 1}`;
    } else if (leagueArchives && leagueArchives.length > 0) {
      const latestLeague = leagueArchives[leagueArchives.length - 1];
      targetSeasonId = latestLeague?.seasonNumber ?? 'ALL';
      targetSeasonName = `League Season ${latestLeague?.seasonNumber || 1}`;
    } else if (activeTournamentMatchCount > 0) {
      targetSeasonId = activeSeasonId;
      targetSeasonName = `${currentConfig?.seasonName || `Season ${activeSeasonId}`} (Active)`;
    } else {
      targetSeasonId = 'ALL';
      targetSeasonName = 'Combined Season Performance';
    }
  }

  const sIdStr = String(targetSeasonId);
  const isAllMode = targetSeasonId === 'ALL';

  // 3. Consolidated Performance Map
  const idolPerfMap = new Map<string, {
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    gamesFor: number;
    gamesAgainst: number;
    groupMatches: number;
    groupWins: number;
    groupLosses: number;
    groupDraws: number;
    knockoutMatches: number;
    knockoutWins: number;
    knockoutLosses: number;
    deepestKnockoutStage?: string;
    leagueMatches: number;
    leagueWins: number;
    leagueLosses: number;
    leagueDraws: number;
    finishTitle?: string;
    leagueDiv?: number;
    leagueRank?: number;
    isLeagueChampion?: boolean;
    isLeaguePodium?: boolean;
    isChampionsQualifier?: boolean;
    isBottomFinish?: boolean;
  }>();

  const getEntry = (id: string) => {
    if (!idolPerfMap.has(id)) {
      idolPerfMap.set(id, {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        groupMatches: 0,
        groupWins: 0,
        groupLosses: 0,
        groupDraws: 0,
        knockoutMatches: 0,
        knockoutWins: 0,
        knockoutLosses: 0,
        leagueMatches: 0,
        leagueWins: 0,
        leagueLosses: 0,
        leagueDraws: 0,
      });
    }
    return idolPerfMap.get(id)!;
  };

  // Helper to record any completed match
  const recordMatch = (
    idolAId: string,
    idolBId: string,
    scoreA: number | null,
    scoreB: number | null,
    winnerId: string | null,
    isDraw: boolean,
    matchType: 'group' | 'knockout' | 'league',
    stageName?: string
  ) => {
    if (scoreA === null || scoreB === null || !idolAId || !idolBId) return;

    const entryA = getEntry(idolAId);
    const entryB = getEntry(idolBId);

    entryA.matchesPlayed++;
    entryB.matchesPlayed++;

    entryA.gamesFor += scoreA;
    entryA.gamesAgainst += scoreB;
    entryB.gamesFor += scoreB;
    entryB.gamesAgainst += scoreA;

    const decidedDraw = isDraw || scoreA === scoreB;
    const isWinnerA = !decidedDraw && (winnerId === idolAId || scoreA > scoreB);
    const isWinnerB = !decidedDraw && (winnerId === idolBId || scoreB > scoreA);

    if (matchType === 'group') {
      entryA.groupMatches++;
      entryB.groupMatches++;
      if (decidedDraw) {
        entryA.draws++; entryA.groupDraws++;
        entryB.draws++; entryB.groupDraws++;
      } else if (isWinnerA) {
        entryA.wins++; entryA.groupWins++;
        entryB.losses++; entryB.groupLosses++;
      } else {
        entryB.wins++; entryB.groupWins++;
        entryA.losses++; entryA.groupLosses++;
      }
    } else if (matchType === 'knockout') {
      entryA.knockoutMatches++;
      entryB.knockoutMatches++;
      if (isWinnerA) {
        entryA.wins++; entryA.knockoutWins++;
        entryB.losses++; entryB.knockoutLosses++;
      } else {
        entryB.wins++; entryB.knockoutWins++;
        entryA.losses++; entryA.knockoutLosses++;
      }
      if (stageName) {
        entryA.deepestKnockoutStage = stageName;
        entryB.deepestKnockoutStage = stageName;
      }
    } else {
      // League match
      entryA.leagueMatches++;
      entryB.leagueMatches++;
      if (decidedDraw) {
        entryA.draws++; entryA.leagueDraws++;
        entryB.draws++; entryB.leagueDraws++;
      } else if (isWinnerA) {
        entryA.wins++; entryA.leagueWins++;
        entryB.losses++; entryB.leagueLosses++;
      } else {
        entryB.wins++; entryB.leagueWins++;
        entryA.losses++; entryA.leagueLosses++;
      }
    }
  };

  // 4. Ingest matchDatabase matches
  const processedMatchKeys = new Set<string>();

  matchDatabase.forEach((m) => {
    if (!isAllMode && String(m.seasonId || '') !== sIdStr) return;
    const key = `db_${m.matchId || `${m.seasonId}_${m.idolAId}_${m.idolBId}_${m.stage}`}`;
    if (processedMatchKeys.has(key)) return;
    processedMatchKeys.add(key);

    const isGroup = (m.stage || '').toLowerCase().includes('group');
    const isLeague = (m.stage || '').toLowerCase().includes('league') || (m.stage || '').toLowerCase().includes('md ');
    const matchType = isLeague ? 'league' : isGroup ? 'group' : 'knockout';

    recordMatch(
      m.idolAId,
      m.idolBId,
      m.scoreA,
      m.scoreB,
      m.winnerId,
      !!m.isDraw,
      matchType,
      m.stage
    );
  });

  // 5. Ingest Active Tournament Matches (if active or ALL mode)
  if (isAllMode || String(activeSeasonId) === sIdStr) {
    currentGroups?.forEach((g) => {
      g.matches?.forEach((m) => {
        if (!m.completed || m.scoreA === null || m.scoreB === null) return;
        const key = `act_g_${activeSeasonId}_${g.id}_${m.id}`;
        if (processedMatchKeys.has(key)) return;
        processedMatchKeys.add(key);

        recordMatch(
          m.idolAId,
          m.idolBId,
          m.scoreA,
          m.scoreB,
          m.winnerId,
          m.scoreA === m.scoreB,
          'group',
          `Group ${g.name}`
        );
      });
    });

    currentKnockoutMatches?.forEach((m) => {
      if (!m.completed || !m.idolAId || !m.idolBId || m.scoreA === null || m.scoreB === null) return;
      const key = `act_ko_${activeSeasonId}_${m.id}`;
      if (processedMatchKeys.has(key)) return;
      processedMatchKeys.add(key);

      recordMatch(
        m.idolAId,
        m.idolBId,
        m.scoreA,
        m.scoreB,
        m.winnerId,
        false,
        'knockout',
        m.roundName || 'Knockout Stage'
      );
    });
  }

  // 6. Ingest Active League Matches
  if (leagueState && (isAllMode || String(leagueState.seasonNumber || '1') === sIdStr)) {
    leagueState.leagues?.forEach((l) => {
      l.matches?.forEach((m) => {
        if (!m.completed || m.scoreA === null || m.scoreB === null) return;
        const key = `act_lg_${leagueState.seasonNumber || '1'}_div${l.id}_${m.id}`;
        if (processedMatchKeys.has(key)) return;
        processedMatchKeys.add(key);

        recordMatch(
          m.idolAId,
          m.idolBId,
          m.scoreA,
          m.scoreB,
          m.winnerId,
          m.scoreA === m.scoreB,
          'league',
          l.name
        );
      });

      // Also ingest standings
      l.standings?.forEach((st) => {
        if (!st || !st.idolId) return;
        const entry = getEntry(st.idolId);
        entry.leagueDiv = l.id;
        entry.leagueRank = st.rank;
        if (st.rank === 1 && (st.played || 0) >= 10) entry.isLeagueChampion = true;
        if (st.rank <= 3) entry.isLeaguePodium = true;
        if (st.rank <= 5) entry.isChampionsQualifier = true;
        if (st.rank >= 18) entry.isBottomFinish = true;
      });
    });
  }

  // 7. Inject Tournament Archive Finishes
  const relevantArchives = isAllMode ? archives : archives.filter((a) => String(a.seasonId) === sIdStr);
  relevantArchives.forEach((arch) => {
    if (arch.championId) getEntry(arch.championId).finishTitle = 'Champion';
    if (arch.runnerUpId) getEntry(arch.runnerUpId).finishTitle = 'Runner-Up';
    if (arch.thirdPlaceId) getEntry(arch.thirdPlaceId).finishTitle = 'Third Place';
    if (arch.fourthPlaceId) getEntry(arch.fourthPlaceId).finishTitle = 'Semi-Finalist';

    arch.knockoutMatches?.forEach((km) => {
      if (!km.completed) return;
      const rName = (km.roundName || '').toLowerCase();
      if (rName.includes('semi')) {
        if (km.idolAId && !getEntry(km.idolAId).finishTitle) getEntry(km.idolAId).finishTitle = 'Semi-Finalist';
        if (km.idolBId && !getEntry(km.idolBId).finishTitle) getEntry(km.idolBId).finishTitle = 'Semi-Finalist';
      } else if (rName.includes('quarter')) {
        if (km.idolAId && !getEntry(km.idolAId).finishTitle) getEntry(km.idolAId).finishTitle = 'Quarter-Finalist';
        if (km.idolBId && !getEntry(km.idolBId).finishTitle) getEntry(km.idolBId).finishTitle = 'Quarter-Finalist';
      }
    });
  });

  // 8. Inject League Archive Standings
  const relevantLeagueArchives = isAllMode ? leagueArchives : leagueArchives.filter((la) => String(la.seasonNumber) === sIdStr);
  relevantLeagueArchives.forEach((la) => {
    la.leagueWinners?.forEach((w) => {
      if (w.championId) {
        const entry = getEntry(w.championId);
        entry.isLeagueChampion = true;
      }
    });

    if (la.allStandings) {
      Object.entries(la.allStandings).forEach(([leagueIdStr, standings]) => {
        const lId = Number(leagueIdStr);
        standings?.forEach((st) => {
          const entry = getEntry(st.idolId);
          entry.leagueDiv = lId;
          entry.leagueRank = st.rank;
          if (st.rank === 1) entry.isLeagueChampion = true;
          if (st.rank <= 3) entry.isLeaguePodium = true;
          if (st.rank <= 5) entry.isChampionsQualifier = true;
          if (st.rank >= 18) entry.isBottomFinish = true;
        });
      });
    }
  });

  // 9. Compute items and aggregated metrics
  let risersCount = 0;
  let fallersCount = 0;
  let steadyCount = 0;
  let totalDeltaSum = 0;
  let activeParticipants = 0;

  const items: SeasonProgressionItem[] = idols.map((idol) => {
    const curRating = getIdolRating(idol);
    const rawPerf = idolPerfMap.get(idol.id);

    let perfRecord: SeasonPerformanceRecord | null = null;
    if (rawPerf && rawPerf.matchesPlayed > 0) {
      activeParticipants++;
      const wr = (rawPerf.wins / rawPerf.matchesPlayed) * 100;
      perfRecord = {
        seasonId: targetSeasonId,
        seasonName: targetSeasonName,
        matchesPlayed: rawPerf.matchesPlayed,
        wins: rawPerf.wins,
        losses: rawPerf.losses,
        draws: rawPerf.draws,
        winRate: wr,
        gamesFor: rawPerf.gamesFor,
        gamesAgainst: rawPerf.gamesAgainst,
        gameDiff: rawPerf.gamesFor - rawPerf.gamesAgainst,
        groupMatches: rawPerf.groupMatches,
        groupWins: rawPerf.groupWins,
        groupLosses: rawPerf.groupLosses,
        groupDraws: rawPerf.groupDraws,
        knockoutMatches: rawPerf.knockoutMatches,
        knockoutWins: rawPerf.knockoutWins,
        knockoutLosses: rawPerf.knockoutLosses,
        deepestKnockoutStage: rawPerf.deepestKnockoutStage,
        leagueMatches: rawPerf.leagueMatches,
        leagueWins: rawPerf.leagueWins,
        leagueLosses: rawPerf.leagueLosses,
        leagueDraws: rawPerf.leagueDraws,
        finishTitle: rawPerf.finishTitle,
        leagueDiv: rawPerf.leagueDiv,
        leagueRank: rawPerf.leagueRank,
        isLeagueChampion: rawPerf.isLeagueChampion,
        isLeaguePodium: rawPerf.isLeaguePodium,
        isChampionsQualifier: rawPerf.isChampionsQualifier,
        isBottomFinish: rawPerf.isBottomFinish,
      };
    }

    const { newRating, delta, reasons } = calculateSeasonalProgressionRating(curRating, perfRecord);

    if (delta > 0) risersCount++;
    else if (delta < 0) fallersCount++;
    else steadyCount++;

    totalDeltaSum += delta;

    return {
      idolId: idol.id,
      idolName: idol.name,
      girlGroup: idol.girlGroup,
      seed: idol.seed,
      photoUrl: idol.photoUrl,
      previousRating: curRating,
      newRating,
      delta,
      previousTier: getRatingTierInfo(curRating),
      newTier: getRatingTierInfo(newRating),
      performance: perfRecord,
      reasons,
    };
  });

  const averageDelta = idols.length > 0 ? Number((totalDeltaSum / idols.length).toFixed(2)) : 0;

  return {
    seasonId: targetSeasonId,
    seasonName: targetSeasonName,
    totalIdols: idols.length,
    activeParticipants,
    risersCount,
    fallersCount,
    steadyCount,
    averageDelta,
    items,
    availableSeasons,
    hasMatches: processedMatchKeys.size > 0 || activeParticipants > 0,
  };
}



/**
 * v4 format: Best of 4. Four games are always played, so the result is 4-0, 3-1, 2-2 (draw), 1-3 or 0-4.
 * Each game uses the same rating win curve as the rest of the engine.
 */
export function simulateBo4Score(ratingA: number, ratingB: number): { scoreA: number; scoreB: number } {
  const p = calculateRatingWinProbability(ratingA, ratingB);
  let scoreA = 0;
  let scoreB = 0;
  for (let g = 0; g < 4; g++) {
    if (Math.random() < p) scoreA++;
    else scoreB++;
  }
  return { scoreA, scoreB };
}

/**
 * League matchday, The Idols phase 1, group stage and LCQ simulation (Best of 4, draws allowed).
 * Applies form modifiers and a small matchday variance, then plays 4 games.
 */
export function simulateLeagueMatchScore(
  idolA?: Partial<Idol> | null,
  idolB?: Partial<Idol> | null,
  formHistoryA?: Array<'W' | 'D' | 'L'>,
  formHistoryB?: Array<'W' | 'D' | 'L'>
): { scoreA: number; scoreB: number; winnerId: string | null } {
  let rA = getIdolRating(idolA);
  let rB = getIdolRating(idolB);
  if (formHistoryA && formHistoryA.length > 0) rA = Math.max(25, Math.min(99, rA + calculateIdolForm(formHistoryA).ratingModifier));
  if (formHistoryB && formHistoryB.length > 0) rB = Math.max(25, Math.min(99, rB + calculateIdolForm(formHistoryB).ratingModifier));
  const variance = (Math.random() - Math.random()) * 2.0;
  const { scoreA, scoreB } = simulateBo4Score(rA + variance, rB);
  let winnerId: string | null = null;
  if (scoreA > scoreB) winnerId = idolA?.id || 'A';
  else if (scoreB > scoreA) winnerId = idolB?.id || 'B';
  return { scoreA, scoreB, winnerId };
}
