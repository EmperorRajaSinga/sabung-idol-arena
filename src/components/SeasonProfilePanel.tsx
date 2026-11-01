import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TournamentArchive,
  ArchivedMatch,
  Idol,
  TournamentConfig,
  Group,
  KnockoutMatch,
  LeagueSeasonState,
  LeagueSeasonArchive,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from '../types';
import { TournamentBracketTree } from './TournamentBracketTree';
import { Trophy, Crown, Swords, Shield, Medal, Award, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Flame, Layers, Sparkles } from 'lucide-react';
import { DEFAULT_LEAGUE_DEFS } from '../utils/leagueLogic';
import { getAllSeasonArchives } from '../utils/tournamentLogic';
import type { V5State, V5TitleArchive } from '../utils/v5/store';

interface SeasonProfilePanelProps {
  archives: TournamentArchive[];
  matchDatabase?: ArchivedMatch[];
  idolsMap: Map<string, Idol>;
  currentGroups?: Group[];
  currentKnockoutMatches?: KnockoutMatch[];
  currentConfig?: TournamentConfig;
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  idols?: Idol[];
  v5State?: V5State | null;
  v5TitleArchives?: V5TitleArchive[];
}

export const SeasonProfilePanel: React.FC<SeasonProfilePanelProps> = ({
  archives,
  matchDatabase,
  idolsMap,
  currentGroups,
  currentKnockoutMatches,
  currentConfig,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  idols = [],
  v5State,
  v5TitleArchives = [],
}) => {
  const safeMatchDatabase = matchDatabase || [];

  const allArchives = useMemo(() => {
    const rawList = getAllSeasonArchives(
      archives,
      safeMatchDatabase,
      idolsMap,
      currentConfig,
      currentGroups,
      currentKnockoutMatches
    );

    const list: Array<{
      seasonId: number;
      seasonName: string;
      isCurrent: boolean;
      championId?: string;
      championName?: string;
      championPhoto?: string;
      runnerUpId?: string;
      runnerUpName?: string;
      runnerUpPhoto?: string;
      thirdPlaceId?: string;
      thirdPlaceName?: string;
      thirdPlacePhoto?: string;
      knockoutMatches?: KnockoutMatch[];
    }> = rawList.map((arch) => {
      const champ = arch.championId ? idolsMap.get(arch.championId) : undefined;
      const runner = arch.runnerUpId ? idolsMap.get(arch.runnerUpId) : undefined;
      const third = arch.thirdPlaceId ? idolsMap.get(arch.thirdPlaceId) : undefined;
      const isCurrent = currentConfig ? Number(arch.seasonId) === Number(currentConfig.seasonId || 1) : false;

      return {
        seasonId: arch.seasonId,
        seasonName: arch.seasonName || `Season ${arch.seasonId}`,
        isCurrent,
        championId: arch.championId,
        championName: arch.championName,
        championPhoto: champ?.photoUrl,
        runnerUpId: arch.runnerUpId,
        runnerUpName: arch.runnerUpName,
        runnerUpPhoto: runner?.photoUrl,
        thirdPlaceId: arch.thirdPlaceId,
        thirdPlaceName: arch.thirdPlaceName,
        thirdPlacePhoto: third?.photoUrl,
        knockoutMatches: arch.knockoutMatches,
      };
    });

    return list.sort((a, b) => a.seasonId - b.seasonId);
  }, [archives, safeMatchDatabase, currentConfig, currentGroups, currentKnockoutMatches, idolsMap]);

  const [activeTab, setActiveTab] = useState<'tournament' | 'league' | 'division_two' | 'new_competitions' | 'the_idols'>('tournament');
  const [activeV5Competition, setActiveV5Competition] = useState<'crown' | 'open' | 'spotlight' | 'super_a' | 'super_b'>('crown');

  const initialSeasonId =
    allArchives && allArchives.length > 0
      ? Number(allArchives[allArchives.length - 1]?.seasonId || 1)
      : 1;

  const [selectedSeasonId, setSelectedSeasonId] = useState<number>(initialSeasonId);
  const prevLenRef = useRef(allArchives?.length || 0);

  // Tournament Matches Pagination
  const [tournamentMatchPage, setTournamentMatchPage] = useState<number>(1);
  const tournamentMatchesPerPage = 20;

  // League Matches Pagination
  const [leagueMatchPage, setLeagueMatchPage] = useState<number>(1);
  const leagueMatchesPerPage = 20;

  // The Idols Matches Pagination
  const [theIdolsMatchPage, setTheIdolsMatchPage] = useState<number>(1);
  const theIdolsMatchesPerPage = 20;

  // League Season Selection
  const allLeagueSeasons = useMemo(() => {
    const archivedLeagueNums = new Set((leagueArchives || []).map((a) => a.seasonNumber));
    return [
      ...(leagueState && !archivedLeagueNums.has(leagueState.seasonNumber)
        ? [
            {
              seasonNumber: leagueState.seasonNumber,
              seasonName: leagueState.seasonName || `League Season ${leagueState.seasonNumber}`,
              isCurrent: true,
              isCompleted: Boolean(leagueState.isCompleted),
              leagues: leagueState.leagues,
            },
          ]
        : []),
      ...leagueArchives.map((arch) => ({
        seasonNumber: arch.seasonNumber,
        seasonName: arch.seasonName || `League Season ${arch.seasonNumber}`,
        isCurrent: false,
        isCompleted: true,
        leagues: DEFAULT_LEAGUE_DEFS.map((def) => {
          const customWinner = (arch.leagueWinners || []).find((w) => w.leagueId === def.id);
          const memberIds = (arch.allStandings?.[def.id] || []).map((s) => s.idolId);
          const matches = (arch.allMatches || []).filter((m) => m.leagueId === def.id);
          const standings = arch.allStandings?.[def.id] || [];
          return {
            id: def.id,
            name: customWinner?.leagueName || def.name,
            tierName: customWinner?.tierName || def.tierName,
            color: customWinner?.color || def.color,
            memberIds,
            matches,
            standings,
            isCompleted: true,
          };
        }),
      })),
    ];
  }, [leagueState, leagueArchives]);

  const [selectedLeagueSeasonNum, setSelectedLeagueSeasonNum] = useState<number>(
    leagueState?.seasonNumber || 1
  );
  const [selectedDivisionTab, setSelectedDivisionTab] = useState<number>(1);

  // The Idols Season Profiles
  const allTheIdolsSeasons = useMemo(() => {
    const archivedIdolsNums = new Set((theIdolsArchives || []).map((a) => a.seasonNumber));
    return [
      ...(theIdolsState && Array.isArray(theIdolsState.standings) && theIdolsState.standings.length > 0 && !archivedIdolsNums.has(theIdolsState.seasonNumber)
        ? [
            {
              seasonNumber: theIdolsState.seasonNumber,
              seasonName: theIdolsState.seasonName || `The Idols Season ${theIdolsState.seasonNumber}`,
              isCurrent: true,
              isCompleted: Boolean(theIdolsState.isCompleted),
              championId: theIdolsState.championId,
              championName: theIdolsState.championName,
              runnerUpId: theIdolsState.runnerUpId,
              runnerUpName: theIdolsState.runnerUpName,
              thirdPlaceId: theIdolsState.thirdPlaceId,
              thirdPlaceName: theIdolsState.thirdPlaceName,
              mvpId: theIdolsState.mvpId,
              mvpName: theIdolsState.mvpName,
              topScorerId: theIdolsState.topScorerId,
              topScorerName: theIdolsState.topScorerName,
              topScorerGoals: theIdolsState.topScorerGoals,
              standings: theIdolsState.standings || [],
              matches: theIdolsState.matches || [],
              playoffMatches: theIdolsState.playoffMatches || [],
            },
          ]
        : []),
      ...theIdolsArchives.map((arch) => ({
        seasonNumber: arch.seasonNumber,
        seasonName: arch.seasonName || `The Idols Season ${arch.seasonNumber}`,
        isCurrent: false,
        isCompleted: true,
        championId: arch.championId,
        championName: arch.championName,
        runnerUpId: arch.runnerUpId,
        runnerUpName: arch.runnerUpName,
        thirdPlaceId: arch.thirdPlaceId,
        thirdPlaceName: arch.thirdPlaceName,
        mvpId: arch.mvpId,
        mvpName: arch.mvpName,
        topScorerId: arch.topScorerId,
        topScorerName: arch.topScorerName,
        topScorerGoals: arch.topScorerGoals,
        standings: arch.standings || [],
        matches: arch.matches || [],
        playoffMatches: arch.playoffMatches || [],
      })),
    ];
  }, [theIdolsState, theIdolsArchives]);

  const [selectedTheIdolsSeasonNum, setSelectedTheIdolsSeasonNum] = useState<number>(
    theIdolsState?.seasonNumber || 1
  );

  // Auto-sync selected season when archives change or when a new season is added
  useEffect(() => {
    if (allArchives && allArchives.length > 0) {
      if (allArchives.length > prevLenRef.current) {
        setSelectedSeasonId(Number(allArchives[allArchives.length - 1]?.seasonId || 1));
        prevLenRef.current = allArchives.length;
      } else {
        const exists = allArchives.some((a) => Number(a?.seasonId) === Number(selectedSeasonId));
        if (!exists) {
          setSelectedSeasonId(Number(allArchives[allArchives.length - 1]?.seasonId || 1));
        }
      }
    }
  }, [allArchives, selectedSeasonId]);

  const archive = allArchives.find((a) => Number(a.seasonId) === Number(selectedSeasonId));
  const seasonMatches = useMemo(() => {
    return safeMatchDatabase.filter(
      (m) => Number(m.seasonId) === Number(selectedSeasonId)
    );
  }, [safeMatchDatabase, selectedSeasonId]);

  const selectedV5Matches = useMemo(() => safeMatchDatabase.filter((m) => Number(m.seasonId || 1) === Number(selectedLeagueSeasonNum) && String(m.stage || '').toLowerCase().startsWith('cups & divisions:')), [safeMatchDatabase, selectedLeagueSeasonNum]);
  const v5CompetitionData = useMemo(() => {
    const defs = [
      { key: 'crown', label: 'Crown Cup', test: (s: string) => s.includes('league champions cup'), title: (n: string) => n.toLowerCase() === 'league champions cup' },
      { key: 'open', label: 'Open Arena Cup', test: (s: string) => s.includes('all-league knockout cup'), title: (n: string) => n.toLowerCase() === 'all-league knockout cup' },
      { key: 'spotlight', label: 'Spotlight Cup', test: (s: string) => s.includes('top 16 mini cup'), title: (n: string) => n.toLowerCase().startsWith('top 16 mini cup') },
      { key: 'super_a', label: 'Super Cup A', test: (s: string) => s.includes('super cup a'), title: (n: string) => n.toLowerCase() === 'super cup a' },
      { key: 'super_b', label: 'Super Cup B', test: (s: string) => s.includes('super cup b'), title: (n: string) => n.toLowerCase().startsWith('super cup b') },
    ] as const;
    return defs.map((d) => {
      const matches = selectedV5Matches.filter((m) => d.test(String(m.stage || '').toLowerCase()));
      const done = matches;
      const titles = (v5TitleArchives || []).filter((t) => Number(t.seasonNumber) === Number(selectedLeagueSeasonNum) && !t.isDivision && d.title(String(t.competition || '')));
      const participants = new Set(matches.flatMap((m) => [m.idolAId, m.idolBId]).filter(Boolean));
      const wins = done.filter((m) => Boolean(m.winnerId) && !m.isDraw && m.scoreA !== m.scoreB).length;
      const draws = done.filter((m) => m.isDraw || m.scoreA === m.scoreB).length;
      return { ...d, matches, completed: done.length, pending: matches.length-done.length, participants: participants.size, wins, draws, losses: Math.max(0,done.length-wins-draws), titles, champion: titles.find((t)=>t.winnerId), runnerUp: titles.find((t)=>t.runnerUpId), goalsFor: done.reduce((n,m)=>n+Number(m.scoreA||0),0), goalsAgainst: done.reduce((n,m)=>n+Number(m.scoreB||0),0) };
    });
  }, [selectedV5Matches, v5TitleArchives, selectedLeagueSeasonNum]);
  const selectedD2Leagues = useMemo(() => (v5State?.d2 || []), [v5State]);
  const d2Stats = useMemo(() => selectedD2Leagues.reduce((a,l) => { a.leagues++; a.idols += l.memberIds?.length || 0; a.matches += l.matches?.length || 0; a.completed += (l.matches || []).filter(m=>m.completed).length; return a; }, {leagues:0,idols:0,matches:0,completed:0}), [selectedD2Leagues]);
  const selectedLeagueSeason =
    allLeagueSeasons.find((s) => s.seasonNumber === selectedLeagueSeasonNum) ||
    allLeagueSeasons[0];

  const activeLeagueDiv = selectedLeagueSeason?.leagues?.find(
    (l) => l.id === selectedDivisionTab
  );

  // Calculate league progress stats
  const leagueSeasonStats = useMemo(() => {
    if (!selectedLeagueSeason) return { totalMatches: 0, completedMatches: 0, percent: 0 };
    let total = 0;
    let completed = 0;
    (selectedLeagueSeason.leagues || []).forEach((l) => {
      (l.matches || []).forEach((m) => {
        total++;
        if (m.completed) completed++;
      });
    });
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { totalMatches: total, completedMatches: completed, percent };
  }, [selectedLeagueSeason]);

  // Tournament Matches Paginated
  const totalTournPages = Math.ceil(seasonMatches.length / tournamentMatchesPerPage) || 1;
  const paginatedTournamentMatches = useMemo(() => {
    const start = (tournamentMatchPage - 1) * tournamentMatchesPerPage;
    return seasonMatches.slice(start, start + tournamentMatchesPerPage);
  }, [seasonMatches, tournamentMatchPage]);

  // Active League Division Matches Paginated
  const divMatches = activeLeagueDiv?.matches || [];
  const totalDivPages = Math.ceil(divMatches.length / leagueMatchesPerPage) || 1;
  const paginatedLeagueMatches = useMemo(() => {
    const start = (leagueMatchPage - 1) * leagueMatchesPerPage;
    return divMatches.slice(start, start + leagueMatchesPerPage);
  }, [divMatches, leagueMatchPage]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Trophy className="h-7 w-7 text-amber-400" />
            <span>Season Profile Breakdown</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Historical breakdown, tournament brackets, and league division season standings.
          </p>
        </div>

        {/* System Tab Toggle */}
        <div className="flex items-center gap-2 bg-[#1b130e] p-1.5 rounded-2xl border-2 border-black poster-shadow-sm flex-wrap">
          <button
            onClick={() => setActiveTab('tournament')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'tournament'
                ? 'poster-pill-gold text-amber-950 scale-105'
                : 'text-amber-200 hover:text-white'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>Tournament Cup</span>
          </button>
          <button
            onClick={() => setActiveTab('league')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'league'
                ? 'poster-pill-gold text-amber-950 scale-105'
                : 'text-amber-200 hover:text-white'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>League Division System</span>
          </button>
          <button onClick={() => setActiveTab('division_two')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black ${activeTab==='division_two'?'poster-pill-gold text-amber-950':'text-amber-200 hover:text-white'}`}><Shield className="h-4 w-4"/><span>Division 2</span></button>
          <button onClick={() => setActiveTab('new_competitions')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black ${activeTab==='new_competitions'?'poster-pill-gold text-amber-950':'text-amber-200 hover:text-white'}`}><Trophy className="h-4 w-4"/><span>New Competitions</span></button>
          <button
            onClick={() => setActiveTab('the_idols')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'the_idols'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white scale-105 shadow border border-purple-400/40'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            <Crown className="h-4 w-4 text-yellow-400" />
            <span>The Idols Profile</span>
          </button>
        </div>
      </div>

      {/* 1. TOURNAMENT CUP SEASONS TAB */}
      {activeTab === 'tournament' && (
        <div className="space-y-6">
          {/* Season Selector */}
          <div className="flex items-center justify-between bg-[#1e1510] p-4 rounded-2xl border-2 border-black poster-shadow-sm">
            <span className="text-xs font-poster-title text-amber-300">Select Tournament Season:</span>
            {allArchives.length > 0 && (
              <select
                value={selectedSeasonId}
                onChange={(e) => {
                  setSelectedSeasonId(Number(e.target.value));
                  setTournamentMatchPage(1);
                }}
                className="rounded-xl border-2 border-black bg-[#120d09] px-4 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {allArchives.map((a) => (
                  <option key={`opt-${a.seasonId}`} value={a.seasonId}>
                    {a.seasonName || `Season ${a.seasonId}`}{' '}
                    {a.isCurrent ? (a.championName ? '(Current Season - Completed)' : '(Current Season - In Progress)') : '(Archived Season)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {archive ? (
            <div className="space-y-6">
              {/* Podium: 1st, 2nd, 3rd */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gold / Champion */}
                <div className="rounded-2xl border-2 border-black p-4 bg-[#1e1510] text-center space-y-2 poster-shadow-sm border-t-4 border-t-amber-400">
                  <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-poster-title">
                    <Crown className="h-4 w-4" />
                    <span>Tournament Champion</span>
                  </div>
                  {archive.championPhoto ? (
                    <img
                      src={archive.championPhoto}
                      alt={archive.championName}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-black mx-auto shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-black border-2 border-black mx-auto flex items-center justify-center font-bold text-amber-400">
                      ?
                    </div>
                  )}
                  <h3 className="text-lg font-poster-title text-white mt-1">
                    {archive.championName || 'In Progress (Undecided)'}
                  </h3>
                </div>

                {/* Silver / Runner-up */}
                <div className="rounded-2xl border-2 border-black p-4 bg-[#1e1510] text-center space-y-2 poster-shadow-sm border-t-4 border-t-slate-300">
                  <div className="flex items-center justify-center gap-1 text-slate-300 text-xs font-poster-title">
                    <Medal className="h-4 w-4" />
                    <span>Runner-up (Silver)</span>
                  </div>
                  {archive.runnerUpPhoto ? (
                    <img
                      src={archive.runnerUpPhoto}
                      alt={archive.runnerUpName}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-black mx-auto shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-black border-2 border-black mx-auto flex items-center justify-center font-bold text-slate-400">
                      ?
                    </div>
                  )}
                  <h3 className="text-lg font-poster-title text-white mt-1">
                    {archive.runnerUpName || 'In Progress (Undecided)'}
                  </h3>
                </div>

                {/* Bronze / 3rd Place */}
                <div className="rounded-2xl border-2 border-black p-4 bg-[#1e1510] text-center space-y-2 poster-shadow-sm border-t-4 border-t-amber-700">
                  <div className="flex items-center justify-center gap-1 text-amber-600 text-xs font-poster-title">
                    <Award className="h-4 w-4" />
                    <span>3rd Place (Bronze)</span>
                  </div>
                  {archive.thirdPlacePhoto ? (
                    <img
                      src={archive.thirdPlacePhoto}
                      alt={archive.thirdPlaceName}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-black mx-auto shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-black border-2 border-black mx-auto flex items-center justify-center font-bold text-amber-700">
                      ?
                    </div>
                  )}
                  <h3 className="text-lg font-poster-title text-white mt-1">
                    {archive.thirdPlaceName || 'In Progress (Undecided)'}
                  </h3>
                </div>
              </div>

              {/* Knockout Bracket Tree */}
              {archive.knockoutMatches && archive.knockoutMatches.length > 0 && (
                <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-5 space-y-4 poster-shadow-md">
                  <h3 className="font-poster-title text-base text-red-500 border-b border-black pb-2 flex items-center gap-2">
                    <Swords className="h-4 w-4 text-amber-400" />
                    <span>Knockout Stage Bracket</span>
                  </h3>
                  <TournamentBracketTree
                    knockoutMatches={archive.knockoutMatches}
                    idolsMap={idolsMap}
                    showTitleHeader={false}
                  />
                </div>
              )}

              {/* Season Matches List with Pagination */}
              <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-5 space-y-4 poster-shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black pb-2">
                  <h3 className="font-poster-title text-base text-red-500">
                    Match Results in {archive?.seasonName || `Season ${archive?.seasonId || 1}`} ({seasonMatches.length} matches)
                  </h3>
                  <span className="text-xs text-amber-300 font-bold">
                    Page {tournamentMatchPage} of {totalTournPages}
                  </span>
                </div>

                {paginatedTournamentMatches.length > 0 ? (
                  <div className="space-y-2">
                    {paginatedTournamentMatches.map((m, idx) => {
                      const isDraw = m.isDraw || m.scoreA === m.scoreB || m.winnerId === 'DRAW';

                      return (
                        <div
                          key={m.matchId ? `spm-${m.matchId}-${idx}` : `spm-${idx}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-black bg-[#140e0a] text-xs poster-shadow-sm hover:border-amber-400/40 transition-colors"
                        >
                          <span className="rounded-md bg-[#251a13] px-2 py-0.5 text-[10px] font-black text-amber-400 border border-black">
                            {m.stage}
                          </span>

                          <div className="flex items-center gap-3 font-bold">
                            <span
                              className={
                                !isDraw && m.winnerId === m.idolAId
                                  ? 'text-amber-300 font-black'
                                  : isDraw
                                  ? 'text-amber-100'
                                  : 'text-amber-200/60'
                              }
                            >
                              {m.idolAName}
                            </span>
                            <span className="rounded-md bg-black px-2.5 py-1 font-mono text-xs text-amber-300 border border-black flex items-center gap-1.5">
                              {m.scoreA} - {m.scoreB}
                              {isDraw && (
                                <span className="text-[8px] uppercase font-black text-amber-400 bg-amber-500/15 px-1 py-0.2 rounded border border-amber-500/20">
                                  DRAW
                                </span>
                              )}
                            </span>
                            <span
                              className={
                                !isDraw && m.winnerId === m.idolBId
                                  ? 'text-amber-300 font-black'
                                  : isDraw
                                  ? 'text-amber-100'
                                  : 'text-amber-200/60'
                              }
                            >
                              {m.idolBName}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-amber-200/50 italic">
                    No match results recorded for this tournament season yet.
                  </div>
                )}

                {/* Tournament Match Pagination Navigation */}
                {totalTournPages > 1 && (
                  <div className="flex items-center justify-between border-t border-black/60 pt-3 text-xs">
                    <button
                      onClick={() => setTournamentMatchPage((p) => Math.max(1, p - 1))}
                      disabled={tournamentMatchPage <= 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black bg-[#251a13] text-amber-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous Matches</span>
                    </button>
                    <span className="text-amber-400/80 font-bold">
                      Page {tournamentMatchPage} of {totalTournPages}
                    </span>
                    <button
                      onClick={() => setTournamentMatchPage((p) => Math.min(totalTournPages, p + 1))}
                      disabled={tournamentMatchPage >= totalTournPages}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-black bg-[#251a13] text-amber-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
                    >
                      <span>Next Matches</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-8 text-center text-amber-200/70 font-bold text-xs">
              No tournament profile found.
            </div>
          )}
        </div>
      )}

      {/* 2. LEAGUE DIVISION SEASONS TAB */}
      {activeTab === 'league' && (
        <div className="space-y-6">
          {/* Season Selector with Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1e1510] p-4 rounded-2xl border-2 border-black poster-shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-poster-title text-amber-300">Select League Season:</span>
              {selectedLeagueSeason && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedLeagueSeason.isCurrent && !selectedLeagueSeason.isCompleted
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {selectedLeagueSeason.isCurrent && !selectedLeagueSeason.isCompleted
                    ? 'In Progress (Active)'
                    : 'Completed / Archived'}
                </span>
              )}
            </div>

            {allLeagueSeasons.length > 0 && (
              <select
                value={selectedLeagueSeasonNum}
                onChange={(e) => {
                  setSelectedLeagueSeasonNum(Number(e.target.value));
                  setLeagueMatchPage(1);
                }}
                className="rounded-xl border-2 border-black bg-[#120d09] px-4 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {allLeagueSeasons.map((s, idx) => (
                  <option key={`ls-opt-${s.seasonNumber}-${idx}`} value={s.seasonNumber}>
                    {s.seasonName} {s.isCurrent ? (s.isCompleted ? '(Current - Completed)' : '(Current - In Progress)') : '(Archived)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedLeagueSeason ? (
            <div className="space-y-6">
              {/* Progress Bar for Active League Season */}
              {selectedLeagueSeason.isCurrent && !selectedLeagueSeason.isCompleted && (
                <div className="bg-[#1b130e] p-4 rounded-2xl border-2 border-black space-y-2 poster-shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-amber-300 font-poster-title">
                      Active League Season Progress: {leagueSeasonStats.completedMatches} / {leagueSeasonStats.totalMatches} Matches Completed
                    </span>
                    <span className="text-emerald-400 font-mono font-black">{leagueSeasonStats.percent}%</span>
                  </div>
                  <div className="w-full bg-[#120d09] rounded-full h-3 border border-black overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${leagueSeasonStats.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 6 Division Champions / Current Leaders Row */}
              <div className="space-y-3">
                <h3 className="font-poster-title text-base text-red-500 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span>
                      {selectedLeagueSeason.isCurrent && !selectedLeagueSeason.isCompleted
                        ? `Current Division Leaders (${selectedLeagueSeason.seasonName} - In Progress)`
                        : `Division Champions (${selectedLeagueSeason.seasonName})`}
                    </span>
                  </div>
                  {selectedLeagueSeason.isCurrent && !selectedLeagueSeason.isCompleted && (
                    <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-600/40">
                      In Progress
                    </span>
                  )}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(selectedLeagueSeason.leagues || []).map((l) => {
                    const champ = l.standings?.[0];
                    const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === l.id);
                    const isDivCompleted = l.matches?.length > 0 && l.matches.every((m) => m.completed);

                    return (
                      <div
                        key={`champ-div-${l.id}`}
                        className="rounded-2xl border-2 border-black p-3 bg-[#1b130e] text-center space-y-2 poster-shadow-sm"
                        style={{ borderTop: `4px solid ${def?.color || '#f59e0b'}` }}
                      >
                        <div className="text-[10px] font-black uppercase text-amber-400 truncate">
                          {l.name}
                        </div>
                        {champ ? (
                          <div className="space-y-1">
                            {champ.photoUrl ? (
                              <img
                                src={champ.photoUrl}
                                alt={champ.idolName}
                                className="w-12 h-12 rounded-xl object-cover border-2 border-black mx-auto shadow"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-black border-2 border-black mx-auto flex items-center justify-center font-poster-title text-sm text-amber-300 shadow">
                                {champ.idolName.slice(0, 1)}
                              </div>
                            )}
                            <div className="font-poster-title text-xs text-white font-bold truncate">
                              {champ.idolName}
                            </div>
                            <div className="text-[9px] text-amber-400 font-bold">
                              {champ.points} PTS ({champ.wins}W-{champ.draws}D-{champ.losses}L)
                            </div>
                            <div className="mt-1">
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                  isDivCompleted || selectedLeagueSeason.isCompleted
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {isDivCompleted || selectedLeagueSeason.isCompleted
                                  ? 'Champion'
                                  : 'Current #1 Leader'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-xs font-bold text-amber-200/40">
                            TBD
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Division Tabs for Standings Tables */}
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-5 space-y-4 poster-shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
                  <div className="flex flex-wrap items-center gap-1">
                    {(selectedLeagueSeason.leagues || DEFAULT_LEAGUE_DEFS).map((leg) => {
                      const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === leg.id);
                      const divName = leg.name || def?.name || `Division ${leg.id}`;
                      return (
                        <button
                          key={leg.id}
                          onClick={() => {
                            setSelectedDivisionTab(leg.id);
                            setLeagueMatchPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                            selectedDivisionTab === leg.id
                              ? 'poster-pill-gold text-amber-950 scale-105'
                              : 'bg-[#251a13] text-amber-200/70 hover:text-white'
                          }`}
                        >
                          Div {leg.id}: {divName}
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-[11px] font-bold text-emerald-400">
                    Top 5 advance to Champions Tournament Knockout
                  </span>
                </div>

                {activeLeagueDiv && (
                  <div className="space-y-6">
                    {/* Standings Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-poster-body">
                        <thead className="bg-[#120d09] text-[10px] font-black uppercase text-amber-300 border-b-2 border-black">
                          <tr>
                            <th className="px-3 py-2 text-center">Pos</th>
                            <th className="px-3 py-2">Idol</th>
                            <th className="px-3 py-2">Group</th>
                            <th className="px-2 py-2 text-center">P</th>
                            <th className="px-2 py-2 text-center">W</th>
                            <th className="px-2 py-2 text-center">D</th>
                            <th className="px-2 py-2 text-center">L</th>
                            <th className="px-2 py-2 text-center">GF</th>
                            <th className="px-2 py-2 text-center">GA</th>
                            <th className="px-2 py-2 text-center">GD</th>
                            <th className="px-3 py-2 text-center font-black text-amber-400">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/40 font-medium">
                          {(activeLeagueDiv.standings || []).map((st) => (
                            <tr
                              key={st.idolId}
                              className={
                                st.rank <= 5
                                  ? 'bg-emerald-950/20 text-white font-bold'
                                  : 'text-amber-200/80 hover:bg-[#251a13]'
                              }
                            >
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${
                                    st.rank <= 5
                                      ? 'bg-emerald-500 text-black'
                                      : 'bg-black text-amber-300'
                                  }`}
                                >
                                  {st.rank}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {st.photoUrl ? (
                                    <img
                                      src={st.photoUrl}
                                      alt={st.idolName}
                                      className="w-6 h-6 rounded-md object-cover border border-black"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-md bg-black border border-black flex items-center justify-center text-[10px] font-bold text-amber-300">
                                      {st.idolName.slice(0, 1)}
                                    </div>
                                  )}
                                  <span className="font-bold truncate">{st.idolName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-amber-400/80 text-[11px] font-bold truncate">
                                {st.girlGroup}
                              </td>
                              <td className="px-2 py-2 text-center font-mono">{st.played}</td>
                              <td className="px-2 py-2 text-center font-mono text-emerald-400 font-bold">
                                {st.wins}
                              </td>
                              <td className="px-2 py-2 text-center font-mono text-amber-400 font-bold">
                                {st.draws}
                              </td>
                              <td className="px-2 py-2 text-center font-mono text-red-400">
                                {st.losses}
                              </td>
                              <td className="px-2 py-2 text-center font-mono">{st.gamesFor}</td>
                              <td className="px-2 py-2 text-center font-mono">{st.gamesAgainst}</td>
                              <td className="px-2 py-2 text-center font-mono font-bold">
                                {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                              </td>
                              <td className="px-3 py-2 text-center font-mono font-black text-amber-300 text-sm">
                                {st.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Division Matches Results with Pagination */}
                    {divMatches.length > 0 && (
                      <div className="border-t-2 border-black pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-poster-title text-amber-300">
                            {activeLeagueDiv.name} Fixtures &amp; Results ({divMatches.length} Matches)
                          </h4>
                          <span className="text-xs text-amber-400/80 font-bold">
                            Page {leagueMatchPage} of {totalDivPages}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {paginatedLeagueMatches.map((m, idx) => {
                            const idolA = idolsMap.get(m.idolAId);
                            const idolB = idolsMap.get(m.idolBId);
                            const isWinA = m.completed && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                            const isWinB = m.completed && (m.scoreB ?? 0) > (m.scoreA ?? 0);
                            const isDraw = m.completed && m.scoreA === m.scoreB;

                            return (
                              <div
                                key={m.id || `div-m-${idx}`}
                                className="flex items-center justify-between p-2 rounded-lg bg-[#140e0a] border border-black text-xs font-bold"
                              >
                                <span className="rounded bg-[#251a13] px-2 py-0.5 text-[9px] font-black text-amber-400">
                                  Matchday {m.matchday}
                                </span>

                                <div className="flex items-center gap-3">
                                  <span className={isWinA ? 'text-amber-300 font-black' : 'text-slate-300'}>
                                    {idolA?.name || 'Player A'}
                                  </span>
                                  {m.completed && m.scoreA !== null && m.scoreB !== null ? (
                                    <span className="rounded bg-black px-2 py-0.5 font-mono text-xs text-amber-300 border border-black">
                                      {m.scoreA} - {m.scoreB}
                                    </span>
                                  ) : (
                                    <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] text-slate-500">
                                      VS
                                    </span>
                                  )}
                                  <span className={isWinB ? 'text-amber-300 font-black' : 'text-slate-300'}>
                                    {idolB?.name || 'Player B'}
                                  </span>
                                </div>

                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                    m.completed
                                      ? isDraw
                                        ? 'bg-amber-950 text-amber-300'
                                        : 'bg-emerald-950 text-emerald-300'
                                      : 'bg-slate-950 text-slate-500'
                                  }`}
                                >
                                  {m.completed ? (isDraw ? 'Draw' : 'Finished') : 'Pending'}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Division Match Pagination Navigation */}
                        {totalDivPages > 1 && (
                          <div className="flex items-center justify-between border-t border-black/40 pt-2 text-xs">
                            <button
                              onClick={() => setLeagueMatchPage((p) => Math.max(1, p - 1))}
                              disabled={leagueMatchPage <= 1}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg border border-black bg-[#251a13] text-amber-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              <span>Prev</span>
                            </button>
                            <span className="text-amber-400 font-bold">
                              Page {leagueMatchPage} of {totalDivPages}
                            </span>
                            <button
                              onClick={() => setLeagueMatchPage((p) => Math.min(totalDivPages, p + 1))}
                              disabled={leagueMatchPage >= totalDivPages}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg border border-black bg-[#251a13] text-amber-200 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
                            >
                              <span>Next</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-8 text-center text-amber-200/70 font-bold text-xs">
              No league season profiles recorded.
            </div>
          )}
        </div>
      )}

      {activeTab === 'division_two' && <div className="space-y-5">
        <div className="rounded-2xl border-2 border-black bg-[#1e1510] p-4"><h3 className="font-poster-title text-amber-300">Division 2 Season Profile</h3><p className="mt-1 text-xs text-amber-100/60">Second tier standings and match history. Division 1 remains unchanged in its existing section.</p><select className="mt-3 rounded-lg border border-black bg-[#120d09] p-2 text-xs text-amber-200" value={selectedLeagueSeasonNum} onChange={e=>setSelectedLeagueSeasonNum(Number(e.target.value))}>{allLeagueSeasons.map(x=><option key={x.seasonNumber} value={x.seasonNumber}>{x.seasonName}</option>)}</select></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['Leagues',d2Stats.leagues],['Idols',d2Stats.idols],['Completed Matches',d2Stats.completed],['Total Fixtures',d2Stats.matches]].map(([k,v])=><div key={String(k)} className="rounded-xl border-2 border-black bg-[#1b130e] p-4 text-center"><div className="text-[10px] font-black uppercase text-amber-300/70">{k}</div><div className="mt-1 text-2xl font-black text-amber-300">{v}</div></div>)}</div>
        {selectedD2Leagues.length ? selectedD2Leagues.map(l=><section key={l.id} className="space-y-4 rounded-2xl border-2 border-black bg-[#1b130e] p-5"><div className="flex justify-between border-b border-black pb-3"><div><h4 className="font-poster-title text-amber-300">{l.name}</h4><p className="text-[10px] text-amber-100/50">Division 2 · Parent Division {l.parentLeagueId}</p></div><span className="text-xs text-amber-300">{(l.matches||[]).filter(m=>m.completed).length}/{l.matches?.length||0} Played</span></div>
          <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="text-[10px] uppercase text-amber-300 bg-black/30"><tr>{['Pos','Idol','P','W','D','L','GF','GA','GD','PTS'].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{[...(l.standings||[])].sort((a,b)=>a.rank-b.rank).map((st,i)=><tr key={st.idolId} className="border-t border-black/50 text-amber-100/80"><td className="p-2">{st.rank||i+1}</td><td className="p-2"><div className="flex items-center gap-2">{st.photoUrl&&<img src={st.photoUrl} alt="" className="w-7 h-7 rounded object-cover"/>}<span>{st.idolName}</span></div><span className="text-[9px] text-amber-100/50">{st.girlGroup}</span></td>{[st.played,st.wins,st.draws,st.losses,st.gamesFor,st.gamesAgainst,st.gameDiff,st.points].map((v,i)=><td key={i} className="p-2">{v}</td>)}</tr>)}</tbody></table></div>
          <div><h5 className="mb-2 text-xs font-black uppercase text-amber-300">Division 2 Fixtures &amp; Results</h5><div className="space-y-1">{(l.matches||[]).map(m=><div key={m.id} className="flex justify-between gap-2 rounded-lg border border-black bg-black/20 p-2 text-xs"><span className="text-amber-200/50">MD {m.matchday}</span><span className="font-bold text-white">{idolsMap.get(m.idolAId)?.name||'TBD'} <b className="px-2 text-amber-300">{`${m.scoreA} - ${m.scoreB}`}</b> {idolsMap.get(m.idolBId)?.name||'TBD'}</span><span className="text-emerald-300">Final</span></div>)}</div></div>
        </section>) : <div className="rounded-xl border-2 border-black bg-[#1b130e] p-8 text-center text-xs text-amber-200/60">No Division 2 data available.</div>}
      </div>}
      {activeTab === 'new_competitions' && <div className="space-y-5">
        <div className="rounded-2xl border-2 border-black bg-[#1e1510] p-4"><h3 className="font-poster-title text-amber-300">Competition Season Profiles</h3><p className="mt-1 text-xs text-amber-100/60">Each cup has a dedicated report and its own archived match records.</p><select className="mt-3 rounded-lg border border-black bg-[#120d09] p-2 text-xs text-amber-200" value={selectedLeagueSeasonNum} onChange={e=>setSelectedLeagueSeasonNum(Number(e.target.value))}>{allLeagueSeasons.map(x=><option key={x.seasonNumber} value={x.seasonNumber}>{x.seasonName}</option>)}</select></div>
        <div className="flex flex-wrap gap-2">{v5CompetitionData.map(c=><button key={c.key} onClick={()=>setActiveV5Competition(c.key as any)} className={`rounded-xl border-2 border-black px-3 py-2 text-xs font-black ${activeV5Competition===c.key?'bg-amber-400 text-black':'bg-[#251a13] text-amber-200'}`}>{c.label} ({c.matches.length})</button>)}</div>
        {v5CompetitionData.filter(c=>c.key===activeV5Competition).map(c=><section key={c.key} className="space-y-4 rounded-2xl border-2 border-black bg-[#1b130e] p-5">
          <div className="flex items-center justify-between border-b border-black pb-3"><h3 className="font-poster-title text-lg text-amber-300">{c.label}</h3><span className="text-[10px] font-black text-amber-300">{c.matches.length&&c.completed===c.matches.length?'COMPLETED':c.matches.length?'IN PROGRESS':'NO DATA'}</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{[['Participants',c.participants],['Matches',c.matches.length],['Completed',c.completed],['Pending',c.pending],['Wins',c.wins],['Draws',c.draws],['Losses',c.losses],['Championships',c.titles.filter(t=>t.winnerId).length],['Runner-Up',c.titles.filter(t=>t.runnerUpId).length],['Points For',c.goalsFor],['Points Against',c.goalsAgainst]].map(([k,v])=><div key={String(k)} className="rounded-xl border border-black bg-[#24180f] p-3 text-center"><div className="text-[9px] uppercase font-black text-amber-200/60">{k}</div><div className="mt-1 text-xl font-black text-amber-300">{v}</div></div>)}</div>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-black bg-black/20 p-3"><div className="text-[10px] uppercase text-amber-200/50">Champion</div><div className="mt-1 font-bold text-amber-300">{c.champion?.winnerName||'Not decided'}</div></div><div className="rounded-xl border border-black bg-black/20 p-3"><div className="text-[10px] uppercase text-amber-200/50">Runner-Up</div><div className="mt-1 font-bold text-amber-300">{c.champion?.runnerUpName||c.runnerUp?.runnerUpName||'Not decided'}</div></div></div>
          <div><h4 className="mb-2 text-xs font-black uppercase text-amber-300">Match History · {c.matches.length}</h4>{c.matches.length?<div className="space-y-1">{c.matches.map(m=><div key={m.matchId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black bg-black/20 p-2 text-xs"><span className="text-amber-200/50">{String(m.stage||'').split('/').slice(1).join('/')}</span><b className="text-white">{m.idolAName||idolsMap.get(m.idolAId)?.name||'TBD'} <span className="px-2 text-amber-300">{m.completed?`${m.scoreA} - ${m.scoreB}`:'VS'}</span> {m.idolBName||idolsMap.get(m.idolBId)?.name||'TBD'}</b><span className={m.completed?'text-emerald-300':'text-slate-400'}>{m.completed?'Final':'Pending'}</span></div>)}</div>:<p className="text-xs text-amber-100/50 italic">No {c.label} match data archived for this season.</p>}</div>
        </section>)}
      </div>}
      {/* 3. THE IDOLS SEASON PROFILE TAB */}
      {activeTab === 'the_idols' && (
        <div className="space-y-6">
          {allTheIdolsSeasons.length > 0 ? (
            <div className="space-y-6">
              {/* Season Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1c0e25] p-4 rounded-2xl border-2 border-black poster-shadow-sm">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-poster-title text-purple-300">Select The Idols Season Profile:</span>
                </div>
                <select
                  value={selectedTheIdolsSeasonNum}
                  onChange={(e) => {
                    setSelectedTheIdolsSeasonNum(Number(e.target.value));
                    setTheIdolsMatchPage(1);
                  }}
                  className="rounded-xl border-2 border-black bg-[#0f0514] px-4 py-2 text-xs font-bold text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {allTheIdolsSeasons.map((s) => (
                    <option key={`tis-opt-${s.seasonNumber}`} value={s.seasonNumber}>
                      {s.seasonName} {s.isCurrent ? '(Active)' : '(Archived)'}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const curSeason = allTheIdolsSeasons.find((s) => s.seasonNumber === selectedTheIdolsSeasonNum) || allTheIdolsSeasons[0];
                if (!curSeason) return null;

                const champ = curSeason.championId ? idolsMap.get(curSeason.championId) : undefined;
                const runner = curSeason.runnerUpId ? idolsMap.get(curSeason.runnerUpId) : undefined;
                const third = curSeason.thirdPlaceId ? idolsMap.get(curSeason.thirdPlaceId) : undefined;
                const topScorer = curSeason.topScorerId ? idolsMap.get(curSeason.topScorerId) : undefined;

                const allMatches = curSeason.matches || [];
                const completedCount = allMatches.filter((m) => m.completed).length;
                const totalMatchesCount = allMatches.length;
                const matchProgressPct = totalMatchesCount > 0 ? Math.round((completedCount / totalMatchesCount) * 100) : 0;

                const paginatedMatches = allMatches.slice(
                  (theIdolsMatchPage - 1) * theIdolsMatchesPerPage,
                  theIdolsMatchPage * theIdolsMatchesPerPage
                );
                const totalTheIdolsPages = Math.ceil(allMatches.length / theIdolsMatchesPerPage) || 1;

                return (
                  <div className="space-y-6">
                    {/* Season Banner & Honors */}
                    <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#220d33] via-[#2d1142] to-[#160822] p-5 poster-shadow-lg border-l-8 border-l-purple-500 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/30 pb-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>The Idols &bull; Elite Superleague</span>
                          </div>
                          <h3 className="text-2xl font-poster-title text-white font-bold mt-0.5">
                            {curSeason.seasonName}
                          </h3>
                        </div>

                        {/* Progress Meter */}
                        <div className="flex items-center gap-3 bg-black/50 px-4 py-2 rounded-2xl border border-black">
                          <div className="text-right">
                            <div className="text-[9px] uppercase font-bold text-purple-300">Season Progress</div>
                            <div className="font-mono text-xs font-black text-amber-300">
                              {completedCount} / {totalMatchesCount} matches ({matchProgressPct}%)
                            </div>
                          </div>
                          <div className="w-16 h-2 rounded-full bg-purple-950 overflow-hidden border border-black">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-amber-400"
                              style={{ width: `${matchProgressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Honors Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Playoff Champion */}
                        <div className="rounded-2xl border-2 border-amber-400 bg-black/60 p-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-500 text-black font-black flex items-center justify-center text-xs shrink-0 border border-black shadow">
                            <Crown className="w-6 h-6" />
                          </div>
                          <div className="truncate">
                            <div className="text-[9px] uppercase font-black text-amber-400">Playoff Champion</div>
                            <div className="font-poster-title text-sm text-white truncate font-bold">
                              {curSeason.championName || champ?.name || 'TBD'}
                            </div>
                            <div className="text-[10px] text-purple-300/80 truncate">
                              {champ?.girlGroup || ''}
                            </div>
                          </div>
                        </div>

                        {/* Runner-Up */}
                        <div className="rounded-2xl border-2 border-slate-400/50 bg-black/60 p-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-300 text-black font-black flex items-center justify-center text-xs shrink-0 border border-black">
                            2nd
                          </div>
                          <div className="truncate">
                            <div className="text-[9px] uppercase font-black text-slate-300">Runner-Up</div>
                            <div className="font-poster-title text-sm text-white truncate font-bold">
                              {curSeason.runnerUpName || runner?.name || 'TBD'}
                            </div>
                            <div className="text-[10px] text-purple-300/80 truncate">
                              {runner?.girlGroup || ''}
                            </div>
                          </div>
                        </div>

                        {/* 3rd Place */}
                        <div className="rounded-2xl border-2 border-amber-700/50 bg-black/60 p-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-amber-700 text-white font-black flex items-center justify-center text-xs shrink-0 border border-black">
                            3rd
                          </div>
                          <div className="truncate">
                            <div className="text-[9px] uppercase font-black text-amber-500">3rd Place</div>
                            <div className="font-poster-title text-sm text-white truncate font-bold">
                              {curSeason.thirdPlaceName || third?.name || 'TBD'}
                            </div>
                            <div className="text-[10px] text-purple-300/80 truncate">
                              {third?.girlGroup || ''}
                            </div>
                          </div>
                        </div>

                        {/* Golden Striker */}
                        <div className="rounded-2xl border-2 border-rose-500/50 bg-black/60 p-3 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-rose-600 text-white font-black flex items-center justify-center text-xs shrink-0 border border-black">
                            <Flame className="w-6 h-6" />
                          </div>
                          <div className="truncate">
                            <div className="text-[9px] uppercase font-black text-rose-400">Golden Striker</div>
                            <div className="font-poster-title text-sm text-white truncate font-bold">
                              {curSeason.topScorerName || topScorer?.name || 'TBD'}
                            </div>
                            <div className="text-[10px] text-rose-300 font-bold">
                              {curSeason.topScorerGoals ? `${curSeason.topScorerGoals} Goals` : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Standings Table */}
                    <div className="rounded-3xl border-3 border-black bg-[#160822] p-5 space-y-4 poster-shadow-lg">
                      <div className="flex items-center justify-between border-b-2 border-black pb-3">
                        <h4 className="font-poster-title text-base text-purple-200 font-bold flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-400" />
                          <span>Regular Season Superleague Standings</span>
                        </h4>
                        <span className="text-xs text-purple-300 font-bold bg-purple-950 px-3 py-1 rounded-full border border-purple-500/40">
                          Top 8 Advance to Masters Playoff
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-poster-body">
                          <thead className="bg-[#0f0417] text-[10px] font-black uppercase text-purple-300 border-b-2 border-black">
                            <tr>
                              <th className="px-3 py-2 text-center">Pos</th>
                              <th className="px-3 py-2">Idol</th>
                              <th className="px-3 py-2">Group</th>
                              <th className="px-2 py-2 text-center font-mono">RTG</th>
                              <th className="px-2 py-2 text-center font-mono">P</th>
                              <th className="px-2 py-2 text-center font-mono text-emerald-400">W</th>
                              <th className="px-2 py-2 text-center font-mono text-amber-400">D</th>
                              <th className="px-2 py-2 text-center font-mono text-rose-400">L</th>
                              <th className="px-2 py-2 text-center font-mono">GF</th>
                              <th className="px-2 py-2 text-center font-mono">GA</th>
                              <th className="px-2 py-2 text-center font-mono">GD</th>
                              <th className="px-3 py-2 text-center font-mono font-black text-amber-300">PTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/40 font-medium">
                            {(curSeason.standings || []).map((st, idx) => (
                              <tr
                                key={st.idolId}
                                className={
                                  idx < 2
                                    ? 'bg-purple-950/40 text-purple-100 font-bold'
                                    : idx < 6
                                    ? 'bg-indigo-950/30 text-indigo-100 font-semibold'
                                    : idx < 10
                                    ? 'bg-sky-950/20 text-sky-100'
                                    : 'text-purple-200/70 hover:bg-[#251034]'
                                }
                              >
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black ${
                                      idx === 0
                                        ? 'bg-amber-400 text-black'
                                        : idx === 1
                                        ? 'bg-slate-300 text-black'
                                        : idx === 2
                                        ? 'bg-amber-700 text-white'
                                        : 'bg-black text-purple-300'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    {st.photoUrl ? (
                                      <img
                                        src={st.photoUrl}
                                        alt={st.idolName}
                                        className="w-6 h-6 rounded-md object-cover border border-black shrink-0"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-md bg-black border border-black flex items-center justify-center text-[10px] font-bold text-purple-300 shrink-0">
                                        {st.idolName.slice(0, 1)}
                                      </div>
                                    )}
                                    <span className="font-bold truncate">{st.idolName}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-purple-300/80 text-[11px] font-bold truncate">
                                  {st.girlGroup}
                                </td>
                                <td className="px-2 py-2 text-center font-mono font-bold text-amber-300">
                                  {st.rating || '-'}
                                </td>
                                <td className="px-2 py-2 text-center font-mono">{st.played}</td>
                                <td className="px-2 py-2 text-center font-mono text-emerald-400 font-bold">
                                  {st.wins}
                                </td>
                                <td className="px-2 py-2 text-center font-mono text-amber-400 font-bold">
                                  {st.draws}
                                </td>
                                <td className="px-2 py-2 text-center font-mono text-rose-400">
                                  {st.losses}
                                </td>
                                <td className="px-2 py-2 text-center font-mono">{st.gamesFor}</td>
                                <td className="px-2 py-2 text-center font-mono">{st.gamesAgainst}</td>
                                <td className="px-2 py-2 text-center font-mono font-bold">
                                  {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                                </td>
                                <td className="px-3 py-2 text-center font-mono font-black text-amber-300 text-sm">
                                  {st.points}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Masters Playoff Matches View */}
                    {curSeason.playoffMatches && curSeason.playoffMatches.length > 0 && (
                      <div className="rounded-3xl border-3 border-black bg-[#160822] p-5 space-y-4 poster-shadow-lg">
                        <div className="flex items-center justify-between border-b-2 border-black pb-3">
                          <h4 className="font-poster-title text-base text-purple-200 font-bold flex items-center gap-2">
                            <Crown className="w-5 h-5 text-yellow-400" />
                            <span>Masters Playoff Bracket Matches</span>
                          </h4>
                          <span className="text-xs text-amber-300 font-bold bg-amber-950/60 px-3 py-1 rounded-full border border-amber-500/40">
                            Page Playoff System
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {curSeason.playoffMatches.map((pm) => {
                            const idolA = pm.idolAId ? idolsMap.get(pm.idolAId) : undefined;
                            const idolB = pm.idolBId ? idolsMap.get(pm.idolBId) : undefined;
                            const aWon = pm.completed && pm.winnerId === pm.idolAId;
                            const bWon = pm.completed && pm.winnerId === pm.idolBId;

                            return (
                              <div
                                key={pm.id}
                                className={`rounded-2xl border-2 border-black p-4 space-y-3 poster-shadow-sm ${
                                  pm.completed ? 'bg-[#1e0e2a] border-purple-500/40' : 'bg-[#120719]'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-black uppercase border-b border-black/60 pb-1.5">
                                  <span className="text-purple-300 font-bold">{pm.roundName}</span>
                                  <span className="px-2 py-0.5 rounded-full border text-[9px] bg-emerald-950 text-emerald-300 border-emerald-500/40">
                                    Bo{pm.bestOf}
                                  </span>
                                </div>

                                {/* Team A */}
                                <div
                                  className={`flex items-center justify-between gap-2 p-2 rounded-xl border border-black/40 ${
                                    aWon ? 'bg-purple-700/40 text-white font-black' : 'bg-black/40 text-purple-200/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {idolA?.photoUrl ? (
                                      <img
                                        src={idolA.photoUrl}
                                        alt={idolA.name}
                                        className="w-7 h-7 rounded-lg object-cover border border-black shrink-0"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-black border border-black flex items-center justify-center text-[10px] font-bold text-purple-300 shrink-0">
                                        {idolA?.name ? idolA.name.slice(0, 1) : '?'}
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <div className="font-bold text-xs truncate">{idolA?.name || 'TBD'}</div>
                                      <div className="text-[9px] text-purple-400/80 truncate">{idolA?.girlGroup || ''}</div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-base font-black text-amber-300">
                                    {pm.completed || pm.scoreA > 0 ? pm.scoreA : '-'}
                                  </span>
                                </div>

                                {/* Team B */}
                                <div
                                  className={`flex items-center justify-between gap-2 p-2 rounded-xl border border-black/40 ${
                                    bWon ? 'bg-purple-700/40 text-white font-black' : 'bg-black/40 text-purple-200/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {idolB?.photoUrl ? (
                                      <img
                                        src={idolB.photoUrl}
                                        alt={idolB.name}
                                        className="w-7 h-7 rounded-lg object-cover border border-black shrink-0"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-black border border-black flex items-center justify-center text-[10px] font-bold text-purple-300 shrink-0">
                                        {idolB?.name ? idolB.name.slice(0, 1) : '?'}
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <div className="font-bold text-xs truncate">{idolB?.name || 'TBD'}</div>
                                      <div className="text-[9px] text-purple-400/80 truncate">{idolB?.girlGroup || ''}</div>
                                    </div>
                                  </div>
                                  <span className="font-mono text-base font-black text-amber-300">
                                    {pm.completed || pm.scoreB > 0 ? pm.scoreB : '-'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Season Match History List */}
                    <div className="rounded-3xl border-3 border-black bg-[#160822] p-5 space-y-4 poster-shadow-lg">
                      <div className="flex items-center justify-between border-b-2 border-black pb-3">
                        <h4 className="font-poster-title text-base text-purple-200 font-bold flex items-center gap-2">
                          <Swords className="w-5 h-5 text-purple-400" />
                          <span>Regular Season Matches ({allMatches.length} Total)</span>
                        </h4>
                        <span className="text-xs text-purple-300 font-bold">
                          Page {theIdolsMatchPage} of {totalTheIdolsPages}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {paginatedMatches.map((m) => {
                          const idolA = idolsMap.get(m.idolAId);
                          const idolB = idolsMap.get(m.idolBId);
                          const isWinA = m.completed && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                          const isWinB = m.completed && (m.scoreB ?? 0) > (m.scoreA ?? 0);
                          const isDraw = m.completed && m.scoreA === m.scoreB;

                          return (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-3 rounded-2xl border border-black bg-[#100516] text-xs font-poster-body"
                            >
                              <span className="text-[10px] font-mono text-purple-400 font-bold">
                                MD #{m.matchday}
                              </span>

                              <div className="flex items-center gap-3">
                                <span className={isWinA ? 'text-amber-300 font-black' : 'text-purple-200'}>
                                  {idolA?.name || 'TBD'}
                                </span>
                                {m.completed && m.scoreA !== null && m.scoreB !== null ? (
                                  <span className="rounded bg-black px-2 py-0.5 font-mono text-xs text-amber-300 border border-black">
                                    {m.scoreA} - {m.scoreB}
                                  </span>
                                ) : (
                                  <span className="rounded bg-purple-950 px-2 py-0.5 text-[10px] text-purple-400">
                                    VS
                                  </span>
                                )}
                                <span className={isWinB ? 'text-amber-300 font-black' : 'text-purple-200'}>
                                  {idolB?.name || 'TBD'}
                                </span>
                              </div>

                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                  m.completed
                                    ? isDraw
                                      ? 'bg-amber-950 text-amber-300'
                                      : 'bg-emerald-950 text-emerald-300'
                                    : 'bg-slate-950 text-slate-500'
                                }`}
                              >
                                {m.completed ? (isDraw ? 'Draw' : 'Final') : 'Pending'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination Controls */}
                      {totalTheIdolsPages > 1 && (
                        <div className="flex items-center justify-between border-t border-black/40 pt-3 text-xs">
                          <button
                            onClick={() => setTheIdolsMatchPage((p) => Math.max(1, p - 1))}
                            disabled={theIdolsMatchPage <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black bg-[#281335] text-purple-200 hover:text-white disabled:opacity-30 font-bold transition-all"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Prev</span>
                          </button>
                          <span className="text-purple-300 font-bold">
                            Page {theIdolsMatchPage} of {totalTheIdolsPages}
                          </span>
                          <button
                            onClick={() => setTheIdolsMatchPage((p) => Math.min(totalTheIdolsPages, p + 1))}
                            disabled={theIdolsMatchPage >= totalTheIdolsPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black bg-[#281335] text-purple-200 hover:text-white disabled:opacity-30 font-bold transition-all"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b1026] p-8 text-center text-purple-200/70 font-bold text-xs">
              No The Idols season profiles recorded yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
