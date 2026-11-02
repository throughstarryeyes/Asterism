import { describe, it, expect } from 'vitest';
import { characterContinuityFindings, readCharacterFacts, type FactUnit } from '../characterFacts';
import type { StoryBible, TimelineEvent } from '../../types';

const NAMES = ['Mara', 'Dana', 'Corin'];
const characters = NAMES.map(name => ({ name, pattern: new RegExp(`\\b${name}\\b`, 'gi') }));
const lexicon = { eyeColors: ['blue', 'green', 'brown', 'hazel', 'grey'], hairColors: ['black', 'brown', 'red', 'blonde', 'silver'] };
const noBible: StoryBible = { characters: [], locations: [], lore: [] };

// one scene per entry; sentences split on full stops.
const scenes = (...texts: string[]): FactUnit[] =>
  texts.map((text, i) => ({ index: i, title: `Scene ${i + 1}`, chapterId: `c${i}`, sentences: text.split(/(?<=[.!?])\s+/).filter(Boolean) }));

const run = (units: FactUnit[], extra: { bible?: StoryBible; timeline?: TimelineEvent[] } = {}) =>
  characterContinuityFindings({ units, characters, lexicon, bible: extra.bible ?? noBible, timeline: extra.timeline ?? [] });
const ids = (units: FactUnit[], extra = {}) => run(units, extra).map(f => f.id);

const bibleWith = (name: string, physicalDescription: string): StoryBible => ({
  characters: [{ id: name, name, role: 'protagonist', coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription, theSecret: '', relationships: [] }],
  locations: [], lore: []
});
const event = (id: string, when: string, chapterId: string): TimelineEvent => ({ id, title: id, when, chapterId, createdAt: '' });

describe('eye and hair color', () => {
  it('flags a color that changes, owned by the right person', () => {
    const found = run(scenes('Mara looked up. Her green eyes were wide.', 'Dana waved. Mara turned, brown eyes narrowed.'));
    expect(found.map(f => f.id)).toEqual(['finding-contradiction-eyes-mara']);
    expect(found[0].title).toContain('green vs brown');
  });

  it('leaves alone a color that holds, and a change someone made', () => {
    expect(ids(scenes('Mara had green eyes.', 'Mara met the stranger with green eyes. Dana had brown eyes.'))).toEqual([]);
    expect(ids(scenes('Mara had brown hair.', 'Mara dyed her hair red.'))).toEqual([]);
    expect(ids(scenes('Mara had green eyes.', 'With the tinted contacts in, Mara had brown eyes.'))).toEqual([]);
  });

  it('checks the page against the Story Bible', () => {
    const found = run(scenes('Mara looked up, her green eyes wide.'), { bible: bibleWith('Mara', 'Tall, with brown eyes and a crooked smile.') });
    expect(found.map(f => f.id)).toEqual(['finding-charfact-bible-eyes-mara']);
    expect(found[0].summary).toContain('Story Bible gives Mara brown eyes');
    expect(ids(scenes('Mara looked up, her brown eyes wide.'), { bible: bibleWith('Mara', 'brown eyes') })).toEqual([]);
  });
});

describe('age', () => {
  it('flags two ages in one scene', () => {
    const found = run(scenes('Mara, 34, sat down. Later Mara was thirty-six years old and tired.'));
    expect(found.map(f => f.id)).toEqual(['finding-charfact-age-mara']);
    expect(found[0]).toMatchObject({ confidence: 'definite', category: 'continuity' });
  });

  it('checks ages against the timeline', () => {
    const units = scenes('Mara, 34, sat down.', 'Mara, 36, stood up.');
    const wrong = run(units, { timeline: [event('a', 'June 1st, 2017', 'c0'), event('b', 'August 1st, 2017', 'c1')] });
    expect(wrong[0]).toMatchObject({ id: 'finding-charfact-age-mara', confidence: 'probable' });
    const right = run(units, { timeline: [event('a', 'June 1st, 2017', 'c0'), event('b', 'August 1st, 2019', 'c1')] });
    expect(right).toEqual([]);
  });

  it('only wonders about an age that goes down when nothing is dated', () => {
    const found = run(scenes('Mara, 34, sat down.', 'Mara, 12, played in the yard.'));
    expect(found[0]).toMatchObject({ confidence: 'possible_exploration' });
    expect(found[0].summary).toContain('flashback');
    expect(ids(scenes('Mara, 34, sat down.', 'Mara, 36, stood up.'))).toEqual([]);
  });

  it('does not take ages from other people, or from things that are not ages', () => {
    expect(ids(scenes('Mara, 34, sat down.', "Mara's mother was fifty. Mara was ten feet away. Dana was twelve."))).toEqual([]);
    expect(ids(scenes('Mara, 34, sat down.', 'When Mara was twelve, she fell from a tree.'))).toEqual([]);
  });

  it('takes "twelve-year-old Mara" and "Mara turned thirty"', () => {
    expect(ids(scenes('The twelve-year-old Mara hid. Mara turned thirty that spring.'))).toEqual(['finding-charfact-age-mara']);
  });
});

