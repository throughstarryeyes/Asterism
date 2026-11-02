import type { AnalysisFinding, ReadKnowledgeRecord, ReadPlaceRecord, StoryBible, TimelineEvent } from '../types';
import { sceneDays, type FactCharacter, type FactUnit } from './characterFacts';
import { isClose, relationBetween } from './relationships';

// two questions about the cast: who is where (left for a place, then elsewhere with no journey; or in two places on one day)
// and what they know (talks as if they know a secret before learning it); everything is a question

export interface WhereKnowsSource {
  units: FactUnit[];
  characters: FactCharacter[];
  // places from the story bible. only these are tracked.
  locations: Array<{ name: string; aliases?: string[] }>;
  bible: StoryBible;
  timeline: TimelineEvent[];
  // statements the writer set aside (ids from readWhereAndKnows).
  ignored?: string[];
}

type Confidence = AnalysisFinding['confidence'];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const truncate = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 3)}...`;
};

const QUOTE = /["“][^"”]*["”]/g;
const narration = (s: string) => s.replace(QUOTE, ' ');
const quotes = (s: string) => Array.from(s.matchAll(/["“]([^"”]*)["”]/g)).map(m => m[1]);

const REMEMBERED = /\b(remember(?:ed|ing)?|memory|memories|dream(?:t|ed|ing)?|flashback|ghost|recalled|imagin\w+)\b/i;
const SPEECH_VERB = '(?:said|asked|replied|whispered|shouted|called|answered|muttered|snapped|murmured|cried|laughed|sighed|added|says|asks|admitted|confessed|insisted|warned)';
const SPEECH_AFTER = new RegExp(`^(?:\\s+\\w+)?\\s+${SPEECH_VERB}\\b`, 'i');
const SPEECH_BEFORE = new RegExp(`\\b${SPEECH_VERB}\\s+$`, 'i');

interface Hit { name: string; index: number; end: number }

function nameHits(characters: FactCharacter[], text: string): Hit[] {
  const hits: Hit[] = [];
  for (const c of characters) {
    for (const m of text.matchAll(new RegExp(c.pattern.source, 'gi'))) hits.push({ name: c.name, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return hits.sort((a, b) => a.index - b.index);
}

const dayOf = (days: Map<number, number>, unit: FactUnit) => days.get(unit.index);

// ---- who is where ---------------------------------------------------------------------------

const LOCATIVE = '(?:in|at|inside|within|outside|near|around|beside|by|across|throughout)';
const DEPART_VERB = '(?:left|set out|set off|headed|travell?ed|rode|sailed|flew|drove|walked|went|moved|fled|hurried|ran|journeyed|retreated|escaped|returned|came|went back|came back|rode back|was sent|was taken|was sent back)';

// words that show time passing or a journey at the start of a scene
const TIME_SHIFT = /\b(?:later|afterwards?|that (?:evening|night|morning|afternoon)|the next|next (?:day|morning)|hours?|minutes?|meanwhile|by (?:noon|dusk|nightfall|morning|evening)|at (?:dawn|dusk|noon|midnight|sunset)|on (?:the|her|his|their) way)\b/i;
const TRAVEL = /\b(?:arrived|reached|returned|came back|went back|rode|drove|walked|sailed|flew|hurried|journey|trip|carriage|train|ship)\b/i;

interface Move {
  character: string;
  place: string;
  // a departure or arrival leaves the character "in transit to" or "at" that place.
  stateful: boolean;
  how: ReadPlaceRecord['how'];
  key: string;
  unit: FactUnit;
  order: number;
  sentence: string;
}

// a place by its name or any other name the story uses for it
const placeNames = (p: { name: string; aliases?: string[] }) => [p.name, ...(p.aliases ?? [])].filter(n => n.trim().length >= 3);
function placeRegex(place: { name: string; aliases?: string[] }): string {
  const alternatives = placeNames(place).map(n => escape(n.replace(/^the\s+/i, '').trim())).sort((a, b) => b.length - a.length);
  return `(?:the\\s+)?(?:${alternatives.join('|')})`;
}

function analyzeWhere(src: WhereKnowsSource, days: Map<number, number>, sink?: ReadPlaceRecord[]): AnalysisFinding[] {
  const places = src.locations.filter(l => l.name.trim().length >= 3);
  if (places.length === 0 || src.characters.length === 0) return [];

  const departRes = places.map(p => ({ place: p.name, re: new RegExp(`\\b${DEPART_VERB}\\s+(?:\\w+\\s+){0,2}?(?:for|to|toward|towards|into|back to|back into)\\s+${placeRegex(p)}\\b`, 'i') }));
  const reachRes = places.map(p => ({ place: p.name, re: new RegExp(`\\b(?:arrived|landed|reached|entered)\\s+(?:in\\s+|at\\s+)?${placeRegex(p)}\\b`, 'i') }));
  const beRes = places.map(p => ({ place: p.name, re: new RegExp(`\\b(?:was|were|is|stayed|remained|waited|lived|slept|worked)\\s+(?:\\w+\\s+)?(?:in|at)\\s+${placeRegex(p)}\\b`, 'i') }));
  const locativeRes = places.map(p => ({ place: p.name, re: new RegExp(`\\b${LOCATIVE}\\s+${placeRegex(p)}\\b`, 'gi') }));

  // when reading (a sink is given) nothing is skipped; the set-aside ones are only flagged.
  const setAside = new Set(src.ignored ?? []);
  const off = (key: string) => !sink && setAside.has(key);

  const units = [...src.units].sort((a, b) => a.index - b.index);
  const moves = new Map<string, Move[]>(); // `${unit.index}|${character}`
  const present = new Map<number, Set<string>>();
  const firstMention = new Map<string, string>(); // `${unit.index}|${character}`
  const placeOf = new Map<number, string>();
  const flashback = new Set<number>();

  units.forEach(unit => {
    const here = new Set<string>();
    present.set(unit.index, here);
    const counts = new Map<string, number>();
    let remembered = 0;
    let lastNamed: string | null = null;

    unit.sentences.forEach((sentence, position) => {
      const text = narration(sentence);
      const order = unit.index * 10_000 + position;
      const isMemory = REMEMBERED.test(sentence);
      if (isMemory) remembered++;
      const hits = nameHits(src.characters, text);
      hits.forEach(h => {
        const before = text.slice(0, h.index);
        if (/\b(?:about|of|without|missing|remember(?:ed)?|except)\s+$/i.test(before)) return;
        here.add(h.name);
        if (!firstMention.has(`${unit.index}|${h.name}`)) firstMention.set(`${unit.index}|${h.name}`, sentence);
      });

      // who a movement sentence is about: the names just before the verb ("Mara and Dana left for ...").
      const subjects = (at: number): string[] => {
        const before = hits.filter(h => h.end <= at);
        if (before.length === 0) return /^\s*(?:he|she|they)\b/i.test(text) && lastNamed ? [lastNamed] : [];
        const out = [before[before.length - 1]];
        for (let i = before.length - 2; i >= 0; i--) {
          const between = text.slice(before[i].end, out[out.length - 1].index);
          if (/^\s*(?:,|and|&|,\s*and)\s*$/i.test(between)) out.push(before[i]); else break;
        }
        return out.map(h => h.name);
      };

      let isMove = false;
      const record = (kind: Array<{ place: string; re: RegExp }>, stateful: boolean, how: Move['how']) => {
        for (const { place, re } of kind) {
          const m = text.match(re);
          if (!m || isMemory) continue;
          isMove = true;
          for (const character of subjects(m.index ?? 0)) {
            const key = `${unit.index}|${character}`;
            const id = `where|${how}|${character}|${unit.chapterId}|${place}|${sentence.replace(/\s+/g, ' ').trim()}`;
            if (off(id)) continue;
            moves.set(key, [...(moves.get(key) ?? []), { character, place, stateful, how, key: id, unit, order, sentence }]);
          }
        }
      };
      record(departRes, true, 'set out for');
      record(reachRes, true, 'arrived at');
      record(beRes, false, 'was in');

      // where the scene sits: places named with "in", "at", "inside"... in narration, early sentences counting double.
      if (!isMove && !isMemory) {
        for (const { place, re } of locativeRes) {
          const n = (text.match(re) ?? []).length;
          if (n) counts.set(place, (counts.get(place) ?? 0) + n * (position < 3 ? 2 : 1));
        }
      }
      if (hits.length > 0) lastNamed = hits[0].name;
    });

    if (unit.sentences.length > 0 && remembered / unit.sentences.length >= 0.3) flashback.add(unit.index);
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (ranked.length > 0 && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) placeOf.set(unit.index, ranked[0][0]);
  });

  const findings: AnalysisFinding[] = [];
  const unitPosition = new Map(units.map((u, i) => [u.index, i]));

  // scenes where an earlier finding already asked about the trip
  const asked = new Set<string>();

  src.characters.forEach(character => {
    let state: { place: string; move: Move } | null = null;
    // where this person is seen, scene by scene, for the same-day check
    const visits: Array<{ unit: FactUnit; place: string; quote: string; moved: boolean }> = [];
    units.forEach(unit => {
      if (flashback.has(unit.index)) return;
      const key = `${unit.index}|${character.name}`;
      const seenHere = present.get(unit.index)?.has(character.name) ?? false;
      const mine = moves.get(key) ?? [];
      const scene = placeOf.get(unit.index);
      const seenId = `where|seen in|${character.name}|${unit.chapterId}|${scene}`;
      const here = seenHere && !(mine.length === 0 && scene && off(seenId));
      if (sink) {
        mine.forEach(m => sink.push({ id: m.key, character: m.character, how: m.how, place: m.place, chapterId: unit.chapterId, chapterTitle: unit.title, quote: truncate(m.sentence, 200), order: m.order, ignored: setAside.has(m.key) }));
        if (mine.length === 0 && seenHere && scene) {
          sink.push({ id: seenId, character: character.name, how: 'seen in', place: scene, chapterId: unit.chapterId, chapterTitle: unit.title, quote: truncate(firstMention.get(key) ?? '', 200), order: unit.index * 10_000, ignored: setAside.has(seenId) });
        }
      }

      if (mine.length > 0) {
        visits.push({ unit, place: mine[mine.length - 1].place, quote: mine[mine.length - 1].sentence, moved: true });
      } else if (here && scene) {
        visits.push({ unit, place: scene, quote: firstMention.get(key) ?? '', moved: false });
      }

      if (mine.length > 0) {
        // the scene itself says where they went; trust the last thing it says.
        const last = mine[mine.length - 1];
        state = last.stateful ? { place: last.place, move: last } : null;
        return;
      }
      if (!here || !scene) return;

      if (state && state.place !== scene) {
        const source = state.move;
        const apart = (unitPosition.get(unit.index) ?? 0) - (unitPosition.get(source.unit.index) ?? 0);
        const dayA = dayOf(days, source.unit);
        const dayB = dayOf(days, unit);
        const gap = dayA !== undefined && dayB !== undefined ? dayB - dayA : undefined;
        const dated = gap !== undefined;
        // far apart, or days later, a return is easy to assume. a date before the departure is a flashback.
        const close = dated ? gap >= 0 && gap < 3 : apart <= 2;
        if (close && apart > 0) {
          const confidence: Confidence = dated ? 'probable' : 'possible_exploration';
          asked.add(`${character.name}|${unit.index}`);
          findings.push({
            id: `finding-where-${slug(character.name)}-${slug(source.place)}-${slug(scene)}-${unit.index}`,
            category: 'continuity',
            title: `Where: ${character.name} set out for ${source.place}, then is in ${scene}`,
            summary: `${source.unit.title} has ${character.name} heading to ${source.place}, but ${unit.title} has ${character.name} in ${scene} and nothing says they came back or went on${dated ? ` (your timeline puts the scenes ${gap === 0 ? 'on the same day' : `${gap} day${gap === 1 ? '' : 's'} apart`})` : ''}. Offstage travel is easy to miss; is a line about the journey or return needed?`,
            evidencePassages: [
              { chapterId: source.unit.chapterId, chapterTitle: source.unit.title, quote: truncate(source.sentence, 160) },
              { chapterId: unit.chapterId, chapterTitle: unit.title, quote: truncate(firstMention.get(key) ?? '', 160) },
            ],
            confidence,
            status: 'unreviewed',
            subject: character.name,
          });
        }
      }
      // seen in a place with no journey to explain it: from here on that is where they are.
      state = null;
    });

    // two different places in one dated day, in scenes close together, with no sign of travel or time passing
    for (let i = 1; i < visits.length; i++) {
      const a = visits[i - 1];
      const b = visits[i];
      if (b.moved || a.place === b.place || asked.has(`${character.name}|${b.unit.index}`)) continue;
      const dayA = dayOf(days, a.unit);
      const dayB = dayOf(days, b.unit);
      if (dayA === undefined || dayB === undefined || Math.floor(dayA) !== Math.floor(dayB)) continue;
      if ((unitPosition.get(b.unit.index) ?? 0) - (unitPosition.get(a.unit.index) ?? 0) > 2) continue;
      const opening = b.unit.sentences.slice(0, 2).join(' ');
      if (TIME_SHIFT.test(opening) || TRAVEL.test(opening)) continue;
      findings.push({
        id: `finding-where-sameday-${slug(character.name)}-${slug(a.place)}-${slug(b.place)}-${b.unit.index}`,
        category: 'continuity',
        title: `Where: ${character.name} in ${a.place}, then ${b.place} the same day`,
        summary: `Your timeline puts ${a.unit.title} and ${b.unit.title} on the same day. ${character.name} is in ${a.place} in the first and in ${b.place} in the next, and nothing shows the trip or time passing. Is it a long day, or is a line about getting there needed?`,
        evidencePassages: [
          { chapterId: a.unit.chapterId, chapterTitle: a.unit.title, quote: truncate(a.quote, 160) },
          { chapterId: b.unit.chapterId, chapterTitle: b.unit.title, quote: truncate(b.quote, 160) },
        ],
        confidence: 'possible_exploration',
        status: 'unreviewed',
        subject: character.name,
      });
    }
  });
  return findings;
}

// ---- what they know -------------------------------------------------------------------------

const STOP = new Set((
  'about above after again against all also always among and another any are around because been before being between both but came can could did does doing done down during each even ever every few for from get gets had has have having her here hers herself him himself his how however into its itself just keep know known knew like made make many may might more most much must myself never next nobody none not nothing now off once only other our ours out over own said same say says see seem seemed several she should since some something still such take than that the their theirs them themselves then there these they thing things this those though through thus too under until upon use very want was way well were what when where whether which while who whom whose why will with within without would yet you your yours yourself ' +
  'had been told secret secrets truth hidden behind kept long years year time day days back come went going gone away still one two three first last'
).split(/\s+/));

function stems(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? []) {
    let w = raw.replace(/['’]s$/, '');
    if (STOP.has(w)) continue;
    if (w.length > 5) w = w.replace(/(?:ing|ers|er|ed|es|ly|s)$/, '');
    if (w.length < 4 || STOP.has(w)) continue;
    out.add(w.slice(0, 5));
  }
  return out;
}

interface Topic {
  owner: string; // empty when the secret belongs to no one character
  label: string; // how findings refer to it
  key: string; // stable id fragment
  ownerKeys: Set<string>;
  knownByNames: string[];
  hiddenFromNames: string[];
  knownBy: Set<string>; // lowercase names and aliases of characters marked as knowing from the start
  hiddenFrom: Set<string>; // ... and of those marked as not supposed to know
  secret: string;
  terms: Set<string>;
  need: number;
}

interface Match { order: number; unit: FactUnit; sentence: string; speakers: Set<string>; knowers: Set<string> }
interface Learn { character: string; order: number; unit: FactUnit; sentence: string; key: string }

const LEARN_SUBJECT = /^((?:\s+\w+){0,2}?)\s+(learned|learnt|discovered|found out|realized|realised|overheard|read|noticed|worked out|uncovered|saw)\b/i;
const TOLD_OBJECT = /\b(?:told|confided in|revealed (?:it )?to|confessed (?:it )?to|admitted (?:it )?to|showed|warned)\s+$/i;
const NEGATED = /\b(?:not|never|nothing|n['’]t|didn['’]t|wasn['’]t|hadn['’]t|couldn['’]t|no one|nobody)\b/i;
const HYPOTHETICAL = /\b(?:if|what if|might|maybe|perhaps|suppose|supposing|wonder(?:ed)?|imagine[ds]?|could be|would be)\b/i;
const KNEW_AFTER = /^((?:\s+\w+){0,2}?)\s+(?:knew|knows|had known|was aware|were aware|understood)\b/i;

function analyzeKnowledge(src: WhereKnowsSource, sink?: ReadKnowledgeRecord[]): AnalysisFinding[] {
  const setAside = new Set(src.ignored ?? []);
  const off = (key: string) => !sink && setAside.has(key);
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  const units = [...src.units].sort((a, b) => a.index - b.index);
  if (units.length < 2) return [];

  const nameTokens = new Set<string>();
  src.characters.forEach(c => c.name.toLowerCase().split(/\s+/).forEach(t => nameTokens.add(t.slice(0, 5))));
  const df = new Map<string, number>();
  units.forEach(u => stems(u.sentences.join(' ')).forEach(t => df.set(t, (df.get(t) ?? 0) + 1)));
  const common = Math.max(2, Math.ceil(units.length * 0.35));

  const cards = src.bible?.characters ?? [];
  const namesOf = (ids?: string[]) => (ids ?? []).flatMap(id => { const c = cards.find(x => x.id === id); return c ? [c.name.trim()] : []; });
  const keysOf = (ids?: string[]) => new Set((ids ?? []).flatMap(id => {
    const c = cards.find(x => x.id === id);
    return c ? [c.name, ...(c.aliases ?? [])].map(x => x.trim().toLowerCase()) : [];
  }));

  const topics: Topic[] = [];
  const addTopic = (secretText: string, t: Pick<Topic, 'owner' | 'label' | 'key' | 'knownBy' | 'hiddenFrom' | 'ownerKeys' | 'knownByNames' | 'hiddenFromNames'>) => {
    const secret = secretText.trim();
    if (secret.length < 12) return;
    const terms = new Set(Array.from(stems(secret)).filter(x => !nameTokens.has(x) && (df.get(x) ?? 0) <= common));
    if (terms.size < 3) return;
    topics.push({ ...t, secret, terms, need: Math.max(2, Math.ceil(terms.size * 0.5)) });
  };
  for (const card of cards) {
    const canonical = src.characters.find(c => c.name.toLowerCase() === card.name.trim().toLowerCase())?.name ?? card.name.trim();
    addTopic(card.theSecret ?? '', {
      owner: canonical, label: `${canonical}’s secret`, key: slug(canonical),
      knownBy: keysOf(card.secretKnownBy), hiddenFrom: keysOf(card.secretHiddenFrom),
      knownByNames: namesOf(card.secretKnownBy), hiddenFromNames: namesOf(card.secretHiddenFrom),
      ownerKeys: new Set([card.name, ...(card.aliases ?? []), canonical].map(x => x.trim().toLowerCase())),
    });
  }
  for (const entry of src.bible?.secrets ?? []) {
    addTopic(entry.text ?? '', {
      owner: '', label: `the secret “${truncate(entry.text.trim(), 40)}”`, key: `secret-${slug(entry.id)}`,
      knownBy: keysOf(entry.knownBy), hiddenFrom: keysOf(entry.hiddenFrom), ownerKeys: new Set(),
      knownByNames: namesOf(entry.knownBy), hiddenFromNames: namesOf(entry.hiddenFrom),
    });
  }
  if (topics.length === 0) return [];

  const findings: AnalysisFinding[] = [];
  const evidenceOf = (items: Array<{ unit: FactUnit; sentence: string }>) =>
    items.map(i => ({ chapterId: i.unit.chapterId, chapterTitle: i.unit.title, quote: truncate(i.sentence, 160) }));

  const cardNamed = (name: string) => src.bible?.characters?.find(c => [c.name, ...(c.aliases ?? [])].some(n => n.trim().toLowerCase() === name.trim().toLowerCase()));
  const closeToOwner = (name: string, owner: string) => {
    const a = owner ? cardNamed(owner) : undefined;
    const b = cardNamed(name);
    return !!a && !!b && isClose(relationBetween(a, b).types);
  };

  for (const topic of topics) {
    const hitsIn = (text: string) => { let n = 0; for (const t of stems(text)) if (topic.terms.has(t)) n++; return n; };
    const matches: Match[] = [];
    const learns: Learn[] = [];
    const presence = new Map<number, Set<string>>();

    units.forEach(unit => {
      const here = new Set<string>();
      presence.set(unit.index, here);
      unit.sentences.forEach((sentence, position) => {
        const text = narration(sentence);
        nameHits(src.characters, text).forEach(h => here.add(h.name));
        const order = unit.index * 10_000 + position;
        const hits = nameHits(src.characters, text);
        const spoken = quotes(sentence).join(' ');

        // who is saying the quoted words: a name next to a speech verb, here or in the sentence that follows.
        const speakers = new Set<string>();
        if (spoken) {
          const attribute = (line: string, lineHits: Hit[]) => lineHits.forEach(h => {
            if (SPEECH_AFTER.test(line.slice(h.end)) || SPEECH_BEFORE.test(line.slice(0, h.index))) speakers.add(h.name);
          });
          attribute(text, hits);
          if (speakers.size === 0 && !/[a-z]/i.test(text)) {
            const next = unit.sentences[position + 1];
            if (next && !/["“]/.test(next)) attribute(next, nameHits(src.characters, next));
          }
        }

        const knowers = new Set<string>();
        for (const h of hits) {
          const rest = text.slice(h.end);
          const k = rest.match(KNEW_AFTER);
          if (k && !NEGATED.test(k[1]) && !HYPOTHETICAL.test(text) && !/\?\s*$/.test(sentence)) knowers.add(h.name);
          const learnKey = `know|learned|${topic.key}|${h.name}|${unit.chapterId}|${clean(sentence)}`;
          const told = text.slice(0, h.index);
          const l = rest.match(LEARN_SUBJECT);
          if ((l || TOLD_OBJECT.test(told)) && hitsIn(text) >= topic.need && !off(learnKey) && !learns.some(x => x.key === learnKey)) {
            learns.push({ character: h.name, order, unit, sentence, key: learnKey });
          }
        }

        const total = hitsIn(spoken) >= topic.need || hitsIn(text) >= topic.need;
        if (!total) return;
        const asking = /\?/.test(spoken);
        const shows = new Set<string>();
        const spokeKey = (who: string) => `know|spoke|${topic.key}|${who}|${unit.chapterId}|${clean(sentence)}`;
        speakers.forEach(s => { if (hitsIn(spoken) >= topic.need && !asking && !HYPOTHETICAL.test(spoken) && !off(spokeKey(s))) shows.add(s); });
        knowers.forEach(k => { if (hitsIn(text) >= topic.need && !off(spokeKey(k))) shows.add(k); });
        matches.push({ order, unit, sentence, speakers: shows, knowers });
      });
    });

    const thereKey = (m: Match, who: string) => `know|there|${topic.key}|${who}|${m.unit.chapterId}|${clean(m.sentence)}`;
    const spokeId = (m: Match, who: string) => `know|spoke|${topic.key}|${who}|${m.unit.chapterId}|${clean(m.sentence)}`;

    if (sink) {
      const row = (how: ReadKnowledgeRecord['how'], character: string, id: string, at?: { unit: FactUnit; sentence: string; order: number }): ReadKnowledgeRecord => ({
        id, secret: topic.label, secretText: topic.secret, character, how,
        chapterId: at?.unit.chapterId ?? '', chapterTitle: at?.unit.title ?? '', quote: at ? truncate(at.sentence, 200) : '',
        order: at?.order ?? -1, ignored: setAside.has(id),
      });
      if (topic.owner) sink.push(row('owner', topic.owner, `know|owner|${topic.key}`));
      topic.knownByNames.forEach(n => sink.push(row('marked knows', n, `know|marked|${topic.key}|${n}`)));
      topic.hiddenFromNames.forEach(n => sink.push(row('marked must not know', n, `know|hidden|${topic.key}|${n}`)));
      learns.forEach(l => sink.push(row('learned', l.character, l.key, l)));
      const spokeBy = new Map<string, number>();
      const thereBy = new Map<string, number>();
      matches.forEach(m => {
        m.speakers.forEach(who => {
          if (spokeBy.get(who) === 1) return;
          spokeBy.set(who, 1);
          sink.push(row('spoke', who, spokeId(m, who), m));
        });
        presence.get(m.unit.index)?.forEach(who => {
          // the first couple of times is enough to show how they came to know; the rest is noise.
          const seen = thereBy.get(who) ?? 0;
          if (m.speakers.has(who) || topic.ownerKeys.has(who.toLowerCase()) || seen >= 2) return;
          thereBy.set(who, seen + 1);
          sink.push(row('there', who, thereKey(m, who), m));
        });
      });
    }

    const byCharacter = new Map<string, Match[]>();
    matches.forEach(m => m.speakers.forEach(s => byCharacter.set(s, [...(byCharacter.get(s) ?? []), m])));

    byCharacter.forEach((shown, character) => {
      const who = character.toLowerCase();
      if (topic.ownerKeys.has(who) || topic.knownBy.has(who)) return;
      const first = shown.reduce((a, b) => (a.order <= b.order ? a : b));

      // told it, or read it, or there when it came up, before the first time they used it?
      const informedBy = (limit: number) =>
        matches.find(m => m.order < limit && !m.speakers.has(character) && (presence.get(m.unit.index)?.has(character) ?? false) && !off(thereKey(m, character))) ??
        learns.find(l => l.character === character && l.order < limit);
      if (informedBy(first.order)) return;

      const later = learns.find(l => l.character === character && l.order > first.order);
      const place = `${first.unit.title}`;
      if (topic.hiddenFrom.has(who) && !later) {
        findings.push({
          id: `finding-knows-${slug(character)}-${topic.key}`,
          category: 'continuity',
          title: `Knowledge: ${character} seems to know ${topic.label}`,
          summary: `The Story Bible says ${character} must not know ${topic.label}, yet in ${place} they talk as if they do, and nothing earlier shows them finding out. Did they learn it, or should this line change?`,
          evidencePassages: evidenceOf([first]),
          confidence: 'probable',
          status: 'unreviewed',
          subject: character,
        });
      } else if (later) {
        findings.push({
          id: `finding-knows-${slug(character)}-${topic.key}`,
          category: 'continuity',
          title: `Knowledge: ${character} already knew ${topic.label} before learning it`,
          summary: `${character} speaks as if they know ${topic.label} in ${place}, but ${later.unit.title} presents it as news to ${character}. Which comes first?`,
          evidencePassages: evidenceOf([first, later]),
          confidence: 'probable',
          status: 'unreviewed',
          subject: character,
        });
      } else {
        // family, a partner, a close friend or a mentor can plausibly just know; the writer can still mark them must-not-know
        if (closeToOwner(character, topic.owner)) return;
        findings.push({
          id: `finding-knows-${slug(character)}-${topic.key}`,
          category: 'continuity',
          title: `Knowledge: how does ${character} know ${topic.label}?`,
          summary: `${character} talks as if they know ${topic.label} in ${place} (the Story Bible has it as “${truncate(topic.secret, 90)}”), but nothing earlier shows ${character} being told, reading it, or being in a scene where it comes up. They may have learned it offstage; is a moment missing?`,
          evidencePassages: evidenceOf([first]),
          confidence: 'possible_exploration',
          status: 'unreviewed',
          subject: character,
        });
      }
    });
  }
  return findings;
}

export function whereAndKnowsFindings(src: WhereKnowsSource): AnalysisFinding[] {
  const days = sceneDays(src.timeline, src.units);
  return [...analyzeWhere(src, days), ...analyzeKnowledge(src)];
}

// everything the scan read about where characters were and who knows what, in reading order
// includes what the writer set aside (flagged)
export function readWhereAndKnows(src: WhereKnowsSource): { places: ReadPlaceRecord[]; knowledge: ReadKnowledgeRecord[] } {
  const places: ReadPlaceRecord[] = [];
  const knowledge: ReadKnowledgeRecord[] = [];
  analyzeWhere(src, sceneDays(src.timeline, src.units), places);
  analyzeKnowledge(src, knowledge);
  const unique = <T extends { id: string }>(list: T[]) => Array.from(new Map(list.map(x => [x.id, x])).values());
  return {
    places: unique(places).sort((a, b) => a.order - b.order),
    knowledge: unique(knowledge).sort((a, b) => a.order - b.order),
  };
}
