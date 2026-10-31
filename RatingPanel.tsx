import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Idol,
  CareerStat,
  TournamentArchive,
  ArchivedMatch,
  LeagueSeasonArchive,
  LeagueSeasonState,
  Group,
  KnockoutMatch,
  TournamentConfig,
} from '../types';
import {
  Sparkles,
  Search,
  RotateCcw,
  TrendingUp,
  Award,
  Sliders,
  Zap,
  Check,
  Filter,
  Users,
  Shield,
  HelpCircle,
  BarChart3,
  Dices,
  Play,
  Flame,
  Scale,
  ArrowUpDown,
  X,
  ChevronUp,
  ChevronDown,
  Info,
  CheckCircle,
  Trophy,
  History,
  Save,
  AlertTriangle,
} from 'lucide-react';
import {
  getIdolRating,
  getRatingTierInfo,
  calculateDynamicRatingFromStats,
  getDefaultIdolRating,
  calculateRatingWinProbability,
  buildSeasonProgressionAnalysis,
  SeasonProgressionAnalysis,
  SeasonProgressionItem,
} from '../utils/ratingHelper';
import { simulateGroupMatchScore } from '../utils/tournamentLogic';

interface RatingPanelProps {
  idols: Idol[];
  onUpdateIdols: (updatedIdols: Idol[]) => void;
  careerStats?: CareerStat[];
  archives?: TournamentArchive[];
  matchDatabase?: ArchivedMatch[];
  leagueArchives?: LeagueSeasonArchive[];
  leagueState?: LeagueSeasonState | null;
  currentGroups?: Group[];
  currentKnockoutMatches?: KnockoutMatch[];
  currentConfig?: TournamentConfig;
}

interface IdolRatingCardProps {
  idol: Idol;
  stat?: CareerStat;
  isModified?: boolean;
  originalRating?: number;
  onRatingChange: (idolId: string, newRating: number) => void;
}

