import { describe, it, expect } from 'vitest';
import {
  BUILTIN_SCAPES, MAX_SCAPE_LAYERS, PRESETS, ambientLabel, migrateAmbient, isScapeId, newLayer, planPulse, pulsesIn, sanitizeLayer, sanitizeSoundscape,
  scapeAssetIds, scapeProblem, tooLong, validateScapeFile, type PulseLayer, type ScapeLayer,
} from '../soundscapes';
import { CURSOR_PREFIX, cursorCss, fitInto, hotspotAt, isCursorId, sanitizeCursor, validateCursorFile } from '../customCursor';

// a random source that returns the given numbers in turn.
const seq = (...n: number[]) => { let i = 0; return () => n[i++ % n.length]; };

describe('soundscape layers', () => {
  it('keeps every setting of a good layer and forces bad ones into range', () => {
    const noise = sanitizeLayer({ kind: 'noise', color: 'brown', filter: 'bandpass', freq: 99999, q: -4, volume: 5, pan: -3, motion: { target: 'both', rate: 100, depth: 0.5 } })!;
    expect(noise).toMatchObject({ kind: 'noise', color: 'brown', filter: 'bandpass', freq: 16000, q: 0.1, volume: 1, pan: -1 });
    expect(noise.motion).toEqual({ target: 'both', rate: 8, depth: 0.5 });

    const tone = sanitizeLayer({ kind: 'tone', wave: 'sawtooth', freq: 5, voices: 9.4, detune: 500 })!;
    expect(tone).toMatchObject({ wave: 'sawtooth', freq: 20, voices: 5, detune: 50 });

    const pulses = sanitizeLayer({ kind: 'pulses', source: 'tone', wave: 'triangle', freq: 880, spread: 9, dur: 1, glide: -9, rate: 500 }) as PulseLayer;
    expect(pulses).toMatchObject({ source: 'tone', wave: 'triangle', spread: 3, dur: 5, glide: -3, rate: 20 });
  });

  it('keeps the swell, bend and roughness of a creak inside range, and leaves old pulses as they were', () => {
    const creak = sanitizeLayer({ kind: 'pulses', source: 'tone', wave: 'sawtooth', attack: 5, contour: 'arc', rough: -4 }) as PulseLayer;
    expect(creak).toMatchObject({ attack: 0.9, contour: 'arc', rough: 0 });
    const old = sanitizeLayer({ kind: 'pulses', source: 'tone', freq: 440 }) as PulseLayer;
    expect(old).toMatchObject({ attack: 0, contour: 'line', rough: 0 });
    expect(sanitizeLayer({ kind: 'pulses', contour: 'zigzag' })).toMatchObject({ contour: 'line' });
  });

  it('plans the new settings with each pulse, and sets old saves to a sharp start', () => {
    const l = sanitizeLayer({ kind: 'pulses', source: 'tone', attack: 0.4, contour: 'arc', rough: 0.5, glide: 0.5, dur: 900 }) as PulseLayer;
    expect(planPulse(l, 1, () => 0.5)).toMatchObject({ attack: 0.4, contour: 'arc', rough: 0.5 });
    const { attack: _a, contour: _c, rough: _r, ...older } = l;
    expect(planPulse(older as PulseLayer, 1, () => 0.5)).toMatchObject({ attack: 0, contour: 'line', rough: 0 });
  });

  it('falls back to sensible defaults for anything unknown, and rejects what is not a layer', () => {
    expect(sanitizeLayer({ kind: 'noise', color: 'purple', filter: 'weird' })).toMatchObject({ color: 'pink', filter: 'lowpass', motion: { depth: 0 } });
    expect(sanitizeLayer({ kind: 'file' })).toBeNull();
    expect(sanitizeLayer({ kind: 'file', source: 'snd-1', rate: 9 })).toMatchObject({ source: 'snd-1', rate: 2 });
    expect(sanitizeLayer({ kind: 'laser' })).toBeNull();
    expect(sanitizeLayer('junk')).toBeNull();
  });

  it('starts every kind with settings that survive cleaning unchanged', () => {
    (['noise', 'tone', 'pulses'] as const).forEach(k => expect(sanitizeLayer(newLayer(k))).toEqual(newLayer(k)));
    expect(sanitizeLayer(newLayer('file', 'snd-1'))).toEqual(newLayer('file', 'snd-1'));
  });

  it('ships starting points that are all valid', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
    PRESETS.forEach(p => {
      expect(p.layers.length).toBeGreaterThan(0);
      p.layers.forEach(l => expect(sanitizeLayer(l)).toEqual(l));
    });
  });
});

