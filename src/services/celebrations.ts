// the confetti when points or goals come in: what it is made of and how it moves. built-in and the writer's own share this.
// pure: planCelebration turns a style into timed steps, and celebrationRun.ts draws them.

export type Effect = 'burst' | 'fountain' | 'fireworks' | 'shooting' | 'snowfall' | 'rain';

export const EFFECTS: Record<Effect, string> = {
  burst: 'Burst',
  fountain: 'Fountain',
  fireworks: 'Fireworks',
  shooting: 'Shooting star',
  snowfall: 'Snowfall',
  rain: 'Rain',
};

export interface CelebrationConfig {
  id: string;
  name: string;
  // 'square', 'circle', 'star' or one character (a snowflake, a heart, an emoji), up to four
  shapes: string[];
  colors: string[]; // #rrggbb, up to five
  effect: Effect;
  amount: 1 | 2 | 3; // how much: a little, usual, a lot
  size: 1 | 2 | 3;
}

export const FLAT_SHAPES = ['square', 'circle', 'star'];
export const SHAPE_GLYPHS = ['❄', '♥', '✿', '✦', '♪', '☾', '✺', '🍃', '💧', '🔥', '🌸', '⭐'];
export const MAX_SHAPES = 4;
export const MAX_COLORS = 5;
export const FREE_CELEBRATION = 'classic';
// picked to turn confetti off altogether
export const NO_CELEBRATION = 'none';
const HEX = /^#[0-9a-f]{6}$/i;
const GOLD = ['#c9933b', '#f7c948', '#8f4c24', '#fceffe'];

export const PRESET_CELEBRATIONS: CelebrationConfig[] = [
  { id: 'classic', name: 'Classic confetti', shapes: ['square', 'circle'], colors: GOLD, effect: 'burst', amount: 2, size: 2 },
  { id: 'starburst', name: 'Starburst', shapes: ['star'], colors: ['#f7c948', '#fff4c2', '#e8a33a'], effect: 'burst', amount: 2, size: 2 },
  { id: 'shooting', name: 'Shooting star', shapes: ['star', '✦'], colors: ['#ffffff', '#fff1b8', '#9fd4ff'], effect: 'shooting', amount: 2, size: 2 },
  { id: 'snowfall', name: 'Snowfall', shapes: ['❄'], colors: ['#ffffff', '#cfe6ff', '#9ec5ee'], effect: 'snowfall', amount: 2, size: 2 },
  { id: 'fireworks', name: 'Fireworks', shapes: ['circle', 'star'], colors: ['#ff6b6b', '#ffd166', '#6bcbef', '#c792ea', '#7be0a0'], effect: 'fireworks', amount: 2, size: 2 },
  { id: 'fountain', name: 'Fountain', shapes: ['circle', 'square'], colors: ['#f48fb1', '#f8bbd0', '#ffd180'], effect: 'fountain', amount: 2, size: 2 },
  { id: 'petals', name: 'Petals', shapes: ['✿', '🌸'], colors: ['#f4a6c0', '#f8c8d8'], effect: 'snowfall', amount: 1, size: 3 },
  { id: 'hearts', name: 'Hearts', shapes: ['♥'], colors: ['#e0607e', '#f4a6c0', '#ffffff'], effect: 'burst', amount: 2, size: 2 },
  { id: 'rain', name: 'Spring rain', shapes: ['💧'], colors: ['#7ec3ee'], effect: 'rain', amount: 2, size: 2 },
];

export const CELEBRATION_COST: Record<string, number> = {
  classic: 0, starburst: 40, shooting: 90, snowfall: 60, fireworks: 120, fountain: 70, petals: 60, hearts: 50, rain: 50,
};

export const CELEBRATION_TEXT: Record<string, string> = {
  classic: 'Gold and cream confetti, as it has always been.',
  starburst: 'A burst of little gold stars.',
  shooting: 'A star streaks across the screen and leaves a glittering tail.',
  snowfall: 'Snowflakes drift down from the top.',
  fireworks: 'Colored bursts go off across the sky.',
  fountain: 'Confetti shoots up from both corners.',
  petals: 'Blossoms flutter down.',
  hearts: 'A burst of hearts.',
  rain: 'A short shower of drops.',
};

export function findCelebration(id: string | undefined, custom: CelebrationConfig[] = []): CelebrationConfig {
  return custom.find(c => c.id === id) ?? PRESET_CELEBRATIONS.find(c => c.id === id) ?? PRESET_CELEBRATIONS[0];
}

