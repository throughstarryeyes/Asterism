import React from 'react';
import { AUTO_FILL, GRADIENT_PRESETS, MATERIALS, findMaterial, MAX_STOPS, MIN_STOPS, STAR_LEVELS, cleanLook, previewStyle, type Gradient, type Look, type StarLevel } from '../../services/backdrops';
import { Plus, X } from 'lucide-react';

const cap: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 };
const chip = (on: boolean): React.CSSProperties => ({ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: on ? 700 : 500, backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)' });

const DEFAULT_GRADIENT: Gradient = { kind: 'linear', angle: 180, stops: [{ color: '#14224f', at: 0 }, { color: '#e8704a', at: 100 }] };

// a gradient, a material, stars and (for pages) glass: what sits behind the app or behind the page.
export const LookEditor: React.FC<{ title: string; look: Look | undefined; page?: boolean; onChange: (look: Look | undefined) => void }> = ({ title, look, page, onChange }) => {
  const set = (patch: Partial<Look>) => onChange(cleanLook({ ...look, ...patch }));
  const gradient = look?.gradient;
  const setGradient = (g: Gradient | undefined) => onChange(cleanLook({ ...look, gradient: g }));
  const editStop = (i: number, patch: Partial<Gradient['stops'][number]>) => gradient && setGradient({ ...gradient, stops: gradient.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, margin: 0, minWidth: 0 }}>
      <legend style={{ padding: '0 6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{title}</legend>
      <div aria-hidden style={{ height: 46, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', ...previewStyle(look) }} />

      <div>
        <div style={cap}>Gradient</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button onClick={() => setGradient(undefined)} aria-pressed={!gradient} style={chip(!gradient)}>None</button>
          {GRADIENT_PRESETS.map(p => <button key={p.id} onClick={() => setGradient(p.gradient)} style={chip(false)}>{p.name}</button>)}
          {!gradient && <button onClick={() => setGradient(DEFAULT_GRADIENT)} style={chip(false)}>Make my own</button>}
        </div>
        {gradient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              {(['linear', 'radial'] as const).map(k => <button key={k} onClick={() => setGradient({ ...gradient, kind: k })} aria-pressed={gradient.kind === k} style={chip(gradient.kind === k)}>{k === 'linear' ? 'Straight' : 'Glow from the middle'}</button>)}
              {gradient.kind === 'linear' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Direction {gradient.angle}°
                  <input type="range" min={0} max={360} value={gradient.angle} onChange={e => setGradient({ ...gradient, angle: Number(e.target.value) })} aria-label="Gradient direction" />
                </label>
              )}
            </div>
            {gradient.stops.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={s.color} onChange={e => editStop(i, { color: e.target.value })} aria-label={`Color ${i + 1}`} style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                <input type="range" min={0} max={100} value={s.at} onChange={e => editStop(i, { at: Number(e.target.value) })} aria-label={`Where color ${i + 1} sits`} style={{ flex: 1 }} />
                <span style={{ width: 34, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.at}%</span>
                {gradient.stops.length > MIN_STOPS && <button onClick={() => setGradient({ ...gradient, stops: gradient.stops.filter((_, j) => j !== i) })} aria-label={`Remove color ${i + 1}`} style={{ display: 'flex', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={13} /></button>}
              </div>
            ))}
            {gradient.stops.length < MAX_STOPS && (
              <button onClick={() => setGradient({ ...gradient, stops: [...gradient.stops, { color: '#ffffff', at: 50 }] })} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}><Plus size={12} /> Add a color</button>
            )}
          </div>
        )}
      </div>

      <div>
        <div style={cap}>Material</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button onClick={() => set({ material: undefined })} aria-pressed={!look?.material} style={chip(!look?.material)}>None</button>
          {MATERIALS.map(m => <button key={m.id} onClick={() => set({ material: m.id, tint: look?.material === m.id ? look.tint : undefined })} aria-pressed={look?.material === m.id} style={chip(look?.material === m.id)}>{m.name}</button>)}
        </div>
        {look?.material && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            <input type="color" value={look.tint ?? findMaterial(look.material)!.tint} onChange={e => set({ tint: e.target.value })} aria-label="Material color" style={{ width: 34, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            Color of the {findMaterial(look.material)!.name.toLowerCase()}
            {look.tint && <button onClick={() => set({ tint: undefined })} style={{ ...chip(false), padding: '1px 8px' }}>Reset</button>}
          </label>
        )}
        {look?.material && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            See-through
            <input type="range" min={0} max={90} value={Math.round((1 - (look.fill ?? (gradient ? AUTO_FILL : 1))) * 100)} onChange={e => set({ fill: 1 - Number(e.target.value) / 100 })} aria-label="How see-through the material is" style={{ flex: 1 }} />
            <span style={{ width: 34, color: 'var(--text-muted)' }}>{Math.round((1 - (look.fill ?? (gradient ? AUTO_FILL : 1))) * 100)}%</span>
          </label>
        )}
      </div>

      <div>
        <div style={cap}>Stars</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button onClick={() => set({ stars: undefined })} aria-pressed={!look?.stars} style={chip(!look?.stars)}>None</button>
          {STAR_LEVELS.map(([id, name]: [StarLevel, string]) => <button key={id} onClick={() => set({ stars: id })} aria-pressed={look?.stars === id} style={chip(look?.stars === id)}>{name}</button>)}
        </div>
      </div>

      {page && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          <span style={cap}>Glass: {look?.glass ? `${Math.round(look.glass * 100)}% see-through` : 'solid page'}</span>
          <input type="range" min={0} max={100} value={Math.round((look?.glass ?? 0) * 100)} onChange={e => set({ glass: Number(e.target.value) / 100 })} aria-label="How see-through the page is" />
          <span style={{ color: 'var(--text-muted)' }}>Pair it with a gradient, material or picture behind the app, or there is nothing to see through to.</span>
        </label>
      )}
    </fieldset>
  );
};
