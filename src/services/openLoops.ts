import { quotedFlags, splitSentences, type CoachUnit, type EntityIndex } from './coach/entities';
import { anyPhrase, getDefaultKnowledge, phraseRegex, type CoachKnowledge } from './coach/knowledge';
import { DEFAULT_STORY_LEXICON } from '../data/defaultStoryLexicon';
import type { StoryLexiconConfig } from '../types';

// open loops: questions, promises, secrets and warnings a story sets going that a reader expects back
// one detector finds them and where each is picked up; an unanswered loop is a question, not a mistake

export type LoopKind = 'question' | 'promise' | 'secret' | 'warning' | 'object';

// one place in the manuscript.
export interface LoopSite {
  unitIndex: number;
  unitId: string;
  unitTitle: string;
  chapterId: string;
  sentence: string;
}

export interface OpenLoop extends LoopSite {
  id: string;
  kind: LoopKind;
  // the words that say what it is about.
  subject: string[];
  // false when there is too little to go on to say whether anything picked it up.
  judgeable: boolean;
  // questions: asked aloud by a character (true) or by the narration (false).
  spoken?: boolean;
  // objects: the thing that was handled.
  item?: string;
  // where it was raised. objects can be handled in several scenes.
  mentions: LoopSite[];
  // later passages that pick it up again (the best few), and every later scene that does.
  followUps: LoopSite[];
  followUpUnits: number[];
  // scenes since it was raised.
  age: number;
}

export interface OpenLoopOptions {
  knowledge?: CoachKnowledge;
  lexicon?: StoryLexiconConfig;
}

export const shortHash = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

// everyday words that say nothing about what a question or promise is about.
const TOKEN_STOP = new Set([
  'about', 'after', 'again', 'also', 'always', 'asked', 'back', 'been', 'before', 'being', 'came', 'cant', 'come', 'could',
  'didnt', 'does', 'doing', 'done', 'dont', 'from', 'going', 'gone', 'have', 'having', 'here', 'into', 'just', 'know', 'like',
  'made', 'make', 'more', 'most', 'much', 'must', 'never', 'only', 'over', 'really', 'said', 'shall', 'should', 'some', 'such',
  'take', 'tell', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'told',
  'took', 'under', 'very', 'want', 'were', 'what', 'when', 'where', 'which', 'while', 'whom', 'whose', 'will', 'with',
  'wont', 'would', 'your', 'yours'
]);

// a question in the narration opens like one ("How long had he been there?"), after any "Oh," or "Fuck,"
// a statement that merely ends in a question mark ("...normal again?") is a style choice
const QUESTION_OPENER = /^(?:who|what|when|where|why|how|which|whose|whom|did|do|does|was|were|is|are|had|has|have|could|would|should|can|will|shall|might|may|am|isn’t|wasn’t|didn’t|doesn’t|couldn’t|wouldn’t|won’t|weren’t|aren’t|hadn’t|hasn’t)\b/i;
export const startsAsQuestion = (sentence: string) => QUESTION_OPENER.test(sentence.trim().replace(/^\W*(?:\w+,\s+)?/, '').replace(/^\W+/, ''));

// compare words by their first letters so "promise", "promised" and "promises" match.
function tokenKey(word: string): string {
  const base = word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
  return base.slice(0, 6);
}

// words that make a promise a promise; what it is about is everything else.
const COMMITMENT_KEYS = new Set(['promise', 'swear', 'meet', 'meeting', 'call', 'talk', 'talking'].map(tokenKey));

