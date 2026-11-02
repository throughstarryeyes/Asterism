import { describe, it, expect } from 'vitest';
import { addToTrash, daysLeft, pruneTrash, removeFromTrash, TRASH_DAYS } from '../trash';
import type { Project } from '../../types';

const doc = (id: string) => ({ id, title: id }) as unknown as Project;
const DAY = 86_400_000;
const t0 = Date.UTC(2026, 9, 1);

describe('recently deleted', () => {
  it('keeps the newest first and counts the days left', () => {
    let items = addToTrash([], doc('a'), t0);
    items = addToTrash(items, doc('b'), t0 + DAY);
    expect(items.map(i => i.project.id)).toEqual(['b', 'a']);
    expect(daysLeft(items[1], t0 + 10 * DAY)).toBe(TRASH_DAYS - 10);
  });

  it('drops documents past the keep period', () => {
    const items = addToTrash([], doc('a'), t0);
    expect(pruneTrash(items, t0 + (TRASH_DAYS + 1) * DAY)).toEqual([]);
    expect(daysLeft(items[0], t0 + 99 * DAY)).toBe(0);
  });

  it('deleting the same document twice keeps one copy', () => {
    let items = addToTrash([], doc('a'), t0);
    items = addToTrash(items, doc('a'), t0 + DAY);
    expect(items).toHaveLength(1);
  });

  it('removes one by id', () => {
    const items = addToTrash(addToTrash([], doc('a'), t0), doc('b'), t0);
    expect(removeFromTrash(items, 'a').map(i => i.project.id)).toEqual(['b']);
  });
});
