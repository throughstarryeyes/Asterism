import type { Project } from '../types';
import { buildStoryContext, performStoryAnalysis, type ManuscriptSource, type StoryAnalysisResult, type StoryContext } from './storyAnalyzer';

// the slow readings of a manuscript, as requests that can run anywhere: on a background worker, or on the page if there is none
// everything going in and out is plain data, so it can cross to the worker and back

export type AnalysisRequest =
  | { op: 'read'; source: ManuscriptSource }
  | { op: 'scan'; project: Project; options: Parameters<typeof performStoryAnalysis>[1] };

export type AnalysisResult<R extends AnalysisRequest> = R extends { op: 'read' } ? StoryContext : StoryAnalysisResult;

export function handleRequest<R extends AnalysisRequest>(request: R): AnalysisResult<R>;
export function handleRequest(request: AnalysisRequest): StoryContext | StoryAnalysisResult {
  return request.op === 'read' ? buildStoryContext(request.source) : performStoryAnalysis(request.project, request.options);
}
