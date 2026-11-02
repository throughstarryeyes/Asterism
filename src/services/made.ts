import type { UserStats } from '../types';
import { cleanLoader } from './loaders';
import { cleanFlourish, cleanSeparator } from './ornaments';
import { cleanTrail } from './trails';
import { cleanChime } from './chimes';
import { cleanShape } from './shapes';
import { cleanPalette } from './palettes';
import { cleanCardCover, cleanShelf, cleanSkin } from './looks';
import { cleanEdge, cleanTexture } from './surfaces';
import { cleanPairing } from './pairings';
import { cleanBundle } from './bundles';
import { cleanCelebration } from './celebrations';

// everything the writer makes in the shop workshops. each kind is a list on the user's stats and travels between devices
// (see sync/extras), so adding a kind here is all it takes for it to sync.

export type MadeKind = 'loader' | 'separator' | 'flourish' | 'trail' | 'chime' | 'shape' | 'palette' | 'cover' | 'celebration' | 'pairing' | 'texture' | 'edge' | 'skin' | 'shelf' | 'bundle';

export interface MadeItem { id: string; name?: string }
type Item = MadeItem;

interface Kind {
  // the list on UserStats
  field: 'customLoaders' | 'customSeparators' | 'customFlourishes' | 'customTrails' | 'customChimes' | 'customShapes' | 'customPalettes' | 'customCovers' | 'customCelebrations' | 'customPairings' | 'customTextures' | 'customEdges' | 'customSkins' | 'customShelves' | 'customBundles';
  // the setting that picks one, and what it falls back to when the item goes away
  worn?: { field: keyof UserStats; fallback: string };
  clean: (raw: Item) => Item;
}

export const MADE: Record<MadeKind, Kind> = {
  loader: { field: 'customLoaders', worn: { field: 'activeLoader', fallback: 'stars' }, clean: r => cleanLoader(r) },
  separator: { field: 'customSeparators', worn: { field: 'activeSeparator', fallback: 'stars' }, clean: r => cleanSeparator(r) },
  flourish: { field: 'customFlourishes', worn: { field: 'activeFlourish', fallback: 'none' }, clean: r => cleanFlourish(r) },
  trail: { field: 'customTrails', worn: { field: 'activeTrail', fallback: 'none' }, clean: r => cleanTrail(r) },
  chime: { field: 'customChimes', clean: r => cleanChime(r) },
  palette: { field: 'customPalettes', clean: r => cleanPalette(r) },
  cover: { field: 'customCovers', worn: { field: 'activeCover', fallback: 'plain' }, clean: r => cleanCardCover(r) },
  celebration: { field: 'customCelebrations', worn: { field: 'activeCelebration', fallback: 'classic' }, clean: r => cleanCelebration(r) },
  pairing: { field: 'customPairings', clean: r => cleanPairing(r) },
  texture: { field: 'customTextures', worn: { field: 'activeTexture', fallback: 'plain' }, clean: r => cleanTexture(r) },
  edge: { field: 'customEdges', worn: { field: 'activeEdge', fallback: 'none' }, clean: r => cleanEdge(r) },
  skin: { field: 'customSkins', worn: { field: 'activeSkin', fallback: 'plain' }, clean: r => cleanSkin(r) },
  shelf: { field: 'customShelves', worn: { field: 'activeShelf', fallback: 'plain' }, clean: r => cleanShelf(r) },
  bundle: { field: 'customBundles', clean: r => cleanBundle(r) },
  shape: { field: 'customShapes', worn: { field: 'activeShape', fallback: 'plain' }, clean: r => cleanShape(r) },
};

export const MADE_KINDS = Object.keys(MADE) as MadeKind[];
export const madeKey = (kind: MadeKind, id: string) => `${kind}:${id}`;

export type Made = Partial<Record<MadeKind, Item[]>>;

export const madeOf = (stats: Pick<UserStats, Kind['field']>): Made =>
  Object.fromEntries(MADE_KINDS.map(k => [k, (stats[MADE[k].field] as Item[] | undefined) ?? []])) as Made;

// what another device sent, checked before it is used. items without an id are dropped, since a made-up id would duplicate them on every sync.
export function parseMade(raw: unknown): Made {
  const out: Made = {};
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  for (const k of MADE_KINDS) {
    const list = src[k];
    out[k] = Array.isArray(list)
      ? list.filter((x): x is Item => !!x && typeof x === 'object' && typeof (x as Item).id === 'string' && !!(x as Item).id).map(MADE[k].clean)
      : [];
  }
  return out;
}

// the stats fields a merged result sets, and the settings to put back when what they picked was deleted elsewhere.
export function madeFields(made: Made | undefined, prev: Partial<UserStats>): Partial<UserStats> {
  const patch: Record<string, unknown> = {};
  for (const k of MADE_KINDS) {
    const list = made?.[k] ?? [];
    patch[MADE[k].field] = list;
    const worn = MADE[k].worn;
    const current = worn ? (prev as Record<string, unknown>)[worn.field] : undefined;
    if (worn && typeof current === 'string' && current.startsWith('custom-') && !list.some(i => i.id === current)) patch[worn.field as string] = worn.fallback;
  }
  return patch as Partial<UserStats>;
}
