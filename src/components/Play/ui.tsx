import React, { useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { CharacterProfile, Project } from '../../types';
import type { GameId } from '../../services/play/types';
import { withChapterAtEnd, withSavedNote } from '../../services/play/save';

// the pieces every game in Play is made of, in the same look as the Prompt Lab

export const btn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: 'transparent',
};
export const btnPrimary: React.CSSProperties = {
  ...btn, background: 'var(--accent-gold-bg)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))',
};
export const field: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-paper)', color: 'var(--text-main)',
  fontSize: '0.88rem', fontFamily: 'inherit',
};
export const area: React.CSSProperties = { ...field, width: '100%', resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-body)', boxSizing: 'border-box' };

export const Panel: React.FC<{ title?: string; note?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, note, children, style }) => (
  <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-paper)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', ...style }}>
    {title && <h2 style={{ margin: 0, fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>{title}</h2>}
    {note && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{note}</p>}
    {children}
  </section>
);

export const Story: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.55, fontFamily: 'var(--font-title)' }}>{children}</p>
);

export const Label: React.FC<{ text: string; children: React.ReactNode; grow?: boolean }> = ({ text, children, grow }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', flex: grow ? 1 : undefined, minWidth: 0 }}>
    <span>{text}</span>
    {children}
  </label>
);

export const Chip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; title?: string }> = ({ on, onClick, children, title }) => (
  <button type="button" onClick={onClick} title={title} aria-pressed={on}
    style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', cursor: 'pointer', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', background: on ? 'var(--accent-gold-bg)' : 'transparent', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)' }}>
    {children}
  </button>
);

export const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{children}</p>
);

export const Row: React.FC<{ children: React.ReactNode; gap?: number; wrap?: boolean; style?: React.CSSProperties }> = ({ children, gap = 8, wrap = true, style }) => (
  <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center', ...style }}>{children}</div>
);

// the documents a result can be kept in: manuscripts, with the open one up to date
export function useDocs() {
  const { allProjects, project } = useAsterism();
  const docs = useMemo(() => {
    const merged = allProjects.map(p => (p.id === project.id ? project : p));
    if (!merged.some(p => p.id === project.id)) merged.unshift(project);
    return merged.filter(p => !p.kind);
  }, [allProjects, project]);
  const [chosen, setChosen] = useState<string>(() => (project.kind ? '' : project.id));
  const doc: Project | undefined = docs.find(d => d.id === chosen) ?? docs[0];
  return { docs, doc, docId: doc?.id ?? '', setDocId: setChosen };
}

export const DocSelect: React.FC<{ docs: Project[]; value: string; onChange: (id: string) => void; label?: string }> = ({ docs, value, onChange, label = 'Document' }) => (
  <Label text={label}>
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...field, maxWidth: 280 }}>
      {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
    </select>
  </Label>
);

export const characterLabel = (c: CharacterProfile) => c.name || 'Unnamed';

// keep a result: as a note on the document, or as a chapter in it
export const KeepBar: React.FC<{ doc: Project | undefined; game: GameId; title: string; text: string; disabled?: boolean; onKept?: () => void }> = ({ doc, game, title, text, disabled, onKept }) => {
  const { updateAnyProject, showToast, notePlay } = useAsterism();
  if (!doc) return <Muted>Make a document first, and results can be kept in it.</Muted>;
  const off = disabled || !text.trim();
  return (
    <Row>
      <button style={btn} disabled={off} onClick={() => { updateAnyProject(doc.id, withSavedNote(doc, game, title, text)); showToast(`Kept as a note in "${doc.title}".`, 'success'); notePlay('Finished a game'); onKept?.(); }}>Keep as a note</button>
      <button style={btn} disabled={off} onClick={() => { updateAnyProject(doc.id, withChapterAtEnd(doc, title, text)); showToast(`Added to "${doc.title}" as a new chapter.`, 'success'); notePlay('Finished a game'); onKept?.(); }}>Add as a scene</button>
      <button style={btn} disabled={off} onClick={() => { void navigator.clipboard?.writeText(text).then(() => showToast('Copied.', 'info'), () => undefined); }}>Copy</button>
    </Row>
  );
};
