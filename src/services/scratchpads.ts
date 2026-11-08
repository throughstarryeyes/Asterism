import type { CSSProperties } from 'react';
import type { NoteBorder, NoteShape, NoteStyle, Scratchpad } from '../types';

// scratchpads: notes that sit on the page. one list holds them all; each says where it shows.
// pets will be notes too (kind 'pet'), so everything about placement and showing lives here, not in the sticky note.

export const NOTE_SHAPES: Array<{ id: NoteShape; label: string }> = [
  { id: 'square', label: 'Square' }, { id: 'rounded', label: 'Rounded' }, { id: 'pill', label: 'Pill' }, { id: 'oval', label: 'Oval' },
  { id: 'blob', label: 'Blob' }, { id: 'folded', label: 'Folded corner' }, { id: 'hexagon', label: 'Hexagon' }, { id: 'ticket', label: 'Ticket' },
];

export const NOTE_BORDERS: Array<{ id: NoteBorder; label: string }> = [
  { id: 'none', label: 'None' }, { id: 'solid', label: 'Solid' }, { id: 'dashed', label: 'Dashed' }, { id: 'dotted', label: 'Dotted' },
  { id: 'double', label: 'Double' }, { id: 'stitched', label: 'Stitched' }, { id: 'tape', label: 'Tape' }, { id: 'pin', label: 'Pin' },
];

export const NOTE_COLORS = ['#fff3a8', '#ffd6e0', '#cdeffd', '#d4f5d0', '#e6d9ff', '#ffe0b8', '#ffffff', '#2f2a3b', '#1f3b34', '#f8c8dc'];

export const DEFAULT_NOTE_COLOR = '#fff3a8';
export const MIN_OPACITY = 0.3;

const HEX = /^#[0-9a-f]{6}$/i;
const SHAPE_IDS = NOTE_SHAPES.map(s => s.id);
const BORDER_IDS = NOTE_BORDERS.map(b => b.id);

export function cleanNoteStyle(raw: unknown): NoteStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: NoteStyle = {};
  if (typeof r.color === 'string' && HEX.test(r.color)) out.color = r.color;
  if (SHAPE_IDS.includes(r.shape as NoteShape)) out.shape = r.shape as NoteShape;
  if (BORDER_IDS.includes(r.border as NoteBorder)) out.border = r.border as NoteBorder;
  if (typeof r.borderColor === 'string' && HEX.test(r.borderColor)) out.borderColor = r.borderColor;
  if (typeof r.borderWidth === 'number' && Number.isFinite(r.borderWidth)) out.borderWidth = Math.min(8, Math.max(1, Math.round(r.borderWidth)));
  if (typeof r.opacity === 'number' && Number.isFinite(r.opacity)) out.opacity = Math.min(1, Math.max(MIN_OPACITY, r.opacity));
  // only pictures we made ourselves (small data URLs) are accepted from a file
  if (typeof r.image === 'string' && /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(r.image) && r.image.length < 200_000) out.image = r.image;
  return out;
}

export function newPad(title = 'Scratchpad'): Scratchpad {
  return { id: `pad-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, text: '', updatedAt: new Date().toISOString() };
}

// should this note be on the page of the open document?
export const shownOn = (pad: Scratchpad, docId: string) => !!pad.floating && (!!pad.everywhere || (pad.docIds ?? []).includes(docId));

// a short line for cards: "Everywhere", "2 documents", "Not on any page"
export function whereLabel(pad: Scratchpad, titles: Record<string, string>): string {
  if (pad.everywhere) return 'Every document';
  const ids = (pad.docIds ?? []).filter(id => id in titles);
  if (!ids.length) return 'No document yet';
  return ids.length === 1 ? titles[ids[0]] : `${ids.length} documents`;
}

// where a note starts: a corner of the page. pets start bottom right, out of the way of the writing; sticky notes top left.
export function startSpot(pad: Pick<Scratchpad, 'kind' | 'w' | 'h'>, page: { width: number; height: number }): { x: number; y: number } {
  const w = pad.w ?? 260, h = pad.h ?? 220;
  return pad.kind === 'pet' ? { x: Math.max(0, page.width - w - 24), y: Math.max(0, page.height - h - 24) } : { x: 40, y: 90 };
}

// one pad's text, searched. title and body, case blind
export const matchesSearch = (pad: Scratchpad, query: string) => {
  const q = query.trim().toLowerCase();
  return !q || pad.title.toLowerCase().includes(q) || pad.text.toLowerCase().includes(q);
};

// a bit of the text around the first match, for the list
export function snippet(pad: Scratchpad, query: string, length = 90): string {
  const text = pad.text.replace(/\s+/g, ' ').trim();
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return text.slice(0, length);
  const start = Math.max(0, at - 24);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + length)}${start + length < text.length ? '…' : ''}`;
}

// ----- one note as a file -----
export const NOTE_FILE_TYPE = 'asterism-scratchpad';

export function noteFile(pad: Scratchpad): { fileName: string; text: string } {
  const name = pad.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'scratchpad';
  // where it was on the page and which documents it showed on stay behind; the reader decides those
  const { id: _id, floating: _f, x: _x, y: _y, docIds: _d, everywhere: _e, ...keep } = pad;
  return { fileName: `${name}.scratchpad.asterism.json`, text: JSON.stringify({ type: NOTE_FILE_TYPE, version: 1, pad: keep }, null, 2) };
}

export function parseNoteFile(text: string): Scratchpad | { error: string } {
  if (text.length > 400_000) return { error: 'That file is too big to be one scratchpad.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: 'That is not an Asterism scratchpad file.' }; }
  const r = raw as { type?: unknown; pad?: unknown } | null;
  if (!r || r.type !== NOTE_FILE_TYPE || !r.pad || typeof r.pad !== 'object') return { error: 'That is not an Asterism scratchpad file.' };
  const p = r.pad as Record<string, unknown>;
  const base = newPad(typeof p.title === 'string' ? p.title.replace(/[<>]/g, '').slice(0, 60) || 'Scratchpad' : 'Scratchpad');
  return {
    ...base,
    text: typeof p.text === 'string' ? p.text.slice(0, 50_000) : '',
    w: typeof p.w === 'number' ? Math.min(900, Math.max(160, p.w)) : undefined,
    h: typeof p.h === 'number' ? Math.min(900, Math.max(120, p.h)) : undefined,
    style: cleanNoteStyle(p.style),
  };
}

// a picture for a note's background: shrunk to fit and re-encoded, so a note stays small
export async function noteImage(file: File, maxSide = 420): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error('Pick a picture: png, jpg, webp or gif.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('That picture would not open.')); i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', 0.72);
    if (out.length >= 200_000) throw new Error('That picture is too detailed. Try a smaller one.');
    return out;
  } finally { URL.revokeObjectURL(url); }
}

