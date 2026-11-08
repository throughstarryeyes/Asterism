import * as Y from 'yjs';
import { PROMPTS } from '../muse/generators';
import { pick, pickDistinct, shuffle, uid, type Rng } from './rng';

// multiplayer games ride the live writing session. a room is one game inside it, kept in the session's shared document next to the
// chapters and comments, so it uses the same encrypted connection and needs no server of its own.
//
// a room is written once by whoever starts it and then changed only by its host. everything players add (a joining, a turn, a letter, a guess)
// is a separate entry with its own key, so two people writing at the same moment can never overwrite each other.
//
// secrets (a hidden instruction, a mystery's answer) are kept out of sight by the screen, not by encryption: the shared document carries
// them to every co-writer's device. that is fine between people who chose to play together, and the games say so.

export type RoomMode = 'same_prompt' | 'different_prompts' | 'pass_story' | 'correspondence' | 'secret_ingredient' | 'two_perspectives' | 'mystery_reveal' | 'mystery_build';

export interface ModeInfo { id: RoomMode; label: string; blurb: string; min: number; hidden: boolean }

export const MODES: ModeInfo[] = [
  { id: 'same_prompt', label: 'Same prompt', blurb: 'Everyone gets the same prompt and writes alone. Nothing is shown until all of you are done.', min: 2, hidden: true },
  { id: 'different_prompts', label: 'Different prompts, same story', blurb: 'Each writer gets a different constraint. Everything has to fit into one story.', min: 2, hidden: false },
  { id: 'pass_story', label: 'Pass the story', blurb: 'One writer opens. The next continues without knowing where it was going. Take turns.', min: 2, hidden: false },
  { id: 'correspondence', label: 'Character correspondence', blurb: 'Each writer is a character, writing letters to the other. It works whether or not you are online together.', min: 2, hidden: false },
  { id: 'secret_ingredient', label: 'The secret ingredient', blurb: 'Each writer gets a hidden instruction to work into the shared story without giving it away.', min: 2, hidden: true },
  { id: 'two_perspectives', label: 'One story, two perspectives', blurb: 'Everyone describes the same event as a different character. Compare what each noticed, misread or kept back.', min: 2, hidden: true },
  { id: 'mystery_reveal', label: 'Mystery: the reveal', blurb: 'One writer builds a case and knows the answer. The others investigate and accuse.', min: 2, hidden: true },
  { id: 'mystery_build', label: 'Mystery: build it together', blurb: 'Take turns adding suspects, clues and complications. Nobody knows who did it until you decide.', min: 2, hidden: false },
];

export const modeInfo = (m: RoomMode) => MODES.find(x => x.id === m)!;

export interface Assignment {
  // a private instruction, a constraint, a character, or a role, depending on the game
  prompt?: string;
  secret?: string;
  character?: string;
  role?: string;
}

export interface MysteryCase {
  title: string;
  incident: string;
  suspects: Array<{ name: string; role: string }>;
  evidence: Array<{ id: string; text: string; shown: boolean }>;
  // the answer, known to the one who made the case
  culprit: string;
  how: string;
}

export interface Room {
  id: string;
  mode: RoomMode;
  title: string;
  host: string;
  createdAt: string;
  // 'setup' while people join, 'playing' once the host deals, 'revealed' when hidden writing is shown, 'done' when it is finished
  status: 'setup' | 'playing' | 'revealed' | 'done';
  // the shared prompt, situation or opening
  prompt?: string;
  // a limit on the words in one turn, 0 for none
  wordLimit?: number;
  // who plays, in turn order, once the host has dealt
  order?: string[];
  assignments?: Record<string, Assignment>;
  mystery?: MysteryCase;
}

export type MoveKind = 'entry' | 'turn' | 'pass' | 'letter' | 'guess' | 'question' | 'answer' | 'deduction' | 'accuse' | 'fact';

export interface Move {
  id: string;
  room: string;
  kind: MoveKind;
  by: string;
  text: string;
  at: string;
  // its place in the room's order: one more than the highest when it was made, so two made in the same instant still sort the way they happened
  n: number;
  // a letter's character, a fact's kind
  as?: string;
  // the question an answer is for, or the clue a fact reveals
  re?: string;
}

// ---- reading and writing the shared document ----

