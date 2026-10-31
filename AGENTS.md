# AI Agent Guidelines & System Architecture (Sabung Idol Arena)

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & REMIXES**:
> Read this document completely BEFORE making any code edits.
> You must strictly preserve the existing UI aesthetic, database structures, simulation formulas, and running game loops.
> **DO NOT** rewrite existing working systems or delete active components to solve bugs. Always make targeted, additive, backward-compatible modifications through development gates.

---

## 1. 🎨 Visual Identity & Aesthetic Standard ("Warm Dark Arcade / Esports Arena")

All visual changes must maintain the signature style of Sabung Idol Arena:
- **Backgrounds**: Deep espresso and warm obsidian (`#170e08`, `#20120a`, `bg-black/80`).
- **Borders & Shadows**: High-contrast black outlines (`border-2` or `border-3 border-black`), with subtle warm amber accents (`border-amber-500/30`), and poster card depth (`poster-shadow-lg`, `rounded-2xl` / `rounded-3xl`).
- **Color Coding**:
  - Gold / Amber (`text-amber-400`, `text-yellow-300`): Championships, Ratings, Major Titles.
  - Emerald Neon (`text-emerald-400`, `bg-emerald-950`): Wins, Positive Progression, Podiums.
  - Rose / Crimson (`text-rose-400`, `bg-rose-950`): Losses, Underperformance, Elimination.
  - Indigo / Purple (`text-indigo-400`, `text-purple-400`): Knockout stages, Champions Qualification, Wildcard Play-Ins.
  - Cyan / Sky (`text-cyan-400`): High-speed stats, League division telemetry.
- **Typography**: Header display titles use poster fonts with high tracking and bold weighting. Monospace font is strictly reserved for ratings, seed badges, win-loss records, and scorelines.
- **NEVER Slop-ify**: Do not convert the design to generic white-mode cards, standard bootstrap layouts, or generic purple SaaS gradients.

---

## 2. 🛡️ Non-Destructive Architecture & Backward Compatibility Rules

When adding new features or fixing issues, adhere strictly to these safety boundaries:

1. **Never Destroy or Overwrite Running Systems**:
   - Do not replace the existing 6-division league engine, group stage logic, knockout bracket generator, or rating calculator with generic prototypes.
   - Any new feature (e.g., domestic cup, additional divisions, trade window, live commentary) must be built as an **additive module** or hooked into `/src/utils/developmentGates.ts`.
2. **Safe State & Storage Migrations**:
   - User tournament saves, active league standings, and career archives live in `localStorage` (`sabung_league_season_state_v1`, `sabung_tournament_state_v1`, etc.).
   - Always write defensive fallbacks (e.g. `(leagueArchives || []).forEach(...)`, `gate?.directQualifiersPerDivision ?? 5`).
   - Never wipe or reset existing keys when adding a new field to data structures.
3. **No Promotion / Relegation in the 6 Leagues**:
   - The 6 active leagues (Idol Premier League, Div 2, Div 3, Div 4, Div 5, Div 6) are **parallel, equal-tier divisions** with fixed rosters of 20 idols each.
   - Do not re-introduce promotion or relegation logic. Use **Division Championships**, **Top-3 Podium Finishes**, and **Top-5 Champions Tournament Qualifications**.

---

## 🚨 MANDATORY RULE: ABSOLUTE DATA PERSISTENCE & ZERO DATA LOSS ON REFRESH

> **CRITICAL DIRECTIVE FOR ALL FUTURE AI AGENTS, DEVELOPERS & EXTENSIONS**:
> All user tournament histories, season archives, match logs, and idol stats MUST PERSIST 100% RELIABLY ACROSS BROWSER REFRESHES AND SESSIONS.
> UNDER NO CIRCUMSTANCES SHALL ANY DATA BE LOST, WIPED, OR TRUNCATED ON PAGE RELOAD.
> ANY CODE VIOLATING THESE PERSISTENCE MANDATES IS A CATASTROPHIC REGRESSION.

### A. Strict Storage & Persistence Directives
1. **Never Truncate Season Arrays on Quota Pressure**:
   - **NEVER** use destructive array slicing such as `archives.slice(0, 2)` or `leagueArchives.slice(-2)` to relieve storage limits. Every single season archive that was ever simulated or played (Seasons 1 through N) must remain permanently stored.
   - If `localStorage` quota (~5MB) is tight, compact older historical seasons by stripping bulky individual match records (`allMatches: []`), but **ALWAYS** preserve the season archive objects, headers, division champions, podium finishers, and final standings.
   - Full fidelity data (including all base64 photos, entire match histories, and complete match logs) must ALWAYS be persisted to IndexedDB (`IdolTournamentDB`).
2. **Strict Hydration Guard (Prevent Pre-Hydration Overwrites)**:
   - When the web application mounts, asynchronous hydration from IndexedDB takes time.
   - **NEVER** trigger storage write operations (`saveAppState`, `saveTournamentArchives`, `saveLeagueArchives`, `saveTheIdolsArchives`, or auto-reconciliation) before initial IndexedDB hydration has completely resolved (`isHydratedRef.current === true`).
   - Writing before hydration is complete will overwrite persistent database records with partial or empty defaults, wiping user data on refresh.
