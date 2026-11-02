import type { Project, Chapter } from '../types';
import { countWordsFromHtml } from './storage';
import type { EmbeddedFont } from './exportFonts';

export interface ImportedManuscriptResult {
  title: string;
  chapters: Chapter[];
  projectBackup?: Project;
  embeddedFonts?: EmbeddedFont[];
  draftMode?: 'chaptered' | 'open_draft';
}

export async function readManuscriptFile(file: File): Promise<ImportedManuscriptResult> {
  const fileName = file.name;
  const isJson = fileName.toLowerCase().endsWith('.json');

  if (isJson) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.chapters)) {
      const { embeddedFonts, ...project } = parsed;
      return {
        title: parsed.title || fileName.replace(/\.json$/i, ''),
        chapters: parsed.chapters,
        projectBackup: project as Project,
        embeddedFonts: Array.isArray(embeddedFonts) ? embeddedFonts : undefined
      };
    }
  }

  const rawText = await file.text();
  return parseManuscriptContent(rawText, fileName);
}

export function parseManuscriptContent(text: string, sourceName?: string): ImportedManuscriptResult {
  const fallbackTitle = sourceName ? sourceName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Imported Manuscript';
  
  if (!text || !text.trim()) {
    return {
      title: fallbackTitle,
      chapters: [
        {
          id: `chap-${Date.now()}-1`,
          title: 'Chapter 1',
          order: 1,
          content: '<p></p>',
          wordCount: 0,
          status: 'draft',
          updatedAt: new Date().toISOString()
        }
      ]
    };
  }

  // detects chapter headings like "# Chapter 1", "Chapter One", "Chapter I", "CHAPTER 1" or "ACT I"
  const chapterSplitRegex = /(?:^|\n)(?=(?:#+\s+|Chapter\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)|CHAPTER\s+(?:\d+|[IVXLCDM]+|[A-Za-z]+)|Act\s+[IVXLCDM\d]+|ACT\s+[IVXLCDM\d]+))/i;
  
  const rawSegments = text.split(chapterSplitRegex).map(s => s.trim()).filter(Boolean);

  let detectedTitle = fallbackTitle;
  const chapters: Chapter[] = [];

  // check if first segment is a document title (# my book)
  let startIndex = 0;
  if (rawSegments.length > 0) {
    const first = rawSegments[0];
    const titleMatch = first.match(/^#\s+(.+)$/m);
    if (titleMatch && !/chapter/i.test(titleMatch[1])) {
      detectedTitle = titleMatch[1].trim();
      startIndex = 1;
    }
  }

  const remainingSegments = rawSegments.slice(startIndex);

  if (remainingSegments.length > 0) {
    remainingSegments.forEach((seg, idx) => {
      // determine chapter title
      let chapterTitle = `Chapter ${idx + 1}`;
      let contentBody = seg;

      const firstLine = seg.split('\n')[0].trim();
      if (/^(?:#+\s+|Chapter\s+|Act\s+)/i.test(firstLine)) {
        chapterTitle = firstLine.replace(/^#+\s*/, '').trim();
        contentBody = seg.substring(firstLine.length).trim();
      }

      // convert plaintext paragraphs into HTML <p>
      const paragraphs = contentBody
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`);

      const htmlContent = paragraphs.length > 0 ? paragraphs.join('') : '<p></p>';
      const wordCount = countWordsFromHtml(htmlContent);

      chapters.push({
        id: `chap-${Date.now()}-${idx + 1}`,
        title: chapterTitle || `Chapter ${idx + 1}`,
        order: idx + 1,
        content: htmlContent,
        wordCount,
        status: 'draft',
        updatedAt: new Date().toISOString()
      });
    });
  } else {
    // single chapter fallback
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`);

    const htmlContent = paragraphs.join('');
    chapters.push({
      id: `chap-${Date.now()}-1`,
      title: 'Chapter 1',
      order: 1,
      content: htmlContent,
      wordCount: countWordsFromHtml(htmlContent),
      status: 'draft',
      updatedAt: new Date().toISOString()
    });
  }

  const detectedDraftMode = chapters.length === 1 ? 'open_draft' : 'chaptered';

  return {
    title: detectedTitle,
    chapters,
    draftMode: detectedDraftMode
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
