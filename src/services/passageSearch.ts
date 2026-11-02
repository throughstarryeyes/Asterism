// finding quotes are often cut short, spaced differently or edited since
// so try the whole quote, then shorter and shorter openings

const STEPS = [140, 90, 60, 40, 26];

export function normalizeQuote(quote: string): string {
  return quote
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…|\.\.\.$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// strings to search for, best first. cuts happen at a word boundary.
export function quoteCandidates(quote: string): string[] {
  const text = normalizeQuote(quote);
  if (text.length < 8) return text ? [text] : [];
  const out: string[] = [];
  const add = (s: string) => { const t = s.trim(); if (t.length >= 8 && !out.includes(t)) out.push(t); };
  add(text);
  for (const n of STEPS) {
    if (text.length <= n) continue;
    const cut = text.slice(0, n);
    const lastSpace = cut.lastIndexOf(' ');
    add(lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut);
  }
  return out;
}

// search text from the page is in curly quotes and runs of whitespace; make it comparable.
export function normalizeForSearch(text: string): string {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
}

// the text of a finding, shaped for a comment on the passage.
export function commentTextFor(title: string, body?: string): string {
  const t = title.replace(/\s+/g, ' ').trim();
  const b = (body ?? '').replace(/\s+/g, ' ').trim();
  const text = b ? `${t}: ${b}` : t;
  return text.length > 400 ? `${text.slice(0, 397)}…` : text;
}
