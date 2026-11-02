import { splitSentences, type CoachUnit } from './entities';
import type { Nudge } from './features';

// concepts and rules the writer teaches the coach, e.g. "whenever there is magic, a cost should show up"
// a concept is key words plus yes/no example sentences; a small naive bayes classifier learns from them

export interface Concept {
  id: string;
  name: string;
  // words or short phrases the writer says always count.
  terms: string[];
  // sentences marked as "this is it" / "this is not it".
  positives: string[];
  negatives: string[];
}

export type RuleKind = 'always_with' | 'never_with' | 'only_with';

export interface StoryRule {
  id: string;
  // the rule in the writer's own words.
  text: string;
  kind: RuleKind;
  triggerId: string;
  otherId: string;
  // how many sentences away counts as "nearby".
  window: number;
  enabled: boolean;
}

export interface Taught {
  concepts: Concept[];
  rules: StoryRule[];
}

export const MAX_CONCEPTS = 40;
export const MAX_RULES = 30;
export const MAX_EXAMPLES = 80;
export const MAX_TERMS = 40;

export const emptyTaught = (): Taught => ({ concepts: [], rules: [] });

// ---- words ------------------------------------------------------------------

const STOP = new Set([
  'the', 'a', 'an', 'and', 'but', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'as', 'by', 'she', 'he', 'they', 'it',
  'her', 'his', 'their', 'its', 'was', 'were', 'is', 'be', 'been', 'had', 'has', 'have', 'that', 'this', 'then', 'when', 'while',
  'not', 'no', 'so', 'if', 'than', 'into', 'up', 'out', 'there', 'would', 'could', 'did', 'does', 'what', 'who', 'which', 'them',
  'him', 'you', 'your', 'our', 'we', 'i', 'my', 'me', 'said', 'just', 'about', 'over', 'after', 'before', 'again', 'still',
]);

// a light stem so "costs", "costly" and "cost" meet. not linguistics, just good enough to match.
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z']/g, '').replace(/'s$/, '');
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ly')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