describe('soundscapes', () => {
  it('caps the layer count, names it safely, and gives a new id when there is none', () => {
    const many = Array.from({ length: 12 }, () => newLayer('noise'));
    const s = sanitizeSoundscape({ id: 'scape-1', name: '  <b>Storm</b> night ', layers: [...many, 'junk'] })!;
    expect(s.id).toBe('scape-1');
    expect(s.name).toBe('bStorm/b night');
    expect(s.layers).toHaveLength(MAX_SCAPE_LAYERS);
    expect(isScapeId(sanitizeSoundscape({ id: 'custom-1', name: 'x', layers: [] })!.id)).toBe(true);
    expect(sanitizeSoundscape(null)).toBeNull();
    expect(sanitizeSoundscape({ name: '' })!.name).toBe('Untitled soundscape');
  });

  it('turns a soundscape saved as plain textures into the layers that make them', () => {
    const s = sanitizeSoundscape({ id: 'scape-2', name: 'Old', layers: [{ kind: 'texture', source: 'rain', volume: 0.5 }, { kind: 'file', source: 'snd-1' }, { kind: 'texture', source: 'nope' }] })!;
    expect(s.layers.some(l => l.kind === 'pulses')).toBe(true); // rain has drops
    expect(s.layers.some(l => l.kind === 'file')).toBe(true);
    expect(s.layers.every(l => l.volume <= 0.5 + 1e-9 || l.kind === 'file')).toBe(true);
  });

  it('needs a layer to be saved, and lists the recordings it uses', () => {
    expect(scapeProblem({ id: 'scape-1', name: 'x', layers: [] })).toMatch('at least one');
    const layers: ScapeLayer[] = [newLayer('file', 'f1'), newLayer('noise'), newLayer('file', 'f2')];
    const a = { id: 'scape-1', name: 'a', layers };
    expect(scapeProblem(a)).toBeNull();
    expect(scapeAssetIds([a])).toEqual(['f1', 'f2']);
  });

  it('checks recordings by type, size and length', () => {
    expect(validateScapeFile({ type: 'audio/mpeg', size: 5_000_000 })).toBeNull();
    expect(validateScapeFile({ type: 'video/mp4', size: 10 })).toMatch('WAV');
    expect(validateScapeFile({ type: 'audio/wav', size: 20 * 1024 * 1024 })).toMatch('15 MB');
    expect(tooLong(120)).toBeNull();
    expect(tooLong(400)).toMatch('3 minutes');
  });

  it('names what is playing without showing an id', () => {
    const own = [{ id: 'scape-1', name: 'Storm night', layers: [] }];
    expect(ambientLabel('off')).toBe('Silence');
    expect(ambientLabel('scape-1', own)).toBe('Storm night');
    expect(ambientLabel('scape-gone', own)).toBe('Soundscape');
    expect(ambientLabel('rain')).toBe('Rain on Glass');
  });
});

