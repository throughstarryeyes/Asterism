import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { Chips, MakerFrame, Row, text } from './MakerFrame';
import { chip } from './LoaderWorkshop';
import { CHIME_EVENTS, DEFAULT_CHIME_VOLUME, MAX_DECAY, MAX_GAP, MAX_MIDI, MAX_NOTES, MIN_DECAY, MIN_GAP, MIN_MIDI, DEFAULT_CHIMES, NO_CHIME, PRESET_CHIMES, WAVES, cleanChime, chimeFor, noteName, type ChimeConfig, type ChimeWave } from '../../services/chimes';
import { Play, Plus, X } from 'lucide-react';

const PITCHES = Array.from({ length: MAX_MIDI - MIN_MIDI + 1 }, (_, i) => MAX_MIDI - i);

const play: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer' };

export const ChimeWorkshop: React.FC<{ editing: ChimeConfig | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { saveCustomChime, previewChime } = useAsterism();
  const [draft, setDraft] = useState<ChimeConfig>(() => editing ?? { id: `custom-${Date.now()}`, name: '', notes: [72, 76, 79, 84], gap: 0.11, decay: 0.6, wave: 'sine' });
  const set = (patch: Partial<ChimeConfig>) => setDraft(d => ({ ...d, ...patch }));
  const setNote = (i: number, midi: number) => set({ notes: draft.notes.map((n, j) => (j === i ? midi : n)) });
  const clean = cleanChime(draft);

  return (
    <MakerFrame title="Chime workshop" blurb="Compose a short tune, up to eight notes." saveLabel="Save chime" editing={!!editing}
      onSave={() => { saveCustomChime({ ...clean, name: draft.name.trim() || 'My chime' }); onDone(); }} onCancel={onDone}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => previewChime(clean)} style={play}><Play size={13} /> Play it</button>
        <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Start from
          <select value="" onChange={e => { const p = PRESET_CHIMES.find(c => c.id === e.target.value); if (p) set({ notes: [...p.notes], gap: p.gap, decay: p.decay, wave: p.wave }); }} aria-label="Start from a built-in chime"
            style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)' }}>
            <option value="">a built-in chime…</option>
            {PRESET_CHIMES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My chime" aria-label="Chime name" style={text} /></Row>
      <Row name={`Notes (${draft.notes.length} of ${MAX_NOTES})`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {draft.notes.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <select value={n} onChange={e => { setNote(i, Number(e.target.value)); previewChime({ ...clean, notes: [Number(e.target.value)] }); }} aria-label={`Note ${i + 1}`}
                style={{ padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)' }}>
                <option value={0}>rest</option>
                {PITCHES.map(m => <option key={m} value={m}>{noteName(m)}</option>)}
              </select>
              {draft.notes.length > 1 && <button onClick={() => set({ notes: draft.notes.filter((_, j) => j !== i) })} aria-label={`Remove note ${i + 1}`} style={{ display: 'flex', padding: 3, color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={12} /></button>}
            </div>
          ))}
          {draft.notes.length < MAX_NOTES && (
            <button onClick={() => set({ notes: [...draft.notes, draft.notes[draft.notes.length - 1] || 72] })} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Add a note</button>
          )}
        </div>
      </Row>
      <Row name="Sound"><Chips options={(Object.entries(WAVES) as Array<[ChimeWave, string]>)} value={clean.wave} onPick={wave => set({ wave })} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Pace: {clean.gap < 0.1 ? 'quick' : clean.gap < 0.25 ? 'steady' : 'slow'}
          <input type="range" min={MIN_GAP * 100} max={MAX_GAP * 100} value={draft.gap * 100} onChange={e => set({ gap: Number(e.target.value) / 100 })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Ring: {clean.decay.toFixed(1)}s
          <input type="range" min={MIN_DECAY * 100} max={MAX_DECAY * 100} value={draft.decay * 100} onChange={e => set({ decay: Number(e.target.value) / 100 })} /></label>
      </div>
    </MakerFrame>
  );
};

// which chime plays for sprints, goals and badges
export const ChimeAssign: React.FC = () => {
  const { userStats, cosmeticShop, setChimeFor, setChimeVolume, previewChime } = useAsterism();
  const owned = cosmeticShop.filter(i => i.category === 'chime' && i.unlocked).map(i => i.id.slice(i.id.indexOf('-') + 1));
  const options = [
    [NO_CHIME, 'Silence'] as const,
    ...PRESET_CHIMES.filter(c => owned.includes(c.id)).map(c => [c.id, c.name] as const),
    ...(userStats.customChimes ?? []).map(c => [c.id, c.name] as const),
  ];
  return (
    <section aria-label="Which chime plays" style={{ padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>What plays when</div>
      {CHIME_EVENTS.map(ev => {
        const current = userStats.activeChimes?.[ev.id] ?? DEFAULT_CHIMES[ev.id];
        return (
          <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 160, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{ev.label}</span>
            <select value={options.some(([id]) => id === current) ? current : NO_CHIME} onChange={e => setChimeFor(ev.id, e.target.value)} aria-label={ev.label}
              style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)' }}>
              {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <button onClick={() => { const c = chimeFor(ev.id, userStats.activeChimes, userStats.customChimes); if (c) previewChime(c); }} aria-label={`Hear the ${ev.label} chime`} style={{ display: 'flex', padding: 5, borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Play size={12} /></button>
          </div>
        );
      })}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        Chime volume
        <input type="range" min={0} max={100} value={Math.round((userStats.chimeVolume ?? DEFAULT_CHIME_VOLUME) * 100)} onChange={e => setChimeVolume(Number(e.target.value) / 100)} aria-label="Chime volume" style={{ accentColor: 'var(--accent-gold)' }} />
      </label>
    </section>
  );
};
