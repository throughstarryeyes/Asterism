import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as PmNode, MarkType } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/core';
import { allEditors, editorFor } from './active';

// comments and suggestions in the new editor. a comment is a mark on a passage; a suggestion is a deletion mark and an addition
// mark that share an id. the rest of the app (the comments panel, accept and reject buttons) works with those ids as before.

export interface Span { from: number; to: number }

const spanOf = (editor: Editor, range: Range): Span | null => {
  try {
    const a = editor.view.posAtDOM(range.startContainer, range.startOffset);
    const b = editor.view.posAtDOM(range.endContainer, range.endOffset);
    return { from: Math.min(a, b), to: Math.max(a, b) };
  } catch { return null; }
};

// a selection made on the page, as positions in the editor it is in
export function inEditor(range: Range): { editor: Editor; span: Span } | null {
  const editor = editorFor(range.commonAncestorContainer);
  const span = editor && spanOf(editor, range);
  return editor && span ? { editor, span } : null;
}

const markType = (editor: Editor, name: string): MarkType => editor.state.schema.marks[name];

// every stretch of text that carries a mark with this id
export function runsOf(state: EditorState, markName: string, attr: 'commentId' | 'suggestionId', id: string): Span[] {
  const out: Span[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText || !node.marks.some(m => m.type.name === markName && m.attrs[attr] === id)) return;
    const last = out[out.length - 1];
    if (last && last.to === pos) last.to = pos + node.nodeSize;
    else out.push({ from: pos, to: pos + node.nodeSize });
  });
  return out;
}

export const textOfRuns = (state: EditorState, runs: Span[]): string => runs.map(r => state.doc.textBetween(r.from, r.to)).join('');

export function commentOn(range: Range, id: string): boolean {
  const hit = inEditor(range);
  if (!hit) return false;
  const { editor, span } = hit;
  editor.view.dispatch(editor.state.tr.addMark(span.from, span.to, markType(editor, 'comment').create({ commentId: id })));
  return true;
}

// a suggestion that swaps the selected words for new ones: the old words are marked for deletion, the new ones follow
export function suggestReplace(range: Range, id: string, replacement: string): boolean {
  const hit = inEditor(range);
  if (!hit) return false;
  const { editor, span } = hit;
  const { schema } = editor.state;
  const tr = editor.state.tr
    .addMark(span.from, span.to, markType(editor, 'suggestionDel').create({ suggestionId: id }))
    .insert(span.to, schema.text(replacement, [markType(editor, 'suggestionIns').create({ suggestionId: id })]));
  editor.view.dispatch(tr);
  return true;
}

// replace the text of a found passage
export function replaceRange(range: Range, text: string): boolean {
  const hit = inEditor(range);
  if (!hit) return false;
  const { editor, span } = hit;
  editor.view.dispatch(text ? editor.state.tr.insertText(text, span.from, span.to) : editor.state.tr.delete(span.from, span.to));
  return true;
}

// the same, for many passages in one editor at once. positions are read first, then applied from the end so none of them move.
export function replaceRanges(ranges: Range[], text: string): void {
  const byEditor = new Map<Editor, Span[]>();
  for (const r of ranges) {
    const hit = inEditor(r);
    if (hit) byEditor.set(hit.editor, [...(byEditor.get(hit.editor) ?? []), hit.span]);
  }
  byEditor.forEach((spans, editor) => {
    let tr = editor.state.tr;
    spans.sort((a, b) => b.from - a.from).forEach(s => { tr = text ? tr.insertText(text, s.from, s.to) : tr.delete(s.from, s.to); });
    editor.view.dispatch(tr);
  });
}

// the first place a piece of text appears in one editor, when we only know the words
export function findText(editor: Editor, text: string): Span | null {
  const want = text.trim();
  if (!want) return null;
  let found: Span | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found || !node.isText) return;
    const i = (node.text ?? '').indexOf(want);
    if (i >= 0) found = { from: pos + i, to: pos + i + want.length };
  });
  return found;
}

export function commentOnText(editor: Editor, text: string, id: string): boolean {
  const span = findText(editor, text);
  if (!span) return false;
  editor.view.dispatch(editor.state.tr.addMark(span.from, span.to, markType(editor, 'comment').create({ commentId: id })));
  return true;
}

