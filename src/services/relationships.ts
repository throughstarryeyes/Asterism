import type { CharacterProfile } from '../types';

// how two characters are connected, as tags the writer picks and the analyzer reads
// a relationship is kept on a character's card; the analyzer reads both cards of a pair

export const RELATIONSHIP_TAGS = [
  { id: 'familial', label: 'Family', hint: 'Parents, siblings, cousins, in-laws' },
  { id: 'romantic', label: 'Romantic', hint: 'Partners, spouses, crushes' },
  { id: 'platonic', label: 'Friends', hint: 'Close, but not romantic' },
  { id: 'acquaintance', label: 'Acquaintances', hint: 'Know each other, not close' },
  { id: 'business', label: 'Business partners', hint: 'Work or money together' },
  { id: 'colleague', label: 'Colleagues', hint: 'Work in the same place' },
  { id: 'peer', label: 'Peers', hint: 'Equals in rank or standing' },
  { id: 'classmate', label: 'Classmates', hint: 'School or training together' },
  { id: 'mentor', label: 'Mentor', hint: 'They mentor this character' },
  { id: 'mentee', label: 'Mentee', hint: 'This character mentors them' },
  { id: 'rival', label: 'Rivals', hint: 'Competing with each other' },
  { id: 'enemy', label: 'Enemies', hint: 'Opposed, or out to harm' },
  { id: 'ex', label: 'Exes', hint: 'Used to be together' },
  { id: 'neighbor', label: 'Neighbors', hint: 'Live or work nearby' },
] as const;

const KNOWN = new Set<string>(RELATIONSHIP_TAGS.map(t => t.id));
export const tagLabel = (id: string) => RELATIONSHIP_TAGS.find(t => t.id === id)?.label ?? id;

// the tags that mean two people would plausibly share things and be seen together
const CLOSE = new Set(['familial', 'romantic', 'platonic', 'ex', 'mentor', 'mentee']);
export const isClose = (types: string[]) => types.some(t => CLOSE.has(t));

// tags that mean the two are expected to cross paths on the page
const EXPECTED_TOGETHER = new Set(['familial', 'romantic', 'platonic', 'mentor', 'mentee', 'classmate', 'colleague', 'business', 'rival', 'enemy']);
export const expectsScenes = (types: string[]) => types.some(t => EXPECTED_TOGETHER.has(t));

type Entry = CharacterProfile['relationships'][number];

// older cards only have free text ("Elder Brother & Mentor"); read the tags out of it
const WORDS: Array<[RegExp, string]> = [
  [/\b(?:brother|sister|sibling|mother|father|mom|dad|parent|son|daughter|cousin|aunt|uncle|grand\w*|niece|nephew|family|in-law|twin)\b/i, 'familial'],
  [/\b(?:lover|girlfriend|boyfriend|husband|wife|spouse|fianc\w*|crush|romantic|betrothed|sweetheart)\b/i, 'romantic'],
  [/\b(?:friend|best friend|companion|confidant)\w*/i, 'platonic'],
  [/\bacquaint\w*/i, 'acquaintance'],
  [/\bbusiness\b/i, 'business'],
  [/\b(?:colleague|coworker|co-worker)s?\b/i, 'colleague'],
  [/\bpeers?\b/i, 'peer'],
  [/\b(?:classmate|schoolmate)s?\b/i, 'classmate'],
  [/\b(?:mentor|teacher|tutor|guide)\b/i, 'mentor'],
  [/\b(?:mentee|student|apprentice|protégé|protege)\b/i, 'mentee'],
  [/\brival\w*/i, 'rival'],
  [/\b(?:enem\w+|nemesis|foe)\b/i, 'enemy'],
  [/\bex\b|\bformer (?:lover|partner|husband|wife)\b/i, 'ex'],
  [/\bneighbou?rs?\b/i, 'neighbor'],
];

export function tagsOf(entry: Pick<Entry, 'relationshipType'> & { types?: string[] }): string[] {
  if (entry.types) return entry.types;
  return WORDS.filter(([re]) => re.test(entry.relationshipType ?? '')).map(([, id]) => id);
}

const sameCharacter = (e: Entry, other: CharacterProfile) =>
  e.targetCharacterId === other.id || e.targetName.trim().toLowerCase() === other.name.trim().toLowerCase();

export interface Relation { types: string[]; notes: string[] }

// what the two cards say about this pair, together
export function relationBetween(a: CharacterProfile, b: CharacterProfile): Relation {
  const mine = (a.relationships ?? []).filter(e => sameCharacter(e, b));
  const theirs = (b.relationships ?? []).filter(e => sameCharacter(e, a));
  const entries = [...mine, ...theirs];
  return {
    types: [...new Set(entries.flatMap(tagsOf))],
    notes: entries.map(e => e.notes?.trim()).filter((n): n is string => !!n),
  };
}

// the writer's choice for one other character; an entry with no tags and no note is removed
export function withRelation(card: CharacterProfile, other: CharacterProfile, types: string[], notes: string): CharacterProfile {
  const rest = (card.relationships ?? []).filter(e => !sameCharacter(e, other));
  if (types.length === 0 && !notes.trim()) return { ...card, relationships: rest };
  const entry: Entry = {
    targetCharacterId: other.id,
    targetName: other.name,
    relationshipType: types.map(tagLabel).join(', '),
    notes,
    types,
  };
  return { ...card, relationships: [...rest, entry] };
}

export const cleanTag = (text: string) => text.replace(/[<>]/g, '').trim().toLowerCase().slice(0, 30);
export const isPresetTag = (id: string) => KNOWN.has(id);
