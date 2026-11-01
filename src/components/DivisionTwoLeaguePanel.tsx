import React, { useMemo } from 'react';
import type { Idol, GirlGroup, LeagueSeasonState, TournamentConfig, LeagueSeasonArchive, LeagueQualifierEntry, ActiveTab } from '../types';
import type { V5State } from '../utils/v5/store';
import { loadNames } from '../utils/v5/names';
import * as V5Engine from '../utils/v5/engine';
import { LeagueSystemPanel } from './LeagueSystemPanel';

interface Props {
  idols: Idol[];
  girlGroups: GirlGroup[];
  config: TournamentConfig;
  leagueState: LeagueSeasonState | null;
  onUpdateLeagueState: (state: LeagueSeasonState) => void;
  v5State: V5State;
  onUpdateV5State: (s: V5State) => void;
  favoriteIdolIds?: string[];
  setActiveTab: (tab: ActiveTab) => void;
  onUpdateFavoriteIdols?: (ids: string[]) => void;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * Division 2 uses the same league interface as Division 1.
 * Its roster and match data stay in V5 storage. Promotion/relegation is
 * reviewed here because it directly changes the paired D1/D2 league rosters.
 */
export const DivisionTwoLeaguePanel: React.FC<Props> = ({
  idols,
  girlGroups,
  config,
  leagueState,
  onUpdateLeagueState,
  v5State,
  onUpdateV5State,
  favoriteIdolIds = [],
  setActiveTab,
  onUpdateFavoriteIdols,
}) => {
  const divisionName = loadNames().division2;
  const leagueStateForPanel = useMemo<LeagueSeasonState>(() => ({
    seasonNumber: Number(config.seasonNumber || 1),
    seasonName: `${config.seasonName || 'Season'} / ${divisionName}`,
    isStarted: true,
    isCompleted: (v5State.d2 || []).length > 0 && v5State.d2.every((league) => league.isCompleted),
    currentMatchday: 1,
    leagues: v5State.d2 || [],
    postseasonFormat: 'grand_cup_64',
  }), [config.seasonNumber, config.seasonName, divisionName, v5State.d2]);

  const updateLeagueState = (next: LeagueSeasonState) => {
    onUpdateV5State({
      ...v5State,
      d2: next.leagues.map((league) => ({
        ...league,
        parentLeagueId: (league as any).parentLeagueId,
      })),
    });
  };

  const d1 = leagueState?.leagues || [];
  const d2 = v5State.d2 || [];
  const allLeagueMatchesComplete = (leagues: { matches: Array<{ completed: boolean }> }[]) =>
    leagues.length === 6 && leagues.every((league) => league.matches.length > 0 && league.matches.every((match) => match.completed));
  const d1Done = allLeagueMatchesComplete(d1);
  const d2Done = allLeagueMatchesComplete(d2);
  const d1Fresh = d1.length === 6 && d1.every((league) => league.matches.every((match) => !match.completed));
  const idolsById = useMemo(() => new Map(idols.map((idol) => [idol.id, idol])), [idols]);

  const lockPromotionReview = () => {
    if (!d1Done || !d2Done) return;
    const moves = d1.map((league) => {
      const paired = d2.find((candidate) => candidate.parentLeagueId === league.id);
      return paired
        ? V5Engine.computePromotionRelegation(league, paired, v5State.promotionCount || 3)
        : null;
    });
    if (moves.some((move) => !move)) return;
    onUpdateV5State({ ...v5State, pendingMoves: moves as NonNullable<V5State['pendingMoves']> });
  };

  const applyPromotionReview = () => {
    if (!leagueState || !v5State.pendingMoves || !d1Fresh || d2.length !== 6) return;
    const result = V5Engine.applyMoves(d1, d2, v5State.pendingMoves, idols);
    const seasonNumber = Number(leagueState.seasonNumber || config.seasonNumber || 1);
    const history = [...(v5State.promotionHistory || [])].filter(
      (entry) => Number(entry.seasonNumber) !== seasonNumber
    );
    history.push({
      seasonNumber,
      seasonName: leagueState.seasonName || config.seasonName || `Season ${seasonNumber}`,
      appliedAt: new Date().toISOString(),
      moves: clone(v5State.pendingMoves),
    });
    onUpdateLeagueState({ ...leagueState, leagues: result.d1 as any });
    onUpdateV5State({
      ...v5State,
      d2: result.d2,
      pendingMoves: null,
      promotionHistory: history,
    });
  };

  const promotionReview = (
    <section className="mb-6 rounded-3xl border-2 border-black bg-[#18110b] p-5 text-amber-100 poster-shadow sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-poster-title text-xl font-black text-amber-400">PROMOTION &amp; RELEGATION</h2>
          <p className="mt-1 max-w-3xl text-xs font-semibold text-amber-100/65">
            Review the bottom {v5State.promotionCount || 3} Division 1 idols and top {v5State.promotionCount || 3} {divisionName} idols in each paired league. Lock the results after both divisions finish, then apply them after the next Division 1 season starts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={lockPromotionReview}
            disabled={!d1Done || !d2Done}
            className="rounded-xl border-2 border-black bg-amber-500 px-4 py-2.5 text-xs font-black text-black shadow disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock Review
          </button>
          <button
            type="button"
            onClick={applyPromotionReview}
            disabled={!v5State.pendingMoves || !d1Fresh || d2.length !== 6}
            title={!d1Fresh ? 'Start the new Division 1 season before applying moves.' : ''}
            className="rounded-xl border-2 border-black bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply to New Season
          </button>
        </div>
      </div>

      {!d1Done || !d2Done ? (
        <p className="mt-3 rounded-xl border border-amber-900/70 bg-black/30 px-3 py-2 text-[11px] font-bold text-amber-200/60">
          Review unlocks when all six Division 1 and all six Division 2 leagues have completed every match.
        </p>
      ) : null}

      {v5State.pendingMoves?.length ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {v5State.pendingMoves.map((move) => {
            const sourceLeague = d1.find((league) => league.id === move.leagueId);
            const targetLeague = d2.find((league) => league.parentLeagueId === move.leagueId);
            return (
              <div key={move.leagueId} className="rounded-2xl border border-black bg-black/35 p-3">
                <h3 className="mb-2 truncate text-xs font-black text-amber-300">{sourceLeague?.name || `League ${move.leagueId}`}</h3>
                <p className="text-[10px] font-black uppercase tracking-wide text-rose-300">Relegated to {targetLeague?.name || divisionName}</p>
                <p className="mb-3 text-xs leading-relaxed text-amber-100/80">
                  {move.relegated.map((id) => idolsById.get(id)?.name || id).join(', ') || 'None'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">Promoted to Division 1</p>
                <p className="text-xs leading-relaxed text-amber-100/80">
                  {move.promoted.map((id) => idolsById.get(id)?.name || id).join(', ') || 'None'}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[11px] font-semibold text-amber-100/45">No promotion review has been locked for this season.</p>
      )}
      {v5State.pendingMoves && !d1Fresh ? (
        <p className="mt-3 text-[11px] font-bold text-amber-300/80">The review is locked. Start the next Division 1 season before applying roster changes.</p>
      ) : null}
    </section>
  );

  const noArchives: LeagueSeasonArchive[] = [];
  const noAdvance = (_qualifiers: LeagueQualifierEntry[]) => undefined;

  if (!leagueStateForPanel.leagues.length) {
    return (
      <div className="mx-auto max-w-7xl">
        {promotionReview}
        <div className="rounded-2xl border border-amber-500/30 bg-[#18110c] p-8 text-center text-amber-100">
          <h2 className="text-xl font-black text-amber-300">{divisionName.toUpperCase()} LEAGUE SYSTEM</h2>
          <p className="mt-3 text-sm text-amber-100/70">Division 2 leagues have not been generated. Open Settings, then Division 2 Roster Manager, to generate the six league rosters.</p>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="mt-4 rounded-xl border-2 border-black bg-amber-500 px-4 py-2 text-xs font-black text-black"
          >
            Open Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {promotionReview}
      <LeagueSystemPanel
        idols={idols}
        girlGroups={girlGroups}
        config={{ ...config, favoriteIdolIds }}
        leagueState={leagueStateForPanel}
        leagueArchives={noArchives}
        onUpdateLeagueState={updateLeagueState}
        onUpdateLeagueArchives={() => undefined}
        onAdvanceToChampionsTournament={noAdvance}
        setActiveTab={setActiveTab}
        onUpdateFavoriteIdols={onUpdateFavoriteIdols}
        persistState={false}
        divisionLabel={divisionName}
        hidePostseason
        promotionCount={v5State.promotionCount || 3}
      />
    </div>
  );
};
