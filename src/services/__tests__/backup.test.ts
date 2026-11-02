import { describe, it, expect } from 'vitest';
import { parseBackup, isBackupKey, fromBase64, BACKUP_TYPE, BACKUP_VERSION } from '../backup';

const file = (over: Record<string, unknown> = {}) => JSON.stringify({ type: BACKUP_TYPE, version: 1, made: '2026-10-29', data: { asterism_user_stats: '{}' }, assets: [], ...over });

describe('backup files', () => {
  it('keeps our own keys and leaves out this device\'s sync identity', () => {
    expect(isBackupKey('asterism_user_stats')).toBe(true);
    expect(isBackupKey('asterism_versions_proj-1')).toBe(true);
    expect(isBackupKey('asterism_sync_device')).toBe(false);
    expect(isBackupKey('asterism_sync_links')).toBe(false);
    expect(isBackupKey('someone_else')).toBe(false);
  });
  it('reads a good file', () => {
    const r = parseBackup(file());
    expect(r.ok).toBe(true);
  });
  it('refuses what is not a backup', () => {
    expect(parseBackup('nope').ok).toBe(false);
    expect(parseBackup('{"hello":1}').ok).toBe(false);
    expect(parseBackup(file({ type: 'other' })).ok).toBe(false);
  });
  it('refuses a backup from a newer app, and one with nothing in it', () => {
    const newer = parseBackup(file({ version: BACKUP_VERSION + 1 }));
    expect(newer.ok === false && newer.error).toMatch(/newer/);
    expect(parseBackup(file({ data: {} })).ok).toBe(false);
  });
  it('drops keys that are not ours, non-text values and broken assets', () => {
    const r = parseBackup(file({ data: { asterism_user_stats: '{}', evil: 'x', asterism_sync_device: 'x', asterism_trash: 5 }, assets: [{ id: 'a', type: 'image/png', data: 'AA==' }, { id: 3 }, null] }));
    expect(r.ok && Object.keys(r.backup.data)).toEqual(['asterism_user_stats']);
    expect(r.ok && r.backup.assets.length).toBe(1);
  });
  it('turns base64 back into the same bytes', async () => {
    const b = fromBase64(btoa('hi!'), 'text/plain');
    expect(await b.text()).toBe('hi!');
    expect(b.type).toBe('text/plain');
  });
});
