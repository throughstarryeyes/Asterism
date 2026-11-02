import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { putAsset } from '../assetStore';
import { applyThemeImages, clearThemeImages } from '../themeImages';
import { newCustomTheme } from '../customTheme';

// a stand-in for document.documentElement that records what is set on it.
function fakeRoot() {
  const vars = new Map<string, string>();
  const attrs = new Set<string>();
  const root = {
    style: {
      setProperty: (k: string, v: string) => void vars.set(k, v),
      removeProperty: (k: string) => void vars.delete(k),
    },
    setAttribute: (k: string) => void attrs.add(k),
    removeAttribute: (k: string) => void attrs.delete(k),
  } as unknown as HTMLElement;
  return { root, vars, attrs };
}

const settle = () => new Promise(r => setTimeout(r, 20));

describe('applying theme images to the page', () => {
  it('sets the project and document backgrounds from stored files', async () => {
    const app = await putAsset(new Blob(['app']), 'img-app');
    const page = await putAsset(new Blob(['page']), 'img-page');
    const { root, vars, attrs } = fakeRoot();
    applyThemeImages(newCustomTheme({ appBgImageId: app, pageBgImageId: page, appBgDim: 0.2 }), root);
    await settle();
    expect(vars.get('--app-bg-image')).toContain('url("');
    expect(vars.get('--page-bg-image')).toContain('url("');
    expect(attrs.has('data-app-bg')).toBe(true);
    expect(attrs.has('data-page-bg')).toBe(true);
  });

  it('applies only the one that is set', async () => {
    const app = await putAsset(new Blob(['only-app']), 'img-only-app');
    const { root, vars, attrs } = fakeRoot();
    applyThemeImages(newCustomTheme({ appBgImageId: app }), root);
    await settle();
    expect(attrs.has('data-app-bg')).toBe(true);
    expect(attrs.has('data-page-bg')).toBe(false);
    expect(vars.has('--page-bg-image')).toBe(false);
  });

  it('clears everything for a theme with no pictures', () => {
    const { root, vars, attrs } = fakeRoot();
    vars.set('--app-bg-image', 'x');
    attrs.add('data-app-bg');
    applyThemeImages(newCustomTheme(), root);
    expect(vars.size).toBe(0);
    expect(attrs.size).toBe(0);
  });

  it('survives a theme pointing at a file that no longer exists', async () => {
    const { root, attrs } = fakeRoot();
    applyThemeImages(newCustomTheme({ appBgImageId: 'deleted' }), root);
    await settle();
    expect(attrs.has('data-app-bg')).toBe(false);
  });

  it('does not apply a stale theme after it has been canceled', async () => {
    const id = await putAsset(new Blob(['late']), 'img-late');
    const { root, attrs } = fakeRoot();
    const cancel = applyThemeImages(newCustomTheme({ appBgImageId: id }), root);
    cancel();
    await settle();
    expect(attrs.has('data-app-bg')).toBe(false);
  });

  it('clearThemeImages removes both', () => {
    const { root, vars, attrs } = fakeRoot();
    vars.set('--page-bg-image', 'x');
    attrs.add('data-page-bg');
    clearThemeImages(root);
    expect(vars.size + attrs.size).toBe(0);
  });
});

describe('pictures on built-in themes', () => {
  it('tints with the theme color read back from the page, in any CSS color format', async () => {
    const id = await putAsset(new Blob(['builtin']), 'img-builtin');
    const { root, vars } = fakeRoot();
    applyThemeImages({ appBgImageId: id, appBgDim: 0.5, bgApp: 'rgb(8, 12, 24)', bgPaper: '#0f1629' }, root);
    await settle();
    expect(vars.get('--app-bg-image')).toContain('rgba(8, 12, 24, 0.5)');
  });
});
