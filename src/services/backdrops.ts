import type { CSSProperties } from 'react';
import { mix, rgba } from './customTheme';

// what sits behind the text: gradients, materials (wood, sand, water), stars and see-through glass.
// a "look" is any mix of them, for the whole app background or for the page. pure: the css comes out as strings.

export interface GradientStop { color: string; at: number } // at: 0 to 100
export interface Gradient { kind: 'linear' | 'radial'; angle: number; stops: GradientStop[] }
export type StarLevel = 'few' | 'some' | 'many';

export interface Look {
  gradient?: Gradient;
  material?: string;
  // the color of the material. its pattern is neutral, so any color works; left out, the material's own usual color is used
  tint?: string;
  // how solid the material's color is (0.1 to 1). left out: solid alone, part see-through over a gradient
  fill?: number;
  stars?: StarLevel;
  // pages only: 0 is solid, 1 is nearly clear glass
  glass?: number;
}

export interface Layer { image: string; size: string; repeat: string }

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;
const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback);

export function cleanGradient(raw: unknown): Gradient | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const stops = (Array.isArray(r.stops) ? r.stops : [])
    .filter((s): s is { color: string; at?: unknown } => !!s && typeof s === 'object' && typeof (s as { color?: unknown }).color === 'string' && HEX.test((s as { color: string }).color))
    .map(s => ({ color: s.color.toLowerCase(), at: Math.round(clamp(s.at, 0, 100, 0)) }))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_STOPS);
  if (stops.length < MIN_STOPS) return undefined;
  return { kind: r.kind === 'radial' ? 'radial' : 'linear', angle: Math.round(clamp(r.angle, 0, 360, 180)), stops };
}

export const cssGradient = (g: Gradient, strength = 1): string => {
  const paint = (c: string) => (strength < 1 ? `color-mix(in srgb, ${c} ${Math.round(strength * 100)}%, transparent)` : c);
  const stops = g.stops.map(s => `${paint(s.color)} ${s.at}%`).join(', ');
  return g.kind === 'radial' ? `radial-gradient(ellipse at center, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})`;
};

// ---- stars ----------------------------------------------------------------

const dot = (x: number, y: number, r: number, a: number) => `radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, ${a}) ${r}px, transparent ${r + 1.2}px)`;

// each star is its own layer, so every list of sizes and repeats lines up with the list of images
const tile = (size: string, dots: string[]): Layer[] => dots.map(image => ({ image, size, repeat: 'repeat' }));

const BIG = tile('340px 340px', [dot(12, 18, 1.2, 0.9), dot(38, 62, 1, 0.7), dot(55, 12, 1.4, 0.95), dot(72, 48, 1, 0.6), dot(86, 80, 1.3, 0.85), dot(24, 88, 1, 0.65), dot(93, 22, 1, 0.7)]);
const MID = tile('230px 230px', [dot(20, 30, 1, 0.55), dot(47, 82, 1.2, 0.8), dot(68, 22, 1, 0.6), dot(90, 58, 1.1, 0.7), dot(8, 70, 1, 0.5)]);
const DUST = tile('150px 150px', [dot(15, 45, 0.8, 0.45), dot(33, 10, 0.8, 0.5), dot(52, 55, 0.8, 0.4), dot(78, 85, 0.8, 0.5), dot(64, 35, 0.8, 0.45), dot(88, 8, 0.8, 0.4)]);

const STAR_TILES: Record<StarLevel, Layer[]> = { few: BIG, some: [...BIG, ...MID], many: [...BIG, ...MID, ...DUST] };

export const STAR_LEVELS: Array<[StarLevel, string]> = [['few', 'A few'], ['some', 'Some'], ['many', 'Many']];

// ---- materials ------------------------------------------------------------

// the filter covers exactly the tile: with the default (larger) region the noise does not stitch, and every tile shows a seam
const noise = (alpha: number, tint = '%23000') =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${alpha} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' fill='${tint}'/%3E%3C/svg%3E")`;

// a material is a neutral pattern (only black and white at low strength) laid over a color the writer picks
export interface Material { id: string; name: string; tint: string; pattern: Layer[] }

const L = (image: string, size = 'auto', repeat = 'repeat'): Layer => ({ image, size, repeat });

