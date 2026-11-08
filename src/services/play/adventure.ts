import type { Project, CharacterProfile, LocationProfile } from '../../types';
import type { Adventure, AdventureRolls, AdventureSlot, CustomTable, JournalEntry, OracleAnswer } from './types';
import { escapeHtml, pick, roll, uid, type Rng } from './rng';

// Roll Your Story: a solo storytelling game. tables build a premise (a place, two people, how they are tied, what is happening),
// an oracle answers yes-or-no questions, random events and complications keep things moving, and a journal keeps it all.
// every roll can be redone or locked. the writer decides what it all means.

export const SLOTS: Array<{ id: AdventureSlot; label: string }> = [
  { id: 'setting', label: 'Setting' },
  { id: 'characterA', label: 'Character one' },
  { id: 'characterB', label: 'Character two' },
  { id: 'connection', label: 'Their connection' },
  { id: 'situation', label: 'The current situation' },
];

const SETTINGS = [
  'A seaside town preparing for an annual funeral festival.',
  'A mountain monastery that has not had a visitor in eleven years.',
  'A night train that stops at stations that are not on any map.',
  'A border market where every stall sells something it should not.',
  'An island lighthouse, and the mainland has stopped answering the radio.',
  'A city flooded to the second floor, where people now move by boat.',
  'A theatre the night before it is demolished.',
  'A river town whose bridge was washed out, and nobody has fixed it.',
  'A greenhouse the size of a cathedral, abandoned by the people who built it.',
  'A desert diner that is somehow always open.',
  'A boarding school in the last week of term, half the students already gone.',
  'A quarantined harbor with ships waiting at anchor.',
  'A small town where it has been snowing for forty days.',
  'A lighthouse keeper\'s cottage with three beds and one resident.',
  'A traveling fair that has outstayed its welcome in the same field.',
  'An orchard on the edge of a war nobody there will discuss.',
  'A hotel in the off-season, with a single guest in each wing.',
  'A walled garden at the back of a hospital.',
  'A ferry that crosses a lake no one remembers the name of.',
  'A mining town on the day the last shift comes up.',
  'A library that lends things other than books.',
  'A village at the base of a dam that is being drained.',
];

const PEOPLE = [
  'A traveling physician who has never treated a living patient.',
  'A retired sailor who claims to have drowned twenty years ago.',
  'A courier who has never read a letter they carried, and is beginning to want to.',
  'A schoolteacher who keeps every promise and regrets most of them.',
  'A cartographer who draws places from other people\'s descriptions.',
  'A night nurse who knows everyone\'s secrets and shares none of them.',
  'A former forger trying to live honestly under a borrowed name.',
  'A baker who can tell a stranger\'s trouble by the bread they choose.',
  'A watchman who sleeps on duty on purpose, and dreams of what he is guarding.',
  'A young heir who would give everything away if anyone would take it.',
  'A translator who has been paid to mistranslate one conversation.',
  'A widow who still sets a place at the table, and has started to resent it.',
  'A ferryman who has stopped charging for the crossing.',
  'A clockmaker whose clocks are all four minutes slow.',
  'An exiled musician who has stopped being able to hear their own music.',
  'A soldier who deserted to carry a message nobody asked them to carry.',
  'A midwife who is afraid of the dark and works only at night.',
  'A gardener who has been growing something illegal, and something unexpected.',
  'A stranger who arrived last week and is already needed.',
  'A debt collector who has begun to leave things on the doorstep instead.',
  'A lighthouse keeper who has not turned the lamp on in weeks.',
  'A runaway who is far older than they look.',
  'An auctioneer who knows exactly what everything is worth, except one thing.',
  'A cook who can only make the dishes of a country that no longer exists.',
];

const CONNECTIONS = [
  'One of them once saved the other\'s life, but neither remembers it the same way.',
  'They used to be partners, and the way it ended has never been spoken of.',
  'One of them owes the other a large debt, and the other has never asked for it.',
  'They are the only two people who know what happened that night.',
  'One is the other\'s only living relative, and they have not spoken in years.',
  'They have been writing to each other under false names.',
  'One of them was hired to watch the other.',
  'They grew up two streets apart and have never exchanged a word.',
  'One of them is the reason the other left home.',
  'They are bound by a promise made to someone who has since died.',
  'They were once rivals, and now are the only ones left who remember why.',
  'One of them has been quietly protecting the other without being asked.',
  'They have just met, and one of them is pretending otherwise.',
  'They were married briefly, a long time ago, for reasons neither will discuss.',
  'One of them was once the other\'s teacher.',
  'They have the same enemy and have never agreed to it.',
];

