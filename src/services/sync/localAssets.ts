import type { CustomFontConfig, Project } from '../../types';
import { getAsset, putAsset } from '../assetStore';
import { fontFamiliesUsed } from '../exportFonts';
import { registerFontBlob, sniffFontFormat } from '../fontFiles';
import { soundAssetIds } from '../soundRecipes';
import { scapeAssetIds } from '../soundscapes';
import { themeAssetIds } from '../themeImages';
import type { AssetMeta, LocalAssets } from './assets';
import { assetKey } from './assets';
import { EXTRAS_ID, mergeExtras, parseExtras, serializeExtras, type Extras } from './extras';

// this device's uploaded files as the sync sees them: fonts count when text or a theme names them
// pictures and recordings keep one id everywhere; themes and sounds merge through extras.ts

export interface AssetDeps {
  fonts(): CustomFontConfig[];
  addFont(config: CustomFontConfig): void;
  // a picture arrived; whatever draws the theme should look again.
  imagesChanged(): void;
  // the writer's themes and sounds. `set` takes effect at once for the next `get`, before the screen redraws.
  extras(): Extras;
  setExtras(next: Extras): void;
  // replaceable in tests.
  store?: {
    get(id: string): Promise<Blob | undefined>;
    put(blob: Blob, id: string): Promise<unknown>;
  };
  register?: (family: string, blob: Blob) => Promise<void>;
}

const MIME: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const encoder = new TextEncoder();
const EMPTY = serializeExtras({ themes: [], sounds: [], images: {}, scapes: [], cursors: [], prefs: [], stamps: {} });

function fontsUsedBy(project: Project, extras: Extras): Set<string> {
  const used = new Set<string>();
  project.chapters.forEach(c => fontFamiliesUsed(c.content ?? '').forEach(f => used.add(f.toLowerCase())));
  const theme = project.storyTheme;
  if (theme?.activeFont) used.add(theme.activeFont.toLowerCase());
  if (theme?.customTheme?.fontFamily) used.add(theme.customTheme.fontFamily.toLowerCase());
  extras.themes.forEach(t => { if (t.fontFamily) used.add(t.fontFamily.toLowerCase()); });
  return used;
}

export function localAssets(deps: AssetDeps): LocalAssets {
  const store = deps.store ?? { get: getAsset, put: putAsset };
  const register = deps.register ?? registerFontBlob;

  const pictureIds = (project: Project) => {
    const e = deps.extras();
    const cursors = (e.cursors ?? []).map(c => c.assetId);
    return [...new Set([...themeAssetIds([project.storyTheme?.customTheme, ...e.themes, ...Object.values(e.images)]), ...cursors])];
  };
  const soundIds = () => [...new Set([...soundAssetIds(deps.extras().sounds), ...scapeAssetIds(deps.extras().scapes ?? [])])];
  const fileIds = (project: Project) => new Set([...pictureIds(project), ...soundIds()]);

  return {
    async wanted(project) {
      const out: AssetMeta[] = [];
      const extras = deps.extras();
      const text = serializeExtras(extras);
      // nothing to send until the writer has made something of their own.
      if (text !== EMPTY) out.push({ id: EXTRAS_ID, kind: 'extras', type: 'application/json', size: encoder.encode(text).length });

      for (const id of pictureIds(project)) {
        const blob = await store.get(id);
        if (blob) out.push({ id, kind: 'image', type: blob.type || 'image/png', size: blob.size });
      }
      for (const id of soundIds()) {
        const blob = await store.get(id);
        if (blob) out.push({ id, kind: 'sound', type: blob.type || 'audio/wav', size: blob.size });
      }
      const used = fontsUsedBy(project, extras);
      for (const font of deps.fonts()) {
        if (!font.assetId || !used.has(font.family.toLowerCase())) continue;
        const blob = await store.get(font.assetId);
        if (blob) out.push({ id: font.assetId, kind: 'font', type: blob.type, size: blob.size, family: font.family, fileName: font.fileName });
      }
      return out;
    },

    async read(id) {
      if (id === EXTRAS_ID) return encoder.encode(serializeExtras(deps.extras()));
      const blob = await store.get(id);
      return blob ? bytesOf(blob) : undefined;
    },

    async needs(project, meta) {
      if (meta.kind === 'extras') return true;
      if (meta.kind === 'image' || meta.kind === 'sound') return fileIds(project).has(meta.id) && !(await store.get(meta.id));
      const family = (meta.family ?? '').toLowerCase();
      return !!family && !deps.fonts().some(f => f.family.toLowerCase() === family);
    },

    async install(meta, bytes) {
      if (meta.kind === 'extras') {
        const incoming = parseExtras(new TextDecoder().decode(bytes));
        if (!incoming) throw new Error('not a list of themes and sounds');
        const before = deps.extras();
        const merged = mergeExtras(before, incoming);
        if (serializeExtras(merged) !== serializeExtras(before)) deps.setExtras(merged);
        return;
      }
      if (meta.kind === 'image' || meta.kind === 'sound') {
        await store.put(new Blob([bytes as BlobPart], { type: meta.type }), meta.id);
        if (meta.kind === 'image') deps.imagesChanged();
        return;
      }
      const format = sniffFontFormat(bytes);
      if (!format || !meta.family) throw new Error('not a font');
      const blob = new Blob([bytes as BlobPart], { type: MIME[format] });
      await register(meta.family, blob); // the browser's verdict comes before anything is stored
      await store.put(blob, meta.id);
      deps.addFont({ id: meta.id, name: meta.family, family: meta.family, source: 'local', assetId: meta.id, fileName: meta.fileName });
    },

    async referenced(project) {
      const keys = new Set<string>();
      fileIds(project).forEach(id => keys.add(assetKey({ id, kind: 'image' })));
      fontsUsedBy(project, deps.extras()).forEach(family => keys.add(assetKey({ id: family, kind: 'font', family })));
      return keys;
    },
  };
}

