// sizes offered for selected text, in pixels (the document's own size is set in appearance → type).
export const TEXT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

export const MIN_SIZE = 6;
export const MAX_SIZE = 200;

export const clampSize = (n: number) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(n)));

// the next size up or down from wherever the text is now, even if it is not on the list.
export function stepSize(current: number, direction: 1 | -1): number {
  const sizes = TEXT_SIZES;
  if (direction === 1) return sizes.find(s => s > current) ?? clampSize(current + 4);
  const smaller = [...sizes].reverse().find(s => s < current);
  return smaller ?? clampSize(current - 1);
}

// accepts "18", "18px", "18.4" and rejects the rest.
export function parseSize(text: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:px|pt)?\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= MIN_SIZE && n <= MAX_SIZE ? Math.round(n) : null;
}