// ----- how a note is drawn -----
const CLIP: Partial<Record<NoteShape, string>> = {
  folded: 'polygon(0 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%)',
  hexagon: 'polygon(12% 0, 88% 0, 100% 50%, 88% 100%, 12% 100%, 0 50%)',
  ticket: 'polygon(0 6%, 4% 0, 96% 0, 100% 6%, 100% 40%, 97% 45%, 100% 50%, 100% 94%, 96% 100%, 4% 100%, 0 94%, 0 50%, 3% 45%, 0 40%)',
};
const RADIUS: Partial<Record<NoteShape, string>> = {
  square: '2px', rounded: '16px', pill: '999px', oval: '50%', blob: '58% 42% 55% 45% / 48% 58% 42% 52%',
};

// the part of a shape that is always inside it. the title, the text and the resize handle live in here,
// so a shape that cuts into its corners never hides them. insets are top/right/bottom/left in percent of the note.
export const NOTE_SAFE: Record<NoteShape, { inset: string; handle: { right: string; bottom: string } }> = {
  square: { inset: '0 0 0 0', handle: { right: '0px', bottom: '0px' } },
  rounded: { inset: '0 0 0 0', handle: { right: '2px', bottom: '2px' } },
  pill: { inset: '9% 11% 9% 11%', handle: { right: '9%', bottom: '8%' } },
  oval: { inset: '13% 14% 13% 14%', handle: { right: '13%', bottom: '12%' } },
  blob: { inset: '10% 11% 10% 11%', handle: { right: '10%', bottom: '10%' } },
  folded: { inset: '0 0 0 0', handle: { right: '2px', bottom: '30px' } },
  hexagon: { inset: '0 11% 0 11%', handle: { right: '11%', bottom: '2px' } },
  ticket: { inset: '3% 4% 3% 4%', handle: { right: '4%', bottom: '3%' } },
};

export function darkColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) < 140;
}

export function noteCss(style: NoteStyle | undefined): CSSProperties {
  const s = cleanNoteStyle(style);
  const color = s.color ?? DEFAULT_NOTE_COLOR;
  const shape = s.shape ?? 'square';
  const border = s.border ?? 'none';
  const bc = s.borderColor ?? '#3a321a';
  const bw = s.borderWidth ?? 2;
  const css: CSSProperties = {
    backgroundColor: color,
    color: darkColor(color) ? '#f5f1e6' : '#3a321a',
    opacity: s.opacity ?? 1,
    borderRadius: RADIUS[shape] ?? '0',
    clipPath: CLIP[shape],
  };
  if (s.image) { css.backgroundImage = `url(${s.image})`; css.backgroundSize = 'cover'; css.backgroundPosition = 'center'; }
  if (border === 'solid' || border === 'dashed' || border === 'dotted') css.border = `${bw}px ${border} ${bc}`;
  else if (border === 'double') css.border = `${Math.max(3, bw * 2)}px double ${bc}`;
  else if (border === 'stitched') { css.outline = `${bw}px dashed ${bc}`; css.outlineOffset = -6; }
  return css;
}

// bring a note onto the page. where it was last left is kept; a new one starts in its corner.
export function putOnPage(pad: Scratchpad, docId: string, page?: { width: number; height: number }): Scratchpad {
  const size = page ?? (typeof window === 'undefined' ? { width: 1200, height: 800 } : { width: window.innerWidth, height: window.innerHeight });
  const w = pad.w ?? 260, h = pad.h ?? 220;
  const spot = pad.x === undefined || pad.y === undefined ? startSpot({ kind: pad.kind, w, h }, size) : { x: pad.x, y: pad.y };
  const there = pad.everywhere || (pad.docIds ?? []).includes(docId);
  return { ...pad, floating: true, w, h, ...spot, ...(there ? {} : { docIds: [...(pad.docIds ?? []), docId] }) };
}
