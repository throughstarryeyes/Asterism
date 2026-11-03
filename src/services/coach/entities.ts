import nlp from 'compromise';

// a slice of the manuscript the coach reasons about (a chapter or provisional scene).
export interface CoachUnit {
  id: string;
  index: number;
  title: string;
  chapterId: string;
  plainText: string;
}

export interface Mention {
  unitIndex: number;
  unitId: string;
  chapterId: string;
  unitTitle: string;
  sentence: string;
  // name as written in the text (e.g. "Dr. Voss", "Voss").
  surface: string;
  inDialogue: boolean;
}

export interface Entity {
  id: string;
  canonical: string;
  aliases: string[];
  kind: 'person';
  // true when the name came from the story bible rather than being inferred.
  confirmed: boolean;
  mentions: Mention[];
  unitsPresent: number[];
}

export interface EntityIndex {
  entities: Entity[];
  unitCount: number;
}

export interface KnownCharacter {
  name: string;
  aliases?: string[];
}

const TITLES = /^(?:dr|mr|mrs|ms|mx|miss|sir|lady|lord|captain|capt|king|queen|prince|princess|father|mother|sister|brother|professor|prof|detective|officer)\.?\s+/i;

// compromise sometimes tags sentence-initial words or titles as people.
const NOT_NAMES = new Set([
  'chapter', 'prologue', 'epilogue', 'part', 'act', 'scene',
  'god', 'lord', 'sir', 'ma', 'sorry', 'please', 'okay', 'ok', 'yes', 'no',
  'mom', 'dad', 'mum', 'mama', 'papa',
  // a title with no name after it, and words people shout or say to each other
  'mr', 'mrs', 'ms', 'mx', 'dr', 'miss', 'prof',
  'dude', 'man', 'bro', 'hey', 'oh', 'shh', 'damn', 'jesus', 'christ', 'fuck', 'shit', 'well', 'look',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'july', 'september', 'october', 'november', 'december',
]);

// abbreviations that are not people
const INITIALS_NOT_NAMES = new Set(['AA', 'OK', 'TV', 'ID', 'DNA', 'FBI', 'CIA', 'USA', 'UK', 'UN', 'AM', 'PM', 'ER', 'ICU', 'CEO', 'GPS', 'DVD', 'CD', 'PC', 'USB', 'HR', 'PE', 'RV', 'SUV', 'EMT', 'ATM', 'AC', 'DC', 'NY', 'LA', 'PS', 'RIP', 'LOL', 'OMG', 'WTF', 'MRI', 'IV', 'PTSD', 'ADHD']);

// small words that sit inside a name ("Ludwig van Beethoven")
const PARTICLES = new Set(['van', 'von', 'de', 'da', 'di', 'del', 'la', 'le', 'bin', 'ibn', 'al', 'el', 'du', 'of']);

const ABBREVIATIONS = /\b(Dr|Mr|Mrs|Ms|Mx|St|Sr|Jr|Prof|Capt|Det)\./g;
const HIDDEN_PERIOD = '\u0001';