const SITUATIONS = [
  'Someone has left a letter addressed to both of them at the town\'s altar.',
  'A stranger arrives who claims to know them both.',
  'The only way out has been closed, and only one of them knows why.',
  'Something belonging to one of them has turned up in the other\'s possession.',
  'An old promise comes due, and tonight is the deadline.',
  'A rumor about them both is spreading, and neither knows who began it.',
  'One of them has been asked to choose between two things they cannot give up.',
  'Someone is dying, and has asked for them both by name.',
  'An object that should have been lost for good has come back.',
  'They have been asked to keep a secret that is already out.',
  'A storm is coming, and they are each trying to leave in opposite directions.',
  'There is a body, and neither of them knows whose it is.',
  'One of them has to decide whether to tell the truth to everyone.',
  'A door that has always been locked is standing open.',
  'They have each been given half of a message.',
  'Someone has taken the blame for something one of them did.',
  'The thing they came here to find is no longer here.',
  'A visitor is expected, and one of them is hoping they will not come.',
];

const COMPLICATIONS = [
  'Someone arrives earlier than expected.',
  'The thing they were relying on is no longer reliable.',
  'A lie told earlier has caught up with them.',
  'The weather, the tide or the road changes the plan.',
  'A rule they did not know about applies.',
  'They are overheard.',
  'Help comes from the wrong person.',
  'What they came for costs more than they thought.',
  'Someone they trusted has their own reasons.',
  'The solution creates a second problem.',
  'A small mistake from earlier turns out to matter.',
  'They realize they have been looking at the wrong thing.',
  'A friendly face turns out to be tired of being friendly.',
  'Time runs out sooner than expected.',
  'An old injury, grudge or habit gets in the way.',
  'The answer they were given was only partly true.',
  'Someone needs them, right now, somewhere else.',
  'The way forward is open, but one of them would have to be left behind.',
];

// a focus for a random event, and two words to interpret it with
const EVENT_FOCUS = [
  'A new character arrives.',
  'A character\'s goal changes.',
  'Something hidden comes to light.',
  'An opportunity appears.',
  'A threat becomes real.',
  'Someone leaves, or is taken.',
  'A promise or a loyalty is tested.',
  'The place itself changes.',
  'Something is lost, or found.',
  'An old tie returns.',
  'The ordinary turns strange.',
  'Someone says the thing nobody was supposed to say.',
];
const MEANING_ACTION = ['abandon', 'break', 'bring', 'burn', 'carry', 'change', 'chase', 'close', 'conceal', 'cross', 'delay', 'deny', 'divide', 'escape', 'forgive', 'gather', 'guard', 'hide', 'invite', 'lose', 'mend', 'offer', 'open', 'protect', 'refuse', 'release', 'return', 'search', 'share', 'steal', 'trade', 'warn', 'wait', 'welcome'];
const MEANING_SUBJECT = ['anger', 'a debt', 'a door', 'a family', 'a favor', 'fear', 'a friend', 'a gift', 'a grave', 'grief', 'a home', 'hunger', 'a journey', 'a kindness', 'a lie', 'a lock', 'a map', 'a memory', 'a name', 'a night', 'a price', 'a promise', 'rain', 'a secret', 'a song', 'a stranger', 'a threat', 'trust', 'a letter', 'the past', 'a weapon', 'a wound'];

export function rollSlot(slot: AdventureSlot, rng: Rng = Math.random): string {
  switch (slot) {
    case 'setting': return pick(SETTINGS, rng);
    case 'characterA': case 'characterB': return pick(PEOPLE, rng);
    case 'connection': return pick(CONNECTIONS, rng);
    case 'situation': return pick(SITUATIONS, rng);
  }
}

export function rollPremise(locked: readonly AdventureSlot[] = [], previous?: AdventureRolls, rng: Rng = Math.random): AdventureRolls {
  const out = {} as AdventureRolls;
  SLOTS.forEach(({ id }) => {
    // two people are never the same person
    let next = previous && locked.includes(id) ? previous[id] : rollSlot(id, rng);
    if (id === 'characterB' && next === out.characterA && !locked.includes(id)) next = pick(PEOPLE.filter(p => p !== out.characterA), rng);
    out[id] = next;
  });
  return out;
}

