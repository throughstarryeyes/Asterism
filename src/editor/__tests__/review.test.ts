// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { editorExtensions } from '../extensions';
import { editorHtml } from '../html';
import { trackEditor, untrackEditor } from '../active';
import { commentOnText, findText, resolveSuggestion, runsOf, textOfRuns } from '../review';

const made: Editor[] = [];
function open(html: string) {
  const editor = new Editor({ extensions: editorExtensions(), content: html, element: document.createElement('div') });
  trackEditor(editor);
  made.push(editor);
  return editor;
}
afterEach(() => { made.splice(0).forEach(e => { untrackEditor(e); e.destroy(); }); });

const SWAP = '<p>She <del data-suggestion-id="s1">walked</del><ins data-suggestion-id="s1">strode</ins> in.</p>';

describe('suggestions and comments in the new editor', () => {
  it('accepting a replacement keeps the new words and drops the old', () => {
    const e = open(SWAP);
    resolveSuggestion('s1', true);
    expect(editorHtml(e)).toBe('<p>She strode in.</p>');
  });

  it('rejecting a replacement keeps the old words and drops the new', () => {
    const e = open(SWAP);
    resolveSuggestion('s1', false);
    expect(editorHtml(e)).toBe('<p>She walked in.</p>');
  });

  it('accepting a pure deletion removes the words, and a pure addition keeps them', () => {
    const del = open('<p>Very <del data-suggestion-id="d1">very </del>good.</p>');
    resolveSuggestion('d1', true);
    expect(editorHtml(del)).toBe('<p>Very good.</p>');
    const add = open('<p>Good<ins data-suggestion-id="a1">, really</ins>.</p>');
    resolveSuggestion('a1', true);
    expect(editorHtml(add)).toBe('<p>Good, really.</p>');
    const rejectAdd = open('<p>Good<ins data-suggestion-id="a2">, really</ins>.</p>');
    resolveSuggestion('a2', false);
    expect(editorHtml(rejectAdd)).toBe('<p>Good.</p>');
  });

  it('a deletion with a suggested replacement text swaps it in', () => {
    const e = open('<p>She <del data-suggestion-id="f1">walked</del> in.</p>');
    resolveSuggestion('f1', true, 'strode');
    expect(editorHtml(e)).toBe('<p>She strode in.</p>');
  });

  it('finds every run of a suggestion across paragraphs', () => {
    const e = open('<p>One <ins data-suggestion-id="x">two</ins></p><p><ins data-suggestion-id="x">three</ins> four</p>');
    const runs = runsOf(e.state, 'suggestionIns', 'suggestionId', 'x');
    expect(runs).toHaveLength(2);
    expect(textOfRuns(e.state, runs)).toBe('twothree');
  });

  it('marks a passage as commented when only its words are known', () => {
    const e = open('<p>The sea was grey and the gulls were loud.</p>');
    expect(findText(e, 'gulls were')).not.toBeNull();
    expect(commentOnText(e, 'gulls were', 'c9')).toBe(true);
    expect(editorHtml(e)).toContain('<mark class="asterism-comment-highlight" data-comment-id="c9">gulls were</mark>');
    expect(commentOnText(e, 'not in the text', 'c10')).toBe(false);
  });
});