// a sentence can start in lowercase (many writers never capitalize), so a stop followed by a space ends a sentence whatever comes next.
// exceptions where a lowercase word carries on: after an ellipsis, after an abbreviation such as "etc." or "e.g.",
// and after a closing quote ("are you ok?" he asked)
const CARRIES_ON = /(?:\.\.\.|…|\b(?:etc|e\.g|i\.e|vs|approx|cf|fig)\.|[.!?,]["”’])$/i;
export function splitSentences(text: string): string[] {
  // keep "Dr. Voss" together: hide the title's period while splitting.
  const hidden = text.replace(ABBREVIATIONS, `$1${HIDDEN_PERIOD}`);
  const pieces: string[] = [];
  let start = 0;
  const stop = /[.!?…]+["”’')\]]*(\s+)(?=\S)/g;
  for (let m = stop.exec(hidden); m; m = stop.exec(hidden)) {
    const after = m.index + m[0].length;
    const before = hidden.slice(start, after - m[1].length);
    if (/[a-z]/.test(hidden[after]) && CARRIES_ON.test(before)) continue;
    pieces.push(before);
    start = after;
  }
  pieces.push(hidden.slice(start));
  return pieces
    .flatMap(piece => piece.split(/\n+/))
    .map(s => s.split(HIDDEN_PERIOD).join('.').trim())
    .filter(s => s.length > 0);
}

// which sentences are spoken: they hold a quote mark, or sit inside a quote that an earlier sentence opened
// ("Jesus christ, Atlas. are you already drunk? it hasn’t been an hour.") is one line of speech in three sentences
export function quotedFlags(sentences: string[]): boolean[] {
  let open = false;
  let run = 0;
  return sentences.map(sentence => {
    const startedOpen = open;
    let marked = false;
    for (const ch of sentence) {
      if (ch === '“') { open = true; marked = true; }
      else if (ch === '”') { open = false; marked = true; }
      else if (ch === '"') { open = !open; marked = true; }
    }
    // a quote mark with no partner would otherwise swallow the rest of the scene
    run = open ? run + 1 : 0;
    if (run > 8) { open = false; run = 0; }
    return startedOpen || marked;
  });
}

// one run of capitalized words can be two names: "Cass. Mrs. khalil" breaks at the full stop and at the title
function splitRun(raw: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  for (const word of raw.split(/\s+/).filter(Boolean)) {
    const isTitle = TITLES.test(`${word} `);
    if (current.length && isTitle) { out.push(current.join(' ')); current = []; }
    current.push(word);
    if (!isTitle && /\.$/.test(word) && word.replace(/\./g, '').length > 1 && !/^(?:jr|sr|st)\.$/i.test(word)) { out.push(current.join(' ')); current = []; }
  }
  if (current.length) out.push(current.join(' '));
  return out;
}

// the capitalized words at the start, so "Val reminisced" is val and "Dude Val" is val
function capitalizedRun(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const run: string[] = [];
  for (const w of words) {
    const isCap = /^\p{Lu}/u.test(w);
    if (isCap && NOT_NAMES.has(w.replace(/[.'’-]+$/, '').toLowerCase()) && run.length === 0 && !TITLES.test(`${w} `)) continue; // a shout before the name
    if (isCap) run.push(w);
    else if (PARTICLES.has(w) && run.length > 0) run.push(w);
    else break;
  }
  while (run.length && PARTICLES.has(run[run.length - 1])) run.pop();
  return run.join(' ');
}

function cleanName(raw: string): string {
  const text = raw
    .replace(/[^\p{L}\p{N}\s.'’-]/gu, '')
    .replace(/[.\s]+$/, '')
    .replace(/['’]s$/i, '')
    .replace(/-{2,}/g, ' ')
    .trim();
  return capitalizedRun(text);
}

// the key a name is filed under: titles that say who someone is (Mr, Mrs) keep a husband and wife apart
const GENDERED_TITLE = /^(mr|mrs|ms|miss|mx|sir|lady|lord)\.?\s+/i;
function keyOf(name: string): string {
  const title = GENDERED_TITLE.exec(name);
  const bare = stripTitle(name).toLowerCase();
  return title ? `${title[1].toLowerCase()} ${bare}` : bare;
}

function stripTitle(name: string): string {
  return name.replace(TITLES, '').trim();
}

function isLikelyName(name: string): boolean {
  if (name.length < 2) return false;
  if (!/^[A-Z\p{Lu}]/u.test(name)) return false;
  if (NOT_NAMES.has(name.toLowerCase())) return false;
  return true;
}

function sentenceHasDialogue(sentence: string, name: string): boolean {
  // the name sits inside quotation marks => someone is speaking about / to them.
  const idx = sentence.indexOf(name);
  if (idx < 0) return false;
  const before = sentence.slice(0, idx);
  const opens = (before.match(/["“]/g) || []).length;
  const closes = (before.match(/["”]/g) || []).length;
  return opens > closes;
}

// words that start sentences everywhere, so a capital on one of them says nothing about a name
const STARTERS = new Set([
  'The', 'A', 'An', 'He', 'She', 'They', 'It', 'We', 'You', 'I', 'His', 'Her', 'Their', 'Its', 'This', 'That', 'These', 'Those',
  'But', 'And', 'So', 'Then', 'When', 'While', 'As', 'If', 'In', 'On', 'At', 'With', 'For', 'Of', 'To', 'From', 'By', 'After', 'Before',
  'Now', 'Just', 'Not', 'No', 'Yes', 'What', 'Why', 'How', 'Where', 'Who', 'There', 'Here', 'Maybe', 'Even', 'Still', 'My', 'Your', 'Our',
  'One', 'Some', 'Every', 'Each', 'All', 'Both', 'Is', 'Are', 'Was', 'Were', 'Do', 'Did', 'Does', 'Can', 'Could', 'Would', 'Should', 'Oh', 'Okay', 'Well',
]);

// most sentences have no name in them; telling that costs far less than tagging them
const mayHaveName = (sentence: string) =>
  (sentence.match(/\p{Lu}[\p{L}'’-]*/gu) ?? []).some(word => !STARTERS.has(word.split(/['’]/)[0]));

// a sentence reads the same each time, so edits only cost what changed
const tagged = new Map<string, string[]>();
const TAGGED_LIMIT = 40_000;

function extractPeople(sentence: string): string[] {
  if (!mayHaveName(sentence)) return [];
  const seen = tagged.get(sentence);
  if (seen) return seen;

  // quotes, dashes and ?/! otherwise glue neighboring names together ("Tobias?" Mara, "Cass--Val").
  const doc = nlp(sentence.replace(/[“”"]/g, ' ').replace(/[?!]+/g, ' , ').replace(/[—–…]|-{2,}|\.{3}/g, ' , '));
  const found: string[] = doc.people().out('array');
  const names: string[] = [];
  for (const raw of found) {
    for (const part of splitRun(raw)) {
      const cleaned = cleanName(part);
      if (cleaned && isLikelyName(stripTitle(cleaned) || cleaned)) names.push(cleaned);
    }
  }
  if (tagged.size >= TAGGED_LIMIT) tagged.clear();
  tagged.set(sentence, names);
  return names;
}

export function buildEntityIndex(units: CoachUnit[], known: KnownCharacter[] = [], notPeople: string[] = []): EntityIndex {
  const excluded = new Set(notPeople.map(n => n.trim().toLowerCase()));
  // cluster by key: lowercase surname/first name without title.
  const clusters = new Map<string, Entity>();
  const keyToCluster = new Map<string, string>();

  const register = (canonical: string, confirmed: boolean, aliases: string[] = []): Entity => {
    const id = `ent-${canonical.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    let ent = clusters.get(id);
    if (!ent) {
      ent = { id, canonical, aliases: [], kind: 'person', confirmed, mentions: [], unitsPresent: [] };
      clusters.set(id, ent);
    }
    if (confirmed) ent.confirmed = true;
    [canonical, ...aliases].forEach(a => {
      const key = keyOf(a);
      if (key) keyToCluster.set(key, id);
      if (a !== canonical && !ent!.aliases.includes(a)) ent!.aliases.push(a);
    });
    return ent;
  };

  known.forEach(k => {
    if (k.name && k.name.trim()) register(k.name.trim(), true, (k.aliases || []).filter(Boolean));
  });

  const addMention = (unit: CoachUnit, sentence: string, ent: Entity, surface: string) => {
    if (surface !== ent.canonical && !ent.aliases.includes(surface)) ent.aliases.push(surface);
    ent.mentions.push({
      unitIndex: unit.index,
      unitId: unit.id,
      chapterId: unit.chapterId,
      unitTitle: unit.title,
      sentence,
      surface,
      inDialogue: sentenceHasDialogue(sentence, surface),
    });
  };

  const sentencesByUnit = units.map(unit => ({ unit, sentences: splitSentences(unit.plainText) }));
  // which entities each sentence already counted, so pass 2 does not double up.
  const counted = new Set<string>();

  // pass 1: let the tagger propose people.
  sentencesByUnit.forEach(({ unit, sentences }) => {
    sentences.forEach((sentence, si) => {
      extractPeople(sentence).forEach(surface => {
        const key = keyOf(surface);
        // a name the writer said is not a person, unless the story bible knows it
        if (excluded.has(key) && !keyToCluster.has(key)) return;
        let clusterId = keyToCluster.get(key);
        if (!clusterId) {
          // "Voss" should join an existing "Dr. Voss"; a bare first-name hit
          // should not silently merge two different people.
          // two people who share a surname ("Mr. khalil", "Mrs. khalil") make a bare "Khalil" ambiguous.
          const partial = [...clusters.values()].filter(e =>
            e.canonical.toLowerCase().split(/\s+/).includes(key) &&
            e.canonical.split(/\s+/).length > 1
          );
          if (partial.length === 1) clusterId = partial[0].id;
        }
        const ent = clusterId ? clusters.get(clusterId)! : register(surface, false);
        if (!keyToCluster.has(key)) keyToCluster.set(key, ent.id);
        counted.add(`${unit.index}:${si}:${ent.id}`);
        addMention(unit, sentence, ent, surface);
      });
    });
  });

  // pass 2: rescue capitalized tokens that match a known name, only if they match exactly one entity
  const tokenOwners = new Map<string, Set<string>>();
  clusters.forEach(ent => {
    [ent.canonical, ...ent.aliases].forEach(name => {
      stripTitle(name).toLowerCase().split(/\s+/).forEach(tok => {
        if (tok.length < 2) return;
        if (!tokenOwners.has(tok)) tokenOwners.set(tok, new Set());
        tokenOwners.get(tok)!.add(ent.id);
      });
    });
  });
  sentencesByUnit.forEach(({ unit, sentences }) => {
    sentences.forEach((sentence, si) => {
      for (const match of sentence.matchAll(/\b[A-Z][\p{L}'’-]+/gu)) {
        const token = cleanName(match[0]);
        const owners = tokenOwners.get(token.toLowerCase());
        if (!owners || owners.size !== 1) continue;
        const ent = clusters.get([...owners][0])!;
        const mark = `${unit.index}:${si}:${ent.id}`;
        if (counted.has(mark)) continue;
        counted.add(mark);
        addMention(unit, sentence, ent, token);
      }
    });
  });

  // pass 3: a character known by initials ("CJ tossed the bottle", "CJ’s phone"), which the tagger skips.
  // only when it acts like a name most of the time, and is not an everyday abbreviation
  const initials = new Map<string, { all: number; named: number }>();
  sentencesByUnit.forEach(({ sentences }) => sentences.forEach(sentence => {
    if (sentence === sentence.toUpperCase()) return;
    for (const m of sentence.matchAll(/\b[A-Z]{2,3}\b(’s|'s|\s+[a-z])?/g)) {
      const token = m[0].replace(/(’s|'s|\s+[a-z])$/, '');
      const seen = initials.get(token) ?? { all: 0, named: 0 };
      seen.all++;
      if (m[1]) seen.named++;
      initials.set(token, seen);
    }
  }));
  initials.forEach((seen, token) => {
    if (INITIALS_NOT_NAMES.has(token) || keyToCluster.has(token.toLowerCase()) || excluded.has(token.toLowerCase())) return;
    if (seen.named < 4 || seen.named / seen.all < 0.5) return;
    const ent = register(token, false);
    const word = new RegExp(`\\b${token}\\b`);
    sentencesByUnit.forEach(({ unit, sentences }) => sentences.forEach((sentence, si) => {
      if (word.test(sentence) && !counted.has(`${unit.index}:${si}:${ent.id}`)) {
        counted.add(`${unit.index}:${si}:${ent.id}`);
        addMention(unit, sentence, ent, token);
      }
    }));
  });

  const entities = [...clusters.values()].map(e => ({
    ...e,
    unitsPresent: [...new Set(e.mentions.map(m => m.unitIndex))].sort((a, b) => a - b),
  }));

  return { entities, unitCount: units.length };
}

export interface EntityGap {
  entity: Entity;
  kind: 'single_mention' | 'vanished';
  lastSeenUnit: number;
  unitsSince: number;
}

// "Someone is brought up — is it ever mentioned again?"
export function findEntityGaps(index: EntityIndex, minGapUnits = 3): EntityGap[] {
  const gaps: EntityGap[] = [];
  const lastUnit = index.unitCount - 1;
  for (const entity of index.entities) {
    if (entity.mentions.length === 0) continue;
    const last = entity.unitsPresent[entity.unitsPresent.length - 1];
    const since = lastUnit - last;
    if (entity.mentions.length === 1 && since >= 1) {
      gaps.push({ entity, kind: 'single_mention', lastSeenUnit: last, unitsSince: since });
    } else if (entity.unitsPresent.length >= 2 && since >= minGapUnits) {
      gaps.push({ entity, kind: 'vanished', lastSeenUnit: last, unitsSince: since });
    }
  }
  return gaps.sort((a, b) => b.unitsSince - a.unitsSince);
}
