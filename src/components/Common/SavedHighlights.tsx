import React from 'react';
import { Plus, X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';

// highlight colors the writer keeps. "Save" keeps the color now showing in the picker; the little x forgets one.
export const SavedHighlights: React.FC<{ current: string; onPick: (color: string) => void }> = ({ current, onPick }) => {
  const { userStats, saveHighlightColor, removeHighlightColor } = useAsterism();
  const saved = userStats.savedHighlights ?? [];
  const canSave = /^#[0-9a-f]{6}$/i.test(current) && !saved.includes(current.toLowerCase());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Saved</span>
        <button disabled={!canSave} onMouseDown={e => { e.preventDefault(); saveHighlightColor(current); }} title="Save the color now showing" aria-label="Save this highlight color"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', padding: '1px 6px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', color: canSave ? 'var(--text-main)' : 'var(--text-muted)', cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.6 }}><Plus size={10} /> Save</button>
      </div>
      {saved.length === 0
        ? <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Pick a custom color, then Save.</span>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
            {saved.map(c => (
              <span key={c} style={{ position: 'relative', display: 'flex' }}>
                <button onMouseDown={e => { e.preventDefault(); onPick(c); }} title={c} aria-label={`Highlight ${c}`}
                  style={{ flex: 1, height: 24, borderRadius: 'var(--radius-sm)', backgroundColor: c, border: current.toLowerCase() === c ? '2px solid var(--accent-gold)' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' }} />
                <button onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removeHighlightColor(c); }} aria-label={`Forget ${c}`} title="Forget this color"
                  style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: 'var(--bg-paper)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={8} /></button>
              </span>
            ))}
          </div>
        )}
    </div>
  );
};
