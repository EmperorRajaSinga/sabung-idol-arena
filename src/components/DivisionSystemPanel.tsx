import React, { useEffect, useMemo, useState } from 'react';
import { AppState } from '../utils/storage';
import {
  DivisionSystemState,
  DivisionTable,
  initializeDivisionSystem,
  generateDivisionFixtures,
  updateDivisionStandings,
  validateDivisionSystem,
  applyPromotionRelegation,
  DIVISION_TWO_CAPACITY,
} from '../utils/divisionSystem';

interface Props {
  appState: AppState;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
}

const ratingOf = (id: string, idols: AppState['idols']) =>
  Math.max(1, Math.min(100, idols.find((idol) => idol.id === id)?.rating ?? 60));

function simulateMatch(match: any, idols: AppState['idols']) {
  const a = ratingOf(match.idolAId, idols);
  const b = ratingOf(match.idolBId, idols);
  const formBonus = () => Math.random() * 12 - 6;
  const strengthA = a + formBonus();
  const strengthB = b + formBonus();
  const gamesA = Math.max(0, Math.min(5, Math.round(2 + (strengthA - strengthB) / 18 + Math.random() * 1.5)));
  const gamesB = Math.max(0, Math.min(5, Math.round(2 + (strengthB - strengthA) / 18 + Math.random() * 1.5)));
  const scoreA = gamesA === gamesB ? (strengthA >= strengthB ? Math.min(5, gamesA + 1) : gamesA) : gamesA;
  const scoreB = gamesA === gamesB ? (strengthB > strengthA ? Math.min(5, gamesB + 1) : gamesB) : gamesB;
  const finalA = scoreA === scoreB ? Math.min(5, scoreA + 1) : scoreA;
  return {
    ...match,
    scoreA: finalA,
    scoreB: scoreB,
    winnerId: finalA > scoreB ? match.idolAId : match.idolBId,
    completed: true,
    updatedAt: new Date().toISOString(),
  };
}

