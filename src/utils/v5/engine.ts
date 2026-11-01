import type { Idol, GirlGroup, LeagueInfo } from '../../types';
import { generateRoundRobinMatches, calculateLeagueStandings, repairLeagueFixturesForSimulation } from '../leagueLogic';
import { getIdolRating, simulateSeriesMatches, simulateLeagueMatchScore } from '../ratingHelper';
import { rankStandings } from '../swissLogic';
import { isIdolActive } from '../tournamentLogic';

/* ------------------------------------------------------------------ shared helpers */
export const shuffle = <T,>(arr: T[]): T[] => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rating = (m: Map<string, Idol>, id: string | null) => (id ? getIdolRating(m.get(id)) : 0);

export type Slot = { id: string } | { win: string } | { lose: string };
export interface BNode {
  id: string; roundName: string; bestOf: 5 | 7; a: Slot; b: Slot;
  idolAId: string | null; idolBId: string | null; scoreA: number | null; scoreB: number | null;
  winnerId: string | null; loserId: string | null; completed: boolean;
}
const node = (id: string, roundName: string, bestOf: 5 | 7, a: Slot, b: Slot): BNode => ({ id, roundName, bestOf, a, b, idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false });
const slotIdol = (s: Slot, by: Map<string, BNode>): string | null => {
  if ('id' in s) return s.id;
  const m = by.get('win' in s ? s.win : s.lose); if (!m || !m.completed) return null;
  return 'win' in s ? m.winnerId : m.loserId;
};
export function advanceBracket(ms: BNode[]) { const by = new Map(ms.map((m) => [m.id, m])); ms.forEach((m) => { if (!m.completed) { m.idolAId = slotIdol(m.a, by); m.idolBId = slotIdol(m.b, by); } }); }
/**
 * Invalidates every downstream match fed by an edited result.
 * Results and participant snapshots are cleared for the full dependency
 * chain. Do not advance the bracket here: that would immediately repopulate
 * participant IDs from the edited source and violate the reset boundary.
 * The UI/simulation path calls advanceBracket when it is ready to resume play.
 */
export function invalidateDownstream(ms: BNode[], changedMatchId: string): string[] {
  const sourceExists = ms.some((match) => match.id === changedMatchId);
  if (!sourceExists) return [];

  const invalidated = new Set<string>();
  const queue = [changedMatchId];
  while (queue.length) {
    const sourceId = queue.shift()!;
    for (const match of ms) {
      if (invalidated.has(match.id) || match.id === changedMatchId) continue;
      const dependsOnSource =
        (('win' in match.a && match.a.win === sourceId) || ('lose' in match.a && match.a.lose === sourceId)) ||
        (('win' in match.b && match.b.win === sourceId) || ('lose' in match.b && match.b.lose === sourceId));
      if (!dependsOnSource) continue;

      invalidated.add(match.id);
      queue.push(match.id);
      match.idolAId = null;
      match.idolBId = null;
      match.scoreA = null;
      match.scoreB = null;
      match.winnerId = null;
      match.loserId = null;
      match.completed = false;
    }
  }

  return [...invalidated];
}
export function playNode(m: BNode, idols: Map<string, Idol>) {
  const r = simulateSeriesMatches(rating(idols, m.idolAId), rating(idols, m.idolBId), m.bestOf === 7 ? 4 : 3);
  m.scoreA = r.scoreA; m.scoreB = r.scoreB; m.winnerId = r.winnerIdIsA ? m.idolAId : m.idolBId; m.loserId = r.winnerIdIsA ? m.idolBId : m.idolAId; m.completed = true;
}
/** Plays every playable match until the graph is finished. */
export function simulateBracket(ms: BNode[], idols: Map<string, Idol>) {
  for (let guard = 0; guard < 2000; guard++) {
    advanceBracket(ms);
    const next = ms.find((m) => !m.completed && m.idolAId && m.idolBId);
    if (!next) return;
    playNode(next, idols);
  }
}
/** Simulates Crown Cup using its fixed eight-match upper/lower bracket graph. */
export function simulateChampsCup(ms: BNode[], idols: Map<string, Idol>, seedOrder: string[] = []) {
  for (let guard = 0; guard < 2000; guard++) {
    advanceChampsCup(ms, seedOrder);
    const next = ms.find((m) => !m.completed && m.idolAId && m.idolBId);
    if (!next) return;
    playNode(next, idols);
  }
}

