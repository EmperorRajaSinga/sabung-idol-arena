import React, { useState, useMemo } from 'react';
import { Group, Idol } from '../types';
import {
  X,
  ArrowRightLeft,
  Users,
  Save,
  Clipboard,
  FileText,
  LayoutGrid,
  Check,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Trash2,
  Shuffle,
  ArrowRight,
  Plus,
  HelpCircle,
  Copy,
} from 'lucide-react';
import { SearchableIdolSelect } from './SearchableIdolSelect';

interface ManualGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  idolsMap: Map<string, Idol>;
  onSaveGroups: (updatedGroups: Group[]) => void;
}

export const ManualGroupModal: React.FC<ManualGroupModalProps> = ({
  isOpen,
  onClose,
  groups,
  idolsMap,
  onSaveGroups,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'visual' | 'quick_matrix'>('paste');
  const [localGroups, setLocalGroups] = useState<Group[]>(() =>
    JSON.parse(JSON.stringify(groups || []))
  );

  const [selectedSwapSlot, setSelectedSwapSlot] = useState<{
    groupId: string;
    index: number;
    idolId: string;
  } | null>(null);

  const [bulkText, setBulkText] = useState<string>('');
  const [parseNotice, setParseNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string[];
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const allIdolsList: Idol[] = useMemo(() => Array.from(idolsMap.values()), [idolsMap]);

  // Map of normalized idol names for instant fuzzy/exact name matching
  const idolNameLookup = useMemo(() => {
    const map = new Map<string, Idol>();
    allIdolsList.forEach((idol) => {
      const cleanName = idol.name.trim().toLowerCase();
      map.set(cleanName, idol);
      // Also map with group name e.g. "karina aespa"
      const withGroup = `${cleanName} ${idol.girlGroup.trim().toLowerCase()}`;
      map.set(withGroup, idol);
    });
    return map;
  }, [allIdolsList]);

  // Generate initial bulk text from current groups when modal opens or resets
  const generateCurrentText = () => {
    return localGroups
      .map((g) => {
        const memberNames = g.memberIds
          .map((id) => idolsMap.get(id)?.name || id)
          .join(', ');
        return `${g.name}: ${memberNames}`;
      })
      .join('\n');
  };

  // Helper to match a raw string name to an Idol in the database
  const matchIdolByName = (rawName: string): Idol | null => {
    const cleaned = rawName
      .replace(/^[\d\.\-\)\*•]+\s*/, '') // Remove bullet points or numbers "1. ", "1) "
      .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical notes like "(aespa)"
      .trim()
      .toLowerCase();

    if (!cleaned) return null;

    // 1. Exact match
    if (idolNameLookup.has(cleaned)) {
      return idolNameLookup.get(cleaned)!;
    }

    // 2. Contains match
    for (const [key, idol] of idolNameLookup.entries()) {
      if (key === cleaned || key.startsWith(cleaned) || cleaned.startsWith(key)) {
        return idol;
      }
    }

    // 3. Substring match
    for (const idol of allIdolsList) {
      if (
        idol.name.toLowerCase().includes(cleaned) ||
        cleaned.includes(idol.name.toLowerCase())
      ) {
        return idol;
      }
    }

    return null;
  };

  // Handler: Parse and Apply Bulk Text
  const handleParseAndApplyBulkText = () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setParseNotice({
        type: 'error',
        message: 'Text box is empty. Please paste your group assignments.',
      });
      return;
    }

    const updatedGroups: Group[] = JSON.parse(JSON.stringify(localGroups));
    const matchedCountByGroup: { [groupId: string]: { matched: string[]; unmatched: string[] } } = {};
    let activeGroupIndex = 0;
    const unmatchedNames: string[] = [];

    // Track every idol occurrence during parsing: idolId -> array of locations
    const idolOccurrences = new Map<string, { groupName: string; token: string }[]>();

    // Check if format is "Group A: Name1, Name2..." or section blocks
    let isBlockFormat = lines.some((l) => /^(group\s+[a-z0-9]|pool\s+[a-z0-9]|\[group)/i.test(l));

    if (isBlockFormat) {
      lines.forEach((line) => {
        const groupHeaderMatch = line.match(/^(?:\[)?(group\s+[a-z0-9]+|pool\s+[a-z0-9]+)(?:\])?(?:\:|\-)?\s*(.*)/i);
        if (groupHeaderMatch) {
          const groupNameRaw = groupHeaderMatch[1].trim();
          const inlineMembers = groupHeaderMatch[2].trim();

          // Find matching group index
          const foundIdx = updatedGroups.findIndex(
            (g) => g.name.toLowerCase() === groupNameRaw.toLowerCase()
          );
          if (foundIdx !== -1) {
            activeGroupIndex = foundIdx;
          }

          if (inlineMembers) {
            const rawTokens = inlineMembers
              .split(/[,;\t|]+/)
              .map((t) => t.trim())
              .filter(Boolean);

            const group = updatedGroups[activeGroupIndex];
            if (group) {
              if (!matchedCountByGroup[group.id]) {
                matchedCountByGroup[group.id] = { matched: [], unmatched: [] };
                group.memberIds = [];
              }

              rawTokens.forEach((token) => {
                const matched = matchIdolByName(token);
                if (matched) {
                  const locs = idolOccurrences.get(matched.id) || [];
                  locs.push({ groupName: group.name, token });
                  idolOccurrences.set(matched.id, locs);

                  if (!group.memberIds.includes(matched.id)) {
                    group.memberIds.push(matched.id);
                    matchedCountByGroup[group.id].matched.push(matched.name);
                  }
                } else {
                  matchedCountByGroup[group.id].unmatched.push(token);
                  unmatchedNames.push(token);
                }
              });
            }
          }
        } else {
          // Regular line under current active group
          const group = updatedGroups[activeGroupIndex];
          if (group) {
            if (!matchedCountByGroup[group.id]) {
              matchedCountByGroup[group.id] = { matched: [], unmatched: [] };
              group.memberIds = [];
            }

            const rawTokens = line
              .split(/[,;\t|]+/)
              .map((t) => t.trim())
              .filter(Boolean);

            rawTokens.forEach((token) => {
              const matched = matchIdolByName(token);
              if (matched) {
                const locs = idolOccurrences.get(matched.id) || [];
                locs.push({ groupName: group.name, token });
                idolOccurrences.set(matched.id, locs);

                if (!group.memberIds.includes(matched.id)) {
                  group.memberIds.push(matched.id);
                  matchedCountByGroup[group.id].matched.push(matched.name);
                }
              } else {
                matchedCountByGroup[group.id].unmatched.push(token);
                unmatchedNames.push(token);
              }
            });
          }
        }
      });
    } else {
      // Line by line sequential assignment to groups
      // Or lines of comma-separated names where line 1 = Group A, line 2 = Group B...
      lines.forEach((line, idx) => {
        if (idx < updatedGroups.length) {
          const group = updatedGroups[idx];
          group.memberIds = [];
          matchedCountByGroup[group.id] = { matched: [], unmatched: [] };

          const rawTokens = line
            .split(/[,;\t|]+/)
            .map((t) => t.trim())
            .filter(Boolean);

          rawTokens.forEach((token) => {
            const matched = matchIdolByName(token);
            if (matched) {
              const locs = idolOccurrences.get(matched.id) || [];
              locs.push({ groupName: group.name, token });
              idolOccurrences.set(matched.id, locs);

              if (!group.memberIds.includes(matched.id)) {
                group.memberIds.push(matched.id);
                matchedCountByGroup[group.id].matched.push(matched.name);
              }
            } else {
              matchedCountByGroup[group.id].unmatched.push(token);
              unmatchedNames.push(token);
            }
          });
        }
      });
    }

    // CHECK FOR DUPLICATES: If an idol is matched more than once across groups
    const duplicateErrors: string[] = [];
    idolOccurrences.forEach((locations, id) => {
      if (locations.length > 1) {
        const idol = idolsMap.get(id);
        const name = idol ? `${idol.name} (${idol.girlGroup})` : id;
        const matchingParts = locations.map((loc) => loc.groupName).join(' and ');
        duplicateErrors.push(`"${name}" is entered multiple times in: ${matchingParts}`);
      }
    });

    if (duplicateErrors.length > 0) {
      setParseNotice({
        type: 'error',
        message: `Duplicate Idol Detected! An idol cannot be placed in more than one group or entered multiple times.`,
        details: duplicateErrors,
      });
      setValidationError(`Duplicate not allowed: ${duplicateErrors[0]}`);
      return; // Stop and do not apply duplicate entries!
    }

    setValidationError(null);
    setLocalGroups(updatedGroups);

    const totalAssigned = updatedGroups.reduce((acc, g) => acc + g.memberIds.length, 0);

    if (unmatchedNames.length > 0) {
      setParseNotice({
        type: 'warning',
        message: `Parsed & assigned ${totalAssigned} idols. ${unmatchedNames.length} names could not be found in the database.`,
        details: unmatchedNames.slice(0, 10),
      });
    } else {
      setParseNotice({
        type: 'success',
        message: `Successfully matched and assigned ${totalAssigned} idols across ${updatedGroups.length} groups with 0 duplicates!`,
      });
    }
  };

  // Handler: Change single slot with duplicate prevention
  const handleSetSlotIdol = (groupId: string, slotIndex: number, newIdolId: string) => {
    if (newIdolId) {
      // Check if newIdolId already exists in any group / slot
      for (const g of localGroups) {
        for (let sIdx = 0; sIdx < g.memberIds.length; sIdx++) {
          if (g.memberIds[sIdx] === newIdolId) {
            // If it is the exact same slot, no change
            if (g.id === groupId && sIdx === slotIndex) return;

            const existingIdol = idolsMap.get(newIdolId);
            const idolName = existingIdol ? `${existingIdol.name} (${existingIdol.girlGroup})` : 'This idol';
            setValidationError(
              `Duplicate not allowed: "${idolName}" is already assigned to ${g.name} (Slot ${sIdx + 1}). Every idol in the tournament must be unique.`
            );
            return;
          }
        }
      }
    }

    setValidationError(null);
    const updated = localGroups.map((g) => {
      if (g.id === groupId) {
        const nextMembers = [...g.memberIds];
        if (newIdolId) {
          nextMembers[slotIndex] = newIdolId;
        } else {
          // Remove slot
          nextMembers.splice(slotIndex, 1);
        }
        return { ...g, memberIds: nextMembers };
      }
      return g;
    });
    setLocalGroups(updated);
  };

  // Handler: Add idol to group with duplicate prevention
  const handleAddIdolToGroup = (groupId: string, newIdolId: string) => {
    if (!newIdolId) return;

    // Check if newIdolId already exists in ANY group
    for (const g of localGroups) {
      const existingIdx = g.memberIds.indexOf(newIdolId);
      if (existingIdx !== -1) {
        const existingIdol = idolsMap.get(newIdolId);
        const idolName = existingIdol ? `${existingIdol.name} (${existingIdol.girlGroup})` : 'This idol';
        setValidationError(
          `Duplicate not allowed: "${idolName}" is already assigned to ${g.name} (Slot ${existingIdx + 1}). Every idol in the tournament must be unique.`
        );
        return;
      }
    }

    setValidationError(null);
    const updated = localGroups.map((g) => {
      if (g.id === groupId && !g.memberIds.includes(newIdolId)) {
        return { ...g, memberIds: [...g.memberIds, newIdolId] };
      }
      return g;
    });
    setLocalGroups(updated);
  };

  // Handler: Swap two slots
  const handleSlotClick = (groupId: string, index: number, idolId: string) => {
    setValidationError(null);
    if (!selectedSwapSlot) {
      setSelectedSwapSlot({ groupId, index, idolId });
    } else if (
      selectedSwapSlot.groupId === groupId &&
      selectedSwapSlot.index === index
    ) {
      setSelectedSwapSlot(null);
    } else {
      // Perform swap between selectedSwapSlot and this slot
      const nextGroups = localGroups.map((g) => ({
        ...g,
        memberIds: [...g.memberIds],
      }));

      const srcGroup = nextGroups.find((g) => g.id === selectedSwapSlot.groupId);
      const tgtGroup = nextGroups.find((g) => g.id === groupId);

      if (srcGroup && tgtGroup) {
        const srcIdol = srcGroup.memberIds[selectedSwapSlot.index];
        const tgtIdol = tgtGroup.memberIds[index];

        srcGroup.memberIds[selectedSwapSlot.index] = tgtIdol;
        tgtGroup.memberIds[index] = srcIdol;

        setLocalGroups(nextGroups);
      }
      setSelectedSwapSlot(null);
    }
  };

  // Helper: Clear a specific group
  const handleClearGroup = (groupId: string) => {
    setValidationError(null);
    setLocalGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, memberIds: [] } : g))
    );
  };

  // Helper: Shuffle a specific group
  const handleShuffleGroup = (groupId: string) => {
    setValidationError(null);
    setLocalGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const shuffled = [...g.memberIds].sort(() => Math.random() - 0.5);
          return { ...g, memberIds: shuffled };
        }
        return g;
      })
    );
  };

  // Copy current text to clipboard
  const handleCopyCurrentText = () => {
    const text = generateCurrentText();
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Unassigned idols list
  const assignedIdolIdsSet = useMemo(() => {
    const set = new Set<string>();
    localGroups.forEach((g) => g.memberIds.forEach((id) => set.add(id)));
    return set;
  }, [localGroups]);

  const unassignedIdols = useMemo(() => {
    return allIdolsList.filter((i) => !assignedIdolIdsSet.has(i.id));
  }, [allIdolsList, assignedIdolIdsSet]);

  const handleSave = () => {
    // Final verification check for duplicate idols before saving
    const seen = new Map<string, string>();
    for (const group of localGroups) {
      for (const idolId of group.memberIds) {
        if (!idolId) continue;
        if (seen.has(idolId)) {
          const previousLocation = seen.get(idolId);
          const idol = idolsMap.get(idolId);
          const name = idol ? `${idol.name} (${idol.girlGroup})` : idolId;
          setValidationError(
            `Cannot save: "${name}" is duplicated in ${previousLocation} and ${group.name}. Please remove the duplicate entry.`
          );
          return;
        }
        seen.set(idolId, group.name);
      }
    }

    setValidationError(null);
    onSaveGroups(localGroups);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 p-4 gap-3 bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-indigo-400" />
              <h3 className="text-xl font-black text-white">
                Manual Group Draw &amp; Bulk Matcher
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Easily match your external tournament draw by pasting text or using quick visual slots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCurrentText}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
              title="Copy current group draw as text"
            >
              {copiedSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy Draw Text</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => {
              setActiveTab('paste');
              if (!bulkText) setBulkText(generateCurrentText());
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'paste'
                ? 'bg-slate-900 border-slate-700 text-indigo-400 shadow'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clipboard className="h-4 w-4" />
            <span>Bulk Text / Spreadsheet Paste</span>
          </button>

          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'visual'
                ? 'bg-slate-900 border-slate-700 text-indigo-400 shadow'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Visual Slots &amp; Search ({localGroups.length} Groups)</span>
          </button>
        </div>

        {/* Validation Error Alert Banner */}
        {validationError && (
          <div className="mx-4 mt-3 flex items-start justify-between rounded-xl bg-red-950/80 border-2 border-red-500/80 p-3.5 text-xs text-red-200 font-bold shadow-lg animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-white font-extrabold text-xs">Duplicate Idol Not Allowed</div>
                <div className="text-red-200/90 text-[11px] mt-0.5 font-medium leading-relaxed">
                  {validationError}
                </div>
              </div>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="rounded-lg p-1 text-red-300 hover:bg-red-900/60 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Swap Active Banner */}
        {selectedSwapSlot && (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-xs text-amber-300 font-bold animate-pulse">
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-amber-400" />
              <span>
                Selected{' '}
                <span className="text-white font-extrabold">
                  {idolsMap.get(selectedSwapSlot.idolId)?.name || 'Slot'}
                </span>
                . Click any other slot in any group to swap their positions!
              </span>
            </span>
            <button
              onClick={() => setSelectedSwapSlot(null)}
              className="text-[11px] font-black uppercase text-amber-400 hover:underline"
            >
              Cancel Swap
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          {/* TAB 1: BULK PASTE MODE */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 text-xs text-indigo-200">
                <div className="flex items-center gap-2 font-bold text-white mb-1">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>Instant Match Format Guidelines</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Paste your tournament draw from Excel, Google Sheets, or a text document. You can paste format like:
                </p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-amber-400 font-bold">Option A (Labeled):</span>
                    <pre className="text-slate-300 mt-1 whitespace-pre-wrap">
                      {`Group A: Karina, Winter, Wonyoung, Yujin\nGroup B: Haerin, Minji, Hanni, Danielle`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-amber-400 font-bold">Option B (1 Line per Group):</span>
                    <pre className="text-slate-300 mt-1 whitespace-pre-wrap">
                      {`Karina, Winter, Wonyoung, Yujin\nHaerin, Minji, Hanni, Danielle`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-400" />
                    <span>Paste Group Text Here:</span>
                  </label>
                  <button
                    onClick={() => setBulkText(generateCurrentText())}
                    className="text-[11px] text-indigo-400 hover:underline font-bold"
                  >
                    Reset with Current Group Data
                  </button>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Group A: Karina, Winter, Wonyoung, Yujin\nGroup B: Haerin, Minji, Hanni, Danielle...`}
                  rows={8}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Parse Notice */}
              {parseNotice && (
                <div
                  className={`rounded-xl p-3 border text-xs flex flex-col gap-1 ${
                    parseNotice.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : parseNotice.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {parseNotice.type === 'success' ? (
                      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{parseNotice.message}</span>
                  </div>
                  {parseNotice.details && parseNotice.details.length > 0 && (
                    <div className="text-[11px] text-slate-300 mt-1 pl-6">
                      <span className="font-bold text-amber-400">Unmatched names: </span>
                      {parseNotice.details.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Parse Button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleParseAndApplyBulkText}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Parse &amp; Apply Names to Groups</span>
                </button>
              </div>

              {/* Preview of Parsed Groups */}
              <div className="pt-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Live Preview of Resulting Groups
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {localGroups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="font-black text-xs text-indigo-400">
                          {group.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          {group.memberIds.length} Members
                        </span>
                      </div>
                      <div className="space-y-1">
                        {group.memberIds.length === 0 ? (
                          <div className="text-[11px] text-slate-600 italic py-2 text-center">
                            No idols assigned
                          </div>
                        ) : (
                          group.memberIds.map((idolId, mIdx) => {
                            const idol = idolsMap.get(idolId);
                            return (
                              <div
                                key={`${idolId}-${mIdx}`}
                                className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs"
                              >
                                {idol?.photoUrl ? (
                                  <img
                                    src={idol.photoUrl}
                                    alt={idol.name}
                                    className="h-5 w-5 rounded object-cover border border-slate-700"
                                  />
                                ) : (
                                  <div className="h-5 w-5 rounded bg-slate-800 text-[9px] flex items-center justify-center font-bold text-slate-400">
                                    ?
                                  </div>
                                )}
                                <div className="truncate flex-1">
                                  <span className="font-bold text-white text-[11px] block truncate">
                                    {idol?.name || idolId}
                                  </span>
                                </div>
                                {idol?.seed && (
                                  <span className="text-[9px] text-slate-400 font-bold">
                                    {idol.seed.replace('Seed ', 'S')}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISUAL SLOTS & SEARCH */}
          {activeTab === 'visual' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localGroups.map((group) => (
                  <div
                    key={group.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3 shadow-lg"
                  >
                    {/* Group Header & Actions */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-indigo-400">
                          {group.name}
                        </span>
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-800">
                          {group.memberIds.length} Members
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleShuffleGroup(group.id)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Shuffle Group"
                        >
                          <Shuffle className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearGroup(group.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                          title="Clear Group"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Member Slots */}
                    <div className="space-y-2">
                      {group.memberIds.map((idolId, slotIdx) => {
                        const idol = idolsMap.get(idolId);
                        const isSelected =
                          selectedSwapSlot?.groupId === group.id &&
                          selectedSwapSlot?.index === slotIdx;

                        return (
                          <div
                            key={`${group.id}-${slotIdx}`}
                            className={`flex items-center justify-between gap-2 p-2 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Clickable Card for Swap */}
                            <div
                              className="flex items-center gap-2.5 flex-1 cursor-pointer min-w-0"
                              onClick={() => handleSlotClick(group.id, slotIdx, idolId)}
                              title="Click to select for swapping"
                            >
                              <span className="text-[10px] font-black text-slate-500 w-4 text-center">
                                {slotIdx + 1}
                              </span>

                              {idol?.photoUrl ? (
                                <img
                                  src={idol.photoUrl}
                                  alt={idol.name}
                                  className="h-8 w-8 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold flex-shrink-0">
                                  ?
                                </div>
                              )}

                              <div className="truncate">
                                <span className="font-extrabold text-xs text-white block truncate">
                                  {idol?.name || idolId}
                                </span>
                                <span className="text-[10px] text-slate-400 block truncate font-medium">
                                  {idol?.girlGroup || 'Solo'} &bull; {idol?.seed || 'Unseeded'}
                                </span>
                              </div>
                            </div>

                            {/* Slot Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {/* Searchable Select to change this slot */}
                              <div className="w-36">
                                <SearchableIdolSelect
                                  idols={allIdolsList}
                                  selectedIdolId={idolId}
                                  onSelectIdol={(newId) =>
                                    handleSetSlotIdol(group.id, slotIdx, newId)
                                  }
                                  placeholder="Change..."
                                  size="sm"
                                  accentColor="indigo"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSetSlotIdol(group.id, slotIdx, '')}
                                className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                title="Remove from Group"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Member Row */}
                      <div className="pt-1">
                        <SearchableIdolSelect
                          idols={allIdolsList}
                          selectedIdolId=""
                          onSelectIdol={(newId) => handleAddIdolToGroup(group.id, newId)}
                          placeholder={`+ Add idol to ${group.name}...`}
                          size="sm"
                          accentColor="emerald"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Unassigned Idols Bench */}
              {unassignedIdols.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-amber-400" />
                      <h4 className="font-extrabold text-xs text-white">
                        Available Idols in Database ({unassignedIdols.length} not in any group)
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Click any idol to add to the first group with space
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {unassignedIdols.slice(0, 50).map((idol) => (
                      <button
                        key={idol.id}
                        type="button"
                        onClick={() => {
                          // Add to the group with fewest members
                          const minGroup = [...localGroups].sort(
                            (a, b) => a.memberIds.length - b.memberIds.length
                          )[0];
                          if (minGroup) {
                            handleAddIdolToGroup(minGroup.id, idol.id);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-300 hover:border-indigo-500 hover:text-white hover:bg-slate-800 transition-all"
                      >
                        {idol.photoUrl ? (
                          <img
                            src={idol.photoUrl}
                            alt={idol.name}
                            className="h-4 w-4 rounded object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-4 w-4 rounded bg-slate-800 flex items-center justify-center text-[8px] font-bold text-amber-300">
                            {(idol.name || 'ID').slice(0, 1)}
                          </div>
                        )}
                        <span>{idol.name}</span>
                        <span className="text-[9px] text-slate-500">
                          ({idol.girlGroup})
                        </span>
                        <Plus className="h-3 w-3 text-indigo-400 ml-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 p-4 bg-slate-950/90">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-xs font-black text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 hover:scale-[1.02] transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Save &amp; Apply Group Assignments</span>
          </button>
        </div>
      </div>
    </div>
  );
};
