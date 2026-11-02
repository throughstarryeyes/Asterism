import type { Season } from './seasons';

// page textures and margin decorations. both are drawn by css (index.css), so they follow the theme's colors.

export interface Surface {
  id: string;
  name: string;
  cost: number;
  description: string;
  season?: Season;
}

export interface Texture extends Surface {
  image: string; // css background-image
  size?: string; // css background-size
}

const ink = (pct: number) => `color-mix(in srgb, var(--text-main) ${pct}%, transparent)`;
const gold = (pct: number) => `color-mix(in srgb, var(--accent-gold) ${pct}%, transparent)`;
const noise = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.1'/%3E%3C/svg%3E\")";

export const FREE_TEXTURE = 'plain';
export const FREE_EDGE = 'none';

export const TEXTURES: Texture[] = [
  { id: 'plain', name: 'Smooth', cost: 0, description: 'The page as it is.', image: 'none' },
  { id: 'grain', name: 'Paper grain', cost: 30, description: 'A fine, uneven paper fiber.', image: noise, size: '160px 160px' },
  { id: 'linen', name: 'Linen weave', cost: 40, description: 'A faint cloth crosshatch.', image: `repeating-linear-gradient(0deg, ${ink(5)} 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${ink(5)} 0 1px, transparent 1px 3px)` },
  { id: 'lined', name: 'Ruled lines', cost: 30, description: 'Notebook lines down the page.', image: `repeating-linear-gradient(to bottom, transparent 0 31px, ${ink(11)} 31px 32px)` },
  { id: 'grid', name: 'Graph paper', cost: 30, description: 'A small square grid.', image: `linear-gradient(to right, ${ink(8)} 1px, transparent 1px), linear-gradient(to bottom, ${ink(8)} 1px, transparent 1px)`, size: '28px 28px' },
  { id: 'dots', name: 'Dot grid', cost: 30, description: 'Bullet-journal dots.', image: `radial-gradient(circle, ${ink(16)} 1.2px, transparent 1.5px)`, size: '24px 24px' },
  { id: 'vellum', name: 'Warm vellum', cost: 50, description: 'Soft golden light at the corners.', image: `radial-gradient(ellipse at 15% 8%, ${gold(14)}, transparent 55%), radial-gradient(ellipse at 90% 92%, ${gold(11)}, transparent 50%)` },
  { id: 'watercolor', name: 'Watercolor wash', cost: 70, description: 'Pink, blue and green washes.', image: 'radial-gradient(ellipse at 12% 18%, rgba(240,170,190,0.2), transparent 45%), radial-gradient(ellipse at 88% 30%, rgba(160,200,230,0.2), transparent 45%), radial-gradient(ellipse at 45% 95%, rgba(190,230,180,0.18), transparent 50%)' },
  { id: 'starry', name: 'Starry night', cost: 90, description: 'Tiny stars scattered across the page.', image: `radial-gradient(circle at 12% 14%, ${gold(70)} 1px, transparent 2px), radial-gradient(circle at 78% 9%, ${gold(55)} 1px, transparent 2px), radial-gradient(circle at 35% 42%, ${gold(45)} 1px, transparent 2px), radial-gradient(circle at 90% 55%, ${gold(60)} 1.2px, transparent 2.2px), radial-gradient(circle at 22% 78%, ${gold(50)} 1px, transparent 2px), radial-gradient(circle at 64% 88%, ${gold(65)} 1px, transparent 2px)` },
  { id: 'frost', name: 'Frostlight', cost: 60, description: 'Pale blue frost and drifting flecks. Winter only.', season: 'winter', image: 'radial-gradient(ellipse at 10% 0%, rgba(190,220,250,0.3), transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(210,230,255,0.28), transparent 50%), radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1.6px)', size: 'auto, auto, 46px 46px' },
  { id: 'blossom', name: 'Blossom wash', cost: 60, description: 'Cherry pink at the edges. Spring only.', season: 'spring', image: 'radial-gradient(ellipse at 0% 0%, rgba(250,190,205,0.32), transparent 50%), radial-gradient(ellipse at 100% 85%, rgba(250,205,215,0.28), transparent 50%)' },
  { id: 'sunwarm', name: 'Sunwarm', cost: 60, description: 'Late afternoon gold. Summer only.', season: 'summer', image: 'linear-gradient(160deg, rgba(255,214,120,0.26), transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(255,170,90,0.2), transparent 50%)' },
  { id: 'leafdrift', name: 'Leaf drift', cost: 60, description: 'Amber and rust blotches. Autumn only.', season: 'autumn', image: 'radial-gradient(ellipse at 8% 12%, rgba(215,120,50,0.24), transparent 45%), radial-gradient(ellipse at 92% 40%, rgba(170,80,40,0.2), transparent 45%), radial-gradient(ellipse at 40% 100%, rgba(225,170,60,0.22), transparent 50%)' },
];

