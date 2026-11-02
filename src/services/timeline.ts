import type { AnalysisFinding, Chapter, Project, TimelineEvent } from '../types';
import { splitSentences, type CoachUnit } from './coach/entities';
import { shortHash } from './openLoops';
import { normalizeQuote } from './passageSearch';
import { prepareChapters } from './passageAnchor';
import {
  describeResolved, describeSpec, findTimeExpressions, readTime, resolveSpec, weekdayOf, MONTHS, WEEKDAYS,
  type CueKind, type Resolved, type TimeSpec
} from './timeExpressions';

export { dayNumber } from './timeExpressions';
export type { CueKind } from './timeExpressions';

// the story timeline: list order is story order, page order comes from each event's linked passage
// what can be placed on a calendar is checked; checks are questions, never verdicts

// ---- time cues in the prose ---------------------------------------------------------------

export interface TimeCue {
  id: string;
  kind: CueKind;
  // the words as written ("three days later").
  text: string;
  spec: TimeSpec;
  // what the words say, before they are placed.
  label: string;
  sentence: string;
  chapterId: string;
  unitIndex: number;
  unitTitle: string;
}

export function detectTimeCues(units: CoachUnit[]): TimeCue[] {
  const cues: TimeCue[] = [];
  units.forEach(unit => {
    splitSentences(unit.plainText).forEach(sentence => {
      findTimeExpressions(sentence).forEach(e => {
        cues.push({
          id: `cue-${unit.index}-${shortHash(sentence + e.text)}`,
          kind: e.kind,
          text: e.text,
          spec: e.spec,
          label: describeSpec(e.spec),
          sentence,
          chapterId: unit.chapterId,
          unitIndex: unit.index,
          unitTitle: unit.title
        });
      });
    });
  });
  return cues;
}

// ---- placing the events on a calendar -----------------------------------------------------

export interface Reading {
  event: TimelineEvent;
  // what the event's "when" says, if it names a time at all.
  spec: TimeSpec | null;
  resolved: Resolved | null;
  // the event a relative time was counted from.
  from?: TimelineEvent;
}

const specOf = (event: TimelineEvent): TimeSpec | null =>
  readTime(event.when)?.spec ?? readTime(event.date)?.spec ?? null;

// place every event on the calendar in story order; relative times count from their event, or the one before
// words-only times stay unplaced, and so does anything counted from them
export function readTimeline(events: TimelineEvent[]): Reading[] {
  const placed = new Map<string, Resolved | null>();
  let context: Resolved | null = null;
  let previous: { event: TimelineEvent; resolved: Resolved | null } | null = null;
  return events.map(event => {
    const spec = specOf(event);
    let from: TimelineEvent | undefined = previous?.event;
    let ref: Resolved | null = previous?.resolved ?? null;
    if (event.relativeTo) {
      from = events.find(e => e.id === event.relativeTo);
      ref = placed.get(event.relativeTo) ?? null;
    }
    const resolved = spec ? resolveSpec(spec, context, ref) : null;
    placed.set(event.id, resolved);
    if (resolved) context = resolved;
    previous = { event, resolved };
    return { event, spec, resolved, from };
  });
}

/** how an event's time reads, for showing back to the writer. null when it is only in words. */
export function describeReading(reading: Reading): { label: string; note?: string } | null {
  const { resolved, spec, from } = reading;
  if (!resolved || !spec) return null;
  const label = describeResolved(resolved);
  if (resolved.basis === 'counted') return { label, note: from ? `counted from “${from.title}”` : undefined };
  if (resolved.basis === 'assumed') return { label, note: resolved.rolled ? 'no year given; taken as the year after the one before' : 'no year given' };
  return { label };
}

// ---- where each event is told ---------------------------------------------------------------

/**
 * a number per event for its place on the page: later in the book is higher. null when the
 * event is not linked to a passage.
 */
export function pagePositions(events: TimelineEvent[], chapters: Array<Pick<Chapter, 'id' | 'content' | 'order'>>): Array<number | null> {
  const ordered = [...chapters].sort((a, b) => a.order - b.order);
  const prepared = prepareChapters(ordered);
  return events.map(event => {
    const rank = ordered.findIndex(c => c.id === event.chapterId);
    if (rank < 0) return null;
    const needle = normalizeQuote(event.quote ?? '').toLowerCase().slice(0, 60);
    const at = needle ? prepared[rank].lower.replace(/\s+/g, ' ').indexOf(needle) : -1;
    return rank * 10_000_000 + Math.max(0, at);
  });
}

export type Telling = 'flashback' | 'flash-forward';

