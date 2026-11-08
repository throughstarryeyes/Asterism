import type { CosmeticItem } from '../types';
import { EXPANDED_COSMETIC_SHOP_ITEMS } from '../data/calliopeData';
import { PRESET_LOADERS } from './loaders';
import { FLOURISHES, SEPARATORS } from './ornaments';
import { PRESET_CURSORS } from './cursors';
import { PRESET_TRAILS, TRAIL_COST, TRAIL_TEXT } from './trails';
import { CELEBRATION_COST, CELEBRATION_TEXT, PRESET_CELEBRATIONS } from './celebrations';
import { CHIME_COST, CHIME_TEXT, PRESET_CHIMES } from './chimes';
import { PRESET_SHAPES, SHAPE_COST, SHAPE_TEXT } from './shapes';
import { COVERS, SHELVES, SKINS } from './looks';
import { EDGES, TEXTURES } from './surfaces';
import { PAIRINGS } from './pairings';
import { THEME_PRESETS } from './themePresets';

// everything the shop sells, in one shape: name, cost, category, tier, description.
// nothing here is a writing tool. it is all look, sound and keepsakes.

export const MIN_PRICE = 30;

export type Tier = NonNullable<CosmeticItem['tier']>;

export const TIERS: Array<{ id: Tier; label: string; range: string }> = [
  { id: 'free', label: 'Free', range: 'Yours from the start' },
  { id: 'common', label: 'Common', range: '30 to 80 QP' },
  { id: 'uncommon', label: 'Uncommon', range: '100 to 200 QP' },
  { id: 'rare', label: 'Rare', range: '300 QP and up' },
  { id: 'earned', label: 'Earned', range: 'Won with a streak, never bought' },
];

export const tierOf = (cost: number): Tier => (cost <= 0 ? 'free' : cost <= 80 ? 'common' : cost <= 200 ? 'uncommon' : 'rare');

// things only a streak badge unlocks
export const EARNED: Record<string, string> = {
  'cover-ember': 'badge-streak-7',
  'trail-comet': 'badge-streak-30',
  'shelf-legend': 'badge-streak-100',
  'chime-triumph': 'badge-streak-100',
  'cover-snowbound': 'badge-season-winter',
  'cover-firstbloom': 'badge-season-spring',
  'cover-longdays': 'badge-season-summer',
  'cover-harvest': 'badge-season-autumn',
};

// bundles: a few things that go together, at about 30% off. the cost is worked out from what is inside.
export const PACKS: Array<{ id: string; name: string; description: string; items: string[] }> = [
  { id: 'midnight-library', name: 'Midnight Library', description: 'Starlit pages, a gilt frame and a music box chime.', items: ['theme-celestial', 'texture-starry', 'edge-gilt', 'trail-stardust', 'chime-musicbox', 'cover-midnight'] },
  { id: 'garden-journal', name: 'Garden Journal', description: 'Watercolor pages, vines and falling petals.', items: ['theme-pasteldream', 'texture-watercolor', 'edge-vines', 'trail-petals', 'cover-forest', 'pairing-cozy'] },
  { id: 'old-study', name: 'Old Study', description: 'Linen paper, stitched borders and old-style type.', items: ['theme-scriptorium', 'texture-linen', 'edge-stitched', 'pairing-gothic', 'shelf-oak', 'cover-leather'] },
  { id: 'notebook-days', name: 'Notebook Days', description: 'Ruled lines, a red margin and a pencil.', items: ['theme-composition', 'texture-lined', 'edge-redline', 'cursor-pencil', 'pairing-typewriter', 'cover-parchment'] },
];

// making your own: every kind of cosmetic costs this much each time a new one is saved. editing one is free.
// about a day of writing earns it. (custom themes cost the same, see CUSTOM_THEME_COST.)
export const MAKE_COST = 75;

const LOADER_COST: Record<string, number> = {
  stars: 0, orbit: 40, constellation: 60, hearts: 40, moonrise: 60, fireflies: 50, petals: 70, rain: 50, gems: 120, wishes: 150,
};

const LOADER_ICON: Record<string, string> = {
  stars: '✦', orbit: '✧', constellation: '🌠', hearts: '♡', moonrise: '☾', fireflies: '·', petals: '❀', rain: '💧', gems: '◇', wishes: '✨',
};

