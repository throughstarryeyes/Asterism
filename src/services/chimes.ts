// the little tunes that mark a finished sprint, a reached goal and a new badge. built-in and the writer's own share this.

export type ChimeWave = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type ChimeEvent = 'sprint' | 'goal' | 'badge';

export const CHIME_EVENTS: Array<{ id: ChimeEvent; label: string }> = [
  { id: 'sprint', label: 'Sprint finished' },
  { id: 'goal', label: 'Goal or challenge reached' },
  { id: 'badge', label: 'Badge earned' },
];

export const WAVES: Record<ChimeWave, string> = { sine: 'Soft', triangle: 'Mellow', square: 'Retro', sawtooth: 'Bright' };

export interface ChimeConfig {
  id: string;
  name: string;
  notes: number[]; // midi note numbers, 0 is a rest
  gap: number; // seconds between notes
  decay: number; // seconds each note rings
  wave: ChimeWave;
}

export const MIN_MIDI = 36;
export const MAX_MIDI = 96;
export const MAX_NOTES = 8;
export const MIN_GAP = 0.04;
export const MAX_GAP = 0.5;
export const MIN_DECAY = 0.15;
export const MAX_DECAY = 1.8;

export const FREE_CHIME = 'fanfare';
export const DEFAULT_CHIME_VOLUME = 0.5;
// 'off' is silence. only the sprint chime plays until the writer picks others
export const NO_CHIME = 'off';
export const DEFAULT_CHIMES: Record<ChimeEvent, string> = { sprint: 'fanfare', goal: NO_CHIME, badge: NO_CHIME };

export const PRESET_CHIMES: ChimeConfig[] = [
  { id: 'fanfare', name: 'Fanfare', notes: [72, 76, 79, 84], gap: 0.11, decay: 0.6, wave: 'sine' },
  { id: 'bell', name: 'Little bell', notes: [79, 84], gap: 0.2, decay: 1.2, wave: 'triangle' },
  { id: 'sparkle', name: 'Sparkle', notes: [88, 91, 95, 100], gap: 0.07, decay: 0.5, wave: 'sine' },
  { id: 'harp', name: 'Harp run', notes: [60, 64, 67, 72, 76, 79], gap: 0.09, decay: 0.9, wave: 'triangle' },
  { id: 'musicbox', name: 'Music box', notes: [84, 88, 86, 91], gap: 0.16, decay: 0.7, wave: 'sine' },
  { id: 'gong', name: 'Low gong', notes: [48, 55], gap: 0.3, decay: 1.7, wave: 'sine' },
  { id: 'arcade', name: 'Arcade', notes: [67, 67, 72, 76, 79], gap: 0.08, decay: 0.25, wave: 'square' },
  { id: 'dawn', name: 'Dawn', notes: [64, 69, 72, 76, 81], gap: 0.18, decay: 1.1, wave: 'triangle' },
  { id: 'triumph', name: 'Triumph', notes: [60, 67, 72, 76, 79, 84, 88, 91], gap: 0.1, decay: 1.2, wave: 'triangle' },
  { id: 'trumpet', name: 'Herald', notes: [67, 72, 76, 0, 79, 84], gap: 0.12, decay: 0.45, wave: 'sawtooth' },
];

export const CHIME_COST: Record<string, number> = {
  fanfare: 0, bell: 30, sparkle: 40, harp: 60, musicbox: 60, gong: 50, arcade: 70, dawn: 90, trumpet: 80, triumph: 0,
};

export const CHIME_TEXT: Record<string, string> = {
  fanfare: 'The bright four-note arpeggio Asterism has always used.',
  bell: 'Two clear notes that ring out.',
  sparkle: 'A quick glittering climb.',
  harp: 'A six-string run from low to high.',
  musicbox: 'A tinkling music box phrase.',
  gong: 'Deep and slow, with a long ring.',
  arcade: 'Retro blips for a level cleared.',
  dawn: 'A slow, rising chord at sunrise.',
  trumpet: 'A short herald with a pause for effect.',
  triumph: 'A full, rising peal. Earned with a 100-day streak.',
};

export function findChime(id: string | undefined, custom: ChimeConfig[] = []): ChimeConfig {
  return custom.find(c => c.id === id) ?? PRESET_CHIMES.find(c => c.id === id) ?? PRESET_CHIMES[0];
}

// the chime for an event, or nothing when it is switched off
export function chimeFor(event: ChimeEvent, active: Partial<Record<ChimeEvent, string>> | undefined, custom: ChimeConfig[] = []): ChimeConfig | undefined {
  const id = active?.[event] ?? DEFAULT_CHIMES[event];
  return id === NO_CHIME ? undefined : findChime(id, custom);
}

// drop the choices that point at a chime that is gone, so those events fall back to their defaults
export function pruneChimes(active: Partial<Record<ChimeEvent, string>> | undefined, keep: (id: string) => boolean): Partial<Record<ChimeEvent, string>> {
  return Object.fromEntries(Object.entries(active ?? {}).filter(([, id]) => keep(id as string))) as Partial<Record<ChimeEvent, string>>;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function cleanChime(raw: Partial<ChimeConfig> & { id: string }): ChimeConfig {
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .map(n => Math.round(Number(n)))
    .filter(n => n === 0 || (Number.isFinite(n) && n >= MIN_MIDI && n <= MAX_MIDI))
    .slice(0, MAX_NOTES);
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My chime',
    notes: notes.some(n => n > 0) ? notes : [72, 76, 79],
    gap: clamp(Number(raw.gap) || 0.11, MIN_GAP, MAX_GAP),
    decay: clamp(Number(raw.decay) || 0.6, MIN_DECAY, MAX_DECAY),
    wave: raw.wave && raw.wave in WAVES ? raw.wave : 'sine',
  };
}

export const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (m: number) => (m === 0 ? 'rest' : `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`);

// when each note starts and how it sounds
export interface PlannedNote { freq: number; start: number; decay: number; wave: ChimeWave }

export function planChime(c: ChimeConfig): PlannedNote[] {
  const out: PlannedNote[] = [];
  c.notes.forEach((m, i) => { if (m > 0) out.push({ freq: midiToHz(m), start: i * c.gap, decay: c.decay, wave: c.wave }); });
  return out;
}

export const chimeSeconds = (c: ChimeConfig) => c.notes.length * c.gap + c.decay;