// events told out of story order: flashback = told after something later, flash-forward = told before something earlier
// events that keep page and story order in step are left alone
export function outOfOrder(positions: Array<number | null>): Map<number, Telling> {
  const told = positions.map((pos, i) => ({ pos, i })).filter((x): x is { pos: number; i: number } => x.pos !== null);
  // longest run of events whose page order matches their story order.
  const best: number[] = told.map(() => 1);
  const from: number[] = told.map(() => -1);
  for (let a = 0; a < told.length; a++) {
    for (let b = 0; b < a; b++) {
      if (told[b].pos <= told[a].pos && best[b] + 1 > best[a]) { best[a] = best[b] + 1; from[a] = b; }
    }
  }
  let end = best.reduce((top, len, i) => (len > best[top] ? i : top), 0);
  const inStep = new Set<number>();
  while (end >= 0 && told.length) { inStep.add(end); end = from[end]; }

  const marks = new Map<number, Telling>();
  told.forEach((e, k) => {
    if (inStep.has(k)) return;
    const toldAfterLater = told.some((o, j) => inStep.has(j) && o.i > e.i && o.pos < e.pos);
    marks.set(e.i, toldAfterLater ? 'flashback' : 'flash-forward');
  });
  return marks;
}

// ---- editing the list ----------------------------------------------------------------------

