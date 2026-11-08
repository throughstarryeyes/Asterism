import { pick, pickDistinct, shuffle, uid, type Rng } from './rng';

// the mystery generator: a case file a writer can investigate alone. the solution is built first and the clues are made to fit it,
// so every case can be solved from the evidence: exactly one suspect has no alibi that holds up and has the means.

export type MysteryMode = 'three_suspects' | 'locked_room' | 'unreliable';

export const MYSTERY_MODES: Array<{ id: MysteryMode; label: string; hint: string }> = [
  { id: 'three_suspects', label: 'Three suspects', hint: 'Everyone has a motive, but only one had the opportunity.' },
  { id: 'locked_room', label: 'The locked room', hint: 'A seemingly impossible situation. Work out how it happened.' },
  { id: 'unreliable', label: 'Unreliable evidence', hint: 'Some clues mislead, though none of them lie.' },
];

export interface Suspect { id: string; name: string; role: string; motive: string; claim: string }

export type EvidenceKind = 'opportunity' | 'means' | 'motive' | 'alibi' | 'contradiction' | 'herring' | 'explanation';

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  // the suspect the clue is about, if any
  about?: string;
  // how the writer reaches it ("Search the study")
  lead: string;
  // what they find
  text: string;
  // true when it points the wrong way. never because it is false: it is true, and it means something else.
  misleading?: boolean;
}

export interface Solution { culprit: string; how: string; why: string }

export interface Case {
  id: string;
  mode: MysteryMode;
  title: string;
  incident: string;
  place: string;
  suspects: Suspect[];
  evidence: Evidence[];
  solution: Solution;
}

interface IncidentDef { title: string; incident: string; place: string; time: string; object: string; how: string }

const INCIDENTS: IncidentDef[] = [
  { title: 'The Missing Portrait', incident: 'The founder\'s portrait vanished from the long gallery during the evening\'s gala.', place: 'the long gallery', time: 'between nine and ten', object: 'a service trolley', how: 'cut it from its frame and wheeled it out under a tablecloth' },
  { title: 'The Silenced Bell', incident: 'The town\'s bell was found cracked the morning of the festival, and the tower was locked all night.', place: 'the bell tower', time: 'after midnight', object: 'a heavy hammer', how: 'struck it from the stair with a hammer wrapped in felt' },
  { title: 'The Empty Safe', incident: 'The contents of the club\'s safe were gone when the treasurer opened it on Monday.', place: 'the club office', time: 'over the weekend', object: 'a spare key', how: 'used a copy of the key and put everything back in order except the money' },
  { title: 'The Spoiled Wedding Cake', incident: 'The wedding cake was ruined an hour before the ceremony, and someone had to have done it on purpose.', place: 'the pantry', time: 'just before noon', object: 'a jar of salt', how: 'swapped the sugar in the frosting for salt and put the labels back' },
  { title: 'The Stopped Clocks', incident: 'Every clock in the manor stopped at the same minute, and the old lord has not been seen since.', place: 'the east corridor', time: 'a little after two in the morning', object: 'a brass key', how: 'opened the master case and halted the whole house from a single mechanism' },
  { title: 'The Poisoned Well', incident: 'The village well was fouled the night before the harvest feast.', place: 'the village green', time: 'just after dusk', object: 'a grain sack', how: 'dumped a sack of rotted grain in from behind the cart-shed' },
  { title: 'The Stolen Score', incident: 'The only copy of a celebrated composer\'s unfinished piece disappeared from the conservatory archive.', place: 'the archive', time: 'between rehearsals', object: 'a borrowed folder', how: 'slipped it into a borrowed folder and carried it out in plain sight' },
  { title: 'The Drowned Letters', incident: 'A bundle of letters that could have changed an inheritance was found soaked and unreadable in the boathouse.', place: 'the boathouse', time: 'late in the afternoon', object: 'a bucket', how: 'carried them down in a bucket and left the door ajar so it would look like the tide' },
];

