import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { LookEditor } from '../Header/LookEditor';
import { MakerFrame, Row, text } from './MakerFrame';
import { chip } from './LoaderWorkshop';
import { cleanCardCover, coverPaint, findCover, type CustomCover } from '../../services/looks';

// the cover as it sits on a document card
export const CoverMock: React.FC<{ id: string; custom?: CustomCover[] }> = ({ id, custom }) => {
  const c = findCover(id, custom);
  return (
    <div style={{ width: '70%', borderRadius: 8, border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', overflow: 'hidden' }}>
      <div style={{ height: 30, ...coverPaint(c), color: c.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.4em', borderBottom: id === 'plain' ? 'none' : `3px solid ${c.ink}` }}>{c.glyph}</div>
      <div style={{ padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ height: 5, width: '70%', borderRadius: 3, backgroundColor: 'var(--text-muted)', opacity: 0.5 }} />
        <div style={{ height: 4, width: '45%', borderRadius: 3, backgroundColor: 'var(--text-muted)', opacity: 0.3 }} />
      </div>
    </div>
  );
};

const EMBLEMS = ['❦', '☾', '❧', '✦', '☀', '≋', '✧', '⌖', '❂', '❄', '✿', '♡', '⚜', '❖'];

export const CoverWorkshop: React.FC<{ editing: CustomCover | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { saveCustomCover } = useAsterism();
  const [draft, setDraft] = useState<CustomCover>(() => editing ?? { id: `custom-${Date.now()}`, name: '', look: { gradient: { kind: 'linear', angle: 135, stops: [{ color: '#6b4a32', at: 0 }, { color: '#3f2a1c', at: 100 }] } }, ink: '#d9b468', glyph: '❦' });
  const set = (patch: Partial<CustomCover>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanCardCover(draft);

  return (
    <MakerFrame title="Cover workshop" blurb="Dress your document cards with a backdrop and an emblem." saveLabel="Save cover" editing={!!editing}
      onSave={() => { saveCustomCover({ ...clean, name: draft.name.trim() || 'My cover' }); onDone(); }} onCancel={onDone}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}>
        <CoverMock id={clean.id} custom={[clean]} />
      </div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My cover" aria-label="Cover name" style={text} /></Row>
      <LookEditor title="Backdrop" look={draft.look} onChange={look => set({ look: look ?? {} })} />
      <Row name="Emblem (up to 3)">
        <input value={draft.glyph} onChange={e => set({ glyph: Array.from(e.target.value).slice(0, 3).join('') })} aria-label="Cover emblem" style={{ ...text, marginBottom: 8 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {EMBLEMS.map(g => <button key={g} onClick={() => set({ glyph: g })} aria-label={`Use ${g}`} style={{ ...chip(draft.glyph === g), padding: '2px 8px', fontSize: '0.9rem' }}>{g}</button>)}
        </div>
      </Row>
      <Row name="Emblem and edge color">
        <input type="color" value={clean.ink} onChange={e => set({ ink: e.target.value })} aria-label="Emblem color" style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
      </Row>
    </MakerFrame>
  );
};
