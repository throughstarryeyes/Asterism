import React, { useMemo } from 'react';
import { compareDrafts, totalChange } from '../../services/revisionDiff';

interface Doc { id: string; title: string; content: string }

const STATE_LABEL = { same: 'No changes', changed: 'Changed', added: 'New since then', removed: 'Removed since then' } as const;

// what changed between an older snapshot and the draft as it is now
export const RevisionDiffView: React.FC<{ older: Doc[]; newer: Doc[] }> = ({ older, newer }) => {
  const diffs = useMemo(() => compareDrafts(older, newer), [older, newer]);
  const sum = totalChange(diffs);
  const shown = diffs.filter(d => d.state !== 'same');

  return (
    <div style={{ width: '100%', maxWidth: '720px', fontFamily: 'var(--font-body)', lineHeight: 1.8, color: 'var(--text-main)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '0.8rem', marginBottom: '14px', fontFamily: 'inherit' }}>
        <span style={{ fontWeight: 600 }}>Since this version</span>
        <span style={{ color: '#10b981' }}>+{sum.added.toLocaleString()} words</span>
        <span style={{ color: '#ef4444' }}>−{sum.removed.toLocaleString()} words</span>
        <span style={{ color: 'var(--text-muted)' }}>in {sum.changedChapters} chapter{sum.changedChapters === 1 ? '' : 's'}</span>
      </div>
      {shown.length === 0 && <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nothing has changed since this version.</div>}
      {shown.map((d, i) => (
        <section key={`${d.title}-${i}`} style={{ marginBottom: '26px' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', margin: '0 0 4px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
            {d.title}
            <span style={{ marginLeft: '10px', fontFamily: 'var(--font-body)', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>{STATE_LABEL[d.state]}</span>
          </h3>
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '1rem', userSelect: 'text' }}>
            {d.parts.map((p, j) =>
              p.kind === 'same' ? <span key={j}>{p.text}</span>
                : p.kind === 'added'
                  ? <ins key={j} style={{ backgroundColor: 'rgba(16, 185, 129, 0.18)', textDecoration: 'none', borderRadius: '2px' }}>{p.text}</ins>
                  : <del key={j} style={{ backgroundColor: 'rgba(239, 68, 68, 0.16)', color: 'var(--text-secondary)' }}>{p.text}</del>
            )}
          </div>
        </section>
      ))}
    </div>
  );
};
