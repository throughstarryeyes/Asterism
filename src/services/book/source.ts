import type { Chapter, Project } from '../../types';
import type { BookDesign } from './design';
import { isRecto } from './design';

// the book as one stream of html, which the typesetter then cuts into pages (see paginate.ts).
// nothing in the page css may depend on an element's ancestors, because a page only holds a slice of the stream.

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const cleanChapterTitle = (title: string) => title.replace(/^Chapter\s+[IVXLCDM\d]+[:\s-]*/i, '').trim();

export interface BookFlourish { top: string; bottom: string; frame?: 'double' | 'gilt' }

export interface BookInput {
  project: Pick<Project, 'title' | 'subtitle' | 'author' | 'chapters' | 'draftMode'>;
  design: BookDesign;
  flourish: BookFlourish;
  // chapters that get an empty page before them, so they land on a right-hand page
  blanksBefore?: ReadonlySet<string>;
  year?: number;
}

const addClass = (attrs: string, cls: string) =>
  /\bclass\s*=\s*"/i.test(attrs) ? attrs.replace(/\bclass\s*=\s*"/i, `class="${cls} `) : ` class="${cls}"${attrs}`;

// the first paragraph of a chapter or scene starts flush left (and takes the drop cap)
export function markFirst(html: string): string {
  return html.replace(/<p(?=[\s>])([^>]*)>/i, (_m, attrs: string) => `<p${addClass(attrs, 'bk-first')}>`);
}

const EMPTY_P = /<p\b[^>]*>\s*(?:<br\s*\/?>|&nbsp;| |\s)*<\/p>/gi;
const AFTER_BREAK = /(<hr\b[^>]*data-separator[^>]*>\s*(?:<p\b[^>]*data-separator-mark[^>]*>[\s\S]*?<\/p>\s*)?)<p(?=[\s>])([^>]*)>/gi;

// the text of a chapter as a book sets it: no empty lines, no indent after a scene break
export function prepareBody(html: string): string {
  const clean = html.replace(EMPTY_P, '');
  return markFirst(clean).replace(AFTER_BREAK, (_m, lead: string, attrs: string) => `${lead}<p${addClass(attrs, 'bk-first')}>`);
}

const sorted = (chapters: Chapter[]) => [...chapters].sort((a, b) => a.order - b.order);

export function buildBookSource({ project, design, flourish, blanksBefore, year = new Date().getFullYear() }: BookInput): string {
  const out: string[] = [];
  const frame = flourish.frame ? ` bk-frame-${flourish.frame}` : '';

  out.push(
    `<section class="bk-front bk-titlepage"><div class="bk-titleblock${frame}">`
    + (flourish.top ? `<div class="bk-orn">${esc(flourish.top)}</div>` : '')
    + `<h1 class="bk-title">${esc(project.title)}</h1>`
    + (project.subtitle ? `<div class="bk-subtitle">${esc(project.subtitle)}</div>` : '')
    + `<div class="bk-author">${esc(project.author)}</div>`
    + (flourish.bottom ? `<div class="bk-orn">${esc(flourish.bottom)}</div>` : '')
    + '</div></section>',
  );

  if (design.copyright) {
    const text = design.copyrightText.trim() || `© ${year} ${project.author}\nAll rights reserved.`;
    out.push(`<section class="bk-front bk-copyright">${text.split(/\r?\n/).map(l => `<p>${esc(l)}</p>`).join('')}</section>`);
  }
  if (design.dedication.trim()) {
    out.push(`<section class="bk-front bk-dedication">${design.dedication.trim().split(/\r?\n/).map(l => `<p>${esc(l)}</p>`).join('')}</section>`);
  }

  const chapters = sorted(project.chapters);
  const open = project.draftMode === 'open_draft';
  if (design.toc && !open && chapters.length > 1) {
    out.push(
      '<section class="bk-tocwrap"><h2 class="bk-toc-title">Contents</h2>'
      + chapters.map((c, i) => `<div class="bk-toc-row"><span class="bk-toc-name">${esc(cleanChapterTitle(c.title) || `Chapter ${i + 1}`)}</span><span class="bk-toc-dots"></span><span data-toc="${esc(c.id)}">0</span></div>`).join('')
      + '</section>',
    );
  }

  chapters.forEach((c, i) => {
    if (blanksBefore?.has(c.id)) out.push('<div class="bk-blank"></div>');
    const title = cleanChapterTitle(c.title);
    // the first chapter always starts a page, so the story never begins under the front matter
    const breaks = design.chapterStart !== 'any' || i === 0;
    const sink = breaks ? design.sink : 0.25;
    let head = '';
    if (!open) {
      const label = `Chapter ${i + 1}`;
      const showNum = design.chapterStyle !== 'title';
      const showTitle = design.chapterStyle !== 'number' && !!title;
      head = (showNum ? `<div class="bk-chap-num">${esc(label)}</div>` : '') + (showTitle ? `<h2 class="bk-chap-title">${esc(title)}</h2>` : '');
    }
    out.push(
      `<header class="bk-chap-head${breaks ? ' bk-newpage' : ''}" data-chapter="${esc(c.id)}" style="padding-top:${sink}in">${head}</header>`
      + prepareBody(c.content || ''),
    );
  });

  return out.join('\n');
}

// which chapters need an empty page before them so that they start on a right-hand page.
// `starts` are the pages (counted from 0) where each chapter began without any blanks added.
export function planBlankPages(starts: number[]): boolean[] {
  let shift = 0;
  return starts.map(s => {
    const odd = !isRecto(s + shift);
    if (odd) shift += 1;
    return odd;
  });
}

// the page numbers shown for a page: front matter has none, and the first chapter's first page is page 1
export function pageNumber(pageIndex: number, firstChapterPage: number): number | null {
  return pageIndex < firstChapterPage ? null : pageIndex - firstChapterPage + 1;
}

// fill in the contents page once the chapters' pages are known
export function fillContents(pages: string[], starts: Record<string, number>, firstChapterPage: number): string[] {
  return pages.map(html => html.replace(/<span data-toc="([^"]*)">0<\/span>/g, (m, id: string) => {
    const at = starts[id.replace(/&quot;/g, '"').replace(/&amp;/g, '&')];
    return at === undefined ? m : `<span data-toc="${id}">${pageNumber(at, firstChapterPage) ?? ''}</span>`;
  }));
}

export type PageKind = 'front' | 'chapter' | 'body' | 'blank';

// what each page is, read from its html and where the chapters begin
export function pageKinds(pages: string[], firstChapterPage: number): PageKind[] {
  return pages.map((html, i) => {
    if (!html.trim()) return 'blank';
    if (i < firstChapterPage) return 'front';
    return /class="bk-chap-head/.test(html) ? 'chapter' : 'body';
  });
}

// the chapter each page belongs to, for running heads
export function chapterOfPages(pages: string[], chapters: Array<{ id: string; title: string }>): Array<number | null> {
  let current: number | null = null;
  return pages.map(html => {
    const m = html.match(/data-chapter="([^"]*)"/g);
    if (m) {
      const id = m[m.length - 1].slice('data-chapter="'.length, -1);
      const at = chapters.findIndex(c => esc(c.id) === id);
      if (at >= 0) current = at;
    }
    return current;
  });
}
