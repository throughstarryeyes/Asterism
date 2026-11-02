// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { editorExtensions } from '../extensions';
import { editorHtml } from '../html';
import { DEFAULT_PROJECT } from '../../data/defaultProject';
import { separatorHtml } from '../../services/ornaments';
import { SCENE_BREAK } from '../../services/openDraft';

// chapters go into the new editor as html and come back out as html. nothing the writer made may change on the way.
// "the same" means the same document: the same blocks, and every character carrying the same marks.

const open = (html: string) => new Editor({ extensions: editorExtensions(), content: html, element: document.createElement('div') });

function through(html: string) {
  const first = open(html);
  const model = first.getJSON();
  const out = editorHtml(first);
  first.destroy();
  const second = open(out);
  const again = second.getJSON();
  second.destroy();
  return { model, out, again };
}

// jsdom rewrites the style on a rule when it writes html (real browsers do not), so rule styles are checked on the model instead
const withoutRuleStyle = (n: JSONContent): JSONContent =>
  n.type === 'horizontalRule' ? { ...n, attrs: { ...n.attrs, style: null } } : { ...n, content: n.content?.map(withoutRuleStyle) };

const text = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent ?? ''; };

function same(html: string) {
  const { model, again, out } = through(html);
  expect(withoutRuleStyle(again)).toEqual(withoutRuleStyle(model));
  expect(text(out)).toBe(text(html).replace(/\n/g, ''));
  return { model, out };
}

// every run of text with the marks it carries, flattened so nesting order does not matter
function runs(model: JSONContent): string[] {
  const out: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.type === 'text') out.push(`${(n.marks ?? []).map(m => `${m.type}${m.attrs && Object.keys(m.attrs).length ? JSON.stringify(m.attrs) : ''}`).sort().join('+')}|${n.text}`);
    n.content?.forEach(walk);
  };
  walk(model);
  return out;
}

describe('the new editor keeps what the old one made', () => {
  it('plain paragraphs, headings and quotes', () => {
    const { out } = same('<h2>Chapter</h2><p>First paragraph.</p><p>Second, with “curly” quotes — and an em dash.</p><h3>Sub</h3><blockquote><p>A quote.</p></blockquote>');
    expect(out).toBe('<h2>Chapter</h2><p>First paragraph.</p><p>Second, with “curly” quotes — and an em dash.</p><h3>Sub</h3><blockquote><p>A quote.</p></blockquote>');
  });

  it('bold, italic, underline, strike, super and subscript, in the tags the browser writes', () => {
    const { model } = same('<p>a <b>bold</b>, <i>italic</i>, <u>under</u>, <strike>struck</strike>, x<sup>2</sup>, H<sub>2</sub>O</p>');
    expect(runs(model)).toEqual(expect.arrayContaining(['bold|bold', 'italic|italic', 'underline|under', 'strike|struck', 'superscript|2', 'subscript|2']));
    same('<p><strong>bold <em>and italic</em></strong></p>');
  });

  it('color, highlight, size and font on a run', () => {
    const red = same('<p>a <span style="color: rgb(200, 30, 30);">red</span> and <span style="background-color: rgb(255, 235, 59);">marked</span></p>');
    expect(red.out).toContain('color: rgb(200, 30, 30)');
    expect(red.out).toContain('background-color: rgb(255, 235, 59)');
    const sized = same('<p><span style="font-size: 20px;">big</span> <span style="font-family: &quot;Lora&quot;, serif;">Lora</span></p>');
    expect(sized.out).toContain('font-size: 20px');
    expect(sized.out).toContain('Lora');
    same('<p><span style="color: red; font-size: 18px;"><b>both</b></span></p>');
  });

  it('alignment written as inline style', () => {
    const { out } = same('<p style="text-align: center;">centered</p><p style="text-align: right;">right</p><p style="text-align: justify;">justified</p>');
    expect(out).toBe('<p style="text-align: center;">centered</p><p style="text-align: right;">right</p><p style="text-align: justify;">justified</p>');
  });

  it('lists come back as the old editor wrote them, including nested ones', () => {
    const html = '<ul><li>one</li><li>two<ul><li>inner</li></ul></li></ul><ol><li>first</li><li>second</li></ol>';
    expect(same(html).out).toBe(html);
  });

  it('line breaks inside a paragraph, empty paragraphs and non-breaking spaces', () => {
    const html = '<p>line one<br>line two</p><p><br></p><p>after&nbsp; two spaces</p>';
    expect(same(html).out).toBe(html);
  });

  it('scene breaks of every kind the shop sells stay recognizable to the scene detectors', () => {
    for (const id of [undefined, 'stars', 'flourish']) {
      const html = `<p>before</p>${separatorHtml(id)}<p>after</p>`;
      const { out } = same(html);
      expect(out).toContain('data-separator');
      expect(out).toMatch(SCENE_BREAK);
      if (html.includes('data-separator-mark')) expect(out).toMatch(/<p [^>]*data-separator-mark="1"[^>]*>[^<]+<\/p>/);
    }
    same('<p>x</p><hr><p>y</p>');
    expect(open(separatorHtml('stars')).getJSON().content?.[0].attrs?.style).toContain('border-top: 1px dashed');
  });

  it('comments and suggestions keep their ids, even across other formatting', () => {
    const comment = same('<p>a <mark class="asterism-comment-highlight" data-comment-id="c1">commented</mark> passage</p>');
    expect(comment.out).toContain('data-comment-id="c1"');
    const nested = same('<p>a <mark class="asterism-comment-highlight" data-comment-id="c1">comment on <b>bold</b></mark></p>');
    expect(runs(nested.model)).toEqual(['|a ', 'comment{"commentId":"c1"}|comment on ', 'bold+comment{"commentId":"c1"}|bold']);
    const sug = same('<p>She <del class="asterism-suggestion-del" data-suggestion-id="s1" title="Suggested deletion">walked</del><ins class="asterism-suggestion-ins" data-suggestion-id="s1" title="Suggested addition">strode</ins> in.</p>');
    expect(sug.out).toMatch(/<del [^>]*data-suggestion-id="s1"[^>]*>walked<\/del>/);
    expect(sug.out).toMatch(/<ins [^>]*data-suggestion-id="s1"[^>]*>strode<\/ins>/);
  });

  it('entities, emoji and other scripts', () => {
    const { out } = same('<p>fish &amp; chips &lt;3 — 日本語, Ελληνικά, 😀</p>');
    expect(out).toBe('<p>fish &amp; chips &lt;3 — 日本語, Ελληνικά, 😀</p>');
  });

  it('a bare div and loose text from older documents become paragraphs without losing words', () => {
    const { out } = through('<div>old style paragraph</div>loose text<div><b>bold div</b></div>');
    expect(text(out)).toBe('old style paragraphloose textbold div');
  });

  it('every chapter of the sample story keeps its words and its blocks', () => {
    for (const chapter of DEFAULT_PROJECT.chapters) {
      const { model, out } = same(chapter.content);
      const blocks = (h: string) => (h.match(/<(p|h[1-3]|blockquote|li)\b/g) ?? []).length;
      expect(blocks(out)).toBe(blocks(chapter.content));
      expect(model.content?.length).toBeGreaterThan(0);
    }
  });
});
