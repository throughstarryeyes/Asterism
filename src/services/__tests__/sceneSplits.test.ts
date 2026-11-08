import { describe, it, expect } from 'vitest';
import { extractNarrativeUnits } from '../storyAnalyzer';
import { autoScaleFor } from '../../components/Common/useAutoScale';

const words = (n: number, w = 'word') => Array.from({ length: n }, () => w).join(' ');
const chapter = (id: string, order: number, content: string) => ({ id, title: `Chapter ${order}`, content, order } as never);

describe('scene splits in the analyzer', () => {
  it('splits a chaptered document at its scene dividers', () => {
    const html = `<p>${words(40)}</p><p>* * *</p><p>${words(40)}</p>`;
    const units = extractNarrativeUnits({ chapters: [chapter('a', 0, html), chapter('b', 1, `<p>${words(40)}</p>`)], storyBible: { characters: [] }, draftMode: 'chapters' } as never);
    expect(units).toHaveLength(3);
    expect(units.slice(0, 2).every(u => u.originalChapterId === 'a')).toBe(true);
  });

  it('keeps a short scrap with the scene before it instead of dropping it', () => {
    const html = `<p>${words(40)}</p><hr><p>${words(5)}</p><hr><p>${words(40)}</p>`;
    const units = extractNarrativeUnits({ chapters: [chapter('a', 0, html)], storyBible: { characters: [] }, draftMode: 'open_draft' } as never);
    expect(units).toHaveLength(2);
    expect(units[0].plainText).toContain('word');
    expect(units[0].words).toBe(45);
  });
});

describe('auto scale', () => {
  it('leaves tablets and desktops alone', () => {
    expect(autoScaleFor(1280, 800)).toBe(1);
    expect(autoScaleFor(800, 1280)).toBe(1);
  });
  it('shrinks phones by their short side in either orientation', () => {
    expect(autoScaleFor(360, 800)).toBeCloseTo(autoScaleFor(800, 360));
    expect(autoScaleFor(360, 800)).toBeLessThan(1);
    expect(autoScaleFor(200, 800)).toBeGreaterThanOrEqual(0.78);
  });
});
