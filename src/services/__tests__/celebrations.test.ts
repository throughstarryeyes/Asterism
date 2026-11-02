import { describe, expect, it } from 'vitest';
import { EFFECTS, PRESET_CELEBRATIONS, cleanCelebration, findCelebration, planCelebration, type Effect } from '../celebrations';
import { cleanCardCover, coverFor, coverPaint, findCover } from '../looks';
import { MAKE_COST } from '../shop';
import { CUSTOM_THEME_COST } from '../customTheme';
import { MADE } from '../made';

const fixed = () => 0.5;

describe('celebrations', () => {
  it('plans something for every effect', () => {
    (Object.keys(EFFECTS) as Effect[]).forEach(effect => {
      const steps = planCelebration({ ...PRESET_CELEBRATIONS[0], effect }, fixed);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.every(s => s.at >= 0 && s.puff.particleCount >= 1)).toBe(true);
    });
  });

  it('the classic style is one burst at once, as it always was', () => {
    const steps = planCelebration(findCelebration('classic'), fixed);
    expect(steps).toHaveLength(1);
    expect(steps[0].at).toBe(0);
    expect(steps[0].puff.particleCount).toBe(50);
  });

  it('a shooting star is a streak of small steps that ends in a glint', () => {
    const steps = planCelebration(findCelebration('shooting'), fixed);
    expect(steps.length).toBeGreaterThan(10);
    expect(steps[0].puff.origin.x).not.toBe(steps[steps.length - 2].puff.origin.x);
    expect(steps[steps.length - 1].puff.spread).toBe(360);
  });

  it('more means more particles', () => {
    const count = (amount: 1 | 2 | 3) => planCelebration({ ...findCelebration('classic'), amount }, fixed)[0].puff.particleCount;
    expect(count(1)).toBeLessThan(count(2));
    expect(count(2)).toBeLessThan(count(3));
  });

  it('cleans what it is given', () => {
    const c = cleanCelebration({ id: 'x', name: '<b>Hi</b>', shapes: ['star', 'star', '❄', 'ab', '<', 'circle', 'square', '♥'], colors: ['#ABCDEF', 'red'], effect: 'nope' as Effect, amount: 9 as 1, size: 3 });
    expect(c.shapes).toEqual(['star', '❄', 'circle', 'square']);
    expect(c.colors).toEqual(['#abcdef']);
    expect(c.effect).toBe('burst');
    expect(c.amount).toBe(2);
    expect(c.name).toBe('bHi/b');
    expect(cleanCelebration({ id: 'y' }).shapes.length).toBeGreaterThan(0);
  });

  it('falls back to classic for an unknown style', () => {
    expect(findCelebration('custom-gone').id).toBe('classic');
    expect(findCelebration('custom-1', [{ ...PRESET_CELEBRATIONS[1], id: 'custom-1' }]).id).toBe('custom-1');
  });
});

describe('made covers and making your own', () => {
  it('a made cover is found by id and painted from its layers', () => {
    const mine = cleanCardCover({ id: 'custom-1', name: 'Mine', look: { material: 'cork' }, ink: '#ABCDEF', glyph: '✦' });
    expect(mine.ink).toBe('#abcdef');
    expect(findCover('custom-1', [mine]).glyph).toBe('✦');
    expect(findCover('custom-1').id).toBe('plain');
    expect(coverPaint(findCover('custom-1', [mine])).backgroundImage).toContain('gradient');
    expect(coverFor({ coverStyle: 'custom-1' }, 'leather', [mine]).id).toBe('custom-1');
    expect(coverPaint(findCover('leather')).background).toContain('gradient');
  });

  it('every kind of thing the writer makes syncs and falls back when deleted', () => {
    expect(MADE.cover.worn).toEqual({ field: 'activeCover', fallback: 'plain' });
    expect(MADE.celebration.worn).toEqual({ field: 'activeCelebration', fallback: 'classic' });
  });

  it('making your own costs the same as a theme', () => {
    expect(MAKE_COST).toBe(75);
    expect(MAKE_COST).toBe(CUSTOM_THEME_COST);
  });
});
