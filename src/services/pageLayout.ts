// how wide the page is and how much space sits inside its edges.
export interface PageLayout {
  // the page's widest size, in pixels.
  width: number;
  // space inside the left and right edges, and at the top.
  marginX: number;
  marginY: number;
}

export const DEFAULT_PAGE: PageLayout = { width: 840, marginX: 64, marginY: 64 };

export const PAGE_LIMITS = {
  width: [520, 1200],
  marginX: [16, 160],
  marginY: [16, 160],
} as const;

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;

// accepts anything (an old save, a bad value) and returns a usable layout.
export function normalizePage(raw: unknown): PageLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    width: clamp(r.width, PAGE_LIMITS.width, DEFAULT_PAGE.width),
    marginX: clamp(r.marginX, PAGE_LIMITS.marginX, DEFAULT_PAGE.marginX),
    marginY: clamp(r.marginY, PAGE_LIMITS.marginY, DEFAULT_PAGE.marginY),
  };
}

export const PAGE_PRESETS: Array<{ name: string; page: PageLayout }> = [
  { name: 'Wide margins', page: { width: 700, marginX: 96, marginY: 64 } },
  { name: 'Normal', page: DEFAULT_PAGE },
  { name: 'Narrow margins', page: { width: 1040, marginX: 36, marginY: 48 } },
];

export function pageVars(page: PageLayout): Record<string, string> {
  const p = normalizePage(page);
  return { '--page-width': `${p.width}px`, '--page-margin-x': `${p.marginX}px`, '--page-margin-y': `${p.marginY}px` };
}

export const samePage = (a: PageLayout, b: PageLayout) => a.width === b.width && a.marginX === b.marginX && a.marginY === b.marginY;
