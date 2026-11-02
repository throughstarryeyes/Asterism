import type { CustomFontConfig, Project } from '../types';
import { getAsset, newAssetId, putAsset } from './assetStore';
import { BUILT_IN_FONTS, sniffFontFormat, uniqueFamily, type FontFormat } from './fontFiles';

// a font file carried inside an exported document.
export interface EmbeddedFont {
  family: string;
  format: FontFormat;
  // the font file, base64-encoded.
  data: string;
}

const MIME: Record<FontFormat, string> = {
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};
const CSS_FORMAT: Record<FontFormat, string> = {
  ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2',
};

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// fonts named in a chapter's HTML: <font face="X"> and font-family in styles.
export function fontFamiliesUsed(html: string): string[] {
  const found = new Set<string>();
  // browsers write quotes inside a style attribute as &quot;, and that ';' would end the match early.
  const text = html.replace(/&quot;/g, "'");
  for (const m of text.matchAll(/<font[^>]*\sface=["']([^"']+)["']/gi)) found.add(m[1].trim());
  for (const m of text.matchAll(/font-family:\s*([^;"]+)/gi)) {
    m[1].split(',').forEach(part => {
      const name = part.replace(/["']/g, '').trim();
      if (name) found.add(name);
    });
  }
  return [...found];
}

// every uploaded font a project actually uses (in its text, or as the document font).
export async function collectEmbeddedFonts(project: Project, customFonts: CustomFontConfig[], activeFont?: string): Promise<EmbeddedFont[]> {
  const wanted = new Set<string>(activeFont ? [activeFont] : []);
  project.chapters.forEach(c => fontFamiliesUsed(c.content).forEach(f => wanted.add(f)));
  if (project.storyTheme?.activeFont) wanted.add(project.storyTheme.activeFont);
  if (project.storyTheme?.customTheme?.fontFamily) wanted.add(project.storyTheme.customTheme.fontFamily);

  const out: EmbeddedFont[] = [];
  for (const font of customFonts) {
    if (!font.assetId || !wanted.has(font.family)) continue;
    const blob = await getAsset(font.assetId);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const format = sniffFontFormat(bytes);
    if (format) out.push({ family: font.family, format, data: bytesToBase64(bytes) });
  }
  return out;
}

export function fontFaceCss(fonts: EmbeddedFont[]): string {
  return fonts
    .map(f => `@font-face { font-family: "${f.family.replace(/"/g, '')}"; src: url(data:${MIME[f.format]};base64,${f.data}) format("${CSS_FORMAT[f.format]}"); font-display: swap; }`)
    .join('\n');
}

// bring fonts from a backup back into the app. `register` is injectable for tests.
export async function restoreEmbeddedFonts(
  fonts: EmbeddedFont[],
  existingFamilies: string[],
  register: (family: string, blob: Blob) => Promise<void>
): Promise<CustomFontConfig[]> {
  const restored: CustomFontConfig[] = [];
  const taken = [...existingFamilies];
  for (const f of fonts) {
    // same name already installed: reuse it rather than adding a duplicate.
    if (taken.some(t => t.toLowerCase() === f.family.toLowerCase())) continue;
    const family = uniqueFamily(f.family, taken);
    const blob = new Blob([base64ToBytes(f.data) as BlobPart], { type: MIME[f.format] });
    try {
      await register(family, blob);
    } catch {
      continue; // a corrupt font should not stop the rest of the restore
    }
    const assetId = await putAsset(blob, newAssetId('font'));
    restored.push({ id: assetId, name: family, family, source: 'local', assetId });
    taken.push(family);
  }
  return restored;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface HtmlExportOptions {
  fonts: EmbeddedFont[];
  documentFont: string;
  fontSize: number;
  lineHeight: number;
  indentParagraphs: boolean;
  // ornaments above the title and below the author, from the title page flourish the writer picked
  flourish?: { top: string; bottom: string };
}

// a single self-contained web page: opens anywhere, with the writer's fonts inside it.
export function buildStandaloneHtml(project: Project, opts: HtmlExportOptions): string {
  const embedded = new Set(opts.fonts.map(f => f.family));
  // built-in and Google fonts cannot be embedded offline; link them so they load when online.
  const used = new Set<string>([opts.documentFont, ...project.chapters.flatMap(c => fontFamiliesUsed(c.content))]);
  const linked = [...used].filter(f => !embedded.has(f) && BUILT_IN_FONTS.includes(f));
  const googleLink = linked.length
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${linked.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&')}&display=swap">`
    : '';
  const chapters = [...project.chapters]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => `<section class="chapter"><div class="chapter-number">Chapter ${i + 1}</div><h2>${esc(c.title.replace(/^Chapter\s+[IVXLCDM\d]+[:\s-]*/i, ''))}</h2><div class="body">${c.content}</div></section>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.title)}</title>
${googleLink}
<style>
${fontFaceCss(opts.fonts)}
body { margin: 0; background: #f6f2ea; color: #1f1a14; font-family: "${opts.documentFont.replace(/"/g, '')}", Georgia, serif; }
main { max-width: 42rem; margin: 0 auto; padding: 4rem 1.5rem 6rem; background: #fffdf8; }
.title-page { text-align: center; padding: 5rem 0 4rem; border-bottom: 1px solid #ddd3c0; margin-bottom: 3rem; }
.title-page h1 { font-size: 2.4rem; margin: 0 0 .5rem; }
.title-page .by { font-size: 1.1rem; letter-spacing: .05em; }
.title-page .orn { letter-spacing: .3em; margin: 1.5rem 0; }
.chapter { margin-top: 4rem; page-break-before: always; }
.chapter-number { text-align: center; text-transform: uppercase; letter-spacing: .15em; font-size: .8rem; color: #7a6f60; }
.chapter h2 { text-align: center; font-size: 1.6rem; margin: .3rem 0 2rem; }
.body { font-size: ${opts.fontSize}px; line-height: ${opts.lineHeight}; text-align: justify; }
.body p { margin: 0 0 ${opts.indentParagraphs ? '0' : '1em'}; ${opts.indentParagraphs ? 'text-indent: 1.5em;' : ''} }
blockquote { margin: 1.2em 2em; font-style: italic; }
@media print { body { background: #fff; } main { max-width: none; padding: 0; } }
</style>
</head>
<body>
<main>
<div class="title-page">${opts.flourish?.top ? `<div class="orn">${esc(opts.flourish.top)}</div>` : ''}<h1>${esc(project.title)}</h1>${project.subtitle ? `<div>${esc(project.subtitle)}</div>` : ''}<div class="by">By ${esc(project.author)}</div>${opts.flourish?.bottom ? `<div class="orn">${esc(opts.flourish.bottom)}</div>` : ''}</div>
${chapters}
</main>
</body>
</html>`;
}
