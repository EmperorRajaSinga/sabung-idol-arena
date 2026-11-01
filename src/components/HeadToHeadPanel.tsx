import React, { useState, useMemo } from 'react';
import {
  Idol,
  ArchivedMatch,
  CareerStat,
  LeagueSeasonState,
  LeagueSeasonArchive,
  TournamentArchive,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from '../types';
import {
  GitCompare,
  Swords,
  Trophy,
  Flame,
  Star,
  Award,
  Shield,
  Zap,
  TrendingUp,
  Percent,
  Sparkles,
} from 'lucide-react';
import { SearchableIdolSelect } from './SearchableIdolSelect';
import { compareMatchesNewestFirst } from '../utils/leagueLogic';
import { isLeagueDivisionMatch, isTheIdolsMatch } from '../utils/matchClassification';
import { getIdolRating, getRatingTierInfo } from '../utils/ratingHelper';
import { computeAllIdolAchievements } from '../utils/achievementEngine';
import { loadCareerOverrides } from '../utils/databaseStudioLogic';

interface HeadToHeadPanelProps {
  idols: Idol[];
  matchDatabase: ArchivedMatch[];
  careerStats?: CareerStat[];
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  archives?: TournamentArchive[];
}

interface RivalryItem {
  key: string;
  idolAId: string;
  idolBId: string;
  idolA: Idol | undefined;
  idolB: Idol | undefined;
  idolAName: string;
  idolBName: string;
  totalMatches: number;
  winsA: number;
  winsB: number;
  draws: number;
  gamesA: number;
  gamesB: number;
}

export const HeadToHeadPanel: React.FC<HeadToHeadPanelProps> = ({
  idols,
  matchDatabase,
  careerStats = [],
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  archives = [],
}) => {
  const [idolAId, setIdolAId] = useState<string>(idols[0]?.id || '');
  const [idolBId, setIdolBId] = useState<string>(idols[1]?.id || '');
  const [stageFilter, setStageFilter] = useState<'ALL' | 'Group Stage' | 'Knockout' | 'League'>('ALL');

  // Compute Achievements
  const achievementReports = useMemo(() => {
    return computeAllIdolAchievements({
      idols,
      careerStats,
      tournamentArchives: archives,
      leagueArchives,
      leagueState,
      matchDatabase,
    });
  }, [idols, careerStats, archives, leagueArchives, leagueState, matchDatabase]);

  // Compute Top 10 Most Matchups / Heated Rivalries
  const topRivalries = useMemo(() => {
    const rivalryMap: { [key: string]: RivalryItem } = {};

    matchDatabase.forEach((m) => {
      const aId = m.idolAId || '';
      const bId = m.idolBId || '';
      const aName = (m.idolAName || '').trim();
      const bName = (m.idolBName || '').trim();

      if (!aName && !bName) return;

      const [id1, id2] = aId && bId ? [aId, bId].sort() : [aName, bName].sort();
      const pairKey = `${id1}::${id2}`;

      if (!rivalryMap[pairKey]) {
        const foundA = idols.find((i) => i.id === aId || i.name.toLowerCase() === aName.toLowerCase());
        const foundB = idols.find((i) => i.id === bId || i.name.toLowerCase() === bName.toLowerCase());

        rivalryMap[pairKey] = {
          key: pairKey,
          idolAId: foundA?.id || aId,
          idolBId: foundB?.id || bId,
          idolA: foundA,
          idolB: foundB,
          idolAName: foundA?.name || aName,
          idolBName: foundB?.name || bName,
          totalMatches: 0,
          winsA: 0,
          winsB: 0,
          draws: 0,
          gamesA: 0,
          gamesB: 0,
        };
      }

      const item = rivalryMap[pairKey];
      item.totalMatches += 1;

      const scoreA = Number(m.scoreA ?? 0);
      const scoreB = Number(m.scoreB ?? 0);
      const isDraw = Boolean(m.isDraw || scoreA === scoreB || m.winnerId === 'DRAW');

      const isDirectA =
        m.idolAId === item.idolAId ||
        (m.idolAName && item.idolAName && m.idolAName.trim().toLowerCase() === item.idolAName.toLowerCase());

      const ptsA = isDirectA ? scoreA : scoreB;
      const ptsB = isDirectA ? scoreB : scoreA;

      item.gamesA += ptsA;
      item.gamesB += ptsB;

      if (isDraw) {
        item.draws += 1;
      } else {
        const isWinnerA =
          m.winnerId === item.idolAId ||
          (m.winnerName && item.idolAName && m.winnerName.trim().toLowerCase() === item.idolAName.toLowerCase()) ||
          (isDirectA ? scoreA > scoreB : scoreB > scoreA);

        if (isWinnerA) {
          item.winsA += 1;
        } else {
          item.winsB += 1;
        }
      }
    });

    return Object.values(rivalryMap)
      .filter((r) => r.totalMatches > 0)
      .sort((a, b) => {
        if (b.totalMatches !== a.totalMatches) {
          return b.totalMatches - a.totalMatches;
        }
        const diffA = Math.abs(a.winsA - a.winsB);
        const diffB = Math.abs(b.winsA - b.winsB);
        return diffA - diffB;
      })
      .slice(0, 10);
  }, [matchDatabase, idols]);

  const idolA = idols.find((i) => i.id === idolAId) || idols[0];
  const idolB = idols.find((i) => i.id === idolBId) || idols[1];

  const idolANameLower = idolA?.name ? idolA.name.trim().toLowerCase() : '';
  const idolBNameLower = idolB?.name ? idolB.name.trim().toLowerCase() : '';

  // Direct H2H Matches
  const h2hMatches = useMemo(() => {
    const list = matchDatabase.filter((m) => {
      const mANameLower = m.idolAName ? m.idolAName.trim().toLowerCase() : '';
      const mBNameLower = m.idolBName ? m.idolBName.trim().toLowerCase() : '';

      const isMatchA =
        m.idolAId === idolAId || (idolANameLower && mANameLower === idolANameLower);
      const isMatchB =
        m.idolBId === idolBId || (idolBNameLower && mBNameLower === idolBNameLower);

      const isSwappedA =
        m.idolAId === idolBId || (idolBNameLower && mANameLower === idolBNameLower);
      const isSwappedB =
        m.idolBId === idolAId || (idolANameLower && mBNameLower === idolANameLower);

      const isPair = (isMatchA && isMatchB) || (isSwappedA && isSwappedB);

      if (!isPair) return false;

      const st = String(m.stage || (m as any).stageOrDivision || m.groupName || '').toLowerCase();
      const isLeague = isLeagueDivisionMatch(m);

      if (stageFilter === 'Group Stage') return st.includes('group') && !isLeague;
      if (stageFilter === 'Knockout') return !st.includes('group') && !isLeague;
      const isTheIdolsRow = isTheIdolsMatch(m);
      if (stageFilter === 'League') return isLeague && !isTheIdolsRow;
      return true;
    });

    return [...list].sort((a, b) => compareMatchesNewestFirst(a, b));
  }, [matchDatabase, idolAId, idolBId, idolANameLower, idolBNameLower, stageFilter]);

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let gamesA = 0;
  let gamesB = 0;

  h2hMatches.forEach((m) => {
    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    const isDraw = Boolean(m.isDraw || scoreA === scoreB || m.winnerId === 'DRAW');

    const mANameLower = m.idolAName ? m.idolAName.trim().toLowerCase() : '';
    const isDirectA =
      m.idolAId === idolAId || (idolANameLower && mANameLower === idolANameLower);

    const idolScoreA = isDirectA ? scoreA : scoreB;
    const idolScoreB = isDirectA ? scoreB : scoreA;

    gamesA += idolScoreA;
    gamesB += idolScoreB;

    if (isDraw) {
      draws++;
    } else {
      const isWinnerA =
        m.winnerId === idolAId ||
        (idolANameLower && m.winnerName && m.winnerName.trim().toLowerCase() === idolANameLower) ||
        (isDirectA ? scoreA > scoreB : scoreB > scoreA);

      if (isWinnerA) winsA++;
      else winsB++;
    }
  });

  const overrides = useMemo(() => loadCareerOverrides(), []);

  // Calculate detailed career stats for Idol A and Idol B
  const getDetailedStatsForIdol = (idol?: Idol) => {
    if (!idol) {
      return {
        rating: 70,
        tierInfo: getRatingTierInfo(70),
        cupTitles: 0,
        leagueTitles: 0,
        totalTitles: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        points: 0,
        longestStreak: 0,
        recentForm: [] as ('W' | 'D' | 'L')[],
      };
    }

    const cStat = careerStats.find((c) => c.idolId === idol.id);
    const rating = getIdolRating(idol);
    const tierInfo = getRatingTierInfo(rating);

    // League stats
    let leagueTitles = 0;
    let leagueMatches = 0;
    let leagueWins = 0;
    let leagueDraws = 0;
    let leagueLosses = 0;
    let leagueGF = 0;

    if (leagueState && leagueState.leagues) {
      leagueState.leagues.forEach((l) => {
        const st = l.standings?.find((s) => s.idolId === idol.id);
        if (st) {
          leagueMatches += st.played || 0;
          leagueWins += st.wins || 0;
          leagueDraws += st.draws || 0;
          leagueLosses += st.losses || 0;
          leagueGF += st.gamesFor || 0;
          if (l.isCompleted && st.rank === 1 && (st.played || 0) > 0) leagueTitles += 1;
        }
      });
    }

    leagueArchives.forEach((arch) => {
      let titleCounted = false;
      const winners = arch.leagueWinners || (arch as any).leagueChampions || [];
      if (winners.some((w: any) => (w.championId || w.idolId) === idol.id)) {
        leagueTitles += 1;
        titleCounted = true;
      }
      if (arch.allStandings) {
        Object.values(arch.allStandings).forEach((list: any) => {
          const st = list?.find((s: any) => s.idolId === idol.id);
          if (st) {
            leagueMatches += st.played || 0;
            leagueWins += st.wins || 0;
            leagueDraws += st.draws || 0;
            leagueLosses += st.losses || 0;
            leagueGF += st.gamesFor || 0;
            if (!titleCounted && st.rank === 1 && (st.played || 0) > 0) {
              leagueTitles += 1;
              titleCounted = true;
            }
          }
        });
      }
    });

    let theIdolsMatches = 0;
    let theIdolsWins = 0;
    let theIdolsDraws = 0;
    let theIdolsLosses = 0;
    let theIdolsGF = 0;
    let theIdolsTitles = 0;

    if (theIdolsState && theIdolsState.standings) {
      const stIdx = theIdolsState.standings.findIndex(
        (s) => s.idolId === idol.id || s.idolName?.toLowerCase() === idol.name?.toLowerCase()
      );
      if (stIdx !== -1) {
        const st = theIdolsState.standings[stIdx];
        theIdolsMatches += Number(st.played || 0);
        theIdolsWins += Number(st.wins ?? (st as any).won ?? 0);
        theIdolsDraws += Number(st.draws ?? (st as any).drawn ?? 0);
        theIdolsLosses += Number(st.losses ?? (st as any).lost ?? 0);
        theIdolsGF += Number(st.gamesFor ?? (st as any).goalsFor ?? 0);

        if ((theIdolsState.isLeagueCompleted || theIdolsState.isCompleted) && stIdx === 0) {
          theIdolsTitles += 1;
        }
        if (
          theIdolsState.isPlayoffCompleted &&
          (theIdolsState.championId === idol.id ||
            theIdolsState.championName?.toLowerCase() === idol.name?.toLowerCase())
        ) {
          theIdolsTitles += 1;
        }
      }
    }

    (theIdolsArchives || []).forEach((arch) => {
      const stList = arch.standings || [];
      const stIdx = stList.findIndex(
        (s) => s.idolId === idol.id || s.idolName?.toLowerCase() === idol.name?.toLowerCase()
      );
      if (stIdx !== -1) {
        const st = stList[stIdx];
        theIdolsMatches += Number(st.played || 0);
        theIdolsWins += Number(st.wins ?? (st as any).won ?? 0);
        theIdolsDraws += Number(st.draws ?? (st as any).drawn ?? 0);
        theIdolsLosses += Number(st.losses ?? (st as any).lost ?? 0);
        theIdolsGF += Number(st.gamesFor ?? (st as any).goalsFor ?? 0);

        if (stIdx === 0) {
          theIdolsTitles += 1;
        }
      }
      if (
        arch.championId === idol.id ||
        arch.championName?.toLowerCase() === idol.name?.toLowerCase()
      ) {
        theIdolsTitles += 1;
      }
    });

    // V5 cups and Division 2 are sourced from the same unified match database
    // used by Career Statistics, so newly archived results flow into this panel automatically.
    const v5Sections = [
      { key: 'crown', test: (stage: string) => stage.includes('league champions cup') },
      { key: 'open', test: (stage: string) => stage.includes('all-league knockout cup') },
      { key: 'spotlight', test: (stage: string) => stage.includes('top 16 mini cup') },
      { key: 'super_a', test: (stage: string) => stage.includes('super cup a') },
      { key: 'super_b', test: (stage: string) => stage.includes('super cup b') },
      { key: 'division_2', test: (stage: string) => stage.includes('division 2') },
    ];
    const v5Matches = (Array.isArray(matchDatabase) ? matchDatabase : []).filter((match) => {
      const stage = String(match?.stage || '').toLowerCase();
      return stage.startsWith('cups & divisions:') && v5Sections.some((section) => section.test(stage)) &&
        (match.idolAId === idol.id || match.idolBId === idol.id);
    });
    const seenV5Matches = new Set<string>();
    let v5MatchesPlayed = 0;
    let v5Wins = 0;
    let v5Draws = 0;
    let v5Losses = 0;
    let v5GoalsFor = 0;
    v5Matches.forEach((match) => {
      if (match.scoreA == null || match.scoreB == null) return;
      const key = String(match.matchId || [match.seasonId, match.stage, match.idolAId, match.idolBId, match.scoreA, match.scoreB].join('|'));
      if (seenV5Matches.has(key)) return;
      seenV5Matches.add(key);
      const isA = match.idolAId === idol.id;
      const scoreFor = Number(isA ? match.scoreA : match.scoreB);
      const scoreAgainst = Number(isA ? match.scoreB : match.scoreA);
      if (!Number.isFinite(scoreFor) || !Number.isFinite(scoreAgainst)) return;
      v5MatchesPlayed += 1;
      v5GoalsFor += scoreFor;
      if (scoreFor > scoreAgainst) v5Wins += 1;
      else if (scoreFor === scoreAgainst) v5Draws += 1;
      else v5Losses += 1;
    });

    // Cup titles come only from a recorded Final. Division 2 titles are calculated
    // independently per season using its official points, goal-difference and goals-scored tiebreakers.
    const v5CupTitleSeasons = new Set<string>();
    const d2Tables = new Map<string, Map<string, { points: number; diff: number; scored: number }>>();
    const seenTitleMatches = new Set<string>();
    (Array.isArray(matchDatabase) ? matchDatabase : []).forEach((match) => {
      const stage = String(match?.stage || '');
      const lowerStage = stage.toLowerCase();
      if (!lowerStage.startsWith('cups & divisions:')) return;
      if (match.scoreA == null || match.scoreB == null || !match.idolAId || !match.idolBId) return;
      const key = String(match.matchId || [match.seasonId, stage, match.idolAId, match.idolBId, match.scoreA, match.scoreB].join('|'));
      if (seenTitleMatches.has(key)) return;
      seenTitleMatches.add(key);
      const scoreA = Number(match.scoreA), scoreB = Number(match.scoreB);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;
      const season = String(match.seasonId || 1);
      if (lowerStage.includes('division 2')) {
        if (!d2Tables.has(season)) d2Tables.set(season, new Map());
        const table = d2Tables.get(season)!;
        const update = (id: string, scored: number, conceded: number) => {
          const row = table.get(id) || { points: 0, diff: 0, scored: 0 };
          row.points += scored > conceded ? 3 : scored === conceded ? 1 : 0;
          row.diff += scored - conceded;
          row.scored += scored;
          table.set(id, row);
        };
        update(match.idolAId, scoreA, scoreB);
        update(match.idolBId, scoreB, scoreA);
      } else if (
        lowerStage.includes('league champions cup') ||
        lowerStage.includes('all-league knockout cup') ||
        lowerStage.includes('top 16 mini cup') ||
        lowerStage.includes('super cup a') ||
        lowerStage.includes('super cup b')
      ) {
        const detail = stage.split(' / ').slice(1).join(' / ').trim().toLowerCase();
        if (/^final(?:\\b|\\s|$)/.test(detail) && scoreA !== scoreB) {
          const winnerId = scoreA > scoreB ? match.idolAId : match.idolBId;
          if (winnerId === idol.id) v5CupTitleSeasons.add(`${season}|${lowerStage.split(' / ')[0]}`);
        }
      }
    });
    let v5DivisionTitles = 0;
    d2Tables.forEach((table) => {
      const championId = [...table.entries()].sort((a, b) =>
        b[1].points - a[1].points || b[1].diff - a[1].diff || b[1].scored - a[1].scored
      )[0]?.[0];
      if (championId === idol.id) v5DivisionTitles += 1;
    });
    const v5Titles = v5CupTitleSeasons.size + v5DivisionTitles;

    const ov = overrides[idol.id];
    const isOverridden = ov && ov.enabled;
    const cupTitles = isOverridden && ov.championships !== undefined ? ov.championships : (cStat?.championships || 0);
    const finalLeagueTitles = isOverridden && ov.divisionTitles !== undefined ? ov.divisionTitles : leagueTitles;
    const finalTheIdolsTitles = isOverridden && (ov.theIdolsSuperleagueTitles !== undefined || ov.theIdolsMastersTitles !== undefined)
      ? (ov.theIdolsSuperleagueTitles || 0) + (ov.theIdolsMastersTitles || 0)
      : theIdolsTitles;
    const totalTitles = cupTitles + finalLeagueTitles + finalTheIdolsTitles + v5Titles;
    const totalMatches = isOverridden && ov.matches !== undefined ? ov.matches : ((cStat?.matches || 0) + leagueMatches + theIdolsMatches + v5MatchesPlayed);
    const totalWins = isOverridden && ov.wins !== undefined ? ov.wins : ((cStat?.wins || 0) + leagueWins + theIdolsWins + v5Wins);
    const totalDraws = isOverridden && ov.draws !== undefined ? ov.draws : ((cStat?.draws || 0) + leagueDraws + theIdolsDraws + v5Draws);
    const totalLosses = isOverridden && ov.losses !== undefined ? ov.losses : ((cStat?.losses || 0) + leagueLosses + theIdolsLosses + v5Losses);
    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
    const points = (cStat?.gamesFor || 0) + leagueGF + theIdolsGF + v5GoalsFor;
    const longestStreak = isOverridden && ov.longestWinStreak !== undefined ? ov.longestWinStreak : (cStat?.longestWinStreak || 0);

    // Recent Form from match database
    const idolNameLower = idol.name.toLowerCase();
    const idolMatches = matchDatabase
      .filter((m) => {
        const aName = (m.idolAName || '').toLowerCase();
        const bName = (m.idolBName || '').toLowerCase();
        return (
          m.idolAId === idol.id ||
          m.idolBId === idol.id ||
          aName === idolNameLower ||
          bName === idolNameLower
        );
      })
      .sort((a, b) => compareMatchesNewestFirst(a, b))
      .slice(0, 5);

    const recentForm = idolMatches.map((m) => {
      const isA = m.idolAId === idol.id || (m.idolAName && m.idolAName.toLowerCase() === idolNameLower);
      const scoreA = Number(m.scoreA ?? 0);
      const scoreB = Number(m.scoreB ?? 0);
      const isDraw = Boolean(m.isDraw || scoreA === scoreB || m.winnerId === 'DRAW');
      if (isDraw) return 'D' as const;

      const isWinner =
        m.winnerId === idol.id ||
        (m.winnerName && m.winnerName.toLowerCase() === idolNameLower) ||
        (isA ? scoreA > scoreB : scoreB > scoreA);
      return isWinner ? ('W' as const) : ('L' as const);
    });

    return {
      rating,
      tierInfo,
      cupTitles,
      leagueTitles,
      theIdolsTitles,
      totalTitles,
      matches: totalMatches,
      wins: totalWins,
      losses: totalLosses,
      draws: totalDraws,
      winRate,
      points,
      longestStreak,
      recentForm,
    };
  };

  const statA = getDetailedStatsForIdol(idolA);
  const statB = getDetailedStatsForIdol(idolB);
  const achA = idolA ? achievementReports.get(idolA.id) : null;
  const achB = idolB ? achievementReports.get(idolB.id) : null;

  const totalH2HMatches = winsA + winsB + draws;
  const winPercentA = totalH2HMatches > 0 ? Math.round((winsA / totalH2HMatches) * 100) : 50;
  const winPercentB = totalH2HMatches > 0 ? Math.round((winsB / totalH2HMatches) * 100) : 50;

  const selectRivalry = (rivalry: RivalryItem) => {
    if (rivalry.idolAId) setIdolAId(rivalry.idolAId);
    if (rivalry.idolBId) setIdolBId(rivalry.idolBId);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-indigo-400" />
            <span>Head to Head &bull; Tale of the Tape</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Compare complete idol stats, championships, rating, win rates, and direct match encounters side-by-side.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Match Filter:</span>
          <select
            value={stageFilter}
            onChange={(e) =>
              setStageFilter(e.target.value as 'ALL' | 'Group Stage' | 'Knockout' | 'League')
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Competitions Combined</option>
            <option value="League">League Divisions Only</option>
            <option value="Group Stage">Group Stage Only</option>
            <option value="Knockout">Knockout Stage Only</option>
          </select>
        </div>
      </div>

      {/* Selectors & Fighter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6">
        {/* Idol A Card */}
        <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-5 space-y-4 shadow-xl text-center relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${statA.tierInfo.badgeBg}`}
            >
              {statA.tierInfo.tier} &bull; Rating {statA.rating}
            </span>
          </div>

          <SearchableIdolSelect
            idols={idols}
            selectedIdolId={idolAId}
            onSelectIdol={(id) => setIdolAId(id)}
            placeholder="Search Player A..."
            accentColor="indigo"
            label="Player A"
          />

          {idolA && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="h-28 w-28 overflow-hidden rounded-2xl border-4 border-indigo-500 shadow-xl bg-black flex items-center justify-center">
                {idolA.photoUrl ? (
                  <img
                    src={idolA.photoUrl}
                    alt={idolA.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center font-bold text-2xl text-indigo-300 bg-slate-900">
                    {idolA.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <h3 className="font-extrabold text-xl text-white leading-tight">
                {idolA.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-400">
                  {idolA.girlGroup}
                </span>
                <span className="text-slate-600">&bull;</span>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {idolA.seed || 'Unseeded'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* VS / Score Summary */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xl shadow-lg ring-4 ring-slate-900">
            VS
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-6 py-4 text-center space-y-2 shadow-2xl min-w-[220px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Direct H2H Encounters
            </span>
            <div className="text-2xl font-black text-amber-300 font-mono flex items-center justify-center gap-2">
              <span className="text-emerald-400">{winsA}W</span>
              <span className="text-slate-600">-</span>
              <span className="text-amber-400">{draws}D</span>
              <span className="text-slate-600">-</span>
              <span className="text-purple-400">{winsB}W</span>
            </div>

            {/* Direct H2H Domination Bar */}
            {totalH2HMatches > 0 && (
              <div className="w-full space-y-1 pt-1">
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${winPercentA}%` }}
                    className="bg-indigo-500 h-full transition-all"
                  />
                  <div
                    style={{ width: `${winPercentB}%` }}
                    className="bg-purple-500 h-full transition-all"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>{winPercentA}%</span>
                  <span>{winPercentB}%</span>
                </div>
              </div>
            )}

            <span className="text-[10px] text-slate-500 font-semibold block pt-1">
              Game Score: {gamesA} - {gamesB}
            </span>
          </div>
        </div>

        {/* Idol B Card */}
        <div className="rounded-2xl border border-purple-500/30 bg-slate-900/90 p-5 space-y-4 shadow-xl text-center relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${statB.tierInfo.badgeBg}`}
            >
              {statB.tierInfo.tier} &bull; Rating {statB.rating}
            </span>
          </div>

          <SearchableIdolSelect
            idols={idols}
            selectedIdolId={idolBId}
            onSelectIdol={(id) => setIdolBId(id)}
            placeholder="Search Player B..."
            accentColor="purple"
            label="Player B"
          />

          {idolB && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="h-28 w-28 overflow-hidden rounded-2xl border-4 border-purple-500 shadow-xl bg-black flex items-center justify-center">
                {idolB.photoUrl ? (
                  <img
                    src={idolB.photoUrl}
                    alt={idolB.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center font-bold text-2xl text-purple-300 bg-slate-900">
                    {idolB.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <h3 className="font-extrabold text-xl text-white leading-tight">
                {idolB.name}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-400">
                  {idolB.girlGroup}
                </span>
                <span className="text-slate-600">&bull;</span>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {idolB.seed || 'Unseeded'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STAT COMPARISON TABLE: TALE OF THE TAPE */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <h3 className="font-extrabold text-base text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span>Tale of the Tape &bull; Statistical Comparison</span>
        </h3>

        <div className="space-y-3 font-mono text-xs">
          {/* Rating */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 border-b border-slate-800/60">
            <div className="text-left font-black text-lg text-indigo-400">{statA.rating}</div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Skill Rating (0 - 100)
            </div>
            <div className="text-right font-black text-lg text-purple-400">{statB.rating}</div>
          </div>

          {/* Major Championships */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 border-b border-slate-800/60">
            <div className="text-left font-black text-base text-amber-300 flex flex-col sm:flex-row sm:items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{statA.totalTitles} Titles</span>
              </div>

            </div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Titles
            </div>
            <div className="text-right font-black text-base text-amber-300 flex flex-col sm:flex-row sm:items-center justify-end gap-1.5">

              <div className="flex items-center justify-end gap-1.5">
                <span>{statB.totalTitles} Titles</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Career Win Rate */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 border-b border-slate-800/60">
            <div className="text-left font-black text-base text-emerald-400">
              {statA.winRate}%
              <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
                ({statA.wins}W - {statA.draws}D - {statA.losses}L)
              </span>
            </div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Overall Career Win Rate
            </div>
            <div className="text-right font-black text-base text-emerald-400">
              <span className="text-[10px] text-slate-400 mr-1.5 font-normal">
                ({statB.wins}W - {statB.draws}D - {statB.losses}L)
              </span>
              {statB.winRate}%
            </div>
          </div>

          {/* Matches Contested */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 border-b border-slate-800/60">
            <div className="text-left font-bold text-white">{statA.matches} Matches</div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Total Career Matches
            </div>
            <div className="text-right font-bold text-white">{statB.matches} Matches</div>
          </div>

          {/* Points / Goals Scored */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 border-b border-slate-800/60">
            <div className="text-left font-bold text-amber-400">{statA.points} Points</div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Total Points Scored
            </div>
            <div className="text-right font-bold text-amber-400">{statB.points} Points</div>
          </div>

          {/* Longest Win Streak */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2 border-b border-slate-800/60">
            <div className="text-left font-bold text-red-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              <span>{statA.longestStreak} Wins in a Row</span>
            </div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Longest Win Streak
            </div>
            <div className="text-right font-bold text-red-400 flex items-center justify-end gap-1">
              <span>{statB.longestStreak} Wins in a Row</span>
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Recent Form (Last 5) */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2">
            <div className="flex items-center gap-1">
              {(statA?.recentForm || []).length > 0 ? (
                (statA?.recentForm || []).map((res, i) => (
                  <span
                    key={i}
                    className={`h-5 w-5 rounded text-[10px] font-black flex items-center justify-center ${
                      res === 'W'
                        ? 'bg-emerald-500 text-black'
                        : res === 'D'
                        ? 'bg-amber-500 text-black'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {res}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-[10px]">No recent form</span>
              )}
            </div>
            <div className="text-center font-bold text-slate-400 uppercase text-[11px]">
              Recent Form (Last 5)
            </div>
            <div className="flex items-center justify-end gap-1">
              {(statB?.recentForm || []).length > 0 ? (
                (statB?.recentForm || []).map((res, i) => (
                  <span
                    key={i}
                    className={`h-5 w-5 rounded text-[10px] font-black flex items-center justify-center ${
                      res === 'W'
                        ? 'bg-emerald-500 text-black'
                        : res === 'D'
                        ? 'bg-amber-500 text-black'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {res}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-[10px]">No recent form</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 Heated Rivalries Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-400" />
            <h3 className="font-extrabold text-base text-white">
              Heated Rivalries &bull; Top 10 Most Matchups
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            Click any matchup to compare
          </span>
        </div>

        {topRivalries.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topRivalries.map((rivalry, idx) => {
              const isSelected =
                (idolAId === rivalry.idolAId && idolBId === rivalry.idolBId) ||
                (idolAId === rivalry.idolBId && idolBId === rivalry.idolAId);

              return (
                <button
                  key={rivalry.key}
                  onClick={() => selectRivalry(rivalry)}
                  className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 group relative ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-black ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {rivalry.totalMatches} Matches
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 w-full my-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {rivalry.idolA?.photoUrl ? (
                        <img
                          src={rivalry.idolA.photoUrl}
                          alt={rivalry.idolAName}
                          className="h-6 w-6 rounded-md object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-md bg-slate-800 shrink-0 flex items-center justify-center text-[9px] font-bold text-slate-400">
                          {rivalry.idolAName.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs font-bold text-white truncate">
                        {rivalry.idolAName}
                      </span>
                    </div>

                    <span className="text-[10px] font-black text-slate-500 px-1">vs</span>

                    <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1 text-right">
                      <span className="text-xs font-bold text-white truncate">
                        {rivalry.idolBName}
                      </span>
                      {rivalry.idolB?.photoUrl ? (
                        <img
                          src={rivalry.idolB.photoUrl}
                          alt={rivalry.idolBName}
                          className="h-6 w-6 rounded-md object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-md bg-slate-800 shrink-0 flex items-center justify-center text-[9px] font-bold text-slate-400">
                          {rivalry.idolBName.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-400 font-bold">{rivalry.winsA}W</span>
                    <span className="text-amber-400 font-bold">{rivalry.draws}D</span>
                    <span className="text-purple-400 font-bold">{rivalry.winsB}W</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            No matchups recorded in the database yet.
          </div>
        )}
      </div>

      {/* Direct Match Log */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <h4 className="font-extrabold text-base text-white">
            Direct Match Log ({h2hMatches.length} Matches)
          </h4>
        </div>

        {h2hMatches.length > 0 ? (
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
            {h2hMatches.map((m, idx) => {
              const scoreA = Number(m.scoreA ?? 0);
              const scoreB = Number(m.scoreB ?? 0);
              const isDraw = Boolean(m.isDraw || scoreA === scoreB || m.winnerId === 'DRAW');

              const isDirectA =
                m.idolAId === idolAId ||
                (idolANameLower && m.idolAName && m.idolAName.trim().toLowerCase() === idolANameLower);

              const idolScoreA = isDirectA ? scoreA : scoreB;
              const idolScoreB = isDirectA ? scoreB : scoreA;

              const isWinnerA =
                m.winnerId === idolAId ||
                (idolANameLower && m.winnerName && m.winnerName.trim().toLowerCase() === idolANameLower) ||
                (!isDraw && (isDirectA ? scoreA > scoreB : scoreB > scoreA));

              const isWinnerB =
                m.winnerId === idolBId ||
                (idolBNameLower && m.winnerName && m.winnerName.trim().toLowerCase() === idolBNameLower) ||
                (!isDraw && (isDirectA ? scoreB > scoreA : scoreA > scoreB));

              return (
                <div
                  key={m.matchId || idx}
                  className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-950/40 rounded-xl transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {m.seasonName || `Season ${m.seasonId}`}
                    </span>
                    <span className="text-slate-400 font-semibold truncate">
                      {m.stage || (m as any).stageOrDivision || m.groupName || 'Match'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono font-bold">
                    <span
                      className={
                        isWinnerA
                          ? 'text-emerald-400 font-black'
                          : isDraw
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }
                    >
                      {idolA?.name}: {idolScoreA}
                    </span>
                    <span className="text-slate-600">-</span>
                    <span
                      className={
                        isWinnerB
                          ? 'text-purple-400 font-black'
                          : isDraw
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }
                    >
                      {idolScoreB} :{idolB?.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            No direct encounters between {idolA?.name || 'Player A'} and {idolB?.name || 'Player B'} found for this filter.
          </div>
        )}
      </div>
    </div>
  );
};
