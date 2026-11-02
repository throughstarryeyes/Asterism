import type { ThemeImages } from '../types';
import { getAssetUrl } from './assetStore';
import { parseCssColor } from './customTheme';
import { glassVars, hasBackdrop, joinLayers, lookLayers, type Layer } from './backdrops';

export const DEFAULT_APP_DIM = 0.45;
export const DEFAULT_PAGE_DIM = 0.35;

const clamp = (n: number) => Math.max(0, Math.min(0.95, n));

// a CSS background value: the theme's color laid over the picture at `dim`.
export function imageLayer(url: string, color: string, dim: number): string {
  const rgb = parseCssColor(color) ?? [255, 255, 255];
  const veil = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(dim)})`;
  return `linear-gradient(${veil}, ${veil}), url("${url}")`;
}

const VARS = ['--app-bg-image', '--app-bg-size', '--app-bg-repeat', '--app-bg-pos', '--page-bg-image', '--page-bg-size', '--page-bg-repeat', '--page-bg-pos', '--glass-bg', '--glass-blur'] as const;
const ATTRS = ['data-app-bg', 'data-page-bg', 'data-page-glass'] as const;

export function clearThemeImages(root: HTMLElement = document.documentElement): void {
  VARS.forEach(v => root.style.removeProperty(v));
  ATTRS.forEach(a => root.removeAttribute(a));
}

// applies stored images and returns a function that cancels if the theme changes first
// custom themes know their colors for tinting; built-in themes are read back from the page
export interface ImageTheme extends ThemeImages {
  bgApp: string;
  bgPaper: string;
}

export function applyThemeImages(theme: ImageTheme | undefined, root: HTMLElement = document.documentElement): () => void {
  let canceled = false;
  const wants = !!theme && (theme.appBgImageId || theme.pageBgImageId || hasBackdrop(theme.appLook) || hasBackdrop(theme.pageLook) || (theme.pageLook?.glass ?? 0) > 0);
  if (!theme || !wants) {
    clearThemeImages(root);
    return () => undefined;
  }
  // a picture goes over the look behind it. its own two layers (a veil of the theme color, then the picture) are listed together.
  const compose = (url: string | undefined, color: string, dim: number, look: ImageTheme['appLook'], strength = 1) => {
    const layers: Layer[] = [];
    const behind = lookLayers(look, strength);
    const stars = look?.stars ? Math.max(0, lookLayers({ stars: look.stars }).length) : 0;
    if (stars) layers.push(...behind.slice(0, stars));
    if (url) layers.push({ image: imageLayer(url, color, dim), size: 'auto, cover', repeat: 'no-repeat, no-repeat' });
    layers.push(...behind.slice(stars));
    return layers.length ? joinLayers(layers) : null;
  };
  const put = (side: 'app' | 'page', j: ReturnType<typeof joinLayers> | null) => {
    if (!j) {
      ['image', 'size', 'repeat', 'pos'].forEach(k => root.style.removeProperty(`--${side}-bg-${k}`));
      root.removeAttribute(`data-${side}-bg`);
      return;
    }
    root.style.setProperty(`--${side}-bg-image`, j.image);
    root.style.setProperty(`--${side}-bg-size`, j.size);
    root.style.setProperty(`--${side}-bg-repeat`, j.repeat);
    root.style.setProperty(`--${side}-bg-pos`, j.position);
    root.setAttribute(`data-${side}-bg`, '');
  };
  (async () => {
    const [appUrl, pageUrl] = await Promise.all([
      theme.appBgImageId ? getAssetUrl(theme.appBgImageId) : undefined,
      theme.pageBgImageId ? getAssetUrl(theme.pageBgImageId) : undefined,
    ]);
    if (canceled) return;
    put('app', compose(appUrl, theme.bgApp, theme.appBgDim ?? DEFAULT_APP_DIM, theme.appLook));
    const glass = glassVars(theme.pageLook, theme.bgPaper);
    put('page', compose(pageUrl, theme.bgPaper, theme.pageBgDim ?? DEFAULT_PAGE_DIM, theme.pageLook, glass ? 1 - theme.pageLook!.glass! * 0.75 : 1));
    if (glass) {
      root.style.setProperty('--glass-bg', glass.bg);
      root.style.setProperty('--glass-blur', glass.blur);
      root.setAttribute('data-page-glass', '');
    } else {
      root.style.removeProperty('--glass-bg');
      root.style.removeProperty('--glass-blur');
      root.removeAttribute('data-page-glass');
    }
  })().catch(e => console.warn('Could not apply theme images', e));
  return () => { canceled = true; };
}

// does a theme's picture setup hold anything: a picture, or a look behind the app or the page
export const hasThemeImages = (i: ThemeImages | undefined): boolean => !!i && !!(i.appBgImageId || i.pageBgImageId || i.appLook || i.pageLook);

// every asset id the given themes refer to (so unused ones can be pruned).
export function themeAssetIds(themes: Array<ThemeImages | undefined>): string[] {
  return themes.flatMap(t => (t ? [t.appBgImageId, t.pageBgImageId] : [])).filter((x): x is string => !!x);
}
