import React from 'react';
import { Num } from '../Book/BookSettings';
import { FillEditor } from './FillEditor';
import { MAX_LAYERS, MIN_SPINE_TEXT_PAGES, PAPER_TYPES, spineWidth, type CoverDesign, type CoverLayer, type CoverSetup, type Effects, type Fill, type Geometry, type ImageLayer, type Move, type ShapeLayer, type TextLayer } from '../../services/cover/design';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Copy, Eye, EyeOff, ImagePlus, Lock, Trash2, Unlock } from 'lucide-react';

const field: React.CSSProperties = { padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.82rem', width: '100%' };
const chip = (on: boolean): React.CSSProperties => ({ padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: on ? 700 : 500, backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)' });
const icon: React.CSSProperties = { display: 'flex', padding: 4, color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 'var(--radius-sm)' };

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
    <h3 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
    {children}
  </section>
);

const Slide: React.FC<{ label: string; value: number; min: number; max: number; step?: number; text?: string; onChange: (n: number) => void }> = ({ label, value, min, max, step = 1, text, onChange }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
    {label}: {text ?? value}
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} style={{ accentColor: 'var(--accent-gold)' }} />
  </label>
);

const Check: React.FC<{ label: string; on: boolean; onChange: (v: boolean) => void }> = ({ label, on, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
    <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} /> {label}
  </label>
);

const ColorBox: React.FC<{ label: string; value: string; onChange: (c: string) => void }> = ({ label, value, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
    <input type="color" value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{ width: 30, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} /> {label}
  </label>
);

// ---- effects: shadow, glow, and for letters an outline and a bevel -------------------------------

const EffectsEditor: React.FC<{ fx: Effects; letters: boolean; onChange: (fx: Effects) => void }> = ({ fx, letters, onChange }) => {
  const set = (patch: Partial<Effects>) => { const next = { ...fx, ...patch }; (Object.keys(next) as Array<keyof Effects>).forEach(k => { if (next[k] === undefined) delete next[k]; }); onChange(next); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Check label="Drop shadow" on={!!fx.shadow} onChange={on => set({ shadow: on ? { x: 0.03, y: 0.04, blur: 0.06, color: '#000000', opacity: 0.55 } : undefined })} />
      {fx.shadow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22 }}>
          <Slide label="Across" value={fx.shadow.x} min={-0.5} max={0.5} step={0.01} text={`${fx.shadow.x.toFixed(2)} in`} onChange={x => set({ shadow: { ...fx.shadow!, x } })} />
          <Slide label="Down" value={fx.shadow.y} min={-0.5} max={0.5} step={0.01} text={`${fx.shadow.y.toFixed(2)} in`} onChange={y => set({ shadow: { ...fx.shadow!, y } })} />
          <Slide label="Softness" value={fx.shadow.blur} min={0} max={0.5} step={0.01} text={`${fx.shadow.blur.toFixed(2)} in`} onChange={blur => set({ shadow: { ...fx.shadow!, blur } })} />
          <Slide label="Strength" value={Math.round(fx.shadow.opacity * 100)} min={0} max={100} text={`${Math.round(fx.shadow.opacity * 100)}%`} onChange={v => set({ shadow: { ...fx.shadow!, opacity: v / 100 } })} />
          <ColorBox label="Shadow color" value={fx.shadow.color} onChange={color => set({ shadow: { ...fx.shadow!, color } })} />
        </div>
      )}
      <Check label="Glow" on={!!fx.glow} onChange={on => set({ glow: on ? { blur: 0.15, color: '#ffe9a8' } : undefined })} />
      {fx.glow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22 }}>
          <Slide label="Spread" value={fx.glow.blur} min={0.02} max={0.8} step={0.01} text={`${fx.glow.blur.toFixed(2)} in`} onChange={blur => set({ glow: { ...fx.glow!, blur } })} />
          <ColorBox label="Glow color" value={fx.glow.color} onChange={color => set({ glow: { ...fx.glow!, color } })} />
        </div>
      )}
      {letters && (
        <>
          <Check label="Outline" on={!!fx.outline} onChange={on => set({ outline: on ? { width: 2, color: '#000000' } : undefined })} />
          {fx.outline && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22 }}>
              <Slide label="Thickness" value={fx.outline.width} min={0.5} max={20} step={0.5} text={`${fx.outline.width} pt`} onChange={width => set({ outline: { ...fx.outline!, width } })} />
              <ColorBox label="Outline color" value={fx.outline.color} onChange={color => set({ outline: { ...fx.outline!, color } })} />
            </div>
          )}
          <Check label="Bevel" on={!!fx.bevel} onChange={on => set({ bevel: on ? { depth: 2, light: '#ffffff', dark: '#000000' } : undefined })} />
          {fx.bevel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22 }}>
              <Slide label="Depth" value={fx.bevel.depth} min={0.5} max={8} step={0.5} text={`${fx.bevel.depth} pt`} onChange={depth => set({ bevel: { ...fx.bevel!, depth } })} />
              <ColorBox label="Highlight" value={fx.bevel.light} onChange={light => set({ bevel: { ...fx.bevel!, light } })} />
              <ColorBox label="Shade" value={fx.bevel.dark} onChange={dark => set({ bevel: { ...fx.bevel!, dark } })} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---- the panel ----------------------------------------------------------------------------------------

