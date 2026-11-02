import React, { useEffect, useRef, useState } from 'react';
import { MAKE_COST } from '../../services/shop';
import { useAsterism } from '../../context/AsterismContext';
import { ambientAudio } from '../../services/audioService';
import {
  ACCEPTED_AUDIO_TYPES, MAX_LAYERS, PRESETS, defaultRecipe, newLayer, newRecipeSound, newSampleSound, sanitizeSample,
  type CustomSound, type KeyClass, type Layer, type SoundRecipe,
} from '../../services/soundRecipes';
import { Check, Download, Pencil, Play, Plus, Trash2, Upload, X } from 'lucide-react';

const small: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)' };
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.8rem' };
const input: React.CSSProperties = { padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' };

const SECTIONS: Array<{ id: KeyClass; label: string; key: string }> = [
  { id: 'letter', label: 'Letters', key: 'a' },
  { id: 'space', label: 'Space', key: ' ' },
  { id: 'enter', label: 'Enter', key: 'Enter' },
  { id: 'backspace', label: 'Backspace', key: 'Backspace' },
];

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }> =
  ({ label, value, min, max, step = 1, unit = '', onChange }) => (
    <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span>{label}: {Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}{unit}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ accentColor: 'var(--accent-gold)' }} />
    </label>
  );

const LayerCard: React.FC<{ layer: Layer; onChange: (l: Layer) => void; onRemove: () => void }> = ({ layer, onChange, onRemove }) => {
  const set = (patch: Partial<Layer>) => onChange({ ...layer, ...patch } as Layer);
  const title = layer.kind === 'noise' ? 'Click / burst' : layer.kind === 'thump' ? 'Thump' : 'Tone';
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.84rem' }}>{title}</strong>
        <button onClick={onRemove} title="Remove layer" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Trash2 size={14} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {layer.kind === 'noise' && (
          <>
            <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Sound type
              <select value={layer.filter} onChange={e => set({ filter: e.target.value as typeof layer.filter })} style={input}>
                <option value="bandpass">Focused (band)</option>
                <option value="lowpass">Dull (low)</option>
                <option value="highpass">Sharp (high)</option>
              </select>
            </label>
            <Slider label="Pitch" value={layer.freq} min={100} max={10000} step={50} unit=" Hz" onChange={freq => set({ freq })} />
            <Slider label="Focus" value={layer.q} min={0.1} max={10} step={0.1} onChange={q => set({ q })} />
          </>
        )}
        {layer.kind === 'thump' && (
          <>
            <Slider label="Starts at" value={layer.from} min={40} max={600} step={5} unit=" Hz" onChange={from => set({ from })} />
            <Slider label="Falls to" value={layer.to} min={30} max={400} step={5} unit=" Hz" onChange={to => set({ to })} />
          </>
        )}
        {layer.kind === 'tone' && (
          <>
            <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Shape
              <select value={layer.wave} onChange={e => set({ wave: e.target.value as typeof layer.wave })} style={input}>
                <option value="sine">Smooth</option>
                <option value="triangle">Soft</option>
                <option value="square">Hollow</option>
                <option value="sawtooth">Buzzy</option>
              </select>
            </label>
            <Slider label="Starts at" value={layer.from} min={80} max={6000} step={20} unit=" Hz" onChange={from => set({ from })} />
            <Slider label="Glides to" value={layer.to} min={80} max={6000} step={20} unit=" Hz" onChange={to => set({ to })} />
          </>
        )}
        <Slider label="Length" value={layer.dur} min={4} max={400} unit=" ms" onChange={dur => set({ dur })} />
        <Slider label="Delay" value={layer.delay} min={0} max={200} unit=" ms" onChange={delay => set({ delay })} />
        <Slider label="Volume" value={Math.round(layer.gain * 100)} min={1} max={100} unit="%" onChange={v => set({ gain: v / 100 })} />
      </div>
    </div>
  );
};

