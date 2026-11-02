import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { AnyExtension, Editor } from '@tiptap/core';
import { editorExtensions } from './extensions';
import { editorHtml } from './html';
import { releaseEditor, setActiveEditor, trackEditor, untrackEditor } from './active';
import { stashPending } from './pending';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import { liveExtensions, useSession } from './collab/live';
import { wordAt } from './wordBank';
import { addToWordBank, inWordBank, removeFromWordBank, useWordBank } from '../services/wordBank';
import type { EditorView } from '@tiptap/pm/view';

// the writing surface: one chapter's text, editable, in the app's own page styles. it takes html in and gives html out, so
// everything else in the app (saving, exports, the analyzer, sync) keeps working with the text as it always has.

export interface EditorSurfaceProps {
  // changing the chapter starts a fresh editor for it
  chapterId: string;
  // the document it belongs to, so a copy kept as the page closes can be put back in the right place
  scope?: string;
  html: string;
  // `remote` is true when the change came from someone else in a live session, so it is not counted as words this person wrote
  onChange(html: string, editor: Editor, meta?: { remote: boolean }): void;
  onKeyDown?(event: KeyboardEvent): void;
  editable?: boolean;
  ariaLabel?: string;
  // the class and data attributes the page styles look for on the text (font, first-line indent)
  className?: string;
  font?: string;
  style?: React.CSSProperties;
  // a live session adds its shared-text and cursor extensions here
  extensions?: AnyExtension[];
  onReady?(editor: Editor): void;
}

// typing is handled by the editor itself, right away. what the rest of the app hears (saving, word counts, the page around it) is
// sent when the writer pauses, and at least every few seconds while they keep going, which is what keeps a long chapter smooth.
const PAUSE_MS = 500;
const LONGEST_WAIT_MS = 3000;

