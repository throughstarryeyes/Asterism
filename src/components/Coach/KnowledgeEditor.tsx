import React, { useState } from 'react';
import {
  CUE_MODES, CUE_MODE_LABELS, addFeeling, defaultKnowledge, knowledgeToJson, mergeNewDefaults, parseKnowledgeJson, removeFeeling, removeTheme,
  setBoardList, setCues, setList, setTheme, updateFeeling, type CoachKnowledge,
} from '../../services/coach/knowledge';
import { AUTOPSY_PACKETS } from '../../services/muse/generators';
import { useAsterism } from '../../context/AsterismContext';
import { storageService } from '../../services/storage';
import { Trash2, X } from 'lucide-react';

const small: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 };
const heading: React.CSSProperties = { fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' };
const card: React.CSSProperties = { border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' };
const pill: React.CSSProperties = { padding: '4px 8px', fontSize: '0.74rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-main)' };
const field: React.CSSProperties = { padding: '5px 8px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-app)', color: 'var(--text-main)', boxSizing: 'border-box' };

// a list of words as removable chips, with a box to add more (enter or comma).
const Chips: React.FC<{ items: string[]; onChange: (items: string[]) => void; placeholder?: string }> = ({ items, onChange, placeholder = 'add…' }) => {
  const [text, setText] = useState('');
  const add = () => {
    const more = text.split(',').map(s => s.replace(/^\s+/, '')).filter(s => s.trim());
    if (more.length) onChange([...items, ...more]);
    setText('');
  };
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map(item => (
        <span key={item} style={{ ...pill, display: 'flex', alignItems: 'center', gap: 4 }}>
          {item}
          <button onClick={() => onChange(items.filter(i => i !== item))} title="Remove" style={{ display: 'flex', color: 'var(--text-muted)' }}><X size={11} /></button>
        </span>
      ))}
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        style={{ ...field, width: 120, padding: '3px 6px' }}
      />
    </div>
  );
};

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ ...small, fontWeight: 600, color: 'var(--text-main)' }}>{title}</div>
    {hint && <div style={small}>{hint}</div>}
    {children}
  </div>
);

