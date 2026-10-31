import {
  Idol,
  GirlGroup,
  TournamentConfig,
  Group,
  GroupMatch,
  GroupStanding,
  KnockoutMatch,
  ArchivedMatch,
  TournamentArchive,
  CareerStat,
} from '../types';
import {
  getIdolRating,
  getDefaultIdolRating,
  calculateRatingWinProbability,
  calculateMatchOutcomes,
  simulateSeriesMatches as simulateSeriesMatchesHelper,
  simulateBo4Score,
} from './ratingHelper';
import { getEffectiveIdolRating } from './formHelper';

/**
 * Clean and parse name input lists from textareas (supporting newlines, commas, semicolons, bullets, numbering, parentheses).
 */
export function parseNameInputList(rawText: string): string[] {
  if (!rawText) return [];
  const rawLines = rawText.split(/[\n,;|\r]+/);
  const result: string[] = [];

  rawLines.forEach((line) => {
    let cleaned = line.trim();
    if (!cleaned) return;

    // Remove leading numbers / bullets e.g. "1.", "1)", "1 -", "[1]", "-", "*", "•", "#1"
    cleaned = cleaned.replace(/^(\d+[\.\)\:\-]\s*|\[\d+\]\s*|[\-\*\•\#\>\~]\s*)/, '').trim();

    // Remove wrapping quotes
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();

    if (!cleaned) return;

    // If name contains parentheses e.g. "Karina (aespa)" or "Wonyoung [IVE]"
    const matchBase = cleaned.match(/^([^\(\[\{]+)[\(\[\{].*[\)\]\}]$/);
    if (matchBase && matchBase[1]?.trim()) {
      result.push(matchBase[1].trim());
    }
    result.push(cleaned);
  });

  return Array.from(new Set(result.filter(Boolean)));
}

/**
 * Helper to check if an idol is active.
 * An idol is inactive if idol.inactive is true (or string "true")
 * OR if their girl group is marked inactive (case-insensitive & trimmed matching).
 */
export function isIdolActive(idol?: Idol | null, girlGroups: GirlGroup[] = []): boolean {
  if (!idol) return false;
  if (
    idol.inactive === true ||
    String(idol.inactive).trim().toLowerCase() === 'true' ||
    (idol.inactive as any) === 1
  ) {
    return false;
  }
  if (idol.girlGroup && Array.isArray(girlGroups) && girlGroups.length > 0) {
    const idolGroupName = idol.girlGroup.trim().toLowerCase();
    const group = girlGroups.find((g) => {
      if (!g || !g.name) return false;
      return g.name.trim().toLowerCase() === idolGroupName;
    });
    if (
      group &&
      (group.inactive === true ||
        String(group.inactive).trim().toLowerCase() === 'true' ||
        (group.inactive as any) === 1)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Perform Participant Selection according to rules:
 * - Guarantees all active members of the #1 ranked Girl Group.
 * - Inactive Exclusion: Strictly excludes any idol or girl group marked as inactive.
 * - 1-Season Penalty: Strictly filters out idols who finished in last place in their group or failed to advance in the immediate previous season (valid for only 1 season).
 * - Priority Pick: Strictly prioritizes eligible idols from Seed 1 to Seed 3. Only if Seed 1-3 are exhausted, picks from Seed 4.
 */
export function selectParticipantsRandom(
  allIdols: Idol[],
  totalNeeded: number,
  girlGroups: GirlGroup[] = [],
  archives: TournamentArchive[] = [],
  matchDatabase: ArchivedMatch[] = []
): string[] {
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  // Filter only active idols (inactive idols and idols from inactive girl groups are strictly excluded)
  const activeIdols = allIdols.filter((i) => isIdolActive(i, girlGroups));

  // 1. Determine #1 Ranked Girl Group (by championships, then wins, then win rate, then members)
  const groupSeasonWinnersMap = new Map<string, number>();
  archives.forEach((arch) => {
    if (arch.championId) {
      const champIdol = allIdols.find((i) => i.id === arch.championId);
      const groupName = champIdol?.girlGroup || 'Solo / Independent';
      groupSeasonWinnersMap.set(groupName, (groupSeasonWinnersMap.get(groupName) || 0) + 1);
    }
  });

  const groupStatsMap = new Map<
    string,
    { championships: number; wins: number; matches: number; members: Idol[] }
  >();

  activeIdols.forEach((idol) => {
    const gName = idol.girlGroup || 'Solo / Independent';
    if (!groupStatsMap.has(gName)) {
      groupStatsMap.set(gName, {
        championships: groupSeasonWinnersMap.get(gName) || 0,
        wins: 0,
        matches: 0,
        members: [],
      });
    }
    groupStatsMap.get(gName)!.members.push(idol);
  });

  matchDatabase.forEach((m) => {
    if (m.idolAId) {
      const idolA = allIdols.find((i) => i.id === m.idolAId);
      const gName = idolA?.girlGroup || 'Solo / Independent';
      const st = groupStatsMap.get(gName);
      if (st) {
        st.matches++;
        if (m.winnerId === m.idolAId) st.wins++;
      }
    }
    if (m.idolBId) {
      const idolB = allIdols.find((i) => i.id === m.idolBId);
      const gName = idolB?.girlGroup || 'Solo / Independent';
      const st = groupStatsMap.get(gName);
      if (st) {
        st.matches++;
        if (m.winnerId === m.idolBId) st.wins++;
      }
    }
  });

  const rankedGroups = Array.from(groupStatsMap.entries())
    .filter(([name]) => name !== 'Solo / Independent')
    .sort((a, b) => {
      if (b[1].championships !== a[1].championships) return b[1].championships - a[1].championships;
      if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
      const rateA = a[1].matches > 0 ? a[1].wins / a[1].matches : 0;
      const rateB = b[1].matches > 0 ? b[1].wins / b[1].matches : 0;
      if (rateB !== rateA) return rateB - rateA;
      return b[1].members.length - a[1].members.length;
    });

  // 2. Derive immediate previous season 1-season exclusion set
  const prevSummary = getPreviousSeasonSummary(allIdols, archives, matchDatabase);
  const penalized1SeasonSet = new Set<string>();
  if (prevSummary) {
    prevSummary.lastPlaceIdolIds.forEach((id) => penalized1SeasonSet.add(id));
    prevSummary.eliminatedIdols.forEach((i) => penalized1SeasonSet.add(i.idolId));
  }

  const selectedIdsSet = new Set<string>();

  // Rule 2: Guarantee all members of the #1 ranked girl group (who are eligible)
  if (rankedGroups.length > 0) {
    const topGroup = rankedGroups[0];
    topGroup[1].members.forEach((member) => {
      if (selectedIdsSet.size < totalNeeded && !penalized1SeasonSet.has(member.id)) {
        selectedIdsSet.add(member.id);
      }
    });
  }

  // Filter remaining eligible idols (not penalized by the 1-season rule)
  const eligibleIdols = activeIdols.filter(
    (i) => !selectedIdsSet.has(i.id) && !penalized1SeasonSet.has(i.id)
  );

  // Priority pick: Seed 1, Seed 2, and Seed 3 FIRST
  const eligibleSeed1 = shuffle(eligibleIdols.filter((i) => i.seed === 'Seed 1'));
  const eligibleSeed2 = shuffle(eligibleIdols.filter((i) => i.seed === 'Seed 2'));
  const eligibleSeed3 = shuffle(eligibleIdols.filter((i) => i.seed === 'Seed 3'));

  for (const idol of [...eligibleSeed1, ...eligibleSeed2, ...eligibleSeed3]) {
    if (selectedIdsSet.size >= totalNeeded) break;
    selectedIdsSet.add(idol.id);
  }

  // If still not enough, only then choose from Seed 4
  if (selectedIdsSet.size < totalNeeded) {
    const eligibleSeed4 = shuffle(eligibleIdols.filter((i) => i.seed === 'Seed 4'));
    for (const idol of eligibleSeed4) {
      if (selectedIdsSet.size >= totalNeeded) break;
      selectedIdsSet.add(idol.id);
    }
  }

  // If still not enough, pick unseeded eligible idols
  if (selectedIdsSet.size < totalNeeded) {
    const eligibleOthers = shuffle(
      eligibleIdols.filter((i) => !['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'].includes(i.seed))
    );
    for (const idol of eligibleOthers) {
      if (selectedIdsSet.size >= totalNeeded) break;
      selectedIdsSet.add(idol.id);
    }
  }

  // Fallback pool from penalized active idols ONLY if total active database size is less than totalNeeded
  if (selectedIdsSet.size < totalNeeded) {
    const fallbackIdols = shuffle(
      activeIdols.filter((i) => penalized1SeasonSet.has(i.id) && !selectedIdsSet.has(i.id))
    ).sort((a, b) => {
      const getRank = (s: string) => (s === 'Seed 1' ? 1 : s === 'Seed 2' ? 2 : s === 'Seed 3' ? 3 : 4);
      return getRank(a.seed) - getRank(b.seed);
    });

    for (const idol of fallbackIdols) {
      if (selectedIdsSet.size >= totalNeeded) break;
      selectedIdsSet.add(idol.id);
    }
  }

  return Array.from(selectedIdsSet);
}

export interface PreviousSeasonEliminatedInfo {
  idolId: string;
  idolName: string;
  girlGroup: string;
  nationality: string;
  photoUrl: string;
  seed: string;
  groupName: string;
  rank: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  isLastPlace: boolean;
}

export interface PreviousSeasonSummary {
  seasonId: number;
  seasonName: string;
  top32KnockoutCount: number;
  top16Count: number;
  top3GroupCount: number;
  eliminatedGroupCount: number;
  lastPlaceCount: number;
  eliminatedIdols: PreviousSeasonEliminatedInfo[];
  top32KnockoutIdolIds: string[];
  top16IdolIds: string[];
  top3GroupFinishIdolIds: string[];
  lastPlaceIdolIds: string[];
}

/**
 * Summarizes previous season performance, rankings, and idols who did NOT advance to knockout.
 * Targets strictly the single immediate previous season archive (valid for 1 season).
 */
export function getPreviousSeasonSummary(
  allIdols: Idol[],
  archives: TournamentArchive[],
  matchDatabase: ArchivedMatch[] = []
): PreviousSeasonSummary | null {
  if (!archives || archives.length === 0) return null;

  const idolsMap = new Map<string, Idol>(allIdols.map((i) => [i.id, i]));
  // Sort archives by seasonId to guarantee we strictly get the immediate previous completed season
  const sortedArchives = [...archives].sort(
    (a, b) => Number(a?.seasonId || 0) - Number(b?.seasonId || 0)
  );
  const prevArchive = sortedArchives[sortedArchives.length - 1];
  if (!prevArchive) return null;
  const prevSeasonId = prevArchive.seasonId || 1;
  const prevSeasonName = prevArchive.seasonName || `Season ${prevSeasonId}`;

  const top32KnockoutIdols = new Set<string>();
  const top16Idols = new Set<string>();
  const advancedGroupStageIdols = new Set<string>();
  const top3GroupFinishers = new Set<string>();
  const lastPlaceIdols = new Set<string>();
  const eliminatedList: PreviousSeasonEliminatedInfo[] = [];

  // 1. Knockout Matches
  (Array.isArray(prevArchive?.knockoutMatches) ? prevArchive.knockoutMatches : []).forEach((m) => {
    const stage = (m.roundName || '').toLowerCase();
    const isTop16OrBetter =
      stage.includes('16') ||
      stage.includes('quarter') ||
      stage.includes('semi') ||
      stage.includes('final') ||
      stage.includes('3rd') ||
      stage.includes('third');

    if (m.idolAId) {
      top32KnockoutIdols.add(m.idolAId);
      advancedGroupStageIdols.add(m.idolAId);
      if (isTop16OrBetter) top16Idols.add(m.idolAId);
    }
    if (m.idolBId) {
      top32KnockoutIdols.add(m.idolBId);
      advancedGroupStageIdols.add(m.idolBId);
      if (isTop16OrBetter) top16Idols.add(m.idolBId);
    }
  });

  // Also check matchDatabase for knockouts of this specific immediate previous season
  matchDatabase.forEach((m) => {
    if (Number(m.seasonId) === Number(prevSeasonId)) {
      const stage = (m.stage || '').toLowerCase();
      const isKnockout =
        stage.includes('knockout') ||
        stage.includes('round') ||
        stage.includes('final') ||
        stage.includes('quarter') ||
        stage.includes('semi') ||
        stage.includes('32') ||
        stage.includes('16');

      if (isKnockout) {
        if (m.idolAId) {
          top32KnockoutIdols.add(m.idolAId);
          advancedGroupStageIdols.add(m.idolAId);
          if (!stage.includes('32') && !stage.includes('play-in')) top16Idols.add(m.idolAId);
        }
        if (m.idolBId) {
          top32KnockoutIdols.add(m.idolBId);
          advancedGroupStageIdols.add(m.idolBId);
          if (!stage.includes('32') && !stage.includes('play-in')) top16Idols.add(m.idolBId);
        }
      }
    }
  });

  // 2. Groups & Standings
  (Array.isArray(prevArchive?.groups) ? prevArchive.groups : []).forEach((g, gIdx) => {
    const gName = g.name || `Group ${String.fromCharCode(65 + gIdx)}`;
    const standings =
      Array.isArray(g.standings) && g.standings.length > 0
        ? g.standings
        : calculateGroupStandings(
            g.memberIds || (g as any).members || [],
            g.matches || [],
            prevArchive.qualifiedPerGroup || 2
          );

    const groupSize = standings.length;
    let maxRank = 0;
    standings.forEach((st) => {
      if (st.rank && st.rank > maxRank) maxRank = st.rank;
    });

    standings.forEach((st, idx) => {
      const rank = st.rank || idx + 1;
      const isTop3 = rank <= 3;
      const isLast = groupSize > 1 && (rank === maxRank || idx === groupSize - 1);

      if (isTop3) {
        top3GroupFinishers.add(st.idolId);
      }
      if (isLast) {
        lastPlaceIdols.add(st.idolId);
      }
      if (st.qualified) {
        top32KnockoutIdols.add(st.idolId);
        advancedGroupStageIdols.add(st.idolId);
      }

      // Check if this idol failed to advance to knockout
      const didAdvance = st.qualified || top32KnockoutIdols.has(st.idolId) || advancedGroupStageIdols.has(st.idolId);
      if (!didAdvance) {
        const idolObj = idolsMap.get(st.idolId);
        eliminatedList.push({
          idolId: st.idolId,
          idolName: idolObj?.name || st.idolName || `Idol ${st.idolId}`,
          girlGroup: idolObj?.girlGroup || 'Solo / Independent',
          nationality: idolObj?.nationality || 'South Korea',
          photoUrl: idolObj?.photoUrl || '',
          seed: idolObj?.seed || 'Unseeded',
          groupName: gName,
          rank,
          points: Number(st.points ?? 0),
          won: Number(st.won ?? 0),
          drawn: Number(st.drawn ?? 0),
          lost: Number(st.lost ?? 0),
          isLastPlace: isLast,
        });
      }
    });
  });

  return {
    seasonId: Number(prevSeasonId),
    seasonName: prevSeasonName,
    top32KnockoutCount: top32KnockoutIdols.size,
    top16Count: top16Idols.size,
    top3GroupCount: top3GroupFinishers.size,
    eliminatedGroupCount: eliminatedList.length,
    lastPlaceCount: lastPlaceIdols.size,
    eliminatedIdols: eliminatedList,
    top32KnockoutIdolIds: Array.from(top32KnockoutIdols),
    top16IdolIds: Array.from(top16Idols),
    top3GroupFinishIdolIds: Array.from(top3GroupFinishers),
    lastPlaceIdolIds: Array.from(lastPlaceIdols),
  };
}

/**
 * Participant selection based on Previous Season performance:
 * - Priority 1: All names that advanced to the Knockout Stage (the Big 32) in previous season.
 *   (Within Big 32: Seed 1, Seed 2, and Seed 3 are chosen first, then Seed 4).
 * - Priority 2: Other eligible active idols in database from Seed 1, Seed 2, and Seed 3.
 * - Priority 3: If still not enough, only then pick from Seed 4 & unseeded.
 * - 1-Season Penalty: Strictly excludes last place and non-qualifiers for ONLY 1 season (used only as emergency fallback).
 * - Inactive Exclusion: Strictly excludes any idol or girl group marked as inactive.
 */
export function selectParticipantsFromPreviousSeason(
  allIdols: Idol[],
  totalNeeded: number,
  archives: TournamentArchive[],
  matchDatabase: ArchivedMatch[] = [],
  girlGroups: GirlGroup[] = []
): string[] {
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  // Filter only active idols (inactive idols and idols from inactive girl groups are strictly excluded)
  const activeIdols = allIdols.filter((i) => isIdolActive(i, girlGroups));

  if (!archives || archives.length === 0) {
    // If no previous season archives, fall back to standard random
    return selectParticipantsRandom(allIdols, totalNeeded, girlGroups, archives, matchDatabase);
  }

  const summary = getPreviousSeasonSummary(allIdols, archives, matchDatabase);
  if (!summary) {
    return selectParticipantsRandom(allIdols, totalNeeded, girlGroups, archives, matchDatabase);
  }

  const knockoutBig32Set = new Set<string>(summary.top32KnockoutIdolIds);
  const lastPlaceSet = new Set<string>(summary.lastPlaceIdolIds);
  const eliminatedSet = new Set<string>(summary.eliminatedIdols.map((i) => i.idolId));

  // Combine 1-season ignored pool: Last place of every group + non-qualifiers (valid for 1 season only)
  const ignoredSet = new Set<string>();
  lastPlaceSet.forEach((id) => ignoredSet.add(id));
  eliminatedSet.forEach((id) => ignoredSet.add(id));

  const selectedIdsSet = new Set<string>();

  const addIdolsWithSeedPriority = (idolsPool: Idol[]) => {
    const s1 = shuffle(idolsPool.filter((i) => i.seed === 'Seed 1' && !selectedIdsSet.has(i.id)));
    const s2 = shuffle(idolsPool.filter((i) => i.seed === 'Seed 2' && !selectedIdsSet.has(i.id)));
    const s3 = shuffle(idolsPool.filter((i) => i.seed === 'Seed 3' && !selectedIdsSet.has(i.id)));
    const s4 = shuffle(idolsPool.filter((i) => i.seed === 'Seed 4' && !selectedIdsSet.has(i.id)));
    const others = shuffle(
      idolsPool.filter(
        (i) => !['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'].includes(i.seed) && !selectedIdsSet.has(i.id)
      )
    );

    // Fill Seed 1 to Seed 3 first
    for (const idol of [...s1, ...s2, ...s3]) {
      if (selectedIdsSet.size >= totalNeeded) return;
      selectedIdsSet.add(idol.id);
    }
    // Only then Seed 4
    for (const idol of s4) {
      if (selectedIdsSet.size >= totalNeeded) return;
      selectedIdsSet.add(idol.id);
    }
    // Others
    for (const idol of others) {
      if (selectedIdsSet.size >= totalNeeded) return;
      selectedIdsSet.add(idol.id);
    }
  };

  // Priority 1: Names that advanced to Knockout Stage (Big 32) in previous season
  const big32KnockoutIdols = activeIdols.filter((i) => knockoutBig32Set.has(i.id));
  addIdolsWithSeedPriority(big32KnockoutIdols);

  // Priority 2: Other eligible active idols in database from Seed 1, Seed 2, and Seed 3 (who do not have the 1-season penalty)
  if (selectedIdsSet.size < totalNeeded) {
    const tier2Seeds1to3 = activeIdols.filter(
      (i) =>
        !knockoutBig32Set.has(i.id) &&
        !ignoredSet.has(i.id) &&
        ['Seed 1', 'Seed 2', 'Seed 3'].includes(i.seed)
    );
    addIdolsWithSeedPriority(tier2Seeds1to3);
  }

  // Priority 3: Eligible Seed 4 idols (ONLY if slots still remain after exhausting all eligible Seed 1-3)
  if (selectedIdsSet.size < totalNeeded) {
    const tier3Seed4 = activeIdols.filter(
      (i) =>
        !knockoutBig32Set.has(i.id) &&
        !ignoredSet.has(i.id) &&
        i.seed === 'Seed 4'
    );
    addIdolsWithSeedPriority(tier3Seed4);
  }

  // Priority 4: Other unseeded eligible idols
  if (selectedIdsSet.size < totalNeeded) {
    const tier4Others = activeIdols.filter(
      (i) =>
        !knockoutBig32Set.has(i.id) &&
        !ignoredSet.has(i.id) &&
        !['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'].includes(i.seed)
    );
    addIdolsWithSeedPriority(tier4Others);
  }

  // Priority 5: Fallback pool from penalized active idols ONLY if total active database size is less than totalNeeded
  if (selectedIdsSet.size < totalNeeded) {
    const fallbackIdols = activeIdols.filter((i) => ignoredSet.has(i.id) && !selectedIdsSet.has(i.id));
    addIdolsWithSeedPriority(fallbackIdols);
  }

  return Array.from(selectedIdsSet);
}

export function drawGroups(
  allIdols: Idol[],
  participantIds: string[],
  config: TournamentConfig
): Group[] {
  const allIdolsMap = new Map<string, Idol>();
  allIdols.forEach((i) => allIdolsMap.set(i.id, i));
  return performGroupDraw(participantIds, allIdolsMap, config);
}

/**
 * Group Draw Algorithm:
 * Guarantees EXACTLY `participantsPerGroup` in every group.
 * Respects seed tiers and avoids same girl group members in the same group (best effort).
 */
export function performGroupDraw(
  participantIds: string[],
  allIdolsMap: Map<string, Idol>,
  config: TournamentConfig
): Group[] {
  const { numGroups, participantsPerGroup } = config;
  const totalNeeded = numGroups * participantsPerGroup;

  // Take exact participant slice needed
  const activeIds = participantIds.slice(0, totalNeeded);
  const idols = activeIds.map((id) => allIdolsMap.get(id)).filter(Boolean) as Idol[];

  // If fewer than totalNeeded idols, backfill from allIdolsMap so every group has exact participantsPerGroup
  if (idols.length < totalNeeded) {
    const existingIds = new Set(idols.map((i) => i.id));
    for (const idol of allIdolsMap.values()) {
      if (idols.length >= totalNeeded) break;
      if (idol && !existingIds.has(idol.id)) {
        existingIds.add(idol.id);
        idols.push(idol);
      }
    }
  }

  // Group idols by seed tier
  const seed1 = idols.filter((i) => i.seed === 'Seed 1');
  const seed2 = idols.filter((i) => i.seed === 'Seed 2');
  const seed3 = idols.filter((i) => i.seed === 'Seed 3');
  const seed4 = idols.filter((i) => i.seed === 'Seed 4');
  const other = idols.filter(
    (i) => !['Seed 1', 'Seed 2', 'Seed 3', 'Seed 4'].includes(i.seed)
  );

  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  const sortedPool = [
    ...shuffle(seed1),
    ...shuffle(seed2),
    ...shuffle(seed3),
    ...shuffle(seed4),
    ...shuffle(other),
  ];

  // Initialize empty groups
  const groups: Group[] = Array.from({ length: numGroups }, (_, idx) => {
    const letter = String.fromCharCode(65 + idx); // A, B, C...
    return {
      id: `group-${idx}`,
      name: `Group ${letter}`,
      memberIds: [],
      matches: [],
      standings: [],
    };
  });

  // Distribute idols into groups ensuring balanced seeds and avoiding same group collisions
  for (const idol of sortedPool) {
    // Find the groups with minimum members
    const minMembers = Math.min(...groups.map((g) => g.memberIds.length));
    const candidateGroups = groups.filter((g) => g.memberIds.length === minMembers);

    // Prefer candidate group without idol's girl group
    let chosenGroup = candidateGroups.find((g) => {
      const existingInGroup = g.memberIds
        .map((id) => allIdolsMap.get(id))
        .filter(Boolean);
      return !existingInGroup.some(
        (existing) => existing?.girlGroup && existing.girlGroup === idol.girlGroup
      );
    });

    // If all candidate groups have the girl group, fall back to any candidate group
    if (!chosenGroup) {
      chosenGroup = candidateGroups[Math.floor(Math.random() * candidateGroups.length)];
    }

    chosenGroup.memberIds.push(idol.id);
  }

  // Hard safety assertion: guarantee every single group has EXACT participantsPerGroup!
  const allUsedIds = new Set(groups.flatMap((g) => g.memberIds));
  for (let idx = 0; idx < groups.length; idx++) {
    const g = groups[idx];
    while (g.memberIds.length < participantsPerGroup) {
      let candidate = Array.from(allIdolsMap.values()).find((i) => i && !allUsedIds.has(i.id));
      if (!candidate && allIdolsMap.size > 0) {
        candidate = Array.from(allIdolsMap.values())[0];
      }
      if (candidate) {
        allUsedIds.add(candidate.id);
        g.memberIds.push(candidate.id);
      } else {
        break;
      }
    }
  }

  // Generate round robin matches and initial standings for each group
  return groups.map((g, idx) => {
    const matches = generateRoundRobinMatches(g.id, g.name, g.memberIds);
    const standings = calculateGroupStandings(g.memberIds, matches, config.qualifiedPerGroup);
    return {
      ...g,
      matches,
      standings,
    };
  });
}

/**
 * Generate Round Robin Matches for a group
 */
export function generateRoundRobinMatches(
  groupId: string,
  groupName: string,
  memberIds: string[]
): GroupMatch[] {
  const matches: GroupMatch[] = [];
  let matchIdx = 1;

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      matches.push({
        id: `${groupId}-match-${matchIdx}`,
        groupIndex: parseInt(groupId.replace('group-', ''), 10) || 0,
        groupName,
        round: matchIdx,
        idolAId: memberIds[i],
        idolBId: memberIds[j],
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      });
      matchIdx++;
    }
  }

  return matches;
}

/**
 * Calculate Group Standings following MOBA Priority:
 * Points -> Game Difference -> Game Score For -> Head to Head -> Random
 */
export function calculateGroupStandings(
  memberIds: string[],
  matches: GroupMatch[],
  qualifiedPerGroup: number
): GroupStanding[] {
  const map = new Map<
    string,
    { played: number; wins: number; losses: number; draws: number; points: number; gf: number; ga: number }
  >();

  memberIds.forEach((id) => {
    map.set(id, { played: 0, wins: 0, losses: 0, draws: 0, points: 0, gf: 0, ga: 0 });
  });

  matches.forEach((m) => {
    if (m.completed && m.scoreA !== null && m.scoreB !== null) {
      const statsA = map.get(m.idolAId);
      const statsB = map.get(m.idolBId);

      if (statsA && statsB) {
        statsA.played++;
        statsB.played++;
        statsA.gf += m.scoreA;
        statsA.ga += m.scoreB;
        statsB.gf += m.scoreB;
        statsB.ga += m.scoreA;

        if (m.scoreA > m.scoreB) {
          statsA.wins++;
          statsA.points += 3;
          statsB.losses++;
        } else if (m.scoreB > m.scoreA) {
          statsB.wins++;
          statsB.points += 3;
          statsA.losses++;
        } else {
          statsA.draws++;
          statsB.draws++;
          statsA.points += 1;
          statsB.points += 1;
        }
      }
    }
  });

  const standings: GroupStanding[] = memberIds.map((id) => {
    const s = map.get(id)!;
    return {
      idolId: id,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      points: s.points,
      gamesFor: s.gf,
      gamesAgainst: s.ga,
      gameDiff: s.gf - s.ga,
      rank: 0,
      qualified: false,
    };
  });

  // Sort by MOBA rules
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    if (b.gamesFor !== a.gamesFor) return b.gamesFor - a.gamesFor;

    // Head-to-Head tiebreaker
    const h2hMatch = matches.find(
      (m) =>
        m.completed &&
        ((m.idolAId === a.idolId && m.idolBId === b.idolId) ||
          (m.idolAId === b.idolId && m.idolBId === a.idolId))
    );

    if (h2hMatch && h2hMatch.scoreA !== null && h2hMatch.scoreB !== null) {
      if (h2hMatch.idolAId === a.idolId) {
        if (h2hMatch.scoreA > h2hMatch.scoreB) return -1;
        if (h2hMatch.scoreB > h2hMatch.scoreA) return 1;
      } else {
        if (h2hMatch.scoreB > h2hMatch.scoreA) return -1;
        if (h2hMatch.scoreA > h2hMatch.scoreB) return 1;
      }
    }

    return a.idolId.localeCompare(b.idolId);
  });

  // Assign ranks & qualification flag
  return standings.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    qualified: idx < qualifiedPerGroup,
  }));
}

/**
 * Safely pair two sets of qualified participants guaranteeing NO DUPLICATES
 * and avoiding same-group matchups where possible.
 */
function pairUniqueParticipants<T extends { idolId: string; groupName: string }>(
  poolA: T[],
  poolB: T[]
): { a: T; b: T }[] {
  // Ensure unique idols within poolA and poolB
  const uniqueA: T[] = [];
  const seenA = new Set<string>();
  for (const item of poolA) {
    if (item.idolId && !seenA.has(item.idolId)) {
      seenA.add(item.idolId);
      uniqueA.push(item);
    }
  }

  const uniqueB: T[] = [];
  const seenB = new Set<string>();
  for (const item of poolB) {
    if (item.idolId && !seenA.has(item.idolId) && !seenB.has(item.idolId)) {
      seenB.add(item.idolId);
      uniqueB.push(item);
    }
  }

  const shuffledA = [...uniqueA].sort(() => Math.random() - 0.5);
  const remainingB = [...uniqueB].sort(() => Math.random() - 0.5);
  const pairs: { a: T; b: T }[] = [];

  for (let i = 0; i < shuffledA.length; i++) {
    const itemA = shuffledA[i];
    // Find candidate in remainingB from a different group
    let idxB = remainingB.findIndex((itemB) => itemB.groupName !== itemA.groupName);

    // If no candidate from a different group remains, take first available
    if (idxB === -1 && remainingB.length > 0) {
      idxB = 0;
    }

    if (idxB !== -1) {
      const [itemB] = remainingB.splice(idxB, 1);
      pairs.push({ a: itemA, b: itemB });
    }
  }

  // Swap check to prevent same-group matchup if collision happened at the end
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].a.groupName === pairs[i].b.groupName) {
      for (let j = 0; j < pairs.length; j++) {
        if (
          i !== j &&
          pairs[j].a.groupName !== pairs[i].b.groupName &&
          pairs[i].a.groupName !== pairs[j].b.groupName
        ) {
          const temp = pairs[i].b;
          pairs[i].b = pairs[j].b;
          pairs[j].b = temp;
          break;
        }
      }
    }
  }

  return pairs;
}

