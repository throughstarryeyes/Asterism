import { saveBlob } from '../../services/saveFile';
import React, { useEffect, useRef, useState } from 'react';
import { MAKE_COST } from '../../services/shop';
import { useAsterism } from '../../context/AsterismContext';
import { ambientAudio } from '../../services/audioService';
import { ACCEPTED_AUDIO_TYPES } from '../../services/soundRecipes';
import {
  LAYER_NAMES, MAX_SCAPE_LAYERS, RUMBLE_START, MAX_SCAPE_SECONDS, PRESETS, newLayer, newScapeId, sanitizeSoundscape,
  type CustomSoundscape, type ScapeLayer,
} from '../../services/soundscapes';
import { Check, Download, Pencil, Play, Plus, Square, Trash2, Upload, X } from 'lucide-react';

const small: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)' };
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.8rem' };
const input: React.CSSProperties = { padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' };
const field: React.CSSProperties = { ...small, display: 'flex', flexDirection: 'column', gap: 2 };

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; text?: string; onChange: (n: number) => void }> =
  ({ label, value, min, max, step = 1, text, onChange }) => (
    <label style={field}>
      <span>{label}: {text ?? (Number.isInteger(step) ? Math.round(value) : value.toFixed(2))}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: 'var(--accent-gold)' }} />
    </label>
  );

// for settings that span a wide range (pitch, speed), where equal steps should feel like equal changes.
const LogSlider: React.FC<{ label: string; value: number; min: number; max: number; unit: string; digits?: number; onChange: (n: number) => void }> =
  ({ label, value, min, max, unit, digits = 0, onChange }) => {
    const at = Math.log(Math.max(min, value) / min) / Math.log(max / min);
    return (
      <Slider label={label} value={Math.round(at * 1000)} min={0} max={1000} text={`${value >= 100 ? Math.round(value) : value.toFixed(digits)}${unit}`}
        onChange={n => onChange(min * Math.pow(max / min, n / 1000))} />
    );
  };

const Select = <T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) => (
  <label style={field}>{label}
    <select value={value} onChange={e => onChange(e.target.value as T)} style={input}>
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  </label>
);

const WAVES: Array<['sine' | 'triangle' | 'square' | 'sawtooth', string]> = [['sine', 'Smooth'], ['triangle', 'Soft'], ['square', 'Hollow'], ['sawtooth', 'Buzzy']];

const cycle = (rate: number) => (rate >= 1 ? `${rate.toFixed(1)} per second` : `every ${(1 / rate).toFixed(rate < 0.1 ? 0 : 1)} s`);

