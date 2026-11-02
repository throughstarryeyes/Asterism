import { describe, it, expect } from 'vitest';
import { buildStoryContext, extractNarrativeUnits, htmlToPlainText, performStoryAnalysis } from '../storyAnalyzer';
import type { AnalysisFinding, Chapter, PlotThread, Project, StoryMemoryVault } from '../../types';

// a few quiet sentences with no names, objects or promises in them, so they trigger nothing.
const filler = (sentences = 3) =>
  Array.from({ length: sentences }, () => 'The rain kept falling over the quiet town and nobody spoke of it.').join(' ');

const chapter = (i: number, html: string): Chapter => ({
  id: `c${i}`,
  title: `Chapter ${i + 1}`,
  order: i + 1,
  content: html,
  status: 'draft',
  wordCount: 0,
  updatedAt: ''
});

type Prefs = StoryMemoryVault['analysisPreferences'];

function makeProject(
  htmlByChapter: string[],
  extra: { draftMode?: Project['draftMode']; threads?: PlotThread[]; findings?: AnalysisFinding[]; prefs?: Partial<Prefs> } = {}
): Project {
  return {
    id: 'p1',
    title: 'Test',
    author: 'Tester',
    genre: 'fiction',
    synopsis: '',
    draftMode: extra.draftMode ?? 'chaptered',
    chapters: htmlByChapter.map((html, i) => chapter(i, html)),
    storyBible: { characters: [], locations: [], lore: [] },
    plotThreads: extra.threads ?? [],
    reflections: [],
    goals: [],
    comments: [],
    mindMap: { id: 'mm', title: 'Map', nodes: [], edges: [] },
    findings: extra.findings ?? [],
    memoryVault: {
      establishedFacts: [],
      authorStyleRules: [],
      analysisPreferences: { sensitivity: 'balanced', ignoreResolvedThreads: false, ...extra.prefs }
    },
    createdAt: '',
    updatedAt: ''
  } as Project;
}

const p = (text: string) => `<p>${text}</p>`;
const find = (findings: AnalysisFinding[], idPart: string) => findings.find(f => f.id.includes(idPart));

describe('reading the manuscript text', () => {
  it('strips tags and decodes entities without a browser', () => {
    expect(htmlToPlainText('<p>Tom &amp; Jerry&#39;s &ldquo;plan&rdquo;</p><p>Next</p>')).toBe('Tom & Jerry\'s “plan”\n\nNext');
    expect(htmlToPlainText('')).toBe('');
    expect(htmlToPlainText('<style>p{color:red}</style><p>Kept</p>')).toBe('Kept');
  });
});

describe('narrative units keep the chapter they came from', () => {
  it('attributes each scene of an open draft to its own chapter', () => {
    const project = makeProject(
      [p(filler(2)) + '<hr>' + p(filler(2)), p(filler(2)) + '<hr>' + p(filler(2))],
      { draftMode: 'open_draft' }
    );
    const units = extractNarrativeUnits(project);
    expect(units.map(u => u.originalChapterId)).toEqual(['c0', 'c0', 'c1', 'c1']);
    expect(units.map(u => u.unitIndex)).toEqual([0, 1, 2, 3]);
  });

  it('cuts a long divider-free chapter into beats that still point at that chapter', () => {
    const long = Array.from({ length: 40 }, () => p(filler(3))).join('');
    const units = extractNarrativeUnits(makeProject([long], { draftMode: 'open_draft' }));
    expect(units.length).toBeGreaterThan(1);
    expect(units.every(u => u.originalChapterId === 'c0')).toBe(true);
  });
});

describe('objects that disappear', () => {
  const chapters = (laterMention?: string) => [
    p(filler()),
    p('She slipped the key into her pocket and walked on. ' + filler(1)),
    p(filler()),
    p(laterMention ?? filler())
  ];

  it('flags an item that never comes back, pointing at the chapter that introduced it', () => {
    const { findings } = performStoryAnalysis(makeProject(chapters(), { draftMode: 'open_draft' }));
    const key = find(findings, 'chekhov-item-key');
    expect(key).toBeDefined();
    expect(key!.evidencePassages[0].chapterId).toBe('c1');
  });

  it('does not flag an item that is mentioned again later, even without a hiding moment', () => {
    const { findings } = performStoryAnalysis(makeProject(chapters(p('Nobody had seen the key since that night.'))));
    expect(find(findings, 'chekhov-item-key')).toBeUndefined();
  });
});

