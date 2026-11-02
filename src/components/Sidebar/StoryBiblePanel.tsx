import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { CharacterProfile, LocationProfile, LoreEntry, SecretEntry } from '../../types';
import { Users, MapPin, BookOpen, Plus, Trash2, Edit3, EyeOff } from 'lucide-react';
import { RelationshipEditor } from './RelationshipEditor';
import { LoreForm, PlaceForm } from './BibleForms';
import { useRevealOnOpen } from './useRevealOnOpen';
import { LORE_KINDS } from '../../data/loreKinds';
import { relationBetween, tagLabel } from '../../services/relationships';

type SecretState = 'unmarked' | 'knows' | 'hidden';

// who knows a secret when the story opens: one row per character.
const KnowsPicker: React.FC<{
  people: CharacterProfile[];
  knownBy?: string[];
  hiddenFrom?: string[];
  onChange: (knownBy: string[], hiddenFrom: string[]) => void;
}> = ({ people, knownBy, hiddenFrom, onChange }) => {
  const stateOf = (id: string): SecretState => (knownBy?.includes(id) ? 'knows' : hiddenFrom?.includes(id) ? 'hidden' : 'unmarked');
  const set = (id: string, state: SecretState) => {
    const without = (list?: string[]) => (list ?? []).filter(x => x !== id);
    onChange(
      state === 'knows' ? [...without(knownBy), id] : without(knownBy),
      state === 'hidden' ? [...without(hiddenFrom), id] : without(hiddenFrom),
    );
  };
  if (people.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }} title="Used by the Analyzer's knowledge checks. Leave as 'May know' if it is not settled.">
        Who knows this secret when the story opens?
      </div>
      {people.map(o => (
        <label key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span>{o.name}</span>
          <select value={stateOf(o.id)} onChange={e => set(o.id, e.target.value as SecretState)} style={{ padding: '3px' }}>
            <option value="unmarked">May know</option>
            <option value="knows">Knows</option>
            <option value="hidden">Must not know</option>
          </select>
        </label>
      ))}
    </div>
  );
};

