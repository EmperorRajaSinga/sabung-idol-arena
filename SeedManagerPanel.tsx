import React, { useState } from 'react';
import { Idol } from '../types';
import { Award, Trash2, Check, RefreshCw } from 'lucide-react';

interface SeedManagerPanelProps {
  idols: Idol[];
  onUpdateSeedTierList: (seedTier: string, namesList: string[]) => void;
  onClearSeedTierList: (seedTier: string) => void;
}

export const SeedManagerPanel: React.FC<SeedManagerPanelProps> = ({
  idols,
  onUpdateSeedTierList,
  onClearSeedTierList,
}) => {
  const seedTiers = ['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'];

  const [activeEditingTier, setActiveEditingTier] = useState<string | null>(null);
  const [textVal, setTextVal] = useState<string>('');

  const handleOpenEdit = (tier: string) => {
    const tierMembers = idols.filter((i) => i.seed === tier);
    setTextVal(tierMembers.map((i) => i.name).join('\n'));
    setActiveEditingTier(tier);
  };

  const handleSaveTier = (tier: string) => {
    const names = textVal
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);

    onUpdateSeedTierList(tier, names);
    setActiveEditingTier(null);
  };

  const handleClearTier = (tier: string) => {
    onClearSeedTierList(tier);
    if (activeEditingTier === tier) {
      setTextVal('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            <span>Seed Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Assign idols to Seed 1 through Seed 4 by pasting name lists. Seed 1 idols receive top priority in tournament draw.
          </p>
        </div>
      </div>

      {/* Seed Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {seedTiers.map((tier) => {
          const tierMembers = idols.filter((i) => i.seed === tier);
          const isEditing = activeEditingTier === tier;

          return (
            <div
              key={tier}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black text-sm">
                    {tier.replace('Seed ', 'S')}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">{tier}</h3>
                    <span className="text-xs font-semibold text-slate-400">
                      {tierMembers.length} Idols Assigned
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleClearTier(tier)}
                    title={`Clear all names from ${tier}`}
                    className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300 border border-red-500/20 bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-400">
                    Paste idol names for {tier} (one per line):
                  </label>
                  <textarea
                    rows={8}
                    value={textVal}
                    onChange={(e) => setTextVal(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setActiveEditingTier(null)}
                      className="rounded-xl border border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveTier(tier)}
                      className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500"
                    >
                      Save Tier List
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {tierMembers.length > 0 ? (
                      tierMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs text-slate-200"
                        >
                          <div className="flex items-center gap-2">
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl}
                                alt={member.name}
                                className="h-6 w-6 rounded-md object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                                {member.name.slice(0, 1)}
                              </div>
                            )}
                            <span className="font-bold">{member.name}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-indigo-400">
                            {member.girlGroup}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500 font-medium">
                        No idols assigned to {tier}.
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenEdit(tier)}
                    className="w-full py-2 text-xs font-bold text-amber-400 rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                  >
                    Paste / Update {tier} Names
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
