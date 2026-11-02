import { describe, it, expect } from 'vitest';
import {
  allPreferences, applyPreferences, applyVerdict, checkOf, describePreference, reopenFinding, suggestions,
  type AnalyzerPreference, type FindingFeedback,
} from '../analyzerFeedback';
import { performStoryAnalysis } from '../storyAnalyzer';
import type { AnalysisFinding, Project } from '../../types';

const finding = (id: string, over: Partial<AnalysisFinding> = {}): AnalysisFinding => ({
  id, category: 'dropped_thread', title: id, summary: '', evidencePassages: [], confidence: 'probable', status: 'unreviewed', ...over,
});

const project = (findings: AnalysisFinding[], vault: Partial<Project['memoryVault']> = {}): Project => ({
  id: 'p', title: 'T', author: 'A', genre: '', synopsis: '', chapters: [], plotThreads: [], findings, storyBible: { characters: [], locations: [], lore: [] },
  memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false }, ...vault },
} as unknown as Project);

const pref = (over: Partial<AnalyzerPreference> = {}): AnalyzerPreference =>
  ({ id: 'pref-1', check: 'sidelined', scope: 'project', enabled: true, createdAt: '2026-01-01', ...over });

describe('which check a finding came from', () => {
  it('reads it from the id, and the character from the finding', () => {
    expect(checkOf(finding('finding-dropped-character-corin', { subject: 'Corin' }))).toEqual({ check: 'sidelined', subject: 'Corin' });
    expect(checkOf(finding('finding-charfact-age-mara'))).toMatchObject({ check: 'age' });
    expect(checkOf(finding('finding-contradiction-eyes-mara'))).toMatchObject({ check: 'physical' });
    expect(checkOf(finding('finding-knows-mara-treaty'))).toMatchObject({ check: 'knowledge' });
    expect(checkOf(finding('something-new', { category: 'expansion' }))).toMatchObject({ check: 'expansion' });
  });
});

describe('answering a finding', () => {
  const base = () => project([finding('finding-dropped-character-corin', { subject: 'Corin' }), finding('finding-dropped-character-mara', { subject: 'Mara' })]);

  it('sets the status, and keeps the answer in a log apart from any preference', () => {
    const { project: out, preference } = applyVerdict(base(), 'finding-dropped-character-corin', 'intentional', { now: 'T1' });
    expect(out.findings[0].status).toBe('intentional');
    expect(out.memoryVault.feedback).toEqual([expect.objectContaining({ findingId: 'finding-dropped-character-corin', check: 'sidelined', subject: 'Corin', verdict: 'intentional', learn: true, at: 'T1' })]);
    expect(preference).toBeUndefined();
    expect(out.memoryVault.preferences ?? []).toEqual([]);
  });

  it('answering twice replaces the earlier answer', () => {
    const once = applyVerdict(base(), 'finding-dropped-character-corin', 'correct').project;
    const twice = applyVerdict(once, 'finding-dropped-character-corin', 'not_relevant').project;
    expect(twice.memoryVault.feedback).toHaveLength(1);
    expect(twice.memoryVault.feedback![0].verdict).toBe('not_relevant');
    expect(twice.findings[0].status).toBe('dismissed');
  });

  it('makes a preference only when "not relevant" is given a reach', () => {
    const only = applyVerdict(base(), 'finding-dropped-character-corin', 'not_relevant', { scope: 'passage' });
    expect(only.preference).toBeUndefined();

    const character = applyVerdict(base(), 'finding-dropped-character-corin', 'not_relevant', { scope: 'character' });
    expect(character.preference).toMatchObject({ scope: 'character', check: 'sidelined', subject: 'Corin', enabled: true });
    expect(character.project.memoryVault.preferences).toHaveLength(1);

    const global = applyVerdict(base(), 'finding-dropped-character-corin', 'not_relevant', { scope: 'global' });
    expect(global.preference).toMatchObject({ scope: 'global', subject: undefined });
    expect(global.project.memoryVault.preferences ?? []).toEqual([]); // kept with the writer, not the project
  });

  it('"just this one" teaches nothing, even if a reach was asked for', () => {
    const out = applyVerdict(base(), 'finding-dropped-character-corin', 'not_relevant', { scope: 'project', learn: false });
    expect(out.preference).toBeUndefined();
    expect(out.project.memoryVault.feedback![0].learn).toBe(false);
  });

  it('turns a misreading into a note the analyzer keeps, and reopening forgets the answer', () => {
    const out = applyVerdict(base(), 'finding-dropped-character-corin', 'misunderstood', { note: 'He is only away, not gone' }).project;
    expect(out.findings[0]).toMatchObject({ status: 'explained', authorExplanation: 'He is only away, not gone' });
    expect(out.memoryVault.authorStyleRules.some(r => r.meaning === 'He is only away, not gone')).toBe(true);

    const back = reopenFinding(out, 'finding-dropped-character-corin');
    expect(back.findings[0].status).toBe('unreviewed');
    expect(back.memoryVault.feedback).toEqual([]);
  });
});

