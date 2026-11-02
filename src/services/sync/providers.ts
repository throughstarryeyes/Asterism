import { isSyncDoc, StaleError, type Remote, type SyncDoc, type SyncProvider } from './engine';
import type { AssetChannel, AssetMeta } from './assets';
import { base64ToBytes, bytesToBase64 } from '../exportFonts';

// ---- a folder (Dropbox, OneDrive, Google drive, iCloud, Syncthing, a USB stick) ---------------------

// the part of the file system access API we use, so tests can stand in a fake folder.
export interface FolderLike {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileLike>;
  // needed for uploaded fonts and pictures, which go in a folder of their own beside the sync file.
  getDirectoryHandle?(name: string, options?: { create?: boolean }): Promise<FolderLike>;
  removeEntry?(name: string): Promise<void>;
}
export interface FileLike {
  getFile(): Promise<{ text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer>; lastModified: number; size: number }>;
  createWritable(): Promise<{ write(data: string | Uint8Array): Promise<void>; close(): Promise<void> }>;
}

export const syncFileName = (projectId: string) => `asterism-${projectId.replace(/[^a-zA-Z0-9_-]+/g, '_')}.sync.json`;

const notFound = (e: unknown) => (e as { name?: string } | null)?.name === 'NotFoundError';

const safeName = (id: string) => id.replace(/[^a-zA-Z0-9_-]+/g, '_');

function folderAssets(dir: FolderLike, projectId: string): AssetChannel | undefined {
  if (!dir.getDirectoryHandle) return undefined;
  const open = dir.getDirectoryHandle.bind(dir);
  const folder = `${syncFileName(projectId).replace(/\.sync\.json$/, '')}.assets`;
  const MANIFEST = 'manifest.json';

  const sub = async (create: boolean): Promise<FolderLike | null> => {
    try { return await open(folder, { create }); } catch (e) { if (notFound(e) && !create) return null; throw e; }
  };
  const file = async (d: FolderLike, name: string): Promise<FileLike | null> => {
    try { return await d.getFileHandle(name); } catch (e) { if (notFound(e)) return null; throw e; }
  };
  const readManifest = async (d: FolderLike): Promise<AssetMeta[]> => {
    const handle = await file(d, MANIFEST);
    if (!handle) return [];
    try {
      const parsed: unknown = JSON.parse(await (await handle.getFile()).text());
      return Array.isArray(parsed) ? (parsed as AssetMeta[]).filter(m => m && typeof m.id === 'string') : [];
    } catch { return []; } // half-uploaded: treat as empty, the next put rewrites it
  };
  const write = async (d: FolderLike, name: string, data: string | Uint8Array) => {
    const out = await (await d.getFileHandle(name, { create: true })).createWritable();
    await out.write(data);
    await out.close();
  };

  return {
    async list() {
      const d = await sub(false);
      return d ? readManifest(d) : [];
    },
    async get(id) {
      const d = await sub(false);
      const handle = d ? await file(d, `${safeName(id)}.bin`) : null;
      return handle ? new Uint8Array(await (await handle.getFile()).arrayBuffer()) : undefined;
    },
    async put(meta, bytes) {
      const d = (await sub(true))!;
      await write(d, `${safeName(meta.id)}.bin`, bytes); // the file first, so the list never names a missing file
      const others = (await readManifest(d)).filter(m => m.id !== meta.id);
      await write(d, MANIFEST, JSON.stringify([...others, meta]));
    },
    async remove(id) {
      const d = await sub(false);
      if (!d) return;
      // the list first, so it never names a file that is gone.
      await write(d, MANIFEST, JSON.stringify((await readManifest(d)).filter(m => m.id !== id)));
      try { await d.removeEntry?.(`${safeName(id)}.bin`); } catch (e) { if (!notFound(e)) throw e; }
    },
  };
}

export function folderProvider(dir: FolderLike, projectId: string, folderName = 'the folder'): SyncProvider {
  const name = syncFileName(projectId);

  const stamp = async (handle: FileLike) => {
    const f = await handle.getFile();
    return `${f.lastModified}:${f.size}`;
  };
  const existing = async (): Promise<FileLike | null> => {
    try { return await dir.getFileHandle(name); } catch (e) { if (notFound(e)) return null; throw e; }
  };

  return {
    kind: 'folder',
    label: folderName,
    assets: folderAssets(dir, projectId),
    async read(): Promise<Remote> {
      const handle = await existing();
      if (!handle) return { doc: null };
      const text = await (await handle.getFile()).text();
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error(`The sync file in ${folderName} is damaged (it is not valid JSON). It may still be uploading from another device; try again in a moment.`); }
      if (!isSyncDoc(parsed)) throw new Error(`The file ${name} in ${folderName} is not an Asterism sync file.`);
      return { doc: parsed, etag: await stamp(handle) };
    },
    async write(doc: SyncDoc, etag?: string): Promise<string | undefined> {
      const handle = await existing();
      if (handle) {
        // someone (a cloud client, another device) changed the file since we read it.
        if (etag === undefined || (await stamp(handle)) !== etag) throw new StaleError();
      } else if (etag !== undefined) {
        throw new StaleError();
      }
      const target = handle ?? await dir.getFileHandle(name, { create: true });
      const out = await target.createWritable();
      await out.write(JSON.stringify(doc));
      await out.close();
      return stamp(target);
    },
  };
}

