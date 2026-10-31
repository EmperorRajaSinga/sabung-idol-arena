import React, { useState, useMemo } from 'react';
import {
  Group,
  KnockoutMatch,
  Idol,
  TournamentConfig,
  LeagueSeasonState,
  LeagueInfo,
  TheIdolsSeasonState,
} from '../types';
import { TournamentBracketTree } from './TournamentBracketTree';
import { DEFAULT_LEAGUE_DEFS, getTop32Qualifiers, generateWildcardPlayIn } from '../utils/leagueLogic';
import { WildcardPlayInBracket } from './WildcardPlayInBracket';
import { SwissPlayInBracket } from './SwissPlayInBracket';
import { generateSwissPlayIn } from '../utils/swissLogic';
import {
  Eye,
  Trophy,
  Crown,
  CheckCircle,
  Table,
  Swords,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Flame,
  Star,
  Award,
  Layers,
  Shield,
  Medal,
  Download,
} from 'lucide-react';
import { MatchdayDownloadModal } from './MatchdayDownloadModal';

interface PublicResultsPanelProps {
  groups: Group[];
  knockoutMatches: KnockoutMatch[];
  idolsMap: Map<string, Idol>;
  config: TournamentConfig;
  leagueState?: LeagueSeasonState | null;
  theIdolsState?: TheIdolsSeasonState | null;
  idols?: Idol[];
}

