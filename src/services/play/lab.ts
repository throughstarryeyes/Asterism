import type { LabAnswer } from './types';
import { uid } from './rng';

// the Character Lab: situations that make a character choose, then change the circumstances and see whether the choice holds.
// it never labels a character. every answer is kept so the writer can compare them, and what it says about them is only a tally of what was chosen.

// what a choice amounts to, the same across scenarios so different scenarios can be compared
export type Stance = 'face' | 'protect' | 'learn' | 'withdraw' | 'other';

export const STANCE_LABEL: Record<Stance, string> = {
  face: 'faces it openly',
  protect: 'protects someone',
  learn: 'tries to understand first',
  withdraw: 'pulls back quietly',
  other: 'does something unexpected',
};

// who or what a version of the scenario puts in the other seat
export type Context = 'loved' | 'hated' | 'stranger' | 'unknown' | 'costly' | 'repentant' | 'witnessed' | 'plain';

export const CONTEXT_LABEL: Record<Context, string> = {
  loved: 'someone they love is involved',
  hated: 'someone they dislike is involved',
  stranger: 'a stranger is involved',
  unknown: 'they can never learn why',
  costly: 'it would cost them something else',
  repentant: 'the other person is truly sorry',
  witnessed: 'other people are watching',
  plain: 'the situation as first posed',
};

export interface Choice { id: string; label: string; stance: Stance }
export interface Twist { id: string; text: string; context: Context }

export interface Scenario {
  id: string;
  title: string;
  setup: string;
  baseContext: Context;
  choices: Choice[];
  twists: Twist[];
}

export const OTHER_CHOICE: Choice = { id: 'other', label: 'Something else entirely', stance: 'other' };