export const MATERIALS: Material[] = [
  { id: 'wood', name: 'Wood planks', tint: '#d1ab7d', pattern: [
    L('repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.13) 0 1px, transparent 1px 6px)'),
    L('repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 3px, transparent 3px 11px)'),
    L('linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0 2px, transparent 2px)', '100% 150px', 'repeat-y'),
  ] },
  { id: 'sand', name: 'Sand', tint: '#e5cf9f', pattern: [
    L(noise(0.3), '200px 200px'),
    L('radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.4), transparent 60%)', 'auto', 'no-repeat'),
  ] },
  { id: 'water', name: 'Water', tint: '#98d0e8', pattern: [
    // each ripple sits in the middle of its tile and fades out before the edge, so tiles join without a cut
    L('radial-gradient(ellipse 70px 12px at 50% 50%, rgba(255, 255, 255, 0.34), transparent 70%)', '180px 70px'),
    L('radial-gradient(ellipse 50px 9px at 50% 50%, rgba(255, 255, 255, 0.24), transparent 70%)', '137px 61px'),
    L('linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 40%, rgba(0, 0, 0, 0.1))', 'auto', 'no-repeat'),
  ] },
  { id: 'marble', name: 'Marble', tint: '#e8e8ee', pattern: [
    // veins run the whole way across, not in tiles: a tiled diagonal line breaks at every tile edge
    L('linear-gradient(115deg, transparent 40%, rgba(0, 0, 0, 0.14) 41%, transparent 43%)', '100% 100%', 'no-repeat'),
    L('linear-gradient(65deg, transparent 55%, rgba(0, 0, 0, 0.1) 56%, transparent 58%)', '100% 100%', 'no-repeat'),
    L('linear-gradient(100deg, transparent 18%, rgba(0, 0, 0, 0.08) 18.6%, transparent 19.6%)', '100% 100%', 'no-repeat'),
    L('linear-gradient(140deg, transparent 72%, rgba(0, 0, 0, 0.09) 72.5%, transparent 73.6%)', '100% 100%', 'no-repeat'),
  ] },
  { id: 'linen', name: 'Linen', tint: '#e6decb', pattern: [
    L('repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.07) 0 1px, transparent 1px 3px)'),
    L('repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.07) 0 1px, transparent 1px 3px)'),
  ] },
  { id: 'cork', name: 'Cork', tint: '#d4ab76', pattern: [
    L('radial-gradient(circle, rgba(0, 0, 0, 0.3) 1.4px, transparent 2px)', '23px 23px'),
    L('radial-gradient(circle, rgba(255, 255, 255, 0.3) 1.2px, transparent 2px)', '37px 37px'),
    L(noise(0.26), '200px 200px'),
  ] },
];

// with a gradient underneath the color is part see-through, so the gradient is not buried
export const AUTO_FILL = 0.45;

// the material's layers over its color, which goes a little lighter at the top and darker at the bottom.
// fill is how solid the color is, 0.1 to 1.
export function materialLayers(m: Material, tint?: string, fill = 1): Layer[] {
  const base = tint && HEX.test(tint) ? tint : m.tint;
  const a = clamp(fill, 0.1, 1, 1);
  return [...m.pattern, { image: `linear-gradient(180deg, ${rgba(mix(base, '#ffffff', 0.12), a)}, ${rgba(mix(base, '#000000', 0.1), a)})`, size: 'auto', repeat: 'no-repeat' }];
}

export const findMaterial = (id: string | undefined) => MATERIALS.find(m => m.id === id);

// ---- gradients to start from ---------------------------------------------------

const g = (angle: number, ...stops: Array<[string, number]>): Gradient => ({ kind: 'linear', angle, stops: stops.map(([color, at]) => ({ color, at })) });

