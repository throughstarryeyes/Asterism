import type { Align, Block, Run } from './htmlBlocks';
import type { ExportManuscript } from './manuscript';
import { buildZip } from './zip';

export interface DocxOptions {
  documentFont: string;
  // editor size in CSS pixels.
  fontSize: number;
  lineHeight: number;
  indentParagraphs: boolean;
  // ornaments above the title and below the author, from the title page flourish the writer picked
  flourish?: { top: string; bottom: string };
}

// XML 1.0 forbids most control characters; a stray one would make Word refuse the file.
const xml = (s: string) =>
  // eslint-disable-next-line no-control-regex
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const JC: Record<Align, string> = { left: 'left', center: 'center', right: 'right', justify: 'both' };

function runXml(run: Run, defaultFont: string): string {
  if (run.br) return '<w:r><w:br/></w:r>';
  const props: string[] = [];
  if (run.font && run.font !== defaultFont) {
    const f = xml(run.font);
    props.push(`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>`);
  }
  if (run.bold) props.push('<w:b/>');
  if (run.italic) props.push('<w:i/>');
  if (run.strike) props.push('<w:strike/>');
  if (run.underline) props.push('<w:u w:val="single"/>');
  if (run.sup) props.push('<w:vertAlign w:val="superscript"/>');
  if (run.sub) props.push('<w:vertAlign w:val="subscript"/>');
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xml(run.text)}</w:t></w:r>`;
}

function paragraph(style: string | undefined, runs: string, extra = ''): string {
  const pPr = `${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}`;
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
}

function blockXml(block: Block, font: string, indent: boolean, firstInSection: boolean, pageBreak = false): string {
  // pageBreakBefore must sit right after the style, ahead of indents and alignment.
  const pre = pageBreak ? '<w:pageBreakBefore/>' : '';
  if (block.kind === 'break') return paragraph('SceneBreak', '<w:r><w:t xml:space="preserve">*   *   *</w:t></w:r>', pre);
  const jc = block.align ? `<w:jc w:val="${JC[block.align]}"/>` : '';
  const runs = block.runs.map(r => runXml(r, font)).join('');
  if (block.kind === 'h1' || block.kind === 'h2' || block.kind === 'h3') {
    return paragraph(block.kind === 'h1' ? 'Heading2' : block.kind === 'h2' ? 'Heading3' : 'Heading4', runs, pre + jc);
  }
  if (block.kind === 'quote') return paragraph('Quote', runs, pre + jc);
  if (block.kind === 'li') {
    const level = (block.depth ?? 0) + 1;
    const marker = block.ordered ? `${block.number ?? 1}.` : '•';
    const mark = `<w:r><w:t xml:space="preserve">${marker}</w:t></w:r><w:r><w:tab/></w:r>`;
    return paragraph('ListParagraph', mark + runs, `${pre}<w:ind w:left="${720 * level}" w:hanging="360"/>${jc}`);
  }
  // fiction convention: no indent on the first paragraph of a chapter or after a break.
  return paragraph(undefined, runs, pre + (indent && firstInSection ? `<w:ind w:firstLine="0"/>${jc}` : jc));
}

export function buildDocumentXml(m: ExportManuscript, opts: DocxOptions): string {
  const font = opts.documentFont;
  const body: string[] = [];

  const ornament = (text?: string) => (text ? [paragraph('Subtitle', `<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`)] : []);
  body.push(...ornament(opts.flourish?.top));
  body.push(paragraph('Title', `<w:r><w:t xml:space="preserve">${xml(m.title)}</w:t></w:r>`));
  if (m.subtitle) body.push(paragraph('Subtitle', `<w:r><w:t xml:space="preserve">${xml(m.subtitle)}</w:t></w:r>`));
  if (m.author) body.push(paragraph('Author', `<w:r><w:t xml:space="preserve">by ${xml(m.author)}</w:t></w:r>`));
  body.push(...ornament(opts.flourish?.bottom));

  m.chapters.forEach(ch => {
    let pending = true; // a page break is still owed to the first thing in this chapter
    if (ch.label) {
      body.push(paragraph('ChapterLabel', `<w:r><w:t xml:space="preserve">${xml(ch.label)}</w:t></w:r>`, '<w:pageBreakBefore/>'));
      pending = false;
    }
    if (ch.title) {
      body.push(paragraph('Heading1', `<w:r><w:t xml:space="preserve">${xml(ch.title)}</w:t></w:r>`, pending ? '<w:pageBreakBefore/>' : ''));
      pending = false;
    }
    let first = true;
    ch.blocks.forEach((b, i) => {
      body.push(blockXml(b, font, opts.indentParagraphs, first, pending && i === 0));
      first = b.kind === 'break' || b.kind === 'h1' || b.kind === 'h2' || b.kind === 'h3';
    });
  });

  const sect = '<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/><w:titlePg/></w:sectPr>';
  return `${HEAD}<w:document ${NS}><w:body>${body.join('')}${sect}</w:body></w:document>`;
}

export function buildStylesXml(opts: DocxOptions): string {
  const font = xml(opts.documentFont);
  const half = Math.max(16, Math.round(opts.fontSize * 1.5)); // px -> pt -> half-points
  const line = Math.round(Math.min(3, Math.max(1, opts.lineHeight)) * 240);
  const after = opts.indentParagraphs ? 0 : 200;
  const first = opts.indentParagraphs ? '<w:ind w:firstLine="720"/>' : '';
  const style = (id: string, name: string, ppr: string, rpr: string, extra = '') =>
    `<w:style w:type="paragraph" w:styleId="${id}"${extra}><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
  return `${HEAD}<w:styles ${NS}>` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${half}"/><w:szCs w:val="${half}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="${after}" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>${first}</w:pPr></w:style>` +
    style('Title', 'Title', '<w:spacing w:before="3600" w:after="240"/><w:jc w:val="center"/>', `<w:b/><w:sz w:val="${half * 2 + 8}"/>`) +
    style('Subtitle', 'Subtitle', '<w:spacing w:after="240"/><w:jc w:val="center"/>', `<w:i/><w:sz w:val="${half + 6}"/>`) +
    style('Author', 'Author', '<w:spacing w:before="480"/><w:jc w:val="center"/>', `<w:sz w:val="${half + 4}"/>`) +
    style('ChapterLabel', 'Chapter Label', '<w:keepNext/><w:spacing w:before="1200" w:after="120"/><w:jc w:val="center"/>', `<w:caps/><w:spacing w:val="40"/><w:sz w:val="${Math.max(16, half - 4)}"/>`) +
    style('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="240" w:after="480"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/>', `<w:b/><w:sz w:val="${half + 12}"/>`, '') +
    style('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="360" w:after="200"/><w:outlineLvl w:val="1"/>', `<w:b/><w:sz w:val="${half + 8}"/>`) +
    style('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="280" w:after="160"/><w:outlineLvl w:val="2"/>', `<w:b/><w:sz w:val="${half + 4}"/>`) +
    style('Heading4', 'heading 4', '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="3"/>', `<w:b/><w:i/>`) +
    style('Quote', 'Quote', '<w:ind w:left="720" w:right="720" w:firstLine="0"/>', '<w:i/>') +
    style('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/><w:ind w:firstLine="0"/>', '') +
    style('SceneBreak', 'Scene Break', '<w:spacing w:before="240" w:after="240"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', '') +
    style('Footer', 'footer', '<w:spacing w:after="0"/><w:ind w:firstLine="0"/><w:jc w:val="center"/>', `<w:sz w:val="${Math.max(16, half - 4)}"/>`) +
    '</w:styles>';
}

const FOOTER = `${HEAD}<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr>` +
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';

export function buildDocx(m: ExportManuscript, opts: DocxOptions, when: Date = new Date()): Uint8Array {
  const iso = when.toISOString().replace(/\.\d+Z$/, 'Z');
  return buildZip([
    { path: '[Content_Types].xml', data: `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { path: '_rels/.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { path: 'word/_rels/document.xml.rels', data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>` },
    { path: 'word/document.xml', data: buildDocumentXml(m, opts) },
    { path: 'word/styles.xml', data: buildStylesXml(opts) },
    { path: 'word/footer1.xml', data: FOOTER },
    { path: 'docProps/core.xml', data: `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(m.title)}</dc:title><dc:creator>${xml(m.author)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>` },
  ], when);
}