export const EDGES: Surface[] = [
  { id: 'none', name: 'Clean edges', cost: 0, description: 'Nothing in the margins.' },
  { id: 'redline', name: 'Red margin line', cost: 30, description: 'The line down the side of a school notebook.' },
  { id: 'stitched', name: 'Stitched border', cost: 40, description: 'A dashed seam sewn inside the page.' },
  { id: 'gilt', name: 'Gilt frame', cost: 60, description: 'A thin gold double frame.' },
  { id: 'corners', name: 'Corner flourishes', cost: 50, description: 'A small fleuron in two corners.' },
  { id: 'vines', name: 'Vine rows', cost: 70, description: 'Leaves along the top and bottom.' },
  { id: 'starry', name: 'Starlit sides', cost: 70, description: 'Dots of gold down both sides.' },
  { id: 'ribbon', name: 'Bookmark ribbon', cost: 80, description: 'A ribbon hanging from the top edge.' },
  { id: 'snow', name: 'Snowflake corners', cost: 50, description: 'Snowflakes in the corners. Winter only.', season: 'winter' },
  { id: 'petals', name: 'Petal corners', cost: 50, description: 'Blossoms in the corners. Spring only.', season: 'spring' },
  { id: 'sun', name: 'Sunbeam corners', cost: 50, description: 'Little suns in the corners. Summer only.', season: 'summer' },
  { id: 'leaves', name: 'Falling leaves', cost: 50, description: 'Leaves in the corners. Autumn only.', season: 'autumn' },
];

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);
const oneOf = <T extends string>(set: Record<T, string>, v: unknown, fallback: T): T => (typeof v === 'string' && v in set ? (v as T) : fallback);
const cleanName = (v: unknown, fallback: string) => (typeof v === 'string' ? v : '').replace(/[<>]/g, '').trim().slice(0, 24) || fallback;
// 'ink' follows the theme's text, 'accent' its gold, or a color of the writer's
const cleanColor = (v: unknown, fallback: 'ink' | 'accent'): string => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : v === 'ink' || v === 'accent' ? v : fallback);
const colorCss = (c: string) => (c === 'ink' ? 'var(--text-main)' : c === 'accent' ? 'var(--accent-gold)' : c);

// ---- textures the writer makes ----

export type PatternKind = 'lines' | 'grid' | 'dots' | 'crosshatch' | 'grain' | 'wash' | 'stars';
export const PATTERNS: Record<PatternKind, string> = { lines: 'Ruled lines', grid: 'Graph grid', dots: 'Dot grid', crosshatch: 'Crosshatch', grain: 'Paper grain', wash: 'Color wash', stars: 'Stars' };

export interface CustomTexture { id: string; name: string; pattern: PatternKind; color: string; strength: 1 | 2 | 3; spacing: number }
export const MIN_SPACING = 12;
export const MAX_SPACING = 48;

export function cleanTexture(raw: Partial<CustomTexture> & { id: string }): CustomTexture {
  return {
    id: raw.id,
    name: cleanName(raw.name, 'My texture'),
    pattern: oneOf(PATTERNS, raw.pattern, 'lines'),
    color: cleanColor(raw.color, 'ink'),
    strength: raw.strength === 1 || raw.strength === 3 ? raw.strength : 2,
    spacing: Math.round(clamp(raw.spacing, MIN_SPACING, MAX_SPACING, 28)),
  };
}

