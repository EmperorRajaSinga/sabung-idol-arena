import React, { useMemo, useState } from 'react';
import type { ArchivedMatch, Idol } from '../types';

type CompetitionRow = { idolId: string; idolName: string; group: string; photo?: string; matches: number; wins: number; losses: number; scored: number; conceded: number; titles: number };
const competitionNames = ['League Champions Cup', 'All-League Knockout Cup', 'Top 16 Mini Cup', 'Super Cup A', 'Super Cup B'];
const getCompetition = (match: ArchivedMatch) => {
  const stage = String(match.stage || '');
  if (!stage.startsWith('Cups & Divisions:')) return null;
  const detail = stage.slice('Cups & Divisions:'.length).trim();
  if (detail.startsWith('Division 2')) return null;
  const name = detail.split(' / ')[0].trim();
  return competitionNames.find((candidate) => name.startsWith(candidate)) || null;
};

export const V5CompetitionStatsPanel: React.FC<{ matchDatabase: ArchivedMatch[]; idols?: Idol[]; compact?: boolean }> = ({ matchDatabase = [], idols = [], compact = false }) => {
  const [activeCompetition, setActiveCompetition] = useState('All Competitions');
  const [search, setSearch] = useState('');
  const safeIdols = Array.isArray(idols) ? idols.filter((idol): idol is Idol => Boolean(idol && idol.id)) : [];
  const idolMap = useMemo(() => new Map(safeIdols.map((idol) => [idol.id, idol])), [safeIdols]);
  const allRows = useMemo(() => {
    const map = new Map<string, CompetitionRow>();
    (Array.isArray(matchDatabase) ? matchDatabase : []).forEach((match) => {
      if (!match || typeof match !== 'object') return;
      const competition = getCompetition(match);
      if (!competition || !match.idolAId || !match.idolBId || match.scoreA == null || match.scoreB == null) return;
      const sides = [
        { id: match.idolAId, name: match.idolAName, group: match.idolAGroup, photo: match.idolAPhoto, score: Number(match.scoreA), against: Number(match.scoreB) },
        { id: match.idolBId, name: match.idolBName, group: match.idolBGroup, photo: match.idolBPhoto, score: Number(match.scoreB), against: Number(match.scoreA) },
      ];
      sides.forEach((side) => {
        if (!Number.isFinite(side.score) || !Number.isFinite(side.against)) return;
        const key = competition + '::' + side.id;
        const idol = idolMap.get(side.id);
        const row = map.get(key) || { idolId: side.id, idolName: idol?.name || side.name || 'Unknown Idol', group: idol?.girlGroup || side.group || 'Solo', photo: idol?.photoUrl || side.photo, matches: 0, wins: 0, losses: 0, scored: 0, conceded: 0, titles: 0 };
        row.matches += 1; row.scored += side.score; row.conceded += side.against;
        if (side.score > side.against) row.wins += 1; else row.losses += 1;
        if (side.score > side.against && /final/i.test(String(match.stage || '').split(' / ').slice(1).join(' '))) row.titles += 1;
        map.set(key, row);
      });
    });
    return Array.from(map.entries()).map(([key, row]) => ({ ...row, competition: key.split('::')[0] }));
  }, [matchDatabase, idolMap]);
  const rows = allRows.filter((row) => (activeCompetition === 'All Competitions' || row.competition === activeCompetition) && (String(row.idolName || '') + ' ' + String(row.group || '')).toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.wins - a.wins || b.titles - a.titles || b.matches - a.matches || a.idolName.localeCompare(b.idolName));
  const competitionCount = (name: string) => allRows.filter((row) => row.competition === name).length;
  return <section className={compact ? 'space-y-3' : 'space-y-5 rounded-2xl border-2 border-black bg-[#1a120d] p-4'}>
    <div><h3 className="text-lg font-black text-amber-300">V5 Competition Records</h3><p className="text-xs text-amber-100/60">Separate historical records for every newly added cup. Statistics use completed matches saved in the central match database.</p></div>
    <div className="flex flex-wrap gap-2">
      {['All Competitions', ...competitionNames].map((name) => <button key={name} onClick={() => setActiveCompetition(name)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${activeCompetition === name ? 'border-amber-400 bg-amber-500 text-black' : 'border-black bg-black/30 text-amber-100/70'}`}>{name}{name !== 'All Competitions' ? ` (${competitionCount(name)})` : ` (${allRows.length})`}</button>)}
    </div>
    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search idol or girl group..." className="w-full rounded-xl border border-black bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-amber-500" />
    <div className="overflow-x-auto rounded-xl border border-black">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead className="bg-black/50 text-amber-300"><tr>{['Competition','Idol','Girl Group','Matches','Wins','Losses','Win Rate','Points For','Points Against','Titles'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.competition + row.idolId} className="border-t border-white/5 text-amber-100/80">
          <td className="px-3 py-3 font-bold text-amber-300">{row.competition}</td><td className="px-3 py-3"><div className="flex items-center gap-2">{row.photo ? <img src={row.photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : null}<span className="font-bold text-white">{row.idolName}</span></div></td><td className="px-3 py-3">{row.group}</td><td className="px-3 py-3">{row.matches}</td><td className="px-3 py-3 text-emerald-300">{row.wins}</td><td className="px-3 py-3">{row.losses}</td><td className="px-3 py-3">{row.matches ? (row.wins / row.matches * 100).toFixed(1) : '0.0'}%</td><td className="px-3 py-3">{row.scored}</td><td className="px-3 py-3">{row.conceded}</td><td className="px-3 py-3 text-amber-300">{row.titles}</td>
        </tr>)}{rows.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-amber-100/40">No completed V5 competition matches found yet.</td></tr>}</tbody>
      </table>
    </div>
  </section>;
};
