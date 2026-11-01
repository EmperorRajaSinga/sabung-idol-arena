import React, { useMemo } from 'react';
import type { ArchivedMatch, Idol } from '../types';
import type { V5PromotionHistoryEntry, V5TitleArchive } from '../utils/v5/store';

type SectionKey = 'Crown Cup' | 'Open Arena Cup' | 'Spotlight Cup' | 'Super Cup A' | 'Super Cup B' | 'Division 2';
type Row = {
  idolId: string; idolName: string; group: string; photo?: string;
  events: Set<string>; matches: number; wins: number; draws: number; losses: number;
  points: number; titles: number; runnerUps: number; thirdFourth: number;
  promotions: number; relegations: number;
};
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
  v5TitleArchives?: V5TitleArchive[];
  promotionHistory?: V5PromotionHistoryEntry[];
}> = ({ section, matchDatabase = [], idols = [], v5TitleArchives = [], promotionHistory = [] }) => {
  const idolMap = useMemo(() => new Map(
    (Array.isArray(idols) ? idols : []).filter((idol) => idol && idol.id).map((idol) => [idol.id, idol])
  ), [idols]);

  const rows = useMemo(() => {
    const table = new Map<string, Row>();
    const getRow = (id: string, name?: string, group?: string, photo?: string) => {
      const idol = idolMap.get(id);
      const row = table.get(id) || {
        idolId: id, idolName: idol?.name || name || 'Unknown Idol',
        group: group || idol?.girlGroup || 'Solo', photo: photo || idol?.photoUrl,
        events: new Set<string>(), matches: 0, wins: 0, draws: 0, losses: 0,
        points: 0, titles: 0, runnerUps: 0, thirdFourth: 0, promotions: 0, relegations: 0,
      };
      table.set(id, row);
      return row;
    };

    const seenMatches = new Set<string>();
    (Array.isArray(matchDatabase) ? matchDatabase : []).forEach((match) => {
      if (!match || readSection(match) !== section || !match.idolAId || !match.idolBId ||
          match.scoreA == null || match.scoreB == null) return;
      const key = String(match.matchId || [match.seasonId, match.stage, match.idolAId, match.idolBId].join('|'));
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      const season = Number(match.seasonId);
      const eventName = String(match.stage || '').split('/')[0].trim();
      const eventKey = `${Number.isFinite(season) ? season : 'unknown'}:${eventName}`;
      const scoreA = Number(match.scoreA), scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
      const a = getRow(match.idolAId, match.idolAName, match.idolAGroup, match.idolAPhoto);
      const b = getRow(match.idolBId, match.idolBName, match.idolBGroup, match.idolBPhoto);
      [a, b].forEach((row) => { row.events.add(eventKey); row.matches += 1; });
      if (scoreA > scoreB) { a.wins += 1; b.losses += 1; if (section === 'Division 2') a.points += 3; }
      else if (scoreB > scoreA) { b.wins += 1; a.losses += 1; if (section === 'Division 2') b.points += 3; }
      else { a.draws += 1; b.draws += 1; if (section === 'Division 2') { a.points += 1; b.points += 1; } }

      if (section !== 'Division 2') {
        const stage = String(match.stage || '').toLowerCase();
        if (/semi[ -]?final/.test(stage)) { if (match.winnerId === a.idolId) b.thirdFourth += 1; else if (match.winnerId === b.idolId) a.thirdFourth += 1; }
      }
    });

    (v5TitleArchives || []).forEach((record) => {
      const name = String(record.competition || '').toLowerCase();
      const matchesSection = section === 'Division 2'
        ? record.isDivision && name.startsWith('division 2')
        : !record.isDivision && (
          (section === 'Crown Cup' && name === 'league champions cup') ||
          (section === 'Open Arena Cup' && name === 'all-league knockout cup') ||
          (section === 'Spotlight Cup' && name.startsWith('top 16 mini cup')) ||
          (section === 'Super Cup A' && name === 'super cup a') ||
          (section === 'Super Cup B' && name.startsWith('super cup b'))
        );
      if (!matchesSection) return;
      const season = Number(record.seasonNumber);
      if (record.winnerId) {
        const row = getRow(record.winnerId, record.winnerName, record.winnerGroup, record.winnerPhoto);
        row.titles += 1;
        if (row.events.size === 0) row.events.add(`${Number.isFinite(season) ? season : 'unknown'}:${record.competition}`);
      }
      if (record.runnerUpId) {
        const row = getRow(record.runnerUpId, record.runnerUpName, record.runnerUpGroup, record.runnerUpPhoto);
        row.runnerUps += 1;
        if (row.events.size === 0) row.events.add(`${Number.isFinite(season) ? season : 'unknown'}:${record.competition}`);
      }
    });

    if (section === 'Division 2') {
      (promotionHistory || []).forEach((entry) => {
        const season = Number(entry.seasonNumber);
        (entry.moves || []).forEach((move) => {
          (move.promoted || []).forEach((id) => {
            const row = getRow(id);
            row.promotions += 1;
          });
          (move.relegated || []).forEach((id) => {
            const row = getRow(id);
            row.relegations += 1;
          });
        });
      });
    }

    return [...table.values()].map((row) => ({
      ...row, participation: row.events.size,
      winRate: row.matches ? row.wins / row.matches * 100 : 0,
    })).sort((a, b) => section === 'Division 2'
      ? b.points - a.points || b.wins - a.wins || a.idolName.localeCompare(b.idolName)
      : b.titles - a.titles || b.runnerUps - a.runnerUps || b.thirdFourth - a.thirdFourth || b.participation - a.participation || a.idolName.localeCompare(b.idolName));
  }, [matchDatabase, section, idolMap, v5TitleArchives, promotionHistory]);

  const totals = useMemo(() => rows.reduce((sum, row) => ({
    participants: sum.participants + (row.participation > 0 ? 1 : 0),
    matches: sum.matches + row.matches, wins: sum.wins + row.wins,
    titles: sum.titles + row.titles, runnerUps: sum.runnerUps + row.runnerUps,
    promotions: sum.promotions + row.promotions, relegations: sum.relegations + row.relegations,
  }), { participants: 0, matches: 0, wins: 0, titles: 0, runnerUps: 0, promotions: 0, relegations: 0 }), [rows]);
  const isDivision = section === 'Division 2';

  return <div className="space-y-4">
    <div>
      <h3 className="text-lg font-black text-amber-300">{section} Career Statistics</h3>
      <p className="mt-1 text-xs text-slate-400">{isDivision
        ? 'Division 2 career record with league performance, titles, promotions and relegations.'
        : 'Competition participation and final placements across archived seasons.'}</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        ['Participants', totals.participants],
        ['Matches', totals.matches],
        [isDivision ? 'Promotions' : 'Titles', isDivision ? totals.promotions : totals.titles],
        [isDivision ? 'Relegations' : 'Runner-up', isDivision ? totals.relegations : totals.runnerUps],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-black text-amber-300">{value}</div>
      </div>)}
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
      <table className="w-full min-w-[760px] text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 py-3">Rank</th><th className="px-4 py-3">Idol</th>
            {isDivision ? <>
              <th className="px-3 py-3 text-center">Seasons</th><th className="px-3 py-3 text-center">Played</th>
              <th className="px-3 py-3 text-center">W-D-L</th><th className="px-3 py-3 text-center">Points</th>
              <th className="px-3 py-3 text-center">Titles</th><th className="px-3 py-3 text-center">Promoted</th>
              <th className="px-3 py-3 text-center">Relegated</th>
            </> : <>
              <th className="px-3 py-3 text-center">Part.</th><th className="px-3 py-3 text-center">Title</th>
              <th className="px-3 py-3 text-center">2nd</th><th className="px-3 py-3 text-center">3rd/4th</th>
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
              <td className="px-3 py-3 text-center">{row.participation}</td><td className="px-3 py-3 text-center">{row.matches}</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-300">{row.wins}-{row.draws}-{row.losses}</td>
              <td className="px-3 py-3 text-center font-black text-amber-300">{row.points}</td>
              <td className="px-3 py-3 text-center">{row.titles}</td><td className="px-3 py-3 text-center text-emerald-300">{row.promotions}</td>
              <td className="px-3 py-3 text-center text-rose-300">{row.relegations}</td>
            </> : <>
              <td className="px-3 py-3 text-center">{row.participation}</td>
              <td className="px-3 py-3 text-center font-black text-amber-300">{row.titles}</td>
              <td className="px-3 py-3 text-center">{row.runnerUps}</td><td className="px-3 py-3 text-center">{row.thirdFourth}</td>
            </>}
          </tr>)}
          {rows.length === 0 && <tr><td colSpan={isDivision ? 9 : 6} className="px-3 py-10 text-center text-slate-500">No completed {section} records found.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
};
