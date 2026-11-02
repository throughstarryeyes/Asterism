import { useCallback, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import type { Chapter, DocumentComment, Project } from '../types';
import { countWordsFromHtml, storageService } from '../services/storage';
import { HostSession, joinSession } from '../editor/collab/session';
import type { Role } from '../editor/collab/provider';
import { SessionError } from '../editor/collab/relay';
import { loadLiveBase, mergeLive, saveLiveBase } from '../services/liveMerge';
import { getLineage, setLineage } from '../services/sync/syncStore';
import {
  allSessions, chapterHtml, chapterList, chaptersOf, colorFor, commentsOf, getSession, LOCAL, metaOf, removeSession, seedDoc, sessionShared, setSession, useSession,
  type ChapterInfo,
} from '../editor/collab/live';
import { editChapter, encodeState, replayOnto, resumeDoc, type Replayed } from '../editor/collab/lineage';

// live writing together, tied to the app's documents. a device can be in several sessions at once (one per document): host one
// document while joined to another's, or host several. each session keeps the shared parts (chapter titles and statuses, comments)
// in step with its document, and keeps the document's text saved even while it is not the one on screen.

interface Deps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  setActiveChapterId: (id: string) => void;
  addSyncedProject: (p: Project) => void;
  // changes a document that is in the library but not open
  patchLibraryProject: (projectId: string, change: (p: Project) => Project) => void;
  // the copy this person already has of a shared document, if they have joined it before
  findLiveCopy: (docId: string) => Project | undefined;
  setViewMode: (mode: 'standard') => void;
  showToast: (message: string, type?: 'info' | 'success' | 'reward') => void;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// the shared history of a session, kept so the next one can pick up where it left off (see editor/collab/lineage.ts). `closed` says the
// session ended cleanly, with the document's text and this history in step; while a session runs it is kept as not closed, so a session
// that is cut off is never mistaken for one that finished.
function keepLineage(projectId: string, doc: Y.Doc, closed: boolean): void {
  if (doc.isDestroyed) return;
  const session = String(metaOf(doc).get('session') ?? '');
  if (!session) return;
  void setLineage(projectId, { state: encodeState(doc), session, closed, savedAt: Date.now() }).catch(() => undefined);
}
const infoOf = (c: Chapter): ChapterInfo => ({ title: c.title, order: c.order, status: c.status, ...(c.folder ? { folder: c.folder } : {}) });
// the same count the rest of the app uses, so a copy's word counts agree with what the editor reports
const countWords = countWordsFromHtml;

// what a session keeps besides what the store shows: the comment ids this device has had (so one removed here can be told apart from
// one that has not arrived yet) and how to stop listening
interface Runtime { known: Set<string>; stop: () => void }
const runtimes = new Map<string, Runtime>();

export interface LiveApi {
  // these act on the document that is open, unless a document is named
  startHosting(o: { relay: string; hostKey: string; address: string; name: string }): Promise<void>;
  invite(role: Role): void;
  removePerson(index: number): void;
  join(o: { address: string; password: string; name: string }): Promise<void>;
  end(projectId?: string): void;
}

export function useLiveSession({ project, setProject, setActiveChapterId, addSyncedProject, patchLibraryProject, findLiveCopy, setViewMode, showToast }: Deps): LiveApi {
  const mine = useSession(project.id);
  // the open document, readable from callbacks that outlive a render
  const openId = useRef(project.id);
  openId.current = project.id;

  // a change to a document, whether or not it is the one open
  const applyToProject = useCallback((projectId: string, change: (p: Project) => Project) => {
    if (openId.current === projectId) setProject(prev => (prev.id === projectId ? change(prev) : prev));
    else patchLibraryProject(projectId, change);
  }, [setProject, patchLibraryProject]);

  const refreshPeople = useCallback((projectId: string) => {
    const s = getSession(projectId);
    if (!s.awareness) return;
    const names: string[] = [];
    s.awareness.getStates().forEach(st => { const u = (st as { user?: { name?: string } }).user; if (u?.name) names.push(u.name); });
    // a cursor moving is an awareness change too, and would redraw every editor on the page for nothing
    if (names.length === s.people.length && names.every((n, i) => n === s.people[i])) return;
    setSession(projectId, { people: names });
  }, []);

  // the text of a session whose document is not open still has to reach the library, or it would be lost if the app closed
  const saveText = useCallback((projectId: string, doc: Y.Doc) => {
    const texts = chapterHtml(doc);
    patchLibraryProject(projectId, p => ({
      ...p,
      chapters: p.chapters.map(c => (texts[c.id] === undefined ? c : { ...c, content: texts[c.id], wordCount: countWords(texts[c.id]), updatedAt: new Date().toISOString() })),
    }));
  }, [patchLibraryProject]);

  // what a guest's copy and the session last agreed on, kept for the next time they join: the copy with the session's text and comments
  const keepAgreement = useCallback((projectId: string) => {
    const s = getSession(projectId);
    if (!s.doc || s.doc.isDestroyed || !(s.mode === 'joined' || s.mode === 'ended')) return;
    const docId = String(metaOf(s.doc).get('doc') ?? '');
    const copy = docId ? findLiveCopy(docId) : undefined;
    if (!copy || copy.id !== projectId) return;
    const shared = sessionShared(s.doc);
    const text = new Map(shared.chapters.map(c => [c.id, c.content]));
    keepLineage(projectId, s.doc, true);
    void saveLiveBase({
      ...copy,
      chapters: copy.chapters.map(c => (text.has(c.id) ? { ...c, content: text.get(c.id)!, wordCount: countWords(text.get(c.id)!) } : c)),
      comments: shared.comments,
    }).catch(() => undefined);
  }, [findLiveCopy]);

  // starts listening to a session's shared parts, for a document that may or may not be the one open
  const watch = useCallback((projectId: string, doc: Y.Doc, known: string[]) => {
    const chapters = chaptersOf(doc);
    const comments = commentsOf(doc);
    const rt: Runtime = { known: new Set(known), stop: () => undefined };
    runtimes.set(projectId, rt);
    const onChapters = (_e: unknown, txn: Y.Transaction) => {
      if (txn.origin === LOCAL) return;
      applyToProject(projectId, prev => ({
        ...prev,
        chapters: prev.chapters.map(c => { const i = chapters.get(c.id); return i && !same(infoOf(c), i) ? { ...c, title: i.title, order: i.order, status: i.status } : c; }),
      }));
    };
    const onComments = (_e: unknown, txn: Y.Transaction) => {
      if (txn.origin === LOCAL) return;
      const all: DocumentComment[] = [...comments.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      all.forEach(c => rt.known.add(c.id));
      applyToProject(projectId, prev => ({ ...prev, comments: all }));
    };
    chapters.observe(onChapters);
    comments.observe(onComments);
    // text arriving while another document is open is saved a few seconds after it stops arriving
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === LOCAL || openId.current === projectId) return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (openId.current !== projectId && !doc.isDestroyed) saveText(projectId, doc); }, 2500);
    };
    doc.on('update', onUpdate);
    rt.stop = () => { chapters.unobserve(onChapters); comments.unobserve(onComments); doc.off('update', onUpdate); clearTimeout(timer); };
  }, [applyToProject, saveText]);

  // ---- starting and ending ----

  const end = useCallback((projectId: string = openId.current) => {
    const s = getSession(projectId);
    if (s.mode === 'none') return;
    const wasGuest = s.mode === 'joined' || s.mode === 'ended';
    if (wasGuest) keepAgreement(projectId);
    // a document that is not open keeps what was written
    if (s.doc && openId.current !== projectId && !s.doc.isDestroyed) saveText(projectId, s.doc);
    // the next session this person hosts starts from where this one ended
    if (s.mode === 'hosting' && s.doc) keepLineage(projectId, s.doc, true);
    try { s.host?.end(); } catch { /* already closed */ }
    try { s.guest?.leave(); } catch { /* already closed */ }
    runtimes.get(projectId)?.stop();
    runtimes.delete(projectId);
    s.doc?.destroy();
    removeSession(projectId);
    showToast(wasGuest ? 'You left the session. Your copy is in your library.' : 'The session has ended. Your document has everything that was written.', 'info');
  }, [saveText, showToast, keepAgreement]);

  const startHosting = useCallback(async (o: { relay: string; hostKey: string; address: string; name: string }) => {
    const projectId = project.id;
    if (getSession(projectId).mode !== 'none') return;
    const who = { name: o.name.trim() || 'Host', color: colorFor(o.name || 'Host') };
    // a document hosted before starts from where that session ended, so guests who wrote apart can still be put back together with it
    let doc = new Y.Doc();
    const kept = await getLineage(projectId).catch(() => undefined);
    let resumed = false;
    if (kept?.closed) {
      try { resumed = resumeDoc(doc, project, kept.state); } catch { resumed = false; }
      if (!resumed) { doc.destroy(); doc = new Y.Doc(); }
    }
    if (!resumed) seedDoc(doc, project);
    let host: HostSession;
    try {
      host = await HostSession.start(doc, who, o.relay, o.hostKey);
    } catch (e) {
      doc.destroy();
      throw e instanceof SessionError ? e : new Error('Could not start the session.');
    }
    host.onGuests = () => { setSession(projectId, { invites: [...getSession(projectId).invites] }); refreshPeople(projectId); };
    host.onClosed = () => { showToast('The relay stopped, so the session ended. Your document keeps everything.', 'info'); end(projectId); };
    setSession(projectId, { mode: 'hosting', key: getSession(projectId).key + 1, doc, awareness: host.awareness, host, guest: null, role: 'writer', who, address: o.address.trim(), invites: [], connection: 'ok', message: '', error: '', people: [] });
    watch(projectId, doc, (project.comments ?? []).map(c => c.id));
    keepLineage(projectId, doc, false);
    host.awareness.on('change', () => refreshPeople(projectId));
    refreshPeople(projectId);
  }, [project, refreshPeople, end, showToast, watch]);

  const invite = useCallback((role: Role) => {
    const s = getSession(openId.current);
    if (!s.host) return;
    const made = s.host.invite(role);
    setSession(openId.current, { invites: [made, ...s.invites] });
  }, []);

  const removePerson = useCallback((index: number) => {
    const s = getSession(openId.current);
    if (!s.host) return;
    const guests = (s.host as unknown as { guests: Map<number, unknown> }).guests;
    const id = [...guests.keys()][index];
    if (id !== undefined) s.host.remove(id);
    refreshPeople(openId.current);
  }, [refreshPeople]);

  const join = useCallback(async (o: { address: string; password: string; name: string }) => {
    const who = { name: o.name.trim() || 'Guest', color: colorFor(o.name || 'Guest') };
    const doc = new Y.Doc();
    const guest = await joinSession(o.address, o.password, doc, who);
    // the document arrives a moment after the connection does
    const arrived = await new Promise<boolean>(resolve => {
      const check = () => chaptersOf(doc).size > 0;
      if (check()) return resolve(true);
      const timer = window.setTimeout(() => { doc.off('update', onUpdate); resolve(false); }, 12000);
      const onUpdate = () => { if (check()) { window.clearTimeout(timer); doc.off('update', onUpdate); resolve(true); } };
      doc.on('update', onUpdate);
    });
    if (!arrived) { guest.leave(); doc.destroy(); throw new SessionError('Joined, but the document did not arrive. Ask the host to check the session.'); }
    // being in the same document twice at once would be two connections to one thing
    const which = String(metaOf(doc).get('session') ?? '');
    const docId = String(metaOf(doc).get('doc') ?? '');
    if (allSessions().some(s => s.doc && s.mode !== 'ended' && ((which && String(metaOf(s.doc).get('session') ?? '') === which) || (docId && String(metaOf(s.doc).get('doc') ?? '') === docId)))) {
      guest.leave(); doc.destroy();
      throw new SessionError('You are already in this session.');
    }

    // this person's own copy of the shared document, kept up to date as the session goes. one copy per shared document: joining it again
    // later brings that same copy up to date. what it held is saved to its version history first, and what this person wrote on their
    // own is merged with what the host wrote meanwhile (three ways, against what they last agreed on)
    const title = String(metaOf(doc).get('title') ?? 'Shared document');
    const earlier = docId ? findLiveCopy(docId) : undefined;
    const fresh = earlier ?? storageService.createNewProject(`${title} (live session)`, String(metaOf(doc).get('author') ?? ''));
    if (earlier) storageService.createVersionSnapshot(earlier, 'Before rejoining the session', 'safety_net', 'Saved automatically before this copy was brought up to date from a live session.');
    // what this person wrote on their own is put back together with the session where the history they left with is still the session's
    // history, and compared by text otherwise
    const lineage = earlier && guest.role !== 'reader' ? await getLineage(earlier.id).catch(() => undefined) : undefined;
    let replay: Replayed | null = null;
    if (earlier && lineage?.closed) {
      try { replay = replayOnto(doc, lineage.state, Object.fromEntries(earlier.chapters.map(c => [c.id, c.content ?? '']))); } catch { replay = null; }
    }
    const shared = sessionShared(doc);
    const fromSession = (): Project => ({
      ...fresh,
      chapters: shared.chapters.map(c => ({ id: c.id, title: c.title, order: c.order, status: c.status, folder: c.folder, content: c.content, wordCount: countWords(c.content), updatedAt: new Date().toISOString() })),
      comments: shared.comments,
    });
    let merged: Project | null = null;
    let clashes = replay?.kept.length ?? 0;
    const base = earlier ? await loadLiveBase(earlier.id) : undefined;
    // a reader cannot add to the session, so what they hold is simply brought up to date
    if (earlier && base && guest.role !== 'reader') {
      // chapters the session history already settled are final in the session: only the rest are compared by text
      const settled = new Set(replay?.handled ?? []);
      const inSession = new Map(shared.chapters.map(c => [c.id, c.content]));
      const mine = { ...earlier, chapters: earlier.chapters.map(c => (settled.has(c.id) && inSession.has(c.id) ? { ...c, content: inSession.get(c.id)! } : c)) };
      const result = mergeLive(base, mine, shared);
      merged = result.project;
      clashes += result.kept;
      // the host and the others get what this person wrote, as small edits next to what they are typing
      for (const c of shared.chapters) {
        const now = merged.chapters.find(x => x.id === c.id);
        if (now && now.content !== c.content) editChapter(doc, c.id, now.content);
      }
      // the copy holds exactly what the session now holds
      const after = new Map(sessionShared(doc).chapters.map(c => [c.id, c.content]));
      merged = { ...merged, chapters: merged.chapters.map(c => (after.has(c.id) ? { ...c, content: after.get(c.id)!, wordCount: countWords(after.get(c.id)!) } : c)) };
    }
    const comments = (merged ?? fromSession()).comments;
    const copy: Project = {
      ...(merged ?? fromSession()),
      draftMode: (metaOf(doc).get('draftMode') as Project['draftMode']) ?? fresh.draftMode,
      ...(docId ? { liveFrom: { doc: docId, title } } : {}),
    };
    const chapters = copy.chapters;
    // the comments this person had before are known, so one they deleted can go from the session too
    const knownBefore = new Set<string>([...(earlier?.comments ?? []), ...(base?.comments ?? []), ...comments].map(c => c.id));
    addSyncedProject(copy);
    setProject(copy);
    openId.current = copy.id;
    setActiveChapterId(chapters[0]?.id ?? '');
    setViewMode('standard');

    const projectId = copy.id;
    // rejoining a document whose last session ended but was never closed: that finished session is cleared away first
    const finished = getSession(projectId);
    if (finished.mode === 'ended') { runtimes.get(projectId)?.stop(); runtimes.delete(projectId); if (finished.doc && !finished.doc.isDestroyed) finished.doc.destroy(); removeSession(projectId); }
    guest.onEnded = () => { keepAgreement(projectId); setSession(projectId, { mode: 'ended', connection: 'ok', message: 'The session ended, or the connection could not be won back. What you see here is saved in your library.' }); };
    guest.onState = state => {
      setSession(projectId, { connection: state });
      showToast(state === 'reconnecting' ? 'Connection lost. Trying to get back in…' : 'Back in the session.', 'info');
    };
    if (earlier) {
      showToast(
        merged
          ? clashes
            ? `Merged your changes with the host's. ${clashes} place${clashes === 1 ? ' was' : 's were'} rewritten by both of you, so both versions were kept one after the other. Look for the near-duplicate paragraph and keep the one you like.`
            : "Merged what you wrote on your own with the host's changes."
          : 'Brought your copy of this document up to date. What it held before is in its version history.',
        'info',
      );
    }
    setSession(projectId, { mode: 'joined', key: 1, doc, awareness: guest.awareness, guest, host: null, role: guest.role, who, address: o.address.trim(), invites: [], connection: 'ok', message: '', error: '', people: [] });
    watch(projectId, doc, [...knownBefore]);
    // from here on, the copy and the session agree: that is what the next join is compared with
    void saveLiveBase(copy).catch(() => undefined);
    keepLineage(projectId, doc, false);
    guest.awareness.on('change', () => refreshPeople(projectId));
    guest.onRole = role => setSession(projectId, { role });
    window.setTimeout(() => setSession(projectId, { role: guest.role }), 400);
    refreshPeople(projectId);
  }, [addSyncedProject, setProject, setActiveChapterId, setViewMode, refreshPeople, showToast, watch, findLiveCopy, keepAgreement]);

  // ---- the shared parts of the open document: from this device into its session ----
  useEffect(() => {
    const s = getSession(project.id);
    if (!s.doc || s.mode === 'none' || s.mode === 'ended' || s.role === 'reader') return;
    const rt = runtimes.get(project.id);
    if (!rt) return;
    const chapters = chaptersOf(s.doc);
    const comments = commentsOf(s.doc);
    s.doc.transact(() => {
      project.chapters.forEach(c => {
        const next = infoOf(c);
        const cur = chapters.get(c.id);
        if (cur && !same(cur, next)) chapters.set(c.id, next);
      });
      const have = project.comments ?? [];
      have.forEach(cm => {
        const cur = comments.get(cm.id);
        if (!cur || !same(cur, cm)) comments.set(cm.id, cm);
        rt.known.add(cm.id);
      });
      // one that was here and is gone now was removed on this device
      rt.known.forEach(id => { if (!have.some(c => c.id === id)) { comments.delete(id); rt.known.delete(id); } });
    }, LOCAL);
  }, [project.chapters, project.comments, project.id, mine.key, mine.role, mine.mode]);

  // closing the page leaves every session cleanly, so the others see the cursor go
  useEffect(() => {
    const leave = () => allSessions().forEach(s => { try { s.host?.end(); } catch { /* going anyway */ } try { s.guest?.leave(); } catch { /* going anyway */ } });
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, []);

  return { startHosting, invite, removePerson, join, end };
}
