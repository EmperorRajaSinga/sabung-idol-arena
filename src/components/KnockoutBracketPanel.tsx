import React, { useState } from 'react';
import { KnockoutMatch, Idol, TournamentConfig } from '../types';
import { MatchModal } from './MatchModal';
import { ManualBracketModal } from './ManualBracketModal';
import { ResetSeasonModal } from './ResetSeasonModal';
import { KnockoutLiveSimulatorModal } from './KnockoutLiveSimulatorModal';
import { TournamentBracketTree } from './TournamentBracketTree';
import { RatingBadge } from './RatingBadge';
import { Swords, Crown, Sparkles, Edit3, RotateCcw, FastForward, Radio } from 'lucide-react';

interface KnockoutBracketPanelProps {
  knockoutMatches: KnockoutMatch[];
  idolsMap: Map<string, Idol>;
  config: TournamentConfig;
  onUpdateKnockoutMatch: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winnerId: string
  ) => void;
  onCrownChampionAndArchive: () => void;
  onSaveKnockoutMatches?: (updatedMatches: KnockoutMatch[]) => void;
  onRegenerateAutoBracket?: () => void;
  onResetCurrentSeason?: () => void;
  onResetKnockoutOnly?: () => void;
  onResetSingleKnockoutMatch?: (matchId: string) => void;
  onSimulateAllMatches?: () => void;
}

