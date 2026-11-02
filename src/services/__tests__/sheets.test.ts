import { describe, expect, it } from 'vitest';
import { newSheet, rerollRow, rollSheet, setStarter, setStats, statRows } from '../sheets';

describe('sheets', () => {
  it('rolls classic, psych or both kinds of stats', () => {
    expect(statRows('none')).toHaveLength(0);
    expect(statRows('classic').map(r => r.label)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    expect(statRows('psych')).toHaveLength(6);
    expect(statRows('both')).toHaveLength(12);
  });

  it('swaps the stat rows and leaves the rest alone', () => {
    const sheet = newSheet('character');
    const fields = sheet.rows.filter(r => !r.key.startsWith('stat:'));
    const both = setStats(sheet, 'both');
    expect(both.rows.filter(r => r.key.startsWith('stat:'))).toHaveLength(12);
    expect(both.rows.filter(r => !r.key.startsWith('stat:'))).toEqual(fields);
    expect(setStats(both, 'none').rows).toEqual(fields);
  });

  it('keeps stats on the scale they use when rerolled', () => {
    let sheet = setStats(newSheet('character'), 'both');
    for (let i = 0; i < 40; i++) sheet = rerollRow(sheet, 'stat:Empathy');
    const v = Number(sheet.rows.find(r => r.key === 'stat:Empathy')!.value);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10);
  });

  it('rolls a scene with and without a starter', () => {
    const scene = newSheet('scene');
    expect(scene.rows.map(r => r.key)).toEqual(expect.arrayContaining(['who', 'what', 'where', 'when', 'why']));
    expect(setStarter(scene, 'none').rows.some(r => r.key === 'starter')).toBe(false);
    expect(rollSheet('scene', { ...scene, starter: 'any' }).rows.some(r => r.key === 'starter')).toBe(true);
  });
});
