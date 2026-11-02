/// <reference types="node" />
import { describe, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildStoryContext, extractNarrativeUnits, toCoachUnits } from '../storyAnalyzer';
import { buildEntityIndex, splitSentences } from '../coach/entities';
import nlp from 'compromise';
import { detectSignals, summarizeSignals } from '../coach/signals';
import { listSentences } from '../coach/teach';
import { findOpenQuestions, promiseBoard, relationshipWeather, unseenScenes, yourTells } from '../coach/features';
import { getDefaultKnowledge } from '../coach/knowledge';
import type { Project } from '../../types';

// times each step the coach runs when it opens, on a real manuscript
// usage: ASTERISM_MANUSCRIPT=path/to/backup.json npx vitest run coachSpeed.local

const path = process.env.ASTERISM_MANUSCRIPT;
vi.stubGlobal('document', { createElement: () => ({ innerHTML: '', get textContent() { return this.innerHTML.replace(/<[^>]+>/g, ' '); } }) });

const lines: string[] = [];
const time = <T,>(label: string, fn: () => T): T => {
  const start = performance.now();
  const out = fn();
  lines.push(`${label.padEnd(28)} ${Math.round(performance.now() - start)} ms`);
  return out;
};

describe.skipIf(!path)('coach speed', () => {
  it('times every step', () => {
    const raw = JSON.parse(readFileSync(path!, 'utf8')) as Project;
    const project = (raw as unknown as { project?: Project }).project ?? raw;
    const knowledge = getDefaultKnowledge();
    const parts = time('  split into scenes', () => extractNarrativeUnits(project));
    const flat = toCoachUnits(parts);
    const sentenceList = time('  split into sentences', () => flat.flatMap(u => splitSentences(u.plainText)));
    lines.push('  sentences: ' + sentenceList.length);
    time('  tag every sentence (nlp)', () => sentenceList.forEach(x => nlp(x).people().out('array')));
    time('  build the cast', () => buildEntityIndex(flat, []));
    const { coachUnits: units, index } = time('read the story (total)', () => buildStoryContext(project));
    const signals = time('detect feelings', () => detectSignals(units, index, undefined, knowledge));
    time('summarize feelings', () => summarizeSignals(signals));
    time('list sentences', () => listSentences(units, index.entities.flatMap(e => [e.canonical, ...e.aliases])));
    time('open questions', () => findOpenQuestions(units, index));
    time('unseen scenes', () => unseenScenes(units, undefined, knowledge));
    time('promise board', () => promiseBoard(units, index, undefined as never, knowledge));
    time('relationship weather', () => relationshipWeather(units, index, knowledge));
    time('your tells', () => yourTells(units, index));
    writeFileSync(process.env.ASTERISM_REPORT ?? 'coach-speed.txt', lines.join('\n'));
  }, 120_000);
});