describe('random pulses', () => {
  const layer = (over: Partial<PulseLayer> = {}): PulseLayer => ({ ...(newLayer('pulses') as PulseLayer), ...over });

  it('averages the rate it was given', () => {
    let state = 12345;
    const rng = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
    let total = 0;
    for (let i = 0; i < 4000; i++) total += pulsesIn(6, 0.05, rng);
    expect(total / 4000 / 0.05).toBeGreaterThan(5);
    expect(total / 4000 / 0.05).toBeLessThan(7);
    expect(pulsesIn(0, 1, seq(0.5))).toBe(0);
  });

  it('keeps each pulse inside its pitch range, glides it, and varies the loudness', () => {
    const l = layer({ freq: 1000, spread: 1, glide: -1, dur: 500 });
    const low = planPulse(l, 0.05, seq(0, 0, 0)); // all the way down
    const high = planPulse(l, 0.05, seq(1, 1, 1)); // all the way up
    expect(low.freq).toBeCloseTo(500);
    expect(high.freq).toBeCloseTo(2000);
    expect(high.endFreq).toBeCloseTo(1000);
    expect(low.dur).toBe(0.5);
    expect(low.gain).toBeCloseTo(0.35);
    expect(high.gain).toBeCloseTo(1);
    expect(planPulse(l, 0.05, seq(0.5, 0.5, 1)).at).toBeCloseTo(0.05);
  });

  it('stays in the audible range even at the extremes', () => {
    const p = planPulse(layer({ freq: 16000, spread: 3, glide: 2 }), 0.05, seq(1, 1, 1));
    expect(p.freq).toBe(16000);
    expect(p.endFreq).toBe(16000);
    expect(planPulse(layer({ freq: 20, spread: 3, glide: -2 }), 0.05, seq(0, 0, 0)).freq).toBe(20);
  });
});

describe('custom cursors', () => {
  it('fits a picture into the cursor size, up or down, keeping its shape', () => {
    expect(fitInto(200, 100, 32)).toEqual({ width: 32, height: 16 });
    expect(fitInto(8, 16, 32)).toEqual({ width: 16, height: 32 });
    expect(fitInto(0, 0, 32)).toEqual({ width: 32, height: 32 });
    expect(fitInto(1000, 1, 32).height).toBe(1);
  });

  it('puts the point where the writer says', () => {
    expect(hotspotAt('top-left', 32, 32)).toEqual({ x: 0, y: 0 });
    expect(hotspotAt('center', 32, 32)).toEqual({ x: 16, y: 16 });
    expect(hotspotAt('top-center', 31, 20)).toEqual({ x: 15, y: 0 });
    expect(hotspotAt('bottom-left', 32, 24)).toEqual({ x: 0, y: 23 });
  });

  it('checks the picture and cleans a saved cursor', () => {
    expect(validateCursorFile({ type: 'image/svg+xml', size: 100 })).toBeNull();
    expect(validateCursorFile({ type: 'application/pdf', size: 100 })).toMatch('PNG');
    expect(validateCursorFile({ type: 'image/png', size: 3 * 1024 * 1024 })).toMatch('2 MB');

    expect(sanitizeCursor({ name: 'x' })).toBeNull();
    const c = sanitizeCursor({ id: 'mycur-1', name: '<Pen>', assetId: 'img-1', width: 400, height: 'tall', hotX: 99, hotY: -4 })!;
    expect(c).toMatchObject({ id: 'mycur-1', name: 'Pen', assetId: 'img-1', width: 128, height: 32, hotX: 99, hotY: 0 });
    expect(sanitizeCursor({ assetId: 'a', id: 'bad' })!.id.startsWith(CURSOR_PREFIX)).toBe(true);
    expect(isCursorId('mycur-x')).toBe(true);
    expect(isCursorId('quill')).toBe(false);
  });

  it('writes the value the browser expects', () => {
    expect(cursorCss('blob:abc', { hotX: 2, hotY: 30 })).toBe('url("blob:abc") 2 30, auto');
  });
});

