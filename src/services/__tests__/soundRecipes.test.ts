import { describe, it, expect } from 'vitest';
import {
  MAX_LAYERS, PRESETS, defaultRecipe, isCustomSoundId, keyClass, layersFor, newLayer, newRecipeSound, newSampleSound,
  parseSoundFile, planEvents, planSample, sampleIdFor, sanitizeCustomSound, sanitizeLayer, sanitizeRecipe, sanitizeSample,
  soundAssetIds, validateAudioFile, type SoundRecipe,
} from '../soundRecipes';

const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

describe('key classes', () => {
  it('sorts keys', () => {
    expect(keyClass('a')).toBe('letter');
    expect(keyClass(' ')).toBe('space');
    expect(keyClass('Enter')).toBe('enter');
    expect(keyClass('Backspace')).toBe('backspace');
    expect(keyClass('Delete')).toBe('backspace');
    expect(keyClass('F5')).toBe('letter');
  });
  it('falls back to the letter sound when a key has none of its own', () => {
    const r = defaultRecipe();
    expect(layersFor(r, 'space')).toBe(r.letter);
    const withSpace: SoundRecipe = { ...r, space: [newLayer('thump')] };
    expect(layersFor(withSpace, 'space')).toHaveLength(1);
    expect(layersFor(withSpace, 'enter')).toBe(r.letter);
  });
});

describe('planning a key press', () => {
  const recipe = sanitizeRecipe({
    variation: 0,
    letter: [
      { kind: 'noise', filter: 'bandpass', freq: 2000, q: 1, delay: 5, dur: 20, gain: 0.3 },
      { kind: 'thump', from: 160, to: 80, delay: 0, dur: 50, gain: 0.25 },
    ],
  });
  it('plays exactly the recipe when variation is zero', () => {
    const a = planEvents(recipe, 'a', seeded(1));
    const b = planEvents(recipe, 'a', seeded(99));
    expect(a).toEqual(b);
    expect(a[0].at).toBeCloseTo(0.005);
    expect(a[0].gain).toBeCloseTo(0.3);
    expect(a[0].from).toBe(2000);
    expect(a[1].from).toBe(160);
    expect(a[1].to).toBe(80);
  });
  it('makes each press a little different with variation', () => {
    const loose = { ...recipe, variation: 1 };
    const a = planEvents(loose, 'a', seeded(1));
    const b = planEvents(loose, 'a', seeded(2));
    expect(a).not.toEqual(b);
  });
  it('keeps varied values inside safe bounds', () => {
    const loose = { ...recipe, variation: 1 };
    for (let i = 1; i < 200; i++) {
      planEvents(loose, 'a', seeded(i)).forEach(e => {
        expect(e.gain).toBeGreaterThan(0);
        expect(e.gain).toBeLessThanOrEqual(1);
        expect(e.from).toBeGreaterThanOrEqual(20);
        expect(e.from).toBeLessThanOrEqual(16000);
        expect(e.at).toBeGreaterThanOrEqual(0);
      });
    }
  });
  it('uses the space layers for the space bar', () => {
    const r = sanitizeRecipe({ ...recipe, space: [{ kind: 'thump', from: 100, to: 50, delay: 0, dur: 80, gain: 0.4 }] });
    expect(planEvents(r, ' ', seeded())).toHaveLength(1);
    expect(planEvents(r, 'a', seeded())).toHaveLength(2);
  });
});

