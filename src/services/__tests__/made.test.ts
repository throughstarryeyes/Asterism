import { describe, expect, it } from 'vitest';
import { MADE_KINDS, madeFields, madeKey, madeOf, parseMade } from '../made';
import { cleanTrail, planBit, bitFrames, spacing, PRESET_TRAILS, MAX_SPREAD, MAX_SIZE } from '../trails';
import { DEFAULT_CHIMES, NO_CHIME, PRESET_CHIMES, chimeFor, cleanChime, midiToHz, planChime, pruneChimes } from '../chimes';
import { cleanShape, findShape, shapeStyle, PRESET_SHAPES } from '../shapes';
import { PRESET_CURSORS, presetCursorCss } from '../cursors';
import { mergeExtras, parseExtras, serializeExtras, stamped, type Extras } from '../sync/extras';

const empty = (): Extras => ({ themes: [], sounds: [], images: {}, scapes: [], cursors: [], prefs: [], stamps: {} });

describe('pointer trails', () => {
  it('keeps a made-up trail inside what the animation can draw', () => {
    const t = cleanTrail({ id: 'custom-1', name: '', glyph: '<b>✦✧★🍃more</b>', size: 999, life: 1, spread: 999, motion: 'bogus' as never, rate: 9 as never, color: 'red' });
    expect(t.name).toBe('My trail');
    expect(Array.from(t.glyph).length).toBeLessThanOrEqual(3);
    expect(t.glyph).not.toMatch(/[<>&]/);
    expect(t.size).toBe(MAX_SIZE);
    expect(t.life).toBeGreaterThanOrEqual(300);
    expect(t.spread).toBe(MAX_SPREAD);
    expect(t.motion).toBe('float');
    expect(t.rate).toBe(2);
    expect(t.color).toBe('accent');
    expect(cleanTrail({ id: 'x', glyph: '   ' }).glyph).toBe('✦');
  });

  it('plans every bit inside its scatter and moves it the way the motion says', () => {
    PRESET_TRAILS.forEach(t => {
      const bit = planBit(t, () => 0.5);
      expect(Array.from(t.glyph)).toContain(bit.glyph);
      expect(Math.abs(bit.fromX)).toBeLessThanOrEqual(t.spread);
      expect(bitFrames(t, bit).length).toBeGreaterThanOrEqual(2);
    });
    const up = planBit({ ...PRESET_TRAILS[0], motion: 'float', spread: 0 }, () => 0.5);
    expect(up.toY).toBeLessThan(up.fromY);
    const down = planBit({ ...PRESET_TRAILS[0], motion: 'fall', spread: 0 }, () => 0.5);
    expect(down.toY).toBeGreaterThan(down.fromY);
  });

  it('spaces dense trails closer than sparse ones', () => {
    expect(spacing(3)).toBeLessThan(spacing(2));
    expect(spacing(2)).toBeLessThan(spacing(1));
  });
});

describe('pointers', () => {
  it('draws every pointer as a picture, and leaves the default to the browser', () => {
    expect(presetCursorCss(PRESET_CURSORS[0])).toBe('auto');
    PRESET_CURSORS.slice(1).forEach(c => expect(presetCursorCss(c)).toMatch(/^url\("data:image\/svg\+xml,.+"\) \d+ \d+, auto$/));
  });
});

describe('chimes', () => {
  it('always has a note to play, kept in a range that sounds', () => {
    const c = cleanChime({ id: 'x', notes: [0, 0, 5, 200, 72.4], gap: 99, decay: 0, wave: 'bogus' as never });
    expect(c.notes).toEqual([0, 0, 72]);
    expect(cleanChime({ id: 'y', notes: [0, 0] }).notes.some(n => n > 0)).toBe(true);
    expect(cleanChime({ id: 'z', notes: Array(20).fill(60) }).notes).toHaveLength(8);
    expect(c.wave).toBe('sine');
    expect(c.gap).toBeLessThanOrEqual(0.5);
  });

  it('plays rests as silence and notes in order', () => {
    const plan = planChime({ id: 'x', name: 'x', notes: [69, 0, 81], gap: 0.1, decay: 0.5, wave: 'sine' });
    expect(plan).toHaveLength(2);
    expect(plan[0].freq).toBeCloseTo(440);
    expect(plan[1].start).toBeCloseTo(0.2);
    expect(midiToHz(81)).toBeCloseTo(880);
  });

  it('plays only the sprint chime until others are picked, and honors silence', () => {
    expect(chimeFor('sprint', undefined)?.id).toBe(DEFAULT_CHIMES.sprint);
    expect(chimeFor('goal', undefined)).toBeUndefined();
    expect(chimeFor('badge', { badge: PRESET_CHIMES[1].id })?.id).toBe(PRESET_CHIMES[1].id);
    expect(chimeFor('sprint', { sprint: NO_CHIME })).toBeUndefined();
  });

  it('drops choices that point at a deleted chime', () => {
    expect(pruneChimes({ sprint: 'custom-1', goal: 'bell' }, id => id !== 'custom-1')).toEqual({ goal: 'bell' });
  });
});

