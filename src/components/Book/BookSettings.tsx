import React, { useState } from 'react';
import { BOOK_FONTS, MARGINS, PAPERS, TRIMS, type BookDesign, type ChapterStart, type ChapterStyle, type NumberPlace, type RunningHead } from '../../services/book/design';
import { ImagePlus, X } from 'lucide-react';

const field: React.CSSProperties = { padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.82rem', width: '100%' };
const cap: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 };
const pill = (on: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', cursor: 'pointer', fontWeight: on ? 700 : 500, backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)' });

// a number box that takes what you type when you leave it, so half-typed values never jump around
export const Num: React.FC<{ label: string; value: number; step?: number; unit?: string; onCommit: (n: number) => void }> = ({ label, value, step = 0.05, unit = 'in', onCommit }) => {
  const [text, setText] = useState(String(value));
  // follow the setting when it changes somewhere else, without an effect
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setText(String(value)); }
  const commit = () => { const n = parseFloat(text); if (Number.isFinite(n)) onCommit(n); else setText(String(value)); };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
      {label}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" inputMode="decimal" step={step} value={text} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} style={field} />
        <span style={{ color: 'var(--text-muted)' }}>{unit}</span>
      </span>
    </label>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
    <h3 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
    {children}
  </section>
);

function Choice<T extends string>({ value, options, onPick, label }: { value: T; options: Array<[T, string]>; onPick: (v: T) => void; label: string }) {
  return (
    <div>
      <div style={cap}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {options.map(([v, name]) => <button key={v} onClick={() => onPick(v)} aria-pressed={value === v} style={pill(value === v)}>{name}</button>)}
      </div>
    </div>
  );
}

const Check: React.FC<{ label: string; on: boolean; onChange: (v: boolean) => void }> = ({ label, on, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
    <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} /> {label}
  </label>
);