/* ------------------------------------------------------------------ Division 2 */
export interface DivisionTwoLeague extends LeagueInfo { parentLeagueId: number; }
const D2_BASE = 100;
export const d2IdFor = (parentId: number) => D2_BASE + parentId;

/** Takes unassigned active idols (best rating first), deals them in snake order across the Division 2 leagues. */
export function autoFillDivisionTwo(d1: LeagueInfo[], existing: DivisionTwoLeague[], idols: Idol[], groups: GirlGroup[], perLeague: number, namePart: string): DivisionTwoLeague[] {
  const taken = new Set<string>();
  const takenNames = new Set<string>();
  const normalizeName = (value: string) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const idolById = new Map(idols.map((idol) => [idol.id, idol]));
  d1.forEach((league) => league.memberIds.forEach((id) => {
    taken.add(id);
    const name = idolById.get(id)?.name;
    if (name) takenNames.add(normalizeName(name));
  }));
  existing.forEach((league) => league.memberIds.forEach((id) => {
    taken.add(id);
    const name = idolById.get(id)?.name;
    if (name) takenNames.add(normalizeName(name));
  }));
  const freeNames = new Set<string>();
  const free = idols
    .filter((idol) => {
      const name = normalizeName(idol.name);
      if (!isIdolActive(idol, groups) || taken.has(idol.id) || takenNames.has(name) || freeNames.has(name)) return false;
      freeNames.add(name);
      return true;
    })
    .sort((a, b) => getIdolRating(b) - getIdolRating(a));
  const base: DivisionTwoLeague[] = d1.map((l) => existing.find((e) => e.parentLeagueId === l.id) || ({ id: d2IdFor(l.id), parentLeagueId: l.id, name: `${l.name} ${namePart}`, tierName: namePart, color: l.color, memberIds: [], matches: [], standings: [] } as DivisionTwoLeague));
  let dir = 1, idx = 0;
  for (const idol of free) {
    let guard = 0;
    while (guard++ < base.length * 2 && base[idx] && base[idx].memberIds.length >= perLeague) { idx += dir; if (idx >= base.length || idx < 0) { dir = -dir; idx += dir; } }
    if (!base[idx] || base[idx].memberIds.length >= perLeague) break;
    base[idx].memberIds.push(idol.id);
    idx += dir; if (idx >= base.length || idx < 0) { dir = -dir; idx += dir; }
  }
  return base.map((l) => rebuildLeague(l, idols));
}
/** Rebuilds fixtures and standings from the roster (only call before the season starts, or for a new season). */
export function rebuildLeague<T extends LeagueInfo>(l: T, idols: Idol[]): T {
  const matches = generateRoundRobinMatches(l.id, l.memberIds);
  return { ...l, matches, standings: calculateLeagueStandings(l.id, l.memberIds, matches, idols), isCompleted: false, championId: undefined, championName: undefined };
}
/** Plays all open matches of a league with the Best of 4 engine and recomputes the table. */
export function simulateLeagueMatches<T extends LeagueInfo>(l: T, idols: Idol[]): T {
  const by = new Map(idols.map((i) => [i.id, i]));
  const matches = l.matches.map((m) => {
    if (m.completed) return m;
    const r = simulateLeagueMatchScore(by.get(m.idolAId), by.get(m.idolBId));
    return { ...m, scoreA: r.scoreA, scoreB: r.scoreB, winnerId: r.winnerId, completed: true };
  });
  const standings = calculateLeagueStandings(l.id, l.memberIds, matches, idols);
  const ranked = rankStandings(standings);
  return { ...l, matches, standings, isCompleted: true, championId: ranked[0]?.idolId, championName: ranked[0]?.idolName };
}

/**
 * Runs every Division 2 and V5 cup competition for the current season.
 * Existing brackets/results are retained; missing brackets are generated from
 * the completed Division 1/2 standings before simulation.
 */
