import React, { useState } from 'react';
import {
  Idol,
  GirlGroup,
  TournamentArchive,
  ArchivedMatch,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
} from '../types';
import { Users, Crown, Trophy, Search, ChevronDown, ChevronUp, Award, Swords, Shield, Sparkles, Star, Table } from 'lucide-react';
import { calculateUnifiedTotalTitles } from '../utils/databaseStudioLogic';
import type { V5TitleArchive } from '../utils/v5/store';

interface GirlGroupStatsPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  archives: TournamentArchive[];
  matchDatabase: ArchivedMatch[];
  leagueArchives?: LeagueSeasonArchive[];
  leagueState?: LeagueSeasonState | null;
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  v5TitleArchives?: V5TitleArchive[];
}

export interface GirlGroupStat {
  groupName: string;
  totalMembers: number;
  championships: number;
  seasonWinners: Array<{
    seasonId: number;
    seasonName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  leagueCupTitles: number;
  leagueCupWinners: Array<{
    seasonNumber: number;
    leagueId: number;
    leagueName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  theIdolsLeagueTitles: number;
  theIdolsLeagueWinners: Array<{
    seasonNumber: number;
    seasonName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  theIdolsPlayoffTitles: number;
  competitionTitles: Record<string, number>;
  competitionWinners: Record<string, Array<{
    id: string;
    seasonNumber: number;
    seasonName: string;
    competitionName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>>;
  totalTitles: number;
  theIdolsPlayoffWinners: Array<{
    seasonNumber: number;
    seasonName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  totalMatches: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  winRate: number;
  gameDiff: number;
  members: Array<{
    id: string;
    name: string;
    photoUrl: string;
    championships: number;
    leagueCupTitles: number;
    theIdolsLeagueTitles: number;
    theIdolsPlayoffTitles: number;
    competitionTitles: Record<string, number>;
    matches: number;
    wins: number;
    draws: number;
    losses: number;
    winRate: number;
  }>;
}

export const GirlGroupStatsPanel: React.FC<GirlGroupStatsPanelProps> = ({
  idols,
  girlGroups,
  archives,
  matchDatabase,
  leagueArchives = [],
  leagueState = null,
  theIdolsState = null,
  theIdolsArchives = [],
  v5TitleArchives = [],
}) => {
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<'combined' | 'tournament' | 'league' | 'the_idols' | 'crown_cup' | 'open_arena_cup' | 'spotlight_cup' | 'super_cup_a' | 'super_cup_b' | 'division_2'>('combined');

  // 1. Map all idols to their groups
  const groupMembersMap = new Map<string, Idol[]>();
  idols.forEach((idol) => {
    const groupName = idol.girlGroup || 'Solo / Independent';
    if (!groupMembersMap.has(groupName)) {
      groupMembersMap.set(groupName, []);
    }
    groupMembersMap.get(groupName)!.push(idol);
  });

  // Also include any girlGroup defined in girlGroups array even if 0 members
  girlGroups.forEach((g) => {
    if (!groupMembersMap.has(g.name)) {
      groupMembersMap.set(g.name, []);
    }
  });

  // Idol quick lookup map
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  // 2. Track season tournament champions per group
  const groupSeasonWinnersMap = new Map<
    string,
    Array<{
      seasonId: number;
      seasonName: string;
      championId: string;
      championName: string;
      championPhoto?: string;
    }>
  >();

  archives.forEach((arch) => {
    if (arch.championId) {
      const champIdol = idolsMap.get(arch.championId);
      const groupName = arch.championGroup || champIdol?.girlGroup || 'Solo / Independent';

      if (!groupSeasonWinnersMap.has(groupName)) {
        groupSeasonWinnersMap.set(groupName, []);
      }
      groupSeasonWinnersMap.get(groupName)!.push({
        seasonId: arch.seasonId,
        seasonName: arch.seasonName || `Season ${arch.seasonId}`,
        championId: arch.championId,
        championName: arch.championName || champIdol?.name || 'Unknown',
        championPhoto: arch.championPhoto || champIdol?.photoUrl,
      });
    }
  });

  // 2b. Track League Cup / Division Winners per group
  const groupLeagueCupWinnersMap = new Map<
    string,
    Array<{
      seasonNumber: number;
      leagueId: number;
      leagueName: string;
      championId: string;
      championName: string;
      championPhoto?: string;
    }>
  >();

  leagueArchives.forEach((arch) => {
    let recordedDivision = new Set<number>();
    if (Array.isArray(arch.leagueWinners) && arch.leagueWinners.length > 0) {
      arch.leagueWinners.forEach((winner) => {
        if (winner.championId) {
          recordedDivision.add(winner.leagueId);
          const champIdol = idolsMap.get(winner.championId);
          const groupName = winner.championGroup || champIdol?.girlGroup || 'Solo / Independent';
          if (!groupLeagueCupWinnersMap.has(groupName)) {
            groupLeagueCupWinnersMap.set(groupName, []);
          }
          groupLeagueCupWinnersMap.get(groupName)!.push({
            seasonNumber: arch.seasonNumber,
            leagueId: winner.leagueId,
            leagueName: winner.leagueName || `Division ${winner.leagueId}`,
            championId: winner.championId,
            championName: winner.championName || champIdol?.name || 'Unknown',
            championPhoto: winner.championPhoto || champIdol?.photoUrl,
          });
        }
      });
    }

    if (arch.allStandings && typeof arch.allStandings === 'object') {
      Object.entries(arch.allStandings).forEach(([divIdStr, standings]) => {
        const divId = Number(divIdStr);
        if (!recordedDivision.has(divId) && Array.isArray(standings)) {
          const champ = standings.find((s) => s && s.rank === 1 && (s.played || 0) > 0);
          if (champ && champ.idolId) {
            recordedDivision.add(divId);
            const champIdol = idolsMap.get(champ.idolId);
            const groupName = champ.girlGroup || champIdol?.girlGroup || 'Solo / Independent';
            if (!groupLeagueCupWinnersMap.has(groupName)) {
              groupLeagueCupWinnersMap.set(groupName, []);
            }
            groupLeagueCupWinnersMap.get(groupName)!.push({
              seasonNumber: arch.seasonNumber,
              leagueId: divId,
              leagueName: `Division ${divId}`,
              championId: champ.idolId,
              championName: champ.idolName || champIdol?.name || 'Unknown',
              championPhoto: champIdol?.photoUrl,
            });
          }
        }
      });
    }
  });

  // Include active league season division champions ONLY when completed
  if (leagueState && Array.isArray(leagueState.leagues)) {
    leagueState.leagues.forEach((l) => {
      if (l.isCompleted && (l.standings?.[0]?.played || 0) > 0 && l.standings?.[0]?.idolId) {
        const top = l.standings[0];
        const champIdol = idolsMap.get(top.idolId);
        const groupName = champIdol?.girlGroup || top.girlGroup || 'Solo / Independent';
        if (!groupLeagueCupWinnersMap.has(groupName)) {
          groupLeagueCupWinnersMap.set(groupName, []);
        }
        const existingList = groupLeagueCupWinnersMap.get(groupName)!;
        const exists = existingList.some(
          (w) => w.seasonNumber === leagueState.seasonNumber && w.leagueId === l.id
        );
        if (!exists) {
          existingList.push({
            seasonNumber: leagueState.seasonNumber,
            leagueId: l.id,
            leagueName: l.name || `Division ${l.id}`,
            championId: top.idolId,
            championName: top.idolName || champIdol?.name || 'Champion',
            championPhoto: top.photoUrl || champIdol?.photoUrl,
          });
        }
      }
    });
  }

  // 2c. Track The Idols Superleague (Regular Season 1st) Champions per group
  const groupTheIdolsLeagueWinnersMap = new Map<
    string,
    Array<{
      seasonNumber: number;
      seasonName: string;
      championId: string;
      championName: string;
      championPhoto?: string;
    }>
  >();

  // 2d. Track The Idols Masters (Playoff Final Champion) Winners per group
  const groupTheIdolsPlayoffWinnersMap = new Map<
    string,
    Array<{
      seasonNumber: number;
      seasonName: string;
      championId: string;
      championName: string;
      championPhoto?: string;
    }>
  >();

  theIdolsArchives.forEach((arch) => {
    // Playoff champion
    if (arch.championId) {
      const champIdol = idolsMap.get(arch.championId);
      const groupName = arch.championGroup || champIdol?.girlGroup || 'Solo / Independent';
      if (!groupTheIdolsPlayoffWinnersMap.has(groupName)) {
        groupTheIdolsPlayoffWinnersMap.set(groupName, []);
      }
      groupTheIdolsPlayoffWinnersMap.get(groupName)!.push({
        seasonNumber: arch.seasonNumber,
        seasonName: arch.seasonName || `The Idols Season ${arch.seasonNumber}`,
        championId: arch.championId,
        championName: arch.championName || champIdol?.name || 'Playoff Champion',
        championPhoto: arch.championPhoto || champIdol?.photoUrl,
      });
    }

    // Regular season 1st place
    const leagueWinner = (arch.standings || []).find((s) => s.rank === 1 && (s.played || 0) > 0);
    if (leagueWinner) {
      const champIdol = idolsMap.get(leagueWinner.idolId);
      const groupName = champIdol?.girlGroup || 'Solo / Independent';
      if (!groupTheIdolsLeagueWinnersMap.has(groupName)) {
        groupTheIdolsLeagueWinnersMap.set(groupName, []);
      }
      groupTheIdolsLeagueWinnersMap.get(groupName)!.push({
        seasonNumber: arch.seasonNumber,
        seasonName: arch.seasonName || `The Idols Season ${arch.seasonNumber}`,
        championId: leagueWinner.idolId,
        championName: leagueWinner.idolName || champIdol?.name || 'League Winner',
        championPhoto: leagueWinner.photoUrl || champIdol?.photoUrl,
      });
    }
  });

  if (theIdolsState) {
    // Active Playoff Champion
    if ((theIdolsState.isPlayoffCompleted || theIdolsState.championId) && theIdolsState.championId) {
      const champIdol = idolsMap.get(theIdolsState.championId);
      const groupName = champIdol?.girlGroup || 'Solo / Independent';
      if (!groupTheIdolsPlayoffWinnersMap.has(groupName)) {
        groupTheIdolsPlayoffWinnersMap.set(groupName, []);
      }
      const existingList = groupTheIdolsPlayoffWinnersMap.get(groupName)!;
      const exists = existingList.some((w) => w.seasonNumber === theIdolsState.seasonNumber);
      if (!exists) {
        existingList.push({
          seasonNumber: theIdolsState.seasonNumber,
          seasonName: theIdolsState.seasonName || `The Idols Season ${theIdolsState.seasonNumber}`,
          championId: theIdolsState.championId,
          championName: theIdolsState.championName || champIdol?.name || 'Playoff Champion',
          championPhoto: theIdolsState.championPhoto || champIdol?.photoUrl,
        });
      }
    }

    // Active Regular Season League Winner
    if (theIdolsState.isLeagueCompleted && theIdolsState.standings?.[0]?.rank === 1 && (theIdolsState.standings[0].played || 0) > 0) {
      const leagueWinner = theIdolsState.standings[0];
      const champIdol = idolsMap.get(leagueWinner.idolId);
      const groupName = champIdol?.girlGroup || 'Solo / Independent';
      if (!groupTheIdolsLeagueWinnersMap.has(groupName)) {
        groupTheIdolsLeagueWinnersMap.set(groupName, []);
      }
      const existingList = groupTheIdolsLeagueWinnersMap.get(groupName)!;
      const exists = existingList.some((w) => w.seasonNumber === theIdolsState.seasonNumber);
      if (!exists) {
        existingList.push({
          seasonNumber: theIdolsState.seasonNumber,
          seasonName: theIdolsState.seasonName || `The Idols Season ${theIdolsState.seasonNumber}`,
          championId: leagueWinner.idolId,
          championName: leagueWinner.idolName || champIdol?.name || 'League Winner',
          championPhoto: champIdol?.photoUrl,
        });
      }
    }
  }

  // 3. Compute match stats per idol & aggregate per group
  const idolMatchStats = new Map<
    string,
    { matches: number; wins: number; draws: number; losses: number; scoreFor: number; scoreAgainst: number }
  >();

  matchDatabase.forEach((m) => {
    if (m.idolAId) {
      if (!idolMatchStats.has(m.idolAId)) {
        idolMatchStats.set(m.idolAId, { matches: 0, wins: 0, draws: 0, losses: 0, scoreFor: 0, scoreAgainst: 0 });
      }
      const st = idolMatchStats.get(m.idolAId)!;
      st.matches++;
      st.scoreFor += m.scoreA || 0;
      st.scoreAgainst += m.scoreB || 0;

      if (m.winnerId === m.idolAId) st.wins++;
      else if (m.isDraw || m.scoreA === m.scoreB) st.draws++;
      else st.losses++;
    }

    if (m.idolBId) {
      if (!idolMatchStats.has(m.idolBId)) {
        idolMatchStats.set(m.idolBId, { matches: 0, wins: 0, draws: 0, losses: 0, scoreFor: 0, scoreAgainst: 0 });
      }
      const st = idolMatchStats.get(m.idolBId)!;
      st.matches++;
      st.scoreFor += m.scoreB || 0;
      st.scoreAgainst += m.scoreA || 0;

      if (m.winnerId === m.idolBId) st.wins++;
      else if (m.isDraw || m.scoreA === m.scoreB) st.draws++;
      else st.losses++;
    }
  });

  // V5 title archives are the authoritative source for cup and Division 2 champions.
  // Keep full winner snapshots so every title can show its winner, photo and season.
  const v5WinnerByCompetition = new Map<string, Map<string, Map<string, {
    id: string; seasonNumber: number; seasonName: string; competitionName: string;
    championId: string; championName: string; championPhoto?: string;
  }>>>();
  const v5CompetitionNames: Array<[string, (name: string) => boolean]> = [
    ['Crown Cup', (name) => name.toLowerCase() === 'league champions cup'],
    ['Open Arena Cup', (name) => name.toLowerCase() === 'all-league knockout cup'],
    ['Spotlight Cup', (name) => name.toLowerCase().startsWith('top 16 mini cup')],
    ['Super Cup A', (name) => name.toLowerCase() === 'super cup a'],
    ['Super Cup B', (name) => name.toLowerCase().startsWith('super cup b')],
    ['Division 2', (name) => name.toLowerCase().startsWith('division 2')],
  ];
  (v5TitleArchives || []).forEach((record) => {
    if (!record?.winnerId) return;
    const competitionName = String(record.competition || '').trim();
    const competition = record.isDivision
      ? 'Division 2'
      : v5CompetitionNames.find(([label, matches]) => label !== 'Division 2' && matches(competitionName))?.[0];
    if (!competition) return;
    const winnerId = String(record.winnerId);
    const champIdol = idolsMap.get(winnerId);
    const groupName = record.winnerGroup || champIdol?.girlGroup || 'Solo / Independent';
    const seasonNumber = Number(record.seasonNumber || 1);
    const recordId = String(record.id || `${seasonNumber}::${competitionName}::${winnerId}`);
    if (!v5WinnerByCompetition.has(competition)) v5WinnerByCompetition.set(competition, new Map());
    const groups = v5WinnerByCompetition.get(competition)!;
    if (!groups.has(groupName)) groups.set(groupName, new Map());
    const winners = groups.get(groupName)!;
    if (!winners.has(recordId)) {
      winners.set(recordId, {
        id: recordId,
        seasonNumber,
        seasonName: record.seasonName || `Season ${seasonNumber}`,
        competitionName,
        championId: winnerId,
        championName: record.winnerName || champIdol?.name || 'Unknown',
        championPhoto: record.winnerPhoto || champIdol?.photoUrl,
      });
    }
  });

  // Keep historical group names visible even if the current idol roster has changed.
  v5WinnerByCompetition.forEach((groups) => groups.forEach((_winners, groupName) => {
    if (!groupMembersMap.has(groupName)) groupMembersMap.set(groupName, []);
  }));

  // 4. Build GirlGroupStat list
  const groupStatsList: GirlGroupStat[] = [];

  groupMembersMap.forEach((members, groupName) => {
    const seasonWinners = groupSeasonWinnersMap.get(groupName) || [];
    const leagueCupWinners = groupLeagueCupWinnersMap.get(groupName) || [];
    const theIdolsLeagueWinners = groupTheIdolsLeagueWinnersMap.get(groupName) || [];
    const theIdolsPlayoffWinners = groupTheIdolsPlayoffWinnersMap.get(groupName) || [];
    const totalTournamentTitles = seasonWinners.length;
    const totalLeagueCups = leagueCupWinners.length;
    const totalTheIdolsLeague = theIdolsLeagueWinners.length;
    const totalTheIdolsPlayoff = theIdolsPlayoffWinners.length;
    const competitionTitles: Record<string, number> = {};
    v5WinnerByCompetition.forEach((groups, competition) => {
      competitionTitles[competition] = groups.get(groupName)?.size || 0;
    });
    const competitionWinners: GirlGroupStat['competitionWinners'] = {};
    v5WinnerByCompetition.forEach((groups, competition) => {
      competitionWinners[competition] = [...(groups.get(groupName)?.values() || [])]
        .sort((a, b) => a.seasonNumber - b.seasonNumber || a.competitionName.localeCompare(b.competitionName));
    });
    const totalTitles = totalTournamentTitles + totalLeagueCups + totalTheIdolsLeague + totalTheIdolsPlayoff + Object.values(competitionTitles).reduce((sum, count) => sum + count, 0);

    let groupMatches = 0;
    let groupWins = 0;
    let groupDraws = 0;
    let groupLosses = 0;
    let groupScoreFor = 0;
    let groupScoreAgainst = 0;

    const memberStats = members.map((member) => {
      const st = idolMatchStats.get(member.id) || {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoreFor: 0,
        scoreAgainst: 0,
      };

      // Count tournament titles for this member
      const memberTitles = seasonWinners.filter((w) => w.championId === member.id).length;
      // Count league cup titles for this member
      const memberLeagueCups = leagueCupWinners.filter((w) => w.championId === member.id).length;
      // Count the idols league titles for this member
      const memberTheIdolsLeague = theIdolsLeagueWinners.filter((w) => w.championId === member.id).length;
      // Count the idols playoff titles for this member
      const memberTheIdolsPlayoff = theIdolsPlayoffWinners.filter((w) => w.championId === member.id).length;
      const memberCompetitionTitles: Record<string, number> = {};
      v5WinnerByCompetition.forEach((groups, competition) => {
        memberCompetitionTitles[competition] = [...(groups.get(groupName)?.values() || [])]
          .filter((winner) => winner.championId === member.id).length;
      });

      groupMatches += st.matches;
      groupWins += st.wins;
      groupDraws += st.draws;
      groupLosses += st.losses;
      groupScoreFor += st.scoreFor;
      groupScoreAgainst += st.scoreAgainst;

      const wr = st.matches > 0 ? Math.round((st.wins / st.matches) * 1000) / 10 : 0;

      return {
        id: member.id,
        name: member.name,
        photoUrl: member.photoUrl,
        championships: memberTitles,
        leagueCupTitles: memberLeagueCups,
        theIdolsLeagueTitles: memberTheIdolsLeague,
        theIdolsPlayoffTitles: memberTheIdolsPlayoff,
        competitionTitles: memberCompetitionTitles,
        matches: st.matches,
        wins: st.wins,
        draws: st.draws,
        losses: st.losses,
        winRate: wr,
      };
    });

    // Sort member stats by total championships + cups + the idols league + playoff, then wins
    memberStats.sort((a, b) => {
      const v5A = Object.values(a.competitionTitles).reduce((sum, count) => sum + count, 0);
      const v5B = Object.values(b.competitionTitles).reduce((sum, count) => sum + count, 0);
      const totA = calculateUnifiedTotalTitles(a.championships, a.leagueCupTitles, a.theIdolsLeagueTitles, a.theIdolsPlayoffTitles) + v5A;
      const totB = calculateUnifiedTotalTitles(b.championships, b.leagueCupTitles, b.theIdolsLeagueTitles, b.theIdolsPlayoffTitles) + v5B;
      if (totB !== totA) return totB - totA;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    });

    const overallWinRate =
      groupMatches > 0 ? Math.round((groupWins / groupMatches) * 1000) / 10 : 0;

    groupStatsList.push({
      groupName,
      totalMembers: members.length,
      championships: totalTournamentTitles,
      competitionTitles,
      competitionWinners,
      totalTitles,
      seasonWinners,
      leagueCupTitles: totalLeagueCups,
      leagueCupWinners,
      theIdolsLeagueTitles: totalTheIdolsLeague,
      theIdolsLeagueWinners,
      theIdolsPlayoffTitles: totalTheIdolsPlayoff,
      theIdolsPlayoffWinners,
      totalMatches: groupMatches,
      totalWins: groupWins,
      totalDraws: groupDraws,
      totalLosses: groupLosses,
      winRate: overallWinRate,
      gameDiff: groupScoreFor - groupScoreAgainst,
      members: memberStats,
    });
  });

  // Sort group list based on activeScope
  groupStatsList.sort((a, b) => {
    if (activeScope === 'tournament') {
      if (b.championships !== a.championships) return b.championships - a.championships;
    } else if (activeScope === 'league') {
      if (b.leagueCupTitles !== a.leagueCupTitles) return b.leagueCupTitles - a.leagueCupTitles;
    } else if (activeScope === 'the_idols') {
      const idolsA = a.theIdolsLeagueTitles + a.theIdolsPlayoffTitles;
      const idolsB = b.theIdolsLeagueTitles + b.theIdolsPlayoffTitles;
      if (idolsB !== idolsA) return idolsB - idolsA;
    } else if (['crown_cup','open_arena_cup','spotlight_cup','super_cup_a','super_cup_b','division_2'].includes(activeScope)) {
      const label = ({ crown_cup: 'Crown Cup', open_arena_cup: 'Open Arena Cup', spotlight_cup: 'Spotlight Cup', super_cup_a: 'Super Cup A', super_cup_b: 'Super Cup B', division_2: 'Division 2' } as Record<string,string>)[activeScope];
      const countA = a.competitionTitles[label] || 0, countB = b.competitionTitles[label] || 0;
      if (countB !== countA) return countB - countA;
    } else {
      if (b.totalTitles !== a.totalTitles) return b.totalTitles - a.totalTitles;
    }
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.totalMembers - a.totalMembers;
  });

  const filteredGroups = groupStatsList.filter((g) =>
    g.groupName.toLowerCase().includes(search.toLowerCase())
  );

  const totalTitlesAcrossGroups = groupStatsList.reduce((sum, group) => sum + group.totalTitles, 0);
  const totalMatchesAcrossGroups = groupStatsList.reduce((sum, group) => sum + group.totalMatches, 0);
  const totalWinsAcrossGroups = groupStatsList.reduce((sum, group) => sum + group.totalWins, 0);
  const competitionFilters: Array<{ id: typeof activeScope; label: string }> = [
    { id: 'combined', label: 'All competitions' },
    { id: 'tournament', label: 'Tournament' },
    { id: 'league', label: 'League divisions' },
    { id: 'the_idols', label: 'The Idols' },
    { id: 'crown_cup', label: 'Crown Cup' },
    { id: 'open_arena_cup', label: 'Open Arena Cup' },
    { id: 'spotlight_cup', label: 'Spotlight Cup' },
    { id: 'super_cup_a', label: 'Super Cup A' },
    { id: 'super_cup_b', label: 'Super Cup B' },
    { id: 'division_2', label: 'Division 2' },
  ];
  const titleCategories = [
    { label: 'Tournament', value: (g: GirlGroupStat) => g.seasonWinners.length },
    { label: 'League divisions', value: (g: GirlGroupStat) => g.leagueCupTitles },
    { label: 'The Idols League', value: (g: GirlGroupStat) => g.theIdolsLeagueTitles },
    { label: 'The Idols Playoff', value: (g: GirlGroupStat) => g.theIdolsPlayoffTitles },
    { label: 'Crown Cup', value: (g: GirlGroupStat) => g.competitionTitles['Crown Cup'] || 0 },
    { label: 'Open Arena Cup', value: (g: GirlGroupStat) => g.competitionTitles['Open Arena Cup'] || 0 },
    { label: 'Spotlight Cup', value: (g: GirlGroupStat) => g.competitionTitles['Spotlight Cup'] || 0 },
    { label: 'Super Cup A', value: (g: GirlGroupStat) => g.competitionTitles['Super Cup A'] || 0 },
    { label: 'Super Cup B', value: (g: GirlGroupStat) => g.competitionTitles['Super Cup B'] || 0 },
    { label: 'Division 2', value: (g: GirlGroupStat) => g.competitionTitles['Division 2'] || 0 },
  ];

  return (
    <div className="space-y-6 pb-8 text-amber-50">
      <section className="rounded-2xl border border-black bg-[#1b140f] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              <Users className="h-4 w-4" /> Arena database
            </div>
            <h2 className="text-2xl font-poster-title tracking-tight text-amber-100 sm:text-3xl">Girl Group Rankings</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-200/70">
              Championship records and match performance across every competition.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="min-w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-200/70">Groups</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{groupStatsList.length}</p>
            </div>
            <div className="min-w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-200/70">Total titles</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-300">{totalTitlesAcrossGroups}</p>
            </div>
            <div className="col-span-2 min-w-28 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-amber-200/70">Matches played</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-white">{totalMatchesAcrossGroups}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-black bg-[#1b140f] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Competition filter</h3>
            <p className="mt-1 text-xs text-amber-200/50">Rank groups by the selected competition.</p>
          </div>
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-200/50" />
            <input
              type="text"
              placeholder="Search group..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-black bg-[#120e0b] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {competitionFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveScope(filter.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${activeScope === filter.id ? 'bg-[#991b1b] text-white shadow-lg shadow-black' : 'border border-black bg-[#120e0b] text-amber-200/70 hover:border-slate-500 hover:text-white'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-poster-title text-amber-100">Group leaderboard</h3>
          <p className="mt-1 text-xs text-amber-200/50">Showing {filteredGroups.length} of {groupStatsList.length} groups</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/50">Combined win rate</p>
          <p className="text-lg font-bold tabular-nums text-emerald-400">{totalMatchesAcrossGroups ? (Math.round((totalWinsAcrossGroups / totalMatchesAcrossGroups) * 1000) / 10) : 0}%</p>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black bg-[#1b140f] px-6 py-14 text-center">
          <Search className="mx-auto h-8 w-8 text-amber-200/30" />
          <p className="mt-3 text-sm font-semibold text-amber-100">No groups found</p>
          <p className="mt-1 text-xs text-amber-200/50">Try another group name or clear the search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group, idx) => {
            const isExpanded = expandedGroup === group.groupName;
            const groupInfo = girlGroups.find((g) => g.name === group.groupName);
            const logoUrl = groupInfo?.logoUrl;
            const categoryCounts = titleCategories.map((category) => ({ label: category.label, count: category.value(group) })).filter((item) => item.count > 0);
            return (
              <article key={group.groupName} className={`overflow-hidden rounded-2xl border transition-colors ${isExpanded ? 'border-amber-500/50 bg-[#1b140f]' : 'border-black bg-[#1b140f] hover:border-black'}`}>
                <button
                  type="button"
                  onClick={() => setExpandedGroup(isExpanded ? null : group.groupName)}
                  aria-expanded={isExpanded}
                  className="w-full p-4 text-left sm:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${idx === 0 ? 'bg-amber-400 text-white' : 'bg-[#282018] text-amber-200/70'}`}>#{idx + 1}</div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black bg-[#120e0b]">
                        {logoUrl ? <img src={logoUrl} alt={group.groupName} className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-amber-200/70">{(group.groupName || 'GG').slice(0, 2).toUpperCase()}</span>}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-base font-poster-title text-amber-100 sm:text-lg">{group.groupName}</h4>
                          <span className="rounded-md bg-amber-400/15 px-2 py-1 text-[11px] font-bold text-amber-300">{group.totalTitles} titles</span>
                        </div>
                        <p className="mt-1 text-xs text-amber-200/50">{group.totalMembers} members <span className="px-1 text-black">•</span> {group.totalMatches} matches</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:min-w-[460px]">
                      <div className="rounded-lg bg-[#120e0b] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-amber-200/50">Wins</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-emerald-400">{group.totalWins}</p>
                      </div>
                      <div className="rounded-lg bg-[#120e0b] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-amber-200/50">Draws</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-amber-100">{group.totalDraws}</p>
                      </div>
                      <div className="rounded-lg bg-[#120e0b] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-amber-200/50">Losses</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-red-400">{group.totalLosses}</p>
                      </div>
                      <div className="rounded-lg bg-[#120e0b] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-amber-200/50">Win rate</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-amber-300">{group.winRate}%</p>
                      </div>
                      <div className="col-span-3 flex items-center justify-between rounded-lg bg-[#120e0b] px-3 py-2 sm:col-span-1">
                        <div><p className="text-[10px] uppercase tracking-wide text-amber-200/50">Goal diff.</p><p className={`mt-1 text-sm font-bold tabular-nums ${group.gameDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{group.gameDiff > 0 ? '+' : ''}{group.gameDiff}</p></div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-amber-300" /> : <ChevronDown className="h-4 w-4 text-amber-200/50" />}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {categoryCounts.length ? categoryCounts.map((item) => (
                      <span key={item.label} className="rounded-md border border-black/80 bg-[#120e0b] px-2 py-1 text-[10px] font-medium text-amber-200/70">{item.label} <strong className="ml-1 text-amber-100">{item.count}</strong></span>
                    )) : <span className="text-xs text-amber-200/30">No championship titles recorded</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-black bg-[#160f0b] p-4 sm:p-5">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div><h5 className="text-sm font-bold text-white">Championship breakdown</h5><p className="mt-1 text-xs text-amber-200/50">All recorded titles for {group.groupName}</p></div>
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-right"><p className="text-[10px] uppercase tracking-wider text-amber-300/70">Total titles</p><p className="text-xl font-bold text-amber-300">{group.totalTitles}</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        { label: 'Tournament', winners: group.seasonWinners.map((w) => ({ key: `t-${w.seasonId}-${w.championId}`, season: w.seasonName, name: w.championName, photo: w.championPhoto })) },
                        { label: 'League divisions', winners: group.leagueCupWinners.map((w) => ({ key: `l-${w.seasonNumber}-${w.leagueId}-${w.championId}`, season: `Season ${w.seasonNumber} · ${w.leagueName}`, name: w.championName, photo: w.championPhoto })) },
                        { label: 'The Idols League', winners: group.theIdolsLeagueWinners.map((w) => ({ key: `il-${w.seasonNumber}-${w.championId}`, season: w.seasonName, name: w.championName, photo: w.championPhoto })) },
                        { label: 'The Idols Playoff', winners: group.theIdolsPlayoffWinners.map((w) => ({ key: `ip-${w.seasonNumber}-${w.championId}`, season: w.seasonName, name: w.championName, photo: w.championPhoto })) },
                      ].map((section) => (
                        <section key={section.label} className="rounded-xl border border-black bg-[#1b140f] p-3">
                          <div className="mb-3 flex items-center justify-between"><h6 className="text-xs font-semibold text-amber-100">{section.label}</h6><span className="text-xs font-bold text-amber-300">{section.winners.length}</span></div>
                          {section.winners.length ? <div className="space-y-2">{section.winners.map((winner) => <div key={winner.key} className="flex items-center gap-2 rounded-lg bg-[#120e0b] p-2">{winner.photo ? <img src={winner.photo} alt={winner.name} className="h-8 w-8 rounded-md object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#282018] text-xs font-bold text-amber-200/70">{winner.name.slice(0, 1)}</div>}<div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{winner.name}</p><p className="truncate text-[10px] text-amber-200/50">{winner.season}</p></div></div>)}</div> : <p className="py-3 text-xs text-amber-200/30">No titles recorded.</p>}
                        </section>
                      ))}
                      <section className="rounded-xl border border-black bg-[#1b140f] p-3 sm:col-span-2 xl:col-span-3">
                        <div className="mb-3 flex items-center justify-between"><h6 className="text-xs font-semibold text-amber-100">V5 cups and divisions</h6><span className="text-xs font-bold text-amber-300">{['Crown Cup','Open Arena Cup','Spotlight Cup','Super Cup A','Super Cup B','Division 2'].reduce((sum, name) => sum + (group.competitionTitles[name] || 0), 0)}</span></div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {['Crown Cup','Open Arena Cup','Spotlight Cup','Super Cup A','Super Cup B','Division 2'].map((name) => {
                            const winners = group.competitionWinners[name] || [];
                            return <section key={name} className="rounded-lg bg-[#120e0b] p-3">
                              <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold text-amber-200/70">{name}</p><span className="text-xs font-bold text-amber-300">{winners.length}</span></div>
                              {winners.length ? <div className="space-y-2">{winners.map((winner) => <div key={winner.id} className="flex items-center gap-2 rounded-md bg-[#1b140f] p-2">
                                {winner.championPhoto ? <img src={winner.championPhoto} alt={winner.championName} className="h-8 w-8 shrink-0 rounded-md object-cover" /> : <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#282018] text-xs font-bold text-amber-200/70">{winner.championName.slice(0,1)}</div>}
                                <div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{winner.championName}</p><p className="truncate text-[10px] text-amber-200/50">{winner.seasonName} · {winner.competitionName}</p></div>
                              </div>)}</div> : <p className="py-2 text-[10px] text-amber-200/30">No titles recorded.</p>}
                            </section>;
                          })}
                        </div>
                      </section>
                    </div>

                    <section className="mt-5">
                      <div className="mb-3"><h5 className="text-sm font-bold text-white">Member performance</h5><p className="mt-1 text-xs text-amber-200/50">Individual match records within this group.</p></div>
                      {group.members.length === 0 ? <p className="rounded-lg bg-[#1b140f] p-4 text-xs text-amber-200/50">No members in this group.</p> : (
                        <div className="overflow-x-auto rounded-xl border border-black">
                          <table className="w-full min-w-[1050px] text-left text-xs">
                            <thead className="bg-[#1b140f] text-[10px] uppercase tracking-wider text-amber-200/50"><tr><th className="px-3 py-3">Member</th><th className="px-3 py-3 text-center">Tournament</th><th className="px-3 py-3 text-center">League</th><th className="px-3 py-3 text-center">Idols league</th><th className="px-3 py-3 text-center">Playoff</th>{['Crown Cup','Open Arena Cup','Spotlight Cup','Super Cup A','Super Cup B','Division 2'].map((name) => <th key={name} className="px-3 py-3 text-center">{name}</th>)}<th className="px-3 py-3 text-center">Matches</th><th className="px-3 py-3 text-center">W-D-L</th><th className="px-3 py-3 text-center">Win rate</th></tr></thead>
                            <tbody className="divide-y divide-slate-800 bg-[#120e0b]">{group.members.map((mem) => <tr key={mem.id} className="hover:bg-[#1b140f]/80"><td className="px-3 py-2.5"><div className="flex items-center gap-2">{mem.photoUrl ? <img src={mem.photoUrl} alt={mem.name} className="h-7 w-7 rounded-md object-cover" /> : <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#282018] text-[10px] font-bold text-amber-100">{(mem.name || 'ID').slice(0,1)}</div>}<span className="font-semibold text-amber-100">{mem.name}</span></div></td><td className="px-3 py-2.5 text-center text-amber-300">{mem.championships}</td><td className="px-3 py-2.5 text-center text-teal-300">{mem.leagueCupTitles}</td><td className="px-3 py-2.5 text-center text-sky-300">{mem.theIdolsLeagueTitles}</td><td className="px-3 py-2.5 text-center text-fuchsia-300">{mem.theIdolsPlayoffTitles}</td>{['Crown Cup','Open Arena Cup','Spotlight Cup','Super Cup A','Super Cup B','Division 2'].map((name) => <td key={name} className="px-3 py-2.5 text-center text-amber-300">{mem.competitionTitles[name] || 0}</td>)}<td className="px-3 py-2.5 text-center text-amber-100">{mem.matches}</td><td className="px-3 py-2.5 text-center font-semibold text-emerald-300">{mem.wins}-{mem.draws}-{mem.losses}</td><td className="px-3 py-2.5 text-center text-amber-300">{mem.winRate}%</td></tr>)}</tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
