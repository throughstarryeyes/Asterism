import { describe, it, expect } from 'vitest';
import { syncProject, makeDoc, StaleError, type Device, type SyncBase } from '../engine';
import { driveProvider, listDriveProjects, SignInError } from '../googleDrive';
import type { Project } from '../../../types';

// a tiny stand-in for google drive: folders and files with ids, parents and a version that goes up on every save.
// 'appDataFolder' is the hidden folder an earlier version of the app used.
interface FakeFile { id: string; name: string; version: number; body: string; parents: string[]; mime?: string; props?: Record<string, string> }
const GOOGLE_DOC = 'application/vnd.google-apps.document';
function fakeDrive(fail?: { status: number; body: unknown }) {
  const files = new Map<string, FakeFile>();
  let next = 1;
  let signedIn = true;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (input: string, init: RequestInit = {}): Promise<Response> => {
    if (!signedIn) return new Response('', { status: 401 });
    if (fail) return json(fail.body, fail.status);
    const url = new URL(input);
    const method = init.method ?? 'GET';
    if (method === 'GET' && url.pathname === '/drive/v3/files') {
      const q = url.searchParams.get('q') ?? '';
      const hidden = url.searchParams.get('spaces') === 'appDataFolder';
      const exact = /name = '([^']*)'/.exec(q)?.[1];
      const part = /name contains '([^']*)'/.exec(q)?.[1];
      const mime = /mimeType = '([^']*)'/.exec(q)?.[1];
      const parent = /'([^']+)' in parents/.exec(q)?.[1];
      const prop = /appProperties has \{ key='([^']*)' and value='([^']*)' \}/.exec(q);
      const list = [...files.values()].filter(f =>
        (!prop || f.props?.[prop[1]] === prop[2]) &&
        (hidden ? f.parents.includes('appDataFolder') : !f.parents.includes('appDataFolder'))
        && (exact ? f.name === exact : part ? f.name.includes(part) : true)
        && (mime ? f.mime === mime : prop ? f.mime === GOOGLE_DOC : !f.mime)
        && (parent ? f.parents.includes(parent) : true));
      return json({ files: list.map(f => ({ id: f.id, name: f.name, version: String(f.version) })) });
    }
    const id = url.pathname.split('/').pop() ?? '';
    if (method === 'GET' && url.searchParams.get('alt') === 'media') {
      const f = files.get(id);
      return f ? new Response(f.body, { status: 200 }) : new Response('', { status: 404 });
    }
    if (method === 'POST' && url.pathname === '/drive/v3/files') {
      const meta = JSON.parse(String(init.body)) as { name: string; mimeType: string };
      const f = { id: `f${next++}`, name: meta.name, version: 1, body: '', parents: [], mime: meta.mimeType };
      files.set(f.id, f);
      return json({ id: f.id });
    }
    if (method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      // the body is: boundary, headers, blank, metadata, boundary, headers, blank, media, closing boundary
      const lines = String(init.body).split('\r\n');
      const meta = JSON.parse(lines[3]) as { name: string; parents: string[]; mimeType?: string; appProperties?: Record<string, string> };
      const media = lines[lines.length - 2];
      const f: FakeFile = { id: `f${next++}`, name: meta.name, version: 1, body: media, parents: meta.parents, props: meta.appProperties, ...(meta.mimeType === GOOGLE_DOC ? { mime: GOOGLE_DOC } : {}) };
      files.set(f.id, f);
      return json({ id: f.id, version: String(f.version) });
    }
    if (method === 'PATCH') {
      const f = files.get(id);
      if (!f) return new Response('', { status: 404 });
      if (url.pathname.startsWith('/drive/v3/')) { f.name = (JSON.parse(String(init.body)) as { name: string }).name; return json({ id: f.id }); }
      f.body = String(init.body);
      f.version++;
      return json({ id: f.id, version: String(f.version) });
    }
    return new Response('', { status: 400 });
  };
  // a project an earlier version left in the hidden folder
  const leaveHidden = (name: string, doc: unknown) => { const f = { id: `f${next++}`, name, version: 1, body: JSON.stringify(doc), parents: ['appDataFolder'] }; files.set(f.id, f); };
  return { files, fetchImpl, signOut: () => { signedIn = false; }, leaveHidden };
}

