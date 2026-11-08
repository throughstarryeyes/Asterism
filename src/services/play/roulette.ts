import { fill, pick, pickDistinct, type Rng } from './rng';

// Relationship Roulette: two characters, a situation that forces them together, and questions that adapt to how they are connected.
// the aim is to find out something about the pair, not to write a scene. {A} and {B} are the two names.

export type RouletteMode = 'any' | 'romantic' | 'hostile' | 'history' | 'power' | 'friendship' | 'family' | 'strangers';

export const ROULETTE_MODES: Array<{ id: RouletteMode; label: string; hint: string }> = [
  { id: 'any', label: 'Surprise me', hint: 'Any situation, any questions' },
  { id: 'romantic', label: 'Romantic tension', hint: 'Something is there, and neither will say it' },
  { id: 'hostile', label: 'Hostility', hint: 'They would rather be anywhere else' },
  { id: 'history', label: 'Unresolved history', hint: 'Something happened, and it is still here' },
  { id: 'power', label: 'Unequal power', hint: 'One of them can hurt the other\'s life' },
  { id: 'friendship', label: 'Unlikely friendship', hint: 'They have no business getting along' },
  { id: 'family', label: 'Family dynamics', hint: 'Old roles, old habits' },
  { id: 'strangers', label: 'Complete strangers', hint: 'Nothing between them yet' },
];

const SHARED: string[] = [
  '{A} and {B} are stranded somewhere overnight.',
  '{A} discovers something {B} has been hiding.',
  '{A} and {B} have to pretend to be a couple.',
  '{A} is injured, and {B} is the only one who can care for them.',
  '{A} and {B} each receive conflicting instructions about the same task.',
  'They run into someone from {A}\'s past, and {B} is standing right there.',
  '{A} and {B} have to work together on something neither of them understands.',
  'A storm shuts the road, and {A} and {B} share the only open room for miles.',
  '{A} and {B} are locked out of the building with something important inside it.',
  '{A} and {B} are the only two people who show up to something everyone else skipped.',
  'A message meant for someone else lands in {B}\'s hands, and {A} sees them read it.',
  '{A} and {B} must share a long journey, with one seat between them and no way to avoid the talking.',
];

const BY_MODE: Record<Exclude<RouletteMode, 'any'>, string[]> = {
  romantic: [
    '{A} and {B} are paired for a slow dance neither wanted.',
    'Someone assumes {A} and {B} are together, and neither corrects them in time.',
    '{B} catches {A} watching them, and {A} has to decide what to say.',
    '{A} and {B} share a single blanket in a cold place.',
    'A rumor about {A} and {B} spreads, and each hears it from someone different.',
    '{A} has to ask {B} for a favor that means admitting something.',
  ],
  hostile: [
    '{A} and {B} are the only two left in a room after a fight that was not theirs.',
    '{B} is the only person who can help {A}, and {A} knows it.',
    'They have to agree on one story to tell a third party, and each wants a different one.',
    '{A} and {B} are chained to the same deadline, and only one of them can get the credit.',
    '{A} finds {B} at their lowest moment, and has the chance to walk away or not.',
    'A truce is called, and {A} and {B} are the ones chosen to keep it.',
  ],
  history: [
    '{A} and {B} meet at an event neither knew the other would attend.',
    '{B} returns something that belonged to {A}, years late.',
    '{A} and {B} are asked to speak about the same person, in front of the same room.',
    'An old promise between {A} and {B} comes due.',
    '{A} finds a letter {B} never sent.',
    'They are forced to go back to the place where it all went wrong.',
  ],
  power: [
    '{A} must ask {B} for something, and {B} is in no hurry to say yes.',
    '{B} holds a decision that will change {A}\'s life, and tonight is the last chance to argue it.',
    '{A} has learned something that could cost {B} their position, and {B} knows {A} knows.',
    '{B} gives {A} an order {A} thinks is wrong.',
    '{A} is asked to report on {B}, and has to decide what to say.',
    'A mistake is made, and only one of {A} and {B} will be blamed for it.',
  ],
  friendship: [
    '{A} and {B} are the last two people anyone expected to be seen together, and they are seen together.',
    '{B} shows {A} something they have never shown anyone.',
    '{A} defends {B} to someone, and {B} overhears.',
    'The thing that brought {A} and {B} together is gone, and they have to decide whether this continues.',
    '{A} and {B} each have a bad day on the same day, and find the other.',
    '{A} asks {B} to do something no friend should be asked to do.',
  ],
  family: [
    '{A} and {B} are clearing out a room that belonged to someone they both loved.',
    'A holiday, a long table, and a sentence {A} says that {B} has been waiting years to hear.',
    '{B} makes a decision about the family without asking {A}.',
    '{A} and {B} are sent together to fix something one of their relatives broke.',
    'Someone older makes a request of {A} and {B}, and they disagree on what it means.',
    '{A} and {B} remember the same childhood event completely differently.',
  ],
  strangers: [
    '{A} and {B} are seated together somewhere neither can leave for hours.',
    '{A} and {B} witness the same thing, and the only other witness is gone.',
    '{B} gives {A} directions that turn out to be wrong, and they find the right way together.',
    '{A} mistakes {B} for someone else and says something private.',
    '{A} and {B} each hold half of something.',
    'A small emergency makes {A} and {B} the only two people who can act.',
  ],
};

