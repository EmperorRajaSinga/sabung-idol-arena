import {
  Idol,
  CareerStat,
  TournamentArchive,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
  ArchivedMatch,
  MilestoneBadge,
  IdolAchievementEarned,
} from '../types';

export const ALL_MILESTONE_BADGES: MilestoneBadge[] = [
  {
    id: 'dynasty_quadtrick',
    name: 'Dynasty Supreme (4-Peat+)',
    category: 'championship',
    tier: 'legendary',
    iconName: 'Crown',
    description: 'Won 4 consecutive tournament or league championships, cementing an untouchable dynasty.',
    criteria: '4+ consecutive championships',
    xpValue: 1000,
  },
  {
    id: 'hattrick_champion',
    name: 'Hattrick Champion (3-Peat)',
    category: 'championship',
    tier: 'legendary',
    iconName: 'Sparkles',
    description: 'Won 3 consecutive tournament cups or league championships.',
    criteria: '3 consecutive championships',
    xpValue: 600,
  },
  {
    id: 'back_to_back',
    name: 'Back-to-Back Champion (2-Peat)',
    category: 'championship',
    tier: 'epic',
    iconName: 'Flame',
    description: 'Won 2 consecutive tournament cups or league division titles.',
    criteria: '2 consecutive championships',
    xpValue: 350,
  },
  {
    id: 'invincible_season',
    name: 'The Invincible',
    category: 'record',
    tier: 'legendary',
    iconName: 'ShieldCheck',
    description: 'Completed a tournament cup or full league season with ZERO losses.',
    criteria: '0 losses in an entire championship campaign',
    xpValue: 800,
  },
  {
    id: 'grand_slam',
    name: 'Grand Slam Multi-Champion',
    category: 'championship',
    tier: 'epic',
    iconName: 'Trophy',
    description: 'Amassed 3 or more total major titles across Tournament Cups and League Divisions.',
    criteria: '3+ total major championship titles',
    xpValue: 500,
  },
  {
    id: 'dual_crown',
    name: 'Dual Crown Champion',
    category: 'championship',
    tier: 'gold',
    iconName: 'Award',
    description: 'Conquered both a Tournament Cup and a League Division championship in career.',
    criteria: 'Won ≥1 Tournament Cup and ≥1 League Title',
    xpValue: 400,
  },
  {
    id: 'century_club',
    name: 'Century Club (100 Wins)',
    category: 'longevity',
    tier: 'legendary',
    iconName: 'Zap',
    description: 'Surpassed 100 all-time career match victories.',
    criteria: '100+ total career match wins',
    xpValue: 750,
  },
  {
    id: 'half_century',
    name: 'Half-Century (50 Wins)',
    category: 'longevity',
    tier: 'gold',
    iconName: 'Swords',
    description: 'Recorded 50 or more career match wins.',
    criteria: '50+ total career match wins',
    xpValue: 300,
  },
  {
    id: 'iron_idol',
    name: 'Iron Idol',
    category: 'longevity',
    tier: 'rare',
    iconName: 'Shield',
    description: 'Competed in 60 or more overall career matches.',
    criteria: '60+ career matches played',
    xpValue: 250,
  },
  {
    id: 'streak_master',
    name: 'Streak Master (7+ Streak)',
    category: 'streak',
    tier: 'epic',
    iconName: 'Flame',
    description: 'Achieved an active or historic win streak of 7 or more consecutive matches.',
    criteria: '7+ consecutive match wins',
    xpValue: 450,
  },
  {
    id: 'elite_performer',
    name: 'Elite Tactician (70%+ Win Rate)',
    category: 'mastery',
    tier: 'gold',
    iconName: 'Star',
    description: 'Maintained a career win rate of 70% or higher with a minimum of 10 matches.',
    criteria: '≥70% career win rate (min 10 matches)',
    xpValue: 350,
  },
  {
    id: 'podium_legend',
    name: 'Perennial Podium (5+ Podiums)',
    category: 'championship',
    tier: 'rare',
    iconName: 'Medal',
    description: 'Reached the Top 4 / Podium stage in 5 or more tournaments or league seasons.',
    criteria: '5+ career Top-4/Podium finishes',
    xpValue: 300,
  },
  {
    id: 'scoring_machine',
    name: 'Point Machine (150+ Pts)',
    category: 'record',
    tier: 'rare',
    iconName: 'Target',
    description: 'Accumulated 150 or more total game points / goals in competitive play.',
    criteria: '150+ total game points/goals scored',
    xpValue: 200,
  },
  {
    id: 'league_titan',
    name: 'League Titan',
    category: 'championship',
    tier: 'gold',
    iconName: 'Table',
    description: 'Clinched 2 or more League Division championships.',
    criteria: '2+ League Division Titles',
    xpValue: 400,
  },
];

