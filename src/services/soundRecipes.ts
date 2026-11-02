// custom keystroke sounds: a recipe of synthesized layers, or a set of recordings
// pure: describes and cleans up sounds and plans each key press; the audio engine plays them

import { OLD_SOUND_KEY } from './legacy';

export type KeyClass = 'letter' | 'space' | 'enter' | 'backspace';

export const KEY_CLASSES: KeyClass[] = ['letter', 'space', 'enter', 'backspace'];

export function keyClass(key: string): KeyClass {
  if (key === ' ') return 'space';
  if (key === 'Enter') return 'enter';
  if (key === 'Backspace' || key === 'Delete') return 'backspace';
  return 'letter';
}

// ---- recipes ---------------------------------------------------------------

export type NoiseFilter = 'lowpass' | 'highpass' | 'bandpass';
export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';

interface LayerBase {
  // milliseconds after the key press.
  delay: number;
  // milliseconds the layer lasts before dying away.
  dur: number;
  gain: number;
}
// a short burst of filtered noise: clicks, snaps, taps, scrapes.
export interface NoiseLayer extends LayerBase { kind: 'noise'; filter: NoiseFilter; freq: number; q: number }
// a sine that falls in pitch: weight, "thock", body.
export interface ThumpLayer extends LayerBase { kind: 'thump'; from: number; to: number }
// a tone that can glide: pops, chirps, bells.
export interface ToneLayer extends LayerBase { kind: 'tone'; wave: Wave; from: number; to: number }
export type Layer = NoiseLayer | ThumpLayer | ToneLayer;

export interface SoundRecipe {
  // 0 = identical every press, 1 = quite loose. real keys are never identical.
  variation: number;
  letter: Layer[];
  space?: Layer[];
  enter?: Layer[];
  backspace?: Layer[];
}

export const MAX_LAYERS = 8;

const LIMITS = {
  delay: [0, 1500], dur: [2, 2000], gain: [0.001, 1], freq: [20, 16000], q: [0.1, 20],
} as const;

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(lo, Math.min(hi, x));
};

export function newLayer(kind: Layer['kind']): Layer {
  if (kind === 'noise') return { kind, filter: 'bandpass', freq: 2000, q: 1, delay: 0, dur: 20, gain: 0.25 };
  if (kind === 'thump') return { kind, from: 160, to: 80, delay: 0, dur: 50, gain: 0.3 };
  return { kind: 'tone', wave: 'sine', from: 800, to: 400, delay: 0, dur: 60, gain: 0.2 };
}

// force any layer (possibly from a hand-edited file) into safe values.
export function sanitizeLayer(raw: unknown): Layer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = {
    delay: clamp(r.delay, LIMITS.delay, 0),
    dur: clamp(r.dur, LIMITS.dur, 30),
    gain: clamp(r.gain, LIMITS.gain, 0.2),
  };
  if (r.kind === 'noise') {
    const filter: NoiseFilter = r.filter === 'lowpass' || r.filter === 'highpass' ? r.filter : 'bandpass';
    return { kind: 'noise', filter, freq: clamp(r.freq, LIMITS.freq, 2000), q: clamp(r.q, LIMITS.q, 1), ...base };
  }
  if (r.kind === 'thump') {
    return { kind: 'thump', from: clamp(r.from, LIMITS.freq, 160), to: clamp(r.to, LIMITS.freq, 80), ...base };
  }
  if (r.kind === 'tone') {
    const wave: Wave = r.wave === 'triangle' || r.wave === 'square' || r.wave === 'sawtooth' ? r.wave : 'sine';
    return { kind: 'tone', wave, from: clamp(r.from, LIMITS.freq, 800), to: clamp(r.to, LIMITS.freq, 400), ...base };
  }
  return null;
}

const sanitizeLayers = (raw: unknown): Layer[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  return raw.slice(0, MAX_LAYERS).map(sanitizeLayer).filter((l): l is Layer => !!l);
};

export function sanitizeRecipe(raw: unknown): SoundRecipe {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const letter = sanitizeLayers(r.letter) ?? [];
  const out: SoundRecipe = {
    variation: clamp(r.variation, [0, 1], 0.4),
    letter: letter.length ? letter : [newLayer('noise'), newLayer('thump')],
  };
  (['space', 'enter', 'backspace'] as const).forEach(k => {
    const layers = sanitizeLayers(r[k]);
    if (layers && layers.length) out[k] = layers;
  });
  return out;
}

// space, enter and backspace use the letter sound unless they have their own.
export function layersFor(recipe: SoundRecipe, cls: KeyClass): Layer[] {
  return (cls === 'letter' ? recipe.letter : recipe[cls]) ?? recipe.letter;
}

export type Rng = () => number;

export interface PlannedEvent {
  layer: Layer;
  // seconds after the key press.
  at: number;
  dur: number;
  gain: number;
  // for thumps and tones: where the pitch starts and ends. for noise: from = filter frequency.
  from: number;
  to: number;
}

