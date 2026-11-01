import React, { useMemo } from 'react';
import type { ArchivedMatch, Idol } from '../types';

type SectionKey = 'Crown Cup' | 'Open Arena Cup' | 'Spotlight Cup' | 'Super Cup A' | 'Super Cup B' | 'Division 2';
type Row = {
  idolId: string; idolName: string; group: string; photo?: string;
  matches: number; wins: number; draws: number; losses: number;
  points: number; scored: number; conceded: number; titles: number; runnerUps: number; podiums: number;
};
const CUP_NAMES: SectionKey[] = ['Crown Cup', 'Open Arena Cup', 'Spotlight Cup', 'Super Cup A', 'Super Cup B', 'Division 2'];
const readSection = (match: ArchivedMatch): SectionKey | null => {
  const stage = String(match?.stage || '').toLowerCase();
  if (!stage.startsWith('cups & divisions:')) return null;
  if (stage.includes('division 2')) return 'Division 2';
  if (stage.includes('league champions cup')) return 'Crown Cup';
  if (stage.includes('all-league knockout cup')) return 'Open Arena Cup';
  if (stage.includes('top 16 mini cup')) return 'Spotlight Cup';
  if (stage.includes('super cup a')) return 'Super Cup A';
  if (stage.includes('super cup b')) return 'Super Cup B';
  return null;
};