describe('preferences', () => {
  const list = [
    finding('finding-dropped-character-corin', { subject: 'Corin' }),
    finding('finding-dropped-character-mara', { subject: 'Mara' }),
    finding('finding-unresolved-inquiry-1', { category: 'dropped_thread' }),
  ];

  it('hides what a project preference covers, and only that kind', () => {
    const out = applyPreferences(list, [pref()]);
    expect(out.map(f => f.status)).toEqual(['dismissed', 'dismissed', 'unreviewed']);
    expect(out[0].hiddenBy).toBe('pref-1');
  });

  it('a character preference covers only that character, ignoring case', () => {
    const out = applyPreferences(list, [pref({ scope: 'character', subject: 'corin' })]);
    expect(out.map(f => f.status)).toEqual(['dismissed', 'unreviewed', 'unreviewed']);
  });

  it('brings findings back when the preference is removed or switched off', () => {
    const hidden = applyPreferences(list, [pref()]);
    expect(applyPreferences(hidden, []).map(f => f.status)).toEqual(['unreviewed', 'unreviewed', 'unreviewed']);
    expect(applyPreferences(hidden, [pref({ enabled: false })]).every(f => f.status === 'unreviewed' && !f.hiddenBy)).toBe(true);
  });

  it('leaves a finding the writer already answered alone', () => {
    const answered = [finding('finding-dropped-character-corin', { subject: 'Corin', status: 'confirmed' })];
    expect(applyPreferences(answered, [pref()])[0].status).toBe('confirmed');
  });

  it('is applied when the analyzer scans, from the project and from the writer, and undone by removing it', () => {
    const p = project(list, { preferences: [pref({ id: 'pref-p', check: 'questions' })] });
    const scanned = performStoryAnalysis({ ...p, chapters: [{ id: 'c', title: 'One', order: 1, wordCount: 5, status: 'draft', content: '<p>Nobody had seen the key since that night. It was gone.</p>', updatedAt: '' }] as never }, { writerPreferences: [pref({ id: 'pref-w', check: 'draft-notes', scope: 'global' })] });
    expect(scanned.findings.filter(f => f.hiddenBy).every(f => ['pref-p', 'pref-w'].includes(f.hiddenBy!))).toBe(true);
  });

  it('describes a preference in plain words', () => {
    expect(describePreference(pref({ scope: 'character', subject: 'Corin' }))).toBe('Hide sidelined characters about Corin');
    expect(describePreference(pref())).toBe('Hide sidelined characters in this project');
    expect(describePreference(pref({ scope: 'global', check: 'questions' }))).toBe('Hide unanswered questions in every project');
    expect(allPreferences(project([], { preferences: [pref()] }), [pref({ id: 'g', scope: 'global' })]).map(p => p.id)).toEqual(['pref-1', 'g']);
  });
});

