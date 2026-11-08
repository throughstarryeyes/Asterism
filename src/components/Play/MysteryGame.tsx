import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MYSTERY_MODES, accuse, caseText, generateCase, mysteryChecks, type Case, type MysteryMode, type Verdict } from '../../services/play/mystery';
import type { MysteryCase } from '../../services/play/rooms';
import { uid } from '../../services/play/rng';
import { Chip, KeepBar, Label, Muted, Panel, Row, Story, area, btn, btnPrimary, field, useDocs } from './ui';

const KEY = 'asterism_play_case';
const load = (): { case: Case; found: string[]; notes: string } | null => {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
const store = (v: { case: Case; found: string[]; notes: string } | null) => {
  try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* the case just is not remembered */ }
};

// investigate a generated case file, or build a mystery of your own and have it checked
export const MysteryGame: React.FC = () => {
  const [tab, setTab] = useState<'solve' | 'build'>('solve');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row>
        <Chip on={tab === 'solve'} onClick={() => setTab('solve')}>Solve a case</Chip>
        <Chip on={tab === 'build'} onClick={() => setTab('build')}>Build my own</Chip>
      </Row>
      {tab === 'solve' ? <Solve /> : <Build />}
    </div>
  );
};

const Solve: React.FC = () => {
  const { doc } = useDocs();
  const saved = load();
  const [mode, setMode] = useState<MysteryMode>(saved?.case.mode ?? 'three_suspects');
  const [c, setC] = useState<Case | null>(saved?.case ?? null);
  const [found, setFound] = useState<string[]>(saved?.found ?? []);
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [accused, setAccused] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const update = (next: { case: Case; found: string[]; notes: string } | null) => { store(next); };
  const fresh = () => {
    const next = generateCase(mode);
    setC(next); setFound([]); setNotes(''); setAccused(''); setVerdict(null);
    update({ case: next, found: [], notes: '' });
  };
  const open = (id: string) => { if (!c || found.includes(id)) return; const f = [...found, id]; setFound(f); update({ case: c, found: f, notes }); };

  return (
    <>
      <Panel title="The case file" note="The answer is built first and the clues fit it, so every case can be solved from what you find. Some clues point the wrong way. None of them lie.">
        <Row>
          {MYSTERY_MODES.map(m => <Chip key={m.id} on={mode === m.id} onClick={() => setMode(m.id)} title={m.hint}>{m.label}</Chip>)}
        </Row>
        <Muted>{MYSTERY_MODES.find(m => m.id === mode)?.hint}</Muted>
        <Row><button style={btnPrimary} onClick={fresh}>{c ? 'A new case' : 'Open a case'}</button></Row>
      </Panel>

      {c && (
        <>
          <Panel title={c.title}>
            <Story>{c.incident}</Story>
            <Muted>Suspects</Muted>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{c.suspects.map(s => <li key={s.id}><strong>{s.name}</strong>, {s.role}</li>)}</ul>
          </Panel>

          <Panel title="Where to look" note={`${found.length} of ${c.evidence.length} followed up.`}>
            <Row>
              {c.evidence.map(e => <button key={e.id} style={{ ...btn, fontWeight: found.includes(e.id) ? 400 : 600, opacity: found.includes(e.id) ? 0.6 : 1 }} disabled={found.includes(e.id)} onClick={() => open(e.id)}>{e.lead}</button>)}
            </Row>
          </Panel>

          {found.length > 0 && (
            <Panel title="What you found">
              {c.evidence.filter(e => found.includes(e.id)).map(e => <Story key={e.id}>{e.text}</Story>)}
            </Panel>
          )}

          <Panel title="Your notes">
            <textarea aria-label="Your notes" rows={4} value={notes} onChange={e => { setNotes(e.target.value); update({ case: c, found, notes: e.target.value }); }} placeholder="Who could have done it, and who could not?" style={area} />
          </Panel>

          <Panel title="Name the culprit">
            <Row>
              {c.suspects.map(s => <Chip key={s.id} on={accused === s.id} onClick={() => setAccused(s.id)}>{s.name}</Chip>)}
              <button style={btnPrimary} disabled={!accused || !!verdict} onClick={() => setVerdict(accuse(c, accused))}>Accuse</button>
            </Row>
            {verdict && (
              <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Story>{verdict.text}</Story>
                {c.evidence.some(e => e.misleading) && (
                  <Muted>Pointing the wrong way: {c.evidence.filter(e => e.misleading).map(e => e.text).join(' ')}</Muted>
                )}
              </div>
            )}
            <KeepBar doc={doc} game="mystery" title={c.title} text={caseText(c, found, notes, verdict ?? undefined)} />
          </Panel>
        </>
      )}
    </>
  );
};

