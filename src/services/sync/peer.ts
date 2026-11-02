// device to device sync with no server: one device opens a pairing code, the other answers it
// the host keeps its project and answers requests; the guest runs the normal sync against it

import { isSyncDoc, StaleError, type Remote, type SyncDoc, type SyncProvider } from './engine';
import type { AssetChannel, AssetMeta } from './assets';
import { base64ToBytes, bytesToBase64 } from '../exportFonts';

// ---- a message channel that can carry big projects --------------------------------------------------

export interface Channel {
  send(data: string): void;
  onmessage: ((data: string) => void) | null;
  // called once when the other end is gone
  onclose?: (() => void) | null;
}

const PIECE = 12_000;
let counter = 0;

export function sendMessage(channel: Channel, message: unknown): void {
  const text = JSON.stringify(message);
  const id = `${Date.now().toString(36)}${(counter++).toString(36)}`;
  const total = Math.max(1, Math.ceil(text.length / PIECE));
  for (let i = 0; i < total; i++) channel.send(JSON.stringify({ c: id, i, t: total, d: text.slice(i * PIECE, (i + 1) * PIECE) }));
}

// puts pieces back together and hands whole messages on.
export function receiveMessages(channel: Channel, onMessage: (message: unknown) => void): void {
  const partial = new Map<string, string[]>();
  channel.onmessage = raw => {
    let piece: { c: string; i: number; t: number; d: string };
    try { piece = JSON.parse(raw); } catch { return; }
    if (typeof piece.c !== 'string' || typeof piece.d !== 'string') return;
    const parts = partial.get(piece.c) ?? [];
    parts[piece.i] = piece.d;
    partial.set(piece.c, parts);
    if (parts.filter(x => x !== undefined).length === piece.t) {
      partial.delete(piece.c);
      try { onMessage(JSON.parse(parts.join(''))); } catch { /* a garbled message is dropped */ }
    }
  };
}

// ---- asking and answering ---------------------------------------------------------------------------

interface Request {
  id: number;
  op: 'read' | 'write' | 'assets.list' | 'assets.get' | 'assets.put';
  doc?: SyncDoc;
  etag?: string;
  assetId?: string;
  meta?: AssetMeta;
  data?: string; // base64
}
interface Reply { id: number; doc?: SyncDoc | null; etag?: string; stale?: true; error?: string; assets?: AssetMeta[]; data?: string | null }

// the device that made the pairing code answers the other one's requests with this.
export function servePeer(channel: Channel, source: SyncProvider): void {
  receiveMessages(channel, raw => {
    const req = raw as Request;
    if (!req || typeof req.id !== 'number') return;
    const reply = (r: Omit<Reply, 'id'>) => sendMessage(channel, { id: req.id, ...r });
    if (req.op === 'read') {
      source.read().then(r => reply({ doc: r.doc, etag: r.etag }), e => reply({ error: String(e?.message ?? e) }));
    } else if (req.op === 'write' && isSyncDoc(req.doc)) {
      source.write(req.doc, req.etag).then(etag => reply({ etag }), e => (e instanceof StaleError ? reply({ stale: true }) : reply({ error: String(e?.message ?? e) })));
    } else if (req.op.startsWith('assets.')) {
      const files = source.assets;
      const fail = (e: unknown) => reply({ error: String((e as Error)?.message ?? e) });
      if (!files) return reply({ error: 'This device cannot hold files.' });
      if (req.op === 'assets.list') files.list().then(assets => reply({ assets }), fail);
      else if (req.op === 'assets.get' && typeof req.assetId === 'string') files.get(req.assetId).then(bytes => reply({ data: bytes ? bytesToBase64(bytes) : null }), fail);
      else if (req.op === 'assets.put' && req.meta && typeof req.data === 'string') files.put(req.meta, base64ToBytes(req.data)).then(() => reply({}), fail);
    }
  });
}

