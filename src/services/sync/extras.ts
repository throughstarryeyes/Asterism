import type { CustomThemeConfig, ThemeImages, UserStats } from '../../types';
import { sanitizeCustomSound, type CustomSound } from '../soundRecipes';
import { sanitizeSoundscape, type CustomSoundscape } from '../soundscapes';
import { sanitizeCursor, type CustomCursor } from '../customCursor';
import { PREFERENCE_KINDS, type AnalyzerPreference } from '../analyzerFeedback';
import { MADE_KINDS, madeKey, madeOf, parseMade, type Made } from '../made';

// app-level extras (themes, theme pictures, sounds, soundscapes, cursors, analyzer preferences) travel as one small record
// each item has a stamp and the newest wins, so edits and deletions both carry over

export interface Stamp { at: number; gone?: true }
export type Stamps = Record<string, Stamp>;

export interface Extras {
  themes: CustomThemeConfig[];
  sounds: CustomSound[];
  images: Record<string, ThemeImages>; // by built-in theme id
  scapes: CustomSoundscape[];
  cursors: CustomCursor[];
  prefs: AnalyzerPreference[]; // the ones that apply to every document
  // loaders, scene breaks, flourishes, trails, chimes and comment shapes the writer made (see services/made)
  made?: Made;
  stamps: Stamps; // "theme:<id>", "sound:<id>", "images:<theme id>", "scape:<id>", "cursor:<id>", "pref:<id>", "<kind>:<id>" for the things in `made`
}

export const EXTRAS_ID = 'extras';

export const themeKey = (id: string) => `theme:${id}`;
export const soundKey = (id: string) => `sound:${id}`;
export const imagesKey = (id: string) => `images:${id}`;
export const scapeKey = (id: string) => `scape:${id}`;
export const cursorKey = (id: string) => `cursor:${id}`;
export const prefKey = (id: string) => `pref:${id}`;

export function extrasOf(stats: Pick<UserStats, 'customThemes' | 'customSounds' | 'themeImages' | 'customSoundscapes' | 'customCursors' | 'analyzerPreferences' | 'customLoaders' | 'customSeparators' | 'customFlourishes' | 'customTrails' | 'customChimes' | 'customShapes' | 'customPalettes' | 'customCovers' | 'customCelebrations' | 'customPairings' | 'customTextures' | 'customEdges' | 'customSkins' | 'customShelves' | 'customBundles'> & { extrasStamps?: Stamps }): Extras {
  return {
    themes: stats.customThemes || [],
    sounds: stats.customSounds || [],
    images: stats.themeImages || {},
    scapes: stats.customSoundscapes || [],
    cursors: stats.customCursors || [],
    prefs: stats.analyzerPreferences || [],
    made: madeOf(stats),
    stamps: stats.extrasStamps || {},
  };
}

