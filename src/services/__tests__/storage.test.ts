import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService } from '../storage';
import { DEFAULT_PROJECT } from '../../data/defaultProject';
import type { Project } from '../../types';

// a browser's localStorage, for loading what a project was saved as
function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  });
  return data;
}

const mine = (over: Partial<Project> = {}): Project => ({ ...DEFAULT_PROJECT, id: 'mine', title: 'My Book', subtitle: undefined, folder: undefined, ...over });
// what is on disk: JSON leaves out anything that was cleared
const onDisk = (p: Project) => JSON.stringify(p);

describe('loading saved projects', () => {
  let data: Map<string, string>;
  beforeEach(() => { data = stubStorage(); });

  it('keeps a project out of a folder once it was taken out, after a reload', () => {
    data.set('asterism_active_project', onDisk(mine()));
    data.set('asterism_projects_library', onDisk(mine()).replace(/^/, '[').concat(']'));
    expect(storageService.loadProject().folder).toBeUndefined();
    expect(storageService.loadProjectsList()[0].folder).toBeUndefined();
  });

  it('does not hand the sample project’s subtitle to a project that has none', () => {
    data.set('asterism_active_project', onDisk(mine()));
    expect(storageService.loadProject().subtitle).toBeUndefined();
  });

  it('keeps the folder a project really has', () => {
    data.set('asterism_active_project', onDisk(mine({ folder: 'Short Stories' })));
    data.set('asterism_projects_library', `[${onDisk(mine({ folder: 'Short Stories' }))}]`);
    expect(storageService.loadProject().folder).toBe('Short Stories');
    expect(storageService.loadProjectsList()[0].folder).toBe('Short Stories');
  });

  it('still fills in the parts a saved project is missing', () => {
    const { findings: _f, comments: _c, ...partial } = mine();
    void _f; void _c;
    data.set('asterism_active_project', JSON.stringify(partial));
    const loaded = storageService.loadProject();
    expect(Array.isArray(loaded.findings)).toBe(true);
    expect(Array.isArray(loaded.comments)).toBe(true);
  });

  it('shows the sample project in its own folder when nothing is saved', () => {
    expect(storageService.loadProject().folder).toBe(DEFAULT_PROJECT.folder);
  });
});

describe('starting a document', () => {
  it('names the page of an open draft after the document, not "Chapter 1"', () => {
    const open = storageService.createNewProject('Salt and Ink', '', [], '', undefined, 'open_draft');
    expect(open.draftMode).toBe('open_draft');
    expect(open.chapters).toHaveLength(1);
    expect(open.chapters[0].title).toBe('Salt and Ink');
  });

  it('keeps Chapter 1 for a chaptered document', () => {
    const plain = storageService.createNewProject('Salt and Ink');
    expect(plain.draftMode).toBe('chaptered');
    expect(plain.chapters[0].title).toBe('Chapter 1');
  });
});

describe('how a saved document opens', () => {
  let data: Map<string, string>;
  beforeEach(() => { data = stubStorage(); });

  const second = { ...DEFAULT_PROJECT.chapters[0], id: 'second', order: 2 };

  it('opens a document with one chapter as an open draft', () => {
    data.set('asterism_active_project', onDisk(mine({ draftMode: undefined, chapters: [DEFAULT_PROJECT.chapters[0]] })));
    data.set('asterism_projects_library', `[${onDisk(mine({ draftMode: undefined, chapters: [DEFAULT_PROJECT.chapters[0]] }))}]`);
    expect(storageService.loadProject().draftMode).toBe('open_draft');
    expect(storageService.loadProjectsList()[0].draftMode).toBe('open_draft');
  });

  it('leaves a document with several chapters, or a mode the writer chose, alone', () => {
    data.set('asterism_active_project', onDisk(mine({ draftMode: undefined, chapters: [DEFAULT_PROJECT.chapters[0], second] })));
    expect(storageService.loadProject().draftMode).toBeUndefined();
    data.set('asterism_active_project', onDisk(mine({ draftMode: 'chaptered', chapters: [DEFAULT_PROJECT.chapters[0]] })));
    expect(storageService.loadProject().draftMode).toBe('chaptered');
  });
});
