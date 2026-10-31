import { Idol, LeagueInfo, LeagueStanding, LeagueMatch } from '../types';
import { calculateLeagueStandings, generateRoundRobinMatches } from './leagueLogic';

export type DivisionTier = 1 | 2;

export interface DivisionTable {
  leagueId: number;
  leagueName: string;
  tier: DivisionTier;
  capacity: number;
  memberIds: string[];
  matches: LeagueMatch[];
  standings: LeagueStanding[];
  championId?: string;
}

export interface DivisionSystemState {
  schemaVersion: 1;
  seasonNumber: number;
  initialized: boolean;
  divisions: DivisionTable[];
  lastMovement?: {
    seasonNumber: number;
    promoted: Array<{ leagueId: number; idolIds: string[] }>;
    relegated: Array<{ leagueId: number; idolIds: string[] }>;
  };
}

export const DIVISION_TWO_CAPACITY = 20;
export const DIVISION_TWO_INITIAL_SIZE = 10;
export const PROMOTION_SLOTS = 3;
export const RELEGATION_SLOTS = 3;

/** Creates an independent D1 and D2 for each of the six existing leagues.
 * Existing D1 rosters remain untouched. D2 starts empty and is populated through
 * the league roster workflow. No unassigned idols are silently allocated.
 */
export function initializeDivisionSystem(
  leagues: LeagueInfo[],
  idols: Idol[],
  seasonNumber = 1,
  previous?: DivisionSystemState | null
): DivisionSystemState {
  const existing = previous?.schemaVersion === 1 ? previous : null;
  const activeIds = new Set(idols.filter((idol) => !idol.inactive).map((idol) => idol.id));
  const assigned = new Set((leagues || []).flatMap((league) => league.memberIds || []));
  const divisions: DivisionTable[] = [];

  (leagues || []).forEach((league) => {
    const savedD2 = existing?.divisions.find((division) => division.leagueId === league.id && division.tier === 2);
    const d2Ids = savedD2
      ? savedD2.memberIds.filter((id) => activeIds.has(id) && !assigned.has(id))
      : [];

    d2Ids.forEach((id) => assigned.add(id));
    divisions.push({
      leagueId: league.id,
      leagueName: league.name,
      tier: 1,
      capacity: 20,
      memberIds: [...(league.memberIds || [])].filter((id) => activeIds.has(id)),
      matches: league.matches || [],
      standings: league.standings || [],
    });
    divisions.push({
      leagueId: league.id,
      leagueName: league.name,
      tier: 2,
      capacity: DIVISION_TWO_CAPACITY,
      memberIds: d2Ids.slice(0, DIVISION_TWO_CAPACITY),
      matches: savedD2?.matches || [],
      standings: savedD2?.standings || [],
    });
  });

  return {
    schemaVersion: 1,
    seasonNumber,
    initialized: true,
    divisions,
  };
}

export function updateDivisionStandings(state: DivisionSystemState, idols: Idol[]): DivisionSystemState {
  return {
    ...state,
    divisions: state.divisions.map((division) => ({
      ...division,
      standings: calculateLeagueStandings(
        division.leagueId * 10 + division.tier,
        division.memberIds,
        division.matches,
        idols
      ),
    })),
  };
}

/** Generates fixtures independently for every division using its own roster. */
export function generateDivisionFixtures(state: DivisionSystemState): DivisionSystemState {
  if (state.divisions.some((division) => division.matches.some((match) => match.completed))) return state;
  return {
    ...state,
    divisions: state.divisions.map((division) => ({
      ...division,
      matches: generateRoundRobinMatches(
        division.leagueId * 10 + division.tier,
        division.memberIds
      ),
      standings: [],
      championId: undefined,
    })),
  };
}

/** Applies three-up/three-down movement within each league at season rollover.
 * No idol moves between different league identities. Movement is skipped unless
 * both tiers have completed standings and at least three ranked entrants.
 */
export function applyPromotionRelegation(
  state: DivisionSystemState,
  nextSeasonNumber: number
): DivisionSystemState {
  const promoted: Array<{ leagueId: number; idolIds: string[] }> = [];
  const relegated: Array<{ leagueId: number; idolIds: string[] }> = [];

  const divisions = state.divisions.map((division) => ({ ...division, memberIds: [...division.memberIds] }));
  for (let leagueId = 1; leagueId <= 6; leagueId += 1) {
    const d1 = divisions.find((division) => division.leagueId === leagueId && division.tier === 1);
    const d2 = divisions.find((division) => division.leagueId === leagueId && division.tier === 2);
    if (!d1 || !d2 || d1.standings.length < 3 || d2.standings.length < 3) continue;

    const down = d1.standings.slice(-RELEGATION_SLOTS).map((row) => row.idolId);
    const up = d2.standings.slice(0, PROMOTION_SLOTS).map((row) => row.idolId);
    if (down.length !== 3 || up.length !== 3) continue;

    d1.memberIds = d1.memberIds.filter((id) => !down.includes(id)).concat(up);
    d2.memberIds = d2.memberIds.filter((id) => !up.includes(id)).concat(down);
    promoted.push({ leagueId, idolIds: up });
    relegated.push({ leagueId, idolIds: down });
  }

  return {
    schemaVersion: 1,
    seasonNumber: nextSeasonNumber,
    initialized: true,
    divisions: divisions.map((division) => ({
      ...division,
      matches: [],
      standings: [],
      championId: undefined,
    })),
    lastMovement: {
      seasonNumber: state.seasonNumber,
      promoted,
      relegated,
    },
  };
}

export function validateDivisionSystem(state: DivisionSystemState, idols: Idol[]): string[] {
  const errors: string[] = [];
  const knownIds = new Set(idols.map((idol) => idol.id));
  const seen = new Set<string>();
  for (const division of state.divisions) {
    if (division.tier === 2 && division.memberIds.length > DIVISION_TWO_CAPACITY) {
      errors.push(`${division.leagueName} D2 exceeds its 20-idol capacity.`);
    }
    for (const id of division.memberIds) {
      if (!knownIds.has(id)) errors.push(`Unknown idol ID in ${division.leagueName} D${division.tier}: ${id}`);
      if (seen.has(id)) errors.push(`Idol assigned to more than one division: ${id}`);
      seen.add(id);
    }
  }
  return errors;
}
