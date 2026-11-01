import { ArchivedMatch, Idol } from '../types';

export interface OpponentH2HRecord {
  opponentId: string;
  opponentName: string;
  opponentGroup: string;
  opponentPhoto: string;
  opponentSeed: string;
  opponentNationality: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  gamesFor: number;
  gamesAgainst: number;
}

export function getTopH2HRecordsForIdol(
  idolId: string,
  matchDatabase: ArchivedMatch[],
  idols: Idol[],
  limit: number = 5
): OpponentH2HRecord[] {
  if (!idolId || !Array.isArray(matchDatabase) || matchDatabase.length === 0) return [];

  const safeIdols = (Array.isArray(idols) ? idols : []).filter((i) => i && typeof i.id === 'string' && typeof i.name === 'string');
  const safeMatches = matchDatabase.filter((m) => m && typeof m === 'object');
  const idolMap = new Map<string, Idol>(safeIdols.map((i) => [i.id, i]));
  const idolNameMap = new Map<string, Idol>(
    safeIdols.map((i) => [i.name.trim().toLowerCase(), i])
  );

  const opponentStats = new Map<
    string,
    {
      opponentId: string;
      opponentName: string;
      played: number;
      wins: number;
      losses: number;
      draws: number;
      gamesFor: number;
      gamesAgainst: number;
    }
  >();

  safeMatches.forEach((m) => {
    if (m.scoreA === null || m.scoreB === null || m.scoreA === undefined || m.scoreB === undefined) return;

    let isA = false;
    let isB = false;

    if (m.idolAId === idolId || m.idolAName?.toLowerCase() === idolId.toLowerCase()) {
      isA = true;
    } else if (m.idolBId === idolId || m.idolBName?.toLowerCase() === idolId.toLowerCase()) {
      isB = true;
    }

    if (!isA && !isB) return;

    const oppId = isA ? m.idolBId : m.idolAId;
    const oppName = isA ? m.idolBName : m.idolAName;
    const myScore = isA ? m.scoreA : m.scoreB;
    const oppScore = isA ? m.scoreB : m.scoreA;

    const safeOpponentName = String(oppName || 'Unknown Opponent');
    const key = oppId || safeOpponentName.toLowerCase();
    let current = opponentStats.get(key);

    if (!current) {
      current = {
        opponentId: oppId,
        opponentName: safeOpponentName,
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      };
      opponentStats.set(key, current);
    }

    current.played += 1;
    current.gamesFor += myScore;
    current.gamesAgainst += oppScore;

    if (myScore > oppScore) {
      current.wins += 1;
    } else if (oppScore > myScore) {
      current.losses += 1;
    } else {
      current.draws += 1;
    }
  });

  const records: OpponentH2HRecord[] = Array.from(opponentStats.values()).map((stat) => {
    let matchedIdol = idolMap.get(stat.opponentId);
    if (!matchedIdol && stat.opponentName) {
      matchedIdol = idolNameMap.get(stat.opponentName.trim().toLowerCase());
    }

    const winRate = stat.played > 0 ? Math.round((stat.wins / stat.played) * 100) : 0;

    return {
      opponentId: stat.opponentId || matchedIdol?.id || stat.opponentName,
      opponentName: matchedIdol?.name || stat.opponentName || 'Unknown Opponent',
      opponentGroup: matchedIdol?.girlGroup || 'Solo',
      opponentPhoto: matchedIdol?.photoUrl || '',
      opponentSeed: matchedIdol?.seed || 'Seed 3',
      opponentNationality: matchedIdol?.nationality || 'South Korea',
      played: stat.played,
      wins: stat.wins,
      losses: stat.losses,
      draws: stat.draws,
      winRate,
      gamesFor: stat.gamesFor,
      gamesAgainst: stat.gamesAgainst,
    };
  });

  // Sort by total matches played desc, then by wins desc, then by winRate desc
  records.sort((a, b) => {
    if (b.played !== a.played) return b.played - a.played;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.winRate - a.winRate;
  });

  return records.slice(0, limit);
}
