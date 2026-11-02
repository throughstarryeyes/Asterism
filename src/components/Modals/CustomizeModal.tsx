import React from 'react';
import { X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { useDialog } from '../Common/useDialog';
import { BAR_ITEMS, isShown, toggleHidden } from '../../services/layout';
import { setNewEditor, useNewEditor } from '../../editor/active';
import type { LayoutItem } from '../../services/layout';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // the tool cards on home, as home knows them
  cards: LayoutItem[];
}

const section: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 12px' };
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.84rem', color: 'var(--text-main)', cursor: 'pointer' };

export const CustomizeModal: React.FC<Props> = ({ isOpen, onClose, cards }) => {
  const { userStats, setHomeSettings } = useAsterism();
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);
  const newEditor = useNewEditor();
  if (!isOpen) return null;
  const home = userStats.home;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Customize" onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: 24, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Customize</h3>
          <button aria-label="Close" onClick={onClose} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div>
          <h4 style={section}>Home</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={row}><input type="checkbox" checked={!!home?.showRecent} onChange={e => setHomeSettings({ showRecent: e.target.checked })} /> Show last document</label>
            <label style={row}><input type="checkbox" checked={home?.showTools ?? true} onChange={e => setHomeSettings({ showTools: e.target.checked })} /> Show tool cards</label>
          </div>
        </div>

        {(home?.showTools ?? true) && (
          <div>
            <h4 style={section}>Tool cards</h4>
            <div style={grid}>
              {cards.map(c => (
                <label key={c.id} style={row}>
                  <input type="checkbox" checked={isShown(home?.hiddenCards, c.id)} onChange={() => setHomeSettings({ hiddenCards: toggleHidden(home?.hiddenCards, c.id) })} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 style={section}>Editor</h4>
          <label style={row}><input type="checkbox" checked={newEditor} onChange={e => setNewEditor(e.target.checked)} /> Use the new editor. Turn this off to go back to the older one.</label>
        </div>

        <div>
          <h4 style={section}>Top bar in a document</h4>
          <div style={grid}>
            {BAR_ITEMS.map(c => (
              <label key={c.id} style={row}>
                <input type="checkbox" checked={isShown(home?.hiddenBar, c.id)} onChange={() => setHomeSettings({ hiddenBar: toggleHidden(home?.hiddenBar, c.id) })} />
                {c.label}
              </label>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>The editor, appearance and menu buttons always stay.</p>
        </div>
      </div>
    </div>
  );
};
