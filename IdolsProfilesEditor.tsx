import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Save,
  Star,
  Sparkles,
  CheckCircle2,
  Filter,
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react';
import { Idol, GirlGroup, AppState } from '../../types';
import { saveIdols } from '../../utils/storage';

interface IdolsProfilesEditorProps {
  appState: AppState;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  onRefreshAllStats: () => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const IdolsProfilesEditor: React.FC<IdolsProfilesEditorProps> = ({
  appState,
  onUpdateAppState,
  onRefreshAllStats,
  showToast,
}) => {
  const [search, setSearch] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedIdolId, setSelectedIdolId] = useState<string>(appState.idols[0]?.id || '');

  // Local editable buffer for the currently selected idol
  const [editingIdol, setEditingIdol] = useState<Idol | null>(null);

  const selectedIdol = useMemo(() => {
    return appState.idols.find((i) => i.id === selectedIdolId) || appState.idols[0];
  }, [appState.idols, selectedIdolId]);

  // Sync editing buffer when selected idol changes
  React.useEffect(() => {
    if (selectedIdol) {
      setEditingIdol({ ...selectedIdol });
    }
  }, [selectedIdol]);

  // Unique groups list
  const allGroups = useMemo(() => {
    const set = new Set<string>();
    appState.idols.forEach((i) => {
      if (i.girlGroup) set.add(i.girlGroup);
    });
    return Array.from(set).sort();
  }, [appState.idols]);

