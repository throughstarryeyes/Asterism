import { describe, it, expect } from 'vitest';
import {
  addEvent, checkTimeline, describeReading, detectTimeCues, isTimelineFinding, moveEvent, newEvent, outOfOrder, pagePositions, readTimeline,
  removeEvent, syncTimelineFindings, timelineFindings
} from '../timeline';
import { prepareChapters, reanchorTimeline } from '../passageAnchor';
import type { CoachUnit } from '../coach/entities';
import type { Project, TimelineEvent } from '../../types';

const unit = (text: string, index = 0): CoachUnit => ({ id: `u${index}`, index, title: `Scene ${index + 1}`, chapterId: `c${index}`, plainText: text });
const cues = (text: string) => detectTimeCues([unit(text)]);
const chapter = (i: number, text: string) => ({ id: `c${i}`, order: i + 1, content: `<p>${text}</p>` });
const event = (title: string, patch: Partial<TimelineEvent> = {}): TimelineEvent => ({ id: title, title, createdAt: '', ...patch });
const labels = (events: TimelineEvent[]) => readTimeline(events).map(r => describeReading(r)?.label ?? null);

describe('time cues in the prose', () => {
  it('finds dates, parts of months, weekdays and elapsed time, and says what each means', () => {
    expect(cues('On March 3rd, 1923, the ship sailed.')[0]).toMatchObject({ kind: 'date', text: 'March 3rd, 1923' });
    expect(cues('It was 3/14/17 when they met.')[0]).toMatchObject({ kind: 'date', text: '3/14/17' });
    expect(cues('By the second week of March she knew.')[0]).toMatchObject({ kind: 'date', label: 'second week of March (no year given)' });
    expect(cues('They met again the Tuesday after.')[0]).toMatchObject({ kind: 'weekday', text: 'the Tuesday after' });
    expect(cues('Three days later, Dana came back.')[0]).toMatchObject({ kind: 'elapsed', text: 'Three days later' });
    expect(cues('The next morning the house was empty.')[0]).toMatchObject({ kind: 'sequence' });
    expect(cues('That winter the river froze.')[0]).toMatchObject({ kind: 'season' });
  });

  it('leaves ordinary words alone', () => {
    expect(cues('I may go, and the march of days went on without a plan.')).toEqual([]);
    expect(cues('The days were long and the nights were longer.')).toEqual([]);
  });
});

describe('placing events on a calendar', () => {
  it('reads dates written however the writer likes, in order', () => {
    expect(labels([event('a', { when: '3/14/17' }), event('b', { when: 'march 20th, 2017' })])).toEqual(['Tue, Mar 14, 2017', 'Mon, Mar 20, 2017']);
  });

  it('counts "the Tuesday after" from the event above it', () => {
    const events = [event('funeral', { when: 'Thursday, March 16th, 2017' }), event('meeting', { when: 'the Tuesday after' })];
    expect(labels(events)).toEqual(['Thu, Mar 16, 2017', 'Tue, Mar 21, 2017']);
    expect(describeReading(readTimeline(events)[1])?.note).toBe('counted from “funeral”');
  });

  it('counts from a chosen event instead', () => {
    const events = [event('a', { when: 'March 1st, 2017' }), event('b', { when: 'March 20th, 2017' }), event('c', { when: 'three days later', relativeTo: 'a' })];
    expect(labels(events)[2]).toBe('Sat, Mar 4, 2017');
  });

  it('chains relative times, and guesses a missing year from the story so far', () => {
    const events = [event('a', { when: 'June 2nd, 2017' }), event('b', { when: 'the next morning' }), event('c', { when: 'a week later' }), event('d', { when: 'June 20th' })];
    expect(labels(events)).toEqual(['Fri, Jun 2, 2017', 'Sat, Jun 3, 2017', 'Sat, Jun 10, 2017', 'Jun 20']);
    expect(describeReading(readTimeline(events)[3])?.note).toBe('no year given');
  });

  it('keeps events described only in words, and does not count from them', () => {
    const events = [event('storm', { when: 'the night of the storm' }), event('after', { when: 'three days later' }), event('dated', { when: 'March 5th, 2017' })];
    expect(labels(events)).toEqual([null, null, 'Sun, Mar 5, 2017']);
    expect(describeReading(readTimeline(events)[0])).toBeNull();
  });

  it('still honors a date entered the old way', () => {
    expect(labels([event('old', { date: '1923-04-01' })])).toEqual(['Sun, Apr 1, 1923']);
  });
});

