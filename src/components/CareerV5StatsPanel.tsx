import React, { useMemo } from 'react';
import type { ArchivedMatch, Idol } from '../types';
import type { V5PromotionHistoryEntry, V5TitleArchive } from '../utils/v5/store';

type SectionKey = 'Crown Cup' | 'Open Arena Cup' | 'Spotlight Cup' | 'Super Cup A' | 'Super Cup B' | 'Division 2';
type Row = {
  idolId: string; idolName: string; group: string; photo?: string;
  events: Set<string>; matches: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; gameDiff: number; points: number; winResults: Array<{ date: string; season: number; won: boolean }>;
  titles: number; runnerUps: number; thirdPlaces: number; top4: number;
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
const eventNameFromStage = (stage: string) => String(stage || '').split('/')[0].trim();

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
        goalsFor: 0, goalsAgainst: 0, gameDiff: 0, points: 0, winResults: [],
        titles: 0, runnerUps: 0, thirdPlaces: 0, top4: 0, promotions: 0, relegations: 0,
      };
      table.set(id, row);
      return row;
    };

    const seenMatches = new Set<string>();
    const sectionMatches = (Array.isArray(matchDatabase) ? matchDatabase : [])
      .filter((match) => match && readSection(match) === section && match.idolAId && match.idolBId &&
        match.scoreA != null && match.scoreB != null)
      .slice()
      .sort((a, b) => Number(a.seasonId || 0) - Number(b.seasonId || 0) ||
        String(a.date || '').localeCompare(String(b.date || '')) ||
        String(a.matchId || '').localeCompare(String(b.matchId || '')));

    sectionMatches.forEach((match) => {
      const key = String(match.matchId || [match.seasonId, match.stage, match.idolAId, match.idolBId].join('|'));
      if (seenMatches.has(key)) return;
      seenMatches.add(key);
      const season = Number(match.seasonId);
      const eventName = eventNameFromStage(match.stage);
      const eventKey = `${Number.isFinite(season) ? season : 'unknown'}:${eventName}`;
      const scoreA = Number(match.scoreA), scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
      const a = getRow(match.idolAId, match.idolAName, match.idolAGroup, match.idolAPhoto);
      const b = getRow(match.idolBId, match.idolBName, match.idolBGroup, match.idolBPhoto);
      [a, b].forEach((row) => {
        row.events.add(eventKey); row.matches += 1;
      });
      a.goalsFor += scoreA; a.goalsAgainst += scoreB;
      b.goalsFor += scoreB; b.goalsAgainst += scoreA;
      a.gameDiff += scoreA - scoreB; b.gameDiff += scoreB - scoreA;
      if (scoreA > scoreB) {
        a.wins += 1; b.losses += 1;
        if (section === 'Division 2') a.points += 3;
        a.winResults.push({ date: String(match.date || ''), season, won: true });
        b.winResults.push({ date: String(match.date || ''), season, won: false });
      } else if (scoreB > scoreA) {
        b.wins += 1; a.losses += 1;
        if (section === 'Division 2') b.points += 3;
        b.winResults.push({ date: String(match.date || ''), season, won: true });
        a.winResults.push({ date: String(match.date || ''), season, won: false });
      } else {
        a.draws += 1; b.draws += 1;
        if (section === 'Division 2') { a.points += 1; b.points += 1; }
        a.winResults.push({ date: String(match.date || ''), season, won: false });
        b.winResults.push({ date: String(match.date || ''), season, won: false });
      }

      if (section !== 'Division 2' && /semi[ -]?final/.test(String(match.stage || '').toLowerCase())) {
        a.top4 += 1; b.top4 += 1;
        if (scoreA > scoreB) b.thirdPlaces += 1;
        else if (scoreB > scoreA) a.thirdPlaces += 1;
      }
    });

    (Array.isArray(v5TitleArchives) ? v5TitleArchives : []).forEach((record) => {
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
      const eventKey = `${Number.isFinite(season) ? season : 'unknown'}:${record.competition}`;
      if (record.winnerId) {
        const row = getRow(record.winnerId, record.winnerName, record.winnerGroup, record.winnerPhoto);
        row.titles += 1;
        row.events.add(eventKey);
      }
      if (record.runnerUpId) {
        const row = getRow(record.runnerUpId, record.runnerUpName, record.runnerUpGroup, record.runnerUpPhoto);
        row.runnerUps += 1;
        row.events.add(eventKey);
      }
    });

    if (section === 'Division 2') {
      (Array.isArray(promotionHistory) ? promotionHistory : []).forEach((entry) => {
        (entry.moves || []).forEach((move) => {
          (move.promoted || []).forEach((id) => getRow(id).promotions += 1);
          (move.relegated || []).forEach((id) => getRow(id).relegations += 1);
        });
      });
    }

    return [...table.values()].map((row) => {
      const orderedResults = row.winResults.slice().sort((a, b) =>
        a.season - b.season || a.date.localeCompare(b.date));
      let currentStreak = 0, longestWinStreak = 0;
      orderedResults.forEach((result) => {
        currentStreak = result.won ? currentStreak + 1 : 0;
        longestWinStreak = Math.max(longestWinStreak, currentStreak);
      });
      return {
        ...row,
        participation: row.events.size,
        winRate: row.matches ? Math.round(row.wins / row.matches * 100) : 0,
        longestWinStreak,
        podiums: row.promotions,
      };
    }).sort((a, b) => section === 'Division 2'
      ? b.points - a.points || b.wins - a.wins || a.idolName.localeCompare(b.idolName)
      : b.titles - a.titles || b.runnerUps - a.runnerUps || b.thirdPlaces - a.thirdPlaces ||
        b.top4 - a.top4 || b.participation - a.participation || a.idolName.localeCompare(b.idolName));
  }, [matchDatabase, section, idolMap, v5TitleArchives, promotionHistory]);

  const isDivision = section === 'Division 2';

  return <div className="space-y-4">
    <div>
      <h3 className="text-lg font-black text-amber-300">{section} Career Statistics</h3>
      <p className="mt-1 text-xs text-slate-400">{isDivision
        ? 'Division 2 career record with league performance, titles, podiums, promotions and relegations.'
        : 'Competition participation, final placements and match performance across archived seasons.'}</p>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80">
      <table className="w-full min-w-[900px] text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 py-3">Rank</th><th className="px-4 py-3">Idol</th>
            {isDivision ? <>
              <th className="px-3 py-3 text-center font-bold text-amber-400">Points</th>
              <th className="px-3 py-3 text-center font-bold text-yellow-300">Titles</th>
              <th className="px-3 py-3 text-center font-bold text-emerald-400">Podiums</th>
              <th className="px-3 py-3 text-center">Played</th>
              <th className="px-3 py-3 text-center font-bold text-emerald-300">W-D-L</th>
              <th className="px-3 py-3 text-center font-bold text-amber-300">Win %</th>
              <th className="px-3 py-3 text-center font-mono">GF-GA</th>
              <th className="px-3 py-3 text-center font-mono">Diff</th>
              <th className="px-3 py-3 text-center font-bold text-emerald-300">Promoted</th>
              <th className="px-3 py-3 text-center font-bold text-rose-300">Relegated</th>
            </> : <>
              <th className="px-3 py-3 text-center">Part.</th>
              <th className="px-3 py-3 text-center font-bold text-amber-400">Titles</th>
              <th className="px-3 py-3 text-center">2nd</th>
              <th className="px-3 py-3 text-center">3rd</th>
              <th className="px-3 py-3 text-center">Top 4</th>
              <th className="px-3 py-3 text-center">Matches</th>
              <th className="px-3 py-3 text-center font-bold text-emerald-400">W-D-L</th>
              <th className="px-3 py-3 text-center font-bold text-indigo-400">Win %</th>
              <th className="px-3 py-3 text-center">Streak</th>
              <th className="px-3 py-3 text-center">Game Diff</th>
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
              <td className="px-3 py-3 text-center font-black text-amber-300">{row.points} PTS</td>
              <td className="px-3 py-3 text-center font-bold text-yellow-300">{row.titles}</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-400">{row.podiums}</td>
              <td className="px-3 py-3 text-center">{row.matches}</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-300">{row.wins}-{row.draws}-{row.losses}</td>
              <td className="px-3 py-3 text-center font-extrabold text-amber-300">{row.winRate}%</td>
              <td className="px-3 py-3 text-center font-mono text-slate-400">{row.goalsFor}-{row.goalsAgainst}</td>
              <td className="px-3 py-3 text-center font-mono font-bold text-slate-200">{row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-300">{row.promotions}</td>
              <td className="px-3 py-3 text-center font-bold text-rose-300">{row.relegations}</td>
            </> : <>
              <td className="px-3 py-3 text-center">{row.participation}</td>
              <td className="px-3 py-3 text-center font-black text-amber-300">{row.titles}</td>
              <td className="px-3 py-3 text-center">{row.runnerUps}</td>
              <td className="px-3 py-3 text-center text-amber-500">{row.thirdPlaces}</td>
              <td className="px-3 py-3 text-center text-indigo-300 font-bold">{row.top4}</td>
              <td className="px-3 py-3 text-center">{row.matches}</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-300">{row.wins}-{row.draws}-{row.losses}</td>
              <td className="px-3 py-3 text-center font-extrabold text-indigo-300">{row.winRate}%</td>
              <td className="px-3 py-3 text-center font-mono font-bold text-amber-300">{row.longestWinStreak} W</td>
              <td className="px-3 py-3 text-center font-mono font-bold text-slate-200">{row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}</td>
            </>}
          </tr>)}
          {rows.length === 0 && <tr><td colSpan={isDivision ? 12 : 12} className="px-3 py-10 text-center text-slate-500">No completed {section} records found.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
};
