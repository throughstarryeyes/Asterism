import type { AnalysisFinding, Project } from '../types';
import { applyFindingResponse } from './storyMemory';

// how the writer answers a finding, and what the analyzer may learn from it.
// answers are kept as a log; preferences are separate, scoped, and only made when the writer says so.

export type FindingVerdict = 'correct' | 'intentional' | 'related' | 'not_relevant' | 'misunderstood';

export interface FindingFeedback {
  id: string;
  findingId: string;
  check: string;
  subject?: string;
  verdict: FindingVerdict;
  note?: string;
  // false when the writer said "just this one": it is kept for the record and teaches nothing
  learn: boolean;
  at: string;
}

export type PreferenceScope = 'character' | 'project' | 'global';

export const PREFERENCE_KINDS = ['hide', 'phrase', 'same-person', 'not-character'] as const;
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number];

export interface AnalyzerPreference {
  id: string;
  check: string;
  subject?: string; // the character, for a character-scope preference
  scope: PreferenceScope;
  enabled: boolean;
  createdAt: string;
  // what it does: hide a kind of finding (the default), hide findings whose quote has a phrase, or change who the cast is
  kind?: PreferenceKind;
  phrase?: string; // kind phrase
  other?: string; // kind same-person: the second name (subject is the first)
}

// what a "misread" answer can teach, beyond the note
export type MisreadFix =
  | { kind: 'phrase'; phrase: string }
  | { kind: 'same-person'; other: string }
  | { kind: 'not-character' };

export const VERDICTS: Array<{ id: FindingVerdict; label: string; status: AnalysisFinding['status']; hint: string }> = [
  { id: 'correct', label: 'Correct', status: 'confirmed', hint: 'A real issue' },
  { id: 'intentional', label: 'Intentional', status: 'intentional', hint: 'I did this on purpose' },
  { id: 'related', label: 'Related', status: 'explained', hint: 'Handled elsewhere or tied to something else' },
  { id: 'not_relevant', label: 'Not relevant', status: 'dismissed', hint: 'Not useful to me' },
  { id: 'misunderstood', label: 'Misread', status: 'explained', hint: 'The analyzer got this wrong' },
];

// ---- which check a finding came from ---------------------------------------

const CHECK_BY_ID: Array<[RegExp, string]> = [
  [/^finding-draft-note-/, 'draft-notes'],
  [/^finding-chekhov-item-/, 'story-items'],
  [/^finding-unresolved-inquiry-/, 'questions'],
  [/^finding-unfulfilled-promise-/, 'promises'],
  [/^finding-dropped-character-/, 'sidelined'],
  [/^finding-emotional-deflections/, 'deflection'],
  [/^finding-trauma-pattern/, 'trauma'],
  [/^finding-pacing-exposition-/, 'pacing-exposition'],
  [/^finding-pacing-dialogue-/, 'pacing-dialogue'],
  [/^finding-timeline-/, 'timeline'],
  [/^finding-where-sameday-/, 'same-day'],
  [/^finding-where-/, 'where'],
  [/^finding-knows-/, 'knowledge'],
  [/^finding-(contradiction|charfact-bible|charfact-hand|charfact-mark)-/, 'physical'],
  [/^finding-charfact-age-/, 'age'],
  [/^finding-charfact-death-/, 'death'],
  [/^finding-develop-card-/, 'develop-card'],
  [/^finding-develop-want-/, 'develop-want'],
  [/^finding-develop-flaw-/, 'develop-flaw'],
  [/^finding-develop-conflict-/, 'develop-conflict'],
  [/^finding-develop-voice-/, 'develop-voice'],
  [/^finding-develop-feelings-/, 'develop-feelings'],
  [/^finding-develop-range-/, 'develop-range'],
  [/^finding-develop-pair-/, 'develop-pair'],
  [/^finding-develop-apart-/, 'develop-apart'],
  [/^finding-world-place-/, 'world-place'],
  [/^finding-world-lore-/, 'world-lore'],
];

