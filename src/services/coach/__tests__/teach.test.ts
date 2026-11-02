import { describe, it, expect } from 'vitest';
import type { CoachUnit } from '../entities';
import { emptyCoachMemory, normalizeCoachMemory } from '../types';
import {
  addRule, addTerms, buildModel, createConcept, deleteConcept, emptyTaught, evaluateRules, labelExample, listSentences,
  matchesOf, ruleNudges, sanitizeTaught, scoreSentence, setRuleEnabled, splitList, stem, suggestTerms, type Taught,
} from '../teach';

const unit = (i: number, text: string): CoachUnit => ({ id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: text });

describe('stemming', () => {
  it('lets word forms meet', () => {
    expect(stem('costs')).toBe(stem('cost'));
    expect(stem('costly')).toBe(stem('cost'));
    expect(stem('draining')).toBe(stem('drain'));
    expect(stem('drained')).toBe(stem('drain'));
    expect(stem('class')).toBe('class');
  });
});

describe('a concept the writer defines with key words', () => {
  const sentences = listSentences([unit(0, 'The price of the spell was her sleep. Mara made tea. The cost was steep.')]);
  const concept = createConcept('A cost', ['cost', 'price']);
  it('matches by key word, in any form', () => {
    const m = matchesOf(concept, sentences);
    expect(m.map(x => x.sentence)).toEqual(['The price of the spell was her sleep.', 'The cost was steep.']);
    expect(m.every(x => x.score.via === 'term')).toBe(true);
  });
  it('matches multi-word phrases', () => {
    const c = createConcept('Reluctance', ['held back']);
    const s = listSentences([unit(0, 'She held back from the door. He walked in.')]);
    expect(matchesOf(c, s)).toHaveLength(1);
  });
  it('finds nothing for a concept with no words and no examples', () => {
    expect(matchesOf(createConcept('Empty'), sentences)).toEqual([]);
  });
});

describe('learning from examples', () => {
  const story = [
    'Casting the spell drained her strength.',
    'Afterwards he was weak and drained from the casting.',
    'Mara made tea and watched the rain.',
    'Elias fixed the roof before dark.',
    'They walked to the market together.',
    'The baker sold bread and honey.',
    'A cold wind came off the harbor.',
    'The strength of the old bridge surprised everyone.',
  ];
  const sentences = listSentences([unit(0, story.join(' '))]);
  const cost = createConcept('A cost', [], ['Casting the spell drained her strength.', 'Afterwards he was weak and drained from the casting.']);

  it('recognizes a new sentence that looks like the examples', () => {
    const model = buildModel(cost, sentences);
    const s = scoreSentence(model, 'The casting drained all her strength again.');
    expect(s.status).toBe('match');
    expect(s.via).toBe('learned');
    expect(s.because.length).toBeGreaterThan(0);
  });
  it('is not fooled by one shared word', () => {
    const model = buildModel(cost, sentences);
    const s = scoreSentence(model, 'The strength of the old bridge surprised everyone.');
    expect(s.status).not.toBe('match');
  });
  it('ignores unrelated sentences', () => {
    const model = buildModel(cost, sentences);
    expect(scoreSentence(model, 'Mara made tea and watched the rain.').status).toBe('no');
  });
  it('gets better when the writer answers: yes teaches, no unteaches', () => {
    const probe = 'Elias felt hollow and weak after the ritual.';
    const before = scoreSentence(buildModel(cost, sentences), probe).status;
    const taught: Taught = { concepts: [cost], rules: [] };
    const after = labelExample(taught, cost.id, probe, true);
    const scored = scoreSentence(buildModel(after.concepts[0], sentences), 'She felt hollow and weak after the ritual ended.');
    expect(before).not.toBe('match');
    expect(scored.status).toBe('match');
    // and telling it "no" removes it again.
    const undone = labelExample(after, cost.id, probe, false);
    expect(undone.concepts[0].positives).not.toContain(probe);
    expect(undone.concepts[0].negatives).toContain(probe);
    expect(scoreSentence(buildModel(undone.concepts[0], sentences), probe).status).toBe('no');
  });
  it('marking a sentence "not it" lowers similar ones', () => {
    const tricky = 'The strength of the old bridge surprised everyone.';
    const t = labelExample({ concepts: [cost], rules: [] }, cost.id, tricky, false);
    expect(scoreSentence(buildModel(t.concepts[0], sentences), tricky).status).toBe('no');
  });
  it('suggests key words from the examples', () => {
    const suggestions = suggestTerms(cost, sentences);
    expect(suggestions).toEqual(expect.arrayContaining(['drain']));
    expect(suggestTerms(createConcept('none'), sentences)).toEqual([]);
  });
  it('accepting a suggestion makes it an always-counts key word', () => {
    const t = addTerms({ concepts: [cost], rules: [] }, cost.id, ['hollow']);
    expect(scoreSentence(buildModel(t.concepts[0], sentences), 'Her voice sounded hollow.').via).toBe('term');
  });
});

