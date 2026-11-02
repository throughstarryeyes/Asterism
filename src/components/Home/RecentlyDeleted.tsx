import React, { useState } from 'react';
import { DialogFrame } from '../Common/DialogFrame';
import { daysLeft, TRASH_DAYS, type TrashedProject } from '../../services/trash';
import { RotateCcw, Trash2, X } from 'lucide-react';

interface Props {
  items: TrashedProject[];
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onClose: () => void;
}

const words = (t: TrashedProject) => t.project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

// deleted documents wait here for 30 days
export const RecentlyDeleted: React.FC<Props> = ({ items, onRestore, onDeleteForever, onClose }) => {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <DialogFrame label="Recently deleted" onClose={onClose} onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-xl)', padding: '22px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>Recently deleted</h3>
          <button onClick={onClose} aria-label="Close" style={{ padding: '4px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Deleted documents stay here for {TRASH_DAYS} days.</p>
        {items.length === 0 && <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '12px 0' }}>Nothing here.</div>}
        {items.map(item => {
          const id = item.project.id;
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.project.title}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{words(item).toLocaleString()} words · {daysLeft(item)} day{daysLeft(item) === 1 ? '' : 's'} left</div>
              </div>
              {confirming === id ? (
                <>
                  <button onClick={() => { onDeleteForever(id); setConfirming(null); }} style={{ padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, color: '#fff', backgroundColor: '#ef4444', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Delete forever</button>
                  <button onClick={() => setConfirming(null)} style={{ padding: '5px 8px', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Keep</button>
                </>
              ) : (
                <>
                  <button onClick={() => onRestore(id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, color: '#fff', backgroundColor: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}><RotateCcw size={12} />Restore</button>
                  <button onClick={() => setConfirming(id)} aria-label={`Delete ${item.project.title} forever`} title="Delete forever" style={{ padding: '5px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </DialogFrame>
  );
};