// redo one slot, avoiding what is already there
export function rerollSlot(rolls: AdventureRolls, slot: AdventureSlot, rng: Rng = Math.random): AdventureRolls {
  for (let i = 0; i < 12; i++) {
    const next = rollSlot(slot, rng);
    const clash = next === rolls[slot] || (slot === 'characterA' && next === rolls.characterB) || (slot === 'characterB' && next === rolls.characterA);
    if (!clash) return { ...rolls, [slot]: next };
  }
  return rolls;
}

export function newAdventure(rng: Rng = Math.random, now = new Date()): Adventure {
  const at = now.toISOString();
  return {
    id: uid('adv'), title: '', rolls: rollPremise([], undefined, rng), locked: [], nameA: '', nameB: '',
    odds: 'even', chaos: 3, journal: [], createdAt: at, updatedAt: at,
  };
}

export const adventureTitle = (a: Adventure) => a.title.trim() || a.rolls.setting.replace(/\.$/, '').slice(0, 60);

// ---- dice ----

export interface DiceResult { text: string; total: number; parts: number[]; modifier: number }

// "2d6+1", "d20", "3d4-2". null when it is not dice
export function rollDice(spec: string, rng: Rng = Math.random): DiceResult | null {
  const m = /^\s*(\d{0,2})d(\d{1,3})\s*(?:([+-])\s*(\d{1,3}))?\s*$/i.exec(spec);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  if (count < 1 || count > 20 || sides < 2) return null;
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  const parts = Array.from({ length: count }, () => roll(sides, rng));
  const total = parts.reduce((a, b) => a + b, 0) + modifier;
  const text = `${count > 1 || parts.length > 1 ? parts.join(' + ') : parts[0]}${modifier ? ` ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}` : ''}${parts.length > 1 || modifier ? ` = ${total}` : ''}`;
  return { text, total, parts, modifier };
}

// ---- the oracle ----

export const ODDS_LABEL: Record<Adventure['odds'], string> = { likely: 'Likely', even: 'Fifty-fifty', unlikely: 'Unlikely' };
const THRESHOLD: Record<Adventure['odds'], number> = { likely: 75, even: 50, unlikely: 25 };

export const ORACLE_LABEL: Record<OracleAnswer, string> = {
  yes_and: 'Yes, and…',
  yes: 'Yes',
  yes_but: 'Yes, but…',
  no_but: 'No, but…',
  no: 'No',
  no_and: 'No, and…',
};

export const ORACLE_HINT: Record<OracleAnswer, string> = {
  yes_and: 'Yes, and it goes further than expected. Add something that makes it better.',
  yes: 'Yes.',
  yes_but: 'Yes, but there is a catch. Say what it costs.',
  no_but: 'No, but something softens it. Say what helps.',
  no: 'No.',
  no_and: 'No, and it gets worse. Add the new problem.',
};

export interface OracleRoll {
  roll: number;
  answer: OracleAnswer;
  // set when the dice also call for a random event
  event: boolean;
}

// yes lives at or below the threshold. the two ends of each side (the most and least decisive fifth) become "and" and "but".
export function askOracle(odds: Adventure['odds'], chaos = 3, rng: Rng = Math.random): OracleRoll {
  const r = roll(100, rng);
  const t = THRESHOLD[odds];
  let answer: OracleAnswer;
  if (r <= t) answer = r <= t * 0.2 ? 'yes_and' : r > t * 0.8 ? 'yes_but' : 'yes';
  else {
    const q = (r - t) / (100 - t);
    answer = q > 0.8 ? 'no_and' : q <= 0.2 ? 'no_but' : 'no';
  }
  // doubles (11, 22 ... 99) call for a random event when the digit is within the chaos level
  const digit = r % 11 === 0 && r < 100 ? r / 11 : 0;
  return { roll: r, answer, event: digit > 0 && digit <= Math.max(1, Math.min(9, chaos)) };
}

export const QUICK_QUESTIONS = [
  'Does the character tell the truth?',
  'Is the stranger trustworthy?',
  'Does the plan succeed?',
  'Is there something unexpected in the room?',
  'Is anyone else here?',
  'Does it go the way they hoped?',
  'Do they find what they came for?',
  'Is it already too late?',
];

export interface RandomEvent { focus: string; action: string; subject: string }

