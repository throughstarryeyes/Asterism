/// <reference types="node" />
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { channelFor, syncAssets, type AssetChannel, type AssetMeta, type LocalAssets } from '../assets';
import { localAssets } from '../localAssets';
import { stamped, themeKey, soundKey, type Extras } from '../extras';
import { folderProvider, httpProvider, fileProvider, type FileLike, type FolderLike } from '../providers';
import { makeDoc } from '../engine';
import { servePeer, peerProvider, type Channel } from '../peer';
// @ts-expect-error plain JS module
import { createSyncServer } from '../../../../server/sync-server.mjs';
import type { CustomFontConfig, Project } from '../../../types';

// ---- fakes ---------------------------------------------------------------------------------------------

// a TrueType header followed by filler: enough for the font sniffer, not for a real browser.
const fontBytes = (n = 200) => { const b = new Uint8Array(n).fill(7); b.set([0, 1, 0, 0]); return b; };
const pngBytes = () => new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5, 6, 7, 8]);

const project = (over: Partial<Project> = {}): Project => ({
  id: 'proj-1', title: 'T', author: 'A', genre: '', synopsis: '',
  chapters: [{ id: 'c1', title: 'One', order: 1, wordCount: 0, status: 'draft', content: '<p style="font-family: Brandish Serif">Hello</p>', updatedAt: '' }],
  storyBible: { characters: [], locations: [], lore: [] },
  plotThreads: [], timeline: [], reflections: [], goals: [], comments: [], findings: [],
  createdAt: '', updatedAt: '',
  ...over,
} as unknown as Project);

// one device: a store of blobs, a list of installed fonts, and a record of what happened to it.
function device(initial: { blobs?: Record<string, Uint8Array>; fonts?: CustomFontConfig[]; extras?: Partial<Extras> } = {}) {
  const blobs = new Map<string, Blob>(Object.entries(initial.blobs ?? {}).map(([id, b]) => [id, new Blob([b as BlobPart], { type: id.startsWith('font') ? 'font/ttf' : 'image/png' })]));
  const state = { fonts: [...(initial.fonts ?? [])], registered: [] as string[], imagesChanged: 0, reject: false, extras: { themes: [], sounds: [], images: {}, stamps: {}, ...initial.extras } as Extras };
  const local = localAssets({
    fonts: () => state.fonts,
    addFont: c => { state.fonts.push(c); },
    imagesChanged: () => { state.imagesChanged++; },
    extras: () => state.extras,
    setExtras: next => { state.extras = next; },
    store: { get: async id => blobs.get(id), put: async (blob, id) => { blobs.set(id, blob); } },
    register: async family => { if (state.reject) throw new Error('bad font'); state.registered.push(family); },
  });
  return { local, state, blobs };
}

const font = (id: string, family: string): CustomFontConfig => ({ id, name: family, family, source: 'local', assetId: id, fileName: `${family}.ttf` });

function memoryChannel(): AssetChannel & { files: Map<string, { meta: AssetMeta; bytes: Uint8Array }> } {
  const files = new Map<string, { meta: AssetMeta; bytes: Uint8Array }>();
  return {
    files,
    async list() { return Array.from(files.values(), f => f.meta); },
    async get(id) { return files.get(id)?.bytes; },
    async put(meta, bytes) { files.set(meta.id, { meta, bytes }); },
    async remove(id) { files.delete(id); },
  };
}

