import { describe, it, expect } from 'vitest';
import { buildEntityIndex, findEntityGaps, type CoachUnit } from '../entities';
import { detectSignals } from '../signals';
import { emptyCoachMemory, normalizeCoachMemory } from '../types';
import { dismissNudge, manualSignal, recordFeedback } from '../learning';
import {
  actingStrange, advanceChain, castSpark, echoPrompts, findOpenQuestions, nextSceneIdeas, promiseBoard,
  relationshipWeather, resurfaceQuestions, unseenScenes, weatherNudges, whyChainNudges, yourTells,
} from '../features';
import { MUSE_FOUNDATION_CARDS } from '../../../data/museFoundations';

const unit = (i: number, text: string): CoachUnit => ({ id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: text });

describe('ask-later', () => {
  const units = [
    unit(0, 'Mara found flowers on the porch. Who leaves the flowers on the empty porch every morning?'),
    unit(1, 'Elias fixed the roof.'),
    unit(2, 'Mara counted the flowers again on the porch. Seven.'),
  ];
  const index = buildEntityIndex(units);

  it('finds a question the narration asks', () => {
    expect(findOpenQuestions(units, index).map(q => q.sentence)).toContain('Who leaves the flowers on the empty porch every morning?');
  });
  it('ignores questions characters speak', () => {
    const u = [unit(0, '"Where is the key to the old house tonight?" Mara asked.')];
    expect(findOpenQuestions(u, buildEntityIndex(u))).toHaveLength(0);
  });
  it('resurfaces it in a later scene that touches the same things', () => {
    const nudges = resurfaceQuestions(findOpenQuestions(units, index), units, index, 2);
    expect(nudges).toHaveLength(1);
    expect(nudges[0].feature).toBe('askLater');
  });
  it('does not resurface it in a scene about something else, or once dismissed', () => {
    const q = findOpenQuestions(units, index);
    expect(resurfaceQuestions(q, units, index, 1)).toHaveLength(0);
    const first = resurfaceQuestions(q, units, index, 2)[0];
    expect(resurfaceQuestions(q, units, index, 2, dismissNudge(emptyCoachMemory('p'), first.id))).toHaveLength(0);
  });
});

describe('echo prompts', () => {
  it('notices a line said three or more times', () => {
    const units = [
      unit(0, '"I am fine," Elias said.'),
      unit(1, '"I am fine." Elias looked away.'),
      unit(2, '"I am fine," said Elias.'),
      unit(3, '"Run!" Mara shouted.'),
    ];
    const nudges = echoPrompts(units, buildEntityIndex(units));
    expect(nudges).toHaveLength(1);
    expect(nudges[0].body).toContain('3 times');
    expect(nudges[0].body).toContain('Elias');
  });
  it('is quiet for lines said once or twice', () => {
    const units = [unit(0, '"Hello there," said Mara.'), unit(1, '"Hello there," said Elias.')];
    expect(echoPrompts(units, buildEntityIndex(units))).toHaveLength(0);
  });
  it('points at a card that exists', () => {
    const units = [unit(0, '"Never mind." Elias left.'), unit(1, '"Never mind." Elias sat.'), unit(2, '"Never mind." Elias slept.')];
    const n = echoPrompts(units, buildEntityIndex(units))[0];
    expect(MUSE_FOUNDATION_CARDS.some(c => c.id === n.cardId)).toBe(true);
  });
});

describe('why-chains', () => {
  const units = [unit(0, 'Mara stepped back from the waves.'), unit(1, 'Mara refused to go near the river.')];
  const index = buildEntityIndex(units);
  const sig = detectSignals(units, index).find(s => s.kind === 'fear')!;
  const opts = { learningEnabled: true, entityNames: ['Mara'] };

  it('confirming a feeling starts a chain, and each step goes one question deeper', () => {
    let memory = recordFeedback(emptyCoachMemory('p'), sig, 'confirm', opts);
    expect(memory.story.chains).toHaveLength(1);
    const first = whyChainNudges(memory, index)[0];
    memory = advanceChain(memory, sig.entityId!, 'fear');
    const second = whyChainNudges(memory, index)[0];
    expect(first.body).not.toBe(second.body);
    expect(first.title).toBe('About Mara');
  });
  it('ends when the questions run out', () => {
    let memory = recordFeedback(emptyCoachMemory('p'), sig, 'confirm', opts);
    for (let i = 0; i < 50; i++) memory = advanceChain(memory, sig.entityId!, 'fear');
    expect(whyChainNudges(memory, index)).toHaveLength(0);
  });
  it('does not start a chain for "intentional"', () => {
    expect(recordFeedback(emptyCoachMemory('p'), sig, 'intentional', opts).story.chains).toHaveLength(0);
  });
});

