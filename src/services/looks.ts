// window and header skins, document covers and badge shelves: looks the shop sells. covers can also be made by hand.
import type { CSSProperties } from 'react';
import { cleanLook, previewStyle, type Look as Backdrop } from './backdrops';
import { mix } from './customTheme';

interface Look { id: string; name: string; cost: number; description: string }

export interface Skin extends Look {}
export interface Cover extends Look {
  background: string; // css background for the cover band
  ink: string; // the color of the emblem and the spine
  glyph: string;
  // a cover the writer made: layers instead of one css background
  look?: Backdrop;
}
export interface Shelf extends Look {
  case: string; // css background behind the shelf
  plank: string; // css background of the ledge each row stands on
  edge: string; // border color
  label: string; // text color on the shelf
}

export const FREE_SKIN = 'plain';
export const FREE_COVER = 'plain';
export const FREE_SHELF = 'plain';

export const SKINS: Skin[] = [
  { id: 'plain', name: 'Plain', cost: 0, description: 'The windows and header as they are.' },
  { id: 'frosted', name: 'Frosted glass', cost: 60, description: 'A blurred, see-through header and windows.' },
  { id: 'gilded', name: 'Gilded edge', cost: 80, description: 'A fine gold double rule under the header, gold-trimmed windows.' },
  { id: 'inked', name: 'Ink and offset', cost: 70, description: 'A thick ink rule and hard drop shadows, like a printed page.' },
  { id: 'floating', name: 'Floating bar', cost: 90, description: 'A rounded header that floats free of the edges.' },
  { id: 'glow', name: 'Soft glow', cost: 110, description: 'A warm halo around the header and windows.' },
  { id: 'ruled', name: 'Notebook ruled', cost: 60, description: 'Faint notebook lines behind the header.' },
  { id: 'brass', name: 'Brass fittings', cost: 150, description: 'A polished brass bar across the top.' },
];

export const COVERS: Cover[] = [
  { id: 'plain', name: 'Plain', cost: 0, description: 'No cover. Documents look as they always have.', background: 'transparent', ink: 'var(--accent-gold)', glyph: '' },
  { id: 'leather', name: 'Brown leather', cost: 40, description: 'Worn leather and a gold emblem.', background: 'linear-gradient(135deg, #6b4a32, #3f2a1c)', ink: '#d9b468', glyph: '❦' },
  { id: 'midnight', name: 'Midnight blue', cost: 40, description: 'Deep blue cloth with a silver moon.', background: 'linear-gradient(135deg, #1f2f5c, #0d1530)', ink: '#c9d4f2', glyph: '☾' },
  { id: 'forest', name: 'Forest green', cost: 50, description: 'Mossy green with a gilt leaf.', background: 'linear-gradient(135deg, #2f5d45, #173325)', ink: '#d6c27a', glyph: '❧' },
  { id: 'crimson', name: 'Crimson cloth', cost: 50, description: 'Rich red with a gold star.', background: 'linear-gradient(135deg, #8c2a3a, #4d1220)', ink: '#f0cf7a', glyph: '✦' },
  { id: 'sunrise', name: 'Sunrise', cost: 70, description: 'A warm gradient from rose to amber.', background: 'linear-gradient(135deg, #f08a6c, #f4c26b)', ink: '#fff4e0', glyph: '☀' },
  { id: 'ocean', name: 'Ocean glass', cost: 70, description: 'Cool teal waters.', background: 'linear-gradient(135deg, #2b7a8c, #153e57)', ink: '#d5f1f0', glyph: '≋' },
  { id: 'starfield', name: 'Starfield', cost: 100, description: 'A night sky scattered with stars.', background: 'radial-gradient(circle at 20% 30%, #3b3a78, #14143a 70%)', ink: '#f6e7a8', glyph: '✧' },
  { id: 'parchment', name: 'Old map', cost: 90, description: 'Aged parchment, the kind with a dotted trail.', background: 'linear-gradient(135deg, #e8d5a8, #c9ad78)', ink: '#6b4a32', glyph: '⌖' },
  { id: 'ember', name: 'Ember cloth', cost: 0, description: 'Glowing red-orange cloth. Earned with a 7-day streak.', background: 'linear-gradient(135deg, #d9622b, #7a2412)', ink: '#ffd9a0', glyph: '❂' },
  { id: 'snowbound', name: 'Snowbound', cost: 0, description: 'Icy blue with a snowflake. Earned by finishing the winter challenge.', background: 'linear-gradient(135deg, #cfe4f7, #7fa6cf)', ink: '#ffffff', glyph: '❄' },
  { id: 'firstbloom', name: 'First Bloom', cost: 0, description: 'Cherry blossom pink. Earned by finishing the spring challenge.', background: 'linear-gradient(135deg, #f8c8d8, #e58fb0)', ink: '#ffffff', glyph: '✿' },
  { id: 'longdays', name: 'Long Days', cost: 0, description: 'Bright sun on warm gold. Earned by finishing the summer challenge.', background: 'linear-gradient(135deg, #ffd96b, #f19b3a)', ink: '#fff7e0', glyph: '☀' },
  { id: 'harvest', name: 'Harvest', cost: 0, description: 'Russet and amber. Earned by finishing the autumn challenge.', background: 'linear-gradient(135deg, #c8682c, #6f3414)', ink: '#ffe0a0', glyph: '❦' },
  { id: 'lavender', name: 'Lavender dream', cost: 80, description: 'Soft violet with a tiny heart.', background: 'linear-gradient(135deg, #b9a3e3, #8e78c8)', ink: '#fdf3ff', glyph: '♡' },
];