  // Filtered idols
  const filteredIdols = useMemo(() => {
    return appState.idols.filter((idol) => {
      if (selectedGroup !== 'all' && idol.girlGroup !== selectedGroup) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        idol.name.toLowerCase().includes(q) ||
        (idol.girlGroup || '').toLowerCase().includes(q) ||
        (idol.seed || '').toLowerCase().includes(q)
      );
    });
  }, [appState.idols, selectedGroup, search]);

  const handleSaveIdol = () => {
    if (!editingIdol) return;

    // Validate rating
    const clampedRating = Math.max(35, Math.min(99, Number(editingIdol.rating) || 80));
    const finalIdol: Idol = {
      ...editingIdol,
      rating: clampedRating,
    };

    const updatedIdols = appState.idols.map((i) => (i.id === finalIdol.id ? finalIdol : i));

    saveIdols(updatedIdols);
    onUpdateAppState((prev) => ({
      ...prev,
      idols: updatedIdols,
    }));
    onRefreshAllStats();
    showToast(`Saved profile for ${finalIdol.name} (Rating ${clampedRating})!`, 'success');
  };

  const handleBatchRatingChange = (delta: number) => {
    if (
      !window.confirm(
        `Apply ${delta > 0 ? '+' : ''}${delta} rating change to all ${filteredIdols.length} filtered idols?`
      )
    )
      return;

    const filteredIds = new Set(filteredIdols.map((i) => i.id));
    const updatedIdols = appState.idols.map((idol) => {
      if (filteredIds.has(idol.id)) {
        const newRating = Math.max(35, Math.min(99, idol.rating + delta));
        return { ...idol, rating: newRating };
      }
      return idol;
    });

    saveIdols(updatedIdols);
    onUpdateAppState((prev) => ({ ...prev, idols: updatedIdols }));
    onRefreshAllStats();
    showToast(`Applied ${delta > 0 ? '+' : ''}${delta} rating to ${filteredIdols.length} idols!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#1b100a] border-2 border-black rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-amber-100 uppercase tracking-wider font-mono">
              Full Idol & Group Database Editor
            </h2>
          </div>
          <p className="text-xs text-amber-200/60">
            Edit full profiles: name, rating (35–99), seed badge, girl group affiliation, nationality, and photo URLs.
          </p>
        </div>

        {/* Quick Batch Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBatchRatingChange(1)}
            className="px-3 py-1.5 rounded-xl bg-[#20120a] hover:bg-[#2c1a0e] text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-1 transition-all"
            title="Increase rating of filtered idols by +1"
          >
            +1 Rating (All Filtered)
          </button>
          <button
            onClick={() => handleBatchRatingChange(-1)}
            className="px-3 py-1.5 rounded-xl bg-[#20120a] hover:bg-[#2c1a0e] text-rose-400 border border-rose-500/30 text-xs font-mono font-bold flex items-center gap-1 transition-all"
            title="Decrease rating of filtered idols by -1"
          >
            -1 Rating (All Filtered)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Idol Directory & List (5 cols) */}
        <div className="lg:col-span-5 bg-[#140b07] border-2 border-black rounded-3xl p-4 shadow-xl space-y-3">
          {/* Search and Group Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-amber-400/50 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, group, or seed..."
                className="w-full bg-[#1e0f09] border border-amber-500/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-amber-200/30 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-amber-400/60" />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="flex-1 bg-[#1e0f09] border border-amber-500/20 rounded-xl px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="all">All Groups ({appState.idols.length} Idols)</option>
                {allGroups.map((g) => (
                  <option key={g} value={g}>
                    {g} ({appState.idols.filter((i) => i.girlGroup === g).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Idols Scroll List */}
          <div className="space-y-1 max-h-[550px] overflow-y-auto pr-1 divide-y divide-amber-500/5">
            {filteredIdols.map((idol) => {
              const isSelected = idol.id === selectedIdolId;
              return (
                <button
                  key={idol.id}
                  onClick={() => setSelectedIdolId(idol.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-amber-500 text-black font-bold shadow-md'
                      : 'hover:bg-amber-500/10 text-amber-200/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {idol.photoUrl ? (
                      <img
                        src={idol.photoUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-black"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center font-bold text-xs">
                        {idol.name.charAt(0)}
                      </div>
                    )}
                    <div className="truncate">
                      <div className={`text-xs truncate ${isSelected ? 'text-black font-black' : 'text-white'}`}>
                        {idol.name}
                      </div>
                      <div className={`text-[10px] font-mono ${isSelected ? 'text-black/80' : 'text-amber-200/50'}`}>
                        {idol.girlGroup || 'Independent'} &bull; {idol.seed}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-black ${
                        isSelected
                          ? 'bg-black text-amber-400'
                          : idol.rating >= 85
                          ? 'bg-amber-500/20 text-amber-400'
                          : idol.rating >= 75
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {idol.rating}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Idol Detail Editor Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#140b07] border-2 border-black rounded-3xl p-6 shadow-xl space-y-6">
          {editingIdol ? (
            <>
              <div className="flex items-center justify-between border-b border-amber-500/10 pb-4">
                <div className="flex items-center gap-3">
                  {editingIdol.photoUrl ? (
                    <img
                      src={editingIdol.photoUrl}
                      alt=""
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-lg"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-lg font-bold text-amber-300">
                      {editingIdol.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-black text-white font-mono uppercase">
                      {editingIdol.name}
                    </h3>
                    <div className="text-xs text-amber-200/60 font-mono">
                      ID: <span className="text-amber-300">{editingIdol.id}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveIdol}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Idol Profile
                </button>
              </div>

              {/* Form Grid */}
              <div className="space-y-4 font-mono">
                <div>
                  <label className="text-xs uppercase text-amber-200/70 font-bold block mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editingIdol.name || ''}
                    onChange={(e) => setEditingIdol({ ...editingIdol, name: e.target.value })}
                    className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase text-amber-200/70 font-bold block mb-1 flex items-center justify-between">
                      <span>Combat Rating (35 - 99)</span>
                      <span className="text-amber-400 font-black">{editingIdol.rating}</span>
                    </label>
                    <input
                      type="number"
                      min="35"
                      max="99"
                      value={editingIdol.rating}
                      onChange={(e) =>
                        setEditingIdol({
                          ...editingIdol,
                          rating: Math.max(35, Math.min(99, Number(e.target.value))),
                        })
                      }
                      className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3.5 py-2 text-sm text-amber-300 font-black focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase text-amber-200/70 font-bold block mb-1">
                      Tournament Seed
                    </label>
                    <select
                      value={editingIdol.seed || 'Unseeded'}
                      onChange={(e) => setEditingIdol({ ...editingIdol, seed: e.target.value })}
                      className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                    >
                      <option value="Seed 1">Seed 1 (Top Tier Pot 1)</option>
                      <option value="Seed 2">Seed 2 (Pot 2)</option>
                      <option value="Seed 3">Seed 3 (Pot 3)</option>
                      <option value="Seed 4">Seed 4 (Pot 4)</option>
                      <option value="Unseeded">Unseeded</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase text-amber-200/70 font-bold block mb-1">
                      Girl Group Affiliation
                    </label>
                    <input
                      type="text"
                      value={editingIdol.girlGroup || ''}
                      onChange={(e) => setEditingIdol({ ...editingIdol, girlGroup: e.target.value })}
                      placeholder="e.g. aespa, NewJeans, IVE..."
                      className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase text-amber-200/70 font-bold block mb-1">
                      Nationality / Flag
                    </label>
                    <input
                      type="text"
                      value={editingIdol.nationality || ''}
                      onChange={(e) => setEditingIdol({ ...editingIdol, nationality: e.target.value })}
                      placeholder="e.g. KR, JP, CN, US, TH..."
                      className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase text-amber-200/70 font-bold block mb-1 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Photo Image URL
                  </label>
                  <input
                    type="url"
                    value={editingIdol.photoUrl || ''}
                    onChange={(e) => setEditingIdol({ ...editingIdol, photoUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-[#1e0f09] border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-amber-200/30 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-amber-200/50">
              Select an idol from the directory on the left to edit attributes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
