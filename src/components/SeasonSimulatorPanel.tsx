import React, { useState, useMemo, useEffect } from 'react';
import {
  Idol,
  GirlGroup,
  AppState,
  LeagueSeasonState,
  TheIdolsSeasonState,
  LeagueSeasonArchive,
  TheIdolsSeasonArchive,
  ActiveTab,
  PostseasonFormatType,
} from '../types';
import {
  FastForward,
  Trophy,
  Crown,
  Swords,
  Sparkles,
  Award,
  CheckCircle2,
  Play,
  RotateCcw,
  Layers,
  ArrowRight,
  ShieldAlert,
  Flame,
  Star,
  Download,
  Calendar,
  ChevronRight,
  BarChart3,
  ExternalLink,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  simulateEntireSeason,
  SeasonSimulationSummary,
} from '../utils/seasonSimulatorLogic';
import { saveLeagueSeasonState, saveLeagueArchives } from '../utils/leagueLogic';
import { saveTheIdolsState, saveTheIdolsArchives } from '../utils/theIdolsLogic';
import { saveTournamentArchives, calculateCurrentSeasonNumber, flushAppStateToIndexedDB } from '../utils/storage';
import { getIdolRating, getRatingTierInfo } from '../utils/ratingHelper';
import type { V5State } from '../utils/v5/store';