export function simulateV5Season<T extends {
  d2: DivisionTwoLeague[];
  perLeague: number;
  promotionCount: number;
  pendingMoves: PromotionMove[] | null;
  promotionHistory?: any[];
  champsCup: { matches: BNode[]; byeIds: string[]; seedOrder?: string[] } | null;
  leagueCup: LeagueCupState | null;
  miniCups: Record<string, BNode[]>;
  superA: BNode | null;
  superB: BNode[];
}>(
  source: T,
  d1: LeagueInfo[],
  idols: Idol[],
  grandCupMatches: Array<{ id: string; roundName: string; idolAId: string | null; idolBId: string | null; winnerId: string | null; completed: boolean }>,
  theIdolsChampionId?: string
): T {
  const by = new Map(idols.map((idol) => [idol.id, idol]));
  const d2 = (source.d2 || []).map((league) => {
    const repaired = repairLeagueFixturesForSimulation(league, idols);
    if (repaired.unresolvedMemberIds.length) {
      throw new Error(`${league.name}: unresolved Division 2 roster IDs: ${repaired.unresolvedMemberIds.join(', ')}`);
    }
    return simulateLeagueMatches(repaired.league, idols);
  });
  const completedD1 = d1.map((league) => {
    const standings = calculateLeagueStandings(league.id, league.memberIds, league.matches, idols);
    return { ...league, standings };
  });

  const champions = completedD1.map((league) => {
    const ranked = rankStandings(league.standings);
    const top = ranked[0];
    return top ? {
      idolId: top.idolId,
      leagueId: league.id,
      wonGrandCup: false,
      wonTheIdols: false,
      points: top.points || 0,
      gameDiff: top.gameDiff || 0,
    } : null;
  }).filter((item): item is ChampionInfo => Boolean(item));

  let champsCup = source.champsCup;
  if (champions.length === 6) {
    const currentChampionIds = new Set(champions.map((champion) => champion.idolId));
    const existingChampionIds = new Set((champsCup?.matches || []).flatMap((match) => [match.idolAId, match.idolBId]).filter((id): id is string => Boolean(id)));
    const bracketMatchesCurrentChampions = existingChampionIds.size === 6 && [...currentChampionIds].every((id) => existingChampionIds.has(id));
    if (!champsCup?.matches?.length || !bracketMatchesCurrentChampions) champsCup = buildChampsCup(champions);
    const matches = champsCup.matches.map((match) => ({ ...match }));
    simulateChampsCup(matches, by, champsCup.seedOrder || []);
    champsCup = { ...champsCup, matches };
  }

  let leagueCup = source.leagueCup;
  const cupOrder = leagueCupOrder(completedD1, d2);
  if (!leagueCup && cupOrder.length >= 2) {
    const leagueOf: Record<string, number> = {};
    [...completedD1, ...d2].forEach((league) => league.memberIds.forEach((id) => { leagueOf[id] = league.id; }));
    leagueCup = createLeagueCup(cupOrder, leagueOf, d2.reduce((sum, league) => sum + league.memberIds.length, 0));
  }
  if (leagueCup) {
    leagueCup = JSON.parse(JSON.stringify(leagueCup)) as LeagueCupState;
    simulateLeagueCup(leagueCup, by);
  }

  const miniCups: Record<string, BNode[]> = { ...(source.miniCups || {}) };
  completedD1.forEach((league) => {
    const top16 = rankStandings(league.standings).slice(0, 16).map((standing) => standing.idolId);
    if (top16.length !== 16) return;
    const bracket = (miniCups[String(league.id)] || []).map((match) => ({ ...match }));
    const existingMiniIds = new Set(bracket.filter((match) => match.roundName === 'Round of 16').flatMap((match) => [match.idolAId, match.idolBId]).filter((id): id is string => Boolean(id)));
    const miniCupMatchesCurrentTop16 = existingMiniIds.size === 16 && top16.every((id) => existingMiniIds.has(id));
    const ready = bracket.length && miniCupMatchesCurrentTop16 ? bracket : buildMiniCup(league.id, top16);
    simulateBracket(ready, by);
    miniCups[String(league.id)] = ready;
  });

  const finalMatch = [...grandCupMatches].reverse().find((match) =>
    match.completed && match.winnerId &&
    (/grand final|^final$/i.test(match.roundName || ''))
  );
  const grandWinner = finalMatch?.winnerId || null;
  const grandRunner = finalMatch
    ? (finalMatch.winnerId === finalMatch.idolAId ? finalMatch.idolBId : finalMatch.idolAId)
    : null;

  let superA = source.superA ? { ...source.superA } : null;
  if (theIdolsChampionId && grandWinner) {
    const expectedSuperA = buildSuperCup('sc_a', theIdolsChampionId, grandWinner, grandRunner);
    if (!superA || superA.idolAId !== expectedSuperA.idolAId || superA.idolBId !== expectedSuperA.idolBId) superA = expectedSuperA;
  }
  if (superA) {
    const bracket = [superA];
    simulateBracket(bracket, by);
    superA = bracket[0];
  }

  const superB = completedD1.map((league) => {
    const miniFinal = miniCups[String(league.id)]?.find((match) => match.id === `mc${league.id}_final`);
    const ranked = rankStandings(league.standings);
    const leagueWinner = ranked[0]?.idolId || '';
    const miniWinner = miniFinal?.winnerId || '';
    const miniRunner = miniFinal
      ? (miniFinal.winnerId === miniFinal.idolAId ? miniFinal.idolBId : miniFinal.idolAId)
      : null;
    const existing = source.superB?.find((match) => match.id === `sc_b${league.id}`);
    const expected = leagueWinner && miniWinner
      ? buildSuperCup(`sc_b${league.id}`, leagueWinner, miniWinner, miniRunner)
      : null;
    const match = existing && expected && existing.idolAId === expected.idolAId && existing.idolBId === expected.idolBId
      ? { ...existing }
      : expected;
    if (!match) return null;
    const bracket = [match];
    simulateBracket(bracket, by);
    return bracket[0];
  }).filter((match): match is BNode => Boolean(match));

  return { ...source, d2, champsCup, leagueCup, miniCups, superA, superB };
}

