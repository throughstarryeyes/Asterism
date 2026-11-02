import { isSyncDoc, StaleError, type SyncDoc, type SyncProvider, type Remote } from './engine';
import { copyToGoogleDocs } from './googleDocs';

// google drive as a place to keep a project. projects live in a folder called "Asterism" in the writer's own drive, so they can be
// opened, shared and backed up like any other file. the app can only ever see the files it made itself (scope drive.file).
// earlier versions kept them in the app's hidden data folder (drive.appdata); those are copied across the first time they are seen.

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const DRIVE_SCOPE = `${DRIVE_FILE_SCOPE} ${DRIVE_APPDATA_SCOPE}`;

// google lets the writer untick boxes on its sign-in page, so a token can come back without the one thing the app needs.
// no scope listed at all means google did not say, which is not a reason to refuse.
export const hasDriveScope = (granted?: string): boolean => !granted || granted.split(/\s+/).includes(DRIVE_FILE_SCOPE);

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const FOLDER_NAME = 'Asterism';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
// gives a current access token, or throws when the writer needs to sign in again
export type TokenSource = () => Promise<string>;

const fileName = (projectId: string) => `project-${projectId.replace(/[^A-Za-z0-9_-]/g, '_')}.json`;
const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const fields = (s: string) => encodeURIComponent(s);

interface DriveFile { id: string; name: string; version?: string; modifiedTime?: string }

export class SignInError extends Error {
  constructor(message = 'Sign in to Google again to keep syncing.') { super(message); this.name = 'SignInError'; }
}

export const MISSING_SCOPE = 'Google signed you in, but the box for Google Drive was not ticked. Sign in again and leave it ticked.';

// what google actually said, so a failure can be told apart from a busy moment
async function failure(res: Response, doing: string): Promise<Error> {
  let reason = '';
  let message = '';
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } };
    reason = body.error?.errors?.[0]?.reason ?? body.error?.details?.find(d => d.reason)?.reason ?? '';
    message = body.error?.message ?? '';
  } catch { /* no body to read */ }

  if (res.status === 401) return new SignInError();
  if (/^(accessNotConfigured|SERVICE_DISABLED)$/i.test(reason)) {
    return new Error('The Google Drive API is switched off in the Google Cloud project behind this app. In the Cloud console, open APIs & Services, then Library, and enable "Google Drive API".');
  }
  if (/^(insufficientPermissions|insufficientScopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT)$/i.test(reason)) return new SignInError(MISSING_SCOPE);
  if (/^(storageQuotaExceeded)$/i.test(reason)) return new Error('Your Google Drive is full, so the project could not be saved.');
  if (res.status === 429 || /^(rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded)$/i.test(reason)) {
    return new Error('Google Drive is not letting this through right now. Try again in a little while.');
  }
  const detail = [res.status, reason || message].filter(Boolean).join(': ');
  return new Error(`Could not ${doing} (${detail}).`);
}