const RecipeEditor: React.FC<{ recipe: SoundRecipe; onChange: (r: SoundRecipe) => void }> = ({ recipe, onChange }) => {
  const [section, setSection] = useState<KeyClass>('letter');
  const own = section === 'letter' ? recipe.letter : recipe[section];
  const layers = own ?? recipe.letter;
  const usingLetters = section !== 'letter' && !own;

  const setLayers = (next: Layer[]) => onChange(section === 'letter' ? { ...recipe, letter: next } : { ...recipe, [section]: next });
  const updateAt = (i: number, l: Layer) => setLayers(layers.map((x, j) => (j === i ? l : x)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ ...small, display: 'flex', alignItems: 'center', gap: 8 }}>Start from
        <select value="" onChange={e => { const p = PRESETS.find(x => x.name === e.target.value); if (p) onChange(p.recipe); }} style={input}>
          <option value="">Choose a starting point…</option>
          {PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{ ...btn, background: section === s.id ? 'var(--accent-gold-bg)' : 'transparent', borderColor: section === s.id ? 'var(--accent-gold)' : 'var(--border-subtle)' }}>
            {s.label}{s.id !== 'letter' && !recipe[s.id] ? ' (same as letters)' : ''}
          </button>
        ))}
      </div>
      {section !== 'letter' && (
        <label style={{ ...small, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={usingLetters} onChange={e => {
            if (e.target.checked) { const next = { ...recipe }; delete next[section]; onChange(next); }
            else onChange({ ...recipe, [section]: recipe.letter.map(l => ({ ...l })) });
          }} />
          Sounds the same as a letter
        </label>
      )}
      {!usingLetters && (
        <>
          {layers.map((layer, i) => (
            <LayerCard key={i} layer={layer} onChange={l => updateAt(i, l)} onRemove={() => layers.length > 1 && setLayers(layers.filter((_, j) => j !== i))} />
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['noise', 'thump', 'tone'] as const).map(k => (
              <button key={k} disabled={layers.length >= MAX_LAYERS} onClick={() => setLayers([...layers, newLayer(k)])} style={{ ...btn, opacity: layers.length >= MAX_LAYERS ? 0.5 : 1 }}>
                <Plus size={13} /> {k === 'noise' ? 'Click' : k === 'thump' ? 'Thump' : 'Tone'}
              </button>
            ))}
          </div>
        </>
      )}
      <Slider label="How much each press differs" value={Math.round(recipe.variation * 100)} min={0} max={100} unit="%" onChange={v => onChange({ ...recipe, variation: v / 100 })} />
    </div>
  );
};

const SampleEditor: React.FC<{ sound: CustomSound; onChange: (s: CustomSound) => void }> = ({ sound, onChange }) => {
  const { uploadSoundFile } = useAsterism();
  const sample = sound.sample ?? sanitizeSample({});
  const setSample = (patch: Partial<typeof sample>) => onChange({ ...sound, sample: { ...sample, ...patch } });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={small}>Add a short recording of one key press (under 3 seconds; WAV, MP3, OGG or M4A). Other keys use the letter one.</div>
      {SECTIONS.map(s => {
        const id = sample[s.id];
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ width: 80, fontSize: '0.84rem' }}>{s.label}</span>
            <label style={{ ...btn, cursor: 'pointer' }}>
              <Upload size={13} /> {id ? 'Replace' : 'Add recording'}
              <input type="file" accept={ACCEPTED_AUDIO_TYPES.join(',')} style={{ display: 'none' }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const assetId = await uploadSoundFile(file);
                  if (assetId) setSample({ [s.id]: assetId });
                }} />
            </label>
            {id && <button style={btn} onClick={() => ambientAudio.playKeystroke(s.key, sound.id as never)}><Play size={13} /> Hear it</button>}
            {id && <button style={btn} onClick={() => setSample({ [s.id]: undefined })}>Remove</button>}
            {!id && s.id !== 'letter' && <span style={small}>Using the letter recording</span>}
          </div>
        );
      })}
      <Slider label="Pitch variation" value={Math.round(sample.variation * 100)} min={0} max={100} unit="%" onChange={v => setSample({ variation: v / 100 })} />
      <Slider label="Volume" value={Math.round(sample.gain * 100)} min={5} max={200} unit="%" onChange={v => setSample({ gain: v / 100 })} />
    </div>
  );
};

