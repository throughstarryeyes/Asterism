import type { Project } from '../../types';

// files that travel with a project: fonts, theme pictures, sound recordings, plus an extras record
// each file is sent once by name; a failed file never stops the text from syncing

export interface AssetMeta {
  id: string;
  kind: 'font' | 'image' | 'sound' | 'extras';
  type: string; // media type, e.g. font/ttf
  size: number;
  family?: string; // fonts: the name text refers to
  fileName?: string;
}

// the other side's store of files for one project.
export interface AssetChannel {
  list(): Promise<AssetMeta[]>;
  get(id: string): Promise<Uint8Array | undefined>;
  // files are kept as they are; the extras record is replaced.
  put(meta: AssetMeta, bytes: Uint8Array): Promise<void>;
  // only a side that stores files for good can drop the ones nothing uses any more.
  remove?(id: string): Promise<void>;
}

// this device's side: what the project uses here, and how to install what arrives.
export interface LocalAssets {
  // the files this project uses that exist on this device, and the extras record.
  wanted(project: Project): Promise<AssetMeta[]>;
  read(id: string): Promise<Uint8Array | undefined>;
  // does this project use the file, and is it missing here? (the extras record is always welcome.)
  needs(project: Project, meta: AssetMeta): Promise<boolean>;
  // files are stored; the extras record is merged with what this device has.
  install(meta: AssetMeta, bytes: Uint8Array): Promise<void>;
  // keys of every file this project uses, whether or not it is on this device yet.
  referenced(project: Project): Promise<Set<string>>;
}

export interface AssetReport {
  sent: number;
  received: number;
  removed: number;
  extras: boolean; // the themes and sounds were exchanged
  failed: string[]; // names of files that could not be moved
}

export const MAX_ASSET_BYTES = 16 * 1024 * 1024;

// two fonts are the same font when the text would find the same name; everything else is matched by id.
export const assetKey = (m: Pick<AssetMeta, 'id' | 'kind' | 'family'>) =>
  m.kind === 'font' ? `font:${(m.family ?? m.id).toLowerCase()}` : `id:${m.id}`;

const label = (m: AssetMeta) => m.kind === 'extras' ? 'themes and sounds' : m.family ?? m.fileName ?? m.id;

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

// exchange the extras: take what the other side has, then give back the merged result.
async function exchangeExtras(project: Project, remote: AssetChannel, local: LocalAssets, theirs: AssetMeta[], report: AssetReport) {
  const there = theirs.find(m => m.kind === 'extras');
  try {
    const before = there ? await remote.get(there.id) : undefined;
    if (there && before) await local.install(there, before);
    const merged = (await local.wanted(project)).find(m => m.kind === 'extras');
    const bytes = merged && (await local.read(merged.id));
    if (merged && bytes && !(before && same(before, bytes))) await remote.put(merged, bytes);
    report.extras = !!(there || merged);
  } catch {
    report.failed.push('themes and sounds');
  }
}

// send what the other side lacks, bring in what this project needs and this device lacks, and drop what
// nothing uses any more from a side that keeps files for good.
export async function syncAssets(project: Project, remote: AssetChannel, local: LocalAssets): Promise<AssetReport> {
  const report: AssetReport = { sent: 0, received: 0, removed: 0, extras: false, failed: [] };
  let theirs = await remote.list();

  // first, so the pictures and recordings the merged themes name are known before the files move.
  await exchangeExtras(project, remote, local, theirs, report);
  const has = new Set(theirs.map(assetKey));

  for (const meta of await local.wanted(project)) {
    if (meta.kind === 'extras' || has.has(assetKey(meta))) continue;
    try {
      if (meta.size > MAX_ASSET_BYTES) throw new Error('too large');
      const bytes = await local.read(meta.id);
      if (!bytes) throw new Error('missing');
      await remote.put(meta, bytes);
      report.sent++;
    } catch {
      report.failed.push(label(meta));
    }
  }

  for (const meta of theirs) {
    if (meta.kind === 'extras') continue;
    try {
      if (!(await local.needs(project, meta))) continue;
      if (meta.size > MAX_ASSET_BYTES) throw new Error('too large');
      const bytes = await remote.get(meta.id);
      if (!bytes) throw new Error('missing');
      await local.install(meta, bytes);
      report.received++;
    } catch {
      report.failed.push(label(meta));
    }
  }

  // only after everything moved cleanly: a file that failed to arrive must not be thrown away over there.
  if (remote.remove && !report.failed.length) {
    const used = await local.referenced(project);
    theirs = await remote.list();
    for (const meta of theirs) {
      if (meta.kind === 'extras' || used.has(assetKey(meta))) continue;
      try {
        await remote.remove(meta.id);
        report.removed++;
      } catch {
        report.failed.push(label(meta));
      }
    }
  }
  return report;
}

// this device's own files seen as a channel, so the device that answers a pairing code can serve them.
export function channelFor(local: LocalAssets, current: () => Project): AssetChannel {
  return {
    list: () => local.wanted(current()),
    get: id => local.read(id),
    async put(meta, bytes) {
      if (await local.needs(current(), meta)) await local.install(meta, bytes);
    },
  };
}

export function describeAssets(r: AssetReport): string {
  const parts: string[] = [];
  if (r.received) parts.push(`${r.received} file${r.received === 1 ? '' : 's'} received`);
  if (r.sent) parts.push(`${r.sent} sent`);
  if (r.removed) parts.push(`${r.removed} unused file${r.removed === 1 ? '' : 's'} cleared away`);
  if (r.failed.length) parts.push(`could not move ${r.failed.join(', ')}`);
  return parts.join(', ');
}
