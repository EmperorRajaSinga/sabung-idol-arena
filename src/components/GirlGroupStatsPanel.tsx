import React, { useState } from 'react';
import {
  Idol,
  GirlGroup,
  TournamentArchive,
  ArchivedMatch,
  LeagueSeasonArchive,
  LeagueSeasonState,
  TheIdolsSeasonArchive,
  TheIdolsSeasonState,
} from '../types';
import { Users, Crown, Trophy, Search, ChevronDown, ChevronUp, Award, Swords, Shield, Sparkles, Star, Table } from 'lucide-react';
import { calculateUnifiedTotalTitles } from '../utils/databaseStudioLogic';

interface GirlGroupStatsPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  archives: TournamentArchive[];
  matchDatabase: ArchivedMatch[];
  leagueArchives?: LeagueSeasonArchive[];
  leagueState?: LeagueSeasonState | null;
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
}

export interface GirlGroupStat {
  groupName: string;
  totalMembers: number;
  championships: number;
  seasonWinners: Array<{
    seasonId: number;
    seasonName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  leagueCupTitles: number;
  leagueCupWinners: Array<{
    seasonNumber: number;
    leagueId: number;
    leagueName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  theIdolsLeagueTitles: number;
  theIdolsLeagueWinners: Array<{
    seasonNumber: number;
    seasonName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  theIdolsPlayoffTitles: number;
  theIdolsPlayoffWinners: Array<{
    seasonNumber: number;
    seasonName: string;
    championId: string;
    championName: string;
    championPhoto?: string;
  }>;
  totalMatches: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  winRate: number;
  gameDiff: number;
  members: Array<{
    id: string;
    name: string;
    photoUrl: string;
    championships: number;
    leagueCupTitles: number;
    theIdolsLeagueTitles: number;
    theIdolsPlayoffTitles: number;
    matches: number;
    wins: number;
    draw...[truncated]