export const BookSettings: React.FC<{
  design: BookDesign;
  writingFont: string;
  customFonts: string[];
  hasCoverImage: boolean;
  onChange: (patch: Partial<BookDesign>) => void;
  onCoverFile: (file: File) => void;
  onClearCover: () => void;
  onClose: () => void;
}> = ({ design, writingFont, customFonts, hasCoverImage, onChange, onCoverFile, onClearCover, onClose }) => {
  const trim = TRIMS.find(t => t.id === design.trim);
  const marginPreset = MARGINS.find(m => m.inside === design.inside && m.outside === design.outside && m.top === design.top && m.bottom === design.bottom);
  const fonts = [...BOOK_FONTS, ...customFonts.filter(f => !BOOK_FONTS.includes(f))];

  return (
    <aside aria-label="Book layout" style={{ width: 320, flexShrink: 0, height: '100%', overflowY: 'auto', padding: '16px 18px 40px', backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: '1rem', color: 'var(--text-main)' }}>Book layout</h2>
        <button onClick={onClose} aria-label="Close layout" style={{ display: 'flex', padding: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
      </div>

      <Section title="Page size">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          Trim size
          <select value={design.trim} onChange={e => onChange({ trim: e.target.value })} style={field}>
            {TRIMS.map(t => <option key={t.id} value={t.id}>{t.name}{t.id !== 'custom' ? ` · ${t.note}` : ''}</option>)}
          </select>
        </label>
        {design.trim === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Num label="Width" value={design.width} onCommit={width => onChange({ width })} />
            <Num label="Height" value={design.height} onCommit={height => onChange({ height })} />
          </div>
        )}
        {trim && design.trim !== 'custom' && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{design.width} × {design.height} inches. Pick Custom size for your own.</div>}
      </Section>

      <Section title="Margins">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {MARGINS.map(m => <button key={m.id} onClick={() => onChange({ inside: m.inside, outside: m.outside, top: m.top, bottom: m.bottom })} aria-pressed={marginPreset?.id === m.id} style={pill(marginPreset?.id === m.id)}>{m.name}</button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Num label="Inside (gutter)" value={design.inside} onCommit={inside => onChange({ inside })} />
          <Num label="Outside" value={design.outside} onCommit={outside => onChange({ outside })} />
          <Num label="Top" value={design.top} onCommit={top => onChange({ top })} />
          <Num label="Bottom" value={design.bottom} onCommit={bottom => onChange({ bottom })} />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>The inside margin sits next to the spine. It is wider so words never vanish into the binding.</div>
      </Section>

      <Section title="Type">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          Font
          <select value={design.font} onChange={e => onChange({ font: e.target.value })} style={field}>
            <option value="">My writing font ({writingFont})</option>
            {fonts.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Num label="Size" unit="pt" step={0.5} value={design.fontSize} onCommit={fontSize => onChange({ fontSize })} />
          <Num label="Spacing" unit="×" step={0.05} value={design.lineHeight} onCommit={lineHeight => onChange({ lineHeight })} />
          <Num label="Indent" unit="em" step={0.1} value={design.indent} onCommit={indent => onChange({ indent })} />
        </div>
        <Check label="Justify the text (straight right edge)" on={design.justify} onChange={justify => onChange({ justify })} />
        <Check label="Hyphenate long words" on={design.hyphenate} onChange={hyphenate => onChange({ hyphenate })} />
        <Check label="Drop cap on chapter openings" on={design.dropCap} onChange={dropCap => onChange({ dropCap })} />
      </Section>

      <Section title="Chapters">
        <Choice<ChapterStart> label="Each chapter starts" value={design.chapterStart} onPick={chapterStart => onChange({ chapterStart })}
          options={[['any', 'Anywhere'], ['new', 'On a new page'], ['right', 'On a right-hand page']]} />
        <Choice<ChapterStyle> label="Heading" value={design.chapterStyle} onPick={chapterStyle => onChange({ chapterStyle })}
          options={[['numbered', 'Chapter 1 + title'], ['title', 'Title only'], ['number', 'Number only']]} />
        <Num label="Space above the heading" value={design.sink} step={0.1} onCommit={sink => onChange({ sink })} />
      </Section>

      <Section title="Page extras">
        <Choice<RunningHead> label="Running head" value={design.head} onPick={head => onChange({ head })}
          options={[['none', 'None'], ['title', 'Title'], ['author-title', 'Author / title']]} />
        <Choice<NumberPlace> label="Page numbers" value={design.numbers} onPick={numbers => onChange({ numbers })}
          options={[['none', 'None'], ['center', 'Centered'], ['outside', 'Outside corner']]} />
      </Section>

      <Section title="Front matter">
        <Check label="Contents page" on={design.toc} onChange={toc => onChange({ toc })} />
        <Check label="Copyright page" on={design.copyright} onChange={copyright => onChange({ copyright })} />
        {design.copyright && (
          <textarea value={design.copyrightText} onChange={e => onChange({ copyrightText: e.target.value })} rows={3} placeholder="© 2026 Your Name. All rights reserved." aria-label="Copyright text" style={{ ...field, resize: 'vertical' }} />
        )}
        <div>
          <div style={cap}>Dedication</div>
          <textarea value={design.dedication} onChange={e => onChange({ dedication: e.target.value })} rows={2} placeholder="For anyone who kept the lamp on." aria-label="Dedication" style={{ ...field, resize: 'vertical' }} />
        </div>
      </Section>

      <Section title="Cover">
        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
          {hasCoverImage ? 'Using your cover picture.' : 'Using your cover look from the shop, with your title and name. Add a picture to use your own.'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ ...pill(false), display: 'flex', alignItems: 'center', gap: 6 }}>
            <ImagePlus size={13} /> {hasCoverImage ? 'Change picture' : 'Add a cover picture'}
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCoverFile(f); }} />
          </label>
          {hasCoverImage && <button onClick={onClearCover} style={pill(false)}>Remove</button>}
        </div>
      </Section>

      <Section title="Paper">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PAPERS.map(p => (
            <button key={p.id} onClick={() => onChange({ paper: p.id })} aria-pressed={design.paper === p.id} title={p.name}
              style={{ width: 54, padding: '6px 4px', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: design.paper === p.id ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)', background: p.page, color: p.ink, fontSize: '0.64rem', fontWeight: 600 }}>
              Aa<br />{p.name}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paper color is for reading on screen. A PDF always prints white pages with dark ink.</div>
      </Section>

      <Section title="PDF">
        <Check label="Put the cover in the PDF" on={design.printCover} onChange={printCover => onChange({ printCover })} />
      </Section>
    </aside>
  );
};
