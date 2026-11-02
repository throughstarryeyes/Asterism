import type { PlotThread, Project, ThreadExpectation, ThreadPassage, ThreadType } from '../types';
import type { CoachUnit, EntityIndex } from './coach/entities';
import { findRelatedPassages, type LoopKind, type OpenLoop, type RelatedPassage } from './openLoops';
import { applyLoopHandled } from './storyMemory';

// plot threads: an open loop the writer tracks, with the passages that really follow it
// the tracker only suggests passages; the writer confirms or rejects them

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// two places in the manuscript count as the same when the chapter and the words match.
export const linkKey = (chapterId: string, quote: string) => `${chapterId}|${plain(quote)}`;

const isSettled = (status: PlotThread['status']) => status === 'resolved' || status === 'intentionally_open';

// ---- starting a thread from a loop ------------------------------------------------------

const TYPE_FOR_LOOP: Record<LoopKind, ThreadType> = {
  question: 'unanswered_question',
  promise: 'promise',
  secret: 'secret',
  warning: 'foreshadowing',
  object: 'foreshadowing'
};

// what a reader would expect from each kind of loop. a starting point the writer can edit.
const STARTER_EXPECTATION: Record<LoopKind, string> = {
  question: 'The question is answered, or left open on purpose',
  promise: 'The promise is kept or broken on the page',
  secret: 'The secret comes out, or its absence is felt',
  warning: 'The warning pays off or is proven wrong',
  object: 'The object matters again'
};

const shorten = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