export const CareerV5StatsPanel: React.FC<{
  section: SectionKey;
  matchDatabase?: ArchivedMatch[];
  idols?: Idol[];
}> = ({ section, matchDatabase = [], idols = [] }) => {
  const idolMap = useMemo(() => new Map(
    (Array.isArray(idols) ? idols : []).filter((idol) => idol && idol.id).map((idol) => [idol.id, idol])
  ), [idols]);

  const rows = useMemo(() => {
    const table = new Map<string, Row>();
    const seen = new Set<string>();
    const finals = new Map<string, { winnerId: string; runnerUpId: string }>();
    const safeMatches = (Array.isArray(matchDatabase) ? matchDatabase : [])
      .filter((match) => match && typeof match === 'object' && readSection(match) === section);

    const getRow = (id: string, name?: string, group?: string, photo?: string) => {
      const idol = idolMap.get(id);
      const row = table.get(id) || {
        idolId: id, idolName: idol?.name || name || 'Unknown Idol',
        group: idol?.girlGroup || group || 'Solo', photo: idol?.photoUrl || photo,
        matches: 0, wins: 0, draws: 0, losses: 0, points: 0,
        scored: 0, conceded: 0, titles: 0, runnerUps: 0, podiums: 0,
      };
      table.set(id, row);
      return row;
    };

    safeMatches.forEach((match) => {
      if (!match.idolAId || !match.idolBId || match.scoreA == null || match.scoreB == null) return;
      const key = String(match.matchId || [
        match.seasonId, match.stage, match.idolAId, match.idolBId, match.scoreA, match.scoreB,
      ].join('|'));
      if (seen.has(key)) return;
      seen.add(key);

      const scoreA = Number(match.scoreA), scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
      const sides = [
        { id: match.idolAId, name: match.idolAName, group: match.idolAGroup, photo: match.idolAPhoto, score: scoreA, against: scoreB },
        { id: match.idolBId, name: match.idolBName, group: match.idolBGroup, photo: match.idolBPhoto, score: scoreB, against: scoreA },
      ];
      sides.forEach((side) => {
        const row = getRow(side.id, side.name, side.group, side.photo);
        row.matches += 1;
        row.scored += side.score;
        row.conceded += side.against;
        if (side.score > side.against) { row.wins += 1; row.points += section === 'Division 2' ? 3 : 0; }
        else if (side.score === side.against) { row.draws += 1; row.points += section === 'Division 2' ? 1 : 0; }
        else row.losses += 1;
      });

      if (section !== 'Division 2') {
        const detail = String(match.stage || '').split(' / ').slice(1).join(' / ').toLowerCase();
        if (/^(?:grand\\s+)?final(?:\\b|\\s|$)/.test(detail) || detail === 'super cup') {
          const winner = match.winnerId || (scoreA > scoreB ? match.idolAId : scoreB > scoreA ? match.idolBId : '');
          const runner = match.loserId || (winner === match.idolAId ? match.idolBId : match.idolAId);
          if (winner) finals.set(String(match.seasonId || 1), { winnerId: winner, runnerUpId: runner });
        }
      }
    });

    if (section === 'Division 2') {
      const bySeason = new Map<string, Row[]>();
      table.forEach((row) => {
        // Match rows from multiple seasons are aggregated for career totals. Titles are awarded
        // from the season-specific standings below, not once per match.
        bySeason.set('career', [...(bySeason.get('career') || []), row]);
      });
      // Division 2 historical archive records carry the season in each match. Compute each
      // season's table independently so a champion is counted once per completed season.
      const seasonTables = new Map<string, Map<string, { points: number; diff: number; scored: number }>>();
      const seasonSeen = new Set<string>();
      safeMatches.forEach((match) => {
        if (!match.idolAId || !match.idolBId || match.scoreA == null || match.scoreB == null) return;
        const seasonMatchKey = String(match.matchId || [match.seasonId, match.idolAId, match.idolBId, match.scoreA, match.scoreB].join('|'));
        if (seasonSeen.has(seasonMatchKey)) return;
        seasonSeen.add(seasonMatchKey);
        const season = String(match.seasonId || 1);
        if (!seasonTables.has(season)) seasonTables.set(season, new Map());
        const seasonTable = seasonTables.get(season)!;
        const a = Number(match.scoreA), b = Number(match.scoreB);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return;
        const update = (id: string, scored: number, conceded: number) => {
          const current = seasonTable.get(id) || { points: 0, diff: 0, scored: 0 };
          current.points += scored > conceded ? 3 : scored === conceded ? 1 : 0;
          current.diff += scored - conceded;
          current.scored += scored;
          seasonTable.set(id, current);
        };
        update(match.idolAId, a, b); update(match.idolBId, b, a);
      });
      seasonTables.forEach((seasonTable) => {
        const ranking = [...seasonTable.entries()].sort((a, b) =>
          b[1].points - a[1].points || b[1].diff - a[1].diff || b[1].scored - a[1].scored
        );
        ranking.forEach(([id], index) => {
          const row = table.get(id);
          if (!row) return;
          if (index === 0) { row.titles += 1; row.podiums += 1; }
          else if (index < 3) row.podiums += 1;
        });
      });
    } else {
      finals.forEach(({ winnerId, runnerUpId }) => {
        const winner = table.get(winnerId);
        if (winner) { winner.titles += 1; winner.podiums += 1; }
        const runner = table.get(runnerUpId);
        if (runner) { runner.runnerUps += 1; runner.podiums += 1; }
      });
    }
    return [...table.values()].map((row) => ({
      ...row, goalDiff: row.scored - row.conceded,
      winRate: row.matches ? row.wins / row.matches * 100 : 0,
    })).sort((a, b) => section === 'Division 2'
      ? b.points - a.points || b.goalDiff - a.goalDiff || b.scored - a.scored || a.idolName.localeCompare(b.idolName)
      : b.titles - a.titles || b.wins - a.wins || b.winRate - a.winRate || a.idolName.localeCompare(b.idolName));
  }, [matchDatabase, section, idolMap]);

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    matches: sum.matches + row.matches,
    wins: sum.wins + row.wins,
    draws: sum.draws + row.draws,
    losses: sum.losses + row.losses,
    titles: sum.titles + row.titles,
  }), { matches: 0, wins: 0, draws: 0, losses: 0, titles: 0 }), [rows]);
  const isDivision = section === 'Division 2';

  return <div className="space-y-4">
    <div>
      <h3 className="text-lg font-black text-amber-300">{section} Career Statistics</h3>
      <p className="mt-1 text-xs text-slate-400">{isDivision
        ? 'All-time Division 2 league record. Standings rank by points, goal difference, then goals scored.'
        : 'All-time competition record calculated from completed matches and recorded finals.'}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ['Participants', rows.length],
        ['Matches', totals.matches],
        ['Wins', totals.wins],
        [isDivision ? 'Division Titles' : 'Titles', totals.titles],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-black text-amber-300">{value}</div>
      </div>)}
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
      <table className="w-full min-w-[900px] text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 py-3">Rank</th><th className="px-4 py-3">Idol</th>
            {isDivision ? <>
              <th className="px-3 py-3 text-center">Played</th><th className="px-3 py-3 text-center">W-D-L</th>
              <th className="px-3 py-3 text-center">Points</th><th className="px-3 py-3 text-center">Titles</th>
              <th className="px-3 py-3 text-center">Podiums</th><th className="px-3 py-3 text-center">Win %</th>
              <th className="px-3 py-3 text-center">GF-GA</th><th className="px-3 py-3 text-center">GD</th>
            </> : <>
              <th className="px-3 py-3 text-center">Matches</th><th className="px-3 py-3 text-center">W-D-L</th>
              <th className="px-3 py-3 text-center">Titles</th><th className="px-3 py-3 text-center">Runner-up</th>
              <th className="px-3 py-3 text-center">Win %</th><th className="px-3 py-3 text-center">Points For</th>
              <th className="px-3 py-3 text-center">Points Against</th><th className="px-3 py-3 text-center">Point Diff.</th>
            </>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row, index) => <tr key={row.idolId} className="hover:bg-slate-800/40">
            <td className="px-3 py-3 font-black text-amber-300">{index + 1}</td>
            <td className="px-4 py-3"><div className="flex items-center gap-2.5">
              {row.photo ? <img src={row.photo} alt="" className="h-8 w-8 rounded-lg border border-slate-700 object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold">{row.idolName.slice(0, 2)}</div>}
              <div><div className="font-bold text-white">{row.idolName}</div><div className="text-[10px] text-slate-400">{row.group}</div></div>
            </div></td>
            {isDivision ? <>
              <td className="px-3 py-3 text-center">{row.matches}</td><td className="px-3 py-3 text-center font-bold text-emerald-300">{row.wins}-{row.draws}-{row.losses}</td>
              <td className="px-3 py-3 text-center font-black text-amber-300">{row.points}</td><td className="px-3 py-3 text-center">{row.titles}</td>
              <td className="px-3 py-3 text-center">{row.podiums}</td><td className="px-3 py-3 text-center">{row.winRate.toFixed(1)}%</td>
              <td className="px-3 py-3 text-center">{row.scored}-{row.conceded}</td><td className="px-3 py-3 text-center">{row.goalDiff > 0 ? '+' : ''}{row.goalDiff}</td>
            </> : <>
              <td className="px-3 py-3 text-center">{row.matches}</td><td className="px-3 py-3 text-center font-bold text-emerald-300">{row.wins}-{row.draws}-{row.losses}</td>
              <td className="px-3 py-3 text-center font-black text-amber-300">{row.titles}</td><td className="px-3 py-3 text-center">{row.runnerUps}</td>
              <td className="px-3 py-3 text-center">{row.winRate.toFixed(1)}%</td><td className="px-3 py-3 text-center">{row.scored}</td>
              <td className="px-3 py-3 text-center">{row.conceded}</td><td className="px-3 py-3 text-center">{row.goalDiff > 0 ? '+' : ''}{row.goalDiff}</td>
            </>}
          </tr>)}
          {rows.length === 0 && <tr><td colSpan={isDivision ? 10 : 10} className="px-3 py-10 text-center text-slate-500">No completed {section} records found.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
};
