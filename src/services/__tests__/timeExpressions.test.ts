import { describe, it, expect } from 'vitest';
import { civilFromDay, dayNumber, daysFromCivil, describeResolved, describeSpec, findTimeExpressions, readTime, resolveSpec, weekdayOf, type Resolved, type TimeSpec } from '../timeExpressions';

const spec = (text: string): TimeSpec => readTime(text)!.spec;
const day = (y: number, m: number, d: number) => daysFromCivil(y, m, d)!;
const on = (y: number, m: number, d: number): Resolved => ({ start: day(y, m, d), end: day(y, m, d), basis: 'stated' });
const placed = (text: string, context: Resolved | null = null, ref: Resolved | null = context) => resolveSpec(spec(text), context, ref);
const show = (r: Resolved | null) => (r ? describeResolved(r) : null);

describe('the calendar', () => {
  it('converts days and dates both ways, leap years and invented years included', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('2024-02-29')).not.toBeNull();
    expect(dayNumber('2023-02-29')).toBeNull();
    expect(dayNumber('0412-06-01')! - dayNumber('0412-05-01')!).toBe(31);
    for (const [y, m, d] of [[2017, 3, 14], [1923, 12, 31], [412, 2, 1], [-44, 3, 15]] as const) {
      expect(civilFromDay(day(y, m, d))).toEqual({ y, m, d });
    }
  });

  it('knows the day of the week', () => {
    expect(weekdayOf(day(2017, 3, 14))).toBe(2); // a Tuesday
    expect(weekdayOf(day(1970, 1, 1))).toBe(4);
  });
});

describe('reading dates', () => {
  it('reads 3/14/17 and its variants', () => {
    expect(spec('3/14/17')).toMatchObject({ kind: 'abs', year: 2017, month: 3, day: 14 });
    expect(spec('3/14/2017')).toMatchObject({ year: 2017, month: 3, day: 14 });
    expect(spec('3-14-17')).toMatchObject({ year: 2017, month: 3, day: 14 });
    expect(spec('14/3/17')).toMatchObject({ month: 3, day: 14 });
    expect(spec('3/14')).toMatchObject({ month: 3, day: 14 });
    expect(spec('1/2/1999')).toMatchObject({ month: 1, day: 2, guess: true });
    expect(readTime('13/45/17')).toBeNull();
    expect(spec('3/14/98').year).toBe(1998);
  });

  it('reads month names however they are written, in prose and in a field', () => {
    expect(spec('March 14th')).toMatchObject({ month: 3, day: 14 });
    expect(spec('march 14th')).toMatchObject({ month: 3, day: 14 });
    expect(spec('14th of March, 1923')).toMatchObject({ month: 3, day: 14, year: 1923 });
    expect(spec('Mar. 3, 1923')).toMatchObject({ month: 3, day: 3, year: 1923 });
    expect(spec('1923-03-14')).toMatchObject({ year: 1923, month: 3, day: 14 });
    expect(spec('March 1923')).toMatchObject({ month: 3, year: 1923 });
    expect(spec('March 1923').day).toBeUndefined();
    expect(spec('March 14th').year).toBeUndefined();
    expect(spec('in 1923')).toMatchObject({ year: 1923 });
    expect(spec('in March')).toMatchObject({ month: 3 });
    expect(spec('Christmas Eve')).toMatchObject({ month: 12, day: 24 });
  });

  it('reads parts of a month', () => {
    expect(spec('the second week of March')).toMatchObject({ month: 3, week: 2 });
    expect(spec('second week of march')).toMatchObject({ month: 3, week: 2 });
    expect(spec('the last week of June, 1923')).toMatchObject({ month: 6, week: -1, year: 1923 });
    expect(spec('early March')).toMatchObject({ month: 3, part: 'early' });
    expect(spec('mid-March')).toMatchObject({ month: 3, part: 'mid' });
    expect(spec('the end of March')).toMatchObject({ month: 3, part: 'late' });
    expect(spec('the second Tuesday of March')).toMatchObject({ month: 3, nth: { n: 2, weekday: 2 } });
    expect(spec('the summer of 1923')).toMatchObject({ season: 'summer', year: 1923 });
    expect(spec('that winter')).toMatchObject({ season: 'winter' });
  });

  it('reads days of the week, with their direction', () => {
    expect(spec('the Tuesday after')).toMatchObject({ kind: 'weekday', weekday: 2, dir: 'after' });
    expect(spec('the Tuesday following the funeral')).toMatchObject({ weekday: 2, dir: 'after' });
    expect(spec('the Tuesday before')).toMatchObject({ weekday: 2, dir: 'before' });
    expect(spec('next Friday')).toMatchObject({ weekday: 5, dir: 'after' });
    expect(spec('last Friday')).toMatchObject({ weekday: 5, dir: 'before' });
    expect(spec('on Monday')).toMatchObject({ weekday: 1, dir: 'on' });
    expect(spec('Tuesday, March 14th, 2017')).toMatchObject({ kind: 'abs', weekday: 2, month: 3, day: 14, year: 2017 });
    expect(spec('Tuesday 3/14/17')).toMatchObject({ kind: 'abs', weekday: 2, month: 3, day: 14 });
    expect(spec('Tuesday the 14th')).toMatchObject({ kind: 'abs', weekday: 2, day: 14 });
  });

  it('reads elapsed time with its length and direction', () => {
    expect(spec('three days later')).toMatchObject({ kind: 'offset', days: 3 });
    expect(spec('a week earlier')).toMatchObject({ days: -7 });
    expect(spec('2 weeks later')).toMatchObject({ days: 14 });
    expect(spec('a few days later')).toMatchObject({ days: 3, slack: 1 });
    expect(spec('six months later')).toMatchObject({ days: 180 });
    expect(spec('the next morning')).toMatchObject({ days: 1 });
    expect(spec('the following week')).toMatchObject({ days: 7 });
    expect(spec('the night before')).toMatchObject({ days: -1 });
    expect(spec('later that day')).toMatchObject({ days: 0 });
  });

  it('finds several in one sentence, the fullest reading winning', () => {
    const found = findTimeExpressions('On Tuesday, March 14th, 2017, three days later than planned, she left.');
    expect(found.map(f => f.text)).toEqual(['Tuesday, March 14th, 2017', 'three days later']);
  });

  it('leaves ordinary words and numbers alone', () => {
    for (const text of [
      'I may go, and the march of days went on.', 'She walked 3 miles.', 'He scored 3/4 of the points.', 'Page 3.14 of the manual.',
      'On the 5th floor, in the 3rd place.', 'He paid in 2000 words of thanks.', 'The days were long.', 'May left early.'
    ]) {
      expect(findTimeExpressions(text), text).toEqual([]);
    }
  });
});

