import {
  AppState,
  TournamentArchive,
  LeagueSeasonArchive,
  TheIdolsSeasonArchive,
  ArchivedMatch,
  Idol,
  GirlGroup,
  Group,
  KnockoutMatch,
  LeagueStanding,
  LeagueMatch,
  LeagueWinnerEntry,
  TheIdolsStanding,
  TheIdolsPlayoffMatch,
} from '../types';
import { DEFAULT_LEAGUE_DEFS } from './leagueLogic';

export interface RecoveryResult {
  recoveredTournamentArchives: TournamentArchive[];
  recoveredLeagueArchives: LeagueSeasonArchive[];
  recoveredTheIdolsArchives: TheIdolsSeasonArchive[];
  recoveredSeasonNumbers: number[];
  hasChanges: boolean;
}

/**
 * Inspects the match database and existing archives to find any seasons (e.g. 66, 67)
 * whose match data was recorded but whose archive records are missing or incomplete.
 * Intelligently reconstructs Tournament, League, and The Idols archives from match data.
 */
export function recoverMissingSeasonArchives(
  allMatches: ArchivedMatch[],
  existingArchives: TournamentArchive[] = [],
  existingLeagueArchives: LeagueSeasonArchive[] = [],
  existingTheIdolsArchives: TheIdolsSeasonArchive[] = [],
  idols: Idol[] = [],
  activeSeasonNumber?: number
): RecoveryResult {
  const idolsMap = new Map<string, Idol>();
  idols.forEach((i) => idolsMap.set(i.id, i));

  // Fast helper to resolve idol by ID or Name
  const resolveIdol = (id?: string | null, name?: string | null): Idol | null => {
    if (id && idolsMap.has(id)) return idolsMap.get(id)!;
    if (name) {
      const lower = name.trim().toLowerCase();
      for (const idol of idolsMap.values()) {
        if (idol.name && idol.name.trim().toLowerCase() === lower) return idol;
      }
    }
    return null;
  };

  // Discover all distinct seasons present in matchDatabase
  const matchSeasonIdsSet = new Set<number>();
  allMatches.forEach((m) => {
    if (m && m.seasonId) {
      const sId = Number(m.seasonId);
      if (!Number.isNaN(sId) && sId > 0) {
        matchSeasonIdsSet.add(sId);
      }
    }
  });

  const existingTournSeasonMap = new Map<number, TournamentArchive>();
  (existingArchives || []).forEach((a) => {
    if (a && a.seasonId) existingTournSeasonMap.set(Number(a.seasonId), a);
  });

  const existingLeagueSeasonMap = new Map<number, LeagueSeasonArchive>();
  (existingLeagueArchives || []).forEach((a) => {
    if (a && a.seasonNumber) existingLeagueSeasonMap.set(Number(a.seasonNumber), a);
  });

  const existingTheIdolsSeasonMap = new Map<number, TheIdolsSeasonArchive>();
  (existingTheIdolsArchives || []).forEach((a) => {
    if (a && a.seasonNumber) existingTheIdolsSeasonMap.set(Number(a.seasonNumber), a);
  });

  const recoveredTournMap = new Map<number, TournamentArchive>(existingTournSeasonMap);
  const recoveredLeagueMap = new Map<number, LeagueSeasonArchive>(existingLeagueSeasonMap);
  const recoveredTheIdolsMap = new Map<number, TheIdolsSeasonArchive>(existingTheIdolsSeasonMap);

  const recoveredSeasonNumbersSet = new Set<number>();
  let hasChanges = false;

  // Scan all seasons found in matchDatabase
  const sortedSeasonIds = Array.from(matchSeasonIdsSet).sort((a, b) => a - b);

  sortedSeasonIds.forEach((sId) => {
    // CRITICAL: NEVER auto-archive or recover the active in-progress / unarchived season!
    // An active unarchived season in workspace must ONLY be archived when the user explicitly clicks Archive Season.
    if (activeSeasonNumber !== undefined && sId >= activeSeasonNumber) {
      return;
    }

    const isUnarchivedInAllFormats =
      !existingTournSeasonMap.has(sId) &&
      !existingLeagueSeasonMap.has(sId) &&
      !existingTheIdolsSeasonMap.has(sId);

    if (activeSeasonNumber === undefined && isUnarchivedInAllFormats && sId === sortedSeasonIds[sortedSeasonIds.length - 1]) {
      return;
    }

    const seasonMatches = allMatches.filter((m) => Number(m.seasonId) === sId);
    if (seasonMatches.length === 0) return;

    // -------------------------------------------------------------
    // 1. TOURNAMENT ARCHIVE RECOVERY
    // -------------------------------------------------------------
    const existingTourn = recoveredTournMap.get(sId);
    const tournNeedsRecovery =
      !existingTourn ||
      !existingTourn.championName ||
      existingTourn.championName === 'In Progress' ||
      existingTourn.championName === 'Pending' ||
      existingTourn.championName === 'Unknown';

    if (tournNeedsRecovery) {
      // Find tournament matches (excluding league and the idols matches)
      const tournMatches = seasonMatches.filter((m) => {
        if (!m) return false;
        if (m.matchId?.startsWith('league_') || m.matchId?.startsWith('the_idols_')) return false;
        const st = (m.stage || '').toLowerCase();
        if (st.includes('league') || st.includes('the idols') || st.includes('division')) return false;
        if (m.groupName === 'The Idols Superleague' || m.groupName === 'The Idols Masters Playoff') return false;
        return true;
      });

      if (tournMatches.length > 0) {
        // Attempt to find Grand Final match
        // 1st pass: stage explicitly mentions 'grand final' or 'final'
        let gfMatch = tournMatches.find((m) => {
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

        // 2nd pass: matchId mentions 'final' or 'gf'
        if (!gfMatch) {
          gfMatch = tournMatches.find((m) => {
            const mid = (m.matchId || '').toLowerCase();
            return (
              !mid.includes('3rd') &&
              !mid.includes('third') &&
              (mid.includes('final-1') || mid.includes('ko-final') || mid.includes('grandfinal'))
            );
          });
        }

        // 3rd pass: in knockout matches, the non-3rd-place match with the highest sequential score or latest date
        if (!gfMatch) {
          const nonGroupMatches = tournMatches.filter((m) => {
            const st = (m.stage || '').toLowerCase();
            return !st.includes('group') && !st.includes('3rd') && !st.includes('third');
          });
          if (nonGroupMatches.length > 0) {
            gfMatch = nonGroupMatches[nonGroupMatches.length - 1];
          }
        }

        // Third Place Match
        const thirdMatch = tournMatches.find((m) => {
          const st = (m.stage || '').toLowerCase();
          const mid = (m.matchId || '').toLowerCase();
          return st.includes('3rd') || st.includes('third') || st.includes('bronze') || mid.includes('third');
        });

        if (gfMatch) {
          const champId = gfMatch.winnerId || (gfMatch.scoreA > gfMatch.scoreB ? gfMatch.idolAId : gfMatch.idolBId);
          let champName = gfMatch.winnerName;
          if (!champName || champName === 'Draw' || champName === 'Unknown') {
            champName = resolveIdol(champId, null)?.name || gfMatch.idolAName;
          }

          const runnerId = gfMatch.winnerId === gfMatch.idolAId ? gfMatch.idolBId : gfMatch.idolAId;
          let runnerName = gfMatch.winnerId === gfMatch.idolAId ? gfMatch.idolBName : gfMatch.idolAName;
          if (!runnerName || runnerName === 'Unknown') {
            runnerName = resolveIdol(runnerId, null)?.name || runnerId;
          }

          let thirdId = thirdMatch?.winnerId || '';
          let thirdName = thirdMatch?.winnerName || '';
          if (!thirdName && thirdId) {
            thirdName = resolveIdol(thirdId, null)?.name || thirdId;
          }

          let fourthId = thirdMatch ? (thirdMatch.winnerId === thirdMatch.idolAId ? thirdMatch.idolBId : thirdMatch.idolAId) : '';
          let fourthName = thirdMatch ? (thirdMatch.winnerId === thirdMatch.idolAId ? thirdMatch.idolBName : thirdMatch.idolAName) : '';

          // Reconstruct groups
          const groupMap = new Map<string, Group>();
          tournMatches.forEach((m) => {
            const st = (m.stage || '').toLowerCase();
            if (st.includes('group') || m.groupName) {
              const gName = m.groupName || 'Group Stage';
              if (!groupMap.has(gName)) {
                groupMap.set(gName, {
                  id: `group-${gName.toLowerCase().replace(/\s+/g, '-')}`,
                  name: gName,
                  memberIds: [],
                  matches: [],
                  standings: [],
                });
              }
              const g = groupMap.get(gName)!;
              if (m.idolAId && !g.memberIds.includes(m.idolAId)) g.memberIds.push(m.idolAId);
              if (m.idolBId && !g.memberIds.includes(m.idolBId)) g.memberIds.push(m.idolBId);
              g.matches.push({
                id: m.matchId,
                round: 1,
                groupIndex: Array.from(groupMap.keys()).indexOf(gName),
                groupName: gName,
                idolAId: m.idolAId,
                idolBId: m.idolBId,
                scoreA: m.scoreA,
                scoreB: m.scoreB,
                winnerId: m.winnerId,
                completed: true,
              });
            }
          });

          // Reconstruct knockout matches
          const reconstructedKo: KnockoutMatch[] = tournMatches
            .filter((m) => !(m.stage || '').toLowerCase().includes('group'))
            .map((m, idx) => ({
              id: m.matchId,
              roundIndex: idx + 1,
              roundName: m.stage || 'Knockout',
              matchNumber: idx + 1,
              idolAId: m.idolAId,
              idolBId: m.idolBId,
              scoreA: m.scoreA,
              scoreB: m.scoreB,
              winnerId: m.winnerId,
              completed: true,
              isThirdPlaceMatch: Boolean((m.stage || '').toLowerCase().includes('3rd')),
            }));

          const recoveredArchive: TournamentArchive = {
            seasonId: sId,
            seasonName: gfMatch.seasonName || `Season ${sId}`,
            completedAt: gfMatch.date || new Date().toISOString(),
            championId: champId || '',
            championName: champName || 'Unknown',
            championGroup: champId === gfMatch.idolAId ? gfMatch.idolAGroup : gfMatch.idolBGroup,
            championPhoto: champId === gfMatch.idolAId ? gfMatch.idolAPhoto : gfMatch.idolBPhoto,
            runnerUpId: runnerId || '',
            runnerUpName: runnerName || 'Unknown',
            thirdPlaceId: thirdId,
            thirdPlaceName: thirdName,
            fourthPlaceId: fourthId,
            fourthPlaceName: fourthName,
            totalParticipants: 64,
            groups: Array.from(groupMap.values()),
            knockoutMatches: reconstructedKo,
          };

          recoveredTournMap.set(sId, recoveredArchive);
          recoveredSeasonNumbersSet.add(sId);
          hasChanges = true;
        }
      }
    }

    // -------------------------------------------------------------
    // 2. 6-PARALLEL DIVISIONS LEAGUE ARCHIVE RECOVERY
    // -------------------------------------------------------------
    const existingLeague = recoveredLeagueMap.get(sId);
    if (!existingLeague) {
      const leagueMatches = seasonMatches.filter((m) => {
        if (!m) return false;
        if (m.matchId?.startsWith('league_') || m.matchId?.startsWith('league-')) return true;
        const st = (m.stage || '').toLowerCase();
        return st.includes('league') || st.includes('division');
      });

      if (leagueMatches.length > 0) {
        // Partition matches by division (1 to 6)
        const divMatchesMap = new Map<number, ArchivedMatch[]>();
        for (let d = 1; d <= 6; d++) {
          divMatchesMap.set(d, []);
        }

        leagueMatches.forEach((m) => {
          let divId = 1;
          const matchDiv = m.matchId?.match(/div(\d+)/i) || (m.stage || '').match(/division\s*(\d+)/i) || (m.groupName || '').match(/(\d+)/);
          if (matchDiv) {
            divId = parseInt(matchDiv[1], 10);
            if (divId < 1 || divId > 6) divId = 1;
          }
          divMatchesMap.get(divId)!.push(m);
        });

        // Compute standings for each division
        const standingsRecord: Record<number, LeagueStanding[]> = {};
        const leagueWinners: LeagueWinnerEntry[] = [];

        DEFAULT_LEAGUE_DEFS.forEach((def) => {
          const dId = def.id;
          const dMatches = divMatchesMap.get(dId) || [];
          const idolStatMap = new Map<string, LeagueStanding>();

          dMatches.forEach((m) => {
            [m.idolAId, m.idolBId].forEach((id, idx) => {
              if (!id) return;
              if (!idolStatMap.has(id)) {
                const idolObj = resolveIdol(id, idx === 0 ? m.idolAName : m.idolBName);
                idolStatMap.set(id, {
                  rank: 0,
                  idolId: id,
                  idolName: idolObj?.name || (idx === 0 ? m.idolAName : m.idolBName) || 'Unknown',
                  girlGroup: idolObj?.girlGroup || (idx === 0 ? m.idolAGroup : m.idolBGroup) || 'Solo',
                  photoUrl: idolObj?.photoUrl || '',
                  nationality: idolObj?.nationality || 'South Korea',
                  seed: idolObj?.seed || 'Seed 3',
                  played: 0,
                  wins: 0,
                  draws: 0,
                  losses: 0,
                  gamesFor: 0,
                  gamesAgainst: 0,
                  gameDiff: 0,
                  points: 0,
                  form: [],
                  qualified: false,
                });
              }
            });

            const stA = idolStatMap.get(m.idolAId);
            const stB = idolStatMap.get(m.idolBId);

            if (stA && stB) {
              stA.played++;
              stB.played++;
              stA.gamesFor += m.scoreA;
              stA.gamesAgainst += m.scoreB;
              stB.gamesFor += m.scoreB;
              stB.gamesAgainst += m.scoreA;

              if (m.scoreA > m.scoreB) {
                stA.wins++;
                stA.points += 3;
                stB.losses++;
              } else if (m.scoreB > m.scoreA) {
                stB.wins++;
                stB.points += 3;
                stA.losses++;
              } else {
                stA.draws++;
                stA.points += 1;
                stB.draws++;
                stB.points += 1;
              }
              stA.gameDiff = stA.gamesFor - stA.gamesAgainst;
              stB.gameDiff = stB.gamesFor - stB.gamesAgainst;
            }
          });

          const sortedStandings = Array.from(idolStatMap.values()).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
            return b.gamesFor - a.gamesFor;
          });

          sortedStandings.forEach((s, idx) => {
            s.rank = idx + 1;
          });

          standingsRecord[dId] = sortedStandings;

          const topStanding = sortedStandings[0];
          const champIdol = topStanding ? resolveIdol(topStanding.idolId, topStanding.idolName) : null;

          leagueWinners.push({
            leagueId: dId,
            leagueName: def.name,
            tierName: def.tierName,
            championId: topStanding?.idolId || '',
            championName: topStanding?.idolName || 'TBD',
            championGroup: topStanding?.girlGroup || champIdol?.girlGroup || 'Solo',
            championPhoto: topStanding?.photoUrl || champIdol?.photoUrl || '',
            championNationality: champIdol?.nationality || 'South Korea',
            championSeed: champIdol?.seed || 'Seed 3',
            points: topStanding?.points || 0,
            played: topStanding?.played || 0,
            wins: topStanding?.wins || 0,
            draws: topStanding?.draws || 0,
            losses: topStanding?.losses || 0,
            gameDiff: topStanding?.gameDiff || 0,
          });
        });

        // Convert archived matches back to LeagueMatch format
        const convertedLeagueMatches: LeagueMatch[] = leagueMatches.map((m) => {
          let divId = 1;
          const matchDiv = m.matchId?.match(/div(\d+)/i) || (m.stage || '').match(/division\s*(\d+)/i) || (m.groupName || '').match(/(\d+)/);
          if (matchDiv) {
            divId = parseInt(matchDiv[1], 10);
            if (divId < 1 || divId > 6) divId = 1;
          }
          return {
            id: m.matchId,
            leagueId: divId,
            matchday: 1,
            idolAId: m.idolAId,
            idolBId: m.idolBId,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            winnerId: m.winnerId,
            completed: true,
          };
        });

        const recoveredLeagueArchive: LeagueSeasonArchive = {
          seasonNumber: sId,
          seasonName: `League Season ${sId}`,
          completedAt: leagueMatches[leagueMatches.length - 1]?.date || new Date().toISOString(),
          postseasonFormat: 'grand_cup_64',
          leagueWinners,
          allStandings: standingsRecord,
          allMatches: convertedLeagueMatches,
          top32Qualifiers: [],
          qualifiers: [],
        };

        recoveredLeagueMap.set(sId, recoveredLeagueArchive);
        recoveredSeasonNumbersSet.add(sId);
        hasChanges = true;
      }
    }

    // -------------------------------------------------------------
    // 3. THE IDOLS SUPERLEAGUE & MASTERS ARCHIVE RECOVERY
    // -------------------------------------------------------------
    const existingIdols = recoveredTheIdolsMap.get(sId);
    if (!existingIdols) {
      const theIdolsMatches = seasonMatches.filter((m) => {
        if (!m) return false;
        if (m.matchId?.startsWith('the_idols_') || m.matchId?.startsWith('the_idols-') || m.matchId?.startsWith('the-idols-')) return true;
        const st = (m.stage || '').toLowerCase();
        return st.includes('the idols') || m.groupName === 'The Idols Superleague' || m.groupName === 'The Idols Masters Playoff';
      });

      if (theIdolsMatches.length > 0) {
        const regularMatches = theIdolsMatches.filter(
          (m) =>
            !m.matchId?.includes('po_') &&
            !m.matchId?.includes('playoff') &&
            !(m.stage || '').toLowerCase().includes('playoff') &&
            !(m.stage || '').toLowerCase().includes('masters')
        );
        const playoffMatches = theIdolsMatches.filter(
          (m) =>
            m.matchId?.includes('po_') ||
            m.matchId?.includes('playoff') ||
            (m.stage || '').toLowerCase().includes('playoff') ||
            (m.stage || '').toLowerCase().includes('masters')
        );

        // Compute standings from regular matches
        const idolStatMap = new Map<string, TheIdolsStanding>();
        regularMatches.forEach((m) => {
          [m.idolAId, m.idolBId].forEach((id, idx) => {
            if (!id) return;
            if (!idolStatMap.has(id)) {
              const idolObj = resolveIdol(id, idx === 0 ? m.idolAName : m.idolBName);
              idolStatMap.set(id, {
                rank: 0,
                rating: idolObj?.rating || 75,
                idolId: id,
                idolName: idolObj?.name || (idx === 0 ? m.idolAName : m.idolBName) || 'Unknown',
                girlGroup: idolObj?.girlGroup || (idx === 0 ? m.idolAGroup : m.idolBGroup) || 'Solo',
                photoUrl: idolObj?.photoUrl || '',
                nationality: idolObj?.nationality || 'South Korea',
                seed: idolObj?.seed || 'Seed 3',
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gamesFor: 0,
                gamesAgainst: 0,
                gameDiff: 0,
                points: 0,
                form: [],
              });
            }
          });

          const stA = idolStatMap.get(m.idolAId);
          const stB = idolStatMap.get(m.idolBId);
          if (stA && stB) {
            stA.played++;
            stB.played++;
            stA.gamesFor += m.scoreA;
            stA.gamesAgainst += m.scoreB;
            stB.gamesFor += m.scoreB;
            stB.gamesAgainst += m.scoreA;

            if (m.scoreA > m.scoreB) {
              stA.wins++;
              stA.points += 3;
              stB.losses++;
            } else if (m.scoreB > m.scoreA) {
              stB.wins++;
              stB.points += 3;
              stA.losses++;
            } else {
              stA.draws++;
              stA.points += 1;
              stB.draws++;
              stB.points += 1;
            }
            stA.gameDiff = stA.gamesFor - stA.gamesAgainst;
            stB.gameDiff = stB.gamesFor - stB.gamesAgainst;
          }
        });

        const sortedStandings = Array.from(idolStatMap.values()).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
          return b.gamesFor - a.gamesFor;
        });
        sortedStandings.forEach((s, idx) => {
          s.rank = idx + 1;
        });

        // Find Masters champion from playoff matches
        const mastersFinal = playoffMatches.find((m) => {
          const st = (m.stage || '').toLowerCase();
          const mid = (m.matchId || '').toLowerCase();
          return st.includes('final') || mid.includes('gf') || mid.includes('final');
        });

        const champId = mastersFinal?.winnerId || sortedStandings[0]?.idolId || '';
        const champObj = resolveIdol(champId, mastersFinal?.winnerName);
        const champName = champObj?.name || mastersFinal?.winnerName || sortedStandings[0]?.idolName || 'Champion';

        const runnerId = mastersFinal ? (mastersFinal.winnerId === mastersFinal.idolAId ? mastersFinal.idolBId : mastersFinal.idolAId) : sortedStandings[1]?.idolId || '';
        const runnerObj = resolveIdol(runnerId, null);
        const runnerName = runnerObj?.name || sortedStandings[1]?.idolName || 'Runner-Up';

        const convertedPlayoffs: TheIdolsPlayoffMatch[] = playoffMatches.map((m, idx) => {
          const st = (m.stage || '').toLowerCase();
          const roundCode: TheIdolsPlayoffMatch['roundCode'] = st.includes('grand') || st === 'gf'
            ? 'GF'
            : st.includes('upper final') || st.includes('ub final')
            ? 'UB_FINAL'
            : st.includes('lower final') || st.includes('lb final')
            ? 'LB_FINAL'
            : st.includes('lower semi') || st.includes('lb semi')
            ? 'LB_SEMI'
            : st.includes('lower') || st.includes('lb')
            ? 'LB_R1'
            : 'UB_R1';

          return {
            id: m.matchId,
            bracket: st.includes('lower') ? 'lower' : 'upper',
            roundCode,
            roundName: m.stage || 'Playoff Match',
            matchNumber: idx + 1,
            bestOf: 5,
            targetWins: 3,
            idolAId: m.idolAId,
            idolBId: m.idolBId,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            games: [],
            winnerId: m.winnerId,
            loserId: m.loserId,
            completed: true,
          };
        });

        const recoveredTheIdolsArchive: TheIdolsSeasonArchive = {
          seasonNumber: sId,
          seasonName: `The Idols Season ${sId}`,
          completedAt: theIdolsMatches[theIdolsMatches.length - 1]?.date || new Date().toISOString(),
          championId: champId,
          championName: champName,
          championGroup: champObj?.girlGroup || 'Solo',
          championPhoto: champObj?.photoUrl || '',
          championNationality: champObj?.nationality || 'South Korea',
          runnerUpId: runnerId,
          runnerUpName: runnerName,
          memberIds: sortedStandings.map((s) => s.idolId),
          standings: sortedStandings,
          matches: regularMatches.map((m) => ({
            id: m.matchId,
            matchday: 1,
            idolAId: m.idolAId,
            idolBId: m.idolBId,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            winnerId: m.winnerId,
            completed: true,
          })),
          playoffMatches: convertedPlayoffs,
          totalMatches: theIdolsMatches.length,
          totalGoals: theIdolsMatches.reduce((acc, m) => acc + (m.scoreA || 0) + (m.scoreB || 0), 0),
        };

        recoveredTheIdolsMap.set(sId, recoveredTheIdolsArchive);
        recoveredSeasonNumbersSet.add(sId);
        hasChanges = true;
      }
    }
  });

  return {
    recoveredTournamentArchives: Array.from(recoveredTournMap.values()).sort(
      (a, b) => Number(a.seasonId) - Number(b.seasonId)
    ),
    recoveredLeagueArchives: Array.from(recoveredLeagueMap.values()).sort(
      (a, b) => Number(a.seasonNumber) - Number(b.seasonNumber)
    ),
    recoveredTheIdolsArchives: Array.from(recoveredTheIdolsMap.values()).sort(
      (a, b) => Number(a.seasonNumber) - Number(b.seasonNumber)
    ),
    recoveredSeasonNumbers: Array.from(recoveredSeasonNumbersSet).sort((a, b) => a - b),
    hasChanges,
  };
}
