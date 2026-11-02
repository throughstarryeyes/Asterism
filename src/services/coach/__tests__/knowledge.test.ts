import { describe, it, expect } from 'vitest';
import { buildEntityIndex, type CoachUnit } from '../entities';
import { detectSignals } from '../signals';
import { buildConfirmationPrompt } from '../learning';
import { summarizeSignals } from '../signals';
import { promiseBoard, relationshipWeather, unseenScenes, whyChainNudges } from '../features';
import { emptyCoachMemory } from '../types';
import { filterPrompts, themesOf } from '../../muse/filters';
import {
  CUE_MODES, addCue, addFeeling, anyPhrase, cueRegex, defaultKnowledge, feelingLabel, feelingPhrase, knowledgeToJson, mergeNewDefaults,
  parseKnowledgeJson, phraseRegex, removeCue, removeFeeling, removeTheme, sanitizeKnowledge, setBoardList, setList, setTheme, updateFeeling,
} from '../knowledge';
import { PROMPTS } from '../../muse/generators';

const unit = (i: number, text: string): CoachUnit => ({ id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: text });
const run = (units: CoachUnit[], k = defaultKnowledge()) => {
  const index = buildEntityIndex(units);
  return { index, signals: detectSignals(units, index, undefined, k) };
};

describe('the built-in knowledge', () => {
  const k = defaultKnowledge();
  it('has the feelings the coach has always known', () => {
    expect(Object.keys(k.feelings)).toEqual(['fear', 'confusion', 'love', 'anger', 'grief', 'evasion']);
    CUE_MODES.forEach(m => expect(Array.isArray(k.feelings.fear.cues[m])).toBe(true));
    expect(k.feelings.fear.cues.explicit).toContain('afraid');
  });
  it('covers every part of the coach, not just feelings', () => {
    expect(k.events).toContain('funeral');
    expect(k.toldNotShown.length).toBeGreaterThan(5);
    expect(k.board.promise).toContain('i promise');
    expect(Object.keys(k.promptThemes).length).toBeGreaterThanOrEqual(9);
  });
  it('points every feeling at a real Callie question set', async () => {
    const { AUTOPSY_PACKETS } = await import('../../muse/generators');
    Object.entries(k.feelings).forEach(([id, f]) => expect(AUTOPSY_PACKETS.some(p => p.title === f.packet), id).toBe(true));
  });
  it('is an independent copy each time, so edits never leak into the built-in', () => {
    const a = defaultKnowledge();
    a.events.push('zzz');
    expect(defaultKnowledge().events).not.toContain('zzz');
  });
});

describe('matchers', () => {
  it('cues match from the start of a word, and curly apostrophes count', () => {
    expect(cueRegex('tremb').test('Her hands were trembling.')).toBe(true);
    expect(cueRegex("couldn't breathe").test('She couldn’t breathe.')).toBe(true);
    expect(cueRegex('tremb').test('The numbers are nothing')).toBe(false);
  });
  it('phrases match whole words, with a plural for single words', () => {
    expect(phraseRegex('funeral').test('The funerals were long.')).toBe(true);
    expect(phraseRegex('fire').test('The fireplace glowed.')).toBe(false);
    expect(phraseRegex('i promise').test('I promise you.')).toBe(true);
  });
  it('anyPhrase is null for an empty list and escapes special characters', () => {
    expect(anyPhrase([])).toBeNull();
    expect(anyPhrase(['a.b', '(x)'])!.test('a.b')).toBe(true);
    expect(anyPhrase(['a.b'])!.test('axb')).toBe(false);
  });
});

