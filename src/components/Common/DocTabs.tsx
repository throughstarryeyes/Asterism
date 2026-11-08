import React from 'react';
import { X, Home } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';

// the documents that are open at once; click one to switch, the x to close it
export const DocTabs: React.FC = () => {
  const { openTabs, allProjects, project, toolDoc, viewMode, switchTab, closeTab, setViewMode } = useAsterism();
  if (openTabs.length === 0) return null;
  const current = viewMode === 'home' ? null : (['tool', 'mindmap', 'branching', 'sheet', 'cards'].includes(viewMode) ? toolDoc.id : project.id);
  const docs = openTabs.map(id => allProjects.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div role="tablist" aria-label="Open documents" style={{ display: 'flex', alignItems: 'stretch', gap: 2, padding: '4px 8px 0', overflowX: 'auto', flexShrink: 0, background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}>
      <button title="Home" aria-label="Home" onClick={() => setViewMode('home')} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', color: viewMode === 'home' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', cursor: 'pointer' }}><Home size={14} /></button>
      {docs.map(d => {
        const active = d.id === current;
        return (
          <div key={d.id} role="tab" aria-selected={active} style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: 180, padding: '3px 4px 3px 10px', fontSize: '0.76rem', fontWeight: active ? 600 : 500, borderRadius: '6px 6px 0 0', background: active ? 'var(--bg-paper)' : 'transparent', color: active ? 'var(--text-main)' : 'var(--text-secondary)', border: active ? '1px solid var(--border-subtle)' : '1px solid transparent', borderBottom: 'none', flexShrink: 0 }}>
            <button onClick={() => switchTab(d.id)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: 'inherit', fontWeight: 'inherit' }}>{d.title || 'Untitled'}</button>
            <button aria-label={`Close ${d.title || 'Untitled'}`} onClick={() => { closeTab(d.id); if (active) setViewMode('home'); }} style={{ display: 'flex', padding: 3, cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
          </div>
        );
      })}
    </div>
  );
};