export const DivisionSystemPanel: React.FC<Props> = ({ appState, onUpdateAppState }) => {
  const [selectedLeague, setSelectedLeague] = useState(1);
  const [selectedTier, setSelectedTier] = useState<1 | 2>(1);
  const [notice, setNotice] = useState('');
  const system = useMemo(() => {
    if (appState.divisionSystem?.initialized) {
      const branding = appState.leagueState?.leagues || [];
      return { ...appState.divisionSystem, divisions: appState.divisionSystem.divisions.map((division) => {
        const league = branding.find((item) => item.id === division.leagueId);
        if (!league) return division;
        if (division.tier === 1) return { ...division, leagueName: league.name, memberIds: [...league.memberIds], matches: [...league.matches], standings: [...league.standings] };
        return { ...division, leagueName: league.name };
      }) };
    }
    return initializeDivisionSystem(
      appState.leagueState?.leagues || [],
      appState.idols,
      appState.config.seasonNumber || 1
    );
  }, [appState.divisionSystem, appState.leagueState, appState.idols, appState.config.seasonNumber]);

  useEffect(() => {
    if (!appState.divisionSystem?.initialized && system.divisions.length) {
      onUpdateAppState((prev) => ({ ...prev, divisionSystem: system }));
    }
  }, [appState.divisionSystem, system, onUpdateAppState]);

  const active = system.divisions.find((d) => d.leagueId === selectedLeague && d.tier === selectedTier);
  const errors = validateDivisionSystem(system, appState.idols);
  const assigned = new Set(system.divisions.flatMap((d) => d.memberIds));
  const available = appState.idols.filter((idol) => !idol.inactive && !assigned.has(idol.id));
  const idolMap = new Map<string, Idol>(appState.idols.map((idol) => [idol.id, idol]));
  const update = (next: DivisionSystemState, message: string) => {
    onUpdateAppState((prev) => ({ ...prev, divisionSystem: next }));
    setNotice(message);
  };

  const changeRoster = (division: DivisionTable, idolId: string, add: boolean) => {
    if (!idolId) return;
    if (add && division.memberIds.length >= division.capacity) {
      setNotice('Division sudah mencapai kapasitas.');
      return;
    }
    const divisions = system.divisions.map((item) =>
      item.leagueId === division.leagueId && item.tier === division.tier
        ? { ...item, memberIds: add ? [...item.memberIds, idolId] : item.memberIds.filter((id) => id !== idolId), matches: [], standings: [] }
        : item
    );
    update({ ...system, divisions }, add ? 'Idol ditambahkan.' : 'Idol dikeluarkan dari division.');
  };

  const createFixtures = () => {
    const hasPlayedMatches = system.divisions.some((division) => division.matches.some((match) => match.completed));
    if (hasPlayedMatches) {
      alert('Jadwal tidak dapat dibuat ulang karena sudah ada pertandingan yang selesai. Reset musim terlebih dahulu agar hasil tidak hilang.');
      return;
    }
    const next = generateDivisionFixtures(system);
    update(next, 'Jadwal liga dibuat untuk seluruh division yang memiliki roster.');
  };

  const simulateAll = () => {
    const divisions = system.divisions.map((division) => ({
      ...division,
      matches: division.matches.map((match) => match.completed ? match : simulateMatch(match, appState.idols)),
    }));
    const next = updateDivisionStandings({ ...system, divisions }, appState.idols);
    update(next, 'Seluruh pertandingan division telah disimulasikan.');
  };

  const simulateDivision = () => {
    if (!active) return;
    const divisions = system.divisions.map((division) =>
      division.leagueId === active.leagueId && division.tier === active.tier
        ? { ...division, matches: division.matches.map((match) => match.completed ? match : simulateMatch(match, appState.idols)) }
        : division
    );
    update(updateDivisionStandings({ ...system, divisions }, appState.idols), 'Pertandingan division ini selesai disimulasikan.');
  };

  const canRollover = system.divisions.length === 12 && system.divisions.every((division) => division.matches.length > 0 && division.matches.every((match) => match.completed) && division.standings.length >= 3);
  const allMatches = system.divisions.reduce((sum, division) => sum + division.matches.length, 0);
  const playedMatches = system.divisions.reduce((sum, division) => sum + division.matches.filter((match) => match.completed).length, 0);

  return (
    <div className="min-h-full bg-[#120e0b] p-4 md:p-7 text-amber-50 space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">Competition structure</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">League Structure</h2>
          <p className="mt-2 text-sm text-slate-400">Six existing leagues, each with a connected Division 1 and Division 2.</p>
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          <span className="rounded-lg bg-[#241b15] px-3 py-2">12 divisions</span>
          <span className="rounded-lg bg-[#241b15] px-3 py-2">D2 capacity: {DIVISION_TWO_CAPACITY}</span>
          <span className="rounded-lg bg-[#241b15] px-3 py-2">{playedMatches}/{allMatches} matches</span>
        </div>
      </header>

      {notice && <p className="text-sm text-emerald-300">{notice}</p>}
      {errors.length > 0 && <div className="rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{errors.slice(0, 5).join(' ')}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {(appState.leagueState?.leagues || []).map((league) => (
          <button key={league.id} onClick={() => setSelectedLeague(league.id)}
            className={`rounded-lg px-3 py-3 text-left ${selectedLeague === league.id ? 'bg-red-800 text-white' : 'bg-[#211912] text-amber-100 hover:bg-[#34251b]'}`}>
            <span className="block text-xs opacity-70">LEAGUE {league.id}</span>
            <strong className="block text-sm mt-1">{league.name}</strong>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSelectedTier(1)} className={`rounded-lg px-4 py-2 text-sm font-bold ${selectedTier === 1 ? 'bg-amber-500 text-black' : 'bg-[#2a2119]'}`}>Division 1</button>
        <button onClick={() => setSelectedTier(2)} className={`rounded-lg px-4 py-2 text-sm font-bold ${selectedTier === 2 ? 'bg-amber-500 text-black' : 'bg-[#2a2119]'}`}>Division 2</button>
      </div>

      {active && (
        <section className="rounded-xl bg-[#1b1510] p-4 md:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">{active.leagueName} · Division {active.tier}</h3>
              <p className="text-xs text-slate-400 mt-1">{active.memberIds.length}/{active.capacity} idols</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={createFixtures} className="rounded-lg bg-[#3a2a1c] px-3 py-2 text-xs font-bold hover:bg-[#513a24]">Generate all fixtures</button>
              <button onClick={simulateDivision} disabled={!active.matches.length} className="rounded-lg bg-red-800 px-3 py-2 text-xs font-bold disabled:opacity-40">Simulate this division</button>
              <button onClick={simulateAll} disabled={!allMatches} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-40">Simulate all divisions</button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">Roster management</h4>
              <div className="flex gap-2">
                <select id="division-add-idol" defaultValue="" className="min-w-0 flex-1 rounded-lg bg-[#0f0c09] border border-[#51402e] px-3 py-2 text-sm">
                  <option value="">Select idol for this division</option>
                  {available.map((idol) => <option key={idol.id} value={idol.id}>{idol.name} · {idol.girlGroup}</option>)}
                </select>
                <button onClick={() => {
                  const select = document.getElementById('division-add-idol') as HTMLSelectElement | null;
                  if (select?.value) changeRoster(active, select.value, true);
                }} disabled={active.memberIds.length >= active.capacity || available.length === 0}
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold disabled:opacity-40">Add</button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-[#34271d]">
                {active.memberIds.map((id) => {
                  const idol = idolMap.get(id);
                  return <div key={id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{idol?.name || id}</p><p className="text-xs text-slate-500">{idol?.girlGroup || 'Unknown'} · Rating {idol?.rating ?? 60}</p></div>
                    <button onClick={() => changeRoster(active, id, false)} className="text-xs text-red-300 hover:text-red-200">Remove</button>
                  </div>;
                })}
                {!active.memberIds.length && <p className="py-5 text-sm text-slate-500">No idols assigned.</p>}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400">Standings</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500"><tr><th className="py-2 text-left">#</th><th className="text-left">Idol</th><th className="text-center">P</th><th className="text-center">W</th><th className="text-center">D</th><th className="text-center">L</th><th className="text-right">Pts</th></tr></thead>
                  <tbody>{active.standings.map((row) => <tr key={row.idolId} className="border-t border-[#34271d]"><td className="py-2">{row.rank}</td><td className="font-semibold">{row.idolName}</td><td className="text-center">{row.played}</td><td className="text-center">{row.wins}</td><td className="text-center">{row.draws}</td><td className="text-center">{row.losses}</td><td className="text-right font-bold">{row.points}</td></tr>)}</tbody>
                </table>
                {!active.standings.length && <p className="py-5 text-sm text-slate-500">Standings appear after matches are played.</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl bg-[#1b1510] p-4 md:p-6">
        <h3 className="font-bold text-lg">Promotion and relegation</h3>
        <p className="text-sm text-slate-400 mt-1">The season rollover engine moves the bottom 3 from each D1 to the same league's D2, and the top 3 from that D2 to its D1. It does not move idols across league identities.</p>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button disabled={!canRollover} onClick={() => update(applyPromotionRelegation(system, system.seasonNumber + 1), 'Season rollover complete. Promotion and relegation applied.')} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">Apply 3-up / 3-down and advance season</button>
          {!canRollover && <span className="text-xs text-slate-500">Complete all 12 division schedules and generate standings before advancing.</span>}
        </div>
        {system.lastMovement && <p className="mt-3 text-sm text-emerald-300">Last movement processed after Season {system.lastMovement.seasonNumber}: {system.lastMovement.promoted.reduce((n, x) => n + x.idolIds.length, 0)} promoted, {system.lastMovement.relegated.reduce((n, x) => n + x.idolIds.length, 0)} relegated.</p>}
      </section>
    </div>
  );
};
