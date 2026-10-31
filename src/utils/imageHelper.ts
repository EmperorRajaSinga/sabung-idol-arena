/**
 * Image compression and optimization utility for Sabung Idol Tournament Manager.
 * Compresses uploaded images using an offscreen canvas to prevent localStorage / IndexedDB quota overflows
 * and ensure blazing fast page loads.
 */

export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's an external HTTP/HTTPS URL, don't re-compress it
    if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://'))) {
      return resolve(fileOrDataUrl);
    }

    const processImageSource = (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate aspect ratio preserving bounds
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(src);
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first, fallback to JPEG
          let compressed = '';
          try {
            compressed = canvas.toDataURL('image/webp', quality);
            if (!compressed.startsWith('data:image/webp')) {
              compressed = canvas.toDataURL('image/jpeg', quality);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(compressed);
        } catch (err) {
          console.warn('Canvas image compression failed, using original source:', err);
          resolve(src);
        }
      };

      img.onerror = () => {
        resolve(src);
      };

      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImageSource(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          processImageSource(result);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
