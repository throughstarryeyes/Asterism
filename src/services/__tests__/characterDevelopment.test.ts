import { describe, it, expect } from 'vitest';
import { performStoryAnalysis } from '../storyAnalyzer';
import { checkOf } from '../analyzerFeedback';
import { CARD } from '../characterDevelopment';
import { MUSE_FOUNDATION_CARDS } from '../../data/museFoundations';
import type { CardReflection, CharacterProfile, Project } from '../../types';

const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';

const card = (over: Partial<CharacterProfile>): CharacterProfile => ({
  id: over.name?.toLowerCase() ?? 'x', name: 'Mara', role: 'protagonist', coreDesire: '', fatalFlaw: '', internalConflict: '',
  physicalDescription: '', theSecret: '', relationships: [], ...over,
});

const story = (scenes: string[], characters: CharacterProfile[], reflections: CardReflection[] = []): Project => ({
  id: 'p', title: 'T', author: 'A', genre: '', synopsis: '', draftMode: 'chaptered',
  chapters: scenes.map((s, i) => ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: `<p>${s}</p>`, status: 'draft', wordCount: 0, updatedAt: '' })),
  storyBible: { characters, locations: [], lore: [] }, plotThreads: [], reflections, goals: [], comments: [], findings: [],
  memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false } },
} as unknown as Project);

const develop = (p: Project) => performStoryAnalysis(p).findings.filter(f => f.id.startsWith('finding-develop-'));
const kinds = (p: Project) => develop(p).map(f => f.id.split('-')[2]);

const plain = Array.from({ length: 5 }, () => `Mara walked to the pier. ${quiet}`);

describe('character development suggestions', () => {
  it('asks about what a major character’s card leaves out, and links the matching card', () => {
    const out = develop(story(plain, [card({ coreDesire: '', fatalFlaw: 'pride', internalConflict: 'trust against fear' })]));
    const gap = out.find(f => f.id.startsWith('finding-develop-card-'))!;
    expect(gap.title).toContain('what they want');
    expect(gap.linkedFoundationCardId).toBe(CARD.want);
    expect(gap.category).toBe('expansion');
    expect(gap.confidence).toBe('possible_exploration');
    expect(gap.subject).toBe('Mara');
    expect(MUSE_FOUNDATION_CARDS.some(c => c.id === gap.linkedFoundationCardId)).toBe(true);
  });

  it('leaves a minor character’s card alone', () => {
    expect(kinds(story(plain, [card({ role: 'minor' })]))).not.toContain('card');
  });

  it('notices a want the scenes never show, and stops once it appears', () => {
    const mara = card({ coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'trust against fear' });
    expect(kinds(story(plain, [mara]))).toContain('want');

    const shown = [...plain.slice(0, 4), `Mara searched for the lighthouse key. ${quiet}`];
    expect(kinds(story(shown, [mara]))).not.toContain('want');
  });

  it('looks for a flaw and an inner conflict the same way', () => {
    const mara = card({ coreDesire: 'find the lighthouse key', fatalFlaw: 'reckless stubborn pride', internalConflict: 'duty against loyalty' });
    const found = kinds(story(plain, [mara]));
    expect(found).toContain('flaw');
    expect(found).toContain('conflict');
    const shown = [...plain.slice(0, 3), `Mara’s stubborn pride cost her again. ${quiet}`, `Mara felt duty pulled against loyalty. ${quiet}`];
    expect(kinds(story(shown, [mara]))).not.toContain('flaw');
  });

  it('does not ask about a want it has too little to look for', () => {
    expect(kinds(story(plain, [card({ coreDesire: 'peace', fatalFlaw: 'pride', internalConflict: 'doubt' })]))).not.toContain('want');
  });

  it('offers a card when two people share scenes with no relationship written down', () => {
    const scenes = Array.from({ length: 4 }, () => `Mara and Corin walked to the pier. ${quiet}`);
    const people = [card({ name: 'Mara', coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'doubt' }), card({ name: 'Corin', id: 'corin', role: 'supporting' })];
    const pair = develop(story(scenes, people)).find(f => f.id.startsWith('finding-develop-pair-'))!;
    expect(pair.title).toBe('Development: Mara and Corin');
    expect(pair.linkedFoundationCardId).toMatch(/^faultline-\d+$/);
    expect(MUSE_FOUNDATION_CARDS.some(c => c.id === pair.linkedFoundationCardId)).toBe(true);

    const related = [{ ...people[0], relationships: [{ targetCharacterId: 'corin', targetName: 'Corin', relationshipType: 'friend', notes: '' }] }, people[1]];
    expect(develop(story(scenes, related)).some(f => f.id.startsWith('finding-develop-pair-'))).toBe(false);
  });

  it('stays quiet about what the writer has already thought about', () => {
    const mara = card({ id: 'mara', coreDesire: '', fatalFlaw: 'pride', internalConflict: 'doubt' });
    const reflection: CardReflection = { id: 'r', cardId: CARD.want, cardTitle: 'Core Wants', category: 'autopsy', reflectionText: 'She wants to be seen.', linkedCharacterId: 'mara', createdAt: '', updatedAt: '' };
    expect(kinds(story(plain, [mara]))).toContain('card');
    expect(kinds(story(plain, [mara], [reflection]))).not.toContain('card');
  });

  it('keeps a few per character, and groups them as their own kinds of check', () => {
    const mara = card({ coreDesire: '', fatalFlaw: '', internalConflict: '' });
    const out = develop(story(plain, [mara]));
    expect(out.length).toBeLessThanOrEqual(3);
    expect(checkOf(out[0]).check).toBe('develop-card');
  });


  it('asks about a major character whose feelings the reader rarely sees', () => {
    const mara = card({ coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'doubt' });
    expect(kinds(story(plain, [mara]))).toContain('feelings');
    expect(kinds(story(plain, [{ ...mara, role: 'supporting' }]))).not.toContain('feelings');
  });

  it('notices someone who feels one thing all the way through', () => {
    const afraid = Array.from({ length: 5 }, () => `Mara was afraid of the dark. Mara trembled with fear. ${quiet}`);
    const mara = card({ coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'doubt' });
    const found = develop(story(afraid, [mara])).find(f => f.id.startsWith('finding-develop-range-'));
    expect(found?.summary).toMatch(/Nearly every feeling/);
    expect(found?.linkedFoundationCardId).toBe(CARD.range);
  });

  it('asks about a voice when someone talks a lot and the card says nothing about it', () => {
    const talking = Array.from({ length: 4 }, () => `"Come along," Mara said. "Hurry up," Mara said. ${quiet}`);
    const mara = card({ coreDesire: 'find the lighthouse key', fatalFlaw: 'pride', internalConflict: 'doubt' });
    expect(kinds(story(talking, [mara]))).toContain('voice');
    expect(kinds(story(talking, [{ ...mara, speechPattern: 'clipped and bossy' }]))).not.toContain('voice');
  });

  it('says nothing without a Story Bible', () => {
    expect(develop(story(plain, []))).toEqual([]);
  });
});
