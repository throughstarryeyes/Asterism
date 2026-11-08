// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsterismProvider } from '../../../context/AsterismContext';
import { PlayView } from '../PlayView';

// every game opens, takes a few clicks, and does not throw. the logic is tested on its own; this is for the screens.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const errors: unknown[] = [];

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  errors.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a); });
  act(() => root.render(<AsterismProvider><PlayView /></AsterismProvider>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const realErrors = () => errors.filter(e => !String(e).includes('not wrapped in act'));
const text = () => host.textContent ?? '';
const byText = (label: string, tag = 'button') => [...host.querySelectorAll<HTMLElement>(tag)].find(b => b.textContent?.trim() === label);
const click = (label: string, tag = 'button') => { const el = byText(label, tag); if (!el) throw new Error(`no ${tag} "${label}" in: ${text().slice(0, 300)}`); act(() => el.click()); };
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => act(() => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const field = (label: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;

describe('Play', () => {
  it('opens on a home page that lists every collection', () => {
    ['Quick Play', 'Character Lab', 'Story Games', 'Solo Adventures', 'Multiplayer', 'Mysteries'].forEach(c => expect(text()).toContain(c));
    expect(realErrors()).toEqual([]);
  });

  it('opens every game from the menu without an error', () => {
    ['Warm-ups', 'Character Lab', 'Relationship Roulette', 'Missing Scene', 'Roll Your Story', 'Writing together', 'Mystery Builder', 'Kept from Play'].forEach(label => {
      const nav = host.querySelector('nav')!;
      const button = [...nav.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!;
      expect(button, label).toBeTruthy();
      act(() => button.click());
      expect(host.querySelector('h1')?.textContent).toBe(label);
    });
    expect(realErrors()).toEqual([]);
  });

  const open = (label: string) => act(() => [...host.querySelector('nav')!.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!.click());

  it('rolls Relationship Roulette for two named characters, and answers a question', () => {
    open('Relationship Roulette');
    expect(byText('Roll a situation')!.hasAttribute('disabled')).toBe(true);
    const inputs = host.querySelectorAll<HTMLInputElement>('input[placeholder="A name"]');
    type(inputs[0], 'Mara');
    type(inputs[1], 'Tobias');
    click('Roll a situation');
    expect(text()).toContain('The situation');
    expect(text()).toMatch(/Mara|Tobias/);
    expect(text()).not.toMatch(/\{[AB]\}/);
    const answer = host.querySelector<HTMLTextAreaElement>('textarea')!;
    type(answer, 'They both look at the door.');
    expect(answer.value).toBe('They both look at the door.');
    expect(realErrors()).toEqual([]);
  });

  it('plays a Character Lab scenario and then offers to change the circumstances', () => {
    open('Character Lab');
    const select = host.querySelectorAll<HTMLSelectElement>('select')[1];
    expect(select.options.length).toBeGreaterThan(1);
    act(() => { select.value = select.options[1].value; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(text()).toContain('The Unexpected Mercy');
    click('Cover for them, even if it costs something.');
    click('Explore my answer');
    expect(text()).toContain('Now change the circumstances');
    click('What if the person who stole from them was someone they hated?');
    expect(text()).toContain('What if the person who stole from them was someone they hated?');
    click('Say nothing, but quietly distance themselves.');
    click('Explore my answer');
    expect(text()).toMatch(/so far/);
    expect(realErrors()).toEqual([]);
  });

  it('shows Missing Scene suggestions as questions, and lets one be set aside', () => {
    open('Missing Scene');
    expect(text()).toContain('A gap is not a mistake');
    expect(realErrors()).toEqual([]);
  });

  it('starts a solo adventure, asks the oracle, writes in the journal, and saves it as a document', () => {
    open('Roll Your Story');
    click('Start an adventure');
    expect(text()).toContain('The premise');
    expect(text()).toContain('Setting');
    click('Ask');
    expect(host.querySelector('[role="status"]')).toBeTruthy();
    type(field('Add to the journal'), 'The letter is unsigned.');
    click('Add to journal');
    expect(text()).toContain('The letter is unsigned.');
    expect(text()).toMatch(/Oracle/);
    expect(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /stats/i.test(k)) ?? '') || '{}').play?.adventures?.length).toBe(1);
    expect(realErrors()).toEqual([]);
  });

  it('opens a mystery case, follows the leads, and gives a verdict', () => {
    open('Mystery Builder');
    click('Open a case');
    expect(text()).toContain('Where to look');
    const leads = [...host.querySelectorAll<HTMLButtonElement>('button')].filter(b => /^(Ask about|Check|Examine|Search|Look through|Press|Read|Ask who)/.test(b.textContent ?? ''));
    expect(leads.length).toBeGreaterThanOrEqual(6);
    leads.slice(0, 3).forEach(b => act(() => b.click()));
    expect(text()).toContain('What you found');
    const panel = [...host.querySelectorAll('section')].find(p => p.querySelector('h2')?.textContent === 'Name the culprit')!;
    const suspect = [...panel.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')][0];
    act(() => suspect.click());
    click('Accuse');
    expect(text()).toMatch(/It was /);
    expect(realErrors()).toEqual([]);
  });

  it('explains how to start a session when there is none', () => {
    open('Writing together');
    expect(text()).toContain('live session');
    expect(byText('Open live sessions')).toBeTruthy();
    expect(realErrors()).toEqual([]);
  });

  it('runs a warm-up and counts the words', () => {
    open('Warm-ups');
    type(field('Your writing'), 'one two three');
    expect(text()).toContain('3 words');
    expect(realErrors()).toEqual([]);
  });
});

describe('Play with other people', () => {
  const sessionOf = async (name: string, role: 'writer' | 'reader' = 'writer') => {
    const Y = await import('yjs');
    const live = await import('../../../editor/collab/live');
    const doc = new Y.Doc();
    const use = (who: string, r: 'writer' | 'reader' = 'writer') => live.setSession('proj-nereus', { mode: 'joined', doc, who: { name: who, color: '#888' }, role: r, people: ['Ana', 'Ben'] });
    use(name, role);
    return { doc, use, live };
  };
  const open = (label: string) => act(() => [...host.querySelector('nav')!.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!.click());
  afterEach(async () => { (await import('../../../editor/collab/live')).removeSession('proj-nereus'); });

  it('runs a game of Pass the Story through its lobby, a joining player and a turn', async () => {
    const { doc } = await sessionOf('Ana');
    const rooms = await import('../../../services/play/rooms');
    open('Writing together');
    click('Start and invite the others to join');
    expect(text()).toContain('Gathering players');
    expect(byText('Start the game')!.hasAttribute('disabled')).toBe(true);
    const room = rooms.listRooms(doc)[0];
    act(() => rooms.joinRoom(doc, room.id, 'Ben'));
    expect(text()).toContain('Ben');
    click('Start the game');
    expect(text()).toContain('Your turn');
    type(field('Your part of the story'), 'It had been raining for three days.');
    click('Add it');
    expect(text()).toContain('It had been raining for three days.');
    expect(text()).toContain("It is Ben's turn");
    expect(realErrors()).toEqual([]);
  });

  it('keeps a mystery\'s answer off the screen of everyone but the one who made it, until it is revealed', async () => {
    const { doc, use } = await sessionOf('Ana');
    const rooms = await import('../../../services/play/rooms');
    const room = rooms.createRoom(doc, {
      mode: 'mystery_reveal', title: 'The bell', host: 'Ana',
      mystery: { title: 'The bell', incident: 'The bell cracked overnight.', culprit: 'Zebedee Quill', how: 'With a felted hammer.', suspects: [{ name: 'Zebedee Quill', role: 'sexton' }, { name: 'Mara', role: 'neighbor' }], evidence: [{ id: 'e1', text: 'A felt scrap by the stair.', shown: false }, { id: 'e2', text: 'Mud on the ladder.', shown: true }] },
    });
    rooms.joinRoom(doc, room.id, 'Ben');
    rooms.updateRoom(doc, room.id, rooms.deal(rooms.getRoom(doc, room.id)!, ['Ana', 'Ben']));

    // the host sees the answer
    open('Writing together');
    click('Open');
    expect(text()).toContain('It was Zebedee Quill');
    expect(text()).toContain('A felt scrap by the stair.');

    // an investigator sees the case, the clue that was shown, and not the answer or the hidden clue
    act(() => use('Ben'));
    expect(text()).toContain('The bell cracked overnight.');
    expect(text()).toContain('Mud on the ladder.');
    expect(text()).not.toContain('It was Zebedee Quill');
    expect(text()).not.toContain('felted hammer');
    expect(text()).not.toContain('A felt scrap by the stair.');
    type(field('Ask a question'), 'Who had a key?');
    click('Ask');
    expect(text()).toContain('Who had a key?');

    // revealing it shows everyone
    act(() => rooms.updateRoom(doc, room.id, { status: 'revealed' }));
    expect(text()).toContain('It was Zebedee Quill');
    expect(realErrors()).toEqual([]);
  });

  it('shows nobody\'s writing in a same-prompt game until everyone has handed theirs in', async () => {
    const { doc, use } = await sessionOf('Ana');
    const rooms = await import('../../../services/play/rooms');
    const room = rooms.createRoom(doc, { mode: 'same_prompt', title: 'Prompt', host: 'Ana', prompt: 'A door that should not be open.' });
    rooms.joinRoom(doc, room.id, 'Ben');
    rooms.updateRoom(doc, room.id, rooms.deal(rooms.getRoom(doc, room.id)!, ['Ana', 'Ben']));
    rooms.addMove(doc, { room: room.id, kind: 'entry', by: 'Ben', text: 'Ben wrote about the cellar.' });
    open('Writing together');
    click('Open');
    expect(text()).not.toContain('Ben wrote about the cellar.');
    expect(text()).toContain('Still writing: Ana');
    type(field('Your writing'), 'Ana wrote about the attic.');
    click('Hand it in');
    click('Reveal everyone\'s writing');
    expect(text()).toContain('Ben wrote about the cellar.');
    expect(text()).toContain('Ana wrote about the attic.');
    act(() => use('Ben', 'reader'));
    expect(realErrors()).toEqual([]);
  });

  it('lets a reader watch but not start a game', async () => {
    await sessionOf('Ben', 'reader');
    open('Writing together');
    expect(text()).toContain('reading along');
    expect(byText('Start and invite the others to join')).toBeUndefined();
  });
});
