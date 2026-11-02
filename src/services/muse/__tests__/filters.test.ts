import { describe, it, expect } from 'vitest';
import { PROMPT_THEME_NAMES, filterCards, filterPrompts, promptLength, tagCounts, themesOf } from '../filters';
import { PROMPTS } from '../generators';
import { MUSE_FOUNDATION_CARDS } from '../../../data/museFoundations';

describe('prompt themes', () => {
  it('finds themes from the words in a prompt', () => {
    expect(themesOf('Two people share a secret they have never named out loud.')).toContain('Secrets & lies');
    expect(themesOf('A character returns to the house they grew up in, and remembers.')).toEqual(expect.arrayContaining(['Home & place', 'Memory & the past']));
    expect(themesOf('Describe a blue vase.')).toEqual([]);
  });
  it('every theme matches at least a few of the real prompts', () => {
    PROMPT_THEME_NAMES.forEach(t => expect(filterPrompts(PROMPTS, { themes: [t] }).length, t).toBeGreaterThanOrEqual(3));
  });
  it('sorts prompts by length', () => {
    expect(promptLength('Short one here.')).toBe('short');
    expect(promptLength('word '.repeat(18))).toBe('medium');
    expect(promptLength('word '.repeat(40))).toBe('long');
  });
  it('requires every chosen theme, and every search word', () => {
    const list = ['A secret in the house.', 'A secret kept alone.', 'Walk home.'];
    expect(filterPrompts(list, { themes: ['Secrets & lies'] })).toHaveLength(2);
    expect(filterPrompts(list, { themes: ['Secrets & lies', 'Home & place'] })).toEqual(['A secret in the house.']);
    expect(filterPrompts(list, { search: 'secret alone' })).toEqual(['A secret kept alone.']);
    expect(filterPrompts(list, { search: 'zzz' })).toEqual([]);
  });
  it('returns everything with no filters', () => {
    expect(filterPrompts(PROMPTS)).toHaveLength(PROMPTS.length);
    expect(filterPrompts(PROMPTS, { length: 'any' })).toHaveLength(PROMPTS.length);
  });
  it('length filter only returns that length', () => {
    filterPrompts(PROMPTS, { length: 'short' }).forEach(p => expect(promptLength(p)).toBe('short'));
  });
});

describe('card filters', () => {
  it('filters by category', () => {
    const tropes = filterCards(MUSE_FOUNDATION_CARDS, { category: 'tropes' });
    expect(tropes.length).toBeGreaterThan(100);
    tropes.forEach(c => expect(c.category).toBe('tropes'));
    expect(filterCards(MUSE_FOUNDATION_CARDS, { category: 'all' })).toHaveLength(MUSE_FOUNDATION_CARDS.length);
  });
  it('filters by tag, requiring all chosen tags', () => {
    const romance = filterCards(MUSE_FOUNDATION_CARDS, { category: 'tropes', tags: ['romance'] });
    expect(romance.length).toBeGreaterThan(10);
    romance.forEach(c => expect(c.tags).toContain('romance'));
    const both = filterCards(MUSE_FOUNDATION_CARDS, { category: 'tropes', tags: ['romance', 'trust'] });
    expect(both.length).toBeLessThan(romance.length);
    both.forEach(c => expect(c.tags).toEqual(expect.arrayContaining(['romance', 'trust'])));
  });
  it('searches titles, prompts and follow-up questions', () => {
    const hits = filterCards(MUSE_FOUNDATION_CARDS, { search: 'sacrifice' });
    expect(hits.length).toBeGreaterThan(0);
    hits.forEach(c => expect(`${c.title} ${c.prompt} ${c.deepeningQuestions.join(' ')}`.toLowerCase()).toContain('sacrifice'));
  });
  it('lists the most common tags first', () => {
    const tags = tagCounts(filterCards(MUSE_FOUNDATION_CARDS, { category: 'tropes' }));
    expect(tags[0].tag).toBe('stakes');
    expect(tags.length).toBeLessThanOrEqual(16);
    for (let i = 1; i < tags.length; i++) expect(tags[i - 1].count).toBeGreaterThanOrEqual(tags[i].count);
  });
});
