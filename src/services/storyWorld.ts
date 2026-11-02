import type { AnalysisFinding, LocationProfile, LoreEntry, StoryBible } from '../types';
import type { CoachUnit } from './coach/entities';
import { appearsInScenes } from './characterDevelopment';

// the places and lore in the story bible, and whether the manuscript uses them
// a question, never a verdict: an entry can be planned for later on purpose

const MAX_PER_KIND = 6;
// a bible that is far ahead of a short draft would only list everything
const MIN_SCENES = 5;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const bare = (name: string) => name.replace(/^the\s+/i, '').trim();

// the names a bible entry goes by, for telling places and groups apart from people
export function worldNames(bible: Pick<StoryBible, 'locations' | 'lore'>): string[] {
  const names = [
    ...(bible.locations ?? []).flatMap(l => [l.name, ...(l.aliases ?? [])]),
    ...(bible.lore ?? []).map(l => l.title),
  ];
  return [...new Set(names.map(n => bare(n)).filter(n => n.length >= 3))];
}

export interface WorldSource {
  units: CoachUnit[];
  bible: Pick<StoryBible, 'locations' | 'lore'>;
}

// the foundations setting cards (data/museFoundations): where, and why
const CARD = { place: 'setting-where-1', lore: 'setting-why-1' } as const;

export function worldFindings(src: WorldSource): AnalysisFinding[] {
  if (src.units.length < MIN_SCENES) return [];
  const text = src.units.map(u => u.plainText).join('\n');
  const all = new Set(src.units.map(u => u.index));
  const named = (name: string) => new RegExp(`\\b${escapeRe(bare(name))}\\b`, 'i').test(text);

  const places: AnalysisFinding[] = [];
  (src.bible.locations ?? []).forEach((place: LocationProfile) => {
    const names = [place.name, ...(place.aliases ?? [])].filter(n => bare(n).length >= 3);
    if (names.length === 0 || names.some(named)) return;
    places.push({
      id: `finding-world-place-${slug(place.name)}`, category: 'expansion', confidence: 'possible_exploration', status: 'unreviewed',
      title: `World: “${place.name}” isn’t in the manuscript yet`,
      summary: `${place.name} is in your Story Bible${place.significance ? ` (${place.significance.trim().replace(/\.$/, '')})` : ''}, but no scene names it${(place.aliases ?? []).length ? ' or any of its other names' : ''}. Is it planned for later, or should it come into a scene?`,
      evidencePassages: [], linkedFoundationCardId: CARD.place,
    });
  });

  const lore: AnalysisFinding[] = [];
  (src.bible.lore ?? []).forEach((entry: LoreEntry) => {
    const title = bare(entry.title);
    if (title.length < 3 || named(entry.title)) return;
    // an idea rather than a name ("Magic costs") shows up in other words, so look for its words together
    if (/\s/.test(title) && appearsInScenes(title, src.units, all, []) === true) return;
    lore.push({
      id: `finding-world-lore-${slug(entry.title)}`, category: 'expansion', confidence: 'possible_exploration', status: 'unreviewed',
      title: `World: “${entry.title}” doesn’t show up yet`,
      summary: `“${entry.title}” is in your Story Bible, but I can’t find it or its words in any scene. Is it background for you, or should the reader meet it?`,
      evidencePassages: [], linkedFoundationCardId: CARD.lore,
    });
  });

  return [...places.slice(0, MAX_PER_KIND), ...lore.slice(0, MAX_PER_KIND)];
}