const css = (style: React.CSSProperties | undefined): string =>
  Object.entries(style ?? {}).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${typeof v === 'number' && k !== 'lineHeight' && k !== 'opacity' ? v + 'px' : v}`).join('; ');

export const EditorSurface: React.FC<EditorSurfaceProps> = ({ chapterId, scope, html, onChange, onKeyDown, editable: editableProp = true, ariaLabel = 'Manuscript text', className, font, style, extensions: extensionsProp, onReady }) => {
  // in a live session the text of a chapter is shared, so the editor is bound to it and starts empty
  const live = useSession(scope);
  const extensions = extensionsProp ?? liveExtensions(live, chapterId);
  // a reader can follow along but not change the text, and nobody can once the session has ended
  const editable = editableProp && !(extensions && (live.role === 'reader' || live.mode === 'ended'));
  const [menu, setMenu] = useState<{ x: number; y: number; word: string } | null>(null);
  useWordBank();
  const lastOut = useRef(html);
  const handlers = useRef({ onChange, onKeyDown });
  handlers.current = { onChange, onKeyDown };
  const current = useRef<Editor | null>(null);
  const commit = useRef<{ dirty: boolean; timer: number | null; since: number; mine: boolean }>({ dirty: false, timer: null, since: 0, mine: false });

  // sends the text on now, if it has changed since the last time
  const flush = () => {
    const c = commit.current;
    if (c.timer !== null) { window.clearTimeout(c.timer); c.timer = null; }
    const e = current.current;
    if (!c.dirty || !e || e.isDestroyed) return;
    c.dirty = false;
    const out = editorHtml(e);
    lastOut.current = out;
    const remote = !c.mine;
    c.mine = false;
    handlers.current.onChange(out, e, { remote });
  };

  // the page is closing or hidden: keep a copy of anything not yet handed over, then hand it over
  const keepCopy = () => {
    const c = commit.current;
    const e = current.current;
    if (c.dirty && e && !e.isDestroyed && scope) stashPending(scope, chapterId, editorHtml(e));
    flush();
  };

  const attributes = (): Record<string, string> => ({
    class: className ?? 'editable-manuscript',
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': ariaLabel,
    'data-chapter-id': chapterId,
    ...(font ? { 'data-font': font } : {}),
    style: css(style),
  });

  // a phone keyboard reports most keys as keydown 229 ("Unidentified") while it composes a word, so the key itself is only known
  // from the text it is about to put in. those keys are heard from beforeinput instead; real keys (space, enter, backspace) from keydown.
  const imeKeys = useRef(false);
  const keyHandlers = () => ({
    handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
      imeKeys.current = event.keyCode === 229 || event.key === 'Unidentified';
      if (!imeKeys.current) handlers.current.onKeyDown?.(event);
      return false;
    },
    handleDOMEvents: {
      // right-click on a word offers the word bank. holding Shift gives the browser's own menu (spelling suggestions, cut, paste)
      contextmenu: (view: EditorView, event: Event) => {
        const e = event as MouseEvent;
        if (e.shiftKey) return false;
        const word = wordAt(view, e.clientX, e.clientY);
        if (!word) return false;
        e.preventDefault();
        setMenu({ x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 140), word });
        return true;
      },
      beforeinput: (_view: unknown, event: Event) => {
        const e = event as InputEvent;
        if (!imeKeys.current || (e.inputType !== 'insertText' && e.inputType !== 'insertCompositionText') || !e.data) return false;
        handlers.current.onKeyDown?.(new KeyboardEvent('keydown', { key: e.data.slice(-1) }));
        return false;
      },
    },
  });

  const editor = useEditor({
    extensions: [...editorExtensions({ collaborating: !!extensions }), ...(extensions ?? [])],
    // a live session brings its own text, so the editor starts empty there
    content: extensions ? undefined : html,
    editable,
    editorProps: {
      attributes: attributes(),
      ...keyHandlers(),
    },
    // the page around the editor does not need to redraw for every transaction; the toolbar listens to the editor itself
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: e, transaction }) => {
      // an update that changed no text (the editor announces some on its own) is not something to send on or save
      if (!transaction.docChanged) return;
      // always the editor that is really being typed in (in development the first one made can be thrown away and remade)
      current.current = e;
      const c = commit.current;
      // changes that arrive from other people in a session carry this mark; everything else was typed here
      if (!(transaction.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin) c.mine = true;
      const now = Date.now();
      if (!c.dirty) c.since = now;
      c.dirty = true;
      if (c.timer !== null) window.clearTimeout(c.timer);
      // wait for a pause, but never longer than the ceiling since the first unsent change
      c.timer = window.setTimeout(flush, Math.max(0, Math.min(PAUSE_MS, c.since + LONGEST_WAIT_MS - now)));
    },
    onBlur: () => flush(),
    onFocus: ({ editor: e }) => setActiveEditor(e),
    onCreate: ({ editor: e }) => { current.current = e; trackEditor(e); setActiveEditor(e); onReady?.(e); },
    // a chapter change or leaving the page must not lose the last words typed
    onDestroy: () => flush(),
  }, [chapterId, live.key, !!extensions]);

  // closing or hiding the page sends whatever is waiting
  useEffect(() => {
    const leave = () => keepCopy();
    const hide = () => { if (document.visibilityState === 'hidden') keepCopy(); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('pagehide', leave); document.removeEventListener('visibilitychange', hide); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a different chapter has its own text: what was last sent on is not the new chapter's, so it must not be mistaken for a change
  useEffect(() => { lastOut.current = html; commit.current.dirty = false; commit.current.mine = false; }, [chapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // page settings (font, size, indent) change while the editor stays
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setOptions({ editorProps: { attributes: attributes(), ...keyHandlers() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, className, font, ariaLabel, JSON.stringify(style), chapterId]);

  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(editable, false); }, [editor, editable]);

  // the text changed somewhere else (a restored version, a sync from another device): show it, unless the writer is typing here
  useEffect(() => {
    // the editor handed back for a moment can be the one just replaced when the chapter changes: it has nothing left to show anything in
    if (!editor || editor.isDestroyed || extensions) return;
    if (html === lastOut.current || editor.isFocused || commit.current.dirty) return;
    editor.commands.setContent(html, { emitUpdate: false });
    lastOut.current = html;
  }, [editor, html, extensions]);

  // registered every time this effect runs (not only when the editor is made), because development mode runs the cleanup and the effect
  // again on the same editor, which would otherwise leave it unregistered and the toolbar with nothing to work on
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    trackEditor(editor);
    if (editor.isFocused) setActiveEditor(editor);
    return () => { releaseEditor(editor); untrackEditor(editor); };
  }, [editor]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', esc); };
  }, [menu]);

  const item: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: '0.85rem', color: 'var(--text-main)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' };
  const choose = (fn: () => void) => () => { fn(); setMenu(null); editor?.commands.focus(); };
  return (
    <>
      <EditorContent editor={editor} />
      {menu && (
        <div role="menu" onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 10000, minWidth: 210, padding: '4px 0', background: 'var(--bg-paper, #fff)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md, 8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          {inWordBank(menu.word)
            ? <button role="menuitem" style={item} onClick={choose(() => removeFromWordBank(menu.word))}>Remove “{menu.word}” from word bank</button>
            : <button role="menuitem" style={item} onClick={choose(() => addToWordBank(menu.word))}>Add “{menu.word}” to word bank</button>}
          <button role="menuitem" style={item} onClick={choose(() => { void navigator.clipboard?.writeText(window.getSelection()?.toString() ?? ''); })}>Copy</button>
          <div style={{ padding: '4px 12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shift + right-click for spelling suggestions</div>
        </div>
      )}
    </>
  );
};
