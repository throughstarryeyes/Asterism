// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { editorExtensions } from '../extensions';
import { editorHtml } from '../html';
import { separatorHtml } from '../../services/ornaments';
import { SCENE_BREAK, splitScenes } from '../../services/openDraft';
import { extractNarrativeUnits } from '../../services/storyAnalyzer';

const open = (html: string) => new Editor({ extensions: editorExtensions(), content: html, element: document.createElement('div') });
const types = (e: Editor) => (e.getJSON().content ?? []).map(n => n.type);

describe('the ornament under a scene break is not what Enter makes', () => {
  it('a new line after a paragraph is a paragraph, so it can be formatted', () => {
    const e = open('<p>One.</p>');
    e.commands.focus('end');
    e.commands.splitBlock();
    e.commands.insertContent('Two.');
    e.commands.splitBlock();
    e.commands.insertContent('Three.');
    expect(types(e)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    e.commands.selectAll();
    e.commands.toggleBold();
    expect(editorHtml(e)).not.toContain('data-separator-mark');
    expect(e.getHTML()).toContain('<strong>Three.</strong>');
  });

  it('a real ornament under a rule stays an ornament', () => {
    const html = `<p>Before.</p>${separatorHtml('gilt')}<p>After.</p>`;
    const e = open(html);
    expect(types(e)).toEqual(['paragraph', 'horizontalRule', 'sceneMark', 'paragraph']);
    const out = editorHtml(e);
    expect(out).toMatch(/<p[^>]*data-separator-mark/);
    expect(out).toMatch(SCENE_BREAK);
  });

  it('text that picked up the tag in earlier versions opens as ordinary paragraphs', () => {
    const e = open(`<p>One.</p><p data-separator-mark="1">Two.</p><p data-separator-mark="1">Three.</p>${separatorHtml('asterism')}<p>Four.</p>`);
    expect(types(e).filter(t => t === 'sceneMark')).toHaveLength(1);
    expect(types(e).filter(t => t === 'paragraph')).toHaveLength(4);
    expect(editorHtml(e).match(/data-separator-mark/g)).toHaveLength(1);
  });
});

describe('scenes are found in text that picked up the tag', () => {
  const damaged = (s: string) => `<p data-separator-mark="1">${s}</p>`;
  const prose = 'Mara said that the rain kept falling over the quiet town, and nobody spoke of it at all.';

  it('does not read tagged paragraphs as scene breaks', () => {
    const html = damaged(prose) + damaged(prose) + separatorHtml('asterism') + damaged(prose) + damaged(prose);
    expect(splitScenes(html)).toHaveLength(2);
  });

  it('the analyzer still reads the text', () => {
    const html = Array.from({ length: 12 }, () => damaged(prose)).join('');
    const units = extractNarrativeUnits({
      chapters: [{ id: 'c', title: 'T', order: 1, content: html, status: 'draft', wordCount: 0, updatedAt: '' }],
      storyBible: { characters: [], locations: [], lore: [] },
      draftMode: 'open_draft',
    } as never);
    expect(units.reduce((n, u) => n + u.sentences.length, 0)).toBe(12);
  });
});