describe('built-in soundscapes', () => {
  it('has an ocean, a wind and a campfire to choose by id, each with something to hear', () => {
    BUILTIN_SCAPES.forEach(id => {
      const preset = PRESETS.find(p => p.id === id);
      expect(preset, id).toBeDefined();
      expect(preset!.layers.length).toBeGreaterThan(0);
    });
  });

  it('moves the old fire and typewriter hum onto what replaced them', () => {
    expect(migrateAmbient('fireplace')).toBe('fire');
    expect(migrateAmbient('typewriter')).toBe('off');
    expect(migrateAmbient('rain')).toBe('rain');
    expect(migrateAmbient('scape-abc')).toBe('scape-abc');
  });

  it('gives creaks a template that swells in, bends and roughens', () => {
    const boat = PRESETS.find(p => p.id === 'boat')!;
    const creaks = boat.layers.filter((l): l is PulseLayer => l.kind === 'pulses' && l.source === 'tone');
    expect(creaks.length).toBeGreaterThan(0);
    creaks.forEach(c => { expect(c.attack).toBeGreaterThan(0); expect(c.rough).toBeGreaterThan(0); expect(c.contour).toBe('arc'); });
  });
});

describe('recorded key sounds that come with the app', () => {
  it('has a real typewriter whose recordings are shipped, with the return on its own sound', async () => {
    const { BUILT_IN_SAMPLES, BUILT_IN_SAMPLE_PREFIX, isBuiltInSample, planSample } = await import('../soundRecipes');
    const { existsSync } = await import('node:fs');
    const sound = BUILT_IN_SAMPLES.find(s => s.id === 'real-typewriter')!;
    expect(isBuiltInSample('real-typewriter')).toBe(true);
    expect(isBuiltInSample('thocky')).toBe(false);
    for (const key of ['a', ' ', 'Backspace', 'Enter']) {
      const plan = planSample(sound.sample!, key, () => 0.5)!;
      expect(plan.assetId.startsWith(BUILT_IN_SAMPLE_PREFIX)).toBe(true);
      expect(existsSync(`public/sounds/${plan.assetId.slice(BUILT_IN_SAMPLE_PREFIX.length)}`), plan.assetId).toBe(true);
    }
    expect(planSample(sound.sample!, 'Enter', () => 0.5)!.assetId).not.toBe(planSample(sound.sample!, 'a', () => 0.5)!.assetId);
  });
});

describe('thunder', () => {
  it('lets a pulse layer be a rumble that lasts for seconds and comes very rarely', async () => {
    const { RUMBLE_START } = await import('../soundscapes');
    const l = sanitizeLayer({ kind: 'pulses', ...RUMBLE_START, dur: 99999, rate: 0 }) as PulseLayer;
    expect(l.source).toBe('rumble');
    expect(l.dur).toBe(14000);
    expect(l.rate).toBe(0.01);
    expect(sanitizeLayer({ kind: 'pulses', ...RUMBLE_START }) as PulseLayer).toMatchObject({ source: 'rumble', dur: 7000, glide: -1.5, rate: 0.05 });
  });

  it('keeps old sources and falls back from unknown ones', () => {
    expect((sanitizeLayer({ kind: 'pulses', source: 'tone' }) as PulseLayer).source).toBe('tone');
    expect((sanitizeLayer({ kind: 'pulses', source: 'earthquake' }) as PulseLayer).source).toBe('click');
  });

  it('has a distant thunder to start from, with rain and two rumbles of different depth', () => {
    const storm = PRESETS.find(p => p.id === 'storm')!;
    const rumbles = storm.layers.filter((l): l is PulseLayer => l.kind === 'pulses' && l.source === 'rumble');
    expect(rumbles).toHaveLength(2);
    expect(new Set(rumbles.map(r => r.freq)).size).toBe(2);
    rumbles.forEach(r => expect(r.dur).toBeGreaterThan(5000));
  });

  it('plans a rumble that darkens as it goes', () => {
    const l = sanitizeLayer({ kind: 'pulses', source: 'rumble', freq: 400, glide: -1.5, dur: 7000, spread: 0 }) as PulseLayer;
    const p = planPulse(l, 10, () => 0.5);
    expect(p.endFreq).toBeLessThan(p.freq);
    expect(p.dur).toBe(7);
  });
});
