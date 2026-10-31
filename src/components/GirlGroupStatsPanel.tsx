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

interface GirlGroupStatsPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  archives: TournamentArchive[];
  matchDatabase: ArchivedMatch[];
  leagueArchives?: LeagueSeasonArchive[];
  leagueState?: LeagueSeasonState | null;
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
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
}) => {
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<'combined' | 'tournament' | 'league' | 'the_idols'>('combined');

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
      const groupName = champIdol?.girlGroup || 'Solo / Independent';

      if (!groupSeasonWinnersMap.has(groupName)) {
        groupSeasonWinnersMap.set(groupName, []);
      }
      groupSeasonWinnersMap.get(groupName)!.push({
        seasonId: arch.seasonId,
        seasonName: arch.seasonName || `Season ${arch.seasonId}`,
        championId: arch.championId,
        championName: arch.championName || champIdol?.name || 'Unknown',
        championPhoto: champIdol?.photoUrl,
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
          const groupName = champIdol?.girlGroup || 'Solo / Independent';
          if (!groupLeagueCupWinnersMap.has(groupName)) {
            groupLeagueCupWinnersMap.set(groupName, []);
          }
          groupLeagueCupWinnersMap.get(groupName)!.push({
            seasonNumber: arch.seasonNumber,
            leagueId: winner.leagueId,
            leagueName: winner.leagueName || `Division ${winner.leagueId}`,
            championId: winner.championId,
            championName: winner.championName || champIdol?.name || 'Unknown',
            championPhoto: champIdol?.photoUrl,
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
            const groupName = champIdol?.girlGroup || 'Solo / Independent';
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
      const groupName = champIdol?.girlGroup || 'Solo / Independent';
      if (!groupTheIdolsPlayoffWinnersMap.has(groupName)) {
        groupTheIdolsPlayoffWinnersMap.set(groupName, []);
      }
      groupTheIdolsPlayoffWinnersMap.get(groupName)!.push({
        seasonNumber: arch.seasonNumber,
        seasonName: arch.seasonName || `The Idols Season ${arch.seasonNumber}`,
        championId: arch.championId,
        championName: arch.championName || champIdol?.name || 'Playoff Champion',
        championPhoto: champIdol?.photoUrl,
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
        championPhoto: champIdol?.photoUrl,
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
          championPhoto: champIdol?.photoUrl,
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

  // 4. Build GirlGroupStat list
  const groupStatsList: GirlGroupStat[] = [];

  groupMembersMap.forEach((members, groupName) => {
    const seasonWinners = groupSeasonWinnersMap.get(groupName) || [];
    const leagueCupWinners = groupLeagueCupWinnersMap.get(groupName) || [];
    const theIdolsLeagueWinners = groupTheIdolsLeagueWinnersMap.get(groupName) || [];
    const theIdolsPlayoffWinners = groupTheIdolsPlayoffWinnersMap.get(groupName) || [];
    const totalTitles = seasonWinners.length;
    const totalLeagueCups = leagueCupWinners.length;
    const totalTheIdolsLeague = theIdolsLeagueWinners.length;
    const totalTheIdolsPlayoff = theIdolsPlayoffWinners.length;

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
        matches: st.matches,
        wins: st.wins,
        draws: st.draws,
        losses: st.losses,
        winRate: wr,
      };
    });

    // Sort member stats by total championships + cups + the idols league + playoff, then wins
    memberStats.sort((a, b) => {
      const totA = calculateUnifiedTotalTitles(a.championships, a.leagueCupTitles, a.theIdolsLeagueTitles, a.theIdolsPlayoffTitles);
      const totB = calculateUnifiedTotalTitles(b.championships, b.leagueCupTitles, b.theIdolsLeagueTitles, b.theIdolsPlayoffTitles);
      if (totB !== totA) return totB - totA;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    });

    const overallWinRate =
      groupMatches > 0 ? Math.round((groupWins / groupMatches) * 1000) / 10 : 0;

    groupStatsList.push({
      groupName,
      totalMembers: members.length,
      championships: totalTitles,
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
    } else {
      const titlesA = calculateUnifiedTotalTitles(a.championships, a.leagueCupTitles, a.theIdolsLeagueTitles, a.theIdolsPlayoffTitles);
      const titlesB = calculateUnifiedTotalTitles(b.championships, b.leagueCupTitles, b.theIdolsLeagueTitles, b.theIdolsPlayoffTitles);
      if (titlesB !== titlesA) return titlesB - titlesA;
    }
    if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.totalMembers - a.totalMembers;
  });

  const filteredGroups = groupStatsList.filter((g) =>
    g.groupName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Section Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Users className="h-7 w-7 text-amber-400" />
            <span>Girl Group Statistics &amp; Championship Leaderboard</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Tracks total Tournament championships, League Cup titles, The Idols League &amp; Playoff titles, and collective records.
          </p>
        </div>

        {/* Scope Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#160f0b] p-1.5 rounded-2xl border-2 border-black poster-shadow-sm">
          <button
            onClick={() => setActiveScope('combined')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeScope === 'combined'
                ? 'bg-amber-400 text-black shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>All Competitions</span>
          </button>
          <button
            onClick={() => setActiveScope('tournament')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeScope === 'tournament'
                ? 'poster-pill-red text-white shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>Tournament Cups</span>
          </button>
          <button
            onClick={() => setActiveScope('league')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeScope === 'league'
                ? 'poster-pill-gold text-amber-950 shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>League Divisions</span>
          </button>
          <button
            onClick={() => setActiveScope('the_idols')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeScope === 'the_idols'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow ring-2 ring-fuchsia-400/50'
                : 'text-fuchsia-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>The Idols Honors</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-[#1c1612] p-4 rounded-2xl border-2 border-black poster-shadow">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-amber-400/60" />
          <input
            type="text"
            placeholder="Search Girl Group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border-2 border-black bg-[#120e0b] pl-9 pr-4 py-2 text-xs text-amber-100 font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="text-xs font-black text-amber-300 uppercase tracking-wide font-poster-body">
          Total Groups: <span className="text-red-400 font-poster-title text-sm">{groupStatsList.length}</span>
        </div>
      </div>

      {/* Group Stats Grid */}
      <div className="space-y-4">
        {filteredGroups.map((group, idx) => {
          const isExpanded = expandedGroup === group.groupName;
          const groupInfo = girlGroups.find((g) => g.name === group.groupName);
          const logoUrl = groupInfo?.logoUrl;
          const totalHonors = group.championships + group.leagueCupTitles + group.theIdolsLeagueTitles + group.theIdolsPlayoffTitles;

          return (
            <div
              key={group.groupName}
              className={`rounded-2xl border-2 border-black transition-all ${
                totalHonors > 0
                  ? 'bg-[#231812] poster-shadow-lg'
                  : 'bg-[#18130f] poster-shadow'
              }`}
            >
              {/* Group Main Row */}
              <div
                onClick={() => setExpandedGroup(isExpanded ? null : group.groupName)}
                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-[#2c1f17]/60 transition-colors rounded-2xl"
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div
                    className={`h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-xl font-poster-title text-sm border-2 border-black ${
                      idx === 0
                        ? 'bg-amber-400 text-black poster-shadow-sm'
                        : idx === 1
                        ? 'bg-slate-200 text-black poster-shadow-sm'
                        : idx === 2
                        ? 'bg-amber-700 text-white poster-shadow-sm'
                        : 'bg-[#282018] text-amber-200/80'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  {/* Girl Group Logo */}
                  <div className="h-12 w-12 flex-shrink-0 rounded-xl border-2 border-black bg-[#120e0b] p-1 flex items-center justify-center overflow-hidden poster-shadow-sm">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={group.groupName}
                        className="h-full w-full object-cover rounded-lg"
                      />
                    ) : (
                      <span className="font-poster-title text-amber-300 text-xs uppercase">
                        {(group.groupName || 'GG').slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-poster-title text-amber-100 flex items-center gap-2 flex-wrap">
                      <span>{group.groupName}</span>
                      {group.championships > 0 && (
                        <span className="flex items-center gap-1 rounded-full poster-pill-gold px-2.5 py-0.5 text-xs font-black">
                          <Crown className="h-3.5 w-3.5" />
                          {group.championships} {group.championships === 1 ? 'Championship' : 'Championships'}
                        </span>
                      )}
                      {group.leagueCupTitles > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-teal-500/20 border border-teal-400/50 text-teal-300 px-2.5 py-0.5 text-xs font-black">
                          <Shield className="h-3.5 w-3.5 text-teal-400" />
                          {group.leagueCupTitles} {group.leagueCupTitles === 1 ? 'League Cup' : 'League Cups'}
                        </span>
                      )}
                      {group.theIdolsLeagueTitles > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 px-2.5 py-0.5 text-xs font-black">
                          <Star className="h-3.5 w-3.5 text-sky-400" />
                          {group.theIdolsLeagueTitles} {group.theIdolsLeagueTitles === 1 ? 'Idols League Title' : 'Idols League Titles'}
                        </span>
                      )}
                      {group.theIdolsPlayoffTitles > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-300 px-2.5 py-0.5 text-xs font-black">
                          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                          {group.theIdolsPlayoffTitles} {group.theIdolsPlayoffTitles === 1 ? 'Idols Playoff Title' : 'Idols Playoff Titles'}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-amber-200/70 font-bold mt-0.5">
                      {group.totalMembers} Members &bull; Cups: <span className="font-black text-amber-400">{group.championships}</span> &bull; Leagues: <span className="font-black text-teal-400">{group.leagueCupTitles}</span> &bull; Idols League: <span className="font-black text-sky-400">{group.theIdolsLeagueTitles}</span> &bull; Idols Playoff: <span className="font-black text-fuchsia-400">{group.theIdolsPlayoffTitles}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Stats Banner */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                  <div className="bg-[#991b1b] px-3 py-1.5 rounded-xl border-2 border-black text-center text-white poster-shadow-sm">
                    <span className="block text-[9px] text-amber-200 font-extrabold uppercase font-poster-body">Cups</span>
                    <span className="font-poster-title text-amber-300 text-sm flex items-center justify-center gap-1">
                      <Crown className="h-3.5 w-3.5" />
                      {group.championships}
                    </span>
                  </div>

                  <div className="bg-[#0f2922] px-3 py-1.5 rounded-xl border-2 border-black text-center text-white poster-shadow-sm">
                    <span className="block text-[9px] text-teal-200 font-extrabold uppercase font-poster-body">Leagues</span>
                    <span className="font-poster-title text-teal-300 text-sm flex items-center justify-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      {group.leagueCupTitles}
                    </span>
                  </div>

                  <div className="bg-[#0c2e46] px-3 py-1.5 rounded-xl border-2 border-black text-center text-white poster-shadow-sm">
                    <span className="block text-[9px] text-sky-200 font-extrabold uppercase font-poster-body">Idols League</span>
                    <span className="font-poster-title text-sky-300 text-sm flex items-center justify-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      {group.theIdolsLeagueTitles}
                    </span>
                  </div>

                  <div className="bg-[#3b0764] px-3 py-1.5 rounded-xl border-2 border-black text-center text-white poster-shadow-sm">
                    <span className="block text-[9px] text-fuchsia-200 font-extrabold uppercase font-poster-body">Idols Playoff</span>
                    <span className="font-poster-title text-fuchsia-300 text-sm flex items-center justify-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      {group.theIdolsPlayoffTitles}
                    </span>
                  </div>

                  <div className="bg-[#120e0b] px-3 py-1.5 rounded-xl border-2 border-black text-center poster-shadow-sm">
                    <span className="block text-[9px] text-amber-200/70 font-extrabold uppercase font-poster-body">W-D-L</span>
                    <span className="font-poster-title text-emerald-400 text-xs">
                      {group.totalWins}-{group.totalDraws}-{group.totalLosses}
                    </span>
                  </div>

                  <div className="bg-[#120e0b] px-3 py-1.5 rounded-xl border-2 border-black text-center poster-shadow-sm">
                    <span className="block text-[9px] text-amber-200/70 font-extrabold uppercase font-poster-body">Win Rate</span>
                    <span className="font-poster-title text-blue-400 text-xs">{group.winRate}%</span>
                  </div>

                  <button className="p-2 rounded-xl bg-[#282018] border-2 border-black text-amber-300 hover:bg-red-900 transition-colors poster-shadow-sm">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Breakdown */}
              {isExpanded && (
                <div className="border-t-2 border-black p-5 space-y-6 bg-[#160f0b] rounded-b-2xl">
                  {/* 1. Season Championship Titles Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy className="h-4 w-4" />
                      <span>Season Tournament Championships Won ({group.seasonWinners.length})</span>
                    </h4>
                    {group.seasonWinners.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.seasonWinners.map((winner, wIdx) => (
                          <div
                            key={`winner-${winner.seasonId}-${wIdx}`}
                            className="flex items-center gap-3 rounded-xl border-2 border-black bg-amber-950/30 p-3 poster-shadow-sm"
                          >
                            {winner.championPhoto ? (
                              <img
                                src={winner.championPhoto}
                                alt={winner.championName}
                                className="h-10 w-10 rounded-lg object-cover border border-amber-500/40 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center font-black text-amber-400 flex-shrink-0">
                                👑
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-amber-400/80 block">
                                {winner.seasonName}
                              </span>
                              <span className="text-sm font-black text-white block leading-tight">
                                {winner.championName}
                              </span>
                              <span className="text-[10px] text-amber-300 font-semibold block">
                                Tournament Champion
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-200/40 font-medium italic p-2 rounded-lg bg-black/40 border border-black">
                        No season tournament championships won yet.
                      </div>
                    )}
                  </div>

                  {/* 2. League Cup Titles Won Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-teal-400" />
                      <span>League Division Titles Won ({group.leagueCupWinners.length})</span>
                    </h4>
                    {group.leagueCupWinners.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.leagueCupWinners.map((cup, cIdx) => (
                          <div
                            key={`cup-${cup.seasonNumber}-${cup.leagueId}-${cIdx}`}
                            className="flex items-center gap-3 rounded-xl border-2 border-black bg-teal-950/30 p-3 poster-shadow-sm"
                          >
                            {cup.championPhoto ? (
                              <img
                                src={cup.championPhoto}
                                alt={cup.championName}
                                className="h-10 w-10 rounded-lg object-cover border border-teal-500/40 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-teal-500/20 flex items-center justify-center font-black text-teal-400 flex-shrink-0">
                                🛡️
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-teal-400/90 block">
                                Season {cup.seasonNumber} &bull; {cup.leagueName}
                              </span>
                              <span className="text-sm font-black text-white block leading-tight">
                                {cup.championName}
                              </span>
                              <span className="text-[10px] text-teal-300 font-semibold block">
                                Division Champion
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-200/40 font-medium italic p-2 rounded-lg bg-black/40 border border-black">
                        No league division titles won yet.
                      </div>
                    )}
                  </div>

                  {/* 3. The Idols Superleague (Regular Season) Titles Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-sky-400" />
                      <span>The Idols League Titles (Regular Season 1st Place) ({group.theIdolsLeagueWinners.length})</span>
                    </h4>
                    {group.theIdolsLeagueWinners.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.theIdolsLeagueWinners.map((ti, tiIdx) => (
                          <div
                            key={`theidols-league-${ti.seasonNumber}-${tiIdx}`}
                            className="flex items-center gap-3 rounded-xl border-2 border-black bg-sky-950/30 p-3 poster-shadow-sm"
                          >
                            {ti.championPhoto ? (
                              <img
                                src={ti.championPhoto}
                                alt={ti.championName}
                                className="h-10 w-10 rounded-lg object-cover border border-sky-500/40 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-sky-500/20 flex items-center justify-center font-black text-sky-400 flex-shrink-0">
                                🌟
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-sky-400/90 block">
                                {ti.seasonName}
                              </span>
                              <span className="text-sm font-black text-white block leading-tight">
                                {ti.championName}
                              </span>
                              <span className="text-[10px] text-sky-300 font-semibold block">
                                Regular Season League Winner
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-200/40 font-medium italic p-2 rounded-lg bg-black/40 border border-black">
                        No Idols League titles won yet.
                      </div>
                    )}
                  </div>

                  {/* 4. The Idols Masters Playoff Titles Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-fuchsia-400" />
                      <span>The Idols Playoff Titles (Masters Champion) ({group.theIdolsPlayoffWinners.length})</span>
                    </h4>
                    {group.theIdolsPlayoffWinners.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.theIdolsPlayoffWinners.map((ti, tiIdx) => (
                          <div
                            key={`theidols-playoff-${ti.seasonNumber}-${tiIdx}`}
                            className="flex items-center gap-3 rounded-xl border-2 border-black bg-fuchsia-950/30 p-3 poster-shadow-sm"
                          >
                            {ti.championPhoto ? (
                              <img
                                src={ti.championPhoto}
                                alt={ti.championName}
                                className="h-10 w-10 rounded-lg object-cover border border-fuchsia-500/40 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-fuchsia-500/20 flex items-center justify-center font-black text-fuchsia-400 flex-shrink-0">
                                🏆
                              </div>
                            )}
                            <div>
                              <span className="text-[10px] font-extrabold uppercase text-fuchsia-400/90 block">
                                {ti.seasonName}
                              </span>
                              <span className="text-sm font-black text-white block leading-tight">
                                {ti.championName}
                              </span>
                              <span className="text-[10px] text-fuchsia-300 font-semibold block">
                                Masters Playoff Champion
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-200/40 font-medium italic p-2 rounded-lg bg-black/40 border border-black">
                        No Idols Playoff titles won yet.
                      </div>
                    )}
                  </div>

                  {/* 5. Members Leaderboard in Group */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-purple-400" />
                      <span>Member Roster Performance</span>
                    </h4>

                    {group.members.length === 0 ? (
                      <p className="text-xs text-amber-200/50">No members in this group.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border-2 border-black bg-[#120d09]">
                        <table className="w-full text-left text-xs font-poster-body text-slate-300">
                          <thead className="bg-black text-[10px] font-bold uppercase text-amber-300 border-b-2 border-black">
                            <tr>
                              <th className="px-3 py-2.5">Member</th>
                              <th className="px-3 py-2.5 text-center font-bold text-amber-400">Tourney Titles</th>
                              <th className="px-3 py-2.5 text-center font-bold text-teal-400">League Cups</th>
                              <th className="px-3 py-2.5 text-center font-bold text-sky-400">Idols League</th>
                              <th className="px-3 py-2.5 text-center font-bold text-fuchsia-400">Idols Playoff</th>
                              <th className="px-3 py-2.5 text-center">Matches</th>
                              <th className="px-3 py-2.5 text-center font-bold text-emerald-400">W-D-L</th>
                              <th className="px-3 py-2.5 text-center font-bold text-indigo-400">Win %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/40">
                            {group.members.map((mem) => (
                              <tr key={mem.id} className="hover:bg-[#20150e] transition-colors">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {mem.photoUrl ? (
                                      <img
                                        src={mem.photoUrl}
                                        alt={mem.name}
                                        className="h-6 w-6 rounded-md object-cover border border-black"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="h-6 w-6 rounded-md bg-black flex items-center justify-center text-[10px] font-bold text-amber-300 border border-black">
                                        {(mem.name || 'ID').slice(0, 1)}
                                      </div>
                                    )}
                                    <span className="font-bold text-white">{mem.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center font-black text-amber-400">
                                  {mem.championships}
                                </td>
                                <td className="px-3 py-2 text-center font-black text-teal-400">
                                  {mem.leagueCupTitles}
                                </td>
                                <td className="px-3 py-2 text-center font-black text-sky-400">
                                  {mem.theIdolsLeagueTitles}
                                </td>
                                <td className="px-3 py-2 text-center font-black text-fuchsia-400">
                                  {mem.theIdolsPlayoffTitles}
                                </td>
                                <td className="px-3 py-2 text-center text-slate-300 font-mono">{mem.matches}</td>
                                <td className="px-3 py-2 text-center font-bold text-emerald-400 font-mono">
                                  {mem.wins}-{mem.draws}-{mem.losses}
                                </td>
                                <td className="px-3 py-2 text-center font-extrabold text-indigo-400 font-mono">
                                  {mem.winRate}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

