import React from 'react';
import { Plus, Trash2, StickyNote, X, LayoutGrid } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { newPad, putOnPage } from '../../services/scratchpads';
import type { Scratchpad } from '../../types';

const field: React.CSSProperties = { width: '100%', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.85rem', padding: '6px 8px', userSelect: 'text' };

const PadCard: React.FC<{ pad: Scratchpad }> = ({ pad }) => {
  const { project, saveScratchpad, deleteScratchpad } = useAsterism();
  const toggleFloat = () => saveScratchpad(pad.floating ? { ...pad, floating: false } : putOnPage(pad, project.id));
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input aria-label="Scratchpad title" value={pad.title} onChange={e => saveScratchpad({ ...pad, title: e.target.value })} style={{ ...field, fontWeight: 600 }} />
        <button title={pad.floating ? 'Dismiss from the page' : 'Put on the page as a sticky note'} aria-label={pad.floating ? 'Dismiss from the page' : 'Put on the page as a sticky note'} onClick={toggleFloat} style={{ color: pad.floating ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', display: 'flex', padding: 4, cursor: 'pointer' }}>
          {pad.floating ? <X size={16} /> : <StickyNote size={16} />}
        </button>
        <button title="Delete" aria-label="Delete scratchpad" onClick={() => { if (!pad.text.trim() || window.confirm(`Delete "${pad.title}"?`)) deleteScratchpad(pad.id); }} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 4, cursor: 'pointer' }}><Trash2 size={16} /></button>
      </div>
      <textarea aria-label={`${pad.title} text`} value={pad.text} placeholder="Brain dump here..." onChange={e => saveScratchpad({ ...pad, text: e.target.value })} rows={6} style={{ ...field, resize: 'vertical', fontFamily: 'var(--font-sans)', lineHeight: 1.45 }} />
    </div>
  );
};

// the scratchpads that show on the open document. all of them, with search and settings, are on the scratchpads page.
export const ScratchpadPanel: React.FC = () => {
  const { project, userStats, saveScratchpad, setViewMode } = useAsterism();
  const here = (userStats.scratchpads ?? []).filter(p => p.everywhere || (p.docIds ?? []).includes(project.id));
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, userSelect: 'text' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => saveScratchpad({ ...newPad(), docIds: [project.id] })} aria-label="New scratchpad" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', cursor: 'pointer' }}><Plus size={13} /> New</button>
        <button onClick={() => setViewMode('scratchpads')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}><LayoutGrid size={13} /> All scratchpads</button>
      </div>
      {here.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None on this document yet.</div>}
      {here.map(p => <PadCard key={p.id} pad={p} />)}
    </div>
  );
};
