import React, { useState, useMemo } from 'react';
import {
  TournamentConfig,
  LeagueSeasonState,
  LeagueSeasonArchive,
  Idol,
  LeagueInfo,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  CareerStat,
} from '../types';
import { CareerOverridesMap, exportLeagueBrandingAndRosters } from '../utils/databaseStudioLogic';
import {
  AppState,
  normalizeAppState,
  exportAppStateToJSON,
  exportIdolRosterToJSON,
  exportLeagueDatabaseToJSON,
  exportLeagueBrandingToJSON,
  exportPersonalRankingsToJSON,
  exportMatchDatabaseToJSON,
  exportMatchDatabaseToCSV,
  exportHistoricalStatsToJSON,
  exportTheIdolsDatabaseToJSON,
} from '../utils/storage';
import {
  calculateLeagueStandings,
  generateRoundRobinMatches,
  initializeLeagueSeason,
  saveLeagueSeasonState,
  saveLeagueArchives,
  savePersonalRankings,
  DEFAULT_LEAGUE_DEFS,
  loadCustomLeagueBranding,
  saveCustomLeagueBranding,
} from '../utils/leagueLogic';
import { saveTheIdolsState, saveTheIdolsArchives } from '../utils/theIdolsLogic';
import { isIdolActive } from '../utils/tournamentLogic';
import { getCountryFlag } from '../utils/nationalityHelper';
import { compressImage } from '../utils/imageHelper';
import { LeagueRosterModal } from './LeagueRosterModal';
import { DataMakerPanel } from './DataMakerPanel';
import { DatabaseExportImport } from './studio/DatabaseExportImport';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  RefreshCw,
  RotateCcw,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  Database,
  Trophy,
  Shuffle,
  ArrowRightLeft,
  Trash2,
  Plus,
  Search,
  Sparkles,
  Save,
  Palette,
  Image as ImageIcon,
  Check,
  Shield,
  Star,
  Crown,
  Flame,
  Globe,
  Table,
  Wand2,
} from 'lucide-react';

interface SettingsPanelProps {
  appState: AppState;
  updateConfig: (newConfig: Partial<TournamentConfig>) => void;
  onImportState: (
    newState: AppState,
    newLeagueState?: LeagueSeasonState | null,
    newLeagueArchives?: LeagueSeasonArchive[],
    newTheIdolsState?: TheIdolsSeasonState | null,
    newTheIdolsArchives?: TheIdolsSeasonArchive[]
  ) => void;
  onResetWorkspace: () => void;
  onRestoreDefaultData: () => void;
  onResetCurrentSeason?: () => void;
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  onUpdateLeagueState?: (newState: LeagueSeasonState) => void;
  onUpdateLeagueArchives?: (newArchives: LeagueSeasonArchive[]) => void;
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  onUpdateTheIdolsState?: (newState: TheIdolsSeasonState) => void;
  onUpdateTheIdolsArchives?: (newArchives: TheIdolsSeasonArchive[]) => void;
  onUpdateIdols?: (updatedIdols: Idol[]) => void;
  onUpdateAppState?: (updater: (prev: AppState) => AppState) => void;
  careerStats?: CareerStat[];
  careerOverrides?: CareerOverridesMap;
  onSaveOverrides?: (newOverrides: CareerOverridesMap) => void;
  onRefreshAllStats?: () => void;
}

