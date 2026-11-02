// reads time out of prose ("March 14th", "the second week of March", "three days later")
// each phrase becomes a TimeSpec; resolveSpec places it on a day count or leaves it unplaced

export type CueKind = 'date' | 'weekday' | 'elapsed' | 'sequence' | 'season';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface TimeSpec {
  // abs: a date, or part of one. weekday: "the Tuesday after". offset: "three days later".
  kind: 'abs' | 'weekday' | 'offset';
  year?: number;
  month?: number;
  day?: number;
  // 1 to 5, or -1 for the last week of the month.
  week?: number;
  part?: 'early' | 'mid' | 'late';
  season?: Season;
  // "the second Tuesday of March" (n is -1 for the last).
  nth?: { n: number; weekday: number };
  // abs: a weekday the text states alongside the date, to check. weekday: the day itself.
  weekday?: number;
  dir?: 'on' | 'after' | 'before';
  // offset: signed days, and how many days either side it could be.
  days?: number;
  slack?: number;
  // the text could be read two ways (3/4) and month-first was chosen.
  guess?: boolean;
}

export interface TimeExpression {
  text: string;
  index: number;
  kind: CueKind;
  spec: TimeSpec;
}

// ---- calendar ---------------------------------------------------------------------------

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// leap, so a year-less 29 February is not ruled out.
export const BASE_YEAR = 2000;

export const daysIn = (year: number, month: number): number =>
  month === 2 ? ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

