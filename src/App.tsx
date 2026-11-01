import { loadV5State, saveV5State, V5State } from './utils/v5/store';
import { loadNames } from './utils/v5/names';
import { V5CupsPanel } from './components/V5CupsPanel';
import { getUnfinishedCompetitions } from './utils/seasonGuard';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AppState,
  loadAppState,
  saveAppState,
  loadTournamentArchives,
  saveTournamentArchives,
  loadAppStateFromIndexedDB,
  flushAppStateToIndexedDB,
  createDefaultState,
  normalizeAppState,
  clearAllAppDataAndStorage,
  calculateCurrentSeasonNumber,
  DEFAULT_COUNTRIES,
} from './utils/storage';
import { Idol, GirlGroup, TournamentConfig, Group, KnockoutMatch, ArchivedMatch, TournamentArchive } from './types';
import { INITIAL_IDOLS, INITIAL_GIRL_GROUPS, generateAvatarUrl } from './data/initialData';
import {
  drawGroups,
  updateGroupMatchScore,
  buildKnockoutBracket,
  updateKnockoutMatchScore,
  generateRoundRobinMatches,
  calculateGroupStandings,
  deriveCareerStats,
  syncAllMatchesToDatabase,
  resetGroupMatch,
  resetKnockoutMatch,
  simulateAllGroupMatches,
  simulateAllKnockoutMatches,
  isIdolActive,
  getCompletedTournamentArchiveRecord,
} from './utils/tournamentLogic';

