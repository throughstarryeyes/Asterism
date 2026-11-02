import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { VERDICTS, allPreferences, checkLabel, describePreference, hiddenBy, suggestions } from '../../services/analyzerFeedback';

const small: React.CSSProperties = { fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 };
const btn: React.CSSProperties = { padding: '4px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--tag-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.72rem' };
const card: React.CSSProperties = { padding: '8px 10px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' };

// offered when the writer keeps calling the same kind of finding not relevant, one at a time
export const SuggestionBanner: React.FC = () => {
  const { project, userStats, acceptHideSuggestion, declineSuggestion } = useAsterism();
  const [first] = suggestions(
    project.memoryVault.feedback ?? [],
    allPreferences(project, userStats.analyzerPreferences),
    project.memoryVault.declinedSuggestions ?? [],
  );
  if (!first) return null;
  return (
    <div style={{ ...card, borderLeft: '3px solid var(--accent-gold)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={small}>You’ve marked {first.count} findings about {checkLabel(first.check)} as not relevant. Hide the rest?</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => acceptHideSuggestion(first.check, 'project')}>In this project</button>
        <button style={btn} onClick={() => acceptHideSuggestion(first.check, 'global')}>In every project</button>
        <button style={{ ...btn, border: 'none', color: 'var(--text-muted)' }} onClick={() => declineSuggestion(first.key)}>No thanks</button>
      </div>
    </div>
  );
};

// everything the analyzer has learned, in one place: switch it off, delete it, or undo an answer
export const PreferencesSection: React.FC = () => {
  const { project, userStats, setPreferenceEnabled, deletePreference, respondToFinding } = useAsterism();
  const prefs = allPreferences(project, userStats.analyzerPreferences);
  const answers = [...(project.memoryVault.feedback ?? [])].reverse();
  const findings = project.findings ?? [];
  const [showAnswers, setShowAnswers] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginTop: '6px' }}>Your preferences</div>
      <div style={small}>What you asked me to hide. Turn one off or delete it to bring those findings back.</div>

      {prefs.length === 0 && <div style={small}>None yet. Answer a finding with “Not relevant” to set one.</div>}
      {prefs.map(p => {
        const count = hiddenBy(findings, p.id).length;
        return (
          <div key={p.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '8px', opacity: p.enabled ? 1 : 0.6 }}>
            <input type="checkbox" checked={p.enabled} onChange={e => setPreferenceEnabled(p.id, e.target.checked)} title={p.enabled ? 'Turn off' : 'Turn on'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{describePreference(p)}</div>
              <div style={{ ...small, fontSize: '0.7rem' }}>{p.scope === 'global' ? 'All projects' : p.scope === 'character' ? 'One character' : 'This project'}{p.kind === 'same-person' || p.kind === 'not-character' ? (p.enabled ? ' · changes who counts as a character' : ' · off') : p.enabled ? ` · ${count} hidden now` : ' · off'}</div>
            </div>
            <button style={btn} onClick={() => deletePreference(p.id)}>Delete</button>
          </div>
        );
      })}

      {answers.length > 0 && (
        <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={() => setShowAnswers(!showAnswers)}>
          {showAnswers ? 'Hide' : 'Show'} your answers ({answers.length})
        </button>
      )}
      {showAnswers && answers.slice(0, 30).map(a => (
        <div key={a.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>{findings.find(f => f.id === a.findingId)?.title ?? 'A finding that is gone now'}</div>
            <div style={{ ...small, fontSize: '0.7rem' }}>{VERDICTS.find(v => v.id === a.verdict)?.label}{a.learn ? '' : ' · just this one'}{a.note ? ` · “${a.note}”` : ''}</div>
          </div>
          <button style={btn} onClick={() => respondToFinding(a.findingId, 'unreviewed')}>Undo</button>
        </div>
      ))}
    </div>
  );
};
