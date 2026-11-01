import React, { useState, useMemo, useEffect } from 'react';
import {
  Idol,
  GirlGroup,
  CareerStat,
  LeagueSeasonState,
  LeagueSeasonArchive,
  PersonalRankingEntry,
  TheIdolsSeasonState,
  TheIdolsSeasonArchive,
  ArchivedMatch,
} from '../types';
import { KahootPodium } from './KahootPodium';
import {
  computeCombinedTopRankings,
  loadPersonalRankings,
  savePersonalRankings,
  CombinedStatsRecord,
} from '../utils/leagueLogic';
import type { V5State, V5TitleArchive } from '../utils/v5/store';
import { exportPersonalRankingsToJSON } from '../utils/storage';
import { getCountryFlag } from '../utils/nationalityHelper';
import { RatingBadge } from './RatingBadge';
import {
  Crown,
  Trophy,
  Medal,
  Users,
  User,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit2,
  Check,
  X,
  Sparkles,
  Save,
  Star,
  Search,
  Music,
  RotateCcw,
  Download,
} from 'lucide-react';


type RankRecordWithV5 = CombinedStatsRecord & {
  v5Titles: number;
  divisionTwoTitles: number;
  v5CupTitles: number;
  promotions: number;
  relegations: number;
};

const makeEmptyRankRecord = (
  id: string,
  name: string,
  type: 'idol' | 'group',
  details: Partial<CombinedStatsRecord> = {}
): RankRecordWithV5 => ({
  id,
  name: name || 'Unknown',
  type,
  girlGroup: details.girlGroup || '',
  photoUrl: details.photoUrl || '',
  nationality: details.nationality,
  seed: details.seed,
  titles: 0,
  originalTitles: 0,
  leagueTitles: 0,
  theIdolsTitles: 0,
  v5Titles: 0,
  divisionTwoTitles: 0,
  v5CupTitles: 0,
  promotions: 0,
  relegations: 0,
  totalPoints: 0,
  matches: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winRate: 0,
  gameDiff: 0,
});

