import React, { useState } from 'react';
import type { LocationProfile, LoreEntry } from '../../types';
import { LORE_KINDS } from '../../data/loreKinds';
import { useRevealOnOpen } from './useRevealOnOpen';

const shell: React.CSSProperties = { padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '14px', scrollMarginTop: '8px' };
const field: React.CSSProperties = { padding: '6px 10px' };

const Buttons: React.FC<{ saveLabel: string; onCancel: () => void }> = ({ saveLabel, onCancel }) => (
  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
    <button type="submit" style={{ flex: 1, padding: '6px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>{saveLabel}</button>
    <button type="button" onClick={onCancel} style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>Cancel</button>
  </div>
);

const parseAliases = (text: string, name: string): string[] => {
  const seen = new Set([name.trim().toLowerCase()]);
  return text.split(/[,;\n]+/).map(a => a.trim()).filter(a => {
    if (!a || seen.has(a.toLowerCase())) return false;
    seen.add(a.toLowerCase());
    return true;
  });
};

export const PlaceForm: React.FC<{ initial: LocationProfile; isNew: boolean; onSave: (place: LocationProfile) => void; onCancel: () => void }> = ({ initial, isNew, onSave, onCancel }) => {
  const ref = useRevealOnOpen<HTMLFormElement>(true);
  const [place, setPlace] = useState(initial);
  const [aliases, setAliases] = useState((initial.aliases ?? []).join(', '));
  const set = (patch: Partial<LocationProfile>) => setPlace({ ...place, ...patch });
  return (
    <form
      ref={ref} style={shell}
      onSubmit={e => { e.preventDefault(); if (place.name.trim()) onSave({ ...place, name: place.name.trim(), aliases: parseAliases(aliases, place.name) }); }}
    >
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '10px' }}>{isNew ? 'New Place' : 'Edit Place'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
        <input type="text" placeholder="Place name…" value={place.name} onChange={e => set({ name: e.target.value })} style={field} required />
        <input
          type="text" placeholder="Also called… (separated by commas)" value={aliases} onChange={e => setAliases(e.target.value)} style={field}
          title="Other names the story uses for it, like “the Keep” for Greywatch Keep. The Analyzer looks for these too."
        />
        <input type="text" placeholder="Kind of place (city, ship, kitchen…)" list="place-kinds" value={place.type} onChange={e => set({ type: e.target.value })} style={field} />
        <datalist id="place-kinds">
          {['City', 'Town', 'Village', 'Building', 'Room', 'Landmark', 'Region', 'Ship', 'School', 'Wilderness'].map(k => <option key={k} value={k} />)}
        </datalist>
        <textarea placeholder="Atmosphere: how it feels" value={place.atmosphere} onChange={e => set({ atmosphere: e.target.value })} rows={2} style={{ ...field, resize: 'vertical' }} />
        <textarea placeholder="Sights, sounds, smells" value={place.sensoryDetails} onChange={e => set({ sensoryDetails: e.target.value })} rows={2} style={{ ...field, resize: 'vertical' }} />
        <textarea placeholder="Why it matters to the story" value={place.significance} onChange={e => set({ significance: e.target.value })} rows={2} style={{ ...field, resize: 'vertical' }} />
        <Buttons saveLabel="Save Place" onCancel={onCancel} />
      </div>
    </form>
  );
};

export const LoreForm: React.FC<{ initial: LoreEntry; isNew: boolean; onSave: (lore: LoreEntry) => void; onCancel: () => void }> = ({ initial, isNew, onSave, onCancel }) => {
  const ref = useRevealOnOpen<HTMLFormElement>(true);
  const [lore, setLore] = useState(initial);
  return (
    <form ref={ref} style={shell} onSubmit={e => { e.preventDefault(); if (lore.title.trim()) onSave({ ...lore, title: lore.title.trim() }); }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '10px' }}>{isNew ? 'New Lore Entry' : 'Edit Lore Entry'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
        <input type="text" placeholder="Title (the name the story uses)…" value={lore.title} onChange={e => setLore({ ...lore, title: e.target.value })} style={field} required />
        <select value={lore.category} onChange={e => setLore({ ...lore, category: e.target.value as LoreEntry['category'] })} style={{ padding: '6px' }}>
          {LORE_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <textarea placeholder="What it is, and how it works…" value={lore.content} onChange={e => setLore({ ...lore, content: e.target.value })} rows={4} style={{ ...field, resize: 'vertical' }} />
        <Buttons saveLabel="Save Lore" onCancel={onCancel} />
      </div>
    </form>
  );
};
