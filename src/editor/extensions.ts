import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { WordBank } from './wordBank';
import { ActiveComment, SharedCommentHighlights, Suggesting } from './review';

// the editor's document model. chapters are still saved as html (exports, the analyzer and sync all read that), so every
// piece of markup the old editor could produce has to survive a trip in and out. see __tests__/roundTrip.test.ts.

// a comment on a passage
export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  addAttributes() {
    return { commentId: { default: null, parseHTML: el => el.getAttribute('data-comment-id'), renderHTML: a => (a.commentId ? { 'data-comment-id': a.commentId } : {}) } };
  },
  parseHTML() { return [{ tag: 'mark[data-comment-id]' }]; },
  renderHTML({ HTMLAttributes }) { return ['mark', mergeAttributes({ class: 'asterism-comment-highlight' }, HTMLAttributes), 0]; },
});

const suggestion = (name: string, tag: 'ins' | 'del', title: string) => Mark.create({
  name,
  inclusive: false,
  priority: 1100, // strikethrough would otherwise claim every <del>
  addAttributes() {
    return { suggestionId: { default: null, parseHTML: el => el.getAttribute('data-suggestion-id'), renderHTML: a => (a.suggestionId ? { 'data-suggestion-id': a.suggestionId } : {}) } };
  },
  parseHTML() { return [{ tag: `${tag}[data-suggestion-id]` }]; },
  renderHTML({ HTMLAttributes }) { return [tag, mergeAttributes({ class: `asterism-suggestion-${tag}`, title }, HTMLAttributes), 0]; },
});

// a suggested addition and a suggested removal, which the writer accepts or rejects
export const SuggestionIns = suggestion('suggestionIns', 'ins', 'Suggested addition');
export const SuggestionDel = suggestion('suggestionDel', 'del', 'Suggested deletion');

// the ornament line under a scene break rule. it is its own kind of block, with no formatting inside, so its markup stays exactly
// what the scene detectors (openDraft, the exporters, the analyzer) look for.
export const SceneMark = Node.create({
  name: 'sceneMark',
  group: 'block',
  content: 'text*',
  marks: '',
  priority: 1100,
  addAttributes() {
    return { style: { default: null, parseHTML: el => el.getAttribute('style'), renderHTML: a => (a.style ? { style: a.style } : {}) } };
  },
  parseHTML() { return [{ tag: 'p[data-separator-mark]' }]; },
  renderHTML({ HTMLAttributes }) { return ['p', mergeAttributes({ 'data-separator-mark': '1' }, HTMLAttributes), 0]; },
});

// block level markup that is kept as written: inline style, mostly alignment
const BLOCKS = ['paragraph', 'heading', 'blockquote', 'listItem'];
export const BlockAttributes = Extension.create({
  name: 'blockAttributes',
  addGlobalAttributes() {
    return [{
      types: BLOCKS,
      attributes: {
        style: { default: null, parseHTML: el => el.getAttribute('style'), renderHTML: a => (a.style ? { style: a.style } : {}) },
      },
    }];
  },
});

// the rule between scenes: which separator was chosen and how it is drawn
export const SceneRule = HorizontalRule.extend({
  addAttributes() {
    return {
      separator: { default: null, parseHTML: el => el.getAttribute('data-separator'), renderHTML: a => (a.separator ? { 'data-separator': a.separator } : {}) },
      style: { default: null, parseHTML: el => el.getAttribute('style'), renderHTML: a => (a.style ? { style: a.style } : {}) },
    };
  },
});

// Tab indents instead of moving focus out of the page. in a list it nests the item (Shift+Tab brings it back out);
// in a paragraph it types an indent of two em spaces, which survives the html the chapters are saved as. Shift+Tab
// takes one indent back off. Escape then Tab still leaves the editor for keyboard users.
export const INDENT = '\u2003\u2003';
export const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive('listItem')) return editor.commands.sinkListItem('listItem') || true;
        return editor.commands.insertContent(INDENT);
      },
      'Shift-Tab': ({ editor }) => {
        if (editor.isActive('listItem')) return editor.commands.liftListItem('listItem') || true;
        const { from, empty } = editor.state.selection;
        if (!empty) return true;
        const before = editor.state.doc.textBetween(Math.max(0, from - INDENT.length), from, '\n', '\n');
        if (before === INDENT) return editor.commands.deleteRange({ from: from - INDENT.length, to: from });
        if (before.endsWith('\u2003')) return editor.commands.deleteRange({ from: from - 1, to: from });
        return true;
      },
    };
  },
});

export interface EditorExtrasOptions {
  // a live session keeps its own history, so the editor's is turned off
  collaborating?: boolean;
}

export function editorExtensions({ collaborating = false }: EditorExtrasOptions = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      horizontalRule: false,
      code: false,
      codeBlock: false,
      link: false,
      trailingNode: false,
      undoRedo: collaborating ? false : undefined,
    }),
    SceneRule,
    SceneMark,
    Subscript,
    Superscript,
    TextStyle,
    Color,
    BackgroundColor,
    FontFamily,
    FontSize,
    CommentMark,
    SuggestionIns,
    SuggestionDel,
    BlockAttributes,
    TabIndent,
    ActiveComment,
    Suggesting,
    WordBank,
    ...(collaborating ? [SharedCommentHighlights] : []),
  ];
}
