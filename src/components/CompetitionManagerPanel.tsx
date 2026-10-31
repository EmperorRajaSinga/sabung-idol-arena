import React, { useState, useMemo } from 'react';
import { Idol, GirlGroup, TournamentConfig, TournamentArchive, ArchivedMatch } from '../types';
import {
  selectParticipantsRandom,
  selectParticipantsFromPreviousSeason,
  getPreviousSeasonSummary,
  PreviousSeasonSummary,
  isIdolActive,
} from '../utils/tournamentLogic';
import { loadSavedTop32Qualifiers } from '../utils/leagueLogic';
import { getCountryFlag } from '../utils/nationalityHelper';
import {
  Play,
  Shuffle,
  CheckSquare,
  Layers,
  Sparkles,
  AlertTriangle,
  History,
  Crown,
  Info,
  X,
  UserX,
  Award,
  Filter,
  Medal,
} from 'lucide-react';

interface CompetitionManagerPanelProps {
  idols: Idol[];
  girlGroups?: GirlGroup[];
  archives?: TournamentArchive[];
  matchDatabase?: ArchivedMatch[];
  config: TournamentConfig;
  selectedParticipantIds: string[];
  onUpdateSelectedParticipants: (ids: string[]) => void;
  onProceedToGroupDraw: () => void;
  onUpdateConfig?: (newConfig: Partial<TournamentConfig>) => void;
  onEnsureIdolCount?: (targetCount: number) => void;
}

