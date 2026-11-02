// three-way merge of base, local and remote: a one-sided change is taken, differing changes are conflicts
// long text merges block by block, so edits to different paragraphs don't collide. when both sides changed the same paragraph,
// it is merged again word by word, so a typo fixed at the start and a sentence added at the end both survive. only when both
// sides rewrote the same words is it a real clash, and then the writer can keep both versions instead of losing one.

export type Seg = string | { id: string };

export interface Conflict {
  // stable for the same place in the project, so a chosen answer can be matched to it.
  key: string;
  path: Seg[];
  // a readable place: "Chapter 3 › content".
  label: string;
  kind: 'value' | 'text' | 'removed';
  local: unknown;
  remote: unknown;
  base: unknown;
  // set when the merge already kept both versions of a clash, so nobody has to choose
  kept?: 'both';
}

export interface MergeResult<T> {
  value: T;
  conflicts: Conflict[];
}

type Json = unknown;
const isObject = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasIds = (a: Json[]) => a.length > 0 && a.every(x => isObject(x) && typeof x.id === 'string');

export function deepEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined);
    const kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

const pathKey = (path: Seg[]) => path.map(s => (typeof s === 'string' ? s : `#${s.id}`)).join('/');

// ---- text ------------------------------------------------------------------------------------------

// pieces that always join back into the original string: after each closing block tag and each newline.
export function splitBlocks(s: string): string[] {
  return s.split(/(?<=<\/(?:p|div|h[1-6]|blockquote|ul|ol|pre|li)>|\n)/i).filter(x => x !== '');
}

const MAX_CELLS = 4_000_000;

// positions where the two sequences hold the same piece, in order.
export function matches(a: string[], b: string[]): Map<number, number> | null {
  const out = new Map<number, number>();
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) { out.set(lo, lo); lo++; }
  let ea = a.length, eb = b.length;
  const tail: [number, number][] = [];
  while (ea > lo && eb > lo && a[ea - 1] === b[eb - 1]) { ea--; eb--; tail.push([ea, eb]); }
  const n = ea - lo, m = eb - lo;
  if (n > 0 && m > 0) {
    if (n * m > MAX_CELLS) return null;
    const w = m + 1;
    const dp = new Uint16Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = a[lo + i] === b[lo + j] ? Math.min(65535, dp[(i + 1) * w + j + 1] + 1) : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[lo + i] === b[lo + j]) { out.set(lo + i, lo + j); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
      else j++;
    }
  }
  for (const [x, y] of tail) out.set(x, y);
  return out;
}

const sameChunk = (x: string[], y: string[]) => x.length === y.length && x.every((s, i) => s === y[i]);

// pieces of a paragraph: each tag, each run of spaces, each word. they always join back into the original string.
export function splitTokens(s: string): string[] {
  return s.match(/<[^>]*>|\s+|[^\s<]+|</g) ?? [];
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'col']);
// true when every tag that opens also closes, in order. a merge that mixed up two people's formatting is not trusted.
export function balanced(html: string): boolean {
  const stack: string[] = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g)) {
    const name = m[2].toLowerCase();
    if (VOID.has(name) || m[3]) continue;
    if (!m[1]) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0;
}

// where `n` differs from `b`: each stretch as [b0, b1) in `b` that became [n0, n1) in `n`. null when they are too big to compare.
export interface Run { b0: number; b1: number; n0: number; n1: number }
export function diffRuns(b: string[], n: string[]): Run[] | null {
  const m = matches(b, n);
  if (!m) return null;
  const runs: Run[] = [];
  let bi = 0, ni = 0;
  for (const [pb, pn] of [...m.entries()].sort((x, y) => x[0] - y[0])) {
    if (pb > bi || pn > ni) runs.push({ b0: bi, b1: pb, n0: ni, n1: pn });
    bi = pb + 1; ni = pn + 1;
  }
  if (bi < b.length || ni < n.length) runs.push({ b0: bi, b1: b.length, n0: ni, n1: n.length });
  return runs;
}

// two changes to the same starting text collide when they share some of it, or both insert at the very same place. changes that only
// sit side by side (one deletes a paragraph, the other edits the next) do not.
const collide = (a0: number, a1: number, h0: number, h1: number): boolean => {
  if (a0 === a1 && h0 === h1) return a0 === h0;
  if (a0 === a1) return h0 < a0 && a0 < h1;
  if (h0 === h1) return a0 < h0 && h0 < a1;
  return a0 < h1 && h0 < a1;
};

