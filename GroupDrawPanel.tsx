import React, { useState } from 'react';
import { Group, Idol, TournamentConfig } from '../types';
import {
  Layers,
  Shuffle,
  Table,
  AlertCircle,
  CheckCircle,
  Edit3,
  Star,
  Sparkles,
  Gamepad2,
  Search,
  Check,
  X,
} from 'lucide-react';
import { ManualGroupModal } from './ManualGroupModal';

interface GroupDrawPanelProps {
  groups: Group[];
  idolsMap: Map<string, Idol>;
  config: TournamentConfig;
  onRedrawGroups: () => void;
  onStartGroupStage: () => void;
  onSaveGroups?: (updatedGroups: Group[]) => void;
  onUpdateFavoriteIdols?: (favoriteIds: string[]) => void;
}

export const GroupDrawPanel: React.FC<GroupDrawPanelProps> = ({
  groups,
  idolsMap,
  config,
  onRedrawGroups,
  onStartGroupStage,
  onSaveGroups,
  onUpdateFavoriteIdols,
}) => {
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isFavPickerOpen, setIsFavPickerOpen] = useState(false);
  const [favSearchQuery, setFavSearchQuery] = useState('');
  const isDrawn = groups.length > 0;

  const currentFavoriteIds = config.favoriteIdolIds || [];

  // All participating idols in current groups
  const allParticipantIds = Array.from(
    new Set(groups.flatMap((g) => g.memberIds))
  );
  const allParticipants = allParticipantIds
    .map((id) => idolsMap.get(id))
    .filter(Boolean) as Idol[];

  // Verify group balance assertion
  const isGroupSizesValid =
    isDrawn &&
    groups.every((g) => g.memberIds.length === config.participantsPerGroup);

  const toggleFavoriteIdol = (idolId: string) => {
    if (!onUpdateFavoriteIdols) return;
    let next: string[];
    if (currentFavoriteIds.includes(idolId)) {
      next = currentFavoriteIds.filter((id) => id !== idolId);
    } else {
      if (currentFavoriteIds.length >= 2) {
        // Replace oldest or keep max 2
        next = [currentFavoriteIds[1], idolId];
      } else {
        next = [...currentFavoriteIds, idolId];
      }
    }
    onUpdateFavoriteIdols(next);
  };

  const clearFavoriteIdols = () => {
    if (onUpdateFavoriteIdols) {
      onUpdateFavoriteIdols([]);
    }
  };

  const filteredParticipants = allParticipants.filter((p) => {
    if (!favSearchQuery.trim()) return true;
    const q = favSearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.girlGroup.toLowerCase().includes(q) ||
      p.seed.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" />
            <span>Group Stage Draw</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Draw participants into {config.numGroups} groups with {config.participantsPerGroup} members per group. Select 1 or 2 favorite idols to control in playable minigames!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onRedrawGroups}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Shuffle className="h-4 w-4" />
            <span>{isDrawn ? 'Redraw Groups' : 'Perform Draw'}</span>
          </button>

          {isDrawn && onSaveGroups && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 px-4 py-2.5 text-xs font-bold text-indigo-300 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
            >
              <Edit3 className="h-4 w-4 text-indigo-400" />
              <span>Edit Draw Manually</span>
            </button>
          )}

          {isDrawn && (
            <button
              disabled={!isGroupSizesValid}
              onClick={onStartGroupStage}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                isGroupSizesValid
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-[1.02]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Table className="h-4 w-4" />
              <span>Start Group Stage</span>
            </button>
          )}
        </div>
      </div>

      {/* ⭐ Favorite Idol Selection Showcase */}
      {isDrawn && (
        <div className="rounded-2xl border-2 border-black bg-gradient-to-r from-[#1e1510] via-[#291d16] to-[#1e1510] p-4 text-white poster-shadow space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-950/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl poster-pill-gold text-amber-950 font-black shadow-md">
                <Star className="h-5 w-5 fill-amber-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase text-amber-400">
                    Pilih Idol Favorit / Yang Ingin Digunakan ({currentFavoriteIds.length} / 2)
                  </h3>
                  <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                    Player Controlled
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/70">
                  Pilih 1 atau 2 idol yang ingin kamu jadikan jagoan utama untuk dikontrol di mini-game melawan AI!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFavPickerOpen(!isFavPickerOpen)}
                className="flex items-center gap-1.5 rounded-xl poster-pill-gold px-3 py-1.5 text-xs font-black text-amber-950 shadow-md hover:scale-105 transition-transform"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isFavPickerOpen ? 'Tutup Pilihan' : 'Pilih Idol Favorit'}</span>
              </button>

              {currentFavoriteIds.length > 0 && (
                <button
                  onClick={clearFavoriteIdols}
                  className="rounded-xl border border-black bg-[#16100c] px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Selected Favorite Idols Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1].map((slotIdx) => {
              const favId = currentFavoriteIds[slotIdx];
              const idol = favId ? idolsMap.get(favId) : null;

              if (!idol) {
                return (
                  <div
                    key={slotIdx}
                    onClick={() => setIsFavPickerOpen(true)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-amber-500/40 bg-black/30 hover:bg-black/50 cursor-pointer transition-all"
                  >
                    <div className="h-12 w-12 rounded-xl border border-dashed border-amber-500/40 flex items-center justify-center text-amber-400/50">
                      <Star className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-amber-200/60 block">
                        Slot Idol Favorit {slotIdx + 1} (Kosong)
                      </span>
                      <span className="text-[10px] text-amber-400 underline">
                        Klik untuk memilih idol
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={slotIdx}
                  className="flex items-center justify-between p-3 rounded-xl border-2 border-black bg-gradient-to-r from-[#2e2017] to-[#201610] poster-shadow-sm ring-2 ring-amber-400/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      {idol.photoUrl ? (
                        <img
                          src={idol.photoUrl}
                          alt={idol.name}
                          className="h-12 w-12 rounded-xl object-cover border-2 border-black"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-black border-2 border-black flex items-center justify-center font-bold text-base text-amber-300">
                          {idol.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full poster-pill-gold text-amber-950 font-black text-[10px] shadow">
                        ★
                      </span>
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-white truncate">{idol.name}</h4>
                        <span className="rounded bg-rose-500 px-1 py-0.2 text-[9px] font-black text-white">
                          PLAYER
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-300 font-bold block">{idol.girlGroup}</span>
                      <span className="text-[9px] text-amber-200/70">{idol.seed}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleFavoriteIdol(idol.id)}
                    className="p-1.5 rounded-lg text-amber-300/70 hover:text-white hover:bg-black/40 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Selection Dropdown/Drawer */}
          {isFavPickerOpen && (
            <div className="p-3.5 rounded-xl border-2 border-black bg-[#140e0a] space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-amber-400/70" />
                  <input
                    type="text"
                    placeholder="Cari idol yang sedang bertanding..."
                    value={favSearchQuery}
                    onChange={(e) => setFavSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-black bg-[#201610] text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <span className="text-[11px] text-amber-200/70">
                  {currentFavoriteIds.length}/2 Terpilih
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
                {filteredParticipants.map((p) => {
                  const isSelected = currentFavoriteIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleFavoriteIdol(p.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'border-amber-400 bg-amber-950/60 ring-2 ring-amber-400'
                          : 'border-black bg-[#201610] hover:bg-[#2e2017]'
                      }`}
                    >
                      {p.photoUrl ? (
                        <img
                          src={p.photoUrl}
                          alt={p.name}
                          className="h-8 w-8 rounded-lg object-cover border border-black flex-shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-black border border-black flex items-center justify-center text-xs font-bold text-amber-300 flex-shrink-0">
                          {p.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-black text-white truncate block">
                          {p.name}
                        </span>
                        <span className="text-[9px] text-amber-300/80 truncate block">
                          {p.seed}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-amber-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!isDrawn ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-12 text-center space-y-4">
          <Shuffle className="h-12 w-12 text-indigo-400 mx-auto animate-bounce" />
          <h3 className="text-xl font-bold text-white">Group Draw Required</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click &quot;Perform Draw&quot; above to assign selected participants into {config.numGroups} seed-balanced groups.
          </p>
          <button
            onClick={onRedrawGroups}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-colors"
          >
            <Shuffle className="h-4 w-4" />
            <span>Draw Groups Now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assertion check badge */}
          {isGroupSizesValid ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20 text-xs font-bold text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  Draw Verified: All {groups.length} groups have exactly {config.participantsPerGroup} participants.
                </span>
              </div>
              {onSaveGroups && (
                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="text-[11px] underline font-bold text-emerald-300 hover:text-white"
                >
                  Adjust Draw Manually
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-red-500/10 p-3 border border-red-500/20 text-xs font-bold text-red-400">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  Warning: Group member counts do not match expected ({config.participantsPerGroup}). Please Redraw Groups or Edit Manually.
                </span>
              </div>
              {onSaveGroups && (
                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="text-[11px] underline font-bold text-red-300 hover:text-white"
                >
                  Fix Manually
                </button>
              )}
            </div>
          )}

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {groups.map((group) => {
              const members = group.memberIds
                .map((id) => idolsMap.get(id))
                .filter(Boolean) as Idol[];

              return (
                <div
                  key={group.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="font-extrabold text-sm text-indigo-400">
                      {group.name}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      {members.length} Members
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {members.map((m) => {
                      const isFav = currentFavoriteIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                            isFav
                              ? 'bg-amber-950/40 border-amber-500/50 ring-1 ring-amber-400/50'
                              : 'bg-slate-950/60 border-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative flex-shrink-0">
                              {m.photoUrl ? (
                                <img
                                  src={m.photoUrl}
                                  alt={m.name}
                                  className="h-7 w-7 rounded-lg object-cover border border-slate-700"
                                />
                              ) : (
                                <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                  {m.name.slice(0, 1)}
                                </div>
                              )}
                              {isFav && (
                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-black font-black text-[8px]">
                                  ★
                                </span>
                              )}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-200 truncate block text-xs">
                                  {m.name}
                                </span>
                                {isFav && (
                                  <span className="rounded bg-amber-400 px-1 py-0.2 text-[8px] font-black text-black">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] text-slate-400 font-medium truncate block">
                                {m.girlGroup}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => toggleFavoriteIdol(m.id)}
                              title={isFav ? 'Hapus dari favorit' : 'Jadikan favorit'}
                              className={`p-1 rounded transition-colors ${
                                isFav
                                  ? 'text-amber-400 hover:text-amber-200'
                                  : 'text-slate-500 hover:text-amber-300'
                              }`}
                            >
                              <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                            </button>
                            <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                              {m.seed}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Group Editor Modal */}
      {isManualModalOpen && onSaveGroups && (
        <ManualGroupModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          groups={groups}
          idolsMap={idolsMap}
          onSaveGroups={onSaveGroups}
        />
      )}
    </div>
  );
};
