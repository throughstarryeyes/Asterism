import React, { useRef, useState } from 'react';
import { ImagePlus, Save, X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { DEFAULT_NOTE_COLOR, MIN_OPACITY, NOTE_BORDERS, NOTE_COLORS, NOTE_SHAPES, noteImage } from '../../services/scratchpads';
import type { NoteBorder, NoteShape, NoteStyle, Scratchpad } from '../../types';

const label: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const select: React.CSSProperties = { padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.8rem' };
const small: React.CSSProperties = { fontSize: '0.74rem', padding: '3px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };

// color, shape, border, see-through and a picture for one note. everything it changes is the note's `style`.
export const NoteStyleEditor: React.FC<{ style: NoteStyle | undefined; onChange: (style: NoteStyle) => void }> = ({ style, onChange }) => {
  const { userStats, saveNoteStyle, removeNoteStyle, showToast } = useAsterism();
  const file = useRef<HTMLInputElement>(null);
  const [styleName, setStyleName] = useState('');
  const s = style ?? {};
  const set = (patch: Partial<NoteStyle>) => onChange({ ...s, ...patch });
  const saved = userStats.savedNoteStyles ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={label}>Color</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4, alignItems: 'center' }}>
          {NOTE_COLORS.map(c => (
            <button key={c} aria-label={`Color ${c}`} onClick={() => set({ color: c })}
              style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: (s.color ?? DEFAULT_NOTE_COLOR) === c ? '2px solid var(--accent-gold)' : '1px solid rgba(0,0,0,0.25)', cursor: 'pointer' }} />
          ))}
          <input type="color" aria-label="Any color" value={s.color ?? DEFAULT_NOTE_COLOR} onChange={e => set({ color: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'none', cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={label}>Shape</span>
          <select aria-label="Shape" value={s.shape ?? 'square'} onChange={e => set({ shape: e.target.value as NoteShape })} style={select}>
            {NOTE_SHAPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={label}>Border</span>
          <select aria-label="Border" value={s.border ?? 'none'} onChange={e => set({ border: e.target.value as NoteBorder })} style={select}>
            {NOTE_BORDERS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>
      </div>

      {(s.border ?? 'none') !== 'none' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Border color
            <input type="color" aria-label="Border color" value={s.borderColor ?? '#3a321a'} onChange={e => set({ borderColor: e.target.value })} style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'none', cursor: 'pointer' }} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Thickness
            <input type="range" min={1} max={8} value={s.borderWidth ?? 2} onChange={e => set({ borderWidth: Number(e.target.value) })} aria-label="Border thickness" /></label>
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        <span style={label}>See-through ({Math.round((1 - (s.opacity ?? 1)) * 100)}%)</span>
        <input type="range" min={0} max={Math.round((1 - MIN_OPACITY) * 100)} value={Math.round((1 - (s.opacity ?? 1)) * 100)} onChange={e => set({ opacity: 1 - Number(e.target.value) / 100 })} aria-label="See-through" style={{ accentColor: 'var(--accent-gold)' }} />
      </label>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={label}>Picture</span>
        <button onClick={() => file.current?.click()} style={small}><ImagePlus size={12} /> {s.image ? 'Change' : 'Add a picture'}</button>
        {s.image && <button onClick={() => set({ image: undefined })} style={small}><X size={12} /> Remove</button>}
        <input ref={file} type="file" accept="image/*" hidden onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try { set({ image: await noteImage(f) }); } catch (err) { showToast(err instanceof Error ? err.message : 'That picture would not work.', 'info'); }
        }} />
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
        <div style={label}>Saved looks</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <input value={styleName} onChange={e => setStyleName(e.target.value)} placeholder="Name this look" aria-label="Name for this look" maxLength={24} style={{ ...select, width: 130 }} />
          <button onClick={() => { saveNoteStyle(styleName, s); setStyleName(''); }} style={small}><Save size={12} /> Save</button>
        </div>
        {saved.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
            {saved.map(n => (
              <span key={n.id} style={{ ...small, padding: 0, overflow: 'hidden' }}>
                <button onClick={() => onChange(n.style)} style={{ padding: '3px 4px 3px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'inherit' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: n.style.color ?? DEFAULT_NOTE_COLOR, border: '1px solid rgba(0,0,0,0.3)' }} />{n.name}
                </button>
                <button aria-label={`Delete the look ${n.name}`} onClick={() => removeNoteStyle(n.id)} style={{ padding: '3px 6px 3px 2px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// which documents a note shows on: every one, or the ones ticked
export const NotePlacement: React.FC<{ pad: Scratchpad; onChange: (pad: Scratchpad) => void }> = ({ pad, onChange }) => {
  const { project, allProjects } = useAsterism();
  const docs = [project, ...allProjects.filter(p => p.id !== project.id)];
  const ids = pad.docIds ?? [];
  const toggle = (id: string) => onChange({ ...pad, everywhere: false, docIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!pad.everywhere} onChange={e => onChange({ ...pad, everywhere: e.target.checked })} /> Show on every document
      </label>
      {!pad.everywhere && (
        <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
          {docs.map(d => (
            <label key={d.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={ids.includes(d.id)} onChange={() => toggle(d.id)} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || 'Untitled'}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
