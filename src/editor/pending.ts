import type { Project } from '../types';

// a last-chance copy of text the editor has not yet handed to the app, written when the page is leaving. the app picks it up the next
// time it starts, if it is newer than what was saved. this also covers a crash or a lost power supply a moment after typing.

const KEY = 'asterism_pending_text';
interface Note { html: string; at: number }

const read = (): Record<string, Note> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Note>; } catch { return {}; }
};

export function stashPending(projectId: string, chapterId: string, html: string): void {
  try {
    const all = read();
    all[`${projectId}:${chapterId}`] = { html, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* nothing more can be done as the page closes */ }
}

// takes any waiting notes (and clears them), putting back text that was never saved
export function applyPending(project: Project): Project {
  const all = read();
  try { localStorage.removeItem(KEY); } catch { /* it will be looked at again next time */ }
  let changed = false;
  const chapters = project.chapters.map(chapter => {
    const note = all[`${project.id}:${chapter.id}`];
    if (!note || typeof note.html !== 'string') return chapter;
    // text saved after the note was written is newer: leave it alone
    const savedAt = Date.parse(chapter.updatedAt);
    if (Number.isFinite(savedAt) && savedAt >= note.at) return chapter;
    if (note.html === chapter.content) return chapter;
    changed = true;
    return { ...chapter, content: note.html, wordCount: (note.html.replace(/<[^>]+>/g, ' ').match(/\S+/g) ?? []).length, updatedAt: new Date(note.at).toISOString() };
  });
  return changed ? { ...project, chapters } : project;
}