export function stems(sentence: string, extraStop: Set<string> = new Set()): string[] {
  return [...new Set(
    sentence
      .toLowerCase()
      .split(/[^a-z']+/)
      .filter(w => w.length > 2 && !STOP.has(w) && !extraStop.has(w))
      .map(stem)
      .filter(w => w.length > 1)
  )];
}

const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

// ---- the manuscript as numbered sentences -----------------------------------

export interface SentenceRef {
  index: number;
  chapterId: string;
  unitTitle: string;
  unitIndex: number;
  sentence: string;
  stems: string[];
}

export function listSentences(units: CoachUnit[], names: string[] = []): SentenceRef[] {
  const nameWords = new Set(names.flatMap(n => n.toLowerCase().split(/\s+/)));
  const out: SentenceRef[] = [];
  units.forEach(u => splitSentences(u.plainText).forEach(sentence => {
    out.push({ index: out.length, chapterId: u.chapterId, unitTitle: u.title, unitIndex: u.index, sentence, stems: stems(sentence, nameWords) });
  }));
  return out;
}

// ---- learning what a concept looks like -------------------------------------

export interface ConceptModel {
  concept: Concept;
  posCounts: Map<string, number>;
  bgCounts: Map<string, number>;
  posTotal: number;
  bgTotal: number;
  vocab: number;
  termStems: Set<string>;
  termPhrases: string[];
}

const PRIOR_POSITIVE = 0.08;
const NEGATIVE_WEIGHT = 3;

export function buildModel(concept: Concept, sentences: SentenceRef[]): ConceptModel {
  const posCounts = new Map<string, number>();
  const bgCounts = new Map<string, number>();
  let posTotal = 0;
  let bgTotal = 0;
  const posNorm = new Set(concept.positives.map(norm));

  concept.positives.forEach(p => stems(p).forEach(w => { posCounts.set(w, (posCounts.get(w) ?? 0) + 1); posTotal++; }));
  // everything else in the manuscript is the background: what ordinary sentences look like.
  sentences.forEach(s => {
    if (posNorm.has(norm(s.sentence))) return;
    s.stems.forEach(w => { bgCounts.set(w, (bgCounts.get(w) ?? 0) + 1); bgTotal++; });
  });
  // sentences the writer said are not it count extra against the words they share.
  concept.negatives.forEach(n => stems(n).forEach(w => { bgCounts.set(w, (bgCounts.get(w) ?? 0) + NEGATIVE_WEIGHT); bgTotal += NEGATIVE_WEIGHT; }));

  const termStems = new Set<string>();
  const termPhrases: string[] = [];
  concept.terms.forEach(t => {
    const parts = t.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length > 1) termPhrases.push(parts.join(' '));
    else if (parts[0]) termStems.add(stem(parts[0]));
  });
  const vocab = new Set([...posCounts.keys(), ...bgCounts.keys()]).size || 1;
  return { concept, posCounts, bgCounts, posTotal, bgTotal, vocab, termStems, termPhrases };
}

export type MatchStatus = 'match' | 'maybe' | 'no';

export interface Score {
  status: MatchStatus;
  probability: number;
  via: 'term' | 'learned' | 'none';
  // the words that made the difference, for showing the writer why.
  because: string[];
}

const MATCH_AT = 0.85;
const MAYBE_AT = 0.5;

export function scoreSentence(model: ConceptModel, sentence: string, sentenceStems?: string[]): Score {
  const text = norm(sentence);
  const words = sentenceStems ?? stems(sentence);
  const c = model.concept;

  // the writer said this exact sentence is not it.
  if (c.negatives.some(n => norm(n) === text)) return { status: 'no', probability: 0, via: 'none', because: [] };
  // a word or phrase the writer told us always counts.
  const hits = words.filter(w => model.termStems.has(w));
  const phrase = model.termPhrases.find(p => text.includes(p));
  if (hits.length || phrase) return { status: 'match', probability: 1, via: 'term', because: phrase ? [phrase, ...hits] : hits };
  if (!model.posTotal) return { status: 'no', probability: 0, via: 'none', because: [] };

  // learned: how much more likely is each word in the examples than in ordinary sentences?
  const a = 0.5;
  let logOdds = Math.log(PRIOR_POSITIVE / (1 - PRIOR_POSITIVE));
  const evidence: Array<{ w: string; v: number }> = [];
  for (const w of words) {
    const inPos = model.posCounts.get(w) ?? 0;
    if (!inPos) continue; // only words seen in the examples say anything
    const pPos = (inPos + a) / (model.posTotal + a * model.vocab);
    const pBg = ((model.bgCounts.get(w) ?? 0) + a) / (model.bgTotal + a * model.vocab);
    const v = Math.log(pPos / pBg);
    logOdds += v;
    evidence.push({ w, v });
  }
  // one shared word is a coincidence; ask for at least two before calling it a match.
  const probability = 1 / (1 + Math.exp(-logOdds));
  const because = evidence.sort((x, y) => y.v - x.v).slice(0, 3).map(e => e.w);
  if (evidence.length >= 2 && probability >= MATCH_AT) return { status: 'match', probability, via: 'learned', because };
  if (evidence.length >= 1 && probability >= MAYBE_AT) return { status: 'maybe', probability, via: 'learned', because };
  return { status: 'no', probability, via: 'none', because: [] };
}

export interface ConceptMatch extends SentenceRef {
  score: Score;
}

export function matchesOf(concept: Concept, sentences: SentenceRef[]): ConceptMatch[] {
  const model = buildModel(concept, sentences);
  const out: ConceptMatch[] = [];
  sentences.forEach(s => {
    const score = scoreSentence(model, s.sentence, s.stems);
    if (score.status !== 'no') out.push({ ...s, score });
  });
  return out;
}

// words that show up in the writer's examples far more than in ordinary sentences:
// likely candidates to add as key words.
export function suggestTerms(concept: Concept, sentences: SentenceRef[], limit = 8): string[] {
  if (!concept.positives.length) return [];
  const model = buildModel(concept, sentences);
  const have = new Set([...model.termStems]);
  return [...model.posCounts.entries()]
    .map(([w, inPos]) => {
      const inBg = model.bgCounts.get(w) ?? 0;
      return { w, lift: inPos / (inBg + 1), inPos };
    })
    .filter(x => !have.has(x.w) && x.w.length > 2 && x.lift >= 0.5)
    .sort((a, b) => b.lift - a.lift || b.inPos - a.inPos)
    .slice(0, limit)
    .map(x => x.w);
}

// ---- rules ------------------------------------------------------------------

export interface RuleFinding {
  id: string;
  ruleId: string;
  sentence: SentenceRef;
  // the other concept's nearest match, if any (for "never together" rules).
  partner?: SentenceRef;
  kind: RuleKind;
}

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export function evaluateRules(taught: Taught, sentences: SentenceRef[], dismissed: string[] = []): RuleFinding[] {
  const findings: RuleFinding[] = [];
  const cache = new Map<string, Map<number, ConceptMatch>>();
  const matchesFor = (id: string) => {
    if (!cache.has(id)) {
      const concept = taught.concepts.find(c => c.id === id);
      cache.set(id, new Map((concept ? matchesOf(concept, sentences) : []).map(m => [m.index, m])));
    }
    return cache.get(id)!;
  };

  taught.rules.filter(r => r.enabled).forEach(rule => {
    const triggers = matchesFor(rule.triggerId);
    const others = matchesFor(rule.otherId);
    if (!triggers.size) return;
    const near = (i: number, from: number, to: number): SentenceRef | undefined => {
      for (let j = i - from; j <= i + to; j++) {
        const s = sentences[j];
        if (s && s.chapterId === sentences[i].chapterId && others.has(j)) return s;
      }
      return undefined;
    };

    triggers.forEach((t, i) => {
      // only act on sure matches; "maybe" is for asking, not for accusing.
      if (t.score.status !== 'match') return;
      const w = Math.max(0, rule.window);
      const found =
        rule.kind === 'always_with' ? near(i, 0, w)
        : rule.kind === 'only_with' ? near(i, w, w)
        : near(i, w, w);
      const broken = rule.kind === 'never_with' ? !!found : !found;
      if (!broken) return;
      const id = `rulefind-${rule.id}-${hash(t.sentence)}`;
      if (dismissed.includes(id)) return;
      findings.push({ id, ruleId: rule.id, sentence: t, partner: found, kind: rule.kind });
    });
  });
  return findings;
}

export function ruleNudges(taught: Taught, findings: RuleFinding[]): Nudge[] {
  const name = (id: string) => taught.concepts.find(c => c.id === id)?.name ?? 'something';
  return findings.map<Nudge>(f => {
    const rule = taught.rules.find(r => r.id === f.ruleId)!;
    const a = name(rule.triggerId);
    const b = name(rule.otherId);
    const body =
      f.kind === 'always_with' ? `This looks like ${a}, but I can’t find ${b} within ${rule.window} sentence${rule.window === 1 ? '' : 's'}. Is something missing, or is this an exception?`
      : f.kind === 'only_with' ? `${a} shows up here without ${b} nearby. Is that on purpose?`
      : `${a} and ${b} appear together here, and your rule says they shouldn’t. Is that on purpose?`;
    return {
      id: f.id,
      feature: 'storyRules',
      title: `Rule: ${rule.text}`,
      body,
      evidence: [
        { sentence: f.sentence.sentence, unitTitle: f.sentence.unitTitle, chapterId: f.sentence.chapterId },
        ...(f.partner ? [{ sentence: f.partner.sentence, unitTitle: f.partner.unitTitle, chapterId: f.partner.chapterId }] : []),
      ],
    };
  });
}

// ---- teaching: every answer from the writer changes what the coach knows ----

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function splitList(text: string): string[] {
  return text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
}

export function createConcept(name: string, terms: string[] = [], positives: string[] = []): Concept {
  return {
    id: uid('concept'),
    name: name.trim().slice(0, 60) || 'Something to watch',
    terms: [...new Set(terms.map(t => t.trim().toLowerCase()).filter(Boolean))].slice(0, MAX_TERMS),
    positives: [...new Set(positives.map(p => p.trim()).filter(p => p.length > 3))].slice(0, MAX_EXAMPLES),
    negatives: [],
  };
}

export function updateConcept(taught: Taught, id: string, fn: (c: Concept) => Concept): Taught {
  return { ...taught, concepts: taught.concepts.map(c => (c.id === id ? fn(c) : c)) };
}

// "Yes, this is it" / "No, it isn't": the main way the coach improves.
export function labelExample(taught: Taught, conceptId: string, sentence: string, isIt: boolean): Taught {
  const s = sentence.trim();
  if (!s) return taught;
  return updateConcept(taught, conceptId, c => {
    const without = (list: string[]) => list.filter(x => norm(x) !== norm(s));
    return isIt
      ? { ...c, positives: [...without(c.positives), s].slice(-MAX_EXAMPLES), negatives: without(c.negatives) }
      : { ...c, negatives: [...without(c.negatives), s].slice(-MAX_EXAMPLES), positives: without(c.positives) };
  });
}

export function addTerms(taught: Taught, conceptId: string, terms: string[]): Taught {
  return updateConcept(taught, conceptId, c => ({
    ...c,
    terms: [...new Set([...c.terms, ...terms.map(t => t.trim().toLowerCase()).filter(Boolean)])].slice(0, MAX_TERMS),
  }));
}

export function removeTerm(taught: Taught, conceptId: string, term: string): Taught {
  return updateConcept(taught, conceptId, c => ({ ...c, terms: c.terms.filter(t => t !== term) }));
}

export function addRule(taught: Taught, rule: Omit<StoryRule, 'id' | 'enabled'>): Taught {
  if (taught.rules.length >= MAX_RULES) return taught;
  return { ...taught, rules: [...taught.rules, { ...rule, id: uid('rule'), enabled: true, window: Math.max(0, Math.min(12, Math.round(rule.window))) }] };
}

export function setRuleEnabled(taught: Taught, id: string, enabled: boolean): Taught {
  return { ...taught, rules: taught.rules.map(r => (r.id === id ? { ...r, enabled } : r)) };
}

export function deleteRule(taught: Taught, id: string): Taught {
  return { ...taught, rules: taught.rules.filter(r => r.id !== id) };
}

// deleting a concept also removes the rules that depend on it.
export function deleteConcept(taught: Taught, id: string): Taught {
  return { concepts: taught.concepts.filter(c => c.id !== id), rules: taught.rules.filter(r => r.triggerId !== id && r.otherId !== id) };
}

// ---- safe loading of saved data ----------------------------------------------

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const strs = (v: unknown, max: number, each: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => x.slice(0, each)).slice(0, max) : []);