/** days since 1970-01-01 for a year, month and day, or null if there is no such day. */
export function daysFromCivil(year: number, month: number, day: number): number | null {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDay(count: number): { y: number; m: number; d: number } {
  const z = count + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { y: m <= 2 ? yoe + era * 400 + 1 : yoe + era * 400, m, d };
}

/** days since 1970-01-01 for "YYYY-MM-DD" (any year, an invented one included), or null. */
export function dayNumber(date: string | undefined): number | null {
  const m = date?.trim().match(/^(-?\d{1,6})-(\d{1,2})-(\d{1,2})$/);
  return m ? daysFromCivil(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

// 0 is Sunday. 1970-01-01 was a Thursday.
export const weekdayOf = (count: number): number => (((Math.floor(count) + 4) % 7) + 7) % 7;

// ---- reading ----------------------------------------------------------------------------

// a word in either case, so "Next Tuesday" and "next Tuesday" both match while month names, which
// are matched as written, keep "may" and "march" the verbs out of it.
const ci = (w: string) => w.split('').map(c => (c === ' ' ? '\\s+' : /[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c)).join('');
const cis = (words: string[]) => `(?:${words.map(ci).join('|')})`;

const WD = `(${WEEKDAYS.join('|')})`;
const MF = `(${MONTHS.join('|')})`;
const MN = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const WD_PREFIX = `(?:\\b${WD},?\\s+(?:the\\s+)?)?`;
const DAY = '(\\d{1,2})(?:st|nd|rd|th)?';
const YEAR = '(?:,?\\s+(\\d{4}))?';

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 };
const ORD = `(${cis(Object.keys(ORDINALS))})`;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  'a couple of': 2, 'a few': 3, several: 4
};
const APPROXIMATE = new Set(['a couple of', 'a few', 'several']);
const AMOUNT = `(\\d+|${cis(Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length))})`;
const UNIT_DAYS: Record<string, number> = { second: 0, minute: 0, hour: 0, day: 1, night: 1, morning: 1, evening: 1, afternoon: 1, week: 7, month: 30, year: 365 };
const UNITS = cis(['second', 'minute', 'hour', 'day', 'night', 'week', 'month', 'year']);
const PARTS_OF_DAY = cis(['day', 'morning', 'evening', 'night', 'afternoon']);
const SPANS = cis(['day', 'morning', 'evening', 'night', 'afternoon', 'week', 'month', 'year']);

const monthIndex = (name: string) => MONTHS.findIndex(m => m.toLowerCase().startsWith(name.toLowerCase().slice(0, 3))) + 1;
const weekdayIndex = (name: string) => WEEKDAYS.indexOf(name);
const fixYear = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  return raw.length === 2 ? (n < 50 ? 2000 + n : 1900 + n) : raw.length === 4 ? n : undefined;
};

// a month and day that can exist (29 February is allowed when the year is not known).
const real = (year: number | undefined, month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year ?? BASE_YEAR, month);

interface Pattern {
  kind: CueKind;
  re: RegExp;
  build: (m: RegExpMatchArray) => TimeSpec | null;
}

const HOLIDAYS: Array<[string, number, number]> = [
  ['Christmas Eve', 12, 24], ['Christmas Day', 12, 25], ['Christmas', 12, 25], ['New Year[’\']s Eve', 12, 31], ['New Year[’\']s Day', 1, 1],
  ['New Year[’\']s', 1, 1], ['Halloween', 10, 31], ['Valentine[’\']s Day', 2, 14], ['Independence Day', 7, 4], ['Fourth of July', 7, 4]
];

const PATTERNS: Pattern[] = [
  // 1923-03-14
  { kind: 'date', re: /(?<![\d-])(-?\d{4})-(\d{2})-(\d{2})(?![\d-])/g, build: m => {
    const year = Number(m[1]); const month = Number(m[2]); const day = Number(m[3]);
    return real(year, month, day) ? { kind: 'abs', year, month, day } : null;
  } },
  // 3/14/17, 3-14-2017, 14/3
  { kind: 'date', re: new RegExp(`${WD_PREFIX}(?<![\\d/.-])(\\d{1,2})([/.-])(\\d{1,2})\\3(\\d{2}|\\d{4})(?![\\d/])`, 'g'), build: m => numeric(m[1], m[2], m[4], m[5]) },
  // 3/14 on its own could be a fraction: it needs a day that cannot be a month, a weekday, or "on"/"by"/"since" before it.
  { kind: 'date', re: new RegExp(`${WD_PREFIX}(?<![\\d/.-])(\\d{1,2})/(\\d{1,2})(?![\\d/]|\\.\\d)`, 'g'), build: m => (m[1] || Number(m[2]) > 12 || Number(m[3]) > 12 ? numeric(m[1], m[2], m[3], undefined) : null) },
  { kind: 'date', re: new RegExp(`\\b(?:on|by|until|since|before|after)\\s+${WD_PREFIX}(?<![\\d/.-])(\\d{1,2})/(\\d{1,2})(?![\\d/]|\\.\\d)(?!\\s+(?:of|cup|cups|inch|inches|mile|miles|full)\\b)`, 'g'), build: m => numeric(m[1], m[2], m[3], undefined) },
  // March 14th, 1923   Tuesday, March 14th
  { kind: 'date', re: new RegExp(`${WD_PREFIX}\\b${MN}\\.?\\s+${DAY}(?!\\d)${YEAR}`, 'g'), build: m => {
    const month = monthIndex(m[2]); const day = Number(m[3]); const year = m[4] ? Number(m[4]) : undefined;
    return real(year, month, day) ? { kind: 'abs', month, day, year, weekday: m[1] ? weekdayIndex(m[1]) : undefined } : null;
  } },
  // 14th of March, 1923   14 June
  { kind: 'date', re: new RegExp(`${WD_PREFIX}\\b${DAY}\\s+(?:of\\s+)?${MN}\\b${YEAR}`, 'g'), build: m => {
    const month = monthIndex(m[3]); const day = Number(m[2]); const year = m[4] ? Number(m[4]) : undefined;
    return real(year, month, day) ? { kind: 'abs', month, day, year, weekday: m[1] ? weekdayIndex(m[1]) : undefined } : null;
  } },
  // Tuesday the 14th
  { kind: 'date', re: new RegExp(`\\b${WD},?\\s+the\\s+(\\d{1,2})(?:st|nd|rd|th)\\b`, 'g'), build: m => (Number(m[2]) >= 1 && Number(m[2]) <= 31 ? { kind: 'abs', day: Number(m[2]), weekday: weekdayIndex(m[1]) } : null) },
  // on the 14th
  { kind: 'date', re: /\bon\s+the\s+(\d{1,2})(?:st|nd|rd|th)\b(?!\s+(?:floor|time|century|street|row|grade|place|anniversary|avenue|attempt|round|chapter|try))/g, build: m => (Number(m[1]) >= 1 && Number(m[1]) <= 31 ? { kind: 'abs', day: Number(m[1]) } : null) },
  // the second Tuesday of March
  { kind: 'date', re: new RegExp(`\\b(?:the\\s+)?${ORD}\\s+${WD}\\s+(?:of|in)\\s+${MF}${YEAR}`, 'g'), build: m => ({ kind: 'abs', month: monthIndex(m[3]), year: m[4] ? Number(m[4]) : undefined, nth: { n: ORDINALS[m[1].toLowerCase()], weekday: weekdayIndex(m[2]) } }) },
  // the second week of March
  { kind: 'date', re: new RegExp(`\\b(?:the\\s+)?${ORD}\\s+week\\s+(?:of|in)\\s+${MF}${YEAR}`, 'g'), build: m => ({ kind: 'abs', month: monthIndex(m[2]), year: m[3] ? Number(m[3]) : undefined, week: ORDINALS[m[1].toLowerCase()] }) },
  // early March, mid-March, the end of March
  { kind: 'date', re: new RegExp(`\\b(${cis(['early', 'mid', 'late'])})[-\\s]\\s*${MF}\\b${YEAR}`, 'g'), build: m => ({ kind: 'abs', month: monthIndex(m[2]), year: m[3] ? Number(m[3]) : undefined, part: m[1].toLowerCase() as 'early' | 'mid' | 'late' }) },
  { kind: 'date', re: new RegExp(`\\b(?:the\\s+)?(${cis(['beginning', 'middle', 'end'])})\\s+of\\s+${MF}\\b${YEAR}`, 'g'), build: m => ({ kind: 'abs', month: monthIndex(m[2]), year: m[3] ? Number(m[3]) : undefined, part: ({ beginning: 'early', middle: 'mid', end: 'late' } as const)[m[1].toLowerCase() as 'beginning' | 'middle' | 'end'] }) },
  // the summer of 1923
  { kind: 'season', re: new RegExp(`\\b(?:the\\s+)?(${cis(['spring', 'summer', 'autumn', 'fall', 'winter'])})\\s+of\\s+(\\d{4})`, 'g'), build: m => ({ kind: 'abs', year: Number(m[2]), season: seasonOf(m[1]) }) },
  // that winter, next spring
  { kind: 'season', re: new RegExp(`\\b${cis(['in', 'that', 'last', 'next', 'every', 'the following'])}\\s+(${cis(['spring', 'summer', 'autumn', 'fall', 'winter'])})\\b`, 'g'), build: m => ({ kind: 'abs', season: seasonOf(m[1]) }) },
  // March 1923
  { kind: 'date', re: new RegExp(`\\b${MF}\\.?,?\\s+(\\d{4})\\b`, 'g'), build: m => ({ kind: 'abs', month: monthIndex(m[1]), year: Number(m[2]) }) },
  // in March   last June
  { kind: 'date', re: new RegExp(`\\b(${cis(['in', 'during', 'last', 'next', 'this', 'that', 'every', 'since', 'until'])})\\s+${MF}\\b`, 'g'), build: m =>
    // "May" is also a name; only the clearest uses count.
    (m[2] === 'May' && !['in', 'during', 'last', 'next', 'this', 'every'].includes(m[1].toLowerCase()) ? null : { kind: 'abs', month: monthIndex(m[2]) }) },
  // in 1923
  { kind: 'date', re: /\b(?:in|during|of|since|until|by|before|after|from|around|circa)\s+(1\d{3}|20\d{2})\b(?!\s+(?:words|people|men|miles|years|dollars|feet|pounds|soldiers|times|steps|lines|pages|more|of|or)\b)/g, build: m => ({ kind: 'abs', year: Number(m[1]) }) },
  // Christmas, Halloween
  ...HOLIDAYS.map<Pattern>(([name, month, day]) => ({ kind: 'date', re: new RegExp(`\\b${name}\\b`, 'g'), build: () => ({ kind: 'abs', month, day }) })),

  // the Tuesday after, the Tuesday before, the Tuesday following
  { kind: 'weekday', re: new RegExp(`\\b(?:the\\s+)?${WD}\\s+(${cis(['after', 'following', 'before'])})\\b`, 'g'), build: m => ({ kind: 'weekday', weekday: weekdayIndex(m[1]), dir: m[2].toLowerCase() === 'before' ? 'before' : 'after' }) },
  // next Tuesday, the following Tuesday
  { kind: 'weekday', re: new RegExp(`\\b${cis(['next', 'the following', 'the next', 'this coming'])}\\s+${WD}`, 'g'), build: m => ({ kind: 'weekday', weekday: weekdayIndex(m[1]), dir: 'after' }) },
  // last Tuesday
  { kind: 'weekday', re: new RegExp(`\\b${cis(['last', 'the previous', 'the preceding'])}\\s+${WD}`, 'g'), build: m => ({ kind: 'weekday', weekday: weekdayIndex(m[1]), dir: 'before' }) },
  // that Tuesday, on Tuesday, Tuesday
  { kind: 'weekday', re: new RegExp(`\\b${WD}\\b`, 'g'), build: m => ({ kind: 'weekday', weekday: weekdayIndex(m[1]), dir: 'on' }) },

  // three days later, a week earlier, two years ago
  { kind: 'elapsed', re: new RegExp(`\\b${AMOUNT}\\s+(?:more\\s+)?(${UNITS})s?\\s+(${cis(['later', 'earlier', 'ago', 'afterwards', 'afterward', 'after that', 'before that'])})\\b`, 'g'), build: m => {
    const word = m[1].toLowerCase();
    const amount = /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word];
    const days = amount * UNIT_DAYS[m[2].toLowerCase()];
    const back = /earlier|ago|before/i.test(m[3]);
    const approximate = APPROXIMATE.has(word);
    const slack = approximate ? Math.max(1, Math.round(days * 0.34)) : m[2].toLowerCase() === 'month' ? 2 : m[2].toLowerCase() === 'year' ? 1 : 0;
    return { kind: 'offset', days: back ? -days : days, slack };
  } },
  // the next morning, the following week, later that night
  { kind: 'sequence', re: new RegExp(`\\b[tT]he\\s+${cis(['next', 'following'])}\\s+(${SPANS})\\b`, 'g'), build: m => ({ kind: 'offset', days: UNIT_DAYS[m[1].toLowerCase()], slack: 0 }) },
  { kind: 'sequence', re: new RegExp(`\\b${ci('later')}\\s+${cis(['that', 'the same'])}\\s+(${PARTS_OF_DAY})\\b`, 'g'), build: () => ({ kind: 'offset', days: 0, slack: 0 }) },
  // the night before, the previous week
  { kind: 'sequence', re: new RegExp(`\\b[tT]he\\s+(${SPANS})\\s+${ci('before')}\\b`, 'g'), build: m => ({ kind: 'offset', days: -UNIT_DAYS[m[1].toLowerCase()], slack: 0 }) },
  { kind: 'sequence', re: new RegExp(`\\b[tT]he\\s+${cis(['previous', 'preceding'])}\\s+(${SPANS})\\b`, 'g'), build: m => ({ kind: 'offset', days: -UNIT_DAYS[m[1].toLowerCase()], slack: 0 }) }
];

