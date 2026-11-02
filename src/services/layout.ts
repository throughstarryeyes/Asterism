// what the writer can turn off: tool cards on home, and buttons in a document's top bar.
// the editor, the appearance button and the menu are always there, so nothing can be lost.

export interface LayoutItem { id: string; label: string }

export const BAR_ITEMS: LayoutItem[] = [
  { id: 'zen', label: 'Zen' },
  { id: 'book', label: 'Book' },
  { id: 'map', label: 'Map' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'points', label: 'Quill Points' },
  { id: 'shop', label: 'Shop' },
  { id: 'count', label: 'Word count' },
];

export const isShown = (hidden: string[] | undefined, id: string) => !(hidden ?? []).includes(id);

export const toggleHidden = (hidden: string[] | undefined, id: string): string[] => {
  const list = hidden ?? [];
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id];
};
