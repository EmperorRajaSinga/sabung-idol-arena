import React, { useState, useMemo, useEffect } from 'react';
import { Idol, LeagueSeasonState, LeagueSeasonArchive, LeagueInfo } from '../types';
import {
  DataMakerDrawMode,
  DataMakerOutputFormat,
  loadDevelopmentGates,
  saveDevelopmentGates,
  DEFAULT_DATA_MAKER_GATE,
} from '../utils/developmentGates';
import {
  getLeaguePyramidRankedIdols,
  generatePyramidPotDraw,
  formatAllListsCombinedText,
  GeneratedDataList,
  PotTier,
  PyramidRankedIdol,
} from '../utils/dataMakerLogic';
import {
  calculateLeagueStandings,
  generateRoundRobinMatches,
  saveLeagueSeasonState,
} from '../utils/leagueLogic';
import {
  Wand2,
  Copy,
  Check,
  Download,
  Shuffle,
  Shield,
  Trophy,
  Sliders,
  Layers,
  Sparkles,
  ArrowRight,
  Eye,
  Settings2,
  FileText,
  RefreshCw,
  CheckCircle2,
  Zap,
  Flame,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DataMakerPanelProps {
  idols: Idol[];
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  customLeagueBranding?: Array<{
    id: number;
    name: string;
    tierName: string;
    color: string;
    logoUrl?: string;
  }>;
  onUpdateLeagueState?: (newState: LeagueSeasonState) => void;
  onImportState?: (
    newState: any,
    newLeagueState?: LeagueSeasonState | null,
    newLeagueArchives?: LeagueSeasonArchive[]
  ) => void;
  appState?: any;
}

export const DataMakerPanel: React.FC<DataMakerPanelProps> = ({
  idols,
  leagueState,
  leagueArchives,
  customLeagueBranding,
  onUpdateLeagueState,
  onImportState,
  appState,
}) => {
  // Development Gates State
  const [gatesState, setGatesState] = useState(() => loadDevelopmentGates());
  const dataMakerConfig = gatesState.dataMakerGate || DEFAULT_DATA_MAKER_GATE;

  // Configuration options
  const [rankingMetric, setRankingMetric] = useState<
    'career_points' | 'division_titles' | 'win_rate' | 'overall_rating' | 'champions_qualifiers'
  >(dataMakerConfig.rankingMetric || 'career_points');

  const [drawMode, setDrawMode] = useState<DataMakerDrawMode>(
    dataMakerConfig.defaultDrawMode || 'random_pot'
  );

  const [outputFormat, setOutputFormat] = useState<DataMakerOutputFormat>(
    dataMakerConfig.defaultOutputFormat || 'plain_names'
  );

  // UI state
  const [drawSeed, setDrawSeed] = useState<number>(1);
  const [copiedListIndex, setCopiedListIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [showPotBreakdown, setShowPotBreakdown] = useState<boolean>(false);
  const [showGateSettings, setShowGateSettings] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [selectedPotView, setSelectedPotView] = useState<number | 'all'>('all');

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  // 1. Calculate the 120 Career Pyramid Ranked Idols
  const rankedIdols = useMemo(() => {
    return getLeaguePyramidRankedIdols(idols, leagueState, leagueArchives, rankingMetric);
  }, [idols, leagueState, leagueArchives, rankingMetric]);

  // 2. Prepare League Names & Colors from active branding or defaults
  const leagueNames = useMemo(() => {
    return [1, 2, 3, 4, 5, 6].map((id) => {
      const custom = customLeagueBranding?.find((b) => b.id === id);
      const active = leagueState?.leagues?.find((l) => l.id === id);
      return custom?.name || active?.name || `Division ${id}`;
    });
  }, [customLeagueBranding, leagueState]);

  const leagueColors = useMemo(() => {
    const defaultColors = ['#3b82f6', '#f97316', '#06b6d4', '#ef4444', '#8b5cf6', '#eab308'];
    return [1, 2, 3, 4, 5, 6].map((id, idx) => {
      const custom = customLeagueBranding?.find((b) => b.id === id);
      const active = leagueState?.leagues?.find((l) => l.id === id);
      return custom?.color || active?.color || defaultColors[idx];
    });
  }, [customLeagueBranding, leagueState]);

  // 3. Generate the Pot Draw Results (20 pots of 6 -> 6 lists of 20)
  const drawResult = useMemo(() => {
    // drawSeed in dependencies triggers re-generation on shuffle
    if (drawSeed < 0) return null;
    return generatePyramidPotDraw(rankedIdols, {
      drawMode,
      outputFormat,
      leagueNames,
      leagueColors,
      rankingMetric,
    });
  }, [rankedIdols, drawMode, outputFormat, leagueNames, leagueColors, rankingMetric, drawSeed]);

  const handleReDraw = () => {
    setDrawSeed((prev) => prev + 1);
    showToast('🎲 New pot distribution draw generated across all 6 lists!');
  };

  // Copy single list (1 name per line)
  const handleCopyList = (list: GeneratedDataList, index: number) => {
    navigator.clipboard.writeText(list.formattedText);
    setCopiedListIndex(index);
    showToast(`✓ Copied ${list.leagueName} list (${list.idols.length} names, 1 per line) to clipboard!`);
    setTimeout(() => setCopiedListIndex(null), 2500);
  };

  // Copy all 6 lists combined
  const handleCopyAllLists = (format: 'headers' | 'blank_line' | 'csv' = 'headers') => {
    if (!drawResult) return;
    const delimiter = format === 'blank_line' ? 'simple_blank_line' : format === 'csv' ? 'csv_columns' : 'section_headers';
    const text = formatAllListsCombinedText(drawResult.lists, delimiter);
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    showToast('✓ Copied all 6 lists (120 idols total) to clipboard!');
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Download export files
  const handleDownloadTxt = () => {
    if (!drawResult) return;
    const text = formatAllListsCombinedText(drawResult.lists, 'section_headers');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabung_idol_data_maker_6_lists_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Downloaded text file with all 6 lists!');
  };

  const handleDownloadJson = () => {
    if (!drawResult) return;
    const exportData = {
      generator: 'Sabung Idol Arena - Data Maker & Pot Draw Generator',
      version: 1,
      timestamp: new Date().toISOString(),
      rankingMetric,
      drawMode,
      outputFormat,
      totalIdols: rankedIdols.length,
      lists: drawResult.lists.map((l) => ({
        divisionId: l.leagueId,
        divisionName: l.leagueName,
        averageRating: l.averageRating,
        totalCareerPoints: l.totalCareerPoints,
        idolsCount: l.idols.length,
        namesList: l.idols.map((i) => i.idolName),
        namesText: l.formattedText,
        idolsDetail: l.idols.map((i) => ({
          rank: i.rank,
          id: i.idolId,
          name: i.idolName,
          group: i.girlGroup,
          rating: i.rating,
          careerPoints: i.points,
          divisionTitles: i.divisionTitles,
        })),
      })),
      potsBreakdown: drawResult.pots.map((p) => ({
        potNumber: p.potNumber,
        rankRange: `#${p.rankStart} - #${p.rankEnd}`,
        idols: p.idols.map((i) => i.idolName),
        assignedLeagues: p.assignedLeagueIds,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabung_idol_pot_draw_database_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Downloaded JSON database for pot draw!');
  };

  // Direct injection into Active League State
  const handleApplySingleListToLeague = (list: GeneratedDataList) => {
    if (!leagueState) {
      showToast('⚠️ No active league season found to apply roster to.');
      return;
    }

    if (
      !window.confirm(
        `Apply these 20 idols directly to ${list.leagueName} roster? This will regenerate round-robin fixtures and update standings for this division.`
      )
    ) {
      return;
    }

    const newMemberIds = list.idols.map((i) => i.idolId);
    const updatedLeagues: LeagueInfo[] = (leagueState.leagues || []).map((l) => {
      if (l.id === list.leagueId) {
        const matches = generateRoundRobinMatches(l.id, newMemberIds);
        const standings = calculateLeagueStandings(l.id, newMemberIds, matches, idols);
        return {
          ...l,
          memberIds: newMemberIds,
          matches,
          standings,
        };
      }
      return l;
    });

    const newState: LeagueSeasonState = {
      ...leagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);

    if (onImportState && appState) {
      onImportState(
        {
          ...appState,
          leagueState: newState,
        },
        newState,
        leagueArchives
      );
    }

    showToast(`⚡ Successfully applied 20 idols to ${list.leagueName}!`);
  };

  const handleApplyAllListsToActiveLeagues = () => {
    if (!drawResult || !leagueState) {
      showToast('⚠️ No active league season found to apply rosters to.');
      return;
    }

    if (
      !window.confirm(
        '⚡ Apply all 6 generated lists (120 idols total) to all 6 divisions in the active season? This will replace active rosters and regenerate all round-robin fixtures.'
      )
    ) {
      return;
    }

    const updatedLeagues: LeagueInfo[] = (leagueState.leagues || []).map((l, idx) => {
      const generatedList = drawResult.lists[idx];
      const memberIds = generatedList ? generatedList.idols.map((i) => i.idolId) : l.memberIds;
      const matches = generateRoundRobinMatches(l.id, memberIds);
      const standings = calculateLeagueStandings(l.id, memberIds, matches, idols);

      return {
        ...l,
        memberIds,
        matches,
        standings,
      };
    });

    const newState: LeagueSeasonState = {
      ...leagueState,
      leagues: updatedLeagues,
    };

    if (onUpdateLeagueState) onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);

    if (onImportState && appState) {
      onImportState(
        {
          ...appState,
          leagueState: newState,
        },
        newState,
        leagueArchives
      );
    }

    showToast('⚡ All 6 division rosters successfully updated with the pot draw allocations!');
  };

  // Development Gate Save Handler
  const handleSaveGateConfig = () => {
    const updatedGates = {
      ...gatesState,
      dataMakerGate: {
        ...dataMakerConfig,
        rankingMetric,
        defaultDrawMode: drawMode,
        defaultOutputFormat: outputFormat,
      },
    };
    setGatesState(updatedGates);
    saveDevelopmentGates(updatedGates);
    showToast('✓ Data Maker development gate parameters saved to system storage!');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Control Deck */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-br from-[#1c120a] via-[#150d07] to-[#0c0804] p-6 poster-shadow space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-amber-950 border-2 border-black font-black shadow-md">
                <Wand2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-poster-title text-xl sm:text-2xl text-amber-400 font-black flex items-center gap-2 tracking-wide">
                  <span>DATA MAKER &amp; POT DRAW GENERATOR</span>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    20 Pots × 6 Leagues
                  </span>
                </h3>
                <p className="text-xs text-amber-200/80 font-bold">
                  Extracts all 120 idols from the career league pyramid ranking and splits them into 6 balanced lists (20 idols each, 1 name per line) by drawing 1 idol per pot tier (Pots 1–20).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleReDraw}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-poster-title text-xs font-black shadow-lg hover:scale-105 transition-all border-2 border-black"
            >
              <Shuffle className="w-4 h-4" />
              <span>🎲 Generate / Re-Draw</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyAllLists('headers')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-black text-xs font-poster-title font-black transition-all ${
                copiedAll
                  ? 'bg-emerald-500 text-emerald-950'
                  : 'bg-[#2a1d14] hover:bg-[#38261b] text-amber-300 hover:text-white'
              }`}
            >
              {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedAll ? 'Copied All 6 Lists!' : 'Copy All 6 Lists'}</span>
            </button>

            {leagueState && (
              <button
                type="button"
                onClick={handleApplyAllListsToActiveLeagues}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-poster-title text-xs font-black shadow-lg hover:scale-105 transition-all border-2 border-black"
              >
                <Zap className="w-4 h-4" />
                <span>⚡ Apply to All 6 Division Rosters</span>
              </button>
            )}
          </div>
        </div>

        {/* Generator Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ranking Metric */}
          <div className="space-y-1.5 bg-[#120b06] p-3.5 rounded-2xl border border-amber-950/60">
            <label className="text-[11px] font-poster-title font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Career Pyramid Ranking Metric</span>
            </label>
            <select
              value={rankingMetric}
              onChange={(e) => setRankingMetric(e.target.value as any)}
              className="w-full rounded-xl border border-amber-500/30 bg-[#1c120a] px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="career_points">All-Time League Points (Pyramid Standard)</option>
              <option value="division_titles">Division Championships (1st Place Titles)</option>
              <option value="overall_rating">Current Overall Rating (Highest to Lowest)</option>
              <option value="win_rate">Career Match Win Rate %</option>
              <option value="champions_qualifiers">Top 5 Champions Qualifications</option>
            </select>
          </div>

          {/* Draw Algorithm */}
          <div className="space-y-1.5 bg-[#120b06] p-3.5 rounded-2xl border border-amber-950/60">
            <label className="text-[11px] font-poster-title font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shuffle className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Pot Draw Distribution Mode</span>
            </label>
            <select
              value={drawMode}
              onChange={(e) => setDrawMode(e.target.value as DataMakerDrawMode)}
              className="w-full rounded-xl border border-amber-500/30 bg-[#1c120a] px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="random_pot">🎲 Randomized Pot Draw (Lottery from each tier)</option>
              <option value="snake">🐍 Snake Seeding (1-6, 6-1, 1-6 across pots)</option>
              <option value="direct">🎯 Direct Seed Order (1→L1, 2→L2 ... 6→L6)</option>
              <option value="rating_weighted">⚖️ Rating-Balanced Draw (Parity Optimized)</option>
            </select>
          </div>

          {/* Output Text Formatting */}
          <div className="space-y-1.5 bg-[#120b06] p-3.5 rounded-2xl border border-amber-950/60">
            <label className="text-[11px] font-poster-title font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Text Line Format (Output)</span>
            </label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as DataMakerOutputFormat)}
              className="w-full rounded-xl border border-amber-500/30 bg-[#1c120a] px-3 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="plain_names">1 Name Per Line (Website Input Format)</option>
              <option value="numbered">Numbered (1. Name, 2. Name)</option>
              <option value="with_group">With Girl Group (Name - Group)</option>
              <option value="with_rating">With Rating (Name [OVR: XX])</option>
              <option value="with_pot_tag">With Pot Tier Tag (Name - Pot #X)</option>
            </select>
          </div>

          {/* Export & Actions */}
          <div className="space-y-1.5 bg-[#120b06] p-3.5 rounded-2xl border border-amber-950/60 flex flex-col justify-between">
            <label className="text-[11px] font-poster-title font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>4. Quick Export &amp; Downloads</span>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24170d] hover:bg-[#332013] border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                <Download className="w-3 h-3" />
                <span>Export .TXT</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24170d] hover:bg-[#332013] border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                <Download className="w-3 h-3" />
                <span>Export .JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Toggles: Pot Breakdown & Dev Gate */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-950/40 text-xs">
          <div className="flex items-center gap-4 text-amber-200/70 font-semibold">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Available Idols: <strong className="text-white">{rankedIdols.length}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Pots: <strong className="text-white">20 Tiers (6 Idols Each)</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Lists: <strong className="text-white">6 Lists (20 Idols Each)</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPotBreakdown(!showPotBreakdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22140a] hover:bg-[#301c0f] border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{showPotBreakdown ? 'Hide 20-Pot Breakdown' : 'View 20-Pot Breakdown'}</span>
              {showPotBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setShowGateSettings(!showGateSettings)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22140a] hover:bg-[#301c0f] border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
            >
              <Settings2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{showGateSettings ? 'Hide Development Gate' : 'Data Maker Development Gate'}</span>
              {showGateSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* OPTIONAL EXPANSION: DEVELOPMENT GATE SETTINGS */}
      {showGateSettings && (
        <div className="rounded-3xl border-2 border-indigo-500/50 bg-[#14101e] p-6 poster-shadow space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-950 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500 text-white font-black">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-poster-title text-base text-indigo-300 font-bold">
                  DATA MAKER DEVELOPMENT GATE CONFIGURATION
                </h4>
                <p className="text-xs text-indigo-200/70">
                  Custom parameters for future expansions (custom pot sizes, secondary cup draws, custom group counts, and export presets).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveGateConfig}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-poster-title text-xs font-black shadow-lg transition-all border border-indigo-400"
            >
              <Check className="w-4 h-4" />
              <span>Save Gate Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-1">
              <span className="text-indigo-400 font-bold block">Target List Count</span>
              <span className="text-white font-black text-sm">{dataMakerConfig.targetListCount} Lists (Fixed Parallel Divisions)</span>
              <p className="text-[10px] text-indigo-300/70">Configured in developmentGates.ts</p>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-1">
              <span className="text-indigo-400 font-bold block">Items Per List</span>
              <span className="text-white font-black text-sm">{dataMakerConfig.itemsPerList} Idols per List (120 Total)</span>
              <p className="text-[10px] text-indigo-300/70">1 Idol per pot tier</p>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-1">
              <span className="text-indigo-400 font-bold block">Pots Configuration</span>
              <span className="text-white font-black text-sm">{dataMakerConfig.potsCount} Pots × {dataMakerConfig.idolsPerPot} Idols</span>
              <p className="text-[10px] text-indigo-300/70">Tier-separated pot distribution</p>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-1">
              <span className="text-indigo-400 font-bold block">Future Extension Tags</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(dataMakerConfig.futureExpansionTags || []).map((tag) => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-900 text-indigo-200 border border-indigo-700/50">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPTIONAL EXPANSION: 20-POT BREAKDOWN & DRAW ALLOCATION TABLE */}
      {showPotBreakdown && drawResult && (
        <div className="rounded-3xl border-2 border-black bg-[#160f0a] p-6 poster-shadow space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-amber-950 font-black">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-poster-title text-base text-amber-400 font-bold">
                  20-POT TIER BREAKDOWN &amp; DRAW ASSIGNMENTS
                </h4>
                <p className="text-xs text-amber-200/70 font-semibold">
                  Inspect which career pyramid ranks were grouped into each of the 20 pots and which league they were drawn into.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-300">Filter Pot:</span>
              <select
                value={selectedPotView}
                onChange={(e) => setSelectedPotView(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded-xl border border-amber-500/30 bg-[#22140a] px-3 py-1.5 text-xs font-bold text-amber-200 focus:outline-none"
              >
                <option value="all">View All 20 Pots</option>
                {Array.from({ length: 20 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Pot #{i + 1} (Ranks #{i * 6 + 1} - #{(i + 1) * 6})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {drawResult.pots
              .filter((p) => selectedPotView === 'all' || p.potNumber === selectedPotView)
              .map((pot) => (
                <div
                  key={pot.potNumber}
                  className="rounded-2xl border-2 border-black bg-[#1f140c] p-3.5 space-y-2.5 poster-shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
                    <span className="font-poster-title text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>POT #{pot.potNumber}</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                      Ranks #{pot.rankStart} – #{pot.rankEnd}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {pot.idols.map((idol, idolIdx) => {
                      const assignedDivId = pot.assignedLeagueIds?.[idolIdx] || idolIdx + 1;
                      const divName = leagueNames[assignedDivId - 1] || `Division ${assignedDivId}`;
                      const divColor = leagueColors[assignedDivId - 1] || '#3b82f6';

                      return (
                        <div
                          key={idol.idolId}
                          className="flex items-center justify-between p-1.5 rounded-xl bg-black/40 border border-black/80 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-amber-400/80 w-5 text-right">
                              #{idol.rank}
                            </span>
                            <span className="font-bold text-white truncate max-w-[110px]">
                              {idol.idolName}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-poster-title font-black text-slate-950 border border-black"
                              style={{ backgroundColor: divColor }}
                            >
                              Div {assignedDivId}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* THE 6 GENERATED LISTS (20 IDOLS EACH) */}
      {drawResult && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-poster-title text-xl text-white font-black flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>6 SEPARATE LISTS (20 IDOLS EACH • 1 NAME PER LINE)</span>
              </h3>
              <p className="text-xs text-amber-200/70 font-semibold">
                Each list contains exactly 20 idols (1 drawn from each of the 20 pots). Ready to copy directly into the website.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyAllLists('blank_line')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#24170d] hover:bg-[#332013] border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy 6 Continuous Blocks</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {drawResult.lists.map((list, idx) => {
              const isCopied = copiedListIndex === idx;

              return (
                <div
                  key={list.leagueId}
                  className="rounded-3xl border-2 border-black bg-[#160f0a] poster-shadow overflow-hidden flex flex-col justify-between"
                  style={{
                    boxShadow: `0 8px 24px -6px ${list.color}25`,
                  }}
                >
                  {/* List Header */}
                  <div
                    className="p-4 border-b-2 border-black flex items-center justify-between"
                    style={{
                      backgroundColor: `${list.color}15`,
                      borderTop: `4px solid ${list.color}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black flex-shrink-0"
                        style={{ backgroundColor: list.color }}
                      />
                      <div className="min-w-0">
                        <h4 className="font-poster-title text-base font-black text-white truncate">
                          {list.leagueName}
                        </h4>
                        <p className="text-[11px] text-amber-400/80 font-bold truncate">
                          List #{list.leagueId} • {list.idols.length} Idols (1 per pot)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/60 text-amber-300 font-bold border border-black">
                        Avg OVR: {list.averageRating}
                      </span>
                    </div>
                  </div>

                  {/* List Content: 1 Name Per Line Textarea / Codeblock */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="relative">
                      <textarea
                        readOnly
                        rows={10}
                        value={list.formattedText}
                        className="w-full font-mono text-xs text-amber-100 bg-[#0d0804] p-3 rounded-2xl border-2 border-black focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none selection:bg-amber-500 selection:text-black leading-relaxed"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyList(list, idx)}
                          title="Copy this list (1 name per line)"
                          className={`p-1.5 rounded-xl border border-black shadow transition-all ${
                            isCopied
                              ? 'bg-emerald-500 text-emerald-950'
                              : 'bg-amber-500 hover:bg-amber-400 text-amber-950'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyList(list, idx)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border-2 border-black font-poster-title text-xs font-black transition-all ${
                          isCopied
                            ? 'bg-emerald-500 text-emerald-950'
                            : 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-md hover:scale-[1.02]'
                        }`}
                      >
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{isCopied ? 'Copied 20 Names!' : 'Copy List (20 Names)'}</span>
                      </button>

                      {leagueState && (
                        <button
                          type="button"
                          onClick={() => handleApplySingleListToLeague(list)}
                          title={`Apply directly to ${list.leagueName} roster`}
                          className="flex items-center justify-center p-2 rounded-xl bg-[#2a1d14] hover:bg-[#38261b] border-2 border-black text-amber-300 hover:text-white transition-all text-xs font-bold"
                        >
                          <Zap className="w-4 h-4 text-teal-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Footer Tier Composition Pill */}
                  <div className="bg-black/60 px-4 py-2 border-t border-black flex items-center justify-between text-[10px] text-amber-200/60 font-mono">
                    <span>Pots Drawn: #1 to #20</span>
                    <span>Career Pts: {list.totalCareerPoints}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notificationMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-poster-title font-black text-sm shadow-2xl border-2 border-black animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-slate-950 flex-shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}
    </div>
  );
};
