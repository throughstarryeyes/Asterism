import type { Device, SyncBase } from './engine';
import type { HttpConfig } from './providers';

// a place this project is kept in step with. folder and server links persist; the others are one-off.
export interface SyncLink {
  id: string;
  projectId: string;
  kind: 'folder' | 'http' | 'google';
  label: string;
  http?: HttpConfig;
  auto: boolean;
  lastSyncedAt?: string;
}

const LINKS_KEY = 'asterism_sync_links';
const DEVICE_KEY = 'asterism_sync_device';

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

export function loadAllLinks(): SyncLink[] {
  const links = readJson<SyncLink[]>(LINKS_KEY, []);
  return Array.isArray(links) ? links : [];
}

export const loadLinks = (projectId: string) => loadAllLinks().filter(l => l.projectId === projectId);

export function saveLink(link: SyncLink): void {
  const rest = loadAllLinks().filter(l => l.id !== link.id);
  try { localStorage.setItem(LINKS_KEY, JSON.stringify([...rest, link])); } catch (e) { console.warn('Could not save sync link', e); }
}

export function deleteLink(id: string): void {
  try { localStorage.setItem(LINKS_KEY, JSON.stringify(loadAllLinks().filter(l => l.id !== id))); } catch { /* nothing to do */ }
}

// "keep my whole library on google drive" is a choice each device makes for itself (so it is not part of a backup)
const DRIVE_ALL_KEY = 'asterism_google_all';
export const driveAllOn = (): boolean => { try { return localStorage.getItem(DRIVE_ALL_KEY) === '1'; } catch { return false; } };
export const setDriveAll = (on: boolean): void => {
  try { if (on) localStorage.setItem(DRIVE_ALL_KEY, '1'); else localStorage.removeItem(DRIVE_ALL_KEY); } catch { /* it stays as it was */ }
};

export const newLinkId = () => newId('link');

// this device's name, so the other side can say who saved last.
export function getDevice(): Device {
  const saved = readJson<Device | null>(DEVICE_KEY, null);
  if (saved?.id) return saved;
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'device' : 'device';
  const device = { id: newId('dev'), name: platform };
  try { localStorage.setItem(DEVICE_KEY, JSON.stringify(device)); } catch { /* the id then lasts for this session only */ }
  return device;
}

// IndexedDB: last shared state per project and link, and folder handles (too big or not JSON for localStorage)

const DB = 'asterism-sync';
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 2);
      req.onupgradeneeded = () => {
        for (const name of ['bases', 'handles', 'lineage']) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

async function run<T>(store: 'bases' | 'handles' | 'lineage', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const baseKey = (projectId: string, linkId: string) => `${projectId}|${linkId}`;
export const getBase = (projectId: string, linkId: string) => run<SyncBase | undefined>('bases', 'readonly', s => s.get(baseKey(projectId, linkId)));
export const setBase = (projectId: string, linkId: string, base: SyncBase) => run('bases', 'readwrite', s => s.put(base, baseKey(projectId, linkId))).then(() => undefined);
export const deleteBase = (projectId: string, linkId: string) => run('bases', 'readwrite', s => s.delete(baseKey(projectId, linkId))).then(() => undefined);

export const getHandle = (linkId: string) => run<unknown>('handles', 'readonly', s => s.get(linkId));
export const setHandle = (linkId: string, handle: unknown) => run('handles', 'readwrite', s => s.put(handle, linkId)).then(() => undefined);
export const deleteHandle = (linkId: string) => run('handles', 'readwrite', s => s.delete(linkId)).then(() => undefined);

// the shared history of a live document as one session left it (see editor/collab/lineage.ts). `closed` is true only when the session
// ended cleanly, with the document's text and this history in step; a history from a session that was cut off is not trusted.
export interface Lineage { state: Uint8Array; session: string; closed: boolean; savedAt: number }
export const getLineage = (projectId: string) => run<Lineage | undefined>('lineage', 'readonly', s => s.get(projectId));
export const setLineage = (projectId: string, lineage: Lineage) => run('lineage', 'readwrite', s => s.put(lineage, projectId)).then(() => undefined);
export const deleteLineage = (projectId: string) => run('lineage', 'readwrite', s => s.delete(projectId)).then(() => undefined);
