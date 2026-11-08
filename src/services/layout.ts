// what the writer can change: tool cards on home, the buttons in a document's top bar, and the pieces of the bar along the bottom.
// essential buttons cannot be taken away, so the writer can never lock themselves out of editing, zen mode or the menu.

export interface LayoutItem { id: string; label: string; essential?: boolean }

// the view buttons that sit together in the top bar, in their default order. they can be moved around.
export const BAR_VIEWS: LayoutItem[] = [
  { id: 'editor', label: 'Editor', essential: true },
  { id: 'zen', label: 'Zen', essential: true },
  { id: 'book', label: 'Book' },
  { id: 'map', label: 'Map' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'play', label: 'Play' },
];

// everything else up there. all of it is reachable from the menu, home or the sidebar too.
export const BAR_EXTRAS: LayoutItem[] = [
  { id: 'sprint', label: 'Sprint' },
  { id: 'points', label: 'Quill Points' },
  { id: 'shop', label: 'Shop' },
  { id: 'count', label: 'Word count' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'saved', label: 'Saved and history' },
  { id: 'title', label: 'Document title' },
];

// kept for the checkbox list: every top bar item that can be turned off
export const BAR_ITEMS: LayoutItem[] = [...BAR_VIEWS, ...BAR_EXTRAS].filter(i => !i.essential);

// the writing-session bar along the bottom of the editor
export const CAPSULE_ITEMS: LayoutItem[] = [
  { id: 'timer', label: 'Timer' },
  { id: 'words', label: 'Words this session' },
  { id: 'scroll', label: 'Scroll mode' },
  { id: 'sounds', label: 'Key and ambient sounds' },
  { id: 'notes', label: 'Notes count' },
];

export const isShown = (hidden: string[] | undefined, id: string) => !(hidden ?? []).includes(id);

export const toggleHidden = (hidden: string[] | undefined, id: string): string[] => {
  const list = hidden ?? [];
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
};

// the ids in the order the writer chose; anything they have not placed yet keeps its default spot after the rest
export function inOrder<T extends { id: string }>(items: T[], order: string[] | undefined): T[] {
  const rank = (id: string) => { const i = (order ?? []).indexOf(id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.i - b.i).map(x => x.item);
}

// move one item a step earlier (-1) or later (1); returns the whole new order
export function moveInOrder(items: Array<{ id: string }>, order: string[] | undefined, id: string, step: -1 | 1): string[] {
  const ids = inOrder(items, order).map(i => i.id);
  const at = ids.indexOf(id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= ids.length) return ids;
  [ids[at], ids[to]] = [ids[to], ids[at]];
  return ids;
}
