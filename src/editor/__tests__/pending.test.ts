import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPending, stashPending } from '../pending';
import type { Project } from '../../types';

const chapter = (updatedAt: string, content = '<p>old</p>') => ({ id: 'c1', title: 'One', order: 1, content, status: 'draft' as const, wordCount: 1, updatedAt });
const project = (updatedAt: string, content?: string) => ({ id: 'p1', chapters: [chapter(updatedAt, content)] }) as unknown as Project;

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  });
});

describe('text kept as the page closes', () => {
  it('puts back words that were never saved', () => {
    stashPending('p1', 'c1', '<p>old and new words</p>');
    const out = applyPending(project('2000-01-01T00:00:00.000Z'));
    expect(out.chapters[0].content).toBe('<p>old and new words</p>');
    expect(out.chapters[0].wordCount).toBe(4);
  });

  it('leaves alone text that was saved after the note was written', () => {
    stashPending('p1', 'c1', '<p>stale</p>');
    const out = applyPending(project('2999-01-01T00:00:00.000Z'));
    expect(out.chapters[0].content).toBe('<p>old</p>');
  });

  it('does not mix up documents that share chapter ids', () => {
    stashPending('other-project', 'c1', '<p>not yours</p>');
    const out = applyPending(project('2000-01-01T00:00:00.000Z'));
    expect(out.chapters[0].content).toBe('<p>old</p>');
  });

  it('is used once', () => {
    stashPending('p1', 'c1', '<p>once</p>');
    applyPending(project('2000-01-01T00:00:00.000Z'));
    expect(applyPending(project('2000-01-01T00:00:00.000Z')).chapters[0].content).toBe('<p>old</p>');
  });
});
