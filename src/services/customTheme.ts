import type { CustomThemeConfig } from '../types';

// each custom theme costs this many quill points to create. editing a theme you
// already own is free. (built-in themes in the shop cost 30-65.)
export const CUSTOM_THEME_COST = 75;

export const PAPER_STYLES = ['plain', 'lined', 'grid', 'dots'] as const;
export type PaperStyle = typeof PAPER_STYLES[number];

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// hex, rgb() or rgba(): what a theme's variables may hold when read back from the page.
export function parseCssColor(value: string): Rgb | null {
  const hex = hexToRgb(value);
  if (hex) return hex;
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// blend `a` toward `b` by t (0..1).
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a), y = hexToRgb(b);
  if (!x || !y) return a;
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function rgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})` : hex;
}

export function isDark(hex: string): boolean {
  const c = hexToRgb(hex);
  if (!c) return false;
  // relative luminance, roughly.
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255 < 0.45;
}

// wcag-style contrast ratio, used to warn when text would be hard to read.
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const [r, g, b2] = c.map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// every variable a built-in theme sets, derived from the editable colors, so a
// custom theme is complete (tags, badges, hovers, shadows) and not just 13 colors.
export function deriveThemeVars(t: CustomThemeConfig): Record<string, string> {
  const dark = isDark(t.bgApp);
  const shade = dark ? '#000000' : '#1e293b';
  const lift = dark ? '#ffffff' : '#000000';
  const shadowAlpha = dark ? 0.6 : 0.12;
  const rule = t.ruleColor || mix(t.textSecondary, t.bgPaper, 0.65);
  const margin = t.marginColor || t.accentPrimary;
  return {
    '--bg-app': t.bgApp,
    '--bg-paper': t.bgPaper,
    '--bg-sidebar': mix(t.bgApp, t.bgPaper, 0.35),
    '--bg-card': mix(t.bgPaper, lift, 0.04),
    '--bg-card-hover': mix(t.bgPaper, lift, 0.09),
    '--bg-input': mix(t.bgPaper, dark ? '#000000' : '#ffffff', 0.35),
    '--border-subtle': t.borderSubtle,
    '--border-strong': t.borderStrong,
    '--text-main': t.textMain,
    '--text-secondary': t.textSecondary,
    '--text-muted': mix(t.textSecondary, t.bgPaper, 0.4),
    '--accent-primary': t.accentPrimary,
    '--accent-hover': mix(t.accentPrimary, shade, 0.2),
    '--accent-light': mix(t.bgPaper, t.accentPrimary, 0.15),
    '--accent-gold': t.accentGold,
    '--accent-gold-bg': rgba(t.accentGold, 0.16),
    '--shadow-sm': `0 1px 4px ${rgba(shade, shadowAlpha * 0.7)}`,
    '--shadow-md': `0 4px 16px ${rgba(shade, shadowAlpha)}`,
    '--shadow-paper': `0 10px 34px ${rgba(shade, shadowAlpha * 1.3)}`,
    '--shadow-glow': `0 0 22px ${rgba(t.accentGold, 0.28)}`,
    '--badge-bg': mix(t.bgPaper, lift, 0.08),
    '--tag-bg': mix(t.bgPaper, lift, 0.05),
    '--toolbar-bg': rgba(t.bgPaper, 0.94),
    '--paper-rule': rule,
    '--paper-margin': margin,
  };
}

export const DERIVED_VAR_NAMES = Object.keys(deriveThemeVars({
  id: '', name: '', bgApp: '#ffffff', bgPaper: '#ffffff', textMain: '#000000', textSecondary: '#444444',
  accentPrimary: '#3366cc', accentGold: '#cc9933', borderSubtle: '#dddddd', borderStrong: '#bbbbbb', cornerRoundness: 10,
}));

export function newCustomTheme(partial: Partial<CustomThemeConfig> = {}): CustomThemeConfig {
  return {
    id: `custom-${Date.now()}`,
    name: 'My theme',
    bgApp: '#f5f0e6',
    bgPaper: '#fffdf8',
    textMain: '#2c241b',
    textSecondary: '#6b5d4d',
    accentPrimary: '#b8742a',
    accentGold: '#c9933b',
    borderSubtle: '#e3d9c6',
    borderStrong: '#c9bb9f',
    cornerRoundness: 10,
    paperStyle: 'plain',
    marginLine: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}
