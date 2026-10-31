import { Idol, GirlGroup, AppState, LeagueSeasonState, TheIdolsSeasonState } from '../types';

/**
 * Compresses a base64 image data URI using an offscreen HTML canvas.
 * Reduces raw 5MB-10MB mobile/camera images down to ~15-30KB with high visual fidelity.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxWidth: number = 240,
  maxHeight: number = 240,
  quality: number = 0.78
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  // If already very short (< 4KB), no need to compress
  if (dataUrl.length < 4000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first for ultra-lean compression, fallback to JPEG
          let compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp') || compressed.length >= dataUrl.length) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          // Return whichever is smaller
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Optimizes the entire application state by compressing all idol photos, group logos,
 * and stripping duplicated base64 images from historical matches/archives (they resolve by idolId dynamically).
 */
export async function optimizeAppStateImages(
  appState: AppState,
  leagueState?: LeagueSeasonState | null,
  theIdolsState?: TheIdolsSeasonState | null
): Promise<{
  optimizedAppState: AppState;
  optimizedLeagueState: LeagueSeasonState | null;
  optimizedTheIdolsState: TheIdolsSeasonState | null;
  savedBytesEstimate: number;
}> {
  const initialJson = JSON.stringify({ appState, leagueState, theIdolsState });
  const initialBytes = initialJson.length;

  // 1. Compress idol photos
  const optimizedIdols: Idol[] = await Promise.all(
    appState.idols.map(async (idol) => {
      if (idol.photoUrl && idol.photoUrl.startsWith('data:image')) {
        const compressed = await compressImageDataUrl(idol.photoUrl, 240, 240, 0.78);
        return { ...idol, photoUrl: compressed };
      }
      return idol;
    })
  );

  // 2. Compress girl group logos
  const optimizedGroups: GirlGroup[] = await Promise.all(
    appState.girlGroups.map(async (group) => {
      if (group.logoUrl && group.logoUrl.startsWith('data:image')) {
        const compressed = await compressImageDataUrl(group.logoUrl, 160, 160, 0.78);
        return { ...group, logoUrl: compressed };
      }
      return group;
    })
  );

  // 3. Compress app logo
  let optimizedAppLogo = appState.appLogoUrl || '';
  if (optimizedAppLogo && optimizedAppLogo.startsWith('data:image')) {
    optimizedAppLogo = await compressImageDataUrl(optimizedAppLogo, 200, 200, 0.78);
  }

  // 4. Strip duplicate base64 photos from matchDatabase (photos are resolved from idols list)
  const optimizedMatchDatabase = (appState.matchDatabase || []).map((m) => {
    if ((m.idolAPhoto && m.idolAPhoto.length > 200) || (m.idolBPhoto && m.idolBPhoto.length > 200)) {
      return {
        ...m,
        idolAPhoto: m.idolAPhoto && m.idolAPhoto.startsWith('data:image') ? '' : m.idolAPhoto,
        idolBPhoto: m.idolBPhoto && m.idolBPhoto.startsWith('data:image') ? '' : m.idolBPhoto,
      };
    }
    return m;
  });

  // 5. Clean tournament archives
  const optimizedArchives = (appState.archives || []).map((arch) => ({
    ...arch,
    groups: (arch.groups || []).map((g: any) => ({
      ...g,
      matches: (g.matches || []).map((gm: any) => ({
        ...gm,
        ...(gm.idolAPhoto && typeof gm.idolAPhoto === 'string' && gm.idolAPhoto.startsWith('data:image') ? { idolAPhoto: '' } : {}),
        ...(gm.idolBPhoto && typeof gm.idolBPhoto === 'string' && gm.idolBPhoto.startsWith('data:image') ? { idolBPhoto: '' } : {}),
      })),
    })),
    knockoutMatches: (arch.knockoutMatches || []).map((km: any) => ({
      ...km,
      ...(km.idolAPhoto && typeof km.idolAPhoto === 'string' && km.idolAPhoto.startsWith('data:image') ? { idolAPhoto: '' } : {}),
      ...(km.idolBPhoto && typeof km.idolBPhoto === 'string' && km.idolBPhoto.startsWith('data:image') ? { idolBPhoto: '' } : {}),
    })),
  }));

  const optimizedAppState: AppState = {
    ...appState,
    appLogoUrl: optimizedAppLogo,
    idols: optimizedIdols,
    girlGroups: optimizedGroups,
    matchDatabase: optimizedMatchDatabase,
    archives: optimizedArchives,
  };

  const finalJson = JSON.stringify({
    appState: optimizedAppState,
    leagueState,
    theIdolsState,
  });
  const finalBytes = finalJson.length;
  const savedBytesEstimate = Math.max(0, initialBytes - finalBytes);

  return {
    optimizedAppState,
    optimizedLeagueState: leagueState || null,
    optimizedTheIdolsState: theIdolsState || null,
    savedBytesEstimate,
  };
}