export const KnockoutBracketPanel: React.FC<KnockoutBracketPanelProps> = ({
  knockoutMatches,
  idolsMap,
  config,
  onUpdateKnockoutMatch,
  onCrownChampionAndArchive,
  onSaveKnockoutMatches,
  onRegenerateAutoBracket,
  onResetCurrentSeason,
  onResetKnockoutOnly,
  onResetSingleKnockoutMatch,
  onSimulateAllMatches,
}) => {
  const [selectedMatch, setSelectedMatch] = useState<KnockoutMatch | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [isLiveSimulcastOpen, setIsLiveSimulcastOpen] = useState<boolean>(false);

  if (!knockoutMatches || knockoutMatches.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-12 text-center space-y-4 animate-in fade-in">
        <Swords className="h-12 w-12 text-purple-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Knockout Bracket Not Built Yet</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Complete the Group Stage and click &quot;Finalize Group Stage &amp; Build Knockout Bracket&quot; to launch the elimination tree.
        </p>
      </div>
    );
  }

  const grandFinalMatch = knockoutMatches.find(
    (m) =>
      !m.isThirdPlaceMatch &&
      !(m.roundName || '').toLowerCase().includes('3rd') &&
      !(m.roundName || '').toLowerCase().includes('third') &&
      !(m.roundName || '').toLowerCase().includes('bronze') &&
      ((m.roundName || '').toLowerCase().includes('grand final') ||
        (m.roundName || '').toLowerCase() === 'final' ||
        ((m.roundName || '').toLowerCase().includes('final') &&
          !(m.roundName || '').toLowerCase().includes('semi') &&
          !(m.roundName || '').toLowerCase().includes('quarter')))
  );

  const thirdPlaceMatch = knockoutMatches.find(
    (m) =>
      Boolean(m.isThirdPlaceMatch) ||
      (m.roundName || '').toLowerCase().includes('3rd') ||
      (m.roundName || '').toLowerCase().includes('third') ||
      (m.roundName || '').toLowerCase().includes('bronze')
  );

  const championIdol = grandFinalMatch?.winnerId
    ? idolsMap.get(grandFinalMatch.winnerId)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <Swords className="h-6 w-6 text-purple-400" />
              <span>Knockout Stage Championship Bracket</span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Click any match box to enter match scores and advance the winner. Connector lines trace feeder paths between rounds.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!grandFinalMatch?.completed && (
            <button
              onClick={() => setIsLiveSimulcastOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 border-2 border-black px-4 py-2.5 text-xs font-black text-white hover:scale-105 transition-all poster-shadow-sm shadow-[0_0_15px_rgba(168,85,247,0.4)]"
              title="Launch Live Knockout Stage Multi-Series Simulcast"
            >
              <Radio className="h-4 w-4 text-white animate-pulse" />
              <span>Live Simulcast</span>
            </button>
          )}

          {onSimulateAllMatches && !grandFinalMatch?.completed && (
            <button
              onClick={onSimulateAllMatches}
              className="flex items-center gap-1.5 rounded-xl poster-pill-gold border-2 border-black px-4 py-2.5 text-xs font-black text-black hover:scale-105 transition-all poster-shadow-sm"
              title="Simulate all uncompleted knockout matches through to the Grand Final"
            >
              <FastForward className="h-4 w-4 text-black fill-black" />
              <span>Simulate All Matches</span>
            </button>
          )}

          {(onResetKnockoutOnly || onResetCurrentSeason) && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#241710] border-2 border-amber-600/70 px-3.5 py-2.5 text-xs font-black text-amber-300 hover:bg-amber-950/60 transition-all poster-shadow-sm"
              title="Reset knockout match scores and bracket"
            >
              <RotateCcw className="h-4 w-4 text-amber-400" />
              <span>Reset Bracket / Matches</span>
            </button>
          )}

          {onSaveKnockoutMatches && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 px-4 py-2.5 text-xs font-bold text-purple-300 hover:bg-slate-700 transition-all"
            >
              <Edit3 className="h-4 w-4 text-purple-400" />
              <span>Edit Bracket Manually</span>
            </button>
          )}

          {grandFinalMatch?.completed && championIdol && (
            <button
              onClick={onCrownChampionAndArchive}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 px-6 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
            >
              <Crown className="h-4 w-4 fill-slate-950" />
              <span>Archive Season &amp; Crown Champion</span>
            </button>
          )}
        </div>
      </div>

      {/* Champion Banner if completed */}
      {championIdol && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 p-6 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-amber-400 shadow-xl ring-4 ring-amber-400/20 bg-black flex items-center justify-center">
              {championIdol.photoUrl ? (
                <img
                  src={championIdol.photoUrl}
                  alt={championIdol.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="font-poster-title text-2xl text-amber-300">
                  {championIdol.name.slice(0, 2)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  {config?.seasonName || `Season ${config?.seasonNumber || 1}`} Champion
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <h3 className="text-2xl font-black text-white">
                  {championIdol.name}
                </h3>
                <RatingBadge idol={championIdol} size="sm" showTier={true} />
              </div>
              <p className="text-xs font-bold text-slate-300">
                {championIdol.girlGroup} &bull; {championIdol.nationality}
              </p>
            </div>
          </div>

          <Sparkles className="h-12 w-12 text-amber-300 animate-pulse hidden md:block" />
        </div>
      )}

      {/* Interactive Bracket Tree Component */}
      <TournamentBracketTree
        knockoutMatches={knockoutMatches}
        idolsMap={idolsMap}
        onSelectMatch={(match) => setSelectedMatch(match)}
        showTitleHeader={true}
      />

      {/* Manual Bracket Modal Editor */}
      {isManualModalOpen && onSaveKnockoutMatches && (
        <ManualBracketModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          knockoutMatches={knockoutMatches}
          idolsMap={idolsMap}
          onSaveKnockoutMatches={onSaveKnockoutMatches}
          onRegenerateAutoBracket={() => {
            if (onRegenerateAutoBracket) {
              onRegenerateAutoBracket();
            }
          }}
        />
      )}

      {/* Match Modal */}
      {selectedMatch && (() => {
        const isThirdPlaceMatch =
          Boolean(selectedMatch.isThirdPlaceMatch) ||
          selectedMatch.roundName?.toLowerCase().includes('3rd') ||
          selectedMatch.roundName?.toLowerCase().includes('third') ||
          selectedMatch.roundName?.toLowerCase().includes('bronze');

        const isGrandFinalMatch =
          !isThirdPlaceMatch &&
          (selectedMatch.roundName?.toLowerCase().includes('grand final') ||
            selectedMatch.roundName?.toLowerCase() === 'final' ||
            (selectedMatch.roundName?.toLowerCase().includes('final') &&
              !selectedMatch.roundName?.toLowerCase().includes('semi') &&
              !selectedMatch.roundName?.toLowerCase().includes('quarter')));

        const getKnockoutFormHistory = (idolId?: string | null): Array<'W' | 'D' | 'L'> => {
          if (!idolId) return [];
          const form: Array<'W' | 'D' | 'L'> = [];
          (knockoutMatches || []).forEach((m) => {
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
          return form.slice(-5);
        };

        const formA = getKnockoutFormHistory(selectedMatch.idolAId);
        const formB = getKnockoutFormHistory(selectedMatch.idolBId);

        return (
          <MatchModal
            isOpen={!!selectedMatch}
            onClose={() => setSelectedMatch(null)}
            idolA={idolsMap.get(selectedMatch.idolAId || '') || null}
            idolB={idolsMap.get(selectedMatch.idolBId || '') || null}
            currentScoreA={selectedMatch.scoreA}
            currentScoreB={selectedMatch.scoreB}
            formHistoryA={formA}
            formHistoryB={formB}
            matchTitle={`${selectedMatch.roundName} - Match ${selectedMatch.matchNumber}`}
            stageName={
              isGrandFinalMatch
                ? 'Grand Final'
                : isThirdPlaceMatch
                ? '3rd Place Playoff'
                : selectedMatch.roundName || 'Knockout Stage'
            }
            isKnockout={true}
            isGrandFinal={isGrandFinalMatch}
            isThirdPlace={isThirdPlaceMatch}
            isCompleted={selectedMatch.completed}
            favoriteIdolIds={config.favoriteIdolIds}
            onResetMatch={
              onResetSingleKnockoutMatch
                ? () => {
                    onResetSingleKnockoutMatch(selectedMatch.id);
                  }
                : undefined
            }
            onFinish={(scoreA, scoreB, winnerId) => {
              onUpdateKnockoutMatch(selectedMatch.id, scoreA, scoreB, winnerId);
            }}
          />
        );
      })()}

      {/* Reset Season Dialog */}
      <ResetSeasonModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        seasonName={config.seasonName || `Season ${config.seasonNumber || 1}`}
        hasGroups={true}
        hasKnockout={true}
        onResetEntireSeason={() => {
          if (onResetCurrentSeason) onResetCurrentSeason();
        }}
        onResetKnockoutOnly={onResetKnockoutOnly}
      />

      {/* Live Knockout Simulcast Modal */}
      <KnockoutLiveSimulatorModal
        isOpen={isLiveSimulcastOpen}
        onClose={() => setIsLiveSimulcastOpen(false)}
        knockoutMatches={knockoutMatches}
        idolsMap={idolsMap}
        config={config}
        onCommitMatches={(updated) => {
          if (onSaveKnockoutMatches) {
            onSaveKnockoutMatches(updated);
          } else {
            updated.forEach((m) => {
              if (m.completed && m.scoreA !== null && m.scoreB !== null && m.winnerId) {
                onUpdateKnockoutMatch(m.id, m.scoreA, m.scoreB, m.winnerId);
              }
            });
          }
        }}
      />
    </div>
  );
};

