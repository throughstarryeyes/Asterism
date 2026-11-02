// "Words added this session": how much longer the manuscript is than when you sat down.
// each chapter's starting word count is remembered the first time it is seen.

interface HasWords { id: string; wordCount?: number }

export type Baseline = Record<string, number>;

// remember starting counts for any chapter not seen yet. returns the same object if nothing is new.
export function withBaselines(baseline: Baseline, chapters: HasWords[]): Baseline {
  let next: Baseline | null = null;
  for (const c of chapters) {
    if (!(c.id in baseline) && !(next && c.id in next)) {
      next = next ?? { ...baseline };
      next[c.id] = c.wordCount || 0;
    }
  }
  return next ?? baseline;
}

// net words gained across the manuscript. never negative, so deleting a lot does not show "-300".
export function wordsAddedThisSession(chapters: HasWords[], baseline: Baseline): number {
  const net = chapters.reduce((sum, c) => {
    const now = c.wordCount || 0;
    return sum + now - (c.id in baseline ? baseline[c.id] : now);
  }, 0);
  return Math.max(0, net);
}
