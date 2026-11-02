// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Chapter, Project } from '../../../types';
import { DEFAULT_PROJECT } from '../../../data/defaultProject';
import { balanced } from '../../../services/sync/merge';
import { chapterHtml, chaptersOf, seedDoc } from '../live';
import { editChapter, replayOnto, resumeDoc, sessionOf, stepsBetween } from '../lineage';

const para = (t: string) => `<p>${t}</p>`;
const chapter = (id: string, content: string, extra: Partial<Chapter> = {}): Chapter => ({ id, title: `Chapter ${id}`, order: 1, status: 'draft', wordCount: 0, updatedAt: '2026-01-01T00:00:00.000Z', content, ...extra });
const project = (chapters: Chapter[]): Project => ({ ...DEFAULT_PROJECT, id: 'p', title: 'T', chapters, comments: [] });

const FOX = 'The fox jumped over the lazy dog near the river bank at dawn.';
const OPENING = para('It was a quiet morning in the valley.');
const CLOSING = para('Nobody saw them leave.');
const base = OPENING + para(FOX) + CLOSING;

// a host document and a guest who joined it: the guest holds a copy of the host's history
function joined() {
  const host = new Y.Doc();
  seedDoc(host, project([chapter('a', base)]));
  const guest = new Y.Doc();
  Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
  return { host, guest, saved: Y.encodeStateAsUpdate(guest) };
}

describe('the steps between two versions of a chapter', () => {
  it('goes from one to the other in small changes that always keep the formatting closed', () => {
    const to = OPENING + para('The <strong>red fox</strong> jumped over the lazy dog near the river bank at sunset, laughing.') + CLOSING;
    const steps = stepsBetween(base, to);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps[steps.length - 1]).toBe(to);
    expect(steps.every(balanced)).toBe(true);
  });

  it('has nothing to do when nothing changed', () => {
    expect(stepsBetween(base, base)).toEqual([]);
  });
});

describe('editing a chapter of the shared document', () => {
  it('changes only the words that changed and leaves the paragraph in place', () => {
    const { host } = joined();
    const paragraph = host.getXmlFragment('ch:a').toArray()[1];
    expect(editChapter(host, 'a', OPENING + para(FOX.replace('lazy', 'sleepy')) + CLOSING)).toBe(true);
    expect(chapterHtml(host).a).toContain('sleepy dog');
    expect(host.getXmlFragment('ch:a').toArray()[1]).toBe(paragraph);
    expect(editChapter(host, 'a', chapterHtml(host).a)).toBe(false);
  });
});