export const SHELVES: Shelf[] = [
  { id: 'plain', name: 'Plain shelf', cost: 0, description: 'A simple shelf.', case: 'var(--bg-card)', plank: 'var(--border-strong)', edge: 'var(--border-subtle)', label: 'var(--text-main)' },
  { id: 'oak', name: 'Oak shelf', cost: 60, description: 'Warm wooden planks under every row.', case: 'linear-gradient(180deg, #f2e6cf, #e4d1ac)', plank: 'linear-gradient(180deg, #a9743f, #7d522b)', edge: '#8a5d33', label: '#4a3320' },
  { id: 'glass', name: 'Glass case', cost: 90, description: 'A frosted display case with a bright rim.', case: 'rgba(255, 255, 255, 0.35)', plank: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(200,215,230,0.7))', edge: 'rgba(160, 185, 210, 0.9)', label: 'var(--text-main)' },
  { id: 'moonlit', name: 'Moonlit ledge', cost: 110, description: 'Dark blue sky and a silver ledge.', case: 'radial-gradient(circle at 80% 10%, #2a3a74, #0f1634 70%)', plank: 'linear-gradient(180deg, #8f9bc4, #5a6590)', edge: '#4a5688', label: '#e8ecff' },
  { id: 'rosegold', name: 'Rose gold', cost: 150, description: 'Blush walls and a rose gold rail.', case: 'linear-gradient(180deg, #fbe8e6, #f3d3d0)', plank: 'linear-gradient(180deg, #e3a79d, #c47b73)', edge: '#c47b73', label: '#6b3a38' },
  { id: 'legend', name: 'Hall of legends', cost: 0, description: 'Marble and gold for those who never miss a day. Earned with a 100-day streak.', case: 'linear-gradient(180deg, #f4f1ea, #dcd6c6)', plank: 'linear-gradient(180deg, #f1d27a, #b98a22)', edge: '#b98a22', label: '#4a3a12' },
  { id: 'museum', name: 'Museum plinth', cost: 200, description: 'Dark velvet and a gilt plinth for your best work.', case: 'linear-gradient(180deg, #3a1d2a, #1f0e17)', plank: 'linear-gradient(180deg, #e9c46a, #b88a2a)', edge: '#b88a2a', label: '#f6e7b8' },
];

export const findSkin = (id: string | undefined) => SKINS.find(s => s.id === id) ?? SKINS[0];
// a cover the writer made: a backdrop (gradient, material, stars), an ink color and a small emblem
export interface CustomCover { id: string; name: string; look: Backdrop; ink: string; glyph: string }

const HEX = /^#[0-9a-f]{6}$/i;

export function cleanCardCover(raw: Partial<CustomCover> & { id: string }): CustomCover {
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My cover',
    look: cleanLook(raw.look) ?? {},
    ink: typeof raw.ink === 'string' && HEX.test(raw.ink) ? raw.ink.toLowerCase() : '#ffffff',
    glyph: Array.from(typeof raw.glyph === 'string' ? raw.glyph.replace(/[<>&\s]/g, '') : '').slice(0, 3).join(''),
  };
}

