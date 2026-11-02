import type { AnalysisFinding, StoryBible, TimelineEvent } from '../types';
import { readTimeline } from './timeline';
import { normalizeQuote } from './passageSearch';

// what the manuscript says about each character, and where it disagrees with itself
// every result is a question for the writer, never a verdict

export interface FactUnit {
  index: number;
  title: string;
  chapterId: string;
  sentences: string[];
}

export interface FactCharacter {
  name: string;
  // matches every form the story uses for them (global, case-insensitive).
  pattern: RegExp;
}

export interface FactSource {
  units: FactUnit[];
  characters: FactCharacter[];
  lexicon: { eyeColors: string[]; hairColors: string[] };
  bible: StoryBible;
  timeline: TimelineEvent[];
  // statements the writer said are wrong or about someone else (see statementKey).
  ignored?: string[];
}

interface Statement {
  character: string;
  kind: string;
  key: string;
  unit: FactUnit;
  // place in the book: scene first, then sentence.
  order: number;
  sentence: string;
}

// what identifies one statement the manuscript makes. it changes when the sentence is edited, so a
// correction about a sentence ends when the sentence does.
export const statementKey = (kind: string, character: string, chapterId: string, sentence: string) =>
  `${kind}|${character.toLowerCase()}|${chapterId}|${sentence.replace(/\s+/g, ' ').trim()}`;

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const truncate = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
};

// ---- numbers --------------------------------------------------------------------------------

const ONES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const NUM = `(\\d{1,3}|(?:${TENS.join('|')})(?:[- ](?:${ONES.join('|')}))?|${[...TEENS, ...ONES].join('|')})`;

function toNumber(text: string): number | null {
  const t = text.toLowerCase().trim();
  if (/^\d+$/.test(t)) return Number(t);
  const [first, second] = t.split(/[- ]/);
  const ten = TENS.indexOf(first);
  if (ten >= 0) return (ten + 2) * 10 + (second ? ONES.indexOf(second) + 1 : 0);
  const teen = TEENS.indexOf(t);
  if (teen >= 0) return 10 + teen;
  const one = ONES.indexOf(t);
  return one >= 0 ? one + 1 : null;
}

// ---- extraction -----------------------------------------------------------------------------

// a sentence about disguise or change says nothing about how someone usually looks.
const CHANGED = /\b(dye[ds]?|dyeing|wig|bleach(?:ed)?|tinted|colou?red|contacts?|lenses|glamou?r|disguis\w+|make-?up|cosmetic)\b/i;
// talk of the past, a dream or a ghost is not how things stand in the scene.
const REMEMBERED = /\b(remember(?:ed|ing)?|memory|memories|dream(?:t|ed|ing)?|flashback|ghost|haunt\w*|recalled|imagin\w+)\b/i;
const PAST_REFERENCE = /\b(when|back then|used to|years ago|as a (?:child|girl|boy|kid)|at the time|by the time|long ago)\b/i;

const AGE_AFTER = [
  // Mara, 34, ...   Mara, aged 34, ...
  new RegExp(`^\\s*,\\s*(?:aged?\\s+)?${NUM}\\s*,`, 'i'),
  // Mara (34)   Mara (age 34)
  new RegExp(`^\\s*\\(\\s*(?:aged?\\s+)?${NUM}\\s*\\)`, 'i'),
  // Mara, a 34-year-old ...
  new RegExp(`^\\s*,\\s*(?:a|an|the)\\s+${NUM}[- ]years?[- ]old`, 'i')
];
const AGE_VERB = new RegExp(`^(?:\\s+\\w+){0,2}?\\s+(was|is|turned|turns)\\s+${NUM}(\\s+years?\\s+old)?`, 'i');
const AGE_BEFORE = new RegExp(`${NUM}[- ]years?[- ]old\\s+$`, 'i');