describe('unseen scenes', () => {
  it('flags an event that is only told in summary', () => {
    const units = [unit(0, 'Mara had never spoken about the funeral since that winter.'), unit(1, 'She watered the plants.')];
    const n = unseenScenes(units);
    expect(n).toHaveLength(1);
    expect(n[0].title).toContain('funeral');
  });
  it('does not flag an event that is shown', () => {
    const units = [unit(0, 'The funeral began at noon. Rain fell on the funeral crowd.')];
    expect(unseenScenes(units)).toHaveLength(0);
  });
});

describe('relationship weather', () => {
  it('flags a pair who feel the same across many sections', () => {
    const units = [0, 1, 2, 3, 4].map(i => unit(i, `Mara and Elias argued again and Mara was furious at Elias in section ${i}.`));
    const w = relationshipWeather(units, buildEntityIndex(units));
    expect(w.length).toBeGreaterThan(0);
    expect(weatherNudges(w).length).toBeGreaterThan(0);
  });
  it('does not flag a pair whose mood changes', () => {
    const units = [
      unit(0, 'Mara and Elias argued and Mara was furious with Elias.'),
      unit(1, 'Mara and Elias shared tea and Mara loved Elias.'),
      unit(2, 'Mara and Elias argued and Elias slammed the door on Mara.'),
      unit(3, 'Mara and Elias kissed, and Mara blushed at Elias.'),
    ];
    expect(weatherNudges(relationshipWeather(units, buildEntityIndex(units)))).toHaveLength(0);
  });
});

describe('acting-strange', () => {
  it('flags the first time a character shows a feeling they never have', () => {
    const units = [
      unit(0, 'Elias loved the quiet morning.'),
      unit(1, 'Elias loved his tea.'),
      unit(2, 'Elias loved the old dog.'),
      unit(3, 'Elias was furious and slammed the door.'),
    ];
    const index = buildEntityIndex(units);
    expect(actingStrange(detectSignals(units, index), index).some(x => x.id.includes('anger'))).toBe(true);
  });
  it('does not flag a feeling that was already there', () => {
    const units = [0, 1, 2, 3].map(i => unit(i, 'Elias was furious and slammed the door.'));
    const index = buildEntityIndex(units);
    expect(actingStrange(detectSignals(units, index), index)).toHaveLength(0);
  });
});

describe('promise board', () => {
  const units = [
    unit(0, '"I swear I will come back for you," Elias said at the docks.'),
    unit(1, 'Mara kept the secret about the lighthouse key hidden.'),
    unit(2, 'Elias never returned to the docks.'),
    unit(3, 'The lighthouse key stayed hidden in the lighthouse wall.'),
  ];
  const index = buildEntityIndex(units);
  const board = promiseBoard(units, index);

  it('lists promises and secrets', () => {
    expect(board.map(b => b.kind)).toEqual(expect.arrayContaining(['promise', 'secret']));
  });
  it('counts how often each is revisited and how old it is', () => {
    expect(board.find(b => b.kind === 'secret')!.revisits).toBeGreaterThanOrEqual(1);
    expect(board.find(b => b.kind === 'promise')!.age).toBe(3);
  });
  it('drops dismissed items', () => {
    const memory = dismissNudge(emptyCoachMemory('p'), board[0].id);
    expect(promiseBoard(units, index, memory).some(b => b.id === board[0].id)).toBe(false);
  });
});

