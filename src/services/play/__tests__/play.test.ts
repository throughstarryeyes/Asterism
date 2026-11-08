import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { rollRoulette, rerollQuestion, rollQuestions, suggestMode, rouletteText } from '../roulette';
import { SCENARIOS, answersFor, compare, labNote, makeAnswer, patterns, readAnswer, unseenTwists, upsertAnswer } from '../lab';
import { SLOTS, adventureToProject, askOracle, newAdventure, parseEntries, rerollSlot, rollDice, rollPremise, rollTable } from '../adventure';
import { accuse, generateCase, mysteryChecks, type MysteryMode } from '../mystery';
import { findSuggestions, insertSceneAsChapter, makeScene, openSuggestions, sections } from '../missingScene';
import { addMove, createRoom, deal, getRoom, joinRoom, joined, latestEntries, listRooms, movesIn, removeRoom, roomTranscript, stillWriting, updateRoom, whoseTurn } from '../rooms';
import { fill, htmlToText, textToHtml } from '../rng';
import type { Chapter, CharacterProfile, Project } from '../../../types';

// a random source that walks a fixed list, so a test can say exactly what comes up
const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };
const lcg = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

describe('text helpers', () => {
  it('fills in names and leaves unknown slots alone', () => {
    expect(fill('{A} meets {B} and {C}', { A: 'Mara', B: 'Tobias' })).toBe('Mara meets Tobias and {C}');
  });
  it('turns text into paragraphs and back', () => {
    const html = textToHtml('One\nline two\n\nSecond <b>');
    expect(html).toBe('<p>One<br/>line two</p><p>Second &lt;b&gt;</p>');
    expect(htmlToText(html)).toBe('One\nline two\n\nSecond <b>');
  });
});

describe('Relationship Roulette', () => {
  it('puts the two names into the situation and every question', () => {
    const r = rollRoulette({ a: 'Mara', b: 'Tobias', mode: 'romantic' }, lcg(1));
    expect(r.situation).not.toMatch(/\{[AB]\}/);
    expect(r.questions).toHaveLength(5);
    r.questions.forEach(q => expect(q).not.toMatch(/\{[AB]\}/));
    expect(new Set(r.questions).size).toBe(5);
    expect(`${r.situation} ${r.questions.join(' ')}`).toMatch(/Mara|Tobias/);
  });
  it('asks questions that fit how the pair is tied together', () => {
    const questions = Array.from({ length: 40 }, (_, i) => rollQuestions({ a: 'Ines', b: 'Calder', mode: 'any', tags: ['mentor'] }, 5, lcg(i + 1)).join('|')).join('|');
    expect(questions).toMatch(/teach|lead/);
  });
  it('suggests a mode from the tags on the cards', () => {
    expect(suggestMode(['romantic'])).toBe('romantic');
    expect(suggestMode(['ex'])).toBe('history');
    expect(suggestMode(['enemy'])).toBe('hostile');
    expect(suggestMode(['familial'])).toBe('family');
    expect(suggestMode([])).toBe('any');
  });
  it('swaps one question for a new one and clears only that answer', () => {
    const r = { ...rollRoulette({ a: 'A', b: 'B' }, lcg(3)), answers: ['a', 'b', 'c', 'd', 'e'] };
    const next = rerollQuestion(r, 2, [], lcg(9));
    expect(next.questions[2]).not.toBe(r.questions[2]);
    expect(next.questions.filter((q, i) => i !== 2)).toEqual(r.questions.filter((q, i) => i !== 2));
    expect(next.answers).toEqual(['a', 'b', '', 'd', 'e']);
  });
  it('writes the exchange out with the answers', () => {
    const r = { ...rollRoulette({ a: 'A', b: 'B' }, lcg(5)), answers: ['They would laugh.', '', '', '', ''] };
    expect(rouletteText(r)).toContain('They would laugh.');
  });
});

