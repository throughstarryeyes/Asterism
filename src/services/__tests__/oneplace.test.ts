import { describe, it, expect } from 'vitest';
import { performStoryAnalysis } from '../storyAnalyzer';
import type { Chapter, Project } from '../../types';

const p = (text: string) => `<p>${text}</p>`;
const chapter = (i: number, html: string): Chapter => ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: html, status: 'draft', wordCount: 0, updatedAt: '' });
const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';

function project(): Project {
  return {
    id: 'p1', title: 'Test', author: 'Tester', genre: 'fiction', synopsis: '', draftMode: 'chaptered',
    chapters: [
      chapter(0, p('Mara looked up, her green eyes wide. Mara, 34, sat down. ' + quiet)),
      chapter(1, p('Mara, 36, stood up. ' + quiet))
    ],
    storyBible: {
      characters: [{ id: 'm', name: 'Mara', role: 'protagonist', coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription: 'Tall, with brown eyes.', theSecret: '', relationships: [] }],
      locations: [], lore: []
    },
    plotThreads: [], reflections: [], goals: [], comments: [],
    timeline: [
      { id: 'a', title: 'First', when: 'June 1st, 2017', chapterId: 'c0', quote: 'Mara, 34, sat down.', createdAt: '' },
      { id: 'b', title: 'Second', when: 'May 1st, 2017', createdAt: '' }
    ],
    mindMap: { id: 'mm', title: 'Map', nodes: [], edges: [] },
    findings: [],
    memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false } },
    createdAt: '', updatedAt: ''
  } as Project;
}

describe('every kind of finding comes out of one scan', () => {
  it('has timeline checks, Bible checks and character checks together', () => {
    const ids = performStoryAnalysis(project()).findings.map(f => f.id);
    expect(ids.some(id => id.startsWith('finding-timeline-'))).toBe(true);
    expect(ids).toContain('finding-charfact-bible-eyes-mara');
  });

  it('keeps the writer’s answers across a rescan', () => {
    const first = project();
    first.findings = performStoryAnalysis(first).findings.map(f => (f.id.startsWith('finding-timeline-') ? { ...f, status: 'intentional' as const } : f));
    const again = performStoryAnalysis(first).findings.filter(f => f.id.startsWith('finding-timeline-'));
    expect(again.length).toBeGreaterThan(0);
    expect(again.every(f => f.status === 'intentional')).toBe(true);
  });
});