describe('next-scene menu', () => {
  it('builds ideas from open threads', () => {
    const units = [unit(0, '"I promise I will find you," Elias said.'), unit(1, 'Mara cooked.'), unit(2, 'Mara slept.')];
    const index = buildEntityIndex(units);
    const ideas = nextSceneIdeas(promiseBoard(units, index), findEntityGaps(index, 1), []);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.length).toBeLessThanOrEqual(3);
    expect(ideas[0].text).toContain('promise');
  });
  it('falls back to a Muse scene starter for an empty story', () => {
    expect(nextSceneIdeas([], [], [])[0].reason).toContain('Scene starter');
  });
});

describe('your tells', () => {
  it('reports repeated phrases and stats without judging', () => {
    const line = 'She let out a breath.';
    const units = [unit(0, `${line} Rain fell. ${line} Wind rose. ${line} The door shut.\n${line}`)];
    const t = yourTells(units, buildEntityIndex(units));
    expect(t.phrases.some(p => p.phrase.includes('let out'))).toBe(true);
    expect(t.stats.sentences).toBeGreaterThan(5);
    expect(t.stats.dialogueShare).toBe(0);
  });
  it('measures dialogue share', () => {
    const units = [unit(0, '"Hello there, friend," said Mara.')];
    expect(yourTells(units, buildEntityIndex(units)).stats.dialogueShare).toBeGreaterThan(0.3);
  });
});

describe('sparks with your cast', () => {
  it('uses characters from the story', () => {
    const units = [unit(0, 'Mara met Elias. Mara waved at Elias. Dr. Voss left.')];
    const s = castSpark(buildEntityIndex(units), () => 0.1);
    expect(s.cast).toHaveLength(2);
    expect(s.spark.setting.where).toBeTruthy();
  });
  it('still works with nobody in the story yet', () => {
    expect(castSpark({ entities: [], unitCount: 0 }).cast).toEqual([]);
  });
});

describe('memory from older saves', () => {
  it('fills in new fields', () => {
    const old = emptyCoachMemory('p');
    const story = old.story as unknown as Record<string, unknown>;
    delete story.dismissed;
    delete story.chains;
    const m = normalizeCoachMemory(old, 'p');
    expect(m.story.dismissed).toEqual([]);
    expect(m.story.chains).toEqual([]);
  });
  it('recording feedback keeps working on normalized memory', () => {
    const m = normalizeCoachMemory(undefined, 'p');
    const s = manualSignal('fear', 'avoidance', 'Mara kept her distance.', { unitIndex: 0, unitId: 'u', chapterId: 'c', unitTitle: 'T' }, 'ent-mara');
    expect(recordFeedback(m, s, 'confirm', { learningEnabled: true, entityNames: [] }).story.chains).toHaveLength(1);
  });
});

describe('evidence knows where it came from (so it can be jumped to)', () => {
  it('ask-later, echo, unseen, strange and board items all carry their chapter', () => {
    const units = [
      unit(0, 'Mara found flowers on the porch. Who leaves the flowers on the empty porch every morning?'),
      unit(1, '"I swear I will come back for you," Elias said at the docks. Mara had never spoken about the funeral since that winter.'),
      unit(2, 'Mara counted the flowers again on the porch. "Never mind." Elias left.'),
      unit(3, '"Never mind." Elias sat.'),
      unit(4, '"Never mind." Elias slept.'),
    ];
    const index = buildEntityIndex(units);
    const chapterIds = new Set(units.map(u => u.chapterId));

    const asked = resurfaceQuestions(findOpenQuestions(units, index), units, index, 2);
    expect(asked[0].evidence[0].chapterId).toBe('c0');

    const echo = echoPrompts(units, index);
    expect(echo.length).toBeGreaterThan(0);
    echo[0].evidence.forEach(e => expect(chapterIds.has(e.chapterId!)).toBe(true));

    const unseen = unseenScenes(units);
    expect(unseen[0].evidence[0].chapterId).toBe('c1');

    const board = promiseBoard(units, index);
    expect(board.length).toBeGreaterThan(0);
    board.forEach(b => expect(chapterIds.has(b.chapterId)).toBe(true));
  });
});
