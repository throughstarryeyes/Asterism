import type { CoachMemory, FeedbackVerdict, LearnedPattern, LearningExample, Signal, SignalKind } from './types';
import { contentWords, type SignalSummary } from './signals';
import { feelingLabel, feelingPhrase, getDefaultKnowledge, type CoachKnowledge } from './knowledge';

export interface ConfirmationPrompt {
  entityId: string;
  kind: SignalKind;
  question: string;
  // the passages the coach is basing the question on.
  evidence: Signal[];
  // extra nudge when the feeling is only ever shown, never named.
  followUp?: string;
}

// should the coach ask about this at all? skips anything already settled or muted.
export function shouldAsk(summary: SignalSummary, memory: CoachMemory, minCount = 2): boolean {
  if (memory.preferences.mutedKinds.includes(summary.kind)) return false;
  if (memory.story.suppressed.some(s => s.entityId === summary.entityId && s.kind === summary.kind)) return false;
  if (memory.story.confirmed.some(s => s.entityId === summary.entityId && s.kind === summary.kind)) return false;
  return summary.count >= minCount;
}

export function buildConfirmationPrompt(summary: SignalSummary, entityName: string, knowledge: CoachKnowledge = getDefaultKnowledge()): ConfirmationPrompt {
  const label = feelingPhrase(knowledge, summary.kind);
  return {
    entityId: summary.entityId,
    kind: summary.kind,
    question: `I think ${entityName} may be ${label}. Is that right?`,
    evidence: summary.signals.slice(0, 3),
    followUp: summary.neverNamed
      ? `You show this without naming it. How do you usually write ${feelingLabel(knowledge, summary.kind).toLowerCase()}? Your answer helps me notice it next time.`
      : undefined,
  };
}

export interface FeedbackOptions {
  explanation?: string;
  // where a learned pattern should live. defaults to this story only.
  scope?: 'story' | 'writer';
  // master switch for learning, from CoachSettings.learning.
  learningEnabled: boolean;
  entityNames: string[];
  now?: string;
}

// "This passage shows fear": lets the writer teach the coach a sentence it did
// not flag, which is how new phrasing gets learned.
export function manualSignal(
  kind: SignalKind,
  mode: Signal['mode'],
  sentence: string,
  where: { unitIndex: number; unitId: string; chapterId: string; unitTitle: string },
  entityId?: string
): Signal {
  return { id: `manual-${where.unitIndex}-${kind}`, kind, mode, entityId, sentence, trigger: 'manual', source: 'builtin', ...where };
}

const overlap = (a: string[], b: string[]) => a.filter(w => b.includes(w));

