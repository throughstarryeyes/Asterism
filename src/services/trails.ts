// a trail is a few glyphs that drift off the pointer as it moves. the built-in ones and the writer's own share this.

export type TrailMotion = 'float' | 'fall' | 'fade' | 'twinkle' | 'burst';

export const MOTIONS: Record<TrailMotion, string> = {
  float: 'Float up',
  fall: 'Fall down',
  fade: 'Fade in place',
  twinkle: 'Twinkle',
  burst: 'Burst out',
};

export interface TrailConfig {
  id: string;
  name: string;
  glyph: string; // one to three characters, picked at random for each bit
  color: string; // 'accent' or #rrggbb
  size: number; // px
  life: number; // ms each bit lasts
  spread: number; // px of random scatter
  motion: TrailMotion;
  rate: 1 | 2 | 3; // how often bits appear: sparse, usual, dense
}

export const TRAIL_GLYPHS = ['✦', '✧', '★', '·', '•', '❀', '❁', '✿', '♡', '♥', '♪', '♫', '❄', '☾', '✺', '◇', '☁', '🍃', '💧', '🔥'];

export const MIN_SIZE = 8;
export const MAX_SIZE = 28;
export const MIN_LIFE = 300;
export const MAX_LIFE = 1600;
export const MAX_SPREAD = 24;
export const MAX_BITS = 48;
export const NO_TRAIL = 'none';
export const FREE_TRAIL = NO_TRAIL;

export const PRESET_TRAILS: TrailConfig[] = [
  { id: 'dots', name: 'Ink dots', glyph: '•', color: 'accent', size: 8, life: 600, spread: 3, motion: 'fade', rate: 1 },
  { id: 'sparkle', name: 'Sparkle', glyph: '✦✧', color: 'accent', size: 14, life: 800, spread: 8, motion: 'twinkle', rate: 2 },
  { id: 'stardust', name: 'Stardust', glyph: '·•', color: 'accent', size: 12, life: 1000, spread: 14, motion: 'float', rate: 3 },
  { id: 'petals', name: 'Petals', glyph: '❀✿', color: '#e8a0b8', size: 16, life: 1300, spread: 10, motion: 'fall', rate: 1 },
  { id: 'hearts', name: 'Hearts', glyph: '♡♥', color: '#e0607e', size: 14, life: 1100, spread: 8, motion: 'float', rate: 1 },
  { id: 'embers', name: 'Embers', glyph: '•·', color: '#f08a3c', size: 10, life: 900, spread: 12, motion: 'float', rate: 3 },
  { id: 'snow', name: 'Snowfall', glyph: '❄·', color: '#a9c9e8', size: 14, life: 1400, spread: 16, motion: 'fall', rate: 2 },
  { id: 'notes', name: 'Music notes', glyph: '♪♫', color: 'accent', size: 16, life: 1200, spread: 6, motion: 'float', rate: 1 },
  { id: 'moonlight', name: 'Moonlight', glyph: '☾✧', color: '#c8c4f0', size: 14, life: 1000, spread: 10, motion: 'fade', rate: 2 },
  { id: 'fireworks', name: 'Fireworks', glyph: '✺✦', color: 'accent', size: 14, life: 700, spread: 22, motion: 'burst', rate: 2 },
  { id: 'comet', name: 'Comet tail', glyph: '✦·✧', color: '#9fd4ff', size: 16, life: 1200, spread: 4, motion: 'float', rate: 3 },
  { id: 'raindrops', name: 'Raindrops', glyph: '💧', color: 'accent', size: 12, life: 900, spread: 8, motion: 'fall', rate: 2 },
];

export const TRAIL_COST: Record<string, number> = {
  dots: 0, sparkle: 40, stardust: 50, petals: 60, hearts: 60, embers: 70, snow: 60, notes: 80, moonlight: 90, fireworks: 150, raindrops: 50, comet: 0,
};

