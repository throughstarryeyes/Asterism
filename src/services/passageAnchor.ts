import type { Chapter, PlotThread, ThreadPassage, TimelineEvent } from '../types';
import { htmlToPlainText } from './storyAnalyzer';
import { normalizeQuote } from './passageSearch';

// finds a stored quote again after edits: same words, then mostly the same words, else marked lost
// a little text on each side tells apart a line that appears twice

export interface PreparedChapter {
  id: string;
  // the chapter's text with runs of whitespace collapsed.
  text: string;
  // the same text lowercased with curly quotes flattened. same length, so positions line up.
  lower: string;
  sentences: Array<{ start: number; end: number; words: Set<string> }>;
}

export interface Anchor {
  chapterId: string;
  quote: string;
  before?: string;
  after?: string;
}

export interface Located {
  chapterId: string;
  // the passage as it reads now.
  text: string;
  before: string;
  after: string;
  how: 'exact' | 'edited';
  moved: boolean;
}

const CONTEXT = 40;
// how alike (0 to 1) reworded words must be to count as the same passage.
const SAME_PASSAGE = 0.6;
// under this, a quote is too short to trust to turn up in another chapter.
const MIN_TO_MOVE = 20;

const flatten = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
const wordsOf = (s: string) => new Set(flatten(s).toLowerCase().match(/[a-z0-9']+/g) ?? []);

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach(w => { if (b.has(w)) shared += 1; });
  return (2 * shared) / (a.size + b.size);
}

export function prepareChapters(chapters: Array<Pick<Chapter, 'id' | 'content'>>): PreparedChapter[] {
  return chapters.map(chapter => {
    const text = collapse(htmlToPlainText(chapter.content || ''));
    const sentences: PreparedChapter['sentences'] = [];
    for (const m of text.matchAll(/[^.!?…]+(?:[.!?…]+["”’')\]]*|$)\s*/g)) {
      const start = m.index ?? 0;
      const end = start + m[0].trimEnd().length;
      if (end > start) sentences.push({ start, end, words: wordsOf(text.slice(start, end)) });
    }
    return { id: chapter.id, text, lower: flatten(text).toLowerCase(), sentences };
  });
}

// how well the text either side of a candidate matches what was around the passage when it was linked.
function contextScore(chapter: PreparedChapter, start: number, end: number, anchor: Anchor): number {
  const before = flatten(anchor.before ?? '').toLowerCase().trim();
  const after = flatten(anchor.after ?? '').toLowerCase().trim();
  let score = 0;
  const nb = Math.min(before.length, 20);
  if (nb >= 4 && chapter.lower.slice(Math.max(0, start - CONTEXT), start).trimEnd().endsWith(before.slice(-nb))) score += 0.5;
  const na = Math.min(after.length, 20);
  if (na >= 4 && chapter.lower.slice(end, end + CONTEXT).trimStart().startsWith(after.slice(0, na))) score += 0.5;
  return score;
}

function located(chapter: PreparedChapter, start: number, end: number, how: Located['how'], anchor: Anchor): Located {
  return {
    chapterId: chapter.id,
    text: chapter.text.slice(start, end),
    before: chapter.text.slice(Math.max(0, start - CONTEXT), start),
    after: chapter.text.slice(end, end + CONTEXT),
    how,
    moved: chapter.id !== anchor.chapterId
  };
}

export function locatePassage(anchor: Anchor, chapters: PreparedChapter[]): Located | null {
  const needle = collapse(flatten(normalizeQuote(anchor.quote))).toLowerCase();
  if (!needle) return null;
  // the chapter it was in goes first, so a line that appears in two places stays where it was.
  const ordered = [...chapters].sort((a, b) => Number(b.id === anchor.chapterId) - Number(a.id === anchor.chapterId));

  // 1. the same words.
  let exact: { chapter: PreparedChapter; start: number; score: number } | null = null;
  for (const chapter of ordered) {
    const home = chapter.id === anchor.chapterId;
    if (!home && needle.length < MIN_TO_MOVE) continue;
    for (let at = chapter.lower.indexOf(needle); at >= 0; at = chapter.lower.indexOf(needle, at + 1)) {
      const score = (home ? 1 : 0) + contextScore(chapter, at, at + needle.length, anchor);
      if (!exact || score > exact.score) exact = { chapter, start: at, score };
    }
  }
  if (exact) return located(exact.chapter, exact.start, exact.start + needle.length, 'exact', anchor);

  // 2. mostly the same words: a sentence, or a few in a row, that was reworded.
  const quoteWords = wordsOf(needle);
  if (quoteWords.size < 4) return null;
  let best: { chapter: PreparedChapter; start: number; end: number; score: number } | null = null;
  for (const chapter of ordered) {
    const home = chapter.id === anchor.chapterId;
    const { sentences } = chapter;
    for (let i = 0; i < sentences.length; i++) {
      let words = sentences[i].words;
      for (let size = 1; size <= 3 && i + size <= sentences.length; size++) {
        if (size > 1) words = new Set([...words, ...sentences[i + size - 1].words]);
        const similarity = dice(quoteWords, words);
        if (similarity < SAME_PASSAGE) continue;
        const start = sentences[i].start;
        const end = sentences[i + size - 1].end;
        const score = similarity + 0.1 * contextScore(chapter, start, end, anchor) + (home ? 0.03 : 0);
        if (!best || score > best.score) best = { chapter, start, end, score };
      }
    }
  }
  return best ? located(best.chapter, best.start, best.end, 'edited', anchor) : null;
}

// whether two passages read the same once spacing and quote style are ignored.
const sameText = (a: string, b: string) => collapse(flatten(a)).toLowerCase() === collapse(flatten(b)).toLowerCase();

function reanchorPassage(passage: ThreadPassage, chapters: PreparedChapter[]): ThreadPassage {
  const found = locatePassage(passage, chapters);
  if (!found) return passage.lost ? passage : { ...passage, lost: true };
  const sameQuote = sameText(passage.quote, found.text) && passage.quote.trim() === found.text;
  if (sameQuote && passage.chapterId === found.chapterId && passage.before === found.before && passage.after === found.after && !passage.lost) return passage;
  const { lost: _lost, ...rest } = passage;
  return { ...rest, chapterId: found.chapterId, quote: found.text, before: found.before, after: found.after };
}

function reanchorThread(thread: PlotThread, chapters: PreparedChapter[]): PlotThread {
  let next = thread;

  if (thread.passageQuote?.trim()) {
    const found = locatePassage(
      { chapterId: thread.introducedInChapterId ?? '', quote: thread.passageQuote, before: thread.passageBefore, after: thread.passageAfter },
      chapters
    );
    if (found) {
      const changed =
        thread.passageQuote !== found.text ||
        thread.introducedInChapterId !== found.chapterId ||
        thread.passageBefore !== found.before ||
        thread.passageAfter !== found.after ||
        thread.originLost;
      if (changed) {
        const { originLost: _lost, ...rest } = next;
        next = { ...rest, passageQuote: found.text, introducedInChapterId: found.chapterId, passageBefore: found.before, passageAfter: found.after };
      }
    } else if (!thread.originLost) {
      next = { ...next, originLost: true };
    }
  }

  if (thread.passages?.length) {
    const passages = thread.passages.map(p => reanchorPassage(p, chapters));
    if (passages.some((p, i) => p !== thread.passages![i])) next = { ...next, passages };
  }
  return next;
}

/**
 * bring every thread's passages up to date with the manuscript. returns the same array when
 * nothing moved, so callers can tell whether anything needs saving.
 */
export function reanchorThreads(threads: PlotThread[], chapters: PreparedChapter[]): PlotThread[] {
  // no text at all means the manuscript has not loaded, not that every passage was deleted.
  if (!chapters.some(c => c.text)) return threads;
  const next = threads.map(t => reanchorThread(t, chapters));
  return next.some((t, i) => t !== threads[i]) ? next : threads;
}

/** the same for timeline events: follow the passage each one is told in. */
export function reanchorTimeline(events: TimelineEvent[], chapters: PreparedChapter[]): TimelineEvent[] {
  if (!chapters.some(c => c.text)) return events;
  const next = events.map(event => {
    if (!event.quote?.trim()) return event;
    const found = locatePassage({ chapterId: event.chapterId ?? '', quote: event.quote, before: event.before, after: event.after }, chapters);
    if (!found) return event.lost ? event : { ...event, lost: true };
    if (found.text === event.quote && found.chapterId === event.chapterId && found.before === event.before && found.after === event.after && !event.lost) return event;
    const { lost: _lost, ...rest } = event;
    return { ...rest, chapterId: found.chapterId, quote: found.text, before: found.before, after: found.after };
  });
  return next.some((e, i) => e !== events[i]) ? next : events;
}