import { Sidebar } from './components/Sidebar';
import { DashboardPanel } from './components/DashboardPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { IdolDatabasePanel } from './components/IdolDatabasePanel';
import { GirlGroupManagerPanel } from './components/GirlGroupManagerPanel';
import { RatingPanel } from './components/RatingPanel';
import { SeedManagerPanel } from './components/SeedManagerPanel';
import { NationalityManagerPanel } from './components/NationalityManagerPanel';
import { InactiveManagerPanel } from './components/InactiveManagerPanel';
import { CompetitionManagerPanel } from './components/CompetitionManagerPanel';
import { GroupDrawPanel } from './components/GroupDrawPanel';
import { GroupStagePanel } from './components/GroupStagePanel';
import { KnockoutBracketPanel } from './components/KnockoutBracketPanel';
import { PublicResultsPanel } from './components/PublicResultsPanel';
import { MatchDatabasePanel } from './components/MatchDatabasePanel';
import { CareerStatsPanel } from './components/CareerStatsPanel';
import { GirlGroupStatsPanel } from './components/GirlGroupStatsPanel';
import { SeasonProfilePanel } from './components/SeasonProfilePanel';
import { IdolProfilePanel } from './components/IdolProfilePanel';
import { HeadToHeadPanel } from './components/HeadToHeadPanel';
import { HallOfChampionsPanel } from './components/HallOfChampionsPanel';
import { AllTimeRecordsPanel } from './components/AllTimeRecordsPanel';
import { TournamentBrowserPanel } from './components/TournamentBrowserPanel';
import { SystemInfoPanel } from './components/SystemInfoPanel';
import { LeagueSystemPanel } from './components/LeagueSystemPanel';
import { SeasonSimulatorPanel } from './components/SeasonSimulatorPanel';
import { TheIdolsPanel } from './components/TheIdolsPanel';
import { RankPanel } from './components/RankPanel';
import { DatabaseStudioPanel } from './components/DatabaseStudioPanel';
import { incrementSeasonName, extractBaseTournamentName } from './utils/seasonNameHelper';
import {
  loadCareerOverrides,
  saveCareerOverrides,
  applyOverridesToCareerStats,
  CareerOverridesMap,
} from './utils/databaseStudioLogic';
import {
  LeagueSeasonState,
  LeagueSeasonArchive,
  LeagueQualifierEntry,
  ActiveTab,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from './types';
import {
  loadLeagueSeasonState,
  saveLeagueSeasonState,
  loadLeagueArchives,
  saveLeagueArchives,
  syncLeagueMatchesToArchivedMatches,
  archiveLeagueSeason,
  advanceLeagueSeason,
  resetLeagueSeasonMatchesOnly,
} from './utils/leagueLogic';
import {
  loadTheIdolsState,
  saveTheIdolsState,
  loadTheIdolsArchives,
  saveTheIdolsArchives,
  initializeTheIdolsSeason,
  archiveTheIdolsSeason,
  advanceTheIdolsSeason,
  convertTheIdolsMatchesToArchived,
  syncTheIdolsStateWithLatestIdols,
  resetTheIdolsSeasonMatchesOnly,
} from './utils/theIdolsLogic';
import { recoverMissingSeasonArchives } from './utils/archiveRecoveryEngine';
import { Menu, Trophy } from 'lucide-react';

export function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const v5State = appState.v5State || loadV5State();
  const handleUpdateV5State = (next: V5State) => {
    saveV5State(next);
    setAppState((prev) => {
      // Preserve every completed V5 match in the permanent central match database
      // before a competition can be reset or rebuilt.
      const seasonId = Number(prev.leagueState?.seasonNumber || prev.config.seasonNumber || 1);
      const seasonName = prev.leagueState?.seasonName || prev.config.seasonName || `Season ${seasonId}`;
      const archived = new Map<string, ArchivedMatch>();
      (prev.matchDatabase || []).forEach((m) => archived.set(m.matchId, m));
      const add = (competition: string, match: any) => {
        if (!match?.completed || !match.idolAId || !match.idolBId || !Number.isFinite(Number(match.scoreA)) || !Number.isFinite(Number(match.scoreB))) return;
        const a = prev.idols.find((i) => i.id === match.idolAId);
        const b = prev.idols.find((i) => i.id === match.idolBId);
        if (!a || !b) return;
        const winnerId = match.winnerId || (Number(match.scoreA) > Number(match.scoreB) ? a.id : b.id);
        const winner = winnerId === a.id ? a : b;
        const loser = winnerId === a.id ? b : a;
        const matchId = `v5_${competition.replace(/[^a-z0-9]+/gi, '_')}_${match.id}`;
        archived.set(matchId, {
          matchId, seasonId, seasonName,
          stage: `Cups & Divisions: ${competition} / ${match.roundName || 'Match'}`,
          idolAId: a.id, idolAName: a.name, idolAGroup: a.girlGroup, idolAPhoto: a.photoUrl,
          idolBId: b.id, idolBName: b.name, idolBGroup: b.girlGroup, idolBPhoto: b.photoUrl,
          scoreA: Number(match.scoreA), scoreB: Number(match.scoreB), winnerId,
          winnerName: winner.name, loserId: loser.id, loserName: loser.name,
          date: match.updatedAt || new Date().toISOString(),
        });
      };
      const snapshot = (state: V5State) => {
        (state.d2 || []).forEach((l) => (l.matches || []).forEach((m: any) => add(`Division 2 ${l.name}`, { ...m, roundName: `Matchday ${m.matchday}` })));
        (state.champsCup?.matches || []).forEach((m) => add('League Champions Cup', m));
        (state.leagueCup?.rounds || []).flat().forEach((m) => add('All-League Knockout Cup', m));
        Object.entries(state.miniCups || {}).forEach(([id, matches]) => matches.forEach((m) => add(`Top 16 Mini Cup League ${id}`, m)));
        if (state.superA) add('Super Cup A', state.superA);
        (state.superB || []).forEach((m) => add('Super Cup B', m));
      };
      snapshot(prev.v5State || loadV5State());
      snapshot(next);
      const matchDatabase = Array.from(archived.values());
      return { ...prev, matchDatabase, v5State: next };
    });
  };
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedIdolId, setSelectedIdolId] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [leagueState, setLeagueState] = useState<LeagueSeasonState | null>(() => loadLeagueSeasonState());
  const [leagueArchives, setLeagueArchives] = useState<LeagueSeasonArchive[]>(() => loadLeagueArchives());
  const [theIdolsState, setTheIdolsState] = useState<TheIdolsSeasonState | null>(() => {
    const loaded = loadTheIdolsState();
    const initial = loadAppState();
    if (loaded) {
      return syncTheIdolsStateWithLatestIdols(loaded, initial.idols, initial.girlGroups);
    }
    return initializeTheIdolsSeason(initial.idols, initial.config.seasonNumber || 1, initial.girlGroups);
  });
  const [theIdolsArchives, setTheIdolsArchives] = useState<TheIdolsSeasonArchive[]>(() => loadTheIdolsArchives());
  const [careerOverrides, setCareerOverrides] = useState<CareerOverridesMap>(() => loadCareerOverrides());
  const isHydratedRef = useRef(false);

  const handleUpdateTheIdolsState = (newState: TheIdolsSeasonState) => {
    setTheIdolsState(newState);
    saveTheIdolsState(newState);
    setAppState((prev) => ({
      ...prev,
      theIdolsState: newState,
    }));
  };

  const handleUpdateTheIdolsArchives = (newArchives: TheIdolsSeasonArchive[]) => {
    setTheIdolsArchives(newArchives);
    saveTheIdolsArchives(newArchives);
    setAppState((prev) => ({
      ...prev,
      theIdolsArchives: newArchives,
    }));
  };

  const handleUpdateLeagueState = (newState: LeagueSeasonState) => {
    setLeagueState(newState);
    saveLeagueSeasonState(newState);
    setAppState((prev) => ({
      ...prev,
      leagueState: newState,
    }));
  };

  const handleUpdateLeagueArchives = (newArchives: LeagueSeasonArchive[]) => {
    setLeagueArchives(newArchives);
    saveLeagueArchives(newArchives);
    setAppState((prev) => ({
      ...prev,
      leagueArchives: newArchives,
    }));
  };

  const handleAdvanceToChampionsTournament = (qualifiers: LeagueQualifierEntry[]) => {
    const qualifierIds = qualifiers.map((q) => q.idolId);
    const totalCount = qualifierIds.length;
    const is64 = totalCount >= 64;
    // Current season number must remain consistent with the active league season
    const currentSeasonNumber = leagueState?.seasonNumber || appState.config.seasonNumber || appState.config.seasonId || 1;

    // Strictly preserve the user's custom tournament title and chosen season name
    // Do NOT overwrite user choice renames with generic "Grand Cup 64 Knockout"
    let userChoice = (appState.config.customTournamentTitle || appState.config.seasonName || '').trim();
    let resolvedSeasonName = userChoice;
    if (!resolvedSeasonName || resolvedSeasonName.toLowerCase().startsWith('grand cup 64 knockout (season') || resolvedSeasonName.toLowerCase().startsWith('champions league knockout (season')) {
      if (appState.config.customTournamentTitle && !appState.config.customTournamentTitle.toLowerCase().startsWith('grand cup 64 knockout (season')) {
        resolvedSeasonName = appState.config.customTournamentTitle;
      } else if (appState.config.seasonName && !appState.config.seasonName.toLowerCase().startsWith('grand cup 64 knockout (season')) {
        resolvedSeasonName = appState.config.seasonName;
      } else {
        resolvedSeasonName = `Season ${currentSeasonNumber}`;
      }
    }

    const newConfig: TournamentConfig = {
      ...appState.config,
      seasonNumber: currentSeasonNumber,
      seasonId: currentSeasonNumber,
      seasonName: resolvedSeasonName,
      customTournamentTitle: resolvedSeasonName,
      totalParticipants: (is64 ? 64 : 32) as 32 | 64,
      numGroups: is64 ? 16 : 8,
      participantsPerGroup: 4,
      qualifiedPerGroup: 2,
      isStarted: true,
      isGroupStageFinished: false,
      isKnockoutFinished: false,
    };

    // Draw groups of 4 for the qualifiers (16 groups for 64, 8 groups for 32)
    const newGroups = drawGroups(appState.idols, qualifierIds, newConfig);

    const updatedLeague: LeagueSeasonState | null = leagueState
      ? {
          ...leagueState,
          championsAdvancementDone: true,
        }
      : null;

    const syncedLeagueMatches = syncLeagueMatchesToArchivedMatches(
      updatedLeague,
      leagueArchives,
      appState.idols
    );

    // Auto-archive active season if it had a finished Grand Final that wasn't archived yet
    const tempIdolsMap = new Map<string, Idol>();
    appState.idols.forEach((i) => tempIdolsMap.set(i.id, i));
    const pendingActiveRecord = getCompletedTournamentArchiveRecord(
      appState.config,
      appState.groups,
      appState.knockoutMatches,
      tempIdolsMap
    );
    let updatedArchives = appState.archives;
    if (
      pendingActiveRecord &&
      !appState.archives.some((a) => Number(a.seasonId) === Number(pendingActiveRecord.seasonId))
    ) {
      updatedArchives = [...appState.archives, pendingActiveRecord];
      saveTournamentArchives(updatedArchives);
    }

    setAppState((prev) => {
      const map = new Map<string, ArchivedMatch>();
      prev.matchDatabase.forEach((m) => map.set(m.matchId, m));
      syncedLeagueMatches.forEach((m) => map.set(m.matchId, m));

      return {
        ...prev,
        archives: updatedArchives,
        matchDatabase: Array.from(map.values()),
        config: newConfig,
        selectedParticipantIds: qualifierIds,
        groups: newGroups,
        knockoutMatches: [],
        leagueState: updatedLeague,
      };
    });

    if (updatedLeague) {
      setLeagueState(updatedLeague);
      saveLeagueSeasonState(updatedLeague);
    }

    setActiveTab('group_stage');
  };

  const handleSelectIdolProfile = (idolId: string) => {
    setSelectedIdolId(idolId);
    setActiveTab('idol_profile');
  };

  // Hydrate from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    loadAppStateFromIndexedDB()
      .then((idbState) => {
        if (!isMounted) return;
        if (idbState) {
          setAppState((prev) => {
            const merged: AppState = { ...prev };
            if (Array.isArray(idbState.idols) && idbState.idols.length > 0) {
              merged.idols = idbState.idols;
            }
            if (Array.isArray(idbState.girlGroups) && idbState.girlGroups.length > 0) {
              merged.girlGroups = idbState.girlGroups;
            }

            // Config: never roll back seasonId or seasonNumber
            const prevSeasonNum = Number(prev.config?.seasonNumber || prev.config?.seasonId || 1);
            const idbSeasonNum = Number(idbState.config?.seasonNumber || idbState.config?.seasonId || 1);
            if (idbSeasonNum > prevSeasonNum) {
              merged.config = idbState.config;
              if (Array.isArray(idbState.groups) && idbState.groups.length > 0) {
                merged.groups = idbState.groups;
              }
              if (Array.isArray(idbState.knockoutMatches) && idbState.knockoutMatches.length > 0) {
                merged.knockoutMatches = idbState.knockoutMatches;
              }
              if (Array.isArray(idbState.selectedParticipantIds)) {
                merged.selectedParticipantIds = idbState.selectedParticipantIds;
              }
            } else if (idbSeasonNum === prevSeasonNum && idbState.config) {
              merged.config = {
                ...prev.config,
                ...idbState.config,
                isGroupStageFinished: Boolean(idbState.config.isGroupStageFinished || prev.config.isGroupStageFinished),
                isKnockoutFinished: Boolean(idbState.config.isKnockoutFinished || prev.config.isKnockoutFinished),
              };

              // Safely merge whichever store has more match progress
              const idbKoCompleted = (idbState.knockoutMatches || []).filter((m) => m.completed).length;
              const prevKoCompleted = (prev.knockoutMatches || []).filter((m) => m.completed).length;
              const idbGrpCompleted = (idbState.groups || []).reduce(
                (acc, g) => acc + (g.matches || []).filter((m) => m.completed).length,
                0
              );
              const prevGrpCompleted = (prev.groups || []).reduce(
                (acc, g) => acc + (g.matches || []).filter((m) => m.completed).length,
                0
              );

              if (idbKoCompleted > prevKoCompleted || (!prev.knockoutMatches || prev.knockoutMatches.length === 0)) {
                if (Array.isArray(idbState.knockoutMatches) && idbState.knockoutMatches.length > 0) {
                  merged.knockoutMatches = idbState.knockoutMatches;
                }
              }
              if (idbGrpCompleted > prevGrpCompleted || (!prev.groups || prev.groups.length === 0)) {
                if (Array.isArray(idbState.groups) && idbState.groups.length > 0) {
                  merged.groups = idbState.groups;
                }
              }
            } else {
              // prevSeasonNum > idbSeasonNum: localStorage is ahead, fallback if empty
              if (!merged.groups || merged.groups.length === 0) {
                if (Array.isArray(idbState.groups) && idbState.groups.length > 0) {
                  merged.groups = idbState.groups;
                }
              }
              if (!merged.knockoutMatches || merged.knockoutMatches.length === 0) {
                if (Array.isArray(idbState.knockoutMatches) && idbState.knockoutMatches.length > 0) {
                  merged.knockoutMatches = idbState.knockoutMatches;
                }
              }
            }

            // Auto-detect if Grand Final in merged matches is completed: ensure flags are set
            const grandFinalMatch = (merged.knockoutMatches || []).find(
              (m) =>
                !m.isThirdPlaceMatch &&
                ((m.roundName || '').toLowerCase().includes('grand final') || (m.roundName || '').toLowerCase() === 'final')
            );
            if (grandFinalMatch && grandFinalMatch.completed && grandFinalMatch.winnerId) {
              if (merged.config) {
                merged.config.isGroupStageFinished = true;
                merged.config.isKnockoutFinished = true;
              }
            }

            // Match Database: merge non-destructively by matchId
            if (Array.isArray(idbState.matchDatabase)) {
              const matchMap = new Map<string, any>();
              (prev.matchDatabase || []).forEach((m) => m && m.matchId && matchMap.set(m.matchId, m));
              (idbState.matchDatabase || []).forEach((m) => {
                if (m && m.matchId) {
                  const existing = matchMap.get(m.matchId);
                  matchMap.set(m.matchId, { ...existing, ...m });
                }
              });
              merged.matchDatabase = Array.from(matchMap.values());
            }

            // Archives: merge non-destructively by seasonId across BOTH stores
            const archMap = new Map<number, TournamentArchive>();
            (prev.archives || []).forEach((a) => {
              if (a && a.seasonId) archMap.set(Number(a.seasonId), a);
            });
            (idbState.archives || []).forEach((a) => {
              if (a && a.seasonId) {
                const sId = Number(a.seasonId);
                const existing = archMap.get(sId);
                archMap.set(sId, {
                  ...existing,
                  ...a,
                  championId: a.championId || existing?.championId || '',
                  championName: a.championName || existing?.championName || '',
                  runnerUpId: a.runnerUpId || existing?.runnerUpId || '',
                  runnerUpName: a.runnerUpName || existing?.runnerUpName || '',
                  thirdPlaceId: a.thirdPlaceId || existing?.thirdPlaceId || '',
                  thirdPlaceName: a.thirdPlaceName || existing?.thirdPlaceName || '',
                });
              }
            });
            merged.archives = Array.from(archMap.values()).sort((a, b) => Number(a.seasonId) - Number(b.seasonId));

            // League Archives: merge by seasonNumber
            const leagueArchMap = new Map<number, LeagueSeasonArchive>();
            (prev.leagueArchives || []).forEach((a) => {
              if (a && a.seasonNumber) leagueArchMap.set(Number(a.seasonNumber), a);
            });
            (idbState.leagueArchives || []).forEach((a) => {
              if (a && a.seasonNumber) {
                const sNum = Number(a.seasonNumber);
                const existing = leagueArchMap.get(sNum);
                leagueArchMap.set(sNum, { ...existing, ...a });
              }
            });
            merged.leagueArchives = Array.from(leagueArchMap.values()).sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber));

            // The Idols Archives: merge by seasonNumber
            const theIdolsArchMap = new Map<number, TheIdolsSeasonArchive>();
            (prev.theIdolsArchives || []).forEach((a) => {
              if (a && a.seasonNumber) theIdolsArchMap.set(Number(a.seasonNumber), a);
            });
            (idbState.theIdolsArchives || []).forEach((a) => {
              if (a && a.seasonNumber) {
                const sNum = Number(a.seasonNumber);
                const existing = theIdolsArchMap.get(sNum);
                theIdolsArchMap.set(sNum, { ...existing, ...a });
              }
            });
            merged.theIdolsArchives = Array.from(theIdolsArchMap.values()).sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber));

            if (Array.isArray(idbState.selectedParticipantIds) && idbState.selectedParticipantIds.length > 0) {
              merged.selectedParticipantIds = idbState.selectedParticipantIds;
            }
            if (Array.isArray(idbState.personalRankings)) {
              merged.personalRankings = idbState.personalRankings;
            }
            if (Array.isArray(idbState.customLeagueBranding)) {
              merged.customLeagueBranding = idbState.customLeagueBranding;
            }

            // League State: keep whichever has higher seasonNumber or more matches
            const prevLSeason = Number(prev.leagueState?.seasonNumber || 0);
            const idbLSeason = Number(idbState.leagueState?.seasonNumber || 0);
            if (idbLSeason > prevLSeason) {
              merged.leagueState = idbState.leagueState;
            } else if (idbLSeason === prevLSeason && idbState.leagueState) {
              const prevLMatches = (prev.leagueState?.leagues || []).reduce(
                (acc, l) => acc + (l.matches || []).filter((m: any) => m.completed).length,
                0
              );
              const idbLMatches = (idbState.leagueState?.leagues || []).reduce(
                (acc, l) => acc + (l.matches || []).filter((m: any) => m.completed).length,
                0
              );
              if (idbLMatches >= prevLMatches) {
                merged.leagueState = idbState.leagueState;
              }
            }

            // The Idols State: keep whichever has higher seasonNumber
            const prevTSeason = Number(prev.theIdolsState?.seasonNumber || 0);
            const idbTSeason = Number(idbState.theIdolsState?.seasonNumber || 0);
            if (idbTSeason > prevTSeason) {
              merged.theIdolsState = idbState.theIdolsState;
            } else if (idbTSeason === prevTSeason && idbState.theIdolsState) {
              merged.theIdolsState = idbState.theIdolsState;
            }

            // Dynamically synchronize active season count based on all database history
            const { currentSeasonNumber: dynamicHydratedSeason } = calculateCurrentSeasonNumber(
              merged.archives,
              merged.leagueArchives,
              merged.theIdolsArchives,
              merged.matchDatabase,
              merged.config?.seasonNumber,
              merged.leagueState,
              merged.theIdolsState
            );

            if (dynamicHydratedSeason > Number(merged.config?.seasonNumber || 0)) {
              merged.config = {
                ...merged.config,
                seasonNumber: dynamicHydratedSeason,
                seasonId: dynamicHydratedSeason,
                seasonName:
                  merged.config?.seasonName &&
                  !merged.config.seasonName.toLowerCase().startsWith('season ') &&
                  merged.config.seasonName.trim() !== ''
                    ? merged.config.seasonName
                    : `Season ${dynamicHydratedSeason}`,
              };
            }

            return merged;
          });

          // Sync local variables with non-regressive values
          setLeagueArchives((prev) => {
            const leagueArchMap = new Map<number, LeagueSeasonArchive>();
            (prev || []).forEach((a) => a && a.seasonNumber && leagueArchMap.set(Number(a.seasonNumber), a));
            (idbState.leagueArchives || []).forEach((a) => a && a.seasonNumber && leagueArchMap.set(Number(a.seasonNumber), { ...leagueArchMap.get(Number(a.seasonNumber)), ...a }));
            const list = Array.from(leagueArchMap.values()).sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber));
            saveLeagueArchives(list);
            return list;
          });

          setTheIdolsArchives((prev) => {
            const idolsArchMap = new Map<number, TheIdolsSeasonArchive>();
            (prev || []).forEach((a) => a && a.seasonNumber && idolsArchMap.set(Number(a.seasonNumber), a));
            (idbState.theIdolsArchives || []).forEach((a) => a && a.seasonNumber && idolsArchMap.set(Number(a.seasonNumber), { ...idolsArchMap.get(Number(a.seasonNumber)), ...a }));
            const list = Array.from(idolsArchMap.values()).sort((a, b) => Number(a.seasonNumber) - Number(b.seasonNumber));
            saveTheIdolsArchives(list);
            return list;
          });

          if (idbState.leagueState) {
            setLeagueState((prev) => {
              const prevS = Number(prev?.seasonNumber || 0);
              const idbS = Number(idbState.leagueState?.seasonNumber || 0);
              const chosen = idbS >= prevS ? idbState.leagueState! : prev;
              saveLeagueSeasonState(chosen);
              return chosen;
            });
          }

          if (idbState.theIdolsState) {
            setTheIdolsState((prev) => {
              const prevS = Number(prev?.seasonNumber || 0);
              const idbS = Number(idbState.theIdolsState?.seasonNumber || 0);
              const chosen = idbS >= prevS ? idbState.theIdolsState! : prev;
              saveTheIdolsState(chosen);
              return chosen;
            });
          }
        }
        isHydratedRef.current = true;
      })
      .catch((err) => {
        console.warn('IndexedDB initial hydration failed, relying on localStorage:', err);
        isHydratedRef.current = true;
      });

    const handleBeforeUnload = () => {
      flushAppStateToIndexedDB();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  // Sync app state to localStorage and IndexedDB whenever it changes, ONLY after initial hydration
  useEffect(() => {
    if (!isHydratedRef.current) return;
    saveAppState(appState, leagueState, leagueArchives, theIdolsState, theIdolsArchives);
  }, [appState, leagueState, leagueArchives, theIdolsState, theIdolsArchives]);

  // Fast O(1) map of Idols by ID
  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    appState.idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [appState.idols]);

  // Combined match database including all tournament matches + all completed league matches + The Idols matches
  const allCombinedMatchDatabase = useMemo(() => {
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
    const v5Matches: ArchivedMatch[] = [];
    const seasonId = Number(leagueState?.seasonNumber || appState.config.seasonNumber || 1);
    const seasonName = leagueState?.seasonName || appState.config.seasonName || `Season ${seasonId}`;
    const addV5Match = (competition: string, match: any) => {
      if (!match?.completed || !match.idolAId || !match.idolBId || !Number.isFinite(Number(match.scoreA)) || !Number.isFinite(Number(match.scoreB))) return;
      const a = appState.idols.find((idol) => idol.id === match.idolAId);
      const b = appState.idols.find((idol) => idol.id === match.idolBId);
      if (!a || !b) return;
      const winnerId = match.winnerId || (Number(match.scoreA) > Number(match.scoreB) ? a.id : b.id);
      const winner = winnerId === a.id ? a : b;
      const loser = winnerId === a.id ? b : a;
      v5Matches.push({
        matchId: `v5_${competition.replace(/[^a-z0-9]+/gi, '_')}_${match.id}`,
        seasonId, seasonName, stage: `Cups & Divisions: ${competition} / ${match.roundName || 'Match'}`,
        idolAId: a.id, idolAName: a.name, idolAGroup: a.girlGroup, idolAPhoto: a.photoUrl,
        idolBId: b.id, idolBName: b.name, idolBGroup: b.girlGroup, idolBPhoto: b.photoUrl,
        scoreA: Number(match.scoreA), scoreB: Number(match.scoreB), winnerId,
        winnerName: winner.name, loserId: loser.id, loserName: loser.name,
        date: match.updatedAt || new Date().toISOString(),
      });
    };
    (v5State.d2 || []).forEach((league) => (league.matches || []).forEach((match: any) => addV5Match(`Division 2 ${league.name}`, { ...match, roundName: `Matchday ${match.matchday}` })));
    (v5State.champsCup?.matches || []).forEach((match) => addV5Match('League Champions Cup', match));
    (v5State.leagueCup?.rounds || []).flat().forEach((match) => addV5Match('All-League Knockout Cup', match));
    Object.entries(v5State.miniCups || {}).forEach(([leagueId, matches]) => matches.forEach((match) => addV5Match(`Top 16 Mini Cup League ${leagueId}`, match)));
    if (v5State.superA) addV5Match('Super Cup A', v5State.superA);
    (v5State.superB || []).forEach((match) => addV5Match('Super Cup B', match));
    const map = new Map<string, ArchivedMatch>();
    appState.matchDatabase.forEach((m) => map.set(m.matchId, m));
    leagueMatches.forEach((m) => map.set(m.matchId, m));
    theIdolsAllMatches.forEach((m) => map.set(m.matchId, m));
    v5Matches.forEach((m) => map.set(m.matchId, m));
    return Array.from(map.values());
  }, [appState.matchDatabase, leagueState, leagueArchives, theIdolsState, theIdolsArchives, appState.idols, appState.config.seasonNumber, appState.config.seasonName, v5State]);

  // Dynamic season stats derived from database truth (how many seasons have actually been played, archived, and stored)
  const derivedSeasonStats = useMemo(() => {
    return calculateCurrentSeasonNumber(
      appState.archives,
      leagueArchives,
      theIdolsArchives,
      allCombinedMatchDatabase,
      appState.config.seasonNumber,
      leagueState,
      theIdolsState
    );
  }, [
    appState.archives,
    leagueArchives,
    theIdolsArchives,
    allCombinedMatchDatabase,
    appState.config.seasonNumber,
    leagueState?.seasonNumber,
    theIdolsState?.seasonNumber,
  ]);

  // Auto-reconciliation: scan match database and restore any missing season archives into state & storage
  const hasAutoReconciledRef = useRef(false);
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (hasAutoReconciledRef.current) return;
    if (allCombinedMatchDatabase.length === 0) return;

    const recovery = recoverMissingSeasonArchives(
      allCombinedMatchDatabase,
      appState.archives,
      leagueArchives,
      theIdolsArchives,
      appState.idols,
      derivedSeasonStats.currentSeasonNumber
    );

    if (recovery.hasChanges) {
      console.log('⚡ Recovered missing season archives from matchDatabase:', recovery.recoveredSeasonNumbers);
      setAppState((prev) => ({
        ...prev,
        archives: recovery.recoveredTournamentArchives,
      }));
      setLeagueArchives(recovery.recoveredLeagueArchives);
      setTheIdolsArchives(recovery.recoveredTheIdolsArchives);

      saveTournamentArchives(recovery.recoveredTournamentArchives);
      saveLeagueArchives(recovery.recoveredLeagueArchives);
      saveTheIdolsArchives(recovery.recoveredTheIdolsArchives);
      flushAppStateToIndexedDB();
    }
    hasAutoReconciledRef.current = true;
  }, [allCombinedMatchDatabase.length, appState.archives.length, leagueArchives.length, theIdolsArchives.length, derivedSeasonStats.currentSeasonNumber]);

  const handleReconcileArchives = () => {
    const recovery = recoverMissingSeasonArchives(
      allCombinedMatchDatabase,
      appState.archives,
      leagueArchives,
      theIdolsArchives,
      appState.idols,
      derivedSeasonStats.currentSeasonNumber
    );

    if (recovery.hasChanges) {
      setAppState((prev) => ({
        ...prev,
        archives: recovery.recoveredTournamentArchives,
      }));
      setLeagueArchives(recovery.recoveredLeagueArchives);
      setTheIdolsArchives(recovery.recoveredTheIdolsArchives);

      saveTournamentArchives(recovery.recoveredTournamentArchives);
      saveLeagueArchives(recovery.recoveredLeagueArchives);
      saveTheIdolsArchives(recovery.recoveredTheIdolsArchives);
      flushAppStateToIndexedDB();
    }
  };

  // Keep config in sync if derived season number is ahead
  useEffect(() => {
    if (!isHydratedRef.current) return;
    if (derivedSeasonStats.currentSeasonNumber > Number(appState.config.seasonNumber || 0)) {
      setAppState((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          seasonNumber: derivedSeasonStats.currentSeasonNumber,
          seasonId: derivedSeasonStats.currentSeasonNumber,
          seasonName:
            prev.config.seasonName &&
            !prev.config.seasonName.toLowerCase().startsWith('season ') &&
            prev.config.seasonName.trim() !== ''
              ? prev.config.seasonName
              : `Season ${derivedSeasonStats.currentSeasonNumber}`,
        },
      }));
    }
  }, [derivedSeasonStats.currentSeasonNumber, appState.config.seasonNumber]);

  // Derived Career Stats (integrates tournament match database, league divisions, and The Idols)
  const careerStats = useMemo(() => {
    const rawStats = deriveCareerStats(
      appState.idols,
      allCombinedMatchDatabase,
      appState.archives,
      appState.knockoutMatches,
      appState.config,
      appState.groups,
      appState.selectedParticipantIds,
      leagueState,
      leagueArchives,
      theIdolsState,
      theIdolsArchives
    );
    return applyOverridesToCareerStats(rawStats, careerOverrides);
  }, [
    appState.idols,
    allCombinedMatchDatabase,
    appState.archives,
    appState.knockoutMatches,
    appState.config,
    appState.groups,
    appState.selectedParticipantIds,
    leagueState,
    leagueArchives,
    theIdolsState,
    theIdolsArchives,
    careerOverrides,
  ]);

  // Helper to deduplicate idols by lowercased name
  const deduplicateIdols = (idolsList: Idol[]): Idol[] => {
    const map = new Map<string, Idol>();
    idolsList.forEach((idol) => {
      const key = idol.name.trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, idol);
      } else {
        const existing = map.get(key)!;
        const resolvedInactive =
          idol.inactive !== undefined
            ? Boolean(idol.inactive === true || String(idol.inactive).toLowerCase() === 'true')
            : Boolean(existing.inactive === true || String(existing.inactive).toLowerCase() === 'true');
        map.set(key, {
          ...existing,
          inactive: resolvedInactive,
          girlGroup:
            idol.girlGroup && idol.girlGroup !== 'Solo / Independent'
              ? idol.girlGroup
              : existing.girlGroup,
          seed: idol.seed && idol.seed !== 'Unseeded' ? idol.seed : existing.seed,
          nationality:
            idol.nationality && idol.nationality !== 'Unknown'
              ? idol.nationality
              : existing.nationality,
          photoUrl:
            idol.photoUrl &&
            idol.photoUrl.startsWith('data:image') &&
            !existing.photoUrl.startsWith('data:image')
              ? idol.photoUrl
              : existing.photoUrl,
        });
      }
    });
    return Array.from(map.values());
  };

  // --- HANDLERS: IDOLS CRUD ---
  const handleAddIdol = (idol: Idol) => {
    setAppState((prev) => {
      const lowerName = idol.name.trim().toLowerCase();
      const existingIdx = prev.idols.findIndex(
        (i) => i.name.trim().toLowerCase() === lowerName
      );
      if (existingIdx >= 0) {
        const updated = [...prev.idols];
        updated[existingIdx] = {
          ...updated[existingIdx],
          ...idol,
          id: updated[existingIdx].id,
        };
        return { ...prev, idols: deduplicateIdols(updated) };
      }
      return {
        ...prev,
        idols: deduplicateIdols([...prev.idols, idol]),
      };
    });
  };

  const handleUpdateIdol = (updated: Idol) => {
    setAppState((prev) => ({
      ...prev,
      idols: prev.idols.map((i) => (i.id === updated.id ? updated : i)),
    }));
  };

  const handleDeleteIdol = (idolId: string) => {
    setAppState((prev) => ({
      ...prev,
      idols: prev.idols.filter((i) => i.id !== idolId),
      selectedParticipantIds: prev.selectedParticipantIds.filter((id) => id !== idolId),
    }));
  };

  // --- HANDLERS: GIRL GROUPS ---
  const handleAddGirlGroup = (
    groupName: string,
    memberNames: string[],
    logoUrl?: string
  ) => {
    setAppState((prev) => {
      const newGroupId = `group-${Date.now()}`;
      const newGroup: GirlGroup = {
        id: newGroupId,
        name: groupName,
        members: memberNames,
        logoUrl: logoUrl || undefined,
      };

      // Create new idol entries for members that don't exist yet
      const existingIdolNames = new Set(
        prev.idols.map((i) => i.name.trim().toLowerCase())
      );
      const newIdolObjects: Idol[] = [];

      memberNames.forEach((rawName) => {
        const name = rawName.trim();
        if (!name) return;
        const lower = name.toLowerCase();
        if (!existingIdolNames.has(lower)) {
          newIdolObjects.push({
            id: `idol-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: name,
            girlGroup: groupName,
            seed: 'Seed 3',
            nationality: 'South Korea',
            photoUrl: generateAvatarUrl(name, groupName),
            createdAt: Date.now(),
          });
          existingIdolNames.add(lower);
        }
      });

      const nameSet = new Set(
        memberNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
      );
      const updatedExistingIdols = prev.idols.map((idol) => {
        if (nameSet.has(idol.name.trim().toLowerCase())) {
          return { ...idol, girlGroup: groupName };
        }
        return idol;
      });

      return {
        ...prev,
        girlGroups: [...prev.girlGroups, newGroup],
        idols: deduplicateIdols([...updatedExistingIdols, ...newIdolObjects]),
      };
    });
  };

  const handleUpdateGirlGroup = (updated: GirlGroup) => {
    setAppState((prev) => ({
      ...prev,
      girlGroups: prev.girlGroups.map((g) => (g.id === updated.id ? updated : g)),
    }));
  };

  const handleDeleteGirlGroup = (groupId: string) => {
    setAppState((prev) => {
      const groupToDelete = prev.girlGroups.find((g) => g.id === groupId);
      const groupName = groupToDelete?.name;
      return {
        ...prev,
        girlGroups: prev.girlGroups.filter((g) => g.id !== groupId),
        idols: groupName
          ? prev.idols.map((i) =>
              i.girlGroup === groupName ? { ...i, girlGroup: 'Solo / Independent' } : i
            )
          : prev.idols,
      };
    });
  };

  const handleUpdateGroupMembers = (groupId: string, memberNames: string[]) => {
    setAppState((prev) => {
      const targetGroup = prev.girlGroups.find((g) => g.id === groupId);
      if (!targetGroup) return prev;
      const groupName = targetGroup.name;

      const updatedGroups = prev.girlGroups.map((g) =>
        g.id === groupId ? { ...g, members: memberNames } : g
      );

      const existingNamesSet = new Set(
        prev.idols.map((i) => i.name.trim().toLowerCase())
      );
      const newIdolObjects: Idol[] = [];
      const newNamesSet = new Set(
        memberNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
      );

      memberNames.forEach((rawName) => {
        const name = rawName.trim();
        if (!name) return;
        const lower = name.toLowerCase();
        if (!existingNamesSet.has(lower)) {
          newIdolObjects.push({
            id: `idol-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: name,
            girlGroup: groupName,
            seed: 'Seed 3',
            nationality: 'South Korea',
            photoUrl: generateAvatarUrl(name, groupName),
            createdAt: Date.now(),
          });
          existingNamesSet.add(lower);
        }
      });

      const updatedExistingIdols = prev.idols.map((idol) => {
        const lower = idol.name.trim().toLowerCase();
        if (newNamesSet.has(lower)) {
          return { ...idol, girlGroup: groupName };
        } else if (idol.girlGroup === groupName) {
          return { ...idol, girlGroup: 'Solo / Independent' };
        }
        return idol;
      });

      return {
        ...prev,
        girlGroups: updatedGroups,
        idols: deduplicateIdols([...updatedExistingIdols, ...newIdolObjects]),
      };
    });
  };

  const handleDeleteMemberFromGroup = (groupId: string, memberName: string) => {
    setAppState((prev) => {
      const targetGroup = prev.girlGroups.find((g) => g.id === groupId);
      if (!targetGroup) return prev;
      const groupName = targetGroup.name;

      const updatedGroups = prev.girlGroups.map((g) => {
        if (g.id === groupId) {
          return { ...g, members: g.members.filter((m) => m !== memberName) };
        }
        return g;
      });

      const updatedIdols = prev.idols.map((idol) => {
        if (
          idol.name.trim().toLowerCase() === memberName.trim().toLowerCase() &&
          idol.girlGroup === groupName
        ) {
          return { ...idol, girlGroup: 'Solo / Independent' };
        }
        return idol;
      });

      return {
        ...prev,
        girlGroups: updatedGroups,
        idols: updatedIdols,
      };
    });
  };

  // --- HANDLERS: SEED MANAGER ---
  const handleUpdateSeedTierList = (seedTier: string, namesList: string[]) => {
    setAppState((prev) => {
      const targetNamesSet = new Set(
        namesList.map((n) => n.trim().toLowerCase()).filter(Boolean)
      );

      const existingNamesSet = new Set<string>();
      const updatedExistingIdols = prev.idols.map((idol) => {
        const lowerName = idol.name.trim().toLowerCase();
        existingNamesSet.add(lowerName);

        if (targetNamesSet.has(lowerName)) {
          return { ...idol, seed: seedTier };
        } else if (idol.seed === seedTier) {
          return { ...idol, seed: 'Unseeded' };
        }
        return idol;
      });

      const newIdols: Idol[] = [];
      namesList.forEach((rawName) => {
        const name = rawName.trim();
        if (!name) return;
        const lower = name.toLowerCase();
        if (!existingNamesSet.has(lower)) {
          newIdols.push({
            id: `idol-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: name,
            girlGroup: 'Solo / Independent',
            seed: seedTier,
            nationality: 'South Korea',
            photoUrl: generateAvatarUrl(name, 'Solo'),
            createdAt: Date.now(),
          });
          existingNamesSet.add(lower);
        }
      });

      return {
        ...prev,
        idols: deduplicateIdols([...updatedExistingIdols, ...newIdols]),
      };
    });
  };

  const handleClearSeedTierList = (seedTier: string) => {
    setAppState((prev) => ({
      ...prev,
      idols: prev.idols.map((idol) =>
        idol.seed === seedTier ? { ...idol, seed: 'Unseeded' } : idol
      ),
    }));
  };

  // --- HANDLERS: NATIONALITY MANAGER ---
  const handleAddCustomNationality = (nationality: string) => {
    setAppState((prev) => {
      const existing = prev.customNationalities || DEFAULT_COUNTRIES;
      if (existing.includes(nationality)) return prev;
      return {
        ...prev,
        customNationalities: [...existing, nationality],
      };
    });
  };

  const handleDeleteCustomNationality = (nationality: string) => {
    setAppState((prev) => {
      const existing = prev.customNationalities || DEFAULT_COUNTRIES;
      return {
        ...prev,
        customNationalities: existing.filter((n) => n !== nationality),
        idols: prev.idols.map((idol) =>
          idol.nationality === nationality ? { ...idol, nationality: 'Unknown' } : idol
        ),
      };
    });
  };

  const handleUpdateNationalityTierList = (
    nationality: string,
    namesList: string[]
  ) => {
    setAppState((prev) => {
      const targetNamesSet = new Set(
        namesList.map((n) => n.trim().toLowerCase()).filter(Boolean)
      );

      const existingNamesSet = new Set<string>();
      const updatedExistingIdols = prev.idols.map((idol) => {
        const lowerName = idol.name.trim().toLowerCase();
        existingNamesSet.add(lowerName);

        if (targetNamesSet.has(lowerName)) {
          return { ...idol, nationality };
        } else if (idol.nationality === nationality) {
          return { ...idol, nationality: 'Unknown' };
        }
        return idol;
      });

      const newIdols: Idol[] = [];
      namesList.forEach((rawName) => {
        const name = rawName.trim();
        if (!name) return;
        const lower = name.toLowerCase();
        if (!existingNamesSet.has(lower)) {
          newIdols.push({
            id: `idol-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: name,
            girlGroup: 'Solo / Independent',
            seed: 'Seed 3',
            nationality: nationality,
            photoUrl: generateAvatarUrl(name, 'Solo'),
            createdAt: Date.now(),
          });
          existingNamesSet.add(lower);
        }
      });

      const customNats = prev.customNationalities || DEFAULT_COUNTRIES;
      const updatedCustomNats = customNats.includes(nationality)
        ? customNats
        : [...customNats, nationality];

      return {
        ...prev,
        customNationalities: updatedCustomNats,
        idols: deduplicateIdols([...updatedExistingIdols, ...newIdols]),
      };
    });
  };

  const handleClearNationalityTierList = (nationality: string) => {
    setAppState((prev) => ({
      ...prev,
      idols: prev.idols.map((idol) =>
        idol.nationality === nationality ? { ...idol, nationality: 'Unknown' } : idol
      ),
    }));
  };

  // --- HANDLERS: INACTIVE MANAGER ---
  const handleToggleIdolInactive = (idolId: string) => {
    setAppState((prev) => {
      const targetIdol = prev.idols.find((i) => i.id === idolId);
      if (!targetIdol) return prev;

      const currentlyInactive = !isIdolActive(targetIdol, prev.girlGroups);
      // If idol was inactive in any way (direct or via group), toggling makes them active!
      const shouldBecomeActive = currentlyInactive;

      // Update idols list
      const updatedIdols = prev.idols.map((i) => {
        if (i.id === idolId) {
          return { ...i, inactive: !shouldBecomeActive };
        }
        return i;
      });

      // If becoming active and their girl group was inactive, also reactivate that girl group
      let updatedGroups = prev.girlGroups;
      if (shouldBecomeActive && targetIdol.girlGroup) {
        const idolGroupName = targetIdol.girlGroup.trim().toLowerCase();
        updatedGroups = prev.girlGroups.map((g) => {
          if (
            g.name.trim().toLowerCase() === idolGroupName &&
            (g.inactive === true || String(g.inactive).toLowerCase() === 'true')
          ) {
            return { ...g, inactive: false };
          }
          return g;
        });
      }

      return {
        ...prev,
        idols: updatedIdols,
        girlGroups: updatedGroups,
      };
    });
  };

  const handleToggleGroupInactive = (groupId: string) => {
    setAppState((prev) => {
      const targetGroup = prev.girlGroups.find((g) => g.id === groupId);
      if (!targetGroup) return prev;
      const isCurrentlyInactive = Boolean(
        targetGroup.inactive === true || String(targetGroup.inactive).toLowerCase() === 'true'
      );
      const willBeInactive = !isCurrentlyInactive;

      const updatedGroups = prev.girlGroups.map((g) =>
        g.id === groupId ? { ...g, inactive: willBeInactive } : g
      );

      return {
        ...prev,
        girlGroups: updatedGroups,
      };
    });
  };

  const handleUpdateInactiveIdolsList = (names: string[], mode: 'replace' | 'append') => {
    setAppState((prev) => {
      const targetNormalizedSet = new Set(
        names.map((n) => n.trim().toLowerCase()).filter(Boolean)
      );

      const existingNamesMap = new Map<string, Idol>();
      prev.idols.forEach((i) => {
        existingNamesMap.set(i.name.trim().toLowerCase(), i);
      });

      const updatedExistingIdols = prev.idols.map((idol) => {
        const lowerName = idol.name.trim().toLowerCase();
        const matches = targetNormalizedSet.has(lowerName);
        if (mode === 'replace') {
          return { ...idol, inactive: matches };
        } else {
          return matches ? { ...idol, inactive: true } : idol;
        }
      });

      // Auto-create any idols in the list that don't exist in the database yet
      const newIdols: Idol[] = [];
      names.forEach((rawName) => {
        const cleaned = rawName.trim();
        if (!cleaned) return;
        const lower = cleaned.toLowerCase();
        if (!existingNamesMap.has(lower)) {
          const newIdol: Idol = {
            id: `idol-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: cleaned,
            girlGroup: 'Solo / Independent',
            seed: 'Seed 3',
            nationality: 'South Korea',
            photoUrl: generateAvatarUrl(cleaned, 'Solo'),
            createdAt: Date.now(),
            inactive: true,
          };
          newIdols.push(newIdol);
          existingNamesMap.set(lower, newIdol);
        }
      });

      return {
        ...prev,
        idols: deduplicateIdols([...updatedExistingIdols, ...newIdols]),
      };
    });
  };

  const handleUpdateInactiveGroupsList = (names: string[], mode: 'replace' | 'append') => {
    setAppState((prev) => {
      const targetNormalizedSet = new Set(
        names.map((n) => n.trim().toLowerCase()).filter(Boolean)
      );

      const existingGroupsMap = new Map<string, GirlGroup>();
      prev.girlGroups.forEach((g) => {
        existingGroupsMap.set(g.name.trim().toLowerCase(), g);
      });

      const updatedExistingGroups = prev.girlGroups.map((group) => {
        const lowerName = group.name.trim().toLowerCase();
        const matches = targetNormalizedSet.has(lowerName);
        if (mode === 'replace') {
          return { ...group, inactive: matches };
        } else {
          return matches ? { ...group, inactive: true } : group;
        }
      });

      // Auto-create any girl groups in the list that don't exist yet
      const newGroups: GirlGroup[] = [];
      names.forEach((rawName) => {
        const cleaned = rawName.trim();
        if (!cleaned) return;
        const lower = cleaned.toLowerCase();
        if (!existingGroupsMap.has(lower)) {
          const newGroup: GirlGroup = {
            id: `group-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: cleaned,
            members: [],
            logoUrl: '',
            inactive: true,
          };
          newGroups.push(newGroup);
          existingGroupsMap.set(lower, newGroup);
        }
      });

      return {
        ...prev,
        girlGroups: [...updatedExistingGroups, ...newGroups],
      };
    });
  };

  const handleClearAllInactiveIdols = () => {
    setAppState((prev) => ({
      ...prev,
      idols: prev.idols.map((i) => ({ ...i, inactive: false })),
      girlGroups: prev.girlGroups.map((g) => ({ ...g, inactive: false })),
    }));
  };

  const handleClearAllInactiveGroups = () => {
    setAppState((prev) => ({
      ...prev,
      girlGroups: prev.girlGroups.map((g) => ({ ...g, inactive: false })),
    }));
  };

  const handleClearAllInactive = () => {
    setAppState((prev) => ({
      ...prev,
      idols: prev.idols.map((i) => ({ ...i, inactive: false })),
      girlGroups: prev.girlGroups.map((g) => ({ ...g, inactive: false })),
    }));
  };

  // --- HANDLERS: CONFIG & PARTICIPANTS ---
  const handleUpdateConfig = (newConfig: Partial<TournamentConfig>) => {
    setAppState((prev) => {
      const mergedConfig = {
        ...prev.config,
        ...newConfig,
        seasonId: Number(newConfig.seasonId ?? prev.config.seasonId ?? 1),
        seasonNumber: Number(newConfig.seasonNumber ?? prev.config.seasonNumber ?? prev.config.seasonId ?? 1),
      };
      return {
        ...prev,
        config: mergedConfig,
      };
    });
  };

  const handleUpdateSelectedParticipants = (ids: string[]) => {
    setAppState((prev) => ({
      ...prev,
      selectedParticipantIds: ids,
    }));
  };

  const handleEnsureIdolCount = (targetCount: number) => {
    setAppState((prev) => {
      let currentIdols = [...prev.idols];
      const existingNames = new Set(currentIdols.map((i) => i.name.trim().toLowerCase()));

      // 1. Add missing idols from INITIAL_IDOLS
      INITIAL_IDOLS.forEach((initIdol) => {
        const lower = initIdol.name.trim().toLowerCase();
        if (!existingNames.has(lower) && currentIdols.length < targetCount) {
          currentIdols.push(initIdol);
          existingNames.add(lower);
        }
      });

      // 2. Generate additional idols if needed
      let counter = 1;
      const seedOptions: ('Seed 1' | 'Seed 2' | 'Seed 3' | 'Seed 4')[] = ['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'];
      const groupOptions = ['IVE', 'aespa', 'TWICE', 'BLACKPINK', 'LE SSERAFIM', 'NewJeans', 'Red Velvet', 'ITZY', 'NMIXX', 'BABYMONSTER', 'ILLIT', 'KISS OF LIFE', 'Soloist'];

      while (currentIdols.length < targetCount) {
        const name = `Idol ${currentIdols.length + 1}`;
        const lower = name.toLowerCase();
        if (!existingNames.has(lower)) {
          const group = groupOptions[counter % groupOptions.length];
          const seed = seedOptions[counter % seedOptions.length];
          currentIdols.push({
            id: `idol-gen-${Date.now()}-${counter}-${Math.random().toString(36).substring(2, 6)}`,
            name,
            girlGroup: group,
            seed,
            nationality: 'South Korea',
            photoUrl: generateAvatarUrl(name, group),
            createdAt: Date.now(),
          });
          existingNames.add(lower);
        }
        counter++;
      }

      // Auto select targetCount idols
      const selected = currentIdols.slice(0, targetCount).map((i) => i.id);

      return {
        ...prev,
        idols: currentIdols,
        selectedParticipantIds: selected,
      };
    });
  };

  // --- HANDLERS: GROUP DRAW & MATCHES ---
  const handlePerformGroupDraw = () => {
    // If active tournament has a completed Grand Final, archive it before drawing groups
    const pendingRecord = getCompletedTournamentArchiveRecord(
      appState.config,
      appState.groups,
      appState.knockoutMatches,
      idolsMap
    );
    let updatedArchives = appState.archives;
    if (
      pendingRecord &&
      !appState.archives.some((a) => Number(a.seasonId) === Number(pendingRecord.seasonId))
    ) {
      updatedArchives = [...appState.archives, pendingRecord];
      saveTournamentArchives(updatedArchives);
    }

    const drawn = drawGroups(
      appState.idols,
      appState.selectedParticipantIds,
      appState.config
    );
    setAppState((prev) => ({
      ...prev,
      archives: updatedArchives,
      groups: drawn,
    }));
  };

  const handleUpdateGroupMatch = (
    groupId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string
  ) => {
    setAppState((prev) => {
      const updatedGroups = prev.groups.map((g) => {
        if (g.id === groupId) {
          return updateGroupMatchScore(
            g,
            matchId,
            scoreA,
            scoreB,
            winnerId,
            prev.idols
          );
        }
        return g;
      });
      const syncedDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        updatedGroups,
        prev.knockoutMatches,
        prev.idols
      );
      return { ...prev, groups: updatedGroups, matchDatabase: syncedDb };
    });
  };

  const handleSaveGroups = (updatedGroups: Group[]) => {
    setAppState((prev) => {
      const refreshedGroups = updatedGroups.map((g) => {
        const matches = generateRoundRobinMatches(g.id, g.name, g.memberIds);
        const standings = calculateGroupStandings(
          g.memberIds,
          matches,
          prev.config.qualifiedPerGroup
        );
        return {
          ...g,
          matches,
          standings,
        };
      });
      const syncedDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        refreshedGroups,
        prev.knockoutMatches,
        prev.idols
      );
      return {
        ...prev,
        groups: refreshedGroups,
        matchDatabase: syncedDb,
      };
    });
  };

  const handleSimulateAllGroupMatches = () => {
    setAppState((prev) => {
      const simulatedGroups = simulateAllGroupMatches(
        prev.groups,
        prev.idols,
        prev.config
      );
      const syncedDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        simulatedGroups,
        prev.knockoutMatches,
        prev.idols
      );
      return {
        ...prev,
        groups: simulatedGroups,
        matchDatabase: syncedDb,
      };
    });
  };

  const handleSimulateAllKnockoutMatches = () => {
    setAppState((prev) => {
      const simulatedKnockout = simulateAllKnockoutMatches(
        prev.knockoutMatches,
        prev.idols,
        prev.config
      );
      const syncedDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        prev.groups,
        simulatedKnockout,
        prev.idols
      );
      return {
        ...prev,
        knockoutMatches: simulatedKnockout,
        matchDatabase: syncedDb,
      };
    });
  };

  const handleSaveKnockoutMatches = (updatedMatches: KnockoutMatch[]) => {
    setAppState((prev) => {
      const syncedDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        prev.groups,
        updatedMatches,
        prev.idols
      );
      return {
        ...prev,
        knockoutMatches: updatedMatches,
        matchDatabase: syncedDb,
      };
    });
  };

  // --- HANDLERS: FINALIZE GROUP STAGE & BUILD KNOCKOUT ---
  const handleFinalizeGroupStageAndBuildKnockout = () => {
    const newKnockoutMatches = buildKnockoutBracket(
      appState.groups,
      appState.config,
      idolsMap
    );

    const syncedDb = syncAllMatchesToDatabase(
      appState.matchDatabase,
      appState.archives,
      appState.config,
      appState.groups,
      newKnockoutMatches,
      appState.idols
    );

    setAppState((prev) => ({
      ...prev,
      knockoutMatches: newKnockoutMatches,
      matchDatabase: syncedDb,
      config: { ...prev.config, isGroupStageFinished: true },
    }));

    setActiveTab('knockout');
  };

  // --- HANDLERS: KNOCKOUT MATCH UPDATE ---
  const handleUpdateKnockoutMatch = (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string
  ) => {
    setAppState((prev) => {
      const updatedKnockout = updateKnockoutMatchScore(
        prev.knockoutMatches,
        matchId,
        scoreA,
        scoreB,
        winnerId
      );
      const syncedDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        prev.groups,
        updatedKnockout,
        prev.idols
      );
      return { ...prev, knockoutMatches: updatedKnockout, matchDatabase: syncedDb };
    });
  };

  // --- HANDLERS: CROWN CHAMPION & ARCHIVE ---
  const handleCrownChampionAndArchive = () => {
    const currentSeasonId = Number(appState.config.seasonId || appState.config.seasonNumber || 1);
    let archiveRecord = getCompletedTournamentArchiveRecord(
      appState.config,
      appState.groups,
      appState.knockoutMatches,
      idolsMap
    );

    if (!archiveRecord) {
      const existing = appState.archives.find((a) => Number(a.seasonId) === currentSeasonId);
      if (existing && existing.championId) {
        archiveRecord = existing;
      } else {
        const gfDbMatch = appState.matchDatabase.find((m) => {
          if (Number(m.seasonId) !== currentSeasonId) return false;
          const st = (m.stage || '').toLowerCase();
          const mid = (m.matchId || '').toLowerCase();
          return (
            !st.includes('3rd') &&
            !st.includes('third') &&
            (st.includes('grand final') || st === 'final' || mid.includes('final') || mid.includes('gf'))
          );
        });
        if (gfDbMatch && (gfDbMatch.winnerId || gfDbMatch.winnerName)) {
          const champId = gfDbMatch.winnerId || (gfDbMatch.scoreA > gfDbMatch.scoreB ? gfDbMatch.idolAId : gfDbMatch.idolBId);
          const champName = gfDbMatch.winnerName || idolsMap.get(champId)?.name || 'Unknown';
          const rId = champId === gfDbMatch.idolAId ? gfDbMatch.idolBId : gfDbMatch.idolAId;
          const rName = champId === gfDbMatch.idolAId ? gfDbMatch.idolBName : gfDbMatch.idolAName;
          archiveRecord = {
            seasonId: currentSeasonId,
            seasonName: appState.config.seasonName || `Season ${currentSeasonId}`,
            completedAt: gfDbMatch.date || new Date().toISOString(),
            championId: champId,
            championName: champName,
            runnerUpId: rId,
            runnerUpName: rName,
            thirdPlaceId: '',
            thirdPlaceName: '',
            fourthPlaceId: '',
            fourthPlaceName: '',
            totalParticipants: appState.config.totalParticipants,
            groups: appState.groups || [],
            knockoutMatches: appState.knockoutMatches || [],
          };
        } else {
          alert('Grand Final is not completed yet!');
          return;
        }
      }
    }

    const updatedMatchDb = syncAllMatchesToDatabase(
      appState.matchDatabase,
      appState.archives,
      appState.config,
      appState.groups,
      appState.knockoutMatches,
      appState.idols
    );

    const storedLeagueArchives = loadLeagueArchives();
    const effectiveLeagueArchives =
      storedLeagueArchives.length > leagueArchives.length ? storedLeagueArchives : leagueArchives;

    const storedTheIdolsArchives = loadTheIdolsArchives();
    const effectiveTheIdolsArchives =
      storedTheIdolsArchives.length > theIdolsArchives.length ? storedTheIdolsArchives : theIdolsArchives;

    const storedTournamentArchives = loadTournamentArchives();
    const effectiveTournamentArchives =
      storedTournamentArchives.length > appState.archives.length ? storedTournamentArchives : appState.archives;

    // Calculate next unique season ID across all formats and match records
    const allSeasonIds = [
      currentSeasonId,
      ...effectiveTournamentArchives.map((a) => Number(a.seasonId || 1)),
      ...effectiveLeagueArchives.map((a) => Number(a.seasonNumber || 1)),
      ...effectiveTheIdolsArchives.map((a) => Number(a.seasonNumber || 1)),
      ...allCombinedMatchDatabase.map((m) => Number(m.seasonId || 1)),
    ].filter((n) => !Number.isNaN(n) && n > 0);
    const maxSeason = allSeasonIds.length > 0 ? Math.max(...allSeasonIds) : 1;
    const nextSeasonId = Math.max(currentSeasonId + 1, maxSeason + 1);

    // Archive and advance League Season matches & standings
    if (leagueState && leagueState.leagues && leagueState.leagues.length > 0) {
      const leagueArchiveRec = archiveLeagueSeason(leagueState, appState.idols);
      const updatedLeagueArchives = [
        ...effectiveLeagueArchives.filter((a) => a.seasonNumber !== leagueState.seasonNumber),
        leagueArchiveRec,
      ];
      setLeagueArchives(updatedLeagueArchives);
      saveLeagueArchives(updatedLeagueArchives);

      const nextLeagueState = advanceLeagueSeason(
        leagueState,
        appState.idols,
        appState.girlGroups,
        nextSeasonId
      );
      setLeagueState(nextLeagueState);
      saveLeagueSeasonState(nextLeagueState);
    }

    // Archive and advance The Idols Superleague & Masters Playoff
    if (theIdolsState && theIdolsState.memberIds && theIdolsState.memberIds.length > 0) {
      const idolsArchiveRec = archiveTheIdolsSeason(theIdolsState, appState.idols);
      const updatedTheIdolsArchives = [
        ...effectiveTheIdolsArchives.filter((a) => a.seasonNumber !== theIdolsState.seasonNumber),
        idolsArchiveRec,
      ];
      setTheIdolsArchives(updatedTheIdolsArchives);
      saveTheIdolsArchives(updatedTheIdolsArchives);

      const nextTheIdolsState = advanceTheIdolsSeason(
        theIdolsState,
        appState.idols,
        nextSeasonId,
        appState.girlGroups
      );
      setTheIdolsState(nextTheIdolsState);
      saveTheIdolsState(nextTheIdolsState);
    }

    const filteredArchives = effectiveTournamentArchives.filter(
      (a) => Number(a.seasonId) !== currentSeasonId
    );
    const newArchives = [...filteredArchives, archiveRecord];
    saveTournamentArchives(newArchives);

    setAppState((prev) => {
      const pFiltered = prev.archives.filter(
        (a) => Number(a.seasonId) !== currentSeasonId
      );
      return {
        ...prev,
        archives: [...pFiltered, archiveRecord],
        matchDatabase: updatedMatchDb,
        groups: [],
        knockoutMatches: [],
        selectedParticipantIds: [],
        config: {
          ...prev.config,
          seasonId: nextSeasonId,
          seasonNumber: nextSeasonId,
          seasonName: incrementSeasonName(prev.config.seasonName, nextSeasonId, 'Season'),
          isGroupStageFinished: false,
          isKnockoutFinished: false,
        },
      };
    });

    flushAppStateToIndexedDB();
    setActiveTab('hall_of_champions');
  };

  // --- HANDLERS: START NEW TOURNAMENT (RESET WORKSPACE) ---
  const handleStartNewTournament = () => {
    // v4 guard: block archiving while any competition is unfinished and name each one.
    const unfinished = getUnfinishedCompetitions({
      groups: appState.groups,
      knockoutMatches: appState.knockoutMatches,
      leagueState,
      theIdolsState,
      v5: loadV5State(),
      v5Names: loadNames(),
    });
    if (unfinished.length > 0) {
      alert('This season cannot be archived yet. Unfinished competitions:\n\n- ' + unfinished.join('\n- '));
      return;
    }
    setAppState((prev) => {
      const currentSeasonId = Number(prev.config.seasonId || prev.config.seasonNumber || 1);
      const allSeasonIds = [
        currentSeasonId,
        ...prev.archives.map((a) => Number(a.seasonId || 1)),
        ...prev.matchDatabase.map((m) => Number(m.seasonId || 1)),
      ].filter((n) => !Number.isNaN(n));
      const nextSeasonId = Math.max(1, ...allSeasonIds) + 1;

      // Sync active matches before clearing
      const updatedMatchDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        prev.groups,
        prev.knockoutMatches,
        prev.idols
      );

      // Auto-archive completed tournament if Grand Final was completed but not yet archived
      const pendingRecord = getCompletedTournamentArchiveRecord(
        prev.config,
        prev.groups,
        prev.knockoutMatches,
        idolsMap
      );
      let updatedArchives = prev.archives;
      if (pendingRecord && !prev.archives.some((a) => Number(a.seasonId) === Number(pendingRecord.seasonId))) {
        updatedArchives = [...prev.archives, pendingRecord];
        saveTournamentArchives(updatedArchives);
      }

      // Archive & advance League Season
      if (leagueState && leagueState.leagues && leagueState.leagues.length > 0) {
        const leagueArchiveRec = archiveLeagueSeason(leagueState, prev.idols);
        const updatedLeagueArchives = [
          ...leagueArchives.filter((a) => a.seasonNumber !== leagueState.seasonNumber),
          leagueArchiveRec,
        ];
        setLeagueArchives(updatedLeagueArchives);
        saveLeagueArchives(updatedLeagueArchives);

        const nextLeagueState = advanceLeagueSeason(
          leagueState,
          prev.idols,
          prev.girlGroups,
          nextSeasonId
        );
        setLeagueState(nextLeagueState);
        saveLeagueSeasonState(nextLeagueState);
      }

      // Archive & advance The Idols Season
      if (theIdolsState && theIdolsState.memberIds && theIdolsState.memberIds.length > 0) {
        const theIdolsArchiveRec = archiveTheIdolsSeason(theIdolsState, prev.idols);
        const updatedTheIdolsArchives = [
          ...theIdolsArchives.filter((a) => a.seasonNumber !== theIdolsState.seasonNumber),
          theIdolsArchiveRec,
        ];
        setTheIdolsArchives(updatedTheIdolsArchives);
        saveTheIdolsArchives(updatedTheIdolsArchives);

        const nextTheIdolsState = advanceTheIdolsSeason(
          theIdolsState,
          prev.idols,
          nextSeasonId,
          prev.girlGroups
        );
        setTheIdolsState(nextTheIdolsState);
        saveTheIdolsState(nextTheIdolsState);
      }

      return {
        ...prev,
        archives: updatedArchives,
        matchDatabase: updatedMatchDb,
        groups: [],
        knockoutMatches: [],
        selectedParticipantIds: [],
        config: {
          ...prev.config,
          seasonId: nextSeasonId,
          seasonNumber: nextSeasonId,
          seasonName: incrementSeasonName(prev.config.seasonName, nextSeasonId, 'Season'),
          isGroupStageFinished: false,
          isKnockoutFinished: false,
        },
      };
    });
    setActiveTab('competition');
  };

  // --- HANDLERS: DATA MANAGEMENT ---
  const handleExportData = () => {
    const dataStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `idol_tournament_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const handleImportData = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && (Array.isArray(parsed.idols) || parsed.config || parsed.exportVersion)) {
        const normalized = normalizeAppState(parsed, true);
        const fullySyncedDb = syncAllMatchesToDatabase(
          normalized.matchDatabase,
          normalized.archives,
          normalized.config,
          normalized.groups,
          normalized.knockoutMatches,
          normalized.idols
        );
        setAppState({
          ...normalized,
          matchDatabase: fullySyncedDb,
        });
        if (normalized.leagueState) {
          setLeagueState(normalized.leagueState);
          saveLeagueSeasonState(normalized.leagueState);
        }
        if (normalized.leagueArchives) {
          setLeagueArchives(normalized.leagueArchives);
          saveLeagueArchives(normalized.leagueArchives);
        }
      }
    } catch (e) {
      console.error('Error parsing JSON file.', e);
    }
  };

  // --- HANDLERS: SEASON & MATCH RESET (WITHOUT ARCHIVING) ---
  const handleResetCurrentSeason = () => {
    // 1. Reset League State (6 parallel divisions, Swiss stage, Wildcard play-in)
    if (leagueState) {
      const freshLeague = resetLeagueSeasonMatchesOnly(leagueState, appState.idols);
      setLeagueState(freshLeague);
      saveLeagueSeasonState(freshLeague);
    }

    // 2. Reset The Idols State (Superleague, playoffs, champions & honors)
    if (theIdolsState) {
      const freshTheIdols = resetTheIdolsSeasonMatchesOnly(theIdolsState, appState.idols);
      setTheIdolsState(freshTheIdols);
      saveTheIdolsState(freshTheIdols);
    }

    // 3. Reset Tournament AppState & unarchived matches
    setAppState((prev) => {
      const currentSeasonId = String(prev.config.seasonId || prev.config.seasonNumber || 1);
      const archivedSeasonIds = new Set(prev.archives.map((a) => String(a.seasonId || '')));
      // Remove any match database records associated ONLY with this unarchived active workspace season
      const cleanMatchDb = prev.matchDatabase.filter((m) => {
        const mSeasonId = String(m.seasonId || '');
        if (mSeasonId === currentSeasonId && !archivedSeasonIds.has(mSeasonId)) {
          return false;
        }
        return true;
      });

      const updatedAppState: AppState = {
        ...prev,
        matchDatabase: cleanMatchDb,
        groups: [],
        knockoutMatches: [],
        selectedParticipantIds: [],
        config: {
          ...prev.config,
          isStarted: false,
          isGroupStageFinished: false,
          isKnockoutFinished: false,
        },
      };

      saveAppState(updatedAppState);
      flushAppStateToIndexedDB();
      return updatedAppState;
    });

    setActiveTab('dashboard');
  };

  const handleResetGroupScoresOnly = () => {
    setAppState((prev) => {
      const currentSeasonId = String(prev.config.seasonId || prev.config.seasonNumber || 1);
      const archivedSeasonIds = new Set(prev.archives.map((a) => String(a.seasonId || '')));
      const cleanMatchDb = prev.matchDatabase.filter((m) => {
        const mSeasonId = String(m.seasonId || '');
        if (mSeasonId === currentSeasonId && !archivedSeasonIds.has(mSeasonId)) {
          return false;
        }
        return true;
      });

      const resetGroups = prev.groups.map((group) => {
        const clearedMatches = group.matches.map((m) => ({
          ...m,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          completed: false,
        }));
        const standings = calculateGroupStandings(
          group.memberIds,
          clearedMatches,
          prev.config.qualifiedPerGroup
        );
        return {
          ...group,
          matches: clearedMatches,
          standings,
        };
      });

      return {
        ...prev,
        matchDatabase: cleanMatchDb,
        groups: resetGroups,
        knockoutMatches: [],
        config: {
          ...prev.config,
          isGroupStageFinished: false,
          isKnockoutFinished: false,
        },
      };
    });
  };

  const handleResetKnockoutToGroupStage = () => {
    setAppState((prev) => {
      const currentSeasonId = String(prev.config.seasonId || prev.config.seasonNumber || 1);
      const archivedSeasonIds = new Set(prev.archives.map((a) => String(a.seasonId || '')));
      // Remove only knockout matches of the active unarchived season from match database
      const filteredMatchDb = prev.matchDatabase.filter((m) => {
        const mSeasonId = String(m.seasonId || '');
        if (mSeasonId === currentSeasonId && !archivedSeasonIds.has(mSeasonId)) {
          return m.stageName === 'Group Stage';
        }
        return true;
      });

      return {
        ...prev,
        matchDatabase: filteredMatchDb,
        knockoutMatches: [],
        config: {
          ...prev.config,
          isGroupStageFinished: false,
          isKnockoutFinished: false,
        },
      };
    });
    setActiveTab('group_stage');
  };

  const handleResetSingleGroupMatch = (groupId: string, matchId: string) => {
    setAppState((prev) => {
      const updatedGroups = resetGroupMatch(prev.groups, groupId, matchId);
      const updatedMatchDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        updatedGroups,
        prev.knockoutMatches,
        prev.idols
      );

      return {
        ...prev,
        groups: updatedGroups,
        matchDatabase: updatedMatchDb,
      };
    });
  };

  const handleResetSingleKnockoutMatch = (matchId: string) => {
    setAppState((prev) => {
      const updatedKnockout = resetKnockoutMatch(prev.knockoutMatches, matchId);
      const updatedMatchDb = syncAllMatchesToDatabase(
        prev.matchDatabase,
        prev.archives,
        prev.config,
        prev.groups,
        updatedKnockout,
        prev.idols
      );

      return {
        ...prev,
        knockoutMatches: updatedKnockout,
        matchDatabase: updatedMatchDb,
      };
    });
  };

  const handleResetData = () => {
    const result = clearAllAppDataAndStorage();
    setAppState(result.appState);
    setLeagueState(result.leagueState);
    setLeagueArchives(result.leagueArchives);
    setTheIdolsState(result.theIdolsState);
    setTheIdolsArchives(result.theIdolsArchives);
  };

  return (
    <div className="flex h-screen bg-[#120e0b] text-amber-50 overflow-hidden font-poster-body antialiased selection:bg-red-700 selection:text-white">
      {/* Sidebar Navigation (Desktop Fixed + Mobile Slide-out Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isTournamentActive={appState.config.isStarted}
        seasonNumber={derivedSeasonStats.currentSeasonNumber}
        appLogoUrl={appState.appLogoUrl}
        onUpdateAppLogo={(logoUrl) => {
          setAppState((prev) => ({
            ...prev,
            appLogoUrl: logoUrl,
          }));
        }}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-w-0">
        {/* Mobile Top App Bar */}
        <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-[#1a130e] border-b-2 border-black sticky top-0 z-30 poster-shadow-sm flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black bg-[#2c1d13] text-amber-300 hover:bg-[#3b271a] active:scale-95 poster-shadow-sm flex-shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-black bg-red-700 text-white overflow-hidden flex-shrink-0">
                {appState.appLogoUrl ? (
                  <img src={appState.appLogoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Trophy className="h-4 w-4 text-amber-300" />
                )}
              </div>
              <div className="truncate">
                <div className="font-poster-title text-sm text-red-500 tracking-wider truncate">
                  SABUNG IDOL
                </div>
                <div className="text-[10px] font-black uppercase text-amber-400/90 truncate">
                  {activeTab.replace('_', ' ')}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-300">
              S{derivedSeasonStats.currentSeasonNumber}
            </span>
          </div>
        </header>

        {/* Sabung Idol Poster Style Top Checkered Strip */}
        <div className="h-2 w-full checkered-banner border-b border-red-950/80 flex-shrink-0" />
        
        <div className="flex-1 p-3 sm:p-5 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              config={appState.config}
              groups={appState.groups}
              knockoutMatches={appState.knockoutMatches}
              matchDatabase={allCombinedMatchDatabase}
              archives={appState.archives}
              setActiveTab={setActiveTab}
              updateConfig={handleUpdateConfig}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              onCrownChampionAndArchive={handleCrownChampionAndArchive}
            />
          )}

          {activeTab === 'rank_panel' && (
            <RankPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              careerStats={careerStats}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              appState={appState}
              updateConfig={handleUpdateConfig}
              onImportState={(newState, newLeagueState, newLeagueArchives, newTheIdolsState, newTheIdolsArchives) => {
                const fullySyncedDb = syncAllMatchesToDatabase(
                  newState.matchDatabase,
                  newState.archives,
                  newState.config,
                  newState.groups,
                  newState.knockoutMatches,
                  newState.idols
                );
                setAppState({
                  ...newState,
                  matchDatabase: fullySyncedDb,
                });
                if (newLeagueState !== undefined) {
                  setLeagueState(newLeagueState);
                  if (newLeagueState) saveLeagueSeasonState(newLeagueState);
                }
                if (newLeagueArchives !== undefined) {
                  setLeagueArchives(newLeagueArchives);
                  saveLeagueArchives(newLeagueArchives);
                }

                const resolvedTheIdolsState = newTheIdolsState !== undefined
                  ? newTheIdolsState
                  : (newState.theIdolsState !== undefined
                      ? newState.theIdolsState
                      : initializeTheIdolsSeason(newState.idols, 1, newState.girlGroups));
                const resolvedTheIdolsArchives = newTheIdolsArchives !== undefined
                  ? newTheIdolsArchives
                  : (newState.theIdolsArchives !== undefined
                      ? newState.theIdolsArchives
                      : []);

                setTheIdolsState(resolvedTheIdolsState);
                if (resolvedTheIdolsState) saveTheIdolsState(resolvedTheIdolsState);

                setTheIdolsArchives(resolvedTheIdolsArchives);
                saveTheIdolsArchives(resolvedTheIdolsArchives);
              }}
              onResetWorkspace={handleStartNewTournament}
              onRestoreDefaultData={handleResetData}
              onResetCurrentSeason={handleResetCurrentSeason}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              onUpdateLeagueState={handleUpdateLeagueState}
              onUpdateLeagueArchives={(newArchives) => {
                setLeagueArchives(newArchives);
                saveLeagueArchives(newArchives);
              }}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              onUpdateTheIdolsState={handleUpdateTheIdolsState}
              onUpdateTheIdolsArchives={handleUpdateTheIdolsArchives}
              onUpdateIdols={(updatedIdols) => {
                setAppState((prev) => ({
                  ...prev,
                  idols: updatedIdols,
                }));
              }}
              onUpdateAppState={setAppState}
              careerStats={careerStats}
              careerOverrides={careerOverrides}
              onSaveOverrides={(newOverrides) => {
                setCareerOverrides(newOverrides);
                saveCareerOverrides(newOverrides);
              }}
              onRefreshAllStats={() => {
                setCareerOverrides(loadCareerOverrides());
              }}
            />
          )}

          {activeTab === 'idols' && (
            <IdolDatabasePanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              matchDatabase={allCombinedMatchDatabase}
              onUpdateIdolPhoto={(idolId, photoUrl) => {
                setAppState((prev) => ({
                  ...prev,
                  idols: prev.idols.map((i) => (i.id === idolId ? { ...i, photoUrl } : i)),
                }));
              }}
              onAddIdolManually={handleAddIdol}
              onDeleteIdol={handleDeleteIdol}
              onSelectIdolProfile={handleSelectIdolProfile}
              onToggleIdolActive={handleToggleIdolInactive}
            />
          )}

          {activeTab === 'groups' && (
            <GirlGroupManagerPanel
              girlGroups={appState.girlGroups}
              idols={appState.idols}
              onAddGirlGroup={handleAddGirlGroup}
              onUpdateGroupMembers={handleUpdateGroupMembers}
              onUpdateGroupLogo={(groupId, logoUrl) => {
                setAppState((prev) => ({
                  ...prev,
                  girlGroups: prev.girlGroups.map((g) => (g.id === groupId ? { ...g, logoUrl } : g)),
                }));
              }}
              onDeleteGroup={handleDeleteGirlGroup}
              onDeleteMemberFromGroup={handleDeleteMemberFromGroup}
            />
          )}

          {activeTab === 'ratings' && (
            <RatingPanel
              idols={appState.idols}
              careerStats={careerStats}
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
              leagueArchives={leagueArchives}
              leagueState={leagueState}
              currentGroups={appState.groups}
              currentKnockoutMatches={appState.knockoutMatches}
              currentConfig={appState.config}
              onUpdateIdols={(updatedIdols) => {
                setAppState((prev) => ({
                  ...prev,
                  idols: updatedIdols,
                }));
                if (theIdolsState) {
                  const syncedState = syncTheIdolsStateWithLatestIdols(
                    theIdolsState,
                    updatedIdols,
                    appState.girlGroups
                  );
                  setTheIdolsState(syncedState);
                  saveTheIdolsState(syncedState);
                }
              }}
            />
          )}

          {activeTab === 'seeds' && (
            <SeedManagerPanel
              idols={appState.idols}
              onUpdateSeedTierList={handleUpdateSeedTierList}
              onClearSeedTierList={handleClearSeedTierList}
            />
          )}

          {activeTab === 'inactive_manager' && (
            <InactiveManagerPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              onToggleIdolActive={handleToggleIdolInactive}
              onToggleIdolInactive={handleToggleIdolInactive}
              onToggleGroupActive={handleToggleGroupInactive}
              onToggleGroupInactive={handleToggleGroupInactive}
              onUpdateInactiveIdolsList={handleUpdateInactiveIdolsList}
              onUpdateInactiveGroupsList={handleUpdateInactiveGroupsList}
              onClearAllInactiveIdols={handleClearAllInactiveIdols}
              onClearAllInactiveGroups={handleClearAllInactiveGroups}
              onClearAllInactive={handleClearAllInactive}
            />
          )}

          {activeTab === 'nationalities' && (
            <NationalityManagerPanel
              idols={appState.idols}
              customNationalities={appState.customNationalities}
              onUpdateNationalityTierList={handleUpdateNationalityTierList}
              onClearNationalityTierList={handleClearNationalityTierList}
              onAddCustomNationality={handleAddCustomNationality}
              onDeleteCustomNationality={handleDeleteCustomNationality}
            />
          )}

          {activeTab === 'competition' && (
            <CompetitionManagerPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
              config={appState.config}
              selectedParticipantIds={appState.selectedParticipantIds}
              onUpdateSelectedParticipants={handleUpdateSelectedParticipants}
              onUpdateConfig={handleUpdateConfig}
              onEnsureIdolCount={handleEnsureIdolCount}
              onProceedToGroupDraw={() => {
                handlePerformGroupDraw();
                setActiveTab('draw');
              }}
            />
          )}

          {activeTab === 'draw' && (
            <GroupDrawPanel
              groups={appState.groups}
              idolsMap={idolsMap}
              config={appState.config}
              onRedrawGroups={handlePerformGroupDraw}
              onStartGroupStage={() => setActiveTab('group_stage')}
              onSaveGroups={handleSaveGroups}
              onUpdateFavoriteIdols={(favoriteIds) => {
                setAppState((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    favoriteIdolIds: favoriteIds,
                  },
                }));
              }}
            />
          )}

          {activeTab === 'group_stage' && (
            <GroupStagePanel
              groups={appState.groups}
              idolsMap={idolsMap}
              config={appState.config}
              onUpdateGroupMatch={handleUpdateGroupMatch}
              onFinalizeGroupStageAndBuildKnockout={handleFinalizeGroupStageAndBuildKnockout}
              onSaveGroups={handleSaveGroups}
              onResetCurrentSeason={handleResetCurrentSeason}
              onResetGroupScoresOnly={handleResetGroupScoresOnly}
              onResetSingleGroupMatch={handleResetSingleGroupMatch}
              onSimulateAllMatches={handleSimulateAllGroupMatches}
            />
          )}

          {activeTab === 'knockout' && (
            <KnockoutBracketPanel
              knockoutMatches={appState.knockoutMatches}
              idolsMap={idolsMap}
              config={appState.config}
              onUpdateKnockoutMatch={handleUpdateKnockoutMatch}
              onCrownChampionAndArchive={handleCrownChampionAndArchive}
              onSaveKnockoutMatches={handleSaveKnockoutMatches}
              onRegenerateAutoBracket={handleFinalizeGroupStageAndBuildKnockout}
              onResetCurrentSeason={handleResetCurrentSeason}
              onResetKnockoutOnly={handleResetKnockoutToGroupStage}
              onResetSingleKnockoutMatch={handleResetSingleKnockoutMatch}
              onSimulateAllMatches={handleSimulateAllKnockoutMatches}
            />
          )}

          {activeTab === 'season_simulator' && (
            <SeasonSimulatorPanel
              appState={appState}
              onUpdateAppState={setAppState}
              leagueState={leagueState}
              onUpdateLeagueState={handleUpdateLeagueState}
              theIdolsState={theIdolsState}
              onUpdateTheIdolsState={handleUpdateTheIdolsState}
              leagueArchives={leagueArchives}
              onUpdateLeagueArchives={handleUpdateLeagueArchives}
              theIdolsArchives={theIdolsArchives}
              onUpdateTheIdolsArchives={handleUpdateTheIdolsArchives}
              setActiveTab={setActiveTab}
              onCrownChampionAndArchive={handleCrownChampionAndArchive}
            />
          )}

          {activeTab === 'league_system' && (
            <LeagueSystemPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              config={appState.config}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              onUpdateLeagueState={handleUpdateLeagueState}
              onUpdateLeagueArchives={(newArchives) => {
                setLeagueArchives(newArchives);
                saveLeagueArchives(newArchives);
              }}
              onAdvanceToChampionsTournament={handleAdvanceToChampionsTournament}
              onUpdateFavoriteIdols={(favoriteIds) => {
                setAppState((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    favoriteIdolIds: favoriteIds,
                  },
                }));
              }}
              setActiveTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'v5_cups' && (
            <V5CupsPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              leagueState={leagueState}
              v5State={v5State}
              onUpdateV5State={handleUpdateV5State}
              onUpdateLeagueState={handleUpdateLeagueState}
              theIdolsChampionId={theIdolsState?.championId || null}
              knockoutMatches={appState.knockoutMatches || []}
            />
          )}
          {activeTab === 'the_idols' && (
            <TheIdolsPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              favoriteIdolIds={appState.config.favoriteIdolIds || []}
              onUpdateState={handleUpdateTheIdolsState}
              onUpdateArchives={handleUpdateTheIdolsArchives}
              onSelectIdolProfile={(id) => {
                setSelectedIdolId(id);
                setActiveTab('idol_profile');
              }}
              onNavigateToArchive={() => setActiveTab('archive')}
            />
          )}

          {activeTab === 'public_results' && (
            <PublicResultsPanel
              groups={appState.groups}
              knockoutMatches={appState.knockoutMatches}
              idolsMap={idolsMap}
              idols={appState.idols}
              config={appState.config}
              leagueState={leagueState}
              theIdolsState={theIdolsState}
            />
          )}

          {activeTab === 'match_db' && (
            <MatchDatabasePanel
              matchDatabase={allCombinedMatchDatabase}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              idols={appState.idols}
            />
          )}

          {activeTab === 'career_stats' && (
            <CareerStatsPanel
              careerStats={careerStats}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              idols={appState.idols}
              matchDatabase={allCombinedMatchDatabase}
              archives={appState.archives}
              onSelectIdolProfile={(id) => {
                setSelectedIdolId(id);
                setActiveTab('idol_profile');
              }}
            />
          )}

          {activeTab === 'girl_group_stats' && (
            <GirlGroupStatsPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
              leagueArchives={leagueArchives}
              leagueState={leagueState}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
            />
          )}

          {activeTab === 'season_profile' && (
            <SeasonProfilePanel
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
              idolsMap={idolsMap}
              currentGroups={appState.groups}
              currentKnockoutMatches={appState.knockoutMatches}
              currentConfig={appState.config}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
            />
          )}

          {activeTab === 'idol_profile' && (
            <IdolProfilePanel
              idols={appState.idols}
              careerStats={careerStats}
              matchDatabase={allCombinedMatchDatabase}
              selectedIdolId={selectedIdolId}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              archives={appState.archives}
              config={appState.config}
              groups={appState.groups}
              knockoutMatches={appState.knockoutMatches}
              onUpdateIdolPhoto={(idolId, photoUrl) => {
                setAppState((prev) => ({
                  ...prev,
                  idols: prev.idols.map((i) => (i.id === idolId ? { ...i, photoUrl } : i)),
                }));
              }}
              onUpdateIdols={(updatedIdols) => {
                setAppState((prev) => ({
                  ...prev,
                  idols: updatedIdols,
                }));
              }}
            />
          )}

          {activeTab === 'h2h' && (
            <HeadToHeadPanel
              idols={appState.idols}
              matchDatabase={allCombinedMatchDatabase}
              careerStats={careerStats}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              archives={appState.archives}
            />
          )}

          {activeTab === 'hall_of_champions' && (
            <HallOfChampionsPanel
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
              idolsMap={idolsMap}
              currentGroups={appState.groups}
              currentKnockoutMatches={appState.knockoutMatches}
              currentConfig={appState.config}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              v5State={v5State}
              onReconcileArchives={handleReconcileArchives}
            />
          )}

          {activeTab === 'all_time_records' && (
            <AllTimeRecordsPanel
              careerStats={careerStats}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              idols={appState.idols}
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
            />
          )}

          {activeTab === 'archive' && (
            <TournamentBrowserPanel
              archives={appState.archives}
              matchDatabase={allCombinedMatchDatabase}
              idolsMap={idolsMap}
              currentGroups={appState.groups}
              currentKnockoutMatches={appState.knockoutMatches}
              currentConfig={appState.config}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
            />
          )}

          {activeTab === 'system_info' && (
            <SystemInfoPanel
              idols={appState.idols}
              girlGroups={appState.girlGroups}
              matchDatabase={allCombinedMatchDatabase}
              archives={appState.archives}
              leagueArchives={leagueArchives}
              theIdolsArchives={theIdolsArchives}
              totalCompletedSeasons={derivedSeasonStats.totalCompletedSeasons}
            />
          )}



          {activeTab === 'data_studio' && (
            <DatabaseStudioPanel
              appState={appState}
              leagueState={leagueState}
              leagueArchives={leagueArchives}
              theIdolsState={theIdolsState}
              theIdolsArchives={theIdolsArchives}
              careerStats={careerStats}
              onUpdateAppState={(updater) => {
                setAppState(updater);
              }}
              onUpdateLeagueState={handleUpdateLeagueState}
              onUpdateLeagueArchives={handleUpdateLeagueArchives}
              onUpdateTheIdolsState={handleUpdateTheIdolsState}
              onUpdateTheIdolsArchives={handleUpdateTheIdolsArchives}
              onRefreshAllStats={() => {
                setCareerOverrides(loadCareerOverrides());
              }}
              setActiveTab={setActiveTab}
              onSelectIdol={handleSelectIdolProfile}
            />
          )}
        </div>
      </div>
    </main>
    </div>
  );
}

export default App;
