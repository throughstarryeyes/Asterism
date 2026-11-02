import { describe, expect, it } from 'vitest';
import { MAX_COLORS, SCHEMES, STARTER_PALETTES, bestText, cleanPalette, dominantColors, harmony, hexToHsl, hslToHex, shuffle, themeFromPalette, toCssVars, toHexList } from '../palettes';
import { contrastRatio } from '../customTheme';
import { parseMade, madeKey } from '../made';
import { mergeExtras, stamped, type Extras } from '../sync/extras';

const HEX = /^#[0-9a-f]{6}$/;

describe('color math', () => {
  it('goes from hex to hsl and back', () => {
    ['#c9622b', '#0b3d5c', '#ffffff', '#000000', '#7f7f7f', '#ff00aa'].forEach(c => {
      const back = hslToHex(hexToHsl(c));
      // rounding to whole degrees and percents moves a color a little, never far
      const d = (a: string, b: string) => [1, 3, 5].reduce((n, i) => n + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
      expect(d(c, back), c).toBeLessThan(14);
    });
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 });
    expect(hslToHex({ h: 120, s: 100, l: 50 })).toBe('#00ff00');
  });

  it('picks the text that can be read on a color', () => {
    expect(bestText('#ffffff')).toBe('#111111');
    expect(bestText('#000000')).toBe('#ffffff');
    expect(bestText('#0b3d5c')).toBe('#ffffff');
    expect(bestText('#f6e1b6')).toBe('#111111');
  });
});

describe('harmonies', () => {
  it.each(SCHEMES.map(s => [s.id] as const))('%s gives the number asked for, starting with the base', id => {
    for (const n of [2, 3, 5, 8]) {
      const out = harmony('#c9622b', id, n);
      expect(out).toHaveLength(n);
      out.forEach(c => expect(c).toMatch(HEX));
      if (id !== 'monochrome') expect(out[0]).toBe(hslToHex(hexToHsl('#c9622b')));
    }
  });

  it('keeps the count in range', () => {
    expect(harmony('#336699', 'triadic', 99)).toHaveLength(MAX_COLORS);
    expect(harmony('#336699', 'triadic', 0).length).toBeGreaterThanOrEqual(2);
  });

  it('puts the opposite hue in the complementary palette', () => {
    const [a, b] = harmony('#ff0000', 'complementary', 2);
    expect(hexToHsl(a).h).toBe(0);
    expect(hexToHsl(b).h).toBe(180);
  });

  it('runs a monochrome palette from light to dark in one hue', () => {
    const out = harmony('#2288cc', 'monochrome', 5);
    const lights = out.map(c => hexToHsl(c).l);
    expect(lights).toEqual([...lights].sort((x, y) => y - x));
    out.forEach(c => expect(Math.abs(hexToHsl(c).h - hexToHsl('#2288cc').h)).toBeLessThanOrEqual(3));
  });
});

describe('shuffling', () => {
  it('leaves the kept colors exactly as they were', () => {
    const colors = ['#112233', '#445566', '#778899', '#aabbcc', '#ddeeff'];
    const out = shuffle(colors, [true, false, false, true, false], () => 0.37);
    expect(out[0]).toBe('#112233');
    expect(out[3]).toBe('#aabbcc');
    expect(out).toHaveLength(5);
    out.forEach(c => expect(c).toMatch(HEX));
  });

  it('makes something new when nothing is kept', () => {
    const colors = ['#112233', '#445566', '#778899'];
    expect(shuffle(colors, [false, false, false], () => 0.8)).not.toEqual(colors);
  });
});