const FIRST = ['Mara', 'Tobias', 'Ines', 'Calder', 'Odalys', 'Fenn', 'Ruth', 'Anselm', 'Petra', 'Idris', 'Wren', 'Casimir', 'Noor', 'Leopold', 'Sabine', 'Emeric', 'Thea', 'Gideon', 'Linnea', 'Cormac', 'Ysolde', 'Barnaby', 'Delphine', 'Ravi'];
const LAST = ['Ashby', 'Voss', 'Marlowe', 'Kestrel', 'Okonkwo', 'Hale', 'Ferreira', 'Dunmore', 'Lindqvist', 'Prewitt', 'Abara', 'Thorne', 'Castellan', 'Mbeki', 'Quill', 'Strand', 'Valdez', 'Whitcombe', 'Rao', 'Sorensen', 'Ibarra', 'Pell', 'Greaves', 'Nakamura'];
const ROLES = ['the caretaker', 'a cousin of the owner', 'a rival', 'a patron', 'the apprentice', 'the accountant', 'the cook', 'a neighbor', 'a journalist', 'the family lawyer', 'the driver', 'the new hire', 'a retired teacher', 'the steward', 'a visiting scholar', 'the night porter'];
const MOTIVES = [
  'owed a large debt that would be forgiven if the owner were embarrassed',
  'was about to be dismissed',
  'was jealous of a rival who got all the credit',
  'was being blackmailed and needed the money',
  'had been publicly humiliated at an earlier gathering',
  'would inherit if the matter went badly',
  'wanted to keep something hidden that this would have exposed',
  'felt cheated by the owner years ago and never forgot it',
  'wanted the whole matter to look like someone else\'s doing',
  'believed it would end an old feud on their own terms',
];
const WHERE_WERE = [
  'speaking with the cook in the kitchen',
  'on a long telephone call in the garden',
  'helping a guest find their coat',
  'resting in their room with a headache',
  'counting the till at the bar',
  'sitting at the back of the hall, listening to the speeches',
  'walking the dog by the river',
  'mending something in the workshop',
];
const WITNESSES = ['the housekeeper', 'a delivery boy', 'the gardener', 'a guest who stayed late', 'the cloakroom attendant', 'a child who was not supposed to be up', 'the neighbor across the lane'];
const BENIGN = ['was carrying a surprise gift', 'was sneaking out to meet someone, and wanted no one to ask where', 'was returning something they had borrowed without asking', 'was avoiding a conversation, nothing more', 'was ill and did not want to be seen'];

const LOCKED: Array<{ impossible: string; how: string; means: string; trace: string; place: string }> = [
  { impossible: 'The study door was locked and bolted from the inside, and the window is painted shut.', how: 'The bolt was never shot. It was held up on a thread, which dropped into place when the door was pulled shut from outside.', means: 'a spool of strong thread', trace: 'a strand of thread caught on the bolt, and a small mark on the doorframe at head height', place: 'the study' },
  { impossible: 'The vault was sealed from outside with the seal unbroken, yet the contents are gone.', how: 'The back panel of the vault was unscrewed from the inside of the neighboring cupboard and put back afterwards.', means: 'a small screwdriver set', trace: 'fresh scratches on the screws of the back panel, and dust missing from the cupboard\'s floor', place: 'the vault' },
  { impossible: 'The only key to the attic was in the victim\'s pocket, and the door was locked from within.', how: 'The lock was fitted with a spare latch that could be turned from outside with a bent wire. The "key in the pocket" was placed there afterwards.', means: 'a length of wire', trace: 'bright scratches around the keyhole, and a bent bit of wire in a flowerpot on the landing', place: 'the attic' },
  { impossible: 'The boathouse was locked, with ice on the sill, and nobody had crossed the snow outside.', how: 'The culprit went out the lake side, along a plank that was drawn up afterwards, which left no footprints on the snow.', means: 'a long plank', trace: 'two small holes in the ice at the water\'s edge and a damp plank leaning behind the boats', place: 'the boathouse' },
  { impossible: 'The cellar was locked from outside by the cook, who then went upstairs, yet the wine was gone when she came down.', how: 'The wine was taken before the door was locked, and a decoy crate with sand in it was left in its place.', means: 'a crate and a sack of sand', trace: 'sand under the shelves and a crate that is too light for its label', place: 'the cellar' },
  { impossible: 'The greenhouse had been locked for the night, and the orchid cabinet was still sealed, but the orchid was gone.', how: 'The orchid was removed in the afternoon and replaced with a paper copy in the dim light. Nobody looked closely again.', means: 'a paper copy', trace: 'a trace of glue and a petal made of paper behind the pot', place: 'the greenhouse' },
];

