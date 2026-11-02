import type { CustomThemeConfig } from '../types';
import { contrastRatio, hexToRgb, isDark, mix, newCustomTheme, rgbToHex } from './customTheme';

// color palettes: build one from a color and a rule of harmony, shuffle, pull one from a picture, keep it with notes.

export interface Palette {
  id: string;
  name: string;
  colors: string[]; // 2 to 8 colors as #rrggbb
  notes: string;
  // the document it was made for, when it belongs to one story
  projectId?: string;
}

export const MIN_COLORS = 2;
export const MAX_COLORS = 8;
export const MAX_SAVED = 60;
const HEX = /^#[0-9a-f]{6}$/i;

// ---- color math -----------------------------------------------------------

export interface Hsl { h: number; s: number; l: number } // h 0-360, s and l 0-100

export function hexToHsl(hex: string): Hsl {
  const c = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = c.map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// black or white, whichever reads better on the color
export const bestText = (hex: string): '#111111' | '#ffffff' => (contrastRatio(hex, '#111111') >= contrastRatio(hex, '#ffffff') ? '#111111' : '#ffffff');

// ---- harmonies ------------------------------------------------------------

export const SCHEMES = [
  { id: 'analogous', name: 'Neighbors', blurb: 'Colors side by side on the wheel. Calm and cohesive.' },
  { id: 'complementary', name: 'Opposites', blurb: 'A color and its opposite. Strong contrast.' },
  { id: 'split', name: 'Split opposites', blurb: 'A color and the two beside its opposite. Contrast with less tension.' },
  { id: 'triadic', name: 'Three-way', blurb: 'Three colors evenly around the wheel. Lively.' },
  { id: 'tetradic', name: 'Four-way', blurb: 'Two pairs of opposites. Rich, needs a dominant color.' },
  { id: 'monochrome', name: 'One color', blurb: 'One hue from light to dark.' },
] as const;
export type SchemeId = (typeof SCHEMES)[number]['id'];

// n colors from a base color. the first is always the base.
export function harmony(base: string, scheme: SchemeId, n = 5): string[] {
  const b = hexToHsl(base);
  const count = Math.max(MIN_COLORS, Math.min(MAX_COLORS, n));
  const turns: Record<SchemeId, number[]> = {
    analogous: [0, 30, -30, 60, -60, 90, -90, 120],
    complementary: [0, 180, 20, 200, -20, 160, 40, 220],
    split: [0, 150, 210, 30, 180, -30, 120, 240],
    triadic: [0, 120, 240, 30, 150, 270, 60, 180],
    tetradic: [0, 90, 180, 270, 30, 120, 210, 300],
    monochrome: [],
  };
  if (scheme === 'monochrome') {
    // light to dark, the base somewhere in the middle
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      return hslToHex({ h: b.h, s: Math.round(b.s * (0.55 + 0.45 * Math.sin(Math.PI * t))), l: Math.round(92 - t * 76) });
    });
  }
  return turns[scheme].slice(0, count).map((turn, i) => {
    // vary the lightness a little, so a palette is not five equally bright colors
    const l = i === 0 ? b.l : Math.max(14, Math.min(88, b.l + [0, 8, -10, 14, -16, 6, -6, 10][i % 8]));
    return hslToHex({ h: b.h + turn, s: b.s, l });
  });
}

// new colors for the ones that are not kept
export function shuffle(colors: string[], kept: boolean[], rng: () => number = Math.random): string[] {
  const keep = colors.filter((_, i) => kept[i]);
  const base = keep.length ? hexToHsl(keep[0]) : { h: Math.round(rng() * 360), s: 45 + Math.round(rng() * 40), l: 40 + Math.round(rng() * 25) };
  const fresh = harmony(hslToHex(base), SCHEMES[Math.floor(rng() * SCHEMES.length)].id, colors.length);
  const pool = fresh.map(c => { const h = hexToHsl(c); return hslToHex({ h: h.h + Math.round((rng() - 0.5) * 24), s: Math.max(15, Math.min(95, h.s + Math.round((rng() - 0.5) * 24))), l: Math.max(12, Math.min(90, h.l + Math.round((rng() - 0.5) * 16))) }); });
  let at = 0;
  return colors.map((c, i) => (kept[i] ? c : pool[at++ % pool.length]));
}

// ---- starting points ---------------------------------------------------------

