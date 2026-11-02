import { describe, expect, it } from 'vitest';
import { GRADIENT_PRESETS, MATERIALS, STAR_LEVELS, cleanGradient, cleanLook, cssGradient, glassVars, hasBackdrop, joinLayers, lookLayers, type Look } from '../backdrops';
import { THEME_PRESETS, findThemePreset, presetCopy } from '../themePresets';
import { contrastRatio } from '../customTheme';
import { CATALOG } from '../shop';

// how many comma-separated values a css list holds, ignoring commas inside brackets
function items(list: string): number {
  let depth = 0, n = 1;
  for (const ch of list) { if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ',' && depth === 0) n++; }
  return n;
}

const everyLook: Look[] = [
  { gradient: GRADIENT_PRESETS[0].gradient },
  ...MATERIALS.map(m => ({ material: m.id })),
  ...STAR_LEVELS.map(([stars]) => ({ stars })),
  { gradient: GRADIENT_PRESETS[1].gradient, material: 'wood', stars: 'many' as const },
];

describe('gradients', () => {
  it('keeps good colors and positions, in order', () => {
    const g = cleanGradient({ kind: 'radial', angle: 999, stops: [{ color: '#FFAA00', at: 90 }, { color: '#001122', at: -5 }, { color: 'red', at: 50 }] })!;
    expect(g.kind).toBe('radial');
    expect(g.angle).toBe(360);
    expect(g.stops).toEqual([{ color: '#001122', at: 0 }, { color: '#ffaa00', at: 90 }]);
  });

  it('needs two colors to be a gradient, and stops at six', () => {
    expect(cleanGradient({ stops: [{ color: '#112233', at: 0 }] })).toBeUndefined();
    expect(cleanGradient(null)).toBeUndefined();
    const many = cleanGradient({ stops: Array.from({ length: 12 }, (_, i) => ({ color: '#112233', at: i * 8 })) })!;
    expect(many.stops).toHaveLength(6);
  });

  it('writes css the browser reads', () => {
    expect(cssGradient({ kind: 'linear', angle: 90, stops: [{ color: '#111111', at: 0 }, { color: '#ffffff', at: 100 }] })).toBe('linear-gradient(90deg, #111111 0%, #ffffff 100%)');
    expect(cssGradient({ kind: 'radial', angle: 0, stops: [{ color: '#111111', at: 0 }, { color: '#ffffff', at: 100 }] })).toMatch(/^radial-gradient\(/);
  });

  it('has presets that all clean to themselves', () => {
    GRADIENT_PRESETS.forEach(p => expect(cleanGradient(p.gradient), p.id).toEqual(p.gradient));
  });
});

describe('looks', () => {
  it('drops everything it does not know', () => {
    expect(cleanLook({ material: 'lava', stars: 'galaxy', glass: 0, gradient: 'blue' })).toBeUndefined();
    expect(cleanLook({ material: 'wood', stars: 'few', glass: 3 })).toEqual({ material: 'wood', stars: 'few', glass: 1 });
    expect(cleanLook(null)).toBeUndefined();
  });

  it('knows when there is something to draw behind', () => {
    expect(hasBackdrop(undefined)).toBe(false);
    expect(hasBackdrop({ glass: 0.5 })).toBe(false);
    expect(hasBackdrop({ stars: 'few' })).toBe(true);
  });

  it('puts stars over a material over a gradient', () => {
    const layers = lookLayers({ stars: 'few', material: 'water', gradient: GRADIENT_PRESETS[0].gradient });
    const last = layers[layers.length - 1];
    expect(last.image).toMatch(/^linear-gradient/);
    expect(layers[0].image).toContain('rgba(255, 255, 255');
  });

  it.each(everyLook.map((l, i) => [i, l] as const))('look %i gives one size, repeat and position for every image', (_i, look) => {
    const j = joinLayers(lookLayers(look));
    const n = items(j.image);
    expect(items(j.size)).toBe(n);
    expect(items(j.repeat)).toBe(n);
    expect(items(j.position)).toBe(n);
  });

  it('makes a page see-through only when asked', () => {
    expect(glassVars(undefined, '#ffffff')).toBeNull();
    expect(glassVars({ glass: 0 }, '#ffffff')).toBeNull();
    const half = glassVars({ glass: 0.5 }, '#ffffff')!;
    const full = glassVars({ glass: 1 }, '#ffffff')!;
    expect(half.bg).toMatch(/^rgba\(255, 255, 255, 0\.\d+\)$/);
    const alpha = (c: string) => Number(c.match(/, ([\d.]+)\)$/)![1]);
    expect(alpha(full.bg)).toBeLessThan(alpha(half.bg));
    expect(parseInt(full.blur)).toBeGreaterThan(parseInt(half.blur));
  });
});