// accept or reject a suggestion wherever it is in the document. accepting keeps the new words and drops the old; rejecting is the reverse.
export function resolveSuggestion(id: string, accept: boolean, fallbackText = ''): void {
  for (const editor of allEditors()) {
    const ins = runsOf(editor.state, 'suggestionIns', 'suggestionId', id);
    const del = runsOf(editor.state, 'suggestionDel', 'suggestionId', id);
    if (!ins.length && !del.length) continue;
    let tr = editor.state.tr;
    const insMark = markType(editor, 'suggestionIns');
    const delMark = markType(editor, 'suggestionDel');
    if (accept) {
      if (ins.length) {
        // everything is applied from the end of the page back, so no position moves before it is used
        const steps = [...ins.map(r => ({ r, kind: 'keep' as const })), ...del.map(r => ({ r, kind: 'cut' as const }))].sort((a, b) => b.r.from - a.r.from);
        steps.forEach(({ r, kind }) => { tr = kind === 'cut' ? tr.delete(r.from, r.to) : tr.removeMark(r.from, r.to, insMark); });
      } else if (fallbackText) {
        del.sort((a, b) => b.from - a.from).forEach((r, i, all) => {
          tr = i === all.length - 1 ? tr.replaceWith(r.from, r.to, editor.state.schema.text(fallbackText)) : tr.delete(r.from, r.to);
        });
      } else {
        del.sort((a, b) => b.from - a.from).forEach(r => { tr = tr.delete(r.from, r.to); });
      }
    } else {
      const steps = [...ins.map(r => ({ r, kind: 'cut' as const })), ...del.map(r => ({ r, kind: 'keep' as const }))].sort((a, b) => b.r.from - a.r.from);
      steps.forEach(({ r, kind }) => { tr = kind === 'cut' ? tr.delete(r.from, r.to) : tr.removeMark(r.from, r.to, delMark); });
    }
    editor.view.dispatch(tr);
  }
}

// ---- comments in a live session ----
// inside a session the comments list is shared, but a mark on the text only reaches the others when the person who made it was allowed
// to change the text (a reader's marks are dropped). so a comment whose passage carries no mark of its own is lit up from its words.

interface Target { id: string; text: string }
const targets = new Map<string, Target[]>();
const targetsKey = new PluginKey('commentTargets');

export function setCommentTargets(list: Array<{ chapterId: string; id: string; text: string }>): void {
  targets.clear();
  for (const t of list) {
    const text = t.text.trim();
    if (text) targets.set(t.chapterId, [...(targets.get(t.chapterId) ?? []), { id: t.id, text }]);
  }
  for (const editor of allEditors()) editor.view.dispatch(editor.state.tr.setMeta(targetsKey, true));
}

export const SharedCommentHighlights = Extension.create({
  name: 'sharedCommentHighlights',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({
      key: targetsKey,
      props: {
        decorations(state) {
          if (!targets.size) return null;
          const wanted = targets.get(editor.view?.dom?.getAttribute('data-chapter-id') ?? '');
          if (!wanted?.length) return null;
          const marked = new Set<string>();
          state.doc.descendants((node: PmNode) => {
            node.marks.forEach(m => { if (m.type.name === 'comment' && m.attrs.commentId) marked.add(m.attrs.commentId as string); });
          });
          const out: Decoration[] = [];
          for (const t of wanted) {
            if (marked.has(t.id)) continue;
            let done = false;
            state.doc.descendants((node: PmNode, pos: number) => {
              if (done || !node.isText) return;
              const i = (node.text ?? '').indexOf(t.text);
              if (i < 0) return;
              out.push(Decoration.inline(pos + i, pos + i + t.text.length, { nodeName: 'mark', class: 'asterism-comment-highlight', 'data-comment-id': t.id }));
              done = true;
            });
          }
          return out.length ? DecorationSet.create(state.doc, out) : null;
        },
      },
    })];
  },
});

// ---- the comment the writer is looking at is lit up on the page ----

const activeKey = new PluginKey<string | null>('activeComment');

export const ActiveComment = Extension.create({
  name: 'activeComment',
  addProseMirrorPlugins() {
    return [new Plugin<string | null>({
      key: activeKey,
      state: {
        init: () => null,
        apply: (tr, value) => (tr.getMeta(activeKey) !== undefined ? (tr.getMeta(activeKey) as string | null) : value),
      },
      props: {
        decorations(state) {
          const id = activeKey.getState(state);
          if (!id) return null;
          const marks: Decoration[] = [];
          state.doc.descendants((node: PmNode, pos: number) => {
            if (node.isText && node.marks.some(m => m.type.name === 'comment' && m.attrs.commentId === id)) {
              marks.push(Decoration.inline(pos, pos + node.nodeSize, { nodeName: 'mark', class: 'active-comment', 'data-comment-id': id }));
            }
          });
          return DecorationSet.create(state.doc, marks);
        },
      },
    })];
  },
});

export function paintActiveComment(id: string | null): void {
  for (const editor of allEditors()) editor.view.dispatch(editor.state.tr.setMeta(activeKey, id));
}

// ---- suggesting mode: typing and deleting become suggestions instead of changes ----

