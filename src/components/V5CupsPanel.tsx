import React, { useMemo, useState } from 'react';
import type { Idol, GirlGroup, LeagueSeasonState, KnockoutMatch } from '../types';
import { loadV5State, saveV5State, V5State } from '../utils/v5/store';
import { loadNames, saveNames, CompetitionNames } from '../utils/v5/names';
import * as E from '../utils/v5/engine';
import { rankStandings } from '../utils/swissLogic';

interface Props {
  idols: Idol[]; girlGroups: GirlGroup[]; leagueState: LeagueSeasonState | null;
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

const Row: React.FC<{ m: E.BNode; nm: (id: string | null) => string; onSim: () => void; onSave: (a: number, b: number) => string | null }> = ({ m, nm, onSim, onSave }) => {
  const [a, setA] = useState(''), [b, setB] = useState(''), [err, setErr] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-black/60 py-1.5 text-xs text-amber-100">
      <span className="w-28 text-amber-300/80 font-bold">{m.roundName}</span>
      <span className="min-w-[7rem] font-bold">{nm(m.idolAId)}</span>
      {m.completed ? <span className="font-mono font-black text-amber-300">{m.scoreA} - {m.scoreB}</span> : <span className="font-mono text-amber-100/40">vs</span>}
      <span className="min-w-[7rem] font-bold">{nm(m.idolBId)}</span>
      <span className="rounded border border-black bg-black/40 px-1.5 font-mono text-[10px]">BO{m.bestOf}</span>
      {m.completed ? <span className="text-emerald-400 font-bold">{nm(m.winnerId)} wins</span> : m.idolAId && m.idolBId ? (
        <>
          <Btn onClick={onSim}>Sim</Btn>
          <input value={a} onChange={(e) => setA(e.target.value)} className="w-9 rounded border-2 border-black bg-black/50 px-1 text-center font-mono" inputMode="numeric" aria-label="Score A" />
          <input value={b} onChange={(e) => setB(e.target.value)} className="w-9 rounded border-2 border-black bg-black/50 px-1 text-center font-mono" inputMode="numeric" aria-label="Score B" />
          <Btn onClick={() => { const r = onSave(Number(a), Number(b)); setErr(r || ''); }}>Save</Btn>
          {err && <span className="text-rose-400">{err}</span>}
        </>
      ) : <span className="text-amber-100/40">waiting</span>}
    </div>
  );
};
const Bracket: React.FC<{ ms: E.BNode[]; nm: (id: string | null) => string; sim: (ms: E.BNode[], id: string) => void; save: (ms: E.BNode[], id: string, a: number, b: number) => string | null; onChange: (ms: E.BNode[]) => void }> = ({ ms, nm, sim, save, onChange }) => (
  <div>
    {ms.map((m) => (
      <Row key={m.id} m={m} nm={nm} onSim={() => { const c = clone(ms); sim(c, m.id); onChange(c); }} onSave={(a, b) => { const c = clone(ms); const e = save(c, m.id, a, b); if (!e) onChange(c); return e; }} />
    ))}
  </div>
);

