import React, { useState } from 'react';
import { Group, GroupMatch, Idol, TournamentConfig } from '../types';
import { MatchModal } from './MatchModal';
import { ManualGroupModal } from './ManualGroupModal';
import { ResetSeasonModal } from './ResetSeasonModal';
import { GroupLiveSimulatorModal } from './GroupLiveSimulatorModal';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import { calculateGroupStandings } from '../utils/tournamentLogic';
import { Table, Swords, CheckCircle, ArrowRight, Users, RotateCcw, FastForward, Play, Radio, Flame, Sparkles, Download } from 'lucide-react';
import { MatchdayDownloadModal } from './MatchdayDownloadModal';

interface GroupStagePanelProps {
  groups: Group[];
  idolsMap: Map<string, Idol>;
  config: TournamentConfig;
  onUpdateGroupMatch: (
    groupId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string
  ) => void;
  onFinalizeGroupStageAndBuildKnockout: () => void;
  onSaveGroups?: (updatedGroups: Group[]) => void;
  onResetCurrentSeason?: () => void;
  onResetGroupScoresOnly?: () => void;
  onResetSingleGroupMatch?: (groupId: string, matchId: string) => void;
  onSimulateAllMatches?: () => void;
}

export const GroupStagePanel: React.FC<GroupStagePanelProps> = ({
  groups,
  idolsMap,
  config,
  onUpdateGroupMatch,
  onFinalizeGroupStageAndBuildKnockout,
  onSaveGroups,
  onResetCurrentSeason,
  onResetGroupScoresOnly,
  onResetSingleGroupMatch,
  onSimulateAllMatches,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<{
    groupId: string;
    groupName: string;
    match: GroupMatch;
  } | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isLiveSimulcastOpen, setIsLiveSimulcastOpen] = useState<boolean>(false);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

  const safeGroups = groups || [];
  const [activeGroupTab, setActiveGroupTab] = useState<string>(
    safeGroups[0]?.id || 'group-0'
  );

  const currentGroup = safeGroups.find((g) => g.id === activeGroupTab) || safeGroups[0];

  const totalMatchesCount = safeGroups.reduce((acc, g) => acc + (g?.matches?.length || 0), 0);
  const completedMatchesCount = safeGroups.reduce(
    (acc, g) => acc + (g?.matches ? g.matches.filter((m) => m?.completed).length : 0),
    0
  );

  const isAllMatchesCompleted =
    totalMatchesCount > 0 && completedMatchesCount === totalMatchesCount;

  // Helper to compute form history for any idol across all completed group matches
  const getGroupFormHistory = (idolId: string): Array<'W' | 'D' | 'L'> => {
    if (!idolId) return [];
    const form: Array<'W' | 'D' | 'L'> = [];
    safeGroups.forEach((g) => {
      (g.matches || []).forEach((m) => {
        if (m.completed && m.scoreA !== null && m.scoreB !== null) {
          if (m.idolAId === idolId) {
            if (m.scoreA > m.scoreB) form.push('W');
            else if (m.scoreA < m.scoreB) form.push('L');
            else form.push('D');
          } else if (m.idolBId === idolId) {
            if (m.scoreB > m.scoreA) form.push('W');
            else if (m.scoreB < m.scoreA) form.push('L');
            else form.push('D');
          }
        }
      });
    });
    return form.slice(-5);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
              <Table className="h-7 w-7 text-amber-400" />
              <span>Group Stage Round-Robin</span>
            </h2>
            <span className="rounded-full poster-pill-gold px-3 py-1 text-xs font-black">
              {completedMatchesCount} / {totalMatchesCount} Completed
            </span>
          </div>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Click any match row to open score input popup. Standings follow priority: Points &rarr; Game Diff &rarr; Game Score For &rarr; Head to Head. Form & Momentum is dynamically tracked.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isAllMatchesCompleted && (
            <button
              onClick={() => setIsLiveSimulcastOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 border-2 border-black px-4 py-2.5 text-xs font-black text-white hover:scale-105 transition-all poster-shadow-sm shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              title="Launch Live Group Stage Multi-Pitch Simulcast"
            >
              <Radio className="h-4 w-4 text-white animate-pulse" />
              <span>Live Simulcast</span>
            </button>
          )}

          {onSimulateAllMatches && !isAllMatchesCompleted && (
            <button
              onClick={onSimulateAllMatches}
              className="flex items-center gap-1.5 rounded-xl poster-pill-gold border-2 border-black px-4 py-2.5 text-xs font-black text-black hover:scale-105 transition-all poster-shadow-sm"
              title="Simulate all uncompleted group stage matches at once"
            >
              <FastForward className="h-4 w-4 text-black fill-black" />
              <span>Simulate All Matches</span>
            </button>
          )}

          {onResetGroupScoresOnly && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#241710] border-2 border-amber-600/70 px-3.5 py-2.5 text-xs font-black text-amber-300 hover:bg-amber-950/60 transition-all poster-shadow-sm"
              title="Reset match scores while keeping group draws intact"
            >
              <RotateCcw className="h-4 w-4 text-amber-400" />
              <span>Reset Matches</span>
            </button>
          )}

          {onSaveGroups && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#282018] border-2 border-black px-4 py-2.5 text-xs font-black text-amber-200 hover:bg-red-950 transition-all poster-shadow-sm"
            >
              <Users className="h-4 w-4 text-amber-300" />
              <span>Edit Groups Manually</span>
            </button>
          )}

          <button
            onClick={onFinalizeGroupStageAndBuildKnockout}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition-all ${
              config.isGroupStageFinished
                ? 'bg-[#282018] text-amber-200/60 border-2 border-black poster-shadow-sm'
                : 'poster-pill-red hover:scale-105'
            }`}
          >
            <Swords className="h-4 w-4 text-amber-300" />
            <span>
              {config.isGroupStageFinished
                ? 'Knockout Bracket Finalized'
                : 'Finalize Group Stage & Build Knockout Bracket'}
            </span>
          </button>
        </div>
      </div>

      {/* Group Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {groups.map((g) => {
          const isDone = g.matches.every((m) => m.completed);
          const isActive = activeGroupTab === g.id;

          return (
            <button
              key={g.id}
              onClick={() => setActiveGroupTab(g.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-poster-body font-black border-2 border-black transition-all poster-shadow-sm ${
                isActive
                  ? 'poster-pill-gold text-amber-950 shadow-md scale-105'
                  : 'bg-[#1a120c] text-amber-200/70 hover:text-white hover:bg-[#251912]'
              }`}
            >
              <span>{g.name}</span>
              {isDone && (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {currentGroup && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Group Standings Table */}
          <div className="rounded-3xl border-3 border-black bg-[#1a120c] p-5 space-y-4 poster-shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-3 gap-1">
              <div>
                <h3 className="font-poster-title text-base text-amber-300">
                  {currentGroup.name} Standings
                </h3>
                <p className="text-[10px] text-amber-200/70 font-bold">
                  Points: <span className="text-emerald-400 font-bold">3 PTS</span> for Win, <span className="text-amber-400 font-bold">1 PT</span> for Draw, <span className="text-amber-200/50">0 PTS</span> for Loss
                </p>
              </div>
              <span className="text-xs text-amber-400 font-black font-mono bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-500/30">
                Top {config.qualifiedPerGroup} Advance to Knockouts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#120b07] text-[10px] font-black uppercase tracking-wider text-amber-200/70 border-b-2 border-black">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Rank</th>
                    <th className="px-3 py-2.5">Participant</th>
                    <th className="px-2 py-2.5 text-center">P</th>
                    <th className="px-2 py-2.5 text-center text-emerald-400">W</th>
                    <th className="px-2 py-2.5 text-center text-amber-400">D</th>
                    <th className="px-2 py-2.5 text-center text-rose-400">L</th>
                    <th className="px-2 py-2.5 text-center">GF-GA</th>
                    <th className="px-2 py-2.5 text-center">Diff</th>
                    <th className="px-3 py-2.5 text-center font-black text-amber-400">PTS</th>
                    <th className="px-3 py-2.5 text-center">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/60 font-medium">
                  {currentGroup.standings.map((st) => {
                    const idol = idolsMap.get(st.idolId);
                    if (!idol) return null;

                    const idolForm = getGroupFormHistory(st.idolId);
                    const isAdvancing = st.rank <= config.qualifiedPerGroup;

                    return (
                      <tr
                        key={st.idolId}
                        className={`transition-colors ${
                          isAdvancing
                            ? 'bg-amber-950/20 text-white font-bold'
                            : 'text-amber-200/80 hover:bg-[#22160e]'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-lg text-[10px] font-mono font-black border ${
                              isAdvancing
                                ? 'bg-amber-500 text-amber-950 border-amber-400'
                                : 'bg-black/60 text-amber-200/60 border-black'
                            }`}
                          >
                            {st.rank}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {idol.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="h-7 w-7 rounded-xl object-cover border-2 border-black"
                              />
                            ) : (
                              <div className="h-7 w-7 rounded-xl bg-[#281b12] border-2 border-black flex items-center justify-center text-[10px] font-bold text-amber-200">
                                {idol.name.slice(0, 1)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-amber-200 leading-tight">
                                  {idol.name}
                                </span>
                                <RatingBadge idol={idol} size="xs" showTier={true} />
                              </div>
                              <span className="text-[9px] text-amber-200/50 font-bold">
                                {idol.girlGroup}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-amber-200/70">{st.played}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold text-emerald-400">{st.wins}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold text-amber-400">{st.draws}</td>
                        <td className="px-2 py-2.5 text-center font-mono font-bold text-rose-400">{st.losses}</td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px] text-amber-200/60">
                          {st.gamesFor}-{st.gamesAgainst}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-[11px] font-bold text-amber-300">
                          {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-black text-sm text-amber-400">
                          {st.points}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center">
                            <FormBadge
                              formHistory={idolForm}
                              size="xs"
                              showStreak={false}
                              showModifier={false}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Group Matches Schedule */}
          <div className="rounded-3xl border-3 border-black bg-[#1a120c] p-5 space-y-4 poster-shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="font-poster-title text-base text-amber-300">
                  {currentGroup.name} Match Schedule
                </h3>
                <span className="text-[11px] text-amber-200/60 font-bold">
                  All 6 matches visible • Click match to enter score
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDownloadModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all poster-shadow-sm hover:scale-105"
                  title="Download Group Fixtures Card (PNG/CSV/Text)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* All Matches Visible - Clean 1-Column Layout, No Scrolling Box */}
            <div className="space-y-2.5">
              {currentGroup.matches.map((m) => {
                const idolA = idolsMap.get(m.idolAId);
                const idolB = idolsMap.get(m.idolBId);

                if (!idolA || !idolB) return null;

                const formA = getGroupFormHistory(m.idolAId);
                const formB = getGroupFormHistory(m.idolBId);

                return (
                  <div
                    key={m.id}
                    onClick={() =>
                      setSelectedMatch({
                        groupId: currentGroup.id,
                        groupName: currentGroup.name,
                        match: m,
                      })
                    }
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border-2 border-black bg-[#140b07] hover:border-amber-500/50 hover:bg-[#20120a] cursor-pointer transition-all group poster-shadow-sm gap-2 sm:gap-3"
                  >
                    {/* Idol A */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {idolA.photoUrl ? (
                        <img
                          src={idolA.photoUrl}
                          alt={idolA.name}
                          className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl object-cover border-2 border-black shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-[#281b12] border-2 border-black flex items-center justify-center text-xs font-bold text-amber-200 shrink-0">
                          {idolA.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs sm:text-sm text-amber-200 truncate">
                            {idolA.name}
                          </span>
                          <RatingBadge idol={idolA} size="xs" showTier={false} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-amber-200/50 font-bold truncate max-w-[90px] sm:max-w-none">
                            {idolA.girlGroup}
                          </span>
                          <FormBadge formHistory={formA} size="xs" showStreak={false} showModifier={false} />
                        </div>
                      </div>
                    </div>

                    {/* Score / Status Pill */}
                    <div className="flex flex-col items-center justify-center px-1 shrink-0">
                      {m.completed ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="rounded-xl bg-[#1c120a] px-3 py-1 font-mono text-xs sm:text-sm font-black text-amber-300 border-2 border-black shadow-sm flex items-center gap-1.5">
                            {m.scoreA} - {m.scoreB}
                          </span>
                          {m.scoreA === m.scoreB && (
                            <span className="text-[8px] uppercase font-black tracking-wider text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                              DRAW
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="rounded-xl poster-pill-gold px-3 py-1 text-[10px] sm:text-xs font-black text-amber-950 border-2 border-black group-hover:scale-105 transition-all">
                          PLAY
                        </span>
                      )}
                    </div>

                    {/* Idol B */}
                    <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
                      <div className="truncate flex-1 min-w-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <RatingBadge idol={idolB} size="xs" showTier={false} />
                          <span className="font-black text-xs sm:text-sm text-amber-200 truncate">
                            {idolB.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-[10px] text-amber-200/50 font-bold truncate max-w-[90px] sm:max-w-none">
                            {idolB.girlGroup}
                          </span>
                          <FormBadge formHistory={formB} size="xs" showStreak={false} showModifier={false} />
                        </div>
                      </div>
                      {idolB.photoUrl ? (
                        <img
                          src={idolB.photoUrl}
                          alt={idolB.name}
                          className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl object-cover border-2 border-black shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-[#281b12] border-2 border-black flex items-center justify-center text-xs font-bold text-amber-200 shrink-0">
                          {idolB.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Manual Group Editor Modal */}
      {isManualModalOpen && onSaveGroups && (
        <ManualGroupModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          groups={groups}
          idolsMap={idolsMap}
          onSaveGroups={onSaveGroups}
        />
      )}

      {/* Score Modal Popup */}
      {selectedMatch && (() => {
        const formA = getGroupFormHistory(selectedMatch.match.idolAId);
        const formB = getGroupFormHistory(selectedMatch.match.idolBId);

        return (
          <MatchModal
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
            idolA={idolsMap.get(selectedMatch.match.idolAId) || null}
            idolB={idolsMap.get(selectedMatch.match.idolBId) || null}
            currentScoreA={selectedMatch.match.scoreA}
            currentScoreB={selectedMatch.match.scoreB}
            formHistoryA={formA}
            formHistoryB={formB}
            matchTitle={`${selectedMatch.groupName} - Round ${selectedMatch.match.round}`}
            stageName="Group Stage"
            isKnockout={false}
            isCompleted={selectedMatch.match.completed}
            favoriteIdolIds={config.favoriteIdolIds}
            onResetMatch={
              onResetSingleGroupMatch
                ? () => {
                    onResetSingleGroupMatch(
                      selectedMatch.groupId,
                      selectedMatch.match.id
                    );
                  }
                : undefined
            }
            onFinish={(scoreA, scoreB, winnerId) => {
              onUpdateGroupMatch(
                selectedMatch.groupId,
                selectedMatch.match.id,
                scoreA,
                scoreB,
                winnerId
              );
            }}
          />
        );
      })()}

      {/* Reset Season Dialog */}
      <ResetSeasonModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        seasonName={config.seasonName || `Season ${config.seasonNumber || 1}`}
        hasGroups={groups.length > 0}
        hasKnockout={config.isGroupStageFinished}
        onResetEntireSeason={() => {
          if (onResetCurrentSeason) onResetCurrentSeason();
        }}
        onResetGroupScoresOnly={onResetGroupScoresOnly}
      />

      {/* Live Simulcast Broadcast Modal */}
      <GroupLiveSimulatorModal
        isOpen={isLiveSimulcastOpen}
        onClose={() => setIsLiveSimulcastOpen(false)}
        groups={groups}
        activeGroupId={activeGroupTab}
        idolsMap={idolsMap}
        favoriteIdolIds={config.favoriteIdolIds}
        onCommitMatches={(results) => {
          if (onSaveGroups) {
            const resultMap = new Map<string, { scoreA: number; scoreB: number; winnerId: string }>();
            results.forEach((r) => resultMap.set(r.matchId, r));

            const updatedGroups = groups.map((g) => {
              let changed = false;
              const updatedMatches = (g.matches || []).map((m) => {
                const res = resultMap.get(m.id);
                if (res) {
                  changed = true;
                  return {
                    ...m,
                    scoreA: res.scoreA,
                    scoreB: res.scoreB,
                    completed: true,
                    winnerId: res.winnerId || (res.scoreA === res.scoreB ? 'draw' : res.scoreA > res.scoreB ? m.idolAId : m.idolBId),
                    updatedAt: new Date().toISOString(),
                  };
                }
                return m;
              });

              if (changed) {
                const standings = calculateGroupStandings(
                  g.memberIds,
                  updatedMatches,
                  config.qualifiedPerGroup
                );
                return {
                  ...g,
                  matches: updatedMatches,
                  standings,
                };
              }
              return g;
            });

            onSaveGroups(updatedGroups);
          } else {
            results.forEach((r) => {
              onUpdateGroupMatch(r.groupId, r.matchId, r.scoreA, r.scoreB, r.winnerId);
            });
          }
        }}
      />
      {/* Group Fixtures Download Modal */}
      {showDownloadModal && (
        <MatchdayDownloadModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          idols={Array.from(idolsMap.values())}
          customTitle={`${currentGroup.name} Fixtures`}
          customMatches={currentGroup.matches.map((m) => ({
            id: m.id,
            matchday: m.round || 1,
            idolAId: m.idolAId,
            idolBId: m.idolBId,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            completed: m.completed,
            winnerId: m.winnerId,
          }))}
          customTotalMatchdays={3}
          initialMatchday={1}
          seasonNumber={config?.season || 1}
        />
      )}
    </div>
  );
};