export function sanitizeTaught(raw: unknown): Taught {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const concepts: Concept[] = (Array.isArray(r.concepts) ? r.concepts : []).slice(0, MAX_CONCEPTS).flatMap((c: unknown) => {
    const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const id = str(x.id, 80);
    if (!id) return [];
    return [{ id, name: str(x.name, 60) || 'Something to watch', terms: strs(x.terms, MAX_TERMS, 60), positives: strs(x.positives, MAX_EXAMPLES, 400), negatives: strs(x.negatives, MAX_EXAMPLES, 400) }];
  });
  const ids = new Set(concepts.map(c => c.id));
  const kinds: RuleKind[] = ['always_with', 'never_with', 'only_with'];
  const rules: StoryRule[] = (Array.isArray(r.rules) ? r.rules : []).slice(0, MAX_RULES).flatMap((u: unknown) => {
    const x = (u && typeof u === 'object' ? u : {}) as Record<string, unknown>;
    const kind = kinds.find(k => k === x.kind);
    const id = str(x.id, 80);
    if (!kind || !id || !ids.has(String(x.triggerId)) || !ids.has(String(x.otherId))) return [];
    const window = typeof x.window === 'number' && Number.isFinite(x.window) ? Math.max(0, Math.min(12, Math.round(x.window))) : 3;
    return [{ id, text: str(x.text, 200) || 'My rule', kind, triggerId: String(x.triggerId), otherId: String(x.otherId), window, enabled: x.enabled !== false }];
  });
  return { concepts, rules };
}
