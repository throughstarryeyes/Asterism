import { describe, it, expect } from 'vitest';
import { whereAndKnowsFindings, readWhereAndKnows } from '../whereKnows';
import type { FactUnit } from '../characterFacts';
import type { StoryBible, TimelineEvent } from '../../types';

const NAMES = ['Mara', 'Dana', 'Corin'];
const characters = NAMES.map(name => ({ name, pattern: new RegExp(`\\b${name}\\b`, 'gi') }));
const locations = [{ name: 'the Harbor' }, { name: 'Greywatch Keep' }, { name: 'the Orchard' }];

const scenes = (...texts: string[]): FactUnit[] =>
  texts.map((text, i) => ({ index: i, title: `Scene ${i + 1}`, chapterId: `c${i}`, sentences: text.split(/(?<=[.!?])\s+/).filter(Boolean) }));

const bibleWith = (name: string, theSecret: string): StoryBible => ({
  characters: [{ id: name, name, role: 'supporting', coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription: '', theSecret, relationships: [] }],
  locations: [], lore: [],
});
const noBible: StoryBible = { characters: [], locations: [], lore: [] };
const event = (id: string, when: string, chapterId: string): TimelineEvent => ({ id, title: id, when, chapterId, createdAt: '' });

const run = (units: FactUnit[], extra: { bible?: StoryBible; timeline?: TimelineEvent[] } = {}) =>
  whereAndKnowsFindings({ units, characters, locations, bible: extra.bible ?? noBible, timeline: extra.timeline ?? [] });
const ids = (units: FactUnit[], extra = {}) => run(units, extra).map(f => f.id);

describe('who is where', () => {
  const left = 'Mara left for the Harbor at first light. The fog was thick.';
  const keep = 'Mara stood in Greywatch Keep, in the cold great hall. She watched the door at Greywatch Keep.';

  it('asks when someone sets out for a place and the next scene has them elsewhere', () => {
    const found = run(scenes(left, keep));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ category: 'continuity', confidence: 'possible_exploration' });
    expect(found[0].title).toContain('Mara set out for the Harbor');
    expect(found[0].summary).toContain('nothing says they came back');
    expect(found[0].evidencePassages).toHaveLength(2);
  });

  it('is quiet when the scene shows the journey or the return', () => {
    expect(ids(scenes(left, 'Mara rode back to Greywatch Keep. Mara stood in Greywatch Keep, in the great hall.'))).toEqual([]);
    expect(ids(scenes(left, 'Mara reached the Harbor. Mara stood in the Harbor, watching the water in the Harbor.'))).toEqual([]);
  });

  it('is quiet when the next scene is at the place she went to, or does not show her', () => {
    expect(ids(scenes(left, 'Mara walked along the dock, in the Harbor. The Harbor was loud.'))).toEqual([]);
    expect(ids(scenes(left, 'Dana stood in Greywatch Keep, in the great hall. Greywatch Keep was cold.'))).toEqual([]);
  });

  it('does not count someone merely talked about', () => {
    expect(ids(scenes(left, 'Dana stood in Greywatch Keep, in the hall. "Where is Mara?" she asked about Mara. Greywatch Keep was silent.'))).toEqual([]);
  });

  it('leaves a long gap, or a flashback, alone', () => {
    expect(ids(scenes(left, 'Dana waited.', 'Corin waited.', 'Dana waited.', keep))).toEqual([]);
    expect(ids(scenes(left, 'Mara remembered the night in Greywatch Keep. She dreamed of Greywatch Keep, in the great hall.'))).toEqual([]);
  });

  it('uses dates: close dates are firmer, days apart let her have come home', () => {
    const units = scenes(left, keep);
    const close = run(units, { timeline: [event('a', 'June 1st, 2017', 'c0'), event('b', 'June 2nd, 2017', 'c1')] });
    expect(close[0].confidence).toBe('probable');
    expect(close[0].summary).toContain('1 day apart');
    expect(run(units, { timeline: [event('a', 'June 1st, 2017', 'c0'), event('b', 'June 20th, 2017', 'c1')] })).toEqual([]);
    expect(run(units, { timeline: [event('a', 'June 9th, 2017', 'c0'), event('b', 'June 1st, 2017', 'c1')] })).toEqual([]);
  });

  it('applies a movement to everyone named in it', () => {
    const found = run(scenes('Mara and Dana left for the Harbor.', keep));
    expect(found).toHaveLength(1);
    expect(found[0].title).toContain('Mara');
    const both = run(scenes('Mara and Dana left for the Harbor.', 'Mara and Dana stood in Greywatch Keep, in the hall. Greywatch Keep was cold.'));
    expect(both).toHaveLength(2);
  });
});