function seasonOf(word: string): Season {
  const w = word.toLowerCase();
  return w === 'fall' ? 'autumn' : (w as Season);
}

// 3/14/17: month first unless the first number cannot be a month.
function numeric(weekday: string | undefined, a: string, b: string, yearText: string | undefined): TimeSpec | null {
  const first = Number(a);
  const next = Number(b);
  const year = fixYear(yearText);
  if (yearText && year === undefined) return null;
  const dayFirst = first > 12 && next <= 12;
  const month = dayFirst ? next : first;
  const day = dayFirst ? first : next;
  if (!real(year, month, day)) return null;
  return { kind: 'abs', month, day, year, weekday: weekday ? weekdayIndex(weekday) : undefined, guess: first <= 12 && next <= 12 && first !== next };
}

/** every time phrase in a piece of text, in reading order, the most specific reading winning where they overlap. */
export function findTimeExpressions(text: string): TimeExpression[] {
  const found: Array<TimeExpression & { end: number }> = [];
  for (const pattern of PATTERNS) {
    for (const m of text.matchAll(pattern.re)) {
      const spec = pattern.build(m);
      if (spec) found.push({ text: m[0], index: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: spec.kind === 'abs' && spec.season && !spec.month ? 'season' : pattern.kind, spec });
    }
  }
  found.sort((a, b) => b.text.length - a.text.length || a.index - b.index);
  const chosen: typeof found = [];
  for (const candidate of found) {
    if (!chosen.some(c => candidate.index < c.end && c.index < candidate.end)) chosen.push(candidate);
  }
  return chosen.sort((a, b) => a.index - b.index).map(({ end: _end, ...rest }) => rest);
}