3. **Dynamic Season Determination (Derived from Database Truth)**:
   - The current active season number and total seasons played must **NEVER** be hardcoded or read solely from an unverified config number that can desynchronize or get stuck.
   - The active season count MUST ALWAYS be dynamically calculated based on how many seasons have actually been played, archived, and stored in the database:
     $$\text{currentSeasonNumber} = \max(\text{highestArchivedSeason} + 1, \text{highestStoredMatchSeason}, 1)$$
   - Total seasons completed must be computed from distinct archived season numbers across formats, never by adding format lengths together.
   - If archives contain Season 67, the active season is Season 68. The system must automatically synchronize `config.seasonNumber`, `config.seasonId`, `leagueState.seasonNumber`, and `theIdolsState.seasonNumber` to match this reality.

---

## 3. ⚙️ Core System Architecture Reference

### A. League Divisions & Postseason Flow
- **6 Parallel Divisions**: 20 idols per league = 120 total idols.
- **Season Schedule**: Double round-robin (38 matchdays).
- **Champions Tournament (32 Idols)**:
  - **30 Direct Automatic Qualifiers**: Top 5 idols from each of the 6 divisions.
  - **2 Wildcard Qualifiers**: Determined via the **Wildcard Play-In** tournament (6th place contenders from each division battle in a playoff).
  - **Format**: 8 groups of 4 idols $\rightarrow$ Top 2 advance to 16-idol Single Elimination Knockout.

### B. Rating Progression Engine (`/src/utils/ratingHelper.ts`)
- Ratings range from 35 to 99.
- Progression combines match win rates across all sources: **Group Stage + Knockout Bracket + League Matchdays**.
- **Asymmetric Growth**:
  - Elite idols (80+) face diminishing returns on wins and higher penalty on underdog upsets.
  - Underdogs (<70) enjoy higher upside on breakthrough runs with drop dampening.
  - Bonus points awarded for **Division Championships (+1.4)**, **Podium Finishes (+0.8)**, **Champions Qualification (+0.5)**, and **Tournament Titles**.
  - Clamped between **-4 and +4 points** per season to maintain realistic progression balance.

### C. Development Gates (`/src/utils/developmentGates.ts`)
- Use this file as the official toggle gate whenever expanding capabilities:
  - `LeagueSystemGateConfig`: Add more divisions or change roster sizes.
  - `TournamentQualificationGateConfig`: Change qualification quotas or expand bracket sizes (32 $\rightarrow$ 48/64).
  - `PlayInFormatGateConfig`: Switch play-in tournament formats (Dual-Finals, 8-Idol KO, Mini-Group, Gauntlet, Swiss).
  - `ExperimentalFeatureGates`: Toggle Domestic Cups, Secondary Cups, or Roster Drafts.

---

## 4. 🚀 Quick Checklist for Future AI Tasks
- [ ] Check `developmentGates.ts` before creating new tournament/league types.
- [ ] Run `npm run lint` (`lint_applet`) and verify build succeeds without regressions.
- [ ] Maintain consistent dark theme colors, poster typography, and retro arcade UI accents.
- [ ] Ensure all existing stats, records, ratings, and archived matches remain fully accessible.

---

## 5. v4 Format Rules (added, do not remove)

- **Best of 4 (draws allowed, 4 games always played, results 4-0, 3-1, 2-2, 1-3, 0-4)**: league matchdays, The Idols phase 1, Unzure Cup group stage, LCQ. Points 3 / 1 / 0.
- **Best of 3**: Swiss play-in. **Best of 5**: knockout from Round of 32 to Semi Finals and The Idols playoff. **Best of 7**: Third Place Match, Grand Final, The Idols grand final.
- Swiss pairing never repeats an opponent when a rematch-free pairing exists (`pairSubgroupWithoutRematches`).
- A season cannot be archived while a competition is unfinished (`src/utils/seasonGuard.ts`).
- Removed on purpose (weight): match-modal minigames, Gacha showcase, Idol Gwent. Their saved data keys are untouched.
- Run `npm test` after any change to simulation or format code. It simulates a full season from `tests/fixtures/idols_and_groups.json` and checks 38 invariants (match counts, formats, qualification math, no duplicate IDs).
- `npm run build:single` makes the one-file website in `dist-single/`.
- Idol Profile league totals count only division matches. The Idols matchdays, Swiss and LCQ are separate competitions (`tests/profile.test.ts`).
- Swiss contains only league ranks 7-16 plus the best four 17th places. Ranks 1-6 never enter Swiss, and the legacy Wildcard Play-In is not played in the 64-idol format (`tests/swiss_ranks.test.ts`).
- League Branding & Rosters import rebuilds fixtures and standings, works with no league season yet, resolves idols by ID or by name, and reports unknown or duplicate idols (`src/utils/leagueRosterImport.ts`, `tests/roster_import.test.ts`).
