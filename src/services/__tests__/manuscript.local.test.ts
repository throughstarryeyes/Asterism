/// <reference types="node" />
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildStoryContext, performStoryAnalysis } from '../storyAnalyzer';
import { parseManuscriptContent } from '../manuscriptImporter';
import { checkLabel, checkOf } from '../analyzerFeedback';
import type { Project } from '../../types';

// runs the analyzer on a real manuscript and writes a report, so false alarms can be spotted
// usage: ASTERISM_MANUSCRIPT=path/to/file npx vitest run manuscript.local
// the file is an Asterism project backup (.json) or plain text (.txt, .md); ASTERISM_REPORT sets the report path

const path = process.env.ASTERISM_MANUSCRIPT;

// the importer counts words with the page's DOM; this stands in for it outside a browser
vi.stubGlobal('document', { createElement: () => ({ innerHTML: '', get textContent() { return this.innerHTML.replace(/<[^>]+>/g, ' '); } }) });

function load(file: string): Project {
  const text = readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.json')) {
    const raw = JSON.parse(text) as { project?: Project } & Project;
    return (raw.project ?? raw) as Project;
  }
  const imported = parseManuscriptContent(text, file);
  return {
    id: 'local', title: imported.title, author: '', genre: '', synopsis: '', draftMode: imported.draftMode,
    chapters: imported.chapters, storyBible: { characters: [], locations: [], lore: [] }, plotThreads: [], reflections: [], goals: [],
    comments: [], findings: [], timeline: [],
    memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false } },
  } as unknown as Project;
}

describe.skipIf(!path)('a real manuscript', () => {
  it('scans without trouble and writes a report', () => {
    const project = load(path!);
    const words = project.chapters.reduce((sum, c) => sum + (c.content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length, 0);

    let started = performance.now();
    const context = buildStoryContext(project);
    const readMs = Math.round(performance.now() - started);
    started = performance.now();
    const result = performStoryAnalysis({ ...project, findings: [] });
    const scanMs = Math.round(performance.now() - started);

    const byCheck = new Map<string, number>();
    result.findings.forEach(f => byCheck.set(checkOf(f).check, (byCheck.get(checkOf(f).check) ?? 0) + 1));

    const lines: string[] = [
      `${project.title}: ${project.chapters.length} chapter(s), ${words} words, ${context.units.length} scenes (${project.draftMode ?? 'chaptered'})`,
      `reading the story: ${readMs} ms; full scan: ${scanMs} ms`,
      `findings: ${result.findings.length}`,
      ...[...byCheck.entries()].sort((a, b) => b[1] - a[1]).map(([check, n]) => `  ${n}  ${checkLabel(check)}`),
      '',
      `the cast I found (${context.index.entities.length}):`,
      ...context.index.entities.slice().sort((a, b) => b.mentions.length - a.mentions.length).slice(0, 40)
        .map(e => `  ${e.mentions.length}\t${e.canonical}${e.aliases.length ? `  (also: ${e.aliases.slice(0, 4).join(', ')})` : ''}${e.confirmed ? '' : '  [guessed]'}`),
      '',
      'findings:',
      ...result.findings.map(f => `- [${checkOf(f).check} · ${f.confidence}] ${f.title}\n    ${f.summary}\n    ${f.evidencePassages.map(e => `“${e.quote}” (${e.chapterTitle})`).join('\n    ')}`),
    ];
    const out = process.env.ASTERISM_REPORT ?? 'manuscript-report.txt';
    writeFileSync(out, lines.join('\n'));
    console.log(lines.slice(0, 12).join('\n'));
    expect(result.findings.length).toBeGreaterThanOrEqual(0);
    expect(scanMs).toBeLessThan(60_000);
  }, 180_000);
});
