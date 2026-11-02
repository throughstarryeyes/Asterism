// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Chapter, Project } from '../../../types';
import { DEFAULT_PROJECT } from '../../../data/defaultProject';
import { mergeLive } from '../../../services/liveMerge';
import { chapterHtml, seedDoc, sessionShared, setChapterHtml } from '../live';

// rejoining a very long manuscript must not take long, and must change only what changed

const vocab = Array.from({ length: 500 }, (_, i) => 'w' + (i * 7919).toString(36));
let seed = 11;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const paragraph = () => `<p>${Array.from({ length: 60 + Math.floor(rnd() * 80) }, () => vocab[Math.floor(rnd() * vocab.length)]).join(' ')}.</p>`;
const chapterText = (paragraphs: number) => Array.from({ length: paragraphs }, paragraph);

describe('a hundred thousand words', () => {
  it('merges and puts the guest changes into the session quickly, touching only what changed', () => {
    const chapters = Array.from({ length: 20 }, (_, i) => chapterText(50));
    const make = (texts: string[][]): Project => ({
      ...DEFAULT_PROJECT, id: 'p', title: 'Big', comments: [],
      chapters: texts.map((t, i): Chapter => ({ id: `c${i}`, title: `Chapter ${i}`, order: i + 1, status: 'draft', wordCount: 0, updatedAt: 'x', content: t.join('') })),
    });
    const base = make(chapters);
    const guestTexts = chapters.map(c => [...c]);
    const hostTexts = chapters.map(c => [...c]);
    // the guest edits one paragraph in each of five chapters; the host edits one in each of five others
    for (let i = 0; i < 5; i++) guestTexts[i][10] = guestTexts[i][10].replace('</p>', ' GUEST.</p>');
    for (let i = 10; i < 15; i++) hostTexts[i][20] = hostTexts[i][20].replace('</p>', ' HOST.</p>');

    const doc = new Y.Doc();
    seedDoc(doc, make(hostTexts));
    const words = base.chapters.reduce((n, c) => n + (c.content.match(/\S+/g) ?? []).length, 0);

    const t0 = performance.now();
    const shared = sessionShared(doc);
    const t1 = performance.now();
    const { project, clashes } = mergeLive(base, make(guestTexts), shared);
    const t2 = performance.now();
    let pushed = 0;
    for (const c of shared.chapters) {
      const mine = project.chapters.find(x => x.id === c.id)!;
      if (mine.content !== c.content && setChapterHtml(doc, c.id, mine.content)) pushed++;
    }
    const t3 = performance.now();
    console.log(`${words} words: reading the session ${(t1 - t0).toFixed(0)} ms, merging ${(t2 - t1).toFixed(0)} ms, putting changes into the session ${(t3 - t2).toFixed(0)} ms (${pushed} chapters touched)`);

    expect(clashes).toBe(0);
    expect(pushed).toBe(5);
    const after = chapterHtml(doc);
    for (let i = 0; i < 5; i++) expect(after[`c${i}`]).toContain('GUEST.');
    for (let i = 10; i < 15; i++) expect(after[`c${i}`]).toContain('HOST.');
    expect(project.chapters.filter(c => c.content.includes('GUEST.')).length).toBe(5);
    expect(project.chapters.filter(c => c.content.includes('HOST.')).length).toBe(5);
  }, 60_000);
});
