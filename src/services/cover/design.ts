import { cleanGradient, type Gradient } from '../backdrops';

// a book cover as the printer wants it: back, spine and front on one sheet, with bleed all round.
// sizes are inches, measured from the top left of the whole sheet (bleed included).

export const BLEED = 0.125;
export const SAFE = 0.25; // keep important things this far inside the trim edge
export const MIN_SPINE_TEXT_PAGES = 79;
export const MAX_LAYERS = 40;
export const MIN_PAGES = 24;
export const MAX_PAGES = 900;

export interface PaperType { id: string; name: string; perPage: number }

// spine thickness per page, the figures print-on-demand services publish
export const PAPER_TYPES: PaperType[] = [
  { id: 'bw-white', name: 'Black and white, white paper', perPage: 0.002252 },
  { id: 'bw-cream', name: 'Black and white, cream paper', perPage: 0.0025 },
  { id: 'color-standard', name: 'Color, standard', perPage: 0.002252 },
  { id: 'color-premium', name: 'Color, premium', perPage: 0.002347 },
];

export interface CoverSetup {
  pages: number;
  paper: string;
  // a spine width of your own, in inches, when the printer gives you a different number
  spineOverride?: number;
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface Geometry {
  trimW: number;
  trimH: number;
  spine: number;
  totalW: number;
  totalH: number;
  back: Rect; // the trimmed back cover
  spineRect: Rect;
  front: Rect;
  barcode: Rect;
}

export function spineWidth(setup: CoverSetup): number {
  if (typeof setup.spineOverride === 'number' && setup.spineOverride >= 0) return Math.round(setup.spineOverride * 1000) / 1000;
  const paper = PAPER_TYPES.find(p => p.id === setup.paper) ?? PAPER_TYPES[0];
  return Math.round(setup.pages * paper.perPage * 1000) / 1000;
}

export function geometry(trimW: number, trimH: number, setup: CoverSetup): Geometry {
  const spine = spineWidth(setup);
  const back: Rect = { x: BLEED, y: BLEED, w: trimW, h: trimH };
  const spineRect: Rect = { x: BLEED + trimW, y: BLEED, w: spine, h: trimH };
  const front: Rect = { x: BLEED + trimW + spine, y: BLEED, w: trimW, h: trimH };
  // the barcode goes bottom right of the back cover, a quarter inch in from the trim and the spine
  const bw = 2, bh = 1.2;
  const barcode: Rect = { x: back.x + back.w - SAFE - bw, y: back.y + back.h - SAFE - bh, w: bw, h: bh };
  return { trimW, trimH, spine, totalW: round(trimW * 2 + spine + BLEED * 2), totalH: round(trimH + BLEED * 2), back, spineRect, front, barcode };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// about how many printed pages a manuscript makes, from its words and the book's page layout
export function estimatePages(words: number, textW: number, textH: number, fontPt: number, lineHeight: number): number {
  const lineIn = (fontPt / 72) * lineHeight;
  const lines = Math.max(1, Math.floor(textH / lineIn));
  const charsPerLine = Math.max(10, (textW * 72) / (fontPt * 0.46));
  const wordsPerPage = Math.max(60, (lines * charsPerLine) / 6.1);
  // chapter openings and front matter add a handful of pages
  const raw = Math.ceil(words / wordsPerPage) + 6;
  return Math.min(MAX_PAGES, Math.max(MIN_PAGES, raw + (raw % 2)));
}

// ---- the things on a cover ------------------------------------------------------------

export interface FillSolid { kind: 'solid'; color: string }
export interface FillGradient { kind: 'gradient'; gradient: Gradient }
export type Fill = FillSolid | FillGradient;

export interface Shadow { x: number; y: number; blur: number; color: string; opacity: number } // inches for offsets and blur
export interface Outline { width: number; color: string } // points
export interface Bevel { depth: number; light: string; dark: string } // depth in points
export interface Glow { blur: number; color: string } // inches

export interface Effects {
  shadow?: Shadow;
  outline?: Outline;
  bevel?: Bevel;
  glow?: Glow;
}

interface Base {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number;
  rotation: number; // degrees, about the middle
  opacity: number; // the whole layer, 0 to 1
  hidden?: boolean;
  locked?: boolean;
  effects: Effects;
}

export interface TextLayer extends Base {
  kind: 'text';
  text: string;
  font: string;
  size: number; // points
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  spacing: number; // letter spacing, in ems
  upper: boolean;
  fill: Fill;
  fillOpacity: number;
}
export interface ImageLayer extends Base {
  kind: 'image';
  assetId: string;
  fit: 'cover' | 'contain' | 'stretch';
  radius: number; // inches
  flip: boolean;
}
export interface ShapeLayer extends Base {
  kind: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill: Fill;
  fillOpacity: number;
  stroke?: { width: number; color: string }; // points
  radius: number; // inches
}
export type CoverLayer = TextLayer | ImageLayer | ShapeLayer;

export interface CoverDesign {
  setup: CoverSetup;
  background: Fill;
  layers: CoverLayer[]; // first is at the bottom
}

// ---- cleaning ---------------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);
// eslint-disable-next-line no-control-regex
const str = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : fallback);
const oneOf = <T extends string>(v: unknown, set: readonly T[], fallback: T): T => ((set as readonly string[]).includes(v as string) ? (v as T) : fallback);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function cleanFill(raw: unknown, fallback: Fill = { kind: 'solid', color: '#1f2a44' }): Fill {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.kind === 'gradient') {
    const gradient = cleanGradient(r.gradient);
    if (gradient) return { kind: 'gradient', gradient };
  }
  if (r.kind === 'solid' && typeof r.color === 'string' && HEX.test(r.color)) return { kind: 'solid', color: r.color.toLowerCase() };
  return fallback;
}

