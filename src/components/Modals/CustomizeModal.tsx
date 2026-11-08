import React from 'react';
import { ArrowDown, ArrowUp, Lock, RotateCcw, X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { useDialog } from '../Common/useDialog';
import { BAR_EXTRAS, BAR_VIEWS, CAPSULE_ITEMS, inOrder, isShown, moveInOrder, toggleHidden } from '../../services/layout';
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

// a list of bar items: tick to show, arrows to move. essential ones stay ticked.
const BarList: React.FC<{
  items: LayoutItem[];
  hidden: string[] | undefined;
  order?: string[];
  label: string;
  onToggle: (id: string) => void;
  onMove?: (id: string, step: -1 | 1) => void;
}> = ({ items, hidden, order, label, onToggle, onMove }) => {
  const list = onMove ? inOrder(items, order) : items;
  return (
    <div role="list" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {list.map((c, i) => (
        <div key={c.id} role="listitem" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)' }}>
          <label style={{ ...row, flex: 1, cursor: c.essential ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={c.essential ? true : isShown(hidden, c.id)} disabled={c.essential} onChange={() => onToggle(c.id)} />
            {c.label}
            {c.essential && <Lock size={11} aria-label="Always here" style={{ color: 'var(--text-muted)' }} />}
          </label>
          {onMove && (
            <>
              <button aria-label={`Move ${c.label} earlier`} disabled={i === 0} onClick={() => onMove(c.id, -1)} style={{ display: 'flex', padding: 3, color: 'var(--text-secondary)', opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer' }}><ArrowUp size={14} /></button>
              <button aria-label={`Move ${c.label} later`} disabled={i === list.length - 1} onClick={() => onMove(c.id, 1)} style={{ display: 'flex', padding: 3, color: 'var(--text-secondary)', opacity: i === list.length - 1 ? 0.3 : 1, cursor: i === list.length - 1 ? 'default' : 'pointer' }}><ArrowDown size={14} /></button>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

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
          <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Editing, suggesting, zen mode, home and the menu always stay. Everything else can go, and come back here. Move the view buttons into the order you like.</p>
          <div style={{ ...section, margin: '0 0 6px' }}>View buttons</div>
          <BarList label="View buttons" items={BAR_VIEWS} hidden={home?.hiddenBar} order={home?.barOrder}
            onToggle={id => setHomeSettings({ hiddenBar: toggleHidden(home?.hiddenBar, id) })}
            onMove={(id, step) => setHomeSettings({ barOrder: moveInOrder(BAR_VIEWS, home?.barOrder, id, step) })} />
          <div style={{ ...section, margin: '12px 0 6px' }}>Also up there</div>
          <BarList label="Other top bar buttons" items={BAR_EXTRAS} hidden={home?.hiddenBar}
            onToggle={id => setHomeSettings({ hiddenBar: toggleHidden(home?.hiddenBar, id) })} />
        </div>

        <div>
          <h4 style={section}>Bar along the bottom</h4>
          <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>The session bar under your writing. Show what you use, in the order you like. The arrow on its left tucks the whole bar away.</p>
          <BarList label="Bottom bar" items={CAPSULE_ITEMS} hidden={home?.hiddenCapsule} order={home?.capsuleOrder}
            onToggle={id => setHomeSettings({ hiddenCapsule: toggleHidden(home?.hiddenCapsule, id) })}
            onMove={(id, step) => setHomeSettings({ capsuleOrder: moveInOrder(CAPSULE_ITEMS, home?.capsuleOrder, id, step) })} />
        </div>

        <button onClick={() => setHomeSettings({ hiddenBar: [], barOrder: [], hiddenCapsule: [], capsuleOrder: [] })}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', padding: '5px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <RotateCcw size={13} /> Put both bars back the way they were
        </button>
      </div>
    </div>
  );
};