const LayerCard: React.FC<{ layer: ScapeLayer; onChange: (l: ScapeLayer) => void; onRemove: () => void }> = ({ layer, onChange, onRemove }) => {
  const set = (patch: Record<string, unknown>) => onChange({ ...layer, ...patch } as ScapeLayer);
  const m = layer.motion;
  const setMotion = (patch: Partial<typeof m>) => set({ motion: { ...m, ...patch } });
  const moves = layer.kind !== 'pulses';
  const toneName = layer.kind === 'noise' ? 'Brightness' : layer.kind === 'file' ? 'Speed' : 'Pitch';
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.84rem' }}>{LAYER_NAMES[layer.kind]}</strong>
        <button onClick={onRemove} title="Remove layer" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Trash2 size={14} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {layer.kind === 'noise' && (
          <>
            <Select label="Kind of noise" value={layer.color} options={[['white', 'White (bright hiss)'], ['pink', 'Pink (natural)'], ['brown', 'Brown (deep rumble)']]} onChange={color => set({ color })} />
            <Select label="Filter" value={layer.filter} options={[['none', 'None'], ['lowpass', 'Muffled (low pass)'], ['highpass', 'Airy (high pass)'], ['bandpass', 'Focused (band)']]} onChange={filter => set({ filter })} />
            {layer.filter !== 'none' && <LogSlider label={layer.filter === 'bandpass' ? 'Center' : 'Cutoff'} value={layer.freq} min={20} max={16000} unit=" Hz" onChange={freq => set({ freq })} />}
            {layer.filter !== 'none' && <Slider label="Focus" value={layer.q} min={0.1} max={10} step={0.1} onChange={q => set({ q })} />}
          </>
        )}
        {layer.kind === 'tone' && (
          <>
            <Select label="Shape" value={layer.wave} options={WAVES} onChange={wave => set({ wave })} />
            <LogSlider label="Pitch" value={layer.freq} min={20} max={4000} unit=" Hz" onChange={freq => set({ freq })} />
            <Slider label="Voices stacked" value={layer.voices} min={1} max={5} onChange={voices => set({ voices })} />
            {layer.voices > 1 && <Slider label="Detune between them" value={layer.detune} min={0} max={50} text={`${Math.round(layer.detune)} cents`} onChange={detune => set({ detune })} />}
          </>
        )}
        {layer.kind === 'pulses' && (
          <>
            <Select label="Sound" value={layer.source} options={[['click', 'Click or crackle'], ['tone', 'Note or chime'], ['rumble', 'Rumble or thunder']]} onChange={source => set(source === 'rumble' ? { ...RUMBLE_START, source } : { source })} />
            {layer.source === 'tone' && <Select label="Shape" value={layer.wave} options={WAVES} onChange={wave => set({ wave })} />}
            <LogSlider label="Happens" value={layer.rate} min={0.01} max={20} unit=" a second" digits={2} onChange={rate => set({ rate })} />
            <LogSlider label={layer.source === 'rumble' ? 'Starts at' : 'Pitch'} value={layer.freq} min={20} max={16000} unit=" Hz" onChange={freq => set({ freq })} />
            <Slider label="Pitch wanders" value={layer.spread} min={0} max={3} step={0.05} text={`${layer.spread.toFixed(2)} octaves`} onChange={spread => set({ spread })} />
            {layer.source !== 'tone' && <Slider label={layer.source === 'rumble' ? 'Depth' : 'Focus'} value={layer.q} min={0.1} max={10} step={0.1} onChange={q => set({ q })} />}
            <LogSlider label="Length" value={layer.dur} min={5} max={14000} unit=" ms" onChange={dur => set({ dur })} />
            <Slider label={layer.source === 'rumble' ? 'Darkens' : 'Pitch glides'} value={layer.glide} min={-3} max={3} step={0.1} text={layer.glide === 0 ? 'stays' : `${layer.glide > 0 ? 'up' : 'down'} ${Math.abs(layer.glide).toFixed(1)} octaves`} onChange={glide => set({ glide })} />
            {layer.source === 'tone' && <Select label={layer.glide === 0 ? 'Bend (needs a glide)' : 'Bend'} value={layer.contour} options={[['line', 'One way'], ['arc', 'Out and back']]} onChange={contour => set({ contour })} />}
            {layer.source !== 'click' && <Slider label="Swells in" value={Math.round(layer.attack * 100)} min={0} max={90} text={layer.attack === 0 ? 'sharp start' : `${Math.round(layer.attack * 100)}% of the length`} onChange={v => set({ attack: v / 100 })} />}
            {layer.source !== 'click' && <Slider label={layer.source === 'rumble' ? 'Rolling' : 'Roughness'} value={Math.round(layer.rough * 100)} min={0} max={100} text={layer.rough === 0 ? 'smooth' : `${Math.round(layer.rough * 100)}%`} onChange={v => set({ rough: v / 100 })} />}
          </>
        )}
        {layer.kind === 'file' && <Slider label="Playback speed" value={layer.rate} min={0.5} max={2} step={0.05} text={`${layer.rate.toFixed(2)}x`} onChange={rate => set({ rate })} />}

        <Slider label="Volume" value={Math.round(layer.volume * 100)} min={2} max={100} text={`${Math.round(layer.volume * 100)}%`} onChange={v => set({ volume: v / 100 })} />
        <Slider label="Position" value={Math.round(layer.pan * 100)} min={-100} max={100} text={layer.pan === 0 ? 'center' : `${Math.abs(Math.round(layer.pan * 100))}% ${layer.pan < 0 ? 'left' : 'right'}`} onChange={v => set({ pan: v / 100 })} />
      </div>
      <div style={{ ...small, fontWeight: 600 }}>Movement{!moves && ' (loudness only)'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <Slider label="Swell" value={Math.round(m.depth * 100)} min={0} max={100} text={m.depth === 0 ? 'none' : `${Math.round(m.depth * 100)}%`} onChange={v => setMotion({ depth: v / 100 })} />
        {m.depth > 0 && (
          <>
            <LogSlider label="Speed" value={m.rate} min={0.02} max={8} unit="" digits={2} onChange={rate => setMotion({ rate })} />
            <div style={{ ...small, alignSelf: 'end' }}>Cycles {cycle(m.rate)}</div>
            {moves && <Select label="Swells" value={m.target} options={[['volume', 'Loudness'], ['tone', toneName], ['both', `Loudness and ${toneName.toLowerCase()}`]]} onChange={target => setMotion({ target })} />}
          </>
        )}
      </div>
    </div>
  );
};

