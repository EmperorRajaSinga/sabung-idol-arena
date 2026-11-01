import type { Idol, ArchivedMatch } from '../../types';
import type { V5State, V5TitleArchive } from './store';
import { rebuildLeague } from './engine';

export interface V5ArchiveSnapshot {
  matches: ArchivedMatch[];
  titles: V5TitleArchive[];
  resetState: V5State;
}

/** Converts every completed Division 2 and V5 cup result into permanent records. */
export function createV5ArchiveSnapshot(
  state: V5State,
  existingMatches: ArchivedMatch[],
  existingTitles: V5TitleArchive[],
  idols: Idol[],
  seasonNumber: number,
  seasonName: string
): V5ArchiveSnapshot {
  const byId = new Map(idols.map((idol) => [idol.id, idol]));
  const matches = new Map<string, ArchivedMatch>();
  (existingMatches || []).forEach((match) => {
    const stage = String(match.stage || '').toLowerCase();
    const legacySuperB = Number(match.seasonId) === Number(seasonNumber) &&
      stage.startsWith('cups & divisions: super cup b /');
    if (!legacySuperB) matches.set(match.matchId, match);
  });
  const titles = new Map<string, V5TitleArchive>((existingTitles || []).map((title) => [title.id, title]));
  const addTitle = (competition: string, winnerId?: string | null, runnerUpId?: string | null, isDivision = false) => {
    if (!winnerId || !byId.has(winnerId)) return;
    const winner = byId.get(winnerId)!;
    const runner = runnerUpId ? byId.get(runnerUpId) : undefined;
    const id = `v5_title_${seasonNumber}_${competition.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    titles.set(id, {
      id, seasonNumber, seasonName, competition,
      winnerId, winnerName: winner.name, winnerGroup: winner.girlGroup, winnerPhoto: winner.photoUrl,
      runnerUpId: runner?.id, runnerUpName: runner?.name, runnerUpGroup: runner?.girlGroup, runnerUpPhoto: runner?.photoUrl,
      isDivision, archivedAt: new Date().toISOString(),
    });
  };
  const addMatch = (competition: string, match: any, roundName?: string) => {
    if (!match?.completed || !match.idolAId || !match.idolBId ||
        !Number.isFinite(Number(match.scoreA)) || !Number.isFinite(Number(match.scoreB))) return;
    const a = byId.get(match.idolAId), b = byId.get(match.idolBId);
    if (!a || !b) return;
    const isDraw = match.isDraw === true || match.winnerId === 'DRAW' || Number(match.scoreA) === Number(match.scoreB);
    const winnerId = isDraw ? '' : (match.winnerId || (Number(match.scoreA) > Number(match.scoreB) ? a.id : b.id));
    const winner = winnerId ? byId.get(winnerId) : undefined;
    if (!isDraw && !winner) return;
    const loser = isDraw ? undefined : (winner!.id === a.id ? b : a);
    const matchId = `v5_s${seasonNumber}_${competition.replace(/[^a-z0-9]+/gi, '_')}_${match.id}`;
    matches.set(matchId, {
      matchId, seasonId: seasonNumber, seasonName,
      stage: `Cups & Divisions: ${competition} / ${roundName || match.roundName || 'Match'}`,
      idolAId: a.id, idolAName: a.name, idolAGroup: a.girlGroup, idolAPhoto: a.photoUrl,
      idolBId: b.id, idolBName: b.name, idolBGroup: b.girlGroup, idolBPhoto: b.photoUrl,
      scoreA: Number(match.scoreA), scoreB: Number(match.scoreB), winnerId,
      winnerName: isDraw ? 'Draw' : winner!.name, loserId: loser?.id || '', loserName: loser?.name || '', isDraw,
      date: match.updatedAt || new Date().toISOString(),
    });
  };

  (state.d2 || []).forEach((league) => {
    (league.matches || []).forEach((match) => addMatch(`Division 2 ${league.name}`, match, `Matchday ${match.matchday}`));
    const ranked = [...(league.standings || [])].sort((a, b) => a.rank - b.rank);
    const seasonFinished = (league.matches || []).length > 0 && (league.matches || []).every((match) => match.completed);
    const championId = league.championId || (seasonFinished ? ranked[0]?.idolId : undefined);
    if (championId) addTitle(`Division 2 / ${league.name}`, championId, ranked[1]?.idolId, true);
  });

  (state.champsCup?.matches || []).forEach((match) => addMatch('League Champions Cup', match));
  const crownFinal = state.champsCup?.matches?.find((match) => match.id === 'cc_gf');
  if (crownFinal?.completed) addTitle('League Champions Cup', crownFinal.winnerId, crownFinal.loserId);

  (state.leagueCup?.rounds || []).flat().forEach((match) => addMatch('All-League Knockout Cup', match));
  const leagueCupFinal = state.leagueCup?.rounds?.[state.leagueCup.rounds.length - 1]?.[0];
  if (state.leagueCup?.championId && leagueCupFinal?.completed) {
    addTitle('All-League Knockout Cup', state.leagueCup.championId, leagueCupFinal.loserId);
  }

  Object.entries(state.miniCups || {}).forEach(([leagueId, bracket]) => {
    bracket.forEach((match) => addMatch(`Top 16 Mini Cup League ${leagueId}`, match));
    const final = bracket.find((match) => match.id === `mc${leagueId}_final`);
    if (final?.completed) addTitle(`Top 16 Mini Cup / League ${leagueId}`, final.winnerId, final.loserId);
  });

  if (state.superA) {
    addMatch('Super Cup A', state.superA);
    if (state.superA.completed) addTitle('Super Cup A', state.superA.winnerId, state.superA.loserId);
  }
  (state.superB || []).forEach((match, index) => {
    addMatch(`Super Cup B ${index + 1}`, match, match.roundName || `League ${index + 1} Super Cup`);
    if (match.completed) addTitle(`Super Cup B ${index + 1}`, match.winnerId, match.loserId);
  });

  const resetState: V5State = {
    ...state,
    d2: (state.d2 || []).map((league) => rebuildLeague({
      ...league,
      isCompleted: false,
      championId: undefined,
      championName: undefined,
    }, idols)),
    champsCup: null,
    leagueCup: null,
    miniCups: {},
    superA: null,
    superB: [],
  };
  return { matches: [...matches.values()], titles: [...titles.values()], resetState };
}