describe('writing apart in the same paragraph, then coming back together', () => {
  it('keeps a change at the start from the host and a change at the end from the guest', () => {
    const { host, guest, saved } = joined();
    // the host types in the session; the guest, no longer in it, edits their copy of the text
    editChapter(host, 'a', OPENING + para(FOX.replace('The fox', 'The red fox')) + CLOSING);
    const guestText = OPENING + para(FOX.replace('at dawn.', 'at dawn, laughing.')) + CLOSING;
    const result = replayOnto(host, saved, { a: guestText });
    expect(result?.chapters).toEqual(['a']);
    const out = chapterHtml(host).a;
    expect(out).toContain('The red fox jumped');
    expect(out).toContain('at dawn, laughing.');
    expect(out.match(/<p>/g)).toHaveLength(3);
  });

  it('keeps both when each side rewrote the same words, and loses neither', () => {
    const { host, guest, saved } = joined();
    editChapter(host, 'a', OPENING + para(FOX.replace('lazy', 'sleepy')) + CLOSING);
    const result = replayOnto(host, saved, { a: OPENING + para(FOX.replace('lazy', 'tired')) + CLOSING });
    expect(result?.kept).toEqual(['a']);
    const out = chapterHtml(host).a;
    // both versions of the paragraph, whole, and no word knitted out of the two
    expect(out).toContain('over the sleepy dog');
    expect(out).toContain('over the tired dog');
    expect(out).not.toContain('lazy');
    expect(out).not.toContain('sleeptired');
    expect(out.match(/<p>/g)).toHaveLength(4);
    expect(guest.isDestroyed).toBe(false);
  });

  it('keeps edits that are far apart in one long paragraph, not just the ones next to each other', () => {
    const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} says something about the tide.`).join(' ');
    const doc = new Y.Doc();
    seedDoc(doc, project([chapter('a', para(long))]));
    const guest = new Y.Doc();
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(doc));
    const saved = Y.encodeStateAsUpdate(guest);
    // the host fixes a word in the middle; the guest changes the first and the last sentence
    editChapter(doc, 'a', para(long.replace('number 6', 'number six')));
    replayOnto(doc, saved, { a: para(long.replace('Sentence number 1 ', 'Sentence one ').replace('number 12 says', 'number twelve says')) });
    const out = chapterHtml(doc).a;
    expect(out).toContain('Sentence one says');
    expect(out).toContain('number six says');
    expect(out).toContain('number twelve says');
  });

  it('keeps a paragraph the guest added and one the host added', () => {
    const { host, saved } = joined();
    editChapter(host, 'a', OPENING + para(FOX) + para('The host added this.') + CLOSING);
    replayOnto(host, saved, { a: para('The guest added this.') + OPENING + para(FOX) + CLOSING });
    const out = chapterHtml(host).a;
    expect(out).toContain('The host added this.');
    expect(out).toContain('The guest added this.');
    expect(out).toContain('quiet morning');
  });

  it('applies a deletion by the guest to text the host did not touch', () => {
    const { host, saved } = joined();
    editChapter(host, 'a', OPENING + para(FOX) + CLOSING.replace('Nobody', 'Almost nobody'));
    replayOnto(host, saved, { a: OPENING + CLOSING });
    const out = chapterHtml(host).a;
    expect(out).not.toContain('fox');
    expect(out).toContain('Almost nobody saw them leave.');
  });

  it('brings in what the guest wrote even when the host document never saw their last edits', () => {
    const { host, guest } = joined();
    // the guest typed after the line dropped, so the host never received it
    editChapter(guest, 'a', OPENING + para(FOX + ' One more thing.') + CLOSING);
    const saved = Y.encodeStateAsUpdate(guest);
    editChapter(host, 'a', OPENING + para(FOX.replace('The fox', 'The red fox')) + CLOSING);
    replayOnto(host, saved, { a: chapterHtml(guest).a.replace('One more thing.', 'One more thing, said twice.') });
    const out = chapterHtml(host).a;
    expect(out).toContain('The red fox');
    expect(out).toContain('One more thing, said twice.');
  });

  it('does not touch a chapter the guest did not change', () => {
    const doc = new Y.Doc();
    seedDoc(doc, project([chapter('a', base, { order: 1 }), chapter('b', para('Second.'), { order: 2 })]));
    const guest = new Y.Doc();
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(doc));
    const saved = Y.encodeStateAsUpdate(guest);
    editChapter(doc, 'b', para('Second, by the host.'));
    const result = replayOnto(doc, saved, { a: chapterHtml(guest).a, b: chapterHtml(guest).b });
    expect(result?.chapters).toEqual([]);
    expect(chapterHtml(doc).b).toBe(para('Second, by the host.'));
  });

  it('gives up cleanly when the history belongs to another session', () => {
    const { host } = joined();
    const stranger = new Y.Doc();
    seedDoc(stranger, project([chapter('a', base)]));
    const before = chapterHtml(host).a;
    expect(replayOnto(host, Y.encodeStateAsUpdate(stranger), { a: para('Anything else.') })).toBeNull();
    expect(chapterHtml(host).a).toBe(before);
  });

  it('gives the same text on both ends once everything has been exchanged', () => {
    const { host, guest, saved } = joined();
    editChapter(host, 'a', OPENING + para(FOX.replace('The fox', 'The red fox')) + CLOSING);
    replayOnto(host, saved, { a: OPENING + para(FOX.replace('dawn.', 'dawn, laughing.')) + CLOSING });
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
    expect(chapterHtml(guest).a).toBe(chapterHtml(host).a);
  });
});

describe('hosting again from the history of the last session', () => {
  it('reads the session a kept history belongs to', () => {
    const { saved } = joined();
    expect(sessionOf(saved)).toMatch(/^sess-/);
    expect(sessionOf(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });

  it('starts from the kept history, so a guest who left earlier still shares it', () => {
    const first = new Y.Doc();
    const p = project([chapter('a', base)]);
    seedDoc(first, p);
    const guest = new Y.Doc();
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(first));
    const guestSaved = Y.encodeStateAsUpdate(guest);
    const hostSaved = Y.encodeStateAsUpdate(first);

    // the host writes between sessions, in the text of their own document, and renames the chapter
    const hostNow = project([chapter('a', OPENING + para(FOX.replace('The fox', 'The red fox')) + CLOSING, { title: 'Renamed' })]);
    const second = new Y.Doc();
    expect(resumeDoc(second, hostNow, hostSaved)).toBe(true);
    expect(chapterHtml(second).a).toContain('The red fox');
    expect(chaptersOf(second).get('a')?.title).toBe('Renamed');

    // the guest, also writing apart, comes in and the two meet inside the same paragraph
    const result = replayOnto(second, guestSaved, { a: OPENING + para(FOX.replace('dawn.', 'dawn, laughing.')) + CLOSING });
    expect(result?.chapters).toEqual(['a']);
    const out = chapterHtml(second).a;
    expect(out).toContain('The red fox');
    expect(out).toContain('at dawn, laughing.');
  });

  it('brings in a chapter added and drops one removed while no session was running', () => {
    const first = new Y.Doc();
    seedDoc(first, project([chapter('a', base, { order: 1 }), chapter('gone', para('Cut.'), { order: 2 })]));
    const saved = Y.encodeStateAsUpdate(first);
    const now = project([chapter('a', base, { order: 1 }), chapter('new', para('Fresh.'), { order: 2 })]);
    const second = new Y.Doc();
    expect(resumeDoc(second, now, saved)).toBe(true);
    expect([...chaptersOf(second).keys()].sort()).toEqual(['a', 'new']);
    expect(chapterHtml(second).new).toBe(para('Fresh.'));
  });

  it('refuses a history that belongs to another document', () => {
    const other = new Y.Doc();
    seedDoc(other, { ...project([chapter('a', base)]), id: 'someone-elses' });
    const doc = new Y.Doc();
    expect(resumeDoc(doc, project([chapter('a', base)]), Y.encodeStateAsUpdate(other))).toBe(false);
    expect(chaptersOf(doc).size).toBe(0);
  });
});
