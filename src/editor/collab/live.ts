import { useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { Editor, Extension } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import type { AnyExtension } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode, ySyncPluginKey } from '@tiptap/y-tiptap';
import type { Chapter, DocumentComment, Project } from '../../types';
import { editorExtensions } from '../extensions';
import { editorHtml } from '../html';
import type { Role } from './provider';
import type { GuestSession, HostSession, Who } from './session';

// the state of the live writing session this device is in, if any, and how a document is laid out inside a session.
// inside a session the text of every chapter is shared (a Yjs fragment each); so are the chapter titles and statuses, and the comments.
// everything else (themes, tools, the story bible, sounds) stays on each person's own computer.

export interface ChapterInfo { title: string; order: number; status: Chapter['status']; folder?: string }

export interface LiveState {
  mode: 'none' | 'hosting' | 'joined' | 'ended';
  // changes whenever a session starts or ends, so the editors are made again
  key: number;
  doc: Y.Doc | null;
  awareness: Awareness | null;
  host: HostSession | null;
  guest: GuestSession | null;
  role: Role;
  who: Who;
  // the people here, by name, including this one
  people: string[];
  // the address and invites the host has made, for the host's screen
  address: string;
  // the document this session shares
  projectId: string;
  invites: Array<{ password: string; role: Role; used: boolean }>;
  // 'reconnecting' while a guest's connection is down and being retried
  connection: 'ok' | 'reconnecting';
  // what to tell the writer
  message: string;
  error: string;
}

const NONE: LiveState = {
  mode: 'none', key: 0, doc: null, awareness: null, host: null, guest: null, role: 'writer', who: { name: 'Writer', color: '#888888' },
  people: [], address: '', projectId: '', invites: [], connection: 'ok', message: '', error: '',
};

// one session per document, so a person can host one document while joined to another's, or host several. a document that is not in a
// session is simply not in this table.
const sessions = new Map<string, LiveState>();
let list: LiveState[] = [];
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const changed = () => { list = [...sessions.values()]; listeners.forEach(l => l()); };

export const NO_SESSION: LiveState = NONE;
export const getSession = (projectId?: string | null): LiveState => (projectId ? sessions.get(projectId) : undefined) ?? NONE;
export const allSessions = (): LiveState[] => list;

export function setSession(projectId: string, next: Partial<LiveState>) {
  const before = sessions.get(projectId);
  sessions.set(projectId, { ...(before ?? { ...NONE, key: 0 }), ...next, projectId, key: next.key ?? before?.key ?? 1 });
  changed();
}
export function removeSession(projectId: string) {
  if (sessions.delete(projectId)) changed();
}

// the session of one document (nothing when the document is not in one)
export const useSession = (projectId?: string | null): LiveState => useSyncExternalStore(subscribe, () => getSession(projectId));
// every session this device is in
export const useSessions = (): LiveState[] => useSyncExternalStore(subscribe, allSessions);

// ---- how a document is laid out in a session ----

export const fragmentName = (chapterId: string) => `ch:${chapterId}`;
export const metaOf = (doc: Y.Doc) => doc.getMap<unknown>('meta');
export const chaptersOf = (doc: Y.Doc) => doc.getMap<ChapterInfo>('chapters');
export const commentsOf = (doc: Y.Doc) => doc.getMap<DocumentComment>('comments');

// the origin used for changes that came from this device's own document, so they are not applied back
export const LOCAL = 'asterism-local';

