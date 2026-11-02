import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { LinkProvider, type Link, type Role } from './provider';
import { deriveInvite, generatePassword, newTicket, open, seal, ticketId, type InviteKeys } from './crypto';
import { connectGuest, connectHost, SessionError, type GuestLine, type HostLine } from './relay';

// a live writing session. one person hosts and everyone else connects to the host's own relay, so the host is the one place
// every edit passes through (and the one who decides who may write). nothing goes through a server of ours: the relay runs on
// the host's computer, and what crosses it (and any tunnel the host puts in front of it) is scrambled with the invite password.
//
// a guest who loses their connection comes back on their own: once in, the host gives them a one-time ticket, and they use it to
// rejoin (and are handed a fresh one). if the host's own connection is the one that went, guests simply keep trying until it is back.

export interface Who { name: string; color: string }

export interface Invite {
  // what to tell the person, along with the host's address
  password: string;
  role: Role;
  // true once someone has joined with it
  used: boolean;
  cancel(): void;
}

// how long a rejoin ticket stays good, and how long a guest keeps trying before giving up
const TICKET_SECONDS = 60 * 60;
const GIVE_UP_MS = 30 * 60 * 1000;
// a connection that has said nothing for this long is treated as lost. the host's cursor updates alone arrive every ~15 seconds.
const QUIET_MS = 35 * 1000;

interface Waiting { role: Role; keys: InviteKeys; invite?: Invite; replaces?: number }
interface Entry { provider: LinkProvider; keys: InviteKeys; link: Link; ticket: string }

export class HostSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  private readonly line: HostLine;
  private readonly waiting = new Map<string, Waiting>();
  private readonly guests = new Map<number, Entry>();
  // called when someone joins or leaves
  onGuests: ((count: number) => void) | null = null;
  // called when the relay goes away; the document keeps what was written
  onClosed: (() => void) | null = null;

  constructor(doc: Y.Doc, who: Who, line: HostLine) {
    this.doc = doc;
    this.line = line;
    this.awareness = new Awareness(doc);
    this.awareness.setLocalStateField('user', who);

    line.onGuest = (g, id) => this.arrive(g, id);
    line.onLeft = g => this.leave(g);
    line.onData = (g, data) => {
      const entry = this.guests.get(g);
      // anything that was not scrambled with this guest's key is not from this guest
      const plain = entry && open(entry.keys.key, data);
      if (entry && plain) entry.link.onmessage?.(plain);
    };
    line.onClose = () => { this.dropAll(); this.onClosed?.(); };
  }

  static async start(doc: Y.Doc, who: Who, relayAddress: string, hostKey: string): Promise<HostSession> {
    return new HostSession(doc, who, await connectHost(relayAddress, hostKey));
  }

  get guestCount() { return this.guests.size; }

  // a one-person, one-use invite that stops working after a while
  invite(role: Role, password: string = generatePassword()): Invite {
    const keys = deriveInvite(password);
    const invite: Invite = { password, role, used: false, cancel: () => { this.waiting.delete(keys.id); this.line.revoke(keys.id); } };
    this.waiting.set(keys.id, { role, keys, invite });
    this.line.invite(keys.id);
    return invite;
  }

  private arrive(g: number, id: string) {
    const way = this.waiting.get(id);
    if (!way) { this.line.kick(g); return; }
    this.waiting.delete(id);
    if (way.invite) way.invite.used = true;
    // someone coming back: their old, silent connection is replaced
    if (way.replaces !== undefined) this.leave(way.replaces, true);

    const link: Link = { onmessage: null, send: data => this.line.send(g, seal(way.keys.key, data)) };
    const provider = new LinkProvider(this.doc, link, this.awareness, { remoteRole: way.role });
    // a ticket for the next time this person has to come back
    const ticket = newTicket();
    const tid = ticketId(ticket);
    this.waiting.set(tid, { role: way.role, keys: way.keys, replaces: g });
    this.line.invite(tid, TICKET_SECONDS);
    provider.sendTicket(ticket);
    // leaving on purpose takes the ticket with it
    provider.onBye = () => this.dropTicket(tid);
    this.guests.set(g, { provider, keys: way.keys, link, ticket: tid });
    this.onGuests?.(this.guests.size);
  }

  private dropTicket(tid: string) {
    this.waiting.delete(tid);
    this.line.revoke(tid);
  }

  // their cursor goes and nothing more is sent
  private leave(g: number, keepCursors = false) {
    const entry = this.guests.get(g);
    if (!entry) return;
    entry.provider.drop(keepCursors);
    this.guests.delete(g);
    this.onGuests?.(this.guests.size);
  }

  // sends one guest away for good
  remove(g: number) {
    const entry = this.guests.get(g);
    if (entry) this.dropTicket(entry.ticket);
    this.line.kick(g);
    this.leave(g);
  }

  private dropAll() { for (const g of [...this.guests.keys()]) this.leave(g); }

  // ends the session for everyone. the document keeps what was written.
  end() {
    this.line.onClose = null;
    this.line.close();
    this.dropAll();
    this.awareness.destroy();
  }
}

