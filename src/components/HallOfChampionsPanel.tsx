import React, { useState, useMemo } from 'react';
import {
  TournamentArchive,
  ArchivedMatch,
  Group,
  KnockoutMatch,
  TournamentConfig,
  Idol,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
} from '../types';
import {
  Crown,
  Trophy,
  Award,
  Sparkles,
  Table,
  Star,
  Search,
  Users,
  Percent,
  Flame,
  Shield,
  Medal,
  Zap,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { getAllSeasonArchives } from '../utils/tournamentLogic';
import { DEFAULT_LEAGUE_DEFS } from '../utils/leagueLogic';
import { getCountryFlag } from '../utils/nationalityHelper';
import { recoverMissingSeasonArchives } from '../utils/archiveRecoveryEngine';
import type { V5State, V5TitleArchive } from '../utils/v5/store';

interface HallOfChampionsPanelProps {
  archives: TournamentArchive[];
  idolsMap: Map<string, Idol>;
  matchDatabase?: ArchivedMatch[];
  currentGroups?: Group[];
  currentKnockoutMatches?: KnockoutMatch[];
  currentConfig?: TournamentConfig;
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  v5State?: V5State;
  v5TitleArchives?: V5TitleArchive[];
  onReconcileArchives?: () => void;
}

interface IdolHonourRecord {
  idolId: string;
  name: string;
  photoUrl: string;
  girlGroup: string;
  nationality?: string;
  tournamentCups: number;
  tournamentRunnersUp: number;
  tournamentThirdPlace: number;
  premierTitles: number; // Division 1
  otherDivisionTitles: number; // Divisions 2-6
  totalLeagueTitles: number;
  theIdolsMastersTitles: number;
  theIdolsSuperleagueTitles: number;
  theIdolsRunnersUp: number;
  theIdolsThirdPlace: number;
  totalTheIdolsTitles: number;
  totalMajorTrophies: number; // Cups + League Titles + The Idols Titles
  honourPoints: number; // Weighted: Cup=10, Masters=12, Div1=8, Superleague=8, Div2-6=4, RunnerUp=3/4, 3rd=2
  titlesHistory: Array<{
    type: 'CUP' | 'DIV1' | 'DIV_OTHER' | 'MASTERS_CHAMP' | 'SUPERLEAGUE_SHIELD' | 'THE_IDOLS_RU' | 'THE_IDOLS_3RD' | 'RUNNER_UP' | 'THIRD_PLACE';
    label: string;
    seasonName: string;
    seasonNumber: number;
    color?: string;
  }>;
  matchesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  winRate: number;
}

export const HallOfChampionsPanel: React.FC<HallOfChampionsPanelProps> = ({
  archives,
  idolsMap,
  matchDatabase = [],
  currentGroups,
  currentKnockoutMatches,
  currentConfig,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  v5State,
  v5TitleArchives = [],
  onReconcileArchives,
}) => {
  const [activeTab, setActiveTab] = useState<'tournament' | 'league' | 'the_idols' | 'combined'>('tournament');
  const [combinedSearch, setCombinedSearch] = useState('');
  const [combinedFilter, setCombinedFilter] = useState<'ALL_TITLE_HOLDERS' | 'TOURNAMENT_WINNERS' | 'LEAGUE_CHAMPS' | 'THE_IDOLS_CHAMPS' | 'ALL_PLAYERS'>('ALL_TITLE_HOLDERS');
  const [combinedSort, setCombinedSort] = useState<'TOTAL_TROPHIES' | 'HONOUR_POINTS' | 'TOURNAMENT_CUPS' | 'LEAGUE_TITLES' | 'THE_IDOLS_TITLES' | 'WIN_RATE' | 'TOTAL_WINS'>('TOTAL_TROPHIES');
  const [reconcileSuccessMsg, setReconcileSuccessMsg] = useState<string | null>(null);

  const safeIdolsMap = useMemo(() => {
    if (idolsMap instanceof Map) return idolsMap;
    if (idolsMap && typeof idolsMap === 'object') {
      return new Map(Object.entries(idolsMap));
    }
    return new Map<string, Idol>();
  }, [idolsMap]);

  const activeSeasonNumber = Number(currentConfig?.seasonNumber || currentConfig?.seasonId || 1);

  // Dynamically recover any past seasons present in matchDatabase but missing from archives (e.g. season 66, 67)
  const recoveredResult = useMemo(() => {
    return recoverMissingSeasonArchives(
      matchDatabase || [],
      archives || [],
      leagueArchives || [],
      theIdolsArchives || [],
      Array.from(safeIdolsMap.values()),
      activeSeasonNumber
    );
  }, [matchDatabase, archives, leagueArchives, theIdolsArchives, safeIdolsMap, activeSeasonNumber]);

  const effectiveTournamentArchives = recoveredResult.recoveredTournamentArchives;
  const effectiveLeagueArchives = recoveredResult.recoveredLeagueArchives;
  const effectiveTheIdolsArchives = recoveredResult.recoveredTheIdolsArchives;

  // 1. Gather all tournament cup seasons (strictly official completed archives, excluding unarchived active workspace)
  const allArchives = getAllSeasonArchives(
    effectiveTournamentArchives,
    matchDatabase,
    safeIdolsMap,
    undefined,
    undefined,
    undefined,
    activeSeasonNumber
  );

  // Filter for completed/crowned tournament seasons with strict deduplication by seasonId
  const crownedArchives = useMemo(() => {
    const seenSeasonIds = new Set<number>();
    const list: any[] = [];
    (allArchives || []).forEach((a) => {
      if (!a) return false;
      const sNum = Number(a.seasonId || 0);
      if (sNum > 0 && seenSeasonIds.has(sNum)) return;
      // Never show unarchived active season in crowned archives
      if (activeSeasonNumber && sNum >= activeSeasonNumber && !archives.some((arch) => Number(arch.seasonId) === sNum)) {
        return;
      }

      let champName = a.championName;
      if ((!champName || champName === 'Unknown' || champName === 'Pending' || champName === 'In Progress') && a.championId) {
        champName = safeIdolsMap.get(a.championId)?.name;
      }
      if (
        champName &&
        champName !== 'Pending' &&
        champName !== 'In Progress' &&
        champName !== 'Unknown'
      ) {
        if (sNum > 0) seenSeasonIds.add(sNum);
        list.push({
          ...a,
          championName: champName,
        });
      }
    });
    return list;
  }, [allArchives, safeIdolsMap, activeSeasonNumber, archives]);

  // Helper to resolve an idol object by ID or Name
  const resolveIdol = (id?: string | null, name?: string | null): Idol | null => {
    if (id && safeIdolsMap.has(id)) return safeIdolsMap.get(id)!;
    if (name) {
      const lower = name.trim().toLowerCase();
      for (const idol of safeIdolsMap.values()) {
        if (idol && idol.name && idol.name.trim().toLowerCase() === lower) return idol;
      }
    }
    return null;
  };

  // 2. Build map of all League seasons (strictly official archives)
  const allLeagueSeasons = useMemo(() => {
    const list: any[] = [];
    const seenLeagueSeasonNums = new Set<number>();

    // Past archived seasons
    (effectiveLeagueArchives || []).forEach((arch) => {
      if (!arch) return;
      const sNum = arch.seasonNumber || 1;
      if (seenLeagueSeasonNums.has(sNum)) return;
      // Do not show unarchived active season as an archived champion
      if (activeSeasonNumber && sNum >= activeSeasonNumber && !leagueArchives.some((l) => l.seasonNumber === sNum)) {
        return;
      }
      seenLeagueSeasonNums.add(sNum);

      list.push({
        seasonNumber: sNum,
        seasonName: arch.seasonName || `League Season ${sNum}`,
        isCurrent: false,
        completedAt: arch.completedAt || new Date().toISOString(),
        champions: DEFAULT_LEAGUE_DEFS.map((def) => {
          const customWinner = (arch.leagueWinners || []).find((w) => w.leagueId === def.id);
          const top = arch.allStandings?.[def.id]?.[0];
          const champObj = top || (customWinner ? {
            idolId: customWinner.championId,
            idolName: customWinner.championName,
            girlGroup: customWinner.championGroup,
            photoUrl: customWinner.championPhoto || '',
            points: customWinner.points || 0,
            wins: 0,
            played: 0,
            draws: 0,
            losses: 0,
            goalDifference: 0,
            goalsFor: 0,
            goalsAgainst: 0,
          } : undefined);

          return {
            divisionId: def.id,
            divisionName: customWinner?.leagueName || def.name,
            tierName: customWinner?.tierName || def.tierName,
            color: customWinner?.color || def.color,
            champion: champObj,
            isCompleted: true,
          };
        }),
      });
    });

    return list.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
  }, [effectiveLeagueArchives, activeSeasonNumber, leagueArchives]);

  // 2b. Build list of all The Idols seasons (strictly official archives)
  const allTheIdolsSeasons = useMemo(() => {
    const list: any[] = [];
    const seenIdolsSeasonNums = new Set<number>();

    // Past archives
    (effectiveTheIdolsArchives || []).forEach((arch) => {
      if (!arch) return;
      const sNum = arch.seasonNumber || 1;
      if (seenIdolsSeasonNums.has(sNum)) return;
      // Do not show unarchived active season as an archived champion
      if (activeSeasonNumber && sNum >= activeSeasonNumber && !theIdolsArchives.some((t) => t.seasonNumber === sNum)) {
        return;
      }
      seenIdolsSeasonNums.add(sNum);

      const sName = arch.seasonName || `The Idols Season ${sNum}`;
      const champ = arch.championId ? resolveIdol(arch.championId, arch.championName) : null;
      const ru = arch.runnerUpId ? resolveIdol(arch.runnerUpId, arch.runnerUpName) : null;
      const tp = arch.thirdPlaceId ? resolveIdol(arch.thirdPlaceId, arch.thirdPlaceName) : null;
      const topRegular = arch.standings?.[0];
      const regularChamp = topRegular ? resolveIdol(topRegular.idolId, topRegular.idolName) : null;

      list.push({
        seasonNumber: sNum,
        seasonName: sName,
        isCurrent: false,
        isPlayoffCompleted: Boolean(arch.championName),
        isLeagueCompleted: true,
        completedAt: arch.completedAt || new Date().toISOString(),
        champion: champ ? {
          idolId: champ.id,
          idolName: champ.name,
          girlGroup: champ.girlGroup,
          photoUrl: champ.photoUrl,
        } : (arch.championName ? {
          idolId: arch.championId || '',
          idolName: arch.championName,
          girlGroup: 'Solo',
          photoUrl: '',
        } : null),
        runnerUp: ru ? {
          idolId: ru.id,
          idolName: ru.name,
          girlGroup: ru.girlGroup,
          photoUrl: ru.photoUrl,
        } : (arch.runnerUpName ? {
          idolId: arch.runnerUpId || '',
          idolName: arch.runnerUpName,
          girlGroup: 'Solo',
          photoUrl: '',
        } : null),
        thirdPlace: tp ? {
          idolId: tp.id,
          idolName: tp.name,
          girlGroup: tp.girlGroup,
          photoUrl: tp.photoUrl,
        } : (arch.thirdPlaceName ? {
          idolId: arch.thirdPlaceId || '',
          idolName: arch.thirdPlaceName,
          girlGroup: 'Solo',
          photoUrl: '',
        } : null),
        superleagueWinner: regularChamp ? {
          idolId: regularChamp.id,
          idolName: regularChamp.name,
          girlGroup: regularChamp.girlGroup,
          photoUrl: regularChamp.photoUrl,
          points: topRegular?.points || 0,
          wins: topRegular?.wins || 0,
        } : null,
        mvp: arch.mvpName ? {
          idolId: arch.mvpId || '',
          idolName: arch.mvpName,
        } : null,
        topScorer: arch.topScorerName ? {
          idolId: arch.topScorerId || '',
          idolName: arch.topScorerName,
          goals: arch.topScorerGoals || 0,
        } : null,
      });
    });

    return list.sort((a, b) => (b.seasonNumber || 0) - (a.seasonNumber || 0));
  }, [effectiveTheIdolsArchives, activeSeasonNumber, theIdolsArchives, safeIdolsMap]);

  // 4. Compute comprehensive facts & Honours across everything
  const { idolHonoursMap, totalTournamentCupsCount, totalLeagueTitlesCount, totalTheIdolsTitlesCount } = useMemo<{
    idolHonoursMap: Map<string, IdolHonourRecord>;
    totalTournamentCupsCount: number;
    totalLeagueTitlesCount: number;
    totalTheIdolsTitlesCount: number;
  }>(() => {
    const map = new Map<string, IdolHonourRecord>();

    const getOrCreate = (id: string, fallbackName?: string, fallbackGroup?: string, fallbackPhoto?: string): IdolHonourRecord => {
      const idolObj = resolveIdol(id, fallbackName);
      const safeId = idolObj?.id || id || `idol-${fallbackName || 'unknown'}`;

      if (!map.has(safeId)) {
        map.set(safeId, {
          idolId: safeId,
          name: idolObj?.name || fallbackName || 'Unknown Idol',
          photoUrl: idolObj?.photoUrl || fallbackPhoto || '',
          girlGroup: idolObj?.girlGroup || fallbackGroup || 'Solo / Independent',
          nationality: idolObj?.nationality,
          tournamentCups: 0,
          tournamentRunnersUp: 0,
          tournamentThirdPlace: 0,
          premierTitles: 0,
          otherDivisionTitles: 0,
          totalLeagueTitles: 0,
          theIdolsMastersTitles: 0,
          theIdolsSuperleagueTitles: 0,
          theIdolsRunnersUp: 0,
          theIdolsThirdPlace: 0,
          totalTheIdolsTitles: 0,
          totalMajorTrophies: 0,
          honourPoints: 0,
          titlesHistory: [],
          matchesPlayed: 0,
          matchesWon: 0,
          matchesDrawn: 0,
          matchesLost: 0,
          winRate: 0,
        });
      }
      return map.get(safeId)!;
    };

    let cupsCount = 0;
    let leagueTitlesCount = 0;
    let theIdolsTitlesCount = 0;

    // 0. Pre-populate map with all registered idols in the system
    safeIdolsMap.forEach((idol) => {
      if (idol && idol.id) {
        getOrCreate(idol.id, idol.name, idol.girlGroup, idol.photoUrl);
      }
    });

    // A. Parse Tournament Archives (Champions, Runners-up, 3rd place)
    crownedArchives.forEach((arch) => {
      const sNum = arch.seasonId || 1;
      const sName = arch.seasonName || `Season ${sNum}`;
      const idolChamp = resolveIdol(arch.championId, arch.championName);
      const idolRU = resolveIdol(arch.runnerUpId, arch.runnerUpName);
      const idolTP = resolveIdol(arch.thirdPlaceId, arch.thirdPlaceName);

      // 1st place Cup Champion
      if (arch.championName && arch.championName !== 'Unknown' && arch.championName !== 'Pending') {
        const champ = getOrCreate(
          arch.championId || '',
          arch.championName,
          idolChamp?.girlGroup || (arch as any).championGroup,
          idolChamp?.photoUrl || (arch as any).championPhoto
        );
        champ.tournamentCups += 1;
        champ.totalMajorTrophies += 1;
        champ.honourPoints += 10;
        champ.titlesHistory.push({
          type: 'CUP',
          label: `🏆 ${sName} Tournament Cup Champion`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#eab308',
        });
        cupsCount++;
      }

      // Runner Up
      if (arch.runnerUpName && arch.runnerUpName !== 'Unknown' && arch.runnerUpName !== 'Pending' && arch.runnerUpName !== 'N/A') {
        const ru = getOrCreate(
          arch.runnerUpId || '',
          arch.runnerUpName,
          idolRU?.girlGroup || (arch as any).runnerUpGroup,
          idolRU?.photoUrl
        );
        ru.tournamentRunnersUp += 1;
        ru.honourPoints += 3;
        ru.titlesHistory.push({
          type: 'RUNNER_UP',
          label: `🥈 ${sName} Tournament Runner-Up`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#94a3b8',
        });
      }

      // 3rd Place
      if (arch.thirdPlaceName && arch.thirdPlaceName !== 'Unknown' && arch.thirdPlaceName !== 'Pending' && arch.thirdPlaceName !== 'N/A') {
        const tp = getOrCreate(
          arch.thirdPlaceId || '',
          arch.thirdPlaceName,
          idolTP?.girlGroup || (arch as any).thirdPlaceGroup,
          idolTP?.photoUrl
        );
        tp.tournamentThirdPlace += 1;
        tp.honourPoints += 2;
        tp.titlesHistory.push({
          type: 'THIRD_PLACE',
          label: `🥉 ${sName} Tournament 3rd Place`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#d97706',
        });
      }
    });

    // B. Parse Past League Archives
    (effectiveLeagueArchives || []).forEach((arch) => {
      if (!arch) return;
      const sNum = arch.seasonNumber || 1;
      const sName = arch.seasonName || `League Season ${sNum}`;

      // Process division winners
      const processedDivisions = new Set<number>();

      if (Array.isArray(arch.leagueWinners) && arch.leagueWinners.length > 0) {
        arch.leagueWinners.forEach((champ) => {
          if (!champ.championName && !champ.championId) return;
          processedDivisions.add(champ.leagueId);

          const record = getOrCreate(champ.championId, champ.championName, champ.championGroup, champ.championPhoto);
          const isDiv1 = champ.leagueId === 1;

          if (isDiv1) {
            record.premierTitles += 1;
            record.honourPoints += 8;
            record.titlesHistory.push({
              type: 'DIV1',
              label: `👑 ${sName} Premier League Champion (Div 1)`,
              seasonName: sName,
              seasonNumber: sNum,
              color: '#eab308',
            });
          } else {
            record.otherDivisionTitles += 1;
            record.honourPoints += 4;
            record.titlesHistory.push({
              type: 'DIV_OTHER',
              label: `🏅 ${sName} ${champ.leagueName || `Division ${champ.leagueId}`} Title`,
              seasonName: sName,
              seasonNumber: sNum,
              color: champ.color || '#6366f1',
            });
          }

          record.totalLeagueTitles += 1;
          record.totalMajorTrophies += 1;
          leagueTitlesCount++;
        });
      }

      // Also check allStandings for any missing division champions
      if (arch.allStandings) {
        Object.entries(arch.allStandings).forEach(([divIdStr, standings]) => {
          const divId = Number(divIdStr);
          if (processedDivisions.has(divId)) return;
          const top = standings?.[0];
          if (top && (top.idolId || top.idolName)) {
            processedDivisions.add(divId);
            const record = getOrCreate(top.idolId, top.idolName, top.girlGroup, top.photoUrl);
            const isDiv1 = divId === 1;

            if (isDiv1) {
              record.premierTitles += 1;
              record.honourPoints += 8;
              record.titlesHistory.push({
                type: 'DIV1',
                label: `👑 ${sName} Premier League Champion (Div 1)`,
                seasonName: sName,
                seasonNumber: sNum,
                color: '#eab308',
              });
            } else {
              record.otherDivisionTitles += 1;
              record.honourPoints += 4;
              const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === divId);
              record.titlesHistory.push({
                type: 'DIV_OTHER',
                label: `🏅 ${sName} ${def?.name || `Division ${divId}`} Title`,
                seasonName: sName,
                seasonNumber: sNum,
                color: def?.color || '#6366f1',
              });
            }

            record.totalLeagueTitles += 1;
            record.totalMajorTrophies += 1;
            leagueTitlesCount++;
          }
        });
      }
    });

    // C. Parse Active League Season (if any division completed and not already archived)
    const archivedLeagueSeasonNums = new Set((leagueArchives || []).map((a) => a.seasonNumber));
    if (leagueState && Array.isArray(leagueState.leagues) && !archivedLeagueSeasonNums.has(leagueState.seasonNumber)) {
      const sNum = leagueState.seasonNumber || 1;
      const sName = leagueState.seasonName || `League Season ${sNum}`;

      leagueState.leagues.forEach((l) => {
        if (l.isCompleted && l.standings?.[0]) {
          const top = l.standings[0];
          const record = getOrCreate(top.idolId, top.idolName, top.girlGroup, top.photoUrl);
          const isDiv1 = l.id === 1;

          if (isDiv1) {
            record.premierTitles += 1;
            record.honourPoints += 8;
            record.titlesHistory.push({
              type: 'DIV1',
              label: `👑 ${sName} Premier League Champion (Div 1)`,
              seasonName: sName,
              seasonNumber: sNum,
              color: '#eab308',
            });
          } else {
            record.otherDivisionTitles += 1;
            record.honourPoints += 4;
            record.titlesHistory.push({
              type: 'DIV_OTHER',
              label: `🏅 ${sName} ${l.name || `Division ${l.id}`} Title`,
              seasonName: sName,
              seasonNumber: sNum,
              color: l.color || '#6366f1',
            });
          }

          record.totalLeagueTitles += 1;
          record.totalMajorTrophies += 1;
          leagueTitlesCount++;
        }
      });
    }

    // D. Parse The Idols (Superleague & Masters Playoff) Archives
    (effectiveTheIdolsArchives || []).forEach((arch) => {
      if (!arch) return;
      const sNum = arch.seasonNumber || 1;
      const sName = arch.seasonName || `The Idols Season ${sNum}`;

      // 1. Masters Playoff Champion (Grand Final Winner)
      if (arch.championId || arch.championName) {
        const champ = getOrCreate(arch.championId || '', arch.championName, undefined, undefined);
        champ.theIdolsMastersTitles += 1;
        champ.totalTheIdolsTitles += 1;
        champ.totalMajorTrophies += 1;
        champ.honourPoints += 12;
        champ.titlesHistory.push({
          type: 'MASTERS_CHAMP',
          label: `👑 ${sName} Masters Playoff Champion`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#a855f7',
        });
        theIdolsTitlesCount++;
      }

      // 2. Masters Runner-Up
      if (arch.runnerUpId || arch.runnerUpName) {
        const ru = getOrCreate(arch.runnerUpId || '', arch.runnerUpName, undefined, undefined);
        ru.theIdolsRunnersUp += 1;
        ru.honourPoints += 4;
        ru.titlesHistory.push({
          type: 'THE_IDOLS_RU',
          label: `🥈 ${sName} Masters Runner-Up`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#94a3b8',
        });
      }

      // 3. Masters 3rd Place
      if (arch.thirdPlaceId || arch.thirdPlaceName) {
        const tp = getOrCreate(arch.thirdPlaceId || '', arch.thirdPlaceName, undefined, undefined);
        tp.theIdolsThirdPlace += 1;
        tp.honourPoints += 2;
        tp.titlesHistory.push({
          type: 'THE_IDOLS_3RD',
          label: `🥉 ${sName} Masters 3rd Place`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#d97706',
        });
      }

      // 4. Superleague Regular Season 1st Place (Shield)
      const topRegular = arch.standings?.[0];
      if (topRegular && (topRegular.idolId || topRegular.idolName)) {
        const sh = getOrCreate(topRegular.idolId, topRegular.idolName, topRegular.girlGroup, topRegular.photoUrl);
        sh.theIdolsSuperleagueTitles += 1;
        sh.totalTheIdolsTitles += 1;
        sh.totalMajorTrophies += 1;
        sh.honourPoints += 8;
        sh.titlesHistory.push({
          type: 'SUPERLEAGUE_SHIELD',
          label: `🛡️ ${sName} Superleague Regular Season Winner`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#38bdf8',
        });
        theIdolsTitlesCount++;
      }
    });

    // E. Parse Active The Idols Season (if not already archived)
    const archivedIdolsSeasonNums = new Set((effectiveTheIdolsArchives || []).map((a) => a.seasonNumber));
    if (theIdolsState && !archivedIdolsSeasonNums.has(theIdolsState.seasonNumber)) {
      const sNum = theIdolsState.seasonNumber || 1;
      const sName = theIdolsState.seasonName || `The Idols Season ${sNum}`;

      // Playoff Champion if completed
      if (theIdolsState.isPlayoffCompleted && (theIdolsState.championId || theIdolsState.championName)) {
        const champ = getOrCreate(theIdolsState.championId || '', theIdolsState.championName, undefined, undefined);
        champ.theIdolsMastersTitles += 1;
        champ.totalTheIdolsTitles += 1;
        champ.totalMajorTrophies += 1;
        champ.honourPoints += 12;
        champ.titlesHistory.push({
          type: 'MASTERS_CHAMP',
          label: `👑 ${sName} Masters Playoff Champion`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#a855f7',
        });
        theIdolsTitlesCount++;
      }

      // Superleague Regular Season Champion if completed
      if (theIdolsState.isLeagueCompleted && theIdolsState.standings?.[0]) {
        const top = theIdolsState.standings[0];
        const sh = getOrCreate(top.idolId, top.idolName, top.girlGroup, top.photoUrl);
        sh.theIdolsSuperleagueTitles += 1;
        sh.totalTheIdolsTitles += 1;
        sh.totalMajorTrophies += 1;
        sh.honourPoints += 8;
        sh.titlesHistory.push({
          type: 'SUPERLEAGUE_SHIELD',
          label: `🛡️ ${sName} Superleague Regular Season Winner`,
          seasonName: sName,
          seasonNumber: sNum,
          color: '#38bdf8',
        });
        theIdolsTitlesCount++;
      }
    }

    // V5 titles come from the permanent season archive. Fall back to live state
    // only for titles that have not yet been captured in the archive collection.
    const archivedV5Keys = new Set<string>();
    v5TitleArchives.forEach((title) => {
      const winner = getOrCreate(title.winnerId, title.winnerName, title.winnerGroup, title.winnerPhoto);
      if (title.isDivision) {
        winner.otherDivisionTitles += 1;
        winner.totalLeagueTitles += 1;
        leagueTitlesCount += 1;
      } else {
        winner.tournamentCups += 1;
        cupsCount += 1;
      }
      winner.totalMajorTrophies += 1;
      winner.honourPoints += title.isDivision ? 4 : 10;
      winner.titlesHistory.push({
        type: title.isDivision ? 'DIV_OTHER' : 'CUP',
        label: `V5: ${title.seasonName} / ${title.competition} Champion`,
        seasonName: title.seasonName,
        seasonNumber: title.seasonNumber,
        color: title.isDivision ? '#10b981' : '#eab308',
      });
      if (title.runnerUpId) {
        const runner = getOrCreate(title.runnerUpId, title.runnerUpName, title.runnerUpGroup, title.runnerUpPhoto);
        if (title.isDivision) runner.honourPoints += 2;
        else { runner.tournamentRunnersUp += 1; runner.honourPoints += 3; }
        runner.titlesHistory.push({
          type: 'RUNNER_UP',
          label: `V5: ${title.seasonName} / ${title.competition} Runner-Up`,
          seasonName: title.seasonName,
          seasonNumber: title.seasonNumber,
          color: '#94a3b8',
        });
      }
      archivedV5Keys.add(`${title.seasonNumber}:${title.competition}`);
    });
    const v5SeasonNumber = Number(leagueState?.seasonNumber || currentConfig?.seasonNumber || 1);
    const addLiveV5Title = (competition: string, winnerId?: string | null, runnerId?: string | null, isDivision = false) => {
      if (archivedV5Keys.has(`${v5SeasonNumber}:${competition}`) || !winnerId) return;
      const winner = resolveIdol(winnerId);
      if (!winner) return;
      const champ = getOrCreate(winner.id, winner.name, winner.girlGroup, winner.photoUrl);
      if (isDivision) { champ.otherDivisionTitles++; champ.totalLeagueTitles++; leagueTitlesCount++; }
      else { champ.tournamentCups++; cupsCount++; }
      champ.totalMajorTrophies++;
      champ.honourPoints += isDivision ? 4 : 10;
      const seasonName = leagueState?.seasonName || currentConfig?.seasonName || `Season ${v5SeasonNumber}`;
      champ.titlesHistory.push({ type: isDivision ? 'DIV_OTHER' : 'CUP', label: `V5: ${seasonName} / ${competition} Champion`, seasonName, seasonNumber: v5SeasonNumber, color: isDivision ? '#10b981' : '#eab308' });
      if (runnerId) {
        const runner = resolveIdol(runnerId);
        if (runner) {
          const record = getOrCreate(runner.id, runner.name, runner.girlGroup, runner.photoUrl);
          if (isDivision) record.honourPoints += 2;
          else { record.tournamentRunnersUp++; record.honourPoints += 3; }
          record.titlesHistory.push({ type: 'RUNNER_UP', label: `V5: ${seasonName} / ${competition} Runner-Up`, seasonName, seasonNumber: v5SeasonNumber, color: '#94a3b8' });
        }
      }
    };
    (v5State?.d2 || []).forEach((league) => {
      if (league.isCompleted && league.championId) {
        const ranked = [...(league.standings || [])].sort((a, b) => a.rank - b.rank);
        addLiveV5Title(`Division 2 / ${league.name}`, league.championId, ranked[1]?.idolId, true);
      }
    });
    const ccFinal = v5State?.champsCup?.matches?.find((m) => m.id === 'cc_gf');
    if (ccFinal?.completed) addLiveV5Title('League Champions Cup', ccFinal.winnerId, ccFinal.loserId);
    const lcFinal = v5State?.leagueCup?.rounds?.slice(-1)[0]?.find((m) => m.completed);
    if (v5State?.leagueCup?.championId) addLiveV5Title('All-League Knockout Cup', v5State.leagueCup.championId, lcFinal?.loserId);
    Object.entries(v5State?.miniCups || {}).forEach(([leagueId, matches]) => {
      const final = matches.find((m) => m.id === `mc${leagueId}_final`);
      if (final?.completed) addLiveV5Title(`Top 16 Mini Cup / League ${leagueId}`, final.winnerId, final.loserId);
    });
    if (v5State?.superA?.completed) addLiveV5Title('Super Cup A', v5State.superA.winnerId, v5State.superA.loserId);
    (v5State?.superB || []).forEach((m, index) => { if (m.completed) addLiveV5Title(`Super Cup B ${index + 1}`, m.winnerId, m.loserId); });

    // F. Ingest Match Database to compute actual career match records (played, won, drawn, lost, win rate)
    (matchDatabase || []).forEach((m) => {
      if (!m || m.scoreA === null || m.scoreB === null || m.scoreA === undefined || m.scoreB === undefined) return;

      const idolA = getOrCreate(m.idolAId, m.idolAName, m.idolAGroup);
      const idolB = getOrCreate(m.idolBId, m.idolBName, m.idolBGroup);

      idolA.matchesPlayed += 1;
      idolB.matchesPlayed += 1;

      const scoreA = Number(m.scoreA);
      const scoreB = Number(m.scoreB);

      if (scoreA > scoreB) {
        idolA.matchesWon += 1;
        idolB.matchesLost += 1;
      } else if (scoreB > scoreA) {
        idolB.matchesWon += 1;
        idolA.matchesLost += 1;
      } else {
        idolA.matchesDrawn += 1;
        idolB.matchesDrawn += 1;
      }
    });

    // Calculate win rates
    map.forEach((record) => {
      record.winRate = record.matchesPlayed > 0 ? (record.matchesWon / record.matchesPlayed) * 100 : 0;
    });

    return {
      idolHonoursMap: map,
      totalTournamentCupsCount: cupsCount,
      totalLeagueTitlesCount: leagueTitlesCount,
      totalTheIdolsTitlesCount: theIdolsTitlesCount,
    };
  }, [crownedArchives, effectiveLeagueArchives, leagueState, effectiveTheIdolsArchives, theIdolsState, matchDatabase, safeIdolsMap, v5State, v5TitleArchives, leagueState, currentConfig]);

  // 5. Build filtered & sorted Honours list for the Combined View
  const combinedHonoursList = useMemo(() => {
    let list: IdolHonourRecord[] = Array.from(idolHonoursMap.values()) as IdolHonourRecord[];

    // Filter
    if (combinedFilter === 'ALL_TITLE_HOLDERS') {
      list = list.filter((i) => i.totalMajorTrophies > 0 || i.tournamentRunnersUp > 0 || i.tournamentThirdPlace > 0 || i.theIdolsRunnersUp > 0 || i.theIdolsThirdPlace > 0);
    } else if (combinedFilter === 'TOURNAMENT_WINNERS') {
      list = list.filter((i) => i.tournamentCups > 0);
    } else if (combinedFilter === 'LEAGUE_CHAMPS') {
      list = list.filter((i) => i.totalLeagueTitles > 0);
    } else if (combinedFilter === 'THE_IDOLS_CHAMPS') {
      list = list.filter((i) => i.totalTheIdolsTitles > 0 || i.theIdolsMastersTitles > 0);
    }

    // Search
    if (combinedSearch.trim()) {
      const q = combinedSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.girlGroup.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (combinedSort === 'TOTAL_TROPHIES') {
        return (
          b.totalMajorTrophies - a.totalMajorTrophies ||
          b.tournamentCups - a.tournamentCups ||
          b.theIdolsMastersTitles - a.theIdolsMastersTitles ||
          b.premierTitles - a.premierTitles ||
          b.winRate - a.winRate
        );
      }
      if (combinedSort === 'HONOUR_POINTS') {
        return b.honourPoints - a.honourPoints || b.totalMajorTrophies - a.totalMajorTrophies;
      }
      if (combinedSort === 'TOURNAMENT_CUPS') {
        return b.tournamentCups - a.tournamentCups || b.totalMajorTrophies - a.totalMajorTrophies;
      }
      if (combinedSort === 'LEAGUE_TITLES') {
        return b.totalLeagueTitles - a.totalLeagueTitles || b.premierTitles - a.premierTitles;
      }
      if (combinedSort === 'THE_IDOLS_TITLES') {
        return b.totalTheIdolsTitles - a.totalTheIdolsTitles || b.theIdolsMastersTitles - a.theIdolsMastersTitles || b.totalMajorTrophies - a.totalMajorTrophies;
      }
      if (combinedSort === 'WIN_RATE') {
        return b.winRate - a.winRate || b.matchesWon - a.matchesWon;
      }
      if (combinedSort === 'TOTAL_WINS') {
        return b.matchesWon - a.matchesWon || b.winRate - a.winRate;
      }
      return 0;
    });

    return list;
  }, [idolHonoursMap, combinedFilter, combinedSearch, combinedSort]);

  // 6. Girl Group Honours Aggregate
  const girlGroupHonours = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        groupName: string;
        totalTrophies: number;
        cups: number;
        premierTitles: number;
        otherDivTitles: number;
        theIdolsTitles: number;
        membersCount: number;
        topIdol: string;
      }
    >();

    (Array.from(idolHonoursMap.values()) as IdolHonourRecord[]).forEach((idol) => {
      const gName = idol.girlGroup || 'Solo / Independent';
      if (!groupMap.has(gName)) {
        groupMap.set(gName, {
          groupName: gName,
          totalTrophies: 0,
          cups: 0,
          premierTitles: 0,
          otherDivTitles: 0,
          theIdolsTitles: 0,
          membersCount: 0,
          topIdol: idol.name,
        });
      }
      const g = groupMap.get(gName)!;
      g.totalTrophies += idol.totalMajorTrophies;
      g.cups += idol.tournamentCups;
      g.premierTitles += idol.premierTitles;
      g.otherDivTitles += idol.otherDivisionTitles;
      g.theIdolsTitles += idol.totalTheIdolsTitles;
      if (idol.totalMajorTrophies > 0) g.membersCount += 1;
    });

    return Array.from(groupMap.values())
      .filter((g) => g.totalTrophies > 0)
      .sort((a, b) => b.totalTrophies - a.totalTrophies || b.cups - a.cups || b.theIdolsTitles - a.theIdolsTitles);
  }, [idolHonoursMap]);

  // Best Idol (All-Time GOAT)
  const allTimeGOAT = useMemo(() => {
    const sorted = (Array.from(idolHonoursMap.values()) as IdolHonourRecord[]).sort(
      (a, b) => b.totalMajorTrophies - a.totalMajorTrophies || b.tournamentCups - a.tournamentCups || b.winRate - a.winRate
    );
    return sorted.length > 0 && sorted[0].totalMajorTrophies > 0 ? sorted[0] : null;
  }, [idolHonoursMap]);

  // Best Girl Group
  const dominantGirlGroup = useMemo(() => {
    return girlGroupHonours.length > 0 ? girlGroupHonours[0] : null;
  }, [girlGroupHonours]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Sub-Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-red-500 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Crown className="h-7 w-7 text-amber-400" />
            <span>Hall of Champions</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Historic wall of honor celebrating Tournament Cup winners, League Division champions, and all-time legends.
          </p>
        </div>

        {/* Tab switch buttons & Reconcile Button */}
        <div className="flex flex-wrap items-center gap-2">
          {onReconcileArchives && (
            <button
              onClick={() => {
                onReconcileArchives();
                setReconcileSuccessMsg(
                  recoveredResult.recoveredSeasonNumbers.length > 0
                    ? `Successfully synchronized and restored Season ${recoveredResult.recoveredSeasonNumbers.join(', ')} archive data into the database!`
                    : 'Database and Hall of Champions are fully synchronized!'
                );
                setTimeout(() => setReconcileSuccessMsg(null), 5000);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-300 text-xs font-poster-body font-black transition-all poster-shadow-sm hover:scale-105"
              title="Inspect match database and reconcile missing seasons into permanent archives"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {recoveredResult.recoveredSeasonNumbers.length > 0
                  ? `Reconcile (+${recoveredResult.recoveredSeasonNumbers.length} Seasons)`
                  : 'Reconcile Archives'}
              </span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-1 bg-[#160f0b] p-1 rounded-2xl border-2 border-black poster-shadow-sm">
            <button
              onClick={() => setActiveTab('tournament')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                activeTab === 'tournament'
                  ? 'poster-pill-red text-white shadow'
                  : 'text-amber-200/70 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Tournament Cup ({crownedArchives.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('league')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                activeTab === 'league'
                  ? 'poster-pill-gold text-amber-950 shadow'
                  : 'text-amber-200/70 hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>League Divisions ({allLeagueSeasons.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('the_idols')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                activeTab === 'the_idols'
                  ? 'bg-purple-600 text-white shadow ring-2 ring-purple-400/40'
                  : 'text-purple-300/80 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-purple-300" />
              <span>The Idols &amp; Masters ({allTheIdolsSeasons.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('combined')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poster-body font-black transition-all ${
                activeTab === 'combined'
                  ? 'bg-amber-400 text-black shadow'
                  : 'text-amber-200/70 hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Combined Hall &amp; Fact Leaders</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation Alert Banner */}
      {reconcileSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border-2 border-emerald-500/80 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{reconcileSuccessMsg}</span>
        </div>
      )}

      {/* 1. TOURNAMENT CUP CHAMPIONS */}
      {activeTab === 'tournament' && (
        <div className="space-y-6">
          {crownedArchives.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...crownedArchives].reverse().map((arch, idx) => {
                const championIdol = resolveIdol(arch.championId, arch.championName);

                return (
                  <div
                    key={`hoc-${arch?.seasonId ?? idx}-${idx}`}
                    className="relative overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-[#2b1b11] via-[#1a120c] to-[#120d09] p-6 space-y-4 poster-shadow-md"
                  >
                    {/* Badge */}
                    <div className="flex items-center justify-between border-b border-black pb-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-400" />
                        <h3 className="font-poster-title text-base text-white">
                          {arch?.seasonName || `Season ${arch?.seasonId || 1}`}
                        </h3>
                      </div>
                      <span className="text-[10px] text-amber-300/60 font-black">
                        {arch.completedAt ? new Date(arch.completedAt).toLocaleDateString() : ''}
                      </span>
                    </div>

                    {/* Champion Showcase */}
                    <div className="flex flex-col items-center text-center space-y-2 py-2">
                      <div className="relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-amber-400 shadow-xl ring-4 ring-amber-400/20">
                        {championIdol?.photoUrl || (arch as any).championPhoto ? (
                          <img
                            src={championIdol?.photoUrl || (arch as any).championPhoto}
                            alt={arch.championName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center font-poster-title text-xl text-amber-300 bg-black">
                            {arch.championName?.slice(0, 2) || 'CH'}
                          </div>
                        )}
                      </div>
                      <h4 className="font-poster-title text-xl text-white">
                        {arch.championName}
                      </h4>
                      <span className="text-xs text-amber-300 font-bold">
                        {championIdol?.girlGroup || (arch as any).championGroup || 'Solo'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-black text-amber-300 border border-amber-400/40">
                        <Crown className="h-3 w-3 text-amber-400" /> Grand Cup Champion
                      </span>
                    </div>

                    {/* Podium runners up */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-black">
                      <div className="rounded-xl bg-[#120d09] p-2.5 border border-black text-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Runner-Up (2nd)
                        </span>
                        <span className="font-bold text-slate-200 block truncate">
                          {arch.runnerUpName || 'N/A'}
                        </span>
                      </div>

                      <div className="rounded-xl bg-[#120d09] p-2.5 border border-black text-center">
                        <span className="text-[10px] text-amber-600 font-bold uppercase block">
                          3rd Place
                        </span>
                        <span className="font-bold text-slate-200 block truncate">
                          {arch.thirdPlaceName || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-12 text-center space-y-3 poster-shadow-sm">
              <Crown className="h-12 w-12 text-amber-500/40 mx-auto" />
              <h3 className="text-lg font-poster-title text-amber-200">No Tournament Champions Crowned Yet</h3>
              <p className="text-xs text-amber-200/60 max-w-sm mx-auto font-bold">
                Complete a tournament season and click &quot;Crown Champion &amp; Archive Season&quot; in the Knockout Bracket panel.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. LEAGUE DIVISION CHAMPIONS */}
      {activeTab === 'league' && (
        <div className="space-y-6">
          {allLeagueSeasons.length > 0 ? (
            <div className="space-y-6">
              {allLeagueSeasons.map((ls, sIdx) => (
                <div
                  key={`ls-champs-${ls.seasonNumber}-${sIdx}`}
                  className="rounded-3xl border-3 border-black bg-[#1a120d] p-5 md:p-6 space-y-4 poster-shadow-md"
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <div className="flex items-center gap-2">
                      <Table className="w-5 h-5 text-amber-400" />
                      <h3 className="font-poster-title text-lg text-amber-300">
                        {ls.seasonName} {ls.isCurrent ? '(Active Season Leaders)' : '(Official Champions)'}
                      </h3>
                    </div>
                    <span className="text-[11px] font-black text-amber-200/70">
                      {ls.completedAt ? new Date(ls.completedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {ls.champions.map((c) => (
                      <div
                        key={`div-champ-${c.divisionId}`}
                        className="rounded-2xl border-2 border-black p-3.5 bg-[#120d09] text-center space-y-2 poster-shadow-sm"
                        style={{ borderTop: `4px solid ${c.color}` }}
                      >
                        <span className="text-[10px] font-black uppercase text-amber-400 truncate block">
                          {c.divisionName}
                        </span>
                        {c.champion ? (
                          <div className="space-y-1.5">
                            {c.champion.photoUrl ? (
                              <img
                                src={c.champion.photoUrl}
                                alt={c.champion.idolName}
                                className="w-14 h-14 rounded-2xl object-cover border-2 border-black mx-auto shadow"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-[#1c130c] border-2 border-black mx-auto flex items-center justify-center font-poster-title text-sm text-amber-300">
                                {c.champion.idolName?.slice(0, 2)}
                              </div>
                            )}
                            <div className="font-poster-title text-xs text-white font-bold truncate">
                              {c.champion.idolName}
                            </div>
                            <div className="text-[10px] text-amber-300 font-black">
                              {c.champion.points} PTS &bull; {c.champion.wins}W
                            </div>
                            {c.isCompleted ? (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/20 text-[9px] font-black text-amber-300 border border-amber-400/30">
                                🏆 Title Winner
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/20 text-[9px] font-black text-blue-300 border border-blue-400/30">
                                ⏱️ In Progress (1st)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="py-6 text-xs text-amber-200/40 font-bold">
                            TBD
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-12 text-center space-y-3 poster-shadow-sm">
              <Table className="h-12 w-12 text-amber-500/40 mx-auto" />
              <h3 className="text-lg font-poster-title text-amber-200">No League Seasons Recorded Yet</h3>
              <p className="text-xs text-amber-200/60 max-w-sm mx-auto font-bold">
                Play through league matchdays and crown the champion to store archived league title winners here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2b. THE IDOLS & MASTERS PLAYOFFS CHAMPIONS */}
      {activeTab === 'the_idols' && (
        <div className="space-y-6">
          {allTheIdolsSeasons.length > 0 ? (
            <div className="space-y-6">
              {allTheIdolsSeasons.map((tis, sIdx) => (
                <div
                  key={`the-idols-champ-${tis.seasonNumber}-${sIdx}`}
                  className="rounded-3xl border-3 border-purple-500/50 bg-[#160d1b] p-6 space-y-6 poster-shadow-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b-2 border-purple-900/50 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/40">
                        <Zap className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-poster-title text-xl text-purple-300 flex items-center gap-2">
                          {tis.seasonName}
                          {tis.isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase">
                              Active Season
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-purple-200/60 font-bold">
                          The Idols Superleague 38 Matchdays &amp; The Masters Postseason Playoffs
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-purple-300/70 font-bold">
                      {tis.completedAt ? new Date(tis.completedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Masters Playoff Grand Champion */}
                    <div className="rounded-2xl border-2 border-purple-400 bg-gradient-to-b from-purple-950/60 to-[#100814] p-4 text-center space-y-3 poster-shadow-md">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-[10px] font-black text-purple-300 uppercase">
                        <Crown className="w-3 h-3 text-amber-300" /> Masters Playoff Champion
                      </div>
                      {tis.champion ? (
                        <div className="space-y-2">
                          {tis.champion.photoUrl ? (
                            <img
                              src={tis.champion.photoUrl}
                              alt={tis.champion.idolName}
                              className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-400 mx-auto shadow-lg ring-4 ring-purple-500/20"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-purple-950 border-2 border-purple-400 mx-auto flex items-center justify-center font-poster-title text-base text-purple-300">
                              {tis.champion.idolName.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <h4 className="font-poster-title text-lg text-white font-bold">{tis.champion.idolName}</h4>
                            <span className="text-xs text-purple-300 font-bold">{tis.champion.girlGroup}</span>
                          </div>
                          <span className="inline-block px-3 py-1 rounded-xl bg-amber-400 text-black text-xs font-black font-poster-body shadow">
                            👑 Grand Final Winner
                          </span>
                        </div>
                      ) : (
                        <div className="py-8 text-xs text-purple-300/40 font-bold">
                          Playoffs in Progress / TBD
                        </div>
                      )}
                    </div>

                    {/* Superleague Regular Season 1st Place (Shield) */}
                    <div className="rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-b from-cyan-950/40 to-[#081116] p-4 text-center space-y-3 poster-shadow-md">
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-black text-cyan-300 uppercase">
                        <Shield className="w-3 h-3 text-cyan-300" /> Superleague 1st (Shield)
                      </div>
                      {tis.superleagueWinner ? (
                        <div className="space-y-2">
                          {tis.superleagueWinner.photoUrl ? (
                            <img
                              src={tis.superleagueWinner.photoUrl}
                              alt={tis.superleagueWinner.idolName}
                              className="w-16 h-16 rounded-2xl object-cover border-2 border-cyan-400 mx-auto shadow-lg ring-4 ring-cyan-500/20"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-cyan-950 border-2 border-cyan-400 mx-auto flex items-center justify-center font-poster-title text-base text-cyan-300">
                              {tis.superleagueWinner.idolName.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <h4 className="font-poster-title text-lg text-white font-bold">{tis.superleagueWinner.idolName}</h4>
                            <span className="text-xs text-cyan-300 font-bold">{tis.superleagueWinner.girlGroup}</span>
                          </div>
                          <div className="text-xs font-mono font-black text-cyan-300">
                            {tis.superleagueWinner.points} PTS &bull; {tis.superleagueWinner.wins} WINS
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-xs text-cyan-300/40 font-bold">
                          League in Progress / TBD
                        </div>
                      )}
                    </div>

                    {/* Masters Runner-Up & 3rd Place */}
                    <div className="rounded-2xl border-2 border-black bg-[#120a17] p-4 space-y-3 poster-shadow-sm flex flex-col justify-between">
                      <div className="text-center text-[10px] font-black uppercase text-purple-300 border-b border-purple-950 pb-1.5">
                        Masters Playoff Podium
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-900/40">
                          <span className="text-[10px] text-slate-400 uppercase font-black block">🥈 Runner-Up</span>
                          <span className="font-bold text-white block truncate">{tis.runnerUp?.idolName || 'TBD'}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-900/40">
                          <span className="text-[10px] text-amber-500 uppercase font-black block">🥉 3rd Place</span>
                          <span className="font-bold text-white block truncate">{tis.thirdPlace?.idolName || 'TBD'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Individual Honours (MVP & Top Scorer) */}
                    <div className="rounded-2xl border-2 border-black bg-[#120a17] p-4 space-y-3 poster-shadow-sm flex flex-col justify-between">
                      <div className="text-center text-[10px] font-black uppercase text-purple-300 border-b border-purple-950 pb-1.5">
                        Season Awards
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-900/40">
                          <span className="text-[10px] text-amber-400 uppercase font-black block flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400" /> Season MVP
                          </span>
                          <span className="font-bold text-white block truncate">{tis.mvp?.idolName || 'Pending'}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-purple-950/40 border border-purple-900/40">
                          <span className="text-[10px] text-emerald-400 uppercase font-black block flex items-center gap-1">
                            <Flame className="w-3 h-3 text-emerald-400" /> Golden Boot
                          </span>
                          <span className="font-bold text-white block truncate">
                            {tis.topScorer?.idolName ? `${tis.topScorer.idolName} (${tis.topScorer.goals}G)` : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-12 text-center space-y-3 poster-shadow-sm">
              <Zap className="h-12 w-12 text-purple-400/40 mx-auto" />
              <h3 className="text-lg font-poster-title text-purple-200">No The Idols Seasons Recorded Yet</h3>
              <p className="text-xs text-purple-200/60 max-w-sm mx-auto font-bold">
                Play through The Idols 38 matchdays and The Masters playoffs to record historical Superleague champions here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. COMBINED ALL-TIME TITLE LEADERBOARD & ACTUAL FACTS */}
      {activeTab === 'combined' && (
        <div className="space-y-6">
          {/* Fact Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border-2 border-black bg-[#1a120d] p-4 space-y-1.5 poster-shadow-sm">
              <div className="flex items-center gap-2 text-amber-400">
                <Trophy className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase text-amber-300/80">Tournament Cups</span>
              </div>
              <div className="font-mono text-2xl font-black text-white">{totalTournamentCupsCount}</div>
              <p className="text-[10px] text-amber-200/60 font-bold">Grand Tournament Champions</p>
            </div>

            <div className="rounded-2xl border-2 border-black bg-[#1a120d] p-4 space-y-1.5 poster-shadow-sm">
              <div className="flex items-center gap-2 text-amber-400">
                <Table className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase text-amber-300/80">League Titles</span>
              </div>
              <div className="font-mono text-2xl font-black text-amber-300">{totalLeagueTitlesCount}</div>
              <p className="text-[10px] text-amber-200/60 font-bold">Div 1 to Div 6 Division Crowns</p>
            </div>

            <div className="rounded-2xl border-2 border-black bg-[#1a120d] p-4 space-y-1.5 poster-shadow-sm">
              <div className="flex items-center gap-2 text-purple-400">
                <Zap className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase text-purple-300/80">The Idols Honours</span>
              </div>
              <div className="font-mono text-2xl font-black text-purple-300">{totalTheIdolsTitlesCount}</div>
              <p className="text-[10px] text-purple-200/60 font-bold">Masters Champions &amp; Shields</p>
            </div>

            <div className="rounded-2xl border-2 border-black bg-[#1a120d] p-4 space-y-1.5 poster-shadow-sm">
              <div className="flex items-center gap-2 text-amber-400">
                <Flame className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase text-amber-300/80">All-Time GOAT</span>
              </div>
              <div className="font-poster-title text-base font-black text-white truncate">
                {allTimeGOAT ? allTimeGOAT.name : 'TBD'}
              </div>
              <p className="text-[10px] text-amber-400 font-bold">
                {allTimeGOAT ? `${allTimeGOAT.totalMajorTrophies} Total Trophies (${allTimeGOAT.tournamentCups} Cups, ${allTimeGOAT.totalLeagueTitles} League, ${allTimeGOAT.totalTheIdolsTitles} The Idols)` : 'No titles won yet'}
              </p>
            </div>

            <div className="rounded-2xl border-2 border-black bg-[#1a120d] p-4 space-y-1.5 poster-shadow-sm col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 text-amber-400">
                <Users className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase text-amber-300/80">Top Girl Group</span>
              </div>
              <div className="font-poster-title text-base font-black text-white truncate">
                {dominantGirlGroup ? dominantGirlGroup.groupName : 'TBD'}
              </div>
              <p className="text-[10px] text-amber-400 font-bold">
                {dominantGirlGroup ? `${dominantGirlGroup.totalTrophies} Combined Honours Won` : 'No titles won yet'}
              </p>
            </div>
          </div>

          {/* Main Honours Matrix Table Container */}
          <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 space-y-5 poster-shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
              <div>
                <h3 className="font-poster-title text-lg text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>All-Time Honours &amp; Career Fact Matrix</span>
                </h3>
                <p className="text-xs text-amber-200/70 font-bold mt-0.5">
                  Complete record combining Tournament Cups, League Division Championships, Superleague/Masters titles, and actual match performance.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-amber-400/60 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={combinedSearch}
                    onChange={(e) => setCombinedSearch(e.target.value)}
                    placeholder="Search idol or group..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-[#120d09] border border-slate-700 text-xs text-white placeholder:text-amber-200/40 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Filter */}
                <select
                  value={combinedFilter}
                  onChange={(e) => setCombinedFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-[#120d09] border border-slate-700 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL_TITLE_HOLDERS">All Title Holders ({(Array.from(idolHonoursMap.values()) as IdolHonourRecord[]).filter(i => i.totalMajorTrophies > 0 || i.tournamentRunnersUp > 0).length})</option>
                  <option value="TOURNAMENT_WINNERS">Tournament Cup Winners Only</option>
                  <option value="LEAGUE_CHAMPS">League Division Champions Only</option>
                  <option value="THE_IDOLS_CHAMPS">The Idols &amp; Masters Winners Only</option>
                  <option value="ALL_PLAYERS">All Competitors with Records ({idolHonoursMap.size})</option>
                </select>

                {/* Sort */}
                <select
                  value={combinedSort}
                  onChange={(e) => setCombinedSort(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-[#120d09] border border-slate-700 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="TOTAL_TROPHIES">Sort: Most Total Trophies</option>
                  <option value="HONOUR_POINTS">Sort: Highest Honour Points</option>
                  <option value="TOURNAMENT_CUPS">Sort: Most Tournament Cups</option>
                  <option value="LEAGUE_TITLES">Sort: Most League Titles</option>
                  <option value="THE_IDOLS_TITLES">Sort: Most The Idols Titles</option>
                  <option value="WIN_RATE">Sort: Highest Win Rate %</option>
                  <option value="TOTAL_WINS">Sort: Most Total Match Wins</option>
                </select>
              </div>
            </div>

            {combinedHonoursList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-poster-body">
                  <thead className="bg-[#120d09] text-[10px] font-black uppercase text-amber-300 border-b-2 border-black">
                    <tr>
                      <th className="px-3 py-3 text-center">Rank</th>
                      <th className="px-4 py-3">Idol</th>
                      <th className="px-3 py-3 text-center text-amber-400 font-black">🏆 Cups</th>
                      <th className="px-3 py-3 text-center text-slate-400 font-black">🥈 2nd / 🥉 3rd</th>
                      <th className="px-3 py-3 text-center text-amber-300 font-black">👑 Div 1</th>
                      <th className="px-3 py-3 text-center text-cyan-400 font-black">🛡️ Div 2-6</th>
                      <th className="px-3 py-3 text-center text-purple-400 font-black">⚡ The Idols</th>
                      <th className="px-3 py-3 text-center text-amber-400 font-black text-sm">⭐ Total Trophies</th>
                      <th className="px-4 py-3 text-center text-slate-300 font-black">📊 Record &amp; Win%</th>
                      <th className="px-4 py-3">Trophy Cabinet / Title Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/40 font-medium">
                    {combinedHonoursList.map((lead, idx) => (
                      <tr key={lead.idolId} className="hover:bg-[#251a13] transition-colors">
                        {/* Rank */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
                              idx === 0
                                ? 'bg-amber-400 text-black font-black'
                                : idx === 1
                                ? 'bg-slate-300 text-black font-black'
                                : idx === 2
                                ? 'bg-amber-700 text-white font-black'
                                : 'bg-black text-amber-300'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>

                        {/* Idol Info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {lead.photoUrl ? (
                              <img
                                src={lead.photoUrl}
                                alt={lead.name}
                                className="w-9 h-9 rounded-xl object-cover border border-black shadow"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-black border border-black flex items-center justify-center font-poster-title text-xs text-amber-300">
                                {lead.name.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-sm">{lead.name}</span>
                                {lead.nationality && (
                                  <span className="text-xs" title={lead.nationality}>
                                    {getCountryFlag(lead.nationality)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-amber-400/80 font-bold block">
                                {lead.girlGroup}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Tournament Cups */}
                        <td className="px-3 py-3 text-center font-mono font-bold text-amber-400">
                          {lead.tournamentCups > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300">
                              {lead.tournamentCups}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Runners Up / 3rd */}
                        <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-400">
                          {lead.tournamentRunnersUp > 0 || lead.tournamentThirdPlace > 0 || lead.theIdolsRunnersUp > 0 || lead.theIdolsThirdPlace > 0 ? (
                            <span>
                              {lead.tournamentRunnersUp + lead.theIdolsRunnersUp}🥈 / {lead.tournamentThirdPlace + lead.theIdolsThirdPlace}🥉
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Premier League Div 1 */}
                        <td className="px-3 py-3 text-center font-mono font-bold text-amber-300">
                          {lead.premierTitles > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200">
                              {lead.premierTitles}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Other Divisions (Div 2-6) */}
                        <td className="px-3 py-3 text-center font-mono font-bold text-cyan-400">
                          {lead.otherDivisionTitles > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                              {lead.otherDivisionTitles}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* The Idols (Masters & Superleague) */}
                        <td className="px-3 py-3 text-center font-mono font-bold text-purple-400">
                          {lead.totalTheIdolsTitles > 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/40 text-purple-300" title={`👑 ${lead.theIdolsMastersTitles} Masters, 🛡️ ${lead.theIdolsSuperleagueTitles} Superleague`}>
                              {lead.totalTheIdolsTitles} ⚡
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Total Trophies */}
                        <td className="px-3 py-3 text-center font-mono font-black text-base text-amber-400">
                          {lead.totalMajorTrophies > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400 text-black font-black shadow-sm">
                              {lead.totalMajorTrophies} ⭐
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">0</span>
                          )}
                        </td>

                        {/* Actual Match Stats & Win% */}
                        <td className="px-4 py-3 text-center">
                          <div className="font-mono text-xs text-white font-bold">
                            {lead.matchesWon}W - {lead.matchesDrawn}D - {lead.matchesLost}L
                          </div>
                          <div className="text-[10px] font-black text-amber-400/90">
                            {lead.winRate.toFixed(1)}% WR ({lead.matchesPlayed} MP)
                          </div>
                        </td>

                        {/* Badges / History */}
                        <td className="px-4 py-3">
                          {lead.titlesHistory.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {lead.titlesHistory.map((th, hIdx) => (
                                <span
                                  key={`h-${lead.idolId}-${hIdx}`}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-black"
                                  style={{
                                    backgroundColor: th.type === 'CUP' ? '#78350f' : th.type === 'DIV1' ? '#451a03' : th.type === 'MASTERS_CHAMP' ? '#581c87' : th.type === 'SUPERLEAGUE_SHIELD' ? '#0e7490' : '#1e1b4b',
                                    color: th.type === 'CUP' ? '#fef08a' : th.type === 'DIV1' ? '#fde047' : th.type === 'MASTERS_CHAMP' ? '#f3e8ff' : th.type === 'SUPERLEAGUE_SHIELD' ? '#cffafe' : '#93c5fd',
                                  }}
                                  title={th.label}
                                >
                                  {th.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Active competitor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-amber-200/50 font-bold text-xs space-y-2">
                <Award className="w-10 h-10 text-amber-500/30 mx-auto" />
                <p>No competitor records matched your filter criteria.</p>
              </div>
            )}
          </div>

          {/* Girl Groups Honours Leaderboard */}
          {girlGroupHonours.length > 0 && (
            <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 space-y-4 poster-shadow-lg">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="font-poster-title text-base text-amber-300">
                    Girl Groups All-Time Honours Leaderboard
                  </h3>
                </div>
                <span className="text-xs font-bold text-amber-200/70">
                  Ranking groups by total tournament cups, league championships, and Superleague/Masters titles
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {girlGroupHonours.map((gg, gIdx) => (
                  <div
                    key={`gg-honour-${gg.groupName}`}
                    className="rounded-2xl border-2 border-black bg-[#120d09] p-4 space-y-2 poster-shadow-sm flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 font-poster-title truncate">
                        #{gIdx + 1} {gg.groupName}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-mono font-black text-xs border border-amber-400/30">
                        {gg.totalTrophies} Trophies
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center text-[10px] pt-1">
                      <div className="rounded-lg bg-[#1a120d] p-1 border border-black">
                        <span className="text-slate-400 block font-bold">Cups</span>
                        <span className="font-mono font-black text-amber-400">{gg.cups} 🏆</span>
                      </div>
                      <div className="rounded-lg bg-[#1a120d] p-1 border border-black">
                        <span className="text-slate-400 block font-bold">Div 1</span>
                        <span className="font-mono font-black text-amber-300">{gg.premierTitles} 👑</span>
                      </div>
                      <div className="rounded-lg bg-[#1a120d] p-1 border border-black">
                        <span className="text-slate-400 block font-bold">Div 2-6</span>
                        <span className="font-mono font-black text-cyan-300">{gg.otherDivTitles} 🛡️</span>
                      </div>
                      <div className="rounded-lg bg-[#1a120d] p-1 border border-black">
                        <span className="text-purple-300 block font-bold">The Idols</span>
                        <span className="font-mono font-black text-purple-300">{gg.theIdolsTitles} ⚡</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
