import React from 'react';
import { chip } from './LoaderWorkshop';
import { useAsterism } from '../../context/AsterismContext';
import { MAKE_COST } from '../../services/shop';

export const text: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', fontSize: '0.84rem' };

// the box every workshop sits in. a new item costs MAKE_COST points; editing one is free.
export const MakerFrame: React.FC<{ title: string; blurb: string; saveLabel: string; editing: boolean; onSave: () => void; onCancel: () => void; children: React.ReactNode }> = ({ title, blurb, saveLabel, editing, onSave, onCancel, children }) => {
  const { canMake } = useAsterism();
  return (
  <section aria-label={title} style={{ padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div>
      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{title}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{blurb} {editing ? 'Editing is free.' : `A new one costs ${MAKE_COST} QP.`} Yours on every device.</div>
    </div>
    {children}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={{ ...chip(false), padding: '6px 14px' }}>{editing ? 'Cancel' : 'Close'}</button>
      <button onClick={() => { if (editing || canMake()) onSave(); }} style={{ padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', color: '#ffffff' }}>{editing ? saveLabel : `${saveLabel} (${MAKE_COST} QP)`}</button>
    </div>
  </section>
  );
};

export const Row: React.FC<{ name: string; children: React.ReactNode }> = ({ name, children }) => (
  <div>
    <div style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>{name}</div>
    {children}
  </div>
);

export const Chips = <T extends string | number>({ options, value, onPick }: { options: Array<[T, string]>; value: T; onPick: (v: T) => void }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {options.map(([v, name]) => <button key={String(v)} onClick={() => onPick(v)} aria-pressed={value === v} style={chip(value === v)}>{name}</button>)}
  </div>
);

export const Color: React.FC<{ value: string; onPick: (v: string) => void }> = ({ value, onPick }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <button onClick={() => onPick('accent')} aria-pressed={value === 'accent'} style={chip(value === 'accent')}>Theme gold</button>
    <input type="color" aria-label="Custom color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#c9933b'} onChange={e => onPick(e.target.value)} style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
  </div>
);
