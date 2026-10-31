import React, { useState, useMemo } from 'react';
import {
  Crown,
  Save,
  RotateCcw,
  Sliders,
  TrendingUp,
  Table,
  Sparkles,
  ArrowUpDown,
  Search,
  Trophy,
} from 'lucide-react';
import {
  Idol,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsStanding,
} from '../../types';
import {
  CareerOverridesMap,
  IdolCareerOverride,
  saveCareerOverrides,
  computeDerivedBaseStatsForIdol,
} from '../../utils/databaseStudioLogic';
import { saveTheIdolsState } from '../../utils/theIdolsLogic';

interface TheIdolsEditorProps {
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  idols: Idol[];
  overrides: CareerOverridesMap;
  onSaveOverrides: (newOverrides: CareerOverridesMap) => void;
  onUpdateTheIdolsState?: (newState: TheIdolsSeasonState | null) => void;
  onUpdateTheIdolsArchives?: (newArchives: TheIdolsSeasonArchive[]) => void;
  onRefreshAllStats: () => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const TheIdolsEditor: React.FC<TheIdolsEditorProps> = ({
  theIdolsState,
  theIdolsArchives,
  idols,
  overrides,
  onSaveOverrides,
  onUpdateTheIdolsState,
  onRefreshAllStats,
  showToast,
}) => {
  const [viewMode, setViewMode] = useState<'standings' | 'idol_career'>('standings');

  // Local editable standings buffer
  const [editableStandings, setEditableStandings] = useState<TheIdolsStanding[]>([]);

  // Sync buffer when theIdolsState changes
  React.useEffect(() => {
    if (theIdolsState?.standings) {
      setEditableStandings(JSON.parse(JSON.stringify(theIdolsState.standings)));
    }
  }, [theIdolsState?.standings]);

  // Handle cell edit in standings
  const handleCellChange = (idolId: string, field: keyof TheIdolsStanding, value: any) => {
    setEditableStandings((prev) =>
      prev.map((row) => {
        if (row.idolId !== idolId) return row;
        const updated = { ...row, [field]: value };
        if (field === 'gamesFor' || field === 'gamesAgainst') {
          const gf = field === 'gamesFor' ? Number(value) : row.gamesFor;
          const ga = field === 'gamesAgainst' ? Number(value) : row.gamesAgainst;
          updated.gameDiff = gf - ga;
        }
        if (field === 'wins' || field === 'draws') {
          const w = field === 'wins' ? Number(value) : row.wins;
          const d = field === 'draws' ? Number(value) : row.draws;
          updated.points = w * 3 + d;
        }
        return updated;
      })
    );
  };

  // Save modified standings to active The Idols state and localStorage
  const handleSaveStandings = () => {
    if (!theIdolsState) {
      showToast('No active The Idols state available to save.', 'error');
      return;
    }

    const newState: TheIdolsSeasonState = {
      ...theIdolsState,
      standings: editableStandings,
    };

    saveTheIdolsState(newState);
    if (onUpdateTheIdolsState) {
      onUpdateTheIdolsState(newState);
    }
    onRefreshAllStats();
    showToast('Saved The Idols Superleague standings successfully!', 'success');
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
      playoffSpot: idx < 8,
    }));

    setEditableStandings(ranked);
    showToast('Sorted The Idols Superleague table by tiebreakers! Click Save to apply.', 'info');
  };

  // Recalculate Points for all rows
  const handleRecalcAllPoints = () => {
    const recalculated = editableStandings.map((row) => ({
      ...row,
      points: (row.wins || 0) * 3 + (row.draws || 0),
      gameDiff: (row.gamesFor || 0) - (row.gamesAgainst || 0),
      played: (row.wins || 0) + (row.draws || 0) + (row.losses || 0),
    }));
    setEditableStandings(recalculated);
    showToast('Recalculated Superleague Points & GD from W-D-L.', 'info');
  };

  // -------------------------------------------------------------
  // IDOL THE IDOLS CAREER OVERRIDES SECTION
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
      null,
      [],
      theIdolsState || null,
      theIdolsArchives || []
    );
  }, [selectedIdol?.id, theIdolsState, theIdolsArchives]);

  const [idolTiForm, setIdolTiForm] = useState<Partial<IdolCareerOverride>>({});

  React.useEffect(() => {
    if (!selectedIdol) return;
    const ov = overrides[selectedIdol.id];
    const derived = idolBaseDerived?.theIdols || {};
    setIdolTiForm({
      theIdolsSuperleagueTitles: ov?.theIdolsSuperleagueTitles ?? derived.theIdolsSuperleagueTitles ?? 0,
      theIdolsMastersTitles: ov?.theIdolsMastersTitles ?? derived.theIdolsMastersTitles ?? 0,
      theIdolsMastersRunnerUps: ov?.theIdolsMastersRunnerUps ?? derived.theIdolsMastersRunnerUps ?? 0,
      theIdolsMastersPodiums: ov?.theIdolsMastersPodiums ?? derived.theIdolsMastersPodiums ?? 0,
      theIdolsPlayoffApps: ov?.theIdolsPlayoffApps ?? derived.theIdolsPlayoffApps ?? 0,
      theIdolsSeasonsPlayed: ov?.theIdolsSeasonsPlayed ?? derived.theIdolsSeasonsPlayed ?? 0,
      theIdolsMatches: ov?.theIdolsMatches ?? derived.theIdolsMatches ?? 0,
      theIdolsWins: ov?.theIdolsWins ?? derived.theIdolsWins ?? 0,
      theIdolsDraws: ov?.theIdolsDraws ?? derived.theIdolsDraws ?? 0,
      theIdolsLosses: ov?.theIdolsLosses ?? derived.theIdolsLosses ?? 0,
      theIdolsPoints: ov?.theIdolsPoints ?? derived.theIdolsPoints ?? 0,
      theIdolsGoalsFor: ov?.theIdolsGoalsFor ?? derived.theIdolsGoalsFor ?? 0,
      theIdolsGoalsAgainst: ov?.theIdolsGoalsAgainst ?? derived.theIdolsGoalsAgainst ?? 0,
      theIdolsGoalDiff: ov?.theIdolsGoalDiff ?? derived.theIdolsGoalDiff ?? 0,
      theIdolsPlayoffMatches: ov?.theIdolsPlayoffMatches ?? derived.theIdolsPlayoffMatches ?? 0,
      theIdolsPlayoffWins: ov?.theIdolsPlayoffWins ?? derived.theIdolsPlayoffWins ?? 0,
      theIdolsPlayoffLosses: ov?.theIdolsPlayoffLosses ?? derived.theIdolsPlayoffLosses ?? 0,
      theIdolsWinRate: ov?.theIdolsWinRate ?? derived.theIdolsWinRate ?? 0,
    });
  }, [selectedIdol?.id, overrides, idolBaseDerived]);

  const handleSaveIdolTiCareer = () => {
    if (!selectedIdol) return;
    const currentOv = overrides[selectedIdol.id] || { idolId: selectedIdol.id, enabled: true };
    const updated: CareerOverridesMap = {
      ...overrides,
      [selectedIdol.id]: {
        ...currentOv,
        idolId: selectedIdol.id,
        enabled: true,
        theIdolsSuperleagueTitles: idolTiForm.theIdolsSuperleagueTitles ?? 0,
        theIdolsMastersTitles: idolTiForm.theIdolsMastersTitles ?? 0,
        theIdolsMastersRunnerUps: idolTiForm.theIdolsMastersRunnerUps ?? 0,
        theIdolsMastersPodiums: idolTiForm.theIdolsMastersPodiums ?? 0,
        theIdolsPlayoffApps: idolTiForm.theIdolsPlayoffApps ?? 0,
        theIdolsSeasonsPlayed: idolTiForm.theIdolsSeasonsPlayed ?? 0,
        theIdolsMatches: idolTiForm.theIdolsMatches ?? 0,
        theIdolsWins: idolTiForm.theIdolsWins ?? 0,
        theIdolsDraws: idolTiForm.theIdolsDraws ?? 0,
        theIdolsLosses: idolTiForm.theIdolsLosses ?? 0,
        theIdolsPoints: idolTiForm.theIdolsPoints ?? 0,
        theIdolsGoalsFor: idolTiForm.theIdolsGoalsFor ?? 0,
        theIdolsGoalsAgainst: idolTiForm.theIdolsGoalsAgainst ?? 0,
        theIdolsGoalDiff: (idolTiForm.theIdolsGoalsFor ?? 0) - (idolTiForm.theIdolsGoalsAgainst ?? 0),
        theIdolsPlayoffMatches: idolTiForm.theIdolsPlayoffMatches ?? 0,
        theIdolsPlayoffWins: idolTiForm.theIdolsPlayoffWins ?? 0,
        theIdolsPlayoffLosses: idolTiForm.theIdolsPlayoffLosses ?? 0,
        theIdolsWinRate:
          (idolTiForm.theIdolsMatches ?? 0) > 0
            ? Math.round(((idolTiForm.theIdolsWins ?? 0) / (idolTiForm.theIdolsMatches ?? 1)) * 100)
            : 0,
        updatedAt: new Date().toISOString(),
      },
    };

    onSaveOverrides(updated);
    saveCareerOverrides(updated);
    onRefreshAllStats();
    showToast(`Saved The Idols Career Stats for ${selectedIdol.name}!`, 'success');
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
            <Crown className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-black text-amber-100 uppercase tracking-wider font-mono">
              The Idols Superleague & Masters Editor
            </h2>
          </div>
          <p className="text-xs text-amber-200/60">
            Edit live Superleague standings, playoff berths, regular season titles, and Masters championship honors.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#100804] p-1 rounded-2xl border border-amber-500/20">
          <button
            onClick={() => setViewMode('standings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
              viewMode === 'standings'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-amber-200/70 hover:text-amber-100'
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Superleague Standings
          </button>
          <button
            onClick={() => setViewMode('idol_career')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
              viewMode === 'idol_career'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'text-amber-200/70 hover:text-amber-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Idol Superleague & Masters Career
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: SUPERLEAGUE STANDINGS EDITOR */}
      {/* ===================================================================== */}
      {viewMode === 'standings' && (
        <div className="space-y-5">
          {/* Action Toolbar */}
          <div className="bg-[#140b07] border-2 border-black rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-purple-200 uppercase font-mono flex items-center gap-2">
                <span>The Idols Superleague Active Season</span>
                <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-md border border-purple-500/30 font-bold">
                  {editableStandings.length} Elite Idols
                </span>
              </div>
              <div className="text-[11px] text-amber-200/50">
                Top 8 qualify for the prestigious Masters Playoff Championship bracket.
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
                className="px-3 py-1.5 rounded-xl bg-[#20120a] hover:bg-[#2c1a0e] text-purple-300 border border-purple-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
                title="Sort table by Points, GD, GF"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" /> Sort Table
              </button>
              <button
                onClick={handleSaveStandings}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs font-mono shadow-md flex items-center gap-1.5 transition-all"
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
                    <th className="px-2 py-3 text-center w-20 text-purple-300 font-bold">Pts</th>
                    <th className="px-2 py-3 text-center w-16">GF</th>
                    <th className="px-2 py-3 text-center w-16">GA</th>
                    <th className="px-2 py-3 text-center w-16">GD</th>
                    <th className="px-3 py-3 text-center w-20">Masters Spot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10 font-mono">
                  {editableStandings.map((row, idx) => {
                    const isPlayoff = idx < 8;
                    const isChamp = idx === 0;
                    return (
                      <tr
                        key={row.idolId}
                        className={`hover:bg-purple-500/5 transition-colors ${
                          isChamp
                            ? 'bg-amber-950/20'
                            : isPlayoff
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
                              className="w-6 h-6 rounded-full object-cover border border-purple-500/30"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <span className="truncate max-w-[150px]">{row.idolName}</span>
                          {isChamp && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono">
                              Regular #1
                            </span>
                          )}
                          {isPlayoff && !isChamp && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded font-mono">
                              Playoff Top 8
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
                            className="w-14 bg-[#1e0f09] border border-amber-500/20 rounded px-1.5 py-1 text-center font-mono text-xs font-bold text-white focus:outline-none focus:border-purple-400"
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
                            className="w-16 bg-[#160a05] border border-purple-500/40 rounded px-1.5 py-1 text-center font-mono text-xs font-black text-purple-300 focus:outline-none focus:border-purple-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.gamesFor ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'gamesFor', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-amber-500/20 rounded px-1.5 py-1 text-center font-mono text-xs text-amber-100 focus:outline-none focus:border-purple-400"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.gamesAgainst ?? 0}
                            onChange={(e) => handleCellChange(row.idolId, 'gamesAgainst', Math.max(0, Number(e.target.value)))}
                            className="w-14 bg-[#1e0f09] border border-amber-500/20 rounded px-1.5 py-1 text-center font-mono text-xs text-amber-100 focus:outline-none focus:border-purple-400"
                          />
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-amber-300">
                          {row.gameDiff ?? 0}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!row.playoffSpot}
                            onChange={(e) => handleCellChange(row.idolId, 'playoffSpot', e.target.checked)}
                            className="w-4 h-4 accent-purple-500 cursor-pointer"
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
      {/* VIEW 2: IDOL THE IDOLS CAREER RECORDS EDITOR */}
      {/* ===================================================================== */}
      {viewMode === 'idol_career' && (
        <div className="space-y-5">
          {/* Idol Selector */}
          <div className="bg-[#140b07] border-2 border-black rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <label className="text-xs font-mono font-bold uppercase text-amber-200/70 mb-1.5 block">
                Select Idol to Edit The Idols Superleague & Masters Career:
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-purple-400/50 pointer-events-none" />
                  <input
                    type="text"
                    value={idolSearch}
                    onChange={(e) => setIdolSearch(e.target.value)}
                    placeholder="Search idol name or group..."
                    className="w-full bg-[#1e0f09] border border-purple-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-purple-200/30 focus:outline-none focus:border-purple-400"
                  />
                </div>
                <select
                  value={selectedIdol?.id || ''}
                  onChange={(e) => setSelectedIdolId(e.target.value)}
                  className="flex-1 bg-[#1e0f09] border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-bold text-purple-200 focus:outline-none focus:border-purple-400"
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
              <div className="flex items-center gap-3 bg-[#1e0f09] p-2.5 rounded-xl border border-purple-500/20">
                {selectedIdol.photoUrl && (
                  <img
                    src={selectedIdol.photoUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-purple-400"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <div className="font-bold text-sm text-white">{selectedIdol.name}</div>
                  <div className="text-[11px] text-purple-200/70 font-mono">
                    {selectedIdol.girlGroup} &bull; Rating {selectedIdol.rating}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Career Stat Form Fields */}
          <div className="bg-[#120804] border-2 border-black rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-purple-500/10 pb-4">
              <div>
                <h3 className="text-base font-black text-white font-mono uppercase">
                  The Idols Titles & Career Stats for {selectedIdol?.name}
                </h3>
                <p className="text-xs text-purple-200/60">
                  Note: Superleague Titles count towards total championships across all leaderboards.
                </p>
              </div>
              <button
                onClick={handleSaveIdolTiCareer}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" /> Save The Idols Career
              </button>
            </div>

            {/* Titles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-amber-400 font-bold block mb-1.5">
                  👑 Superleague Titles (1st)
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolTiForm.theIdolsSuperleagueTitles ?? 0}
                  onChange={(e) =>
                    setIdolTiForm((prev) => ({
                      ...prev,
                      theIdolsSuperleagueTitles: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="bg-[#1a0e08] border border-purple-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-purple-400 font-bold block mb-1.5">
                  🏆 Masters Titles (Playoff)
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolTiForm.theIdolsMastersTitles ?? 0}
                  onChange={(e) =>
                    setIdolTiForm((prev) => ({
                      ...prev,
                      theIdolsMastersTitles: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-purple-300 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="bg-[#1a0e08] border border-purple-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-cyan-400 font-bold block mb-1.5">
                  🥈 Masters Runner-Ups
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolTiForm.theIdolsMastersRunnerUps ?? 0}
                  onChange={(e) =>
                    setIdolTiForm((prev) => ({
                      ...prev,
                      theIdolsMastersRunnerUps: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="bg-[#1a0e08] border border-purple-500/20 rounded-2xl p-4">
                <label className="text-[11px] font-mono uppercase text-fuchsia-400 font-bold block mb-1.5">
                  🌟 Masters Podiums (Top 3)
                </label>
                <input
                  type="number"
                  min="0"
                  value={idolTiForm.theIdolsMastersPodiums ?? 0}
                  onChange={(e) =>
                    setIdolTiForm((prev) => ({
                      ...prev,
                      theIdolsMastersPodiums: Math.max(0, Number(e.target.value)),
                    }))
                  }
                  className="w-full bg-[#100804] border border-fuchsia-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-fuchsia-300 focus:outline-none focus:border-fuchsia-400"
                />
              </div>
            </div>

            {/* Superleague Regular Season Record */}
            <div className="bg-[#1a0e08] border border-purple-500/10 rounded-2xl p-5 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-purple-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" /> Superleague Regular Season Matchday Record & Goals
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div>
                  <label className="text-[10px] text-purple-200/60 font-semibold mb-1 block">Matches</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsMatches ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsMatches: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-purple-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-emerald-400 font-semibold mb-1 block">Wins</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsWins ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsWins: Math.max(0, Number(e.target.value)),
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
                    value={idolTiForm.theIdolsDraws ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsDraws: Math.max(0, Number(e.target.value)),
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
                    value={idolTiForm.theIdolsLosses ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsLosses: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-rose-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-purple-300 font-bold mb-1 block">Points</label>
                  <input
                    type="number"
                    value={idolTiForm.theIdolsPoints ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsPoints: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-2.5 py-1.5 text-xs font-mono font-black text-purple-300 focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">Goals For</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsGoalsFor ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsGoalsFor: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-purple-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">Goals Against</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsGoalsAgainst ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsGoalsAgainst: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-purple-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            </div>

            {/* Masters Playoff Split */}
            <div className="bg-[#1a0e08] border border-purple-500/10 rounded-2xl p-5 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-purple-300 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-400" /> Masters Playoff Knockout Bracket Split
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">Playoff Appearances</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsPlayoffApps ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsPlayoffApps: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-purple-500/20 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">Playoff Matches</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsPlayoffMatches ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsPlayoffMatches: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-purple-500/20 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-emerald-400 font-semibold mb-1 block">Playoff Wins</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsPlayoffWins ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsPlayoffWins: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-rose-400 font-semibold mb-1 block">Playoff Losses</label>
                  <input
                    type="number"
                    min="0"
                    value={idolTiForm.theIdolsPlayoffLosses ?? 0}
                    onChange={(e) =>
                      setIdolTiForm((prev) => ({
                        ...prev,
                        theIdolsPlayoffLosses: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-full bg-[#100804] border border-rose-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
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