export function textureFrom(c: CustomTexture): Texture {
  const col = colorCss(c.color);
  const pct = { 1: 6, 2: 11, 3: 18 }[c.strength];
  const mixed = (p: number) => `color-mix(in srgb, ${col} ${p}%, transparent)`;
  const s = c.spacing;
  const base = { id: c.id, name: c.name, cost: 0, description: 'Made by you.' };
  switch (c.pattern) {
    case 'lines': return { ...base, image: `repeating-linear-gradient(to bottom, transparent 0 ${s - 1}px, ${mixed(pct)} ${s - 1}px ${s}px)` };
    case 'grid': return { ...base, image: `linear-gradient(to right, ${mixed(pct)} 1px, transparent 1px), linear-gradient(to bottom, ${mixed(pct)} 1px, transparent 1px)`, size: `${s}px ${s}px` };
    case 'dots': return { ...base, image: `radial-gradient(circle, ${mixed(pct * 1.6)} 1.2px, transparent 1.5px)`, size: `${s}px ${s}px` };
    case 'crosshatch': {
      const g = Math.max(3, Math.round(s / 6));
      return { ...base, image: `repeating-linear-gradient(0deg, ${mixed(pct / 1.5)} 0 1px, transparent 1px ${g}px), repeating-linear-gradient(90deg, ${mixed(pct / 1.5)} 0 1px, transparent 1px ${g}px)` };
    }
    case 'grain': return { ...base, image: noise, size: '160px 160px' };
    case 'wash': return { ...base, image: `radial-gradient(ellipse at 12% 10%, ${mixed(pct * 2)}, transparent 55%), radial-gradient(ellipse at 90% 92%, ${mixed(pct * 1.6)}, transparent 50%)` };
    case 'stars': return { ...base, image: `radial-gradient(circle at 12% 14%, ${mixed(pct * 5)} 1px, transparent 2px), radial-gradient(circle at 78% 9%, ${mixed(pct * 4)} 1px, transparent 2px), radial-gradient(circle at 35% 52%, ${mixed(pct * 3.5)} 1px, transparent 2px), radial-gradient(circle at 88% 70%, ${mixed(pct * 4.5)} 1.2px, transparent 2.2px), radial-gradient(circle at 24% 88%, ${mixed(pct * 4)} 1px, transparent 2px)`, size: `${s * 5}px ${s * 5}px` };
  }
}

export const findTexture = (id: string | undefined, custom: CustomTexture[] = []): Texture => {
  const mine = custom.find(t => t.id === id);
  return mine ? textureFrom(mine) : TEXTURES.find(t => t.id === id) ?? TEXTURES[0];
};

// ---- margin decorations the writer makes ----

export type EdgeStyle = 'border' | 'corners' | 'rows' | 'sides';
export type EdgeLine = 'solid' | 'dashed' | 'dotted' | 'double';
export const EDGE_STYLES: Record<EdgeStyle, string> = { border: 'Frame', corners: 'Corner marks', rows: 'Rows top and bottom', sides: 'Lines down the sides' };
export const EDGE_LINES: Record<EdgeLine, string> = { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted', double: 'Double' };

export interface CustomEdge { id: string; name: string; style: EdgeStyle; line: EdgeLine; glyph: string; color: string; inset: number }
export const MIN_INSET = 6;
export const MAX_INSET = 32;

export function cleanEdge(raw: Partial<CustomEdge> & { id: string }): CustomEdge {
  return {
    id: raw.id,
    name: cleanName(raw.name, 'My margin'),
    style: oneOf(EDGE_STYLES, raw.style, 'border'),
    line: oneOf(EDGE_LINES, raw.line, 'solid'),
    glyph: Array.from(typeof raw.glyph === 'string' ? raw.glyph.replace(/[<>&"'\\\s]/g, '') : '')[0] ?? '❦',
    color: cleanColor(raw.color, 'accent'),
    inset: Math.round(clamp(raw.inset, MIN_INSET, MAX_INSET, 12)),
  };
}

export const EDGE_VARS = ['--edge-color', '--edge-inset', '--edge-line', '--edge-width', '--edge-glyph', '--edge-row'];

// the attribute and variables the stylesheet reads for a made margin
export function edgeLook(e: CustomEdge): { attr: string; vars: Record<string, string> } {
  return {
    attr: `x-${e.style}`,
    vars: {
      '--edge-color': colorCss(e.color),
      '--edge-inset': `${e.inset}px`,
      '--edge-line': e.line,
      '--edge-width': e.line === 'double' ? '4px' : '2px',
      '--edge-glyph': `"${e.glyph}"`,
      '--edge-row': `"${Array(7).fill(e.glyph).join(' ')}"`,
    },
  };
}

export const findEdge = (id: string | undefined, custom: CustomEdge[] = []): Surface => {
  const mine = custom.find(e => e.id === id);
  return mine ? { id: mine.id, name: mine.name, cost: 0, description: 'Made by you.' } : EDGES.find(e => e.id === id) ?? EDGES[0];
};