export function randomEvent(rng: Rng = Math.random): RandomEvent {
  return { focus: pick(EVENT_FOCUS, rng), action: pick(MEANING_ACTION, rng), subject: pick(MEANING_SUBJECT, rng) };
}
export const eventText = (e: RandomEvent) => `${e.focus} (${e.action} / ${e.subject})`;

export const randomComplication = (rng: Rng = Math.random): string => pick(COMPLICATIONS, rng);

// ---- custom tables ----

export function rollTable(table: CustomTable, rng: Rng = Math.random): string | null {
  const entries = table.entries.map(e => e.trim()).filter(Boolean);
  return entries.length ? pick(entries, rng) : null;
}

export const parseEntries = (text: string): string[] => text.split('\n').map(l => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);

// ---- the journal ----

export function journalEntry(kind: JournalEntry['kind'], text: string, result?: string, now = new Date()): JournalEntry {
  return { id: uid('j'), kind, text, ...(result ? { result } : {}), at: now.toISOString() };
}

export function addToJournal(a: Adventure, e: JournalEntry): Adventure {
  return { ...a, journal: [...a.journal, e], updatedAt: new Date().toISOString() };
}

export const MAX_ADVENTURES = 30;

// ---- saving as a document ----

const nameOf = (given: string, fallback: string) => given.trim() || fallback;

const characterCard = (id: string, name: string, role: CharacterProfile['role'], description: string, other: { id: string; name: string }, connection: string): CharacterProfile => ({
  id, name, role,
  // the roll describes who they are, so it goes where the writer will see it first and can rewrite it
  archetype: description.replace(/\.$/, ''),
  coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription: '', theSecret: '',
  relationships: [{ targetCharacterId: other.id, targetName: other.name, relationshipType: '', notes: connection, types: [] }],
});

const journalHtml = (a: Adventure): string => {
  const parts = a.journal.map(e => {
    if (e.kind === 'note') return `<p>${escapeHtml(e.text).replace(/\n/g, '<br/>')}</p>`;
    const label = e.kind === 'oracle' ? 'Oracle' : e.kind === 'event' ? 'Event' : e.kind === 'complication' ? 'Complication' : e.kind === 'table' ? 'Table' : 'Roll';
    return `<p><em>${label}: ${escapeHtml(e.text)}${e.result ? ` → ${escapeHtml(e.result)}` : ''}</em></p>`;
  });
  return parts.length ? parts.join('') : '<p><br></p>';
};

// the pieces of a new document: the premise as the synopsis, the two people and the place in the story bible, the journal as the first chapter
export function adventureToProject(a: Adventure): Pick<Project, 'title' | 'synopsis' | 'tags' | 'storyBible'> & { chapterTitle: string; chapterHtml: string } {
  const nameA = nameOf(a.nameA, 'Character one');
  const nameB = nameOf(a.nameB, 'Character two');
  const ida = `char-${a.id}-a`;
  const idb = `char-${a.id}-b`;
  const place: LocationProfile = { id: `loc-${a.id}`, name: a.rolls.setting.replace(/^(?:an?|the)\s+/i, '').replace(/\.$/, '').slice(0, 60), type: '', atmosphere: a.rolls.setting, sensoryDetails: '', significance: a.rolls.situation };
  const synopsis = `${a.rolls.setting} ${nameA}: ${a.rolls.characterA} ${nameB}: ${a.rolls.characterB} ${a.rolls.connection} ${a.rolls.situation}`;
  return {
    title: adventureTitle(a),
    synopsis,
    tags: ['Solo adventure'],
    storyBible: {
      characters: [
        characterCard(ida, nameA, 'protagonist', a.rolls.characterA, { id: idb, name: nameB }, a.rolls.connection),
        characterCard(idb, nameB, 'deuteragonist', a.rolls.characterB, { id: ida, name: nameA }, a.rolls.connection),
      ],
      locations: [place],
      lore: [],
    },
    chapterTitle: 'Adventure journal',
    chapterHtml: journalHtml(a),
  };
}

// the whole journal as plain text, for copying
export function journalText(a: Adventure): string {
  const lines = [adventureTitle(a), '', ...SLOTS.map(s => `${s.label}: ${a.rolls[s.id]}`), ''];
  a.journal.forEach(e => lines.push(e.kind === 'note' ? e.text : `[${e.kind}] ${e.text}${e.result ? ` → ${e.result}` : ''}`));
  return lines.join('\n');
}
