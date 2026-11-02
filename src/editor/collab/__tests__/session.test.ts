import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { HostSession, joinSession } from '../session';
import { deriveInvite, generatePassword, open, seal } from '../crypto';
import { relayUrl, SessionError } from '../relay';

// every invite costs a deliberately slow key derivation and a reconnect waits out its backoff, so on a busy computer (the whole suite runs at once) the usual 5 seconds is not enough
vi.setConfig({ testTimeout: 30_000 });

// these run against the real relay (server/session-relay.mjs) with real web socket connections on this computer

interface Relay { http: { listen(port: number, cb: () => void): void; address(): { port: number } }; hostKey: string; dropGuests(): void; close(): void }
const path = new URL('../../../../server/session-relay.mjs', import.meta.url).href;
const { createRelay } = (await import(/* @vite-ignore */ path)) as { createRelay(o?: { now?: () => number }): Relay };

let relay: Relay;
let clock = 1_000_000;
const open_: Array<() => void> = [];

async function start() {
  relay = createRelay({ now: () => clock });
  await new Promise<void>(r => relay.http.listen(0, r));
  return `ws://127.0.0.1:${relay.http.address().port}`;
}
afterEach(() => {
  for (const close of open_.splice(0)) close();
  relay?.close();
});

const settle = (ms = 400) => new Promise(r => setTimeout(r, ms));
const text = (d: Y.Doc) => d.getText('t').toString();
const who = (name: string) => ({ name, color: '#888' });

async function host(address: string, doc = new Y.Doc()) {
  const h = await HostSession.start(doc, who('Ada'), address, relay.hostKey);
  open_.push(() => h.end());
  return h;
}
async function guest(address: string, password: string, name: string) {
  const doc = new Y.Doc();
  const g = await joinSession(address, password, doc, who(name));
  open_.push(() => g.leave());
  await settle();
  return { doc, g };
}
const names = (d: Y.Doc, a: { getStates(): Map<number, Record<string, unknown>> }) =>
  [...a.getStates().entries()].filter(([id]) => id !== d.clientID).map(([, s]) => (s.user as { name: string }).name).sort();

