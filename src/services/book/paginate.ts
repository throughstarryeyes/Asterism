import type { BookDesign } from './design';
import { contentBox, px } from './design';
import { esc, fillContents, planBlankPages } from './source';

// cuts the book's html into pages. needs a browser, since it asks the layout engine where each page ends.
//
// the whole book is poured into a box one page tall, set in columns, so the browser breaks it into page-sized columns.
// then each column is slid into view and asked what text sits at its top-left corner. the text between two such
// corners is one page, and it is cut out and kept as html. the same html is shown on screen and printed, so what you
// flip through is what comes out as a PDF.

export interface Paginated {
  pages: string[];
  chapterStarts: Record<string, number>;
  firstChapterPage: number;
}

const MAX_PAGES = 4000;

interface Spot { node: Node; offset: number }

function caretAt(x: number, y: number): Spot | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  const p = doc.caretPositionFromPoint?.(x, y);
  return p ? { node: p.offsetNode, offset: p.offset } : null;
}

const BLOCK = /^(P|LI|BLOCKQUOTE|H[1-6]|DIV|PRE|SECTION|HEADER)$/;

function blockOf(node: Node, host: HTMLElement): HTMLElement | null {
  let el: Node | null = node.nodeType === 1 ? node : node.parentNode;
  while (el && el !== host) {
    if (el.nodeType === 1 && BLOCK.test((el as HTMLElement).tagName)) return el as HTMLElement;
    el = el.parentNode;
  }
  return null;
}

const hasText = (r: Range) => r.toString().trim().length > 0;

function insideWord(spot: Spot): boolean {
  if (spot.node.nodeType !== 3) return false;
  const text = spot.node.textContent ?? '';
  return /\p{L}/u.test(text[spot.offset - 1] ?? '') && /\p{L}/u.test(text[spot.offset] ?? '');
}

function lastTextNode(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  return last;
}

// a slice that ends where a block begins carries an empty copy of that block. such shells are not content, and one
// at the end of a page would look like the next chapter had begun there.
const KEEP_EMPTY = /^(HR|IMG|BR|SVG|VIDEO|CANVAS|IFRAME)$/;
function isShell(el: Element): boolean {
  if (KEEP_EMPTY.test(el.tagName.toUpperCase())) return false;
  return !(el.textContent ?? '').trim() && !el.querySelector('img, hr, svg, video, canvas, iframe');
}

function dropShells(box: HTMLElement) {
  while (box.lastElementChild && isShell(box.lastElementChild)) box.lastElementChild.remove();
  while (box.firstElementChild && isShell(box.firstElementChild)) box.firstElementChild.remove();
}

// the slice of the stream between two spots, as html that stands on its own on a page
function slice(host: HTMLElement, from: Spot, to: Spot | null, final: boolean): string {
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  if (to) range.setEnd(to.node, to.offset);
  else range.setEndAfter(host.lastChild ?? host);
  const tmp = document.createElement('div');
  tmp.appendChild(range.cloneContents());
  dropShells(tmp);

  // a paragraph that carried over from the last page has no indent
  const startBlock = blockOf(from.node, host);
  if (startBlock) {
    const before = document.createRange();
    before.setStart(startBlock, 0);
    before.setEnd(from.node, from.offset);
    const first = tmp.firstElementChild;
    if (first && hasText(before)) first.classList.add('bk-cont');
  }
  // a paragraph that goes on to the next page keeps its last line spread out like the rest
  if (to && !final) {
    const endBlock = blockOf(to.node, host);
    if (endBlock) {
      // the paragraph goes on only if the next page starts partway into it
      const done = document.createRange();
      done.setStart(endBlock, 0);
      done.setEnd(to.node, to.offset);
      const last = tmp.lastElementChild;
      if (last && hasText(done)) last.classList.add('bk-more');
    }
    // a word cut in two gets its hyphen here, since the layout engine only draws one when it breaks a line itself
    if (insideWord(to)) {
      const t = lastTextNode(tmp);
      if (t) t.textContent = `${t.textContent ?? ''}-`;
    }
  }
  return tmp.innerHTML;
}

const sameSpot = (a: Spot, b: Spot) => a.node === b.node && a.offset === b.offset;