describe('colors from a picture', () => {
  const solid = (rgb: [number, number, number], px: number) => Array.from({ length: px }, () => [...rgb, 255]).flat();

  it('finds the colors a picture is mostly made of, most common first', () => {
    const data = [...solid([200, 30, 30], 400), ...solid([20, 20, 200], 200), ...solid([30, 180, 40], 100)];
    const out = dominantColors(data, 3);
    expect(out).toHaveLength(3);
    expect(hexToHsl(out[0]).h).toBeLessThan(15);
    expect(hexToHsl(out[1]).h).toBeGreaterThan(200);
  });

  it('does not list five shades of one color', () => {
    const data = [...solid([200, 30, 30], 300), ...solid([205, 35, 30], 300), ...solid([195, 30, 35], 300), ...solid([20, 20, 200], 100)];
    expect(dominantColors(data, 4).length).toBeLessThanOrEqual(2);
  });

  it('ignores see-through pixels and copes with nothing', () => {
    expect(dominantColors([255, 0, 0, 0, 255, 0, 0, 0], 3)).toEqual([]);
    expect(dominantColors([], 3)).toEqual([]);
  });
});

describe('keeping palettes', () => {
  it('cleans what it is given', () => {
    const p = cleanPalette({ id: 'custom-pal-1', name: '<b>x</b>', colors: ['#ABCDEF', 'red', '#123', '#000000'], notes: 'n'.repeat(900), projectId: 'p1' });
    expect(p.name).toBe('bx/b');
    expect(p.colors).toEqual(['#abcdef', '#000000']);
    expect(p.notes).toHaveLength(600);
    expect(p.projectId).toBe('p1');
    expect(cleanPalette({ id: 'x', colors: ['#111111'] }).colors.length).toBeGreaterThanOrEqual(2);
    expect(cleanPalette({ id: 'x' }).projectId).toBeUndefined();
  });

  it('writes the colors out as a list and as css', () => {
    expect(toHexList(['#aabbcc', '#112233'])).toBe('#AABBCC\n#112233');
    expect(toCssVars(['#aabbcc', '#112233'])).toContain('--color-2: #112233;');
  });

  it('ships starter palettes that are all valid', () => {
    STARTER_PALETTES.forEach(p => { expect(p.colors.length).toBeGreaterThanOrEqual(2); p.colors.forEach(c => expect(c).toMatch(HEX)); });
  });

  it('syncs between devices like everything else the writer makes', () => {
    const pal = cleanPalette({ id: 'custom-pal-1', name: 'Mine', colors: ['#112233', '#445566'] });
    const empty: Extras = { themes: [], sounds: [], images: {}, scapes: [], cursors: [], prefs: [], stamps: {} };
    const has: Extras = { ...empty, made: { palette: [pal] }, stamps: stamped({}, madeKey('palette', pal.id), false, 100) };
    expect(mergeExtras(empty, has).made?.palette).toEqual([pal]);
    expect(parseMade({ palette: [pal, { name: 'no id' }] }).palette).toEqual([pal]);
  });
});

describe('a theme from a palette', () => {
  const sets = [...STARTER_PALETTES.map(p => p.colors), ['#ff5d8f', '#ffb347', '#ffe66d', '#4ecdc4', '#6a4c93'], ['#777777', '#808080', '#888888']];

  it.each(sets.map((c, i) => [i, c] as const))('palette %i makes a theme you can read, light and dark', (_i, colors) => {
    for (const dark of [false, true]) {
      const t = themeFromPalette(colors, { name: 'T', dark });
      expect(contrastRatio(t.textMain, t.bgPaper), `${dark ? 'dark' : 'light'} text`).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(t.textSecondary, t.bgPaper), 'secondary').toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.accentPrimary, t.bgPaper), 'accent').toBeGreaterThanOrEqual(3);
      [t.bgApp, t.bgPaper, t.textMain, t.accentPrimary, t.accentGold, t.borderSubtle, t.borderStrong].forEach(c => expect(c).toMatch(HEX));
    }
  });

  it('is dark or light as asked', () => {
    const colors = STARTER_PALETTES[0].colors;
    const lum = (hex: string) => hexToHsl(hex).l;
    expect(lum(themeFromPalette(colors, { name: 'a', dark: true }).bgPaper)).toBeLessThan(35);
    expect(lum(themeFromPalette(colors, { name: 'a', dark: false }).bgPaper)).toBeGreaterThan(70);
  });
});