/* ------------------------------------------------------------------ Promotion and relegation */
export interface PromotionMove { leagueId: number; relegated: string[]; promoted: string[]; }
export function computePromotionRelegation(d1: LeagueInfo, d2: LeagueInfo, count: number): PromotionMove {
  const n = Math.max(0, Math.min(count, d1.memberIds.length, d2.memberIds.length));
  const r1 = rankStandings(d1.standings).map((s) => s.idolId), r2 = rankStandings(d2.standings).map((s) => s.idolId);
  return { leagueId: d1.id, relegated: n ? r1.slice(-n) : [], promoted: r2.slice(0, n) };
}
/** Swaps the moved idols and rebuilds both fixture lists for the next season. */
export function applyPromotionRelegation(d1: LeagueInfo[], d2: DivisionTwoLeague[], count: number, idols: Idol[]): { d1: LeagueInfo[]; d2: DivisionTwoLeague[]; moves: PromotionMove[] } {
  const moves: PromotionMove[] = [];
  const nd1: LeagueInfo[] = [], nd2: DivisionTwoLeague[] = [];
  d1.forEach((l) => {
    const l2 = d2.find((x) => x.parentLeagueId === l.id);
    if (!l2) { nd1.push(rebuildLeague(l, idols)); return; }
    const mv = computePromotionRelegation(l, l2, count); moves.push(mv);
    const down = new Set(mv.relegated), up = new Set(mv.promoted);
    nd1.push(rebuildLeague({ ...l, memberIds: [...l.memberIds.filter((i) => !down.has(i)), ...mv.promoted] }, idols));
    nd2.push(rebuildLeague({ ...l2, memberIds: [...l2.memberIds.filter((i) => !up.has(i)), ...mv.relegated] }, idols));
  });
  return { d1: nd1, d2: nd2, moves };
}

