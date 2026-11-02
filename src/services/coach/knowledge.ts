import defaults from '../../data/coachKnowledge.json';

// everything the coach looks for lives here as data: signal words, events to show, promise phrases
// the built-in copy is data/coachKnowledge.json; the writer's copy can be edited, exported and reset

export type CueMode = 'explicit' | 'physical' | 'avoidance' | 'deflection';
export const CUE_MODES: CueMode[] = ['explicit', 'physical', 'avoidance', 'deflection'];
export const CUE_MODE_LABELS: Record<CueMode, string> = {
  explicit: 'Names the feeling',
  physical: 'Body language',
  avoidance: 'Pulling away',
  deflection: 'Deflecting',
};

export interface FeelingDef {
  label: string;
  // how it fits in a sentence: "I think Mara may be ___" ("afraid", "in love").
  phrase: string;
  // -1 hostile .. 0 neutral .. 1 warm. used for the relationship weather.
  warmth: number;
  // the Callie question set (an autopsy packet title) that follows up on this feeling.
  packet?: string;
  cues: Record<CueMode, string[]>;
}

export interface CoachKnowledge {
  version: number;
  feelings: Record<string, FeelingDef>;
  events: string[];
  toldNotShown: string[];
  board: { promise: string[]; secret: string[]; warning: string[] };
  promptThemes: Record<string, string[]>;
}

export const KNOWLEDGE_VERSION = 1;
export const MAX_FEELINGS = 40;
const MAX_LIST = 300;
const MAX_ITEM = 80;

// ---- loading ------------------------------------------------------------------

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function defaultKnowledge(): CoachKnowledge {
  return sanitizeKnowledge(clone(defaults));
}

let shared: CoachKnowledge | null = null;
// one built-in copy for code that was not given the writer's own.
export function getDefaultKnowledge(): CoachKnowledge {
  if (!shared) shared = defaultKnowledge();
  return shared;
}

const cleanList = (v: unknown, max = MAX_LIST): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    // keep inner and trailing spaces that matter ("old ") but not leading ones.
    const t = item.replace(/^\s+/, '').slice(0, MAX_ITEM).toLowerCase();
    if (!t.trim() || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
};

const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;

export const slug = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

// accepts anything (an old save, a hand-edited file) and returns something safe to use.
// missing parts fall back to the built-in version.
export function sanitizeKnowledge(raw: unknown): CoachKnowledge {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const base = defaults as unknown as CoachKnowledge;

  const feelings: Record<string, FeelingDef> = {};
  const rawFeelings = r.feelings && typeof r.feelings === 'object' ? (r.feelings as Record<string, unknown>) : null;
  for (const [key, value] of Object.entries(rawFeelings ?? base.feelings).slice(0, MAX_FEELINGS)) {
    const id = slug(key);
    const f = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    if (!id) continue;
    const cues = (f.cues && typeof f.cues === 'object' ? f.cues : {}) as Record<string, unknown>;
    const label = (typeof f.label === 'string' ? f.label : key).trim().slice(0, 40) || id;
    feelings[id] = {
      label,
      phrase: (typeof f.phrase === 'string' && f.phrase.trim() ? f.phrase : label.toLowerCase()).trim().slice(0, 40),
      warmth: num(f.warmth, -1, 1, 0),
      packet: typeof f.packet === 'string' && f.packet.trim() ? f.packet.trim().slice(0, 60) : undefined,
      cues: {
        explicit: cleanList(cues.explicit),
        physical: cleanList(cues.physical),
        avoidance: cleanList(cues.avoidance),
        deflection: cleanList(cues.deflection),
      },
    };
  }

  const board = (r.board && typeof r.board === 'object' ? r.board : {}) as Record<string, unknown>;
  const themes: Record<string, string[]> = {};
  const rawThemes = r.promptThemes && typeof r.promptThemes === 'object' ? (r.promptThemes as Record<string, unknown>) : base.promptThemes;
  for (const [name, list] of Object.entries(rawThemes).slice(0, 40)) {
    const n = name.trim().slice(0, 40);
    if (n) themes[n] = cleanList(list);
  }

  return {
    version: KNOWLEDGE_VERSION,
    feelings: Object.keys(feelings).length ? feelings : clone(base.feelings),
    events: Array.isArray(r.events) ? cleanList(r.events) : clone(base.events),
    toldNotShown: Array.isArray(r.toldNotShown) ? cleanList(r.toldNotShown) : clone(base.toldNotShown),
    board: {
      promise: Array.isArray(board.promise) ? cleanList(board.promise) : clone(base.board.promise),
      secret: Array.isArray(board.secret) ? cleanList(board.secret) : clone(base.board.secret),
      warning: Array.isArray(board.warning) ? cleanList(board.warning) : clone(base.board.warning),
    },
    promptThemes: Object.keys(themes).length ? themes : clone(base.promptThemes),
  };
}

