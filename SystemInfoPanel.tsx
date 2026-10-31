import React from 'react';
import {
  Idol,
  GirlGroup,
  ArchivedMatch,
  TournamentArchive,
  LeagueSeasonArchive,
  TheIdolsSeasonArchive,
} from '../types';
import {
  Info,
  Database,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Sliders,
  Trophy,
  Swords,
  Table,
  Flame,
  Award,
  Crown,
  GitCompare,
  Zap,
  ArrowRight,
  Shield,
  Star,
} from 'lucide-react';

interface SystemInfoPanelProps {
  idols: Idol[];
  girlGroups: GirlGroup[];
  matchDatabase: ArchivedMatch[];
  archives: TournamentArchive[];
  leagueArchives?: LeagueSeasonArchive[];
  theIdolsArchives?: TheIdolsSeasonArchive[];
  totalCompletedSeasons?: number;
}

export const SystemInfoPanel: React.FC<SystemInfoPanelProps> = ({
  idols,
  girlGroups,
  matchDatabase,
  archives,
  leagueArchives,
  theIdolsArchives,
  totalCompletedSeasons,
}) => {
  const distinctCompletedCount =
    typeof totalCompletedSeasons === 'number'
      ? totalCompletedSeasons
      : (() => {
          const set = new Set<number>();
          (archives || []).forEach((a) => {
            const s = Number(a?.seasonId || 0);
            if (s > 0) set.add(s);
          });
          (leagueArchives || []).forEach((a) => {
            const s = Number(a?.seasonNumber || 0);
            if (s > 0) set.add(s);
          });
          (theIdolsArchives || []).forEach((a) => {
            const s = Number(a?.seasonNumber || 0);
            if (s > 0) set.add(s);
          });
          return set.size;
        })();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-2xl font-poster-title text-amber-400 flex items-center gap-2 drop-shadow-[2px_2px_0px_#000]">
            <Info className="h-7 w-7 text-amber-400" />
            <span>System Guide &amp; Architecture Flow</span>
          </h2>
          <p className="text-xs text-amber-200/80 font-bold mt-1">
            Complete architectural guide, tournament flows, rating simulation mechanics, and database lifecycle.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Sabung Idol Championship Engine v3.0
        </span>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-4 text-center shadow poster-shadow-sm">
          <Database className="h-5 w-5 text-amber-400 mx-auto mb-1" />
          <span className="text-[10px] text-amber-200/60 uppercase font-black tracking-wider block">
            Idols in Database
          </span>
          <span className="text-2xl font-black text-amber-300 font-mono">{idols.length}</span>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-4 text-center shadow poster-shadow-sm">
          <Layers className="h-5 w-5 text-purple-400 mx-auto mb-1" />
          <span className="text-[10px] text-amber-200/60 uppercase font-black tracking-wider block">
            Girl Groups
          </span>
          <span className="text-2xl font-black text-white font-mono">{girlGroups.length}</span>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-4 text-center shadow poster-shadow-sm">
          <Sparkles className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
          <span className="text-[10px] text-amber-200/60 uppercase font-black tracking-wider block">
            Matches Recorded
          </span>
          <span className="text-2xl font-black text-emerald-400 font-mono">{matchDatabase.length}</span>
        </div>

        <div className="rounded-2xl border-2 border-black bg-[#1b130e] p-4 text-center shadow poster-shadow-sm">
          <Trophy className="h-5 w-5 text-amber-400 mx-auto mb-1" />
          <span className="text-[10px] text-amber-200/60 uppercase font-black tracking-wider block">
            Seasons Archived
          </span>
          <span className="text-2xl font-black text-amber-400 font-mono">{distinctCompletedCount}</span>
        </div>
      </div>

      {/* SYSTEM FLOW 1: TOURNAMENT CUP WORKSPACE */}
      <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
        <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2 border-b-2 border-black pb-3">
          <Trophy className="h-6 w-6 text-amber-400" />
          <span>1. Tournament Cup Workflow (Group Stage &rarr; Knockout Brackets)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
                <span className="h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-[10px]">
                  1
                </span>
                <span>Competition Setup</span>
              </div>
              <p className="text-slate-300 mt-1 leading-relaxed">
                Select 16, 32, 64, or custom participants. Configure group count, qualification limits, and seeding distribution rules.
              </p>
            </div>
            <span className="text-[10px] text-amber-200/50 font-mono">&rarr; Tab: Competition Manager</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
                <span className="h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-[10px]">
                  2
                </span>
                <span>Group Draw</span>
              </div>
              <p className="text-slate-300 mt-1 leading-relaxed">
                Automated or manual pot distribution ensures seeded idols are evenly separated across Groups A through H.
              </p>
            </div>
            <span className="text-[10px] text-amber-200/50 font-mono">&rarr; Tab: Group Draw</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
                <span className="h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-[10px]">
                  3
                </span>
                <span>Group Round Robin</span>
              </div>
              <p className="text-slate-300 mt-1 leading-relaxed">
                Enter scores manually or click <span className="text-amber-300 font-bold">&quot;Simulate All Group Matches&quot;</span>. Real-time tiebreak rules rank the qualified idols.
              </p>
            </div>
            <span className="text-[10px] text-amber-200/50 font-mono">&rarr; Tab: Group Stage</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-black text-amber-400 text-xs">
                <span className="h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center font-black text-[10px]">
                  4
                </span>
                <span>Knockout &amp; Crown</span>
              </div>
              <p className="text-slate-300 mt-1 leading-relaxed">
                Single-elimination bracket with Best of 5 series and Best of 7 Finals. Finalizing crowns the champion and archives the season.
              </p>
            </div>
            <span className="text-[10px] text-amber-200/50 font-mono">&rarr; Tab: Knockout Bracket</span>
          </div>
        </div>
      </div>

      {/* SYSTEM FLOW 2: LEAGUE SYSTEM & WILDCARD PLAY-IN */}
      <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
        <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2 border-b-2 border-black pb-3">
          <Table className="h-6 w-6 text-amber-400" />
          <span>2. League Divisions &amp; Champions Tournament Qualification</span>
        </h3>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            The League System features <span className="text-amber-300 font-bold">6 Distinct Divisions</span> (Premier Division, Championship Division, Division 1, 2, 3, and 4), each hosting 20 idol clubs competing across a full <span className="text-amber-300 font-bold">38-Matchday Home/Away double round-robin</span> schedule.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" /> Top 5 Auto-Qualifiers (30 Idols)
              </span>
              <p className="text-slate-400 text-[11px]">
                The top 5 idols in each of the 6 divisions automatically qualify for the prestigious 32-Competitor Champions Tournament.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Swords className="w-4 h-4 text-purple-400" /> Wildcard Play-In (2 Qualifiers)
              </span>
              <p className="text-slate-400 text-[11px]">
                The 6th-place finishers from each division enter a double-elimination Play-In bracket. The Upper Bracket Champion and Lower Bracket Champion claim the final 2 spots!
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-yellow-400" /> Advancement Pipeline
              </span>
              <p className="text-slate-400 text-[11px]">
                Clicking <span className="text-white font-bold">&quot;Advance Top 32 to Champions Tournament&quot;</span> seamlessly imports the 32 champions into a new Tournament Cup season.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM FLOW 3: IDOL RATING (0-100) & SIMULATION FORMULA */}
      <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
        <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2 border-b-2 border-black pb-3">
          <Sliders className="h-6 w-6 text-amber-400" />
          <span>3. Global Idol Rating System (Scale 0 &ndash; 100)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="p-4 rounded-2xl bg-black/60 border border-black space-y-2">
            <span className="font-bold text-amber-400 text-sm block">How Ratings Influence Simulations</span>
            <p className="leading-relaxed text-slate-300">
              Every idol possesses a custom skill rating between <span className="text-amber-300 font-bold">0 and 100</span>.
              The simulation engine uses a calibrated logistic win curve based on rating differential (&Delta; = Rating A &minus; Rating B):
            </p>
            <div className="p-2.5 rounded-xl bg-black/90 font-mono text-[11px] text-amber-300 border border-amber-500/20">
              P(A Wins) = 1 / (1 + 10^(-(RatingA - RatingB) / 28))
            </div>
            <p className="text-[11px] text-slate-400">
              Win probabilities are strictly clamped between 5% and 95%, ensuring that underdog upsets and dramatic comeback storylines remain mathematically possible!
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-black/60 border border-black space-y-2">
            <span className="font-bold text-amber-400 text-sm block">Rating Tier Classification</span>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between p-1.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                <span>S+ Tier (95 - 100)</span>
                <span>Immortal / God Tier</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-amber-400/10 text-amber-400 font-bold">
                <span>S Tier (90 - 94)</span>
                <span>Superstar / Elite Contender</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                <span>A Tier (80 - 89)</span>
                <span>All-Star Powerhouse</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-indigo-500/10 text-indigo-400 font-bold">
                <span>B Tier (70 - 79)</span>
                <span>Solid Contender</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-amber-600/10 text-amber-500 font-bold">
                <span>C Tier (60 - 69)</span>
                <span>Challenger Tier</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-800 text-slate-400 font-bold">
                <span>D Tier (&lt; 60)</span>
                <span>Underdog</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SYSTEM FLOW 4: HISTORICAL DATA & MILESTONE BADGES */}
      <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 shadow-xl space-y-4 poster-shadow-lg">
        <h3 className="font-poster-title text-base sm:text-lg text-amber-300 flex items-center gap-2 border-b-2 border-black pb-3">
          <Flame className="h-6 w-6 text-amber-400" />
          <span>4. Historical Records &amp; Milestone Achievement Engine</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-indigo-400" /> Unified Match Database
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Every match across tournament group stages, knockout series, and league seasons is indexed with idempotent duplicate-prevention keys.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <GitCompare className="w-4 h-4 text-purple-400" /> Tale of the Tape H2H
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Compare any two idols side-by-side: view rating, major titles, win rates, direct head-to-head scorelines, recent form, and heated rivalries.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border border-black space-y-1.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400" /> Milestone Badges
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Autofilled achievement engine reads past match records to award badges: Dynasty Supreme (4-Peat), Hattrick Champion, Back-to-Back, Invincible Season, and Century Club!
            </p>
          </div>
        </div>
      </div>

      {/* SYSTEM CHANGELOG */}
      <div className="rounded-3xl border-3 border-black bg-[#1a120d] p-6 space-y-3 shadow-xl poster-shadow-lg">
        <h3 className="font-poster-title text-base text-amber-300 border-b-2 border-black pb-2 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>Release Notes &amp; Engine Changelog</span>
        </h3>

        <ul className="space-y-2 text-xs text-slate-300">
          <li className="flex items-start gap-2">
            <span className="rounded bg-amber-400 text-black font-black px-2 py-0.5 text-[10px] mt-0.5">
              v3.0 (Current)
            </span>
            <span>
              Added Global 0-100 Idol Rating Manager above Seed Manager; integrated rating-based Elo win curves across all simulation systems; fixed League Division record synchronization and table expansion in All-Time Records; added Historical Milestone Achievement Badges; enhanced Head-to-Head Tale of the Tape with titles and winrates; updated comprehensive System Flow Guide.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="rounded bg-black/60 text-slate-400 font-bold px-2 py-0.5 text-[10px] mt-0.5 border border-black">
              v2.5
            </span>
            <span>
              Expanded League System with 6 divisions, 38 matchdays, 6th-place double-elimination Wildcard Play-In, and Top 32 Champions Tournament advancement pipeline.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