/**
 * Helper to get round name and round index based on match count
 */
function getRoundDetails(matchCount: number): { roundName: string; roundIndex: number } {
  switch (matchCount) {
    case 16:
      return { roundName: 'Round of 32', roundIndex: 1 };
    case 8:
      return { roundName: 'Round of 16', roundIndex: 2 };
    case 4:
      return { roundName: 'Quarter Finals', roundIndex: 3 };
    case 2:
      return { roundName: 'Semi Finals', roundIndex: 4 };
    case 1:
      return { roundName: 'Grand Final', roundIndex: 5 };
    default:
      return { roundName: `Round of ${matchCount * 2}`, roundIndex: 1 };
  }
}

/**
 * Generate Knockout Bracket
 * Handles Top 2 or Top 3 qualifications dynamically with connected rounds!
 * Guarantees zero duplicate participants in the bracket.
 */
export function buildKnockoutBracket(
  groups: Group[],
  config: TournamentConfig,
  allIdolsMap: Map<string, Idol>
): KnockoutMatch[] {
  const { qualifiedPerGroup } = config;

  // Extract qualified members per group by calculating FRESH standings directly from matches!
  const groupWinners: { idolId: string; groupName: string }[] = [];
  const groupRunnersUp: { idolId: string; groupName: string }[] = [];
  const groupThirds: { idolId: string; groupName: string }[] = [];

  (Array.isArray(groups) ? groups : []).forEach((g) => {
    const standings = calculateGroupStandings(g.memberIds, g.matches || [], qualifiedPerGroup);
    if (standings.length >= 1) groupWinners.push({ idolId: standings[0].idolId, groupName: g.name });
    if (standings.length >= 2) groupRunnersUp.push({ idolId: standings[1].idolId, groupName: g.name });
    if (standings.length >= 3 && qualifiedPerGroup === 3) {
      groupThirds.push({ idolId: standings[2].idolId, groupName: g.name });
    }
  });

  const knockoutMatches: KnockoutMatch[] = [];

  if (qualifiedPerGroup === 3 && groupThirds.length > 0) {
    // Top 3 qualify mode:
    // Play-In stage: 2nd place vs 3rd place of different groups! (numGroups matches)
    // 1st place group winners get automatic BYE to first main round!

    const playInPairs = pairUniqueParticipants(groupRunnersUp, groupThirds);
    const playInMatches: KnockoutMatch[] = [];

    playInPairs.forEach((pair, i) => {
      const playInId = `ko-playin-${i + 1}`;
      playInMatches.push({
        id: playInId,
        roundIndex: 0,
        roundName: 'Play-In',
        matchNumber: i + 1,
        idolAId: pair.a.idolId,
        idolBId: pair.b.idolId,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      });
    });

    // First Main Round (Winners vs Play-In Winners)
    const mainFirstMatchCount = groupWinners.length;
    const { roundName, roundIndex } = getRoundDetails(mainFirstMatchCount);
    const firstMainMatches: KnockoutMatch[] = [];
    const shuffledWinners = [...groupWinners].sort(() => Math.random() - 0.5);

    for (let i = 0; i < mainFirstMatchCount; i++) {
      const matchId = `ko-${roundName.toLowerCase().replace(/\s+/g, '')}-${i + 1}`;
      const playInMatch = playInMatches[i];

      const match: KnockoutMatch = {
        id: matchId,
        roundIndex,
        roundName,
        matchNumber: i + 1,
        idolAId: shuffledWinners[i]?.idolId || null,
        idolBId: null, // to be filled by Play-In winner
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      };

      if (playInMatch) {
        playInMatch.feedsIntoMatchId = matchId;
        playInMatch.feedsIntoSlot = 'B';
      }

      firstMainMatches.push(match);
    }

    knockoutMatches.push(...playInMatches, ...firstMainMatches);

    // Build subsequent rounds up to Grand Final
    let prevMatches = firstMainMatches;
    let currentMatchCount = mainFirstMatchCount / 2;
    let currentRoundIdx = roundIndex + 1;

    while (currentMatchCount >= 2) {
      const details = getRoundDetails(currentMatchCount);
      const nextMatches = buildSubsequentRound(
        details.roundName,
        currentRoundIdx,
        currentMatchCount,
        prevMatches
      );
      knockoutMatches.push(...nextMatches);
      prevMatches = nextMatches;
      currentMatchCount /= 2;
      currentRoundIdx++;
    }

    // Final & 3rd Place Match
    const grandFinalId = `ko-final-1`;
    const thirdPlaceId = `ko-third-1`;

    const grandFinal: KnockoutMatch = {
      id: grandFinalId,
      roundIndex: currentRoundIdx,
      roundName: 'Grand Final',
      matchNumber: 1,
      idolAId: null,
      idolBId: null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      completed: false,
    };

    const thirdPlaceMatch: KnockoutMatch = {
      id: thirdPlaceId,
      roundIndex: currentRoundIdx,
      roundName: 'Third Place Match',
      matchNumber: 2,
      idolAId: null,
      idolBId: null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      completed: false,
      isThirdPlaceMatch: true,
    };

    if (prevMatches.length >= 2) {
      prevMatches[0].feedsIntoMatchId = grandFinalId;
      prevMatches[0].feedsIntoSlot = 'A';
      prevMatches[1].feedsIntoMatchId = grandFinalId;
      prevMatches[1].feedsIntoSlot = 'B';
    }

    knockoutMatches.push(grandFinal, thirdPlaceMatch);

  } else {
    // Top 2 qualify mode:
    // Pair Group Winners vs Group Runners-Up (100% unique participants)
    const pairs = pairUniqueParticipants(groupWinners, groupRunnersUp);
    const mainFirstMatchCount = pairs.length;
    const { roundName, roundIndex } = getRoundDetails(mainFirstMatchCount);

    const firstMainMatches: KnockoutMatch[] = [];

    pairs.forEach((pair, i) => {
      const matchId = `ko-${roundName.toLowerCase().replace(/\s+/g, '')}-${i + 1}`;
      firstMainMatches.push({
        id: matchId,
        roundIndex,
        roundName,
        matchNumber: i + 1,
        idolAId: pair.a.idolId,
        idolBId: pair.b.idolId,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      });
    });

    knockoutMatches.push(...firstMainMatches);

    // Build subsequent rounds up to Grand Final
    let prevMatches = firstMainMatches;
    let currentMatchCount = mainFirstMatchCount / 2;
    let currentRoundIdx = roundIndex + 1;

    while (currentMatchCount >= 2) {
      const details = getRoundDetails(currentMatchCount);
      const nextMatches = buildSubsequentRound(
        details.roundName,
        currentRoundIdx,
        currentMatchCount,
        prevMatches
      );
      knockoutMatches.push(...nextMatches);
      prevMatches = nextMatches;
      currentMatchCount /= 2;
      currentRoundIdx++;
    }

    // Final & 3rd Place Match
    const grandFinalId = `ko-final-1`;
    const thirdPlaceId = `ko-third-1`;

    const grandFinal: KnockoutMatch = {
      id: grandFinalId,
      roundIndex: currentRoundIdx,
      roundName: 'Grand Final',
      matchNumber: 1,
      idolAId: null,
      idolBId: null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      completed: false,
    };

    const thirdPlaceMatch: KnockoutMatch = {
      id: thirdPlaceId,
      roundIndex: currentRoundIdx,
      roundName: 'Third Place Match',
      matchNumber: 2,
      idolAId: null,
      idolBId: null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      completed: false,
      isThirdPlaceMatch: true,
    };

    if (prevMatches.length >= 2) {
      prevMatches[0].feedsIntoMatchId = grandFinalId;
      prevMatches[0].feedsIntoSlot = 'A';
      prevMatches[1].feedsIntoMatchId = grandFinalId;
      prevMatches[1].feedsIntoSlot = 'B';
    }

    knockoutMatches.push(grandFinal, thirdPlaceMatch);
  }

  return knockoutMatches;
}