// questions that work for any pair
const ANY_QUESTIONS: string[] = [
  'Who is more likely to break the silence?',
  'What would {A} do that would genuinely surprise {B}?',
  'What would {B} do that would genuinely surprise {A}?',
  'What subject would they both deliberately avoid?',
  'What would happen if they switched roles?',
  'What would {A} tell a third person about this, and what would they leave out?',
  'What would {B} tell a third person about this, and what would they leave out?',
  'What does {A} notice about {B} that {B} would not want noticed?',
  'What is the smallest kindness in this, and who offers it?',
  'Who is more afraid of this going on too long, and who is more afraid of it ending?',
  'What does each of them want the other to say?',
  'What would be different if there were a witness?',
  'Which of them is lying by omission, and about what?',
  'What would {A} be tempted to do here that they would regret?',
  'What does {B} do with their hands when they are uncomfortable?',
  'What would each remember about this in ten years, and would it be the same thing?',
];

// questions that only make sense for some kinds of pair
const QUESTIONS_BY_MODE: Record<Exclude<RouletteMode, 'any'>, string[]> = {
  romantic: [
    'What does {A} almost say, and what stops them?',
    'Who touches first, and was it an accident?',
    'What would {B} give a lot to know {A} is thinking?',
    'What would each pretend not to notice?',
  ],
  hostile: [
    'What would it cost {A} to admit {B} is right about something?',
    'What does {B} respect about {A} and refuse to say?',
    'Who escalates, and who lets them?',
    'What would end this fastest, and why will neither do it?',
  ],
  history: [
    'What are they both careful not to mention?',
    'Which of them has changed more, and who has noticed?',
    'What would {A} ask {B} if they knew the answer would be true?',
    'What would have to be said for this to be over?',
  ],
  power: [
    'What does {A} do to avoid showing what they feel?',
    'Does {B} use the power they have, or pretend not to have it?',
    'What would {A} say if there were no consequences?',
    'What does {B} wish they could set down?',
  ],
  friendship: [
    'What joke does only this pair understand?',
    'What would make one of them walk away, and does the other know it?',
    'What does {A} like about {B} that they have never said?',
    'Who tells the other when they are wrong?',
  ],
  family: [
    'Which old role does each of them slip into without noticing?',
    'What does {A} do that sounds exactly like someone else in the family?',
    'What is the argument underneath the argument?',
    'Who is still trying to be forgiven, and for what?',
  ],
  strangers: [
    'What does {A} decide about {B} in the first minute, and how wrong are they?',
    'What would {B} never tell a stranger, and what do they tell this one?',
    'What would they be like if they never saw each other again?',
    'Who asks the first real question?',
  ],
};

// extra questions when the writer has tagged how the pair is connected on the characters' cards (see services/relationships)
const QUESTIONS_BY_TAG: Record<string, string[]> = {
  mentor: ['What did {A} teach {B} that {B} would rather not have learned?', 'Where does {B} stop following {A}\'s lead?'],
  mentee: ['What has {B} learned from {A} that {B} has started to use against them?'],
  rival: ['What would losing to {B} mean to {A}, beyond the losing?', 'What does {A} copy from {B}?'],
  enemy: ['What would {A} never do to {B}, even now?', 'Is there one thing {B} would still do for {A}?'],
  ex: ['What does each of them still know about the other that nobody else does?', 'What would {A} change about how it ended?'],
  romantic: ['What is the thing {A} does for {B} that {B} has never noticed?'],
  familial: ['Which of them is the family\'s keeper of secrets?', 'What would a parent or elder say about this, and who would they side with?'],
  platonic: ['What would {A} do for {B} without being asked?'],
  colleague: ['What would the people they work with say about this?'],
  business: ['What would each of them be willing to lose to keep this going?'],
  neighbor: ['What do they know about each other just from living this close?'],
  classmate: ['What did the two of them used to be to each other, back then?'],
  peer: ['Who has quietly been keeping score?'],
  acquaintance: ['What do they know about each other, and how much of it is secondhand?'],
};

