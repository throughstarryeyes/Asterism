import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// keeps one shared document in step with whoever is on the other end of a link. a link is anything that carries bytes both
// ways: a browser tab today, a direct connection between two computers in a live session. the provider does not care which.

export interface Link {
  send(data: Uint8Array): void;
  // set by the provider; called with each message that arrives
  onmessage: ((data: Uint8Array) => void) | null;
}

const SYNC = 0;
const AWARENESS = 1;
const HELLO = 2; // "I just arrived: tell me what you have, and take my news"
const ROLE = 3; // the host telling a guest what they may do
const TICKET = 4; // the host giving a guest a one-time way back in
const BYE = 5; // a guest leaving on purpose

// who may change the text. a reader's edits are dropped at the door, so only a co-writer can write.
export type Role = 'writer' | 'reader';

export interface ProviderOptions {
  // what the other end is allowed to do. a reader's edits are ignored, and the other end is told so (it should then lock its editor).
  remoteRole?: Role;
}

export class LinkProvider {
  readonly awareness: awarenessProtocol.Awareness;
  private closed = false;
  private readonly remoteRole: Role;
  private readonly tellRole: boolean;
  // what the host says this end may do. a guest locks its editor when it is 'reader'.
  role: Role = 'writer';
  onRole: ((role: Role) => void) | null = null;
  // a guest is handed a ticket by the host; the host hears when a guest leaves on purpose
  onTicket: ((ticket: string) => void) | null = null;
  onBye: (() => void) | null = null;
  // the cursors that belong to the other end, so they can be cleared when it drops
  private readonly theirs = new Set<number>();
  readonly doc: Y.Doc;
  private readonly link: Link;

  constructor(doc: Y.Doc, link: Link, awareness?: awarenessProtocol.Awareness, options: ProviderOptions = {}) {
    this.doc = doc;
    this.link = link;
    this.awareness = awareness ?? new awarenessProtocol.Awareness(doc);
    this.remoteRole = options.remoteRole ?? 'writer';
    this.tellRole = options.remoteRole !== undefined;

    doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
    link.onmessage = data => this.receive(data);

    // introduce ourselves: ask for their text, send ours, and let them know we are here
    this.post(HELLO, () => undefined);
    this.announceRole();
    this.post(SYNC, e => syncProtocol.writeSyncStep1(e, doc));
    this.shareAwareness([...this.awareness.getStates().keys()]);
  }

  private post(type: number, write: (e: encoding.Encoder) => void) {
    if (this.closed) return;
    const e = encoding.createEncoder();
    encoding.writeVarUint(e, type);
    write(e);
    this.link.send(encoding.toUint8Array(e));
  }

  sendTicket(ticket: string) { this.post(TICKET, e => encoding.writeVarString(e, ticket)); }
  sendBye() { this.post(BYE, () => undefined); }

  private announceRole() {
    if (this.tellRole) this.post(ROLE, e => encoding.writeVarString(e, this.remoteRole));
  }

  private shareAwareness(clients: number[]) {
    this.post(AWARENESS, e => encoding.writeVarUint8Array(e, awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients)));
  }

  // an edit made here goes to the other end. one that came from there is not sent back.
  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return;
    this.post(SYNC, e => syncProtocol.writeUpdate(e, update));
  };

  private onAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === this) {
      added.forEach(id => this.theirs.add(id));
      removed.forEach(id => this.theirs.delete(id));
      return;
    }
    this.shareAwareness([...added, ...updated, ...removed]);
  };

  private receive(data: Uint8Array) {
    if (this.closed) return;
    const decoder = decoding.createDecoder(data);
    const type = decoding.readVarUint(decoder);
    if (type === HELLO) {
      this.announceRole();
      this.post(SYNC, e => syncProtocol.writeSyncStep1(e, this.doc));
      this.shareAwareness([...this.awareness.getStates().keys()]); // everyone already here, not just us
    } else if (type === SYNC) {
      const reply = encoding.createEncoder();
      encoding.writeVarUint(reply, SYNC);
      const kind = decoding.readVarUint(decoder);
      if (kind === syncProtocol.messageYjsSyncStep1) {
        syncProtocol.readSyncStep1(decoder, reply, this.doc);
      } else if (this.remoteRole === 'writer') {
        // step 2 and live updates both carry changes
        const body = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(this.doc, body, this);
      }
      if (encoding.length(reply) > 1) this.link.send(encoding.toUint8Array(reply));
    } else if (type === AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
    } else if (type === TICKET) {
      // only a guest takes a ticket, and only from the host
      const ticket = decoding.readVarString(decoder);
      if (!this.tellRole) this.onTicket?.(ticket);
    } else if (type === BYE) {
      if (this.tellRole) this.onBye?.();
    } else if (type === ROLE) {
      this.role = decoding.readVarString(decoder) === 'reader' ? 'reader' : 'writer';
      this.onRole?.(this.role);
    }
  }

  // the other end dropped off: their cursors go, and nothing more is sent
  // `keepCursors` when the same person is about to come back on a new connection, so their name does not flicker away
  drop(keepCursors = false) {
    if (this.closed) return;
    if (!keepCursors) awarenessProtocol.removeAwarenessStates(this.awareness, [...this.theirs], 'dropped');
    this.theirs.clear();
    this.closed = true;
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.link.onmessage = null;
  }

  // leaving: the cursor goes with us
  destroy() {
    if (this.closed) return;
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'leaving');
    this.closed = true;
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.link.onmessage = null;
  }
}

// a link between two tabs of the same browser, for trying things out
export function tabLink(room: string): Link & { close(): void } {
  const channel = new BroadcastChannel(`asterism_session_${room}`);
  const link: Link & { close(): void } = {
    send: data => channel.postMessage(data),
    onmessage: null,
    close: () => channel.close(),
  };
  channel.onmessage = e => link.onmessage?.(new Uint8Array(e.data as ArrayBuffer));
  return link;
}