export const STARTER_PALETTES: Array<{ name: string; colors: string[] }> = [
  { name: 'Autumn fire', colors: ['#3a1f14', '#8c3b1a', '#d9622b', '#f0a53a', '#f6e1b6'] },
  { name: 'Deep sea', colors: ['#06192e', '#0b3d5c', '#1b7a8c', '#6cc3c6', '#e3f4f1'] },
  { name: 'Noir', colors: ['#0c0c10', '#2a2a36', '#6b6b7d', '#c9c9d6', '#c0362c'] },
  { name: 'Pastel dream', colors: ['#fbd5e0', '#e8d5f5', '#d0e6f8', '#d4f0df', '#fff3c9'] },
  { name: 'Old library', colors: ['#2b1d14', '#5a3a22', '#9c6b3a', '#d7b98a', '#f1e6cf'] },
  { name: 'Forest at dusk', colors: ['#0e1f17', '#244a36', '#4f7a55', '#c9a15a', '#5b3b6e'] },
  { name: 'Winter morning', colors: ['#1d2b45', '#4a6a94', '#9bbad8', '#dce9f5', '#f3c9b5'] },
  { name: 'Candy shop', colors: ['#ff5d8f', '#ffb347', '#ffe66d', '#4ecdc4', '#6a4c93'] },
  { name: 'Dust and rust', colors: ['#2d2a26', '#6e5a47', '#b5835a', '#d9b99b', '#a33b20'] },
  { name: 'Moonlit garden', colors: ['#0f1530', '#2b3a67', '#7a8cc4', '#cfe0c3', '#f2e9b8'] },
];

// ---- from a picture ------------------------------------------------------------

// the colors a picture is mostly made of. `pixels` is rgba bytes, as a canvas gives them.
export function dominantColors(pixels: ArrayLike<number>, n = 5): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4 * 3) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    // 4 bits a channel: close colors fall in one bucket
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key);
    if (e) { e.r += r; e.g += g; e.b += b; e.count++; } else buckets.set(key, { r, g, b, count: 1 });
  }
  const ranked = [...buckets.values()].sort((a, b) => b.count - a.count).map(e => rgbToHex([e.r / e.count, e.g / e.count, e.b / e.count]));
  // pick the most common, skipping any too close to one already chosen, so five browns do not crowd out the rest
  const out: string[] = [];
  for (const c of ranked) {
    const rgb = hexToRgb(c)!;
    if (out.every(o => { const q = hexToRgb(o)!; return Math.hypot(rgb[0] - q[0], rgb[1] - q[1], rgb[2] - q[2]) > 48; })) out.push(c);
    if (out.length >= n) break;
  }
  return out;
}

// ---- keeping them --------------------------------------------------------------

export const newPaletteId = () => `custom-pal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function cleanPalette(raw: { id: string } & Partial<Palette>): Palette {
  const colors = (Array.isArray(raw.colors) ? raw.colors : []).filter((c): c is string => typeof c === 'string' && HEX.test(c)).map(c => c.toLowerCase()).slice(0, MAX_COLORS);
  const palette: Palette = {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 40) || 'My palette',
    colors: colors.length >= MIN_COLORS ? colors : ['#3a1f14', '#d9622b', '#f6e1b6'],
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 600) : '',
  };
  if (typeof raw.projectId === 'string' && raw.projectId) palette.projectId = raw.projectId;
  return palette;
}

export const toHexList = (colors: string[]) => colors.map(c => c.toUpperCase()).join('\n');
export const toCssVars = (colors: string[]) => `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c.toLowerCase()};`).join('\n')}\n}`;

// ---- a theme made from a palette ---------------------------------------------------

// the lightest color becomes the page and the darkest the text (or the reverse for a dark theme),
// the most colorful become the accents. the text is pushed lighter or darker until it can be read.
export function themeFromPalette(colors: string[], opts: { name: string; dark?: boolean }): CustomThemeConfig {
  const byLight = [...colors].sort((a, b) => hexToHsl(b).l - hexToHsl(a).l);
  const byColor = [...colors].sort((a, b) => hexToHsl(b).s * (50 - Math.abs(hexToHsl(b).l - 50)) - hexToHsl(a).s * (50 - Math.abs(hexToHsl(a).l - 50)));
  const light = byLight[0];
  const darkest = byLight[byLight.length - 1];
  const dark = !!opts.dark;
  // a dark theme needs a dark page and a light one a light page, whatever the palette is like
  let paper = dark ? mix(darkest, '#000000', 0.25) : mix(light, '#ffffff', 0.35);
  for (let i = 0; i < 8 && (dark ? hexToHsl(paper).l > 20 : hexToHsl(paper).l < 88); i++) paper = mix(paper, dark ? '#000000' : '#ffffff', 0.3);
  let text = dark ? mix(light, '#ffffff', 0.4) : mix(darkest, '#000000', 0.35);
  for (let i = 0; i < 8 && contrastRatio(text, paper) < 7; i++) text = mix(text, dark ? '#ffffff' : '#000000', 0.25);
  const accent = byColor[0];
  const gold = byColor[1] ?? byColor[0];
  const fix = (c: string, bg: string, min: number) => {
    let out = c;
    for (let i = 0; i < 8 && contrastRatio(out, bg) < min; i++) out = mix(out, isDark(bg) ? '#ffffff' : '#000000', 0.2);
    return out;
  };
  return newCustomTheme({
    name: opts.name,
    bgApp: dark ? mix(paper, '#000000', 0.35) : mix(paper, darkest, 0.08),
    bgPaper: paper,
    textMain: text,
    textSecondary: fix(mix(text, paper, 0.3), paper, 4.5),
    accentPrimary: fix(accent, paper, 3),
    accentGold: fix(gold, paper, 3),
    borderSubtle: mix(paper, text, 0.12),
    borderStrong: mix(paper, text, 0.28),
  });
}