// what to play for one key press. with variation 0 this is exactly the recipe.
export function planEvents(recipe: SoundRecipe, key: string, rng: Rng = Math.random): PlannedEvent[] {
  const v = Math.max(0, Math.min(1, recipe.variation));
  const wobble = (amount: number) => 1 + (rng() * 2 - 1) * v * amount;
  return layersFor(recipe, keyClass(key)).map(layer => {
    const pitch = wobble(0.25);
    const from = layer.kind === 'noise' ? layer.freq : layer.from;
    const to = layer.kind === 'noise' ? layer.freq : layer.to;
    return {
      layer,
      at: (layer.delay + rng() * v * 8) / 1000,
      dur: layer.dur / 1000,
      gain: Math.max(0.001, Math.min(1, layer.gain * wobble(0.3))),
      from: Math.max(20, Math.min(16000, from * pitch)),
      to: Math.max(20, Math.min(16000, to * pitch)),
    };
  });
}

// ---- recordings ------------------------------------------------------------

export interface SampleSound {
  // stored audio files (see services/assetStore). space/enter fall back to letter.
  letter?: string;
  space?: string;
  enter?: string;
  backspace?: string;
  // 0 = same pitch every press; 1 = about three semitones either way.
  variation: number;
  gain: number;
}

export function sanitizeSample(raw: unknown): SampleSound {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length < 200 ? v : undefined);
  return {
    letter: id(r.letter), space: id(r.space), enter: id(r.enter), backspace: id(r.backspace),
    variation: clamp(r.variation, [0, 1], 0.3),
    gain: clamp(r.gain, [0.05, 2], 1),
  };
}

export function sampleIdFor(sample: SampleSound, cls: KeyClass): string | undefined {
  return (cls === 'letter' ? sample.letter : sample[cls]) ?? sample.letter;
}

export interface PlannedSample { assetId: string; rate: number; gain: number }

export function planSample(sample: SampleSound, key: string, rng: Rng = Math.random): PlannedSample | null {
  const assetId = sampleIdFor(sample, keyClass(key));
  if (!assetId) return null;
  const semitones = (rng() * 2 - 1) * sample.variation * 3;
  return { assetId, rate: Math.pow(2, semitones / 12), gain: sample.gain };
}

// ---- A saved custom sound --------------------------------------------------

export interface CustomSound {
  id: string;
  name: string;
  type: 'recipe' | 'sample';
  recipe?: SoundRecipe;
  sample?: SampleSound;
}

// recordings that come with the app live in public/sounds and are fetched when first played
export const BUILT_IN_SAMPLE_PREFIX = 'builtin:';
export const BUILT_IN_SAMPLES: CustomSound[] = [
  {
    id: 'real-typewriter', name: 'Real Typewriter', type: 'sample',
    // the letter recording also serves for space and backspace, which were the same recording
    sample: { letter: `${BUILT_IN_SAMPLE_PREFIX}typewriter-letter.wav`, enter: `${BUILT_IN_SAMPLE_PREFIX}typewriter-enter.wav`, variation: 0.43, gain: 1 },
  },
];
export const isBuiltInSample = (id: string) => BUILT_IN_SAMPLES.some(s => s.id === id);

export const CUSTOM_SOUND_PREFIX = 'custom-';
export const isCustomSoundId = (id: string) => id.startsWith(CUSTOM_SOUND_PREFIX);
export const MAX_CUSTOM_SOUNDS = 30;

