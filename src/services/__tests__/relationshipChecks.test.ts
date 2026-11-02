import { describe, it, expect } from 'vitest';
import { whereAndKnowsFindings } from '../whereKnows';
import { performStoryAnalysis } from '../storyAnalyzer';
import type { FactUnit } from '../characterFacts';
import type { CharacterProfile, Project, StoryBible } from '../../types';

const NAMES = ['Mara', 'Dana', 'Corin'];
const characters = NAMES.map(name => ({ name, pattern: new RegExp(`\\b${name}\\b`, 'gi') }));
const scenes = (...texts: string[]): FactUnit[] =>
  texts.map((text, i) => ({ index: i, title: `Scene ${i + 1}`, chapterId: `c${i}`, sentences: text.split(/(?<=[.!?])\s+/).filter(Boolean) }));

const card = (name: string, over: Partial<CharacterProfile> = {}): CharacterProfile => ({
  id: name, name, role: 'supporting', coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription: '', theSecret: '', relationships: [], ...over,
});
const bibleOf = (...cards: CharacterProfile[]): StoryBible => ({ characters: cards, locations: [], lore: [] });
const tie = (target: string, types: string[]): CharacterProfile['relationships'] => [{ targetCharacterId: target, targetName: target, relationshipType: '', notes: '', types }];

describe('relationships and the knowledge check', () => {
  const secret = 'Corin poisoned the old governor and buried the ledger beneath the orchard.';
  const filler = 'The market was loud and the rain would not stop.';
  const told = scenes('Mara walked the market. ' + filler, 'Dana frowned. "He poisoned the governor and buried the ledger," Mara said.');
  const ids = (bible: StoryBible) => whereAndKnowsFindings({ units: told, characters, locations: [], bible, timeline: [] }).map(f => f.id);

  it('does not ask how a close relation knows, but still asks about a stranger', () => {
    const corin = card('Corin', { theSecret: secret });
    expect(ids(bibleOf(corin, card('Mara', { relationships: tie('Corin', ['familial']) })))).toEqual([]);
    expect(ids(bibleOf({ ...corin, relationships: tie('Mara', ['romantic']) }, card('Mara')))).toEqual([]);
    expect(ids(bibleOf(corin, card('Mara', { relationships: tie('Corin', ['acquaintance']) })))).toEqual(['finding-knows-mara-corin']);
    expect(ids(bibleOf(corin, card('Mara')))).toEqual(['finding-knows-mara-corin']);
  });

  it('still asks when the writer said a close relation must not know', () => {
    const corin = card('Corin', { theSecret: secret, secretHiddenFrom: ['Mara'] });
    expect(ids(bibleOf(corin, card('Mara', { relationships: tie('Corin', ['familial']) })))).toEqual(['finding-knows-mara-corin']);
  });
});

describe('relationships and places in a whole scan', () => {
  const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';
  const project = (texts: string[], bible: StoryBible): Project => ({
    id: 'p', title: 'T', author: 'A', genre: '', synopsis: '', draftMode: 'chaptered',
    chapters: texts.map((t, i) => ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: `<p>${t}</p>`, status: 'draft', wordCount: 0, updatedAt: '' })),
    storyBible: bible, plotThreads: [], reflections: [], goals: [], comments: [], findings: [],
    memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false } },
  } as unknown as Project);
  const found = (p: Project, prefix: string) => performStoryAnalysis(p).findings.filter(f => f.id.startsWith(prefix));

  const mara = (over: Partial<CharacterProfile> = {}) => card('Mara', { coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'doubt', ...over });
  const corin = (over: Partial<CharacterProfile> = {}) => card('Corin', { coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'doubt', ...over });
  const apart = ['Mara walked the pier.', 'Corin walked the pier.', 'Mara walked the pier.', 'Corin walked the pier.', 'Mara walked the pier.', 'Corin walked the pier.'].map(t => `${t} ${quiet}`);
  const together = Array.from({ length: 6 }, () => `Mara and Corin walked the pier. ${quiet}`);

  it('notices related characters who are almost never in a scene together', () => {
    const siblings = bibleOf(mara({ relationships: tie('Corin', ['familial']) }), corin());
    const out = found(project(apart, siblings), 'finding-develop-apart-');
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Development: Mara and Corin are rarely together');
    expect(out[0].summary).toContain('family');
    expect(out[0].linkedFoundationCardId).toMatch(/^faultline-\d+$/);
  });

  it('is quiet when they share scenes, or when nothing ties them, or the tie is a loose one', () => {
    expect(found(project(together, bibleOf(mara({ relationships: tie('Corin', ['familial']) }), corin())), 'finding-develop-apart-')).toEqual([]);
    expect(found(project(apart, bibleOf(mara(), corin())), 'finding-develop-apart-')).toEqual([]);
    expect(found(project(apart, bibleOf(mara({ relationships: tie('Corin', ['acquaintance']) }), corin())), 'finding-develop-apart-')).toEqual([]);
  });

  it('keeps places and groups out of the cast, and asks about ones the draft never uses', () => {
    const bible: StoryBible = {
      characters: [mara()],
      locations: [{ id: 'l1', name: 'Greywatch Keep', type: '', atmosphere: '', sensoryDetails: '', significance: '', aliases: ['the Keep'] }],
      lore: [{ id: 'g1', title: 'The Guild of Clocks', category: 'faction', content: '' }],
    };
    const texts = Array.from({ length: 5 }, () => `Mara spoke with the Guild of Clocks. ${quiet}`);
    const scan = performStoryAnalysis(project(texts, bible));
    expect(scan.findings.some(f => f.id === 'finding-world-lore-the-guild-of-clocks')).toBe(false);
    expect(scan.findings.some(f => f.id === 'finding-world-place-greywatch-keep')).toBe(true);
    const named = performStoryAnalysis(project(texts.map(t => `${t} She reached the Keep.`), bible));
    expect(named.findings.some(f => f.id === 'finding-world-place-greywatch-keep')).toBe(false);
  });
});
