import React, { useState, useMemo } from 'react';
import type { V5TitleArchive } from '../utils/v5/store';
import { CareerV5StatsPanel } from './CareerV5StatsPanel';
import {
  CareerStat,
  LeagueSeasonState,
  LeagueSeasonArchive,
  Idol,
  LeagueStanding,
  ArchivedMatch,
  TournamentArchive,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsStanding,
  LeagueCareerStat,
  TheIdolsCareerStat,
} from '../types';
import { BarChart3, Search, Crown, Trophy, Flame, Shield, TrendingUp, Medal, ExternalLink, Sparkles, Star } from 'lucide-react';
import { getCountryFlag } from '../utils/nationalityHelper';
import {
  loadCareerOverrides,
  applyOverridesToCareerStats,
  applyOverridesToLeagueCareerStats,
  applyOverridesToTheIdolsCareerStats,
  calculateUnifiedTotalTitles,
} from '../utils/databaseStudioLogic';

interface CareerStatsPanelProps {
  careerStats: CareerStat[];
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  idols?: Idol[];
  matchDatabase?: ArchivedMatch[];
  archives?: TournamentArchive[];
  v5TitleArchives?: V5TitleArchive[];
  onSelectIdolProfile?: (idolId: string) => void;
}

export interface CombinedCareerStat {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  photoUrl: string;
  totalCompetitions: number;
  tournamentsPlayed: number;
  leagueSeasonsPlayed: number;
  theIdolsPlayed: number;
  totalTitles: number;
  tournamentTitles: number;
  v5CupTitles: number;
  divisionTwoTitles: number;
  divisionTitles: number;
  theIdolsSuperleagueTitles: number; // 1st place in regular season
  theIdolsMastersTitles: number; // 1st in Masters Playoff
  theIdolsTitles: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winRate: number;
  podiums: number;
}