export function cleanEffects(raw: unknown): Effects {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Effects = {};
  const s = r.shadow as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') out.shadow = { x: r3(num(s.x, -2, 2, 0.03)), y: r3(num(s.y, -2, 2, 0.03)), blur: r3(num(s.blur, 0, 1, 0.05)), color: color(s.color, '#000000'), opacity: r3(num(s.opacity, 0, 1, 0.5)) };
  const o = r.outline as Record<string, unknown> | undefined;
  if (o && typeof o === 'object') out.outline = { width: r3(num(o.width, 0.25, 40, 2)), color: color(o.color, '#000000') };
  const b = r.bevel as Record<string, unknown> | undefined;
  if (b && typeof b === 'object') out.bevel = { depth: r3(num(b.depth, 0.5, 12, 2)), light: color(b.light, '#ffffff'), dark: color(b.dark, '#000000') };
  const g = r.glow as Record<string, unknown> | undefined;
  if (g && typeof g === 'object') out.glow = { blur: r3(num(g.blur, 0.01, 1, 0.12)), color: color(g.color, '#ffe9a8') };
  return out;
}

let counter = 0;
export const newLayerId = () => `layer-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function cleanLayer(raw: unknown): CoverLayer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = {
    id: str(r.id, 60) || newLayerId(),
    name: str(r.name, 40),
    x: r3(num(r.x, -30, 60, 1)), y: r3(num(r.y, -30, 60, 1)),
    w: r3(num(r.w, 0.05, 60, 3)), h: r3(num(r.h, 0.05, 60, 1)),
    rotation: r3(num(r.rotation, -360, 360, 0)),
    opacity: r3(num(r.opacity, 0, 1, 1)),
    ...(r.hidden ? { hidden: true as const } : {}),
    ...(r.locked ? { locked: true as const } : {}),
    effects: cleanEffects(r.effects),
  };
  if (r.kind === 'text') {
    return {
      ...base, kind: 'text', text: str(r.text, 1200), font: str(r.font, 60) || 'Playfair Display',
      size: r3(num(r.size, 4, 400, 36)), bold: !!r.bold, italic: !!r.italic,
      align: oneOf(r.align, ['left', 'center', 'right'] as const, 'center'),
      lineHeight: r3(num(r.lineHeight, 0.7, 3, 1.15)), spacing: r3(num(r.spacing, -0.2, 2, 0)), upper: !!r.upper,
      fill: cleanFill(r.fill, { kind: 'solid', color: '#ffffff' }), fillOpacity: r3(num(r.fillOpacity, 0, 1, 1)),
    };
  }
  if (r.kind === 'image') {
    const assetId = str(r.assetId, 200);
    if (!assetId) return null;
    return { ...base, kind: 'image', assetId, fit: oneOf(r.fit, ['cover', 'contain', 'stretch'] as const, 'cover'), radius: r3(num(r.radius, 0, 10, 0)), flip: !!r.flip };
  }
  if (r.kind === 'shape') {
    const st = r.stroke as Record<string, unknown> | undefined;
    return {
      ...base, kind: 'shape', shape: oneOf(r.shape, ['rect', 'ellipse', 'line'] as const, 'rect'),
      fill: cleanFill(r.fill, { kind: 'solid', color: '#c9933b' }), fillOpacity: r3(num(r.fillOpacity, 0, 1, 1)),
      ...(st && typeof st === 'object' ? { stroke: { width: r3(num(st.width, 0.25, 60, 2)), color: color(st.color, '#ffffff') } } : {}),
      radius: r3(num(r.radius, 0, 10, 0)),
    };
  }
  return null;
}

export function cleanCover(raw: unknown): CoverDesign | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const s = (r.setup && typeof r.setup === 'object' ? r.setup : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const layers = (Array.isArray(r.layers) ? r.layers : []).map(cleanLayer).filter((l): l is CoverLayer => {
    if (!l || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  }).slice(0, MAX_LAYERS);
  return {
    setup: {
      pages: Math.round(num(s.pages, MIN_PAGES, MAX_PAGES, 200)),
      paper: oneOf(s.paper, PAPER_TYPES.map(p => p.id), 'bw-white'),
      ...(typeof s.spineOverride === 'number' && Number.isFinite(s.spineOverride) && s.spineOverride >= 0 ? { spineOverride: r3(Math.min(6, s.spineOverride)) } : {}),
    },
    background: cleanFill(r.background),
    layers,
  };
}

// every picture the design uses (so unused ones can be pruned)
export const coverAssetIds = (d: CoverDesign | undefined): string[] => (d ? d.layers.flatMap(l => (l.kind === 'image' ? [l.assetId] : [])) : []);

// ---- ordering -------------------------------------------------------------------------------

export type Move = 'forward' | 'backward' | 'front' | 'back';

// change a layer's place in the stack. "forward" is toward the viewer, so toward the end of the list.
export function moveLayer(layers: CoverLayer[], id: string, move: Move): CoverLayer[] {
  const i = layers.findIndex(l => l.id === id);
  if (i < 0) return layers;
  const to = move === 'forward' ? Math.min(layers.length - 1, i + 1) : move === 'backward' ? Math.max(0, i - 1) : move === 'front' ? layers.length - 1 : 0;
  if (to === i) return layers;
  const next = [...layers];
  const [item] = next.splice(i, 1);
  next.splice(to, 0, item);
  return next;
}

export function duplicateLayer(layers: CoverLayer[], id: string): { layers: CoverLayer[]; id: string | null } {
  const i = layers.findIndex(l => l.id === id);
  if (i < 0 || layers.length >= MAX_LAYERS) return { layers, id: null };
  const copy = { ...structuredClone(layers[i]), id: newLayerId(), x: r3(layers[i].x + 0.2), y: r3(layers[i].y + 0.2), name: layers[i].name ? `${layers[i].name} copy` : '' } as CoverLayer;
  const next = [...layers];
  next.splice(i + 1, 0, copy);
  return { layers: next, id: copy.id };
}

// ---- where things start --------------------------------------------------------------------

export function textLayer(patch: Partial<TextLayer> = {}): TextLayer {
  return {
    id: newLayerId(), name: '', kind: 'text', x: 1, y: 1, w: 4, h: 1, rotation: 0, opacity: 1, effects: {},
    text: 'Your text', font: 'Playfair Display', size: 36, bold: false, italic: false, align: 'center', lineHeight: 1.15, spacing: 0, upper: false,
    fill: { kind: 'solid', color: '#ffffff' }, fillOpacity: 1, ...patch,
  };
}
export function shapeLayer(patch: Partial<ShapeLayer> = {}): ShapeLayer {
  return { id: newLayerId(), name: '', kind: 'shape', shape: 'rect', x: 1, y: 1, w: 2, h: 2, rotation: 0, opacity: 1, effects: {}, fill: { kind: 'solid', color: '#c9933b' }, fillOpacity: 1, radius: 0, ...patch };
}
export function imageLayer(assetId: string, patch: Partial<ImageLayer> = {}): ImageLayer {
  return { id: newLayerId(), name: '', kind: 'image', x: 1, y: 1, w: 3, h: 3, rotation: 0, opacity: 1, effects: {}, assetId, fit: 'cover', radius: 0, flip: false, ...patch };
}

// text that runs up the spine, the way spine titles are read when the book lies face up
export function spineText(g: Geometry, text: string, patch: Partial<TextLayer> = {}): TextLayer {
  const length = g.trimH - SAFE * 2;
  const size = Math.max(6, Math.min(48, Math.round(g.spine * 72 * 0.55)));
  // a box that is long and thin, turned a quarter turn about its middle, lands on the spine
  const w = length, h = Math.max(0.3, size / 72 * 1.5);
  const cx = g.spineRect.x + g.spineRect.w / 2, cy = g.spineRect.y + g.spineRect.h / 2;
  return textLayer({ text, name: 'Spine', x: r3(cx - w / 2), y: r3(cy - h / 2), w: r3(w), h: r3(h), rotation: 90, size, align: 'center', ...patch });
}

// a first design: the title and name on the front, the blurb on the back, both on the spine. no pictures.
export function starterCover(g: Geometry, meta: { title: string; author: string; synopsis: string }, setup: CoverSetup): CoverDesign {
  const front = g.front, back = g.back;
  const layers: CoverLayer[] = [
    textLayer({ name: 'Title', text: meta.title || 'Title', x: r3(front.x + SAFE + 0.15), y: r3(front.y + g.trimH * 0.2), w: r3(g.trimW - SAFE * 2 - 0.3), h: 2, size: 44, bold: true, fill: { kind: 'solid', color: '#f6e7b8' }, effects: { shadow: { x: 0.02, y: 0.03, blur: 0.04, color: '#000000', opacity: 0.55 } } }),
    textLayer({ name: 'Author', text: meta.author || 'Author', x: r3(front.x + SAFE + 0.15), y: r3(front.y + g.trimH - 1.2), w: r3(g.trimW - SAFE * 2 - 0.3), h: 0.5, size: 20, spacing: 0.12, upper: true, fill: { kind: 'solid', color: '#ffffff' } }),
    textLayer({ name: 'Back cover text', text: meta.synopsis || 'A few lines about the book.', x: r3(back.x + SAFE + 0.2), y: r3(back.y + SAFE + 0.5), w: r3(g.trimW - SAFE * 2 - 0.4), h: 3, size: 12, align: 'left', lineHeight: 1.4, fill: { kind: 'solid', color: '#ffffff' } }),
  ];
  if (g.spine >= 0.25) layers.push(spineText(g, [meta.title, meta.author].filter(Boolean).join('   ·   '), { fill: { kind: 'solid', color: '#f6e7b8' } }));
  return { setup, background: { kind: 'gradient', gradient: { kind: 'linear', angle: 160, stops: [{ color: '#1c2745', at: 0 }, { color: '#2f3d6b', at: 100 }] } }, layers };
}
