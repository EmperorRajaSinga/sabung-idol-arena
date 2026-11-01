import React, { useState, useMemo } from 'react';
import {
  ArchivedMatch,
  LeagueSeasonState,
  LeagueSeasonArchive,
  Idol,
  LeagueMatch,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
} from '../types';
import {
  Table,
  Search,
  Filter,
  Trophy,
  Swords,
  Shield,
  Calendar,
  CheckCircle2,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
  Star,
} from 'lucide-react';
import { getCountryFlag } from '../utils/nationalityHelper';
import { exportMatchDatabaseToJSON, exportMatchDatabaseToCSV } from '../utils/storage';
import { getMatchChronologicalWeight, compareMatchesNewestFirst } from '../utils/leagueLogic';

interface MatchDatabasePanelProps {
  matchDatabase: ArchivedMatch[];
  leagueState?: LeagueSeasonState | null;
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  idols?: Idol[];
}

export interface NormalizedMatch {
  id: string;
  type: 'Tournament Cup' | 'League Division' | 'The Idols Superleague';
  seasonId: number;
  seasonName: string;
  stageOrDivision: string;
  color: string;
  idolAId: string;
  idolAName: string;
  idolAGroup: string;
  idolAPhoto?: string;
  idolANationality?: string;
  idolBId: string;
  idolBName: string;
  idolBGroup: string;
  idolBPhoto?: string;
  idolBNationality?: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerName: string;
  isCompleted: boolean;
  isDraw: boolean;
  date?: string;
  chronologicalWeight: number;
}