export function driveClient(token: TokenSource, fetchImpl: Fetch = (i, init) => fetch(i, init)) {
  const call = async (url: string, init: RequestInit = {}, doing = 'reach Google Drive'): Promise<Response> => {
    const res = await fetchImpl(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await token()}` } });
    if (!res.ok && res.status !== 404) throw await failure(res, doing);
    return res;
  };

  // a folder is looked for before it is made, and the oldest one wins if two devices made one at the same moment
  const folders = new Map<string, string>();
  const folderNamed = async (name: string, make: boolean): Promise<string | undefined> => {
    const known = folders.get(name);
    if (known) return known;
    const q = encodeURIComponent(`name = '${quote(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`);
    const res = await call(`${API}?q=${q}&orderBy=createdTime&fields=${fields('files(id)')}&pageSize=1`, {}, `look for the ${name} folder`);
    let id = ((await res.json()) as { files?: DriveFile[] }).files?.[0]?.id;
    if (!id && make) {
      const made = await call(`${API}?fields=id`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
      }, `make the ${name} folder`);
      id = ((await made.json()) as DriveFile).id;
    }
    if (id) folders.set(name, id);
    return id;
  };
  const folder = (make: boolean) => folderNamed(FOLDER_NAME, make);

  const find = async (name: string): Promise<DriveFile | undefined> => {
    const parent = await folder(false);
    if (!parent) return undefined;
    const q = encodeURIComponent(`name = '${quote(name)}' and '${parent}' in parents and trashed = false`);
    const res = await call(`${API}?q=${q}&fields=${fields('files(id,name,version,modifiedTime)')}&pageSize=5`, {}, 'look for the project');
    return ((await res.json()) as { files?: DriveFile[] }).files?.[0];
  };

  // a copy kept by an earlier version in the app's hidden data folder. never a reason to fail: that permission may simply not be there.
  const findLegacy = async (name: string): Promise<DriveFile | undefined> => {
    try {
      const q = encodeURIComponent(`name = '${quote(name)}' and trashed = false`);
      const res = await call(`${API}?spaces=appDataFolder&q=${q}&fields=${fields('files(id,name,version)')}&pageSize=5`, {}, 'look for an older copy');
      return ((await res.json()) as { files?: DriveFile[] }).files?.[0];
    } catch (e) {
      if (e instanceof SignInError && e.message !== MISSING_SCOPE) throw e;
      return undefined;
    }
  };

  const download = async (id: string): Promise<unknown> => {
    const res = await call(`${API}/${id}?alt=media`, {}, 'read the project');
    if (res.status === 404) return undefined;
    return res.json();
  };

  const create = async (name: string, doc: SyncDoc): Promise<string | undefined> => {
    const parent = await folder(true);
    const boundary = `asterism-${Math.random().toString(36).slice(2)}`;
    const body = [
      `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '',
      JSON.stringify({ name, parents: [parent], mimeType: 'application/json' }),
      `--${boundary}`, 'Content-Type: application/json', '',
      JSON.stringify(doc), `--${boundary}--`,
    ].join('\r\n');
    const res = await call(`${UPLOAD}?uploadType=multipart&fields=id,version`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    }, 'save the project');
    return ((await res.json()) as DriveFile).version;
  };

  const update = async (id: string, doc: SyncDoc): Promise<string | undefined> => {
    const res = await call(`${UPLOAD}/${id}?uploadType=media&fields=id,version`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc),
    }, 'save the project');
    return ((await res.json()) as DriveFile).version;
  };

  // every project file, in the folder and (for writers who used an earlier version) in the hidden folder
  const list = async (): Promise<{ id: string; legacy: boolean }[]> => {
    const out: { id: string; legacy: boolean }[] = [];
    const parent = await folder(false);
    if (parent) {
      const q = encodeURIComponent(`name contains 'project-' and '${parent}' in parents and trashed = false`);
      const res = await call(`${API}?q=${q}&fields=${fields('files(id,name)')}&pageSize=100`, {}, 'list your projects');
      for (const f of ((await res.json()) as { files?: DriveFile[] }).files ?? []) out.push({ id: f.id, legacy: false });
    }
    try {
      const q = encodeURIComponent("name contains 'project-' and trashed = false");
      const res = await call(`${API}?spaces=appDataFolder&q=${q}&fields=${fields('files(id,name)')}&pageSize=100`, {}, 'list older copies');
      for (const f of ((await res.json()) as { files?: DriveFile[] }).files ?? []) out.push({ id: f.id, legacy: true });
    } catch (e) {
      if (e instanceof SignInError && e.message !== MISSING_SCOPE) throw e;
    }
    return out;
  };

  return { find, findLegacy, download, create, update, list, call, folderNamed };
}

export function driveProvider(token: TokenSource, projectId: string, fetchImpl?: Fetch): SyncProvider {
  const drive = driveClient(token, fetchImpl);
  const name = fileName(projectId);
  return {
    kind: 'drive',
    label: 'Google Drive',
    async read(): Promise<Remote> {
      const file = await drive.find(name);
      if (file) {
        const parsed = await drive.download(file.id);
        if (parsed === undefined) return { doc: null };
        if (!isSyncDoc(parsed)) throw new Error('The file in Google Drive is not an Asterism project.');
        return { doc: parsed, etag: file.version };
      }
      // not in the folder yet: an earlier version may have left it in the hidden one, so it is copied across (and left there as a backup)
      const old = await drive.findLegacy(name);
      if (!old) return { doc: null };
      const parsed = await drive.download(old.id);
      if (parsed === undefined) return { doc: null };
      if (!isSyncDoc(parsed)) throw new Error('The file in Google Drive is not an Asterism project.');
      return { doc: parsed, etag: await drive.create(name, parsed) };
    },
    async write(doc: SyncDoc, etag?: string): Promise<string | undefined> {
      const file = await drive.find(name);
      let version: string | undefined;
      if (!file) {
        if (etag !== undefined) throw new StaleError();
        version = await drive.create(name, doc);
      } else {
        // another device saved since we read it
        if (etag === undefined || file.version !== etag) throw new StaleError();
        version = await drive.update(file.id, doc);
      }
      // the writing also goes to a Google Doc to read and share. the project is already safe, so a failure here never fails the sync
      await copyToGoogleDocs(drive, doc.project).catch(() => undefined);
      return version;
    },
  };
}

export interface DriveProject { projectId: string; title: string; savedAt: string; device: string; doc: SyncDoc }

// every project kept in the Asterism folder, so a new device can bring them in
export async function listDriveProjects(token: TokenSource, fetchImpl?: Fetch): Promise<DriveProject[]> {
  const drive = driveClient(token, fetchImpl);
  const found = new Map<string, DriveProject & { legacy: boolean }>();
  for (const f of await drive.list()) {
    const doc = await drive.download(f.id);
    if (!isSyncDoc(doc)) continue;
    const seen = found.get(doc.projectId);
    // the copy in the folder is the real one; the hidden copy only stands in until it has been copied across
    if (seen && !seen.legacy) continue;
    if (seen && f.legacy) continue;
    found.set(doc.projectId, { projectId: doc.projectId, title: doc.project.title, savedAt: doc.savedAt, device: doc.device.name, doc, legacy: f.legacy });
  }
  return [...found.values()].map(({ legacy: _legacy, ...p }) => p).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
