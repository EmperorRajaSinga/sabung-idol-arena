import React, { useState, useMemo } from 'react';
import {
  Idol,
  SwissPlayInState,
  SwissMatch,
  SwissPoolId,
  TournamentConfig,
} from '../types';
import {
  SWISS_POOL_IDS,
  SWISS_POOL_NAMES,
  simulateSwissMatch,
  simulateSwissRound,
  simulateAllSwissMatches,
  simulateAllLastChanceMatches,
  simulateLastChanceMatchday,
  updateSwissMatchResult,
  resetSwissMatch,
  updateSwissMatchesBatch,
  resetLastChanceMatches,
} from '../utils/swissLogic';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { getCountryFlag } from '../utils/nationalityHelper';
import { MatchModal } from './MatchModal';
import { SwissLiveSimulatorModal } from './SwissLiveSimulatorModal';
import {
  Crown,
  Trophy,
  Swords,
  FastForward,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Layers,
  ChevronRight,
  Shield,
  Star,
  Tv,
  Gamepad2,
  Play,
  Zap,
  Shuffle,
  Flame,
  Radio,
  Table,
} from 'lucide-react';

interface SwissPlayInBracketProps {
  playIn: SwissPlayInState;
  idols: Idol[];
  isInteractive?: boolean;
  config?: TournamentConfig;
  favoriteIdolIds?: string[];
  onUpdateState: (newState: SwissPlayInState) => void;
  onReset: () => void;
  onRandomizeDraw?: () => void;
}