interface SeasonSimulatorPanelProps {
  appState: AppState;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  leagueState: LeagueSeasonState | null;
  onUpdateLeagueState: (newState: LeagueSeasonState) => void;
  theIdolsState: TheIdolsSeasonState | null;
  onUpdateTheIdolsState: (newState: TheIdolsSeasonState) => void;
  leagueArchives?: LeagueSeasonArchive[];
  onUpdateLeagueArchives?: (newArchives: LeagueSeasonArchive[]) => void;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  onUpdateTheIdolsArchives?: (newArchives: TheIdolsSeasonArchive[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onCrownChampionAndArchive: () => void;
  v5State?: V5State | null;
  onUpdateV5State?: (state: V5State) => void;
  v5TitleArchives?: import('../utils/v5/store').V5TitleArchive[];
}

export const SeasonSimulatorPanel: React.FC<SeasonSimulatorPanelProps> = ({
  appState,
  onUpdateAppState,
  leagueState,
  onUpdateLeagueState,
  theIdolsState,
  onUpdateTheIdolsState,
  leagueArchives = [],
  onUpdateLeagueArchives,
  theIdolsArchives = [],
  onUpdateTheIdolsArchives,
  setActiveTab,
  onCrownChampionAndArchive,
  v5State,
  onUpdateV5State,
  v5TitleArchives = [],
}) => {
  const seasonStats = useMemo(() => {
    return calculateCurrentSeasonNumber(
      appState.archives,
      leagueArchives,
      theIdolsArchives,
      appState.matchDatabase,
      appState.config.seasonNumber,
      leagueState,
      theIdolsState
    );
  }, [
    appState.archives,
    leagueArchives,
    theIdolsArchives,
    appState.matchDatabase,
    appState.config.seasonNumber,
    leagueState?.seasonNumber,
    theIdolsState?.seasonNumber,
  ]);

  const currentSeasonNumber = seasonStats.currentSeasonNumber;

  const [seasonNameInput, setSeasonNameInput] = useState<string>(
    appState.config.seasonName || `Season ${currentSeasonNumber}`
  );
  const [selectedFormat, setSelectedFormat] = useState<PostseasonFormatType>(
    leagueState?.postseasonFormat || 'grand_cup_64'
  );
  const [isNameDirty, setIsNameDirty] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SeasonSimulationSummary | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'overview' | 'leagues' | 'champions' | 'the_idols' | 'wildcard'>('overview');
  const [selectedLeagueId, setSelectedLeagueId] = useState<number>(1);
  const [selectedSwissPool, setSelectedSwissPool] = useState<'all' | 'pool_a' | 'pool_b' | 'pool_c' | 'pool_d' | 'last_chance'>('all');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Keep season name input synced if config advances and user hasn't typed a custom dirty name
  useEffect(() => {
    if (!isNameDirty) {
      setSeasonNameInput(appState.config.seasonName || `Season ${currentSeasonNumber}`);
    }
  }, [appState.config.seasonName, currentSeasonNumber, isNameDirty]);

  // Keep selected format synced if league state changes
  useEffect(() => {
    if (leagueState?.postseasonFormat) {
      setSelectedFormat(leagueState.postseasonFormat);
    }
  }, [leagueState?.postseasonFormat]);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    appState.idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [appState.idols]);

  // Determine current season status across formats
  const isLeaguesCompleted = Boolean(
    leagueState &&
      leagueState.leagues.length > 0 &&
      leagueState.leagues.every((l) => (l.matches || []).length > 0 && l.matches.every((m) => m.completed))
  );

  const isChampionsCompleted = Boolean(
    appState.knockoutMatches &&
      appState.knockoutMatches.length > 0 &&
      appState.knockoutMatches.some(
        (m) =>
          ((m.roundName || '').toLowerCase().includes('grand final') ||
            (m.roundName || '').toLowerCase() === 'final') &&
          m.completed &&
          m.winnerId
      )
  );

  const isTheIdolsCompleted = Boolean(
    theIdolsState &&
      theIdolsState.isLeagueCompleted &&
      theIdolsState.isPlayoffCompleted &&
      theIdolsState.championId
  );

  const isFullSeasonCompleted = isLeaguesCompleted && isChampionsCompleted && isTheIdolsCompleted;

  // Handle Season Rename
  const handleSaveSeasonName = () => {
    const trimmed = seasonNameInput.trim();
    if (!trimmed) return;

    onUpdateAppState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        seasonName: trimmed,
        customTournamentTitle: trimmed,
      },
    }));

    if (leagueState) {
      const updatedLeague: LeagueSeasonState = {
        ...leagueState,
        seasonName: trimmed,
      };
      onUpdateLeagueState(updatedLeague);
      saveLeagueSeasonState(updatedLeague);
    }

    if (theIdolsState) {
      const updatedTheIdols: TheIdolsSeasonState = {
        ...theIdolsState,
        seasonName: `The Idols: ${trimmed}`,
      };
      onUpdateTheIdolsState(updatedTheIdols);
      saveTheIdolsState(updatedTheIdols);
    }

    setIsNameDirty(false);
    setSuccessBanner(`Season renamed to "${trimmed}" across all tournament formats!`);
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleArchiveSeasonAndAdvance = () => {
    if (simulationResult) {
      if (simulationResult.updatedTournamentArchives) {
        saveTournamentArchives(simulationResult.updatedTournamentArchives);
      }
      if (simulationResult.updatedLeagueArchives) {
        if (onUpdateLeagueArchives) onUpdateLeagueArchives(simulationResult.updatedLeagueArchives);
        saveLeagueArchives(simulationResult.updatedLeagueArchives);
      }
      if (simulationResult.updatedTheIdolsArchives) {
        if (onUpdateTheIdolsArchives) onUpdateTheIdolsArchives(simulationResult.updatedTheIdolsArchives);
        saveTheIdolsArchives(simulationResult.updatedTheIdolsArchives);
      }
      onUpdateAppState((prev) => ({
        ...prev,
        archives: simulationResult.updatedTournamentArchives,
        knockoutMatches: simulationResult.updatedAppState.knockoutMatches,
        groups: simulationResult.updatedAppState.groups,
        matchDatabase: simulationResult.syncedMatchDatabase,
        v5State: simulationResult.updatedV5State || prev.v5State,
        v5TitleArchives: simulationResult.updatedV5TitleArchives || prev.v5TitleArchives,
      }));
    }
    flushAppStateToIndexedDB();
    setSimulationResult(null);
    onCrownChampionAndArchive();
  };

  // Master 1-Click Simulation of Entire Season
  const handleSimulateWholeSeason = () => {
    setIsSimulating(true);
    setSuccessBanner(null);

    // Short timeout for browser paint
    setTimeout(() => {
      try {
        const summary = simulateEntireSeason(
          appState,
          leagueState,
          theIdolsState,
          seasonNameInput.trim(),
          selectedFormat,
          leagueArchives,
          theIdolsArchives,
          v5State,
          v5TitleArchives
        );

        // Update active season workspace state for interactive inspection without archiving prematurely
        onUpdateAppState((prev) => ({
          ...prev,
          config: summary.updatedAppState.config,
          selectedParticipantIds: summary.updatedAppState.selectedParticipantIds,
          groups: summary.updatedAppState.groups,
          knockoutMatches: summary.updatedAppState.knockoutMatches,
          matchDatabase: summary.syncedMatchDatabase,
          leagueState: summary.updatedLeagueState,
          theIdolsState: summary.updatedTheIdolsState,
          v5State: summary.updatedV5State || prev.v5State,
          v5TitleArchives: summary.updatedV5TitleArchives || prev.v5TitleArchives,
        }));

        onUpdateLeagueState(summary.updatedLeagueState);
        saveLeagueSeasonState(summary.updatedLeagueState);

        onUpdateTheIdolsState(summary.updatedTheIdolsState);
        saveTheIdolsState(summary.updatedTheIdolsState);

        if (summary.updatedV5State && onUpdateV5State) onUpdateV5State(summary.updatedV5State);

        setSimulationResult(summary);
        setSelectedFormat(summary.postseasonFormat);
        const playInText = summary.postseasonFormat === 'grand_cup_64' ? 'Swiss Play-In (28 Qualifiers)' : 'Wildcard Play-In';
        const tournText = summary.postseasonFormat === 'grand_cup_64' ? 'Grand Cup 64' : 'Champions Tournament (32)';
        setSuccessBanner(
          `Season ${summary.seasonNumber} simulated completely! ${summary.totalMatchesSimulated} matches simulated across 6 Leagues, ${playInText}, ${tournText}, and The Idols Superleague & Masters.`
        );
      } catch (err) {
        console.error('Failed during season simulation:', err);
        alert('An error occurred during full season simulation. Please check console for details.');
      } finally {
        setIsSimulating(false);
      }
    }, 100);
  };

  // Extract display data (prefer live simulation result if freshly run, or fall back to current app state)
  const displayLeagues = useMemo(() => {
    if (simulationResult?.leagues) {
      return simulationResult.leagues;
    }
    if (leagueState && leagueState.leagues) {
      return leagueState.leagues.map((l) => {
        const champ = l.standings && l.standings.length > 0 ? idolsMap.get(l.standings[0].idolId) : undefined;
        const runnerUp = l.standings && l.standings.length > 1 ? idolsMap.get(l.standings[1].idolId) : undefined;
        const third = l.standings && l.standings.length > 2 ? idolsMap.get(l.standings[2].idolId) : undefined;

        let topScorer: { idol: Idol; goals: number } | undefined;
        if (l.standings && l.standings.length > 0) {
          const highestGoals = [...l.standings].sort((a, b) => (b.gamesFor || 0) - (a.gamesFor || 0))[0];
          if (highestGoals && highestGoals.gamesFor > 0) {
            const scorerIdol = idolsMap.get(highestGoals.idolId);
            if (scorerIdol) {
              topScorer = { idol: scorerIdol, goals: highestGoals.gamesFor };
            }
          }
        }

        return {
          leagueId: l.id,
          name: l.name,
          tierName: l.tierName,
          color: l.color,
          logoUrl: l.logoUrl || '',
          description: l.description,
          championIdol: champ,
          runnerUpIdol: runnerUp,
          thirdPlaceIdol: third,
          standings: l.standings || [],
          topScorer,
          totalMatches: (l.matches || []).length,
        };
      });
    }
    return [];
  }, [simulationResult, leagueState, idolsMap]);

  const activeSelectedLeague = displayLeagues.find((l) => l.leagueId === selectedLeagueId) || displayLeagues[0];

  // Champions Tournament Data
  const championsData = useMemo(() => {
    if (simulationResult?.championsTournament) {
      return simulationResult.championsTournament;
    }

    const grandFinal = (appState.knockoutMatches || []).find(
      (m) =>
        !m.isThirdPlaceMatch &&
        !(m.roundName || '').toLowerCase().includes('3rd') &&
        !(m.roundName || '').toLowerCase().includes('third') &&
        !(m.roundName || '').toLowerCase().includes('bronze') &&
        ((m.roundName || '').toLowerCase().includes('grand final') ||
          (m.roundName || '').toLowerCase() === 'final' ||
          ((m.roundName || '').toLowerCase().includes('final') &&
            !(m.roundName || '').toLowerCase().includes('semi') &&
            !(m.roundName || '').toLowerCase().includes('quarter')))
    );

    const thirdMatch = (appState.knockoutMatches || []).find(
      (m) =>
        Boolean(m.isThirdPlaceMatch) ||
        (m.roundName || '').toLowerCase().includes('3rd') ||
        (m.roundName || '').toLowerCase().includes('third') ||
        (m.roundName || '').toLowerCase().includes('bronze')
    );

    const championIdol = grandFinal?.winnerId ? idolsMap.get(grandFinal.winnerId) : undefined;
    const runnerUpId =
      grandFinal?.winnerId === grandFinal?.idolAId
        ? grandFinal?.idolBId || ''
        : grandFinal?.idolAId || '';
    const runnerUpIdol = runnerUpId ? idolsMap.get(runnerUpId) : undefined;
    const thirdPlaceIdol = thirdMatch?.winnerId ? idolsMap.get(thirdMatch.winnerId) : undefined;
    const fourthPlaceId =
      thirdMatch && thirdMatch.winnerId
        ? thirdMatch.winnerId === thirdMatch.idolAId
          ? thirdMatch.idolBId || ''
          : thirdMatch.idolAId || ''
        : '';
    const fourthPlaceIdol = fourthPlaceId ? idolsMap.get(fourthPlaceId) : undefined;

    const grandFinalScore = grandFinal && grandFinal.completed
      ? {
          idolAName: idolsMap.get(grandFinal.idolAId || '')?.name || 'TBD',
          idolBName: idolsMap.get(grandFinal.idolBId || '')?.name || 'TBD',
          scoreA: grandFinal.scoreA ?? 0,
          scoreB: grandFinal.scoreB ?? 0,
          winnerName: idolsMap.get(grandFinal.winnerId || '')?.name || 'Unknown',
        }
      : undefined;

    return {
      championIdol,
      runnerUpIdol,
      thirdPlaceIdol,
      fourthPlaceIdol,
      grandFinalScore,
      groups: appState.groups || [],
      knockoutMatches: appState.knockoutMatches || [],
    };
  }, [simulationResult, appState.knockoutMatches, appState.groups, idolsMap]);

  // The Idols Data
  const theIdolsData = useMemo(() => {
    if (simulationResult?.theIdols) {
      return simulationResult.theIdols;
    }
    if (theIdolsState) {
      return {
        superleagueWinner:
          theIdolsState.standings.length > 0 ? idolsMap.get(theIdolsState.standings[0].idolId) : undefined,
        mastersChampion: theIdolsState.championId ? idolsMap.get(theIdolsState.championId) : undefined,
        mastersRunnerUp: theIdolsState.runnerUpId ? idolsMap.get(theIdolsState.runnerUpId) : undefined,
        thirdPlace: theIdolsState.thirdPlaceId ? idolsMap.get(theIdolsState.thirdPlaceId) : undefined,
        mvp: theIdolsState.mvpId ? idolsMap.get(theIdolsState.mvpId) : undefined,
        standings: theIdolsState.standings || [],
        playoffMatches: theIdolsState.playoffMatches || [],
      };
    }
    return null;
  }, [simulationResult, theIdolsState, idolsMap]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* ============================================================ */}
      {/* 1. MASTER HEADER & SEASON RENAMING PANEL                     */}
      {/* ============================================================ */}
      <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 lg:p-8 poster-shadow-lg relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <FastForward className="w-3.5 h-3.5" />
                Tournament Workspace
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-black/60 border border-amber-600/30 text-slate-400 text-xs font-mono">
                Season #{currentSeasonNumber}
              </span>
              {isFullSeasonCompleted ? (
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  All Formats Complete
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-950/60 border border-amber-600/30 text-amber-300 text-xs font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  Ready to Simulate
                </span>
              )}
            </div>

            <h1 className="text-3xl lg:text-4xl font-black text-amber-100 tracking-tight font-poster-title">
              Full Season Simulator
            </h1>

            {/* Postseason Tournament Format Selector (Grand Cup 64 Default) */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-black/70 border border-amber-500/40">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat('grand_cup_64');
                    if (leagueState && leagueState.postseasonFormat !== 'grand_cup_64') {
                      const updated = { ...leagueState, postseasonFormat: 'grand_cup_64' as const };
                      onUpdateLeagueState(updated);
                      saveLeagueSeasonState(updated);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    selectedFormat === 'grand_cup_64'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-amber-200'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Grand Cup 64</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/50 text-amber-200 font-bold uppercase tracking-wider">
                    Default
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFormat('classic_32');
                    if (leagueState && leagueState.postseasonFormat !== 'classic_32') {
                      const updated = { ...leagueState, postseasonFormat: 'classic_32' as const };
                      onUpdateLeagueState(updated);
                      saveLeagueSeasonState(updated);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    selectedFormat === 'classic_32'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-amber-200'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Classic 32</span>
                </button>
              </div>
              <span className="text-xs text-slate-300 font-medium">
                {selectedFormat === 'grand_cup_64'
                  ? '64 Qualifiers (36 Direct + 28 Swiss Play-In) • 16 Groups'
                  : '32 Qualifiers (30 Direct + 2 Wildcard Play-In) • 8 Groups'}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Simulate the entire season across all formats in a single click: 
              <strong className="text-amber-300"> 6 Parallel Leagues</strong> (38 Matchdays),
              <strong className="text-purple-300"> {selectedFormat === 'grand_cup_64' ? 'Swiss Play-In (4 Pools + Deciders)' : 'Wildcard Play-In'}</strong>,
              <strong className="text-yellow-300"> {selectedFormat === 'grand_cup_64' ? 'Grand Cup 64' : 'Champions Tournament'}</strong> (Group Stage & Knockout Bracket), and
              <strong className="text-cyan-300"> The Idols Superleague (Top 20) & Masters (Top 10 Playoff)</strong>.
            </p>
          </div>

          {/* Master 1-Click Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleSimulateWholeSeason}
              disabled={isSimulating}
              className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-base transition-all duration-300 border-2 border-black poster-shadow-md hover:scale-[1.02] active:scale-[0.98] ${
                isSimulating
                  ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed animate-pulse'
                  : isFullSeasonCompleted
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:brightness-110'
                  : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:brightness-110'
              }`}
            >
              <FastForward className={`w-5 h-5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>
                {isSimulating
                  ? 'Simulating Whole Season...'
                  : isFullSeasonCompleted
                  ? '⚡ Re-Simulate Entire Season'
                  : '⚡ Simulate Entire Season (1-Click)'}
              </span>
            </button>

            {championsData.championIdol && (
              <button
                onClick={handleArchiveSeasonAndAdvance}
                className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-[#241710] hover:bg-amber-950 border-2 border-amber-600/50 text-amber-300 text-sm font-black transition-all poster-shadow-sm hover:scale-105"
                title="Crown champions and commit all formats into archives"
              >
                <Crown className="w-4 h-4 text-yellow-400" />
                <span>Archive Season</span>
              </button>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* SEASON RENAMING INPUT BAR                                  */}
        {/* ---------------------------------------------------------- */}
        <div className="mt-6 pt-6 border-t border-black/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-black/40 p-4 rounded-2xl border border-amber-600/20">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Season Title & Branding</p>
              <p className="text-[11px] text-slate-400">Rename the season to customize trophies, league archives, and tournament records.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-lg">
            <input
              type="text"
              value={seasonNameInput}
              onChange={(e) => {
                setSeasonNameInput(e.target.value);
                setIsNameDirty(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSeasonName();
              }}
              placeholder={`e.g. Season ${currentSeasonNumber} or Idol Apex Odyssey`}
              className="flex-1 px-4 py-2 rounded-xl bg-black/80 border border-amber-500/40 text-amber-100 placeholder-slate-500 text-sm font-bold focus:outline-none focus:border-amber-400 transition-colors"
            />
            <button
              onClick={handleSaveSeasonName}
              disabled={!isNameDirty || !seasonNameInput.trim()}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 border border-black flex-shrink-0 ${
                isNameDirty && seasonNameInput.trim()
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-md'
                  : 'bg-black/50 text-slate-500 cursor-not-allowed border-amber-900/30'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save Name</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successBanner && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-950/90 border-2 border-emerald-500/80 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 2. FORMAT SELECTOR TABS                                      */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#170e08] border-2 border-black/80 rounded-2xl">
        <button
          onClick={() => setActiveViewTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeViewTab === 'overview'
              ? 'bg-amber-500 text-slate-950 border border-black poster-shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-black/40'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Season Overview</span>
        </button>

        <button
          onClick={() => setActiveViewTab('leagues')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeViewTab === 'leagues'
              ? 'bg-amber-500 text-slate-950 border border-black poster-shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-black/40'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>6-Division Leagues (FIFA Standings)</span>
        </button>

        <button
          onClick={() => setActiveViewTab('champions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeViewTab === 'champions'
              ? 'bg-amber-500 text-slate-950 border border-black poster-shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-black/40'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>{selectedFormat === 'grand_cup_64' ? 'Grand Cup 64 (Podium & 16 Groups)' : 'Champions Tournament (Podium)'}</span>
        </button>

        <button
          onClick={() => setActiveViewTab('the_idols')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeViewTab === 'the_idols'
              ? 'bg-amber-500 text-slate-950 border border-black poster-shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-black/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>The Idols Superleague (Top 20) & Masters</span>
        </button>

        <button
          onClick={() => setActiveViewTab('wildcard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeViewTab === 'wildcard'
              ? 'bg-amber-500 text-slate-950 border border-black poster-shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-black/40'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>{selectedFormat === 'grand_cup_64' ? 'Swiss Play-In (28 Qualifiers)' : 'Wildcard Play-In'}</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 3. TAB 1: SEASON OVERVIEW (BENTO DASHBOARD)                  */}
      {/* ============================================================ */}
      {activeViewTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Honors Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Champions Tournament Grand Champion */}
            <div className="bg-[#1c120c] border-2 border-amber-500/50 rounded-2xl p-5 poster-shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    Grand Champion
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                    {selectedFormat === 'grand_cup_64' ? 'Grand Cup 64' : 'Champions 32'}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {championsData.championIdol ? (
                    <>
                      <img
                        src={championsData.championIdol.photoUrl}
                        alt={championsData.championIdol.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 poster-shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-base font-black text-amber-100 font-poster-title">
                          {championsData.championIdol.name}
                        </h4>
                        <p className="text-xs text-slate-400">{championsData.championIdol.girlGroup}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                          Rating {getIdolRating(championsData.championIdol)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 py-3 italic">Simulate season to crown champion</div>
                  )}
                </div>
              </div>

              {championsData.grandFinalScore && (
                <div className="mt-4 pt-3 border-t border-black/60 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Grand Final Score:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {championsData.grandFinalScore.scoreA} – {championsData.grandFinalScore.scoreB}
                  </span>
                </div>
              )}
            </div>

            {/* The Idols Masters Champion */}
            <div className="bg-[#1c120c] border-2 border-purple-500/40 rounded-2xl p-5 poster-shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    The Idols Masters Champion
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 border border-purple-500/30 text-[10px] font-mono text-purple-300">
                    Elite 20 Idols
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {theIdolsData?.mastersChampion ? (
                    <>
                      <img
                        src={theIdolsData.mastersChampion.photoUrl}
                        alt={theIdolsData.mastersChampion.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-400 poster-shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-base font-black text-purple-100 font-poster-title">
                          {theIdolsData.mastersChampion.name}
                        </h4>
                        <p className="text-xs text-slate-400">{theIdolsData.mastersChampion.girlGroup}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold">
                          Rating {getIdolRating(theIdolsData.mastersChampion)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 py-3 italic">Simulate season to crown champion</div>
                  )}
                </div>
              </div>

              {theIdolsData?.superleagueWinner && (
                <div className="mt-4 pt-3 border-t border-black/60 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>League Winner:</span>
                  <span className="font-bold text-purple-300">{theIdolsData.superleagueWinner.name}</span>
                </div>
              )}
            </div>

            {/* Division 1 (IPL) Champion */}
            <div className="bg-[#1c120c] border-2 border-blue-500/40 rounded-2xl p-5 poster-shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    {displayLeagues[0]?.name || 'Premier League'} Champion
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 border border-blue-500/30 text-[10px] font-mono text-blue-300">
                    Div 1
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {displayLeagues[0]?.championIdol ? (
                    <>
                      <img
                        src={displayLeagues[0].championIdol.photoUrl}
                        alt={displayLeagues[0].championIdol.name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-400 poster-shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <h4 className="text-base font-black text-blue-100 font-poster-title">
                          {displayLeagues[0].championIdol.name}
                        </h4>
                        <p className="text-xs text-slate-400">{displayLeagues[0].championIdol.girlGroup}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                          {displayLeagues[0].standings[0]?.points || 0} Pts &bull; +{displayLeagues[0].standings[0]?.gameDiff || 0} GD
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 py-3 italic">Simulate season for league standings</div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-black/60 text-[11px] text-slate-400 flex items-center justify-between">
                <span>38 Matchdays:</span>
                <span className="font-bold text-blue-300">Double Round-Robin</span>
              </div>
            </div>

            {/* Play-In Card (Swiss or Wildcard depending on format) */}
            <div className="bg-[#1c120c] border-2 border-indigo-500/40 rounded-2xl p-5 poster-shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <Swords className="w-3 h-3" />
                    {selectedFormat === 'grand_cup_64' ? 'Swiss Play-In' : 'Wildcard Qualifiers'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/60 border border-indigo-500/30 text-[10px] font-mono text-indigo-300">
                    {selectedFormat === 'grand_cup_64' ? '28 Grand Cup Berths' : 'Seeds #31 & #32'}
                  </span>
                </div>

                {selectedFormat === 'grand_cup_64' ? (
                  <div className="mt-4 space-y-2">
                    {leagueState?.swissPlayIn?.allQualifiers && leagueState.swissPlayIn.allQualifiers.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Direct Pool Qualifiers:</span>
                          <span className="font-bold font-mono text-emerald-400">24 Idols (Top 6 / Pool)</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Last Chance Deciders:</span>
                          <span className="font-bold font-mono text-purple-400">4 Qualifiers</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {leagueState.swissPlayIn.allQualifiers.slice(0, 4).map((q) => (
                            <span key={q.id} className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 text-[10px] font-bold">
                              {q.name}
                            </span>
                          ))}
                          {leagueState.swissPlayIn.allQualifiers.length > 4 && (
                            <span className="px-2 py-0.5 rounded bg-black/40 text-slate-400 text-[10px]">
                              +{leagueState.swissPlayIn.allQualifiers.length - 4} more
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-500 py-3 italic">Swiss Play-In pending simulation</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {simulationResult?.wildcardPlayIn?.qualifierA || leagueState?.wildcardPlayIn?.qualifier1Id ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center justify-center border border-indigo-500/40">
                            1
                          </span>
                          <span className="text-xs font-bold text-indigo-200">
                            {simulationResult?.wildcardPlayIn?.qualifierA?.name ||
                              idolsMap.get(leagueState?.wildcardPlayIn?.qualifier1Id || '')?.name ||
                              'Upper Bracket Winner'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center justify-center border border-indigo-500/40">
                            2
                          </span>
                          <span className="text-xs font-bold text-indigo-200">
                            {simulationResult?.wildcardPlayIn?.qualifierB?.name ||
                              idolsMap.get(leagueState?.wildcardPlayIn?.qualifier2Id || '')?.name ||
                              'Lower Bracket Winner'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-slate-500 py-3 italic">Play-In pending simulation</div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-black/60 text-[11px] text-slate-400 flex items-center justify-between">
                <span>{selectedFormat === 'grand_cup_64' ? 'Participants:' : 'Contenders:'}</span>
                <span className="font-bold text-indigo-300">
                  {selectedFormat === 'grand_cup_64' ? '60 Idols (Ranks 7–16)' : '6th Place from Each Div'}
                </span>
              </div>
            </div>
          </div>

          {/* 6 Leagues Champions Quick Strip */}
          <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 poster-shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-amber-200 font-poster-title flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  6 Parallel League Champions & Branding
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedFormat === 'grand_cup_64'
                    ? 'Each parallel league features 20 idols in a 38-matchday double round-robin. Top 6 advance directly to Grand Cup 64, and ranks 7-16 enter Swiss Play-In.'
                    : 'Each parallel league features 20 idols in a 38-matchday double round-robin. Top 5 advance to Champions Tournament.'}
                </p>
              </div>

              <button
                onClick={() => setActiveViewTab('leagues')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                <span>View Full Standings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {displayLeagues.map((league) => (
                <div
                  key={league.leagueId}
                  onClick={() => {
                    setSelectedLeagueId(league.leagueId);
                    setActiveViewTab('leagues');
                  }}
                  className="bg-black/40 hover:bg-black/60 border-2 border-black/80 hover:border-amber-500/50 rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      {league.logoUrl ? (
                        <img
                          src={league.logoUrl}
                          alt={league.name}
                          className="w-7 h-7 rounded-lg object-cover border border-amber-500/30 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-slate-950 flex-shrink-0"
                          style={{ backgroundColor: league.color || '#eab308' }}
                        >
                          D{league.leagueId}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-amber-100 truncate font-poster-title">
                          {league.name}
                        </p>
                        <p className="text-[10px] text-slate-400">{league.tierName}</p>
                      </div>
                    </div>

                    {league.championIdol ? (
                      <div className="mt-2 flex items-center gap-2 bg-[#241710] p-2 rounded-xl border border-amber-600/30">
                        <img
                          src={league.championIdol.photoUrl}
                          alt={league.championIdol.name}
                          className="w-8 h-8 rounded-lg object-cover border border-amber-400"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-amber-200 truncate">{league.championIdol.name}</p>
                          <p className="text-[9px] font-mono text-amber-400/90">{league.standings[0]?.points || 0} Pts</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic py-2">Matches unplayed</div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-black/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{selectedFormat === 'grand_cup_64' ? 'Rank 1–6' : 'Rank 1–5'}</span>
                    <span className="text-emerald-400 font-bold">{selectedFormat === 'grand_cup_64' ? 'Direct Q' : 'Qualify Q'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. TAB 2: 6-DIVISION LEAGUES WITH FIFA-STYLE STANDINGS       */}
      {/* ============================================================ */}
      {activeViewTab === 'leagues' && (
        <div className="space-y-6">
          {/* Division Selector Header Strip */}
          <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 poster-shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-amber-200 font-poster-title flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  6 Parallel Divisions & Official Standings
                </h3>
                <p className="text-xs text-slate-400">
                  Select a division to inspect its full FIFA-style league standings, champion banner, and qualification lines.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('league_system')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-amber-950 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
                >
                  <span>Open League System Panel</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Division Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
              {displayLeagues.map((l) => {
                const isSelected = l.leagueId === selectedLeagueId;
                return (
                  <button
                    key={l.leagueId}
                    onClick={() => setSelectedLeagueId(l.leagueId)}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl text-left transition-all border-2 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 poster-shadow-sm'
                        : 'bg-black/40 border-black/60 hover:border-amber-600/40 text-slate-400 hover:text-amber-300'
                    }`}
                  >
                    {l.logoUrl ? (
                      <img
                        src={l.logoUrl}
                        alt={l.name}
                        className="w-8 h-8 rounded-xl object-cover border border-amber-500/30 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-slate-950 flex-shrink-0"
                        style={{ backgroundColor: l.color || '#eab308' }}
                      >
                        {l.leagueId}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black truncate font-poster-title leading-tight">{l.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{l.tierName}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Division FIFA-Style Table Card */}
          {activeSelectedLeague && (
            <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 lg:p-8 poster-shadow-lg space-y-6">
              {/* League Branding Banner */}
              <div
                className="p-6 rounded-2xl border-2 border-black flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${activeSelectedLeague.color || '#3b82f6'}22, #170e08 80%)`,
                }}
              >
                <div className="flex items-center gap-4 relative z-10">
                  {activeSelectedLeague.logoUrl ? (
                    <img
                      src={activeSelectedLeague.logoUrl}
                      alt={activeSelectedLeague.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400/60 poster-shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-slate-950 font-black text-xl border-2 border-black"
                      style={{ backgroundColor: activeSelectedLeague.color || '#3b82f6' }}
                    >
                      D{activeSelectedLeague.leagueId}
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      {activeSelectedLeague.tierName}
                    </span>
                    <h2 className="text-2xl lg:text-3xl font-black text-amber-100 font-poster-title">
                      {activeSelectedLeague.name}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">
                      {activeSelectedLeague.description ||
                        (selectedFormat === 'grand_cup_64'
                          ? 'Double round-robin schedule (38 matchdays). Top 6 automatically qualify for Grand Cup 64; ranks 7-16 advance to Swiss Play-In.'
                          : 'Double round-robin schedule (38 matchdays). Top 5 automatically qualify for the Champions Tournament.')}
                    </p>
                  </div>
                </div>

                {/* Division Champion Spotlight */}
                {activeSelectedLeague.championIdol && (
                  <div className="bg-black/70 border-2 border-amber-400/60 p-3.5 rounded-2xl flex items-center gap-3.5 flex-shrink-0 poster-shadow-sm">
                    <img
                      src={activeSelectedLeague.championIdol.photoUrl}
                      alt={activeSelectedLeague.championIdol.name}
                      className="w-12 h-12 rounded-xl object-cover border border-amber-400"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                        <Crown className="w-3 h-3" />
                        Division Champion
                      </div>
                      <p className="text-sm font-black text-amber-100 font-poster-title">
                        {activeSelectedLeague.championIdol.name}
                      </p>
                      <p className="text-[11px] font-mono text-emerald-400">
                        {activeSelectedLeague.standings[0]?.points || 0} Pts &bull; +
                        {activeSelectedLeague.standings[0]?.gameDiff || 0} GD
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* FIFA-Style Full Football Standings Table */}
              <div className="overflow-x-auto rounded-2xl border border-black/80">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b-2 border-black bg-black/70 text-[11px] font-poster-title text-amber-400 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-12">Pos</th>
                      <th className="py-3 px-4">Idol / Team</th>
                      <th className="py-3 px-2 text-center w-12" title="Played">P</th>
                      <th className="py-3 px-2 text-center w-12" title="Won">W</th>
                      <th className="py-3 px-2 text-center w-12" title="Drawn">D</th>
                      <th className="py-3 px-2 text-center w-12" title="Lost">L</th>
                      <th className="py-3 px-2 text-center w-12" title="Goals For">GF</th>
                      <th className="py-3 px-2 text-center w-12" title="Goals Against">GA</th>
                      <th className="py-3 px-2 text-center w-12" title="Goal Difference">GD</th>
                      <th className="py-3 px-3 text-center w-14" title="Points">Pts</th>
                      <th className="py-3 px-4 text-center w-28">Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeSelectedLeague.standings || []).map((row, idx) => {
                      const idol = idolsMap.get(row.idolId);
                      const isChampion = idx === 0;
                      const isDirectQualifier = selectedFormat === 'grand_cup_64' ? idx < 6 : idx < 5;
                      const isPlayInQualifier = selectedFormat === 'grand_cup_64' ? (idx >= 6 && idx < 16) : idx === 5;

                      return (
                        <React.Fragment key={row.idolId}>
                          <tr
                            className={`border-b border-black/60 transition-colors text-xs ${
                              isChampion
                                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 font-semibold'
                                : isDirectQualifier
                                ? 'bg-emerald-950/20 hover:bg-emerald-950/30 text-slate-200'
                                : isPlayInQualifier
                                ? 'bg-indigo-950/20 hover:bg-indigo-950/30 text-slate-200'
                                : 'bg-black/20 hover:bg-black/40 text-slate-300'
                            }`}
                          >
                            {/* Position */}
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-black font-mono ${
                                  isChampion
                                    ? 'bg-amber-500 text-slate-950 border border-black shadow'
                                    : isDirectQualifier
                                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                                    : isPlayInQualifier
                                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                                    : 'text-slate-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>

                            {/* Idol Name, Avatar, Group */}
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={idol?.photoUrl || row.photoUrl}
                                  alt={row.idolName}
                                  className="w-8 h-8 rounded-lg object-cover border border-amber-500/30 flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-amber-100 truncate">{row.idolName}</span>
                                    {isChampion && <Crown className="w-3.5 h-3.5 text-yellow-400 inline flex-shrink-0" />}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block truncate">{row.girlGroup}</span>
                                </div>
                              </div>
                            </td>

                            {/* P, W, D, L */}
                            <td className="py-2.5 px-2 text-center font-mono">{row.played}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-emerald-400 font-bold">{row.wins}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400">{row.draws}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-rose-400">{row.losses}</td>

                            {/* GF, GA, GD */}
                            <td className="py-2.5 px-2 text-center font-mono text-slate-300">{row.gamesFor}</td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-400">{row.gamesAgainst}</td>
                            <td
                              className={`py-2.5 px-2 text-center font-mono font-bold ${
                                row.gameDiff > 0
                                  ? 'text-emerald-400'
                                  : row.gameDiff < 0
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                            </td>

                            {/* Points */}
                            <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-amber-300">
                              {row.points}
                            </td>

                            {/* Form Dots */}
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {(row.form && row.form.length > 0 ? row.form : ['W', 'W', 'D', 'W', 'L']).map(
                                  (f, fIdx) => (
                                    <span
                                      key={fIdx}
                                      className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                                        f === 'W'
                                          ? 'bg-emerald-600 text-white'
                                          : f === 'D'
                                          ? 'bg-slate-600 text-white'
                                          : 'bg-rose-600 text-white'
                                      }`}
                                    >
                                      {f}
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Cutoff Indicators */}
                          {selectedFormat === 'grand_cup_64' ? (
                            <>
                              {idx === 5 && (
                                <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                                  <td colSpan={11} className="py-1 px-3 text-[10px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                                    ▲ TOP 6 GRAND CUP 64 DIRECT QUALIFIERS (36 Automatic Berths Across 6 Divisions)
                                  </td>
                                </tr>
                              )}
                              {idx === 15 && (
                                <tr className="bg-indigo-950/40 border-y-2 border-indigo-500/60">
                                  <td colSpan={11} className="py-1 px-3 text-[10px] font-poster-title font-bold text-indigo-300 tracking-wider text-center">
                                    ▲ RANKS 7–16 ADVANCE TO SWISS PLAY-IN (60 Contenders Battling For 28 Berths)
                                  </td>
                                </tr>
                              )}
                            </>
                          ) : (
                            <>
                              {idx === 4 && (
                                <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                                  <td colSpan={11} className="py-1 px-3 text-[10px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                                    ▲ TOP 5 CHAMPIONS TOURNAMENT DIRECT QUALIFIERS
                                  </td>
                                </tr>
                              )}
                              {idx === 5 && (
                                <tr className="bg-indigo-950/40 border-y-2 border-indigo-500/60">
                                  <td colSpan={11} className="py-1 px-3 text-[10px] font-poster-title font-bold text-indigo-300 tracking-wider text-center">
                                    ▼ RANK 6 CUTOFF: ADVANCES TO WILDCARD PLAY-IN (2 Postseason Spots)
                                  </td>
                                </tr>
                              )}
                            </>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Standings Legend */}
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs pt-2 border-t border-black/80">
                <div className="flex flex-wrap items-center gap-4">
                  {selectedFormat === 'grand_cup_64' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-slate-300">Ranks 1–6: Direct Qualification (Grand Cup 64)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-500" />
                        <span className="text-slate-300">Ranks 7–16: Swiss System Play-In (28 Berths)</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-slate-300">Ranks 1–5: Direct Qualification (Champions 32)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-500" />
                        <span className="text-slate-300">Rank 6: Wildcard Play-In Bracket</span>
                      </div>
                    </>
                  )}
                </div>

                <span className="text-[11px] font-mono text-slate-400">
                  {activeSelectedLeague.totalMatches} matches &bull; 3 points for win &bull; 1 for draw
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. TAB 3: CHAMPIONS TOURNAMENT POSTSEASON & PODIUM           */}
      {/* ============================================================ */}
      {activeViewTab === 'champions' && (
        <div className="space-y-6">
          {/* Postseason Grand Podium Card */}
          <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 lg:p-8 poster-shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  Season Postseason Finale
                </span>
                <h3 className="text-2xl lg:text-3xl font-black text-amber-100 font-poster-title">
                  Champions Tournament Podium
                </h3>
              </div>

              <button
                onClick={() => setActiveTab('knockout')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-amber-950 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                <span>Full Knockout Bracket</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4-Idol Podium */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* 1st Place Champion */}
              <div className="bg-gradient-to-b from-amber-500/25 to-black/60 border-2 border-amber-400 rounded-2xl p-5 text-center flex flex-col items-center justify-between poster-shadow-md order-1 md:order-2">
                <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center mb-2 shadow">
                  1st
                </div>
                {championsData.championIdol ? (
                  <>
                    <img
                      src={championsData.championIdol.photoUrl}
                      alt={championsData.championIdol.name}
                      className="w-20 h-20 rounded-2xl object-cover border-3 border-amber-300 mb-2 poster-shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <h4 className="text-lg font-black text-amber-100 font-poster-title">
                      {championsData.championIdol.name}
                    </h4>
                    <p className="text-xs text-slate-300">{championsData.championIdol.girlGroup}</p>
                    <span className="mt-2 px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black">
                      Grand Champion 🏆
                    </span>
                  </>
                ) : (
                  <div className="py-6 text-xs text-slate-500 italic">Pending simulation</div>
                )}
              </div>

              {/* 2nd Place Runner-Up */}
              <div className="bg-gradient-to-b from-slate-500/20 to-black/60 border-2 border-slate-400/60 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-2 md:order-1">
                <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center mb-2">
                  2nd
                </div>
                {championsData.runnerUpIdol ? (
                  <>
                    <img
                      src={championsData.runnerUpIdol.photoUrl}
                      alt={championsData.runnerUpIdol.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-300 mb-2"
                      referrerPolicy="no-referrer"
                    />
                    <h4 className="text-base font-black text-slate-100 font-poster-title">
                      {championsData.runnerUpIdol.name}
                    </h4>
                    <p className="text-xs text-slate-400">{championsData.runnerUpIdol.girlGroup}</p>
                    <span className="mt-2 px-2.5 py-0.5 rounded-full bg-slate-400/30 text-slate-200 text-xs font-bold">
                      Runner-Up 🥈
                    </span>
                  </>
                ) : (
                  <div className="py-6 text-xs text-slate-500 italic">Pending simulation</div>
                )}
              </div>

              {/* 3rd Place Bronze */}
              <div className="bg-gradient-to-b from-amber-800/20 to-black/60 border-2 border-amber-700/60 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-3">
                <div className="w-8 h-8 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center mb-2">
                  3rd
                </div>
                {championsData.thirdPlaceIdol ? (
                  <>
                    <img
                      src={championsData.thirdPlaceIdol.photoUrl}
                      alt={championsData.thirdPlaceIdol.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-600 mb-2"
                      referrerPolicy="no-referrer"
                    />
                    <h4 className="text-base font-black text-amber-100 font-poster-title">
                      {championsData.thirdPlaceIdol.name}
                    </h4>
                    <p className="text-xs text-slate-400">{championsData.thirdPlaceIdol.girlGroup}</p>
                    <span className="mt-2 px-2.5 py-0.5 rounded-full bg-amber-700/30 text-amber-300 text-xs font-bold">
                      3rd Place 🥉
                    </span>
                  </>
                ) : (
                  <div className="py-6 text-xs text-slate-500 italic">Pending simulation</div>
                )}
              </div>

              {/* 4th Place */}
              <div className="bg-gradient-to-b from-black/40 to-black/80 border-2 border-black/80 rounded-2xl p-5 text-center flex flex-col items-center justify-between order-4">
                <div className="w-8 h-8 rounded-full bg-black/60 text-slate-400 font-black text-xs flex items-center justify-center mb-2 border border-slate-600">
                  4th
                </div>
                {championsData.fourthPlaceIdol ? (
                  <>
                    <img
                      src={championsData.fourthPlaceIdol.photoUrl}
                      alt={championsData.fourthPlaceIdol.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-600 mb-2"
                      referrerPolicy="no-referrer"
                    />
                    <h4 className="text-base font-black text-slate-200 font-poster-title">
                      {championsData.fourthPlaceIdol.name}
                    </h4>
                    <p className="text-xs text-slate-400">{championsData.fourthPlaceIdol.girlGroup}</p>
                    <span className="mt-2 px-2 py-0.5 rounded bg-black/60 text-slate-400 text-xs font-mono">
                      Semi-Finalist
                    </span>
                  </>
                ) : (
                  <div className="py-6 text-xs text-slate-500 italic">Pending simulation</div>
                )}
              </div>
            </div>

            {/* Grand Final Scoreline Card */}
            {championsData.grandFinalScore && (
              <div className="mt-6 p-4 rounded-2xl bg-black/60 border border-amber-500/30 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Swords className="w-5 h-5 text-amber-400" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Grand Final Scoreline</span>
                    <p className="text-sm font-black text-amber-200">
                      {championsData.grandFinalScore.idolAName} vs {championsData.grandFinalScore.idolBName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xl font-black font-mono text-amber-300">
                    {championsData.grandFinalScore.scoreA} – {championsData.grandFinalScore.scoreB}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs">
                    Winner: {championsData.grandFinalScore.winnerName}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Groups Standings Grid */}
          <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 poster-shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-amber-200 font-poster-title flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  Group Stage Standings ({championsData.groups?.length || (selectedFormat === 'grand_cup_64' ? 16 : 8)} Groups &bull; Top 2 Advance)
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedFormat === 'grand_cup_64'
                    ? '64 qualifiers seeded into 16 groups of 4 idols (Groups A–P). Top 2 from each group advance to the 32-idol knockout bracket.'
                    : '32 qualifiers seeded into 8 groups of 4 idols (Groups A–H). Top 2 from each group advance to the 16-idol knockout bracket.'}
                </p>
              </div>

              <button
                onClick={() => setActiveTab('group_stage')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-amber-950 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                <span>Open Group Stage</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(championsData.groups || []).map((group, gIdx) => (
                <div key={group.id || gIdx} className="bg-black/40 border border-black/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-black/60 pb-2">
                    <span className="text-xs font-black text-amber-300 font-poster-title">
                      Group {group.name || String.fromCharCode(65 + gIdx)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Top 2 Qualify</span>
                  </div>

                  <div className="space-y-1.5">
                    {(group.standings || []).map((st, sIdx) => {
                      const idol = idolsMap.get(st.idolId);
                      const isQ = sIdx < 2;
                      return (
                        <div
                          key={st.idolId}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                            isQ
                              ? 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 font-semibold'
                              : 'bg-black/20 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 text-[10px] font-mono font-bold text-slate-400">{sIdx + 1}</span>
                            <img
                              src={idol?.photoUrl}
                              alt={st.idolName}
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <span className="truncate">{st.idolName}</span>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[11px] flex-shrink-0">
                            <span className="text-slate-400">{st.points} pts</span>
                            {isQ && <span className="text-emerald-400 font-black text-[10px]">Q</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. TAB 4: THE IDOLS SUPERLEAGUE (20 IDOLS) & MASTERS         */}
      {/* ============================================================ */}
      {activeViewTab === 'the_idols' && (
        <div className="space-y-6">
          <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 lg:p-8 poster-shadow-lg space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Elite Tier Competition
                </span>
                <h3 className="text-2xl lg:text-3xl font-black text-purple-100 font-poster-title">
                  The Idols Superleague & Masters Playoff
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Consists of the <strong>Top 20 highest-rated active idols</strong> in the arena.
                  The <strong>Top 10 idols</strong> in the final standings advance to the Masters Stepped Double-Elimination Playoff Bracket.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('the_idols')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-purple-950 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all"
                >
                  <span>Open The Idols Panel</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Honors Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Masters Playoff Champion */}
              <div className="bg-purple-950/30 border-2 border-purple-500/50 p-4 rounded-2xl flex items-center gap-3.5">
                {theIdolsData?.mastersChampion ? (
                  <>
                    <img
                      src={theIdolsData.mastersChampion.photoUrl}
                      alt={theIdolsData.mastersChampion.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-400"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                        Masters Champion 👑
                      </span>
                      <h4 className="text-base font-black text-purple-100 font-poster-title">
                        {theIdolsData.mastersChampion.name}
                      </h4>
                      <p className="text-xs text-slate-400">{theIdolsData.mastersChampion.girlGroup}</p>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 py-3 italic">Masters champion unconfirmed</div>
                )}
              </div>

              {/* Superleague Regular Season Winner */}
              <div className="bg-amber-950/30 border-2 border-amber-500/40 p-4 rounded-2xl flex items-center gap-3.5">
                {theIdolsData?.superleagueWinner ? (
                  <>
                    <img
                      src={theIdolsData.superleagueWinner.photoUrl}
                      alt={theIdolsData.superleagueWinner.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        Superleague Winner 🏆
                      </span>
                      <h4 className="text-base font-black text-amber-100 font-poster-title">
                        {theIdolsData.superleagueWinner.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {theIdolsData.standings[0]?.points || 0} Pts &bull; Seed #1
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 py-3 italic">League winner unconfirmed</div>
                )}
              </div>

              {/* Runner-Up */}
              <div className="bg-slate-900/40 border-2 border-slate-700 p-4 rounded-2xl flex items-center gap-3.5">
                {theIdolsData?.mastersRunnerUp ? (
                  <>
                    <img
                      src={theIdolsData.mastersRunnerUp.photoUrl}
                      alt={theIdolsData.mastersRunnerUp.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-500"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Playoff Runner-Up 🥈
                      </span>
                      <h4 className="text-base font-black text-slate-100 font-poster-title">
                        {theIdolsData.mastersRunnerUp.name}
                      </h4>
                      <p className="text-xs text-slate-400">{theIdolsData.mastersRunnerUp.girlGroup}</p>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 py-3 italic">Playoff runner-up unconfirmed</div>
                )}
              </div>
            </div>

            {/* 20 Idols Superleague Final Standings Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-purple-200 font-poster-title uppercase tracking-wider">
                  The Idols Superleague Standings (20 Idols &bull; Top 10 to Playoff)
                </h4>
                <span className="text-xs font-mono text-slate-400">38 Matchdays</span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-black/80">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="border-b-2 border-black bg-black/70 text-[10px] font-poster-title text-purple-300 uppercase tracking-wider">
                      <th className="py-2.5 px-3 text-center w-12">Pos</th>
                      <th className="py-2.5 px-4">Idol</th>
                      <th className="py-2.5 px-2 text-center w-12">P</th>
                      <th className="py-2.5 px-2 text-center w-12">W</th>
                      <th className="py-2.5 px-2 text-center w-12">D</th>
                      <th className="py-2.5 px-2 text-center w-12">L</th>
                      <th className="py-2.5 px-2 text-center w-12">GD</th>
                      <th className="py-2.5 px-3 text-center w-14">Pts</th>
                      <th className="py-2.5 px-4 text-center">Postseason Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(theIdolsData?.standings || []).map((row, idx) => {
                      const idol = idolsMap.get(row.idolId);
                      const isTop10 = idx < 10;
                      return (
                        <React.Fragment key={row.idolId}>
                          <tr
                            className={`border-b border-black/60 text-xs ${
                              isTop10
                                ? 'bg-purple-950/20 hover:bg-purple-950/35 text-slate-200'
                                : 'bg-black/20 hover:bg-black/40 text-slate-400'
                            }`}
                          >
                            <td className="py-2 px-3 text-center font-mono font-bold">{idx + 1}</td>
                            <td className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                <img
                                  src={idol?.photoUrl || row.photoUrl}
                                  alt={row.idolName}
                                  className="w-6 h-6 rounded-lg object-cover border border-purple-500/30 flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="font-bold text-slate-200">{row.idolName}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center font-mono">{row.played}</td>
                            <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{row.wins}</td>
                            <td className="py-2 px-2 text-center font-mono text-slate-400">{row.draws}</td>
                            <td className="py-2 px-2 text-center font-mono text-rose-400">{row.losses}</td>
                            <td className="py-2 px-2 text-center font-mono font-bold">
                              {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-black text-amber-300">{row.points}</td>
                            <td className="py-2 px-4 text-center">
                              {isTop10 ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                                  Playoff Seed #{idx + 1}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">Eliminated</span>
                              )}
                            </td>
                          </tr>

                          {idx === 9 && (
                            <tr className="bg-purple-950/50 border-y-2 border-purple-500/60">
                              <td colSpan={9} className="py-1 px-3 text-[10px] font-poster-title font-bold text-purple-300 tracking-wider text-center">
                                ▲ TOP 10 PLAYOFF CUTOFF (Double Elimination Masters Bracket)
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
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. TAB 5: PLAY-IN RECAP (SWISS 64 OR WILDCARD 32)            */}
      {/* ============================================================ */}
      {activeViewTab === 'wildcard' && (
        <div className="space-y-6">
          {selectedFormat === 'grand_cup_64' ? (
            /* Swiss Play-In Display (28 Postseason Berths) */
            <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 lg:p-8 poster-shadow-lg space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Swords className="w-4 h-4 text-indigo-400" />
                    Grand Cup 64 Postseason Play-In
                  </span>
                  <h3 className="text-2xl lg:text-3xl font-black text-indigo-100 font-poster-title">
                    Swiss System Play-In Tournament
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    60 contenders (ranks 7–16 from all 6 parallel divisions) compete across 4 Swiss pools. Top 6 from each pool (24 idols) advance directly to Grand Cup 64. Ranks 7–8 from each pool enter Last Chance Deciders for the remaining 4 berths.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedFormat('classic_32');
                    if (leagueState && leagueState.postseasonFormat !== 'classic_32') {
                      const updated = { ...leagueState, postseasonFormat: 'classic_32' as const };
                      onUpdateLeagueState(updated);
                      saveLeagueSeasonState(updated);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all self-start"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>View Wildcard Format</span>
                </button>
              </div>

              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-black/50 border border-indigo-500/30 rounded-2xl p-3.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Contenders</span>
                  <p className="text-xl font-black font-mono text-indigo-200 mt-0.5">60 Idols</p>
                  <span className="text-[10px] text-slate-500">Ranks 7–16 (6 Divs)</span>
                </div>
                <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-3.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Direct Qualifiers</span>
                  <p className="text-xl font-black font-mono text-emerald-400 mt-0.5">24 Idols</p>
                  <span className="text-[10px] text-emerald-400/80">Top 6 per Pool</span>
                </div>
                <div className="bg-black/50 border border-purple-500/30 rounded-2xl p-3.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Chance</span>
                  <p className="text-xl font-black font-mono text-purple-400 mt-0.5">4 Idols</p>
                  <span className="text-[10px] text-purple-400/80">Decider Winners</span>
                </div>
                <div className="bg-black/50 border border-amber-500/30 rounded-2xl p-3.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Berths</span>
                  <p className="text-xl font-black font-mono text-amber-300 mt-0.5">28 Tickets</p>
                  <span className="text-[10px] text-amber-400/80">Grand Cup 64</span>
                </div>
              </div>

              {/* Pool Selector Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-black/60 pb-3">
                {[
                  { id: 'all', label: 'All 4 Pools Overview' },
                  { id: 'pool_a', label: 'Pool A' },
                  { id: 'pool_b', label: 'Pool B' },
                  { id: 'pool_c', label: 'Pool C' },
                  { id: 'pool_d', label: 'Pool D' },
                  { id: 'last_chance', label: 'Last Chance Deciders' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedSwissPool(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedSwissPool === tab.id
                        ? 'bg-indigo-600 text-white border border-indigo-400 shadow'
                        : 'bg-black/40 text-slate-400 hover:text-indigo-300 hover:bg-black/60 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content by Pool Selection */}
              {selectedSwissPool === 'all' && (
                <div className="space-y-6">
                  {/* 4 Swiss Pools Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['pool_a', 'pool_b', 'pool_c', 'pool_d'] as const).map((pKey, pIdx) => {
                      const pool = leagueState?.swissPlayIn?.pools?.[pKey];
                      const poolName = pool?.poolName || `Pool ${String.fromCharCode(65 + pIdx)}`;
                      const directIds = pool?.directQualifierIds || [];

                      return (
                        <div key={pKey} className="bg-black/40 border border-indigo-500/30 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-black/60 pb-2">
                            <h4 className="text-sm font-black text-indigo-200 font-poster-title">
                              {poolName}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold">
                              6 Qualifiers
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {directIds.length > 0 ? (
                              directIds.map((id, qIdx) => {
                                const idol = idolsMap.get(id);
                                return (
                                  <div key={id} className="flex items-center gap-2 p-1.5 rounded-xl bg-black/40 border border-black/60">
                                    <span className="text-[9px] font-mono font-bold text-emerald-400 w-4 text-center">
                                      Q{qIdx + 1}
                                    </span>
                                    {idol?.photoUrl ? (
                                      <img
                                        src={idol.photoUrl}
                                        alt={idol.name}
                                        className="w-6 h-6 rounded-lg object-cover border border-emerald-500/40 flex-shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[9px] text-slate-300">
                                        Q
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold text-slate-200 truncate">{idol?.name || id}</p>
                                      <p className="text-[9px] text-slate-400 truncate">{idol?.girlGroup || 'Direct Q'}</p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-slate-500 italic col-span-2 py-2">Pool pending simulation</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Last Chance Deciders Strip */}
                  <div className="bg-purple-950/20 border border-purple-500/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-purple-200 font-poster-title flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-purple-400" />
                        Last Chance Decider Qualifiers (4 Berths)
                      </h4>
                      <span className="text-[10px] text-purple-300">Top 2 from Groups Alpha & Beta</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(leagueState?.swissPlayIn?.lastChanceQualifiers || []).length > 0 ? (
                        (leagueState?.swissPlayIn?.lastChanceQualifiers || []).map((id, idx) => {
                          const idol = idolsMap.get(id);
                          return (
                            <div key={id} className="flex items-center gap-2 p-2 rounded-xl bg-black/50 border border-purple-500/40">
                              <span className="text-[10px] font-mono font-bold text-purple-400">LC{idx + 1}</span>
                              {idol?.photoUrl && (
                                <img
                                  src={idol.photoUrl}
                                  alt={idol.name}
                                  className="w-7 h-7 rounded-lg object-cover border border-purple-400 flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-purple-100 truncate">{idol?.name || id}</p>
                                <p className="text-[9px] text-slate-400 truncate">{idol?.girlGroup || 'Last Chance Q'}</p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic col-span-4 py-2">Last chance deciders pending simulation</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Specific Pool Table View */}
              {selectedSwissPool !== 'all' && selectedSwissPool !== 'last_chance' && (
                <div className="space-y-4">
                  {(() => {
                    const pool = leagueState?.swissPlayIn?.pools?.[selectedSwissPool];
                    const standings = pool?.standings || [];

                    return (
                      <div className="overflow-x-auto rounded-2xl border border-black/80">
                        <table className="w-full text-left border-collapse min-w-[650px]">
                          <thead>
                            <tr className="border-b-2 border-black bg-black/70 text-[11px] font-poster-title text-indigo-300 uppercase tracking-wider">
                              <th className="py-2.5 px-3 text-center w-12">Pos</th>
                              <th className="py-2.5 px-4">Idol</th>
                              <th className="py-2.5 px-2 text-center w-14">Origin</th>
                              <th className="py-2.5 px-2 text-center w-12">W</th>
                              <th className="py-2.5 px-2 text-center w-12">L</th>
                              <th className="py-2.5 px-2 text-center w-14">GD</th>
                              <th className="py-2.5 px-2 text-center w-16">Buchholz</th>
                              <th className="py-2.5 px-4 text-center w-28">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.map((p, idx) => {
                              const idol = idolsMap.get(p.idolId);
                              const isDirect = idx < 6;
                              const isLastChance = idx >= 6 && idx < 8;

                              return (
                                <tr
                                  key={p.idolId}
                                  className={`border-b border-black/60 text-xs ${
                                    isDirect
                                      ? 'bg-emerald-950/20 text-emerald-200'
                                      : isLastChance
                                      ? 'bg-purple-950/20 text-purple-200'
                                      : 'bg-black/20 text-slate-400'
                                  }`}
                                >
                                  <td className="py-2 px-3 text-center font-mono font-bold">{idx + 1}</td>
                                  <td className="py-2 px-4">
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={idol?.photoUrl || p.photoUrl}
                                        alt={p.idolName}
                                        className="w-6 h-6 rounded-lg object-cover border border-indigo-500/30 flex-shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className="font-bold text-slate-200">{p.idolName}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-400">
                                    {p.leagueName ? `D${p.leagueId}` : '-'}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono text-emerald-400 font-bold">{p.swissWins ?? 0}</td>
                                  <td className="py-2 px-2 text-center font-mono text-rose-400">{p.swissLosses ?? 0}</td>
                                  <td className="py-2 px-2 text-center font-mono font-bold">
                                    {(p.swissGameDiff ?? 0) > 0 ? `+${p.swissGameDiff}` : p.swissGameDiff ?? 0}
                                  </td>
                                  <td className="py-2 px-2 text-center font-mono text-slate-300">{p.buchholzScore ?? 0}</td>
                                  <td className="py-2 px-4 text-center">
                                    {isDirect ? (
                                      <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                                        Direct Q (Seed #{idx + 1})
                                      </span>
                                    ) : isLastChance ? (
                                      <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                                        Last Chance Decider
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 font-mono">Eliminated</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Last Chance View */}
              {selectedSwissPool === 'last_chance' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold">Last Chance Deciders Format:</p>
                    <p className="text-slate-400 mt-1">
                      The 8 idols finishing 7th and 8th across Pools A, B, C, and D contest decider matches. The 4 winners claim the final berths (#61–#64) in the Grand Cup 64 tournament.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(leagueState?.swissPlayIn?.lastChanceMatches || []).map((m, mIdx) => {
                      const idolA = idolsMap.get(m.idolAId || '');
                      const idolB = idolsMap.get(m.idolBId || '');
                      const winner = idolsMap.get(m.winnerId || '');

                      return (
                        <div key={m.id || mIdx} className="p-3.5 rounded-2xl bg-black/40 border border-black/80 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Decider Match #{mIdx + 1}</span>
                            <span className="text-emerald-400 font-bold">Winner Qualifies</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {idolA?.photoUrl && (
                                <img
                                  src={idolA.photoUrl}
                                  alt={idolA.name}
                                  className="w-5 h-5 rounded-md object-cover flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <span className={`truncate font-bold ${m.winnerId === m.idolAId ? 'text-amber-300' : 'text-slate-300'}`}>
                                {idolA?.name || m.idolAId}
                              </span>
                            </div>

                            <span className="font-mono font-black text-slate-200 px-2 py-0.5 rounded bg-black/60">
                              {m.scoreA ?? 0} – {m.scoreB ?? 0}
                            </span>

                            <div className="flex items-center gap-1.5 min-w-0 justify-end">
                              <span className={`truncate font-bold ${m.winnerId === m.idolBId ? 'text-amber-300' : 'text-slate-300'}`}>
                                {idolB?.name || m.idolBId}
                              </span>
                              {idolB?.photoUrl && (
                                <img
                                  src={idolB.photoUrl}
                                  alt={idolB.name}
                                  className="w-5 h-5 rounded-md object-cover flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                            </div>
                          </div>

                          {winner && (
                            <div className="text-[10px] text-emerald-300 font-bold text-center bg-emerald-950/40 py-0.5 rounded-lg border border-emerald-500/20">
                              Qualified: {winner.name} 🏆
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Classic Wildcard Play-In Display (2 Berths) */
            <div className="bg-[#1c120c] border-2 border-black/80 rounded-3xl p-6 lg:p-8 poster-shadow-lg space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Swords className="w-4 h-4 text-indigo-400" />
                    Postseason Play-In Duels
                  </span>
                  <h3 className="text-2xl lg:text-3xl font-black text-indigo-100 font-poster-title">
                    Wildcard Play-In Tournament
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    The 6th-place contenders from each of the 6 parallel divisions clash in a double-elimination playoff for the final 2 berths (#31 & #32) in the Champions Tournament.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedFormat('grand_cup_64');
                    if (leagueState && leagueState.postseasonFormat !== 'grand_cup_64') {
                      const updated = { ...leagueState, postseasonFormat: 'grand_cup_64' as const };
                      onUpdateLeagueState(updated);
                      saveLeagueSeasonState(updated);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all self-start"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>View Swiss Format (64)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/40 border-2 border-indigo-500/40 p-5 rounded-2xl space-y-3">
                  <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    Upper Bracket Champion &bull; Seed #31
                  </span>
                  <div className="flex items-center gap-3 pt-2">
                    {simulationResult?.wildcardPlayIn?.qualifierA || leagueState?.wildcardPlayIn?.qualifier1Id ? (
                      <>
                        <img
                          src={
                            simulationResult?.wildcardPlayIn?.qualifierA?.photoUrl ||
                            idolsMap.get(leagueState?.wildcardPlayIn?.qualifier1Id || '')?.photoUrl
                          }
                          alt="Qualifier A"
                          className="w-12 h-12 rounded-xl object-cover border border-indigo-400"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-base font-black text-indigo-100 font-poster-title">
                            {simulationResult?.wildcardPlayIn?.qualifierA?.name ||
                              idolsMap.get(leagueState?.wildcardPlayIn?.qualifier1Id || '')?.name}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {simulationResult?.wildcardPlayIn?.qualifierA?.girlGroup ||
                              idolsMap.get(leagueState?.wildcardPlayIn?.qualifier1Id || '')?.girlGroup}
                          </p>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            Advanced to {selectedFormat === 'grand_cup_64' ? 'Grand Cup 64' : 'Champions 32'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">Play-In pending simulation</p>
                    )}
                  </div>
                </div>

                <div className="bg-black/40 border-2 border-indigo-500/40 p-5 rounded-2xl space-y-3">
                  <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                    Lower Bracket Champion &bull; Seed #32
                  </span>
                  <div className="flex items-center gap-3 pt-2">
                    {simulationResult?.wildcardPlayIn?.qualifierB || leagueState?.wildcardPlayIn?.qualifier2Id ? (
                      <>
                        <img
                          src={
                            simulationResult?.wildcardPlayIn?.qualifierB?.photoUrl ||
                            idolsMap.get(leagueState?.wildcardPlayIn?.qualifier2Id || '')?.photoUrl
                          }
                          alt="Qualifier B"
                          className="w-12 h-12 rounded-xl object-cover border border-indigo-400"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-base font-black text-indigo-100 font-poster-title">
                            {simulationResult?.wildcardPlayIn?.qualifierB?.name ||
                              idolsMap.get(leagueState?.wildcardPlayIn?.qualifier2Id || '')?.name}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {simulationResult?.wildcardPlayIn?.qualifierB?.girlGroup ||
                              idolsMap.get(leagueState?.wildcardPlayIn?.qualifier2Id || '')?.girlGroup}
                          </p>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            Advanced to {selectedFormat === 'grand_cup_64' ? 'Grand Cup 64' : 'Champions 32'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">Play-In pending simulation</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
