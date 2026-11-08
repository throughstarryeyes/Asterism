import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Download, Eye, EyeOff, Plus, Search, StickyNote, Trash2, Upload } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { NotePlacement, NoteStyleEditor } from '../Common/NoteControls';
import { matchesSearch, newPad, noteCss, noteFile, parseNoteFile, putOnPage, snippet, whereLabel } from '../../services/scratchpads';
import { storageService } from '../../services/storage';
import type { Scratchpad } from '../../types';

const accent = 'var(--accent-gold-text, var(--accent-gold))';
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, padding: '5px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', cursor: 'pointer', background: 'var(--bg-card)' };

// the card is a small copy of the note itself, so you can find one by how it looks
const PadCard: React.FC<{ pad: Scratchpad; query: string; titles: Record<string, string> }> = ({ pad, query, titles }) => {
  const { project, saveScratchpad, deleteScratchpad, showToast } = useAsterism();
  const [open, setOpen] = useState(false);
  const look = noteCss(pad.style);
  const toggleFloat = () => saveScratchpad(pad.floating ? { ...pad, floating: false } : putOnPage(pad, project.id));
  const save = () => { const f = noteFile(pad); storageService.downloadTextFile(f.fileName, f.text, 'application/json'); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', overflow: 'hidden' }}>
      <div style={{ padding: 12, background: 'var(--bg-paper)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ ...look, height: 110, padding: 10, overflow: 'hidden', fontSize: '0.8rem', lineHeight: 1.4, boxSizing: 'border-box' }}>
          <input aria-label="Scratchpad title" value={pad.title} maxLength={60} placeholder="Scratchpad" onChange={e => saveScratchpad({ ...pad, title: e.target.value })}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'inherit', font: 'inherit', fontWeight: 700, padding: 0, marginBottom: 4 }} />
          <div style={{ opacity: 0.85 }}>{snippet(pad, query, 110) || 'Empty'}</div>
        </div>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{whereLabel(pad, titles)}{pad.floating ? ' · on the page' : ''}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={toggleFloat} title={pad.floating ? 'Dismiss from the page' : 'Put on the page'} aria-label={pad.floating ? 'Dismiss from the page' : 'Put on the page'} style={{ ...pill, padding: '4px 8px', color: pad.floating ? accent : undefined }}>{pad.floating ? <EyeOff size={13} /> : <Eye size={13} />}{pad.floating ? 'Dismiss' : 'Open'}</button>
          <button onClick={() => setOpen(v => !v)} aria-expanded={open} style={{ ...pill, padding: '4px 8px' }}>Edit <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : undefined }} /></button>
          <span style={{ flex: 1 }} />
          <button onClick={save} title="Save this scratchpad as a file" aria-label="Save as a file" style={{ display: 'flex', padding: 5, color: 'var(--text-secondary)', cursor: 'pointer' }}><Download size={15} /></button>
          <button onClick={() => { if (!pad.text.trim() || window.confirm(`Delete "${pad.title}"?`)) { deleteScratchpad(pad.id); showToast('Scratchpad deleted.', 'info'); } }} title="Delete" aria-label="Delete scratchpad" style={{ display: 'flex', padding: 5, color: 'var(--text-secondary)', cursor: 'pointer' }}><Trash2 size={15} /></button>
        </div>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <textarea aria-label={`${pad.title} text`} value={pad.text} rows={6} placeholder="Brain dump here..." onChange={e => saveScratchpad({ ...pad, text: e.target.value })}
              style={{ width: '100%', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-main)', padding: '6px 8px', fontFamily: 'var(--font-sans)', fontSize: '0.84rem', lineHeight: 1.45, resize: 'vertical', userSelect: 'text' }} />
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open on</div>
            <NotePlacement pad={pad} onChange={saveScratchpad} />
            <NoteStyleEditor style={pad.style} onChange={style => saveScratchpad({ ...pad, style })} />
          </div>
        )}
      </div>
    </div>
  );
};

export const ScratchpadsPage: React.FC = () => {
  const { userStats, project, allProjects, saveScratchpad, setViewMode, showToast } = useAsterism();
  const [query, setQuery] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const titles = useMemo(() => Object.fromEntries([project, ...allProjects].map(p => [p.id, p.title || 'Untitled'])), [project, allProjects]);
  const pads = [...(userStats.scratchpads ?? [])].filter(p => (p.kind ?? 'note') === 'note').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter(p => matchesSearch(p, query));

  return (
    <div style={{ height: 'var(--app-vh)', overflowY: 'auto', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 5, flexWrap: 'wrap' }}>
        <button onClick={() => setViewMode('home')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.05rem' }}><StickyNote size={18} style={{ color: accent }} /> Scratchpads</div>
        <span style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles and text" aria-label="Search scratchpads" style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--text-main)', width: 180, userSelect: 'text' }} />
        </label>
        <button onClick={() => file.current?.click()} style={pill}><Upload size={13} /> Open a file</button>
        <button onClick={() => saveScratchpad({ ...newPad(), docIds: [project.id] })} style={{ ...pill, borderColor: 'var(--accent-gold)', color: accent }}><Plus size={13} /> New</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          const got = parseNoteFile(await f.text());
          if ('error' in got) { showToast(got.error, 'info'); return; }
          saveScratchpad({ ...got, docIds: [project.id] });
          showToast(`Added "${got.title}".`, 'success');
        }} />
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 120px' }}>
        {pads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 60 }}>{query ? 'Nothing matches that.' : 'No scratchpads yet. Make one with New.'}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, alignItems: 'start' }}>
            {pads.map(p => <PadCard key={p.id} pad={p} query={query} titles={titles} />)}
          </div>
        )}
      </main>
    </div>
  );
};
