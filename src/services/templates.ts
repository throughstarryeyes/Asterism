// starting layouts for a new chaptered document
import type { Chapter } from '../types';

export interface DocTemplate {
  id: string;
  name: string;
  blurb: string;
  // chapter titles, optionally grouped under an act/section folder
  chapters: Array<{ title: string; folder?: string }>;
}

export const BLANK_TEMPLATE = 'blank';

export const TEMPLATES: DocTemplate[] = [
  { id: BLANK_TEMPLATE, name: 'Blank', blurb: 'One empty chapter.', chapters: [] },
  {
    id: 'three-act',
    name: 'Three acts',
    blurb: 'Setup, confrontation, resolution.',
    chapters: [
      { title: 'Opening image', folder: 'Act 1: Setup' },
      { title: 'The inciting incident', folder: 'Act 1: Setup' },
      { title: 'Crossing the threshold', folder: 'Act 1: Setup' },
      { title: 'Rising trouble', folder: 'Act 2: Confrontation' },
      { title: 'Midpoint', folder: 'Act 2: Confrontation' },
      { title: 'Everything falls apart', folder: 'Act 2: Confrontation' },
      { title: 'The climax', folder: 'Act 3: Resolution' },
      { title: 'Closing image', folder: 'Act 3: Resolution' },
    ],
  },
  {
    id: 'short-story',
    name: 'Short story',
    blurb: 'Beginning, middle, end.',
    chapters: [{ title: 'Beginning' }, { title: 'Middle' }, { title: 'Ending' }],
  },
  {
    id: 'essay',
    name: 'Essay or article',
    blurb: 'Intro, body, conclusion.',
    chapters: [{ title: 'Introduction' }, { title: 'Body' }, { title: 'Conclusion' }],
  },
];

export const templateById = (id?: string) => TEMPLATES.find(t => t.id === id);

// the chapters a template starts with, or none for blank/unknown ones
export function templateChapters(id: string | undefined, stamp = Date.now()): Chapter[] {
  const template = templateById(id);
  if (!template || template.chapters.length === 0) return [];
  const now = new Date(stamp).toISOString();
  return template.chapters.map((c, i) => ({
    id: `chap-${stamp}-${i + 1}`,
    title: c.title,
    folder: c.folder,
    order: i + 1,
    wordCount: 0,
    status: 'draft' as const,
    content: '<p><br></p>',
    updatedAt: now,
  }));
}
