import type { Chapter, LoreEntry, Project } from '../../types';
import type { GameId, SavedPlay } from './types';
import { insertSceneAsChapter } from './missingScene';
import { textToHtml, uid } from './rng';

// how a game's result becomes part of a document. each returns only the fields of the document that change,
// so it can go straight to updateAnyProject.

export const MAX_SAVED = 200;

export function withSavedNote(doc: Pick<Project, 'play'>, game: GameId, title: string, text: string, now = new Date()): Pick<Project, 'play'> {
  const note: SavedPlay = { id: uid('keep'), game, title: title.trim() || 'Saved from Play', text, at: now.toISOString() };
  return { play: { ...doc.play, saved: [...(doc.play?.saved ?? []), note].slice(-MAX_SAVED) } };
}

export function withoutSavedNote(doc: Pick<Project, 'play'>, id: string): Pick<Project, 'play'> {
  return { play: { ...doc.play, saved: (doc.play?.saved ?? []).filter(n => n.id !== id) } };
}

// plain text added as a new chapter at the end of the document
export function withChapterAtEnd(doc: Pick<Project, 'chapters'>, title: string, text: string, now = new Date()): Pick<Project, 'chapters'> {
  return { chapters: insertSceneAsChapter(doc.chapters, { id: uid('scene'), title: title.trim() || 'From Play', html: textToHtml(text), createdAt: now.toISOString() }, now) as Chapter[] };
}

// a note in the story bible's lore, which is where free-form notes already live
export function withLoreNote(doc: Pick<Project, 'storyBible'>, title: string, content: string, id = uid('lore')): Pick<Project, 'storyBible'> {
  const entry: LoreEntry = { id, title, category: 'custom', content };
  const lore = doc.storyBible.lore.some(l => l.id === id) ? doc.storyBible.lore.map(l => (l.id === id ? entry : l)) : [...doc.storyBible.lore, entry];
  return { storyBible: { ...doc.storyBible, lore } };
}
