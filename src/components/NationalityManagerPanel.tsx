import React, { useState } from 'react';
import { Idol } from '../types';
import { Globe, Trash2, Plus, Check, X } from 'lucide-react';
import { DEFAULT_COUNTRY_NAMES, getCountryFlag } from '../utils/nationalityHelper';

interface NationalityManagerPanelProps {
  idols: Idol[];
  customNationalities?: string[];
  onUpdateNationalityTierList: (nationality: string, namesList: string[]) => void;
  onClearNationalityTierList: (nationality: string) => void;
  onAddCustomNationality?: (nationality: string) => void;
  onDeleteCustomNationality?: (nationality: string) => void;
}

const DEFAULT_COUNTRIES = DEFAULT_COUNTRY_NAMES;

export const NationalityManagerPanel: React.FC<NationalityManagerPanelProps> = ({
  idols,
  customNationalities = DEFAULT_COUNTRIES,
  onUpdateNationalityTierList,
  onClearNationalityTierList,
  onAddCustomNationality,
  onDeleteCustomNationality,
}) => {
  const [localCustomCountries, setLocalCustomCountries] = useState<string[]>([]);
  const [activeEditingNat, setActiveEditingNat] = useState<string | null>(null);
  const [textVal, setTextVal] = useState<string>('');
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryIdolsText, setNewCountryIdolsText] = useState('');
  const [showAddCountry, setShowAddCountry] = useState(false);

  // Combine default, prop-passed custom, local custom, and existing idol nationalities
  const allCountries = Array.from(
    new Set([
      ...DEFAULT_COUNTRIES,
      ...customNationalities,
      ...localCustomCountries,
      ...idols.map((i) => i.nationality),
    ])
  ).filter(Boolean);

  const handleOpenEdit = (nat: string) => {
    const natMembers = idols.filter((i) => i.nationality === nat);
    setTextVal(natMembers.map((i) => i.name).join('\n'));
    setActiveEditingNat(nat);
  };

  const handleSaveNat = (nat: string) => {
    const names = textVal
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    onUpdateNationalityTierList(nat, names);
    setActiveEditingNat(null);
  };

  const handleClearNat = (nat: string) => {
    onClearNationalityTierList(nat);
    if (activeEditingNat === nat) {
      setTextVal('');
    }
  };

  const handleDeleteCountry = (nat: string) => {
    onClearNationalityTierList(nat);
    setLocalCustomCountries((prev) => prev.filter((c) => c !== nat));
    if (onDeleteCustomNationality) {
      onDeleteCustomNationality(nat);
    }
    if (activeEditingNat === nat) {
      setActiveEditingNat(null);
      setTextVal('');
    }
  };

  const handleAddCountrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCountryName.trim();
    if (!trimmed) return;

    // Add to local state and notify parent
    setLocalCustomCountries((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    if (onAddCustomNationality) {
      onAddCustomNationality(trimmed);
    }

    // If names were provided in modal, save them immediately
    const names = newCountryIdolsText
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length > 0) {
      onUpdateNationalityTierList(trimmed, names);
      setActiveEditingNat(null);
    } else {
      // Open inline edit mode so user can paste right away
      setActiveEditingNat(trimmed);
      setTextVal('');
    }

    setNewCountryName('');
    setNewCountryIdolsText('');
    setShowAddCountry(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Globe className="h-7 w-7 text-amber-400" />
            <span>Nationality Manager</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Assign nationalities to idols by pasting name lists under each country. Add custom country tiers anytime.
          </p>
        </div>

        <button
          onClick={() => setShowAddCountry(true)}
          className="flex items-center gap-2 rounded-xl poster-pill-red px-5 py-2.5 text-xs font-black hover:scale-105 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Country Tier</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allCountries.map((nat) => {
          const natMembers = idols.filter((i) => i.nationality === nat);
          const isEditing = activeEditingNat === nat;
          const isDefault = DEFAULT_COUNTRIES.includes(nat);

          return (
            <div
              key={nat}
              className="rounded-2xl border-2 border-black bg-[#1c1510] p-5 space-y-4 poster-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-black/60 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{getCountryFlag(nat)}</span>
                    <h3 className="font-extrabold text-base text-amber-100">{nat}</h3>
                    <span className="text-xs text-amber-400/80 font-bold">
                      ({natMembers.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleClearNat(nat)}
                      title={`Clear all idols assigned to ${nat}`}
                      className="p-1.5 text-amber-400/60 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {!isDefault && natMembers.length === 0 && (
                      <button
                        onClick={() => handleDeleteCountry(nat)}
                        title={`Delete ${nat} tier`}
                        className="p-1.5 text-red-500/80 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <label className="block text-[11px] font-bold text-amber-200 uppercase">
                      Paste Idol Names for {nat} (one per line):
                    </label>
                    <textarea
                      rows={6}
                      value={textVal}
                      onChange={(e) => setTextVal(e.target.value)}
                      className="w-full rounded-xl border-2 border-black bg-[#120e0b] p-3 text-xs text-amber-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder={`Paste names for ${nat}...`}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveEditingNat(null)}
                        className="rounded-xl border border-black bg-[#261d16] px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-[#32261d] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveNat(nat)}
                        className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white hover:bg-emerald-500 cursor-pointer shadow-md"
                      >
                        Save List
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {natMembers.length > 0 ? (
                      natMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#120e0b] text-xs text-amber-100 border border-black/40"
                        >
                          <span className="font-bold">{member.name}</span>
                          <span className="text-[10px] text-amber-400 font-semibold">
                            {member.girlGroup}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-amber-300/50 font-medium">
                        No idols assigned to {nat}. Click below to paste names.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isEditing && (
                <button
                  onClick={() => handleOpenEdit(nat)}
                  className="w-full py-2 text-xs font-black text-emerald-400 rounded-xl border-2 border-emerald-600/40 bg-emerald-950/40 hover:bg-emerald-900/60 transition-all cursor-pointer"
                >
                  Paste {nat} List
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Country Modal */}
      {showAddCountry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border-2 border-black bg-[#1c1510] p-6 poster-shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-poster-title text-lg text-amber-300 flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-400" />
                <span>Add Country Tier</span>
              </h3>
              <button
                onClick={() => setShowAddCountry(false)}
                className="text-amber-400/60 hover:text-amber-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCountrySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-200 uppercase mb-1">
                  Country Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Canada, Indonesia, Philippines, Brazil"
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  className="w-full rounded-xl border-2 border-black bg-[#120e0b] px-3 py-2 text-xs text-amber-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-200 uppercase mb-1">
                  Idol Names (Optional, one per line)
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste idol names to assign to this country immediately..."
                  value={newCountryIdolsText}
                  onChange={(e) => setNewCountryIdolsText(e.target.value)}
                  className="w-full rounded-xl border-2 border-black bg-[#120e0b] p-3 text-xs text-amber-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setShowAddCountry(false)}
                  className="rounded-xl border-2 border-black bg-[#261d16] px-4 py-2 text-xs font-bold text-amber-200 hover:bg-[#32261d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-black text-white hover:bg-emerald-500 cursor-pointer shadow-md"
                >
                  Create Country Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

