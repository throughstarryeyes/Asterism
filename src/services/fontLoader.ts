import { isSystemFont } from './systemFonts';
import { BUNDLED_FONTS } from './bundledFonts';

/**
 * utility to dynamically inject Google fonts, web font URLs, or register custom fonts in Asterism.
 */
export const fontLoader = {
  loadGoogleFont(fontName: string) {
    if (!fontName || !fontName.trim()) return;
    const clean = fontName.trim();
    if (isSystemFont(clean) || BUNDLED_FONTS.has(clean)) return;
    const id = `asterism-font-${clean.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const formattedQuery = clean.replace(/\s+/g, '+');
    link.href = `https://fonts.googleapis.com/css2?family=${formattedQuery}:ital,wght@0,300..900;1,300..900&display=swap`;
    document.head.appendChild(link);
  },

  loadFontFromUrl(url: string, fontName: string) {
    if (!url || !url.trim()) return;
    const id = `asterism-font-url-${fontName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    if (document.getElementById(id)) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = url.trim();
    document.head.appendChild(link);
  }
};
