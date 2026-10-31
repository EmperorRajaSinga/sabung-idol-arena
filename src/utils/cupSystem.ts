import { Idol } from '../types';
import { DivisionSystemState } from './divisionSystem';
export type CupMatch={id:string;round:string;idolAId:string;idolBId:string;scoreA:number;scoreB:number;winnerId:string;completed:true};
export type CupCompetition={id:string;name:string;format:string;entrants:string[];matches:CupMatch[];championId?:string;runnerUpId?:string};
export type CupSystemState={seasonNumber:number;generatedAt:string;champsCup?:CupCompetition;grandCup?:CupCompetition;miniCups:CupCompetition[];superCups:CupCompetition[]};
const rating=(id:string,idols:Idol[])=>Math.max(1,Math.min(100,idols.find(x=>x.id===id)?.rating??60));
const series=(a:string,b:string,idols:Idol[],bestOf:number,key:string,round:string):CupMatch=>{
 let wa=0,wb=0;const target=Math.ceil(bestOf/2);
 while(wa<target&&wb<target){const sa=rating(a,idols)+Math.random()*18-9;const sb=rating(b,idols)+Math.random()*18-9;if(sa>=sb)wa++;else wb++;}
 return{id:key,round,idolAId:a,idolBId:b,scoreA:wa,scoreB:wb,winnerId:wa>wb?a:b,completed:true};
};
const shuffled=<T,>(values:T[])=>{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
function knockout(name:string,id:string,entrants:string[],idols:Idol[],bestOf=5):CupCompetition{
 let players=shuffled([...new Set(entrants)]);const matches:CupMatch[]=[];let round=1;
 while(players.length>1){const next:string[]=[];if(players.length%2)next.push(players.pop()!);for(let i=0;i<players.length;i+=2){const m=series(players[i],players[i+1],idols,bestOf,id+'-'+round+'-'+i,'Round '+round);matches.push(m);next.push(m.winnerId);}players=next;round++;}
 const final=matches[matches.length-1];return{id,name,format:'Single elimination',entrants,matches,championId:players[0],runnerUpId:final?(final.winnerId===final.idolAId?final.idolBId:final.idolAId):undefined};
}
function doubleEliminationSix(entrants:string[],idols:Idol[]):CupCompetition{
 const p=shuffled([...entrants]);const matches:CupMatch[]=[];let n=0;
 const play=(a:string,b:string,round:string,bestOf=5)=>{const m=series(a,b,idols,bestOf,'champs-'+(++n),round);matches.push(m);return{win:m.winnerId,lose:m.winnerId===a?b:a};};
 const u1=play(p[2],p[5],'Upper Round 1'),u2=play(p[3],p[4],'Upper Round 1');
 const u3=play(p[0],u2.win,'Upper Semi Final'),u4=play(p[1],u1.win,'Upper Semi Final');
 const l1=play(u1.lose,u2.lose,'Lower Round 1');
 const l2=play(l1.win,u3.lose,'Lower Round 2');
 const l3=play(l2.win,u4.lose,'Lower Round 2');
 const uf=play(u3.win,u4.win,'Upper Final');
 const lf=play(l3.win,uf.lose,'Lower Final',7);
 let gf=play(uf.win,lf.win,'Grand Final',7);if(gf.win===lf.win)gf=play(uf.win,lf.win,'Grand Final Reset',7);
 return{id:'champs-cup',name:'Champs Cup',format:'Six-team double elimination · BO5 / BO7 finals',entrants,matches,championId:gf.win,runnerUpId:gf.win===uf.win?lf.win:uf.win};
}
export function simulateCupSeason(idols:Idol[],divisions:DivisionSystemState,seasonNumber:number,theIdolsChampionId?:string):CupSystemState{
 const active=idols.filter(x=>!x.inactive);
 const champs=divisions.divisions.filter(x=>x.tier===1).sort((a,b)=>a.leagueId-b.leagueId).map(x=>x.championId||x.standings[0]?.idolId).filter((x):x is string=>Boolean(x));
 const champsCup=champs.length===6?doubleEliminationSix(champs,active):undefined;
 const grandCup=knockout('Grand Cup','grand-cup',active.map(x=>x.id),active,5);
 const miniCups=Array.from({length:6},(_,i)=>{const roster=divisions.divisions.filter(x=>x.leagueId===i+1).flatMap(x=>x.memberIds);const selected=roster.map(id=>active.find(x=>x.id===id)).filter((x):x is Idol=>Boolean(x)).sort((a,b)=>rating(b.id,active)-rating(a.id,active)).slice(0,16).map(x=>x.id);return knockout('League '+(i+1)+' Mini Cup','mini-cup-'+(i+1),selected,active,5);});
 const superCups:CupCompetition[]=[];
 if(theIdolsChampionId&&grandCup.championId&&theIdolsChampionId!==grandCup.championId){const m=series(theIdolsChampionId,grandCup.championId,active,7,'super-cup-idols-grand','Grand Super Cup');superCups.push({id:m.id,name:'The Idols Super Cup',format:'Single match · BO7',entrants:[theIdolsChampionId,grandCup.championId],matches:[m],championId:m.winnerId,runnerUpId:m.winnerId===theIdolsChampionId?grandCup.championId:theIdolsChampionId});}
 miniCups.forEach((mini,i)=>{const champ=divisions.divisions.find(x=>x.leagueId===i+1&&x.tier===1)?.championId;if(!champ||!mini.championId||champ===mini.championId)return;const m=series(champ,mini.championId,active,7,'super-cup-league-'+(i+1),'League Super Cup');superCups.push({id:m.id,name:'League '+(i+1)+' Super Cup',format:'Single match · BO7',entrants:[champ,mini.championId],matches:[m],championId:m.winnerId,runnerUpId:m.winnerId===champ?mini.championId:champ});});
 return{seasonNumber,generatedAt:new Date().toISOString(),champsCup,grandCup,miniCups,superCups};
}