// the merged pieces, or null when a stretch changed on both sides cannot be settled by `clash`
function mergeSeq(b: string[], l: string[], r: string[], clash: (bc: string[], lc: string[], rc: string[]) => string[] | null): string[] | null {
  const L = diffRuns(b, l), R = diffRuns(b, r);
  if (!L || !R) return null;

  // this side's version of the stretch [c0, c1) of the starting text, with the changes in its group applied
  const side = (group: Run[], text: string[], c0: number, c1: number): string[] => {
    const out: string[] = [];
    let at = c0;
    for (const h of group) {
      out.push(...b.slice(at, h.b0), ...text.slice(h.n0, h.n1));
      at = h.b1;
    }
    out.push(...b.slice(at, c1));
    return out;
  };

  const out: string[] = [];
  let at = 0, i = 0, j = 0;
  while (i < L.length || j < R.length) {
    // the earliest change starts a group, which grows to take in every change from either side that collides with it
    const fromL = j >= R.length || (i < L.length && L[i].b0 <= R[j].b0);
    const first = fromL ? L[i++] : R[j++];
    const gL: Run[] = fromL ? [first] : [], gR: Run[] = fromL ? [] : [first];
    let c0 = first.b0, c1 = first.b1;
    for (let grew = true; grew;) {
      grew = false;
      if (i < L.length && collide(c0, c1, L[i].b0, L[i].b1)) { c0 = Math.min(c0, L[i].b0); c1 = Math.max(c1, L[i].b1); gL.push(L[i++]); grew = true; }
      if (j < R.length && collide(c0, c1, R[j].b0, R[j].b1)) { c0 = Math.min(c0, R[j].b0); c1 = Math.max(c1, R[j].b1); gR.push(R[j++]); grew = true; }
    }
    out.push(...b.slice(at, c0));
    const lc = side(gL, l, c0, c1), rc = side(gR, r, c0, c1);
    if (!gR.length) out.push(...lc);
    else if (!gL.length) out.push(...rc);
    else if (sameChunk(lc, rc)) out.push(...lc);
    else {
      const settled = clash(b.slice(c0, c1), lc, rc);
      if (!settled) return null;
      out.push(...settled);
    }
    at = c1;
  }
  out.push(...b.slice(at));
  return out;
}

// the merged text, or null when both sides rewrote the same words differently. with `both`, such a stretch keeps the other
// side's paragraphs and then this side's, so nothing anyone wrote is lost.
export function mergeText(base: string, local: string, remote: string, both = false): string | null {
  const merged = mergeSeq(splitBlocks(base), splitBlocks(local), splitBlocks(remote), (bc, lc, rc) => {
    // both sides touched this stretch: try again word by word before calling it a clash
    const fine = mergeSeq(splitTokens(bc.join('')), splitTokens(lc.join('')), splitTokens(rc.join('')), () => null);
    if (fine) {
      const html = fine.join('');
      if (balanced(html)) return [html];
    }
    return both ? [...rc, ...lc] : null;
  });
  return merged && merged.join('');
}

// ---- the merge -------------------------------------------------------------------------------------

// values that never need a person: the later time wins.
const LATEST_KEYS = new Set(['updatedAt', 'lastUpdated', 'modifiedAt']);
const TEXT_MIN = 80;

interface Ctx {
  conflicts: Conflict[];
  label: (path: Seg[]) => string;
  keepBoth: boolean;
}

function conflict(ctx: Ctx, path: Seg[], kind: Conflict['kind'], base: Json, local: Json, remote: Json): Json {
  ctx.conflicts.push({ key: pathKey(path), path, label: ctx.label(path), kind, local, remote, base });
  return local; // until someone chooses
}

