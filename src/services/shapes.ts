// the look of comment cards and the text they mark. built-in and the writer's own share this.

export type ShapeBorder = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
export type ShapeBar = 'none' | 'left' | 'top';
export type ShapeCorner = 'none' | 'fold' | 'tail' | 'tape';
export type ShapeMark = 'highlight' | 'underline' | 'wavy' | 'dotted' | 'box';

export interface ShapeConfig {
  id: string;
  name: string;
  radius: number; // px
  border: ShapeBorder;
  bar: ShapeBar;
  corner: ShapeCorner;
  tilt: number; // degrees
  tint: boolean; // fill the card with a wash of the color
  mark: ShapeMark; // how marked text looks in the page
  color: string; // 'accent' or #rrggbb
  // the color of the marks in the text: 'same' follows the card's color, or 'accent' or #rrggbb of its own
  markColor?: string;
}

export const BORDERS: Record<ShapeBorder, string> = { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted', double: 'Double', none: 'None' };
export const BARS: Record<ShapeBar, string> = { none: 'None', left: 'Left edge', top: 'Top edge' };
export const CORNERS: Record<ShapeCorner, string> = { none: 'Plain', fold: 'Folded corner', tail: 'Speech tail', tape: 'Strip of tape' };
export const MARKS: Record<ShapeMark, string> = { highlight: 'Highlighter', underline: 'Underline', wavy: 'Wavy line', dotted: 'Dotted line', box: 'Outline' };

export const MAX_RADIUS = 28;
export const MAX_TILT = 3;
export const FREE_SHAPE = 'plain';

export const PRESET_SHAPES: ShapeConfig[] = [
  { id: 'plain', name: 'Plain', radius: 8, border: 'solid', bar: 'none', corner: 'none', tilt: 0, tint: false, mark: 'highlight', color: 'accent' },
  { id: 'bubble', name: 'Speech bubble', radius: 18, border: 'solid', bar: 'none', corner: 'tail', tilt: 0, tint: false, mark: 'highlight', color: 'accent' },
  { id: 'sticky', name: 'Sticky note', radius: 2, border: 'none', bar: 'none', corner: 'fold', tilt: -1, tint: true, mark: 'highlight', color: '#f2cf5c' },
  { id: 'ribbon', name: 'Ribbon', radius: 6, border: 'solid', bar: 'left', corner: 'none', tilt: 0, tint: false, mark: 'underline', color: 'accent' },
  { id: 'stamp', name: 'Stamp', radius: 4, border: 'dashed', bar: 'none', corner: 'none', tilt: 1, tint: false, mark: 'box', color: 'accent' },
  { id: 'scroll', name: 'Scroll', radius: 14, border: 'double', bar: 'none', corner: 'fold', tilt: 0, tint: true, mark: 'wavy', color: '#c9a66b' },
  { id: 'tape', name: 'Taped note', radius: 3, border: 'none', bar: 'none', corner: 'tape', tilt: 1.5, tint: true, mark: 'highlight', color: '#e8d8b8' },
  { id: 'lantern', name: 'Lantern', radius: 24, border: 'solid', bar: 'top', corner: 'none', tilt: 0, tint: false, mark: 'dotted', color: '#e0a040' },
  { id: 'chalk', name: 'Chalkboard', radius: 10, border: 'dashed', bar: 'none', corner: 'none', tilt: 0, tint: true, mark: 'underline', color: '#7aa6c0' },
];

export const SHAPE_COST: Record<string, number> = {
  plain: 0, bubble: 40, sticky: 40, ribbon: 50, stamp: 50, scroll: 70, tape: 60, lantern: 80, chalk: 50,
};

export const SHAPE_TEXT: Record<string, string> = {
  plain: 'Cards as they have always been.',
  bubble: 'Comments in speech bubbles.',
  sticky: 'Yellow sticky notes, a little crooked.',
  ribbon: 'A colored ribbon down the side, text underlined.',
  stamp: 'Dashed stamp borders, outlined text.',
  scroll: 'Parchment scrolls with a double rule.',
  tape: 'Notes taped to the margin.',
  lantern: 'Round cards with a glowing top edge.',
  chalk: 'Chalk-dashed cards on a blue wash.',
};

export function findShape(id: string | undefined, custom: ShapeConfig[] = []): ShapeConfig {
  return custom.find(s => s.id === id) ?? PRESET_SHAPES.find(s => s.id === id) ?? PRESET_SHAPES[0];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const oneOf = <T extends string>(set: Record<T, string>, v: unknown, fallback: T): T => (typeof v === 'string' && v in set ? (v as T) : fallback);

export function cleanShape(raw: Partial<ShapeConfig> & { id: string }): ShapeConfig {
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My shape',
    radius: Math.round(clamp(Number.isFinite(Number(raw.radius)) ? Number(raw.radius) : 8, 0, MAX_RADIUS)),
    border: oneOf(BORDERS, raw.border, 'solid'),
    bar: oneOf(BARS, raw.bar, 'none'),
    corner: oneOf(CORNERS, raw.corner, 'none'),
    tilt: Math.round(clamp(Number.isFinite(Number(raw.tilt)) ? Number(raw.tilt) : 0, -MAX_TILT, MAX_TILT) * 2) / 2,
    tint: !!raw.tint,
    mark: oneOf(MARKS, raw.mark, 'highlight'),
    color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : 'accent',
    markColor: typeof raw.markColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.markColor) ? raw.markColor : raw.markColor === 'accent' ? 'accent' : 'same',
  };
}

// the css variables and attributes the stylesheet reads. the plain shape sets nothing, so cards keep the theme's own look.
export function shapeStyle(s: ShapeConfig): { vars: Record<string, string>; corner: string; mark: string; bar: string } | null {
  if (s.id === FREE_SHAPE) return null;
  return {
    vars: {
      '--cs-radius': `${s.radius}px`,
      '--cs-border': s.border,
      '--cs-tilt': `${s.tilt}deg`,
      '--cs-color': s.color === 'accent' ? 'var(--accent-gold)' : s.color,
      '--cs-wash': s.tint ? '16%' : '0%',
      '--cs-mark': s.markColor === 'accent' ? 'var(--accent-gold)' : s.markColor && s.markColor !== 'same' ? s.markColor : s.color === 'accent' ? 'var(--accent-gold)' : s.color,
    },
    corner: s.corner,
    mark: s.mark,
    bar: s.bar,
  };
}

export const SHAPE_VARS = ['--cs-radius', '--cs-border', '--cs-tilt', '--cs-color', '--cs-wash', '--cs-mark'];