describe('cleaning up untrusted sounds', () => {
  it('clamps absurd numbers', () => {
    const l = sanitizeLayer({ kind: 'noise', filter: 'lowpass', freq: 1e9, q: -5, delay: 1e9, dur: 1e9, gain: 999 })!;
    expect(l).toMatchObject({ freq: 16000, q: 0.1, delay: 1500, dur: 2000, gain: 1 });
  });
  it('replaces NaN, strings and missing values', () => {
    const l = sanitizeLayer({ kind: 'thump', from: NaN, to: 'loud', dur: undefined })!;
    expect(Number.isFinite((l as { from: number }).from)).toBe(true);
    expect(Number.isFinite((l as { to: number }).to)).toBe(true);
  });
  it('rejects unknown layer kinds and non-objects', () => {
    expect(sanitizeLayer({ kind: 'explode' })).toBeNull();
    expect(sanitizeLayer('x')).toBeNull();
    expect(sanitizeLayer(null)).toBeNull();
  });
  it('caps the number of layers', () => {
    const many = Array.from({ length: 100 }, () => newLayer('noise'));
    expect(sanitizeRecipe({ letter: many }).letter).toHaveLength(MAX_LAYERS);
  });
  it('always leaves a playable letter sound', () => {
    expect(sanitizeRecipe({}).letter.length).toBeGreaterThan(0);
    expect(sanitizeRecipe({ letter: 'nope' }).letter.length).toBeGreaterThan(0);
    expect(sanitizeRecipe(null).letter.length).toBeGreaterThan(0);
  });
  it('cleans names and ids', () => {
    const s = sanitizeCustomSound({ id: 'evil', name: '<script>x'.repeat(20), type: 'recipe', recipe: {} })!;
    expect(isCustomSoundId(s.id)).toBe(true);
    expect(s.name).not.toContain('<');
    expect(s.name.length).toBeLessThanOrEqual(40);
    expect(sanitizeCustomSound({ type: 'mystery' })).toBeNull();
    expect(sanitizeCustomSound(5)).toBeNull();
  });
});

describe('presets', () => {
  it('are all valid and playable', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
    PRESETS.forEach(p => {
      expect(sanitizeRecipe(p.recipe)).toEqual(p.recipe);
      expect(planEvents(p.recipe, 'a', seeded()).length).toBeGreaterThan(0);
    });
  });
});

describe('recordings', () => {
  const sample = sanitizeSample({ letter: 'aud-1', space: 'aud-2', variation: 0.5, gain: 1 });
  it('picks the recording for the key, falling back to the letter one', () => {
    expect(sampleIdFor(sample, 'letter')).toBe('aud-1');
    expect(sampleIdFor(sample, 'space')).toBe('aud-2');
    expect(sampleIdFor(sample, 'enter')).toBe('aud-1');
  });
  it('plays nothing when there is no recording', () => {
    expect(planSample(sanitizeSample({}), 'a')).toBeNull();
  });
  it('keeps pitch within about three semitones, and exact at zero variation', () => {
    expect(planSample({ ...sample, variation: 0 }, 'a', seeded(7))!.rate).toBe(1);
    for (let i = 1; i < 100; i++) {
      const rate = planSample({ ...sample, variation: 1 }, 'a', seeded(i))!.rate;
      expect(rate).toBeGreaterThan(0.8);
      expect(rate).toBeLessThan(1.25);
    }
  });
  it('lists the files a sound uses', () => {
    const s = newSampleSound();
    s.sample = sample;
    expect(soundAssetIds([s, newRecipeSound()]).sort()).toEqual(['aud-1', 'aud-2']);
  });
  it('checks uploaded audio', () => {
    expect(validateAudioFile({ type: 'audio/wav', size: 1000 })).toBeNull();
    expect(validateAudioFile({ type: 'video/mp4', size: 1000 })).toMatch(/WAV/);
    expect(validateAudioFile({ type: 'audio/mpeg', size: 5 * 1024 * 1024 })).toMatch(/2 MB/);
  });
});

describe('sound files', () => {
  it('round-trips a recipe sound', () => {
    const sound = newRecipeSound('Mine', PRESETS[0].recipe);
    const file = parseSoundFile(JSON.stringify({ asterismSound: 1, sound }));
    expect(file!.sound.name).toBe('Mine');
    expect(file!.sound.recipe).toEqual(sound.recipe);
  });
  it('keeps embedded audio and drops anything that is not audio', () => {
    const sound = newSampleSound('Rec');
    const file = parseSoundFile(JSON.stringify({
      asterismSound: 1, sound,
      audio: { good: { type: 'audio/wav', data: 'AAAA' }, bad: { type: 'text/html', data: '<script>' }, worse: 5 },
    }));
    expect(Object.keys(file!.audio!)).toEqual(['good']);
  });
  it('rejects junk, the wrong version, and bad sounds', () => {
    expect(parseSoundFile('not json')).toBeNull();
    expect(parseSoundFile('{}')).toBeNull();
    expect(parseSoundFile(JSON.stringify({ asterismSound: 2, sound: newRecipeSound() }))).toBeNull();
    expect(parseSoundFile(JSON.stringify({ asterismSound: 1, sound: { type: 'x' } }))).toBeNull();
  });
});