describe('Character Lab', () => {
  const make = (scenarioId: string, choiceId: string, twistId?: string, name = 'Wren') => makeAnswer({ scenarioId, choiceId, twistId, why: 'because', characterName: name });

  it('has choices that all map to a stance, and twists with distinct ids', () => {
    SCENARIOS.forEach(s => {
      expect(s.choices.length).toBeGreaterThanOrEqual(4);
      expect(new Set(s.twists.map(t => t.id)).size).toBe(s.twists.length);
      expect(new Set(s.choices.map(c => c.id)).size).toBe(s.choices.length);
    });
  });
  it('finds one character\'s answers by id or by name', () => {
    const a = makeAnswer({ scenarioId: 'mercy', choiceId: 'cover', why: '', characterName: 'Wren', characterId: 'c1' });
    const b = make('mercy', 'cover', undefined, 'Other');
    expect(answersFor([a, b], { id: 'c1', name: 'Wren' })).toEqual([a]);
    expect(answersFor([a, b], { name: ' other ' })).toEqual([b]);
  });
  it('offers twists not yet asked', () => {
    const mercy = SCENARIOS[0];
    const answers = [make('mercy', 'cover'), make('mercy', 'confront', 'hated')];
    expect(unseenTwists(mercy, answers).map(t => t.id)).not.toContain('hated');
    expect(unseenTwists(mercy, answers)).toHaveLength(mercy.twists.length - 1);
  });
  it('says nothing about a character from a single answer', () => {
    expect(patterns([make('mercy', 'cover')])).toEqual([]);
  });
  it('notices forgiving toward loved ones and hard on strangers, without calling it a personality', () => {
    const answers = [
      make('mercy', 'cover'), make('secret', 'keep'), make('comfort', 'lie'),
      make('mercy', 'confront', 'hated'), make('mercy', 'confront', 'stranger'), make('witness', 'speak', 'stranger'),
    ];
    const text = patterns(answers, 'Wren').map(p => p.text).join(' ');
    expect(text).toMatch(/protects someone when someone they love is involved/);
    expect(text).toMatch(/faces it openly when it is someone they dislike or do not know/);
    expect(text).not.toMatch(/\bis (?:a|an|the)\b/);
  });
  it('compares the first answer with each changed situation and flags what held', () => {
    const answers = [make('mercy', 'cover'), make('mercy', 'cover', 'never'), make('mercy', 'confront', 'hated')];
    const [c] = compare(answers);
    expect(c.base?.choiceLabel).toMatch(/Cover for them/);
    expect(c.twists.map(t => t.held)).toEqual([true, false]);
    expect(labNote(answers, 'Wren')).toMatch(/\[changed\]/);
  });
  it('replaces an earlier answer to the same question instead of keeping two', () => {
    const first = make('mercy', 'cover');
    const other = make('mercy', 'cover', undefined, 'Someone else');
    const changed = make('mercy', 'confront');
    const all = upsertAnswer(upsertAnswer(upsertAnswer(undefined, first), other), changed);
    expect(all).toHaveLength(2);
    expect(all.find(a => a.characterName === 'Wren')!.choiceId).toBe('confront');
    expect(upsertAnswer(all, make('mercy', 'cover', 'hated'))).toHaveLength(3);
  });
  it('reads a free-text "something else" answer', () => {
    const a = makeAnswer({ scenarioId: 'mercy', choiceId: 'other', other: 'Burn the receipt', why: '', characterName: 'W' });
    expect(readAnswer(a)?.choiceLabel).toBe('Burn the receipt');
    expect(readAnswer(a)?.stance).toBe('other');
  });
});

