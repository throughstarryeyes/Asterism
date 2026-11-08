import React, { useState } from 'react';
import { LayoutGrid, Plus, Search, X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { useDialog } from '../Common/useDialog';
import { matchesSearch, newPad, noteCss, putOnPage, snippet } from '../../services/scratchpads';

// the home card: start a new scratchpad or go back to one you made. search looks in the text as well as the titles.
export const ScratchpadPicker: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userStats, project, saveScratchpad, setViewMode } = useAsterism();
  const ref = useDialog<HTMLDivElement>(true, onClose, true);
  const [query, setQuery] = useState('');
  const pads = [...(userStats.scratchpads ?? [])].filter(p => (p.kind ?? 'note') === 'note').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter(p => matchesSearch(p, query));
  const open = (id: string | null) => {
    const base = id ? (userStats.scratchpads ?? []).find(p => p.id === id) : { ...newPad(), everywhere: true };
    if (base) saveScratchpad(putOnPage(base, project.id));
    onClose();
  };
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Scratchpads" onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: 20, color: 'var(--text-main)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Scratchpads</h3>
          <button aria-label="Close" onClick={onClose} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => open(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--accent-gold)', background: 'var(--accent-gold-bg)', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer' }}><Plus size={14} /> New scratchpad</button>
          <button onClick={() => { onClose(); setViewMode('scratchpads'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', fontSize: '0.84rem', cursor: 'pointer', color: 'var(--text-main)' }}><LayoutGrid size={14} /> Open the page</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title or by what is written in them" aria-label="Search scratchpads" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-main)', userSelect: 'text' }} />
        </label>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {pads.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '8px 0' }}>{query ? 'Nothing matches that.' : 'None yet.'}</p>}
          {pads.map(p => (
            <button key={p.id} onClick={() => open(p.id)} style={{ ...noteCss(p.style), textAlign: 'left', padding: '8px 12px', cursor: 'pointer', borderRadius: 8, clipPath: undefined, display: 'block', width: '100%' }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{p.title || 'Scratchpad'}</div>
              <div style={{ fontSize: '0.76rem', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snippet(p, query) || 'Empty'}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