export const KnowledgeEditor: React.FC<{ knowledge: CoachKnowledge; onChange: (k: CoachKnowledge) => void }> = ({ knowledge: k, onChange }) => {
  const { showToast } = useAsterism();
  const [open, setOpen] = useState<string | null>(null);
  const [newFeeling, setNewFeeling] = useState('');
  const [newTheme, setNewTheme] = useState('');
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);

  const applyText = () => {
    const result = parseKnowledgeJson(text);
    if (!result.ok) { setTextError(result.error); return; }
    setTextError(null);
    onChange(result.knowledge);
    showToast('Updated what I look for.', 'success');
  };

  return (
    <div style={card}>
      <div style={heading}>What I look for</div>
      <div style={small}>
        Everything I watch for is here, and you can change it. Add a word, remove one, or add a feeling. Feelings match word starts, so “tremb” finds trembled.
      </div>

      <Section title="Feelings">
        {Object.entries(k.feelings).map(([id, f]) => {
          const isOpen = open === id;
          const total = CUE_MODES.reduce((n, m) => n + f.cues[m].length, 0);
          return (
            <div key={id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setOpen(isOpen ? null : id)} style={{ flex: 1, textAlign: 'left', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.84rem' }}>
                  {f.label} <span style={{ ...small, fontWeight: 400 }}>· {total} word{total === 1 ? '' : 's'}</span>
                </button>
                <button onClick={() => onChange(removeFeeling(k, id))} title="Stop looking for this" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Trash2 size={13} /></button>
              </div>
              {isOpen && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Name
                      <input style={field} value={f.label} onChange={e => onChange(updateFeeling(k, id, { label: e.target.value }))} />
                    </label>
                    <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>“I think they may be …”
                      <input style={field} value={f.phrase} onChange={e => onChange(updateFeeling(k, id, { phrase: e.target.value }))} />
                    </label>
                    <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Warmth between people: {f.warmth}
                      <input type="range" min={-1} max={1} step={0.25} value={f.warmth} onChange={e => onChange(updateFeeling(k, id, { warmth: Number(e.target.value) }))} style={{ accentColor: 'var(--accent-gold)' }} />
                    </label>
                    <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Follow-up questions from
                      <select style={field} value={f.packet ?? ''} onChange={e => onChange(updateFeeling(k, id, { packet: e.target.value }))}>
                        <option value="">None</option>
                        {AUTOPSY_PACKETS.map(p => <option key={p.title} value={p.title}>{p.title}</option>)}
                      </select>
                    </label>
                  </div>
                  {CUE_MODES.map(mode => (
                    <Section key={mode} title={CUE_MODE_LABELS[mode]}>
                      <Chips items={f.cues[mode]} onChange={list => onChange(setCues(k, id, mode, list))} />
                    </Section>
                  ))}
                </>
              )}
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...field, flex: 1 }} value={newFeeling} onChange={e => setNewFeeling(e.target.value)} placeholder="Add a feeling (e.g. Homesick, Guilt, Hope)"
            onKeyDown={e => { if (e.key === 'Enter' && newFeeling.trim()) { onChange(addFeeling(k, newFeeling)); setOpen(null); setNewFeeling(''); } }} />
          <button style={pill} disabled={!newFeeling.trim()} onClick={() => { onChange(addFeeling(k, newFeeling)); setNewFeeling(''); }}>Add</button>
        </div>
      </Section>

      <Section title="Big events" hint="If one of these is mentioned once, in summary, and never shown, I’ll ask whether you want to write it.">
        <Chips items={k.events} onChange={list => onChange(setList(k, 'events', list))} />
      </Section>
      <Section title="Signs something is being told, not shown" hint="Words like “had” and “remembered” that suggest an event is only being summarized.">
        <Chips items={k.toldNotShown} onChange={list => onChange(setList(k, 'toldNotShown', list))} />
      </Section>
      <Section title="Promises">
        <Chips items={k.board.promise} onChange={list => onChange(setBoardList(k, 'promise', list))} />
      </Section>
      <Section title="Secrets">
        <Chips items={k.board.secret} onChange={list => onChange(setBoardList(k, 'secret', list))} />
      </Section>
      <Section title="Warnings">
        <Chips items={k.board.warning} onChange={list => onChange(setBoardList(k, 'warning', list))} />
      </Section>

      <Section title="Prompt themes" hint="The Prompt Lab filters prompts by these. Each theme is a list of word beginnings.">
        {Object.entries(k.promptThemes).map(([name, list]) => (
          <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ ...small, color: 'var(--text-main)' }}>{name}</span>
              <button onClick={() => onChange(removeTheme(k, name))} title="Remove theme" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Trash2 size={12} /></button>
            </div>
            <Chips items={list} onChange={l => onChange(setTheme(k, name, l))} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...field, flex: 1 }} value={newTheme} onChange={e => setNewTheme(e.target.value)} placeholder="Add a theme (e.g. Weather)" />
          <button style={pill} disabled={!newTheme.trim()} onClick={() => { onChange(setTheme(k, newTheme, [])); setNewTheme(''); }}>Add</button>
        </div>
      </Section>

      <Section title="Share, back up or start over">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={pill} onClick={() => storageService.downloadTextFile('coach-knowledge.json', knowledgeToJson(k), 'application/json')}>Export as a file</button>
          <label style={{ ...pill, cursor: 'pointer' }}>
            Import a file
            <input type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const result = parseKnowledgeJson(await file.text());
                if (result.ok) { onChange(result.knowledge); showToast('Imported.', 'success'); } else showToast(result.error, 'info');
              }} />
          </label>
          <button style={pill} onClick={() => { setShowText(v => !v); setText(knowledgeToJson(k)); setTextError(null); }}>{showText ? 'Hide' : 'Edit'} as text</button>
          <button style={pill} onClick={() => { onChange(mergeNewDefaults(k)); showToast('Added any built-in words you didn’t have. Your own are kept.', 'info'); }}>Add new built-in words</button>
          <button style={pill} onClick={() => { if (window.confirm('Put everything back to the built-in version? Your changes will be lost.')) onChange(defaultKnowledge()); }}>Reset to built-in</button>
        </div>
        {showText && (
          <>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={12} spellCheck={false}
              style={{ ...field, fontFamily: 'var(--font-mono)', fontSize: '0.74rem', width: '100%', resize: 'vertical' }} />
            {textError && <div style={{ ...small, color: '#ef4444' }}>{textError}</div>}
            <button style={{ ...pill, alignSelf: 'flex-start' }} onClick={applyText}>Apply</button>
          </>
        )}
      </Section>
    </div>
  );
};