describe('Roll Your Story', () => {
  it('rolls every slot of a premise', () => {
    const p = rollPremise([], undefined, lcg(4));
    SLOTS.forEach(s => expect(p[s.id].length).toBeGreaterThan(10));
    expect(p.characterA).not.toBe(p.characterB);
  });
  it('keeps what is locked and rerolls the rest', () => {
    const first = rollPremise([], undefined, lcg(4));
    const second = rollPremise(['setting', 'connection'], first, lcg(99));
    expect(second.setting).toBe(first.setting);
    expect(second.connection).toBe(first.connection);
  });
  it('rerolls one slot to something different', () => {
    const p = rollPremise([], undefined, lcg(4));
    const next = rerollSlot(p, 'situation', lcg(11));
    expect(next.situation).not.toBe(p.situation);
    expect(next.setting).toBe(p.setting);
  });
  it('rolls dice, including modifiers, and rejects nonsense', () => {
    expect(rollDice('2d6+1', seq(0, 0.999))!.total).toBe(1 + 6 + 1);
    expect(rollDice('d20', seq(0.5))!.total).toBe(11);
    expect(rollDice('3d4-2', seq(0.99, 0.99, 0.99))!.total).toBe(10);
    expect(rollDice('banana')).toBeNull();
    expect(rollDice('0d6')).toBeNull();
    expect(rollDice('50d6')).toBeNull();
  });
  it('answers a question by the odds, with and/but at the edges', () => {
    // even odds: 1-10 yes and, 11-40 yes, 41-50 yes but, 51-60 no but, 61-90 no, 91-100 no and
    const at = (n: number, odds: 'likely' | 'even' | 'unlikely' = 'even') => askOracle(odds, 3, () => (n - 0.5) / 100).answer;
    expect(at(5)).toBe('yes_and');
    expect(at(30)).toBe('yes');
    expect(at(45)).toBe('yes_but');
    expect(at(55)).toBe('no_but');
    expect(at(75)).toBe('no');
    expect(at(95)).toBe('no_and');
    expect(at(60, 'likely')).toBe('yes');
    expect(at(60, 'unlikely')).toBe('no');
  });
  it('is fair over many rolls: more yes when likely, fewer when unlikely', () => {
    const rng = lcg(7);
    const yes = (odds: 'likely' | 'even' | 'unlikely') => Array.from({ length: 2000 }, () => askOracle(odds, 3, rng)).filter(r => r.answer.startsWith('yes')).length / 2000;
    expect(yes('likely')).toBeGreaterThan(0.68);
    expect(yes('unlikely')).toBeLessThan(0.32);
  });
  it('calls for a random event on doubles within the chaos level', () => {
    const roll = (n: number, chaos: number) => askOracle('even', chaos, () => (n - 0.5) / 100).event;
    expect(roll(22, 3)).toBe(true);
    expect(roll(55, 3)).toBe(false);
    expect(roll(44, 3)).toBe(false);
    expect(roll(44, 5)).toBe(true);
    expect(roll(37, 9)).toBe(false);
  });
  it('rolls a custom table, ignoring blank lines and list marks', () => {
    expect(parseEntries('1. one\n- two\n\n  \n* three')).toEqual(['one', 'two', 'three']);
    expect(rollTable({ id: 't', name: 'T', entries: ['', ' '] })).toBeNull();
    expect(rollTable({ id: 't', name: 'T', entries: ['a', 'b'] }, () => 0.9)).toBe('b');
  });
  it('turns an adventure into the pieces of a document', () => {
    const a = { ...newAdventure(lcg(2)), nameA: 'Wren', nameB: 'Odo', title: 'The Altar Letter' };
    a.journal = [
      { id: '1', kind: 'note', text: 'Wren <opens> it.', at: '' },
      { id: '2', kind: 'oracle', text: 'Is it signed?', result: 'No, but…', at: '' },
    ];
    const p = adventureToProject(a);
    expect(p.title).toBe('The Altar Letter');
    expect(p.storyBible.characters.map(c => c.name)).toEqual(['Wren', 'Odo']);
    expect(p.storyBible.characters[0].relationships[0].targetCharacterId).toBe(p.storyBible.characters[1].id);
    expect(p.storyBible.locations).toHaveLength(1);
    expect(p.synopsis).toContain(a.rolls.situation);
    expect(p.chapterHtml).toContain('Wren &lt;opens&gt; it.');
    expect(p.chapterHtml).toContain('Oracle: Is it signed? → No, but…');
  });
});

