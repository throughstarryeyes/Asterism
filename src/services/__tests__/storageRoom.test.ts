import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveHistory, setWithRoom, VERSIONS_BUDGET } from '../storageRoom';

// a pretend browser storage that is full once it holds this many characters, as the real one is at about 5 MB
function fakeStorage(limit: number) {
  const data = new Map<string, string>();
  const total = () => [...data.values()].reduce((a, v) => a + v.length, 0);
  const api = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { if (total() - (data.get(k)?.length ?? 0) + v.length > limit) throw new DOMException('full', 'QuotaExceededError'); data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  return new Proxy(api, { ownKeys: () => [...data.keys()], getOwnPropertyDescriptor: (_t, k) => (data.has(String(k)) ? { enumerable: true, configurable: true, value: data.get(String(k)) } : undefined) });
}

const version = (n: number, size: number) => ({ id: `v${n}`, text: 'x'.repeat(size) });

describe('when the browser storage runs short', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', fakeStorage(1000)); });

  it('writes normally when there is room', () => {
    expect(setWithRoom('a', 'hello')).toBe(true);
    expect(localStorage.getItem('a')).toBe('hello');
  });

  it('lets old versions go so the document itself can be saved', () => {
    localStorage.setItem('asterism_versions_p1', JSON.stringify(Array.from({ length: 6 }, (_, i) => version(i, 100))));
    expect(setWithRoom('asterism_active_project', 'd'.repeat(500))).toBe(true);
    const kept = JSON.parse(localStorage.getItem('asterism_versions_p1')!) as Array<{ id: string }>;
    expect(kept.length).toBeLessThan(6);
    expect(kept[0].id).toBe('v0'); // the newest stays
  });

  it('keeps as many versions as fit, newest first', () => {
    const versions = Array.from({ length: 10 }, (_, i) => version(i, 120));
    const kept = saveHistory('asterism_versions_p1', versions);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(10);
    expect(kept[0].id).toBe('v0');
    expect(JSON.parse(localStorage.getItem('asterism_versions_p1')!)).toEqual(kept);
  });

  it('keeps at least the newest version, even when it barely fits', () => {
    const kept = saveHistory('asterism_versions_p1', [version(0, 600), version(1, 600)]);
    expect(kept.map(v => v.id)).toEqual(['v0']);
  });

  it('holds one project\'s history to a budget', () => {
    vi.stubGlobal('localStorage', fakeStorage(50_000_000));
    const versions = Array.from({ length: 50 }, (_, i) => version(i, 100_000));
    const kept = saveHistory('asterism_versions_p1', versions);
    expect(JSON.stringify(kept).length).toBeLessThanOrEqual(VERSIONS_BUDGET);
    expect(kept.length).toBeGreaterThan(5);
  });
});