const project = (text: string): Project => ({
  id: 'proj-1', title: 'The Salt Road', author: 'A. Writer', genre: 'fantasy', synopsis: '',
  chapters: [{ id: 'c1', title: 'One', order: 1, wordCount: 0, status: 'draft', content: `<p>${text}</p>`, updatedAt: '2026-01-01T00:00:00Z' }],
  storyBible: { characters: [], locations: [], lore: [] },
  plotThreads: [], timeline: [], reflections: [], goals: [], comments: [], findings: [],
  tags: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Project);

const laptop: Device = { id: 'dev-a', name: 'Laptop' };
const phone: Device = { id: 'dev-b', name: 'Phone' };
const token = async () => 'token';

describe('google drive provider', () => {
  it('creates the project on the first sync, then brings it to a second device', async () => {
    const drive = fakeDrive();
    const first = await syncProject({ local: project('Hello from the laptop.'), provider: driveProvider(token, 'proj-1', drive.fetchImpl), device: laptop });
    expect(first.status).toBe('pushed');
    // one folder, and the project inside it where the writer can see it
    const folder = [...drive.files.values()].find(f => f.mime === 'application/vnd.google-apps.folder' && f.name === 'Asterism')!;
    const saved = [...drive.files.values()].filter(f => f.name.startsWith('project-'));
    expect(saved).toHaveLength(1);
    expect(saved[0].parents).toEqual([folder.id]);

    const second = await syncProject({ local: project('Hello from the laptop.'), provider: driveProvider(token, 'proj-1', drive.fetchImpl), device: phone, base: first.base });
    expect(second.status).toBe('up-to-date');

    const edited = await syncProject({ local: project('Hello from the laptop. And more.'), provider: driveProvider(token, 'proj-1', drive.fetchImpl), device: laptop, base: first.base });
    expect(edited.status).toBe('pushed');
    const pulled = await syncProject({ local: project('Hello from the laptop.'), provider: driveProvider(token, 'proj-1', drive.fetchImpl), device: phone, base: second.base });
    expect(pulled.status).toBe('pulled');
    expect(pulled.project.chapters[0].content).toContain('And more.');
  });

  it('refuses to overwrite a save it has not seen', async () => {
    const drive = fakeDrive();
    const provider = driveProvider(token, 'proj-1', drive.fetchImpl);
    const base: SyncBase | undefined = undefined;
    await syncProject({ local: project('One.'), provider, device: laptop, base });
    const seen = await provider.read();
    // someone else saves in between
    await provider.write(makeDoc(project('Two.'), 2, phone), seen.etag);
    await expect(provider.write(makeDoc(project('Three.'), 3, laptop), seen.etag)).rejects.toBeInstanceOf(StaleError);
    // a first save over a file that now exists is also refused
    await expect(provider.write(makeDoc(project('Four.'), 4, laptop), undefined)).rejects.toBeInstanceOf(StaleError);
  });

  it('asks for a new sign in when google says the token is no good', async () => {
    const drive = fakeDrive();
    drive.signOut();
    await expect(driveProvider(token, 'proj-1', drive.fetchImpl).read()).rejects.toBeInstanceOf(SignInError);
  });

  it('says what google refused, so a missing setup is not mistaken for a busy moment', async () => {
    const off = fakeDrive({ status: 403, body: { error: { code: 403, message: 'Google Drive API has not been used in project 1 before.', errors: [{ reason: 'accessNotConfigured' }] } } });
    await expect(driveProvider(token, 'proj-1', off.fetchImpl).read()).rejects.toThrow(/Google Drive API is switched off/);

    const detailed = fakeDrive({ status: 403, body: { error: { code: 403, status: 'PERMISSION_DENIED', message: 'x', details: [{ reason: 'SERVICE_DISABLED' }] } } });
    await expect(driveProvider(token, 'proj-1', detailed.fetchImpl).read()).rejects.toThrow(/switched off/);

    const scope = fakeDrive({ status: 403, body: { error: { code: 403, message: 'Request had insufficient authentication scopes.', errors: [{ reason: 'insufficientPermissions' }] } } });
    const err = await driveProvider(token, 'proj-1', scope.fetchImpl).read().catch(e => e);
    expect(err).toBeInstanceOf(SignInError);
    expect(String(err.message)).toMatch(/box for Google Drive/);

    const busy = fakeDrive({ status: 403, body: { error: { code: 403, message: 'Rate Limit Exceeded', errors: [{ reason: 'rateLimitExceeded' }] } } });
    await expect(driveProvider(token, 'proj-1', busy.fetchImpl).read()).rejects.toThrow(/not letting this through/);

    const odd = fakeDrive({ status: 500, body: { error: { code: 500, message: 'Backend Error' } } });
    await expect(driveProvider(token, 'proj-1', odd.fetchImpl).read()).rejects.toThrow(/\(500: Backend Error\)/);
  });

  it('copies a project from the old hidden folder into the visible one the first time it is read', async () => {
    const drive = fakeDrive();
    drive.leaveHidden('project-proj-1.json', makeDoc(project('Written before the move.'), 4, laptop));
    const provider = driveProvider(token, 'proj-1', drive.fetchImpl);
    const first = await provider.read();
    expect(first.doc?.project.chapters[0].content).toContain('Written before the move.');
    const visible = [...drive.files.values()].filter(f => f.name.startsWith('project-') && !f.parents.includes('appDataFolder'));
    expect(visible).toHaveLength(1);
    // saving afterwards goes to the visible copy, and the second read no longer needs the hidden one
    await provider.write(makeDoc(project('Edited after the move.'), 5, laptop), first.etag);
    expect((await provider.read()).doc?.project.chapters[0].content).toContain('Edited after the move.');
    expect(JSON.parse(visible[0].body).revision).toBe(5);
  });

  it('also keeps the writing as a Google Doc, made once and then replaced', async () => {
    const drive = fakeDrive();
    const provider = () => driveProvider(token, 'proj-1', drive.fetchImpl);
    const first = await syncProject({ local: { ...project('Chapter text.'), draftMode: 'chaptered' }, provider: provider(), device: laptop });
    const docs = () => [...drive.files.values()].filter(f => f.mime === 'application/vnd.google-apps.document');
    expect(docs()).toHaveLength(1);
    const copy = docs()[0];
    expect(copy.name).toBe('The Salt Road');
    expect(copy.props).toEqual({ asterismDoc: 'proj-1' });
    // it sits in its own folder, apart from the project file, and holds only the writing
    const folder = [...drive.files.values()].find(f => f.name === 'Asterism documents')!;
    expect(copy.parents).toEqual([folder.id]);
    expect(copy.body).toContain('<h1>The Salt Road</h1>');
    expect(copy.body).toContain('<h2>One</h2><p>Chapter text.</p>');
    expect(copy.body).not.toContain('storyBible');

    // saving again replaces it instead of making another, and follows a rename
    await syncProject({ local: { ...project('Chapter text, revised.'), title: 'Renamed' }, provider: provider(), device: laptop, base: first.base });
    expect(docs()).toHaveLength(1);
    expect(docs()[0].body).toContain('Chapter text, revised.');
    expect(docs()[0].name).toBe('Renamed');
  });

  it('leaves out mind maps, branching stories and card decks', async () => {
    const drive = fakeDrive();
    await syncProject({ local: { ...project('A map.'), kind: 'mindmap' } as Project, provider: driveProvider(token, 'proj-1', drive.fetchImpl), device: laptop });
    expect([...drive.files.values()].filter(f => f.mime === 'application/vnd.google-apps.document')).toHaveLength(0);
    expect([...drive.files.values()].some(f => f.name.startsWith('project-'))).toBe(true);
  });

  it('does not fail the sync when the Google Doc cannot be made', async () => {
    const drive = fakeDrive();
    const failing = async (input: string, init?: RequestInit) => {
      if (String(init?.body ?? '').includes('application/vnd.google-apps.document')) return new Response('{}', { status: 500 });
      return drive.fetchImpl(input, init);
    };
    const out = await syncProject({ local: project('Words.'), provider: driveProvider(token, 'proj-1', failing), device: laptop });
    expect(out.status).toBe('pushed');
    expect([...drive.files.values()].filter(f => f.name.startsWith('project-'))).toHaveLength(1);
  });

  it('lists every project kept in the folder, newest first', async () => {
    const drive = fakeDrive();
    for (const [id, title] of [['proj-1', 'The Salt Road'], ['proj-2', 'Second Book']] as const) {
      const p = { ...project('Words.'), id, title };
      await syncProject({ local: p, provider: driveProvider(token, id, drive.fetchImpl), device: laptop, now: new Date(id === 'proj-1' ? '2026-02-01' : '2026-03-01') });
    }
    const found = await listDriveProjects(token, drive.fetchImpl);
    expect(found.map(f => f.title)).toEqual(['Second Book', 'The Salt Road']);
    expect(found[0].device).toBe('Laptop');
  });
});