// how precise a reading is, so the best phrase in a piece of text is the one used.
const detail = (spec: TimeSpec): number =>
  spec.kind === 'abs' ? (spec.day && spec.month ? 6 : spec.nth || spec.week || spec.part ? 5 : spec.month ? 4 : spec.season ? 3 : spec.day ? 3 : 2) : spec.kind === 'weekday' ? 2 : 1;

// "march 14th" typed into a field is as plain as "March 14th"; prose is matched as written
// so the words "may" and "march" are left alone, but a field is capitalized first
const NAMED = [
  ...MONTHS, 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sept', 'Sep', 'Oct', 'Nov', 'Dec', ...WEEKDAYS,
  'Christmas', 'Halloween', "New Year's", "Valentine's", 'Independence Day', 'Fourth of July'
];
const NAMED_BY_LOWER = new Map(NAMED.map(n => [n.toLowerCase(), n]));
const NAMED_RE = new RegExp(`\\b(${[...NAMED].sort((a, b) => b.length - a.length).map(n => n.replace(/'/g, "['’]")).join('|')})(?![a-z])`, 'gi');
const capitalizeNames = (text: string) => text.replace(NAMED_RE, m => NAMED_BY_LOWER.get(m.toLowerCase().replace('’', "'")) ?? m);

/** the time a short piece of text (an event's "when") is talking about, if it names one. */
export function readTime(text: string | undefined): TimeExpression | null {
  if (!text?.trim()) return null;
  const all = findTimeExpressions(capitalizeNames(text));
  return all.reduce<TimeExpression | null>((best, e) => (!best || detail(e.spec) > detail(best.spec) ? e : best), null);
}

