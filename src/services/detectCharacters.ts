import type { Project } from '../types';
import { buildStoryContext } from './storyAnalyzer';

export interface DetectedCharacter {
  name: string;
  aliases: string[];
  mentions: number;
  scenes: number;
  firstScene: string;
  sample: string;
}

// people the writing talks about that have no story bible card yet.
// a name has to come back in a few places before it is offered, so one-off names stay out of the list.
export function detectCharacters(project: Project, minMentions = 3): DetectedCharacter[] {
  const { index } = buildStoryContext(project);
  return index.entities
    .filter(e => !e.confirmed && e.mentions.length >= minMentions)
    .map(e => ({
      name: e.canonical,
      aliases: e.aliases,
      mentions: e.mentions.length,
      scenes: new Set(e.mentions.map(m => m.unitIndex)).size,
      firstScene: e.mentions[0]?.unitTitle ?? '',
      sample: e.mentions[0]?.sentence ?? '',
    }))
    .sort((a, b) => b.mentions - a.mentions);
}
