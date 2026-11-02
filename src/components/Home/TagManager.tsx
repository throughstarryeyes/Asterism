import React, { useState } from 'react';
import { DialogFrame } from '../Common/DialogFrame';
import type { TagCount } from '../../services/tags';
import { normalizeTag, sameTag } from '../../services/tags';
import { Trash2, X } from 'lucide-react';

interface Props {
  tags: TagCount[];
  onRename: (from: string, to: string) => void;
  onDelete: (tag: string) => void;
  onClose: () => void;
}

const Row: React.FC<{ item: TagCount; others: TagCount[]; onRename: Props['onRename']; onDelete: Props['onDelete'] }> = ({ item, others, onRename, onDelete }) => {
  const [name, setName] = useState(item.tag);
  const [confirm, setConfirm] = useState(false);
  const clean = normalizeTag(name);
  const changed = !!clean && clean !== item.tag;
  // typing the name of another tag merges the two
  const merge = changed ? others.find(o => sameTag(o.tag, clean) && !sameTag(o.tag, item.tag)) : undefined;
  const save = () => { if (changed) onRename(item.tag, clean); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          value={name}
          maxLength={32}
          aria-label={`Rename ${item.tag}`}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setName(item.tag); }}
          style={{ flex: 1, padding: '6px 10px', fontSize: '0.86rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}
        />
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.count} document{item.count === 1 ? '' : 's'}</span>
        {changed ? (
          <button onClick={save} style={{ padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, color: '#fff', backgroundColor: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>{merge ? 'Merge' : 'Rename'}</button>
        ) : confirm ? (
          <>
            <button onClick={() => onDelete(item.tag)} style={{ padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, color: '#fff', backgroundColor: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Remove</button>
            <button onClick={() => setConfirm(false)} style={{ padding: '5px 8px', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Keep</button>
          </>
        ) : (
          <button onClick={() => setConfirm(true)} title="Remove this tag from every document" aria-label={`Delete ${item.tag}`} style={{ padding: '5px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
        )}
      </div>
      {merge && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>“{merge.tag}” already exists, so the two become one tag.</div>}
      {confirm && !changed && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>This takes “{item.tag}” off {item.count} document{item.count === 1 ? '' : 's'}. The documents themselves are kept.</div>}
    </div>
  );
};

// rename, merge or delete a tag across every document
export const TagManager: React.FC<Props> = ({ tags, onRename, onDelete, onClose }) => (
  <DialogFrame label="Manage tags" onClose={onClose} onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
    <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-xl)', padding: '22px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xl)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>Manage tags</h3>
        <button onClick={onClose} aria-label="Close" style={{ padding: '4px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Change a name and press Enter to rename it everywhere. Use another tag’s name to merge them.</p>
      {tags.length === 0 && <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', padding: '12px 0' }}>No tags yet. Add some from a document’s details.</div>}
      {tags.map(item => <Row key={item.tag} item={item} others={tags} onRename={onRename} onDelete={onDelete} />)}
    </div>
  </DialogFrame>
);
