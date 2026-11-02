// ports of callie's generators: pure functions with an injectable random source
// content lives in src/data/muse, copied unchanged from the bot
import prompts from '../../data/muse/prompts.json';
import autopsy from '../../data/muse/autopsy.json';
import faultlines from '../../data/muse/faultlines.json';
import characterHelp from '../../data/muse/characterhelp.json';
import settingHelp from '../../data/muse/settinghelp.json';
import tropesData from '../../data/muse/tropes.json';
import narrationData from '../../data/muse/narration_styles.json';
import descentData from '../../data/muse/descent.json';
import sceneStartersData from '../../data/muse/scenestarters.json';
import continueSceneData from '../../data/muse/continue_scene.json';
import oneLinersData from '../../data/muse/oneliners.json';
import exercisesData from '../../data/muse/writingexercises.json';
import wordBank from '../../data/muse/wordbank.json';
import charObjects from '../../data/muse/charobjects.json';
import colorsData from '../../data/muse/colors.json';
import animalsData from '../../data/muse/animals.json';

export type Rng = () => number;

export const pick = <T,>(items: readonly T[], rng: Rng = Math.random): T | undefined =>
  items.length ? items[Math.min(items.length - 1, Math.floor(rng() * items.length))] : undefined;

export function pickMany<T>(items: readonly T[], n: number, rng: Rng = Math.random): T[] {
  const pool = [...items];
  const out: T[] = [];
  const count = Math.max(1, Math.min(10, n));
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  }
  // tiny banks repeat rather than come up short, as the bot does.
  while (out.length < count && items.length) out.push(pick(items, rng)!);
  return out;
}

// ---- plain lists ---------------------------------------------------------
export const PROMPTS: string[] = prompts.prompts;
export const DESCENT_SEEDS: string[] = descentData.seeds;
export const WORDS: string[] = wordBank.words;
export const COLORS: string[] = colorsData.colors;
export const ANIMALS: string[] = animalsData.animals;
export const CHAR_OBJECTS: string[] = charObjects.objects;

// ---- character & setting -------------------------------------------------
export const CHARACTER_FIELDS = ['personality', 'desire', 'plan', 'core', 'obstacle', 'anchor', 'distance'] as const;
export type CharacterField = typeof CHARACTER_FIELDS[number];
export const CHARACTER_FIELD_LABELS: Record<CharacterField, string> = {
  personality: 'Who they are',
  desire: 'What they want',
  plan: 'How they plan to get it',
  core: 'Core wound',
  obstacle: 'What’s stopping them',
  anchor: 'What they love',
  distance: 'What makes them walk',
};
const CHARACTER_DATA = characterHelp as Record<CharacterField, string[]>;

export function generateCharacter(rng: Rng = Math.random): Record<CharacterField, string> {
  const out = {} as Record<CharacterField, string>;
  CHARACTER_FIELDS.forEach(f => { out[f] = pick(CHARACTER_DATA[f], rng) ?? ''; });
  return out;
}
export const rerollCharacterField = (field: CharacterField, rng: Rng = Math.random) => pick(CHARACTER_DATA[field], rng) ?? '';

export const SETTING_FIELDS = ['who', 'what', 'where', 'when', 'why'] as const;
export type SettingField = typeof SETTING_FIELDS[number];
const SETTING_DATA = settingHelp as Record<SettingField, string[]>;

export function generateSetting(rng: Rng = Math.random): Record<SettingField, string> {
  const out = {} as Record<SettingField, string>;
  SETTING_FIELDS.forEach(f => { out[f] = pick(SETTING_DATA[f], rng) ?? ''; });
  return out;
}
export const rerollSettingField = (field: SettingField, rng: Rng = Math.random) => pick(SETTING_DATA[field], rng) ?? '';

// ---- stats (the bot's !stats) --------------------------------------------
const roll = (max: number, rng: Rng) => 1 + Math.floor(rng() * max);
export function generateStats(type: 'classic' | 'psych' = 'classic', rng: Rng = Math.random): Record<string, number> {
  if (type === 'psych') {
    return Object.fromEntries(
      ['Empathy', 'Self-Preservation', 'Impulse Control', 'Self-Awareness', 'Detachment', 'Capacity for Violence'].map(k => [k, roll(10, rng)])
    );
  }
  return Object.fromEntries(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(k => [k, roll(20, rng)]));
}