// ---- a server ---------------------------------------------------------------------------------------

export interface HttpConfig {
  // e.g. https://sync.example.com/asterism  (see server/sync-server.mjs for the shape)
  url: string;
  token?: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function httpProvider(config: HttpConfig, projectId: string, fetchImpl: Fetch = (i, init) => fetch(i, init)): SyncProvider {
  const base = config.url.replace(/\/+$/, '');
  const url = `${base}/projects/${encodeURIComponent(projectId)}`;
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    ...extra,
  });
  const fail = (res: Response, doing: string) => {
    if (res.status === 401 || res.status === 403) return new Error('The server refused the access token.');
    return new Error(`The server could not ${doing} (${res.status}).`);
  };

  const assetUrl = (id?: string) => `${url}/assets${id === undefined ? '' : `/${encodeURIComponent(id)}`}`;
  const assets: AssetChannel = {
    async list() {
      const res = await fetchImpl(assetUrl(), { headers: headers({ Accept: 'application/json' }) });
      if (res.status === 404) return [];
      if (!res.ok) throw fail(res, 'list the files');
      const parsed: unknown = await res.json();
      return Array.isArray(parsed) ? (parsed as AssetMeta[]) : [];
    },
    async get(id) {
      const res = await fetchImpl(assetUrl(id), { headers: headers() });
      if (res.status === 404) return undefined;
      if (!res.ok) throw fail(res, 'send the file');
      return new Uint8Array(await res.arrayBuffer());
    },
    async put(meta, bytes) {
      const res = await fetchImpl(assetUrl(meta.id), {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/octet-stream', 'X-Asset-Meta': encodeURIComponent(JSON.stringify(meta)) }),
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok) throw fail(res, 'save the file');
    },
    async remove(id) {
      const res = await fetchImpl(assetUrl(id), { method: 'DELETE', headers: headers() });
      if (!res.ok && res.status !== 404) throw fail(res, 'clear the file');
    },
  };

  return {
    kind: 'http',
    label: base.replace(/^https?:\/\//, ''),
    assets,
    async read(): Promise<Remote> {
      const res = await fetchImpl(url, { headers: headers({ Accept: 'application/json' }) });
      if (res.status === 404) return { doc: null };
      if (!res.ok) throw fail(res, 'send the project');
      const parsed: unknown = await res.json();
      if (!isSyncDoc(parsed)) throw new Error('The server sent something that is not an Asterism project.');
      return { doc: parsed, etag: res.headers.get('ETag') ?? undefined };
    },
    async write(doc: SyncDoc, etag?: string): Promise<string | undefined> {
      const res = await fetchImpl(url, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }) }),
        body: JSON.stringify(doc),
      });
      if (res.status === 412 || res.status === 409) throw new StaleError();
      if (!res.ok) throw fail(res, 'save the project');
      return res.headers.get('ETag') ?? undefined;
    },
  };
}

// ---- a file you carry yourself ----------------------------------------------------------------------

// reads one sync file the writer picked; saving back is left to a download. uploaded files ride
// inside the file, so `carry` gives the document to download with them added.
export function fileProvider(doc: SyncDoc | null, label = 'a sync file'): SyncProvider & { written?: SyncDoc; carry(): SyncDoc | undefined } {
  const held = new Map<string, { meta: AssetMeta; data: string }>();
  (doc?.assets ?? []).forEach(({ data, ...meta }) => held.set(meta.id, { meta, data }));
  const provider: SyncProvider & { written?: SyncDoc; carry(): SyncDoc | undefined } = {
    kind: 'file',
    label,
    assets: {
      async list() { return Array.from(held.values(), h => h.meta); },
      async get(id) { const h = held.get(id); return h ? base64ToBytes(h.data) : undefined; },
      async put(meta, bytes) { held.set(meta.id, { meta, data: bytesToBase64(bytes) }); },
      async remove(id) { held.delete(id); },
    },
    async read(): Promise<Remote> { return { doc }; },
    async write(next: SyncDoc): Promise<string | undefined> { provider.written = next; return undefined; },
    carry() {
      if (!provider.written) return undefined;
      return held.size ? { ...provider.written, assets: Array.from(held.values(), h => ({ ...h.meta, data: h.data })) } : provider.written;
    },
  };
  return provider;
}