describe('what the scan read, and what the writer set aside', () => {
  const left = 'Mara left for the Harbor at first light. The fog was thick.';
  const keep = 'Mara stood in Greywatch Keep, in the cold great hall. She watched the door at Greywatch Keep.';
  const src = (units: FactUnit[], extra: { bible?: StoryBible; ignored?: string[] } = {}) =>
    ({ units, characters, locations, bible: extra.bible ?? noBible, timeline: [], ignored: extra.ignored });

  it('lists where each character was, in reading order, with the passage', () => {
    const { places } = readWhereAndKnows(src(scenes(left, keep)));
    expect(places.map(p => `${p.character}:${p.how}:${p.place}`)).toEqual(['Mara:set out for:the Harbor', 'Mara:seen in:Greywatch Keep']);
    expect(places[0]).toMatchObject({ chapterTitle: 'Scene 1', ignored: false });
    expect(places[0].quote).toContain('left for the Harbor');
  });

  it('stops asking about a journey the writer set aside, but still lists it', () => {
    const units = scenes(left, keep);
    const departure = readWhereAndKnows(src(units)).places[0];
    expect(whereAndKnowsFindings(src(units))).toHaveLength(1);
    const aside = src(units, { ignored: [departure.id] });
    expect(whereAndKnowsFindings(aside)).toEqual([]);
    expect(readWhereAndKnows(aside).places.find(p => p.id === departure.id)?.ignored).toBe(true);
  });

  it('shows how each character comes to know a secret, and honors a set-aside', () => {
    const secret = 'Corin poisoned the old governor and buried the ledger beneath the orchard.';
    const bible = bibleWith('Corin', secret);
    const units = scenes('Dana told Mara that Corin had poisoned the governor and buried the ledger. The rain would not stop.', '"He poisoned the governor and buried the ledger," Mara said.');
    const { knowledge } = readWhereAndKnows(src(units, { bible }));
    expect(knowledge.map(k => `${k.character}:${k.how}`)).toEqual(expect.arrayContaining(['Corin:owner', 'Mara:learned', 'Mara:spoke']));
    expect(whereAndKnowsFindings(src(units, { bible }))).toEqual([]);

    // she was also in the scene where it came up, so setting aside only "told" changes nothing.
    const told = knowledge.find(k => k.how === 'learned')!;
    expect(whereAndKnowsFindings(src(units, { bible, ignored: [told.id] }))).toEqual([]);

    // set both aside and the question comes back.
    const both = knowledge.filter(k => k.character === 'Mara' && (k.how === 'learned' || k.how === 'there')).map(k => k.id);
    expect(both).toHaveLength(2);
    const after = src(units, { bible, ignored: both });
    expect(whereAndKnowsFindings(after).map(f => f.id)).toEqual(['finding-knows-mara-corin']);
    expect(readWhereAndKnows(after).knowledge.find(k => k.id === told.id)?.ignored).toBe(true);
  });
});

