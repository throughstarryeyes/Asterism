import { describe, expect, it } from 'vitest';
import { MAX_SPRINTS, addSprint, sprintTotals } from '../sprints';

describe('sprint history', () => {
  it('adds a finished sprint with its own id and time', () => {
    const list = addSprint(undefined, { minutes: 15, words: 320 }, new Date('2026-10-30T10:00:00Z'));
    expect(list).toHaveLength(1);
    expect(list[0].at).toBe('2026-10-30T10:00:00.000Z');
    expect(list[0].id).toMatch(/^sprint-/);
  });
  it('gives two sprints different ids, so syncing keeps both', () => {
    const now = new Date('2026-10-30T10:00:00Z');
    const list = addSprint(addSprint(undefined, { minutes: 5, words: 1 }, now), { minutes: 5, words: 2 }, now);
    expect(new Set(list.map(s => s.id)).size).toBe(2);
  });
  it('keeps only the newest ones, and adds up the rest', () => {
    let list = addSprint(undefined, { minutes: 1, words: 1 });
    for (let i = 0; i < MAX_SPRINTS + 5; i++) list = addSprint(list, { minutes: 2, words: 10 });
    expect(list).toHaveLength(MAX_SPRINTS);
    expect(sprintTotals(list)).toEqual({ count: MAX_SPRINTS, words: MAX_SPRINTS * 10, minutes: MAX_SPRINTS * 2 });
    expect(sprintTotals(undefined).count).toBe(0);
  });
});
