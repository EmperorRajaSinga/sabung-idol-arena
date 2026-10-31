import React, { useState, useMemo } from 'react';
import {
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Table,
  Sparkles,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import {
  Idol,
  LeagueSeasonState,
  LeagueSeasonArchive,
  LeagueStanding,
} from '../../types';
import {
  CareerOverridesMap,
  IdolCareerOverride,
  saveCareerOverrides,
  computeDerivedBaseStatsForIdol,
} from '../../utils/databaseStudioLogic';
import { saveLeagueSeasonState, DEFAULT_LEAGUE_DEFS } from '../../utils/leagueLogic';

interface LeagueSystemEditorProps {
  leagueState: LeagueSeasonState | null;
  leagueArchives: LeagueSeasonArchive[];
  idols: Idol[];
  overrides: CareerOverridesMap;
  onSaveOverrides: (newOverrides: CareerOverridesMap) => void;
  onUpdateLeagueState: (newState: LeagueSeasonState) => void;
  onUpdateLeagueArchives: (newArchives: LeagueSeasonArchive[]) => void;
  onRefreshAllStats: () => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const LeagueSystemEditor: React.FC<LeagueSystemEditorProps> = ({
  leagueState,
  leagueArchives,
  idols,
  overrides,
  onSaveOverrides,
  onUpdateLeagueState,
  onRefreshAllStats,
  showToast,
}) => {
  // Mode: Standings Editor vs Idol League Career Records
  const [viewMode, setViewMode] = useState<'standings' | 'idol_career'>('standings');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('IPL');

  // Find active league
  const activeLeague = useMemo(() => {
    return (leagueState?.leagues || []).find((l) => l.leagueId === selectedLeagueId) || leagueState?.leagues?.[0];
  }, [leagueState?.leagues, selectedLeagueId]);

  // Local editable standings buffer
  const [editableStandings, setEditableStandings] = useState<LeagueStanding[]>([]);

  // Sync buffer when active league changes
  React.useEffect(() => {
    if (activeLeague?.standings) {
      setEditableStandings(JSON.parse(JSON.stringify(activeLeague.standings)));
    }
  }, [activeLeague?.standings, selectedLeagueId]);

  // Handle cell edit in standings
  const handleCellChange = (idolId: string, field: keyof LeagueStanding, value: any) => {
    setEditableStandings((prev) =>
      prev.map((row) => {
        if (row.idolId !== idolId) return row;
        const updated = { ...row, [field]: value };
        // Auto update gameDiff if gamesFor or gamesAgainst changed
        if (field === 'gamesFor' || field === 'gamesAgainst') {
          const gf = field === 'gamesFor' ? Number(value) : row.gamesFor;
          const ga = field === 'gamesAgainst' ? Number(value) : row.gamesAgainst;
          updated.gameDiff = gf - ga;
        }
        // Auto update points if wins or draws changed
        if (field === 'wins' || field === 'draws') {
          const w = field === 'wins' ? Number(value) : row.wins;
          const d = field === 'draws' ? Number(value) : row.draws;
          updated.points = w * 3 + d;
        }
        return updated;
      })
    );
  };

  // Save modified standings to active league state and localStorage
  const handleSaveStandings = () => {
    if (!leagueState || !activeLeague) {
      showToast('No active league state available to save.', 'error');
      return;
    }

    const updatedLeagues = (leagueState.leagues || []).map((l) => {
      if (l.leagueId !== selectedLeagueId) return l;
      return {
        ...l,
        standings: editableStandings,
      };
    });

    const newState: LeagueSeasonState = {
      ...leagueState,
      leagues: updatedLeagues,
    };

    saveLeagueSeasonState(newState);
    onUpdateLeagueState(newState);
    onRefreshAllStats();
    showToast(`Saved standings for ${activeLeague.name} successfully!`, 'success');
  };

  // Auto-sort standings by Points -> GameDiff -> GamesFor
  const handleAutoSortStandings = () => {
    const sorted = [...editableStandings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;
      return (b.wins || 0) - (a.wins || 0);
    });

    const ranked = sorted.map((row, idx) => ({
      ...row,
      rank: idx + 1,
      qualified: idx < 5,
    }));

    setEditableStandings(ranked);
    showToast(`Sorted ${activeLeague?.name || 'league'} by standard tiebreakers! Click Save to apply.`, 'info');
  };

  // Recalculate Points for all rows based on Wins & Draws
  const handleRecalcAllPoints = () => {
    const recalculated = editableStandings.map((row) => ({
      ...row,
      points: (row.wins || 0) * 3 + (row.draws || 0),
      gameDiff: (row.gamesFor || 0) - (row.gamesAgainst || 0),
      played: (row.wins || 0) + (row.draws || 0) + (row.losses || 0),
    }));
    setEditableStandings(recalculated);
    showToast('Recalculated Points, GD, and Played matches from W-D-L.', 'info');
  };

  // -------------------------------------------------------------
  // IDOL CAREER OVERRIDES SECTION
  // -------------------------------------------------------------
  const [selectedIdolId, setSelectedIdolId] = useState<string>(idols[0]?.id || '');
  const [idolSearch, setIdolSearch] = useState<string>('');

  const selectedIdol = useMemo(() => {
    return idols.find((i) => i.id === selectedIdolId) || idols[0];
  }, [idols, selectedIdolId]);

  const idolBaseDerived = useMemo(() => {
    if (!selectedIdol) return null;
    return computeDerivedBaseStatsForIdol(
      selectedIdol.id,
      [],
      leagueState,
      leagueArchives,
      null,
      []
    );
  }, [selectedIdol?.id, leagueState, leagueArchives]);

  const existingOverride = overrides[selectedIdol?.id || ''];

  const [idolLeagueForm, setIdolLeagueForm] = useState<Partial<IdolCareerOverride>>({});

  // Sync form when selected idol changes
  React.useEffect(() => {
    if (!selectedIdol) return;
    const ov = overrides[selectedIdol.id];
    const derived = idolBaseDerived?.league || {};
    setIdolLeagueForm({
      divisionTitles: ov?.divisionTitles ?? derived.divisionTitles ?? 0,
      divisionPodiums: ov?.divisionPodiums ?? derived.divisionPodiums ?? 0,
      top5Finishes: ov?.top5Finishes ?? derived.top5Finishes ?? 0,
      leagueSeasonsPlayed: ov?.leagueSeasonsPlayed ?? derived.leagueSeasonsPlayed ?? 0,
      leagueMatches: ov?.leagueMatches ?? derived.leagueMatches ?? 0,
      leagueWins: ov?.leagueWins ?? derived.leagueWins ?? 0,
      leagueDraws: ov?.leagueDraws ?? derived.leagueDraws ?? 0,
      leagueLosses: ov?.leagueLosses ?? derived.leagueLosses ?? 0,
      leaguePoints: ov?.leaguePoints ?? derived.leaguePoints ?? 0,
      leagueGoalsFor: ov?.leagueGoalsFor ?? derived.leagueGoalsFor ?? 0,
      leagueGoalsAgainst: ov?.leagueGoalsAgainst ?? derived.leagueGoalsAgainst ?? 0,
      leagueGoalDiff: ov?.leagueGoalDiff ?? derived.leagueGoalDiff ?? 0,
      leagueWinRate: ov?.leagueWinRate ?? derived.leagueWinRate ?? 0,
    });
  }, [selectedIdol?.id, overrides, idolBaseDerived]);

  const handleSaveIdolLeagueCareer = () => {
    if (!selectedIdol) return;
    const currentOv = overrides[selectedIdol.id] || { idolId: selectedIdol.id, enabled: true };
    const updated: CareerOverridesMap = {
      ...overrides,
      [selectedIdol.id]: {
        ...currentOv,
        idolId: selectedIdol.id,
        enabled: true,
        divisionTitles: idolLeagueForm.divisionTitles ?? 0,
        divisionPodiums: idolLeagueForm.divisionPodiums ?? 0,
        top5Finishes: idolLeagueForm.top5Finishes ?? 0,
        leagueSeasonsPlayed: idolLeagueForm.leagueSeasonsPlayed ?? 0,
        leagueMatches: idolLeagueForm.leagueMatches ?? 0,
        leagueWins: idolLeagueForm.leagueWins ?? 0,
        leagueDraws: idolLeagueForm.leagueDraws ?? 0,
        leagueLosses: idolLeagueForm.leagueLosses ?? 0,
        leaguePoints: idolLeagueForm.leaguePoints ?? 0,
        leagueGoalsFor: idolLeagueForm.leagueGoalsFor ?? 0,
        leagueGoalsAgainst: idolLeagueForm.leagueGoalsAgainst ?? 0,
        leagueGoalDiff: (idolLeagueForm.leagueGoalsFor ?? 0) - (idolLeagueForm.leagueGoalsAgainst ?? 0),
        leagueWinRate:
          (idolLeagueForm.leagueMatches ?? 0) > 0
            ? Math.round(((idolLeagueForm.leagueWins ?? 0) / (idolLeagueForm.leagueMatches ?? 1)) * 100)
            : 0,
        updatedAt: new Date().toISOString(),
      },
    };

    onSaveOverrides(updated);
    saveCareerOverrides(updated);
    onRefreshAllStats();
    showToast(`Saved League Career Stats for ${selectedIdol.name}!`, 'success');
  };

  const filteredIdols = useMemo(() => {
    if (!idolSearch.trim()) return idols;
    const q = idolSearch.toLowerCase().trim();
    return idols.filter((i) => i.name.toLowerCase().includes(q) || (i.girlGroup || '').toLowerCase().includes(q));
  }, [idols, idolSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-[#1b100a] border-2 border-black rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black text-amber-100 uppercase tracking-wider font-mono">
              Domestic League System Editor
            </h2>
          </div>
          <p className="text-xs text-amber-200/60">
            Fully inspect, modify, and persist standings for all 6 parallel divisions (IPL, Div 2–6) and custom idol league career records.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#100804] p-1 rounded-2xl border border-amber-500/20">
          <button
            onClick={() => setViewMode('standings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
              viewMode === 'standings'
                ? 'bg-cyan-500 text-black shadow-md font-black'
                : 'text-amber-200/70 hover:text-amber-100'
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Division Standings (6 Leagues)
          </button>
          <button
            onClick={() => setViewMode('idol_career')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
              viewMode === 'idol_career'
                ? 'bg-cyan-500 text-black shadow-md font-black'
                : 'text-amber-200/70 hover:text-amber-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Idol League Career Records
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: DIVISION STANDINGS EDITOR */}
      {/* ===================================================================== */}
      {viewMode === 'standings' && (
        <div className="space-y-5">
          {/* Division Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {DEFAULT_LEAGUE_DEFS.map((def) => {
              const isActive = selectedLeagueId === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => setSelectedLeagueId(def.id)}
                  className={`px-4 py-2.5 rounded-2xl font-mono text-xs font-bold whitespace-nowrap transition-all border-2 ${
                    isActive
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-400 shadow-lg scale-105'
                      : 'bg-[#140b07] text-amber-200/60 border-amber-500/10 hover:border-amber-500/30'
                  }`}
                >
                  <span className="font-black text-white mr-1.5">{`D${def.id}`}</span>
                  <span>{def.name}</span>
                </button>
              );
            })}
          </div>

          {/* Standings Header & Action Toolbar */}
          <div className="bg-[#140b07] border-2 border-black rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-amber-200 uppercase font-mono flex items-center gap-2">
                <span>{activeLeague?.name || 'Selected Division'}</span>
                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30 font-bold">
                  {editableStandings.length} Idols
                </span>
              </div>
              <div className="text-[11px] text-amber-200/50">
                Directly edit any cell (Played, W, D, L, Points, GF, GA). Click Save to store changes permanently.
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRecalcAllPoints}
                className="px-3 py-1.5 rounded-xl bg-[#20120a] hover:bg-[#2c1a0e] text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                title="Recalculate Points from W and D"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Auto Pts
              </button>
              <button
                onClick={handleAutoSortStandings}
                className="px-3 py-1.5 rounded-xl bg-[#20120a] hover:bg-[#2c1a0e] text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                title="Sort table by Points, GD, GF"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" /> Sort Table
              </button>
              <button
                onClick={handleSaveStandings}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono shadow-md flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" /> Save Standings
              </button>
            </div>
          </div>

          {/* Standings Table */}
          <div className="bg-[#120804] border-2 border-black rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-[#1e1008] border-b-2 border-black text-amber-200/70 font-mono text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-3 text-center w-12">#</th>
                    <th className="px-4 py-3 min-w-[200px]">Idol</th>
                    <th className="px-2 py-3 text-center w-16">Group</th>
                    <th className="px-2 py-3 text-center w-16">Pld</th>
                    <th className="px-2 py-3 text-center w-16 text-emerald-400">W</th>
                    <th className="px-2 py-3 text-center w-16 text-amber-400">D</th>
                    <th className="px-2 py-3 text-center w-16 text-rose-400">L</th>
                    <th className="px-2 py-3 text-center w-20 text-cyan-300 font-bold">Pts</th>
                    <th className="px-2 py-3 text-center w-16">GF</th>
                    <th className="px-2 py-3 text-center w-16">GA</th>
                    <th className="px-2 py-3 text-center w-16">GD</th>
                    <th className="px-3 py-3 text-center w-20">Qualified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-500/10 font-mono">
                  {editableStandings.map((row, idx) => {
                    const isTop5 = idx < 5;
                    const isPlayIn = idx === 5;
                    return (
                      <tr
                        key={row.idolId}
                        className={`hover:bg-amber-500/5 transition-colors ${
                          isTop5
                            ? 'bg-cyan-950/20'
                            : isPlayIn
                            ? 'bg-purple-950/20'
                            : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-center font-bold text-amber-200/70">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2 font-sans font-bold text-white flex items-center gap-2">
                          {row.photoUrl && (
                            <img
                              src={row.photoUrl}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover border border-amber-500/30"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <span className="truncate max-w-[150px]">{row.idolName}</span>
                          {isTop5 && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded font-mono">
                              Top 5
                            </span>
                          )}
                          {isPlayIn && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded font-mono">
                              Play-In
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center text-amber-200/60 text-[11px] truncate max-w-[80px]">
                          {row.girlGroup || '-'}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.played ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'played', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-amber-500/20 rounded px-1.5 py-1 text-center font-mono text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.wins ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'wins', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-emerald-500/30 rounded px-1.5 py-1 text-center font-mono text-xs font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.draws ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'draws', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-amber-500/30 rounded px-1.5 py-1 text-center font-mono text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.losses ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'losses', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-rose-500/30 rounded px-1.5 py-1 text-center font-mono text-xs font-bold text-rose-300 focus:outline-none focus:border-rose-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            value={row.points ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'points', Number(e.target.value))}
                            className="w-16 bg-[#160a05] border border-cyan-500/40 rounded px-1.5 py-1 text-center font-mono text-xs font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.gamesFor ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'gamesFor', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-amber-500/20 rounded px-1.5 py-1 text-center font-mono text-xs text-amber-100 focus:outline-none focus:border-cyan-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.gamesAgainst ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'gamesAgainst', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-amber-500/20 rounded px-1.5 py-1 text-center font-mono text-xs text-amber-100 focus:outline-none focus:border-cyan-400"
                          />
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-amber-300">
                          {row.gameDiff ?? 0}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.qualified}
                            onChange={(e) => handleCellChange(row.idolId, 'qualified', e.target.checked)}
                            className="w-4 h-4 accent-cyan-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: IDOL LEAGUE CAREER RECORDS EDITOR */}
      {/* ===================================================================== */}
      {viewMode === 'idol_career' && (
        <div className="space-y-5">
          {/* Idol Selector */}
          <div className="bg-[#140b07] border-2 border-black rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="text-xs font-mono font-bold uppercase text-amber-200/70 mb-1.5 block">
                Select Idol to Edit League Career Stats:
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-amber-400/50 pointer-events-none" />
                  <input
                    type="text"
                    value={idolSearch}
                    onChange={(e) => setIdolSearch(e.target.value)}
                    placeholder="Search idol name or group..."
                    className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-amber-200/30 focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <select
                  value={selectedIdol?.id || ''}
                  onChange={(e) => setSelectedIdolId(e.target.value)}
                  className="flex-1 bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:border-cyan-400"
                >
                  {filteredIdols.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} {i.girlGroup ? `(${i.girlGroup})` : ''} - Rating {i.rating}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedIdol && (
              <div className="flex items-center gap-3 bg-[#1e0f09] p-2.5 rounded-xl border border-amber-500/20">
                {selectedIdol.photoUrl && (
                  <img
                    src={selectedIdol.photoUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-cyan-400"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <div className="font-bold text-sm text-white">{selectedIdol.name}</div>
                  <div className="text-[11px] text-amber-200/60 font-mono">
                    {selectedIdol.girlGroup} &bull; Rating {selectedIdol.rating}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Career Stat Form Fields */}
          <div className="bg-[#120804] border-2 border-black rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-amber-500/10 pb-4">
              <div>
                <h3 className="text-base font-black text-white font-mono uppercase">
                  League Honours & Overall Records for {selectedIdol?.name}
                </h3>
                <p className="text-xs text-amber-200/50">
                  Override active season or all-time totals. Values will immediately reflect across leaderboards and career stats.
                </p>
              </div>
              <button
                onClick={handleSaveIdolLeagueCareer}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" /> Save League Career
              </button>
            </div>

            {/* Division Titles & Podiums Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-amber-400 font-bold block mb-1.5">
                  🏆 Division Titles (1st)
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolLeagueForm.divisionTitles ?? 0}
                  onChange={(e) =>
                    setIdolLeagueForm((prev) => ({
                      ...prev,
                      divisionTitles: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-cyan-400 font-bold block mb-1.5">
                  🥈 Podiums (Top 3)
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolLeagueForm.divisionPodiums ?? 0}
                  onChange={(e) =>
                    setIdolLeagueForm((prev) => ({
                      ...prev,
                      divisionPodiums: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-purple-400 font-bold block mb-1.5">
                  ⭐ Top-5 Finishes
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolLeagueForm.top5Finishes ?? 0}
                  onChange={(e) =>
                    setIdolLeagueForm((prev) => ({
                      ...prev,
                      top5Finishes: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-purple-300 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-amber-200/70 font-bold block mb-1.5">
                  📅 Seasons Played
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolLeagueForm.leagueSeasonsPlayed ?? 0}
                  onChange={(e) =>
                    setIdolLeagueForm((prev) => ({
                      ...prev,
                      leagueSeasonsPlayed: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Match Record Breakdown Grid */}
            <div className="bg-[#1a0e08] border border-amber-500/10 rounded-2xl p-5 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-amber-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> All-Time League Matchday Record & Goals
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                  <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Matches</label>
                  <input
                    type="number"
                    min="0"
                    value={idolLeagueForm.leagueMatches ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leagueMatches: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-emerald-400 font-semibold mb-1 block">Wins</label>
                  <input
                    type="number"
                    min="0"
                    value={idolLeagueForm.leagueWins ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leagueWins: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-amber-400 font-semibold mb-1 block">Draws</label>
                  <input
                    type="number"
                    min="0"
                    value={idolLeagueForm.leagueDraws ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leagueDraws: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-rose-400 font-semibold mb-1 block">Losses</label>
                  <input
                    type="number"
                    min="0"
                    value={idolLeagueForm.leagueLosses ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leagueLosses: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-rose-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-cyan-300 font-bold mb-1 block">League Points</label>
                  <input
                    type="number"
                    value={idolLeagueForm.leaguePoints ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leaguePoints: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-amber-200/70 font-semibold mb-1 block">Goals For</label>
                  <input
                    type="number"
                    min="0"
                    value={idolLeagueForm.leagueGoalsFor ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leagueGoalsFor: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-amber-200/70 font-semibold mb-1 block">Goals Against</label>
                  <input
                    type="number"
                    min="0"
                    value={idolLeagueForm.leagueGoalsAgainst ?? 0}
                    onChange={(e) =>
                      setIdolLeagueForm((prev) => ({
                        ...prev,
                        leagueGoalsAgainst: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
