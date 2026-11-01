import React, { useState, useEffect, useMemo } from 'react';
import {
  Idol,
  CareerStat,
  ArchivedMatch,
  LeagueSeasonState,
  LeagueSeasonArchive,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  TournamentArchive,
  TournamentConfig,
  Group,
  KnockoutMatch,
} from '../types';
import {
  User,
  Trophy,
  Swords,
  Flame,
  Award,
  Crown,
  Camera,
  Upload,
  X,
  GitCompare,
  Sparkles,
  Shield,
  Layers,
  Medal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { SearchableIdolSelect } from './SearchableIdolSelect';
import { compressImage } from '../utils/imageHelper';
import { getCountryFlag } from '../utils/nationalityHelper';
import { getTopH2HRecordsForIdol, OpponentH2HRecord } from '../utils/h2hHelper';
import { getMatchChronologicalWeight, compareMatchesNewestFirst } from '../utils/leagueLogic';
import { getIdolRating, getRatingTierInfo } from '../utils/ratingHelper';
import { RatingBadge } from './RatingBadge';
import { getAllSeasonArchives } from '../utils/tournamentLogic';
import { loadCareerOverrides, applyOverridesToCareerStats, calculateUnifiedTotalTitles } from '../utils/databaseStudioLogic';

interface IdolProfilePanelProps {
  idols: Idol[];
  careerStats: CareerStat[];
  matchDatabase: ArchivedMatch[];
  selectedIdolId?: string;
  onUpdateIdolPhoto?: (idolId: string, photoUrl: string) => void;
  onUpdateIdols?: (updatedIdols: Idol[]) => void;
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  archives?: TournamentArchive[];
  config?: TournamentConfig;
  groups?: Group[];
  knockoutMatches?: KnockoutMatch[];
}

export const IdolProfilePanel: React.FC<IdolProfilePanelProps> = ({
  idols,
  careerStats,
  matchDatabase,
  selectedIdolId,
  onUpdateIdolPhoto,
  onUpdateIdols,
  leagueState,
  leagueArchives = [],
  theIdolsState = null,
  theIdolsArchives = [],
  archives = [],
  config,
  groups = [],
  knockoutMatches = [],
}) => {
  const [currentIdolId, setCurrentIdolId] = useState<string>(
    selectedIdolId || idols[0]?.id || ''
  );
  const [selectedH2HOpponentId, setSelectedH2HOpponentId] = useState<string>('');
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [matchPage, setMatchPage] = useState<number>(1);
  const [matchFilter, setMatchFilter] = useState<'all' | 'tournament' | 'league' | 'the_idols'>('all');
  const [activeCareerScope, setActiveCareerScope] = useState<'combined' | 'tournament' | 'league' | 'the_idols'>('combined');
  const matchesPerPage = 15;

  useEffect(() => {
    if (selectedIdolId) {
      setCurrentIdolId(selectedIdolId);
      setMatchPage(1);
    }
  }, [selectedIdolId]);

  const careerOverrides = useMemo(() => loadCareerOverrides(), []);
  const effectiveCareerStats = useMemo(() => {
    return applyOverridesToCareerStats(careerStats || [], careerOverrides);
  }, [careerStats, careerOverrides]);

  const idol = idols.find((i) => i.id === currentIdolId) || idols[0];
  const stat = effectiveCareerStats.find((s) => s.idolId === idol?.id);

  // --- LEAGUE STATISTICS COMPUTATION ---
  const leagueData = useMemo(() => {
    if (!idol) {
      return {
        currentDivision: null,
        totalLeagueMatches: 0,
        totalLeagueWins: 0,
        totalLeagueDraws: 0,
        totalLeagueLosses: 0,
        totalLeagueGoalsFor: 0,
        totalLeagueGoalsAgainst: 0,
        totalLeaguePoints: 0,
        divisionTitlesCount: 0,
        divisionTitles: [] as Array<{ seasonNumber: number; divisionId: number; divisionName: string }>,
        pastSeasons: [] as Array<{
          seasonNumber: number;
          divisionId: number;
          divisionName: string;
          rank: number;
          points: number;
          played: number;
          won: number;
          drawn: number;
          lost: number;
          isChampion: boolean;
        }>,
        recentLeagueMatches: [] as any[],
      };
    }

    const idolsMap = new Map<string, Idol>();
    idols.forEach((i) => idolsMap.set(i.id, i));

    // 1. Current League Season Position & Active Standings
    let currentDiv: {
      divisionId: number;
      divisionName: string;
      tierNumber: number;
      rank: number;
      totalInDiv: number;
      points: number;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
    } | null = null;

    if (leagueState && Array.isArray(leagueState.leagues)) {
      for (const l of leagueState.leagues) {
        if (l.memberIds && l.memberIds.includes(idol.id)) {
          const sorted = [...(l.standings || [])].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
            return b.gamesFor - a.gamesFor;
          });

          const rIdx = sorted.findIndex((r) => r.idolId === idol.id);
          const row = rIdx !== -1 ? sorted[rIdx] : null;

          const pWins = row ? (row.wins ?? (row as any).won ?? 0) : 0;
          const pDraws = row ? (row.draws ?? (row as any).drawn ?? 0) : 0;
          const pLosses = row ? (row.losses ?? (row as any).lost ?? 0) : 0;
          const pGF = row ? (row.gamesFor ?? (row as any).goalsFor ?? 0) : 0;
          const pGA = row ? (row.gamesAgainst ?? (row as any).goalsAgainst ?? 0) : 0;
          const pGD = row ? (row.gameDiff ?? (row as any).goalDifference ?? (pGF - pGA)) : 0;
          const pPts = row ? (row.points ?? 0) : 0;
          const pPlayed = row ? (row.played ?? 0) : 0;

          currentDiv = {
            divisionId: l.id,
            divisionName: l.name || `Division ${l.id}`,
            tierNumber: l.id,
            rank: rIdx !== -1 ? rIdx + 1 : (row?.rank ?? 1),
            totalInDiv: (l.memberIds || []).length,
            points: pPts,
            played: pPlayed,
            won: pWins,
            drawn: pDraws,
            lost: pLosses,
            goalsFor: pGF,
            goalsAgainst: pGA,
            goalDifference: pGD,
          };
          break;
        }
      }
    }

    // 2. All-Time League Matches for this idol across central matchDatabase + active leagueState + archives
    const allLeagueMatchesMap = new Map<string, ArchivedMatch>();

    // 2a. From central matchDatabase
    (matchDatabase || []).forEach((m) => {
      if (!m) return;
      const isMe = m.idolAId === idol.id || m.idolAName?.toLowerCase() === idol.name.toLowerCase() ||
                   m.idolBId === idol.id || m.idolBName?.toLowerCase() === idol.name.toLowerCase();
      if (!isMe) return;

      const isLeague = isLeagueDivisionMatch(m);

      // The Idols (own matchdays) and Swiss / LCQ are separate competitions, never division matches.
      const midLower = String(m.matchId || '').toLowerCase();
      const isOtherCompetition =
        midLower.startsWith('the_idols') || midLower.startsWith('swiss_') ||
        stage.startsWith('the idols') || stage.includes('swiss') || stage.includes('last chance') ||
        stage.includes('superleague') || stage.includes('masters');
      if (isLeague && !isOtherCompetition) {
        allLeagueMatchesMap.set(m.matchId, m);
      }
    });

    // 2b. Active season matches
    if (leagueState && Array.isArray(leagueState.leagues)) {
      const sNum = leagueState.seasonNumber || 1;
      const sName = leagueState.seasonName || `Season ${sNum}`;
      leagueState.leagues.forEach((l) => {
        (l.matches || []).forEach((m) => {
          if ((m.idolAId === idol.id || m.idolBId === idol.id) && m.completed && m.scoreA !== null && m.scoreB !== null) {
            const key = m.id.startsWith('league_s') ? m.id : `league_s${sNum}_div${l.id}_${m.id}`;
            if (!allLeagueMatchesMap.has(key)) {
              allLeagueMatchesMap.set(key, {
                matchId: key,
                seasonId: sNum,
                seasonName: sName,
                stage: `League - ${l.name} (MD ${m.matchday})`,
                groupName: l.name,
                idolAId: m.idolAId,
                idolAName: idolsMap.get(m.idolAId)?.name || 'Idol A',
                idolAGroup: idolsMap.get(m.idolAId)?.girlGroup || 'Solo',
                idolBId: m.idolBId,
                idolBName: idolsMap.get(m.idolBId)?.name || 'Idol B',
                idolBGroup: idolsMap.get(m.idolBId)?.girlGroup || 'Solo',
                scoreA: m.scoreA,
                scoreB: m.scoreB,
                winnerId: m.winnerId || (m.scoreA > m.scoreB ? m.idolAId : m.scoreB > m.scoreA ? m.idolBId : null),
                winnerName: m.winnerId === m.idolAId ? idolsMap.get(m.idolAId)?.name : m.winnerId === m.idolBId ? idolsMap.get(m.idolBId)?.name : 'Draw',
                loserId: m.scoreA > m.scoreB ? m.idolBId : m.scoreB > m.scoreA ? m.idolAId : null,
                loserName: m.scoreA > m.scoreB ? idolsMap.get(m.idolBId)?.name : m.scoreB > m.scoreA ? idolsMap.get(m.idolAId)?.name : null,
                isDraw: m.scoreA === m.scoreB,
                date: m.updatedAt || new Date().toISOString(),
              });
            }
          }
        });
      });
    }

    // 2c. League archives matches
    if (Array.isArray(leagueArchives)) {
      leagueArchives.forEach((arch) => {
        const sNum = arch.seasonNumber || 1;
        const sName = arch.seasonName || `Season ${sNum}`;
        (arch.allMatches || []).forEach((m) => {
          if ((m.idolAId === idol.id || m.idolBId === idol.id) && (m.completed || (m.scoreA !== null && m.scoreB !== null))) {
            const key = m.id.startsWith('league_s') ? m.id : `league_s${sNum}_div${m.leagueId || '1'}_${m.id}`;
            if (!allLeagueMatchesMap.has(key)) {
              allLeagueMatchesMap.set(key, {
                matchId: key,
                seasonId: sNum,
                seasonName: sName,
                stage: `League - Division ${m.leagueId} (MD ${m.matchday})`,
                groupName: `Division ${m.leagueId}`,
                idolAId: m.idolAId,
                idolAName: idolsMap.get(m.idolAId)?.name || 'Idol A',
                idolAGroup: idolsMap.get(m.idolAId)?.girlGroup || 'Solo',
                idolBId: m.idolBId,
                idolBName: idolsMap.get(m.idolBId)?.name || 'Idol B',
                idolBGroup: idolsMap.get(m.idolBId)?.girlGroup || 'Solo',
                scoreA: m.scoreA,
                scoreB: m.scoreB,
                winnerId: m.winnerId || (m.scoreA !== null && m.scoreB !== null && m.scoreA > m.scoreB ? m.idolAId : m.scoreB !== null && m.scoreA !== null && m.scoreB > m.scoreA ? m.idolBId : null),
                winnerName: m.winnerId === m.idolAId ? idolsMap.get(m.idolAId)?.name : m.winnerId === m.idolBId ? idolsMap.get(m.idolBId)?.name : 'Draw',
                loserId: m.scoreA !== null && m.scoreB !== null && m.scoreA > m.scoreB ? m.idolBId : m.idolAId,
                loserName: m.scoreA !== null && m.scoreB !== null && m.scoreA > m.scoreB ? idolsMap.get(m.idolBId)?.name : idolsMap.get(m.idolAId)?.name,
                isDraw: m.scoreA === m.scoreB,
                date: m.updatedAt || arch.completedAt || new Date().toISOString(),
              });
            }
          }
        });
      });
    }

    const allLeagueMatchesList = Array.from(allLeagueMatchesMap.values());

    // Aggregate statistics across all seasons
    let totalM = 0;
    let totalW = 0;
    let totalD = 0;
    let totalL = 0;
    let totalGF = 0;
    let totalGA = 0;
    let totalPts = 0;

    allLeagueMatchesList.forEach((m) => {
      if (m.scoreA === null || m.scoreB === null || m.scoreA === undefined || m.scoreB === undefined) return;
      const isA = m.idolAId === idol.id || m.idolAName?.toLowerCase() === idol.name.toLowerCase();
      const myScore = isA ? m.scoreA : m.scoreB;
      const oppScore = isA ? m.scoreB : m.scoreA;

      totalM += 1;
      totalGF += myScore;
      totalGA += oppScore;

      if (myScore > oppScore) {
        totalW += 1;
        totalPts += 3;
      } else if (myScore < oppScore) {
        totalL += 1;
      } else {
        totalD += 1;
        totalPts += 1;
      }
    });

    // 3. Division Titles & Past Season Standings
    const divTitles: Array<{ seasonNumber: number; divisionId: number; divisionName: string }> = [];
    const pastSeasonsList: Array<{
      seasonNumber: number;
      divisionId: number;
      divisionName: string;
      rank: number;
      points: number;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      isChampion: boolean;
    }> = [];

    if (Array.isArray(leagueArchives)) {
      leagueArchives.forEach((arch) => {
        if (!arch) return;
        const sNum = arch.seasonNumber || 1;

        // Check if idol won any division title in this archive
        (arch.leagueWinners || []).forEach((w) => {
          if (w.championId === idol.id || w.championName?.toLowerCase() === idol.name.toLowerCase()) {
            divTitles.push({
              seasonNumber: sNum,
              divisionId: w.leagueId,
              divisionName: w.leagueName || `Division ${w.leagueId}`,
            });
          }
        });

        // Try reading allStandings
        let foundInArchive = false;
        if (arch.allStandings && typeof arch.allStandings === 'object') {
          Object.entries(arch.allStandings).forEach(([divIdStr, standingsList]) => {
            const divId = Number(divIdStr);
            if (Array.isArray(standingsList)) {
              const sorted = [...standingsList].sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if ((b.gameDiff ?? 0) !== (a.gameDiff ?? 0)) return (b.gameDiff ?? 0) - (a.gameDiff ?? 0);
                return (b.gamesFor ?? 0) - (a.gamesFor ?? 0);
              });

              const rIdx = sorted.findIndex((r) => r.idolId === idol.id);
              if (rIdx !== -1) {
                foundInArchive = true;
                const row = sorted[rIdx];
                const isChamp = rIdx === 0 || arch.leagueWinners?.some((w) => w.leagueId === divId && (w.championId === idol.id || w.championName?.toLowerCase() === idol.name.toLowerCase()));
                const winnerEntry = arch.leagueWinners?.find((w) => w.leagueId === divId);
                const divName = winnerEntry?.leagueName || `Division ${divId}`;

                const pWins = row.wins ?? (row as any).won ?? 0;
                const pDraws = row.draws ?? (row as any).drawn ?? 0;
                const pLosses = row.losses ?? (row as any).lost ?? 0;
                const pPts = row.points ?? 0;
                const pPlayed = row.played ?? 0;

                pastSeasonsList.push({
                  seasonNumber: sNum,
                  divisionId: divId,
                  divisionName: divName,
                  rank: rIdx + 1,
                  points: pPts,
                  played: pPlayed,
                  won: pWins,
                  drawn: pDraws,
                  lost: pLosses,
                  isChampion: Boolean(isChamp),
                });
              }
            }
          });
        }

        // Fallback: If not in allStandings, check matches for that season
        if (!foundInArchive && arch.allMatches) {
          const seasonMatches = (arch.allMatches || []).filter(
            (m) => (m.idolAId === idol.id || m.idolBId === idol.id) && (m.completed || (m.scoreA !== null && m.scoreB !== null))
          );
          if (seasonMatches.length > 0) {
            let sPlayed = 0;
            let sWon = 0;
            let sDrawn = 0;
            let sLost = 0;
            let sPts = 0;
            const divId = seasonMatches[0].leagueId || 1;

            seasonMatches.forEach((sm) => {
              sPlayed++;
              const isA = sm.idolAId === idol.id;
              const mySc = isA ? sm.scoreA : sm.scoreB;
              const oppSc = isA ? sm.scoreB : sm.scoreA;
              if (mySc! > oppSc!) { sWon++; sPts += 3; }
              else if (mySc! < oppSc!) { sLost++; }
              else { sDrawn++; sPts += 1; }
            });

            pastSeasonsList.push({
              seasonNumber: sNum,
              divisionId: divId,
              divisionName: `Division ${divId}`,
              rank: 1,
              points: sPts,
              played: sPlayed,
              won: sWon,
              drawn: sDrawn,
              lost: sLost,
              isChampion: false,
            });
          }
        }
      });
    }

    // Sort past seasons newest first
    pastSeasonsList.sort((a, b) => b.seasonNumber - a.seasonNumber);

    // Recent League Matches sorted newest first with accurate matchday & division info
    const sortedRecentLeagueMatches = [...allLeagueMatchesList]
      .sort((a, b) => compareMatchesNewestFirst(a, b))
      .map((m) => {
        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);

        let md = 1;
        const mdMatch = m.stage?.match(/MD\s*(\d+)/i) || m.stage?.match(/Matchday\s*(\d+)/i);
        if (mdMatch) md = parseInt(mdMatch[1], 10);

        let divName = m.groupName || m.stage || 'Division Match';
        let divId = 1;
        const divMatch = m.stage?.match(/Division\s*(\d+)/i) || m.groupName?.match(/Division\s*(\d+)/i);
        if (divMatch) {
          divId = parseInt(divMatch[1], 10);
        } else if ((m as any).leagueId) {
          divId = Number((m as any).leagueId);
        }

        return {
          matchId: m.matchId,
          seasonNumber: m.seasonId,
          divisionId: divId,
          divisionName: divName,
          matchday: md,
          homeIdolId: m.idolAId,
          homeIdolName: m.idolAName || idolA?.name || 'Player A',
          awayIdolId: m.idolBId,
          awayIdolName: m.idolBName || idolB?.name || 'Player B',
          homeScore: m.scoreA,
          awayScore: m.scoreB,
          isCompleted: true,
          date: m.date,
        };
      });

    // Deduplicate division titles
    const uniqueDivTitlesMap = new Map<string, { seasonNumber: number; divisionId: number; divisionName: string }>();
    divTitles.forEach((t) => {
      uniqueDivTitlesMap.set(`${t.seasonNumber}-${t.divisionId}`, t);
    });
    const uniqueDivTitles = Array.from(uniqueDivTitlesMap.values());

    return {
      currentDivision: currentDiv,
      totalLeagueMatches: totalM,
      totalLeagueWins: totalW,
      totalLeagueDraws: totalD,
      totalLeagueLosses: totalL,
      totalLeagueGoalsFor: totalGF,
      totalLeagueGoalsAgainst: totalGA,
      totalLeaguePoints: totalPts,
      divisionTitlesCount: uniqueDivTitles.length,
      divisionTitles: uniqueDivTitles,
      pastSeasons: pastSeasonsList,
      recentLeagueMatches: sortedRecentLeagueMatches.slice(0, 15),
    };
  }, [idol, idols, matchDatabase, leagueState, leagueArchives]);

  // --- THE IDOLS (SUPERLEAGUE) DATA COMPUTATION ---
  const theIdolsData = useMemo(() => {
    if (!idol) {
      return {
        currentStanding: null,
        totalMatches: 0,
        totalWins: 0,
        totalDraws: 0,
        totalLosses: 0,
        totalGoalsFor: 0,
        totalGoalsAgainst: 0,
        totalPoints: 0,
        mastersTitlesCount: 0,
        regularSeasonTitlesCount: 0,
        pastSeasons: [] as Array<{
          seasonNumber: number;
          rank: number;
          points: number;
          played: number;
          won: number;
          drawn: number;
          lost: number;
          goalsFor: number;
          goalsAgainst: number;
          goalDiff: number;
          isChampion: boolean;
          isPlayoffParticipant: boolean;
          playoffFinish: string;
        }>,
        recentMatches: [] as any[],
      };
    }

    let totalM = 0;
    let totalW = 0;
    let totalD = 0;
    let totalL = 0;
    let totalGF = 0;
    let totalGA = 0;
    let totalPts = 0;
    let mastersTitles = 0;
    let regularSeasonTitles = 0;

    const pastSeasonsList: Array<{
      seasonNumber: number;
      rank: number;
      points: number;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDiff: number;
      isChampion: boolean;
      isPlayoffParticipant: boolean;
      playoffFinish: string;
    }> = [];

    // Check archived seasons
    (theIdolsArchives || []).forEach((arch) => {
      const sNum = arch.seasonNumber;
      const row = (arch.standings || []).find(
        (s) => s.idolId === idol.id || s.idolName?.toLowerCase() === idol.name?.toLowerCase()
      );
      if (row) {
        const played = Number(row.played || 0);
        const won = Number(row.wins ?? (row as any).won ?? 0);
        const drawn = Number(row.draws ?? (row as any).drawn ?? 0);
        const lost = Number(row.losses ?? (row as any).lost ?? 0);
        const gf = Number(row.gamesFor ?? (row as any).goalsFor ?? 0);
        const ga = Number(row.gamesAgainst ?? (row as any).goalsAgainst ?? 0);
        const pts = Number(row.points || 0);
        const gd = Number(row.gameDiff ?? (gf - ga));

        totalM += played;
        totalW += won;
        totalD += drawn;
        totalL += lost;
        totalGF += gf;
        totalGA += ga;
        totalPts += pts;

        const rank = (arch.standings || []).findIndex((s) => s.idolId === row.idolId) + 1;
        if (rank === 1) regularSeasonTitles += 1;

        let isChamp = false;
        let isPlayoff = rank <= 4;
        let playoffFinish = rank <= 4 ? 'Playoff Semifinals' : 'Regular Season';

        if (
          arch.championId === idol.id ||
          arch.championName?.toLowerCase() === idol.name?.toLowerCase() ||
          (arch as any).champion?.idolId === idol.id ||
          (arch as any).champion?.name?.toLowerCase() === idol.name?.toLowerCase()
        ) {
          isChamp = true;
          mastersTitles += 1;
          playoffFinish = 'Masters Champion';
        } else if (
          arch.runnerUpId === idol.id ||
          arch.runnerUpName?.toLowerCase() === idol.name?.toLowerCase() ||
          (arch as any).runnerUp?.idolId === idol.id ||
          (arch as any).runnerUp?.name?.toLowerCase() === idol.name?.toLowerCase()
        ) {
          playoffFinish = 'Masters Runner-Up';
        } else if (
          arch.thirdPlaceId === idol.id ||
          arch.thirdPlaceName?.toLowerCase() === idol.name?.toLowerCase() ||
          (arch as any).thirdPlace?.idolId === idol.id ||
          (arch as any).thirdPlace?.name?.toLowerCase() === idol.name?.toLowerCase()
        ) {
          playoffFinish = 'Masters 3rd Place';
        } else if (isPlayoff) {
          playoffFinish = 'Masters 4th Place';
        }

        pastSeasonsList.push({
          seasonNumber: sNum,
          rank: rank > 0 ? rank : 0,
          points: pts,
          played,
          won,
          drawn,
          lost,
          goalsFor: gf,
          goalsAgainst: ga,
          goalDiff: gd,
          isChampion: isChamp,
          isPlayoffParticipant: isPlayoff,
          playoffFinish,
        });
      }
    });

    // Check active season
    let currentStanding = null;
    if (theIdolsState && theIdolsState.standings) {
      const standingIndex = theIdolsState.standings.findIndex(
        (s) => s.idolId === idol.id || s.idolName?.toLowerCase() === idol.name?.toLowerCase()
      );
      if (standingIndex !== -1) {
        const s = theIdolsState.standings[standingIndex];
        const sPlayed = Number(s.played || 0);
        const sWon = Number(s.wins ?? (s as any).won ?? 0);
        const sDrawn = Number(s.draws ?? (s as any).drawn ?? 0);
        const sLost = Number(s.losses ?? (s as any).lost ?? 0);
        const sGF = Number(s.gamesFor ?? (s as any).goalsFor ?? 0);
        const sGA = Number(s.gamesAgainst ?? (s as any).goalsAgainst ?? 0);
        const sPts = Number(s.points || 0);

        currentStanding = {
          ...s,
          rank: standingIndex + 1,
          totalInLeague: (theIdolsState.standings || []).length,
          inPlayoffZone: standingIndex < 4,
          isPlayoffComplete: theIdolsState.isPlayoffCompleted,
        };
        totalM += sPlayed;
        totalW += sWon;
        totalD += sDrawn;
        totalL += sLost;
        totalGF += sGF;
        totalGA += sGA;
        totalPts += sPts;

        if ((theIdolsState.isLeagueCompleted || theIdolsState.isCompleted) && standingIndex === 0) {
          regularSeasonTitles += 1;
        }
        if (theIdolsState.isPlayoffCompleted && (theIdolsState.championId === idol.id || theIdolsState.championName?.toLowerCase() === idol.name?.toLowerCase())) {
          mastersTitles += 1;
        }
      }
    }

    // Compute recent matches for this idol in active season
    const activeRecentMatches: any[] = [];
    if (theIdolsState && theIdolsState.matches) {
      theIdolsState.matches.forEach((m) => {
        if (
          m.isCompleted &&
          (m.homeIdolId === idol.id ||
            m.awayIdolId === idol.id ||
            m.homeIdolName?.toLowerCase() === idol.name?.toLowerCase() ||
            m.awayIdolName?.toLowerCase() === idol.name?.toLowerCase())
        ) {
          activeRecentMatches.push(m);
        }
      });
    }
    const sortedRecentMatches = activeRecentMatches.sort((a, b) => (b.matchday || 0) - (a.matchday || 0));

    return {
      currentStanding,
      totalMatches: totalM,
      totalWins: totalW,
      totalDraws: totalD,
      totalLosses: totalL,
      totalGoalsFor: totalGF,
      totalGoalsAgainst: totalGA,
      totalPoints: totalPts,
      mastersTitlesCount: mastersTitles,
      regularSeasonTitlesCount: regularSeasonTitles,
      pastSeasons: pastSeasonsList.sort((a, b) => b.seasonNumber - a.seasonNumber),
      recentMatches: sortedRecentMatches.slice(0, 15),
    };
  }, [idol, theIdolsState, theIdolsArchives]);

  // --- TOURNAMENT SEASONS COMPUTATION ---
  const tournamentPastSeasons = useMemo(() => {
    if (!idol) return [];
    const idolsMap = new Map<string, Idol>();
    idols.forEach((i) => idolsMap.set(i.id, i));

    const allSeasons = getAllSeasonArchives(
      archives,
      matchDatabase,
      idolsMap,
      config,
      groups,
      knockoutMatches
    );

    const history: Array<{
      seasonId: number;
      seasonName: string;
      stageReached: string;
      isChampion: boolean;
      isRunnerUp: boolean;
      isThirdPlace: boolean;
      matches: number;
      won: number;
      drawn: number;
      lost: number;
      pointsScored: number;
      pointsConceded: number;
      groupName?: string;
    }> = [];

    allSeasons.forEach((arch) => {
      const sId = Number(arch.seasonId || 1);
      const sName = arch.seasonName || `Season ${sId}`;

      // Check matches for this season in matchDatabase (strictly exclude league matches)
      const seasonMatches = (matchDatabase || []).filter((m) => {
        if (Number(m.seasonId) !== sId) return false;
        const isLeague = isLeagueDivisionMatch(m);
        if (isLeague) return false;
        return (
          m.idolAId === idol.id ||
          m.idolAName?.toLowerCase() === idol.name.toLowerCase() ||
          m.idolBId === idol.id ||
          m.idolBName?.toLowerCase() === idol.name.toLowerCase()
        );
      });

      // Check if idol participated in groups or knockout
      let participated = seasonMatches.length > 0;
      let groupNameFound: string | undefined;

      (arch.groups || []).forEach((g) => {
        const mems = g.members || (g as any).memberIds || [];
        if (mems.includes(idol.id)) {
          participated = true;
          groupNameFound = g.name;
        }
      });

      (arch.knockoutMatches || []).forEach((km) => {
        if (km.idolAId === idol.id || km.idolBId === idol.id) {
          participated = true;
        }
      });

      if (
        (arch.championId && arch.championId === idol.id) ||
        (arch.runnerUpId && arch.runnerUpId === idol.id) ||
        (arch.thirdPlaceId && arch.thirdPlaceId === idol.id)
      ) {
        participated = true;
      }

      if (!participated) return;

      // Determine highest stage reached in tournament cup
      const isChamp = Boolean(arch.championId && (arch.championId === idol.id || arch.championName?.toLowerCase() === idol.name.toLowerCase()));
      const isRunner = Boolean(arch.runnerUpId && (arch.runnerUpId === idol.id || arch.runnerUpName?.toLowerCase() === idol.name.toLowerCase()));
      const isThird = Boolean(arch.thirdPlaceId && (arch.thirdPlaceId === idol.id || arch.thirdPlaceName?.toLowerCase() === idol.name.toLowerCase()));

      let stageReached = 'Group Stage';
      if (isChamp) stageReached = 'Champion 🏆';
      else if (isRunner) stageReached = 'Runner-Up 🥈';
      else if (isThird) stageReached = '3rd Place 🥉';
      else {
        const koStages = seasonMatches.map((m) => (m.stage || '').toLowerCase());
        if (koStages.some((s) => s.includes('semi'))) stageReached = 'Semi-Finals';
        else if (koStages.some((s) => s.includes('quarter') || s.includes('qf'))) stageReached = 'Quarter-Finals';
        else if (koStages.some((s) => s.includes('16') || s.includes('r16') || s.includes('octa'))) stageReached = 'Round of 16';
        else if (koStages.some((s) => s.includes('32') || s.includes('r32'))) stageReached = 'Round of 32';
        else if (koStages.some((s) => s.includes('play-in') || s.includes('wildcard'))) stageReached = 'Play-In Round';
      }

      let mCount = 0,
        wCount = 0,
        dCount = 0,
        lCount = 0,
        gf = 0,
        ga = 0;
      seasonMatches.forEach((m) => {
        mCount++;
        const isA = m.idolAId === idol.id || m.idolAName?.toLowerCase() === idol.name.toLowerCase();
        const mySc = isA ? m.scoreA ?? 0 : m.scoreB ?? 0;
        const oppSc = isA ? m.scoreB ?? 0 : m.scoreA ?? 0;
        gf += mySc;
        ga += oppSc;
        if (m.winnerId === idol.id || (isA && mySc > oppSc) || (!isA && oppSc > mySc)) wCount++;
        else if (m.isDraw || m.winnerId === 'DRAW' || mySc === oppSc) dCount++;
        else lCount++;
      });

      history.push({
        seasonId: sId,
        seasonName: sName,
        stageReached,
        isChampion: isChamp,
        isRunnerUp: isRunner,
        isThirdPlace: isThird,
        matches: mCount,
        won: wCount,
        drawn: dCount,
        lost: lCount,
        pointsScored: gf,
        pointsConceded: ga,
        groupName: groupNameFound,
      });
    });

    return history.sort((a, b) => b.seasonId - a.seasonId);
  }, [idol, idols, archives, matchDatabase, config, groups, knockoutMatches]);

  // Helper to distinguish The Idols (Superleague) matches
  const isMatchTheIdols = (m: ArchivedMatch): boolean => {
    return isTheIdolsMatch(m);
  };

  // Helper to distinguish League vs Tournament matches
  const isMatchLeague = (m: ArchivedMatch): boolean => {
    if (isMatchTheIdols(m)) return false;
    return isLeagueDivisionMatch(m);
  };

  // All matches for this idol (League, The Idols, and Tournament combined), sorted newest to oldest chronologically
  const idolMatches = useMemo(() => {
    if (!idol) return [];
    const matches = (matchDatabase || []).filter((m) => {
      if (!m) return false;
      const isMe =
        m.idolAId === idol.id ||
        m.idolBId === idol.id ||
        m.idolAName?.toLowerCase() === idol.name.toLowerCase() ||
        m.idolBName?.toLowerCase() === idol.name.toLowerCase();
      return (
        isMe &&
        m.scoreA !== null &&
        m.scoreB !== null &&
        m.scoreA !== undefined &&
        m.scoreB !== undefined
      );
    });
    return [...matches].sort((a, b) => compareMatchesNewestFirst(a, b));
  }, [matchDatabase, idol]);

  const idolTournamentMatches = useMemo(() => {
    return idolMatches.filter((m) => !isMatchLeague(m) && !isMatchTheIdols(m));
  }, [idolMatches]);

  const idolLeagueMatches = useMemo(() => {
    return idolMatches.filter((m) => isMatchLeague(m));
  }, [idolMatches]);

  const idolTheIdolsMatches = useMemo(() => {
    return idolMatches.filter((m) => isMatchTheIdols(m));
  }, [idolMatches]);

  // Streak calculation helper (chronological oldest to newest)
  const calculateStreakStats = (matches: ArchivedMatch[]) => {
    const sorted = [...matches].sort((a, b) => compareMatchesNewestFirst(b, a));
    let curWin = 0;
    let maxWin = 0;
    let curUnbeaten = 0;
    let maxUnbeaten = 0;

    sorted.forEach((m) => {
      const isA = m.idolAId === idol?.id || m.idolAName?.toLowerCase() === idol?.name?.toLowerCase();
      const myScore = isA ? Number(m.scoreA ?? 0) : Number(m.scoreB ?? 0);
      const oppScore = isA ? Number(m.scoreB ?? 0) : Number(m.scoreA ?? 0);
      const isWin =
        m.winnerId === idol?.id ||
        (m.winnerName && idol?.name && m.winnerName.toLowerCase() === idol.name.toLowerCase()) ||
        myScore > oppScore;
      const isDraw = m.isDraw || m.winnerId === 'DRAW' || myScore === oppScore;

      if (isWin) {
        curWin += 1;
        curUnbeaten += 1;
        if (curWin > maxWin) maxWin = curWin;
        if (curUnbeaten > maxUnbeaten) maxUnbeaten = curUnbeaten;
      } else if (isDraw) {
        curWin = 0;
        curUnbeaten += 1;
        if (curUnbeaten > maxUnbeaten) maxUnbeaten = curUnbeaten;
      } else {
        curWin = 0;
        curUnbeaten = 0;
      }
    });

    return { longestWinStreak: maxWin, longestUnbeatenStreak: maxUnbeaten };
  };

  // Performance data for Combined Career
  const combinedPerformance = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;

    idolMatches.forEach((m) => {
      const isA = m.idolAId === idol?.id || m.idolAName?.toLowerCase() === idol?.name?.toLowerCase();
      const myScore = isA ? Number(m.scoreA ?? 0) : Number(m.scoreB ?? 0);
      const oppScore = isA ? Number(m.scoreB ?? 0) : Number(m.scoreA ?? 0);
      gf += myScore;
      ga += oppScore;
      if (
        m.winnerId === idol?.id ||
        (m.winnerName && idol?.name && m.winnerName.toLowerCase() === idol.name.toLowerCase()) ||
        myScore > oppScore
      ) {
        wins += 1;
      } else if (m.isDraw || m.winnerId === 'DRAW' || myScore === oppScore) {
        draws += 1;
      } else {
        losses += 1;
      }
    });

    const matches = idolMatches.length;
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const streaks = calculateStreakStats(idolMatches);
    const idolOv = idol ? careerOverrides[idol.id] : undefined;
    const isOverridden = idolOv && idolOv.enabled;
    const cupChampionships = isOverridden && idolOv.championships !== undefined ? idolOv.championships : (stat?.championships || 0);
    const divTitles = isOverridden && idolOv.divisionTitles !== undefined ? idolOv.divisionTitles : (leagueData?.divisionTitlesCount || 0);
    const superleagueRegTitles = isOverridden && idolOv.theIdolsSuperleagueTitles !== undefined ? idolOv.theIdolsSuperleagueTitles : (theIdolsData?.regularSeasonTitlesCount || 0);
    const mastersTitles = isOverridden && idolOv.theIdolsMastersTitles !== undefined ? idolOv.theIdolsMastersTitles : (theIdolsData?.mastersTitlesCount || 0);
    const totalTitles = calculateUnifiedTotalTitles(cupChampionships, divTitles, superleagueRegTitles, mastersTitles);
    const podiums =
      cupChampionships +
      (stat?.runnerUps || 0) +
      (stat?.thirdPlaces || 0) +
      (isOverridden && idolOv.divisionPodiums !== undefined ? idolOv.divisionPodiums : (leagueData?.pastSeasons || []).filter((s) => s.rank <= 3).length) +
      (isOverridden && idolOv.theIdolsMastersPodiums !== undefined ? idolOv.theIdolsMastersPodiums : (theIdolsData?.pastSeasons || []).filter((s) => s.playoffFinish?.includes('Champion') || s.playoffFinish?.includes('Runner-Up') || s.playoffFinish?.includes('3rd Place')).length);

    return {
      matches,
      wins,
      draws,
      losses,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: gf - ga,
      winRate,
      avgPoints: matches > 0 ? (gf / matches).toFixed(1) : '0.0',
      totalTitles,
      podiums,
      longestWinStreak: streaks.longestWinStreak,
      longestUnbeatenStreak: streaks.longestUnbeatenStreak,
    };
  }, [idolMatches, idol, stat, leagueData, theIdolsData]);

  // Performance data for Tournament Cup Career
  const tournamentPerformance = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let gf = 0;
    let ga = 0;

    idolTournamentMatches.forEach((m) => {
      const isA = m.idolAId === idol?.id || m.idolAName?.toLowerCase() === idol?.name?.toLowerCase();
      const myScore = isA ? Number(m.scoreA ?? 0) : Number(m.scoreB ?? 0);
      const oppScore = isA ? Number(m.scoreB ?? 0) : Number(m.scoreA ?? 0);
      gf += myScore;
      ga += oppScore;
      if (
        m.winnerId === idol?.id ||
        (m.winnerName && idol?.name && m.winnerName.toLowerCase() === idol.name.toLowerCase()) ||
        myScore > oppScore
      ) {
        wins += 1;
      } else if (m.isDraw || m.winnerId === 'DRAW' || myScore === oppScore) {
        draws += 1;
      } else {
        losses += 1;
      }
    });

    const matches = idolTournamentMatches.length;
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : (stat?.winRate || 0);
    const streaks = calculateStreakStats(idolTournamentMatches);

    return {
      matches: matches > 0 ? matches : (stat?.matches || 0),
      wins: matches > 0 ? wins : (stat?.wins || 0),
      draws: matches > 0 ? draws : (stat?.draws || 0),
      losses: matches > 0 ? losses : (stat?.losses || 0),
      goalsFor: matches > 0 ? gf : (stat?.gamesFor || 0),
      goalsAgainst: matches > 0 ? ga : (stat?.gamesAgainst || 0),
      goalDiff: matches > 0 ? gf - ga : (stat?.gameDiff || 0),
      winRate,
      avgPoints: matches > 0 ? (gf / matches).toFixed(1) : (stat?.matches ? (stat.gamesFor / stat.matches).toFixed(1) : '0.0'),
      groupWins: stat?.groupWins || 0,
      groupLosses: stat?.groupLosses || 0,
      groupWinRate: stat?.groupWinRate || 0,
      knockoutWins: stat?.knockoutWins || 0,
      knockoutLosses: stat?.knockoutLosses || 0,
      knockoutWinRate: stat?.knockoutWinRate || 0,
      championships: stat?.championships || 0,
      runnerUps: stat?.runnerUps || 0,
      thirdPlaces: stat?.thirdPlaces || 0,
      top4: stat?.top4 || 0,
      quarterFinals: stat?.quarterFinals || 0,
      participations: stat?.participations || 0,
      groupAdvancements: stat?.groupAdvancements || 0,
      groupExits: stat?.groupExits || 0,
      longestWinStreak: streaks.longestWinStreak || stat?.longestWinStreak || 0,
      longestUnbeatenStreak: streaks.longestUnbeatenStreak || stat?.longestUnbeatenStreak || 0,
    };
  }, [idolTournamentMatches, idol, stat]);

  // Performance data for League Division Career
  const leaguePerformance = useMemo(() => {
    const streaks = calculateStreakStats(idolLeagueMatches);
    const matches = leagueData.totalLeagueMatches;
    const wins = leagueData.totalLeagueWins;
    const draws = leagueData.totalLeagueDraws;
    const losses = leagueData.totalLeagueLosses;
    const gf = leagueData.totalLeagueGoalsFor;
    const ga = leagueData.totalLeagueGoalsAgainst;
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const podiums = (leagueData?.pastSeasons || []).filter((s) => s.rank <= 3).length;
    const championsQualifiers = (leagueData?.pastSeasons || []).filter((s) => s.rank <= 5).length;

    return {
      matches,
      wins,
      draws,
      losses,
      points: leagueData?.totalLeaguePoints || 0,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: gf - ga,
      winRate,
      avgPoints: matches > 0 ? (gf / matches).toFixed(1) : '0.0',
      divisionTitles: leagueData?.divisionTitlesCount || 0,
      podiums,
      championsQualifiers,
      currentDivision: leagueData?.currentDivision || 'Div 1',
      longestWinStreak: streaks.longestWinStreak,
      longestUnbeatenStreak: streaks.longestUnbeatenStreak,
    };
  }, [idolLeagueMatches, leagueData]);

  // Performance data for The Idols (Superleague) Career
  const theIdolsPerformance = useMemo(() => {
    const streaks = calculateStreakStats(idolTheIdolsMatches);
    const matches = theIdolsData?.totalMatches || 0;
    const wins = theIdolsData?.totalWins || 0;
    const draws = theIdolsData?.totalDraws || 0;
    const losses = theIdolsData?.totalLosses || 0;
    const gf = theIdolsData?.totalGoalsFor || 0;
    const ga = theIdolsData?.totalGoalsAgainst || 0;
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const playoffAppearances = (theIdolsData?.pastSeasons || []).filter((s) => s.isPlayoffParticipant).length;
    const playoffPodiums = (theIdolsData?.pastSeasons || []).filter(
      (s) =>
        s.playoffFinish?.includes('Champion') ||
        s.playoffFinish?.includes('Runner-Up') ||
        s.playoffFinish?.includes('3rd Place')
    ).length;

    return {
      matches,
      wins,
      draws,
      losses,
      points: theIdolsData.totalPoints,
      goalsFor: gf,
      goalsAgainst: ga,
      goalDiff: gf - ga,
      winRate,
      avgPoints: matches > 0 ? (gf / matches).toFixed(1) : '0.0',
      mastersTitles: theIdolsData.mastersTitlesCount,
      regularSeasonTitles: theIdolsData.regularSeasonTitlesCount,
      playoffAppearances,
      playoffPodiums,
      currentStanding: theIdolsData.currentStanding,
      longestWinStreak: streaks.longestWinStreak,
      longestUnbeatenStreak: streaks.longestUnbeatenStreak,
    };
  }, [idolTheIdolsMatches, theIdolsData]);

  // Combined stats (accurately sums Tournament Cup + League + Superleague matches and titles)
  const combinedMatches = combinedPerformance.matches;
  const combinedWins = combinedPerformance.wins;
  const combinedDraws = combinedPerformance.draws;
  const combinedLosses = combinedPerformance.losses;
  const combinedChampionships = combinedPerformance.totalTitles;
  const combinedWinRate = combinedPerformance.winRate;

  // Filtered match history log
  const filteredMatches = useMemo(() => {
    if (matchFilter === 'all') return idolMatches;
    if (matchFilter === 'league') return idolMatches.filter(isMatchLeague);
    if (matchFilter === 'the_idols') return idolMatches.filter(isMatchTheIdols);
    return idolMatches.filter((m) => !isMatchLeague(m) && !isMatchTheIdols(m));
  }, [idolMatches, matchFilter]);

  const totalMatchPages = Math.ceil(filteredMatches.length / matchesPerPage) || 1;
  const paginatedIdolMatches = useMemo(() => {
    const start = (matchPage - 1) * matchesPerPage;
    return filteredMatches.slice(start, start + matchesPerPage);
  }, [filteredMatches, matchPage, matchesPerPage]);

  // Reset match page when filter or idol changes
  useEffect(() => {
    setMatchPage(1);
  }, [matchFilter, currentIdolId]);

  // Get Top 5 H2H Rivals
  const topH2HRivals: OpponentH2HRecord[] = idol
    ? getTopH2HRecordsForIdol(idol.id, matchDatabase, idols, 5)
    : [];

  // Update default selected opponent when idol changes
  useEffect(() => {
    if (topH2HRivals.length > 0) {
      setSelectedH2HOpponentId(topH2HRivals[0].opponentId);
    } else {
      const otherIdol = idols.find((i) => i.id !== currentIdolId);
      setSelectedH2HOpponentId(otherIdol?.id || '');
    }
  }, [currentIdolId, topH2HRivals.length]);

  const selectedOpponent = idols.find((i) => i.id === selectedH2HOpponentId);

  // Calculate direct H2H between current idol and selectedOpponent
  const directMatches = useMemo(() => {
    if (!idol || !selectedH2HOpponentId) return [];
    const matches = matchDatabase.filter((m) => {
      if (!m || m.scoreA === null || m.scoreB === null) return false;
      const isA = m.idolAId === idol.id || m.idolAName?.toLowerCase() === idol.name.toLowerCase();
      const isB = m.idolBId === idol.id || m.idolBName?.toLowerCase() === idol.name.toLowerCase();
      const isOppA = m.idolAId === selectedH2HOpponentId || m.idolAName?.toLowerCase() === selectedOpponent?.name?.toLowerCase();
      const isOppB = m.idolBId === selectedH2HOpponentId || m.idolBName?.toLowerCase() === selectedOpponent?.name?.toLowerCase();
      return (isA && isOppB) || (isB && isOppA);
    });
    // Sort Newest to Oldest chronologically
    return [...matches].sort((a, b) => compareMatchesNewestFirst(a, b));
  }, [matchDatabase, idol, selectedH2HOpponentId, selectedOpponent]);

  const directWins = directMatches.filter((m) => {
    const isA = m.idolAId === idol?.id || m.idolAName?.toLowerCase() === idol?.name?.toLowerCase();
    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    const myScore = isA ? scoreA : scoreB;
    const oppScore = isA ? scoreB : scoreA;
    return (
      m.winnerId === idol?.id ||
      (m.winnerName && idol?.name && m.winnerName.toLowerCase() === idol.name.toLowerCase()) ||
      myScore > oppScore
    );
  }).length;

  const directDraws = directMatches.filter((m) => {
    const isA = m.idolAId === idol?.id || m.idolAName?.toLowerCase() === idol?.name?.toLowerCase();
    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    return m.isDraw || m.winnerId === 'DRAW' || scoreA === scoreB;
  }).length;

  const directLosses = directMatches.length - directWins - directDraws;
  const directWinRate = directMatches.length > 0 ? Math.round((directWins / directMatches.length) * 100) : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && idol && onUpdateIdolPhoto) {
      try {
        const compressed = await compressImage(file, 400, 400, 0.85);
        onUpdateIdolPhoto(idol.id, compressed);
        setPhotoModalOpen(false);
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            onUpdateIdolPhoto(idol.id, reader.result);
            setPhotoModalOpen(false);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (customPhotoUrl.trim() && idol && onUpdateIdolPhoto) {
      try {
        const compressed = await compressImage(customPhotoUrl.trim(), 400, 400, 0.85);
        onUpdateIdolPhoto(idol.id, compressed);
      } catch {
        onUpdateIdolPhoto(idol.id, customPhotoUrl.trim());
      }
      setPhotoModalOpen(false);
      setCustomPhotoUrl('');
    }
  };

  if (!idol) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/60 pb-4">
        <div>
          <h2 className="text-2xl font-black text-amber-300 font-poster-title flex items-center gap-2">
            <User className="h-6 w-6 text-amber-400" />
            <span>Idol Profile &amp; Career History</span>
          </h2>
          <p className="text-xs text-amber-200/70 mt-1">
            Comprehensive profile, career statistics, Head-to-Head rivalries, and full match records.
          </p>
        </div>

        <div className="w-full md:w-72">
          <SearchableIdolSelect
            idols={idols}
            selectedIdolId={idol.id}
            onSelectIdol={(id) => setCurrentIdolId(id)}
            placeholder="Search idol name..."
            accentColor="amber"
          />
        </div>
      </div>

      {/* Idol Overview Banner */}
      <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-6 flex flex-col md:flex-row items-center gap-6 poster-shadow">
        <div className="relative group h-36 w-36 sm:h-44 sm:w-44 overflow-hidden rounded-2xl border-2 border-amber-500/60 shadow-2xl flex-shrink-0 bg-slate-900 flex items-center justify-center">
          {idol.photoUrl ? (
            <img
              src={idol.photoUrl}
              alt={idol.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="font-poster-title text-4xl text-amber-300">
              {idol.name.slice(0, 2)}
            </div>
          )}
          {onUpdateIdolPhoto && (
            <button
              onClick={() => {
                setCustomPhotoUrl(idol.photoUrl);
                setPhotoModalOpen(true);
              }}
              title="Upload Photo for this Idol"
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-white opacity-0 group-hover:opacity-100 transition-opacity gap-1 font-black text-xs"
            >
              <Camera className="h-6 w-6 text-amber-400" />
              <span>Change Photo</span>
            </button>
          )}
        </div>

        <div className="space-y-2.5 text-center md:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="rounded-md bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-300 border border-amber-500/40">
              {idol.girlGroup}
            </span>
            <span className="rounded-md bg-[#2a1c12] px-3 py-1 text-xs font-black text-amber-200 border border-black">
              {idol.seed}
            </span>
            <span className="rounded-md bg-[#2a1c12] px-3 py-1 text-xs font-black text-amber-200 border border-black flex items-center gap-1.5">
              <span>{getCountryFlag(idol.nationality)}</span>
              <span>{idol.nationality}</span>
            </span>
            <div className="flex items-center gap-1.5" title="Idol Rating (editable via Rating Manager)">
              <RatingBadge idol={idol} size="md" showTier={true} showLabel={true} />
            </div>
            {onUpdateIdolPhoto && (
              <button
                onClick={() => {
                  setCustomPhotoUrl(idol.photoUrl);
                  setPhotoModalOpen(true);
                }}
                className="rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 text-xs font-black text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1.5"
              >
                <Camera className="h-3.5 w-3.5" />
                Upload Photo
              </button>
            )}
          </div>

          <h3 className="text-3xl sm:text-4xl font-black text-white font-poster-title drop-shadow-[2px_2px_0px_#000]">{idol.name}</h3>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-amber-200 font-bold">
            <span>
              Combined Record:{' '}
              <span className="text-white font-mono font-black">
                {combinedWins}W-{combinedDraws}D-{combinedLosses}L
              </span>
            </span>
            <span>&bull;</span>
            <span>
              Combined Win Rate:{' '}
              <span className="text-amber-300 font-black">{combinedWinRate}%</span>
            </span>
            <span>&bull;</span>
            <span>
              Total Titles:{' '}
              <span className="text-amber-400 font-black">
                {combinedChampionships} ({stat?.championships || 0} Cup + {leagueData.divisionTitlesCount} League + {(theIdolsData.mastersTitlesCount || 0) + (theIdolsData.regularSeasonTitlesCount || 0)} Superleague)
              </span>
            </span>
            {leagueData.currentDivision && (
              <>
                <span>&bull;</span>
                <span className="text-teal-300">
                  Current: <span className="font-black text-white">{leagueData.currentDivision.divisionName}</span> (Rank #{leagueData.currentDivision.rank})
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Career View Scope Switcher Tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#17100b] p-2 rounded-2xl border-2 border-black poster-shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300 px-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Career View Scope:</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCareerScope('combined')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster-title font-black uppercase transition-all flex items-center gap-1.5 ${
                activeCareerScope === 'combined'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-black/60 text-amber-200/70 hover:text-white hover:bg-black/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Combined ({combinedPerformance.matches} Matches)</span>
            </button>

            <button
              onClick={() => setActiveCareerScope('tournament')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster-title font-black uppercase transition-all flex items-center gap-1.5 ${
                activeCareerScope === 'tournament'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-black/60 text-amber-200/70 hover:text-white hover:bg-black/80'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Tournament Cup ({tournamentPerformance.matches} Matches)</span>
            </button>

            <button
              onClick={() => setActiveCareerScope('league')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster-title font-black uppercase transition-all flex items-center gap-1.5 ${
                activeCareerScope === 'league'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-black/60 text-amber-200/70 hover:text-white hover:bg-black/80'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-teal-300" />
              <span>6-Division League ({leaguePerformance.matches} Matches)</span>
            </button>

            <button
              onClick={() => setActiveCareerScope('the_idols')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster-title font-black uppercase transition-all flex items-center gap-1.5 ${
                activeCareerScope === 'the_idols'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-black/60 text-amber-200/70 hover:text-white hover:bg-black/80'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>The Idols Superleague ({theIdolsPerformance.matches} Matches)</span>
            </button>
          </div>
        </div>

        {/* COMBINED SCOPE METRICS & DETAILS */}
        {activeCareerScope === 'combined' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Main Key Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Overall Win Rate Card */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
                  Combined Win Rate
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {combinedPerformance.winRate}%
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {combinedPerformance.wins}W - {combinedPerformance.draws}D - {combinedPerformance.losses}L
                </span>
              </div>

              {/* Total Matches */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-teal-300 uppercase font-black tracking-wider block mb-1">
                  Total Matches
                </span>
                <span className="text-2xl font-black text-teal-400 font-mono">
                  {combinedPerformance.matches}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.matches} Cup &bull; {leaguePerformance.matches} Div &bull; {theIdolsPerformance.matches} Super
                </span>
              </div>

              {/* Total Titles */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Crown className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
                  Total Championships
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {combinedPerformance.totalTitles}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.championships} Cup + {leaguePerformance.divisionTitles} Div + {theIdolsPerformance.mastersTitles} Super
                </span>
              </div>

              {/* Podiums / Top 3 */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Trophy className="h-4 w-4 text-amber-300 mx-auto mb-1" />
                <span className="text-[10px] text-amber-200 uppercase font-black tracking-wider block">
                  Career Podiums (Top 3)
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {combinedPerformance.podiums}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  All Systems Combined
                </span>
              </div>

              {/* Game Difference */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Award className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-[10px] text-emerald-300 uppercase font-black tracking-wider block">
                  Game Diff
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {combinedPerformance.goalDiff > 0 ? `+${combinedPerformance.goalDiff}` : combinedPerformance.goalDiff}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {combinedPerformance.goalsFor} For / {combinedPerformance.goalsAgainst} Against
                </span>
              </div>

              {/* Scoring Average */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Flame className="h-4 w-4 text-rose-400 mx-auto mb-1" />
                <span className="text-[10px] text-rose-300 uppercase font-black tracking-wider block">
                  Avg Points / Match
                </span>
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {combinedPerformance.avgPoints}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  All Competitions
                </span>
              </div>
            </div>

            {/* Detailed Match Statistics Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Overall Match & Game Stats */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Swords className="h-4 w-4 text-amber-400" />
                  <span>All-Time Match &amp; Scoring Summary</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total Matches Played</span>
                    <span className="font-bold text-white font-mono">{combinedPerformance.matches}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Wins / Draws / Losses</span>
                    <span className="font-bold text-white font-mono">
                      <span className="text-emerald-400">{combinedPerformance.wins}W</span> - <span className="text-amber-400">{combinedPerformance.draws}D</span> - <span className="text-rose-400">{combinedPerformance.losses}L</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Points Scored / Conceded</span>
                    <span className="font-bold text-white font-mono">
                      {combinedPerformance.goalsFor} - {combinedPerformance.goalsAgainst} ({combinedPerformance.goalDiff >= 0 ? `+${combinedPerformance.goalDiff}` : combinedPerformance.goalDiff})
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Avg Points Scored / Match</span>
                    <span className="font-bold text-amber-200 font-mono">
                      {combinedPerformance.avgPoints}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 2: Competition Distribution */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-teal-400" />
                  <span>Competition Distribution</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Tournament Cup Matches</span>
                    <span className="font-bold text-indigo-300 font-mono">
                      {tournamentPerformance.matches} ({tournamentPerformance.wins}W - {tournamentPerformance.draws}D - {tournamentPerformance.losses}L)
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">League Division Matches</span>
                    <span className="font-bold text-teal-300 font-mono">
                      {leaguePerformance.matches} ({leaguePerformance.wins}W - {leaguePerformance.draws}D - {leaguePerformance.losses}L)
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">The Idols Superleague &amp; Playoff</span>
                    <span className="font-bold text-purple-300 font-mono">
                      {theIdolsPerformance.matches + theIdolsPerformance.playoffMatches} ({theIdolsPerformance.wins + theIdolsPerformance.playoffWins}W - {theIdolsPerformance.draws}D - {theIdolsPerformance.losses + theIdolsPerformance.playoffLosses}L)
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Tournament Win Rate</span>
                    <span className="font-bold text-indigo-400 font-mono">{tournamentPerformance.winRate}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">League Win Rate</span>
                    <span className="font-bold text-teal-400 font-mono">{leaguePerformance.winRate}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">The Idols Win Rate</span>
                    <span className="font-bold text-purple-400 font-mono">{theIdolsPerformance.winRate}%</span>
                  </div>
                </div>
              </div>

              {/* Column 3: Streaks & Peak Milestones */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-purple-400" />
                  <span>Streak &amp; Peak Milestones</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Win Streak</span>
                    <span className="font-bold text-amber-400 font-mono">{combinedPerformance.longestWinStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Unbeaten Streak</span>
                    <span className="font-bold text-purple-400 font-mono">{combinedPerformance.longestUnbeatenStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total Titles</span>
                    <span className="font-bold text-amber-400 font-mono">{combinedPerformance.totalTitles} Titles</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">The Idols (Superleague / Masters)</span>
                    <span className="font-bold text-purple-300 font-mono">{theIdolsPerformance.superleagueTitles} Superleague / {theIdolsPerformance.mastersTitles} Masters</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Career Podiums (Top 3)</span>
                    <span className="font-bold text-amber-300 font-mono">{combinedPerformance.podiums} Podiums</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TOURNAMENT CUP SCOPE METRICS & DETAILS */}
        {activeCareerScope === 'tournament' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Main Key Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Overall Win Rate Card */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
                  Tournament Win Rate
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {tournamentPerformance.winRate}%
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.wins}W - {tournamentPerformance.draws}D - {tournamentPerformance.losses}L
                </span>
              </div>

              {/* Group Stage Win Rate */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-teal-300 uppercase font-black tracking-wider block mb-1">
                  Group Win Rate
                </span>
                <span className="text-2xl font-black text-teal-400 font-mono">
                  {tournamentPerformance.groupWinRate}%
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.groupWins}W - {tournamentPerformance.groupLosses}L
                </span>
              </div>

              {/* Knockout Win Rate */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-purple-300 uppercase font-black tracking-wider block mb-1">
                  Knockout Win Rate
                </span>
                <span className="text-2xl font-black text-purple-400 font-mono">
                  {tournamentPerformance.knockoutWinRate}%
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.knockoutWins}W - {tournamentPerformance.knockoutLosses}L
                </span>
              </div>

              {/* Championships */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Crown className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
                  Cup Titles
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {tournamentPerformance.championships}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.runnerUps}x 2nd &bull; {tournamentPerformance.thirdPlaces}x 3rd
                </span>
              </div>

              {/* Top 4 Finishes */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Trophy className="h-4 w-4 text-amber-300 mx-auto mb-1" />
                <span className="text-[10px] text-amber-200 uppercase font-black tracking-wider block">
                  Top 4 Finishes
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {tournamentPerformance.top4}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPastSeasons.length} Seasons Recorded
                </span>
              </div>

              {/* Game Difference */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Award className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-[10px] text-emerald-300 uppercase font-black tracking-wider block">
                  Game Diff
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {tournamentPerformance.goalDiff > 0 ? `+${tournamentPerformance.goalDiff}` : tournamentPerformance.goalDiff}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {tournamentPerformance.goalsFor} For / {tournamentPerformance.goalsAgainst} Against
                </span>
              </div>
            </div>

            {/* Detailed Match Statistics Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: Overall Match & Game Stats */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Swords className="h-4 w-4 text-amber-400" />
                  <span>Tournament Cup Match Summary</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total Matches Played</span>
                    <span className="font-bold text-white font-mono">{tournamentPerformance.matches}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Wins / Draws / Losses</span>
                    <span className="font-bold text-white font-mono">
                      <span className="text-emerald-400">{tournamentPerformance.wins}W</span> - <span className="text-amber-400">{tournamentPerformance.draws}D</span> - <span className="text-rose-400">{tournamentPerformance.losses}L</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Win Streak</span>
                    <span className="font-bold text-amber-400 font-mono">{tournamentPerformance.longestWinStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Unbeaten Streak</span>
                    <span className="font-bold text-purple-400 font-mono">{tournamentPerformance.longestUnbeatenStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Avg Points Scored / Match</span>
                    <span className="font-bold text-amber-200 font-mono">
                      {tournamentPerformance.avgPoints}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 2: Group Stage Statistics */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-teal-400" />
                  <span>Group Stage Performance</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Group Matches (W-D-L)</span>
                    <span className="font-bold text-white font-mono">
                      {tournamentPerformance.groupWins}W - {tournamentPerformance.draws}D - {tournamentPerformance.groupLosses}L
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Group Stage Win Rate</span>
                    <span className="font-bold text-teal-400 font-mono">{tournamentPerformance.groupWinRate}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Advanced from Group Stage</span>
                    <span className="font-bold text-emerald-400">{tournamentPerformance.groupAdvancements} times</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Group Exits (Did Not Advance)</span>
                    <span className="font-bold text-rose-400">{tournamentPerformance.groupExits} times</span>
                  </div>
                </div>
              </div>

              {/* Column 3: Knockout Stage & Milestones */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-purple-400" />
                  <span>Knockout &amp; Tournament Milestones</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Knockout Record (W-L)</span>
                    <span className="font-bold text-white font-mono">{tournamentPerformance.knockoutWins}W - {tournamentPerformance.knockoutLosses}L</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Knockout Win Rate</span>
                    <span className="font-bold text-purple-400 font-mono">{tournamentPerformance.knockoutWinRate}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Grand Finals Reached</span>
                    <span className="font-bold text-amber-400 font-mono">{tournamentPerformance.championships + tournamentPerformance.runnerUps}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Quarter-Finals Reached</span>
                    <span className="font-bold text-amber-300 font-mono">{tournamentPerformance.quarterFinals + tournamentPerformance.top4}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Past Tournament Cup Season History Table */}
            {tournamentPastSeasons.length > 0 && (
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 border-b border-black/60 pb-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Past Tournament Cup Season History ({tournamentPastSeasons.length} Seasons)</span>
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-black/80 bg-black/40 text-[10px] font-poster-title text-amber-400 uppercase tracking-wider">
                        <th className="py-2 px-3">Season</th>
                        <th className="py-2 px-3">Group / Stage</th>
                        <th className="py-2 px-3 text-center">Stage Reached</th>
                        <th className="py-2 px-3 text-center">Record (W-D-L)</th>
                        <th className="py-2 px-3 text-center">Score (GF-GA)</th>
                        <th className="py-2 px-3 text-center">Honors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/60 text-xs">
                      {tournamentPastSeasons.map((ts, idx) => (
                        <tr key={idx} className="hover:bg-amber-950/20 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-amber-300">
                            {ts.seasonName}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            {ts.groupName ? `Group ${ts.groupName}` : 'Main Draw'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                                ts.isChampion
                                  ? 'bg-amber-500 text-black'
                                  : ts.isRunnerUp
                                  ? 'bg-slate-300 text-black'
                                  : ts.isThirdPlace
                                  ? 'bg-amber-700 text-white'
                                  : ts.stageReached.includes('Semi') || ts.stageReached.includes('Quarter')
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                                  : 'bg-black/60 text-amber-200/80'
                              }`}
                            >
                              {ts.stageReached}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-200">
                            {ts.won}W - {ts.drawn}D - {ts.lost}L ({ts.matches} GP)
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-amber-300">
                            {ts.pointsScored} - {ts.pointsConceded}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {ts.isChampion ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-poster-title font-black">
                                <Crown className="w-3 h-3 fill-black" />
                                <span>Champion</span>
                              </span>
                            ) : ts.isRunnerUp ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-300 text-black text-[10px] font-poster-title font-black">
                                <Medal className="w-3 h-3 fill-black" />
                                <span>Runner-Up</span>
                              </span>
                            ) : ts.isThirdPlace ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-800 text-amber-100 text-[10px] font-poster-title font-black">
                                <Award className="w-3 h-3" />
                                <span>3rd Place</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-200/50">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LEAGUE DIVISION SCOPE METRICS & DETAILS */}
        {activeCareerScope === 'league' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Main Key Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* League Win Rate Card */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-teal-300 uppercase font-black tracking-wider block mb-1">
                  League Win Rate
                </span>
                <span className="text-2xl font-black text-teal-400 font-mono">
                  {leaguePerformance.winRate}%
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {leaguePerformance.wins}W - {leaguePerformance.draws}D - {leaguePerformance.losses}L
                </span>
              </div>

              {/* Total League Points */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
                  Total League Points
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {leaguePerformance.points}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {leaguePerformance.matches} Total Matches
                </span>
              </div>

              {/* Division Championships */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Crown className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
                  Division Titles
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {leaguePerformance.divisionTitles}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {leaguePerformance.podiums}x Top 3 Podiums
                </span>
              </div>

              {/* Champions Tourney Qualifiers */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Trophy className="h-4 w-4 text-indigo-400 mx-auto mb-1" />
                <span className="text-[10px] text-indigo-300 uppercase font-black tracking-wider block">
                  Champions Quals
                </span>
                <span className="text-2xl font-black text-indigo-300 font-mono">
                  {leaguePerformance.championsQualifiers}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  Top 5 Division Finish
                </span>
              </div>

              {/* Game Difference */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Award className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-[10px] text-emerald-300 uppercase font-black tracking-wider block">
                  Game Diff
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {leaguePerformance.goalDiff > 0 ? `+${leaguePerformance.goalDiff}` : leaguePerformance.goalDiff}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {leaguePerformance.goalsFor} For / {leaguePerformance.goalsAgainst} Against
                </span>
              </div>

              {/* Scoring Average */}
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Flame className="h-4 w-4 text-rose-400 mx-auto mb-1" />
                <span className="text-[10px] text-rose-300 uppercase font-black tracking-wider block">
                  Avg Points / Match
                </span>
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {leaguePerformance.avgPoints}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  League Matches
                </span>
              </div>
            </div>

            {/* Detailed League Match Statistics Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Column 1: League Match Summary */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-teal-400" />
                  <span>League Match Summary</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total League Matches</span>
                    <span className="font-bold text-white font-mono">{leaguePerformance.matches}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Wins / Draws / Losses</span>
                    <span className="font-bold text-white font-mono">
                      <span className="text-emerald-400">{leaguePerformance.wins}W</span> - <span className="text-amber-400">{leaguePerformance.draws}D</span> - <span className="text-rose-400">{leaguePerformance.losses}L</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total Points Accumulated</span>
                    <span className="font-bold text-amber-400 font-mono">{leaguePerformance.points} Pts</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Avg Points Scored / Match</span>
                    <span className="font-bold text-amber-200 font-mono">{leaguePerformance.avgPoints}</span>
                  </div>
                </div>
              </div>

              {/* Column 2: Division Standings & Postseason Qualification */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  <span>Division Standings &amp; Honors</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Active Division Tier</span>
                    <span className="font-bold text-teal-300 font-mono">
                      {leaguePerformance.currentDivision ? `${leaguePerformance.currentDivision.divisionName} (Rank #${leaguePerformance.currentDivision.rank})` : 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Division Championship Titles</span>
                    <span className="font-bold text-amber-400 font-mono">{leaguePerformance.divisionTitles}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Podium Finishes (Top 3)</span>
                    <span className="font-bold text-amber-300 font-mono">{leaguePerformance.podiums} times</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Champions Tourney Quals (Top 5)</span>
                    <span className="font-bold text-indigo-400 font-mono">{leaguePerformance.championsQualifiers} times</span>
                  </div>
                </div>
              </div>

              {/* Column 3: Streaks & Form */}
              <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-300 border-b border-black/60 pb-2 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-400" />
                  <span>League Streaks &amp; Form</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest League Win Streak</span>
                    <span className="font-bold text-amber-400 font-mono">{leaguePerformance.longestWinStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Unbeaten Streak</span>
                    <span className="font-bold text-purple-400 font-mono">{leaguePerformance.longestUnbeatenStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Current Season Matches</span>
                    <span className="font-bold text-white font-mono">
                      {leaguePerformance.currentDivision ? `${leaguePerformance.currentDivision.played} GP` : '0 GP'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Current Season Points</span>
                    <span className="font-bold text-teal-400 font-mono">
                      {leaguePerformance.currentDivision ? `${leaguePerformance.currentDivision.points} Pts` : '0 Pts'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THE IDOLS (SUPERLEAGUE) SCOPE METRICS & DETAILS */}
        {activeCareerScope === 'the_idols' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* The Idols Key Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
                  Superleague Win Rate
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {theIdolsPerformance.winRate}%
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {theIdolsPerformance.wins}W - {theIdolsPerformance.draws}D - {theIdolsPerformance.losses}L
                </span>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <span className="text-[10px] text-teal-300 uppercase font-black tracking-wider block mb-1">
                  Total Matches
                </span>
                <span className="text-2xl font-black text-teal-400 font-mono">
                  {theIdolsPerformance.matches}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {theIdolsPerformance.points} Total Points
                </span>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Crown className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
                  Masters Titles
                </span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {theIdolsPerformance.mastersTitles}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  Playoff Championships
                </span>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Trophy className="h-4 w-4 text-amber-300 mx-auto mb-1" />
                <span className="text-[10px] text-amber-200 uppercase font-black tracking-wider block">
                  Regular Season #1
                </span>
                <span className="text-2xl font-black text-white font-mono">
                  {theIdolsPerformance.regularSeasonTitles}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  Table-Topper Honors
                </span>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Award className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                <span className="text-[10px] text-emerald-300 uppercase font-black tracking-wider block">
                  Superleague Diff
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {theIdolsPerformance.goalDiff > 0 ? `+${theIdolsPerformance.goalDiff}` : theIdolsPerformance.goalDiff}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {theIdolsPerformance.goalsFor} GF / {theIdolsPerformance.goalsAgainst} GA
                </span>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 text-center poster-shadow-sm">
                <Sparkles className="h-4 w-4 text-rose-400 mx-auto mb-1" />
                <span className="text-[10px] text-rose-300 uppercase font-black tracking-wider block">
                  Playoff Quals
                </span>
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {theIdolsPerformance.playoffAppearances}
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {theIdolsPerformance.playoffPodiums} Playoff Podiums
                </span>
              </div>
            </div>

            {/* Detailed The Idols Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5 border-b border-black/40 pb-2">
                  <Swords className="w-4 h-4 text-amber-400" />
                  <span>The Idols Match Summary</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total Matches Played</span>
                    <span className="font-bold text-white font-mono">{theIdolsPerformance.matches}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Wins / Draws / Losses</span>
                    <span className="font-bold text-amber-300 font-mono">
                      {theIdolsPerformance.wins} / {theIdolsPerformance.draws} / {theIdolsPerformance.losses}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Total Points Scored (GF)</span>
                    <span className="font-bold text-emerald-400 font-mono">{theIdolsPerformance.goalsFor}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Points Conceded (GA)</span>
                    <span className="font-bold text-rose-400 font-mono">{theIdolsPerformance.goalsAgainst}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Avg Points Per Match</span>
                    <span className="font-bold text-amber-300 font-mono">{theIdolsPerformance.avgPoints}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5 border-b border-black/40 pb-2">
                  <Crown className="w-4 h-4 text-teal-400" />
                  <span>The Idols Honors &amp; Masters</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Masters Playoff Titles</span>
                    <span className="font-bold text-amber-400 font-mono">{theIdolsPerformance.mastersTitles}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Regular Season 1st Places</span>
                    <span className="font-bold text-teal-300 font-mono">{theIdolsPerformance.regularSeasonTitles}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Masters Playoff Appearances</span>
                    <span className="font-bold text-indigo-300 font-mono">{theIdolsPerformance.playoffAppearances}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Masters Podiums (Top 3)</span>
                    <span className="font-bold text-emerald-400 font-mono">{theIdolsPerformance.playoffPodiums}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Total Career Points</span>
                    <span className="font-bold text-white font-mono">{theIdolsPerformance.points} Pts</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 space-y-3 poster-shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5 border-b border-black/40 pb-2">
                  <Flame className="w-4 h-4 text-purple-400" />
                  <span>Streaks &amp; Active Season</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Superleague Win Streak</span>
                    <span className="font-bold text-amber-400 font-mono">{theIdolsPerformance.longestWinStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Longest Unbeaten Streak</span>
                    <span className="font-bold text-purple-400 font-mono">{theIdolsPerformance.longestUnbeatenStreak} Matches</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-black/40">
                    <span className="text-amber-200/70 font-semibold">Current Season Status</span>
                    <span className="font-bold text-white font-mono">
                      {theIdolsPerformance.currentStanding
                        ? `Rank #${theIdolsPerformance.currentStanding.rank} (${theIdolsPerformance.currentStanding.points} Pts)`
                        : 'Not Active'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-amber-200/70 font-semibold">Current Season Matches</span>
                    <span className="font-bold text-teal-400 font-mono">
                      {theIdolsPerformance.currentStanding ? `${theIdolsPerformance.currentStanding.played} GP` : '0 GP'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 👑 SPECIFIC SECTION: IDOL THE IDOLS SUPERLEAGUE & MASTERS PERFORMANCE */}
      <div className="rounded-2xl border-2 border-black bg-[#17100b] p-5 sm:p-6 space-y-5 poster-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-poster-title text-lg text-white flex items-center gap-2">
                <span>Idol The Idols Superleague Career</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-poster-title bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  The Idols Superleague &amp; Masters
                </span>
              </h3>
              <p className="text-xs text-amber-200/70">
                Superleague standings, table titles, Masters playoff bracket results, and historical finishes.
              </p>
            </div>
          </div>

          {theIdolsData.currentStanding && (
            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-xl border border-amber-500/30">
              <span className="text-[11px] text-amber-300 font-bold">Current Standing:</span>
              <span className="text-xs font-poster-title text-amber-300 font-black">
                Rank #{theIdolsData.currentStanding.rank} / {theIdolsData.currentStanding.totalInLeague} ({theIdolsData.currentStanding.points} Pts)
              </span>
            </div>
          )}
        </div>

        {/* The Idols Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
              Active Superleague Form
            </span>
            {theIdolsData.currentStanding ? (
              <>
                <span className="text-xl font-black text-white font-mono">
                  {theIdolsData.currentStanding.points} <span className="text-xs text-amber-300">PTS</span>
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {theIdolsData.currentStanding.won}W - {theIdolsData.currentStanding.drawn}D - {theIdolsData.currentStanding.lost}L ({theIdolsData.currentStanding.played} GP)
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-bold">Unassigned</span>
            )}
          </div>

          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
              All-Time Superleague Record
            </span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {theIdolsData.totalWins}W - {theIdolsData.totalDraws}D - {theIdolsData.totalLosses}L
            </span>
            <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
              {theIdolsData.totalMatches} Total Matches ({theIdolsPerformance.winRate}% Win Rate)
            </span>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <span className="text-[10px] text-emerald-300 uppercase font-black tracking-wider block mb-1">
              Superleague Points &amp; Diff
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {theIdolsData.totalGoalsFor - theIdolsData.totalGoalsAgainst >= 0
                ? `+${theIdolsData.totalGoalsFor - theIdolsData.totalGoalsAgainst}`
                : theIdolsData.totalGoalsFor - theIdolsData.totalGoalsAgainst}
            </span>
            <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
              {theIdolsData.totalGoalsFor} GF / {theIdolsData.totalGoalsAgainst} GA
            </span>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <Crown className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
            <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
              Masters &amp; Table Titles
            </span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {(theIdolsData.mastersTitlesCount || 0) + (theIdolsData.regularSeasonTitlesCount || 0)}
            </span>
            <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
              {theIdolsData.mastersTitlesCount || 0} Playoff &bull; {theIdolsData.regularSeasonTitlesCount || 0} Reg Season #1
            </span>
          </div>
        </div>

        {/* The Idols Past Season History Table */}
        {(theIdolsData.pastSeasons || []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Past Superleague Season History</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-black bg-[#100b07] text-amber-200 uppercase font-black text-[10px]">
                    <th className="py-2 px-3">Season</th>
                    <th className="py-2 px-3">Table Finish</th>
                    <th className="py-2 px-3">Record (W-D-L)</th>
                    <th className="py-2 px-3">Points</th>
                    <th className="py-2 px-3">Diff</th>
                    <th className="py-2 px-3">Masters Playoff Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40">
                  {(theIdolsData.pastSeasons || []).map((ps) => (
                    <tr key={ps.seasonNumber} className="hover:bg-amber-950/20 font-mono">
                      <td className="py-2 px-3 font-bold text-amber-400">Season {ps.seasonNumber}</td>
                      <td className="py-2 px-3 font-black text-white">Rank #{ps.rank}</td>
                      <td className="py-2 px-3 text-amber-200">{ps.won}W - {ps.drawn}D - {ps.lost}L ({ps.played} GP)</td>
                      <td className="py-2 px-3 font-bold text-amber-300">{ps.points} Pts</td>
                      <td className="py-2 px-3 text-emerald-400">{(ps.goalDiff ?? (ps.goalsFor - ps.goalsAgainst)) >= 0 ? `+${ps.goalDiff ?? (ps.goalsFor - ps.goalsAgainst)}` : (ps.goalDiff ?? (ps.goalsFor - ps.goalsAgainst))}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            ps.playoffFinish.includes('Champion')
                              ? 'bg-amber-500 text-black'
                              : ps.playoffFinish.includes('Runner-Up')
                              ? 'bg-slate-300 text-slate-900'
                              : ps.playoffFinish.includes('3rd')
                              ? 'bg-amber-700 text-amber-100'
                              : ps.isPlayoffParticipant
                              ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-500/30'
                              : 'bg-black/40 text-amber-200/50'
                          }`}
                        >
                          {ps.playoffFinish}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Superleague Match Log */}
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-amber-400" />
            <span>Recent Superleague Matches ({(theIdolsData.recentMatches || []).length})</span>
          </h4>

          {(theIdolsData.recentMatches || []).length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {(theIdolsData.recentMatches || []).map((m) => {
                const isHome = m.homeIdolId === idol.id;
                const oppName = isHome ? m.awayIdolName : m.homeIdolName;
                const myScore = isHome ? m.homeScore : m.awayScore;
                const oppScore = isHome ? m.awayScore : m.homeScore;
                const isWin = (myScore ?? 0) > (oppScore ?? 0);
                const isDraw = myScore === oppScore;

                return (
                  <div
                    key={m.matchId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${
                      isWin
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-white'
                        : isDraw
                        ? 'bg-amber-950/20 border-amber-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                          isWin
                            ? 'bg-emerald-500 text-slate-950'
                            : isDraw
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                      </span>
                      <span className="text-amber-300">
                        vs {oppName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-amber-300 text-xs font-black">
                        {myScore} - {oppScore}
                      </span>
                      <span className="text-[10px] text-amber-400/60">
                        Matchday {m.matchday} &bull; Superleague
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-amber-200/50 italic py-2">
              No Superleague matches played by {idol.name} in the active season yet.
            </p>
          )}
        </div>
      </div>

      {/* ⚽ SPECIFIC SECTION: IDOL LEAGUE CAREER & DIVISION PERFORMANCE */}
      <div className="rounded-2xl border-2 border-black bg-[#17100b] p-5 sm:p-6 space-y-5 poster-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-poster-title text-lg text-white flex items-center gap-2">
                <span>Idol League Career &amp; Division Performance</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-poster-title bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  6-Division League System
                </span>
              </h3>
              <p className="text-xs text-amber-200/70">
                Division placement, championship trophies, podium finishes, postseason qualification, and match logs.
              </p>
            </div>
          </div>

          {leagueData.currentDivision && (
            <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-xl border border-teal-500/30">
              <span className="text-[11px] text-amber-300 font-bold">Current Tier:</span>
              <span className="text-xs font-poster-title text-teal-300 font-black">
                {leagueData.currentDivision.divisionName} (Rank #{leagueData.currentDivision.rank} / {leagueData.currentDivision.totalInDiv})
              </span>
            </div>
          )}
        </div>

        {/* League Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <span className="text-[10px] text-teal-300 uppercase font-black tracking-wider block mb-1">
              Current Division Form
            </span>
            {leagueData.currentDivision ? (
              <>
                <span className="text-xl font-black text-white font-mono">
                  {leagueData.currentDivision.points} <span className="text-xs text-teal-300">PTS</span>
                </span>
                <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
                  {leagueData.currentDivision.won}W - {leagueData.currentDivision.drawn}D - {leagueData.currentDivision.lost}L ({leagueData.currentDivision.played} GP)
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-bold">Unassigned</span>
            )}
          </div>

          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block mb-1">
              All-Time League Record
            </span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {leagueData.totalLeagueWins}W - {leagueData.totalLeagueDraws}D - {leagueData.totalLeagueLosses}L
            </span>
            <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
              {leagueData.totalLeagueMatches} Total League Matches
            </span>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <span className="text-[10px] text-emerald-300 uppercase font-black tracking-wider block mb-1">
              League Goals &amp; Diff
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {leagueData.totalLeagueGoalsFor - leagueData.totalLeagueGoalsAgainst >= 0
                ? `+${leagueData.totalLeagueGoalsFor - leagueData.totalLeagueGoalsAgainst}`
                : leagueData.totalLeagueGoalsFor - leagueData.totalLeagueGoalsAgainst}
            </span>
            <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
              {leagueData.totalLeagueGoalsFor} GF / {leagueData.totalLeagueGoalsAgainst} GA
            </span>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#1f150e] p-3.5 text-center poster-shadow-sm">
            <Crown className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
            <span className="text-[10px] text-amber-300 uppercase font-black tracking-wider block">
              Division Championships
            </span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {leagueData.divisionTitlesCount}
            </span>
            <span className="text-[10px] text-amber-200/70 block mt-0.5 font-bold">
              {(leagueData?.divisionTitles || []).length > 0
                ? (leagueData?.divisionTitles || []).map((t) => `S${t.seasonNumber} D${t.divisionId}`).join(', ')
                : '0 Division Titles'}
            </span>
          </div>
        </div>

        {/* Division Past Season History Table */}
        {(leagueData?.pastSeasons || []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Past League Season Division History</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-black/80 bg-black/40 text-[10px] font-poster-title text-amber-400 uppercase tracking-wider">
                    <th className="py-2 px-3">Season</th>
                    <th className="py-2 px-3">Division</th>
                    <th className="py-2 px-3 text-center">Final Rank</th>
                    <th className="py-2 px-3 text-center">Record (W-D-L)</th>
                    <th className="py-2 px-3 text-center">Points</th>
                    <th className="py-2 px-3 text-center">Honors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/60 text-xs">
                  {(leagueData?.pastSeasons || []).map((ps, idx) => (
                    <tr key={idx} className="hover:bg-amber-950/20 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-amber-300">
                        Season {ps.seasonNumber}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {ps.divisionName}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            ps.rank === 1
                              ? 'bg-amber-500 text-black'
                              : ps.rank <= 3
                              ? 'bg-slate-700 text-white'
                              : 'bg-black/60 text-amber-200/80'
                          }`}
                        >
                          #{ps.rank}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-200">
                        {ps.won}W - {ps.drawn}D - {ps.lost}L
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-amber-300">
                        {ps.points}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {ps.isChampion ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-black text-[10px] font-poster-title font-black">
                            <Crown className="w-3 h-3 fill-black" />
                            <span>Champion</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-200/50">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent League Match Log */}
        <div className="space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-teal-400" />
            <span>Recent League Matches ({(leagueData?.recentLeagueMatches || []).length})</span>
          </h4>

          {(leagueData?.recentLeagueMatches || []).length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {leagueData.recentLeagueMatches.map((m) => {
                const isHome = m.homeIdolId === idol.id;
                const oppName = isHome ? m.awayIdolName : m.homeIdolName;
                const myScore = isHome ? m.homeScore : m.awayScore;
                const oppScore = isHome ? m.awayScore : m.homeScore;
                const isWin = (myScore ?? 0) > (oppScore ?? 0);
                const isDraw = myScore === oppScore;

                return (
                  <div
                    key={m.matchId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold ${
                      isWin
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-white'
                        : isDraw
                        ? 'bg-amber-950/20 border-amber-500/30 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                          isWin
                            ? 'bg-emerald-500 text-slate-950'
                            : isDraw
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                      </span>
                      <span className="text-teal-300">
                        vs {oppName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-amber-300 text-xs font-black">
                        {myScore} - {oppScore}
                      </span>
                      <span className="text-[10px] text-amber-400/60">
                        Matchday {m.matchday} &bull; Div {m.divisionId}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-amber-200/50 italic py-2">
              No league matches played by {idol.name} in the active season yet.
            </p>
          )}
        </div>
      </div>

      {/* Match History */}
      <div className="rounded-2xl border-2 border-black bg-[#1b120c] p-5 space-y-4 poster-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/60 pb-3">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-amber-400" />
            <h4 className="font-poster-title text-base text-white">
              Complete Match History Log
            </h4>
            <span className="text-xs text-amber-400/80 font-bold ml-1">
              ({filteredMatches.length} of {idolMatches.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-black">
              <button
                type="button"
                onClick={() => {
                  setMatchFilter('all');
                  setMatchPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-poster-title font-black transition-all ${
                  matchFilter === 'all'
                    ? 'bg-amber-500 text-black'
                    : 'text-amber-200/70 hover:text-white'
                }`}
              >
                All ({idolMatches.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMatchFilter('the_idols');
                  setMatchPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-poster-title font-black transition-all ${
                  matchFilter === 'the_idols'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-200/70 hover:text-white'
                }`}
              >
                👑 Superleague ({idolTheIdolsMatches.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMatchFilter('league');
                  setMatchPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-poster-title font-black transition-all ${
                  matchFilter === 'league'
                    ? 'bg-teal-600 text-white'
                    : 'text-amber-200/70 hover:text-white'
                }`}
              >
                🛡️ League ({idolLeagueMatches.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMatchFilter('tournament');
                  setMatchPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-poster-title font-black transition-all ${
                  matchFilter === 'tournament'
                    ? 'bg-indigo-600 text-white'
                    : 'text-amber-200/70 hover:text-white'
                }`}
              >
                🏆 Tournament ({idolTournamentMatches.length})
              </button>
            </div>

            <div className="text-xs text-amber-400/80 font-bold px-1">
              Page {matchPage} of {totalMatchPages}
            </div>
          </div>
        </div>

        {paginatedIdolMatches.length > 0 ? (
          <div className="space-y-2">
            {paginatedIdolMatches.map((m) => {
              const isWin = m.winnerId === idol.id;
              const isDraw = m.isDraw || m.scoreA === m.scoreB || m.winnerId === 'DRAW';
              const opponentName = m.idolAId === idol.id ? m.idolBName : m.idolAName;
              const myScore = m.idolAId === idol.id ? m.scoreA : m.scoreB;
              const oppScore = m.idolAId === idol.id ? m.scoreB : m.scoreA;
              const isTheIdols = isMatchTheIdols(m);
              const isLeague = !isTheIdols && isMatchLeague(m);

              return (
                <div
                  key={m.matchId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border text-xs font-bold gap-2 ${
                    isWin
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-white'
                      : isDraw
                      ? 'bg-amber-950/20 border-amber-500/30 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                        isWin
                          ? 'bg-emerald-500 text-slate-950'
                          : isDraw
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                    </span>
                    <span className="text-amber-200">vs {opponentName}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-amber-300 text-xs font-black">
                      {myScore} - {oppScore}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          isTheIdols
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : isLeague
                            ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                            : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {isTheIdols ? '👑 Superleague' : isLeague ? '🛡️ League' : '🏆 Tournament'}
                      </span>
                      <span className="text-[10px] text-amber-400/70">
                        {m.seasonName || `Season ${m.seasonId}`} &bull; {m.stage}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-amber-200/50 italic">
            No matches recorded for this idol yet.
          </div>
        )}

        {/* Match Pagination Controls */}
        {totalMatchPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/60 pt-3 text-xs">
            <button
              onClick={() => setMatchPage((p) => Math.max(1, p - 1))}
              disabled={matchPage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black bg-[#251a13] text-amber-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Matches</span>
            </button>
            <span className="text-amber-400 font-bold">
              Page {matchPage} of {totalMatchPages}
            </span>
            <button
              onClick={() => setMatchPage((p) => Math.min(totalMatchPages, p + 1))}
              disabled={matchPage >= totalMatchPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black bg-[#251a13] text-amber-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
            >
              <span>Next Matches</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ⚔️ Head-to-Head Records & Rivalry Matrix Section (Down below everything) */}
      <div className="rounded-2xl border-2 border-black bg-[#160e0a] p-5 space-y-4 poster-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/60 pb-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-amber-400" />
            <h3 className="font-poster-title text-base text-amber-200">
              Head-to-Head Rivalries &amp; Records for {idol.name}
            </h3>
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-600/40">
            {topH2HRivals.length} Tracked Rivals
          </span>
        </div>

        {/* Top 5 Rival Cards */}
        {topH2HRivals.length > 0 ? (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90 block mb-2">
                Top 5 Most Faced Rivals:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {topH2HRivals.map((rec) => {
                  const isSelected = selectedH2HOpponentId === rec.opponentId;
                  return (
                    <button
                      key={rec.opponentId}
                      type="button"
                      onClick={() => setSelectedH2HOpponentId(rec.opponentId)}
                      className={`text-left rounded-xl border-2 p-3 transition-all flex flex-col justify-between space-y-2.5 ${
                        isSelected
                          ? 'border-amber-400 bg-[#2b1c12] poster-shadow scale-102 ring-2 ring-amber-400/40'
                          : 'border-black bg-[#1c120c] hover:bg-[#241710] poster-shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl overflow-hidden border border-black bg-slate-900 flex-shrink-0">
                          {rec.opponentPhoto ? (
                            <img
                              src={rec.opponentPhoto}
                              alt={rec.opponentName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-amber-300 font-bold">
                              {(rec.opponentName || 'OP').slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs text-white leading-tight truncate flex items-center gap-1">
                            <span>{rec.opponentName}</span>
                            <span className="text-xs">{getCountryFlag(rec.opponentNationality)}</span>
                          </div>
                          <div className="text-[10px] text-amber-400/80 truncate">
                            {rec.opponentGroup} &bull; {rec.opponentSeed}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-black/60 pt-2 flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-amber-200">
                          {rec.wins}W - {rec.draws}D - {rec.losses}L
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            rec.winRate >= 60
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : rec.winRate >= 40
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              : 'bg-red-950 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {rec.winRate}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Head-to-Head Showdown Matrix vs Selected Rival */}
            {selectedOpponent && (
              <div className="rounded-xl border-2 border-black bg-[#1f150e] p-4 space-y-4 poster-shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/60 pb-3">
                  <div className="flex items-center gap-2">
                    <GitCompare className="h-4 w-4 text-amber-400" />
                    <h4 className="font-poster-title text-sm text-amber-200">
                      Direct Showdown: {idol.name} vs {selectedOpponent.name}
                    </h4>
                  </div>

                  {/* Opponent Quick Switcher */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-300">Compare with:</span>
                    <select
                      value={selectedH2HOpponentId}
                      onChange={(e) => setSelectedH2HOpponentId(e.target.value)}
                      aria-label="Compare with rival idol"
                      className="rounded-lg border-2 border-black bg-[#120e0b] px-2.5 py-1 text-xs font-bold text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    >
                      {idols
                        .filter((i) => i.id !== idol.id)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.girlGroup})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Direct Comparison Banner */}
                <div className="grid grid-cols-3 gap-3 items-center py-2 bg-[#120e0b] rounded-xl border border-black p-3">
                  {/* Idol A */}
                  <div className="flex items-center gap-3">
                    {idol.photoUrl ? (
                      <img
                        src={idol.photoUrl}
                        alt={idol.name}
                        className="h-12 w-12 rounded-xl object-cover border border-black bg-slate-900"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl border border-black bg-black flex items-center justify-center font-bold text-base text-amber-300">
                        {idol.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="truncate">
                      <div className="font-black text-sm text-amber-300 truncate">{idol.name}</div>
                      <div className="text-[10px] text-amber-200/70">{idol.girlGroup}</div>
                    </div>
                  </div>

                  {/* Center Score & Win Rate */}
                  <div className="text-center space-y-1">
                    <div className="font-mono text-lg font-black text-white">
                      <span className="text-emerald-400">{directWins}W</span> -{' '}
                      <span className="text-amber-400">{directDraws}D</span> -{' '}
                      <span className="text-rose-400">{directLosses}L</span>
                    </div>
                    <div className="text-[10px] font-bold text-amber-300">
                      {directMatches.length} Total Matches &bull; {directWinRate}% Win Rate
                    </div>
                  </div>

                  {/* Idol B */}
                  <div className="flex items-center justify-end gap-3">
                    <div className="text-right truncate">
                      <div className="font-black text-sm text-amber-300 truncate">{selectedOpponent.name}</div>
                      <div className="text-[10px] text-amber-200/70">{selectedOpponent.girlGroup}</div>
                    </div>
                    {selectedOpponent.photoUrl ? (
                      <img
                        src={selectedOpponent.photoUrl}
                        alt={selectedOpponent.name}
                        className="h-12 w-12 rounded-xl object-cover border border-black bg-slate-900"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl border border-black bg-black flex items-center justify-center font-bold text-base text-amber-300">
                        {selectedOpponent.name.slice(0, 1)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Match by Match Log */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400/90 block">
                    All Direct Matches Between These Idols ({directMatches.length}):
                  </span>
                  {directMatches.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {directMatches.map((m) => {
                        const isWin =
                          m.winnerId === idol.id ||
                          (m.idolAId === idol.id ? (m.scoreA ?? 0) > (m.scoreB ?? 0) : (m.scoreB ?? 0) > (m.scoreA ?? 0));
                        const isDraw = m.isDraw || m.winnerId === 'DRAW' || m.scoreA === m.scoreB;
                        const myScore = m.idolAId === idol.id ? m.scoreA : m.scoreB;
                        const oppScore = m.idolAId === idol.id ? m.scoreB : m.scoreA;

                        return (
                          <div
                            key={m.matchId}
                            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-bold ${
                              isWin
                                ? 'bg-emerald-950/30 border-emerald-500/40 text-white'
                                : isDraw
                                ? 'bg-amber-950/30 border-amber-500/40 text-white'
                                : 'bg-red-950/30 border-red-500/40 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                                  isWin
                                    ? 'bg-emerald-500 text-slate-950'
                                    : isDraw
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                              </span>
                              <span className="text-amber-200">
                                Season {m.seasonId} &bull; {m.stage}
                              </span>
                            </div>

                            <span className="font-mono text-amber-300 font-black">
                              {myScore} - {oppScore}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-200/60 py-2 italic text-center">
                      No direct matches recorded between {idol.name} and {selectedOpponent.name} yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-amber-200/60 italic">
            No head-to-head match history recorded for {idol.name} yet. Matches played in the tournament will automatically populate this section.
          </div>
        )}
      </div>

      {/* Upload Photo Modal */}
      {photoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-black bg-[#1e1510] p-6 poster-shadow space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-black/60 pb-3">
              <h3 className="font-poster-title text-amber-200 text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-amber-400" />
                <span>Upload Photo for {idol.name}</span>
              </h3>
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="text-amber-300 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
                  Option 1: Upload Image File from Device
                </label>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-amber-500/40 hover:border-amber-400 rounded-xl cursor-pointer bg-[#140e0a] hover:bg-[#1a110d] transition-all text-center p-3">
                  <Upload className="h-6 w-6 text-amber-400 mb-1" />
                  <span className="text-xs font-bold text-amber-200">Choose Image File</span>
                  <span className="text-[10px] text-amber-400/60">PNG, JPG, WEBP or GIF</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-black"></div>
                <span className="flex-shrink mx-3 text-[10px] font-black text-amber-400/60 uppercase tracking-widest">
                  OR
                </span>
                <div className="flex-grow border-t border-black"></div>
              </div>

              <form onSubmit={handleUrlSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                    Option 2: Enter Photo Web URL
                  </label>
                  <input
                    type="url"
                    value={customPhotoUrl}
                    onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-xl border-2 border-black bg-[#120e0b] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPhotoModalOpen(false)}
                    className="rounded-xl border-2 border-black bg-[#2a1c12] px-4 py-2 text-xs font-bold text-amber-300 hover:bg-[#382417] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl poster-pill-gold px-4 py-2 text-xs font-black text-amber-950 transition-colors shadow-lg"
                  >
                    Save Photo URL
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