function mergeV5RankContributions(
  base: { topIdols: CombinedStatsRecord[]; topGroups: CombinedStatsRecord[] },
  idols: Idol[],
  girlGroups: GirlGroup[],
  matchDatabase: ArchivedMatch[],
  v5State: V5State | null | undefined,
  v5TitleArchives: V5TitleArchive[],
  leagueState: LeagueSeasonState | null,
  configuredSeasonNumber?: number,
  configuredSeasonName?: string
): { topIdols: RankRecordWithV5[]; topGroups: RankRecordWithV5[] } {
  const idolMap = new Map<string, Idol>((Array.isArray(idols) ? idols : []).filter(Boolean).map((idol) => [idol.id, idol] as [string, Idol]));
  const groupMeta = new Map<string, GirlGroup>((Array.isArray(girlGroups) ? girlGroups : []).filter(Boolean).map((group) => [group.name, group] as [string, GirlGroup]));
  const idolRecords = new Map<string, RankRecordWithV5>();
  const groupRecords = new Map<string, RankRecordWithV5>();

  (base.topIdols || []).forEach((record) => {
    idolRecords.set(record.id, {
      ...record,
      theIdolsTitles: record.theIdolsTitles || 0,
      v5Titles: 0,
      divisionTwoTitles: 0,
      v5CupTitles: 0,
      promotions: 0,
      relegations: 0,
    });
  });
  (base.topGroups || []).forEach((record) => {
    groupRecords.set(record.name, {
      ...record,
      theIdolsTitles: record.theIdolsTitles || 0,
      v5Titles: 0,
      divisionTwoTitles: 0,
      v5CupTitles: 0,
      promotions: 0,
      relegations: 0,
    });
  });

  const ensureIdol = (id: string, name?: string, groupName?: string, photo?: string) => {
    const existing = idolRecords.get(id);
    if (existing) return existing;
    const idol = idolMap.get(id);
    const record = makeEmptyRankRecord(id, idol?.name || name || 'Unknown Idol', 'idol', {
      girlGroup: idol?.girlGroup || groupName || '',
      photoUrl: idol?.photoUrl || photo || '',
      nationality: idol?.nationality || 'South Korea',
      seed: idol?.seed || 'Unseeded',
    });
    idolRecords.set(id, record);
    return record;
  };

  const ensureGroup = (name: string) => {
    const normalized = String(name || '').trim();
    if (!normalized || normalized.toLowerCase() === 'solo' || normalized.toLowerCase() === 'solo / independent') return null;
    const existing = groupRecords.get(normalized);
    if (existing) return existing;
    const meta = groupMeta.get(normalized);
    const record = makeEmptyRankRecord(meta?.id || normalized, normalized, 'group', {
      photoUrl: meta?.logoUrl || '',
    });
    groupRecords.set(normalized, record);
    return record;
  };

  const seenMatches = new Set<string>();
  (Array.isArray(matchDatabase) ? matchDatabase : []).forEach((match) => {
    if (!match || !String(match.stage || '').toLowerCase().startsWith('cups & divisions:')) return;
    if (!match.idolAId || !match.idolBId || match.scoreA == null || match.scoreB == null) return;
    const matchId = String(match.matchId || [
      match.seasonId, match.stage, match.idolAId, match.idolBId, match.scoreA, match.scoreB,
    ].join('|'));
    if (seenMatches.has(matchId)) return;
    seenMatches.add(matchId);

    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return;

    const sides = [
      { id: match.idolAId, name: match.idolAName, group: match.idolAGroup, photo: match.idolAPhoto, scored: scoreA, conceded: scoreB },
      { id: match.idolBId, name: match.idolBName, group: match.idolBGroup, photo: match.idolBPhoto, scored: scoreB, conceded: scoreA },
    ];

    sides.forEach((side) => {
      const idol = ensureIdol(side.id, side.name, side.group, side.photo);
      const groupName = side.group || idol.girlGroup || '';
      const group = ensureGroup(groupName);
      const won = side.scored > side.conceded;
      const drawn = side.scored === side.conceded;

      idol.matches += 1;
      idol.wins += won ? 1 : 0;
      idol.draws += drawn ? 1 : 0;
      idol.losses += !won && !drawn ? 1 : 0;
      idol.gameDiff += side.scored - side.conceded;
      idol.totalPoints += won ? 3 : drawn ? 1 : 0;

      if (group) {
        group.matches += 1;
        group.wins += won ? 1 : 0;
        group.draws += drawn ? 1 : 0;
        group.losses += !won && !drawn ? 1 : 0;
        group.gameDiff += side.scored - side.conceded;
        group.totalPoints += won ? 3 : drawn ? 1 : 0;
      }
    });
  });

  const titleMap = new Map<string, V5TitleArchive>();
  const competitionKey = (season: number, competition: string) =>
    String(season) + '::' + String(competition || '').trim().toLowerCase().replace(/\s+/g, ' ');

  (Array.isArray(v5TitleArchives) ? v5TitleArchives : []).forEach((title) => {
    if (!title || !title.winnerId || !title.competition) return;
    titleMap.set(competitionKey(Number(title.seasonNumber || 1), title.competition), title);
  });

  const v5Matches = (Array.isArray(matchDatabase) ? matchDatabase : []).filter((match) =>
    match && String(match.stage || '').toLowerCase().startsWith('cups & divisions:')
  );
  const latestV5MatchSeason = v5Matches.reduce((latest, match) =>
    Math.max(latest, Number(match.seasonId || 1)), 1
  );
  const currentSeasonNumber = Math.max(1, Number(configuredSeasonNumber || leagueState?.seasonNumber || latestV5MatchSeason || 1));
  const currentSeasonName = configuredSeasonName || leagueState?.seasonName || ('Season ' + currentSeasonNumber);

  const addLiveTitle = (
    competition: string,
    winnerId?: string | null,
    runnerUpId?: string | null,
    isDivision = false
  ) => {
    if (!winnerId) return;
    const key = competitionKey(currentSeasonNumber, competition);
    if (titleMap.has(key)) return;
    const winner = idolMap.get(winnerId);
    const runner = runnerUpId ? idolMap.get(runnerUpId) : undefined;
    titleMap.set(key, {
      id: 'live_v5_' + key,
      seasonNumber: currentSeasonNumber,
      seasonName: currentSeasonName,
      competition,
      winnerId,
      winnerName: winner?.name || 'Unknown Idol',
      winnerGroup: winner?.girlGroup || 'Solo',
      winnerPhoto: winner?.photoUrl,
      runnerUpId: runner?.id,
      runnerUpName: runner?.name,
      runnerUpGroup: runner?.girlGroup,
      runnerUpPhoto: runner?.photoUrl,
      isDivision,
      archivedAt: '',
    });
  };

  if (v5State) {
    (Array.isArray(v5State.d2) ? v5State.d2 : []).forEach((league) => {
      if (league?.isCompleted && league.championId) {
        const ranked = [...(league.standings || [])].sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999));
        addLiveTitle('Division 2 / ' + league.name, league.championId, ranked[1]?.idolId, true);
      }
    });

    const crownFinal = v5State.champsCup?.matches?.find((match) => match.id === 'cc_gf');
    if (crownFinal?.completed) addLiveTitle('League Champions Cup', crownFinal.winnerId, crownFinal.loserId);

    const openFinal = v5State.leagueCup?.rounds?.slice(-1)[0]?.find((match) => match.completed);
    if (v5State.leagueCup?.championId) {
      addLiveTitle('All-League Knockout Cup', v5State.leagueCup.championId, openFinal?.loserId);
    }

    Object.entries(v5State.miniCups || {}).forEach(([leagueId, matches]) => {
      const final = matches.find((match) => match.id === 'mc' + leagueId + '_final');
      if (final?.completed) addLiveTitle('Top 16 Mini Cup / League ' + leagueId, final.winnerId, final.loserId);
    });

    if (v5State.superA?.completed) addLiveTitle('Super Cup A', v5State.superA.winnerId, v5State.superA.loserId);
    (Array.isArray(v5State.superB) ? v5State.superB : []).forEach((match, index) => {
      if (match?.completed) addLiveTitle('Super Cup B ' + (index + 1), match.winnerId, match.loserId);
    });
  }

  titleMap.forEach((title) => {
    const winner = ensureIdol(title.winnerId, title.winnerName, title.winnerGroup, title.winnerPhoto);
    winner.titles += 1;
    winner.v5Titles += 1;
    if (title.isDivision) winner.divisionTwoTitles += 1;
    else winner.v5CupTitles += 1;
    winner.totalPoints += 15;

    const winnerGroup = ensureGroup(title.winnerGroup || winner.girlGroup || '');
    if (winnerGroup) {
      winnerGroup.titles += 1;
      winnerGroup.v5Titles += 1;
      if (title.isDivision) winnerGroup.divisionTwoTitles += 1;
      else winnerGroup.v5CupTitles += 1;
      winnerGroup.totalPoints += 15;
    }

    if (title.runnerUpId) {
      const runner = ensureIdol(title.runnerUpId, title.runnerUpName, title.runnerUpGroup, title.runnerUpPhoto);
      runner.totalPoints += 5;
      const runnerGroup = ensureGroup(title.runnerUpGroup || runner.girlGroup || '');
      if (runnerGroup) runnerGroup.totalPoints += 5;
    }
  });


  const seenMovements = new Set<string>();
  const addMovement = (
    idolId: string,
    movement: 'promotion' | 'relegation',
    seasonNumber: number,
    leagueId: number
  ) => {
    const key = String(seasonNumber) + '::' + String(leagueId) + '::' + movement + '::' + idolId;
    if (!idolId || seenMovements.has(key)) return;
    seenMovements.add(key);
    const idol = idolMap.get(idolId);
    const record = ensureIdol(idolId, idol?.name, idol?.girlGroup, idol?.photoUrl);
    const group = ensureGroup(idol?.girlGroup || '');
    if (movement === 'promotion') {
      record.promotions += 1;
      if (group) group.promotions += 1;
    } else {
      record.relegations += 1;
      if (group) group.relegations += 1;
    }
  };

  (Array.isArray(v5State?.promotionHistory) ? v5State.promotionHistory : []).forEach((history) => {
    (Array.isArray(history?.moves) ? history.moves : []).forEach((move) => {
      const season = Number(history.seasonNumber || 1);
      const leagueId = Number(move.leagueId || 0);
      (Array.isArray(move?.promoted) ? move.promoted : []).forEach((idolId) => addMovement(idolId, 'promotion', season, leagueId));
      (Array.isArray(move?.relegated) ? move.relegated : []).forEach((idolId) => addMovement(idolId, 'relegation', season, leagueId));
    });
  });

  const finalize = (records: RankRecordWithV5[]) => records.map((record) => ({
    ...record,
    winRate: record.matches > 0 ? Math.round((record.wins / record.matches) * 1000) / 10 : 0,
  })).sort((a, b) =>
    b.titles - a.titles ||
    b.totalPoints - a.totalPoints ||
    b.winRate - a.winRate ||
    b.wins - a.wins ||
    b.matches - a.matches ||
    a.name.localeCompare(b.name)
  );

  return {
    topIdols: finalize(Array.from(idolRecords.values())),
    topGroups: finalize(Array.from(groupRecords.values())),
  };
}

