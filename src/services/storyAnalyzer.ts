import type {
  Project,
  AnalysisFinding,
  Chapter,
  EstablishedFact,
  AuthorStyleRule,
  ReadKnowledgeRecord,
  ReadPlaceRecord,
  FindingCategory,
  PlotThread
} from '../types';
import { getEffectiveLexicon } from '../data/defaultStoryLexicon';
import { SCENE_BREAK } from './openDraft';
import { buildEntityIndex, type CoachUnit, type EntityIndex, type KnownCharacter } from './coach/entities';
import { getDefaultKnowledge, type CoachKnowledge } from './coach/knowledge';
import { detectOpenLoops } from './openLoops';
import { timelineFindings } from './timeline';
import { characterContinuityFindings, readCharacterFacts, type ReadFact } from './characterFacts';
import { whereAndKnowsFindings, readWhereAndKnows } from './whereKnows';
import { allPreferences, applyPreferences, castRules, type AnalyzerPreference } from './analyzerFeedback';
import { characterDevelopmentFindings } from './characterDevelopment';
import { worldFindings, worldNames } from './storyWorld';
import { detectSignals } from './coach/signals';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…'
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    return ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

// strip HTML to plain text. works without a browser, so the analyzer can run in tests and workers.
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(?:p|div|h[1-6]|li|blockquote|tr)>/gi, '\n\n')
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text).replace(/\r\n/g, '\n').trim();
}

const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

// split text into sentences cleanly
export function extractSentences(text: string): string[] {
  if (!text) return [];
  const raw = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“'‘])|\n+/);
  return raw.map(s => s.trim()).filter(s => s.length > 3);
}

// common English stopwords to avoid false-positive character names
const STOP_WORDS = new Set([
  'The', 'A', 'An', 'And', 'But', 'Or', 'Nor', 'For', 'Yet', 'So',
  'He', 'She', 'They', 'It', 'We', 'You', 'I', 'His', 'Her', 'Their', 'My', 'Your', 'Our',
  'Then', 'There', 'Here', 'Now', 'When', 'Where', 'Why', 'How', 'What', 'Who', 'Whom',
  'In', 'On', 'At', 'To', 'From', 'With', 'Without', 'By', 'About', 'Into', 'Through',
  'After', 'Before', 'During', 'Under', 'Over', 'Between', 'Behind', 'Beyond',
  'This', 'That', 'These', 'Those', 'All', 'Some', 'Many', 'Few', 'Every', 'Each',
  'No', 'Not', 'Never', 'Always', 'Often', 'Sometimes', 'Perhaps', 'Maybe',
  'Suddenly', 'Meanwhile', 'Soon', 'Later', 'Finally', 'Immediately',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'Chapter', 'Prologue', 'Epilogue', 'Act', 'Scene', 'Part', 'One', 'Two', 'Three', 'Four', 'Five',
  'God', 'Jesus', 'Christ', 'Lord', 'Please', 'Okay', 'Fine', 'Yeah', 'Nope', 'Look', 'Listen'
]);

// note: tactile objects list is now dynamic — loaded from project lexicon at analysis time.

export interface NarrativeUnit {
  id: string;
  unitIndex: number;
  title: string;
  plainText: string;
  words: number;
  sentences: string[];
  dialogueRatio: number;
  originalChapterId: string;
  originalChapterTitle: string;
}

export interface StoryAnalysisResult {
  readFacts: ReadFact[];
  readPlaces: ReadPlaceRecord[];
  readKnowledge: ReadKnowledgeRecord[];
  findings: AnalysisFinding[];
  establishedFacts: EstablishedFact[];
  authorStyleRules: AuthorStyleRule[];
  narrativeUnitsCount: number;
}

// splits a project into scenes, using chapters or scene dividers (* * *, ---, ###) in an open draft
const DIVIDER_REGEX = SCENE_BREAK;
const BEAT_WORDS = 850;