export const GRADIENT_PRESETS: Array<{ id: string; name: string; gradient: Gradient }> = [
  { id: 'dawn', name: 'Dawn', gradient: g(180, ['#14224f', 0], ['#4a3a7e', 30], ['#d4553a', 62], ['#f08aa0', 82], ['#ffd27a', 100]) },
  { id: 'dusk', name: 'Dusk', gradient: g(180, ['#0d1330', 0], ['#2c2a5e', 40], ['#8a3f6a', 72], ['#f08a3c', 100]) },
  { id: 'sunset', name: 'Sunset', gradient: g(180, ['#3b2a66', 0], ['#c0456a', 45], ['#f58a4c', 78], ['#ffd27a', 100]) },
  { id: 'midnight', name: 'Midnight', gradient: g(180, ['#05060f', 0], ['#101536', 100]) },
  { id: 'aurora', name: 'Aurora', gradient: g(160, ['#06142b', 0], ['#0f4a5a', 40], ['#2fae8a', 70], ['#6a4fb0', 100]) },
  { id: 'lagoon', name: 'Lagoon', gradient: g(180, ['#bff0ee', 0], ['#59c7c6', 50], ['#2279a0', 100]) },
  { id: 'peach', name: 'Peach', gradient: g(135, ['#ffe3d1', 0], ['#ffc2b0', 50], ['#f7a1b6', 100]) },
  { id: 'meadow', name: 'Meadow', gradient: g(160, ['#eaf6e4', 0], ['#cbe9c4', 50], ['#b6dff0', 100]) },
  { id: 'ember', name: 'Ember', gradient: g(180, ['#1a0b08', 0], ['#6b2310', 55], ['#d9622b', 100]) },
  { id: 'frost', name: 'Frost', gradient: g(180, ['#f4f9ff', 0], ['#d3e6f7', 55], ['#a9c8e6', 100]) },
];

// ---- cleaning and building ------------------------------------------------------

export function cleanLook(raw: unknown): Look | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const look: Look = {};
  const gradient = cleanGradient(r.gradient);
  if (gradient) look.gradient = gradient;
  if (typeof r.material === 'string' && findMaterial(r.material)) {
    look.material = r.material;
    if (typeof r.tint === 'string' && HEX.test(r.tint)) look.tint = r.tint.toLowerCase();
    if (typeof r.fill === 'number' && Number.isFinite(r.fill)) look.fill = Math.round(clamp(r.fill, 0.1, 1, 1) * 100) / 100;
  }
  if (r.stars === 'few' || r.stars === 'some' || r.stars === 'many') look.stars = r.stars;
  if (typeof r.glass === 'number' && Number.isFinite(r.glass) && r.glass > 0) look.glass = Math.round(clamp(r.glass, 0, 1, 0) * 100) / 100;
  return Object.keys(look).length ? look : undefined;
}

export const hasBackdrop = (look: Look | undefined) => !!look && !!(look.gradient || look.material || look.stars);

// the layers a look draws, top first: stars over the material over the gradient
// strength under 1 thins the gradient and the material wash, for a page that is see-through
export function lookLayers(look: Look | undefined, strength = 1): Layer[] {
  if (!look) return [];
  const out: Layer[] = [];
  if (look.stars) out.push(...STAR_TILES[look.stars]);
  const material = findMaterial(look.material);
  if (material) out.push(...materialLayers(material, look.tint, (look.fill ?? (look.gradient ? AUTO_FILL : 1)) * strength));
  if (look.gradient) out.push({ image: cssGradient(look.gradient, strength), size: 'auto', repeat: 'no-repeat' });
  return out;
}

// the layers' lists as css values: every list has one entry per layer, in the same order
export function joinLayers(layers: Layer[]): { image: string; size: string; repeat: string; position: string } {
  return {
    image: layers.map(l => l.image).join(', '),
    size: layers.map(l => l.size).join(', '),
    repeat: layers.map(l => l.repeat).join(', '),
    position: layers.map(() => 'center').join(', '),
  };
}

// a page that lets the background show through. g runs from 0 (solid) to 1 (almost clear).
export function glassVars(look: Look | undefined, bgPaper: string): { bg: string; blur: string } | null {
  if (!look || !look.glass || look.glass <= 0 || !/^#[0-9a-f]{3,6}$/i.test(bgPaper.trim())) return null;
  return { bg: rgba(bgPaper, Math.round((1 - look.glass * 0.82) * 100) / 100), blur: `${Math.round(6 + look.glass * 18)}px` };
}

// the same look as inline style, for previews that cannot use the page's variables
export function previewStyle(look: Look | undefined): CSSProperties {
  const layers = lookLayers(look);
  if (!layers.length) return {};
  const j = joinLayers(layers);
  return { backgroundImage: j.image, backgroundSize: j.size, backgroundRepeat: j.repeat, backgroundPosition: j.position };
}
