import * as Y from 'yjs';
import { Editor } from '@tiptap/core';
import { prosemirrorJSONToYXmlFragment, updateYFragment, yXmlFragmentToProseMirrorRootNode } from '@tiptap/y-tiptap';
import type { Project } from '../../types';
import { balanced, diffRuns, matches, mergeText, splitBlocks, splitTokens, type Run } from '../../services/sync/merge';
import { editorExtensions } from '../extensions';
import { editorHtml } from '../html';
import { chaptersOf, commentsOf, fragmentName, LOCAL, metaOf, type ChapterInfo } from './live';

// keeping a shared document's history between sessions, so that what two people wrote apart can be put back together letter by letter.
//
// a live session is a Yjs document, and Yjs merges concurrent edits exactly. but two copies of a document only merge that way if they
// share a history, and a document built fresh from its text each time has none. so a session's final state is kept on each device
// (see syncStore), the next session starts from it, and what a person wrote while no session was running is turned back into edits
// on that history. those edits then merge with whatever the others wrote in the meantime, even inside the same paragraph.

// ---- the edits between two versions of a chapter ----

interface Segment { same: string; bt?: string[]; nt?: string[]; runs?: Run[] }

const MAX_STEPS = 400;

// every version of a chapter between `from` and `to`, each one a single small change from the one before: a corrected word, a new
// sentence, a bold span. applied one after another they become small edits instead of one big replacement, which is what lets another
// person's edits nearby survive. a version that would leave formatting half open is never produced.
export function stepsBetween(from: string, to: string): string[] {
  if (from === to) return [];
  const b = splitBlocks(from), n = splitBlocks(to);
  const m = matches(b, n);
  if (!m) return [to];

  // whole blocks that are the same, and the stretches between them that are not
  const segments: Segment[] = [];
  let bi = 0, ni = 0;
  const flush = (b1: number, n1: number) => {
    if (b1 === bi && n1 === ni) return;
    const bt = splitTokens(b.slice(bi, b1).join('')), nt = splitTokens(n.slice(ni, n1).join(''));
    segments.push({ same: '', bt, nt, runs: diffRuns(bt, nt) ?? [{ b0: 0, b1: bt.length, n0: 0, n1: nt.length }] });
    bi = b1; ni = n1;
  };
  for (let i = 0; i < b.length; i++) {
    const j = m.get(i);
    if (j === undefined) continue;
    flush(i, j);
    segments.push({ same: b[i] });
    bi = i + 1; ni = j + 1;
  }
  flush(b.length, n.length);

  const total = segments.reduce((sum, s) => sum + (s.runs?.length ?? 0), 0);
  // how many of each segment's runs are applied so far
  const done = segments.map(() => 0);
  const render = (k: number): string => {
    const s = segments[k];
    if (!s.runs || !s.bt || !s.nt) return s.same;
    let out = '';
    let at = 0;
    s.runs.forEach((r, i) => {
      out += s.bt!.slice(at, r.b0).join('');
      out += (i < done[k] ? s.nt!.slice(r.n0, r.n1) : s.bt!.slice(r.b0, r.b1)).join('');
      at = r.b1;
    });
    return out + s.bt.slice(at).join('');
  };
  const whole = () => segments.map((_, k) => render(k)).join('');

  const steps: string[] = [];
  segments.forEach((s, k) => {
    if (!s.runs) return;
    if (total > MAX_STEPS) { done[k] = s.runs.length; steps.push(whole()); return; }
    for (let i = 0; i < s.runs.length; i++) {
      done[k] = i + 1;
      // formatting opened by one change and closed by the next goes in together
      if (!balanced(render(k)) && i < s.runs.length - 1) continue;
      steps.push(whole());
    }
  });
  // the last step is always exactly what was asked for
  if (steps[steps.length - 1] !== to) steps.push(to);
  return steps;
}

// ---- putting versions into a shared document ----

function fragmentHtml(editor: Editor, doc: Y.Doc, chapterId: string): string {
  editor.commands.setContent(yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(fragmentName(chapterId)), editor.schema).toJSON());
  return editorHtml(editor);
}

// makes a chapter in the shared document read `html`, as small edits from what it holds now. false when it already did.
export function editChapter(doc: Y.Doc, chapterId: string, html: string): boolean {
  const editor = new Editor({ extensions: editorExtensions(), content: '' });
  try {
    const steps = stepsBetween(fragmentHtml(editor, doc, chapterId), editorHtmlOf(editor, html));
    if (!steps.length) return false;
    const fragment = doc.getXmlFragment(fragmentName(chapterId));
    for (const step of steps) {
      editor.commands.setContent(step || '');
      doc.transact(() => updateYFragment(doc, fragment, editor.state.doc, { mapping: new Map(), isOMark: new Map() }), LOCAL);
    }
    return true;
  } finally {
    editor.destroy();
  }
}

// html as the editor would write it back, so two spellings of the same text are not mistaken for an edit
function editorHtmlOf(editor: Editor, html: string): string {
  editor.commands.setContent(html || '');
  return editorHtml(editor);
}

// ---- the history kept between sessions ----

export const encodeState = (doc: Y.Doc): Uint8Array => Y.encodeStateAsUpdate(doc);