const level = (n: unknown): 1 | 2 | 3 => (n === 1 || n === 3 ? n : 2);

export function cleanCelebration(raw: Partial<CelebrationConfig> & { id: string }): CelebrationConfig {
  const shapes = (Array.isArray(raw.shapes) ? raw.shapes : [])
    .filter((s): s is string => typeof s === 'string' && (FLAT_SHAPES.includes(s) || (Array.from(s).length === 1 && !/[<>&\s]/.test(s))))
    .filter((s, i, all) => all.indexOf(s) === i)
    .slice(0, MAX_SHAPES);
  const colors = (Array.isArray(raw.colors) ? raw.colors : [])
    .filter((c): c is string => typeof c === 'string' && HEX.test(c))
    .map(c => c.toLowerCase())
    .slice(0, MAX_COLORS);
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My confetti',
    shapes: shapes.length ? shapes : ['square', 'circle'],
    colors: colors.length ? colors : GOLD,
    effect: raw.effect && raw.effect in EFFECTS ? raw.effect : 'burst',
    amount: level(raw.amount),
    size: level(raw.size),
  };
}

// what one puff of confetti is told. shapes are still the names above; the runner turns them into drawings.
export interface Puff {
  particleCount: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  gravity?: number;
  drift?: number;
  decay?: number;
  ticks?: number;
  scalar: number;
  origin: { x: number; y: number };
}
export interface Step { at: number; puff: Puff }

const AMOUNT = { 1: 0.6, 2: 1, 3: 1.8 } as const;
const SCALE = { 1: 0.8, 2: 1.1, 3: 1.6 } as const;

// `r` gives numbers from 0 to 1 so tests can fix them
export function planCelebration(c: CelebrationConfig, r: () => number = Math.random): Step[] {
  const m = AMOUNT[c.amount];
  const scalar = SCALE[c.size];
  const n = (base: number) => Math.max(1, Math.round(base * m));
  const steps: Step[] = [];
  const add = (at: number, puff: Omit<Puff, 'scalar'> & { scalar?: number }) => steps.push({ at: Math.round(at), puff: { scalar, ...puff } });

  switch (c.effect) {
    case 'burst':
      add(0, { particleCount: n(50), spread: 60, startVelocity: 45, origin: { x: 0.5, y: 0.8 } });
      break;
    case 'fountain':
      for (let i = 0; i < 8; i++) {
        add(i * 100, { particleCount: n(6), angle: 60, spread: 50, startVelocity: 55, origin: { x: 0.05, y: 0.95 } });
        add(i * 100, { particleCount: n(6), angle: 120, spread: 50, startVelocity: 55, origin: { x: 0.95, y: 0.95 } });
      }
      break;
    case 'fireworks':
      for (let i = 0; i < Math.max(2, Math.round(4 * m)); i++) {
        add(i * 320, { particleCount: n(32), spread: 360, startVelocity: 28, gravity: 0.7, decay: 0.92, ticks: 70, origin: { x: 0.2 + r() * 0.6, y: 0.15 + r() * 0.3 } });
      }
      break;
    case 'shooting': {
      // a streak from one top corner down to the other side; each step leaves stars hanging that fade, which makes the tail
      const fromRight = r() < 0.5;
      const x0 = fromRight ? 0.92 : 0.08, x1 = fromRight ? 0.2 : 0.8;
      const y0 = 0.05 + r() * 0.1, y1 = y0 + 0.5;
      const N = 16;
      for (let i = 0; i < N; i++) {
        const p = i / (N - 1);
        add(i * 28, { particleCount: n(2), spread: 8, startVelocity: 2, gravity: 0.12, decay: 0.9, ticks: 48, scalar: scalar * (0.6 + 0.9 * p), origin: { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p } });
      }
      add(N * 28, { particleCount: n(14), spread: 360, startVelocity: 9, gravity: 0.1, decay: 0.9, ticks: 45, scalar: scalar * 0.9, origin: { x: x1, y: y1 } });
      break;
    }
    case 'snowfall':
      for (let t = 0; t < 2400; t += 120) {
        add(t, { particleCount: n(3), angle: 270, spread: 160, startVelocity: 4, gravity: 0.35, drift: (r() - 0.5) * 1.2, ticks: 260, origin: { x: r(), y: -0.05 } });
      }
      break;
    case 'rain':
      for (let t = 0; t < 1600; t += 60) {
        add(t, { particleCount: n(3), angle: 270, spread: 8, startVelocity: 22, gravity: 1.4, ticks: 130, origin: { x: r(), y: -0.05 } });
      }
      break;
  }
  return steps;
}
