import React, { useMemo, useState } from 'react';
import type { Idol, GirlGroup, LeagueMatch } from '../types';
import type { V5State } from '../utils/v5/store';
import { calculateLeagueStandings } from '../utils/leagueLogic';
import { simulateLeagueMatch } from '../utils/leagueLogic';
import { MatchModal } from './MatchModal';
import { Download, FastForward, RotateCcw, Trophy, CalendarDays } from 'lucide-react';

interface Props { idols: Idol[]; girlGroups: GirlGroup[]; v5State: V5State; onUpdateV5State: (s: V5State) => void; favoriteIdolIds?: string[]; }
export const DivisionTwoLeaguePanel: React.FC<Props> = ({ idols, girlGroups, v5State, onUpdateV5State, favoriteIdolIds = [] }) => {
  const [activeId, setActiveId] = useState<number>(v5State.d2[0]?.id || 101);
  const [matchday, setMatchday] = useState(1);
  const [selected, setSelected] = useState<LeagueMatch | null>(null);
  const byId = useMemo(() => new Map(idols.map(i => [i.id, i])), [idols]);
  const league = v5State.d2.find(l => l.id === activeId) || v5State.d2[0];
  const updateLeague = (next: typeof league) => { if (!next) return; onUpdateV5State({ ...v5State, d2: v5State.d2.map(l => l.id === next.id ? next : l) }); };
  const matches = league?.matches || [];
  const days = Math.max(1, ...matches.map(m => m.matchday || 1));
  const fixtures = matches.filter(m => m.matchday === matchday);
  const standings = league?.standings || [];
  const favoriteSet = useMemo(() => new Set(favoriteIdolIds), [favoriteIdolIds]);
  const skippedFavorites = matches.filter(m => !m.completed && (favoriteSet.has(m.idolAId) || favoriteSet.has(m.idolBId))).length;
  const completedCount = matches.filter(m => m.completed).length;
  const champion = league?.isCompleted && standings.length ? standings[0] : null;
  const formFor = (id: string) => standings.find(s => s.idolId === id)?.form || [];
  const saveScore = (m: LeagueMatch, a: number, b: number) => {
    if (!league || a < 0 || b < 0 || !Number.isFinite(a) || !Number.isFinite(b)) return;
    const updated = matches.map(x => x.id === m.id ? { ...x, scoreA:a, scoreB:b, winnerId:a === b ? null : (a > b ? x.idolAId : x.idolBId), completed:true, updatedAt:new Date().toISOString() } : x);
    updateLeague({ ...league, matches:updated, standings:calculateLeagueStandings(league.id, league.memberIds, updated, idols), isCompleted:updated.every(x=>x.completed), championId:updated.every(x=>x.completed) ? calculateLeagueStandings(league.id, league.memberIds, updated, idols)[0]?.idolId : undefined, championName:updated.every(x=>x.completed) ? calculateLeagueStandings(league.id, league.memberIds, updated, idols)[0]?.idolName : undefined });
    setSelected(null);
  };
  const simulate = (list: LeagueMatch[]) => {
    if (!league) return;
    const updated = matches.map(m => {
      if (m.completed || !list.some(x=>x.id===m.id) || favoriteSet.has(m.idolAId) || favoriteSet.has(m.idolBId)) return m;
      const a=byId.get(m.idolAId), b=byId.get(m.idolBId);
      if (!a || !b) return m;
      const r=simulateLeagueMatch(a,b,[],[]);
      return { ...m, scoreA:r.scoreA, scoreB:r.scoreB, winnerId:r.winnerId, completed:true, updatedAt:new Date().toISOString() };
    });
    updateLeague({ ...league, matches:updated, standings:calculateLeagueStandings(league.id, league.memberIds, updated, idols), isCompleted:updated.every(x=>x.completed) });
  };
  const reset = () => { if (!league || !window.confirm('Reset all Division 2 match results for this league?')) return; const updated=matches.map(m=>({...m,scoreA:null,scoreB:null,winnerId:null,completed:false})); updateLeague({...league,matches:updated,standings:calculateLeagueStandings(league.id,league.memberIds,updated,idols),isCompleted:false,championId:undefined,championName:undefined}); };
  const download = () => {
    if (!league) return;
    const rows=[['Rank','Idol','Group','Played','Wins','Draws','Losses','Points','GF','GA','GD'],...standings.map((s,i)=>[i+1,s.idolName,s.girlGroup,s.played,s.wins,s.draws,s.losses,s.points,s.gamesFor,s.gamesAgainst,s.gameDiff])];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a'); a.href=url; a.download=(league.name||'division-2').replace(/[^a-z0-9]+/gi,'-')+'-standings.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6 text-amber-100">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-black bg-gradient-to-r from-[#24170f] to-[#120d09] p-5">
      <div className="flex items-center gap-3"><Trophy className="h-9 w-9 text-amber-400"/><div><h1 className="text-2xl font-black text-amber-300">DIVISION 2 LEAGUE SYSTEM</h1><p className="text-xs text-amber-100/60">All six second-tier leagues, fixtures, standings and match controls</p></div></div>
      <div className="flex flex-wrap gap-2"><button onClick={()=>simulate(matches)} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-black"><FastForward className="mr-1 inline h-4 w-4"/>Simulate League</button><button onClick={download} disabled={!league} className="rounded-xl border border-emerald-500/40 bg-emerald-900/50 px-3 py-2 text-xs font-bold"><Download className="mr-1 inline h-4 w-4"/>Download Standings CSV</button><button onClick={reset} disabled={!league} className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs font-bold"><RotateCcw className="mr-1 inline h-4 w-4"/>Reset Results</button></div>
    </header>
    {!v5State.d2.length ? <div className="rounded-2xl border border-amber-500/30 bg-black/30 p-8 text-center"><p className="font-bold">Division 2 leagues have not been generated.</p><p className="mt-2 text-sm text-amber-100/60">Open Cups & Divisions and use Auto-fill from free idols.</p></div> : <>
      <nav className="flex flex-wrap gap-2">{v5State.d2.map(l=><button key={l.id} onClick={()=>{setActiveId(l.id);setMatchday(1);}} className={`rounded-xl border px-4 py-2 text-xs font-black ${league?.id===l.id?'border-amber-400 bg-amber-500 text-black':'border-slate-700 bg-slate-900 text-amber-200'}`}>{l.name}</button>)}</nav>
      {league && <>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-xl border border-slate-700 bg-slate-900 p-3"><div className="text-xs text-slate-400">Roster</div><b>{league.memberIds.length} idols</b></div><div className="rounded-xl border border-slate-700 bg-slate-900 p-3"><div className="text-xs text-slate-400">Matches</div><b>{completedCount}/{matches.length}</b></div><div className="rounded-xl border border-slate-700 bg-slate-900 p-3"><div className="text-xs text-slate-400">Matchdays</div><b>{days}</b></div><div className="rounded-xl border border-slate-700 bg-slate-900 p-3"><div className="text-xs text-slate-400">Champion</div><b>{league.championId ? byId.get(league.championId)?.name || league.championName || 'TBD' : champion?.idolName || 'Pending'}</b></div></section>
        <section className="overflow-hidden rounded-2xl border-2 border-black bg-[#18110c]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 p-4"><h2 className="font-black text-amber-300">LEAGUE STANDINGS</h2><span className="text-xs text-slate-400">{league.name}</span></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-black/40 text-amber-300"><tr>{['#','Idol','P','W','D','L','GF','GA','GD','PTS','FORM'].map(x=><th key={x} className="px-3 py-2">{x}</th>)}</tr></thead><tbody>{standings.map((s,i)=><tr key={s.idolId} className="border-t border-slate-800"><td className="px-3 py-2 font-black">{i+1}</td><td className="px-3 py-2"><div className="font-bold">{s.idolName}</div><div className="text-[10px] text-slate-500">{s.girlGroup} · {s.seed}</div></td>{[s.played,s.wins,s.draws,s.losses,s.gamesFor,s.gamesAgainst,s.gameDiff,s.points].map((v,j)=><td key={j} className="px-3 py-2 font-mono">{v}</td>)}<td className="px-3 py-2"><div className="flex gap-1">{(s.form||[]).slice(-5).map((f,j)=><span key={j} className={'rounded px-1 py-0.5 text-[9px] font-black '+(f==='W'?'bg-emerald-900 text-emerald-300':f==='D'?'bg-slate-700 text-slate-200':'bg-rose-950 text-rose-300')}>{f}</span>)}</div></td></tr>)}</tbody></table></div></section>
        <section className="rounded-2xl border-2 border-black bg-[#18110c] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-amber-300">MATCHDAY FIXTURES</h2><p className="mt-1 text-[10px] text-slate-500">{skippedFavorites} unplayed matches involve your favorites and are excluded from simulation.</p></div><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4"/><select value={matchday} onChange={e=>setMatchday(Number(e.target.value))} className="rounded-lg border border-slate-700 bg-black px-3 py-2 text-xs">{Array.from({length:days},(_,i)=><option key={i+1} value={i+1}>Matchday {i+1}</option>)}</select><button onClick={()=>simulate(fixtures)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-black">Simulate Matchday</button></div></div>
          <div className="space-y-2">{fixtures.map(m=><button key={m.id} onClick={()=>setSelected(m)} className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-slate-700 bg-black/30 p-3 text-left text-xs hover:border-amber-400"><span className="font-bold">{byId.get(m.idolAId)?.name||m.idolAId}</span><span className="font-mono font-black text-amber-300">{m.completed?`${m.scoreA} - ${m.scoreB}`:'VS'}</span><span className="text-right font-bold">{byId.get(m.idolBId)?.name||m.idolBId}</span></button>)}{!fixtures.length&&<p className="text-xs text-slate-400">No fixtures for this matchday.</p>}</div>
        </section>
      </>}
    </>}
    {selected && <MatchModal isOpen={!!selected} onClose={()=>setSelected(null)} idolA={byId.get(selected.idolAId)||null} idolB={byId.get(selected.idolBId)||null} currentScoreA={selected.scoreA} currentScoreB={selected.scoreB} matchTitle={`${league?.name} - Matchday ${selected.matchday}`} stageName="Division 2 League Match" isCompleted={selected.completed} favoriteIdolIds={favoriteIdolIds} formHistoryA={formFor(selected.idolAId)} formHistoryB={formFor(selected.idolBId)} onFinish={(a,b)=>saveScore(selected,a,b)}/>}
  </div>;
};