export function recordFeedback(
  memory: CoachMemory,
  signal: Signal,
  verdict: FeedbackVerdict,
  opts: FeedbackOptions
): CoachMemory {
  const now = opts.now ?? new Date().toISOString();
  const projectId = memory.story.projectId;
  const example: LearningExample = {
    id: `ex-${memory.profile.examples.length + 1}-${Date.parse(now) || 0}`,
    kind: signal.kind, mode: signal.mode, verdict, sentence: signal.sentence,
    entityId: signal.entityId, explanation: opts.explanation, projectId, createdAt: now,
  };

  const next: CoachMemory = {
    story: {
      ...memory.story,
      suppressed: [...memory.story.suppressed],
      confirmed: [...memory.story.confirmed],
      dismissed: [...memory.story.dismissed],
      chains: memory.story.chains.map(c => ({ ...c })),
    },
    profile: { patterns: memory.profile.patterns.map(p => ({ ...p, exampleIds: [...p.exampleIds] })), examples: [...memory.profile.examples, example] },
    preferences: { ...memory.preferences, mutedKinds: [...memory.preferences.mutedKinds] },
    taught: memory.taught,
  };

  if ((verdict === 'not_yet' || verdict === 'intentional') && signal.entityId) {
    next.story.suppressed.push({ entityId: signal.entityId, kind: signal.kind, reason: verdict });
    return next; // deliberate choices are not evidence about how the writer conveys feeling.
  }

  if ((verdict === 'confirm' || verdict === 'partial') && signal.entityId) {
    next.story.confirmed.push({ entityId: signal.entityId, kind: signal.kind, note: opts.explanation });
    if (!next.story.chains.some(c => c.entityId === signal.entityId && c.kind === signal.kind)) {
      next.story.chains.push({ entityId: signal.entityId, kind: signal.kind, depth: 0 });
    }
  }

  if (verdict === 'reject' && signal.learnedPatternId) {
    const pattern = next.profile.patterns.find(p => p.id === signal.learnedPatternId);
    if (pattern) pattern.rejections += 1;
  }

  // "Exception" and learning-off keep the example for the record but teach nothing.
  const canLearn = opts.learningEnabled && (verdict === 'confirm' || verdict === 'partial');
  if (canLearn) {
    const words = contentWords(signal.sentence, opts.entityNames);
    const match = next.profile.patterns.find(p => {
      if (p.kind !== signal.kind || p.mode !== signal.mode) return false;
      return overlap(p.words, words).length >= 2;
    });
    if (match) {
      // keep only what both sentences share: that is the part that generalizes.
      match.words = overlap(match.words, words);
      match.minHits = Math.min(match.words.length, Math.max(2, Math.ceil(match.words.length * 0.6)));
      match.confirmations += 1;
      match.exampleIds.push(example.id);
    } else if (words.length >= 2) {
      next.profile.patterns.push({
        id: `pat-${signal.kind}-${signal.mode}-${next.profile.patterns.length + 1}`,
        kind: signal.kind, mode: signal.mode, words,
        minHits: Math.min(words.length, Math.max(2, Math.ceil(words.length * 0.6))),
        confirmations: 1, rejections: 0, scope: opts.scope ?? 'story', projectId,
        exampleIds: [example.id], createdAt: now,
      });
    }
  }
  return next;
}

// ---- letting the writer inspect and edit what was learned ------------------

export function forgetExample(memory: CoachMemory, exampleId: string): CoachMemory {
  const patterns = memory.profile.patterns
    .map(p => p.exampleIds.includes(exampleId)
      ? { ...p, exampleIds: p.exampleIds.filter(id => id !== exampleId), confirmations: Math.max(0, p.confirmations - 1) }
      : p)
    .filter(p => p.exampleIds.length > 0);
  return { ...memory, profile: { patterns, examples: memory.profile.examples.filter(e => e.id !== exampleId) } };
}

export function setPatternDisabled(memory: CoachMemory, patternId: string, disabled: boolean): CoachMemory {
  return { ...memory, profile: { ...memory.profile, patterns: memory.profile.patterns.map(p => p.id === patternId ? { ...p, disabled } : p) } };
}

export function deletePattern(memory: CoachMemory, patternId: string): CoachMemory {
  return { ...memory, profile: { ...memory.profile, patterns: memory.profile.patterns.filter(p => p.id !== patternId) } };
}

export function muteKind(memory: CoachMemory, kind: SignalKind, muted: boolean): CoachMemory {
  const set = new Set(memory.preferences.mutedKinds);
  if (muted) set.add(kind);
  else set.delete(kind);
  return { ...memory, preferences: { ...memory.preferences, mutedKinds: [...set] } };
}

// patterns that may travel between the writer's projects: scope must be 'writer'.
export function portablePatterns(memory: CoachMemory): LearnedPattern[] {
  return memory.profile.patterns.filter(p => p.scope === 'writer' && !p.disabled);
}

export function dismissNudge(memory: CoachMemory, nudgeId: string): CoachMemory {
  if (memory.story.dismissed.includes(nudgeId)) return memory;
  return { ...memory, story: { ...memory.story, dismissed: [...memory.story.dismissed, nudgeId] } };
}
