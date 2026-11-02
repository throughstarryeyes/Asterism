// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Chapter, DocumentComment, Project } from '../../../types';
import { DEFAULT_PROJECT } from '../../../data/defaultProject';
import { mergeLive } from '../../../services/liveMerge';
import { chapterHtml, fragmentName, seedDoc, sessionShared, setChapterHtml } from '../live';

const para = (t: string) => `<p>${t}</p>`;
const long = (t: string) => para(`${t} The tide came in over the old stone dock and went out again, the way it always does.`);
const chapter = (id: string, content: string, extra: Partial<Chapter> = {}): Chapter => ({ id, title: `Chapter ${id}`, order: 1, status: 'draft', wordCount: 0, updatedAt: '2026-01-01T00:00:00.000Z', content, ...extra });
const project = (chapters: Chapter[], comments: DocumentComment[] = []): Project => ({ ...DEFAULT_PROJECT, id: 'p', title: 'T', chapters, comments });
const comment = (id: string, text: string): DocumentComment => ({ id, chapterId: 'a', passageText: 'x', commentText: text, author: 'A', createdAt: `2026-01-0${id.length}T00:00:00.000Z`, resolved: false, type: 'comment' });

describe('putting a chapter back into the shared document', () => {
  const lines = ['One.', 'Two.', 'Three.', 'Four.'].map(para).join('');

  it('replaces only the paragraphs that differ and leaves the rest where they are', () => {
    const doc = new Y.Doc();
    seedDoc(doc, project([chapter('a', lines)]));
    const fragment = doc.getXmlFragment(fragmentName('a'));
    const before = fragment.toArray();
    expect(setChapterHtml(doc, 'a', ['One.', 'Two, changed.', 'Three.', 'Four.'].map(para).join(''))).toBe(true);
    const after = fragment.toArray();
    expect(chapterHtml(doc).a).toBe(['One.', 'Two, changed.', 'Three.', 'Four.'].map(para).join(''));
    // the first, third and fourth paragraphs are the very same shared objects
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    expect(after[3]).toBe(before[3]);
    expect(after[1]).not.toBe(before[1]);
  });

  it('can add, remove and swap paragraphs, and says when nothing changed', () => {
    const doc = new Y.Doc();
    seedDoc(doc, project([chapter('a', lines)]));
    expect(setChapterHtml(doc, 'a', lines)).toBe(false);
    setChapterHtml(doc, 'a', ['One.', 'Two.', 'Added.', 'Three.', 'Four.'].map(para).join(''));
    expect(chapterHtml(doc).a).toBe(['One.', 'Two.', 'Added.', 'Three.', 'Four.'].map(para).join(''));
    setChapterHtml(doc, 'a', ['One.', 'Four.'].map(para).join(''));
    expect(chapterHtml(doc).a).toBe(['One.', 'Four.'].map(para).join(''));
    setChapterHtml(doc, 'a', para('Only.'));
    expect(chapterHtml(doc).a).toBe(para('Only.'));
  });

  it('keeps formatting, headings and scene breaks', () => {
    const doc = new Y.Doc();
    const rich = '<h2>Title</h2><p>Plain and <strong>bold</strong> and <em>slanted</em>.</p>';
    seedDoc(doc, project([chapter('a', rich)]));
    const richer = rich + '<hr data-separator="stars"><p data-separator-mark="1" style="text-align: center;">* * *</p><p>After.</p>';
    setChapterHtml(doc, 'a', richer);
    const out = chapterHtml(doc).a;
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('data-separator="stars"');
    expect(out).toContain('<p>After.</p>');
  });

  it('describes what the session holds', () => {
    const doc = new Y.Doc();
    seedDoc(doc, project([chapter('a', para('Hello.'), { order: 1 }), chapter('b', para('Bye.'), { order: 2 })], [comment('1', 'note')]));
    const s = sessionShared(doc);
    expect(s.chapters.map(c => [c.id, c.content])).toEqual([['a', para('Hello.')], ['b', para('Bye.')]]);
    expect(s.comments.map(c => c.id)).toEqual(['1']);
  });
});