describe('what they know', () => {
  const secret = 'Corin poisoned the old governor and buried the ledger beneath the orchard.';
  const bible = bibleWith('Corin', secret);
  const filler = 'The market was loud and the rain would not stop.';

  it('asks how someone knows a secret nobody told them', () => {
    const found = run(scenes(
      'Mara walked the market. ' + filler,
      'Dana frowned at the sky. "He poisoned the governor and buried the ledger," Mara said.',
    ), { bible });
    expect(found.map(f => f.id)).toEqual(['finding-knows-mara-corin']);
    expect(found[0]).toMatchObject({ confidence: 'possible_exploration', category: 'continuity' });
    expect(found[0].summary).toContain('being told');
  });

  it('is quiet once they were in a scene where it came up, or were told', () => {
    expect(ids(scenes(
      'Corin confessed to Mara. "I poisoned the governor and buried the ledger," Corin said. ' + filler,
      '"He poisoned the governor and buried the ledger," Mara said.',
    ), { bible })).toEqual([]);
    expect(ids(scenes(
      'Dana told Mara that Corin had poisoned the governor and buried the ledger. ' + filler,
      '"He poisoned the governor and buried the ledger," Mara said.',
    ), { bible })).toEqual([]);
    expect(ids(scenes(
      'Mara discovered that Corin poisoned the governor and buried the ledger. ' + filler,
      '"He poisoned the governor and buried the ledger," Mara said.',
    ), { bible })).toEqual([]);
  });

  it('never questions the owner of the secret, a question, or a guess', () => {
    expect(ids(scenes(filler, '"I poisoned the governor and buried the ledger," Corin said.'), { bible })).toEqual([]);
    expect(ids(scenes(filler, '"Did he poison the governor and bury the ledger?" Mara asked.'), { bible })).toEqual([]);
    expect(ids(scenes(filler, '"Maybe he poisoned the governor and buried the ledger," Mara said.'), { bible })).toEqual([]);
    expect(ids(scenes(filler, '"The weather poisoned the harvest," Mara said.'), { bible })).toEqual([]);
  });

  it('notices someone who "learns" what they already used', () => {
    const found = run(scenes(
      'Mara paced. "He poisoned the governor and buried the ledger," Mara said. ' + filler,
      filler,
      'Dana found Mara. Mara learned that Corin poisoned the governor and buried the ledger.',
    ), { bible });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: 'finding-knows-mara-corin', confidence: 'probable' });
    expect(found[0].title).toContain('already knew');
    expect(found[0].evidencePassages).toHaveLength(2);
  });

  it('attributes a quote to the speaker named in the next sentence, and to nobody when none is', () => {
    expect(run(scenes(filler, '"He poisoned the governor and buried the ledger!" Dana pointed at the door. Mara said nothing.'), { bible })).toEqual([]);
    const named = run(scenes(filler, '"He poisoned the governor and buried the ledger!" Dana shouted.'), { bible });
    expect(named.map(f => f.id)).toEqual(['finding-knows-dana-corin']);
  });

  it('trusts the card: a marked knower is never asked, a "must not know" is firmer', () => {
    const say = scenes(filler, '"He poisoned the governor and buried the ledger," Mara said.');
    const card = (extra: object): StoryBible => ({
      ...bible,
      characters: [
        { ...bible.characters[0], id: 'corin', ...extra },
        { ...bible.characters[0], id: 'mara', name: 'Mara', theSecret: '' },
      ],
    });
    expect(ids(say, { bible: card({ secretKnownBy: ['mara'] }) })).toEqual([]);
    const hidden = run(say, { bible: card({ secretHiddenFrom: ['mara'] }) });
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toMatchObject({ confidence: 'probable' });
    expect(hidden[0].summary).toContain('must not know');
    expect(ids(scenes('Dana told Mara that Corin had poisoned the governor and buried the ledger. ' + filler, say[1].sentences.join(' ')), { bible: card({ secretHiddenFrom: ['mara'] }) })).toEqual([]);
  });

  it('checks secrets that belong to no one character, and exempts nobody as the owner', () => {
    const free = (extra: object): StoryBible => ({
      ...noBible,
      characters: [{ ...bibleWith('Mara', '').characters[0], id: 'mara', name: 'Mara' }],
      secrets: [{ id: 's1', text: 'The treaty was forged and the seal stolen from the archive.', knownBy: [], hiddenFrom: [], ...extra }],
    });
    const say = scenes(filler, '"The treaty was forged, the seal stolen from the archive," Mara said.');
    const found = run(say, { bible: free({}) });
    expect(found.map(f => f.id)).toEqual(['finding-knows-mara-secret-s1']);
    expect(found[0].title).toContain('the secret “The treaty was forged');
    expect(ids(say, { bible: free({ knownBy: ['mara'] }) })).toEqual([]);
    expect(run(say, { bible: free({ hiddenFrom: ['mara'] }) })[0].confidence).toBe('probable');
    expect(ids(say, { bible: { ...free({}), secrets: [] } })).toEqual([]);
  });

  it('needs a secret with something distinctive in it', () => {
    expect(ids(scenes(filler, '"He did it," Mara said.'), { bible: bibleWith('Corin', 'He is hiding something.') })).toEqual([]);
    expect(ids(scenes(filler, '"He did it," Mara said.'))).toEqual([]);
  });
});