export const CHECK_LABELS: Record<string, string> = {
  'draft-notes': 'author notes and placeholders',
  'story-items': 'objects that may be dropped',
  questions: 'unanswered questions',
  promises: 'promises with no payoff',
  sidelined: 'sidelined characters',
  deflection: 'emotional deflection',
  trauma: 'trauma cues',
  'pacing-exposition': 'low-exposition scenes',
  'pacing-dialogue': 'dialogue-heavy scenes',
  timeline: 'timeline checks',
  where: 'where characters are',
  'same-day': 'two places in one day',
  knowledge: 'who knows what',
  physical: 'physical details',
  age: 'ages',
  death: 'speaking after death',
  'develop-card': 'character cards with gaps',
  'develop-want': 'wants that don’t show',
  'develop-flaw': 'flaws that never cost',
  'develop-conflict': 'hidden inner conflict',
  'develop-voice': 'voice suggestions',
  'develop-feelings': 'feelings the reader can’t see',
  'develop-range': 'characters who stay in one feeling',
  'develop-pair': 'relationships not on a card',
  'develop-apart': 'related characters who are rarely together',
  'world-place': 'places not in the manuscript yet',
  'world-lore': 'lore not in the manuscript yet',
};

export const checkOf = (f: Pick<AnalysisFinding, 'id' | 'category' | 'subject'>): { check: string; subject?: string } => ({
  check: CHECK_BY_ID.find(([re]) => re.test(f.id))?.[1] ?? f.category,
  subject: f.subject,
});

export const checkLabel = (check: string) => CHECK_LABELS[check] ?? check.replace(/_/g, ' ');

// ---- answering -------------------------------------------------------------

export interface AnswerOptions {
  note?: string;
  fix?: MisreadFix;
  learn?: boolean;
  // how far a "not relevant" reaches. a passage-only answer makes no preference.
  scope?: 'passage' | PreferenceScope;
  now?: string;
}

export interface AnswerResult {
  project: Project;
  // the cast changed, so the story needs reading again
  rescan?: boolean;
  // a preference the writer asked for; a global one is kept with the writer's settings, the rest here.
  preference?: AnalyzerPreference;
}

export function applyVerdict(project: Project, findingId: string, verdict: FindingVerdict, opts: AnswerOptions = {}): AnswerResult {
  const finding = (project.findings || []).find(f => f.id === findingId);
  const info = VERDICTS.find(v => v.id === verdict);
  if (!finding || !info) return { project };
  const now = opts.now ?? new Date().toISOString();
  const learn = opts.learn !== false;
  const note = opts.note?.trim() || undefined;

  const answered = applyFindingResponse(project, findingId, info.status, note);
  const { check, subject } = checkOf(finding);
  const entry: FindingFeedback = { id: `fb-${findingId}`, findingId, check, subject, verdict, note, learn, at: now };
  const feedback = [...(answered.memoryVault.feedback ?? []).filter(x => x.findingId !== findingId), entry];

  let preference: AnalyzerPreference | undefined;
  const scope = opts.scope;
  if (learn && verdict === 'not_relevant' && scope && scope !== 'passage' && !(scope === 'character' && !subject)) {
    preference = { id: `pref-${scope}-${check}-${scope === 'character' ? subject : 'all'}`, check, subject: scope === 'character' ? subject : undefined, scope, enabled: true, createdAt: now };
  }
  // a misread can be turned into a rule that changes what the analyzer sees
  let fixed: AnalyzerPreference | undefined;
  if (learn && verdict === 'misunderstood' && opts.fix) fixed = misreadRule(opts.fix, check, subject, now);

  let preferences = answered.memoryVault.preferences ?? [];
  if (preference && preference.scope !== 'global') preferences = [...preferences.filter(p => p.id !== preference!.id), preference];
  if (fixed) preferences = [...preferences.filter(p => p.id !== fixed!.id), fixed];

  const next = { ...answered, memoryVault: { ...answered.memoryVault, feedback, preferences } };
  return { project: next, preference: preference ?? fixed, rescan: fixed ? fixed.kind === 'same-person' || fixed.kind === 'not-character' : undefined };
}

const MIN_PHRASE = 8;

const slugOf = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// the rule a misread answer asks for, or nothing if it is not usable
export function misreadRule(fix: MisreadFix, check: string, subject: string | undefined, now: string): AnalyzerPreference | undefined {
  const base = { scope: 'project' as const, enabled: true, createdAt: now };
  if (fix.kind === 'phrase') {
    const phrase = fix.phrase.replace(/\s+/g, ' ').trim();
    if (phrase.length < MIN_PHRASE) return undefined;
    return { ...base, id: `pref-phrase-${check}-${slugOf(phrase)}`, check, kind: 'phrase', phrase };
  }
  if (!subject) return undefined;
  if (fix.kind === 'not-character') return { ...base, id: `pref-notchar-${slugOf(subject)}`, check: 'cast', kind: 'not-character', subject };
  const other = fix.other.trim();
  if (!other || other.toLowerCase() === subject.toLowerCase()) return undefined;
  return { ...base, id: `pref-same-${slugOf(subject)}-${slugOf(other)}`, check: 'cast', kind: 'same-person', subject, other };
}

