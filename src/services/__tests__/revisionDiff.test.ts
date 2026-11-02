import { describe, it, expect } from 'vitest';
import { compareDrafts, diffWords, plainText, totalChange } from '../revisionDiff';

const kinds = (parts: Array<{ kind: string; text: string }>, kind: string) =>
  parts.filter(p => p.kind === kind).map(p => p.text.trim());

describe('plain text', () => {
  it('drops tags and keeps paragraph breaks', () => {
    expect(plainText('<p>One &amp; two</p><p>Three</p>')).toBe('One & two\n\nThree');
  });
});

describe('word diff', () => {
  it('finds an inserted and a removed word', () => {
    const parts = diffWords('The cat sat on the mat', 'The black cat sat on a mat');
    expect(kinds(parts, 'added')).toEqual(['black', 'a']);
    expect(kinds(parts, 'removed')).toEqual(['the']);
  });

  it('rebuilds the newer text from same + added parts', () => {
    const after = 'She opened the door and stepped out into the rain.';
    const parts = diffWords('She opened the window and looked out.', after);
    expect(parts.filter(p => p.kind !== 'removed').map(p => p.text).join('')).toBe(after);
  });

  it('reports identical text as one unchanged part', () => {
    expect(diffWords('same words', 'same words')).toEqual([{ kind: 'same', text: 'same words' }]);
  });

  it('handles very long rewrites without stalling', () => {
    const a = Array.from({ length: 6000 }, (_, i) => `a${i}`).join(' ');
    const b = Array.from({ length: 6000 }, (_, i) => `b${i}`).join(' ');
    const parts = diffWords(a, b);
    expect(parts.map(p => p.kind)).toEqual(['removed', 'added']);
  });
});

describe('draft compare', () => {
  const older = [
    { id: 'c1', title: 'One', content: '<p>Rain fell.</p>' },
    { id: 'c2', title: 'Two', content: '<p>Gone soon.</p>' },
  ];
  const newer = [
    { id: 'c1', title: 'One', content: '<p>Rain fell hard.</p>' },
    { id: 'c3', title: 'Three', content: '<p>Fresh start.</p>' },
  ];

  it('marks changed, added and removed chapters', () => {
    const d = compareDrafts(older, newer);
    expect(d.map(x => [x.title, x.state])).toEqual([['One', 'changed'], ['Three', 'added'], ['Two', 'removed']]);
    expect(totalChange(d)).toEqual({ added: 3, removed: 2, changedChapters: 3 });
  });

  it('pairs a renamed chapter by id and a re-created one by title', () => {
    const d = compareDrafts([{ id: 'x', title: 'Old', content: '<p>Hi</p>' }], [{ id: 'x', title: 'New', content: '<p>Hi</p>' }]);
    expect(d[0].state).toBe('same');
    const e = compareDrafts([{ id: 'x', title: 'Same', content: '<p>Hi</p>' }], [{ id: 'y', title: 'Same', content: '<p>Hi there</p>' }]);
    expect(e[0].state).toBe('changed');
  });
});
