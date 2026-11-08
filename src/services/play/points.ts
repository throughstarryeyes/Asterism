import type { PlayStats } from './types';

// playing pays a little, so the games are worth coming back to, and a lot of it in one day pays nothing more, so they cannot be farmed.
export const PLAY_REWARD = 4;
export const PLAY_PER_DAY = 5;

export function takePlayAward(play: PlayStats | undefined, today: string): { play: PlayStats; qp: number } {
  const used = play?.day === today ? play.awards ?? 0 : 0;
  if (used >= PLAY_PER_DAY) return { play: { ...play, day: today, awards: used }, qp: 0 };
  return { play: { ...play, day: today, awards: used + 1 }, qp: PLAY_REWARD };
}
