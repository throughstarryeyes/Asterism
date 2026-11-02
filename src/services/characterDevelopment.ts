import type { AnalysisFinding, CardReflection, CharacterProfile } from '../types';
import { splitSentences, type CoachUnit, type Entity, type EntityIndex } from './coach/entities';
import { feelingLabel, type CoachKnowledge } from './coach/knowledge';
import { contentWords } from './coach/signals';
import { expectsScenes, relationBetween, tagLabel } from './relationships';
import type { Signal } from './coach/types';

// where a character could grow, from their card and from what the manuscript shows
// every result is a question linked to a foundations card; none of it is a verdict

export interface DevelopmentSource {
  units: CoachUnit[];
  index: EntityIndex;
  characters: CharacterProfile[];
  reflections: CardReflection[];
  signals: Signal[];
  knowledge?: CoachKnowledge;
}

// the foundations cards these suggestions point to (ids from data/museFoundations)
export const CARD = {
  want: 'autopsy-1', // core wants
  flaw: 'autopsy-2', // wounds & lies
  conflict: 'autopsy-3', // fears & avoidance
  voice: 'autopsy-4', // masks & performances
  range: 'autopsy-7', // healing & becoming
} as const;
const FAULTLINES = 25;

// a quoted line with the character as its speaker: "...," Mara said
const SAID = 'said|asked|replied|whispered|shouted|answered|murmured|muttered|called|cried|snapped|added|says';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const speaks = (m: { sentence: string; surface: string }) =>
  /["“”]/.test(m.sentence) && new RegExp(`\\b${escapeRe(m.surface)}\\s+(?:${SAID})\\b|\\b(?:${SAID})\\s+${escapeRe(m.surface)}\\b`).test(m.sentence);

const MAJOR = new Set<CharacterProfile['role']>(['protagonist', 'antagonist', 'deuteragonist', 'mentor']);
const MAX_PER_CHARACTER = 3;
const MAX_TOTAL = 12;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// two words are the same when they share their first five letters ("truth", "truths")
const stemOf = (w: string) => (w.length > 5 ? w.slice(0, 5) : w);

// the first sentence in the character's scenes that carries enough of a card's words
export function appearsInScenes(text: string, units: CoachUnit[], present: Set<number>, names: string[]): boolean | null {
  const stems = contentWords(text, names).map(stemOf);
  if (stems.length < 2) return null; // too little to look for
  const need = Math.min(2, stems.length);
  return units.some(u => present.has(u.index) && splitSentences(u.plainText).some(s => {
    const found = new Set(contentWords(s).map(stemOf));
    return stems.filter(w => found.has(w)).length >= need;
  }));
}

interface Candidate { rank: number; subject: string; card: string; finding: AnalysisFinding }

export function characterDevelopmentFindings(src: DevelopmentSource): AnalysisFinding[] {
  const entityOf = new Map<string, Entity>();
  src.characters.forEach(c => {
    const names = [c.name, ...(c.aliases ?? [])].map(n => n.trim().toLowerCase()).filter(Boolean);
    const ent = src.index.entities.find(e => names.includes(e.canonical.toLowerCase()) || e.aliases.some(a => names.includes(a.toLowerCase())));
    if (ent) entityOf.set(c.id, ent);
  });

  const reflected = (characterId: string, cardId: string) => src.reflections.some(r => r.linkedCharacterId === characterId && r.cardId === cardId);
  const candidates: Candidate[] = [];
  const add = (rank: number, character: CharacterProfile, card: string, id: string, title: string, summary: string, evidence: AnalysisFinding['evidencePassages'] = []) => {
    if (reflected(character.id, card)) return; // they have already thought about it
    candidates.push({
      rank, subject: character.name, card,
      finding: { id: `finding-develop-${id}-${slug(character.name)}`, category: 'expansion', title: `Development: ${title}`, summary, evidencePassages: evidence, confidence: 'possible_exploration', linkedFoundationCardId: card, status: 'unreviewed', subject: character.name },
    });
  };

  src.characters.forEach(c => {
    const ent = entityOf.get(c.id);
    const name = c.name;
    const major = MAJOR.has(c.role);
    const unitsIn = new Set((ent?.mentions ?? []).map(m => m.unitIndex));
    const first = ent?.mentions[0];
    const firstSeen = first ? [{ chapterId: first.chapterId, chapterTitle: first.unitTitle, quote: truncate(first.sentence, 160) }] : [];
    const names = [c.name, ...(c.aliases ?? [])];
    const has = (s?: string) => !!s && s.trim().length > 2;

    // the card is missing what makes a character want anything
    if (major) {
      const missing = [!has(c.coreDesire) && 'what they want', !has(c.fatalFlaw) && 'their flaw', !has(c.internalConflict) && 'what pulls them two ways'].filter(Boolean) as string[];
      if (missing.length) {
        const card = !has(c.coreDesire) ? CARD.want : !has(c.fatalFlaw) ? CARD.flaw : CARD.conflict;
        add(0, c, card, 'card', `${name}’s card is missing ${missing.join(', ')}`,
          `${name} is a ${c.role}, but the Story Bible doesn’t say ${missing.join(' or ')} yet. A character is easier to write and to check once those are written down. A card can help you find them.`);
      }
    }

    if (unitsIn.size >= 3) {
      // what the card says they want, fear or struggle with, but the scenes never show
      const checks: Array<[string | undefined, string, string, string, string]> = [
        [c.coreDesire, CARD.want, 'want', `${name}’s want doesn’t show on the page`, `The card says ${name} wants “${truncate(c.coreDesire ?? '', 80)}”, but in the scenes ${name} is in, I can’t find words that point to it. Is it shown some other way, or only in your notes?`],
        [c.fatalFlaw, CARD.flaw, 'flaw', `${name}’s flaw never seems to cost anything`, `The card gives ${name} the flaw “${truncate(c.fatalFlaw ?? '', 80)}”, but I can’t find it in their scenes. Where does it get in their way?`],
        [c.internalConflict, CARD.conflict, 'conflict', `${name}’s inner conflict isn’t visible`, `The card says ${name} is torn by “${truncate(c.internalConflict ?? '', 80)}”, but I can’t find it in their scenes. Does the reader ever see it?`],
      ];
      checks.forEach(([text, card, id, title, summary], i) => {
        if (has(text) && appearsInScenes(text!, src.units, unitsIn, names) === false) add(1 + i, c, card, id, title, summary, firstSeen);
      });

      // plenty of lines, no voice written down
      const lines = (ent?.mentions ?? []).filter(speaks).length;
      if (lines >= 6 && !has(c.speechPattern)) {
        add(4, c, CARD.voice, 'voice', `${name}’s voice`,
          `${name} speaks in about ${lines} places, but their card doesn’t describe how they talk. Writing it down can help them sound like themselves in every scene.`, firstSeen);
      }
    }

    // feelings: how rarely, or how narrowly, the reader sees them
    if (ent && unitsIn.size >= 4) {
      const mine = src.signals.filter(s => s.entityId === ent.id);
      if (major && mine.length === 0) {
        add(5, c, CARD.conflict, 'feelings', `what ${name} feels`,
          `${name} is in ${unitsIn.size} scenes, but I rarely catch what they feel. That can be a choice, like a guarded narrator. If it isn’t, a card on fears and avoidance may help.`, firstSeen);
      } else if (mine.length >= 5 && new Set(mine.map(s => s.unitIndex)).size >= 4) {
        const counts = new Map<string, number>();
        mine.forEach(s => counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1));
        const [kind, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (count / mine.length >= 0.85 && src.knowledge) {
          add(6, c, CARD.range, 'range', `${name} stays in one feeling`,
            `Nearly every feeling I find for ${name} is ${feelingLabel(src.knowledge, kind).toLowerCase()}. If they change over the story, where does that show? A card on healing and becoming can help.`, firstSeen);
        }
      }
    }
  });

  // two people who share scenes, with nothing on either card about how they are connected
  const linked = (a: CharacterProfile, b: CharacterProfile) =>
    [a, b].some((x, i) => x.relationships.some(r => r.targetCharacterId === [a, b][1 - i].id || r.targetName.trim().toLowerCase() === [a, b][1 - i].name.trim().toLowerCase()));
  for (let i = 0; i < src.characters.length; i++) {
    for (let j = i + 1; j < src.characters.length; j++) {
      const a = src.characters[i], b = src.characters[j];
      const ea = entityOf.get(a.id), eb = entityOf.get(b.id);
      if (!ea || !eb || linked(a, b)) continue;
      const together = [...new Set(ea.mentions.map(m => m.unitIndex))].filter(u => eb.mentions.some(m => m.unitIndex === u));
      if (together.length < 3) continue;
      const card = `faultline-${(hash(`${a.name}|${b.name}`) % FAULTLINES) + 1}`;
      if (reflected(a.id, card) || reflected(b.id, card)) continue;
      const first = ea.mentions.find(m => m.unitIndex === together[0]);
      candidates.push({
        rank: 7, subject: a.name, card,
        finding: {
          id: `finding-develop-pair-${slug(a.name)}-${slug(b.name)}`, category: 'expansion',
          title: `Development: ${a.name} and ${b.name}`,
          summary: `${a.name} and ${b.name} share ${together.length} scenes, but neither card says how they’re connected. What do they want from each other?`,
          evidencePassages: first ? [{ chapterId: first.chapterId, chapterTitle: first.unitTitle, quote: truncate(first.sentence, 160) }] : [],
          confidence: 'possible_exploration', linkedFoundationCardId: card, status: 'unreviewed', subject: a.name,
        },
      });
    }
  }

  // two people the story bible ties together, who both appear a lot but almost never in the same scene
  for (let i = 0; i < src.characters.length; i++) {
    for (let j = i + 1; j < src.characters.length; j++) {
      const a = src.characters[i], b = src.characters[j];
      const ea = entityOf.get(a.id), eb = entityOf.get(b.id);
      if (!ea || !eb) continue;
      const { types } = relationBetween(a, b);
      if (!expectsScenes(types)) continue;
      const inA = new Set(ea.mentions.map(m => m.unitIndex)), inB = new Set(eb.mentions.map(m => m.unitIndex));
      if (inA.size < 3 || inB.size < 3) continue;
      const together = [...inA].filter(u => inB.has(u)).length;
      if (together > 1) continue;
      const card = `faultline-${(hash(`${a.name}|${b.name}`) % FAULTLINES) + 1}`;
      if (reflected(a.id, card) || reflected(b.id, card)) continue;
      candidates.push({
        rank: 8, subject: a.name, card,
        finding: {
          id: `finding-develop-apart-${slug(a.name)}-${slug(b.name)}`, category: 'expansion',
          title: `Development: ${a.name} and ${b.name} are rarely together`,
          summary: `The Story Bible ties ${a.name} and ${b.name} together (${types.map(tagLabel).join(', ').toLowerCase()}), and each is in ${Math.min(inA.size, inB.size)} or more scenes, but they share ${together === 0 ? 'none' : 'only one'}. Is the distance part of the story, or should the reader see them together?`,
          evidencePassages: [],
          confidence: 'possible_exploration', linkedFoundationCardId: card, status: 'unreviewed', subject: a.name,
        },
      });
    }
  }

  // the most useful few for each character, and a limit overall
  const perCharacter = new Map<string, number>();
  return candidates
    .sort((x, y) => x.rank - y.rank)
    .filter(c => {
      const n = perCharacter.get(c.subject) ?? 0;
      if (n >= MAX_PER_CHARACTER) return false;
      perCharacter.set(c.subject, n + 1);
      return true;
    })
    .slice(0, MAX_TOTAL)
    .map(c => c.finding);
}
