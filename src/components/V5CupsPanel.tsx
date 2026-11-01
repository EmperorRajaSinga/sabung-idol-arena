import React, { useMemo, useState } from 'react';
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

const CROWN_ROUND_ORDER = ['Upper Round 1', 'Upper Semi Final', 'Upper Final', 'Lower Round 1', 'Lower Round 2', 'Lower Round 3', 'Lower Final', 'Grand Final'];
const createEmptyCrownCup = (): { matches: E.BNode[]; byeIds: string[] } => {
  const S = (id: string): E.Slot => ({ id });
  const W = (id: string): E.Slot => ({ win: id });
  const L = (id: string): E.Slot => ({ lose: id });
  const matches: E.BNode[] = [
    { id: 'cc_ur1_a', roundName: 'Upper Round 1', bestOf: 5, a: S(''), b: S(''), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_ur1_b', roundName: 'Upper Round 1', bestOf: 5, a: S(''), b: S(''), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_usf_a', roundName: 'Upper Semi Final', bestOf: 5, a: S(''), b: W('cc_ur1_a'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_usf_b', roundName: 'Upper Semi Final', bestOf: 5, a: S(''), b: W('cc_ur1_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_uf', roundName: 'Upper Final', bestOf: 5, a: W('cc_usf_a'), b: W('cc_usf_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_lr1', roundName: 'Lower Round 1', bestOf: 5, a: L('cc_ur1_a'), b: L('cc_ur1_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_lr2', roundName: 'Lower Round 2', bestOf: 5, a: L('cc_usf_a'), b: L('cc_usf_b'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_lr3', roundName: 'Lower Round 3', bestOf: 5, a: W('cc_lr1'), b: W('cc_lr2'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_lf', roundName: 'Lower Final', bestOf: 7, a: W('cc_lr3'), b: L('cc_uf'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
    { id: 'cc_gf', roundName: 'Grand Final', bestOf: 7, a: W('cc_uf'), b: W('cc_lf'), idolAId: null, idolBId: null, scoreA: null, scoreB: null, winnerId: null, loserId: null, completed: false },
  ];
  E.advanceBracket(matches);
  return { matches, byeIds: [] };
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
      {ready && <MatchModal isOpen={scoreModalOpen} onClose={() => setScoreModalOpen(false)} idolA={idolA} idolB={idolB} currentScoreA={m.scoreA} currentScoreB={m.scoreB} matchTitle={m.roundName} stageName={m.roundName} isKnockout isGrandFinal={m.bestOf === 7} isCompleted={m.completed} onFinish={(scoreA, scoreB) => { const result = onSave(scoreA, scoreB); if (result) setErr(result); else setScoreModalOpen(false); }} />}
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
  const renderLane = (rounds: { name: string; label: string }[], tone: 'upper' | 'lower') => (
    <div className="overflow-x-auto pb-4 custom-scrollbar">
      <div className="flex min-w-max items-start gap-3" style={{ zoom: 0.82 }}>
        {rounds.map((round) => {
          const matches = ms.filter((m) => m.roundName === round.name);
          return (
            <div key={round.name} className="flex w-[320px] shrink-0 flex-col gap-4 sm:w-[340px]">
              <div className={`rounded-xl border-2 px-4 py-3 text-center text-xs font-black uppercase tracking-widest shadow ${
                tone === 'upper'
                  ? 'border-emerald-500/40 bg-emerald-950/45 text-emerald-300'
                  : 'border-purple-500/40 bg-purple-950/45 text-purple-300'
              }`}>
                <div>{round.label}</div>
                <div className="mt-1 font-mono text-[10px] opacity-65">{matches.filter((m) => m.completed).length} / {matches.length} completed</div>
              </div>
              <div className="flex flex-1 flex-col justify-around gap-5">
                {matches.map((m) => (
                  <Row key={m.id} m={m} idols={idols} nm={nm}
                    onSim={() => { const copy = clone(ms); sim(copy, m.id); onChange(copy); }}
                    onSave={(a, b) => { const copy = clone(ms); const error = save(copy, m.id, a, b); if (!error) onChange(copy); return error; }}
                  />
                ))}
                {matches.length === 0 && <div className="rounded-xl border border-dashed border-black/70 bg-black/15 px-4 py-8 text-center text-xs italic text-amber-100/30">Waiting for bracket progression</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const emptyCrownCup = useMemo(() => createEmptyCrownCup(), []);
  const [selectedSpotlightLeague, setSelectedSpotlightLeague] = useState('');
  const [selectedOpenRound, setSelectedOpenRound] = useState('');
  const by = useMemo(() => new Map(idols.map((i) => [i.id, i])), [idols]);
  const crownCup = v5.champsCup || emptyCrownCup;
  const crownKnockoutMatches = useMemo(() => toCrownKnockoutMatches(crownCup.matches), [crownCup.matches]);
  const crownPlayableCount = crownCup.matches.filter((m) => !m.completed && m.idolAId && m.idolBId).length;
  const crownChampionId = crownCup.matches.find((m) => m.id === 'cc_gf')?.winnerId || null;
  const crownSimConfig = { favoriteIdolIds: [], groups: [] } as unknown as TournamentConfig;
  const nm = (id: string | null) => (id ? by.get(id)?.name || id : 'TBD');
  const d1 = leagueState?.leagues || [];
  const commit = (patch: Partial<V5State>) => { const n = { ...v5, ...patch }; onUpdateV5State(n); if (!saveV5State(n)) setMsg('Storage is full: this change is not saved. Export a backup and clear old data.'); };
  const done = (ls: { matches: any[] }[]) => ls.length > 0 && ls.every((l) => l.matches.length > 0 && l.matches.every((m: any) => m.completed));
  const d1Done = done(d1 as any), d2Done = done(v5.d2 as any);
  const gf = knockoutMatches.find((m) => m.completed && /grand final/i.test(m.roundName));
  const grandChamp = gf?.winnerId || null, grandRunner = gf ? (gf.winnerId === gf.idolAId ? gf.idolBId : gf.idolAId) : null;
  const d2Count = v5.d2.reduce((a, l) => a + l.memberIds.length, 0);

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
    E.advanceBracket(next);
    if (JSON.stringify(next) === originalMatches) { setMsg('No Crown Cup bracket changes to save.'); return; }
    const byeIds = ['cc_usf_a', 'cc_usf_b'].flatMap((id) => {
      const match = next.find((m) => m.id === id);
      return match && 'id' in match.a && match.a.id ? [match.a.id] : [];
    });
    commit({ champsCup: { matches: next, byeIds } });
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
    E.advanceBracket(next);
    commit({ champsCup: { ...crownCup, matches: next } });
  };
  const refreshLC = (s: E.LeagueCupState) => { if (s.rounds.length === s.plan.rounds && s.rounds[s.rounds.length - 1].every((m) => m.completed)) s.championId = s.rounds[s.rounds.length - 1][0].winnerId; return s; };
  const buildLC = () => {
    try {
      if (!d1Done || !d2Done) { setMsg('Open Arena Cup can be built after every Division 1 and Division 2 league has completed all matches.'); return; }
      const order = E.leagueCupOrder(d1 as any, v5.d2), leagueOf: Record<string, number> = {};
      [...d1, ...v5.d2].forEach((l) => l.memberIds.forEach((i) => { leagueOf[i] = l.id; }));
      if (order.length < 2 || order.length % 2 !== 0) { setMsg(`Open Arena Cup needs an even number of qualified idols. Current total: ${order.length}.`); return; }
      const next = E.createLeagueCup(order, leagueOf, d2Count); E.stepLeagueCup(next);
      if (!next.rounds.length) { setMsg('Open Arena Cup could not create its first round. Check the completed league standings.'); return; }
      commit({ leagueCup: next }); setMsg('Open Arena Cup bracket created.');
    } catch (error) { setMsg(error instanceof Error ? `Open Arena Cup build failed: ${error.message}` : 'Open Arena Cup build failed. Check league standings and try again.'); }
  };
  const lcRound = () => { if (!v5.leagueCup) return; const s = clone(v5.leagueCup); const cur = s.rounds[s.rounds.length - 1]; cur.filter((m) => !m.completed).forEach((m) => E.playNode(m, by)); refreshLC(s); if (!s.championId) E.stepLeagueCup(s); commit({ leagueCup: s }); };
  const lcAll = async () => {
    if (!v5.leagueCup || simulatingOpenCup) return;
    setSimulatingOpenCup(true);
    try {
      const s = clone(v5.leagueCup);
      for (let round = 0; round < 20 && !s.championId; round++) {
        if (!E.stepLeagueCup(s)) break;
        const current = s.rounds[s.rounds.length - 1];
        for (let i = 0; i < current.length; i += 8) {
          current.slice(i, i + 8).forEach((match) => {
            if (!match.completed && match.idolAId && match.idolBId) E.playNode(match, by);
          });
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
        refreshLC(s);
        commit({ leagueCup: clone(s) });
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    } catch (error) {
      setMsg(error instanceof Error ? 'Open Arena Cup simulation failed: ' + error.message : 'Open Arena Cup simulation failed.');
    } finally {
      setSimulatingOpenCup(false);
    }
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
  const buildSuperA = () => { if (!theIdolsChampionId || !grandChamp) { setMsg('Super Cup A needs The Idols champion and the Unzure Cup champion.'); return; } commit({ superA: E.buildSuperCup('sc_a', theIdolsChampionId, grandChamp, grandRunner) }); };
  const buildSuperB = () => {
    const ms = d1.flatMap((l) => { const mini = champOf(v5.miniCups[l.id], `mc${l.id}_final`); if (!mini) return []; const r = rankStandings(l.standings); return [E.buildSuperCup(`sc_b${l.id}`, r[0].idolId, mini, r[1]?.idolId || null)]; });
    if (ms.length === 0) { setMsg('Finish at least one Mini Cup first.'); return; } commit({ superB: ms });
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
                <Btn onClick={() => { const next = clone(crownCup.matches); E.simulateBracket(next, by); commit({ champsCup: { ...crownCup, matches: next } }); }} disabled={!v5.champsCup || crownPlayableCount === 0} className="border-slate-700 bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">Simulate All Matches</Btn>
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
          <CrownCupBracket idols={by} nm={nm} sim={simOne} save={manual} ms={crownCup.matches} onChange={(matches) => commit({ champsCup: { ...crownCup, matches } })} />
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

      {section === 'open' && (<Card title={names.leagueCup} note="Every idol of every league. Division 2 starts in round 1. Stronger Division 1 idols (league position, then points) skip rounds. Best of 5, final Best of 7.">
        <div className="flex flex-wrap gap-2 mb-2">
          <Btn onClick={buildLC} disabled={!!lc}>Build bracket</Btn>
          <Btn onClick={lcRound} disabled={!lc || !!lc.championId}>Simulate current round</Btn>
          <Btn onClick={lcAll} disabled={!lc || !!lc.championId || simulatingOpenCup}>{simulatingOpenCup ? 'Simulating...' : 'Simulate all'}</Btn>
          <Btn onClick={() => { if (lc && window.confirm("Reset this tournament bracket and remove all match results?")) commit({ leagueCup: null }); }} disabled={!lc} className="bg-rose-400">Reset Bracket</Btn>
        </div>
        {lc && <p className="text-xs mb-2 font-mono">{lc.order.length} idols · {lc.plan.rounds} rounds · entering per round: {lc.plan.entrants.join(' / ')}{lc.championId ? ` · Champion: ${nm(lc.championId)}` : ''}</p>}
        {lc && <OpenArenaMatchList matches={lc.rounds.flat()} idols={by} nm={nm} onSave={(id, a, b) => {
          const next = clone(lc);
          const roundIndex = next.rounds.findIndex((round) => round.some((match) => match.id === id));
          if (roundIndex < 0) return 'Match not found in Open Arena Cup.';
          const error = manual(next.rounds.flat(), id, a, b);
          if (error) return error;
          // Later Open Arena rounds are generated from the previous round's winners,
          // so editing an earlier round must remove and regenerate the entire later path.
          next.rounds = next.rounds.slice(0, roundIndex + 1);
          next.championId = null;
          if (next.rounds[roundIndex].every((match) => match.completed)) E.stepLeagueCup(next);
          commit({ leagueCup: refreshLC(next) });
          return null;
        }} />}
        {lcMatches.length > 0 && <span className="sr-only">{lcMatches.length} matches</span>}
      </Card> )}

      {section === 'spotlight' && (<Card title={names.miniCup} note="Top 16 of each Division 1 final table, seeded 1 vs 16. Single elimination. Best of 5, final Best of 7.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {d1.map((l) => { const ms = v5.miniCups[l.id]; const played = ms?.filter((m) => m.completed).length || 0; const total = ms?.length || l.memberIds.length * 15; const selected = (selectedSpotlightLeague || d1[0]?.id) === l.id; const complete = !!ms?.some((m) => m.id.endsWith('_final') && m.completed); return (
            <button key={l.id} type="button" onClick={() => setSelectedSpotlightLeague(l.id)} className={`relative flex min-h-[82px] flex-col justify-between overflow-hidden rounded-2xl border-2 p-3 text-left transition-all ${selected ? 'border-amber-400 bg-[#22160d] shadow-lg ring-2 ring-amber-400/30' : 'border-black bg-[#16100b] text-slate-400 hover:bg-[#1c140e]'}`}>
              <div className="mb-1.5 flex items-center justify-between"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color || '#d97706' }} /><span className="font-mono text-[10px] font-bold text-amber-400/80">{played}/{total}</span></div>
              <div><div className={`truncate text-xs font-black uppercase tracking-wide ${selected ? 'text-white' : 'text-slate-300'}`}>{l.name}</div><div className="truncate text-[10px] font-bold text-amber-400/60">Division 1 · Top 16</div></div>
              {complete && <span className="absolute right-1 top-1 text-[10px] font-black text-emerald-400">CHAMP</span>}
            </button>); })}
        </div>
        {d1.filter((l) => l.id === (selectedSpotlightLeague || d1[0]?.id)).map((l) => { const ms = v5.miniCups[l.id]; const champ = champOf(ms, `mc${l.id}_final`); return (
          <div key={l.id} className="mt-4 rounded-2xl border-2 border-black bg-[#160f0a] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-amber-200">{l.name}</h3><p className="text-[11px] text-amber-100/50">Spotlight Cup · Top 16 · Single elimination · Best of 5, final Best of 7</p></div>{champ && <span className="text-xs font-black text-emerald-400">Champion: {nm(champ)}</span>}</div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Btn onClick={() => buildMini(l.id)} disabled={!!ms}>Build</Btn>
              <Btn onClick={() => { const next = clone(ms); E.simulateBracket(next, by); commit({ miniCups: { ...v5.miniCups, [l.id]: next } }); }} disabled={!ms || !!champ}>Simulate all</Btn>
              <Btn onClick={() => { if (ms && window.confirm(`Reset the ${l.name} Spotlight Cup bracket and remove all results?`)) { const next = { ...v5.miniCups }; delete next[l.id]; commit({ miniCups: next }); } }} disabled={!ms} className="bg-rose-400">Reset Bracket</Btn>
            </div>
            {ms ? <Bracket nm={nm} idols={by} sim={simOne} save={manual} ms={ms} onChange={(next) => commit({ miniCups: { ...v5.miniCups, [l.id]: next } })} /> : <p className="text-xs text-amber-100/50">Build the bracket after the league season finishes.</p>}
          </div>); })}
      </Card> )}

      {section === 'super' && (<Card title="Super Cups" note={`${names.superCupA}: The Idols champion vs Unzure Cup champion. ${names.superCupB}: league champion vs ${names.miniCup} champion. If one idol wins both, the opponent is the runner-up. Best of 5.`}>
        <div className="flex gap-2 mb-2"><Btn onClick={buildSuperA} disabled={!!v5.superA}>Build {names.superCupA}</Btn><Btn onClick={buildSuperB} disabled={v5.superB.length > 0}>Build {names.superCupB}</Btn>
          <Btn onClick={() => { const a = v5.superA ? clone(v5.superA) : null; if (a) E.playNode(a, by); const b = clone(v5.superB); b.forEach((m) => { if (!m.completed) E.playNode(m, by); }); commit({ superA: a, superB: b }); }} disabled={!v5.superA && v5.superB.length === 0}>Simulate all</Btn>
          <Btn onClick={() => { if ((v5.superA || v5.superB.length) && window.confirm("Reset all Super Cup matches and results?")) commit({ superA: null, superB: [] }); }} disabled={!v5.superA && v5.superB.length === 0} className="bg-rose-400">Reset Competitions</Btn></div>
        {v5.superA && <div><div className="text-xs font-black text-amber-300">{names.superCupA}</div><Bracket nm={nm} sim={simOne} save={manual} ms={[v5.superA]} onChange={(ms) => commit({ superA: ms[0] })} /></div>}
        {v5.superB.length > 0 && <div><div className="text-xs font-black text-amber-300 mt-2">{names.superCupB}</div><Bracket nm={nm} sim={simOne} save={manual} ms={v5.superB} onChange={(ms) => commit({ superB: ms })} /></div>}
      </Card> )}
    </div>
  );
};
