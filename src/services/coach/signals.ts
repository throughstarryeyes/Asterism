import type { EntityIndex } from './entities';
import { splitSentences, type CoachUnit } from './entities';
import type { CoachMemory, ExpressionMode, Signal, SignalKind } from './types';
import { compileCues, getDefaultKnowledge, type CoachKnowledge } from './knowledge';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'but', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'as', 'by',
  'she', 'he', 'they', 'it', 'her', 'his', 'their', 'its', 'was', 'were', 'is', 'be', 'been', 'had', 'has',
  'have', 'that', 'this', 'then', 'when', 'while', 'not', 'no', 'so', 'if', 'than', 'into', 'up', 'out',
]);

export function contentWords(sentence: string, entityNames: string[] = []): string[] {
  const names = new Set(entityNames.flatMap(n => n.toLowerCase().split(/\s+/)));
  return [...new Set(
    sentence
      .toLowerCase()
      .replace(/['’]s\b/g, '')
      .split(/[^a-z']+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w) && !names.has(w))
  )];
}

// the people a sentence is about, only when it names exactly one person
// or has a pronoun subject right after a one-name sentence; otherwise unattributed
function buildAttribution(units: CoachUnit[], index: EntityIndex): Map<string, string | undefined> {
  const bySentence = new Map<string, Set<string>>();
  index.entities.forEach(e => e.mentions.forEach(m => {
    const key = `${m.unitIndex}|${m.sentence}`;
    if (!bySentence.has(key)) bySentence.set(key, new Set());
    bySentence.get(key)!.add(e.id);
  }));
  const result = new Map<string, string | undefined>();
  units.forEach(unit => {
    let previous: string | undefined;
    splitSentences(unit.plainText).forEach(sentence => {
      const key = `${unit.index}|${sentence}`;
      const ids = bySentence.get(key);
      let who: string | undefined;
      if (ids && ids.size === 1) who = [...ids][0];
      else if (!ids && /^(she|he|they|her|his|their)\b/i.test(sentence)) who = previous;
      result.set(key, who);
      previous = ids && ids.size === 1 ? who : ids && ids.size > 1 ? undefined : previous;
    });
  });
  return result;
}

export function detectSignals(units: CoachUnit[], index: EntityIndex, memory?: CoachMemory, knowledge: CoachKnowledge = getDefaultKnowledge()): Signal[] {
  const cues = compileCues(knowledge);
  const attribution = buildAttribution(units, index);
  const entityNames = index.entities.flatMap(e => [e.canonical, ...e.aliases]);
  const learned = (memory?.profile.patterns ?? []).filter(p => !p.disabled && p.confirmations >= 2 && p.confirmations > p.rejections);
  const signals: Signal[] = [];

  units.forEach(unit => {
    splitSentences(unit.plainText).forEach((sentence, si) => {
      const entityId = attribution.get(`${unit.index}|${sentence}`);
      const base = { unitIndex: unit.index, unitId: unit.id, chapterId: unit.chapterId, unitTitle: unit.title, sentence, entityId };

      cues.forEach(cue => {
        const hit = cue.regexes.find(r => r.re.test(sentence));
        if (hit) {
          signals.push({ ...base, id: `sig-${unit.index}-${si}-${cue.kind}-${cue.mode}`, kind: cue.kind, mode: cue.mode, trigger: hit.stem, source: 'builtin' });
        }
      });

      if (learned.length) {
        const words = new Set(contentWords(sentence, entityNames));
        learned.forEach(p => {
          const overlap = p.words.filter(w => words.has(w)).length;
          if (overlap >= p.minHits) {
            signals.push({ ...base, id: `sig-${unit.index}-${si}-${p.id}`, kind: p.kind, mode: p.mode, trigger: p.id, source: 'learned', learnedPatternId: p.id });
          }
        });
      }
    });
  });

  return signals;
}

export interface SignalSummary {
  entityId: string;
  kind: SignalKind;
  count: number;
  units: number[];
  modes: ExpressionMode[];
  // true when the feeling is only ever shown, never named.
  neverNamed: boolean;
  signals: Signal[];
}

export function summarizeSignals(signals: Signal[]): SignalSummary[] {
  const groups = new Map<string, Signal[]>();
  signals.forEach(s => {
    if (!s.entityId) return;
    const key = `${s.entityId}|${s.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  });
  return [...groups.entries()].map(([key, list]) => {
    const [entityId, kind] = key.split('|') as [string, SignalKind];
    const modes = [...new Set(list.map(s => s.mode))];
    return {
      entityId, kind, count: list.length,
      units: [...new Set(list.map(s => s.unitIndex))].sort((a, b) => a - b),
      modes, neverNamed: !modes.includes('explicit'), signals: list,
    };
  }).sort((a, b) => b.count - a.count);
}

// which feelings a sentence carries, for features that look at sentences
// shared by two characters rather than one.
export function kindsInSentence(sentence: string, knowledge: CoachKnowledge = getDefaultKnowledge()): SignalKind[] {
  const kinds = new Set<SignalKind>();
  compileCues(knowledge).forEach(cue => {
    if (cue.regexes.some(r => r.re.test(sentence))) kinds.add(cue.kind);
  });
  return [...kinds];
}