// which mode suits a pair, from the tags on their cards. nothing tagged means "any".
export function suggestMode(tags: string[]): RouletteMode {
  const has = (...t: string[]) => t.some(x => tags.includes(x));
  if (has('romantic')) return 'romantic';
  if (has('ex')) return 'history';
  if (has('enemy', 'rival')) return 'hostile';
  if (has('mentor', 'mentee')) return 'power';
  if (has('familial')) return 'family';
  if (has('platonic')) return 'friendship';
  if (has('acquaintance') || tags.length === 0) return 'any';
  return 'any';
}

export interface RouletteInput {
  a: string;
  b: string;
  mode?: RouletteMode;
  // tags from the pair's cards, if they are characters from a project
  tags?: string[];
}

export interface RouletteResult {
  a: string;
  b: string;
  mode: RouletteMode;
  situation: string;
  questions: string[];
  // the writer's answers, kept as they go, one per question
  answers: string[];
}

const names = (i: { a: string; b: string }) => ({ A: i.a.trim() || 'Character A', B: i.b.trim() || 'Character B' });

const situationPool = (mode: RouletteMode): string[] =>
  mode === 'any' ? [...SHARED, ...Object.values(BY_MODE).flat()] : [...SHARED, ...BY_MODE[mode], ...BY_MODE[mode]];

const questionPool = (mode: RouletteMode, tags: string[]): string[] => {
  const tagged = tags.flatMap(t => QUESTIONS_BY_TAG[t] ?? []);
  const forMode = mode === 'any' ? [] : QUESTIONS_BY_MODE[mode];
  // specific ones first so they are favored when picking
  return [...tagged, ...tagged, ...forMode, ...ANY_QUESTIONS];
};

export function rollSituation(input: RouletteInput, avoid: string[] = [], rng: Rng = Math.random): string {
  const mode = input.mode ?? 'any';
  const pool = situationPool(mode);
  const fresh = pool.filter(s => !avoid.includes(fill(s, names(input))));
  return fill(pick(fresh.length ? fresh : pool, rng), names(input));
}

export function rollQuestions(input: RouletteInput, count = 5, rng: Rng = Math.random): string[] {
  const mode = input.mode ?? 'any';
  const pool = [...new Set(questionPool(mode, input.tags ?? []))];
  // weighted toward the specific ones: draw from the specific head of the pool first, then the rest
  const specific = pool.slice(0, pool.length - ANY_QUESTIONS.length);
  const general = pool.slice(pool.length - ANY_QUESTIONS.length);
  const chosen = [...pickDistinct(specific, Math.min(specific.length, Math.ceil(count / 2)), rng)];
  chosen.push(...pickDistinct(general.filter(q => !chosen.includes(q)), count - chosen.length, rng));
  return pickDistinct(chosen, chosen.length, rng).map(q => fill(q, names(input)));
}

export function rollRoulette(input: RouletteInput, rng: Rng = Math.random): RouletteResult {
  const mode = input.mode ?? 'any';
  const questions = rollQuestions(input, 5, rng);
  return { a: input.a, b: input.b, mode, situation: rollSituation(input, [], rng), questions, answers: questions.map(() => '') };
}

// one question swapped for another the pair has not been asked
export function rerollQuestion(result: RouletteResult, index: number, tags: string[] = [], rng: Rng = Math.random): RouletteResult {
  const input = { a: result.a, b: result.b, mode: result.mode, tags };
  const used = new Set(result.questions);
  const pool = [...new Set(questionPool(result.mode, tags))].map(q => fill(q, names(input))).filter(q => !used.has(q));
  if (!pool.length) return result;
  const questions = result.questions.map((q, i) => (i === index ? pick(pool, rng) : q));
  return { ...result, questions, answers: result.answers.map((a, i) => (i === index ? '' : a)) };
}

// the whole exchange as plain text, for copying or saving
export function rouletteText(r: RouletteResult): string {
  const lines = [`Relationship Roulette: ${r.a} and ${r.b}`, r.situation, ''];
  r.questions.forEach((q, i) => {
    lines.push(q);
    if (r.answers[i]?.trim()) lines.push(r.answers[i].trim());
    lines.push('');
  });
  return lines.join('\n').trim();
}