function buildSubsequentRound(
  roundName: string,
  roundIndex: number,
  matchCount: number,
  previousRoundMatches: KnockoutMatch[]
): KnockoutMatch[] {
  const currentMatches: KnockoutMatch[] = [];

  for (let i = 0; i < matchCount; i++) {
    const matchId = `ko-${roundName.toLowerCase().replace(/\s+/g, '')}-${i + 1}`;
    const match: KnockoutMatch = {
      id: matchId,
      roundIndex,
      roundName,
      matchNumber: i + 1,
      idolAId: null,
      idolBId: null,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      completed: false,
    };

    const prevMatchA = previousRoundMatches[i * 2];
    const prevMatchB = previousRoundMatches[i * 2 + 1];

    if (prevMatchA) {
      prevMatchA.feedsIntoMatchId = matchId;
      prevMatchA.feedsIntoSlot = 'A';
    }
    if (prevMatchB) {
      prevMatchB.feedsIntoMatchId = matchId;
      prevMatchB.feedsIntoSlot = 'B';
    }

    currentMatches.push(match);
  }

  return currentMatches;
}

export function computeCareerStats(
  allIdols: Idol[] = [],
  matchDatabase: ArchivedMatch[] = [],
  archives: TournamentArchive[] = [],
  currentKnockoutMatches: KnockoutMatch[] = [],
  currentConfig?: TournamentConfig,
  currentGroups: Group[] = [],
  currentSelectedParticipants: string[] = [],
  leagueState?: any,
  leagueArchives?: any[],
  theIdolsState?: any,
  theIdolsArchives?: any[]
): CareerStat[] {
  const safeIdols = Array.isArray(allIdols) ? allIdols : [];
  const safeMatchDatabase = Array.isArray(matchDatabase) ? matchDatabase : [];
  const safeArchives = Array.isArray(archives) ? archives : [];
  const safeKnockoutMatches = Array.isArray(currentKnockoutMatches) ? currentKnockoutMatches : [];
  const safeGroups = Array.isArray(currentGroups) ? currentGroups : [];
  const safeSelectedParticipants = Array.isArray(currentSelectedParticipants) ? currentSelectedParticipants : [];
  const safeTheIdolsArchives = Array.isArray(theIdolsArchives) ? theIdolsArchives : [];

  const idolMap = new Map<string, CareerStat>();
  const idolNameLookup = new Map<string, string>(); // lowerName -> idolId

  safeIdols.forEach((idol) => {
    idolMap.set(idol.id, {
      idolId: idol.id,
      idolName: idol.name,
      girlGroup: idol.girlGroup,
      nationality: idol.nationality,
      seed: idol.seed,
      photoUrl: idol.photoUrl,
      participations: 0,
      championships: 0,
      runnerUps: 0,
      thirdPlaces: 0,
      fourthPlaces: 0,
      top4: 0,
      quarterFinals: 0,
      roundOf16: 0,
      roundOf32: 0,
      playIns: 0,
      groupAdvancements: 0,
      groupExits: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      groupWins: 0,
      groupLosses: 0,
      groupWinRate: 0,
      knockoutWins: 0,
      knockoutLosses: 0,
      knockoutWinRate: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      gameDiff: 0,
      longestWinStreak: 0,
      longestLosingStreak: 0,
      longestUnbeatenStreak: 0,
      avgPlacement: 0,
      bestFinish: 'N/A',
      worstFinish: 'N/A',
    });
    if (idol.name) {
      idolNameLookup.set(idol.name.trim().toLowerCase(), idol.id);
    }
  });

  const findStat = (id?: string | null, name?: string | null): CareerStat | undefined => {
    if (id && idolMap.has(id)) return idolMap.get(id);
    if (name) {
      const matchId = idolNameLookup.get(name.trim().toLowerCase());
      if (matchId && idolMap.has(matchId)) return idolMap.get(matchId);
    }
    return undefined;
  };

  // Track seasons participated and milestone stages per idol (Sets ensure zero double-counting per season)
  const idolSeasonsMap = new Map<string, Set<number>>();
  const seasonChampionMap = new Map<string, Set<number>>();
  const seasonRunnerUpMap = new Map<string, Set<number>>();
  const seasonThirdPlaceMap = new Map<string, Set<number>>();
  const seasonFourthPlaceMap = new Map<string, Set<number>>();
  const seasonTop4Map = new Map<string, Set<number>>();
  const seasonQuarterFinalsMap = new Map<string, Set<number>>();
  const seasonRoundOf16Map = new Map<string, Set<number>>();
  const seasonRoundOf32Map = new Map<string, Set<number>>();
  const seasonPlayInsMap = new Map<string, Set<number>>();
  const seasonGroupParticipationMap = new Map<string, Set<number>>();
  const seasonGroupAdvancementMap = new Map<string, Set<number>>();
  const seasonGroupExitMap = new Map<string, Set<number>>();

  const addMilestone = (map: Map<string, Set<number>>, idolId: string, seasonId: number) => {
    if (!map.has(idolId)) map.set(idolId, new Set<number>());
    map.get(idolId)!.add(seasonId);
  };

  const markParticipation = (id?: string | null, name?: string | null, seasonId: number = 1) => {
    const stat = findStat(id, name);
    if (!stat) return;
    addMilestone(idolSeasonsMap, stat.idolId, seasonId);
  };

  // Track highest stage achieved by idol across all seasons
  const idolBestRankMap = new Map<string, { rank: number; label: string }>();
  const idolWorstRankMap = new Map<string, { rank: number; label: string }>();

  const updateRankForIdol = (
    id: string | undefined | null,
    name: string | undefined | null,
    rank: number,
    label: string
  ) => {
    const stat = findStat(id, name);
    if (!stat) return;
    const idolId = stat.idolId;

    const currBest = idolBestRankMap.get(idolId) || { rank: 0, label: 'N/A' };
    if (rank > currBest.rank) {
      idolBestRankMap.set(idolId, { rank, label });
    }

    const currWorst = idolWorstRankMap.get(idolId);
    if (!currWorst || rank < currWorst.rank) {
      idolWorstRankMap.set(idolId, { rank, label });
    }
  };

  // 1. Process Past Archives
  safeArchives.forEach((arch) => {
    const sId = Number(arch.seasonId || 1);

    // Record all group participants
    (arch.groups || []).forEach((g) => {
      const memberList = g.members || (g as any).memberIds || [];
      if (Array.isArray(memberList)) {
        memberList.forEach((mId: string) => {
          markParticipation(mId, null, sId);
          const s = findStat(mId);
          if (s) {
            addMilestone(seasonGroupParticipationMap, s.idolId, sId);
          }
          // Check standings if available
          if (g.standings && g.standings.length > 0) {
            const st = g.standings.find((sItem: any) => sItem.idolId === mId);
            if (st) {
              if (st.qualified || (typeof st.rank === 'number' && st.rank <= (arch.qualifiedPerGroup || 2))) {
                if (s) addMilestone(seasonGroupAdvancementMap, s.idolId, sId);
              } else {
                if (s) addMilestone(seasonGroupExitMap, s.idolId, sId);
              }
            }
          }
        });
      }
      (g.matches || []).forEach((gm: any) => {
        if (gm?.idolAId) {
          markParticipation(gm.idolAId, gm.idolAName, sId);
          const sa = findStat(gm.idolAId, gm.idolAName);
          if (sa) addMilestone(seasonGroupParticipationMap, sa.idolId, sId);
        }
        if (gm?.idolBId) {
          markParticipation(gm.idolBId, gm.idolBName, sId);
          const sb = findStat(gm.idolBId, gm.idolBName);
          if (sb) addMilestone(seasonGroupParticipationMap, sb.idolId, sId);
        }
      });
    });

    // Knockout participation & stage milestones from archive
    (arch.knockoutMatches || []).forEach((km: any) => {
      if (km?.idolAId) markParticipation(km.idolAId, km.idolAName, sId);
      if (km?.idolBId) markParticipation(km.idolBId, km.idolBName, sId);
    });

    // Podiums from archive (strictly check valid non-empty IDs)
    if (arch.championId && typeof arch.championId === 'string' && arch.championId.trim().length > 0) {
      const s = findStat(arch.championId, arch.championName);
      if (s) {
        addMilestone(seasonChampionMap, s.idolId, sId);
        addMilestone(seasonTop4Map, s.idolId, sId);
        addMilestone(seasonGroupAdvancementMap, s.idolId, sId);
        updateRankForIdol(s.idolId, s.idolName, 10, 'Champion');
      }
    }
    if (arch.runnerUpId && typeof arch.runnerUpId === 'string' && arch.runnerUpId.trim().length > 0) {
      const s = findStat(arch.runnerUpId, arch.runnerUpName);
      if (s) {
        addMilestone(seasonRunnerUpMap, s.idolId, sId);
        addMilestone(seasonTop4Map, s.idolId, sId);
        addMilestone(seasonGroupAdvancementMap, s.idolId, sId);
        updateRankForIdol(s.idolId, s.idolName, 9, 'Runner-Up');
      }
    }
    if (arch.thirdPlaceId && typeof arch.thirdPlaceId === 'string' && arch.thirdPlaceId.trim().length > 0) {
      const s = findStat(arch.thirdPlaceId, arch.thirdPlaceName);
      if (s) {
        addMilestone(seasonThirdPlaceMap, s.idolId, sId);
        addMilestone(seasonTop4Map, s.idolId, sId);
        addMilestone(seasonGroupAdvancementMap, s.idolId, sId);
        updateRankForIdol(s.idolId, s.idolName, 8, '3rd Place');
      }
    }
    if (arch.fourthPlaceId && typeof arch.fourthPlaceId === 'string' && arch.fourthPlaceId.trim().length > 0) {
      const s = findStat(arch.fourthPlaceId, arch.fourthPlaceName);
      if (s) {
        addMilestone(seasonFourthPlaceMap, s.idolId, sId);
        addMilestone(seasonTop4Map, s.idolId, sId);
        addMilestone(seasonGroupAdvancementMap, s.idolId, sId);
        updateRankForIdol(s.idolId, s.idolName, 7, '4th Place');
      }
    }

    // Process archive knockout matches for stages reached
    (arch.knockoutMatches || []).forEach((m: any) => {
      const stage = (m.roundName || '').toLowerCase();
      const isPlayIn = stage.includes('play-in') || stage.includes('playin') || stage.includes('wildcard');
      const isThird = Boolean(m.isThirdPlaceMatch) || stage.includes('3rd') || stage.includes('third') || stage.includes('bronze');
      const isFinal = !isThird && !isPlayIn && (stage.includes('grand final') || (stage.includes('final') && !stage.includes('semi') && !stage.includes('quarter') && !stage.includes('16') && !stage.includes('32') && !stage.includes('octa')));

      const processParticipant = (pId?: string | null, pName?: string | null) => {
        if (!pId && !pName) return;
        const stat = findStat(pId, pName);
        if (!stat) return;

        if (!isPlayIn) {
          addMilestone(seasonGroupAdvancementMap, stat.idolId, sId);
        }

        if (isThird) {
          addMilestone(seasonTop4Map, stat.idolId, sId);
          if (m.winnerId === stat.idolId || (m.winnerName && m.winnerName === stat.idolName)) {
            addMilestone(seasonThirdPlaceMap, stat.idolId, sId);
            updateRankForIdol(stat.idolId, stat.idolName, 8, '3rd Place');
          } else {
            addMilestone(seasonFourthPlaceMap, stat.idolId, sId);
            updateRankForIdol(stat.idolId, stat.idolName, 7, '4th Place');
          }
        } else if (isFinal) {
          addMilestone(seasonTop4Map, stat.idolId, sId);
          if (m.winnerId === stat.idolId || (m.winnerName && m.winnerName === stat.idolName)) {
            addMilestone(seasonChampionMap, stat.idolId, sId);
            updateRankForIdol(stat.idolId, stat.idolName, 10, 'Champion');
          } else {
            addMilestone(seasonRunnerUpMap, stat.idolId, sId);
            updateRankForIdol(stat.idolId, stat.idolName, 9, 'Runner-Up');
          }
        } else if (stage.includes('semi')) {
          addMilestone(seasonTop4Map, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 6, 'Semi-Finals');
        } else if (stage.includes('quarter')) {
          addMilestone(seasonQuarterFinalsMap, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 5, 'Quarter-Finals');
        } else if (stage.includes('16') || stage.includes('r16')) {
          addMilestone(seasonRoundOf16Map, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 4, 'Round of 16');
        } else if (stage.includes('32') || stage.includes('r32')) {
          addMilestone(seasonRoundOf32Map, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 3, 'Round of 32');
        } else if (isPlayIn) {
          addMilestone(seasonPlayInsMap, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 2, 'Play-In Round');
        }
      };

      if (m.idolAId || m.idolAName) processParticipant(m.idolAId, m.idolAName);
      if (m.idolBId || m.idolBName) processParticipant(m.idolBId, m.idolBName);
    });
  });

  // Note: The Idols is an independent 20-idol league competition and is computed separately in theIdolsLogic.
  // We do NOT mix The Idols season participations or matches into Champions Cup group exits/advancements.

  // 2. Process Active Current Season Tournament
  const currentSeasonId = Number(currentConfig?.seasonId || 1);
  safeSelectedParticipants.forEach((id) => markParticipation(id, null, currentSeasonId));
  safeGroups.forEach((g) => {
    // A group is only completed when all matches in it have concluded
    const isGroupCompleted = Boolean(g.matches && g.matches.length > 0 && g.matches.every((m) => m.completed));
    (g.memberIds || []).forEach((id) => {
      markParticipation(id, null, currentSeasonId);
      const s = findStat(id);
      if (s && isGroupCompleted) {
        addMilestone(seasonGroupParticipationMap, s.idolId, currentSeasonId);
      }
      if (g.standings && g.standings.length > 0) {
        const st = g.standings.find((sItem) => sItem.idolId === id);
        if (st && s) {
          if (st.qualified) {
            addMilestone(seasonGroupAdvancementMap, s.idolId, currentSeasonId);
          } else if (isGroupCompleted) {
            addMilestone(seasonGroupExitMap, s.idolId, currentSeasonId);
          }
        }
      }
    });
  });

  safeKnockoutMatches.forEach((m) => {
    const stage = (m.roundName || '').toLowerCase();
    const isPlayIn = stage.includes('play-in') || stage.includes('playin') || stage.includes('wildcard');
    const isThird = Boolean(m.isThirdPlaceMatch) || stage.includes('3rd') || stage.includes('third') || stage.includes('bronze');
    const isFinal = !isThird && !isPlayIn && (stage.includes('grand final') || (stage.includes('final') && !stage.includes('semi') && !stage.includes('quarter') && !stage.includes('16') && !stage.includes('32') && !stage.includes('octa')));

    const processActiveParticipant = (pId?: string | null) => {
      if (!pId) return;
      const stat = findStat(pId);
      if (!stat) return;
      markParticipation(stat.idolId, null, currentSeasonId);
      if (!isPlayIn) {
        addMilestone(seasonGroupAdvancementMap, stat.idolId, currentSeasonId);
      }

      if (isThird) {
        addMilestone(seasonTop4Map, stat.idolId, currentSeasonId);
        if (m.winnerId === stat.idolId && m.completed) {
          addMilestone(seasonThirdPlaceMap, stat.idolId, currentSeasonId);
          updateRankForIdol(stat.idolId, stat.idolName, 8, '3rd Place');
        } else if (m.completed) {
          addMilestone(seasonFourthPlaceMap, stat.idolId, currentSeasonId);
          updateRankForIdol(stat.idolId, stat.idolName, 7, '4th Place');
        } else {
          updateRankForIdol(stat.idolId, stat.idolName, 8, '3rd Place Match');
        }
      } else if (isFinal) {
        addMilestone(seasonTop4Map, stat.idolId, currentSeasonId);
        if (m.winnerId === stat.idolId && m.completed) {
          addMilestone(seasonChampionMap, stat.idolId, currentSeasonId);
          updateRankForIdol(stat.idolId, stat.idolName, 10, 'Champion');
        } else if (m.completed) {
          addMilestone(seasonRunnerUpMap, stat.idolId, currentSeasonId);
          updateRankForIdol(stat.idolId, stat.idolName, 9, 'Runner-Up');
        } else {
          updateRankForIdol(stat.idolId, stat.idolName, 9, 'Grand Finalist');
        }
      } else if (stage.includes('semi')) {
        addMilestone(seasonTop4Map, stat.idolId, currentSeasonId);
        updateRankForIdol(stat.idolId, stat.idolName, 6, 'Semi-Finals');
      } else if (stage.includes('quarter')) {
        addMilestone(seasonQuarterFinalsMap, stat.idolId, currentSeasonId);
        updateRankForIdol(stat.idolId, stat.idolName, 5, 'Quarter-Finals');
      } else if (stage.includes('16') || stage.includes('r16')) {
        addMilestone(seasonRoundOf16Map, stat.idolId, currentSeasonId);
        updateRankForIdol(stat.idolId, stat.idolName, 4, 'Round of 16');
      } else if (stage.includes('32') || stage.includes('r32')) {
        addMilestone(seasonRoundOf32Map, stat.idolId, currentSeasonId);
        updateRankForIdol(stat.idolId, stat.idolName, 3, 'Round of 32');
      } else if (isPlayIn) {
        addMilestone(seasonPlayInsMap, stat.idolId, currentSeasonId);
        updateRankForIdol(stat.idolId, stat.idolName, 2, 'Play-In Round');
      }
    };

    if (m.idolAId) processActiveParticipant(m.idolAId);
    if (m.idolBId) processActiveParticipant(m.idolBId);
  });

  // 3. Process Match-by-Match Statistics from Permanent Tournament Match Database
  const playerMatchHistory = new Map<string, { win: boolean; draw: boolean }[]>();

  safeMatchDatabase.forEach((m) => {
    const sId = Number(m.seasonId || 1);
    const stage = (m.stage || '').toLowerCase();
    const groupName = (m.groupName || '').toLowerCase();
    const matchId = (m.matchId || '').toLowerCase();

    // Strictly skip league matches and The Idols matches in tournament cup computeCareerStats
    const isLeagueMatch =
      matchId.startsWith('league-') ||
      matchId.startsWith('league_') ||
      (stage.includes('division') && !stage.includes('the idols')) ||
      (stage.includes('league') && !stage.includes('the idols') && !stage.includes('superleague')) ||
      (groupName.includes('division') && !groupName.includes('the idols')) ||
      (groupName.includes('league') && !groupName.includes('the idols') && !groupName.includes('superleague'));
    if (isLeagueMatch) return;

    const isTheIdols = matchId.startsWith('the_idols') || stage.includes('the idols') || groupName.includes('the idols');
    if (isTheIdols) return;

    const isGroup = stage.includes('group');
    const isPlayIn = stage.includes('play-in') || stage.includes('playin') || stage.includes('wildcard') || groupName.includes('play-in');
    const isThird = stage.includes('3rd') || stage.includes('third') || stage.includes('bronze');
    const isFinal = !isThird && !isPlayIn && (stage.includes('grand final') || (stage.includes('final') && !stage.includes('semi') && !stage.includes('quarter') && !stage.includes('16') && !stage.includes('32') && !stage.includes('octa') && !stage.includes('ub final') && !stage.includes('lb final')));

    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    const isDraw = Boolean(m.isDraw || scoreA === scoreB || m.winnerId === 'DRAW');

    const statA = findStat(m.idolAId, m.idolAName);
    const statB = findStat(m.idolBId, m.idolBName);

    if (statA) {
      markParticipation(statA.idolId, null, sId);
      if (isGroup) addMilestone(seasonGroupParticipationMap, statA.idolId, sId);
    }
    if (statB) {
      markParticipation(statB.idolId, null, sId);
      if (isGroup) addMilestone(seasonGroupParticipationMap, statB.idolId, sId);
    }

    const processStage = (stat: CareerStat) => {
      if (!isGroup && !isPlayIn) {
        addMilestone(seasonGroupAdvancementMap, stat.idolId, sId);
      }
      if (isThird) {
        addMilestone(seasonTop4Map, stat.idolId, sId);
        if (m.winnerId === stat.idolId || m.winnerName === stat.idolName) {
          addMilestone(seasonThirdPlaceMap, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 8, '3rd Place');
        } else {
          addMilestone(seasonFourthPlaceMap, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 7, '4th Place');
        }
      } else if (isFinal) {
        addMilestone(seasonTop4Map, stat.idolId, sId);
        if (m.winnerId === stat.idolId || m.winnerName === stat.idolName) {
          addMilestone(seasonChampionMap, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 10, 'Champion');
        } else {
          addMilestone(seasonRunnerUpMap, stat.idolId, sId);
          updateRankForIdol(stat.idolId, stat.idolName, 9, 'Runner-Up');
        }
      } else if (stage.includes('semi')) {
        addMilestone(seasonTop4Map, stat.idolId, sId);
        updateRankForIdol(stat.idolId, stat.idolName, 6, 'Semi-Finals');
      } else if (stage.includes('quarter')) {
        addMilestone(seasonQuarterFinalsMap, stat.idolId, sId);
        updateRankForIdol(stat.idolId, stat.idolName, 5, 'Quarter-Finals');
      } else if (stage.includes('16') || stage.includes('r16')) {
        addMilestone(seasonRoundOf16Map, stat.idolId, sId);
        updateRankForIdol(stat.idolId, stat.idolName, 4, 'Round of 16');
      } else if (stage.includes('32') || stage.includes('r32')) {
        addMilestone(seasonRoundOf32Map, stat.idolId, sId);
        updateRankForIdol(stat.idolId, stat.idolName, 3, 'Round of 32');
      } else if (isPlayIn) {
        addMilestone(seasonPlayInsMap, stat.idolId, sId);
        updateRankForIdol(stat.idolId, stat.idolName, 2, 'Play-In Round');
      } else if (stage.includes('group')) {
        updateRankForIdol(stat.idolId, stat.idolName, 1, 'Group Stage');
      }
    };

    // --- IDOL A STATS ---
    if (statA) {
      statA.matches++;
      statA.gamesFor += scoreA;
      statA.gamesAgainst += scoreB;
      processStage(statA);

      if (!playerMatchHistory.has(statA.idolId)) playerMatchHistory.set(statA.idolId, []);
      const history = playerMatchHistory.get(statA.idolId)!;

      const isWinnerA = !isDraw && (m.winnerId === statA.idolId || m.winnerId === m.idolAId || m.winnerName === statA.idolName || (scoreA > scoreB && m.winnerId !== statB?.idolId));

      if (isWinnerA) {
        statA.wins++;
        if (isGroup) statA.groupWins++;
        else statA.knockoutWins++;
        history.push({ win: true, draw: false });
      } else if (isDraw) {
        statA.draws++;
        history.push({ win: false, draw: true });
      } else {
        statA.losses++;
        if (isGroup) statA.groupLosses++;
        else statA.knockoutLosses++;
        history.push({ win: false, draw: false });
      }
    }

    // --- IDOL B STATS ---
    if (statB) {
      statB.matches++;
      statB.gamesFor += scoreB;
      statB.gamesAgainst += scoreA;
      processStage(statB);

      if (!playerMatchHistory.has(statB.idolId)) playerMatchHistory.set(statB.idolId, []);
      const history = playerMatchHistory.get(statB.idolId)!;

      const isWinnerB = !isDraw && (m.winnerId === statB.idolId || m.winnerId === m.idolBId || m.winnerName === statB.idolName || (scoreB > scoreA && m.winnerId !== statA?.idolId));

      if (isWinnerB) {
        statB.wins++;
        if (isGroup) statB.groupWins++;
        else statB.knockoutWins++;
        history.push({ win: true, draw: false });
      } else if (isDraw) {
        statB.draws++;
        history.push({ win: false, draw: true });
      } else {
        statB.losses++;
        if (isGroup) statB.groupLosses++;
        else statB.knockoutLosses++;
        history.push({ win: false, draw: false });
      }
    }
  });

  // 4. Calculate Final Aggregates, Streaks, and Milestone Counts
  idolMap.forEach((stat, id) => {
    // Participations (Tournament Cup seasons played)
    const seasonsSet = idolSeasonsMap.get(id);
    stat.participations = seasonsSet ? seasonsSet.size : stat.matches > 0 ? 1 : 0;

    // Milestones (guaranteed no double-counting)
    stat.championships = seasonChampionMap.get(id)?.size || 0;
    stat.runnerUps = seasonRunnerUpMap.get(id)?.size || 0;
    stat.thirdPlaces = seasonThirdPlaceMap.get(id)?.size || 0;
    stat.fourthPlaces = seasonFourthPlaceMap.get(id)?.size || 0;
    stat.top4 = seasonTop4Map.get(id)?.size || 0;
    stat.quarterFinals = seasonQuarterFinalsMap.get(id)?.size || 0;
    stat.roundOf16 = seasonRoundOf16Map.get(id)?.size || 0;
    stat.roundOf32 = seasonRoundOf32Map.get(id)?.size || 0;
    stat.playIns = seasonPlayInsMap.get(id)?.size || 0;

    // Group advancements = verified seasons where idol advanced to knockout
    const advSeasons = seasonGroupAdvancementMap.get(id) || new Set<number>();
    stat.groupAdvancements = advSeasons.size;

    // Group exits = ONLY seasons where idol participated in a concluded group stage AND did not advance
    // An idol who advanced to knockout in that season CANNOT have a group exit for that season
    const groupSeasons = seasonGroupParticipationMap.get(id) || new Set<number>();
    let exitCount = 0;
    groupSeasons.forEach((sId) => {
      if (!advSeasons.has(sId)) {
        exitCount++;
      }
    });

    // Also include any explicit verified group exit recordings, provided the idol did NOT advance in that season
    const explicitExits = seasonGroupExitMap.get(id) || new Set<number>();
    explicitExits.forEach((sId) => {
      if (!advSeasons.has(sId) && !groupSeasons.has(sId)) {
        exitCount++;
      }
    });

    stat.groupExits = exitCount;

    stat.gameDiff = stat.gamesFor - stat.gamesAgainst;
    stat.winRate = stat.matches > 0 ? Math.round((stat.wins / stat.matches) * 1000) / 10 : 0;

    const groupTotal = stat.groupWins + stat.groupLosses;
    stat.groupWinRate = groupTotal > 0 ? Math.round((stat.groupWins / groupTotal) * 1000) / 10 : 0;

    const knockoutTotal = stat.knockoutWins + stat.knockoutLosses;
    stat.knockoutWinRate =
      knockoutTotal > 0 ? Math.round((stat.knockoutWins / knockoutTotal) * 1000) / 10 : 0;

    // Streaks
    const history = playerMatchHistory.get(id) || [];
    let curWin = 0,
      maxWin = 0;
    let curLoss = 0,
      maxLoss = 0;
    let curUnbeaten = 0,
      maxUnbeaten = 0;

    history.forEach((h) => {
      if (h.win) {
        curWin++;
        curLoss = 0;
        curUnbeaten++;
      } else if (h.draw) {
        curWin = 0;
        curLoss = 0;
        curUnbeaten++;
      } else {
        curWin = 0;
        curLoss++;
        curUnbeaten = 0;
      }
      if (curWin > maxWin) maxWin = curWin;
      if (curLoss > maxLoss) maxLoss = curLoss;
      if (curUnbeaten > maxUnbeaten) maxUnbeaten = curUnbeaten;
    });

    stat.longestWinStreak = maxWin;
    stat.longestLosingStreak = maxLoss;
    stat.longestUnbeatenStreak = maxUnbeaten;

    // Best Finish Title
    const bestInfo = idolBestRankMap.get(id);
    if (bestInfo && bestInfo.rank > 0) {
      stat.bestFinish = bestInfo.label;
    } else if (stat.championships > 0) stat.bestFinish = 'Champion';
    else if (stat.runnerUps > 0) stat.bestFinish = 'Runner-Up';
    else if (stat.thirdPlaces > 0) stat.bestFinish = '3rd Place';
    else if (stat.fourthPlaces > 0) stat.bestFinish = '4th Place';
    else if (stat.top4 > 0) stat.bestFinish = 'Top 4';
    else if (stat.matches > 0) stat.bestFinish = 'Group Stage';
    else stat.bestFinish = 'N/A';

    // Worst Finish Title
    const worstInfo = idolWorstRankMap.get(id);
    if (worstInfo && worstInfo.rank > 0) {
      stat.worstFinish = worstInfo.label;
    } else if (stat.matches > 0) {
      stat.worstFinish = 'Group Stage';
    } else {
      stat.worstFinish = 'N/A';
    }
  });

  const list = Array.from(idolMap.values());
  list.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.runnerUps !== a.runnerUps) return b.runnerUps - a.runnerUps;
    if (b.thirdPlaces !== a.thirdPlaces) return b.thirdPlaces - a.thirdPlaces;
    if (b.top4 !== a.top4) return b.top4 - a.top4;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.gameDiff - a.gameDiff;
  });

  return list;
}

