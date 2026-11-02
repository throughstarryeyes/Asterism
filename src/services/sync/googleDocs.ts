import type { Project } from '../../types';
import type { driveClient } from './googleDrive';

// Google Drive sync also keeps a copy of each document's writing as a real Google Doc, so it can be read, shared and commented on in
// Google Docs. only the writing goes: the title, the author and the chapters. the story bible, plot threads and goals stay in
// Asterism, and so do mind maps, branching stories and card decks. no other kind of sync does this.
//
// it is a copy, not a link: it is written again every time the document is saved to Drive, so changes made in Google Docs do not come
// back. Drive turns the html into a Google Doc itself (a file made with the type "Google Docs" and html as its content).

export const DOCS_FOLDER = 'Asterism documents';
const DOC_MIME = 'application/vnd.google-apps.document';
const PROP = 'asterismDoc';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// the writing of a document, as plain html that Google Docs reads well: headings, paragraphs, bold and italic, lists, quotes
export function docHtml(project: Project): string {
  const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
  // an open draft is one continuous piece, so it has no chapter headings of its own
  const headings = project.draftMode !== 'open_draft';
  const body = chapters.map(c => `${headings ? `<h2>${escape(c.title || 'Untitled')}</h2>` : ''}${c.content ?? ''}`).join('\n');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<title>${escape(project.title || 'Untitled')}</title></head><body>`,
    `<h1>${escape(project.title || 'Untitled')}</h1>`,
    project.author ? `<p><em>by ${escape(project.author)}</em></p>` : '',
    body,
    '</body></html>',
  ].join('\n');
}

// mind maps, branching stories and card decks are not writing
export const isWriting = (project: Project): boolean => !project.kind && !project.branching;

export interface DocsCopy { id: string; url: string; created: boolean }

type Drive = ReturnType<typeof driveClient>;
const urlFor = (id: string) => `https://docs.google.com/document/d/${id}/edit`;

// writes the document's Google Doc, making it the first time and replacing its content after that. null for anything that is not writing.
export async function copyToGoogleDocs(drive: Drive, project: Project): Promise<DocsCopy | null> {
  if (!isWriting(project)) return null;
  const parent = await drive.folderNamed(DOCS_FOLDER, true);
  const name = project.title || 'Untitled';
  const html = docHtml(project);

  // a document keeps the one Google Doc it made the first time, found by the document's id and not by its name (which can change)
  const q = encodeURIComponent(`appProperties has { key='${PROP}' and value='${quote(project.id)}' } and '${parent}' in parents and trashed = false`);
  const found = await drive.call(`${API}?q=${q}&fields=${encodeURIComponent('files(id,name)')}&pageSize=1`, {}, 'look for the Google Doc');
  const existing = ((await found.json()) as { files?: { id: string; name: string }[] }).files?.[0];

  if (existing) {
    await drive.call(`${UPLOAD}/${existing.id}?uploadType=media&fields=id`, {
      method: 'PATCH', headers: { 'Content-Type': 'text/html; charset=UTF-8' }, body: html,
    }, 'update the Google Doc');
    if (existing.name !== name) {
      await drive.call(`${API}/${existing.id}?fields=id`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      }, 'rename the Google Doc');
    }
    return { id: existing.id, url: urlFor(existing.id), created: false };
  }

  const boundary = `asterism-${Math.random().toString(36).slice(2)}`;
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '',
    JSON.stringify({ name, mimeType: DOC_MIME, parents: [parent], appProperties: { [PROP]: project.id } }),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', '',
    html, `--${boundary}--`,
  ].join('\r\n');
  const made = await drive.call(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  }, 'make the Google Doc');
  const id = ((await made.json()) as { id: string }).id;
  return { id, url: urlFor(id), created: true };
}
