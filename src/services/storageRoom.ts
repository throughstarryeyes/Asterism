// the browser keeps about 5 MB for the whole site. a long manuscript, with a history of full copies of it, can fill that, and then saving
// fails. the document matters more than its history, so when a save does not fit, old versions are let go (newest kept) and it is tried again.

const VERSIONS = 'asterism_versions_';
// no one project's history may take more than this
export const VERSIONS_BUDGET = 2_400_000;

// tries to write; if the storage is full, trims every project's history to its newest few versions and tries again
export function setWithRoom(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { /* probably full */ }
  for (const keep of [8, 3, 1]) {
    trimHistories(keep, key);
    try { localStorage.setItem(key, value); return true; } catch { /* still full */ }
  }
  return false;
}

function trimHistories(keep: number, except: string): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(VERSIONS) || k === except) continue;
      const list = JSON.parse(localStorage.getItem(k) ?? '[]') as unknown[];
      if (Array.isArray(list) && list.length > keep) localStorage.setItem(k, JSON.stringify(list.slice(0, keep)));
    }
  } catch { /* leave them as they are */ }
}

// saves a project's history (newest first), letting the oldest go as needed to stay within its budget and the space there is
export function saveHistory<T>(key: string, versions: T[]): T[] {
  let list = versions;
  let json = JSON.stringify(list);
  while (json.length > VERSIONS_BUDGET && list.length > 1) { list = list.slice(0, -1); json = JSON.stringify(list); }
  for (;;) {
    if (setWithRoom(key, json)) return list;
    if (list.length <= 1) return list;
    list = list.slice(0, Math.max(1, Math.floor(list.length / 2)));
    json = JSON.stringify(list);
  }
}
