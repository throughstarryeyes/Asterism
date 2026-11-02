import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { putAsset, getAsset } from '../assetStore';
import {
  base64ToBytes, buildStandaloneHtml, bytesToBase64, collectEmbeddedFonts, fontFaceCss, fontFamiliesUsed, restoreEmbeddedFonts,
} from '../exportFonts';
import { DEFAULT_PROJECT } from '../../data/defaultProject';
import type { CustomFontConfig, Project } from '../../types';

// the smallest thing that sniffs as a TrueType font.
const FONT_BYTES = new Uint8Array([0, 1, 0, 0, 9, 8, 7, 6, 5, 4, 3, 2, 1]);

const project = (html: string): Project => ({
  ...DEFAULT_PROJECT,
  title: 'My <Book>',
  author: 'A. Writer',
  chapters: [{ id: 'c1', title: 'Chapter 1: Start', order: 1, content: html, wordCount: 3, status: 'draft', updatedAt: '' }],
});

describe('base64', () => {
  it('round-trips bytes, including large ones', () => {
    expect(Array.from(base64ToBytes(bytesToBase64(FONT_BYTES)))).toEqual(Array.from(FONT_BYTES));
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });
});

describe('finding the fonts a document uses', () => {
  it('reads font tags and styles', () => {
    const html = '<p><font face="Lobster Two">hi</font> <span style="font-family: &quot;Fancy Hand&quot;, serif">x</span></p>';
    expect(fontFamiliesUsed(html).sort()).toEqual(['Fancy Hand', 'Lobster Two', 'serif'].sort());
  });
  it('finds nothing in plain text', () => {
    expect(fontFamiliesUsed('<p>just words</p>')).toEqual([]);
  });
});

describe('embedding fonts on export', () => {
  it('includes uploaded fonts the text uses, and only those', async () => {
    const used = await putAsset(new Blob([FONT_BYTES]), 'font-used');
    const unused = await putAsset(new Blob([FONT_BYTES]), 'font-unused');
    const fonts: CustomFontConfig[] = [
      { id: used, name: 'Fancy Hand', family: 'Fancy Hand', source: 'local', assetId: used },
      { id: unused, name: 'Other', family: 'Other', source: 'local', assetId: unused },
      { id: 'g', name: 'Google', family: 'Google', source: 'google' },
    ];
    const out = await collectEmbeddedFonts(project('<p><font face="Fancy Hand">x</font></p>'), fonts, 'Lora');
    expect(out.map(f => f.family)).toEqual(['Fancy Hand']);
    expect(out[0].format).toBe('ttf');
  });
  it('includes the document font even if no text names it', async () => {
    const id = await putAsset(new Blob([FONT_BYTES]), 'font-doc');
    const out = await collectEmbeddedFonts(project('<p>plain</p>'), [{ id, name: 'Doc', family: 'Doc', source: 'local', assetId: id }], 'Doc');
    expect(out.map(f => f.family)).toEqual(['Doc']);
  });
  it('skips a font whose file has gone missing', async () => {
    const out = await collectEmbeddedFonts(project('<p><font face="Gone">x</font></p>'), [{ id: 'x', name: 'Gone', family: 'Gone', source: 'local', assetId: 'missing' }]);
    expect(out).toEqual([]);
  });
  it('writes @font-face rules with the font data inside', () => {
    const css = fontFaceCss([{ family: 'Fancy Hand', format: 'ttf', data: bytesToBase64(FONT_BYTES) }]);
    expect(css).toContain('font-family: "Fancy Hand"');
    expect(css).toContain('data:font/ttf;base64,');
    expect(css).toContain('format("truetype")');
  });
});

describe('standalone web page', () => {
  const html = buildStandaloneHtml(project('<p>Hello</p>'), {
    fonts: [{ family: 'Fancy Hand', format: 'ttf', data: bytesToBase64(FONT_BYTES) }],
    documentFont: 'Fancy Hand', fontSize: 18, lineHeight: 1.8, indentParagraphs: true,
  });
  it('contains the book, the embedded font and uses it', () => {
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('@font-face');
    expect(html).toContain('font-family: "Fancy Hand", Georgia, serif');
  });
  it('escapes the title so it cannot break the page', () => {
    expect(html).toContain('<title>My &lt;Book&gt;</title>');
    expect(html).not.toContain('<title>My <Book>');
  });
  it('links built-in fonts it cannot embed', () => {
    const page = buildStandaloneHtml(project('<p>x</p>'), { fonts: [], documentFont: 'Lora', fontSize: 18, lineHeight: 1.8, indentParagraphs: false });
    expect(page).toContain('fonts.googleapis.com');
    expect(page).toContain('family=Lora');
  });
});

describe('restoring fonts from a backup', () => {
  const register = async () => undefined;
  it('installs fonts, stores them, and keeps their names', async () => {
    const restored = await restoreEmbeddedFonts([{ family: 'Fancy Hand', format: 'ttf', data: bytesToBase64(FONT_BYTES) }], [], register);
    expect(restored).toHaveLength(1);
    expect(restored[0].family).toBe('Fancy Hand');
    expect(restored[0].source).toBe('local');
    expect(await getAsset(restored[0].assetId!)).toBeDefined();
  });
  it('does not duplicate a font you already have', async () => {
    const restored = await restoreEmbeddedFonts([{ family: 'fancy hand', format: 'ttf', data: bytesToBase64(FONT_BYTES) }], ['Fancy Hand'], register);
    expect(restored).toEqual([]);
  });
  it('carries on past a font the browser rejects', async () => {
    const reject = async (family: string) => { if (family === 'Bad') throw new Error('nope'); };
    const restored = await restoreEmbeddedFonts([
      { family: 'Bad', format: 'ttf', data: bytesToBase64(FONT_BYTES) },
      { family: 'Good', format: 'ttf', data: bytesToBase64(FONT_BYTES) },
    ], [], reject);
    expect(restored.map(f => f.family)).toEqual(['Good']);
  });
});
