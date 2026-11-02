// uploaded fonts and images are too big for localStorage, so they live in IndexedDB
// the rest of the app keeps only their ids

const DB_NAME = 'asterism-assets';
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const newAssetId = (prefix = 'asset') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function putAsset(blob: Blob, id: string = newAssetId()): Promise<string> {
  await run('readwrite', s => s.put(blob, id));
  return id;
}

export async function getAsset(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>('readonly', s => s.get(id));
}

export async function deleteAsset(id: string): Promise<void> {
  revokeAssetUrl(id);
  await run('readwrite', s => s.delete(id));
}

export async function listAssetIds(): Promise<string[]> {
  return (await run<IDBValidKey[]>('readonly', s => s.getAllKeys())).map(String);
}

const urlCache = new Map<string, string>();

// an object URL for use in CSS or <img>. cached so repeated calls are cheap.
export async function getAssetUrl(id: string): Promise<string | undefined> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getAsset(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export function revokeAssetUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

// remove anything nothing refers to any more (replaced images, deleted themes/fonts).
export async function pruneAssets(inUse: Set<string>): Promise<string[]> {
  const removed: string[] = [];
  for (const id of await listAssetIds()) {
    if (!inUse.has(id)) {
      await deleteAsset(id);
      removed.push(id);
    }
  }
  return removed;
}

// every stored blob with its id, for a full backup
export async function readAllAssets(): Promise<Array<{ id: string; blob: Blob }>> {
  const ids = await listAssetIds();
  const out: Array<{ id: string; blob: Blob }> = [];
  for (const id of ids) {
    const blob = await getAsset(id);
    if (blob) out.push({ id, blob });
  }
  return out;
}

// empties the store and puts these in, for restoring a backup
export async function replaceAllAssets(items: Array<{ id: string; blob: Blob }>): Promise<void> {
  for (const id of await listAssetIds()) await deleteAsset(id);
  for (const it of items) await putAsset(it.blob, it.id);
}