// ---- files --------------------------------------------------------------------

export function knowledgeToJson(k: CoachKnowledge): string {
  return JSON.stringify(k, null, 2);
}

export type ParseResult = { ok: true; knowledge: CoachKnowledge } | { ok: false; error: string };

export function parseKnowledgeJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `That isn’t valid JSON (${e instanceof Error ? e.message : 'parse error'}).` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Expected an object with “feelings”, “events” and so on.' };
  const r = raw as Record<string, unknown>;
  const known = ['version', 'feelings', 'events', 'toldNotShown', 'board', 'promptThemes'];
  if (!known.some(k => k in r)) return { ok: false, error: 'This doesn’t look like a coach knowledge file.' };
  return { ok: true, knowledge: sanitizeKnowledge(raw) };
}

// add anything the built-in copy has that this one lacks, keeping edits
// removed words come back, so this is a button and not automatic
export function mergeNewDefaults(k: CoachKnowledge): CoachKnowledge {
  const base = defaultKnowledge();
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  const feelings = { ...k.feelings };
  for (const [id, def] of Object.entries(base.feelings)) {
    const mine = feelings[id];
    feelings[id] = mine
      ? { ...mine, cues: Object.fromEntries(CUE_MODES.map(m => [m, union(mine.cues[m], def.cues[m])])) as Record<CueMode, string[]> }
      : def;
  }
  const themes = { ...k.promptThemes };
  for (const [name, list] of Object.entries(base.promptThemes)) themes[name] = union(themes[name] ?? [], list);
  return {
    ...k,
    feelings,
    events: union(k.events, base.events),
    toldNotShown: union(k.toldNotShown, base.toldNotShown),
    board: {
      promise: union(k.board.promise, base.board.promise),
      secret: union(k.board.secret, base.board.secret),
      warning: union(k.board.warning, base.board.warning),
    },
    promptThemes: themes,
  };
}

// ---- editing (each returns a new object) ---------------------------------------

const withFeeling = (k: CoachKnowledge, id: string, fn: (f: FeelingDef) => FeelingDef): CoachKnowledge =>
  k.feelings[id] ? { ...k, feelings: { ...k.feelings, [id]: fn(k.feelings[id]) } } : k;

export function setCues(k: CoachKnowledge, id: string, mode: CueMode, list: string[]): CoachKnowledge {
  return withFeeling(k, id, f => ({ ...f, cues: { ...f.cues, [mode]: cleanList(list) } }));
}

export function addCue(k: CoachKnowledge, id: string, mode: CueMode, cue: string): CoachKnowledge {
  return withFeeling(k, id, f => ({ ...f, cues: { ...f.cues, [mode]: cleanList([...f.cues[mode], cue]) } }));
}

export function removeCue(k: CoachKnowledge, id: string, mode: CueMode, cue: string): CoachKnowledge {
  return withFeeling(k, id, f => ({ ...f, cues: { ...f.cues, [mode]: f.cues[mode].filter(c => c !== cue) } }));
}

export function updateFeeling(k: CoachKnowledge, id: string, patch: Partial<Pick<FeelingDef, 'label' | 'phrase' | 'warmth' | 'packet'>>): CoachKnowledge {
  return withFeeling(k, id, f => ({
    ...f,
    ...(patch.label !== undefined ? { label: patch.label.slice(0, 40) } : {}),
    ...(patch.phrase !== undefined ? { phrase: patch.phrase.slice(0, 40) } : {}),
    ...(patch.warmth !== undefined ? { warmth: num(patch.warmth, -1, 1, f.warmth) } : {}),
    ...(patch.packet !== undefined ? { packet: patch.packet || undefined } : {}),
  }));
}

