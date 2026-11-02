import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { VERDICTS, checkLabel, checkOf, type FindingVerdict, type MisreadFix } from '../../services/analyzerFeedback';
import type { AnalysisFinding } from '../../types';

const chip: React.CSSProperties = { padding: '4px 8px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--tag-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.72rem', fontWeight: 500 };
const strong: React.CSSProperties = { ...chip, backgroundColor: 'var(--accent-gold-bg)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 };

// the five ways to answer a finding, and what the analyzer may learn from the answer
export const FindingAnswer: React.FC<{ finding: AnalysisFinding }> = ({ finding }) => {
  const { answerFinding } = useAsterism();
  const [picking, setPicking] = useState<FindingVerdict | null>(null);
  const [note, setNote] = useState('');
  const [justThis, setJustThis] = useState(false);
  const [fixKind, setFixKind] = useState<'none' | MisreadFix['kind']>('none');
  const [phrase, setPhrase] = useState(() => (finding.evidencePassages[0]?.quote ?? '').replace(/[…]|\.\.\.$/g, '').trim().slice(0, 120));
  const [other, setOther] = useState('');
  const { check, subject } = checkOf(finding);
  const learn = !justThis;

  const fix = (): MisreadFix | undefined => {
    if (fixKind === 'phrase') return { kind: 'phrase', phrase };
    if (fixKind === 'same-person') return { kind: 'same-person', other };
    if (fixKind === 'not-character') return { kind: 'not-character' };
    return undefined;
  };

  const send = (verdict: FindingVerdict, scope?: 'passage' | 'character' | 'project' | 'global') => {
    answerFinding(finding.id, verdict, { note, learn, scope: scope ?? 'passage', fix: verdict === 'misunderstood' ? fix() : undefined });
    setPicking(null);
    setNote('');
    setFixKind('none');
  };

  const choose = (verdict: FindingVerdict) => {
    if (verdict === 'correct' || verdict === 'intentional') send(verdict);
    else setPicking(picking === verdict ? null : verdict);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Your answer:</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {VERDICTS.map(v => (
          <button key={v.id} title={v.hint} onClick={() => choose(v.id)} style={v.id === 'correct' ? strong : { ...chip, outline: picking === v.id ? '1px solid var(--accent-gold)' : 'none' }}>
            {v.label}{v.id === 'correct' ? ' (+15 pts)' : ''}
          </button>
        ))}
      </div>

      {(picking === 'related' || picking === 'misunderstood') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder={picking === 'related' ? 'Where is it handled? (optional)' : 'What is actually going on? (+25 pts)'}
            style={{ padding: '6px 8px', fontSize: '0.78rem' }}
          />
          {picking === 'misunderstood' && learn && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              <div>Teach me, so it doesn’t happen again:</div>
              <label><input type="radio" checked={fixKind === 'none'} onChange={() => setFixKind('none')} /> Just save my note</label>
              <label><input type="radio" checked={fixKind === 'phrase'} onChange={() => setFixKind('phrase')} /> Ignore {checkLabel(check)} that mention this wording</label>
              {fixKind === 'phrase' && (
                <input value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="The wording to ignore (trim it to the part that matters)" style={{ padding: '4px 6px', fontSize: '0.74rem' }} />
              )}
              {subject && <label><input type="radio" checked={fixKind === 'same-person'} onChange={() => setFixKind('same-person')} /> {subject} is also called…</label>}
              {fixKind === 'same-person' && (
                <input value={other} onChange={e => setOther(e.target.value)} placeholder="The other name" style={{ padding: '4px 6px', fontSize: '0.74rem' }} />
              )}
              {subject && <label><input type="radio" checked={fixKind === 'not-character'} onChange={() => setFixKind('not-character')} /> “{subject}” isn’t a character</label>}
            </div>
          )}
          <button onClick={() => send(picking)} style={{ ...strong, alignSelf: 'flex-start' }}>Save</button>
        </div>
      )}

      {picking === 'not_relevant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Hide more like this?</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => send('not_relevant', 'passage')} style={chip}>Just this one</button>
            {subject && <button onClick={() => send('not_relevant', 'character')} style={chip}>All about {subject}</button>}
            <button onClick={() => send('not_relevant', 'project')} style={chip}>All {checkLabel(check)} here</button>
            <button onClick={() => send('not_relevant', 'global')} style={chip}>In every project</button>
          </div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: 'var(--text-muted)' }} title="Your answer counts here, but the analyzer won't learn from it.">
        <input type="checkbox" checked={justThis} onChange={e => setJustThis(e.target.checked)} />
        <span>Just this one, don’t learn from it</span>
      </label>
    </div>
  );
};
