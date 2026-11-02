import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { LinkProvider, type Link } from '../provider';

// two ends of a wire. messages can be held back and delivered later, even out of order, the way a real network behaves.
function wire(opts: { shuffle?: boolean } = {}) {
  const queue: Array<() => void> = [];
  const ends: Link[] = [0, 1].map(() => ({ send: () => undefined, onmessage: null }));
  ends.forEach((end, i) => {
    end.send = data => { const copy = new Uint8Array(data); queue.push(() => ends[1 - i].onmessage?.(copy)); };
  });
  const flush = () => {
    let guard = 0;
    while (queue.length && guard++ < 10_000) {
      const next = opts.shuffle ? queue.splice(Math.floor(Math.random() * queue.length), 1)[0] : queue.shift()!;
      next();
    }
  };
  return { a: ends[0], b: ends[1], flush };
}

const text = (doc: Y.Doc) => doc.getText('t').toString();

function pair(opts?: { shuffle?: boolean; remoteRoleOfB?: 'writer' | 'reader' }) {
  const w = wire(opts);
  const da = new Y.Doc();
  const db = new Y.Doc();
  const pa = new LinkProvider(da, w.a);
  const pb = new LinkProvider(db, w.b, undefined, { remoteRole: opts?.remoteRoleOfB });
  return { da, db, pa, pb, flush: w.flush };
}

describe('the live session provider', () => {
  it('brings a late guest up to date', () => {
    const w = wire();
    const host = new Y.Doc();
    host.getText('t').insert(0, 'Already written.');
    new LinkProvider(host, w.a);
    const guest = new Y.Doc();
    new LinkProvider(guest, w.b);
    w.flush();
    expect(text(guest)).toBe('Already written.');
  });

  it('merges two people typing at once, in any order of arrival', () => {
    for (let round = 0; round < 25; round++) {
      const { da, db, flush } = pair({ shuffle: true });
      da.getText('t').insert(0, 'The quick fox jumps over the dog.');
      flush();
      // both type before either hears of the other's edit
      da.getText('t').insert(10, 'brown ');
      db.getText('t').insert(10, 'red ');
      da.getText('t').insert(da.getText('t').length, ' Ahh!');
      db.getText('t').delete(0, 4);
      flush();
      expect(text(da)).toBe(text(db));
      expect(text(da)).toContain('Ahh!');
      expect(text(da)).toContain('brown');
      expect(text(da)).toContain('red');
    }
  });

  it('keeps edits made while the link was down', () => {
    const w = wire();
    const da = new Y.Doc();
    const db = new Y.Doc();
    da.getText('t').insert(0, 'shared ');
    new LinkProvider(da, w.a);
    new LinkProvider(db, w.b);
    w.flush();
    // a second pair of providers stands in for a reconnect after both sides typed alone
    const w2 = wire();
    da.getText('t').insert(da.getText('t').length, 'from A');
    db.getText('t').insert(0, 'from B ');
    new LinkProvider(da, w2.a);
    new LinkProvider(db, w2.b);
    w2.flush();
    expect(text(da)).toBe(text(db));
    expect(text(da)).toContain('from A');
    expect(text(da)).toContain('from B');
  });

  it('shows where the other person is, and takes the cursor away when they leave', () => {
    const { da, db, pa, pb, flush } = pair();
    pa.awareness.setLocalStateField('user', { name: 'Ada', color: '#e76f51' });
    pb.awareness.setLocalStateField('user', { name: 'Ben', color: '#2a9d8f' });
    flush();
    expect(pb.awareness.getStates().get(da.clientID)).toEqual({ user: { name: 'Ada', color: '#e76f51' } });
    expect(pa.awareness.getStates().get(db.clientID)).toEqual({ user: { name: 'Ben', color: '#2a9d8f' } });
    pa.destroy();
    flush();
    expect(pb.awareness.getStates().has(da.clientID)).toBe(false);
  });

  it('ignores edits from a reader but still shows them the text', () => {
    // A is the host and treats B (remoteRole of the other end, from A's side) as a reader
    const w = wire();
    const host = new Y.Doc();
    host.getText('t').insert(0, 'Chapter one.');
    new LinkProvider(host, w.a, undefined, { remoteRole: 'reader' });
    const reader = new Y.Doc();
    new LinkProvider(reader, w.b);
    w.flush();
    expect(text(reader)).toBe('Chapter one.');
    reader.getText('t').insert(0, 'VANDAL ');
    w.flush();
    expect(text(host)).toBe('Chapter one.');
    // the host's own edits still reach the reader
    host.getText('t').insert(host.getText('t').length, ' More.');
    w.flush();
    expect(text(reader)).toBe('VANDAL Chapter one. More.');
  });

  it('stops talking once it is destroyed', () => {
    const { da, db, pa, flush } = pair();
    flush();
    pa.destroy();
    da.getText('t').insert(0, 'unheard');
    flush();
    expect(text(db)).toBe('');
  });
});
