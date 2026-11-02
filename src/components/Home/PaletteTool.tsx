import React, { useEffect, useMemo, useState } from 'react';
import { DialogFrame } from '../Common/DialogFrame';
import { useAsterism } from '../../context/AsterismContext';
import { MAX_COLORS, MIN_COLORS, SCHEMES, STARTER_PALETTES, bestText, cleanPalette, dominantColors, harmony, hexToHsl, newPaletteId, shuffle, themeFromPalette, toCssVars, toHexList, type Palette, type SchemeId } from '../../services/palettes';
import { Copy, ImagePlus, Lock, Plus, Shuffle, Trash2, Unlock, X } from 'lucide-react';

// a hex box that takes what you type when you leave it, so a half-typed value never changes the color
const HexBox: React.FC<{ value: string; color: string; label: string; onCommit: (hex: string) => void }> = ({ value, color, label, onCommit }) => {
  const [text, setText] = useState(value.toUpperCase());
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); setText(value.toUpperCase()); }
  const commit = () => {
    const t = text.trim().replace(/^#?/, '#');
    if (/^#[0-9a-f]{6}$/i.test(t)) onCommit(t.toLowerCase());
    else if (/^#[0-9a-f]{3}$/i.test(t)) onCommit(('#' + t.slice(1).split('').map(ch => ch + ch).join('')).toLowerCase());
    else setText(value.toUpperCase());
  };
  return (
    <input value={text} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
      aria-label={label} spellCheck={false} maxLength={7}
      style={{ position: 'relative', zIndex: 2, width: '88%', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 0' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'currentColor'; e.currentTarget.select(); }} onBlurCapture={e => { e.currentTarget.style.borderColor = 'transparent'; }} />
  );
};

const chip = (on: boolean): React.CSSProperties => ({ padding: '4px 11px', borderRadius: 'var(--radius-full)', fontSize: '0.76rem', cursor: 'pointer', fontWeight: on ? 700 : 500, backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)' });
const field: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '0.84rem', width: '100%' };
const cap: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' };

// a few colors, to see what goes together. build one from a color, shuffle, pull one from a picture, and keep the ones you like.
export const PaletteTool: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userStats, project, savePalette, deletePalette, saveCustomTheme, showToast } = useAsterism();
  const [colors, setColors] = useState<string[]>(() => harmony('#c9622b', 'analogous', 5));
  const [kept, setKept] = useState<boolean[]>(() => Array(5).fill(false));
  const [scheme, setScheme] = useState<SchemeId>('analogous');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [forStory, setForStory] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const saved = useMemo(() => userStats.customPalettes ?? [], [userStats.customPalettes]);

  const setAll = (next: string[]) => { setColors(next); setKept(k => next.map((_, i) => k[i] ?? false)); };
  const reroll = () => setAll(shuffle(colors, kept));
  const build = (base: string, s: SchemeId = scheme) => setAll(harmony(base, s, colors.length));
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); showToast(`Copied ${what}`, 'success'); } catch { showToast('Could not copy that.', 'info'); } };

  // space shuffles, the way it does in most palette tools
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(t.tagName)) { e.preventDefault(); reroll(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const fromPicture = async (file: File) => {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 160 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const found = dominantColors(ctx.getImageData(0, 0, canvas.width, canvas.height).data, Math.max(MIN_COLORS, colors.length));
      if (found.length >= MIN_COLORS) { setAll(found); setKept(Array(found.length).fill(false)); } else showToast('That picture has too few colors to make a palette from.', 'info');
    } catch { showToast('Could not read that picture.', 'info'); }
  };

  const save = () => {
    const id = editing ?? newPaletteId();
    savePalette(cleanPalette({ id, name: name.trim() || 'My palette', colors, notes, projectId: forStory ? project.id : undefined }));
    setEditing(null); setName(''); setNotes(''); setForStory(false);
  };
  const load = (p: Palette) => { setColors(p.colors); setKept(p.colors.map(() => false)); setName(p.name); setNotes(p.notes); setEditing(p.id); setForStory(p.projectId === project.id); };
  const makeTheme = (dark: boolean) => { saveCustomTheme(themeFromPalette(colors, { name: name.trim() || (dark ? 'Palette theme (dark)' : 'Palette theme'), dark })); };

  const forThis = useMemo(() => saved.filter(p => p.projectId === project.id), [saved, project.id]);
  const rest = useMemo(() => saved.filter(p => p.projectId !== project.id), [saved, project.id]);
  const row = (p: Palette) => (
    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-md)', border: editing === p.id ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
      <button onClick={() => load(p)} aria-label={`Open ${p.name}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
        <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden' }}>{p.colors.map((c, i) => <span key={i} style={{ flex: 1, backgroundColor: c }} />)}</div>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
      </button>
      <button onClick={() => deletePalette(p.id)} aria-label={`Delete ${p.name}`} style={{ display: 'flex', color: 'var(--text-secondary)', cursor: 'pointer' }}><Trash2 size={14} /></button>
    </div>
  );

  return (
    <DialogFrame label="Color palettes" onClose={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: 940, maxHeight: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-subtle)', padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: '1.15rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>Color palettes</h2>
          <button onClick={onClose} aria-label="Close" title="Close (Esc)" style={{ display: 'flex', padding: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', minHeight: 170, border: '1px solid var(--border-subtle)' }}>
          {colors.map((c, i) => {
            const text = bestText(c);
            return (
              <div key={i} style={{ position: 'relative', flex: 1, minWidth: 0, backgroundColor: c, color: text, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', gap: 6 }}>
                {/* the whole swatch opens the color picker; the buttons and the hex box sit above it */}
                <input type="color" value={c} onChange={e => setColors(cs => cs.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Pick color ${i + 1}`} title="Click to change this color"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0, zIndex: 1 }} />
                <button style={{ position: 'relative', zIndex: 2, display: 'flex', color: text, cursor: 'pointer', opacity: kept[i] ? 1 : 0.55 }} onClick={() => setKept(k => k.map((v, j) => (j === i ? !v : v)))} aria-pressed={kept[i]} aria-label={kept[i] ? `Unlock color ${i + 1}` : `Keep color ${i + 1} when shuffling`} title={kept[i] ? 'Kept when you shuffle' : 'Keep this one when you shuffle'}>{kept[i] ? <Lock size={15} /> : <Unlock size={15} />}</button>
                <span style={{ position: 'relative', zIndex: 0, fontSize: '0.72rem', opacity: 0.75, pointerEvents: 'none' }}>click to change</span>
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, width: '100%' }}>
                  <HexBox value={c} color={text} label={`Hex value of color ${i + 1}`} onCommit={hex => setColors(cs => cs.map((x, j) => (j === i ? hex : x)))} />
                  <button onClick={() => copy(c.toUpperCase(), c.toUpperCase())} aria-label={`Copy ${c.toUpperCase()}`} title="Copy" style={{ display: 'flex', color: text, opacity: 0.7, cursor: 'pointer' }}><Copy size={12} /></button>
                </div>
                <span style={{ position: 'relative', zIndex: 0, fontSize: '0.64rem', opacity: 0.75, pointerEvents: 'none' }}>{(() => { const h = hexToHsl(c); return `${h.h}° ${h.s}% ${h.l}%`; })()}</span>
                {colors.length > MIN_COLORS && <button onClick={() => { setColors(cs => cs.filter((_, j) => j !== i)); setKept(k => k.filter((_, j) => j !== i)); }} aria-label={`Remove color ${i + 1}`} style={{ position: 'relative', zIndex: 2, display: 'flex', color: text, opacity: 0.6, cursor: 'pointer' }}><X size={13} /></button>}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={reroll} style={{ ...chip(true), display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}><Shuffle size={14} /> Shuffle <span style={{ opacity: 0.6, fontWeight: 400 }}>(space)</span></button>
          {colors.length < MAX_COLORS && <button onClick={() => { setColors(cs => [...cs, harmony(cs[0], scheme, cs.length + 1)[cs.length]]); setKept(k => [...k, false]); }} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={13} /> Add a color</button>}
          <label style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 6 }}><ImagePlus size={13} /> From a picture
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void fromPicture(f); }} />
          </label>
          <button onClick={() => copy(toHexList(colors), 'the colors')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 5 }}><Copy size={13} /> Copy colors</button>
          <button onClick={() => copy(toCssVars(colors), 'as CSS')} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 5 }}><Copy size={13} /> Copy as CSS</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={cap}>Build from a color</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={colors[0]} onChange={e => build(e.target.value)} aria-label="Base color" style={{ width: 40, height: 32, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>The first color is the base. Everything else is built around it.</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SCHEMES.map(s => <button key={s.id} onClick={() => { setScheme(s.id); build(colors[0], s.id); }} aria-pressed={scheme === s.id} title={s.blurb} style={chip(scheme === s.id)}>{s.name}</button>)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{SCHEMES.find(s => s.id === scheme)?.blurb}</div>

            <div style={cap}>Or start from a mood</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {STARTER_PALETTES.map(p => (
                <button key={p.name} onClick={() => { setAll(p.colors); setKept(p.colors.map(() => false)); }} style={{ ...chip(false), display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'flex', height: 12, width: 38, borderRadius: 3, overflow: 'hidden' }}>{p.colors.map((c, i) => <span key={i} style={{ flex: 1, backgroundColor: c }} />)}</span>{p.name}
                </button>
              ))}
            </div>

            <div style={cap}>See it as text</div>
            <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              {colors.map((c, i) => <div key={i} style={{ flex: 1, backgroundColor: c, color: bestText(c), padding: '10px 6px', fontSize: '0.78rem', fontFamily: 'var(--font-display)', textAlign: 'center' }}>Aa</div>)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={cap}>Keep it</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Name this palette" maxLength={40} aria-label="Palette name" style={field} />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes: where it is used, what it should feel like" aria-label="Palette notes" style={{ ...field, resize: 'vertical' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={forStory} onChange={e => setForStory(e.target.checked)} /> This is for “{project.title}”
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={save} style={{ ...chip(true), padding: '6px 16px' }}>{editing ? 'Update palette' : 'Save palette'}</button>
              {editing && <button onClick={() => { setEditing(null); setName(''); setNotes(''); }} style={chip(false)}>Save as new instead</button>}
            </div>
            <div style={cap}>Make a theme from it</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => makeTheme(false)} style={chip(false)}>Light theme</button>
              <button onClick={() => makeTheme(true)} style={chip(false)}>Dark theme</button>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>A new theme costs the usual 75 QP. You can change every color after.</span>
            </div>
          </div>
        </div>

        {saved.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={cap}>Saved palettes</div>
            {forThis.length > 0 && <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>For this story</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>{forThis.map(row)}</div>
            {forThis.length > 0 && rest.length > 0 && <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Everything else</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>{rest.map(row)}</div>
          </div>
        )}
      </div>
    </DialogFrame>
  );
};
