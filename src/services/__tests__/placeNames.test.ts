import { describe, it, expect } from 'vitest';
import { whereAndKnowsFindings } from '../whereKnows';
import type { FactUnit } from '../characterFacts';

const characters = [{ name: 'Mara', pattern: /\bMara\b/gi }];
const scenes = (...texts: string[]): FactUnit[] =>
  texts.map((text, i) => ({ index: i, title: `Scene ${i + 1}`, chapterId: `c${i}`, sentences: text.split(/(?<=[.!?])\s+/).filter(Boolean) }));
const bible = { characters: [], locations: [], lore: [] };

describe('a place by its other names', () => {
  const units = scenes(
    'Mara left for the Keep at first light. The fog was thick.',
    'Mara stood in the Orchard, in the long grass. The Orchard smelled of apples.',
  );
  const run = (locations: Array<{ name: string; aliases?: string[] }>) => whereAndKnowsFindings({ units, characters, locations, bible, timeline: [] });

  it('follows someone who leaves for “the Keep” when the Bible calls it Greywatch Keep', () => {
    const found = run([{ name: 'Greywatch Keep', aliases: ['the Keep'] }, { name: 'the Orchard' }]);
    expect(found).toHaveLength(1);
    expect(found[0].title).toContain('Mara set out for Greywatch Keep');
  });

  it('cannot follow it without the other name', () => {
    expect(run([{ name: 'Greywatch Keep' }, { name: 'the Orchard' }])).toEqual([]);
  });
});
