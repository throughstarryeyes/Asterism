// how a book is laid out: the page, the margins, the type and the extras around the story.
// sizes are in inches, as a printer would give them.

export interface Trim { id: string; name: string; w: number; h: number; note: string }

export const TRIMS: Trim[] = [
  { id: '5x8', name: '5 × 8 in', w: 5, h: 8, note: 'Small trade' },
  { id: '5.25x8', name: '5.25 × 8 in', w: 5.25, h: 8, note: 'Trade paperback' },
  { id: '5.5x8.5', name: '5.5 × 8.5 in', w: 5.5, h: 8.5, note: 'Digest' },
  { id: '6x9', name: '6 × 9 in', w: 6, h: 9, note: 'US trade' },
  { id: '4.25x6.87', name: '4.25 × 6.87 in', w: 4.25, h: 6.87, note: 'Mass market' },
  { id: '6.14x9.21', name: '6.14 × 9.21 in', w: 6.14, h: 9.21, note: 'Royal' },
  { id: 'a5', name: 'A5 (5.83 × 8.27 in)', w: 5.83, h: 8.27, note: 'International' },
  { id: '7x10', name: '7 × 10 in', w: 7, h: 10, note: 'Large' },
  { id: 'letter', name: 'Letter (8.5 × 11 in)', w: 8.5, h: 11, note: 'Manuscript pages' },
  { id: 'custom', name: 'Custom size', w: 6, h: 9, note: 'Your own' },
];

export interface MarginSet { id: string; name: string; inside: number; outside: number; top: number; bottom: number }

export const MARGINS: MarginSet[] = [
  { id: 'tight', name: 'Tight', inside: 0.6, outside: 0.45, top: 0.5, bottom: 0.6 },
  { id: 'standard', name: 'Standard', inside: 0.8, outside: 0.6, top: 0.7, bottom: 0.85 },
  { id: 'roomy', name: 'Roomy', inside: 1, outside: 0.8, top: 0.9, bottom: 1.05 },
];

export interface Paper { id: string; name: string; page: string; ink: string; desk: string }

export const PAPERS: Paper[] = [
  { id: 'white', name: 'White', page: '#ffffff', ink: '#1b1b1b', desk: '#d9d6cf' },
  { id: 'cream', name: 'Cream', page: '#f7efdc', ink: '#2a2218', desk: '#cbbfa6' },
  { id: 'sepia', name: 'Sepia', page: '#ecdcb8', ink: '#3f2c18', desk: '#b9a782' },
  { id: 'gray', name: 'Soft gray', page: '#e8e8ec', ink: '#222226', desk: '#b8b8c0' },
  { id: 'night', name: 'Night', page: '#22242e', ink: '#dcd7c9', desk: '#0f1016' },
];

export const BOOK_FONTS = ['Lora', 'Merriweather', 'EB Garamond', 'Crimson Pro', 'Source Serif 4', 'Libre Baskerville', 'Cormorant Garamond', 'Playfair Display', 'Courier Prime', 'Atkinson Hyperlegible', 'Times New Roman'];

export type ChapterStart = 'any' | 'new' | 'right';
export type ChapterStyle = 'numbered' | 'title' | 'number';
export type RunningHead = 'none' | 'title' | 'author-title';
export type NumberPlace = 'none' | 'center' | 'outside';

export interface BookDesign {
  trim: string;
  width: number;
  height: number;
  inside: number;
  outside: number;
  top: number;
  bottom: number;
  font: string; // '' uses the writing font
  fontSize: number; // pt
  lineHeight: number;
  indent: number; // em
  justify: boolean;
  hyphenate: boolean;
  dropCap: boolean;
  chapterStart: ChapterStart;
  chapterStyle: ChapterStyle;
  sink: number; // inches of space above a chapter heading
  head: RunningHead;
  numbers: NumberPlace;
  toc: boolean;
  copyright: boolean;
  copyrightText: string;
  dedication: string;
  paper: string;
  // a cover picture the writer added (an asset id); the cover look from the shop is used otherwise
  coverImage?: string;
  // put the cover in the PDF too
  printCover: boolean;
  // how many pages the last typesetting made, so the cover creator can work out the spine
  typesetPages?: number;
}

export const DEFAULT_BOOK: BookDesign = {
  trim: '6x9', width: 6, height: 9,
  inside: 0.8, outside: 0.6, top: 0.7, bottom: 0.85,
  font: '', fontSize: 11, lineHeight: 1.45, indent: 1.5,
  justify: true, hyphenate: true, dropCap: false,
  chapterStart: 'new', chapterStyle: 'numbered', sink: 1.2,
  head: 'author-title', numbers: 'center',
  toc: false, copyright: true, copyrightText: '', dedication: '',
  paper: 'cream', printCover: false,
};

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

export const MIN_CONTENT_W = 2.4;
export const MIN_CONTENT_H = 3.6;

