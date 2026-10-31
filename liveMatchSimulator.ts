import { Idol, LeagueMatch } from '../types';
import { getIdolRating } from './ratingHelper';
import { calculateIdolForm, FormDetails } from './formHelper';

export type LiveEventType =
  | 'kickoff'
  | 'goal'
  | 'save'
  | 'shot_miss'
  | 'momentum_surge'
  | 'signature_move'
  | 'foul'
  | 'half_time'
  | 'second_half_kickoff'
  | 'full_time';

export interface MatchLiveEvent {
  id: string;
  minute: number;
  type: LiveEventType;
  idolId?: string;
  idolName?: string;
  girlGroup?: string;
  team: 'A' | 'B' | 'neutral';
  scoreA: number;
  scoreB: number;
  title: string;
  description: string;
  momentumShift: number; // e.g. +25 or -25
  soundCue?: 'goal' | 'save' | 'whistle' | 'cheer' | 'kick';
}

export interface MatchLiveStats {
  shotsA: number;
  shotsB: number;
  shotsOnTargetA: number;
  shotsOnTargetB: number;
  savesA: number;
  savesB: number;
  possessionPctA: number;
  possessionPctB: number;
  highNotesA: number;
  highNotesB: number;
  foulsA: number;
  foulsB: number;
  cornersA: number;
  cornersB: number;
}

export interface MinuteTimelineFrame {
  minute: number;
  phase: 'first_half' | 'stoppage_1' | 'half_time' | 'second_half' | 'stoppage_2' | 'full_time';
  scoreA: number;
  scoreB: number;
  possession: 'A' | 'B' | 'neutral';
  momentum: number; // -100 (Full B dominance) to +100 (Full A dominance)
  event: MatchLiveEvent | null;
  stats: MatchLiveStats;
}

export interface PreGeneratedMatchSimulation {
  matchId: string;
  idolA: Idol;
  idolB: Idol;
  formA: FormDetails;
  formB: FormDetails;
  effectiveRatingA: number;
  effectiveRatingB: number;
  finalScoreA: number;
  finalScoreB: number;
  winnerId: string | null;
  frames: MinuteTimelineFrame[]; // Length ~96 frames (0 to 95 minutes)
  allEvents: MatchLiveEvent[];
  stoppageTime1: number;
  stoppageTime2: number;
}

// Sound effect asset removed
export class MatchAudioSynthesizer {
  public static playWhistle() {}
  public static playGoalFanfare() {}
  public static playSaveThump() {}
  public static playMomentumSurge() {}
}

// Commentary Flavor Generators
const GOAL_TEMPLATES_A = [
  (a: string, _b: string, gA: string) => `⚽ GOOOAAAL for ${a}! Masterful vocal counter-attack strikes the top corner! (${gA} pride on display!)`,
  (a: string, _b: string) => `⚽ UNBELIEVABLE FINISH by ${a}! Pinpoint choreo precision pierces the defensive line!`,
  (a: string, _b: string) => `⚽ WHAT A STRIKE! ${a} unleashes a signature climax phrase that leaves the keeper rooted!`,
  (a: string, _b: string) => `⚽ GOAL! ${a} capitalizes on stage momentum with a clinical volley into the bottom netting!`,
  (a: string, _b: string) => `⚽ SENSATIONAL GOAL! ${a} dribbles through two defenders and curls a beauty home!`,
];

const GOAL_TEMPLATES_B = [
  (_a: string, b: string, _gA: string, gB: string) => `⚽ GOOOAAAL for ${b}! Electrifying counter-attack rattles the back of the net! (${gB} faithful erupt!)`,
  (_a: string, b: string) => `⚽ CLINICAL FINISH by ${b}! Swift one-two passing and a deadly finish!`,
  (_a: string, b: string) => `⚽ GOAL! ${b} commands center stage with an unstoppable blast!`,
  (_a: string, b: string) => `⚽ SPECTACULAR! ${b} latches onto a loose ball and smashes it past the diving keeper!`,
  (_a: string, b: string) => `⚽ GOAL! Pure brilliance from ${b}! A majestic curling strike that clips the inside post and goes in!`,
];

