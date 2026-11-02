import { describe, it, expect } from 'vitest';
import { contrastRatio, deriveThemeVars, hexToRgb, isDark, mix, newCustomTheme, DERIVED_VAR_NAMES } from '../customTheme';

describe('custom theme derivation', () => {
  it('parses hex, including shorthand, and rejects junk', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#102030')).toEqual([16, 32, 48]);
    expect(hexToRgb('nope')).toBeNull();
  });
  it('mixes colors', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
  it('knows dark from light', () => {
    expect(isDark('#080c18')).toBe(true);
    expect(isDark('#f5f0e6')).toBe(false);
  });
  it('sets every variable a built-in theme sets', () => {
    const vars = deriveThemeVars(newCustomTheme());
    for (const name of ['--bg-card-hover', '--accent-hover', '--accent-light', '--shadow-sm', '--shadow-md', '--shadow-paper', '--shadow-glow', '--badge-bg', '--tag-bg', '--toolbar-bg']) {
      expect(vars[name], name).toBeTruthy();
    }
    expect(DERIVED_VAR_NAMES.length).toBeGreaterThanOrEqual(23);
  });
  it('derives tags and badges for dark themes that are not light', () => {
    const vars = deriveThemeVars(newCustomTheme({ bgApp: '#080c18', bgPaper: '#0f1629', textMain: '#f0f4ff' }));
    expect(isDark(vars['--tag-bg'])).toBe(true);
    expect(isDark(vars['--badge-bg'])).toBe(true);
  });
  it('reports contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#808080')).toBeLessThan(1.5);
  });
});

import { parseCssColor } from '../customTheme';

describe('reading colors back from the page', () => {
  it('understands hex, rgb and rgba', () => {
    expect(parseCssColor('#080c18')).toEqual([8, 12, 24]);
    expect(parseCssColor('rgb(15, 22, 41)')).toEqual([15, 22, 41]);
    expect(parseCssColor('rgba(15, 22, 41, 0.92)')).toEqual([15, 22, 41]);
    expect(parseCssColor('  #fff ')).toEqual([255, 255, 255]);
  });
  it('gives up on things that are not colors', () => {
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor('var(--bg-app)')).toBeNull();
  });
});