function orderedAfter(prev: Spot, next: Spot): Spot {
  // a spot found before the previous one would give a negative page; treat it as the same place
  const a = document.createRange();
  a.setStart(prev.node, prev.offset);
  const b = document.createRange();
  b.setStart(next.node, next.offset);
  return a.compareBoundaryPoints(Range.START_TO_START, b) > 0 ? prev : next;
}

async function fontsReady(css: string, sizePt: number) {
  try {
    await Promise.race([
      Promise.all([`${sizePt}pt ${css}`, `italic ${sizePt}pt ${css}`, `bold ${sizePt}pt ${css}`].map(f => document.fonts.load(f))),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    await document.fonts.ready;
  } catch { /* offline: the fallback font is used for measuring and for showing, so they still agree */ }
}

async function cut(html: string, design: BookDesign, vars: Record<string, string>, fontCss: string, isCancelled: () => boolean): Promise<string[]> {
  const box = contentBox(design);
  const w = Math.round(px(box.w));
  const h = Math.round(px(box.h));
  const host = document.createElement('div');
  host.className = `bk-text bk-measure${design.dropCap ? ' bk-drop' : ''}`;
  host.lang = 'en';
  Object.entries(vars).forEach(([k, v]) => host.style.setProperty(k, v));
  host.style.cssText += `;position:fixed;top:0;left:0;width:${w}px;height:${h}px;column-width:${w}px;column-gap:0;column-fill:auto;opacity:0;z-index:2147483000;overflow:visible;`;
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    await fontsReady(fontCss, design.fontSize);
    await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
    if (isCancelled()) return [];
    const colW = host.clientWidth || w;
    const count = Math.min(MAX_PAGES, Math.max(1, Math.ceil(host.scrollWidth / colW - 0.02)));
    const lineY = Math.max(2, Math.round((design.fontSize * (96 / 72) * design.lineHeight) * 0.6));

    const spots: Spot[] = [{ node: host, offset: 0 }];
    for (let i = 1; i < count; i++) {
      host.style.transform = `translateX(${-i * colW}px)`;
      const found = caretAt(2, lineY);
      spots.push(found && host.contains(found.node) ? orderedAfter(spots[i - 1], found) : spots[i - 1]);
      if (i % 40 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); if (isCancelled()) return []; }
    }
    host.style.transform = '';

    const pages = spots.map((s, i) => {
      const next = spots[i + 1] ?? null;
      return next && sameSpot(s, next) ? '' : slice(host, s, next, i === spots.length - 1);
    });
    // the end of the stream can leave an empty last column
    while (pages.length > 1 && !pages[pages.length - 1].replace(/<[^>]*>/g, '').trim() && !/<img/.test(pages[pages.length - 1])) pages.pop();
    return pages;
  } finally {
    host.remove();
  }
}

function startsOf(pages: string[], ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  pages.forEach((html, i) => {
    for (const m of html.matchAll(/data-chapter="([^"]*)"/g)) {
      const id = ids.find(x => esc(x) === m[1]);
      if (id !== undefined && !(id in out)) out[id] = i;
    }
  });
  return out;
}

export async function paginateBook(opts: {
  build: (blanks: ReadonlySet<string>) => string;
  design: BookDesign;
  vars: Record<string, string>;
  fontCss: string;
  chapterIds: string[];
  isCancelled: () => boolean;
}): Promise<Paginated | null> {
  const { build, design, vars, fontCss, chapterIds, isCancelled } = opts;
  let pages = await cut(build(new Set()), design, vars, fontCss, isCancelled);
  if (isCancelled()) return null;
  let starts = startsOf(pages, chapterIds);

  // right-hand starts: add empty pages, then cut again
  if (design.chapterStart === 'right') {
    const order = chapterIds.filter(id => id in starts);
    const need = planBlankPages(order.map(id => starts[id]));
    const blanks = new Set(order.filter((_, i) => need[i]));
    if (blanks.size) {
      pages = await cut(build(blanks), design, vars, fontCss, isCancelled);
      if (isCancelled()) return null;
      starts = startsOf(pages, chapterIds);
    }
  }

  const first = chapterIds.map(id => starts[id]).filter((n): n is number => n !== undefined);
  const firstChapterPage = first.length ? Math.min(...first) : pages.length;
  return { pages: fillContents(pages, starts, firstChapterPage), chapterStarts: starts, firstChapterPage };
}
