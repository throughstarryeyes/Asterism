import { splitSentences, type CoachUnit, type Entity, type EntityIndex } from './entities';
import { contentWords, kindsInSentence } from './signals';
import { anyPhrase, feelingLabel, feelingWarmth, getDefaultKnowledge, phraseRegex, type CoachKnowledge } from './knowledge';
import type { CoachMemory, Signal, SignalKind } from './types';
import type { CoachFeatureKey } from './settings';
import { AUTOPSY_PACKETS, generateSpark, pickTrope, randomSceneStarter, type Rng, type Spark } from '../muse/generators';
import { detectOpenLoops, shortHash as hash } from '../openLoops';
import type { StoryLexiconConfig } from '../../types';

// one suggestion shown to the writer. every feature below produces these (or a
// richer structure) from the manuscript; none of them write prose.
export interface Nudge {
  id: string;
  feature: CoachFeatureKey;
  title: string;
  body: string;
  evidence: Array<{ sentence: string; unitTitle: string; chapterId?: string }>;
  // a foundations card that helps the writer explore this.
  cardId?: string;
  // for why-chains: which chain this question belongs to.
  chain?: { entityId: string; kind: string };
}


const entityNames = (index: EntityIndex) => index.entities.flatMap(e => [e.canonical, ...e.aliases]);
const notDismissed = (memory: CoachMemory | undefined) => (n: Nudge) => !memory?.story.dismissed.includes(n.id);
const sentencesOf = (units: CoachUnit[]) =>
  units.flatMap(u => splitSentences(u.plainText).map(sentence => ({ unit: u, sentence })));

// ---- ask-later -------------------------------------------------------------

export interface OpenQuestion {
  id: string;
  chapterId: string;
  sentence: string;
  unitIndex: number;
  unitTitle: string;
  words: string[];
}

const MIN_QUESTION_WORDS = 4;

