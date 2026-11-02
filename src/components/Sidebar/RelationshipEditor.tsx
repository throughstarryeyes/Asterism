import React, { useState } from 'react';
import type { CharacterProfile } from '../../types';
import { RELATIONSHIP_TAGS, cleanTag, isPresetTag, relationBetween, tagLabel, withRelation } from '../../services/relationships';
import { Plus, X } from 'lucide-react';

type Knows = 'knows' | 'maybe' | 'hidden';

const small: React.CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 };
const chip = (on: boolean): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem',
  border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
  backgroundColor: on ? 'var(--accent-gold-bg)' : 'transparent',
  color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
});

interface RowProps {
  me: CharacterProfile;
  other: CharacterProfile;
  knows: Knows;
  showKnows: boolean;
  onChange: (patch: Partial<CharacterProfile>) => void;
}

const Row: React.FC<RowProps> = ({ me, other, knows, showKnows, onChange }) => {
  const rel = relationBetween(me, other);
  const own = me.relationships.find(e => e.targetCharacterId === other.id || e.targetName.toLowerCase() === other.name.toLowerCase());
  const [custom, setCustom] = useState('');
  const note = own?.notes ?? '';

  const setTypes = (types: string[]) => onChange({ relationships: withRelation(me, other, types, note).relationships });
  const toggle = (id: string) => setTypes(rel.types.includes(id) ? rel.types.filter(t => t !== id) : [...rel.types, id]);
  const addCustom = () => {
    const tag = cleanTag(custom);
    if (tag && !rel.types.includes(tag)) setTypes([...rel.types, tag]);
    setCustom('');
  };
  const setKnows = (state: Knows) => {
    const without = (list?: string[]) => (list ?? []).filter(x => x !== other.id);
    onChange({
      secretKnownBy: state === 'knows' ? [...without(me.secretKnownBy), other.id] : without(me.secretKnownBy),
      secretHiddenFrom: state === 'hidden' ? [...without(me.secretHiddenFrom), other.id] : without(me.secretHiddenFrom),
    });
  };
  const clear = () => {
    const without = (list?: string[]) => (list ?? []).filter(x => x !== other.id);
    onChange({ relationships: withRelation(me, other, [], '').relationships, secretKnownBy: without(me.secretKnownBy), secretHiddenFrom: without(me.secretHiddenFrom) });
  };
  const customTags = rel.types.filter(t => !isPresetTag(t));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <strong style={{ fontSize: '0.82rem' }}>{other.name}</strong>
        <button type="button" onClick={clear} title="Remove" style={{ padding: '2px', color: 'var(--text-muted)', display: 'flex' }}><X size={13} /></button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {RELATIONSHIP_TAGS.map(t => (
          <button key={t.id} type="button" title={t.hint} onClick={() => toggle(t.id)} style={chip(rel.types.includes(t.id))}>{t.label}</button>
        ))}
        {customTags.map(t => (
          <button key={t} type="button" title="Click to remove" onClick={() => toggle(t)} style={chip(true)}>{tagLabel(t)} ×</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text" value={custom} placeholder="Another kind of tie…" maxLength={30}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          style={{ flex: 1, padding: '4px 8px', fontSize: '0.76rem' }}
        />
        <button type="button" onClick={addCustom} disabled={!custom.trim()} style={{ padding: '2px 8px', color: 'var(--accent-gold-text, var(--accent-gold))' }} title="Add"><Plus size={14} /></button>
      </div>
      <input
        type="text" value={note} placeholder="A note (optional)"
        onChange={e => onChange({ relationships: withRelation(me, other, rel.types, e.target.value).relationships })}
        style={{ padding: '4px 8px', fontSize: '0.76rem' }}
      />
      {showKnows && (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', ...small }} title="Used by the Analyzer’s knowledge checks. ‘May know’ means it is not settled.">
          <span>{other.name} and {me.name || 'this character'}’s secret</span>
          <select value={knows} onChange={e => setKnows(e.target.value as Knows)} style={{ padding: '3px' }}>
            <option value="knows">Knows</option>
            <option value="maybe">May know</option>
            <option value="hidden">Must not know</option>
          </select>
        </label>
      )}
    </div>
  );
};

interface Props {
  me: Partial<CharacterProfile>;
  people: CharacterProfile[]; // everyone else in the story bible
  onChange: (patch: Partial<CharacterProfile>) => void;
}

// how this character is connected to the others, and who knows their secret
export const RelationshipEditor: React.FC<Props> = ({ me: partial, people, onChange }) => {
  const me = { ...partial, name: partial.name ?? '', relationships: partial.relationships ?? [] } as CharacterProfile;
  const hasSecret = (me.theSecret ?? '').trim().length > 0;
  const stateOf = (id: string): Knows => (me.secretKnownBy?.includes(id) ? 'knows' : me.secretHiddenFrom?.includes(id) ? 'hidden' : 'maybe');
  // people the writer just added, who have no tag yet
  const [opened, setOpened] = useState<string[]>([]);

  // anyone with a tie to this character (on either card) or a marked knowledge state
  const listed = people.filter(o =>
    relationBetween(me, o).types.length > 0 || relationBetween(me, o).notes.length > 0 ||
    me.secretKnownBy?.includes(o.id) || me.secretHiddenFrom?.includes(o.id) || opened.includes(o.id));
  const rest = people.filter(o => !listed.includes(o));

  if (people.length === 0) return <div style={small}>Add another character to describe how they are connected.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Relationships</div>
      <div style={small}>Tags tell the Analyzer how {me.name || 'this character'} and each person are connected.{hasSecret ? '' : ' Add a secret above to mark who knows it.'}</div>
      {listed.map(o => <Row key={o.id} me={me} other={o} knows={stateOf(o.id)} showKnows={hasSecret} onChange={onChange} />)}
      {rest.length > 0 && (
        <select value="" onChange={e => e.target.value && setOpened([...opened, e.target.value])} style={{ padding: '5px', fontSize: '0.78rem' }}>
          <option value="">+ Add a relationship…</option>
          {rest.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      )}
    </div>
  );
};