export function peerProvider(channel: Channel, label: string, timeoutMs = 60_000): SyncProvider {
  let next = 1;
  const waiting = new Map<number, (r: Reply) => void>();
  receiveMessages(channel, raw => {
    const r = raw as Reply;
    waiting.get(r?.id)?.(r);
  });
  const ask = (req: Omit<Request, 'id'>) => new Promise<Reply>((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => { waiting.delete(id); reject(new Error('The other device did not answer. Is it still open?')); }, timeoutMs);
    waiting.set(id, r => { clearTimeout(timer); waiting.delete(id); resolve(r); });
    sendMessage(channel, { id, ...req });
  });
  const answer = async (req: Omit<Request, 'id'>) => {
    const r = await ask(req);
    if (r.error) throw new Error(r.error);
    return r;
  };
  const assets: AssetChannel = {
    async list() { return (await answer({ op: 'assets.list' })).assets ?? []; },
    async get(assetId) {
      const r = await answer({ op: 'assets.get', assetId });
      return r.data ? base64ToBytes(r.data) : undefined;
    },
    async put(meta, bytes) { await answer({ op: 'assets.put', meta, data: bytesToBase64(bytes) }); },
  };
  return {
    kind: 'peer',
    label,
    assets,
    async read(): Promise<Remote> {
      const r = await ask({ op: 'read' });
      if (r.error) throw new Error(r.error);
      return { doc: r.doc ?? null, etag: r.etag };
    },
    async write(doc, etag) {
      const r = await ask({ op: 'write', doc, etag });
      if (r.stale) throw new StaleError();
      if (r.error) throw new Error(r.error);
      return r.etag;
    },
  };
}

// ---- pairing codes (the browser's WebRTC) -----------------------------------------------------------

const encode = (d: RTCSessionDescriptionInit) => btoa(JSON.stringify(d));
const decode = (code: string): RTCSessionDescriptionInit => {
  try { return JSON.parse(atob(code.replace(/\s+/g, ''))); }
  catch { throw new Error('That pairing code does not look right. Copy all of it, with no extra characters.'); }
};

const gathered = (pc: RTCPeerConnection) => new Promise<void>(resolve => {
  if (pc.iceGatheringState === 'complete') return resolve();
  const done = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', done); resolve(); } };
  pc.addEventListener('icegatheringstatechange', done);
  setTimeout(resolve, 4000); // a code with the addresses found so far still works on a home network
});

// two devices on the same network find each other directly. away from home a STUN address can help.
const ICE: RTCConfiguration = { iceServers: [] };

function asChannel(dc: RTCDataChannel, pc?: RTCPeerConnection): Channel {
  // sending into a line that is closing is not an error worth stopping for: the close is reported on its own
  const channel: Channel = { onmessage: null, onclose: null, send: d => { if (dc.readyState === 'open') dc.send(d); } };
  dc.onmessage = e => channel.onmessage?.(String(e.data));
  let gone = false;
  const ended = () => { if (!gone) { gone = true; channel.onclose?.(); } };
  dc.onclose = ended;
  // a connection that dies without a goodbye (lid shut, wifi lost) is noticed here
  pc?.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') ended(); });
  return channel;
}

const opened = (dc: RTCDataChannel) => new Promise<void>((resolve, reject) => {
  if (dc.readyState === 'open') return resolve();
  dc.onopen = () => resolve();
  dc.onerror = () => reject(new Error('The connection to the other device failed.'));
  setTimeout(() => reject(new Error('The devices could not connect. They need to be on the same network, or one of them can allow a relay (see the note under the code).')), 90_000);
});

export interface PairingHost {
  code: string;
  // paste the other device's answer here; resolves when connected.
  accept(answer: string): Promise<Channel>;
  close(): void;
}

export async function openPairing(stun?: string): Promise<PairingHost> {
  const pc = new RTCPeerConnection(stun ? { iceServers: [{ urls: stun }] } : ICE);
  const dc = pc.createDataChannel('asterism-sync');
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return {
    code: encode(pc.localDescription!),
    async accept(answer) {
      await pc.setRemoteDescription(decode(answer));
      await opened(dc);
      return asChannel(dc, pc);
    },
    close: () => pc.close(),
  };
}

export interface PairingGuest {
  answer: string;
  connected: Promise<Channel>;
  close(): void;
}

export async function answerPairing(code: string, stun?: string): Promise<PairingGuest> {
  const pc = new RTCPeerConnection(stun ? { iceServers: [{ urls: stun }] } : ICE);
  const connected = new Promise<Channel>((resolve, reject) => {
    pc.ondatachannel = e => opened(e.channel).then(() => resolve(asChannel(e.channel, pc)), reject);
  });
  connected.catch(() => {});
  await pc.setRemoteDescription(decode(code));
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return { answer: encode(pc.localDescription!), connected, close: () => pc.close() };
}