describe('hands and marks', () => {
  it('flags left- and right-handed for one person', () => {
    expect(ids(scenes('Mara was left-handed.', 'Mara, right-handed as always, signed it.'))).toEqual(['finding-charfact-hand-mara']);
    expect(ids(scenes('Mara was left-handed.', 'Dana was right-handed.'))).toEqual([]);
  });

  it('flags a scar that changes sides', () => {
    const found = run(scenes('Mara had a scar over her left eyebrow.', 'Mara touched the scar on her right eyebrow.'));
    expect(found.map(f => f.id)).toEqual(['finding-charfact-mark-mara-scar-brow']);
    expect(found[0].confidence).toBe('possible_exploration');
  });

  it('leaves scars on different parts of the body alone', () => {
    expect(ids(scenes('Mara had a scar on her left cheek.', 'Mara showed the scar on her right hand.'))).toEqual([]);
  });
});

describe('someone who dies and then speaks', () => {
  it('flags speech after a death', () => {
    const found = run(scenes('Mara died in the night.', 'Dana wept. Mara said, "Don\'t cry."'));
    expect(found.map(f => f.id)).toEqual(['finding-charfact-death-mara']);
    expect(found[0].summary).toContain('flashback');
  });

  it('knows a funeral, and being killed, as a death', () => {
    expect(ids(scenes("Mara's funeral was on Friday.", 'Mara asked for water.'))).toEqual(['finding-charfact-death-mara']);
    expect(ids(scenes('Dana killed Mara before dawn.', 'Mara whispered a name.'))).toEqual(['finding-charfact-death-mara']);
  });

  it('is quiet about near-deaths, dreams and memories, and speech before the death', () => {
    expect(ids(scenes('Mara almost died of embarrassment.', 'Mara said hello.'))).toEqual([]);
    expect(ids(scenes('Mara said hello.', 'Mara died in the night.'))).toEqual([]);
    expect(ids(scenes('Mara died in the night.', 'Dana dreamed of the harbor. Mara said hello. She was a ghost.'))).toEqual([]);
    expect(ids(scenes('Mara died in the night.', 'Dana remembered how Mara said goodbye.'))).toEqual([]);
  });

  it('lets the timeline show a scene is earlier than the death', () => {
    const units = scenes('Mara died in the night.', 'Mara said hello.');
    const flashback = [event('death', 'June 1st, 2017', 'c0'), event('earlier', 'May 1st, 2017', 'c1')];
    expect(ids(units, { timeline: flashback })).toEqual([]);
  });
});

describe('what the scan read, and what the writer set aside', () => {
  const src = (ignored: string[] = []) => ({
    units: scenes('Mara had green eyes. Dana was thirty-one.', 'Mara looked up, her blue eyes tired.'),
    characters, lexicon, bible: noBible, timeline: [], ignored,
  });

  it('lists every statement with its passage, in reading order', () => {
    const facts = readCharacterFacts(src());
    expect(facts.map(f => `${f.character}:${f.kind}:${f.value}`)).toEqual(['Mara:eyes:green', 'Dana:age:31', 'Mara:eyes:blue']);
    expect(facts[0]).toMatchObject({ chapterTitle: 'Scene 1', ignored: false });
    expect(facts[0].quote).toContain('green eyes');
  });

  it('stops using a statement the writer set aside, and still lists it so it can come back', () => {
    const blue = readCharacterFacts(src()).find(f => f.value === 'blue')!;
    expect(ids(src().units)).toContain('finding-contradiction-eyes-mara');
    const after = { ...src([blue.id]) };
    expect(characterContinuityFindings(after).map(f => f.id)).not.toContain('finding-contradiction-eyes-mara');
    expect(readCharacterFacts(after).find(f => f.id === blue.id)?.ignored).toBe(true);
  });

  it('forgets the correction when the sentence is edited', () => {
    const blue = readCharacterFacts(src()).find(f => f.value === 'blue')!;
    const edited = { ...src([blue.id]), units: scenes('Mara had green eyes.', 'Mara looked up, her blue eyes very tired.') };
    expect(characterContinuityFindings(edited).map(f => f.id)).toContain('finding-contradiction-eyes-mara');
  });
});

describe('death that is not death', () => {
  const people = [{ name: 'Val', pattern: /\bVal\b/gi }, { name: 'Mara', pattern: /\bMara\b/gi }];
  const deaths = (...scenes: string[]) =>
    characterContinuityFindings({
      units: scenes.map((t, i) => ({ index: i, title: `Scene ${i + 1}`, chapterId: `c${i}`, sentences: t.split(/(?<=[.!?])\s+/) })),
      characters: people, lexicon, bible: { characters: [], locations: [], lore: [] }, timeline: [],
    }).filter(f => f.id.startsWith('finding-charfact-death-'));

  it('does not call an embrace a burial or a body a corpse', () => {
    expect(deaths('CJ buried Val into his shoulder.', '"Oh, honey," Val whispered.')).toEqual([]);
    expect(deaths('He pressed Val’s body closer.', '"Oh, honey," Val whispered.')).toEqual([]);
  });

  it('still notices a burial, and a body that is found', () => {
    expect(deaths('They buried Mara beside her mother.', '"Come in," Mara whispered.')).toHaveLength(1);
    expect(deaths('Mara’s body was found at dawn.', '"Come in," Mara whispered.')).toHaveLength(1);
  });
});