const SAVE_TEMPLATES = [
  (keeper: string, shooter: string) => `🧤 MIRACLE SAVE! ${keeper} pulls off a fingertip deflection to deny ${shooter}'s thunderous shot!`,
  (keeper: string, shooter: string) => `🧤 GOAL-LINE STOP! ${keeper} reacts with cat-like reflexes to preserve the scoreline!`,
  (keeper: string, _shooter: string) => `🧤 SPECTACULAR DIVING SAVE by ${keeper}! Paws it away right at the bottom corner!`,
];

const HIGH_NOTE_TEMPLATES = [
  (idol: string) => `🔥 HIGH NOTE RESONANCE! ${idol} takes center stage, commanding massive crowd decibels and swinging momentum!`,
  (idol: string) => `⚡ VOCAL DECIBEL SURGE! ${idol} unleashes a flawless acoustic run, overpowering the opponent's defensive structure!`,
  (idol: string) => `🌟 SIGNATURE SOLO ROUTINE! ${idol} electrifies the arena with dazzling stage presence!`,
];

const MISS_TEMPLATES = [
  (shooter: string) => `🎯 OFF THE CROSSBAR! ${shooter}'s curling effort shakes the woodwork! What a chance!`,
  (shooter: string) => `🎯 INCHES WIDE! ${shooter} fires a low drive that whistles past the far post!`,
  (shooter: string) => `🎯 DANGEROUS ATTEMPT! ${shooter} finds space in the box but sends the header just over!`,
];

/**
 * Pre-generates the entire minute-by-minute simulation for a match
 */
