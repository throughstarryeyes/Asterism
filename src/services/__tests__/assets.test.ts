import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { deleteAsset, getAsset, listAssetIds, newAssetId, pruneAssets, putAsset } from '../assetStore';
import { familyFromFileName, sniffFontFormat, uniqueFamily, validateFontFile } from '../fontFiles';
import { fitWithin, validateImageFile } from '../imageUpload';
import { imageLayer, themeAssetIds } from '../themeImages';
import { newCustomTheme } from '../customTheme';

describe('asset store', () => {
  it('stores and returns a file', async () => {
    const id = await putAsset(new Blob(['hello']), 'a1');
    expect(id).toBe('a1');
    const back = await getAsset('a1');
    expect(await back!.text()).toBe('hello');
  });
  it('returns undefined for a missing id and can delete', async () => {
    expect(await getAsset('nope')).toBeUndefined();
    await putAsset(new Blob(['x']), 'gone');
    await deleteAsset('gone');
    expect(await getAsset('gone')).toBeUndefined();
  });
  it('ids are unique', () => {
    expect(newAssetId()).not.toBe(newAssetId());
  });
  it('prunes only what nothing uses', async () => {
    await putAsset(new Blob(['1']), 'keep-me');
    await putAsset(new Blob(['2']), 'orphan');
    const removed = await pruneAssets(new Set(['keep-me']));
    expect(removed).toContain('orphan');
    expect(removed).not.toContain('keep-me');
    expect(await listAssetIds()).toContain('keep-me');
  });
});

describe('font validation', () => {
  it('recognizes real font headers by content, not name', () => {
    expect(sniffFontFormat(new Uint8Array([0, 1, 0, 0, 9]))).toBe('ttf');
    expect(sniffFontFormat(new TextEncoder().encode('OTTO....'))).toBe('otf');
    expect(sniffFontFormat(new TextEncoder().encode('wOFF....'))).toBe('woff');
    expect(sniffFontFormat(new TextEncoder().encode('wOF2....'))).toBe('woff2');
    expect(sniffFontFormat(new TextEncoder().encode('<html>'))).toBeNull();
    expect(sniffFontFormat(new Uint8Array([1, 2]))).toBeNull();
  });
  it('checks extension and size', () => {
    expect(validateFontFile({ name: 'a.ttf', size: 5000 })).toBeNull();
    expect(validateFontFile({ name: 'a.exe', size: 5000 })).toMatch(/ttf/);
    expect(validateFontFile({ name: 'a.otf', size: 9 * 1024 * 1024 })).toMatch(/8 MB/);
    expect(validateFontFile({ name: 'a.woff2', size: 3 })).toMatch(/empty/);
  });
  it('turns file names into readable family names', () => {
    expect(familyFromFileName('Cormorant-SemiBold_Italic.ttf')).toBe('Cormorant Semi Bold Italic');
    expect(familyFromFileName('Lobster-Regular.otf')).toBe('Lobster');
    expect(familyFromFileName('MyHandwriting.woff2')).toBe('My Handwriting');
  });
  it('never clashes with built-in or existing fonts', () => {
    expect(uniqueFamily('Lora', [])).toBe('Lora (2)');
    expect(uniqueFamily('lora', [])).toBe('lora (2)');
    expect(uniqueFamily('Lobster', ['Lobster'])).toBe('Lobster (2)');
    expect(uniqueFamily('Lobster', ['Lobster', 'Lobster (2)'])).toBe('Lobster (3)');
    expect(uniqueFamily('  ', [])).toBe('My font');
  });
});

describe('image validation', () => {
  it('accepts common images and rejects the rest', () => {
    expect(validateImageFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'image/svg+xml', size: 1000 })).toMatch(/PNG/);
    expect(validateImageFile({ type: 'image/jpeg', size: 20 * 1024 * 1024 })).toMatch(/15 MB/);
  });
  it('shrinks large images but never enlarges small ones', () => {
    expect(fitWithin(4800, 2400)).toEqual({ width: 2400, height: 1200 });
    expect(fitWithin(1000, 500)).toEqual({ width: 1000, height: 500 });
  });
});

describe('theme images', () => {
  it('layers the theme color over the picture', () => {
    const css = imageLayer('blob:x', '#000000', 0.5);
    expect(css).toContain('rgba(0, 0, 0, 0.5)');
    expect(css).toContain('url("blob:x")');
  });
  it('keeps the veil within a sane range', () => {
    expect(imageLayer('u', '#ffffff', 5)).toContain('0.95');
    expect(imageLayer('u', '#ffffff', -1)).toContain(', 0)');
  });
  it('lists the assets a set of themes uses', () => {
    const a = newCustomTheme({ appBgImageId: 'i1', pageBgImageId: 'i2' });
    const b = newCustomTheme({ appBgImageId: 'i3' });
    expect(themeAssetIds([a, b, undefined]).sort()).toEqual(['i1', 'i2', 'i3']);
  });
});