describe('editing a feeling changes what the coach finds', () => {
  const units = [unit(0, 'Mara felt a creeping unease about the lighthouse.')];
  it('does not know a word it was never told', () => {
    expect(run(units).signals).toHaveLength(0);
  });
  it('learns a new word for fear', () => {
    const k = addCue(defaultKnowledge(), 'fear', 'explicit', 'unease');
    const { signals } = run(units, k);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('fear');
    expect(signals[0].mode).toBe('explicit');
  });
  it('stops finding a word once it is removed', () => {
    const afraid = [unit(0, 'Mara was terrified.')];
    expect(run(afraid).signals.length).toBeGreaterThan(0);
    const k = removeCue(defaultKnowledge(), 'fear', 'explicit', 'terrif');
    expect(run(afraid, k).signals).toHaveLength(0);
  });
  it('supports a feeling the writer invents', () => {
    let k = addFeeling(defaultKnowledge(), 'Homesick', 0.25);
    expect(k.feelings.homesick.label).toBe('Homesick');
    k = addCue(k, 'homesick', 'physical', 'ached for the coast');
    const { index, signals } = run([unit(0, 'Elias ached for the coast every evening.'), unit(1, 'Elias ached for the coast again.')], k);
    expect(signals.every(s => s.kind === 'homesick')).toBe(true);
    const summary = summarizeSignals(signals)[0];
    const prompt = buildConfirmationPrompt(summary, 'Elias', k);
    expect(prompt.question).toBe('I think Elias may be homesick. Is that right?');
    expect(index.entities.length).toBeGreaterThan(0);
  });
  it('uses the writer\'s own wording in the question', () => {
    const k = updateFeeling(defaultKnowledge(), 'fear', { phrase: 'frightened' });
    const { signals } = run([unit(0, 'Mara was terrified.'), unit(1, 'Mara was terrified again.')], k);
    expect(buildConfirmationPrompt(summarizeSignals(signals)[0], 'Mara', k).question).toContain('frightened');
    expect(feelingPhrase(k, 'fear')).toBe('frightened');
    expect(feelingLabel(k, 'unknown-kind')).toBe('unknown kind');
  });
  it('a removed feeling stops being detected', () => {
    const k = removeFeeling(defaultKnowledge(), 'fear');
    expect(run([unit(0, 'Mara was terrified.')], k).signals.filter(s => s.kind === 'fear')).toHaveLength(0);
  });
  it('always keeps at least one feeling', () => {
    let k = defaultKnowledge();
    Object.keys(k.feelings).forEach(id => { k = removeFeeling(k, id); });
    expect(Object.keys(k.feelings)).toHaveLength(1);
  });
});

describe('editing the other lists', () => {
  it('unseen scenes follow the events list and the told-not-shown markers', () => {
    const units = [unit(0, 'Mara had never spoken about the regatta since that winter.'), unit(1, 'She watered the plants.')];
    expect(unseenScenes(units)).toHaveLength(0);
    const k = setList(defaultKnowledge(), 'events', ['regatta']);
    expect(unseenScenes(units, undefined, k)[0].title).toContain('regatta');
    // remove the markers and any single mention counts; add a marker that is absent and it does not.
    expect(unseenScenes(units, undefined, setList(k, 'toldNotShown', ['nowhere to be found']))).toHaveLength(0);
  });
  it('the promise board follows the phrase lists', () => {
    const units = [unit(0, '"Cross my heart and hope to fly," said Mara.'), unit(1, 'Tea.')];
    const index = buildEntityIndex(units);
    const base = promiseBoard(units, index).filter(b => b.kind === 'promise');
    const k = setBoardList(defaultKnowledge(), 'promise', ['hope to fly']);
    const custom = promiseBoard(units, index, undefined, k).filter(b => b.kind === 'promise');
    expect(base.length).toBe(1); // "cross my heart" is built in
    expect(custom.length).toBe(1);
    expect(promiseBoard(units, index, undefined, setBoardList(defaultKnowledge(), 'promise', [])).filter(b => b.kind === 'promise')).toHaveLength(0);
  });
  it('relationship warmth is the writer\'s to set', () => {
    const units = [0, 1, 2, 3].map(i => unit(i, 'Mara and Elias argued and Mara was furious with Elias.'));
    const index = buildEntityIndex(units);
    const normal = relationshipWeather(units, index)[0];
    expect(normal.units.every(u => u.score < 0)).toBe(true);
    const k = updateFeeling(defaultKnowledge(), 'anger', { warmth: 1 });
    expect(relationshipWeather(units, index, k)[0].units.every(u => u.score > 0)).toBe(true);
  });
  it('why-chains follow the feeling\'s question set', () => {
    const memory = emptyCoachMemory('p');
    memory.story.chains = [{ entityId: 'ent-mara', kind: 'fear', depth: 0 }];
    const index = buildEntityIndex([unit(0, 'Mara was here. Mara left.')]);
    const base = whyChainNudges(memory, index)[0];
    expect(base.chain).toEqual({ entityId: 'ent-mara', kind: 'fear' });
    const k = updateFeeling(defaultKnowledge(), 'fear', { packet: 'Core Wants' });
    expect(whyChainNudges(memory, index, k)[0].body).not.toBe(base.body);
    // no question set chosen: no chain question, and no crash.
    expect(whyChainNudges(memory, index, updateFeeling(defaultKnowledge(), 'fear', { packet: '' }))).toHaveLength(0);
  });
  it('prompt themes are editable', () => {
    const themes = setTheme(defaultKnowledge(), 'Weather', ['rain', 'storm', 'wind']).promptThemes;
    expect(filterPrompts(PROMPTS, { themes: ['Weather'] }, themes).length).toBeGreaterThanOrEqual(0);
    expect(themesOf('A storm rolled in.', themes)).toContain('Weather');
    expect(themesOf('A storm rolled in.', removeTheme(defaultKnowledge(), 'Family').promptThemes)).not.toContain('Family');
    expect(themesOf('Anything', { Empty: [] })).toEqual([]);
  });
});

