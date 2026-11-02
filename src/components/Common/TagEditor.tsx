import React, { useState } from 'react';
import { MAX_TAGS, addTag, normalizeTag, removeTag } from '../../services/tags';
import { X } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  // tags to offer as one-click additions
  suggestions?: string[];
  placeholder?: string;
}

// a document's tags: type your own and press enter or comma, or pick a suggestion
export const TagEditor: React.FC<Props> = ({ tags, onChange, suggestions = [], placeholder = 'Add a tag, like “cozy mystery” or “first draft”' }) => {
  const [text, setText] = useState('');
  const full = tags.length >= MAX_TAGS;

  const commit = (raw: string) => {
    // a pasted or typed list becomes several tags
    let next = tags;
    raw.split(',').forEach(part => { next = addTag(next, part); });
    if (next !== tags) onChange(next);
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 4px 2px 9px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', backgroundColor: 'var(--accent-gold-bg)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))' }}>
            {t}
            <button type="button" onClick={() => onChange(removeTag(tags, t))} aria-label={`Remove ${t}`} style={{ display: 'flex', padding: '1px', color: 'inherit', cursor: 'pointer' }}><X size={12} /></button>
          </span>
        ))}
        <input
          type="text"
          value={text}
          disabled={full}
          maxLength={80}
          placeholder={full ? `Up to ${MAX_TAGS} tags` : tags.length ? 'Add another…' : placeholder}
          onChange={e => (e.target.value.includes(',') ? commit(e.target.value) : setText(e.target.value))}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(text); }
            else if (e.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={() => { if (normalizeTag(text)) commit(text); }}
          style={{ flex: 1, minWidth: '140px', padding: '4px 4px', fontSize: '0.84rem', border: 'none', outline: 'none', backgroundColor: 'transparent', color: 'var(--text-main)' }}
        />
      </div>
      {!full && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Suggestions:</span>
          {suggestions.map(s => (
            <button key={s} type="button" onClick={() => onChange(addTag(tags, s))} style={{ padding: '2px 9px', borderRadius: 'var(--radius-full)', fontSize: '0.73rem', backgroundColor: 'var(--tag-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
