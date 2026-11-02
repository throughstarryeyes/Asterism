import { describe, it, expect } from 'vitest';
import { buildStoryContext } from '../storyAnalyzer';
import { buildEntityIndex, type CoachUnit } from '../coach/entities';
import type { Chapter, StoryBible } from '../../types';

const bible: StoryBible = { characters: [], locations: [], lore: [] };
const chapters = (...texts: string[]): Chapter[] =>
  texts.map((t, i) => ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: `<p>${t}</p>`, status: 'draft', wordCount: 0, updatedAt: '' }));

describe('reading the story once', () => {
  const text = ['Mara walked to the docks. Elias was already waiting.', 'Elias said nothing. Mara waited.'];

  it('gives the same reading back while nothing it depends on has changed', () => {
    const chaps = chapters(...text);
    const first = buildStoryContext({ chapters: chaps, storyBible: bible, draftMode: 'chaptered' });
    expect(buildStoryContext({ chapters: chaps, storyBible: bible, draftMode: 'chaptered' })).toBe(first);
    // callers build a fresh object each time, so the match is on what is inside it
    expect(buildStoryContext({ chapters: chaps, storyBible: bible, draftMode: 'chaptered', memoryVault: undefined })).toBe(first);
  });

  it('reads again when the text, the bible, the mode or the cast rules change', () => {
    const chaps = chapters(...text);
    const first = buildStoryContext({ chapters: chaps, storyBible: bible, draftMode: 'chaptered' });
    expect(buildStoryContext({ chapters: chapters(...text), storyBible: bible, draftMode: 'chaptered' })).not.toBe(first);
    expect(buildStoryContext({ chapters: chaps, storyBible: { ...bible }, draftMode: 'chaptered' })).not.toBe(first);
    expect(buildStoryContext({ chapters: chaps, storyBible: bible, draftMode: 'open_draft' })).not.toBe(first);
    const rule = { id: 'p', check: 'cast', scope: 'project' as const, enabled: true, createdAt: '', kind: 'not-character' as const, subject: 'Elias' };
    const withRule = buildStoryContext({ chapters: chaps, storyBible: bible, draftMode: 'chaptered', memoryVault: { preferences: [rule] } });
    expect(withRule).not.toBe(first);
    expect(withRule.index.entities.some(e => e.canonical === 'Elias')).toBe(false);
  });

  it('finds the same people the second time from what it remembered', () => {
    const unit = (i: number, t: string): CoachUnit => ({ id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: t });
    const units = text.map((t, i) => unit(i, t));
    const names = (u: CoachUnit[]) => buildEntityIndex(u).entities.map(e => `${e.canonical}:${e.mentions.length}`).sort();
    expect(names(units)).toEqual(names(units));
    expect(names(units).join()).toMatch(/Mara/);
  });

  it('still finds a name that starts sentences, and passes over sentences with no name', () => {
    const units: CoachUnit[] = [{ id: 'u0', index: 0, title: 'One', chapterId: 'c0', plainText: 'The rain fell. He did not look up. She waited at the door. Elias said nothing. Elias left.' }];
    const found = buildEntityIndex(units).entities.map(e => e.canonical);
    expect(found).toContain('Elias');
    expect(found.some(n => ['The', 'He', 'She'].includes(n))).toBe(false);
  });
});
