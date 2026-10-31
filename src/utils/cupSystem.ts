export interface CupMatch {
  id: string;
  competition: 'champs_cup' | 'grand_cup' | 'mini_cup';
  leagueId?: number;
  round: string;
  bestOf: 5 | 7;
  idolAId: string | null;
  idolBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  loserId: string | null;
  completed: boolean;
}
export interface CupCompetition {
  id: string;
  name: string;
  type: CupMatch['competition'];
  leagueId?: number;
  seasonNumber: number;
  participantIds: string[];
  matches: CupMatch[];
  championId?: string;
  status: 'setup' | 'in_progress' | 'completed';
}
export interface CupSystemState {
  schemaVersion: 1;
  seasonNumber: number;
  competitions: CupCompetition[];
}
export const createCupSystem = (seasonNumber: number): CupSystemState => ({
  schemaVersion: 1,
  seasonNumber,
  competitions: [],
});
export function createCup(
  type: CupMatch['competition'],
  name: string,
  participantIds: string[],
  seasonNumber: number,
  leagueId?: number
): CupCompetition {
  const shuffled = [...new Set(participantIds)].sort(() => Math.random() - 0.5);
  return {
    id: `${type}_s${seasonNumber}_${leagueId ?? 'all'}`,
    name, type, leagueId, seasonNumber,
    participantIds: shuffled,
    matches: [],
    status: 'setup',
  };
}
export function createSingleElimination(cup: CupCompetition, bestOf: 5 | 7 = 5): CupCompetition {
  const entrants = [...cup.participantIds];
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, entrants.length)));
  const slots = Array.from({ length: size }, (_, i) => entrants[i] || null);
  const matches: CupMatch[] = [];
  let round = 1;
  let current = slots.map((id, i) => ({ id, source: i }));
  while (current.length > 1) {
    const next: typeof current = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i]?.id ?? null;
      const b = current[i + 1]?.id ?? null;
      const match: CupMatch = {
        id: `${cup.id}_r${round}_m${i / 2 + 1}`,
        competition: cup.type,
        leagueId: cup.leagueId,
        round: round === 1 ? `Round of ${size}` : `Round ${round}`,
        bestOf, idolAId: a, idolBId: b,
        scoreA: null, scoreB: null, winnerId: null, loserId: null,
        completed: false,
      };
      if (a && !b) { match.completed = true; match.winnerId = a; }
      if (b && !a) { match.completed = true; match.winnerId = b; }
      matches.push(match);
      next.push({ id: null, source: matches.length - 1 });
    }
    current = next;
    round += 1;
  }
  return { ...cup, matches, status: 'in_progress' };
}
export function simulateCup(cup: CupCompetition, ratings: Record<string, number>): CupCompetition {
  const matches = cup.matches.map((m) => {
    if (m.completed || !m.idolAId || !m.idolBId) return m;
    const a = ratings[m.idolAId] ?? 60;
    const b = ratings[m.idolBId] ?? 60;
    const scoreA = Math.max(0, Math.min(Math.ceil(m.bestOf / 2), Math.round((m.bestOf - 1) / 2 + (a - b) / 22 + Math.random() * 1.6)));
    const scoreB = Math.max(0, Math.min(Math.ceil(m.bestOf / 2), Math.round((m.bestOf - 1) / 2 + (b - a) / 22 + Math.random() * 1.6)));
    const target = Math.ceil(m.bestOf / 2);
    const winnerId = scoreA === scoreB ? (Math.random() < 0.5 ? m.idolAId : m.idolBId) : scoreA > scoreB ? m.idolAId : m.idolBId;
    return { ...m, scoreA: winnerId === m.idolAId ? target : Math.min(target - 1, scoreA), scoreB: winnerId === m.idolBId ? target : Math.min(target - 1, scoreB), winnerId, loserId: winnerId === m.idolAId ? m.idolBId : m.idolAId, completed: true };
  });
  const byRound = [...new Set(matches.map(m => m.round))];
  byRound.forEach((round, index) => {
    if (index === byRound.length - 1) return;
    const current = matches.filter(m => m.round === round);
    const next = matches.filter(m => m.round === byRound[index + 1]);
    current.forEach((m, i) => {
      if (!m.winnerId || !next[Math.floor(i / 2)]) return;
      const target = next[Math.floor(i / 2)];
      if (i % 2 === 0) target.idolAId = m.winnerId;
      else target.idolBId = m.winnerId;
    });
  });
  const final = matches[matches.length - 1];
  const championId = final?.completed ? final.winnerId || undefined : undefined;
  return { ...cup, matches, championId, status: championId ? 'completed' : 'in_progress' };
}
