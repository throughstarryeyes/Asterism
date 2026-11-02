/// <reference types="node" />
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { mergeProjects, mergeText, applyChoices, balanced, splitBlocks, splitTokens } from '../merge';
import { syncProject, resolveConflicts, makeDoc, StaleError, type SyncBase, type SyncDoc, type SyncProvider, type Remote } from '../engine';
import { folderProvider, httpProvider, fileProvider, syncFileName, type FolderLike, type FileLike } from '../providers';
// @ts-expect-error plain JS module
import { createSyncServer } from '../../../../server/sync-server.mjs';
import type { Project } from '../../../types';

const para = (n: number, extra = '') => `<p>Paragraph number ${n} has enough words in it to be a real paragraph of a chapter.${extra}</p>`;
const chapterText = (...ps: string[]) => ps.join('');

const base = (): Project => ({
  id: 'proj-1', title: 'The Salt Road', author: 'A. Writer', genre: 'fantasy', synopsis: '',
  chapters: [
    { id: 'c1', title: 'One', order: 1, wordCount: 0, status: 'draft', content: chapterText(para(1), para(2), para(3), para(4)), updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'c2', title: 'Two', order: 2, wordCount: 0, status: 'draft', content: para(9), updatedAt: '2026-01-01T00:00:00Z' },
  ],
  storyBible: { characters: [{ id: 'k1', name: 'Mara', role: 'protagonist', physicalDescription: 'tall' }], locations: [], lore: [] },
  plotThreads: [], timeline: [], reflections: [], goals: [], comments: [], findings: [],
  tags: ['a'], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Project);

const edit = (p: Project, fn: (draft: Project) => void): Project => { const c = structuredClone(p); fn(c); return c; };
const chapter = (p: Project, id: string) => p.chapters.find(c => c.id === id)!;

describe('text merge', () => {
  it('keeps edits to different paragraphs from both sides', () => {
    const b = chapterText(para(1), para(2), para(3));
    const l = chapterText(para(1, ' Mine.'), para(2), para(3));
    const r = chapterText(para(1), para(2), para(3, ' Theirs.'));
    expect(mergeText(b, l, r)).toBe(chapterText(para(1, ' Mine.'), para(2), para(3, ' Theirs.')));
  });

  it('keeps insertions and deletions in different places', () => {
    const b = chapterText(para(1), para(2), para(3));
    const merged = mergeText(b, chapterText(para(0), para(1), para(2), para(3)), chapterText(para(1), para(3)));
    expect(merged).toBe(chapterText(para(0), para(1), para(3)));
  });

  it('combines changes that sit side by side: one side deletes a paragraph, the other edits the next', () => {
    const b = chapterText(para(1), para(2), para(3));
    expect(mergeText(b, chapterText(para(1), para(3)), chapterText(para(1), para(2), para(3, ' Theirs.')))).toBe(chapterText(para(1), para(3, ' Theirs.')));
    expect(mergeText(b, chapterText(para(1, ' Mine.'), para(2), para(3)), chapterText(para(1), para(3)))).toBe(chapterText(para(1, ' Mine.'), para(3)));
    // an edit and a deletion of the very same paragraph is still a clash
    expect(mergeText(b, chapterText(para(1, ' Mine.'), para(2), para(3)), chapterText(para(2), para(3)))).toBeNull();
  });

  it('gives up when both rewrote the same paragraph, and always rejoins to the original', () => {
    const b = chapterText(para(1), para(2));
    expect(mergeText(b, chapterText(para(1, ' A'), para(2)), chapterText(para(1, ' B'), para(2)))).toBeNull();
    expect(splitBlocks(b).join('')).toBe(b);
    expect(mergeText(b, b, b)).toBe(b);
  });
});

describe('text merge inside one paragraph', () => {
  const b = chapterText(para(1), '<p>The fox jumped over the lazy dog near the river bank at dawn.</p>', para(3));
  const fox = (t: string) => `<p>${t}</p>`;

  it('keeps a change at the start from one side and a change at the end from the other', () => {
    const l = chapterText(para(1), fox('The red fox jumped over the lazy dog near the river bank at dawn.'), para(3));
    const r = chapterText(para(1), fox('The fox jumped over the lazy dog near the river bank at dawn, laughing.'), para(3));
    expect(mergeText(b, l, r)).toBe(chapterText(para(1), fox('The red fox jumped over the lazy dog near the river bank at dawn, laughing.'), para(3)));
  });

  it('keeps edits to different sentences of the same paragraph', () => {
    const two = chapterText(fox('It rained all night. The road was empty. A dog barked far away.'));
    const l = chapterText(fox('It rained all night. The road was quite empty. A dog barked far away.'));
    const r = chapterText(fox('It rained all night. The road was empty. A dog barked far away, twice.'));
    expect(mergeText(two, l, r)).toBe(chapterText(fox('It rained all night. The road was quite empty. A dog barked far away, twice.')));
  });

  it('keeps formatting added by one side while the other edits words', () => {
    const l = chapterText(para(1), fox('The <strong>fox jumped</strong> over the lazy dog near the river bank at dawn.'), para(3));
    const r = chapterText(para(1), fox('The fox jumped over the lazy dog near the river bank at sunset.'), para(3));
    expect(mergeText(b, l, r)).toBe(chapterText(para(1), fox('The <strong>fox jumped</strong> over the lazy dog near the river bank at sunset.'), para(3)));
  });

  it('still calls it a clash when both rewrote the same words', () => {
    const l = chapterText(para(1), fox('The fox jumped over the sleepy dog near the river bank at dawn.'), para(3));
    const r = chapterText(para(1), fox('The fox jumped over the tired dog near the river bank at dawn.'), para(3));
    expect(mergeText(b, l, r)).toBeNull();
  });

  it('can keep both versions of a clash, with nothing from either side lost', () => {
    const l = chapterText(para(1), fox('The fox jumped over the sleepy dog near the river bank at dawn.'), para(3));
    const r = chapterText(para(1), fox('The fox jumped over the tired dog near the river bank at dawn.'), para(3));
    const both = mergeText(b, l, r, true)!;
    expect(both).toContain('sleepy dog');
    expect(both).toContain('tired dog');
    expect(both).toContain(para(1));
    expect(both).toContain(para(3));
    expect(balancedParagraphs(both)).toBe(true);
  });

  it('does not trust a merge that would leave formatting open', () => {
    // one side wraps words in bold, the other deletes the words in the middle of that span
    const l = chapterText(fox('The <strong>fox jumped over the lazy</strong> dog near the river bank at dawn.'));
    const r = chapterText(fox('The fox jumped over the lazy dog near the river bank at dawn.'));
    const out = mergeText(chapterText(fox('The fox jumped over the lazy dog near the river bank at dawn.')), l, r);
    expect(out === null || balancedParagraphs(out)).toBe(true);
  });

  it('cuts paragraphs into pieces that rejoin to the original', () => {
    const html = '<p>A <em>mixed</em> bit &amp; a stray < sign, and\ttabs.</p>';
    expect(splitTokens(html).join('')).toBe(html);
  });
});

const balancedParagraphs = (html: string) => balanced(html) && (html.match(/<p>/g) ?? []).length === (html.match(/<\/p>/g) ?? []).length;

describe('keeping both in a project merge', () => {
  it('keeps both versions of a clashed paragraph and says it did, when asked to', () => {
    const b = base();
    const local = edit(b, d => { chapter(d, 'c1').content = chapterText(para(1), para(2).replace('enough words', 'plenty of words'), para(3), para(4)); });
    const remote = edit(b, d => { chapter(d, 'c1').content = chapterText(para(1), para(2).replace('enough words', 'a good few words'), para(3), para(4)); });
    const asked = mergeProjects(b, local, remote, { keepBoth: true });
    expect(asked.conflicts).toHaveLength(1);
    expect(asked.conflicts[0].kept).toBe('both');
    expect(chapter(asked.value, 'c1').content).toContain('plenty of words');
    expect(chapter(asked.value, 'c1').content).toContain('a good few words');
    // unchanged choices leave the already settled clash alone
    expect(chapter(applyChoices(asked.value, asked.conflicts, {}), 'c1').content).toBe(chapter(asked.value, 'c1').content);
    // without it the writer is asked, and "both" is an answer
    const plain = mergeProjects(b, local, remote);
    expect(plain.conflicts[0].kept).toBeUndefined();
    const both = chapter(applyChoices(plain.value, plain.conflicts, { [plain.conflicts[0].key]: 'both' }), 'c1').content;
    expect(both).toContain('plenty of words');
    expect(both).toContain('a good few words');
  });
});

describe('project merge', () => {
  it('takes what only one side changed', () => {
    const b = base();
    const local = edit(b, d => { d.title = 'New Title'; });
    const remote = edit(b, d => { chapter(d, 'c2').title = 'Second'; d.tags = ['a', 'b']; });
    const { value, conflicts } = mergeProjects(b, local, remote);
    expect(conflicts).toEqual([]);
    expect(value.title).toBe('New Title');
    expect(chapter(value, 'c2').title).toBe('Second');
    expect(value.tags).toEqual(['a', 'b']);
  });

  it('merges a chapter edited in different places, and items added on both sides', () => {
    const b = base();
    const local = edit(b, d => {
      chapter(d, 'c1').content = chapterText(para(1, ' Mine.'), para(2), para(3), para(4));
      d.storyBible.characters.push({ id: 'k2', name: 'Dana' } as never);
    });
    const remote = edit(b, d => {
      chapter(d, 'c1').content = chapterText(para(1), para(2), para(3), para(4, ' Theirs.'));
      d.storyBible.characters.push({ id: 'k3', name: 'Corin' } as never);
      d.chapters.push({ id: 'c3', title: 'Three', order: 3, wordCount: 0, status: 'draft', content: '<p>x</p>' } as never);
    });
    const { value, conflicts } = mergeProjects(b, local, remote);
    expect(conflicts).toEqual([]);
    expect(chapter(value, 'c1').content).toBe(chapterText(para(1, ' Mine.'), para(2), para(3), para(4, ' Theirs.')));
    expect(value.storyBible.characters.map(c => c.name).sort()).toEqual(['Corin', 'Dana', 'Mara']);
    expect(value.chapters.map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('reports a real clash in readable terms and applies the chosen side', () => {
    const b = base();
    const local = edit(b, d => { chapter(d, 'c1').content = chapterText(para(1, ' A'), para(2), para(3), para(4)); chapter(d, 'c2').title = 'Mine'; });
    const remote = edit(b, d => { chapter(d, 'c1').content = chapterText(para(1, ' B'), para(2), para(3), para(4)); chapter(d, 'c2').title = 'Theirs'; });
    const { value, conflicts } = mergeProjects(b, local, remote);
    expect(conflicts.map(c => c.kind).sort()).toEqual(['text', 'value']);
    expect(chapter(value, 'c2').title).toBe('Mine'); // nothing chosen yet means this device's version
    const text = conflicts.find(c => c.kind === 'text')!;
    const title = conflicts.find(c => c.kind === 'value')!;
    const picked = applyChoices(value, conflicts, { [text.key]: 'remote', [title.key]: 'remote' });
    expect(chapter(picked, 'c1').content).toContain(' B');
    expect(chapter(picked, 'c2').title).toBe('Theirs');
  });

  it('asks when one side deleted what the other edited, and not when it was untouched', () => {
    const b = base();
    const removedHere = edit(b, d => { d.chapters = d.chapters.filter(c => c.id !== 'c2'); });
    const untouchedThere = structuredClone(b);
    expect(mergeProjects(b, removedHere, untouchedThere).value.chapters.map(c => c.id)).toEqual(['c1']);

    const editedThere = edit(b, d => { chapter(d, 'c2').title = 'Edited'; });
    const { value, conflicts } = mergeProjects(b, removedHere, editedThere);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('removed');
    expect(value.chapters.map(c => c.id)).toEqual(['c1']);
    const brought = applyChoices(value, conflicts, { [conflicts[0].key]: 'remote' });
    expect(chapter(brought, 'c2').title).toBe('Edited');
  });

  it('lets the later updatedAt win without a question', () => {
    const b = base();
    const { value, conflicts } = mergeProjects(b, edit(b, d => { d.updatedAt = '2026-03-01T00:00:00Z'; }), edit(b, d => { d.updatedAt = '2026-02-01T00:00:00Z'; }));
    expect(conflicts).toEqual([]);
    expect(value.updatedAt).toBe('2026-03-01T00:00:00Z');
  });
});

// a place two devices share, with the same stale-write check the real ones have.
function sharedPlace(): SyncProvider & { doc: SyncDoc | null; version: number } {
  const place = {
    kind: 'folder' as const, label: 'test', doc: null as SyncDoc | null, version: 0,
    async read(): Promise<Remote> { return { doc: place.doc ? structuredClone(place.doc) : null, etag: place.doc ? String(place.version) : undefined }; },
    async write(doc: SyncDoc, etag?: string) {
      if ((place.doc ? String(place.version) : undefined) !== etag) throw new StaleError();
      place.doc = structuredClone(doc); place.version++;
      return String(place.version);
    },
  };
  return place;
}
const A = { id: 'dev-a', name: 'Laptop' }, B = { id: 'dev-b', name: 'Phone' };

describe('syncing two devices', () => {
  it('pushes, pulls, merges and settles', async () => {
    const place = sharedPlace();
    let a = base(), baseA: SyncBase | undefined;
    let b: Project, baseB: SyncBase | undefined;

    let out = await syncProject({ local: a, provider: place, base: baseA, device: A });
    expect(out.status).toBe('pushed');
    baseA = out.base;

    // the second device starts from the same project and has nothing recorded yet.
    out = await syncProject({ local: base(), provider: place, device: B });
    expect(out.status).toBe('up-to-date');
    b = out.project; baseB = out.base;

    // edits on both, in different places.
    a = edit(a, d => { chapter(d, 'c1').content = chapterText(para(1, ' From A.'), para(2), para(3), para(4)); });
    b = edit(b, d => { chapter(d, 'c1').content = chapterText(para(1), para(2), para(3), para(4, ' From B.')); d.title = 'Salt Road, Revised'; });

    out = await syncProject({ local: a, provider: place, base: baseA, device: A });
    expect(out.status).toBe('pushed');
    baseA = out.base; a = out.project;

    out = await syncProject({ local: b, provider: place, base: baseB, device: B });
    expect(out.status).toBe('merged');
    b = out.project; baseB = out.base;
    expect(chapter(b, 'c1').content).toContain('From A.');
    expect(chapter(b, 'c1').content).toContain('From B.');
    expect(b.title).toBe('Salt Road, Revised');
    expect(chapter(b, 'c1').wordCount).toBeGreaterThan(0);

    out = await syncProject({ local: a, provider: place, base: baseA, device: A });
    expect(out.status).toBe('pulled');
    expect(out.project).toEqual(b);
    out = await syncProject({ local: out.project, provider: place, base: out.base, device: A });
    expect(out.status).toBe('up-to-date');
  });

  it('writes nothing while there is a conflict, then writes the answer', async () => {
    const place = sharedPlace();
    const seed = base();
    const first = await syncProject({ local: seed, provider: place, device: A });
    const a = edit(seed, d => { chapter(d, 'c2').title = 'From A'; });
    const b = edit(seed, d => { chapter(d, 'c2').title = 'From B'; });
    await syncProject({ local: a, provider: place, base: first.base, device: A });
    const versionBefore = place.version;

    const out = await syncProject({ local: b, provider: place, base: first.base, device: B });
    expect(out.status).toBe('conflicts');
    expect(place.version).toBe(versionBefore);
    expect(out.conflicts[0].label).toContain('Chapter “Two”');

    const done = await resolveConflicts({ local: b, provider: place, base: first.base, device: B }, out.pending!, { [out.conflicts[0].key]: 'remote' });
    expect(chapter(done.project, 'c2').title).toBe('From A');
    expect(done.status).toBe('pulled');
    expect(place.version).toBe(versionBefore); // taking their version leaves nothing to write

    const kept = await resolveConflicts({ local: b, provider: place, base: first.base, device: B }, out.pending!, { [out.conflicts[0].key]: 'local' });
    expect(chapter(kept.project, 'c2').title).toBe('From B');
    expect(place.version).toBe(versionBefore + 1);
    expect(place.doc?.revision).toBe(kept.base.revision);
  });

  it('retries when the other side changes mid-sync', async () => {
    const place = sharedPlace();
    const seed = base();
    const first = await syncProject({ local: seed, provider: place, device: A });
    let raced = false;
    const racing: SyncProvider = {
      ...place, kind: 'folder', label: 'racing',
      read: () => place.read(),
      write: async (doc, etag) => {
        if (!raced) {
          raced = true;
          await place.write(makeDoc(edit(seed, d => { d.synopsis = 'someone else'; }), 2, B), etag);
        }
        return place.write(doc, etag);
      },
    };
    const out = await syncProject({ local: edit(seed, d => { d.genre = 'mystery'; }), provider: racing, base: first.base, device: A });
    expect(out.project.genre).toBe('mystery');
    expect(out.project.synopsis).toBe('someone else');
  });

  it('refuses a location that holds a different project', async () => {
    const place = sharedPlace();
    await syncProject({ local: { ...base(), id: 'other' }, provider: place, device: B });
    await expect(syncProject({ local: base(), provider: place, device: A })).rejects.toThrow('different project');
  });

  it('merges a sync file you carry yourself, without writing anywhere', async () => {
    const seed = base();
    const theirs = makeDoc(edit(seed, d => { d.title = 'From the file'; }), 5, B);
    const provider = fileProvider(theirs);
    const out = await syncProject({ local: seed, provider, base: { revision: 1, project: seed }, device: A });
    expect(out.project.title).toBe('From the file');
    expect(out.status).toBe('pulled');

    // our own edits on top are carried into the file we hand back.
    const mine = edit(seed, d => { d.genre = 'mystery'; });
    const both = await syncProject({ local: mine, provider, base: { revision: 1, project: seed }, device: A });
    expect(both.status).toBe('merged');
    expect(provider.written?.project).toMatchObject({ title: 'From the file', genre: 'mystery' });

    // with nothing recorded about the last shared state, a difference is a question, not a guess.
    const blind = await syncProject({ local: seed, provider: fileProvider(theirs), device: A });
    expect(blind.status).toBe('conflicts');
  });
});

// ---- providers ----------------------------------------------------------------------------------

function fakeFolder(): FolderLike & { files: Map<string, { text: string; lastModified: number }> } {
  const files = new Map<string, { text: string; lastModified: number }>();
  let clock = 1000;
  const handle = (name: string): FileLike => ({
    async getFile() { const f = files.get(name)!; return { text: async () => f.text, arrayBuffer: async () => new TextEncoder().encode(f.text).buffer as ArrayBuffer, lastModified: f.lastModified, size: f.text.length }; },
    async createWritable() {
      let data = '';
      return { async write(d: string) { data += d; }, async close() { files.set(name, { text: data, lastModified: ++clock }); } };
    },
  });
  return {
    files,
    async getFileHandle(name, options) {
      if (!files.has(name)) {
        if (!options?.create) throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
        files.set(name, { text: '', lastModified: ++clock });
      }
      return handle(name);
    },
  };
}

describe('folder provider', () => {
  it('creates, reads back, and refuses to overwrite a file that changed underneath', async () => {
    const dir = fakeFolder();
    const p = folderProvider(dir, 'proj-1');
    expect((await p.read()).doc).toBeNull();
    const etag = await p.write(makeDoc(base(), 1, A));
    const seen = await p.read();
    expect(seen.doc?.revision).toBe(1);
    expect(seen.etag).toBe(etag);
    expect(dir.files.has(syncFileName('proj-1'))).toBe(true);

    // a cloud client replaces the file between our read and our write.
    const other = folderProvider(dir, 'proj-1');
    await other.write(makeDoc(base(), 2, B), seen.etag);
    await expect(p.write(makeDoc(base(), 2, A), seen.etag)).rejects.toBeInstanceOf(StaleError);
    await expect(folderProvider(dir, 'proj-1').write(makeDoc(base(), 9, A))).rejects.toBeInstanceOf(StaleError);
  });

  it('explains a half-uploaded or foreign file', async () => {
    const dir = fakeFolder();
    const p = folderProvider(dir, 'proj-1', 'Dropbox');
    dir.files.set(syncFileName('proj-1'), { text: '{"format":"inkw', lastModified: 1 });
    await expect(p.read()).rejects.toThrow('still be uploading');
    dir.files.set(syncFileName('proj-1'), { text: '{"hello":1}', lastModified: 2 });
    await expect(p.read()).rejects.toThrow('not an Asterism sync file');
  });
});

describe('http provider against the reference server', () => {
  let dir = '';
  const servers: ReturnType<typeof createSyncServer>[] = [];
  const start = async (token: string) => {
    dir = await mkdtemp(join(tmpdir(), 'asterism-sync-'));
    const server = createSyncServer({ dir, token });
    await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };
  afterAll(async () => {
    await Promise.all(servers.map(s => new Promise(res => s.close(res))));
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('syncs two devices through a real server, and rejects stale writes', async () => {
    const url = await start('s3cret');
    const a = httpProvider({ url, token: 's3cret' }, 'proj-1');
    const b = httpProvider({ url, token: 's3cret' }, 'proj-1');

    expect((await a.read()).doc).toBeNull();
    const first = await syncProject({ local: base(), provider: a, device: A });
    expect(first.status).toBe('pushed');

    const second = await syncProject({ local: base(), provider: b, device: B });
    expect(second.status).toBe('up-to-date');

    const edited = edit(first.project, d => { d.title = 'Over HTTP'; });
    await syncProject({ local: edited, provider: a, base: first.base, device: A });
    const pulled = await syncProject({ local: second.project, provider: b, base: second.base, device: B });
    expect(pulled.status).toBe('pulled');
    expect(pulled.project.title).toBe('Over HTTP');

    const stale = await a.read();
    await b.write(makeDoc(edit(pulled.project, d => { d.genre = 'x'; }), 9, B), (await b.read()).etag);
    await expect(a.write(makeDoc(base(), 10, A), stale.etag)).rejects.toBeInstanceOf(StaleError);
    await expect(a.write(makeDoc(base(), 10, A))).rejects.toBeInstanceOf(StaleError); // "create" when it exists
  });

  it('refuses a wrong token', async () => {
    const url = await start('right');
    await expect(httpProvider({ url, token: 'wrong' }, 'proj-1').read()).rejects.toThrow('access token');
    await expect(httpProvider({ url }, 'proj-1').read()).rejects.toThrow('access token');
  });
});

describe('device to device', () => {
  // two ends of an in-memory wire, delivered asynchronously like the real thing.
  const wire = () => {
    const a: import('../peer').Channel = { onmessage: null, send: d => { setTimeout(() => b.onmessage?.(d), 0); } };
    const b: import('../peer').Channel = { onmessage: null, send: d => { setTimeout(() => a.onmessage?.(d), 0); } };
    return [a, b] as const;
  };

  it('carries a large project across in pieces and syncs through it', async () => {
    const { servePeer, peerProvider } = await import('../peer');
    const host = sharedPlace();
    const big = edit(base(), d => { chapter(d, 'c1').content = Array.from({ length: 400 }, (_, i) => para(i)).join(''); });
    const seeded = await syncProject({ local: big, provider: host, device: A });

    const [hostEnd, guestEnd] = wire();
    servePeer(hostEnd, host);
    const guest = peerProvider(guestEnd, 'Laptop');

    const mine = edit(big, d => { d.title = 'Edited on the phone'; });
    const out = await syncProject({ local: mine, provider: guest, base: seeded.base, device: B });
    expect(out.status).toBe('pushed');
    expect(host.doc?.project.title).toBe('Edited on the phone');
    expect(host.doc?.project.chapters[0].content.length).toBeGreaterThan(30_000);
  });

  it('reports a stale write, and a silent host', async () => {
    const { servePeer, peerProvider } = await import('../peer');
    const host = sharedPlace();
    await syncProject({ local: base(), provider: host, device: A });
    const [hostEnd, guestEnd] = wire();
    servePeer(hostEnd, host);
    const guest = peerProvider(guestEnd, 'Laptop');
    await expect(guest.write(makeDoc(base(), 2, B), 'wrong-etag')).rejects.toBeInstanceOf(StaleError);

    const [, deadEnd] = wire();
    await expect(peerProvider(deadEnd, 'Nobody', 50).read()).rejects.toThrow('did not answer');
  });
});