export const PublicResultsPanel: React.FC<PublicResultsPanelProps> = ({
  groups,
  knockoutMatches,
  idolsMap,
  config,
  leagueState,
  theIdolsState,
  idols = [],
}) => {
  const safeKnockoutMatches = knockoutMatches || [];
  const safeGroups = groups || [];
  const [viewMode, setViewMode] = useState<'tournament' | 'league' | 'wildcard' | 'the_idols'>('tournament');
  const [selectedLeagueId, setSelectedLeagueId] = useState<number>(1);
  const [selectedMatchday, setSelectedMatchday] = useState<number>(
    leagueState?.currentMatchday || 1
  );
  const [showMatchdayDownloadModal, setShowMatchdayDownloadModal] = useState<boolean>(false);

  // The Idols state sub-view
  const [theIdolsSubTab, setTheIdolsSubTab] = useState<'standings' | 'playoff'>('standings');
  const [theIdolsSelectedMatchday, setTheIdolsSelectedMatchday] = useState<number>(
    theIdolsState?.currentMatchday || 1
  );

  const activeLeague: LeagueInfo | undefined = leagueState?.leagues?.find(
    (l) => l.id === selectedLeagueId
  );

  const isGrandCup64 = leagueState?.postseasonFormat === 'grand_cup_64';

  const publicWildcardPlayIn = useMemo(() => {
    if (!leagueState || !leagueState.leagues) return undefined;
    return generateWildcardPlayIn(leagueState.leagues, idols, leagueState.wildcardPlayIn);
  }, [leagueState, idols]);

  const publicSwissPlayIn = useMemo(() => {
    if (!leagueState || !leagueState.leagues) return undefined;
    if (leagueState.swissPlayIn) return leagueState.swissPlayIn;
    return generateSwissPlayIn(leagueState.leagues, idols);
  }, [leagueState, idols]);

  const top32Qualifiers =
    leagueState && leagueState.leagues && idols.length > 0
      ? getTop32Qualifiers(leagueState.leagues, idols, publicWildcardPlayIn)
      : [];

  const activeDef =
    DEFAULT_LEAGUE_DEFS.find((d) => d.id === selectedLeagueId) ||
    DEFAULT_LEAGUE_DEFS[0];

  const totalMatchdays = useMemo(() => {
    if (!activeLeague || !activeLeague.matches || activeLeague.matches.length === 0) return 38;
    return Math.max(...activeLeague.matches.map((m) => m.matchday), 38);
  }, [activeLeague]);

  const matchdayMatches =
    activeLeague?.matches?.filter((m) => m.matchday === selectedMatchday) || [];

  const theIdolsTotalMatchdays = useMemo(() => {
    if (!theIdolsState || !theIdolsState.matches || theIdolsState.matches.length === 0) return 19;
    return Math.max(...theIdolsState.matches.map((m) => m.matchday), 19);
  }, [theIdolsState]);

  const theIdolsMatchdayMatches =
    theIdolsState?.matches?.filter((m) => m.matchday === theIdolsSelectedMatchday) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Public Broadcast Header */}
      <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#1c140e] via-[#2c1d13] to-[#1a120d] p-5 md:p-7 shadow-2xl poster-shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-black flex items-center justify-center border-2 border-black poster-shadow-sm">
              <Eye className="h-4 w-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-300">
              Spectator Broadcast &bull; Official Live Results Hub
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-poster-title text-red-500 drop-shadow-[2px_2px_0px_#000] mt-1.5">
            {viewMode === 'tournament'
              ? `${config?.seasonName || `Season ${config?.seasonNumber || 1}`} Championship Live Board`
              : viewMode === 'the_idols'
              ? `${theIdolsState?.seasonName || 'The Idols Superleague'} Spectator Live Hub`
              : `${leagueState?.seasonName || 'League System'} &bull; EA FIFA Spectator Hub`}
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Live public broadcast for World-Cup Knockout Cup, FIFA 6-League Division Standings, Wildcard Play-Ins, and The Idols Superleague &amp; Masters Playoff.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-xl border border-black poster-shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
              Live Feed
            </span>
          </div>

          {/* Main Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#140e0a] p-1 rounded-2xl border-2 border-black poster-shadow-sm flex-wrap">
            <button
              onClick={() => setViewMode('tournament')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                viewMode === 'tournament'
                  ? 'poster-pill-red text-white shadow-md'
                  : 'text-amber-200/70 hover:text-white hover:bg-[#251911]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Cup Tournament</span>
            </button>
            <button
              onClick={() => setViewMode('league')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                viewMode === 'league'
                  ? 'poster-pill-gold text-amber-950 shadow-md'
                  : 'text-amber-200/70 hover:text-white hover:bg-[#251911]'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>FIFA League Hub</span>
            </button>
            <button
              onClick={() => setViewMode('wildcard')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                viewMode === 'wildcard'
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-amber-200/70 hover:text-white hover:bg-[#251911]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>{isGrandCup64 ? 'Swiss Stage Play-In (60 Idols)' : 'Wildcard Play-In (6th Place)'}</span>
            </button>
            <button
              onClick={() => setViewMode('the_idols')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                viewMode === 'the_idols'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border border-purple-400/50'
                  : 'text-purple-300/70 hover:text-white hover:bg-[#251911]'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-yellow-400" />
              <span>The Idols</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: TOURNAMENT CUP */}
      {viewMode === 'tournament' && (
        <div className="space-y-6">
          {/* Group Stage Public Tables Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="text-xl font-poster-title text-red-500 drop-shadow-[1px_1px_0px_#000] flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <span>Group Stage Standings</span>
              </h3>
              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/40">
                Top {config.qualifiedPerGroup} advance to Knockout Bracket
              </span>
            </div>

            {safeGroups.length === 0 ? (
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-8 text-center text-amber-200/70 font-bold text-sm">
                No active group stage matches found. Start or draw groups in the Tournament Workspace.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {safeGroups.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-2xl border-2 border-black bg-[#1b130e] p-4 space-y-3 poster-shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-black pb-2">
                      <h4 className="font-poster-title text-sm text-amber-400 font-bold">
                        {g.name}
                      </h4>
                      <span className="text-[10px] text-amber-200/70 font-bold">
                        Top {config.qualifiedPerGroup} Qualify
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-poster-body">
                        <thead className="bg-[#120d09] text-[9px] font-black uppercase text-amber-300/80">
                          <tr>
                            <th className="px-2 py-1.5">#</th>
                            <th className="px-2 py-1.5">Idol</th>
                            <th className="px-2 py-1.5 text-center">W-D-L</th>
                            <th className="px-2 py-1.5 text-center">Diff</th>
                            <th className="px-2 py-1.5 text-center font-bold text-amber-300">
                              PTS
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/40 font-medium">
                          {(g.standings || []).map((st) => {
                            const idol = idolsMap.get(st.idolId);
                            if (!idol) return null;

                            return (
                              <tr
                                key={st.idolId}
                                className={
                                  st.qualified
                                    ? 'bg-amber-500/15 text-amber-100 font-bold'
                                    : 'text-amber-200/80'
                                }
                              >
                                <td className="px-2 py-1.5 text-[10px] font-black text-amber-400">
                                  {st.rank}
                                </td>
                                <td className="px-2 py-1.5">
                                  <div className="flex items-center gap-1.5">
                                    {idol.photoUrl ? (
                                      <img
                                        src={idol.photoUrl}
                                        alt={idol.name}
                                        className="h-6 w-6 rounded-lg object-cover border border-black"
                                      />
                                    ) : (
                                      <div className="h-6 w-6 rounded-lg bg-black border border-black flex items-center justify-center text-[10px] font-bold text-amber-300 shrink-0">
                                        {idol.name.slice(0, 1)}
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <span className="truncate font-bold block">{idol.name}</span>
                                      <span className="text-[9px] text-amber-400/80 block truncate">
                                        {idol.girlGroup}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-center text-[10px] font-mono">
                                  <span className="text-emerald-400 font-bold">{st.wins}</span>-
                                  <span className="text-amber-400 font-bold">{st.draws}</span>-
                                  <span className="text-red-400">{st.losses}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center font-mono text-[10px]">
                                  {st.gameDiff}
                                </td>
                                <td className="px-2 py-1.5 text-center font-black text-amber-300">
                                  {st.points}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Knockout Stage Public Tree */}
          {safeKnockoutMatches.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h3 className="text-xl font-poster-title text-red-500 drop-shadow-[1px_1px_0px_#000] flex items-center gap-2">
                  <Swords className="w-5 h-5 text-amber-400" />
                  <span>Public Knockout Bracket Tree</span>
                </h3>
              </div>

              <TournamentBracketTree
                knockoutMatches={safeKnockoutMatches}
                idolsMap={idolsMap}
                showTitleHeader={false}
              />
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: FIFA LEAGUE HUB */}
      {viewMode === 'league' && (
        <div className="space-y-6">
          {/* League Division Selectors (FIFA Game Style) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {DEFAULT_LEAGUE_DEFS.map((def) => {
              const isActive = selectedLeagueId === def.id;
              const lData = leagueState?.leagues?.find((l) => l.id === def.id);
              const leader = lData?.standings?.[0];

              return (
                <button
                  key={def.id}
                  onClick={() => setSelectedLeagueId(def.id)}
                  className={`p-3 rounded-2xl border-2 transition-all text-left flex flex-col justify-between poster-shadow-sm ${
                    isActive
                      ? 'border-amber-400 bg-gradient-to-b from-[#3a2517] to-[#25170e] text-white ring-2 ring-amber-400/40 scale-[1.02]'
                      : 'border-black bg-[#1c140e] text-amber-200/70 hover:bg-[#271b12] hover:text-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: def.color }}
                      />
                      <span className="text-[10px] font-black uppercase text-amber-400">
                        Div {def.id}
                      </span>
                    </div>
                    <div className="font-poster-title text-xs font-bold mt-1 text-amber-100 truncate">
                      {def.name}
                    </div>
                    <div className="text-[9px] text-amber-300/70 font-semibold truncate">
                      {def.tierName}
                    </div>
                  </div>

                  {leader && (
                    <div className="mt-2 pt-2 border-t border-black/40 flex items-center gap-1.5 text-[10px]">
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate font-bold text-amber-300">
                        {leader.idolName} ({leader.points} pts)
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Division Header Banner */}
          {activeLeague && (
            <div
              className="rounded-3xl border-3 border-black p-5 md:p-6 text-white poster-shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              style={{
                background: `linear-gradient(135deg, #1c130d 0%, #291a11 60%, ${activeDef.color}22 100%)`,
                borderLeftWidth: '8px',
                borderLeftColor: activeDef.color,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-poster-title text-xl font-black text-white border-2 border-black shadow-lg"
                  style={{ backgroundColor: activeDef.color }}
                >
                  D{activeDef.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl sm:text-2xl font-poster-title text-amber-300">
                      {activeLeague.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-black/60 border border-black text-amber-300 text-[10px] font-black uppercase">
                      {activeLeague.tierName}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 font-bold mt-0.5">
                    20 Teams &bull; {totalMatchdays} Matchdays Double Round-Robin &bull; Top 5 Qualify for Champions League Knockout
                  </p>
                </div>
              </div>

              {/* Matchday Selector */}
              <div className="flex items-center gap-2 bg-[#120d09] p-1.5 rounded-2xl border-2 border-black">
                <button
                  onClick={() => setSelectedMatchday((prev) => Math.max(1, prev - 1))}
                  disabled={selectedMatchday <= 1}
                  className="p-1.5 rounded-xl bg-[#281b12] text-amber-300 disabled:opacity-30 hover:bg-[#382618]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="px-3 text-center">
                  <div className="text-[10px] uppercase font-black text-amber-400">Matchday</div>
                  <div className="font-poster-title text-base text-white leading-none">
                    {selectedMatchday} <span className="text-xs text-amber-400/60">/ {totalMatchdays}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMatchday((prev) => Math.min(totalMatchdays, prev + 1))}
                  disabled={selectedMatchday >= totalMatchdays}
                  className="p-1.5 rounded-xl bg-[#281b12] text-amber-300 disabled:opacity-30 hover:bg-[#382618]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Matchday Fixtures Carousel / Cards (FIFA Style) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-poster-title text-sm text-red-500 flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-400" />
                <span>Matchday {selectedMatchday} Fixtures &amp; Scores</span>
              </h4>

              {leagueState?.leagues && (
                <button
                  onClick={() => setShowMatchdayDownloadModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all poster-shadow-sm hover:scale-105"
                  title="Download Matchday Card (PNG/CSV/Text)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Matchday</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {matchdayMatches.map((m) => {
                const idolA = idolsMap.get(m.idolAId);
                const idolB = idolsMap.get(m.idolBId);
                const isCompleted = m.completed && m.scoreA !== null && m.scoreB !== null;
                const aWon = isCompleted && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                const bWon = isCompleted && (m.scoreB ?? 0) > (m.scoreA ?? 0);

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border-2 border-black bg-[#1a120d] p-3 space-y-2 poster-shadow-sm hover:border-amber-400/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[9px] font-black uppercase text-amber-400/80 border-b border-black/60 pb-1">
                      <span>Fixture</span>
                      <span className={isCompleted ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {isCompleted ? 'Final Score' : 'Upcoming'}
                      </span>
                    </div>

                    {/* Team A */}
                    <div
                      className={`flex items-center justify-between gap-2 p-1.5 rounded-xl ${
                        aWon ? 'bg-amber-500/20 text-white font-black' : 'text-amber-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {idolA?.photoUrl ? (
                          <img
                            src={idolA.photoUrl}
                            alt={idolA?.name || ''}
                            className="w-6 h-6 rounded-lg object-cover border border-black shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-black/60 border border-black shrink-0 flex items-center justify-center text-[10px] font-bold text-amber-300">
                            {idolA?.name ? idolA.name.slice(0, 1) : '?'}
                          </div>
                        )}
                        <span className="text-xs font-bold truncate">
                          {idolA?.name || 'TBD'}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-300">
                        {isCompleted ? m.scoreA : '-'}
                      </span>
                    </div>

                    {/* Team B */}
                    <div
                      className={`flex items-center justify-between gap-2 p-1.5 rounded-xl ${
                        bWon ? 'bg-amber-500/20 text-white font-black' : 'text-amber-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {idolB?.photoUrl ? (
                          <img
                            src={idolB.photoUrl}
                            alt={idolB?.name || ''}
                            className="w-6 h-6 rounded-lg object-cover border border-black shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-black/60 border border-black shrink-0 flex items-center justify-center text-[10px] font-bold text-amber-300">
                            {idolB?.name ? idolB.name.slice(0, 1) : '?'}
                          </div>
                        )}
                        <span className="text-xs font-bold truncate">
                          {idolB?.name || 'TBD'}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-300">
                        {isCompleted ? m.scoreB : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Division Standings Table */}
          {activeLeague && (
            <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-4 sm:p-6 space-y-4 poster-shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <Table className="w-5 h-5 text-amber-400" />
                  <h4 className="font-poster-title text-base sm:text-lg text-amber-300">
                    {activeLeague.name} Official Table
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                    <span>Top 5: UCL Qualifiers</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                    <span>6th: Wildcard</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead className="bg-[#120d09] text-[10px] font-black uppercase text-amber-300 border-b-2 border-black">
                    <tr>
                      <th className="px-3 py-2.5 text-center">Pos</th>
                      <th className="px-3 py-2.5">Idol</th>
                      <th className="px-3 py-2.5">Group</th>
                      <th className="px-2 py-2.5 text-center">P</th>
                      <th className="px-2 py-2.5 text-center">W</th>
                      <th className="px-2 py-2.5 text-center">D</th>
                      <th className="px-2 py-2.5 text-center">L</th>
                      <th className="px-2 py-2.5 text-center">GF</th>
                      <th className="px-2 py-2.5 text-center">GA</th>
                      <th className="px-2 py-2.5 text-center">GD</th>
                      <th className="px-3 py-2.5 text-center font-black text-amber-400">PTS</th>
                      <th className="px-3 py-2.5 text-center">Form (Last 5)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/40 font-medium">
                    {(activeLeague.standings || []).map((st) => {
                      const idol = idolsMap.get(st.idolId);
                      const isTop5 = st.rank <= 5;
                      const isSixth = st.rank === 6;

                      return (
                        <tr
                          key={st.idolId}
                          className={`transition-colors ${
                            isTop5
                              ? 'bg-emerald-950/20 text-white font-bold'
                              : isSixth
                              ? 'bg-amber-950/20 text-amber-100 font-bold'
                              : 'text-amber-200/80 hover:bg-[#251a13]'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black border ${
                                isTop5
                                  ? 'bg-emerald-500 text-black border-emerald-300'
                                  : isSixth
                                  ? 'bg-amber-500 text-black border-amber-300'
                                  : 'bg-black text-amber-300 border-black'
                              }`}
                            >
                              {st.rank}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {(st.photoUrl || idol?.photoUrl) ? (
                                <img
                                  src={st.photoUrl || idol?.photoUrl}
                                  alt={st.idolName}
                                  className="w-7 h-7 rounded-lg object-cover border border-black shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-black border border-black flex items-center justify-center text-[10px] font-bold text-amber-300 shrink-0">
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
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(st.form || []).map((f, fIdx) => (
                                <span
                                  key={fIdx}
                                  className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center text-black ${
                                    f === 'W'
                                      ? 'bg-emerald-400'
                                      : f === 'D'
                                      ? 'bg-amber-400'
                                      : 'bg-red-500 text-white'
                                  }`}
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: WILDCARD PLAY-IN / SWISS STAGE */}
      {viewMode === 'wildcard' && (
        <div className="space-y-6">
          {isGrandCup64 ? (
            publicSwissPlayIn ? (
              <SwissPlayInBracket
                playIn={publicSwissPlayIn}
                idols={idols}
                isInteractive={false}
                config={config}
                favoriteIdolIds={config?.favoriteIdolIds || []}
                onUpdateState={() => {}}
                onReset={() => {}}
              />
            ) : (
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-8 text-center text-amber-200/70 font-bold text-sm">
                Swiss Stage Play-In contenders (Ranks 7th–16th across all 6 leagues) will be populated once the league begins.
              </div>
            )
          ) : (
            publicWildcardPlayIn ? (
              <WildcardPlayInBracket
                playIn={publicWildcardPlayIn}
                idols={idols}
                isInteractive={false}
              />
            ) : (
              <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-8 text-center text-amber-200/70 font-bold text-sm">
                Wildcard Play-In participants (6th place across all 6 leagues) will be determined after league matches conclude.
              </div>
            )
          )}
        </div>
      )}

      {/* VIEW MODE 4: THE IDOLS SUPERLEAGUE & MASTERS PLAYOFF */}
      {viewMode === 'the_idols' && (
        <div className="space-y-6">
          {!theIdolsState || !theIdolsState.isStarted ? (
            <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-10 text-center space-y-3 poster-shadow-md">
              <Crown className="w-12 h-12 text-purple-400 mx-auto animate-pulse" />
              <h3 className="text-xl font-poster-title text-amber-300">The Idols Superleague Not Started</h3>
              <p className="text-xs text-amber-200/70 max-w-md mx-auto">
                No active season of The Idols is currently in progress. Open The Idols tab from the navigation sidebar to start or simulate the regular season and Masters Playoff.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Season Showcase Banner */}
              <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#20102b] via-[#2c133b] to-[#170a20] p-5 md:p-6 text-white poster-shadow-md border-l-8 border-l-purple-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-poster-title text-xl font-black text-yellow-300 border-2 border-black shadow-lg shrink-0">
                    <Crown className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl sm:text-2xl font-poster-title text-purple-200">
                        {theIdolsState.seasonName || `The Idols Season ${theIdolsState.seasonNumber || 1}`}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-200 text-[10px] font-black uppercase tracking-wider">
                        {theIdolsState.isPlayoffCompleted
                          ? 'Season Concluded'
                          : theIdolsState.isLeagueCompleted
                          ? 'Masters Playoff Live'
                          : `Matchday ${theIdolsState.currentMatchday} / 19`}
                      </span>
                    </div>
                    <p className="text-xs text-purple-200/80 font-bold mt-0.5">
                      Elite 20-Idol Superleague &bull; Single Round-Robin (19 Matchdays) &bull; Top 10 Masters Double-Elimination Playoff
                    </p>
                  </div>
                </div>

                {/* Sub-view toggle */}
                <div className="flex items-center gap-1 bg-[#120817] p-1 rounded-2xl border-2 border-black">
                  <button
                    onClick={() => setTheIdolsSubTab('standings')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                      theIdolsSubTab === 'standings'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-purple-300/70 hover:text-white'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Standings &amp; Fixtures</span>
                  </button>
                  <button
                    onClick={() => setTheIdolsSubTab('playoff')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-poster-body font-black transition-all ${
                      theIdolsSubTab === 'playoff'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow'
                        : 'text-purple-300/70 hover:text-white'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Masters Playoff</span>
                  </button>
                </div>
              </div>

              {/* Podium Showcase (if completed) */}
              {theIdolsState.isPlayoffCompleted && theIdolsState.championName && (
                <div className="rounded-3xl border-3 border-black bg-gradient-to-r from-[#2a1a08] via-[#3d270c] to-[#241505] p-5 poster-shadow-md border-amber-500/40">
                  <div className="flex items-center gap-2 mb-3 text-amber-300">
                    <Trophy className="w-5 h-5 text-yellow-400 animate-bounce" />
                    <span className="font-poster-title text-sm uppercase tracking-widest text-amber-400">
                      Season Podium &amp; Honors
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Champion */}
                    <div className="rounded-2xl border-2 border-amber-400 bg-black/60 p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-500 text-black font-black flex items-center justify-center text-xs shrink-0 border border-black shadow">
                        1st
                      </div>
                      <div className="truncate">
                        <div className="text-[10px] uppercase font-black text-amber-400">Champion</div>
                        <div className="font-poster-title text-sm text-white truncate font-bold">
                          {theIdolsState.championName}
                        </div>
                      </div>
                    </div>
                    {/* Runner-Up */}
                    {theIdolsState.runnerUpName && (
                      <div className="rounded-2xl border-2 border-slate-400/50 bg-black/60 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-300 text-black font-black flex items-center justify-center text-xs shrink-0 border border-black">
                          2nd
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase font-black text-slate-300">Runner-Up</div>
                          <div className="font-poster-title text-sm text-white truncate font-bold">
                            {theIdolsState.runnerUpName}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 3rd Place */}
                    {theIdolsState.thirdPlaceName && (
                      <div className="rounded-2xl border-2 border-amber-700/50 bg-black/60 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-700 text-white font-black flex items-center justify-center text-xs shrink-0 border border-black">
                          3rd
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase font-black text-amber-500">3rd Place</div>
                          <div className="font-poster-title text-sm text-white truncate font-bold">
                            {theIdolsState.thirdPlaceName}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Top Scorer */}
                    {theIdolsState.topScorerName && (
                      <div className="rounded-2xl border-2 border-rose-500/50 bg-black/60 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-600 text-white font-black flex items-center justify-center text-xs shrink-0 border border-black">
                          <Flame className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] uppercase font-black text-rose-400">Golden Striker</div>
                          <div className="font-poster-title text-sm text-white truncate font-bold">
                            {theIdolsState.topScorerName} ({theIdolsState.topScorerGoals || 0}g)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 1: Standings & Matchdays */}
              {theIdolsSubTab === 'standings' && (
                <div className="space-y-6">
                  {/* Matchday Selector & Fixtures Carousel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-poster-title text-sm text-purple-300 flex items-center gap-2">
                        <Swords className="w-4 h-4 text-purple-400" />
                        <span>Matchday {theIdolsSelectedMatchday} Fixtures &amp; Scores</span>
                      </h4>

                      <div className="flex items-center gap-1.5 bg-[#140b1a] p-1 rounded-2xl border-2 border-black">
                        <button
                          onClick={() => setTheIdolsSelectedMatchday((p) => Math.max(1, p - 1))}
                          disabled={theIdolsSelectedMatchday <= 1}
                          className="p-1 rounded-xl bg-[#271433] text-purple-300 disabled:opacity-30 hover:bg-[#381c4a]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2 font-mono text-xs font-black text-purple-200">
                          {theIdolsSelectedMatchday} / {theIdolsTotalMatchdays}
                        </span>
                        <button
                          onClick={() => setTheIdolsSelectedMatchday((p) => Math.min(theIdolsTotalMatchdays, p + 1))}
                          disabled={theIdolsSelectedMatchday >= theIdolsTotalMatchdays}
                          className="p-1 rounded-xl bg-[#271433] text-purple-300 disabled:opacity-30 hover:bg-[#381c4a]"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {theIdolsMatchdayMatches.map((m) => {
                        const idolA = idolsMap.get(m.idolAId);
                        const idolB = idolsMap.get(m.idolBId);
                        const isCompleted = m.completed && m.scoreA !== null && m.scoreB !== null;
                        const aWon = isCompleted && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                        const bWon = isCompleted && (m.scoreB ?? 0) > (m.scoreA ?? 0);

                        return (
                          <div
                            key={m.id}
                            className="rounded-2xl border-2 border-black bg-[#1a0f21] p-3 space-y-2 poster-shadow-sm hover:border-purple-400/40 transition-colors"
                          >
                            <div className="flex items-center justify-between text-[9px] font-black uppercase text-purple-400/80 border-b border-black/60 pb-1">
                              <span>Match #{m.id.split('_').pop()}</span>
                              <span className={isCompleted ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                                {isCompleted ? 'Final' : 'Scheduled'}
                              </span>
                            </div>

                            {/* Team A */}
                            <div
                              className={`flex items-center justify-between gap-2 p-1.5 rounded-xl ${
                                aWon ? 'bg-purple-600/30 text-white font-black' : 'text-purple-200/80'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {idolA?.photoUrl ? (
                                  <img
                                    src={idolA.photoUrl}
                                    alt={idolA?.name || ''}
                                    className="w-6 h-6 rounded-lg object-cover border border-black shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-lg bg-black shrink-0 flex items-center justify-center text-[10px] font-bold text-purple-300 border border-black">
                                    {idolA?.name ? idolA.name.slice(0, 1) : '?'}
                                  </div>
                                )}
                                <span className="text-xs font-bold truncate">
                                  {idolA?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="font-mono text-sm font-black text-amber-300">
                                {isCompleted ? m.scoreA : '-'}
                              </span>
                            </div>

                            {/* Team B */}
                            <div
                              className={`flex items-center justify-between gap-2 p-1.5 rounded-xl ${
                                bWon ? 'bg-purple-600/30 text-white font-black' : 'text-purple-200/80'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {idolB?.photoUrl ? (
                                  <img
                                    src={idolB.photoUrl}
                                    alt={idolB?.name || ''}
                                    className="w-6 h-6 rounded-lg object-cover border border-black shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-lg bg-black shrink-0 flex items-center justify-center text-[10px] font-bold text-purple-300 border border-black">
                                    {idolB?.name ? idolB.name.slice(0, 1) : '?'}
                                  </div>
                                )}
                                <span className="text-xs font-bold truncate">
                                  {idolB?.name || 'TBD'}
                                </span>
                              </div>
                              <span className="font-mono text-sm font-black text-amber-300">
                                {isCompleted ? m.scoreB : '-'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Complete Superleague Standings Table */}
                  <div className="rounded-3xl border-3 border-black bg-[#160b1c] overflow-hidden poster-shadow-md">
                    <div className="p-4 bg-[#1e0e27] border-b-2 border-black flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Table className="w-5 h-5 text-purple-400" />
                        <h4 className="font-poster-title text-base text-purple-200 font-bold">
                          The Idols Official Standings &bull; Season Table
                        </h4>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold">
                        <span className="flex items-center gap-1 text-purple-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Top 2: Semi-Final Bye
                        </span>
                        <span className="flex items-center gap-1 text-indigo-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> 3-6: Upper Quarterfinals
                        </span>
                        <span className="flex items-center gap-1 text-sky-300">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> 7-10: Lower Play-In
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-poster-body">
                        <thead className="bg-[#100615] text-[9px] font-black uppercase text-purple-300/80 border-b border-black">
                          <tr>
                            <th className="px-3 py-2 text-center w-10">POS</th>
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
                            <th className="px-3 py-2 text-center font-mono text-amber-300 font-bold">PTS</th>
                            <th className="px-3 py-2 text-center">Form</th>
                            <th className="px-3 py-2 text-center">Playoff Zone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/40 font-medium">
                          {(theIdolsState.standings || []).map((st, idx) => {
                            const isTop2 = idx < 2;
                            const isUpperQf = idx >= 2 && idx < 6;
                            const isLowerPlayIn = idx >= 6 && idx < 10;

                            return (
                              <tr
                                key={st.idolId}
                                className={`hover:bg-purple-900/20 transition-colors ${
                                  isTop2
                                    ? 'bg-purple-950/40 text-purple-100 font-bold'
                                    : isUpperQf
                                    ? 'bg-indigo-950/30 text-indigo-100'
                                    : isLowerPlayIn
                                    ? 'bg-sky-950/20 text-sky-100'
                                    : 'text-purple-200/70'
                                }`}
                              >
                                <td className="px-3 py-2.5 text-center font-black">
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold border border-black ${
                                      idx === 0
                                        ? 'bg-amber-400 text-black'
                                        : idx === 1
                                        ? 'bg-slate-300 text-black'
                                        : idx === 2
                                        ? 'bg-amber-700 text-white'
                                        : 'bg-black/60 text-purple-200'
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
                                        className="w-7 h-7 rounded-lg object-cover border border-black shrink-0"
                                      />
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-black border border-black flex items-center justify-center text-[10px] font-bold text-purple-300 shrink-0">
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
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {(st.form || []).map((f, fIdx) => (
                                      <span
                                        key={fIdx}
                                        className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center text-black ${
                                          f === 'W'
                                            ? 'bg-emerald-400'
                                            : f === 'D'
                                            ? 'bg-amber-400'
                                            : 'bg-rose-500 text-white'
                                        }`}
                                      >
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {isTop2 ? (
                                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-300 text-[10px] font-black">
                                      Semi-Final Bye
                                    </span>
                                  ) : isUpperQf ? (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 text-[10px] font-black">
                                      Upper QF
                                    </span>
                                  ) : isLowerPlayIn ? (
                                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[10px] font-black">
                                      Lower Play-In
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-bold">
                                      Eliminated
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Masters Playoff Bracket */}
              {theIdolsSubTab === 'playoff' && (
                <div className="space-y-6">
                  {(!theIdolsState.playoffMatches || theIdolsState.playoffMatches.length === 0) ? (
                    <div className="rounded-3xl border-3 border-black bg-[#1a0f21] p-8 text-center text-purple-200/70 font-bold text-sm">
                      Masters Playoff will generate automatically upon conclusion of all 19 Superleague matchdays.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b-2 border-black pb-2">
                        <h4 className="font-poster-title text-base text-yellow-400 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-400" />
                          <span>Masters Double-Elimination Championship Bracket</span>
                        </h4>
                        <span className="text-xs font-bold text-purple-300 bg-purple-900/40 px-3 py-1 rounded-full border border-purple-500/40">
                          Best of 5 &bull; Grand Final Best of 7
                        </span>
                      </div>

                      {/* Playoff Matches Card Grid by Bracket Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {theIdolsState.playoffMatches.map((pm) => {
                          const idolA = pm.idolAId ? idolsMap.get(pm.idolAId) : undefined;
                          const idolB = pm.idolBId ? idolsMap.get(pm.idolBId) : undefined;
                          const aWon = pm.completed && pm.winnerId === pm.idolAId;
                          const bWon = pm.completed && pm.winnerId === pm.idolBId;

                          return (
                            <div
                              key={pm.id}
                              className={`rounded-2xl border-2 border-black p-4 space-y-3 poster-shadow-sm transition-all ${
                                pm.completed
                                  ? 'bg-[#180d1f] border-purple-500/40'
                                  : 'bg-[#130919] border-black'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-black uppercase border-b border-black/60 pb-1.5">
                                <span className="text-purple-300 font-bold">{pm.roundName}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full border text-[9px] ${
                                    pm.completed
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                      : 'bg-black text-amber-400 border-amber-500/30'
                                  }`}
                                >
                                  {pm.completed ? 'Finished' : `Bo${pm.bestOf}`}
                                </span>
                              </div>

                              {/* Competitor A */}
                              <div
                                className={`flex items-center justify-between gap-2 p-2 rounded-xl border border-black/40 ${
                                  aWon
                                    ? 'bg-purple-700/40 text-white font-black ring-1 ring-purple-400'
                                    : 'bg-black/40 text-purple-200/80'
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

                              {/* Competitor B */}
                              <div
                                className={`flex items-center justify-between gap-2 p-2 rounded-xl border border-black/40 ${
                                  bWon
                                    ? 'bg-purple-700/40 text-white font-black ring-1 ring-purple-400'
                                    : 'bg-black/40 text-purple-200/80'
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
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Matchday Download & Export Modal */}
      {showMatchdayDownloadModal && leagueState && (
        <MatchdayDownloadModal
          isOpen={showMatchdayDownloadModal}
          onClose={() => setShowMatchdayDownloadModal(false)}
          idols={idols.length > 0 ? idols : Array.from(idolsMap.values())}
          leagueState={leagueState}
          selectedLeagueId={selectedLeagueId}
          initialMatchday={selectedMatchday}
          seasonNumber={leagueState.seasonNumber || config?.season || 1}
        />
      )}
    </div>
  );
};