describe('comment shapes', () => {
  it('sets nothing for the plain shape so cards keep the theme look', () => {
    expect(shapeStyle(findShape('plain'))).toBeNull();
    PRESET_SHAPES.slice(1).forEach(s => expect(shapeStyle(s)?.vars['--cs-radius']).toBe(`${s.radius}px`));
  });

  it('keeps a made-up shape inside the options the stylesheet knows', () => {
    const s = cleanShape({ id: 'x', radius: 500, tilt: 40, border: 'bogus' as never, bar: 'bogus' as never, corner: 'bogus' as never, mark: 'bogus' as never, color: 'url(x)' });
    expect(s.radius).toBe(28);
    expect(s.tilt).toBe(3);
    expect([s.border, s.bar, s.corner, s.mark, s.color]).toEqual(['solid', 'none', 'none', 'highlight', 'accent']);
  });
});

describe('things the writer made travel between devices', () => {
  it('carries every kind through a sync, newest copy winning', () => {
    const trail = cleanTrail({ id: 'custom-t', name: 'Mine', glyph: '✦' });
    const older: Extras = { ...empty(), made: { trail: [trail] }, stamps: stamped({}, madeKey('trail', 'custom-t'), false, 100) };
    const newer: Extras = { ...empty(), made: { trail: [{ ...trail, name: 'Renamed' }] }, stamps: stamped({}, madeKey('trail', 'custom-t'), false, 200) };
    expect(mergeExtras(older, newer).made?.trail?.[0]).toMatchObject({ name: 'Renamed' });
    expect(mergeExtras(newer, older).made?.trail?.[0]).toMatchObject({ name: 'Renamed' });
  });

  it('carries a deletion over, and fills in what the other side lacks', () => {
    const shape = cleanShape({ id: 'custom-s', name: 'Mine' });
    const has: Extras = { ...empty(), made: { shape: [shape] }, stamps: stamped({}, madeKey('shape', 'custom-s'), false, 100) };
    const gone: Extras = { ...empty(), made: { shape: [] }, stamps: stamped({}, madeKey('shape', 'custom-s'), true, 200) };
    expect(mergeExtras(has, gone).made?.shape).toEqual([]);
    expect(mergeExtras(empty(), has).made?.shape).toHaveLength(1);
  });

  it('reads and writes the same text, and ignores items without an id', () => {
    const chime = cleanChime({ id: 'custom-c', name: 'Tune' });
    const e: Extras = { ...empty(), made: { chime: [chime] } };
    const back = parseExtras(serializeExtras(e))!;
    expect(back.made?.chime).toEqual([chime]);
    expect(serializeExtras(back)).toBe(serializeExtras(e));
    expect(parseMade({ loader: [{ name: 'no id' }, { id: 'custom-1' }], trail: 'oops' }).loader).toHaveLength(1);
    expect(parseMade({ trail: 'oops' }).trail).toEqual([]);
    expect(parseMade(null).chime).toEqual([]);
  });

  it('an old extras file without made items still reads', () => {
    const old = JSON.stringify({ themes: [], sounds: [], images: {}, stamps: {} });
    expect(parseExtras(old)?.made).toBeDefined();
  });

  it('puts the setting back when what it picked was deleted elsewhere', () => {
    const patch = madeFields({ trail: [] }, { activeTrail: 'custom-9', activeShape: 'bubble' });
    expect(patch.activeTrail).toBe('none');
    expect(patch.activeShape).toBeUndefined();
    expect(madeFields({ trail: [{ id: 'custom-9' }] }, { activeTrail: 'custom-9' }).activeTrail).toBeUndefined();
  });

  it('lists every kind from stats', () => {
    expect(Object.keys(madeOf({}))).toEqual(MADE_KINDS);
  });
});
