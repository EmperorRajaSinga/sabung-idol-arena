/**
 * v4 rule: a season cannot be archived or reset while any competition is unfinished.
 * Returns one readable line per unfinished competition. An empty list means the season can be archived.
 * Competitions that were never started (no idols or no fixtures) are ignored.
 */
const isDone = (m: any): boolean => !!m && (m.completed === true || (m.completed === undefined && m.winnerId != null && m.winnerId !== ''));

const progress = (matches: any[]): { done: number; total: number } => ({
  done: matches.filter(isDone).length,
  total: matches.length,
});

export function getUnfinishedCompetitions(args: {
  groups?: any[] | null;
  knockoutMatches?: any[] | null;
  leagueState?: any | null;
  theIdolsState?: any | null;
  v5?: any | null;
  v5Names?: any | null;
}): string[] {
  const out: string[] = [];
  const line = (name: string, matches: any[]) => {
    const p = progress(matches);
    if (p.total > 0 && p.done < p.total) out.push(`${name} (${p.done}/${p.total} matches played)`);
  };

  (args.leagueState?.leagues || []).forEach((l: any) => {
    if ((l.memberIds || []).length > 0) line(l.name || `League ${l.id}`, l.matches || []);
  });

  const wildcard = args.leagueState?.wildcardPlayIn;
  if (wildcard && (wildcard.participants || []).length > 0) line('Wildcard Play-In', wildcard.matches || []);

  const sw = args.leagueState?.swissPlayIn;
  if (sw && (sw.participants || []).length > 0) {
    line('Swiss Play-In', sw.matches || []);
    line('Last Chance Qualifier', sw.lastChanceMatches || []);
  }

  const ti = args.theIdolsState;
  if (ti && (ti.memberIds || []).length > 0) {
    line('The Idols (Phase 1)', ti.matches || []);
    line('The Idols (Playoff)', ti.playoffMatches || []);
  }

  const groupMatches = (args.groups || []).flatMap((g: any) => g.matches || []);
  line('Unzure Cup Group Stage', groupMatches);
  line('Unzure Cup Knockout', args.knockoutMatches || []);

  // v5: Division 2 and the new cups. A cup that was never started is ignored.
  const v5 = args.v5, nm = args.v5Names || {};
  if (v5) {
    (v5.d2 || []).forEach((l: any) => { if ((l.memberIds || []).length > 0) line(l.name || 'Division 2', l.matches || []); });
    if (v5.champsCup) line(nm.champsCup || 'Champs Cup', v5.champsCup.matches || []);
    if (v5.leagueCup && (v5.leagueCup.rounds || []).length > 0) {
      const ms = (v5.leagueCup.rounds as any[]).flat();
      if (!v5.leagueCup.championId) out.push(`${nm.leagueCup || 'League Cup'} (${ms.filter(isDone).length}/${ms.length} matches played, bracket not finished)`);
    }
    Object.entries(v5.miniCups || {}).forEach(([k, ms]: any) => line(`${nm.miniCup || 'Mini Cup'} (league ${k})`, ms || []));
    if (v5.superA) line(nm.superCupA || 'Super Cup A', [v5.superA]);
    line(nm.superCupB || 'Super Cup B', v5.superB || []);
  }
  return out;
}