/* ------------------------------------------------------------------ Champs Cup (6 champions, double elimination) */
export interface ChampionInfo { idolId: string; leagueId: number; wonGrandCup: boolean; wonTheIdols: boolean; points: number; gameDiff: number; }
/** Bye order: Grand Cup winner, The Idols winner, then league points, game difference, stored random draw. */
export function rankChampionsForByes(c: ChampionInfo[]): ChampionInfo[] {
  const rnd = new Map(c.map((x) => [x.idolId, Math.random()]));
  return [...c].sort((a, b) => (Number(b.wonGrandCup) - Number(a.wonGrandCup)) || (Number(b.wonTheIdols) - Number(a.wonTheIdols)) || (b.points - a.points) || (b.gameDiff - a.gameDiff) || (rnd.get(a.idolId)! - rnd.get(b.idolId)!));
}
export function buildChampsCup(champions: ChampionInfo[]): { matches: BNode[]; byeIds: string[]; seedOrder: string[] } {
  if (champions.length !== 6) throw new Error('Champs Cup needs exactly 6 league champions');
  const ranked = rankChampionsForByes(champions);
  const seedOrder = [...champions]
    .sort((a, b) => (b.points - a.points) || (b.gameDiff - a.gameDiff) || (a.leagueId - b.leagueId))
    .map((champion) => champion.idolId);
  const byeIds = ranked.slice(0, 2).map((c) => c.idolId);
  const drawn = shuffle(ranked.slice(2).map((c) => c.idolId));
  const S = (id: string): Slot => ({ id }), W = (id: string): Slot => ({ win: id }), L = (id: string): Slot => ({ lose: id });
  const matches = [
    node('cc_ur1_a', 'Upper Round 1', 5, S(drawn[0]), S(drawn[1])),
    node('cc_ur1_b', 'Upper Round 1', 5, S(drawn[2]), S(drawn[3])),
    node('cc_usf_a', 'Upper Semi Final', 5, S(byeIds[1]), W('cc_ur1_a')),
    node('cc_usf_b', 'Upper Semi Final', 5, S(byeIds[0]), W('cc_ur1_b')),
    node('cc_uf', 'Upper Final', 5, W('cc_usf_a'), W('cc_usf_b')),
    node('cc_lr1', 'Lower Round 1', 5, L('cc_usf_a'), L('cc_usf_b')),
    node('cc_lf', 'Lower Final', 7, W('cc_lr1'), L('cc_uf')),
    node('cc_gf', 'Grand Final', 7, W('cc_uf'), W('cc_lf')),
  ];
  advanceBracket(matches);
  return { matches, byeIds, seedOrder };
}
/** Crown Cup: Upper Round 1 losers are eliminated. Only Upper Semi Final losers enter Lower Round 1. */
export function advanceChampsCup(matches: BNode[], _seedOrder: string[] = []) {
  advanceBracket(matches);
}
/** Migrates saved ten-match Crown Cup brackets to the current eight-match format.
 * Completed upper matches are retained. Obsolete lower-bracket results are discarded
 * because their participants and elimination rules changed.
 */
export function migrateChampsCup(matches: BNode[]): BNode[] {
  if (!matches.some((match) => match.id === 'cc_lr2' || match.id === 'cc_lr3')) return matches;
  const by = new Map(matches.map((match) => [match.id, match]));
  const upperIds = ['cc_ur1_a', 'cc_ur1_b', 'cc_usf_a', 'cc_usf_b', 'cc_uf'];
  const next = upperIds.map((id) => by.get(id)).filter((match): match is BNode => !!match).map((match) => ({ ...match }));
  const reset = (id: string, roundName: string, bestOf: 5 | 7, a: Slot, b: Slot): BNode =>
    ({ id, roundName, bestOf, a, b, idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false });
  next.push(
    reset('cc_lr1', 'Lower Round 1', 5, { lose: 'cc_usf_a' }, { lose: 'cc_usf_b' }),
    reset('cc_lf', 'Lower Final', 7, { win: 'cc_lr1' }, { lose: 'cc_uf' }),
    reset('cc_gf', 'Grand Final', 7, { win: 'cc_uf' }, { win: 'cc_lf' }),
  );
  advanceBracket(next);
  return next;
}


