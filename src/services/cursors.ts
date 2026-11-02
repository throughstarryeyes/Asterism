// pointers the shop sells. each is one glyph drawn as a small picture; uploaded ones live in customCursor.ts

export interface CursorPreset {
  id: string;
  name: string;
  glyph: string;
  cost: number;
  description: string;
  // the sharp point inside the 24 px picture
  hot: [number, number];
}

export const PRESET_CURSORS: CursorPreset[] = [
  { id: 'default', name: 'Standard Caret', glyph: 'I', cost: 0, description: 'The plain pointer your computer already has.', hot: [0, 0] },
  { id: 'quill', name: 'Golden Quill', glyph: '✒️', cost: 0, description: 'A feathered quill for writing with vintage flair.', hot: [2, 22] },
  { id: 'golden_nib', name: 'Calligrapher’s Nib', glyph: '🖋️', cost: 35, description: 'A sharp fountain pen nib for crisp precision.', hot: [2, 22] },
  { id: 'pencil', name: 'Pencil', glyph: '✏️', cost: 30, description: 'A sharp pencil. Erasers sold separately.', hot: [2, 22] },
  { id: 'feather', name: 'Feather', glyph: '🪶', cost: 30, description: 'A light feather for light drafts.', hot: [2, 22] },
  { id: 'wand', name: 'Starlight Wand', glyph: '🪄', cost: 40, description: 'A small wand that points where the magic goes.', hot: [2, 2] },
  { id: 'star', name: 'Gold Star', glyph: '⭐', cost: 40, description: 'Every click earns a star.', hot: [12, 12] },
  { id: 'heart', name: 'Heart', glyph: '💖', cost: 40, description: 'Write with love.', hot: [12, 12] },
  { id: 'moon', name: 'Crescent Moon', glyph: '🌙', cost: 50, description: 'For midnight sessions.', hot: [12, 12] },
  { id: 'sparkles', name: 'Sparkles', glyph: '✨', cost: 60, description: 'A cluster of glints.', hot: [12, 12] },
  { id: 'gem', name: 'Gemstone', glyph: '💎', cost: 100, description: 'Cut and polished.', hot: [12, 12] },
  { id: 'crystal', name: 'Crystal Ball', glyph: '🔮', cost: 150, description: 'See what the next scene holds.', hot: [12, 12] },
];

// the value for the CSS `cursor` property. the default is the browser's own.
export function presetCursorCss(p: CursorPreset): string {
  if (p.id === 'default') return 'auto';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><text y='19' font-size='18'>${p.glyph}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${p.hot[0]} ${p.hot[1]}, auto`;
}

export const findCursorPreset = (id: string | undefined) => PRESET_CURSORS.find(c => c.id === id);
