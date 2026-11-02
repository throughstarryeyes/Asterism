// a throwaway page for trying live editing. two ways in:
//   collab-test.html?room=x&host=1&name=Ada   two tabs of one browser (the second tab: ?room=x&name=Ben)
//   collab-test.html                          a real session: the host runs node server/session-relay.mjs, hosts, and hands out passwords
import * as Y from 'yjs';
import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { editorExtensions } from './extensions';
import { LinkProvider, tabLink } from './collab/provider';
import { HostSession, joinSession, type Who } from './collab/session';
import { DEFAULT_PROJECT } from '../data/defaultProject';

const q = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const color = () => q.get('color') ?? '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

function mount(doc: Y.Doc, provider: { awareness: unknown }, who: Who, editable = true) {
  const editor = new Editor({
    element: $('editor'),
    editable,
    extensions: [
      ...editorExtensions({ collaborating: true }),
      Collaboration.configure({ document: doc, field: 'chapter' }),
      CollaborationCaret.configure({ provider: provider as never, user: who }),
    ],
  });
  Object.assign(window, { __editor: editor, __doc: doc });
  return editor;
}

const loadChapter = (editor: Editor, doc: Y.Doc) => {
  if (doc.getXmlFragment('chapter').length === 0) editor.commands.setContent(DEFAULT_PROJECT.chapters[0].content);
};

if (q.get('room')) {
  // two tabs of one browser
  const name = q.get('name') ?? 'Writer';
  const who = { name, color: color() };
  const doc = new Y.Doc();
  const provider = new LinkProvider(doc, tabLink(q.get('room')!));
  const editor = mount(doc, provider, who);
  if (q.get('host') === '1') loadChapter(editor, doc);
  $('who').textContent = `${name}${q.get('host') === '1' ? ' (host)' : ''}`;
  addEventListener('pagehide', () => provider.destroy());
  Object.assign(window, { __provider: provider });
  $('start').hidden = true;
} else {
  $('who').textContent = 'Not in a session';
  const nameInput = $<HTMLInputElement>('name');
  const status = (text: string) => { $('status').textContent = text; };
  const who = (): Who => ({ name: nameInput.value.trim() || 'Writer', color: color() });
  const say = (e: unknown) => status(e instanceof Error ? e.message : 'That did not work.');
  let hostSession: HostSession | null = null;

  $('host').onclick = async () => {
    try {
      status('Starting...');
      const doc = new Y.Doc();
      const session = await HostSession.start(doc, who(), $<HTMLInputElement>('relay').value, $<HTMLInputElement>('hostKey').value.trim());
      hostSession = session;
      const editor = mount(doc, session, who());
      loadChapter(editor, doc);
      session.onGuests = n => status(`Hosting. ${n} ${n === 1 ? 'guest' : 'guests'} connected.`);
      session.onClosed = () => status('The relay stopped. Your document is still here.');
      $('start').hidden = true;
      $('hostTools').hidden = false;
      $('who').textContent = 'Hosting';
      status('Hosting. No guests yet.');
      addEventListener('pagehide', () => session.end());
      Object.assign(window, { __session: session });
    } catch (e) { say(e); }
  };

  const invite = (role: 'writer' | 'reader') => {
    if (!hostSession) return;
    const inv = hostSession.invite(role);
    $('inviteText').innerHTML = `Tell your ${role}: the host's address, and the password <code>${inv.password}</code>. It works once, for 15 minutes.`;
  };
  $('inviteWriter').onclick = () => invite('writer');
  $('inviteReader').onclick = () => invite('reader');

  $('join').onclick = async () => {
    try {
      status('Joining...');
      const doc = new Y.Doc();
      const session = await joinSession($<HTMLInputElement>('address').value, $<HTMLInputElement>('password').value, doc, who());
      $('start').hidden = true;
      const editor = mount(doc, session, who());
      await new Promise(r => setTimeout(r, 300));
      editor.setEditable(session.role === 'writer');
      session.provider.onRole = role => editor.setEditable(role === 'writer');
      session.onEnded = () => { editor.setEditable(false); status('The host ended the session. What you see here is yours to keep.'); $('who').textContent = 'Session ended'; };
      $('who').textContent = session.role === 'reader' ? 'Reading along' : 'Writing together';
      status(session.role === 'reader' ? 'Connected as a reader.' : 'Connected.');
      addEventListener('pagehide', () => session.leave());
      Object.assign(window, { __session: session });
    } catch (e) { say(e); }
  };
}