// the page tells this what mode it is in and how to keep the comments list in step
export const suggesting: {
  on: boolean;
  add(deleted: string, label: string, replacement: string, id: string): void;
  update(id: string, text: string): void;
  remove(id: string): void;
} = { on: false, add: () => undefined, update: () => undefined, remove: () => undefined };

const newId = () => `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
const hasMark = (node: PmNode | null | undefined, name: string): string | null => {
  const m = node?.marks.find(x => x.type.name === name);
  return m ? ((m.attrs.suggestionId as string | null) ?? null) : null;
};

function withCaret(tr: Transaction, pos: number): Transaction {
  return tr.setSelection(TextSelection.create(tr.doc, Math.max(0, Math.min(pos, tr.doc.content.size))));
}

export const Suggesting = Extension.create({
  name: 'suggesting',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        handleTextInput(view, from, to, text) {
          if (!suggesting.on) return false;
          const { schema } = view.state;
          const ins = schema.marks.suggestionIns;
          const del = schema.marks.suggestionDel;
          if (from !== to) {
            // typing over a selection: the old words are struck, the new ones follow
            const id = newId();
            const old = view.state.doc.textBetween(from, to);
            let tr = view.state.tr.addMark(from, to, del.create({ suggestionId: id }));
            tr = tr.insert(to, schema.text(text, [ins.create({ suggestionId: id })]));
            view.dispatch(withCaret(tr, to + text.length));
            suggesting.add(old, `Replace "${old}" with "${text}"`, text, id);
            return true;
          }
          // already typing inside a suggested addition: carry on in it
          const $pos = view.state.doc.resolve(from);
          const existing = hasMark($pos.nodeBefore, 'suggestionIns');
          const id = existing ?? newId();
          const tr = view.state.tr.insert(from, schema.text(text, [ins.create({ suggestionId: id })]));
          view.dispatch(withCaret(tr, from + text.length));
          if (existing) suggesting.update(id, textOfRuns(view.state, runsOf(view.state, 'suggestionIns', 'suggestionId', id)));
          else suggesting.add('', `Add: "${text}"`, text, id);
          return true;
        },

        handleKeyDown(view, event) {
          if (!suggesting.on || event.ctrlKey || event.metaKey || event.altKey) return false;
          const backward = event.key === 'Backspace';
          if (!backward && event.key !== 'Delete') return false;
          const { state } = view;
          const { schema, selection } = state;
          const del = schema.marks.suggestionDel;

          if (!selection.empty) {
            const id = newId();
            const old = state.doc.textBetween(selection.from, selection.to);
            if (!old) return false;
            view.dispatch(withCaret(state.tr.addMark(selection.from, selection.to, del.create({ suggestionId: id })), selection.to));
            suggesting.add(old, `Delete: "${old}"`, '', id);
            event.preventDefault();
            return true;
          }

          const pos = selection.from;
          const $pos = state.doc.resolve(pos);
          // inside a suggested addition, deleting just takes the letter back out
          const insId = hasMark(backward ? $pos.nodeBefore : $pos.nodeAfter, 'suggestionIns');
          if (insId) {
            const tr = backward ? state.tr.delete(pos - 1, pos) : state.tr.delete(pos, pos + 1);
            view.dispatch(tr);
            const left = textOfRuns(view.state, runsOf(view.state, 'suggestionIns', 'suggestionId', insId));
            if (left) suggesting.update(insId, left); else suggesting.remove(insId);
            event.preventDefault();
            return true;
          }

          // in ordinary text, the letter is struck rather than removed. letters that are already struck are stepped over.
          let at = pos;
          for (;;) {
            const r = state.doc.resolve(at);
            const next = backward ? r.nodeBefore : r.nodeAfter;
            if (!next?.isText || !hasMark(next, 'suggestionDel')) break;
            at += backward ? -next.nodeSize : next.nodeSize;
          }
          const r = state.doc.resolve(at);
          const target = backward ? r.nodeBefore : r.nodeAfter;
          if (!target?.isText) return false; // the start or end of a paragraph: the editor's own behavior
          const from = backward ? at - 1 : at;
          const to = from + 1;
          const char = state.doc.textBetween(from, to);
          // a letter next to a strike with an id joins it
          const neighbor = backward ? state.doc.resolve(to).nodeAfter : state.doc.resolve(from).nodeBefore;
          const joined = hasMark(neighbor, 'suggestionDel');
          const id = joined ?? newId();
          view.dispatch(withCaret(state.tr.addMark(from, to, del.create({ suggestionId: id })), backward ? from : from));
          if (joined) suggesting.update(id, textOfRuns(view.state, runsOf(view.state, 'suggestionDel', 'suggestionId', id)));
          else suggesting.add(char, `Delete: "${char}"`, '', id);
          event.preventDefault();
          return true;
        },
      },
    })];
  },
});
