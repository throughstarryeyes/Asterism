import { describe, it, expect } from 'vitest';
import { parseQuery, previewOf, searchProject, searchProjects } from '../documentSearch';
import type { Chapter, Project } from '../../types';

const chapter = (i: number, html: string, over: Partial<Chapter> = {}): Chapter =>
  ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: html, status: 'draft', wordCount: 0, updatedAt: '', ...over });

const doc = (id: string, chapters: Chapter[], over: Partial<Project> = {}): Project => ({
  id, title: id, author: '', genre: '', synopsis: '', chapters,
  storyBible: { characters: [], locations: [], lore: [] }, ...over,
} as unknown as Project);

describe('the first lines of a document', () => {
  it('gives the opening sentences, not the heading', () => {
    const p = doc('a', [chapter(0, '<h2>Chapter I: The Sound</h2><p>Caspian Khalil is dead.</p><p>That’s what the newspaper said, anyway. The obituary was brief, no more than twenty words. It was buried on the second page.</p>')]);
    const out = previewOf(p);
    expect(out.startsWith('Caspian Khalil is dead.')).toBe(true);
    expect(out).not.toContain('Chapter I');
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('stops at a few sentences, with an ellipsis if it had to cut one', () => {
    const long = `<p>${'A very long sentence that keeps going and going without any end in sight '.repeat(8)}.</p>`;
    const out = previewOf(doc('a', [chapter(0, long)]));
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith('…')).toBe(true);
  });

  it('skips empty chapters, decodes entities, and is empty for a blank page', () => {
    const p = doc('a', [chapter(0, '<p><br></p>'), chapter(1, '<p>Tom &amp; Jerry&rsquo;s plan failed.&nbsp;Badly.</p>')]);
    expect(previewOf(p)).toBe('Tom & Jerry’s plan failed. Badly.');
    expect(previewOf(doc('b', [chapter(0, '<p><br></p>')]))).toBe('');
  });
});

describe('searching documents', () => {
  const book = doc('Salt', [chapter(0, '<p>The lighthouse keeper climbed the stairs. The lighthouse hummed.</p>'), chapter(1, '<p>Mara found the brass key beneath the lamp.</p>')], { author: 'Ada Reed', genre: 'Mystery' });
  const other = doc('Tides', [chapter(0, '<p>Nothing about towers here, only the sea.</p>')]);

  it('reads quoted phrases and loose words', () => {
    expect(parseQuery('brass key')).toEqual({ phrases: [], words: ['brass', 'key'] });
    expect(parseQuery('the "brass key" Mara')).toEqual({ phrases: ['brass key'], words: ['the', 'mara'] });
    expect(parseQuery('  ')).toEqual({ phrases: [], words: [] });
  });

  it('finds a word anywhere in the writing, and counts it', () => {
    const hit = searchProject(book, parseQuery('lighthouse'))!;
    expect(hit.count).toBe(2);
    expect(hit.inDetailsOnly).toBe(false);
    expect(hit.snippets.length).toBeGreaterThan(0);
    const marked = hit.snippets[0].filter(s => s.hit).map(s => s.text.toLowerCase());
    expect(marked).toContain('lighthouse');
    expect(searchProject(other, parseQuery('lighthouse'))).toBeNull();
  });

  it('needs every word, in any chapter, and a quoted phrase together', () => {
    expect(searchProject(book, parseQuery('lighthouse key'))).not.toBeNull(); // in two different chapters
    expect(searchProject(book, parseQuery('lighthouse submarine'))).toBeNull();
    expect(searchProject(book, parseQuery('"brass key"'))).not.toBeNull();
    expect(searchProject(book, parseQuery('"key brass"'))).toBeNull();
  });

  it('ignores case, and marks a term inside a longer word the way a search box would', () => {
    expect(searchProject(book, parseQuery('LIGHTHOUSE'))).not.toBeNull();
    expect(searchProject(book, parseQuery('light'))!.count).toBeGreaterThan(0);
  });

  it('says when the match is only in the title, author, genre or names', () => {
    expect(searchProject(book, parseQuery('ada'))).toMatchObject({ count: 0, inDetailsOnly: true });
    expect(searchProject(book, parseQuery('mystery'))).toMatchObject({ inDetailsOnly: true });
    const named = doc('x', [chapter(0, '<p>Nothing here.</p>')], { storyBible: { characters: [{ name: 'Valentine', aliases: ['Val'] }], locations: [], lore: [] } } as never);
    expect(searchProject(named, parseQuery('valentine'))).toMatchObject({ inDetailsOnly: true });
  });

  it('returns every matching document and none of the rest', () => {
    const hits = searchProjects([book, other], 'sea');
    expect([...hits.keys()]).toEqual(['Tides']);
    expect(searchProjects([book, other], '').size).toBe(0);
  });

  it('keeps passages short, and does not show the same one twice', () => {
    const repeated = doc('r', [chapter(0, `<p>${'The lighthouse stood. '.repeat(30)}</p>`)]);
    const hit = searchProject(repeated, parseQuery('lighthouse'))!;
    expect(hit.count).toBe(30);
    expect(hit.snippets.length).toBeLessThanOrEqual(2);
    hit.snippets.forEach(s => expect(s.map(x => x.text).join('').length).toBeLessThan(200));
  });

  it('reuses the text it read for a document until the text changes', () => {
    const chapters = [chapter(0, '<p>First version.</p>')];
    const p = doc('c', chapters);
    expect(searchProject(p, parseQuery('first'))).not.toBeNull();
    // the app replaces the chapters array when text changes, and a new array is read again
    const edited = [{ ...chapters[0], content: '<p>Second version.</p>' }];
    expect(searchProject(doc('c', edited), parseQuery('second'))).not.toBeNull();
    expect(searchProject(doc('c', edited), parseQuery('first'))).toBeNull();
  });
});
