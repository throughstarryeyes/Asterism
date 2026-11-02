import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateLegacyData, upgradeClasses, upgradeKey } from '../legacy';
import { parseBackup } from '../backup';
import { parseShared } from '../shareMade';
import { isSyncDoc, SYNC_FORMAT } from '../sync/engine';
import { parseSoundFile } from '../soundRecipes';

describe('data and files from before the rename', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
      key: (i: number) => Array.from(data.keys())[i] ?? null,
      get length() { return data.size; },
      clear: () => data.clear(),
    });
  });

  it('renames keys and the class names saved inside chapter text', () => {
    expect(upgradeKey('inkwell_user_stats')).toBe('asterism_user_stats');
    expect(upgradeKey('inkwell_versions_proj-1')).toBe('asterism_versions_proj-1');
    expect(upgradeKey('something_else')).toBe('something_else');
    expect(upgradeClasses('<ins class="inkwell-suggestion-ins">a</ins><span class="inkwell-comment-highlight">b</span>'))
      .toBe('<ins class="asterism-suggestion-ins">a</ins><span class="asterism-comment-highlight">b</span>');
    expect(upgradeClasses('an inkwell-other thing')).toBe('an inkwell-other thing');
  });

  it('moves saved data to the new keys once, without overwriting anything newer', async () => {
    localStorage.setItem('inkwell_user_stats', '{"quillPoints":5}');
    localStorage.setItem('inkwell_projects_library', '[{"c":"<ins class=\\"inkwell-suggestion-ins\\">x</ins>"}]');
    localStorage.setItem('inkwell_trash', '[]');
    localStorage.setItem('asterism_trash', '["newer"]');
    await migrateLegacyData();
    expect(localStorage.getItem('asterism_user_stats')).toBe('{"quillPoints":5}');
    expect(localStorage.getItem('asterism_projects_library')).toContain('asterism-suggestion-ins');
    expect(localStorage.getItem('asterism_trash')).toBe('["newer"]');
    expect(localStorage.getItem('inkwell_user_stats')).toBeNull();
    expect(localStorage.getItem('inkwell_trash')).toBeNull();
    await migrateLegacyData();
    expect(localStorage.getItem('asterism_user_stats')).toBe('{"quillPoints":5}');
  });

  it('still opens a backup made under the old name', () => {
    const old = JSON.stringify({ type: 'inkwell-backup', version: 1, made: '2026-10-29', data: { inkwell_user_stats: '{}', inkwell_sync_device: 'x', inkwell_projects_library: '<span class="inkwell-comment-highlight"></span>' }, assets: [] });
    const r = parseBackup(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.backup.data).sort()).toEqual(['asterism_projects_library', 'asterism_user_stats']);
      expect(r.backup.data.asterism_projects_library).toContain('asterism-comment-highlight');
    }
  });

  it('still reads old shared cosmetics, sync files and sound files', () => {
    expect('error' in parseShared(JSON.stringify({ type: 'inkwell-cosmetic', version: 1, kind: 'trail', item: { name: 'x' } }))).toBe(false);
    const doc = { format: 'inkwell-sync', version: 1, revision: 1, project: {}, projectId: 'p' };
    expect(isSyncDoc(doc)).toBe(true);
    expect(isSyncDoc({ ...doc, format: SYNC_FORMAT })).toBe(true);
    expect(isSyncDoc({ ...doc, format: 'other' })).toBe(false);
    expect(parseSoundFile(JSON.stringify({ inkwellSound: 1, sound: { id: 'a', name: 'a' } }))).not.toBe(undefined);
  });
});