// ---- placing ----------------------------------------------------------------------------

/** a stretch of days, counted from 1970-01-01. a single day has start equal to end. */
export interface Resolved {
  start: number;
  end: number;
  // stated: the text gave it all. assumed: part of it (the year) was guessed. counted: worked out from another event.
  basis: 'stated' | 'assumed' | 'counted';
  // a year-less date came before the one it follows, so it was taken as the next year.
  rolled?: boolean;
}

const monthLength = (year: number, month: number) => daysIn(year, month);
const dayOf = (year: number, month: number, day: number) => daysFromCivil(year, month, day)!;

const SEASON_MONTHS: Record<Season, [number, number]> = { spring: [3, 5], summer: [6, 8], autumn: [9, 11], winter: [12, 2] };

function absoluteRange(spec: TimeSpec, year: number, month: number | undefined): [number, number] | null {
  if (spec.season && !month) {
    const [from, to] = SEASON_MONTHS[spec.season];
    const endYear = to < from ? year + 1 : year;
    return [dayOf(year, from, 1), dayOf(endYear, to, monthLength(endYear, to))];
  }
  if (month === undefined) return spec.day === undefined ? [dayOf(year, 1, 1), dayOf(year, 12, 31)] : null;
  const length = monthLength(year, month);
  if (spec.nth) {
    const { n, weekday } = spec.nth;
    const days = Array.from({ length }, (_, i) => dayOf(year, month, i + 1)).filter(d => weekdayOf(d) === weekday);
    const day = n === -1 ? days[days.length - 1] : days[n - 1];
    return day === undefined ? null : [day, day];
  }
  if (spec.day !== undefined) return spec.day <= length ? [dayOf(year, month, spec.day), dayOf(year, month, spec.day)] : null;
  if (spec.week !== undefined) {
    if (spec.week === -1) return [dayOf(year, month, length - 6), dayOf(year, month, length)];
    const first = (spec.week - 1) * 7 + 1;
    return first > length ? null : [dayOf(year, month, first), dayOf(year, month, Math.min(length, first + 6))];
  }
  if (spec.part) {
    const [from, to] = spec.part === 'early' ? [1, 10] : spec.part === 'mid' ? [11, 20] : [21, length];
    return [dayOf(year, month, from), dayOf(year, month, to)];
  }
  return [dayOf(year, month, 1), dayOf(year, month, length)];
}

