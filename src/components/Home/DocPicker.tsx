import React, { useMemo, useState } from 'react';
import { DialogFrame } from '../Common/DialogFrame';
import type { Project } from '../../types';
import { X } from 'lucide-react';

const PAGE = 25;
const RECENT = 5;
// past this many folders, buttons stop fitting and a menu takes over
const MAX_FOLDER_BUTTONS = 6;

const chip = (on: boolean): React.CSSProperties => ({
  padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: on ? 700 : 500,
  backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)',
  color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
  border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
});

const sub: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: 4 };

// choose which document a tool opens in: search, browse by folder, or take a recent one
export const DocPicker: React.FC<{ title: string; docs: Project[]; onPick: (id: string) => void; onClose: () => void }> = ({ title, docs, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [shown, setShown] = useState(PAGE);

  const folders = useMemo(() => Array.from(new Set(docs.map(p => p.folder).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [docs]);
  const hasUnfiled = docs.some(p => !p.folder);
  const countIn = (f: string) => (f === 'all' ? docs.length : f === 'unfiled' ? docs.filter(p => !p.folder).length : docs.filter(p => p.folder === f).length);
  const options = ['all', ...folders, ...(folders.length && hasUnfiled ? ['unfiled'] : [])];
  const nameOf = (f: string) => (f === 'all' ? 'All documents' : f === 'unfiled' ? 'Unfiled' : f);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...docs]
      .filter(p => folder === 'all' || (folder === 'unfiled' ? !p.folder : p.folder === folder))
      .filter(p => !q || [p.title, p.synopsis ?? '', p.folder ?? '', ...(p.tags ?? [])].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [docs, query, folder]);

  const browsing = !query.trim() && folder === 'all';
  const recent = browsing && matches.length > RECENT * 2 ? matches.slice(0, RECENT) : [];
  const rest = recent.length ? matches.slice(RECENT) : matches;
  const visible = rest.slice(0, shown);

  const row = (p: Project) => (
    <button key={p.id} onClick={() => onPick(p.id)}
      style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', textAlign: 'left', cursor: 'pointer', fontWeight: 600, overflowWrap: 'anywhere' }}>
      {p.title}
      {p.folder && <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>{p.folder}</span>}
    </button>
  );

  return (
    <DialogFrame label={`Open ${title} in…`} onClose={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', maxHeight: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ margin: 0, flex: 1, fontSize: '1.1rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>Open {title} in…</h2>
            <button onClick={onClose} aria-label="Close" title="Close (Esc)" style={{ display: 'flex', padding: 6, borderRadius: 'var(--radius-full)', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setShown(PAGE); }}
            onKeyDown={e => { if (e.key === 'Enter' && matches[0]) onPick(matches[0].id); }}
            placeholder="Search by title, tag or folder"
            aria-label="Search your documents"
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.88rem' }}
          />
          {folders.length > 0 && (folders.length > MAX_FOLDER_BUTTONS ? (
            <select value={folder} onChange={e => { setFolder(e.target.value); setShown(PAGE); }} aria-label="Folder"
              style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.84rem' }}>
              {options.map(f => <option key={f} value={f}>{nameOf(f)} ({countIn(f)})</option>)}
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {options.map(f => <button key={f} onClick={() => { setFolder(f); setShown(PAGE); }} aria-pressed={folder === f} style={chip(folder === f)}>{nameOf(f)} · {countIn(f)}</button>)}
            </div>
          ))}
        </div>

        <div style={{ padding: '4px 22px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.length === 0 && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px 2px' }}>No documents match.</div>}
          {recent.length > 0 && <div style={sub}>Recent</div>}
          {recent.map(row)}
          {recent.length > 0 && rest.length > 0 && <div style={sub}>All documents · {rest.length}</div>}
          {!browsing && matches.length > 0 && <div style={sub}>{matches.length} {matches.length === 1 ? 'match' : 'matches'}. Enter opens the first.</div>}
          {visible.map(row)}
          {rest.length > shown && (
            <button onClick={() => setShown(n => n + PAGE)} style={{ ...chip(false), padding: '8px 12px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              Show {Math.min(PAGE, rest.length - shown)} more ({rest.length - shown} left)
            </button>
          )}
        </div>
      </div>
    </DialogFrame>
  );
};
