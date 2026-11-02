import { readAllAssets, replaceAllAssets } from './assetStore';
import { OLD_BACKUP_TYPE, upgradeClasses, upgradeKey } from './legacy';

// one file that holds everything on this device: writing, points, cosmetics, settings, and the pictures and sounds that were added.
// not kept: this device's sync identity and links (each device needs its own) and small view settings.

export const BACKUP_TYPE = 'asterism-backup';
export const BACKUP_VERSION = 1;

const LEFT_OUT = ['asterism_sync_device', 'asterism_sync_links', 'asterism_google_all', 'asterism_google_refresh', 'asterism_hide_session_bar', 'asterism_new_editor', 'asterism_pending_text', 'asterism_live_prefs'];
export const isBackupKey = (k: string) => k.startsWith('asterism_') && !LEFT_OUT.includes(k);

export interface BackupAsset { id: string; type: string; data: string }
export interface Backup {
  type: typeof BACKUP_TYPE;
  version: number;
  made: string;
  data: Record<string, string>;
  assets: BackupAsset[];
}

export type Parsed = { ok: true; backup: Backup } | { ok: false; error: string };

// checks a file's text. anything that is not ours, or from a newer app, is refused before anything is touched.
export function parseBackup(text: string): Parsed {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'That is not an Asterism backup file.' }; }
  const r = raw as Partial<Backup> | null;
  if (!r || typeof r !== 'object' || (r.type !== BACKUP_TYPE && r.type !== OLD_BACKUP_TYPE)) return { ok: false, error: 'That is not an Asterism backup file.' };
  if (typeof r.version !== 'number' || r.version < 1) return { ok: false, error: 'That backup has no version.' };
  if (r.version > BACKUP_VERSION) return { ok: false, error: 'That backup was made by a newer Asterism. Update the app first.' };
  if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data)) return { ok: false, error: 'That backup has no data in it.' };
  const data: Record<string, string> = {};
  // a backup made under the old name is read the same way, with its keys and saved text brought up to date
  for (const [k, v] of Object.entries(r.data)) {
    const key = upgradeKey(k);
    if (isBackupKey(key) && typeof v === 'string') data[key] = upgradeClasses(v);
  }
  if (!data.asterism_projects_library && !data.asterism_user_stats) return { ok: false, error: 'That backup has no documents or settings in it.' };
  const assets = (Array.isArray(r.assets) ? r.assets : []).filter((a): a is BackupAsset => !!a && typeof a.id === 'string' && typeof a.data === 'string' && typeof a.type === 'string');
  return { ok: true, backup: { type: BACKUP_TYPE, version: r.version, made: typeof r.made === 'string' ? r.made : '', data, assets } };
}

export const backupFileName = (d = new Date()) => `asterism-backup-${d.toISOString().slice(0, 10)}.json`;

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
  fr.onerror = () => reject(fr.error);
  fr.readAsDataURL(blob);
});

export function fromBase64(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function buildBackup(): Promise<Backup> {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = k ? localStorage.getItem(k) : null;
    if (k && v !== null && isBackupKey(k)) data[k] = v;
  }
  const assets: BackupAsset[] = [];
  for (const a of await readAllAssets()) assets.push({ id: a.id, type: a.blob.type, data: await toBase64(a.blob) });
  return { type: BACKUP_TYPE, version: BACKUP_VERSION, made: new Date().toISOString(), data, assets };
}

// replaces what is on this device with the backup. the page should be reloaded afterwards.
export async function restoreBackup(b: Backup): Promise<void> {
  const blobs = b.assets.map(a => ({ id: a.id, blob: fromBase64(a.data, a.type) }));
  const old: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isBackupKey(k)) old.push(k); }
  old.forEach(k => localStorage.removeItem(k));
  Object.entries(b.data).forEach(([k, v]) => localStorage.setItem(k, v));
  await replaceAllAssets(blobs);
}
