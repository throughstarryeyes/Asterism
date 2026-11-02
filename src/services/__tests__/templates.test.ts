import { describe, it, expect } from 'vitest';
import { TEMPLATES, templateChapters } from '../templates';

describe('document templates', () => {
  it('blank and unknown templates add no chapters', () => {
    expect(templateChapters('blank')).toEqual([]);
    expect(templateChapters('nope')).toEqual([]);
    expect(templateChapters(undefined)).toEqual([]);
  });

  it('every template has a name, a blurb, and unique ids', () => {
    expect(new Set(TEMPLATES.map(t => t.id)).size).toBe(TEMPLATES.length);
    TEMPLATES.forEach(t => { expect(t.name && t.blurb).toBeTruthy(); });
  });

  it('builds ordered chapters with unique ids and act folders', () => {
    const chapters = templateChapters('three-act', 1000);
    expect(chapters.map(c => c.order)).toEqual(chapters.map((_, i) => i + 1));
    expect(new Set(chapters.map(c => c.id)).size).toBe(chapters.length);
    expect(new Set(chapters.map(c => c.folder))).toEqual(new Set(['Act 1: Setup', 'Act 2: Confrontation', 'Act 3: Resolution']));
    expect(chapters.every(c => c.wordCount === 0 && c.status === 'draft')).toBe(true);
  });
});

describe('new documents from a template', () => {
  it('uses the template chapters, but never for an open draft', async () => {
    const { storageService } = await import('../storage');
    const withTemplate = storageService.createNewProject('Book', '', [], '', undefined, 'chaptered', 'short-story');
    expect(withTemplate.chapters.map(c => c.title)).toEqual(['Beginning', 'Middle', 'Ending']);
    const open = storageService.createNewProject('Book', '', [], '', undefined, 'open_draft', 'short-story');
    expect(open.chapters).toHaveLength(1);
    const blank = storageService.createNewProject('Book');
    expect(blank.chapters.map(c => c.title)).toEqual(['Chapter 1']);
  });
});