export const CareerStatsPanel: React.FC<CareerStatsPanelProps> = ({
  careerStats,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  idols = [],
  matchDatabase = [],
  archives = [],
  v5TitleArchives = [],
  onSelectIdolProfile,
}) => {
  const [activeSystem, setActiveSystem] = useState<'combined' | 'tournament' | 'league' | 'the_idols' | 'crown_cup' | 'open_arena_cup' | 'spotlight_cup' | 'super_cup_a' | 'super_cup_b' | 'division_2'>('combined');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<keyof CareerStat>('championships');
  const [leagueSortBy, setLeagueSortBy] = useState<keyof LeagueCareerStat>('points');
  const [theIdolsSortBy, setTheIdolsSortBy] = useState<keyof TheIdolsCareerStat>('mastersTitles');
  const [combinedSortBy, setCombinedSortBy] = useState<keyof CombinedCareerStat>('totalTitles');

  const v5SectionCounts = useMemo(() => {
    const counts = { crown_cup: 0, open_arena_cup: 0, spotlight_cup: 0, super_cup_a: 0, super_cup_b: 0, division_2: 0 };
    (Array.isArray(matchDatabase) ? matchDatabase : []).forEach((match) => {
      const stage = String(match?.stage || '').toLowerCase();
      if (!stage.startsWith('cups & divisions:')) return;
      if (stage.includes('division 2')) counts.division_2 += 1;
      else if (stage.includes('league champions cup')) counts.crown_cup += 1;
      else if (stage.includes('all-league knockout cup')) counts.open_arena_cup += 1;
      else if (stage.includes('top 16 mini cup')) counts.spotlight_cup += 1;
      else if (stage.includes('super cup a')) counts.super_cup_a += 1;
      else if (stage.includes('super cup b')) counts.super_cup_b += 1;
    });
    return counts;
  }, [matchDatabase]);

  const careerOverrides = useMemo(() => loadCareerOverrides(), []);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  const safeCareerStats = useMemo(() => {
    return applyOverridesToCareerStats(careerStats || [], careerOverrides);
  }, [careerStats, careerOverrides]);

  const sortedStats = [...safeCareerStats]
    .filter(
      (s) =>
        String(s.idolName || '').toLowerCase().includes(search.toLowerCase()) ||
        String(s.girlGroup || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return valB - valA;
      }
      return 0;
    });

  // Calculate League Career Stats
  const leagueCareerStats: LeagueCareerStat[] = useMemo(() => {
    const statMap = new Map<string, LeagueCareerStat>();

    const getOrInit = (id: string): LeagueCareerStat => {
      if (!statMap.has(id)) {
        const idol = idolsMap.get(id);
        statMap.set(id, {
          idolId: id,
          idolName: idol?.name || 'Unknown',
          girlGroup: idol?.girlGroup || '',
          nationality: idol?.nationality || 'South Korea',
          photoUrl: idol?.photoUrl || '',
          seasonsPlayed: 0,
          divisionTitles: 0,
          podiums: 0,
          championsQualifiers: 0,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          winRate: 0,
        });
      }
      return statMap.get(id)!;
    };

    // Helper to process active season leagues
    if (leagueState && Array.isArray(leagueState.leagues)) {
      leagueState.leagues.forEach((league) => {
        const isFinished = Boolean(league.isCompleted);

        (league.standings || []).forEach((entry) => {
          const st = getOrInit(entry.idolId);
          const played = entry.played || 0;

          if (played > 0) {
            st.seasonsPlayed += 1;
          }

          st.matches += played;
          st.wins += entry.wins || 0;
          st.draws += entry.draws || 0;
          st.losses += entry.losses || 0;
          st.points += entry.points || 0;
          st.goalsFor += entry.gamesFor || 0;
          st.goalsAgainst += entry.gamesAgainst || 0;
          st.goalDiff += entry.gameDiff || 0;

          // CRITICAL: Only count titles, podiums, and qualification berths if the season has concluded!
          if (isFinished && played > 0) {
            if (entry.rank === 1) {
              st.divisionTitles += 1;
            }
            if (entry.rank <= 3) {
              st.podiums += 1;
            }
            if (entry.rank <= 5) {
              st.championsQualifiers += 1;
            }
          }
        });
      });
    }

    // Process archives
    (leagueArchives || []).forEach((arch) => {
      let processedStandings = false;
      const titlesAwardedInArchive = new Set<string>();

      if (arch && arch.allStandings && Object.keys(arch.allStandings).length > 0) {
        processedStandings = true;
        Object.entries(arch.allStandings).forEach(([, standingsList]) => {
          const list = (standingsList as LeagueStanding[]) || [];
          list.forEach((entry) => {
            const st = getOrInit(entry.idolId);
            const played = entry.played || 0;

            st.seasonsPlayed += 1;
            st.matches += played;
            st.wins += entry.wins || 0;
            st.draws += entry.draws || 0;
            st.losses += entry.losses || 0;
            st.points += entry.points || 0;
            st.goalsFor += entry.gamesFor || 0;
            st.goalsAgainst += entry.gamesAgainst || 0;
            st.goalDiff += entry.gameDiff || 0;

            if (entry.rank === 1 && played > 0) {
              st.divisionTitles += 1;
              titlesAwardedInArchive.add(entry.idolId);
            }
            if (entry.rank <= 3 && played > 0) {
              st.podiums += 1;
            }
            if (entry.rank <= 5 && played > 0) {
              st.championsQualifiers += 1;
            }
          });
        });
      }

      // Check arch.leagueWinners (fallback for archives without full standings records)
      const winners = arch.leagueWinners || (arch as any).leagueChampions || [];
      if (Array.isArray(winners)) {
        winners.forEach((w: any) => {
          const champId = w.championId || w.idolId;
          if (champId && !titlesAwardedInArchive.has(champId)) {
            const st = getOrInit(champId);
            if (!processedStandings) {
              st.divisionTitles += 1;
              st.podiums += 1;
              st.championsQualifiers += 1;
              titlesAwardedInArchive.add(champId);
            }
          }
        });
      }
    });

    const rawStats = Array.from(statMap.values()).map((st) => ({
      ...st,
      winRate: st.matches > 0 ? Math.round((st.wins / st.matches) * 100) : 0,
    }));
    return applyOverridesToLeagueCareerStats(rawStats, careerOverrides);
  }, [leagueState, leagueArchives, idolsMap, careerOverrides]);

  const sortedLeagueStats = useMemo(() => {
    return [...leagueCareerStats]
      .filter(
        (s) =>
          String(s.idolName || '').toLowerCase().includes(search.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const valA = a[leagueSortBy];
        const valB = b[leagueSortBy];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return valB - valA;
        }
        return 0;
      });
  }, [leagueCareerStats, search, leagueSortBy]);

  // Calculate The Idols Superleague Career Stats
  const theIdolsCareerStats: TheIdolsCareerStat[] = useMemo(() => {
    const statMap = new Map<string, TheIdolsCareerStat>();

    const getOrInit = (id: string): TheIdolsCareerStat => {
      if (!statMap.has(id)) {
        const idol = idolsMap.get(id);
        statMap.set(id, {
          idolId: id,
          idolName: idol?.name || 'Unknown Idol',
          girlGroup: idol?.girlGroup || '',
          nationality: idol?.nationality || 'South Korea',
          photoUrl: idol?.photoUrl || '',
          seasonsPlayed: 0,
          mastersTitles: 0,
          mastersRunnerUps: 0,
          mastersPodiums: 0,
          superleagueTitles: 0,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          winRate: 0,
          playoffMatches: 0,
          playoffWins: 0,
          playoffLosses: 0,
        });
      }
      return statMap.get(id)!;
    };

    // 1. Process active The Idols Season
    if (theIdolsState && Array.isArray(theIdolsState.standings)) {
      const isLeagueFinished = Boolean(theIdolsState.isLeagueCompleted);
      const isPlayoffFinished = Boolean(theIdolsState.isPlayoffCompleted);

      theIdolsState.standings.forEach((entry) => {
        const st = getOrInit(entry.idolId);
        const played = entry.played || 0;
        if (played > 0) {
          st.seasonsPlayed += 1;
        }
        st.matches += played;
        st.wins += entry.wins || 0;
        st.draws += entry.draws || 0;
        st.losses += entry.losses || 0;
        st.points += entry.points || 0;
        st.goalsFor += entry.gamesFor || 0;
        st.goalsAgainst += entry.gamesAgainst || 0;
        st.goalDiff += entry.gameDiff || 0;

        if (isLeagueFinished && entry.rank === 1 && played > 0) {
          st.superleagueTitles += 1;
        }
      });

      // Active Playoff matches
      if (Array.isArray(theIdolsState.playoffMatches)) {
        theIdolsState.playoffMatches.forEach((m) => {
          if (!m.completed) return;
          if (m.idolAId) {
            const stA = getOrInit(m.idolAId);
            stA.playoffMatches += 1;
            if (m.winnerId === m.idolAId) stA.playoffWins += 1;
            else stA.playoffLosses += 1;
          }
          if (m.idolBId) {
            const stB = getOrInit(m.idolBId);
            stB.playoffMatches += 1;
            if (m.winnerId === m.idolBId) stB.playoffWins += 1;
            else stB.playoffLosses += 1;
          }
        });
      }

      if (isPlayoffFinished) {
        if (theIdolsState.championId) {
          const champ = getOrInit(theIdolsState.championId);
          champ.mastersTitles += 1;
          champ.mastersPodiums += 1;
        }
        if (theIdolsState.runnerUpId) {
          const r = getOrInit(theIdolsState.runnerUpId);
          r.mastersRunnerUps += 1;
          r.mastersPodiums += 1;
        }
        if (theIdolsState.thirdPlaceId) {
          const t = getOrInit(theIdolsState.thirdPlaceId);
          t.mastersPodiums += 1;
        }
      }
    }

    // 2. Process The Idols Archives
    (theIdolsArchives || []).forEach((arch) => {
      if (!arch) return;
      (arch.standings || []).forEach((entry) => {
        const st = getOrInit(entry.idolId);
        const played = entry.played || 0;
        st.seasonsPlayed += 1;
        st.matches += played;
        st.wins += entry.wins || 0;
        st.draws += entry.draws || 0;
        st.losses += entry.losses || 0;
        st.points += entry.points || 0;
        st.goalsFor += entry.gamesFor || 0;
        st.goalsAgainst += entry.gamesAgainst || 0;
        st.goalDiff += entry.gameDiff || 0;

        if (entry.rank === 1 && played > 0) {
          st.superleagueTitles += 1;
        }
      });

      // Playoff honours
      if (arch.championId) {
        const champ = getOrInit(arch.championId);
        champ.mastersTitles += 1;
        champ.mastersPodiums += 1;
      }
      if (arch.runnerUpId) {
        const r = getOrInit(arch.runnerUpId);
        r.mastersRunnerUps += 1;
        r.mastersPodiums += 1;
      }
      if (arch.thirdPlaceId) {
        const t = getOrInit(arch.thirdPlaceId);
        t.mastersPodiums += 1;
      }

      (arch.playoffMatches || []).forEach((m) => {
        if (!m.completed) return;
        if (m.idolAId) {
          const stA = getOrInit(m.idolAId);
          stA.playoffMatches += 1;
          if (m.winnerId === m.idolAId) stA.playoffWins += 1;
          else stA.playoffLosses += 1;
        }
        if (m.idolBId) {
          const stB = getOrInit(m.idolBId);
          stB.playoffMatches += 1;
          if (m.winnerId === m.idolBId) stB.playoffWins += 1;
          else stB.playoffLosses += 1;
        }
      });
    });

    const rawStats = Array.from(statMap.values()).map((st) => ({
      ...st,
      winRate: st.matches > 0 ? Math.round((st.wins / st.matches) * 100) : 0,
    }));
    return applyOverridesToTheIdolsCareerStats(rawStats, careerOverrides);
  }, [theIdolsState, theIdolsArchives, idolsMap, careerOverrides]);

  const sortedTheIdolsStats = useMemo(() => {
    return [...theIdolsCareerStats]
      .filter(
        (s) =>
          String(s.idolName || '').toLowerCase().includes(search.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const valA = a[theIdolsSortBy];
        const valB = b[theIdolsSortBy];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return valB - valA;
        }
        return 0;
      });
  }, [theIdolsCareerStats, search, theIdolsSortBy]);

  // Calculate Combined Career Stats
  const combinedCareerStats: CombinedCareerStat[] = useMemo(() => {
    const allIdolIds = new Set<string>();
    careerStats.forEach((s) => allIdolIds.add(s.idolId));
    leagueCareerStats.forEach((s) => allIdolIds.add(s.idolId));
    theIdolsCareerStats.forEach((s) => allIdolIds.add(s.idolId));
    idols.forEach((i) => allIdolIds.add(i.id));

    const tourneyMap = new Map<string, CareerStat>();
    careerStats.forEach((s) => tourneyMap.set(s.idolId, s));

    const leagueMap = new Map<string, LeagueCareerStat>();
    leagueCareerStats.forEach((s) => leagueMap.set(s.idolId, s));

    const theIdolsMap = new Map<string, TheIdolsCareerStat>();
    theIdolsCareerStats.forEach((s) => theIdolsMap.set(s.idolId, s));

    const list: CombinedCareerStat[] = [];

    allIdolIds.forEach((id) => {
      const idol = idolsMap.get(id);
      const t = tourneyMap.get(id);
      const l = leagueMap.get(id);
      const ti = theIdolsMap.get(id);

      const name = idol?.name || t?.idolName || l?.idolName || ti?.idolName || 'Unknown Idol';
      const girlGroup = idol?.girlGroup || t?.girlGroup || l?.girlGroup || ti?.girlGroup || 'Solo';
      const nationality = idol?.nationality || t?.nationality || l?.nationality || ti?.nationality || 'South Korea';
      const photoUrl = idol?.photoUrl || t?.photoUrl || l?.photoUrl || ti?.photoUrl || '';

      const tPart = t?.participations || 0;
      const lSeasons = l?.seasonsPlayed || 0;
      const tiSeasons = ti?.seasonsPlayed || 0;
      const idolV5Matches = (matchDatabase || []).filter((match) =>
        String(match.stage || '').toLowerCase().startsWith('cups & divisions:') &&
        (match.idolAId === id || match.idolBId === id)
      );
      const v5CompetitionCount = new Set(idolV5Matches.map((match) =>
        `${Number(match.seasonId || 1)}::${String(match.stage || '').split(' / ')[0]}`
      )).size;
      const totalCompetitions = tPart + lSeasons + tiSeasons + v5CompetitionCount;

      const tChamps = t?.championships || 0;
      const lDivTitles = l?.divisionTitles || 0;
      const tiSuperleague = ti?.superleagueTitles || 0;
      const tiMasters = ti?.mastersTitles || 0;
      const v5CupTitles = v5TitleArchives.filter((title) => !title.isDivision && title.winnerId === id).length;
      const divisionTwoTitles = v5TitleArchives.filter((title) => title.isDivision && title.winnerId === id).length;
      const totalTitles = calculateUnifiedTotalTitles(tChamps, lDivTitles, tiSuperleague, tiMasters) + v5CupTitles + divisionTwoTitles;

      const tMatches = t?.matches || 0;
      const lMatches = l?.matches || 0;
      const tiMatches = (ti?.matches || 0) + (ti?.playoffMatches || 0);
      const matches = tMatches + lMatches + tiMatches + idolV5Matches.length;

      const tWins = t?.wins || 0;
      const lWins = l?.wins || 0;
      const tiWins = (ti?.wins || 0) + (ti?.playoffWins || 0);
      const v5Wins = idolV5Matches.filter((match) => match.winnerId === id).length;
      const wins = tWins + lWins + tiWins + v5Wins;

      const tDraws = t?.draws || 0;
      const lDraws = l?.draws || 0;
      const tiDraws = ti?.draws || 0;
      const v5Draws = idolV5Matches.filter((match) => match.isDraw || match.winnerId === 'DRAW' || Number(match.scoreA) === Number(match.scoreB)).length;
      const draws = tDraws + lDraws + tiDraws + v5Draws;

      const tLosses = t?.losses || 0;
      const lLosses = l?.losses || 0;
      const tiLosses = (ti?.losses || 0) + (ti?.playoffLosses || 0);
      const v5Losses = idolV5Matches.length - v5Wins - v5Draws;
      const losses = tLosses + lLosses + tiLosses + v5Losses;

      const tPoints = tWins * 3 + tDraws * 1;
      const lPoints = l?.points || 0;
      const tiPoints = (ti?.points || 0) + (ti?.playoffWins || 0) * 3;
      const v5Points = idolV5Matches.reduce((sum, match) => {
        if (!String(match.stage || '').toLowerCase().includes('division 2')) return sum;
        const isDraw = Boolean(match.isDraw || match.winnerId === 'DRAW' || Number(match.scoreA) === Number(match.scoreB));
        return sum + (isDraw ? 1 : match.winnerId === id ? 3 : 0);
      }, 0);
      const points = tPoints + lPoints + tiPoints + v5Points;

      const tGF = t?.gamesFor || 0;
      const lGF = l?.goalsFor || 0;
      const tiGF = ti?.goalsFor || 0;
      const v5GF = idolV5Matches.reduce((sum, match) => sum + Number(match.idolAId === id ? match.scoreA || 0 : match.scoreB || 0), 0);
      const goalsFor = tGF + lGF + tiGF + v5GF;

      const tGA = t?.gamesAgainst || 0;
      const lGA = l?.goalsAgainst || 0;
      const tiGA = ti?.goalsAgainst || 0;
      const v5GA = idolV5Matches.reduce((sum, match) => sum + Number(match.idolAId === id ? match.scoreB || 0 : match.scoreA || 0), 0);
      const goalsAgainst = tGA + lGA + tiGA + v5GA;

      const goalDiff = (t?.gameDiff || 0) + (l?.goalDiff || 0) + (ti?.goalDiff || 0) + v5GF - v5GA;
      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
      const v5Podiums = v5TitleArchives.filter((title) => title.winnerId === id || title.runnerUpId === id).length;
      const podiums = v5Podiums +
        (t?.championships || 0) +
        (t?.runnerUps || 0) +
        (t?.thirdPlaces || 0) +
        (l?.podiums || 0) +
        (ti?.mastersPodiums || 0);

      if (matches > 0 || totalCompetitions > 0 || totalTitles > 0) {
        list.push({
          idolId: id,
          idolName: name,
          girlGroup,
          nationality,
          photoUrl,
          totalCompetitions,
          tournamentsPlayed: tPart,
          leagueSeasonsPlayed: lSeasons,
          theIdolsPlayed: tiSeasons,
          totalTitles,
          tournamentTitles: tChamps,
          v5CupTitles,
          divisionTwoTitles,
          divisionTitles: lDivTitles,
          theIdolsSuperleagueTitles: tiSuperleague,
          theIdolsMastersTitles: tiMasters,
          theIdolsTitles: tiSuperleague + tiMasters,
          matches,
          wins,
          draws,
          losses,
          points,
          goalsFor,
          goalsAgainst,
          goalDiff,
          winRate,
          podiums,
        });
      }
    });

    return list;
  }, [careerStats, leagueCareerStats, theIdolsCareerStats, idols, idolsMap, v5TitleArchives, matchDatabase]);

  const sortedCombinedStats = useMemo(() => {
    return [...combinedCareerStats]
      .filter(
        (s) =>
          String(s.idolName || '').toLowerCase().includes(search.toLowerCase()) ||
          String(s.girlGroup || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const valA = a[combinedSortBy];
        const valB = b[combinedSortBy];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return valB - valA;
        }
        return 0;
      });
  }, [combinedCareerStats, search, combinedSortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2 font-poster-title">
            <BarChart3 className="h-6 w-6 text-amber-400" />
            <span>Career Statistics Leaderboard</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive all-time statistics across Tournament Cups, 6-Tier Leagues, and The Idols Superleague.
          </p>
        </div>

        {/* System Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-900 border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveSystem('combined')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSystem === 'combined'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Combined ({combinedCareerStats.length})</span>
          </button>
          <button
            onClick={() => setActiveSystem('tournament')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSystem === 'tournament'
                ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Tournament ({careerStats.length})</span>
          </button>
          <button
            onClick={() => setActiveSystem('league')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSystem === 'league'
                ? 'bg-teal-500 text-slate-950 font-black shadow-lg shadow-teal-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>League Pyramid ({leagueCareerStats.length})</span>
          </button>
          <button onClick={() => setActiveSystem('crown_cup') } className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSystem === 'crown_cup' ? 'bg-amber-500 text-slate-950 font-black shadow-lg' : 'text-amber-300 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>Crown Cup ({v5SectionCounts.crown_cup})</span>
          </button>
          <button onClick={() => setActiveSystem('open_arena_cup') } className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSystem === 'open_arena_cup' ? 'bg-amber-500 text-slate-950 font-black shadow-lg' : 'text-amber-300 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>Open Arena Cup ({v5SectionCounts.open_arena_cup})</span>
          </button>
          <button onClick={() => setActiveSystem('spotlight_cup') } className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSystem === 'spotlight_cup' ? 'bg-amber-500 text-slate-950 font-black shadow-lg' : 'text-amber-300 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>Spotlight Cup ({v5SectionCounts.spotlight_cup})</span>
          </button>
          <button onClick={() => setActiveSystem('super_cup_a') } className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSystem === 'super_cup_a' ? 'bg-amber-500 text-slate-950 font-black shadow-lg' : 'text-amber-300 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>Super Cup A ({v5SectionCounts.super_cup_a})</span>
          </button>
          <button onClick={() => setActiveSystem('super_cup_b') } className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSystem === 'super_cup_b' ? 'bg-amber-500 text-slate-950 font-black shadow-lg' : 'text-amber-300 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>Super Cup B ({v5SectionCounts.super_cup_b})</span>
          </button>
          <button onClick={() => setActiveSystem('division_2') } className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeSystem === 'division_2' ? 'bg-amber-500 text-slate-950 font-black shadow-lg' : 'text-amber-300 hover:text-white'}`}>
            <Trophy className="w-3.5 h-3.5" /><span>Division 2 ({v5SectionCounts.division_2})</span>
          </button>
          <button
            onClick={() => setActiveSystem('the_idols')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSystem === 'the_idols'
                ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white font-black shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Idols ({theIdolsCareerStats.length})</span>
          </button>
        </div>
      </div>

      {(['crown_cup', 'open_arena_cup', 'spotlight_cup', 'super_cup_a', 'super_cup_b', 'division_2'] as const).includes(activeSystem as any) && (
        <CareerV5StatsPanel
          section={{
            crown_cup: 'Crown Cup',
            open_arena_cup: 'Open Arena Cup',
            spotlight_cup: 'Spotlight Cup',
            super_cup_a: 'Super Cup A',
            super_cup_b: 'Super Cup B',
            division_2: 'Division 2',
          }[activeSystem as 'crown_cup' | 'open_arena_cup' | 'spotlight_cup' | 'super_cup_a' | 'super_cup_b' | 'division_2']}
          matchDatabase={matchDatabase}
          idols={idols}
        />
      )}

      {!(['crown_cup', 'open_arena_cup', 'spotlight_cup', 'super_cup_a', 'super_cup_b', 'division_2'] as string[]).includes(activeSystem) && <>
      {/* Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search idol or group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {activeSystem === 'combined' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase">Sort By:</label>
            <select
              value={combinedSortBy}
              onChange={(e) => setCombinedSortBy(e.target.value as keyof CombinedCareerStat)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="totalTitles">Total Titles (Tournament + Cups + Divisions + Masters)</option>
              <option value="points">Total Combined Points</option>
              <option value="wins">Total Wins</option>
              <option value="winRate">Win Rate (%)</option>
              <option value="matches">Matches Played</option>
              <option value="goalDiff">Total Score Difference</option>
              <option value="totalCompetitions">Competitions Played</option>
              <option value="tournamentTitles">Tournament Championships</option>
              <option value="v5CupTitles">V5 Cup Titles</option>
              <option value="divisionTwoTitles">Division 2 Titles</option>
              <option value="divisionTitles">League Division Titles</option>
              <option value="theIdolsSuperleagueTitles">The Idols Superleague Titles (1st)</option>
              <option value="theIdolsMastersTitles">The Idols Masters Titles (Playoffs)</option>
              <option value="podiums">Podium Honors</option>
            </select>
          </div>
        ) : activeSystem === 'tournament' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase">Sort By:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as keyof CareerStat)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="championships">Championships</option>
              <option value="top4">Top 4 Finishes</option>
              <option value="groupAdvancements">Group Advancements</option>
              <option value="groupExits">Group Stage Exits</option>
              <option value="wins">Total Wins</option>
              <option value="draws">Total Draws</option>
              <option value="winRate">Win Rate (%)</option>
              <option value="matches">Matches Played</option>
              <option value="longestWinStreak">Longest Win Streak</option>
              <option value="gameDiff">Game Difference</option>
            </select>
          </div>
        ) : activeSystem === 'league' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase">Sort By:</label>
            <select
              value={leagueSortBy}
              onChange={(e) => setLeagueSortBy(e.target.value as keyof LeagueCareerStat)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="points">Total Points</option>
              <option value="divisionTitles">Division Titles</option>
              <option value="podiums">Podiums (Top 3)</option>
              <option value="championsQualifiers">Champions Qualifiers (Top 5)</option>
              <option value="wins">Matches Won</option>
              <option value="winRate">Win Rate (%)</option>
              <option value="goalDiff">Score / Goal Difference</option>
              <option value="matches">Matches Played</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-400 uppercase">Sort By:</label>
            <select
              value={theIdolsSortBy}
              onChange={(e) => setTheIdolsSortBy(e.target.value as keyof TheIdolsCareerStat)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="mastersTitles">Masters Playoff Titles</option>
              <option value="superleagueTitles">Superleague Regular Titles (1st)</option>
              <option value="mastersPodiums">Masters Podiums (Top 3)</option>
              <option value="points">Superleague Points</option>
              <option value="wins">Superleague Wins</option>
              <option value="winRate">Win Rate (%)</option>
              <option value="playoffWins">Playoff Series Wins</option>
              <option value="matches">Matches Played</option>
              <option value="goalDiff">Goal Difference</option>
            </select>
          </div>
        )}
      </div>

      {/* VIEW 0: COMBINED CAREER STATS TABLE */}
      {activeSystem === 'combined' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-4 py-3">Idol</th>
                  <th className="px-3 py-3 text-center">Comp.</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-400">Total Titles</th>
                  <th className="px-3 py-3 text-center font-semibold text-yellow-300">Tourney</th>
                  <th className="px-3 py-3 text-center font-semibold text-cyan-300">V5 Cups</th>
                  <th className="px-3 py-3 text-center font-semibold text-sky-300">Div 2</th>
                  <th className="px-3 py-3 text-center font-semibold text-teal-300">Division 1</th>
                  <th className="px-3 py-3 text-center font-semibold text-purple-300">Superleague</th>
                  <th className="px-3 py-3 text-center font-semibold text-amber-300">Masters</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-400">Points</th>
                  <th className="px-3 py-3 text-center">Matches</th>
                  <th className="px-3 py-3 text-center font-bold text-emerald-400">W-D-L</th>
                  <th className="px-3 py-3 text-center font-bold text-indigo-400">Win %</th>
                  <th className="px-3 py-3 text-center font-mono">GF-GA</th>
                  <th className="px-3 py-3 text-center font-mono">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sortedCombinedStats.length > 0 ? (
                  sortedCombinedStats.map((stat, idx) => (
                    <tr
                      key={stat.idolId}
                      onClick={() => onSelectIdolProfile && onSelectIdolProfile(stat.idolId)}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        onSelectIdolProfile ? 'cursor-pointer' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {stat.photoUrl ? (
                            <img
                              src={stat.photoUrl}
                              alt={stat.idolName}
                              className="h-8 w-8 rounded-lg object-cover border border-slate-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-300">
                              {(stat.idolName || 'ID').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm leading-tight">
                                {stat.idolName}
                              </span>
                              {stat.nationality && (
                                <span className="text-xs">
                                  {getCountryFlag(stat.nationality)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {stat.girlGroup}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300 font-semibold">
                        {stat.totalCompetitions}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-amber-400 text-sm">
                        {stat.totalTitles > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/30">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span>{stat.totalTitles}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-yellow-300">
                        {stat.tournamentTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-cyan-300">
                        {stat.v5CupTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-sky-300">
                        {stat.divisionTwoTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-teal-300">
                        {stat.divisionTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-purple-300">
                        {stat.theIdolsSuperleagueTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-300">
                        {stat.theIdolsMastersTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-amber-300 text-sm font-mono">
                        {stat.points} PTS
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300 font-medium">
                        {stat.matches}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400 font-mono">
                        {stat.wins}-{stat.draws}-{stat.losses}
                      </td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-indigo-400">
                        {stat.winRate}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                        {stat.goalsFor}-{stat.goalsAgainst}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-200">
                        {stat.goalDiff > 0 ? `+${stat.goalDiff}` : stat.goalDiff}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={16} className="py-12 text-center text-slate-500">
                      No career statistics found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 1: TOURNAMENT CAREER STATS TABLE */}
      {activeSystem === 'tournament' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-4 py-3">Idol</th>
                  <th className="px-3 py-3 text-center">Part.</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-400">Titles</th>
                  <th className="px-3 py-3 text-center">2nd</th>
                  <th className="px-3 py-3 text-center">3rd</th>
                  <th className="px-3 py-3 text-center">Top 4</th>
                  <th className="px-3 py-3 text-center font-bold text-teal-400">Adv. Group</th>
                  <th className="px-3 py-3 text-center font-bold text-rose-400">Group Exits</th>
                  <th className="px-3 py-3 text-center">Matches</th>
                  <th className="px-3 py-3 text-center font-bold text-emerald-400">W-D-L</th>
                  <th className="px-3 py-3 text-center font-bold text-indigo-400">Win %</th>
                  <th className="px-3 py-3 text-center">Streak</th>
                  <th className="px-3 py-3 text-center">Game Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sortedStats.map((stat, idx) => (
                  <tr key={stat.idolId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {stat.photoUrl ? (
                          <img
                            src={stat.photoUrl}
                            alt={stat.idolName}
                            className="h-8 w-8 rounded-lg object-cover border border-slate-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-300">
                            {(stat.idolName || 'ID').slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <span className="block font-bold text-white text-sm leading-tight">
                            {stat.idolName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {stat.girlGroup} &bull; {stat.nationality}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-300 font-bold">
                      {stat.participations}
                    </td>
                    <td className="px-3 py-2.5 text-center font-black text-amber-400 text-sm">
                      {stat.championships}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-300 font-semibold">
                      {stat.runnerUps}
                    </td>
                    <td className="px-3 py-2.5 text-center text-amber-600 font-semibold">
                      {stat.thirdPlaces}
                    </td>
                    <td className="px-3 py-2.5 text-center text-indigo-300 font-bold">
                      {stat.top4}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-teal-400">
                      {stat.groupAdvancements}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-rose-400">
                      {stat.groupExits}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-300">{stat.matches}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-400">
                      {stat.wins}-{stat.draws}-{stat.losses}
                    </td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-indigo-400">
                      {stat.winRate}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-amber-300">
                      {stat.longestWinStreak} W
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-200">
                      {stat.gameDiff > 0 ? `+${stat.gameDiff}` : stat.gameDiff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: LEAGUE SYSTEM CAREER STATS TABLE */}
      {activeSystem === 'league' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-4 py-3">Idol</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-400">Points</th>
                  <th className="px-3 py-3 text-center font-bold text-yellow-300">Titles</th>
                  <th className="px-3 py-3 text-center font-bold text-emerald-400">Podiums</th>
                  <th className="px-3 py-3 text-center font-bold text-indigo-300">Qualifiers</th>
                  <th className="px-3 py-3 text-center">Played</th>
                  <th className="px-3 py-3 text-center font-bold text-emerald-300">W-D-L</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-300">Win %</th>
                  <th className="px-3 py-3 text-center font-mono">GF-GA</th>
                  <th className="px-3 py-3 text-center font-mono">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sortedLeagueStats.length > 0 ? (
                  sortedLeagueStats.map((stat, idx) => (
                    <tr key={stat.idolId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {stat.photoUrl ? (
                            <img
                              src={stat.photoUrl}
                              alt={stat.idolName}
                              className="h-8 w-8 rounded-lg object-cover border border-slate-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-300">
                              {(stat.idolName || 'ID').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm leading-tight">
                                {stat.idolName}
                              </span>
                              {stat.nationality && (
                                <span className="text-xs">
                                  {getCountryFlag(stat.nationality)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {stat.girlGroup}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-amber-400 text-sm">
                        {stat.points} PTS
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-yellow-300">
                        {stat.divisionTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400">
                        {stat.podiums}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-indigo-300">
                        {stat.championsQualifiers}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300">{stat.matches}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-300">
                        {stat.wins}-{stat.draws}-{stat.losses}
                      </td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-amber-300">
                        {stat.winRate}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                        {stat.goalsFor}-{stat.goalsAgainst}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-200">
                        {stat.goalDiff > 0 ? `+${stat.goalDiff}` : stat.goalDiff}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500">
                      No league statistics recorded yet. Play or simulate matches in the League System to populate league records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: THE IDOLS SUPERLEAGUE STATS TABLE */}
      {activeSystem === 'the_idols' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-4 py-3">Idol</th>
                  <th className="px-3 py-3 text-center">Seasons</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-400">Masters Titles</th>
                  <th className="px-3 py-3 text-center font-bold text-purple-400">Superleague (1st)</th>
                  <th className="px-3 py-3 text-center font-bold text-emerald-400">Masters Podiums</th>
                  <th className="px-3 py-3 text-center font-bold text-amber-300">Points</th>
                  <th className="px-3 py-3 text-center">Matches</th>
                  <th className="px-3 py-3 text-center font-bold text-emerald-400">W-D-L</th>
                  <th className="px-3 py-3 text-center">Win%</th>
                  <th className="px-3 py-3 text-center font-bold text-indigo-400">Playoff Series</th>
                  <th className="px-3 py-3 text-center">GF-GA</th>
                  <th className="px-3 py-3 text-center font-bold text-slate-200">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {sortedTheIdolsStats.length > 0 ? (
                  sortedTheIdolsStats.map((stat, idx) => (
                    <tr
                      key={stat.idolId}
                      onClick={() => onSelectIdolProfile && onSelectIdolProfile(stat.idolId)}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        onSelectIdolProfile ? 'cursor-pointer' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {stat.photoUrl ? (
                            <img
                              src={stat.photoUrl}
                              alt={stat.idolName}
                              className="h-8 w-8 rounded-lg object-cover border border-slate-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-amber-300">
                              {(stat.idolName || 'ID').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm leading-tight">
                                {stat.idolName}
                              </span>
                              {stat.nationality && (
                                <span className="text-xs">
                                  {getCountryFlag(stat.nationality)}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {stat.girlGroup}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300 font-semibold">
                        {stat.seasonsPlayed}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-400 text-sm">
                        {stat.mastersTitles > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/30">
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                            <span>{stat.mastersTitles}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-purple-300">
                        {stat.superleagueTitles}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400">
                        {stat.mastersPodiums}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-amber-300 font-mono">
                        {stat.points} PTS
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300 font-medium">
                        {stat.matches}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400 font-mono">
                        {stat.wins}-{stat.draws}-{stat.losses}
                      </td>
                      <td className="px-3 py-2.5 text-center font-extrabold text-indigo-400">
                        {stat.winRate}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-indigo-300">
                        {stat.playoffWins}-{stat.playoffLosses}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-400">
                        {stat.goalsFor}-{stat.goalsAgainst}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-200">
                        {stat.goalDiff > 0 ? `+${stat.goalDiff}` : stat.goalDiff}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500">
                      No The Idols Superleague statistics recorded yet. Play or simulate matches in The Idols system to populate records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>}
    </div>
  );
};