/**
 * Synchronizes and consolidates all completed matches from:
 * 1. Existing permanent matchDatabase records
 * 2. All past tournament archives (both groups and knockout matches)
 * 3. Active tournament groups and matches
 * 4. Active tournament knockout matches
 *
 * Guarantees:
 * - Full preservation of DRAW matches (winnerId: 'DRAW', winnerName: 'Draw', isDraw: true)
 * - Safe idol name and group resolution across seasons
 * - Unique, permanent, season-scoped match keys
 * - No data loss across season transitions or resets
 */
export function syncAllMatchesToDatabase(
  existingMatchDb: ArchivedMatch[] = [],
  archives: TournamentArchive[] = [],
  currentConfig?: TournamentConfig,
  currentGroups: Group[] = [],
  currentKnockoutMatches: KnockoutMatch[] = [],
  allIdols: Idol[] = []
): ArchivedMatch[] {
  const safeMatchDb = Array.isArray(existingMatchDb) ? existingMatchDb : [];
  const safeArchives = Array.isArray(archives) ? archives : [];
  const safeGroups = Array.isArray(currentGroups) ? currentGroups : [];
  const safeKnockoutMatches = Array.isArray(currentKnockoutMatches) ? currentKnockoutMatches : [];
  const safeAllIdols = Array.isArray(allIdols) ? allIdols : [];

  const map = new Map<string, ArchivedMatch>();

  // Helper maps for idol identification
  const idolsById = new Map<string, Idol>();
  const idolsByName = new Map<string, Idol>();
  safeAllIdols.forEach((i) => {
    if (i.id) idolsById.set(i.id, i);
    if (i.name) idolsByName.set(i.name.trim().toLowerCase(), i);
  });

  const resolveIdol = (id?: string | null, fallbackName?: string) => {
    if (id && idolsById.has(id)) return idolsById.get(id);
    if (fallbackName) {
      const lower = fallbackName.trim().toLowerCase();
      if (idolsByName.has(lower)) return idolsByName.get(lower);
    }
    return null;
  };

  const currentSeasonId = Number(currentConfig?.seasonId || 1);
  const currentSeasonName = currentConfig?.seasonName || `Season ${currentSeasonId}`;

  // 1. Ingest existing permanent matchDatabase (excluding active current season so resets/deletions take effect immediately)
  safeMatchDb.forEach((m, idx) => {
    if (!m) return;
    const sId = Number(m.seasonId || 1);
    if (currentConfig?.isStarted && sId === currentSeasonId) {
      // Exclude active current season records; they will be accurately re-synced from currentGroups & currentKnockoutMatches
      return;
    }
    const scoreA = Number(m.scoreA ?? 0);
    const scoreB = Number(m.scoreB ?? 0);
    const isDraw = Boolean(m.isDraw || scoreA === scoreB || m.winnerId === 'DRAW');

    const idolAObj = resolveIdol(m.idolAId, m.idolAName);
    const idolBObj = resolveIdol(m.idolBId, m.idolBName);

    const idolAId = m.idolAId || idolAObj?.id || `idol-a-${idx}`;
    const idolAName = idolAObj?.name || m.idolAName || 'Unknown Idol A';
    const idolAGroup = m.idolAGroup || idolAObj?.girlGroup || 'Solo / Independent';

    const idolBId = m.idolBId || idolBObj?.id || `idol-b-${idx}`;
    const idolBName = m.idolBName || idolBObj?.name || 'Unknown Idol B';
    const idolBGroup = m.idolBGroup || idolBObj?.girlGroup || 'Solo / Independent';

    let winnerId = m.winnerId;
    let winnerName = m.winnerName;

    if (isDraw) {
      winnerId = 'DRAW';
      winnerName = 'Draw';
    } else if (!winnerId || !winnerName) {
      if (scoreA > scoreB) {
        winnerId = idolAId;
        winnerName = idolAName;
      } else if (scoreB > scoreA) {
        winnerId = idolBId;
        winnerName = idolBName;
      } else {
        winnerId = 'DRAW';
        winnerName = 'Draw';
      }
    }

    const loserId = isDraw ? '' : (winnerId === idolAId ? idolBId : idolAId);
    const loserName = isDraw ? '' : (winnerId === idolAId ? idolBName : idolAName);

    const key = m.matchId || `match_s${sId}_${(m.stage || 'stage').toLowerCase().replace(/\s+/g, '_')}_${idx}_${idolAId}_vs_${idolBId}`;

    map.set(key, {
      ...m,
      matchId: key,
      seasonId: sId,
      seasonName: m.seasonName || `Season ${sId}`,
      stage: m.stage || 'Group Stage',
      groupName: m.groupName || undefined,
      idolAId,
      idolAName,
      idolAGroup,
      idolBId,
      idolBName,
      idolBGroup,
      scoreA,
      scoreB,
      winnerId: winnerId || '',
      winnerName: winnerName || '',
      loserId: loserId || '',
      loserName: loserName || '',
      isDraw,
      date: m.date || new Date().toISOString(),
    });
  });

  // 2. Ingest past archives
  safeArchives.forEach((arch) => {
    if (!arch) return;
    const sId = Number(arch.seasonId || 1);
    const sName = arch.seasonName || `Season ${sId}`;
    const archDate = arch.completedAt || new Date().toISOString();

    // Group matches in archive
    (arch.groups || []).forEach((g: any, gIdx: number) => {
      const gName = g?.name || `Group ${String.fromCharCode(65 + gIdx)}`;
      const gId = g?.id || `group-${gIdx}`;

      (g?.matches || []).forEach((m: any, mIdx: number) => {
        if (m && (m.completed || (m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined))) {
          const scoreA = Number(m.scoreA ?? 0);
          const scoreB = Number(m.scoreB ?? 0);
          const isDraw = Boolean(scoreA === scoreB || m.winnerId === 'DRAW');

          const idolAObj = resolveIdol(m.idolAId, m.idolAName);
          const idolBObj = resolveIdol(m.idolBId, m.idolBName);

          const idolAId = m.idolAId || idolAObj?.id || `arch-${sId}-g-${gIdx}-a-${mIdx}`;
          const idolAName = idolAObj?.name || m.idolAName || (m.idolAId ? `Idol ${m.idolAId}` : 'Unknown');
          const idolAGroup = idolAObj?.girlGroup || m.idolAGroup || 'Solo / Independent';

          const idolBId = m.idolBId || idolBObj?.id || `arch-${sId}-g-${gIdx}-b-${mIdx}`;
          const idolBName = idolBObj?.name || m.idolBName || (m.idolBId ? `Idol ${m.idolBId}` : 'Unknown');
          const idolBGroup = idolBObj?.girlGroup || m.idolBGroup || 'Solo / Independent';

          let winnerId = isDraw ? 'DRAW' : (scoreA > scoreB ? idolAId : idolBId);
          if (!isDraw && m.winnerId && m.winnerId !== 'DRAW') winnerId = m.winnerId;

          const winnerName = isDraw ? 'Draw' : (winnerId === idolAId ? idolAName : idolBName);
          const loserId = isDraw ? '' : (winnerId === idolAId ? idolBId : idolAId);
          const loserName = isDraw ? '' : (winnerId === idolAId ? idolBName : idolAName);

          const key = `s${sId}_Group_${gId}_${m.id || `m-${mIdx}`}`;
          if (!map.has(key)) {
            map.set(key, {
              matchId: key,
              seasonId: sId,
              seasonName: sName,
              stage: 'Group Stage',
              groupName: gName,
              idolAId,
              idolAName,
              idolAGroup,
              idolBId,
              idolBName,
              idolBGroup,
              scoreA,
              scoreB,
              winnerId,
              winnerName,
              loserId,
              loserName,
              isDraw,
              date: m.date || archDate,
            });
          }
        }
      });
    });

    // Knockout matches in archive
    (arch.knockoutMatches || []).forEach((m: any, mIdx: number) => {
      if (m && (m.completed || (m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined))) {
        const scoreA = Number(m.scoreA ?? 0);
        const scoreB = Number(m.scoreB ?? 0);
        const isDraw = Boolean(scoreA === scoreB);

        const idolAObj = resolveIdol(m.idolAId, m.idolAName);
        const idolBObj = resolveIdol(m.idolBId, m.idolBName);

        const idolAId = m.idolAId || idolAObj?.id || `arch-${sId}-ko-a-${mIdx}`;
        const idolAName = idolAObj?.name || m.idolAName || (m.idolAId ? `Idol ${m.idolAId}` : 'Unknown');
        const idolAGroup = idolAObj?.girlGroup || m.idolAGroup || 'Solo / Independent';

        const idolBId = m.idolBId || idolBObj?.id || `arch-${sId}-ko-b-${mIdx}`;
        const idolBName = idolBObj?.name || m.idolBName || (m.idolBId ? `Idol ${m.idolBId}` : 'Unknown');
        const idolBGroup = idolBObj?.girlGroup || m.idolBGroup || 'Solo / Independent';

        let winnerId = scoreA > scoreB ? idolAId : idolBId;
        if (m.winnerId) winnerId = m.winnerId;

        const winnerName = isDraw ? 'Draw' : (winnerId === idolAId ? idolAName : idolBName);
        const loserId = isDraw ? '' : (winnerId === idolAId ? idolBId : idolAId);
        const loserName = isDraw ? '' : (winnerId === idolAId ? idolBName : idolAName);

        const key = `s${sId}_Knockout_${m.id || `ko-${mIdx}`}`;
        if (!map.has(key)) {
          map.set(key, {
            matchId: key,
            seasonId: sId,
            seasonName: sName,
            stage: m.roundName || 'Knockout',
            idolAId,
            idolAName,
            idolAGroup,
            idolBId,
            idolBName,
            idolBGroup,
            scoreA,
            scoreB,
            winnerId,
            winnerName,
            loserId,
            loserName,
            isDraw,
            date: m.date || archDate,
          });
        }
      }
    });
  });

  // 3. Ingest active current season tournament
  // Current groups
  safeGroups.forEach((g, gIdx) => {
    const gName = g.name || `Group ${String.fromCharCode(65 + gIdx)}`;
    const gId = g.id || `group-${gIdx}`;

    (g.matches || []).forEach((m, mIdx) => {
      if (m.completed || (m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined)) {
        const scoreA = Number(m.scoreA ?? 0);
        const scoreB = Number(m.scoreB ?? 0);
        const isDraw = Boolean(scoreA === scoreB || m.winnerId === 'DRAW');

        const idolAObj = resolveIdol(m.idolAId);
        const idolBObj = resolveIdol(m.idolBId);

        const idolAId = m.idolAId || idolAObj?.id || `curr-a-${mIdx}`;
        const idolAName = idolAObj?.name || (m.idolAId ? `Idol ${m.idolAId}` : 'Unknown');
        const idolAGroup = idolAObj?.girlGroup || 'Solo / Independent';

        const idolBId = m.idolBId || idolBObj?.id || `curr-b-${mIdx}`;
        const idolBName = idolBObj?.name || (m.idolBId ? `Idol ${m.idolBId}` : 'Unknown');
        const idolBGroup = idolBObj?.girlGroup || 'Solo / Independent';

        let winnerId = isDraw ? 'DRAW' : (scoreA > scoreB ? idolAId : idolBId);
        if (!isDraw && m.winnerId && m.winnerId !== 'DRAW') winnerId = m.winnerId;

        const winnerName = isDraw ? 'Draw' : (winnerId === idolAId ? idolAName : idolBName);
        const loserId = isDraw ? '' : (winnerId === idolAId ? idolBId : idolAId);
        const loserName = isDraw ? '' : (winnerId === idolAId ? idolBName : idolAName);

        const key = `s${currentSeasonId}_Group_${gId}_${m.id || `m-${mIdx}`}`;
        map.set(key, {
          matchId: key,
          seasonId: currentSeasonId,
          seasonName: currentSeasonName,
          stage: 'Group Stage',
          groupName: gName,
          idolAId,
          idolAName,
          idolAGroup,
          idolBId,
          idolBName,
          idolBGroup,
          scoreA,
          scoreB,
          winnerId,
          winnerName,
          loserId,
          loserName,
          isDraw,
          date: m.updatedAt || new Date().toISOString(),
        });
      }
    });
  });

  // Current knockouts
  safeKnockoutMatches.forEach((m, mIdx) => {
    if (m.completed || (m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined)) {
      const scoreA = Number(m.scoreA ?? 0);
      const scoreB = Number(m.scoreB ?? 0);
      const isDraw = Boolean(scoreA === scoreB);

      const idolAObj = resolveIdol(m.idolAId);
      const idolBObj = resolveIdol(m.idolBId);

      const idolAId = m.idolAId || idolAObj?.id || `curr-ko-a-${mIdx}`;
      const idolAName = idolAObj?.name || (m.idolAId ? `Idol ${m.idolAId}` : 'Unknown');
      const idolAGroup = idolAObj?.girlGroup || 'Solo / Independent';

      const idolBId = m.idolBId || idolBObj?.id || `curr-ko-b-${mIdx}`;
      const idolBName = idolBObj?.name || (m.idolBId ? `Idol ${m.idolBId}` : 'Unknown');
      const idolBGroup = idolBObj?.girlGroup || 'Solo / Independent';

      let winnerId = scoreA > scoreB ? idolAId : idolBId;
      if (m.winnerId) winnerId = m.winnerId;

      const winnerName = isDraw ? 'Draw' : (winnerId === idolAId ? idolAName : idolBName);
      const loserId = isDraw ? '' : (winnerId === idolAId ? idolBId : idolAId);
      const loserName = isDraw ? '' : (winnerId === idolAId ? idolBName : idolAName);

      const key = `s${currentSeasonId}_Knockout_${m.id || `ko-${mIdx}`}`;
      map.set(key, {
        matchId: key,
        seasonId: currentSeasonId,
        seasonName: currentSeasonName,
        stage: m.roundName || 'Knockout',
        idolAId,
        idolAName,
        idolAGroup,
        idolBId,
        idolBName,
        idolBGroup,
        scoreA,
        scoreB,
        winnerId,
        winnerName,
        loserId,
        loserName,
        isDraw,
        date: m.updatedAt || new Date().toISOString(),
      });
    }
  });

  return Array.from(map.values());
}

