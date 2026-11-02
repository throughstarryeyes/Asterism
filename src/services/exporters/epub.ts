import type { EmbeddedFont } from '../exportFonts';
import type { Align, Block, Run } from './htmlBlocks';
import type { ExportChapter, ExportManuscript } from './manuscript';
import { buildZip } from './zip';

export interface EpubOptions {
  // used for the book's unique id; the same project always gives the same id.
  identifier: string;
  fonts: EmbeddedFont[];
  documentFont: string;
  lineHeight: number;
  indentParagraphs: boolean;
  // ornaments above the title and below the author, from the title page flourish the writer picked
  flourish?: { top: string; bottom: string };
}

const xml = (s: string) =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const FONT_TYPE = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' } as const;
const CSS_FORMAT = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' } as const;

function runHtml(run: Run, defaultFont: string): string {
  if (run.br) return '<br/>';
  let out = xml(run.text);
  if (run.font && run.font !== defaultFont) out = `<span style="font-family: '${xml(run.font).replace(/'/g, '')}'">${out}</span>`;
  if (run.sub) out = `<sub>${out}</sub>`;
  if (run.sup) out = `<sup>${out}</sup>`;
  if (run.strike) out = `<s>${out}</s>`;
  if (run.underline) out = `<u>${out}</u>`;
  if (run.italic) out = `<em>${out}</em>`;
  if (run.bold) out = `<strong>${out}</strong>`;
  return out;
}

const alignClass = (a?: Align) => (a && a !== 'left' ? ` class="${a}"` : '');

export function blocksHtml(blocks: Block[], defaultFont: string): string {
  const out: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;
  const closeList = () => {
    if (list) out.push(`<${list.ordered ? 'ol' : 'ul'}>${list.items.join('')}</${list.ordered ? 'ol' : 'ul'}>`);
    list = undefined;
  };
  let afterBreak = true;
  for (const b of blocks) {
    const inner = b.runs.map(r => runHtml(r, defaultFont)).join('');
    if (b.kind === 'li') {
      const ordered = !!b.ordered;
      if (list && list.ordered !== ordered) closeList();
      if (!list) list = { ordered, items: [] };
      list.items.push(`<li${alignClass(b.align)}>${inner}</li>`);
      continue;
    }
    closeList();
    if (b.kind === 'break') { out.push('<p class="break">*&#160;&#160;&#160;*&#160;&#160;&#160;*</p>'); afterBreak = true; continue; }
    if (b.kind === 'h1') out.push(`<h2${alignClass(b.align)}>${inner}</h2>`);
    else if (b.kind === 'h2') out.push(`<h3${alignClass(b.align)}>${inner}</h3>`);
    else if (b.kind === 'h3') out.push(`<h4${alignClass(b.align)}>${inner}</h4>`);
    else if (b.kind === 'quote') out.push(`<blockquote><p${alignClass(b.align)}>${inner}</p></blockquote>`);
    else {
      const classes = [b.align && b.align !== 'left' ? b.align : '', afterBreak ? 'first' : ''].filter(Boolean).join(' ');
      out.push(`<p${classes ? ` class="${classes}"` : ''}>${inner}</p>`);
    }
    afterBreak = b.kind === 'h1' || b.kind === 'h2' || b.kind === 'h3';
  }
  closeList();
  return out.join('\n');
}

const page = (title: string, lang: string, body: string, extraHead = '') =>
  `${HEAD}<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">\n` +
  `<head><meta charset="utf-8"/><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/>${extraHead}</head>\n<body>\n${body}\n</body>\n</html>`;

const chapterName = (i: number) => `ch${String(i + 1).padStart(3, '0')}.xhtml`;
const heading = (ch: ExportChapter, i: number) => [ch.label, ch.title].filter(Boolean).join(': ') || `Part ${i + 1}`;