describe('a live session through the host\'s relay', () => {
  it('brings guests up to date and carries each guest\'s edits to the others', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    hostDoc.getText('t').insert(0, 'Chapter one.');
    const h = await host(address, hostDoc);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    const cy = await guest(address, h.invite('writer').password, 'Cy');
    expect(text(ben.doc)).toBe('Chapter one.');
    expect(text(cy.doc)).toBe('Chapter one.');
    expect(h.guestCount).toBe(2);

    ben.doc.getText('t').insert(0, 'Ben: ');
    cy.doc.getText('t').insert(cy.doc.getText('t').length, ' Cy.');
    hostDoc.getText('t').insert(6, '!');
    await settle();
    expect(text(hostDoc)).toBe(text(ben.doc));
    expect(text(hostDoc)).toBe(text(cy.doc));
    expect(text(hostDoc)).toContain('Ben: ');
    expect(text(hostDoc)).toContain(' Cy.');
    expect(names(cy.doc, cy.g.awareness)).toEqual(['Ada', 'Ben']);
  });

  it('hosts several documents through one relay at once, each with its own guests', async () => {
    const address = await start();
    const docA = new Y.Doc(); docA.getText('t').insert(0, 'Document A.');
    const docB = new Y.Doc(); docB.getText('t').insert(0, 'Document B.');
    const hostA = await host(address, docA);
    const hostB = await host(address, docB);
    const benInA = await guest(address, hostA.invite('writer').password, 'Ben');
    const cyInB = await guest(address, hostB.invite('writer').password, 'Cy');
    expect(text(benInA.doc)).toBe('Document A.');
    expect(text(cyInB.doc)).toBe('Document B.');

    benInA.doc.getText('t').insert(0, 'Ben in A. ');
    cyInB.doc.getText('t').insert(0, 'Cy in B. ');
    await settle();
    // nothing crosses between the two
    expect(text(docA)).toBe('Ben in A. Document A.');
    expect(text(docB)).toBe('Cy in B. Document B.');
    expect(hostA.guestCount).toBe(1);
    expect(hostB.guestCount).toBe(1);

    // ending one leaves the other running
    let cyEnded = false;
    cyInB.g.onEnded = () => { cyEnded = true; };
    hostA.end();
    await settle();
    expect(cyEnded).toBe(false);
    cyInB.doc.getText('t').insert(0, 'Still here. ');
    await settle();
    expect(text(docB)).toContain('Still here.');
    // and the same person can be in a session of each, on separate connections
    const benInB = await guest(address, hostB.invite('writer').password, 'Ben');
    expect(text(benInB.doc)).toContain('Still here.');
  });

  it('tells a reader they are one, and ignores what they type', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    hostDoc.getText('t').insert(0, 'Draft.');
    const h = await host(address, hostDoc);
    const reader = await guest(address, h.invite('reader').password, 'Beta');
    const writer = await guest(address, h.invite('writer').password, 'Wren');
    expect(reader.g.role).toBe('reader');
    expect(writer.g.role).toBe('writer');
    reader.doc.getText('t').insert(0, 'NOPE ');
    writer.doc.getText('t').insert(6, ' More.');
    await settle();
    expect(text(hostDoc)).toBe('Draft. More.');
    expect(text(writer.doc)).toBe('Draft. More.');
  });

  it('lets an invite be used once, by someone who knows the password', async () => {
    const address = await start();
    const h = await host(address);
    const { password } = h.invite('writer');
    await guest(address, password, 'First');
    await expect(joinSession(address, password, new Y.Doc(), who('Second'))).rejects.toThrow(/not valid/);
    await expect(joinSession(address, 'wrong-password-entirely-here', new Y.Doc(), who('Guess'))).rejects.toThrow(/not valid/);
  });

  it('lets an invite be taken back, and lets it run out', async () => {
    const address = await start();
    const h = await host(address);
    const taken = h.invite('writer');
    taken.cancel();
    await settle();
    await expect(joinSession(address, taken.password, new Y.Doc(), who('Late'))).rejects.toThrow(/not valid/);
    const old = h.invite('writer');
    await settle();
    clock += 16 * 60 * 1000;
    await expect(joinSession(address, old.password, new Y.Doc(), who('TooLate'))).rejects.toThrow(/not valid/);
  });

  it('only lets the host\'s key register as the host', async () => {
    const address = await start();
    await expect(HostSession.start(new Y.Doc(), who('Mallory'), address, 'not-the-key')).rejects.toThrow(/host key is not right/);
    await expect(HostSession.start(new Y.Doc(), who('Mallory'), address, '  ')).rejects.toThrow(/Enter the host key/);
  });

  it('slows down someone guessing invites', async () => {
    const address = await start();
    await host(address);
    let slowed = false;
    for (let i = 0; i < 20 && !slowed; i++) {
      try { await joinSession(address, `guess-${i}-a-b`, new Y.Doc(), who('Guesser')); } catch (e) { slowed = /Too many tries/.test((e as Error).message); }
    }
    expect(slowed).toBe(true);
    // each guess takes a deliberately slow key derivation, so on a busy computer this needs room
  }, 30_000);

  it('clears a cursor when its owner leaves, and counts who is left', async () => {
    const address = await start();
    const h = await host(address);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    const cy = await guest(address, h.invite('writer').password, 'Cy');
    expect(names(cy.doc, cy.g.awareness)).toEqual(['Ada', 'Ben']);
    ben.g.leave();
    await settle();
    expect(h.guestCount).toBe(1);
    expect(names(cy.doc, cy.g.awareness)).toEqual(['Ada']);
  });

  it('tells guests when the host ends the session, and they keep what is on their screen', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    hostDoc.getText('t').insert(0, 'Kept.');
    const h = await host(address, hostDoc);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    let ended = false;
    ben.g.onEnded = () => { ended = true; };
    h.end();
    await settle();
    expect(ended).toBe(true);
    expect(text(ben.doc)).toBe('Kept.');
  });

  it('lets the host send a guest away', async () => {
    const address = await start();
    const h = await host(address);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    let ended = false;
    ben.g.onEnded = () => { ended = true; };
    h.remove([...(h as unknown as { guests: Map<number, unknown> }).guests.keys()][0]);
    await settle();
    expect(ended).toBe(true);
    expect(h.guestCount).toBe(0);
  });

  it('can carry a whole novel\'s worth of text in one go', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    hostDoc.getText('t').insert(0, 'The sea was grey and the gulls were loud. '.repeat(20_000));
    const h = await host(address, hostDoc);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    await settle(400);
    expect(text(ben.doc).length).toBe(text(hostDoc).length);
  });
});

