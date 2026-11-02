import type { Project } from '../../types';
import { OLD_SYNC_FORMAT } from '../legacy';
import { parseHtmlBlocks, blockText } from '../exporters/htmlBlocks';
import type { AssetChannel, AssetMeta } from './assets';
import { applyChoices, mergeProjects, deepEqual, type Choice, type Conflict, type Seg } from './merge';

export const SYNC_FORMAT = 'asterism-sync';

export interface Device {
  id: string;
  name: string;
}

// what sits on the other side: one file holding one project and a counter that goes up on every save.
export interface SyncDoc {
  format: typeof SYNC_FORMAT;
  version: 1;
  projectId: string;
  revision: number;
  savedAt: string;
  device: Device;
  project: Project;
  // only in a sync file you carry yourself: the files travel inside it, base64-encoded.
  assets?: Array<AssetMeta & { data: string }>;
}

export interface Remote {
  doc: SyncDoc | null;
  // opaque stamp of what was read; a write is refused if the other side has moved on since.
  etag?: string;
}

export interface SyncProvider {
  kind: 'folder' | 'http' | 'peer' | 'file' | 'drive';
  label: string;
  read(): Promise<Remote>;
  write(doc: SyncDoc, etag?: string): Promise<string | undefined>;
  // where uploaded fonts and pictures go, when this side can hold them.
  assets?: AssetChannel;
}

// thrown by a provider when the other side changed between our read and our write.
export class StaleError extends Error {
  constructor() { super('The other side changed while syncing.'); this.name = 'StaleError'; }
}

// what both sides last agreed on, kept per project and link. it is what makes a three-way merge possible.
export interface SyncBase {
  revision: number;
  project: Project;
}

export type SyncStatus = 'up-to-date' | 'pushed' | 'pulled' | 'merged' | 'conflicts';

export interface SyncOutcome {
  status: SyncStatus;
  // what this device should now hold.
  project: Project;
  base: SyncBase;
  // set when status is 'conflicts': nothing was written yet.
  pending?: PendingConflicts;
  conflicts: Conflict[];
}

export interface PendingConflicts {
  merged: Project;
  conflicts: Conflict[];
  remote: Remote;
  local: Project;
}

export function isSyncDoc(x: unknown): x is SyncDoc {
  const d = x as Partial<SyncDoc> | null;
  return !!d && (d.format === SYNC_FORMAT || d.format === OLD_SYNC_FORMAT) && d.version === 1 && typeof d.revision === 'number' && !!d.project && typeof d.projectId === 'string';
}

export function makeDoc(project: Project, revision: number, device: Device, now: Date = new Date()): SyncDoc {
  return { format: SYNC_FORMAT, version: 1, projectId: project.id, revision, savedAt: now.toISOString(), device, project };
}

// ---- readable places for conflicts -----------------------------------------------------------------

function describe(path: Seg[], root: unknown): string {
  const project = root as Project;
  const [head, second, third] = path;
  const idOf = (s?: Seg) => (typeof s === 'object' ? s.id : undefined);
  if (head === 'chapters' && idOf(second)) {
    const ch = project.chapters?.find(c => c.id === idOf(second));
    const name = ch ? `“${ch.title}”` : 'a chapter';
    return third === 'content' ? `Chapter ${name} › text` : third ? `Chapter ${name} › ${String(third)}` : `Chapter ${name}`;
  }
  if (head === 'storyBible' && typeof second === 'string' && idOf(third)) {
    const list = (project.storyBible as unknown as Record<string, { id: string; name?: string; title?: string }[]>)?.[second] ?? [];
    const item = list.find(x => x.id === idOf(third));
    const kind = second === 'characters' ? 'Character' : second === 'locations' ? 'Place' : 'Lore';
    return `${kind} “${item?.name ?? item?.title ?? 'untitled'}”${path[3] ? ` › ${String(path[3])}` : ''}`;
  }
  const names: Record<string, string> = { plotThreads: 'Plot thread', timeline: 'Timeline event', goals: 'Goal', comments: 'Comment', reflections: 'Reflection' };
  if (typeof head === 'string' && names[head] && idOf(second)) {
    const item = (project[head as keyof Project] as unknown as { id: string; title?: string; name?: string }[] | undefined)?.find(x => x.id === idOf(second));
    return `${names[head]} “${item?.title ?? item?.name ?? 'untitled'}”${third ? ` › ${String(third)}` : ''}`;
  }
  if (path.length === 1 && typeof head === 'string') return `Document ${head}`;
  return path.map(s => (typeof s === 'string' ? s : s.id)).join(' › ');
}