export function buildCss(opts: EpubOptions, fontFiles: { family: string; file: string; format: EmbeddedFont['format'] }[]): string {
  const faces = fontFiles
    .map(f => `@font-face { font-family: "${f.family.replace(/"/g, '')}"; src: url(fonts/${f.file}) format("${CSS_FORMAT[f.format]}"); }`)
    .join('\n');
  const family = opts.documentFont.replace(/"/g, '');
  return `${faces}
body { font-family: "${family}", Georgia, serif; line-height: ${opts.lineHeight}; margin: 0 5%; }
h1, h2, h3, h4 { font-family: inherit; line-height: 1.25; }
.title-page { text-align: center; margin-top: 25%; }
.title-page h1 { font-size: 2.2em; margin-bottom: .4em; }
.title-page .orn { letter-spacing: .3em; margin: 1.5em 0; }
.title-page .subtitle { font-style: italic; font-size: 1.2em; }
.title-page .by { margin-top: 2em; letter-spacing: .05em; }
.chapter-label { text-align: center; text-transform: uppercase; letter-spacing: .15em; font-size: .8em; margin: 3em 0 0; }
h2.chapter-title { text-align: center; font-size: 1.6em; margin: .3em 0 1.6em; }
p { margin: 0 0 ${opts.indentParagraphs ? '0' : '1em'}; text-align: justify; hyphens: auto; ${opts.indentParagraphs ? 'text-indent: 1.5em;' : ''} }
p.first, p.break { text-indent: 0; }
p.center { text-align: center; text-indent: 0; }
p.right { text-align: right; text-indent: 0; }
p.justify { text-align: justify; }
p.break { text-align: center; margin: 1.5em 0; }
blockquote { margin: 1em 2em; font-style: italic; }
blockquote p { text-indent: 0; }
li { margin-bottom: .3em; }
`;
}

export function buildEpub(m: ExportManuscript, opts: EpubOptions, when: Date = new Date()): Uint8Array {
  const lang = m.language || 'en';
  const stamp = when.toISOString().replace(/\.\d+Z$/, 'Z');
  const uid = `urn:uuid:${opts.identifier}`;

  const fontFiles = opts.fonts.map((f, i) => ({
    family: f.family,
    format: f.format,
    file: `${(f.family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'font')}-${i + 1}.${f.format}`,
    data: f.data,
  }));

  const titlePage = page(m.title, lang,
    `<div class="title-page">\n${opts.flourish?.top ? `<p class="orn">${xml(opts.flourish.top)}</p>\n` : ''}<h1>${xml(m.title)}</h1>${m.subtitle ? `\n<p class="subtitle">${xml(m.subtitle)}</p>` : ''}${m.author ? `\n<p class="by">by ${xml(m.author)}</p>` : ''}${opts.flourish?.bottom ? `\n<p class="orn">${xml(opts.flourish.bottom)}</p>` : ''}\n</div>`);

  const chapterPages = m.chapters.map((ch, i) => {
    const head = (ch.label ? `<p class="chapter-label">${xml(ch.label)}</p>\n` : '') + (ch.title ? `<h2 class="chapter-title">${xml(ch.title)}</h2>\n` : '');
    return page(heading(ch, i), lang, head + blocksHtml(ch.blocks, opts.documentFont));
  });

  const nav = page('Contents', lang,
    `<nav epub:type="toc" id="toc"><h1>Contents</h1>\n<ol>\n<li><a href="title.xhtml">${xml(m.title)}</a></li>\n` +
    m.chapters.map((ch, i) => `<li><a href="${chapterName(i)}">${xml(heading(ch, i))}</a></li>`).join('\n') +
    '\n</ol></nav>');

  const ncx = `${HEAD}<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${xml(uid)}"/><meta name="dtb:depth" content="1"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>` +
    `<docTitle><text>${xml(m.title)}</text></docTitle><navMap>` +
    `<navPoint id="n0" playOrder="1"><navLabel><text>${xml(m.title)}</text></navLabel><content src="title.xhtml"/></navPoint>` +
    m.chapters.map((ch, i) => `<navPoint id="n${i + 1}" playOrder="${i + 2}"><navLabel><text>${xml(heading(ch, i))}</text></navLabel><content src="${chapterName(i)}"/></navPoint>`).join('') +
    '</navMap></ncx>';

  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="style.css" media-type="text/css"/>',
    '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
    ...m.chapters.map((_, i) => `<item id="ch${i + 1}" href="${chapterName(i)}" media-type="application/xhtml+xml"/>`),
    ...fontFiles.map((f, i) => `<item id="font${i + 1}" href="fonts/${f.file}" media-type="${FONT_TYPE[f.format]}"/>`),
  ].join('\n');
  const spine = ['<itemref idref="title"/>', ...m.chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`)].join('\n');

  const opf = `${HEAD}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">\n` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${xml(uid)}</dc:identifier><dc:title>${xml(m.title)}</dc:title>` +
    `${m.author ? `<dc:creator>${xml(m.author)}</dc:creator>` : ''}<dc:language>${lang}</dc:language><meta property="dcterms:modified">${stamp}</meta></metadata>\n` +
    `<manifest>\n${manifest}\n</manifest>\n<spine toc="ncx">\n${spine}\n</spine>\n</package>`;

  return buildZip([
    // the spec wants this first, and stored rather than compressed (buildZip never compresses).
    { path: 'mimetype', data: 'application/epub+zip' },
    { path: 'META-INF/container.xml', data: `${HEAD}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>` },
    { path: 'OEBPS/content.opf', data: opf },
    { path: 'OEBPS/nav.xhtml', data: nav },
    { path: 'OEBPS/toc.ncx', data: ncx },
    { path: 'OEBPS/style.css', data: buildCss(opts, fontFiles) },
    { path: 'OEBPS/title.xhtml', data: titlePage },
    ...chapterPages.map((html, i) => ({ path: `OEBPS/${chapterName(i)}`, data: html })),
    ...fontFiles.map(f => ({ path: `OEBPS/fonts/${f.file}`, data: base64ToBytes(f.data) })),
  ], when);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
