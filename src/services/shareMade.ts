import { MADE, type MadeKind } from './made';
import { OLD_SHARE_TYPE } from './legacy';

// sharing something the writer made: one small file that anyone can add to their own Asterism.
// not shared: palettes (they have their own tool) and bundles (they point at looks the other person may not own).

export const SHARE_TYPE = 'asterism-cosmetic';
export const SHARE_KINDS: MadeKind[] = ['loader', 'separator', 'flourish', 'trail', 'chime', 'shape', 'cover', 'celebration', 'pairing', 'texture', 'edge', 'skin', 'shelf'];
const MAX_BYTES = 200 * 1024;

export const canShare = (kind: MadeKind) => SHARE_KINDS.includes(kind);

export function shareFile(kind: MadeKind, item: { id: string; name?: string }): { fileName: string; text: string } {
  const name = (item.name ?? 'mine').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'mine';
  return { fileName: `${name}.${kind}.asterism.json`, text: JSON.stringify({ type: SHARE_TYPE, version: 1, kind, item }, null, 2) };
}

export type Shared = { kind: MadeKind; item: { id: string; name?: string } } | { error: string };

// what a file holds, checked and cleaned by the same code that cleans our own. it gets a new id, so it never replaces one the reader already has.
export function parseShared(text: string, newId: () => string = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`): Shared {
  if (text.length > MAX_BYTES) return { error: 'That file is too big to be one cosmetic.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: 'That is not an Asterism cosmetic file.' }; }
  const r = raw as { type?: unknown; kind?: unknown; item?: unknown } | null;
  if (!r || typeof r !== 'object' || (r.type !== SHARE_TYPE && r.type !== OLD_SHARE_TYPE)) return { error: 'That is not an Asterism cosmetic file.' };
  const kind = SHARE_KINDS.find(k => k === r.kind);
  if (!kind) return { error: 'This kind of cosmetic cannot be shared.' };
  if (!r.item || typeof r.item !== 'object' || Array.isArray(r.item)) return { error: 'That file has nothing in it.' };
  const item = MADE[kind].clean({ ...(r.item as Record<string, unknown>), id: newId() });
  return { kind, item };
}