describe('suggestions', () => {
  const fb = (check: string, n: number, over: Partial<FindingFeedback> = {}): FindingFeedback[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${check}-${i}`, findingId: `${check}-${i}`, check, verdict: 'not_relevant', learn: true, at: '', ...over }));

  it('offers to stop showing a kind the writer keeps dismissing one at a time', () => {
    expect(suggestions(fb('sidelined', 3), [])).toEqual([{ key: 'suggest:sidelined', check: 'sidelined', count: 3 }]);
    expect(suggestions(fb('sidelined', 2), [])).toEqual([]);
  });

  it('does not count "just this one", other verdicts, or what a preference already covers', () => {
    expect(suggestions(fb('sidelined', 3, { learn: false }), [])).toEqual([]);
    expect(suggestions(fb('sidelined', 3, { verdict: 'correct' }), [])).toEqual([]);
    expect(suggestions(fb('sidelined', 3), [pref()])).toEqual([]);
    expect(suggestions(fb('sidelined', 3), [pref({ scope: 'character', subject: 'Corin' })])).toHaveLength(1);
  });

  it('stays quiet once the writer says no thanks', () => {
    expect(suggestions(fb('sidelined', 5), [], ['suggest:sidelined'])).toEqual([]);
  });
});

describe('misread answers that change what the analyzer sees', () => {
  const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';
  const chapters = (htmls: string[]) => htmls.map((html, i) => ({ id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: `<p>${html}</p>`, status: 'draft', wordCount: 0, updatedAt: '' }));
  const story = (preferences: AnalyzerPreference[] = []): Project => ({
    ...project([], { preferences }),
    draftMode: 'chaptered',
    chapters: chapters([
      `Dana admired Mara’s coat. Dana envied Mara’s boots. ${quiet}`,
      quiet, quiet, quiet,
      `Imogen opened the door and Imogen smiled. ${quiet}`,
    ]),
  } as unknown as Project);
  const sidelined = (p: Project, name: string) => performStoryAnalysis(p).findings.find(f => f.id === `finding-dropped-character-${name.toLowerCase()}`);

  it('without a rule, Mara looks sidelined', () => {
    expect(sidelined(story(), 'mara')).toBeDefined();
  });

  it('knows two names are one person once the writer says so', () => {
    const rule = pref({ id: 'pref-same-mara-imogen', check: 'cast', kind: 'same-person', subject: 'Mara', other: 'Imogen' });
    expect(sidelined(story([rule]), 'mara')).toBeUndefined();
    expect(sidelined(story([{ ...rule, enabled: false }]), 'mara')).toBeDefined(); // switching it off brings it back
  });

  it('stops treating a name as a character', () => {
    const rule = pref({ id: 'pref-notchar-mara', check: 'cast', kind: 'not-character', subject: 'Mara' });
    expect(sidelined(story([rule]), 'mara')).toBeUndefined();
  });

  it('turns a misread answer into a rule, and asks for a new reading only when the cast changed', () => {
    const base = project([finding('finding-dropped-character-mara', { subject: 'Mara', evidencePassages: [{ chapterId: 'c0', chapterTitle: 'One', quote: 'Dana admired Mara’s coat.' }] })]);
    const same = applyVerdict(base, 'finding-dropped-character-mara', 'misunderstood', { note: 'She is Imogen later', fix: { kind: 'same-person', other: 'Imogen' } });
    expect(same.rescan).toBe(true);
    expect(same.preference).toMatchObject({ kind: 'same-person', subject: 'Mara', other: 'Imogen', scope: 'project' });
    expect(same.project.memoryVault.preferences).toHaveLength(1);

    const notChar = applyVerdict(base, 'finding-dropped-character-mara', 'misunderstood', { fix: { kind: 'not-character' } });
    expect(notChar.rescan).toBe(true);

    const phrase = applyVerdict(base, 'finding-dropped-character-mara', 'misunderstood', { fix: { kind: 'phrase', phrase: 'admired Mara’s coat' } });
    expect(phrase.rescan).toBe(false);
    expect(phrase.preference).toMatchObject({ kind: 'phrase', check: 'sidelined' });
  });

  it('refuses a rule that cannot work, and learns nothing from "just this one"', () => {
    const base = project([finding('finding-dropped-character-mara', { subject: 'Mara' }), finding('finding-unresolved-inquiry-1')]);
    const tooShort = applyVerdict(base, 'finding-unresolved-inquiry-1', 'misunderstood', { fix: { kind: 'phrase', phrase: 'the' } });
    expect(tooShort.preference).toBeUndefined();
    const itself = applyVerdict(base, 'finding-dropped-character-mara', 'misunderstood', { fix: { kind: 'same-person', other: 'mara' } });
    expect(itself.preference).toBeUndefined();
    const noSubject = applyVerdict(base, 'finding-unresolved-inquiry-1', 'misunderstood', { fix: { kind: 'not-character' } });
    expect(noSubject.preference).toBeUndefined();
    const once = applyVerdict(base, 'finding-dropped-character-mara', 'misunderstood', { learn: false, fix: { kind: 'not-character' } });
    expect(once.preference).toBeUndefined();
  });

  it('a phrase rule hides other findings of that kind whose quote has the wording', () => {
    const quote = (text: string) => [{ chapterId: 'c', chapterTitle: 'C', quote: text }];
    const list = [
      finding('finding-unresolved-inquiry-a', { evidencePassages: quote('She wondered if anyone had seen the key.') }),
      finding('finding-unresolved-inquiry-b', { evidencePassages: quote('Who sent the letter?') }),
      finding('finding-unfulfilled-promise-c', { evidencePassages: quote('She wondered if anyone had seen the key.') }),
    ];
    const rule = pref({ id: 'pref-phrase', check: 'questions', kind: 'phrase', phrase: 'Anyone had seen' });
    expect(applyPreferences(list, [rule]).map(f => f.status)).toEqual(['dismissed', 'unreviewed', 'unreviewed']);
    expect(describePreference(rule)).toBe('Ignore unanswered questions that mention “Anyone had seen”');
  });

  it('describes the cast rules in plain words, and a hide suggestion ignores them', () => {
    expect(describePreference(pref({ kind: 'same-person', check: 'cast', subject: 'Mara', other: 'Imogen' }))).toBe('Treat Mara and Imogen as one person');
    expect(describePreference(pref({ kind: 'not-character', check: 'cast', subject: 'Tuesday' }))).toBe('Don’t treat “Tuesday” as a character');
    const fb: FindingFeedback[] = Array.from({ length: 3 }, (_, i) => ({ id: `${i}`, findingId: `${i}`, check: 'questions', verdict: 'not_relevant', learn: true, at: '' }));
    expect(suggestions(fb, [pref({ kind: 'phrase', check: 'questions', phrase: 'something long' })])).toHaveLength(1);
  });
});