// questions the narration itself raises ("Who leaves the flowers?"). spoken
// questions are left alone: characters ask each other things all the time.
export function findOpenQuestions(units: CoachUnit[], index: EntityIndex): OpenQuestion[] {
  const names = entityNames(index);
  const found: OpenQuestion[] = [];
  sentencesOf(units).forEach(({ unit, sentence }) => {
    if (!sentence.trim().endsWith('?') || /["“”]/.test(sentence)) return;
    if (sentence.split(/\s+/).length < MIN_QUESTION_WORDS) return;
    const words = contentWords(sentence, names);
    if (words.length < 2) return;
    found.push({ id: `q-${unit.index}-${hash(sentence)}`, chapterId: unit.chapterId, sentence, unitIndex: unit.index, unitTitle: unit.title, words });
  });
  return found;
}

// "You asked this in chapter 3. this scene mentions the same things."
export function resurfaceQuestions(
  questions: OpenQuestion[],
  units: CoachUnit[],
  index: EntityIndex,
  focusUnit: number,
  memory?: CoachMemory
): Nudge[] {
  const focus = units.find(u => u.index === focusUnit);
  if (!focus) return [];
  const focusWords = new Set(contentWords(focus.plainText, entityNames(index)));
  return questions
    .filter(q => q.unitIndex < focusUnit)
    .map(q => ({ q, shared: q.words.filter(w => focusWords.has(w)) }))
    .filter(x => x.shared.length >= 2)
    .map<Nudge>(({ q, shared }) => ({
      id: `ask-${q.id}`,
      feature: 'askLater',
      title: 'You asked this earlier',
      body: `In ${q.unitTitle} you wrote this question. ${focus.title} touches on ${shared.slice(0, 3).join(', ')}. Does this scene move it forward, or is it still waiting?`,
      evidence: [{ sentence: q.sentence, unitTitle: q.unitTitle, chapterId: q.chapterId }],
    }))
    .filter(notDismissed(memory))
    .slice(0, 3);
}

// ---- echo prompts ----------------------------------------------------------

export function echoPrompts(units: CoachUnit[], index: EntityIndex, memory?: CoachMemory): Nudge[] {
  const counts = new Map<string, { text: string; count: number; where: Array<{ sentence: string; unitTitle: string; chapterId?: string }> }>();
  sentencesOf(units).forEach(({ unit, sentence }) => {
    for (const m of sentence.matchAll(/["“]([^"”]{3,60})["”]/g)) {
      const text = m[1].trim();
      if (text.split(/\s+/).length > 8) continue;
      const key = text.toLowerCase().replace(/[.,!?…\s]+$/g, '');
      const entry = counts.get(key) ?? { text, count: 0, where: [] };
      entry.count += 1;
      entry.where.push({ sentence, unitTitle: unit.title, chapterId: unit.chapterId });
      counts.set(key, entry);
    }
  });
  const mask = AUTOPSY_PACKETS.findIndex(p => p.title === 'Masks & Performances');
  return [...counts.entries()]
    .filter(([, e]) => e.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map<Nudge>(([key, e]) => {
      const speaker = index.entities.find(ent => e.where.some(w => ent.mentions.some(m => m.sentence === w.sentence)));
      return {
        id: `echo-${hash(key)}`,
        feature: 'echoPrompts',
        title: `“${e.text}”`,
        body: `You wrote this ${e.count} times${speaker ? `, around ${speaker.canonical}` : ''}. What is it protecting?`,
        evidence: e.where.slice(0, 3),
        cardId: mask >= 0 ? `autopsy-${mask + 1}` : undefined,
      };
    })
    .filter(notDismissed(memory));
}

// ---- why-chains ------------------------------------------------------------

export function whyChainNudges(memory: CoachMemory, index: EntityIndex, knowledge: CoachKnowledge = getDefaultKnowledge()): Nudge[] {
  const out: Nudge[] = [];
  memory.story.chains.forEach(chain => {
    const packetIndex = AUTOPSY_PACKETS.findIndex(p => p.title === knowledge.feelings[chain.kind]?.packet);
    const packet = AUTOPSY_PACKETS[packetIndex];
    const question = packet?.questions[chain.depth];
    const entity = index.entities.find(e => e.id === chain.entityId);
    if (!packet || !question || !entity) return;
    out.push({
      id: `why-${chain.entityId}-${chain.kind}-${chain.depth}`,
      feature: 'whyChains',
      title: `About ${entity.canonical}`,
      body: question,
      evidence: [],
      cardId: `autopsy-${packetIndex + 1}`,
      chain: { entityId: chain.entityId, kind: chain.kind },
    });
  });
  return out;
}

// the writer answered (or skipped past) the current question; go one deeper.
export function advanceChain(memory: CoachMemory, entityId: string, kind: SignalKind): CoachMemory {
  return {
    ...memory,
    story: {
      ...memory.story,
      chains: memory.story.chains.map(c => (c.entityId === entityId && c.kind === kind ? { ...c, depth: c.depth + 1 } : c)),
    },
  };
}

// ---- unseen scenes ---------------------------------------------------------

// big events that are mentioned once, in summary, and never get a scene.
export function unseenScenes(units: CoachUnit[], memory?: CoachMemory, knowledge: CoachKnowledge = getDefaultKnowledge()): Nudge[] {
  const all = sentencesOf(units);
  const out: Nudge[] = [];
  const toldNotShown = anyPhrase(knowledge.toldNotShown);
  knowledge.events.forEach(word => {
    const re = phraseRegex(word);
    const hits = all.filter(s => re.test(s.sentence));
    if (hits.length !== 1) return;
    const { unit, sentence } = hits[0];
    if (toldNotShown && !toldNotShown.test(sentence)) return;
    out.push({
      id: `unseen-${word}`,
      feature: 'unseenScenes',
      title: `The ${word} is told, not shown`,
      body: `It comes up once, in passing, and never gets a scene. Do you want to write it, or is it better left offstage?`,
      evidence: [{ sentence, unitTitle: unit.title, chapterId: unit.chapterId }],
    });
  });
  return out.filter(notDismissed(memory)).slice(0, 4);
}

// ---- relationship weather --------------------------------------------------

export interface PairWeather {
  a: Entity;
  b: Entity;
  units: Array<{ unitIndex: number; unitTitle: string; score: number }>;
  flat: boolean;
}

export function relationshipWeather(units: CoachUnit[], index: EntityIndex, knowledge: CoachKnowledge = getDefaultKnowledge()): PairWeather[] {
  const people = index.entities.filter(e => e.mentions.length >= 2);
  const sentencesBy = new Map<string, Set<string>>();
  people.forEach(e => sentencesBy.set(e.id, new Set(e.mentions.map(m => `${m.unitIndex}|${m.sentence}`))));
  const result: PairWeather[] = [];

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i], b = people[j];
      const shared = [...sentencesBy.get(a.id)!].filter(k => sentencesBy.get(b.id)!.has(k));
      if (shared.length < 2) continue;
      const byUnit = new Map<number, number>();
      shared.forEach(key => {
        const [u, ...rest] = key.split('|');
        const unitIndex = Number(u);
        const score = kindsInSentence(rest.join('|'), knowledge).reduce((sum, k) => sum + feelingWarmth(knowledge, k), 0);
        byUnit.set(unitIndex, (byUnit.get(unitIndex) ?? 0) + score);
      });
      if (byUnit.size < 3) continue;
      const rows = [...byUnit.entries()]
        .sort((x, y) => x[0] - y[0])
        .map(([unitIndex, score]) => ({ unitIndex, unitTitle: units.find(u => u.index === unitIndex)?.title ?? `Section ${unitIndex + 1}`, score }));
      const scores = rows.map(r => r.score);
      const flat = rows.length >= 4 && Math.max(...scores) - Math.min(...scores) <= 1 && (scores.every(s => s >= 0) || scores.every(s => s <= 0));
      result.push({ a, b, units: rows, flat });
    }
  }
  return result.sort((x, y) => y.units.length - x.units.length);
}

export function weatherNudges(weather: PairWeather[], memory?: CoachMemory): Nudge[] {
  const fault = 'faultline-1';
  return weather
    .filter(w => w.flat)
    .map<Nudge>(w => ({
      id: `weather-${w.a.id}-${w.b.id}`,
      feature: 'relationshipWeather',
      title: `${w.a.canonical} and ${w.b.canonical}`,
      body: `They share ${w.units.length} sections and feel about the same in all of them. What would shift it?`,
      evidence: [],
      cardId: fault,
    }))
    .filter(notDismissed(memory));
}

// ---- acting-strange --------------------------------------------------------

// a feeling a character has never shown before, after we have seen them enough
// to know what "usual" looks like for them.
export function actingStrange(signals: Signal[], index: EntityIndex, memory?: CoachMemory, knowledge: CoachKnowledge = getDefaultKnowledge()): Nudge[] {
  const out: Nudge[] = [];
  index.entities.forEach(entity => {
    const mine = signals.filter(s => s.entityId === entity.id).sort((a, b) => a.unitIndex - b.unitIndex);
    const unitsWithSignals = [...new Set(mine.map(s => s.unitIndex))];
    const seen = new Set<SignalKind>();
    mine.forEach(s => {
      const priorUnits = unitsWithSignals.filter(u => u < s.unitIndex);
      if (!seen.has(s.kind) && priorUnits.length >= 3 && !mine.some(m => m.kind === s.kind && m.unitIndex < s.unitIndex)) {
        out.push({
          id: `strange-${entity.id}-${s.kind}`,
          feature: 'actingStrange',
          title: `${entity.canonical} is different here`,
          body: `This is the first time ${entity.canonical} shows ${feelingLabel(knowledge, s.kind).toLowerCase()} in ${s.unitTitle}. Is that a turning point, a clue, or a slip?`,
          evidence: [{ sentence: s.sentence, unitTitle: s.unitTitle, chapterId: s.chapterId }],
        });
      }
      seen.add(s.kind);
    });
  });
  return out.filter(notDismissed(memory)).slice(0, 4);
}

// ---- promise board ---------------------------------------------------------

export type BoardKind = 'promise' | 'secret' | 'warning' | 'question';

export interface BoardItem {
  id: string;
  chapterId: string;
  kind: BoardKind;
  sentence: string;
  unitIndex: number;
  unitTitle: string;
  // sections since it was raised.
  age: number;
  // later sections that share its key words.
  revisits: number;
}

// the board lists what the story set going and how many later scenes pick each thing up
// loops come from the same detector as the analyzer, so the two agree
export function promiseBoard(
  units: CoachUnit[],
  index: EntityIndex,
  memory?: CoachMemory,
  knowledge: CoachKnowledge = getDefaultKnowledge(),
  lexicon?: StoryLexiconConfig
): BoardItem[] {
  return detectOpenLoops(units, index, { knowledge, lexicon })
    .filter(loop => loop.kind !== 'object' && !memory?.story.dismissed.includes(loop.id))
    .map<BoardItem>(loop => ({
      id: loop.id,
      chapterId: loop.chapterId,
      kind: loop.kind as BoardKind,
      sentence: loop.sentence,
      unitIndex: loop.unitIndex,
      unitTitle: loop.unitTitle,
      age: loop.age,
      revisits: loop.followUpUnits.length,
    }))
    .sort((a, b) => a.revisits - b.revisits || b.age - a.age);
}

// ---- next-scene menu -------------------------------------------------------

export interface SceneIdea {
  id: string;
  text: string;
  reason: string;
}

// ideas drawn from the writer's own open threads, with a Muse starter as a fallback.
export function nextSceneIdeas(
  board: BoardItem[],
  gaps: Array<{ entity: Entity; kind: string }>,
  unseen: Nudge[],
  rng: Rng = Math.random
): SceneIdea[] {
  const ideas: SceneIdea[] = [];
  const open = board.find(b => b.revisits === 0 && b.age >= 1);
  if (open) {
    const verb = open.kind === 'question' ? 'Answer, or deepen, the question' : open.kind === 'promise' ? 'Write the scene where this promise comes due' : open.kind === 'secret' ? 'Write the moment this secret is tested' : 'Write what happens when this warning is ignored';
    ideas.push({ id: `idea-board-${open.id}`, text: `${verb}: “${open.sentence}”`, reason: `Open since ${open.unitTitle}` });
  }
  if (gaps[0]) {
    ideas.push({ id: `idea-gap-${gaps[0].entity.id}`, text: `Bring ${gaps[0].entity.canonical} back, even briefly.`, reason: 'Hasn’t appeared in a while' });
  }
  if (unseen[0]) {
    ideas.push({ id: `idea-${unseen[0].id}`, text: `Show it on the page: ${unseen[0].title.toLowerCase()}.`, reason: 'Told, never shown' });
  }
  if (ideas.length < 3) {
    const starter = randomSceneStarter(undefined, rng);
    if (starter) ideas.push({ id: `idea-muse-${hash(starter.text)}`, text: starter.text, reason: `Scene starter (${starter.goal})` });
  }
  return ideas.slice(0, 3);
}

// ---- your tells ------------------------------------------------------------

export interface Tells {
  phrases: Array<{ phrase: string; count: number }>;
  starters: Array<{ word: string; count: number }>;
  stats: { sentences: number; avgSentenceWords: number; dialogueShare: number; oneLineParagraphShare: number };
}

const FUNCTION_WORDS = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'on', 'at', 'was', 'were', 'it', 'she', 'he', 'they', 'her', 'his', 'that', 'with', 'for', 'as', 'had', 'but', 'i', 'you', 'is', 'be']);

