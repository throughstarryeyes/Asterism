import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { LoaderArt } from '../Common/Loader';
import { LAYOUTS, MAX_COUNT, MAX_STEP, MIN_COUNT, MIN_STEP, SHAPES, cleanLoader } from '../../services/loaders';
import { MAKE_COST } from '../../services/shop';
import type { CosmeticItem, LoaderConfig, LoaderLayout, LoaderShape } from '../../types';

const blank = (): LoaderConfig => ({ id: `custom-${Date.now()}`, name: '', shape: 'star', layout: 'row', count: 4, step: 0.28, color: 'accent' });

export const chip = (on: boolean): React.CSSProperties => ({
  padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', cursor: 'pointer',
  fontWeight: on ? 700 : 500,
  backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)',
  color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
  border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
});

export const label: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 };

// design a loader of your own. the first save unlocks the workshop; after that it is free.
export const LoaderWorkshop: React.FC<{ editing: LoaderConfig | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { canMake, saveCustomLoader } = useAsterism();
  const [draft, setDraft] = useState<LoaderConfig>(() => editing ?? blank());
  const owned = !!editing;
  const set = (patch: Partial<LoaderConfig>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanLoader(draft);

  const save = () => {
    if (!owned && !canMake()) return;
    saveCustomLoader({ ...clean, name: draft.name.trim() || 'My loader' });
    setDraft(blank());
    onDone();
  };

  return (
    <section aria-label="Loader workshop" style={{ padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Loader workshop</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Pick a shape and a layout and watch it light up. {owned ? 'Editing is free.' : `Design freely. Saving a new one costs ${MAKE_COST} QP.`}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 110, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)', color: 'var(--accent-gold-text, var(--accent-gold))' }}>
        <LoaderArt key={`${clean.shape}${clean.layout}${clean.count}${clean.step}`} config={clean} size={22} />
      </div>

      <div>
        <div style={label}>Name</div>
        <input
          value={draft.name}
          maxLength={24}
          onChange={e => set({ name: e.target.value })}
          placeholder="My loader"
          aria-label="Loader name"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', fontSize: '0.84rem' }}
        />
      </div>

      <div>
        <div style={label}>Shape</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(SHAPES) as LoaderShape[]).map(s => (
            <button key={s} onClick={() => set({ shape: s })} aria-pressed={draft.shape === s} title={SHAPES[s].name} style={{ ...chip(draft.shape === s), display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden><path d={SHAPES[s].path} fill="currentColor" /></svg>
              {SHAPES[s].name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={label}>Layout</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(Object.keys(LAYOUTS) as LoaderLayout[]).map(l => (
            <button key={l} onClick={() => set({ layout: l })} aria-pressed={draft.layout === l} style={chip(draft.layout === l)}>{LAYOUTS[l]}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={label}>How many: {clean.count}</span>
          <input type="range" min={MIN_COUNT} max={MAX_COUNT} step={1} value={draft.count} onChange={e => set({ count: Number(e.target.value) })} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={label}>Pace: {clean.step < 0.18 ? 'quick' : clean.step < 0.36 ? 'steady' : 'slow'}</span>
          {/* the slider runs from slow on the left to quick on the right */}
          <input type="range" min={0} max={100} step={1} value={Math.round(((MAX_STEP - draft.step) / (MAX_STEP - MIN_STEP)) * 100)} onChange={e => set({ step: MAX_STEP - (Number(e.target.value) / 100) * (MAX_STEP - MIN_STEP) })} />
        </label>
        <div>
          <div style={label}>Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => set({ color: 'accent' })} aria-pressed={draft.color === 'accent'} style={chip(draft.color === 'accent')}>Theme gold</button>
            <input type="color" aria-label="Custom color" value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#c9933b'} onChange={e => set({ color: e.target.value })} style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {editing && <button onClick={onDone} style={{ ...chip(false), padding: '6px 14px' }}>Cancel</button>}
        <button
          onClick={save}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', color: '#ffffff' }}
        >
          {owned ? 'Save loader' : `Save (${MAKE_COST} QP)`}
        </button>
      </div>
    </section>
  );
};