const ScapeEditor: React.FC<{ initial: CustomSoundscape; onClose: () => void }> = ({ initial, onClose }) => {
  const { userStats, saveSoundscape, uploadScapeFile } = useAsterism();
  const [draft, setDraft] = useState<CustomSoundscape>(initial);
  const [hearing, setHearing] = useState(false);
  const [busy, setBusy] = useState(false);
  // what was playing before the editor started, so closing puts it back.
  const before = useRef(userStats.ambientSound);

  useEffect(() => () => ambientAudio.play(before.current), []);

  const full = draft.layers.length >= MAX_SCAPE_LAYERS;
  const setLayers = (layers: ScapeLayer[]) => setDraft(d => ({ ...d, layers }));
  const add = (layer: ScapeLayer) => setDraft(d => ({ ...d, layers: [...d.layers, layer] }));

  // a change while listening is heard straight away.
  const layersKey = JSON.stringify(draft.layers);
  useEffect(() => {
    if (hearing) ambientAudio.preview(draft);
    // only when the mix changes; the name does not matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersKey]);

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Name your soundscape" maxLength={40} style={{ ...input, flex: 1, minWidth: 160 }} />
        <label style={{ ...small, display: 'flex', alignItems: 'center', gap: 6 }}>Start from
          <select value="" onChange={e => { const p = PRESETS.find(x => x.id === e.target.value); if (p) setLayers(p.layers.map(l => ({ ...l, motion: { ...l.motion } }))); }} style={input}>
            <option value="">Choose…</option>
            {PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {hearing
          ? <button onClick={() => { ambientAudio.stop(); setHearing(false); }} style={btn}><Square size={12} /> Stop</button>
          : <button onClick={() => { ambientAudio.preview(draft); setHearing(true); }} disabled={!draft.layers.length} style={{ ...btn, opacity: draft.layers.length ? 1 : 0.5 }}><Play size={12} /> Hear it</button>}
        <span style={{ ...small, alignSelf: 'center' }}>You hear changes as you make them.</span>
      </div>

      {draft.layers.length === 0 && <div style={small}>Start from a preset or add layers (up to {MAX_SCAPE_LAYERS}).</div>}

      {draft.layers.map((l, i) => (
        <LayerCard key={i} layer={l}
          onChange={next => setLayers(draft.layers.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setLayers(draft.layers.filter((_, j) => j !== i))} />
      ))}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['noise', 'tone', 'pulses'] as const).map(k => (
          <button key={k} disabled={full} onClick={() => add(newLayer(k))} style={{ ...btn, opacity: full ? 0.5 : 1 }}><Plus size={13} /> {LAYER_NAMES[k]}</button>
        ))}
        <label style={{ ...btn, cursor: full || busy ? 'default' : 'pointer', opacity: full ? 0.5 : 1 }}>
          <Upload size={13} /> {busy ? 'Reading…' : 'Recording'}
          <input type="file" disabled={full || busy} accept={ACCEPTED_AUDIO_TYPES.join(',')} style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              const assetId = await uploadScapeFile(file);
              setBusy(false);
              if (assetId) add(newLayer('file', assetId));
            }} />
        </label>
      </div>
      <div style={small}>Noise is steady, like rain or wind. Tones are drones; stack voices for a pad. Pulses are random sounds, like crackles or chimes. Recordings loop ({MAX_SCAPE_SECONDS / 60} minutes max).</div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ ...btn, color: 'var(--text-secondary)' }}>Cancel</button>
        <button
          onClick={() => { if (saveSoundscape({ ...draft, name: draft.name.trim() || 'My soundscape' })) onClose(); }}
          style={{ ...btn, background: 'var(--accent-primary)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}>
          {(userStats.customSoundscapes || []).some(s => s.id === draft.id) ? 'Save' : `Save (${MAKE_COST} QP)`}
        </button>
      </div>
    </div>
  );
};

