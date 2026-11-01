import React, { useMemo } from 'react';
import type { Idol, GirlGroup, LeagueSeasonState, TournamentConfig, LeagueSeasonArchive, LeagueQualifierEntry, ActiveTab } from '../types';
import type { V5State } from '../utils/v5/store';
import { LeagueSystemPanel } from './LeagueSystemPanel';

interface Props {
  idols: Idol[];
  girlGroups: GirlGroup[];
  config: TournamentConfig;
  v5State: V5State;
  onUpdateV5State: (s: V5State) => void;
  favoriteIdolIds?: string[];
  setActiveTab: (tab: ActiveTab) => void;
  onUpdateFavoriteIdols?: (ids: string[]) => void;
}

/**
 * Division 2 uses the exact same league interface and match controls as Division 1.
 * Its state is adapted to the shared league panel and written back only to V5 D2 storage.
 */
export const DivisionTwoLeaguePanel: React.FC<Props> = ({
  idols, girlGroups, config, v5State, onUpdateV5State, favoriteIdolIds = [], setActiveTab, onUpdateFavoriteIdols,
}) => {
  const leagueState = useMemo<LeagueSeasonState>(() => ({
    seasonNumber: Number(config.seasonNumber || 1),
    seasonName: `${config.seasonName || 'Season'} / Division 2`,
    isStarted: true,
    isCompleted: (v5State.d2 || []).length > 0 && v5State.d2.every((league) => league.isCompleted),
    currentMatchday: 1,
    leagues: v5State.d2 || [],
    postseasonFormat: 'grand_cup_64',
  }), [config.seasonNumber, config.seasonName, v5State.d2]);

  const updateLeagueState = (next: LeagueSeasonState) => {
    onUpdateV5State({ ...v5State, d2: next.leagues.map((league) => ({ ...league, parentLeagueId: (league as any).parentLeagueId })) });
  };

  const noArchives: LeagueSeasonArchive[] = [];
  const noAdvance = (_qualifiers: LeagueQualifierEntry[]) => undefined;

  if (!leagueState.leagues.length) {
    return <div className="mx-auto max-w-7xl rounded-2xl border border-amber-500/30 bg-[#18110c] p-8 text-center text-amber-100">
      <h2 className="text-xl font-black text-amber-300">DIVISION 2 LEAGUE SYSTEM</h2>
      <p className="mt-3 text-sm text-amber-100/70">Division 2 leagues have not been generated. Open Cups & Divisions and use Auto-fill from free idols.</p>
    </div>;
  }

  return <LeagueSystemPanel
    idols={idols}
    girlGroups={girlGroups}
    config={{ ...config, favoriteIdolIds }}
    leagueState={leagueState}
    leagueArchives={noArchives}
    onUpdateLeagueState={updateLeagueState}
    onUpdateLeagueArchives={() => undefined}
    onAdvanceToChampionsTournament={noAdvance}
    setActiveTab={setActiveTab}
    onUpdateFavoriteIdols={onUpdateFavoriteIdols}
    persistState={false}
    divisionLabel="Division 2"
    hidePostseason
    promotionCount={v5State.promotionCount || 3}
  />;
};
