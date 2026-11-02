// uploaded cursors are redrawn as small pngs (browsers ignore cursor images over 128 px)
// and stored like other uploaded files

export const CURSOR_PREFIX = 'mycur-';
export const isCursorId = (id: string) => id.startsWith(CURSOR_PREFIX);
export const MAX_CURSORS = 12;
export const CURSOR_SIZES = [24, 32, 48] as const;
export const ACCEPTED_CURSOR_TYPES = ['image/png', 'image/webp', 'image/gif', 'image/jpeg', 'image/svg+xml'];
const MAX_CURSOR_BYTES = 2 * 1024 * 1024;

// the sharp point of the cursor, as a corner or the middle of the picture.
export const HOTSPOTS = [
  { id: 'top-left', label: 'Top left (an arrow)' },
  { id: 'top-center', label: 'Top middle' },
  { id: 'center', label: 'Middle (a crosshair)' },
  { id: 'bottom-left', label: 'Bottom left (a pen or pencil)' },
] as const;
export type Hotspot = (typeof HOTSPOTS)[number]['id'];

export interface CustomCursor {
  id: string;
  name: string;
  assetId: string; // the stored PNG
  width: number;
  height: number;
  hotX: number;
  hotY: number;
}

export const newCursorId = () => `${CURSOR_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function validateCursorFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_CURSOR_TYPES.includes(file.type)) return 'Use a PNG, WebP, GIF, JPG or SVG picture.';
  if (file.size > MAX_CURSOR_BYTES) return 'Keep a cursor picture under 2 MB.';
  return null;
}

// scale to fit a square of `size`, up or down, keeping the shape.
export function fitInto(width: number, height: number, size: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: size, height: size };
  const scale = size / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function hotspotAt(hotspot: Hotspot, width: number, height: number): { x: number; y: number } {
  const mid = (n: number) => Math.round((n - 1) / 2);
  switch (hotspot) {
    case 'top-center': return { x: mid(width), y: 0 };
    case 'center': return { x: mid(width), y: mid(height) };
    case 'bottom-left': return { x: 0, y: height - 1 };
    default: return { x: 0, y: 0 };
  }
}

export function sanitizeCursor(raw: unknown): CustomCursor | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.assetId !== 'string' || !r.assetId) return null;
  const dim = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(1, Math.min(128, Math.round(n))) : 32);
  const width = dim(r.width);
  const height = dim(r.height);
  const pos = (n: unknown, max: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max - 1, Math.round(n))) : 0);
  return {
    id: typeof r.id === 'string' && isCursorId(r.id) ? r.id : newCursorId(),
    name: (typeof r.name === 'string' ? r.name : '').replace(/[<>]/g, '').trim().slice(0, 40) || 'My cursor',
    assetId: r.assetId,
    width, height,
    hotX: pos(r.hotX, width),
    hotY: pos(r.hotY, height),
  };
}

// the value for the CSS `cursor` property.
export const cursorCss = (url: string, c: Pick<CustomCursor, 'hotX' | 'hotY'>) => `url("${url}") ${c.hotX} ${c.hotY}, auto`;

// draw the picture at cursor size. needs a browser.
export async function makeCursorImage(file: File, size: number): Promise<{ blob: Blob; width: number; height: number }> {
  const problem = validateCursorFile(file);
  if (problem) throw new Error(problem);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // an SVG with no size of its own reports none; draw it square.
    const { width, height } = fitInto(img.naturalWidth || size, img.naturalHeight || size, size);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not process that picture.');
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
