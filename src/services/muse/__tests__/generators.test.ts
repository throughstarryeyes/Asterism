import { describe, it, expect } from 'vitest';
import * as g from '../generators';

// deterministic rng for repeatable tests.
const seeded = (seed = 1): g.Rng => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('muse content is fully ported', () => {
  it('has the bot data', () => {
    expect(g.PROMPTS.length).toBeGreaterThan(150);
    expect(g.TROPES.length).toBeGreaterThan(150);
    expect(g.NARRATION_STYLES.length).toBeGreaterThan(30);
    expect(g.AUTOPSY_PACKETS).toHaveLength(7);
    expect(g.FAULTLINES.length).toBeGreaterThan(20);
    expect(g.DESCENT_SEEDS.length).toBeGreaterThan(40);
    expect(g.WORDS.length).toBeGreaterThan(200);
  });
});

describe('generators', () => {
  it('builds a full character with every field', () => {
    const c = g.generateCharacter(seeded());
    g.CHARACTER_FIELDS.forEach(f => expect(c[f]).toBeTruthy());
  });
  it('builds a full setting', () => {
    const s = g.generateSetting(seeded());
    g.SETTING_FIELDS.forEach(f => expect(s[f]).toBeTruthy());
  });
  it('is deterministic for a given seed and varies across seeds', () => {
    expect(g.generateCharacter(seeded(5))).toEqual(g.generateCharacter(seeded(5)));
    expect(g.generateCharacter(seeded(5))).not.toEqual(g.generateCharacter(seeded(99)));
  });
  it('rolls stats in range', () => {
    const classic = g.generateStats('classic', seeded());
    expect(Object.keys(classic)).toEqual(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);
    Object.values(classic).forEach(v => { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(20); });
    const psych = g.generateStats('psych', seeded());
    Object.values(psych).forEach(v => { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(10); });
  });
  it('filters tropes by include and exclude tags', () => {
    for (let i = 1; i < 30; i++) {
      const t = g.pickTrope({ include: ['romance'], exclude: ['stakes'] }, seeded(i))!;
      expect(t.tags).toContain('romance');
      expect(t.tags).not.toContain('stakes');
    }
    expect(g.pickTrope({ include: ['no-such-tag'] })).toBeUndefined();
  });
  it('picks scene starters by goal and falls back for unknown goals', () => {
    expect(g.randomSceneStarter('bonding', seeded())!.goal).toBe('bonding');
    expect(g.randomSceneStarter('nonsense', seeded())).toBeDefined();
  });
  it('one-liners never pick the empty "any" tag', () => {
    expect(g.ONELINER_TAGS).not.toContain('any');
    expect(g.randomOneLiner(undefined, seeded())).toBeDefined();
  });
  it('makes valid hex palettes honoring count, hue and tone', () => {
    const p = g.generatePalette({ count: 4, hue: 'blue', tone: 'dark' }, seeded());
    expect(p).toHaveLength(4);
    p.forEach(c => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    expect(g.generatePalette({ rainbow: true, count: 2 })).toHaveLength(6);
    expect(g.generatePalette({ count: 99 })).toHaveLength(6);
    // dark black is very dark.
    const black = g.generatePalette({ hue: 'black' }, seeded());
    expect(parseInt(black[0].slice(1, 3), 16)).toBeLessThan(80);
  });
  it('builds a spark with every part', () => {
    const s = g.generateSpark(seeded(3));
    expect(s.character.desire).toBeTruthy();
    expect(s.setting.where).toBeTruthy();
    expect(s.scene && s.trope && s.narration).toBeTruthy();
    expect(s.words).toHaveLength(3);
    expect(s.palette).toHaveLength(3);
  });
});
