import React, { useState, useEffect, useRef } from 'react';
import {
  TournamentArchive,
  ArchivedMatch,
  Group,
  KnockoutMatch,
  TournamentConfig,
  Idol,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from '../types';
import { Archive, Table, Swords, Crown, Trophy, Layers, Flame, Medal, ChevronLeft, ChevronRight } from 'lucide-react';
import { TournamentBracketTree } from './TournamentBracketTree';
import { getAllSeasonArchives } from '../utils/tournamentLogic';
import { DEFAULT_LEAGUE_DEFS, loadCustomLeagueBranding } from '../utils/leagueLogic';

interface TournamentBrowserPanelProps {
  archives: TournamentArchive[];
  idolsMap: Map<string, Idol>;
  matchDatabase?: ArchivedMatch[];
  currentGroups?: Group[];
  currentKnockoutMatches?: KnockoutMatch[];
  currentConfig?: TournamentConfig;
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
}

export const TournamentBrowserPanel: React.FC<TournamentBrowserPanelProps> = ({
  archives,
  idolsMap,
  matchDatabase = [],
  currentGroups,
  currentKnockoutMatches,
  currentConfig,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
}) => {
  const [activeTab, setActiveTab] = useState<'tournament' | 'league' | 'the_idols'>('tournament');

  const allArchives = getAllSeasonArchives(
    archives,
    matchDatabase,
    idolsMap,
    currentConfig,
    currentGroups,
    currentKnockoutMatches
  );

  const initialSeasonId =
    allArchives && allArchives.length > 0
      ? Number(allArchives[allArchives.length - 1]?.seasonId || 1)
      : 1;

  const [selectedSeasonId, setSelectedSeasonId] = useState<number>(initialSeasonId);
  const prevLenRef = useRef(allArchives?.length || 0);

  // League archives selection
  const archivedLeagueNums = new Set((leagueArchives || []).map((a) => a.seasonNumber));
  const allLeagueArchives = [
    ...(leagueState && Array.isArray(leagueState.leagues) && !archivedLeagueNums.has(leagueState.seasonNumber)
      ? [
          {
            seasonNumber: leagueState.seasonNumber,
            seasonName: leagueState.seasonName,
            isCurrent: true,
            archivedAt: new Date().toISOString(),
            allStandings: (leagueState.leagues || []).reduce(
              (acc, l) => ({ ...acc, [l.id]: l?.standings || [] }),
              {} as Record<number, any[]>
            ),
            allMatches: (leagueState.leagues || []).flatMap((l) => l?.matches || []),
            leagueChampions: (leagueState.leagues || []).map((l) => {
              const top = l?.standings?.[0];
              return {
                divisionId: l?.id,
                divisionName: l?.name,
                idolId: top?.idolId || '',
                idolName: top?.idolName || 'TBD',
                photoUrl: top?.photoUrl || '',
                girlGroup: top?.girlGroup || '',
                points: top?.points || 0,
              };
            }),
          },
        ]
      : []),
    ...(leagueArchives || []).map((a) => ({ ...a, isCurrent: false })),
  ];

  const [selectedLeagueSeasonNum, setSelectedLeagueSeasonNum] = useState<number>(
    leagueState?.seasonNumber || 1
  );
  const [selectedDivTab, setSelectedDivTab] = useState<number>(1);

  // The Idols archives selection
  const archivedTheIdolsNums = new Set((theIdolsArchives || []).map((a) => a.seasonNumber));
  const allTheIdolsArchives = [
    ...(theIdolsState && Array.isArray(theIdolsState.standings) && theIdolsState.standings.length > 0 && !archivedTheIdolsNums.has(theIdolsState.seasonNumber)
      ? [
          {
            seasonNumber: theIdolsState.seasonNumber,
            seasonName: theIdolsState.seasonName || `The Idols Season ${theIdolsState.seasonNumber}`,
            completedAt: new Date().toISOString(),
            isCurrent: true,
            championId: theIdolsState.championId || '',
            championName: theIdolsState.championName || 'TBD',
            runnerUpId: theIdolsState.runnerUpId || '',
            runnerUpName: theIdolsState.runnerUpName || 'TBD',
            thirdPlaceId: theIdolsState.thirdPlaceId || '',
            thirdPlaceName: theIdolsState.thirdPlaceName || 'TBD',
            mvpId: theIdolsState.mvpId || '',
            mvpName: theIdolsState.mvpName || '',
            topScorerId: theIdolsState.topScorerId || '',
            topScorerName: theIdolsState.topScorerName || '',
            topScorerGoals: theIdolsState.topScorerGoals || 0,
            memberIds: theIdolsState.memberIds || [],
            standings: theIdolsState.standings || [],
            matches: theIdolsState.matches || [],
            playoffMatches: theIdolsState.playoffMatches || [],
            totalMatches: theIdolsState.matches?.length || 0,
            totalGoals: (theIdolsState.standings || []).reduce((acc, s) => acc + (s.gamesFor || 0), 0),
          },
        ]
      : []),
    ...(theIdolsArchives || []).map((a) => ({ ...a, isCurrent: false })),
  ];

  const [selectedTheIdolsSeasonNum, setSelectedTheIdolsSeasonNum] = useState<number>(
    theIdolsState?.seasonNumber || 1
  );
  const [theIdolsArchiveSubTab, setTheIdolsArchiveSubTab] = useState<'standings' | 'playoff' | 'matches'>('standings');
  const [theIdolsArchiveMatchday, setTheIdolsArchiveMatchday] = useState<number>(1);

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

  const selectedLeagueArchive =
    allLeagueArchives.find((a) => a.seasonNumber === selectedLeagueSeasonNum) ||
    allLeagueArchives[0];

  const divStandings = selectedLeagueArchive?.allStandings?.[selectedDivTab] || [];

  const selectedTheIdolsArchive =
    allTheIdolsArchives.find((a) => a.seasonNumber === selectedTheIdolsSeasonNum) ||
    allTheIdolsArchives[0];

  const theIdolsArchiveMatches =
    (selectedTheIdolsArchive?.matches || []).filter((m) => m.matchday === theIdolsArchiveMatchday);

  const theIdolsArchiveTotalMatchdays = Math.max(
    ...(selectedTheIdolsArchive?.matches || []).map((m) => m.matchday),
    19
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Archive className="h-7 w-7 text-amber-400" />
            <span>Tournament &amp; League Archives</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Browse full past tournament and league season archives including groups, brackets, and standings.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-1 bg-[#160f0b] p-1 rounded-2xl border-2 border-black poster-shadow-sm flex-wrap">
          <button
            onClick={() => setActiveTab('tournament')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'tournament'
                ? 'poster-pill-red text-white shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>Cup Archives</span>
          </button>
          <button
            onClick={() => setActiveTab('league')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'league'
                ? 'poster-pill-gold text-amber-950 shadow'
                : 'text-amber-200/70 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>League Archives</span>
          </button>
          <button
            onClick={() => setActiveTab('the_idols')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
              activeTab === 'the_idols'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow border border-purple-400/40'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
            <span>The Idols Archives</span>
          </button>
        </div>
      </div>

      {/* 1. TOURNAMENT ARCHIVES */}
      {activeTab === 'tournament' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#1e1510] p-4 rounded-2xl border-2 border-black poster-shadow-sm">
            <span className="text-xs font-poster-title text-amber-300">Select Tournament Archive:</span>
            {allArchives.length > 0 && (
              <select
                value={Number.isNaN(selectedSeasonId) ? initialSeasonId : selectedSeasonId}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value, 10);
                  setSelectedSeasonId(Number.isNaN(parsed) ? initialSeasonId : parsed);
                }}
                className="rounded-xl border-2 border-black bg-[#120d09] px-4 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {allArchives.map((a, idx) => (
                  <option key={`tb-opt-${a?.seasonId ?? idx}-${idx}`} value={a.seasonId}>
                    {a?.seasonName || `Season ${a?.seasonId || 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {archive ? (
            <div className="space-y-6">
              {/* Summary Box */}
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 flex flex-col md:flex-row items-center justify-between gap-4 poster-shadow-lg">
                <div>
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest block">
                    Archived Cup Season
                  </span>
                  <h3 className="text-2xl font-poster-title text-white mt-1">
                    {archive?.seasonName || `Season ${archive?.seasonId || 1}`}
                  </h3>
                  <p className="text-xs text-amber-200/70 mt-0.5 font-bold">
                    {archive.totalParticipants} Participants &bull; {(archive.groups || []).length} Groups &bull; Completed {archive.completedAt ? new Date(archive.completedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-400/20 p-3 border-2 border-amber-400 text-center">
                    <span className="text-[10px] text-amber-400 font-black uppercase block">
                      Champion
                    </span>
                    <span className="text-sm font-poster-title text-white">{archive.championName}</span>
                  </div>
                  {archive.runnerUpName && (
                    <div className="rounded-2xl bg-[#120d09] p-3 border-2 border-slate-700 text-center">
                      <span className="text-[10px] text-slate-400 font-black uppercase block">
                        Runner-Up
                      </span>
                      <span className="text-sm font-poster-title text-white">{archive.runnerUpName}</span>
                    </div>
                  )}
                  {archive.thirdPlaceName && (
                    <div className="rounded-2xl bg-[#120d09] p-3 border-2 border-amber-800 text-center">
                      <span className="text-[10px] text-amber-600 font-black uppercase block">
                        3rd Place
                      </span>
                      <span className="text-sm font-poster-title text-white">{archive.thirdPlaceName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Groups Grid */}
              <div className="space-y-3">
                <h4 className="font-poster-title text-base text-red-500 border-b border-black pb-2 flex items-center gap-2">
                  <Table className="h-4 w-4 text-amber-400" />
                  <span>Group Standings Snapshot</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(archive.groups || []).map((g, gIdx) => (
                    <div
                      key={g.name ? `tb-group-${g.name}-${gIdx}` : `tb-group-${gIdx}`}
                      className="rounded-2xl border-2 border-black bg-[#140e0a] p-3 space-y-2 text-xs poster-shadow-sm"
                    >
                      <h5 className="font-poster-title text-amber-400 border-b border-black pb-1">
                        {g.name}
                      </h5>
                      <div className="space-y-1">
                        {(g.standings || []).map((st: any, sIdx: number) => {
                          const idol = idolsMap.get(st.idolId);
                          return (
                            <div
                              key={st.idolId ? `tb-st-${st.idolId}-${sIdx}` : `tb-st-${sIdx}`}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${
                                    sIdx === 0
                                      ? 'bg-amber-400 text-black'
                                      : sIdx === 1
                                      ? 'bg-slate-300 text-black'
                                      : 'bg-black text-amber-300'
                                  }`}
                                >
                                  {sIdx + 1}
                                </span>
                                <span className="font-bold text-amber-100 truncate">
                                  {st.idolName || idol?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-amber-400">{st.points} PTS</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bracket Tree */}
              {archive.knockoutMatches && archive.knockoutMatches.length > 0 && (
                <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 space-y-4 poster-shadow-lg">
                  <h4 className="font-poster-title text-base text-red-500 border-b border-black pb-2 flex items-center gap-2">
                    <Swords className="h-4 w-4 text-amber-400" />
                    <span>Knockout Bracket Snapshot</span>
                  </h4>
                  <TournamentBracketTree
                    knockoutMatches={archive.knockoutMatches}
                    idolsMap={idolsMap}
                    showTitleHeader={false}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-8 text-center text-amber-200/70 font-bold text-xs">
              No tournament archives available yet.
            </div>
          )}
        </div>
      )}

      {/* 2. LEAGUE SEASON ARCHIVES */}
      {activeTab === 'league' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#1e1510] p-4 rounded-2xl border-2 border-black poster-shadow-sm">
            <span className="text-xs font-poster-title text-amber-300">Select League Archive:</span>
            {allLeagueArchives.length > 0 && (
              <select
                value={selectedLeagueSeasonNum}
                onChange={(e) => setSelectedLeagueSeasonNum(Number(e.target.value))}
                className="rounded-xl border-2 border-black bg-[#120d09] px-4 py-2 text-xs font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {allLeagueArchives.map((a, idx) => (
                  <option key={`lba-opt-${a.seasonNumber}-${idx}`} value={a.seasonNumber}>
                    {a.seasonName} {a.isCurrent ? '(Active)' : '(Archived)'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedLeagueArchive ? (
            <div className="space-y-6">
              {/* Summary Box with 6 Division Winners */}
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 space-y-4 poster-shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
                  <div>
                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest block">
                      League Season Archive
                    </span>
                    <h3 className="text-2xl font-poster-title text-white mt-1">
                      {selectedLeagueArchive.seasonName}
                    </h3>
                  </div>
                  <span className="text-xs font-black text-amber-200/70">
                    Archived: {new Date(selectedLeagueArchive.archivedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(selectedLeagueArchive.leagueChampions || []).map((champ) => (
                    <div
                      key={`lba-champ-${champ.divisionId}`}
                      className="rounded-2xl border-2 border-black p-3 bg-[#120d09] text-center space-y-1.5 poster-shadow-sm"
                    >
                      <span className="text-[10px] font-black uppercase text-amber-400 truncate block">
                        {champ.divisionName}
                      </span>
                      {champ.photoUrl && (
                        <img
                          src={champ.photoUrl}
                          alt={champ.idolName}
                          className="w-12 h-12 rounded-xl object-cover border border-black mx-auto"
                        />
                      )}
                      <div className="font-poster-title text-xs text-white font-bold truncate">
                        {champ.idolName}
                      </div>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] font-black text-amber-300">
                        {champ.points} PTS
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Division Table View */}
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-5 space-y-4 poster-shadow-lg">
                <div className="flex flex-wrap items-center gap-1 border-b-2 border-black pb-3">
                  {DEFAULT_LEAGUE_DEFS.map((def) => {
                    const customDefs = loadCustomLeagueBranding();
                    const customDef = customDefs.find((c) => c.id === def.id);
                    const customChamp = (selectedLeagueArchive?.leagueChampions || []).find((c) => c.divisionId === def.id);
                    const divName = customChamp?.divisionName || customDef?.name || def.name;
                    return (
                      <button
                        key={def.id}
                        onClick={() => setSelectedDivTab(def.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                          selectedDivTab === def.id
                            ? 'poster-pill-gold text-amber-950 scale-105'
                            : 'bg-[#251a13] text-amber-200/70 hover:text-white'
                        }`}
                      >
                        Div {def.id}: {divName}
                      </button>
                    );
                  })}
                </div>

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
                      {divStandings.map((st: any) => (
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
                                st.rank <= 5 ? 'bg-emerald-500 text-black' : 'bg-black text-amber-300'
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
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-8 text-center text-amber-200/70 font-bold text-xs">
              No league season archives found.
            </div>
          )}
        </div>
      )}

      {/* 3. THE IDOLS ARCHIVES */}
      {activeTab === 'the_idols' && (
        <div className="space-y-6">
          {allTheIdolsArchives.length > 0 ? (
            <div className="space-y-6">
              {/* Season Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1e1026] p-4 rounded-2xl border-2 border-black poster-shadow-sm">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-poster-title text-purple-300">Select The Idols Season Archive:</span>
                </div>
                <select
                  value={selectedTheIdolsSeasonNum}
                  onChange={(e) => setSelectedTheIdolsSeasonNum(Number(e.target.value))}
                  className="rounded-xl border-2 border-black bg-[#100615] px-4 py-2 text-xs font-bold text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {allTheIdolsArchives.map((a, idx) => (
                    <option key={`tia-opt-${a?.seasonNumber ?? idx}`} value={a.seasonNumber}>
                      {a.seasonName} {a.isCurrent ? '(Active Season)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Season Honors & Champions Header */}
              {selectedTheIdolsArchive && (
                <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#200f2e] via-[#2d123f] to-[#160a21] p-5 poster-shadow-lg border-l-8 border-l-purple-500 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/80 pb-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                        The Idols &bull; Season #{selectedTheIdolsArchive.seasonNumber} Archive
                      </div>
                      <h3 className="text-xl sm:text-2xl font-poster-title text-purple-100 font-bold mt-0.5">
                        {selectedTheIdolsArchive.seasonName}
                      </h3>
                      <p className="text-xs text-purple-300/80 font-semibold mt-0.5">
                        {selectedTheIdolsArchive.totalMatches} Matches Logged &bull; {selectedTheIdolsArchive.totalGoals} Total Goals Scored
                      </p>
                    </div>

                    {/* Sub-tabs */}
                    <div className="flex items-center gap-1 bg-[#100615] p-1 rounded-2xl border-2 border-black">
                      <button
                        onClick={() => setTheIdolsArchiveSubTab('standings')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                          theIdolsArchiveSubTab === 'standings'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-purple-300/70 hover:text-white'
                        }`}
                      >
                        Superleague
                      </button>
                      <button
                        onClick={() => setTheIdolsArchiveSubTab('playoff')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                          theIdolsArchiveSubTab === 'playoff'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow'
                            : 'text-purple-300/70 hover:text-white'
                        }`}
                      >
                        Masters Playoff
                      </button>
                      <button
                        onClick={() => setTheIdolsArchiveSubTab('matches')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                          theIdolsArchiveSubTab === 'matches'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-purple-300/70 hover:text-white'
                        }`}
                      >
                        Matchdays
                      </button>
                    </div>
                  </div>

                  {/* Honor Podium Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Champion */}
                    <div className="rounded-2xl border-2 border-amber-400 bg-black/60 p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-500 text-black font-black flex items-center justify-center text-xs shrink-0 border border-black shadow">
                        <Crown className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <div className="text-[10px] uppercase font-black text-amber-400">Playoff Champion</div>
                        <div className="font-poster-title text-sm text-white truncate font-bold">
                          {selectedTheIdolsArchive.championName || 'TBD'}
                        </div>
                      </div>
                    </div>

                    {/* Runner-Up */}
                    {selectedTheIdolsArchive.runnerUpName && (
                      <div className="rounded-2xl border-2 border-slate-400/50 bg-black/60 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-300 text-black font-black flex items-center justify-center text-xs shrink-0 border border-black">
                          2nd
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase font-black text-slate-300">Runner-Up</div>
                          <div className="font-poster-title text-sm text-white truncate font-bold">
                            {selectedTheIdolsArchive.runnerUpName}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {selectedTheIdolsArchive.thirdPlaceName && (
                      <div className="rounded-2xl border-2 border-amber-700/50 bg-black/60 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-700 text-white font-black flex items-center justify-center text-xs shrink-0 border border-black">
                          3rd
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase font-black text-amber-500">3rd Place</div>
                          <div className="font-poster-title text-sm text-white truncate font-bold">
                            {selectedTheIdolsArchive.thirdPlaceName}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Top Scorer */}
                    {selectedTheIdolsArchive.topScorerName && (
                      <div className="rounded-2xl border-2 border-rose-500/50 bg-black/60 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-600 text-white font-black flex items-center justify-center text-xs shrink-0 border border-black">
                          <Flame className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase font-black text-rose-400">Golden Striker</div>
                          <div className="font-poster-title text-sm text-white truncate font-bold">
                            {selectedTheIdolsArchive.topScorerName} ({selectedTheIdolsArchive.topScorerGoals || 0}g)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 1: Superleague Standings */}
              {theIdolsArchiveSubTab === 'standings' && selectedTheIdolsArchive && (
                <div className="rounded-3xl border-3 border-black bg-[#170a20] p-5 space-y-4 poster-shadow-lg">
                  <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <h4 className="font-poster-title text-base text-purple-200 font-bold flex items-center gap-2">
                      <Table className="w-5 h-5 text-purple-400" />
                      <span>Superleague Regular Season Table</span>
                    </h4>
                    <span className="text-xs text-purple-300 font-bold bg-purple-950 px-3 py-1 rounded-full border border-purple-500/40">
                      20 Elite Idols
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-poster-body">
                      <thead className="bg-[#100615] text-[10px] font-black uppercase text-purple-300 border-b-2 border-black">
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
                        {(selectedTheIdolsArchive.standings || []).map((st, idx) => (
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
                            <td className="px-3 py-2.5 text-center">
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
                            <td className="px-3 py-2.5">
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
                            <td className="px-3 py-2.5 text-purple-300/80 text-[11px] font-bold truncate">
                              {st.girlGroup}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono font-bold text-amber-300">
                              {st.rating || '-'}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono">{st.played}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-emerald-400 font-bold">
                              {st.wins}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-amber-400 font-bold">
                              {st.draws}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-rose-400">
                              {st.losses}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono">{st.gamesFor}</td>
                            <td className="px-2 py-2.5 text-center font-mono">{st.gamesAgainst}</td>
                            <td className="px-2 py-2.5 text-center font-mono font-bold">
                              {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-black text-amber-300 text-sm">
                              {st.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Masters Playoff Bracket */}
              {theIdolsArchiveSubTab === 'playoff' && selectedTheIdolsArchive && (
                <div className="space-y-4">
                  {(!selectedTheIdolsArchive.playoffMatches || selectedTheIdolsArchive.playoffMatches.length === 0) ? (
                    <div className="rounded-2xl border-2 border-black bg-[#1b1026] p-8 text-center text-purple-200/70 font-bold text-xs">
                      No playoff matches recorded for this season.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedTheIdolsArchive.playoffMatches.map((pm) => {
                        const idolA = pm.idolAId ? idolsMap.get(pm.idolAId) : undefined;
                        const idolB = pm.idolBId ? idolsMap.get(pm.idolBId) : undefined;
                        const aWon = pm.completed && pm.winnerId === pm.idolAId;
                        const bWon = pm.completed && pm.winnerId === pm.idolBId;

                        return (
                          <div
                            key={pm.id}
                            className={`rounded-2xl border-2 border-black p-4 space-y-3 poster-shadow-sm ${
                              pm.completed ? 'bg-[#180d1f] border-purple-500/40' : 'bg-[#130919]'
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
                  )}
                </div>
              )}

              {/* Sub-tab 3: Matchdays Fixtures */}
              {theIdolsArchiveSubTab === 'matches' && selectedTheIdolsArchive && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#1e1026] p-3 rounded-2xl border-2 border-black">
                    <h4 className="font-poster-title text-sm text-purple-200 flex items-center gap-2">
                      <Swords className="w-4 h-4 text-purple-400" />
                      <span>Matchday {theIdolsArchiveMatchday} Fixtures</span>
                    </h4>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setTheIdolsArchiveMatchday((p) => Math.max(1, p - 1))}
                        disabled={theIdolsArchiveMatchday <= 1}
                        className="p-1.5 rounded-xl bg-[#281335] text-purple-300 disabled:opacity-30 hover:bg-[#381a4b]"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 font-mono text-xs font-bold text-purple-200">
                        {theIdolsArchiveMatchday} / {theIdolsArchiveTotalMatchdays}
                      </span>
                      <button
                        onClick={() => setTheIdolsArchiveMatchday((p) => Math.min(theIdolsArchiveTotalMatchdays, p + 1))}
                        disabled={theIdolsArchiveMatchday >= theIdolsArchiveTotalMatchdays}
                        className="p-1.5 rounded-xl bg-[#281335] text-purple-300 disabled:opacity-30 hover:bg-[#381a4b]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {theIdolsArchiveMatches.map((m) => {
                      const idolA = idolsMap.get(m.idolAId);
                      const idolB = idolsMap.get(m.idolBId);
                      const isCompleted = m.completed && m.scoreA !== null && m.scoreB !== null;
                      const aWon = isCompleted && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                      const bWon = isCompleted && (m.scoreB ?? 0) > (m.scoreA ?? 0);

                      return (
                        <div
                          key={m.id}
                          className="rounded-2xl border-2 border-black bg-[#190d21] p-3 space-y-2 poster-shadow-sm"
                        >
                          <div className="text-[9px] font-black uppercase text-purple-400/80 border-b border-black/60 pb-1 flex justify-between">
                            <span>Match #{m.id.split('_').pop()}</span>
                            <span className="text-emerald-400 font-bold">{isCompleted ? 'Final' : 'Scheduled'}</span>
                          </div>

                          {/* Team A */}
                          <div
                            className={`flex items-center justify-between gap-2 p-1 rounded-xl ${
                              aWon ? 'bg-purple-700/30 text-white font-bold' : 'text-purple-200/80'
                            }`}
                          >
                            <span className="text-xs truncate">{idolA?.name || 'TBD'}</span>
                            <span className="font-mono text-xs font-black text-amber-300">
                              {isCompleted ? m.scoreA : '-'}
                            </span>
                          </div>

                          {/* Team B */}
                          <div
                            className={`flex items-center justify-between gap-2 p-1 rounded-xl ${
                              bWon ? 'bg-purple-700/30 text-white font-bold' : 'text-purple-200/80'
                            }`}
                          >
                            <span className="text-xs truncate">{idolB?.name || 'TBD'}</span>
                            <span className="font-mono text-xs font-black text-amber-300">
                              {isCompleted ? m.scoreB : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b1026] p-8 text-center text-purple-200/70 font-bold text-xs">
              No archives found for The Idols. Complete a season of The Idols to archive standings and playoff brackets.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