describe('questions left hanging', () => {
  const question = p('“Who sent this letter?” Mara whispered. ' + filler(1));
  const base = (later: string) => [question, p(filler()), p(filler()), p(later), p(filler())];

  it('flags a question that nothing later returns to, even if one everyday word shows up again', () => {
    const { findings } = performStoryAnalysis(makeProject(base('The letter weighed nothing in her hand. ' + filler(1))));
    const f = find(findings, 'unresolved-inquiry');
    expect(f).toBeDefined();
    expect(f!.evidencePassages[0].chapterId).toBe('c0');
    // worded as a question to the writer, not a verdict.
    expect(f!.summary).toMatch(/couldn't find/i);
  });

  it('accepts a later sentence that picks the question back up', () => {
    const { findings } = performStoryAnalysis(makeProject(base('Mara finally learned who sent the letter. ' + filler(1))));
    expect(find(findings, 'unresolved-inquiry')).toBeUndefined();
  });
});

describe('promises', () => {
  const promise = p('“I\'ll meet you at the harbor at dawn.” she said. ' + filler(1));

  it('flags a promise whose place and time are never mentioned again', () => {
    const { findings } = performStoryAnalysis(makeProject([promise, p(filler()), p(filler()), p(filler())]));
    expect(find(findings, 'unfulfilled-promise')).toBeDefined();
  });

  it('does not flag it when a later scene is about the same place', () => {
    const { findings } = performStoryAnalysis(makeProject([promise, p(filler()), p('They reached the harbor together. ' + filler(1)), p(filler())]));
    expect(find(findings, 'unfulfilled-promise')).toBeUndefined();
  });
});

describe('characters', () => {
  it('counts "Mara’s" as Mara', () => {
    const early = p('Dana admired Mara’s coat. Dana envied Mara’s boots. ' + filler(1));
    const { findings } = performStoryAnalysis(makeProject([early, p(filler()), p(filler()), p(filler()), p(filler())]));
    expect(find(findings, 'dropped-character-mara')).toBeDefined();
    expect(findings.some(f => /Maras/.test(f.title))).toBe(false);
  });

  const greenEyes = p('Dana nodded at Mara. Mara had green eyes. ' + filler(1));

  it('flags two different eye colors for the same person', () => {
    const second = p('Dana waved at Mara. Mara blinked her brown eyes slowly. ' + filler(1));
    const { findings } = performStoryAnalysis(makeProject([greenEyes, p(filler()), second, p(filler())]));
    const f = find(findings, 'contradiction-eyes-mara');
    expect(f).toBeDefined();
    expect(f!.evidencePassages.map(e => e.chapterId)).toEqual(['c0', 'c2']);
  });

  it('does not hand a sentence about someone else’s eyes to the last person named', () => {
    const portrait = p('Dana waved at Mara. Mara stared at the portrait. The brown eyes in the painting stared back. ' + filler(1));
    const { findings } = performStoryAnalysis(makeProject([greenEyes, p(filler()), portrait, p(filler())]));
    expect(find(findings, 'contradiction-eyes')).toBeUndefined();
  });
});

describe('the writer’s settings and answers', () => {
  const keyBook = () => [
    p(filler()),
    p('She slipped the key into her pocket and walked on. ' + filler(1)),
    p(filler()),
    p(filler())
  ];
  const thread = (status: PlotThread['status']): PlotThread => ({
    id: 't1', title: 'Key', type: 'mystery', status, notes: '', importance: 'major', createdAt: '', updatedAt: ''
  });

  it('leaves a thread alone when the writer marked it intentionally open', () => {
    const { findings } = performStoryAnalysis(makeProject(keyBook(), { threads: [thread('intentionally_open')] }));
    expect(find(findings, 'chekhov-item-key')).toBeUndefined();
  });

  it('points a finding at the thread the writer already tracks', () => {
    const { findings } = performStoryAnalysis(makeProject(keyBook(), { threads: [thread('simmering')] }));
    expect(find(findings, 'chekhov-item-key')?.linkedThreadId).toBe('t1');
  });

  it('skips resolved threads only when asked to', () => {
    const keep = performStoryAnalysis(makeProject(keyBook(), { threads: [thread('resolved')] })).findings;
    expect(find(keep, 'chekhov-item-key')).toBeDefined();
    const skip = performStoryAnalysis(makeProject(keyBook(), { threads: [thread('resolved')], prefs: { ignoreResolvedThreads: true } })).findings;
    expect(find(skip, 'chekhov-item-key')).toBeUndefined();
  });

  it('keeps an earlier answer when the analysis runs again', () => {
    const first = performStoryAnalysis(makeProject(keyBook())).findings;
    const key = find(first, 'chekhov-item-key')!;
    const answered = [{ ...key, status: 'dismissed' as const, authorExplanation: 'It is a red herring.' }];
    const again = performStoryAnalysis(makeProject(keyBook(), { findings: answered })).findings;
    const kept = find(again, 'chekhov-item-key')!;
    expect(kept.status).toBe('dismissed');
    expect(kept.authorExplanation).toBe('It is a red herring.');
  });

  const shaken = [p('He checked the locks twice. He checked the locks again. He checked the locks once more. ' + filler(1))];

  it('shows speculative notes by default and hides them on gentle', () => {
    expect(find(performStoryAnalysis(makeProject(shaken)).findings, 'trauma-pattern')).toBeDefined();
    const gentle = performStoryAnalysis(makeProject(shaken, { prefs: { sensitivity: 'gentle' } })).findings;
    expect(find(gentle, 'trauma-pattern')).toBeUndefined();
  });

  it('writes clean dashes, not garbled ones', () => {
    const trauma = find(performStoryAnalysis(makeProject(shaken)).findings, 'trauma-pattern')!;
    expect(trauma.summary).toContain('—');
    expect(trauma.summary).not.toMatch(/â|€/);
  });
});

describe('drafting notes', () => {
  it('finds placeholders in the right chapter', () => {
    const { findings } = performStoryAnalysis(makeProject([p(filler()), p('[insert fight scene here] ' + filler(1))]));
    const note = findings.find(f => f.category === 'drafting_note');
    expect(note?.evidencePassages[0].chapterId).toBe('c1');
  });
});

describe('one reading of the manuscript for the scan and the Coach', () => {
  it('hands the Coach the same scenes, each tied to its real chapter', () => {
    const project = makeProject(
      [p(filler(2)) + '<hr>' + p(filler(2)), p(filler(2))],
      { draftMode: 'open_draft' }
    );
    const { units, coachUnits } = buildStoryContext(project);
    expect(coachUnits.map(u => u.id)).toEqual(units.map(u => u.id));
    expect(coachUnits.map(u => u.index)).toEqual([0, 1, 2]);
    expect(coachUnits.map(u => u.chapterId)).toEqual(['c0', 'c0', 'c1']);
  });

  it('reads chapters in their reading order, not the order they are stored in', () => {
    const project = makeProject([p(filler()), p(filler())]);
    project.chapters[0].order = 2;
    project.chapters[1].order = 1;
    expect(buildStoryContext(project).coachUnits.map(u => u.chapterId)).toEqual(['c1', 'c0']);
  });

  it('treats a nickname the text spells out as the same person', () => {
    const project = makeProject([p('My name is Margaret, but call me Maggie. Dana smiled at Margaret. Maggie waved at Dana. ' + filler(1))]);
    const { index } = buildStoryContext(project);
    const owners = index.entities.filter(e => [e.canonical, ...e.aliases].includes('Maggie'));
    expect(owners).toHaveLength(1);
    expect([owners[0].canonical, ...owners[0].aliases]).toContain('Margaret');
  });

  it('finds a Story Bible character by first name', () => {
    const project = makeProject([p('Dana nodded at Mara. Mara left. ' + filler(1))]);
    project.storyBible.characters = [{ id: 'ch1', name: 'Mara Voss' } as unknown as Project['storyBible']['characters'][number]];
    const mara = buildStoryContext(project).index.entities.find(e => e.canonical === 'Mara Voss');
    expect(mara).toBeDefined();
    expect(mara!.mentions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('nicknames entered in the Story Bible', () => {
  const asCharacter = (c: object) => c as unknown as Project['storyBible']['characters'][number];

  it('keeps a nickname from showing up as a separate person', () => {
    const project = makeProject([p('Dana hugged Margaret. Maggie laughed with Dana. Then Mags told Dana a joke. ' + filler(1))]);
    project.storyBible.characters = [asCharacter({ id: 'ch1', name: 'Margaret', aliases: ['Maggie', 'Mags'] })];
    const { index } = buildStoryContext(project);
    const spellings = ['Margaret', 'Maggie', 'Mags'];
    const owners = index.entities.filter(e => [e.canonical, ...e.aliases].some(n => spellings.includes(n)));
    expect(owners).toHaveLength(1);
    expect(owners[0].canonical).toBe('Margaret');
    expect(owners[0].mentions.length).toBeGreaterThanOrEqual(3);
  });

  it('counts the nickname as the same person when checking eye color', () => {
    const project = makeProject([
      p('Dana hugged Margaret. Margaret had green eyes. ' + filler(1)),
      p(filler()),
      p('Dana laughed with Maggie. Maggie blinked her brown eyes. ' + filler(1))
    ]);
    project.storyBible.characters = [asCharacter({ id: 'ch1', name: 'Margaret', aliases: ['Maggie'] })];
    const { findings } = performStoryAnalysis(project);
    expect(find(findings, 'contradiction-eyes-margaret')).toBeDefined();
  });
});