const LOADER_TEXT: Record<string, string> = {
  stars: 'Four hollow stars light up one by one.',
  orbit: 'Four stars take turns around a ring.',
  constellation: 'A line of stars joined like a constellation.',
  hearts: 'Three hearts glow in turn.',
  moonrise: 'Moons rise along an arc.',
  fireflies: 'Little lights drifting up and down.',
  petals: 'Leaves spin round in a circle.',
  rain: 'Drops falling left to right.',
  gems: 'Gems catch the light along a zigzag.',
  wishes: 'Seven stars arch across the sky.',
};

function build(): CosmeticItem[] {
  const base = EXPANDED_COSMETIC_SHOP_ITEMS;

  const loaders: CosmeticItem[] = PRESET_LOADERS.map(l => ({
    id: `loader-${l.id}`,
    name: l.name,
    category: 'loader',
    cost: LOADER_COST[l.id] ?? 60,
    description: LOADER_TEXT[l.id] ?? '',
    unlocked: false,
    previewIcon: LOADER_ICON[l.id],
  }));

  const separators: CosmeticItem[] = SEPARATORS.map(s => ({
    id: `separator-${s.id}`, name: s.name, category: 'separator', cost: s.cost, description: s.description, unlocked: false,
  }));

  const flourishes: CosmeticItem[] = FLOURISHES.map(f => ({
    id: `flourish-${f.id}`, name: f.name, category: 'flourish', cost: f.cost, description: f.description, unlocked: false,
  }));

  const cursors: CosmeticItem[] = PRESET_CURSORS.map(c => ({
    id: `cursor-${c.id}`, name: c.name, category: 'cursor', cost: c.cost, description: c.description, unlocked: false, previewIcon: c.glyph,
  }));

  const presetThemes: CosmeticItem[] = THEME_PRESETS.map(t => ({
    id: `theme-${t.id}`, name: t.name, category: 'theme', cost: t.cost, description: `${t.group}. ${t.description}`, unlocked: false, previewColor: t.theme.bgApp, previewIcon: t.icon,
  }));
  const pairings: CosmeticItem[] = PAIRINGS.map(p => ({ id: `pairing-${p.id}`, name: p.name, category: 'pairing', cost: p.cost, description: p.description, unlocked: false, previewIcon: 'Aa' }));
  const textures: CosmeticItem[] = TEXTURES.map(t => ({ id: `texture-${t.id}`, name: t.name, category: 'texture', cost: t.cost, description: t.description, unlocked: false, season: t.season }));
  const edges: CosmeticItem[] = EDGES.map(e => ({ id: `edge-${e.id}`, name: e.name, category: 'edge', cost: e.cost, description: e.description, unlocked: false, season: e.season }));

  // trails are off until one is picked, so turning them off needs a card of its own
  const noTrail: CosmeticItem = { id: 'trail-none', name: 'No trail', category: 'trail' as const, cost: 0, description: 'Nothing follows the pointer.', unlocked: true, previewIcon: '∅' };
  const trails: CosmeticItem[] = [noTrail, ...PRESET_TRAILS.map((t): CosmeticItem => ({
    id: `trail-${t.id}`, name: t.name, category: 'trail', cost: TRAIL_COST[t.id] ?? 60, description: TRAIL_TEXT[t.id] ?? '', unlocked: false, previewIcon: Array.from(t.glyph)[0],
  }))];

  const chimes: CosmeticItem[] = PRESET_CHIMES.map(c => ({
    id: `chime-${c.id}`, name: c.name, category: 'chime', cost: CHIME_COST[c.id] ?? 60, description: CHIME_TEXT[c.id] ?? '', unlocked: false, previewIcon: '♪',
  }));

  const shapes: CosmeticItem[] = PRESET_SHAPES.map(s => ({
    id: `shape-${s.id}`, name: s.name, category: 'shape', cost: SHAPE_COST[s.id] ?? 50, description: SHAPE_TEXT[s.id] ?? '', unlocked: false,
  }));

  // confetti is on until turned off, so turning it off needs a card of its own
  const noConfetti: CosmeticItem = { id: 'confetti-none', name: 'No confetti', category: 'confetti', cost: 0, description: 'Nothing bursts out. Quill Point notes can be hidden below.', unlocked: true, previewIcon: '∅' };
  const confettis: CosmeticItem[] = [noConfetti, ...PRESET_CELEBRATIONS.map(c => ({
    id: `confetti-${c.id}`, name: c.name, category: 'confetti', cost: CELEBRATION_COST[c.id] ?? 60, description: CELEBRATION_TEXT[c.id] ?? '', unlocked: false,
  } as CosmeticItem))];

  const skins: CosmeticItem[] = SKINS.map(s => ({ id: `skin-${s.id}`, name: s.name, category: 'skin', cost: s.cost, description: s.description, unlocked: false }));
  const covers: CosmeticItem[] = COVERS.map(c => ({ id: `cover-${c.id}`, name: c.name, category: 'cover', cost: c.cost, description: c.description, unlocked: false }));
  const shelves: CosmeticItem[] = SHELVES.map(s => ({ id: `shelf-${s.id}`, name: s.name, category: 'shelf', cost: s.cost, description: s.description, unlocked: false }));

  const singles = [...base, ...presetThemes, ...pairings, ...textures, ...edges, ...cursors, ...loaders, ...separators, ...flourishes, ...trails, ...chimes, ...confettis, ...shapes, ...skins, ...covers, ...shelves];
  const priced = singles.map(i => {
    const earnedWith = EARNED[i.id];
    if (earnedWith) return { ...i, cost: 0, tier: 'earned' as const, earnedWith };
    const cost = i.cost > 0 ? Math.max(MIN_PRICE, i.cost) : 0;
    return { ...i, cost, tier: tierOf(cost) };
  });
  const packs: CosmeticItem[] = PACKS.map(p => {
    const sum = p.items.reduce((n, id) => n + (priced.find(i => i.id === id)?.cost ?? 0), 0);
    const cost = Math.max(MIN_PRICE, Math.round((sum * 0.7) / 10) * 10);
    return { id: `pack-${p.id}`, name: p.name, category: 'pack', cost, tier: tierOf(cost), description: p.description, unlocked: false, contains: p.items };
  });
  return [...packs, ...priced];
}