describe('themes from the shop', () => {
  it('have unique ids and sensible prices', () => {
    expect(new Set(THEME_PRESETS.map(t => t.id)).size).toBe(THEME_PRESETS.length);
    THEME_PRESETS.forEach(t => { expect(t.cost).toBeGreaterThanOrEqual(30); expect(t.theme.id).toBe(`preset-${t.id}`); });
  });

  it('cover what was asked for: summer, winter, autumn, spring, dawn, dusk, midnight and the holidays', () => {
    const groups = new Set(THEME_PRESETS.map(t => t.group));
    ['Summer', 'Winter', 'Autumn', 'Spring', 'Skies', 'Holidays', 'Materials', 'Glass'].forEach(g => expect(groups.has(g), g).toBe(true));
    ['dawn', 'dusk', 'midnight', 'christmas', 'new-year'].forEach(id => expect(findThemePreset(id), id).toBeDefined());
    expect(THEME_PRESETS.filter(t => t.group === 'Summer')).toHaveLength(2);
    expect(THEME_PRESETS.filter(t => t.group === 'Winter')).toHaveLength(2);
    expect(THEME_PRESETS.filter(t => t.group === 'Autumn')).toHaveLength(2);
    expect(THEME_PRESETS.filter(t => t.id.includes('pumpkin') || t.id === 'haunted')).toHaveLength(2);
  });

  it.each(THEME_PRESETS.map(t => [t.id, t] as const))('%s keeps its text readable on its page', (_id, t) => {
    expect(contrastRatio(t.theme.textMain, t.theme.bgPaper), 'main text').toBeGreaterThanOrEqual(7);
    expect(contrastRatio(t.theme.textSecondary, t.theme.bgPaper), 'secondary text').toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.theme.accentPrimary, t.theme.bgPaper), 'accent').toBeGreaterThanOrEqual(3);
  });

  it.each(THEME_PRESETS.map(t => [t.id, t] as const))('%s keeps its text readable on the app behind it', (_id, t) => {
    // the sidebar and the home and shop pages sit straight on the app background
    expect(contrastRatio(t.theme.textMain, t.theme.bgApp), 'on the app color').toBeGreaterThanOrEqual(4.5);
    // and on the gradient behind them, except the far end, where a horizon may glow
    (t.theme.appLook?.gradient?.stops ?? []).filter(s => s.at <= 75).forEach(s => expect(contrastRatio(t.theme.textMain, s.color), `on ${s.color}`).toBeGreaterThanOrEqual(3));
  });

  it('use only looks that survive cleaning', () => {
    THEME_PRESETS.forEach(t => {
      expect(cleanLook(t.theme.appLook), t.id).toEqual(t.theme.appLook);
      expect(cleanLook(t.theme.pageLook), t.id).toEqual(t.theme.pageLook);
    });
  });

  it('are sold in the shop and add a copy that is the writer’s to change', () => {
    THEME_PRESETS.forEach(t => {
      const item = CATALOG.find(i => i.id === `theme-${t.id}`);
      expect(item, t.id).toBeDefined();
      expect(item!.cost).toBe(t.cost);
    });
    const copy = presetCopy(THEME_PRESETS[0]);
    expect(copy).not.toBe(THEME_PRESETS[0].theme);
    expect(copy.createdAt).toBeTruthy();
    expect(copy.id).toBe(THEME_PRESETS[0].theme.id);
  });

  it('have see-through pages in the glass themes only', () => {
    THEME_PRESETS.forEach(t => expect(!!t.theme.pageLook?.glass, t.id).toBe(t.group === 'Glass'));
  });
});
