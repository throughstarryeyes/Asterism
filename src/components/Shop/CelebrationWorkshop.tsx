import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { Chips, MakerFrame, Row, text } from './MakerFrame';
import { chip } from './LoaderWorkshop';
import { EFFECTS, FLAT_SHAPES, MAX_COLORS, MAX_SHAPES, SHAPE_GLYPHS, cleanCelebration, type CelebrationConfig, type Effect } from '../../services/celebrations';
import { Plus, X } from 'lucide-react';

const FLAT_NAMES: Record<string, string> = { square: '■', circle: '●', star: '★' };
const show = (s: string) => FLAT_NAMES[s] ?? s;

// a small look at the style: its shapes in its colors. press it to see it go off.
export const ConfettiSample: React.FC<{ config: CelebrationConfig }> = ({ config }) => {
  const { previewCelebration } = useAsterism();
  return (
    <button onClick={() => previewCelebration(config)} aria-label={`Try ${config.name}`} title="Try it"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
      <span style={{ display: 'flex', gap: 5, fontSize: '1.25rem' }}>
        {config.shapes.map((s, i) => <span key={s} style={{ color: config.colors[i % config.colors.length] }}>{show(s)}</span>)}
      </span>
      <span style={{ fontSize: '0.7rem' }}>{EFFECTS[config.effect]} · try it</span>
    </button>
  );
};

const LEVELS: Array<[1 | 2 | 3, string]> = [[1, 'Small'], [2, 'Medium'], [3, 'Large']];
const AMOUNTS: Array<[1 | 2 | 3, string]> = [[1, 'A little'], [2, 'Usual'], [3, 'A lot']];

export const CelebrationWorkshop: React.FC<{ editing: CelebrationConfig | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { saveCustomCelebration, previewCelebration } = useAsterism();
  const [draft, setDraft] = useState<CelebrationConfig>(() => editing ?? { id: `custom-${Date.now()}`, name: '', shapes: ['star'], colors: ['#f7c948', '#fff4c2'], effect: 'burst', amount: 2, size: 2 });
  const [own, setOwn] = useState('');
  const set = (patch: Partial<CelebrationConfig>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanCelebration(draft);
  const toggle = (s: string) => set({ shapes: draft.shapes.includes(s) ? draft.shapes.filter(x => x !== s) : draft.shapes.length >= MAX_SHAPES ? draft.shapes : [...draft.shapes, s] });
  const setColor = (i: number, c: string) => set({ colors: draft.colors.map((x, j) => (j === i ? c : x)) });
  const addOwn = () => {
    const g = Array.from(own.replace(/\s/g, ''))[0];
    if (g) toggle(g);
    setOwn('');
  };
  const extra = draft.shapes.filter(s => !FLAT_SHAPES.includes(s) && !SHAPE_GLYPHS.includes(s));

  return (
    <MakerFrame title="Confetti workshop" blurb="Choose what it is made of and how it moves." saveLabel="Save confetti" editing={!!editing}
      onSave={() => { saveCustomCelebration({ ...clean, name: draft.name.trim() || 'My confetti' }); onDone(); }} onCancel={onDone}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}>
        <ConfettiSample config={clean} />
        <button onClick={() => previewCelebration(clean)} style={{ ...chip(true), padding: '5px 14px' }}>Set it off</button>
      </div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My confetti" aria-label="Confetti name" style={text} /></Row>
      <Row name="How it moves"><Chips options={Object.entries(EFFECTS) as Array<[Effect, string]>} value={clean.effect} onPick={effect => set({ effect })} /></Row>
      <Row name={`Shapes (up to ${MAX_SHAPES})`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {[...FLAT_SHAPES, ...SHAPE_GLYPHS, ...extra].map(s => (
            <button key={s} onClick={() => toggle(s)} aria-pressed={draft.shapes.includes(s)} aria-label={`Shape ${show(s)}`} style={{ ...chip(draft.shapes.includes(s)), padding: '2px 9px', fontSize: '0.95rem' }}>{show(s)}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={own} onChange={e => setOwn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addOwn(); }} placeholder="Type a character or emoji" aria-label="Your own shape" style={text} />
          <button onClick={addOwn} style={{ ...chip(false), padding: '4px 12px' }}>Add</button>
        </div>
      </Row>
      <Row name={`Colors (up to ${MAX_COLORS})`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {draft.colors.map((c, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input type="color" value={c} onChange={e => setColor(i, e.target.value)} aria-label={`Color ${i + 1}`} style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
              {draft.colors.length > 1 && <button onClick={() => set({ colors: draft.colors.filter((_, j) => j !== i) })} aria-label={`Remove color ${i + 1}`} style={{ display: 'flex', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={12} /></button>}
            </span>
          ))}
          {draft.colors.length < MAX_COLORS && <button onClick={() => set({ colors: [...draft.colors, '#ffffff'] })} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Add a color</button>}
        </div>
      </Row>
      <Row name="How much"><Chips options={AMOUNTS} value={clean.amount} onPick={amount => set({ amount })} /></Row>
      <Row name="Size"><Chips options={LEVELS} value={clean.size} onPick={size => set({ size })} /></Row>
    </MakerFrame>
  );
};