export function addFeeling(k: CoachKnowledge, label: string, warmth = 0): CoachKnowledge {
  const name = label.trim().slice(0, 40);
  let id = slug(name);
  if (!id || Object.keys(k.feelings).length >= MAX_FEELINGS) return k;
  for (let i = 2; k.feelings[id]; i++) id = `${slug(name)}-${i}`;
  const def: FeelingDef = { label: name, phrase: name.toLowerCase(), warmth: num(warmth, -1, 1, 0), cues: { explicit: [], physical: [], avoidance: [], deflection: [] } };
  return { ...k, feelings: { ...k.feelings, [id]: def } };
}

export function removeFeeling(k: CoachKnowledge, id: string): CoachKnowledge {
  if (Object.keys(k.feelings).length <= 1) return k; // always keep at least one
  const { [id]: _removed, ...rest } = k.feelings;
  return { ...k, feelings: rest };
}

export type ListKey = 'events' | 'toldNotShown';
export function setList(k: CoachKnowledge, key: ListKey, list: string[]): CoachKnowledge {
  return { ...k, [key]: cleanList(list) };
}
export function setBoardList(k: CoachKnowledge, kind: 'promise' | 'secret' | 'warning', list: string[]): CoachKnowledge {
  return { ...k, board: { ...k.board, [kind]: cleanList(list) } };
}
export function setTheme(k: CoachKnowledge, name: string, list: string[]): CoachKnowledge {
  const n = name.trim().slice(0, 40);
  return n ? { ...k, promptThemes: { ...k.promptThemes, [n]: cleanList(list) } } : k;
}
export function removeTheme(k: CoachKnowledge, name: string): CoachKnowledge {
  const { [name]: _removed, ...rest } = k.promptThemes;
  return { ...k, promptThemes: rest };
}

// ---- turning words into matchers -----------------------------------------------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// curly and straight apostrophes are the same word to a reader.
const apostrophes = (s: string) => s.replace(/'/g, "['’]");

// feeling cues match from the start of a word, so "tremb" catches trembled and trembling.
export function cueRegex(cue: string): RegExp {
  return new RegExp(`\\b${apostrophes(escapeRe(cue.trim()))}`, 'i');
}

// phrases match whole words, with an optional plural on single words ("funeral" / "funerals").
export function phraseRegex(phrase: string): RegExp {
  const p = apostrophes(escapeRe(phrase.trim()));
  return new RegExp(`\\b${p}${/^[a-z]+$/i.test(phrase.trim()) ? '(?:s|es)?' : ''}\\b`, 'i');
}

export function anyPhrase(phrases: string[]): RegExp | null {
  const parts = phrases.map(p => p.trim()).filter(Boolean).map(p => apostrophes(escapeRe(p)));
  return parts.length ? new RegExp(`\\b(?:${parts.join('|')})\\b`, 'i') : null;
}

export interface CompiledCue {
  kind: string;
  mode: CueMode;
  regexes: Array<{ stem: string; re: RegExp }>;
}

const compiled = new WeakMap<CoachKnowledge, CompiledCue[]>();

// compiled once per version of the knowledge, since detection runs on every sentence.
export function compileCues(k: CoachKnowledge): CompiledCue[] {
  let out = compiled.get(k);
  if (!out) {
    out = [];
    for (const [kind, def] of Object.entries(k.feelings)) {
      for (const mode of CUE_MODES) {
        const cues = def.cues[mode];
        if (cues.length) out.push({ kind, mode, regexes: cues.map(stem => ({ stem, re: cueRegex(stem) })) });
      }
    }
    compiled.set(k, out);
  }
  return out;
}

export const feelingPhrase = (k: CoachKnowledge, kind: string) => k.feelings[kind]?.phrase ?? kind.replace(/-/g, ' ');
export const feelingLabel = (k: CoachKnowledge, kind: string) => k.feelings[kind]?.label ?? kind.replace(/-/g, ' ');
export const feelingWarmth = (k: CoachKnowledge, kind: string) => k.feelings[kind]?.warmth ?? 0;