const IdolRatingCard: React.FC<IdolRatingCardProps> = ({
  idol,
  stat,
  isModified = false,
  originalRating,
  onRatingChange,
}) => {
  const currentRating = getIdolRating(idol);
  const [localRating, setLocalRating] = useState<number>(currentRating);
  const isDraggingRef = useRef(false);

  // Sync external changes (e.g. batch updates or resets) when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalRating(currentRating);
    }
  }, [currentRating]);

  const handleChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVal)));
    setLocalRating(clamped);
    onRatingChange(idol.id, clamped);
  };

  const tierInfo = getRatingTierInfo(localRating);

  return (
    <div
      id={`idol-rating-card-${idol.id}`}
      className={`rounded-2xl border-2 bg-[#1b130e] p-4 flex flex-col justify-between gap-3 shadow-lg transition-all poster-shadow-sm relative overflow-hidden ${
        isModified ? 'border-amber-400/80 ring-1 ring-amber-400/40' : 'border-black hover:border-amber-500/50'
      }`}
    >
      {/* Top header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-xl overflow-hidden bg-black border-2 border-black shrink-0 relative">
            {idol.photoUrl ? (
              <img
                src={idol.photoUrl}
                alt={idol.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center font-bold text-amber-300 text-sm">
                {idol.name.slice(0, 2)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-white truncate">{idol.name}</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-amber-400 font-bold truncate">{idol.girlGroup}</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-[10px] text-amber-300/80 bg-black/60 px-1.5 py-0.5 rounded border border-black">
                {idol.seed || 'Unseeded'}
              </span>
              {isModified && (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  Staged
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1.5">
            {isModified && originalRating !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black border ${
                  localRating > originalRating
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                    : localRating < originalRating
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                    : 'bg-black/60 text-slate-400 border-black'
                }`}
                title={`Original: ${originalRating}`}
              >
                {localRating > originalRating ? `+${localRating - originalRating}` : `${localRating - originalRating}`}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${tierInfo.badgeBg}`}>
              {tierInfo.tier} Tier
            </span>
          </div>
          <div className="flex items-baseline justify-end gap-1.5 mt-1">
            {isModified && originalRating !== undefined && (
              <span className="text-xs font-mono font-bold text-amber-200/40 line-through">
                {originalRating}
              </span>
            )}
            <div className={`text-2xl font-black font-mono leading-none ${isModified ? 'text-amber-300' : 'text-amber-300'}`}>
              {localRating}
            </div>
          </div>
        </div>
      </div>

      {/* Slider & Quick Buttons */}
      <div className="space-y-2 pt-1 border-t border-black/40">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={localRating}
            onPointerDown={() => {
              isDraggingRef.current = true;
            }}
            onPointerUp={() => {
              isDraggingRef.current = false;
            }}
            onChange={(e) => handleChange(Number(e.target.value))}
            className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <input
            type="number"
            min="0"
            max="100"
            value={localRating}
            onChange={(e) => handleChange(Number(e.target.value))}
            className="w-14 py-1 px-1.5 bg-black border border-amber-500/40 rounded-lg text-center font-mono font-black text-xs text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Quick adjustments */}
        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleChange(localRating - 5)}
              className="px-2 py-1 rounded bg-black/60 hover:bg-black text-[10px] font-bold text-amber-200/80 border border-black transition-transform active:scale-95"
            >
              -5
            </button>
            <button
              onClick={() => handleChange(localRating + 5)}
              className="px-2 py-1 rounded bg-black/60 hover:bg-black text-[10px] font-bold text-amber-200/80 border border-black transition-transform active:scale-95"
            >
              +5
            </button>
          </div>

          <div className="flex items-center gap-1">
            {[95, 88, 80, 70].map((preset) => (
              <button
                key={preset}
                onClick={() => handleChange(preset)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-black font-mono transition-colors ${
                  localRating === preset
                    ? 'bg-amber-400 text-black'
                    : 'bg-black/40 text-slate-400 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Career context footer */}
        {stat && (
          <div className="text-[10px] font-mono text-amber-200/60 pt-1 flex items-center justify-between">
            <span>
              Record: {stat.wins}W - {stat.losses}L ({stat.winRate}%)
            </span>
            <span>{stat.championships || 0} Cups Won</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const RatingPanel: React.FC<RatingPanelProps> = ({
  idols,
  onUpdateIdols,
  careerStats = [],
  archives = [],
  matchDatabase = [],
  leagueArchives = [],
  leagueState = null,
  currentGroups = [],
  currentKnockoutMatches = [],
  currentConfig,
}) => {
  // Local staged state to prevent lagging during user edits
  const [localIdols, setLocalIdols] = useState<Idol[]>(idols);
  const prevIdolsPropRef = useRef(idols);

  // Keep local state in sync when parent idols reference changes (e.g. roster load)
  useEffect(() => {
    if (prevIdolsPropRef.current !== idols) {
      prevIdolsPropRef.current = idols;
      setLocalIdols(idols);
    }
  }, [idols]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'default' | 'rating-desc' | 'rating-asc' | 'name' | 'group'>('default');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [sortVersion, setSortVersion] = useState(0);

  // Confirmation Modal State for Auto Rating actions
  interface ConfirmModalConfig {
    isOpen: boolean;
    title: string;
    description: string;
    impactSummary: string;
    confirmLabel: string;
    confirmColor: string;
    icon: React.ReactNode;
    onConfirm: () => void;
  }
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);
  const closeConfirmModal = () => setConfirmModal(null);

  // Last Season Progression Modal State
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [selectedProgressionSeason, setSelectedProgressionSeason] = useState<string | number | 'ALL'>('ALL');
  const [progressionAnalysis, setProgressionAnalysis] = useState<SeasonProgressionAnalysis | null>(null);
  const [progressionFilter, setProgressionFilter] = useState<'all' | 'risers' | 'fallers' | 'steady'>('all');
  const [progressionSearch, setProgressionSearch] = useState('');
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});

  // Head-to-head live simulator tester state
  const [simIdolAId, setSimIdolAId] = useState<string>(() => idols[0]?.id || '');
  const [simIdolBId, setSimIdolBId] = useState<string>(() => idols[1]?.id || idols[0]?.id || '');
  const [simTestResults, setSimTestResults] = useState<{
    runs: number;
    winsA: number;
    draws: number;
    winsB: number;
  } | null>(null);

  // Group list (from local state)
  const uniqueGroups = useMemo(() => {
    const groups = new Set<string>();
    localIdols.forEach((i) => {
      if (i.girlGroup) groups.add(i.girlGroup);
    });
    return Array.from(groups).sort();
  }, [localIdols]);

  // Career stat map
  const careerMap = useMemo(() => {
    const map = new Map<string, CareerStat>();
    careerStats.forEach((c) => map.set(c.idolId, c));
    return map;
  }, [careerStats]);

  // Map of original idols from props (for diffing unsaved changes)
  const idolsById = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  // Map of local staged idols
  const localIdolsById = useMemo(() => {
    const map = new Map<string, Idol>();
    localIdols.forEach((i) => map.set(i.id, i));
    return map;
  }, [localIdols]);

  // Diff map for unsaved edits
  const unsavedChangesMap = useMemo(() => {
    const map = new Map<string, { oldRating: number; newRating: number }>();
    localIdols.forEach((local) => {
      const orig = idolsById.get(local.id);
      const origRating = orig ? getIdolRating(orig) : 70;
      const newRating = getIdolRating(local);
      if (origRating !== newRating) {
        map.set(local.id, { oldRating: origRating, newRating });
      }
    });
    return map;
  }, [localIdols, idolsById]);

  const unsavedCount = unsavedChangesMap.size;
  const hasUnsavedChanges = unsavedCount > 0;

  // Handle single idol rating update (LOCAL BUFFERED ONLY - NO LAG)
  const handleRatingChange = (idolId: string, newRating: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newRating)));
    setLocalIdols((prev) => prev.map((i) => (i.id === idolId ? { ...i, rating: clamped } : i)));
    setSimTestResults(null);
  };

  const triggerSaveIndicator = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // Handle explicit save button click
  const handleSaveRatings = () => {
    onUpdateIdols(localIdols);
    prevIdolsPropRef.current = localIdols;
    triggerSaveIndicator();
  };

  // Discard all unsaved changes
  const handleDiscardChanges = () => {
    setLocalIdols(idols);
    setSimTestResults(null);
  };

  // Open Last Season Progression Review Modal
  const handleOpenProgressionModal = () => {
    const analysis = buildSeasonProgressionAnalysis(
      localIdols,
      archives,
      matchDatabase,
      leagueArchives,
      leagueState,
      currentGroups,
      currentKnockoutMatches,
      currentConfig
    );
    setProgressionAnalysis(analysis);
    setSelectedProgressionSeason(analysis.seasonId);
    setProgressionFilter('all');
    setProgressionSearch('');
    setShowProgressionModal(true);
  };

  const handleSeasonChange = (sId: string | number | 'ALL') => {
    setSelectedProgressionSeason(sId);
    const analysis = buildSeasonProgressionAnalysis(
      localIdols,
      archives,
      matchDatabase,
      leagueArchives,
      leagueState,
      currentGroups,
      currentKnockoutMatches,
      currentConfig,
      sId
    );
    setProgressionAnalysis(analysis);
  };

  const toggleReasonExpand = (id: string) => {
    setExpandedReasons((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Apply Season Progression Changes (stages changes in local state)
  const handleApplyProgression = () => {
    if (!progressionAnalysis) return;
    const ratingMap = new Map<string, number>();
    progressionAnalysis.items.forEach((item) => {
      ratingMap.set(item.idolId, item.newRating);
    });

    const updated = localIdols.map((idol) => {
      const newRating = ratingMap.get(idol.id);
      if (newRating !== undefined) {
        return { ...idol, rating: newRating };
      }
      return idol;
    });

    setLocalIdols(updated);
    setSortVersion((v) => v + 1);
    setSimTestResults(null);
    setShowProgressionModal(false);
  };

  // --- Auto-rating actions with confirmation protection ---

  // 1. Sync from Career Stats
  const executeAutoCalcFromStats = () => {
    const updated = localIdols.map((idol) => {
      const stat = careerMap.get(idol.id);
      if (stat && stat.matches > 0) {
        const rating = calculateDynamicRatingFromStats({
          wins: stat.wins,
          matches: stat.matches,
          winRate: stat.winRate,
          championships: stat.championships,
          seed: idol.seed,
        });
        return { ...idol, rating };
      }
      return { ...idol, rating: getDefaultIdolRating(idol.seed) };
    });
    setLocalIdols(updated);
    setSortVersion((v) => v + 1);
    setSimTestResults(null);
    closeConfirmModal();
  };

  const handlePromptAutoCalcFromStats = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Sync Ratings from Career Stats',
      description: 'Automatically recalculates competitor ratings based on cumulative career win rates, total matches, championships, and tournament tier baselines.',
      impactSummary: `This will stage rating calculations for all ${localIdols.length} idols. Changes will be kept in the editor until you click "Save Ratings".`,
      confirmLabel: 'Recalculate & Stage',
      confirmColor: 'bg-indigo-500 hover:bg-indigo-400 text-black font-black',
      icon: <TrendingUp className="w-6 h-6 text-indigo-400" />,
      onConfirm: executeAutoCalcFromStats,
    });
  };

  // 2. Seed Presets
  const executeSeedPresets = () => {
    const updated = localIdols.map((idol) => {
      const s = (idol.seed || '').toLowerCase();
      let rating = 70;
      if (s.includes('1')) rating = 92;
      else if (s.includes('2')) rating = 84;
      else if (s.includes('3')) rating = 76;
      else if (s.includes('4')) rating = 68;
      return { ...idol, rating };
    });
    setLocalIdols(updated);
    setSortVersion((v) => v + 1);
    setSimTestResults(null);
    closeConfirmModal();
  };

  const handlePromptSeedPresets = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Apply Standard Seed Presets',
      description: 'Sets official tournament benchmark ratings: Seed 1 = 92 (S Tier), Seed 2 = 84 (A Tier), Seed 3 = 76 (B Tier), Seed 4 = 68 (C Tier).',
      impactSummary: `This will reset all ${localIdols.length} idols to standard seeded rating tiers. Changes will be staged in the editor until you click "Save Ratings".`,
      confirmLabel: 'Apply Presets & Stage',
      confirmColor: 'bg-amber-500 hover:bg-amber-400 text-amber-950 font-black',
      icon: <Award className="w-6 h-6 text-amber-400" />,
      onConfirm: executeSeedPresets,
    });
  };

  // 3. Reset All to 75 (Baseline)
  const executeResetToBaseline = () => {
    const updated = localIdols.map((idol) => ({ ...idol, rating: 75 }));
    setLocalIdols(updated);
    setSortVersion((v) => v + 1);
    setSimTestResults(null);
    closeConfirmModal();
  };

  const handlePromptResetToBaseline = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset All Idols to Baseline (75)',
      description: 'Sets every competitor rating to a flat 75 (Mid B Tier). Equalizes all simulated match odds to a 50/50 baseline.',
      impactSummary: `All previous ratings across ${localIdols.length} idols will be equalized to 75. Changes will be staged in the editor until you click "Save Ratings".`,
      confirmLabel: 'Reset All to 75',
      confirmColor: 'bg-rose-600 hover:bg-rose-500 text-white font-bold',
      icon: <RotateCcw className="w-6 h-6 text-rose-400" />,
      onConfirm: executeResetToBaseline,
    });
  };

  // 4. Realistic Variety Randomizer
  const executeRealisticRandomize = () => {
    const updated = localIdols.map((idol) => {
      const seedBonus = idol.seed === 'Seed 1' ? 12 : idol.seed === 'Seed 2' ? 6 : 0;
      const base = 65 + Math.floor(Math.random() * 25) + seedBonus;
      return { ...idol, rating: Math.min(98, Math.max(50, base)) };
    });
    setLocalIdols(updated);
    setSortVersion((v) => v + 1);
    setSimTestResults(null);
    closeConfirmModal();
  };

  const handlePromptRealisticRandomize = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Generate Realistic Variety Ratings',
      description: 'Applies randomized organic rating distributions with tournament seed weighting bonuses (ranging from 50 to 98).',
      impactSummary: `This will randomize ratings across all ${localIdols.length} idols with seed advantages preserved. Changes will be staged in the editor until you click "Save Ratings".`,
      confirmLabel: 'Generate & Stage',
      confirmColor: 'bg-purple-500 hover:bg-purple-400 text-black font-black',
      icon: <Dices className="w-6 h-6 text-purple-400" />,
      onConfirm: executeRealisticRandomize,
    });
  };

  // STABLE FILTERING & ORDERING:
  const orderedIdolIds = useMemo(() => {
    const list = [...localIdols];

    const filtered = list.filter((idol) => {
      const currentRating = getIdolRating(idol);
      const tierInfo = getRatingTierInfo(currentRating);

      if (selectedGroup !== 'ALL' && idol.girlGroup !== selectedGroup) return false;
      if (selectedTier !== 'ALL' && tierInfo.tier !== selectedTier) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = idol.name.toLowerCase().includes(q);
        const matchesGroup = (idol.girlGroup || '').toLowerCase().includes(q);
        if (!matchesName && !matchesGroup) return false;
      }

      return true;
    });

    if (sortBy === 'rating-desc') {
      filtered.sort((a, b) => getIdolRating(b) - getIdolRating(a));
    } else if (sortBy === 'rating-asc') {
      filtered.sort((a, b) => getIdolRating(a) - getIdolRating(b));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'group') {
      filtered.sort((a, b) => (a.girlGroup || '').localeCompare(b.girlGroup || '') || a.name.localeCompare(b.name));
    }

    return filtered.map((i) => i.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup, selectedTier, searchQuery, sortBy, sortVersion, localIdols]);

  // Retrieve current idol objects by ordered IDs
  const processedIdols = useMemo(() => {
    return orderedIdolIds
      .map((id) => localIdolsById.get(id))
      .filter((idol): idol is Idol => Boolean(idol));
  }, [orderedIdolIds, localIdolsById]);

  // Overall stats
  const averageRating = useMemo(() => {
    if (localIdols.length === 0) return 0;
    const sum = localIdols.reduce((acc, i) => acc + getIdolRating(i), 0);
    return Math.round(sum / localIdols.length);
  }, [localIdols]);

  const tierCounts = useMemo(() => {
    const counts = { 'S+': 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
    localIdols.forEach((i) => {
      const r = getIdolRating(i);
      const t = getRatingTierInfo(r).tier;
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [localIdols]);

  // Simulator test idols
  const simIdolA = useMemo(
    () => localIdolsById.get(simIdolAId) || localIdols[0],
    [localIdolsById, simIdolAId, localIdols]
  );
  const simIdolB = useMemo(
    () => localIdolsById.get(simIdolBId) || localIdols[1] || localIdols[0],
    [localIdolsById, simIdolBId, localIdols]
  );

  const ratingSimA = simIdolA ? getIdolRating(simIdolA) : 70;
  const ratingSimB = simIdolB ? getIdolRating(simIdolB) : 70;
  const winProbA = simIdolA && simIdolB ? calculateRatingWinProbability(ratingSimA, ratingSimB) : 0.5;
  const winProbB = 1 - winProbA;

  // Run test simulations
  const runTestSimulations = (runs: number) => {
    if (!simIdolA || !simIdolB) return;
    let winsA = 0;
    let draws = 0;
    let winsB = 0;

    for (let i = 0; i < runs; i++) {
      const result = simulateGroupMatchScore(simIdolA, simIdolB);
      if (result.winnerSlot === 'A') winsA++;
      else if (result.winnerSlot === 'DRAW') draws++;
      else winsB++;
    }

    setSimTestResults({
      runs,
      winsA,
      draws,
      winsB,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Description */}
      <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#1f130b] via-[#1a120d] to-[#24130d] p-6 shadow-xl space-y-4 poster-shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-black pb-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-poster-title text-amber-400 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
              <Sliders className="h-7 w-7 text-amber-400" />
              <span>Idol Rating &amp; Skill Power Manager</span>
            </h2>
            <p className="text-xs text-amber-200/80 font-bold max-w-3xl leading-relaxed">
              Configure fine-grained skill ratings (scale <span className="text-amber-300 font-black">0 to 100</span>) for every competitor.
              Ratings directly control mathematical win probabilities and simulation engines across <span className="text-amber-300 font-bold">Tournament Cups, Group Stages, Knockout Brackets, League Divisions, Minigames, and the Wheel Picker</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-black/60 border border-amber-500/40 rounded-2xl px-4 py-2 text-center">
              <span className="text-[10px] uppercase font-black tracking-widest text-amber-400/80 block">
                Roster Avg Rating
              </span>
              <span className="text-2xl font-black text-amber-300 font-mono">
                {averageRating}
              </span>
            </div>

            {hasUnsavedChanges && (
              <button
                onClick={handleDiscardChanges}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-black/70 hover:bg-black text-amber-300/80 hover:text-white border-2 border-black font-bold text-xs transition-all active:scale-95 cursor-pointer"
                title="Discard unsaved rating changes and revert to saved roster"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard ({unsavedCount})</span>
              </button>
            )}

            <button
              onClick={handleSaveRatings}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider border-2 border-black poster-shadow-sm shadow-md transition-all active:scale-95 cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 ring-2 ring-amber-400/50 animate-pulse'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950'
              }`}
              title="Save and synchronize all ratings across all arena divisions and formats"
            >
              <Save className="w-4 h-4 text-amber-950" />
              <span>{hasUnsavedChanges ? `Save Ratings (${unsavedCount})` : 'Save Ratings'}</span>
            </button>

            {savedSuccess && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-bold animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>Saved &amp; Synced!</span>
              </div>
            )}
          </div>
        </div>

        {/* Unsaved changes notification banner */}
        {hasUnsavedChanges && (
          <div className="p-3 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-200 font-bold">
                You have <span className="text-amber-300 font-black">{unsavedCount} unsaved rating change{unsavedCount > 1 ? 's' : ''}</span> staged locally. Click <span className="text-white font-extrabold underline">Save Ratings</span> to apply them across the game.
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleDiscardChanges}
                className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black text-slate-300 text-xs font-bold border border-black transition-colors"
              >
                Revert
              </button>
              <button
                onClick={handleSaveRatings}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black text-xs transition-all shadow active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Now</span>
              </button>
            </div>
          </div>
        )}

        {/* Tier Distribution Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
          {(['S+', 'S', 'A', 'B', 'C', 'D'] as const).map((tier) => {
            const count = tierCounts[tier];
            const isSelected = selectedTier === tier;
            const tInfo = getRatingTierInfo(
              tier === 'S+' ? 95 : tier === 'S' ? 88 : tier === 'A' ? 80 : tier === 'B' ? 70 : tier === 'C' ? 60 : 40
            );

            return (
              <button
                key={tier}
                onClick={() => {
                  setSelectedTier(isSelected ? 'ALL' : tier);
                }}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-between transition-all ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/20 scale-105 shadow-md'
                    : 'border-black bg-black/40 hover:bg-black/60'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${tInfo.badgeBg}`}>
                    {tier}
                  </span>
                  <span className="text-[10px] font-mono text-amber-200/70">
                    {tInfo.minScore}-{tInfo.maxScore}
                  </span>
                </div>
                <span className="text-sm font-black font-mono text-white mt-1">
                  {count} <span className="text-[10px] text-slate-400 font-normal">idols</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Batch Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-amber-200/80 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Presets &amp; Tools:</span>
            </span>

            <button
              onClick={handlePromptAutoCalcFromStats}
              title="Automatically calculate ratings based on career win rates, total matches, and championship trophies"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sync from Career Stats</span>
            </button>

            <button
              onClick={handleOpenProgressionModal}
              title="Update ratings progressively based on performance in the last season (-4 to +4 fair, balanced evolution)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>Update Rating (Last Season)</span>
            </button>

            <button
              onClick={handlePromptSeedPresets}
              title="Set Seed 1 = 92, Seed 2 = 84, Seed 3 = 76, Seed 4 = 68"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Apply Seed Presets</span>
            </button>

            <button
              onClick={handlePromptRealisticRandomize}
              title="Randomize realistic ratings with Seed weighting (55-98)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-purple-400" />
              <span>Realistic Variety</span>
            </button>
          </div>

          <button
            onClick={handlePromptResetToBaseline}
            title="Reset all idols to baseline rating of 75"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black border border-black text-slate-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All to 75</span>
          </button>
        </div>
      </div>

      {/* Head-to-Head Simulation Probability Tester */}
      <div className="rounded-2xl border-2 border-black bg-[#160f0a] p-5 poster-shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-poster-title text-amber-300 leading-tight">
                Live Rating Win Probability &amp; Simulation Tester
              </h3>
              <p className="text-[11px] text-amber-200/70 font-semibold">
                Test and verify how rating differences impact head-to-head match outcomes in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => runTestSimulations(100)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all active:scale-95 shadow"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Simulate 100 Matches</span>
            </button>
            <button
              onClick={() => runTestSimulations(1000)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#261d16] hover:bg-amber-900/60 text-amber-300 border border-black text-xs font-black transition-all active:scale-95"
            >
              <Dices className="w-3.5 h-3.5 text-yellow-400" />
              <span>Simulate 1,000</span>
            </button>
          </div>
        </div>

        {simIdolA && simIdolB && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Idol A Select & Quick Slider */}
              <div className="p-3.5 rounded-xl bg-black/60 border border-red-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase text-red-400">Contender A</span>
                  <span className="text-xs font-mono font-black text-amber-300">
                    Rating: {ratingSimA} ({getRatingTierInfo(ratingSimA).tier} Tier)
                  </span>
                </div>
                <select
                  value={simIdolAId}
                  onChange={(e) => {
                    setSimIdolAId(e.target.value);
                    setSimTestResults(null);
                  }}
                  className="w-full rounded-lg bg-black border border-black px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {idols.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.girlGroup}) — Rating: {getIdolRating(i)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ratingSimA}
                    onChange={(e) => handleRatingChange(simIdolA.id, Number(e.target.value))}
                    className="w-full h-2 bg-[#221711] rounded-lg appearance-none cursor-pointer accent-red-400"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={ratingSimA}
                    onChange={(e) => handleRatingChange(simIdolA.id, Number(e.target.value))}
                    className="w-14 py-0.5 px-1.5 bg-black border border-red-500/40 rounded-lg text-center font-mono font-black text-xs text-red-400"
                  />
                </div>
              </div>

              {/* Idol B Select & Quick Slider */}
              <div className="p-3.5 rounded-xl bg-black/60 border border-blue-500/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase text-blue-400">Contender B</span>
                  <span className="text-xs font-mono font-black text-amber-300">
                    Rating: {ratingSimB} ({getRatingTierInfo(ratingSimB).tier} Tier)
                  </span>
                </div>
                <select
                  value={simIdolBId}
                  onChange={(e) => {
                    setSimIdolBId(e.target.value);
                    setSimTestResults(null);
                  }}
                  className="w-full rounded-lg bg-black border border-black px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {idols.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.girlGroup}) — Rating: {getIdolRating(i)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={ratingSimB}
                    onChange={(e) => handleRatingChange(simIdolB.id, Number(e.target.value))}
                    className="w-full h-2 bg-[#221711] rounded-lg appearance-none cursor-pointer accent-blue-400"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={ratingSimB}
                    onChange={(e) => handleRatingChange(simIdolB.id, Number(e.target.value))}
                    className="w-14 py-0.5 px-1.5 bg-black border border-blue-500/40 rounded-lg text-center font-mono font-black text-xs text-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Probability Gauge Bar */}
            <div className="p-3 rounded-xl bg-black/80 border border-black space-y-2">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-red-400">
                  {simIdolA.name}: {(winProbA * 100).toFixed(1)}% Win Chance
                </span>
                <span className="text-amber-300/80 font-mono text-[11px]">
                  Δ Rating: {ratingSimA - ratingSimB > 0 ? `+${ratingSimA - ratingSimB}` : ratingSimA - ratingSimB}
                </span>
                <span className="text-blue-400">
                  {simIdolB.name}: {(winProbB * 100).toFixed(1)}% Win Chance
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex border border-black">
                <div
                  style={{ width: `${winProbA * 100}%` }}
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
                />
                <div
                  style={{ width: `${winProbB * 100}%` }}
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
                />
              </div>
            </div>

            {/* Test Simulation Results Banner */}
            {simTestResults && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-200">
                    Empirical Results ({simTestResults.runs.toLocaleString()} Simulated Matches):
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono font-black">
                  <span className="text-red-400">
                    {simIdolA.name}: {simTestResults.winsA}W (
                    {((simTestResults.winsA / simTestResults.runs) * 100).toFixed(1)}%)
                  </span>
                  <span className="text-amber-300">
                    Draws: {simTestResults.draws} (
                    {((simTestResults.draws / simTestResults.runs) * 100).toFixed(1)}%)
                  </span>
                  <span className="text-blue-400">
                    {simIdolB.name}: {simTestResults.winsB}W (
                    {((simTestResults.winsB / simTestResults.runs) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search, Filters, and Stable Sorting Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-[#17100b] p-3 rounded-2xl border-2 border-black poster-shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/60" />
          <input
            type="text"
            placeholder="Search idol by name or girl group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/60 border border-black rounded-xl text-xs font-bold text-white placeholder-amber-200/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Girl Group filter */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="rounded-xl border border-black bg-black/80 px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Girl Groups</option>
            {uniqueGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setSortVersion((v) => v + 1);
              }}
              className="rounded-xl border border-black bg-black/80 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="default">Order: Stable Roster</option>
              <option value="name">Order: Alphabetical (A-Z)</option>
              <option value="group">Order: By Girl Group</option>
              <option value="rating-desc">Order: Highest Rating (S+ &rarr; D)</option>
              <option value="rating-asc">Order: Lowest Rating (D &rarr; S+)</option>
            </select>

            {(sortBy === 'rating-desc' || sortBy === 'rating-asc') && (
              <button
                onClick={() => setSortVersion((v) => v + 1)}
                title="Re-sort grid items based on recently updated ratings"
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all active:scale-95 shrink-0"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Re-Sort</span>
              </button>
            )}

            {hasUnsavedChanges && (
              <button
                onClick={handleDiscardChanges}
                title="Discard all unsaved rating changes"
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-black/80 hover:bg-black text-amber-300/80 hover:text-white border border-black font-bold text-xs transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
            )}

            <button
              onClick={handleSaveRatings}
              title="Save all changes to ratings"
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-black font-black text-xs transition-all active:scale-95 shrink-0 shadow-sm cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 ring-1 ring-amber-400/50 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-amber-950'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? `Save (${unsavedCount})` : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Idols Rating Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedIdols.map((idol) => (
          <IdolRatingCard
            key={idol.id}
            idol={idol}
            stat={careerMap.get(idol.id)}
            isModified={unsavedChangesMap.has(idol.id)}
            originalRating={idolsById.get(idol.id)?.rating}
            onRatingChange={handleRatingChange}
          />
        ))}
      </div>

      {processedIdols.length === 0 && (
        <div className="py-12 text-center rounded-2xl border-2 border-black bg-[#1a120d] text-amber-200/50 text-xs font-bold">
          No idols match the current filter or search criteria.
        </div>
      )}

      {/* STICKY FLOATING ACTION BAR FOR UNSAVED CHANGES */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto animate-in slide-in-from-bottom-5 duration-300">
          <div className="rounded-2xl border-3 border-black bg-[#1f130b]/95 backdrop-blur-md px-4 py-3 shadow-2xl poster-shadow-lg flex items-center justify-between gap-4 border-amber-400/60 ring-2 ring-amber-400/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white flex items-center gap-1.5 truncate">
                  <span>{unsavedCount} Unsaved Changes Staged</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-mono">
                    Local
                  </span>
                </div>
                <div className="text-[10px] text-amber-200/70 truncate hidden sm:block">
                  Click save to persist changes across all tournaments and leagues
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDiscardChanges}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black text-slate-300 text-xs font-bold border border-black transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>

              <button
                onClick={handleSaveRatings}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs uppercase tracking-wider transition-all border border-black shadow-md active:scale-95 cursor-pointer animate-pulse"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO RATING BATCH CONFIRMATION MODAL */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="rounded-3xl border-3 border-black bg-[#170e08] max-w-md w-full flex flex-col shadow-2xl overflow-hidden poster-shadow-lg border-amber-500/40">
            <div className="p-5 border-b-2 border-black bg-[#20120a] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-black border-2 border-black shrink-0">
                  {confirmModal.icon}
                </div>
                <div>
                  <h3 className="text-lg font-poster-title text-amber-400 leading-tight">
                    {confirmModal.title}
                  </h3>
                  <span className="text-[10px] text-amber-200/60 font-semibold uppercase tracking-wider">
                    Confirmation Required
                  </span>
                </div>
              </div>

              <button
                onClick={closeConfirmModal}
                className="p-1.5 rounded-xl bg-black/60 hover:bg-black text-slate-400 hover:text-white border border-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-amber-200/90 leading-relaxed font-semibold">
                {confirmModal.description}
              </p>

              <div className="p-3.5 rounded-2xl bg-[#120a05] border-2 border-black space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-[11px] uppercase tracking-wider">
                  <Info className="w-3.5 h-3.5" />
                  <span>Staging Note:</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {confirmModal.impactSummary}
                </p>
              </div>
            </div>

            <div className="p-4 border-t-2 border-black bg-[#20120a] flex items-center justify-end gap-3">
              <button
                onClick={closeConfirmModal}
                className="px-4 py-2 rounded-xl bg-black/60 hover:bg-black text-slate-300 text-xs font-bold border border-black transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={confirmModal.onConfirm}
                className={`px-5 py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 border-2 border-black cursor-pointer ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LAST SEASON RATING PROGRESSION MODAL */}
      {showProgressionModal && progressionAnalysis && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="rounded-3xl border-3 border-black bg-[#170e08] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden poster-shadow-lg border-amber-500/30">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b-2 border-black bg-[#20120a] flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-poster-title text-amber-400 flex items-center gap-2">
                    <Flame className="w-6 h-6 text-emerald-400" />
                    <span>Seasonal Rating Progression</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-black">
                    {progressionAnalysis.seasonName}
                  </span>
                </div>
                <p className="text-xs text-amber-200/70 font-semibold max-w-2xl leading-relaxed">
                  Organic progression engine integrating all matches across <span className="text-amber-300 font-bold">Group Stages, Knockout Brackets, and League Divisions</span>. High-tier ratings face natural diminishing growth returns and increased fragility on underperformance.
                </p>

                {/* Season Target Selector */}
                {(progressionAnalysis.availableSeasons || []).length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-amber-300/80 uppercase tracking-wider">
                      Evaluation Scope:
                    </span>
                    <select
                      value={selectedProgressionSeason}
                      onChange={(e) => handleSeasonChange(e.target.value)}
                      className="px-2.5 py-1 rounded-xl bg-black/80 border border-amber-500/40 text-amber-200 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                    >
                      {(progressionAnalysis.availableSeasons || []).map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} ({opt.matchCount} matches)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowProgressionModal(false)}
                className="p-2 rounded-xl bg-black/60 hover:bg-black text-slate-400 hover:text-white border border-black transition-colors shrink-0 self-end sm:self-start"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            {!progressionAnalysis.hasMatches ? (
              <div className="p-10 text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <History className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-white">No Match Records Found for Selected Scope</h3>
                  <p className="text-xs text-amber-200/70 max-w-md mx-auto leading-relaxed">
                    Play or simulate matches in the <span className="text-amber-300 font-bold">Group Stage, Knockouts, or League Divisions</span> to evaluate organic performance progression for your idols.
                  </p>
                </div>
                <button
                  onClick={() => setShowProgressionModal(false)}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* KPI Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 sm:p-5 bg-black/40 border-b border-black shrink-0">
                  <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block">
                        Risers (&uarr;)
                      </span>
                      <span className="text-xl font-mono font-black text-emerald-300">
                        {progressionAnalysis.risersCount} <span className="text-xs text-emerald-400/70 font-normal">idols</span>
                      </span>
                    </div>
                    <ChevronUp className="w-6 h-6 text-emerald-400" />
                  </div>

                  <div className="p-3 rounded-2xl bg-black/60 border border-black flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                        Maintained (=)
                      </span>
                      <span className="text-xl font-mono font-black text-slate-200">
                        {progressionAnalysis.steadyCount} <span className="text-xs text-slate-400 font-normal">idols</span>
                      </span>
                    </div>
                    <span className="text-lg font-black text-slate-500 font-mono">=</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-rose-400 block">
                        Fallers (&darr;)
                      </span>
                      <span className="text-xl font-mono font-black text-rose-300">
                        {progressionAnalysis.fallersCount} <span className="text-xs text-rose-400/70 font-normal">idols</span>
                      </span>
                    </div>
                    <ChevronDown className="w-6 h-6 text-rose-400" />
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block">
                        Net Shift Avg
                      </span>
                      <span className="text-xl font-mono font-black text-amber-300">
                        {progressionAnalysis.averageDelta > 0 ? `+${progressionAnalysis.averageDelta}` : progressionAnalysis.averageDelta} pts
                      </span>
                    </div>
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                </div>

                {/* Filter and Search Bar inside Modal */}
                <div className="p-4 border-b border-black flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#1c110a] shrink-0">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    {[
                      { key: 'all', label: `All (${(progressionAnalysis.items || []).length})` },
                      { key: 'risers', label: `Risers (${progressionAnalysis.risersCount})` },
                      { key: 'fallers', label: `Fallers (${progressionAnalysis.fallersCount})` },
                      { key: 'steady', label: `Steady (${progressionAnalysis.steadyCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setProgressionFilter(tab.key as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          progressionFilter === tab.key
                            ? 'bg-amber-400 text-black shadow-sm'
                            : 'bg-black/60 text-slate-400 hover:text-white border border-black'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-400/60" />
                    <input
                      type="text"
                      placeholder="Search idol or group..."
                      value={progressionSearch}
                      onChange={(e) => setProgressionSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-black/70 border border-black rounded-xl text-xs text-white placeholder-amber-200/40 focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold"
                    />
                  </div>
                </div>

                {/* Scrollable Idol Progression List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(progressionAnalysis.items || [])
                    .filter((item) => {
                      if (progressionFilter === 'risers' && item.delta <= 0) return false;
                      if (progressionFilter === 'fallers' && item.delta >= 0) return false;
                      if (progressionFilter === 'steady' && item.delta !== 0) return false;
                      if (progressionSearch) {
                        const q = progressionSearch.toLowerCase();
                        if (!item.idolName.toLowerCase().includes(q) && !item.girlGroup.toLowerCase().includes(q)) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((item) => {
                      const isUp = item.delta > 0;
                      const isDown = item.delta < 0;
                      const isExpanded = !!expandedReasons[item.idolId];
                      const perf = item.performance;

                      return (
                        <div
                          key={item.idolId}
                          className="p-3.5 rounded-2xl bg-black/60 border border-black hover:border-amber-500/40 transition-all flex flex-col gap-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-11 w-11 rounded-xl overflow-hidden bg-black border border-black shrink-0">
                                {item.photoUrl ? (
                                  <img
                                    src={item.photoUrl}
                                    alt={item.idolName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center font-bold text-amber-300 text-xs">
                                    {item.idolName.slice(0, 2)}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="font-extrabold text-sm text-white truncate">{item.idolName}</h4>
                                  {perf?.finishTitle && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1">
                                      <Trophy className="w-2.5 h-2.5" />
                                      {perf.finishTitle}
                                    </span>
                                  )}
                                  {perf?.isLeagueChampion && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black border border-blue-500/30">
                                      Division Champion
                                    </span>
                                  )}
                                  {perf?.isLeaguePodium && !perf?.isLeagueChampion && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                                      League Podium
                                    </span>
                                  )}
                                  {perf?.isChampionsQualifier && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-black border border-indigo-500/30">
                                      Champions Qualified
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-amber-200/70 font-semibold truncate">
                                  <span>{item.girlGroup}</span>
                                  <span>&bull;</span>
                                  <span>{item.seed || 'Unseeded'}</span>
                                  {perf && perf.matchesPlayed > 0 && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="text-amber-300 font-mono">
                                        Total: {perf.wins}W-{perf.losses}L{perf.draws ? `-${perf.draws}D` : ''} ({perf.winRate.toFixed(0)}%)
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/40">
                              {/* Rating transition */}
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-xs text-slate-400 font-bold">{item.previousRating}</span>
                                <span className="text-xs text-slate-500">&rarr;</span>
                                <span
                                  className={`text-base font-black ${
                                    isUp ? 'text-emerald-300' : isDown ? 'text-rose-300' : 'text-amber-300'
                                  }`}
                                >
                                  {item.newRating}
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono ml-1 ${
                                    isUp
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                      : isDown
                                      ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                      : 'bg-slate-900 text-slate-400 border border-slate-700'
                                  }`}
                                >
                                  {isUp ? `+${item.delta}` : item.delta}
                                </span>
                              </div>

                              {/* Tier Badge */}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${item.newTier.badgeBg}`}>
                                {item.newTier.tier}
                              </span>

                              {/* Expand Reasons Toggle */}
                              <button
                                onClick={() => toggleReasonExpand(item.idolId)}
                                className="p-1 rounded bg-black/40 text-amber-300/70 hover:text-white border border-black text-[10px] font-bold"
                                title="Show calculation details"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Match Stage Breakdown Badges */}
                          {perf && perf.matchesPlayed > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono border-t border-black/40">
                              {perf.groupMatches > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-500/30 text-amber-200">
                                  Group Stage: {perf.groupWins}W-{perf.groupLosses}L{perf.groupDraws ? `-${perf.groupDraws}D` : ''}
                                </span>
                              )}
                              {perf.knockoutMatches > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-950/50 border border-purple-500/30 text-purple-200">
                                  Knockouts: {perf.knockoutWins}W-{perf.knockoutLosses}L {perf.deepestKnockoutStage ? `(${perf.deepestKnockoutStage})` : ''}
                                </span>
                              )}
                              {perf.leagueMatches > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-950/50 border border-blue-500/30 text-blue-200">
                                  League (Div {perf.leagueDiv || 1}): {perf.leagueWins}W-{perf.leagueLosses}L{perf.leagueDraws ? `-${perf.leagueDraws}D` : ''} {perf.leagueRank ? `(Rank #${perf.leagueRank})` : ''}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Expandable Reasons Detail */}
                          {isExpanded && (
                            <div className="mt-1 p-2.5 rounded-xl bg-black/80 border border-amber-500/20 text-xs space-y-1 font-sans">
                              <span className="text-[10px] uppercase font-black tracking-wider text-amber-400 block mb-1">
                                Rating Calculation Factors:
                              </span>
                              {item.reasons.map((r, rIdx) => (
                                <div key={rIdx} className="flex items-start gap-1.5 text-slate-300 text-[11px]">
                                  <span className="text-amber-400 font-bold">&bull;</span>
                                  <span>{r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Modal Footer Actions */}
                <div className="p-4 sm:p-5 border-t-2 border-black bg-[#20120a] flex items-center justify-between gap-3 shrink-0">
                  <span className="text-xs text-amber-200/60 font-semibold hidden sm:inline">
                    Applying will update all {progressionAnalysis.items.length} idol ratings in your active roster.
                  </span>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => setShowProgressionModal(false)}
                      className="px-4 py-2 rounded-xl bg-black/60 hover:bg-black text-slate-300 text-xs font-bold border border-black transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={handleApplyProgression}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all shadow-lg active:scale-95"
                    >
                      <CheckCircle className="w-4 h-4 text-black" />
                      <span>Apply Season Progression</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