export const CATALOG: CosmeticItem[] = build();

export const isOwned = (item: Pick<CosmeticItem, 'id' | 'cost' | 'earnedWith'>, unlocked: string[] = [], badges: string[] = []) =>
  item.earnedWith ? badges.includes(item.earnedWith) : item.cost === 0 || unlocked.includes(item.id);

export const CATEGORIES: Array<{ id: CosmeticItem['category']; label: string; blurb: string }> = [
  { id: 'theme', label: 'Themes', blurb: 'The look of the whole app. Light, black and parchment are always free.' },
  { id: 'pack', label: 'Bundles', blurb: 'Several looks that go together, about 30% cheaper than buying each. Buying one wears the lot.' },
  { id: 'pairing', label: 'Fonts', blurb: 'A font for the writing and one for titles. Fonts load from Google when you are online.' },
  { id: 'texture', label: 'Page textures', blurb: 'The feel of the paper. Seasonal ones are sold only in their season, and are yours to keep.' },
  { id: 'edge', label: 'Margins', blurb: 'Decorations around the edge of the page.' },
  { id: 'cursor', label: 'Pointers', blurb: 'The pointer over the page. Or upload your own picture.' },
  { id: 'trail', label: 'Trails', blurb: 'Sparkles that follow your pointer. Make your own below.' },
  { id: 'loader', label: 'Loaders', blurb: 'What lights up while Asterism thinks. Make your own in the workshop.' },
  { id: 'separator', label: 'Scene breaks', blurb: 'The mark between scenes. Changes what the scene break button inserts.' },
  { id: 'flourish', label: 'Title page', blurb: 'Ornaments and frames for the title page in book preview.' },
  { id: 'keystroke', label: 'Key sounds', blurb: 'What each keystroke sounds like while you write.' },
  { id: 'soundscape', label: 'Soundscapes', blurb: 'Background sound for writing sessions.' },
  { id: 'chime', label: 'Chimes', blurb: 'The tune for a finished sprint, a reached goal and a new badge. Compose your own.' },
  { id: 'confetti', label: 'Confetti', blurb: 'What bursts out when you earn points, finish a goal or buy something. Make your own below.' },
  { id: 'shape', label: 'Comment shapes', blurb: 'How comment cards and marked text look. Design your own.' },
  { id: 'skin', label: 'Window skins', blurb: 'The frame around the header and windows.' },
  { id: 'cover', label: 'Covers', blurb: 'Covers for your documents on the home page.' },
  { id: 'shelf', label: 'Badge shelf', blurb: 'Where your badges stand. Streaks unlock the rarest styles.' },
];

// the built-in key sounds this writer has: free ones, bought ones, earned ones
export const ownedKeystrokes = (unlocked: string[] = [], badges: string[] = []): string[] =>
  CATALOG.filter(i => i.category === 'keystroke' && isOwned(i, unlocked, badges)).map(i => i.id.slice('keystroke-'.length));