describe('merging a guest copy with the session when they come back', () => {
  const base = project([chapter('a', ['One.', 'Two.', 'Three.', 'Four.'].map(long).join(''))]);
  const shared = (content: string) => ({ chapters: [{ id: 'a', title: 'Chapter a', order: 1, status: 'draft' as const, content }], comments: [] as DocumentComment[] });
  const text = (p: Project) => p.chapters.find(c => c.id === 'a')!.content;

  it('keeps what the guest wrote and what the host wrote when they were in different places', () => {
    const local = project([chapter('a', ['One, by the guest.', 'Two.', 'Three.', 'Four.'].map(long).join(''))]);
    const remote = shared(['One.', 'Two.', 'Three.', 'Four, by the host.'].map(long).join(''));
    const { project: out, clashes } = mergeLive(base, local, remote);
    expect(mergeLive(base, local, remote).places).toEqual([]);
    expect(clashes).toBe(0);
    expect(text(out)).toBe(['One, by the guest.', 'Two.', 'Three.', 'Four, by the host.'].map(long).join(''));
  });

  it('keeps both versions where both rewrote the same words, and counts it', () => {
    const local = project([chapter('a', ['One.', 'Two, guest way.', 'Three.', 'Four.'].map(long).join(''))]);
    const remote = shared(['One.', 'Two, host way.', 'Three.', 'Four.'].map(long).join(''));
    const { project: out, clashes, kept } = mergeLive(base, local, remote);
    expect(clashes).toBeGreaterThan(0);
    expect(kept).toBe(clashes);
    expect(text(out)).toContain('Two, host way.');
    expect(text(out)).toContain('Two, guest way.');
    expect(text(out)).toContain(long('One.'));
    expect(text(out)).toContain(long('Four.'));
  });

  it('merges edits in different parts of the same paragraph without a clash', () => {
    const local = project([chapter('a', ['One, guest way.', 'Two.', 'Three.', 'Four.'].map(long).join(''))]);
    const remote = shared(['One.', 'Two.', 'Three.', 'Four.'].map((t, i) => (i === 0 ? long(t).replace('came in', 'rushed in') : long(t))).join(''));
    const { project: out, clashes } = mergeLive(base, local, remote);
    expect(clashes).toBe(0);
    expect(text(out)).toContain('One, guest way.');
    expect(text(out)).toContain('rushed in');
  });

  it('takes the host changes when the guest wrote nothing, and keeps the copy when the host wrote nothing', () => {
    const untouched = project(base.chapters);
    expect(text(mergeLive(base, untouched, shared(long('Host rewrote it all.'))).project)).toBe(long('Host rewrote it all.'));
    const edited = project([chapter('a', long('Guest rewrote it all.'))]);
    expect(text(mergeLive(base, edited, shared(base.chapters[0].content)).project)).toBe(long('Guest rewrote it all.'));
  });

  it('brings in a chapter the host added, and keeps one the guest added', () => {
    const local = project([...base.chapters, chapter('mine', long('Only on my side.'), { order: 2 })]);
    const remote = {
      chapters: [
        { id: 'a', title: 'Chapter a', order: 1, status: 'draft' as const, content: base.chapters[0].content },
        { id: 'theirs', title: 'New', order: 3, status: 'draft' as const, content: long('From the host.') },
      ],
      comments: [] as DocumentComment[],
    };
    const { project: out } = mergeLive(base, local, remote);
    expect(out.chapters.map(c => c.id).sort()).toEqual(['a', 'mine', 'theirs']);
    expect(out.chapters.find(c => c.id === 'theirs')!.content).toBe(long('From the host.'));
  });

  it('lets a chapter go when the host removed it and the guest never touched it, but keeps one the guest changed', () => {
    const two = project([...base.chapters, chapter('b', long('Second.'), { order: 2 })]);
    const untouched = project(two.chapters);
    const removed = mergeLive(two, untouched, shared(base.chapters[0].content)).project;
    expect(removed.chapters.map(c => c.id)).toEqual(['a']);
    const changed = project([...base.chapters, chapter('b', long('Second, rewritten by the guest.'), { order: 2 })]);
    const kept = mergeLive(two, changed, shared(base.chapters[0].content)).project;
    expect(kept.chapters.find(c => c.id === 'b')?.content).toBe(long('Second, rewritten by the guest.'));
  });

  it('merges comments: a new one from each side stays, one the guest deleted goes', () => {
    const b = project(base.chapters, [comment('1', 'old'), comment('22', 'also old')]);
    const local = project(base.chapters, [comment('1', 'old'), comment('333', 'guest added')]);
    const remote = { chapters: shared(base.chapters[0].content).chapters, comments: [comment('1', 'old'), comment('22', 'also old'), comment('4444', 'host added')] };
    const ids = mergeLive(b, local, remote).project.comments.map(c => c.id).sort();
    expect(ids).toEqual(['1', '333', '4444']);
  });

  it('leaves everything private to the guest alone', () => {
    const local = { ...project(base.chapters), storyBible: { ...base.storyBible, characters: [{ id: 'c', name: 'Only mine' } as never] } };
    const out = mergeLive(base, local, shared(base.chapters[0].content)).project;
    expect(out.storyBible.characters.some(c => c.name === 'Only mine')).toBe(true);
  });
});
