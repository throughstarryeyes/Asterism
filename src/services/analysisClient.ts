import type { Project } from '../types';
import { cachedReading, rememberReading, type ManuscriptSource, type StoryAnalysisResult, type StoryContext } from './storyAnalyzer';
import { handleRequest, type AnalysisRequest, type AnalysisResult } from './analysisRequests';

// asks a background worker for the slow readings, and falls back to doing them on the page when there is no worker
// a finished reading is remembered, so anything that asks for it later on the page gets it at once

let worker: Worker | null = null;
let broken = false;
let nextId = 1;
const waiting = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; request: AnalysisRequest }>();

// without a worker (tests, old browsers), or after one fails, the work happens here
const onPage = <R extends AnalysisRequest>(request: R) =>
  new Promise<AnalysisResult<R>>((resolve, reject) => setTimeout(() => {
    try { resolve(handleRequest(request)); } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
  }, 0));

function start(): Worker | null {
  if (worker || broken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const job = waiting.get(data.id);
      if (!job) return;
      waiting.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    worker.onerror = () => {
      // the worker could not start or died: do what it was asked on the page instead
      broken = true;
      worker = null;
      const stranded = [...waiting.values()];
      waiting.clear();
      stranded.forEach(job => onPage(job.request).then(job.resolve, job.reject));
    };
  } catch {
    broken = true;
    worker = null;
  }
  return worker;
}

function ask<R extends AnalysisRequest>(request: R): Promise<AnalysisResult<R>> {
  const live = start();
  if (!live) return onPage(request);
  return new Promise<AnalysisResult<R>>((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve: resolve as (value: unknown) => void, reject, request });
    live.postMessage({ id, request });
  });
}

// only what a reading depends on goes to the worker
const slim = (source: ManuscriptSource): ManuscriptSource => ({
  chapters: source.chapters,
  storyBible: source.storyBible,
  draftMode: source.draftMode,
  memoryVault: source.memoryVault ? { preferences: source.memoryVault.preferences } : undefined,
});

const inflight = new WeakMap<object, { bible: unknown; rules: unknown; mode: unknown; promise: Promise<StoryContext> }>();

// the scenes and the cast, read away from the page
export function readStory(source: ManuscriptSource): Promise<StoryContext> {
  const ready = cachedReading(source);
  if (ready) return Promise.resolve(ready);

  const running = inflight.get(source.chapters);
  if (running && running.bible === source.storyBible && running.rules === source.memoryVault?.preferences && running.mode === source.draftMode) return running.promise;

  const promise = ask({ op: 'read', source: slim(source) }).then(value => {
    rememberReading(source, value);
    return value;
  });
  inflight.set(source.chapters, { bible: source.storyBible, rules: source.memoryVault?.preferences, mode: source.draftMode, promise });
  return promise;
}

// the full scan, away from the page
export function scanStory(project: Project, options: Parameters<typeof import('./storyAnalyzer').performStoryAnalysis>[1] = {}): Promise<StoryAnalysisResult> {
  return ask({ op: 'scan', project, options });
}