export interface IdolAchievementReport {
  idolId: string;
  idolName: string;
  photoUrl?: string;
  girlGroup: string;
  earnedBadges: IdolAchievementEarned[];
  totalScore: number;
  badgeCount: number;
}

/**
 * Scan all historical records, tournament archives, league archives, and career stats
 * to compute milestone badges for every idol.
 */
export function computeAllIdolAchievements(params: {
  idols: Idol[];
  careerStats: CareerStat[];
  tournamentArchives: TournamentArchive[];
  leagueArchives: LeagueSeasonArchive[];
  leagueState?: LeagueSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  matchDatabase?: ArchivedMatch[];
}): Map<string, IdolAchievementReport> {
  const {
    idols,
    careerStats,
    tournamentArchives = [],
    leagueArchives = [],
    leagueState,
    theIdolsArchives = [],
    theIdolsState,
    matchDatabase = [],
  } = params;

  const safeIdols = Array.isArray(idols) ? idols : [];
  const safeCareerStats = Array.isArray(careerStats) ? careerStats : [];
  const safeTournamentArchives = Array.isArray(tournamentArchives) ? tournamentArchives : [];
  const safeLeagueArchives = Array.isArray(leagueArchives) ? leagueArchives : [];
  const safeTheIdolsArchives = Array.isArray(theIdolsArchives) ? theIdolsArchives : [];
  const safeMatchDatabase = Array.isArray(matchDatabase) ? matchDatabase : [];

  const results = new Map<string, IdolAchievementReport>();

  // Career stat map
  const careerMap = new Map<string, CareerStat>();
  safeCareerStats.forEach((c) => c && careerMap.set(c.idolId, c));

  // League & Superleague stats map
  const leagueStatMap = new Map<
    string,
    {
      titles: number;
      theIdolsTitles: number;
      matches: number;
      wins: number;
      losses: number;
      points: number;
      gf: number;
      undefeatedSeason: boolean;
      top5Finishes: number;
    }
  >();

  const getOrInitLeagueStat = (id: string) => {
    if (!leagueStatMap.has(id)) {
      leagueStatMap.set(id, {
        titles: 0,
        theIdolsTitles: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        points: 0,
        gf: 0,
        undefeatedSeason: false,
        top5Finishes: 0,
      });
    }
    return leagueStatMap.get(id)!;
  };

  // Process current active league state
  if (leagueState && Array.isArray(leagueState.leagues)) {
    leagueState.leagues.forEach((l) => {
      if (l && Array.isArray(l.standings)) {
        l.standings.forEach((st) => {
          if (!st) return;
          const item = getOrInitLeagueStat(st.idolId);
          item.matches += st.played || 0;
          item.wins += st.wins || 0;
          item.losses += st.losses || 0;
          item.points += st.points || 0;
          item.gf += st.gamesFor || 0;
          if (l.isCompleted && (st.played || 0) > 0) {
            if (st.rank === 1) {
              item.titles += 1;
            }
            if (st.rank <= 5) {
              item.top5Finishes += 1;
            }
          }
          if (st.played >= 10 && st.losses === 0) {
            item.undefeatedSeason = true;
          }
        });
      }
    });
  }

  // Process archived league seasons
  safeLeagueArchives.forEach((arch) => {
    if (!arch) return;
    const titlesCountedInArch = new Set<string>();
    const winners = arch.leagueWinners || (arch as any).leagueChampions || [];
    if (Array.isArray(winners)) {
      winners.forEach((w: any) => {
        if (!w) return;
        const champId = w.championId || w.idolId;
        if (champId && !titlesCountedInArch.has(champId)) {
          const item = getOrInitLeagueStat(champId);
          item.titles += 1;
          titlesCountedInArch.add(champId);
        }
      });
    }

    if (arch.allStandings && typeof arch.allStandings === 'object') {
      Object.values(arch.allStandings).forEach((standingsList: any) => {
        if (Array.isArray(standingsList)) {
          standingsList.forEach((st: any) => {
            if (!st) return;
            const item = getOrInitLeagueStat(st.idolId);
            item.matches += st.played || 0;
            item.wins += st.wins || 0;
            item.losses += st.losses || 0;
            item.points += st.points || 0;
            item.gf += st.gamesFor || 0;
            if ((st.played || 0) > 0) {
              if (st.rank === 1 && !titlesCountedInArch.has(st.idolId)) {
                item.titles += 1;
                titlesCountedInArch.add(st.idolId);
              }
              if (st.rank <= 5) {
                item.top5Finishes += 1;
              }
            }
            if (st.played >= 10 && st.losses === 0) {
              item.undefeatedSeason = true;
            }
          });
        }
      });
    }
  });

  // Process current active The Idols state
  if (theIdolsState && Array.isArray(theIdolsState.standings)) {
    theIdolsState.standings.forEach((st) => {
      if (!st) return;
      const item = getOrInitLeagueStat(st.idolId);
      item.matches += st.played || 0;
      item.wins += st.wins || 0;
      item.losses += st.losses || 0;
      item.points += st.points || 0;
      item.gf += st.gamesFor || 0;
      if (theIdolsState.isLeagueCompleted && (st.played || 0) > 0 && st.rank === 1) {
        item.theIdolsTitles += 1;
      }
      if ((theIdolsState.isPlayoffCompleted || !!theIdolsState.championId) && theIdolsState.championId === st.idolId) {
        item.theIdolsTitles += 1;
      }
      if (st.rank <= 4) {
        item.top5Finishes += 1;
      }
      if (st.played >= 10 && st.losses === 0) {
        item.undefeatedSeason = true;
      }
    });

    if (Array.isArray(theIdolsState.playoffMatches)) {
      theIdolsState.playoffMatches.forEach((pm) => {
        if (pm && pm.completed && pm.winnerId) {
          const itemWinner = getOrInitLeagueStat(pm.winnerId);
          itemWinner.matches += 1;
          itemWinner.wins += 1;
          if (pm.scoreA !== undefined && pm.scoreB !== undefined) {
            itemWinner.gf += Math.max(pm.scoreA, pm.scoreB);
          }
          const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
          if (loserId) {
            const itemLoser = getOrInitLeagueStat(loserId);
            itemLoser.matches += 1;
            itemLoser.losses += 1;
            if (pm.scoreA !== undefined && pm.scoreB !== undefined) {
              itemLoser.gf += Math.min(pm.scoreA, pm.scoreB);
            }
          }
        }
      });
    }
  }

  // Process archived The Idols seasons
  safeTheIdolsArchives.forEach((arch) => {
    if (!arch) return;
    const champId = arch.championId;
    if (champId) {
      const item = getOrInitLeagueStat(champId);
      item.theIdolsTitles += 1;
    }
    if (Array.isArray(arch.standings) && arch.standings.length > 0) {
      const regularChamp = arch.standings[0];
      if (regularChamp && regularChamp.idolId) {
        const itemReg = getOrInitLeagueStat(regularChamp.idolId);
        itemReg.theIdolsTitles += 1;
      }
    }

    if (Array.isArray(arch.standings)) {
      arch.standings.forEach((st) => {
        if (!st) return;
        const item = getOrInitLeagueStat(st.idolId);
        item.matches += st.played || 0;
        item.wins += st.wins || 0;
        item.losses += st.losses || 0;
        item.points += st.points || 0;
        item.gf += st.gamesFor || 0;
        if (st.rank <= 4) {
          item.top5Finishes += 1;
        }
        if (st.played >= 10 && st.losses === 0) {
          item.undefeatedSeason = true;
        }
      });
    }

    if (Array.isArray(arch.playoffMatches)) {
      arch.playoffMatches.forEach((pm) => {
        if (pm && pm.completed && pm.winnerId) {
          const itemWinner = getOrInitLeagueStat(pm.winnerId);
          itemWinner.matches += 1;
          itemWinner.wins += 1;
          if (pm.scoreA !== undefined && pm.scoreB !== undefined) {
            itemWinner.gf += Math.max(pm.scoreA, pm.scoreB);
          }
          const loserId = pm.winnerId === pm.idolAId ? pm.idolBId : pm.idolAId;
          if (loserId) {
            const itemLoser = getOrInitLeagueStat(loserId);
            itemLoser.matches += 1;
            itemLoser.losses += 1;
            if (pm.scoreA !== undefined && pm.scoreB !== undefined) {
              itemLoser.gf += Math.min(pm.scoreA, pm.scoreB);
            }
          }
        }
      });
    }
  });

  // Calculate consecutive tournament champions across chronological tournament seasons
  const sortedTournaments = [...tournamentArchives]
    .filter((t) => t.championId)
    .sort((a, b) => (Number(a.seasonId) || 0) - (Number(b.seasonId) || 0));

  const tournamentConsecutiveWins = new Map<string, number>();
  let prevChampId: string | null = null;
  let prevSeasonId: number | null = null;
  let currentStreak = 0;

  sortedTournaments.forEach((t) => {
    const currentSeason = Number(t.seasonId) || 0;
    if (t.championId) {
      // Must be immediate consecutive season number (e.g. season 2 after season 1)
      const isConsecutiveSeason = prevSeasonId !== null && (currentSeason === prevSeasonId + 1 || sortedTournaments.length <= 1);
      if (t.championId === prevChampId && (prevSeasonId === null || isConsecutiveSeason)) {
        currentStreak++;
      } else {
        currentStreak = 1;
        prevChampId = t.championId;
      }
      prevSeasonId = currentSeason;

      const existingMax = tournamentConsecutiveWins.get(t.championId) || 0;
      if (currentStreak > existingMax) {
        tournamentConsecutiveWins.set(t.championId, currentStreak);
      }
    }
  });

  // Evaluate each idol
  safeIdols.forEach((idol) => {
    if (!idol) return;
    const cStat = careerMap.get(idol.id);
    const lStat = leagueStatMap.get(idol.id) || {
      titles: 0,
      theIdolsTitles: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      points: 0,
      gf: 0,
      undefeatedSeason: false,
      top5Finishes: 0,
    };

    const cupTitles = cStat?.championships || 0;
    const leagueTitles = lStat.titles;
    const theIdolsTitles = lStat.theIdolsTitles;
    const totalTitles = cupTitles + leagueTitles + theIdolsTitles;

    const totalMatches = (cStat?.matches || 0) + lStat.matches;
    const totalWins = (cStat?.wins || 0) + lStat.wins;
    const totalPoints = (cStat?.gamesFor || 0) + lStat.gf;
    const overallWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
    const longestWinStreak = cStat?.longestWinStreak || 0;
    const totalPodiums = (cStat?.top4 || 0) + lStat.top5Finishes;
    const consecutiveTitles = tournamentConsecutiveWins.get(idol.id) || 0;

    const earnedBadges: IdolAchievementEarned[] = [];

    // 1. Dynasty Quadtrick (4+ consecutive championship titles)
    if (consecutiveTitles >= 4) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'dynasty_quadtrick')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${consecutiveTitles} consecutive championship titles won!`,
      });
    }

    // 2. Hattrick Champion (3-Peat / 3 consecutive championships)
    if (consecutiveTitles >= 3 && !earnedBadges.some((b) => b.badge.id === 'dynasty_quadtrick')) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'hattrick_champion')!;
      earnedBadges.push({
        badge,
        unlockedContext: `3x consecutive Champion Dynasty achieved!`,
      });
    }

    // 3. Back-to-Back Champion (2-Peat / 2 consecutive championships)
    if (consecutiveTitles >= 2 && !earnedBadges.some((b) => b.badge.id === 'dynasty_quadtrick' || b.badge.id === 'hattrick_champion')) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'back_to_back')!;
      earnedBadges.push({
        badge,
        unlockedContext: `Back-to-back consecutive title defender.`,
      });
    }

    // 4. Invincible Season (0 losses in tournament cup run or league)
    const hasInvincibleCup = tournamentArchives.some(
      (t) => t.championId === idol.id && !matchDatabase.some((m) => m.seasonId === t.seasonId && m.loserId === idol.id)
    );
    if (hasInvincibleCup || lStat.undefeatedSeason || (cupTitles > 0 && cStat?.losses === 0)) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'invincible_season')!;
      earnedBadges.push({
        badge,
        unlockedContext: `Undefeated championship campaign with 0 losses.`,
      });
    }

    // 5. Grand Slam Multi-Champion (3+ total titles)
    if (totalTitles >= 3) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'grand_slam')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${totalTitles} major championships in career trophy case.`,
      });
    }

    // 6. Dual Crown Champion (Tournament Cup + League Division Title)
    if (cupTitles >= 1 && leagueTitles >= 1) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'dual_crown')!;
      earnedBadges.push({
        badge,
        unlockedContext: `Won ${cupTitles} Cup(s) and ${leagueTitles} League Title(s).`,
      });
    }

    // 7. Century Club (100+ match wins)
    if (totalWins >= 100) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'century_club')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${totalWins} all-time career match victories!`,
      });
    }

    // 8. Half Century (50+ match wins)
    if (totalWins >= 50) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'half_century')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${totalWins} career match victories achieved.`,
      });
    }

    // 9. Iron Idol (60+ matches played)
    if (totalMatches >= 60) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'iron_idol')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${totalMatches} competitive matches contested.`,
      });
    }

    // 10. Streak Master (7+ win streak)
    if (longestWinStreak >= 7) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'streak_master')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${longestWinStreak} consecutive match victories in historic run.`,
      });
    }

    // 11. Elite Performer (70%+ Win Rate with at least 10 matches)
    if (overallWinRate >= 70 && totalMatches >= 10) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'elite_performer')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${overallWinRate}% career win rate across ${totalMatches} matches.`,
      });
    }

    // 12. Podium Legend (5+ podium finishes)
    if (totalPodiums >= 5) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'podium_legend')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${totalPodiums} Top 4 / Podium finishes achieved.`,
      });
    }

    // 13. Scoring Machine (150+ game points)
    if (totalPoints >= 150) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'scoring_machine')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${totalPoints} total points/goals scored in competition.`,
      });
    }

    // 14. League Titan (2+ League Division Titles)
    if (leagueTitles >= 2) {
      const badge = ALL_MILESTONE_BADGES.find((b) => b.id === 'league_titan')!;
      earnedBadges.push({
        badge,
        unlockedContext: `${leagueTitles} League Division championships won.`,
      });
    }

    // Compute total achievement score
    const totalScore = earnedBadges.reduce((acc, curr) => acc + curr.badge.xpValue, 0);

    results.set(idol.id, {
      idolId: idol.id,
      idolName: idol.name,
      photoUrl: idol.photoUrl,
      girlGroup: idol.girlGroup,
      earnedBadges,
      totalScore,
      badgeCount: earnedBadges.length,
    });
  });

  return results;
}
