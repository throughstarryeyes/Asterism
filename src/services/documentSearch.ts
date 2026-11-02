import type { Chapter, Project } from '../types';

// finding documents by what is in them, and showing the first lines of one that has no synopsis
// no page needed: it works on the saved text

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–' };

const decode = (text: string) => text.replace(/&[a-z]+;|&#39;/gi, m => ENTITIES[m.toLowerCase()] ?? ' ');

// lines of plain text, one per paragraph or heading
function linesOf(html: string): string[] {
  return decode(
    (html || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>|<hr[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  ).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// ---- the first lines of a document ----------------------------------------

// the first sentences of the writing itself, skipping headings and short titles
export function previewOf(project: Pick<Project, 'chapters'>, maxChars = 200): string {
  for (const chapter of [...project.chapters].sort((a, b) => a.order - b.order)) {
    // only the start is needed, so a long manuscript is not read whole
    const lines = linesOf((chapter.content || '').slice(0, 6000)).filter(l => l.length >= 30 || /[.!?…”"]$/.test(l));
    const text = lines.join(' ');
    if (!text) continue;
    const sentences = text.match(/[^.!?…]+(?:[.!?…]+["”’']?|$)/g) ?? [text];
    let out = '';
    for (const s of sentences) {
      if (out && (out + s).length > maxChars) break;
      out += `${out ? ' ' : ''}${s.trim()}`;
      if (out.length >= maxChars * 0.6) break;
    }
    return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
  }
  return '';
}

// ---- searching ------------------------------------------------------------

// the plain text of each document, made once per version of its text
const textCache = new WeakMap<Chapter[], string>();

function bodyText(project: Pick<Project, 'chapters'>): string {
  let text = textCache.get(project.chapters);
  if (text === undefined) {
    text = project.chapters.map(c => `${c.title}\n${linesOf(c.content).join('\n')}`).join('\n');
    textCache.set(project.chapters, text);
  }
  return text;
}

export interface Query { phrases: string[]; words: string[] }

// "quoted words" must appear together; the rest must each appear somewhere
export function parseQuery(raw: string): Query {
  const phrases: string[] = [];
  const rest = raw.replace(/"([^"]+)"|“([^”]+)”/g, (_, a, b) => { phrases.push((a ?? b).trim().toLowerCase()); return ' '; });
  return { phrases: phrases.filter(Boolean), words: rest.toLowerCase().split(/\s+/).filter(Boolean) };
}

export const termsOf = (q: Query) => [...q.phrases, ...q.words];

export interface Snippet { text: string; hit: boolean }
export interface SearchHit {
  // how many times the terms appear in the writing
  count: number;
  // short passages around the first matches, split so the matching words can be marked
  snippets: Snippet[][];
  // the terms were found only in the title, author, tags, folder or names, not in the text
  inDetailsOnly: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function windowAround(text: string, at: number, length: number, terms: string[]): Snippet[] {
  let start = Math.max(0, at - 55);
  let end = Math.min(text.length, at + length + 75);
  // do not begin or end in the middle of a word
  if (start > 0) { const space = text.indexOf(' ', start); if (space > -1 && space < at) start = space + 1; }
  if (end < text.length) { const space = text.lastIndexOf(' ', end); if (space > at + length) end = space; }
  const piece = `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  return piece.split(re).filter(Boolean).map(part => ({ text: part, hit: terms.some(t => t === part.toLowerCase()) }));
}

export function searchProject(project: Project, query: Query, maxSnippets = 2): SearchHit | null {
  const terms = termsOf(query);
  if (terms.length === 0) return null;

  const text = bodyText(project);
  const lower = text.toLowerCase();
  const details = [project.title, project.author, project.genre, ...(project.tags ?? []), project.folder, project.synopsis,
    ...(project.storyBible?.characters ?? []).flatMap(c => [c.name, ...(c.aliases ?? [])]),
    ...(project.storyBible?.locations ?? []).map(l => l.name),
    ...(project.storyBible?.lore ?? []).map(l => l.title),
  ].filter(Boolean).join('\n').toLowerCase();

  // every word and every phrase has to be in this document, in the writing or in the details
  const everywhere = `${lower}\n${details}`;
  if (!terms.every(t => everywhere.includes(t))) return null;

  const inText = terms.filter(t => lower.includes(t));
  if (inText.length === 0) return { count: 0, snippets: [], inDetailsOnly: true };

  let count = 0;
  const found: Array<{ at: number; length: number }> = [];
  for (const t of inText) {
    let from = 0;
    for (let i = lower.indexOf(t, from); i !== -1; i = lower.indexOf(t, from)) {
      count++;
      if (found.length < 40) found.push({ at: i, length: t.length });
      from = i + t.length;
    }
  }

  // the earliest matches, with no two close enough to show the same passage twice
  found.sort((a, b) => a.at - b.at);
  const picked: typeof found = [];
  for (const f of found) if (picked.every(p => Math.abs(p.at - f.at) > 160)) picked.push(f);
  return {
    count,
    snippets: picked.slice(0, maxSnippets).map(f => windowAround(text, f.at, f.length, inText)),
    inDetailsOnly: false,
  };
}

// matching documents, those with the most in the writing first
export function searchProjects(projects: Project[], raw: string): Map<string, SearchHit> {
  const query = parseQuery(raw);
  const hits = new Map<string, SearchHit>();
  if (termsOf(query).length === 0) return hits;
  for (const p of projects) {
    const hit = searchProject(p, query);
    if (hit) hits.set(p.id, hit);
  }
  return hits;
}
