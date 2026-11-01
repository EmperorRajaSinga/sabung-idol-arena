import React, { useEffect, useMemo, useState } from 'react';
import type { Idol, LeagueSeasonState, KnockoutMatch, TournamentConfig } from '../types';
import { saveV5State, V5State } from '../utils/v5/store';
import { loadNames, type CompetitionNames } from '../utils/v5/names';
import * as E from '../utils/v5/engine';
import { rankStandings } from '../utils/swissLogic';
import { getIdolRating } from '../utils/ratingHelper';
import { TournamentBracketTree } from './TournamentBracketTree';
import { MatchModal } from './MatchModal';
import { ManualBracketModal } from './ManualBracketModal';
import { KnockoutLiveSimulatorModal } from './KnockoutLiveSimulatorModal';

interface Props {
  idols: Idol[]; leagueState: LeagueSeasonState | null; section: 'crown' | 'super' | 'open' | 'spotlight';
  v5State: V5State; onUpdateV5State: (s: V5State) => void;
  theIdolsChampionId: string | null; knockoutMatches: KnockoutMatch[];
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const createEmptySuperFinal = (id: string, label: string, idolAId: string | null = null, idolBId: string | null = null): E.BNode => ({
  id, roundName: 'Super Cup', bestOf: 5,
  a: { id: idolAId || '' }, b: { id: idolBId || '' },
  idolAId, idolBId, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false,
});
const toSuperKnockoutMatches = (matches: E.BNode[]): KnockoutMatch[] => matches.map((m, index) => ({
  id: m.id, roundIndex: 0, roundName: 'Super Cup', matchNumber: index + 1,
  bestOf: m.bestOf, idolAId: m.idolAId || null, idolBId: m.idolBId || null,
  scoreA: m.scoreA, scoreB: m.scoreB, winnerId: m.winnerId, completed: m.completed,
}));
const createEmptyLeagueCup = (d1Count: number, d2Count: number): E.LeagueCupState => {
  const state = E.createLeagueCup(Array.from({ length: d1Count + d2Count }, () => ''), {}, d2Count);
  if (state.plan.rounds > 0) E.stepLeagueCup(state);
  return state;
};
const createEmptyMiniCup = (leagueId: number): E.BNode[] => E.buildMiniCup(leagueId, Array.from({ length: 16 }, () => ''));
const toMiniKnockoutMatches = (matches: E.BNode[]): KnockoutMatch[] => {
  const rounds = [...new Set(matches.map((match) => match.roundName))];
  const feedsTo = (id: string, slot: E.Slot) => ('win' in slot && slot.win === id) || ('lose' in slot && slot.lose === id);
  return matches.map((match, index) => {
    const a = matches.find((target) => feedsTo(match.id, target.a));
    const b = matches.find((target) => feedsTo(match.id, target.b));
    return { id: match.id, roundIndex: rounds.indexOf(match.roundName), roundName: match.roundName, matchNumber: index + 1,
      idolAId: match.idolAId || null, idolBId: match.idolBId || null, scoreA: match.scoreA, scoreB: match.scoreB,
      winnerId: match.winnerId, completed: match.completed, feedsIntoMatchId: a?.id || b?.id,
      feedsIntoSlot: a ? 'A' : b ? 'B' : undefined, bestOf: match.bestOf };
  });
};
const toOpenArenaKnockoutMatches = (rounds: E.BNode[][]): KnockoutMatch[] => {
  const matches = rounds.flat();
  return matches.map((match, index) => {
    const feedsTo = (id: string, slot: E.Slot) => ('win' in slot && slot.win === id) || ('lose' in slot && slot.lose === id);
    const target = matches.find((candidate) => feedsTo(match.id, candidate.a) || feedsTo(match.id, candidate.b));
    return { id: match.id, roundIndex: rounds.findIndex((round) => round.some((item) => item.id === match.id)),
      roundName: match.roundName, matchNumber: index + 1, idolAId: match.idolAId || null, idolBId: match.idolBId || null,
      scoreA: match.scoreA, scoreB: match.scoreB, winnerId: match.winnerId, completed: match.completed,
      feedsIntoMatchId: target?.id, feedsIntoSlot: target ? (feedsTo(match.id, target.a) ? 'A' : 'B') : undefined, bestOf: match.bestOf };
  });
};



const CROWN_ROUND_ORDER = ['Upper Round 1', 'Upper Semi Final', 'Upper Final', 'Lower Round 1', 'Lower Final', 'Grand Final'];
const createEmptyCrownCup = (): { matches: E.BNode[]; byeIds: string[]; seedOrder: string[] } => {
  const S = (id: string): E.Slot => ({ id });
  const W = (id: string): E.Slot => ({ win: id });
  const L = (id: string): E.Slot => ({ lose: id });
  const matches: E.BNode[] = [
    { id: 'cc_ur1_a', roundName: 'Upper Round 1', bestOf: 5, a: S(''), b: S(''), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_ur1_b', roundName: 'Upper Round 1', bestOf: 5, a: S(''), b: S(''), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_usf_a', roundName: 'Upper Semi Final', bestOf: 5, a: S(''), b: W('cc_ur1_a'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_usf_b', roundName: 'Upper Semi Final', bestOf: 5, a: S(''), b: W('cc_ur1_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_uf', roundName: 'Upper Final', bestOf: 5, a: W('cc_usf_a'), b: W('cc_usf_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_lr1', roundName: 'Lower Round 1', bestOf: 5, a: L('cc_usf_a'), b: L('cc_usf_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_lf', roundName: 'Lower Final', bestOf: 7, a: W('cc_lr1'), b: L('cc_uf'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_gf', roundName: 'Grand Final', bestOf: 7, a: W('cc_uf'), b: W('cc_lf'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
  ];
  E.advanceBracket(matches);
  return { matches, byeIds: [], seedOrder: [] };
};
const toCrownKnockoutMatches = (matches: E.BNode[]): KnockoutMatch[] => {
  const feedsTo = (sourceId: string, slot: E.Slot) => ('win' in slot && slot.win === sourceId) || ('lose' in slot && slot.lose === sourceId);
  return matches.map((m, index) => {
    const target = matches.find((candidate) => feedsTo(m.id, candidate.a) || feedsTo(m.id, candidate.b));
    const targetSlot = target ? (feedsTo(m.id, target.a) ? 'A' : 'B') : undefined;
    return {
      id: m.id, roundIndex: CROWN_ROUND_ORDER.indexOf(m.roundName), roundName: m.roundName,
      matchNumber: index + 1, idolAId: m.idolAId || null, idolBId: m.idolBId || null,
      scoreA: m.scoreA, scoreB: m.scoreB, winnerId: m.winnerId, completed: m.completed,
      feedsIntoMatchId: target?.id, feedsIntoSlot: targetSlot, bestOf: m.bestOf,
    };
  });
};
const getCrownManualMatches = (matches: E.BNode[]): KnockoutMatch[] => {
  const opening = matches.filter((m) => m.roundName === 'Upper Round 1');
  const byId = new Map(matches.map((m) => [m.id, m]));
  const openingMatches: KnockoutMatch[] = opening.map((m, index) => ({
    id: m.id, roundIndex: 0, roundName: m.roundName, matchNumber: index + 1,
    idolAId: m.idolAId || null, idolBId: m.idolBId || null,
    scoreA: m.scoreA, scoreB: m.scoreB, winnerId: m.winnerId, completed: m.completed, bestOf: m.bestOf,
  }));
  const byeMatches: KnockoutMatch[] = ['cc_usf_a', 'cc_usf_b'].map((id, index) => {
    const match = byId.get(id)!;
    const byeId = 'id' in match.a ? match.a.id : '';
    return {
      id: index === 0 ? 'cc_manual_bye_a' : 'cc_manual_bye_b',
      roundIndex: 1, roundName: 'Upper Bracket Bye', matchNumber: index + 3,
      idolAId: byeId || null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, completed: false,
    };
  });
  return [...openingMatches, ...byeMatches];
};

const Card: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="rounded-2xl border-2 border-black bg-[#20120a] p-4 mb-4 poster-shadow-lg">
    <h2 className="text-lg font-black text-amber-300 tracking-wide">{title}</h2>
    {note && <p className="text-xs text-amber-100/60 mb-3">{note}</p>}
    {children}
  </section>
);
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...p }) => (
  <button {...p} className={`rounded-xl border-2 border-black bg-amber-500 px-3 py-1.5 text-xs font-black text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed ${className}`} />
);

const Row: React.FC<{ m: E.BNode; idols: Map<string, Idol>; nm: (id: string | null) => string; onSim: () => void; onSave: (a: number, b: number) => string | null }> = ({ m, idols, nm, onSim, onSave }) => {
  const [a, setA] = useState(''), [b, setB] = useState(''), [err, setErr] = useState('');
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const idolA = m.idolAId ? idols.get(m.idolAId) : null;
  const idolB = m.idolBId ? idols.get(m.idolBId) : null;
  const ready = !!idolA && !!idolB;
  const targetWins = m.bestOf === 7 ? 4 : 3;
  const renderCompetitor = (idol: Idol | null, id: string | null, score: number | null, isWinner: boolean) => (
    <div role={ready ? 'button' : undefined} tabIndex={ready ? 0 : undefined} onClick={() => ready && setScoreModalOpen(true)} onKeyDown={(event) => { if (ready && (event.key === 'Enter' || event.key === ' ')) setScoreModalOpen(true); }} className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 transition-all ${
      isWinner
        ? 'border-lime-500/60 bg-lime-950/40 text-lime-200 shadow-[0_0_10px_rgba(163,230,53,0.16)]'
        : 'border-black/60 bg-black/35 text-amber-100'
    }`}>
      <div className="flex min-w-0 items-center gap-3">
        {idol?.photoUrl ? (
          <img src={idol.photoUrl} alt={idol.name} referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-xl border-2 border-black object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-[#2a1b11] font-poster-title text-sm text-amber-300">
            {idol?.name?.slice(0, 2).toUpperCase() || 'TBD'}
          </div>
        )}
        <div className="min-w-0">
          <div className={`truncate text-sm font-black ${isWinner ? 'text-lime-300' : 'text-amber-100'}`}>{idol?.name || nm(id)}</div>
          <div className="mt-0.5 truncate text-[11px] font-bold text-amber-200/55">{idol ? `${idol.girlGroup || 'Solo / Independent'} · R${getIdolRating(idol)}` : 'Awaiting qualification'}</div>
        </div>
      </div>
      <span className={`min-w-9 rounded-lg bg-black/45 px-2 py-1 text-center font-mono text-lg font-black ${isWinner ? 'text-lime-300' : 'text-amber-300'}`}>{score ?? '-'}</span>
    </div>
  );

  return (
    <div className={`relative w-[320px] shrink-0 rounded-2xl border-2 p-4 shadow-xl transition-all sm:w-[340px] ${
      m.completed
        ? 'border-emerald-800/70 bg-slate-900'
        : ready
          ? 'border-indigo-500/50 bg-slate-900 hover:border-indigo-400'
          : 'border-slate-800 bg-slate-950'
    }`}>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-700 pb-2">
        <span className="truncate text-xs font-black uppercase tracking-wider text-indigo-300">{m.roundName}</span>
        <span className="shrink-0 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-black text-slate-300">BO{m.bestOf} · FT {targetWins}</span>
      </div>
      <div className="space-y-2.5">
        {renderCompetitor(idolA, m.idolAId, m.scoreA, !!m.completed && m.winnerId === m.idolAId)}
        {renderCompetitor(idolB, m.idolBId, m.scoreB, !!m.completed && m.winnerId === m.idolBId)}
      </div>
      {m.completed ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-800/70 bg-emerald-950/35 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-300">
          <span>Match complete</span><span className="truncate text-right">{nm(m.winnerId)} advances</span>
        </div>
      ) : ready ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/70 pt-3">
          <Btn onClick={onSim} className="border-slate-700 bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-500">Simulate</Btn>
          <label className="flex items-center gap-1 rounded-lg border border-black bg-black/35 px-2 py-1">
            <span className="text-[9px] font-black text-amber-200/60">A</span>
            <input value={a} onChange={(e) => setA(e.target.value)} className="w-9 bg-transparent text-center font-mono text-sm font-black text-white outline-none" inputMode="numeric" aria-label="Score A" placeholder="-" />
          </label>
          <label className="flex items-center gap-1 rounded-lg border border-black bg-black/35 px-2 py-1">
            <span className="text-[9px] font-black text-amber-200/60">B</span>
            <input value={b} onChange={(e) => setB(e.target.value)} className="w-9 bg-transparent text-center font-mono text-sm font-black text-white outline-none" inputMode="numeric" aria-label="Score B" placeholder="-" />
          </label>
          <Btn onClick={() => { const result = onSave(Number(a), Number(b)); setErr(result || ''); }} className="ml-auto border-slate-700 bg-slate-700 px-4 py-2 text-xs text-white hover:bg-slate-600">Save Result</Btn>
          {err && <span className="w-full text-[11px] font-bold text-rose-400">{err}</span>}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-black/70 bg-black/25 px-3 py-2 text-[11px] font-bold italic text-slate-500">Waiting for previous round</div>
      )}
      {ready && <MatchModal isOpen={scoreModalOpen} onClose={() => setScoreModalOpen(false)} idolA={idolA} idolB={idolB} currentScoreA={m.scoreA} currentScoreB={m.scoreB} matchTitle={m.roundName} stageName={m.roundName} isKnockout isGrandFinal={/grand final/i.test(m.roundName)} bestOf={m.bestOf} isCompleted={m.completed} onFinish={(scoreA, scoreB) => { const result = onSave(scoreA, scoreB); if (result) setErr(result); else setScoreModalOpen(false); }} />}
    </div>
  );
};
const Bracket: React.FC<{ ms: E.BNode[]; idols: Map<string, Idol>; nm: (id: string | null) => string; sim: (ms: E.BNode[], id: string) => void; save: (ms: E.BNode[], id: string, a: number, b: number) => string | null; onChange: (ms: E.BNode[]) => void }> = ({ ms, idols, nm, sim, save, onChange }) => {
  const [selectedMatch, setSelectedMatch] = useState<E.BNode | null>(null);
  const roundNames = Array.from(new Set(ms.map((m) => m.roundName)));
  const roundIndex = new Map(roundNames.map((name, index) => [name, index]));
  const feedsTo = (sourceId: string, slot: E.Slot) => ('win' in slot && slot.win === sourceId) || ('lose' in slot && slot.lose === sourceId);
  const knockoutMatches: KnockoutMatch[] = ms.map((m, index) => {
    const targetA = ms.find((target) => feedsTo(m.id, target.a));
    const targetB = ms.find((target) => feedsTo(m.id, target.b));
    return { id: m.id, roundIndex: roundIndex.get(m.roundName) ?? 0, roundName: m.roundName, matchNumber: index + 1,
      idolAId: m.idolAId, idolBId: m.idolBId, scoreA: m.scoreA, scoreB: m.scoreB, winnerId: m.winnerId,
      completed: m.completed, feedsIntoMatchId: targetA?.id || targetB?.id, feedsIntoSlot: targetA ? 'A' : targetB ? 'B' : undefined };
  });
  const handleSelect = (match: KnockoutMatch) => {
    const current = ms.find((m) => m.id === match.id);
    if (current?.idolAId && current?.idolBId) setSelectedMatch(current);
  };
  return <div className="w-full min-w-0 rounded-2xl border-2 border-black/80 bg-[#100b08] p-3 shadow-inner sm:p-4">
    <p className="mb-3 text-[11px] text-amber-100/50">Click a match card to enter or edit its score. Connector lines show the path from each round to the next.</p>
    <TournamentBracketTree knockoutMatches={knockoutMatches} idolsMap={idols} onSelectMatch={handleSelect} showTitleHeader={false} />
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-amber-900/50 pt-3">
      <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-amber-300/70">Quick simulate</span>
      {ms.filter((m) => !m.completed && m.idolAId && m.idolBId).map((m) => <Btn key={m.id} onClick={() => { const next = clone(ms); sim(next, m.id); onChange(next); }}>{m.roundName} #{m.id.slice(-2)}</Btn>)}
    </div>
    {selectedMatch && <MatchModal isOpen onClose={() => setSelectedMatch(null)} idolA={selectedMatch.idolAId ? idols.get(selectedMatch.idolAId) || null : null} idolB={selectedMatch.idolBId ? idols.get(selectedMatch.idolBId) || null : null} currentScoreA={selectedMatch.scoreA} currentScoreB={selectedMatch.scoreB} matchTitle={selectedMatch.roundName} stageName="Cup Competition" isKnockout isCompleted={selectedMatch.completed} onFinish={(a, b) => { const next = clone(ms); const error = save(next, selectedMatch.id, a, b); if (error) { window.alert(error); return; } onChange(next); setSelectedMatch(null); }} />}
  </div>;
};

const OpenArenaMatchList: React.FC<{ matches: E.BNode[]; idols: Map<string, Idol>; nm: (id: string | null) => string; onSave: (id: string, a: number, b: number) => string | null }> = ({ matches, idols, nm, onSave }) => {
  const [selectedMatch, setSelectedMatch] = useState<E.BNode | null>(null);
  const [error, setError] = useState('');
  const rounds = Array.from(new Set(matches.map((m) => m.roundName)));
  const [activeRound, setActiveRound] = useState(rounds[0] || '');
  React.useEffect(() => { if (!rounds.includes(activeRound)) setActiveRound(rounds[0] || ''); }, [matches, activeRound]);
  const current = matches.filter((m) => m.roundName === activeRound);
  const completed = current.filter((m) => m.completed).length;
  const competitor = (id: string | null, score: number | null, winner: boolean, side: 'left' | 'right') => {
    const idol = id ? idols.get(id) : null;
    return <div className={`flex min-w-0 flex-1 items-center gap-2 ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {idol?.photoUrl ? <img src={idol.photoUrl} alt={idol.name} referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-xl border-2 border-black object-cover sm:h-11 sm:w-11" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-[#2a1b11] text-xs font-black text-amber-300 sm:h-11 sm:w-11">{idol?.name?.slice(0,2).toUpperCase() || 'TBD'}</div>}
      <div className="min-w-0"><div className={`truncate text-xs font-black sm:text-sm ${winner ? 'text-amber-200' : 'text-amber-100'}`}>{idol?.name || nm(id)}</div><div className="truncate text-[10px] font-bold text-amber-200/45">{idol ? idol.girlGroup : 'Awaiting qualification'}</div></div>
    </div>;
  };
  return <div className="mt-3">
    <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-black/80 bg-black/25 p-2">
      {rounds.map((round, i) => { const list = matches.filter((m) => m.roundName === round); const done = list.filter((m) => m.completed).length; const active = activeRound === round; return <button key={round} type="button" onClick={() => setActiveRound(round)} className={`min-w-[110px] flex-1 rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-amber-400 bg-amber-500/15 text-amber-200' : 'border-black bg-[#17100a] text-amber-100/55 hover:border-amber-800'}`}><span className="block text-[10px] font-black uppercase tracking-wider">Round {i + 1}</span><span className="mt-0.5 block truncate text-xs font-black">{round}</span><span className="mt-0.5 block text-[10px] font-mono">{done}/{list.length} completed</span></button>; })}
    </div>
    <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider text-amber-300">{activeRound}</h3><span className="text-[10px] font-mono font-bold text-amber-100/50">{completed}/{current.length} matches completed</span></div>
    <div className="space-y-2">
      {current.map((m) => <button key={m.id} type="button" onClick={() => { if (m.idolAId && m.idolBId) { setSelectedMatch(m); setError(''); } }} className={`flex w-full min-w-0 items-center gap-2 rounded-2xl border-2 px-2.5 py-3 text-left transition-colors sm:gap-3 sm:px-4 ${m.completed ? 'border-black bg-[#130d09]' : 'border-amber-900/70 bg-[#1b110a] hover:border-amber-600'}`}>
        {competitor(m.idolAId, m.scoreA, m.completed && m.winnerId === m.idolAId, 'left')}
        <span className="flex h-9 min-w-[58px] shrink-0 items-center justify-center rounded-xl border-2 border-black bg-black/60 px-2 font-mono text-sm font-black tracking-wider text-amber-300 sm:min-w-[66px] sm:text-base">{m.completed ? `${m.scoreA} - ${m.scoreB}` : 'VS'}</span>
        {competitor(m.idolBId, m.scoreB, m.completed && m.winnerId === m.idolBId, 'right')}
      </button>)}
    </div>
    <p className="mt-2 text-[10px] text-amber-100/40">Select a match row to enter or edit its result.</p>
    {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-400">{error}</p>}
    {selectedMatch && <MatchModal isOpen onClose={() => setSelectedMatch(null)} idolA={selectedMatch.idolAId ? idols.get(selectedMatch.idolAId) || null : null} idolB={selectedMatch.idolBId ? idols.get(selectedMatch.idolBId) || null : null} currentScoreA={selectedMatch.scoreA} currentScoreB={selectedMatch.scoreB} matchTitle={selectedMatch.roundName} stageName="Open Arena Cup" isKnockout isGrandFinal={/final/i.test(selectedMatch.roundName) && !/semi|quarter/i.test(selectedMatch.roundName)} isCompleted={selectedMatch.completed} onFinish={(a, b) => { const result = onSave(selectedMatch.id, a, b); if (result) setError(result); else setSelectedMatch(null); }} />}
  </div>;
};

const CrownCupBracket: React.FC<{ ms: E.BNode[]; idols: Map<string, Idol>; nm: (id: string | null) => string; sim: (ms: E.BNode[], id: string) => void; save: (ms: E.BNode[], id: string, a: number, b: number) => string | null; onChange: (ms: E.BNode[]) => void }> = ({ ms, idols, nm, sim, save, onChange }) => {
  const upperRounds = [
    { name: 'Upper Round 1', label: 'UPPER ROUND 1' },
    { name: 'Upper Semi Final', label: 'UPPER SEMI-FINAL' },
    { name: 'Upper Final', label: 'UPPER FINAL' },
  ];
  const lowerRounds = [
    { name: 'Lower Round 1', label: 'LOWER ROUND 1' },
    { name: 'Lower Round 2', label: 'LOWER ROUND 2' },
    { name: 'Lower Round 3', label: 'LOWER ROUND 3' },
    { name: 'Lower Final', label: 'LOWER FINAL' },
  ];
  const renderLane = (rounds: { name: string; label: string }[], tone: 'upper' | 'lower') => {
    // Only render rounds that belong to this bracket format. Empty legacy rounds
    // create misleading blank columns and large holes in the lower-bracket layout.
    const activeRounds = rounds
      .map((round) => ({ ...round, matches: ms.filter((match) => match.roundName === round.name) }))
      .filter((round) => round.matches.length > 0);

    return (
      <div
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}
      >
        {activeRounds.map((round) => (
          <article key={round.name} className="flex min-w-0 flex-col gap-3">
            <div className={`rounded-xl border px-4 py-3 text-center shadow-sm ${
              tone === 'upper'
                ? 'border-emerald-500/40 bg-emerald-950/45 text-emerald-300'
                : 'border-purple-500/40 bg-purple-950/45 text-purple-300'
            }`}>
              <div className="text-xs font-black uppercase tracking-widest">{round.label}</div>
              <div className="mt-1 font-mono text-[10px] opacity-65">
                {round.matches.filter((match) => match.completed).length} / {round.matches.length} completed
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              {round.matches.map((match) => (
                <Row
                  key={match.id}
                  m={match}
                  idols={idols}
                  nm={nm}
                  onSim={() => { const copy = clone(ms); sim(copy, match.id); onChange(copy); }}
                  onSave={(a, b) => {
                    const copy = clone(ms);
                    const error = save(copy, match.id, a, b);
                    if (!error) onChange(copy);
                    return error;
                  }}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    );
  };
  const grandFinal = ms.find((m) => m.roundName === 'Grand Final');
  const champion = grandFinal?.completed ? grandFinal.winnerId : null;
  return (
    <div className="w-full min-w-0 space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-emerald-300">Upper Bracket</h3>
            <p className="mt-1 text-xs font-bold text-amber-100/45">Winners remain in the championship path</p>
          </div>
          <span className="rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">Winner's path</span>
        </div>
        {renderLane(upperRounds, 'upper')}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-purple-300">Lower Bracket</h3>
            <p className="mt-1 text-xs font-bold text-amber-100/45">One more loss means elimination</p>
          </div>
          <span className="rounded-lg border border-purple-700/40 bg-purple-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-purple-300">Elimination path</span>
        </div>
        {renderLane(lowerRounds, 'lower')}
      </section>

      {grandFinal && (
        <section className="rounded-xl border border-indigo-500/50 bg-gradient-to-br from-slate-900 to-slate-950 p-3 shadow-lg">
          <div className="mb-4 text-center">
            <h3 className="text-lg font-black uppercase tracking-widest text-amber-300">Grand Final</h3>
            <p className="mt-1 text-xs font-bold text-amber-100/55">Upper Bracket Champion vs Lower Bracket Champion · Best of 7</p>
          </div>
          <div className="flex justify-center">
            <Row m={grandFinal} idols={idols} nm={nm}
              onSim={() => { const copy = clone(ms); sim(copy, grandFinal.id); onChange(copy); }}
              onSave={(a, b) => { const copy = clone(ms); const error = save(copy, grandFinal.id, a, b); if (!error) onChange(copy); return error; }}
            />
          </div>
          {champion && <div className="mt-4 border-t border-amber-500/25 pt-4 text-center text-sm font-black uppercase tracking-widest text-amber-300">Crown Cup Champion: {nm(champion)}</div>}
        </section>
      )}
    </div>
  );
};

export const V5CupsPanel: React.FC<Props> = ({ idols, leagueState, section, v5State, onUpdateV5State, theIdolsChampionId, knockoutMatches }) => {
  const v5 = v5State;
  const [names] = useState<CompetitionNames>(() => loadNames());
  const [msg, setMsg] = useState('');
  const [simulatingOpenCup, setSimulatingOpenCup] = useState(false);
  const [isCrownManualOpen, setIsCrownManualOpen] = useState(false);
  const [isCrownSimulcastOpen, setIsCrownSimulcastOpen] = useState(false);
  const [superEditor, setSuperEditor] = useState<'a' | 'b' | null>(null);
  const [superSimulcast, setSuperSimulcast] = useState<'a' | 'b' | null>(null);
  const [isOpenManualOpen, setIsOpenManualOpen] = useState(false);
  const [isOpenSimulcastOpen, setIsOpenSimulcastOpen] = useState(false);
  const [selectedOpenMatch, setSelectedOpenMatch] = useState<E.BNode | null>(null);
  const emptyCrownCup = useMemo(() => createEmptyCrownCup(), []);
  const [selectedSpotlightLeague, setSelectedSpotlightLeague] = useState('');
  const [selectedOpenRound, setSelectedOpenRound] = useState('');
  const by = useMemo(() => new Map(idols.map((i) => [i.id, i])), [idols]);
  const crownCup = v5.champsCup || emptyCrownCup;
  const crownKnockoutMatches = useMemo(() => toCrownKnockoutMatches(crownCup.matches), [crownCup.matches]);
  const crownPlayableCount = crownCup.matches.filter((m) => !m.completed && m.idolAId && m.idolBId).length;
  const crownChampionId = crownCup.matches.find((m) => m.id === 'cc_gf')?.winnerId || null;
  const crownSeedOrder = crownCup.seedOrder || crownCup.byeIds || [];
  const crownSimConfig = { favoriteIdolIds: [], groups: [] } as unknown as TournamentConfig;
  const nm = (id: string | null) => (id ? by.get(id)?.name || id : 'TBD');
  const d1 = leagueState?.leagues || [];
  const superAView = v5.superA || createEmptySuperFinal('sc_a', 'Super Cup A');
  const superBView = d1.length
    ? d1.map((league) => v5.superB.find((match) => match.id === `sc_b${league.id}`) || createEmptySuperFinal(`sc_b${league.id}`, `${league.name} Super Cup`))
        .concat(v5.superB.filter((match) => !d1.some((league) => match.id === `sc_b${league.id}`)))
    : (v5.superB.length ? v5.superB : [createEmptySuperFinal('sc_b0', 'Super Cup B')]);
  const superAPlayable = !!superAView.idolAId && !!superAView.idolBId && !superAView.completed;
  const superBPlayable = superBView.filter((match) => !!match.idolAId && !!match.idolBId && !match.completed).length;
  const superConfig = { favoriteIdolIds: [], groups: [] } as unknown as TournamentConfig;
  const commit = (patch: Partial<V5State>) => { const n = { ...v5, ...patch }; onUpdateV5State(n); if (!saveV5State(n)) setMsg('Storage is full: this change is not saved. Export a backup and clear old data.'); };
  useEffect(() => {
    if (!v5.champsCup?.matches.some((match) => match.id === 'cc_lr2' || match.id === 'cc_lr3')) return;
    const migrated = { ...v5, champsCup: { ...v5.champsCup, matches: E.migrateChampsCup(v5.champsCup.matches) } };
    onUpdateV5State(migrated);
    if (!saveV5State(migrated)) setMsg('Storage is full: Crown Cup format migration could not be saved. Export a backup and clear old data.');
  }, [v5.champsCup, onUpdateV5State]);
  const done = (ls: { matches: any[] }[]) => ls.length > 0 && ls.every((l) => l.matches.length > 0 && l.matches.every((m: any) => m.completed));
  const d1Done = done(d1 as any), d2Done = done(v5.d2 as any);
  const gf = knockoutMatches.find((m) => m.completed && /grand final/i.test(m.roundName));
  const grandChamp = gf?.winnerId || null, grandRunner = gf ? (gf.winnerId === gf.idolAId ? gf.idolBId : gf.idolAId) : null;
  const d2Count = v5.d2.reduce((a, l) => a + l.memberIds.length, 0);
  const lcView = useMemo(() => lc || createEmptyLeagueCup(d1.reduce((sum, league) => sum + league.memberIds.length, 0), d2Count), [lc, d1, d2Count]);
  const lcViewMatches = lcView.rounds.flat();
  const lcKnockoutMatches = useMemo(() => toOpenArenaKnockoutMatches(lcView.rounds), [lcView.rounds]);
  const lcRoundOf16Index = lcView.rounds.findIndex((round) => round.length === 8);
  const lcKnockoutStage = lcRoundOf16Index >= 0 ? lcView.rounds.slice(lcRoundOf16Index) : [];
  const lcKnockoutTreeMatches = useMemo(() => toOpenArenaKnockoutMatches(lcKnockoutStage), [lcKnockoutStage]);
  const lcPlayableCount = lcViewMatches.filter((match) => !match.completed && match.idolAId && match.idolBId).length;

  const simOne = (ms: E.BNode[], id: string) => { E.advanceBracket(ms); const m = ms.find((x) => x.id === id); if (m && !m.completed && m.idolAId && m.idolBId) E.playNode(m, by); E.advanceBracket(ms); };
  const manual = (ms: E.BNode[], id: string, a: number, b: number): string | null => {
    const m = ms.find((x) => x.id === id); if (!m || !m.idolAId || !m.idolBId) return 'Both idols must be known first.';
    const t = m.bestOf === 7 ? 4 : 3; if (Math.max(a, b) !== t || Math.min(a, b) >= t) return `Best of ${m.bestOf} ends when one idol reaches ${t} wins (for example ${t}-0, ${t}-1, ${t}-${t - 1}).`;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return 'Scores must be non-negative whole numbers.';
    m.scoreA = a; m.scoreB = b; m.winnerId = a > b ? m.idolAId : m.idolBId; m.loserId = a > b ? m.idolBId : m.idolAId; m.completed = true;
    E.invalidateDownstream(ms, id);
    E.advanceBracket(ms);
    return null;
  };
  /* ---------- actions */

  const champions = (): E.ChampionInfo[] => d1.map((l) => { const t = rankStandings(l.standings)[0]; return { idolId: t.idolId, leagueId: l.id, wonGrandCup: t.idolId === grandChamp, wonTheIdols: t.idolId === theIdolsChampionId, points: t.points || 0, gameDiff: t.gameDiff || 0 }; });
  const buildChamps = () => {
    if (d1.length !== 6) { setMsg('Crown Cup needs exactly 6 Division 1 leagues.'); return; }
    if (!d1Done) { setMsg('Complete every Division 1 match before automatically building Crown Cup from league champions.'); return; }
    commit({ champsCup: E.buildChampsCup(champions()) });
    setMsg('Crown Cup bracket created from the six Division 1 champions.');
  };
  const reseedCrownCup = () => {
    const ids = [
      ...crownCup.matches.filter((m) => m.roundName === 'Upper Round 1').flatMap((m) => [m.a, m.b].flatMap((slot) => ('id' in slot && slot.id ? [slot.id] : []))),
      ...['cc_usf_a', 'cc_usf_b'].flatMap((id) => {
        const match = crownCup.matches.find((m) => m.id === id);
        return match && 'id' in match.a && match.a.id ? [match.a.id] : [];
      }),
    ];
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== 6) { setMsg(`Auto re-seed needs six unique entrants in the opening bracket. Current count: ${uniqueIds.length}.`); return; }
    const participants: E.ChampionInfo[] = uniqueIds.map((idolId, index) => ({
      idolId, leagueId: index + 1, wonGrandCup: false, wonTheIdols: false, points: 0, gameDiff: 0,
    }));
    commit({ champsCup: E.buildChampsCup(participants) });
    setMsg('Crown Cup opening matchups and bye order have been re-seeded.');
  };
  const saveCrownManualBracket = (updatedMatches: KnockoutMatch[]) => {
    const originalMatches = JSON.stringify(crownCup.matches);
    const next = clone(crownCup.matches);
    const resetChangedMatch = (matchId: string) => {
      const target = next.find((m) => m.id === matchId);
      if (!target) return;
      target.scoreA = null;
      target.scoreB = null;
      target.winnerId = null;
      target.loserId = null;
      target.completed = false;
      E.invalidateDownstream(next, matchId);
    };
    let invalidByeAssignment = false;
    updatedMatches.forEach((edited) => {
      if (edited.id === 'cc_manual_bye_a' || edited.id === 'cc_manual_bye_b') {
        const targetId = edited.id === 'cc_manual_bye_a' ? 'cc_usf_a' : 'cc_usf_b';
        const target = next.find((m) => m.id === targetId);
        if (!target) return;
        if (edited.idolAId && edited.idolBId) {
          invalidByeAssignment = true;
          setMsg('Each Crown Cup bye slot accepts one idol only. Clear one side and save again.');
          return;
        }
        const newId = edited.idolAId || edited.idolBId || '';
        const currentId = 'id' in target.a ? target.a.id : '';
        if (newId !== currentId) {
          target.a = { id: newId };
          resetChangedMatch(targetId);
        }
        return;
      }
      const target = next.find((m) => m.id === edited.id);
      if (!target || target.roundName !== 'Upper Round 1') return;
      let changed = false;
      if ((edited.idolAId || '') !== target.idolAId) {
        target.a = { id: edited.idolAId || '' };
        changed = true;
      }
      if ((edited.idolBId || '') !== target.idolBId) {
        target.b = { id: edited.idolBId || '' };
        changed = true;
      }
      if (changed) resetChangedMatch(target.id);
    });
    if (invalidByeAssignment) return;
    E.advanceChampsCup(next, crownSeedOrder);
    if (JSON.stringify(next) === originalMatches) { setMsg('No Crown Cup bracket changes to save.'); return; }
    const byeIds = ['cc_usf_a', 'cc_usf_b'].flatMap((id) => {
      const match = next.find((m) => m.id === id);
      return match && 'id' in match.a && match.a.id ? [match.a.id] : [];
    });
    commit({ champsCup: { matches: next, byeIds, seedOrder: crownSeedOrder } });
    setMsg('Manual Crown Cup bracket changes saved.');
  };
  const commitCrownSimulcast = (updatedMatches: KnockoutMatch[]) => {
    const next = clone(crownCup.matches);
    updatedMatches.forEach((result) => {
      const target = next.find((m) => m.id === result.id);
      if (!target || target.completed || !result.completed || result.scoreA === null || result.scoreB === null || !result.winnerId) return;
      target.scoreA = result.scoreA;
      target.scoreB = result.scoreB;
      target.winnerId = result.winnerId;
      target.loserId = result.winnerId === target.idolAId ? target.idolBId : target.idolAId;
      target.completed = true;
    });
    E.advanceChampsCup(next, crownSeedOrder);
    commit({ champsCup: { ...crownCup, matches: next } });
  };
  const refreshLC = (s: E.LeagueCupState) => { if (s.rounds.length === s.plan.rounds && s.rounds[s.rounds.length - 1].every((m) => m.completed)) s.championId = s.rounds[s.rounds.length - 1][0].winnerId; return s; };

  const buildLC = () => {
    try {
      if (!d1Done || !d2Done) { setMsg('Open Arena Cup can be built after every Division 1 and Division 2 league has completed all matches.'); return; }
      const order = E.leagueCupOrder(d1 as any, v5.d2), leagueOf: Record<string, number> = {};
      [...d1, ...v5.d2].forEach((league) => league.memberIds.forEach((idolId) => { leagueOf[idolId] = league.id; }));
      if (order.length < 2) { setMsg('Open Arena Cup needs at least two qualified idols.'); return; }
      const next = E.createLeagueCup(order, leagueOf, d2Count);
      if (!E.stepLeagueCup(next)) { setMsg('Open Arena Cup could not create its first round.'); return; }
      commit({ leagueCup: next }); setMsg('Open Arena Cup bracket created.');
    } catch (error) { setMsg(error instanceof Error ? 'Open Arena Cup build failed: ' + error.message : 'Open Arena Cup build failed.'); }
  };
  const lcAll = async () => {
    if (!v5.leagueCup || simulatingOpenCup || v5.leagueCup.championId) return;
    setSimulatingOpenCup(true);
    try {
      const next = clone(v5.leagueCup);
      for (let round = 0; round < 20 && !next.championId; round++) {
        const current = next.rounds[next.rounds.length - 1];
        if (!current || !current.every((match) => match.completed || (!!match.idolAId && !!match.idolBId))) break;
        current.filter((match) => !match.completed && match.idolAId && match.idolBId).forEach((match) => E.playNode(match, by));
        refreshLC(next);
        commit({ leagueCup: clone(next) });
        if (!next.championId) E.stepLeagueCup(next);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      commit({ leagueCup: next });
    } catch (error) { setMsg(error instanceof Error ? 'Open Arena Cup simulation failed: ' + error.message : 'Open Arena Cup simulation failed.'); }
    finally { setSimulatingOpenCup(false); }
  };
  const saveOpenArenaResult = (id: string, scoreA: number, scoreB: number): string | null => {
    const next = clone(lc || lcView);
    const roundIndex = next.rounds.findIndex((round) => round.some((match) => match.id === id));
    if (roundIndex < 0) return 'Match not found in Open Arena Cup.';
    const error = manual(next.rounds.flat(), id, scoreA, scoreB);
    if (error) return error;
    next.rounds = next.rounds.slice(0, roundIndex + 1); next.championId = null; refreshLC(next);
    if (next.rounds[roundIndex].every((match) => match.completed) && !next.championId) E.stepLeagueCup(next);
    commit({ leagueCup: next }); return null;
  };
  const saveOpenManualBracket = (updatedMatches: KnockoutMatch[]) => {
    const next = clone(lcView);
    const changedRounds = new Set<number>();
    updatedMatches.forEach((edited) => {
      const roundIndex = next.rounds.findIndex((round) => round.some((match) => match.id === edited.id));
      if (roundIndex < 0 || roundIndex > 1) return;
      const target = next.rounds[roundIndex].find((match) => match.id === edited.id);
      if (!target) return;
      const a = edited.idolAId || '', b = edited.idolBId || '';
      if ((target.idolAId || '') !== a || (target.idolBId || '') !== b) {
        target.a = { id: a }; target.b = { id: b }; target.idolAId = a || null; target.idolBId = b || null;
        target.scoreA = null; target.scoreB = null; target.winnerId = null; target.loserId = null; target.completed = false;
        E.invalidateDownstream(next.rounds.flat(), target.id); changedRounds.add(roundIndex);
      }
    });
    if (!changedRounds.size) { setMsg('No Open Arena Cup bracket changes to save.'); return; }
    const firstChanged = Math.min(...changedRounds);
    next.rounds = next.rounds.slice(0, firstChanged + 1); next.championId = null;
    if (firstChanged === 0) {
      const entrants = next.rounds[0].flatMap((match) => [match.idolAId || '', match.idolBId || '']);
      next.order = [...entrants, ...next.order.slice(entrants.length)];
    }
    commit({ leagueCup: next });
    setMsg('Manual bracket changes saved. Later rounds will be rebuilt after this round is completed.');
  };
  const commitOpenSimulcast = (updatedMatches: KnockoutMatch[]) => {
    if (!v5.leagueCup) return;
    const next = clone(v5.leagueCup), current = next.rounds[next.rounds.length - 1];
    if (!current) return;
    updatedMatches.forEach((result) => {
      const target = current.find((match) => match.id === result.id);
      if (!target || target.completed || !result.completed || result.scoreA === null || result.scoreB === null || !result.winnerId) return;
      target.scoreA = result.scoreA; target.scoreB = result.scoreB; target.winnerId = result.winnerId;
      target.loserId = result.winnerId === target.idolAId ? target.idolBId : target.idolAId; target.completed = true;
    });
    refreshLC(next);
    if (current.every((match) => match.completed) && !next.championId) E.stepLeagueCup(next);
    commit({ leagueCup: next });
  };
  const buildMini = (lid: number) => {
    try {
      const l = d1.find((x) => x.id === lid); if (!l) { setMsg('League not found.'); return; }
      if (!l.matches.length || !l.matches.every((m: any) => m.completed)) { setMsg(`${l.name}: finish all league matches before building Spotlight Cup.`); return; }
      const qualified = rankStandings(l.standings).slice(0, 16).map((standing) => standing.idolId);
      if (qualified.length !== 16 || qualified.some((id) => !id)) { setMsg(`${l.name}: Spotlight Cup requires 16 valid qualifiers in the final standings. Found ${qualified.length}.`); return; }
      const bracket = E.buildMiniCup(lid, qualified); commit({ miniCups: { ...v5.miniCups, [lid]: bracket } }); setMsg(`${l.name} Spotlight Cup bracket created.`);
    } catch (error) { setMsg(error instanceof Error ? `Spotlight Cup build failed: ${error.message}` : 'Spotlight Cup build failed. Check the league standings and try again.'); }
  };
  const champOf = (ms?: E.BNode[], id?: string) => { const f = ms?.find((m) => m.id === id); return f?.completed ? f.winnerId : null; };
  const buildSuperA = () => {
    const first = theIdolsChampionId || null;
    const second = grandChamp || null;
    const opponent = first && first === second ? grandRunner || null : second;
    const next = createEmptySuperFinal('sc_a', 'Super Cup A', first, opponent);
    commit({ superA: next });
    setMsg(first && opponent ? 'Super Cup A Grand Final is ready.' : 'Super Cup A bracket created. Missing champion slots can be assigned manually.');
  };
  const buildSuperB = () => {
    if (d1.length === 0) { setMsg('Division 1 league data is not available.'); return; }
    const ms = d1.map((league) => {
      const mini = champOf(v5.miniCups[league.id], `mc${league.id}_final`);
      const standings = rankStandings(league.standings);
      const leagueChampion = standings[0]?.idolId || null;
      const runnerUp = standings[1]?.idolId || null;
      const opponent = leagueChampion && leagueChampion === mini ? runnerUp : mini;
      return createEmptySuperFinal(`sc_b${league.id}`, `${league.name} Super Cup`, leagueChampion, opponent);
    });
    commit({ superB: ms });
    const ready = ms.filter((match) => match.idolAId && match.idolBId).length;
    setMsg(`Super Cup B created: ${ready} of ${ms.length} Grand Finals have both qualified participants.`);
  };
  const saveSuperManualBracket = (kind: 'a' | 'b', updated: KnockoutMatch[]) => {
    const current = kind === 'a' ? [superAView] : superBView;
    const next = clone(current);
    updated.forEach((edited) => {
      const target = next.find((match) => match.id === edited.id);
      if (!target) return;
      const nextA = edited.idolAId || '';
      const nextB = edited.idolBId || '';
      if ((target.idolAId || '') !== nextA || (target.idolBId || '') !== nextB) {
        target.a = { id: nextA };
        target.b = { id: nextB };
        target.idolAId = nextA || null;
        target.idolBId = nextB || null;
        target.scoreA = null;
        target.scoreB = null;
        target.winnerId = null;
        target.loserId = null;
        target.completed = false;
      }
    });
    if (kind === 'a') commit({ superA: next[0] });
    else commit({ superB: next });
    setMsg(`${kind === 'a' ? names.superCupA : names.superCupB} manual bracket changes saved.`);
  };
  const commitSuperSimulcast = (kind: 'a' | 'b', updated: KnockoutMatch[]) => {
    const next = clone(kind === 'a' ? [superAView] : superBView);
    updated.forEach((result) => {
      const target = next.find((match) => match.id === result.id);
      if (!target || target.completed || !result.completed || result.scoreA === null || result.scoreB === null || !result.winnerId) return;
      target.scoreA = result.scoreA;
      target.scoreB = result.scoreB;
      target.winnerId = result.winnerId;
      target.loserId = result.winnerId === target.idolAId ? target.idolBId : target.idolAId;
      target.completed = true;
    });
    if (kind === 'a') commit({ superA: next[0] });
    else commit({ superB: next });
  };
  const simulateSuperAll = (kind: 'a' | 'b') => {
    const next = clone(kind === 'a' ? [superAView] : superBView);
    E.simulateBracket(next, by);
    if (kind === 'a') commit({ superA: next[0] });
    else commit({ superB: next });
  };

  const lc = v5.leagueCup, lcMatches = lc ? lc.rounds.flat() : [];
  const panelTitle = section === 'crown' ? names.champsCup : section === 'open' ? names.leagueCup : section === 'spotlight' ? names.miniCup : 'Super Cups';
  const panelDescription = section === 'crown'
    ? 'The six Division 1 league champions compete in a double-elimination bracket.'
    : section === 'open'
      ? 'All Division 1 and Division 2 league participants compete in the all-league knockout bracket.'
      : section === 'spotlight'
        ? 'The top 16 finishers from each Division 1 league compete in their own seeded knockout bracket.'
        : 'Manage the two Super Cup competitions and their championship matches.';
  return (
    <div className="w-full min-w-0 max-w-none p-4 text-amber-100 sm:p-6 xl:p-8">
      {section !== 'crown' && (
        <>
          <h1 className="text-3xl font-black text-amber-300 mb-1">{panelTitle}</h1>
          <p className="text-sm text-amber-100/60 mb-4">{panelDescription}</p>
        </>
      )}
      {msg && <div role="status" className="mb-4 rounded-xl border-2 border-black bg-black/50 p-3 text-sm text-amber-200">{msg} <button className="underline ml-2" onClick={() => setMsg('')}>close</button></div>}

      {section === 'crown' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-400">Tournament Workspace</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{names.champsCup}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">Six Division 1 champions compete in a double-elimination bracket. The bracket remains visible before participants are assigned.</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{leagueState?.seasonName || `Season ${leagueState?.seasonNumber || 1}`}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={buildChamps} disabled={!d1Done || !!v5.champsCup} className="border-slate-700 bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">Auto Build</Btn>
                <Btn onClick={() => { const next = clone(crownCup.matches); E.simulateChampsCup(next, by, crownSeedOrder); commit({ champsCup: { ...crownCup, matches: next } }); }} disabled={!v5.champsCup || crownPlayableCount === 0} className="border-slate-700 bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">Simulate All Matches</Btn>
                <Btn onClick={() => setIsCrownManualOpen(true)} className="border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 hover:bg-slate-700">Edit Bracket Manually</Btn>
                <Btn onClick={() => setIsCrownSimulcastOpen(true)} disabled={!v5.champsCup || crownPlayableCount === 0 || !!crownChampionId} className="border-slate-700 bg-fuchsia-700 px-4 py-2 text-white hover:bg-fuchsia-600">Live Simulcast</Btn>
                <Btn onClick={() => { if (window.confirm('Reset the Crown Cup bracket and clear every match result? The season archive and historical records will remain unchanged.')) commit({ champsCup: null }); }} disabled={!v5.champsCup} className="border-slate-700 bg-rose-700 px-4 py-2 text-white hover:bg-rose-600">Reset Bracket / Matches</Btn>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Matches</div><div className="mt-1 font-mono text-xl font-black text-white">{crownCup.matches.length}</div></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Completed</div><div className="mt-1 font-mono text-xl font-black text-emerald-300">{crownCup.matches.filter((m) => m.completed).length}</div></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ready to Play</div><div className="mt-1 font-mono text-xl font-black text-indigo-300">{crownPlayableCount}</div></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entrants</div><div className="mt-1 font-mono text-xl font-black text-white">{new Set(crownCup.matches.filter((m) => m.roundName === 'Upper Round 1').flatMap((m) => [m.idolAId, m.idolBId]).concat(['cc_usf_a','cc_usf_b'].map((id) => crownCup.matches.find((m) => m.id === id)?.idolAId || null)).filter(Boolean)).size}/6</div></div>
            </div>
            {d1Done && (!grandChamp || !theIdolsChampionId) && <p className="mt-3 text-xs text-slate-400">Unzure Cup or The Idols is not finished yet. Automatic bye seeding will use league points and game difference where higher-priority champion data is unavailable.</p>}
            {crownCup.byeIds.length > 0 && <p className="mt-3 text-xs text-slate-400">Bye recipients: <span className="font-bold text-slate-200">{crownCup.byeIds.map(nm).join(', ')}</span></p>}
          </section>
          <CrownCupBracket idols={by} nm={nm} sim={simOne} save={manual} ms={crownCup.matches} onChange={(matches) => { E.advanceChampsCup(matches, crownSeedOrder); commit({ champsCup: { ...crownCup, matches } }); }} />
          {isCrownManualOpen && (
            <ManualBracketModal
              isOpen
              onClose={() => setIsCrownManualOpen(false)}
              knockoutMatches={getCrownManualMatches(crownCup.matches)}
              idolsMap={by}
              onSaveKnockoutMatches={saveCrownManualBracket}
              onRegenerateAutoBracket={reseedCrownCup}
            />
          )}
          {isCrownSimulcastOpen && (
            <KnockoutLiveSimulatorModal
              isOpen
              onClose={() => setIsCrownSimulcastOpen(false)}
              knockoutMatches={crownKnockoutMatches}
              idolsMap={by}
              config={crownSimConfig}
              onCommitMatches={commitCrownSimulcast}
            />
          )}
        </div>
      )}

      {section === 'open' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-400">Tournament Workspace</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{names.leagueCup}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">All Division 1 and Division 2 idols enter a tiered single-elimination competition. The full bracket remains visible before participants are assigned.</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{leagueState?.seasonName || `Season ${leagueState?.seasonNumber || 1}`}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <Btn onClick={buildLC} disabled={!d1Done || !d2Done || !!lc} className="border-slate-700 bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">Build Bracket</Btn>
                <Btn onClick={lcAll} disabled={!lc || !!lc.championId || lcPlayableCount === 0 || simulatingOpenCup} className="border-slate-700 bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">{simulatingOpenCup ? 'Simulating...' : 'Simulate All Matches'}</Btn>
                <Btn onClick={() => setIsOpenManualOpen(true)} className="border-slate-700 bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">Edit Bracket Manually</Btn>
                <Btn onClick={() => setIsOpenSimulcastOpen(true)} disabled={!lc || lcPlayableCount === 0 || !!lc?.championId} className="border-slate-700 bg-fuchsia-700 px-4 py-2 text-white hover:bg-fuchsia-600">Live Simulcast</Btn>
                <Btn onClick={() => { if (lc && window.confirm(`Reset ${names.leagueCup} bracket and every match result? Historical records remain unchanged.`)) commit({ leagueCup: null }); }} disabled={!lc} className="border-slate-700 bg-rose-700 px-4 py-2 text-white hover:bg-rose-600">Reset Bracket / Matches</Btn>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Qualified Idols</div><div className="mt-1 font-mono text-xl font-black text-white">{lcView.order.length}</div></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Rounds</div><div className="mt-1 font-mono text-xl font-black text-white">{lcView.plan.rounds}</div></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Completed</div><div className="mt-1 font-mono text-xl font-black text-emerald-300">{lcViewMatches.filter((match) => match.completed).length}</div></div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ready to Play</div><div className="mt-1 font-mono text-xl font-black text-indigo-300">{lcPlayableCount}</div></div>
            </div>
          </section>
          {!lc && <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-relaxed text-slate-300">Bracket preview is visible. Build becomes available after all Division 1 and Division 2 league matches finish. Use manual editing to assign participants to the opening bracket.</div>}
          {lcView.rounds.length > 0 && <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Competition Bracket</p><h3 className="mt-1 text-lg font-black text-white">Championship Progression</h3></div>
              {lc?.championId && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">Champion: {nm(lc.championId)}</span>}</div>
            {lcRoundOf16Index >= 0 ? <>
              <OpenArenaMatchList matches={lcView.rounds.slice(0, lcRoundOf16Index).flat()} idols={by} nm={nm} onSave={saveOpenArenaResult} />
              <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-slate-950 to-slate-950 p-3 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Round of 16 · Single Elimination</p><h4 className="mt-1 text-lg font-black text-white">Knockout Championship Bracket</h4></div><span className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-200">{lcKnockoutStage.reduce((sum, round) => sum + round.length, 0)} matches</span></div>
                <TournamentBracketTree knockoutMatches={lcKnockoutTreeMatches} idolsMap={by} onSelectMatch={(match) => { const selected = lcKnockoutStage.flat().find((item) => item.id === match.id); if (selected?.idolAId && selected?.idolBId) setSelectedOpenMatch(selected); }} showTitleHeader={false} initialLayoutMode="split" />
              </div>
            </> : <OpenArenaMatchList matches={lcViewMatches} idols={by} nm={nm} onSave={saveOpenArenaResult} />}
          </section>
          {isOpenManualOpen && <ManualBracketModal key={lcViewMatches.map((match) => match.id).join('|')} isOpen onClose={() => setIsOpenManualOpen(false)} knockoutMatches={lcKnockoutMatches} idolsMap={by} onSaveKnockoutMatches={saveOpenManualBracket} onRegenerateAutoBracket={buildLC} />}
          {isOpenSimulcastOpen && lc && <KnockoutLiveSimulatorModal isOpen onClose={() => setIsOpenSimulcastOpen(false)} knockoutMatches={toOpenArenaKnockoutMatches([lc.rounds[lc.rounds.length - 1] || []])} idolsMap={by} config={crownSimConfig} onCommitMatches={commitOpenSimulcast} />}
        </div>
      )}

      {section === 'spotlight' && (() => {
        const selectedLeague = d1.find((league) => league.id === Number(selectedSpotlightLeague || d1[0]?.id)) || d1[0] || null;
        const leagueId = selectedLeague?.id ?? Number(selectedSpotlightLeague || 0);
        const stored = v5.miniCups[leagueId];
        const matches = stored || createEmptyMiniCup(leagueId);
        const knockoutMatches = toMiniKnockoutMatches(matches);
        const champion = champOf(matches, `mc${leagueId}_final`);
        const completed = matches.filter((match) => match.completed).length;
        const playable = matches.filter((match) => !match.completed && match.idolAId && match.idolBId).length;
        const entrants = matches.filter((match) => match.roundName === 'Round of 16').flatMap((match) => [match.idolAId, match.idolBId]).filter(Boolean);
        const qualified = selectedLeague ? rankStandings(selectedLeague.standings).slice(0, 16).map((standing) => standing.idolId) : [];
        const canBuild = !!selectedLeague && selectedLeague.matches.length > 0 && selectedLeague.matches.every((match) => match.completed) && qualified.length === 16 && qualified.every(Boolean);
        const saveManualSpotlight = (edits: KnockoutMatch[]) => {
          const next = clone(matches); let changed = false;
          edits.forEach((edit) => {
            const roundIndex = [...new Set(next.map((match) => match.roundName))].indexOf(edit.roundName);
            if (roundIndex < 0 || roundIndex > 1) return;
            const target = next.find((match) => match.id === edit.id); if (!target) return;
            const a = edit.idolAId || ''; const b = edit.idolBId || '';
            if ((target.idolAId || '') === a && (target.idolBId || '') === b) return;
            target.a = { id: a }; target.b = { id: b }; target.idolAId = a || null; target.idolBId = b || null;
            target.scoreA = null; target.scoreB = null; target.winnerId = null; target.loserId = null; target.completed = false;
            E.invalidateDownstream(next, target.id); changed = true;
          });
          if (!changed) { setMsg('No bracket changes to save.'); return; }
          E.advanceBracket(next); commit({ miniCups: { ...v5.miniCups, [leagueId]: next } });
          setMsg('Spotlight Cup manual bracket changes saved.');
        };
        const commitSimulcast = (results: KnockoutMatch[]) => {
          const next = clone(matches);
          results.forEach((result) => {
            const target = next.find((match) => match.id === result.id);
            if (!target || target.completed || !result.completed || result.scoreA === null || result.scoreB === null || !result.winnerId) return;
            if (result.winnerId !== target.idolAId && result.winnerId !== target.idolBId) return;
            target.scoreA = result.scoreA; target.scoreB = result.scoreB; target.winnerId = result.winnerId;
            target.loserId = result.winnerId === target.idolAId ? target.idolBId : target.idolAId; target.completed = true;
          });
          E.advanceBracket(next); commit({ miniCups: { ...v5.miniCups, [leagueId]: next } });
        };
        const simulateAll = () => { const next = clone(matches); E.simulateBracket(next, by); commit({ miniCups: { ...v5.miniCups, [leagueId]: next } }); };
        const reset = () => {
          if (!stored || !window.confirm(`Reset ${selectedLeague?.name || 'Spotlight Cup'} bracket and all match results? Historical archives remain unchanged.`)) return;
          const next = { ...v5.miniCups }; delete next[leagueId]; commit({ miniCups: next });
        };
        const regenerate = () => {
          const opening = matches.filter((match) => match.roundName === 'Round of 16');
          const seed = [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11];
          const reconstructed = Array.from({ length: 16 }, () => '');
          opening.forEach((match, index) => { reconstructed[seed[index * 2] - 1] = match.idolAId || ''; reconstructed[seed[index * 2 + 1] - 1] = match.idolBId || ''; });
          const entrantsToUse = qualified.length === 16 && qualified.every(Boolean) ? qualified : reconstructed.every(Boolean) ? reconstructed : [];
          if (entrantsToUse.length !== 16) { setMsg('Regeneration requires 16 qualified idols or 16 manually assigned opening-round slots.'); return; }
          commit({ miniCups: { ...v5.miniCups, [leagueId]: E.buildMiniCup(leagueId, entrantsToUse) } });
        };
        return (
          <div className="space-y-5 animate-in fade-in duration-200">
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-xl">
              <div className="border-b border-slate-800 bg-gradient-to-r from-indigo-950/60 via-slate-950 to-amber-950/30 px-5 py-6 sm:px-7">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">Tournament Workspace</p>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div><h2 className="text-2xl font-black tracking-tight text-white">{names.miniCup}</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">Top 16 from the selected Division 1 league. Single elimination, Best of 5, final Best of 7. Bracket preview remains visible before participants are assigned.</p></div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{leagueState?.seasonName || `Season ${leagueState?.seasonNumber || 1}`}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-b border-slate-800 bg-black/20 p-3 sm:grid-cols-3 lg:grid-cols-6">
                {d1.map((league) => { const data = v5.miniCups[league.id]; const done = data?.filter((match) => match.completed).length || 0; return <button key={league.id} type="button" onClick={() => setSelectedSpotlightLeague(String(league.id))} className={`relative flex min-h-[76px] flex-col justify-between rounded-xl border p-3 text-left transition-all ${league.id === leagueId ? 'border-indigo-400 bg-indigo-500/15 ring-1 ring-indigo-400/30' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}><span className="font-mono text-[10px] font-bold text-slate-400">{done}/{data?.length || 15}</span><span className="mt-2 truncate text-xs font-black uppercase tracking-wide text-white">{league.name}</span>{data?.some((match) => match.id.endsWith('_final') && match.completed) && <span className="absolute right-2 top-2 text-[9px] font-black text-emerald-300">CHAMP</span>}</button>; })}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-black/20 px-4 py-4 sm:px-7">
                <Btn onClick={() => selectedLeague && buildMini(leagueId)} disabled={!canBuild || !!stored} className="border-slate-700 bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">Build Bracket</Btn>
                <Btn onClick={simulateAll} disabled={playable === 0 || !!champion} className="border-slate-700 bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">Simulate All Matches</Btn>
                <Btn onClick={() => setIsOpenManualOpen(true)} className="border-slate-700 bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">Edit Bracket Manually</Btn>
                <Btn onClick={() => setIsOpenSimulcastOpen(true)} disabled={playable === 0 || !!champion} className="border-slate-700 bg-fuchsia-700 px-4 py-2 text-white hover:bg-fuchsia-600">Live Simulcast</Btn>
                <Btn onClick={reset} disabled={!stored} className="border-slate-700 bg-rose-700 px-4 py-2 text-white hover:bg-rose-600">Reset Bracket / Matches</Btn>
              </div>
              <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:px-7">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Qualified Idols</div><div className="mt-1 font-mono text-xl font-black text-white">{entrants.length}/16</div></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Matches</div><div className="mt-1 font-mono text-xl font-black text-white">{matches.length}</div></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Completed</div><div className="mt-1 font-mono text-xl font-black text-emerald-300">{completed}</div></div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ready to Play</div><div className="mt-1 font-mono text-xl font-black text-indigo-300">{playable}</div></div>
              </div>
            </section>
            {!stored && <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-relaxed text-slate-300">Preview only. Assign participants through manual editing or build from completed league standings. Preview data is not saved automatically.</div>}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Competition Bracket</p><h3 className="mt-1 text-lg font-black text-white">{selectedLeague?.name || 'Division 1'} · Championship Progression</h3></div>{champion && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">Champion: {nm(champion)}</span>}</div><Bracket nm={nm} idols={by} sim={simOne} save={manual} ms={matches} onChange={(next) => commit({ miniCups: { ...v5.miniCups, [leagueId]: next } })} /></section>
            {isOpenManualOpen && <ManualBracketModal key={`spotlight-${leagueId}-${matches.map((match) => match.idolAId || '').join(',')}-${matches.map((match) => match.idolBId || '').join(',')}`} isOpen onClose={() => setIsOpenManualOpen(false)} knockoutMatches={knockoutMatches} idolsMap={by} onSaveKnockoutMatches={saveManualSpotlight} onRegenerateAutoBracket={regenerate} />}
            {isOpenSimulcastOpen && <KnockoutLiveSimulatorModal key={`spotlight-${leagueId}`} isOpen onClose={() => setIsOpenSimulcastOpen(false)} knockoutMatches={knockoutMatches} idolsMap={by} config={crownSimConfig} onCommitMatches={commitSimulcast} />}
          </div>
        );
      })()}
      {section === 'super' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <section className="overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#17101f] via-slate-950 to-[#24150d] shadow-2xl">
            <div className="relative border-b border-amber-500/20 px-5 py-6 sm:px-7">
              <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-300">Championship Showcase · Main Event</p>
                  <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">{names.superCupA}</h2>
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-300">The Idols champion faces the Unzure Cup champion. If one idol wins both competitions, the runner-up takes the opposing slot. Best of 5.</p>
                </div>
                <div className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{leagueState?.seasonName || `Season ${leagueState?.seasonNumber || 1}`}</div>
              </div>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center sm:p-7">
              <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">The Idols Champion</div>
                <div className="mt-2 text-lg font-black text-white">{nm(superAView.idolAId)}</div>
              </div>
              <div className="flex flex-col items-center gap-1 py-2">
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300">Grand Final</div>
                <div className="text-4xl font-black text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.3)]">VS</div>
                <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-black text-amber-200">BO5</div>
              </div>
              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-fuchsia-200">Unzure Cup Champion</div>
                <div className="mt-2 text-lg font-black text-white">{nm(superAView.idolBId)}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/20 px-4 py-4 sm:px-7">
              <Btn onClick={buildSuperA} className="border-indigo-400/30 bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">Build / Refresh Final</Btn>
              <Btn onClick={() => simulateSuperAll('a')} disabled={!superAPlayable} className="border-emerald-500/30 bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">Simulate All Matches</Btn>
              <Btn onClick={() => setSuperEditor('a')} className="border-slate-600 bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">Edit Bracket Manually</Btn>
              <Btn onClick={() => setSuperSimulcast('a')} disabled={!superAPlayable} className="border-fuchsia-500/30 bg-fuchsia-700 px-4 py-2 text-white hover:bg-fuchsia-600">Live Simulcast</Btn>
              <Btn onClick={() => { if (window.confirm(`Reset ${names.superCupA} bracket and match result?`)) commit({ superA: null }); }} disabled={!v5.superA} className="border-rose-500/30 bg-rose-700 px-4 py-2 text-white hover:bg-rose-600">Reset Bracket / Matches</Btn>
              {superAView.completed && <span className="ml-auto text-xs font-black uppercase tracking-wider text-emerald-300">Champion: {nm(superAView.winnerId)}</span>}
            </div>
            <div className="px-4 pb-5 sm:px-7">
              <div className="mx-auto max-w-3xl rounded-2xl border border-amber-500/25 bg-black/25 p-3 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Official Grand Final Match</span>
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-200">BO5 · FIRST TO 3</span>
                </div>
                <div className="flex justify-center"><Row m={superAView} idols={by} nm={nm} onSim={() => simulateSuperAll('a')} onSave={(a, b) => {
                  const next = clone(superAView); const error = manual([next], next.id, a, b);
                  if (!error) commit({ superA: next });
                  return error;
                }} /></div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-[#1c1023] via-slate-950 to-[#21150f] shadow-2xl">
            <div className="relative border-b border-fuchsia-500/20 px-5 py-6 sm:px-7">
              <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full bg-fuchsia-400/10 blur-3xl" />
              <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-300">League Champions · Spotlight Winners</p>
                  <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">{names.superCupB}</h2>
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-300">Each Division 1 league champion faces the champion of its corresponding {names.miniCup}. Every league has its own Grand Final. Best of 5.</p>
                </div>
                <div className="text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">{leagueState?.seasonName || `Season ${leagueState?.seasonNumber || 1}`}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-4 sm:px-7">
              <Btn onClick={buildSuperB} className="border-fuchsia-400/30 bg-fuchsia-700 px-4 py-2 text-white hover:bg-fuchsia-600">Build / Refresh Finals</Btn>
              <Btn onClick={() => simulateSuperAll('b')} disabled={superBPlayable === 0} className="border-emerald-500/30 bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">Simulate All Matches</Btn>
              <Btn onClick={() => setSuperEditor('b')} className="border-slate-600 bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">Edit Bracket Manually</Btn>
              <Btn onClick={() => setSuperSimulcast('b')} disabled={superBPlayable === 0} className="border-fuchsia-500/30 bg-fuchsia-700 px-4 py-2 text-white hover:bg-fuchsia-600">Live Simulcast</Btn>
              <Btn onClick={() => { if (window.confirm(`Reset all ${names.superCupB} brackets and match results?`)) commit({ superB: [] }); }} disabled={v5.superB.length === 0} className="border-rose-500/30 bg-rose-700 px-4 py-2 text-white hover:bg-rose-600">Reset Bracket / Matches</Btn>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-7">
              {superBView.map((match) => {
                const league = d1.find((item) => match.id === `sc_b${item.id}`);
                const title = league?.name || match.id;
                return (
                  <article key={match.id} className="rounded-2xl border border-fuchsia-400/20 bg-black/25 p-4 shadow-lg">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black uppercase tracking-wider text-fuchsia-200">{title}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Grand Final · BO5</div>
                      </div>
                      {match.completed && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">COMPLETE</span>}
                    </div>
                    <div className="flex justify-center"><Row m={match} idols={by} nm={nm} onSim={() => {
                      const next = clone(superBView); const target = next.find((item) => item.id === match.id); if (target) E.playNode(target, by); commit({ superB: next });
                    }} onSave={(a, b) => {
                      const next = clone(superBView); const target = next.find((item) => item.id === match.id); if (!target) return 'Match not found.';
                      const error = manual(next, match.id, a, b); if (!error) commit({ superB: next }); return error;
                    }} /></div>
                    {match.completed && <div className="mt-3 text-center text-xs font-black uppercase text-emerald-300">Winner: {nm(match.winnerId)}</div>}
                  </article>
                );
              })}
            </div>
          </section>
          {superEditor && (
            <ManualBracketModal
              key={superEditor}
              isOpen
              onClose={() => setSuperEditor(null)}
              knockoutMatches={toSuperKnockoutMatches(superEditor === 'a' ? [superAView] : superBView)}
              idolsMap={by}
              onSaveKnockoutMatches={(updated) => saveSuperManualBracket(superEditor, updated)}
              onRegenerateAutoBracket={() => { if (superEditor === 'a') buildSuperA(); else buildSuperB(); }}
            />
          )}
          {superSimulcast && (
            <KnockoutLiveSimulatorModal
              key={superSimulcast}
              isOpen
              onClose={() => setSuperSimulcast(null)}
              knockoutMatches={toSuperKnockoutMatches(superSimulcast === 'a' ? [superAView] : superBView)}
              idolsMap={by}
              config={superConfig}
              onCommitMatches={(updated) => commitSuperSimulcast(superSimulcast, updated)}
            />
          )}
        </div>
      )}
    </div>
  );
};
