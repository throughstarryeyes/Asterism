// talking to a session relay (server/session-relay.mjs): the host's own, on their own computer or behind their own tunnel.
// the relay hands bytes along without being able to read them; scrambling and unscrambling happen at the two ends.

export class SessionError extends Error {
  // the relay's reason for refusing, when it gave one
  code?: number;
  constructor(message: string, code?: number) { super(message); this.name = 'SessionError'; this.code = code; }
}

// what a writer might type: a full web address, a host and port, or just a host
export function relayUrl(address: string): string {
  const a = address.trim().replace(/\/+$/, '');
  if (!a) throw new SessionError('Enter the host’s address.');
  if (/^wss?:\/\//i.test(a)) return a;
  if (/^https:\/\//i.test(a)) return 'wss://' + a.slice(8);
  if (/^http:\/\//i.test(a)) return 'ws://' + a.slice(7);
  // an address on your own network has no certificate, so it is plain; anything on the internet is secure
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i.test(a) || /\.local(:\d+)?$/i.test(a);
  return (local ? 'ws://' : 'wss://') + a;
}

// what a refusal means depends on who is asking
const GUEST_WHY: Record<number, string> = {
  4001: 'That invite is not valid. It may have been used already, or it has expired.',
  4004: 'Too many tries. Wait a minute and try again.',
};
const HOST_WHY: Record<number, string> = {
  4001: 'That host key is not right. The relay prints it when it starts.',
  4004: 'Too many tries. Wait a minute and try again.',
};

function open(url: string, hello: object, why: Record<number, string>): Promise<{ ws: WebSocket; first: string }> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try { ws = new WebSocket(relayUrl(url)); } catch (e) { return reject(e instanceof SessionError ? e : new SessionError('That address does not look right.')); }
    ws.binaryType = 'arraybuffer';
    const fail = new SessionError('Could not reach the host at that address. Check it, and that the host is running.');
    const timer = setTimeout(() => { ws.close(); reject(fail); }, 15_000);
    ws.onopen = () => ws.send(JSON.stringify(hello));
    ws.onerror = () => { clearTimeout(timer); reject(fail); };
    ws.onclose = (e) => { clearTimeout(timer); reject(new SessionError(why[e.code] ?? fail.message, e.code)); };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      clearTimeout(timer);
      resolve({ ws, first: e.data });
    };
  });
}

export interface HostLine {
  // `ttl` is how many seconds it should stay good for (the relay allows up to twelve hours)
  invite(id: string, ttl?: number): void;
  revoke(id: string): void;
  kick(guest: number): void;
  send(guest: number, data: Uint8Array): void;
  onGuest: ((guest: number, id: string) => void) | null;
  onLeft: ((guest: number) => void) | null;
  onData: ((guest: number, data: Uint8Array) => void) | null;
  onClose: (() => void) | null;
  close(): void;
}

export async function connectHost(address: string, hostKey: string): Promise<HostLine> {
  if (!hostKey.trim()) throw new SessionError('Enter the host key. The relay prints it when it starts.');
  const { ws, first } = await open(address, { t: 'host', key: hostKey }, HOST_WHY);
  if (JSON.parse(first).t !== 'ready') throw new SessionError('The relay did not accept this computer as the host.');
  const line: HostLine = {
    invite: (id, ttl) => ws.send(JSON.stringify({ t: 'invite', id, ...(ttl ? { ttl } : {}) })),
    revoke: id => ws.send(JSON.stringify({ t: 'revoke', id })),
    kick: g => ws.send(JSON.stringify({ t: 'kick', g })),
    send: (g, data) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const out = new Uint8Array(4 + data.length);
      new DataView(out.buffer).setUint32(0, g);
      out.set(data, 4);
      ws.send(out);
    },
    onGuest: null, onLeft: null, onData: null, onClose: null,
    close: () => ws.close(),
  };
  ws.onmessage = e => {
    if (typeof e.data === 'string') {
      const m = JSON.parse(e.data) as { t: string; g: number; id: string };
      if (m.t === 'guest') line.onGuest?.(m.g, m.id);
      else if (m.t === 'left') line.onLeft?.(m.g);
    } else {
      const bytes = new Uint8Array(e.data as ArrayBuffer);
      if (bytes.length > 4) line.onData?.(new DataView(bytes.buffer, bytes.byteOffset).getUint32(0), bytes.subarray(4));
    }
  };
  ws.onclose = () => line.onClose?.();
  ws.onerror = () => undefined;
  return line;
}

export interface GuestLine {
  send(data: Uint8Array): void;
  onData: ((data: Uint8Array) => void) | null;
  // `code` says why: 4000 means the host ended it or sent this person away, 1006 means the connection was lost
  onClose: ((code: number) => void) | null;
  close(): void;
}

export async function connectGuest(address: string, id: string): Promise<GuestLine> {
  const { ws, first } = await open(address, { t: 'join', id }, GUEST_WHY);
  if (JSON.parse(first).t !== 'ok') throw new SessionError('The host did not accept that invite.');
  const line: GuestLine = {
    send: data => { if (ws.readyState === WebSocket.OPEN) ws.send(new Uint8Array(data)); },
    onData: null, onClose: null,
    close: () => ws.close(),
  };
  ws.onmessage = e => { if (typeof e.data !== 'string') line.onData?.(new Uint8Array(e.data as ArrayBuffer)); };
  ws.onclose = e => line.onClose?.(e.code);
  ws.onerror = () => undefined;
  return line;
}