describe('coming back after the connection is lost', () => {
  const until = async (ok: () => boolean, ms = 6000) => { const t = Date.now(); while (!ok() && Date.now() - t < ms) await new Promise(r => setTimeout(r, 50)); return ok(); };

  it('rejoins on its own, and edits made while it was down meet in the middle', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    hostDoc.getText('t').insert(0, 'Shared. ');
    const h = await host(address, hostDoc);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    await until(() => h.guestCount === 1);
    const states: string[] = [];
    ben.g.onState = st => states.push(st);

    relay.dropGuests();
    // both sides write while the line is down
    hostDoc.getText('t').insert(hostDoc.getText('t').length, 'Host kept writing. ');
    ben.doc.getText('t').insert(0, 'Ben kept writing. ');
    expect(await until(() => states.includes('ok'))).toBe(true);
    expect(states[0]).toBe('reconnecting');
    expect(await until(() => text(hostDoc) === text(ben.doc) && text(hostDoc).includes('Ben kept') && text(hostDoc).includes('Host kept'))).toBe(true);
    // one person, not two
    expect(await until(() => h.guestCount === 1)).toBe(true);
    expect(names(hostDoc, h.awareness)).toEqual(['Ben']);
  });

  it('can do it again and again', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    const h = await host(address, hostDoc);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    for (let round = 1; round <= 3; round++) {
      let back = false;
      ben.g.onState = st => { if (st === 'ok') back = true; };
      relay.dropGuests();
      expect(await until(() => back)).toBe(true);
      ben.doc.getText('t').insert(0, `${round}`);
      expect(await until(() => text(hostDoc).includes(`${round}`))).toBe(true);
    }
    expect(text(hostDoc)).toBe(text(ben.doc));
  });

  it('keeps a reader a reader', async () => {
    const address = await start();
    const hostDoc = new Y.Doc();
    hostDoc.getText('t').insert(0, 'Draft.');
    const h = await host(address, hostDoc);
    const reader = await guest(address, h.invite('reader').password, 'Beta');
    let back = false;
    reader.g.onState = st => { if (st === 'ok') back = true; };
    relay.dropGuests();
    expect(await until(() => back)).toBe(true);
    await settle(200);
    expect(reader.g.role).toBe('reader');
    reader.doc.getText('t').insert(0, 'NOPE ');
    await settle(200);
    expect(text(hostDoc)).toBe('Draft.');
  });

  it('does not come back after leaving on purpose', async () => {
    const address = await start();
    const h = await host(address);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    const seen: string[] = [];
    ben.g.onState = st => seen.push(st);
    ben.g.leave();
    await settle(1200);
    expect(seen).toEqual([]);
    expect(h.guestCount).toBe(0);
  });

  it('does not come back after being sent away, or after the host ends the session', async () => {
    const address = await start();
    const h = await host(address);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    const cy = await guest(address, h.invite('writer').password, 'Cy');
    const seen: string[] = [];
    ben.g.onState = st => seen.push('ben ' + st);
    cy.g.onState = st => seen.push('cy ' + st);
    let benEnded = false, cyEnded = false;
    ben.g.onEnded = () => { benEnded = true; };
    cy.g.onEnded = () => { cyEnded = true; };
    h.remove([...(h as unknown as { guests: Map<number, unknown> }).guests.keys()][0]);
    expect(await until(() => benEnded || cyEnded)).toBe(true);
    h.end();
    expect(await until(() => benEnded && cyEnded)).toBe(true);
    await settle(1200);
    expect(seen).toEqual([]);
  });

  it('gives up when the host has forgotten the way back', async () => {
    const address = await start();
    const h = await host(address);
    const ben = await guest(address, h.invite('writer').password, 'Ben');
    // the host's side forgets every ticket, as it would after a restart
    (h as unknown as { waiting: Map<string, unknown> }).waiting.clear();
    (h as unknown as { line: { revoke(id: string): void } }).line.revoke('0'.repeat(64));
    let ended = false;
    ben.g.onEnded = () => { ended = true; };
    // the relay still has the ticket, so ask it to forget too by ending the host's line and starting over would be a restart;
    // here the host simply refuses the arrival, which is what a host that has forgotten it does
    relay.dropGuests();
    expect(await until(() => ended, 8000)).toBe(true);
  });
});

describe('what keeps it private', () => {
  it('scrambles bytes so the relay sees nothing readable, and rejects tampering', () => {
    const keys = deriveInvite('amber-otter-brick-lane');
    const message = new TextEncoder().encode('Leo did not trust the sea.');
    const sealed = seal(keys.key, message);
    expect(new TextDecoder().decode(sealed)).not.toContain('Leo');
    expect(open(keys.key, sealed)).toEqual(message);
    const tampered = sealed.slice();
    tampered[tampered.length - 1] ^= 1;
    expect(open(keys.key, tampered)).toBeNull();
    expect(open(deriveInvite('some-other-password').key, sealed)).toBeNull();
  });

  it('gives the relay an id that is not the password and not the key', () => {
    const keys = deriveInvite('amber-otter-brick-lane');
    expect(keys.id).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.id).not.toContain('amber');
    expect(deriveInvite('  Amber-Otter-Brick-Lane ').id).toBe(keys.id);
  });

  it('makes passwords of four easy words', () => {
    expect(generatePassword()).toMatch(/^[a-z]+(-[a-z]+){3}$/);
    expect(generatePassword()).not.toBe(generatePassword());
  });
});

describe('typing the host\'s address', () => {
  it('understands what people paste', () => {
    expect(relayUrl('https://soft-moon-1234.trycloudflare.com/')).toBe('wss://soft-moon-1234.trycloudflare.com');
    expect(relayUrl('soft-moon-1234.trycloudflare.com')).toBe('wss://soft-moon-1234.trycloudflare.com');
    expect(relayUrl('192.168.254.28:8788')).toBe('ws://192.168.254.28:8788');
    expect(relayUrl('localhost:8788')).toBe('ws://localhost:8788');
    expect(relayUrl('http://my-pc.local:8788')).toBe('ws://my-pc.local:8788');
    expect(relayUrl('wss://example.com')).toBe('wss://example.com');
    expect(() => relayUrl('  ')).toThrow(SessionError);
  });
});