export function newSoundId(): string {
  return `${CUSTOM_SOUND_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newRecipeSound(name = 'My sound', recipe: SoundRecipe = defaultRecipe()): CustomSound {
  return { id: newSoundId(), name, type: 'recipe', recipe: sanitizeRecipe(recipe) };
}

export function newSampleSound(name = 'My recording'): CustomSound {
  return { id: newSoundId(), name, type: 'sample', sample: sanitizeSample({}) };
}

export function sanitizeCustomSound(raw: unknown): CustomSound | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && isCustomSoundId(r.id) ? r.id : newSoundId();
  const name = (typeof r.name === 'string' ? r.name : '').replace(/[<>]/g, '').trim().slice(0, 40) || 'Untitled sound';
  if (r.type === 'recipe') return { id, name, type: 'recipe', recipe: sanitizeRecipe(r.recipe) };
  if (r.type === 'sample') return { id, name, type: 'sample', sample: sanitizeSample(r.sample) };
  return null;
}

// every stored audio file a list of sounds refers to (so unused ones can be pruned).
export function soundAssetIds(sounds: CustomSound[]): string[] {
  return sounds.flatMap(s => (s.type === 'sample' && s.sample
    ? [s.sample.letter, s.sample.space, s.sample.enter, s.sample.backspace]
    : [])).filter((x): x is string => !!x);
}

// starting points: hand-built recipes to begin from

export function defaultRecipe(): SoundRecipe {
  return sanitizeRecipe({
    variation: 0.4,
    letter: [
      { kind: 'noise', filter: 'bandpass', freq: 1800, q: 0.7, delay: 0, dur: 14, gain: 0.3 },
      { kind: 'thump', from: 170, to: 85, delay: 1, dur: 55, gain: 0.28 },
    ],
  });
}

export const PRESETS: Array<{ name: string; recipe: SoundRecipe }> = [
  {
    name: 'Typewriter',
    recipe: sanitizeRecipe({
      variation: 0.45,
      letter: [
        { kind: 'noise', filter: 'bandpass', freq: 1700, q: 0.7, delay: 0, dur: 14, gain: 0.3 },
        { kind: 'noise', filter: 'lowpass', freq: 2000, q: 0.8, delay: 2, dur: 40, gain: 0.24 },
        { kind: 'thump', from: 165, to: 85, delay: 1, dur: 55, gain: 0.3 },
        { kind: 'noise', filter: 'bandpass', freq: 3300, q: 2, delay: 38, dur: 10, gain: 0.1 },
      ],
      space: [
        { kind: 'thump', from: 135, to: 70, delay: 0, dur: 75, gain: 0.34 },
        { kind: 'noise', filter: 'lowpass', freq: 1300, q: 0.8, delay: 0, dur: 50, gain: 0.2 },
      ],
    }),
  },
  {
    name: 'Soft thock',
    recipe: sanitizeRecipe({
      variation: 0.35,
      letter: [
        { kind: 'thump', from: 260, to: 110, delay: 0, dur: 70, gain: 0.34 },
        { kind: 'noise', filter: 'lowpass', freq: 900, q: 0.7, delay: 0, dur: 30, gain: 0.18 },
      ],
      space: [
        { kind: 'thump', from: 190, to: 80, delay: 0, dur: 95, gain: 0.4 },
        { kind: 'noise', filter: 'lowpass', freq: 700, q: 0.7, delay: 0, dur: 45, gain: 0.2 },
      ],
    }),
  },
  {
    name: 'Crisp click',
    recipe: sanitizeRecipe({
      variation: 0.3,
      letter: [
        { kind: 'noise', filter: 'highpass', freq: 3500, q: 0.8, delay: 0, dur: 8, gain: 0.3 },
        { kind: 'tone', wave: 'square', from: 2600, to: 1800, delay: 0, dur: 10, gain: 0.06 },
        { kind: 'noise', filter: 'bandpass', freq: 2200, q: 1.2, delay: 18, dur: 8, gain: 0.12 },
      ],
    }),
  },
  {
    name: 'Bubble pop',
    recipe: sanitizeRecipe({
      variation: 0.6,
      letter: [{ kind: 'tone', wave: 'sine', from: 420, to: 1100, delay: 0, dur: 70, gain: 0.3 }],
      space: [{ kind: 'tone', wave: 'sine', from: 300, to: 800, delay: 0, dur: 120, gain: 0.34 }],
    }),
  },
  {
    name: 'Water drop',
    recipe: sanitizeRecipe({
      variation: 0.6,
      letter: [
        { kind: 'tone', wave: 'sine', from: 1500, to: 600, delay: 0, dur: 90, gain: 0.26 },
        { kind: 'noise', filter: 'bandpass', freq: 3000, q: 3, delay: 0, dur: 12, gain: 0.08 },
      ],
    }),
  },
  {
    name: 'Muted felt',
    recipe: sanitizeRecipe({
      variation: 0.3,
      letter: [
        { kind: 'thump', from: 140, to: 70, delay: 0, dur: 80, gain: 0.32 },
        { kind: 'noise', filter: 'lowpass', freq: 500, q: 0.7, delay: 0, dur: 40, gain: 0.14 },
      ],
    }),
  },
];

// ---- sharing sounds as files -----------------------------------------------

export const SOUND_FILE_VERSION = 1;

export interface SoundFile {
  asterismSound: number;
  sound: CustomSound;
  // recordings, base64, keyed by the id used inside `sound.sample`.
  audio?: Record<string, { type: string; data: string }>;
}

export function parseSoundFile(text: string): SoundFile | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (!raw || (raw.asterismSound ?? raw[OLD_SOUND_KEY]) !== SOUND_FILE_VERSION) return null;
    const sound = sanitizeCustomSound(raw.sound);
    if (!sound) return null;
    const audio: SoundFile['audio'] = {};
    if (raw.audio && typeof raw.audio === 'object') {
      Object.entries(raw.audio as Record<string, unknown>).forEach(([id, v]) => {
        const a = v as { type?: unknown; data?: unknown };
        if (typeof a?.type === 'string' && a.type.startsWith('audio/') && typeof a.data === 'string') audio[id] = { type: a.type, data: a.data };
      });
    }
    return { asterismSound: SOUND_FILE_VERSION, sound, audio };
  } catch {
    return null;
  }
}

// ---- uploaded recordings ---------------------------------------------------

export const ACCEPTED_AUDIO_TYPES = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac'];
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 3;

export function validateAudioFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) return 'Use a WAV, MP3, OGG or M4A file.';
  if (file.size > MAX_AUDIO_BYTES) return 'Keep each recording under 2 MB. A single key press is only a fraction of a second.';
  return null;
}
