import { describe, it, expect } from 'vitest';
import { buildEntityIndex, type CoachUnit } from '../coach/entities';
import { promiseBoard } from '../coach/features';
import { detectOpenLoops, startsAsQuestion, type OpenLoopOptions } from '../openLoops';
import { DEFAULT_STORY_LEXICON } from '../../data/defaultStoryLexicon';

const unit = (i: number, text: string): CoachUnit => ({ id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: text });
const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';

const loopsOf = (texts: string[], options?: OpenLoopOptions) => {
  const units = texts.map((t, i) => unit(i, t));
  return { units, index: buildEntityIndex(units), loops: detectOpenLoops(units, buildEntityIndex(units), options) };
};

describe('objects', () => {
  it('recognizes an object described with more than one word', () => {
    const { loops } = loopsOf(['She slipped the brass key into her coat pocket.', quiet, quiet]);
    const key = loops.find(l => l.kind === 'object');
    expect(key?.item).toBe('key');
    expect(key?.unitIndex).toBe(0);
  });

  it('lists every later scene that mentions it', () => {
    const { loops } = loopsOf(['She slipped the key into her coat.', quiet, 'Nobody had seen the key since.', quiet]);
    expect(loops.find(l => l.kind === 'object')?.followUpUnits).toEqual([2]);
  });
});

describe('questions', () => {
  it('tells a question a character asks from one the narration asks', () => {
    const { loops } = loopsOf([
      '"Who sent this letter?" Dana asked. Who leaves the flowers on the empty porch every morning?',
      quiet
    ]);
    const questions = loops.filter(l => l.kind === 'question');
    expect(questions.find(q => q.sentence.includes('Who sent'))?.spoken).toBe(true);
    expect(questions.find(q => q.sentence.startsWith('Who leaves'))?.spoken).toBe(false);
  });

  it('uses the mystery phrases the writer put in the Lexicon', () => {
    const custom = { ...DEFAULT_STORY_LEXICON, mysteryInquiries: ['Who ate the cake'] };
    const text = '"Who ate the cake?" Dana asked.';
    expect(loopsOf([text, quiet], { lexicon: custom }).loops.some(l => l.kind === 'question')).toBe(true);
    expect(loopsOf([text, quiet], { lexicon: { ...DEFAULT_STORY_LEXICON, mysteryInquiries: ['Who sent this'] } }).loops.some(l => l.kind === 'question')).toBe(false);
  });
});

describe('promises', () => {
  it('uses the commitment phrases the writer put in the Lexicon', () => {
    const text = '"Be there at the old mill," she said.';
    expect(loopsOf([text, quiet]).loops.some(l => l.kind === 'promise')).toBe(false);
    const custom = { ...DEFAULT_STORY_LEXICON, commitmentPhrases: ['at the old mill'] };
    expect(loopsOf([text, quiet], { lexicon: custom }).loops.some(l => l.kind === 'promise')).toBe(true);
  });

  it('is about the thing promised, not the people who show up in every scene', () => {
    const { loops } = loopsOf(['"I promise to find the lantern," Mara said.', 'Mara cooked dinner.', 'Mara slept.']);
    const promise = loops.find(l => l.kind === 'promise')!;
    expect(promise.subject.some(t => t.startsWith('lanter'))).toBe(true);
    expect(promise.subject).not.toContain('mara');
    expect(promise.followUpUnits).toEqual([]);
  });

  it('counts a later scene about the same thing as a follow-up', () => {
    const { loops } = loopsOf(['"I promise to find the lantern," Mara said.', quiet, 'At last Mara found the lantern in the cellar.']);
    expect(loops.find(l => l.kind === 'promise')?.followUpUnits).toEqual([2]);
  });
});

describe('the Coach board and the scan see the same loops', () => {
  const texts = [
    '"I swear I will come back for you," Elias said at the docks. Who sent this letter?',
    'Mara kept the secret about the lighthouse key hidden.',
    'Elias never returned to the docks.',
    'The lighthouse key stayed hidden in the lighthouse wall.'
  ];

  it('lists the same ids and counts the same revisits', () => {
    const { units, index, loops } = loopsOf(texts);
    const board = promiseBoard(units, index);
    const listed = loops.filter(l => l.kind !== 'object');
    expect(board.map(b => b.id).sort()).toEqual(listed.map(l => l.id).sort());
    listed.forEach(l => expect(board.find(b => b.id === l.id)?.revisits).toBe(l.followUpUnits.length));
  });
});

describe('questions that are not open loops', () => {
  const questionsIn = (texts: string[]) => loopsOf(texts).loops.filter(l => l.kind === 'question').map(l => l.sentence);

  it('ignores a question inside a line of speech that spans sentences', () => {
    const found = questionsIn(['“Jesus christ, Atlas. Are you already drunk? It hasn’t even been an hour.” Val grimaced.', quiet, quiet]);
    expect(found).toEqual([]);
  });

  it('keeps a real question in the narration', () => {
    const found = questionsIn(['How long had he been following him? Val did not know.', quiet, quiet]);
    expect(found).toEqual(['How long had he been following him?']);
  });

  it('ignores a statement that only ends in a question mark', () => {
    expect(questionsIn(['Val wouldn’t admit it out loud, but the past two weeks were making him feel… normal again?', quiet, quiet])).toEqual([]);
  });

  it('reads a question after an interjection', () => {
    expect(startsAsQuestion('Fuck, what if he woke up Cass if he moved?')).toBe(true);
    expect(startsAsQuestion('Or, have you ever taken a single word?')).toBe(true);
    expect(startsAsQuestion('Surely Cass would be more direct?')).toBe(false);
  });
});
