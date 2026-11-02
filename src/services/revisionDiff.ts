// word-level compare between two drafts of a manuscript

export interface DiffPart { kind: 'same' | 'added' | 'removed'; text: string }

export interface ChapterDiff {
  title: string;
  state: 'same' | 'changed' | 'added' | 'removed';
  parts: DiffPart[];
  added: number;
  removed: number;
}

interface Doc { id: string; title: string; content: string }

// html to plain text, keeping paragraph breaks as blank lines
export function plainText(html: string): string {
  return (html || '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// words and punctuation, each with the space after it, so the text can be rebuilt exactly
const tokens = (text: string) => text.match(/[\p{L}\p{N}'’-]+\s*|[^\p{L}\p{N}\s]+\s*/gu) ?? [];
const isWord = (t: string) => /[\p{L}\p{N}]/u.test(t);

const MAX_TOKENS = 4000;

// longest common subsequence over words; long chapters are trimmed to the changed middle first
export function diffWords(before: string, after: string): DiffPart[] {
  let a: string[] = tokens(before);
  let b: string[] = tokens(after);
  const norm = (t: string) => t.trim();

  let start = 0;
  while (start < a.length && start < b.length && norm(a[start]) === norm(b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && norm(a[endA - 1]) === norm(b[endB - 1])) { endA--; endB--; }

  const head = b.slice(0, start);
  const tail = b.slice(endB);
  a = a.slice(start, endA);
  b = b.slice(start, endB);

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], words: string[]) => {
    if (!words.length) return;
    const text = words.join('');
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };

  push('same', head);

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    // too large to align word by word: show the middle as one replacement
    push('removed', a);
    push('added', b);
  } else {
    const n = a.length;
    const m = b.length;
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] = norm(a[i]) === norm(b[j])
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (norm(a[i]) === norm(b[j])) { push('same', [b[j]]); i++; j++; }
      else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) { push('removed', [a[i]]); i++; }
      else { push('added', [b[j]]); j++; }
    }
    push('removed', a.slice(i));
    push('added', b.slice(j));
  }

  push('same', tail);
  return parts;
}

const wordsIn = (parts: DiffPart[], kind: DiffPart['kind']) =>
  parts.filter(p => p.kind === kind).reduce((sum, p) => sum + tokens(p.text).filter(isWord).length, 0);

// compare two chapter lists; chapters pair up by id, then by title
export function compareDrafts(older: Doc[], newer: Doc[]): ChapterDiff[] {
  const out: ChapterDiff[] = [];
  const used = new Set<number>();
  for (const now of newer) {
    let idx = older.findIndex((o, i) => !used.has(i) && o.id === now.id);
    if (idx < 0) idx = older.findIndex((o, i) => !used.has(i) && o.title === now.title);
    const text = plainText(now.content);
    if (idx < 0) {
      out.push({ title: now.title, state: 'added', parts: text ? [{ kind: 'added', text }] : [], added: tokens(text).filter(isWord).length, removed: 0 });
      continue;
    }
    used.add(idx);
    const parts = diffWords(plainText(older[idx].content), text);
    const added = wordsIn(parts, 'added');
    const removed = wordsIn(parts, 'removed');
    out.push({ title: now.title, state: added || removed ? 'changed' : 'same', parts, added, removed });
  }
  older.forEach((o, i) => {
    if (used.has(i)) return;
    const text = plainText(o.content);
    out.push({ title: o.title, state: 'removed', parts: text ? [{ kind: 'removed', text }] : [], added: 0, removed: tokens(text).filter(isWord).length });
  });
  return out;
}

export const totalChange = (diffs: ChapterDiff[]) => ({
  added: diffs.reduce((s, d) => s + d.added, 0),
  removed: diffs.reduce((s, d) => s + d.removed, 0),
  changedChapters: diffs.filter(d => d.state !== 'same').length,
});