// the same extras always give the same text, so a side that already has them is not sent them again.
export function serializeExtras(e: Extras): string {
  const byId = <T extends { id: string }>(list: T[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
  const images = Object.fromEntries(Object.entries(e.images).sort(([a], [b]) => a.localeCompare(b)));
  const stamps = Object.fromEntries(Object.entries(e.stamps).sort(([a], [b]) => a.localeCompare(b)));
  const made = Object.fromEntries(MADE_KINDS.map(k => [k, byId(e.made?.[k] ?? [])]));
  return JSON.stringify({ themes: byId(e.themes), sounds: byId(e.sounds), images, scapes: byId(e.scapes ?? []), cursors: byId(e.cursors ?? []), prefs: byId(e.prefs ?? []), made, stamps });
}

const isThemeLike = (t: unknown): t is CustomThemeConfig => {
  const r = t as Record<string, unknown> | null;
  return !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.name === 'string'
    && ['bgApp', 'bgPaper', 'textMain', 'accentPrimary'].every(k => typeof r[k] === 'string');
};

// the sanitizers invent an id when one is missing, which would duplicate the item on every sync
const hasId = (x: unknown) => !!x && typeof (x as { id?: unknown }).id === 'string';

const isPreferenceLike = (p: unknown): p is AnalyzerPreference => {
  const r = p as Record<string, unknown> | null;
  return !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.check === 'string' && r.scope === 'global'
    && typeof r.enabled === 'boolean' && typeof r.createdAt === 'string'
    && (r.kind === undefined || PREFERENCE_KINDS.includes(r.kind as never));
};

const isImagesLike = (v: unknown): v is ThemeImages => !!v && typeof v === 'object';

// what another device sent, checked before it is used.
export function parseExtras(text: string): Extras | null {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const stamps: Stamps = {};
  for (const [k, v] of Object.entries((raw.stamps ?? {}) as Record<string, unknown>)) {
    const s = v as Stamp | null;
    if (s && typeof s.at === 'number' && Number.isFinite(s.at)) stamps[k] = s.gone ? { at: s.at, gone: true } : { at: s.at };
  }
  const images: Record<string, ThemeImages> = {};
  for (const [k, v] of Object.entries((raw.images ?? {}) as Record<string, unknown>)) if (isImagesLike(v)) images[k] = v;
  return {
    themes: Array.isArray(raw.themes) ? raw.themes.filter(isThemeLike) : [],
    sounds: Array.isArray(raw.sounds) ? raw.sounds.map(sanitizeCustomSound).filter((s): s is CustomSound => !!s) : [],
    images,
    scapes: Array.isArray(raw.scapes) ? raw.scapes.filter(hasId).map(sanitizeSoundscape).filter((s): s is CustomSoundscape => !!s && s.layers.length > 0) : [],
    cursors: Array.isArray(raw.cursors) ? raw.cursors.filter(hasId).map(sanitizeCursor).filter((c): c is CustomCursor => !!c) : [],
    prefs: Array.isArray(raw.prefs) ? raw.prefs.filter(isPreferenceLike) : [],
    made: parseMade(raw.made),
    stamps,
  };
}

const at = (stamps: Stamps, key: string) => stamps[key]?.at ?? 0;

// newest stamp wins; on a tie, or when neither side has one, this device keeps what it has.
export function mergeExtras(local: Extras, incoming: Extras): Extras {
  const stamps: Stamps = { ...local.stamps };
  for (const [k, s] of Object.entries(incoming.stamps)) if (s.at > at(stamps, k)) stamps[k] = s;

  // `mine` is the side whose stamp was kept; take the other side's item only if it is newer.
  const pick = <T>(key: string, mine: T | undefined, theirs: T | undefined): T | undefined => {
    if (stamps[key]?.gone) return undefined;
    if (mine === undefined) return theirs;
    if (theirs === undefined) return mine;
    return at(incoming.stamps, key) > at(local.stamps, key) ? theirs : mine;
  };

  const ids = <T extends { id: string }>(a: T[], b: T[]) => [...new Set([...a.map(x => x.id), ...b.map(x => x.id)])];
  const find = <T extends { id: string }>(list: T[], id: string) => list.find(x => x.id === id);

  const themes = ids(local.themes, incoming.themes)
    .map(id => pick(themeKey(id), find(local.themes, id), find(incoming.themes, id)))
    .filter((t): t is CustomThemeConfig => !!t);
  const sounds = ids(local.sounds, incoming.sounds)
    .map(id => pick(soundKey(id), find(local.sounds, id), find(incoming.sounds, id)))
    .filter((s): s is CustomSound => !!s);
  const images: Record<string, ThemeImages> = {};
  for (const id of new Set([...Object.keys(local.images), ...Object.keys(incoming.images)])) {
    const one = pick(imagesKey(id), local.images[id], incoming.images[id]);
    if (one) images[id] = one;
  }
  const scapes = ids(local.scapes ?? [], incoming.scapes ?? [])
    .map(id => pick(scapeKey(id), find(local.scapes ?? [], id), find(incoming.scapes ?? [], id)))
    .filter((s): s is CustomSoundscape => !!s);
  const cursors = ids(local.cursors ?? [], incoming.cursors ?? [])
    .map(id => pick(cursorKey(id), find(local.cursors ?? [], id), find(incoming.cursors ?? [], id)))
    .filter((c): c is CustomCursor => !!c);
  const prefs = ids(local.prefs ?? [], incoming.prefs ?? [])
    .map(id => pick(prefKey(id), find(local.prefs ?? [], id), find(incoming.prefs ?? [], id)))
    .filter((p): p is AnalyzerPreference => !!p);
  const made: Made = {};
  for (const k of MADE_KINDS) {
    const mine = local.made?.[k] ?? [];
    const theirs = incoming.made?.[k] ?? [];
    made[k] = ids(mine, theirs)
      .map(id => pick(madeKey(k, id), find(mine, id), find(theirs, id)))
      .filter((x): x is { id: string } => !!x);
  }
  return { themes, sounds, images, scapes, cursors, prefs, made, stamps };
}

// a stamp for an item the writer just saved or deleted here.
export const stamped = (stamps: Stamps | undefined, key: string, gone = false, now = Date.now()): Stamps =>
  ({ ...(stamps || {}), [key]: gone ? { at: now, gone: true } : { at: now } });

// stamps for whatever differs between two lists: new and changed items get a time, removed ones a deletion mark.
export function stampChanges<T extends { id: string }>(stamps: Stamps | undefined, keyOf: (id: string) => string, before: T[], after: T[], now = Date.now()): Stamps {
  let next = stamps || {};
  const was = new Map(before.map(x => [x.id, JSON.stringify(x)]));
  for (const item of after) if (was.get(item.id) !== JSON.stringify(item)) next = stamped(next, keyOf(item.id), false, now);
  const kept = new Set(after.map(x => x.id));
  for (const id of was.keys()) if (!kept.has(id)) next = stamped(next, keyOf(id), true, now);
  return next;
}