export class GuestSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  provider!: LinkProvider;
  // set when the host ends the session, sends this person away, or the connection could not be won back
  onEnded: (() => void) | null = null;
  // 'reconnecting' while the connection is down and being retried, 'ok' once it is back
  onState: ((state: 'ok' | 'reconnecting') => void) | null = null;
  // what the host says this person may do. it can change when they come back.
  onRole: ((role: Role) => void) | null = null;

  private line!: GuestLine;
  private readonly keys: InviteKeys;
  private readonly address: string;
  private ticket: string | null = null;
  private closing = false;
  private retrying = false;
  private lastHeard = Date.now();
  private wake: (() => void) | null = null;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly onOnline = () => this.wake?.();
  // the browser says the network is gone: no need to wait for the line to go quiet
  private readonly onOffline = () => { if (!this.closing && !this.retrying) this.lost(1006, true); };

  constructor(doc: Y.Doc, who: Who, line: GuestLine, keys: InviteKeys, address: string) {
    this.doc = doc;
    this.keys = keys;
    this.address = address;
    this.awareness = new Awareness(doc);
    this.awareness.setLocalStateField('user', who);
    this.attach(line);
    // a connection can die without saying so; the host's cursor updates mean silence for this long is not normal
    this.timer = setInterval(() => {
      if (this.closing || this.retrying) return;
      if (Date.now() - this.lastHeard > QUIET_MS) this.lost(1006, true);
    }, 5000);
    if (typeof window !== 'undefined') { window.addEventListener('online', this.onOnline); window.addEventListener('offline', this.onOffline); }
  }

  get role(): Role { return this.provider.role; }

  private attach(line: GuestLine) {
    this.line = line;
    this.lastHeard = Date.now();
    const link: Link = { onmessage: null, send: data => line.send(seal(this.keys.key, data)) };
    line.onData = data => { this.lastHeard = Date.now(); const plain = open(this.keys.key, data); if (plain) link.onmessage?.(plain); };
    this.provider = new LinkProvider(this.doc, link, this.awareness);
    this.provider.onTicket = t => { this.ticket = t; };
    this.provider.onRole = r => this.onRole?.(r);
    line.onClose = code => this.lost(code, false);
  }

  // the connection went. a final answer from the host ends things; anything else is worth trying again
  private lost(code: number, silent: boolean) {
    if (this.closing || this.retrying) return;
    if (silent) { this.line.onClose = null; try { this.line.close(); } catch { /* already dead */ } }
    this.provider.drop();
    if (code === 4000 || code === 4001 || code === 1000 || !this.ticket) { this.finish(); return; }
    void this.reconnect();
  }

  private finish() {
    clearInterval(this.timer);
    if (typeof window !== 'undefined') { window.removeEventListener('online', this.onOnline); window.removeEventListener('offline', this.onOffline); }
    this.onEnded?.();
  }

  private pause(ms: number) {
    return new Promise<void>(resolve => {
      const t = setTimeout(resolve, ms);
      this.wake = () => { clearTimeout(t); resolve(); };
    });
  }

  private async reconnect() {
    this.retrying = true;
    this.onState?.('reconnecting');
    const started = Date.now();
    let wait = 500;
    while (!this.closing && Date.now() - started < GIVE_UP_MS && this.ticket) {
      try {
        const line = await connectGuest(this.address, ticketId(this.ticket));
        if (this.closing) { line.close(); return; }
        // the ticket is used; the host hands over a new one
        this.ticket = null;
        this.retrying = false;
        this.attach(line);
        // the host removed this person's cursor when the line dropped, and would ignore an old-looking update to bring it back,
        // so the cursor is refreshed twice to be newer than the removal
        const state = this.awareness.getLocalState();
        this.awareness.setLocalState(null);
        this.awareness.setLocalState(state);
        this.onState?.('ok');
        return;
      } catch (e) {
        // the host has forgotten this ticket (it restarted, or sent us away): there is no way back
        if (e instanceof SessionError && e.code === 4001) break;
      }
      await this.pause(wait + Math.random() * 300);
      wait = Math.min(wait * 2, 15000);
    }
    this.retrying = false;
    if (!this.closing) this.finish();
  }

  leave() {
    this.closing = true;
    clearInterval(this.timer);
    if (typeof window !== 'undefined') { window.removeEventListener('online', this.onOnline); window.removeEventListener('offline', this.onOffline); }
    this.wake?.();
    // the host should forget this person's ticket
    try { this.provider.sendBye(); } catch { /* the line may already be down */ }
    this.line.onClose = null;
    this.provider.destroy();
    this.line.close();
  }
}

export async function joinSession(address: string, password: string, doc: Y.Doc, who: Who): Promise<GuestSession> {
  const keys = deriveInvite(password);
  const line = await connectGuest(address, keys.id);
  return new GuestSession(doc, who, line, keys, address);
}
