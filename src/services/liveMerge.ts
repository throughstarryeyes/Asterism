import type { Chapter, DocumentComment, Project } from '../types';
import { mergeWithRemote } from './sync/engine';
import { applyChoices, type Choice } from './sync/merge';
import { countWordsFromHtml } from './storage';
import { getBase, setBase } from './sync/syncStore';

// rejoining a shared document later: the copy a guest holds, what the host's document holds now, and what both held when they last
// agreed are put together with the same three-way merge that sync uses. a change on one side is taken; a place both sides changed
// is merged word by word, and only where both rewrote the same words are both versions kept (the host's paragraph, then the guest's)
// so that nothing the guest wrote is lost. the copy's version history holds what it was before as well.

export interface SharedChapter { id: string; title: string; order: number; status: Chapter['status']; folder?: string; content: string }
export interface SessionShared { chapters: SharedChapter[]; comments: DocumentComment[] }

export interface LiveMerge {
  project: Project;
  // places where both sides had changed the same thing
  clashes: number;
  // of those, the ones where both versions of some text were kept
  kept: number;
  // where they were, in words
  places: string[];
}

// `base` is the copy as the last session left it. only the shared parts (chapters, comments) are brought in from the session, so
// everything private to the guest (story bible, goals, themes) is untouched.
export function mergeLive(base: Project, local: Project, shared: SessionShared): LiveMerge {
  const mine = new Map(local.chapters.map(c => [c.id, c]));
  const chapters: Chapter[] = shared.chapters.map(s => {
    const own = mine.get(s.id);
    // what is not shared text stays as this guest has it, so it never looks like a change from the session
    return {
      updatedAt: new Date().toISOString(), wordCount: 0, ...own,
      id: s.id, title: s.title, order: s.order, status: s.status, folder: s.folder, content: s.content,
      ...(own && own.content === s.content ? {} : { wordCount: countWordsFromHtml(s.content) }),
    };
  });
  const remote: Project = { ...local, chapters, comments: shared.comments };
  const { merged, conflicts } = mergeWithRemote(base, local, remote, { keepBoth: true });
  // where the host removed something the guest had changed, the guest keeps it; where both rewrote the same text, both stay; everywhere
  // else the session's version stands
  const choices: Record<string, Choice> = {};
  for (const c of conflicts) if (!c.kept) choices[c.key] = c.kind === 'removed' ? 'local' : 'remote';
  return {
    project: applyChoices(merged, conflicts, choices),
    clashes: conflicts.length,
    kept: conflicts.filter(c => c.kept).length,
    places: conflicts.map(c => c.label),
  };
}

// ---- what both sides last agreed on, kept for each shared document ----

const LINK = 'live-session';
export const saveLiveBase = (project: Project) => setBase(project.id, LINK, { revision: 0, project });
export const loadLiveBase = async (projectId: string): Promise<Project | undefined> => (await getBase(projectId, LINK).catch(() => undefined))?.project;
