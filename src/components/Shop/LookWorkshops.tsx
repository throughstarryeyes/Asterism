import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { TrailPad } from '../Common/CursorTrail';
import { Chips, Color, MakerFrame, Row, text } from './MakerFrame';
import { chip } from './LoaderWorkshop';
import { BARS, BORDERS, CORNERS, MARKS, MAX_RADIUS, MAX_TILT, cleanShape, shapeStyle, type ShapeConfig } from '../../services/shapes';
import { MAX_LIFE, MAX_SIZE, MAX_SPREAD, MIN_LIFE, MIN_SIZE, MOTIONS, TRAIL_GLYPHS, cleanTrail, type TrailConfig, type TrailMotion } from '../../services/trails';

// the workshops for pointer trails and comment shapes

export const TrailWorkshop: React.FC<{ editing: TrailConfig | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { saveCustomTrail } = useAsterism();
  const [draft, setDraft] = useState<TrailConfig>(() => editing ?? { id: `custom-${Date.now()}`, name: '', glyph: '✦', color: 'accent', size: 14, life: 900, spread: 8, motion: 'float', rate: 2 });
  const set = (patch: Partial<TrailConfig>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanTrail(draft);
  const chars = Array.from(draft.glyph);

  return (
    <MakerFrame title="Trail workshop" blurb="Pick what falls off your pointer, and how." saveLabel="Save trail" editing={!!editing}
      onSave={() => { saveCustomTrail({ ...clean, name: draft.name.trim() || 'My trail' }); onDone(); }} onCancel={onDone}>
      <TrailPad trail={clean} />
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My trail" aria-label="Trail name" style={text} /></Row>
      <Row name={`Bits (up to 3, picked at random)`}>
        <input value={draft.glyph} onChange={e => set({ glyph: Array.from(e.target.value).slice(0, 3).join('') })} aria-label="Trail glyphs" style={{ ...text, marginBottom: 8 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TRAIL_GLYPHS.map(g => (
            <button key={g} onClick={() => set({ glyph: chars.length >= 3 ? g : draft.glyph + g })} aria-label={`Add ${g}`} style={{ ...chip(false), padding: '2px 8px', fontSize: '0.9rem' }}>{g}</button>
          ))}
          <button onClick={() => set({ glyph: '' })} style={{ ...chip(false), padding: '2px 8px' }}>Clear</button>
        </div>
      </Row>
      <Row name="Motion"><Chips options={(Object.entries(MOTIONS) as Array<[TrailMotion, string]>)} value={clean.motion} onPick={motion => set({ motion })} /></Row>
      <Row name="How often"><Chips options={[[1, 'Sparse'], [2, 'Usual'], [3, 'Dense']]} value={clean.rate} onPick={rate => set({ rate: rate as 1 | 2 | 3 })} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Size: {clean.size}px
          <input type="range" min={MIN_SIZE} max={MAX_SIZE} value={draft.size} onChange={e => set({ size: Number(e.target.value) })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Lasts: {(clean.life / 1000).toFixed(1)}s
          <input type="range" min={MIN_LIFE} max={MAX_LIFE} step={50} value={draft.life} onChange={e => set({ life: Number(e.target.value) })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Scatter: {clean.spread}px
          <input type="range" min={0} max={MAX_SPREAD} value={draft.spread} onChange={e => set({ spread: Number(e.target.value) })} /></label>
      </div>
      <Row name="Color"><Color value={draft.color} onPick={color => set({ color })} /></Row>
    </MakerFrame>
  );
};

// a comment card and some marked text, drawn the way the shape will look
export const ShapeSample: React.FC<{ shape: ShapeConfig }> = ({ shape }) => {
  const look = shapeStyle(shape);
  const attrs = look ? { 'data-cs': '1', 'data-cs-corner': look.corner, 'data-cs-mark': look.mark, 'data-cs-bar': look.bar } : {};
  return (
    <div {...attrs} style={{ ...(look?.vars as React.CSSProperties), width: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 8px 12px', pointerEvents: 'none' }}>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-main)' }}>She <mark data-comment-id="sample" style={{ color: 'var(--text-main)' }}>never looked back</mark> again.</div>
      <div className="comment-shaped" style={{ padding: 10, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.7rem' }}>Editor</div>
        Lovely line. Maybe a beat before it?
      </div>
    </div>
  );
};

export const ShapeWorkshop: React.FC<{ editing: ShapeConfig | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { saveCustomShape } = useAsterism();
  const [draft, setDraft] = useState<ShapeConfig>(() => editing ?? { id: `custom-${Date.now()}`, name: '', radius: 12, border: 'solid', bar: 'none', corner: 'none', tilt: 0, tint: false, mark: 'highlight', color: 'accent' });
  const set = (patch: Partial<ShapeConfig>) => setDraft(d => ({ ...d, ...patch }));
  // the sample needs to show the plain shape's differences too, so it never uses the "no shape" id
  const clean = cleanShape(draft);

  return (
    <MakerFrame title="Comment shape workshop" blurb="Shape the cards in the comments drawer and the marks they leave in your text." saveLabel="Save shape" editing={!!editing}
      onSave={() => { saveCustomShape({ ...clean, name: draft.name.trim() || 'My shape' }); onDone(); }} onCancel={onDone}>
      <div style={{ padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}><ShapeSample shape={clean} /></div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My shape" aria-label="Shape name" style={text} /></Row>
      <Row name="Border"><Chips options={Object.entries(BORDERS) as Array<[ShapeConfig['border'], string]>} value={clean.border} onPick={border => set({ border })} /></Row>
      <Row name="Colored edge"><Chips options={Object.entries(BARS) as Array<[ShapeConfig['bar'], string]>} value={clean.bar} onPick={bar => set({ bar })} /></Row>
      <Row name="Corner"><Chips options={Object.entries(CORNERS) as Array<[ShapeConfig['corner'], string]>} value={clean.corner} onPick={corner => set({ corner })} /></Row>
      <Row name="Marked text"><Chips options={Object.entries(MARKS) as Array<[ShapeConfig['mark'], string]>} value={clean.mark} onPick={mark => set({ mark })} /></Row>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Roundness: {clean.radius}px
          <input type="range" min={0} max={MAX_RADIUS} value={draft.radius} onChange={e => set({ radius: Number(e.target.value) })} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Tilt: {clean.tilt}°
          <input type="range" min={-MAX_TILT} max={MAX_TILT} step={0.5} value={draft.tilt} onChange={e => set({ tilt: Number(e.target.value) })} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.tint} onChange={e => set({ tint: e.target.checked })} /> Tint the card
        </label>
      </div>
      <Row name="Card color"><Color value={draft.color} onPick={color => set({ color })} /></Row>
      <Row name="Color of marks in the text">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => set({ markColor: 'same' })} aria-pressed={clean.markColor === 'same'} style={chip(clean.markColor === 'same')}>Same as the card</button>
          <Color value={clean.markColor === 'same' ? 'none' : clean.markColor ?? 'same'} onPick={markColor => set({ markColor })} />
        </div>
      </Row>
    </MakerFrame>
  );
};