export function updateGroupMatchScore(
  group: Group,
  matchId: string,
  scoreA: number,
  scoreB: number,
  winnerId: string,
  allIdols?: Idol[]
): Group {
  const updatedMatches = group.matches.map((m) => {
    if (m.id === matchId) {
      return {
        ...m,
        scoreA,
        scoreB,
        winnerId,
        completed: true,
      };
    }
    return m;
  });

  const updatedStandings = calculateGroupStandings(
    group.memberIds,
    updatedMatches,
    2
  );

  return {
    ...group,
    matches: updatedMatches,
    standings: updatedStandings,
  };
}

export function updateKnockoutMatchScore(
  matches: KnockoutMatch[],
  matchId: string,
  scoreA: number,
  scoreB: number,
  winnerId: string
): KnockoutMatch[] {
  let updated = matches.map((m) => {
    if (m.id === matchId) {
      return {
        ...m,
        scoreA,
        scoreB,
        winnerId,
        completed: true,
      };
    }
    return m;
  });

  const targetMatch = updated.find((m) => m.id === matchId);
  if (!targetMatch) return updated;

  const loserId =
    targetMatch.idolAId === winnerId ? targetMatch.idolBId : targetMatch.idolAId;

  // 1. Advance winner to next match slot (e.g., Semi -> Grand Final)
  if (targetMatch.feedsIntoMatchId && targetMatch.feedsIntoSlot) {
    const nextMatchId = targetMatch.feedsIntoMatchId;
    const slot = targetMatch.feedsIntoSlot;

    updated = updated.map((m) => {
      if (m.id === nextMatchId) {
        if (slot === 'A') return { ...m, idolAId: winnerId };
        if (slot === 'B') return { ...m, idolBId: winnerId };
      }
      return m;
    });
  }

  // 2. Handle Semifinal loser feeding into Third Place match
  const isSemiFinal =
    targetMatch.roundName.toLowerCase().includes('semi') ||
    targetMatch.feedsIntoMatchId === 'ko-final-1';

  if (isSemiFinal && loserId) {
    const semiMatches = updated.filter(
      (m) =>
        m.roundName.toLowerCase().includes('semi') ||
        m.feedsIntoMatchId === 'ko-final-1'
    );
    const semiIdx = semiMatches.findIndex((m) => m.id === targetMatch.id);

    updated = updated.map((m) => {
      if (m.isThirdPlaceMatch) {
        if (semiIdx === 0) {
          return { ...m, idolAId: loserId };
        } else if (semiIdx === 1) {
          return { ...m, idolBId: loserId };
        } else {
          if (!m.idolAId) return { ...m, idolAId: loserId };
          if (!m.idolBId && m.idolAId !== loserId) return { ...m, idolBId: loserId };
        }
      }
      return m;
    });
  }

  return updated;
}

