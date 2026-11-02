import { describe, it, expect } from 'vitest';
import { DEFAULT_PROJECT as P, DEFAULT_USER_STATS, WELCOME_QP } from '../defaultProject';

// the notes in the sample quote its chapters. when the text is edited, a quote that no longer matches shows up here.
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const text = Object.fromEntries(P.chapters.map(c => [c.id, plain(c.content)]));
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const inChapter = (id: string | undefined, quote: string) => !!id && text[id]?.includes(norm(quote));

describe('the sample project', () => {
  it('is Nereus, in two chapters, with both authors named', () => {
    expect(P.title).toBe('Nereus');
    expect(P.author).toBe('Kuiper Steinmeyer & AJ Sanfratello');
    expect(P.chapters.map(c => c.title)).toEqual(['Chapter 1: Scallops', 'Chapter 2: Driftwood']);
    expect(P.chapters.every(c => c.wordCount > 500)).toBe(true);
  });
  it('quotes its chapters in the comments, findings, facts and threads', () => {
    P.comments.forEach(c => expect(inChapter(c.chapterId, c.passageText), c.id).toBe(true));
    P.findings.forEach(f => f.evidencePassages.forEach(e => expect(inChapter(e.chapterId, e.quote), `${f.id}: ${e.quote}`).toBe(true)));
    P.memoryVault.establishedFacts.forEach(f => expect(inChapter(f.sourceChapterId, f.sourceQuote ?? ''), f.id).toBe(true));
    P.plotThreads.forEach(t => expect(inChapter(t.introducedInChapterId, t.passageQuote ?? ''), t.id).toBe(true));
  });
  it('points mind map lines at nodes that exist', () => {
    const ids = new Set(P.mindMap.nodes.map(n => n.id));
    P.mindMap.edges.forEach(e => { expect(ids.has(e.fromNodeId)).toBe(true); expect(ids.has(e.toNodeId)).toBe(true); });
  });
  it('starts a new writer with the welcome gift and none of someone else’s words', () => {
    expect(WELCOME_QP).toBe(200);
    expect(DEFAULT_USER_STATS.quillPoints).toBe(WELCOME_QP);
    expect(DEFAULT_USER_STATS.totalWordsWritten).toBe(0);
  });
});