export function generateMatchSimulation(
  matchId: string,
  idolA: Idol,
  idolB: Idol,
  formHistoryA: Array<'W' | 'D' | 'L'> = [],
  formHistoryB: Array<'W' | 'D' | 'L'> = []
): PreGeneratedMatchSimulation {
  const formA = calculateIdolForm(formHistoryA);
  const formB = calculateIdolForm(formHistoryB);

  const baseRatingA = getIdolRating(idolA);
  const baseRatingB = getIdolRating(idolB);

  const effectiveRatingA = Math.max(25, Math.min(99, Math.round(baseRatingA + formA.ratingModifier)));
  const effectiveRatingB = Math.max(25, Math.min(99, Math.round(baseRatingB + formB.ratingModifier)));

  const ratingDelta = effectiveRatingA - effectiveRatingB; // positive favors A

  // Base goal chances per minute with calibrated Elo scaling:
  // Expected goals per team ~1.1 to 2.5 depending on ratings and form
  const deltaFactor = Math.max(-0.015, Math.min(0.015, ratingDelta * 0.00055));
  const baseProbGoalA = Math.max(0.006, Math.min(0.040, (0.016 + deltaFactor) * (1 + formA.ratingModifier * 0.045)));
  const baseProbGoalB = Math.max(0.006, Math.min(0.040, (0.016 - deltaFactor) * (1 + formB.ratingModifier * 0.045)));

  const stoppageTime1 = Math.floor(Math.random() * 3) + 1; // 1 to 3 mins
  const stoppageTime2 = Math.floor(Math.random() * 4) + 2; // 2 to 5 mins

  const totalMinutes = 90 + stoppageTime2;
  const frames: MinuteTimelineFrame[] = [];
  const allEvents: MatchLiveEvent[] = [];

  let curScoreA = 0;
  let curScoreB = 0;
  let curMomentum = ratingDelta * 0.8; // initial slight tilt
  const stats: MatchLiveStats = {
    shotsA: 0,
    shotsB: 0,
    shotsOnTargetA: 0,
    shotsOnTargetB: 0,
    savesA: 0,
    savesB: 0,
    possessionPctA: 50,
    possessionPctB: 50,
    highNotesA: 0,
    highNotesB: 0,
    foulsA: 0,
    foulsB: 0,
    cornersA: 0,
    cornersB: 0,
  };

  let totalPossessionA = 0;
  let totalPossessionB = 0;

  // Frame 0: Kickoff
  const kickoffEvent: MatchLiveEvent = {
    id: `${matchId}_ev_0`,
    minute: 0,
    type: 'kickoff',
    team: 'neutral',
    scoreA: 0,
    scoreB: 0,
    title: 'Match Kickoff',
    description: `🎺 Whistle blows! ${idolA.name} (${idolA.girlGroup}) vs ${idolB.name} (${idolB.girlGroup}) underway at the Grand Idol Arena!`,
    momentumShift: 0,
    soundCue: 'whistle',
  };
  allEvents.push(kickoffEvent);

  frames.push({
    minute: 0,
    phase: 'first_half',
    scoreA: 0,
    scoreB: 0,
    possession: 'neutral',
    momentum: curMomentum,
    event: kickoffEvent,
    stats: { ...stats },
  });

  for (let min = 1; min <= totalMinutes; min++) {
    let phase: MinuteTimelineFrame['phase'] = 'first_half';
    if (min <= 45) {
      phase = 'first_half';
    } else if (min === 45 + 1 && stoppageTime1 > 0) {
      phase = 'stoppage_1';
    } else if (min <= 45 + stoppageTime1) {
      phase = 'stoppage_1';
    } else if (min === 45 + stoppageTime1 + 1) {
      phase = 'half_time';
    } else if (min <= 90) {
      phase = 'second_half';
    } else if (min <= 90 + stoppageTime2) {
      phase = 'stoppage_2';
    } else {
      phase = 'full_time';
    }

    let frameEvent: MatchLiveEvent | null = null;

    // Momentum drift with slight regression to rating delta
    const drift = (Math.random() - 0.5) * 18 + (ratingDelta > 0 ? 1.2 : -1.2);
    curMomentum = Math.max(-95, Math.min(95, curMomentum * 0.88 + drift));

    // Determine possession this minute
    let poss: 'A' | 'B' | 'neutral' = 'neutral';
    if (curMomentum > 15) {
      poss = 'A';
      totalPossessionA += 1.3;
      totalPossessionB += 0.7;
    } else if (curMomentum < -15) {
      poss = 'B';
      totalPossessionB += 1.3;
      totalPossessionA += 0.7;
    } else {
      poss = Math.random() > 0.5 ? 'A' : 'B';
      totalPossessionA += 1;
      totalPossessionB += 1;
    }

    const totalPoss = totalPossessionA + totalPossessionB;
    stats.possessionPctA = Math.round((totalPossessionA / totalPoss) * 100);
    stats.possessionPctB = 100 - stats.possessionPctA;

    // Milestone: Half-Time whistle
    if (min === 45 + stoppageTime1) {
      frameEvent = {
        id: `${matchId}_ev_ht_${min}`,
        minute: min,
        type: 'half_time',
        team: 'neutral',
        scoreA: curScoreA,
        scoreB: curScoreB,
        title: 'Half-Time Whistle',
        description: `⏱️ Halftime! Score stands at ${curScoreA} - ${curScoreB}. Competitors head to the wings for strategy adjustments.`,
        momentumShift: 0,
        soundCue: 'whistle',
      };
    } else if (min === 45 + stoppageTime1 + 1) {
      frameEvent = {
        id: `${matchId}_ev_sh_${min}`,
        minute: 46,
        type: 'second_half_kickoff',
        team: 'neutral',
        scoreA: curScoreA,
        scoreB: curScoreB,
        title: 'Second Half Begins',
        description: `🎺 Second half underway! High stakes and all to play for in the final 45 minutes!`,
        momentumShift: 0,
        soundCue: 'whistle',
      };
    } else if (min === totalMinutes) {
      frameEvent = {
        id: `${matchId}_ev_ft_${min}`,
        minute: min,
        type: 'full_time',
        team: 'neutral',
        scoreA: curScoreA,
        scoreB: curScoreB,
        title: 'Full-Time Whistle',
        description: `🏁 FULL TIME! Final Score: ${idolA.name} ${curScoreA} - ${curScoreB} ${idolB.name}. ${
          curScoreA > curScoreB
            ? `${idolA.name} triumphs!`
            : curScoreB > curScoreA
            ? `${idolB.name} claims the victory!`
            : 'Match ends in a thrilling draw!'
        }`,
        momentumShift: 0,
        soundCue: 'whistle',
      };
    } else {
      // Regular minute match simulation event roll
      const roll = Math.random();

      // Adjust goal chances slightly based on active in-match momentum
      const effectiveGoalProbA = baseProbGoalA * (1 + Math.max(0, curMomentum) * 0.008);
      const effectiveGoalProbB = baseProbGoalB * (1 + Math.max(0, -curMomentum) * 0.008);

      if (roll < effectiveGoalProbA && curScoreA <= 4) {
        // ⚽ GOAL IDOL A!
        curScoreA++;
        stats.shotsA++;
        stats.shotsOnTargetA++;
        curMomentum = Math.min(95, curMomentum + 35);

        const tmpl = GOAL_TEMPLATES_A[Math.floor(Math.random() * GOAL_TEMPLATES_A.length)];
        frameEvent = {
          id: `${matchId}_ev_${min}_goal_a`,
          minute: min,
          type: 'goal',
          idolId: idolA.id,
          idolName: idolA.name,
          girlGroup: idolA.girlGroup,
          team: 'A',
          scoreA: curScoreA,
          scoreB: curScoreB,
          title: `GOAL! ${idolA.name} (${curScoreA}-${curScoreB})`,
          description: tmpl(idolA.name, idolB.name, idolA.girlGroup),
          momentumShift: 35,
          soundCue: 'goal',
        };
      } else if (roll < effectiveGoalProbA + effectiveGoalProbB && curScoreB <= 4) {
        // ⚽ GOAL IDOL B!
        curScoreB++;
        stats.shotsB++;
        stats.shotsOnTargetB++;
        curMomentum = Math.max(-95, curMomentum - 35);

        const tmpl = GOAL_TEMPLATES_B[Math.floor(Math.random() * GOAL_TEMPLATES_B.length)];
        frameEvent = {
          id: `${matchId}_ev_${min}_goal_b`,
          minute: min,
          type: 'goal',
          idolId: idolB.id,
          idolName: idolB.name,
          girlGroup: idolB.girlGroup,
          team: 'B',
          scoreA: curScoreA,
          scoreB: curScoreB,
          title: `GOAL! ${idolB.name} (${curScoreA}-${curScoreB})`,
          description: tmpl(idolA.name, idolB.name, idolA.girlGroup, idolB.girlGroup),
          momentumShift: -35,
          soundCue: 'goal',
        };
      } else if (roll < 0.055) {
        // 🧤 Save by Keeper / Defender
        const isSaveA = Math.random() > 0.5;
        if (isSaveA) {
          stats.shotsB++;
          stats.shotsOnTargetB++;
          stats.savesA++;
          curMomentum = Math.min(85, curMomentum + 15);
          const saveTmpl = SAVE_TEMPLATES[Math.floor(Math.random() * SAVE_TEMPLATES.length)];
          frameEvent = {
            id: `${matchId}_ev_${min}_save_a`,
            minute: min,
            type: 'save',
            idolId: idolA.id,
            idolName: idolA.name,
            team: 'A',
            scoreA: curScoreA,
            scoreB: curScoreB,
            title: `Crucial Save by ${idolA.name}!`,
            description: saveTmpl(idolA.name, idolB.name),
            momentumShift: 15,
            soundCue: 'save',
          };
        } else {
          stats.shotsA++;
          stats.shotsOnTargetA++;
          stats.savesB++;
          curMomentum = Math.max(-85, curMomentum - 15);
          const saveTmpl = SAVE_TEMPLATES[Math.floor(Math.random() * SAVE_TEMPLATES.length)];
          frameEvent = {
            id: `${matchId}_ev_${min}_save_b`,
            minute: min,
            type: 'save',
            idolId: idolB.id,
            idolName: idolB.name,
            team: 'B',
            scoreA: curScoreA,
            scoreB: curScoreB,
            title: `Crucial Save by ${idolB.name}!`,
            description: saveTmpl(idolB.name, idolA.name),
            momentumShift: -15,
            soundCue: 'save',
          };
        }
      } else if (roll < 0.09) {
        // 🔥 Signature Move / High Note Surge
        const isTeamA = curMomentum >= 0;
        const idol = isTeamA ? idolA : idolB;
        if (isTeamA) stats.highNotesA++;
        else stats.highNotesB++;

        const shift = isTeamA ? 20 : -20;
        curMomentum = Math.max(-90, Math.min(90, curMomentum + shift));

        const hnTmpl = HIGH_NOTE_TEMPLATES[Math.floor(Math.random() * HIGH_NOTE_TEMPLATES.length)];
        frameEvent = {
          id: `${matchId}_ev_${min}_highnote`,
          minute: min,
          type: 'signature_move',
          idolId: idol.id,
          idolName: idol.name,
          team: isTeamA ? 'A' : 'B',
          scoreA: curScoreA,
          scoreB: curScoreB,
          title: `High Note Surge (${idol.name})`,
          description: hnTmpl(idol.name),
          momentumShift: shift,
          soundCue: 'cheer',
        };
      } else if (roll < 0.125) {
        // 🎯 Near Miss / Post Hit
        const isShooterA = Math.random() > 0.5;
        const shooter = isShooterA ? idolA : idolB;
        if (isShooterA) stats.shotsA++;
        else stats.shotsB++;

        const missTmpl = MISS_TEMPLATES[Math.floor(Math.random() * MISS_TEMPLATES.length)];
        frameEvent = {
          id: `${matchId}_ev_${min}_miss`,
          minute: min,
          type: 'shot_miss',
          idolId: shooter.id,
          idolName: shooter.name,
          team: isShooterA ? 'A' : 'B',
          scoreA: curScoreA,
          scoreB: curScoreB,
          title: `Near Miss by ${shooter.name}`,
          description: missTmpl(shooter.name),
          momentumShift: isShooterA ? 8 : -8,
        };
      } else if (roll < 0.145) {
        // 🟨 Tactical Foul / Tension
        const isFoulA = Math.random() > 0.5;
        if (isFoulA) stats.foulsA++;
        else stats.foulsB++;

        const fouler = isFoulA ? idolA : idolB;
        frameEvent = {
          id: `${matchId}_ev_${min}_foul`,
          minute: min,
          type: 'foul',
          idolId: fouler.id,
          idolName: fouler.name,
          team: isFoulA ? 'A' : 'B',
          scoreA: curScoreA,
          scoreB: curScoreB,
          title: `Foul / Whistle (${fouler.name})`,
          description: `⚠️ Whistle sounds! Tactical challenge by ${fouler.name} breaks up a dangerous transition.`,
          momentumShift: isFoulA ? -6 : 6,
        };
      }
    }

    if (frameEvent) {
      allEvents.push(frameEvent);
    }

    frames.push({
      minute: min,
      phase,
      scoreA: curScoreA,
      scoreB: curScoreB,
      possession: poss,
      momentum: curMomentum,
      event: frameEvent,
      stats: { ...stats },
    });
  }

  let winnerId: string | null = null;
  if (curScoreA > curScoreB) winnerId = idolA.id;
  else if (curScoreB > curScoreA) winnerId = idolB.id;

  return {
    matchId,
    idolA,
    idolB,
    formA,
    formB,
    effectiveRatingA,
    effectiveRatingB,
    finalScoreA: curScoreA,
    finalScoreB: curScoreB,
    winnerId,
    frames,
    allEvents,
    stoppageTime1,
    stoppageTime2,
  };
}


/**
 * v4 Best of 4 stages (league matchday, group stage, The Idols phase 1, LCQ).
 * The animated simulation is replayed until its final score is a valid Best of 4 result
 * (4 games in total: 4-0, 3-1, 2-2, 1-3 or 0-4), so the animation and the saved result always agree.
 */
export function generateBo4MatchSimulation(
  matchId: string,
  idolA: Idol,
  idolB: Idol,
  formHistoryA: Array<'W' | 'D' | 'L'> = [],
  formHistoryB: Array<'W' | 'D' | 'L'> = []
): PreGeneratedMatchSimulation {
  let sim = generateMatchSimulation(matchId, idolA, idolB, formHistoryA, formHistoryB);
  for (let i = 0; i < 80 && sim.finalScoreA + sim.finalScoreB !== 4; i++) {
    sim = generateMatchSimulation(matchId, idolA, idolB, formHistoryA, formHistoryB);
  }
  return sim;
}
