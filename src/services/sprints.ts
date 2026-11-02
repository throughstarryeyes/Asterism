import type { SprintRecord } from '../types';

// finished sprints live inside their document (project.sprints), so syncing the document syncs them too.
// the list is capped so a long-lived document does not grow forever.

export const MAX_SPRINTS = 200;

export function addSprint(list: SprintRecord[] | undefined, made: Omit<SprintRecord, 'id' | 'at'>, now = new Date()): SprintRecord[] {
  const record: SprintRecord = { id: `sprint-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: now.toISOString(), ...made };
  return [...(list ?? []), record].slice(-MAX_SPRINTS);
}

export function sprintTotals(list: SprintRecord[] | undefined) {
  const all = list ?? [];
  return { count: all.length, words: all.reduce((n, s) => n + s.words, 0), minutes: all.reduce((n, s) => n + s.minutes, 0) };
}