// Helper to format group letter A..Z, AA..AF
function getGroupLetter(index: number): string {
  let num = index;
  let letter = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    num = Math.floor((num - 1) / 26);
  }
  return letter || 'A';
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  appState,
  updateConfig,
  onImportState,
  onResetWorkspace,
  onRestoreDefaultData,
  onResetCurrentSeason,
  leagueState,
  leagueArchives,
  onUpdateLeagueState,
  onUpdateLeagueArchives,
  theIdolsState,
  theIdolsArchives,
  onUpdateTheIdolsState,
  onUpdateTheIdolsArchives,
  onUpdateIdols,
  onUpdateAppState,
  careerStats,
  careerOverrides,
  onSaveOverrides,
  onRefreshAllStats,
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'general' | 'league_branding' | 'league_roster' | 'data_maker' | 'data'
  >('general');
  const [isRosterModalOpen, setIsRosterModalOpen] = useState<boolean>(false);
  const { config } = appState;
  const activeSeasonNumber = config.seasonNumber || config.seasonId || 1;
  const [seasonName, setSeasonName] = useState<string>(() => {
    return config.seasonName?.trim() || `Season ${activeSeasonNumber}`;
  });
  const [totalParticipants, setTotalParticipants] = useState<number>(
    config.totalParticipants || 64
  );
  const [participantsPerGroup, setParticipantsPerGroup] = useState<number>(
    config.participantsPerGroup || 4
  );
  const [numGroups, setNumGroups] = useState<number>(
    config.numGroups || Math.max(1, Math.floor((config.totalParticipants || 64) / (config.participantsPerGroup || 4)))
  );
  const [qualifiedPerGroup, setQualifiedPerGroup] = useState<2 | 3>(
    config.qualifiedPerGroup || 2
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // League State Reference
  const activeLeagueState: LeagueSeasonState = useMemo(() => {
    if (leagueState && leagueState.leagues && leagueState.leagues.length === 6) {
      const customDefs = appState.customLeagueBranding || loadCustomLeagueBranding();
      const mergedLeagues = leagueState.leagues.map((l) => {
        const c = customDefs.find((item) => item.id === l.id);
        const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === l.id) || DEFAULT_LEAGUE_DEFS[0];
        return {
          ...l,
          name: c?.name || l.name || def.name,
          tierName: c?.tierName || l.tierName || def.tierName,
          color: c?.color || l.color || def.color,
          logoUrl: c?.logoUrl !== undefined ? c.logoUrl : (l.logoUrl || def.logoUrl || ''),
          description: c?.description !== undefined ? c.description : (l.description || def.description || ''),
        };
      });
      return {
        ...leagueState,
        leagues: mergedLeagues,
      };
    }
    return initializeLeagueSeason(appState.idols, appState.girlGroups, 1);
  }, [leagueState, appState.idols, appState.girlGroups, appState.customLeagueBranding]);

  // League Branding & Logo Customization State
  const [leaguesBranding, setLeaguesBranding] = useState<
    Array<{
      id: number;
      name: string;
      tierName: string;
      color: string;
      logoUrl: string;
      description: string;
    }>
  >(() => {
    const customDefs = appState.customLeagueBranding || loadCustomLeagueBranding();
    return [1, 2, 3, 4, 5, 6].map((id) => {
      const customDef = customDefs.find((c) => c.id === id);
      const activeL = (activeLeagueState.leagues || []).find((l) => l.id === id);
      const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === id) || DEFAULT_LEAGUE_DEFS[0];
      return {
        id,
        name: customDef?.name || activeL?.name || def.name,
        tierName: customDef?.tierName || activeL?.tierName || def.tierName,
        color: customDef?.color || activeL?.color || def.color,
        logoUrl: customDef?.logoUrl !== undefined ? customDef.logoUrl : (activeL?.logoUrl || def.logoUrl || ''),
        description: customDef?.description !== undefined ? customDef.description : (activeL?.description || def.description || ''),
      };
    });
  });

  const [selectedBrandingTab, setSelectedBrandingTab] = useState<number>(1);
  const [brandingSavedSuccess, setBrandingSavedSuccess] = useState<boolean>(false);

  // Keep branding in sync with activeLeagueState, custom branding, or external resets
  React.useEffect(() => {
    const customDefs = appState.customLeagueBranding || loadCustomLeagueBranding();
    setLeaguesBranding(
      [1, 2, 3, 4, 5, 6].map((id) => {
        const customDef = customDefs.find((c) => c.id === id);
        const activeL = (activeLeagueState.leagues || []).find((l) => l.id === id);
        const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === id) || DEFAULT_LEAGUE_DEFS[0];
        return {
          id,
          name: customDef?.name || activeL?.name || def.name,
          tierName: customDef?.tierName || activeL?.tierName || def.tierName,
          color: customDef?.color || activeL?.color || def.color,
          logoUrl: customDef?.logoUrl !== undefined ? customDef.logoUrl : (activeL?.logoUrl || def.logoUrl || ''),
          description: customDef?.description !== undefined ? customDef.description : (activeL?.description || def.description || ''),
        };
      })
    );
  }, [activeLeagueState, appState.customLeagueBranding]);

  const [selectedLeagueTab, setSelectedLeagueTab] = useState<number>(1);
  const [rosterSearchQuery, setRosterSearchQuery] = useState<string>('');
  const [editingRosterLeagueId, setEditingRosterLeagueId] = useState<number | null>(null);
  const [rosterTextVal, setRosterTextVal] = useState<string>('');

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    appState.idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [appState.idols]);

  // Sync state if config changes externally (e.g., season change)
  React.useEffect(() => {
    const activeNum = config.seasonNumber || config.seasonId || 1;
    const initialName = config.seasonName?.trim() || `Season ${activeNum}`;
    setSeasonName(initialName);
    const tp = config.totalParticipants || 64;
    const ppg = config.participantsPerGroup || 4;
    const ng = config.numGroups || Math.max(1, Math.floor(tp / ppg));
    setTotalParticipants(tp);
    setParticipantsPerGroup(ppg);
    setNumGroups(ng);
    setQualifiedPerGroup(config.qualifiedPerGroup || 2);
  }, [
    config.seasonName,
    config.seasonId,
    config.seasonNumber,
    config.customTournamentTitle,
    config.totalParticipants,
    config.numGroups,
    config.participantsPerGroup,
    config.qualifiedPerGroup,
  ]);

  const showSuccessMsg = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  // --- LEAGUE BRANDING HANDLERS ---
  const handleUpdateBrandingField = (
    leagueId: number,
    field: 'name' | 'tierName' | 'color' | 'logoUrl' | 'description',
    value: string
  ) => {
    setLeaguesBranding((prev) =>
      prev.map((item) => (item.id === leagueId ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveLeagueBranding = () => {
    // 1. Save globally to custom league branding persistent storage
    saveCustomLeagueBranding(leaguesBranding);

    // 2. Apply to current active season state
    const updatedLeagues: LeagueInfo[] = (activeLeagueState.leagues || []).map((l) => {
      const b = leaguesBranding.find((item) => item.id === l.id);
      if (!b) return l;
      return {
        ...l,
        name: b.name.trim() || l.name,
        tierName: b.tierName.trim() || l.tierName,
        color: b.color || l.color,
        logoUrl: b.logoUrl.trim() || l.logoUrl,
        description: b.description.trim() || l.description,
      };
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) {
      onUpdateLeagueState(newState);
    }
    saveLeagueSeasonState(newState);

    if (onImportState) {
      onImportState(
        {
          ...appState,
          customLeagueBranding: leaguesBranding,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }

    setBrandingSavedSuccess(true);
    showSuccessMsg('League names, logos, and branding saved successfully and persisted across refreshes!');
    setTimeout(() => setBrandingSavedSuccess(false), 3000);
  };

  const handleResetLeagueBranding = () => {
    if (!window.confirm('Reset all 6 leagues to default names, tier titles, colors, and logos?')) {
      return;
    }
    saveCustomLeagueBranding(DEFAULT_LEAGUE_DEFS);
    const defaultBranding = DEFAULT_LEAGUE_DEFS.map((def) => ({
      id: def.id,
      name: def.name,
      tierName: def.tierName,
      color: def.color,
      logoUrl: def.logoUrl || '',
      description: def.description || '',
    }));
    setLeaguesBranding(defaultBranding);

    const updatedLeagues: LeagueInfo[] = (activeLeagueState.leagues || []).map((l) => {
      const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === l.id) || DEFAULT_LEAGUE_DEFS[0];
      return {
        ...l,
        name: def.name,
        tierName: def.tierName,
        color: def.color,
        logoUrl: def.logoUrl,
        description: def.description,
      };
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) {
      onUpdateLeagueState(newState);
    }
    saveLeagueSeasonState(newState);

    if (onImportState) {
      onImportState(
        {
          ...appState,
          customLeagueBranding: DEFAULT_LEAGUE_DEFS,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }

    showSuccessMsg('Reset all leagues to default branding!');
  };

  const handleBrandingLogoUpload = async (leagueId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 300, 300, 0.88);
      handleUpdateBrandingField(leagueId, 'logoUrl', compressed);
      showSuccessMsg(`Division #${leagueId} logo uploaded and updated! Click "Save League Branding" to persist.`);
    } catch {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (dataUrl) {
          handleUpdateBrandingField(leagueId, 'logoUrl', dataUrl);
          showSuccessMsg(`Division #${leagueId} logo uploaded! Click "Save League Branding" to persist.`);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset file input target value so selecting the same file again triggers change
    e.target.value = '';
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const finalGroups = Math.max(1, numGroups);
    const finalPpg = Math.max(2, participantsPerGroup);
    const finalParticipants = finalGroups * finalPpg;

    updateConfig({
      seasonName,
      customTournamentTitle: seasonName,
      totalParticipants: finalParticipants,
      numGroups: finalGroups,
      participantsPerGroup: finalPpg,
      qualifiedPerGroup,
    });
    setSavedSuccess(true);
    showSuccessMsg('Tournament parameters successfully saved and updated across all panels!');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // --- LEAGUE ROSTER ACTIONS ---
  const handleSaveAllRosterChanges = () => {
    const updatedLeagues = activeLeagueState.leagues.map((l) => {
      const matches =
        l.matches && l.matches.length > 0
          ? l.matches
          : generateRoundRobinMatches(l.id, l.memberIds);
      const standings = calculateLeagueStandings(l.id, l.memberIds, matches, appState.idols);
      return {
        ...l,
        matches,
        standings,
      };
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);
    if (onImportState) {
      onImportState(
        {
          ...appState,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }
    showSuccessMsg('All 6 league rosters successfully saved, updated, and permanently persisted!');
  };

  const handleMoveIdolToLeague = (idolId: string, fromLeagueId: number, toLeagueId: number) => {
    if (fromLeagueId === toLeagueId) return;

    const updatedLeagues = activeLeagueState.leagues.map((l) => {
      let newMembers = [...l.memberIds];
      if (l.id === fromLeagueId) {
        newMembers = newMembers.filter((id) => id !== idolId);
      } else if (l.id === toLeagueId) {
        if (!newMembers.includes(idolId)) {
          newMembers.push(idolId);
        }
      }

      const matches = generateRoundRobinMatches(l.id, newMembers);
      const standings = calculateLeagueStandings(l.id, newMembers, matches, appState.idols);

      return {
        ...l,
        memberIds: newMembers,
        matches,
        standings,
      };
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);
    if (onImportState) {
      onImportState(
        {
          ...appState,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }
  };

  const handleAddIdolToActiveLeague = (idolId: string) => {
    const activeL = activeLeagueState.leagues.find((l) => l.id === selectedLeagueTab);
    if (!activeL) return;

    if (activeL.memberIds.includes(idolId)) {
      showSuccessMsg('This idol is already assigned to this division.');
      return;
    }

    const updatedLeagues = activeLeagueState.leagues.map((l) => {
      let newMembers = l.memberIds.filter((id) => id !== idolId);
      if (l.id === selectedLeagueTab) {
        newMembers.push(idolId);
      }
      const matches = generateRoundRobinMatches(l.id, newMembers);
      const standings = calculateLeagueStandings(l.id, newMembers, matches, appState.idols);
      return {
        ...l,
        memberIds: newMembers,
        matches,
        standings,
      };
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);
    if (onImportState) {
      onImportState(
        {
          ...appState,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }
  };

  const handleRemoveIdolFromLeague = (leagueId: number, idolId: string) => {
    const updatedLeagues = activeLeagueState.leagues.map((l) => {
      if (l.id === leagueId) {
        const newMembers = l.memberIds.filter((id) => id !== idolId);
        const matches = generateRoundRobinMatches(l.id, newMembers);
        const standings = calculateLeagueStandings(l.id, newMembers, matches, appState.idols);
        return {
          ...l,
          memberIds: newMembers,
          matches,
          standings,
        };
      }
      return l;
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);
    if (onImportState) {
      onImportState(
        {
          ...appState,
          customLeagueBranding: leaguesBranding,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }
  };

  const handleOpenEditRoster = (leagueId: number) => {
    const l = activeLeagueState.leagues.find((x) => x.id === leagueId);
    if (!l) return;
    const names = l.memberIds.map((id) => idolsMap.get(id)?.name || id);
    setRosterTextVal(names.join('\n'));
    setEditingRosterLeagueId(leagueId);
  };

  const handleSaveRosterText = (leagueId: number) => {
    const rawNames = rosterTextVal
      .split('\n')
      .flatMap((line) => (line.includes(',') ? line.split(',') : [line]))
      .map((n) => n.replace(/^[0-9]+[.\-)]\s*/, '').trim())
      .filter(Boolean);

    // Map names to idol IDs, creating any new idols if they don't exist
    const existingNamesMap = new Map<string, Idol>();
    appState.idols.forEach((i) => existingNamesMap.set(i.name.trim().toLowerCase(), i));

    const newMemberIds: string[] = [];
    const createdIdols: Idol[] = [];
    const seenIds = new Set<string>();

    rawNames.forEach((name) => {
      const lower = name.toLowerCase();
      let idolId = '';
      if (existingNamesMap.has(lower)) {
        idolId = existingNamesMap.get(lower)!.id;
      } else {
        const newIdol: Idol = {
          id: `idol-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name,
          girlGroup: 'Solo / Independent',
          seed: 'Seed 3',
          nationality: 'South Korea',
          photoUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          createdAt: Date.now(),
        };
        createdIdols.push(newIdol);
        existingNamesMap.set(lower, newIdol);
        idolId = newIdol.id;
      }

      if (idolId && !seenIds.has(idolId) && newMemberIds.length < 20) {
        seenIds.add(idolId);
        newMemberIds.push(idolId);
      }
    });

    const allCombinedIdols = [...appState.idols, ...createdIdols];

    const updatedLeagues = activeLeagueState.leagues.map((l) => {
      if (l.id === leagueId) {
        const matches = generateRoundRobinMatches(l.id, newMemberIds);
        const standings = calculateLeagueStandings(
          l.id,
          newMemberIds,
          matches,
          allCombinedIdols
        );
        return {
          ...l,
          memberIds: newMemberIds,
          matches,
          standings,
        };
      }
      // Remove newly assigned idols from other leagues so there are no duplicates
      const filteredMembers = l.memberIds.filter((id) => !newMemberIds.includes(id));
      if (filteredMembers.length !== l.memberIds.length) {
        const matches = generateRoundRobinMatches(l.id, filteredMembers);
        const standings = calculateLeagueStandings(l.id, filteredMembers, matches, allCombinedIdols);
        return {
          ...l,
          memberIds: filteredMembers,
          matches,
          standings,
        };
      }
      return l;
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);

    if (onImportState) {
      onImportState(
        {
          ...appState,
          customLeagueBranding: leaguesBranding,
          idols: allCombinedIdols,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }

    setEditingRosterLeagueId(null);
    showSuccessMsg(`Roster updated for Division #${leagueId} (${newMemberIds.length} idols)!`);
  };

  const handleClearLeagueRoster = (leagueId: number) => {
    const updatedLeagues = activeLeagueState.leagues.map((l) => {
      if (l.id === leagueId) {
        return {
          ...l,
          memberIds: [],
          matches: [],
          standings: [],
        };
      }
      return l;
    });

    const newState: LeagueSeasonState = {
      ...activeLeagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);
    if (onImportState) {
      onImportState(
        {
          ...appState,
          customLeagueBranding: leaguesBranding,
          leagueState: newState,
        },
        newState,
        appState.leagueArchives
      );
    }
    showSuccessMsg(`Cleared roster for Division #${leagueId} (0 members)`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          alert('Invalid JSON file format.');
          return;
        }

        // Case 1: Idol Roster Only
        if (
          parsed.type === 'idol_roster_only' ||
          parsed.type === 'idol_roster_database' ||
          (parsed.idols && !parsed.config && !parsed.tournamentArchives && !parsed.archives)
        ) {
          const updatedState: AppState = {
            ...appState,
            idols: parsed.idols || appState.idols,
            girlGroups: parsed.girlGroups || appState.girlGroups,
          };
          onImportState(updatedState);
          showSuccessMsg(`Successfully imported Idol Roster (${(parsed.idols || []).length} idols)!`);
          alert(`Successfully imported Idol Roster (${(parsed.idols || []).length} idols) without affecting historical stats!`);
          return;
        }

        // Case 2: Historical Stats & Archives Only
        if (parsed.type === 'historical_stats_and_archives_database') {
          const newArchives = Array.isArray(parsed.tournamentArchives)
            ? parsed.tournamentArchives
            : Array.isArray(parsed.archives)
            ? parsed.archives
            : appState.archives;
          const newLeagueArchives = Array.isArray(parsed.leagueArchives)
            ? parsed.leagueArchives
            : (leagueArchives || []);
          const newTheIdolsArchives = Array.isArray(parsed.theIdolsArchives)
            ? parsed.theIdolsArchives
            : (appState.theIdolsArchives || []);
          saveLeagueArchives(newLeagueArchives);
          saveTheIdolsArchives(newTheIdolsArchives);
          if (onUpdateLeagueArchives) onUpdateLeagueArchives(newLeagueArchives);
          onImportState(
            {
              ...appState,
              archives: newArchives,
              theIdolsArchives: newTheIdolsArchives,
            },
            undefined,
            newLeagueArchives
          );
          showSuccessMsg('Historical tournament, league & The Idols archives restored successfully!');
          alert('Historical Tournament, League & The Idols Archives restored successfully!');
          return;
        }

        // Case 3: League Permanent Database
        if (parsed.type === 'league_permanent_database') {
          if (parsed.activeSeason) {
            saveLeagueSeasonState(parsed.activeSeason);
            if (onUpdateLeagueState) onUpdateLeagueState(parsed.activeSeason);
          }
          if (Array.isArray(parsed.historicalArchives)) {
            saveLeagueArchives(parsed.historicalArchives);
            if (onUpdateLeagueArchives) onUpdateLeagueArchives(parsed.historicalArchives);
          }
          if (Array.isArray(parsed.brandingAndLogos)) {
            saveCustomLeagueBranding(parsed.brandingAndLogos);
            setLeaguesBranding(parsed.brandingAndLogos);
          }
          showSuccessMsg('League System database restored successfully!');
          alert('League System database (Rosters, Active Fixtures, Standings, & Archives) restored successfully!');
          return;
        }

        // Case 4: The Idols Superleague Database
        if (parsed.type === 'the_idols_superleague_database') {
          const tiState = parsed.theIdolsState || null;
          const tiArchives = Array.isArray(parsed.theIdolsArchives) ? parsed.theIdolsArchives : [];
          if (tiState) {
            saveTheIdolsState(tiState);
          }
          saveTheIdolsArchives(tiArchives);
          if (onUpdateTheIdolsState && tiState) onUpdateTheIdolsState(tiState);
          if (onUpdateTheIdolsArchives) onUpdateTheIdolsArchives(tiArchives);
          onImportState(
            {
              ...appState,
              theIdolsState: tiState,
              theIdolsArchives: tiArchives,
            },
            leagueState,
            leagueArchives,
            tiState,
            tiArchives
          );
          showSuccessMsg('The Idols Superleague database restored successfully!');
          alert('The Idols Superleague database (Active Season & Historical Archives) restored successfully!');
          return;
        }

        // Case 5: Personal Idol Rankings Database
        if (
          parsed.type === 'personal_idol_rankings_database' &&
          Array.isArray(parsed.personalRankings)
        ) {
          savePersonalRankings(parsed.personalRankings);
          onImportState({
            ...appState,
            personalRankings: parsed.personalRankings,
          });
          showSuccessMsg(`Personal Idol Rankings (${parsed.personalRankings.length} rankings) restored!`);
          alert(`Personal Idol Rankings (${parsed.personalRankings.length} rankings) restored successfully!`);
          return;
        }

        // Case 6: Full State / App Database Backup (v1 without leagues OR v2 with leagues/theIdols)
        if (
          parsed.idols ||
          parsed.config ||
          parsed.matchDatabase ||
          parsed.exportVersion ||
          parsed.archives
        ) {
          // Normalize with isFullRestore = true to cleanly replace everything and prevent ghost data
          const normalized = normalizeAppState(parsed, true);

          if (onUpdateLeagueState && normalized.leagueState) {
            onUpdateLeagueState(normalized.leagueState);
          }
          if (onUpdateLeagueArchives && normalized.leagueArchives) {
            onUpdateLeagueArchives(normalized.leagueArchives);
          }
          if (normalized.customLeagueBranding) {
            setLeaguesBranding(normalized.customLeagueBranding);
          }
          if (normalized.theIdolsState) {
            saveTheIdolsState(normalized.theIdolsState);
          }
          if (normalized.theIdolsArchives) {
            saveTheIdolsArchives(normalized.theIdolsArchives);
          }
          if (onUpdateTheIdolsState && normalized.theIdolsState) {
            onUpdateTheIdolsState(normalized.theIdolsState);
          }
          if (onUpdateTheIdolsArchives && normalized.theIdolsArchives) {
            onUpdateTheIdolsArchives(normalized.theIdolsArchives);
          }

          onImportState(
            normalized,
            normalized.leagueState,
            normalized.leagueArchives,
            normalized.theIdolsState,
            normalized.theIdolsArchives
          );
          showSuccessMsg('Full master database restored from JSON backup!');
          alert('Full database and state (including Idol Database, Tournament Archives, The Idols, Personal Rankings, and League Systems) successfully restored from JSON!');
          return;
        }

        alert('Invalid backup or roster file format.');
      } catch (err) {
        console.error('Failed to parse JSON file:', err);
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2 font-poster-title">
            <SettingsIcon className="h-6 w-6 text-amber-400" />
            <span>Tournament &amp; System Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure tournament size, group allocations, league division rosters, and backup exports.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-2xl bg-black/60 p-1.5 border border-black poster-shadow-sm flex-wrap gap-1">
          <button
            onClick={() => setActiveSettingsTab('general')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeSettingsTab === 'general'
                ? 'bg-amber-500 text-black font-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Tournament Parameters</span>
          </button>
          <button
            onClick={() => setActiveSettingsTab('league_branding')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeSettingsTab === 'league_branding'
                ? 'bg-amber-500 text-black font-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>League Names &amp; Logos</span>
          </button>
          <button
            onClick={() => setActiveSettingsTab('league_roster')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeSettingsTab === 'league_roster'
                ? 'bg-amber-500 text-black font-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>League Roster Manager</span>
          </button>
          <button
            onClick={() => setActiveSettingsTab('data_maker')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeSettingsTab === 'data_maker'
                ? 'bg-amber-500 text-black font-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Data Maker &amp; Pot Draw</span>
          </button>
          <button
            onClick={() => setActiveSettingsTab('data')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeSettingsTab === 'data'
                ? 'bg-amber-500 text-black font-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Permanent Download &amp; Upload</span>
          </button>
        </div>
      </div>

      {/* TAB: LEAGUE BRANDING & LOGOS */}
      {activeSettingsTab === 'league_branding' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="rounded-3xl border-2 border-black bg-[#18110b] p-6 poster-shadow flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-poster-title text-xl text-amber-400 flex items-center gap-2">
                <Palette className="w-6 h-6 text-amber-400" />
                <span>LEAGUE BRANDING &amp; LOGOS</span>
              </h3>
              <p className="text-xs text-amber-200/70 font-semibold mt-0.5">
                Customize the name, division title, custom logo / picture, theme color, and description for each of the 6 leagues.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => exportLeagueBrandingToJSON(leaguesBranding)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2a1d14] hover:bg-[#38261b] border-2 border-black text-amber-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                title="Download 6-League custom branding names, colors, and logos to JSON"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download Branding JSON</span>
              </button>

              <button
                type="button"
                onClick={handleResetLeagueBranding}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2a1d14] hover:bg-[#38261b] border-2 border-black text-amber-300/80 hover:text-white text-xs font-bold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>

              <button
                type="button"
                onClick={handleSaveLeagueBranding}
                className="flex items-center gap-2 px-5 py-2 rounded-xl poster-pill-gold text-amber-950 font-poster-title text-xs font-black shadow-lg hover:scale-105 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save League Branding</span>
              </button>
            </div>
          </div>

          {/* Division Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {leaguesBranding.map((b) => {
              const isSelected = b.id === selectedBrandingTab;
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setSelectedBrandingTab(b.id)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all relative ${
                    isSelected
                      ? 'border-amber-400 bg-[#261a11] ring-2 ring-amber-400/40 shadow-lg'
                      : 'border-black bg-[#140e0a] hover:bg-[#1c130d] text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="w-3 h-3 rounded-full border border-black shadow-sm"
                      style={{ backgroundColor: b.color }}
                    />
                    {b.logoUrl ? (
                      <img
                        src={b.logoUrl}
                        alt={b.name}
                        className="w-6 h-6 rounded-md object-cover border border-black"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Shield className="w-5 h-5 text-amber-400/60" />
                    )}
                  </div>
                  <div className="font-poster-title text-xs sm:text-sm font-black truncate text-white">
                    {b.name}
                  </div>
                  <div className="text-[10px] text-amber-400/70 font-bold truncate">
                    {b.tierName}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active League Branding Editor */}
          {(() => {
            const currentBranding = leaguesBranding.find((b) => b.id === selectedBrandingTab);
            if (!currentBranding) return null;

            const presetColors = [
              '#3b82f6', // Blue
              '#f97316', // Orange
              '#06b6d4', // Cyan
              '#ef4444', // Red
              '#8b5cf6', // Purple
              '#eab308', // Gold
              '#10b981', // Emerald
              '#ec4899', // Pink
              '#14b8a6', // Teal
              '#6366f1', // Indigo
            ];

            const presetLogos = [
              {
                label: 'Premier Gold Crest',
                url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80',
              },
              {
                label: 'Golden Trophy',
                url: 'https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=150&auto=format&fit=crop&q=80',
              },
              {
                label: 'Blue Star Shield',
                url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80',
              },
              {
                label: 'Neon Flame',
                url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150&auto=format&fit=crop&q=80',
              },
              {
                label: 'Crown Emblem',
                url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
              },
              {
                label: 'Diamond Crest',
                url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=150&auto=format&fit=crop&q=80',
              },
            ];

            return (
              <div className="rounded-3xl border-2 border-black bg-[#16100b] p-6 poster-shadow space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-black shadow-md text-white font-poster-title font-black text-base"
                      style={{ backgroundColor: currentBranding.color }}
                    >
                      D{currentBranding.id}
                    </div>
                    <div>
                      <h4 className="font-poster-title text-xl text-white">
                        {currentBranding.name}
                      </h4>
                      <p className="text-xs text-amber-300/80 font-bold">
                        Division {currentBranding.id} &bull; {currentBranding.tierName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveLeagueBranding}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl poster-pill-gold text-amber-950 font-poster-title text-xs font-black shadow hover:scale-105 transition-transform"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Name, Subtitle, Description & Color */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                        League Name
                      </label>
                      <input
                        type="text"
                        value={currentBranding.name}
                        onChange={(e) =>
                          handleUpdateBrandingField(currentBranding.id, 'name', e.target.value)
                        }
                        placeholder="e.g. Idol Premier League"
                        className="w-full rounded-xl border-2 border-black bg-[#110c08] px-4 py-2.5 text-sm font-poster-title text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 poster-shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                        Division / Tier Subtitle
                      </label>
                      <input
                        type="text"
                        value={currentBranding.tierName}
                        onChange={(e) =>
                          handleUpdateBrandingField(currentBranding.id, 'tierName', e.target.value)
                        }
                        placeholder="e.g. Tier 1 Top Flight"
                        className="w-full rounded-xl border-2 border-black bg-[#110c08] px-4 py-2.5 text-sm font-poster-body text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 poster-shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                        League Description / Tagline
                      </label>
                      <textarea
                        value={currentBranding.description}
                        onChange={(e) =>
                          handleUpdateBrandingField(currentBranding.id, 'description', e.target.value)
                        }
                        rows={3}
                        placeholder="e.g. The premier championship division featuring the top seeded idols."
                        className="w-full rounded-xl border-2 border-black bg-[#110c08] p-3 text-xs font-poster-body text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 poster-shadow-sm resize-none custom-scrollbar"
                      />
                    </div>

                    {/* Theme Color */}
                    <div>
                      <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                        Theme Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={currentBranding.color}
                          onChange={(e) =>
                            handleUpdateBrandingField(currentBranding.id, 'color', e.target.value)
                          }
                          className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-2 border-black p-0.5"
                        />
                        <input
                          type="text"
                          value={currentBranding.color}
                          onChange={(e) =>
                            handleUpdateBrandingField(currentBranding.id, 'color', e.target.value)
                          }
                          className="w-28 rounded-xl border-2 border-black bg-[#110c08] px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        {/* Swatches */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {presetColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() =>
                                handleUpdateBrandingField(currentBranding.id, 'color', color)
                              }
                              className={`w-6 h-6 rounded-lg border-2 transition-transform ${
                                currentBranding.color.toLowerCase() === color.toLowerCase()
                                  ? 'border-white scale-110 shadow-md ring-1 ring-amber-400'
                                  : 'border-black hover:scale-105'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Logo URL, Upload & Live Preview */}
                  <div className="space-y-4 bg-[#1e150f] p-5 rounded-2xl border-2 border-black poster-shadow">
                    <h5 className="font-poster-title text-sm text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                      <span>League Logo &amp; Picture</span>
                    </h5>

                    {/* Live Preview Display */}
                    <div className="flex items-center gap-4 bg-[#120c08] p-3.5 rounded-2xl border-2 border-black">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 flex-shrink-0 relative shadow-md"
                        style={{ borderColor: currentBranding.color }}
                      >
                        {currentBranding.logoUrl ? (
                          <img
                            src={currentBranding.logoUrl}
                            alt={currentBranding.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80';
                            }}
                          />
                        ) : (
                          <Shield
                            className="w-8 h-8"
                            style={{ color: currentBranding.color }}
                          />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="font-poster-title text-base font-black text-white truncate">
                          {currentBranding.name}
                        </div>
                        <div
                          className="text-xs font-bold truncate"
                          style={{ color: currentBranding.color }}
                        >
                          {currentBranding.tierName}
                        </div>
                        <div className="text-[10px] text-amber-200/60 font-semibold truncate mt-0.5">
                          {currentBranding.description || 'No description provided'}
                        </div>
                      </div>
                    </div>

                    {/* Logo URL Input */}
                    <div>
                      <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                        Logo Image URL
                      </label>
                      <input
                        type="url"
                        value={currentBranding.logoUrl}
                        onChange={(e) =>
                          handleUpdateBrandingField(currentBranding.id, 'logoUrl', e.target.value)
                        }
                        placeholder="https://example.com/league-logo.png"
                        className="w-full rounded-xl border-2 border-black bg-[#110c08] px-4 py-2.5 text-xs font-mono text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 poster-shadow-sm"
                      />
                    </div>

                    {/* File Upload Option */}
                    <div>
                      <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                        Or Upload Picture from Computer
                      </label>
                      <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl border-2 border-dashed border-amber-500/50 bg-[#120c08] hover:bg-[#1a110b] cursor-pointer transition-colors text-xs font-bold text-amber-300">
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>Choose Image File (PNG, JPG, WebP)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBrandingLogoUpload(currentBranding.id, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Quick Preset Logos */}
                    <div>
                      <label className="block text-[11px] font-bold text-amber-200/70 uppercase tracking-wider mb-1.5">
                        Quick Preset Logos:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {presetLogos.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              handleUpdateBrandingField(currentBranding.id, 'logoUrl', preset.url)
                            }
                            className="flex items-center gap-1.5 p-1.5 rounded-xl border border-black bg-[#140e0a] hover:bg-[#221710] text-[10px] font-bold text-amber-200/90 transition-all truncate"
                          >
                            {preset.url ? (
                              <img
                                src={preset.url}
                                alt={preset.label}
                                className="w-4 h-4 rounded object-cover flex-shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            )}
                            <span className="truncate">{preset.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 1: GENERAL TOURNAMENT SETTINGS */}
      {activeSettingsTab === 'general' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
          <h3 className="font-extrabold text-lg text-white mb-4">
            Tournament Parameters
          </h3>

          <form onSubmit={handleSaveConfig} className="space-y-6">
            {/* Tournament Name Input */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-2">
              <label className="block text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Tournament / Season Name
              </label>
              <input
                type="text"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="e.g. Season 2, Idol Grand Prix 2026"
                className="w-full rounded-xl border border-indigo-500/40 bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              />
              <p className="text-[11px] text-slate-400">
                Change the title of your active tournament at any time. It will be recorded with match databases and archives.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Participants */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Total Participants
                </label>
                <select
                  value={totalParticipants}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setTotalParticipants(val);
                    setNumGroups(Math.max(1, Math.floor(val / participantsPerGroup)));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={16}>16 Participants</option>
                  <option value={24}>24 Participants</option>
                  <option value={32}>32 Participants</option>
                  <option value={48}>48 Participants</option>
                  <option value={64}>64 Participants</option>
                  <option value={80}>80 Participants</option>
                  <option value={96}>96 Participants</option>
                  <option value={128}>128 Participants</option>
                  <option value={160}>160 Participants</option>
                  <option value={192}>192 Participants</option>
                  <option value={256}>256 Participants</option>
                </select>
              </div>

              {/* Participants per Group */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Participants per Group
                </label>
                <select
                  value={participantsPerGroup}
                  onChange={(e) => {
                    const ppg = parseInt(e.target.value, 10);
                    setParticipantsPerGroup(ppg);
                    setNumGroups(Math.max(1, Math.floor(totalParticipants / ppg)));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={4}>4 per Group</option>
                  <option value={6}>6 per Group</option>
                  <option value={8}>8 per Group</option>
                </select>
              </div>

              {/* Total Groups */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Total Groups
                </label>
                <select
                  value={numGroups}
                  onChange={(e) => {
                    const ng = parseInt(e.target.value, 10);
                    setNumGroups(ng);
                    setTotalParticipants(ng * participantsPerGroup);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={4}>4 Groups (A to D)</option>
                  <option value={8}>8 Groups (A to H)</option>
                  <option value={12}>12 Groups (A to L)</option>
                  <option value={16}>16 Groups (A to P)</option>
                  <option value={20}>20 Groups (A to T)</option>
                  <option value={24}>24 Groups (A to X)</option>
                  <option value={32}>32 Groups (A to AF)</option>
                  <option value={40}>40 Groups (A to AN)</option>
                  <option value={48}>48 Groups (A to AV)</option>
                  <option value={64}>64 Groups (A to BL)</option>
                </select>
              </div>

              {/* Qualifiers per Group */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Qualifiers per Group
                </label>
                <select
                  value={qualifiedPerGroup}
                  onChange={(e) =>
                    setQualifiedPerGroup(parseInt(e.target.value, 10) as 2 | 3)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={2}>Top 2 Qualify (32-slot Direct Bracket)</option>
                  <option value={3}>
                    Top 3 Qualify (Play-In Round + R32 Bye for Group Winners)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-400">
                Note: Changing these settings dynamically updates the Group Stage &amp; Knockout Bracket layouts.
              </p>
              <div className="flex items-center gap-3">
                {savedSuccess && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle className="h-4 w-4" /> Saved Successfully!
                  </span>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: LEAGUE ROSTER MANAGER (6 Leagues • 20 Idols Each) */}
      {activeSettingsTab === 'league_roster' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="rounded-3xl border-2 border-black bg-[#18110b] p-6 poster-shadow flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-poster-title text-xl text-amber-400 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" />
                <span>LEAGUE ROSTER MANAGER</span>
              </h3>
              <p className="text-xs text-amber-200/70 font-semibold">
                Manage, transfer, or distribute idol rosters across the 6 football-style divisions (20 idols per league).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    const jsonStr = exportLeagueBrandingAndRosters(activeLeagueState, appState.idols, appState.customLeagueBranding);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `sabung_league_rosters_and_branding_${new Date().toISOString().split('T')[0]}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                    showSuccessMsg('League rosters & branding exported successfully!');
                  } catch (err: any) {
                    alert(`Failed to export league rosters: ${err?.message || 'Unknown error'}`);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2a1d14] hover:bg-[#38261b] border-2 border-black text-amber-300 font-poster-title text-xs font-black shadow transition-all cursor-pointer"
                title="Download complete 6-League custom branding with all 20-idol rosters (120 idols total)"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download Rosters &amp; Branding JSON</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAllRosterChanges}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl poster-pill-gold text-amber-950 font-poster-title text-xs font-black shadow-lg hover:scale-105 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save All League Rosters</span>
              </button>
              <button
                type="button"
                onClick={() => setIsRosterModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2a1d14] hover:bg-[#38261b] border-2 border-black text-amber-300 font-poster-title text-xs font-black shadow transition-all cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Open Full Roster Manager &amp; Batch Editor</span>
              </button>
            </div>
          </div>

          {/* Division Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(activeLeagueState?.leagues || []).map((l) => {
              const count = l.memberIds?.length || 0;
              const isSelected = l.id === selectedLeagueTab;
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => setSelectedLeagueTab(l.id)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all relative ${
                    isSelected
                      ? 'border-amber-400 bg-[#24170e] ring-2 ring-amber-400/30'
                      : 'border-black bg-[#140e0a] hover:bg-[#1c130d] text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        count === 20 ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'
                      }`}
                    >
                      {count}/20
                    </span>
                  </div>
                  <div className="font-poster-title text-xs sm:text-sm font-black truncate text-white">
                    {l.name}
                  </div>
                  <div className="text-[10px] text-amber-400/70 font-bold truncate">
                    {l.tierName}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active League Roster Grid & Transfer Pool */}
          {(() => {
            const currentLeague = (activeLeagueState?.leagues || []).find((l) => l.id === selectedLeagueTab);
            if (!currentLeague) return null;

            return (
              <div className="rounded-3xl border-2 border-black bg-[#16100b] p-5 sm:p-6 poster-shadow space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
                  <div>
                    <h4 className="font-poster-title text-lg text-white flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: currentLeague.color }}
                      />
                      <span>{currentLeague.name} Roster</span>
                      <span className="text-xs text-amber-400 font-mono font-bold">
                        ({currentLeague.memberIds?.length || 0}/20 Idols Assigned)
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 font-medium">
                      Select a target league from the dropdown on any idol card to transfer them instantly.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditRoster(currentLeague.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Edit / Paste Roster (20 Idols)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearLeagueRoster(currentLeague.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Roster</span>
                    </button>
                    <input
                      type="text"
                      value={rosterSearchQuery}
                      onChange={(e) => setRosterSearchQuery(e.target.value)}
                      placeholder="Search active idols..."
                      className="bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Grid of 20 Members */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(currentLeague.memberIds || []).map((idolId, idx) => {
                    const idol = idolsMap.get(idolId);

                    return (
                      <div
                        key={`${idolId}_${idx}`}
                        className="p-3 rounded-2xl border-2 border-black bg-[#120e0a] hover:border-slate-700 transition-all flex flex-col justify-between gap-2 shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl border border-black bg-black overflow-hidden shrink-0 shadow">
                            {idol?.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-xs text-amber-300 bg-black">
                                {idol?.name?.slice(0, 2) || 'ID'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="font-poster-title text-xs text-white truncate font-bold">
                                {idol?.name || 'Unknown'}
                              </span>
                              {idol?.nationality && (
                                <span className="text-[10px] shrink-0">
                                  {getCountryFlag(idol.nationality)}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] font-bold text-amber-400/80 truncate">
                              {idol?.girlGroup} &bull; {idol?.seed}
                            </div>
                          </div>
                        </div>

                        {/* Transfer / Move Dropdown & Remove Button */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/60">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                            <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                            <span>Move to:</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleMoveIdolToLeague(
                                    idolId,
                                    currentLeague.id,
                                    parseInt(e.target.value, 10)
                                  );
                                }
                              }}
                              className="bg-black border border-slate-700 rounded-lg px-2 py-0.5 text-[10px] text-amber-300 font-bold"
                            >
                              <option value="">Transfer League...</option>
                              {activeLeagueState.leagues
                                .filter((l) => l.id !== currentLeague.id)
                                .map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveIdolFromLeague(currentLeague.id, idolId)}
                              title="Remove from league"
                              className="p-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Available Idols Pool to Add */}
                <div className="mt-6 pt-4 border-t border-black space-y-3">
                  <h5 className="font-poster-title text-sm text-amber-400 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Quick Add Idol to {currentLeague.name}</span>
                  </h5>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-black/40 rounded-2xl border border-black">
                    {appState.idols
                      .filter(
                        (i) =>
                          !currentLeague.memberIds.includes(i.id) &&
                          (rosterSearchQuery
                            ? i.name.toLowerCase().includes(rosterSearchQuery.toLowerCase()) ||
                              i.girlGroup.toLowerCase().includes(rosterSearchQuery.toLowerCase())
                            : true)
                      )
                      .slice(0, 30)
                      .map((idol) => (
                        <button
                          type="button"
                          key={idol.id}
                          onClick={() => handleAddIdolToActiveLeague(idol.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-amber-500 hover:text-black border border-slate-700 text-slate-300 text-xs font-bold transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{idol.name}</span>
                          <span className="text-[9px] opacity-70">({idol.girlGroup})</span>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Modal for Batch Paste / Editing Roster */}
          {editingRosterLeagueId !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-3xl border-2 border-black bg-[#18110b] p-6 poster-shadow space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-3">
                  <h4 className="font-poster-title text-base text-amber-400">
                    Edit / Paste Roster for Division #{editingRosterLeagueId}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setEditingRosterLeagueId(null)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-slate-300 font-medium">
                  Paste up to 20 idol names (one name per line). Any name that doesn't exist yet in the database will be automatically created.
                </p>

                <textarea
                  rows={10}
                  value={rosterTextVal}
                  onChange={(e) => setRosterTextVal(e.target.value)}
                  placeholder="Paste idol names here, one per line..."
                  className="w-full rounded-xl border border-slate-700 bg-black p-3 font-mono text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                <div className="flex items-center justify-between pt-2 border-t border-black">
                  <span className="text-[11px] font-bold text-slate-400">
                    {rosterTextVal.split('\n').filter((x) => x.trim()).length} names listed
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRosterLeagueId(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveRosterText(editingRosterLeagueId)}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow"
                    >
                      Save Division Roster
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: DATA MAKER & POT DRAW GENERATOR */}
      {activeSettingsTab === 'data_maker' && (
        <DataMakerPanel
          idols={appState.idols}
          leagueState={activeLeagueState}
          leagueArchives={leagueArchives}
          customLeagueBranding={leaguesBranding}
          onUpdateLeagueState={onUpdateLeagueState}
          onImportState={onImportState}
          appState={appState}
        />
      )}

      {/* TAB 3: DATA BACKUP, PERMANENT DOWNLOAD & UPLOAD, AND DANGER ZONE */}
      {activeSettingsTab === 'data' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <DatabaseExportImport
            appState={appState}
            leagueState={leagueState || null}
            leagueArchives={leagueArchives || []}
            theIdolsState={theIdolsState || null}
            theIdolsArchives={theIdolsArchives || []}
            overrides={careerOverrides || {}}
            careerStats={careerStats || []}
            onUpdateAppState={(updater) => {
              if (onUpdateAppState) {
                onUpdateAppState(updater);
              } else {
                const next = updater(appState);
                onImportState(next, leagueState, leagueArchives, theIdolsState, theIdolsArchives);
              }
            }}
            onUpdateLeagueState={(newState) => {
              if (onUpdateLeagueState) onUpdateLeagueState(newState);
              saveLeagueSeasonState(newState);
            }}
            onUpdateLeagueArchives={(newArchives) => {
              if (onUpdateLeagueArchives) onUpdateLeagueArchives(newArchives);
              saveLeagueArchives(newArchives);
            }}
            onUpdateTheIdolsState={(newState) => {
              if (onUpdateTheIdolsState && newState) onUpdateTheIdolsState(newState);
              if (newState) saveTheIdolsState(newState);
            }}
            onUpdateTheIdolsArchives={(newArchives) => {
              if (onUpdateTheIdolsArchives) onUpdateTheIdolsArchives(newArchives);
              saveTheIdolsArchives(newArchives);
            }}
            onSaveOverrides={onSaveOverrides}
            onRefreshAllStats={onRefreshAllStats}
            showToast={(msg, type) => {
              showSuccessMsg(msg);
            }}
          />

          {/* Dangerous Actions */}
          <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <div>
                <h4 className="font-extrabold text-base text-white">System Danger Zone</h4>
                <p className="text-xs text-slate-400">
                  Actions below affect active tournament workspace or reset sample datasets.
                </p>
              </div>
            </div>

            {onResetCurrentSeason && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-red-500/20 pt-4">
                <div>
                  <span className="text-sm font-bold text-red-300 block">
                    Reset Current Season (Discard Without Archiving)
                  </span>
                  <span className="text-xs text-slate-400">
                    Clears active group draws, brackets, and any match logs recorded for {config.seasonName || `Season ${config.seasonNumber || 1}`}. Idol roster, girl groups, and past season archives are NOT affected.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to reset ${config.seasonName || 'Current Season'}? This will wipe the active group stage/bracket and its match logs, without archiving.`)) {
                      onResetCurrentSeason();
                      showSuccessMsg('Active season workspace reset to clean state!');
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl bg-red-800 hover:bg-red-700 px-5 py-2.5 text-xs font-bold text-white transition-colors"
                >
                  <RotateCcw className="h-4 w-4 text-amber-300" />
                  <span>Reset Current Season</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-red-500/20 pt-4">
              <div>
                <span className="text-sm font-bold text-slate-200 block">
                  Start New Tournament (Archive &amp; Advance Season)
                </span>
                <span className="text-xs text-slate-400">
                  Archives current season, updates Hall of Champions &amp; Career Stats, then clears group/knockout workspace for next season.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetWorkspace();
                  showSuccessMsg('Tournament workspace reset for next season!');
                }}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Start New Tournament</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-red-500/20 pt-4">
              <div>
                <span className="text-sm font-bold text-slate-200 block">
                  Restore Sample Preloaded Data
                </span>
                <span className="text-xs text-slate-400">
                  Resets idols, girl groups, seeds, and nationalities back to the 64 preloaded default dataset.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onRestoreDefaultData();
                  showSuccessMsg('All database records reset to the preloaded 64 idol default dataset!');
                }}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reset to Preloaded Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full League Roster Modal */}
      {isRosterModalOpen && (
        <LeagueRosterModal
          isOpen={isRosterModalOpen}
          onClose={() => setIsRosterModalOpen(false)}
          idols={appState.idols}
          girlGroups={appState.girlGroups}
          leagueState={activeLeagueState}
          onUpdateLeagueState={(newState) => {
            if (onUpdateLeagueState) onUpdateLeagueState(newState);
            saveLeagueSeasonState(newState);
          }}
          onUpdateIdols={onUpdateIdols}
        />
      )}

      {/* Universal Floating Toast Notification */}
      {(actionSuccessMsg || savedSuccess || brandingSavedSuccess) && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-poster-title font-black text-sm shadow-2xl border-2 border-black animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-slate-950 flex-shrink-0" />
          <span>
            {actionSuccessMsg || (savedSuccess ? 'Tournament settings saved successfully!' : 'Changes saved successfully!')}
          </span>
        </div>
      )}
    </div>
  );
};