const dedupe = (s: string) => s.replace(/\s+/g, ' ').trim();

function makeSuspects(rng: Rng): Suspect[] {
  const names = pickDistinct(FIRST, 3, rng).map(f => `${f} ${pick(LAST, rng)}`);
  const roles = pickDistinct(ROLES, 3, rng);
  const motives = pickDistinct(MOTIVES, 3, rng);
  const wheres = pickDistinct(WHERE_WERE, 3, rng);
  return names.map((name, i) => ({ id: uid('s'), name, role: roles[i], motive: motives[i], claim: wheres[i] }));
}

// a made-up name, for games that need a character quickly
export const randomName = (rng: Rng = Math.random): string => `${pick(FIRST, rng)} ${pick(LAST, rng)}`;

export function generateCase(mode: MysteryMode = 'three_suspects', rng: Rng = Math.random): Case {
  const inc = pick(INCIDENTS, rng);
  const suspects = makeSuspects(rng);
  const culprit = pick(suspects, rng);
  const innocents = suspects.filter(s => s !== culprit);
  const witnesses = pickDistinct(WITNESSES, 3, rng);
  const ev: Evidence[] = [];
  const add = (kind: EvidenceKind, lead: string, text: string, about?: string, misleading?: boolean) =>
    ev.push({ id: uid('e'), kind, lead, text: dedupe(text), ...(about ? { about } : {}), ...(misleading ? { misleading } : {}) });

  // everyone has a motive: it narrows nothing
  suspects.forEach(s => add('motive', `Ask about ${s.name}`, `${s.name}, ${s.role}, ${s.motive}.`, s.id));

  // the innocents have alibis that hold, each confirmed by someone else
  innocents.forEach((s, i) => add('alibi', `Check on ${s.name}'s whereabouts`, `${witnesses[i]} says ${s.name} was ${s.claim} ${inc.time}, and was never out of sight for long.`, s.id));

  // the culprit gives an account that breaks
  const lie = culprit.claim;
  add('contradiction', `Check ${culprit.name}'s story`, `${culprit.name} says they were ${lie} ${inc.time}. ${witnesses[2]} says ${culprit.name} was gone for about twenty minutes.`, culprit.id);

  let how: string;
  if (mode === 'locked_room') {
    const room = pick(LOCKED, rng);
    how = room.how;
    add('explanation', `Search ${room.place}`, `${room.trace[0].toUpperCase()}${room.trace.slice(1)}.`);
    add('means', `Look through ${culprit.name}'s things`, `${culprit.name} keeps ${room.means}, with no obvious use for it.`, culprit.id);
    // one innocent also has something that looks like the means, and it is for something else
    add('herring', `Look through ${innocents[0].name}'s things`, `${innocents[0].name} also keeps ${room.means}, and has no good explanation for why.`, innocents[0].id, true);
    const name = room.place.replace(/^the\s+/, '');
    return finish(mode, `The Locked ${name.charAt(0).toUpperCase()}${name.slice(1)}`, room.impossible, room.place, suspects, ev, { culprit: culprit.id, how, why: culprit.motive });
  }

  how = `${culprit.name} ${inc.how}.`;
  add('opportunity', `Examine ${inc.place}`, `The records show ${culprit.name} signed out ${inc.object} earlier that day, and nobody has seen it since. It was found near ${inc.place}.`, culprit.id);
  add('means', `Ask about ${inc.object}`, `Nobody else had any reason to ask for ${inc.object} that day.`, culprit.id);

  // a clue that points at an innocent. it is true; it just does not mean what it seems to
  const herringTarget = innocents[0];
  add('herring', `Ask who was seen near ${inc.place}`, `${witnesses[1]} saw ${herringTarget.name} hurry away from ${inc.place} ${inc.time}.`, herringTarget.id, true);
  add('explanation', `Press ${herringTarget.name} on that`, `${herringTarget.name} admits to being there, but only because they ${pick(BENIGN, rng)}.`, herringTarget.id);

  if (mode === 'unreliable') {
    // a second misleading clue and a witness with a reason to be wrong
    const other = innocents[1];
    add('herring', `Read ${other.name}'s correspondence`, `A note in ${other.name}'s handwriting reads: "After this, nobody will be able to say I did not warn them."`, other.id, true);
    add('explanation', 'Ask who the note was meant for', `The note was written about something else entirely, an unrelated warning about the roof. ${other.name} never knew it could be misread.`, other.id);
  }

  return finish(mode, inc.title, inc.incident, inc.place, suspects, ev, { culprit: culprit.id, how, why: culprit.motive });
}