/* ------------------------------------------------------------------ League Cup (all idols, tiered entry) */
export interface LeagueCupPlan { entrants: number[]; sizes: number[]; rounds: number; }
/** Exact entry plan: every round has an even number of idols and the last round has exactly 2. */
export function planLeagueCup(d2Count: number, d1Count: number): LeagueCupPlan {
  const N = d2Count + d1Count;
  if (N < 2) return { entrants: [], sizes: [], rounds: 0 };
  const c2 = Math.round(d1Count * 0.4), c3 = Math.round(d1Count * 0.3), c4 = Math.round(d1Count * 0.2), c5 = Math.max(0, d1Count - c2 - c3 - c4);
  const ideal: number[] = [...Array(d2Count).fill(1), ...Array(c2).fill(2), ...Array(c3).fill(3), ...Array(c4).fill(4), ...Array(c5).fill(5)];
  const R0 = Math.ceil(Math.log2(N)) + 1;
  for (let R = R0; R <= R0 + 3; R++) {
    const pre: number[][] = []; for (let r = 1; r <= R; r++) { const p = [0]; for (let i = 0; i < N; i++) p.push(p[i] + Math.abs(r - ideal[i])); pre[r] = p; }
    const memo = new Map<number, { c: number; ns: number[] } | null>();
    const f = (r: number, W: number, placed: number): { c: number; ns: number[] } | null => {
      const key = (r * 4000 + W) * 4000 + placed; if (memo.has(key)) return memo.get(key)!;
      let best: { c: number; ns: number[] } | null = null;
      if (r === R) { const n = N - placed; best = W + n === 2 ? { c: pre[r][N] - pre[r][placed], ns: [n] } : null; }
      else for (let n = 0; n <= N - placed; n++) {
        const S = W + n; if (S % 2 || S === 0) continue;
        const c = pre[r][placed + n] - pre[r][placed]; if (best && c >= best.c) continue;
        const sub = f(r + 1, S / 2, placed + n); if (sub && (!best || sub.c + c < best.c)) best = { c: sub.c + c, ns: [n, ...sub.ns] };
      }
      memo.set(key, best); return best;
    };
    const sol = f(1, 0, 0);
    if (sol) { const sizes: number[] = []; let W = 0; sol.ns.forEach((n) => { const s = W + n; sizes.push(s); W = s / 2; }); return { entrants: sol.ns, sizes, rounds: R }; }
  }
  // fallback: classic bracket with first-round byes
  const P = 2 ** Math.ceil(Math.log2(N)), x = 2 * (N - P / 2), rounds = Math.log2(P);
  const entrants = [x, N - x, ...Array(rounds - 2).fill(0)]; const sizes = [x, P / 2]; for (let r = 2; r < rounds; r++) sizes.push(sizes[r - 1] / 2);
  return { entrants, sizes, rounds };
}
export interface LeagueCupState { plan: LeagueCupPlan; order: string[]; leagueOf: Record<string, number>; rounds: BNode[][]; championId: string | null; }
export function createLeagueCup(orderWeakToStrong: string[], leagueOf: Record<string, number>, d2Count: number): LeagueCupState {
  return { plan: planLeagueCup(d2Count, orderWeakToStrong.length - d2Count), order: orderWeakToStrong, leagueOf, rounds: [], championId: null };
}
function pairRound(players: string[], leagueOf: Record<string, number>, avoidSame: boolean): string[] {
  let best = shuffle(players), bestConf = Infinity;
  for (let t = 0; t < (avoidSame ? 60 : 1); t++) {
    const p = t === 0 ? best : shuffle(players); let conf = 0;
    for (let i = 0; i < p.length; i += 2) if (leagueOf[p[i]] === leagueOf[p[i + 1]]) conf++;
    if (conf < bestConf) { bestConf = conf; best = p; if (!conf) break; }
  }
  return best;
}
/** Creates the next round when the previous one is complete. Returns false when the cup is finished or not ready. */
export function stepLeagueCup(s: LeagueCupState): boolean {
  if (s.championId) return false;
  const r = s.rounds.length + 1, { entrants, rounds } = s.plan;
  const prev = s.rounds[r - 2];
  if (prev && !prev.every((m) => m.completed)) return false;
  if (r > rounds) return false;
  const used = entrants.slice(0, r - 1).reduce((a, b) => a + b, 0);
  const players = [...(prev ? prev.map((m) => m.winnerId!) : []), ...s.order.slice(used, used + entrants[r - 1])];
  const paired = pairRound(players, s.leagueOf, r <= 2);
  const name = r === rounds ? 'Final' : r === rounds - 1 ? 'Semi Final' : r === rounds - 2 ? 'Quarter Final' : `Round ${r}`;
  const ms: BNode[] = []; for (let i = 0; i < paired.length; i += 2) { const m = node(`lc_r${r}_m${i / 2 + 1}`, name, r === rounds ? 7 : 5, { id: paired[i] }, { id: paired[i + 1] }); m.idolAId = paired[i]; m.idolBId = paired[i + 1]; ms.push(m); }
  s.rounds.push(ms); return true;
}
export function simulateLeagueCup(s: LeagueCupState, idols: Map<string, Idol>) {
  for (let g = 0; g < 20; g++) {
    stepLeagueCup(s); const cur = s.rounds[s.rounds.length - 1]; if (!cur) return;
    cur.filter((m) => !m.completed).forEach((m) => playNode(m, idols));
    if (s.rounds.length === s.plan.rounds) { s.championId = cur[0].winnerId; return; }
  }
}
/** Weakest to strongest: Division 2 first, then Division 1. Inside a tier: league position, points, game difference. */
export function leagueCupOrder(d1: LeagueInfo[], d2: LeagueInfo[]): string[] {
  const tier = (ls: LeagueInfo[]) => ls.flatMap((l) => rankStandings(l.standings).map((s, i) => ({ id: s.idolId, pos: i + 1, pts: s.points || 0, gd: s.gameDiff || 0, r: Math.random() })))
    .sort((a, b) => (a.pos - b.pos) || (b.pts - a.pts) || (b.gd - a.gd) || (a.r - b.r)).map((x) => x.id);
  return [...tier(d2).reverse(), ...tier(d1).reverse()];
}

