import { describe, it, expect } from 'vitest';
import { commentTextFor, normalizeForSearch, normalizeQuote, quoteCandidates } from '../passageSearch';

describe('finding a quoted passage again', () => {
  it('drops the trailing ellipsis and tidies spacing and quotes', () => {
    expect(normalizeQuote('She said “hello”   there…')).toBe('She said "hello" there');
    expect(normalizeQuote("It’s fine...")).toBe("It's fine");
  });
  it('tries the whole quote first, then shorter openings', () => {
    const quote = 'Mara counted the flowers on the porch again that morning and found there were seven of them, one more than yesterday, which made no sense.';
    const c = quoteCandidates(quote);
    expect(c[0]).toBe(normalizeQuote(quote));
    for (let i = 1; i < c.length; i++) {
      expect(c[i].length).toBeLessThan(c[i - 1].length);
      expect(normalizeQuote(quote).startsWith(c[i])).toBe(true);
    }
    expect(c.length).toBeGreaterThan(2);
  });
  it('cuts at word boundaries, not mid-word', () => {
    const c = quoteCandidates('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra');
    c.slice(1).forEach(s => expect(s).toMatch(/\w$/));
    c.slice(1).forEach(s => expect('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra'.includes(s)).toBe(true));
  });
  it('handles short and empty quotes', () => {
    expect(quoteCandidates('')).toEqual([]);
    expect(quoteCandidates('Hi.')).toEqual(['Hi.']);
    expect(quoteCandidates('A short but searchable sentence.')[0]).toBe('A short but searchable sentence.');
  });
  it('makes page text comparable to a quote', () => {
    expect(normalizeForSearch('He said, “no.”\n  Then left.')).toBe('He said, "no." Then left.');
  });
});

describe('comment text', () => {
  it('joins title and body', () => {
    expect(commentTextFor('Dropped thread', 'The letter never returns.')).toBe('Dropped thread: The letter never returns.');
    expect(commentTextFor('Just a title')).toBe('Just a title');
  });
  it('keeps comments to a sensible length', () => {
    expect(commentTextFor('T', 'x'.repeat(1000)).length).toBeLessThanOrEqual(400);
  });
});
