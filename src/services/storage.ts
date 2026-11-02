import { saveHistory, setWithRoom } from './storageRoom';
import { saveBlob } from './saveFile';
import type { Project, UserStats, Chapter, DocumentVersion, ToolKind } from '../types';
import { DEFAULT_PROJECT, DEFAULT_USER_STATS } from '../data/defaultProject';
import { addTag, withGenreAsTag } from './tags';
import { templateChapters } from './templates';
import { sanitizeStory, starterStory } from './branching';
import { newSheet } from './sheets';

const STORAGE_PROJECT_KEY = 'asterism_active_project';
const STORAGE_STATS_KEY = 'asterism_user_stats';

const STORAGE_PROJECTS_LIST_KEY = 'asterism_projects_library';

// the sample project fills gaps in a saved one, but its folder, subtitle and tags belong to the sample
// a cleared folder is not saved at all, so it must not come back from here
const SAMPLE_FILL: Project = {
  ...DEFAULT_PROJECT,
  title: 'untitled document', author: '', synopsis: '', chapters: [], folder: undefined, subtitle: undefined, tags: undefined,
  storyBible: { characters: [], locations: [], lore: [] },
  reflections: [], plotThreads: [], goals: [], comments: [], findings: [],
  mindMap: { id: 'mm-blank', title: 'Story Map', nodes: [], edges: [] },
  memoryVault: { ...DEFAULT_PROJECT.memoryVault, establishedFacts: [], authorStyleRules: [] },
};

// documents used to list their mind map and story; now the mind map or story says what it belongs to
type WithOldLinks = Project & { attached?: Record<string, string | undefined> };

function moveAttachments(list: WithOldLinks[]): Project[] {
  if (!list.some(p => p.attached)) return list;
  const owner = new Map<string, string>();
  list.forEach(p => Object.values(p.attached ?? {}).forEach(id => { if (id) owner.set(id, p.id); }));
  return list.map(p => {
    const next = { ...p };
    delete next.attached;
    return owner.has(p.id) && !p.attachedTo ? { ...next, attachedTo: owner.get(p.id) } : next;
  });
}

