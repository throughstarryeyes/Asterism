import type { AnalysisFinding, AuthorStyleRule, EstablishedFact, Project } from '../types';
import { normalizeCoachMemory } from './coach/types';

// the writer's answers in one place: marking an open loop updates both the finding and the coach's handled list
// each function takes a project and returns the changed project

type Status = AnalysisFinding['status'];

// the ids that stand for one open loop in the coach's handled list. a question also reaches the
// coach as an "ask later" nudge whose id is derived from the board item's.
export function loopHandledIds(loopId: string): string[] {
  return loopId.startsWith('board-q-') ? [loopId, `ask-${loopId.slice('board-'.length)}`] : [loopId];
}

function withLoopHandled(project: Project, loopId: string, handled: boolean): Project['coachMemory'] {
  const memory = normalizeCoachMemory(project.coachMemory, project.id);
  const ids = loopHandledIds(loopId);
  const current = memory.story.dismissed;
  const dismissed = handled
    ? [...current, ...ids.filter(id => !current.includes(id))]
    : current.filter(id => !ids.includes(id));
  return { ...memory, story: { ...memory.story, dismissed } };
}

// what the writer said about a finding. "unreviewed" takes the answer back.
export function applyFindingResponse(project: Project, findingId: string, status: Status, authorExplanation?: string): Project {
  const finding = (project.findings || []).find(f => f.id === findingId);
  if (!finding) return project;

  const findings = (project.findings || []).map(f => (f.id === findingId ? { ...f, status, authorExplanation } : f));

  // what an earlier answer to this finding left behind is replaced, so answering twice (or
  // reopening) never piles up duplicates.
  const factId = `fact-intent-${findingId}`;
  const ruleId = `rule-${findingId}`;
  let establishedFacts: EstablishedFact[] = (project.memoryVault.establishedFacts || []).filter(f => f.id !== factId);
  let authorStyleRules: AuthorStyleRule[] = (project.memoryVault.authorStyleRules || []).filter(r => r.id !== ruleId);

  if (status === 'explained' && authorExplanation) {
    // teach the analyzer how this writer does things.
    authorStyleRules = [
      { id: ruleId, pattern: finding.title, meaning: authorExplanation, examplesCount: 1, lastUpdated: new Date().toISOString() },
      ...authorStyleRules
    ];
  } else if (status === 'intentional') {
    // a deliberate choice: remember it as one.
    establishedFacts = [
      {
        id: factId,
        subject: finding.title,
        claim: 'Deliberate authorial ambiguity or unreliable narrator choice',
        sourceChapterId: finding.evidencePassages[0]?.chapterId || '',
        sourceQuote: finding.evidencePassages[0]?.quote || '',
        isIntentionalContradiction: true
      },
      ...establishedFacts
    ];
  }

  return {
    ...project,
    findings,
    memoryVault: { ...project.memoryVault, establishedFacts, authorStyleRules },
    coachMemory: finding.loopId ? withLoopHandled(project, finding.loopId, status !== 'unreviewed') : project.coachMemory
  };
}

// the writer marked an open loop handled (or brought it back) from the coach. any finding about
// the same loop that they have not answered follows.
export function applyLoopHandled(project: Project, loopId: string, handled = true): Project {
  const findings = (project.findings || []).map(f => {
    if (f.loopId !== loopId) return f;
    if (handled && f.status === 'unreviewed') return { ...f, status: 'dismissed' as const };
    if (!handled && f.status === 'dismissed') return { ...f, status: 'unreviewed' as const };
    return f;
  });
  return { ...project, findings, coachMemory: withLoopHandled(project, loopId, handled) };
}