describe('where an event is told', () => {
  const chapters = [chapter(0, 'The story opens in the harbor.'), chapter(1, 'Years before, a fire took the mill. Then the storm came.')];

  it('puts events in page order by chapter, then by place in the chapter', () => {
    const events = [
      event('storm', { chapterId: 'c1', quote: 'Then the storm came.' }),
      event('fire', { chapterId: 'c1', quote: 'a fire took the mill' }),
      event('none')
    ];
    const [storm, fire, none] = pagePositions(events, chapters);
    expect(fire!).toBeLessThan(storm!);
    expect(none).toBeNull();
  });

  it('marks a flashback as itself, not everything it jumps over', () => {
    // story order: a B C D. told: b C A D, so A is the flashback.
    expect([...outOfOrder([3, 1, 2, 4]).entries()]).toEqual([[0, 'flashback']]);
  });

  it('marks an event told early as a flash-forward', () => {
    // story order: a B C D. told: d A B C, so D is told early.
    expect([...outOfOrder([2, 3, 4, 1]).entries()]).toEqual([[3, 'flash-forward']]);
  });

  it('marks nothing when the book is told in order, and ignores unlinked events', () => {
    expect(outOfOrder([1, null, 2, 3]).size).toBe(0);
    expect(outOfOrder([]).size).toBe(0);
  });

  it('adds a new event where its passage falls among the others', () => {
    const events = [event('first', { chapterId: 'c0', quote: 'story opens' }), event('last', { chapterId: 'c1', quote: 'storm came' })];
    const added = addEvent(events, event('middle', { chapterId: 'c1', quote: 'a fire took the mill' }), chapters);
    expect(added.map(e => e.title)).toEqual(['first', 'middle', 'last']);
    expect(addEvent(events, event('loose'), chapters).map(e => e.title)).toEqual(['first', 'last', 'loose']);
  });
});

describe('editing the list', () => {
  it('moves events and stops at the ends', () => {
    const list = [event('a'), event('b'), event('c')];
    expect(moveEvent(list, 'b', -1).map(e => e.title)).toEqual(['b', 'a', 'c']);
    expect(moveEvent(list, 'a', -1)).toBe(list);
    expect(moveEvent(list, 'c', 1)).toBe(list);
    expect(removeEvent(list, 'b').map(e => e.title)).toEqual(['a', 'c']);
  });

  it('lets events that counted from a removed one count from the one above instead', () => {
    const list = [event('a'), event('b'), event('c', { relativeTo: 'b' })];
    expect(removeEvent(list, 'b')[1].relativeTo).toBeUndefined();
  });

  it('tidies the fields of a new event', () => {
    const made = newEvent({ title: '  The fire ', characters: [' Mara ', ''] });
    expect(made.title).toBe('The fire');
    expect(made.characters).toEqual(['Mara']);
  });
});