interface RankPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  careerStats: CareerStat[];
  leagueState: LeagueSeasonState | null;
  leagueArchives: LeagueSeasonArchive[];
  theIdolsState?: TheIdolsSeasonState | null;
  theIdolsArchives?: TheIdolsSeasonArchive[];
  matchDatabase?: ArchivedMatch[];
  v5State?: V5State | null;
  v5TitleArchives?: V5TitleArchive[];
  currentSeasonNumber?: number;
  currentSeasonName?: string;
}

export const RankPanel: React.FC<RankPanelProps> = ({
  idols,
  girlGroups,
  careerStats,
  leagueState,
  leagueArchives,
  theIdolsState,
  theIdolsArchives,
  matchDatabase = [],
  v5State,
  v5TitleArchives = [],
  currentSeasonNumber,
  currentSeasonName,
}) => {
  const [activeLeaderboard, setActiveLeaderboard] = useState<'idols' | 'groups'>('idols');

  // Official all-time ranking: original tournament, Division 1, The Idols, Division 2 and every V5 cup.
  const { topIdols, topGroups } = useMemo(() => {
    const base = computeCombinedTopRankings(
      idols,
      girlGroups,
      careerStats,
      leagueState,
      leagueArchives,
      theIdolsState || null,
      theIdolsArchives || []
    );
    return mergeV5RankContributions(
      base,
      idols,
      girlGroups,
      matchDatabase,
      v5State,
      v5TitleArchives,
      leagueState,
      currentSeasonNumber,
      currentSeasonName
    );
  }, [
    idols, girlGroups, careerStats, leagueState, leagueArchives,
    theIdolsState, theIdolsArchives, matchDatabase, v5State, v5TitleArchives,
    currentSeasonNumber, currentSeasonName,
  ]);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  // Personal Rankings State
  const [personalRankings, setPersonalRankings] = useState<PersonalRankingEntry[]>(() => {
    const saved = loadPersonalRankings();
    if (saved && saved.length > 0) return saved;
    // Default initial seed from the five highest-ranked official idols.
    return topIdols.slice(0, 5).map((idol, idx) => ({
      id: `pr_${idol.id}_${Date.now()}_${idx}`,
      idolId: idol.id,
      rank: idx + 1,
      tier: idx === 0 ? 'S+' : idx < 3 ? 'S' : 'A',
      customRating: 95 - idx * 3,
      notes: idx === 0 ? 'My Ultimate Bias' : 'All-time favorite vocalist',
      favoriteSong: 'Debut Single',
      updatedAt: Date.now(),
    }));
  });

  // Modal / Form state for adding/editing personal ranking
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedAddIdolId, setSelectedAddIdolId] = useState<string>(idols[0]?.id || '');
  const [addTier, setAddTier] = useState<'S+' | 'S' | 'A' | 'B' | 'C' | 'D'>('S');
  const [addRating, setAddRating] = useState<number>(90);
  const [addNotes, setAddNotes] = useState<string>('');
  const [addFavSong, setAddFavSong] = useState<string>('');
  const [searchIdolQuery, setSearchIdolQuery] = useState<string>('');

  useEffect(() => {
    if (idols.length && !idols.some((idol) => idol.id === selectedAddIdolId)) {
      setSelectedAddIdolId(idols[0].id);
    }
  }, [idols, selectedAddIdolId]);

  // Editing inline state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState<'S+' | 'S' | 'A' | 'B' | 'C' | 'D'>('S');
  const [editRating, setEditRating] = useState<number>(90);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editFavSong, setEditFavSong] = useState<string>('');

  // Save personal rankings whenever changed
  const updateAndPersistRankings = (newRankings: PersonalRankingEntry[]) => {
    // Re-index ranks 1..N
    const sorted = newRankings.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
    setPersonalRankings(sorted);
    savePersonalRankings(sorted);
  };

  // Add new ranking
  const handleAddPersonalRanking = () => {
    if (!selectedAddIdolId) return;

    // Check if idol already in ranking
    const exists = personalRankings.some((r) => r.idolId === selectedAddIdolId);
    if (exists) {
      alert('This idol is already in your personal ranking table!');
      return;
    }

    const newEntry: PersonalRankingEntry = {
      id: `pr_${selectedAddIdolId}_${Date.now()}`,
      idolId: selectedAddIdolId,
      rank: personalRankings.length + 1,
      tier: addTier,
      customRating: Math.min(100, Math.max(1, Math.round(Number(addRating) || 85))),
      notes: addNotes.trim() || 'Top tier performer',
      favoriteSong: addFavSong.trim(),
      updatedAt: Date.now(),
    };

    updateAndPersistRankings([...personalRankings, newEntry]);
    setShowAddModal(false);
    setAddNotes('');
    setAddFavSong('');
  };

  // Delete ranking entry
  const handleDeleteRanking = (id: string) => {
    updateAndPersistRankings(personalRankings.filter((r) => r.id !== id));
  };

  // Move up/down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= personalRankings.length) return;

    const list = [...personalRankings];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    updateAndPersistRankings(list);
  };

  // Start inline editing
  const handleStartEdit = (entry: PersonalRankingEntry) => {
    setEditingEntryId(entry.id);
    setEditTier(entry.tier);
    setEditRating(entry.customRating);
    setEditNotes(entry.notes);
    setEditFavSong(entry.favoriteSong || '');
  };

  // Save inline editing
  const handleSaveEdit = (id: string) => {
    const updated = personalRankings.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          tier: editTier,
          customRating: Math.min(100, Math.max(1, Math.round(Number(editRating) || 80))),
          notes: editNotes.trim(),
          favoriteSong: editFavSong.trim(),
          updatedAt: Date.now(),
        };
      }
      return r;
    });
    updateAndPersistRankings(updated);
    setEditingEntryId(null);
  };

  const activeRecords = activeLeaderboard === 'idols' ? topIdols : topGroups;
  const top10Records = activeRecords.slice(0, 10);
  const remaining4To10 = activeRecords.slice(3, 10);
  const v5MatchCount = useMemo(() => new Set((matchDatabase || [])
    .filter((match) => match && String(match.stage || '').toLowerCase().startsWith('cups & divisions:') && match.scoreA != null && match.scoreB != null)
    .map((match) => String(match.matchId || [match.seasonId, match.stage, match.idolAId, match.idolBId, match.scoreA, match.scoreB].join('|')))
  ).size, [matchDatabase]);
  const v5TitleSummary = useMemo(() => topIdols.reduce((summary, record) => ({
    total: summary.total + record.v5Titles,
    divisionTwo: summary.divisionTwo + record.divisionTwoTitles,
    cups: summary.cups + record.v5CupTitles,
  }), { total: 0, divisionTwo: 0, cups: 0 }), [topIdols]);
  const movementSummary = useMemo(() => topIdols.reduce((summary, record) => ({
    promotions: summary.promotions + record.promotions,
    relegations: summary.relegations + record.relegations,
  }), { promotions: 0, relegations: 0 }), [topIdols]);

  const tierColors: Record<string, string> = {
    'S+': 'bg-gradient-to-r from-red-600 to-amber-500 text-white border-amber-400',
    'S': 'bg-amber-500 text-black border-amber-300 font-black',
    'A': 'bg-purple-600 text-white border-purple-400',
    'B': 'bg-blue-600 text-white border-blue-400',
    'C': 'bg-emerald-600 text-white border-emerald-400',
    'D': 'bg-slate-700 text-slate-200 border-slate-500',
  };

  return (
    <div className="space-y-8 select-none max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl border-2 border-black bg-gradient-to-r from-[#20150e] via-[#1a120b] to-[#120d09] p-6 poster-shadow flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center border-2 border-black poster-shadow-sm text-black">
            <Crown className="w-8 h-8 fill-black" />
          </div>
          <div>
            <h1 className="font-poster-title text-2xl sm:text-3xl text-amber-400 tracking-wide">
              ALL-TIME RANK PANEL
            </h1>
            <p className="text-xs sm:text-sm text-amber-200/80 font-bold">
              All-Time Results: Tournament, Division 1, Division 2, The Idols, V5 Cups & Personal Rankings
            </p>
          </div>
        </div>

        {/* Toggle between Top Idols and Top Groups */}
        <div className="flex items-center rounded-2xl bg-black/60 p-1.5 border border-black poster-shadow-sm">
          <button
            onClick={() => setActiveLeaderboard('idols')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeLeaderboard === 'idols'
                ? 'bg-amber-500 text-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Top Idols</span>
          </button>
          <button
            onClick={() => setActiveLeaderboard('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-poster-title transition-all ${
              activeLeaderboard === 'groups'
                ? 'bg-amber-500 text-black shadow-lg'
                : 'text-amber-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Top Girl Groups</span>
          </button>
        </div>
      </div>


      <p className="-mt-5 text-[10px] font-semibold tracking-wide text-amber-100/40">Official order: total titles, combined points, win rate, wins, then matches played. Personal tier rankings remain independent from this official leaderboard.</p>

      <section className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <div className="rounded-2xl border-2 border-black bg-[#17100b] p-4 poster-shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/55">Ranked Idols</div>
          <div className="mt-1 font-poster-title text-2xl text-amber-300">{topIdols.length}</div>
          <div className="text-[10px] text-amber-100/45">All registered idol records</div>
        </div>
        <div className="rounded-2xl border-2 border-black bg-[#17100b] p-4 poster-shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/55">Ranked Girl Groups</div>
          <div className="mt-1 font-poster-title text-2xl text-amber-300">{topGroups.length}</div>
          <div className="text-[10px] text-amber-100/45">Historical group aggregation</div>
        </div>
        <div className="rounded-2xl border-2 border-black bg-[#17100b] p-4 poster-shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/55">V5 Matches</div>
          <div className="mt-1 font-poster-title text-2xl text-cyan-300">{v5MatchCount}</div>
          <div className="text-[10px] text-amber-100/45">Division 2 and all V5 cups</div>
        </div>
        <div className="rounded-2xl border-2 border-black bg-[#17100b] p-4 poster-shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/55">V5 Titles Counted</div>
          <div className="mt-1 font-poster-title text-2xl text-amber-300">{v5TitleSummary.total}</div>
          <div className="text-[10px] text-amber-100/55">{v5TitleSummary.divisionTwo} Division 2 · {v5TitleSummary.cups} Cup titles</div>
        </div>
        <div className="rounded-2xl border-2 border-black bg-[#17100b] p-4 poster-shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-200/55">Promotions</div>
          <div className="mt-1 font-poster-title text-2xl text-emerald-300">{movementSummary.promotions}</div>
          <div className="text-[10px] text-amber-100/45">Career promotion events</div>
        </div>
        <div className="rounded-2xl border-2 border-black bg-[#17100b] p-4 poster-shadow">
          <div className="text-[10px] font-black uppercase tracking-wider text-rose-200/55">Relegations</div>
          <div className="mt-1 font-poster-title text-2xl text-rose-300">{movementSummary.relegations}</div>
          <div className="text-[10px] text-amber-100/45">Career relegation events</div>
        </div>
      </section>

      {/* 1. KAHOOT-STYLE PODIUM (Top 3) */}
      <section className="space-y-3">
        <KahootPodium
          records={top10Records}
          type={activeLeaderboard === 'idols' ? 'idol' : 'group'}
          title={`All-Time Top 3 ${activeLeaderboard === 'idols' ? 'Idols' : 'Girl Groups'} (Podium)`}
          subtitle="Combined all-time record across the original tournament, six Division 1 leagues, six Division 2 leagues, The Idols, and all V5 cup competitions."
        />
      </section>

      {/* 2. TOP 10 LEADERBOARD TABLE (Ranks 4-10) */}
      <section className="rounded-3xl border-2 border-black bg-[#16100b] p-5 sm:p-6 poster-shadow space-y-4">
        <div className="flex items-center justify-between border-b border-black pb-3">
          <h3 className="font-poster-title text-base sm:text-lg text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Top 10 All-Time Leaderboard ({activeLeaderboard === 'idols' ? 'Idols' : 'Girl Groups'})</span>
          </h3>
          <span className="text-xs text-amber-400/80 font-bold">
            {activeRecords.length > 3 ? `Showing Ranks 4 through ${Math.min(10, activeRecords.length)}` : 'All ranked entries are shown on the podium'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1020px]">
            <thead>
              <tr className="border-b border-black/80 bg-black/40 text-[11px] font-poster-title text-amber-400 uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-16">Rank</th>
                <th className="py-3 px-4">Participant</th>
                <th className="py-3 px-4 text-center">Titles Won</th>
                <th className="py-3 px-4 text-center">V5 Titles</th>
                <th className="py-3 px-4 text-center">Promotion / Relegation</th>
                <th className="py-3 px-4 text-center">Combined PTS</th>
                <th className="py-3 px-4 text-center">Record (W-D-L)</th>
                <th className="py-3 px-4 text-center">Win Rate</th>
                <th className="py-3 px-4 text-center">Game Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/60 text-xs">
              {remaining4To10.map((item, idx) => {
                const rankNum = idx + 4;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-amber-950/20 transition-colors"
                  >
                    {/* Rank Badge */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-xl font-poster-title text-xs font-black border bg-black/60 text-amber-300/80 border-black"
                      >
                        {rankNum}
                      </span>
                    </td>

                    {/* Participant Details */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border border-black bg-black overflow-hidden shrink-0 shadow">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-poster-title text-xs text-amber-300 bg-black">
                              {(item.name || 'ID').slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-poster-title text-sm text-white font-bold">
                              {item.name}
                            </span>
                            {item.nationality && (
                              <span className="text-xs">{getCountryFlag(item.nationality)}</span>
                            )}
                            {item.type === 'idol' && (
                              <RatingBadge
                                idol={idolsMap.get(item.id)}
                                seed={item.seed}
                                size="xs"
                                showTier={true}
                              />
                            )}
                          </div>
                          {item.girlGroup && item.girlGroup !== 'Solo' && (
                            <span className="text-[10px] font-bold text-amber-400/80">
                              {item.girlGroup} &bull; {item.seed || 'Tier Competitor'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Titles */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/60 border border-black font-mono font-black text-amber-400">
                        <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{item.titles}</span>
                      </span>
                      <div className="mt-1 text-[9px] font-semibold text-amber-100/45">
                        {item.originalTitles} Tournament · {item.leagueTitles} D1 · {item.theIdolsTitles || 0} The Idols
                      </div>
                    </td>

                    {/* V5 Titles */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-xs font-black text-cyan-300">{item.v5Titles}</span>
                      <div className="mt-1 text-[9px] font-semibold text-cyan-100/45">{item.divisionTwoTitles} D2 · {item.v5CupTitles} Cups</div>
                    </td>

                    {/* Promotion / Relegation */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 font-mono text-[10px] font-black">
                        <span className="text-emerald-300">↑ {item.promotions}</span>
                        <span className="text-rose-300">↓ {item.relegations}</span>
                      </div>
                    </td>

                    {/* Combined Points */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-poster-title text-sm font-black text-amber-300">
                        {item.totalPoints} PTS
                      </span>
                    </td>

                    {/* Record */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">
                      {item.wins}W - {item.draws}D - {item.losses}L
                    </td>

                    {/* Win Rate */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-xs font-black border ${
                          item.winRate >= 60
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                            : item.winRate >= 40
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : 'bg-red-950/80 text-red-300 border-red-500/40'
                        }`}
                      >
                        {item.winRate}%
                      </span>
                    </td>

                    {/* Game Difference */}
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      <span className={item.gameDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {item.gameDiff > 0 ? `+${item.gameDiff}` : item.gameDiff}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. PERSONAL RANKING TABLE (Manual Input / Custom Tier List) */}
      <section className="rounded-3xl border-2 border-black bg-[#18110b] p-5 sm:p-6 poster-shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
          <div>
            <h3 className="font-poster-title text-lg text-amber-400 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <span>MY PERSONAL IDOL RANKING</span>
            </h3>
            <p className="text-xs text-amber-200/70 font-semibold">
              Manually rank and rate your personal bias idols, custom tiers (S+/S/A/B/C/D), ratings, and favorite songs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportPersonalRankingsToJSON(personalRankings, idols)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-pink-300 hover:text-white text-xs font-bold transition-all"
              title="Download Personal Idol Rankings Database (.json)"
            >
              <Download className="w-3.5 h-3.5 text-pink-400" />
              <span>Download Rankings DB</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Reset personal rankings with top 10 all-time idols?')) {
                  const resetList = topIdols.slice(0, 10).map((idol, idx) => ({
                    id: `pr_${idol.id}_${Date.now()}_${idx}`,
                    idolId: idol.id,
                    rank: idx + 1,
                    tier: (idx === 0 ? 'S+' : idx < 3 ? 'S' : idx < 6 ? 'A' : 'B') as any,
                    customRating: Math.max(70, 98 - idx * 3),
                    notes: idx === 0 ? 'Ultimate All-Time Favorite' : 'Elite Performer',
                    favoriteSong: '',
                    updatedAt: Date.now(),
                  }));
                  updateAndPersistRankings(resetList);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Auto-Fill from Top 10</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow-lg transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Idol to Ranking</span>
            </button>
          </div>
        </div>

        {/* SPECIAL PERSONAL TOP 3 BIAS PODIUM */}
        {personalRankings.length >= 1 && (
          <div className="relative overflow-hidden rounded-3xl border-2 border-black bg-gradient-to-b from-[#2a1708] via-[#1a0e05] to-[#0d0702] p-6 poster-shadow">
            {/* Background stadium lighting & flare */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-amber-400/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-poster-title">
                  <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>PERSONAL BIAS TOP 3 PODIUM</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <h4 className="font-poster-title text-xl text-white tracking-wide">
                  YOUR ULTIMATE TOP 3 IDOLS
                </h4>
              </div>

              {/* Podium Arena */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-8 max-w-3xl mx-auto min-h-[300px]">
                {/* 2nd Place (Silver) */}
                {personalRankings[1] ? (
                  (() => {
                    const entry = personalRankings[1];
                    const idol = idolsMap.get(entry.idolId);
                    return (
                      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom duration-500">
                        {/* Avatar & Badges */}
                        <div className="relative mb-3 flex flex-col items-center text-center">
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-slate-300 bg-slate-900 overflow-hidden poster-shadow-sm ring-4 ring-slate-400/20">
                            {idol?.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-sm text-slate-300">
                                {idol?.name?.slice(0, 2) || 'ID'}
                              </div>
                            )}
                          </div>
                          <span className="absolute -top-3 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 border border-white flex items-center justify-center text-black font-poster-title text-xs font-black shadow-lg">
                            2
                          </span>
                          <h5 className="font-poster-title text-xs sm:text-sm text-white mt-2 font-bold truncate max-w-[110px]">
                            {idol?.name || 'Idol #2'}
                          </h5>
                          <span className="text-[10px] text-slate-300/80 font-bold truncate max-w-[100px]">
                            {idol?.girlGroup || 'Solo'}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-poster-title font-black border ${tierColors[entry.tier] || tierColors['S']}`}>
                              {entry.tier}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-black/80 text-amber-300 border border-black">
                              {entry.customRating} pts
                            </span>
                          </div>
                        </div>

                        {/* Pillar 2 */}
                        <div className="w-full h-32 sm:h-40 rounded-t-2xl border-2 border-slate-400 bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 p-3 flex flex-col items-center justify-between text-black shadow-2xl">
                          <div className="flex items-center gap-1 font-poster-title text-sm font-black tracking-wider">
                            <Medal className="w-4 h-4 text-slate-800" />
                            <span>SILVER</span>
                          </div>
                          {entry.notes && (
                            <p className="text-[9px] text-slate-900 font-bold text-center line-clamp-2 italic px-1">
                              &ldquo;{entry.notes}&rdquo;
                            </p>
                          )}
                          <span className="font-poster-title text-xs font-extrabold bg-black/20 px-2 py-0.5 rounded-full">
                            RANK #2
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="h-32 sm:h-40 rounded-t-2xl border border-dashed border-slate-700 bg-black/30 flex items-center justify-center text-xs text-slate-500 font-bold">
                    No 2nd Bias
                  </div>
                )}

                {/* 1st Place (Gold / Center / Tallest) */}
                {personalRankings[0] ? (
                  (() => {
                    const entry = personalRankings[0];
                    const idol = idolsMap.get(entry.idolId);
                    return (
                      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom duration-700">
                        {/* Crown & Avatar */}
                        <div className="relative mb-3 flex flex-col items-center text-center">
                          <Crown className="w-7 h-7 text-amber-300 fill-amber-400 animate-bounce drop-shadow-[0_4px_8px_rgba(245,158,11,0.6)] mb-0.5" />
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-3 border-amber-300 bg-amber-950 overflow-hidden poster-shadow ring-4 ring-amber-400/40">
                            {idol?.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-base text-amber-200">
                                {idol?.name?.slice(0, 2) || 'ID'}
                              </div>
                            )}
                          </div>
                          <span className="absolute top-6 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-500 border-2 border-black flex items-center justify-center text-black font-poster-title text-sm font-black shadow-xl ring-2 ring-amber-300">
                            1
                          </span>
                          <h5 className="font-poster-title text-sm sm:text-base text-amber-300 mt-2 font-black truncate max-w-[130px] drop-shadow">
                            {idol?.name || 'Idol #1'}
                          </h5>
                          <span className="text-[10px] text-amber-200/90 font-bold truncate max-w-[120px]">
                            {idol?.girlGroup || 'Solo'}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-poster-title font-black border ${tierColors[entry.tier] || tierColors['S+']}`}>
                              {entry.tier}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-black/90 text-amber-300 border border-amber-500/50">
                              {entry.customRating} pts
                            </span>
                          </div>
                        </div>

                        {/* Pillar 1 */}
                        <div className="w-full h-44 sm:h-52 rounded-t-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 p-3 flex flex-col items-center justify-between text-black shadow-2xl ring-2 ring-amber-400/30">
                          <div className="flex items-center gap-1 font-poster-title text-base font-black tracking-wider text-black">
                            <Crown className="w-5 h-5 fill-black" />
                            <span>ULTIMATE BIAS</span>
                          </div>
                          {entry.notes && (
                            <p className="text-[10px] text-black font-extrabold text-center line-clamp-3 italic px-1 bg-amber-200/50 rounded-lg py-1 border border-black/20">
                              &ldquo;{entry.notes}&rdquo;
                            </p>
                          )}
                          <span className="font-poster-title text-xs font-black bg-black text-amber-300 px-3 py-1 rounded-full border border-amber-400 shadow">
                            #1 FAVORITE
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="h-44 sm:h-52 rounded-t-2xl border border-dashed border-amber-500/50 bg-black/40 flex items-center justify-center text-xs text-amber-400 font-bold">
                    No 1st Bias
                  </div>
                )}

                {/* 3rd Place (Bronze) */}
                {personalRankings[2] ? (
                  (() => {
                    const entry = personalRankings[2];
                    const idol = idolsMap.get(entry.idolId);
                    return (
                      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom duration-500">
                        {/* Avatar & Badges */}
                        <div className="relative mb-3 flex flex-col items-center text-center">
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-amber-700 bg-slate-900 overflow-hidden poster-shadow-sm ring-4 ring-amber-800/20">
                            {idol?.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-sm text-amber-600">
                                {idol?.name?.slice(0, 2) || 'ID'}
                              </div>
                            )}
                          </div>
                          <span className="absolute -top-3 -right-2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-600 to-amber-900 border border-amber-400 flex items-center justify-center text-white font-poster-title text-xs font-black shadow-lg">
                            3
                          </span>
                          <h5 className="font-poster-title text-xs sm:text-sm text-white mt-2 font-bold truncate max-w-[110px]">
                            {idol?.name || 'Idol #3'}
                          </h5>
                          <span className="text-[10px] text-amber-300/80 font-bold truncate max-w-[100px]">
                            {idol?.girlGroup || 'Solo'}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-poster-title font-black border ${tierColors[entry.tier] || tierColors['S']}`}>
                              {entry.tier}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-black/80 text-amber-300 border border-black">
                              {entry.customRating} pts
                            </span>
                          </div>
                        </div>

                        {/* Pillar 3 */}
                        <div className="w-full h-24 sm:h-32 rounded-t-2xl border-2 border-amber-700 bg-gradient-to-b from-amber-600 via-amber-800 to-amber-950 p-2.5 flex flex-col items-center justify-between text-amber-100 shadow-2xl">
                          <div className="flex items-center gap-1 font-poster-title text-xs sm:text-sm font-black tracking-wider text-amber-200">
                            <Medal className="w-4 h-4 text-amber-400" />
                            <span>BRONZE</span>
                          </div>
                          {entry.notes && (
                            <p className="text-[9px] text-amber-100/90 font-bold text-center line-clamp-2 italic px-1">
                              &ldquo;{entry.notes}&rdquo;
                            </p>
                          )}
                          <span className="font-poster-title text-[10px] font-extrabold bg-black/40 px-2 py-0.5 rounded-full text-amber-300">
                            RANK #3
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="h-24 sm:h-32 rounded-t-2xl border border-dashed border-slate-800 bg-black/30 flex items-center justify-center text-xs text-slate-600 font-bold">
                    No 3rd Bias
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Personal Rankings Table */}
        {personalRankings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-black/80 bg-black/40 text-[11px] font-poster-title text-amber-400 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-14">Rank</th>
                  <th className="py-3 px-4">Idol</th>
                  <th className="py-3 px-3 text-center w-20">Tier</th>
                  <th className="py-3 px-3 text-center w-24">Rating</th>
                  <th className="py-3 px-4">Personal Notes</th>
                  <th className="py-3 px-4">Favorite Song</th>
                  <th className="py-3 px-4 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/60 text-xs">
                {personalRankings.map((entry, idx) => {
                  const idol = idolsMap.get(entry.idolId);
                  const isEditing = editingEntryId === entry.id;

                  return (
                    <tr key={entry.id} className="hover:bg-amber-950/20 transition-colors">
                      {/* Rank Number */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-black/80 border border-amber-500/40 text-amber-400 font-poster-title text-xs font-black">
                          #{entry.rank}
                        </span>
                      </td>

                      {/* Idol Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl border border-black bg-black overflow-hidden shrink-0 shadow">
                            {idol?.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-xs text-amber-300 bg-black">
                                {idol?.name?.slice(0, 2) || 'ID'}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-poster-title text-sm text-white font-bold">
                                {idol?.name || 'Unknown Idol'}
                              </span>
                              {idol?.nationality && (
                                <span className="text-xs">{getCountryFlag(idol.nationality)}</span>
                              )}
                              {idol && <RatingBadge idol={idol} size="xs" showTier={true} />}
                            </div>
                            <span className="text-[10px] font-bold text-amber-400/80">
                              {idol?.girlGroup || 'Solo'} &bull; {idol?.seed || 'Unseeded'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tier Badge */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <select
                            value={editTier}
                            onChange={(e) => setEditTier(e.target.value as any)}
                            className="bg-black border border-amber-400 text-amber-300 text-xs font-bold rounded-lg px-2 py-1"
                          >
                            <option value="S+">S+</option>
                            <option value="S">S</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-xl text-xs font-poster-title font-black border ${
                              tierColors[entry.tier] || tierColors['S']
                            }`}
                          >
                            {entry.tier}
                          </span>
                        )}
                      </td>

                      {/* Custom Rating */}
                      <td className="py-3 px-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editRating}
                            onChange={(e) => setEditRating(Number(e.target.value))}
                            className="w-16 bg-black border border-amber-400 text-amber-300 text-xs font-black rounded-lg px-2 py-1 text-center"
                          />
                        ) : (
                          <span className="font-poster-title text-xs font-black text-amber-300 bg-black/60 px-2 py-1 rounded-lg border border-black">
                            ⭐ {entry.customRating}/100
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Add your personal thoughts..."
                            className="w-full bg-black border border-amber-400 text-white text-xs rounded-lg px-2.5 py-1"
                          />
                        ) : (
                          <span className="text-slate-300 font-medium">
                            {entry.notes || <span className="text-slate-600 italic">No notes</span>}
                          </span>
                        )}
                      </td>

                      {/* Favorite Song */}
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFavSong}
                            onChange={(e) => setEditFavSong(e.target.value)}
                            placeholder="Favorite track..."
                            className="w-full bg-black border border-amber-400 text-white text-xs rounded-lg px-2.5 py-1"
                          />
                        ) : entry.favoriteSong ? (
                          <span className="inline-flex items-center gap-1 text-amber-300 font-semibold text-[11px] bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-500/30">
                            <Music className="w-3 h-3 text-amber-400" />
                            <span>{entry.favoriteSong}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(entry.id)}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingEntryId(null)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleMove(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleMove(idx, 'down')}
                                disabled={idx === personalRankings.length - 1}
                                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleStartEdit(entry)}
                                className="p-1 rounded-lg bg-slate-900 hover:bg-amber-500 hover:text-black text-slate-300"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRanking(entry.id)}
                                className="p-1 rounded-lg bg-slate-900 hover:bg-red-600 text-red-400 hover:text-white"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-8 rounded-2xl border-2 border-dashed border-slate-800 text-slate-400 text-xs">
            No personal rankings added yet. Click "+ Add Idol to Ranking" or "Auto-Fill from Top 10" to get started!
          </div>
        )}
      </section>

      {/* Add Personal Ranking Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-black bg-[#1a120b] p-6 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-3">
              <h3 className="font-poster-title text-lg text-amber-400 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Add Idol to Personal Ranking</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Idol Search & Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Select Idol:
                </label>
                <input
                  type="text"
                  value={searchIdolQuery}
                  onChange={(e) => setSearchIdolQuery(e.target.value)}
                  placeholder="Filter idols by name or group..."
                  className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white mb-2"
                />
                <select
                  value={selectedAddIdolId}
                  onChange={(e) => setSelectedAddIdolId(e.target.value)}
                  className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-amber-300 font-bold"
                >
                  {idols
                    .filter((i) =>
                      searchIdolQuery
                        ? i.name.toLowerCase().includes(searchIdolQuery.toLowerCase()) ||
                          i.girlGroup.toLowerCase().includes(searchIdolQuery.toLowerCase())
                        : true
                    )
                    .map((idol) => (
                      <option key={idol.id} value={idol.id}>
                        {idol.name} ({idol.girlGroup} &bull; {idol.seed})
                      </option>
                    ))}
                </select>
              </div>

              {/* Tier & Rating */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Tier Classification:
                  </label>
                  <select
                    value={addTier}
                    onChange={(e) => setAddTier(e.target.value as any)}
                    className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  >
                    <option value="S+">S+ Tier (Legendary Bias)</option>
                    <option value="S">S Tier (God Tier)</option>
                    <option value="A">A Tier (Master)</option>
                    <option value="B">B Tier (Diamond)</option>
                    <option value="C">C Tier (Gold)</option>
                    <option value="D">D Tier (Silver)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Rating Score (1-100):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={addRating}
                    onChange={(e) => setAddRating(Number(e.target.value))}
                    className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold text-center"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Personal Comments / Notes:
                </label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="e.g. Best stage presence, heavenly vocals..."
                  className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Favorite Song */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Favorite Song / Performance:
                </label>
                <input
                  type="text"
                  value={addFavSong}
                  onChange={(e) => setAddFavSong(e.target.value)}
                  placeholder="e.g. Psycho, Next Level, Ditto..."
                  className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-black">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPersonalRanking}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow-lg"
              >
                Confirm & Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