// a folder with real directories and binary files.
interface Node { dirs: Map<string, Node>; files: Map<string, { bytes: Uint8Array; lastModified: number }> }
function fakeFolder(node: Node = { dirs: new Map(), files: new Map() }): FolderLike & { node: Node } {
  let clock = 1;
  const enc = new TextEncoder();
  const missing = () => Object.assign(new Error('missing'), { name: 'NotFoundError' });
  const handle = (name: string): FileLike => ({
    async getFile() {
      const f = node.files.get(name)!;
      return { text: async () => new TextDecoder().decode(f.bytes), arrayBuffer: async () => f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer, lastModified: f.lastModified, size: f.bytes.length };
    },
    async createWritable() {
      let data = new Uint8Array();
      return { async write(d: string | Uint8Array) { data = typeof d === 'string' ? enc.encode(d) : new Uint8Array(d); }, async close() { node.files.set(name, { bytes: data, lastModified: ++clock }); } };
    },
  });
  return {
    node,
    async getFileHandle(name, options) {
      if (!node.files.has(name)) {
        if (!options?.create) throw missing();
        node.files.set(name, { bytes: new Uint8Array(), lastModified: ++clock });
      }
      return handle(name);
    },
    async removeEntry(name) { if (!node.files.delete(name)) throw missing(); },
    async getDirectoryHandle(name, options) {
      let child = node.dirs.get(name);
      if (!child) {
        if (!options?.create) throw missing();
        child = { dirs: new Map(), files: new Map() };
        node.dirs.set(name, child);
      }
      return fakeFolder(child);
    },
  };
}

// ---- the sync routine ---------------------------------------------------------------------------------

describe('moving files between two devices', () => {
  const phone = () => device({ blobs: { 'font-1': fontBytes() }, fonts: [font('font-1', 'Brandish Serif')] });

  it('sends a font the text uses, and installs it on a device that lacks it', async () => {
    const remote = memoryChannel();
    const a = phone();
    const sent = await syncAssets(project(), remote, a.local);
    expect(sent).toMatchObject({ sent: 1, received: 0, failed: [] });
    expect(remote.files.get('font-1')?.meta).toMatchObject({ kind: 'font', family: 'Brandish Serif', fileName: 'Brandish Serif.ttf' });

    const b = device();
    const got = await syncAssets(project(), remote, b.local);
    expect(got).toMatchObject({ sent: 0, received: 1, failed: [] });
    expect(b.state.fonts.map(f => f.family)).toEqual(['Brandish Serif']);
    expect(b.state.registered).toEqual(['Brandish Serif']);
    expect(b.blobs.has('font-1')).toBe(true);
  });

  it('does nothing when both sides already have it, even under different ids', async () => {
    const remote = memoryChannel();
    await syncAssets(project(), remote, phone().local);
    const laptop = device({ blobs: { 'font-9': fontBytes() }, fonts: [font('font-9', 'brandish serif')] });
    const again = await syncAssets(project(), remote, laptop.local);
    expect(again).toMatchObject({ sent: 0, received: 0, failed: [] });
    expect(remote.files.size).toBe(1);
  });

  it('leaves out fonts the project does not use', async () => {
    const remote = memoryChannel();
    const d = device({ blobs: { 'font-1': fontBytes(), 'font-2': fontBytes() }, fonts: [font('font-1', 'Brandish Serif'), font('font-2', 'Unused Sans')] });
    await syncAssets(project(), remote, d.local);
    expect(Array.from(remote.files.keys())).toEqual(['font-1']);
  });

  it('carries a theme picture under the same id, and tells the app to draw it', async () => {
    const withTheme = project({ storyTheme: { customTheme: { appBgImageId: 'img-1' } } } as unknown as Partial<Project>);
    const remote = memoryChannel();
    const a = device({ blobs: { 'img-1': pngBytes() } });
    await syncAssets(withTheme, remote, a.local);
    expect(remote.files.get('img-1')?.meta).toMatchObject({ kind: 'image', type: 'image/png' });

    const b = device();
    await syncAssets(withTheme, remote, b.local);
    expect(Array.from(b.blobs.keys())).toEqual(['img-1']);
    expect(b.state.imagesChanged).toBe(1);
    // a picture the project does not reference is not wanted.
    const c = device();
    expect(await syncAssets(project(), remote, c.local)).toMatchObject({ received: 0 });
  });

  it('reports a file it cannot install, and keeps going', async () => {
    const remote = memoryChannel();
    await syncAssets(project(), remote, phone().local);
    remote.files.set('font-bad', { meta: { id: 'font-bad', kind: 'font', type: 'font/ttf', size: 10, family: 'Broken' }, bytes: new Uint8Array([1, 2, 3, 4, 5, 6]) });
    const b = device();
    const out = await syncAssets(project(), remote, b.local);
    expect(out.received).toBe(1);
    expect(out.failed).toEqual(['Broken']);

    const strict = device();
    strict.state.reject = true;
    expect((await syncAssets(project(), remote, strict.local)).failed).toContain('Brandish Serif');
    expect(strict.blobs.size).toBe(0); // nothing stored for a font the browser refused
  });

  it('skips a file that is too big instead of sending it', async () => {
    const huge: LocalAssets = {
      async wanted() { return [{ id: 'font-big', kind: 'font', type: 'font/ttf', size: 99 * 1024 * 1024, family: 'Big' }]; },
      async read() { return new Uint8Array(1); },
      async needs() { return false },
      async install() { /* never */ },
      async referenced() { return new Set<string>(); },
    };
    const out = await syncAssets(project(), memoryChannel(), huge);
    expect(out).toMatchObject({ sent: 0, failed: ['Big'] });
  });
});