// put a spec on the calendar; context supplies a missing year or month, ref is what a relative phrase counts from
// returns null when there is nothing to place it on
export function resolveSpec(spec: TimeSpec, context: Resolved | null, ref: Resolved | null): Resolved | null {
  if (spec.kind === 'offset') {
    if (!ref || spec.days === undefined) return null;
    const slack = spec.slack ?? 0;
    return { start: ref.start + spec.days - slack, end: ref.end + spec.days + slack, basis: 'counted' };
  }

  if (spec.kind === 'weekday') {
    if (!ref || spec.weekday === undefined) return null;
    let day: number;
    if (spec.dir === 'before') {
      day = ref.start - 1;
      while (weekdayOf(day) !== spec.weekday) day -= 1;
    } else {
      day = spec.dir === 'after' ? ref.end + 1 : ref.start;
      while (weekdayOf(day) !== spec.weekday) day += 1;
    }
    return { start: day, end: day, basis: 'counted' };
  }

  // a day of the month with no month: the one the context is in, or the next one if that day has passed.
  if (spec.month === undefined && spec.day !== undefined) {
    if (!context) return null;
    const base = civilFromDay(context.end);
    let { y, m } = base;
    let found = spec.day <= monthLength(y, m) ? dayOf(y, m, spec.day) : null;
    let rolled = false;
    if (found === null || found < context.start) {
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      found = spec.day <= monthLength(y, m) ? dayOf(y, m, spec.day) : null;
      rolled = true;
    }
    return found === null ? null : { start: found, end: found, basis: 'assumed', rolled };
  }

  if (spec.year !== undefined) {
    const range = absoluteRange(spec, spec.year, spec.month);
    return range && { start: range[0], end: range[1], basis: 'stated' };
  }

  // no year given: use the one the story is in, and the next one if that would run backwards.
  const year = context ? civilFromDay(context.end).y : BASE_YEAR;
  let range = absoluteRange(spec, year, spec.month);
  let rolled = false;
  if (range && context && range[1] < context.start) {
    range = absoluteRange(spec, year + 1, spec.month);
    rolled = true;
  }
  return range && { start: range[0], end: range[1], basis: 'assumed', rolled };
}