const newId = () => `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function newEvent(fields: Partial<TimelineEvent> & { title: string }): TimelineEvent {
  return {
    id: newId(),
    ...fields,
    title: fields.title.trim(),
    characters: (fields.characters ?? []).map(c => c.trim()).filter(Boolean),
    createdAt: new Date().toISOString()
  };
}

/** add an event where its passage falls among the others on the page; the writer can move it. */
export function addEvent(events: TimelineEvent[], event: TimelineEvent, chapters: Array<Pick<Chapter, 'id' | 'content' | 'order'>>): TimelineEvent[] {
  const positions = pagePositions([...events, event], chapters);
  const mine = positions[positions.length - 1];
  if (mine === null) return [...events, event];
  const at = positions.slice(0, -1).findIndex(p => p !== null && p > mine);
  return at < 0 ? [...events, event] : [...events.slice(0, at), event, ...events.slice(at)];
}

export const saveEvent = (events: TimelineEvent[], event: TimelineEvent): TimelineEvent[] =>
  events.map(e => (e.id === event.id ? event : e));

// events counting from a removed one go back to counting from the event above them.
export const removeEvent = (events: TimelineEvent[], id: string): TimelineEvent[] =>
  events.filter(e => e.id !== id).map(e => (e.relativeTo === id ? { ...e, relativeTo: undefined } : e));

export function moveEvent(events: TimelineEvent[], id: string, by: -1 | 1): TimelineEvent[] {
  const from = events.findIndex(e => e.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= events.length) return events;
  const next = [...events];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// ---- checks ---------------------------------------------------------------------------------

export interface TimelineIssue {
  id: string;
  kind: 'date-order' | 'year-rolled' | 'elapsed' | 'weekday' | 'lost';
  title: string;
  message: string;
  eventIds: string[];
}

const showDays = (n: number) => `${Math.round(n * 10) / 10} day${Math.round(n * 10) / 10 === 1 ? '' : 's'}`;
const quoted = (e: TimelineEvent) => `“${e.title}”`;

export function checkTimeline(events: TimelineEvent[]): TimelineIssue[] {
  const issues: TimelineIssue[] = [];
  const readings = readTimeline(events);
  const placed = readings.filter((r): r is Reading & { resolved: Resolved } => r.resolved !== null);

  placed.forEach((later, k) => {
    const earlier = placed[k - 1];
    const { event, resolved } = later;

    // told in story order, so each should not end before the one above it starts.
    if (earlier && resolved.end < earlier.resolved.start) {
      issues.push({
        id: `date-order:${earlier.event.id}:${event.id}`,
        kind: 'date-order',
        title: `${quoted(event)} comes out of date order`,
        eventIds: [earlier.event.id, event.id],
        message: `${quoted(event)} is placed ${describeResolved(resolved)}, but it comes after ${quoted(earlier.event)} (${describeResolved(earlier.resolved)}) in your timeline. Is the order or one of the times off?`
      });
    }

    if (resolved.rolled && resolved.basis === 'assumed') {
      issues.push({
        id: `year-rolled:${event.id}`,
        kind: 'year-rolled',
        title: `${quoted(event)}: which year?`,
        eventIds: [event.id],
        message: `${quoted(event)} gives no year, and it would fall before the event above it, so I took it as the following year (${describeResolved(resolved)}). Right? Adding the year settles it.`
      });
    }

    // "Three days later" against the time of the event it counts from. it might count from something else, so ask.
    if (resolved.basis !== 'counted') {
      const claim = findTimeExpressions(event.quote ?? '').find(e => e.spec.kind === 'offset' && Math.abs(e.spec.days ?? 0) >= 1);
      const source = event.relativeTo ? readings.find(r => r.event.id === event.relativeTo) : readings[readings.indexOf(later) - 1];
      const ref = source?.resolved;
      if (claim && ref && claim.spec.days !== undefined) {
        const days = claim.spec.days;
        const least = resolved.start - ref.end;
        const most = resolved.end - ref.start;
        const tolerance = Math.max(claim.spec.slack ?? 0, Math.ceil(Math.abs(days) * 0.3), 1);
        if (days < least - tolerance || days > most + tolerance) {
          const gap = least === most ? showDays(Math.abs(least)) : `${showDays(Math.abs(least))} to ${showDays(Math.abs(most))}`;
          issues.push({
            id: `elapsed:${event.id}:${shortHash(claim.text)}`,
            kind: 'elapsed',
            title: `${quoted(event)}: “${claim.text}” doesn’t fit the dates`,
            eventIds: source ? [source.event.id, event.id] : [event.id],
            message: `${quoted(event)} says “${claim.text}”, but its time is ${gap} ${least >= 0 ? 'after' : 'before'}${source ? ` ${quoted(source.event)}` : ' the event before it'}. Is the wording or a date off, or does it count from something else?`
          });
        }
      }
    }

    // "Tuesday, March 14th, 2017": does that date fall on a Tuesday?
    const { spec } = later;
    if (spec?.kind === 'abs' && spec.weekday !== undefined && spec.year !== undefined && resolved.start === resolved.end && weekdayOf(resolved.start) !== spec.weekday) {
      issues.push({
        id: `weekday:${event.id}`,
        kind: 'weekday',
        title: `${quoted(event)}: weekday doesn’t match the date`,
        eventIds: [event.id],
        message: `${quoted(event)} says ${WEEKDAYS[spec.weekday]}, but ${MONTHS[(spec.month ?? 1) - 1]} ${spec.day}, ${spec.year} falls on a ${WEEKDAYS[weekdayOf(resolved.start)]}. (If your story keeps its own calendar, ignore this.)`
      });
    }
  });

  events.filter(e => e.lost).forEach(e => {
    issues.push({ id: `lost:${e.id}`, kind: 'lost', title: `${quoted(e)}: can’t find where it’s told`, eventIds: [e.id], message: `I can’t find where ${quoted(e)} is told any more. It may have been cut or rewritten.` });
  });
  return issues;
}

// ---- one place for findings -------------------------------------------------------------------

export const isTimelineFinding = (f: Pick<AnalysisFinding, 'id'>) => f.id.startsWith('finding-timeline-');

/**
 * the timeline's checks as analyzer findings, so they live with every other finding and are
 * answered the same way. a finding the writer already answered keeps its answer.
 */
export function timelineFindings(
  events: TimelineEvent[],
  chapters: Array<Pick<Chapter, 'id' | 'title'>>,
  previous: AnalysisFinding[]
): AnalysisFinding[] {
  const earlier = new Map(previous.map(f => [f.id, f]));
  return checkTimeline(events).map(issue => {
    const id = `finding-timeline-${shortHash(issue.id)}`;
    const before = earlier.get(id);
    const answered = before && before.status !== 'unreviewed' ? before : undefined;
    return {
      id,
      category: 'continuity' as const,
      title: `Timeline: ${issue.title}`,
      summary: issue.message,
      evidencePassages: issue.eventIds
        .map(eventId => events.find(e => e.id === eventId))
        .filter((e): e is TimelineEvent => !!e && !!e.quote && !!e.chapterId)
        .map(e => ({ chapterId: e.chapterId!, chapterTitle: chapters.find(c => c.id === e.chapterId)?.title ?? '', quote: e.quote! })),
      confidence: issue.kind === 'lost' || issue.kind === 'date-order' ? ('definite' as const) : ('probable' as const),
      status: answered ? answered.status : ('unreviewed' as const),
      ...(answered?.authorExplanation ? { authorExplanation: answered.authorExplanation } : {})
    };
  });
}

/** bring the timeline findings in a project up to date. returns the same project if nothing changed. */
export function syncTimelineFindings(project: Project): Project {
  const current = project.findings || [];
  const fresh = timelineFindings(project.timeline ?? [], project.chapters, current);
  const old = current.filter(isTimelineFinding);
  const same = old.length === fresh.length && old.every((f, i) => f.id === fresh[i].id && f.summary === fresh[i].summary && f.status === fresh[i].status);
  return same ? project : { ...project, findings: [...current.filter(f => !isTimelineFinding(f)), ...fresh] };
}
