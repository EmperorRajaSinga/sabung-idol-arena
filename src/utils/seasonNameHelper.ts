/**
 * Season & Tournament Name Persistence and Auto-Increment Helper
 *
 * Ensures that when a user customizes their season or tournament name (e.g., "Icon Cup Season 1"),
 * the custom title is preserved across all season transitions, league completions, and resets,
 * automatically updating the season number (e.g. to "Icon Cup Season 2").
 */

/**
 * Extracts the base tournament name without the season number suffix.
 * e.g., "Icon Cup Season 1" -> "Icon Cup"
 * e.g., "Premier Cup S2" -> "Premier Cup"
 * e.g., "Idol Grand Prix 1" -> "Idol Grand Prix"
 * e.g., "Season 3" -> ""
 */
export function extractBaseTournamentName(name?: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();

  // If it's just "Season X" or "S X", there is no custom base name
  if (/^(season|seaon|s)[\s._-]*\d+$/i.test(trimmed)) {
    return '';
  }

  // Remove trailing patterns like:
  // " (Season 1)", " - Season 1", " Season 1", " Seaon 1", " S1", " - S1", " 1"
  const cleaned = trimmed
    .replace(/\s*[\(\[]?\s*(?:season|seaon)\s*\d+\s*[\)\]]?$/i, '')
    .replace(/\s*[\(\[]?\s*s\.?\s*\d+\s*[\)\]]?$/i, '')
    .replace(/[\s\-_]+(?:season|seaon)\s*\d+$/i, '')
    .replace(/[\s\-_]+s\d+$/i, '')
    .replace(/[\s\-_]+\d+$/, '')
    .trim();

  return cleaned;
}

/**
 * Increments the season number in a tournament or league season name.
 * If user customized the name (e.g. "Icon Cup Season 1"), it produces "Icon Cup Season 2".
 * If user typed "Icon Cup 1", it produces "Icon Cup 2".
 * If user typed "Icon Cup", it produces "Icon Cup Season 2".
 * If default "Season 1", it produces "Season 2".
 */
export function incrementSeasonName(
  currentName?: string,
  nextSeasonNumber = 2,
  fallbackPrefix = 'Season'
): string {
  if (!currentName || typeof currentName !== 'string' || !currentName.trim()) {
    return `${fallbackPrefix} ${nextSeasonNumber}`;
  }

  const trimmed = currentName.trim();

  // Pattern 1: Parenthesized or bracketed season "(Season 1)" or "(Season 01)"
  if (/(\(\s*(?:season|seaon)\s*)\d+(\s*\))/i.test(trimmed)) {
    return trimmed.replace(
      /(\(\s*(?:season|seaon)\s*)\d+(\s*\))/i,
      `$1${nextSeasonNumber}$2`
    );
  }

  // Pattern 2: "Season X" or typo "Seaon X" (case-insensitive)
  if (/(?:season|seaon)\s*\d+/i.test(trimmed)) {
    return trimmed.replace(/(season|seaon)\s*\d+/i, `Season ${nextSeasonNumber}`);
  }

  // Pattern 3: "S1" or "S.1" or "S-1"
  if (/\bS[\.\-_]?\s*\d+\b/i.test(trimmed)) {
    return trimmed.replace(/\bS([\.\-_]?)\s*\d+\b/i, `S$1${nextSeasonNumber}`);
  }

  // Pattern 4: Ends with a number e.g. "Icon Cup 1"
  if (/\b\d+$/.test(trimmed)) {
    return trimmed.replace(/\b\d+$/, `${nextSeasonNumber}`);
  }

  // Pattern 5: Base name with no number e.g. "Icon Cup" -> "Icon Cup Season 2"
  return `${trimmed} Season ${nextSeasonNumber}`;
}

/**
 * Formats a season name based on a base custom name and season number.
 */
export function formatSeasonNameWithBase(
  baseName: string | undefined,
  seasonNumber: number,
  fallbackPrefix = 'Season'
): string {
  const base = extractBaseTournamentName(baseName);
  if (base) {
    return `${base} Season ${seasonNumber}`;
  }
  return `${fallbackPrefix} ${seasonNumber}`;
}
