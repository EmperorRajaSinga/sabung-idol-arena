import React, { useMemo, useState } from 'react';
import type { Idol, GirlGroup, LeagueSeasonState, KnockoutMatch } from '../types';
import { loadV5State, saveV5State, V5State } from '../utils/v5/store';
import { loadNames, saveNames, CompetitionNames } from '../utils/v5/names';
import * as E from '../utils/v5/engine';
import { rankStandings } from '../utils/swissLogic';
import { getIdolRating } from '../utils/ratingHelper';
import { TournamentBracketTree } from './TournamentBracketTree';
import { MatchModal } from './MatchModal';

interface Props {
  idols: Idol[]; girlGroups: GirlGroup[]; leagueState: LeagueSeasonState | null; section?: 'all' | 'crown' | 'super' | 'open' | 'spotlight';
  v5State: V5State; onUpdateV5State: (s: V5State) => void;
  onUpdateLeagueState: (s: LeagueSeasonState) => void; theIdolsChampionId: string | null; knockoutMatches: KnockoutMatch[];
}
const NAME_LABELS: Record<keyof CompetitionNames, string> = { division2: 'Division 2', champsCup: 'League champions cup (double elimination)', leagueCup: 'All-league knockout cup', miniCup: 'Top 16 mini cup', superCupA: 'Super Cup A (The Idols vs Unzure Cup)', superCupB: 'Super Cup B (league vs mini cup)' };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
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
  const idolA = m.idolAId ? idols.get(m.idolAId) : null;
  const idolB = m.idolBId ? idols.get(m.idolBId) : null;
  const ready = !!idolA && !!idolB;
  const targetWins = m.bestOf === 7 ? 4 : 3;
  const renderCompetitor = (idol: Idol | null, id: string | null, score: number | null, isWinner: boolean) => (
    <div className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 transition-all ${
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
        ? 'border-emerald-900/80 bg-[#19140f]'
        : ready
          ? 'border-amber-700/70 bg-[#21170f] hover:border-amber-500/80'
          : 'border-black bg-[#17110c]'
    }`}>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-amber-900/70 pb-2">
        <span className="truncate font-poster-title text-xs font-black uppercase tracking-wider text-amber-300">{m.roundName}</span>
        <span className="shrink-0 rounded-lg border border-black bg-black/60 px-2 py-1 text-[10px] font-black text-amber-100">BO{m.bestOf} · FT {targetWins}</span>
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
          <Btn onClick={onSim} className="px-4 py-2 text-xs">Simulate</Btn>
          <label className="flex items-center gap-1 rounded-lg border border-black bg-black/35 px-2 py-1">
            <span className="text-[9px] font-black text-amber-200/60">A</span>
            <input value={a} onChange={(e) => setA(e.target.value)} className="w-9 bg-transparent text-center font-mono text-sm font-black text-white outline-none" inputMode="numeric" aria-label="Score A" placeholder="-" />
          </label>
          <label className="flex items-center gap-1 rounded-lg border border-black bg-black/35 px-2 py-1">
            <span className="text-[9px] font-black text-amber-200/60">B</span>
            <input value={b} onChange={(e) => setB(e.target.value)} className="w-9 bg-transparent text-center font-mono text-sm font-black text-white outline-none" inputMode="numeric" aria-label="Score B" placeholder="-" />
          </label>
          <Btn onClick={() => { const result = onSave(Number(a), Number(b)); setErr(result || ''); }} className="ml-auto px-4 py-2 text-xs">Save Result</Btn>
          {err && <span className="w-full text-[11px] font-bold text-rose-400">{err}</span>}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-black/70 bg-black/25 px-3 py-2 text-[11px] font-bold italic text-amber-100/40">Waiting for previous round</div>
      )}

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
    {selectedMatch && <MatchModal isOpen onClose={() => setSelectedMatch(null)} idolA={selectedMatch.idolAId ? idols.get(selectedMatch.idolAId) || null : null} idolB={selectedMatch.idolBId ? idols.get(selectedMatch.idolBId) || null : null} currentScoreA={selectedMatch.scoreA} currentScoreB={selectedMatch.scoreB} matchTitle={selectedMatch.roundName} stageName="Cups & Divisions" isKnockout isCompleted={selectedMatch.completed} onFinish={(a, b) => { const next = clone(ms); const error = save(next, selectedMatch.id, a, b); if (error) { window.alert(error); return; } onChange(next); setSelectedMatch(null); }} />}
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
      <section className="rounded-xl border border-emerald-900/70 bg-[#17130f] p-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/60 pb-3">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-emerald-300">Upper Bracket</h3>
            <p className="mt-1 text-xs font-bold text-amber-100/45">Winners remain in the championship path</p>
          </div>
          <span className="rounded-lg border border-emerald-700/40 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">Winner's path</span>
        </div>
        {renderLane(upperRounds, 'upper')}
      </section>

      <section className="rounded-xl border border-purple-900/70 bg-[#17110f] p-3">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-purple-900/60 pb-3">
          <div>
            <h3 className="text-base font-black uppercase tracking-wider text-purple-300">Lower Bracket</h3>
            <p className="mt-1 text-xs font-bold text-amber-100/45">One more loss means elimination</p>
          </div>
          <span className="rounded-lg border border-purple-700/40 bg-purple-950/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-purple-300">Elimination path</span>
        </div>
        {renderLane(lowerRounds, 'lower')}
      </section>

      {grandFinal && (
        <section className="rounded-xl border border-amber-500/60 bg-gradient-to-br from-[#291a0c] to-[#160d07] p-3 shadow-lg">
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

export const V5CupsPanel: React.FC<Props> = ({ idols, girlGroups, leagueState, section = 'all', v5State, onUpdateV5State, onUpdateLeagueState, theIdolsChampionId, knockoutMatches }) => {
  const v5 = v5State;
  const [names, setNames] = useState<CompetitionNames>(() => loadNames());
  const [msg, setMsg] = useState('');
  const [selectedSpotlightLeague, setSelectedSpotlightLeague] = useState('');
  const [selectedOpenRound, setSelectedOpenRound] = useState('');
  const by = useMemo(() => new Map(idols.map((i) => [i.id, i])), [idols]);
  const nm = (id: string | null) => (id ? by.get(id)?.name || id : 'TBD');
  const d1 = leagueState?.leagues || [];
  const commit = (patch: Partial<V5State>) => { const n = { ...v5, ...patch }; onUpdateV5State(n); if (!saveV5State(n)) setMsg('Storage is full: this change is not saved. Export a backup and clear old data.'); };
  const done = (ls: { matches: any[] }[]) => ls.length > 0 && ls.every((l) => l.matches.length > 0 && l.matches.every((m: any) => m.completed));
  const d1Done = done(d1 as any), d2Done = done(v5.d2 as any);
  const d1Fresh = d1.every((l) => l.matches.every((m: any) => !m.completed));
  const gf = knockoutMatches.find((m) => m.completed && /grand final/i.test(m.roundName));
  const grandChamp = gf?.winnerId || null, grandRunner = gf ? (gf.winnerId === gf.idolAId ? gf.idolBId : gf.idolAId) : null;
  const d2Count = v5.d2.reduce((a, l) => a + l.memberIds.length, 0);

  const simOne = (ms: E.BNode[], id: string) => { E.advanceBracket(ms); const m = ms.find((x) => x.id === id); if (m && !m.completed && m.idolAId && m.idolBId) E.playNode(m, by); E.advanceBracket(ms); };
  const manual = (ms: E.BNode[], id: string, a: number, b: number): string | null => {
    const m = ms.find((x) => x.id === id); if (!m || !m.idolAId || !m.idolBId) return 'Both idols must be known first.';
    const t = m.bestOf === 7 ? 4 : 3; if (Math.max(a, b) !== t || Math.min(a, b) >= t) return `Best of ${m.bestOf} ends when one idol reaches ${t} wins (for example ${t}-0, ${t}-1, ${t}-${t - 1}).`;
    m.scoreA = a; m.scoreB = b; m.winnerId = a > b ? m.idolAId : m.idolBId; m.loserId = a > b ? m.idolBId : m.idolAId; m.completed = true; E.advanceBracket(ms); return null;
  };
  /* ---------- actions */
  const fillD2 = () => commit({ d2: E.autoFillDivisionTwo(d1, v5.d2, idols, girlGroups, v5.perLeague, names.division2) });
  const rebuildD2 = () => { if (v5.d2.some((l) => l.matches.some((m: any) => m.completed))) { setMsg('Division 2 already has results. Finish the season first.'); return; } commit({ d2: v5.d2.map((l) => E.rebuildLeague(l, idols)) }); };
  const simD2 = () => commit({ d2: v5.d2.map((l) => E.simulateLeagueMatches(l, idols)) });
  const lockMoves = () => commit({ pendingMoves: d1.map((l) => E.computePromotionRelegation(l, v5.d2.find((x) => x.parentLeagueId === l.id) || { ...l, memberIds: [], standings: [], matches: [] } as any, v5.promotionCount)) });
  const applyMoves = () => {
    if (!leagueState || !v5.pendingMoves) return;
    const r = E.applyMoves(d1, v5.d2, v5.pendingMoves, idols);
    onUpdateLeagueState({ ...leagueState, leagues: r.d1 as any }); commit({ d2: r.d2, pendingMoves: null }); setMsg('Promotion and relegation applied to the new season rosters.');
  };
  const champions = (): E.ChampionInfo[] => d1.map((l) => { const t = rankStandings(l.standings)[0]; return { idolId: t.idolId, leagueId: l.id, wonGrandCup: t.idolId === grandChamp, wonTheIdols: t.idolId === theIdolsChampionId, points: t.points || 0, gameDiff: t.gameDiff || 0 }; });
  const buildChamps = () => { if (d1.length !== 6) { setMsg('Champs Cup needs exactly 6 leagues.'); return; } commit({ champsCup: E.buildChampsCup(champions()) }); };
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
  const lcAll = () => { if (!v5.leagueCup) return; const s = clone(v5.leagueCup); E.simulateLeagueCup(s, by); commit({ leagueCup: refreshLC(s) }); };
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
  return (
    <div className="w-full min-w-0 max-w-none p-4 text-amber-100 sm:p-6 xl:p-8">
      <h1 className="text-3xl font-black text-amber-300 mb-1">Cups &amp; Divisions</h1>
      <p className="text-sm text-amber-100/60 mb-4">{names.division2}, promotion and relegation, {names.champsCup}, {names.leagueCup}, {names.miniCup} and the Super Cups. Everything runs after the league season.</p>
      {msg && <div role="status" className="mb-4 rounded-xl border-2 border-black bg-black/50 p-3 text-sm text-amber-200">{msg} <button className="underline ml-2" onClick={() => setMsg('')}>close</button></div>}

      {section === 'all' && (<Card title="Competition names" note="Rename anything. Names are saved on this device.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.keys(names) as Array<keyof CompetitionNames>).map((k) => (
            <label key={k} className="text-[11px] font-bold text-amber-100/70">{NAME_LABELS[k]}
              <input value={names[k]} onChange={(e) => { const n = { ...names, [k]: e.target.value }; setNames(n); saveNames(n); }} className="mt-1 w-full rounded-lg border-2 border-black bg-black/50 px-2 py-1 text-sm text-amber-100" />
            </label>
          ))}
        </div>
      </Card> )}

      {(section === 'all') && (<Card title="Promotion and relegation" note={`Bottom ${v5.promotionCount} of each Division 1 league go down. Top ${v5.promotionCount} of its Division 2 go up. Lock the review after all leagues finish, then apply it when the new season has started.`}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Btn onClick={lockMoves} disabled={!d1Done || !d2Done}>Lock review</Btn>
          <Btn onClick={applyMoves} disabled={!v5.pendingMoves || !d1Fresh} title={!d1Fresh ? 'Start the new season first' : ''}>Apply to new season</Btn>
        </div>
        {!d1Done || !d2Done ? <p className="text-xs text-amber-100/60">Waiting for all Division 1 and Division 2 matches to finish.</p> : null}
        {v5.pendingMoves && <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">{v5.pendingMoves.map((mv) => (
          <div key={mv.leagueId} className="rounded-lg border-2 border-black bg-black/30 p-2"><div className="font-black">League {mv.leagueId}</div>
            <div className="text-rose-300">Down: {mv.relegated.map(nm).join(', ') || 'none'}</div><div className="text-emerald-300">Up: {mv.promoted.map(nm).join(', ') || 'none'}</div></div>))}</div>}
      </Card> )}

      {(section === 'all' || section === 'crown') && (<Card title={names.champsCup} note="The 6 league champions, double elimination. Byes: Unzure Cup winner, then The Idols winner, then league points. Best of 5, Lower Final and Grand Final Best of 7.">
        <div className="flex gap-2 mb-2">
          <Btn onClick={buildChamps} disabled={!d1Done || !!v5.champsCup}>Build bracket</Btn>
          <Btn onClick={() => { if (v5.champsCup) { const c = clone(v5.champsCup); E.simulateBracket(c.matches, by); commit({ champsCup: c }); } }} disabled={!v5.champsCup}>Simulate all</Btn>
          <Btn onClick={() => { if (v5.champsCup && window.confirm("Reset the Crown Cup bracket and remove all its match results?")) commit({ champsCup: null }); }} disabled={!v5.champsCup} className="bg-rose-400">Reset Bracket</Btn>
        </div>
        {d1Done && (!grandChamp || !theIdolsChampionId) && <p className="text-xs text-amber-200 mb-2">Unzure Cup or The Idols is not finished yet, so byes would use league points only. Finish them first for the full rule.</p>}
        {v5.champsCup && <><p className="text-xs mb-1">Byes: {v5.champsCup.byeIds.map(nm).join(', ')}</p><CrownCupBracket idols={by} nm={nm} sim={simOne} save={manual} ms={v5.champsCup.matches} onChange={(ms) => commit({ champsCup: { ...v5.champsCup!, matches: ms } })} /></>}
      </Card> )}

      {(section === 'all' || section === 'open') && (<Card title={names.leagueCup} note="Every idol of every league. Division 2 starts in round 1. Stronger Division 1 idols (league position, then points) skip rounds. Best of 5, final Best of 7.">
        <div className="flex flex-wrap gap-2 mb-2">
          <Btn onClick={buildLC} disabled={!!lc}>Build bracket</Btn>
          <Btn onClick={lcRound} disabled={!lc || !!lc.championId}>Simulate current round</Btn>
          <Btn onClick={lcAll} disabled={!lc || !!lc.championId}>Simulate all</Btn>
          <Btn onClick={() => { if (lc && window.confirm("Reset this tournament bracket and remove all match results?")) commit({ leagueCup: null }); }} disabled={!lc} className="bg-rose-400">Reset Bracket</Btn>
        </div>
        {lc && <p className="text-xs mb-2 font-mono">{lc.order.length} idols · {lc.plan.rounds} rounds · entering per round: {lc.plan.entrants.join(' / ')}{lc.championId ? ` · Champion: ${nm(lc.championId)}` : ''}</p>}
        {lc && <OpenArenaMatchList matches={lc.rounds.flat()} idols={by} nm={nm} onSave={(id, a, b) => { const next = clone(lc); const error = manual(next.rounds.flat(), id, a, b); if (error) return error; commit({ leagueCup: refreshLC(next) }); return null; }} />}
        {lcMatches.length > 0 && <span className="sr-only">{lcMatches.length} matches</span>}
      </Card> )}

      {(section === 'all' || section === 'spotlight') && (<Card title={names.miniCup} note="Top 16 of each Division 1 final table, seeded 1 vs 16. Single elimination. Best of 5, final Best of 7.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {d1.map((l) => { const ms = v5.miniCups[l.id]; const played = ms?.filter((m) => m.completed).length || 0; const total = ms?.length || l.memberIds.length * 15; const selected = (selectedSpotlightLeague || d1[0]?.id) === l.id; const complete = !!ms?.some((m) => m.id.endsWith('_final') && m.completed); return (
            <button key={l.id} type="button" onClick={() => setSelectedSpotlightLeague(l.id)} className={`relative flex min-h-[82px] flex-col justify-between overflow-hidden rounded-2xl border-2 p-3 text-left transition-all ${selected ? 'border-amber-400 bg-[#22160d] shadow-lg ring-2 ring-amber-400/30' : 'border-black bg-[#16100b] text-slate-400 hover:bg-[#1c140e]'}`}>
              <div className="mb-1.5 flex items-center justify-between"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color || '#d97706' }} /><span className="font-mono text-[10px] font-bold text-amber-400/80">{played}/{total}</span></div>
              <div><div className={`truncate text-xs font-black uppercase tracking-wide ${selected ? 'text-white' : 'text-slate-300'}`}>{l.name}</div><div className="truncate text-[10px] font-bold text-amber-400/60">Challenger Division</div></div>
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

      {(section === 'all' || section === 'super') && (<Card title="Super Cups" note={`${names.superCupA}: The Idols champion vs Unzure Cup champion. ${names.superCupB}: league champion vs ${names.miniCup} champion. If one idol wins both, the opponent is the runner-up. Best of 5.`}>
        <div className="flex gap-2 mb-2"><Btn onClick={buildSuperA} disabled={!!v5.superA}>Build {names.superCupA}</Btn><Btn onClick={buildSuperB} disabled={v5.superB.length > 0}>Build {names.superCupB}</Btn>
          <Btn onClick={() => { const a = v5.superA ? clone(v5.superA) : null; if (a) E.playNode(a, by); const b = clone(v5.superB); b.forEach((m) => { if (!m.completed) E.playNode(m, by); }); commit({ superA: a, superB: b }); }} disabled={!v5.superA && v5.superB.length === 0}>Simulate all</Btn>
          <Btn onClick={() => { if ((v5.superA || v5.superB.length) && window.confirm("Reset all Super Cup matches and results?")) commit({ superA: null, superB: [] }); }} disabled={!v5.superA && v5.superB.length === 0} className="bg-rose-400">Reset Competitions</Btn></div>
        {v5.superA && <div><div className="text-xs font-black text-amber-300">{names.superCupA}</div><Bracket nm={nm} sim={simOne} save={manual} ms={[v5.superA]} onChange={(ms) => commit({ superA: ms[0] })} /></div>}
        {v5.superB.length > 0 && <div><div className="text-xs font-black text-amber-300 mt-2">{names.superCupB}</div><Bracket nm={nm} sim={simOne} save={manual} ms={v5.superB} onChange={(ms) => commit({ superB: ms })} /></div>}
      </Card> )}
    </div>
  );
};