const SoundEditor: React.FC<{ initial: CustomSound; onClose: () => void }> = ({ initial, onClose }) => {
  const { userStats, saveCustomSound, showToast } = useAsterism();
  const [draft, setDraft] = useState<CustomSound>(initial);
  const saved = useRef(userStats.customSounds || []);
  useEffect(() => { saved.current = userStats.customSounds || []; }, [userStats.customSounds]);

  // let the audio engine hear the unsaved draft, and put things back when this closes.
  useEffect(() => {
    ambientAudio.setCustomSounds([...saved.current.filter(s => s.id !== draft.id), draft]);
  }, [draft]);
  useEffect(() => () => ambientAudio.setCustomSounds(saved.current), []);

  const play = (key: string) => ambientAudio.playKeystroke(key, draft.id as never);

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Name your sound" maxLength={40} style={{ ...input, flex: 1, minWidth: 160 }} />
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => draft.type !== 'recipe' && setDraft({ ...draft, type: 'recipe', recipe: draft.recipe ?? defaultRecipe() })}
            style={{ ...btn, background: draft.type === 'recipe' ? 'var(--accent-gold-bg)' : 'transparent' }}>Build it</button>
          <button onClick={() => draft.type !== 'sample' && setDraft({ ...draft, type: 'sample', sample: draft.sample ?? sanitizeSample({}) })}
            style={{ ...btn, background: draft.type === 'sample' ? 'var(--accent-gold-bg)' : 'transparent' }}>Use recordings</button>
        </div>
      </div>

      <input onKeyDown={e => { if (e.key.length === 1 || ['Enter', 'Backspace'].includes(e.key)) play(e.key); }}
        placeholder="Click here and type to try it" style={input} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => <button key={s.id} onClick={() => play(s.key)} style={btn}><Play size={12} /> {s.label}</button>)}
      </div>

      {draft.type === 'recipe' && draft.recipe && <RecipeEditor recipe={draft.recipe} onChange={recipe => setDraft({ ...draft, recipe })} />}
      {draft.type === 'sample' && <SampleEditor sound={draft} onChange={setDraft} />}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ ...btn, color: 'var(--text-secondary)' }}>Cancel</button>
        <button
          onClick={() => {
            if (draft.type === 'sample' && !draft.sample?.letter) { showToast('Add a recording for letters first.', 'info'); return; }
            if (saveCustomSound({ ...draft, name: draft.name.trim() || 'My sound' })) onClose();
          }}
          style={{ ...btn, background: 'var(--accent-primary)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}>
          {(userStats.customSounds || []).some(s => s.id === draft.id) ? 'Save' : `Save (${MAKE_COST} QP)`}
        </button>
      </div>
    </div>
  );
};

// the "Your sounds" section of appearance → sound.
export const SoundBuilder: React.FC = () => {
  const { userStats, setKeystrokeSound, deleteCustomSound, exportCustomSound, importSoundFile } = useAsterism();
  const sounds = userStats.customSounds || [];
  const [editing, setEditing] = useState<CustomSound | null>(null);

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your sounds</div>
        {!editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(newRecipeSound('My sound', PRESETS[0].recipe))} style={{ ...btn, borderColor: 'var(--accent-gold-text, var(--accent-gold))', color: 'var(--accent-gold-text, var(--accent-gold))' }}><Plus size={13} /> Build a sound</button>
            <button onClick={() => setEditing(newSampleSound())} style={btn}><Upload size={13} /> Use recordings</button>
            <label style={{ ...btn, cursor: 'pointer' }}>
              <Download size={13} /> Import
              <input type="file" accept=".json,application/json" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importSoundFile(f); }} />
            </label>
          </div>
        )}
      </div>

      {editing && <SoundEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}

      {!editing && sounds.length === 0 && <div style={small}>None yet. Build one from layers or use your own recordings. You can export one to share.</div>}

      {!editing && sounds.map(s => {
        const active = userStats.keystrokeSound === s.id;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', background: active ? 'var(--accent-gold-bg)' : 'var(--bg-card)', flexWrap: 'wrap' }}>
            <button onClick={() => { setKeystrokeSound(s.id as never); ambientAudio.playKeystroke('a', s.id as never); }} style={{ flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-main)', fontSize: '0.88rem', minWidth: 140 }}>
              {active && <Check size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
              <span>{s.name}</span>
              <span style={small}>{s.type === 'recipe' ? 'built' : 'recordings'}</span>
            </button>
            <button title="Hear it" onClick={() => ambientAudio.playKeystroke('a', s.id as never)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><Play size={14} /></button>
            <button title="Edit" onClick={() => setEditing(s)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><Pencil size={14} /></button>
            <button title="Export to share" onClick={() => exportCustomSound(s.id)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><Download size={14} /></button>
            <button title="Delete" onClick={() => deleteCustomSound(s.id)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
};
