import React, { useState, useMemo, useRef } from 'react';
import {
  Idol,
  LeagueInfo,
  LeagueStanding,
  LeagueMatch,
} from '../types';
import { calculateLeagueStandings } from '../utils/leagueLogic';
import { RatingBadge } from './RatingBadge';
import { FormBadge } from './FormBadge';
import {
  X,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  Trophy,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  Shield,
  Sparkles,
} from 'lucide-react';

interface LeagueStandingsDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagues: LeagueInfo[];
  idols: Idol[];
  initialLeagueId: number;
  initialMatchday: number;
  seasonNumber: number;
}

export const LeagueStandingsDownloadModal: React.FC<LeagueStandingsDownloadModalProps> = ({
  isOpen,
  onClose,
  leagues,
  idols,
  initialLeagueId,
  initialMatchday,
  seasonNumber,
}) => {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number>(initialLeagueId);
  const [selectedMatchday, setSelectedMatchday] = useState<number>(initialMatchday);
  const [useMatchdayFilter, setUseMatchdayFilter] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState<boolean>(false);

  const idolsMap = useMemo(() => {
    const map = new Map<string, Idol>();
    idols.forEach((i) => map.set(i.id, i));
    return map;
  }, [idols]);

  const currentLeague = useMemo(() => {
    return leagues.find((l) => l.id === selectedLeagueId) || leagues[0];
  }, [leagues, selectedLeagueId]);

  // Total matchdays in a 20-idol league = 38
  const totalMatchdays = 38;

  // Standings filtered by matchday if requested, or current standings
  const displayedStandings: LeagueStanding[] = useMemo(() => {
    if (!currentLeague) return [];
    if (!useMatchdayFilter) {
      return currentLeague.standings || [];
    }

    const filteredMatches = (currentLeague.matches || []).filter(
      (m) => m.matchday <= selectedMatchday
    );
    return calculateLeagueStandings(
      currentLeague.id,
      currentLeague.memberIds,
      filteredMatches,
      idols
    );
  }, [currentLeague, useMatchdayFilter, selectedMatchday, idols]);

  if (!isOpen) return null;

  // --- EXPORT CSV ---
  const handleDownloadCSV = () => {
    if (!currentLeague || displayedStandings.length === 0) return;

    const headers = [
      'Rank',
      'Idol Name',
      'Girl Group',
      'Rating',
      'Nationality',
      'Played',
      'Won',
      'Drawn',
      'Lost',
      'Goals For',
      'Goals Against',
      'Goal Diff',
      'Points',
      'Form',
    ];

    const rows = displayedStandings.map((st) => {
      const idol = idolsMap.get(st.idolId);
      const formStr = (st.form || []).join('-');
      return [
        st.rank,
        `"${(st.idolName || idol?.name || '').replace(/"/g, '""')}"`,
        `"${(st.girlGroup || idol?.girlGroup || '').replace(/"/g, '""')}"`,
        idol?.rating || 0,
        `"${(st.nationality || idol?.nationality || '').replace(/"/g, '""')}"`,
        st.played,
        st.wins,
        st.draws,
        st.losses,
        st.gamesFor,
        st.gamesAgainst,
        st.gameDiff,
        st.points,
        `"${formStr}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const mdLabel = useMatchdayFilter ? `_MD${selectedMatchday}` : '_Overall';
    link.href = url;
    link.setAttribute(
      'download',
      `${currentLeague.name.replace(/\s+/g, '_')}_S${seasonNumber}${mdLabel}_Standings.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- COPY TO CLIPBOARD ---
  const handleCopyTable = () => {
    if (!currentLeague || displayedStandings.length === 0) return;

    const mdText = useMatchdayFilter ? `Matchday ${selectedMatchday}` : 'Overall';
    let text = `=== ${currentLeague.name} (Season ${seasonNumber}) • ${mdText} Standings ===\n`;
    text += `Rank | Idol | Team | P | W | D | L | GD | PTS | Form\n`;
    text += `----------------------------------------------------------\n`;

    displayedStandings.forEach((st) => {
      const idol = idolsMap.get(st.idolId);
      const name = (st.idolName || idol?.name || '').padEnd(16, ' ');
      const group = (st.girlGroup || idol?.girlGroup || '').padEnd(12, ' ');
      const form = (st.form || []).slice(-5).join('');
      const r = String(st.rank).padStart(2, ' ');
      const p = String(st.played).padStart(2, ' ');
      const w = String(st.wins).padStart(2, ' ');
      const d = String(st.draws).padStart(2, ' ');
      const l = String(st.losses).padStart(2, ' ');
      const gd = (st.gameDiff >= 0 ? `+${st.gameDiff}` : String(st.gameDiff)).padStart(3, ' ');
      const pts = String(st.points).padStart(3, ' ');
      text += `${r} | ${name} | ${group} | ${p} | ${w} | ${d} | ${l} | ${gd} | ${pts} | ${form}\n`;
    });

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // --- DOWNLOAD HIGH-RES PNG POSTER USING HTML5 CANVAS ---
  const handleDownloadPNG = async () => {
    if (!currentLeague || displayedStandings.length === 0) return;
    setIsGeneratingPng(true);

    try {
      const width = 1200;
      const rowHeight = 44;
      const headerHeight = 190;
      const footerHeight = 80;
      const height = headerHeight + displayedStandings.length * rowHeight + footerHeight;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // Background
      ctx.fillStyle = '#120e0b';
      ctx.fillRect(0, 0, width, height);

      // Gradient accent banner at top
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#7f1d1d');
      grad.addColorStop(0.5, '#b45309');
      grad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, 10);

      // Division Header Card
      ctx.fillStyle = '#1c140e';
      ctx.fillRect(30, 25, width - 60, 140);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeRect(30, 25, width - 60, 140);

      // Division Title
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 36px Impact, sans-serif';
      ctx.fillText(currentLeague.name.toUpperCase(), 60, 75);

      // Subtitle & Matchday Info
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 18px sans-serif';
      const mdLabel = useMatchdayFilter
        ? `Official Standings • Matchday ${selectedMatchday} of ${totalMatchdays}`
        : `Official Standings • Season ${seasonNumber} to Date`;
      ctx.fillText(mdLabel, 60, 110);

      // Badges Info
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('TOP 5: Champions Tournament Qualification', 60, 142);
      ctx.fillStyle = '#a855f7';
      ctx.fillText('• 6TH: Wildcard Play-In', 420, 142);

      // Table Header
      const tableY = headerHeight;
      ctx.fillStyle = '#0a0604';
      ctx.fillRect(30, tableY, width - 60, 36);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, tableY, width - 60, 36);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('RANK', 50, tableY + 23);
      ctx.fillText('PARTICIPANT', 120, tableY + 23);
      ctx.fillText('GROUP', 450, tableY + 23);
      ctx.fillText('RTG', 610, tableY + 23);
      ctx.fillText('P', 670, tableY + 23);
      ctx.fillText('W', 720, tableY + 23);
      ctx.fillText('D', 770, tableY + 23);
      ctx.fillText('L', 820, tableY + 23);
      ctx.fillText('GD', 870, tableY + 23);
      ctx.fillText('PTS', 940, tableY + 23);
      ctx.fillText('FORM', 1030, tableY + 23);

      // Render Rows
      displayedStandings.forEach((st, idx) => {
        const idol = idolsMap.get(st.idolId);
        const y = tableY + 36 + idx * rowHeight;

        // Alternating background
        if (st.rank <= 5) {
          ctx.fillStyle = idx % 2 === 0 ? '#1e2417' : '#171d11';
        } else if (st.rank === 6) {
          ctx.fillStyle = idx % 2 === 0 ? '#221526' : '#1b101e';
        } else {
          ctx.fillStyle = idx % 2 === 0 ? '#18120c' : '#130d08';
        }
        ctx.fillRect(30, y, width - 60, rowHeight);
        ctx.strokeStyle = '#231811';
        ctx.lineWidth = 1;
        ctx.strokeRect(30, y, width - 60, rowHeight);

        // Rank Badge
        if (st.rank === 1) {
          ctx.fillStyle = '#fbbf24';
        } else if (st.rank <= 5) {
          ctx.fillStyle = '#34d399';
        } else if (st.rank === 6) {
          ctx.fillStyle = '#c084fc';
        } else {
          ctx.fillStyle = '#78716c';
        }
        ctx.font = 'bold 16px monospace';
        ctx.fillText(String(st.rank).padStart(2, '0'), 55, y + 28);

        // Name
        ctx.fillStyle = st.rank <= 5 ? '#ffffff' : '#fde047';
        ctx.font = 'bold 16px sans-serif';
        const name = st.idolName || idol?.name || 'Unknown';
        ctx.fillText(name.slice(0, 22), 120, y + 28);

        // Group
        ctx.fillStyle = '#f87171';
        ctx.font = '14px sans-serif';
        ctx.fillText((st.girlGroup || idol?.girlGroup || '').slice(0, 16), 450, y + 28);

        // Rating
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(String(idol?.rating || '-'), 610, y + 28);

        // Stats
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px monospace';
        ctx.fillText(String(st.played), 670, y + 28);
        ctx.fillStyle = '#34d399';
        ctx.fillText(String(st.wins), 720, y + 28);
        ctx.fillStyle = '#fde047';
        ctx.fillText(String(st.draws), 770, y + 28);
        ctx.fillStyle = '#f87171';
        ctx.fillText(String(st.losses), 820, y + 28);

        // Goal Diff
        const gdStr = st.gameDiff >= 0 ? `+${st.gameDiff}` : String(st.gameDiff);
        ctx.fillStyle = st.gameDiff > 0 ? '#34d399' : st.gameDiff < 0 ? '#f87171' : '#e2e8f0';
        ctx.fillText(gdStr, 870, y + 28);

        // Points
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(String(st.points), 940, y + 28);

        // Form pills
        const form = (st.form || []).slice(-5);
        form.forEach((res, fIdx) => {
          const fx = 1030 + fIdx * 24;
          const fy = y + 12;
          ctx.fillStyle = res === 'W' ? '#15803d' : res === 'D' ? '#b45309' : '#b91c1c';
          ctx.fillRect(fx, fy, 20, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(res, fx + 5, fy + 15);
        });
      });

      // Footer
      const footerY = height - 55;
      ctx.fillStyle = '#78716c';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        `Generated by Sabung Idol Arena • ${new Date().toLocaleDateString()} • Official League System`,
        50,
        footerY
      );

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const mdTag = useMatchdayFilter ? `_MD${selectedMatchday}` : '_Overall';
      link.download = `${currentLeague.name.replace(/\s+/g, '_')}_S${seasonNumber}${mdTag}_Poster.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating PNG standings:', err);
      alert('Could not generate PNG standings poster. Please use CSV or Copy Table instead.');
    } finally {
      setIsGeneratingPng(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl border-3 border-black bg-[#16100b] poster-shadow-lg flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-black p-4 sm:p-5 bg-[#1f150f] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-black border-2 border-black poster-shadow-sm font-black text-xl">
              <Trophy className="h-6 w-6 fill-black" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-poster-title text-base sm:text-xl text-amber-300">
                  {currentLeague.name} Standings
                </h2>
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-black text-amber-300">
                  Season {seasonNumber}
                </span>
              </div>
              <p className="text-xs text-amber-200/70 font-bold">
                Download and share official standings at any matchday
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2a1c12] text-amber-300 hover:bg-red-950 border-2 border-black transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Division Selector & Matchday Configuration Bar */}
        <div className="p-3 sm:p-4 bg-[#120e0b] border-b-2 border-black space-y-3 flex-shrink-0">
          {/* League Division Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            <span className="text-xs font-black text-amber-400/80 mr-1 shrink-0 uppercase tracking-wider">
              Division:
            </span>
            {leagues.map((l) => {
              const isSelected = l.id === selectedLeagueId;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLeagueId(l.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-poster-body font-black border-2 border-black shrink-0 transition-all ${
                    isSelected
                      ? 'poster-pill-gold text-amber-950 shadow-md scale-105'
                      : 'bg-[#1f150f] text-amber-200/70 hover:text-white hover:bg-[#2c1d14]'
                  }`}
                >
                  {l.name}
                </button>
              );
            })}
          </div>

          {/* Matchday Snapshot Toggle & Stepper */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-amber-200/70">Snapshot Type:</span>
              <button
                onClick={() => setUseMatchdayFilter(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                  !useMatchdayFilter
                    ? 'poster-pill-gold text-amber-950 border-amber-400 shadow-sm'
                    : 'bg-[#20150d] text-amber-300/70 border-black hover:bg-[#2b1b10]'
                }`}
              >
                Overall Season to Date
              </button>

              <button
                onClick={() => setUseMatchdayFilter(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 ${
                  useMatchdayFilter
                    ? 'poster-pill-gold text-amber-950 border-amber-400 shadow-sm'
                    : 'bg-[#20150d] text-amber-300/70 border-black hover:bg-[#2b1b10]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>As of Matchday {selectedMatchday}</span>
              </button>
            </div>

            {useMatchdayFilter && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedMatchday((p) => Math.max(1, p - 1))}
                  disabled={selectedMatchday <= 1}
                  className="p-1.5 rounded-xl bg-[#20150d] border border-black text-amber-300 disabled:opacity-30 hover:bg-[#2d1e13]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedMatchday}
                  onChange={(e) => setSelectedMatchday(Number(e.target.value))}
                  className="bg-[#20150d] text-amber-300 border border-black rounded-xl px-2.5 py-1 text-xs font-mono font-black"
                >
                  {Array.from({ length: totalMatchdays }, (_, i) => i + 1).map((md) => (
                    <option key={md} value={md}>
                      Matchday {md}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedMatchday((p) => Math.min(totalMatchdays, p + 1))}
                  disabled={selectedMatchday >= totalMatchdays}
                  className="p-1.5 rounded-xl bg-[#20150d] border border-black text-amber-300 disabled:opacity-30 hover:bg-[#2d1e13]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Standings Table Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
          <div className="overflow-x-auto rounded-2xl border-2 border-black bg-[#100b08] poster-shadow-sm">
            <table className="w-full text-left text-xs font-poster-body">
              <thead className="bg-[#0b0705] text-[10px] uppercase font-black tracking-wider text-amber-400/90 border-b-2 border-black">
                <tr>
                  <th className="px-3 py-3 text-center w-12">Rank</th>
                  <th className="px-3 py-3">Participant</th>
                  <th className="px-2 py-3 text-center">RTG</th>
                  <th className="px-2 py-3 text-center">P</th>
                  <th className="px-2 py-3 text-center text-emerald-400">W</th>
                  <th className="px-2 py-3 text-center text-amber-400">D</th>
                  <th className="px-2 py-3 text-center text-rose-400">L</th>
                  <th className="px-2 py-3 text-center">GF-GA</th>
                  <th className="px-2 py-3 text-center">GD</th>
                  <th className="px-3 py-3 text-center font-black text-amber-400">PTS</th>
                  <th className="px-3 py-3 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/60 font-bold">
                {displayedStandings.map((st) => {
                  const idol = idolsMap.get(st.idolId);
                  const isTop5 = st.rank <= 5;
                  const isWildcard = st.rank === 6;

                  return (
                    <tr
                      key={st.idolId}
                      className={`transition-colors ${
                        isTop5
                          ? 'bg-emerald-950/25 hover:bg-emerald-950/40 text-emerald-100'
                          : isWildcard
                          ? 'bg-purple-950/25 hover:bg-purple-950/40 text-purple-100'
                          : 'hover:bg-[#1a120b] text-amber-200/80'
                      }`}
                    >
                      {/* Rank Badge */}
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-mono font-black border ${
                            st.rank === 1
                              ? 'bg-amber-400 text-black border-amber-300 shadow-sm'
                              : isTop5
                              ? 'bg-emerald-600 text-white border-emerald-400'
                              : isWildcard
                              ? 'bg-purple-700 text-white border-purple-400'
                              : 'bg-black/80 text-amber-200/60 border-black'
                          }`}
                        >
                          {st.rank}
                        </span>
                      </td>

                      {/* Participant */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-xl border border-black bg-black overflow-hidden shrink-0">
                            {idol?.photoUrl ? (
                              <img
                                src={idol.photoUrl}
                                alt={idol.name}
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center font-poster-title text-xs text-amber-300">
                                {idol?.name?.slice(0, 2)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-xs text-white block truncate">
                              {st.idolName || idol?.name || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-red-400 font-extrabold truncate block">
                              {st.girlGroup || idol?.girlGroup || ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-2 py-2.5 text-center">
                        {idol ? (
                          <RatingBadge idol={idol} size="xs" showTier={false} />
                        ) : (
                          <span className="font-mono text-xs text-amber-300">-</span>
                        )}
                      </td>

                      {/* Stats */}
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-slate-300">
                        {st.played}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-emerald-400 font-black">
                        {st.wins}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-amber-400 font-black">
                        {st.draws}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-rose-400 font-black">
                        {st.losses}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs text-slate-400">
                        {st.gamesFor}-{st.gamesAgainst}
                      </td>
                      <td
                        className={`px-2 py-2.5 text-center font-mono text-xs font-black ${
                          st.gameDiff > 0
                            ? 'text-emerald-400'
                            : st.gameDiff < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {st.gameDiff > 0 ? `+${st.gameDiff}` : st.gameDiff}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-sm font-black text-amber-300">
                        {st.points}
                      </td>

                      {/* Form */}
                      <td className="px-3 py-2.5 text-center">
                        <FormBadge formHistory={st.form || []} size="xs" showStreak={false} showModifier={false} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Action Footer: Download PNG, Download CSV, Copy Table */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:p-5 bg-[#1a120c] border-t-2 border-black flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300/80">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block border border-black" />
              <span>Top 5 Qualify</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-purple-600 inline-block border border-black" />
              <span>6th Wildcard</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={handleCopyTable}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border-2 border-black bg-[#24170f] text-amber-200 text-xs font-black hover:bg-[#342217] transition-all poster-shadow-sm"
            >
              {copySuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-300" />}
              <span>{copySuccess ? 'Copied!' : 'Copy Table'}</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border-2 border-black bg-[#281b12] text-amber-200 text-xs font-black hover:bg-amber-950 transition-all poster-shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              disabled={isGeneratingPng}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl poster-pill-gold text-amber-950 border-2 border-black text-xs font-black hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-black" />
              <span>{isGeneratingPng ? 'Generating PNG...' : 'Download Image (PNG)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
