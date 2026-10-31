import React from 'react';
import { RotateCcw, AlertTriangle, X, RefreshCw, Undo2, Trash2 } from 'lucide-react';

interface ResetSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  seasonName: string;
  hasGroups: boolean;
  hasKnockout: boolean;
  onResetGroupScoresOnly?: () => void;
  onResetEntireSeason?: () => void;
  onResetKnockoutOnly?: () => void;
}

export const ResetSeasonModal: React.FC<ResetSeasonModalProps> = ({
  isOpen,
  onClose,
  seasonName,
  hasGroups,
  hasKnockout,
  onResetGroupScoresOnly,
  onResetEntireSeason,
  onResetKnockoutOnly,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-3 border-black bg-[#1c1510] poster-shadow-lg p-6 space-y-5">
        {/* Header Strip */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 border border-black text-amber-100">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-poster-title text-lg text-amber-300">
                Reset Matches &amp; Scores
              </h3>
              <p className="text-[11px] text-amber-200/70 font-bold">
                {seasonName} active tournament workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-amber-300 hover:bg-red-950 border-2 border-black transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info Notice */}
        <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3.5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed font-bold">
            <span className="text-amber-300 font-black block mb-0.5">
              Group Draws &amp; Idol Rosters Are Kept Safe:
            </span>
            Resetting match scores wipes entered results back to unplayed (0-0) so you can fix mistakes. Your idol group assignments and participants stay exactly in place.
          </div>
        </div>

        {/* Reset Actions Options */}
        <div className="space-y-3">
          {/* Primary Action: Reset Match Scores (Preserve Groups) */}
          {hasGroups && onResetGroupScoresOnly && (
            <button
              type="button"
              onClick={() => {
                onResetGroupScoresOnly();
                onClose();
              }}
              className="w-full flex items-start gap-3 rounded-xl border-2 border-amber-600 bg-[#282018] p-4 text-left hover:bg-amber-950/60 transition-colors group poster-shadow-sm"
            >
              <RefreshCw className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5 group-hover:rotate-180 transition-transform duration-500" />
              <div>
                <div className="text-xs font-black text-amber-300 uppercase tracking-wide">
                  Reset All Match Scores (Keep Group Draw)
                </div>
                <div className="text-[11px] text-amber-200/80 mt-0.5 font-bold">
                  Clears all match scores to unplayed (0-0) and resets standings. All idols remain in their current groups.
                </div>
              </div>
            </button>
          )}

          {/* Option 2: Reset Knockout Bracket */}
          {hasKnockout && onResetKnockoutOnly && (
            <button
              type="button"
              onClick={() => {
                onResetKnockoutOnly();
                onClose();
              }}
              className="w-full flex items-start gap-3 rounded-xl border-2 border-purple-600/60 bg-[#241a28] p-3.5 text-left hover:bg-purple-950/40 transition-colors group poster-shadow-sm"
            >
              <Undo2 className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5 group-hover:-translate-x-1 transition-transform" />
              <div>
                <div className="text-xs font-black text-purple-300 uppercase tracking-wide">
                  Reset Bracket &amp; Reopen Group Stage
                </div>
                <div className="text-[11px] text-amber-200/70 mt-0.5 font-bold">
                  Discards the knockout bracket and re-opens the group stage so you can adjust group match scores.
                </div>
              </div>
            </button>
          )}

          {/* Option 3: Full Wipe (Optional) */}
          {onResetEntireSeason && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to completely redraw groups and wipe active season workspace?`)) {
                  onResetEntireSeason();
                  onClose();
                }
              }}
              className="w-full flex items-start gap-3 rounded-xl border-2 border-red-800/60 bg-red-950/30 p-3 text-left hover:bg-red-900/40 transition-colors group"
            >
              <Trash2 className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div>
                <div className="text-[11px] font-black text-red-300 uppercase tracking-wide">
                  Redraw Groups / Full Season Restart
                </div>
                <div className="text-[10px] text-amber-200/60 mt-0.5 font-bold">
                  Discard current group draw completely and re-select participants.
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t-2 border-black">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-black bg-[#282018] px-5 py-2 text-xs font-black text-amber-200 hover:bg-red-950 transition-colors poster-shadow-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
