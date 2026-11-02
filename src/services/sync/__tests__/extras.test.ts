import { describe, it, expect } from 'vitest';
import { mergeExtras, parseExtras, scapeKey, serializeExtras, stampChanges, type Extras } from '../extras';

const base: Extras = { themes: [], sounds: [], images: {}, scapes: [], cursors: [], prefs: [], stamps: {} };
const scape = (id: string, name: string) => ({ id, name, layers: [{ kind: 'noise' as const, color: 'pink' as const, filter: 'none' as const, freq: 1000, q: 1, volume: 0.5, pan: 0, motion: { target: 'volume' as const, rate: 0.1, depth: 0 } }] });
const pref = (id: string, enabled = true) => ({ id, check: 'where-knows', scope: 'global' as const, enabled, createdAt: '2026-10-28T00:00:00.000Z' });
const cursor = (id: string) => ({ id, name: 'Pen', assetId: `cur-${id}`, width: 32, height: 32, hotX: 0, hotY: 0 });

describe('stamping changes', () => {
  it('stamps new and edited items and marks removed ones gone', () => {
    const before = [{ id: 'a', n: 1 }, { id: 'b', n: 1 }, { id: 'c', n: 1 }];
    const after = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'd', n: 1 }];
    const s = stampChanges({}, k => `k:${k}`, before, after, 50);
    expect(s).toEqual({ 'k:b': { at: 50 }, 'k:d': { at: 50 }, 'k:c': { at: 50, gone: true } });
  });
});

describe('syncing soundscapes, cursors and analyzer preferences', () => {
  it('newer edits win and deletions carry over', () => {
    const mine: Extras = { ...base, scapes: [scape('scape-a', 'Old'), scape('scape-b', 'Keep')], stamps: { [scapeKey('scape-a')]: { at: 1 }, [scapeKey('scape-b')]: { at: 1 } } };
    const theirs: Extras = { ...base, scapes: [scape('scape-a', 'New')], stamps: { [scapeKey('scape-a')]: { at: 5 }, [scapeKey('scape-b')]: { at: 4, gone: true } } };
    const merged = mergeExtras(mine, theirs);
    expect(merged.scapes.map(s => s.name)).toEqual(['New']);
  });

  it('combines cursors and preferences from both sides', () => {
    const merged = mergeExtras({ ...base, cursors: [cursor('cursor-1')], prefs: [pref('p1')] }, { ...base, cursors: [cursor('cursor-2')], prefs: [pref('p2')] });
    expect(merged.cursors.map(c => c.id).sort()).toEqual(['cursor-1', 'cursor-2']);
    expect(merged.prefs.map(p => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('survives a round trip and drops junk', () => {
    const full: Extras = { ...base, scapes: [scape('scape-a', 'Rain')], cursors: [cursor('cursor-1')], prefs: [pref('p1')] };
    const back = parseExtras(serializeExtras(full))!;
    expect(back.scapes.map(s => s.name)).toEqual(['Rain']);
    expect(back.cursors).toHaveLength(1);
    expect(back.prefs).toHaveLength(1);
    const junk = parseExtras(JSON.stringify({ scapes: [{ nope: 1 }], cursors: [7], prefs: [{ id: 'x', scope: 'project' }] }))!;
    expect(junk.scapes).toEqual([]);
    expect(junk.cursors).toEqual([]);
    expect(junk.prefs).toEqual([]);
  });

  it('an old extras file without the new lists still reads', () => {
    const old = parseExtras(JSON.stringify({ themes: [], sounds: [], images: {}, stamps: {} }))!;
    expect(old.scapes).toEqual([]);
    expect(old.prefs).toEqual([]);
  });
});