describe('checks', () => {
  it('asks when times run backwards along the story order', () => {
    const issues = checkTimeline([event('fire', { when: 'May 2nd, 1923' }), event('storm', { when: 'April 1st, 1923' })]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'date-order', eventIds: ['fire', 'storm'] });
  });

  it('asks when a relative time runs backwards too', () => {
    const issues = checkTimeline([event('a', { when: 'March 10th, 2017' }), event('b', { when: 'three days earlier' })]);
    expect(issues.map(i => i.kind)).toEqual(['date-order']);
  });

  it('is quiet about events in order, in words, or overlapping', () => {
    expect(checkTimeline([
      event('a', { when: 'April 1st, 1923' }), event('x', { when: 'the night of the storm' }), event('b', { when: 'April 1st, 1923' }),
      event('c', { when: 'the second week of June, 1923' }), event('d', { when: 'June 10th, 1923' })
    ])).toEqual([]);
  });

  it('asks about a year it had to guess backwards', () => {
    const issues = checkTimeline([event('a', { when: 'June 2nd, 2017' }), event('b', { when: 'January 5th' })]);
    expect(issues.map(i => i.kind)).toEqual(['year-rolled']);
    expect(issues[0].message).toContain('following year');
  });

  it('asks when "three days later" disagrees with the dates', () => {
    const issues = checkTimeline([event('leaves', { when: 'April 1st, 1923' }), event('returns', { when: 'April 11th, 1923', quote: 'Three days later, Dana came back.' })]);
    expect(issues.map(i => i.kind)).toEqual(['elapsed']);
    expect(issues[0].message).toContain('10 days after');
  });

  it('accepts a gap near what the wording says', () => {
    expect(checkTimeline([event('leaves', { when: 'April 1st, 1923' }), event('returns', { when: 'April 5th, 1923', quote: 'Three days later, Dana came back.' })])).toEqual([]);
  });

  it('asks when the weekday does not fit the date', () => {
    const wrong = checkTimeline([event('meet', { when: 'Friday, March 14th, 2017' })]);
    expect(wrong.map(i => i.kind)).toEqual(['weekday']);
    expect(wrong[0].message).toContain('falls on a Tuesday');
    expect(checkTimeline([event('meet', { when: 'Tuesday, March 14th, 2017' })])).toEqual([]);
  });

  it('reports an event whose passage has gone', () => {
    expect(checkTimeline([event('gone', { lost: true })])[0]).toMatchObject({ kind: 'lost', eventIds: ['gone'] });
  });
});

describe('living with the other findings', () => {
  const project = (events: TimelineEvent[], findings: Project['findings'] = []) =>
    ({ chapters: [{ id: 'c0', title: 'One', content: '', order: 1 }], timeline: events, findings }) as unknown as Project;
  const backwards = () => [event('fire', { when: 'May 2nd, 1923', chapterId: 'c0', quote: 'The fire took the mill.' }), event('storm', { when: 'April 1st, 1923' })];

  it('turns the checks into Analyzer findings with the evidence attached', () => {
    const [finding] = timelineFindings(backwards(), [{ id: 'c0', title: 'One' }], []);
    expect(isTimelineFinding(finding)).toBe(true);
    expect(finding).toMatchObject({ category: 'continuity', status: 'unreviewed', confidence: 'definite' });
    expect(finding.evidencePassages).toEqual([{ chapterId: 'c0', chapterTitle: 'One', quote: 'The fire took the mill.' }]);
  });

  it('keeps the writer’s answer, and drops a finding once the problem is fixed', () => {
    const first = syncTimelineFindings(project(backwards()));
    const answered = { ...first, findings: first.findings.map(f => ({ ...f, status: 'intentional' as const })) };
    expect(syncTimelineFindings(answered)).toBe(answered);
    const events = backwards().map(e => (e.id === 'storm' ? { ...e, when: 'June 1st, 1923' } : e));
    expect(syncTimelineFindings({ ...answered, timeline: events }).findings).toEqual([]);
  });

  it('leaves findings from scans alone', () => {
    const scan = { id: 'finding-chekhov-item-key', category: 'dropped_thread', title: 'x', summary: '', evidencePassages: [], confidence: 'probable', status: 'unreviewed' } as Project['findings'][number];
    const next = syncTimelineFindings(project(backwards(), [scan]));
    expect(next.findings.map(f => f.id)).toContain('finding-chekhov-item-key');
    expect(next.findings).toHaveLength(2);
  });
});

describe('following edits', () => {
  it('re-anchors the passage an event is told in, and flags it when it goes', () => {
    const quote = 'Dana finally learned who sent the letter, and the whole room went quiet.';
    const events = [event('reveal', { chapterId: 'c0', quote })];
    const moved = reanchorTimeline(events, prepareChapters([{ id: 'c0', content: '<p>Cut.</p>' }, { id: 'c1', content: `<p>${quote}</p>` }]));
    expect(moved[0].chapterId).toBe('c1');
    const gone = reanchorTimeline(events, prepareChapters([{ id: 'c0', content: '<p>The harbor was empty by morning and the gulls had gone.</p>' }]));
    expect(gone[0]).toMatchObject({ lost: true, quote });
  });

  it('leaves events with no passage alone', () => {
    const events = [event('loose')];
    expect(reanchorTimeline(events, prepareChapters([{ id: 'c0', content: '<p>Some text here.</p>' }]))).toBe(events);
  });
});
