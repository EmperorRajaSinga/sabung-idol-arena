import React, { useState, useMemo } from 'react';
import {
  ArchivedMatch,
  AppState,
  CareerStat,
  Idol,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
  TournamentArchive,
  ActiveTab,
} from '../types';
import {
  CareerOverridesMap,
  IdolCareerOverride,
  loadCareerOverrides,
  saveCareerOverrides,
  auditDatabaseHealth,
  sanitizeAndRepairDatabase,
  exportFullDatabaseBackup,
  validateAndParseDatabaseBackup,
  DatabaseAuditReport,
  detectSuspiciousGroupExits,
  calculateUnifiedTotalTitles,
  computeDerivedBaseStatsForIdol,
} from '../utils/databaseStudioLogic';
import {
  saveTheIdolsArchives,
  saveTheIdolsState,
  convertTheIdolsMatchesToArchived,
} from '../utils/theIdolsLogic';
import { syncLeagueMatchesToArchivedMatches } from '../utils/leagueLogic';
import { CupStatsEditor } from './studio/CupStatsEditor';
import { LeagueSystemEditor } from './studio/LeagueSystemEditor';
import { TheIdolsEditor } from './studio/TheIdolsEditor';
import { IdolsProfilesEditor } from './studio/IdolsProfilesEditor';
import {
  Database,
  Users,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Crown,
  Table,
  FileCode,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  Sliders,
  Flame,
  ShieldCheck,
  Shield,
  Star,
  Save,
  RotateCcw,
  Check,
  Info,
  Copy,
  Zap,
  Award,
  Filter,
  TrendingUp,
  Target,
  Medal,
  Calculator,
} from 'lucide-react';

interface DatabaseStudioPanelProps {
  appState: AppState;
  leagueState: LeagueSeasonState | null;
  leagueArchives: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  careerStats: CareerStat[];
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  onUpdateLeagueState: (newState: LeagueSeasonState) => void;
  onUpdateLeagueArchives: (newArchives: LeagueSeasonArchive[]) => void;
  onUpdateTheIdolsState?: (newState: TheIdolsSeasonState | null) => void;
  onUpdateTheIdolsArchives?: (newArchives: TheIdolsSeasonArchive[]) => void;
  onRefreshAllStats: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  onSelectIdol?: (idolId: string) => void;
}

