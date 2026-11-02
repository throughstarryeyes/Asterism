// seasonal looks and the season challenge. the date is always passed in, so everything here is testable.

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export const SEASONS: Record<Season, { label: string; blurb: string }> = {
  winter: { label: 'Winter', blurb: 'December to February' },
  spring: { label: 'Spring', blurb: 'March to May' },
  summer: { label: 'Summer', blurb: 'June to August' },
  autumn: { label: 'Autumn', blurb: 'September to November' },
};

export const SEASON_ORDER: Season[] = ['winter', 'spring', 'summer', 'autumn'];

// words to write in a season, and what finishing pays
export const SEASON_GOAL = 10000;
export const SEASON_REWARD = 300;

export function seasonOf(date: Date = new Date()): Season {
  const m = date.getMonth();
  if (m === 11 || m < 2) return 'winter';
  if (m < 5) return 'spring';
  if (m < 8) return 'summer';
  return 'autumn';
}

// one challenge per season per year. winter runs over New Year, so January belongs to the winter that began the year before.
export function seasonKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  return `${seasonOf(date)}-${m < 2 ? y - 1 : y}`;
}

export const seasonBadge = (s: Season) => `badge-season-${s}`;

export interface SeasonProgress { key: string; words: number; paid?: boolean }

// add words written now. `done` is true only on the call that reaches the goal.
export function addSeasonWords(prev: SeasonProgress | undefined, n: number, date: Date = new Date()): { state: SeasonProgress; done: boolean } {
  const key = seasonKey(date);
  const base = prev && prev.key === key ? prev : { key, words: 0 };
  const words = base.words + Math.max(0, Math.round(n));
  const done = words >= SEASON_GOAL && !base.paid;
  return { state: { key, words, paid: base.paid || done || undefined }, done };
}

// progress to show now: nothing yet when the saved progress is from an older season
export const progressNow = (prev: SeasonProgress | undefined, date: Date = new Date()): SeasonProgress =>
  prev && prev.key === seasonKey(date) ? prev : { key: seasonKey(date), words: 0 };

export const inSeason = (season: Season | undefined, date: Date = new Date()) => !season || season === seasonOf(date);