export interface InspectorProps {
  design: CoverDesign;
  geo: Geometry;
  trimLabel: string;
  selected: CoverLayer | undefined;
  typesetPages?: number;
  fonts: string[];
  onSetup: (patch: Partial<CoverSetup>) => void;
  onBackground: (f: Fill) => void;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<CoverLayer>) => void;
  onMove: (id: string, move: Move) => void;
  onAdd: (kind: 'text' | 'rect' | 'ellipse' | 'line' | 'spine') => void;
  onPicture: (file: File, replaceId?: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onFit: (id: string, where: 'sheet' | 'front' | 'back') => void;
  onOpenBookLayout: () => void;
  onRestart: () => void;
}

const kindName = (l: CoverLayer) => l.name || (l.kind === 'text' ? (l.text.trim().split('\n')[0] || 'Text').slice(0, 24) : l.kind === 'image' ? 'Picture' : l.shape === 'ellipse' ? 'Circle' : l.shape === 'line' ? 'Line' : 'Box');

export const CoverInspector: React.FC<InspectorProps> = p => {
  const { design, geo, selected: sel } = p;
  const spine = spineWidth(design.setup);
  const update = (patch: Partial<CoverLayer>) => sel && p.onUpdate(sel.id, patch);
  const text = sel?.kind === 'text' ? sel : undefined;
  const image = sel?.kind === 'image' ? sel : undefined;
  const shape = sel?.kind === 'shape' ? sel : undefined;
  const top = [...design.layers].reverse();

  return (
    <aside aria-label="Cover tools" style={{ width: 340, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '14px 16px 40px', backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title="Size of the cover">
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Trim size {p.trimLabel}. <button onClick={p.onOpenBookLayout} style={{ textDecoration: 'underline', cursor: 'pointer', color: 'var(--accent-gold-text, var(--accent-gold))' }}>Change it in the book layout</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Num label="Pages" unit="" step={2} value={design.setup.pages} onCommit={n => p.onSetup({ pages: Math.round(n) })} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Paper
            <select value={design.setup.paper} onChange={e => p.onSetup({ paper: e.target.value })} style={field}>
              {PAPER_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        {p.typesetPages && p.typesetPages !== design.setup.pages && (
          <button onClick={() => p.onSetup({ pages: p.typesetPages! })} style={{ ...chip(false), alignSelf: 'flex-start' }}>Use the {p.typesetPages} pages from your typeset book</button>
        )}
        <Num label="Spine width (your printer's number, if different)" unit="in" step={0.01} value={design.setup.spineOverride ?? spine} onCommit={n => p.onSetup({ spineOverride: n })} />
        {design.setup.spineOverride !== undefined && <button onClick={() => p.onSetup({ spineOverride: undefined })} style={{ ...chip(false), alignSelf: 'flex-start' }}>Work it out from the pages again</button>}
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Spine {spine.toFixed(3)} in. Whole sheet {geo.totalW.toFixed(3)} × {geo.totalH.toFixed(3)} in with {0.125} in bleed.
          {design.setup.pages < MIN_SPINE_TEXT_PAGES && <> Under {MIN_SPINE_TEXT_PAGES} pages the spine is too thin for text, and most printers will not print it.</>}
        </div>
      </Section>

      <Section title="Background">
        <FillEditor fill={design.background} onChange={p.onBackground} label="Whole sheet" />
      </Section>

      <Section title={`Layers (${design.layers.length} of ${MAX_LAYERS})`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <button onClick={() => p.onAdd('text')} style={chip(false)}>+ Text</button>
          <label style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><ImagePlus size={12} /> Picture
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onPicture(f); }} />
          </label>
          <button onClick={() => p.onAdd('rect')} style={chip(false)}>+ Box</button>
          <button onClick={() => p.onAdd('ellipse')} style={chip(false)}>+ Circle</button>
          <button onClick={() => p.onAdd('line')} style={chip(false)}>+ Line</button>
          <button onClick={() => p.onAdd('spine')} disabled={geo.spine < 0.1} title={geo.spine < 0.1 ? 'The spine is too thin' : 'Text up the spine'} style={{ ...chip(false), opacity: geo.spine < 0.1 ? 0.5 : 1 }}>+ Spine text</button>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {top.length === 0 && <li style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nothing on the cover yet.</li>}
          {top.map(l => (
            <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 4px', borderRadius: 'var(--radius-sm)', backgroundColor: sel?.id === l.id ? 'var(--accent-gold-bg)' : 'transparent', border: sel?.id === l.id ? '1px solid var(--accent-gold)' : '1px solid transparent' }}>
              <button onClick={() => p.onUpdate(l.id, { hidden: !l.hidden })} aria-label={l.hidden ? `Show ${kindName(l)}` : `Hide ${kindName(l)}`} style={icon}>{l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              <button onClick={() => p.onUpdate(l.id, { locked: !l.locked })} aria-label={l.locked ? `Unlock ${kindName(l)}` : `Lock ${kindName(l)}`} style={icon}>{l.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
              <button onClick={() => p.onSelect(l.id)} style={{ flex: 1, textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: l.hidden ? 0.5 : 1, padding: '3px 2px' }}>{kindName(l)}</button>
              <button onClick={() => p.onMove(l.id, 'forward')} aria-label={`Bring ${kindName(l)} forward`} title="Bring forward" style={icon}><ArrowUp size={13} /></button>
              <button onClick={() => p.onMove(l.id, 'backward')} aria-label={`Send ${kindName(l)} backward`} title="Send backward" style={icon}><ArrowDown size={13} /></button>
            </li>
          ))}
        </ul>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Higher in the list is in front.</div>
      </Section>

      {sel && (
        <Section title={`Selected: ${kindName(sel)}`}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => p.onMove(sel.id, 'front')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUpToLine size={12} /> To front</button>
            <button onClick={() => p.onMove(sel.id, 'forward')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUp size={12} /> Forward</button>
            <button onClick={() => p.onMove(sel.id, 'backward')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><ArrowDown size={12} /> Backward</button>
            <button onClick={() => p.onMove(sel.id, 'back')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><ArrowDownToLine size={12} /> To back</button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => p.onDuplicate(sel.id)} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><Copy size={12} /> Duplicate</button>
            <button onClick={() => p.onDelete(sel.id)} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={12} /> Delete</button>
          </div>
          <input value={sel.name} onChange={e => update({ name: e.target.value.slice(0, 40) })} placeholder="Name this layer" aria-label="Layer name" style={field} />

          <Slide label="Transparency" value={Math.round((1 - sel.opacity) * 100)} min={0} max={100} text={sel.opacity === 1 ? 'solid' : `${Math.round((1 - sel.opacity) * 100)}% see-through`} onChange={v => update({ opacity: 1 - v / 100 })} />
          <Slide label="Turn" value={Math.round(sel.rotation)} min={-180} max={180} text={`${Math.round(sel.rotation)}°`} onChange={rotation => update({ rotation })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num label="Across" value={sel.x} onCommit={x => update({ x })} />
            <Num label="Down" value={sel.y} onCommit={y => update({ y })} />
            <Num label="Width" value={sel.w} onCommit={w => update({ w })} />
            {sel.kind !== 'text' && <Num label="Height" value={sel.h} onCommit={h => update({ h })} />}
          </div>

          {text && <TextPanel l={text} fonts={p.fonts} update={patch => update(patch)} />}
          {image && <ImagePanel l={image} update={patch => update(patch)} onReplace={f => p.onPicture(f, image.id)} onFit={where => p.onFit(image.id, where)} />}
          {shape && <ShapePanel l={shape} update={patch => update(patch)} />}

          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Effects</div>
          <EffectsEditor fx={sel.effects} letters={sel.kind === 'text'} onChange={effects => update({ effects })} />
        </Section>
      )}

      <button onClick={p.onRestart} style={{ ...chip(false), alignSelf: 'flex-start' }}>Start the cover over</button>
    </aside>
  );
};

const TextPanel: React.FC<{ l: TextLayer; fonts: string[]; update: (patch: Partial<TextLayer>) => void }> = ({ l, fonts, update }) => (
  <>
    <textarea value={l.text} onChange={e => update({ text: e.target.value })} rows={3} aria-label="Text" style={{ ...field, resize: 'vertical' }} />
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Font
      <select value={l.font} onChange={e => update({ font: e.target.value })} style={field}>
        {[...new Set([l.font, ...fonts])].map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      <Num label="Size" unit="pt" step={1} value={l.size} onCommit={size => update({ size })} />
      <Num label="Line gap" unit="×" step={0.05} value={l.lineHeight} onCommit={lineHeight => update({ lineHeight })} />
      <Num label="Letter gap" unit="em" step={0.02} value={l.spacing} onCommit={spacing => update({ spacing })} />
    </div>
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <button onClick={() => update({ bold: !l.bold })} aria-pressed={l.bold} style={{ ...chip(l.bold), fontWeight: 800 }}>B</button>
      <button onClick={() => update({ italic: !l.italic })} aria-pressed={l.italic} style={{ ...chip(l.italic), fontStyle: 'italic' }}>I</button>
      <button onClick={() => update({ upper: !l.upper })} aria-pressed={l.upper} style={chip(l.upper)}>AB</button>
      {(['left', 'center', 'right'] as const).map(a => <button key={a} onClick={() => update({ align: a })} aria-pressed={l.align === a} style={chip(l.align === a)}>{a}</button>)}
    </div>
    <FillEditor fill={l.fill} onChange={fill => update({ fill })} label="Letters" />
    <Slide label="Letter transparency" value={Math.round((1 - l.fillOpacity) * 100)} min={0} max={100} text={l.fillOpacity === 1 ? 'solid' : `${Math.round((1 - l.fillOpacity) * 100)}% see-through`} onChange={v => update({ fillOpacity: 1 - v / 100 })} />
  </>
);

const ImagePanel: React.FC<{ l: ImageLayer; update: (patch: Partial<ImageLayer>) => void; onReplace: (f: File) => void; onFit: (where: 'sheet' | 'front' | 'back') => void }> = ({ l, update, onReplace, onFit }) => (
  <>
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {([['cover', 'Fill the box'], ['contain', 'Fit inside'], ['stretch', 'Stretch']] as const).map(([v, name]) => <button key={v} onClick={() => update({ fit: v })} aria-pressed={l.fit === v} style={chip(l.fit === v)}>{name}</button>)}
    </div>
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <button onClick={() => onFit('sheet')} style={chip(false)}>Cover the whole sheet</button>
      <button onClick={() => onFit('front')} style={chip(false)}>Front only</button>
      <button onClick={() => onFit('back')} style={chip(false)}>Back only</button>
    </div>
    <Num label="Round the corners" step={0.05} value={l.radius} onCommit={radius => update({ radius })} />
    <Check label="Flip left to right" on={l.flip} onChange={flip => update({ flip })} />
    <label style={{ ...chip(false), display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}><ImagePlus size={12} /> Swap the picture
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onReplace(f); }} />
    </label>
  </>
);

const ShapePanel: React.FC<{ l: ShapeLayer; update: (patch: Partial<ShapeLayer>) => void }> = ({ l, update }) => (
  <>
    {l.shape !== 'line' && (
      <>
        <FillEditor fill={l.fill} onChange={fill => update({ fill })} label="Fill" />
        <Slide label="Fill transparency" value={Math.round((1 - l.fillOpacity) * 100)} min={0} max={100} text={l.fillOpacity === 1 ? 'solid' : `${Math.round((1 - l.fillOpacity) * 100)}% see-through`} onChange={v => update({ fillOpacity: 1 - v / 100 })} />
      </>
    )}
    {l.shape === 'rect' && <Num label="Round the corners" step={0.05} value={l.radius} onCommit={radius => update({ radius })} />}
    <Check label={l.shape === 'line' ? 'Line' : 'Border'} on={!!l.stroke || l.shape === 'line'} onChange={on => update({ stroke: on ? { width: 2, color: '#ffffff' } : undefined })} />
    {(l.stroke || l.shape === 'line') && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22 }}>
        <Slide label="Thickness" value={l.stroke?.width ?? 2} min={0.5} max={40} step={0.5} text={`${l.stroke?.width ?? 2} pt`} onChange={width => update({ stroke: { width, color: l.stroke?.color ?? (l.fill.kind === 'solid' ? l.fill.color : '#ffffff') } })} />
        <ColorBox label={l.shape === 'line' ? 'Line color' : 'Border color'} value={l.stroke?.color ?? (l.fill.kind === 'solid' ? l.fill.color : '#ffffff')} onChange={color => update({ stroke: { width: l.stroke?.width ?? 2, color } })} />
      </div>
    )}
  </>
);