describe('saving, loading and sharing', () => {
  it('round-trips through JSON', () => {
    const k = addCue(defaultKnowledge(), 'fear', 'explicit', 'unease');
    const back = parseKnowledgeJson(knowledgeToJson(k));
    expect(back.ok && back.knowledge).toEqual(k);
  });
  it('explains bad files instead of breaking', () => {
    expect(parseKnowledgeJson('not json')).toMatchObject({ ok: false });
    expect(parseKnowledgeJson('[]')).toMatchObject({ ok: false });
    expect(parseKnowledgeJson('{"hello": 1}')).toMatchObject({ ok: false });
  });
  it('repairs hand-edited files: bad numbers, missing parts, junk, duplicates', () => {
    const k = sanitizeKnowledge({
      feelings: { 'Dread!!': { label: 5, warmth: 99, cues: { explicit: ['Gloom', 'gloom', 3, '  '], bogus: ['x'] } }, '': {} },
      events: 'nope',
    });
    expect(k.feelings['dread']).toBeDefined();
    expect(k.feelings['dread'].warmth).toBe(1);
    expect(k.feelings['dread'].cues.explicit).toEqual(['gloom']);
    expect(k.events).toEqual(defaultKnowledge().events);
    expect(k.board.promise.length).toBeGreaterThan(0);
  });
  it('falls back to the built-in for empty or missing input', () => {
    expect(sanitizeKnowledge(undefined)).toEqual(defaultKnowledge());
    expect(sanitizeKnowledge({ feelings: {} }).feelings).toEqual(defaultKnowledge().feelings);
  });
  it('caps list sizes', () => {
    const many = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    expect(sanitizeKnowledge({ events: many }).events.length).toBeLessThanOrEqual(300);
  });
  it('merging defaults keeps edits and adds what is missing', () => {
    let k = addCue(defaultKnowledge(), 'fear', 'explicit', 'unease');
    k = removeFeeling(k, 'grief');
    k = setList(k, 'events', ['regatta']);
    const merged = mergeNewDefaults(k);
    expect(merged.feelings.fear.cues.explicit).toContain('unease');
    expect(merged.feelings.grief).toBeDefined();
    expect(merged.events).toEqual(expect.arrayContaining(['regatta', 'funeral']));
  });
});