export const coverFrom = (c: CustomCover): Cover => ({ id: c.id, name: c.name, cost: 0, description: 'Made by you.', background: 'transparent', ink: c.ink, glyph: c.glyph, look: c.look });

export const findCover = (id: string | undefined, custom: CustomCover[] = []): Cover => {
  const mine = custom.find(c => c.id === id);
  return mine ? coverFrom(mine) : COVERS.find(c => c.id === id) ?? COVERS[0];
};

// how a cover paints its band
export const coverPaint = (c: Cover): CSSProperties => (c.look ? previewStyle(c.look) : { background: c.background });

export const findShelf = (id: string | undefined, custom: CustomShelf[] = []): Shelf => {
  const mine = custom.find(s => s.id === id);
  return mine ? shelfFrom(mine) : SHELVES.find(s => s.id === id) ?? SHELVES[0];
};

// ---- skins and shelves the writer makes ----

const cleanText = (v: unknown, fallback: string) => (typeof v === 'string' ? v : '').replace(/[<>]/g, '').trim().slice(0, 24) || fallback;
const oneOf = <T extends string>(set: Record<T, string>, v: unknown, fallback: T): T => (typeof v === 'string' && v in set ? (v as T) : fallback);
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);

export type SkinHeader = 'plain' | 'rule' | 'double' | 'thick' | 'glow' | 'band';
export type SkinWindows = 'plain' | 'outline' | 'shadow' | 'glow' | 'frost';
export const SKIN_HEADERS: Record<SkinHeader, string> = { plain: 'Plain', rule: 'Thin rule', double: 'Double rule', thick: 'Thick rule', glow: 'Soft glow', band: 'Tinted band' };
export const SKIN_WINDOWS: Record<SkinWindows, string> = { plain: 'Plain', outline: 'Inner outline', shadow: 'Hard shadow', glow: 'Soft glow', frost: 'Frosted glass' };

export interface CustomSkin { id: string; name: string; header: SkinHeader; windows: SkinWindows; floating: boolean; color: string }

export function cleanSkin(raw: Partial<CustomSkin> & { id: string }): CustomSkin {
  return {
    id: raw.id,
    name: cleanText(raw.name, 'My skin'),
    header: oneOf(SKIN_HEADERS, raw.header, 'rule'),
    windows: oneOf(SKIN_WINDOWS, raw.windows, 'plain'),
    floating: !!raw.floating,
    color: typeof raw.color === 'string' && HEX.test(raw.color) ? raw.color.toLowerCase() : 'accent',
  };
}

export const SKIN_ATTRS = ['data-sk-header', 'data-sk-win', 'data-sk-float'];

// what the stylesheet reads from the body for a made skin
export const skinLook = (s: CustomSkin) => ({
  attrs: { 'data-sk-header': s.header, 'data-sk-win': s.windows, 'data-sk-float': s.floating ? '1' : '0' },
  color: s.color === 'accent' ? 'var(--accent-gold)' : s.color,
});

export const findCustomSkin = (id: string | undefined, custom: CustomSkin[] = []) => custom.find(s => s.id === id);

export interface CustomShelf { id: string; name: string; top: string; bottom: string; plank: string; label: string }

export function cleanShelf(raw: Partial<CustomShelf> & { id: string }): CustomShelf {
  return {
    id: raw.id,
    name: cleanText(raw.name, 'My shelf'),
    top: hex(raw.top, '#f2e6cf'),
    bottom: hex(raw.bottom, '#e4d1ac'),
    plank: hex(raw.plank, '#a9743f'),
    label: hex(raw.label, '#4a3320'),
  };
}

export const shelfFrom = (c: CustomShelf): Shelf => ({
  id: c.id, name: c.name, cost: 0, description: 'Made by you.',
  case: `linear-gradient(180deg, ${c.top}, ${c.bottom})`,
  plank: `linear-gradient(180deg, ${mix(c.plank, '#ffffff', 0.2)}, ${mix(c.plank, '#000000', 0.2)})`,
  edge: mix(c.plank, '#000000', 0.15),
  label: c.label,
});

// a document's cover: its own choice, else the writer's usual one
export const coverFor = (doc: { coverStyle?: string }, usual: string | undefined, custom: CustomCover[] = []) => findCover(doc.coverStyle ?? usual, custom);
