import { describe, expect, it } from 'vitest';
import { DEFAULT_BOOK, MARGINS, MIN_CONTENT_H, MIN_CONTENT_W, TRIMS, bookVars, contentBox, isRecto, normalizeBook, textLeft } from '../book/design';
import { buildBookSource, cleanChapterTitle, fillContents, markFirst, pageKinds, pageNumber, planBlankPages, prepareBody } from '../book/source';
import type { Chapter } from '../../types';

const chapter = (id: string, order: number, title: string, content: string): Chapter =>
  ({ id, order, title, content, wordCount: 0, status: 'draft' } as unknown as Chapter);

const project = (chapters: Chapter[], draftMode: 'chaptered' | 'open_draft' = 'chaptered') =>
  ({ title: 'The Lamp', subtitle: 'A tale', author: 'Ada <Lovelace>', chapters, draftMode });

describe('book design', () => {
  it('gives the usual trade sizes in inches', () => {
    expect(TRIMS.find(t => t.id === '6x9')).toMatchObject({ w: 6, h: 9 });
    expect(TRIMS.find(t => t.id === '5.5x8.5')).toMatchObject({ w: 5.5, h: 8.5 });
    expect(TRIMS.some(t => t.id === 'custom')).toBe(true);
  });

  it('fills in anything missing and uses the trim preset size', () => {
    const d = normalizeBook({ trim: '5x8', width: 99 });
    expect(d).toMatchObject({ trim: '5x8', width: 5, height: 8 });
    expect(normalizeBook(null)).toEqual({ ...DEFAULT_BOOK, coverImage: undefined });
    expect(normalizeBook({ trim: 'nonsense' }).trim).toBe(DEFAULT_BOOK.trim);
  });

  it('takes a custom size, kept to something that can be printed', () => {
    const d = normalizeBook({ trim: 'custom', width: 7.25, height: 10.5 });
    expect(d).toMatchObject({ width: 7.25, height: 10.5 });
    expect(normalizeBook({ trim: 'custom', width: 1, height: 100 })).toMatchObject({ width: 3, height: 16 });
  });

  it('never lets margins leave too little room for text', () => {
    const d = normalizeBook({ trim: '4.25x6.87', inside: 2, outside: 2, top: 2, bottom: 2 });
    const box = contentBox(d);
    expect(box.w).toBeGreaterThanOrEqual(MIN_CONTENT_W - 0.05);
    expect(box.h).toBeGreaterThanOrEqual(MIN_CONTENT_H - 0.05);
  });

  it('has margin sets that fit the default page', () => {
    MARGINS.forEach(m => {
      const box = contentBox({ ...DEFAULT_BOOK, ...m });
      expect(box.w).toBeGreaterThan(MIN_CONTENT_W);
      expect(box.h).toBeGreaterThan(MIN_CONTENT_H);
    });
  });

  it('rejects bad choices and clamps numbers', () => {
    const d = normalizeBook({ fontSize: 400, lineHeight: 0, indent: -3, chapterStart: 'x', head: 'x', numbers: 'x', paper: 'x', font: '"><b>' });
    expect(d.fontSize).toBe(16);
    expect(d.lineHeight).toBe(1.1);
    expect(d.indent).toBe(0);
    expect(d.chapterStart).toBe(DEFAULT_BOOK.chapterStart);
    expect(d.head).toBe(DEFAULT_BOOK.head);
    expect(d.numbers).toBe(DEFAULT_BOOK.numbers);
    expect(d.paper).toBe(DEFAULT_BOOK.paper);
    expect(d.font).not.toMatch(/[<>"]/);
  });

  it('puts the wide margin beside the spine on both kinds of page', () => {
    expect(isRecto(0)).toBe(true);
    expect(isRecto(1)).toBe(false);
    const d = { inside: 0.8, outside: 0.5 };
    expect(textLeft(d, 0)).toBe(0.8);
    expect(textLeft(d, 1)).toBe(0.5);
  });

  it('hands the type settings to css', () => {
    const v = bookVars(normalizeBook({ fontSize: 12, justify: false }), 'Lora');
    expect(v['--bk-size']).toBe('12pt');
    expect(v['--bk-align']).toBe('left');
    expect(v['--bk-last']).toBe('auto');
    expect(Number(v['--bk-w'])).toBeGreaterThan(0);
  });
});

describe('book source', () => {
  it('has the title page first, then the chapters in order, each marked for the page cutter', () => {
    const html = buildBookSource({
      project: project([chapter('b', 2, 'Chapter 2: Dusk', '<p>Two.</p>'), chapter('a', 1, 'Chapter 1: Dawn', '<p>One.</p>')]),
      design: normalizeBook({}), flourish: { top: '', bottom: '' }, year: 2026,
    });
    expect(html.indexOf('bk-titlepage')).toBeLessThan(html.indexOf('data-chapter="a"'));
    expect(html.indexOf('data-chapter="a"')).toBeLessThan(html.indexOf('data-chapter="b"'));
    expect(html).toContain('Chapter 2');
    expect(html).toContain('Dusk');
    expect(html).not.toContain('Chapter 2: Dusk');
    expect(html).toContain('Ada &lt;Lovelace&gt;');
    expect(html).toContain('© 2026');
  });

  it('keeps front matter and flourishes the writer chose', () => {
    const html = buildBookSource({
      project: project([chapter('a', 1, 'One', '<p>x</p>'), chapter('b', 2, 'Two', '<p>y</p>')]),
      design: normalizeBook({ toc: true, dedication: 'For you', copyright: false }),
      flourish: { top: '❦ ✦ ❦', bottom: '', frame: 'gilt' }, year: 2026,
    });
    expect(html).toContain('bk-dedication');
    expect(html).toContain('For you');
    expect(html).toContain('Contents');
    expect(html).toContain('data-toc="a"');
    expect(html).toContain('bk-frame-gilt');
    expect(html).toContain('❦ ✦ ❦');
    expect(html).not.toContain('bk-copyright');
  });

  it('puts an empty page before the chapters that need one', () => {
    const html = buildBookSource({
      project: project([chapter('a', 1, 'One', '<p>x</p>'), chapter('b', 2, 'Two', '<p>y</p>')]),
      design: normalizeBook({ chapterStart: 'right' }), flourish: { top: '', bottom: '' }, blanksBefore: new Set(['b']),
    });
    expect(html.match(/bk-blank/g)).toHaveLength(1);
    expect(html.indexOf('bk-blank')).toBeLessThan(html.indexOf('data-chapter="b"'));
    expect(html.indexOf('bk-blank')).toBeGreaterThan(html.indexOf('data-chapter="a"'));
  });

  it('sets chapter headings as the style asks, and none in an open draft', () => {
    const base = { flourish: { top: '', bottom: '' } };
    const chap = [chapter('a', 1, 'Chapter 1: Dawn', '<p>x</p>')];
    expect(buildBookSource({ ...base, project: project(chap), design: normalizeBook({ chapterStyle: 'title' }) })).not.toContain('bk-chap-num');
    expect(buildBookSource({ ...base, project: project(chap), design: normalizeBook({ chapterStyle: 'number' }) })).not.toContain('bk-chap-title');
    const open = buildBookSource({ ...base, project: project(chap, 'open_draft'), design: normalizeBook({}) });
    expect(open).not.toContain('bk-chap-num');
    expect(open).not.toContain('bk-chap-title');
  });

  it('only forces a new page for chapters when asked, except the first', () => {
    const chap = [chapter('a', 1, 'One', '<p>x</p>'), chapter('b', 2, 'Two', '<p>y</p>')];
    const html = buildBookSource({ project: project(chap), design: normalizeBook({ chapterStart: 'any' }), flourish: { top: '', bottom: '' } });
    expect(html.match(/bk-newpage/g)).toHaveLength(1);
  });

  it('removes the empty lines and leaves no indent on the first line after a scene break', () => {
    const body = prepareBody('<p>Start.</p><p><br></p><p>&nbsp;</p><p>Next.</p><hr data-separator="stars" /><p data-separator-mark="1">✦</p><p>After.</p>');
    expect(body).not.toContain('<br>');
    expect(body.match(/bk-first/g)).toHaveLength(2);
    expect(body).toContain('<p class="bk-first">Start.</p>');
    expect(body).toMatch(/✦<\/p><p class="bk-first">After\./);
  });

  it('adds the class without losing the ones a paragraph has', () => {
    expect(markFirst('<p class="x" style="a">t</p>')).toBe('<p class="bk-first x" style="a">t</p>');
    expect(markFirst('<h2>no paragraph</h2>')).toBe('<h2>no paragraph</h2>');
  });

  it('strips the word "Chapter" from titles that carry it', () => {
    expect(cleanChapterTitle('Chapter 12 - The Sea')).toBe('The Sea');
    expect(cleanChapterTitle('Chapterhouse')).toBe('Chapterhouse');
  });
});

describe('page planning', () => {
  it('adds an empty page only when a chapter would land on a left-hand page', () => {
    expect(planBlankPages([0, 2, 4])).toEqual([false, false, false]);
    expect(planBlankPages([2, 5])).toEqual([false, true]);
  });

  it('counts the shift every added page causes', () => {
    // 3 is odd so gets a blank (and moves to 4); 6 then moves to 7, which is odd, so it gets one too
    expect(planBlankPages([0, 3, 6])).toEqual([false, true, true]);
    expect(planBlankPages([])).toEqual([]);
  });

  it('numbers pages from the first chapter, with none before it', () => {
    expect(pageNumber(0, 3)).toBeNull();
    expect(pageNumber(3, 3)).toBe(1);
    expect(pageNumber(10, 3)).toBe(8);
  });

  it('fills the contents with the page each chapter begins on', () => {
    const pages = ['<div><span data-toc="a">0</span> <span data-toc="b">0</span></div>', 'x'];
    expect(fillContents(pages, { a: 3, b: 7 }, 3)[0]).toBe('<div><span data-toc="a">1</span> <span data-toc="b">5</span></div>');
    expect(fillContents(pages, {}, 3)[0]).toBe(pages[0]);
  });

  it('tells front matter, chapter openings, body pages and empty pages apart', () => {
    const pages = ['<section class="bk-front"></section>', '', '<header class="bk-chap-head" data-chapter="a"></header><p>t</p>', '<p>more</p>'];
    expect(pageKinds(pages, 2)).toEqual(['front', 'blank', 'chapter', 'body']);
  });
});
