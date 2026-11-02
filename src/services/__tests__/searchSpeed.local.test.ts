/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseQuery, previewOf, searchProject } from '../documentSearch';
import type { Project } from '../../types';

// times the home page search on a real manuscript
// usage: ASTERISM_MANUSCRIPT=path/to/backup.json npx vitest run searchSpeed.local

const path = process.env.ASTERISM_MANUSCRIPT;

describe.skipIf(!path)('searching a real manuscript', () => {
  it('is quick, and finds what is there', () => {
    const raw = JSON.parse(readFileSync(path!, 'utf8')) as Project;
    const project = (raw as unknown as { project?: Project }).project ?? raw;
    const lines: string[] = [];
    let t = performance.now();
    lines.push(`preview: ${previewOf(project)}`);
    lines.push(`preview ms ${Math.round(performance.now() - t)}`);
    t = performance.now();
    const first = searchProject(project, parseQuery('tequila'));
    lines.push(`first search (reads the text) ms ${Math.round(performance.now() - t)}`);
    t = performance.now();
    for (const q of ['bottle', 'val cass', '"I promise"', 'zzzz']) {
      const hit = searchProject(project, parseQuery(q));
      lines.push(`${q.padEnd(12)} -> ${hit ? `${hit.count} matches` : 'none'}; ${hit?.snippets[0]?.map(s => (s.hit ? `[${s.text}]` : s.text)).join('') ?? ''}`);
    }
    lines.push(`four more searches ms ${Math.round(performance.now() - t)}`);
    writeFileSync(process.env.ASTERISM_REPORT ?? 'search-speed.txt', lines.join('\n'));
    expect(first).not.toBeNull();
  }, 60_000);
});
