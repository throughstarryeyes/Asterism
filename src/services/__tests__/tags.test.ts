import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MAX_TAGS, addTag, hasAllTags, normalizeTag, removeTag, renameTag, retag, suggestionsFor, tagCounts, withGenreAsTag } from '../tags';
import { storageService } from '../storage';
import { parseQuery, searchProject } from '../documentSearch';
import { DEFAULT_PROJECT } from '../../data/defaultProject';
import type { Project } from '../../types';

describe('custom tags', () => {
  it('cleans a tag, and keeps the first spelling when the same tag is added again', () => {
    expect(normalizeTag('  <cozy>   mystery ')).toBe('cozy mystery');
    expect(addTag(['Cozy Mystery'], 'cozy mystery')).toEqual(['Cozy Mystery']);
    expect(addTag([], '   ')).toEqual([]);
    expect(addTag(undefined, 'Horror')).toEqual(['Horror']);
  });

  it('stops at a sensible number of tags, and removes by any capitalization', () => {
    let tags: string[] = [];
    for (let i = 0; i < MAX_TAGS + 5; i++) tags = addTag(tags, `tag ${i}`);
    expect(tags).toHaveLength(MAX_TAGS);
    expect(removeTag(['Horror', 'Poetry'], 'horror')).toEqual(['Poetry']);
  });

  it('keeps a saved genre as a tag, once', () => {
    expect(withGenreAsTag({ genre: 'Fantasy', tags: [] })).toEqual({ genre: '', tags: ['Fantasy'] });
    expect(withGenreAsTag({ genre: 'fantasy', tags: ['Fantasy', 'Draft'] })).toEqual({ genre: '', tags: ['Fantasy', 'Draft'] });
    expect(withGenreAsTag({ genre: '  ', tags: undefined })).toEqual({ genre: '', tags: [] });
    expect(withGenreAsTag({ genre: '', tags: ['Poetry'] }).tags).toEqual(['Poetry']);
  });

  it('counts the tags in use, merging capitals, most used first', () => {
    const docs = [{ tags: ['Cozy', 'Draft'] }, { tags: ['cozy'] }, { tags: ['Cozy', 'Poetry'] }, {}];
    expect(tagCounts(docs)).toEqual([{ tag: 'Cozy', count: 3 }, { tag: 'Draft', count: 1 }, { tag: 'Poetry', count: 1 }]);
  });

  it('matches documents that have all of the chosen tags', () => {
    expect(hasAllTags({ tags: ['Cozy', 'Draft'] }, ['draft'])).toBe(true);
    expect(hasAllTags({ tags: ['Cozy'] }, ['cozy', 'draft'])).toBe(false);
    expect(hasAllTags({}, [])).toBe(true);
  });

  it('suggests the writer’s own tags first, then common ones, never one already there', () => {
    const out = suggestionsFor(['Cozy'], [{ tag: 'Cozy', count: 3 }, { tag: 'Cabin Fever', count: 1 }], 5);
    expect(out[0]).toBe('Cabin Fever');
    expect(out).not.toContain('Cozy');
    expect(out).toHaveLength(5);
  });

  it('can be searched on the home page', () => {
    const doc = { id: 'a', title: 'Salt', author: '', genre: '', synopsis: '', tags: ['Cabin Fever'], chapters: [{ id: 'c', title: 'One', order: 1, content: '<p>Nothing.</p>', status: 'draft', wordCount: 0, updatedAt: '' }], storyBible: { characters: [], locations: [], lore: [] } } as unknown as Project;
    expect(searchProject(doc, parseQuery('cabin'))).toMatchObject({ inDetailsOnly: true });
  });
});

describe('loading old documents', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } });
  });

  it('turns a saved genre into a tag, in the open document and in the library', () => {
    const old = { ...DEFAULT_PROJECT, id: 'mine', title: 'Mine', genre: 'Memoir & Personal', tags: undefined, folder: undefined };
    data.set('asterism_active_project', JSON.stringify(old));
    data.set('asterism_projects_library', JSON.stringify([old]));
    expect(storageService.loadProject()).toMatchObject({ genre: '', tags: ['Memoir & Personal'] });
    expect(storageService.loadProjectsList()[0]).toMatchObject({ genre: '', tags: ['Memoir & Personal'] });
  });

  it('starts a new document with the tags it was given, and no genre', () => {
    const made = storageService.createNewProject('Salt', '', [' Cozy ', 'cozy', 'Draft'], '', undefined);
    expect(made.tags).toEqual(['Cozy', 'Draft']);
    expect(made.genre).toBe('');
  });
});

describe('renaming, merging and deleting a tag everywhere', () => {
  const docs = [{ id: 'a', tags: ['Cozy', 'Draft'] }, { id: 'b', tags: ['cozy'] }, { id: 'c', tags: ['Poetry'] }, { id: 'd', tags: ['Cozy', 'Cosy'] }];

  it('renames a tag in one list, whatever its capitals', () => {
    expect(renameTag(['Cozy', 'Draft'], 'cozy', 'Cozy mystery')).toEqual(['Cozy mystery', 'Draft']);
    expect(renameTag(['Draft'], 'cozy', 'x')).toEqual(['Draft']);
    expect(renameTag(['Cozy'], 'Cozy', '   ')).toEqual(['Cozy']);
  });

  it('merges when the new name is a tag the document already has', () => {
    expect(renameTag(['Cozy', 'Cosy'], 'Cosy', 'cozy')).toEqual(['Cozy']);
  });

  it('lists only the documents that change', () => {
    expect(retag(docs, 'cozy', 'Cozy mystery')).toEqual([
      { id: 'a', tags: ['Cozy mystery', 'Draft'] },
      { id: 'b', tags: ['Cozy mystery'] },
      { id: 'd', tags: ['Cozy mystery', 'Cosy'] },
    ]);
    expect(retag(docs, 'Cosy', 'Cozy')).toEqual([{ id: 'd', tags: ['Cozy'] }]);
    expect(retag(docs, 'nothing', 'x')).toEqual([]);
  });

  it('deletes a tag from every document that has it', () => {
    expect(retag(docs, 'Cozy', '')).toEqual([
      { id: 'a', tags: ['Draft'] },
      { id: 'b', tags: [] },
      { id: 'd', tags: ['Cosy'] },
    ]);
  });
});
