import { describe, it, expect } from 'vitest';
import { parseHtmlBlocks, blockText } from '../htmlBlocks';
import { buildZip, readZip, crc32 } from '../zip';
import { buildDocx } from '../docx';
import { buildEpub } from '../epub';
import { prepareManuscript, splitChapterTitle } from '../manuscript';
import type { Project } from '../../../types';

const text = (html: string) => parseHtmlBlocks(html).map(blockText);

// every opened tag is closed in order and attributes are quoted: a stand-in for a real XML parser.
function wellFormed(doc: string): boolean {
  const body = doc.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '');
  const stack: string[] = [];
  for (const m of body.matchAll(/<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]);
  }
  const leftovers = body.replace(/<[^>]*>/g, '');
  return stack.length === 0 && !/[<>]/.test(leftovers) && !/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(leftovers);
}

const project = (chapters: { title: string; content: string }[], extra: Partial<Project> = {}): Project => ({
  id: 'p1', title: 'The Salt Road', author: 'A. Writer', genre: '', synopsis: '',
  chapters: chapters.map((c, i) => ({ id: `c${i}`, order: i, wordCount: 0, ...c })),
  ...extra,
} as unknown as Project);

const opts = { documentFont: 'Georgia', fontSize: 16, lineHeight: 1.6, indentParagraphs: true };

describe('html to blocks', () => {
  it('keeps paragraphs, formatting and entities', () => {
    const blocks = parseHtmlBlocks('<p>She said <b>no</b> &amp; <i>meant</i> it&hellip;</p><p>Next.</p>');
    expect(blocks.map(blockText)).toEqual(['She said no & meant it…', 'Next.']);
    expect(blocks[0].runs.filter(r => r.bold).map(r => r.text)).toEqual(['no']);
    expect(blocks[0].runs.filter(r => r.italic).map(r => r.text)).toEqual(['meant']);
  });

  it('reads styled spans, fonts, alignment and line breaks', () => {
    const [p] = parseHtmlBlocks('<div style="text-align: center;">one<br>two <span style="font-weight: bold; font-family: &quot;Lora&quot;, serif">bold</span> <font face="Merriweather">x</font></div>');
    expect(p.align).toBe('center');
    expect(blockText(p)).toBe('one\ntwo bold x');
    expect(p.runs.find(r => r.text === 'bold')).toMatchObject({ bold: true, font: 'Lora' });
    expect(p.runs.find(r => r.text === 'x')?.font).toBe('Merriweather');
  });

  it('numbers lists, nests quotes, and turns rules and lone asterisks into scene breaks', () => {
    const blocks = parseHtmlBlocks('<ol><li>a</li><li>b</li></ol><ul><li>c</li></ul><blockquote><p>quoted</p></blockquote><hr><p>* * *</p><p>after</p>');
    expect(blocks.map(b => b.kind)).toEqual(['li', 'li', 'li', 'quote', 'break', 'break', 'p']);
    expect(blocks.slice(0, 3).map(b => [b.ordered, b.number])).toEqual([[true, 1], [true, 2], [false, 1]]);
  });

  it('drops empty paragraphs and scripts, and collapses whitespace', () => {
    expect(text('<p></p><p><br></p><script>alert(1)</script><p>  too \n  many   spaces </p>')).toEqual(['too many spaces']);
    expect(text('loose text<p>then a paragraph</p>')).toEqual(['loose text', 'then a paragraph']);
  });
});

describe('zip', () => {
  it('round-trips files and uses the standard checksum', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const zip = buildZip([{ path: 'a.txt', data: 'héllo' }, { path: 'dir/b.bin', data: new Uint8Array([1, 2, 3]) }]);
    const back = readZip(zip);
    expect(back.map(e => e.path)).toEqual(['a.txt', 'dir/b.bin']);
    expect(new TextDecoder().decode(back[0].data as Uint8Array)).toBe('héllo');
    expect(Array.from(back[1].data as Uint8Array)).toEqual([1, 2, 3]);
  });
});

describe('chapter titles', () => {
  it('separates a "Chapter N" label from the title, and leaves other titles alone', () => {
    expect(splitChapterTitle('Chapter 3: The Fall')).toEqual({ label: 'Chapter 3', title: 'The Fall' });
    expect(splitChapterTitle('Chapter IV - Salt')).toEqual({ label: 'Chapter IV', title: 'Salt' });
    expect(splitChapterTitle('Prologue')).toEqual({ title: 'Prologue' });
  });
});