export const SCENARIOS: Scenario[] = [
  {
    id: 'mercy', title: 'The Unexpected Mercy', baseContext: 'loved',
    setup: 'Your character discovers that someone has stolen from them. They know exactly who did it. But the thief is someone they love.',
    choices: [
      { id: 'confront', label: 'Confront them immediately.', stance: 'face' },
      { id: 'cover', label: 'Cover for them, even if it costs something.', stance: 'protect' },
      { id: 'ask', label: 'Find out why they did it first.', stance: 'learn' },
      { id: 'distance', label: 'Say nothing, but quietly distance themselves.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'hated', text: 'What if the person who stole from them was someone they hated?', context: 'hated' },
      { id: 'elsewhere', text: 'What if the thief had stolen from someone else, too?', context: 'witnessed' },
      { id: 'never', text: 'What if the character could never find out why it happened?', context: 'unknown' },
      { id: 'secret', text: 'What if confronting them would expose a different secret?', context: 'costly' },
      { id: 'return', text: 'What if the person offered to return everything, but asked for forgiveness?', context: 'repentant' },
      { id: 'stranger', text: 'What if it was a stranger, someone they will never see again?', context: 'stranger' },
    ],
  },
  {
    id: 'secret', title: 'The Kept Secret', baseContext: 'loved',
    setup: 'Your character learns something about their closest friend that would badly hurt a third person if that person knew. The friend has no idea they know.',
    choices: [
      { id: 'tell-friend', label: 'Tell their friend what they know, and ask what happens next.', stance: 'face' },
      { id: 'keep', label: 'Keep the secret to protect the friend.', stance: 'protect' },
      { id: 'watch', label: 'Wait and watch until they understand it better.', stance: 'learn' },
      { id: 'pull-away', label: 'Step back from both of them.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'stranger', text: 'What if the friend was only an acquaintance?', context: 'stranger' },
      { id: 'enemy', text: 'What if the third person was someone who had wronged them?', context: 'hated' },
      { id: 'cost', text: 'What if keeping it would cost them their own standing?', context: 'costly' },
      { id: 'watched', text: 'What if someone else has already noticed, and is watching what they do?', context: 'witnessed' },
      { id: 'sorry', text: 'What if the friend wants to confess, but cannot find the courage?', context: 'repentant' },
    ],
  },
  {
    id: 'debt', title: 'The Debt', baseContext: 'plain',
    setup: 'Someone who once saved your character\'s life asks for a favor. It is a small one, and it is not entirely honest.',
    choices: [
      { id: 'refuse', label: 'Say no, and say why.', stance: 'face' },
      { id: 'do-it', label: 'Do it, because they owe it.', stance: 'protect' },
      { id: 'ask-more', label: 'Ask what it is really for before they decide.', stance: 'learn' },
      { id: 'avoid', label: 'Find a reason not to be reachable.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'loved', text: 'What if the person asking was someone they love?', context: 'loved' },
      { id: 'hated', text: 'What if they cannot stand the person asking?', context: 'hated' },
      { id: 'cost', text: 'What if doing it would cost them a friend?', context: 'costly' },
      { id: 'unknown', text: 'What if they would never be told what it was for?', context: 'unknown' },
      { id: 'stranger', text: 'What if the person asking was almost a stranger?', context: 'stranger' },
    ],
  },
  {
    id: 'witness', title: 'The Witness', baseContext: 'plain',
    setup: 'Your character sees someone do something wrong. It is small, no one else saw it, and no one would ever find out.',
    choices: [
      { id: 'speak', label: 'Say something to them directly.', stance: 'face' },
      { id: 'shield', label: 'Say nothing, and make sure it does not hurt anyone.', stance: 'protect' },
      { id: 'understand', label: 'Find out why they did it before deciding.', stance: 'learn' },
      { id: 'walk', label: 'Walk away and try not to think about it.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'loved', text: 'What if it was someone they loved?', context: 'loved' },
      { id: 'hated', text: 'What if it was someone they could not stand?', context: 'hated' },
      { id: 'seen', text: 'What if someone else was also watching?', context: 'witnessed' },
      { id: 'cost', text: 'What if speaking up would cost them their own place there?', context: 'costly' },
      { id: 'stranger', text: 'What if it was a stranger, passing through?', context: 'stranger' },
    ],
  },
  {
    id: 'offer', title: 'The Offer', baseContext: 'plain',
    setup: 'Your character is offered the thing they have wanted most for years. Someone else would lose something because of it, and the offer will not be made twice.',
    choices: [
      { id: 'take', label: 'Take it, openly, and accept what follows.', stance: 'face' },
      { id: 'refuse', label: 'Turn it down so the other person keeps what they have.', stance: 'protect' },
      { id: 'dig', label: 'Ask who loses, how much, and why, before answering.', stance: 'learn' },
      { id: 'stall', label: 'Let the deadline pass without deciding.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'loved', text: 'What if the one who would lose was someone they love?', context: 'loved' },
      { id: 'hated', text: 'What if the one who would lose was someone who had wronged them?', context: 'hated' },
      { id: 'stranger', text: 'What if the one who would lose was a stranger they will never meet?', context: 'stranger' },
      { id: 'seen', text: 'What if everyone they know would see what they chose?', context: 'witnessed' },
      { id: 'unknown', text: 'What if they could never find out who lost out?', context: 'unknown' },
    ],
  },
  {
    id: 'apology', title: 'The Late Apology', baseContext: 'repentant',
    setup: 'Someone who wronged your character years ago finally apologizes, and means it. It is far too late for it to repair anything.',
    choices: [
      { id: 'forgive', label: 'Say it is all right, and mean it.', stance: 'protect' },
      { id: 'say-it', label: 'Say plainly what it cost them.', stance: 'face' },
      { id: 'ask', label: 'Ask why they are saying it now.', stance: 'learn' },
      { id: 'nothing', label: 'Nod, say nothing, and leave.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'loved', text: 'What if the person who apologized was someone they used to love?', context: 'loved' },
      { id: 'hated', text: 'What if the apology is clearly self-serving?', context: 'hated' },
      { id: 'seen', text: 'What if the apology happens in front of other people?', context: 'witnessed' },
      { id: 'unknown', text: 'What if the person never says what they are apologizing for?', context: 'unknown' },
      { id: 'cost', text: 'What if accepting it would end a grudge that has held others together?', context: 'costly' },
    ],
  },
  {
    id: 'rule', title: 'The Rule', baseContext: 'plain',
    setup: 'Your character believes in a rule. Following it today will hurt someone who does not deserve it.',
    choices: [
      { id: 'follow', label: 'Follow it, and say clearly why.', stance: 'face' },
      { id: 'bend', label: 'Bend it quietly for this one person.', stance: 'protect' },
      { id: 'consider', label: 'Look for what the rule was really for.', stance: 'learn' },
      { id: 'step-aside', label: 'Hand the decision to someone else.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'loved', text: 'What if the person who would be hurt was someone they love?', context: 'loved' },
      { id: 'stranger', text: 'What if the person who would be hurt was a stranger?', context: 'stranger' },
      { id: 'hated', text: 'What if the person had wronged them in the past?', context: 'hated' },
      { id: 'seen', text: 'What if everyone is watching to see whether they keep to it?', context: 'witnessed' },
      { id: 'cost', text: 'What if bending it would cost them their own standing?', context: 'costly' },
    ],
  },
  {
    id: 'comfort', title: 'The Comforting Lie', baseContext: 'loved',
    setup: 'Someone your character loves is hurting. A lie would comfort them. The truth would take it away, and would also be kinder in the long run.',
    choices: [
      { id: 'truth', label: 'Tell them the truth, gently.', stance: 'face' },
      { id: 'lie', label: 'Tell the lie.', stance: 'protect' },
      { id: 'ask', label: 'Ask them what they want to be told.', stance: 'learn' },
      { id: 'quiet', label: 'Say very little and stay with them.', stance: 'withdraw' },
    ],
    twists: [
      { id: 'stranger', text: 'What if it was someone they hardly knew?', context: 'stranger' },
      { id: 'hated', text: 'What if it was someone they could not stand?', context: 'hated' },
      { id: 'cost', text: 'What if the lie would trap them into keeping it up for years?', context: 'costly' },
      { id: 'unknown', text: 'What if they would never learn what happened next?', context: 'unknown' },
      { id: 'seen', text: 'What if other people already know the truth?', context: 'witnessed' },
    ],
  },
];

export const scenarioById = (id: string) => SCENARIOS.find(s => s.id === id);
export const choiceById = (scenario: Scenario, id: string): Choice | undefined => (id === 'other' ? OTHER_CHOICE : scenario.choices.find(c => c.id === id));

export interface AnswerIn { scenarioId: string; twistId?: string; choiceId: string; other?: string; why: string; characterId?: string; characterName: string }

export function makeAnswer(a: AnswerIn, now = new Date()): LabAnswer {
  return {
    id: uid('lab'),
    characterId: a.characterId,
    characterName: a.characterName.trim() || 'Unnamed',
    scenarioId: a.scenarioId,
    ...(a.twistId ? { twistId: a.twistId } : {}),
    choiceId: a.choiceId,
    ...(a.other?.trim() ? { other: a.other.trim() } : {}),
    why: a.why.trim(),
    at: now.toISOString(),
  };
}

// one character's answers. a character from a project is matched by id, a loose one by name
export const answersFor = (all: readonly LabAnswer[] | undefined, who: { id?: string; name: string }): LabAnswer[] =>
  (all ?? []).filter(a => (who.id && a.characterId ? a.characterId === who.id : a.characterName.trim().toLowerCase() === who.name.trim().toLowerCase()));

// the twists of a scenario this character has not been asked yet
export const unseenTwists = (scenario: Scenario, answers: readonly LabAnswer[]): Twist[] =>
  scenario.twists.filter(t => !answers.some(a => a.scenarioId === scenario.id && a.twistId === t.id));

export const hasBase = (scenario: Scenario, answers: readonly LabAnswer[]) => answers.some(a => a.scenarioId === scenario.id && !a.twistId);

// the context and stance of one answer
export function readAnswer(a: LabAnswer): { scenario: Scenario; context: Context; stance: Stance; choiceLabel: string; question: string } | undefined {
  const scenario = scenarioById(a.scenarioId);
  if (!scenario) return undefined;
  const twist = a.twistId ? scenario.twists.find(t => t.id === a.twistId) : undefined;
  const choice = choiceById(scenario, a.choiceId);
  if (!choice) return undefined;
  return {
    scenario,
    context: twist ? twist.context : scenario.baseContext,
    stance: choice.stance,
    choiceLabel: choice.id === 'other' && a.other ? a.other : choice.label,
    question: twist ? twist.text : scenario.setup,
  };
}

export interface Comparison {
  scenarioId: string;
  title: string;
  base?: { choiceLabel: string; why: string };
  // each changed circumstance, and whether the choice held
  twists: Array<{ question: string; choiceLabel: string; why: string; held: boolean; context: Context }>;
}

// every scenario this character has answered, with the first answer beside what they chose when things changed
export function compare(answers: readonly LabAnswer[]): Comparison[] {
  const out: Comparison[] = [];
  SCENARIOS.forEach(s => {
    const mine = answers.filter(a => a.scenarioId === s.id);
    if (!mine.length) return;
    const base = mine.find(a => !a.twistId);
    const baseRead = base && readAnswer(base);
    out.push({
      scenarioId: s.id,
      title: s.title,
      base: base && baseRead ? { choiceLabel: baseRead.choiceLabel, why: base.why } : undefined,
      twists: mine.filter(a => a.twistId).flatMap(a => {
        const r = readAnswer(a);
        if (!r) return [];
        return [{ question: r.question, choiceLabel: r.choiceLabel, why: a.why, context: r.context, held: !!baseRead && baseRead.stance === r.stance }];
      }),
    });
  });
  return out;
}

export interface Pattern { text: string }

// what the answers so far suggest, as plain sentences. it only reports what was chosen, never what the character "is",
// and says nothing until there are at least two answers behind a claim.
export function patterns(answers: readonly LabAnswer[], name = 'This character'): Pattern[] {
  const reads = answers.map(readAnswer).filter((r): r is NonNullable<ReturnType<typeof readAnswer>> => !!r);
  const out: Pattern[] = [];
  if (reads.length < 2) return out;

  const byContext = new Map<Context, Map<Stance, number>>();
  reads.forEach(r => {
    const m = byContext.get(r.context) ?? new Map<Stance, number>();
    m.set(r.stance, (m.get(r.stance) ?? 0) + 1);
    byContext.set(r.context, m);
  });
  const top = (m: Map<Stance, number>): { stance: Stance; share: number; n: number } => {
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const n = entries.reduce((t, [, c]) => t + c, 0);
    return { stance: entries[0][0], share: entries[0][1] / n, n };
  };

  const lean = (c: Context) => {
    const m = byContext.get(c);
    if (!m) return undefined;
    const t = top(m);
    return t.n >= 2 && t.share > 0.5 ? t : undefined;
  };

  const toward = (...cs: Context[]) => {
    const merged = new Map<Stance, number>();
    cs.forEach(c => byContext.get(c)?.forEach((n, s) => merged.set(s, (merged.get(s) ?? 0) + n)));
    if (!merged.size) return undefined;
    const t = top(merged);
    return t.n >= 2 && t.share > 0.5 ? t : undefined;
  };

  const close = toward('loved');
  const far = toward('hated', 'stranger');
  if (close && far && close.stance !== far.stance) {
    out.push({ text: `So far ${name} ${STANCE_LABEL[close.stance]} when someone they love is involved, but ${STANCE_LABEL[far.stance]} when it is someone they dislike or do not know.` });
  } else if (close && far) {
    out.push({ text: `So far ${name} ${STANCE_LABEL[close.stance]} whether or not the other person matters to them.` });
  } else if (close) {
    out.push({ text: `When someone they love is involved, ${name} usually ${STANCE_LABEL[close.stance]}.` });
  } else if (far) {
    out.push({ text: `With people they dislike or do not know, ${name} usually ${STANCE_LABEL[far.stance]}.` });
  }

  (['costly', 'witnessed', 'unknown', 'repentant'] as Context[]).forEach(c => {
    const t = lean(c);
    if (t) out.push({ text: `When ${CONTEXT_LABEL[c]}, ${name} usually ${STANCE_LABEL[t.stance]}.` });
  });

  const comps = compare(answers);
  let held = 0;
  let changed = 0;
  comps.forEach(c => c.twists.forEach(t => (t.held ? held++ : changed++)));
  if (held + changed >= 3) {
    if (changed === 0) out.push({ text: `${name} has not changed course once when the circumstances shifted.` });
    else if (held === 0) out.push({ text: `${name} has changed course every time the circumstances shifted.` });
    else out.push({ text: `${name} held to their first choice in ${held} of ${held + changed} changed situations.` });
  }

  const all = new Map<Stance, number>();
  reads.forEach(r => all.set(r.stance, (all.get(r.stance) ?? 0) + 1));
  const overall = top(all);
  if (overall.n >= 4 && overall.share >= 0.6) out.push({ text: `Overall, ${name} most often ${STANCE_LABEL[overall.stance]}.` });

  return out;
}

// a note for the character's page in the story bible
export function labNote(answers: readonly LabAnswer[], name: string): string {
  const lines = [`Character Lab: ${name}`];
  compare(answers).forEach(c => {
    lines.push('', c.title);
    if (c.base) lines.push(`  First: ${c.base.choiceLabel}${c.base.why ? ` (${c.base.why})` : ''}`);
    c.twists.forEach(t => lines.push(`  ${t.question} ${t.choiceLabel}${t.why ? ` (${t.why})` : ''}${t.held ? '' : ' [changed]'}`));
  });
  const p = patterns(answers, name);
  if (p.length) lines.push('', 'Patterns so far:', ...p.map(x => `- ${x.text}`));
  return lines.join('\n');
}

// adds an answer, replacing this character's earlier answer to the same question so changing your mind does not leave two
export function upsertAnswer(all: readonly LabAnswer[] | undefined, next: LabAnswer): LabAnswer[] {
  const same = (a: LabAnswer) => a.scenarioId === next.scenarioId && (a.twistId ?? '') === (next.twistId ?? '')
    && (next.characterId && a.characterId ? a.characterId === next.characterId : a.characterName.trim().toLowerCase() === next.characterName.trim().toLowerCase());
  return [...(all ?? []).filter(a => !same(a)), next];
}

export const CHOICE_NOTE = 'An illustration of how a character might think, not a diagnosis and not a personality type.';
