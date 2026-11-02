import { describe, it, expect } from 'vitest';
import { withBaselines, wordsAddedThisSession } from '../sessionWords';
import { BUILT_IN_KEYSTROKES, keystrokeLabel, keystrokeOptions } from '../../data/keystrokeSounds';
import { newRecipeSound } from '../soundRecipes';

const ch = (id: string, wordCount: number) => ({ id, wordCount });

describe('words added this session', () => {
  it('counts words, not keystrokes: typing 5 words is +5', () => {
    const start = [ch('a', 100)];
    const baseline = withBaselines({}, start);
    expect(wordsAddedThisSession([ch('a', 105)], baseline)).toBe(5);
  });
  it('does not change when the same word count comes back (a keystroke inside a word)', () => {
    const baseline = withBaselines({}, [ch('a', 100)]);
    expect(wordsAddedThisSession([ch('a', 100)], baseline)).toBe(0);
    expect(wordsAddedThisSession([ch('a', 100)], baseline)).toBe(0);
  });
  it('adds across chapters, and counts a chapter started this session from its starting size', () => {
    let baseline = withBaselines({}, [ch('a', 100)]);
    baseline = withBaselines(baseline, [ch('a', 110), ch('b', 5)]);
    expect(wordsAddedThisSession([ch('a', 110), ch('b', 45)], baseline)).toBe(50);
  });
  it('never goes negative after deleting', () => {
    const baseline = withBaselines({}, [ch('a', 500)]);
    expect(wordsAddedThisSession([ch('a', 200)], baseline)).toBe(0);
  });
  it('deleting in one chapter cancels writing in another (net words)', () => {
    const baseline = withBaselines({}, [ch('a', 100), ch('b', 100)]);
    expect(wordsAddedThisSession([ch('a', 160), ch('b', 80)], baseline)).toBe(40);
  });
  it('keeps the same object when nothing is new, so React does not re-render', () => {
    const baseline = withBaselines({}, [ch('a', 1)]);
    expect(withBaselines(baseline, [ch('a', 50)])).toBe(baseline);
    expect(baseline.a).toBe(1);
  });
  it('treats a missing word count as zero', () => {
    expect(wordsAddedThisSession([{ id: 'x' }], withBaselines({}, [{ id: 'x' }]))).toBe(0);
  });
});

describe('keystroke sound menus', () => {
  const mine = newRecipeSound('Marble tap');
  const sample = { ...newRecipeSound('My recording'), type: 'sample' as const };
  it('shows built-ins, then your own sounds, with Off last', () => {
    const ids = keystrokeOptions([mine]).map(o => o.id);
    expect(ids.slice(0, BUILT_IN_KEYSTROKES.length)).toEqual(BUILT_IN_KEYSTROKES.map(b => b.id));
    expect(ids).toContain(mine.id);
    expect(ids[ids.length - 1]).toBe('off');
    expect(ids.indexOf(mine.id)).toBeLessThan(ids.indexOf('off'));
  });
  it('uses the sound\'s name, not its id', () => {
    expect(keystrokeOptions([mine]).find(o => o.id === mine.id)!.label).toBe('Marble tap');
    expect(keystrokeLabel(mine.id, [mine])).toBe('Marble tap');
    expect(keystrokeLabel('typewriter')).toBe('Vintage Typewriter');
    expect(keystrokeLabel('off')).toBe('Off');
  });
  it('never shows a raw id, even for a sound that has been deleted', () => {
    expect(keystrokeLabel('custom-abc123', [])).toBe('Custom sound');
  });
  it('marks recordings differently from built sounds', () => {
    const icons = keystrokeOptions([mine, sample]).filter(o => o.id === mine.id || o.id === sample.id).map(o => o.icon);
    expect(new Set(icons).size).toBe(2);
  });
  it('has no duplicate entries', () => {
    const ids = keystrokeOptions([mine]).map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
