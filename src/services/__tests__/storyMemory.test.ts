import { describe, it, expect } from 'vitest';
import { performStoryAnalysis, buildStoryContext } from '../storyAnalyzer';
import { applyFindingResponse, applyLoopHandled, loopHandledIds } from '../storyMemory';
import { promiseBoard } from '../coach/features';
import { emptyCoachMemory, normalizeCoachMemory } from '../coach/types';
import type { AnalysisFinding, Chapter, Project } from '../../types';

const quiet = 'The rain kept falling over the quiet town and nobody spoke of it.';
const filler = (n = 3) => Array.from({ length: n }, () => quiet).join(' ');
const p = (text: string) => `<p>${text}</p>`;

const chapter = (i: number, html: string): Chapter => ({
  id: `c${i}`, title: `Chapter ${i + 1}`, order: i + 1, content: html, status: 'draft', wordCount: 0, updatedAt: ''
});

function makeProject(htmlByChapter: string[]): Project {
  return {
    id: 'p1', title: 'Test', author: 'Tester', genre: 'fiction', synopsis: '', draftMode: 'chaptered',
    chapters: htmlByChapter.map((h, i) => chapter(i, h)),
    storyBible: { characters: [], locations: [], lore: [] },
    plotThreads: [], reflections: [], goals: [], comments: [],
    mindMap: { id: 'mm', title: 'Map', nodes: [], edges: [] },
    findings: [],
    memoryVault: { establishedFacts: [], authorStyleRules: [], analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false } },
    createdAt: '', updatedAt: ''
  } as Project;
}

// a story with one question nobody ever answers.
const unansweredQuestion = () => makeProject([
  p('“Who sent this letter?” Dana asked. ' + filler(1)), p(filler()), p(filler()), p(filler())
]);

const scanned = (project: Project): Project => ({ ...project, findings: performStoryAnalysis(project).findings });
const questionFinding = (project: Project): AnalysisFinding => project.findings.find(f => f.id.includes('unresolved-inquiry'))!;

describe('ids that stand for one loop', () => {
  it('gives a question both its board id and its "ask later" id', () => {
    expect(loopHandledIds('board-q-0-abc')).toEqual(['board-q-0-abc', 'ask-q-0-abc']);
    expect(loopHandledIds('board-3-xyz')).toEqual(['board-3-xyz']);
  });
});

describe('answering a finding', () => {
  it('links the finding to its loop', () => {
    const project = scanned(unansweredQuestion());
    expect(questionFinding(project).loopId).toMatch(/^board-q-/);
  });

  it('tells the Coach, so its board stops listing it', () => {
    const project = scanned(unansweredQuestion());
    const finding = questionFinding(project);
    const { coachUnits, index } = buildStoryContext(project);
    expect(promiseBoard(coachUnits, index).some(b => b.id === finding.loopId)).toBe(true);

    const answered = applyFindingResponse(project, finding.id, 'intentional');
    expect(questionFinding(answered).status).toBe('intentional');
    const memory = normalizeCoachMemory(answered.coachMemory, answered.id);
    expect(memory.story.dismissed).toEqual(loopHandledIds(finding.loopId!));
    expect(promiseBoard(coachUnits, index, memory).some(b => b.id === finding.loopId)).toBe(false);
  });

  it('remembers a deliberate choice once, and forgets it when reopened', () => {
    const project = scanned(unansweredQuestion());
    const id = questionFinding(project).id;
    let next = applyFindingResponse(project, id, 'intentional');
    next = applyFindingResponse(next, id, 'intentional');
    expect(next.memoryVault.establishedFacts.filter(f => f.isIntentionalContradiction)).toHaveLength(1);

    const reopened = applyFindingResponse(next, id, 'unreviewed');
    expect(questionFinding(reopened).status).toBe('unreviewed');
    expect(reopened.memoryVault.establishedFacts).toHaveLength(0);
    expect(normalizeCoachMemory(reopened.coachMemory, reopened.id).story.dismissed).toEqual([]);
  });

  it('keeps one style rule per finding when the explanation changes', () => {
    const project = scanned(unansweredQuestion());
    const id = questionFinding(project).id;
    let next = applyFindingResponse(project, id, 'explained', 'I leave questions open on purpose.');
    next = applyFindingResponse(next, id, 'explained', 'The answer comes in the sequel.');
    expect(next.memoryVault.authorStyleRules).toHaveLength(1);
    expect(next.memoryVault.authorStyleRules[0].meaning).toBe('The answer comes in the sequel.');
  });

  it('leaves other people’s coach memory alone', () => {
    const project = scanned(unansweredQuestion());
    const withMemory = { ...project, coachMemory: { ...emptyCoachMemory('p1'), story: { ...emptyCoachMemory('p1').story, dismissed: ['echo-1'] } } };
    const next = applyFindingResponse(withMemory, questionFinding(withMemory).id, 'dismissed');
    expect(normalizeCoachMemory(next.coachMemory, 'p1').story.dismissed).toContain('echo-1');
  });
});

describe('marking a loop handled from the Coach', () => {
  it('settles the matching finding but not one the writer already answered', () => {
    const project = scanned(unansweredQuestion());
    const finding = questionFinding(project);

    const handled = applyLoopHandled(project, finding.loopId!);
    expect(questionFinding(handled).status).toBe('dismissed');

    const answered = applyFindingResponse(project, finding.id, 'intentional');
    expect(questionFinding(applyLoopHandled(answered, finding.loopId!)).status).toBe('intentional');
  });

  it('brings it back again', () => {
    const project = scanned(unansweredQuestion());
    const finding = questionFinding(project);
    const back = applyLoopHandled(applyLoopHandled(project, finding.loopId!), finding.loopId!, false);
    expect(questionFinding(back).status).toBe('unreviewed');
    expect(normalizeCoachMemory(back.coachMemory, back.id).story.dismissed).toEqual([]);
  });
});

describe('the next scan', () => {
  it('shows something the Coach already handled as handled', () => {
    const project = scanned(unansweredQuestion());
    const loopId = questionFinding(project).loopId!;
    const handledInCoach: Project = { ...unansweredQuestion(), coachMemory: applyLoopHandled(project, loopId).coachMemory };
    const rescanned = performStoryAnalysis(handledInCoach).findings.find(f => f.id.includes('unresolved-inquiry'));
    expect(rescanned?.status).toBe('dismissed');
  });
});
