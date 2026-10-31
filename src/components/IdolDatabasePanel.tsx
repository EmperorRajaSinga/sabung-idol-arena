import React, { useState } from 'react';
import { Idol, GirlGroup, ArchivedMatch } from '../types';
import { generateAvatarUrl } from '../data/initialData';
import { compressImage } from '../utils/imageHelper';
import { getTopH2HRecordsForIdol, OpponentH2HRecord } from '../utils/h2hHelper';
import { getCountryFlag } from '../utils/nationalityHelper';
import { Search, Upload, Plus, Camera, Trash2, Users, Swords, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { RatingBadge } from './RatingBadge';

interface IdolDatabasePanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  matchDatabase?: ArchivedMatch[];
  onUpdateIdolPhoto: (idolId: string, photoUrl: string) => void;
  onAddIdolManually: (idol) => void;
  onDeleteIdol: (idolId: string) => void;
  onSelectIdolProfile?: (idolId: string) => void;
  onToggleIdolActive?: (idolId: string) => void;
}

export const IdolDatabasePanel: React.FC<IdolDatabasePanelProps> = ({
  idols,
  girlGroups,
  matchDatabase = [],
  onUpdateIdolPhoto,
  onAddIdolManually,
  onDeleteIdol,
  onSelectIdolProfile,
  onToggleIdolActive,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [selectedSeedFilter, setSelectedSeedFilter] = useState<string>('ALL');
  const [selectedNatFilter, setSelectedNatFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [expandedH2HIdolId, setExpandedH2HIdolId] = useState<string | null>(null);

  // Modal for Photo Upload
  const [photoModalIdol, setPhotoModalIdol] = useState<Idol | null>(null);

  // Modal for New Idol
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState(girlGroups[0]?.name || 'IVE');
  const [newSeed, setNewSeed] = useState('Seed 1');
  const [newNat, setNewNat] = useState('South Korea');

  const inactiveGroupNamesSet = React.useMemo(() => {
    const set = new Set<string>();
    girlGroups.forEach((g) => {
      if (g.inactive === true || String(g.inactive).toLowerCase() === 'true') {
        set.add(g.name.trim().toLowerCase());
      }
    });
    return set;
  }, [girlGroups]);

  // Filter & Sort A to Z by Name
  const filteredIdols = idols
    .filter((idol) => {
      const isDirectInactive = Boolean(
        idol.inactive === true || String(idol.inactive).toLowerCase() === 'true'
      );
      const isGroupInactive = Boolean(
        idol.girlGroup && inactiveGroupNamesSet.has(idol.girlGroup.trim().toLowerCase())
      );
      const isOverallInactive = isDirectInactive || isGroupInactive;

      if (selectedStatusFilter === 'ACTIVE' && isOverallInactive) return false;
      if (selectedStatusFilter === 'INACTIVE' && !isOverallInactive) return false;

      const matchesSearch =
        idol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        idol.girlGroup.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup =
        selectedGroupFilter === 'ALL' || idol.girlGroup === selectedGroupFilter;
      const matchesSeed =
        selectedSeedFilter === 'ALL' || idol.seed === selectedSeedFilter;
      const matchesNat =
        selectedNatFilter === 'ALL' || idol.nationality === selectedNatFilter;
      return matchesSearch && matchesGroup && matchesSeed && matchesNat;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const nationalities = Array.from(new Set(idols.map((i) => i.nationality))).filter(
    Boolean
  );

  const handlePhotoFile = async (
    idolId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 400, 400, 0.85);
      onUpdateIdolPhoto(idolId, compressed);
      setPhotoModalIdol(null);
    } catch (err) {
      console.error('Failed to compress image:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onUpdateIdolPhoto(idolId, result);
          setPhotoModalIdol(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newIdol: Idol = {
      id: `idol-custom-${Date.now()}`,
      name: newName.trim(),
      girlGroup: newGroup,
      seed: newSeed,
      nationality: newNat,
      photoUrl: generateAvatarUrl(newName.trim(), newGroup),
      createdAt: Date.now(),
    };

    onAddIdolManually(newIdol);
    setNewName('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Users className="h-7 w-7 text-amber-400" />
            <span>Permanent Idol Database</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Permanent record of all tournament participants sorted alphabetically. Upload custom photos per idol.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl poster-pill-red px-5 py-2.5 text-xs font-black hover:scale-105 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Add Custom Idol</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-[#1c1510] p-4 rounded-2xl border-2 border-black poster-shadow">
        {/* Search Input */}
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-amber-400/60" />
          <input
            type="text"
            placeholder="Search idol or group name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border-2 border-black bg-[#120e0b] pl-9 pr-4 py-2 text-xs text-amber-100 font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={selectedStatusFilter}
          onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
          className="rounded-xl border-2 border-black bg-[#120e0b] px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="ALL">All Status ({idols.length})</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>

        {/* Group Filter */}
        <select
          value={selectedGroupFilter}
          onChange={(e) => setSelectedGroupFilter(e.target.value)}
          className="rounded-xl border-2 border-black bg-[#120e0b] px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="ALL">All Girl Groups ({girlGroups.length})</option>
          {girlGroups.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}
            </option>
          ))}
        </select>

        {/* Seed Filter */}
        <select
          value={selectedSeedFilter}
          onChange={(e) => setSelectedSeedFilter(e.target.value)}
          className="rounded-xl border-2 border-black bg-[#120e0b] px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="ALL">All Seed Tiers</option>
          <option value="Seed 1">Seed 1</option>
          <option value="Seed 2">Seed 2</option>
          <option value="Seed 3">Seed 3</option>
          <option value="Seed 4">Seed 4</option>
        </select>

        {/* Nationality Filter */}
        <select
          value={selectedNatFilter}
          onChange={(e) => setSelectedNatFilter(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">All Nationalities</option>
          {nationalities.map((nat) => (
            <option key={nat} value={nat}>
              {nat}
            </option>
          ))}
        </select>
      </div>

      {/* Idols Data Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Photo</th>
                <th className="px-4 py-3">Idol Name</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Girl Group</th>
                <th className="px-4 py-3">Seed</th>
                <th className="px-4 py-3">Nationality</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredIdols.map((idol) => {
                const isDirectInactive = Boolean(
                  idol.inactive === true || String(idol.inactive).toLowerCase() === 'true'
                );
                const isGroupInactive = Boolean(
                  idol.girlGroup && inactiveGroupNamesSet.has(idol.girlGroup.trim().toLowerCase())
                );
                const isOverallInactive = isDirectInactive || isGroupInactive;

                return (
                  <React.Fragment key={idol.id}>
                    <tr className={`transition-colors group ${isOverallInactive ? 'bg-rose-950/10 hover:bg-rose-950/20' : 'hover:bg-slate-800/40'}`}>
                      {/* Photo Thumbnail */}
                      <td className="px-4 py-2.5">
                        <div className={`relative h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-xl border-2 bg-slate-950 shadow-md flex items-center justify-center ${isOverallInactive ? 'border-rose-800/60 grayscale-[35%]' : 'border-slate-700'}`}>
                          {idol.photoUrl ? (
                            <img
                              src={idol.photoUrl}
                              alt={idol.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="font-bold text-amber-300 text-sm">
                              {idol.name.slice(0, 2)}
                            </div>
                          )}
                          <button
                            onClick={() => setPhotoModalIdol(idol)}
                            title="Upload Custom Photo"
                            className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Camera className="h-5 w-5 text-amber-300" />
                          </button>
                        </div>
                      </td>

                      {/* Idol Name */}
                      <td className="px-4 py-2.5 font-black text-white text-base">
                        <div className="flex items-center gap-2 flex-wrap">
                          {onSelectIdolProfile ? (
                            <button
                              onClick={() => onSelectIdolProfile(idol.id)}
                              className={`text-left font-black transition-colors focus:outline-none ${
                                isOverallInactive ? 'text-rose-300 hover:text-rose-200' : 'text-amber-200 hover:text-amber-100 hover:underline'
                              }`}
                              title="Click to view idol profile"
                            >
                              {idol.name}
                            </button>
                          ) : (
                            <span className={isOverallInactive ? 'text-rose-300' : 'text-white'}>
                              {idol.name}
                            </span>
                          )}

                          {isDirectInactive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-950/90 text-rose-300 border border-rose-500/60 shadow-sm">
                              Inactive
                            </span>
                          )}
                          {isGroupInactive && !isDirectInactive && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-950/90 text-purple-300 border border-purple-500/60 shadow-sm">
                              Group Hiatus
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-2.5">
                        <RatingBadge idol={idol} size="sm" showTier={true} />
                      </td>

                      {/* Girl Group */}
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                          isGroupInactive
                            ? 'bg-purple-950/60 text-purple-300 border-purple-700/60'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {idol.girlGroup}
                        </span>
                      </td>

                      {/* Seed */}
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                          {idol.seed}
                        </span>
                      </td>

                      {/* Nationality */}
                      <td className="px-4 py-2.5 text-slate-300 font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-sm">{getCountryFlag(idol.nationality)}</span>
                          <span>{idol.nationality}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5 text-right space-x-2">
                        {onToggleIdolActive && (
                          <button
                            onClick={() => onToggleIdolActive(idol.id)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold border transition-colors ${
                              isOverallInactive
                                ? 'bg-rose-950/80 text-rose-300 border-rose-600/60 hover:bg-rose-900'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800'
                            }`}
                            title={isOverallInactive ? 'Click to reactivate this idol' : 'Click to mark inactive'}
                          >
                            {isOverallInactive ? 'Reactivate' : 'Set Inactive'}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setExpandedH2HIdolId(expandedH2HIdolId === idol.id ? null : idol.id)
                          }
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all border ${
                            expandedH2HIdolId === idol.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                          }`}
                          title="View Top 5 Head-to-Head records"
                        >
                          <span className="inline-flex items-center gap-1">
                            <Swords className="h-3 w-3" />
                            <span>Top 5 H2H</span>
                            {expandedH2HIdolId === idol.id ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </span>
                        </button>
                        {onSelectIdolProfile && (
                          <button
                            onClick={() => onSelectIdolProfile(idol.id)}
                            className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500 hover:text-white transition-colors"
                          >
                            Profile
                          </button>
                        )}
                        <button
                          onClick={() => setPhotoModalIdol(idol)}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          Photo
                        </button>
                        <button
                          onClick={() => onDeleteIdol(idol.id)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {expandedH2HIdolId === idol.id && (
                      <tr className="bg-[#150f0c] border-b border-amber-500/30 animate-in fade-in duration-150">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="rounded-xl border border-amber-500/30 bg-[#1e1510] p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-black/60 pb-2">
                              <div className="flex items-center gap-2">
                                <Swords className="h-4 w-4 text-amber-400" />
                                <h4 className="font-poster-title text-sm text-amber-200">
                                  Top 5 Head-to-Head Rivals for {idol.name} ({idol.girlGroup})
                                </h4>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                                Rivalry Breakdown
                              </span>
                            </div>

                            {(() => {
                              const top5 = getTopH2HRecordsForIdol(idol.id, matchDatabase, idols, 5);
                              if (top5.length === 0) {
                                return (
                                  <p className="text-xs text-amber-200/60 py-2 italic text-center">
                                    No head-to-head match history recorded for {idol.name} yet. Matches played in the tournament will automatically populate this record.
                                  </p>
                                );
                              }
                              return (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
                                  {top5.map((rec) => (
                                    <div
                                      key={rec.opponentId}
                                      className="rounded-lg border border-black bg-[#120e0b] p-2.5 flex flex-col justify-between space-y-2 poster-shadow-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-black bg-slate-900 flex-shrink-0">
                                          {rec.opponentPhoto ? (
                                            <img
                                              src={rec.opponentPhoto}
                                              alt={rec.opponentName}
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <div className="h-full w-full flex items-center justify-center text-[10px] text-amber-300 font-bold">
                                              {(rec.opponentName || 'OP').slice(0, 2)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="truncate">
                                          <div className="font-bold text-xs text-white leading-tight truncate flex items-center gap-1">
                                            <span>{rec.opponentName}</span>
                                            <span className="text-[10px]">{getCountryFlag(rec.opponentNationality)}</span>
                                          </div>
                                          <div className="text-[10px] text-amber-400/80 truncate">
                                            {rec.opponentGroup} &bull; {rec.opponentSeed}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="border-t border-black/60 pt-1.5 flex items-center justify-between text-[11px]">
                                        <span className="font-mono font-bold text-amber-200">
                                          {rec.wins}W - {rec.draws}D - {rec.losses}L
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                                            rec.winRate >= 60
                                              ? 'bg-emerald-950 text-emerald-300'
                                              : rec.winRate >= 40
                                              ? 'bg-amber-950 text-amber-300'
                                              : 'bg-red-950 text-red-300'
                                          }`}
                                        >
                                          {rec.winRate}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Upload Modal */}
      {photoModalIdol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-white">
              Upload Photo for {photoModalIdol.name}
            </h3>
            <p className="text-xs text-slate-400">
              Choose an image file from your device. This photo will be displayed across matches, brackets, profiles, and career stats.
            </p>

            <div className="flex flex-col items-center gap-3 py-4 border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/50">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border-2 border-indigo-500/40 bg-black flex items-center justify-center">
                {photoModalIdol.photoUrl ? (
                  <img
                    src={photoModalIdol.photoUrl}
                    alt={photoModalIdol.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="font-bold text-2xl text-amber-300">
                    {photoModalIdol.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <label className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors">
                <span>Browse Image File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoFile(photoModalIdol.id, e)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPhotoModalIdol(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Idol Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-white">Add New Idol</h3>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Idol Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karina"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Girl Group
                </label>
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {girlGroups.map((g) => (
                    <option key={g.id} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Seed Tier
                </label>
                <select
                  value={newSeed}
                  onChange={(e) => setNewSeed(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Seed 1">Seed 1</option>
                  <option value="Seed 2">Seed 2</option>
                  <option value="Seed 3">Seed 3</option>
                  <option value="Seed 4">Seed 4</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Nationality
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Korea"
                  value={newNat}
                  onChange={(e) => setNewNat(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Add Idol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