export const SwissPlayInBracket: React.FC<SwissPlayInBracketProps> = ({
  playIn,
  idols,
  isInteractive = true,
  config,
  favoriteIdolIds = [],
  onUpdateState,
  onReset,
  onRandomizeDraw,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | SwissPoolId | 'last_chance' | 'qualifiers'>('overview');
  const [activeLcGroupTab, setActiveLcGroupTab] = useState<'group_1' | 'group_2' | 'all'>('group_1');
  const [selectedLcMatchday, setSelectedLcMatchday] = useState<number>(1);
  const [showAllLcMatchdays, setShowAllLcMatchdays] = useState<boolean>(false);
  const [editingMatch, setEditingMatch] = useState<SwissMatch | null>(null);
  const [editScoreA, setEditScoreA] = useState<number>(2);
  const [editScoreB, setEditScoreB] = useState<number>(1);
  const [selectedMatchForModal, setSelectedMatchForModal] = useState<SwissMatch | null>(null);
  const [isLiveSimulcastOpen, setIsLiveSimulcastOpen] = useState<boolean>(false);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => i && map.set(i.id, i));
    return map;
  }, [idols]);

  const favoriteSet = useMemo(() => new Set(favoriteIdolIds), [favoriteIdolIds]);

  const totalMatches = (playIn.matches?.length || 0) + (playIn.lastChanceMatches?.length || 0);
  const completedMatches =
    (playIn.matches?.filter((m) => m.completed).length || 0) +
    (playIn.lastChanceMatches?.filter((m) => m.completed).length || 0);

  const isAllCompleted = totalMatches > 0 && completedMatches === totalMatches;

  const handleSimulateSingleMatch = (matchId: string) => {
    const updated = simulateSwissMatch(playIn, matchId, idols);
    onUpdateState(updated);
  };

  const handleSimulatePoolRound = (poolId: SwissPoolId, roundNum: number) => {
    const updated = simulateSwissRound(playIn, roundNum, idols, poolId);
    onUpdateState(updated);
  };

  const handleSimulateAll = () => {
    const updated = simulateAllSwissMatches(playIn, idols);
    onUpdateState(updated);
  };

  const handleSimulateLastChanceAll = () => {
    const updated = simulateAllLastChanceMatches(playIn, idols);
    onUpdateState(updated);
  };

  const handleSimulateLcMatchday = (md: number) => {
    const updated = simulateLastChanceMatchday(playIn, md, idols);
    onUpdateState(updated);
  };

  const handleResetLc = () => {
    const updated = resetLastChanceMatches(playIn);
    onUpdateState(updated);
  };

  const handleSaveScoreEdit = () => {
    if (!editingMatch) return;
    const updated = updateSwissMatchResult(playIn, editingMatch.id, editScoreA, editScoreB);
    onUpdateState(updated);
    setEditingMatch(null);
  };

  const handleCommitSimulcastMatches = (
    results: Array<{ matchId: string; scoreA: number; scoreB: number }>
  ) => {
    const updated = updateSwissMatchesBatch(playIn, results);
    onUpdateState(updated);
  };

  const getSwissFormHistory = (idolId?: string | null): Array<'W' | 'D' | 'L'> => {
    if (!idolId) return [];
    const allM = [...(playIn.matches || []), ...(playIn.lastChanceMatches || [])];
    const form: Array<'W' | 'D' | 'L'> = [];
    allM.forEach((m) => {
      if (m.completed && m.scoreA !== null && m.scoreB !== null) {
        if (m.idolAId === idolId) {
          if (m.scoreA > m.scoreB) form.push('W');
          else if (m.scoreA < m.scoreB) form.push('L');
          else form.push('D');
        } else if (m.idolBId === idolId) {
          if (m.scoreB > m.scoreA) form.push('W');
          else if (m.scoreB < m.scoreA) form.push('L');
          else form.push('D');
        }
      }
    });
    return form.slice(-5);
  };

  const modalIdolA = selectedMatchForModal?.idolAId ? idolsMap.get(selectedMatchForModal.idolAId) || null : null;
  const modalIdolB = selectedMatchForModal?.idolBId ? idolsMap.get(selectedMatchForModal.idolBId) || null : null;

  // Last Chance matches counts
  const g1Matches = useMemo(() => (playIn.lastChanceMatches || []).filter((m) => m.id.startsWith('lc_g1_')), [playIn.lastChanceMatches]);
  const g2Matches = useMemo(() => (playIn.lastChanceMatches || []).filter((m) => m.id.startsWith('lc_g2_')), [playIn.lastChanceMatches]);
  const g1CompletedCount = g1Matches.filter((m) => m.completed).length;
  const g2CompletedCount = g2Matches.filter((m) => m.completed).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-br from-[#24170e] via-[#1a110a] to-[#120c07] p-6 poster-shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-poster-title font-black uppercase tracking-wider">
                Grand Cup 64 Wildcard Stage
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                64 Contenders &bull; 4 Swiss Pools &bull; 28 Grand Cup Tickets
              </span>
              {isAllCompleted && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  All 28 Qualifiers Decided
                </span>
              )}
            </div>
            <h2 className="font-poster-title text-2xl sm:text-3xl text-amber-400 font-black tracking-wide flex items-center gap-2.5">
              <Layers className="w-7 h-7 text-amber-400" />
              <span>4 SWISS POOLS WILDCARD PLAY-IN</span>
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              64 idols (ranks 7th to 16th across 6 divisions + 4 top wildcards) are seeded into 4 cross-division Swiss pools of 16 idols.
              <strong> Top 5 in each pool advance directly (20 idols)</strong>, while the <strong>12 Round 5 decider winners (3 per pool)</strong> battle across 2 Last Chance Decider groups for the <strong>remaining 8 Grand Cup tickets (28 total qualifiers)</strong>.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsLiveSimulcastOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-poster-title text-xs font-black poster-shadow-sm transition-all border-2 border-black animate-pulse"
              title="Launch Live Multi-Pitch Simulcast with play-by-play broadcast and audio"
            >
              <Radio className="w-4 h-4 text-white" />
              <span>Live Multi-Simulcast</span>
            </button>

            {isInteractive && (
              <>
                {onRandomizeDraw && (
                  <button
                    onClick={onRandomizeDraw}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#22160e] hover:bg-[#322014] border-2 border-black text-amber-300 font-poster-title text-xs font-black poster-shadow-sm transition-all"
                    title="Randomize Round 1 Draw for all 4 Swiss Pools"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Random Draw (R1)</span>
                  </button>
                )}

                <button
                  onClick={handleSimulateAll}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-poster-title text-xs font-black shadow-lg transition-all border-2 border-black poster-shadow-sm hover:scale-105"
                  title="Simulate all 5 Swiss rounds across all 4 pools and the Last Chance Deciders"
                >
                  <FastForward className="w-4 h-4 text-black" />
                  <span>Simulate All Swiss Pools</span>
                </button>

                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-slate-700 text-slate-400 hover:text-rose-300 font-poster-title text-xs font-black transition-all"
                  title="Reset all Swiss match scores and redraw rounds"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Stage</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Metrics Ribbon */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-black/80">
          <div className="p-3 rounded-2xl bg-black/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contenders</span>
            <div className="font-poster-title text-xl text-white font-black">64 Idols</div>
            <span className="text-[9px] text-slate-500">16 Idols per Pool (4 Pools)</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Direct Quota</span>
            <div className="font-poster-title text-xl text-emerald-400 font-black">20 Tickets</div>
            <span className="text-[9px] text-emerald-500/80">Top 5 in each of 4 Pools</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Last Chance Deciders</span>
            <div className="font-poster-title text-xl text-amber-400 font-black">8 Tickets</div>
            <span className="text-[9px] text-amber-500/80">Top 4 in Group Alpha &amp; Beta</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/50 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grand Cup Qualifiers</span>
            <div className="font-poster-title text-xl text-yellow-300 font-black">
              {playIn.allQualifiers?.length || 0} / 28
            </div>
            <span className="text-[9px] text-yellow-500/80">
              {completedMatches} / {totalMatches} Matches Played
            </span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-poster-title text-xs font-black border-2 transition-all ${
              activeTab === 'overview'
                ? 'bg-amber-500 text-black border-black shadow-md'
                : 'bg-[#18110b] text-slate-400 border-black hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All 4 Pools Overview</span>
          </button>

          {SWISS_POOL_IDS.map((pId) => {
            const pool = playIn.pools?.[pId];
            const pMatches = playIn.matches?.filter((m) => m.poolId === pId) || [];
            const completedCount = pMatches.filter((m) => m.completed).length;
            const isDone = pool?.isCompleted;
            const qualsCount = pool?.directQualifierIds?.length || 0;
            return (
              <button
                key={pId}
                onClick={() => setActiveTab(pId)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-poster-title text-xs font-black border-2 transition-all ${
                  activeTab === pId
                    ? 'bg-amber-500 text-black border-black shadow-md'
                    : 'bg-[#18110b] text-slate-400 border-black hover:text-white'
                }`}
              >
                <span>{SWISS_POOL_NAMES[pId].replace('Swiss ', '')}</span>
                {isDone ? (
                  <span className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px] font-mono">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    <span>✓ Done</span>
                  </span>
                ) : qualsCount > 0 ? (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
                    {qualsCount}/5 Q
                  </span>
                ) : (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-black/60 text-slate-400 font-mono">
                    {completedCount} M
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setActiveTab('last_chance')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-poster-title text-xs font-black border-2 transition-all ${
              activeTab === 'last_chance'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black border-black shadow-md'
                : 'bg-[#18110b] text-slate-400 border-black hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Last Chance Deciders</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-bold">
              {playIn.lastChanceQualifiers?.length || 0}/8 Tickets
            </span>
          </button>

          <button
            onClick={() => setActiveTab('qualifiers')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-poster-title text-xs font-black border-2 transition-all ${
              activeTab === 'qualifiers'
                ? 'bg-amber-500 text-black border-black shadow-md'
                : 'bg-[#18110b] text-slate-400 border-black hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>All 28 Qualifiers</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono">
              {playIn.allQualifiers?.length || 0}/28
            </span>
          </button>
        </div>
      </div>

      {/* 3. Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SWISS_POOL_IDS.map((pId) => {
            const pool = playIn.pools?.[pId];
            const pMatches = playIn.matches?.filter((m) => m.poolId === pId) || [];
            const completedCount = pMatches.filter((m) => m.completed).length;

            return (
              <div
                key={pId}
                className="rounded-2xl border-2 border-black bg-[#160f0a] p-4 poster-shadow flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between border-b border-black pb-2.5">
                  <div>
                    <h3 className="font-poster-title text-base text-amber-400 font-bold">
                      {SWISS_POOL_NAMES[pId]}
                    </h3>
                    <span className="text-[10px] text-slate-400">16 Contenders &bull; Top 5 Advance &bull; 3 to Last Chance</span>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      pool?.isCompleted
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-950 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {completedCount}/33 Matches
                  </span>
                </div>

                {/* Standings Snippet */}
                <div className="space-y-1.5">
                  {(pool?.standings || []).slice(0, 9).map((p, idx) => {
                    const isQualified = idx < 5;
                    const isLastChance = idx >= 5 && idx <= 7;
                    const idol = idolsMap.get(p.idolId);

                    return (
                      <div
                        key={p.idolId}
                        className={`flex items-center justify-between p-1.5 rounded-xl border text-xs ${
                          isQualified
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-white'
                            : isLastChance
                            ? 'bg-amber-950/30 border-amber-500/30 text-white'
                            : 'bg-black/40 border-slate-800/80 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                              isQualified
                                ? 'bg-emerald-500 text-black'
                                : isLastChance
                                ? 'bg-amber-500 text-black'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-poster-title truncate font-bold text-slate-200">
                            {p.idolName}
                          </span>
                          {idol && <RatingBadge idol={idol} size="xs" showTier={false} />}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                          <span className="font-bold text-amber-400">
                            {p.swissWins}W - {p.swissLosses}L
                          </span>
                          <span className="text-slate-500 text-[9px]">
                            BH: {p.buchholzScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-black flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab(pId)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-xs font-poster-title font-bold transition-all"
                  >
                    <span>View Swiss Progression Board</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Single Pool View: Visual 16-Team Swiss Stage Progression Tree */}
      {SWISS_POOL_IDS.includes(activeTab as SwissPoolId) && (
        (() => {
          const currentPoolId = activeTab as SwissPoolId;
          const pool = playIn.pools?.[currentPoolId];
          const poolMatches = playIn.matches?.filter((m) => m.poolId === currentPoolId) || [];

          // Group pool matches by round
          const r1Matches = poolMatches.filter((m) => m.roundNumber === 1);
          const r2Matches = poolMatches.filter((m) => m.roundNumber === 2);
          const r2HighMatches = r2Matches.filter((m) => m.bracketType === 'high');
          const r2LowMatches = r2Matches.filter((m) => m.bracketType === 'low');

          const r3Matches = poolMatches.filter((m) => m.roundNumber === 3);
          const r3HighMatches = r3Matches.filter((m) => m.bracketType === 'high');
          const r3MidMatches = r3Matches.filter((m) => m.bracketType === 'mid');
          const r3LowMatches = r3Matches.filter((m) => m.bracketType === 'low');

          const r4Matches = poolMatches.filter((m) => m.roundNumber === 4);
          const r4HighMatches = r4Matches.filter((m) => m.bracketType === 'high');
          const r4LowMatches = r4Matches.filter((m) => m.bracketType === 'low');

          const r5Matches = poolMatches.filter((m) => m.roundNumber === 5);

          const standings = pool?.standings || [];
          const directQualifiersInPool = standings.filter((s) => s.status === 'qualified');
          const lastChanceInPool = standings.filter((s) => s.status === 'last_chance');
          const eliminatedInPool = standings.filter((s) => s.status === 'eliminated');

          const renderSwissCard = (m: SwissMatch) => {
            const idolA = m.idolAId ? idolsMap.get(m.idolAId) : null;
            const idolB = m.idolBId ? idolsMap.get(m.idolBId) : null;
            const isDone = m.completed && m.scoreA !== null && m.scoreB !== null;
            const aWon = isDone && m.winnerId === m.idolAId;
            const bWon = isDone && m.winnerId === m.idolBId;
            const isReady = !!m.idolAId && !!m.idolBId;
            const formA = getSwissFormHistory(m.idolAId);
            const formB = getSwissFormHistory(m.idolBId);

            return (
              <div
                key={m.id}
                className={`rounded-2xl border-2 transition-all p-2.5 space-y-2 poster-shadow-sm ${
                  isDone
                    ? 'bg-[#140e09] border-black/80'
                    : isReady
                    ? 'bg-[#1f150d] border-amber-500/40 ring-1 ring-amber-500/20'
                    : 'bg-[#100b07] border-black/40 opacity-60'
                }`}
              >
                {/* Match Header */}
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 border-b border-black/60 pb-1">
                  <span className="text-amber-400 truncate font-poster-title">{m.roundName || 'Match'}</span>
                  <span className="font-mono text-[8px] bg-black/60 px-1.5 py-0.2 rounded text-slate-300">BO3</span>
                </div>

                {/* Team / Idol A */}
                <div
                  onClick={() => isReady && setSelectedMatchForModal(m)}
                  className={`flex items-center justify-between p-1.5 rounded-xl border transition-colors cursor-pointer ${
                    aWon
                      ? 'ring-2 ring-lime-400 bg-lime-950/40 border-lime-500/60 text-lime-300 font-black shadow-[0_0_8px_rgba(163,230,53,0.25)]'
                      : 'bg-black/40 border-black/60 text-slate-300 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg overflow-hidden border border-black bg-black shrink-0 relative">
                      {idolA?.photoUrl ? (
                        <img src={idolA.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-amber-300">
                          {idolA?.name.slice(0, 2) || 'A'}
                        </div>
                      )}
                      {m.idolAId && favoriteSet.has(m.idolAId) && (
                        <Star className="w-2 h-2 fill-amber-400 text-black absolute top-0.2 right-0.2" />
                      )}
                    </div>
                    <div className="min-w-0 flex items-center gap-1">
                      <span className="font-poster-title text-[11px] truncate font-bold">
                        {idolA?.name || (isReady ? 'Contender' : 'TBD')}
                      </span>
                      {formA.length > 0 && (
                        <FormBadge formHistory={formA} size="xs" showStreak={false} showModifier={false} />
                      )}
                    </div>
                  </div>
                  <span className={`font-mono text-xs font-black px-1 ${aWon ? 'text-lime-300' : 'text-slate-400'}`}>
                    {isDone ? m.scoreA : '-'}
                  </span>
                </div>

                {/* Team / Idol B */}
                <div
                  onClick={() => isReady && setSelectedMatchForModal(m)}
                  className={`flex items-center justify-between p-1.5 rounded-xl border transition-colors cursor-pointer ${
                    bWon
                      ? 'ring-2 ring-lime-400 bg-lime-950/40 border-lime-500/60 text-lime-300 font-black shadow-[0_0_8px_rgba(163,230,53,0.25)]'
                      : 'bg-black/40 border-black/60 text-slate-300 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg overflow-hidden border border-black bg-black shrink-0 relative">
                      {idolB?.photoUrl ? (
                        <img src={idolB.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-amber-300">
                          {idolB?.name.slice(0, 2) || 'B'}
                        </div>
                      )}
                      {m.idolBId && favoriteSet.has(m.idolBId) && (
                        <Star className="w-2 h-2 fill-amber-400 text-black absolute top-0.2 right-0.2" />
                      )}
                    </div>
                    <div className="min-w-0 flex items-center gap-1">
                      <span className="font-poster-title text-[11px] truncate font-bold">
                        {idolB?.name || (isReady ? 'Contender' : 'TBD')}
                      </span>
                      {formB.length > 0 && (
                        <FormBadge formHistory={formB} size="xs" showStreak={false} showModifier={false} />
                      )}
                    </div>
                  </div>
                  <span className={`font-mono text-xs font-black px-1 ${bWon ? 'text-lime-300' : 'text-slate-400'}`}>
                    {isDone ? m.scoreB : '-'}
                  </span>
                </div>

                {/* Card Action Mini-Bar */}
                {isInteractive && isReady && (
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-black/40">
                    <button
                      onClick={() => setSelectedMatchForModal(m)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-[9px] font-black shadow-sm transition-all"
                    >
                      <Gamepad2 className="w-2.5 h-2.5" />
                      <span>{isDone ? 'Edit / Game' : 'Play / Modal'}</span>
                    </button>
                    {!isDone && (
                      <button
                        onClick={() => handleSimulateSingleMatch(m.id)}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 text-[9px] font-bold"
                        title="Simulate Match"
                      >
                        Sim
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingMatch(m);
                        setEditScoreA(m.scoreA ?? 2);
                        setEditScoreB(m.scoreB ?? 1);
                      }}
                      className="p-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 text-[9px]"
                      title="Quick Score Edit"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          };

          return (
            <div className="space-y-6">
              {/* Pool Header Bar */}
              <div className="rounded-2xl border-2 border-black bg-[#160f0a] p-4 poster-shadow flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-poster-title text-xl text-amber-400 font-black">
                      {SWISS_POOL_NAMES[currentPoolId].toUpperCase()}
                    </h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                      Top 5 Direct &bull; 3 to Last Chance
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    5 Swiss Rounds &bull; 3 Wins to Qualify (3-0 or 3-1) &bull; Round 5 Deciders feed 3-2 Winners to Last Chance &bull; 3 Losses = Eliminated
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((rn) => (
                    <button
                      key={rn}
                      onClick={() => handleSimulatePoolRound(currentPoolId, rn)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#22160e] hover:bg-[#322014] border border-black text-amber-300 font-poster-title text-[10px] font-black transition-all"
                    >
                      Sim R{rn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual 5-Column Swiss Progression Tree */}
              <div className="overflow-x-auto pb-4 custom-scrollbar">
                <div className="grid grid-cols-6 gap-3.5 min-w-[1200px]">
                  {/* ROUND 1 (8 Matches, All 0-0) */}
                  <div className="space-y-3">
                    <div className="p-2 rounded-xl bg-black/60 border border-black text-center">
                      <span className="font-poster-title text-xs text-amber-400 font-bold block">
                        ROUND 1
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">8 Matches (0-0 Record)</span>
                    </div>
                    <div className="space-y-2">
                      {r1Matches.map(renderSwissCard)}
                    </div>
                  </div>

                  {/* ROUND 2 (4 High [1-0], 4 Low [0-1]) */}
                  <div className="space-y-3">
                    <div className="p-2 rounded-xl bg-black/60 border border-black text-center">
                      <span className="font-poster-title text-xs text-amber-400 font-bold block">
                        ROUND 2
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">High (1-0) &amp; Low (0-1)</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <span className="text-[9px] font-poster-title text-emerald-400 font-bold uppercase tracking-wider block px-1">
                          1-0 Bracket (4 Matches)
                        </span>
                        {r2HighMatches.map(renderSwissCard)}
                      </div>
                      <div className="space-y-2 pt-2 border-t border-black">
                        <span className="text-[9px] font-poster-title text-rose-400 font-bold uppercase tracking-wider block px-1">
                          0-1 Bracket (4 Matches)
                        </span>
                        {r2LowMatches.map(renderSwissCard)}
                      </div>
                    </div>
                  </div>

                  {/* ROUND 3 (2 High [2-0], 4 Mid [1-1], 2 Low [0-2]) */}
                  <div className="space-y-3">
                    <div className="p-2 rounded-xl bg-black/60 border border-black text-center">
                      <span className="font-poster-title text-xs text-amber-400 font-bold block">
                        ROUND 3
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">First Qualifiers &amp; Eliminations</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <span className="text-[9px] font-poster-title text-emerald-300 font-bold uppercase tracking-wider block px-1">
                          2-0 Bracket &rarr; 3-0 Qualify
                        </span>
                        {r3HighMatches.map(renderSwissCard)}
                      </div>
                      <div className="space-y-2 pt-2 border-t border-black">
                        <span className="text-[9px] font-poster-title text-amber-300 font-bold uppercase tracking-wider block px-1">
                          1-1 Mid Bracket (4 Matches)
                        </span>
                        {r3MidMatches.map(renderSwissCard)}
                      </div>
                      <div className="space-y-2 pt-2 border-t border-black">
                        <span className="text-[9px] font-poster-title text-rose-400 font-bold uppercase tracking-wider block px-1">
                          0-2 Bracket &rarr; 0-3 Elim
                        </span>
                        {r3LowMatches.map(renderSwissCard)}
                      </div>
                    </div>
                  </div>

                  {/* ROUND 4 (3 High [2-1], 3 Low [1-2]) */}
                  <div className="space-y-3">
                    <div className="p-2 rounded-xl bg-black/60 border border-black text-center">
                      <span className="font-poster-title text-xs text-amber-400 font-bold block">
                        ROUND 4
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">2-1 (Qual) &amp; 1-2 (Elim)</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <span className="text-[9px] font-poster-title text-emerald-300 font-bold uppercase tracking-wider block px-1">
                          2-1 Bracket &rarr; 3-1 Qualify (3 Idols)
                        </span>
                        {r4HighMatches.map(renderSwissCard)}
                      </div>
                      <div className="space-y-2 pt-2 border-t border-black">
                        <span className="text-[9px] font-poster-title text-rose-400 font-bold uppercase tracking-wider block px-1">
                          1-2 Bracket &rarr; 1-3 Elim
                        </span>
                        {r4LowMatches.map(renderSwissCard)}
                      </div>
                    </div>
                  </div>

                  {/* ROUND 5 (3 Decider Matches: 2-2 vs 2-2) */}
                  <div className="space-y-3">
                    <div className="p-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-center">
                      <span className="font-poster-title text-xs text-amber-300 font-bold block">
                        ROUND 5 DECIDER
                      </span>
                      <span className="text-[9px] text-amber-400 font-mono">3 Winners &rarr; Last Chance</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] font-poster-title text-amber-400 font-bold uppercase tracking-wider block px-1">
                        2-2 Deciders (3 Matches)
                      </span>
                      {r5Matches.map(renderSwissCard)}
                    </div>
                  </div>

                  {/* POOL OUTCOMES SUMMARY COLUMN */}
                  <div className="space-y-3">
                    <div className="p-2 rounded-xl bg-black/80 border border-black text-center">
                      <span className="font-poster-title text-xs text-white font-bold block">
                        POOL OUTCOMES
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">5 Direct &bull; 3 Last Chance</span>
                    </div>

                    {/* DIRECT QUALIFIERS CARD (TOP 5) */}
                    <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-950/40 to-[#0e1811] p-3 poster-shadow-sm space-y-2">
                      <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1">
                        <div className="flex items-center gap-1.5">
                          <Crown className="w-3 h-3 text-emerald-400" />
                          <span className="font-poster-title text-[10px] text-emerald-300 font-black uppercase tracking-wider">
                            DIRECT QUAL (5)
                          </span>
                        </div>
                        <span className="text-[8px] font-mono font-bold text-emerald-400 bg-black/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          {directQualifiersInPool.length} / 5
                        </span>
                      </div>

                      <div className="space-y-1">
                        {directQualifiersInPool.map((p) => (
                          <div
                            key={p.idolId}
                            className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-emerald-500/30 justify-between"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-lg overflow-hidden border border-black bg-black shrink-0">
                                {p.photoUrl ? (
                                  <img src={p.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[7px] text-amber-300">
                                    {p.idolName.slice(0, 2)}
                                  </div>
                                )}
                              </div>
                              <span className="font-poster-title text-[9px] text-white font-bold truncate">
                                {p.idolName}
                              </span>
                            </div>
                            <span className="text-[7px] font-mono font-bold text-emerald-400 bg-emerald-950 px-1 py-0.2 rounded shrink-0">
                              {p.swissWins}-{p.swissLosses}
                            </span>
                          </div>
                        ))}
                        {directQualifiersInPool.length === 0 && (
                          <div className="text-[9px] text-slate-500 text-center py-2 italic">
                            In Progress
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LAST CHANCE CANDIDATES CARD (3 SPOTS) */}
                    <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-950/40 to-[#181108] p-3 poster-shadow-sm space-y-2">
                      <div className="flex items-center justify-between border-b border-amber-500/30 pb-1">
                        <div className="flex items-center gap-1.5">
                          <Swords className="w-3 h-3 text-amber-400" />
                          <span className="font-poster-title text-[10px] text-amber-300 font-black uppercase tracking-wider">
                            LAST CHANCE (3)
                          </span>
                        </div>
                        <span className="text-[8px] font-mono font-bold text-amber-400 bg-black/60 px-1.5 py-0.2 rounded border border-amber-500/30">
                          {lastChanceInPool.length} / 3
                        </span>
                      </div>

                      <div className="space-y-1">
                        {lastChanceInPool.map((p) => (
                          <div
                            key={p.idolId}
                            className="flex items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-amber-500/30 justify-between"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-lg overflow-hidden border border-black bg-black shrink-0">
                                {p.photoUrl ? (
                                  <img src={p.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[7px] text-amber-300">
                                    {p.idolName.slice(0, 2)}
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-poster-title text-[9px] text-amber-200 font-bold truncate block">
                                  {p.idolName}
                                </span>
                              </div>
                            </div>
                            <span className="text-[7px] font-black uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                              3-2 LC
                            </span>
                          </div>
                        ))}
                        {lastChanceInPool.length === 0 && (
                          <div className="text-[9px] text-slate-500 text-center py-2 italic">
                            Awaiting Round 5 Deciders
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pool Standings Table Drawer */}
              <div className="rounded-3xl border-2 border-black bg-[#160f0a] p-5 poster-shadow space-y-3">
                <div className="flex items-center justify-between border-b border-black pb-2.5">
                  <h4 className="font-poster-title text-base text-amber-400 font-bold">
                    {SWISS_POOL_NAMES[currentPoolId]} Comprehensive Table &amp; Tiebreakers
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Tiebreakers: Swiss Wins &rarr; Swiss Losses &rarr; Buchholz &rarr; Game Diff &rarr; League Points
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-black text-slate-500 text-[10px] uppercase font-bold">
                        <th className="py-2 pl-1">#</th>
                        <th className="py-2">Idol</th>
                        <th className="py-2 text-center">W-L</th>
                        <th className="py-2 text-center">Diff</th>
                        <th className="py-2 text-center">BH</th>
                        <th className="py-2 text-right pr-1">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/60">
                      {(pool?.standings || []).map((p, idx) => {
                        const isTop5 = idx < 5;
                        const isLastChance = idx >= 5 && idx <= 7;
                        const idol = idolsMap.get(p.idolId);

                        return (
                          <React.Fragment key={p.idolId}>
                            <tr
                              className={`hover:bg-amber-950/20 transition-colors ${
                                isTop5
                                  ? 'bg-emerald-950/20 text-white'
                                  : isLastChance
                                  ? 'bg-amber-950/20 text-white'
                                  : 'text-slate-400'
                              }`}
                            >
                              <td className="py-2.5 pl-1 font-mono font-bold">
                                <span
                                  className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black ${
                                    isTop5
                                      ? 'bg-emerald-500 text-black'
                                      : isLastChance
                                      ? 'bg-amber-500 text-black'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-black bg-black shrink-0">
                                    {p.photoUrl ? (
                                      <img
                                        src={p.photoUrl}
                                        alt={p.idolName}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center font-poster-title text-[9px] text-amber-300">
                                        {p.idolName.slice(0, 2)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-poster-title text-xs font-bold text-white truncate flex items-center gap-1">
                                      <span>{p.idolName}</span>
                                      {idol && <RatingBadge idol={idol} size="xs" showTier={false} />}
                                    </div>
                                    <div className="text-[9px] text-slate-400 truncate">
                                      {p.girlGroup} &bull; {p.leagueName} (R#{p.leagueRank})
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 text-center font-mono font-bold text-amber-400">
                                {p.swissWins}-{p.swissLosses}
                              </td>
                              <td className="py-2.5 text-center font-mono text-[11px] text-slate-300">
                                {p.swissGameDiff > 0 ? `+${p.swissGameDiff}` : p.swissGameDiff}
                              </td>
                              <td className="py-2.5 text-center font-mono text-[11px] text-slate-400">
                                {p.buchholzScore}
                              </td>
                              <td className="py-2.5 text-right pr-1">
                                {isTop5 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase">
                                    Top 5 (Direct Q)
                                  </span>
                                ) : isLastChance ? (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase">
                                    Last Chance (R6-8)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[9px] font-black uppercase">
                                    Eliminated
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Direct Cutoff Line after Rank 5 */}
                            {idx === 4 && (
                              <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                                <td colSpan={6} className="py-1 px-3 text-[9px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                                  ▲ DIRECT GRAND CUP 64 CUTOFF (Top 5 Advance Directly • 20 Total Swiss Tickets)
                                </td>
                              </tr>
                            )}

                            {/* Last Chance Cutoff Line after Rank 8 */}
                            {idx === 7 && (
                              <tr className="bg-amber-950/40 border-y-2 border-amber-500/60">
                                <td colSpan={6} className="py-1 px-3 text-[9px] font-poster-title font-bold text-amber-300 tracking-wider text-center">
                                  ▲ LAST CHANCE DECIDER CUTOFF (Ranks 6–8 Advance to Last Chance Round Robin)
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
          );
        })()
      )}

      {/* 5. Last Chance Deciders Tab: 12-Idol 2-Group Round Robin (Matching GroupStagePanel Design) */}
      {activeTab === 'last_chance' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#20140c] via-[#180f08] to-[#100a05] p-5 poster-shadow flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-poster-title font-black uppercase">
                  Final Postseason Deciders
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                  Top 4 in Each Group Advance to Grand Cup 64 (8 Total Tickets)
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-slate-700 text-slate-300 text-[10px] font-mono">
                  {g1CompletedCount + g2CompletedCount} / 30 Matches Completed
                </span>
              </div>
              <h3 className="font-poster-title text-xl text-amber-400 font-black tracking-wide flex items-center gap-2">
                <Swords className="w-5 h-5 text-amber-400" />
                <span>LAST CHANCE DECIDER ROUND ROBIN (12 CONTENDERS)</span>
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                12 Round 5 decider winners (3 from each Swiss pool) battle across 2 round-robin groups of 6 idols (Group Alpha &amp; Group Beta).
                The <strong>Top 4 in each group (8 total)</strong> claim the final wildcard tickets to the Grand Cup 64!
              </p>
            </div>

            {isInteractive && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsLiveSimulcastOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-poster-title text-xs font-black shadow transition-all border-2 border-black"
                >
                  <Radio className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>Simulcast Deciders</span>
                </button>

                <button
                  onClick={handleSimulateLastChanceAll}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-poster-title text-xs font-black shadow-lg transition-all border-2 border-black poster-shadow-sm hover:scale-105"
                >
                  <FastForward className="w-4 h-4 text-black" />
                  <span>Simulate All 30 Matches</span>
                </button>

                <button
                  onClick={handleResetLc}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950 border border-slate-700 text-slate-400 hover:text-rose-300 transition-all"
                  title="Reset Last Chance Matches"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Group Sub-Tabs (Group Alpha, Group Beta, All Groups) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setActiveLcGroupTab('group_1')}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-title font-black transition-all border-2 ${
                activeLcGroupTab === 'group_1'
                  ? 'bg-amber-500 text-black border-black shadow-md'
                  : 'bg-[#18110b] border-black text-slate-400 hover:text-white'
              }`}
            >
              <span>Group Alpha (Group 1)</span>
              {g1CompletedCount === 15 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/60 text-slate-300">
                  {g1CompletedCount}/15
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveLcGroupTab('group_2')}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-title font-black transition-all border-2 ${
                activeLcGroupTab === 'group_2'
                  ? 'bg-amber-500 text-black border-black shadow-md'
                  : 'bg-[#18110b] border-black text-slate-400 hover:text-white'
              }`}
            >
              <span>Group Beta (Group 2)</span>
              {g2CompletedCount === 15 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/60 text-slate-300">
                  {g2CompletedCount}/15
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveLcGroupTab('all')}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-title font-black transition-all border-2 ${
                activeLcGroupTab === 'all'
                  ? 'bg-amber-500 text-black border-black shadow-md'
                  : 'bg-[#18110b] border-black text-slate-400 hover:text-white'
              }`}
            >
              <span>Both Groups Combined</span>
            </button>
          </div>

          {/* Group Stage Panel Content (Grid with Standings Table + Match Schedule) */}
          <div className="space-y-6">
            {(activeLcGroupTab === 'group_1' || activeLcGroupTab === 'all') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Group Alpha Standings Card */}
                <div className="rounded-2xl border-2 border-black bg-[#160f0a] p-5 space-y-4 poster-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black pb-3 gap-1">
                    <div>
                      <h3 className="font-poster-title text-base text-amber-400 font-bold flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Group Alpha Standings (6 Idols)</span>
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Points: <span className="text-emerald-400 font-bold">3 PTS</span> for Win &bull; <span className="text-amber-300 font-bold">1 PT</span> for Draw &bull; <span className="text-slate-400">0 PTS</span> for Loss &bull; Game Diff Tiebreaker
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 font-poster-title font-black bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-500/40">
                      Top 4 Advance to Grand Cup
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-black text-slate-500 text-[10px] uppercase font-bold">
                          <th className="py-2 pl-2">#</th>
                          <th className="py-2">Participant</th>
                          <th className="py-2 text-center" title="Matches Played">P</th>
                          <th className="py-2 text-center text-emerald-400" title="Wins">W</th>
                          <th className="py-2 text-center text-amber-300" title="Draws">D</th>
                          <th className="py-2 text-center text-rose-400" title="Losses">L</th>
                          <th className="py-2 text-center">GF-GA</th>
                          <th className="py-2 text-center">GD</th>
                          <th className="py-2 text-center font-bold text-amber-400">PTS</th>
                          <th className="py-2 text-right pr-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/60 font-medium">
                        {(playIn.lastChanceGroup1Standings || []).map((p, idx) => {
                          const isTop4 = idx < 4;
                          const idol = idolsMap.get(p.idolId);
                          const played = p.lastChancePlayed ?? ((p.swissWins || 0) + (p.swissLosses || 0));
                          const won = p.lastChanceWon ?? p.swissWins ?? 0;
                          const drawn = p.lastChanceDrawn ?? 0;
                          const lost = p.lastChanceLost ?? p.swissLosses ?? 0;
                          const gf = p.lastChanceGF ?? p.swissGamesFor ?? 0;
                          const ga = p.lastChanceGA ?? p.swissGamesAgainst ?? 0;
                          const gd = p.lastChanceGD ?? (gf - ga);
                          const pts = p.lastChancePoints ?? (won * 3 + drawn);

                          return (
                            <React.Fragment key={p.idolId}>
                              <tr
                                className={`transition-colors ${
                                  isTop4 ? 'bg-emerald-950/20 text-white font-bold' : 'text-slate-400 hover:bg-black/40'
                                }`}
                              >
                                <td className="py-2 pl-2">
                                  <span
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                                      isTop4 ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg overflow-hidden border border-black bg-black shrink-0">
                                      {p.photoUrl ? (
                                        <img src={p.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center font-poster-title text-[8px] text-amber-300">
                                          {p.idolName.slice(0, 2)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="font-poster-title text-xs font-bold text-slate-100 truncate">
                                          {p.idolName}
                                        </span>
                                        {idol && <RatingBadge idol={idol} size="xs" showTier={false} />}
                                      </div>
                                      <span className="text-[9px] text-slate-400 truncate block">
                                        {p.girlGroup} &bull; {p.poolName}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 text-center font-mono text-slate-300">
                                  {played}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-emerald-400">
                                  {won}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-amber-300">
                                  {drawn}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-rose-400">
                                  {lost}
                                </td>
                                <td className="py-2 text-center font-mono text-[11px] text-slate-300">
                                  {gf}-{ga}
                                </td>
                                <td className="py-2 text-center font-mono text-[11px] font-bold text-slate-200">
                                  {gd > 0 ? `+${gd}` : gd}
                                </td>
                                <td className="py-2 text-center font-poster-title text-sm font-black text-amber-300">
                                  {pts}
                                </td>
                                <td className="py-2 text-right pr-2">
                                  {isTop4 ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase">
                                      Top 4 (Q)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[9px] font-black uppercase">
                                      Eliminated
                                    </span>
                                  )}
                                </td>
                              </tr>

                              {idx === 3 && (
                                <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                                  <td colSpan={10} className="py-1 px-3 text-[9px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                                    ▲ GRAND CUP 64 QUALIFICATION CUTOFF (Top 4 Advance to Grand Cup 64)
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

                {/* Group Alpha Match Schedule Card */}
                <div className="rounded-2xl border-2 border-black bg-[#160f0a] p-5 space-y-4 poster-shadow">
                  <div className="flex items-center justify-between border-b border-black pb-3">
                    <h3 className="font-poster-title text-base text-white font-bold">
                      Group Alpha Matches (15 Duels)
                    </h3>
                    <span className="text-xs text-slate-400 font-semibold">
                      Click match to open game modal
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g1Matches.map((m) => {
                      const idolA = m.idolAId ? idolsMap.get(m.idolAId) : null;
                      const idolB = m.idolBId ? idolsMap.get(m.idolBId) : null;
                      const isDone = m.completed && m.scoreA !== null && m.scoreB !== null;
                      const aWon = isDone && m.winnerId === m.idolAId;
                      const bWon = isDone && m.winnerId === m.idolBId;

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMatchForModal(m)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-black/60 hover:border-amber-500/50 hover:bg-black/90 cursor-pointer transition-all group"
                        >
                          {/* Idol A */}
                          <div className="flex items-center gap-2 w-2/5 min-w-0">
                            <div className="w-7 h-7 rounded-lg overflow-hidden border border-black bg-black shrink-0 relative">
                              {idolA?.photoUrl ? (
                                <img src={idolA.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-300">
                                  {idolA?.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1">
                                <span className={`font-poster-title text-xs truncate ${aWon ? 'text-lime-300 font-black' : 'text-slate-200'}`}>
                                  {idolA?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 truncate block">
                                {idolA?.girlGroup}
                              </span>
                            </div>
                          </div>

                          {/* Score / Status Pill */}
                          <div className="flex flex-col items-center justify-center w-1/5">
                            {isDone ? (
                              <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-amber-300 border border-slate-800 shadow-sm">
                                {m.scoreA} - {m.scoreB}
                              </span>
                            ) : (
                              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                                PLAY
                              </span>
                            )}
                          </div>

                          {/* Idol B */}
                          <div className="flex items-center justify-end gap-2 w-2/5 text-right min-w-0">
                            <div className="truncate">
                              <div className="flex items-center justify-end gap-1">
                                <span className={`font-poster-title text-xs truncate ${bWon ? 'text-lime-300 font-black' : 'text-slate-200'}`}>
                                  {idolB?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 truncate block">
                                {idolB?.girlGroup}
                              </span>
                            </div>
                            <div className="w-7 h-7 rounded-lg overflow-hidden border border-black bg-black shrink-0 relative">
                              {idolB?.photoUrl ? (
                                <img src={idolB.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-300">
                                  {idolB?.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {(activeLcGroupTab === 'group_2' || activeLcGroupTab === 'all') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Group Beta Standings Card */}
                <div className="rounded-2xl border-2 border-black bg-[#160f0a] p-5 space-y-4 poster-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-black pb-3 gap-1">
                    <div>
                      <h3 className="font-poster-title text-base text-amber-400 font-bold flex items-center gap-2">
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Group Beta Standings (6 Idols)</span>
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Points: <span className="text-emerald-400 font-bold">3 PTS</span> for Win &bull; <span className="text-amber-300 font-bold">1 PT</span> for Draw &bull; <span className="text-slate-400">0 PTS</span> for Loss &bull; Game Diff Tiebreaker
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400 font-poster-title font-black bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-500/40">
                      Top 4 Advance to Grand Cup
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-black text-slate-500 text-[10px] uppercase font-bold">
                          <th className="py-2 pl-2">#</th>
                          <th className="py-2">Participant</th>
                          <th className="py-2 text-center" title="Matches Played">P</th>
                          <th className="py-2 text-center text-emerald-400" title="Wins">W</th>
                          <th className="py-2 text-center text-amber-300" title="Draws">D</th>
                          <th className="py-2 text-center text-rose-400" title="Losses">L</th>
                          <th className="py-2 text-center">GF-GA</th>
                          <th className="py-2 text-center">GD</th>
                          <th className="py-2 text-center font-bold text-amber-400">PTS</th>
                          <th className="py-2 text-right pr-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/60 font-medium">
                        {(playIn.lastChanceGroup2Standings || []).map((p, idx) => {
                          const isTop4 = idx < 4;
                          const idol = idolsMap.get(p.idolId);
                          const played = p.lastChancePlayed ?? ((p.swissWins || 0) + (p.swissLosses || 0));
                          const won = p.lastChanceWon ?? p.swissWins ?? 0;
                          const drawn = p.lastChanceDrawn ?? 0;
                          const lost = p.lastChanceLost ?? p.swissLosses ?? 0;
                          const gf = p.lastChanceGF ?? p.swissGamesFor ?? 0;
                          const ga = p.lastChanceGA ?? p.swissGamesAgainst ?? 0;
                          const gd = p.lastChanceGD ?? (gf - ga);
                          const pts = p.lastChancePoints ?? (won * 3 + drawn);

                          return (
                            <React.Fragment key={p.idolId}>
                              <tr
                                className={`transition-colors ${
                                  isTop4 ? 'bg-emerald-950/20 text-white font-bold' : 'text-slate-400 hover:bg-black/40'
                                }`}
                              >
                                <td className="py-2 pl-2">
                                  <span
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                                      isTop4 ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg overflow-hidden border border-black bg-black shrink-0">
                                      {p.photoUrl ? (
                                        <img src={p.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center font-poster-title text-[8px] text-amber-300">
                                          {p.idolName.slice(0, 2)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="font-poster-title text-xs font-bold text-slate-100 truncate">
                                          {p.idolName}
                                        </span>
                                        {idol && <RatingBadge idol={idol} size="xs" showTier={false} />}
                                      </div>
                                      <span className="text-[9px] text-slate-400 truncate block">
                                        {p.girlGroup} &bull; {p.poolName}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2 text-center font-mono text-slate-300">
                                  {played}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-emerald-400">
                                  {won}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-amber-300">
                                  {drawn}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-rose-400">
                                  {lost}
                                </td>
                                <td className="py-2 text-center font-mono text-[11px] text-slate-300">
                                  {gf}-{ga}
                                </td>
                                <td className="py-2 text-center font-mono text-[11px] font-bold text-slate-200">
                                  {gd > 0 ? `+${gd}` : gd}
                                </td>
                                <td className="py-2 text-center font-poster-title text-sm font-black text-amber-300">
                                  {pts}
                                </td>
                                <td className="py-2 text-right pr-2">
                                  {isTop4 ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase">
                                      Top 4 (Q)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[9px] font-black uppercase">
                                      Eliminated
                                    </span>
                                  )}
                                </td>
                              </tr>

                              {idx === 3 && (
                                <tr className="bg-emerald-950/40 border-y-2 border-emerald-500/60">
                                  <td colSpan={10} className="py-1 px-3 text-[9px] font-poster-title font-bold text-emerald-300 tracking-wider text-center">
                                    ▲ GRAND CUP 64 QUALIFICATION CUTOFF (Top 4 Advance to Grand Cup 64)
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

                {/* Group Beta Match Schedule Card */}
                <div className="rounded-2xl border-2 border-black bg-[#160f0a] p-5 space-y-4 poster-shadow">
                  <div className="flex items-center justify-between border-b border-black pb-3">
                    <h3 className="font-poster-title text-base text-white font-bold">
                      Group Beta Matches (15 Duels)
                    </h3>
                    <span className="text-xs text-slate-400 font-semibold">
                      Click match to open game modal
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g2Matches.map((m) => {
                      const idolA = m.idolAId ? idolsMap.get(m.idolAId) : null;
                      const idolB = m.idolBId ? idolsMap.get(m.idolBId) : null;
                      const isDone = m.completed && m.scoreA !== null && m.scoreB !== null;
                      const aWon = isDone && m.winnerId === m.idolAId;
                      const bWon = isDone && m.winnerId === m.idolBId;

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedMatchForModal(m)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-black/60 hover:border-amber-500/50 hover:bg-black/90 cursor-pointer transition-all group"
                        >
                          {/* Idol A */}
                          <div className="flex items-center gap-2 w-2/5 min-w-0">
                            <div className="w-7 h-7 rounded-lg overflow-hidden border border-black bg-black shrink-0 relative">
                              {idolA?.photoUrl ? (
                                <img src={idolA.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-300">
                                  {idolA?.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-1">
                                <span className={`font-poster-title text-xs truncate ${aWon ? 'text-lime-300 font-black' : 'text-slate-200'}`}>
                                  {idolA?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 truncate block">
                                {idolA?.girlGroup}
                              </span>
                            </div>
                          </div>

                          {/* Score / Status Pill */}
                          <div className="flex flex-col items-center justify-center w-1/5">
                            {isDone ? (
                              <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-amber-300 border border-slate-800 shadow-sm">
                                {m.scoreA} - {m.scoreB}
                              </span>
                            ) : (
                              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-400 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                                PLAY
                              </span>
                            )}
                          </div>

                          {/* Idol B */}
                          <div className="flex items-center justify-end gap-2 w-2/5 text-right min-w-0">
                            <div className="truncate">
                              <div className="flex items-center justify-end gap-1">
                                <span className={`font-poster-title text-xs truncate ${bWon ? 'text-lime-300 font-black' : 'text-slate-200'}`}>
                                  {idolB?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 truncate block">
                                {idolB?.girlGroup}
                              </span>
                            </div>
                            <div className="w-7 h-7 rounded-lg overflow-hidden border border-black bg-black shrink-0 relative">
                              {idolB?.photoUrl ? (
                                <img src={idolB.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-300">
                                  {idolB?.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. All 28 Qualifiers Showcase Tab */}
      {activeTab === 'qualifiers' && (
        <div className="space-y-6">
          <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#22160d] via-[#1a110a] to-[#120c07] p-5 poster-shadow flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-poster-title font-black uppercase">
                Grand Cup 64 Wildcard Qualifiers
              </span>
              <h3 className="font-poster-title text-2xl text-amber-400 font-black tracking-wide flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-400" />
                <span>CONFIRMED 28 POSTSEASON QUALIFIERS</span>
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                20 Direct Qualifiers (Top 5 in each of the 4 Swiss Pools) + 8 Last Chance Qualifiers (Top 4 in Group Alpha &amp; Group Beta).
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-3xl font-black text-amber-300">
                {playIn.allQualifiers?.length || 0} / 28
              </span>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Tickets Awarded</span>
            </div>
          </div>

          {/* Section 1: 20 Direct Swiss Pool Qualifiers */}
          <div className="rounded-3xl border-2 border-black bg-[#160f0a] p-5 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-2.5">
              <h4 className="font-poster-title text-base text-emerald-400 font-bold flex items-center gap-2">
                <Crown className="w-4 h-4 text-emerald-400" />
                <span>20 DIRECT SWISS POOL QUALIFIERS (TOP 5 PER POOL)</span>
              </h4>
              <span className="text-[10px] font-mono text-emerald-400">
                {playIn.directQualifiers?.length || 0} / 20 Claimed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(playIn.directQualifiers || []).map((qId, idx) => {
                const idol = idolsMap.get(qId);
                const participant = playIn.participants?.find((p) => p.idolId === qId);

                return (
                  <div
                    key={qId}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-black/60 border border-emerald-500/40 poster-shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-black bg-black shrink-0 relative">
                      {idol?.photoUrl ? (
                        <img src={idol.photoUrl} alt={idol.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-poster-title text-xs font-black text-amber-300">
                          {idol?.name.slice(0, 2) || 'Q'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-poster-title text-xs text-white font-bold truncate">
                          {idol?.name || participant?.idolName}
                        </span>
                        {idol && <RatingBadge idol={idol} size="xs" showTier={false} />}
                      </div>
                      <div className="text-[9px] text-emerald-400/90 truncate font-mono">
                        {participant?.poolName} &bull; {participant?.swissWins}W-{participant?.swissLosses}L
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!playIn.directQualifiers || playIn.directQualifiers.length === 0) && (
                <div className="col-span-4 text-center py-4 text-slate-500 text-xs italic">
                  Awaiting completion of Swiss pool rounds
                </div>
              )}
            </div>
          </div>

          {/* Section 2: 8 Last Chance Round Robin Qualifiers */}
          <div className="rounded-3xl border-2 border-black bg-[#160f0a] p-5 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-2.5">
              <h4 className="font-poster-title text-base text-amber-400 font-bold flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-400" />
                <span>8 LAST CHANCE ROUND ROBIN QUALIFIERS (TOP 4 PER GROUP)</span>
              </h4>
              <span className="text-[10px] font-mono text-amber-400">
                {playIn.lastChanceQualifiers?.length || 0} / 8 Claimed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(playIn.lastChanceQualifiers || []).map((qId, idx) => {
                const idol = idolsMap.get(qId);
                const participant = playIn.lastChanceStandings?.find((p) => p.idolId === qId);

                return (
                  <div
                    key={qId}
                    className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-black/60 border border-amber-500/40 poster-shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-black bg-black shrink-0 relative">
                      {idol?.photoUrl ? (
                        <img src={idol.photoUrl} alt={idol.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-poster-title text-xs font-black text-amber-300">
                          {idol?.name.slice(0, 2) || 'Q'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-poster-title text-xs text-white font-bold truncate">
                          {idol?.name || participant?.idolName}
                        </span>
                        {idol && <RatingBadge idol={idol} size="xs" showTier={false} />}
                      </div>
                      <div className="text-[9px] text-amber-400/90 truncate font-mono">
                        Last Chance &bull; {participant?.swissWins}W-{participant?.swissLosses}L
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!playIn.lastChanceQualifiers || playIn.lastChanceQualifiers.length === 0) && (
                <div className="col-span-4 text-center py-4 text-slate-500 text-xs italic">
                  Awaiting completion of Last Chance Deciders Round Robin
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick Score Edit Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border-2 border-black bg-[#1c120a] p-6 poster-shadow-lg space-y-4">
            <h3 className="font-poster-title text-lg text-amber-400 font-black">
              Edit Match Score (BO3)
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-poster-title text-sm text-slate-200">
                  {editingMatch.idolAId ? idolsMap.get(editingMatch.idolAId)?.name : 'Idol A'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={2}
                  value={editScoreA}
                  onChange={(e) => setEditScoreA(Number(e.target.value))}
                  className="w-16 p-2 rounded-xl bg-black border border-slate-700 text-center font-mono font-bold text-white"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-poster-title text-sm text-slate-200">
                  {editingMatch.idolBId ? idolsMap.get(editingMatch.idolBId)?.name : 'Idol B'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={2}
                  value={editScoreB}
                  onChange={(e) => setEditScoreB(Number(e.target.value))}
                  className="w-16 p-2 rounded-xl bg-black border border-slate-700 text-center font-mono font-bold text-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-black">
              <button
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScoreEdit}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-poster-title font-black"
              >
                Save Result
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Live Multi-Simulcast Broadcast Modal */}
      {isLiveSimulcastOpen && (
        <SwissLiveSimulatorModal
          isOpen={isLiveSimulcastOpen}
          onClose={() => setIsLiveSimulcastOpen(false)}
          matches={playIn.matches || []}
          lastChanceMatches={playIn.lastChanceMatches || []}
          participants={playIn.participants || []}
          idolsMap={idolsMap}
          onCommitMatches={handleCommitSimulcastMatches}
        />
      )}

      {/* 9. Match Interactive Game Modal */}
      {selectedMatchForModal && modalIdolA && modalIdolB && (
        <MatchModal
          isOpen={!!selectedMatchForModal}
          onClose={() => setSelectedMatchForModal(null)}
          idolA={modalIdolA}
          idolB={modalIdolB}
          matchTitle={selectedMatchForModal.matchTitle || `Round ${selectedMatchForModal.roundNumber}`}
          stageName={selectedMatchForModal.isLastChance ? `Last Chance Decider (${selectedMatchForModal.poolName})` : `Swiss Play-In (${selectedMatchForModal.poolName})`}
          isKnockout={false}
          isCompleted={selectedMatchForModal.completed}
          currentScoreA={selectedMatchForModal.scoreA ?? null}
          currentScoreB={selectedMatchForModal.scoreB ?? null}
          formHistoryA={getSwissFormHistory(selectedMatchForModal.idolAId)}
          formHistoryB={getSwissFormHistory(selectedMatchForModal.idolBId)}
          favoriteIdolIds={favoriteIdolIds}
          onFinish={(scoreA, scoreB) => {
            const updated = updateSwissMatchResult(playIn, selectedMatchForModal.id, scoreA, scoreB);
            onUpdateState(updated);
            setSelectedMatchForModal(null);
          }}
          onResetMatch={() => {
            const updated = resetSwissMatch(playIn, selectedMatchForModal.id);
            onUpdateState(updated);
            setSelectedMatchForModal(null);
          }}
        />
      )}
    </div>
  );
};