describe('rules', () => {
  const magic = createConcept('Magic', ['magic', 'spell']);
  const cost = createConcept('A cost', ['cost', 'price', 'pain']);
  const base: Taught = { concepts: [magic, cost], rules: [] };
  const withRule = (kind: 'always_with' | 'never_with' | 'only_with', window = 2) =>
    addRule(base, { text: 'Magic always costs something', kind, triggerId: magic.id, otherId: cost.id, window });

  it('always_with: flags magic with no cost nearby, but not when one follows', () => {
    const t = withRule('always_with');
    const bad = listSentences([unit(0, 'She cast a spell. The tea went cold. Nobody spoke. It was night.')]);
    expect(evaluateRules(t, bad)).toHaveLength(1);
    const good = listSentences([unit(0, 'She cast a spell. The price was her sleep.')]);
    expect(evaluateRules(t, good)).toHaveLength(0);
    const sameSentence = listSentences([unit(0, 'The spell caused pain.')]);
    expect(evaluateRules(t, sameSentence)).toHaveLength(0);
  });
  it('respects the window', () => {
    const t = withRule('always_with', 1);
    const s = listSentences([unit(0, 'She cast a spell. Nothing happened. The price came due.')]);
    expect(evaluateRules(t, s)).toHaveLength(1);
    expect(evaluateRules(withRule('always_with', 2), s)).toHaveLength(0);
  });
  it('does not look across chapters', () => {
    const t = withRule('always_with', 5);
    const s = listSentences([unit(0, 'She cast a spell.'), unit(1, 'The price was steep.')]);
    expect(evaluateRules(t, s)).toHaveLength(1);
  });
  it('never_with: flags when both appear together', () => {
    const t = withRule('never_with');
    const together = listSentences([unit(0, 'The spell caused pain.')]);
    expect(evaluateRules(t, together)).toHaveLength(1);
    const apart = listSentences([unit(0, 'The spell worked. Hours later, tea.')]);
    expect(evaluateRules(addRule(base, { text: 'x', kind: 'never_with', triggerId: magic.id, otherId: cost.id, window: 0 }), apart)).toHaveLength(0);
  });
  it('only_with: flags a trigger with no condition on either side', () => {
    const t = withRule('only_with', 1);
    expect(evaluateRules(t, listSentences([unit(0, 'The price was high. She cast a spell.')]))).toHaveLength(0);
    expect(evaluateRules(t, listSentences([unit(0, 'Tea. Tea. She cast a spell. Tea. Tea.')]))).toHaveLength(1);
  });
  it('skips disabled rules and dismissed findings', () => {
    const t = withRule('always_with');
    const s = listSentences([unit(0, 'She cast a spell. Quiet. Quiet. Quiet.')]);
    const [finding] = evaluateRules(t, s);
    expect(evaluateRules(setRuleEnabled(t, t.rules[0].id, false), s)).toHaveLength(0);
    expect(evaluateRules(t, s, [finding.id])).toHaveLength(0);
  });
  it('only accuses on sure matches, never on "maybe"', () => {
    const learned = createConcept('Magic', [], ['She whispered the old words and the room shook.']);
    const t = addRule({ concepts: [learned, cost], rules: [] }, { text: 'r', kind: 'always_with', triggerId: learned.id, otherId: cost.id, window: 1 });
    const s = listSentences([unit(0, 'Whispered, he left. Quiet. Quiet. Quiet.')]);
    expect(evaluateRules(t, s)).toHaveLength(0);
  });
  it('turns findings into nudges that can be jumped to', () => {
    const t = withRule('always_with');
    const nudges = ruleNudges(t, evaluateRules(t, listSentences([unit(0, 'She cast a spell. Quiet. Quiet. Quiet.')])));
    expect(nudges[0].feature).toBe('storyRules');
    expect(nudges[0].title).toContain('Magic always costs something');
    expect(nudges[0].evidence[0].chapterId).toBe('c0');
    expect(nudges[0].body).toContain('Magic');
    expect(nudges[0].body).toContain('A cost');
  });
  it('clamps absurd windows', () => {
    expect(withRule('always_with', 999).rules[0].window).toBe(12);
    expect(withRule('always_with', -4).rules[0].window).toBe(0);
  });
});

describe('managing what was taught', () => {
  it('deleting a concept also removes the rules that need it', () => {
    const a = createConcept('A', ['a1x']), b = createConcept('B', ['b1x']);
    let t: Taught = { concepts: [a, b], rules: [] };
    t = addRule(t, { text: 'r', kind: 'always_with', triggerId: a.id, otherId: b.id, window: 2 });
    expect(deleteConcept(t, b.id).rules).toHaveLength(0);
    expect(deleteConcept(t, b.id).concepts).toHaveLength(1);
  });
  it('splits comma and line lists', () => {
    expect(splitList('cost, price\npain,  ,')).toEqual(['cost', 'price', 'pain']);
  });
  it('cleans junk saved data and drops rules whose concepts are gone', () => {
    const clean = sanitizeTaught({
      concepts: [{ id: 'c1', name: 5, terms: ['x', 4], positives: 'nope' }, { name: 'no id' }, null],
      rules: [{ id: 'r1', kind: 'always_with', triggerId: 'c1', otherId: 'c1', window: 1e9 }, { id: 'r2', kind: 'bogus', triggerId: 'c1', otherId: 'c1' }, { id: 'r3', kind: 'never_with', triggerId: 'missing', otherId: 'c1' }],
    });
    expect(clean.concepts).toHaveLength(1);
    expect(clean.concepts[0].terms).toEqual(['x']);
    expect(clean.rules).toHaveLength(1);
    expect(clean.rules[0].window).toBe(12);
    expect(sanitizeTaught(undefined)).toEqual(emptyTaught());
  });
  it('lives in coach memory, including old saves that lack it', () => {
    expect(emptyCoachMemory('p').taught).toEqual(emptyTaught());
    const old = emptyCoachMemory('p') as unknown as Record<string, unknown>;
    delete old.taught;
    expect(normalizeCoachMemory(old as never, 'p').taught).toEqual(emptyTaught());
  });
});
