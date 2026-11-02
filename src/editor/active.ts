import { useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/core';

// two small pieces of shared state for the new editor.
// 1) which editor the toolbar is working on right now (a page can show several, one per chapter in the open draft)
// 2) whether the new editor is in use (it is, unless switched off). kept on this device.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// every editor on the page, and which one a piece of the page belongs to
const live = new Set<Editor>();
const byDom = new WeakMap<Element, Editor>();
export const allEditors = (): Editor[] => [...live].filter(e => !e.isDestroyed);
export function trackEditor(editor: Editor) { live.add(editor); byDom.set(editor.view.dom, editor); }
export function untrackEditor(editor: Editor) { live.delete(editor); }
export function editorFor(node: Node | null): Editor | null {
  const el = node instanceof Element ? node : node?.parentElement;
  const root = el?.closest('.ProseMirror');
  return (root && byDom.get(root)) || null;
}

let active: Editor | null = null;
export const getActiveEditor = (): Editor | null => (active && !active.isDestroyed ? active : null);
export function setActiveEditor(editor: Editor | null) {
  if (active === editor) return;
  active = editor;
  notify();
}
// an editor going away only clears the slot if it still holds it
export function releaseEditor(editor: Editor) {
  if (active === editor) { active = null; notify(); }
}
export const useActiveEditor = (): Editor | null => useSyncExternalStore(subscribe, getActiveEditor);

// the new editor is the default. the older one stays one switch away while the new one settles in.
const KEY = 'asterism_new_editor';
export const newEditorOn = (): boolean => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
export function setNewEditor(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* it stays as it was */ }
  notify();
}
export const useNewEditor = (): boolean => useSyncExternalStore(subscribe, newEditorOn);