export function resetGroupMatch(
  groups: Group[],
  groupId: string,
  matchId: string,
  qualifiedPerGroup: number = 2
): Group[] {
  return (groups || []).map((group) => {
    if (group.id === groupId) {
      const updatedMatches = group.matches.map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            scoreA: null,
            scoreB: null,
            winnerId: null,
            completed: false,
          };
        }
        return m;
      });

      const updatedStandings = calculateGroupStandings(
        group.memberIds,
        updatedMatches,
        qualifiedPerGroup
      );

      return {
        ...group,
        matches: updatedMatches,
        standings: updatedStandings,
      };
    }
    return group;
  });
}

export function resetKnockoutMatch(
  matches: KnockoutMatch[],
  matchId: string
): KnockoutMatch[] {
  let updated = (matches || []).map((m) => {
    if (m.id === matchId) {
      return {
        ...m,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        completed: false,
      };
    }
    return m;
  });

  const targetMatch = matches.find((m) => m.id === matchId);
  if (targetMatch && targetMatch.feedsIntoMatchId) {
    const slot = targetMatch.feedsIntoSlot || 'A';
    updated = updated.map((m) => {
      if (m.id === targetMatch.feedsIntoMatchId) {
        if (slot === 'A') return { ...m, idolAId: null, completed: false, scoreA: null, scoreB: null, winnerId: null };
        if (slot === 'B') return { ...m, idolBId: null, completed: false, scoreA: null, scoreB: null, winnerId: null };
      }
      return m;
    });
  }

  return updated;
}

