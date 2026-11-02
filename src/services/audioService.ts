// offline procedural ambient sound & keystroke sound generator using web audio API
// 100% offline, zero network requests, no external audio files required
import type { KeystrokeSound } from '../types';
import { getAsset } from './assetStore';
import { BUILT_IN_SAMPLES, BUILT_IN_SAMPLE_PREFIX, isBuiltInSample, isCustomSoundId, planEvents, planSample, type CustomSound, type PlannedEvent } from './soundRecipes';
import { chimeSeconds, planChime, type ChimeConfig } from './chimes';
import { BUILTIN_SCAPES, PRESETS, isScapeId, planPulse, pulsesIn, type CustomSoundscape, type NoiseColor, type PulseLayer, type ScapeLayer } from './soundscapes';

class AmbientAudioService {
  private ctx: AudioContext | null = null;
  private currentMode = 'off';
  // bumped whenever the ambient sound changes, so a recording still loading for the old one is dropped.
  private playToken = 0;
  private scapes = new Map<string, CustomSoundscape>();
  private masterGain: GainNode | null = null;
  private keystrokeGain: GainNode | null = null;
  private activeNodes: Array<AudioNode | number> = [];
  private ambientVolume: number = 0.35;
  private keystrokeVolume: number = 0.45;

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.keystrokeGain = this.ctx.createGain();
      this.keystrokeGain.gain.setValueAtTime(this.keystrokeVolume, this.ctx.currentTime);
      this.keystrokeGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    this.ambientVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
    }
  }

  public setKeystrokeVolume(val: number) {
    this.keystrokeVolume = Math.max(0, Math.min(1, val));
    if (this.keystrokeGain && this.ctx) {
      this.keystrokeGain.gain.setValueAtTime(this.keystrokeVolume, this.ctx.currentTime);
    }
  }

  public stop() {
    this.playToken++;
    this.activeNodes.forEach(node => {
      if (typeof node === 'number') {
        window.clearInterval(node);
      } else {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore cleanup errors
        }
      }
    });
    this.activeNodes = [];
    this.currentMode = 'off';
  }

  public setSoundscapes(scapes: CustomSoundscape[]) {
    this.scapes = new Map(scapes.map(x => [x.id, x]));
  }

  // the built-in ambient sounds and the writer's own soundscapes, by id.
  public play(mode: string) {
    this.stop();
    if (mode === 'off') return;
    if (isScapeId(mode)) {
      const scape = this.scapes.get(mode);
      if (scape) this.playScape(mode, scape.layers);
      return;
    }
    // the ocean, wind and campfire that come with the app are soundscapes too
    if ((BUILTIN_SCAPES as readonly string[]).includes(mode)) {
      const preset = PRESETS.find(p => p.id === mode);
      if (preset) this.playScape(mode, preset.layers);
      return;
    }
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    this.currentMode = mode;
    this.playTexture(mode, this.masterGain);
  }

  // play a soundscape that has not been saved yet (the editor's preview).
  public preview(scape: CustomSoundscape) {
    this.stop();
    this.playScape(scape.id, scape.layers);
  }

  private playTexture(name: string, dest: AudioNode) {
    switch (name) {
      case 'rain': this.playRainSound(dest); break;
      case 'library': this.playLibrarySound(dest); break;
    }
  }

  // ---- the writer's own soundscapes (see services/soundscapes) ----
  private noiseBuffers = new Map<NoiseColor, AudioBuffer>();

  private noiseOf(color: NoiseColor): AudioBuffer {
    const cached = this.noiseBuffers.get(color);
    if (cached) return cached;
    if (!this.ctx) throw new Error('No audio context');
    let buffer: AudioBuffer;
    if (color === 'pink') {
      buffer = this.createPinkNoiseBuffer();
    } else {
      buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
      const out = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < out.length; i++) {
        const white = Math.random() * 2 - 1;
        if (color === 'white') out[i] = white * 0.5;
        else { last = (last + 0.02 * white) / 1.02; out[i] = last * 3.5; } // brown: wanders slowly
      }
    }
    this.noiseBuffers.set(color, buffer);
    return buffer;
  }

  // a slow wave that moves a setting up and down by `amount`.
  private swell(rate: number, amount: number, param: AudioParam) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    osc.frequency.value = rate;
    depth.gain.value = amount;
    osc.connect(depth);
    depth.connect(param);
    osc.start();
    this.activeNodes.push(osc, depth);
  }

  private playScape(mode: string, layers: ScapeLayer[]) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    this.currentMode = mode;
    const token = this.playToken;
    layers.forEach(l => {
      try { this.playLayer(l, token); } catch (e) { console.warn('Could not play a soundscape layer', e); }
    });
  }

  private playLayer(l: ScapeLayer, token: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = l.pan;
    pan.connect(this.masterGain);
    const level = ctx.createGain();
    level.gain.value = l.volume;
    level.connect(pan);
    this.activeNodes.push(pan, level);

    // slow movement: a swell in loudness is shared by every kind of layer.
    const m = l.motion;
    let into: AudioNode = level;
    if (m.depth > 0 && m.target !== 'tone') {
      const trem = ctx.createGain();
      trem.gain.value = 1 - m.depth / 2;
      trem.connect(level);
      this.swell(m.rate, m.depth / 2, trem.gain);
      this.activeNodes.push(trem);
      into = trem;
    }
    const moves = m.depth > 0 && m.target !== 'volume';

    if (l.kind === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseOf(l.color);
      src.loop = true;
      if (l.filter === 'none') {
        src.connect(into);
      } else {
        const filter = ctx.createBiquadFilter();
        filter.type = l.filter;
        filter.frequency.value = l.freq;
        filter.Q.value = l.q;
        src.connect(filter);
        filter.connect(into);
        if (moves) this.swell(m.rate, l.freq * m.depth * 0.8, filter.frequency);
        this.activeNodes.push(filter);
      }
      src.start();
      this.activeNodes.push(src);
    } else if (l.kind === 'tone') {
      for (let i = 0; i < l.voices; i++) {
        const osc = ctx.createOscillator();
        const voice = ctx.createGain();
        osc.type = l.wave;
        osc.frequency.value = l.freq;
        osc.detune.value = (i - (l.voices - 1) / 2) * l.detune;
        voice.gain.value = 1 / l.voices;
        osc.connect(voice);
        voice.connect(into);
        if (moves) this.swell(m.rate, l.freq * m.depth * 0.06, osc.frequency);
        osc.start();
        this.activeNodes.push(osc, voice);
      }
    } else if (l.kind === 'pulses') {
      const tick = 0.05;
      const id = window.setInterval(() => {
        if (token !== this.playToken) return;
        const n = pulsesIn(l.rate, tick);
        for (let i = 0; i < n; i++) this.pulse(l, into, tick);
      }, tick * 1000);
      this.activeNodes.push(id);
    } else {
      this.playRecording(l.source, l.rate, moves ? m : null, into, token).catch(e => console.warn('Could not play recording', e));
    }
  }

  // one short sound from a pulses layer.
  private pulse(l: PulseLayer, into: AudioNode, tick: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const p = planPulse(l, tick);
    const at = ctx.currentTime + p.at;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    // a swell takes up part of the note's length; the default is a sharp start
    const rise = l.source !== 'click' ? Math.max(0.004, p.attack * p.dur) : 0.004;
    env.gain.linearRampToValueAtTime(p.gain, at + Math.min(rise, Math.max(0.01, p.dur) * 0.9));
    env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.01, p.dur));
    env.connect(into);
    if (l.source === 'click') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseOf('white');
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = p.freq;
      filter.Q.value = l.q;
      src.connect(filter);
      filter.connect(env);
      // a different stretch of noise each time, so no two crackles match.
      src.start(at, Math.random() * (src.buffer.duration - p.dur - 0.1), p.dur + 0.02);
    } else if (l.source === 'rumble') {
      // deep noise through a filter that closes as it goes: the roll of thunder
      const src = ctx.createBufferSource();
      src.buffer = this.noiseOf('brown');
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = Math.min(12, l.q);
      filter.frequency.setValueAtTime(p.freq, at);
      filter.frequency.exponentialRampToValueAtTime(p.endFreq, at + p.dur);
      let out: AudioNode = filter;
      const stops: AudioScheduledSourceNode[] = [src];
      if (p.rough > 0) {
        // the roll: a slow, uneven wobble in loudness
        const roll = ctx.createGain();
        roll.gain.value = 1 - p.rough * 0.5;
        const wobble = ctx.createOscillator();
        wobble.type = 'sine';
        wobble.frequency.value = 2 + Math.random() * 5;
        const depth = ctx.createGain();
        depth.gain.value = p.rough * 0.5;
        wobble.connect(depth);
        depth.connect(roll.gain);
        filter.connect(roll);
        out = roll;
        stops.push(wobble);
      }
      src.connect(filter);
      out.connect(env);
      src.start(at, Math.random() * (src.buffer.duration - 0.5));
      stops.forEach(n => { if (n !== src) n.start(at); n.stop(at + p.dur + 0.1); });
    } else {
      const osc = ctx.createOscillator();
      osc.type = l.wave;
      osc.frequency.setValueAtTime(p.freq, at);
      if (p.endFreq !== p.freq) {
        if (p.contour === 'arc') {
          // out to the far pitch and back, like a board that groans and settles
          osc.frequency.exponentialRampToValueAtTime(p.endFreq, at + p.dur * 0.5);
          osc.frequency.exponentialRampToValueAtTime(p.freq, at + p.dur);
        } else {
          osc.frequency.exponentialRampToValueAtTime(p.endFreq, at + p.dur);
        }
      }
      let out: AudioNode = osc;
      const stops: AudioScheduledSourceNode[] = [osc];
      if (p.rough > 0) {
        // stick and slip: a fast flutter in loudness and a little in pitch
        const amp = ctx.createGain();
        amp.gain.value = 1 - p.rough * 0.45;
        const flutter = ctx.createOscillator();
        flutter.type = 'sawtooth';
        flutter.frequency.value = 14 + Math.random() * 30;
        const depth = ctx.createGain();
        depth.gain.value = p.rough * 0.45;
        flutter.connect(depth);
        depth.connect(amp.gain);
        const shake = ctx.createGain();
        shake.gain.value = p.rough * 45;
        flutter.connect(shake);
        shake.connect(osc.detune);
        osc.connect(amp);
        out = amp;
        stops.push(flutter);
      }
      out.connect(env);
      stops.forEach(n => { n.start(at); n.stop(at + p.dur + 0.05); });
    }
  }

  // a recording that loops for as long as the soundscape plays.
  private async playRecording(assetId: string, rate: number, move: { rate: number; depth: number } | null, into: AudioNode, token: number) {
    if (!this.ctx) return;
    const blob = await getAsset(assetId);
    if (!blob) return;
    const buffer = await this.ctx.decodeAudioData(await blob.arrayBuffer());
    if (token !== this.playToken || !this.ctx) return; // something else was chosen while it loaded
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = rate;
    if (move) this.swell(move.rate, rate * move.depth * 0.1, src.playbackRate);
    src.connect(into);
    src.start();
    this.activeNodes.push(src);
  }

  // keystroke sound synthesis
  // custom sounds the writer made (see soundRecipes)
  private customSounds = new Map<string, CustomSound>();
  private sampleBuffers = new Map<string, AudioBuffer>();

  public setCustomSounds(sounds: CustomSound[]) {
    this.customSounds = new Map([...BUILT_IN_SAMPLES, ...sounds].map(s => [s.id, s]));
  }

  private async getSampleBuffer(assetId: string): Promise<AudioBuffer | undefined> {
    const cached = this.sampleBuffers.get(assetId);
    if (cached) return cached;
    if (!this.ctx) return undefined;
    let bytes: ArrayBuffer | undefined;
    if (assetId.startsWith(BUILT_IN_SAMPLE_PREFIX)) {
      const res = await fetch(`${import.meta.env.BASE_URL}sounds/${assetId.slice(BUILT_IN_SAMPLE_PREFIX.length)}`);
      if (res.ok) bytes = await res.arrayBuffer();
    } else {
      bytes = await (await getAsset(assetId))?.arrayBuffer();
    }
    if (!bytes) return undefined;
    const buffer = await this.ctx.decodeAudioData(bytes);
    this.sampleBuffers.set(assetId, buffer);
    return buffer;
  }

  // how long a recording is, so the editor can refuse one too long to be a key press.
  public async audioDuration(file: Blob): Promise<number> {
    this.initContext();
    if (!this.ctx) return 0;
    return (await this.ctx.decodeAudioData(await file.arrayBuffer())).duration;
  }

  private renderEvent(e: PlannedEvent, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;
    const at = now + e.at;
    const layer = e.layer;
    if (layer.kind === 'noise') {
      this.noiseHit(at, e.dur, e.gain, layer.filter, e.from, layer.q);
    } else if (layer.kind === 'thump') {
      this.thump(at, e.from, e.to, e.dur, e.gain);
    } else {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = layer.wave;
      osc.frequency.setValueAtTime(e.from, at);
      osc.frequency.exponentialRampToValueAtTime(e.to, at + e.dur);
      gain.gain.setValueAtTime(e.gain, at);
      gain.gain.exponentialRampToValueAtTime(0.0008, at + e.dur);
      osc.connect(gain);
      gain.connect(this.keystrokeGain);
      osc.start(at);
      osc.stop(at + e.dur + 0.01);
    }
  }

  private async playCustom(id: string, key: string, now: number) {
    const sound = this.customSounds.get(id);
    if (!sound || !this.ctx || !this.keystrokeGain) return;
    if (sound.type === 'recipe' && sound.recipe) {
      planEvents(sound.recipe, key).forEach(e => this.renderEvent(e, now));
      return;
    }
    if (sound.type === 'sample' && sound.sample) {
      const plan = planSample(sound.sample, key);
      if (!plan) return;
      try {
        const buffer = await this.getSampleBuffer(plan.assetId);
        if (!buffer || !this.ctx || !this.keystrokeGain) return;
        const src = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        src.buffer = buffer;
        src.playbackRate.value = plan.rate;
        gain.gain.value = plan.gain;
        src.connect(gain);
        gain.connect(this.keystrokeGain);
        src.start();
      } catch (e) {
        console.warn('Could not play recording', e);
      }
    }
  }

  public playKeystroke(key: string, soundType: KeystrokeSound) {
    if (soundType === 'off') return;
    this.initContext();
    if (!this.ctx || !this.keystrokeGain) return;

    // ignore pure modifier keys
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape'].includes(key)) {
      return;
    }

    const now = this.ctx.currentTime;

    if (isCustomSoundId(soundType) || isBuiltInSample(soundType)) {
      this.playCustom(soundType, key, now);
      return;
    }

    switch (soundType) {
      case 'thocky':
        this.synthThocky(key, now);
        break;
      case 'creamy':
        this.synthCreamy(key, now);
        break;
      case 'clacky':
        this.synthClacky(key, now);
        break;
      case 'clicky':
        this.synthClicky(key, now);
        break;
      case 'typewriter':
        this.synthTypewriter(key, now);
        break;
      case 'bubbles':
        this.synthBubble(key, now);
        break;
      case 'duck':
        this.synthRubberDuck(key, now);
        break;
      case 'droplet':
        this.synthDroplet(key, now);
        break;
      case 'thud':
        this.synthThud(key, now);
        break;
    }
  }

  // --- real mechanical keyboard acoustic profiles ---

  // 1. thocky: deep, resonant marble & polycarbonate bottom-out
  private synthThocky(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    const isSpaceOrEnter = key === ' ' || key === 'Enter';
    const baseFreq = isSpaceOrEnter 
      ? 190 
      : 240 + (key.charCodeAt(0) % 18) * 5 + (Math.random() * 10 - 5);
    const endFreq = isSpaceOrEnter ? 85 : 125;

    // resonant tonal body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + (isSpaceOrEnter ? 0.055 : 0.038));

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSpaceOrEnter ? 420 : 580, now);
    filter.Q.setValueAtTime(3.2, now);

    const gainAmt = isSpaceOrEnter ? 0.26 : 0.19;
    oscGain.gain.setValueAtTime(gainAmt, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0008, now + (isSpaceOrEnter ? 0.065 : 0.045));

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.keystrokeGain);

    osc.start(now);
    osc.stop(now + 0.07);

    // subtle bottom-out keycap dampening puff
    const noiseBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.02), this.ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * 0.12;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(isSpaceOrEnter ? 350 : 500, now);
    noiseFilter.Q.setValueAtTime(2.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.keystrokeGain);

    noiseSource.start(now);
  }

  // 2. creamy: buttery, smooth, popping mid-frequency lubed linear switches
  private synthCreamy(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    const isSpaceOrEnter = key === ' ' || key === 'Enter';
    const baseFreq = isSpaceOrEnter 
      ? 340 
      : 480 + (key.charCodeAt(0) % 24) * 8;
    const endFreq = isSpaceOrEnter ? 170 : 250;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.028);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.1, now);
    filter.Q.setValueAtTime(2.6, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.keystrokeGain);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 3. clacky: crisp, articulate high-end aluminum plate bottom-out
  private synthClacky(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    const isSpaceOrEnter = key === ' ' || key === 'Enter';
    const strikeFreq = isSpaceOrEnter ? 850 : 1250 + (key.charCodeAt(0) % 20) * 25;

    // high snappy transient
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(strikeFreq, now);
    osc.frequency.exponentialRampToValueAtTime(strikeFreq * 0.5, now + 0.02);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(strikeFreq * 1.3, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.keystrokeGain);

    osc.start(now);
    osc.stop(now + 0.03);

    // complementary key-rebound tick
    const tickOsc = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    tickOsc.type = 'triangle';
    tickOsc.frequency.setValueAtTime(strikeFreq * 0.7, now + 0.005);
    tickGain.gain.setValueAtTime(0.09, now + 0.005);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    tickOsc.connect(tickGain);
    tickGain.connect(this.keystrokeGain);
    tickOsc.start(now + 0.005);
    tickOsc.stop(now + 0.035);
  }

  public playTypewriterClick() {
    this.playKeystroke('a', 'typewriter');
  }

  // manual typewriter: typebar thwack with a low carriage thump, then a small metallic tick
  // every strike differs slightly, which is what makes it sound mechanical
  private noiseBuffer: AudioBuffer | null = null;

  private getNoise(): AudioBuffer {
    if (!this.noiseBuffer && this.ctx) {
      const length = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer!;
  }

  // a short burst of filtered noise that dies away quickly.
  private noiseHit(at: number, dur: number, gainValue: number, filterType: BiquadFilterType, freq: number, q = 0.8) {
    if (!this.ctx || !this.keystrokeGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.getNoise();
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, at);
    filter.Q.setValueAtTime(q, at);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.keystrokeGain);
    // a random slice of the noise, so no two hits are identical.
    src.start(at, Math.random() * 0.8, dur + 0.01);
  }

  // a low thump that falls in pitch: the weight of the carriage and platen.
  private thump(at: number, fromHz: number, toHz: number, dur: number, gainValue: number) {
    if (!this.ctx || !this.keystrokeGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, at);
    osc.frequency.exponentialRampToValueAtTime(toHz, at + dur);
    gain.gain.setValueAtTime(gainValue, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(gain);
    gain.connect(this.keystrokeGain);
    osc.start(at);
    osc.stop(at + dur + 0.01);
  }

  private synthTypewriter(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;
    const jitter = 0.9 + Math.random() * 0.2;
    const code = key.length === 1 ? key.charCodeAt(0) : 0;

    // carriage return: bell, then the lever ratcheting across, then the stop.
    if (key === 'Enter') {
      // brass bell: a clear tone plus inharmonic partials that ring and fade.
      [[2093, 0.15, 1.1], [2093 * 2.76, 0.07, 0.6], [2093 * 5.4, 0.03, 0.3]].forEach(([hz, level, ring]) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, now);
        gain.gain.setValueAtTime(level, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + ring);
        osc.connect(gain);
        gain.connect(this.keystrokeGain!);
        osc.start(now);
        osc.stop(now + ring + 0.02);
      });
      // the ratchet: a run of fast clicks, steadily quieter as the carriage slows.
      const clicks = 16;
      for (let i = 0; i < clicks; i++) {
        const at = now + 0.06 + i * 0.02 + i * i * 0.0004;
        this.noiseHit(at, 0.012, 0.11 * (1 - i / (clicks * 1.4)), 'bandpass', 2800 + Math.random() * 600, 1.4);
      }
      // the carriage reaches the stop.
      const stop = now + 0.06 + clicks * 0.02 + clicks * clicks * 0.0004 + 0.03;
      this.thump(stop, 130, 60, 0.09, 0.3);
      this.noiseHit(stop, 0.05, 0.2, 'lowpass', 1400);
      return;
    }

    // space bar: a heavier, hollower knock with a little spring in it.
    if (key === ' ') {
      this.thump(now, 135 * jitter, 70, 0.075, 0.34);
      this.noiseHit(now, 0.05, 0.2, 'lowpass', 1300 * jitter);
      this.noiseHit(now + 0.004, 0.03, 0.05, 'bandpass', 4200, 5);
      return;
    }

    const soft = key === 'Backspace' || key === 'Delete' ? 0.55 : 1;

    // 1. the key bottoms out and the typebar is thrown: a sharp, broad snap.
    this.noiseHit(now, 0.014, 0.3 * soft, 'bandpass', 1700 * jitter, 0.7);
    // 2. the slug hits the platen through the ribbon: dull, with weight behind it.
    this.noiseHit(now + 0.002, 0.04, 0.24 * soft, 'lowpass', 2000 * jitter);
    this.thump(now + 0.001, (165 + (code % 7) * 7) * jitter, 85, 0.055, 0.3 * soft);
    // 3. the bar drops back into the basket: a small metallic tick, a moment later.
    const back = now + 0.034 + Math.random() * 0.012;
    this.noiseHit(back, 0.01, 0.1 * soft, 'bandpass', 3300 + Math.random() * 500, 2);
  }

  // --- silly & sensory sounds (rubber duck & water droplet) ---

  // ducky toy
  private synthRubberDuck(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    const isSpaceOrEnter = key === ' ' || key === 'Enter';

    if (isSpaceOrEnter) {
      // big quack!
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(310, now + 0.12);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, now);
      filter.Q.setValueAtTime(3.5, now);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.keystrokeGain);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    // rubbery chirp squeak
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = 680 + (key.charCodeAt(0) % 15) * 35;
    const peakFreq = baseFreq * 2.1;
    const endFreq = baseFreq * 1.3;

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.022);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.keystrokeGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // water droplets falling into calm spring pool
  private synthDroplet(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    const isSpace = key === ' ';
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isSpace ? 480 : 780 + (key.charCodeAt(0) % 25) * 22;
    const endFreq = startFreq * (isSpace ? 1.7 : 2.1);

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.028);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.keystrokeGain);
    osc.start(now);
    osc.stop(now + 0.05);

    // subtle water ripple ring
    const ripple = this.ctx.createOscillator();
    const rippleGain = this.ctx.createGain();
    ripple.type = 'sine';
    ripple.frequency.setValueAtTime(startFreq * 0.45, now + 0.015);
    rippleGain.gain.setValueAtTime(0.07, now + 0.015);
    rippleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    ripple.connect(rippleGain);
    rippleGain.connect(this.keystrokeGain);
    ripple.start(now + 0.015);
    ripple.stop(now + 0.06);
  }

  private synthBubble(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    // upward pitch swept sine pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 420 + (key.charCodeAt(0) % 30) * 18 + (Math.random() * 40 - 20);
    const endFreq = baseFreq * 2.2;

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.038);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.keystrokeGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  private synthClicky(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    // tactile mechanical switch (cherry MX blue style click)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();

    osc1.type = 'square';
    const clickFreq = 2600 + (key.charCodeAt(0) % 15) * 40;
    osc1.frequency.setValueAtTime(clickFreq, now);
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc1.connect(gain1);
    gain1.connect(this.keystrokeGain);
    osc1.start(now);
    osc1.stop(now + 0.02);

    // subtle bottom-out thump
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(140, now + 0.005);
    gain2.gain.setValueAtTime(0.08, now + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc2.connect(gain2);
    gain2.connect(this.keystrokeGain);
    osc2.start(now + 0.005);
    osc2.stop(now + 0.04);
  }

  private synthThud(key: string, now: number) {
    if (!this.ctx || !this.keystrokeGain) return;

    // low dampened felt keystroke
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    const freq = 180 + (key.charCodeAt(0) % 20) * 4;
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.keystrokeGain);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  // a short tune for a finished sprint, a reached goal or a new badge. volume is 0 to 1.
  public playChime(chime: ChimeConfig, volume = 0.5) {
    this.initContext();
    if (!this.ctx || volume <= 0) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const level = ctx.createGain();
    level.gain.setValueAtTime(Math.min(1, volume), now);
    level.connect(ctx.destination);
    planChime(chime).forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + n.start;
      osc.type = n.wave;
      osc.frequency.setValueAtTime(n.freq, start);
      // bright waves are loud for their size, so they start lower
      const peak = n.wave === 'sine' || n.wave === 'triangle' ? 0.3 : 0.12;
      gain.gain.setValueAtTime(peak, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + n.decay);
      osc.connect(gain);
      gain.connect(level);
      osc.start(start);
      osc.stop(start + n.decay + 0.05);
    });
    window.setTimeout(() => level.disconnect(), (chimeSeconds(chime) + 0.3) * 1000);
  }

  // ambient sound generation (noise and filters)
  private createPinkNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No audio context');
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private playRainSound(dest: AudioNode) {
    if (!this.ctx) return;

    const noiseBuffer = this.createPinkNoiseBuffer();
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(800, this.ctx.currentTime);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(150, this.ctx.currentTime);

    const rainGain = this.ctx.createGain();
    rainGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    noiseSource.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(rainGain);
    rainGain.connect(dest);

    noiseSource.start();
    this.activeNodes.push(noiseSource, lowpass, highpass, rainGain);
  }


  private triggerFireCrackle(dest: AudioNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random() * 1800, now);

    gain.gain.setValueAtTime(0.12 * Math.random(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  private playLibrarySound(dest: AudioNode) {
    if (!this.ctx) return;

    const noiseBuffer = this.createPinkNoiseBuffer();
    const source = this.ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    source.start();

    this.activeNodes.push(source, filter, gain);
  }



}

export const ambientAudio = new AmbientAudioService();
