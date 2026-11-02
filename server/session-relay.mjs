// relay for live writing sessions: the host runs it on their own computer, guests connect to it by address.
// it only passes scrambled bytes between the host and each guest. it never has the password or the key, so it cannot read anything.
// see server/README.md for how to run it and reach it from outside (a private tunnel of your own).

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const MAX_FRAME = 16 * 1024 * 1024;
const INVITE_LIFETIME = 15 * 60 * 1000;
const MAX_GUESTS = 8;
const MAX_HOSTS = 16;
const MAX_INVITES = 64;
const MAX_LIFETIME = 12 * 60 * 60 * 1000; // a rejoin ticket can be asked to last longer than an invite, up to this
const PING_EVERY = 20 * 1000;
const WINDOW = 60 * 1000;
const TRIES_PER_WINDOW = 12;

const ID = /^[0-9a-f]{64}$/;

const equal = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// who is asking: behind a tunnel the real address arrives in a header
const addressOf = (req) => String(req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();

export function createRelay({ hostKey = randomBytes(16).toString('hex'), now = () => Date.now() } = {}) {
  // every host has its own set of invites and guests, so several documents can be hosted through one relay at once
  const hosts = new Set(); // { ws, invites: Map<id, expires>, guests: Map<number, ws> }
  let nextGuest = 1;
  const tries = new Map(); // address -> recent attempt times

  const limited = (addr) => {
    const t = now();
    const recent = (tries.get(addr) ?? []).filter((x) => t - x < WINDOW);
    recent.push(t);
    tries.set(addr, recent);
    return recent.length > TRIES_PER_WINDOW;
  };

  const say = (ws, message) => { if (ws.readyState === 1) ws.send(JSON.stringify(message)); };

  const http = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Asterism session relay\n');
  });
  const wss = new WebSocketServer({ server: http, maxPayload: MAX_FRAME });

  wss.on('connection', (ws, req) => {
    const addr = addressOf(req);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    let role = null; // 'host' | 'guest'
    let guestId = 0;
    let mine = null; // this connection's host record, when it is a host
    let home = null; // the host record a guest belongs to
    const timer = setTimeout(() => { if (!role) ws.close(4002, 'no hello'); }, 10_000);
    ws.on('close', () => {
      clearTimeout(timer);
      if (role === 'host' && mine) {
        for (const g of mine.guests.values()) g.close(4000, 'host left');
        hosts.delete(mine);
      } else if (role === 'guest' && home && hosts.has(home)) {
        home.guests.delete(guestId);
        say(home.ws, { t: 'left', g: guestId });
      }
    });
    ws.on('error', () => undefined);

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const bytes = Buffer.from(data);
        if (role === 'guest' && home && hosts.has(home)) {
          // to the host, tagged with which guest it came from
          const tag = Buffer.alloc(4);
          tag.writeUInt32BE(guestId);
          if (home.ws.readyState === 1) home.ws.send(Buffer.concat([tag, bytes]), { binary: true });
        } else if (role === 'host' && mine && bytes.length > 4) {
          const g = mine.guests.get(bytes.readUInt32BE(0));
          if (g && g.readyState === 1) g.send(bytes.subarray(4), { binary: true });
        }
        return;
      }
      let m;
      try { m = JSON.parse(String(data)); } catch { return ws.close(4003, 'bad message'); }
      if (!role) {
        if (m.t === 'host') {
          if (limited(addr)) return ws.close(4004, 'slow down');
          if (!equal(m.key ?? '', hostKey)) return ws.close(4001, 'wrong key');
          if (hosts.size >= MAX_HOSTS) return ws.close(4004, 'too many sessions');
          role = 'host';
          mine = { ws, invites: new Map(), guests: new Map() };
          hosts.add(mine);
          return say(ws, { t: 'ready' });
        }
        if (m.t === 'join') {
          if (limited(addr)) return ws.close(4004, 'slow down');
          // whichever host made this invite is the one being joined
          let owner = null;
          if (ID.test(m.id ?? '')) for (const h of hosts) if (h.invites.has(m.id)) { owner = h; break; }
          const open = owner ? owner.invites.get(m.id) : undefined;
          if (!owner || !open || open < now() || owner.guests.size >= MAX_GUESTS) return ws.close(4001, 'no such invite');
          owner.invites.delete(m.id); // an invite is for one person
          role = 'guest';
          home = owner;
          guestId = nextGuest++;
          owner.guests.set(guestId, ws);
          say(ws, { t: 'ok' });
          return say(owner.ws, { t: 'guest', g: guestId, id: m.id });
        }
        return ws.close(4003, 'bad hello');
      }
      if (role === 'host' && mine) {
        if (m.t === 'invite' && ID.test(m.id ?? '') && mine.invites.size < MAX_INVITES) mine.invites.set(m.id, now() + Math.min(Math.max(Number(m.ttl) * 1000 || INVITE_LIFETIME, 60 * 1000), MAX_LIFETIME));
        else if (m.t === 'revoke') mine.invites.delete(m.id);
        else if (m.t === 'kick') mine.guests.get(m.g)?.close(4000, 'removed');
      }
    });
  });

  // a connection that has gone quiet without saying goodbye (wifi lost, laptop shut) is found and closed, so its owner can come back
  const beat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_EVERY);
  beat.unref();

  return {
    http, hostKey,
    // for tests: cut every guest's connection the way a lost network would, with no goodbye
    dropGuests: () => { hosts.forEach(h => h.guests.forEach(g => g.terminate())); },
    close: () => { clearInterval(beat); wss.close(); http.close(); },
  };
}

// run it directly: node server/session-relay.mjs
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 8788);
  const relay = createRelay({ hostKey: process.env.ASTERISM_HOST_KEY || undefined });
  relay.http.listen(port, () => {
    console.log(`Asterism session relay on port ${port}`);
    console.log(`Host key (only the host needs this): ${relay.hostKey}`);
  });
}