function dialogueRatioOf(text: string): number {
  const matches = text.match(/(?:“[^”]*”|"[^"]*"|'[^']*')/g) || [];
  const dialogueChars = matches.reduce((sum, match) => sum + match.length, 0);
  return text.length > 0 ? dialogueChars / text.length : 0;
}

function pushUnit(units: NarrativeUnit[], id: string, title: string, plainText: string, chapter: Chapter): void {
  units.push({
    id,
    unitIndex: units.length,
    title,
    plainText,
    words: countWords(plainText),
    sentences: extractSentences(plainText),
    dialogueRatio: dialogueRatioOf(plainText),
    originalChapterId: chapter.id,
    originalChapterTitle: chapter.title
  });
}

// what it takes to read a manuscript into scenes and people.
export type ManuscriptSource = Pick<Project, 'chapters' | 'storyBible' | 'draftMode'> & { memoryVault?: Pick<Project['memoryVault'], 'preferences'> };

export function extractNarrativeUnits(project: ManuscriptSource): NarrativeUnit[] {
  const chapters = [...(project.chapters || [])].sort((a, b) => a.order - b.order);
  if (chapters.length === 0) return [];

  const units: NarrativeUnit[] = [];
  const isOpenDraft = project.draftMode === 'open_draft' || chapters.length <= 1;

  // chaptered mode: one unit per chapter.
  if (!isOpenDraft) {
    chapters.forEach(ch => pushUnit(units, ch.id, ch.title, htmlToPlainText(ch.content), ch));
    return units;
  }

  // scenes: split each chapter at its own dividers, so every scene keeps the chapter it came from
  // and findings point at the right place.
  let sceneNumber = 0;
  chapters.forEach(ch => {
    (ch.content || '').split(DIVIDER_REGEX).filter(chunk => chunk && chunk.trim().length > 0).forEach(chunk => {
      sceneNumber++;
      const plainText = htmlToPlainText(chunk);
      if (countWords(plainText) <= 10) return;
      const header = chunk.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      const headerText = header && header[1] ? header[1].replace(/<[^>]+>/g, '').trim() : '';
      pushUnit(units, `scene-unit-${sceneNumber}`, headerText || `Scene ${sceneNumber}`, plainText, ch);
    });
  });
  if (units.length > 1) return units;

  // no usable scene dividers: cut into narrative beats of roughly BEAT_WORDS words.
  units.length = 0;
  let beatNumber = 0;
  chapters.forEach(ch => {
    const paragraphs = htmlToPlainText(ch.content).split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let current: string[] = [];
    let currentWords = 0;
    const commit = () => {
      if (current.length === 0) return;
      beatNumber++;
      pushUnit(units, `beat-unit-${beatNumber}`, `Scene Beat ${beatNumber}`, current.join('\n\n'), ch);
      current = [];
      currentWords = 0;
    };
    paragraphs.forEach((paragraph, i) => {
      current.push(paragraph);
      currentWords += countWords(paragraph);
      if (currentWords >= BEAT_WORDS && i < paragraphs.length - 1) commit();
    });
    commit();
  });
  if (units.length === 1) units[0].title = 'Full Manuscript';
  return units;
}

// "my name is Margaret ... call me Maggie", "Margaret, short for Maggie", "Margaret (Maggie)"
const NICKNAME_PATTERNS = [
  /\bmy name is ([A-Z][a-z]+)[^.!?]{0,40}\bcall me ([A-Z][a-z]+)\b/i,
  /\bI'm ([A-Z][a-z]+)[^.!?]{0,40}\bcall me ([A-Z][a-z]+)\b/i,
  /\b([A-Z][a-z]+),\s+short for\s+([A-Z][a-z]+)\b/i,
  /\b([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\b/
];

// the people the writer has told us about (story bible) plus the nicknames the text spells out.
function knownCharacters(project: ManuscriptSource, units: NarrativeUnit[], samePerson: Array<[string, string]> = []): KnownCharacter[] {
  const known: KnownCharacter[] = (project.storyBible?.characters || [])
    .filter(c => c.name && c.name.trim())
    .map(c => ({ name: c.name.trim(), aliases: [...(c.aliases || [])] }));

  const has = (k: KnownCharacter, name: string) =>
    [k.name, ...(k.aliases || [])].some(n => n.toLowerCase() === name.toLowerCase());

  // names the writer said are one person count like the nicknames the text spells out
  const joined = (primary: string, alias: string) => {
    const owner = known.find(k => has(k, primary) || has(k, alias));
    if (!owner) known.push({ name: primary, aliases: [alias] });
    else {
      owner.aliases = owner.aliases || [];
      [primary, alias].forEach(n => { if (!has(owner, n)) owner.aliases!.push(n); });
    }
  };
  samePerson.forEach(([a, b]) => joined(a, b));

  units.forEach(unit => {
    NICKNAME_PATTERNS.forEach(pattern => {
      const match = unit.plainText.match(pattern);
      if (!match || !match[1] || !match[2]) return;
      const [primary, alias] = [match[1].trim(), match[2].trim()];
      if (STOP_WORDS.has(primary) || STOP_WORDS.has(alias)) return;
      const owner = known.find(k => has(k, primary) || has(k, alias));
      if (!owner) {
        known.push({ name: primary, aliases: [alias] });
      } else {
        owner.aliases = owner.aliases || [];
        [primary, alias].forEach(n => { if (!has(owner, n)) owner.aliases!.push(n); });
      }
    });
  });
  return known;
}

export const toCoachUnits = (units: NarrativeUnit[]): CoachUnit[] =>
  units.map(u => ({ id: u.id, index: u.unitIndex, title: u.title, chapterId: u.originalChapterId, plainText: u.plainText }));

export interface StoryContext {
  units: NarrativeUnit[];
  coachUnits: CoachUnit[];
  index: EntityIndex;
}

// the one reading of the manuscript every analysis uses: same scenes, same cast
// the scan and the coach both start here, so they never disagree
// the last reading of each manuscript, so the scan, the coach, plot threads and the timeline share one
// it is reused while the text, the bible, the draft mode and the cast rules are the same objects
const readings = new WeakMap<object, { bible: unknown; rules: unknown; mode: unknown; value: StoryContext }>();

// a reading made earlier for the same text, bible, mode and cast rules, if there is one
export function cachedReading(project: ManuscriptSource): StoryContext | undefined {
  const seen = readings.get(project.chapters);
  return seen && seen.bible === project.storyBible && seen.rules === project.memoryVault?.preferences && seen.mode === project.draftMode ? seen.value : undefined;
}

export function rememberReading(project: ManuscriptSource, value: StoryContext): void {
  if (project.chapters) readings.set(project.chapters, { bible: project.storyBible, rules: project.memoryVault?.preferences, mode: project.draftMode, value });
}

export function buildStoryContext(project: ManuscriptSource): StoryContext {
  const seen = cachedReading(project);
  if (seen) return seen;

  const units = extractNarrativeUnits(project);
  const coachUnits = toCoachUnits(units);
  const cast = castRules(project.memoryVault?.preferences);
  const value = { units, coachUnits, index: buildEntityIndex(coachUnits, knownCharacters(project, units, cast.samePerson), [...cast.notCharacters, ...worldNames(project.storyBible ?? { locations: [], lore: [] })]) };
  rememberReading(project, value);
  return value;
}

// story analysis engine: any genre, chaptered or one continuous draft
// respects author feedback and story memory
export function performStoryAnalysis(project: Project, options: { knowledge?: CoachKnowledge; writerPreferences?: AnalyzerPreference[] } = {}): StoryAnalysisResult {
  const findings: AnalysisFinding[] = [];
  const establishedFacts: EstablishedFact[] = [...(project.memoryVault?.establishedFacts || [])];
  const authorStyleRules: AuthorStyleRule[] = [...(project.memoryVault?.authorStyleRules || [])];

  // load user-customized lexicon (falls back to rich genre-agnostic defaults)
  const lexicon = getEffectiveLexicon(project.memoryVault);

  // the writer's analysis settings. gentle drops the speculative notes and wants more evidence;
  // rigorous looks harder and shows more.
  const prefs = project.memoryVault?.analysisPreferences ?? { sensitivity: 'balanced', ignoreResolvedThreads: false };
  const minCharacterMentions = prefs.sensitivity === 'gentle' ? 3 : 2;
  const expositionBelow = prefs.sensitivity === 'rigorous' ? 0.08 : 0.05;
  const dialogueAbove = prefs.sensitivity === 'rigorous' ? 0.7 : 0.75;
  const maxFindings = prefs.sensitivity === 'rigorous' ? 60 : 40;

  const { units, coachUnits, index: entityIndex } = buildStoryContext(project);
  const totalWords = units.reduce((sum, u) => sum + u.words, 0);

  // if manuscript is completely empty, provide an informative entry
  if (totalWords === 0) {
    findings.push({
      id: 'finding-empty-manuscript',
      category: 'expansion',
      title: 'Ready for Your Manuscript',
      summary: 'Asterism’s universal narrative intelligence is standing by. Paste or drop your prose in to audit dropped threads, track Chekhov items, catch unresolved questions, and analyze pacing rhythm across any genre.',
      evidencePassages: [],
      confidence: 'possible_exploration',
      status: 'unreviewed'
    });
    return { findings, establishedFacts, authorStyleRules, narrativeUnitsCount: 0, readFacts: [], readPlaces: [], readKnowledge: [] };
  }

  // set of established facts subjects to avoid re-flagging intentional items
  const establishedFactSubjects = new Set(
    establishedFacts.map(f => f.subject.toLowerCase())
  );

  // 1. drafting roadmap: author notes and placeholders ([insert ...], TK)
  units.forEach(unit => {
    const noteRegex = /(?:\[|\()(?:\s*(?:insert|this scene|maybe|todo|tk|idk|we will need|scene where)[^\]\)]*)(?:\]|\))|(?:^|\s)(?:TODO:|TK\b|TBD\b)[^\n]*/gi;
    let noteMatch: RegExpExecArray | null;

    while ((noteMatch = noteRegex.exec(unit.plainText)) !== null) {
      const rawSnippet = noteMatch[0].trim();
      const cleanSnippet = rawSnippet.replace(/^[\[\(]\s*|\s*[\]\)]$/g, '').trim();
      findings.push({
        id: `finding-draft-note-${unit.id}-${hashString(rawSnippet)}`,
        category: 'drafting_note',
        title: `Drafting Placeholder: "${truncateQuote(cleanSnippet, 40)}"`,
        summary: `Working author note detected in ${unit.title}. Marks a planned scene addition, character beat, or tone adjustment for your next revision pass.`,
        evidencePassages: [
          {
            chapterId: unit.originalChapterId,
            chapterTitle: unit.title,
            quote: truncateQuote(rawSnippet, 160)
          }
        ],
        confidence: 'definite',
        status: 'unreviewed'
      });
    }
  });

  // 2. characters: names come from the coach's people index, which also knows the bible's aliases
  const characterMentions = new Map<string, Array<{ unitIndex: number; unitTitle: string; chapterId: string; quote: string; count: number }>>();
  const nameForms = new Map<string, string[]>();
  const bibleNames = new Set((project.storyBible?.characters || []).map(c => (c.name || '').trim()).filter(Boolean));

  entityIndex.entities.forEach(entity => {
    if (entity.mentions.length === 0) return;
    const byUnit = new Map<number, { unitIndex: number; unitTitle: string; chapterId: string; quote: string; count: number }>();
    entity.mentions.forEach(m => {
      const group = byUnit.get(m.unitIndex);
      if (group) group.count += 1;
      else byUnit.set(m.unitIndex, { unitIndex: m.unitIndex, unitTitle: m.unitTitle, chapterId: m.chapterId, quote: truncateQuote(m.sentence, 150), count: 1 });
    });
    characterMentions.set(entity.canonical, [...byUnit.values()].sort((a, b) => a.unitIndex - b.unitIndex));
    nameForms.set(entity.canonical, [entity.canonical, ...entity.aliases]);
  });

  // 3. open loops: what the story sets going that never comes back
  // one detector shared with the coach; unanswered ones are questions, not verdicts
  const loops = detectOpenLoops(coachUnits, entityIndex, { knowledge: options.knowledge, lexicon });
  const quotedOr = (sentence: string) => (sentence.match(/[“"]([^”"]+)[”"]/)?.[1] ?? sentence).trim();

  // objects handled with emphasis that never show up in the late scenes.
  if (units.length >= 2) {
    const lateThreshold = Math.max(1, Math.floor(units.length * 0.65));

    loops.filter(l => l.kind === 'object').forEach(loop => {
      const item = loop.item!;
      // check if item is already addressed in author's established facts
      if (establishedFactSubjects.has(item) || establishedFactSubjects.has(`chekhov-${item}`)) return;

      const early = loop.mentions.filter(m => m.unitIndex < lateThreshold);
      // any later mention counts, not only another "hid the key" moment: the item is still in the story.
      const returns = loop.followUpUnits.some(u => u >= lateThreshold);
      if (early.length === 0 || returns) return;

      const first = early[0];
      findings.push({
        id: `finding-chekhov-item-${item}`,
        loopId: loop.id,
        category: 'dropped_thread',
        title: `Chekhov’s Item: Sidelined "${capitalize(item)}"`,
        summary: `"${capitalize(item)}" was introduced with tactile focus in ${first.unitTitle} ("${truncateQuote(first.sentence, 150)}"), but I couldn't find it again in the late scenes or resolution. In storytelling across any genre, concrete objects handled with emphasis create reader anticipation—is this thread meant to pay off, or was it set aside during drafting?`,
        evidencePassages: early.slice(0, 2).map(m => ({
          chapterId: m.chapterId,
          chapterTitle: m.unitTitle,
          quote: truncateQuote(m.sentence, 150)
        })),
        confidence: 'probable',
        status: 'unreviewed'
      });
    });
  }

  // questions and promises that no later scene returns to. a story asks hundreds of small questions, so only
  // the clearest few are raised: spoken mysteries first, then the ones with the most to say
  const MAX_QUESTIONS = 8;
  const questions: Array<{ loop: (typeof loops)[number]; finding: AnalysisFinding }> = [];
  loops.filter(l => l.kind === 'question' || l.kind === 'promise').forEach(loop => {
    const scenesAfter = units.length - 1 - loop.unitIndex;
    if (!loop.judgeable || loop.followUps.length > 0 || scenesAfter < 2) return;

    const snippet = quotedOr(loop.sentence);
    const evidencePassages = [{ chapterId: loop.chapterId, chapterTitle: loop.unitTitle, quote: truncateQuote(loop.sentence, 150) }];

    if (loop.kind === 'question') {
      questions.push({ loop, finding: {
        id: `finding-unresolved-inquiry-${hashString(snippet)}`,
        loopId: loop.id,
        category: 'dropped_thread',
        title: `Unresolved Inquiry: "${truncateQuote(snippet, 38)}"`,
        summary: `A pressing narrative question or suspicion was raised in ${loop.unitTitle} ("${truncateQuote(loop.sentence, 120)}"). I couldn't find a later passage that answers it, acknowledges it, or returns to it. Is it meant to stay open?`,
        evidencePassages,
        // a question a character asks aloud is a firmer setup than one the narration muses on.
        confidence: loop.spoken ? 'probable' : 'possible_exploration',
        status: 'unreviewed'
      } });
    } else {
      findings.push({
        id: `finding-unfulfilled-promise-${hashString(snippet)}`,
        loopId: loop.id,
        category: 'dropped_thread',
        title: `Unfulfilled Commitment: "${truncateQuote(snippet, 35)}"`,
        summary: `In ${loop.unitTitle}, a character made an explicit commitment or scheduled an appointment: "${truncateQuote(loop.sentence, 120)}". I couldn't find a later scene that keeps, breaks, or mentions it. Was it left out on purpose?`,
        evidencePassages,
        confidence: 'probable',
        status: 'unreviewed'
      });
    }
  });
  questions
    .sort((a, b) => Number(!!b.loop.spoken) - Number(!!a.loop.spoken) || b.loop.subject.length - a.loop.subject.length || a.loop.unitIndex - b.loop.unitIndex)
    .slice(0, MAX_QUESTIONS)
    .forEach(q => findings.push(q.finding));

  // 6. sidelined or disappeared characters (open drafts and chapters)
  if (units.length >= 3) {
    const earlyThreshold = Math.max(1, Math.floor(units.length * 0.35));
    const lateThreshold = Math.floor(units.length * 0.65);

    characterMentions.forEach((mentions, name) => {
      const totalMentions = mentions.reduce((sum, m) => sum + m.count, 0);
      if (totalMentions >= minCharacterMentions) {
        const appearedInEarly = mentions.some(m => m.unitIndex < earlyThreshold);
        const appearedInLate = mentions.some(m => m.unitIndex >= lateThreshold);

        if (appearedInEarly && !appearedInLate) {
          // check if author already established their departure
          if (establishedFactSubjects.has(name.toLowerCase())) return;

          const firstMention = mentions[0];
          findings.push({
            id: `finding-dropped-character-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            category: 'dropped_thread',
            title: `Sidelined Character: ${name}`,
            summary: `${name} was introduced with active presence in early scenes (${firstMention.unitTitle}), but I couldn't find them in the later scenes. Has this character’s thread concluded, or are they waiting to return?`,
            evidencePassages: [
              {
                chapterId: firstMention.chapterId,
                chapterTitle: firstMention.unitTitle,
                quote: firstMention.quote
              }
            ],
            confidence: 'probable',
            status: 'unreviewed',
            subject: name
          });
        }
      }
    });
  }


  // 7. emotional armor and deflection, plus trauma cues
  // builds the deflection regex from the user's lexicon
  const deflectionPhraseAlts = lexicon.deflectionPhrases
    .map((p: string) => escapeRegExp(p))
    .join('|');
  const deflectionRegex = deflectionPhraseAlts
    ? new RegExp(`(?:"|“|')\\s*(?:${deflectionPhraseAlts})\\s*[.,!?](?:"|”|')`, 'i')
    : null;

  const deflectionsDetected: Array<{ unitTitle: string; chapterId: string; quote: string }> = [];
  const traumaCuesDetected: Array<{ unitTitle: string; chapterId: string; quote: string }> = [];

  units.forEach(unit => {
    unit.sentences.forEach(sentence => {
      if (deflectionRegex && deflectionRegex.test(sentence)) {
        deflectionsDetected.push({
          unitTitle: unit.title,
          chapterId: unit.originalChapterId,
          quote: truncateQuote(sentence, 150)
        });
      }
      // scan prose for trauma/hypervigilance cues from user lexicon
      const matchedCue = lexicon.traumaCues.find((cue: string) =>
        new RegExp(escapeRegExp(cue), 'i').test(sentence)
      );
      if (matchedCue) {
        traumaCuesDetected.push({
          unitTitle: unit.title,
          chapterId: unit.originalChapterId,
          quote: truncateQuote(sentence, 150)
        });
      }
    });
  });

  if (deflectionsDetected.length >= 2) {
    const examplePhrases = lexicon.deflectionPhrases.slice(0, 3).map((p: string) => `"${p}"`).join(", ");
    findings.push({
      id: `finding-emotional-deflections`,
      category: 'continuity',
      title: `Subtext & Defense: Recurring Emotional Deflections`,
      summary: `Characters repeatedly use emotional deflections (${examplePhrases}) across ${deflectionsDetected.length} scenes. This pattern highlights strong internal consistency in their defense mechanisms and avoidance.`,
      evidencePassages: deflectionsDetected.slice(0, 3).map(d => ({
        chapterId: d.chapterId,
        chapterTitle: d.unitTitle,
        quote: d.quote
      })),
      confidence: 'probable',
      status: 'unreviewed'
    });
  }

  if (traumaCuesDetected.length >= 3) {
    findings.push({
      id: `finding-trauma-pattern`,
      category: 'continuity',
      title: `Trauma Pattern: Hypervigilance & Physiological Responses`,
      summary: `Trauma response cues appear ${traumaCuesDetected.length} times across the manuscript. Repeated physiological tells (trembling, scanning exits, flinching) are powerful emotional anchors — is this character arc building toward confrontation or resolution?`,
      evidencePassages: traumaCuesDetected.slice(0, 3).map(d => ({
        chapterId: d.chapterId,
        chapterTitle: d.unitTitle,
        quote: d.quote
      })),
      confidence: 'possible_exploration',
      status: 'unreviewed'
    });
  }

  // 8. character continuity: what the manuscript says (colors, age, hands, marks, death)
  // is compared with the page, the bible and the timeline
  const describable = Array.from(characterMentions.entries())
    .filter(([name, mentions]) => bibleNames.has(name) || mentions.reduce((sum, m) => sum + m.count, 0) >= 2)
    .map(([name]) => {
      const forms = new Set<string>([...(nameForms.get(name) ?? [name]), ...name.split(/\s+/).filter(p => p.length >= 3 && !STOP_WORDS.has(p))]);
      return { name, pattern: new RegExp(`\\b(?:${Array.from(forms).map(escapeRegExp).join('|')})\\b`, 'gi') };
    });

  const factSource = {
    units: units.map(u => ({ index: u.unitIndex, title: u.title, chapterId: u.originalChapterId, sentences: u.sentences })),
    characters: describable,
    lexicon: { eyeColors: lexicon.eyeColors, hairColors: lexicon.hairColors },
    bible: project.storyBible,
    timeline: project.timeline ?? [],
    ignored: project.memoryVault?.ignoredStatements
  };
  findings.push(...characterContinuityFindings(factSource));
  const readFacts = readCharacterFacts(factSource);

  // who is where, and what each character could know yet.
  const whereSource = {
    units: factSource.units,
    characters: describable,
    locations: (project.storyBible?.locations ?? []).map(l => ({ name: (l.name ?? '').trim(), aliases: (l.aliases ?? []).map(a => a.trim()).filter(Boolean) })).filter(l => l.name),
    bible: project.storyBible,
    timeline: project.timeline ?? [],
    ignored: project.memoryVault?.ignoredStatements
  };
  findings.push(...whereAndKnowsFindings(whereSource));
  const { places: readPlaces, knowledge: readKnowledge } = readWhereAndKnows(whereSource);

  // 9. dialogue and pacing rhythm per scene
  units.forEach(unit => {
    if (unit.words >= 400) {
      if (unit.dialogueRatio < expositionBelow) {
        findings.push({
          id: `finding-pacing-exposition-${unit.id}`,
          category: 'continuity',
          title: `Pacing Audit: Heavy Internal Monologue in ${unit.title}`,
          summary: `${unit.title} contains ${unit.words.toLocaleString()} words with less than ${Math.round(expositionBelow * 100)}% spoken dialogue. It functions largely as introspection or exposition. If the pacing begins to drag, consider introducing a dialogue exchange or action beat.`,
          evidencePassages: unit.sentences.slice(0, 2).map(s => ({
            chapterId: unit.originalChapterId,
            chapterTitle: unit.title,
            quote: truncateQuote(s, 140)
          })),
          confidence: 'possible_exploration',
          status: 'unreviewed'
        });
      } else if (unit.dialogueRatio > dialogueAbove) {
        findings.push({
          id: `finding-pacing-dialogue-${unit.id}`,
          category: 'expansion',
          title: `Physical Blocking: High Dialogue Density in ${unit.title}`,
          summary: `Over ${Math.round(unit.dialogueRatio * 100)}% of this scene consists of direct dialogue. Consider anchoring the characters with subtle physical tells, environmental textures, or unspoken glances to enrich the subtext.`,
          evidencePassages: unit.sentences.slice(0, 2).map(s => ({
            chapterId: unit.originalChapterId,
            chapterTitle: unit.title,
            quote: truncateQuote(s, 140)
          })),
          confidence: 'possible_exploration',
          status: 'unreviewed'
        });
      }
    }
  });

  // 10. author voice and style metrics over time
  const allSentences = units.flatMap(u => u.sentences);
  if (allSentences.length > 5) {
    const totalWordsInSentences = allSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0);
    const avgSentenceLength = Math.round(totalWordsInSentences / allSentences.length);

    const cadenceId = 'rule-sentence-cadence';
    if (!authorStyleRules.some(r => r.id === cadenceId)) {
      authorStyleRules.push({
        id: cadenceId,
        pattern: `Prose Cadence (~${avgSentenceLength} words/sentence)`,
        meaning: avgSentenceLength <= 14 ? 'Punchy, rhythmic sentences with strong emotional urgency.' : 'Lyrical, introspective sentences rich in interiority and clause variety.',
        examplesCount: allSentences.length,
        lastUpdated: new Date().toISOString()
      });
    }
  }

  // 11. character development: where a card or the scenes leave room to grow, each linked to a foundations card
  findings.push(...characterDevelopmentFindings({
    units: coachUnits,
    index: entityIndex,
    characters: project.storyBible?.characters ?? [],
    reflections: project.reflections ?? [],
    signals: detectSignals(coachUnits, entityIndex, project.coachMemory, options.knowledge),
    knowledge: options.knowledge ?? getDefaultKnowledge(),
  }));

  // 12. places and lore in the story bible that no scene uses yet
  findings.push(...worldFindings({ units: coachUnits, bible: project.storyBible ?? { locations: [], lore: [] } }));

  // dedupe, apply what the writer has already told us, and keep the most important findings.
  const previous = new Map((project.findings || []).map(f => [f.id, f]));
  // loops already marked handled on the coach's board.
  const handledLoops = new Set(project.coachMemory?.story?.dismissed ?? []);
  const threads = project.plotThreads || [];
  const uniqueFindings: AnalysisFinding[] = [];
  const seenTitles = new Set<string>();

  const priority: Record<FindingCategory, number> = {
    drafting_note: 0,
    dropped_thread: 1,
    contradiction: 2,
    continuity: 3,
    expansion: 4
  };

  const sortedFindings = [...findings].sort((a, b) => {
    return (priority[a.category] ?? 5) - (priority[b.category] ?? 5);
  });

  for (const f of sortedFindings) {
    if (seenTitles.has(f.title)) continue;
    if (prefs.sensitivity === 'gentle' && f.confidence === 'possible_exploration') continue;

    // a thread the writer already tracks: leave it alone if they marked it intentionally open (or
    // resolved, when asked to), otherwise point the finding at it.
    if (f.category === 'dropped_thread') {
      const thread = threads.find(t => (!!f.loopId && t.loopId === f.loopId) || threadMatches(f, t));
      if (thread) {
        if (thread.status === 'intentionally_open') continue;
        if (thread.status === 'resolved' && prefs.ignoreResolvedThreads) continue;
        f.linkedThreadId = thread.id;
      }
    }

    // keep the writer's earlier answer (dismissed, intentional, explained...) when the analysis re-runs.
    const earlier = previous.get(f.id);
    if (earlier && earlier.status !== 'unreviewed' && !earlier.hiddenBy) {
      f.status = earlier.status;
      f.authorExplanation = earlier.authorExplanation;
    }
    if (f.status === 'unreviewed' && f.loopId && handledLoops.has(f.loopId)) f.status = 'dismissed';

    seenTitles.add(f.title);
    uniqueFindings.push(f);
    if (uniqueFindings.length >= maxFindings) break;
  }

  // the timeline's checks are always kept; they come from the events the writer entered, not from a scan.
  uniqueFindings.push(...timelineFindings(project.timeline ?? [], project.chapters, project.findings || []));

  return {
    // what the writer asked not to see stays out of the way, and comes back if the preference goes
    findings: applyPreferences(uniqueFindings, allPreferences(project, options.writerPreferences)),
    establishedFacts,
    authorStyleRules,
    readFacts,
    readPlaces,
    readKnowledge,
    narrativeUnitsCount: units.length
  };
}

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// is this finding about a thread the writer is already tracking?
function threadMatches(finding: AnalysisFinding, thread: PlotThread): boolean {
  const title = plain(thread.title || '');
  if (title.length >= 3 && ` ${plain(`${finding.title} ${finding.summary}`)} `.includes(` ${title} `)) return true;
  const quote = plain(thread.passageQuote || '');
  if (quote.length >= 12) {
    const head = quote.slice(0, 40);
    return finding.evidencePassages.some(p => {
      const evidence = plain(p.quote);
      return evidence.length >= 12 && (evidence.includes(head) || quote.includes(evidence.slice(0, 40)));
    });
  }
  return false;
}

// helpers
function truncateQuote(text: string, maxLen: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen - 3) + '...';
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}
