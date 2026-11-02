// turns the editor's HTML into plain blocks and runs, with no browser needed, so the DOCX and EPUB
// writers (and their tests) work the same everywhere.

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  sup?: boolean;
  sub?: boolean;
  font?: string;
  // a line break inside a paragraph (text is empty).
  br?: boolean;
}

export type BlockKind = 'p' | 'h1' | 'h2' | 'h3' | 'quote' | 'li' | 'break';
export type Align = 'left' | 'center' | 'right' | 'justify';

export interface Block {
  kind: BlockKind;
  runs: Run[];
  align?: Align;
  ordered?: boolean;
  number?: number;
  depth?: number;
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™', deg: '°',
  eacute: 'é', egrave: 'è', agrave: 'à', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', middot: '·', bull: '•', times: '×', shy: '',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      try { return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; } catch { return ''; }
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

type Format = Omit<Run, 'text' | 'br'>;

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li', 'pre', 'ul', 'ol', 'hr', 'section', 'article', 'center', 'table', 'tr']);
const SKIP_TAGS = new Set(['script', 'style', 'head', 'svg']);
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? '') : undefined;
}

function styleOf(attrs: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (attr(attrs, 'style') ?? '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

function alignOf(attrs: string): Align | undefined {
  const v = (styleOf(attrs)['text-align'] ?? attr(attrs, 'align') ?? '').toLowerCase();
  return v === 'center' || v === 'right' || v === 'justify' ? v : v === 'left' ? 'left' : undefined;
}

function firstFont(value: string): string | undefined {
  const name = value.split(',')[0].replace(/["']/g, '').trim();
  return name && !/^(inherit|initial|serif|sans-serif|monospace)$/i.test(name) ? name : undefined;
}

// what an inline tag (or a styled span) adds to the formatting underneath it.
function formatFor(tag: string, attrs: string, base: Format): Format {
  const f: Format = { ...base };
  if (tag === 'b' || tag === 'strong') f.bold = true;
  if (tag === 'i' || tag === 'em' || tag === 'cite') f.italic = true;
  if (tag === 'u' || tag === 'ins') f.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') f.strike = true;
  if (tag === 'sup') f.sup = true;
  if (tag === 'sub') f.sub = true;
  if (tag === 'font') {
    const face = attr(attrs, 'face');
    if (face) f.font = firstFont(face) ?? f.font;
  }
  const style = styleOf(attrs);
  const weight = style['font-weight'];
  if (weight && (/^(bold|bolder)$/i.test(weight) || parseInt(weight, 10) >= 600)) f.bold = true;
  if (weight && (/^(normal|lighter)$/i.test(weight) || parseInt(weight, 10) < 600)) f.bold = undefined;
  if (/italic|oblique/i.test(style['font-style'] ?? '')) f.italic = true;
  const deco = style['text-decoration'] ?? style['text-decoration-line'] ?? '';
  if (/underline/i.test(deco)) f.underline = true;
  if (/line-through/i.test(deco)) f.strike = true;
  if (style['font-family']) f.font = firstFont(style['font-family']) ?? f.font;
  return f;
}

const sameFormat = (a: Run, b: Run) =>
  !a.br && !b.br && !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline &&
  !!a.strike === !!b.strike && !!a.sup === !!b.sup && !!a.sub === !!b.sub && a.font === b.font;

const SCENE_BREAK = /^[*#~•·•∗]+(?:\s+[*#~•·•∗]+)*$/;

export function blockText(block: Block): string {
  return block.runs.map(r => (r.br ? '\n' : r.text)).join('');
}

export function parseHtmlBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  let runs: Run[] = [];
  let kind: BlockKind = 'p';
  let align: Align | undefined;
  let ordered: boolean | undefined;
  let number: number | undefined;
  let depth = 0;
  let open = false;
  let dropBlock = false;

  const lists: { ordered: boolean; count: number }[] = [];
  const formats: Format[] = [{}];
  const tagStack: { tag: string; pushedFormat: boolean; quote: boolean }[] = [];
  let quoteDepth = 0;
  let skipDepth = 0;

  const flush = () => {
    if (open) {
      // whitespace at the edges of a block is not content.
      while (runs.length && !runs[0].br && !runs[0].text.trim()) runs.shift();
      if (runs.length && !runs[0].br) runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, '') };
      while (runs.length && !runs[runs.length - 1].br && !runs[runs.length - 1].text.trim()) runs.pop();
      const last = runs.length - 1;
      if (last >= 0 && !runs[last].br) runs[last] = { ...runs[last], text: runs[last].text.replace(/\s+$/, '') };
      while (runs.length && runs[runs.length - 1].br) runs.pop();
      if (!dropBlock && runs.some(r => r.br || r.text)) {
        const block: Block = { kind, runs };
        if (align) block.align = align;
        if (kind === 'li') Object.assign(block, { ordered, number, depth });
        const text = blockText(block).trim();
        if (kind === 'p' && SCENE_BREAK.test(text)) blocks.push({ kind: 'break', runs: [] });
        else blocks.push(block);
      }
    }
    runs = [];
    open = false;
    dropBlock = false;
    kind = 'p';
    align = undefined;
  };

  const begin = (k: BlockKind, a?: Align) => {
    flush();
    kind = quoteDepth > 0 && k === 'p' ? 'quote' : k;
    align = a;
    open = true;
  };

  const addText = (raw: string) => {
    const text = decodeEntities(raw).replace(/[\t\r\n ]+/g, ' ');
    if (!text) return;
    if (!open) {
      if (!text.trim()) return;
      begin('p');
    }
    const fmt = formats[formats.length - 1];
    const run: Run = { text, ...fmt };
    const prev = runs[runs.length - 1];
    if (prev && sameFormat(prev, run)) {
      // two spaces in a row, across run boundaries, still count as one.
      prev.text += prev.text.endsWith(' ') && text.startsWith(' ') ? text.slice(1) : text;
    } else {
      runs.push(run);
    }
  };

  const tokens = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+|<)/g;
  for (const m of html.matchAll(tokens)) {
    if (m[4] !== undefined) {
      if (!skipDepth) addText(m[4]);
      continue;
    }
    if (m[2] === undefined) continue; // comment
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? '';

    if (SKIP_TAGS.has(tag)) {
      if (closing) skipDepth = Math.max(0, skipDepth - 1);
      else if (!attrs.trimEnd().endsWith('/')) skipDepth++;
      continue;
    }
    if (skipDepth) continue;

    if (!closing) {
      if (tag === 'br') {
        if (!open) begin('p');
        runs.push({ text: '', br: true });
        continue;
      }
      if (tag === 'hr') {
        flush();
        blocks.push({ kind: 'break', runs: [] });
        continue;
      }
      if (VOID_TAGS.has(tag)) continue; // pictures are not carried into these formats

      if (tag === 'ul' || tag === 'ol') {
        flush();
        lists.push({ ordered: tag === 'ol', count: 0 });
        tagStack.push({ tag, pushedFormat: false, quote: false });
        continue;
      }
      let quote = false;
      if (tag === 'blockquote') {
        flush();
        quoteDepth++;
        quote = true;
      } else if (tag === 'li') {
        begin('li', alignOf(attrs));
        const list = lists[lists.length - 1];
        if (list) list.count++;
        ordered = list?.ordered ?? false;
        number = list?.count ?? 1;
        depth = Math.max(0, lists.length - 1);
      } else if (/^h[1-6]$/.test(tag)) {
        begin(tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3', alignOf(attrs));
      } else if (tag === 'p' || tag === 'div' || tag === 'pre' || tag === 'center' || tag === 'section' || tag === 'article') {
        begin('p', tag === 'center' ? 'center' : alignOf(attrs));
        // the ornament under a scene break rule is part of that break, which was already added
        if (/\bdata-separator-mark\b/.test(attrs)) dropBlock = true;
      } else if (BLOCK_TAGS.has(tag)) {
        flush();
      }

      const next = formatFor(tag, attrs, formats[formats.length - 1]);
      formats.push(next);
      tagStack.push({ tag, pushedFormat: true, quote });
      continue;
    }

    // a closing tag: unwind to its opener, if it has one.
    let at = -1;
    for (let i = tagStack.length - 1; i >= 0; i--) if (tagStack[i].tag === tag) { at = i; break; }
    if (at < 0) continue;
    while (tagStack.length > at) {
      const done = tagStack.pop()!;
      if (done.pushedFormat) formats.pop();
      if (done.quote) quoteDepth = Math.max(0, quoteDepth - 1);
      if (done.tag === 'ul' || done.tag === 'ol') lists.pop();
    }
    if (BLOCK_TAGS.has(tag)) flush();
  }
  flush();
  return blocks;
}

export function plainText(blocks: Block[]): string {
  return blocks.map(blockText).join('\n\n');
}