// merging can leave a chapter's word count from the wrong side.
// only chapters that are neither side's own version are recounted.
function fixWordCounts(project: Project, ...sides: Project[]): Project {
  let changed = false;
  const chapters = project.chapters.map(c => {
    if (sides.some(s => s.chapters.some(o => deepEqual(o, c)))) return c;
    const words = parseHtmlBlocks(c.content ?? '').reduce((n, b) => n + (blockText(b).trim().split(/\s+/).filter(Boolean).length), 0);
    if (c.wordCount === words) return c;
    changed = true;
    return { ...c, wordCount: words };
  });
  return changed ? { ...project, chapters } : project;
}

// `keepBoth` is for merges nobody is there to decide: where both sides rewrote the same text, both versions stay
export function mergeWithRemote(base: Project | undefined, local: Project, remote: Project, options: { keepBoth?: boolean } = {}) {
  // names in the conflict list come from the shared starting point, so they do not change under the writer.
  const result = mergeProjects(base, local, remote, { describe: (path, root) => describe(path, base ?? root), keepBoth: options.keepBoth });
  return { merged: fixWordCounts(result.value, local, remote), conflicts: result.conflicts };
}

// ---- the sync itself -------------------------------------------------------------------------------

export interface SyncRequest {
  local: Project;
  provider: SyncProvider;
  base?: SyncBase;
  device: Device;
  now?: Date;
}

const touch = (p: Project, now: Date): Project => ({ ...p, updatedAt: now.toISOString() });

async function push(project: Project, revision: number, remote: Remote, req: SyncRequest): Promise<SyncBase> {
  await req.provider.write(makeDoc(project, revision, req.device, req.now), remote.etag);
  return { revision, project };
}

export async function syncProject(req: SyncRequest, attempts = 3): Promise<SyncOutcome> {
  const { local, provider, base } = req;
  const now = req.now ?? new Date();
  try {
    const remote = await provider.read();

    if (!remote.doc) {
      const newBase = await push(local, 1, remote, req);
      return { status: 'pushed', project: local, base: newBase, conflicts: [] };
    }
    if (remote.doc.projectId !== local.id) {
      throw new Error('That location holds a different project. Pick an empty folder or a different address.');
    }

    // nothing new over there.
    if (base && remote.doc.revision === base.revision) {
      if (deepEqual(local, base.project)) return { status: 'up-to-date', project: local, base, conflicts: [] };
      const newBase = await push(local, base.revision + 1, remote, req);
      return { status: 'pushed', project: local, base: newBase, conflicts: [] };
    }

    // the other side moved. if it is the same as ours, just note that.
    if (deepEqual(local, remote.doc.project)) {
      return { status: 'up-to-date', project: local, base: { revision: remote.doc.revision, project: local }, conflicts: [] };
    }

    const { merged, conflicts } = mergeWithRemote(base?.project, local, remote.doc.project);
    if (conflicts.length) {
      return {
        status: 'conflicts', project: local, base: base ?? { revision: 0, project: local },
        conflicts, pending: { merged, conflicts, remote, local },
      };
    }
    return await finish(req, merged, remote, now);
  } catch (e) {
    if (e instanceof StaleError && attempts > 1) return syncProject(req, attempts - 1);
    throw e;
  }
}

async function finish(req: SyncRequest, merged: Project, remote: Remote, now: Date): Promise<SyncOutcome> {
  const theirs = remote.doc!.project;
  const sameAsRemote = deepEqual(merged, theirs);
  const sameAsLocal = deepEqual(merged, req.local);
  const project = sameAsLocal || sameAsRemote ? merged : touch(merged, now);
  if (sameAsRemote) {
    return { status: 'pulled', project, base: { revision: remote.doc!.revision, project }, conflicts: [] };
  }
  const revision = remote.doc!.revision + 1;
  await req.provider.write(makeDoc(project, revision, req.device, now), remote.etag);
  return { status: sameAsLocal ? 'pushed' : 'merged', project, base: { revision, project }, conflicts: [] };
}

// after the writer has chosen, write the result.
export async function resolveConflicts(req: SyncRequest, pending: PendingConflicts, choices: Record<string, Choice>): Promise<SyncOutcome> {
  const now = req.now ?? new Date();
  const resolved = fixWordCounts(applyChoices(pending.merged, pending.conflicts, choices), pending.local, pending.remote.doc!.project);
  const out = await finish({ ...req, local: pending.local }, resolved, pending.remote, now);
  return { ...out, status: out.status === 'up-to-date' ? 'merged' : out.status };
}