describe('mystery checks', () => {
  it('has nothing to say about a sound case, and asks the right questions of a thin one', () => {
    const good = {
      incident: 'The bell cracked.', culprit: 'Mara', how: 'A hammer.',
      suspects: [{ name: 'Mara', role: 'a' }, { name: 'Tobias', role: 'b' }, { name: 'Ines', role: 'c' }],
      evidence: [{ text: 'Mara had a hammer.' }, { text: 'Tobias was seen on the stair.' }, { text: 'Ines was at the market.' }, { text: 'Felt in the stairwell.' }],
    };
    expect(mysteryChecks(good)).toEqual([]);
    const thin = mysteryChecks({ incident: '', culprit: 'Zed', how: '', suspects: [{ name: 'Mara', role: '' }], evidence: [] });
    expect(thin.join(' ')).toMatch(/what happened/);
    expect(thin.join(' ')).toMatch(/not one of the suspects/);
    expect(thin.join(' ')).toMatch(/how it was done/);
  });
});

describe('mystery generator', () => {
  const modes: MysteryMode[] = ['three_suspects', 'locked_room', 'unreliable'];
  it.each(modes)('makes a %s case that can be solved from its own clues', mode => {
    for (let i = 1; i <= 60; i++) {
      const c = generateCase(mode, lcg(i));
      expect(c.suspects).toHaveLength(3);
      expect(new Set(c.suspects.map(s => s.name)).size).toBe(3);
      const culprit = c.solution.culprit;
      const about = (id: string, kinds: string[]) => c.evidence.filter(e => e.about === id && kinds.includes(e.kind));
      // the culprit's story breaks, and they had the means
      expect(about(culprit, ['contradiction'])).toHaveLength(1);
      expect(about(culprit, ['means']).length).toBeGreaterThanOrEqual(1);
      // each innocent has an alibi that holds
      c.suspects.filter(s => s.id !== culprit).forEach(s => {
        expect(about(s.id, ['alibi'])).toHaveLength(1);
        expect(about(s.id, ['contradiction'])).toHaveLength(0);
      });
      // everyone has a motive, so motive alone cannot solve it
      c.suspects.forEach(s => expect(about(s.id, ['motive'])).toHaveLength(1));
      // a misleading clue is always about someone innocent, and some other clue explains the truth of it
      c.evidence.filter(e => e.misleading).forEach(e => {
        expect(e.about).not.toBe(culprit);
        expect(c.evidence.some(x => x.about === e.about && x.kind === 'explanation') || mode === 'locked_room').toBe(true);
      });
      if (mode === 'unreliable') expect(c.evidence.filter(e => e.misleading).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('tells the writer whether the accusation was right, and who it really was', () => {
    const c = generateCase('three_suspects', lcg(3));
    const right = accuse(c, c.solution.culprit);
    expect(right.correct).toBe(true);
    const wrong = accuse(c, c.suspects.find(s => s.id !== c.solution.culprit)!.id);
    expect(wrong.correct).toBe(false);
    expect(wrong.text).toContain(right.culprit.name);
  });
});

const person = (id: string, name: string, extra: Partial<CharacterProfile> = {}): CharacterProfile => ({
  id, name, role: 'supporting', coreDesire: '', fatalFlaw: '', internalConflict: '', physicalDescription: '', theSecret: '', relationships: [], ...extra,
});
const chapter = (id: string, order: number, html: string, title = `Chapter ${order}`): Chapter => ({ id, title, order, content: html, wordCount: 0, status: 'draft', updatedAt: '' });
const project = (over: Partial<Project> & { chapters: Chapter[] }): Project => ({
  id: 'p', title: 'T', author: '', genre: '', synopsis: '', storyBible: { characters: [], locations: [], lore: [] }, plotThreads: [], reflections: [], goals: [],
  comments: [], mindMap: { id: 'm', title: '', nodes: [], edges: [] }, findings: [], memoryVault: {} as Project['memoryVault'], createdAt: '', updatedAt: '', ...over,
});

describe('Missing Scene', () => {
  const sisters = [
    person('a', 'Mara Ashby', { relationships: [{ targetCharacterId: 'b', targetName: 'Tobias Voss', relationshipType: 'Friends', notes: '', types: ['platonic'] }] }),
    person('b', 'Tobias Voss'),
    person('c', 'Ines'),
    person('d', 'Calder'),
  ];

  it('points at the days a chapter skips, and quotes the words that said so', () => {
    const p = project({
      chapters: [chapter('c1', 1, '<p>Mara left the harbor with Tobias.</p>'), chapter('c2', 2, '<p>Three days later, the road was empty.</p>')],
      storyBible: { characters: sisters, locations: [], lore: [] },
    });
    const s = findSuggestions(p).find(x => x.kind === 'gap')!;
    expect(s.title).toBe('Between Chapter 1 and Chapter 2');
    expect(s.text).toContain('Three days later');
    expect(s.afterChapterId).toBe('c1');
  });
  it('only mentions two people being alone when they have only met in a crowd, and words it as a question', () => {
    const p = project({
      chapters: [
        chapter('c1', 1, '<p>Mara, Tobias, Ines and Calder met at the long table.</p>'),
        chapter('c2', 2, '<p>Mara and Tobias argued while Ines and Calder watched.</p>'),
      ],
      storyBible: { characters: sisters, locations: [], lore: [] },
    });
    const s = findSuggestions(p).find(x => x.kind === 'together')!;
    expect(s.characters).toEqual(['Mara Ashby', 'Tobias Voss']);
    expect(s.text).toMatch(/group settings/);
    expect(s.text.endsWith('?')).toBe(true);
    expect(s.text).not.toMatch(/mistake|missing|forgot|error/i);
    // once they have a scene with fewer people, there is nothing to suggest
    const alone = project({ ...p, chapters: [...p.chapters, chapter('c3', 3, '<p>Mara found Tobias on the dock.</p>')] });
    expect(findSuggestions(alone).find(x => x.kind === 'together')).toBeUndefined();
  });
  it('does not guess about people who are not related or not in the story yet', () => {
    const p = project({
      chapters: [chapter('c1', 1, '<p>Mara walked home.</p>'), chapter('c2', 2, '<p>More walking.</p>')],
      storyBible: { characters: sisters, locations: [], lore: [] },
    });
    expect(findSuggestions(p).filter(s => s.kind === 'together')).toEqual([]);
  });
  it('finds timeline events the story never shows, and secrets kept from someone', () => {
    const p = project({
      chapters: [chapter('c1', 1, '<p>Hello.</p>')],
      storyBible: { characters: sisters, locations: [], lore: [], secrets: [{ id: 's1', text: 'The ledger is forged', knownBy: ['a'], hiddenFrom: ['b'] }] },
      timeline: [
        { id: 'e1', title: 'The night of the fire', when: 'years ago', characters: ['a'], createdAt: '' },
        { id: 'e2', title: 'The wedding', chapterId: 'c1', createdAt: '' },
      ],
    });
    const found = findSuggestions(p);
    expect(found.find(s => s.id === 'offstage:e1')?.text).toMatch(/not show it/);
    expect(found.find(s => s.id === 'offstage:e2')).toBeUndefined();
    expect(found.find(s => s.kind === 'secret')?.characters).toEqual(['Mara Ashby', 'Tobias Voss']);
  });
  it('leaves out what the writer set aside or already answered', () => {
    const p = project({
      chapters: [chapter('c1', 1, '<p>One.</p>')],
      timeline: [{ id: 'e1', title: 'A', createdAt: '' }, { id: 'e2', title: 'B', createdAt: '' }, { id: 'e3', title: 'C', createdAt: '' }],
    });
    expect(openSuggestions(p)).toHaveLength(3);
    const scene = makeScene({ id: 'offstage:e2', kind: 'offstage', title: 'B', text: '', characters: [], reflections: [] }, 'B', '<p>x</p>', []);
    const answered = project({ ...p, play: { dismissed: ['offstage:e1'], scenes: [scene] } });
    expect(openSuggestions(answered).map(s => s.id)).toEqual(['offstage:e3']);
  });
  it('splits an open draft into scenes', () => {
    const p = project({ draftMode: 'open_draft', chapters: [chapter('c1', 1, '<p>One.</p><p style="text-align:center">* * *</p><p>Two.</p><hr><p>Three.</p>')] });
    expect(sections(p).map(s => s.text)).toEqual(['One.', 'Two.', 'Three.']);
  });
  it('puts a scene into the manuscript right after the chapter it follows', () => {
    const chapters = [chapter('c1', 1, 'a'), chapter('c2', 2, 'b'), chapter('c3', 3, 'c')];
    const scene = makeScene(null, 'The Road', '<p>x</p>', []);
    const next = insertSceneAsChapter(chapters, { ...scene, chapterId: 'c1' });
    expect(next.map(c => c.title)).toEqual(['Chapter 1', 'The Road', 'Chapter 2', 'Chapter 3']);
    expect(next.map(c => c.order)).toEqual([1, 2, 3, 4]);
    expect(insertSceneAsChapter(chapters, scene).at(-1)!.title).toBe('The Road');
  });
});

// two copies of one shared document, kept in step the way a live session does
const linked = () => {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on('update', u => Y.applyUpdate(b, u));
  b.on('update', u => Y.applyUpdate(a, u));
  return [a, b] as const;
};

describe('multiplayer rooms', () => {
  it('shares a room, who joined, and what each wrote, with everyone', () => {
    const [host, guest] = linked();
    const room = createRoom(host, { mode: 'pass_story', title: 'Tide', host: 'Ana', prompt: 'It rained.' });
    joinRoom(guest, room.id, 'Ben');
    expect(listRooms(guest).map(r => r.title)).toEqual(['Tide']);
    expect(joined(host, room.id)).toEqual(['Ana', 'Ben']);
    updateRoom(host, room.id, deal(room, joined(host, room.id), () => 0.1));
    expect(getRoom(guest, room.id)!.status).toBe('playing');
    addMove(host, { room: room.id, kind: 'turn', by: 'Ana', text: 'First.' });
    addMove(guest, { room: room.id, kind: 'turn', by: 'Ben', text: 'Second.' });
    expect(movesIn(host, room.id).map(m => m.text)).toEqual(['First.', 'Second.']);
  });
  it('keeps two people writing at the same moment, instead of one overwriting the other', () => {
    const host = new Y.Doc();
    const guest = new Y.Doc();
    const room = createRoom(host, { mode: 'same_prompt', title: 'x', host: 'Ana' });
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
    // both write while disconnected, then meet
    addMove(host, { room: room.id, kind: 'entry', by: 'Ana', text: 'mine' });
    joinRoom(guest, room.id, 'Ben');
    addMove(guest, { room: room.id, kind: 'entry', by: 'Ben', text: 'theirs' });
    Y.applyUpdate(host, Y.encodeStateAsUpdate(guest));
    Y.applyUpdate(guest, Y.encodeStateAsUpdate(host));
    expect(movesIn(host, room.id).map(m => m.by).sort()).toEqual(['Ana', 'Ben']);
    expect(movesIn(guest, room.id)).toEqual(movesIn(host, room.id));
    expect(joined(host, room.id)).toEqual(['Ana', 'Ben']);
  });
  it('lets the host open a story, and then goes round the table, counting a pass as a turn', () => {
    const doc = new Y.Doc();
    const room = createRoom(doc, { mode: 'pass_story', title: 'x', host: 'Ana' });
    ['Ben', 'Cy'].forEach(n => joinRoom(doc, room.id, n));
    updateRoom(doc, room.id, deal(room, joined(doc, room.id), () => 0.5));
    const live = getRoom(doc, room.id)!;
    expect(live.order![0]).toBe('Ana');
    expect(new Set(live.order)).toEqual(new Set(['Ana', 'Ben', 'Cy']));
    expect(whoseTurn(live, movesIn(doc, room.id))).toBe('Ana');
    addMove(doc, { room: room.id, kind: 'turn', by: 'Ana', text: 'a' });
    expect(whoseTurn(live, movesIn(doc, room.id))).toBe(live.order![1]);
    addMove(doc, { room: room.id, kind: 'pass', by: live.order![1], text: '' });
    expect(whoseTurn(live, movesIn(doc, room.id))).toBe(live.order![2]);
    addMove(doc, { room: room.id, kind: 'turn', by: live.order![2], text: 'c' });
    expect(whoseTurn(live, movesIn(doc, room.id))).toBe('Ana');
  });
  it('alternates letters between two correspondents and works with the other side offline', () => {
    const doc = new Y.Doc();
    const room = createRoom(doc, { mode: 'correspondence', title: 'x', host: 'Ana' });
    joinRoom(doc, room.id, 'Ben');
    updateRoom(doc, room.id, deal(room, joined(doc, room.id), () => 0.3));
    const live = getRoom(doc, room.id)!;
    expect(live.order).toEqual(['Ana', 'Ben']);
    expect(live.prompt).toBeTruthy();
    expect(live.assignments!.Ana.role).not.toBe(live.assignments!.Ben.role);
    addMove(doc, { room: room.id, kind: 'letter', by: 'Ana', as: 'Odo', text: 'Dear…' });
    expect(whoseTurn(live, movesIn(doc, room.id))).toBe('Ben');
    expect(roomTranscript(live, movesIn(doc, room.id))).toContain('Odo (Ana):');
  });
  it('gives each person their own hidden instruction, none the same', () => {
    const doc = new Y.Doc();
    const room = createRoom(doc, { mode: 'secret_ingredient', title: 'x', host: 'Ana' });
    ['Ben', 'Cy', 'Di'].forEach(n => joinRoom(doc, room.id, n));
    updateRoom(doc, room.id, deal(room, joined(doc, room.id), lcg(8)));
    const live = getRoom(doc, room.id)!;
    const secrets = Object.values(live.assignments!).map(a => a.secret);
    expect(secrets).toHaveLength(4);
    expect(new Set(secrets).size).toBe(4);
    updateRoom(doc, room.id, { status: 'revealed' });
    expect(roomTranscript(getRoom(doc, room.id)!, [])).toContain('The secret ingredients:');
    expect(roomTranscript(live, [])).not.toContain('The secret ingredients:');
  });
  it('waits for everyone before a simultaneous game is shown, and gives each a different role', () => {
    const doc = new Y.Doc();
    const room = createRoom(doc, { mode: 'two_perspectives', title: 'x', host: 'Ana' });
    joinRoom(doc, room.id, 'Ben');
    updateRoom(doc, room.id, deal(room, joined(doc, room.id), lcg(2)));
    const live = getRoom(doc, room.id)!;
    expect(live.assignments!.Ana.role).not.toBe(live.assignments!.Ben.role);
    expect(stillWriting(live, movesIn(doc, room.id)).sort()).toEqual(['Ana', 'Ben']);
    addMove(doc, { room: room.id, kind: 'entry', by: 'Ana', text: 'I saw it.' });
    expect(stillWriting(live, movesIn(doc, room.id))).toEqual(['Ben']);
  });
  it('uses only the latest entry when a person changes their mind', () => {
    const doc = new Y.Doc();
    const room = createRoom(doc, { mode: 'same_prompt', title: 'x', host: 'Ana' });
    addMove(doc, { room: room.id, kind: 'entry', by: 'Ana', text: 'first draft' });
    addMove(doc, { room: room.id, kind: 'entry', by: 'Ana', text: 'second draft' });
    const live = { ...room, status: 'revealed' as const, order: ['Ana'] };
    expect(latestEntries(movesIn(doc, room.id)).map(m => m.text)).toEqual(['second draft']);
    expect(roomTranscript(live, movesIn(doc, room.id))).toContain('second draft');
    expect(roomTranscript(live, movesIn(doc, room.id))).not.toContain('first draft');
  });
  it('removes a room with its joins and moves', () => {
    const doc = new Y.Doc();
    const room = createRoom(doc, { mode: 'same_prompt', title: 'x', host: 'Ana' });
    addMove(doc, { room: room.id, kind: 'entry', by: 'Ana', text: 't' });
    const other = createRoom(doc, { mode: 'same_prompt', title: 'y', host: 'Ana' });
    addMove(doc, { room: other.id, kind: 'entry', by: 'Ana', text: 'keep' });
    removeRoom(doc, room.id);
    expect(listRooms(doc).map(r => r.title)).toEqual(['y']);
    expect(movesIn(doc, room.id)).toEqual([]);
    expect(movesIn(doc, other.id)).toHaveLength(1);
    expect(joined(doc, room.id)).toEqual([]);
  });
});
