import type { FoundationCard } from '../../types';
import { getDefaultKnowledge } from '../coach/knowledge';

// prompt filters: themes found by looking for words in each prompt
// an approximation, since the prompts have no categories; a prompt can match several

export type PromptThemes = Record<string, string[]>;

// each theme is a list of word beginnings, so "remember" also finds "remembers".
const compiledThemes = new WeakMap<PromptThemes, Array<[string, RegExp | null]>>();
function compileThemes(themes: PromptThemes): Array<[string, RegExp | null]> {
  let out = compiledThemes.get(themes);
  if (!out) {
    out = Object.entries(themes).map(([name, list]) => [
      name,
      list.length ? new RegExp(`\\b(?:${list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i') : null,
    ]);
    compiledThemes.set(themes, out);
  }
  return out;
}

const DEFAULT_THEMES = getDefaultKnowledge().promptThemes;
export const PROMPT_THEME_NAMES = Object.keys(DEFAULT_THEMES);

export function themesOf(prompt: string, themes: PromptThemes = DEFAULT_THEMES): string[] {
  return compileThemes(themes).filter(([, re]) => re && re.test(prompt)).map(([name]) => name);
}

export type PromptLength = 'any' | 'short' | 'medium' | 'long';

export function promptLength(prompt: string): Exclude<PromptLength, 'any'> {
  const words = prompt.trim().split(/\s+/).length;
  return words <= 12 ? 'short' : words <= 22 ? 'medium' : 'long';
}

export interface PromptFilter {
  themes?: string[];
  length?: PromptLength;
  search?: string;
}

// a prompt must match every chosen theme, the length, and the search words.
export function filterPrompts(prompts: readonly string[], f: PromptFilter = {}, themes: PromptThemes = DEFAULT_THEMES): string[] {
  const words = (f.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return prompts.filter(p => {
    if (f.length && f.length !== 'any' && promptLength(p) !== f.length) return false;
    if (f.themes?.length) {
      const mine = themesOf(p, themes);
      if (!f.themes.every(t => mine.includes(t))) return false;
    }
    const lower = p.toLowerCase();
    return words.every(w => lower.includes(w));
  });
}

// ---- card filters ----------------------------------------------------------

export interface CardFilter {
  category?: string;
  tags?: string[];
  search?: string;
}

export function filterCards(cards: readonly FoundationCard[], f: CardFilter = {}): FoundationCard[] {
  const words = (f.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter(c => {
    if (f.category && f.category !== 'all' && c.category !== f.category) return false;
    if (f.tags?.length && !f.tags.every(t => c.tags?.includes(t))) return false;
    if (!words.length) return true;
    const haystack = `${c.title} ${c.prompt} ${c.deepeningQuestions.join(' ')}`.toLowerCase();
    return words.every(w => haystack.includes(w));
  });
}

// the tags worth offering as filters, most common first.
export function tagCounts(cards: readonly FoundationCard[], limit = 16): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  cards.forEach(c => c.tags?.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}
