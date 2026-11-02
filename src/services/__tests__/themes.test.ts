import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILTIN_THEMES, builtinAsTheme } from '../builtinThemes';
import { CATALOG } from '../shop';
import { THEME_PRESETS } from '../themePresets';
import { MATERIALS, cleanLook, joinLayers, lookLayers, materialLayers } from '../backdrops';
import { contrastRatio } from '../customTheme';

const css = readFileSync('src/index.css', 'utf8');

// the declarations of one theme in the stylesheet
function block(id: string): string | null {
  const key = `:root[data-theme="${id}"]`;
  const at = css.indexOf(key);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('\n}', open));
}
const value = (b: string, name: string) => b.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

describe('the themes that come with the app', () => {
  const builtinIds = CATALOG.filter(i => i.category === 'theme' && !THEME_PRESETS.some(p => `theme-${p.id}` === i.id)).map(i => i.id.slice('theme-'.length));

  it('every one of them is styled in the stylesheet, so choosing it changes the page', () => {
    expect(builtinIds.length).toBeGreaterThanOrEqual(10);
    builtinIds.forEach(id => expect(block(id), `${id} has no styles`).not.toBeNull());
  });

  it('every one of them sets the whole set of colors, not just a few', () => {
    const needed = ['bg-app', 'bg-paper', 'bg-sidebar', 'bg-card', 'bg-input', 'border-subtle', 'border-strong', 'text-main', 'text-secondary', 'text-muted', 'accent-primary', 'accent-gold', 'shadow-paper', 'toolbar-bg'];
    builtinIds.forEach(id => needed.forEach(v => expect(value(block(id)!, v), `${id} is missing --${v}`).toBeTruthy()));
  });

  it('every one of them has a preview with the right colors', () => {
    builtinIds.forEach(id => {
      const t = builtinAsTheme(id);
      expect(t, `${id} has no preview`).toBeDefined();
      const b = block(id)!;
      expect(t!.bgApp).toBe(value(b, 'bg-app'));
      expect(t!.bgPaper).toBe(value(b, 'bg-paper'));
      expect(t!.textMain).toBe(value(b, 'text-main'));
      expect(t!.accentPrimary).toBe(value(b, 'accent-primary'));
    });
    expect(BUILTIN_THEMES.map(t => t.id).sort()).toEqual([...builtinIds].sort());
  });

  it('can be read on their own page', () => {
    BUILTIN_THEMES.forEach(t => expect(contrastRatio(t.textMain, t.bgPaper), t.id).toBeGreaterThanOrEqual(7));
  });
});

describe('materials', () => {
  it('have patterns of only black and white, so the color is the writer\'s to choose', () => {
    MATERIALS.forEach(m => m.pattern.forEach(l => {
      // the one hex in the sand's noise is black; any other hex or any colored rgba would tint the pattern
      const image = l.image.replace(/%23000/g, '');
      expect(image, m.id).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(image, m.id).not.toMatch(/rgba\((?!0, 0, 0|255, 255, 255)/);
    }));
  });

  it('take any color for the base, and change nothing else when it changes', () => {
    MATERIALS.forEach(m => {
      const red = materialLayers(m, '#cc2222');
      const blue = materialLayers(m, '#2222cc');
      expect(red).toHaveLength(blue.length);
      expect(red.slice(0, -1)).toEqual(blue.slice(0, -1));
      expect(red[red.length - 1].image).not.toBe(blue[blue.length - 1].image);
    });
  });

  it('use their own usual color when none is picked, and ignore a bad one', () => {
    const wood = MATERIALS.find(m => m.id === 'wood')!;
    expect(materialLayers(wood)).toEqual(materialLayers(wood, undefined));
    expect(materialLayers(wood, 'brown')).toEqual(materialLayers(wood));
  });

  it('keep the color in a look, only for a material', () => {
    expect(cleanLook({ material: 'water', tint: '#33AA88' })).toEqual({ material: 'water', tint: '#33aa88' });
    expect(cleanLook({ material: 'water', tint: 'teal' })).toEqual({ material: 'water' });
    expect(cleanLook({ stars: 'few', tint: '#33aa88' })).toEqual({ stars: 'few' });
  });

  it('draw the chosen color', () => {
    const j = joinLayers(lookLayers({ material: 'marble', tint: '#aa3355' }));
    expect(j.image).toContain('rgba(180, 75, 105, 1)');
    expect(lookLayers({ material: 'marble', tint: '#aa3355' }).length).toBe(lookLayers({ material: 'marble' }).length);
  });

  const gradient = { kind: 'linear' as const, angle: 180, stops: [{ color: '#112233', at: 0 }, { color: '#ffeedd', at: 100 }] };
  const wash = (look: Parameters<typeof lookLayers>[0]) => lookLayers(look).find(l => l.image.startsWith('linear-gradient(180deg, rgba('))!.image;

  it('is solid alone and part see-through over a gradient', () => {
    expect(wash({ material: 'cork' })).toContain(', 1)');
    expect(wash({ material: 'cork', gradient })).toContain('0.45)');
  });

  it('lets the writer set how see-through it is, kept within range', () => {
    expect(wash({ material: 'cork', gradient, fill: 0.2 })).toContain('0.2)');
    expect(cleanLook({ material: 'cork', fill: 0 })).toEqual({ material: 'cork', fill: 0.1 });
    expect(cleanLook({ stars: 'few', fill: 0.5 })).toEqual({ stars: 'few' });
  });
});
