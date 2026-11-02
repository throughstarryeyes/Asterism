import React, { useEffect, useState } from 'react';
import { MAKE_COST } from '../../services/shop';
import { useAsterism } from '../../context/AsterismContext';
import { getAssetUrl } from '../../services/assetStore';
import { ACCEPTED_CURSOR_TYPES, CURSOR_SIZES, HOTSPOTS, type CustomCursor, type Hotspot } from '../../services/customCursor';
import { Check, ImagePlus, X } from 'lucide-react';

const small: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)' };
const input: React.CSSProperties = { padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' };
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.8rem' };

const Preview: React.FC<{ cursor: CustomCursor }> = ({ cursor }) => {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    getAssetUrl(cursor.assetId).then(u => { if (live) setUrl(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [cursor.assetId]);
  return url ? <img src={url} width={cursor.width} height={cursor.height} alt="" style={{ imageRendering: 'auto' }} /> : <span style={{ width: 24, height: 24 }} />;
};

// "Your cursors" under appearance → theme → cursor.
export const CursorBuilder: React.FC = () => {
  const { userStats, setCursor, addCustomCursor, deleteCustomCursor } = useAsterism();
  const cursors = userStats.customCursors || [];
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState<number>(32);
  const [hotspot, setHotspot] = useState<Hotspot>('top-left');
  const [busy, setBusy] = useState(false);

  const reset = () => { setFile(null); setName(''); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your cursors</div>

      {cursors.map(c => {
        const active = userStats.activeCursor === c.id;
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', background: active ? 'var(--accent-gold-bg)' : 'var(--bg-card)' }}>
            <button onClick={() => setCursor(c.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', color: 'var(--text-main)', fontSize: '0.88rem' }}>
              <Preview cursor={c} />
              <span>{c.name}</span>
              {active && <Check size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
            </button>
            <button title="Delete" onClick={() => deleteCustomCursor(c.id)} style={{ color: 'var(--text-secondary)', display: 'flex' }}><X size={14} /></button>
          </div>
        );
      })}

      {!file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ ...btn, cursor: 'pointer' }}>
            <ImagePlus size={13} /> Upload a cursor
            <input type="file" accept={ACCEPTED_CURSOR_TYPES.join(',')} style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFile(f); setName(f.name.replace(/\.[^.]+$/, '').slice(0, 40)); } }} />
          </label>
          {cursors.length === 0 && <span style={small}>Any small picture works best with a see-through background.</span>}
        </div>
      )}

      {file && (
        <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name your cursor" maxLength={40} style={input} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Size
              <select value={size} onChange={e => setSize(Number(e.target.value))} style={input}>
                {CURSOR_SIZES.map(s => <option key={s} value={s}>{s} pixels{s === 32 ? ' (usual)' : ''}</option>)}
              </select>
            </label>
            <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Where it points
              <select value={hotspot} onChange={e => setHotspot(e.target.value as Hotspot)} style={input}>
                {HOTSPOTS.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={reset} style={{ ...btn, color: 'var(--text-secondary)' }}>Cancel</button>
            <button disabled={busy}
              onClick={async () => { setBusy(true); const ok = await addCustomCursor(file, name, size, hotspot); setBusy(false); if (ok) reset(); }}
              style={{ ...btn, background: 'var(--accent-primary)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}>
              {busy ? 'Adding…' : `Add cursor (${MAKE_COST} QP)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