// measurements only: what the writer reaches for, not whether it is good.
export function yourTells(units: CoachUnit[], index: EntityIndex): Tells {
  const names = new Set(entityNames(index).flatMap(n => n.toLowerCase().split(/\s+/)));
  const text = units.map(u => u.plainText).join('\n');
  const tokens = text.toLowerCase().replace(/["“”]/g, ' ').split(/[^a-z']+/).filter(Boolean);

  const grams = new Map<string, number>();
  for (let i = 0; i + 2 < tokens.length; i++) {
    const g = tokens.slice(i, i + 3);
    if (g.every(t => FUNCTION_WORDS.has(t)) || g.some(t => names.has(t))) continue;
    const key = g.join(' ');
    grams.set(key, (grams.get(key) ?? 0) + 1);
  }
  const phrases = [...grams.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([phrase, count]) => ({ phrase, count }));

  const sentences = sentencesOf(units).map(s => s.sentence);
  const starterCounts = new Map<string, number>();
  sentences.forEach(s => {
    const w = s.replace(/^["“'‘]+/, '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
    if (w) starterCounts.set(w, (starterCounts.get(w) ?? 0) + 1);
  });
  const starters = [...starterCounts.entries()].filter(([, c]) => c >= 5).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word, count]) => ({ word, count }));

  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const quoted = (text.match(/["“][^"”]*["”]/g) || []).join('').length;
  const words = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
  return {
    phrases,
    starters,
    stats: {
      sentences: sentences.length,
      avgSentenceWords: sentences.length ? Math.round((words / sentences.length) * 10) / 10 : 0,
      dialogueShare: text.length ? Math.round((quoted / text.length) * 100) / 100 : 0,
      oneLineParagraphShare: paragraphs.length ? Math.round((paragraphs.filter(p => splitSentences(p).length === 1).length / paragraphs.length) * 100) / 100 : 0,
    },
  };
}

// ---- sparks with your cast -------------------------------------------------

export interface CastSpark {
  cast: string[];
  spark: Spark;
  trope?: string;
}

export function castSpark(index: EntityIndex, rng: Rng = Math.random): CastSpark {
  const cast = [...index.entities]
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.mentions.length - a.mentions.length)
    .slice(0, 6);
  const picks: string[] = [];
  const pool = [...cast];
  while (picks.length < 2 && pool.length) picks.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].canonical);
  return { cast: picks, spark: generateSpark(rng), trope: pickTrope({}, rng)?.text };
}