export const StoryBiblePanel: React.FC = () => {
  const { 
    project, 
    saveCharacter, 
    saveSecret,
    deleteSecret,
    deleteCharacter,
    saveLocation,
    deleteLocation,
    saveLore,
    deleteLore
  } = useAsterism();

  const [subTab, setSubTab] = useState<'characters' | 'locations' | 'lore' | 'secrets'>('characters');
  const [editingCharacter, setEditingCharacter] = useState<CharacterProfile | null>(null);
  const [isAddingChar, setIsAddingChar] = useState(false);
  const [secretForm, setSecretForm] = useState<SecretEntry | null>(null);
  const [placeForm, setPlaceForm] = useState<{ place: LocationProfile; isNew: boolean } | null>(null);
  const [loreForm, setLoreForm] = useState<{ lore: LoreEntry; isNew: boolean } | null>(null);

  // new character form state
  const [charForm, setCharForm] = useState<Partial<CharacterProfile>>({
    role: 'supporting',
    avatarColor: '#c9933b'
  });

  // nicknames and other names for the character, typed as a comma-separated list.
  const [aliasText, setAliasText] = useState('');

  const parseAliases = (text: string, name: string): string[] => {
    const seen = new Set([name.trim().toLowerCase()]);
    return text.split(/[,;\n]+/).map(a => a.trim()).filter(a => {
      if (!a || seen.has(a.toLowerCase())) return false;
      seen.add(a.toLowerCase());
      return true;
    });
  };

  const nameList = (ids?: string[]) =>
    (ids ?? []).map(id => project.storyBible.characters.find(c => c.id === id)?.name).filter(Boolean).join(', ');
  const handleOpenAddChar = () => {
    setAliasText('');
    setCharForm({
      id: `char-${Date.now()}`,
      name: '',
      role: 'supporting',
      coreDesire: '',
      fatalFlaw: '',
      internalConflict: '',
      physicalDescription: '',
      theSecret: '',
      avatarColor: '#c9933b',
      relationships: []
    });
    setIsAddingChar(true);
    setEditingCharacter(null);
  };

  // the dossier form opens at the top of the list; bring it into view when it opens, wherever the card was
  const charFormRef = useRevealOnOpen<HTMLFormElement>(isAddingChar || !!editingCharacter, editingCharacter?.id ?? 'new');
  const secretFormRef = useRevealOnOpen<HTMLFormElement>(!!secretForm, secretForm?.id ?? '');

  const handleSaveChar = (e: React.FormEvent) => {
    e.preventDefault();
    if (charForm.name?.trim()) {
      saveCharacter({ ...charForm, aliases: parseAliases(aliasText, charForm.name) } as CharacterProfile);
      setIsAddingChar(false);
      setEditingCharacter(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* subtab selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setSubTab('characters')}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: subTab === 'characters' ? 'var(--accent-gold-bg)' : 'transparent',
            color: subTab === 'characters' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <Users size={14} />
          <span>Characters ({project.storyBible.characters.length})</span>
        </button>

        <button
          onClick={() => setSubTab('locations')}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: subTab === 'locations' ? 'var(--accent-gold-bg)' : 'transparent',
            color: subTab === 'locations' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <MapPin size={14} />
          <span>Places ({project.storyBible.locations.length})</span>
        </button>

        <button
          onClick={() => setSubTab('lore')}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: subTab === 'lore' ? 'var(--accent-gold-bg)' : 'transparent',
            color: subTab === 'lore' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <BookOpen size={14} />
          <span>Lore ({project.storyBible.lore.length})</span>
        </button>
        <button
          onClick={() => setSubTab('secrets')}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: subTab === 'secrets' ? 'var(--accent-gold-bg)' : 'transparent',
            color: subTab === 'secrets' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <EyeOff size={14} />
          <span>Secrets ({(project.storyBible.secrets ?? []).length})</span>
        </button>
      </div>

      {/* characters view */}
      {subTab === 'characters' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!isAddingChar && !editingCharacter && (
            <button
              onClick={handleOpenAddChar}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-strong)',
                color: 'var(--accent-gold-text, var(--accent-gold))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '12px'
              }}
            >
              <Plus size={15} />
              <span>Add Character Dossier</span>
            </button>
          )}

          {/* form */}
          {(isAddingChar || editingCharacter) && (
            <form ref={charFormRef} onSubmit={handleSaveChar} style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '14px', scrollMarginTop: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '10px' }}>
                {editingCharacter ? 'Edit Character Dossier' : 'New Character Dossier'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                <input
                  type="text"
                  placeholder="Character Name..."
                  value={charForm.name || ''}
                  onChange={e => setCharForm({ ...charForm, name: e.target.value })}
                  style={{ padding: '6px 10px' }}
                  required
                />

                <input
                  type="text"
                  placeholder="Also called... (nicknames, separated by commas)"
                  title="Other names this character goes by, so they’re never mistaken for someone else."
                  value={aliasText}
                  onChange={e => setAliasText(e.target.value)}
                  style={{ padding: '6px 10px' }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={charForm.role || 'supporting'}
                    onChange={e => setCharForm({ ...charForm, role: e.target.value as CharacterProfile['role'] })}
                    style={{ flex: 1, padding: '6px' }}
                  >
                    <option value="protagonist">Protagonist</option>
                    <option value="antagonist">Antagonist</option>
                    <option value="mentor">Mentor</option>
                    <option value="deuteragonist">Deuteragonist</option>
                    <option value="supporting">Supporting</option>
                  </select>

                  <input
                    type="color"
                    value={charForm.avatarColor || '#c9933b'}
                    onChange={e => setCharForm({ ...charForm, avatarColor: e.target.value })}
                    title="Avatar Color"
                    style={{ width: '38px', height: '34px', padding: '2px', cursor: 'pointer' }}
                  />
                </div>

                <input
                  type="text"
                  placeholder="Core Desire (What drives them?)"
                  value={charForm.coreDesire || ''}
                  onChange={e => setCharForm({ ...charForm, coreDesire: e.target.value })}
                  style={{ padding: '6px 10px' }}
                />

                <input
                  type="text"
                  placeholder="Fatal Flaw / Vulnerability"
                  value={charForm.fatalFlaw || ''}
                  onChange={e => setCharForm({ ...charForm, fatalFlaw: e.target.value })}
                  style={{ padding: '6px 10px' }}
                />

                <input
                  type="text"
                  placeholder="The Secret (Unspoken truth / hidden motive)"
                  value={charForm.theSecret || ''}
                  onChange={e => setCharForm({ ...charForm, theSecret: e.target.value })}
                  style={{ padding: '6px 10px' }}
                />

                <RelationshipEditor
                  me={charForm}
                  people={project.storyBible.characters.filter(c => c.id !== charForm.id)}
                  onChange={patch => setCharForm(prev => ({ ...prev, ...patch }))}
                />

                <textarea
                  placeholder="Physical description & quirks..."
                  value={charForm.physicalDescription || ''}
                  onChange={e => setCharForm({ ...charForm, physicalDescription: e.target.value })}
                  rows={2}
                  style={{ padding: '6px 10px', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button type="submit" style={{ flex: 1, padding: '6px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                    Save Dossier
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setIsAddingChar(false); setEditingCharacter(null); }}
                    style={{ padding: '6px 12px', color: 'var(--text-muted)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* character cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {project.storyBible.characters.map(char => (
              <div
                key={char.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: char.avatarColor || 'var(--accent-gold)' }} />
                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{char.name}</span>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', backgroundColor: 'var(--badge-bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
                      {char.role}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => {
                        setCharForm(char);
                        setAliasText((char.aliases || []).join(', '));
                        setEditingCharacter(char);
                        setIsAddingChar(false);
                      }}
                      style={{ padding: '3px', color: 'var(--text-muted)' }}
                      title="Edit"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => deleteCharacter(char.id)}
                      style={{ padding: '3px', color: 'var(--text-muted)' }}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {char.aliases && char.aliases.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Also called:</strong> {char.aliases.join(', ')}
                  </div>
                )}

                {char.coreDesire && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Desire:</strong> {char.coreDesire}
                  </div>
                )}

                {char.fatalFlaw && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Flaw:</strong> {char.fatalFlaw}
                  </div>
                )}

                {char.theSecret && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <EyeOff size={12} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', flexShrink: 0 }} />
                    <span><strong style={{ color: 'var(--text-main)' }}>Secret:</strong> {char.theSecret}</span>
                  </div>
                )}
                {project.storyBible.characters.filter(o => o.id !== char.id).map(o => ({ o, rel: relationBetween(char, o) })).filter(x => x.rel.types.length > 0).map(({ o, rel }) => (
                  <div key={o.id} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{o.name}:</strong> {rel.types.map(tagLabel).join(', ')}
                  </div>
                ))}
                {char.theSecret && (char.secretKnownBy?.length || char.secretHiddenFrom?.length) ? (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', paddingLeft: '16px' }}>
                    {nameList(char.secretKnownBy) && <div>Known by {nameList(char.secretKnownBy)}</div>}
                    {nameList(char.secretHiddenFrom) && <div>Kept from {nameList(char.secretHiddenFrom)}</div>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* places view */}
      {subTab === 'locations' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!placeForm && (
            <button
              onClick={() => setPlaceForm({ place: { id: `place-${Date.now()}`, name: '', type: '', atmosphere: '', sensoryDetails: '', significance: '' }, isNew: true })}
              style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}
            >
              <Plus size={15} />
              <span>Add Place</span>
            </button>
          )}
          {placeForm && (
            <PlaceForm
              key={placeForm.place.id}
              initial={placeForm.place}
              isNew={placeForm.isNew}
              onSave={place => { saveLocation(place); setPlaceForm(null); }}
              onCancel={() => setPlaceForm(null)}
            />
          )}
          {project.storyBible.locations.length === 0 && !placeForm && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              No places yet. The Analyzer follows characters between the places you add here.
            </div>
          )}
          {project.storyBible.locations.map(loc => (
            <div key={loc.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{loc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {loc.type && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{loc.type}</span>}
                  <button onClick={() => setPlaceForm({ place: loc, isNew: false })} style={{ padding: '3px', color: 'var(--text-muted)' }} title="Edit"><Edit3 size={13} /></button>
                  <button onClick={() => deleteLocation(loc.id)} style={{ padding: '3px', color: 'var(--text-muted)' }} title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
              {loc.aliases && loc.aliases.length > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Also called:</strong> {loc.aliases.join(', ')}
                </div>
              )}
              {loc.atmosphere && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{loc.atmosphere}</div>}
              {loc.sensoryDetails && <div style={{ fontSize: '0.76rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}>{loc.sensoryDetails}</div>}
              {loc.significance && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>{loc.significance}</div>}
            </div>
          ))}
        </div>
      )}

      {/* lore view */}
      {subTab === 'lore' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!loreForm && (
            <button
              onClick={() => setLoreForm({ lore: { id: `lore-${Date.now()}`, title: '', category: 'custom', content: '' }, isNew: true })}
              style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}
            >
              <Plus size={15} />
              <span>Add Lore</span>
            </button>
          )}
          {loreForm && (
            <LoreForm
              key={loreForm.lore.id}
              initial={loreForm.lore}
              isNew={loreForm.isNew}
              onSave={lore => { saveLore(lore); setLoreForm(null); }}
              onCancel={() => setLoreForm(null)}
            />
          )}
          {project.storyBible.lore.length === 0 && !loreForm && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              No lore yet. Rules, history and groups you add here help the Analyzer know which names are not people.
            </div>
          )}
          {project.storyBible.lore.map(lore => (
            <div key={lore.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lore.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{LORE_KINDS.find(k => k.id === lore.category)?.label}</span>
                  <button onClick={() => setLoreForm({ lore, isNew: false })} style={{ padding: '3px', color: 'var(--text-muted)' }} title="Edit"><Edit3 size={13} /></button>
                  <button onClick={() => deleteLore(lore.id)} style={{ padding: '3px', color: 'var(--text-muted)' }} title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{lore.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* secrets view */}
      {subTab === 'secrets' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Facts about the story, not one character, like a hidden treaty or a forged will. Write each as the manuscript would, then mark who knows it.
          </div>
          {!secretForm && (
            <button
              onClick={() => setSecretForm({ id: `secret-${Date.now()}`, text: '', knownBy: [], hiddenFrom: [] })}
              style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}
            >
              <Plus size={15} />
              <span>Add Secret</span>
            </button>
          )}
          {secretForm && (
            <form
              ref={secretFormRef}
              onSubmit={e => { e.preventDefault(); if (secretForm.text.trim()) { saveSecret({ ...secretForm, text: secretForm.text.trim() }); setSecretForm(null); } }}
              style={{ padding: '14px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', scrollMarginTop: '8px' }}
            >
              <textarea
                placeholder="The secret, in a sentence or two (e.g. The treaty was forged and the seal stolen from the archive.)"
                value={secretForm.text}
                onChange={e => setSecretForm({ ...secretForm, text: e.target.value })}
                rows={3}
                required
                style={{ padding: '6px 10px', resize: 'vertical' }}
              />
              <KnowsPicker
                people={project.storyBible.characters}
                knownBy={secretForm.knownBy}
                hiddenFrom={secretForm.hiddenFrom}
                onChange={(knownBy, hiddenFrom) => setSecretForm({ ...secretForm, knownBy, hiddenFrom })}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="submit" style={{ flex: 1, padding: '6px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>Save Secret</button>
                <button type="button" onClick={() => setSecretForm(null)} style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>Cancel</button>
              </div>
            </form>
          )}
          {(project.storyBible.secrets ?? []).map(sec => {
            const names = (ids: string[]) => ids.map(id => project.storyBible.characters.find(c => c.id === id)?.name).filter(Boolean).join(', ');
            return (
              <div key={sec.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ fontSize: '0.84rem', lineHeight: 1.4 }}>{sec.text}</div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => setSecretForm(sec)} style={{ padding: '3px', color: 'var(--text-muted)' }} title="Edit"><Edit3 size={13} /></button>
                    <button onClick={() => deleteSecret(sec.id)} style={{ padding: '3px', color: 'var(--text-muted)' }} title="Delete"><Trash2 size={13} /></button>
                  </div>
                </div>
                {names(sec.knownBy) && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Known by {names(sec.knownBy)}</div>}
                {names(sec.hiddenFrom) && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Kept from {names(sec.hiddenFrom)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