export const storageService = {
  loadProjectsList(): Project[] {
    try {
      const data = localStorage.getItem(STORAGE_PROJECTS_LIST_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return moveAttachments(parsed.map(p => withGenreAsTag({
            ...SAMPLE_FILL,
            ...p,
            draftMode: p.draftMode ?? (Array.isArray(p.chapters) && p.chapters.length === 1 ? 'open_draft' : undefined),
            storyBible: { ...SAMPLE_FILL.storyBible, ...(p.storyBible || {}) },
            reflections: Array.isArray(p.reflections) ? p.reflections : [],
            plotThreads: Array.isArray(p.plotThreads) ? p.plotThreads : [],
            goals: Array.isArray(p.goals) ? p.goals : [],
            comments: Array.isArray(p.comments) ? p.comments : [],
            mindMap: p.mindMap && Array.isArray(p.mindMap.nodes) ? p.mindMap : { id: `mm-${p.id}`, title: 'Story Map', nodes: [], edges: [] },
            findings: Array.isArray(p.findings) ? p.findings : [],
            memoryVault: p.memoryVault ? p.memoryVault : SAMPLE_FILL.memoryVault,
            branching: sanitizeStory(p.branching) ?? undefined
          })));
        }
      }
    } catch (e) {
      console.warn('Failed to load projects list, using default', e);
    }
    return [DEFAULT_PROJECT];
  },

  saveProjectsList(projects: Project[]): void {
    try {
      if (!setWithRoom(STORAGE_PROJECTS_LIST_KEY, JSON.stringify(projects))) console.error('Failed to save projects library: the browser storage is full');
    } catch (e) {
      console.error('Failed to save projects library', e);
    }
  },

  createNewProject(title?: string, author?: string, tags?: string[], synopsis?: string, folder?: string, draftMode?: Project['draftMode'], templateId?: string): Project {
    const id = `proj-${Date.now()}`;
    const cleanTitle = (title && title.trim()) ? title.trim() : 'untitled document';
    const cleanAuthor = (author && author.trim() && author !== 'Your Name (Or leave blank)') ? author.trim() : '';
    const cleanTags = (tags ?? []).reduce<string[]>((all, t) => addTag(all, t), []);
    const cleanSynopsis = synopsis ? synopsis.trim() : '';
    const cleanFolder = (folder && folder.trim()) ? folder.trim() : undefined;

    // a template only shapes a chaptered document
    const fromTemplate = draftMode === 'open_draft' ? [] : templateChapters(templateId);

    const newProj: Project = {
      id,
      title: cleanTitle,
      subtitle: '',
      author: cleanAuthor,
      genre: '',
      tags: cleanTags,
      synopsis: cleanSynopsis,
      folder: cleanFolder,
      // an open draft is one flowing text, so its single page takes the document's name instead of "Chapter 1"
      draftMode: draftMode ?? 'chaptered',
      chapters: fromTemplate.length ? fromTemplate : [
        {
          id: `chap-${Date.now()}-1`,
          title: draftMode === 'open_draft' ? cleanTitle : 'Chapter 1',
          order: 1,
          wordCount: 0,
          status: 'draft',
          content: '<p><br></p>',
          updatedAt: new Date().toISOString()
        }
      ],
      storyBible: {
        characters: [],
        locations: [],
        lore: []
      },
      plotThreads: [],
      reflections: [],
      goals: [
        {
          id: `goal-${Date.now()}-1`,
          title: 'Draft First Scene',
          type: 'words',
          target: 500,
          current: 0,
          unit: 'words',
          pointsReward: 30,
          completed: false
        }
      ],
      comments: [],
      mindMap: {
        id: `mm-${id}`,
        title: 'Story Mind Map',
        nodes: [],
        edges: []
      },
      findings: [],
      memoryVault: {
        establishedFacts: [],
        authorStyleRules: [],
        analysisPreferences: {
          sensitivity: 'balanced',
          ignoreResolvedThreads: false
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return newProj;
  },

  // a mind map or branching story as its own library document
  createToolDoc(kind: ToolKind, folder?: string): Project {
    const names: Record<ToolKind, string> = { mindmap: 'untitled mind map', branching: 'untitled branching story', character: 'untitled character', scene: 'untitled scene', cards: 'untitled cards' };
    const base = this.createNewProject(names[kind], '', [], '', folder);
    return {
      ...base,
      kind,
      sheet: kind === 'character' || kind === 'scene' ? newSheet(kind) : undefined,
      mindMap: { id: `mm-${base.id}`, title: 'Story Map', nodes: [], edges: [] },
      branching: kind === 'branching' ? starterStory('untitled branching story') : undefined,
      goals: []
    };
  },

  loadProject(): Project {
    try {
      const data = localStorage.getItem(STORAGE_PROJECT_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.chapters) && parsed.chapters.length > 0 && parsed.storyBible) {
          return withGenreAsTag({
            ...SAMPLE_FILL,
            ...parsed,
            draftMode: parsed.draftMode ?? (parsed.chapters.length === 1 ? 'open_draft' : undefined),
            storyBible: { ...SAMPLE_FILL.storyBible, ...parsed.storyBible },
            reflections: Array.isArray(parsed.reflections) ? parsed.reflections : SAMPLE_FILL.reflections,
            plotThreads: Array.isArray(parsed.plotThreads) ? parsed.plotThreads : SAMPLE_FILL.plotThreads,
            goals: Array.isArray(parsed.goals) ? parsed.goals : SAMPLE_FILL.goals,
            comments: Array.isArray(parsed.comments) ? parsed.comments : SAMPLE_FILL.comments,
            mindMap: parsed.mindMap && Array.isArray(parsed.mindMap.nodes) ? parsed.mindMap : SAMPLE_FILL.mindMap,
            findings: Array.isArray(parsed.findings) ? parsed.findings : SAMPLE_FILL.findings,
            memoryVault: parsed.memoryVault ? parsed.memoryVault : SAMPLE_FILL.memoryVault,
            branching: sanitizeStory(parsed.branching) ?? undefined
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load project from storage, using default', e);
    }
    return DEFAULT_PROJECT;
  },

  saveProject(project: Project): void {
    try {
      if (!project || !Array.isArray(project.chapters)) return;
      // recalculate word counts
      const updatedChapters = project.chapters.map(ch => ({
        ...ch,
        wordCount: countWordsFromHtml(ch.content)
      }));
      const updatedProject: Project = {
        ...project,
        chapters: updatedChapters,
        updatedAt: new Date().toISOString()
      };
      if (!setWithRoom(STORAGE_PROJECT_KEY, JSON.stringify(updatedProject))) console.error('Failed to save the project: the browser storage is full');
    } catch (e) {
      console.error('Failed to save project to storage', e);
    }
  },

  // true until the first save, so a brand new install can be welcomed once
  isFirstOpen(): boolean {
    try { return localStorage.getItem(STORAGE_STATS_KEY) === null; } catch { return false; }
  },

  loadUserStats(): UserStats {
    try {
      const data = localStorage.getItem(STORAGE_STATS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_USER_STATS, ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load user stats from storage, using default', e);
    }
    return DEFAULT_USER_STATS;
  },

  saveUserStats(stats: UserStats): void {
    try {
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save user stats', e);
    }
  },

  exportProjectAsJson(project: Project, embeddedFonts: unknown[] = []): void {
    // uploaded fonts travel inside the backup so they come back when it is restored.
    const payload = embeddedFonts.length ? { ...project, embeddedFonts } : project;
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    void saveBlob(`${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_backup.asterism.json`, blob);
  },

  downloadTextFile(fileName: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    void saveBlob(fileName, blob);
  },

  downloadBytes(fileName: string, bytes: Uint8Array, mime: string): void {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    void saveBlob(fileName, blob);
  },

  exportChapterAsMarkdown(chapter: Chapter, projectTitle: string): void {
    const markdown = htmlToMarkdown(chapter.content);
    const header = `# ${chapter.title}\n*From: ${projectTitle}*\n*Word Count: ${chapter.wordCount} words*\n\n---\n\n`;
    const fullText = header + markdown;
    const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
    void saveBlob(`${chapter.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`, blob);
  },

  exportManuscriptAsMarkdown(project: Project): void {
    let output = `# ${project.title}\n`;
    if (project.subtitle) output += `### ${project.subtitle}\n`;
    output += `**By ${project.author}**\n\n`;
    if (project.synopsis) output += `> ${project.synopsis}\n\n`;
    output += `---\n\n`;

    project.chapters
      .sort((a, b) => a.order - b.order)
      .forEach(chap => {
        output += `\n\n# ${chap.title}\n\n`;
        output += htmlToMarkdown(chap.content);
        output += `\n\n* * *\n`;
      });

    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' });
    void saveBlob(`${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_manuscript.md`, blob);
  },

  getVersionsStorageKey(projectId: string): string {
    return `asterism_versions_${projectId}`;
  },

  loadProjectVersions(projectId: string): DocumentVersion[] {
    try {
      const data = localStorage.getItem(this.getVersionsStorageKey(projectId));
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load project versions', e);
    }
    return [];
  },

  saveProjectVersions(projectId: string, versions: DocumentVersion[]): void {
    try {
      saveHistory(this.getVersionsStorageKey(projectId), versions);
    } catch (e) {
      console.error('Failed to save project versions', e);
    }
  },

  createVersionSnapshot(
    project: Project,
    title?: string,
    trigger: 'manual' | 'periodic' | 'safety_net' | 'milestone' = 'periodic',
    description?: string
  ): DocumentVersion {
    const totalWords = project.chapters.reduce((sum, ch) => sum + (ch.wordCount || countWordsFromHtml(ch.content)), 0);
    const date = new Date();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const defaultTitle = 
      trigger === 'manual' ? `Named Version (${timeStr})` :
      trigger === 'safety_net' ? `Safety Snapshot Before Deletion (${timeStr})` :
      trigger === 'milestone' ? `Milestone Snapshot (${timeStr})` :
      `Auto-Snapshot (${timeStr} • ${totalWords} words)`;

    const version: DocumentVersion = {
      id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId: project.id,
      title: title && title.trim() ? title.trim() : defaultTitle,
      createdAt: date.toISOString(),
      wordCount: totalWords,
      chapterCount: project.chapters.length,
      trigger,
      description,
      chapters: project.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        order: ch.order,
        content: ch.content,
        wordCount: ch.wordCount || countWordsFromHtml(ch.content)
      }))
    };

    const existing = this.loadProjectVersions(project.id);
    const combined = [version, ...existing.filter(v => v.id !== version.id)];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // prune combined to at most 50 total versions
    const finalVersions = combined.slice(0, 50);

    this.saveProjectVersions(project.id, finalVersions);
    return version;
  },

  deleteVersion(projectId: string, versionId: string): void {
    const existing = this.loadProjectVersions(projectId);
    const filtered = existing.filter(v => v.id !== versionId);
    this.saveProjectVersions(projectId, filtered);
  },

  renameVersion(projectId: string, versionId: string, newTitle: string): void {
    const existing = this.loadProjectVersions(projectId);
    const updated = existing.map(v => v.id === versionId ? { ...v, title: newTitle.trim() } : v);
    this.saveProjectVersions(projectId, updated);
  }
};

export function countWordsFromHtml(html: string): number {
  if (!html) return 0;
  // strip tags and decode basic entities
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const text = temp.textContent || temp.innerText || '';
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;

  let text = '';
  div.childNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'h1') text += `\n# ${el.textContent}\n\n`;
      else if (tag === 'h2') text += `\n## ${el.textContent}\n\n`;
      else if (tag === 'h3') text += `\n### ${el.textContent}\n\n`;
      else if (tag === 'p') text += `${el.innerHTML.replace(/<strong>(.*?)<\/strong>/g, '**$1**').replace(/<em>(.*?)<\/em>/g, '*$1*')}\n\n`;
      else if (tag === 'blockquote') text += `> ${el.textContent}\n\n`;
      else if (tag === 'ul') {
        el.querySelectorAll('li').forEach(li => {
          text += `- ${li.textContent}\n`;
        });
        text += '\n';
      } else if (tag === 'ol') {
        el.querySelectorAll('li').forEach((li, idx) => {
          text += `${idx + 1}. ${li.textContent}\n`;
        });
        text += '\n';
      } else {
        text += `${el.textContent}\n\n`;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    }
  });

  return text.trim();
}
