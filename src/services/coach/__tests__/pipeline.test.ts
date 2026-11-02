import { describe, it, expect } from 'vitest';
import { DEFAULT_PROJECT } from '../../../data/defaultProject';
import { buildEntityIndex, findEntityGaps, type CoachUnit } from '../entities';
import { detectSignals, summarizeSignals } from '../signals';
import { emptyCoachMemory } from '../types';
import {
  actingStrange, echoPrompts, findOpenQuestions, nextSceneIdeas, promiseBoard, relationshipWeather,
  resurfaceQuestions, unseenScenes, weatherNudges, yourTells,
} from '../features';

// the analyzer service strips HTML with the DOM; here we strip it by hand.
const strip = (html: string) => html.replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');

describe('full coach pipeline on the bundled sample project', () => {
  const units: CoachUnit[] = [...DEFAULT_PROJECT.chapters]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ id: c.id, index: i, title: c.title, chapterId: c.id, plainText: strip(c.content) }));
  const known = DEFAULT_PROJECT.storyBible.characters.map(c => ({ name: c.name, aliases: c.aliases }));
  const index = buildEntityIndex(units, known);
  const memory = emptyCoachMemory(DEFAULT_PROJECT.id);

  it('runs every feature without throwing and returns well-formed results', () => {
    const signals = detectSignals(units, index, memory);
    const board = promiseBoard(units, index, memory);
    const gaps = findEntityGaps(index);
    const unseen = unseenScenes(units, memory);
    const nudges = [
      ...resurfaceQuestions(findOpenQuestions(units, index), units, index, units.length - 1, memory),
      ...echoPrompts(units, index, memory),
      ...actingStrange(signals, index, memory),
      ...weatherNudges(relationshipWeather(units, index), memory),
      ...unseen,
    ];
    expect(units.length).toBeGreaterThan(0);
    expect(summarizeSignals(signals).every(s => s.count > 0)).toBe(true);
    expect(yourTells(units, index).stats.sentences).toBeGreaterThan(0);
    expect(nextSceneIdeas(board, gaps, unseen).length).toBeGreaterThan(0);
    // every nudge has what the panel needs to render and to dismiss it.
    nudges.forEach(n => {
      expect(n.id).toBeTruthy();
      expect(n.title).toBeTruthy();
      expect(n.body).toBeTruthy();
    });
    expect(new Set(nudges.map(n => n.id)).size).toBe(nudges.length);
  });

  it('recognizes the Story Bible characters', () => {
    expect(known.length).toBeGreaterThan(0);
    expect(index.entities.filter(e => e.confirmed).length).toBe(known.length);
  });
});