// ---- saying it back -----------------------------------------------------------------------

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const shortMonth = (m: number) => MONTHS[m - 1].slice(0, 3);

/** a reading, as words: "Tue, Mar 14, 2017", "Mar 8–14", "March 2017". */
export function describeResolved(r: Resolved): string {
  const a = civilFromDay(r.start);
  const b = civilFromDay(r.end);
  const withYear = r.basis !== 'assumed';
  const year = (y: number) => (withYear ? `, ${y}` : '');
  if (r.start === r.end) return `${withYear ? `${WEEKDAYS[weekdayOf(r.start)].slice(0, 3)}, ` : ''}${shortMonth(a.m)} ${a.d}${year(a.y)}`;
  const wholeMonth = a.d === 1 && b.d === monthLength(b.y, b.m);
  if (wholeMonth && a.y === b.y && a.m === b.m) return withYear ? `${MONTHS[a.m - 1]} ${a.y}` : MONTHS[a.m - 1];
  if (wholeMonth && a.m === 1 && b.m === 12 && a.y === b.y) return withYear ? `${a.y}` : 'the whole year';
  if (a.y === b.y && a.m === b.m) return `${shortMonth(a.m)} ${a.d}–${b.d}${year(a.y)}`;
  return `${shortMonth(a.m)} ${a.d}${a.y === b.y ? '' : year(a.y)} – ${shortMonth(b.m)} ${b.d}${year(b.y)}`;
}

/** what a phrase says, before it is placed: "March 14 (no year given)", "the Tuesday after". */
export function describeSpec(spec: TimeSpec): string {
  if (spec.kind === 'offset') {
    const days = spec.days ?? 0;
    if (days === 0) return 'the same day';
    const n = Math.abs(days);
    return `${n === 1 ? 'a day' : n % 365 === 0 ? `${n / 365} year${n === 365 ? '' : 's'}` : n % 30 === 0 && n >= 30 ? `${n / 30} month${n === 30 ? '' : 's'}` : n % 7 === 0 ? `${n / 7} week${n === 7 ? '' : 's'}` : `${n} days`} ${days > 0 ? 'after' : 'before'} the previous event`;
  }
  if (spec.kind === 'weekday') {
    const day = WEEKDAYS[spec.weekday ?? 0];
    return spec.dir === 'before' ? `the ${day} before the previous event` : spec.dir === 'after' ? `the ${day} after the previous event` : `${day}, counting from the previous event`;
  }
  const parts: string[] = [];
  if (spec.nth) parts.push(`${spec.nth.n === -1 ? 'last' : ['', 'first', 'second', 'third', 'fourth', 'fifth'][spec.nth.n]} ${WEEKDAYS[spec.nth.weekday]} of ${MONTHS[(spec.month ?? 1) - 1]}`);
  else if (spec.week) parts.push(`${spec.week === -1 ? 'last' : ['', 'first', 'second', 'third', 'fourth', 'fifth'][spec.week]} week of ${MONTHS[(spec.month ?? 1) - 1]}`);
  else if (spec.part) parts.push(`${spec.part === 'mid' ? 'mid-' : `${spec.part} `}${MONTHS[(spec.month ?? 1) - 1]}`);
  else if (spec.season && !spec.month) parts.push(spec.season);
  else if (spec.month) parts.push(spec.day ? `${MONTHS[spec.month - 1]} ${spec.day}` : MONTHS[spec.month - 1]);
  else if (spec.day) parts.push(`the ${ordinal(spec.day)}`);
  if (spec.year !== undefined) parts.push(String(spec.year));
  const text = parts.join(' ') || 'a date';
  return spec.year === undefined && (spec.month || spec.season) ? `${text} (no year given)` : text;
}