export const DatabaseStudioPanel: React.FC<DatabaseStudioPanelProps> = ({
  appState,
  leagueState,
  leagueArchives,
  theIdolsState,
  theIdolsArchives,
  careerStats,
  onUpdateAppState,
  onUpdateLeagueState,
  onUpdateLeagueArchives,
  onUpdateTheIdolsState,
  onUpdateTheIdolsArchives,
  onRefreshAllStats,
  setActiveTab,
  onSelectIdol,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'cup' | 'league' | 'the_idols' | 'idols_profiles' | 'recalibrate' | 'overrides' | 'archives' | 'match_db'
  >('cup');

  // Overrides state
  const [overrides, setOverrides] = useState<CareerOverridesMap>(() => loadCareerOverrides());
  const [selectedOverrideIdolId, setSelectedOverrideIdolId] = useState<string>(
    appState.idols[0]?.id || ''
  );
  const [overrideSearch, setOverrideSearch] = useState<string>('');
  const [overrideFilterMode, setOverrideFilterMode] = useState<'all' | 'overridden' | 'suspicious'>('all');

  // Editable override buffer for selected idol
  const selectedIdol = useMemo(() => {
    return appState.idols.find((i) => i.id === selectedOverrideIdolId) || appState.idols[0];
  }, [appState.idols, selectedOverrideIdolId]);

  const selectedBaseCareer = useMemo(() => {
    return careerStats.find((c) => c.idolId === selectedOverrideIdolId);
  }, [careerStats, selectedOverrideIdolId]);

  const suspiciousGroupExits = useMemo(() => {
    return detectSuspiciousGroupExits(careerStats);
  }, [careerStats]);

  const [editOverrideForm, setEditOverrideForm] = useState<Partial<IdolCareerOverride>>({});
  const [editorCategory, setEditorCategory] = useState<'cup' | 'league' | 'the_idols' | 'universal'>('cup');

  const selectedBaseDerived = useMemo(() => {
    if (!selectedIdol) return null;
    return computeDerivedBaseStatsForIdol(
      selectedIdol.id,
      careerStats,
      leagueState,
      leagueArchives,
      theIdolsState || null,
      theIdolsArchives || []
    );
  }, [selectedIdol?.id, careerStats, leagueState, leagueArchives, theIdolsState, theIdolsArchives]);

  // Sync form when selected idol changes
  React.useEffect(() => {
    if (selectedIdol) {
      const existing = overrides[selectedIdol.id];
      if (existing) {
        setEditOverrideForm({
          ...existing,
          // Fallback missing league / theIdols values if undefined
          divisionTitles: existing.divisionTitles ?? selectedBaseDerived?.league?.divisionTitles ?? 0,
          divisionPodiums: existing.divisionPodiums ?? selectedBaseDerived?.league?.divisionPodiums ?? 0,
          top5Finishes: existing.top5Finishes ?? selectedBaseDerived?.league?.top5Finishes ?? 0,
          leagueSeasonsPlayed: existing.leagueSeasonsPlayed ?? selectedBaseDerived?.league?.leagueSeasonsPlayed ?? 0,
          leagueMatches: existing.leagueMatches ?? selectedBaseDerived?.league?.leagueMatches ?? 0,
          leagueWins: existing.leagueWins ?? selectedBaseDerived?.league?.leagueWins ?? 0,
          leagueDraws: existing.leagueDraws ?? selectedBaseDerived?.league?.leagueDraws ?? 0,
          leagueLosses: existing.leagueLosses ?? selectedBaseDerived?.league?.leagueLosses ?? 0,
          leaguePoints: existing.leaguePoints ?? selectedBaseDerived?.league?.leaguePoints ?? 0,
          leagueGoalsFor: existing.leagueGoalsFor ?? selectedBaseDerived?.league?.leagueGoalsFor ?? 0,
          leagueGoalsAgainst: existing.leagueGoalsAgainst ?? selectedBaseDerived?.league?.leagueGoalsAgainst ?? 0,
          leagueGoalDiff: existing.leagueGoalDiff ?? selectedBaseDerived?.league?.leagueGoalDiff ?? 0,
          leagueWinRate: existing.leagueWinRate ?? selectedBaseDerived?.league?.leagueWinRate ?? 0,

          theIdolsSuperleagueTitles: existing.theIdolsSuperleagueTitles ?? selectedBaseDerived?.theIdols?.theIdolsSuperleagueTitles ?? 0,
          theIdolsMastersTitles: existing.theIdolsMastersTitles ?? selectedBaseDerived?.theIdols?.theIdolsMastersTitles ?? 0,
          theIdolsMastersRunnerUps: existing.theIdolsMastersRunnerUps ?? selectedBaseDerived?.theIdols?.theIdolsMastersRunnerUps ?? 0,
          theIdolsMastersPodiums: existing.theIdolsMastersPodiums ?? selectedBaseDerived?.theIdols?.theIdolsMastersPodiums ?? 0,
          theIdolsPlayoffApps: existing.theIdolsPlayoffApps ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffApps ?? 0,
          theIdolsSeasonsPlayed: existing.theIdolsSeasonsPlayed ?? selectedBaseDerived?.theIdols?.theIdolsSeasonsPlayed ?? 0,
          theIdolsMatches: existing.theIdolsMatches ?? selectedBaseDerived?.theIdols?.theIdolsMatches ?? 0,
          theIdolsWins: existing.theIdolsWins ?? selectedBaseDerived?.theIdols?.theIdolsWins ?? 0,
          theIdolsDraws: existing.theIdolsDraws ?? selectedBaseDerived?.theIdols?.theIdolsDraws ?? 0,
          theIdolsLosses: existing.theIdolsLosses ?? selectedBaseDerived?.theIdols?.theIdolsLosses ?? 0,
          theIdolsPoints: existing.theIdolsPoints ?? selectedBaseDerived?.theIdols?.theIdolsPoints ?? 0,
          theIdolsGoalsFor: existing.theIdolsGoalsFor ?? selectedBaseDerived?.theIdols?.theIdolsGoalsFor ?? 0,
          theIdolsGoalsAgainst: existing.theIdolsGoalsAgainst ?? selectedBaseDerived?.theIdols?.theIdolsGoalsAgainst ?? 0,
          theIdolsGoalDiff: existing.theIdolsGoalDiff ?? selectedBaseDerived?.theIdols?.theIdolsGoalDiff ?? 0,
          theIdolsPlayoffMatches: existing.theIdolsPlayoffMatches ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffMatches ?? 0,
          theIdolsPlayoffWins: existing.theIdolsPlayoffWins ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffWins ?? 0,
          theIdolsPlayoffLosses: existing.theIdolsPlayoffLosses ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffLosses ?? 0,
          theIdolsWinRate: existing.theIdolsWinRate ?? selectedBaseDerived?.theIdols?.theIdolsWinRate ?? 0,
        });
      } else if (selectedBaseDerived) {
        setEditOverrideForm({
          idolId: selectedIdol.id,
          enabled: false,
          ...(selectedBaseDerived.cup || {}),
          ...(selectedBaseDerived.league || {}),
          ...(selectedBaseDerived.theIdols || {}),
          customNotes: '',
        });
      }
    }
  }, [selectedIdol?.id, overrides, selectedBaseDerived]);

  // Recalibration Audit Report state
  const [auditReport, setAuditReport] = useState<DatabaseAuditReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(
    null
  );

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Run audit on mount and updates
  React.useEffect(() => {
    const report = auditDatabaseHealth(
      appState,
      leagueState,
      leagueArchives,
      overrides,
      theIdolsState,
      theIdolsArchives
    );
    setAuditReport(report);
  }, [appState, leagueState, leagueArchives, overrides, theIdolsState, theIdolsArchives]);

  // Handle Full Recalibration
  const handleRunRecalibration = () => {
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const {
          cleanedMatchDatabase,
          cleanedTournamentArchives,
          cleanedLeagueArchives,
          cleanedTheIdolsArchives,
          cleanedTheIdolsState,
          repairLogs,
        } = sanitizeAndRepairDatabase(
          appState,
          leagueState,
          leagueArchives,
          theIdolsState,
          theIdolsArchives
        );

        onUpdateAppState((prev) => ({
          ...prev,
          matchDatabase: cleanedMatchDatabase,
          archives: cleanedTournamentArchives,
          theIdolsArchives: cleanedTheIdolsArchives,
          theIdolsState: cleanedTheIdolsState || prev.theIdolsState,
        }));

        onUpdateLeagueArchives(cleanedLeagueArchives);
        if (onUpdateTheIdolsArchives) {
          onUpdateTheIdolsArchives(cleanedTheIdolsArchives);
          saveTheIdolsArchives(cleanedTheIdolsArchives);
        }
        if (onUpdateTheIdolsState && cleanedTheIdolsState) {
          onUpdateTheIdolsState(cleanedTheIdolsState);
          saveTheIdolsState(cleanedTheIdolsState);
        }
        onRefreshAllStats();

        const freshReport = auditDatabaseHealth(
          {
            ...appState,
            matchDatabase: cleanedMatchDatabase,
            archives: cleanedTournamentArchives,
            theIdolsArchives: cleanedTheIdolsArchives,
            theIdolsState: cleanedTheIdolsState || theIdolsState,
          },
          leagueState,
          cleanedLeagueArchives,
          overrides,
          cleanedTheIdolsState || theIdolsState,
          cleanedTheIdolsArchives
        );
        freshReport.repairsMade = repairLogs;
        setAuditReport(freshReport);
        showToast('System recalibrated and database fully re-synchronized!', 'success');
      } catch (err: any) {
        showToast(`Recalibration error: ${err.message}`, 'error');
      } finally {
        setIsProcessing(false);
      }
    }, 300);
  };

  // Auto-calculation Helpers
  const handleAutoCalcCupRates = () => {
    setEditOverrideForm((prev) => {
      const matches = prev.matches ?? selectedBaseDerived?.cup?.matches ?? 0;
      const wins = prev.wins ?? selectedBaseDerived?.cup?.wins ?? 0;
      const draws = prev.draws ?? selectedBaseDerived?.cup?.draws ?? 0;
      const losses = prev.losses ?? selectedBaseDerived?.cup?.losses ?? 0;
      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

      const groupWins = prev.groupWins ?? selectedBaseDerived?.cup?.groupWins ?? 0;
      const groupLosses = prev.groupLosses ?? selectedBaseDerived?.cup?.groupLosses ?? 0;
      const groupMatches = groupWins + groupLosses;
      const groupWinRate = groupMatches > 0 ? Math.round((groupWins / groupMatches) * 100) : 0;

      const knockoutWins = prev.knockoutWins ?? selectedBaseDerived?.cup?.knockoutWins ?? 0;
      const knockoutLosses = prev.knockoutLosses ?? selectedBaseDerived?.cup?.knockoutLosses ?? 0;
      const knockoutMatches = knockoutWins + knockoutLosses;
      const knockoutWinRate = knockoutMatches > 0 ? Math.round((knockoutWins / knockoutMatches) * 100) : 0;

      const gf = prev.gamesFor ?? selectedBaseDerived?.cup?.gamesFor ?? 0;
      const ga = prev.gamesAgainst ?? selectedBaseDerived?.cup?.gamesAgainst ?? 0;
      const gameDiff = gf - ga;

      return {
        ...prev,
        winRate,
        groupWinRate,
        knockoutWinRate,
        gameDiff,
      };
    });
    showToast('Auto-calculated Cup win rates & goal differential.', 'info');
  };

  const handleAutoCalcLeagueRates = () => {
    setEditOverrideForm((prev) => {
      const wins = prev.leagueWins ?? selectedBaseDerived?.league?.leagueWins ?? 0;
      const draws = prev.leagueDraws ?? selectedBaseDerived?.league?.leagueDraws ?? 0;
      const matches = prev.leagueMatches ?? selectedBaseDerived?.league?.leagueMatches ?? 0;
      const gf = prev.leagueGoalsFor ?? selectedBaseDerived?.league?.leagueGoalsFor ?? 0;
      const ga = prev.leagueGoalsAgainst ?? selectedBaseDerived?.league?.leagueGoalsAgainst ?? 0;

      return {
        ...prev,
        leaguePoints: wins * 3 + draws * 1,
        leagueWinRate: matches > 0 ? Math.round((wins / matches) * 100) : 0,
        leagueGoalDiff: gf - ga,
      };
    });
    showToast('Auto-calculated League points, win rate & goal diff.', 'info');
  };

  const handleAutoCalcTheIdolsRates = () => {
    setEditOverrideForm((prev) => {
      const wins = prev.theIdolsWins ?? selectedBaseDerived?.theIdols?.theIdolsWins ?? 0;
      const draws = prev.theIdolsDraws ?? selectedBaseDerived?.theIdols?.theIdolsDraws ?? 0;
      const matches = prev.theIdolsMatches ?? selectedBaseDerived?.theIdols?.theIdolsMatches ?? 0;
      const gf = prev.theIdolsGoalsFor ?? selectedBaseDerived?.theIdols?.theIdolsGoalsFor ?? 0;
      const ga = prev.theIdolsGoalsAgainst ?? selectedBaseDerived?.theIdols?.theIdolsGoalsAgainst ?? 0;

      return {
        ...prev,
        theIdolsPoints: wins * 3 + draws * 1,
        theIdolsWinRate: matches > 0 ? Math.round((wins / matches) * 100) : 0,
        theIdolsGoalDiff: gf - ga,
      };
    });
    showToast('Auto-calculated The Idols points, win rate & goal diff.', 'info');
  };

  // Handle Save Override
  const handleSaveOverride = () => {
    if (!selectedIdol) return;
    const updated: CareerOverridesMap = {
      ...overrides,
      [selectedIdol.id]: {
        idolId: selectedIdol.id,
        enabled: editOverrideForm.enabled ?? true,

        // Tournament Cup
        participations: editOverrideForm.participations !== undefined ? Math.max(0, Number(editOverrideForm.participations) || 0) : undefined,
        groupAdvancements: editOverrideForm.groupAdvancements !== undefined ? Math.max(0, Number(editOverrideForm.groupAdvancements) || 0) : undefined,
        groupExits: editOverrideForm.groupExits !== undefined ? Math.max(0, Number(editOverrideForm.groupExits) || 0) : undefined,
        championships: editOverrideForm.championships !== undefined ? Math.max(0, Number(editOverrideForm.championships) || 0) : undefined,
        runnerUps: editOverrideForm.runnerUps !== undefined ? Math.max(0, Number(editOverrideForm.runnerUps) || 0) : undefined,
        thirdPlaces: editOverrideForm.thirdPlaces !== undefined ? Math.max(0, Number(editOverrideForm.thirdPlaces) || 0) : undefined,
        fourthPlaces: editOverrideForm.fourthPlaces !== undefined ? Math.max(0, Number(editOverrideForm.fourthPlaces) || 0) : undefined,
        top4: editOverrideForm.top4 !== undefined ? Math.max(0, Number(editOverrideForm.top4) || 0) : undefined,
        quarterFinals: editOverrideForm.quarterFinals !== undefined ? Math.max(0, Number(editOverrideForm.quarterFinals) || 0) : undefined,
        roundOf16: editOverrideForm.roundOf16 !== undefined ? Math.max(0, Number(editOverrideForm.roundOf16) || 0) : undefined,
        roundOf32: editOverrideForm.roundOf32 !== undefined ? Math.max(0, Number(editOverrideForm.roundOf32) || 0) : undefined,
        playIns: editOverrideForm.playIns !== undefined ? Math.max(0, Number(editOverrideForm.playIns) || 0) : undefined,
        bestFinish: editOverrideForm.bestFinish,
        worstFinish: editOverrideForm.worstFinish,
        avgPlacement: editOverrideForm.avgPlacement !== undefined ? Number(editOverrideForm.avgPlacement) || 0 : undefined,
        matches: editOverrideForm.matches !== undefined ? Math.max(0, Number(editOverrideForm.matches) || 0) : undefined,
        wins: editOverrideForm.wins !== undefined ? Math.max(0, Number(editOverrideForm.wins) || 0) : undefined,
        draws: editOverrideForm.draws !== undefined ? Math.max(0, Number(editOverrideForm.draws) || 0) : undefined,
        losses: editOverrideForm.losses !== undefined ? Math.max(0, Number(editOverrideForm.losses) || 0) : undefined,
        winRate: editOverrideForm.winRate !== undefined ? Number(editOverrideForm.winRate) || 0 : undefined,
        groupWins: editOverrideForm.groupWins !== undefined ? Math.max(0, Number(editOverrideForm.groupWins) || 0) : undefined,
        groupLosses: editOverrideForm.groupLosses !== undefined ? Math.max(0, Number(editOverrideForm.groupLosses) || 0) : undefined,
        groupWinRate: editOverrideForm.groupWinRate !== undefined ? Number(editOverrideForm.groupWinRate) || 0 : undefined,
        knockoutWins: editOverrideForm.knockoutWins !== undefined ? Math.max(0, Number(editOverrideForm.knockoutWins) || 0) : undefined,
        knockoutLosses: editOverrideForm.knockoutLosses !== undefined ? Math.max(0, Number(editOverrideForm.knockoutLosses) || 0) : undefined,
        knockoutWinRate: editOverrideForm.knockoutWinRate !== undefined ? Number(editOverrideForm.knockoutWinRate) || 0 : undefined,
        gamesFor: editOverrideForm.gamesFor !== undefined ? Math.max(0, Number(editOverrideForm.gamesFor) || 0) : undefined,
        gamesAgainst: editOverrideForm.gamesAgainst !== undefined ? Math.max(0, Number(editOverrideForm.gamesAgainst) || 0) : undefined,
        gameDiff: editOverrideForm.gameDiff !== undefined ? Number(editOverrideForm.gameDiff) || 0 : undefined,
        longestWinStreak: editOverrideForm.longestWinStreak !== undefined ? Math.max(0, Number(editOverrideForm.longestWinStreak) || 0) : undefined,
        longestLosingStreak: editOverrideForm.longestLosingStreak !== undefined ? Math.max(0, Number(editOverrideForm.longestLosingStreak) || 0) : undefined,
        longestUnbeatenStreak: editOverrideForm.longestUnbeatenStreak !== undefined ? Math.max(0, Number(editOverrideForm.longestUnbeatenStreak) || 0) : undefined,

        // League Division
        divisionTitles: editOverrideForm.divisionTitles !== undefined ? Math.max(0, Number(editOverrideForm.divisionTitles) || 0) : undefined,
        divisionPodiums: editOverrideForm.divisionPodiums !== undefined ? Math.max(0, Number(editOverrideForm.divisionPodiums) || 0) : undefined,
        top5Finishes: editOverrideForm.top5Finishes !== undefined ? Math.max(0, Number(editOverrideForm.top5Finishes) || 0) : undefined,
        leagueSeasonsPlayed: editOverrideForm.leagueSeasonsPlayed !== undefined ? Math.max(0, Number(editOverrideForm.leagueSeasonsPlayed) || 0) : undefined,
        leagueMatches: editOverrideForm.leagueMatches !== undefined ? Math.max(0, Number(editOverrideForm.leagueMatches) || 0) : undefined,
        leagueWins: editOverrideForm.leagueWins !== undefined ? Math.max(0, Number(editOverrideForm.leagueWins) || 0) : undefined,
        leagueDraws: editOverrideForm.leagueDraws !== undefined ? Math.max(0, Number(editOverrideForm.leagueDraws) || 0) : undefined,
        leagueLosses: editOverrideForm.leagueLosses !== undefined ? Math.max(0, Number(editOverrideForm.leagueLosses) || 0) : undefined,
        leaguePoints: editOverrideForm.leaguePoints !== undefined ? Math.max(0, Number(editOverrideForm.leaguePoints) || 0) : undefined,
        leagueGoalsFor: editOverrideForm.leagueGoalsFor !== undefined ? Math.max(0, Number(editOverrideForm.leagueGoalsFor) || 0) : undefined,
        leagueGoalsAgainst: editOverrideForm.leagueGoalsAgainst !== undefined ? Math.max(0, Number(editOverrideForm.leagueGoalsAgainst) || 0) : undefined,
        leagueGoalDiff: editOverrideForm.leagueGoalDiff !== undefined ? Number(editOverrideForm.leagueGoalDiff) || 0 : undefined,
        leagueWinRate: editOverrideForm.leagueWinRate !== undefined ? Number(editOverrideForm.leagueWinRate) || 0 : undefined,

        // The Idols Superleague
        theIdolsSuperleagueTitles: editOverrideForm.theIdolsSuperleagueTitles !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsSuperleagueTitles) || 0) : undefined,
        theIdolsMastersTitles: editOverrideForm.theIdolsMastersTitles !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsMastersTitles) || 0) : undefined,
        theIdolsMastersRunnerUps: editOverrideForm.theIdolsMastersRunnerUps !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsMastersRunnerUps) || 0) : undefined,
        theIdolsMastersPodiums: editOverrideForm.theIdolsMastersPodiums !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsMastersPodiums) || 0) : undefined,
        theIdolsPlayoffApps: editOverrideForm.theIdolsPlayoffApps !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsPlayoffApps) || 0) : undefined,
        theIdolsSeasonsPlayed: editOverrideForm.theIdolsSeasonsPlayed !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsSeasonsPlayed) || 0) : undefined,
        theIdolsMatches: editOverrideForm.theIdolsMatches !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsMatches) || 0) : undefined,
        theIdolsWins: editOverrideForm.theIdolsWins !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsWins) || 0) : undefined,
        theIdolsDraws: editOverrideForm.theIdolsDraws !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsDraws) || 0) : undefined,
        theIdolsLosses: editOverrideForm.theIdolsLosses !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsLosses) || 0) : undefined,
        theIdolsPoints: editOverrideForm.theIdolsPoints !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsPoints) || 0) : undefined,
        theIdolsGoalsFor: editOverrideForm.theIdolsGoalsFor !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsGoalsFor) || 0) : undefined,
        theIdolsGoalsAgainst: editOverrideForm.theIdolsGoalsAgainst !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsGoalsAgainst) || 0) : undefined,
        theIdolsGoalDiff: editOverrideForm.theIdolsGoalDiff !== undefined ? Number(editOverrideForm.theIdolsGoalDiff) || 0 : undefined,
        theIdolsPlayoffMatches: editOverrideForm.theIdolsPlayoffMatches !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsPlayoffMatches) || 0) : undefined,
        theIdolsPlayoffWins: editOverrideForm.theIdolsPlayoffWins !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsPlayoffWins) || 0) : undefined,
        theIdolsPlayoffLosses: editOverrideForm.theIdolsPlayoffLosses !== undefined ? Math.max(0, Number(editOverrideForm.theIdolsPlayoffLosses) || 0) : undefined,
        theIdolsWinRate: editOverrideForm.theIdolsWinRate !== undefined ? Number(editOverrideForm.theIdolsWinRate) || 0 : undefined,

        customNotes: editOverrideForm.customNotes || '',
        updatedAt: new Date().toISOString(),
      },
    };
    setOverrides(updated);
    saveCareerOverrides(updated);
    onRefreshAllStats();
    showToast(`Career stats override saved across Cup, League, and The Idols for ${selectedIdol.name}!`, 'success');
  };

  const handleFillFromComputedBase = () => {
    if (!selectedIdol) return;
    const base = computeDerivedBaseStatsForIdol(
      selectedIdol.id,
      careerStats,
      leagueState,
      leagueArchives,
      theIdolsState || null,
      theIdolsArchives || []
    );

    setEditOverrideForm({
      idolId: selectedIdol.id,
      enabled: true,
      ...base.cup,
      ...base.league,
      ...base.theIdols,
      customNotes: overrides[selectedIdol.id]?.customNotes || '',
    });
    showToast(`Loaded computed base stats across Cup, League, and The Idols for ${selectedIdol.name}.`, 'info');
  };

  const handleZeroOutGroupExits = () => {
    if (!selectedIdol) return;
    setEditOverrideForm((prev) => ({
      ...prev,
      enabled: true,
      groupExits: 0,
    }));
    showToast(`Group exits set to 0 for ${selectedIdol.name}. Click "Save & Sync" to persist.`, 'success');
  };

  const handleBatchFixSuspiciousGroupExits = () => {
    if (suspiciousGroupExits.length === 0) {
      showToast('No idols found with suspicious group exits.', 'info');
      return;
    }
    const updated = { ...overrides };
    let count = 0;
    suspiciousGroupExits.forEach((sus) => {
      const existing = updated[sus.idolId] || { idolId: sus.idolId, enabled: true };
      updated[sus.idolId] = {
        ...existing,
        idolId: sus.idolId,
        enabled: true,
        groupExits: 0,
        customNotes: (existing.customNotes ? existing.customNotes + ' | ' : '') + 'Auto-zeroed false group exits',
        updatedAt: new Date().toISOString(),
      };
      count++;
    });
    setOverrides(updated);
    saveCareerOverrides(updated);
    onRefreshAllStats();
    showToast(`Successfully zeroed out false group exits for ${count} idols!`, 'success');
  };

  const handleResetOverride = () => {
    if (!selectedIdol) return;
    const updated = { ...overrides };
    delete updated[selectedIdol.id];
    setOverrides(updated);
    saveCareerOverrides(updated);
    onRefreshAllStats();
    showToast(`Override removed for ${selectedIdol.name}. System will auto-compute from matches.`, 'info');
  };

  // Archives Editor State
  const [archiveType, setArchiveType] = useState<'tournament' | 'league' | 'the_idols'>('tournament');
  const [editingTournamentSeasonId, setEditingTournamentSeasonId] = useState<number | null>(null);
  const [editingLeagueSeasonId, setEditingLeagueSeasonId] = useState<number | null>(null);
  const [editingTheIdolsSeasonId, setEditingTheIdolsSeasonId] = useState<number | null>(null);
  const [isAddSeasonModalOpen, setIsAddSeasonModalOpen] = useState<boolean>(false);
  const [newSeasonForm, setNewSeasonForm] = useState<{
    seasonType: 'tournament' | 'league' | 'the_idols';
    seasonNumber: number;
    seasonName: string;
    championId: string;
    runnerUpId: string;
    thirdPlaceId: string;
    div1ChampId: string;
    div2ChampId: string;
    div3ChampId: string;
    div4ChampId: string;
    div5ChampId: string;
    div6ChampId: string;
    theIdolsSuperleagueWinnerId: string;
  }>({
    seasonType: 'tournament',
    seasonNumber: (appState.archives?.length || 0) + 1,
    seasonName: `Champions Cup Season ${(appState.archives?.length || 0) + 1}`,
    championId: '',
    runnerUpId: '',
    thirdPlaceId: '',
    div1ChampId: '',
    div2ChampId: '',
    div3ChampId: '',
    div4ChampId: '',
    div5ChampId: '',
    div6ChampId: '',
    theIdolsSuperleagueWinnerId: '',
  });

  // Match Database Editor State
  const [matchSearch, setMatchSearch] = useState<string>('');
  const [matchCompFilter, setMatchCompFilter] = useState<'all' | 'tournament' | 'league' | 'the_idols'>('all');
  const [matchPage, setMatchPage] = useState<number>(1);
  const matchPageSize = 25;
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingMatchData, setEditingMatchData] = useState<Partial<ArchivedMatch>>({});
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState<boolean>(false);
  const [newMatchForm, setNewMatchForm] = useState<{
    seasonId: number;
    stage: string;
    idolAId: string;
    idolBId: string;
    scoreA: number;
    scoreB: number;
    groupName?: string;
  }>({
    seasonId: 1,
    stage: 'Final',
    idolAId: appState.idols[0]?.id || '',
    idolBId: appState.idols[1]?.id || '',
    scoreA: 2,
    scoreB: 1,
    groupName: '',
  });

  const handleCreateManualMatch = () => {
    if (!newMatchForm.idolAId || !newMatchForm.idolBId) {
      showToast('Please select both Idol A and Idol B', 'error');
      return;
    }
    if (newMatchForm.idolAId === newMatchForm.idolBId) {
      showToast('Idol A and Idol B cannot be the same idol', 'error');
      return;
    }

    const idolA = appState.idols.find((i) => i.id === newMatchForm.idolAId);
    const idolB = appState.idols.find((i) => i.id === newMatchForm.idolBId);

    const scA = Number(newMatchForm.scoreA ?? 0);
    const scB = Number(newMatchForm.scoreB ?? 0);
    let winId = '';
    let winNm = '';
    let loseId = '';
    let loseNm = '';
    let isDraw = false;

    if (scA > scB) {
      winId = idolA?.id || '';
      winNm = idolA?.name || '';
      loseId = idolB?.id || '';
      loseNm = idolB?.name || '';
    } else if (scB > scA) {
      winId = idolB?.id || '';
      winNm = idolB?.name || '';
      loseId = idolA?.id || '';
      loseNm = idolA?.name || '';
    } else {
      winId = 'DRAW';
      winNm = 'DRAW';
      loseId = 'DRAW';
      loseNm = 'DRAW';
      isDraw = true;
    }

    const matchId = `manual-match-s${newMatchForm.seasonId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newArchivedMatch: ArchivedMatch = {
      matchId,
      seasonId: Number(newMatchForm.seasonId || 1),
      seasonName: `Season ${newMatchForm.seasonId || 1}`,
      stage: newMatchForm.stage || 'Match',
      groupName: newMatchForm.groupName || undefined,
      idolAId: idolA?.id || '',
      idolAName: idolA?.name || 'Unknown',
      idolAGroup: idolA?.girlGroup || 'Solo',
      idolAPhoto: idolA?.photoUrl,
      idolBId: idolB?.id || '',
      idolBName: idolB?.name || 'Unknown',
      idolBGroup: idolB?.girlGroup || 'Solo',
      idolBPhoto: idolB?.photoUrl,
      scoreA: scA,
      scoreB: scB,
      winnerId: winId,
      winnerName: winNm,
      loserId: loseId,
      loserName: loseNm,
      isDraw,
      date: new Date().toISOString(),
    };

    onUpdateAppState((prev) => ({
      ...prev,
      matchDatabase: [newArchivedMatch, ...(prev.matchDatabase || [])],
    }));

    onRefreshAllStats();
    setIsAddMatchModalOpen(false);
    showToast(`Manual match created between ${idolA?.name} and ${idolB?.name}!`, 'success');
  };

  const handleCreateSeasonArchive = () => {
    if (newSeasonForm.seasonType === 'tournament') {
      const champ = appState.idols.find((i) => i.id === newSeasonForm.championId);
      const runner = appState.idols.find((i) => i.id === newSeasonForm.runnerUpId);
      const third = appState.idols.find((i) => i.id === newSeasonForm.thirdPlaceId);

      const newArchive: TournamentArchive = {
        seasonId: Number(newSeasonForm.seasonNumber),
        seasonName: newSeasonForm.seasonName || `Season ${newSeasonForm.seasonNumber}`,
        completedAt: new Date().toISOString(),
        championId: champ?.id || '',
        championName: champ?.name || 'Unknown',
        runnerUpId: runner?.id || '',
        runnerUpName: runner?.name || '',
        thirdPlaceId: third?.id,
        thirdPlaceName: third?.name,
        totalParticipants: 32,
        groups: [],
      };

      onUpdateAppState((prev) => {
        const filtered = (prev.archives || []).filter((a) => a.seasonId !== newArchive.seasonId);
        return {
          ...prev,
          archives: [...filtered, newArchive].sort((a, b) => a.seasonId - b.seasonId),
        };
      });

      onRefreshAllStats();
      setIsAddSeasonModalOpen(false);
      showToast(`Tournament Cup Season ${newSeasonForm.seasonNumber} archive created!`, 'success');
    } else if (newSeasonForm.seasonType === 'league') {
      const getChampData = (id: string, divId: number) => {
        const idol = appState.idols.find((i) => i.id === id);
        return {
          leagueId: divId,
          leagueName: `Division ${divId}`,
          tierName: `Division ${divId}`,
          championId: idol?.id || '',
          championName: idol?.name || `Division ${divId} Champion`,
          championGroup: idol?.girlGroup || 'Solo',
          championPhoto: idol?.photoUrl,
          points: 85,
          played: 38,
          wins: 27,
          draws: 4,
          losses: 7,
          gameDiff: 42,
        };
      };

      const leagueWinners = [
        getChampData(newSeasonForm.div1ChampId, 1),
        getChampData(newSeasonForm.div2ChampId, 2),
        getChampData(newSeasonForm.div3ChampId, 3),
        getChampData(newSeasonForm.div4ChampId, 4),
        getChampData(newSeasonForm.div5ChampId, 5),
        getChampData(newSeasonForm.div6ChampId, 6),
      ];

      const newLArchive: LeagueSeasonArchive = {
        seasonNumber: Number(newSeasonForm.seasonNumber),
        seasonName: newSeasonForm.seasonName || `League Season ${newSeasonForm.seasonNumber}`,
        completedAt: new Date().toISOString(),
        leagueWinners,
        allStandings: {},
        allMatches: [],
        top32Qualifiers: [],
      };

      const filtered = (leagueArchives || []).filter((a) => a.seasonNumber !== newLArchive.seasonNumber);
      const updated = [...filtered, newLArchive].sort((a, b) => a.seasonNumber - b.seasonNumber);
      onUpdateLeagueArchives(updated);
      onRefreshAllStats();
      setIsAddSeasonModalOpen(false);
      showToast(`League Season ${newSeasonForm.seasonNumber} archive created!`, 'success');
    } else if (newSeasonForm.seasonType === 'the_idols') {
      const champ = appState.idols.find((i) => i.id === newSeasonForm.championId);
      const runner = appState.idols.find((i) => i.id === newSeasonForm.runnerUpId);
      const third = appState.idols.find((i) => i.id === newSeasonForm.thirdPlaceId);
      const regChamp = appState.idols.find((i) => i.id === newSeasonForm.theIdolsSuperleagueWinnerId);

      const newTiArchive: TheIdolsSeasonArchive = {
        seasonNumber: Number(newSeasonForm.seasonNumber),
        seasonName: newSeasonForm.seasonName || `The Idols Season ${newSeasonForm.seasonNumber}`,
        completedAt: new Date().toISOString(),
        championId: champ?.id || '',
        championName: champ?.name || 'Unknown',
        championPhoto: champ?.photoUrl,
        championGroup: champ?.girlGroup || 'Solo',
        runnerUpId: runner?.id || '',
        runnerUpName: runner?.name || '',
        thirdPlaceId: third?.id,
        thirdPlaceName: third?.name,
        standings: regChamp
          ? [
              {
                rank: 1,
                idolId: regChamp.id,
                idolName: regChamp.name,
                girlGroup: regChamp.girlGroup || 'Solo',
                photoUrl: regChamp.photoUrl,
                nationality: regChamp.nationality || 'South Korea',
                seed: regChamp.seed || '1',
                rating: regChamp.rating || 85,
                played: 38,
                wins: 28,
                draws: 5,
                losses: 5,
                points: 89,
                gamesFor: 92,
                gamesAgainst: 34,
                gameDiff: 58,
                form: ['W', 'W', 'W', 'W', 'W'],
              },
            ]
          : [],
        memberIds: [],
        matches: [],
        playoffMatches: [],
        totalMatches: 0,
        totalGoals: 0,
      };

      const currentArchives = theIdolsArchives || appState.theIdolsArchives || [];
      const filtered = currentArchives.filter((a) => a.seasonNumber !== newTiArchive.seasonNumber);
      const updated = [...filtered, newTiArchive].sort((a, b) => a.seasonNumber - b.seasonNumber);
      if (onUpdateTheIdolsArchives) {
        onUpdateTheIdolsArchives(updated);
        saveTheIdolsArchives(updated);
      }
      onUpdateAppState((prev) => ({ ...prev, theIdolsArchives: updated }));
      onRefreshAllStats();
      setIsAddSeasonModalOpen(false);
      showToast(`The Idols Season ${newSeasonForm.seasonNumber} archive created!`, 'success');
    }
  };

  const handleDeleteTournamentArchive = (seasonId: number) => {
    if (!window.confirm(`Are you sure you want to delete Tournament Season ${seasonId} archive?`)) return;
    onUpdateAppState((prev) => ({
      ...prev,
      archives: (prev.archives || []).filter((a) => a.seasonId !== seasonId),
    }));
    onRefreshAllStats();
    showToast(`Tournament Season ${seasonId} archive deleted.`, 'info');
  };

  const handleDeleteLeagueArchive = (seasonNumber: number) => {
    if (!window.confirm(`Are you sure you want to delete League Season ${seasonNumber} archive?`)) return;
    const updated = (leagueArchives || []).filter((a) => a.seasonNumber !== seasonNumber);
    onUpdateLeagueArchives(updated);
    onRefreshAllStats();
    showToast(`League Season ${seasonNumber} archive deleted.`, 'info');
  };

  const handleDeleteTheIdolsArchive = (seasonNumber: number) => {
    if (!window.confirm(`Are you sure you want to delete The Idols Season ${seasonNumber} archive?`)) return;
    const updated = (theIdolsArchives || []).filter((a) => a.seasonNumber !== seasonNumber);
    if (onUpdateTheIdolsArchives) {
      onUpdateTheIdolsArchives(updated);
      saveTheIdolsArchives(updated);
    }
    onUpdateAppState((prev) => ({
      ...prev,
      theIdolsArchives: updated,
    }));
    onRefreshAllStats();
    showToast(`The Idols Season ${seasonNumber} archive deleted.`, 'info');
  };

  // Backup & Raw JSON State
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [rawJsonCategory, setRawJsonCategory] = useState<
    'all' | 'idols' | 'match_db' | 'tournament_archives' | 'league_archives' | 'the_idols_archives' | 'overrides'
  >('all');
  const [jsonFormatPretty, setJsonFormatPretty] = useState<boolean>(true);
  const [isJsonLoading, setIsJsonLoading] = useState<boolean>(false);

  // Compute stats for current category without stringifying the whole world
  const categoryStats = useMemo(() => {
    switch (rawJsonCategory) {
      case 'all':
        return {
          label: 'Full System Database',
          count: `${appState.idols.length} Idols, ${appState.matchDatabase.length} Matches, ${appState.archives?.length || 0} Cups, ${leagueArchives?.length || 0} Leagues, ${theIdolsArchives?.length || 0} The Idols`,
          approxKb: Math.round(
            (appState.idols.length * 300 +
              appState.matchDatabase.length * 250 +
              (appState.archives?.length || 0) * 1500 +
              (theIdolsArchives?.length || 0) * 2000) /
              1024
          ),
        };
      case 'idols':
        return {
          label: 'Idols Roster',
          count: `${appState.idols.length} Idols`,
          approxKb: Math.round((appState.idols.length * 300) / 1024),
        };
      case 'match_db':
        return {
          label: 'Historical Match DB',
          count: `${appState.matchDatabase.length} Records`,
          approxKb: Math.round((appState.matchDatabase.length * 250) / 1024),
        };
      case 'tournament_archives':
        return {
          label: 'Tournament Cup Archives',
          count: `${appState.archives?.length || 0} Seasons`,
          approxKb: Math.round(((appState.archives?.length || 0) * 2000) / 1024),
        };
      case 'league_archives':
        return {
          label: 'League Division Archives',
          count: `${leagueArchives?.length || 0} Seasons`,
          approxKb: Math.round(((leagueArchives?.length || 0) * 4000) / 1024),
        };
      case 'the_idols_archives':
        return {
          label: 'The Idols Superleague Archives',
          count: `${theIdolsArchives?.length || 0} Seasons`,
          approxKb: Math.round(((theIdolsArchives?.length || 0) * 3000) / 1024),
        };
      case 'overrides':
        return {
          label: 'Idol Career Overrides',
          count: `${Object.keys(overrides).length} Custom Overrides`,
          approxKb: Math.round((Object.keys(overrides).length * 150) / 1024),
        };
    }
  }, [rawJsonCategory, appState, leagueArchives, theIdolsArchives, overrides]);

  // Syntax validation of current text in buffer
  const jsonSyntaxValidation = useMemo(() => {
    if (!rawJsonText.trim()) return { isValid: true, empty: true, error: null };
    try {
      JSON.parse(rawJsonText);
      return { isValid: true, empty: false, error: null };
    } catch (e: any) {
      return { isValid: false, empty: false, error: e.message };
    }
  }, [rawJsonText]);

  // Explicit, safe on-demand JSON loader
  const handleLoadCategoryJson = (category = rawJsonCategory, pretty = jsonFormatPretty) => {
    setIsJsonLoading(true);
    setTimeout(() => {
      try {
        const spacing = pretty ? 2 : 0;
        let generated = '';
        if (category === 'all') {
          generated = exportFullDatabaseBackup(appState, leagueState, leagueArchives, overrides, theIdolsState, theIdolsArchives);
          if (!pretty) {
            generated = JSON.stringify(JSON.parse(generated));
          }
        } else if (category === 'idols') {
          generated = JSON.stringify(appState.idols, null, spacing);
        } else if (category === 'match_db') {
          generated = JSON.stringify(appState.matchDatabase, null, spacing);
        } else if (category === 'tournament_archives') {
          generated = JSON.stringify(appState.archives, null, spacing);
        } else if (category === 'league_archives') {
          generated = JSON.stringify(leagueArchives, null, spacing);
        } else if (category === 'the_idols_archives') {
          generated = JSON.stringify(theIdolsArchives || [], null, spacing);
        } else if (category === 'overrides') {
          generated = JSON.stringify(overrides, null, spacing);
        }
        setRawJsonText(generated);
        showToast(`Loaded ${category} JSON into buffer (${(generated.length / 1024).toFixed(1)} KB)`, 'success');
      } catch (err: any) {
        showToast(`Error generating JSON: ${err.message}`, 'error');
      } finally {
        setIsJsonLoading(false);
      }
    }, 20);
  };

  const handleApplyRawJson = () => {
    if (!rawJsonText.trim()) {
      showToast('JSON buffer is empty. Please load or paste JSON first.', 'error');
      return;
    }
    try {
      const parsed = JSON.parse(rawJsonText);
      if (rawJsonCategory === 'all') {
        const validation = validateAndParseDatabaseBackup(rawJsonText);
        if (!validation.success) {
          showToast(`Invalid backup format: ${validation.error}`, 'error');
          return;
        }
        const data = validation.data;
        const importedTheIdolsArchives = Array.isArray(data.theIdolsArchives) ? data.theIdolsArchives : [];
        const importedTheIdolsState = data.theIdolsSeasonState || data.theIdolsState || null;

        if (Array.isArray(data.idols)) {
          onUpdateAppState((prev) => ({
            ...prev,
            idols: data.idols,
            girlGroups: data.girlGroups || prev.girlGroups,
            archives: data.tournamentArchives || data.archives || prev.archives,
            matchDatabase: data.matchDatabase || prev.matchDatabase,
            theIdolsArchives: importedTheIdolsArchives,
            theIdolsState: importedTheIdolsState,
          }));
        }
        if (Array.isArray(data.leagueArchives)) {
          onUpdateLeagueArchives(data.leagueArchives);
        }
        if (onUpdateTheIdolsArchives) {
          onUpdateTheIdolsArchives(importedTheIdolsArchives);
          saveTheIdolsArchives(importedTheIdolsArchives);
        }
        if (onUpdateTheIdolsState) {
          onUpdateTheIdolsState(importedTheIdolsState);
          if (importedTheIdolsState) {
            saveTheIdolsState(importedTheIdolsState);
          }
        }
        if (data.careerStatsOverrides) {
          setOverrides(data.careerStatsOverrides);
          saveCareerOverrides(data.careerStatsOverrides);
        }
        showToast('Full database successfully restored and validated!', 'success');
      } else if (rawJsonCategory === 'overrides') {
        setOverrides(parsed);
        saveCareerOverrides(parsed);
        showToast('Career stats overrides updated from JSON!', 'success');
      } else if (rawJsonCategory === 'match_db' && Array.isArray(parsed)) {
        onUpdateAppState((prev) => ({ ...prev, matchDatabase: parsed }));
        showToast(`Match database updated (${parsed.length} matches)!`, 'success');
      } else if (rawJsonCategory === 'tournament_archives' && Array.isArray(parsed)) {
        onUpdateAppState((prev) => ({ ...prev, archives: parsed }));
        showToast(`Tournament archives updated (${parsed.length} seasons)!`, 'success');
      } else if (rawJsonCategory === 'league_archives' && Array.isArray(parsed)) {
        onUpdateLeagueArchives(parsed);
        showToast(`League archives updated (${parsed.length} seasons)!`, 'success');
      } else if (rawJsonCategory === 'the_idols_archives' && Array.isArray(parsed)) {
        if (onUpdateTheIdolsArchives) {
          onUpdateTheIdolsArchives(parsed);
          saveTheIdolsArchives(parsed);
        }
        onUpdateAppState((prev) => ({ ...prev, theIdolsArchives: parsed }));
        showToast(`The Idols archives updated (${parsed.length} seasons)!`, 'success');
      } else if (rawJsonCategory === 'idols' && Array.isArray(parsed)) {
        onUpdateAppState((prev) => ({ ...prev, idols: parsed }));
        showToast(`Idols roster updated (${parsed.length} idols)!`, 'success');
      }
      onRefreshAllStats();
    } catch (err: any) {
      showToast(`JSON Apply Error: ${err.message}`, 'error');
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportFullDatabaseBackup(appState, leagueState, leagueArchives, overrides, theIdolsState, theIdolsArchives);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabung_idol_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Database backup downloaded successfully!', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawJsonText(content);
        setRawJsonCategory('all');
        showToast('File loaded into JSON buffer. Click "Apply & Validate" to save.', 'info');
      }
    };
    reader.readAsText(file);
  };

  // Filter idols for overrides
  const filteredIdols = useMemo(() => {
    return appState.idols.filter((i) => {
      if (overrideFilterMode === 'overridden' && !overrides[i.id]?.enabled) {
        return false;
      }
      if (overrideFilterMode === 'suspicious' && !suspiciousGroupExits.some((s) => s.idolId === i.id)) {
        return false;
      }
      const q = overrideSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.girlGroup || '').toLowerCase().includes(q) ||
        (i.seed || '').toLowerCase().includes(q)
      );
    });
  }, [appState.idols, overrideSearch, overrideFilterMode, overrides, suspiciousGroupExits]);

  // Combined matches across Tournament Cup, League Divisions, and The Idols Superleague
  const allInspectorMatches = useMemo(() => {
    const leagueMatches = syncLeagueMatchesToArchivedMatches(
      leagueState,
      leagueArchives,
      appState.idols
    );
    const theIdolsAllMatches = convertTheIdolsMatchesToArchived(
      theIdolsState,
      appState.idols,
      theIdolsArchives
    );
    const map = new Map<string, ArchivedMatch>();
    (appState.matchDatabase || []).forEach((m) => map.set(m.matchId, m));
    leagueMatches.forEach((m) => map.set(m.matchId, m));
    theIdolsAllMatches.forEach((m) => map.set(m.matchId, m));
    return Array.from(map.values());
  }, [appState.matchDatabase, leagueState, leagueArchives, theIdolsState, theIdolsArchives, appState.idols]);

  // Filter matches for Match DB
  const filteredMatches = useMemo(() => {
    return allInspectorMatches.filter((m) => {
      const stage = (m.stage || '').toLowerCase();
      const groupName = (m.groupName || '').toLowerCase();
      const matchId = (m.matchId || '').toLowerCase();

      const isTheIdols =
        matchId.startsWith('the_idols') ||
        matchId.startsWith('ti_') ||
        stage.includes('the idols') ||
        stage.includes('superleague') ||
        stage.includes('masters') ||
        groupName.includes('superleague');

      const isLeague =
        !isTheIdols &&
        (matchId.startsWith('league-') ||
        matchId.startsWith('league_') ||
        stage.includes('league') ||
        stage.includes('division') ||
        stage.includes('md ') ||
        stage.includes('matchday') ||
        groupName.includes('division') ||
        groupName.includes('league'));

      if (matchCompFilter === 'tournament' && (isLeague || isTheIdols)) return false;
      if (matchCompFilter === 'league' && !isLeague) return false;
      if (matchCompFilter === 'the_idols' && !isTheIdols) return false;

      if (!matchSearch) return true;
      const q = matchSearch.toLowerCase().trim();
      return (
        (m.idolAName || '').toLowerCase().includes(q) ||
        (m.idolBName || '').toLowerCase().includes(q) ||
        (m.stage || '').toLowerCase().includes(q) ||
        (m.matchId || '').toLowerCase().includes(q) ||
        String(m.seasonId || '').includes(q)
      );
    });
  }, [allInspectorMatches, matchCompFilter, matchSearch]);

  return (
    <div id="database-studio-root" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div
          id="database-toast"
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl border-2 border-black font-bold shadow-2xl flex items-center gap-3 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
              : notification.type === 'error'
              ? 'bg-rose-950 text-rose-300 border-rose-500'
              : 'bg-amber-950 text-amber-300 border-amber-500'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400" />}
          {notification.type === 'info' && <Info className="w-5 h-5 text-amber-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2a170d] via-[#1a0f08] to-[#120804] border-3 border-black rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-mono tracking-widest uppercase font-bold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> Master Database Studio
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-mono font-bold">
                Health Score: {auditReport?.healthScore || 100}%
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-amber-100 tracking-wide">
              Historical Data & Auto-Recalibration Studio
            </h1>
            <p className="text-amber-200/70 text-sm mt-1 max-w-2xl">
              Directly edit idol career numbers, past season champions, match histories, and trigger automated
              system-wide cascade recomputation with zero data loss.
            </p>
          </div>

          <button
            id="recalibrate-main-action-btn"
            onClick={handleRunRecalibration}
            disabled={isProcessing}
            className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm uppercase tracking-wider rounded-2xl border-2 border-black shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>{isProcessing ? 'Recalibrating...' : 'Recalibrate & Re-Sync'}</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Subtabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#140b07] border-2 border-black rounded-2xl">
        {[
          { id: 'cup', label: '🏆 Cup Stats Editor', icon: Trophy },
          { id: 'league', label: '🛡️ League System Editor', icon: Shield },
          { id: 'the_idols', label: '👑 The Idols Superleague', icon: Crown },
          { id: 'idols_profiles', label: '👤 Idols & Groups DB', icon: Users },
          { id: 'match_db', label: '📋 Match Database Inspector', icon: Table },
          { id: 'archives', label: '📜 Past Season Archives', icon: Trophy },
          { id: 'recalibrate', label: '⚡ Recalibrate & Audit', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`db-studio-tab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all ${
                isActive
                  ? 'bg-amber-500 text-black border-2 border-black shadow-md font-black'
                  : 'text-amber-200/70 hover:text-amber-100 hover:bg-black/40 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB: CUP STATS & CAREER RECORDS */}
      {/* ========================================================================= */}
      {activeSubTab === 'cup' && (
        <CupStatsEditor
          idols={appState.idols}
          archives={appState.archives || []}
          currentMatches={appState.matchDatabase}
          overrides={overrides}
          onSaveOverrides={(newOverrides) => setOverrides(newOverrides)}
          onRefreshAllStats={onRefreshAllStats}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: LEAGUE SYSTEM EDITOR (ALL 6 PARALLEL DIVISIONS) */}
      {/* ========================================================================= */}
      {activeSubTab === 'league' && (
        <LeagueSystemEditor
          leagueState={leagueState}
          leagueArchives={leagueArchives}
          idols={appState.idols}
          overrides={overrides}
          onSaveOverrides={(newOverrides) => setOverrides(newOverrides)}
          onUpdateLeagueState={onUpdateLeagueState}
          onUpdateLeagueArchives={onUpdateLeagueArchives}
          onRefreshAllStats={onRefreshAllStats}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: THE IDOLS SUPERLEAGUE & MASTERS PLAYOFF EDITOR */}
      {/* ========================================================================= */}
      {activeSubTab === 'the_idols' && (
        <TheIdolsEditor
          theIdolsState={theIdolsState}
          theIdolsArchives={theIdolsArchives}
          idols={appState.idols}
          overrides={overrides}
          onSaveOverrides={(newOverrides) => setOverrides(newOverrides)}
          onUpdateTheIdolsState={onUpdateTheIdolsState}
          onUpdateTheIdolsArchives={onUpdateTheIdolsArchives}
          onRefreshAllStats={onRefreshAllStats}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: FULL IDOL & GROUP PROFILES & RATINGS DATABASE */}
      {/* ========================================================================= */}
      {activeSubTab === 'idols_profiles' && (
        <IdolsProfilesEditor
          appState={appState}
          onUpdateAppState={onUpdateAppState}
          onRefreshAllStats={onRefreshAllStats}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: RECALIBRATE & AUDIT */}
      {/* ========================================================================= */}
      {activeSubTab === 'recalibrate' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Active Idols', val: auditReport?.totalIdols || 0, color: 'text-amber-400' },
              {
                label: 'Cup Matches',
                val: auditReport?.totalTournamentMatches || 0,
                color: 'text-yellow-400',
              },
              {
                label: 'League Matches',
                val: auditReport?.totalLeagueMatches || 0,
                color: 'text-cyan-400',
              },
              {
                label: 'The Idols Matches',
                val: auditReport?.totalTheIdolsMatches || 0,
                color: 'text-purple-400',
              },
              {
                label: 'Cup Archives',
                val: auditReport?.totalArchivedTournaments || 0,
                color: 'text-indigo-400',
              },
              {
                label: 'League Archives',
                val: auditReport?.totalArchivedLeagues || 0,
                color: 'text-cyan-300',
              },
              {
                label: 'The Idols Archives',
                val: auditReport?.totalArchivedTheIdols || 0,
                color: 'text-fuchsia-400',
              },
              {
                label: 'Active Overrides',
                val: auditReport?.activeOverridesCount || 0,
                color: 'text-emerald-400',
              },
            ].map((card, idx) => (
              <div
                key={idx}
                className="bg-[#1b100a] border-2 border-black rounded-2xl p-4 shadow-md text-center"
              >
                <div className="text-xs uppercase font-mono tracking-wider text-amber-200/60 font-semibold mb-1">
                  {card.label}
                </div>
                <div className={`text-2xl font-black font-mono ${card.color}`}>{card.val}</div>
              </div>
            ))}
          </div>

          {/* Diagnostic Box */}
          <div className="bg-[#1b100a] border-2 border-black rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-amber-100">Live Health & Integrity Diagnostics</h3>
                  <p className="text-xs text-amber-200/60">
                    Automated scan of IDs, match links, archive champions, and standings tables.
                  </p>
                </div>
              </div>
              <button
                onClick={handleRunRecalibration}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Auto-Repair All</span>
              </button>
            </div>

            {auditReport && auditReport.issuesFound.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase text-rose-400 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Issues Detected ({auditReport.issuesFound.length})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
                  {auditReport.issuesFound.map((issue, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-rose-300/90 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl font-mono flex items-start gap-2"
                    >
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-mono">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>All database records, rosters, and archive references passed full structural verification!</span>
              </div>
            )}

            {auditReport && auditReport.repairsMade && auditReport.repairsMade.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-amber-500/10">
                <div className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Recent Auto-Repair Actions
                </div>
                <div className="space-y-1">
                  {auditReport.repairsMade.map((log, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-emerald-300/90 bg-emerald-950/30 border border-emerald-500/20 p-2 rounded-lg font-mono"
                    >
                      ✓ {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Group Stage Exit Integrity & Bug Scanner */}
          <div className="bg-[#1b100a] border-2 border-black rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  suspiciousGroupExits.length > 0
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-amber-100 flex items-center gap-2">
                    <span>Group Stage Exit & Progression Integrity</span>
                    {suspiciousGroupExits.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-rose-500/30 text-rose-300 border border-rose-500/50 rounded-full font-mono font-bold">
                        {suspiciousGroupExits.length} Suspicious
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-amber-200/60">
                    Scans all idols who participated in tournaments and advanced 100% of the time, detecting erroneous group exit counts.
                  </p>
                </div>
              </div>

              {suspiciousGroupExits.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBatchFixSuspiciousGroupExits}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Auto-Zero False Exits ({suspiciousGroupExits.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab('overrides');
                      setOverrideFilterMode('suspicious');
                    }}
                    className="px-4 py-2 bg-[#140b07] hover:bg-black/60 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-amber-500/40 shadow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Inspect in Overrides ↗</span>
                  </button>
                </div>
              )}
            </div>

            {suspiciousGroupExits.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-rose-300/90 font-mono">
                  The following idols have recorded group exits despite never failing a group stage in their match history:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {suspiciousGroupExits.map((sus) => (
                    <div
                      key={sus.idolId}
                      className="bg-[#140b07] border border-rose-500/30 rounded-xl p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-amber-100">{sus.name}</div>
                        <div className="text-[10px] font-mono text-amber-200/60 mt-0.5">
                          Cups: {sus.participations} • Adv: {sus.groupAdvancements}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono font-black text-rose-400">
                          Exits: {sus.groupExits}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedOverrideIdolId(sus.idolId);
                            setActiveSubTab('overrides');
                          }}
                          className="text-[10px] font-mono text-amber-400 hover:underline mt-0.5 block"
                        >
                          edit stats →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs font-mono">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>Group Exit Integrity: 100% Clean! No idols have false group exit counts. All advancements match tournament participation history.</span>
              </div>
            )}
          </div>

          {/* Quick Explanations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#160d08] border-2 border-black rounded-2xl p-4">
              <h4 className="text-sm font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" /> Manual Overrides
              </h4>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Need an idol to have exact trophy counts or match stats? Use the Idol Overrides tab to manually lock
                their statistics.
              </p>
            </div>
            <div className="bg-[#160d08] border-2 border-black rounded-2xl p-4">
              <h4 className="text-sm font-bold text-yellow-300 mb-1 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-yellow-400" /> Past Seasons
              </h4>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Edit historical tournament and league winners directly in the Past Season Archives tab with instant
                trophy updates.
              </p>
            </div>
            <div className="bg-[#160d08] border-2 border-black rounded-2xl p-4">
              <h4 className="text-sm font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-cyan-400" /> Backup & Restore
              </h4>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Download clean JSON backups of your full match logs and archives, or paste custom raw JSON to import
                in bulk.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: IDOL CAREER OVERRIDES & HISTORICAL STATS STUDIO */}
      {/* ========================================================================= */}
      {activeSubTab === 'overrides' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Idol Selector List */}
          <div className="lg:col-span-4 space-y-3 bg-[#1b100a] border-2 border-black rounded-2xl p-4 shadow-xl flex flex-col h-[850px]">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search idol by name, group, seed..."
                value={overrideSearch}
                onChange={(e) => setOverrideSearch(e.target.value)}
                className="w-full bg-[#100804] border border-amber-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-100 placeholder-amber-200/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-[#100804] p-1 border border-amber-500/20 rounded-xl text-[11px] font-mono font-bold">
              <button
                onClick={() => setOverrideFilterMode('all')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  overrideFilterMode === 'all'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-amber-200/60 hover:text-amber-200'
                }`}
              >
                All ({appState.idols.length})
              </button>
              <button
                onClick={() => setOverrideFilterMode('overridden')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  overrideFilterMode === 'overridden'
                    ? 'bg-emerald-500 text-black shadow'
                    : 'text-emerald-400/70 hover:text-emerald-300'
                }`}
              >
                Overrides ({Object.values(overrides).filter((o: IdolCareerOverride) => o?.enabled).length})
              </button>
              <button
                onClick={() => setOverrideFilterMode('suspicious')}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  overrideFilterMode === 'suspicious'
                    ? 'bg-rose-500 text-black shadow'
                    : suspiciousGroupExits.length > 0
                    ? 'text-rose-400 font-black animate-pulse'
                    : 'text-amber-200/40 hover:text-amber-200'
                }`}
              >
                Exit Check ({suspiciousGroupExits.length})
              </button>
            </div>

            {/* Suspicious Warning / Quick Action Banner */}
            {suspiciousGroupExits.length > 0 && (
              <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-2.5 text-xs text-rose-200 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{suspiciousGroupExits.length} Suspicious Group Exit(s)</span>
                </div>
                <p className="text-[11px] text-rose-200/80 leading-tight">
                  These idols advanced 100% of the time in all attended tournaments, but have exit counts &gt; 0.
                </p>
                <button
                  onClick={handleBatchFixSuspiciousGroupExits}
                  className="mt-1 w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] rounded-lg border border-black shadow transition-all flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3 h-3" />
                  <span>Auto-Zero False Exits for All {suspiciousGroupExits.length}</span>
                </button>
              </div>
            )}

            <div className="text-[11px] font-mono uppercase text-amber-200/50 font-bold px-1 flex items-center justify-between">
              <span>Showing Idols ({filteredIdols.length})</span>
              {overrideFilterMode !== 'all' && (
                <button
                  onClick={() => setOverrideFilterMode('all')}
                  className="text-amber-400 hover:underline text-[10px] lowercase"
                >
                  reset filter
                </button>
              )}
            </div>

            {/* Idol List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredIdols.length === 0 ? (
                <div className="text-center py-12 text-xs text-amber-200/40 font-mono">
                  No idols match current filter
                </div>
              ) : (
                filteredIdols.map((idol) => {
                  const isSelected = selectedOverrideIdolId === idol.id;
                  const hasOverride = overrides[idol.id]?.enabled;
                  const career = careerStats.find((c) => c.idolId === idol.id);
                  const isSuspicious = suspiciousGroupExits.some((s) => s.idolId === idol.id);

                  return (
                    <button
                      key={idol.id}
                      onClick={() => setSelectedOverrideIdolId(idol.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500 text-black border-black font-bold shadow-md'
                          : isSuspicious
                          ? 'bg-rose-950/30 hover:bg-rose-950/60 text-amber-100 border-rose-500/40'
                          : 'bg-[#140b07] hover:bg-black/50 text-amber-100 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {idol.photoUrl ? (
                          <img
                            src={idol.photoUrl}
                            alt={idol.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-lg object-cover border border-black/50 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-black/60 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                            {idol.name.charAt(0)}
                          </div>
                        )}
                        <div className="truncate">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>{idol.name}</span>
                            {isSuspicious && (
                              <span className="text-[9px] px-1 py-0.2 bg-rose-500 text-white rounded font-mono font-black">
                                EXIT BUG
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] truncate ${isSelected ? 'text-black/70' : 'text-amber-200/60'}`}>
                            {idol.girlGroup} • {idol.seed}
                          </div>
                          {career && (
                            <div className={`text-[9px] font-mono truncate mt-0.5 ${isSelected ? 'text-black/80' : 'text-amber-400/80'}`}>
                              Cups: {career.participations} • Exits: {career.groupExits} • Adv: {career.groupAdvancements}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {hasOverride && (
                          <span
                            className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded uppercase ${
                              isSelected
                                ? 'bg-black text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            Override
                          </span>
                        )}
                        {career?.championships ? (
                          <span
                            className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${
                              isSelected
                                ? 'bg-black text-amber-300'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            🏆 {career.championships}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Editor for Selected Idol */}
          <div className="lg:col-span-8 bg-[#1b100a] border-2 border-black rounded-2xl p-6 shadow-xl space-y-6 max-h-[850px] overflow-y-auto">
            {selectedIdol ? (
              <>
                {/* Selected Idol Header & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
                  <div className="flex items-center gap-4">
                    {selectedIdol.photoUrl ? (
                      <img
                        src={selectedIdol.photoUrl}
                        alt={selectedIdol.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-black border-2 border-amber-400 flex items-center justify-center text-lg font-black text-amber-300">
                        {selectedIdol.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-black text-amber-100 flex items-center gap-2">
                        <span>{selectedIdol.name}</span>
                        {onSelectIdol && (
                          <button
                            onClick={() => {
                              onSelectIdol(selectedIdol.id);
                              setActiveTab('idol_profile');
                            }}
                            className="text-xs font-mono font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30"
                          >
                            View Profile ↗
                          </button>
                        )}
                      </h2>
                      <div className="text-xs text-amber-200/60 mt-0.5">
                        {selectedIdol.girlGroup} • {selectedIdol.nationality} • {selectedIdol.seed} • Rating:{' '}
                        <span className="font-mono font-bold text-amber-300">{selectedIdol.rating || 50}</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Toggle & Quick Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleFillFromComputedBase}
                      className="px-3 py-1.5 bg-[#140b07] hover:bg-black/60 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow"
                      title="Load derived database stats into editor form"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Fill from Base</span>
                    </button>

                    <label className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editOverrideForm.enabled ?? false}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-amber-500 bg-black border-amber-500/40 focus:ring-0"
                      />
                      <span>Enable Manual Override</span>
                    </label>
                  </div>
                </div>

                {/* Special Notification for False Group Exit Fix */}
                {(Number(editOverrideForm.groupExits || 0) > 0 || (selectedBaseCareer?.groupExits ?? 0) > 0) && (
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 text-xs text-amber-200">
                      <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        Current group exits for {selectedIdol.name}:{' '}
                        <strong className="font-mono text-amber-300">
                          {editOverrideForm.groupExits ?? selectedBaseCareer?.groupExits ?? 0}
                        </strong>
                        . If this idol always advanced to knockout and never exited in groups, zero this out.
                      </span>
                    </div>
                    <button
                      onClick={handleZeroOutGroupExits}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs rounded-lg border border-black shadow flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Set Group Exits = 0</span>
                    </button>
                  </div>
                )}

                {/* Competition Sub-Category Navigation Bar */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#120904] border border-amber-500/30 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setEditorCategory('cup')}
                    className={`flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      editorCategory === 'cup'
                        ? 'bg-amber-500 text-black shadow-md font-black'
                        : 'text-amber-300/70 hover:text-amber-200 hover:bg-white/5'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Tournament Cup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorCategory('league')}
                    className={`flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      editorCategory === 'league'
                        ? 'bg-cyan-500 text-black shadow-md font-black'
                        : 'text-cyan-300/70 hover:text-cyan-200 hover:bg-white/5'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Domestic League</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorCategory('the_idols')}
                    className={`flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      editorCategory === 'the_idols'
                        ? 'bg-purple-500 text-black shadow-md font-black'
                        : 'text-purple-300/70 hover:text-purple-200 hover:bg-white/5'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>The Idols Superleague</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditorCategory('universal')}
                    className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      editorCategory === 'universal'
                        ? 'bg-amber-200 text-black shadow-md font-black'
                        : 'text-amber-200/50 hover:text-amber-200 hover:bg-white/5'
                    }`}
                  >
                    <span>All Tabs</span>
                  </button>
                </div>

                {/* ========================================================================= */}
                {/* CUP SECTIONS 1 - 4 (Visible if 'cup' or 'universal') */}
                {/* ========================================================================= */}
                {(editorCategory === 'cup' || editorCategory === 'universal') && (
                  <>
                {/* SECTION 1: TOURNAMENT CUP & STAGE PROGRESSION */}
                <div className="space-y-3 bg-[#140b07] border border-amber-500/20 rounded-2xl p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-black flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-400" /> 1. Tournament Cup & Stage Progression
                    </span>
                    <span className="text-[10px] text-amber-200/50 lowercase font-normal">
                      controls participations, group exits & advancements
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Participations */}
                    <div>
                      <label className="text-[11px] text-amber-200/80 font-semibold mb-1 block">
                        Cup Participations (Tournaments Played)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.participations ?? selectedBaseCareer?.participations ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            participations: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Group Advancements */}
                    <div>
                      <label className="text-[11px] text-emerald-300/80 font-semibold mb-1 block">
                        Group Advancements (Reached Knockout)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.groupAdvancements ?? selectedBaseCareer?.groupAdvancements ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            groupAdvancements: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* Group Exits */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-rose-300/80 font-semibold">
                          Group Exits (Did Not Advance)
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditOverrideForm((prev) => ({ ...prev, groupExits: 0 }))}
                          className="text-[10px] font-mono text-emerald-400 hover:underline cursor-pointer"
                        >
                          set 0
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.groupExits ?? selectedBaseCareer?.groupExits ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              groupExits: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-rose-500/50 rounded-xl px-3 py-2 text-sm font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              groupExits: Math.max(0, Number(prev.groupExits || 0) - 1),
                            }))
                          }
                          className="px-2 py-2 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded-lg border border-rose-500/40 font-mono font-bold text-xs"
                          title="Decrease by 1"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              groupExits: Number(prev.groupExits || 0) + 1,
                            }))
                          }
                          className="px-2 py-2 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded-lg border border-rose-500/40 font-mono font-bold text-xs"
                          title="Increase by 1"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Best & Worst Finishes */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] text-amber-200/80 font-semibold mb-1 block">
                        Best Finish
                      </label>
                      <input
                        type="text"
                        value={editOverrideForm.bestFinish ?? selectedBaseCareer?.bestFinish ?? '-'}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({ ...prev, bestFinish: e.target.value }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {['Champion', 'Runner-Up', '3rd Place', '4th Place', 'Quarter-Finals', 'Round of 16'].map(
                          (preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditOverrideForm((prev) => ({ ...prev, bestFinish: preset }))}
                              className="text-[9px] font-mono px-1.5 py-0.5 bg-[#100804] hover:bg-amber-500/20 text-amber-200/70 hover:text-amber-200 rounded border border-amber-500/20"
                            >
                              {preset}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/80 font-semibold mb-1 block">
                        Worst Finish
                      </label>
                      <input
                        type="text"
                        value={editOverrideForm.worstFinish ?? selectedBaseCareer?.worstFinish ?? '-'}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({ ...prev, worstFinish: e.target.value }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-Finals', '4th Place'].map(
                          (preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setEditOverrideForm((prev) => ({ ...prev, worstFinish: preset }))}
                              className="text-[9px] font-mono px-1.5 py-0.5 bg-[#100804] hover:bg-amber-500/20 text-amber-200/70 hover:text-amber-200 rounded border border-amber-500/20"
                            >
                              {preset}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/80 font-semibold mb-1 block">
                        Average Placement
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={editOverrideForm.avgPlacement ?? selectedBaseCareer?.avgPlacement ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            avgPlacement: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                      <p className="text-[10px] text-amber-200/40 mt-1">Lower is better (e.g. 1.0 = Champion avg)</p>
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* SECTION 2: PODIUMS & DEEP KNOCKOUT ROUNDS */}
                {/* ========================================================================= */}
                <div className="space-y-3 bg-[#140b07] border border-amber-500/20 rounded-2xl p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-black flex items-center gap-1.5">
                    <Medal className="w-4 h-4 text-amber-400" /> 2. Podiums & Deep Knockout Stages
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-amber-300 font-semibold mb-1 block">
                        Tournament Cups 🏆
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.championships ?? selectedBaseCareer?.championships ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            championships: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/50 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Cup Runner-Up 🥈
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.runnerUps ?? selectedBaseCareer?.runnerUps ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            runnerUps: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Cup 3rd Place 🥉
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.thirdPlaces ?? selectedBaseCareer?.thirdPlaces ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            thirdPlaces: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Cup 4th Place
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.fourthPlaces ?? selectedBaseCareer?.fourthPlaces ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            fourthPlaces: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Top 4 Finishes
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.top4 ?? selectedBaseCareer?.top4 ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            top4: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Quarter-Finals
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.quarterFinals ?? selectedBaseCareer?.quarterFinals ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            quarterFinals: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Round of 16
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.roundOf16 ?? selectedBaseCareer?.roundOf16 ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            roundOf16: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Round of 32
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.roundOf32 ?? selectedBaseCareer?.roundOf32 ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            roundOf32: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-indigo-300/80 font-semibold mb-1 block">
                        Play-Ins Played
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.playIns ?? selectedBaseCareer?.playIns ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            playIns: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-indigo-500/30 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* SECTION 3: MATCH RECORD & STAGE SPLITS */}
                {/* ========================================================================= */}
                <div className="space-y-3 bg-[#140b07] border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-black flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-amber-400" /> 3. Match Records & Stage Splits
                    </h3>
                    <button
                      type="button"
                      onClick={handleAutoCalcCupRates}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                      title="Auto-calculate Win Rate % and Game Difference from current cup match values"
                    >
                      <Calculator className="w-3 h-3 text-amber-400" />
                      <span>Auto-Calc Cup Rates</span>
                    </button>
                  </div>

                  {/* Overall Match Record */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">Matches</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.matches ?? selectedBaseCareer?.matches ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            matches: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-emerald-400/80 font-semibold mb-1 block">Wins</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.wins ?? selectedBaseCareer?.wins ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            wins: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-400/80 font-semibold mb-1 block">Draws</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.draws ?? selectedBaseCareer?.draws ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            draws: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-rose-400/80 font-semibold mb-1 block">Losses</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.losses ?? selectedBaseCareer?.losses ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            losses: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-rose-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-amber-200/80 font-semibold mb-1 block">Win Rate %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editOverrideForm.winRate ?? selectedBaseCareer?.winRate ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            winRate: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Stage Splits: Group vs Knockout */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-2 border-t border-amber-500/10">
                    <div>
                      <label className="text-[10px] text-amber-200/70 font-semibold mb-1 block">Group Wins</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.groupWins ?? selectedBaseCareer?.groupWins ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            groupWins: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-amber-200/70 font-semibold mb-1 block">Group Losses</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.groupLosses ?? selectedBaseCareer?.groupLosses ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            groupLosses: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-amber-200/70 font-semibold mb-1 block">Group WR %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editOverrideForm.groupWinRate ?? selectedBaseCareer?.groupWinRate ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            groupWinRate: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-indigo-300/80 font-semibold mb-1 block">KO Wins</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.knockoutWins ?? selectedBaseCareer?.knockoutWins ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            knockoutWins: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-indigo-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-indigo-300/80 font-semibold mb-1 block">KO Losses</label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.knockoutLosses ?? selectedBaseCareer?.knockoutLosses ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            knockoutLosses: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-indigo-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-300 focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-indigo-300/80 font-semibold mb-1 block">KO WR %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editOverrideForm.knockoutWinRate ?? selectedBaseCareer?.knockoutWinRate ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            knockoutWinRate: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#100804] border border-indigo-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  {/* Games For / Against */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-500/10">
                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Games/Goals For (GF)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.gamesFor ?? selectedBaseCareer?.gamesFor ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            gamesFor: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Games/Goals Against (GA)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.gamesAgainst ?? selectedBaseCareer?.gamesAgainst ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            gamesAgainst: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                        Game Difference (+/-)
                      </label>
                      <input
                        type="number"
                        value={editOverrideForm.gameDiff ?? selectedBaseCareer?.gameDiff ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            gameDiff: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* SECTION 4: STREAKS & HIGH MARKS */}
                {/* ========================================================================= */}
                <div className="space-y-3 bg-[#140b07] border border-amber-500/20 rounded-2xl p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-black flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" /> 4. Streaks & High Marks
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-emerald-400/80 font-semibold mb-1 block">
                        Longest Win Streak 🔥
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.longestWinStreak ?? selectedBaseCareer?.longestWinStreak ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            longestWinStreak: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-cyan-300/80 font-semibold mb-1 block">
                        Longest Unbeaten Streak
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.longestUnbeatenStreak ?? selectedBaseCareer?.longestUnbeatenStreak ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            longestUnbeatenStreak: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-rose-400/80 font-semibold mb-1 block">
                        Longest Losing Streak
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editOverrideForm.longestLosingStreak ?? selectedBaseCareer?.longestLosingStreak ?? 0}
                        onChange={(e) =>
                          setEditOverrideForm((prev) => ({
                            ...prev,
                            longestLosingStreak: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full bg-[#100804] border border-rose-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-rose-300 focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* ========================================================================= */}
                {/* SECTION 5A: DOMESTIC LEAGUE DIVISIONS (Visible if 'league' or 'universal') */}
                {/* ========================================================================= */}
                {(editorCategory === 'league' || editorCategory === 'universal') && (
                  <div className="space-y-4 bg-[#140b07] border border-cyan-500/30 rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-black flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-cyan-400" /> Domestic League Divisions (IPL & Div 2-6)
                      </h3>
                      <button
                        type="button"
                        onClick={handleAutoCalcLeagueRates}
                        className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="Auto-calculate League Points (3*W + D), Goal Difference (GF - GA), and Win Rate %"
                      >
                        <Calculator className="w-3 h-3 text-cyan-400" />
                        <span>Auto-Calc League Rates</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-cyan-200/60 leading-relaxed">
                      Controls honors, podiums, double round-robin 38-matchday records, points, and goal differential across all 6 parallel divisions.
                    </div>

                    {/* League Honors & Trophies */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] text-cyan-200/80 font-semibold mb-1 block">
                          Division Titles 🥇
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.divisionTitles ?? selectedBaseDerived?.league?.divisionTitles ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              divisionTitles: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-cyan-200/80 font-semibold mb-1 block">
                          Top 3 Podiums 🏅
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.divisionPodiums ?? selectedBaseDerived?.league?.divisionPodiums ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              divisionPodiums: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-cyan-200/80 font-semibold mb-1 block">
                          Top 5 Qualifiers 🎟️
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.top5Finishes ?? selectedBaseDerived?.league?.top5Finishes ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              top5Finishes: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-cyan-200/80 font-semibold mb-1 block">
                          Seasons Played 📅
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueSeasonsPlayed ?? selectedBaseDerived?.league?.leagueSeasonsPlayed ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueSeasonsPlayed: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* League Match Record */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] text-cyan-200/70 font-semibold mb-1 block">
                          League Matches
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueMatches ?? selectedBaseDerived?.league?.leagueMatches ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueMatches: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-200 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-emerald-400/80 font-semibold mb-1 block">
                          League Wins
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueWins ?? selectedBaseDerived?.league?.leagueWins ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueWins: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-amber-300/80 font-semibold mb-1 block">
                          League Draws
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueDraws ?? selectedBaseDerived?.league?.leagueDraws ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueDraws: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-rose-400/80 font-semibold mb-1 block">
                          League Losses
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueLosses ?? selectedBaseDerived?.league?.leagueLosses ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueLosses: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-rose-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-cyan-300 font-semibold mb-1 block">
                          League Points (PTS)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leaguePoints ?? selectedBaseDerived?.league?.leaguePoints ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leaguePoints: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* League Goals & Win Rate */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] text-cyan-200/70 font-semibold mb-1 block">
                          Goals For (GF)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueGoalsFor ?? selectedBaseDerived?.league?.leagueGoalsFor ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueGoalsFor: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-200 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-cyan-200/70 font-semibold mb-1 block">
                          Goals Against (GA)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.leagueGoalsAgainst ?? selectedBaseDerived?.league?.leagueGoalsAgainst ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueGoalsAgainst: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-200 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-cyan-200/70 font-semibold mb-1 block">
                          Goal Diff (+/-)
                        </label>
                        <input
                          type="number"
                          value={editOverrideForm.leagueGoalDiff ?? selectedBaseDerived?.league?.leagueGoalDiff ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueGoalDiff: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-200 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-cyan-300 font-semibold mb-1 block">
                          Win Rate %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={editOverrideForm.leagueWinRate ?? selectedBaseDerived?.league?.leagueWinRate ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              leagueWinRate: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-[#100804] border border-cyan-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* SECTION 5B: THE IDOLS SUPERLEAGUE & MASTERS (Visible if 'the_idols' or 'universal') */}
                {/* ========================================================================= */}
                {(editorCategory === 'the_idols' || editorCategory === 'universal') && (
                  <div className="space-y-4 bg-[#140b07] border border-purple-500/30 rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-purple-400 font-black flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-400" /> The Idols Superleague & Masters Playoff
                      </h3>
                      <button
                        type="button"
                        onClick={handleAutoCalcTheIdolsRates}
                        className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="Auto-calculate Superleague Points (3*W + D), Goal Difference (GF - GA), and Win Rate %"
                      >
                        <Calculator className="w-3 h-3 text-purple-400" />
                        <span>Auto-Calc Superleague Rates</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-purple-200/60 leading-relaxed">
                      Controls regular season table titles, Masters championship trophies, playoff berths, and high-performance match records.
                    </div>

                    {/* Titles & Playoff Honors */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-purple-200/80 font-semibold mb-1 block">
                          Superleague Titles 🌟 (Table #1)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsSuperleagueTitles ?? selectedBaseDerived?.theIdols?.theIdolsSuperleagueTitles ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsSuperleagueTitles: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-purple-200/80 font-semibold mb-1 block">
                          Masters Titles 🏆 (Playoff Champ)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsMastersTitles ?? selectedBaseDerived?.theIdols?.theIdolsMastersTitles ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsMastersTitles: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-purple-200/80 font-semibold mb-1 block">
                          Masters Runner-Ups 🥈
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsMastersRunnerUps ?? selectedBaseDerived?.theIdols?.theIdolsMastersRunnerUps ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsMastersRunnerUps: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-purple-200/80 font-semibold mb-1 block">
                          Masters Podiums 🥉 (Top 3)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsMastersPodiums ?? selectedBaseDerived?.theIdols?.theIdolsMastersPodiums ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsMastersPodiums: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-purple-200/80 font-semibold mb-1 block">
                          Playoff Appearances 🎟️
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsPlayoffApps ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffApps ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsPlayoffApps: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-purple-200/80 font-semibold mb-1 block">
                          Seasons Played 📅
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsSeasonsPlayed ?? selectedBaseDerived?.theIdols?.theIdolsSeasonsPlayed ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsSeasonsPlayed: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>

                    {/* Regular Season Match Record */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">
                          Matches (Total)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsMatches ?? selectedBaseDerived?.theIdols?.theIdolsMatches ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsMatches: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-200 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-emerald-400/80 font-semibold mb-1 block">
                          Wins
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsWins ?? selectedBaseDerived?.theIdols?.theIdolsWins ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsWins: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-amber-300/80 font-semibold mb-1 block">
                          Draws
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsDraws ?? selectedBaseDerived?.theIdols?.theIdolsDraws ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsDraws: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-rose-400/80 font-semibold mb-1 block">
                          Losses
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsLosses ?? selectedBaseDerived?.theIdols?.theIdolsLosses ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsLosses: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-rose-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-purple-300 font-semibold mb-1 block">
                          Points (PTS)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsPoints ?? selectedBaseDerived?.theIdols?.theIdolsPoints ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsPoints: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>

                    {/* Goals & Playoff Splits */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">
                          Goals For (GF)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsGoalsFor ?? selectedBaseDerived?.theIdols?.theIdolsGoalsFor ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsGoalsFor: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-200 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">
                          Goals Against (GA)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsGoalsAgainst ?? selectedBaseDerived?.theIdols?.theIdolsGoalsAgainst ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsGoalsAgainst: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-200 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-purple-200/70 font-semibold mb-1 block">
                          Goal Diff (+/-)
                        </label>
                        <input
                          type="number"
                          value={editOverrideForm.theIdolsGoalDiff ?? selectedBaseDerived?.theIdols?.theIdolsGoalDiff ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsGoalDiff: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-200 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-purple-300 font-semibold mb-1 block">
                          Win Rate %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={editOverrideForm.theIdolsWinRate ?? selectedBaseDerived?.theIdols?.theIdolsWinRate ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsWinRate: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>

                    {/* Playoff Split Detail */}
                    <div className="grid grid-cols-3 gap-3 pt-1 bg-[#100804] p-3 rounded-xl border border-purple-500/20">
                      <div>
                        <label className="text-[10px] text-purple-200/60 font-semibold mb-1 block">
                          Playoff Matches
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsPlayoffMatches ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffMatches ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsPlayoffMatches: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#160b06] border border-purple-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-purple-200 focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-emerald-400/80 font-semibold mb-1 block">
                          Playoff Wins
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsPlayoffWins ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffWins ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsPlayoffWins: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#160b06] border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-rose-400/80 font-semibold mb-1 block">
                          Playoff Losses
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editOverrideForm.theIdolsPlayoffLosses ?? selectedBaseDerived?.theIdols?.theIdolsPlayoffLosses ?? 0}
                          onChange={(e) =>
                            setEditOverrideForm((prev) => ({
                              ...prev,
                              theIdolsPlayoffLosses: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full bg-[#160b06] border border-rose-500/30 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* SECTION 6: NOTES & AUDIT COMPARISON */}
                {/* ========================================================================= */}
                <div className="space-y-3 bg-[#140b07] border border-amber-500/20 rounded-2xl p-4">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-black flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4 text-amber-400" /> 6. Administrative Notes & Audit Comparison
                    </span>
                    {editOverrideForm.updatedAt && (
                      <span className="text-[10px] text-amber-200/50 font-mono">
                        Last modified: {new Date(editOverrideForm.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </h3>

                  <div>
                    <label className="text-[11px] text-amber-200/70 font-semibold mb-1 block">
                      Custom Notes / Change Rationale
                    </label>
                    <textarea
                      rows={2}
                      value={editOverrideForm.customNotes || ''}
                      onChange={(e) => setEditOverrideForm((prev) => ({ ...prev, customNotes: e.target.value }))}
                      placeholder="e.g. Corrected Season 1 false group exit; manually synchronized with historical matchday log..."
                      className="w-full bg-[#100804] border border-amber-500/30 rounded-xl px-3 py-2 text-xs font-mono text-amber-100 placeholder-amber-200/30 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Comparison Summary Card */}
                  <div className="bg-[#100804] border border-amber-500/20 rounded-xl p-3">
                    <div className="text-[11px] font-mono font-bold uppercase text-amber-400 mb-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Live Audit Comparison: Database Base vs. Override Form</span>
                      </span>
                      <span className="text-[10px] text-amber-200/50 font-normal">
                        unified titles across Cup, League & The Idols
                      </span>
                    </div>

                    {/* Primary Highlight: Unified Total Titles */}
                    {(() => {
                      const baseTotalTitles = calculateUnifiedTotalTitles(
                        selectedBaseDerived?.cup?.championships || selectedBaseCareer?.championships || 0,
                        selectedBaseDerived?.league?.divisionTitles || 0,
                        selectedBaseDerived?.theIdols?.theIdolsSuperleagueTitles || 0,
                        selectedBaseDerived?.theIdols?.theIdolsMastersTitles || 0
                      );
                      const overrideTotalTitles = calculateUnifiedTotalTitles(
                        editOverrideForm.championships ?? (selectedBaseDerived?.cup?.championships || selectedBaseCareer?.championships || 0),
                        editOverrideForm.divisionTitles ?? (selectedBaseDerived?.league?.divisionTitles || 0),
                        editOverrideForm.theIdolsSuperleagueTitles ?? (selectedBaseDerived?.theIdols?.theIdolsSuperleagueTitles || 0),
                        editOverrideForm.theIdolsMastersTitles ?? (selectedBaseDerived?.theIdols?.theIdolsMastersTitles || 0)
                      );

                      const baseTotalMatches =
                        (selectedBaseDerived?.cup?.matchesPlayed ?? selectedBaseCareer?.matchesPlayed ?? 0) +
                        (selectedBaseDerived?.league?.leagueMatches ?? 0) +
                        (selectedBaseDerived?.theIdols?.theIdolsMatches ?? 0);
                      const overrideTotalMatches =
                        (editOverrideForm.matchesPlayed ?? selectedBaseDerived?.cup?.matchesPlayed ?? selectedBaseCareer?.matchesPlayed ?? 0) +
                        (editOverrideForm.leagueMatches ?? selectedBaseDerived?.league?.leagueMatches ?? 0) +
                        (editOverrideForm.theIdolsMatches ?? selectedBaseDerived?.theIdols?.theIdolsMatches ?? 0);

                      return (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                            <div className="bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/30 col-span-2 sm:col-span-1">
                              <div className="text-[10px] text-amber-300/80 font-bold">Unified Titles 👑</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-200/60 font-semibold">{baseTotalTitles}</span>
                                <span className="text-amber-400">→</span>
                                <span className="font-black text-amber-300 text-sm">{overrideTotalTitles}</span>
                              </div>
                            </div>

                            <div className="bg-[#180d07] p-2 rounded-lg border border-amber-500/10">
                              <div className="text-[10px] text-amber-200/50">Cup Titles 🏆</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-200/60">{selectedBaseCareer?.championships ?? 0}</span>
                                <span className="text-amber-400">→</span>
                                <span className="font-bold text-yellow-300">
                                  {editOverrideForm.championships ?? selectedBaseCareer?.championships ?? 0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-[#180d07] p-2 rounded-lg border border-cyan-500/10">
                              <div className="text-[10px] text-cyan-200/50">Division Titles 🥇</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-cyan-200/60">{selectedBaseDerived?.league?.divisionTitles ?? 0}</span>
                                <span className="text-cyan-400">→</span>
                                <span className="font-bold text-cyan-300">
                                  {editOverrideForm.divisionTitles ?? selectedBaseDerived?.league?.divisionTitles ?? 0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-[#180d07] p-2 rounded-lg border border-purple-500/10">
                              <div className="text-[10px] text-purple-200/50">The Idols Titles 🌟</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-purple-200/60">
                                  {(selectedBaseDerived?.theIdols?.theIdolsSuperleagueTitles || 0) + (selectedBaseDerived?.theIdols?.theIdolsMastersTitles || 0)}
                                </span>
                                <span className="text-purple-400">→</span>
                                <span className="font-bold text-purple-300">
                                  {(editOverrideForm.theIdolsSuperleagueTitles ?? (selectedBaseDerived?.theIdols?.theIdolsSuperleagueTitles || 0)) +
                                    (editOverrideForm.theIdolsMastersTitles ?? (selectedBaseDerived?.theIdols?.theIdolsMastersTitles || 0))}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
                            <div className="bg-[#180d07] p-2 rounded-lg border border-amber-500/10">
                              <div className="text-[10px] text-amber-200/50">Participations</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-200/60">{selectedBaseCareer?.participations ?? 0}</span>
                                <span className="text-amber-400">→</span>
                                <span className="font-bold text-amber-300">
                                  {editOverrideForm.participations ?? selectedBaseCareer?.participations ?? 0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-[#180d07] p-2 rounded-lg border border-amber-500/10">
                              <div className="text-[10px] text-amber-200/50">Group Advancements</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-200/60">{selectedBaseCareer?.groupAdvancements ?? 0}</span>
                                <span className="text-amber-400">→</span>
                                <span className="font-bold text-emerald-400">
                                  {editOverrideForm.groupAdvancements ?? selectedBaseCareer?.groupAdvancements ?? 0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-[#180d07] p-2 rounded-lg border border-amber-500/10">
                              <div className="text-[10px] text-amber-200/50">Group Exits</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-200/60">{selectedBaseCareer?.groupExits ?? 0}</span>
                                <span className="text-amber-400">→</span>
                                <span
                                  className={`font-bold ${
                                    (editOverrideForm.groupExits ?? selectedBaseCareer?.groupExits ?? 0) === 0
                                      ? 'text-emerald-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {editOverrideForm.groupExits ?? selectedBaseCareer?.groupExits ?? 0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-[#180d07] p-2 rounded-lg border border-amber-500/10">
                              <div className="text-[10px] text-amber-200/50">Total Career Matches</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-amber-200/60">{baseTotalMatches}</span>
                                <span className="text-amber-400">→</span>
                                <span className="font-bold text-amber-300">
                                  {overrideTotalMatches}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-amber-500/20 sticky bottom-0 bg-[#1b100a] py-2">
                  <button
                    onClick={handleResetOverride}
                    className="px-4 py-2.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Base (Remove Override)</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSaveOverride}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-lg flex items-center gap-2 cursor-pointer transition-all transform hover:scale-[1.02]"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save & Sync Override</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-amber-200/50">Select an idol from the left to edit</div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: PAST SEASON ARCHIVES */}
      {/* ========================================================================= */}
      {activeSubTab === 'archives' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 p-1 bg-[#100804] border border-amber-500/30 rounded-xl flex-wrap">
              <button
                onClick={() => setArchiveType('tournament')}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  archiveType === 'tournament'
                    ? 'bg-amber-500 text-black font-black shadow'
                    : 'text-amber-200/70 hover:text-amber-100'
                }`}
              >
                🏆 Tournament Cup Archives ({appState.archives?.length || 0})
              </button>
              <button
                onClick={() => setArchiveType('league')}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  archiveType === 'league'
                    ? 'bg-amber-500 text-black font-black shadow'
                    : 'text-amber-200/70 hover:text-amber-100'
                }`}
              >
                🥇 League Division Archives ({leagueArchives?.length || 0})
              </button>
              <button
                onClick={() => setArchiveType('the_idols')}
                className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  archiveType === 'the_idols'
                    ? 'bg-purple-500 text-black font-black shadow'
                    : 'text-amber-200/70 hover:text-amber-100'
                }`}
              >
                👑 The Idols Archives ({theIdolsArchives?.length || appState.theIdolsArchives?.length || 0})
              </button>
            </div>

            <button
              onClick={() => {
                const tiCount = theIdolsArchives?.length || appState.theIdolsArchives?.length || 0;
                setNewSeasonForm((prev) => ({
                  ...prev,
                  seasonType: archiveType,
                  seasonNumber:
                    archiveType === 'tournament'
                      ? (appState.archives?.length || 0) + 1
                      : archiveType === 'league'
                      ? (leagueArchives?.length || 0) + 1
                      : tiCount + 1,
                  seasonName:
                    archiveType === 'tournament'
                      ? `Champions Cup Season ${(appState.archives?.length || 0) + 1}`
                      : archiveType === 'league'
                      ? `League Season ${(leagueArchives?.length || 0) + 1}`
                      : `The Idols Season ${tiCount + 1}`,
                }));
                setIsAddSeasonModalOpen(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add {archiveType === 'tournament' ? 'Tournament' : archiveType === 'league' ? 'League' : 'The Idols'} Season</span>
            </button>
          </div>

          {/* Tournament Archives List & Editor */}
          {archiveType === 'tournament' && (
            <div className="space-y-4">
              {(appState.archives || []).length === 0 ? (
                <div className="text-center py-16 bg-[#1b100a] border-2 border-black rounded-2xl p-6 text-amber-200/60 text-sm">
                  No completed tournament season archives recorded yet.
                </div>
              ) : (
                (appState.archives || []).map((arch) => {
                  const isEditing = editingTournamentSeasonId === arch.seasonId;
                  const champIdol = appState.idols.find((i) => i.id === arch.championId);
                  const runnerIdol = appState.idols.find((i) => i.id === arch.runnerUpId);
                  const thirdIdol = appState.idols.find((i) => i.id === arch.thirdPlaceId);

                  return (
                    <div
                      key={arch.seasonId}
                      className="bg-[#1b100a] border-2 border-black rounded-2xl p-5 shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-mono font-black">
                            Season {arch.seasonId}
                          </span>
                          <h3 className="text-base font-black text-amber-100">{arch.seasonName}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setEditingTournamentSeasonId(isEditing ? null : arch.seasonId)
                            }
                            className="px-3 py-1.5 bg-[#140b07] hover:bg-black text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEditing ? 'Close Editor' : 'Edit Podiums'}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteTournamentArchive(arch.seasonId)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-rose-500/20"
                            title="Delete Season Archive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Display Podiums */}
                      {!isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-[#120904] border border-amber-500/30 p-3 rounded-xl flex items-center gap-3">
                            <span className="text-xl">🏆</span>
                            <div>
                              <div className="text-[10px] uppercase font-mono text-amber-400 font-bold">
                                Champion
                              </div>
                              <div className="text-xs font-black text-amber-100">
                                {champIdol?.name || arch.championName || 'None'}
                              </div>
                            </div>
                          </div>
                          <div className="bg-[#120904] border border-slate-500/30 p-3 rounded-xl flex items-center gap-3">
                            <span className="text-xl">🥈</span>
                            <div>
                              <div className="text-[10px] uppercase font-mono text-slate-300 font-bold">
                                Runner-Up
                              </div>
                              <div className="text-xs font-black text-slate-100">
                                {runnerIdol?.name || arch.runnerUpName || 'None'}
                              </div>
                            </div>
                          </div>
                          <div className="bg-[#120904] border border-amber-700/30 p-3 rounded-xl flex items-center gap-3">
                            <span className="text-xl">🥉</span>
                            <div>
                              <div className="text-[10px] uppercase font-mono text-amber-600 font-bold">
                                3rd Place
                              </div>
                              <div className="text-xs font-black text-amber-200">
                                {thirdIdol?.name || arch.thirdPlaceName || 'None'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* In-line Edit Podiums */
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                          <div>
                            <label className="text-xs text-amber-300 font-bold mb-1 block">🏆 Champion</label>
                            <select
                              value={arch.championId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                onUpdateAppState((prev) => ({
                                  ...prev,
                                  archives: prev.archives.map((a) =>
                                    a.seasonId === arch.seasonId
                                      ? { ...a, championId: newId, championName: idl?.name || '' }
                                      : a
                                  ),
                                }));
                                showToast(`Season ${arch.seasonId} Champion updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                            >
                              <option value="">-- Select Champion --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-slate-300 font-bold mb-1 block">🥈 Runner-Up</label>
                            <select
                              value={arch.runnerUpId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                onUpdateAppState((prev) => ({
                                  ...prev,
                                  archives: prev.archives.map((a) =>
                                    a.seasonId === arch.seasonId
                                      ? { ...a, runnerUpId: newId, runnerUpName: idl?.name || '' }
                                      : a
                                  ),
                                }));
                                showToast(`Season ${arch.seasonId} Runner-Up updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                            >
                              <option value="">-- Select Runner-Up --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-amber-600 font-bold mb-1 block">🥉 3rd Place</label>
                            <select
                              value={arch.thirdPlaceId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                onUpdateAppState((prev) => ({
                                  ...prev,
                                  archives: prev.archives.map((a) =>
                                    a.seasonId === arch.seasonId
                                      ? { ...a, thirdPlaceId: newId, thirdPlaceName: idl?.name || '' }
                                      : a
                                  ),
                                }));
                                showToast(`Season ${arch.seasonId} 3rd Place updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                            >
                              <option value="">-- Select 3rd Place --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* League Archives List & Editor */}
          {archiveType === 'league' && (
            <div className="space-y-4">
              {(leagueArchives || []).length === 0 ? (
                <div className="text-center py-16 bg-[#1b100a] border-2 border-black rounded-2xl p-6 text-amber-200/60 text-sm">
                  No completed league seasons recorded in archives yet.
                </div>
              ) : (
                (leagueArchives || []).map((lArch) => {
                  const isEditing = editingLeagueSeasonId === lArch.seasonNumber;

                  return (
                    <div
                      key={lArch.seasonNumber}
                      className="bg-[#1b100a] border-2 border-black rounded-2xl p-5 shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-mono font-black">
                            League Season {lArch.seasonNumber}
                          </span>
                          <h3 className="text-base font-black text-amber-100">{lArch.seasonName}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setEditingLeagueSeasonId(isEditing ? null : lArch.seasonNumber)
                            }
                            className="px-3 py-1.5 bg-[#140b07] hover:bg-black text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEditing ? 'Close Editor' : 'Edit Champions'}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteLeagueArchive(lArch.seasonNumber)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-rose-500/20"
                            title="Delete Season Archive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Division Champions Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map((divId) => {
                          const winEntry = (lArch.leagueWinners || []).find((w) => w.leagueId === divId);
                          const champIdol = winEntry?.championId
                            ? appState.idols.find((i) => i.id === winEntry.championId)
                            : null;

                          return (
                            <div
                              key={divId}
                              className="bg-[#120904] border border-amber-500/20 p-3 rounded-xl space-y-1"
                            >
                              <div className="text-[10px] uppercase font-mono text-cyan-400 font-bold">
                                Division {divId} Champion
                              </div>
                              {!isEditing ? (
                                <div className="text-xs font-black text-amber-100 truncate">
                                  {champIdol?.name || winEntry?.championName || 'None recorded'}
                                </div>
                              ) : (
                                <select
                                  value={winEntry?.championId || ''}
                                  onChange={(e) => {
                                    const newChampId = e.target.value;
                                    const foundIdol = appState.idols.find((i) => i.id === newChampId);
                                    const updatedLeagues = leagueArchives.map((la) => {
                                      if (la.seasonNumber !== lArch.seasonNumber) return la;
                                      const existingWinners = [...(la.leagueWinners || [])];
                                      const idx = existingWinners.findIndex((w) => w.leagueId === divId);
                                      const newEntry = {
                                        leagueId: divId,
                                        leagueName: `Division ${divId}`,
                                        tierName: `Division ${divId}`,
                                        championId: newChampId,
                                        championName: foundIdol?.name || '',
                                        championGroup: foundIdol?.girlGroup || 'Solo',
                                        championPhoto: foundIdol?.photoUrl,
                                        points: 0,
                                        played: 38,
                                        wins: 0,
                                        draws: 0,
                                        losses: 0,
                                        gameDiff: 0,
                                      };
                                      if (idx >= 0) existingWinners[idx] = newEntry;
                                      else existingWinners.push(newEntry);
                                      return { ...la, leagueWinners: existingWinners };
                                    });
                                    onUpdateLeagueArchives(updatedLeagues);
                                    showToast(`Season ${lArch.seasonNumber} Div ${divId} Champion updated!`, 'success');
                                  }}
                                  className="w-full bg-[#100804] border border-amber-500/40 rounded-lg px-2 py-1.5 text-xs text-amber-100 font-bold mt-1"
                                >
                                  <option value="">-- Select Champion --</option>
                                  {appState.idols.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.name} ({i.girlGroup})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* The Idols Superleague Archives List & Editor */}
          {archiveType === 'the_idols' && (
            <div className="space-y-4">
              {(theIdolsArchives || appState.theIdolsArchives || []).length === 0 ? (
                <div className="text-center py-16 bg-[#1b100a] border-2 border-black rounded-2xl p-6 text-amber-200/60 text-sm">
                  No completed The Idols Superleague seasons recorded in archives yet.
                </div>
              ) : (
                (theIdolsArchives || appState.theIdolsArchives || []).map((tiArch) => {
                  const isEditing = editingTheIdolsSeasonId === tiArch.seasonNumber;
                  const regWinner = tiArch.standings?.find((s: any) => s.rank === 1);
                  const regWinnerIdol = regWinner
                    ? appState.idols.find((i) => i.id === regWinner.idolId)
                    : null;
                  const champIdol = tiArch.championId
                    ? appState.idols.find((i) => i.id === tiArch.championId)
                    : null;
                  const runnerIdol = tiArch.runnerUpId
                    ? appState.idols.find((i) => i.id === tiArch.runnerUpId)
                    : null;
                  const thirdIdol = tiArch.thirdPlaceId
                    ? appState.idols.find((i) => i.id === tiArch.thirdPlaceId)
                    : null;

                  return (
                    <div
                      key={tiArch.seasonNumber}
                      className="bg-[#1b100a] border-2 border-black rounded-2xl p-5 shadow-xl space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-mono font-black">
                            The Idols Season {tiArch.seasonNumber}
                          </span>
                          <h3 className="text-base font-black text-amber-100">{tiArch.seasonName}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setEditingTheIdolsSeasonId(isEditing ? null : tiArch.seasonNumber)
                            }
                            className="px-3 py-1.5 bg-[#140b07] hover:bg-black text-purple-300 border border-purple-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEditing ? 'Close Editor' : 'Edit Honours'}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteTheIdolsArchive(tiArch.seasonNumber)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-rose-500/20"
                            title="Delete Season Archive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Display Honours */}
                      {!isEditing ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="bg-[#120904] border border-amber-500/20 p-3 rounded-xl">
                            <div className="text-[10px] uppercase font-mono text-amber-400 font-bold mb-1 flex items-center gap-1">
                              👑 Masters Champion
                            </div>
                            <div className="text-xs font-black text-amber-100 truncate">
                              {champIdol?.name || tiArch.championName || 'None recorded'}
                            </div>
                          </div>

                          <div className="bg-[#120904] border border-amber-500/20 p-3 rounded-xl">
                            <div className="text-[10px] uppercase font-mono text-slate-300 font-bold mb-1 flex items-center gap-1">
                              🥈 Masters Runner-Up
                            </div>
                            <div className="text-xs font-black text-amber-100 truncate">
                              {runnerIdol?.name || tiArch.runnerUpName || 'None recorded'}
                            </div>
                          </div>

                          <div className="bg-[#120904] border border-amber-500/20 p-3 rounded-xl">
                            <div className="text-[10px] uppercase font-mono text-amber-600 font-bold mb-1 flex items-center gap-1">
                              🥉 Masters 3rd Place
                            </div>
                            <div className="text-xs font-black text-amber-100 truncate">
                              {thirdIdol?.name || tiArch.thirdPlaceName || 'None recorded'}
                            </div>
                          </div>

                          <div className="bg-[#120904] border border-purple-500/30 p-3 rounded-xl">
                            <div className="text-[10px] uppercase font-mono text-purple-300 font-bold mb-1 flex items-center gap-1">
                              🛡️ Regular Season #1
                            </div>
                            <div className="text-xs font-black text-purple-100 truncate">
                              {regWinnerIdol?.name || regWinner?.idolName || 'None recorded'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* In-line Edit Honours */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                          <div>
                            <label className="text-xs text-amber-400 font-bold mb-1 block">👑 Masters Champion</label>
                            <select
                              value={tiArch.championId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                const currentArchives = theIdolsArchives || appState.theIdolsArchives || [];
                                const updated = currentArchives.map((a: any) =>
                                  a.seasonNumber === tiArch.seasonNumber
                                    ? { ...a, championId: newId, championName: idl?.name || '', championPhoto: idl?.photoUrl, championGroup: idl?.girlGroup || 'Solo' }
                                    : a
                                );
                                if (onUpdateTheIdolsArchives) {
                                  onUpdateTheIdolsArchives(updated);
                                  saveTheIdolsArchives(updated);
                                }
                                onUpdateAppState((prev) => ({ ...prev, theIdolsArchives: updated }));
                                onRefreshAllStats();
                                showToast(`The Idols Season ${tiArch.seasonNumber} Champion updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                            >
                              <option value="">-- Select Champion --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-slate-300 font-bold mb-1 block">🥈 Runner-Up</label>
                            <select
                              value={tiArch.runnerUpId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                const currentArchives = theIdolsArchives || appState.theIdolsArchives || [];
                                const updated = currentArchives.map((a: any) =>
                                  a.seasonNumber === tiArch.seasonNumber
                                    ? { ...a, runnerUpId: newId, runnerUpName: idl?.name || '' }
                                    : a
                                );
                                if (onUpdateTheIdolsArchives) {
                                  onUpdateTheIdolsArchives(updated);
                                  saveTheIdolsArchives(updated);
                                }
                                onUpdateAppState((prev) => ({ ...prev, theIdolsArchives: updated }));
                                onRefreshAllStats();
                                showToast(`The Idols Season ${tiArch.seasonNumber} Runner-Up updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                            >
                              <option value="">-- Select Runner-Up --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-amber-600 font-bold mb-1 block">🥉 3rd Place</label>
                            <select
                              value={tiArch.thirdPlaceId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                const currentArchives = theIdolsArchives || appState.theIdolsArchives || [];
                                const updated = currentArchives.map((a: any) =>
                                  a.seasonNumber === tiArch.seasonNumber
                                    ? { ...a, thirdPlaceId: newId, thirdPlaceName: idl?.name || '' }
                                    : a
                                );
                                if (onUpdateTheIdolsArchives) {
                                  onUpdateTheIdolsArchives(updated);
                                  saveTheIdolsArchives(updated);
                                }
                                onUpdateAppState((prev) => ({ ...prev, theIdolsArchives: updated }));
                                onRefreshAllStats();
                                showToast(`The Idols Season ${tiArch.seasonNumber} 3rd Place updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                            >
                              <option value="">-- Select 3rd Place --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-purple-300 font-bold mb-1 block">🛡️ Regular Season #1</label>
                            <select
                              value={regWinner?.idolId || ''}
                              onChange={(e) => {
                                const newId = e.target.value;
                                const idl = appState.idols.find((i) => i.id === newId);
                                const currentArchives = theIdolsArchives || appState.theIdolsArchives || [];
                                const updated = currentArchives.map((a: any) => {
                                  if (a.seasonNumber !== tiArch.seasonNumber) return a;
                                  const existingStandings = Array.isArray(a.standings) ? [...a.standings] : [];
                                  const regEntry = {
                                    rank: 1,
                                    idolId: newId,
                                    idolName: idl?.name || '',
                                    girlGroup: idl?.girlGroup || 'Solo',
                                    photoUrl: idl?.photoUrl,
                                    nationality: idl?.nationality || 'South Korea',
                                    seed: idl?.seed || '1',
                                    rating: idl?.rating || 85,
                                    played: 38,
                                    wins: 28,
                                    draws: 5,
                                    losses: 5,
                                    points: 89,
                                    gamesFor: 92,
                                    gamesAgainst: 34,
                                    gameDiff: 58,
                                    form: ['W', 'W', 'W', 'W', 'W'] as Array<'W' | 'D' | 'L'>,
                                  };
                                  const filtered = existingStandings.filter((s: any) => s.rank !== 1);
                                  return { ...a, standings: [regEntry, ...filtered] };
                                });
                                if (onUpdateTheIdolsArchives) {
                                  onUpdateTheIdolsArchives(updated);
                                  saveTheIdolsArchives(updated);
                                }
                                onUpdateAppState((prev) => ({ ...prev, theIdolsArchives: updated }));
                                onRefreshAllStats();
                                showToast(`The Idols Season ${tiArch.seasonNumber} Regular Season #1 updated!`, 'success');
                              }}
                              className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-xs font-bold text-purple-200"
                            >
                              <option value="">-- Select Regular Season #1 --</option>
                              {appState.idols.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.girlGroup})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: MATCH DATABASE INSPECTOR */}
      {/* ========================================================================= */}
      {activeSubTab === 'match_db' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1b100a] border-2 border-black rounded-2xl p-4 shadow-md">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by idol name, match ID, stage..."
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                className="w-full bg-[#100804] border border-amber-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-100 placeholder-amber-200/40 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setMatchCompFilter('all');
                  setMatchPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  matchCompFilter === 'all' ? 'bg-amber-500 text-black font-black' : 'text-amber-200/70 hover:bg-black'
                }`}
              >
                All ({allInspectorMatches.length})
              </button>
              <button
                onClick={() => {
                  setMatchCompFilter('tournament');
                  setMatchPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  matchCompFilter === 'tournament' ? 'bg-amber-500 text-black font-black' : 'text-amber-200/70 hover:bg-black'
                }`}
              >
                Tournament Cup
              </button>
              <button
                onClick={() => {
                  setMatchCompFilter('league');
                  setMatchPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  matchCompFilter === 'league' ? 'bg-cyan-500 text-black font-black' : 'text-amber-200/70 hover:bg-black'
                }`}
              >
                League Matches
              </button>
              <button
                onClick={() => {
                  setMatchCompFilter('the_idols');
                  setMatchPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  matchCompFilter === 'the_idols' ? 'bg-purple-500 text-black font-black' : 'text-amber-200/70 hover:bg-black'
                }`}
              >
                The Idols Superleague
              </button>
              <button
                onClick={() => setIsAddMatchModalOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-lg border-2 border-black shadow flex items-center gap-1.5 cursor-pointer ml-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Match</span>
              </button>
            </div>
          </div>

          <div className="bg-[#1b100a] border-2 border-black rounded-2xl p-4 shadow-xl overflow-hidden space-y-3">
            {/* Pagination Controls Header */}
            {filteredMatches.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-amber-500/20 text-xs">
                <span className="text-amber-200/70 font-medium">
                  Showing matches{' '}
                  <strong className="text-amber-400">
                    {(matchPage - 1) * matchPageSize + 1} -{' '}
                    {Math.min(matchPage * matchPageSize, filteredMatches.length)}
                  </strong>{' '}
                  of <strong className="text-amber-400">{filteredMatches.length}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setMatchPage((p) => Math.max(1, p - 1))}
                    disabled={matchPage === 1}
                    className="px-2.5 py-1 bg-black text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/30 rounded-lg text-xs font-bold hover:bg-amber-500/10"
                  >
                    &larr; Prev
                  </button>
                  <span className="px-2 font-mono font-bold text-amber-300">
                    Page {matchPage} of {Math.max(1, Math.ceil(filteredMatches.length / matchPageSize))}
                  </span>
                  <button
                    onClick={() =>
                      setMatchPage((p) =>
                        Math.min(Math.ceil(filteredMatches.length / matchPageSize), p + 1)
                      )
                    }
                    disabled={matchPage >= Math.ceil(filteredMatches.length / matchPageSize)}
                    className="px-2.5 py-1 bg-black text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-500/30 rounded-lg text-xs font-bold hover:bg-amber-500/10"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-[600px] overflow-y-auto space-y-2 pr-1">
              {filteredMatches
                .slice((matchPage - 1) * matchPageSize, matchPage * matchPageSize)
                .map((m) => {
                const isEditing = editingMatchId === m.matchId;

                return (
                  <div
                    key={m.matchId}
                    className="p-3 bg-[#120904] border border-amber-500/20 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <span className="font-mono text-[10px] text-amber-200/50 bg-black/60 px-2 py-0.5 rounded border border-amber-500/20">
                        {m.matchId}
                      </span>
                      <span className="font-bold text-amber-300 truncate">{m.stage || 'Match'}</span>
                    </div>

                    {!isEditing ? (
                      <div className="flex items-center gap-4 font-bold">
                        <span className="text-right w-28 truncate">{m.idolAName}</span>
                        <span className="px-3 py-1 bg-black border border-amber-500/40 rounded-lg font-mono font-black text-amber-300">
                          {m.scoreA ?? 0} - {m.scoreB ?? 0}
                        </span>
                        <span className="text-left w-28 truncate">{m.idolBName}</span>
                      </div>
                    ) : (
                      /* Inline Score Editor */
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={editingMatchData.scoreA ?? m.scoreA ?? 0}
                          onChange={(e) =>
                            setEditingMatchData((prev) => ({ ...prev, scoreA: Number(e.target.value) }))
                          }
                          className="w-12 bg-black border border-amber-500/40 rounded p-1 text-center font-mono font-bold text-amber-300"
                        />
                        <span className="font-bold">-</span>
                        <input
                          type="number"
                          min="0"
                          value={editingMatchData.scoreB ?? m.scoreB ?? 0}
                          onChange={(e) =>
                            setEditingMatchData((prev) => ({ ...prev, scoreB: Number(e.target.value) }))
                          }
                          className="w-12 bg-black border border-amber-500/40 rounded p-1 text-center font-mono font-bold text-amber-300"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <button
                          onClick={() => {
                            setEditingMatchId(m.matchId);
                            setEditingMatchData({ ...m });
                          }}
                          className="px-2.5 py-1 bg-black hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const scA = Number(editingMatchData.scoreA ?? m.scoreA ?? 0);
                            const scB = Number(editingMatchData.scoreB ?? m.scoreB ?? 0);
                            let winId = m.winnerId;
                            let winNm = m.winnerName;
                            if (scA > scB) {
                              winId = m.idolAId;
                              winNm = m.idolAName;
                            } else if (scB > scA) {
                              winId = m.idolBId;
                              winNm = m.idolBName;
                            } else {
                              winId = 'DRAW';
                              winNm = 'DRAW';
                            }

                            onUpdateAppState((prev) => ({
                              ...prev,
                              matchDatabase: prev.matchDatabase.map((item) =>
                                item.matchId === m.matchId
                                  ? {
                                      ...item,
                                      scoreA: scA,
                                      scoreB: scB,
                                      winnerId: winId,
                                      winnerName: winNm,
                                      isDraw: winId === 'DRAW',
                                    }
                                  : item
                              ),
                            }));
                            setEditingMatchId(null);
                            showToast(`Match ${m.matchId} score updated!`, 'success');
                          }}
                          className="px-2.5 py-1 bg-amber-500 text-black font-black rounded-lg text-[11px]"
                        >
                          Save
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onUpdateAppState((prev) => ({
                            ...prev,
                            matchDatabase: prev.matchDatabase.filter((item) => item.matchId !== m.matchId),
                          }));
                          showToast(`Match ${m.matchId} deleted.`, 'info');
                        }}
                        className="p-1 text-rose-400 hover:text-rose-300"
                        title="Delete Match"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: BACKUP & RAW JSON */}
      {/* ========================================================================= */}
      {activeSubTab === 'backup_raw' && (
        <div className="space-y-6">
          {/* Export / Import Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1b100a] border-2 border-black rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-100">Export Complete Database</h3>
                  <p className="text-xs text-amber-200/60">
                    Download full verified JSON containing all idols, matches, archives, and overrides.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Full Database Backup (.json)</span>
              </button>
            </div>

            <div className="bg-[#1b100a] border-2 border-black rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-100">Restore Database from File</h3>
                  <p className="text-xs text-emerald-200/60">
                    Select a previously exported JSON backup to load into the live editor.
                  </p>
                </div>
              </div>
              <label className="w-full py-3 bg-[#140b07] hover:bg-black text-emerald-300 font-bold text-xs uppercase tracking-wider rounded-xl border-2 border-emerald-500/40 shadow flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Select JSON Backup File</span>
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* Raw JSON Direct Editor */}
          <div className="bg-[#1b100a] border-2 border-black rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-amber-100">Raw JSON Direct Database Editor</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-amber-200/60 font-bold">
                      {categoryStats.label}: {categoryStats.count} (~{categoryStats.approxKb} KB)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rawJsonCategory}
                  onChange={(e) => {
                    const cat = e.target.value as any;
                    setRawJsonCategory(cat);
                  }}
                  className="bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-amber-200 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="all">Full System Database</option>
                  <option value="idols">Idols Roster ({appState.idols.length})</option>
                  <option value="overrides">Career Overrides ({Object.keys(overrides).length})</option>
                  <option value="match_db">Match Database ({appState.matchDatabase.length})</option>
                  <option value="tournament_archives">Tournament Archives ({appState.archives?.length || 0})</option>
                  <option value="league_archives">League Archives ({leagueArchives?.length || 0})</option>
                  <option value="the_idols_archives">The Idols Archives ({theIdolsArchives?.length || 0})</option>
                </select>

                <button
                  onClick={() => handleLoadCategoryJson(rawJsonCategory, jsonFormatPretty)}
                  disabled={isJsonLoading}
                  className="px-3.5 py-1.5 bg-[#120904] hover:bg-black text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Generate and load data into JSON buffer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isJsonLoading ? 'animate-spin' : ''}`} />
                  <span>{isJsonLoading ? 'Generating...' : 'Load to Editor'}</span>
                </button>

                <button
                  onClick={() => {
                    const nextPretty = !jsonFormatPretty;
                    setJsonFormatPretty(nextPretty);
                    if (rawJsonText.trim()) {
                      try {
                        const parsed = JSON.parse(rawJsonText);
                        setRawJsonText(JSON.stringify(parsed, null, nextPretty ? 2 : 0));
                      } catch {
                        // ignore if invalid
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-[#120904] hover:bg-black text-amber-200/80 border border-amber-500/30 rounded-xl text-xs font-bold"
                  title="Toggle pretty-printed vs compact JSON"
                >
                  <span>{jsonFormatPretty ? 'Spacing: 2' : 'Spacing: Compact'}</span>
                </button>

                {rawJsonText.trim() && (
                  <>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(rawJsonText);
                        showToast('JSON copied to clipboard!', 'success');
                      }}
                      className="px-3 py-1.5 bg-[#120904] hover:bg-black text-amber-200/80 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                      title="Copy entire buffer to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy</span>
                    </button>

                    <button
                      onClick={() => {
                        setRawJsonText('');
                        showToast('Editor buffer cleared.', 'info');
                      }}
                      className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold"
                      title="Clear editor buffer"
                    >
                      Clear
                    </button>
                  </>
                )}

                <button
                  onClick={handleApplyRawJson}
                  disabled={!jsonSyntaxValidation.isValid || jsonSyntaxValidation.empty}
                  className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply & Validate</span>
                </button>
              </div>
            </div>

            {/* Syntax Validation Status Banner */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#0e0704] border border-amber-500/20 text-xs">
              <div className="flex items-center gap-2">
                {jsonSyntaxValidation.empty ? (
                  <span className="text-amber-200/50 font-medium">
                    Buffer is empty. Click &ldquo;Load to Editor&rdquo; above or paste external JSON.
                  </span>
                ) : jsonSyntaxValidation.isValid ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Valid JSON Syntax ({rawJsonText.length.toLocaleString()} characters)
                  </span>
                ) : (
                  <span className="text-rose-400 font-bold flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    JSON Syntax Error: {jsonSyntaxValidation.error}
                  </span>
                )}
              </div>

              {rawJsonText.trim() && (
                <span className="text-[11px] font-mono text-amber-200/50">
                  Buffer: {(rawJsonText.length / 1024).toFixed(1)} KB
                </span>
              )}
            </div>

            <textarea
              value={rawJsonText}
              onChange={(e) => setRawJsonText(e.target.value)}
              rows={18}
              className="w-full bg-[#0d0603] border border-amber-500/30 rounded-2xl p-4 font-mono text-xs text-amber-200/90 leading-relaxed focus:outline-none focus:border-amber-400"
              placeholder="Click 'Load to Editor' above to inspect or edit JSON, or paste your custom backup here..."
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD MANUAL HISTORICAL MATCH */}
      {/* ========================================================================= */}
      {isAddMatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b100a] border-3 border-black rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Table className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-amber-100">Add Historical Match</h3>
              </div>
              <button
                onClick={() => setIsAddMatchModalOpen(false)}
                className="text-amber-200/60 hover:text-amber-100 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-amber-200/70 font-semibold mb-1 block">Season Number</label>
                  <input
                    type="number"
                    min="1"
                    value={newMatchForm.seasonId}
                    onChange={(e) =>
                      setNewMatchForm((prev) => ({ ...prev, seasonId: Number(e.target.value) }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-200"
                  />
                </div>
                <div>
                  <label className="text-amber-200/70 font-semibold mb-1 block">Stage / Round</label>
                  <select
                    value={newMatchForm.stage}
                    onChange={(e) => setNewMatchForm((prev) => ({ ...prev, stage: e.target.value }))}
                    className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                  >
                    <option value="Final">🏆 Final</option>
                    <option value="Semi-Final">⚔️ Semi-Final</option>
                    <option value="Quarter-Final">Quarter-Final</option>
                    <option value="Round of 16">Round of 16</option>
                    <option value="Group Stage">Group Stage</option>
                    <option value="Wildcard Play-In">Wildcard Play-In</option>
                    <option value="League Match">League Match</option>
                  </select>
                </div>
              </div>

              {/* Idol A & Score */}
              <div className="bg-[#120904] border border-amber-500/20 p-3 rounded-2xl space-y-2">
                <label className="text-amber-400 font-bold block">Idol A (Home)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select
                      value={newMatchForm.idolAId}
                      onChange={(e) =>
                        setNewMatchForm((prev) => ({ ...prev, idolAId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={newMatchForm.scoreA}
                      onChange={(e) =>
                        setNewMatchForm((prev) => ({ ...prev, scoreA: Number(e.target.value) }))
                      }
                      placeholder="Score"
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-center text-xs font-mono font-bold text-amber-300"
                    />
                  </div>
                </div>
              </div>

              {/* Idol B & Score */}
              <div className="bg-[#120904] border border-amber-500/20 p-3 rounded-2xl space-y-2">
                <label className="text-amber-400 font-bold block">Idol B (Away)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select
                      value={newMatchForm.idolBId}
                      onChange={(e) =>
                        setNewMatchForm((prev) => ({ ...prev, idolBId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={newMatchForm.scoreB}
                      onChange={(e) =>
                        setNewMatchForm((prev) => ({ ...prev, scoreB: Number(e.target.value) }))
                      }
                      placeholder="Score"
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-center text-xs font-mono font-bold text-amber-300"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-500/20">
              <button
                onClick={() => setIsAddMatchModalOpen(false)}
                className="px-4 py-2 bg-[#140b07] hover:bg-black text-amber-200/70 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManualMatch}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Match</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SEASON ARCHIVE */}
      {/* ========================================================================= */}
      {isAddSeasonModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b100a] border-3 border-black rounded-3xl p-6 shadow-2xl max-w-xl w-full space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Trophy className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-amber-100">
                  Add {newSeasonForm.seasonType === 'tournament' ? 'Tournament Cup' : newSeasonForm.seasonType === 'league' ? 'League' : 'The Idols'} Season Archive
                </h3>
              </div>
              <button
                onClick={() => setIsAddSeasonModalOpen(false)}
                className="text-amber-200/60 hover:text-amber-100 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-amber-200/70 font-semibold mb-1 block">Season Number</label>
                  <input
                    type="number"
                    min="1"
                    value={newSeasonForm.seasonNumber}
                    onChange={(e) =>
                      setNewSeasonForm((prev) => ({
                        ...prev,
                        seasonNumber: Number(e.target.value),
                        seasonName:
                          prev.seasonType === 'tournament'
                            ? `Champions Cup Season ${e.target.value}`
                            : prev.seasonType === 'league'
                            ? `League Season ${e.target.value}`
                            : `The Idols Season ${e.target.value}`,
                      }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-200"
                  />
                </div>
                <div>
                  <label className="text-amber-200/70 font-semibold mb-1 block">Season Title</label>
                  <input
                    type="text"
                    value={newSeasonForm.seasonName}
                    onChange={(e) =>
                      setNewSeasonForm((prev) => ({ ...prev, seasonName: e.target.value }))
                    }
                    className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-100"
                  />
                </div>
              </div>

              {newSeasonForm.seasonType === 'tournament' ? (
                /* Tournament Podiums */
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-amber-400 font-bold mb-1 block">🏆 Champion</label>
                    <select
                      value={newSeasonForm.championId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, championId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <option value="">-- Select Champion --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold mb-1 block">🥈 Runner-Up</label>
                    <select
                      value={newSeasonForm.runnerUpId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, runnerUpId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <option value="">-- Select Runner-Up --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-amber-600 font-bold mb-1 block">🥉 3rd Place</label>
                    <select
                      value={newSeasonForm.thirdPlaceId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, thirdPlaceId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <option value="">-- Select 3rd Place --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : newSeasonForm.seasonType === 'the_idols' ? (
                /* The Idols Superleague Honours */
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-mono uppercase text-purple-400 font-bold">
                    The Idols Superleague Honours
                  </div>
                  <div>
                    <label className="text-amber-400 font-bold mb-1 block">👑 Masters Champion</label>
                    <select
                      value={newSeasonForm.championId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, championId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <option value="">-- Select Masters Champion --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold mb-1 block">🥈 Masters Runner-Up</label>
                    <select
                      value={newSeasonForm.runnerUpId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, runnerUpId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <option value="">-- Select Masters Runner-Up --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-amber-600 font-bold mb-1 block">🥉 Masters 3rd Place</label>
                    <select
                      value={newSeasonForm.thirdPlaceId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, thirdPlaceId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <option value="">-- Select Masters 3rd Place --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-purple-300 font-bold mb-1 block">🛡️ Regular Season #1 (League Winner)</label>
                    <select
                      value={newSeasonForm.div1ChampId}
                      onChange={(e) =>
                        setNewSeasonForm((prev) => ({ ...prev, div1ChampId: e.target.value }))
                      }
                      className="w-full bg-[#100804] border border-purple-500/40 rounded-xl px-3 py-2 text-xs font-bold text-purple-200"
                    >
                      <option value="">-- Select Regular Season #1 --</option>
                      {appState.idols.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.girlGroup})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* League Division Champions */
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-mono uppercase text-cyan-400 font-bold">
                    Division Champions (Divisions 1 - 6)
                  </div>
                  {[1, 2, 3, 4, 5, 6].map((divId) => {
                    const keyName = `div${divId}ChampId` as keyof typeof newSeasonForm;
                    return (
                      <div key={divId}>
                        <label className="text-cyan-300 font-semibold mb-1 block">
                          Division {divId} Champion
                        </label>
                        <select
                          value={String(newSeasonForm[keyName] || '')}
                          onChange={(e) =>
                            setNewSeasonForm((prev) => ({ ...prev, [keyName]: e.target.value }))
                          }
                          className="w-full bg-[#100804] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-200"
                        >
                          <option value="">-- Select Division {divId} Champion --</option>
                          {appState.idols.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.girlGroup})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-500/20">
              <button
                onClick={() => setIsAddSeasonModalOpen(false)}
                className="px-4 py-2 bg-[#140b07] hover:bg-black text-amber-200/70 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSeasonArchive}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Season Archive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
