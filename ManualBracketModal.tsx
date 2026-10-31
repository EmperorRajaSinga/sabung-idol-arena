import React, { useState, useMemo } from 'react';
import { KnockoutMatch, Idol, Group } from '../types';
import {
  X,
  Swords,
  ArrowRightLeft,
  Save,
  RefreshCw,
  Clipboard,
  FileText,
  LayoutGrid,
  Check,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Trash2,
  Shuffle,
  Copy,
  Plus,
} from 'lucide-react';
import { SearchableIdolSelect } from './SearchableIdolSelect';

interface ManualBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  knockoutMatches: KnockoutMatch[];
  idolsMap: Map<string, Idol>;
  onSaveKnockoutMatches: (updatedMatches: KnockoutMatch[]) => void;
  onRegenerateAutoBracket: () => void;
}

export const ManualBracketModal: React.FC<ManualBracketModalProps> = ({
  isOpen,
  onClose,
  knockoutMatches,
  idolsMap,
  onSaveKnockoutMatches,
  onRegenerateAutoBracket,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'visual'>('paste');
  const [localMatches, setLocalMatches] = useState<KnockoutMatch[]>(() =>
    JSON.parse(JSON.stringify(knockoutMatches || []))
  );

  const [swapSource, setSwapSource] = useState<{
    matchId: string;
    slot: 'A' | 'B';
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

  // Map of normalized idol names for instant matching
  const idolNameLookup = useMemo(() => {
    const map = new Map<string, Idol>();
    allIdolsList.forEach((idol) => {
      const cleanName = idol.name.trim().toLowerCase();
      map.set(cleanName, idol);
      const withGroup = `${cleanName} ${idol.girlGroup.trim().toLowerCase()}`;
      map.set(withGroup, idol);
    });
    return map;
  }, [allIdolsList]);

  // Filter first-round or editable matches (roundIndex 0 or 1)
  const minRoundIndex = useMemo(() => {
    if (!localMatches || localMatches.length === 0) return 0;
    return Math.min(...localMatches.map((m) => m.roundIndex));
  }, [localMatches]);

  const editableMatches = useMemo(() => {
    return localMatches.filter(
      (m) => m.roundIndex === minRoundIndex || m.roundIndex === minRoundIndex + 1
    );
  }, [localMatches, minRoundIndex]);

  // Helper to match string name to Idol
  const matchIdolByName = (rawName: string): Idol | null => {
    const cleaned = rawName
      .replace(/^[\d\.\-\)\*•]+\s*/, '')
      .replace(/\s*\([^)]*\)/g, '')
      .trim()
      .toLowerCase();

    if (!cleaned) return null;

    if (idolNameLookup.has(cleaned)) {
      return idolNameLookup.get(cleaned)!;
    }

    for (const [key, idol] of idolNameLookup.entries()) {
      if (key === cleaned || key.startsWith(cleaned) || cleaned.startsWith(key)) {
        return idol;
      }
    }

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

  // Generate current text representation
  const generateCurrentText = () => {
    return editableMatches
      .map((m, idx) => {
        const nameA = idolsMap.get(m.idolAId || '')?.name || 'TBD';
        const nameB = idolsMap.get(m.idolBId || '')?.name || 'TBD';
        return `Match ${idx + 1}: ${nameA} vs ${nameB}`;
      })
      .join('\n');
  };

  if (!isOpen) return null;

  // Handler: Bulk Text Parse
  const handleParseAndApplyBulkText = () => {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setParseNotice({
        type: 'error',
        message: 'Text area is empty. Please paste your matchups.',
      });
      return;
    }

    const updatedMatches = [...localMatches];
    const unmatchedNames: string[] = [];
    let matchedPairsCount = 0;

    // Track every idol occurrence: idolId -> array of locations
    const idolOccurrences = new Map<string, string[]>();
    const duplicateErrors: string[] = [];

    // Check if lines contain 'vs', '-', or are single names per line
    const isVsFormat = lines.some((l) => /\bvs\b|\bv\.s\b| - | : |,/i.test(l));

    if (isVsFormat) {
      lines.forEach((line, idx) => {
        if (idx < editableMatches.length) {
          const matchToUpdate = editableMatches[idx];
          const targetIdxInAll = updatedMatches.findIndex((m) => m.id === matchToUpdate.id);
          if (targetIdxInAll === -1) return;

          const matchLabel = `Match ${matchToUpdate.matchNumber || idx + 1}`;

          // Strip "Match 1:", "M1:", "1.", etc.
          const cleanLine = line.replace(/^(?:match\s+\d+|m\d+|\d+[\.\)\:])\s*/i, '');
          const tokens = cleanLine.split(/\s+vs\.?\s+|\s*-\s*|\s*,\s*|\s*:\s*/i).map((t) => t.trim()).filter(Boolean);

          const rawA = tokens[0] || '';
          const rawB = tokens[1] || '';

          const idolA = rawA ? matchIdolByName(rawA) : null;
          const idolB = rawB ? matchIdolByName(rawB) : null;

          if (rawA && !idolA) unmatchedNames.push(rawA);
          if (rawB && !idolB) unmatchedNames.push(rawB);

          if (idolA && idolB && idolA.id === idolB.id) {
            duplicateErrors.push(`"${idolA.name} (${idolA.girlGroup})" cannot compete against herself in ${matchLabel}.`);
          }

          if (idolA) {
            const locs = idolOccurrences.get(idolA.id) || [];
            locs.push(`${matchLabel} (Slot A)`);
            idolOccurrences.set(idolA.id, locs);
          }

          if (idolB) {
            const locs = idolOccurrences.get(idolB.id) || [];
            locs.push(`${matchLabel} (Slot B)`);
            idolOccurrences.set(idolB.id, locs);
          }

          updatedMatches[targetIdxInAll] = {
            ...updatedMatches[targetIdxInAll],
            idolAId: idolA?.id || null,
            idolBId: idolB?.id || null,
          };
          matchedPairsCount++;
        }
      });
    } else {
      // 2 consecutive lines per match (e.g. Line 1 = Match 1 A, Line 2 = Match 1 B...)
      for (let i = 0; i < editableMatches.length; i++) {
        const matchToUpdate = editableMatches[i];
        const targetIdxInAll = updatedMatches.findIndex((m) => m.id === matchToUpdate.id);
        if (targetIdxInAll === -1) continue;

        const matchLabel = `Match ${matchToUpdate.matchNumber || i + 1}`;

        const rawA = lines[i * 2] || '';
        const rawB = lines[i * 2 + 1] || '';

        const idolA = rawA ? matchIdolByName(rawA) : null;
        const idolB = rawB ? matchIdolByName(rawB) : null;

        if (rawA && !idolA) unmatchedNames.push(rawA);
        if (rawB && !idolB) unmatchedNames.push(rawB);

        if (idolA && idolB && idolA.id === idolB.id) {
          duplicateErrors.push(`"${idolA.name} (${idolA.girlGroup})" cannot compete against herself in ${matchLabel}.`);
        }

        if (idolA) {
          const locs = idolOccurrences.get(idolA.id) || [];
          locs.push(`${matchLabel} (Slot A)`);
          idolOccurrences.set(idolA.id, locs);
        }

        if (idolB) {
          const locs = idolOccurrences.get(idolB.id) || [];
          locs.push(`${matchLabel} (Slot B)`);
          idolOccurrences.set(idolB.id, locs);
        }

        updatedMatches[targetIdxInAll] = {
          ...updatedMatches[targetIdxInAll],
          idolAId: idolA?.id || null,
          idolBId: idolB?.id || null,
        };
        matchedPairsCount++;
      }
    }

    // Check for duplicate idols across matches
    idolOccurrences.forEach((locations, id) => {
      if (locations.length > 1) {
        const idol = idolsMap.get(id);
        const name = idol ? `${idol.name} (${idol.girlGroup})` : id;
        duplicateErrors.push(`"${name}" is entered multiple times in: ${locations.join(' and ')}`);
      }
    });

    if (duplicateErrors.length > 0) {
      setParseNotice({
        type: 'error',
        message: `Duplicate Idol Detected! Each idol can only be placed in a single matchup slot.`,
        details: duplicateErrors,
      });
      setValidationError(`Duplicate not allowed: ${duplicateErrors[0]}`);
      return; // Do not apply duplicate matches!
    }

    setValidationError(null);
    setLocalMatches(updatedMatches);

    if (unmatchedNames.length > 0) {
      setParseNotice({
        type: 'warning',
        message: `Parsed ${matchedPairsCount} matches. ${unmatchedNames.length} names could not be found in the database.`,
        details: unmatchedNames.slice(0, 10),
      });
    } else {
      setParseNotice({
        type: 'success',
        message: `Successfully matched and assigned ${matchedPairsCount} matchups to the bracket with 0 duplicates!`,
      });
    }
  };

  // Handler: Set single slot idol with duplicate check
  const handleSetIdolInSlot = (matchId: string, slot: 'A' | 'B', newIdolId: string) => {
    if (newIdolId) {
      // Check if newIdolId already exists in any editable matchup
      for (const m of editableMatches) {
        const matchLabel = `Match ${m.matchNumber || m.id}`;
        if (m.id === matchId) {
          const oppositeId = slot === 'A' ? m.idolBId : m.idolAId;
          if (oppositeId === newIdolId) {
            const idol = idolsMap.get(newIdolId);
            const idolName = idol ? `${idol.name} (${idol.girlGroup})` : 'This idol';
            setValidationError(`Duplicate not allowed: "${idolName}" is already placed on the opposite side of ${matchLabel}. An idol cannot play against herself.`);
            return;
          }
        } else {
          if (m.idolAId === newIdolId) {
            const idol = idolsMap.get(newIdolId);
            const idolName = idol ? `${idol.name} (${idol.girlGroup})` : 'This idol';
            setValidationError(`Duplicate not allowed: "${idolName}" is already assigned to ${matchLabel} (Slot A).`);
            return;
          }
          if (m.idolBId === newIdolId) {
            const idol = idolsMap.get(newIdolId);
            const idolName = idol ? `${idol.name} (${idol.girlGroup})` : 'This idol';
            setValidationError(`Duplicate not allowed: "${idolName}" is already assigned to ${matchLabel} (Slot B).`);
            return;
          }
        }
      }
    }

    setValidationError(null);
    const updated = localMatches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          idolAId: slot === 'A' ? (newIdolId || null) : m.idolAId,
          idolBId: slot === 'B' ? (newIdolId || null) : m.idolBId,
        };
      }
      return m;
    });
    setLocalMatches(updated);
  };

  // Handler: Invert/Swap Slot A and Slot B inside same match
  const handleInvertMatchSides = (matchId: string) => {
    setValidationError(null);
    const updated = localMatches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          idolAId: m.idolBId,
          idolBId: m.idolAId,
        };
      }
      return m;
    });
    setLocalMatches(updated);
  };

  // Handler: Swap between any two slots
  const handleSelectSlotForSwap = (matchId: string, slot: 'A' | 'B', idolId: string | null) => {
    setValidationError(null);
    if (!swapSource) {
      if (!idolId) return;
      setSwapSource({ matchId, slot, idolId });
    } else if (swapSource.matchId === matchId && swapSource.slot === slot) {
      setSwapSource(null);
    } else {
      // Swap source and target
      const updated = localMatches.map((m) => {
        let newA = m.idolAId;
        let newB = m.idolBId;

        if (m.id === swapSource.matchId) {
          if (swapSource.slot === 'A') newA = idolId;
          else newB = idolId;
        }

        if (m.id === matchId) {
          if (slot === 'A') newA = swapSource.idolId;
          else newB = swapSource.idolId;
        }

        return { ...m, idolAId: newA, idolBId: newB };
      });

      setLocalMatches(updated);
      setSwapSource(null);
    }
  };

  // Helper: Shuffle first round matchups
  const handleShuffleBracket = () => {
    setValidationError(null);
    const currentIdols: string[] = [];
    editableMatches.forEach((m) => {
      if (m.idolAId) currentIdols.push(m.idolAId);
      if (m.idolBId) currentIdols.push(m.idolBId);
    });

    const shuffled = [...currentIdols].sort(() => Math.random() - 0.5);
    let ptr = 0;

    const updated = localMatches.map((m) => {
      if (editableMatches.some((em) => em.id === m.id)) {
        const newA = shuffled[ptr++] || null;
        const newB = shuffled[ptr++] || null;
        return { ...m, idolAId: newA, idolBId: newB };
      }
      return m;
    });

    setLocalMatches(updated);
  };

  // Helper: Clear all slots
  const handleClearAllSlots = () => {
    setValidationError(null);
    const updated = localMatches.map((m) => {
      if (editableMatches.some((em) => em.id === m.id)) {
        return { ...m, idolAId: null, idolBId: null };
      }
      return m;
    });
    setLocalMatches(updated);
  };

  // Copy current text
  const handleCopyCurrentText = () => {
    const text = generateCurrentText();
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  const handleSave = () => {
    // Final duplicate check across editable matches before saving
    const seen = new Map<string, string>();
    for (const m of editableMatches) {
      const matchLabel = `Match ${m.matchNumber || m.id}`;
      if (m.idolAId) {
        if (seen.has(m.idolAId)) {
          const prevLoc = seen.get(m.idolAId);
          const idol = idolsMap.get(m.idolAId);
          const name = idol ? `${idol.name} (${idol.girlGroup})` : m.idolAId;
          setValidationError(`Cannot save: "${name}" is duplicated in ${prevLoc} and ${matchLabel} (Slot A).`);
          return;
        }
        seen.set(m.idolAId, `${matchLabel} (Slot A)`);
      }
      if (m.idolBId) {
        if (seen.has(m.idolBId)) {
          const prevLoc = seen.get(m.idolBId);
          const idol = idolsMap.get(m.idolBId);
          const name = idol ? `${idol.name} (${idol.girlGroup})` : m.idolBId;
          setValidationError(`Cannot save: "${name}" is duplicated in ${prevLoc} and ${matchLabel} (Slot B).`);
          return;
        }
        seen.set(m.idolBId, `${matchLabel} (Slot B)`);
      }
    }

    setValidationError(null);
    onSaveKnockoutMatches(localMatches);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 p-4 gap-3 bg-slate-950/70">
          <div>
            <div className="flex items-center gap-2">
              <Swords className="h-6 w-6 text-purple-400" />
              <h3 className="text-xl font-black text-white">
                Manual Knockout Bracket &amp; Matchup Matcher
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Paste your bracket matchups directly from your spreadsheet/notes or quickly configure match slots.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCurrentText}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
              title="Copy bracket matchups as text"
            >
              {copiedSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy Matchups</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                onRegenerateAutoBracket();
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Auto Re-Seed</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-slate-800/80 bg-slate-950/40">
          <button
            onClick={() => {
              setActiveTab('paste');
              if (!bulkText) setBulkText(generateCurrentText());
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'paste'
                ? 'bg-slate-900 border-slate-700 text-purple-400 shadow'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clipboard className="h-4 w-4" />
            <span>Bulk Matchup Text Paste</span>
          </button>

          <button
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'visual'
                ? 'bg-slate-900 border-slate-700 text-purple-400 shadow'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Visual Matchup Cards ({editableMatches.length} Matches)</span>
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

        {/* Swap Banner */}
        {swapSource && (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-xs text-amber-300 font-bold animate-pulse">
            <span className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-amber-400" />
              <span>
                Swapping{' '}
                <span className="text-white font-extrabold">
                  {idolsMap.get(swapSource.idolId)?.name || 'Slot'}
                </span>
                . Click any other slot to swap positions!
              </span>
            </span>
            <button
              onClick={() => setSwapSource(null)}
              className="text-[11px] font-black uppercase text-amber-400 hover:underline"
            >
              Cancel Swap
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          {/* TAB 1: BULK MATCHUPS PASTE */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 text-xs text-purple-200">
                <div className="flex items-center gap-2 font-bold text-white mb-1">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>Knockout Matchup Paste Guidelines</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Paste your bracket matchups in any standard format. The system will automatically parse names and match them with idol profiles.
                </p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-amber-400 font-bold">Option A ("vs" format):</span>
                    <pre className="text-slate-300 mt-1 whitespace-pre-wrap">
                      {`Karina vs Wonyoung\nWinter vs Yujin\nHaerin vs Minji`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-amber-400 font-bold">Option B (Bracket list):</span>
                    <pre className="text-slate-300 mt-1 whitespace-pre-wrap">
                      {`Match 1: Karina vs Wonyoung\nMatch 2: Winter vs Yujin`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Text Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-purple-400" />
                    <span>Paste Bracket Matchups Here:</span>
                  </label>
                  <button
                    onClick={() => setBulkText(generateCurrentText())}
                    className="text-[11px] text-purple-400 hover:underline font-bold"
                  >
                    Reset with Current Bracket Data
                  </button>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Karina vs Wonyoung\nWinter vs Yujin\nHaerin vs Minji...`}
                  rows={8}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Notice */}
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

              {/* Action */}
              <div>
                <button
                  type="button"
                  onClick={handleParseAndApplyBulkText}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-black text-white hover:bg-purple-500 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Parse &amp; Apply Matchups to Bracket</span>
                </button>
              </div>

              {/* Live Preview Cards */}
              <div className="pt-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                  Live Preview of Bracket Matchups ({editableMatches.length} Matches)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editableMatches.map((m, idx) => {
                    const idolA = idolsMap.get(m.idolAId || '');
                    const idolB = idolsMap.get(m.idolBId || '');

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 w-5/12 min-w-0">
                          {idolA?.photoUrl ? (
                            <img
                              src={idolA.photoUrl}
                              alt={idolA.name}
                              className="h-7 w-7 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-bold flex-shrink-0">
                              ?
                            </div>
                          )}
                          <div className="truncate">
                            <span className="font-bold text-white block truncate text-xs">
                              {idolA?.name || 'TBD'}
                            </span>
                            <span className="text-[9px] text-slate-400 block truncate">
                              {idolA?.girlGroup || 'Slot A'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center w-2/12 flex-shrink-0">
                          <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                            M{idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 w-5/12 min-w-0 text-right">
                          <div className="truncate">
                            <span className="font-bold text-white block truncate text-xs">
                              {idolB?.name || 'TBD'}
                            </span>
                            <span className="text-[9px] text-slate-400 block truncate">
                              {idolB?.girlGroup || 'Slot B'}
                            </span>
                          </div>
                          {idolB?.photoUrl ? (
                            <img
                              src={idolB.photoUrl}
                              alt={idolB.name}
                              className="h-7 w-7 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-bold flex-shrink-0">
                              ?
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VISUAL MATCHUP CARDS */}
          {activeTab === 'visual' && (
            <div className="space-y-4">
              {/* Top Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300">
                  {editableMatches.length} First Round Knockout Matches
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShuffleBracket}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-purple-400" />
                    <span>Shuffle Matchups</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAllSlots}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-red-400 hover:bg-red-950/40 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              {/* Matchup Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editableMatches.map((match, idx) => {
                  const idolA = idolsMap.get(match.idolAId || '');
                  const idolB = idolsMap.get(match.idolBId || '');

                  const isSelectedA =
                    swapSource?.matchId === match.id && swapSource?.slot === 'A';
                  const isSelectedB =
                    swapSource?.matchId === match.id && swapSource?.slot === 'B';

                  return (
                    <div
                      key={match.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3 shadow-lg"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black text-purple-400">
                          {match.roundName} &bull; Match {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleInvertMatchSides(match.id)}
                          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 px-2 py-0.5 rounded transition-colors"
                          title="Invert Slot A and Slot B"
                        >
                          <ArrowRightLeft className="h-3 w-3" />
                          <span>Flip Sides</span>
                        </button>
                      </div>

                      {/* Slot A */}
                      <div
                        className={`p-2.5 rounded-xl border transition-all ${
                          isSelectedA
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                            onClick={() =>
                              handleSelectSlotForSwap(match.id, 'A', match.idolAId)
                            }
                            title="Click to swap slot"
                          >
                            {idolA?.photoUrl ? (
                              <img
                                src={idolA.photoUrl}
                                alt={idolA.name}
                                className="h-8 w-8 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-bold flex-shrink-0">
                                TBD
                              </div>
                            )}
                            <div className="truncate">
                              <span className="text-xs font-black text-white block truncate">
                                {idolA?.name || 'To Be Determined'}
                              </span>
                              <span className="text-[10px] text-indigo-400 font-medium block truncate">
                                {idolA?.girlGroup || 'Slot A'}
                              </span>
                            </div>
                          </div>

                          <div className="w-40 flex-shrink-0">
                            <SearchableIdolSelect
                              idols={allIdolsList}
                              selectedIdolId={match.idolAId || ''}
                              onSelectIdol={(newId) =>
                                handleSetIdolInSlot(match.id, 'A', newId)
                              }
                              placeholder="Search idol..."
                              size="sm"
                              accentColor="indigo"
                            />
                          </div>
                        </div>
                      </div>

                      {/* VS Divider */}
                      <div className="flex items-center justify-center gap-2 text-center text-[10px] font-black text-slate-500 uppercase">
                        <div className="h-px flex-1 bg-slate-800" />
                        <span>VS</span>
                        <div className="h-px flex-1 bg-slate-800" />
                      </div>

                      {/* Slot B */}
                      <div
                        className={`p-2.5 rounded-xl border transition-all ${
                          isSelectedB
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                            onClick={() =>
                              handleSelectSlotForSwap(match.id, 'B', match.idolBId)
                            }
                            title="Click to swap slot"
                          >
                            {idolB?.photoUrl ? (
                              <img
                                src={idolB.photoUrl}
                                alt={idolB.name}
                                className="h-8 w-8 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 font-bold flex-shrink-0">
                                TBD
                              </div>
                            )}
                            <div className="truncate">
                              <span className="text-xs font-black text-white block truncate">
                                {idolB?.name || 'To Be Determined'}
                              </span>
                              <span className="text-[10px] text-purple-400 font-medium block truncate">
                                {idolB?.girlGroup || 'Slot B'}
                              </span>
                            </div>
                          </div>

                          <div className="w-40 flex-shrink-0">
                            <SearchableIdolSelect
                              idols={allIdolsList}
                              selectedIdolId={match.idolBId || ''}
                              onSelectIdol={(newId) =>
                                handleSetIdolInSlot(match.id, 'B', newId)
                              }
                              placeholder="Search idol..."
                              size="sm"
                              accentColor="purple"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-2 text-xs font-black text-white hover:bg-purple-500 shadow-lg shadow-purple-600/30 hover:scale-[1.02] transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Save &amp; Apply Bracket Matchups</span>
          </button>
        </div>
      </div>
    </div>
  );
};
