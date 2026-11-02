import { describe, it, expect } from 'vitest';
import { buildStoryContext, performStoryAnalysis } from '../storyAnalyzer';
import { detectOpenLoops, type OpenLoop } from '../openLoops';
import { normalizeCoachMemory } from '../coach/types';
import {
  addExpectation, linkKey, linkPassage, rejectLink, removeExpectation, removeThread, saveThread,
  setExpectationStatus, suggestFollowUps, suggestForExpectation, threadFromLoop, threadProgress, trackLoop, unlinkPassage
} from '../threads';
import type { Chapter, PlotThread, Project } from '../../types';

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

// a question that nothing answers.
const open = () => makeProject([p('“Who sent this letter?” Dana asked. ' + filler(1)), p(filler()), p(filler()), p(filler())]);
// the same question, picked up two chapters later.
const followed = () => makeProject([
  p('“Who sent this letter?” Dana asked. ' + filler(1)), p(filler()), p('Dana finally learned who sent the letter. ' + filler(1)), p(filler())
]);

const questionLoop = (project: Project): OpenLoop => {
  const { coachUnits, index } = buildStoryContext(project);
  return detectOpenLoops(coachUnits, index).find(l => l.kind === 'question')!;
};
const withFindings = (project: Project): Project => ({ ...project, findings: performStoryAnalysis(project).findings });

describe('starting a thread from a loop', () => {
  it('carries the passage, the chapter and a starting expectation', () => {
    const thread = threadFromLoop(questionLoop(open()));
    expect(thread.type).toBe('unanswered_question');
    expect(thread.status).toBe('introduced');
    expect(thread.title).toBe('Who sent this letter?');
    expect(thread.introducedInChapterId).toBe('c0');
    expect(thread.passageQuote).toContain('Who sent this letter');
    expect(thread.loopId).toBe(questionLoop(open()).id);
    expect(thread.expectations).toHaveLength(1);
    expect(thread.expectations![0].status).toBe('open');
  });

  it('is one thread per loop, however many times it is tracked', () => {
    const project = withFindings(open());
    const loop = questionLoop(project);
    const first = trackLoop(project, loop);
    const second = trackLoop(first.project, loop);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.project.plotThreads).toHaveLength(1);
  });

  it('links the finding about the loop to the new thread', () => {
    const project = withFindings(open());
    const { project: tracked, thread } = trackLoop(project, questionLoop(project));
    expect(tracked.findings.find(f => f.loopId === thread.loopId)?.linkedThreadId).toBe(thread.id);
  });
});

describe('settling a thread', () => {
  const tracked = () => {
    const project = withFindings(open());
    const { project: next, thread } = trackLoop(project, questionLoop(project));
    return { project: next, thread };
  };
  const finding = (project: Project) => project.findings.find(f => f.loopId)!;
  const handled = (project: Project) => normalizeCoachMemory(project.coachMemory, project.id).story.dismissed;

  it('marking it intentionally open settles the loop for the Analyzer and the Coach', () => {
    const { project, thread } = tracked();
    const next = saveThread(project, { ...thread, status: 'intentionally_open' });
    expect(finding(next).status).toBe('dismissed');
    expect(handled(next)).toContain(thread.loopId);
  });

  it('bringing it back to life brings the loop back', () => {
    const { project, thread } = tracked();
    const settled = saveThread(project, { ...thread, status: 'resolved' });
    const reopened = saveThread(settled, { ...thread, status: 'simmering' });
    expect(finding(reopened).status).toBe('unreviewed');
    expect(handled(reopened)).toEqual([]);
  });

  it('does not touch a loop the writer handled themselves when a thread merely moves between active states', () => {
    const { project, thread } = tracked();
    const next = saveThread(project, { ...thread, status: 'simmering' });
    expect(finding(next).status).toBe('unreviewed');
  });

  it('keeps a tracked thread out of the next scan when it is intentionally open', () => {
    const { project, thread } = tracked();
    const settled = saveThread(project, { ...thread, status: 'intentionally_open' });
    const rescanned = performStoryAnalysis(settled).findings;
    expect(rescanned.some(f => f.loopId === thread.loopId)).toBe(false);
  });

  it('removing a thread unlinks its findings', () => {
    const { project, thread } = tracked();
    const gone = removeThread(project, thread.id);
    expect(gone.plotThreads).toHaveLength(0);
    expect(finding(gone).linkedThreadId).toBeUndefined();
  });
});

