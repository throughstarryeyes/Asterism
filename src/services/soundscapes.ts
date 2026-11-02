import { ACCEPTED_AUDIO_TYPES, type NoiseFilter, type Wave } from './soundRecipes';

// soundscapes are layers of noise, tone, pulses (random sounds) or a looping recording
// each layer has volume, pan and optional slow movement; pure, the audio engine plays them

export type NoiseColor = 'white' | 'pink' | 'brown';
// a click is short noise, a tone is a note, and a rumble is deep noise that swells and fades over seconds, like thunder
export type PulseSource = 'click' | 'tone' | 'rumble';
export type MotionTarget = 'volume' | 'tone' | 'both';

// a slow wave laid over a layer. depth 0 means none.
export interface Motion { target: MotionTarget; rate: number; depth: number }

interface LayerBase { volume: number; pan: number; motion: Motion }
export interface NoiseLayer extends LayerBase { kind: 'noise'; color: NoiseColor; filter: NoiseFilter | 'none'; freq: number; q: number }
export interface ToneLayer extends LayerBase { kind: 'tone'; wave: Wave; freq: number; voices: number; detune: number }
export interface PulseLayer extends LayerBase {
  kind: 'pulses'; source: PulseSource; wave: Wave;
  freq: number; spread: number; q: number; // pitch in Hz; how far it wanders, in octaves either way
  dur: number; glide: number; rate: number; // milliseconds; octaves risen (+) or fallen (-); per second
  // how a note sounds as it goes: a slow swell in instead of a sharp start, a bend that goes out and comes back, and a rough, stick-slip wobble
  attack: number; contour: 'line' | 'arc'; rough: number;
}
export interface FileLayer extends LayerBase { kind: 'file'; source: string; rate: number }
export type ScapeLayer = NoiseLayer | ToneLayer | PulseLayer | FileLayer;

export interface CustomSoundscape {
  id: string;
  name: string;
  layers: ScapeLayer[];
}

// the soundscapes that come with the app, chosen by these ids like the older built-in sounds
export const BUILTIN_SCAPES = ['ocean', 'wind', 'fire'] as const;

export const SCAPE_PREFIX = 'scape-';
export const isScapeId = (id: string) => id.startsWith(SCAPE_PREFIX);
export const MAX_SCAPES = 20;
export const MAX_SCAPE_LAYERS = 8;
export const MAX_SCAPE_BYTES = 15 * 1024 * 1024;
// a recording is decoded into memory to loop without a gap, so it cannot be very long.
export const MAX_SCAPE_SECONDS = 180;

