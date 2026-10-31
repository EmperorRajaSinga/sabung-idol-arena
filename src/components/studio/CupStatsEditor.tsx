import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Save,
  RotateCcw,
  Sliders,
  TrendingUp,
  Search,
  Sparkles,
  Flame,
} from 'lucide-react';
import { Idol, TournamentArchive, ArchivedMatch } from '../../types';
import {
  CareerOverridesMap,
  IdolCareerOverride,
  saveCareerOverrides,
  computeDerivedBaseStatsForIdol,
} from '../../utils/databaseStudioLogic';

interface CupStatsEditorProps {
  idols: Idol[];
  archives: TournamentArchive[];
  currentMatches?: ArchivedMatch[];
  overrides: CareerOverridesMap;
  onSaveOverrides: (newOverrides: CareerOverridesMap) => void;
  onRefreshAllStats: () => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const CupStatsEditor: React.FC<CupStatsEditorProps> = ({
  idols,
  archives,
  currentMatches,
  overrides,
  onSaveOverrides,
  onRefreshAllStats,
  showToast,
}) => {
  const [selectedIdolId, setSelectedIdolId] = useState<string>(idols[0]?.id || '');
  const [idolSearch, setIdolSearch] = useState<string>('');

  const selectedIdol = useMemo(() => {
    return idols.find((i) => i.id === selectedIdolId) || idols[0];
  }, [idols, selectedIdolId]);

  const idolBaseDerived = useMemo(() => {
    if (!selectedIdol) return null;
    return computeDerivedBaseStatsForIdol(
      selectedIdol.id,
      archives,
      null,
      [],
      null,
      []
    );
  }, [selectedIdol?.id, archives]);

  const [form, setForm] = useState<Partial<IdolCareerOverride>>({});

  React.useEffect(() => {
    if (!selectedIdol) return;
    const ov = overrides[selectedIdol.id];
    const derived = idolBaseDerived?.cup || {};

    setForm({
      cupChampionships: ov?.cupChampionships ?? derived.cupChampionships ?? 0,
      cupRunnerUps: ov?.cupRunnerUps ?? derived.cupRunnerUps ?? 0,
      cupThirdPlaces: ov?.cupThirdPlaces ?? derived.cupThirdPlaces ?? 0,
      cupFourthPlaces: ov?.cupFourthPlaces ?? derived.cupFourthPlaces ?? 0,
      cupTop4s: ov?.cupTop4s ?? derived.cupTop4s ?? 0,
      cupQFs: ov?.cupQFs ?? derived.cupQFs ?? 0,
      cupR16s: ov?.cupR16s ?? derived.cupR16s ?? 0,
      cupR32s: ov?.cupR32s ?? derived.cupR32s ?? 0,
      cupPlayIns: ov?.cupPlayIns ?? derived.cupPlayIns ?? 0,
      cupGroupExits: ov?.cupGroupExits ?? derived.cupGroupExits ?? 0,
      cupSeasonsPlayed: ov?.cupSeasonsPlayed ?? derived.cupSeasonsPlayed ?? 0,
      cupMatches: ov?.cupMatches ?? derived.cupMatches ?? 0,
      cupWins: ov?.cupWins ?? derived.cupWins ?? 0,
      cupLosses: ov?.cupLosses ?? derived.cupLosses ?? 0,
      cupWinRate: ov?.cupWinRate ?? derived.cupWinRate ?? 0,
      currentWinStreak: ov?.currentWinStreak ?? derived.currentWinStreak ?? 0,
      bestWinStreak: ov?.bestWinStreak ?? derived.bestWinStreak ?? 0,
    });
  }, [selectedIdol?.id, overrides, idolBaseDerived]);

  const handleSaveCupStats = () => {
    if (!selectedIdol) return;
    const currentOv = overrides[selectedIdol.id] || { idolId: selectedIdol.id, enabled: true };
    const matches = form.cupMatches ?? 0;
    const wins = form.cupWins ?? 0;
    const losses = form.cupLosses ?? 0;
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

    const updated: CareerOverridesMap = {
      ...overrides,
      [selectedIdol.id]: {
        ...currentOv,
        idolId: selectedIdol.id,
        enabled: true,
        cupChampionships: form.cupChampionships ?? 0,
        cupRunnerUps: form.cupRunnerUps ?? 0,
        cupThirdPlaces: form.cupThirdPlaces ?? 0,
        cupFourthPlaces: form.cupFourthPlaces ?? 0,
        cupTop4s: form.cupTop4s ?? 0,
        cupQFs: form.cupQFs ?? 0,
        cupR16s: form.cupR16s ?? 0,
        cupR32s: form.cupR32s ?? 0,
        cupPlayIns: form.cupPlayIns ?? 0,
        cupGroupExits: form.cupGroupExits ?? 0,
        cupSeasonsPlayed: form.cupSeasonsPlayed ?? 0,
        cupMatches: matches,
        cupWins: wins,
        cupLosses: losses,
        cupWinRate: winRate,
        currentWinStreak: form.currentWinStreak ?? 0,
        bestWinStreak: form.bestWinStreak ?? 0,
        updatedAt: new Date().toISOString(),
      },
    };

    onSaveOverrides(updated);
    saveCareerOverrides(updated);
    onRefreshAllStats();
    showToast(`Saved Tournament Cup Career Records for ${selectedIdol.name}!`, 'success');
  };

  const filteredIdols = useMemo(() => {
    if (!idolSearch.trim()) return idols;
    const q = idolSearch.toLowerCase().trim();
    return idols.filter((i) => i.name.toLowerCase().includes(q) || (i.girlGroup || '').toLowerCase().includes(q));
  }, [idols, idolSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1b100a] border-2 border-black rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-amber-100 uppercase tracking-wider font-mono">
              Tournament Cup Career Records Editor
            </h2>
          </div>
          <p className="text-xs text-amber-200/60">
            Edit tournament championship honours, podiums, knockout stage depths, match records, and historic win streaks.
          </p>
        </div>

        <button
          onClick={handleSaveCupStats}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 transition-all flex-shrink-0"
        >
          <Save className="w-4 h-4" /> Save Cup Career
        </button>
      </div>

      {/* Idol Selector */}
      <div className="bg-[#140b07] border-2 border-black rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="text-xs font-mono font-bold uppercase text-amber-200/70 mb-1.5 block">
            Select Idol to Edit Tournament Cup Career Stats:
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-amber-400/50 pointer-events-none" />
              <input
                type="text"
                value={idolSearch}
                onChange={(e) => setIdolSearch(e.target.value)}
                placeholder="Search idol name or group..."
                className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-amber-200/30 focus:outline-none focus:border-amber-400"
              />
            </div>
            <select
              value={selectedIdol?.id || ''}
              onChange={(e) => setSelectedIdolId(e.target.value)}
              className="flex-1 bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:border-amber-400"
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
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400"
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

      {/* Form Fields */}
      <div className="bg-[#120804] border-2 border-black rounded-3xl p-6 shadow-xl space-y-6">
        {/* Trophies & Major Honors */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Tournament Cup Honours
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
              <label className="text-[11px] font-mono uppercase text-amber-400 font-bold block mb-1.5">
                🏆 Cup Championships (1st)
              </label>
              <input
                type="number"
                min="0"
                value={form.cupChampionships ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupChampionships: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
              <label className="text-[11px] font-mono uppercase text-cyan-400 font-bold block mb-1.5">
                🥈 Cup Runner-Ups (2nd)
              </label>
              <input
                type="number"
                min="0"
                value={form.cupRunnerUps ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupRunnerUps: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
              <label className="text-[11px] font-mono uppercase text-amber-300 font-bold block mb-1.5">
                🥉 3rd Places
              </label>
              <input
                type="number"
                min="0"
                value={form.cupThirdPlaces ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupThirdPlaces: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="bg-[#1a0e08] border border-amber-500/20 rounded-2xl p-4">
              <label className="text-[11px] font-mono uppercase text-purple-400 font-bold block mb-1.5">
                🌟 Top 4 Finishes
              </label>
              <input
                type="number"
                min="0"
                value={form.cupTop4s ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupTop4s: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-sm font-mono font-black text-purple-300 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Stage Depth Records */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-bold uppercase text-amber-200/70">
            Knockout & Stage Appearances
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Quarter-Finals (QF)</label>
              <input
                type="number"
                min="0"
                value={form.cupQFs ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupQFs: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Round of 16 (R16)</label>
              <input
                type="number"
                min="0"
                value={form.cupR16s ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupR16s: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Round of 32 (R32)</label>
              <input
                type="number"
                min="0"
                value={form.cupR32s ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupR32s: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Play-In Stage</label>
              <input
                type="number"
                min="0"
                value={form.cupPlayIns ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupPlayIns: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Group Stage Exits</label>
              <input
                type="number"
                min="0"
                value={form.cupGroupExits ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupGroupExits: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Matches, Wins, Losses & Streaks */}
        <div className="bg-[#1a0e08] border border-amber-500/10 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-mono font-bold uppercase text-amber-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Cup Match Record & Win Streaks
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Seasons Played</label>
              <input
                type="number"
                min="0"
                value={form.cupSeasonsPlayed ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupSeasonsPlayed: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] text-amber-200/60 font-semibold mb-1 block">Cup Matches</label>
              <input
                type="number"
                min="0"
                value={form.cupMatches ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupMatches: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] text-emerald-400 font-semibold mb-1 block">Cup Wins</label>
              <input
                type="number"
                min="0"
                value={form.cupWins ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupWins: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="text-[10px] text-rose-400 font-semibold mb-1 block">Cup Losses</label>
              <input
                type="number"
                min="0"
                value={form.cupLosses ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, cupLosses: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-rose-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div>
              <label className="text-[10px] text-amber-400 font-semibold mb-1 block flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" /> Current Win Streak
              </label>
              <input
                type="number"
                min="0"
                value={form.currentWinStreak ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, currentWinStreak: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] text-yellow-400 font-semibold mb-1 block flex items-center gap-1">
                <Flame className="w-3 h-3 text-yellow-400" /> Best Win Streak
              </label>
              <input
                type="number"
                min="0"
                value={form.bestWinStreak ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, bestWinStreak: Math.max(0, Number(e.target.value)) }))}
                className="w-full bg-[#100804] border border-yellow-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-yellow-300 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