export const TRAIL_TEXT: Record<string, string> = {
  dots: 'A faint line of ink dots behind the pointer.',
  sparkle: 'Little stars wink out behind the pointer.',
  stardust: 'A haze of dust that drifts upward.',
  petals: 'Petals tumble gently down.',
  hearts: 'Small hearts float away.',
  embers: 'Warm sparks rising from the pen.',
  snow: 'Snowflakes drift down as you move.',
  notes: 'Music notes lift off the page.',
  moonlight: 'Crescents and glints that fade where they fall.',
  fireworks: 'Bursts that fly out in every direction.',
  raindrops: 'Drops that fall from the pointer.',
  comet: 'A long streak of glittering ice. Earned with a 30-day streak.',
};

export function findTrail(id: string | undefined, custom: TrailConfig[] = []): TrailConfig | undefined {
  if (!id || id === NO_TRAIL) return undefined;
  return custom.find(t => t.id === id) ?? PRESET_TRAILS.find(t => t.id === id);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
// split into characters, not UTF-16 halves, so emoji stay whole
const chars = (s: string) => Array.from(s);

export function cleanTrail(raw: Partial<TrailConfig> & { id: string }): TrailConfig {
  const glyph = chars(typeof raw.glyph === 'string' ? raw.glyph.replace(/[<>&\s]/g, '') : '').slice(0, 3).join('') || '✦';
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My trail',
    glyph,
    color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : 'accent',
    size: Math.round(clamp(Number(raw.size) || 14, MIN_SIZE, MAX_SIZE)),
    life: Math.round(clamp(Number(raw.life) || 900, MIN_LIFE, MAX_LIFE)),
    spread: Math.round(clamp(Number.isFinite(Number(raw.spread)) ? Number(raw.spread) : 8, 0, MAX_SPREAD)),
    motion: raw.motion && raw.motion in MOTIONS ? raw.motion : 'float',
    rate: raw.rate === 1 || raw.rate === 3 ? raw.rate : 2,
  };
}

// pixels the pointer travels between bits: further apart for a sparse trail
export const spacing = (rate: TrailConfig['rate']) => ({ 1: 34, 2: 20, 3: 11 })[rate];

// where one bit starts, where it ends, and how it turns. `r` gives numbers from 0 to 1 so tests can fix them.
export interface Bit { glyph: string; fromX: number; fromY: number; toX: number; toY: number; turn: number }

export function planBit(t: TrailConfig, r: () => number = Math.random): Bit {
  const pick = chars(t.glyph);
  const glyph = pick[Math.floor(r() * pick.length) % pick.length];
  const scatter = () => (r() - 0.5) * 2 * t.spread;
  const fromX = scatter();
  const fromY = scatter();
  const reach = t.size * 2.2;
  let toX = fromX + (r() - 0.5) * t.size;
  let toY = fromY;
  if (t.motion === 'float') toY = fromY - reach * (0.6 + r() * 0.8);
  else if (t.motion === 'fall') { toY = fromY + reach * (0.6 + r() * 0.8); toX = fromX + (r() - 0.5) * t.size * 1.6; }
  else if (t.motion === 'burst') {
    const a = r() * Math.PI * 2;
    toX = fromX + Math.cos(a) * reach;
    toY = fromY + Math.sin(a) * reach;
  }
  return { glyph, fromX, fromY, toX, toY, turn: t.motion === 'fall' || t.motion === 'burst' ? (r() - 0.5) * 140 : (r() - 0.5) * 40 };
}

// the animation for a bit as web animations keyframes
export function bitFrames(t: TrailConfig, b: Bit): Keyframe[] {
  const at = (x: number, y: number, rot: number, scale: number, opacity: number): Keyframe =>
    ({ transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`, opacity });
  if (t.motion === 'twinkle') {
    return [at(b.fromX, b.fromY, 0, 0.2, 0), at(b.fromX, b.fromY, b.turn / 2, 1.2, 1), at(b.toX, b.toY, b.turn, 0.2, 0)];
  }
  if (t.motion === 'fade') return [at(b.fromX, b.fromY, 0, 1, 0.9), at(b.toX, b.toY, b.turn, 0.9, 0)];
  return [at(b.fromX, b.fromY, 0, 1, 1), at(b.toX, b.toY, b.turn, 0.5, 0)];
}
