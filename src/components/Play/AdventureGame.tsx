import React, { useState } from 'react';
import { Dices, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import {
  MAX_ADVENTURES, ODDS_LABEL, ORACLE_HINT, ORACLE_LABEL, QUICK_QUESTIONS, SLOTS, addToJournal, adventureTitle, askOracle, eventText, journalEntry, journalText,
  newAdventure, parseEntries, randomComplication, randomEvent, rerollSlot, rollDice, rollPremise, rollTable,
} from '../../services/play/adventure';
import type { Adventure, AdventureSlot, CustomTable, OracleAnswer } from '../../services/play/types';
import { uid } from '../../services/play/rng';
import { Chip, Label, Muted, Panel, Row, Story, area, btn, btnPrimary, field } from './ui';

const KIND: Record<string, string> = { note: 'Note', oracle: 'Oracle', event: 'Event', complication: 'Complication', table: 'Table', roll: 'Dice' };

// a solo storytelling game: dice and tables build a premise, an oracle answers what you cannot decide, and a journal keeps the story as it happens
export const AdventureGame: React.FC = () => {
  const { userStats, updatePlay, startAdventureProject, showToast, notePlay } = useAsterism();
  const adventures = userStats.play?.adventures ?? [];
  const tables = userStats.play?.tables ?? [];
  const [currentId, setCurrentId] = useState<string | null>(null);
  const adv = adventures.find(a => a.id === currentId) ?? adventures[0];

  const [question, setQuestion] = useState('');
  // what the oracle just said, and which adventure it was for, so it does not follow you to another one
  const [lastRaw, setLast] = useState<{ adv: string; answer: OracleAnswer; roll: number; event?: string } | null>(null);
  const [note, setNote] = useState('');
  const [dice, setDice] = useState('1d6');
  const [diceRaw, setDiceOut] = useState<{ adv: string; text: string } | null>(null);
  const [editTables, setEditTables] = useState(false);

  const last = lastRaw && lastRaw.adv === adv?.id ? lastRaw : null;
  const diceOut = diceRaw && diceRaw.adv === adv?.id ? diceRaw.text : '';

  const patch = (fn: (a: Adventure) => Adventure) => {
    if (!adv) return;
    updatePlay(p => ({ ...p, adventures: (p.adventures ?? []).map(a => (a.id === adv.id ? { ...fn(a), updatedAt: new Date().toISOString() } : a)) }));
  };
  const log = (kind: Parameters<typeof journalEntry>[0], text: string, result?: string) => patch(a => addToJournal(a, journalEntry(kind, text, result)));

  const start = () => {
    const a = newAdventure();
    updatePlay(p => ({ ...p, adventures: [a, ...(p.adventures ?? [])].slice(0, MAX_ADVENTURES) }));
    setCurrentId(a.id);
    notePlay('Started a solo adventure');
  };

  const ask = () => {
    if (!adv) return;
    const q = question.trim() || 'Does it happen?';
    const r = askOracle(adv.odds, adv.chaos);
    const event = r.event ? randomEvent() : undefined;
    setLast({ adv: adv.id, answer: r.answer, roll: r.roll, event: event ? eventText(event) : undefined });
    patch(a => {
      let next = addToJournal(a, journalEntry('oracle', q, ORACLE_LABEL[r.answer]));
      if (event) next = addToJournal(next, journalEntry('event', 'Random event', eventText(event)));
      return next;
    });
    setQuestion('');
  };

  if (!adv) {
    return (
      <Panel title="Roll Your Story" note="You do not have to know what you are going to write. Roll a place, two people, how they are tied and what is happening, then use the oracle when you do not know what comes next.">
        <Row><button style={btnPrimary} onClick={start}><Dices size={14} />Start an adventure</button></Row>
      </Panel>
    );
  }

  const toggleLock = (slot: AdventureSlot) => patch(a => ({ ...a, locked: a.locked.includes(slot) ? a.locked.filter(s => s !== slot) : [...a.locked, slot] }));
  const names: Record<AdventureSlot, string | null> = { setting: null, characterA: adv.nameA, characterB: adv.nameB, connection: null, situation: null };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Panel title="Your adventures">
        <Row>
          <select aria-label="Adventure" value={adv.id} onChange={e => setCurrentId(e.target.value)} style={{ ...field, maxWidth: 320 }}>
            {adventures.map(a => <option key={a.id} value={a.id}>{adventureTitle(a)}{a.projectId ? ' (saved)' : ''}</option>)}
          </select>
          <button style={btn} onClick={start}><Plus size={14} />New</button>
          <button style={btn} onClick={() => { if (window.confirm(`Delete "${adventureTitle(adv)}"? A document made from it is kept.`)) { updatePlay(p => ({ ...p, adventures: (p.adventures ?? []).filter(a => a.id !== adv.id) })); setCurrentId(null); } }}><Trash2 size={14} />Delete</button>
        </Row>
      </Panel>

      <Panel title="The premise" note="Lock what you love and roll again for the rest. Reroll anything on its own. The premise is yours to interpret.">
        <Label text="Title (optional)"><input value={adv.title} onChange={e => patch(a => ({ ...a, title: e.target.value }))} placeholder={adventureTitle(adv)} style={field} /></Label>
        {SLOTS.map(s => (
          <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <Row wrap={false} style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{s.label}</span>
              <Row gap={4} wrap={false}>
                <button style={{ ...btn, padding: '3px 7px' }} onClick={() => toggleLock(s.id)} aria-pressed={adv.locked.includes(s.id)} title={adv.locked.includes(s.id) ? 'Unlock' : 'Lock so it stays'}>
                  {adv.locked.includes(s.id) ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
                <button style={{ ...btn, padding: '3px 7px' }} disabled={adv.locked.includes(s.id)} onClick={() => patch(a => ({ ...a, rolls: rerollSlot(a.rolls, s.id) }))} aria-label={`Roll ${s.label} again`} title="Roll this again"><Dices size={13} /></button>
              </Row>
            </Row>
            <Story>{adv.rolls[s.id]}</Story>
            {names[s.id] !== null && (
              <input aria-label={`${s.label}'s name`} value={names[s.id] ?? ''} onChange={e => patch(a => ({ ...a, [s.id === 'characterA' ? 'nameA' : 'nameB']: e.target.value }))} placeholder="Their name, when you know it" style={{ ...field, maxWidth: 260 }} />
            )}
          </div>
        ))}
        <Row><button style={btn} onClick={() => patch(a => ({ ...a, rolls: rollPremise(a.locked, a.rolls) }))}><Dices size={14} />Roll everything unlocked</button></Row>
      </Panel>

      <Panel title="Ask the oracle" note="When you do not know what happens next, ask a yes-or-no question. Then decide what the answer means.">
        <Row>{QUICK_QUESTIONS.slice(0, 4).map(q => <Chip key={q} on={question === q} onClick={() => setQuestion(q)}>{q}</Chip>)}</Row>
        <input aria-label="Your question" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(); }} placeholder="Is the stranger trustworthy?" style={field} />
        <Row>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>How likely?</span>
          {(['likely', 'even', 'unlikely'] as const).map(o => <Chip key={o} on={adv.odds === o} onClick={() => patch(a => ({ ...a, odds: o }))}>{ODDS_LABEL[o]}</Chip>)}
          <button style={btnPrimary} onClick={ask}>Ask</button>
        </Row>
        {last && (
          <div role="status" style={{ border: '1px solid var(--accent-gold)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Story>{ORACLE_LABEL[last.answer]}</Story>
            <Muted>{ORACLE_HINT[last.answer]} (rolled {last.roll})</Muted>
            {last.event && <Muted><strong>Something else happens:</strong> {last.event}. Read it as a hint, not an instruction.</Muted>}
          </div>
        )}
        <Row>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Chaos {adv.chaos}</span>
          <button style={{ ...btn, padding: '3px 9px' }} aria-label="Less chaos" disabled={adv.chaos <= 1} onClick={() => patch(a => ({ ...a, chaos: a.chaos - 1 }))}>−</button>
          <button style={{ ...btn, padding: '3px 9px' }} aria-label="More chaos" disabled={adv.chaos >= 9} onClick={() => patch(a => ({ ...a, chaos: a.chaos + 1 }))}>+</button>
          <Muted>Higher means the unexpected happens more often.</Muted>
        </Row>
      </Panel>

      <Panel title="When you need something">
        <Row>
          <button style={btn} onClick={() => { const e = randomEvent(); log('event', 'Random event', eventText(e)); setLast(null); showToast(eventText(e), 'info'); }}>Random event</button>
          <button style={btn} onClick={() => { const c = randomComplication(); log('complication', 'Complication', c); showToast(c, 'info'); }}>Complication</button>
          <input aria-label="Dice" value={dice} onChange={e => setDice(e.target.value)} style={{ ...field, width: 90 }} placeholder="2d6+1" />
          <button style={btn} onClick={() => { const r = rollDice(dice); if (!r) { setDiceOut({ adv: adv.id, text: 'Try something like 2d6, d20 or 3d4+1.' }); return; } setDiceOut({ adv: adv.id, text: r.text }); log('roll', dice.trim(), String(r.total)); }}>Roll dice</button>
          {diceOut && <span role="status" style={{ fontSize: '0.9rem', fontWeight: 600 }}>{diceOut}</span>}
        </Row>
        <Muted>Each one goes into your journal, so you can see how the story got here.</Muted>
        <Row>
          {tables.map(t => <button key={t.id} style={btn} onClick={() => { const r = rollTable(t); if (r) { log('table', t.name, r); showToast(`${t.name}: ${r}`, 'info'); } else showToast(`"${t.name}" has no entries yet.`, 'info'); }}>{t.name}</button>)}
          <button style={btn} onClick={() => setEditTables(v => !v)}>{editTables ? 'Done with tables' : 'My tables'}</button>
        </Row>
        {editTables && <TableEditor tables={tables} onChange={next => updatePlay(p => ({ ...p, tables: next }))} />}
      </Panel>

      <Panel title="Journal" note="Write what happens. Oracle answers and rolls are kept between your notes.">
        {adv.journal.length === 0 && <Muted>Nothing yet. Ask the oracle something, or begin with a few words.</Muted>}
        {adv.journal.map(e => (
          <Row key={e.id} wrap={false} style={{ alignItems: 'flex-start', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{KIND[e.kind]}</span>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55, fontStyle: e.kind === 'note' ? 'normal' : 'italic' }}>{e.text}{e.result ? ` → ${e.result}` : ''}</p>
            </div>
            <button aria-label="Remove this entry" title="Remove this entry" style={{ ...btn, padding: '3px 6px' }} onClick={() => patch(a => ({ ...a, journal: a.journal.filter(j => j.id !== e.id) }))}><Trash2 size={13} /></button>
          </Row>
        ))}
        <textarea aria-label="Add to the journal" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="What happens?" style={area} />
        <Row><button style={btn} disabled={!note.trim()} onClick={() => { log('note', note.trim()); setNote(''); }}>Add to journal</button></Row>
      </Panel>

      <Panel title="Keep it" note="Turn the whole adventure into a document: the premise becomes the synopsis, the two people and the place go in your story bible, and the journal is the first chapter.">
        <Row>
          <button style={btnPrimary} onClick={() => { const id = startAdventureProject(adv); patch(a => ({ ...a, projectId: id })); notePlay('Turned an adventure into a document'); }}>
            {adv.projectId ? 'Save a fresh copy as a document' : 'Save as a document'}
          </button>
          <button style={btn} onClick={() => { void navigator.clipboard?.writeText(journalText(adv)).then(() => showToast('Copied.', 'info'), () => undefined); }}>Copy the journal</button>
        </Row>
        {adv.projectId && <Muted>Already saved once. The adventure stays here, so you can keep playing it.</Muted>}
      </Panel>
    </div>
  );
};

const TableEditor: React.FC<{ tables: CustomTable[]; onChange: (t: CustomTable[]) => void }> = ({ tables, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {tables.map(t => (
      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row>
          <input aria-label="Table name" value={t.name} onChange={e => onChange(tables.map(x => (x.id === t.id ? { ...x, name: e.target.value } : x)))} style={{ ...field, flex: 1 }} />
          <button style={{ ...btn, padding: '4px 7px' }} aria-label={`Delete ${t.name}`} onClick={() => onChange(tables.filter(x => x.id !== t.id))}><Trash2 size={13} /></button>
        </Row>
        <textarea aria-label={`Entries for ${t.name}`} rows={4} value={t.entries.join('\n')} onChange={e => onChange(tables.map(x => (x.id === t.id ? { ...x, entries: e.target.value.split('\n') } : x)))} onBlur={() => onChange(tables.map(x => (x.id === t.id ? { ...x, entries: parseEntries(x.entries.join('\n')) } : x)))} placeholder="One entry per line" style={area} />
      </div>
    ))}
    <Row><button style={btn} onClick={() => onChange([...tables, { id: uid('tbl'), name: 'New table', entries: [] }])}><Plus size={14} />New table</button></Row>
  </div>
);