const SPEECH_VERB = '(?:said|asked|replied|whispered|shouted|called|answered|muttered|snapped|murmured|cried|laughed|sighed|added|says|asks)';
const SPEECH_AFTER = new RegExp(`^(?:\\s+\\w+)?\\s+${SPEECH_VERB}\\b`, 'i');
const SPEECH_BEFORE = new RegExp(`\\b${SPEECH_VERB}\\s+$`, 'i');
const DEATH_VERB = /^((?:\s+\w+){0,2}?)\s+(?:died|was killed|was murdered|was dead|had died|had been killed|passed away|drowned|bled out|was buried|was shot dead)\b/i;
const NOT_REALLY_DEAD = /\b(nearly|almost|never|not|could|would|might|about to|afraid|wished)\b/i;
const DEATH_BEFORE = /(?:killed|murdered|buried|mourned|mourning|funeral (?:of|for)|burial (?:of|for)|wake (?:of|for)|grave of)\s+$/i;
// "buried Val into his shoulder" is an embrace, not a burial
const HELD_CLOSE = /^\s+(?:into|against|in (?:his|her|their|my|your|the crook)|deep in|under (?:his|her|their|my|your))\b/i;
// "X’s body" alone is a living body ("he held Val’s body close"); only a body that is found, buried or lifeless counts
const DEATH_POSSESSIVE = /^['’]s\s+(?:death|funeral|burial|corpse|grave|murder|memorial|body\s+(?:was found|was recovered|was buried|lay (?:still|dead|lifeless)|was lifeless|was cold))\b/i;

const BODY = 'cheek|eyebrow|brow|hand|arm|forearm|wrist|shoulder|ear|eye|temple|jaw|leg|knee|ankle|foot|hip|ribs?|neck|palm|thigh|chin|lip';
const MARK_THEN_SIDE = new RegExp(`\\b(scar|tattoo|birthmark)\\b[^.;!?]{0,40}?\\b(left|right)\\s+(${BODY})\\b`, 'i');
const SIDE_THEN_MARK = new RegExp(`\\b(left|right)\\s+(${BODY})\\b[^.;!?]{0,30}?\\b(scar|tattoo|birthmark)\\b`, 'i');
const HANDED = /\b(left|right)[- ]handed\b/i;

type MarkStatement = Statement & { mark: string; part: string; value: string };

interface Facts {
  eyes: Map<string, Array<Statement & { value: string }>>;
  hair: Map<string, Array<Statement & { value: string }>>;
  ages: Map<string, Array<Statement & { value: number }>>;
  hands: Map<string, Array<Statement & { value: string }>>;
  marks: Map<string, MarkStatement[]>;
  deaths: Map<string, Statement>;
  speech: Map<string, Statement[]>;
}

function extract(src: FactSource, keepIgnored = false): Facts {
  const facts: Facts = { eyes: new Map(), hair: new Map(), ages: new Map(), hands: new Map(), marks: new Map(), deaths: new Map(), speech: new Map() };
  const skip = new Set(keepIgnored ? [] : src.ignored ?? []);
  const push = <T extends Statement>(map: Map<string, T[]>, item: T) => {
    if (skip.has(item.key)) return;
    map.set(item.character, [...(map.get(item.character) ?? []), item]);
  };

  const eyeAlts = src.lexicon.eyeColors.map(escape).join('|');
  const hairAlts = src.lexicon.hairColors.map(escape).join('|');
  const eyeRe = eyeAlts ? new RegExp(`\\b(${eyeAlts})\\s+eyes\\b`, 'i') : /\b(blue|green|brown|hazel|grey|gray|amber|violet)\s+eyes\b/i;
  const hairRe = hairAlts ? new RegExp(`\\b(${hairAlts})\\s+hair\\b`, 'i') : /\b(blonde|blond|black|brown|red|auburn|silver|grey|gray|white|golden|raven)\s+hair\b/i;

  src.units.forEach(unit => {
    let lastNamed: string | null = null;
    unit.sentences.forEach((sentence, position) => {
      const order = unit.index * 10_000 + position;
      const hits: Array<{ name: string; index: number; end: number }> = [];
      src.characters.forEach(c => {
        for (const m of sentence.matchAll(c.pattern)) hits.push({ name: c.name, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
      });
      hits.sort((a, b) => a.index - b.index);

      // who a description belongs to: the nearest name before it, or the last-named character after a pronoun
      const ownerAt = (at: number, possessive = false): string | null => {
        const before = hits.filter(h => h.index < at);
        if (before.length > 0) return before[before.length - 1].name;
        if (/^[“"']?(?:he|she|his|her|their|they)\b/i.test(sentence)) return lastNamed;
        return possessive ? lastNamed : null;
      };
      const statement = (character: string, kind: string): Statement => ({ character, kind, key: statementKey(kind, character, unit.chapterId, sentence), unit, order, sentence });
      const changed = CHANGED.test(sentence);

      const eye = changed ? null : sentence.match(eyeRe);
      if (eye) {
        const owner = ownerAt(eye.index ?? 0);
        if (owner) push(facts.eyes, { ...statement(owner, 'eyes'), value: eye[1].toLowerCase().replace('grey', 'gray') });
      }
      const hair = changed ? null : sentence.match(hairRe);
      if (hair) {
        const owner = ownerAt(hair.index ?? 0);
        if (owner) push(facts.hair, { ...statement(owner, 'hair'), value: hair[1].toLowerCase().replace('blond', 'blonde').replace('grey', 'gray') });
      }

      const hand = sentence.match(HANDED);
      if (hand) {
        const owner = ownerAt(hand.index ?? 0);
        if (owner) push(facts.hands, { ...statement(owner, 'hand'), value: hand[1].toLowerCase() });
      }

      const markThenSide = sentence.match(MARK_THEN_SIDE);
      const sideThenMark = markThenSide ? null : sentence.match(SIDE_THEN_MARK);
      if (markThenSide || sideThenMark) {
        const mark = (markThenSide ? markThenSide[1] : sideThenMark![3]).toLowerCase();
        const value = (markThenSide ? markThenSide[2] : sideThenMark![1]).toLowerCase();
        const part = (markThenSide ? markThenSide[3] : sideThenMark![2]).toLowerCase().replace(/^eyebrow$/, 'brow');
        const owner = ownerAt((markThenSide ?? sideThenMark)!.index ?? 0, true);
        if (owner) push(facts.marks, { ...statement(owner, 'mark'), mark, part, value });
      }

      // facts stated by naming the person: their age, their death, their speech.
      hits.forEach(hit => {
        const rest = sentence.slice(hit.end);
        const before = sentence.slice(0, hit.index);

        let age: number | null = null;
        for (const re of AGE_AFTER) {
          const m = rest.match(re);
          if (m) { age = toNumber(m[1]); break; }
        }
        if (age === null) {
          const m = rest.match(AGE_VERB);
          if (m) {
            const after = rest.slice(m[0].length);
            // "was twelve" needs to end there, or it is twelve of something ("twelve feet away").
            if (m[3] || /^(?:turned|turns)$/i.test(m[1]) || /^\s*(?:[.,;!?"”]|and\b|$)/.test(after)) age = toNumber(m[2]);
          }
        }
        if (age === null) {
          const m = before.match(AGE_BEFORE);
          if (m) age = toNumber(m[1]);
        }
        if (age !== null && age >= 1 && age <= 110 && !PAST_REFERENCE.test(before) && !changed) push(facts.ages, { ...statement(hit.name, 'age'), value: age });

        // a death: "Mara died", "killed Mara", "Mara's funeral". "Almost died" and "could have died" are not one.
        const died = rest.match(DEATH_VERB);
        const diedPlainly = !!died && !NOT_REALLY_DEAD.test(died[1]);
        const mourned = (DEATH_BEFORE.test(before) && !HELD_CLOSE.test(rest)) || DEATH_POSSESSIVE.test(rest);
        if ((diedPlainly || mourned) && !NOT_REALLY_DEAD.test(before.slice(-30)) && !facts.deaths.has(hit.name)) {
          const death = statement(hit.name, 'death');
          if (!skip.has(death.key)) facts.deaths.set(hit.name, death);
        }

        // speaking aloud: "Mara said", "Mara quietly asked", "said Mara".
        if ((SPEECH_AFTER.test(rest) || SPEECH_BEFORE.test(before)) && !REMEMBERED.test(sentence)) push(facts.speech, statement(hit.name, 'speech'));
      });

      if (hits.length > 0) lastNamed = hits[0].name;
    });
  });
  return facts;
}

// ---- checks ---------------------------------------------------------------------------------

type Confidence = AnalysisFinding['confidence'];

const evidence = (items: Statement[]) =>
  items.map(s => ({ chapterId: s.unit.chapterId, chapterTitle: s.unit.title, quote: truncate(s.sentence, 160) }));

function bibleColor(bible: StoryBible, name: string, regex: RegExp): string | null {
  const wanted = name.toLowerCase();
  const card = (bible?.characters ?? []).find(c => (c.name ?? '').trim().toLowerCase() === wanted || (c.aliases ?? []).some(a => a.trim().toLowerCase() === wanted));
  return card?.physicalDescription?.match(regex)?.[1]?.toLowerCase().replace('grey', 'gray').replace('blond', 'blonde') ?? null;
}

// the day each scene falls on (by scene index), for scenes the writer has linked to a dated timeline event
// in an open draft many scenes share one chapter, so the event's quote says which scene it is
export function sceneDays(timeline: TimelineEvent[], units: FactUnit[]): Map<number, number> {
  const days = new Map<number, number>();
  const text = new Map(units.map(u => [u.index, normalizeQuote(u.sentences.join(' ')).toLowerCase()]));
  readTimeline(timeline).forEach(r => {
    const { event, resolved } = r;
    if (!resolved || !event.chapterId) return;
    const inChapter = units.filter(u => u.chapterId === event.chapterId);
    const needle = normalizeQuote(event.quote ?? '').toLowerCase().slice(0, 60);
    const unit = (needle && inChapter.find(u => text.get(u.index)!.includes(needle))) || (inChapter.length === 1 ? inChapter[0] : undefined);
    if (unit && !days.has(unit.index)) days.set(unit.index, resolved.start);
  });
  return days;
}

export function characterContinuityFindings(src: FactSource): AnalysisFinding[] {
  const facts = extract(src);
  const findings: AnalysisFinding[] = [];
  const add = (subject: string, id: string, category: AnalysisFinding['category'], title: string, summary: string, items: Statement[], confidence: Confidence) =>
    findings.push({ id, category, title, summary, evidencePassages: evidence(items), confidence, status: 'unreviewed', subject });

  // eye and hair color, against the page and against the story bible.
  const color = (map: Facts['eyes'], noun: 'eyes' | 'hair', key: 'eyes' | 'hair', label: string) => {
    const alts = (noun === 'eyes' ? src.lexicon.eyeColors : src.lexicon.hairColors).map(escape).join('|');
    const bibleRe = alts ? new RegExp(`\\b(${alts})\\s+${noun}\\b`, 'i') : null;
    map.forEach((items, name) => {
      const seen = Array.from(new Set(items.map(i => i.value)));
      if (seen.length > 1) {
        add(
          name, `finding-contradiction-${key}-${slug(name)}`, 'contradiction',
          `Physical Continuity: ${name}’s ${label} (${seen.join(' vs ')})`,
          `${name} is described with conflicting ${noun === 'eyes' ? 'eye' : 'hair'} colors across different scenes (${seen.join(' vs ')}). Is this intentional lighting, an unreliable memory, or a continuity slip?`,
          items, 'definite'
        );
      }
      const stated = bibleRe ? bibleColor(src.bible, name, bibleRe) : null;
      if (stated && !seen.includes(stated)) {
        add(
          name, `finding-charfact-bible-${key}-${slug(name)}`, 'contradiction',
          `Story Bible: ${name}’s ${label} (${stated} vs ${seen.join(' / ')})`,
          `The Story Bible gives ${name} ${stated} ${noun}, but the manuscript says ${seen.join(' and ')}. Which one is right? Update the card or the scene.`,
          items, 'probable'
        );
      }
    });
  };
  color(facts.eyes, 'eyes', 'eyes', 'Eye Color');
  color(facts.hair, 'hair', 'hair', 'Hair Color');

  // left- or right-handed.
  facts.hands.forEach((items, name) => {
    const seen = Array.from(new Set(items.map(i => i.value)));
    if (seen.length > 1) {
      add(name, `finding-charfact-hand-${slug(name)}`, 'contradiction', `Physical Continuity: ${name}’s dominant hand`,
        `${name} is called both left-handed and right-handed. Is that on purpose, or did one slip in?`, items, 'probable');
    }
  });

  // a scar or tattoo that moves from one side to the other.
  const markGroups = new Map<string, MarkStatement[]>();
  facts.marks.forEach((items, name) => {
    items.forEach(item => {
      const key = `${name}|${item.mark}|${item.part}`;
      markGroups.set(key, [...(markGroups.get(key) ?? []), item]);
    });
  });
  markGroups.forEach((items, key) => {
    const sides = Array.from(new Set(items.map(i => i.value)));
    if (sides.length > 1) {
      const [name, mark, part] = key.split('|');
      add(name, `finding-charfact-mark-${slug(name)}-${mark}-${part}`, 'contradiction', `Physical Continuity: ${name}’s ${mark} (${sides.join(' vs ')} ${part})`,
        `${name}’s ${mark} is on the ${sides[0]} ${part} in one place and the ${sides[1]} ${part} in another. One ${mark} or two?`, items, 'possible_exploration');
    }
  });

  // age, against the timeline where the scenes can be dated.
  const days = sceneDays(src.timeline, src.units);
  facts.ages.forEach((items, name) => {
    const ordered = [...items].sort((a, b) => a.order - b.order);
    let problem: { items: Statement[]; summary: string; confidence: Confidence; title: string } | null = null;
    for (let i = 1; i < ordered.length && !problem; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      if (a.value === b.value) continue;
      const pair = [a, b];
      if (a.unit.index === b.unit.index) {
        problem = { items: pair, confidence: 'definite', title: `${name}’s age (${a.value} vs ${b.value}) in one scene`, summary: `${name} is ${a.value} and ${b.value} in the same scene. Which is it?` };
        continue;
      }
      const dayA = days.get(a.unit.index);
      const dayB = days.get(b.unit.index);
      if (dayA !== undefined && dayB !== undefined) {
        const years = (dayB - dayA) / 365.25;
        if (Math.abs(b.value - a.value - years) > 1.5) {
          problem = {
            items: pair, confidence: 'probable', title: `${name}’s age (${a.value} then ${b.value}) doesn’t match the timeline`,
            summary: `${name} is ${a.value} in ${a.unit.title} and ${b.value} in ${b.unit.title}, but your timeline puts those scenes about ${Math.abs(Math.round(years * 10) / 10)} year${Math.abs(Math.round(years * 10) / 10) === 1 ? '' : 's'} ${years >= 0 ? 'apart' : 'apart, in the other order'}. Is a date or an age off?`
          };
        }
      } else if (b.value < a.value) {
        problem = {
          items: pair, confidence: 'possible_exploration', title: `${name}’s age goes down (${a.value} then ${b.value})`,
          summary: `${name} is ${a.value} in ${a.unit.title} and younger, ${b.value}, in ${b.unit.title}. A flashback? If so, this is fine; linking scenes to the timeline lets me check.`
        };
      }
    }
    if (problem) add(name, `finding-charfact-age-${slug(name)}`, 'continuity', `Age: ${problem.title}`, problem.summary, problem.items, problem.confidence);
  });

  // someone dies, then speaks.
  facts.deaths.forEach((death, name) => {
    const later = (facts.speech.get(name) ?? []).filter(s => {
      if (s.order <= death.order) return false;
      if (src.units.find(u => u.index === s.unit.index)?.sentences.some(x => REMEMBERED.test(x))) return false;
      const spoke = days.get(s.unit.index);
      const died = days.get(death.unit.index);
      return !(spoke !== undefined && died !== undefined && spoke < died);
    });
    if (later.length > 0) {
      add(name, `finding-charfact-death-${slug(name)}`, 'continuity', `${name} speaks after dying`,
        `${name} dies in ${death.unit.title}, but speaks again in ${later[0].unit.title}. A flashback or a ghost, or a slip? If it’s a flashback, linking the scenes to the timeline lets me tell.`,
        [death, later[0]], 'probable');
    }
  });

  return findings;
}

export interface ReadFact {
  id: string; // the statement key
  character: string;
  kind: 'eyes' | 'hair' | 'age' | 'hand' | 'mark' | 'death';
  label: string; // "Eye color"
  value: string; // "green"
  chapterId: string;
  chapterTitle: string;
  quote: string;
  ignored: boolean;
}

const KIND_LABEL: Record<ReadFact['kind'], string> = {
  eyes: 'Eye color', hair: 'Hair color', age: 'Age', hand: 'Dominant hand', mark: 'Mark', death: 'Death',
};

// everything the manuscript states about each character, in reading order, including what the
// writer has set aside (flagged, so it can be brought back).
export function readCharacterFacts(src: FactSource): ReadFact[] {
  const facts = extract(src, true);
  const gone = new Set(src.ignored ?? []);
  const out: Array<ReadFact & { order: number }> = [];
  const add = (s: Statement, kind: ReadFact['kind'], value: string, label = KIND_LABEL[kind]) =>
    out.push({ id: s.key, character: s.character, kind, label, value, chapterId: s.unit.chapterId, chapterTitle: s.unit.title, quote: truncate(s.sentence, 200), ignored: gone.has(s.key), order: s.order });
  facts.eyes.forEach(list => list.forEach(s => add(s, 'eyes', s.value)));
  facts.hair.forEach(list => list.forEach(s => add(s, 'hair', s.value)));
  facts.ages.forEach(list => list.forEach(s => add(s, 'age', String(s.value))));
  facts.hands.forEach(list => list.forEach(s => add(s, 'hand', `${s.value}-handed`)));
  facts.marks.forEach(list => list.forEach(s => add(s, 'mark', `on the ${s.value} ${s.part}`, `${s.mark[0].toUpperCase()}${s.mark.slice(1)}`)));
  facts.deaths.forEach(s => add(s, 'death', 'dies'));
  return out.sort((a, b) => a.order - b.order).map(({ order: _order, ...fact }) => fact);
}