/* ------------------------------------------------------------------ Mini Cup (top 16 of one Division 1 league) */
export function buildMiniCup(leagueId: number, top16: string[]): BNode[] {
  if (top16.length !== 16) throw new Error('Mini Cup needs exactly 16 idols');
  const pairs: Array<[number, number]> = [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
  const p = `mc${leagueId}`; const ms: BNode[] = [];
  pairs.forEach(([a, b], i) => ms.push(node(`${p}_r16_${i + 1}`, 'Round of 16', 5, { id: top16[a - 1] }, { id: top16[b - 1] })));
  for (let i = 1; i <= 4; i++) ms.push(node(`${p}_qf_${i}`, 'Quarter Final', 5, { win: `${p}_r16_${2 * i - 1}` }, { win: `${p}_r16_${2 * i}` }));
  for (let i = 1; i <= 2; i++) ms.push(node(`${p}_sf_${i}`, 'Semi Final', 5, { win: `${p}_qf_${2 * i - 1}` }, { win: `${p}_qf_${2 * i}` }));
  ms.push(node(`${p}_final`, 'Final', 7, { win: `${p}_sf_1` }, { win: `${p}_sf_2` }));
  advanceBracket(ms); return ms;
}

/* ------------------------------------------------------------------ Super Cups (single match, Best of 5) */
/** If one idol won both competitions, the opponent is the runner-up of the competition that does not count first (runner-up rule). */
export function buildSuperCup(id: string, first: string, second: string, runnerUpOfSecond: string | null): BNode {
  const opp = first === second ? runnerUpOfSecond : second;
  const m = node(id, 'Super Cup', 5, { id: first }, { id: opp || second }); m.idolAId = first; m.idolBId = opp || second; return m;
}

/** Applies promotion/relegation moves that were locked earlier (used when the new season starts). */
export function applyMoves(d1: LeagueInfo[], d2: DivisionTwoLeague[], moves: PromotionMove[], idols: Idol[]): { d1: LeagueInfo[]; d2: DivisionTwoLeague[] } {
  const nd1 = d1.map((l) => {
    const mv = moves.find((m) => m.leagueId === l.id); if (!mv) return l;
    const down = new Set(mv.relegated); return rebuildLeague({ ...l, memberIds: [...l.memberIds.filter((i) => !down.has(i)), ...mv.promoted] }, idols);
  });
  const nd2 = d2.map((l) => {
    const mv = moves.find((m) => m.leagueId === l.parentLeagueId); if (!mv) return l;
    const up = new Set(mv.promoted); return rebuildLeague({ ...l, memberIds: [...l.memberIds.filter((i) => !up.has(i)), ...mv.relegated] }, idols);
  });
  return { d1: nd1, d2: nd2 };
}
