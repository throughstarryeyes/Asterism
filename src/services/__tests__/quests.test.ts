import { describe, expect, it } from 'vitest';
import { applyEvent, buyFreeze, ensureDay, liveStreak, multiplier, newQuestState, swapQuest, takeGoalPoints, weekKey } from '../quests';
import { chapterFinishReward, draftReward, goalReward } from '../rewards';

const ctx = { hasThread: true, hasFinding: true, hasDraft: true };
const none = { hasThread: false, hasFinding: false, hasDraft: false };

describe('daily challenges', () => {
  it('gives the same three challenges for the same date', () => {
    const a = ensureDay(newQuestState(), '2026-10-28', ctx);
    const b = ensureDay(newQuestState(), '2026-10-28', ctx);
    expect(a.daily.map(q => q.id)).toEqual(b.daily.map(q => q.id));
    expect(a.daily.map(q => q.category)).toEqual(['write', 'plan', 'finish']);
  });

  it('never offers a challenge the writer cannot do, or the same one twice', () => {
    for (let d = 1; d <= 28; d++) {
      const s = ensureDay(newQuestState(), `2026-10-${String(d).padStart(2, '0')}`, none);
      expect(s.daily.map(q => q.event)).not.toContain('thread');
      expect(s.daily.map(q => q.event)).not.toContain('finding');
      expect(new Set(s.daily.map(q => q.id)).size).toBe(3);
    }
  });

  it('pays when a challenge is done, once, and a bonus for the full set', () => {
    let s = ensureDay(newQuestState(), '2026-10-28', ctx);
    const paid: number[] = [];
    for (const q of [...s.daily]) {
      for (let i = 0; i < q.target; i++) {
        const type = q.event === 'words' ? ({ type: 'words', n: 1 } as const) : ({ type: q.event } as never);
        const r = applyEvent(s, type, '2026-10-28', ctx);
        s = r.state;
        r.awards.forEach(a => paid.push(a.qp));
      }
    }
    expect(s.daily.every(q => q.done)).toBe(true);
    expect(paid.filter(p => p === 20).length).toBe(1);
  });

  it('swaps a challenge once a day', () => {
    const s = ensureDay(newQuestState(), '2026-10-28', ctx);
    const swapped = swapQuest(s, 0, ctx);
    expect(swapped.swapped).toBe(true);
    expect(swapped.daily[0].id).not.toBe(s.daily[0].id);
    expect(swapQuest(swapped, 1, ctx)).toBe(swapped);
  });
});

describe('streaks', () => {
  const write = (s: ReturnType<typeof newQuestState>, day: string) => applyEvent(s, { type: 'words', n: 120 }, day, ctx).state;

  it('counts a day once 100 words are written', () => {
    let s = write(newQuestState(), '2026-10-28');
    expect(s.streak).toBe(1);
    s = write(s, '2026-10-28');
    expect(s.streak).toBe(1);
    s = write(s, '2026-10-29');
    expect(s.streak).toBe(2);
  });

  it('breaks after a missed day, unless a freeze covers it', () => {
    let s = write(newQuestState(), '2026-10-28');
    expect(liveStreak(s, '2026-10-30')).toBe(0);
    s = { ...s, freezes: 1 };
    expect(liveStreak(s, '2026-10-30')).toBe(1);
    s = write(s, '2026-10-30');
    expect(s.streak).toBe(2);
    expect(s.freezes).toBe(0);
    expect(write(write(newQuestState(), '2026-10-01'), '2026-10-05').streak).toBe(1);
  });

  it('saves a freeze every 7 days, up to 2', () => {
    let s = newQuestState();
    for (let d = 1; d <= 14; d++) s = write(s, `2026-10-${String(d).padStart(2, '0')}`);
    expect(s.streak).toBe(14);
    expect(s.freezes).toBe(2);
    expect(buyFreeze(s)).toBeNull();
  });

  it('adds a small, capped bonus', () => {
    expect(multiplier(0)).toBe(1);
    expect(multiplier(5)).toBeCloseTo(1.15);
    expect(multiplier(100)).toBeCloseTo(1.3);
  });
});

describe('weeks and rewards', () => {
  it('finds the Monday of a week', () => {
    expect(weekKey('2026-10-28')).toBe('2026-10-26');
    expect(weekKey('2026-10-25')).toBe('2026-10-19');
  });

  it('pays chapters, drafts and goals by size', () => {
    expect(chapterFinishReward(0)).toBe(60);
    expect(chapterFinishReward(5000)).toBe(90);
    expect(draftReward(5000)).toBe(250);
    expect(draftReward(80000)).toBe(1000);
    expect(goalReward('words', 1)).toBe(10);
    expect(goalReward('words', 100000)).toBe(60);
  });

  it('limits what goals pay in a day', () => {
    let s = ensureDay(newQuestState(), '2026-10-28', ctx);
    s = takeGoalPoints(s, 100).state;
    const r = takeGoalPoints(s, 100);
    expect(r.qp).toBe(50);
    expect(takeGoalPoints(r.state, 10).qp).toBe(0);
  });
});
