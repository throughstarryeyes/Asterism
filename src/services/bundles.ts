// a bundle the writer makes: a few things they already wear, saved together so one press wears them all again.
// the parts are cosmetic ids like 'texture-grain' or 'confetti-custom-123', the same ids a shop bundle lists.

export interface CustomBundle { id: string; name: string; items: string[] }

export const MAX_BUNDLE = 12;

export function cleanBundle(raw: Partial<CustomBundle> & { id: string }): CustomBundle {
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .filter((x): x is string => typeof x === 'string' && /^[a-z]+-[\w-]{1,80}$/i.test(x))
    .filter((x, i, all) => all.indexOf(x) === i)
    .slice(0, MAX_BUNDLE);
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' ? raw.name : '').replace(/[<>]/g, '').trim().slice(0, 24) || 'My bundle',
    items,
  };
}

// what is worn now, by shelf. each default (plain, none, the free pointer) is left out, since wearing nothing is not a look.
export interface WornStats {
  activeTexture?: string; activeEdge?: string; activeTrail?: string; activeCursor?: string; activeLoader?: string; activeSeparator?: string;
  activeFlourish?: string; activeShape?: string; activeSkin?: string; activeShelf?: string; activeCover?: string; activeCelebration?: string;
}

const WORN: Array<[keyof WornStats, string, string[]]> = [
  ['activeTexture', 'texture', ['plain']], ['activeEdge', 'edge', ['none']], ['activeTrail', 'trail', ['none']], ['activeCursor', 'cursor', ['default', 'auto']],
  ['activeLoader', 'loader', ['stars']], ['activeSeparator', 'separator', ['stars']], ['activeFlourish', 'flourish', ['none']], ['activeShape', 'shape', ['plain']],
  ['activeSkin', 'skin', ['plain']], ['activeShelf', 'shelf', ['plain']], ['activeCover', 'cover', ['plain']], ['activeCelebration', 'confetti', ['classic']],
];

export function wornIds(stats: WornStats): string[] {
  return WORN.flatMap(([field, category, defaults]) => {
    const v = stats[field];
    return v && !defaults.includes(v) ? [`${category}-${v}`] : [];
  });
}

// the category and the value of a cosmetic id
export const splitId = (id: string): { category: string; value: string } => ({ category: id.slice(0, id.indexOf('-')), value: id.slice(id.indexOf('-') + 1) });
