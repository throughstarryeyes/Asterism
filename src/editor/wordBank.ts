import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { getWordBank, subscribeWordBank } from '../services/wordBank';
import { allEditors } from './active';

// words in the writer's word bank are marked so the browser's spell checker skips them (no red squiggle)

const key = new PluginKey('wordBank');
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let pattern: RegExp | null = null;
let patternFor = '';
function bankPattern(): RegExp | null {
  const words = getWordBank();
  const id = words.join('\u0001');
  if (id !== patternFor) {
    patternFor = id;
    pattern = words.length ? new RegExp(`(?<![\\p{L}\\p{N}'’])(?:${words.map(escape).join('|')})(?![\\p{L}\\p{N}'’])`, 'giu') : null;
  }
  return pattern;
}

// the repaint when the bank changes
subscribeWordBank(() => { for (const e of allEditors()) e.view.dispatch(e.state.tr.setMeta(key, true)); });

export const WordBank = Extension.create({
  name: 'wordBank',
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      props: {
        decorations(state) {
          const re = bankPattern();
          if (!re) return null;
          const out: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return;
            re.lastIndex = 0;
            for (let m = re.exec(node.text); m; m = re.exec(node.text)) {
              out.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { spellcheck: 'false' }));
              if (!m[0]) re.lastIndex++;
            }
          });
          return out.length ? DecorationSet.create(state.doc, out) : null;
        },
      },
    })];
  },
});

// the word under a point on the page, if there is one
export function wordAt(view: EditorView, left: number, top: number): string | null {
  const hit = view.posAtCoords({ left, top });
  if (!hit) return null;
  const $pos = view.state.doc.resolve(hit.pos);
  if (!$pos.parent.isTextblock) return null;
  const text = $pos.parent.textBetween(0, $pos.parent.content.size, undefined, '￼');
  const re = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if ($pos.parentOffset >= m.index && $pos.parentOffset <= m.index + m[0].length) return m[0];
  }
  return null;
}