// ---- each provider's channel ------------------------------------------------------------------------

const META: AssetMeta = { id: 'font-1', kind: 'font', type: 'font/ttf', size: 200, family: 'Brandish Serif', fileName: 'b.ttf' };

describe('a folder', () => {
  it('keeps files in a folder beside the sync file, and lists them from any device', async () => {
    const dir = fakeFolder();
    const a = folderProvider(dir, 'proj-1').assets!;
    expect(await a.list()).toEqual([]);
    expect(await a.get('font-1')).toBeUndefined();
    await a.put(META, fontBytes());
    await a.put({ ...META, id: 'img-2', kind: 'image', type: 'image/png', family: undefined }, pngBytes());

    const b = folderProvider(dir, 'proj-1').assets!;
    expect((await b.list()).map(m => m.id).sort()).toEqual(['font-1', 'img-2']);
    expect(Array.from((await b.get('font-1'))!.slice(0, 4))).toEqual([0, 1, 0, 0]);
    expect(Array.from(dir.node.dirs.keys())).toEqual(['asterism-proj-1.assets']);
  });

  it('survives a half-written list', async () => {
    const dir = fakeFolder();
    const p = folderProvider(dir, 'proj-1').assets!;
    await p.put(META, fontBytes());
    dir.node.dirs.get('asterism-proj-1.assets')!.files.set('manifest.json', { bytes: new TextEncoder().encode('[{"id":'), lastModified: 9 });
    expect(await p.list()).toEqual([]);
    await p.put({ ...META, id: 'font-2' }, fontBytes());
    expect((await p.list()).map(m => m.id)).toEqual(['font-2']);
  });
});

