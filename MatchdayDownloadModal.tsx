import React, { useState, useRef, useMemo, useEffect } from 'react';
import { LeagueInfo, Idol, LeagueMatch, LeagueSeasonState } from '../types';
import {
  Download,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Image as ImageIcon,
  Share2,
  Calendar,
  Trophy,
  Sparkles,
  Flame,
} from 'lucide-react';
import { RatingBadge } from './RatingBadge';

interface MatchdayDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagues?: LeagueInfo[];
  leagueState?: LeagueSeasonState;
  idols: Idol[];
  selectedLeagueId?: number | string;
  initialLeagueId?: number | string;
  initialMatchday?: number;
  seasonNumber?: number;
  // Optional custom matches/title for non-league formats (e.g. The Idols, Group Stage)
  customTitle?: string;
  customMatches?: LeagueMatch[];
  customTotalMatchdays?: number;
}

export const MatchdayDownloadModal: React.FC<MatchdayDownloadModalProps> = ({
  isOpen,
  onClose,
  leagues: rawLeagues,
  leagueState,
  idols,
  selectedLeagueId: propSelectedLeagueId,
  initialLeagueId,
  initialMatchday = 1,
  seasonNumber = 1,
  customTitle,
  customMatches,
  customTotalMatchdays,
}) => {
  const leagues = useMemo(() => {
    if (rawLeagues && rawLeagues.length > 0) return rawLeagues;
    if (leagueState?.leagues && leagueState.leagues.length > 0) return leagueState.leagues;
    return [];
  }, [rawLeagues, leagueState]);

  const initLeagueId = propSelectedLeagueId ?? initialLeagueId ?? leagues[0]?.id ?? 1;
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | string>(initLeagueId);
  const [selectedMatchday, setSelectedMatchday] = useState<number>(initialMatchday);
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'text'>('preview');

  // Quick lookup for idols
  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((idol) => map.set(idol.id, idol));
    return map;
  }, [idols]);

  // Determine current league
  const currentLeague = useMemo(() => {
    return leagues.find((l) => String(l.id) === String(selectedLeagueId)) || leagues[0];
  }, [leagues, selectedLeagueId]);

  // Matches pool: custom matches OR current league matches
  const allMatches: LeagueMatch[] = useMemo(() => {
    if (customMatches && customMatches.length > 0) return customMatches;
    return currentLeague?.matches || [];
  }, [customMatches, currentLeague]);

  // Total matchdays
  const totalMatchdays = useMemo(() => {
    if (customTotalMatchdays && customTotalMatchdays > 0) return customTotalMatchdays;
    if (allMatches.length === 0) return 38;
    return Math.max(...allMatches.map((m) => m.matchday || 1), 1);
  }, [customTotalMatchdays, allMatches]);

  // Filter matches for the selected matchday
  const matchdayMatches = useMemo(() => {
    return allMatches.filter((m) => m.matchday === selectedMatchday);
  }, [allMatches, selectedMatchday]);

  // Calculate summary stats for the matchday
  const completedCount = matchdayMatches.filter((m) => m.completed).length;
  const isMatchdayFinished = matchdayMatches.length > 0 && completedCount === matchdayMatches.length;
  const totalGoals = matchdayMatches.reduce((acc, m) => {
    if (m.completed) {
      return acc + (m.scoreA || 0) + (m.scoreB || 0);
    }
    return acc;
  }, 0);

  const titleText = customTitle || currentLeague?.name || 'League System';

  // Sync state if props change
  useEffect(() => {
    if (initialLeagueId) setSelectedLeagueId(initialLeagueId);
    if (initialMatchday) setSelectedMatchday(initialMatchday);
  }, [initialLeagueId, initialMatchday]);

  if (!isOpen) return null;

  // 1. Export CSV Handler
  const handleExportCSV = () => {
    const headers = [
      'Matchday',
      'Match #',
      'Idol A Name',
      'Idol A Group',
      'Idol A Rating',
      'Score A',
      'Score B',
      'Idol B Rating',
      'Idol B Group',
      'Idol B Name',
      'Winner',
      'Status',
    ];

    const rows = matchdayMatches.map((m, idx) => {
      const idolA = idolsMap.get(m.idolAId);
      const idolB = idolsMap.get(m.idolBId);
      const nameA = idolA?.name || 'Unknown A';
      const nameB = idolB?.name || 'Unknown B';
      const groupA = idolA?.girlGroup || 'Independent';
      const groupB = idolB?.girlGroup || 'Independent';
      const rtgA = idolA?.rating || 75;
      const rtgB = idolB?.rating || 75;

      let winner = 'None';
      if (m.completed) {
        if ((m.scoreA || 0) > (m.scoreB || 0)) winner = nameA;
        else if ((m.scoreB || 0) > (m.scoreA || 0)) winner = nameB;
        else winner = 'Draw';
      }

      return [
        selectedMatchday,
        idx + 1,
        `"${nameA.replace(/"/g, '""')}"`,
        `"${groupA.replace(/"/g, '""')}"`,
        rtgA,
        m.completed ? m.scoreA : '',
        m.completed ? m.scoreB : '',
        rtgB,
        `"${groupB.replace(/"/g, '""')}"`,
        `"${nameB.replace(/"/g, '""')}"`,
        `"${winner.replace(/"/g, '""')}"`,
        m.completed ? 'Completed' : 'Scheduled',
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = titleText.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `${safeTitle}_Matchday_${selectedMatchday}_Fixtures.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 2. Format Plain Text / Discord Handler
  const generateTextSummary = () => {
    let text = `========================================================\n`;
    text += `🏆 SABUNG IDOL ARENA • ${titleText.toUpperCase()}\n`;
    text += `📅 MATCHDAY ${selectedMatchday} OF ${totalMatchdays} • SEASON ${seasonNumber}\n`;
    text += `📊 Status: ${completedCount}/${matchdayMatches.length} Completed | Total Goals: ${totalGoals}\n`;
    text += `========================================================\n\n`;

    matchdayMatches.forEach((m, idx) => {
      const idolA = idolsMap.get(m.idolAId);
      const idolB = idolsMap.get(m.idolBId);
      const nameA = idolA?.name || 'Unknown A';
      const nameB = idolB?.name || 'Unknown B';
      const groupA = idolA?.girlGroup ? `(${idolA.girlGroup})` : '';
      const groupB = idolB?.girlGroup ? `(${idolB.girlGroup})` : '';
      const rtgA = idolA?.rating ? `[${idolA.rating}]` : '';
      const rtgB = idolB?.rating ? `[${idolB.rating}]` : '';

      if (m.completed) {
        const scoreStr = `${m.scoreA} - ${m.scoreB}`;
        let winTag = '';
        if ((m.scoreA || 0) > (m.scoreB || 0)) winTag = ` <- ${nameA} Won`;
        else if ((m.scoreB || 0) > (m.scoreA || 0)) winTag = ` <- ${nameB} Won`;
        else winTag = ` (Draw)`;
        text += `${idx + 1}. ${nameA} ${groupA} ${rtgA}  ${scoreStr}  ${nameB} ${groupB} ${rtgB}${winTag}\n`;
      } else {
        text += `${idx + 1}. ${nameA} ${groupA} ${rtgA}   vs   ${nameB} ${groupB} ${rtgB} (Scheduled)\n`;
      }
    });

    text += `\n========================================================\n`;
    text += `Generated from Sabung Idol Arena\n`;
    return text;
  };

  const handleCopyText = async () => {
    try {
      const text = generateTextSummary();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 3. High-Resolution Canvas PNG Export (Single-Column Flow - Clean & Un-truncated)
  const handleDownloadImage = async () => {
    setIsGeneratingImage(true);
    try {
      const scale = 2; // 2x DPR for crisp retina display
      const canvasWidth = 1000;
      const cardHeight = 66;
      const rowGap = 10;
      const startY = 150;
      const matchCount = matchdayMatches.length;
      const canvasHeight = Math.max(700, startY + matchCount * (cardHeight + rowGap) + 70);

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * scale;
      canvas.height = canvasHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.scale(scale, scale);

      // 1. Dark Espresso / Obsidian Canvas Background
      ctx.fillStyle = '#140c08';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Subtle warm arcade grid background pattern
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvasWidth; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y < canvasHeight; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }

      // 2. Top Championship Accent Banner Gradient
      const topGrad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
      topGrad.addColorStop(0, '#dc2626'); // red-600
      topGrad.addColorStop(0.3, '#d97706'); // amber-600
      topGrad.addColorStop(0.7, '#eab308'); // yellow-500
      topGrad.addColorStop(1, '#9333ea'); // purple-600
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, canvasWidth, 8);

      // 3. Header Card
      ctx.fillStyle = '#1e140d';
      ctx.fillRect(40, 24, canvasWidth - 80, 105);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 24, canvasWidth - 80, 105);

      // Gold outline accent inside header
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(43, 27, canvasWidth - 86, 99);

      // Title
      ctx.fillStyle = '#fef08a';
      ctx.font = '900 28px Impact, "Arial Black", sans-serif';
      ctx.fillText(titleText.toUpperCase(), 65, 66);

      // Matchday Subtitle
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`MATCHDAY ${selectedMatchday} OF ${totalMatchdays} • SEASON ${seasonNumber}`, 65, 94);

      // Status Pill on the Right
      const pillWidth = 220;
      const pillX = canvasWidth - 40 - pillWidth - 15;
      const pillY = 46;
      ctx.fillStyle = isMatchdayFinished ? '#064e3b' : '#312e81';
      ctx.fillRect(pillX, pillY, pillWidth, 34);
      ctx.strokeStyle = isMatchdayFinished ? '#10b981' : '#818cf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(pillX, pillY, pillWidth, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      const statusLabel = isMatchdayFinished
        ? `COMPLETED (${completedCount}/${matchdayMatches.length})`
        : `IN PROGRESS (${completedCount}/${matchdayMatches.length})`;
      ctx.fillText(statusLabel, pillX + pillWidth / 2, pillY + 22);
      ctx.textAlign = 'left';

      // 4. Fixtures List (Clean 1-Column Layout - No Overlapping, Full Names Visible)
      const cardWidth = canvasWidth - 80;

      matchdayMatches.forEach((m, idx) => {
        const cardX = 40;
        const cardY = startY + idx * (cardHeight + rowGap);

        const idolA = idolsMap.get(m.idolAId);
        const idolB = idolsMap.get(m.idolBId);
        const nameA = idolA?.name || 'Unknown A';
        const nameB = idolB?.name || 'Unknown B';
        const groupA = idolA?.girlGroup || 'Independent';
        const groupB = idolB?.girlGroup || 'Independent';
        const rtgA = idolA?.rating || 75;
        const rtgB = idolB?.rating || 75;

        const aWon = m.completed && (m.scoreA || 0) > (m.scoreB || 0);
        const bWon = m.completed && (m.scoreB || 0) > (m.scoreA || 0);
        const draw = m.completed && (m.scoreA || 0) === (m.scoreB || 0);

        // Card Container
        ctx.fillStyle = m.completed ? '#1b120c' : '#150e09';
        ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

        // Match Index Badge
        ctx.fillStyle = '#0f0a06';
        ctx.fillRect(cardX + 10, cardY + 14, 38, 38);
        ctx.strokeStyle = '#382314';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cardX + 10, cardY + 14, 38, 38);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${idx + 1}`, cardX + 29, cardY + 38);
        ctx.textAlign = 'left';

        // Idol A (Left side)
        ctx.fillStyle = aWon ? '#34d399' : '#ffffff';
        ctx.font = 'bold 16px "Impact", "Arial Black", sans-serif';
        ctx.fillText(nameA, cardX + 60, cardY + 30);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`${groupA}  [${rtgA}]`, cardX + 60, cardY + 50);

        // Center Score Badge / VS
        const badgeWidth = 100;
        const badgeHeight = 42;
        const badgeX = cardX + (cardWidth - badgeWidth) / 2;
        const badgeY = cardY + 12;

        ctx.fillStyle = '#0a0604';
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
        ctx.strokeStyle = '#271b12';
        ctx.lineWidth = 2;
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);

        if (m.completed) {
          ctx.textAlign = 'center';
          ctx.font = '900 22px "Impact", "Arial Black", sans-serif';
          ctx.fillStyle = aWon ? '#34d399' : draw ? '#fef08a' : '#cbd5e1';
          ctx.fillText(String(m.scoreA), badgeX + 26, badgeY + 30);

          ctx.fillStyle = '#78716c';
          ctx.font = 'bold 14px monospace';
          ctx.fillText('-', badgeX + 50, badgeY + 28);

          ctx.font = '900 22px "Impact", "Arial Black", sans-serif';
          ctx.fillStyle = bWon ? '#34d399' : draw ? '#fef08a' : '#cbd5e1';
          ctx.fillText(String(m.scoreB), badgeX + 74, badgeY + 30);
          ctx.textAlign = 'left';
        } else {
          ctx.textAlign = 'center';
          ctx.font = '900 15px "Impact", "Arial Black", sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText('VS', badgeX + badgeWidth / 2, badgeY + 27);
          ctx.textAlign = 'left';
        }

        // Idol B (Right side)
        ctx.textAlign = 'right';
        ctx.fillStyle = bWon ? '#34d399' : '#ffffff';
        ctx.font = 'bold 16px "Impact", "Arial Black", sans-serif';
        ctx.fillText(nameB, cardX + cardWidth - 20, cardY + 30);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`[${rtgB}]  ${groupB}`, cardX + cardWidth - 20, cardY + 50);
        ctx.textAlign = 'left';
      });

      // 5. Footer Bar
      const footerY = canvasHeight - 52;
      ctx.fillStyle = '#0a0604';
      ctx.fillRect(0, footerY, canvasWidth, 52);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, footerY, canvasWidth, 52);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('SABUNG IDOL ARENA • OFFICIAL MATCHDAY BROADCAST', 40, footerY + 32);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(
        `Total Matches: ${matchdayMatches.length}  |  Completed: ${completedCount}  |  Total Goals: ${totalGoals}`,
        canvasWidth - 40,
        footerY + 32
      );
      ctx.textAlign = 'left';

      // Convert to PNG & Download
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      const safeTitle = titleText.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Sabung_Idol_${safeTitle}_Matchday_${selectedMatchday}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to generate matchday card image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-3xl border-3 border-black bg-[#16100b] text-white poster-shadow-lg flex flex-col my-auto max-h-[95vh] overflow-hidden">
        {/* Header Strip */}
        <div className="flex items-center justify-between border-b-2 border-black bg-[#1f150f] p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/20 border-2 border-black text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-poster-title text-amber-400 flex items-center gap-2">
                <span>Download &amp; Share Matchday</span>
                <span className="text-xs text-amber-200/60 font-mono">
                  (Matchday {selectedMatchday})
                </span>
              </h2>
              <p className="text-[11px] text-amber-200/70 font-poster-body">
                Export high-resolution matchday card graphic, CSV table, or Discord text for any matchday.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/50 hover:bg-black text-slate-400 hover:text-white border border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="p-3 sm:p-4 border-b-2 border-black bg-[#120c08] flex flex-wrap items-center justify-between gap-3">
          {/* League / Division Switcher (if multiple leagues provided) */}
          {leagues.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-amber-300">Division:</span>
              <div className="flex items-center gap-1 flex-wrap">
                {leagues.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLeagueId(l.id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-poster-title font-bold border transition-all ${
                      String(selectedLeagueId) === String(l.id)
                        ? 'poster-pill-gold text-amber-950 border-amber-400 scale-105'
                        : 'bg-[#1e140d] border-black text-amber-300/70 hover:text-white'
                    }`}
                  >
                    {l.name.replace('Idol ', '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matchday Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMatchday((prev) => Math.max(1, prev - 1))}
              disabled={selectedMatchday <= 1}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
              title="Previous Matchday"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 bg-[#1b120c] px-3 py-1.5 rounded-xl border border-black">
              <span className="text-xs font-black text-amber-400 font-mono">
                Matchday {selectedMatchday} / {totalMatchdays}
              </span>
              <select
                value={selectedMatchday}
                onChange={(e) => setSelectedMatchday(Number(e.target.value))}
                className="bg-[#0f0905] text-amber-300 border border-black rounded-lg px-2 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
              >
                {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((md) => (
                  <option key={md} value={md}>
                    MD {md}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setSelectedMatchday((prev) => Math.min(totalMatchdays, prev + 1))}
              disabled={selectedMatchday >= totalMatchdays}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
              title="Next Matchday"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Stats Pill */}
          <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-[#241710] border border-amber-600/30 text-amber-300">
              {completedCount}/{matchdayMatches.length} Matches Completed
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-[#241710] border border-emerald-600/30 text-emerald-400 font-mono">
              {totalGoals} Total Goals
            </span>
          </div>
        </div>

        {/* View Tabs & Action Buttons */}
        <div className="p-3 sm:p-4 bg-[#18110b] flex flex-wrap items-center justify-between gap-3 border-b border-black">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                activeTab === 'preview'
                  ? 'poster-pill-gold text-amber-950 border-amber-300 scale-105'
                  : 'bg-[#20150e] border-black text-amber-300/70 hover:text-white'
              }`}
            >
              Matchday Fixtures Card
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                activeTab === 'text'
                  ? 'poster-pill-gold text-amber-950 border-amber-300 scale-105'
                  : 'bg-[#20150e] border-black text-amber-300/70 hover:text-white'
              }`}
            >
              Discord / Text Table
            </button>
          </div>

          {/* Download Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-amber-950 font-poster-title text-xs font-black shadow transition-all border border-amber-400/50 hover:scale-105 disabled:opacity-50"
              title="Download high-resolution 1200x900 PNG matchday card"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{isGeneratingImage ? 'Generating PNG...' : 'Download PNG Card'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#241710] hover:bg-amber-950 border border-amber-600/50 text-amber-300 font-poster-title text-xs font-bold transition-all hover:scale-105"
              title="Download CSV spreadsheet of matchday results"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#241710] hover:bg-slate-800 border border-slate-700 text-slate-200 font-poster-title text-xs font-bold transition-all hover:scale-105"
              title="Copy clean text summary to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4">
          {activeTab === 'preview' ? (
            /* Live Interactive Preview of Matchday Fixtures */
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-black bg-[#120d08] p-4 poster-shadow">
                <div className="flex items-center justify-between border-b border-black pb-3 mb-3">
                  <div>
                    <h3 className="font-poster-title text-base text-amber-300">
                      {titleText} • Matchday {selectedMatchday}
                    </h3>
                    <p className="text-[11px] text-amber-200/60 font-bold">
                      {completedCount} of {matchdayMatches.length} matches completed • Total goals: {totalGoals}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono border ${
                      isMatchdayFinished
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {isMatchdayFinished ? 'Completed' : 'In Progress'}
                  </span>
                </div>

                {/* Clean 1-Column Layout - All Matches Visible, No Squeezing, Perfect for Mobile */}
                <div className="space-y-2.5">
                  {matchdayMatches.map((m, idx) => {
                    const idolA = idolsMap.get(m.idolAId);
                    const idolB = idolsMap.get(m.idolBId);
                    const isCompleted = m.completed && m.scoreA !== null && m.scoreB !== null;
                    const aWon = isCompleted && (m.scoreA || 0) > (m.scoreB || 0);
                    const bWon = isCompleted && (m.scoreB || 0) > (m.scoreA || 0);
                    const draw = isCompleted && (m.scoreA || 0) === (m.scoreB || 0);

                    return (
                      <div
                        key={m.id}
                        className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 sm:gap-3 ${
                          isCompleted
                            ? 'bg-[#1a120c] border-black hover:border-amber-500/40'
                            : 'bg-[#140e0a] border-black/80'
                        }`}
                      >
                        {/* Match Index Tag */}
                        <span className="text-[10px] font-mono text-amber-400/80 font-bold px-1.5 py-0.5 rounded bg-black/60 border border-black/80 shrink-0">
                          #{idx + 1}
                        </span>

                        {/* Idol A */}
                        <div className="flex-1 flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2 border-black bg-black overflow-hidden shrink-0 shadow-sm">
                            {idolA?.photoUrl ? (
                              <img
                                src={idolA.photoUrl}
                                alt={idolA.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-[11px] text-amber-300 bg-black">
                                {idolA?.name?.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-poster-title text-xs sm:text-sm text-white truncate font-bold flex items-center gap-1.5">
                              <span className={aWon ? 'text-emerald-400' : ''}>
                                {idolA?.name || 'Unknown A'}
                              </span>
                              {idolA && <RatingBadge idol={idolA} size="xs" showTier={false} />}
                            </div>
                            <div className="text-[10px] text-amber-400/80 font-semibold truncate max-w-[90px] sm:max-w-none">
                              {idolA?.girlGroup}
                            </div>
                          </div>
                        </div>

                        {/* Score / VS Center */}
                        <div className="flex flex-col items-center justify-center px-1.5 sm:px-3 shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 border border-black/80 shadow-inner">
                              <span
                                className={`font-poster-title text-sm sm:text-base font-black ${
                                  aWon ? 'text-emerald-400' : draw ? 'text-amber-300' : 'text-slate-400'
                                }`}
                              >
                                {m.scoreA}
                              </span>
                              <span className="text-slate-600 font-bold text-xs">-</span>
                              <span
                                className={`font-poster-title text-sm sm:text-base font-black ${
                                  bWon ? 'text-emerald-400' : draw ? 'text-amber-300' : 'text-slate-400'
                                }`}
                              >
                                {m.scoreB}
                              </span>
                            </div>
                          ) : (
                            <span className="font-poster-title text-[11px] sm:text-xs text-amber-400/70 font-bold px-2.5 py-0.5 rounded-lg bg-black/60 border border-black/80">
                              VS
                            </span>
                          )}
                        </div>

                        {/* Idol B */}
                        <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0 text-right">
                          <div className="min-w-0 flex-1">
                            <div className="font-poster-title text-xs sm:text-sm text-white truncate font-bold flex items-center justify-end gap-1.5">
                              {idolB && <RatingBadge idol={idolB} size="xs" showTier={false} />}
                              <span className={bWon ? 'text-emerald-400' : ''}>
                                {idolB?.name || 'Unknown B'}
                              </span>
                            </div>
                            <div className="text-[10px] text-amber-400/80 font-semibold truncate max-w-[90px] sm:max-w-none">
                              {idolB?.girlGroup}
                            </div>
                          </div>
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2 border-black bg-black overflow-hidden shrink-0 shadow-sm">
                            {idolB?.photoUrl ? (
                              <img
                                src={idolB.photoUrl}
                                alt={idolB.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-poster-title text-[11px] text-amber-300 bg-black">
                                {idolB?.name?.slice(0, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Plain Text / Markdown Codeblock */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-300 font-bold px-1">
                <span>Formatted Text (Ready for Discord / Socials)</span>
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={generateTextSummary()}
                className="w-full h-80 rounded-2xl border-2 border-black bg-[#0d0805] text-amber-300 font-mono text-xs p-4 leading-relaxed focus:outline-none custom-scrollbar select-all"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t-2 border-black bg-[#120c08] flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[11px]">
            Sabung Idol Arena • Matchday Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#241710] hover:bg-[#342217] text-white font-bold border border-black"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