export const MatchDatabasePanel: React.FC<MatchDatabasePanelProps> = ({
  matchDatabase,
  leagueState,
  leagueArchives = [],
  theIdolsState,
  theIdolsArchives = [],
  idols = [],
}) => {
  // Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TOURNAMENT' | 'LEAGUE' | 'THE_IDOLS'>('ALL');
  const [divisionFilter, setDivisionFilter] = useState<string>('ALL');
  const [seasonFilter, setSeasonFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<
    'NEWEST_FIRST' | 'OLDEST_FIRST' | 'HIGHEST_SCORE' | 'BIGGEST_MARGIN'
  >('NEWEST_FIRST');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  const dynamicDivisionMeta = useMemo(() => {
    const meta: Record<number, { name: string; color: string }> = {
      1: { name: leagueState?.leagues?.find((l) => l.id === 1)?.name || 'Division 1: Premier League', color: '#eab308' },
      2: { name: leagueState?.leagues?.find((l) => l.id === 2)?.name || 'Division 2: Championship', color: '#6366f1' },
      3: { name: leagueState?.leagues?.find((l) => l.id === 3)?.name || 'Division 3: League One', color: '#06b6d4' },
      4: { name: leagueState?.leagues?.find((l) => l.id === 4)?.name || 'Division 4: League Two', color: '#10b981' },
      5: { name: leagueState?.leagues?.find((l) => l.id === 5)?.name || 'Division 5: National League', color: '#f97316' },
      6: { name: leagueState?.leagues?.find((l) => l.id === 6)?.name || 'Division 6: Regional League', color: '#ec4899' },
    };
    return meta;
  }, [leagueState]);

  // Robust division/stage filter matcher that respects custom league branding and aliases
  const doesMatchDivisionOrStage = (stageOrDivision: string, filterValue: string): boolean => {
    if (filterValue === 'ALL') return true;
    const s = String(stageOrDivision || '').toLowerCase();
    const f = filterValue.toLowerCase();

    if (f === 'div_1' || f === 'division 1' || f.includes('premier')) {
      const customName1 = (leagueState?.leagues?.find((l) => l.id === 1)?.name || '').toLowerCase();
      return s.includes('div 1') || s.includes('division 1') || s.includes('premier') || s.includes('div1') || (!!customName1 && s.includes(customName1));
    }
    if (f === 'div_2' || f === 'division 2' || f.includes('championship')) {
      const customName2 = (leagueState?.leagues?.find((l) => l.id === 2)?.name || '').toLowerCase();
      return s.includes('div 2') || s.includes('division 2') || s.includes('championship') || s.includes('div2') || (!!customName2 && s.includes(customName2));
    }
    if (f === 'div_3' || f === 'division 3' || f.includes('league one')) {
      const customName3 = (leagueState?.leagues?.find((l) => l.id === 3)?.name || '').toLowerCase();
      return s.includes('div 3') || s.includes('division 3') || s.includes('league one') || s.includes('div3') || (!!customName3 && s.includes(customName3));
    }
    if (f === 'div_4' || f === 'division 4' || f.includes('league two')) {
      const customName4 = (leagueState?.leagues?.find((l) => l.id === 4)?.name || '').toLowerCase();
      return s.includes('div 4') || s.includes('division 4') || s.includes('league two') || s.includes('div4') || (!!customName4 && s.includes(customName4));
    }
    if (f === 'div_5' || f === 'division 5' || f.includes('national')) {
      const customName5 = (leagueState?.leagues?.find((l) => l.id === 5)?.name || '').toLowerCase();
      return s.includes('div 5') || s.includes('division 5') || s.includes('national') || s.includes('div5') || (!!customName5 && s.includes(customName5));
    }
    if (f === 'div_6' || f === 'division 6' || f.includes('regional')) {
      const customName6 = (leagueState?.leagues?.find((l) => l.id === 6)?.name || '').toLowerCase();
      return s.includes('div 6') || s.includes('division 6') || s.includes('regional') || s.includes('div6') || (!!customName6 && s.includes(customName6));
    }
    if (f === 'wildcard') {
      return s.includes('wildcard') || s.includes('play-in') || s.includes('play in');
    }
    if (f === 'swiss' || f === 'swiss play-in') {
      return s.includes('swiss');
    }
    if (f.startsWith('pool ')) {
      return s.includes(f);
    }
    if (f === 'last chance' || f === 'last_chance') {
      return s.includes('last chance') || s.includes('decider');
    }
    if (f === 'superleague') {
      return s.includes('superleague') || (s.includes('the idols') && !s.includes('playoff'));
    }
    if (f === 'masters playoff' || f === 'playoff') {
      return s.includes('playoff') || s.includes('masters');
    }
    if (f === 'group stage') {
      return s.includes('group stage') || (s.includes('group') && !s.includes('girl group') && !s.includes('division') && !s.includes('league'));
    }
    if (f === 'knockout') {
      return s.includes('round of 16') || s.includes('quarter') || s.includes('semi') || s.includes('final') || s.includes('3rd place');
    }
    return s.includes(f);
  };

  // Build the complete combined and normalized match list
  const combinedMatchesList = useMemo(() => {
    const list: NormalizedMatch[] = [];
    const seenMatchIds = new Set<string>();

    // 1. Process all entries from matchDatabase (which contains tournament matches and completed league syncs)
    (matchDatabase || []).forEach((m, idx) => {
      if (!m) return;
      const sId = Number(m.seasonId) || 1;
      const idolAId = typeof m.idolAId === 'string' ? m.idolAId : '';
      const idolBId = typeof m.idolBId === 'string' ? m.idolBId : '';
      const stageText = typeof m.stage === 'string' ? m.stage : '';
      const groupText = typeof m.groupName === 'string' ? m.groupName : '';
      const sourceMatchId = typeof m.matchId === 'string' ? m.matchId : '';
      const idolA = idolsMap.get(idolAId);
      const idolB = idolsMap.get(idolBId);

      const stageLower = stageText.toLowerCase();
      const isTheIdols =
        Boolean(stageLower.includes('the idols') || stageLower.includes('superleague') || stageLower.includes('masters playoff')) ||
        Boolean(sourceMatchId.startsWith('ti_') || sourceMatchId.includes('the_idols'));

      const isLeague =
        !isTheIdols &&
        (Boolean(['league', 'wildcard', 'division', 'swiss', 'last chance', 'premier', 'championship'].some((term) => stageLower.includes(term))) ||
          Boolean(['league', 'wildcard', 'wm_', 'swiss', 'arch_l_'].some((term) => sourceMatchId.includes(term))) ||
          Boolean(['Division', 'Wildcard', 'League', 'Pool'].some((term) => groupText.includes(term))));

      const stageName = stageText || (groupText ? `Group ${groupText}` : isTheIdols ? 'Superleague Match' : isLeague ? 'League Match' : 'Tournament Match');
      const isCompleted = m.scoreA !== null && m.scoreB !== null && m.scoreA !== undefined && m.scoreB !== undefined;
      const isDraw = isCompleted && Number(m.scoreA) === Number(m.scoreB);
      const matchKey = sourceMatchId || `m_${sId}_${isTheIdols ? 'ti' : isLeague ? 'l' : 't'}_${idx}_${idolAId}_${idolBId}`;

      if (seenMatchIds.has(matchKey)) return;
      seenMatchIds.add(matchKey);

      // Determine color
      let color = '#6366f1';
      if (isTheIdols) {
        color = '#a855f7';
      } else if (isLeague) {
        if (stageName.includes('Division 1') || stageName.includes('Premier')) color = '#eab308';
        else if (stageName.includes('Division 2') || stageName.includes('Championship')) color = '#6366f1';
        else if (stageName.includes('Division 3') || stageName.includes('League One')) color = '#06b6d4';
        else if (stageName.includes('Division 4') || stageName.includes('League Two')) color = '#10b981';
        else if (stageName.includes('Division 5') || stageName.includes('National')) color = '#f97316';
        else if (stageName.includes('Division 6') || stageName.includes('Regional')) color = '#ec4899';
        else if (stageName.includes('Wildcard') || stageName.includes('Swiss')) color = '#a855f7';
      }

      list.push({
        id: matchKey,
        type: isTheIdols ? 'The Idols Superleague' : isLeague ? 'League Division' : 'Tournament Cup',
        seasonId: sId,
        seasonName: String(m.seasonName || `Season ${sId}`),
        stageOrDivision: stageName,
        color,
        idolAId,
        idolAName: String(m.idolAName || idolA?.name || 'Idol A'),
        idolAGroup: String(idolA?.girlGroup || (m as any).idolAGroup || 'Solo'),
        idolAPhoto: idolA?.photoUrl,
        idolANationality: idolA?.nationality,
        idolBId,
        idolBName: String(m.idolBName || idolB?.name || 'Idol B'),
        idolBGroup: String(idolB?.girlGroup || (m as any).idolBGroup || 'Solo'),
        idolBPhoto: idolB?.photoUrl,
        idolBNationality: idolB?.nationality,
        scoreA: m.scoreA !== undefined ? m.scoreA : null,
        scoreB: m.scoreB !== undefined ? m.scoreB : null,
        winnerName: isCompleted
          ? isDraw
            ? 'Draw'
            : String(m.winnerName || (m.winnerId === idolAId ? m.idolAName || idolA?.name : m.idolBName || idolB?.name) || 'Winner')
          : 'Pending',
        isCompleted,
        isDraw,
        date: m.date,
        chronologicalWeight: getMatchChronologicalWeight({
          seasonId: sId,
          seasonName: m.seasonName,
          stage: m.stage,
          stageOrDivision: stageName,
          type: isTheIdols ? 'The Idols Superleague' : isLeague ? 'League Division' : 'Tournament Cup',
        }),
      });
    });

    // 2. Active League Season Matches
    if (leagueState && Array.isArray(leagueState.leagues)) {
      const sNum = leagueState.seasonNumber || 1;
      const sName = leagueState.seasonName || `Season ${sNum}`;

      leagueState.leagues.forEach((l) => {
        const meta = dynamicDivisionMeta[l.id] || { name: l.name || `Division ${l.id}`, color: '#eab308' };
        (l.matches || []).forEach((m) => {
          const matchKey = m.id || `league_${l.id}_md${m.matchday}_${m.idolAId}_${m.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = idolsMap.get(m.idolAId);
          const idolB = idolsMap.get(m.idolBId);
          const isCompleted = Boolean(m.completed && m.scoreA !== null && m.scoreB !== null);
          const isDraw = isCompleted && m.scoreA === m.scoreB;
          const winnerIdol = m.winnerId ? idolsMap.get(m.winnerId) : null;
          const winnerName = isCompleted
            ? isDraw
              ? 'Draw'
              : winnerIdol?.name || (m.winnerId === m.idolAId ? idolA?.name : idolB?.name) || 'Winner'
            : 'Upcoming';

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `${l.name || meta.name} (MD ${m.matchday})`,
            color: l.color || meta.color,
            idolAId: m.idolAId,
            idolAName: idolA?.name || 'Idol A',
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: m.idolBId,
            idolBName: idolB?.name || 'Idol B',
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: m.scoreA !== undefined ? m.scoreA : null,
            scoreB: m.scoreB !== undefined ? m.scoreB : null,
            winnerName,
            isCompleted,
            isDraw,
            date: m.updatedAt || (isCompleted ? 'Completed' : 'Upcoming'),
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `${l.name || meta.name} (MD ${m.matchday})`,
              type: 'League Division',
            }),
          });
        });
      });

      // Active Wildcard Play-In Matches
      if (leagueState.wildcardPlayIn?.matches) {
        leagueState.wildcardPlayIn.matches.forEach((wm) => {
          const matchKey = wm.id || `wildcard_${sNum}_${wm.roundName}_${wm.idolAId}_${wm.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = wm.idolAId ? idolsMap.get(wm.idolAId) : null;
          const idolB = wm.idolBId ? idolsMap.get(wm.idolBId) : null;
          const isCompleted = Boolean(wm.completed && wm.scoreA !== null && wm.scoreB !== null);
          const winnerIdol = wm.winnerId ? idolsMap.get(wm.winnerId) : null;

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `Wildcard Play-In (${wm.roundName})`,
            color: '#a855f7',
            idolAId: wm.idolAId || '',
            idolAName: idolA?.name || (wm.idolAId ? `Idol ${wm.idolAId}` : 'TBD'),
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: wm.idolBId || '',
            idolBName: idolB?.name || (wm.idolBId ? `Idol ${wm.idolBId}` : 'TBD'),
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: wm.scoreA !== undefined ? wm.scoreA : null,
            scoreB: wm.scoreB !== undefined ? wm.scoreB : null,
            winnerName: isCompleted
              ? winnerIdol?.name || (wm.winnerId === wm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
              : 'Upcoming',
            isCompleted,
            isDraw: false,
            date: wm.updatedAt || (isCompleted ? 'Completed' : 'Upcoming'),
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `Wildcard Play-In (${wm.roundName})`,
              type: 'League Division',
            }),
          });
        });
      }

      // Active Swiss Play-In Matches
      if (leagueState.swissPlayIn?.matches) {
        leagueState.swissPlayIn.matches.forEach((sm) => {
          const matchKey = sm.id || `swiss_${sNum}_${sm.poolName}_${sm.roundName}_${sm.idolAId}_${sm.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = sm.idolAId ? idolsMap.get(sm.idolAId) : null;
          const idolB = sm.idolBId ? idolsMap.get(sm.idolBId) : null;
          const isCompleted = Boolean(sm.completed && sm.scoreA !== null && sm.scoreB !== null);
          const winnerIdol = sm.winnerId ? idolsMap.get(sm.winnerId) : null;

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `Swiss Play-In (${sm.poolName} - ${sm.roundName})`,
            color: '#8b5cf6',
            idolAId: sm.idolAId || '',
            idolAName: idolA?.name || (sm.idolAId ? `Idol ${sm.idolAId}` : 'TBD'),
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: sm.idolBId || '',
            idolBName: idolB?.name || (sm.idolBId ? `Idol ${sm.idolBId}` : 'TBD'),
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: sm.scoreA !== undefined ? sm.scoreA : null,
            scoreB: sm.scoreB !== undefined ? sm.scoreB : null,
            winnerName: isCompleted
              ? winnerIdol?.name || (sm.winnerId === sm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
              : 'Upcoming',
            isCompleted,
            isDraw: false,
            date: sm.updatedAt || (isCompleted ? 'Completed' : 'Upcoming'),
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `Swiss Play-In (${sm.poolName} - ${sm.roundName})`,
              type: 'League Division',
            }),
          });
        });
      }

      // Active Swiss Last Chance Matches
      if (leagueState.swissPlayIn?.lastChanceMatches) {
        leagueState.swissPlayIn.lastChanceMatches.forEach((lcm) => {
          const matchKey = lcm.id || `swiss_lc_${sNum}_${lcm.roundName}_${lcm.idolAId}_${lcm.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = lcm.idolAId ? idolsMap.get(lcm.idolAId) : null;
          const idolB = lcm.idolBId ? idolsMap.get(lcm.idolBId) : null;
          const isCompleted = Boolean(lcm.completed && lcm.scoreA !== null && lcm.scoreB !== null);
          const winnerIdol = lcm.winnerId ? idolsMap.get(lcm.winnerId) : null;

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `Last Chance Decider (${lcm.roundName})`,
            color: '#f59e0b',
            idolAId: lcm.idolAId || '',
            idolAName: idolA?.name || (lcm.idolAId ? `Idol ${lcm.idolAId}` : 'TBD'),
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: lcm.idolBId || '',
            idolBName: idolB?.name || (lcm.idolBId ? `Idol ${lcm.idolBId}` : 'TBD'),
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: lcm.scoreA !== undefined ? lcm.scoreA : null,
            scoreB: lcm.scoreB !== undefined ? lcm.scoreB : null,
            winnerName: isCompleted
              ? winnerIdol?.name || (lcm.winnerId === lcm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
              : 'Upcoming',
            isCompleted,
            isDraw: false,
            date: lcm.updatedAt || (isCompleted ? 'Completed' : 'Upcoming'),
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `Last Chance Decider (${lcm.roundName})`,
              type: 'League Division',
            }),
          });
        });
      }
    }

    // 3. Past Archived League Seasons Matches
    (leagueArchives || []).forEach((arch) => {
      if (!arch) return;
      const sNum = arch.seasonNumber || 1;
      const sName = arch.seasonName || `Season ${sNum}`;

      (arch.allMatches || []).forEach((m) => {
        const meta = dynamicDivisionMeta[m.leagueId] || { name: `Division ${m.leagueId}`, color: '#eab308' };
        const matchKey = m.id || `arch_l_${sNum}_${m.leagueId}_${m.matchday}_${m.idolAId}_${m.idolBId}`;
        if (seenMatchIds.has(matchKey)) return;
        seenMatchIds.add(matchKey);

        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);
        const isCompleted = Boolean(m.completed && m.scoreA !== null && m.scoreB !== null);
        const isDraw = isCompleted && m.scoreA === m.scoreB;
        const winnerIdol = m.winnerId ? idolsMap.get(m.winnerId) : null;
        const winnerName = isCompleted
          ? isDraw
            ? 'Draw'
            : winnerIdol?.name || (m.winnerId === m.idolAId ? idolA?.name : idolB?.name) || 'Winner'
          : 'Archived Match';

        list.push({
          id: matchKey,
          type: 'League Division',
          seasonId: sNum,
          seasonName: sName,
          stageOrDivision: `${meta.name} (MD ${m.matchday})`,
          color: meta.color,
          idolAId: m.idolAId,
          idolAName: idolA?.name || 'Idol A',
          idolAGroup: idolA?.girlGroup || 'Solo',
          idolAPhoto: idolA?.photoUrl,
          idolANationality: idolA?.nationality,
          idolBId: m.idolBId,
          idolBName: idolB?.name || 'Idol B',
          idolBGroup: idolB?.girlGroup || 'Solo',
          idolBPhoto: idolB?.photoUrl,
          idolBNationality: idolB?.nationality,
          scoreA: m.scoreA !== undefined ? m.scoreA : null,
          scoreB: m.scoreB !== undefined ? m.scoreB : null,
          winnerName,
          isCompleted,
          isDraw,
          date: m.updatedAt || arch.completedAt || 'Archived',
          chronologicalWeight: getMatchChronologicalWeight({
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `${meta.name} (MD ${m.matchday})`,
            type: 'League Division',
          }),
        });
      });

      if (arch.wildcardPlayIn?.matches) {
        arch.wildcardPlayIn.matches.forEach((wm) => {
          const matchKey = wm.id || `arch_wildcard_${sNum}_${wm.roundName}_${wm.idolAId}_${wm.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = wm.idolAId ? idolsMap.get(wm.idolAId) : null;
          const idolB = wm.idolBId ? idolsMap.get(wm.idolBId) : null;
          const isCompleted = Boolean(wm.completed && wm.scoreA !== null && wm.scoreB !== null);
          const winnerIdol = wm.winnerId ? idolsMap.get(wm.winnerId) : null;

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `Wildcard Play-In (${wm.roundName})`,
            color: '#a855f7',
            idolAId: wm.idolAId || '',
            idolAName: idolA?.name || (wm.idolAId ? `Idol ${wm.idolAId}` : 'TBD'),
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: wm.idolBId || '',
            idolBName: idolB?.name || (wm.idolBId ? `Idol ${wm.idolBId}` : 'TBD'),
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: wm.scoreA !== undefined ? wm.scoreA : null,
            scoreB: wm.scoreB !== undefined ? wm.scoreB : null,
            winnerName: isCompleted
              ? winnerIdol?.name || (wm.winnerId === wm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
              : 'Archived Match',
            isCompleted,
            isDraw: false,
            date: wm.updatedAt || arch.completedAt || 'Archived',
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `Wildcard Play-In (${wm.roundName})`,
              type: 'League Division',
            }),
          });
        });
      }

      if (arch.swissPlayIn?.matches) {
        arch.swissPlayIn.matches.forEach((sm) => {
          const matchKey = sm.id || `arch_swiss_${sNum}_${sm.poolName}_${sm.roundName}_${sm.idolAId}_${sm.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = sm.idolAId ? idolsMap.get(sm.idolAId) : null;
          const idolB = sm.idolBId ? idolsMap.get(sm.idolBId) : null;
          const isCompleted = Boolean(sm.completed && sm.scoreA !== null && sm.scoreB !== null);
          const winnerIdol = sm.winnerId ? idolsMap.get(sm.winnerId) : null;

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `Swiss Play-In (${sm.poolName} - ${sm.roundName})`,
            color: '#8b5cf6',
            idolAId: sm.idolAId || '',
            idolAName: idolA?.name || (sm.idolAId ? `Idol ${sm.idolAId}` : 'TBD'),
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: sm.idolBId || '',
            idolBName: idolB?.name || (sm.idolBId ? `Idol ${sm.idolBId}` : 'TBD'),
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: sm.scoreA !== undefined ? sm.scoreA : null,
            scoreB: sm.scoreB !== undefined ? sm.scoreB : null,
            winnerName: isCompleted
              ? winnerIdol?.name || (sm.winnerId === sm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
              : 'Archived Match',
            isCompleted,
            isDraw: false,
            date: sm.updatedAt || arch.completedAt || 'Archived',
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `Swiss Play-In (${sm.poolName} - ${sm.roundName})`,
              type: 'League Division',
            }),
          });
        });
      }

      if (arch.swissPlayIn?.lastChanceMatches) {
        arch.swissPlayIn.lastChanceMatches.forEach((lcm) => {
          const matchKey = lcm.id || `arch_swiss_lc_${sNum}_${lcm.roundName}_${lcm.idolAId}_${lcm.idolBId}`;
          if (seenMatchIds.has(matchKey)) return;
          seenMatchIds.add(matchKey);

          const idolA = lcm.idolAId ? idolsMap.get(lcm.idolAId) : null;
          const idolB = lcm.idolBId ? idolsMap.get(lcm.idolBId) : null;
          const isCompleted = Boolean(lcm.completed && lcm.scoreA !== null && lcm.scoreB !== null);
          const winnerIdol = lcm.winnerId ? idolsMap.get(lcm.winnerId) : null;

          list.push({
            id: matchKey,
            type: 'League Division',
            seasonId: sNum,
            seasonName: sName,
            stageOrDivision: `Last Chance Decider (${lcm.roundName})`,
            color: '#f59e0b',
            idolAId: lcm.idolAId || '',
            idolAName: idolA?.name || (lcm.idolAId ? `Idol ${lcm.idolAId}` : 'TBD'),
            idolAGroup: idolA?.girlGroup || 'Solo',
            idolAPhoto: idolA?.photoUrl,
            idolANationality: idolA?.nationality,
            idolBId: lcm.idolBId || '',
            idolBName: idolB?.name || (lcm.idolBId ? `Idol ${lcm.idolBId}` : 'TBD'),
            idolBGroup: idolB?.girlGroup || 'Solo',
            idolBPhoto: idolB?.photoUrl,
            idolBNationality: idolB?.nationality,
            scoreA: lcm.scoreA !== undefined ? lcm.scoreA : null,
            scoreB: lcm.scoreB !== undefined ? lcm.scoreB : null,
            winnerName: isCompleted
              ? winnerIdol?.name || (lcm.winnerId === lcm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
              : 'Archived Match',
            isCompleted,
            isDraw: false,
            date: lcm.updatedAt || arch.completedAt || 'Archived',
            chronologicalWeight: getMatchChronologicalWeight({
              seasonId: sNum,
              seasonName: sName,
              stageOrDivision: `Last Chance Decider (${lcm.roundName})`,
              type: 'League Division',
            }),
          });
        });
      }
    });

    // 4. The Idols Active Season Matches
    if (theIdolsState && Array.isArray(theIdolsState.matches)) {
      const sNum = theIdolsState.seasonNumber || 1;
      const sName = theIdolsState.seasonName || `The Idols Season ${sNum}`;

      theIdolsState.matches.forEach((m) => {
        const matchKey = m.id || `ti_${sNum}_md${m.matchday}_${m.idolAId}_${m.idolBId}`;
        if (seenMatchIds.has(matchKey)) return;
        seenMatchIds.add(matchKey);

        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);
        const isCompleted = Boolean(m.completed && m.scoreA !== null && m.scoreB !== null);
        const isDraw = isCompleted && m.scoreA === m.scoreB;
        const winnerIdol = m.winnerId ? idolsMap.get(m.winnerId) : null;
        const winnerName = isCompleted
          ? isDraw
            ? 'Draw'
            : winnerIdol?.name || (m.winnerId === m.idolAId ? idolA?.name : idolB?.name) || 'Winner'
          : 'Upcoming';

        list.push({
          id: matchKey,
          type: 'The Idols Superleague',
          seasonId: sNum,
          seasonName: sName,
          stageOrDivision: `Superleague (MD ${m.matchday})`,
          color: '#a855f7',
          idolAId: m.idolAId,
          idolAName: idolA?.name || 'Idol A',
          idolAGroup: idolA?.girlGroup || 'Solo',
          idolAPhoto: idolA?.photoUrl,
          idolANationality: idolA?.nationality,
          idolBId: m.idolBId,
          idolBName: idolB?.name || 'Idol B',
          idolBGroup: idolB?.girlGroup || 'Solo',
          idolBPhoto: idolB?.photoUrl,
          idolBNationality: idolB?.nationality,
          scoreA: m.scoreA !== undefined ? m.scoreA : null,
          scoreB: m.scoreB !== undefined ? m.scoreB : null,
          winnerName,
          isCompleted,
          isDraw,
          date: m.updatedAt || (isCompleted ? 'Completed' : 'Upcoming'),
          chronologicalWeight: 900000 + sNum * 1000 + m.matchday,
        });
      });

      // Playoff Matches
      (theIdolsState.playoffMatches || []).forEach((pm) => {
        const matchKey = pm.id || `ti_po_${sNum}_${pm.roundCode}_${pm.idolAId}_${pm.idolBId}`;
        if (seenMatchIds.has(matchKey)) return;
        seenMatchIds.add(matchKey);

        const idolA = pm.idolAId ? idolsMap.get(pm.idolAId) : null;
        const idolB = pm.idolBId ? idolsMap.get(pm.idolBId) : null;
        const isCompleted = Boolean(pm.completed && pm.winnerId);
        const winnerIdol = pm.winnerId ? idolsMap.get(pm.winnerId) : null;

        list.push({
          id: matchKey,
          type: 'The Idols Superleague',
          seasonId: sNum,
          seasonName: sName,
          stageOrDivision: `Masters Playoff (${pm.roundName})`,
          color: '#ec4899',
          idolAId: pm.idolAId || '',
          idolAName: idolA?.name || (pm.idolAId ? `Idol ${pm.idolAId}` : 'TBD'),
          idolAGroup: idolA?.girlGroup || 'Solo',
          idolAPhoto: idolA?.photoUrl,
          idolANationality: idolA?.nationality,
          idolBId: pm.idolBId || '',
          idolBName: idolB?.name || (pm.idolBId ? `Idol ${pm.idolBId}` : 'TBD'),
          idolBGroup: idolB?.girlGroup || 'Solo',
          idolBPhoto: idolB?.photoUrl,
          idolBNationality: idolB?.nationality,
          scoreA: pm.scoreA !== undefined ? pm.scoreA : null,
          scoreB: pm.scoreB !== undefined ? pm.scoreB : null,
          winnerName: isCompleted
            ? winnerIdol?.name || (pm.winnerId === pm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
            : 'Upcoming',
          isCompleted,
          isDraw: false,
          date: pm.updatedAt || (isCompleted ? 'Completed' : 'Upcoming'),
          chronologicalWeight: 950000 + sNum * 1000 + pm.matchNumber,
        });
      });
    }

    // 5. The Idols Archived Seasons Matches
    (theIdolsArchives || []).forEach((arch) => {
      if (!arch) return;
      const sNum = arch.seasonNumber || 1;
      const sName = arch.seasonName || `The Idols Season ${sNum}`;

      (arch.matches || []).forEach((m) => {
        const matchKey = m.id || `arch_ti_${sNum}_md${m.matchday}_${m.idolAId}_${m.idolBId}`;
        if (seenMatchIds.has(matchKey)) return;
        seenMatchIds.add(matchKey);

        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);
        const isCompleted = Boolean(m.completed && m.scoreA !== null && m.scoreB !== null);
        const isDraw = isCompleted && m.scoreA === m.scoreB;
        const winnerIdol = m.winnerId ? idolsMap.get(m.winnerId) : null;
        const winnerName = isCompleted
          ? isDraw
            ? 'Draw'
            : winnerIdol?.name || (m.winnerId === m.idolAId ? idolA?.name : idolB?.name) || 'Winner'
          : 'Archived Match';

        list.push({
          id: matchKey,
          type: 'The Idols Superleague',
          seasonId: sNum,
          seasonName: sName,
          stageOrDivision: `Superleague (MD ${m.matchday})`,
          color: '#a855f7',
          idolAId: m.idolAId,
          idolAName: idolA?.name || 'Idol A',
          idolAGroup: idolA?.girlGroup || 'Solo',
          idolAPhoto: idolA?.photoUrl,
          idolANationality: idolA?.nationality,
          idolBId: m.idolBId,
          idolBName: idolB?.name || 'Idol B',
          idolBGroup: idolB?.girlGroup || 'Solo',
          idolBPhoto: idolB?.photoUrl,
          idolBNationality: idolB?.nationality,
          scoreA: m.scoreA !== undefined ? m.scoreA : null,
          scoreB: m.scoreB !== undefined ? m.scoreB : null,
          winnerName,
          isCompleted,
          isDraw,
          date: m.updatedAt || arch.completedAt || 'Archived',
          chronologicalWeight: 900000 + sNum * 1000 + m.matchday,
        });
      });

      (arch.playoffMatches || []).forEach((pm) => {
        const matchKey = pm.id || `arch_ti_po_${sNum}_${pm.roundCode}_${pm.idolAId}_${pm.idolBId}`;
        if (seenMatchIds.has(matchKey)) return;
        seenMatchIds.add(matchKey);

        const idolA = pm.idolAId ? idolsMap.get(pm.idolAId) : null;
        const idolB = pm.idolBId ? idolsMap.get(pm.idolBId) : null;
        const isCompleted = Boolean(pm.completed && pm.winnerId);
        const winnerIdol = pm.winnerId ? idolsMap.get(pm.winnerId) : null;

        list.push({
          id: matchKey,
          type: 'The Idols Superleague',
          seasonId: sNum,
          seasonName: sName,
          stageOrDivision: `Masters Playoff (${pm.roundName})`,
          color: '#ec4899',
          idolAId: pm.idolAId || '',
          idolAName: idolA?.name || (pm.idolAId ? `Idol ${pm.idolAId}` : 'TBD'),
          idolAGroup: idolA?.girlGroup || 'Solo',
          idolAPhoto: idolA?.photoUrl,
          idolANationality: idolA?.nationality,
          idolBId: pm.idolBId || '',
          idolBName: idolB?.name || (pm.idolBId ? `Idol ${pm.idolBId}` : 'TBD'),
          idolBGroup: idolB?.girlGroup || 'Solo',
          idolBPhoto: idolB?.photoUrl,
          idolBNationality: idolB?.nationality,
          scoreA: pm.scoreA !== undefined ? pm.scoreA : null,
          scoreB: pm.scoreB !== undefined ? pm.scoreB : null,
          winnerName: isCompleted
            ? winnerIdol?.name || (pm.winnerId === pm.idolAId ? idolA?.name : idolB?.name) || 'Winner'
            : 'Archived Match',
          isCompleted,
          isDraw: false,
          date: pm.updatedAt || arch.completedAt || 'Archived',
          chronologicalWeight: 950000 + sNum * 1000 + pm.matchNumber,
        });
      });
    });

    return list;
  }, [matchDatabase, leagueState, leagueArchives, theIdolsState, theIdolsArchives, idolsMap]);

  // Extract all distinct seasons
  const seasons = useMemo(() => {
    const set = new Set<number>();
    combinedMatchesList.forEach((m) => {
      if (m.seasonId) set.add(m.seasonId);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [combinedMatchesList]);

  // Apply Search, Filters, and Sorting
  const filteredAndSortedMatches = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = combinedMatchesList.filter((m) => {
      const matchSearch =
        !q ||
        String(m.idolAName || '').toLowerCase().includes(q) ||
        String(m.idolBName || '').toLowerCase().includes(q) ||
        String(m.idolAGroup || '').toLowerCase().includes(q) ||
        String(m.idolBGroup || '').toLowerCase().includes(q) ||
        String(m.winnerName || '').toLowerCase().includes(q) ||
        String(m.stageOrDivision || '').toLowerCase().includes(q) ||
        String(m.seasonName || '').toLowerCase().includes(q);

      const matchType =
        typeFilter === 'ALL' ||
        (typeFilter === 'TOURNAMENT' && m.type === 'Tournament Cup') ||
        (typeFilter === 'LEAGUE' && m.type === 'League Division') ||
        (typeFilter === 'THE_IDOLS' && m.type === 'The Idols Superleague');

      const matchDivision =
        divisionFilter === 'ALL' ||
        doesMatchDivisionOrStage(m.stageOrDivision, divisionFilter);

      const matchSeason =
        seasonFilter === 'ALL' || m.seasonId === Number(seasonFilter);

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && m.isCompleted) ||
        (statusFilter === 'PENDING' && !m.isCompleted);

      return matchSearch && matchType && matchDivision && matchSeason && matchStatus;
    });

    // Sorting
    return filtered.sort((a, b) => {
      if (sortOrder === 'NEWEST_FIRST') {
        return compareMatchesNewestFirst(a, b);
      }
      if (sortOrder === 'OLDEST_FIRST') {
        return compareMatchesNewestFirst(b, a);
      }
      if (sortOrder === 'HIGHEST_SCORE') {
        const totalA = (a.scoreA ?? 0) + (a.scoreB ?? 0);
        const totalB = (b.scoreA ?? 0) + (b.scoreB ?? 0);
        return totalB - totalA;
      }
      if (sortOrder === 'BIGGEST_MARGIN') {
        const diffA = Math.abs((a.scoreA ?? 0) - (a.scoreB ?? 0));
        const diffB = Math.abs((b.scoreA ?? 0) - (b.scoreB ?? 0));
        return diffB - diffA;
      }
      return 0;
    });
  }, [
    combinedMatchesList,
    search,
    typeFilter,
    divisionFilter,
    seasonFilter,
    statusFilter,
    sortOrder,
  ]);

  // Reset to page 1 whenever filters or rows per page change
  const totalMatches = filteredAndSortedMatches.length;
  const totalPages = rowsPerPage === 0 ? 1 : Math.ceil(totalMatches / rowsPerPage) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const paginatedMatches = useMemo(() => {
    if (rowsPerPage === 0) return filteredAndSortedMatches; // "All"
    const start = (safePage - 1) * rowsPerPage;
    return filteredAndSortedMatches.slice(start, start + rowsPerPage);
  }, [filteredAndSortedMatches, safePage, rowsPerPage]);

  const completedCount = useMemo(() => {
    return combinedMatchesList.filter((m) => m.isCompleted).length;
  }, [combinedMatchesList]);

  const tournamentCount = useMemo(() => {
    return combinedMatchesList.filter((m) => m.type === 'Tournament Cup').length;
  }, [combinedMatchesList]);

  const leagueCount = useMemo(() => {
    return combinedMatchesList.filter((m) => m.type === 'League Division').length;
  }, [combinedMatchesList]);

  const theIdolsCount = useMemo(() => {
    return combinedMatchesList.filter((m) => m.type === 'The Idols Superleague').length;
  }, [combinedMatchesList]);

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setDivisionFilter('ALL');
    setSeasonFilter('ALL');
    setStatusFilter('ALL');
    setSortOrder('NEWEST_FIRST');
    setCurrentPage(1);
  };

  const startIndex = totalMatches === 0 ? 0 : (safePage - 1) * rowsPerPage + 1;
  const endIndex =
    rowsPerPage === 0 ? totalMatches : Math.min(safePage * rowsPerPage, totalMatches);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Table className="h-6 w-6 text-amber-400" />
            <span>All Matches Database</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Permanent unified repository of all match records across Tournament Cups and League Divisions. Sorted from newest to oldest by default.
          </p>
        </div>

        {/* Database Stats & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {completedCount} Completed / {combinedMatchesList.length} Total Matches
            </span>
          </div>

          <button
            onClick={() => exportMatchDatabaseToJSON(matchDatabase)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-indigo-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            title="Download Permanent Match Database (.json)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export DB (.json)</span>
          </button>
          <button
            onClick={() => exportMatchDatabaseToCSV(matchDatabase)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 hover:text-white text-xs font-bold transition-all shadow-sm"
            title="Download Permanent Match Database (.csv)"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export DB (.csv)</span>
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-3">
        {/* Quick Competition Scope Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setTypeFilter('ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              typeFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-black shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3" />
            <span>All Combined ({combinedMatchesList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTypeFilter('THE_IDOLS');
              setDivisionFilter('ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              typeFilter === 'THE_IDOLS'
                ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white font-black shadow'
                : 'text-purple-300/70 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>👑 Superleague ({theIdolsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTypeFilter('LEAGUE');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              typeFilter === 'LEAGUE'
                ? 'bg-teal-500 text-slate-950 font-black shadow'
                : 'text-teal-300/70 hover:text-white'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>🛡️ League ({leagueCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTypeFilter('TOURNAMENT');
              setDivisionFilter('ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              typeFilter === 'TOURNAMENT'
                ? 'bg-indigo-600 text-white font-black shadow'
                : 'text-indigo-300/70 hover:text-white'
            }`}
          >
            <Trophy className="w-3 h-3" />
            <span>🏆 Tournament ({tournamentCount})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search idol, girl group, stage..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Competition Format Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'ALL' | 'TOURNAMENT' | 'LEAGUE' | 'THE_IDOLS');
              if (e.target.value === 'TOURNAMENT' || e.target.value === 'THE_IDOLS') setDivisionFilter('ALL');
              setCurrentPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
          >
            <option value="ALL">All Competitions (Combined)</option>
            <option value="TOURNAMENT">🏆 Tournament Cup Only</option>
            <option value="LEAGUE">🛡️ League Divisions Only</option>
            <option value="THE_IDOLS">👑 The Idols Superleague</option>
          </select>

          {/* Division & Stage Filter */}
          <select
            value={divisionFilter}
            onChange={(e) => {
              setDivisionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
          >
            <option value="ALL">All Divisions &amp; Stages</option>
            <optgroup label="The Idols Superleague">
              <option value="Superleague">Superleague Regular Season</option>
              <option value="Masters Playoff">Masters Playoff Double Elim</option>
            </optgroup>
            <optgroup label="League Divisions">
              <option value="Division 1">{leagueState?.leagues?.find((l) => l.id === 1)?.name || 'Div 1: Premier League'}</option>
              <option value="Division 2">{leagueState?.leagues?.find((l) => l.id === 2)?.name || 'Div 2: Championship'}</option>
              <option value="Division 3">{leagueState?.leagues?.find((l) => l.id === 3)?.name || 'Div 3: League One'}</option>
              <option value="Division 4">{leagueState?.leagues?.find((l) => l.id === 4)?.name || 'Div 4: League Two'}</option>
              <option value="Division 5">{leagueState?.leagues?.find((l) => l.id === 5)?.name || 'Div 5: National League'}</option>
              <option value="Division 6">{leagueState?.leagues?.find((l) => l.id === 6)?.name || 'Div 6: Regional League'}</option>
              <option value="Wildcard">Wildcard Play-In</option>
              <option value="Swiss Play-In">Swiss Stage Play-In (All Pools)</option>
              <option value="Pool A">Swiss Pool A</option>
              <option value="Pool B">Swiss Pool B</option>
              <option value="Pool C">Swiss Pool C</option>
              <option value="Pool D">Swiss Pool D</option>
              <option value="Pool E">Swiss Pool E</option>
              <option value="Pool F">Swiss Pool F</option>
              <option value="Last Chance">Last Chance Deciders</option>
            </optgroup>
            <optgroup label="Tournament Cup">
              <option value="Group Stage">Group Stage</option>
              <option value="Round of 16">Round of 16</option>
              <option value="Quarter-Final">Quarter-Finals</option>
              <option value="Semi-Final">Semi-Finals</option>
              <option value="3rd Place">3rd Place Playoff</option>
              <option value="Final">Tournament Final</option>
            </optgroup>
          </select>

          {/* Season Filter */}
          <select
            value={seasonFilter}
            onChange={(e) => {
              setSeasonFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
          >
            <option value="ALL">All Seasons</option>
            {seasons.map((s) => (
              <option key={`s-opt-${s}`} value={s}>
                Season {s}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">✅ Completed Matches</option>
            <option value="PENDING">⏳ Upcoming / In Progress</option>
          </select>
        </div>

        {/* Secondary Filter & Sorting Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort Order Selector */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 font-bold">Sort by:</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(
                    e.target.value as
                      | 'NEWEST_FIRST'
                      | 'OLDEST_FIRST'
                      | 'HIGHEST_SCORE'
                      | 'BIGGEST_MARGIN'
                  );
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <option value="NEWEST_FIRST">🕒 Newest to Oldest (Default)</option>
                <option value="OLDEST_FIRST">🕒 Oldest to Newest</option>
                <option value="HIGHEST_SCORE">⚽ Highest Scoring</option>
                <option value="BIGGEST_MARGIN">🔥 Biggest Margin</option>
              </select>
            </div>

            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All ({totalMatches})</option>
              </select>
            </div>

            {(search ||
              typeFilter !== 'ALL' ||
              divisionFilter !== 'ALL' ||
              seasonFilter !== 'ALL' ||
              statusFilter !== 'ALL' ||
              sortOrder !== 'NEWEST_FIRST') && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-slate-400 font-bold">
            Showing <span className="text-white font-extrabold">{startIndex}</span>–
            <span className="text-white font-extrabold">{endIndex}</span> of{' '}
            <span className="text-amber-400 font-extrabold">{totalMatches}</span> matches
          </div>
        </div>
      </div>

      {/* Main Unified Match Database Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Season &amp; Format</th>
                <th className="px-4 py-3.5">Stage / Division</th>
                <th className="px-4 py-3.5 text-right">Home Idol</th>
                <th className="px-4 py-3.5 text-center">Score</th>
                <th className="px-4 py-3.5">Away Idol</th>
                <th className="px-4 py-3.5">Winner / Result</th>
                <th className="px-4 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
              {paginatedMatches.length > 0 ? (
                paginatedMatches.map((m, idx) => {
                  const isWinA = m.isCompleted && (m.scoreA ?? 0) > (m.scoreB ?? 0);
                  const isWinB = m.isCompleted && (m.scoreB ?? 0) > (m.scoreA ?? 0);
                  const isDraw = m.isDraw;

                  return (
                    <tr
                      key={m.id || `row-m-${idx}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Season & Format */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-white text-xs">{m.seasonName}</span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold w-max"
                            style={{
                              backgroundColor: `${m.color}20`,
                              color: m.color,
                              border: `1px solid ${m.color}40`,
                            }}
                          >
                            {m.type === 'The Idols Superleague' ? (
                              <Sparkles className="w-2.5 h-2.5" />
                            ) : m.type === 'Tournament Cup' ? (
                              <Trophy className="w-2.5 h-2.5" />
                            ) : (
                              <Shield className="w-2.5 h-2.5" />
                            )}
                            <span>{m.type}</span>
                          </span>
                        </div>
                      </td>

                      {/* Stage / Division */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-200">{m.stageOrDivision}</span>
                      </td>

                      {/* Home Idol */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 font-bold text-white">
                              {m.idolANationality && (
                                <span className="text-xs">{getCountryFlag(m.idolANationality)}</span>
                              )}
                              <span className={isWinA ? 'text-amber-300 font-black' : ''}>
                                {m.idolAName}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">{m.idolAGroup}</div>
                          </div>
                          {m.idolAPhoto ? (
                            <img
                              src={m.idolAPhoto}
                              alt={m.idolAName}
                              className="w-8 h-8 rounded-xl object-cover border border-slate-700 bg-slate-950"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                              {m.idolAName.slice(0, 2)}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {m.isCompleted && m.scoreA !== null && m.scoreB !== null ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 font-mono font-black text-sm">
                            <span
                              className={
                                isWinA
                                  ? 'text-emerald-400 text-base font-extrabold'
                                  : isDraw
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }
                            >
                              {m.scoreA}
                            </span>
                            <span className="text-slate-600">-</span>
                            <span
                              className={
                                isWinB
                                  ? 'text-emerald-400 text-base font-extrabold'
                                  : isDraw
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }
                            >
                              {m.scoreB}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[10px] font-bold">
                            VS
                          </span>
                        )}
                      </td>

                      {/* Away Idol */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {m.idolBPhoto ? (
                            <img
                              src={m.idolBPhoto}
                              alt={m.idolBName}
                              className="w-8 h-8 rounded-xl object-cover border border-slate-700 bg-slate-950"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                              {m.idolBName.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1 font-bold text-white">
                              <span className={isWinB ? 'text-amber-300 font-black' : ''}>
                                {m.idolBName}
                              </span>
                              {m.idolBNationality && (
                                <span className="text-xs">{getCountryFlag(m.idolBNationality)}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{m.idolBGroup}</div>
                          </div>
                        </div>
                      </td>

                      {/* Winner / Result */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {m.isCompleted ? (
                          isDraw ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 font-extrabold text-[11px]">
                              Draw
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-extrabold text-[11px] flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{m.winnerName}</span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-500 text-xs italic font-medium">
                            Pending Match
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            m.isCompleted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {m.isCompleted ? 'Completed' : 'Upcoming'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <Table className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-bold text-sm">No matches found matching your filters.</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset All Filters</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation Controls (Next Row / Prev Row Buttons) */}
        {rowsPerPage > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-950 border-t border-slate-800 text-xs">
            <div className="text-slate-400 font-semibold">
              Page <span className="text-white font-extrabold">{safePage}</span> of{' '}
              <span className="text-white font-extrabold">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5 self-center sm:self-auto flex-wrap">
              {/* Jump to First */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Previous Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  return Math.abs(p - safePage) <= 1;
                })
                .map((p, idx, arr) => {
                  const prevP = arr[idx - 1];
                  const hasGap = prevP && p - prevP > 1;

                  return (
                    <React.Fragment key={`p-btn-${p}`}>
                      {hasGap && <span className="px-1 text-slate-600">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          safePage === p
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                            : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none font-bold transition-all"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Jump to Last */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