describe('the reference server', () => {
  let dir = '';
  const servers: ReturnType<typeof createSyncServer>[] = [];
  afterAll(async () => {
    await Promise.all(servers.map(s => new Promise(res => s.close(res))));
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  const start = async (token = '') => {
    dir = await mkdtemp(join(tmpdir(), 'asterism-assets-'));
    const server = createSyncServer({ dir, token });
    await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  it('stores a font and a picture, lists them, serves them back, and keeps the first copy', async () => {
    const url = await start('tok');
    const a = httpProvider({ url, token: 'tok' }, 'proj-1').assets!;
    expect(await a.list()).toEqual([]);
    expect(await a.get('font-1')).toBeUndefined();
    await a.put(META, fontBytes());
    await a.put({ ...META, id: 'img-1', kind: 'image', type: 'image/png', family: undefined }, pngBytes());

    const b = httpProvider({ url, token: 'tok' }, 'proj-1').assets!;
    const list = await b.list();
    expect(list.map(m => m.id).sort()).toEqual(['font-1', 'img-1']);
    expect(list.find(m => m.id === 'font-1')).toMatchObject({ family: 'Brandish Serif', size: 200 });
    expect(Array.from((await b.get('img-1'))!)).toEqual(Array.from(pngBytes()));

    await b.put(META, new Uint8Array(200).fill(9)); // same id again: ignored
    expect((await b.get('font-1'))![10]).toBe(7);
  });

  it('refuses a wrong token and a bad id', async () => {
    const url = await start('right');
    await expect(httpProvider({ url, token: 'wrong' }, 'proj-1').assets!.list()).rejects.toThrow('access token');
    const res = await fetch(`${url}/projects/proj-1/assets/..%2Fescape`, { headers: { Authorization: 'Bearer right' } });
    expect(res.status).toBe(400);
  });

  it('moves files for two devices end to end', async () => {
    const url = await start();
    const a = phoneWithFont();
    const b = device();
    await syncAssets(project(), httpProvider({ url }, 'proj-1').assets!, a.local);
    const got = await syncAssets(project(), httpProvider({ url }, 'proj-1').assets!, b.local);
    expect(got.received).toBe(1);
    expect(b.state.fonts[0].family).toBe('Brandish Serif');
  });
});

function phoneWithFont() {
  return device({ blobs: { 'font-1': fontBytes() }, fonts: [font('font-1', 'Brandish Serif')] });
}

describe('device to device', () => {
  const wire = () => {
    const a: Channel = { onmessage: null, send: d => { setTimeout(() => b.onmessage?.(d), 0); } };
    const b: Channel = { onmessage: null, send: d => { setTimeout(() => a.onmessage?.(d), 0); } };
    return [a, b] as const;
  };

  it('lets the device that made the code hand over, and take, files', async () => {
    const host = phoneWithFont();
    const [hostEnd, guestEnd] = wire();
    const current = project();
    const served = { kind: 'peer' as const, label: 'host', read: async () => ({ doc: null }), write: async () => undefined, assets: channelFor(host.local, () => current) };
    servePeer(hostEnd, served);
    const guest = peerProvider(guestEnd, 'Phone');

    const laptop = device();
    const got = await syncAssets(current, guest.assets!, laptop.local);
    expect(got).toMatchObject({ received: 1, failed: [] });
    expect(laptop.state.fonts[0].family).toBe('Brandish Serif');

    // and the other direction: the guest has a font the host lacks.
    const bare = device();
    const [h2, g2] = wire();
    servePeer(h2, { ...served, assets: channelFor(bare.local, () => current) });
    await syncAssets(current, peerProvider(g2, 'Phone').assets!, host.local);
    expect(bare.state.fonts.map(f => f.family)).toEqual(['Brandish Serif']);
  });
});

describe('a sync file you carry', () => {
  it('holds the files inside it and hands them to the next device', async () => {
    const a = phoneWithFont();
    const out = fileProvider(null, 'laptop.sync.json');
    await syncAssets(project(), out.assets!, a.local);
    await out.write(makeDoc(project(), 1, { id: 'd', name: 'Phone' }));
    const doc = out.carry()!;
    expect(doc.assets).toHaveLength(1);
    expect(doc.assets![0]).toMatchObject({ id: 'font-1', family: 'Brandish Serif' });

    // through JSON, as a real file would travel.
    const reopened = fileProvider(JSON.parse(JSON.stringify(doc)), 'laptop.sync.json');
    const b = device();
    const got = await syncAssets(project(), reopened.assets!, b.local);
    expect(got.received).toBe(1);
    expect(b.state.fonts[0].family).toBe('Brandish Serif');
  });

  it('is plain when there are no files', async () => {
    const p = fileProvider(null);
    await p.write(makeDoc(project(), 1, { id: 'd', name: 'x' }));
    expect(p.carry()!.assets).toBeUndefined();
  });
});

// ---- the writer's themes and sounds ------------------------------------------------------------------

const theme = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, name, bgApp: '#fff', bgPaper: '#fff', textMain: '#000', textSecondary: '#444', accentPrimary: '#a00', accentGold: '#cc0', borderSubtle: '#ddd', borderStrong: '#999', cornerRoundness: 8, ...over }) as unknown as Extras['themes'][number];
const sampleSound = (id: string, letter: string) => ({ id, name: 'Rec', type: 'sample' as const, sample: { letter, variation: 0.2, gain: 1 } }) as unknown as Extras['sounds'][number];

describe('themes and sounds', () => {
  it('reach another device with their pictures and recordings, and are left alone when nothing changed', async () => {
    const remote = memoryChannel();
    const a = device({
      blobs: { 'img-9': pngBytes(), 'snd-1': new Uint8Array([82, 73, 70, 70, 1, 2]) },
      extras: {
        themes: [theme('t1', 'Dusk', { appBgImageId: 'img-9' })],
        sounds: [sampleSound('custom-a', 'snd-1')],
        stamps: { [themeKey('t1')]: { at: 10 }, [soundKey('custom-a')]: { at: 10 } },
      },
    });
    const first = await syncAssets(project(), remote, a.local);
    expect(first).toMatchObject({ sent: 2, extras: true, failed: [] });

    const b = device();
    const got = await syncAssets(project(), remote, b.local);
    expect(got).toMatchObject({ received: 2, failed: [] });
    expect(b.state.extras.themes.map(t => t.name)).toEqual(['Dusk']);
    expect(b.state.extras.sounds.map(x => x.id)).toEqual(['custom-a']);
    expect(Array.from(b.blobs.keys()).sort()).toEqual(['img-9', 'snd-1']);
    expect(b.state.imagesChanged).toBe(1);

    const stable = await syncAssets(project(), remote, b.local);
    expect(stable).toMatchObject({ sent: 0, received: 0, removed: 0 });
  });

  it('carries an edit from the device that made it, and a deletion too', async () => {
    const remote = memoryChannel();
    const a = device({ extras: { themes: [theme('t1', 'Dusk')], stamps: { [themeKey('t1')]: { at: 10 } } } });
    const b = device();
    await syncAssets(project(), remote, a.local);
    await syncAssets(project(), remote, b.local);

    // b renames it later; a has not touched it.
    b.state.extras = { ...b.state.extras, themes: [theme('t1', 'Dawn')], stamps: stamped(b.state.extras.stamps, themeKey('t1'), false, 20) };
    await syncAssets(project(), remote, b.local);
    await syncAssets(project(), remote, a.local);
    expect(a.state.extras.themes.map(t => t.name)).toEqual(['Dawn']);

    // a deletes it; b must not bring it back.
    a.state.extras = { ...a.state.extras, themes: [], stamps: stamped(a.state.extras.stamps, themeKey('t1'), true, 30) };
    await syncAssets(project(), remote, a.local);
    await syncAssets(project(), remote, b.local);
    expect(b.state.extras.themes).toEqual([]);
    await syncAssets(project(), remote, a.local);
    expect(a.state.extras.themes).toEqual([]);
  });

  it('lets the newer edit win, and reports a record that is not one', async () => {
    const remote = memoryChannel();
    const a = device({ extras: { themes: [theme('t1', 'New')], stamps: { [themeKey('t1')]: { at: 50 } } } });
    await syncAssets(project(), remote, a.local);
    const b = device({ extras: { themes: [theme('t1', 'Old')], stamps: { [themeKey('t1')]: { at: 5 } } } });
    await syncAssets(project(), remote, b.local);
    expect(b.state.extras.themes[0].name).toBe('New');

    remote.files.set('extras', { meta: { id: 'extras', kind: 'extras', type: 'application/json', size: 3 }, bytes: new TextEncoder().encode('{{{') });
    const c = device();
    const out = await syncAssets(project(), remote, c.local);
    expect(out.failed).toEqual(['themes and sounds']);
    expect(c.state.extras.themes).toEqual([]);
  });

  it('sends nothing when there is nothing to send', async () => {
    const remote = memoryChannel();
    const nothing = await syncAssets(project(), remote, device().local);
    expect(nothing).toMatchObject({ sent: 0, extras: false });
    expect(remote.files.size).toBe(0);
  });
});

// ---- clearing away what nothing uses ----------------------------------------------------------------

describe('clearing away unused files', () => {
  const servers: ReturnType<typeof createSyncServer>[] = [];
  let tmp = '';
  afterAll(async () => {
    await Promise.all(servers.map(sv => new Promise(res => sv.close(res))));
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });
  const startServer = async () => {
    tmp = await mkdtemp(join(tmpdir(), 'asterism-clear-'));
    const server = createSyncServer({ dir: tmp, token: '' });
    await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  it('removes a file once nothing uses it, but keeps what is still used', async () => {
    const remote = memoryChannel();
    const d = device({
      blobs: { 'font-1': fontBytes(), 'img-1': pngBytes() },
      fonts: [font('font-1', 'Brandish Serif')],
      extras: { themes: [theme('t1', 'Dusk', { appBgImageId: 'img-1' })], stamps: { [themeKey('t1')]: { at: 1 } } },
    });
    await syncAssets(project(), remote, d.local);
    expect(Array.from(remote.files.keys()).sort()).toEqual(['extras', 'font-1', 'img-1']);

    // the theme goes away: its picture is cleared, the font the text uses stays.
    d.state.extras = { ...d.state.extras, themes: [], stamps: stamped(d.state.extras.stamps, themeKey('t1'), true, 9) };
    const out = await syncAssets(project(), remote, d.local);
    expect(out.removed).toBe(1);
    expect(Array.from(remote.files.keys()).sort()).toEqual(['extras', 'font-1']);

    // the text stops using the font.
    const plain = project({ chapters: [{ id: 'c1', title: 'One', order: 1, wordCount: 0, status: 'draft', content: '<p>Hello</p>', updatedAt: '' }] } as unknown as Partial<Project>);
    expect((await syncAssets(plain, remote, d.local)).removed).toBe(1);
    expect(Array.from(remote.files.keys())).toEqual(['extras']);
  });

  it('keeps everything when a file failed to move, and skips a side that cannot remove', async () => {
    const remote = memoryChannel();
    remote.files.set('font-old', { meta: { id: 'font-old', kind: 'font', type: 'font/ttf', size: 4, family: 'Old' }, bytes: new Uint8Array([0, 1, 0, 0]) });
    remote.files.set('font-bad', { meta: { id: 'font-bad', kind: 'font', type: 'font/ttf', size: 6, family: 'Brandish Serif' }, bytes: new Uint8Array([1, 2, 3, 4, 5, 6]) });
    const failing = await syncAssets(project(), remote, device().local);
    expect(failing.failed).toEqual(['Brandish Serif']);
    expect(remote.files.has('font-old')).toBe(true); // a failure holds the clean-up back

    const keeper: AssetChannel = {
      list: async () => [{ id: 'font-old', kind: 'font', type: 'font/ttf', size: 4, family: 'Old' }],
      get: async () => undefined,
      put: async () => undefined,
    };
    expect((await syncAssets(project(), keeper, device().local)).removed).toBe(0);
  });

  it('works through a folder and a sync file', async () => {
    const dir = fakeFolder();
    const f = folderProvider(dir, 'proj-1').assets!;
    await f.put(META, fontBytes());
    await f.put({ ...META, id: 'font-2' }, fontBytes());
    await f.remove!('font-1');
    expect((await f.list()).map(m => m.id)).toEqual(['font-2']);
    expect(await f.get('font-1')).toBeUndefined();
    await f.remove!('font-never');

    const file = fileProvider(null).assets!;
    await file.put(META, fontBytes());
    await file.remove!('font-1');
    expect(await file.list()).toEqual([]);
  });

  it('works through the server, which also replaces the themes record but keeps font files', async () => {
    const url = await startServer();
    const a = httpProvider({ url }, 'proj-1').assets!;
    await a.put(META, fontBytes());
    const rec = (text: string) => new TextEncoder().encode(text);
    const extrasMeta = { id: 'extras', kind: 'extras' as const, type: 'application/json', size: 1 };
    await a.put(extrasMeta, rec('{"a":1}'));
    await a.put(extrasMeta, rec('{"a":2}'));
    expect(new TextDecoder().decode((await a.get('extras'))!)).toBe('{"a":2}');

    await a.remove!('font-1');
    expect((await a.list()).map(m => m.id)).toEqual(['extras']);
    expect(await a.get('font-1')).toBeUndefined();
    await a.remove!('font-1'); // already gone: fine
  });
});