describe('two places on the same day', () => {
  const orchard = 'Mara stood in the Orchard, in the long grass. The Orchard smelled of apples.';
  const keep = 'Mara stood in Greywatch Keep, in the cold great hall. She watched the door at Greywatch Keep.';
  const sameDay = [event('a', 'June 1st, 2017', 'c0'), event('b', 'June 1st, 2017', 'c1')];
  const sameDayIds = (units: FactUnit[], timeline = sameDay) => ids(units, { timeline }).filter(id => id.startsWith('finding-where-sameday-'));

  it('asks when someone is in two places on one dated day with no sign of travel', () => {
    const found = run(scenes(orchard, keep), { timeline: sameDay });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ category: 'continuity', confidence: 'possible_exploration', subject: 'Mara' });
    expect(found[0].title).toBe('Where: Mara in the Orchard, then Greywatch Keep the same day');
    expect(found[0].summary).toContain('the same day');
    expect(found[0].evidencePassages).toHaveLength(2);
  });

  it('is quiet on different days, with no dates, or in the same place', () => {
    expect(sameDayIds(scenes(orchard, keep), [event('a', 'June 1st, 2017', 'c0'), event('b', 'June 2nd, 2017', 'c1')])).toEqual([]);
    expect(sameDayIds(scenes(orchard, keep), [])).toEqual([]);
    expect(sameDayIds(scenes(orchard, 'Mara waited in the Orchard, in the long grass. The Orchard was quiet.'))).toEqual([]);
  });

  it('is quiet when the scene shows time passing or a trip', () => {
    expect(sameDayIds(scenes(orchard, `Hours later, ${keep}`))).toEqual([]);
    expect(sameDayIds(scenes(orchard, `Mara rode through the dusk. ${keep}`))).toEqual([]);
    expect(sameDayIds(scenes(orchard, `That evening, ${keep}`))).toEqual([]);
  });

  it('is quiet when the scenes are far apart, or the person is not in both', () => {
    expect(sameDayIds(scenes(orchard, 'Dana waited.', 'Corin waited.', 'Dana waited.', keep), [event('a', 'June 1st, 2017', 'c0'), event('b', 'June 1st, 2017', 'c3')])).toEqual([]);
    expect(sameDayIds(scenes(orchard, 'Dana stood in Greywatch Keep, in the cold hall. Greywatch Keep was silent.'))).toEqual([]);
  });

  it('does not repeat a question the trip check already asked', () => {
    const left = 'Mara left for the Harbor at first light. The fog was thick.';
    const found = run(scenes(left, keep), { timeline: sameDay });
    expect(found).toHaveLength(1);
    expect(found[0].id).not.toContain('sameday');
  });

  it('lets the writer set it aside by setting aside where she was seen', () => {
    const units = scenes(orchard, keep);
    const src = (ignored: string[] = []) => ({ units, characters, locations, bible: noBible, timeline: sameDay, ignored });
    const seen = readWhereAndKnows(src()).places.find(p => p.place === 'Greywatch Keep')!;
    expect(whereAndKnowsFindings(src())).toHaveLength(1);
    expect(whereAndKnowsFindings(src([seen.id]))).toEqual([]);
  });

  it('tells scenes apart inside one chapter, as in an open draft', () => {
    // three scenes share a chapter; each event's quote says which scene it belongs to
    const open: FactUnit[] = [orchard, keep, orchard].map((text, i) => ({ index: i, title: `Scene ${i + 1}`, chapterId: 'only', sentences: text.split(/(?<=[.!?])\s+/) }));
    const dated = (id: string, when: string, quote: string): TimelineEvent => ({ id, title: id, when, chapterId: 'only', quote, createdAt: '' });
    const sameTimeline = [dated('a', 'June 1st, 2017', 'Mara stood in the Orchard, in the long grass'), dated('b', 'June 1st, 2017', 'Mara stood in Greywatch Keep, in the cold great hall')];
    expect(sameDayIds(open.slice(0, 2), sameTimeline)).toHaveLength(1);
    const laterTimeline = [sameTimeline[0], dated('b', 'June 5th, 2017', 'Mara stood in Greywatch Keep, in the cold great hall')];
    expect(sameDayIds(open.slice(0, 2), laterTimeline)).toEqual([]);
    // an event with no quote cannot be placed among several scenes
    expect(sameDayIds(open.slice(0, 2), [{ ...sameTimeline[0], quote: undefined }, { ...sameTimeline[1], quote: undefined }])).toEqual([]);
  });
});
