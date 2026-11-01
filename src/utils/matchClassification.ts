import type { ArchivedMatch } from '../types';

/** Classifies V5 competition records before broad text matching. Cups may contain "league" in their title but are tournament competitions. */
export function isTheIdolsMatch(m: ArchivedMatch): boolean {
  const stage = String(m.stage || (m as any).stageOrDivision || m.groupName || '').toLowerCase();
  const id = String(m.matchId || '').toLowerCase();
  return stage.includes('the idols') || stage.includes('superleague') || stage.includes('masters playoff') || id.startsWith('ti_') || id.includes('the_idols') || id.includes('superleague');
}

export function isLeagueDivisionMatch(m: ArchivedMatch): boolean {
  if (isTheIdolsMatch(m)) return false;
  const stage = String(m.stage || (m as any).stageOrDivision || m.groupName || '').toLowerCase();
  const id = String(m.matchId || '').toLowerCase();
  // V5 cup records have a shared prefix. Only Division 2 records are league fixtures.
  if (stage.startsWith('cups & divisions:')) return stage.startsWith('cups & divisions: division 2');
  return (m as any).type === 'League Division' || stage.includes('league') || stage.includes('division') || stage.includes('wildcard') || stage.includes('premier') || stage.includes('championship') || stage.includes('md ') || stage.includes('matchday') || id.includes('league') || id.includes('wildcard') || id.includes('wm_') || id.includes('arch_l_');
}
