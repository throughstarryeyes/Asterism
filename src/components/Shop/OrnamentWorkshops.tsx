import React, { useRef, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { chip, label } from './LoaderWorkshop';
import { MAX_MARK, cleanFlourish, cleanSeparator, flourishFrame, separatorHtml } from '../../services/ornaments';
import { MAKE_COST } from '../../services/shop';
import type { CustomFlourish, CustomSeparator } from '../../types';

// marks to pick from, for keyboards that cannot type them
const GLYPHS = ['*', '·', '~', '❦', '❧', '☙', '⁂', '✦', '✧', '◆', '◇', '❀', '♡', '☽', '☾', '⚜', '✿', '❖', '†', '§'];

const text: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', fontSize: '0.84rem' };

const Glyphs: React.FC<{ onPick: (g: string) => void }> = ({ onPick }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
    {GLYPHS.map(g => (
      <button key={g} onClick={() => onPick(g)} aria-label={`Add ${g}`} style={{ ...chip(false), padding: '2px 8px', fontSize: '0.9rem' }}>{g}</button>
    ))}
  </div>
);

const Frame: React.FC<{ title: string; blurb: string; owned: boolean; cost: number; saveLabel: string; editing: boolean; onSave: () => void; onCancel: () => void; children: React.ReactNode }> = ({ title, blurb, owned, cost, saveLabel, editing, onSave, onCancel, children }) => (
  <section aria-label={title} style={{ padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div>
      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{title}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {blurb} {owned ? 'Editing is free.' : `Design freely. Saving a new one costs ${cost} QP.`}
      </div>
    </div>
    {children}
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={{ ...chip(false), padding: '6px 14px' }}>{editing ? 'Cancel' : 'Close'}</button>
      <button onClick={onSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', color: '#ffffff' }}>
        {owned ? saveLabel : `${saveLabel} (${cost} QP)`}
      </button>
    </div>
  </section>
);

const RULES: Array<[CustomSeparator['rule'], string]> = [['none', 'No line'], ['dashed', 'Dashed'], ['solid', 'Solid'], ['gilt', 'Golden thread']];

export const SeparatorWorkshop: React.FC<{ editing: CustomSeparator | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { canMake, saveCustomSeparator } = useAsterism();
  const [draft, setDraft] = useState<CustomSeparator>(() => editing ?? { id: `custom-${Date.now()}`, name: '', rule: 'none', mark: '❦', gold: false });
  const owned = !!editing;
  const clean = cleanSeparator(draft);

  const save = () => {
    if (!owned && !canMake()) return;
    saveCustomSeparator(clean);
    onDone();
  };

  return (
    <Frame title="Scene break workshop" blurb="Pick a line and type or pick an ornament." owned={owned} cost={MAKE_COST} saveLabel="Save scene break" editing={!!editing} onSave={save} onCancel={onDone}>
      <div className="sep-preview" style={{ padding: '12px 24px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }} dangerouslySetInnerHTML={{ __html: `<p style="text-align:center;font-size:0.8rem;color:var(--text-muted)">…and then she left.</p>${separatorHtml(clean.id, [clean])}<p style="text-align:center;font-size:0.8rem;color:var(--text-muted)">Morning came slowly.</p>` }} />
      <div>
        <div style={label}>Name</div>
        <input value={draft.name} maxLength={24} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="My scene break" aria-label="Scene break name" style={text} />
      </div>
      <div>
        <div style={label}>Line</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RULES.map(([r, name]) => <button key={r} onClick={() => setDraft(d => ({ ...d, rule: r }))} aria-pressed={draft.rule === r} style={chip(draft.rule === r)}>{name}</button>)}
        </div>
      </div>
      <div>
        <div style={label}>Ornament</div>
        <input value={draft.mark} maxLength={MAX_MARK} onChange={e => setDraft(d => ({ ...d, mark: e.target.value }))} placeholder="Leave empty for just the line" aria-label="Ornament" style={{ ...text, marginBottom: 8 }} />
        <Glyphs onPick={g => setDraft(d => ({ ...d, mark: (d.mark + g).slice(0, MAX_MARK) }))} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!draft.gold} onChange={e => setDraft(d => ({ ...d, gold: e.target.checked }))} /> Gold ornament
      </label>
    </Frame>
  );
};

const FRAMES: Array<[NonNullable<CustomFlourish['frame']> | 'none', string]> = [['none', 'No frame'], ['double', 'Double frame'], ['gilt', 'Gilt frame']];

export const FlourishWorkshop: React.FC<{ editing: CustomFlourish | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { canMake, saveCustomFlourish } = useAsterism();
  const [draft, setDraft] = useState<CustomFlourish>(() => editing ?? { id: `custom-${Date.now()}`, name: '', top: '❦ ✦ ❦', bottom: '', frame: undefined });
  // which line the ornament buttons add to
  const target = useRef<'top' | 'bottom'>('top');
  const owned = !!editing;
  const clean = cleanFlourish(draft);
  const accent = 'var(--accent-gold-text, var(--accent-gold))';

  const save = () => {
    if (!owned && !canMake()) return;
    saveCustomFlourish(clean);
    onDone();
  };

  return (
    <Frame title="Title page workshop" blurb="Ornaments above and below the title, and an optional frame." owned={owned} cost={MAKE_COST} saveLabel="Save flourish" editing={!!editing} onSave={save} onCancel={onDone}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 16, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ textAlign: 'center', minWidth: 180, color: 'var(--text-main)', ...flourishFrame(clean) }}>
          <div style={{ color: accent, minHeight: 20, letterSpacing: '0.3em' }}>{clean.top}</div>
          <div style={{ fontWeight: 700, fontSize: '1.3rem', letterSpacing: '0.04em' }}>Title</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>By You</div>
          <div style={{ color: accent, minHeight: 20, letterSpacing: '0.3em' }}>{clean.bottom}</div>
        </div>
      </div>
      <div>
        <div style={label}>Name</div>
        <input value={draft.name} maxLength={24} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="My flourish" aria-label="Flourish name" style={text} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={label}>Above the title</span>
          <input value={draft.top} maxLength={MAX_MARK} onFocus={() => { target.current = 'top'; }} onChange={e => setDraft(d => ({ ...d, top: e.target.value }))} style={text} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={label}>Below the author</span>
          <input value={draft.bottom} maxLength={MAX_MARK} onFocus={() => { target.current = 'bottom'; }} onChange={e => setDraft(d => ({ ...d, bottom: e.target.value }))} style={text} />
        </label>
      </div>
      <div>
        <div style={label}>Add an ornament to the line you last clicked</div>
        <Glyphs onPick={g => setDraft(d => ({ ...d, [target.current]: (d[target.current] + g).slice(0, MAX_MARK) }))} />
      </div>
      <div>
        <div style={label}>Frame</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FRAMES.map(([f, name]) => {
            const on = (draft.frame ?? 'none') === f;
            return <button key={f} onClick={() => setDraft(d => ({ ...d, frame: f === 'none' ? undefined : f }))} aria-pressed={on} style={chip(on)}>{name}</button>;
          })}
        </div>
      </div>
    </Frame>
  );
};
