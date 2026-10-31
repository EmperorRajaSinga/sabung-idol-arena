import React from 'react';
import { AppState } from '../utils/storage';
import { createCup, createSingleElimination, simulateCup, CupSystemState } from '../utils/cupSystem';

interface Props { appState: AppState; onUpdateAppState: (updater: (prev: AppState) => AppState) => void; }
export const CupCompetitionsPanel: React.FC<Props> = ({ appState, onUpdateAppState }) => {
  const season = appState.config.seasonNumber || 1;
  const cups = appState.cupSystem?.competitions || [];
  const divisions = appState.divisionSystem?.divisions || [];
  const idols = appState.idols;
  const idolById = new Map(idols.map(i => [i.id, i]));
  const champions = divisions.filter(d => d.tier === 1 && d.championId).map(d => d.championId as string);
  const activeIds = idols.filter(i => !i.inactive).map(i => i.id);
  const save = (next: CupSystemState) => onUpdateAppState(prev => ({ ...prev, cupSystem: next }));
  const makeCup = (type: 'champs_cup'|'grand_cup'|'mini_cup', name: string, ids: string[], leagueId?: number) => {
    if (ids.length < 2) return;
    const base = createCup(type, name, ids, season, leagueId);
    const ready = createSingleElimination(base, type === 'champs_cup' ? 7 : 5);
    save({ schemaVersion: 1, seasonNumber: season, competitions: [...cups.filter(c => c.id !== base.id), ready] });
  };
  const simulate = (id: string) => {
    const cup = cups.find(c => c.id === id); if (!cup) return;
    const ratings = Object.fromEntries(idols.map(i => [i.id, i.rating ?? 60]));
    save({ schemaVersion: 1, seasonNumber: season, competitions: cups.map(c => c.id === id ? simulateCup(c, ratings) : c) });
  };
  return <div className="p-6 space-y-6">
    <div><h1 className="text-2xl font-bold">Cup Competitions</h1><p className="text-sm text-gray-500 mt-1">Kelola turnamen piala berdasarkan hasil division musim ini.</p></div>
    <section className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Champs Cup</h2>
      <p className="text-sm text-gray-500">Peserta: juara D1 dari setiap liga. Diperlukan enam juara yang sudah tercatat.</p>
      <p className="text-sm">{champions.length}/6 champions tersedia</p>
      <button className="px-4 py-2 rounded bg-black text-white disabled:opacity-40" disabled={champions.length !== 6} onClick={() => makeCup('champs_cup','Champs Cup',champions)}>Generate draw</button>
    </section>
    <section className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Grand Cup</h2>
      <p className="text-sm text-gray-500">Turnamen terbuka untuk seluruh idol aktif yang terdaftar.</p>
      <p className="text-sm">{activeIds.length} active idols</p>
      <button className="px-4 py-2 rounded bg-black text-white" onClick={() => makeCup('grand_cup','Grand Cup',activeIds)}>Generate tournament</button>
    </section>
    <section className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Mini Cups</h2>
      <p className="text-sm text-gray-500">16 peserta per liga. Mengambil peringkat teratas D1, lalu melengkapi dari D2.</p>
      <div className="flex flex-wrap gap-2">{Array.from({length:6},(_,i)=>i+1).map(id => {
        const d1=divisions.find(d=>d.leagueId===id&&d.tier===1);
        const d2=divisions.find(d=>d.leagueId===id&&d.tier===2);
        const ranked=[...(d1?.standings||[]),...(d2?.standings||[])].map(s=>s.idolId).slice(0,16);
        return <button key={id} className="px-3 py-2 border rounded" disabled={ranked.length<2} onClick={()=>makeCup('mini_cup',`Mini Cup League ${id}`,ranked,id)}>League {id}</button>;
      })}</div>
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Generated tournaments</h2>
      {cups.length===0&&<p className="text-sm text-gray-500">Belum ada turnamen dibuat.</p>}
      {cups.map(cup=><article key={cup.id} className="border rounded-lg p-4 space-y-2">
        <div className="flex justify-between gap-3"><div><h3 className="font-semibold">{cup.name}</h3><p className="text-xs text-gray-500">{cup.participantIds.length} participants · {cup.status}</p></div><button className="px-3 py-2 bg-black text-white rounded" onClick={()=>simulate(cup.id)}>Simulate remaining matches</button></div>
        <div className="text-sm space-y-1">{cup.matches.map(m=><p key={m.id}>{m.round}: {idolById.get(m.idolAId||'')?.name||'BYE'} {m.completed?m.scoreA+' - '+m.scoreB:'vs'} {idolById.get(m.idolBId||'')?.name||'BYE'} {m.winnerId?' · Winner: '+(idolById.get(m.winnerId)?.name||'') : ''}</p>)}</div>
        {cup.championId&&<p className="font-semibold">Champion: {idolById.get(cup.championId)?.name}</p>}
      </article>)}
    </section>
  </div>;
};