describe('placing them on a calendar', () => {
  it('places a full date exactly, and gives it back in words', () => {
    expect(show(placed('March 14th, 2017'))).toBe('Tue, Mar 14, 2017');
    expect(show(placed('3/14/17'))).toBe('Tue, Mar 14, 2017');
  });

  it('places parts of a month as a stretch of days', () => {
    expect(show(placed('the second week of March, 2017'))).toBe('Mar 8–14, 2017');
    expect(show(placed('early March, 2017'))).toBe('Mar 1–10, 2017');
    expect(show(placed('the last week of March, 2017'))).toBe('Mar 25–31, 2017');
    expect(show(placed('March 2017'))).toBe('March 2017');
    expect(show(placed('in 2017'))).toBe('2017');
    expect(show(placed('the second Tuesday of March, 2017'))).toBe('Tue, Mar 14, 2017');
    expect(show(placed('the last Friday of March, 2017'))).toBe('Fri, Mar 31, 2017');
    expect(show(placed('the summer of 2017'))).toBe('Jun 1 – Aug 31, 2017');
  });

  it('guesses a missing year from the story so far, and says so', () => {
    const before = on(2017, 2, 1);
    const r = placed('March 14th', before)!;
    expect(r).toMatchObject({ basis: 'assumed', start: day(2017, 3, 14) });
    expect(show(r)).toBe('Mar 14');
  });

  it('takes a year-less date that would run backwards as the next year', () => {
    const r = placed('January 5th', on(2017, 6, 1))!;
    expect(r).toMatchObject({ start: day(2018, 1, 5), rolled: true });
    expect(placed('January 5th', on(2017, 1, 1))!.rolled).toBeFalsy();
  });

  it('places a day of the month in the month the story is in, or the next', () => {
    expect(placed('on the 20th', on(2017, 3, 14))).toMatchObject({ start: day(2017, 3, 20) });
    expect(placed('on the 3rd', on(2017, 3, 14))).toMatchObject({ start: day(2017, 4, 3), rolled: true });
    expect(placed('on the 3rd', null)).toBeNull();
  });

  it('counts "the Tuesday after" from the reference', () => {
    // Thursday 16 March 2017.
    const thursday = on(2017, 3, 16);
    expect(show(placed('the Tuesday after', thursday))).toBe('Tue, Mar 21, 2017');
    expect(show(placed('the Tuesday before', thursday))).toBe('Tue, Mar 14, 2017');
    expect(show(placed('next Thursday', thursday))).toBe('Thu, Mar 23, 2017');
    expect(show(placed('on Thursday', thursday))).toBe('Thu, Mar 16, 2017');
    expect(placed('the Tuesday after', null)).toBeNull();
  });

  it('counts elapsed time from the reference', () => {
    expect(show(placed('three days later', on(2017, 3, 14)))).toBe('Fri, Mar 17, 2017');
    expect(show(placed('the next morning', on(2017, 3, 31)))).toBe('Sat, Apr 1, 2017');
    expect(show(placed('the week before', on(2017, 3, 14)))).toBe('Tue, Mar 7, 2017');
    expect(placed('a few days later', on(2017, 3, 14))).toMatchObject({ start: day(2017, 3, 16), end: day(2017, 3, 18) });
    expect(placed('three days later', null)).toBeNull();
  });

  it('describes what a phrase says before it is placed', () => {
    expect(describeSpec(spec('March 14th'))).toBe('March 14 (no year given)');
    expect(describeSpec(spec('the Tuesday after'))).toBe('the Tuesday after the previous event');
    expect(describeSpec(spec('three days later'))).toBe('3 days after the previous event');
    expect(describeSpec(spec('the second week of March'))).toBe('second week of March (no year given)');
  });
});
