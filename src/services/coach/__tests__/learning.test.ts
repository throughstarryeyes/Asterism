import { describe, it, expect } from 'vitest';
import { buildEntityIndex, type CoachUnit } from '../entities';
import { detectSignals, summarizeSignals } from '../signals';
import { buildConfirmationPrompt, deletePattern, forgetExample, manualSignal, recordFeedback, shouldAsk } from '../learning';
import { emptyCoachMemory } from '../types';

const unit = (i: number, text: string): CoachUnit => ({ id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: text });
const run = (units: CoachUnit[], memory = emptyCoachMemory('p1')) => {
  const index = buildEntityIndex(units);
  return { index, signals: detectSignals(units, index, memory), names: index.entities.map(e => e.canonical) };
};

describe('signal detection', () => {
  const units = [
    unit(0, 'Mara stood at the shore. She stepped back from the waves.'),
    unit(1, 'Mara refused to go near the river. Her hands were trembling.'),
    unit(2, 'Elias was furious. He slammed the door.'),
  ];
  const { index, signals } = run(units);
  const idOf = (n: string) => index.entities.find(e => e.canonical === n)!.id;

  it('finds fear shown through avoidance and body', () => {
    const modes = signals.filter(s => s.kind === 'fear' && s.entityId === idOf('Mara')).map(s => s.mode);
    expect(modes).toContain('avoidance');
    expect(modes).toContain('physical');
  });

  it('attributes a pronoun sentence to the person just named', () => {
    const s = signals.find(x => x.sentence.startsWith('She stepped back'));
    expect(s?.entityId).toBe(idOf('Mara'));
  });

  it('knows when a feeling is only ever shown, never named', () => {
    const fear = summarizeSignals(signals).find(s => s.entityId === idOf('Mara') && s.kind === 'fear')!;
    expect(fear.neverNamed).toBe(true);
    const anger = summarizeSignals(signals).find(s => s.entityId === idOf('Elias') && s.kind === 'anger')!;
    expect(anger.neverNamed).toBe(false);
  });

  it('does not attribute a sentence naming two people', () => {
    const r = run([unit(0, 'Mara and Elias were terrified.')]);
    expect(r.signals.find(s => s.kind === 'fear')?.entityId).toBeUndefined();
  });

  it('does not invent fear in a calm scene', () => {
    expect(run([unit(0, 'Mara made tea and read by the window.')]).signals).toHaveLength(0);
  });
});

describe('learning from the writer', () => {
  const opts = { learningEnabled: true, entityNames: ['Mara', 'Elias'] };
  const taught = (text: string) => {
    const u = unit(0, text);
    const { signals } = run([u]);
    return signals;
  };

  it('asks a confirmation question with evidence', () => {
    const units = [unit(0, 'Mara stepped back from the waves.'), unit(1, 'Mara refused to go near the river.')];
    const { index, signals } = run(units);
    const summary = summarizeSignals(signals).find(s => s.kind === 'fear')!;
    const prompt = buildConfirmationPrompt(summary, 'Mara');
    expect(prompt.question).toContain('Mara may be afraid');
    expect(prompt.evidence.length).toBeGreaterThan(0);
    expect(prompt.followUp).toBeDefined();
    expect(shouldAsk(summary, emptyCoachMemory('p1'))).toBe(true);
    expect(index.entities.length).toBeGreaterThan(0);
  });

  it('one confirmation records the example but does not activate a rule', () => {
    const sig = taught('Mara edged away from the cold black water, and would not look at it.')[0] ?? taught('Mara stepped back from the black water.')[0];
    let memory = emptyCoachMemory('p1');
    memory = recordFeedback(memory, sig, 'confirm', { ...opts, explanation: 'She shows fear by avoiding it.' });
    expect(memory.profile.examples).toHaveLength(1);
    expect(memory.profile.patterns[0]?.confirmations ?? 0).toBeLessThan(2);
    const again = run([unit(0, 'Mara edged away from the cold black water, and would not look at it.')], memory);
    expect(again.signals.every(s => s.source === 'builtin')).toBe(true);
  });

  it('two similar confirmations activate a pattern that then fires on new text', () => {
    const where = { unitIndex: 0, unitId: 'u0', chapterId: 'c0', unitTitle: 'Chapter 1' };
    let memory = emptyCoachMemory('p1');
    memory = recordFeedback(memory, manualSignal('fear', 'avoidance', 'Mara kept her distance from the black water.', where), 'confirm', opts);
    expect(memory.profile.patterns[0].confirmations).toBe(1);
    memory = recordFeedback(memory, manualSignal('fear', 'avoidance', 'Mara kept her distance from the black river.', where), 'confirm', opts);
    expect(memory.profile.patterns[0].confirmations).toBe(2);
    // a phrasing the built-in cues do not know, in the writer's own style.
    const fresh = run([unit(0, 'Mara kept a careful distance from the black lake.')], memory);
    expect(fresh.signals.some(s => s.source === 'learned' && s.kind === 'fear')).toBe(true);
    // and it does not fire on unrelated calm text.
    expect(run([unit(0, 'Mara kept a spare key under the mat.')], memory).signals.some(s => s.source === 'learned')).toBe(false);
  });

  it('"exception" and learning-off teach nothing', () => {
    const sig = taught('Mara stepped back from the cold black water.')[0];
    const m1 = recordFeedback(emptyCoachMemory('p1'), sig, 'exception', opts);
    expect(m1.profile.patterns).toHaveLength(0);
    const m2 = recordFeedback(emptyCoachMemory('p1'), sig, 'confirm', { ...opts, learningEnabled: false });
    expect(m2.profile.patterns).toHaveLength(0);
  });

  it('"intentional" suppresses future questions about that character and feeling, without teaching', () => {
    const units = [unit(0, 'Mara stepped back from the waves.'), unit(1, 'Mara refused to go near the river.')];
    const { signals } = run(units);
    const sig = signals.find(s => s.kind === 'fear')!;
    const memory = recordFeedback(emptyCoachMemory('p1'), sig, 'intentional', opts);
    expect(memory.profile.patterns).toHaveLength(0);
    const summary = summarizeSignals(signals).find(s => s.kind === 'fear')!;
    expect(shouldAsk(summary, memory)).toBe(false);
  });

  it('the writer can forget an example or delete a pattern', () => {
    let memory = emptyCoachMemory('p1');
    const a = taught('Mara stepped back from the cold black water.')[0];
    memory = recordFeedback(memory, a, 'confirm', opts);
    const exId = memory.profile.examples[0].id;
    expect(forgetExample(memory, exId).profile.patterns).toHaveLength(0);
    expect(deletePattern(memory, memory.profile.patterns[0].id).profile.patterns).toHaveLength(0);
  });
});
