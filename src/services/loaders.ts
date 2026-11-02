import type { LoaderConfig, LoaderLayout, LoaderShape } from '../types';

// every loader is a handful of shapes lighting up in turn. the built-in ones and the writer's own share this.

export const SHAPES: Record<LoaderShape, { name: string; path: string }> = {
  star: { name: 'Star', path: 'M12 1.5 L14.3 9.7 L22.5 12 L14.3 14.3 L12 22.5 L9.7 14.3 L1.5 12 L9.7 9.7 Z' },
  sparkle: { name: 'Five point', path: 'M12 2.5 L14.7 9 L21.5 9.4 L16.2 13.8 L18 20.5 L12 16.8 L6 20.5 L7.8 13.8 L2.5 9.4 L9.3 9 Z' },
  heart: { name: 'Heart', path: 'M12 21 C5 15.5 2.5 12 2.5 8.4 C2.5 5.6 4.7 3.5 7.4 3.5 C9.3 3.5 11 4.5 12 6.2 C13 4.5 14.7 3.5 16.6 3.5 C19.3 3.5 21.5 5.6 21.5 8.4 C21.5 12 19 15.5 12 21 Z' },
  diamond: { name: 'Diamond', path: 'M12 2 L21 12 L12 22 L3 12 Z' },
  circle: { name: 'Dot', path: 'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 Z' },
  moon: { name: 'Moon', path: 'M21 12.8 A9 9 0 1 1 11.2 3 a7 7 0 0 0 9.8 9.8 Z' },
  leaf: { name: 'Leaf', path: 'M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19 Z' },
  drop: { name: 'Drop', path: 'M12 2.5 C12 2.5 5 10 5 15 A7 7 0 0 0 19 15 C19 10 12 2.5 12 2.5 Z' },
};

export const LAYOUTS: Record<LoaderLayout, string> = {
  row: 'Row',
  ring: 'Ring',
  arc: 'Arc',
  wave: 'Wave',
  constellation: 'Constellation',
};

export const MIN_COUNT = 3;
export const MAX_COUNT = 7;
export const MIN_STEP = 0.1;
export const MAX_STEP = 0.6;

// the loaders that come with the app. the first three keep the ids they always had.
export const PRESET_LOADERS: LoaderConfig[] = [
  { id: 'stars', name: 'Starlight', shape: 'star', layout: 'row', count: 4, step: 0.28, color: 'accent' },
  { id: 'orbit', name: 'Orbit', shape: 'star', layout: 'ring', count: 4, step: 0.28, color: 'accent' },
  { id: 'constellation', name: 'Constellation', shape: 'star', layout: 'constellation', count: 5, step: 0.28, color: 'accent' },
  { id: 'hearts', name: 'Heartbeats', shape: 'heart', layout: 'row', count: 3, step: 0.34, color: 'accent' },
  { id: 'moonrise', name: 'Moonrise', shape: 'moon', layout: 'arc', count: 5, step: 0.3, color: 'accent' },
  { id: 'fireflies', name: 'Fireflies', shape: 'circle', layout: 'wave', count: 6, step: 0.2, color: 'accent' },
  { id: 'petals', name: 'Petals', shape: 'leaf', layout: 'ring', count: 6, step: 0.22, color: 'accent' },
  { id: 'rain', name: 'Rainfall', shape: 'drop', layout: 'row', count: 5, step: 0.16, color: 'accent' },
  { id: 'gems', name: 'Gemstones', shape: 'diamond', layout: 'constellation', count: 6, step: 0.24, color: 'accent' },
  { id: 'wishes', name: 'Wishes', shape: 'sparkle', layout: 'arc', count: 7, step: 0.18, color: 'accent' },
];

export const FREE_LOADER = 'stars';

export function findLoader(id: string | undefined, custom: LoaderConfig[] = []): LoaderConfig {
  return custom.find(l => l.id === id) ?? PRESET_LOADERS.find(l => l.id === id) ?? PRESET_LOADERS[0];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// a loader from whatever was saved, kept inside what the animation can draw
export function cleanLoader(raw: Partial<LoaderConfig> & { id: string }): LoaderConfig {
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : 'accent';
  return {
    id: raw.id,
    name: (raw.name ?? '').trim().slice(0, 24) || 'My loader',
    shape: raw.shape && raw.shape in SHAPES ? raw.shape : 'star',
    layout: raw.layout && raw.layout in LAYOUTS ? raw.layout : 'row',
    count: Math.round(clamp(Number(raw.count) || 4, MIN_COUNT, MAX_COUNT)),
    step: clamp(Number(raw.step) || 0.28, MIN_STEP, MAX_STEP),
    color,
  };
}

// one full pass of the lights, with a rest at the end
export const cycleSeconds = (c: Pick<LoaderConfig, 'count' | 'step'>) => c.count * c.step + 0.6;

// where each shape sits, as percentages of the box. a row has no points: it lays itself out.
export function layoutPoints(layout: LoaderLayout, count: number): Array<[number, number]> {
  const n = Math.max(1, count);
  const along = (i: number) => (n === 1 ? 50 : 8 + (84 * i) / (n - 1));
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    if (layout === 'ring') {
      const a = (-Math.PI / 2) + (2 * Math.PI * i) / n;
      out.push([50 + 42 * Math.cos(a), 50 + 42 * Math.sin(a)]);
    } else if (layout === 'arc') {
      out.push([along(i), 78 - 56 * Math.sin((Math.PI * i) / Math.max(1, n - 1))]);
    } else if (layout === 'wave') {
      out.push([along(i), 50 + 24 * Math.sin((2 * Math.PI * i) / Math.max(2, n - 1))]);
    } else if (layout === 'constellation') {
      out.push([along(i), [70, 30, 62, 22, 52, 36, 66][i % 7]]);
    } else {
      out.push([along(i), 50]);
    }
  }
  return out;
}

// the box a layout is drawn in, as multiples of the shape size
export function layoutBox(layout: LoaderLayout, count: number): [number, number] {
  if (layout === 'ring') return [3.4, 3.4];
  if (layout === 'row') return [count * 1.4, 1];
  if (layout === 'arc') return [count * 1.5 + 1, 2.4];
  if (layout === 'wave') return [count * 1.5 + 1, 2.2];
  return [count * 1.4 + 1, 3];
}