// puts a document into a session's shared state. only the host does this, before anyone joins.
export function seedDoc(doc: Y.Doc, project: Project): void {
  const editor = new Editor({ extensions: editorExtensions(), content: '' });
  try {
    doc.transact(() => {
      const meta = metaOf(doc);
      meta.set('title', project.title);
      meta.set('session', `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
      // which document this is, the same every time it is hosted (a copy of a copy still points at the first)
      meta.set('doc', project.liveFrom?.doc ?? project.id);
      meta.set('author', project.author ?? '');
      meta.set('draftMode', project.draftMode ?? 'chaptered');
      const chapters = chaptersOf(doc);
      project.chapters.forEach(c => {
        chapters.set(c.id, { title: c.title, order: c.order, status: c.status, ...(c.folder ? { folder: c.folder } : {}) });
        editor.commands.setContent(c.content || '');
        prosemirrorJSONToYXmlFragment(editor.schema, editor.getJSON(), doc.getXmlFragment(fragmentName(c.id)));
      });
      const comments = commentsOf(doc);
      (project.comments ?? []).forEach(cm => comments.set(cm.id, cm));
    }, LOCAL);
  } finally {
    editor.destroy();
  }
}

// what the session holds now, in the shape of a document's shared parts
export function sessionShared(doc: Y.Doc): { chapters: Array<ChapterInfo & { id: string; content: string }>; comments: DocumentComment[] } {
  const texts = chapterHtml(doc);
  return {
    chapters: chapterList(doc).map(c => ({ ...c, content: texts[c.id] ?? '' })),
    comments: [...commentsOf(doc).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// puts a chapter's text into the session, touching only the blocks that differ. what is the same keeps its place in the shared document,
// so other people's cursors and edits near it are not disturbed. a block is a paragraph, heading, quote, list or scene break.
export function setChapterHtml(doc: Y.Doc, chapterId: string, html: string): boolean {
  const fragment = doc.getXmlFragment(fragmentName(chapterId));
  const editor = new Editor({ extensions: editorExtensions(), content: html || '' });
  try {
    const schema = editor.schema;
    const want = (editor.getJSON().content ?? []);
    const have: unknown[] = [];
    yXmlFragmentToProseMirrorRootNode(fragment, schema).forEach(node => { have.push(node.toJSON()); });
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    let start = 0;
    while (start < have.length && start < want.length && same(have[start], want[start])) start++;
    let endHave = have.length;
    let endWant = want.length;
    while (endHave > start && endWant > start && same(have[endHave - 1], want[endWant - 1])) { endHave--; endWant--; }
    if (start === endHave && start === endWant) return false;
    const incoming = want.slice(start, endWant);
    doc.transact(() => {
      if (endHave > start) fragment.delete(start, endHave - start);
      if (incoming.length) {
        const scratch = new Y.Doc();
        const holder = scratch.getXmlFragment('blocks');
        prosemirrorJSONToYXmlFragment(schema, { type: 'doc', content: incoming }, holder);
        fragment.insert(start, holder.toArray().map(n => n.clone() as Y.XmlElement | Y.XmlText));
        scratch.destroy();
      }
      // a document must keep at least one block
      if (fragment.length === 0) {
        const scratch = new Y.Doc();
        const holder = scratch.getXmlFragment('blocks');
        prosemirrorJSONToYXmlFragment(schema, { type: 'doc', content: [{ type: 'paragraph' }] }, holder);
        fragment.insert(0, holder.toArray().map(n => n.clone() as Y.XmlElement | Y.XmlText));
        scratch.destroy();
      }
    }, LOCAL);
    return true;
  } finally {
    editor.destroy();
  }
}

// each chapter's text as html, as the session holds it now
export function chapterHtml(doc: Y.Doc): Record<string, string> {
  const editor = new Editor({ extensions: editorExtensions(), content: '' });
  const out: Record<string, string> = {};
  try {
    for (const id of chaptersOf(doc).keys()) {
      editor.commands.setContent(yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(fragmentName(id)), editor.schema).toJSON());
      out[id] = editorHtml(editor);
    }
  } finally {
    editor.destroy();
  }
  return out;
}

// the chapters in a session, in their order
export function chapterList(doc: Y.Doc): Array<ChapterInfo & { id: string }> {
  return [...chaptersOf(doc).entries()].map(([id, info]) => ({ id, ...info })).sort((a, b) => a.order - b.order);
}

// when someone else's change arrives (their Enter splits the line you are both on), this person's cursor stays where it was in the text.
// the shared document alone can carry it along with the other person's new line. positions before the change stay put, positions after
// it move by the size of the change, and a cursor inside the changed stretch is left to the shared document to place.
export const KeepMyCursor = Extension.create({
  name: 'keepMyCursor',
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(trs, oldState, newState) {
        const remote = trs.some(tr => {
          const meta = tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean; isUndoRedoOperation?: boolean } | undefined;
          return !!meta?.isChangeOrigin && !meta.isUndoRedoOperation;
        });
        if (!remote || !(oldState.selection instanceof TextSelection)) return null;
        const start = oldState.doc.content.findDiffStart(newState.doc.content);
        if (start === null || start === undefined) return null;
        const end = oldState.doc.content.findDiffEnd(newState.doc.content);
        let endOld = end ? end.a : oldState.doc.content.size;
        let endNew = end ? end.b : newState.doc.content.size;
        const overlap = start - Math.min(endOld, endNew);
        if (overlap > 0) { endOld += overlap; endNew += overlap; }
        const place = (pos: number, fallback: number): number => {
          if (pos <= start) return pos;
          if (pos >= endOld) return pos + (endNew - endOld);
          return fallback;
        };
        const anchor = place(oldState.selection.anchor, newState.selection.anchor);
        const head = place(oldState.selection.head, newState.selection.head);
        const size = newState.doc.content.size;
        if (anchor < 0 || head < 0 || anchor > size || head > size) return null;
        if (anchor === newState.selection.anchor && head === newState.selection.head) return null;
        try {
          const sel = TextSelection.between(newState.doc.resolve(anchor), newState.doc.resolve(head));
          return newState.tr.setSelection(sel).setMeta('addToHistory', false);
        } catch { return null; }
      },
    })];
  },
});

// the extensions that make an editor share one chapter's text, or nothing when there is no session
export function liveExtensions(live: LiveState, chapterId: string): AnyExtension[] | undefined {
  if (!live.doc || !live.awareness || !chaptersOf(live.doc).has(chapterId)) return undefined;
  return [
    Collaboration.configure({ document: live.doc, field: fragmentName(chapterId) }),
    KeepMyCursor,
    CollaborationCaret.configure({ provider: { awareness: live.awareness }, user: { name: live.who.name, color: live.who.color } }),
  ];
}

const COLORS = ['#e76f51', '#2a9d8f', '#e9c46a', '#6a4c93', '#3a86ff', '#d62828', '#52b788', '#f4a261'];
export const colorFor = (name: string): string => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};
