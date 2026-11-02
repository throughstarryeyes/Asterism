import type { Project } from '../../types';
import { parseHtmlBlocks, type Block } from './htmlBlocks';

export interface ExportChapter {
  // "Chapter 3" when the writer's title starts that way; otherwise there is no label.
  label?: string;
  title: string;
  blocks: Block[];
}

export interface ExportManuscript {
  title: string;
  subtitle?: string;
  author: string;
  language: string;
  chapters: ExportChapter[];
}

const CHAPTER_PREFIX = /^(chapter\s+[ivxlcdm\d]+)\s*[:.\-–—]?\s*/i;

export function splitChapterTitle(title: string): { label?: string; title: string } {
  const trimmed = title.trim();
  const m = CHAPTER_PREFIX.exec(trimmed);
  if (!m) return { title: trimmed };
  const label = m[1].replace(/\s+/g, ' ');
  return { label: label.charAt(0).toUpperCase() + label.slice(1), title: trimmed.slice(m[0].length).trim() };
}

export function prepareManuscript(project: Project): ExportManuscript {
  const open = project.draftMode === 'open_draft';
  const chapters = [...project.chapters]
    .sort((a, b) => a.order - b.order)
    .map(c => {
      const { label, title } = open ? { label: undefined, title: '' } : splitChapterTitle(c.title);
      return { label, title, blocks: parseHtmlBlocks(c.content) };
    });
  return {
    title: project.title || 'Untitled',
    subtitle: project.subtitle || undefined,
    author: project.author || '',
    language: 'en',
    chapters,
  };
}

export function fileStem(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'manuscript';
}