// anything (an old save, a bad value) becomes a layout that can be typeset
export function normalizeBook(raw: unknown): BookDesign {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_BOOK;
  const trim = pick(r.trim, TRIMS.map(t => t.id), D.trim);
  const preset = TRIMS.find(t => t.id === trim)!;
  const custom = trim === 'custom';
  const width = round(custom ? num(r.width, 3, 12, D.width) : preset.w);
  const height = round(custom ? num(r.height, 4, 16, D.height) : preset.h);
  // margins may not squeeze the text box below something a reader could use
  let inside = round(num(r.inside, 0.25, 2, D.inside));
  let outside = round(num(r.outside, 0.25, 2, D.outside));
  let top = round(num(r.top, 0.25, 2, D.top));
  let bottom = round(num(r.bottom, 0.25, 2, D.bottom));
  const spreadX = (width - MIN_CONTENT_W);
  if (inside + outside > spreadX) { const k = spreadX / (inside + outside); inside = round(Math.max(0.2, inside * k)); outside = round(Math.max(0.2, outside * k)); }
  const spreadY = (height - MIN_CONTENT_H);
  if (top + bottom > spreadY) { const k = spreadY / (top + bottom); top = round(Math.max(0.2, top * k)); bottom = round(Math.max(0.2, bottom * k)); }
  return {
    trim, width, height, inside, outside, top, bottom,
    font: typeof r.font === 'string' ? r.font.replace(/["<>]/g, '').slice(0, 60) : D.font,
    fontSize: round(num(r.fontSize, 8, 16, D.fontSize), 1),
    lineHeight: round(num(r.lineHeight, 1.1, 2, D.lineHeight)),
    indent: round(num(r.indent, 0, 3, D.indent), 1),
    justify: typeof r.justify === 'boolean' ? r.justify : D.justify,
    hyphenate: typeof r.hyphenate === 'boolean' ? r.hyphenate : D.hyphenate,
    dropCap: typeof r.dropCap === 'boolean' ? r.dropCap : D.dropCap,
    chapterStart: pick(r.chapterStart, ['any', 'new', 'right'] as const, D.chapterStart),
    chapterStyle: pick(r.chapterStyle, ['numbered', 'title', 'number'] as const, D.chapterStyle),
    sink: round(num(r.sink, 0, 3, D.sink)),
    head: pick(r.head, ['none', 'title', 'author-title'] as const, D.head),
    numbers: pick(r.numbers, ['none', 'center', 'outside'] as const, D.numbers),
    toc: typeof r.toc === 'boolean' ? r.toc : D.toc,
    copyright: typeof r.copyright === 'boolean' ? r.copyright : D.copyright,
    copyrightText: typeof r.copyrightText === 'string' ? r.copyrightText.slice(0, 400) : D.copyrightText,
    dedication: typeof r.dedication === 'string' ? r.dedication.slice(0, 400) : D.dedication,
    paper: pick(r.paper, PAPERS.map(p => p.id), D.paper),
    coverImage: typeof r.coverImage === 'string' && r.coverImage ? r.coverImage : undefined,
    printCover: typeof r.printCover === 'boolean' ? r.printCover : D.printCover,
    typesetPages: typeof r.typesetPages === 'number' && Number.isFinite(r.typesetPages) && r.typesetPages > 0 ? Math.min(2000, Math.round(r.typesetPages)) : undefined,
  };
}

export const PX_PER_IN = 96;
export const px = (inches: number) => inches * PX_PER_IN;

// the text box, in inches
export const contentBox = (d: Pick<BookDesign, 'width' | 'height' | 'inside' | 'outside' | 'top' | 'bottom'>) => ({
  w: round(d.width - d.inside - d.outside),
  h: round(d.height - d.top - d.bottom),
});

// the first page after the cover is a right-hand page, so even pages (counting from 0) are right-hand
export const isRecto = (pageIndex: number) => pageIndex % 2 === 0;

// the left edge of the text box on a page
export const textLeft = (d: Pick<BookDesign, 'inside' | 'outside'>, pageIndex: number) => (isRecto(pageIndex) ? d.inside : d.outside);

// the css variables the book's type reads, shared by the measuring box and the pages
export function bookVars(d: BookDesign, fontStack: string): Record<string, string> {
  const box = contentBox(d);
  return {
    '--bk-font': fontStack,
    '--bk-size': `${d.fontSize}pt`,
    '--bk-lh': String(d.lineHeight),
    '--bk-indent': `${d.indent}em`,
    '--bk-align': d.justify ? 'justify' : 'left',
    '--bk-hyph': d.hyphenate ? 'auto' : 'manual',
    '--bk-last': d.justify ? 'justify' : 'auto',
    '--bk-w': String(box.w),
    '--bk-h': String(box.h),
  };
}

export const paperOf = (id: string) => PAPERS.find(p => p.id === id) ?? PAPERS[1];
