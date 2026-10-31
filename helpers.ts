import fs from 'fs';
const store: Record<string,string> = {};
(globalThis as any).localStorage = { getItem:(k:string)=>k in store?store[k]:null, setItem:(k:string,v:string)=>{store[k]=String(v)}, removeItem:(k:string)=>{delete store[k]}, clear:()=>{for(const k in store)delete store[k]}, key:(i:number)=>Object.keys(store)[i]??null, get length(){return Object.keys(store).length} };
(globalThis as any).window = globalThis;
export async function buildSeason(jsonPath: string) {
  const { createDefaultState } = await import('../src/utils/storage');
  const L = await import('../src/utils/leagueLogic');
  const { simulateEntireSeason } = await import('../src/utils/seasonSimulatorLogic');
  const db = JSON.parse(fs.readFileSync(jsonPath,'utf8'));
  const inactiveGroups = new Set(db.girlGroups.filter((g:any)=>g.inactive).map((g:any)=>g.name));
  const idols = db.idols.map((i:any)=>({ ...i, photoUrl:'', inactive: !!(i.inactive || inactiveGroups.has(i.girlGroup)) }));
  const groups = db.girlGroups.map((g:any)=>({ ...g, logoUrl:'' }));
  const active = idols.filter((i:any)=>!i.inactive).sort((a:any,b:any)=>(b.rating??0)-(a.rating??0));
  const pool = active.slice(0,120);
  const buckets: string[][] = [[],[],[],[],[],[]];
  pool.forEach((idol:any, i:number)=>{ const r=Math.floor(i/6); const c=r%2===0? i%6 : 5-(i%6); buckets[c].push(idol.id); });
  const st: any = createDefaultState(); st.idols = idols; st.girlGroups = groups;
  const ls: any = L.initializeLeagueSeason(idols, groups, 1);
  ls.leagues = ls.leagues.map((l:any, k:number)=>{ const memberIds=buckets[k]; const matches=L.generateRoundRobinMatches(l.id, memberIds); const standings=L.calculateLeagueStandings(l.id, memberIds, matches, idols); return { ...l, memberIds, matches, standings }; });
  const summary: any = simulateEntireSeason(st, ls, null);
  return { idols, groups, active, ls, summary, db };
}