function titleForLoop(loop: OpenLoop): string {
  if (loop.kind === 'object') {
    const item = loop.item ?? 'object';
    return `The ${item}`;
  }
  const quoted = loop.sentence.match(/[“"]([^”"]+)[”"]/)?.[1] ?? loop.sentence;
  return shorten(quoted, 60);
}

export function threadFromLoop(loop: OpenLoop, now = new Date().toISOString()): PlotThread {
  return {
    id: `thread-${loop.id}`,
    title: titleForLoop(loop),
    type: TYPE_FOR_LOOP[loop.kind],
    status: 'introduced',
    introducedInChapterId: loop.chapterId,
    notes: '',
    passageQuote: loop.sentence,
    importance: loop.kind === 'object' || loop.kind === 'warning' ? 'subtle' : 'major',
    loopId: loop.id,
    passages: [],
    expectations: [{ id: newId('exp'), text: STARTER_EXPECTATION[loop.kind], status: 'open' }],
    rejectedLinks: [],
    createdAt: now,
    updatedAt: now
  };
}

// track a loop as a thread. tracking the same loop twice does nothing the second time.
export function trackLoop(project: Project, loop: OpenLoop): { project: Project; thread: PlotThread; created: boolean } {
  const existing = project.plotThreads.find(t => t.loopId === loop.id);
  if (existing) return { project, thread: existing, created: false };

  const thread = threadFromLoop(loop);
  return {
    thread,
    created: true,
    project: {
      ...project,
      plotThreads: [...project.plotThreads, thread],
      findings: (project.findings || []).map(f => (f.loopId === loop.id ? { ...f, linkedThreadId: thread.id } : f))
    }
  };
}

// ---- saving and removing ----------------------------------------------------------------

// save a thread. settling it (resolved, or intentionally open) also settles its loop for the
// analyzer and the coach; reopening it brings the loop back.
export function saveThread(project: Project, thread: PlotThread): Project {
  const previous = project.plotThreads.find(t => t.id === thread.id);
  const plotThreads = previous ? project.plotThreads.map(t => (t.id === thread.id ? thread : t)) : [...project.plotThreads, thread];
  let next: Project = { ...project, plotThreads };

  if (thread.loopId) {
    next = { ...next, findings: (next.findings || []).map(f => (f.loopId === thread.loopId ? { ...f, linkedThreadId: thread.id } : f)) };
    const wasSettled = !!previous && isSettled(previous.status);
    if (isSettled(thread.status) && !wasSettled) next = applyLoopHandled(next, thread.loopId, true);
    else if (!isSettled(thread.status) && wasSettled) next = applyLoopHandled(next, thread.loopId, false);
  }
  return next;
}

export function removeThread(project: Project, threadId: string): Project {
  return {
    ...project,
    plotThreads: project.plotThreads.filter(t => t.id !== threadId),
    findings: (project.findings || []).map(f => {
      if (f.linkedThreadId !== threadId) return f;
      const { linkedThreadId: _gone, ...rest } = f;
      return rest;
    })
  };
}

// ---- editing a thread -------------------------------------------------------------------

const touch = (thread: PlotThread, patch: Partial<PlotThread>): PlotThread => ({ ...thread, ...patch, updatedAt: new Date().toISOString() });

export function linkPassage(thread: PlotThread, passage: Omit<ThreadPassage, 'id'>): PlotThread {
  const key = linkKey(passage.chapterId, passage.quote);
  const passages = thread.passages ?? [];
  if (passages.some(p => linkKey(p.chapterId, p.quote) === key)) return thread;
  return touch(thread, {
    passages: [...passages, { ...passage, id: newId('tp') }],
    // a passage the writer confirmed is no longer a suggestion, and a rejected one that they
    // later link by hand is no longer rejected.
    rejectedLinks: (thread.rejectedLinks ?? []).filter(k => k !== key)
  });
}

export function unlinkPassage(thread: PlotThread, passageId: string): PlotThread {
  return touch(thread, { passages: (thread.passages ?? []).filter(p => p.id !== passageId) });
}

// point a link whose passage went missing at new text. it keeps its role and note.
export function relinkPassage(thread: PlotThread, passageId: string, chapterId: string, quote: string): PlotThread {
  return touch(thread, {
    passages: (thread.passages ?? []).map(p => {
      if (p.id !== passageId) return p;
      const { lost: _lost, before: _before, after: _after, ...rest } = p;
      return { ...rest, chapterId, quote };
    })
  });
}

export function rejectLink(thread: PlotThread, chapterId: string, quote: string): PlotThread {
  const key = linkKey(chapterId, quote);
  const rejected = thread.rejectedLinks ?? [];
  return rejected.includes(key) ? thread : touch(thread, { rejectedLinks: [...rejected, key] });
}

export function addExpectation(thread: PlotThread, text: string): PlotThread {
  const clean = text.trim();
  if (!clean) return thread;
  return touch(thread, { expectations: [...(thread.expectations ?? []), { id: newId('exp'), text: clean, status: 'open' }] });
}

export function setExpectationStatus(thread: PlotThread, expectationId: string, status: ThreadExpectation['status']): PlotThread {
  return touch(thread, { expectations: (thread.expectations ?? []).map(e => (e.id === expectationId ? { ...e, status } : e)) });
}

export function removeExpectation(thread: PlotThread, expectationId: string): PlotThread {
  return touch(thread, { expectations: (thread.expectations ?? []).filter(e => e.id !== expectationId) });
}

export function threadProgress(thread: PlotThread) {
  const expectations = thread.expectations ?? [];
  return {
    passages: (thread.passages ?? []).length,
    expectations: expectations.length,
    fulfilled: expectations.filter(e => e.status === 'fulfilled').length,
    open: expectations.filter(e => e.status === 'open').length
  };
}

// ---- suggestions ------------------------------------------------------------------------

// the scene the thread starts in, so suggestions only look at what comes after.
function originUnit(thread: PlotThread, units: CoachUnit[]): number {
  const here = units.filter(u => u.chapterId === thread.introducedInChapterId);
  const quote = plain(thread.passageQuote ?? '');
  const exact = quote ? here.find(u => plain(u.plainText).includes(quote.slice(0, 60))) : undefined;
  return (exact ?? here[0])?.index ?? -1;
}

const takenLinks = (thread: PlotThread) =>
  new Set([...(thread.passages ?? []).map(p => linkKey(p.chapterId, p.quote)), ...(thread.rejectedLinks ?? [])]);

// later passages that seem to pick the thread back up, minus the ones the writer has already
// linked or turned down. suggestions only: nothing here is treated as proof.
export function suggestFollowUps(thread: PlotThread, units: CoachUnit[], index: EntityIndex, limit = 6): RelatedPassage[] {
  const text = thread.passageQuote?.trim() || `${thread.title} ${thread.notes}`;
  const minHits = thread.type === 'unanswered_question' || thread.type === 'mystery' ? 2 : 1;
  const taken = takenLinks(thread);
  return findRelatedPassages(units, index, text, originUnit(thread, units), { minHits, limit: limit + taken.size })
    .filter(r => !taken.has(linkKey(r.chapterId, r.sentence)))
    .slice(0, limit);
}

// passages that might deliver one particular expectation ("Mara opens the box").
export function suggestForExpectation(thread: PlotThread, expectation: ThreadExpectation, units: CoachUnit[], index: EntityIndex, limit = 2): RelatedPassage[] {
  const taken = takenLinks(thread);
  return findRelatedPassages(units, index, expectation.text, originUnit(thread, units), { minHits: 2, limit: limit + taken.size })
    .filter(r => !taken.has(linkKey(r.chapterId, r.sentence)))
    .slice(0, limit);
}