export const newScapeId = () => `${SCAPE_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---- limits and cleaning ---------------------------------------------------

const LIMITS = {
  volume: [0.02, 1], pan: [-1, 1], rate: [0.02, 8], depth: [0, 1],
  freq: [20, 16000], toneFreq: [20, 4000], q: [0.1, 20],
  voices: [1, 5], detune: [0, 50],
  spread: [0, 3], dur: [5, 14000], glide: [-3, 3], pulseRate: [0.01, 20], attack: [0, 0.9], rough: [0, 1],
  playback: [0.5, 2],
} as const;

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, x));
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;

const COLORS = ['white', 'pink', 'brown'] as const;
const FILTERS = ['lowpass', 'highpass', 'bandpass', 'none'] as const;
const WAVES = ['sine', 'triangle', 'square', 'sawtooth'] as const;
const TARGETS = ['volume', 'tone', 'both'] as const;

export const NO_MOTION: Motion = { target: 'volume', rate: 0.2, depth: 0 };

function sanitizeMotion(raw: unknown): Motion {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { target: oneOf(r.target, TARGETS, 'volume'), rate: clamp(r.rate, LIMITS.rate, 0.2), depth: clamp(r.depth, LIMITS.depth, 0) };
}

export function sanitizeLayer(raw: unknown): ScapeLayer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = { volume: clamp(r.volume, LIMITS.volume, 0.6), pan: clamp(r.pan, LIMITS.pan, 0), motion: sanitizeMotion(r.motion) };
  switch (r.kind) {
    case 'noise':
      return { kind: 'noise', color: oneOf(r.color, COLORS, 'pink'), filter: oneOf(r.filter, FILTERS, 'lowpass'), freq: clamp(r.freq, LIMITS.freq, 800), q: clamp(r.q, LIMITS.q, 0.7), ...base };
    case 'tone':
      return { kind: 'tone', wave: oneOf(r.wave, WAVES, 'sine'), freq: clamp(r.freq, LIMITS.toneFreq, 110), voices: Math.round(clamp(r.voices, LIMITS.voices, 1)), detune: clamp(r.detune, LIMITS.detune, 6), ...base };
    case 'pulses':
      return {
        kind: 'pulses', source: oneOf(r.source, ['click', 'tone', 'rumble'] as const, 'click'), wave: oneOf(r.wave, WAVES, 'sine'),
        freq: clamp(r.freq, LIMITS.freq, 2000), spread: clamp(r.spread, LIMITS.spread, 0.5), q: clamp(r.q, LIMITS.q, 2),
        dur: clamp(r.dur, LIMITS.dur, 40), glide: clamp(r.glide, LIMITS.glide, 0), rate: clamp(r.rate, LIMITS.pulseRate, 2),
        attack: clamp(r.attack, LIMITS.attack, 0), contour: oneOf(r.contour, ['line', 'arc'] as const, 'line'), rough: clamp(r.rough, LIMITS.rough, 0), ...base,
      };
    case 'file':
      return typeof r.source === 'string' && r.source ? { kind: 'file', source: r.source, rate: clamp(r.rate, LIMITS.playback, 1), ...base } : null;
    default:
      return null;
  }
}

// what a layer becomes when its sound is switched to a rumble: a slow, low roll that darkens as it dies away
export const RUMBLE_START = { source: 'rumble', freq: 380, spread: 0.3, q: 0.9, dur: 7000, glide: -1.5, attack: 0.18, rough: 0.55, rate: 0.05, volume: 0.6 } as const;

export function newLayer(kind: ScapeLayer['kind'], source = ''): ScapeLayer {
  const base = { volume: 0.5, pan: 0, motion: { ...NO_MOTION } };
  switch (kind) {
    case 'noise': return { kind, color: 'pink', filter: 'lowpass', freq: 800, q: 0.7, ...base };
    case 'tone': return { kind, wave: 'sine', freq: 110, voices: 1, detune: 6, ...base };
    case 'pulses': return { kind, source: 'click', wave: 'sine', freq: 2000, spread: 0.5, q: 2, dur: 40, glide: 0, rate: 2, attack: 0, contour: 'line', rough: 0, ...base };
    default: return { kind: 'file', source, rate: 1, ...base };
  }
}

// ---- starting points -------------------------------------------------------

const layer = (kind: ScapeLayer['kind'], over: Record<string, unknown>): ScapeLayer =>
  sanitizeLayer({ ...newLayer(kind), ...over, motion: { ...NO_MOTION, ...(over.motion as object) } })!;

export const PRESETS: Array<{ id: string; name: string; layers: ScapeLayer[] }> = [
  {
    id: 'rain', name: 'Rain on glass',
    layers: [
      layer('noise', { color: 'pink', filter: 'bandpass', freq: 1500, q: 0.4, volume: 0.45 }),
      layer('pulses', { source: 'click', freq: 4200, spread: 1, q: 2, dur: 14, rate: 18, volume: 0.25 }),
      layer('noise', { color: 'brown', filter: 'lowpass', freq: 300, q: 0.7, volume: 0.3 }),
    ],
  },
  {
    id: 'fire', name: 'Actual Crackling Fire',
    layers: [
      layer('pulses', { source: 'click', freq: 4708, spread: 0.5, q: 2, dur: 40, rate: 2, volume: 0.5, motion: { target: 'volume', rate: 0.2, depth: 0.44 } }),
      layer('pulses', { source: 'click', freq: 6892, spread: 0.5, q: 2, dur: 40, rate: 2, volume: 0.5, motion: { target: 'volume', rate: 0.064, depth: 0.5 } }),
      layer('noise', { color: 'brown', filter: 'lowpass', freq: 32, q: 0.1, volume: 0.82 }),
    ],
  },
  {
    id: 'ocean', name: 'Ocean Waves',
    layers: [
      layer('noise', { color: 'pink', filter: 'lowpass', freq: 212, q: 1.1, volume: 0.5, motion: { target: 'both', rate: 0.112, depth: 0.72 } }),
    ],
  },
  {
    id: 'wind', name: 'Wind Through Trees',
    layers: [
      layer('noise', { color: 'brown', filter: 'bandpass', freq: 350, q: 5.3, volume: 0.5, motion: { target: 'both', rate: 0.207, depth: 0.95 } }),
      layer('noise', { color: 'brown', filter: 'bandpass', freq: 117, q: 0.7, volume: 0.5, motion: { target: 'volume', rate: 0.128, depth: 0.7 } }),
      layer('noise', { color: 'brown', filter: 'lowpass', freq: 56, q: 0.7, volume: 0.82 }),
    ],
  },
  {
    id: 'boat', name: 'Creaking boat',
    layers: [
      layer('noise', { color: 'pink', filter: 'lowpass', freq: 420, q: 1.2, volume: 0.35, motion: { target: 'both', rate: 0.1, depth: 0.5 } }),
      layer('pulses', { source: 'tone', wave: 'sawtooth', freq: 150, spread: 0.45, q: 2, dur: 1100, glide: 0.35, contour: 'arc', attack: 0.45, rough: 0.7, rate: 0.28, volume: 0.22, pan: -0.3 }),
      layer('pulses', { source: 'tone', wave: 'sawtooth', freq: 230, spread: 0.4, q: 2, dur: 700, glide: -0.3, contour: 'arc', attack: 0.4, rough: 0.8, rate: 0.2, volume: 0.16, pan: 0.35 }),
    ],
  },
  {
    id: 'storm', name: 'Distant thunder',
    layers: [
      layer('noise', { color: 'pink', filter: 'bandpass', freq: 1500, q: 0.4, volume: 0.35 }),
      layer('pulses', { source: 'click', freq: 4200, spread: 1, q: 2, dur: 14, rate: 14, volume: 0.18 }),
      layer('pulses', { ...RUMBLE_START, volume: 0.65 }),
      layer('pulses', { ...RUMBLE_START, freq: 260, dur: 9500, rate: 0.03, rough: 0.7, volume: 0.55, pan: 0.2 }),
    ],
  },
  {
    id: 'night', name: 'Summer night',
    layers: [
      layer('pulses', { source: 'tone', wave: 'sine', freq: 4300, spread: 0.08, q: 2, dur: 28, rate: 16, volume: 0.1, pan: -0.4 }),
      layer('pulses', { source: 'tone', wave: 'sine', freq: 3900, spread: 0.08, q: 2, dur: 30, rate: 13, volume: 0.1, pan: 0.5 }),
      layer('noise', { color: 'brown', filter: 'lowpass', freq: 250, q: 0.7, volume: 0.18 }),
    ],
  },
  {
    id: 'chimes', name: 'Distant chimes',
    layers: [
      layer('pulses', { source: 'tone', wave: 'sine', freq: 880, spread: 0.9, q: 2, dur: 2200, rate: 0.25, volume: 0.35 }),
      layer('noise', { color: 'brown', filter: 'lowpass', freq: 180, q: 0.7, volume: 0.15 }),
    ],
  },
  {
    id: 'drone', name: 'Deep drone',
    layers: [
      layer('tone', { wave: 'sine', freq: 55, voices: 3, detune: 8, volume: 0.5, motion: { target: 'volume', rate: 0.05, depth: 0.35 } }),
      layer('tone', { wave: 'triangle', freq: 110, voices: 2, detune: 12, volume: 0.2, motion: { target: 'tone', rate: 0.08, depth: 0.2 } }),
    ],
  },
  {
    id: 'room', name: 'Quiet room',
    layers: [
      layer('noise', { color: 'brown', filter: 'lowpass', freq: 200, q: 0.7, volume: 0.35 }),
      layer('tone', { wave: 'sine', freq: 60, voices: 1, volume: 0.06 }),
    ],
  },
];

// ---- cleaning a whole soundscape -------------------------------------------

export function sanitizeSoundscape(raw: unknown): CustomSoundscape | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && isScapeId(r.id) ? r.id : newScapeId();
  const name = (typeof r.name === 'string' ? r.name : '').replace(/[<>]/g, '').trim().slice(0, 40) || 'Untitled soundscape';
  const layers: ScapeLayer[] = [];
  for (const l of Array.isArray(r.layers) ? r.layers : []) {
    const x = l as Record<string, unknown> | null;
    // soundscapes saved when layers were plain textures become the layers that make that texture.
    if (x && x.kind === 'texture') {
      const preset = PRESETS.find(p => p.id === ({ rain: 'rain', fireplace: 'fire', ocean: 'ocean', library: 'room', hum: 'drone' } as Record<string, string>)[String(x.source)]);
      const scale = clamp(x.volume, LIMITS.volume, 0.6);
      preset?.layers.forEach(p => layers.push({ ...p, volume: clamp(p.volume * scale, LIMITS.volume, 0.3) }));
    } else {
      const clean = sanitizeLayer(l);
      if (clean) layers.push(clean);
    }
  }
  return { id, name, layers: layers.slice(0, MAX_SCAPE_LAYERS) };
}

// a soundscape needs at least one layer to be worth saving.
export function scapeProblem(scape: CustomSoundscape): string | null {
  return scape.layers.length ? null : 'Add at least one layer: noise, a tone, pulses or a recording.';
}

// every stored recording a list of soundscapes refers to (so unused ones can be pruned).
export function scapeAssetIds(scapes: CustomSoundscape[]): string[] {
  return scapes.flatMap(s => s.layers.flatMap(l => (l.kind === 'file' ? [l.source] : [])));
}

export function validateScapeFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) return 'Use a WAV, MP3, OGG or M4A file.';
  if (file.size > MAX_SCAPE_BYTES) return 'Keep a recording under 15 MB.';
  return null;
}

export const tooLong = (seconds: number) =>
  seconds > MAX_SCAPE_SECONDS ? `That recording is ${Math.round(seconds)} seconds. Keep it under ${MAX_SCAPE_SECONDS / 60} minutes so it can loop smoothly.` : null;

export const LAYER_NAMES: Record<ScapeLayer['kind'], string> = { noise: 'Noise', tone: 'Tone', pulses: 'Pulses', file: 'Recording' };

export function ambientLabel(id: string, scapes: CustomSoundscape[] = []): string {
  if (id === 'off') return 'Silence';
  const own = scapes.find(s => s.id === id);
  if (own) return own.name;
  const names: Record<string, string> = { ocean: 'Ocean Waves', wind: 'Wind Through Trees', fire: 'Actual Crackling Fire', rain: 'Rain on Glass', library: 'Library Drone' };
  return names[id] ?? 'Soundscape';
}

// ---- what the random layers do ---------------------------------------------

export type Rng = () => number;

// how many pulses start in a stretch of `seconds` (they arrive at random, `rate` a second on average).
export function pulsesIn(rate: number, seconds: number, rng: Rng = Math.random): number {
  const limit = Math.exp(-Math.max(0, rate * seconds));
  let count = 0;
  let p = rng();
  while (p > limit && count < 50) { count++; p *= rng(); }
  return count;
}

export interface PlannedPulse { freq: number; endFreq: number; dur: number; gain: number; at: number; attack: number; contour: 'line' | 'arc'; rough: number }

// one pulse: a pitch somewhere in the layer's range, a loudness that varies, a moment inside the stretch.
export function planPulse(l: PulseLayer, seconds: number, rng: Rng = Math.random): PlannedPulse {
  const octaves = (rng() * 2 - 1) * l.spread;
  const freq = Math.max(20, Math.min(16000, l.freq * Math.pow(2, octaves)));
  return {
    freq,
    endFreq: Math.max(20, Math.min(16000, freq * Math.pow(2, l.glide))),
    dur: l.dur / 1000,
    gain: 0.35 + 0.65 * rng(),
    at: rng() * seconds,
    attack: l.attack ?? 0,
    contour: l.contour ?? 'line',
    rough: l.rough ?? 0,
  };
}

// an ambient choice saved by an older version: the old hearth fire is now the campfire, and the typewriter hum is gone
export const migrateAmbient = (id: string): string => (id === 'fireplace' ? 'fire' : id === 'typewriter' ? 'off' : id);