function merge(ctx: Ctx, path: Seg[], base: Json, local: Json, remote: Json): Json {
  if (deepEqual(local, remote)) return local;
  if (deepEqual(base, local)) return remote;
  if (deepEqual(base, remote)) return local;

  const last = path[path.length - 1];
  if (typeof last === 'string' && LATEST_KEYS.has(last) && typeof local === 'string' && typeof remote === 'string') {
    return local > remote ? local : remote;
  }
  if (typeof local === 'string' && typeof remote === 'string' && (local.length >= TEXT_MIN || remote.length >= TEXT_MIN)) {
    const from = typeof base === 'string' ? base : '';
    const merged = mergeText(from, local, remote);
    if (merged !== null) return merged;
    if (ctx.keepBoth) {
      const both = mergeText(from, local, remote, true);
      if (both !== null) {
        ctx.conflicts.push({ key: pathKey(path), path, label: ctx.label(path), kind: 'text', base, local, remote, kept: 'both' });
        return both;
      }
    }
    return conflict(ctx, path, 'text', base, local, remote);
  }
  if (isObject(local) && isObject(remote)) {
    const b = isObject(base) ? base : {};
    const out: Record<string, Json> = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const k of keys) {
      const v = merge(ctx, [...path, k], b[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    if (hasIds(local) && hasIds(remote) && (b.length === 0 || hasIds(b))) return mergeById(ctx, path, b, local, remote);
    if ([...local, ...remote, ...b].every(x => typeof x !== 'object' || x === null)) return mergeSet(b, local, remote);
  }
  return conflict(ctx, path, 'value', base, local, remote);
}

// lists of plain values (tags, unlocked badges): what either side added stays, what either removed goes.
function mergeSet(base: Json[], local: Json[], remote: Json[]): Json[] {
  const removed = new Set([...base.filter(x => !local.includes(x)), ...base.filter(x => !remote.includes(x))]);
  const out = [...local.filter(x => !removed.has(x))];
  for (const x of remote) if (!out.includes(x) && !removed.has(x)) out.push(x);
  return out;
}

function mergeById(ctx: Ctx, path: Seg[], base: Json[], local: Json[], remote: Json[]): Json[] {
  const idOf = (x: Json) => (x as { id: string }).id;
  const byId = (a: Json[]) => new Map(a.map(x => [idOf(x), x]));
  const b = byId(base), l = byId(local), r = byId(remote);

  const order: string[] = local.map(idOf);
  // a new item from the other side goes after the item it followed there.
  remote.forEach((x, i) => {
    const id = idOf(x);
    if (order.includes(id)) return;
    let at = order.length;
    for (let p = i - 1; p >= 0; p--) {
      const at2 = order.indexOf(idOf(remote[p]));
      if (at2 >= 0) { at = at2 + 1; break; }
    }
    if (i === 0) at = 0;
    order.splice(at, 0, id);
  });

  const out: Json[] = [];
  for (const id of order) {
    const p = [...path, { id }];
    const bi = b.get(id), li = l.get(id), ri = r.get(id);
    if (li !== undefined && ri !== undefined) {
      out.push(merge(ctx, p, bi, li, ri));
    } else if (li !== undefined) {
      // gone on the other side: fine if we never touched it, a question if we did.
      if (bi === undefined) out.push(li);
      else if (deepEqual(bi, li)) continue;
      else out.push(conflict(ctx, p, 'removed', bi, li, undefined));
    } else if (ri !== undefined) {
      if (bi === undefined) out.push(ri);
      else if (deepEqual(bi, ri)) continue;
      else {
        // removed here, edited there: keep it out for now, and let the writer bring it back.
        conflict(ctx, p, 'removed', bi, undefined, ri);
      }
    }
  }
  return out;
}

export interface MergeOptions {
  // names a place for the conflict list.
  describe?: (path: Seg[], root: Json) => string;
  // where both sides rewrote the same text, keep both versions (and say so with `kept`) instead of leaving a question
  keepBoth?: boolean;
}

export function mergeProjects<T>(base: T | undefined, local: T, remote: T, options: MergeOptions = {}): MergeResult<T> {
  const ctx: Ctx = {
    conflicts: [],
    keepBoth: options.keepBoth === true,
    label: path => (options.describe ? options.describe(path, local) : defaultLabel(path)),
  };
  const value = merge(ctx, [], base, local, remote) as T;
  return { value, conflicts: ctx.conflicts };
}

const defaultLabel = (path: Seg[]) => path.map(s => (typeof s === 'string' ? s : s.id)).join(' › ');

// ---- answers ---------------------------------------------------------------------------------------

// 'both' only means something for text: the other side's paragraphs and then this side's. anywhere else it keeps this device's version.
export type Choice = 'local' | 'remote' | 'both';

function setAt(node: Json, path: Seg[], value: Json | typeof REMOVE): Json {
  if (path.length === 0) return value === REMOVE ? undefined : value;
  const [head, ...rest] = path;
  if (typeof head === 'string') {
    const obj = isObject(node) ? { ...node } : {};
    const next = setAt(obj[head], rest, value);
    if (next === undefined) delete obj[head]; else obj[head] = next;
    return obj;
  }
  const arr = Array.isArray(node) ? [...node] : [];
  const at = arr.findIndex(x => isObject(x) && x.id === head.id);
  if (rest.length === 0) {
    if (value === REMOVE) { if (at >= 0) arr.splice(at, 1); }
    else if (at >= 0) arr[at] = value; else arr.push(value);
    return arr;
  }
  if (at >= 0) arr[at] = setAt(arr[at], rest, value);
  return arr;
}
const REMOVE = Symbol('remove');

// puts the writer's answers into a merged project. unanswered conflicts keep this device's version.
export function applyChoices<T>(merged: T, conflicts: Conflict[], choices: Record<string, Choice>): T {
  let out: Json = merged;
  for (const c of conflicts) {
    // a clash the merge already settled by keeping both stays that way unless the writer says otherwise
    if (c.kept && !choices[c.key]) continue;
    const choice = choices[c.key] ?? 'local';
    const both = choice === 'both' && c.kind === 'text' && typeof c.local === 'string' && typeof c.remote === 'string'
      ? mergeText(typeof c.base === 'string' ? c.base : '', c.local, c.remote, true) : null;
    const picked = choice === 'remote' ? c.remote : both ?? c.local;
    out = setAt(out, c.path, picked === undefined ? REMOVE : picked);
  }
  return out as T;
}