// ---- autopsy / faultline / descent ---------------------------------------
export interface AutopsyPacket { title: string; questions: string[] }
export const AUTOPSY_PACKETS: AutopsyPacket[] = autopsy.packets;
export const randomAutopsy = (rng: Rng = Math.random) => pick(AUTOPSY_PACKETS, rng);

export interface Faultline { a_wants: string; b_wants: string; but: string }
export const FAULTLINES: Faultline[] = faultlines.pairs;
export const randomFaultline = (rng: Rng = Math.random) => pick(FAULTLINES, rng);

// ---- tropes (tag filtering, as in the bot) -------------------------------
export interface Trope { text: string; tags: string[] }
export const TROPES: Trope[] = tropesData.tropes;
export const TROPE_TAGS: string[] = [...new Set(TROPES.flatMap(t => t.tags))].sort();

export function pickTrope(opts: { include?: string[]; exclude?: string[] } = {}, rng: Rng = Math.random): Trope | undefined {
  const include = (opts.include ?? []).map(t => t.trim().toLowerCase()).filter(Boolean);
  const exclude = (opts.exclude ?? []).map(t => t.trim().toLowerCase()).filter(Boolean);
  const pool = TROPES.filter(t => {
    const tags = new Set(t.tags.map(x => x.toLowerCase()));
    return include.every(i => tags.has(i)) && !exclude.some(e => tags.has(e));
  });
  return pick(pool, rng);
}

// ---- narration styles ----------------------------------------------------
export interface NarrationStyle { name: string; description: string; tags: string[] }
export const NARRATION_STYLES: NarrationStyle[] = narrationData.narration_styles;
export const randomNarration = (rng: Rng = Math.random) => pick(NARRATION_STYLES, rng);

// ---- scene starters, continue-scene, one-liners, exercises ---------------
const sceneStarters = sceneStartersData.goals as Record<string, string[]>;
const continueScene = continueSceneData.goals as Record<string, string[]>;
export const SCENE_GOALS = Object.keys(sceneStarters).filter(g => sceneStarters[g].length);
export const CONTINUE_GOALS = Object.keys(continueScene).filter(g => continueScene[g].length);

export function randomSceneStarter(goal?: string, rng: Rng = Math.random): { goal: string; text: string } | undefined {
  const g = goal && sceneStarters[goal]?.length ? goal : pick(SCENE_GOALS, rng);
  const text = g ? pick(sceneStarters[g], rng) : undefined;
  return g && text ? { goal: g, text } : undefined;
}
export function randomContinueScene(goal?: string, rng: Rng = Math.random): { goal: string; text: string } | undefined {
  const g = goal && continueScene[goal]?.length ? goal : pick(CONTINUE_GOALS, rng);
  const text = g ? pick(continueScene[g], rng) : undefined;
  return g && text ? { goal: g, text } : undefined;
}

const oneLiners = oneLinersData.tags as Record<string, string[]>;
// "any" is empty in the data, so it means "any tag with entries".
export const ONELINER_TAGS = Object.keys(oneLiners).filter(t => oneLiners[t].length);
export function randomOneLiner(tag?: string, rng: Rng = Math.random): { tag: string; text: string } | undefined {
  const t = tag && oneLiners[tag]?.length ? tag : pick(ONELINER_TAGS, rng);
  const text = t ? pick(oneLiners[t], rng) : undefined;
  return t && text ? { tag: t, text } : undefined;
}

export interface Exercise { name: string; instruction: string; constraint?: string; duration?: string }
const exercises = exercisesData.exercises as Record<string, Exercise[]>;
export const EXERCISE_TYPES = Object.keys(exercises).filter(t => exercises[t].length);
export function randomExercise(type?: string, rng: Rng = Math.random): { type: string; exercise: Exercise } | undefined {
  const t = type && exercises[type]?.length ? type : pick(EXERCISE_TYPES, rng);
  const exercise = t ? pick(exercises[t], rng) : undefined;
  return t && exercise ? { type: t, exercise } : undefined;
}