export const blankMystery = (): MysteryCase => ({
  title: '', incident: '', culprit: '', how: '',
  suspects: [{ name: '', role: '' }, { name: '', role: '' }, { name: '', role: '' }],
  evidence: [{ id: uid('e'), text: '', shown: false }, { id: uid('e'), text: '', shown: false }, { id: uid('e'), text: '', shown: false }, { id: uid('e'), text: '', shown: false }],
});

// the fields of a mystery: used to build one alone and to set one up for other people to investigate
export const MysteryForm: React.FC<{ m: MysteryCase; onChange: (m: MysteryCase) => void }> = ({ m, onChange: setM }) => (
  <>
    <Label text="Title"><input value={m.title} onChange={e => setM({ ...m, title: e.target.value })} style={field} /></Label>
    <Label text="What happened"><textarea rows={2} value={m.incident} onChange={e => setM({ ...m, incident: e.target.value })} style={area} /></Label>
    <Muted>Suspects</Muted>
    {m.suspects.map((s, i) => (
      <Row key={i} wrap={false}>
        <input aria-label={`Suspect ${i + 1} name`} value={s.name} onChange={e => setM({ ...m, suspects: m.suspects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Name" style={{ ...field, flex: 1 }} />
        <input aria-label={`Suspect ${i + 1} role`} value={s.role} onChange={e => setM({ ...m, suspects: m.suspects.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} placeholder="Who they are and why they might" style={{ ...field, flex: 2 }} />
        <button aria-label="Remove suspect" style={{ ...btn, padding: '5px 7px' }} onClick={() => setM({ ...m, suspects: m.suspects.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
      </Row>
    ))}
    <Row><button style={btn} onClick={() => setM({ ...m, suspects: [...m.suspects, { name: '', role: '' }] })}><Plus size={14} />Another suspect</button></Row>
    <Muted>Clues and evidence</Muted>
    {m.evidence.map((e, i) => (
      <Row key={e.id} wrap={false}>
        <input aria-label={`Clue ${i + 1}`} value={e.text} onChange={ev => setM({ ...m, evidence: m.evidence.map(x => (x.id === e.id ? { ...x, text: ev.target.value } : x)) })} placeholder="What the investigator finds" style={{ ...field, flex: 1 }} />
        <button aria-label="Remove clue" style={{ ...btn, padding: '5px 7px' }} onClick={() => setM({ ...m, evidence: m.evidence.filter(x => x.id !== e.id) })}><Trash2 size={13} /></button>
      </Row>
    ))}
    <Row><button style={btn} onClick={() => setM({ ...m, evidence: [...m.evidence, { id: uid('e'), text: '', shown: false }] })}><Plus size={14} />Another clue</button></Row>
    <Row gap={12} style={{ alignItems: 'flex-end' }}>
      <Label text="Who did it" grow><input value={m.culprit} onChange={e => setM({ ...m, culprit: e.target.value })} style={field} /></Label>
      <Label text="How" grow><input value={m.how} onChange={e => setM({ ...m, how: e.target.value })} style={field} /></Label>
    </Row>
  </>
);

const Build: React.FC = () => {
  const { doc } = useDocs();
  const [m, setM] = useState<MysteryCase>(blankMystery);
  const checks = mysteryChecks(m);
  const text = [
    m.title || 'My mystery', m.incident, '', 'Suspects:', ...m.suspects.filter(s => s.name.trim()).map(s => `- ${s.name}${s.role.trim() ? `, ${s.role}` : ''}`),
    '', 'Clues:', ...m.evidence.filter(e => e.text.trim()).map(e => `- ${e.text}`), '', `The answer: ${m.culprit}. ${m.how}`,
  ].join('\n');

  return (
    <>
      <Panel title="Build a mystery" note="The incident, the suspects, the evidence and the real explanation. The check at the bottom asks questions, never gives orders.">
        <MysteryForm m={m} onChange={setM} />
      </Panel>
      <Panel title="Things to think about">
        {checks.length === 0 ? <Story>This holds together. Someone could solve it.</Story> : <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{checks.map(c => <li key={c}>{c}</li>)}</ul>}
        <KeepBar doc={doc} game="mystery" title={m.title || 'My mystery'} text={text} />
      </Panel>
    </>
  );
};
