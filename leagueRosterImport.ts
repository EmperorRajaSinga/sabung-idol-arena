import type { Idol, GirlGroup, LeagueSeasonState } from '../types';
import { initializeLeagueSeason, generateRoundRobinMatches, calculateLeagueStandings } from './leagueLogic';

export interface LeagueRosterImportReport {
  leaguesUpdated: number;
  rosterSizes: number[];
  rebuiltFixtures: number[];
  unknownEntries: string[];
  duplicateEntries: string[];
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Applies a "League Branding & Rosters" file to the league state.
 * - Works even when no league season exists yet (a fresh 6-league season is created).
 * - Accepts idol IDs, or idol names (optionally with girl group) when IDs do not match.
 * - An idol can sit in one league only (first listing wins). Unknown names are reported, never silently dropped.
 * - When a roster changes, that league's fixtures and standings are rebuilt, so the roster shows everywhere.
 */
export function applyLeagueRosterImport(
  leagueState: LeagueSeasonState | null | undefined,
  data: any,
  idols: Idol[],
  girlGroups: GirlGroup[],
  seasonNumber = 1
): { state: LeagueSeasonState; report: LeagueRosterImportReport } {
  const base: LeagueSeasonState = leagueState && Array.isArray(leagueState.leagues) && leagueState.leagues.length > 0
    ? leagueState
    : (initializeLeagueSeason(idols, girlGroups, seasonNumber) as LeagueSeasonState);

  const byId = new Map<string, Idol>();
  const byName = new Map<string, Idol[]>();
  idols.forEach((i) => {
    byId.set(i.id, i);
    const k = norm(i.name);
    byName.set(k, [...(byName.get(k) || []), i]);
  });

  const resolve = (entry: any): Idol | null => {
    if (entry == null) return null;
    if (typeof entry === 'string') return byId.get(entry) || (byName.get(norm(entry)) || [])[0] || null;
    const id = entry.id ?? entry.idolId;
    if (id && byId.get(id)) return byId.get(id)!;
    const cands = byName.get(norm(entry.name)) || [];
    if (cands.length <= 1) return cands[0] || null;
    return cands.find((c) => norm(c.girlGroup) === norm(entry.girlGroup)) || cands[0];
  };

  const divisions: any[] = Array.isArray(data?.divisions) ? data.divisions : [];
  const hasDivisionIds = divisions.some((d) => (d.leagueId ?? d.id) !== undefined);
  const report: LeagueRosterImportReport = { leaguesUpdated: 0, rosterSizes: [], rebuiltFixtures: [], unknownEntries: [], duplicateEntries: [] };
  const placed = new Set<string>();

  const leagues = base.leagues.map((l: any, idx: number) => {
    const d = hasDivisionIds ? divisions.find((x) => Number(x.leagueId ?? x.id) === Number(l.id)) : divisions[idx];
    if (!d) { report.rosterSizes.push((l.memberIds || []).length); return l; }

    const rawList: any[] = Array.isArray(d.memberIds) && d.memberIds.length > 0 ? d.memberIds
      : Array.isArray(d.roster) && d.roster.length > 0 ? d.roster : [];
    const ids: string[] = [];
    rawList.forEach((entry) => {
      const idol = resolve(entry);
      if (!idol) { report.unknownEntries.push(typeof entry === 'string' ? entry : String(entry?.name || entry?.id || '?')); return; }
      if (placed.has(idol.id)) { report.duplicateEntries.push(idol.name); return; }
      placed.add(idol.id);
      ids.push(idol.id);
    });

    const branded = {
      ...l,
      name: d.name || l.name,
      tierName: d.tierName || l.tierName,
      color: d.color || l.color,
      logoUrl: d.logoUrl !== undefined ? d.logoUrl : l.logoUrl,
      description: d.description !== undefined ? d.description : l.description,
    };
    if (ids.length === 0) { report.rosterSizes.push((l.memberIds || []).length); return branded; }

    const same = ids.length === (l.memberIds || []).length && ids.every((id) => (l.memberIds || []).includes(id));
    report.leaguesUpdated++;
    report.rosterSizes.push(ids.length);
    if (same && (l.matches || []).length > 0) return { ...branded, memberIds: ids };
    const matches = generateRoundRobinMatches(l.id, ids);
    report.rebuiltFixtures.push(l.id);
    return { ...branded, memberIds: ids, matches, standings: calculateLeagueStandings(l.id, ids, matches, idols) };
  });

  return { state: { ...base, leagues } as LeagueSeasonState, report };
}
