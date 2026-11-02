import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleRequest } from '../analysisRequests';
import { buildStoryContext, performStoryAnalysis } from '../storyAnalyzer';
import type { Chapter, Project } from '../../types';

const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';
const chapters = (): Chapter[] =>
  [`Mara walked to the docks. Elias was already waiting. ${quiet}`, `Elias said nothing. Mara waited. ${quiet}`, quiet, quiet, quiet]
    .map((t, i) => ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: `<p>${t}</p>`, status: 'draft', wordCount: 0, updatedAt: '' }));
const project = (): Project => ({
  id: 'p', title: 'T', author: 'A', genre: '', synopsis: '', draftMode: 'chaptered', chapters: chapters(),
  storyBible: { characters: [], locations: [], lore: [] }, plotThreads: [], reflections: [], goals: [], comments: [], findings: [],
  memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false } },
} as unknown as Project);

describe('the requests a background worker answers', () => {
  it('reads the story the same way the page does', () => {
    const p = project();
    const fromRequest = handleRequest({ op: 'read', source: { chapters: p.chapters, storyBible: p.storyBible, draftMode: p.draftMode } });
    expect(fromRequest.units.map(u => u.title)).toEqual(buildStoryContext({ chapters: chapters(), storyBible: p.storyBible, draftMode: p.draftMode }).units.map(u => u.title));
    expect(fromRequest.index.entities.map(e => e.canonical).sort()).toEqual(['Elias', 'Mara']);
  });

  it('scans the same way the page does', () => {
    const p = project();
    expect(handleRequest({ op: 'scan', project: p, options: {} }).findings.map(f => f.id)).toEqual(performStoryAnalysis(p).findings.map(f => f.id));
  });

  it('survives being copied across to a worker and back', () => {
    const p = project();
    const copy = structuredClone(handleRequest({ op: 'read', source: p }));
    expect(copy.index.entities.length).toBe(2);
    expect(structuredClone(handleRequest({ op: 'scan', project: p, options: {} })).findings).toBeDefined();
  });
});

describe('asking for a reading', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  // a stand-in for the browser's worker that answers the way ours does
  class FakeWorker {
    static fail = false;
    static started = 0;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { FakeWorker.started++; }
    postMessage(message: { id: number; request: Parameters<typeof handleRequest>[0] }) {
      setTimeout(() => {
        if (FakeWorker.fail) { this.onerror?.(); return; }
        this.onmessage?.({ data: { id: message.id, result: structuredClone(handleRequest(message.request)) } });
      }, 0);
    }
  }

  const fresh = async () => {
    vi.resetModules();
    FakeWorker.fail = false;
    FakeWorker.started = 0;
    vi.stubGlobal('Worker', FakeWorker);
    const client = await import('../analysisClient');
    const analyzer = await import('../storyAnalyzer');
    return { ...client, ...analyzer };
  };

  it('reads on the worker, and remembers the reading for the page', async () => {
    const { readStory, buildStoryContext: build } = await fresh();
    const p = project();
    const source = { chapters: p.chapters, storyBible: p.storyBible, draftMode: p.draftMode };
    const reading = await readStory(source);
    expect(FakeWorker.started).toBe(1);
    expect(reading.index.entities.length).toBe(2);
    expect(build(source)).toBe(reading); // the page now gets it back without reading again
    expect(await readStory(source)).toBe(reading);
  });

  it('shares one request between callers who ask at the same time', async () => {
    const { readStory } = await fresh();
    const p = project();
    const source = { chapters: p.chapters, storyBible: p.storyBible, draftMode: p.draftMode };
    const [a, b] = await Promise.all([readStory(source), readStory({ ...source })]);
    expect(a).toBe(b);
  });

  it('scans on the worker', async () => {
    const { scanStory } = await fresh();
    const p = project();
    const result = await scanStory(p, {});
    expect(result.findings.map(f => f.id)).toEqual(performStoryAnalysis(p).findings.map(f => f.id));
  });

  it('does the work on the page when there is no worker', async () => {
    vi.resetModules();
    const { readStory, scanStory } = await import('../analysisClient');
    const { cachedReading: cached } = await import('../storyAnalyzer');
    const p = project();
    const source = { chapters: p.chapters, storyBible: p.storyBible, draftMode: p.draftMode };
    const reading = await readStory(source);
    expect(cached(source)).toBe(reading);
    expect((await scanStory(p, {})).findings).toBeDefined();
  });

  it('does the work on the page when the worker fails', async () => {
    const { readStory } = await fresh();
    FakeWorker.fail = true;
    const p = project();
    const reading = await readStory({ chapters: p.chapters, storyBible: p.storyBible, draftMode: p.draftMode });
    expect(reading.index.entities.length).toBe(2);
  });

  it('reads again after the text changes', async () => {
    const { readStory } = await fresh();
    const p = project();
    const first = await readStory({ chapters: p.chapters, storyBible: p.storyBible, draftMode: p.draftMode });
    const second = await readStory({ chapters: chapters(), storyBible: p.storyBible, draftMode: p.draftMode });
    expect(second).not.toBe(first);
  });
});
