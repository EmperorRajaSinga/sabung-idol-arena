import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Idol, GirlGroup, LeagueInfo, LeagueSeasonState } from '../types';
import {
  generateRoundRobinMatches,
  calculateLeagueStandings,
  saveLeagueSeasonState,
  DEFAULT_LEAGUE_DEFS,
  loadCustomLeagueBranding,
  LeagueBrandingItem,
} from '../utils/leagueLogic';
import { generateAvatarUrl } from '../data/initialData';
import { normalizeDataName } from '../utils/dataChangeHistory';
import { getCountryFlag } from '../utils/nationalityHelper';
import {
  X,
  Clipboard,
  Trash2,
  Check,
  AlertCircle,
  Users,
  Search,
  Plus,
  Layers,
  ArrowRightLeft,
  Shield,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface LeagueRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  idols: Idol[];
  girlGroups: GirlGroup[];
  reservedNames?: string[];
  leagueState: LeagueSeasonState | null;
  onUpdateLeagueState: (newState: LeagueSeasonState) => void;
  onUpdateIdols?: (updatedIdols: Idol[]) => void;
}

export const LeagueRosterModal: React.FC<LeagueRosterModalProps> = ({
  isOpen,
  onClose,
  idols,
  girlGroups,
  reservedNames = [],
  leagueState,
  onUpdateLeagueState,
  onUpdateIdols,
}) => {
  // Load real-time custom league branding
  const [leaguesBranding, setLeaguesBranding] = useState<LeagueBrandingItem[]>(() => {
    return loadCustomLeagueBranding();
  });

  // Working copy of 6 division rosters (leagueId 1..6 -> array of idolIds)
  const [divisionMembers, setDivisionMembers] = useState<Record<number, string[]>>(() => {
    const map: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (let d = 1; d <= 6; d++) {
      const found = leagueState?.leagues?.find((l) => l.id === d);
      map[d] = found ? [...found.memberIds] : [];
    }
    return map;
  });

  const [createdIdolsAccumulator, setCreatedIdolsAccumulator] = useState<Idol[]>([]);
  const [activeDivisionTab, setActiveDivisionTab] = useState<number>(1);
  const [singlePasteModalOpen, setSinglePasteModalOpen] = useState<boolean>(false);
  const [singlePasteText, setSinglePasteText] = useState<string>('');
  const [bulkPasteModalOpen, setBulkPasteModalOpen] = useState<boolean>(false);
  const [bulkPasteText, setBulkPasteText] = useState<string>('');
  const [searchPoolQuery, setSearchPoolQuery] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Keep the latest persisted state available without resetting unsaved modal edits
  // whenever the parent re-renders or receives an unrelated league-state update.
  const latestLeagueStateRef = useRef(leagueState);
  latestLeagueStateRef.current = leagueState;

  // Load the saved roster only when the modal opens.
  useEffect(() => {
    if (isOpen) {
      const freshBranding = loadCustomLeagueBranding();
      setLeaguesBranding(freshBranding);

      const source = latestLeagueStateRef.current;
      const map: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      for (let d = 1; d <= 6; d++) {
        const found = source?.leagues?.find((l) => l.id === d);
        map[d] = found ? [...(found.memberIds || [])] : [];
      }
      setDivisionMembers(map);
      setCreatedIdolsAccumulator([]);
    }
  }, [isOpen]);

  const triggerFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  // Maps for idol lookup
  const allIdolsPool = useMemo(() => {
    return [...idols, ...createdIdolsAccumulator];
  }, [idols, createdIdolsAccumulator]);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    allIdolsPool.forEach((i) => map.set(i.id, i));
    return map;
  }, [allIdolsPool]);

  const idolsByName = useMemo(() => {
    const map = new Map<string, Idol>();
    allIdolsPool.forEach((i) => {
      map.set(i.name.trim().toLowerCase(), i);
    });
    return map;
  }, [allIdolsPool]);

  // Division 2 names are reserved and cannot be assigned to any Division 1 league.
  const reservedNameSet = useMemo(() => new Set(reservedNames.map(normalizeDataName).filter(Boolean)), [reservedNames]);

  // Set of assigned idol IDs
  const assignedIdolIds = useMemo(() => {
    const set = new Set<string>();
    (Object.values(divisionMembers) as string[][]).forEach((ids) => {
      ids.forEach((id) => set.add(id));
    });
    return set;
  }, [divisionMembers]);

  // Available idols not yet assigned
  const unassignedIdols = useMemo(() => {
    return allIdolsPool.filter((i) => !assignedIdolIds.has(i.id));
  }, [allIdolsPool, assignedIdolIds]);

  // Search filter for unassigned pool
  const filteredUnassignedPool = useMemo(() => {
    if (!searchPoolQuery.trim()) return unassignedIdols;
    const q = searchPoolQuery.toLowerCase();
    return unassignedIdols.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.girlGroup.toLowerCase().includes(q) ||
        i.seed.toLowerCase().includes(q) ||
        i.nationality.toLowerCase().includes(q)
    );
  }, [unassignedIdols, searchPoolQuery]);

  // Total assigned count across 6 leagues
  const totalAssignedCount = useMemo(() => {
    return (Object.values(divisionMembers) as string[][]).reduce((acc, list) => acc + list.length, 0);
  }, [divisionMembers]);

  // Active division branding
  const activeBranding = useMemo(() => {
    return (
      leaguesBranding.find((b) => b.id === activeDivisionTab) ||
      DEFAULT_LEAGUE_DEFS.find((d) => d.id === activeDivisionTab) ||
      DEFAULT_LEAGUE_DEFS[0]
    );
  }, [leaguesBranding, activeDivisionTab]);

  const activeDivisionMembers = divisionMembers[activeDivisionTab] || [];

  // Helper to create a new idol if not in database
  const getOrCreateIdol = (name: string): Idol => {
    const trimmed = name.trim();
    const existing = idolsByName.get(trimmed.toLowerCase());
    if (existing) return existing;

    const newId = `idol_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newIdol: Idol = {
      id: newId,
      name: trimmed,
      girlGroup: 'Solo',
      seed: 'Unseeded',
      nationality: 'South Korea',
      photoUrl: generateAvatarUrl(trimmed, 'Solo'),
      createdAt: Date.now(),
    };
    return newIdol;
  };

  // --- ADD IDOL TO ACTIVE DIVISION ---
  const handleAddIdol = (idolId: string) => {
    if (activeDivisionMembers.length >= 20) {
      triggerFeedback(`${activeBranding.name} is already full (20/20).`, 'error');
      return;
    }
    if (assignedIdolIds.has(idolId)) {
      triggerFeedback(`This idol is already assigned to a division.`, 'error');
      return;
    }

    const idol = idolsMap.get(idolId);
    if (idol && reservedNameSet.has(normalizeDataName(idol.name))) {
      triggerFeedback(`${idol.name} is already assigned to Division 2. Remove it from Division 2 before assigning it here.`, 'error');
      return;
    }
    setDivisionMembers((prev) => ({
      ...prev,
      [activeDivisionTab]: [...(prev[activeDivisionTab] || []), idolId],
    }));
    triggerFeedback(`Added ${idol?.name || 'Idol'} to ${activeBranding.name}.`);
  };

  // --- REMOVE IDOL FROM ACTIVE DIVISION ---
  const handleRemoveIdol = (idolId: string) => {
    const idol = idolsMap.get(idolId);
    setDivisionMembers((prev) => ({
      ...prev,
      [activeDivisionTab]: (prev[activeDivisionTab] || []).filter((id) => id !== idolId),
    }));
    triggerFeedback(`Removed ${idol?.name || 'Idol'} from ${activeBranding.name}.`);
  };

  // --- TRANSFER IDOL TO ANOTHER DIVISION ---
  const handleTransferIdol = (idolId: string, targetLeagueId: number) => {
    if (targetLeagueId === activeDivisionTab) return;
    const targetMembers = divisionMembers[targetLeagueId] || [];
    const targetBranding = leaguesBranding.find((b) => b.id === targetLeagueId) || DEFAULT_LEAGUE_DEFS[targetLeagueId - 1];

    if (targetMembers.length >= 20) {
      triggerFeedback(`${targetBranding.name} is already full (20/20).`, 'error');
      return;
    }

    const idol = idolsMap.get(idolId);
    if (idol && reservedNameSet.has(normalizeDataName(idol.name))) {
      triggerFeedback(`${idol.name} is already assigned to Division 2 and cannot be transferred into another Division 1 league.`, 'error');
      return;
    }
    setDivisionMembers((prev) => ({
      ...prev,
      [activeDivisionTab]: (prev[activeDivisionTab] || []).filter((id) => id !== idolId),
      [targetLeagueId]: [...(prev[targetLeagueId] || []), idolId],
    }));
    triggerFeedback(`Transferred ${idol?.name || 'Idol'} to ${targetBranding.name}.`);
  };

  // --- CLEAR ACTIVE DIVISION ---
  const handleClearDivision = () => {
    setDivisionMembers((prev) => ({
      ...prev,
      [activeDivisionTab]: [],
    }));
    triggerFeedback(`Cleared all roster entries for ${activeBranding.name}.`);
  };

  // --- SINGLE DIVISION PASTE HANDLER ---
  const handleApplySinglePaste = () => {
    const lines = singlePasteText
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•\d.)\]\s]+/, '').trim())
      .filter((l) => l.length > 0)
      .slice(0, 20); // Cap at 20

    if (lines.length === 0) {
      triggerFeedback('No valid idol names found.', 'error');
      return;
    }
    const reservedConflicts = Array.from(new Set(lines.filter((name) => reservedNameSet.has(normalizeDataName(name)))));
    if (reservedConflicts.length) {
      triggerFeedback(`Paste blocked. Already assigned to Division 2: ${reservedConflicts.slice(0, 8).join(', ')}.`, 'error');
      return;
    }

    const existingElsewhere = new Map<string, number[]>();
    for (let division = 1; division <= 6; division++) {
      if (division === activeDivisionTab) continue;
      for (const id of divisionMembers[division] || []) {
        const key = normalizeDataName(idolsMap.get(id)?.name || id);
        if (!key) continue;
        existingElsewhere.set(key, [...(existingElsewhere.get(key) || []), division]);
      }
    }
    const conflicts = Array.from(new Set(lines.filter((name) => existingElsewhere.has(normalizeDataName(name)))));
    if (conflicts.length) {
      triggerFeedback(`Paste blocked. Already assigned to another Division 1 league: ${conflicts.slice(0, 8).join(', ')}. Use the Move control to transfer an idol.`, 'error');
      return;
    }

    const newlyCreated: Idol[] = [];
    const memberIds: string[] = [];
    const usedIds = new Set<string>();

    lines.forEach((name) => {
      let idol = idolsByName.get(name.toLowerCase());
      if (!idol) {
        idol = getOrCreateIdol(name);
        newlyCreated.push(idol);
      }
      if (!usedIds.has(idol.id)) {
        usedIds.add(idol.id);
        memberIds.push(idol.id);
      }
    });

    if (newlyCreated.length > 0) {
      setCreatedIdolsAccumulator((prev) => [...prev, ...newlyCreated]);
    }

    // Remove these idols from any other division first
    setDivisionMembers((prev) => {
      const updated: Record<number, string[]> = {};
      for (let d = 1; d <= 6; d++) {
        if (d === activeDivisionTab) {
          updated[d] = memberIds;
        } else {
          updated[d] = (prev[d] || []).filter((id) => !usedIds.has(id));
        }
      }
      return updated;
    });

    setSinglePasteModalOpen(false);
    setSinglePasteText('');
    triggerFeedback(`Assigned ${memberIds.length} idols to ${activeBranding.name}.`);
  };

  // --- MULTI-DIVISION BULK PASTE HANDLER ---
  const handleApplyBulkPaste = () => {
    if (!bulkPasteText.trim()) return;

    const sections: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    let currentDivision = 1;

    const lines = bulkPasteText.split('\n');

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      // Check for division header like [Division 1], [Idol Premier League], # Division 2, etc.
      const lower = line.toLowerCase();
      let matchedDivision: number | null = null;

      // 1. Check custom branding names
      leaguesBranding.forEach((b) => {
        if (lower.includes(b.name.toLowerCase()) || lower.includes(b.tierName.toLowerCase())) {
          matchedDivision = b.id;
        }
      });

      // 2. Check default names & numbers
      if (matchedDivision === null) {
        if (lower.includes('division 1') || lower.includes('div 1') || lower.includes('d1') || lower.includes('tier 1')) matchedDivision = 1;
        else if (lower.includes('division 2') || lower.includes('div 2') || lower.includes('d2') || lower.includes('tier 2')) matchedDivision = 2;
        else if (lower.includes('division 3') || lower.includes('div 3') || lower.includes('d3') || lower.includes('tier 3')) matchedDivision = 3;
        else if (lower.includes('division 4') || lower.includes('div 4') || lower.includes('d4') || lower.includes('tier 4')) matchedDivision = 4;
        else if (lower.includes('division 5') || lower.includes('div 5') || lower.includes('d5') || lower.includes('tier 5')) matchedDivision = 5;
        else if (lower.includes('division 6') || lower.includes('div 6') || lower.includes('d6') || lower.includes('tier 6')) matchedDivision = 6;
      }

      if (matchedDivision !== null && (line.startsWith('[') || line.startsWith('#') || line.startsWith('===') || line.endsWith(':') || line.startsWith('//'))) {
        currentDivision = matchedDivision;
        return;
      }

      // Idol name line
      const cleanName = line.replace(/^[-*•\d.)\]\s]+/, '').trim();
      if (cleanName && sections[currentDivision].length < 20) {
        sections[currentDivision].push(cleanName);
      }
    });

    const reservedConflicts = Array.from(new Set(Object.values(sections).flat().filter((name) => reservedNameSet.has(normalizeDataName(name)))));
    if (reservedConflicts.length) {
      triggerFeedback(`Bulk paste blocked. Already assigned to Division 2: ${reservedConflicts.slice(0, 10).join(', ')}.`, 'error');
      return;
    }
    const assignedByName = new Map<string, number>();
    const crossLeagueDuplicates: string[] = [];
    for (let division = 1; division <= 6; division++) {
      for (const name of sections[division]) {
        const key = normalizeDataName(name);
        if (!key) continue;
        const priorDivision = assignedByName.get(key);
        if (priorDivision !== undefined && priorDivision !== division) crossLeagueDuplicates.push(name);
        else assignedByName.set(key, division);
      }
    }
    if (crossLeagueDuplicates.length) {
      triggerFeedback(`Bulk paste blocked. These names appear in more than one Division 1 league: ${Array.from(new Set(crossLeagueDuplicates)).slice(0, 10).join(', ')}.`, 'error');
      return;
    }
    const newlyCreated: Idol[] = [];
    const newDivisionMembers: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const globalAssigned = new Set<string>();
    const globalAssignedNames = new Set<string>();

    for (let d = 1; d <= 6; d++) {
      const names = sections[d] || [];
      names.forEach((name) => {
        let idol = idolsByName.get(name.toLowerCase());
        if (!idol) {
          idol = getOrCreateIdol(name);
          newlyCreated.push(idol);
        }
        const normalizedName = normalizeDataName(idol.name);
        if (!globalAssigned.has(idol.id) && !globalAssignedNames.has(normalizedName) && newDivisionMembers[d].length < 20) {
          globalAssigned.add(idol.id);
          globalAssignedNames.add(normalizedName);
          newDivisionMembers[d].push(idol.id);
        }
      });
    }

    if (newlyCreated.length > 0) {
      setCreatedIdolsAccumulator((prev) => [...prev, ...newlyCreated]);
    }

    setDivisionMembers(newDivisionMembers);
    setBulkPasteModalOpen(false);
    setBulkPasteText('');
    triggerFeedback(`Parsed bulk rosters for all 6 divisions successfully!`);
  };

  // --- SAVE & APPLY ALL ROSTERS ---
  const handleSaveAndApply = () => {
    // Never interpret an unavailable or partial source state as six empty rosters.
    if (!leagueState || !Array.isArray(leagueState.leagues) || leagueState.leagues.length !== 6) {
      triggerFeedback('Save blocked. The saved Division 1 league data is incomplete or unavailable. Existing rosters were not changed.', 'error');
      return;
    }

    const allKnownIdols = [...idols, ...createdIdolsAccumulator];
    const knownById = new Map(allKnownIdols.map((idol) => [idol.id, idol]));
    const nameCounts = new Map<string, number>();
    for (let division = 1; division <= 6; division++) {
      for (const id of divisionMembers[division] || []) {
        const normalized = normalizeDataName(knownById.get(id)?.name || id);
        if (normalized) nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
      }
    }
    const duplicateNames = Array.from(nameCounts.entries()).filter(([, count]) => count > 1).map(([name]) => name);
    const d2Conflicts = Array.from(nameCounts.keys()).filter((name) => reservedNameSet.has(name));
    if (duplicateNames.length || d2Conflicts.length) {
      triggerFeedback(`Save blocked. Duplicate names across Division 1 leagues: ${duplicateNames.slice(0, 8).join(', ') || 'none'}. Already assigned to Division 2: ${d2Conflicts.slice(0, 8).join(', ') || 'none'}. Resolve these conflicts first.`, 'error');
      return;
    }
    const customDefs = loadCustomLeagueBranding();

    const updatedLeagues: LeagueInfo[] = [1, 2, 3, 4, 5, 6].map((leagueId) => {
      const customDef = customDefs.find((c) => c.id === leagueId);
      const def = DEFAULT_LEAGUE_DEFS.find((d) => d.id === leagueId) || DEFAULT_LEAGUE_DEFS[0];
      const previous = leagueState.leagues.find((league) => league.id === leagueId);
      const memberIds = [...(divisionMembers[leagueId] || [])];
      const sameRoster = Boolean(previous) &&
        previous!.memberIds.length === memberIds.length &&
        previous!.memberIds.every((id) => memberIds.includes(id));
      const generatedMatches = sameRoster && previous?.matches?.length
        ? previous.matches
        : generateRoundRobinMatches(leagueId, memberIds);
      // If a roster changes, retain results only for fixtures whose participants and
      // matchday remain identical. Never wipe unrelated completed fixtures.
      const previousMatches = new Map((previous?.matches || [])
        .filter((match) => match.completed)
        .map((match) => [`${match.idolAId}__${match.idolBId}`, match]));
      const matches = sameRoster ? generatedMatches : generatedMatches.map((match) => {
        const saved = previousMatches.get(`${match.idolAId}__${match.idolBId}`);
        return saved?.completed ? {
          ...match,
          scoreA: saved.scoreA,
          scoreB: saved.scoreB,
          winnerId: saved.winnerId,
          completed: true,
          updatedAt: saved.updatedAt,
        } : match;
      });
      const standings = calculateLeagueStandings(leagueId, memberIds, matches, allKnownIdols);

      return {
        ...previous,
        id: leagueId,
        name: customDef?.name || previous?.name || def.name,
        tierName: customDef?.tierName || previous?.tierName || def.tierName,
        color: customDef?.color || previous?.color || def.color,
        logoUrl: customDef?.logoUrl !== undefined ? customDef.logoUrl : (previous?.logoUrl || def.logoUrl || ''),
        description: customDef?.description !== undefined ? customDef.description : (previous?.description || def.description || ''),
        memberIds,
        matches,
        standings,
        isCompleted: sameRoster ? (previous?.isCompleted || false) : false,
      };
    });

    const newState: LeagueSeasonState = {
      seasonNumber: leagueState?.seasonNumber || 1,
      seasonName: leagueState?.seasonName || `League Season ${leagueState?.seasonNumber || 1}`,
      isStarted: true,
      ...leagueState,
      leagues: updatedLeagues,
      isCompleted: false,
      currentMatchday: 1,
      championsAdvancementDone: false,
    };

    if (createdIdolsAccumulator.length > 0 && onUpdateIdols) {
      onUpdateIdols(allKnownIdols);
    }

    onUpdateLeagueState(newState);
    saveLeagueSeasonState(newState);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl border-2 border-black bg-[#16100b] poster-shadow overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-black flex items-center justify-between bg-[#1f150f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-black shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-poster-title text-lg sm:text-xl text-white flex items-center gap-2">
                <span>League Roster Manager</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-black/60 text-amber-300 border border-black">
                  {totalAssignedCount}/120 Total Assigned
                </span>
              </h3>
              <p className="text-xs text-amber-200/70 font-medium">
                Input and assign 20 idols to each custom branded league division.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkPasteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2a1d14] hover:bg-[#38261b] border border-black text-amber-300 text-xs font-bold transition-all"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk 6-Division Paste</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-black/60 hover:bg-black text-slate-400 hover:text-white border border-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b border-black ${
              feedbackMsg.type === 'error'
                ? 'bg-red-950/80 text-red-200 border-red-900'
                : 'bg-emerald-950/80 text-emerald-200 border-emerald-900'
            }`}
          >
            {feedbackMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* 6 Division Branding Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-[#110c08] border-b border-black">
          {leaguesBranding.map((b) => {
            const isSelected = b.id === activeDivisionTab;
            const count = (divisionMembers[b.id] || []).length;
            const isFull = count === 20;

            return (
              <button
                type="button"
                key={b.id}
                onClick={() => setActiveDivisionTab(b.id)}
                className={`p-2.5 rounded-2xl border-2 text-left transition-all relative ${
                  isSelected
                    ? 'border-amber-400 bg-[#25180f] ring-2 ring-amber-400/40 shadow-lg'
                    : 'border-black bg-[#16100b] hover:bg-[#1f150f] text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="w-3 h-3 rounded-full border border-black shadow-sm"
                    style={{ backgroundColor: b.color }}
                  />
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isFull
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        : count > 0
                        ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        : 'bg-red-950 text-red-300 border border-red-800/60'
                    }`}
                  >
                    {count}/20
                  </span>
                </div>
                <div className="font-poster-title text-xs font-black truncate text-white">
                  {b.name}
                </div>
                <div className="text-[9px] text-amber-400/70 font-bold truncate">
                  {b.tierName}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Division Workspace */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* Active Division Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#1d130c] border-2 border-black">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-black shadow text-white font-poster-title font-black text-sm"
                style={{ backgroundColor: activeBranding.color }}
              >
                D{activeBranding.id}
              </div>
              <div>
                <h4 className="font-poster-title text-base sm:text-lg text-white flex items-center gap-2">
                  <span>{activeBranding.name}</span>
                  <span className="text-xs text-amber-400 font-mono font-bold">
                    ({activeDivisionMembers.length}/20 Idols Assigned)
                  </span>
                </h4>
                <p className="text-xs text-amber-300/70 font-medium">
                  {activeBranding.tierName} &bull; {activeBranding.description || 'Division Roster'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSinglePasteText(
                    activeDivisionMembers
                      .map((id) => idolsMap.get(id)?.name || '')
                      .filter(Boolean)
                      .join('\n')
                  );
                  setSinglePasteModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow transition-all"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Paste / Edit Roster (Names)</span>
              </button>

              <button
                type="button"
                onClick={handleClearDivision}
                disabled={activeDivisionMembers.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-900 disabled:opacity-40 text-xs font-bold transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Division</span>
              </button>
            </div>
          </div>

          {/* Assigned Idols Grid */}
          <div>
            <h5 className="font-poster-title text-xs text-amber-300 uppercase tracking-wider mb-2.5">
              Assigned Roster Members ({activeDivisionMembers.length}/20)
            </h5>

            {activeDivisionMembers.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border-2 border-dashed border-black bg-black/30 space-y-2">
                <Users className="w-8 h-8 text-amber-400/40 mx-auto" />
                <div className="text-sm font-poster-title text-white">No idols in this division yet</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Click <strong>"Paste / Edit Roster"</strong> above to paste 20 idol names, or select idols from the pool below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {activeDivisionMembers.map((idolId, idx) => {
                  const idol = idolsMap.get(idolId);

                  return (
                    <div
                      key={`${idolId}_${idx}`}
                      className="p-2.5 rounded-2xl border-2 border-black bg-[#120e0a] hover:border-slate-700 transition-all flex flex-col justify-between gap-2 shadow"
                    >
                      <div className="flex items-center gap-2.5">
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-poster-title text-xs text-white truncate font-bold">
                              {idol?.name || 'Unknown'}
                            </span>
                            {idol?.nationality && (
                              <span className="text-[10px] shrink-0">
                                {getCountryFlag(idol.nationality)}
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] font-bold text-amber-400/80 truncate">
                            {idol?.girlGroup} &bull; {idol?.seed}
                          </div>
                        </div>
                      </div>

                      {/* Move to another league dropdown & remove */}
                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-black/60">
                        <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                          <ArrowRightLeft className="w-2.5 h-2.5 text-amber-400" />
                          <span>Move:</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleTransferIdol(idolId, parseInt(e.target.value, 10));
                              }
                            }}
                            className="bg-black border border-slate-700 rounded-lg px-1.5 py-0.5 text-[9px] text-amber-300 font-bold max-w-[110px] truncate"
                          >
                            <option value="">Move to...</option>
                            {leaguesBranding
                              .filter((b) => b.id !== activeDivisionTab)
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveIdol(idolId)}
                            title="Remove from division"
                            className="p-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick-Add Idols from Pool */}
          <div className="pt-4 border-t border-black space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="font-poster-title text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Available Idols Pool ({unassignedIdols.length} Unassigned)</span>
              </h5>
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchPoolQuery}
                  onChange={(e) => setSearchPoolQuery(e.target.value)}
                  placeholder="Search available idols..."
                  className="bg-black border border-slate-700 rounded-xl pl-7 pr-3 py-1 text-xs text-white placeholder-slate-500 w-48 sm:w-64"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2.5 bg-black/40 rounded-2xl border border-black">
              {filteredUnassignedPool.length === 0 ? (
                <div className="text-xs text-slate-500 p-2">
                  {unassignedIdols.length === 0
                    ? 'All idols in the database have been assigned to divisions.'
                    : 'No matching idols found in unassigned pool.'}
                </div>
              ) : (
                filteredUnassignedPool.slice(0, 40).map((idol) => (
                  <button
                    type="button"
                    key={idol.id}
                    onClick={() => handleAddIdol(idol.id)}
                    disabled={activeDivisionMembers.length >= 20}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#19110b] hover:bg-amber-500 hover:text-black border border-black text-slate-300 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{idol.name}</span>
                    <span className="text-[9px] opacity-70">({idol.girlGroup})</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer with Save / Apply Actions */}
        <div className="p-4 border-t border-black bg-[#1f150f] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-400">
            Assigned: <span className="text-amber-300 font-mono">{totalAssignedCount}/120</span> idols total
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAndApply}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl poster-pill-gold text-amber-950 font-poster-title text-xs font-black shadow-lg hover:scale-105 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save &amp; Apply All Rosters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Single Division Paste Text */}
      {singlePasteModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border-2 border-black bg-[#18110b] p-5 sm:p-6 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-3">
              <h4 className="font-poster-title text-base text-amber-400 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activeBranding.color }}
                />
                <span>Paste Roster for {activeBranding.name}</span>
              </h4>
              <button
                type="button"
                onClick={() => setSinglePasteModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 font-medium">
              Paste up to 20 idol names (one per line). Any name that doesn't exist yet will be automatically created.
            </p>

            <textarea
              rows={10}
              value={singlePasteText}
              onChange={(e) => setSinglePasteText(e.target.value)}
              placeholder="Paste idol names here, one per line..."
              className="w-full rounded-xl border border-slate-700 bg-black p-3 font-mono text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center justify-between pt-2 border-t border-black">
              <span className="text-[11px] font-bold text-slate-400">
                {singlePasteText.split('\n').filter((x) => x.trim()).length}/20 names
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSinglePasteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplySinglePaste}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow"
                >
                  Apply to {activeBranding.name}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk 6-Division Paste */}
      {bulkPasteModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl border-2 border-black bg-[#18110b] p-5 sm:p-6 poster-shadow space-y-4">
            <div className="flex items-center justify-between border-b border-black pb-3">
              <h4 className="font-poster-title text-base text-amber-400 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <span>Bulk 6-Division Paste</span>
              </h4>
              <button
                type="button"
                onClick={() => setBulkPasteModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Paste all 6 division rosters using division headers like{' '}
              <code className="text-amber-400">[{leaguesBranding[0]?.name || 'Division 1'}]</code> or{' '}
              <code className="text-amber-400">[Division 2]</code> followed by 20 idol names per block.
            </p>

            <textarea
              rows={12}
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              placeholder={`[${leaguesBranding[0]?.name || 'Division 1'}]\nIdol 1\nIdol 2\n...\n\n[${leaguesBranding[1]?.name || 'Division 2'}]\nIdol 1\n...`}
              className="w-full rounded-xl border border-slate-700 bg-black p-3 font-mono text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center justify-between pt-2 border-t border-black">
              <span className="text-[11px] font-bold text-slate-400">
                {bulkPasteText.split('\n').filter((x) => x.trim()).length} lines detected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkPasteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkPaste}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-poster-title text-xs font-black shadow"
                >
                  Parse &amp; Apply All Divisions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
