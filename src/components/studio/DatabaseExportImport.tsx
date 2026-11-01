import { applyLeagueRosterImport } from '../../utils/leagueRosterImport';
import React, { useState, useMemo, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  Users,
  Shield,
  Table,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  AppState,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
  CareerStat,
} from '../../types';
import {
  CareerOverridesMap,
  exportFullDatabaseBackup,
  exportIdolGroupDatabase,
  exportLeagueBrandingAndRosters,
  exportPermanentMatchDatabase,
  exportFullHistoricalStats,
  validateAndParseDatabaseBackup,
  saveCareerOverrides,
} from '../../utils/databaseStudioLogic';
import { saveIdols, saveGirlGroups, saveTournamentArchives, saveMatchDatabase } from '../../utils/storage';
import { saveLeagueSeasonState, saveLeagueArchives, saveCustomLeagueBranding } from '../../utils/leagueLogic';
import { saveTheIdolsState, saveTheIdolsArchives } from '../../utils/theIdolsLogic';
import { saveV5State } from '../../utils/v5/store';
import type { V5State } from '../../utils/v5/store';
import { rebuildLeague } from '../../utils/v5/engine';

interface DatabaseExportImportProps {
  appState: AppState;
  v5State?: V5State | null;
  leagueState: LeagueSeasonState | null;
  leagueArchives: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  overrides?: CareerOverridesMap;
  careerStats?: CareerStat[];
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  onUpdateLeagueState: (newState: LeagueSeasonState) => void;
  onUpdateLeagueArchives: (newArchives: LeagueSeasonArchive[]) => void;
  onUpdateTheIdolsState?: (newState: TheIdolsSeasonState | null) => void;
  onUpdateTheIdolsArchives?: (newArchives: TheIdolsSeasonArchive[]) => void;
  onSaveOverrides?: (newOverrides: CareerOverridesMap) => void;
  onRefreshAllStats?: () => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export const DatabaseExportImport: React.FC<DatabaseExportImportProps> = ({
  appState,
  v5State,
  leagueState,
  leagueArchives,
  theIdolsState,
  theIdolsArchives,
  overrides = {},
  careerStats = [],
  onUpdateAppState,
  onUpdateLeagueState,
  onUpdateLeagueArchives,
  onUpdateTheIdolsState,
  onUpdateTheIdolsArchives,
  onSaveOverrides,
  onRefreshAllStats,
  showToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Import review state
  const [importStaging, setImportStaging] = useState<{
    format: string;
    description: string;
    summary: any;
    data: any;
  } | null>(null);

  // Raw JSON category view
  const [rawViewKey, setRawViewKey] = useState<
    'full_backup' | 'idols_groups' | 'league_branding_rosters' | 'permanent_match_db' | 'full_historical_stats'
  >('full_backup');

  // Trigger file download helper
  const triggerDownload = (filename: string, jsonString: string) => {
    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      showToast(`Downloaded ${filename} successfully!`, 'success');
    } catch (err: any) {
      showToast(`Download failed: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. Full Backup
  const handleDownloadFullBackup = () => {
    try {
      const jsonStr = exportFullDatabaseBackup(
        appState,
        leagueState,
        leagueArchives,
        overrides,
        theIdolsState,
        theIdolsArchives
      );
      triggerDownload(`sabung_full_backup_${todayStr}.json`, jsonStr);
    } catch (err: any) {
      showToast(`Failed generating full backup: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // 2. Full Idol & Group Database
  const handleDownloadIdolsGroups = () => {
    try {
      const jsonStr = exportIdolGroupDatabase(appState);
      triggerDownload(`sabung_idols_and_groups_database_${todayStr}.json`, jsonStr);
    } catch (err: any) {
      showToast(`Failed generating idol database: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // 3. League Branding & Full Rosters
  const handleDownloadLeagueBrandingRosters = () => {
    try {
      const jsonStr = exportLeagueBrandingAndRosters(
        leagueState,
        appState.idols,
        appState.customLeagueBranding,
        v5State,
        appState.girlGroups || []
      );
      triggerDownload(`sabung_league_branding_and_rosters_${todayStr}.json`, jsonStr);
    } catch (err: any) {
      showToast(`Failed generating league rosters: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // 4. Permanent Match DB
  const handleDownloadMatchDatabase = () => {
    try {
      const jsonStr = exportPermanentMatchDatabase(
        appState,
        leagueState,
        leagueArchives,
        theIdolsState,
        theIdolsArchives
      );
      triggerDownload(`sabung_permanent_match_database_${todayStr}.json`, jsonStr);
    } catch (err: any) {
      showToast(`Failed generating match database: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // 5. Full Historical Stat
  const handleDownloadHistoricalStats = () => {
    try {
      const jsonStr = exportFullHistoricalStats(
        appState,
        leagueState,
        leagueArchives,
        theIdolsState,
        theIdolsArchives,
        overrides,
        careerStats
      );
      triggerDownload(`sabung_full_historical_stats_${todayStr}.json`, jsonStr);
    } catch (err: any) {
      showToast(`Failed generating historical stats: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // Handle file selection from disk
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) {
        showToast('Empty file selected.', 'error');
        return;
      }

      const result = validateAndParseDatabaseBackup(text);
      if (!result.success || !result.data) {
        showToast(result.error || 'Failed to parse JSON file.', 'error');
        return;
      }

      const formatLabels: Record<string, string> = {
        full_backup: 'Complete Full Backup',
        idols_groups: 'Idol & Group Database',
        league_branding_rosters: 'League Branding & Rosters',
        permanent_match_db: 'Permanent Match Database',
        full_historical_stats: 'Full Historical Statistics',
        generic: 'Universal Database JSON',
      };

      setImportStaging({
        format: result.format || 'generic',
        description: formatLabels[result.format || 'generic'] || 'Database File',
        summary: result.summary,
        data: result.data,
      });

      showToast(`Detected ${formatLabels[result.format || 'generic']}! Review details below to restore.`, 'info');
    };

    reader.onerror = () => {
      showToast('Error reading uploaded file.', 'error');
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute restore of staged data
  const handleExecuteRestore = () => {
    if (!importStaging) return;
    const { format, data } = importStaging;

    try {
      if (format === 'full_backup' || format === 'generic') {
        // Restore all subsystems
        if (Array.isArray(data.idols) && data.idols.length > 0) {
          saveIdols(data.idols);
        }
        if (Array.isArray(data.girlGroups)) {
          saveGirlGroups(data.girlGroups);
        }
        if (Array.isArray(data.tournamentArchives || data.archives)) {
          saveTournamentArchives(data.tournamentArchives || data.archives);
        }
        if (Array.isArray(data.matchDatabase)) {
          saveMatchDatabase(data.matchDatabase);
        }
        if (data.leagueSeasonState) {
          saveLeagueSeasonState(data.leagueSeasonState);
          onUpdateLeagueState(data.leagueSeasonState);
        }
        if (Array.isArray(data.leagueArchives)) {
          saveLeagueArchives(data.leagueArchives);
          onUpdateLeagueArchives(data.leagueArchives);
        }
        if (data.theIdolsSeasonState && onUpdateTheIdolsState) {
          saveTheIdolsState(data.theIdolsSeasonState);
          onUpdateTheIdolsState(data.theIdolsSeasonState);
        }
        if (Array.isArray(data.theIdolsArchives) && onUpdateTheIdolsArchives) {
          saveTheIdolsArchives(data.theIdolsArchives);
          onUpdateTheIdolsArchives(data.theIdolsArchives);
        }
        if (data.careerStatsOverrides && typeof data.careerStatsOverrides === 'object') {
          saveCareerOverrides(data.careerStatsOverrides);
          onSaveOverrides?.(data.careerStatsOverrides);
        }

        if (data.v5State && typeof data.v5State === 'object') saveV5State(data.v5State);
        onUpdateAppState((prev) => ({
          ...prev,
          idols: Array.isArray(data.idols) && data.idols.length > 0 ? data.idols : prev.idols,
          girlGroups: Array.isArray(data.girlGroups) ? data.girlGroups : prev.girlGroups,
          config: data.tournamentConfig ? { ...prev.config, ...data.tournamentConfig } : prev.config,
          archives: Array.isArray(data.tournamentArchives || data.archives)
            ? (data.tournamentArchives || data.archives)
            : prev.archives,
          matchDatabase: Array.isArray(data.matchDatabase) ? data.matchDatabase : prev.matchDatabase,
          theIdolsState: data.theIdolsSeasonState || prev.theIdolsState,
          theIdolsArchives: Array.isArray(data.theIdolsArchives) ? data.theIdolsArchives : prev.theIdolsArchives,
          customLeagueBranding: Array.isArray(data.customLeagueBranding)
            ? data.customLeagueBranding
            : prev.customLeagueBranding,
          personalRankings: Array.isArray(data.personalRankings) ? data.personalRankings : prev.personalRankings,
          v5State: data.v5State && typeof data.v5State === 'object' ? data.v5State : prev.v5State,
          v5TitleArchives: Array.isArray(data.v5TitleArchives) ? data.v5TitleArchives : prev.v5TitleArchives,
        }));
      } else if (format === 'idols_groups') {
        if (Array.isArray(data.idols) && data.idols.length > 0) {
          saveIdols(data.idols);
          if (Array.isArray(data.girlGroups)) {
            saveGirlGroups(data.girlGroups);
          }
          onUpdateAppState((prev) => ({
            ...prev,
            idols: data.idols,
            girlGroups: Array.isArray(data.girlGroups) ? data.girlGroups : prev.girlGroups,
          }));
        }
      } else if (format === 'league_branding_rosters') {
        const incomingIdols = Array.isArray(data.idols) ? data.idols : (appState.idols || []);
        const incomingGroups = Array.isArray(data.girlGroups) ? data.girlGroups : (appState.girlGroups || []);
        if (Array.isArray(data.idols)) saveIdols(data.idols);
        if (Array.isArray(data.girlGroups)) saveGirlGroups(data.girlGroups);

        if (Array.isArray(data.customLeagueBranding)) {
          saveCustomLeagueBranding(data.customLeagueBranding);
        }

        let restoredD1 = leagueState;
        let notes: string[] = [];
        if (Array.isArray(data.divisions)) {
          const result = applyLeagueRosterImport(
            leagueState,
            data,
            incomingIdols,
            incomingGroups,
            (leagueState && leagueState.seasonNumber) || 1
          );
          restoredD1 = result.state;
          saveLeagueSeasonState(restoredD1);
          onUpdateLeagueState(restoredD1);
          if (result.report.unknownEntries.length) notes.push(\`\${result.report.unknownEntries.length} D1 idols not found in the included Idol Database\`);
          if (result.report.duplicateEntries.length) notes.push(\`\${result.report.duplicateEntries.length} duplicate D1 roster idols skipped\`);
        }

        let restoredV5 = v5State || null;
        if (Array.isArray(data.division2)) {
          const d1Ids = new Set((restoredD1?.leagues || []).flatMap((league) => league.memberIds || []));
          const usedD2Ids = new Set<string>();
          const invalidD2Ids: string[] = [];
          const division2 = data.division2.map((source: any) => {
            const parentLeagueId = Number(source.parentLeagueId);
            const leagueId = Number(source.leagueId);
            const rawIds = Array.isArray(source.memberIds)
              ? source.memberIds.map(String)
              : Array.isArray(source.roster)
                ? source.roster.map((idol: any) => String(idol.id || idol.idolId || '')).filter(Boolean)
                : [];
            const memberIds = rawIds.filter((id: string, index: number) => {
              const valid = rawIds.indexOf(id) === index &&
                incomingIdols.some((idol: Idol) => idol.id === id) &&
                !d1Ids.has(id) &&
                !usedD2Ids.has(id);
              if (valid) usedD2Ids.add(id);
              else invalidD2Ids.push(id);
              return valid;
            });
            return rebuildLeague({
              id: leagueId,
              parentLeagueId,
              name: String(source.name || \`Division 2 \${parentLeagueId}\`),
              tierName: String(source.tierName || 'Challenger'),
              color: String(source.color || '#64748b'),
              logoUrl: String(source.logoUrl || ''),
              description: String(source.description || ''),
              memberIds,
              matches: [],
              standings: [],
            }, incomingIdols);
          });
          if (
            division2.length !== 6 ||
            new Set(division2.map((league: any) => league.parentLeagueId)).size !== 6 ||
            division2.some((league: any) =>
              !Number.isInteger(league.parentLeagueId) ||
              league.parentLeagueId < 1 ||
              league.parentLeagueId > 6 ||
              league.id !== 100 + league.parentLeagueId
            )
          ) {
            throw new Error('League backup must contain six Division 2 leagues paired one-to-one with Division 1.');
          }
          restoredV5 = {
            ...(restoredV5 || {
              d2: [], perLeague: 20, promotionCount: 3, pendingMoves: null,
              promotionHistory: [], champsCup: null, leagueCup: null, miniCups: {},
              superA: null, superB: [],
            }),
            d2: division2,
          };
          saveV5State(restoredV5);
          if (invalidD2Ids.length) notes.push(\`\${invalidD2Ids.length} unknown, duplicated, or cross-division D2 roster IDs skipped\`);
        }

        onUpdateAppState((prev) => ({
          ...prev,
          idols: incomingIdols,
          girlGroups: incomingGroups,
          customLeagueBranding: Array.isArray(data.customLeagueBranding)
            ? data.customLeagueBranding
            : prev.customLeagueBranding,
          v5State: restoredV5 || prev.v5State,
        }));

        const d1Count = Array.isArray(data.divisions) ? data.divisions.length : 0;
        const d2Count = Array.isArray(data.division2) ? data.division2.length : 0;
        showToast(
          \`League backup restored: \${d1Count} Division 1 and \${d2Count} Division 2 rosters, \${incomingIdols.length} idols, and \${incomingGroups.length} girl groups.\` +
            (notes.length ? ' Warning: ' + notes.join('; ') + '.' : ''),
          notes.length ? 'error' : 'success'
        );
      } else if (format === 'permanent_match_db') {
        const matches = Array.isArray(data.matches) ? data.matches : data.matchDatabase;
        if (Array.isArray(matches)) {
          saveMatchDatabase(matches);
          onUpdateAppState((prev) => ({ ...prev, matchDatabase: matches }));
        }
      } else if (format === 'full_historical_stats') {
        if (data.careerStatsOverrides && typeof data.careerStatsOverrides === 'object') {
          saveCareerOverrides(data.careerStatsOverrides);
          onSaveOverrides?.(data.careerStatsOverrides);
        }
      }

      onRefreshAllStats?.();
      setImportStaging(null);
      showToast(`Successfully restored ${importStaging.description} and synchronized all state!`, 'success');
    } catch (err: any) {
      showToast(`Restore failed: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  // Compute active preview payload for the selected raw view key
  const activeRawJsonString = useMemo(() => {
    try {
      switch (rawViewKey) {
        case 'full_backup':
          return exportFullDatabaseBackup(appState, leagueState, leagueArchives, overrides, theIdolsState, theIdolsArchives);
        case 'idols_groups':
          return exportIdolGroupDatabase(appState);
        case 'league_branding_rosters':
          return exportLeagueBrandingAndRosters(leagueState, appState.idols, appState.customLeagueBranding, v5State, appState.girlGroups || []);
        case 'permanent_match_db':
          return exportPermanentMatchDatabase(appState, leagueState, leagueArchives, theIdolsState, theIdolsArchives);
        case 'full_historical_stats':
          return exportFullHistoricalStats(appState, leagueState, leagueArchives, theIdolsState, theIdolsArchives, overrides, careerStats);
        default:
          return '{}';
      }
    } catch (err: any) {
      console.error('Failed generating database preview JSON:', err);
      return JSON.stringify({ error: err?.message || 'Failed to generate preview' }, null, 2);
    }
  }, [rawViewKey, appState, leagueState, leagueArchives, overrides, theIdolsState, theIdolsArchives, careerStats]);

  const handleCopyRawJson = () => {
    navigator.clipboard.writeText(activeRawJsonString);
    setCopiedKey(rawViewKey);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast('Copied raw JSON to clipboard!', 'info');
  };

  return (
    <div className="space-y-8">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Top Header */}
      <div className="bg-[#1b100a] border-2 border-black rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black text-amber-100 uppercase tracking-wider font-mono">
              Permanent Database Export & Upload Center
            </h2>
          </div>
          <p className="text-xs text-amber-200/60">
            Export standalone modular snapshots or upload to transfer your entire league, idol rosters, matches, and stats to any device.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 transition-all flex-shrink-0"
        >
          <Upload className="w-4 h-4" /> Upload / Restore Database File
        </button>
      </div>

      {/* STAGED RESTORE MODAL / BANNER (If file was uploaded) */}
      {importStaging && (
        <div className="bg-gradient-to-r from-amber-950/90 via-[#201008] to-amber-950/90 border-3 border-amber-500 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-mono uppercase">
                  Ready to Restore: {importStaging.description}
                </h3>
                <p className="text-xs text-amber-200/70">
                  Target device database will safely import and merge this dataset.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportStaging(null)}
                className="px-3 py-1.5 rounded-xl bg-black/40 text-amber-200/70 hover:text-white text-xs font-mono font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRestore}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs font-mono rounded-xl shadow-lg flex items-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" /> Confirm & Apply to Database
              </button>
            </div>
          </div>

          {/* Staging Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#100804] p-3.5 rounded-2xl border border-amber-500/20">
            <div>
              <div className="text-[10px] uppercase font-mono text-amber-200/50">Idols Found</div>
              <div className="text-base font-black text-amber-400 font-mono">
                {importStaging.summary?.idolsCount ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-amber-200/50">Match Records</div>
              <div className="text-base font-black text-cyan-400 font-mono">
                {importStaging.summary?.matchCount ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-amber-200/50">Archives / Seasons</div>
              <div className="text-base font-black text-purple-400 font-mono">
                {(importStaging.summary?.tournamentArchivesCount ?? 0) +
                  (importStaging.summary?.leagueArchivesCount ?? 0) +
                  (importStaging.summary?.theIdolsArchivesCount ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-amber-200/50">Career Overrides</div>
              <div className="text-base font-black text-emerald-400 font-mono">
                {importStaging.summary?.overridesCount ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THE 5 DEDICATED PERMANENT DOWNLOAD OPTIONS */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Permanent Database Downloads (Select Category)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Full Backup */}
          <div className="bg-[#140b07] border-2 border-black hover:border-amber-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Database className="w-5 h-5" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono font-bold border border-amber-500/20">
                  11 Subsystems
                </span>
              </div>
              <h3 className="text-base font-black text-white font-mono uppercase">
                1. Full Database Backup
              </h3>
              <p className="text-xs text-amber-200/60 leading-relaxed">
                Complete all-inclusive system archive: Idols, Groups, Tournament Cup, 6-Division League state & archives, The Idols Superleague & Masters, Match Database, and Career Overrides.
              </p>
            </div>

            <button
              onClick={handleDownloadFullBackup}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black font-black text-xs font-mono rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Download Full Backup (.json)
            </button>
          </div>

          {/* 2. Full Idol & Group Database */}
          <div className="bg-[#140b07] border-2 border-black hover:border-amber-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Users className="w-5 h-5" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono font-bold border border-emerald-500/20">
                  {appState.idols.length} Idols
                </span>
              </div>
              <h3 className="text-base font-black text-white font-mono uppercase">
                2. Full Idol & Group DB
              </h3>
              <p className="text-xs text-amber-200/60 leading-relaxed">
                Full idol directory containing name, combat rating (35–99), seed assignments, girl group affiliations, nationality, and high-res photo URLs.
              </p>
            </div>

            <button
              onClick={handleDownloadIdolsGroups}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Download Idol & Group DB (.json)
            </button>
          </div>

          {/* 3. League Branding & Rosters */}
          <div className="bg-[#140b07] border-2 border-black hover:border-amber-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Shield className="w-5 h-5" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold border border-cyan-500/20">
                  6 Divisions &bull; 120 Idols
                </span>
              </div>
              <h3 className="text-base font-black text-white font-mono uppercase">
                3. League Branding & Rosters
              </h3>
              <p className="text-xs text-amber-200/60 leading-relaxed">
                Division branding (IPL, Div 2–6) including customized league names, official logos, color schemes, and full 20-idol rosters for each league.
              </p>
            </div>

            <button
              onClick={handleDownloadLeagueBrandingRosters}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs font-mono rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Download League Rosters (.json)
            </button>
          </div>

          {/* 4. Permanent Match DB */}
          <div className="bg-[#140b07] border-2 border-black hover:border-amber-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Table className="w-5 h-5" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono font-bold border border-indigo-500/20">
                  Universal Matches
                </span>
              </div>
              <h3 className="text-base font-black text-white font-mono uppercase">
                4. Permanent Match DB
              </h3>
              <p className="text-xs text-amber-200/60 leading-relaxed">
                Consolidated permanent match log spanning all competitions: Tournament Cup stages, 38 Domestic League matchdays, and The Idols Superleague & playoff matches.
              </p>
            </div>

            <button
              onClick={handleDownloadMatchDatabase}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs font-mono rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Download Match DB (.json)
            </button>
          </div>

          {/* 5. Full Historical Stat */}
          <div className="bg-[#140b07] border-2 border-black hover:border-amber-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all md:col-span-2 lg:col-span-2">
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <BarChart3 className="w-5 h-5" />
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono font-bold border border-purple-500/20">
                  Unified Titles Across All Tournaments
                </span>
              </div>
              <h3 className="text-base font-black text-white font-mono uppercase">
                5. Full Historical Stat (Across All Formats)
              </h3>
              <p className="text-xs text-amber-200/60 leading-relaxed">
                Unified career statistics across Tournament Cup, 6 Domestic Leagues, and The Idols Superleague & Masters Playoff. Accurate Total Titles calculation: Cup Championships + League Division Titles + Superleague Regular Season Titles (1st) + Masters Playoff Titles.
              </p>
            </div>

            <button
              onClick={handleDownloadHistoricalStats}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs font-mono rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" /> Download Full Historical Stats (.json)
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RAW JSON VIEWER & INSPECTOR */}
      {/* ========================================================================= */}
      <div className="bg-[#140b07] border-2 border-black rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/10 pb-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-white font-mono uppercase">
              Raw JSON Database Inspector
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyRawJson}
              className="px-3 py-1.5 rounded-xl bg-[#20120a] hover:bg-[#2c1a0e] text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
            >
              {copiedKey === rawViewKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === rawViewKey ? 'Copied!' : 'Copy JSON'}
            </button>
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'full_backup', label: '1. Full Backup' },
            { id: 'idols_groups', label: '2. Idol & Group DB' },
            { id: 'league_branding_rosters', label: '3. League Rosters' },
            { id: 'permanent_match_db', label: '4. Match DB' },
            { id: 'full_historical_stats', label: '5. Historical Stats' },
          ].map((cat) => {
            const isActive = rawViewKey === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setRawViewKey(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md font-black'
                    : 'bg-[#1e0f09] text-amber-200/60 border-amber-500/20 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Code Box */}
        <pre className="p-4 bg-[#0a0502] border border-amber-500/20 rounded-2xl text-amber-300/80 font-mono text-xs max-h-[400px] overflow-y-auto whitespace-pre-wrap select-all">
          {activeRawJsonString.slice(0, 10000)}
          {activeRawJsonString.length > 10000 && '\n\n... [Truncated for preview performance]'}
        </pre>
      </div>
    </div>
  );
};