// ---- palette (port of palette.py) ----------------------------------------
export type PaletteFamily = 'cool' | 'warm' | 'neutral';
export type PaletteTone = 'dark' | 'light' | 'pastel';
export type PaletteHue = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'black' | 'gray';
export interface PaletteOptions { count?: number; family?: PaletteFamily; tone?: PaletteTone; hue?: PaletteHue; rainbow?: boolean }

const uniform = (lo: number, hi: number, rng: Rng) => lo + (hi - lo) * rng();

function hsvToHex(h: number, s: number, v: number): string {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  const hex = (x: number) => Math.floor(x * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function svForTone(tone: PaletteTone | undefined, rng: Rng): [number, number] {
  if (tone === 'dark') return [uniform(0.6, 1.0, rng), uniform(0.2, 0.5, rng)];
  if (tone === 'light') return [uniform(0.2, 0.7, rng), uniform(0.7, 1.0, rng)];
  if (tone === 'pastel') return [uniform(0.2, 0.5, rng), uniform(0.8, 1.0, rng)];
  return [uniform(0.4, 1.0, rng), uniform(0.4, 1.0, rng)];
}

const HUE_RANGES: Record<string, [number, number]> = {
  red: [350, 10], orange: [20, 40], yellow: [45, 65], green: [90, 150], blue: [190, 240], purple: [260, 290], pink: [300, 340],
};

function generateColor(family: PaletteFamily | undefined, tone: PaletteTone | undefined, hue: PaletteHue | undefined, rng: Rng): string {
  if (hue === 'gray' || hue === 'black') {
    const v = hue === 'black' ? uniform(0, 0.25, rng) : uniform(0.3, 0.8, rng);
    return hsvToHex(rng(), uniform(0, 0.05, rng), v);
  }
  let deg: number;
  if (hue && HUE_RANGES[hue]) {
    const [start, end] = HUE_RANGES[hue];
    if (start <= end) deg = uniform(start, end, rng);
    else deg = rng() < 0.5 ? uniform(start, 360, rng) : uniform(0, end, rng);
  } else if (family === 'cool') {
    deg = uniform(160, 300, rng);
  } else if (family === 'warm') {
    deg = rng() < 0.5 ? uniform(0, 80, rng) : uniform(320, 360, rng);
  } else if (family === 'neutral') {
    const pool = [uniform(10, 40, rng), uniform(60, 120, rng), uniform(200, 240, rng)];
    deg = pick(pool, rng)!;
    return hsvToHex((deg % 360) / 360, uniform(0.05, 0.25, rng), uniform(0.55, 0.85, rng));
  } else {
    deg = uniform(0, 360, rng);
  }
  const [s, v] = svForTone(tone, rng);
  return hsvToHex((deg % 360) / 360, s, v);
}

export function generatePalette(opts: PaletteOptions = {}, rng: Rng = Math.random): string[] {
  const count = opts.rainbow ? 6 : Math.max(1, Math.min(6, opts.count ?? 3));
  if (opts.rainbow) {
    const degs = [0, 30, 60, 120, 210, 270];
    const [s, v] = svForTone(opts.tone, rng);
    return Array.from({ length: count }, (_, i) => hsvToHex((((degs[i % 6] + uniform(-5, 5, rng)) % 360) + 360) % 360 / 360, s, v));
  }
  return Array.from({ length: count }, () => generateColor(opts.family, opts.tone, opts.hue, rng));
}

// ---- A "spark": a jumping-off point built from several generators --------
export interface Spark {
  character: Record<CharacterField, string>;
  setting: Record<SettingField, string>;
  scene?: { goal: string; text: string };
  trope?: Trope;
  narration?: NarrationStyle;
  words: string[];
  object?: string;
  palette: string[];
}

export function generateSpark(rng: Rng = Math.random): Spark {
  return {
    character: generateCharacter(rng),
    setting: generateSetting(rng),
    scene: randomSceneStarter(undefined, rng),
    trope: pickTrope({}, rng),
    narration: randomNarration(rng),
    words: pickMany(WORDS, 3, rng),
    object: pick(CHAR_OBJECTS, rng),
    palette: generatePalette({ count: 3 }, rng),
  };
}