export function getAllSeasonArchives(
  archives: TournamentArchive[] = [],
  matchDatabase: ArchivedMatch[] = [],
  idolsMap: Map<string, Idol>,
  currentConfig?: TournamentConfig,
  currentGroups?: Group[],
  currentKnockoutMatches?: KnockoutMatch[],
  activeSeasonNumber?: number
): TournamentArchive[] {
  const safeArchives = Array.isArray(archives) ? archives : [];
  const safeMatchDb = Array.isArray(matchDatabase) ? matchDatabase : [];
  const safeGroups = Array.isArray(currentGroups) ? currentGroups : [];
  const safeKnockout = Array.isArray(currentKnockoutMatches) ? currentKnockoutMatches : [];

  const archivesMap = new Map<number, TournamentArchive>();

  // 1. Add explicit saved archives
  safeArchives.forEach((a) => {
    if (!a) return;
    const sId = Number(a.seasonId || 1);
    archivesMap.set(sId, {
      ...a,
      seasonId: sId,
      seasonName: a.seasonName || `Season ${sId}`,
      groups: a.groups || [],
      knockoutMatches: a.knockoutMatches || [],
    });
  });

  const explicitActiveSeasonNum =
    activeSeasonNumber !== undefined
      ? activeSeasonNumber
      : (currentConfig ? Number(currentConfig.seasonId || currentConfig.seasonNumber || 1) : undefined);

  // 2. Discover all unique seasons in matchDatabase or currentConfig (filtering strictly to tournament cup)
  const seasonIdsSet = new Set<number>();
  safeArchives.forEach((a) => a && seasonIdsSet.add(Number(a.seasonId || 1)));
  safeMatchDb.forEach((m) => {
    if (!m || !m.seasonId) return;
    const sId = Number(m.seasonId);
    // Never synthesize an archive from matchDatabase for the active unarchived season!
    if (explicitActiveSeasonNum !== undefined && sId >= explicitActiveSeasonNum && !archivesMap.has(sId)) {
      return;
    }
    if (m.matchId?.startsWith('the_idols_') || m.matchId?.startsWith('league_')) return;
    const st = (m.stage || '').toLowerCase();
    if (st.includes('the idols') || st.includes('league')) return;
    if (m.groupName === 'The Idols Superleague' || m.groupName === 'The Idols Masters Playoff') return;
    seasonIdsSet.add(sId);
  });
  const activeSeasonNum = Number(currentConfig?.seasonId || currentConfig?.seasonNumber || 1);
  if (currentConfig) {
    seasonIdsSet.add(activeSeasonNum);
  }

  // Convert to sorted array
  const allSeasonIds = Array.from(seasonIdsSet).sort((a, b) => a - b);

  allSeasonIds.forEach((sId) => {
    let existing = archivesMap.get(sId);

    const seasonMatches = safeMatchDb.filter((m) => {
      if (!m || Number(m.seasonId) !== sId) return false;
      if (m.matchId?.startsWith('the_idols_') || m.matchId?.startsWith('league_')) return false;
      const st = (m.stage || '').toLowerCase();
      if (st.includes('the idols') || st.includes('league')) return false;
      if (m.groupName === 'The Idols Superleague' || m.groupName === 'The Idols Masters Playoff') return false;
      return true;
    });

    const isCurrentActive =
      Boolean(currentConfig) && activeSeasonNum === sId;

    // Groups resolution
    let resolvedGroups: Group[] = existing?.groups && existing.groups.length > 0 ? existing.groups : [];
    if (resolvedGroups.length === 0 && isCurrentActive && safeGroups.length > 0) {
      resolvedGroups = safeGroups;
    }

    // Knockout resolution
    let resolvedKnockout: KnockoutMatch[] =
      existing?.knockoutMatches && existing.knockoutMatches.length > 0
        ? existing.knockoutMatches
        : [];
    if (resolvedKnockout.length === 0 && isCurrentActive && safeKnockout.length > 0) {
      resolvedKnockout = safeKnockout;
    }

    // Winner / Podium resolution
    let championId = existing?.championId || '';
    let championName = existing?.championName || '';
    let runnerUpId = existing?.runnerUpId || '';
    let runnerUpName = existing?.runnerUpName || '';
    let thirdPlaceId = existing?.thirdPlaceId || '';
    let thirdPlaceName = existing?.thirdPlaceName || '';
    let fourthPlaceId = existing?.fourthPlaceId || '';
    let fourthPlaceName = existing?.fourthPlaceName || '';

    const isUncrowned =
      !championName ||
      championName === 'In Progress' ||
      championName === 'Pending' ||
      championName === 'Unknown';

    // If winners are missing or uncrowned in existing archive, detect from knockout matches
    if (isUncrowned && resolvedKnockout.length > 0) {
      let gfMatch = resolvedKnockout.find(
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

      if (!gfMatch) {
        gfMatch = resolvedKnockout.find(
          (m) =>
            !m.isThirdPlaceMatch &&
            (m.id?.includes('final-1') || m.id?.includes('ko-final') || m.id?.includes('grandfinal'))
        );
      }

      if (gfMatch && gfMatch.completed && gfMatch.winnerId) {
        championId = gfMatch.winnerId;
        championName = idolsMap.get(championId)?.name || gfMatch.winnerId;
        runnerUpId = gfMatch.winnerId === gfMatch.idolAId ? gfMatch.idolBId || '' : gfMatch.idolAId || '';
        runnerUpName = idolsMap.get(runnerUpId)?.name || runnerUpId;
      }

      const thirdMatch = resolvedKnockout.find(
        (m) =>
          Boolean(m.isThirdPlaceMatch) ||
          (m.roundName || '').toLowerCase().includes('3rd') ||
          (m.roundName || '').toLowerCase().includes('third') ||
          (m.roundName || '').toLowerCase().includes('bronze')
      );
      if (thirdMatch && thirdMatch.completed && thirdMatch.winnerId) {
        thirdPlaceId = thirdMatch.winnerId;
        thirdPlaceName = idolsMap.get(thirdPlaceId)?.name || thirdMatch.winnerId;
        fourthPlaceId = thirdMatch.winnerId === thirdMatch.idolAId ? thirdMatch.idolBId || '' : thirdMatch.idolAId || '';
        fourthPlaceName = idolsMap.get(fourthPlaceId)?.name || fourthPlaceId;
      }
    }

    // If still uncrowned and matches exist in matchDatabase (e.g. season 66, 67)
    const stillUncrowned =
      !championName ||
      championName === 'In Progress' ||
      championName === 'Pending' ||
      championName === 'Unknown';

    if (stillUncrowned && seasonMatches.length > 0) {
      let gfDbMatch = seasonMatches.find((m) => {
        const st = (m.stage || '').toLowerCase();
        return (
          !st.includes('3rd') &&
          !st.includes('third') &&
          !st.includes('bronze') &&
          (st.includes('grand final') ||
            st === 'final' ||
            (st.includes('final') && !st.includes('semi') && !st.includes('quarter') && !st.includes('16') && !st.includes('32')))
        );
      });

      if (!gfDbMatch) {
        gfDbMatch = seasonMatches.find((m) => {
          const mid = (m.matchId || '').toLowerCase();
          return (
            !mid.includes('3rd') &&
            !mid.includes('third') &&
            (mid.includes('final-1') || mid.includes('ko-final') || mid.includes('grandfinal'))
          );
        });
      }

      if (!gfDbMatch) {
        const nonGroupMatches = seasonMatches.filter((m) => {
          const st = (m.stage || '').toLowerCase();
          return !st.includes('group') && !st.includes('3rd') && !st.includes('third') && !st.includes('play-in') && !st.includes('playin');
        });
        if (nonGroupMatches.length > 0) {
          gfDbMatch = nonGroupMatches[nonGroupMatches.length - 1];
        }
      }

      if (gfDbMatch) {
        const winnerId = gfDbMatch.winnerId || (gfDbMatch.scoreA > gfDbMatch.scoreB ? gfDbMatch.idolAId : gfDbMatch.idolBId);
        let winnerName = gfDbMatch.winnerName;
        if (!winnerName || winnerName === 'Draw' || winnerName === 'Unknown') {
          winnerName = idolsMap.get(winnerId)?.name || gfDbMatch.idolAName;
        }

        championId = winnerId;
        championName = winnerName || 'Champion';

        const runId = winnerId === gfDbMatch.idolAId ? gfDbMatch.idolBId : gfDbMatch.idolAId;
        let runName = winnerId === gfDbMatch.idolAId ? gfDbMatch.idolBName : gfDbMatch.idolAName;
        if (!runName || runName === 'Unknown') {
          runName = idolsMap.get(runId)?.name || runId;
        }
        runnerUpId = runId;
        runnerUpName = runName || 'Runner-Up';
      }

      const thirdDbMatch = seasonMatches.find((m) => {
        const st = (m.stage || '').toLowerCase();
        const mid = (m.matchId || '').toLowerCase();
        return st.includes('3rd') || st.includes('third') || st.includes('bronze') || mid.includes('third');
      });

      if (thirdDbMatch) {
        const tId = thirdDbMatch.winnerId || (thirdDbMatch.scoreA > thirdDbMatch.scoreB ? thirdDbMatch.idolAId : thirdDbMatch.idolBId);
        let tName = thirdDbMatch.winnerName;
        if (!tName || tName === 'Draw' || tName === 'Unknown') {
          tName = idolsMap.get(tId)?.name || thirdDbMatch.idolAName;
        }
        thirdPlaceId = tId;
        thirdPlaceName = tName || '3rd Place';

        const fId = tId === thirdDbMatch.idolAId ? thirdDbMatch.idolBId : thirdDbMatch.idolAId;
        let fName = tId === thirdDbMatch.idolAId ? thirdDbMatch.idolBName : thirdDbMatch.idolAName;
        if (!fName || fName === 'Unknown') {
          fName = idolsMap.get(fId)?.name || fId;
        }
        fourthPlaceId = fId;
        fourthPlaceName = fName || '4th Place';
      }
    }

    if (championId && (!championName || championName === 'Unknown' || championName === 'Pending' || championName === 'In Progress')) {
      championName = idolsMap.get(championId)?.name || championName;
    }
    if (runnerUpId && (!runnerUpName || runnerUpName === 'Unknown' || runnerUpName === 'Pending' || runnerUpName === 'In Progress')) {
      runnerUpName = idolsMap.get(runnerUpId)?.name || runnerUpName;
    }
    if (thirdPlaceId && (!thirdPlaceName || thirdPlaceName === 'Unknown' || thirdPlaceName === 'Pending' || thirdPlaceName === 'In Progress')) {
      thirdPlaceName = idolsMap.get(thirdPlaceId)?.name || thirdPlaceName;
    }
    if (fourthPlaceId && (!fourthPlaceName || fourthPlaceName === 'Unknown' || fourthPlaceName === 'Pending' || fourthPlaceName === 'In Progress')) {
      fourthPlaceName = idolsMap.get(fourthPlaceId)?.name || fourthPlaceName;
    }

    const totalParticipants =
      existing?.totalParticipants ||
      (isCurrentActive ? currentConfig?.totalParticipants || 64 : 64);

    archivesMap.set(sId, {
      seasonId: sId,
      seasonName:
        existing?.seasonName ||
        (isCurrentActive ? currentConfig?.seasonName || `Season ${sId}` : `Season ${sId}`),
      completedAt:
        existing?.completedAt ||
        (seasonMatches.length > 0
          ? seasonMatches[seasonMatches.length - 1]?.date || new Date().toISOString()
          : new Date().toISOString()),
      championId,
      championName: championName || 'In Progress',
      runnerUpId,
      runnerUpName: runnerUpName || 'In Progress',
      thirdPlaceId,
      thirdPlaceName: thirdPlaceName || 'In Progress',
      fourthPlaceId: fourthPlaceId || existing?.fourthPlaceId || '',
      fourthPlaceName: fourthPlaceName || existing?.fourthPlaceName || '',
      totalParticipants,
      groups: resolvedGroups,
      knockoutMatches: resolvedKnockout,
    });
  });

  return Array.from(archivesMap.values()).sort((a, b) => Number(a.seasonId) - Number(b.seasonId));
}

/**
 * Checks if the knockout bracket of a tournament has a completed Grand Final with a declared winner,
 * and if so, constructs a complete TournamentArchive record for safe archival.
 */
export function getCompletedTournamentArchiveRecord(
  config: TournamentConfig,
  groups: Group[],
  knockoutMatches: KnockoutMatch[],
  idolsMapParam: Map<string, Idol>
): TournamentArchive | null {
  let grandFinal = (knockoutMatches || []).find(
    (m) =>
      !m.isThirdPlaceMatch &&
      !(m.roundName || '').toLowerCase().includes('3rd') &&
      !(m.roundName || '').toLowerCase().includes('third') &&
      !(m.roundName || '').toLowerCase().includes('bronze') &&
      ((m.roundName || '').toLowerCase().includes('grand final') ||
        (m.roundName || '').toLowerCase() === 'final' ||
        ((m.roundName || '').toLowerCase().includes('final') &&
          !(m.roundName || '').toLowerCase().includes('semi') &&
          !(m.roundName || '').toLowerCase().includes('quarter') &&
          !(m.roundName || '').toLowerCase().includes('16') &&
          !(m.roundName || '').toLowerCase().includes('32')))
  );

  if (!grandFinal) {
    grandFinal = (knockoutMatches || []).find(
      (m) =>
        !m.isThirdPlaceMatch &&
        (m.id?.includes('final-1') || m.id?.includes('ko-final') || m.id?.includes('grandfinal'))
    );
  }

  if (!grandFinal) {
    const nonThirdMatches = (knockoutMatches || []).filter(
      (m) =>
        !m.isThirdPlaceMatch &&
        !(m.roundName || '').toLowerCase().includes('3rd') &&
        !(m.roundName || '').toLowerCase().includes('third')
    );
    if (nonThirdMatches.length > 0) {
      grandFinal = nonThirdMatches[nonThirdMatches.length - 1];
    }
  }

  if (!grandFinal || !grandFinal.completed || !grandFinal.winnerId) {
    return null;
  }

  const thirdPlace = (knockoutMatches || []).find(
    (m) =>
      Boolean(m.isThirdPlaceMatch) ||
      (m.roundName || '').toLowerCase().includes('3rd') ||
      (m.roundName || '').toLowerCase().includes('third') ||
      (m.roundName || '').toLowerCase().includes('bronze')
  );

  const currentSeasonId = Number(config.seasonId || config.seasonNumber || 1);
  const championId = grandFinal.winnerId;
  const runnerUpId =
    grandFinal.winnerId === grandFinal.idolAId
      ? grandFinal.idolBId
      : grandFinal.idolAId;
  const thirdPlaceId = thirdPlace?.winnerId || '';
  const fourthPlaceId =
    thirdPlace && thirdPlace.winnerId
      ? (thirdPlace.winnerId === thirdPlace.idolAId ? thirdPlace.idolBId : thirdPlace.idolAId)
      : '';

  const champion = idolsMapParam.get(championId);
  const runnerUp = idolsMapParam.get(runnerUpId || '');
  const thirdPlaceIdol = thirdPlaceId ? idolsMapParam.get(thirdPlaceId) : null;
  const fourthPlaceIdol = fourthPlaceId ? idolsMapParam.get(fourthPlaceId) : null;

  return {
    seasonId: currentSeasonId,
    seasonName:
      config?.seasonName ||
      `Season ${currentSeasonId}`,
    completedAt: new Date().toISOString(),
    championId,
    championName: champion?.name || 'Unknown',
    runnerUpId: runnerUpId || '',
    runnerUpName: runnerUp?.name || 'Unknown',
    thirdPlaceId,
    thirdPlaceName: thirdPlaceIdol?.name || 'Unknown',
    fourthPlaceId,
    fourthPlaceName: fourthPlaceIdol?.name || 'Unknown',
    totalParticipants: config.totalParticipants,
    groups: groups || [],
    knockoutMatches: knockoutMatches || [],
  };
}

export const deriveCareerStats = computeCareerStats;

/**
 * Convert seed string ('Seed 1', 'Seed 2', etc.) to calibrated numeric strength weight.
 * Calibrated so stronger seeds hold a clear, decisive competitive advantage in simulations:
 * - Seed 1 (85): Dominant top seeds (~92% series win vs Seed 4, ~82% vs Seed 3, ~66% vs Seed 2)
 * - Seed 2 (55): Powerhouse contenders (~85% vs Seed 4, ~70% vs Seed 3)
 * - Seed 3 (32): Solid mid-tier competitors (~71% vs Seed 4)
 * - Seed 4 (18): Underdogs / Lower seeds
 * - Unseeded (22): Wildcard tier
 */
export function getSimulationSeedWeight(seedStr?: string): number {
  if (!seedStr) return 22;
  const match = seedStr.match(/\d+/);
  if (!match) return 22;
  const num = parseInt(match[0], 10);
  switch (num) {
    case 1:
      return 85; // Seed 1: Dominant top seed
    case 2:
      return 55; // Seed 2: Strong powerhouse
    case 3:
      return 32; // Seed 3: Solid contender
    case 4:
      return 18; // Seed 4: Lower seed
    case 5:
      return 14;
    case 6:
      return 10;
    default:
      return Math.max(6, Math.round(90 / (num * 1.5)));
  }
}

/**
 * Calculates win probability for Idol A vs Idol B in simulations based on ratings and seed weights.
 * When numeric ratings (0-100) exist, uses rating-based logistic probability; falls back to calibrated seed weights.
 */
export function calculateSimulationWinProbability(
  seedOrIdolA?: string | Partial<Idol>,
  seedOrIdolB?: string | Partial<Idol>,
  ratingA?: number,
  ratingB?: number
): number {
  const idolObjA = typeof seedOrIdolA === 'object' ? seedOrIdolA : undefined;
  const idolObjB = typeof seedOrIdolB === 'object' ? seedOrIdolB : undefined;

  const rA =
    typeof ratingA === 'number' && !Number.isNaN(ratingA)
      ? ratingA
      : idolObjA
      ? getIdolRating(idolObjA)
      : typeof seedOrIdolA === 'string'
      ? getDefaultIdolRating(seedOrIdolA)
      : 70;

  const rB =
    typeof ratingB === 'number' && !Number.isNaN(ratingB)
      ? ratingB
      : idolObjB
      ? getIdolRating(idolObjB)
      : typeof seedOrIdolB === 'string'
      ? getDefaultIdolRating(seedOrIdolB)
      : 70;

  return calculateRatingWinProbability(rA, rB);
}

/**
 * Simulates a multi-game series between two competitors until one reaches `targetWins`.
 * Simulates game-by-game using the weighted probability, yielding natural series scores
 * (e.g. 3-0, 3-1, 3-2 for best of 5; 4-0, 4-1, 4-2, 4-3 for best of 7).
 */
function simulateSeriesMatches(
  probA: number,
  targetWins: number
): { scoreA: number; scoreB: number; winnerIdIsA: boolean } {
  let scoreA = 0;
  let scoreB = 0;
  while (scoreA < targetWins && scoreB < targetWins) {
    if (Math.random() < probA) {
      scoreA++;
    } else {
      scoreB++;
    }
  }
  return {
    scoreA,
    scoreB,
    winnerIdIsA: scoreA >= targetWins,
  };
}

/**
 * Simulates a single Group Stage match with realistic win, draw, and upset probabilities.
 * Respects idol ratings (0-100) and seeds, with draw probabilities scaling with rating parity.
 */
export function simulateGroupMatchScore(
  idolOrSeedA?: string | Partial<Idol>,
  idolOrSeedB?: string | Partial<Idol>,
  formHistoryA?: Array<'W' | 'D' | 'L'>,
  formHistoryB?: Array<'W' | 'D' | 'L'>
): { scoreA: number; scoreB: number; isDraw: boolean; winnerSlot: 'A' | 'B' | 'DRAW' } {
  const idolObjA = typeof idolOrSeedA === 'object' ? idolOrSeedA : undefined;
  const idolObjB = typeof idolOrSeedB === 'object' ? idolOrSeedB : undefined;

  const effectiveA = getEffectiveIdolRating(idolObjA, formHistoryA);
  const effectiveB = getEffectiveIdolRating(idolObjB, formHistoryB);

  const rA = typeof idolOrSeedA === 'string' ? getDefaultIdolRating(idolOrSeedA) : effectiveA.effectiveRating;
  const rB = typeof idolOrSeedB === 'string' ? getDefaultIdolRating(idolOrSeedB) : effectiveB.effectiveRating;

  // v4: Best of 4, draws allowed (2-2)
  const { scoreA, scoreB } = simulateBo4Score(rA, rB);
  const isDraw = scoreA === scoreB;
  return { scoreA, scoreB, isDraw, winnerSlot: isDraw ? 'DRAW' : scoreA > scoreB ? 'A' : 'B' };
}

/**
 * Simulate uncompleted matches in the Group Stage.
 * Skips any match involving a Favorite Idol.
 * Incorporates realistic draws (1-1, 0-0) and strong rating/seed advantages.
 */
export function simulateAllGroupMatches(
  groups: Group[],
  idols: Idol[],
  config: TournamentConfig
): Group[] {
  const idolMap = new Map<string, Idol>(idols.map((i) => [i.id, i]));
  const favoriteSet = new Set<string>(config.favoriteIdolIds || []);

  return groups.map((g) => {
    // Track rolling form per idol within the group
    const rollingFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();
    (g.matches || []).forEach((m) => {
      if (m.completed && m.scoreA !== null && m.scoreB !== null) {
        const curA = rollingFormMap.get(m.idolAId) || [];
        const curB = rollingFormMap.get(m.idolBId) || [];
        if (m.scoreA > m.scoreB) {
          curA.push('W');
          curB.push('L');
        } else if (m.scoreA < m.scoreB) {
          curA.push('L');
          curB.push('W');
        } else {
          curA.push('D');
          curB.push('D');
        }
        rollingFormMap.set(m.idolAId, curA.slice(-5));
        rollingFormMap.set(m.idolBId, curB.slice(-5));
      }
    });

    const updatedMatches = (g.matches || []).map((m) => {
      if (m.completed && m.scoreA !== null && m.scoreB !== null) {
        return m;
      }

      // Check if match involves a favorite idol - skip if so!
      if (favoriteSet.has(m.idolAId) || favoriteSet.has(m.idolBId)) {
        return m;
      }

      const idolA = idolMap.get(m.idolAId);
      const idolB = idolMap.get(m.idolBId);
      const formA = rollingFormMap.get(m.idolAId) || [];
      const formB = rollingFormMap.get(m.idolBId) || [];

      const { scoreA, scoreB, isDraw, winnerSlot } = simulateGroupMatchScore(
        idolA,
        idolB,
        formA,
        formB
      );

      const winnerId = isDraw ? null : winnerSlot === 'A' ? m.idolAId : m.idolBId;

      // Update rolling form
      const curA = rollingFormMap.get(m.idolAId) || [];
      const curB = rollingFormMap.get(m.idolBId) || [];
      if (scoreA > scoreB) {
        curA.push('W');
        curB.push('L');
      } else if (scoreA < scoreB) {
        curA.push('L');
        curB.push('W');
      } else {
        curA.push('D');
        curB.push('D');
      }
      rollingFormMap.set(m.idolAId, curA.slice(-5));
      rollingFormMap.set(m.idolBId, curB.slice(-5));

      return {
        ...m,
        scoreA,
        scoreB,
        winnerId,
        completed: true,
      };
    });

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
  });
}

/**
 * Simulate uncompleted matches in the Knockout Bracket round by round.
 * Skips any match involving a Favorite Idol in each round, while simulating all other matches.
 */
export function simulateAllKnockoutMatches(
  knockoutMatches: KnockoutMatch[],
  idols: Idol[],
  config: TournamentConfig
): KnockoutMatch[] {
  const idolMap = new Map<string, Idol>(idols.map((i) => [i.id, i]));
  const favoriteSet = new Set<string>(config.favoriteIdolIds || []);

  // Deep clone to prevent mutations
  const matches: KnockoutMatch[] = knockoutMatches.map((km) => ({ ...km }));

  // Form history tracker across knockout matches
  const koFormMap = new Map<string, Array<'W' | 'D' | 'L'>>();
  matches.forEach((m) => {
    if (m.completed && m.scoreA !== null && m.scoreB !== null) {
      if (m.idolAId) {
        const curA = koFormMap.get(m.idolAId) || [];
        curA.push(m.scoreA > m.scoreB ? 'W' : 'L');
        koFormMap.set(m.idolAId, curA.slice(-5));
      }
      if (m.idolBId) {
        const curB = koFormMap.get(m.idolBId) || [];
        curB.push(m.scoreB > m.scoreA ? 'W' : 'L');
        koFormMap.set(m.idolBId, curB.slice(-5));
      }
    }
  });

  // Collect all rounds sorted by roundIndex
  const roundIndices = Array.from(new Set(matches.map((m) => m.roundIndex))).sort(
    (a, b) => a - b
  );

  for (const rIdx of roundIndices) {
    const currentRoundMatches = matches.filter((m) => m.roundIndex === rIdx);

    for (const m of currentRoundMatches) {
      // If match has both participants and is not completed
      if (m.idolAId && m.idolBId && !m.completed) {
        // Skip match if either participant is a favorite idol
        if (favoriteSet.has(m.idolAId) || favoriteSet.has(m.idolBId)) {
          continue;
        }

        const idolA = idolMap.get(m.idolAId);
        const idolB = idolMap.get(m.idolBId);

        const formA = koFormMap.get(m.idolAId) || [];
        const formB = koFormMap.get(m.idolBId) || [];

        const effA = getEffectiveIdolRating(idolA, formA);
        const effB = getEffectiveIdolRating(idolB, formB);

        const isFinal =
          (m.roundName || '').toLowerCase().includes('grand final') ||
          (m.roundName || '').toLowerCase().includes('third');

        const targetWins = isFinal ? 4 : 3; // Best of 7 for finals, best of 5 for earlier
        const { scoreA, scoreB, winnerIdIsA } = simulateSeriesMatchesHelper(
          effA.effectiveRating,
          effB.effectiveRating,
          targetWins
        );

        const winnerId = winnerIdIsA ? m.idolAId : m.idolBId;
        const loserId = winnerIdIsA ? m.idolBId : m.idolAId;

        m.scoreA = scoreA;
        m.scoreB = scoreB;
        m.winnerId = winnerId;
        m.completed = true;

        // Update form tracker
        const curA = koFormMap.get(m.idolAId) || [];
        const curB = koFormMap.get(m.idolBId) || [];
        curA.push(winnerIdIsA ? 'W' : 'L');
        curB.push(winnerIdIsA ? 'L' : 'W');
        koFormMap.set(m.idolAId, curA.slice(-5));
        koFormMap.set(m.idolBId, curB.slice(-5));

        // Feed winner into next match
        if (m.feedsIntoMatchId) {
          const nextMatch = matches.find((nm) => nm.id === m.feedsIntoMatchId);
          if (nextMatch) {
            if (m.feedsIntoSlot === 'A') {
              nextMatch.idolAId = winnerId;
            } else if (m.feedsIntoSlot === 'B') {
              nextMatch.idolBId = winnerId;
            }
          }
        }

        // If semi-final, feed loser into 3rd place match if present
        const isSemi = (m.roundName || '').toLowerCase().includes('semi');
        if (isSemi) {
          const thirdMatch = matches.find(
            (nm) =>
              Boolean(nm.isThirdPlaceMatch) ||
              (nm.roundName || '').toLowerCase().includes('3rd') ||
              (nm.roundName || '').toLowerCase().includes('third')
          );
          if (thirdMatch) {
            if (m.matchNumber === 1 || m.id.endsWith('1')) {
              thirdMatch.idolAId = loserId;
            } else {
              thirdMatch.idolBId = loserId;
            }
          }
        }
      }
    }
  }

  return matches;
}

/**
 * Computes combined top rankings across tournament, league, and The Idols formats.
 */
export function computeCombinedTopRankings(
  careerStats: CareerStat[] = [],
  idols: Idol[] = [],
  leagueArchives: any[] = [],
  leagueState?: any,
  theIdolsArchives: any[] = [],
  theIdolsState?: any
): any[] {
  const safeIdols = Array.isArray(idols) ? idols : [];
  const safeCareer = Array.isArray(careerStats) ? careerStats : [];
  const idolsMap = new Map<string, Idol>(safeIdols.map((i) => [i.id, i]));
  const careerMap = new Map<string, CareerStat>(safeCareer.map((c) => [c.idolId, c]));

  // Aggregate league stats per idol
  const leagueStatsMap = new Map<string, { titles: number; wins: number; matches: number }>();
  const getOrInitLeague = (id: string) => {
    if (!leagueStatsMap.has(id)) {
      leagueStatsMap.set(id, { titles: 0, wins: 0, matches: 0 });
    }
    return leagueStatsMap.get(id)!;
  };

  (leagueArchives || []).forEach((arch: any) => {
    if (Array.isArray(arch?.leagues)) {
      arch.leagues.forEach((l: any) => {
        if (Array.isArray(l?.standings)) {
          l.standings.forEach((st: any, idx: number) => {
            if (!st?.idolId) return;
            const item = getOrInitLeague(st.idolId);
            item.matches += Number(st.played || 0);
            item.wins += Number(st.wins || 0);
            if (idx === 0) item.titles += 1;
          });
        }
      });
    }
  });

  if (leagueState?.leagues && Array.isArray(leagueState.leagues)) {
    leagueState.leagues.forEach((l: any) => {
      if (Array.isArray(l?.standings)) {
        l.standings.forEach((st: any, idx: number) => {
          if (!st?.idolId) return;
          const item = getOrInitLeague(st.idolId);
          item.matches += Number(st.played || 0);
          item.wins += Number(st.wins || 0);
          if (leagueState.isCompleted && idx === 0) item.titles += 1;
        });
      }
    });
  }

  // Aggregate The Idols stats per idol (Superleague regular season #1 + Masters Playoff Champion)
  const theIdolsStatsMap = new Map<string, { superleagueTitles: number; mastersTitles: number; wins: number; matches: number }>();
  const getOrInitTheIdols = (id: string) => {
    if (!theIdolsStatsMap.has(id)) {
      theIdolsStatsMap.set(id, { superleagueTitles: 0, mastersTitles: 0, wins: 0, matches: 0 });
    }
    return theIdolsStatsMap.get(id)!;
  };

  (theIdolsArchives || []).forEach((arch: any) => {
    if (arch?.championId) {
      const item = getOrInitTheIdols(arch.championId);
      item.mastersTitles += 1;
    }
    if (Array.isArray(arch?.standings)) {
      arch.standings.forEach((st: any, idx: number) => {
        if (!st?.idolId) return;
        const item = getOrInitTheIdols(st.idolId);
        item.matches += Number(st.played || 0);
        item.wins += Number(st.wins || 0);
        if (idx === 0) item.superleagueTitles += 1;
      });
    }
    if (Array.isArray(arch?.playoffMatches)) {
      arch.playoffMatches.forEach((pm: any) => {
        if (pm?.completed && pm?.winnerId) {
          const itemW = getOrInitTheIdols(pm.winnerId);
          itemW.matches += 1;
          itemW.wins += 1;
          const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
          if (loserId) {
            const itemL = getOrInitTheIdols(loserId);
            itemL.matches += 1;
          }
        }
      });
    }
  });

  if (theIdolsState) {
    if (theIdolsState.isPlayoffCompleted && theIdolsState.championId) {
      const item = getOrInitTheIdols(theIdolsState.championId);
      item.mastersTitles += 1;
    }
    if (Array.isArray(theIdolsState.standings)) {
      theIdolsState.standings.forEach((st: any, idx: number) => {
        if (!st?.idolId) return;
        const item = getOrInitTheIdols(st.idolId);
        item.matches += Number(st.played || 0);
        item.wins += Number(st.wins || 0);
        if ((theIdolsState.isLeagueCompleted || theIdolsState.isCompleted) && idx === 0) {
          item.superleagueTitles += 1;
        }
      });
    }
    if (Array.isArray(theIdolsState.playoffMatches)) {
      theIdolsState.playoffMatches.forEach((pm: any) => {
        if (pm?.completed && pm?.winnerId) {
          const itemW = getOrInitTheIdols(pm.winnerId);
          itemW.matches += 1;
          itemW.wins += 1;
          const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
          if (loserId) {
            const itemL = getOrInitTheIdols(loserId);
            itemL.matches += 1;
          }
        }
      });
    }
  }

  const allIdolIds = new Set<string>([
    ...safeIdols.map((i) => i.id),
    ...safeCareer.map((c) => c.idolId),
    ...Array.from(leagueStatsMap.keys()),
    ...Array.from(theIdolsStatsMap.keys()),
  ]);

  const list = Array.from(allIdolIds).map((id) => {
    const idol = idolsMap.get(id);
    const cStat = careerMap.get(id);
    const lStat = leagueStatsMap.get(id);
    const tiStat = theIdolsStatsMap.get(id);

    const idolName = idol?.name || cStat?.idolName || 'Unknown';
    const girlGroup = idol?.girlGroup || cStat?.girlGroup || '';
    const photoUrl = idol?.photoUrl || cStat?.photoUrl;
    const cupTitles = cStat?.championships || 0;
    const leagueTitles = lStat?.titles || 0;
    const superleagueTitles = tiStat?.superleagueTitles || 0;
    const mastersTitles = tiStat?.mastersTitles || 0;
    const totalTitles = cupTitles + leagueTitles + superleagueTitles + mastersTitles;

    const totalWins = (cStat?.wins || 0) + (lStat?.wins || 0) + (tiStat?.wins || 0);
    const totalMatches = (cStat?.matches || 0) + (lStat?.matches || 0) + (tiStat?.matches || 0);
    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    return {
      idolId: id,
      idolName,
      photoUrl,
      girlGroup,
      totalTitles,
      cupTitles,
      leagueTitles,
      superleagueTitles,
      mastersTitles,
      totalMatches,
      totalWins,
      winRate,
    };
  });

  return list.sort((a, b) => b.totalTitles - a.totalTitles || b.totalWins - a.totalWins);
}

