// custom tags on a document, in place of a fixed genre
// the writer makes their own; the old genres are only suggestions

export const SUGGESTED_TAGS = ['Fiction', 'Fantasy', 'Mystery', 'Sci-Fi', 'Horror', 'Thriller', 'Romance', 'Literary Fiction', 'Historical Fiction', 'Memoir', 'Poetry', 'Drama', 'Academic'];

export const MAX_TAGS = 12;

export const normalizeTag = (text: string) => text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 32);

export const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// add a tag unless it is empty or already there (any capitalization); the first spelling stays
export function addTag(tags: string[] | undefined, tag: string): string[] {
  const clean = normalizeTag(tag);
  const list = tags ?? [];
  if (!clean || list.some(t => sameTag(t, clean)) || list.length >= MAX_TAGS) return list;
  return [...list, clean];
}

export const removeTag = (tags: string[] | undefined, tag: string): string[] => (tags ?? []).filter(t => !sameTag(t, tag));

// a document saved with a genre keeps it, as a tag
export function withGenreAsTag<T extends { genre?: string; tags?: string[] }>(doc: T): T {
  const genre = doc.genre?.trim() ?? '';
  const tags = (doc.tags ?? []).map(normalizeTag).filter(Boolean);
  if (!genre) return { ...doc, genre: '', tags };
  return { ...doc, genre: '', tags: addTag(tags, genre) };
}

export interface TagCount { tag: string; count: number }

// every tag in use, most used first; spellings that differ only in capitals count as one
export function tagCounts(projects: Array<{ tags?: string[] }>): TagCount[] {
  const found = new Map<string, { counts: Map<string, number>; count: number }>();
  for (const p of projects) {
    for (const tag of p.tags ?? []) {
      const key = tag.toLowerCase();
      const entry = found.get(key) ?? { counts: new Map(), count: 0 };
      entry.count++;
      entry.counts.set(tag, (entry.counts.get(tag) ?? 0) + 1);
      found.set(key, entry);
    }
  }
  return [...found.values()]
    .map(({ counts, count }) => ({ tag: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0], count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// a document has all of the chosen tags
export const hasAllTags = (project: { tags?: string[] }, chosen: string[]) =>
  chosen.every(c => (project.tags ?? []).some(t => sameTag(t, c)));

// tags worth offering next to the ones a document has: the writer's own first, then the common ones
export function suggestionsFor(current: string[] | undefined, inUse: TagCount[], limit = 10): string[] {
  const out: string[] = [];
  for (const t of [...inUse.map(x => x.tag), ...SUGGESTED_TAGS]) {
    if ((current ?? []).some(c => sameTag(c, t)) || out.some(o => sameTag(o, t))) continue;
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

// rename a tag in one document's list; if the new name is already there, the two become one
export function renameTag(tags: string[] | undefined, from: string, to: string): string[] {
  const clean = normalizeTag(to);
  if (!clean) return tags ?? [];
  const out: string[] = [];
  for (const t of tags ?? []) {
    const next = sameTag(t, from) ? clean : t;
    if (!out.some(o => sameTag(o, next))) out.push(next);
  }
  return out;
}

// documents whose tags change when a tag is renamed (to '' means deleted), with their new tags
export function retag(projects: Array<{ id: string; tags?: string[] }>, from: string, to: string): Array<{ id: string; tags: string[] }> {
  const changes: Array<{ id: string; tags: string[] }> = [];
  for (const p of projects) {
    if (!(p.tags ?? []).some(t => sameTag(t, from))) continue;
    changes.push({ id: p.id, tags: normalizeTag(to) ? renameTag(p.tags, from, to) : removeTag(p.tags, from) });
  }
  return changes;
}
