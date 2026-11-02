import React from 'react';
import { GRADIENT_PRESETS, MAX_STOPS, MIN_STOPS, type Gradient } from '../../services/backdrops';
import type { Fill } from '../../services/cover/design';
import { fillCss } from '../../services/cover/render';
import { Plus, X } from 'lucide-react';

const chip = (on: boolean): React.CSSProperties => ({ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: on ? 700 : 500, backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)' });

export const GradientEditor: React.FC<{ gradient: Gradient; onChange: (g: Gradient) => void }> = ({ gradient, onChange }) => {
  const edit = (i: number, patch: Partial<Gradient['stops'][number]>) => onChange({ ...gradient, stops: gradient.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['linear', 'radial'] as const).map(k => <button key={k} onClick={() => onChange({ ...gradient, kind: k })} aria-pressed={gradient.kind === k} style={chip(gradient.kind === k)}>{k === 'linear' ? 'Straight' : 'From the middle'}</button>)}
        {gradient.kind === 'linear' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            {gradient.angle}°
            <input type="range" min={0} max={360} value={gradient.angle} onChange={e => onChange({ ...gradient, angle: Number(e.target.value) })} aria-label="Gradient direction" />
          </label>
        )}
      </div>
      {gradient.stops.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color" value={s.color} onChange={e => edit(i, { color: e.target.value })} aria-label={`Color ${i + 1}`} style={{ width: 32, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
          <input type="range" min={0} max={100} value={s.at} onChange={e => edit(i, { at: Number(e.target.value) })} aria-label={`Where color ${i + 1} sits`} style={{ flex: 1 }} />
          <span style={{ width: 32, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.at}%</span>
          {gradient.stops.length > MIN_STOPS && <button onClick={() => onChange({ ...gradient, stops: gradient.stops.filter((_, j) => j !== i) })} aria-label={`Remove color ${i + 1}`} style={{ display: 'flex', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={12} /></button>}
        </div>
      ))}
      {gradient.stops.length < MAX_STOPS && <button onClick={() => onChange({ ...gradient, stops: [...gradient.stops, { color: '#ffffff', at: 50 }] })} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}><Plus size={12} /> Add a color</button>}
    </div>
  );
};

const DEFAULT: Gradient = { kind: 'linear', angle: 180, stops: [{ color: '#1c2745', at: 0 }, { color: '#c9622b', at: 100 }] };

// a flat color or a gradient
export const FillEditor: React.FC<{ fill: Fill; onChange: (f: Fill) => void; label: string }> = ({ fill, onChange, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span aria-hidden style={{ width: 34, height: 22, borderRadius: 4, border: '1px solid var(--border-strong)', background: fillCss(fill) }} />
      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginRight: 4 }}>{label}</span>
      <button onClick={() => onChange(fill.kind === 'solid' ? fill : { kind: 'solid', color: fill.gradient.stops[0].color })} aria-pressed={fill.kind === 'solid'} style={chip(fill.kind === 'solid')}>Color</button>
      <button onClick={() => onChange(fill.kind === 'gradient' ? fill : { kind: 'gradient', gradient: { ...DEFAULT, stops: [{ color: fill.color, at: 0 }, { color: '#ffffff', at: 100 }] } })} aria-pressed={fill.kind === 'gradient'} style={chip(fill.kind === 'gradient')}>Gradient</button>
      {fill.kind === 'solid' && <input type="color" value={fill.color} onChange={e => onChange({ kind: 'solid', color: e.target.value })} aria-label={`${label} color`} style={{ width: 32, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />}
    </div>
    {fill.kind === 'gradient' && (
      <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {GRADIENT_PRESETS.map(p => <button key={p.id} onClick={() => onChange({ kind: 'gradient', gradient: p.gradient })} style={chip(false)}>{p.name}</button>)}
        </div>
        <GradientEditor gradient={fill.gradient} onChange={gradient => onChange({ kind: 'gradient', gradient })} />
      </>
    )}
  </div>
);
