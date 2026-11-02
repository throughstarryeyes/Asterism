import { describe, expect, it } from 'vitest';
import { BAR_ITEMS, isShown, toggleHidden } from '../layout';

describe('layout choices', () => {
  it('shows everything when nothing was hidden', () => {
    expect(isShown(undefined, 'zen')).toBe(true);
    expect(isShown([], 'zen')).toBe(true);
  });
  it('hides and brings back one item without touching the others', () => {
    const hidden = toggleHidden(toggleHidden(undefined, 'zen'), 'sprint');
    expect(hidden).toEqual(['zen', 'sprint']);
    expect(isShown(hidden, 'zen')).toBe(false);
    expect(toggleHidden(hidden, 'zen')).toEqual(['sprint']);
  });
  it('never offers to hide the editor, appearance or menu', () => {
    const ids = BAR_ITEMS.map(i => i.id);
    ['editor', 'appearance', 'menu'].forEach(id => expect(ids).not.toContain(id));
  });
});
