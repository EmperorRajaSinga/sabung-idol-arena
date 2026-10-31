import React, { useState, useMemo } from 'react';
import { Idol, GirlGroup } from '../types';
import { getCountryFlag } from '../utils/nationalityHelper';
import { parseNameInputList, isIdolActive } from '../utils/tournamentLogic';
import {
  UserX,
  Users,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  ClipboardPaste,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface InactiveManagerPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  onUpdateInactiveIdolsList: (namesList: string[], mode: 'replace' | 'append') => void;
  onToggleIdolActive?: (idolId: string) => void;
  onToggleIdolInactive?: (idolId: string) => void;
  onClearAllInactiveIdols?: () => void;
  onClearAllInactive?: () => void;
  onUpdateInactiveGroupsList: (groupNamesList: string[], mode: 'replace' | 'append') => void;
  onToggleGroupActive?: (groupId: string) => void;
  onToggleGroupInactive?: (groupId: string) => void;
  onClearAllInactiveGroups?: () => void;
}

export const InactiveManagerPanel: React.FC<InactiveManagerPanelProps> = ({
  idols,
  girlGroups,
  onUpdateInactiveIdolsList,
  onToggleIdolActive,
  onToggleIdolInactive,
  onClearAllInactiveIdols,
  onClearAllInactive,
  onUpdateInactiveGroupsList,
  onToggleGroupActive,
  onToggleGroupInactive,
  onClearAllInactiveGroups,
}) => {
  const toggleIdol = onToggleIdolActive || onToggleIdolInactive || (() => {});
  const toggleGroup = onToggleGroupActive || onToggleGroupInactive || (() => {});
  const clearIdols = onClearAllInactiveIdols || onClearAllInactive || (() => {});
  const clearGroups = onClearAllInactiveGroups || onClearAllInactive || (() => {});

  // Subtab & input modes
  const [activeSubTab, setActiveSubTab] = useState<'idols' | 'groups'>('idols');
  const [idolInputMode, setIdolInputMode] = useState<'append' | 'replace'>('append');
  const [groupInputMode, setGroupInputMode] = useState<'append' | 'replace'>('append');

  // Idol Text Input (same input paradigm as Seed Manager & Girl Group Manager)
  const [idolText, setIdolText] = useState('');
  const [idolSearch, setIdolSearch] = useState('');
  const [idolFilterStatus, setIdolFilterStatus] = useState<'all' | 'inactive' | 'active'>('inactive');
  const [idolFeedback, setIdolFeedback] = useState<string | null>(null);

  // Girl Group Text Input
  const [groupText, setGroupText] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [groupFeedback, setGroupFeedback] = useState<string | null>(null);

  // Derived sets
  const inactiveGroupNamesSet = useMemo(() => {
    const set = new Set<string>();
    girlGroups.forEach((g) => {
      if (g.inactive === true || String(g.inactive).toLowerCase() === 'true') {
        set.add(g.name.trim().toLowerCase());
      }
    });
    return set;
  }, [girlGroups]);

  const inactiveIdolCount = useMemo(() => {
    return idols.filter((i) => !isIdolActive(i, girlGroups)).length;
  }, [idols, girlGroups]);

  const activeIdolCount = idols.length - inactiveIdolCount;

  const inactiveGroupCount = useMemo(() => {
    return girlGroups.filter(
      (g) => g.inactive === true || String(g.inactive).toLowerCase() === 'true'
    ).length;
  }, [girlGroups]);

  const activeGroupCount = girlGroups.length - inactiveGroupCount;

  // Handle Idols Text Apply
  const handleApplyIdolsText = (mode: 'replace' | 'append' = idolInputMode) => {
    const names = parseNameInputList(idolText);
    if (names.length === 0) {
      setIdolFeedback('Please enter at least one idol name.');
      setTimeout(() => setIdolFeedback(null), 3000);
      return;
    }
    onUpdateInactiveIdolsList(names, mode);
    if (mode === 'append') {
      setIdolFeedback(`Successfully marked ${names.length} idol(s) as inactive.`);
      setIdolText('');
    } else {
      setIdolFeedback(`Successfully updated inactive idols list (${names.length} idols).`);
    }
    setTimeout(() => setIdolFeedback(null), 3500);
  };

  // Handle Groups Text Apply
  const handleApplyGroupsText = (mode: 'replace' | 'append' = groupInputMode) => {
    const names = parseNameInputList(groupText);
    if (names.length === 0) {
      setGroupFeedback('Please enter at least one girl group name.');
      setTimeout(() => setGroupFeedback(null), 3000);
      return;
    }
    onUpdateInactiveGroupsList(names, mode);
    if (mode === 'append') {
      setGroupFeedback(`Successfully marked ${names.length} group(s) as inactive.`);
      setGroupText('');
    } else {
      setGroupFeedback(`Successfully updated inactive groups list (${names.length} groups).`);
    }
    setTimeout(() => setGroupFeedback(null), 3500);
  };

  // Populate textarea with current inactive idols
  const handlePopulateCurrentInactiveIdols = () => {
    const currentInactive = idols
      .filter((i) => i.inactive === true || String(i.inactive).toLowerCase() === 'true')
      .map((i) => i.name);
    setIdolText(currentInactive.join('\n'));
    setIdolInputMode('replace');
    setIdolFeedback(`Loaded ${currentInactive.length} currently inactive idols into editor.`);
    setTimeout(() => setIdolFeedback(null), 3000);
  };

  // Populate textarea with current inactive groups
  const handlePopulateCurrentInactiveGroups = () => {
    const currentInactive = girlGroups
      .filter((g) => g.inactive === true || String(g.inactive).toLowerCase() === 'true')
      .map((g) => g.name);
    setGroupText(currentInactive.join('\n'));
    setGroupInputMode('replace');
    setGroupFeedback(`Loaded ${currentInactive.length} currently inactive groups into editor.`);
    setTimeout(() => setGroupFeedback(null), 3000);
  };

  // Filtered idols list
  const filteredIdols = useMemo(() => {
    return idols.filter((idol) => {
      const isIdolDirectInactive = Boolean(
        idol.inactive === true || String(idol.inactive).toLowerCase() === 'true'
      );
      const isGroupInactive = Boolean(
        idol.girlGroup && inactiveGroupNamesSet.has(idol.girlGroup.trim().toLowerCase())
      );
      const isOverallInactive = isIdolDirectInactive || isGroupInactive;

      if (idolFilterStatus === 'inactive' && !isOverallInactive) return false;
      if (idolFilterStatus === 'active' && isOverallInactive) return false;

      if (idolSearch.trim()) {
        const query = idolSearch.toLowerCase().trim();
        const matchesName = idol.name.toLowerCase().includes(query);
        const matchesGroup = idol.girlGroup.toLowerCase().includes(query);
        const matchesSeed = idol.seed.toLowerCase().includes(query);
        const matchesNat = idol.nationality.toLowerCase().includes(query);
        if (!matchesName && !matchesGroup && !matchesSeed && !matchesNat) return false;
      }

      return true;
    });
  }, [idols, inactiveGroupNamesSet, idolFilterStatus, idolSearch]);

  // Filtered groups list
  const filteredGroups = useMemo(() => {
    return girlGroups.filter((group) => {
      if (groupSearch.trim()) {
        const query = groupSearch.toLowerCase().trim();
        return group.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [girlGroups, groupSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <UserX className="h-7 w-7 text-rose-400" />
            <span>Inactive Idol &amp; Girl Group Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage idols and girl groups on hiatus or inactive status. Inactive idols are strictly excluded from Competition Manager random draws and marked with an inactive badge in the database.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('idols')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeSubTab === 'idols'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Inactive Idols ({inactiveIdolCount})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              activeSubTab === 'groups'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Inactive Groups ({inactiveGroupCount})</span>
          </button>
        </div>
      </div>

      {/* Top Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Idols</span>
          <div className="text-2xl font-black text-emerald-400">{activeIdolCount}</div>
          <p className="text-[10px] text-slate-500">Eligible for tournament draws</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4 space-y-1">
          <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">Inactive Idols</span>
          <div className="text-2xl font-black text-rose-400">{inactiveIdolCount}</div>
          <p className="text-[10px] text-rose-300/70">Excluded from random pick</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Groups</span>
          <div className="text-2xl font-black text-indigo-400">{activeGroupCount}</div>
          <p className="text-[10px] text-slate-500">Full group active status</p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 space-y-1">
          <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Inactive Groups</span>
          <div className="text-2xl font-black text-purple-400">{inactiveGroupCount}</div>
          <p className="text-[10px] text-purple-300/70">All members inactive</p>
        </div>
      </div>

      {/* SECTION 1: INACTIVE IDOLS */}
      {activeSubTab === 'idols' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Text Input / Bulk Assign (Same input paradigm as Seed & Girl Group Manager) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ClipboardPaste className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Bulk Inactive Idols Input</h3>
                    <p className="text-[11px] text-slate-400">Paste names (one per line)</p>
                  </div>
                </div>

                <button
                  onClick={handlePopulateCurrentInactiveIdols}
                  title="Load currently inactive idol names"
                  className="text-[11px] font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Load Current
                </button>
              </div>

              {/* Input Mode Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIdolInputMode('append')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    idolInputMode === 'append'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Add / Merge (Default)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdolInputMode('replace');
                    handlePopulateCurrentInactiveIdols();
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    idolInputMode === 'replace'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Edit Full List</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300">
                    {idolInputMode === 'append'
                      ? 'Add New Inactive Idols (one per line):'
                      : 'Edit Complete Inactive List:'}
                  </label>
                  {idolText.trim() && (
                    <button
                      type="button"
                      onClick={() => setIdolText('')}
                      className="text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={idolText}
                  onChange={(e) => setIdolText(e.target.value)}
                  placeholder={
                    idolInputMode === 'append'
                      ? `Type or paste idol names to mark as inactive:\nKarina\nWonyoung\nYujin\nMinji\n\n(Previous inactive names will NOT be reset)`
                      : `Karina\nWonyoung\nYujin\n...`
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  {idolInputMode === 'append'
                    ? '💡 Preserves all previously inactive idols and adds new names.'
                    : '⚠️ Overwrites the inactive list with exactly the names above.'}
                </p>
              </div>

              {idolFeedback && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs font-semibold text-rose-200 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{idolFeedback}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleApplyIdolsText('append')}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                      idolInputMode === 'append'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white ring-1 ring-rose-400/40 shadow-rose-900/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Add to Inactive List</span>
                  </button>

                  <button
                    onClick={() => handleApplyIdolsText('replace')}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                      idolInputMode === 'replace'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white ring-1 ring-rose-400/40 shadow-rose-900/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Replace Entire List</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    clearIdols();
                    setIdolFeedback('All idols and girl groups have been reactivated to Active status!');
                    setTimeout(() => setIdolFeedback(null), 3500);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-950/60 text-xs font-bold text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Reactivate All Idols &amp; Groups</span>
                </button>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>Tournament Rule Behavior:</span>
                </p>
                <p>
                  Any idol on the inactive list will be excluded from all automated participant selection modes (Weighted Random Draw &amp; Previous Season Mode).
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Idol Roster & Status Management */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
                  <button
                    onClick={() => setIdolFilterStatus('inactive')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                      idolFilterStatus === 'inactive'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Inactive Only ({inactiveIdolCount})
                  </button>
                  <button
                    onClick={() => setIdolFilterStatus('active')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                      idolFilterStatus === 'active'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Active Only ({activeIdolCount})
                  </button>
                  <button
                    onClick={() => setIdolFilterStatus('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all ${
                      idolFilterStatus === 'all'
                        ? 'bg-slate-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({idols.length})
                  </button>
                  {inactiveIdolCount > 0 && (
                    <button
                      onClick={() => {
                        clearIdols();
                        setIdolFeedback('All idols and groups reactivated!');
                        setTimeout(() => setIdolFeedback(null), 3000);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 transition-colors"
                      title="Reactivate all currently inactive idols & groups"
                    >
                      Reactivate All
                    </button>
                  )}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search idol, group, seed..."
                    value={idolSearch}
                    onChange={(e) => setIdolSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Idols List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredIdols.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 space-y-2">
                    <UserX className="h-8 w-8 mx-auto opacity-40" />
                    <p className="text-sm font-semibold">No idols found matching this filter.</p>
                  </div>
                ) : (
                  filteredIdols.map((idol) => {
                    const isDirectInactive = Boolean(
                      idol.inactive === true || String(idol.inactive).toLowerCase() === 'true'
                    );
                    const isGroupInactive = Boolean(
                      idol.girlGroup && inactiveGroupNamesSet.has(idol.girlGroup.trim().toLowerCase())
                    );
                    const isInactive = isDirectInactive || isGroupInactive;

                    return (
                      <div
                        key={idol.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isInactive
                            ? 'border-rose-900/50 bg-rose-950/20 text-slate-300'
                            : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {idol.photoUrl ? (
                            <img
                              src={idol.photoUrl}
                              alt={idol.name}
                              className={`h-10 w-10 rounded-xl object-cover border shrink-0 ${
                                isInactive ? 'border-rose-700/60 opacity-60 grayscale-[40%]' : 'border-slate-700'
                              }`}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-xl bg-black border border-slate-700 flex items-center justify-center font-bold text-xs text-amber-300 shrink-0">
                              {idol.name.slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs leading-tight flex items-center gap-1.5 truncate">
                              <span className={isInactive ? 'text-rose-300' : 'text-white'}>
                                {idol.name}
                              </span>
                              <span className="text-[11px] shrink-0">{getCountryFlag(idol.nationality)}</span>
                              {isDirectInactive && (
                                <span className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500/60 text-rose-300">
                                  Inactive
                                </span>
                              )}
                              {isGroupInactive && !isDirectInactive && (
                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-950 border border-purple-500/40 text-purple-300">
                                  Group Hiatus
                                </span>
                              )}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">
                              {idol.girlGroup} &bull; {idol.seed} &bull; {idol.nationality}
                            </p>
                          </div>
                        </div>

                        {/* Toggle Button */}
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <button
                            onClick={() => toggleIdol(idol.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                              isDirectInactive
                                ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-900/40'
                                : isGroupInactive
                                ? 'bg-purple-700 text-white hover:bg-purple-600 shadow-md shadow-purple-900/40'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                            }`}
                            title={
                              isDirectInactive
                                ? 'Click to reactivate this idol'
                                : isGroupInactive
                                ? 'Girl group is on hiatus. Click to reactivate this idol & group'
                                : 'Click to mark this idol as inactive'
                            }
                          >
                            {isDirectInactive ? (
                              <>
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Inactive</span>
                              </>
                            ) : isGroupInactive ? (
                              <>
                                <Layers className="h-3.5 w-3.5" />
                                <span>Group Hiatus (Click to Activate)</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Active</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: INACTIVE GIRL GROUPS */}
      {activeSubTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Text Input / Bulk Assign for Girl Groups */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Bulk Inactive Girl Groups</h3>
                    <p className="text-[11px] text-slate-400">Paste group names (one per line)</p>
                  </div>
                </div>

                <button
                  onClick={handlePopulateCurrentInactiveGroups}
                  title="Load currently inactive group names"
                  className="text-[11px] font-bold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Load Current
                </button>
              </div>

              {/* Input Mode Selector */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setGroupInputMode('append')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    groupInputMode === 'append'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Add / Merge (Default)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupInputMode('replace');
                    handlePopulateCurrentInactiveGroups();
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    groupInputMode === 'replace'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Edit Full List</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300">
                    {groupInputMode === 'append'
                      ? 'Add New Inactive Groups (one per line):'
                      : 'Edit Complete Inactive Groups List:'}
                  </label>
                  {groupText.trim() && (
                    <button
                      type="button"
                      onClick={() => setGroupText('')}
                      className="text-[11px] text-slate-400 hover:text-purple-300 transition-colors"
                    >
                      Clear Text
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={groupText}
                  onChange={(e) => setGroupText(e.target.value)}
                  placeholder={
                    groupInputMode === 'append'
                      ? `Type or paste girl group names to mark as inactive:\nBLACKPINK\nTWICE\nRed Velvet\n\n(Previous inactive groups will NOT be reset)`
                      : `BLACKPINK\nTWICE\nRed Velvet\n...`
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400">
                  {groupInputMode === 'append'
                    ? '💡 Preserves all previously inactive groups and adds new names.'
                    : '⚠️ Overwrites the inactive group list with exactly the names above.'}
                </p>
              </div>

              {groupFeedback && (
                <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/50 text-xs font-semibold text-purple-200 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>{groupFeedback}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleApplyGroupsText('append')}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                      groupInputMode === 'append'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white ring-1 ring-purple-400/40 shadow-purple-900/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>Add to Inactive Groups</span>
                  </button>

                  <button
                    onClick={() => handleApplyGroupsText('replace')}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
                      groupInputMode === 'replace'
                        ? 'bg-purple-600 hover:bg-purple-500 text-white ring-1 ring-purple-400/40 shadow-purple-900/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Replace Entire List</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    clearGroups();
                    setGroupFeedback('All girl groups have been reactivated to Active status!');
                    setTimeout(() => setGroupFeedback(null), 3500);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-950/60 text-xs font-bold text-purple-300 border border-purple-500/30 hover:border-purple-500/60 transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4 text-purple-400" />
                  <span>Reactivate All Girl Groups</span>
                </button>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 text-purple-400" />
                  <span>Cascading Deactivation:</span>
                </p>
                <p>
                  Marking a Girl Group as inactive automatically excludes all of its members from random competition pick.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Girl Group Cards & Toggles */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-extrabold text-sm text-white">All Girl Groups ({girlGroups.length})</h3>
                <div className="relative w-56">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search group..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredGroups.map((group) => {
                  const isInactive = Boolean(group.inactive);
                  const memberCount = idols.filter((i) => i.girlGroup === group.name).length;

                  return (
                    <div
                      key={group.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                        isInactive
                          ? 'border-purple-900/50 bg-purple-950/20'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1 flex items-center justify-center">
                            {group.logoUrl ? (
                              <img
                                src={group.logoUrl}
                                alt={group.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-xs font-black text-purple-400">
                                {group.name.substring(0, 3).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white">{group.name}</h4>
                            <span className="text-[11px] text-slate-400 font-semibold">
                              {memberCount} Members
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            isInactive
                              ? 'bg-purple-950 text-purple-300 border-purple-700'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full py-2 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                          isInactive
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                        }`}
                      >
                        {isInactive ? (
                          <>
                            <ToggleLeft className="h-4 w-4 text-purple-200" />
                            <span>Click to Activate Group</span>
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-4 w-4 text-emerald-400" />
                            <span>Mark Group Inactive</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