function finish(mode: MysteryMode, title: string, incident: string, place: string, suspects: Suspect[], evidence: Evidence[], solution: Solution): Case {
  return { id: uid('case'), mode, title, incident, place, suspects, evidence: shuffle(evidence), solution };
}

// what happens when the writer names a suspect
export interface Verdict { correct: boolean; culprit: Suspect; text: string }

export function accuse(c: Case, suspectId: string): Verdict {
  const culprit = c.suspects.find(s => s.id === c.solution.culprit)!;
  const correct = suspectId === culprit.id;
  const mistaken = c.suspects.find(s => s.id === suspectId);
  const explain = `${c.solution.how.trim()} ${culprit.name} ${c.solution.why}.`;
  return {
    correct, culprit,
    text: correct
      ? `Yes. It was ${culprit.name}. ${explain} The other two had alibis that held up, and the clues that pointed at them had a plain explanation.`
      : `Not ${mistaken?.name ?? 'them'}. It was ${culprit.name}. ${explain} Look again at what the evidence says about where each of them was.`,
  };
}

// the case as plain text, for copying or saving with the writer's own notes
export function caseText(c: Case, found: readonly string[], notes: string, solved?: Verdict): string {
  const lines = [c.title, c.incident, '', 'Suspects:', ...c.suspects.map(s => `- ${s.name}, ${s.role}`), '', 'What was found:'];
  c.evidence.filter(e => found.includes(e.id)).forEach(e => lines.push(`- ${e.text}`));
  if (notes.trim()) lines.push('', 'My notes:', notes.trim());
  if (solved) lines.push('', solved.text);
  return lines.join('\n');
}

// a gentle check of a case the writer built, as things to think about rather than errors
export function mysteryChecks(m: { incident: string; suspects: Array<{ name: string; role: string }>; evidence: Array<{ text: string }>; culprit: string; how: string }): string[] {
  const out: string[] = [];
  const suspects = m.suspects.filter(s => s.name.trim());
  const evidence = m.evidence.filter(e => e.text.trim());
  if (!m.incident.trim()) out.push('Say what happened.');
  if (suspects.length < 3) out.push('Three or more suspects keeps it from being obvious.');
  if (m.culprit.trim() && !suspects.some(s => s.name.trim().toLowerCase() === m.culprit.trim().toLowerCase())) out.push('The culprit is not one of the suspects.');
  if (!m.culprit.trim()) out.push('Decide who did it.');
  if (!m.how.trim()) out.push('Decide how it was done, so the clues can fit.');
  const culprit = m.culprit.trim().toLowerCase();
  const mentions = (name: string) => evidence.filter(e => e.text.toLowerCase().includes(name.toLowerCase())).length;
  if (culprit && mentions(culprit) === 0) out.push('No clue mentions the culprit. A fair mystery lets the reader work it out.');
  const quiet = suspects.filter(s => mentions(s.name) === 0 && s.name.trim().toLowerCase() !== culprit);
  if (quiet.length) out.push(`${quiet.map(s => s.name).join(' and ')} ${quiet.length === 1 ? 'has' : 'have'} no clue about them yet, so ${quiet.length === 1 ? 'they are' : 'they are'} easy to rule out.`);
  if (evidence.length < 4) out.push('Four or more clues gives the investigator something to weigh.');
  return out;
}
