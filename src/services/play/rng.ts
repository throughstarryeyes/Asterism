// small helpers every game shares. every random choice takes a random source, so a test can fix the outcome.
export type Rng = () => number;

export const pick = <T,>(items: readonly T[], rng: Rng = Math.random): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

// n different items, in random order; fewer if there are not enough
export function pickDistinct<T>(items: readonly T[], n: number, rng: Rng = Math.random): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.min(pool.length - 1, Math.floor(rng() * pool.length)), 1)[0]);
  return out;
}

export const shuffle = <T,>(items: readonly T[], rng: Rng = Math.random): T[] => pickDistinct(items, items.length, rng);

// a die of `sides` sides: 1 to sides
export const roll = (sides: number, rng: Rng = Math.random) => 1 + Math.min(sides - 1, Math.floor(rng() * sides));

// puts names into a line: "{A} finds {B}'s letter". anything not given stays as written.
export const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

// "Mara" -> "Mara's", "James" -> "James'"
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// plain text to the html the editor keeps: blank lines make paragraphs, single line breaks stay in the paragraph
export const textToHtml = (text: string) =>
  text.trim().split(/\n{2,}/).map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`).join('');

// the other direction, for showing a saved scene as text
export const htmlToText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
