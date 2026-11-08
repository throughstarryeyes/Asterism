import React, { useMemo, useState } from 'react';
import { Dices, Trash2 } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { CHOICE_NOTE, OTHER_CHOICE, SCENARIOS, answersFor, compare, hasBase, labNote, makeAnswer, patterns, readAnswer, scenarioById, unseenTwists, upsertAnswer, type Scenario } from '../../services/play/lab';
import { pick } from '../../services/play/rng';
import { withLoreNote } from '../../services/play/save';
import { Chip, DocSelect, Label, Muted, Panel, Row, Story, area, btn, btnPrimary, field, useDocs } from './ui';

// situations that make a character choose, then change the circumstances and see what holds.
// it keeps every answer so they can be compared, and never gives a character a type.
export const CharacterLab: React.FC = () => {
  const { updateAnyProject, showToast, notePlay } = useAsterism();
  const { docs, doc, docId, setDocId } = useDocs();
  const characters = doc?.storyBible.characters ?? [];
  const [charId, setCharId] = useState('');
  const [loose, setLoose] = useState('');
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [twistId, setTwistId] = useState<string | undefined>(undefined);
  const [choiceId, setChoiceId] = useState('');
  const [other, setOther] = useState('');
  const [why, setWhy] = useState('');
  const [saved, setSaved] = useState(false);

  const picked = characters.find(c => c.id === charId);
  const who = picked ? { id: picked.id, name: picked.name } : { id: undefined, name: loose.trim() };
  const mine = useMemo(() => answersFor(doc?.play?.lab, who), [doc?.play?.lab, who.id, who.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const scenario = scenarioById(scenarioId) as Scenario;
  const twist = twistId ? scenario.twists.find(t => t.id === twistId) : undefined;
  const existing = mine.find(a => a.scenarioId === scenarioId && (a.twistId ?? '') === (twistId ?? ''));
  const left = unseenTwists(scenario, mine);

  if (!doc) return <Panel><Muted>Make a document first. The Character Lab keeps its answers with the document.</Muted></Panel>;

  const go = (sid: string, tid?: string) => {
    setScenarioId(sid); setTwistId(tid); setSaved(false);
    const prior = answersFor(doc.play?.lab, who).find(a => a.scenarioId === sid && (a.twistId ?? '') === (tid ?? ''));
    setChoiceId(prior?.choiceId ?? ''); setOther(prior?.other ?? ''); setWhy(prior?.why ?? '');
  };

  const save = () => {
    if (!who.name || !choiceId) return;
    const answer = makeAnswer({ scenarioId, twistId, choiceId, other, why, characterId: who.id, characterName: who.name });
    updateAnyProject(doc.id, { play: { ...doc.play, lab: upsertAnswer(doc.play?.lab, answer) } });
    notePlay('Explored a character');
    setSaved(true);
  };

  const remove = (id: string) => updateAnyProject(doc.id, { play: { ...doc.play, lab: (doc.play?.lab ?? []).filter(a => a.id !== id) } });
  const comparisons = compare(mine);
  const found = patterns(mine, who.name || 'This character');
  const choices = [...scenario.choices, OTHER_CHOICE];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Character Lab" note="Not a personality quiz. You put your character in a real situation, decide what they do, then change the circumstances and see what holds. Everything is kept, so you can compare.">
        <Row gap={12} style={{ alignItems: 'flex-end' }}>
          <DocSelect docs={docs} value={docId} onChange={id => { setDocId(id); setCharId(''); }} />
          {characters.length > 0 && (
            <Label text="Character">
              <select value={charId} onChange={e => { setCharId(e.target.value); setSaved(false); }} style={field}>
                <option value="">Someone not in my notes…</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Label>
          )}
          {!picked && <Label text="Their name"><input value={loose} onChange={e => setLoose(e.target.value)} placeholder="A name" style={field} /></Label>}
        </Row>
        {!who.name && <Muted>Choose or name a character to begin.</Muted>}
      </Panel>

      {who.name && (
        <>
          <Panel title="Scenarios">
            <Row>
              {SCENARIOS.map(s => {
                const n = mine.filter(a => a.scenarioId === s.id).length;
                return <Chip key={s.id} on={s.id === scenarioId} onClick={() => go(s.id)}>{s.title}{n ? ` · ${n}` : ''}</Chip>;
              })}
            </Row>
          </Panel>

          <Panel title={twist ? `${scenario.title}: what if…` : scenario.title}>
            {twist && <Muted>First version: {scenario.setup}</Muted>}
            <Story>{twist ? twist.text : scenario.setup}</Story>
            <Muted>What does {who.name} do?</Muted>
            <div role="radiogroup" aria-label={`What ${who.name} does`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {choices.map(c => (
                <button key={c.id} role="radio" aria-checked={choiceId === c.id} onClick={() => { setChoiceId(c.id); setSaved(false); }}
                  style={{ ...btn, justifyContent: 'flex-start', textAlign: 'left', fontWeight: 500, background: choiceId === c.id ? 'var(--accent-gold-bg)' : 'transparent', borderColor: choiceId === c.id ? 'var(--accent-gold)' : 'var(--border-subtle)' }}>
                  {c.label}
                </button>
              ))}
            </div>
            {choiceId === 'other' && <input aria-label="What they do" value={other} onChange={e => setOther(e.target.value)} placeholder="What do they do?" style={field} />}
            <Label text="Why? What matters most to them in this situation?">
              <textarea rows={3} value={why} onChange={e => { setWhy(e.target.value); setSaved(false); }} style={area} />
            </Label>
            <Row>
              <button style={btnPrimary} onClick={save} disabled={!choiceId || (choiceId === 'other' && !other.trim())}>{existing ? 'Update my answer' : 'Explore my answer'}</button>
              {existing && <Muted>You answered this before. Saving replaces it.</Muted>}
            </Row>
            <Muted>{CHOICE_NOTE}</Muted>
          </Panel>

          {(saved || existing) && left.length > 0 && (
            <Panel title="Now change the circumstances" note="Same character, different situation. Does the answer hold?">
              <Row>
                {left.map(t => <button key={t.id} style={{ ...btn, textAlign: 'left', fontWeight: 500 }} onClick={() => go(scenario.id, t.id)}>{t.text}</button>)}
              </Row>
              <Row><button style={btn} onClick={() => go(scenario.id, pick(left).id)}><Dices size={14} />Surprise me</button></Row>
            </Panel>
          )}
          {saved && left.length === 0 && hasBase(scenario, mine) && <Muted>You have been through every version of this one. Try another scenario.</Muted>}

          {mine.length > 0 && (
            <Panel title={`${who.name}, so far`} note="Only what you chose, laid side by side. It is a record, not a verdict, and a character is allowed to contradict themselves.">
              {found.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {found.map(p => <li key={p.text}>{p.text}</li>)}
                </ul>
              )}
              {comparisons.map(c => (
                <div key={c.scenarioId} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                  <Story>{c.title}</Story>
                  {c.base && <Muted>First: {c.base.choiceLabel}{c.base.why ? ` (${c.base.why})` : ''}</Muted>}
                  {c.twists.map(t => (
                    <Muted key={t.question}>
                      <strong>{t.held ? 'Held' : 'Changed'}.</strong> {t.question} {t.choiceLabel}{t.why ? ` (${t.why})` : ''}
                    </Muted>
                  ))}
                </div>
              ))}
              <Row>
                <button style={btn} onClick={() => {
                  const key = who.id ?? who.name.toLowerCase().replace(/\W+/g, '-');
                  updateAnyProject(doc.id, withLoreNote(doc, `Character Lab: ${who.name}`, labNote(mine, who.name), `lore-lab-${key}`));
                  showToast('Kept as a note in your story bible.', 'success');
                }}>Keep as a note in my story bible</button>
              </Row>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Every answer</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {mine.map(a => {
                    const r = readAnswer(a);
                    return r ? (
                      <Row key={a.id} wrap={false} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Muted>{r.scenario.title}: {r.question} → {r.choiceLabel}</Muted>
                        <button aria-label="Delete this answer" title="Delete this answer" style={{ ...btn, padding: '3px 6px' }} onClick={() => remove(a.id)}><Trash2 size={13} /></button>
                      </Row>
                    ) : null;
                  })}
                </div>
              </details>
            </Panel>
          )}
        </>
      )}
    </div>
  );
};