export const V5CupsPanel: React.FC<Props> = ({ idols, girlGroups, leagueState, onUpdateLeagueState, theIdolsChampionId, knockoutMatches }) => {
  const [v5, setV5] = useState<V5State>(() => loadV5State());
  const [names, setNames] = useState<CompetitionNames>(() => loadNames());
  const [msg, setMsg] = useState('');
  const by = useMemo(() => new Map(idols.map((i) => [i.id, i])), [idols]);
  const nm = (id: string | null) => (id ? by.get(id)?.name || id : 'TBD');
  const d1 = leagueState?.leagues || [];
  const commit = (patch: Partial<V5State>) => { const n = { ...v5, ...patch }; setV5(n); if (!saveV5State(n)) setMsg('Storage is full: this change is not saved. Export a backup and clear old data.'); };
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
    const order = E.leagueCupOrder(d1 as any, v5.d2), leagueOf: Record<string, number> = {};
    [...d1, ...v5.d2].forEach((l) => l.memberIds.forEach((i) => { leagueOf[i] = l.id; }));
    const s = E.createLeagueCup(order, leagueOf, d2Count); E.stepLeagueCup(s); commit({ leagueCup: s });
  };
  const lcRound = () => { if (!v5.leagueCup) return; const s = clone(v5.leagueCup); const cur = s.rounds[s.rounds.length - 1]; cur.filter((m) => !m.completed).forEach((m) => E.playNode(m, by)); refreshLC(s); if (!s.championId) E.stepLeagueCup(s); commit({ leagueCup: s }); };
  const lcAll = () => { if (!v5.leagueCup) return; const s = clone(v5.leagueCup); E.simulateLeagueCup(s, by); commit({ leagueCup: refreshLC(s) }); };
  const buildMini = (lid: number) => { const l = d1.find((x) => x.id === lid)!; commit({ miniCups: { ...v5.miniCups, [lid]: E.buildMiniCup(lid, rankStandings(l.standings).slice(0, 16).map((s) => s.idolId)) } }); };
  const champOf = (ms?: E.BNode[], id?: string) => { const f = ms?.find((m) => m.id === id); return f?.completed ? f.winnerId : null; };
  const buildSuperA = () => { if (!theIdolsChampionId || !grandChamp) { setMsg('Super Cup A needs The Idols champion and the Unzure Cup champion.'); return; } commit({ superA: E.buildSuperCup('sc_a', theIdolsChampionId, grandChamp, grandRunner) }); };
  const buildSuperB = () => {
    const ms = d1.flatMap((l) => { const mini = champOf(v5.miniCups[l.id], `mc${l.id}_final`); if (!mini) return []; const r = rankStandings(l.standings); return [E.buildSuperCup(`sc_b${l.id}`, r[0].idolId, mini, r[1]?.idolId || null)]; });
    if (ms.length === 0) { setMsg('Finish at least one Mini Cup first.'); return; } commit({ superB: ms });
  };

  const lc = v5.leagueCup, lcMatches = lc ? lc.rounds.flat() : [];
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto text-amber-100">
      <h1 className="text-3xl font-black text-amber-300 mb-1">Cups &amp; Divisions</h1>
      <p className="text-sm text-amber-100/60 mb-4">{names.division2}, promotion and relegation, {names.champsCup}, {names.leagueCup}, {names.miniCup} and the Super Cups. Everything runs after the league season.</p>
      {msg && <div role="status" className="mb-4 rounded-xl border-2 border-black bg-black/50 p-3 text-sm text-amber-200">{msg} <button className="underline ml-2" onClick={() => setMsg('')}>close</button></div>}

      <Card title="Competition names" note="Rename anything. Names are saved on this device.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.keys(names) as Array<keyof CompetitionNames>).map((k) => (
            <label key={k} className="text-[11px] font-bold text-amber-100/70">{NAME_LABELS[k]}
              <input value={names[k]} onChange={(e) => { const n = { ...names, [k]: e.target.value }; setNames(n); saveNames(n); }} className="mt-1 w-full rounded-lg border-2 border-black bg-black/50 px-2 py-1 text-sm text-amber-100" />
            </label>
          ))}
        </div>
      </Card>

      <Card title={names.division2} note="Each Division 1 league has a Division 2 below it. Idols can be added or activated at any time, then press Auto-fill.">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="text-xs font-bold">Capacity per league
            <input type="number" min={2} max={40} value={v5.perLeague} onChange={(e) => commit({ perLeague: Math.max(2, Number(e.target.value) || 20) })} className="ml-2 w-16 rounded border-2 border-black bg-black/50 px-1 text-center font-mono" /></label>
          <label className="text-xs font-bold">Promotion / relegation
            <input type="number" min={1} max={5} value={v5.promotionCount} onChange={(e) => commit({ promotionCount: Math.max(1, Number(e.target.value) || 3) })} className="ml-2 w-12 rounded border-2 border-black bg-black/50 px-1 text-center font-mono" /></label>
          <Btn onClick={fillD2} disabled={d1.length === 0}>Auto-fill from free idols</Btn>
          <Btn onClick={rebuildD2} disabled={v5.d2.length === 0}>Rebuild fixtures</Btn>
          <Btn onClick={simD2} disabled={v5.d2.length === 0 || d2Done}>Simulate {names.division2}</Btn>
        </div>
        {d1.length === 0 && <p className="text-xs text-rose-300">Set up the Division 1 leagues in League System first.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {v5.d2.map((l) => { const r = rankStandings(l.standings); const total = l.matches.length, played = l.matches.filter((m: any) => m.completed).length; return (
            <div key={l.id} className="rounded-xl border-2 border-black bg-black/30 p-3">
              <div className="font-black text-sm">{l.name}</div>
              <div className="text-[11px] text-amber-100/60 mb-1">{l.memberIds.length} idols · {played}/{total} matches</div>
              <ol className="text-xs">{r.slice(0, Math.min(r.length, 10)).map((s, i) => (
                <li key={s.idolId} className={`flex justify-between ${i < v5.promotionCount && played === total && total > 0 ? 'text-emerald-400 font-bold' : ''}`}><span>{i + 1}. {nm(s.idolId)}</span><span className="font-mono">{s.points}</span></li>))}</ol>
            </div>); })}
        </div>
      </Card>

      <Card title="Promotion and relegation" note={`Bottom ${v5.promotionCount} of each Division 1 league go down. Top ${v5.promotionCount} of its Division 2 go up. Lock the review after all leagues finish, then apply it when the new season has started.`}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Btn onClick={lockMoves} disabled={!d1Done || !d2Done}>Lock review</Btn>
          <Btn onClick={applyMoves} disabled={!v5.pendingMoves || !d1Fresh} title={!d1Fresh ? 'Start the new season first' : ''}>Apply to new season</Btn>
        </div>
        {!d1Done || !d2Done ? <p className="text-xs text-amber-100/60">Waiting for all Division 1 and Division 2 matches to finish.</p> : null}
        {v5.pendingMoves && <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">{v5.pendingMoves.map((mv) => (
          <div key={mv.leagueId} className="rounded-lg border-2 border-black bg-black/30 p-2"><div className="font-black">League {mv.leagueId}</div>
            <div className="text-rose-300">Down: {mv.relegated.map(nm).join(', ') || 'none'}</div><div className="text-emerald-300">Up: {mv.promoted.map(nm).join(', ') || 'none'}</div></div>))}</div>}
      </Card>

      <Card title={names.champsCup} note="The 6 league champions, double elimination. Byes: Unzure Cup winner, then The Idols winner, then league points. Best of 5, Lower Final and Grand Final Best of 7.">
        <div className="flex gap-2 mb-2">
          <Btn onClick={buildChamps} disabled={!d1Done || !!v5.champsCup}>Build bracket</Btn>
          <Btn onClick={() => { if (v5.champsCup) { const c = clone(v5.champsCup); E.simulateBracket(c.matches, by); commit({ champsCup: c }); } }} disabled={!v5.champsCup}>Simulate all</Btn>
          <Btn onClick={() => commit({ champsCup: null })} disabled={!v5.champsCup} className="bg-rose-400">Reset</Btn>
        </div>
        {d1Done && (!grandChamp || !theIdolsChampionId) && <p className="text-xs text-amber-200 mb-2">Unzure Cup or The Idols is not finished yet, so byes would use league points only. Finish them first for the full rule.</p>}
        {v5.champsCup && <><p className="text-xs mb-1">Byes: {v5.champsCup.byeIds.map(nm).join(', ')}</p><Bracket nm={nm} sim={simOne} save={manual} ms={v5.champsCup.matches} onChange={(ms) => commit({ champsCup: { ...v5.champsCup!, matches: ms } })} /></>}
      </Card>

      <Card title={names.leagueCup} note="Every idol of every league. Division 2 starts in round 1. Stronger Division 1 idols (league position, then points) skip rounds. Best of 5, final Best of 7.">
        <div className="flex flex-wrap gap-2 mb-2">
          <Btn onClick={buildLC} disabled={!d1Done || !d2Done || !!lc}>Build bracket</Btn>
          <Btn onClick={lcRound} disabled={!lc || !!lc.championId}>Simulate current round</Btn>
          <Btn onClick={lcAll} disabled={!lc || !!lc.championId}>Simulate all</Btn>
          <Btn onClick={() => commit({ leagueCup: null })} disabled={!lc} className="bg-rose-400">Reset</Btn>
        </div>
        {lc && <p className="text-xs mb-2 font-mono">{lc.order.length} idols · {lc.plan.rounds} rounds · entering per round: {lc.plan.entrants.join(' / ')}{lc.championId ? ` · Champion: ${nm(lc.championId)}` : ''}</p>}
        {lc && lc.rounds.map((r, i) => (
          <details key={i} open={i === lc.rounds.length - 1} className="mb-2"><summary className="cursor-pointer text-sm font-black text-amber-300">{r[0]?.roundName} · {r.filter((m) => m.completed).length}/{r.length} played</summary>
            <Bracket nm={nm} sim={simOne} save={manual} ms={r} onChange={(ms) => { const s = clone(lc); s.rounds[i] = ms; commit({ leagueCup: refreshLC(s) }); }} /></details>))}
        {lcMatches.length > 0 && <span className="sr-only">{lcMatches.length} matches</span>}
      </Card>

      <Card title={names.miniCup} note="Top 16 of each Division 1 final table, seeded 1 vs 16. Single elimination. Best of 5, final Best of 7.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {d1.map((l) => { const ms = v5.miniCups[l.id]; const champ = champOf(ms, `mc${l.id}_final`); return (
            <div key={l.id} className="rounded-xl border-2 border-black bg-black/30 p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1"><span className="font-black text-sm">{l.name}</span>
                <Btn onClick={() => buildMini(l.id)} disabled={!!ms || l.memberIds.length < 16 || !l.matches.every((m: any) => m.completed)}>Build</Btn>
                <Btn onClick={() => { const c = clone(ms); E.simulateBracket(c, by); commit({ miniCups: { ...v5.miniCups, [l.id]: c } }); }} disabled={!ms || !!champ}>Simulate all</Btn>
                {champ && <span className="text-xs text-emerald-400 font-bold">Champion: {nm(champ)}</span>}</div>
              {ms && <details><summary className="cursor-pointer text-xs text-amber-300">Show bracket</summary><Bracket nm={nm} sim={simOne} save={manual} ms={ms} onChange={(n) => commit({ miniCups: { ...v5.miniCups, [l.id]: n } })} /></details>}
            </div>); })}
        </div>
      </Card>

      <Card title="Super Cups" note={`${names.superCupA}: The Idols champion vs Unzure Cup champion. ${names.superCupB}: league champion vs ${names.miniCup} champion. If one idol wins both, the opponent is the runner-up. Best of 5.`}>
        <div className="flex gap-2 mb-2"><Btn onClick={buildSuperA} disabled={!!v5.superA}>Build {names.superCupA}</Btn><Btn onClick={buildSuperB} disabled={v5.superB.length > 0}>Build {names.superCupB}</Btn>
          <Btn onClick={() => { const a = v5.superA ? clone(v5.superA) : null; if (a) E.playNode(a, by); const b = clone(v5.superB); b.forEach((m) => { if (!m.completed) E.playNode(m, by); }); commit({ superA: a, superB: b }); }} disabled={!v5.superA && v5.superB.length === 0}>Simulate all</Btn></div>
        {v5.superA && <div><div className="text-xs font-black text-amber-300">{names.superCupA}</div><Bracket nm={nm} sim={simOne} save={manual} ms={[v5.superA]} onChange={(ms) => commit({ superA: ms[0] })} /></div>}
        {v5.superB.length > 0 && <div><div className="text-xs font-black text-amber-300 mt-2">{names.superCupB}</div><Bracket nm={nm} sim={simOne} save={manual} ms={v5.superB} onChange={(ms) => commit({ superB: ms })} /></div>}
      </Card>
    </div>
  );
};