export const roomsOf = (doc: Y.Doc) => doc.getMap<Room>('game:rooms');
const joinsOf = (doc: Y.Doc) => doc.getMap<{ room: string; name: string; at: string }>('game:joins');
const movesMap = (doc: Y.Doc) => doc.getMap<Move>('game:moves');

export const LOCAL_ORIGIN = 'asterism-local';

export const listRooms = (doc: Y.Doc): Room[] => [...roomsOf(doc).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const getRoom = (doc: Y.Doc, id: string): Room | undefined => roomsOf(doc).get(id);

export function createRoom(doc: Y.Doc, input: { mode: RoomMode; title: string; host: string; prompt?: string; wordLimit?: number; mystery?: MysteryCase }, now = new Date()): Room {
  const room: Room = {
    id: uid('room'), mode: input.mode, title: input.title.trim() || modeInfo(input.mode).label, host: input.host, createdAt: now.toISOString(), status: 'setup',
    ...(input.prompt ? { prompt: input.prompt } : {}), ...(input.wordLimit ? { wordLimit: input.wordLimit } : {}), ...(input.mystery ? { mystery: input.mystery } : {}),
  };
  doc.transact(() => {
    roomsOf(doc).set(room.id, room);
    joinsOf(doc).set(`${room.id}|${input.host}`, { room: room.id, name: input.host, at: room.createdAt });
  }, LOCAL_ORIGIN);
  return room;
}

// only the host's changes to a room are kept by the screens, which only offer them to the host
export function updateRoom(doc: Y.Doc, id: string, patch: Partial<Room>): void {
  const room = roomsOf(doc).get(id);
  if (room) roomsOf(doc).set(id, { ...room, ...patch });
}

export function joinRoom(doc: Y.Doc, roomId: string, name: string, now = new Date()): void {
  doc.transact(() => joinsOf(doc).set(`${roomId}|${name}`, { room: roomId, name, at: now.toISOString() }), LOCAL_ORIGIN);
}

export function leaveRoom(doc: Y.Doc, roomId: string, name: string): void {
  doc.transact(() => joinsOf(doc).delete(`${roomId}|${name}`), LOCAL_ORIGIN);
}

// who has joined, in the order they came
export const joined = (doc: Y.Doc, roomId: string): string[] =>
  [...joinsOf(doc).values()].filter(j => j.room === roomId).sort((a, b) => a.at.localeCompare(b.at) || a.name.localeCompare(b.name)).map(j => j.name);

export function addMove(doc: Y.Doc, input: Omit<Move, 'id' | 'at' | 'n'>, now = new Date()): Move {
  const n = 1 + Math.max(0, ...[...movesMap(doc).values()].filter(m => m.room === input.room).map(m => m.n ?? 0));
  const move: Move = { ...input, id: uid('mv'), at: now.toISOString(), n };
  doc.transact(() => movesMap(doc).set(move.id, move), LOCAL_ORIGIN);
  return move;
}

export const movesIn = (doc: Y.Doc, roomId: string): Move[] =>
  [...movesMap(doc).values()].filter(m => m.room === roomId).sort((a, b) => (a.n ?? 0) - (b.n ?? 0) || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

export function removeRoom(doc: Y.Doc, roomId: string): void {
  doc.transact(() => {
    roomsOf(doc).delete(roomId);
    [...joinsOf(doc).entries()].forEach(([k, v]) => { if (v.room === roomId) joinsOf(doc).delete(k); });
    [...movesMap(doc).entries()].forEach(([k, v]) => { if (v.room === roomId) movesMap(doc).delete(k); });
  }, LOCAL_ORIGIN);
}

// calls back whenever any room, joining or move changes
export function watchGames(doc: Y.Doc, cb: () => void): () => void {
  const maps = [roomsOf(doc), joinsOf(doc), movesMap(doc)];
  maps.forEach(m => m.observe(cb));
  return () => maps.forEach(m => m.unobserve(cb));
}

// ---- dealing a game ----

const CONSTRAINTS = [
  'Include a lie that is told for kindness.',
  'Someone must change their mind before the end.',
  'Include an object that matters more than it should.',
  'The weather has to affect what happens.',
  'A character says something they immediately regret.',
  'Include a smell that brings back a memory.',
  'Someone has to keep a promise that is hard to keep.',
  'A stranger appears and leaves again.',
  'A door, window or gate is important.',
  'Someone is mistaken for someone else.',
  'Include food, shared or refused.',
  'Include a sound nobody can explain.',
  'A character is trying very hard not to cry, and succeeds or does not.',
  'Something is returned.',
];

const SECRETS = [
  'Work in the word "lantern" without it being important.',
  'Have someone say exactly one thing in another language.',
  'Make a character tell a small lie that is never found out.',
  'Include a red object that nobody comments on.',
  'End one of your turns with a question.',
  'Have a character misplace something, and never find it.',
  'Include a number, and make it matter later.',
  'Have someone hum a tune.',
  'Make a character notice something about another character\'s hands.',
  'Include a reference to a childhood game.',
  'Slip in a smell that is out of place.',
  'Have a character hesitate before opening something.',
  'Mention a clock stopping or running slow.',
  'Include something that is overheard, and not meant to be.',
];

const CORRESPONDENCE: Array<{ scenario: string; a: string; b: string }> = [
  { scenario: 'They are writing across a long distance, and neither has said why they left.', a: 'the one who left', b: 'the one who stayed' },
  { scenario: 'One is a prisoner and the other is a clerk who handles the mail.', a: 'the prisoner', b: 'the clerk' },
  { scenario: 'They were close once. Each thinks the other started the silence.', a: 'the first to write again', b: 'the one who never answered' },
  { scenario: 'They are strangers who got each other\'s letters by mistake.', a: 'the one who answered the wrong letter', b: 'the one who received it' },
  { scenario: 'They are on opposite sides of a war that neither started.', a: 'a soldier', b: 'someone at home' },
  { scenario: 'One has an unwelcome secret that they are trying to find a way to tell.', a: 'the one with the secret', b: 'the one who suspects' },
  { scenario: 'An old teacher writes to a former student who has done something unexpected.', a: 'the teacher', b: 'the student' },
];

const PERSPECTIVES: Array<{ event: string; roles: string[] }> = [
  { event: 'A dinner at which something is said that cannot be taken back.', roles: ['the one who said it', 'the one who heard it', 'someone watching from across the table', 'the host'] },
  { event: 'A departure at a train station, with something left unsaid.', roles: ['the one leaving', 'the one staying', 'a stranger on the platform', 'the one who arrives late'] },
  { event: 'A confrontation in a doorway.', roles: ['the one at the door', 'the one inside', 'a neighbor who could hear', 'someone upstairs'] },
  { event: 'A gift is given, and it is not what anyone expected.', roles: ['the giver', 'the receiver', 'a bystander', 'someone who knew'] },
  { event: 'A small accident that is nobody\'s fault, and everyone\'s.', roles: ['the one it happened to', 'the one who caused it', 'a witness', 'the first to arrive'] },
];

// a different role for each person, repeating if there are more people than roles
const spread = <T,>(items: readonly T[], n: number, rng: Rng): T[] => {
  const out: T[] = [];
  while (out.length < n) out.push(...shuffle(items, rng));
  return out.slice(0, n);
};

// what the host's "start" does: puts the players in an order and gives each their part. the host plays too.
export function deal(room: Room, players: readonly string[], rng: Rng = Math.random): Partial<Room> {
  const order = shuffle(players, rng);
  // the host opens a story, whoever goes first
  const ordered = room.mode === 'pass_story' || room.mode === 'correspondence' ? [room.host, ...order.filter(p => p !== room.host)] : order;
  const assignments: Record<string, Assignment> = {};
  const n = ordered.length;
  switch (room.mode) {
    case 'same_prompt': {
      const prompt = room.prompt || pick(PROMPTS, rng);
      return { status: 'playing', order: ordered, prompt, assignments };
    }
    case 'different_prompts': {
      const picks = pickDistinct(CONSTRAINTS, n, rng);
      ordered.forEach((p, i) => { assignments[p] = { prompt: picks[i % picks.length] }; });
      return { status: 'playing', order: ordered, prompt: room.prompt || pick(PROMPTS, rng), assignments };
    }
    case 'secret_ingredient': {
      const picks = pickDistinct(SECRETS, n, rng);
      ordered.forEach((p, i) => { assignments[p] = { secret: picks[i % picks.length] }; });
      return { status: 'playing', order: ordered, prompt: room.prompt || pick(PROMPTS, rng), assignments };
    }
    case 'correspondence': {
      const c = pick(CORRESPONDENCE, rng);
      ordered.forEach((p, i) => { assignments[p] = { role: i === 0 ? c.a : c.b }; });
      return { status: 'playing', order: ordered, prompt: room.prompt || c.scenario, assignments };
    }
    case 'two_perspectives': {
      const p = pick(PERSPECTIVES, rng);
      const roles = pickDistinct(p.roles, Math.min(n, p.roles.length), rng);
      ordered.forEach((who, i) => { assignments[who] = { role: roles[i % roles.length] }; });
      return { status: 'playing', order: ordered, prompt: room.prompt || p.event, assignments };
    }
    case 'pass_story': return { status: 'playing', order: ordered, prompt: room.prompt || pick(PROMPTS, rng), assignments };
    case 'mystery_build': return { status: 'playing', order: ordered, prompt: room.prompt || 'Something has happened. Nobody knows what, or who.', assignments };
    case 'mystery_reveal': return { status: 'playing', order: ordered, assignments };
  }
}

// ---- whose turn it is ----

const KIND_FOR: Partial<Record<RoomMode, MoveKind[]>> = {
  pass_story: ['turn', 'pass'],
  correspondence: ['letter'],
  mystery_build: ['fact', 'pass'],
};

// in a turn-taking game, the next person after whoever wrote last. a pass counts as a turn.
export function whoseTurn(room: Room, moves: readonly Move[]): string | undefined {
  const order = room.order ?? [];
  if (!order.length || !KIND_FOR[room.mode]) return undefined;
  const kinds = KIND_FOR[room.mode]!;
  const played = moves.filter(m => kinds.includes(m.kind));
  const last = played.at(-1);
  if (!last) return order[0];
  const i = order.indexOf(last.by);
  return order[(i + 1) % order.length];
}

// in a game where each person writes once and everything is shown together: who has not finished
export function stillWriting(room: Room, moves: readonly Move[]): string[] {
  const done = new Set(latestEntries(moves).map(m => m.by));
  return (room.order ?? []).filter(p => !done.has(p));
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

// ---- turning a game into text ----

// the game as writing the person can keep: the prompt, then what everyone wrote, in the order it was written
export function roomTranscript(room: Room, moves: readonly Move[]): string {
  const lines: string[] = [room.title];
  if (room.prompt) lines.push(room.prompt);
  lines.push('');
  const body = moves.filter(m => m.kind !== 'pass');
  switch (room.mode) {
    case 'correspondence':
      body.filter(m => m.kind === 'letter').forEach(m => lines.push(`${m.as ? `${m.as} (${m.by})` : m.by}:`, m.text, ''));
      break;
    case 'same_prompt': case 'two_perspectives':
      latestEntries(body).forEach(m => lines.push(`${m.by}${room.assignments?.[m.by]?.role ? `, as ${room.assignments[m.by].role}` : ''}:`, m.text, ''));
      break;
    case 'pass_story': case 'different_prompts':
      body.filter(m => m.kind === 'turn').forEach(m => lines.push(m.text, ''));
      break;
    case 'secret_ingredient':
      body.filter(m => m.kind === 'turn').forEach(m => lines.push(m.text, ''));
      if (room.status === 'revealed' || room.status === 'done') {
        lines.push('The secret ingredients:');
        (room.order ?? []).forEach(p => lines.push(`- ${p}: ${room.assignments?.[p]?.secret ?? ''}`));
        body.filter(m => m.kind === 'guess').forEach(m => lines.push(`${m.by} guessed: ${m.text}`));
      }
      break;
    case 'mystery_build':
      body.filter(m => m.kind === 'fact').forEach(m => lines.push(`${m.as ? `${m.as}: ` : ''}${m.text}`));
      break;
    case 'mystery_reveal': {
      const my = room.mystery;
      if (my) lines.push(my.incident, '', 'Suspects:', ...my.suspects.map(s => `- ${s.name}, ${s.role}`), '');
      body.forEach(m => lines.push(`${m.by} (${m.kind}): ${m.text}`));
      if (my && (room.status === 'revealed' || room.status === 'done')) lines.push('', `It was ${my.culprit}. ${my.how}`);
      break;
    }
  }
  return lines.join('\n').trim();
}

// each person's latest entry, so changing one's mind before the reveal replaces the earlier version
export function latestEntries(moves: readonly Move[]): Move[] {
  const last = new Map<string, Move>();
  moves.filter(m => m.kind === 'entry').forEach(m => last.set(m.by, m));
  return [...last.values()];
}
