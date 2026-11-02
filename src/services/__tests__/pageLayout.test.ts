import { describe, it, expect } from 'vitest';
import { DEFAULT_PAGE, PAGE_LIMITS, PAGE_PRESETS, normalizePage, pageVars, samePage } from '../pageLayout';

describe('page layout', () => {
  it('defaults to the layout the editor always had', () => {
    expect(DEFAULT_PAGE).toEqual({ width: 840, marginX: 64, marginY: 64 });
    expect(normalizePage(undefined)).toEqual(DEFAULT_PAGE);
  });
  it('keeps values inside the allowed range', () => {
    const p = normalizePage({ width: 99999, marginX: -5, marginY: 4000 });
    expect(p.width).toBe(PAGE_LIMITS.width[1]);
    expect(p.marginX).toBe(PAGE_LIMITS.marginX[0]);
    expect(p.marginY).toBe(PAGE_LIMITS.marginY[1]);
  });
  it('replaces junk with defaults, per field', () => {
    expect(normalizePage({ width: 'wide', marginX: NaN, marginY: 100 })).toEqual({ width: 840, marginX: 64, marginY: 100 });
    expect(normalizePage('nope')).toEqual(DEFAULT_PAGE);
  });
  it('rounds to whole pixels', () => {
    expect(normalizePage({ width: 700.6 }).width).toBe(701);
  });
  it('turns a layout into CSS variables', () => {
    expect(pageVars({ width: 700, marginX: 96, marginY: 40 })).toEqual({ '--page-width': '700px', '--page-margin-x': '96px', '--page-margin-y': '40px' });
  });
  it('presets are all valid, distinct, and include the default', () => {
    PAGE_PRESETS.forEach(p => expect(normalizePage(p.page)).toEqual(p.page));
    expect(PAGE_PRESETS.some(p => samePage(p.page, DEFAULT_PAGE))).toBe(true);
    expect(new Set(PAGE_PRESETS.map(p => p.page.width)).size).toBe(PAGE_PRESETS.length);
  });
  it('wide margins mean a narrower page with more space inside, narrow the reverse', () => {
    const [wide, , narrow] = PAGE_PRESETS.map(p => p.page);
    expect(wide.width).toBeLessThan(DEFAULT_PAGE.width);
    expect(wide.marginX).toBeGreaterThan(DEFAULT_PAGE.marginX);
    expect(narrow.width).toBeGreaterThan(DEFAULT_PAGE.width);
    expect(narrow.marginX).toBeLessThan(DEFAULT_PAGE.marginX);
  });
});
