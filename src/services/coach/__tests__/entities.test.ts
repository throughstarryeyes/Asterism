import { describe, it, expect } from 'vitest';
import { buildEntityIndex, findEntityGaps, quotedFlags, type CoachUnit } from '../entities';
import { defaultCoachSettings, isCoachFeatureOn, normalizeCoachSettings } from '../settings';

const unit = (i: number, text: string): CoachUnit => ({
  id: `u${i}`, index: i, title: `Chapter ${i + 1}`, chapterId: `c${i}`, plainText: text,
});

describe('entity index', () => {
  const units = [
    unit(0, 'Mara walked to the docks. Elias was already waiting. "Where is Tobias?" Mara asked.'),
    unit(1, 'Elias said nothing. Dr. Voss arrived late.'),
    unit(2, 'Mara and Elias argued. Voss left without a word.'),
    unit(3, 'Mara opened the door.'),
    unit(4, 'Mara waited. Elias did not come.'),
  ];
  const index = buildEntityIndex(units);
  const find = (n: string) => index.entities.find(e => e.canonical.toLowerCase().includes(n.toLowerCase()));

  it('finds the main characters', () => {
    expect(find('mara')).toBeTruthy();
    expect(find('elias')).toBeTruthy();
  });

  it('does not treat sentence-initial words as people', () => {
    expect(find('suddenly')).toBeUndefined();
    expect(find('where')).toBeUndefined();
  });

  it('merges "Voss" into "Dr. Voss"', () => {
    const voss = index.entities.filter(e => /voss/i.test(e.canonical));
    expect(voss).toHaveLength(1);
    expect(voss[0].unitsPresent).toEqual([1, 2]);
  });

  it('flags a name mentioned once and never again', () => {
    const gaps = findEntityGaps(index);
    const tobias = gaps.find(g => /tobias/i.test(g.entity.canonical));
    expect(tobias?.kind).toBe('single_mention');
  });

  it('flags a character who vanishes for several units', () => {
    const gaps = findEntityGaps(index, 2);
    expect(gaps.find(g => /voss/i.test(g.entity.canonical))?.kind).toBe('vanished');
  });

  it('does not flag a character who is still present', () => {
    expect(findEntityGaps(index).find(g => /mara/i.test(g.entity.canonical))).toBeUndefined();
  });

  it('uses Story Bible aliases', () => {
    const idx = buildEntityIndex([unit(0, 'Liz smiled. Elizabeth Hart left.')], [{ name: 'Elizabeth Hart', aliases: ['Liz'] }]);
    expect(idx.entities.filter(e => e.confirmed)).toHaveLength(1);
    expect(idx.entities.find(e => e.confirmed)!.mentions).toHaveLength(2);
  });
});

describe('coach settings', () => {
  it('everything is on by default', () => {
    const s = defaultCoachSettings();
    expect(isCoachFeatureOn(s, 'askLater')).toBe(true);
  });
  it('master switch turns everything off', () => {
    const s = { ...defaultCoachSettings(), enabled: false };
    expect(isCoachFeatureOn(s, 'askLater')).toBe(false);
  });
  it('a single feature can be off', () => {
    const s = defaultCoachSettings();
    s.features.yourTells = false;
    expect(isCoachFeatureOn(s, 'yourTells')).toBe(false);
    expect(isCoachFeatureOn(s, 'sparks')).toBe(true);
  });
  it('normalizes junk saved data', () => {
    expect(normalizeCoachSettings('nope')).toEqual(defaultCoachSettings());
    expect(normalizeCoachSettings({ features: { sparks: false, bogus: true } }).features.sparks).toBe(false);
  });
});

describe('names in real prose', () => {
  // the tagger does not know rare names on its own, so the ones a test needs are told to it, as a story bible would
  const known = [{ name: 'Cass' }, { name: 'Atlas' }];
  const names = (...texts: string[]) => buildEntityIndex(texts.map((t, i) => unit(i, t)), known).entities.map(e => e.canonical);

  it('keeps a name apart from the verb after it, and from the next name across a dash', () => {
    const found = names('Val reminisced about the summer. Cass--Val, wait! Cass laughed.', 'Val rose slowly. Val drew a breath.');
    expect(found).toContain('Val');
    expect(found).toContain('Cass');
    expect(found.some(n => /reminisced|rose|drew/i.test(n))).toBe(false);
    expect(found.some(n => /Cass\s+Val|Val\s+Cass/.test(n))).toBe(false);
  });

  it('drops a possessive, a bare title, and the shout before a name', () => {
    const found = names('Mrs. Khalil’s coat hung by the door. Mr. said nothing. "Jesus christ, Atlas, stop," Val said. Dude Val laughed.');
    expect(found).toContain('Mrs. Khalil');
    expect(found.some(n => /’s/.test(n))).toBe(false);
    expect(found).not.toContain('Mr');
    expect(found.some(n => /jesus|dude/i.test(n))).toBe(false);
    expect(found).toContain('Atlas');
  });

  it('splits a run of capitalized words at a full stop and at a title', () => {
    const found = names('He called to Cass. Mrs. Khalil answered from the porch.');
    expect(found).toContain('Cass');
    expect(found).toContain('Mrs. Khalil');
    expect(found.some(n => /Cass\s+Mrs/.test(n))).toBe(false);
  });

  it('keeps a husband and wife who share a surname apart', () => {
    const found = names('Mr. Khalil locked the door. Mrs. Khalil waited upstairs.', 'Mrs. Khalil cried. Mr. Khalil shouted.');
    expect(found).toContain('Mr. Khalil');
    expect(found).toContain('Mrs. Khalil');
    const khalils = buildEntityIndex([unit(0, 'Mr. Khalil locked the door. Mrs. Khalil waited upstairs.')]).entities.filter(e => /Khalil/.test(e.canonical));
    expect(khalils).toHaveLength(2);
  });

  it('still joins "Voss" to "Dr. Voss"', () => {
    const idx = buildEntityIndex([unit(0, 'Dr. Voss arrived. Voss sat down.')]);
    expect(idx.entities.filter(e => /Voss/.test(e.canonical))).toHaveLength(1);
  });

  it('finds a character known by initials, but not an everyday abbreviation', () => {
    const text = 'CJ tossed the bottle. CJ’s phone rang. CJ shrugged. CJ laughed at the TV. CJ frowned. The TV hummed. The TV buzzed. They went to AA. AA met on Fridays. She called the FBI.';
    const idx = buildEntityIndex([unit(0, text)]);
    const cj = idx.entities.find(e => e.canonical === 'CJ');
    expect(cj?.mentions.length).toBeGreaterThanOrEqual(5);
    expect(idx.entities.some(e => ['TV', 'AA', 'FBI'].includes(e.canonical))).toBe(false);
  });
});

describe('which sentences are spoken', () => {
  it('counts a sentence inside a quote that an earlier sentence opened', () => {
    const flags = quotedFlags(['“Jesus christ, Atlas.', 'Are you already drunk?', 'It hasn’t even been an hour.”', 'Val grimaced.']);
    expect(flags).toEqual([true, true, true, false]);
  });

  it('handles straight quotes, and does not let a stray quote mark swallow the scene', () => {
    expect(quotedFlags(['"Stop," she said.', 'He stopped.'])).toEqual([true, false]);
    const long = ['He said “wait', ...Array.from({ length: 12 }, () => 'The rain kept falling.')];
    const flags = quotedFlags(long);
    expect(flags[0]).toBe(true);
    expect(flags[flags.length - 1]).toBe(false);
  });
});