// the "Your soundscapes" section of appearance → sound.
export const SoundscapeBuilder: React.FC = () => {
  const { userStats, setAmbientSound, deleteSoundscape, saveSoundscape, showToast } = useAsterism();
  const scapes = userStats.customSoundscapes || [];
  const [editing, setEditing] = useState<CustomSoundscape | null>(null);

  // a soundscape travels as a small text file, so it can be shared or kept as a backup
  const exportScape = (s: CustomSoundscape) => {
    const blob = new Blob([JSON.stringify({ asterismSoundscape: 1, name: s.name, layers: s.layers }, null, 2)], { type: 'application/json' });
    void saveBlob(`${s.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'soundscape'}.soundscape.json`, blob);
  };
  const importScape = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as { layers?: unknown; name?: unknown };
      const clean = sanitizeSoundscape({ name: raw.name, layers: raw.layers });
      if (!clean || !clean.layers.length) throw new Error('empty');
      // recordings are stored on this device, so a file brings only the layers that make sound by themselves
      const made = { ...clean, layers: clean.layers.filter(l => l.kind !== 'file'), id: newScapeId() };
      if (!made.layers.length) throw new Error('empty');
      saveSoundscape(made, true);
    } catch { showToast('That is not a soundscape file.', 'info'); }
  };

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your soundscapes</div>
        {!editing && (
          <button onClick={() => setEditing({ id: newScapeId(), name: 'My soundscape', layers: [] })} style={{ ...btn, borderColor: 'var(--accent-gold-text, var(--accent-gold))', color: 'var(--accent-gold-text, var(--accent-gold))' }}><Plus size={13} /> Make a soundscape</button>
        )}
      </div>

      {editing && <ScapeEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}

      {!editing && (
        <label style={{ ...small, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', textDecoration: 'underline' }}>
          Add one from a file
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importScape(f); }} />
        </label>
      )}

      {!editing && scapes.length === 0 && <div style={small}>None yet. Mix noise, tones and random sounds, or loop your own recording.</div>}

      {!editing && scapes.map(s => {
        const active = userStats.ambientSound === s.id;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', background: active ? 'var(--accent-gold-bg)' : 'var(--bg-card)', flexWrap: 'wrap' }}>
            <button onClick={() => setAmbientSound(active ? 'off' : s.id)} style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)', fontSize: '0.88rem', minWidth: 140 }}>
              {active && <Check size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
              <span>{s.name}</span>
              <span style={small}>{s.layers.length} layer{s.layers.length === 1 ? '' : 's'}</span>
            </button>
            <button title="Edit" onClick={() => setEditing(s)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><Pencil size={14} /></button>
            <button title="Export to share" onClick={() => exportScape(s)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><Download size={14} /></button>
            <button title="Delete" onClick={() => deleteSoundscape(s.id)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
};