describe('docx', () => {
  const p = project([
    { title: 'Chapter 1: Salt', content: '<p>First <b>line</b> with "quotes" & <i>more</i>.</p><p>Second.</p><p>* * *</p><p>Third.</p>' },
    { title: 'Epilogue', content: '<ul><li>one</li></ul>' },
  ]);
  const files = readZip(buildDocx(prepareManuscript(p), opts));
  const part = (name: string) => new TextDecoder().decode(files.find(f => f.path === name)!.data as Uint8Array);

  it('has the parts Word needs, all well-formed', () => {
    expect(files.map(f => f.path)).toEqual(expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']));
    for (const f of files) expect(wellFormed(new TextDecoder().decode(f.data as Uint8Array)), f.path).toBe(true);
  });

  it('writes the title page, chapter headings and formatted text', () => {
    const doc = part('word/document.xml');
    expect(doc).toContain('The Salt Road');
    expect(doc).toContain('by A. Writer');
    expect(doc).toContain('<w:pStyle w:val="ChapterLabel"/><w:pageBreakBefore/>');
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect(doc).toContain('<w:b/></w:rPr><w:t xml:space="preserve">line</w:t>');
    expect(doc).toContain('&quot;quotes&quot; &amp; ');
    expect(doc).toContain('SceneBreak');
    // "Epilogue" has no label, so its title carries the page break.
    expect(doc).toContain('<w:pStyle w:val="Heading1"/><w:pageBreakBefore/>');
  });

  it('does not indent the first paragraph of a chapter or the one after a break', () => {
    const doc = part('word/document.xml');
    expect(doc.match(/<w:ind w:firstLine="0"\/>/g)?.length).toBe(2); // the chapter opener and the paragraph after the break
  });

  it('survives characters XML cannot hold', () => {
    const odd = prepareManuscript(project([{ title: 'T', content: '<p>bad \u0001 char and <not a tag</p>' }]));
    expect(wellFormed(new TextDecoder().decode(readZip(buildDocx(odd, opts)).find(f => f.path === 'word/document.xml')!.data as Uint8Array))).toBe(true);
  });
});

describe('epub', () => {
  const p = project([
    { title: 'Chapter 1: Salt', content: '<p>One <b>bold</b>.</p><p>* * *</p><p>Two.</p>' },
    { title: 'Epilogue', content: '<ol><li>x</li><li>y</li></ol><blockquote><p>q</p></blockquote>' },
  ], { subtitle: 'A Novel' });
  const font = { family: 'Lora', format: 'ttf' as const, data: btoa('fontbytes') };
  const files = readZip(buildEpub(prepareManuscript(p), { identifier: 'abc-123', fonts: [font], documentFont: 'Lora', lineHeight: 1.5, indentParagraphs: false }));
  const part = (name: string) => new TextDecoder().decode(files.find(f => f.path === name)!.data as Uint8Array);

  it('starts with an uncompressed mimetype, as the spec requires', () => {
    expect(files[0].path).toBe('mimetype');
    expect(part('mimetype')).toBe('application/epub+zip');
  });

  it('lists every chapter and font in the manifest, spine and contents', () => {
    const opf = part('OEBPS/content.opf');
    for (const name of ['title.xhtml', 'ch001.xhtml', 'ch002.xhtml', 'fonts/lora-1.ttf']) {
      expect(opf).toContain(`href="${name}"`);
      expect(files.some(f => f.path === `OEBPS/${name}`), name).toBe(true);
    }
    expect(opf).toContain('<itemref idref="ch2"/>');
    expect(opf).toContain('urn:uuid:abc-123');
    expect(part('OEBPS/nav.xhtml')).toContain('Chapter 1: Salt');
    expect(part('OEBPS/style.css')).toContain('@font-face { font-family: "Lora"; src: url(fonts/lora-1.ttf)');
  });

  it('writes well-formed pages with the formatting kept', () => {
    for (const f of files.filter(f => /\.(xhtml|opf|ncx)$/.test(f.path))) expect(wellFormed(new TextDecoder().decode(f.data as Uint8Array)), f.path).toBe(true);
    const ch1 = part('OEBPS/ch001.xhtml');
    expect(ch1).toContain('<strong>bold</strong>');
    expect(ch1).toContain('class="break"');
    expect(part('OEBPS/ch002.xhtml')).toContain('<ol><li>x</li><li>y</li></ol>');
    expect(part('OEBPS/title.xhtml')).toContain('A Novel');
  });
});

describe('title page flourish', () => {
  const p = project([{ title: 'One', content: '<p>x</p>' }]);
  const flourish = { top: '❦ ✦ ❦', bottom: '~ ~ ~' };
  const decode = (bytes: Uint8Array, name: string) => new TextDecoder().decode(readZip(bytes).find(f => f.path === name)!.data as Uint8Array);

  it('puts the ornaments around the title in the e-book and keeps it well-formed', () => {
    const title = decode(buildEpub(prepareManuscript(p), { identifier: 'a', fonts: [], documentFont: 'Lora', lineHeight: 1.5, indentParagraphs: false, flourish }), 'OEBPS/title.xhtml');
    expect(title.indexOf('❦ ✦ ❦')).toBeLessThan(title.indexOf('<h1>'));
    expect(title.indexOf('~ ~ ~')).toBeGreaterThan(title.indexOf('by A. Writer'));
    expect(wellFormed(title)).toBe(true);
  });

  it('puts them around the title in the Word document', () => {
    const doc = decode(buildDocx(prepareManuscript(p), { ...opts, flourish }), 'word/document.xml');
    expect(doc.indexOf('❦ ✦ ❦')).toBeLessThan(doc.indexOf('The Salt Road'));
    expect(doc.indexOf('~ ~ ~')).toBeGreaterThan(doc.indexOf('by A. Writer'));
    expect(wellFormed(doc)).toBe(true);
  });

  it('adds nothing when the flourish is bare', () => {
    const plain = decode(buildDocx(prepareManuscript(p), opts), 'word/document.xml');
    const bare = decode(buildDocx(prepareManuscript(p), { ...opts, flourish: { top: '', bottom: '' } }), 'word/document.xml');
    expect(bare).toBe(plain);
  });
});