describe('passages the writer confirms', () => {
  const base = (): PlotThread => threadFromLoop(questionLoop(open()));

  it('links a passage once and lets it go', () => {
    const quote = 'Dana finally learned who sent the letter.';
    let thread = linkPassage(base(), { chapterId: 'c2', quote, role: 'payoff' });
    thread = linkPassage(thread, { chapterId: 'c2', quote: quote.toUpperCase(), role: 'payoff' });
    expect(thread.passages).toHaveLength(1);
    expect(unlinkPassage(thread, thread.passages![0].id).passages).toHaveLength(0);
  });

  it('forgets a rejection when the writer links that passage by hand', () => {
    const quote = 'Dana finally learned who sent the letter.';
    let thread = rejectLink(base(), 'c2', quote);
    expect(thread.rejectedLinks).toContain(linkKey('c2', quote));
    thread = linkPassage(thread, { chapterId: 'c2', quote, role: 'development' });
    expect(thread.rejectedLinks).not.toContain(linkKey('c2', quote));
  });
});

describe('suggested follow-ups', () => {
  it('finds the later passage that picks the thread up, and nothing before it', () => {
    const project = followed();
    const { coachUnits, index } = buildStoryContext(project);
    const suggestions = suggestFollowUps(threadFromLoop(questionLoop(project)), coachUnits, index);
    expect(suggestions.map(s => s.chapterId)).toEqual(['c2']);
    expect(suggestions[0].sentence).toContain('who sent the letter');
  });

  it('suggests nothing when no later passage is about it', () => {
    const project = open();
    const { coachUnits, index } = buildStoryContext(project);
    expect(suggestFollowUps(threadFromLoop(questionLoop(project)), coachUnits, index)).toEqual([]);
  });

  it('stops suggesting a passage once it is linked or turned down', () => {
    const project = followed();
    const { coachUnits, index } = buildStoryContext(project);
    const thread = threadFromLoop(questionLoop(project));
    const [s] = suggestFollowUps(thread, coachUnits, index);
    const linked = linkPassage(thread, { chapterId: s.chapterId, quote: s.sentence, role: 'payoff' });
    expect(suggestFollowUps(linked, coachUnits, index)).toEqual([]);
    expect(suggestFollowUps(rejectLink(thread, s.chapterId, s.sentence), coachUnits, index)).toEqual([]);
  });

  it('suggests where an expectation might be delivered', () => {
    const project = followed();
    const { coachUnits, index } = buildStoryContext(project);
    const thread = addExpectation(threadFromLoop(questionLoop(project)), 'Dana learns who sent the letter');
    const expectation = thread.expectations![1];
    expect(suggestForExpectation(thread, expectation, coachUnits, index).map(s => s.chapterId)).toEqual(['c2']);
  });
});

describe('expectations', () => {
  it('can be added, met, abandoned and removed, and are counted', () => {
    let thread = threadFromLoop(questionLoop(open()));
    thread = addExpectation(thread, '  Dana confronts the sender  ');
    thread = addExpectation(thread, '   ');
    expect(thread.expectations).toHaveLength(2);

    const [starter, added] = thread.expectations!;
    thread = setExpectationStatus(thread, starter.id, 'fulfilled');
    thread = setExpectationStatus(thread, added.id, 'abandoned');
    expect(threadProgress(thread)).toMatchObject({ expectations: 2, fulfilled: 1, open: 0 });

    expect(removeExpectation(thread, added.id).expectations).toHaveLength(1);
  });
});
