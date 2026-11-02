import type { CustomFontConfig } from '../types';
import { getAsset, newAssetId, putAsset } from './assetStore';
import { SYSTEM_FONTS } from './systemFonts';

export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;
export const MAX_FONT_BYTES = 8 * 1024 * 1024;

export const BUILT_IN_FONTS = ['Lora', 'Playfair Display', 'Cinzel', 'Outfit', 'Courier Prime', 'Caveat', 'Patrick Hand'];

export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

// look at the file's first bytes, not its name: a renamed file is not a font.
export function sniffFontFormat(bytes: Uint8Array): FontFormat | null {
  if (bytes.length < 4) return null;
  const tag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (tag === 'wOFF') return 'woff';
  if (tag === 'wOF2') return 'woff2';
  if (tag === 'OTTO') return 'otf';
  if (tag === 'true' || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return 'ttf';
  return null;
}

export function validateFontFile(file: { name: string; size: number }): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(FONT_EXTENSIONS as readonly string[]).includes(ext)) return 'Use a .ttf, .otf, .woff or .woff2 file.';
  if (file.size > MAX_FONT_BYTES) return 'That font file is over 8 MB.';
  if (file.size < 64) return 'That file looks empty.';
  return null;
}

// "Cormorant-SemiBold_Italic.ttf" -> "Cormorant SemiBold Italic"
export function familyFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+(regular|book)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// a name that does not clash with a built-in or an existing font.
export function uniqueFamily(wanted: string, existing: string[]): string {
  const taken = new Set([...BUILT_IN_FONTS, ...SYSTEM_FONTS, ...existing].map(f => f.toLowerCase()));
  let name = wanted.trim() || 'My font';
  if (!taken.has(name.toLowerCase())) return name;
  const base = name;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} (${i})`;
  return name;
}

const registered = new Set<string>();
export const isFontRegistered = (family: string) => registered.has(family);

export async function registerFontBlob(family: string, blob: Blob): Promise<void> {
  if (registered.has(family)) return;
  // quoted, so names with digits or punctuation are still valid CSS family names.
  const face = new FontFace(`"${family.replace(/["\\]/g, '\\$&')}"`, await blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  registered.add(family);
}

export interface UploadedFont {
  config: CustomFontConfig;
  family: string;
}

// validate, store and register an uploaded font file.
export async function addFontFile(file: File, existingFamilies: string[], wantedFamily?: string): Promise<UploadedFont> {
  const problem = validateFontFile(file);
  if (problem) throw new Error(problem);
  const format = sniffFontFormat(new Uint8Array(await file.slice(0, 4).arrayBuffer()));
  if (!format) throw new Error('That does not look like a font file.');
  const family = uniqueFamily(wantedFamily || familyFromFileName(file.name), existingFamilies);
  const blob = new Blob([await file.arrayBuffer()], { type: `font/${format}` });
  await registerFontBlob(family, blob); // fail before storing anything if the browser rejects it
  const assetId = await putAsset(blob, newAssetId('font'));
  return { family, config: { id: assetId, name: family, family, source: 'local', assetId, fileName: file.name } };
}

// on startup: bring every stored font back into the page.
export async function loadStoredFonts(fonts: CustomFontConfig[]): Promise<void> {
  await Promise.all(fonts.filter(f => f.assetId).map(async f => {
    try {
      const blob = await getAsset(f.assetId!);
      if (blob) await registerFontBlob(f.family, blob);
    } catch (e) {
      console.warn(`Could not load font "${f.family}"`, e);
    }
  }));
}