// the words in a passage that say what it is about, leaving out names (they are in every scene).
export function contentTokens(text: string, skip: ReadonlySet<string> = new Set()): string[] {
  const words = text.toLowerCase().replace(/['’]s\b/g, '').replace(/['’]/g, '').split(/[^a-z]+/);
  return Array.from(new Set(words.filter(w => w.length > 3 && !TOKEN_STOP.has(w) && !skip.has(w)).map(tokenKey)));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HANDLING_VERBS = 'slipped|slid|tucked|hid|hidden|stashed|shoved|pressed|locked|concealed|placed|dropped|pocketed|clutched|gripped|unfolded|unwrapped|retrieved';
const HANDLED = new RegExp(`\\b(?:${HANDLING_VERBS})\\s+(?:the|a|an|his|her|my|their)\\s+((?:[a-z'’-]+\\s+){0,2}[a-z'’-]+)`, 'gi');
const PREPOSITIONS = new Set(['into', 'in', 'on', 'under', 'behind', 'inside', 'against', 'from', 'with', 'at', 'to', 'beneath', 'beside', 'away', 'between', 'onto', 'over', 'through', 'and', 'before', 'after']);

// the words that are people's names, which are in every scene and say nothing about a subject.
const nameWordsOf = (index: EntityIndex): Set<string> =>
  new Set(
    index.entities
      .flatMap(e => [e.canonical, ...e.aliases])
      .flatMap(n => n.toLowerCase().replace(/['’]s\b/g, '').split(/\s+/))
      .filter(Boolean)
  );

export interface RelatedPassage extends LoopSite {
  hits: number;
}

// later passages about the same things as the text (at least minHits subject words, and 40% of them)
// in reading order; a suggestion to show the writer, never proof
export function findRelatedPassages(
  units: CoachUnit[],
  index: EntityIndex,
  text: string,
  afterUnit: number,
  options: { minHits?: number; limit?: number } = {}
): RelatedPassage[] {
  const minHits = options.minHits ?? 2;
  const limit = options.limit ?? 8;
  const skip = nameWordsOf(index);
  const subject = contentTokens(text, skip);
  if (subject.length < minHits) return [];
  const need = Math.max(minHits, Math.ceil(subject.length * 0.4));

  const found: RelatedPassage[] = [];
  units.forEach(unit => {
    if (unit.index <= afterUnit) return;
    splitSentences(unit.plainText).forEach(sentence => {
      const have = new Set(contentTokens(sentence, skip));
      const hits = subject.filter(t => have.has(t)).length;
      if (hits >= need) {
        found.push({ unitIndex: unit.index, unitId: unit.id, unitTitle: unit.title, chapterId: unit.chapterId, sentence, hits });
      }
    });
  });
  const best = [...found].sort((a, b) => b.hits - a.hits).slice(0, limit);
  return best.sort((a, b) => a.unitIndex - b.unitIndex);
}

export function detectOpenLoops(units: CoachUnit[], index: EntityIndex, options: OpenLoopOptions = {}): OpenLoop[] {
  const knowledge = options.knowledge ?? getDefaultKnowledge();
  const lexicon = options.lexicon ?? DEFAULT_STORY_LEXICON;
  const last = units.length - 1;

  const skip = nameWordsOf(index);

  // each scene's sentences, with the words that say what they are about.
  const prepared = units.map(unit => {
    const sentences = splitSentences(unit.plainText);
    const spoken = quotedFlags(sentences);
    return sentences.map((sentence, i) => ({ sentence, tokens: new Set(contentTokens(sentence, skip)), spoken: spoken[i] }));
  });

  const site = (position: number, sentence: string): LoopSite => {
    const unit = units[position];
    return { unitIndex: unit.index, unitId: unit.id, unitTitle: unit.title, chapterId: unit.chapterId, sentence };
  };

  // a later sentence picks a loop back up when it shares at least `minHits` of its subject
  // words and 40% of them. one everyday word in common is not a follow-up.
  const followUpsFor = (subject: string[], position: number, minHits: number) => {
    const sites: Array<{ site: LoopSite; hits: number }> = [];
    const unitsHit: number[] = [];
    if (subject.length < minHits) return { sites: [] as LoopSite[], unitsHit };
    const need = Math.max(minHits, Math.ceil(subject.length * 0.4));
    for (let u = position + 1; u < units.length; u++) {
      let best: { sentence: string; hits: number } | null = null;
      for (const p of prepared[u]) {
        const hits = subject.filter(t => p.tokens.has(t)).length;
        if (hits >= need && (!best || hits > best.hits)) best = { sentence: p.sentence, hits };
      }
      if (best) {
        unitsHit.push(units[u].index);
        sites.push({ site: site(u, best.sentence), hits: best.hits });
      }
    }
    return { sites: sites.sort((a, b) => b.hits - a.hits).slice(0, 3).map(s => s.site), unitsHit };
  };

  const promiseRe = anyPhrase([...knowledge.board.promise, ...lexicon.commitmentPhrases]);
  const secretRe = anyPhrase(knowledge.board.secret);
  const warningRe = anyPhrase(knowledge.board.warning);
  // lowercase mystery phrases ("wondered if anyone had seen") are narration and need no question mark
  // capitalized ones ("Who sent this") are questions someone asks
  const mystery = lexicon.mysteryInquiries
    .filter(p => p.trim())
    .map(p => ({ re: phraseRegex(p), narration: /^[a-z]/.test(p.trim()) }));

  const loops: OpenLoop[] = [];

  const push = (kind: LoopKind, position: number, sentence: string, id: string, extra: Partial<OpenLoop> = {}) => {
    let subject = contentTokens(sentence, skip);
    if (kind === 'promise') subject = subject.filter(t => !COMMITMENT_KEYS.has(t));
    const minHits = kind === 'question' ? 2 : 1;
    const { sites, unitsHit } = followUpsFor(subject, position, minHits);
    const here = site(position, sentence);
    loops.push({
      ...here,
      id,
      kind,
      subject,
      judgeable: subject.length >= minHits,
      mentions: [here],
      followUps: sites,
      followUpUnits: unitsHit,
      age: last - position,
      ...extra
    });
  };

  units.forEach((unit, position) => {
    prepared[position].forEach(({ sentence, spoken }) => {
      const spokenMystery = mystery.find(m => m.re.test(sentence) && (sentence.includes('?') || m.narration));
      const narrationQuestion =
        !spokenMystery &&
        sentence.trim().endsWith('?') &&
        !spoken &&
        startsAsQuestion(sentence) &&
        sentence.split(/\s+/).length >= 4 &&
        contentTokens(sentence, skip).length >= 2;
      if (spokenMystery || narrationQuestion) {
        push('question', position, sentence, `board-q-${unit.index}-${shortHash(sentence)}`, { spoken: !!spokenMystery });
      }

      const kind: LoopKind | null = promiseRe?.test(sentence) ? 'promise' : secretRe?.test(sentence) ? 'secret' : warningRe?.test(sentence) ? 'warning' : null;
      if (kind) push(kind, position, sentence, `board-${unit.index}-${shortHash(sentence)}`);
    });
  });

  // objects handled with emphasis ("slipped the key into her pocket").
  const handled = new Map<string, { position: number; sites: LoopSite[] }>();
  units.forEach((unit, position) => {
    prepared[position].forEach(({ sentence }) => {
      for (const match of sentence.matchAll(HANDLED)) {
        const phrase: string[] = [];
        for (const word of match[1].toLowerCase().split(/\s+/)) {
          if (PREPOSITIONS.has(word)) break;
          phrase.push(word);
        }
        const text = phrase.join(' ');
        const noun = lexicon.tactileObjects.find(obj => new RegExp(`\\b${escapeRe(obj)}\\b`, 'i').test(text));
        if (!noun) continue;
        const entry = handled.get(noun) ?? { position, sites: [] };
        entry.sites.push(site(position, sentence));
        handled.set(noun, entry);
      }
    });
  });

  handled.forEach((entry, noun) => {
    const first = entry.sites[0];
    const mention = new RegExp(`\\b${escapeRe(noun.replace(/s$/, ''))}(?:s|es)?\\b`, 'i');
    const followUps: LoopSite[] = [];
    const unitsHit: number[] = [];
    for (let u = entry.position + 1; u < units.length; u++) {
      const found = prepared[u].find(p => mention.test(p.sentence));
      if (found) {
        unitsHit.push(units[u].index);
        followUps.push(site(u, found.sentence));
      }
    }
    loops.push({
      ...first,
      id: `board-obj-${noun}`,
      kind: 'object',
      item: noun,
      subject: [tokenKey(noun)],
      judgeable: true,
      mentions: entry.sites,
      followUps: followUps.slice(0, 3),
      followUpUnits: unitsHit,
      age: last - entry.position
    });
  });

  return loops.sort((a, b) => a.unitIndex - b.unitIndex);
}