// who the cast is, as the writer corrected it
export function castRules(prefs: AnalyzerPreference[] = []): { samePerson: Array<[string, string]>; notCharacters: string[] } {
  const on = prefs.filter(p => p.enabled);
  return {
    samePerson: on.filter(p => p.kind === 'same-person' && p.subject && p.other).map(p => [p.subject!, p.other!] as [string, string]),
    notCharacters: on.filter(p => p.kind === 'not-character' && p.subject).map(p => p.subject!),
  };
}

// take an answer back: the finding is open again and the log forgets it
export function reopenFinding(project: Project, findingId: string): Project {
  const reopened = applyFindingResponse(project, findingId, 'unreviewed');
  return { ...reopened, memoryVault: { ...reopened.memoryVault, feedback: (reopened.memoryVault.feedback ?? []).filter(x => x.findingId !== findingId) } };
}

// ---- preferences -----------------------------------------------------------

const squash = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const matches = (p: AnalyzerPreference, f: AnalysisFinding) => {
  if (p.kind === 'same-person' || p.kind === 'not-character') return false; // these change the cast, not the list
  const { check, subject } = checkOf(f);
  if (p.kind === 'phrase') return p.check === check && !!p.phrase && f.evidencePassages.some(e => squash(e.quote).includes(squash(p.phrase!)));
  if (p.check !== check) return false;
  return p.scope !== 'character' || (!!subject && !!p.subject && subject.toLowerCase() === p.subject.toLowerCase());
};

// hide what an enabled preference covers, and bring back what a removed or switched-off one used to hide.
// a finding the writer already answered keeps its answer.
export function applyPreferences(findings: AnalysisFinding[], prefs: AnalyzerPreference[]): AnalysisFinding[] {
  const active = prefs.filter(p => p.enabled);
  return findings.map(f => {
    const hit = active.find(p => matches(p, f));
    if (hit) {
      if (f.status === 'unreviewed') return { ...f, status: 'dismissed' as const, hiddenBy: hit.id };
      return f.hiddenBy ? { ...f, hiddenBy: hit.id } : f;
    }
    if (f.hiddenBy) return { ...f, status: 'unreviewed' as const, hiddenBy: undefined };
    return f;
  });
}

export const allPreferences = (project: Project, global: AnalyzerPreference[] = []) => [...(project.memoryVault.preferences ?? []), ...global];

export function describePreference(p: AnalyzerPreference): string {
  if (p.kind === 'phrase') return `Ignore ${checkLabel(p.check)} that mention “${p.phrase}”`;
  if (p.kind === 'same-person') return `Treat ${p.subject} and ${p.other} as one person`;
  if (p.kind === 'not-character') return `Don’t treat “${p.subject}” as a character`;
  const what = checkLabel(p.check);
  if (p.scope === 'character') return `Hide ${what} about ${p.subject}`;
  return `Hide ${what} ${p.scope === 'global' ? 'in every project' : 'in this project'}`;
}

export function hiddenBy(findings: AnalysisFinding[], prefId: string): AnalysisFinding[] {
  return findings.filter(f => f.hiddenBy === prefId);
}

// ---- suggestions -----------------------------------------------------------

export interface Suggestion { key: string; check: string; count: number }

// the writer keeps calling the same kind of finding "not relevant" one at a time: offer to stop showing them.
// it only ever offers; nothing changes until the writer says yes.
export function suggestions(feedback: FindingFeedback[], prefs: AnalyzerPreference[], declined: string[] = [], minimum = 3): Suggestion[] {
  const counts = new Map<string, number>();
  feedback.forEach(f => {
    if (f.learn && f.verdict === 'not_relevant') counts.set(f.check, (counts.get(f.check) ?? 0) + 1);
  });
  return [...counts.entries()]
    .filter(([check, count]) => count >= minimum
      && !declined.includes(`suggest:${check}`)
      && !prefs.some(p => (p.kind ?? 'hide') === 'hide' && p.check === check && p.scope !== 'character'))
    .map(([check, count]) => ({ key: `suggest:${check}`, check, count }));
}
