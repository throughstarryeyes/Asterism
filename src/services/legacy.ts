// the app used to go by another name. this is the one place that still knows it, so data and files made back then keep working.

export const OLD_PREFIX = 'inkwell_';
export const NEW_PREFIX = 'asterism_';

export const OLD_BACKUP_TYPE = 'inkwell-backup';
export const OLD_SHARE_TYPE = 'inkwell-cosmetic';
export const OLD_SYNC_FORMAT = 'inkwell-sync';
export const OLD_SOUND_KEY = 'inkwellSound';
export const OLD_SOUNDSCAPE_KEY = 'inkwellSoundscape';

// class names that live inside saved chapter text
const OLD_CLASSES = /inkwell-(suggestion-ins|suggestion-del|comment-highlight|star-lit)/g;
export const upgradeClasses = (s: string) => s.replace(OLD_CLASSES, 'asterism-$1');

export const upgradeKey = (k: string) => (k.startsWith(OLD_PREFIX) ? NEW_PREFIX + k.slice(OLD_PREFIX.length) : k);

// the two browser databases, by old and new name
const OLD_DATABASES: Array<[string, string]> = [['inkwell-assets', 'asterism-assets'], ['inkwell-sync', 'asterism-sync']];

// copies one IndexedDB database, store by store, under a new name
async function copyDatabase(from: string, to: string): Promise<void> {
  const src = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(from);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    const names = Array.from(src.objectStoreNames);
    const stores = names.map(n => {
      const st = src.transaction(n, 'readonly').objectStore(n);
      return { name: n, keyPath: st.keyPath, autoIncrement: st.autoIncrement };
    });
    const rows: Record<string, Array<{ key: IDBValidKey; value: unknown }>> = {};
    for (const s of stores) {
      const st = src.transaction(s.name, 'readonly').objectStore(s.name);
      const keys = await new Promise<IDBValidKey[]>((res, rej) => { const r = st.getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const values = await new Promise<unknown[]>((res, rej) => { const r = st.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      rows[s.name] = keys.map((key, i) => ({ key, value: values[i] }));
    }
    const dst = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(to, src.version);
      req.onupgradeneeded = () => stores.forEach(s => req.result.createObjectStore(s.name, s.keyPath ? { keyPath: s.keyPath, autoIncrement: s.autoIncrement } : { autoIncrement: s.autoIncrement }));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = dst.transaction(stores.map(s => s.name), 'readwrite');
        stores.forEach(s => rows[s.name].forEach(r => (s.keyPath ? tx.objectStore(s.name).put(r.value) : tx.objectStore(s.name).put(r.value, r.key))));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { dst.close(); }
  } finally { src.close(); }
}

// run once at start. safe to run again: it only moves what is still under the old name, and never overwrites anything.
export async function migrateLegacyData(): Promise<void> {
  try {
    const old: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(OLD_PREFIX)) old.push(k); }
    for (const k of old) {
      const v = localStorage.getItem(k);
      const next = upgradeKey(k);
      try {
        if (v !== null && localStorage.getItem(next) === null) localStorage.setItem(next, upgradeClasses(v));
        localStorage.removeItem(k);
      } catch (e) { console.warn('Could not move saved data to its new name', k, e); }
    }
  } catch (e) { console.warn('Could not look for older saved data', e); }

  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
  try {
    const have = new Set((await indexedDB.databases()).map(d => d.name));
    for (const [from, to] of OLD_DATABASES) {
      if (!have.has(from) || have.has(to)) continue;
      try {
        await copyDatabase(from, to);
        indexedDB.deleteDatabase(from);
      } catch (e) { console.warn('Could not move a database to its new name', from, e); }
    }
  } catch (e) { console.warn('Could not look for older databases', e); }
}