export const CompetitionManagerPanel: React.FC<CompetitionManagerPanelProps> = ({
  idols,
  girlGroups = [],
  archives = [],
  matchDatabase = [],
  config,
  selectedParticipantIds,
  onUpdateSelectedParticipants,
  onProceedToGroupDraw,
  onUpdateConfig,
  onEnsureIdolCount,
}) => {
  const [selectionMode, setSelectionMode] = useState<
    'random' | 'previous_season' | 'league_top32' | 'manual'
  >('random');
  const [search, setSearch] = useState('');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportFilter, setReportFilter] = useState<'knockout_32' | 'eliminated' | 'last_place' | 'top3' | 'top16'>('knockout_32');

  const safeConfig = config || {
    seasonId: 1,
    seasonNumber: 1,
    seasonName: 'Season 1',
    totalParticipants: 64,
    numGroups: 16,
    participantsPerGroup: 4,
    qualifiedPerGroup: 2,
    isStarted: false,
    isGroupStageFinished: false,
    isKnockoutFinished: false,
  };
  const totalNeeded = safeConfig.totalParticipants;
  const isComplete = selectedParticipantIds.length === totalNeeded;

  const inactiveGroupNamesSet = useMemo(() => {
    const set = new Set<string>();
    (girlGroups || []).forEach((g) => {
      if (g.inactive === true || String(g.inactive).toLowerCase() === 'true') {
        set.add(g.name.trim().toLowerCase());
      }
    });
    return set;
  }, [girlGroups]);

  const prevSeasonSummary = useMemo(() => {
    return getPreviousSeasonSummary(idols, archives, matchDatabase);
  }, [idols, archives, matchDatabase]);

  const lastPlacePrevSeasonSet = useMemo(() => {
    return new Set<string>(prevSeasonSummary?.lastPlaceIdolIds || []);
  }, [prevSeasonSummary]);

  const handleRandomSelect = () => {
    if (idols.length < totalNeeded && onEnsureIdolCount) {
      onEnsureIdolCount(totalNeeded);
      return;
    }
    const chosenIds = selectParticipantsRandom(
      idols,
      totalNeeded,
      girlGroups,
      archives,
      matchDatabase
    );
    onUpdateSelectedParticipants(chosenIds);
  };

  const handlePreviousSeasonSelect = () => {
    if (idols.length < totalNeeded && onEnsureIdolCount) {
      onEnsureIdolCount(totalNeeded);
      return;
    }
    const chosenIds = selectParticipantsFromPreviousSeason(
      idols,
      totalNeeded,
      archives,
      matchDatabase,
      girlGroups
    );
    onUpdateSelectedParticipants(chosenIds);
  };

  const savedLeagueTop32 = useMemo(() => {
    return loadSavedTop32Qualifiers();
  }, []);

  const handleLeagueTop32Select = () => {
    const qualifiers = loadSavedTop32Qualifiers();
    if (!qualifiers || qualifiers.length === 0) {
      alert(
        'No saved League Top 32 Qualifiers found yet!\n\nPlease go to the Idol League System tab and complete or simulate league matches to generate Top 32 qualifiers.'
      );
      return;
    }

    const qualifierIds = qualifiers.map((q) => q.idolId).filter(Boolean);
    if (qualifierIds.length === 0) {
      alert('No valid idol IDs found in saved league qualifiers.');
      return;
    }

    // Auto adjust tournament size if needed or take up to totalNeeded
    if (totalNeeded !== 32 && onUpdateConfig) {
      onUpdateConfig({
        totalParticipants: 32,
        numGroups: 8,
      });
    }

    onUpdateSelectedParticipants(qualifierIds.slice(0, Math.max(32, totalNeeded)));
  };

  const handleSelectFirstN = () => {
    if (idols.length < totalNeeded && onEnsureIdolCount) {
      onEnsureIdolCount(totalNeeded);
      return;
    }
    const activeIdols = idols.filter((i) => isIdolActive(i, girlGroups || []));
    onUpdateSelectedParticipants(activeIdols.slice(0, totalNeeded).map((i) => i.id));
  };

  const handleToggleIdol = (idolId: string) => {
    if (selectedParticipantIds.includes(idolId)) {
      onUpdateSelectedParticipants(selectedParticipantIds.filter((id) => id !== idolId));
    } else {
      if (selectedParticipantIds.length < totalNeeded) {
        onUpdateSelectedParticipants([...selectedParticipantIds, idolId]);
      } else {
        alert(`You have already selected ${totalNeeded} participants.`);
      }
    }
  };

  const seedOrder: Record<string, number> = {
    'Seed 1': 1,
    'Seed 2': 2,
    'Seed 3': 3,
    'Seed 4': 4,
  };

  const filteredIdols = idols
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.girlGroup.toLowerCase().includes(search.toLowerCase()) ||
        (i.seed && i.seed.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      const orderA = seedOrder[a.seed] ?? 99;
      const orderB = seedOrder[b.seed] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

  const hasPreviousSeasonData = archives && archives.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Play className="h-6 w-6 text-indigo-400" />
            <span>Competition Participant Selection</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose {totalNeeded} participants for {config?.seasonName || `Season ${config?.seasonNumber || 1}`}. Use Weighted Random Selection, Previous Season Performance, or select manually.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tournament Size Quick Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400">Size:</span>
            <select
              value={totalNeeded}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                const ppg = safeConfig.participantsPerGroup || 4;
                const ng = Math.max(1, Math.floor(val / ppg));
                if (onUpdateConfig) {
                  onUpdateConfig({
                    totalParticipants: val,
                    numGroups: ng,
                  });
                }
              }}
              className="bg-slate-950 text-xs font-extrabold text-indigo-400 rounded-lg px-2 py-1 border border-indigo-500/30 focus:outline-none"
            >
              <option value={16}>16 Participants</option>
              <option value={24}>24 Participants</option>
              <option value={32}>32 Participants</option>
              <option value={48}>48 Participants</option>
              <option value={64}>64 Participants</option>
              <option value={80}>80 Participants</option>
              <option value={96}>96 Participants</option>
              <option value={128}>128 Participants</option>
              <option value={256}>256 Participants</option>
            </select>
          </div>

          <span className="text-xs font-bold text-slate-300">
            Selected:{' '}
            <span
              className={
                isComplete
                  ? 'text-emerald-400 font-extrabold text-sm'
                  : 'text-amber-400 font-extrabold text-sm'
              }
            >
              {selectedParticipantIds.length} / {totalNeeded}
            </span>
          </span>

          <button
            disabled={!isComplete}
            onClick={onProceedToGroupDraw}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
              isComplete
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-[1.02]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Proceed to Group Draw</span>
          </button>
        </div>
      </div>

      {/* Database warning if less than totalNeeded */}
      {idols.length < totalNeeded && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <span className="font-extrabold text-amber-300">Database Warning:</span> You have{' '}
              <span className="font-bold text-white">{idols.length}</span> idols in your database, but the tournament requires{' '}
              <span className="font-bold text-white">{totalNeeded}</span> participants.
            </div>
          </div>
          {onEnsureIdolCount && (
            <button
              onClick={() => onEnsureIdolCount(totalNeeded)}
              className="flex-shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 font-black text-slate-950 text-xs shadow-md transition-colors"
            >
              ⚡ Auto-Fill Database to {totalNeeded} Idols
            </button>
          )}
        </div>
      )}

      {/* Mode Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Weighted Random Selection Card */}
        <div
          onClick={() => setSelectionMode('random')}
          className={`cursor-pointer rounded-2xl border p-5 transition-all flex flex-col justify-between ${
            selectionMode === 'random'
              ? 'border-indigo-500/50 bg-indigo-950/20 ring-1 ring-indigo-500/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 text-indigo-400" />
                <h3 className="font-extrabold text-sm text-white">Weighted Random</h3>
              </div>
              <span className="text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                Rule 1 &amp; 2
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Prioritizes <strong>Seeds 1–3</strong>, excludes recent eliminated idols, guarantees <strong>#1 Girl Group</strong>.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRandomSelect();
            }}
            className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Select Random</span>
          </button>
        </div>

        {/* 2. Previous Season Performance Card */}
        <div
          onClick={() => setSelectionMode('previous_season')}
          className={`cursor-pointer rounded-2xl border p-5 transition-all flex flex-col justify-between ${
            selectionMode === 'previous_season'
              ? 'border-amber-500/50 bg-amber-950/20 ring-1 ring-amber-500/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">Previous Season</h3>
              </div>
              <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                Rule 3
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Prioritizes previous <strong>Big 32 Knockout</strong> qualifiers. Excludes last place for 1 season.
            </p>

            {prevSeasonSummary && (
              <div className="grid grid-cols-2 gap-1 mb-3">
                <div className="bg-amber-950/40 border border-amber-500/20 rounded-lg p-1 text-center">
                  <div className="text-[9px] text-amber-300 font-semibold">Knockout</div>
                  <div className="text-[11px] font-black text-amber-100">
                    {prevSeasonSummary.top32KnockoutCount} Idols
                  </div>
                </div>
                <div className="bg-rose-950/40 border border-rose-500/20 rounded-lg p-1 text-center">
                  <div className="text-[9px] text-rose-300 font-semibold">Eliminated</div>
                  <div className="text-[11px] font-black text-rose-200">
                    {prevSeasonSummary.eliminatedGroupCount} ({prevSeasonSummary.lastPlaceCount} Last)
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePreviousSeasonSelect();
              }}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-xs font-bold text-white shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              <Crown className="h-4 w-4 text-amber-200" />
              <span>Select Prev Big 32</span>
            </button>

            {hasPreviousSeasonData && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReportModal(true);
                }}
                className="w-full py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-1"
              >
                <Info className="h-3 w-3 text-amber-400" />
                <span>View Report</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. League Top 32 Qualifiers Card */}
        <div
          onClick={() => setSelectionMode('league_top32')}
          className={`cursor-pointer rounded-2xl border p-5 transition-all flex flex-col justify-between ${
            selectionMode === 'league_top32'
              ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-emerald-400" />
                <h3 className="font-extrabold text-sm text-white">League Top 32</h3>
              </div>
              <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                League Qualifiers
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Load the saved <strong>Top 32 Qualifiers</strong> from the 6-Division Idol League system directly into this tournament.
            </p>
            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-1.5 text-center mb-3">
              <div className="text-[9px] text-emerald-300 font-semibold">Saved League Qualifiers</div>
              <div className="text-xs font-black text-emerald-100">
                {savedLeagueTop32.length > 0 ? `${savedLeagueTop32.length} Qualifiers Available` : '0 Saved'}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLeagueTop32Select();
            }}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            <Crown className="h-4 w-4 text-amber-300" />
            <span>Load League Top 32</span>
          </button>
        </div>

        {/* 4. Manual Selection Card */}
        <div
          onClick={() => setSelectionMode('manual')}
          className={`cursor-pointer rounded-2xl border p-5 transition-all flex flex-col justify-between ${
            selectionMode === 'manual'
              ? 'border-purple-500/50 bg-purple-950/20 ring-1 ring-purple-500/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-purple-400" />
                <h3 className="font-extrabold text-sm text-white">Manual Roster</h3>
              </div>
              <span className="text-[9px] uppercase font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                Custom
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Pick exact participants individually or auto-fill first {totalNeeded} idols from the roster.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFirstN();
              }}
              className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md transition-colors"
            >
              First {totalNeeded}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdateSelectedParticipants([]);
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Participant Checklist Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-extrabold text-base text-white">Available Idol Database ({idols.length})</h3>
            {lastPlacePrevSeasonSet.size > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-red-400 bg-red-950/70 border border-red-800/50 px-2.5 py-0.5 rounded-lg shadow-sm">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span>{lastPlacePrevSeasonSet.size} Last Place in {prevSeasonSummary?.seasonName} (Red Names)</span>
              </span>
            )}
          </div>
          <input
            type="text"
            placeholder="Search idol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
          {filteredIdols.map((idol) => {
            const isSelected = selectedParticipantIds.includes(idol.id);
            const isLastPlacePrevSeason = lastPlacePrevSeasonSet.has(idol.id);
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
                onClick={() => handleToggleIdol(idol.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500/60 bg-indigo-950/40 text-white ring-1 ring-indigo-500/40 shadow-sm'
                    : isInactive
                    ? 'border-rose-900/40 bg-rose-950/20 text-slate-400 opacity-75 hover:opacity-100 hover:border-rose-700/60'
                    : isLastPlacePrevSeason
                    ? 'border-red-900/50 bg-red-950/20 text-slate-300 hover:border-red-700/60'
                    : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {idol.photoUrl ? (
                    <img
                      src={idol.photoUrl}
                      alt={idol.name}
                      className={`h-8 w-8 rounded-lg object-cover border shrink-0 ${
                        isInactive
                          ? 'border-rose-700/50 grayscale-[50%]'
                          : isLastPlacePrevSeason
                          ? 'border-red-700/60 ring-1 ring-red-500/30'
                          : 'border-slate-700'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={`h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs shrink-0 ${
                        isInactive ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      {(idol.name || 'ID').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4
                      className={`font-bold text-xs leading-tight flex items-center gap-1 truncate ${
                        isInactive
                          ? 'text-rose-300'
                          : isLastPlacePrevSeason
                          ? 'text-red-400 font-black'
                          : isSelected
                          ? 'text-white'
                          : 'text-slate-200'
                      }`}
                    >
                      <span className={isInactive ? 'text-rose-300 line-through-none' : isLastPlacePrevSeason ? 'text-red-400 font-black' : ''}>
                        {idol.name}
                      </span>
                      <span className="text-[11px] shrink-0">{getCountryFlag(idol.nationality)}</span>
                      {isInactive && (
                        <span className="shrink-0 ml-0.5 text-[8px] px-1 py-0.2 rounded bg-rose-950 border border-rose-500/60 text-rose-300 font-black uppercase">
                          Inactive
                        </span>
                      )}
                      {isLastPlacePrevSeason && !isInactive && (
                        <span className="shrink-0 ml-0.5 text-[8px] px-1 py-0.2 rounded bg-red-950 border border-red-500/60 text-red-300 font-black uppercase">
                          Last
                        </span>
                      )}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {idol.girlGroup} &bull; {idol.seed}
                    </p>
                  </div>
                </div>

                <div
                  className={`h-5 w-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ml-2 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : isInactive
                      ? 'border-rose-900 bg-rose-950/30 text-rose-400'
                      : isLastPlacePrevSeason
                      ? 'border-red-800 bg-red-950/40 text-red-400'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {isSelected && <span className="text-xs font-black">✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Elimination & Performance Report Modal */}
      {showReportModal && prevSeasonSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <span>{prevSeasonSummary.seasonName} Elimination &amp; Performance Report</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive roster breakdown of idol outcomes from the previous tournament season.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setReportFilter('knockout_32')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      reportFilter === 'knockout_32'
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30 ring-1 ring-amber-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span>Big 32 Knockout Qualifiers ({prevSeasonSummary.top32KnockoutCount})</span>
                  </button>

                  <button
                    onClick={() => setReportFilter('eliminated')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      reportFilter === 'eliminated'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/30 ring-1 ring-rose-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <UserX className="h-3.5 w-3.5" />
                    <span>Didn't Advance ({prevSeasonSummary.eliminatedGroupCount})</span>
                  </button>

                  <button
                    onClick={() => setReportFilter('last_place')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      reportFilter === 'last_place'
                        ? 'bg-red-700 text-white shadow-lg shadow-red-900/30 ring-1 ring-red-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Last Place Excluded ({prevSeasonSummary.lastPlaceCount})</span>
                  </button>

                  <button
                    onClick={() => setReportFilter('top16')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      reportFilter === 'top16'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 ring-1 ring-indigo-400'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Top 16 ({prevSeasonSummary.top16Count})</span>
                  </button>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search by name, group, team..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* List Body */}
            <div className="p-4 overflow-y-auto max-h-[55vh] custom-scrollbar space-y-2">
              {(() => {
                let displayedList: {
                  id: string;
                  name: string;
                  girlGroup: string;
                  nationality: string;
                  photoUrl: string;
                  seed: string;
                  groupName?: string;
                  rank?: number;
                  points?: number;
                  won?: number;
                  drawn?: number;
                  lost?: number;
                  badge: string;
                  badgeColor: string;
                }[] = [];

                if (reportFilter === 'knockout_32') {
                  const idolsMap = new Map<string, Idol>(idols.map((i) => [i.id, i]));
                  displayedList = prevSeasonSummary.top32KnockoutIdolIds.map((id) => {
                    const idolObj = idolsMap.get(id);
                    return {
                      id,
                      name: idolObj?.name || `Idol ${id}`,
                      girlGroup: idolObj?.girlGroup || 'Solo',
                      nationality: idolObj?.nationality || 'South Korea',
                      photoUrl: idolObj?.photoUrl || '',
                      seed: idolObj?.seed || 'Unseeded',
                      badge: 'Knockout Stage (Big 32)',
                      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
                    };
                  });
                } else if (reportFilter === 'eliminated') {
                  displayedList = prevSeasonSummary.eliminatedIdols.map((i) => ({
                    id: i.idolId,
                    name: i.idolName,
                    girlGroup: i.girlGroup,
                    nationality: i.nationality,
                    photoUrl: i.photoUrl,
                    seed: i.seed,
                    groupName: i.groupName,
                    rank: i.rank,
                    points: i.points,
                    won: i.won,
                    drawn: i.drawn,
                    lost: i.lost,
                    badge: i.isLastPlace ? 'Last Place (Excluded)' : 'Eliminated in Group',
                    badgeColor: i.isLastPlace ? 'bg-red-950 text-red-400 border-red-800' : 'bg-rose-950 text-rose-400 border-rose-800',
                  }));
                } else if (reportFilter === 'last_place') {
                  displayedList = prevSeasonSummary.eliminatedIdols
                    .filter((i) => i.isLastPlace)
                    .map((i) => ({
                      id: i.idolId,
                      name: i.idolName,
                      girlGroup: i.girlGroup,
                      nationality: i.nationality,
                      photoUrl: i.photoUrl,
                      seed: i.seed,
                      groupName: i.groupName,
                      rank: i.rank,
                      points: i.points,
                      won: i.won,
                      drawn: i.drawn,
                      lost: i.lost,
                      badge: 'Last Place (Excluded)',
                      badgeColor: 'bg-red-950 text-red-400 border-red-800',
                    }));
                } else if (reportFilter === 'top3') {
                  const idolsMap = new Map<string, Idol>(idols.map((i) => [i.id, i]));
                  displayedList = prevSeasonSummary.top3GroupFinishIdolIds.map((id) => {
                    const idolObj = idolsMap.get(id);
                    return {
                      id,
                      name: idolObj?.name || `Idol ${id}`,
                      girlGroup: idolObj?.girlGroup || 'Solo',
                      nationality: idolObj?.nationality || 'South Korea',
                      photoUrl: idolObj?.photoUrl || '',
                      seed: idolObj?.seed || 'Unseeded',
                      badge: 'Top 3 Group Finish',
                      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
                    };
                  });
                } else if (reportFilter === 'top16') {
                  const idolsMap = new Map<string, Idol>(idols.map((i) => [i.id, i]));
                  displayedList = prevSeasonSummary.top16IdolIds.map((id) => {
                    const idolObj = idolsMap.get(id);
                    return {
                      id,
                      name: idolObj?.name || `Idol ${id}`,
                      girlGroup: idolObj?.girlGroup || 'Solo',
                      nationality: idolObj?.nationality || 'South Korea',
                      photoUrl: idolObj?.photoUrl || '',
                      seed: idolObj?.seed || 'Unseeded',
                      badge: 'Top 16 Knockout Qualifier',
                      badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
                    };
                  });
                }

                // Filter by report search
                const query = reportSearch.toLowerCase().trim();
                if (query) {
                  displayedList = displayedList.filter(
                    (i) =>
                      i.name.toLowerCase().includes(query) ||
                      i.girlGroup.toLowerCase().includes(query) ||
                      (i.groupName && i.groupName.toLowerCase().includes(query)) ||
                      (i.seed && i.seed.toLowerCase().includes(query))
                  );
                }

                if (displayedList.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-500">
                      <UserX className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium">No idols found matching this filter.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {displayedList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="h-10 w-10 rounded-lg object-cover border border-slate-800 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-300 shrink-0">
                              {(item.name || 'ID').slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-white leading-tight flex items-center gap-1.5 truncate">
                              <span className="truncate">{item.name}</span>
                              <span className="shrink-0 text-[11px]">{getCountryFlag(item.nationality)}</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">
                              {item.girlGroup} &bull; {item.seed}
                            </p>
                            {item.groupName && (
                              <p className="text-[10px] text-slate-500">
                                {item.groupName} &bull; Rank #{item.rank} ({item.points} pts)
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Previous Season Mode prioritizes Big 32 Knockout Stage qualifiers and Seed 1–3 idols, while excluding eliminated &amp; last-place idols for 1 season.
              </span>
              <button
                onClick={() => setShowReportModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