// the session a kept history belongs to, or undefined when it is not a usable one
export function sessionOf(state: Uint8Array): string | undefined {
  const scratch = new Y.Doc();
  try {
    Y.applyUpdate(scratch, state);
    const id = metaOf(scratch).get('session');
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  } finally {
    scratch.destroy();
  }
}

export interface Replayed {
  // every chapter the live document and the saved history both hold: their text in the live document is now the settled one
  handled: string[];
  // of those, the ones that changed because of what was written apart
  chapters: string[];
  // of those, the ones where both sides rewrote the same words, so both versions were kept
  kept: string[];
}

// puts what was written while apart into the live document. `saved` is the shared history as it was when this person left, and
// `texts` is what each chapter reads now on their side. returns null when the live document does not share that history, in which
// case nothing was touched and the caller falls back to comparing text.
//
// three things happen. anything this person wrote that the live document never received goes in exactly (that is what the shared
// history is for). then each chapter they changed is merged three ways against the text of that history, word by word, and written into
// the live document as small edits next to whatever the others typed. where both sides rewrote the same words, both versions are kept:
// replaying such an edit letter by letter would knit two different words into one that neither person wrote.
export function replayOnto(live: Y.Doc, saved: Uint8Array, texts: Record<string, string>): Replayed | null {
  const base = new Y.Doc();
  const editor = new Editor({ extensions: editorExtensions(), content: '' });
  try {
    Y.applyUpdate(base, saved);
    const session = metaOf(base).get('session');
    if (!session || session !== metaOf(live).get('session')) return null;
    // the connection can drop before the last edits arrive, so they are in this person's history and not yet in the live one
    Y.applyUpdate(live, Y.encodeStateAsUpdate(base, Y.encodeStateVector(live)), LOCAL);

    const touched: string[] = [];
    const kept: string[] = [];
    const handled: string[] = [];
    for (const [id, html] of Object.entries(texts)) {
      if (!chaptersOf(base).has(id) || !chaptersOf(live).has(id)) continue;
      handled.push(id);
      const was = fragmentHtml(editor, base, id);
      const mine = editorHtmlOf(editor, html);
      if (mine === was) continue;
      const now = fragmentHtml(editor, live, id);
      const merged = mergeText(was, mine, now) ?? mergeText(was, mine, now, true);
      if (merged === null) {
        // too big to compare: the edit is replayed letter by letter on the shared history instead, and Yjs settles it
        const before = Y.encodeStateVector(base);
        if (editChapter(base, id, html)) {
          Y.applyUpdate(live, Y.encodeStateAsUpdate(base, before), LOCAL);
          touched.push(id);
        }
        continue;
      }
      if (mergeText(was, mine, now) === null) kept.push(id);
      if (merged !== now && editChapter(live, id, merged)) touched.push(id);
    }
    return { handled, chapters: touched, kept };
  } finally {
    editor.destroy();
    base.destroy();
  }
}

// starts a session from the history kept at the end of the last one, then brings in what the host wrote since: texts, titles, chapters
// added or removed. false when the kept history is for some other document, in which case `doc` is untouched.
export function resumeDoc(doc: Y.Doc, project: Project, saved: Uint8Array): boolean {
  const wanted = project.liveFrom?.doc ?? project.id;
  const check = new Y.Doc();
  try {
    Y.applyUpdate(check, saved);
    if (metaOf(check).get('doc') !== wanted || !metaOf(check).get('session')) return false;
  } catch {
    return false;
  } finally {
    check.destroy();
  }

  Y.applyUpdate(doc, saved);
  const editor = new Editor({ extensions: editorExtensions(), content: '' });
  try {
    const infos = chaptersOf(doc);
    doc.transact(() => {
      const meta = metaOf(doc);
      meta.set('title', project.title);
      meta.set('author', project.author ?? '');
      meta.set('draftMode', project.draftMode ?? 'chaptered');
      for (const c of project.chapters) {
        const info: ChapterInfo = { title: c.title, order: c.order, status: c.status, ...(c.folder ? { folder: c.folder } : {}) };
        const had = infos.get(c.id);
        if (!had) {
          editor.commands.setContent(c.content || '');
          prosemirrorJSONToYXmlFragment(editor.schema, editor.getJSON(), doc.getXmlFragment(fragmentName(c.id)));
        }
        if (!had || JSON.stringify(had) !== JSON.stringify(info)) infos.set(c.id, info);
      }
      // a chapter the host removed while no session was running is gone for everyone
      for (const id of [...infos.keys()]) if (!project.chapters.some(c => c.id === id)) infos.delete(id);
      // comments the same way: what the host's document holds now is what the session starts with
      const comments = commentsOf(doc);
      const have = project.comments ?? [];
      for (const cm of have) if (JSON.stringify(comments.get(cm.id)) !== JSON.stringify(cm)) comments.set(cm.id, cm);
      for (const id of [...comments.keys()]) if (!have.some(c => c.id === id)) comments.delete(id);
    }, LOCAL);
    // the host's own edits since the session ended
    for (const c of project.chapters) if (infos.has(c.id)) editChapter(doc, c.id, c.content);
  } finally {
    editor.destroy();
  }
  return true;
}
