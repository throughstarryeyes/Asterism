import { describe, expect, it } from 'vitest';
import { BAR_EXTRAS, BAR_ITEMS, BAR_VIEWS, CAPSULE_ITEMS, inOrder, isShown, moveInOrder, toggleHidden } from '../layout';

describe('layout choices', () => {
  it('shows everything when nothing was hidden', () => {
    expect(isShown(undefined, 'book')).toBe(true);
    expect(isShown([], 'book')).toBe(true);
  });
  it('hides and brings back one item without touching the others', () => {
    const hidden = toggleHidden(toggleHidden(undefined, 'book'), 'sprint');
    expect(hidden).toEqual(['book', 'sprint']);
    expect(isShown(hidden, 'book')).toBe(false);
    expect(toggleHidden(hidden, 'book')).toEqual(['sprint']);
  });
  it('never offers to hide editing, zen or the menu', () => {
    const ids = BAR_ITEMS.map(i => i.id);
    ['editor', 'zen', 'menu'].forEach(id => expect(ids).not.toContain(id));
    expect(BAR_VIEWS.filter(v => v.essential).map(v => v.id)).toEqual(['editor', 'zen']);
  });
  it('lets what is reachable elsewhere be hidden, including appearance', () => {
    expect(BAR_EXTRAS.map(i => i.id)).toContain('appearance');
    expect(BAR_ITEMS.map(i => i.id)).toContain('appearance');
  });
});

describe('order', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('keeps the default order until the writer moves something', () => {
    expect(inOrder(items, undefined).map(i => i.id)).toEqual(['a', 'b', 'c']);
  });
  it('moves one step and stops at the ends', () => {
    expect(moveInOrder(items, undefined, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveInOrder(items, undefined, 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveInOrder(items, ['c', 'a', 'b'], 'b', 1)).toEqual(['c', 'a', 'b']);
  });
  it('puts an item the writer has not placed after the ones they have', () => {
    expect(inOrder(items, ['c', 'a']).map(i => i.id)).toEqual(['c', 'a', 'b']);
  });
  it('has a bottom bar piece for each thing in it', () => {
    expect(CAPSULE_ITEMS.map(i => i.id)).toEqual(['timer', 'words', 'scroll', 'sounds', 'notes']);
  });
});
