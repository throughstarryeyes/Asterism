import { emptyTaught, sanitizeTaught, type Taught } from './teach';

// a feeling's id ("fear", "love", or one the writer added). see coach/knowledge.
export type SignalKind = string;

// how the writer conveys the signal. "explicit" names the feeling; the others
// show it through behavior. knowing the mode lets the coach ask better questions.
export type ExpressionMode = 'explicit' | 'physical' | 'avoidance' | 'deflection' | 'learned';

export interface Signal {
  id: string;
  kind: SignalKind;
  mode: ExpressionMode;
  entityId?: string;
  unitIndex: number;
  unitId: string;
  chapterId: string;
  unitTitle: string;
  sentence: string;
  // the cue that fired (built-in stem or learned pattern id).
  trigger: string;
  source: 'builtin' | 'learned';
  learnedPatternId?: string;
}

// what the writer said about a signal the coach proposed.
export type FeedbackVerdict =
  | 'confirm'        // yes, that's right
  | 'partial'        // partly right; explanation attached
  | 'reject'         // no, that's not what I meant
  | 'not_yet'        // the reader isn't supposed to know yet
  | 'intentional'    // deliberate ambiguity/inconsistency
  | 'exception';     // right here, but do not generalize from it

export interface LearningExample {
  id: string;
  kind: SignalKind;
  mode: ExpressionMode;
  verdict: FeedbackVerdict;
  sentence: string;
  entityId?: string;
  // the writer's own words about how they convey this.
  explanation?: string;
  projectId: string;
  createdAt: string;
}

// a cue the coach has learned from the writer. it only becomes active after
// repeated confirmation, so a single correction cannot become a universal rule.
export interface LearnedPattern {
  id: string;
  kind: SignalKind;
  mode: ExpressionMode;
  // content words that must co-occur in a sentence for the pattern to fire.
  words: string[];
  minHits: number;
  confirmations: number;
  rejections: number;
  // 'story' stays with one project; 'writer' applies across the writer's projects.
  scope: 'story' | 'writer';
  projectId: string;
  exampleIds: string[];
  disabled?: boolean;
  createdAt: string;
}

export interface WhyChain {
  entityId: string;
  kind: SignalKind;
  // how many follow-up questions have been answered so far.
  depth: number;
}

// the three memory layers kept separate on purpose.
export interface CoachMemory {
  // 1. story memory: facts about this project and decisions about its signals.
  story: {
    projectId: string;
    // entity+kind pairs the writer said are intentional or not-yet-revealed.
    suppressed: Array<{ entityId: string; kind: SignalKind; reason: 'intentional' | 'not_yet' }>;
    // entity+kind pairs the writer has confirmed ("Mara fears water").
    confirmed: Array<{ entityId: string; kind: SignalKind; note?: string }>;
    // nudge ids the writer has dismissed ("not now" / "already handled").
    dismissed: string[];
    // follow-up question chains started when the writer confirms a feeling.
    chains: WhyChain[];
  };
  // 2. writing profile: how this writer conveys things (patterns + examples).
  profile: {
    patterns: LearnedPattern[];
    examples: LearningExample[];
  };
  // 4. concepts and rules the writer has taught this coach.
  taught: Taught;
  // 3. analysis preferences: what the writer wants to be told about.
  preferences: {
    // per signal kind: shown at this level or hidden.
    mutedKinds: SignalKind[];
    evidenceLevel: 'brief' | 'detailed';
  };
}

export function emptyCoachMemory(projectId: string): CoachMemory {
  return {
    story: { projectId, suppressed: [], confirmed: [], dismissed: [], chains: [] },
    profile: { patterns: [], examples: [] },
    preferences: { mutedKinds: [], evidenceLevel: 'brief' },
    taught: emptyTaught(),
  };
}

// memory saved before dismissals and chains existed lacks those fields.
export function normalizeCoachMemory(raw: CoachMemory | undefined, projectId: string): CoachMemory {
  const base = emptyCoachMemory(projectId);
  if (!raw) return base;
  return {
    story: {
      ...base.story,
      ...raw.story,
      dismissed: raw.story?.dismissed ?? [],
      chains: raw.story?.chains ?? [],
    },
    profile: { patterns: raw.profile?.patterns ?? [], examples: raw.profile?.examples ?? [] },
    preferences: { ...base.preferences, ...raw.preferences },
    taught: sanitizeTaught(raw.taught),
  };
}
