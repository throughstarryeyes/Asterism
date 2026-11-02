import React, { useEffect, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { Chips, Color, MakerFrame, Row, text } from './MakerFrame';
import { chip } from './LoaderWorkshop';
import { PAIRINGS, cleanPairing, findPairing, type CustomPairing } from '../../services/pairings';
import { EDGE_LINES, EDGE_STYLES, MAX_INSET, MAX_SPACING, MIN_INSET, MIN_SPACING, PATTERNS, cleanEdge, cleanTexture, edgeLook, findEdge, findTexture, type CustomEdge, type CustomTexture, type EdgeLine, type EdgeStyle, type PatternKind } from '../../services/surfaces';
import { SKIN_HEADERS, SKIN_WINDOWS, cleanShelf, cleanSkin, findShelf, type CustomShelf, type CustomSkin, type SkinHeader, type SkinWindows } from '../../services/looks';
import { MAX_BUNDLE, cleanBundle, splitId, wornIds, type CustomBundle } from '../../services/bundles';
import { fontLoader } from '../../services/fontLoader';
import { SYSTEM_FONTS } from '../../services/systemFonts';

// the workshops for fonts, page textures, margins, window skins, badge shelves and bundles, and the small pictures that show them

const accent = 'var(--accent-gold-text, var(--accent-gold))';
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', fontSize: '0.74rem', color: 'var(--text-secondary)' };
const picker: React.CSSProperties = { width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' };

// ---- pictures ----

export const PairingMock: React.FC<{ id: string; custom?: CustomPairing[] }> = ({ id, custom }) => {
  const p = findPairing(id, custom);
  const head = p.heading || p.body;
  useEffect(() => { fontLoader.loadGoogleFont(p.body); if (p.heading) fontLoader.loadGoogleFont(p.heading); }, [p.body, p.heading]);
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-main)' }}>
      <div style={{ fontFamily: `"${head}", Georgia, serif`, fontSize: '1.3rem' }}>Chapter One</div>
      <div style={{ fontFamily: `"${p.body}", Georgia, serif`, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>The lamp had burned low.</div>
    </div>
  );
};

export const TextureMock: React.FC<{ id: string; custom?: CustomTexture[] }> = ({ id, custom }) => {
  const t = findTexture(id, custom);
  return <div style={{ width: '70%', height: 64, borderRadius: 6, border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', backgroundImage: t.image, backgroundSize: t.size }} />;
};

// the margin decorations are drawn by css keyed on data-edge, so a wrapper with the attribute shows the real thing
export const EdgeMock: React.FC<{ id: string; custom?: CustomEdge[] }> = ({ id, custom }) => {
  const mine = custom?.find(e => e.id === id);
  const look = mine ? edgeLook(mine) : null;
  const attrs = look ? { 'data-edge': look.attr } : findEdge(id).id === 'none' ? {} : { 'data-edge': id };
  return (
    <div {...attrs} style={{ width: '70%', ...(look?.vars as React.CSSProperties) }}>
      <div className="manuscript-page" style={{ height: 70, boxShadow: 'none' }} />
    </div>
  );
};

// how each skin draws the header bar, for the little preview (the real skins are in index.css)
const SKIN_BAR: Record<string, React.CSSProperties> = {
  plain: {},
  frosted: { backgroundColor: 'color-mix(in srgb, var(--bg-paper) 55%, transparent)', backdropFilter: 'blur(6px)' },
  gilded: { borderBottom: '3px double var(--accent-gold)' },
  inked: { borderBottom: '3px solid var(--text-main)' },
  floating: { margin: '4px 6px 0', borderRadius: 12, boxShadow: 'var(--shadow-md)' },
  glow: { boxShadow: '0 2px 14px color-mix(in srgb, var(--accent-gold) 45%, transparent)' },
  ruled: { backgroundImage: 'repeating-linear-gradient(transparent 0 6px, color-mix(in srgb, var(--accent-gold) 30%, transparent) 6px 7px)', borderBottom: '2px solid color-mix(in srgb, #c0504d 55%, transparent)' },
  brass: { backgroundImage: 'linear-gradient(180deg, #e9c46a, #b88a2a 55%, #8a6414)', borderBottom: '2px solid #6b4a0e' },
};

function madeBar(s: CustomSkin): React.CSSProperties {
  const c = s.color === 'accent' ? 'var(--accent-gold)' : s.color;
  const bar: React.CSSProperties = {};
  if (s.header === 'rule') bar.borderBottom = `2px solid ${c}`;
  if (s.header === 'double') bar.borderBottom = `3px double ${c}`;
  if (s.header === 'thick') bar.borderBottom = `4px solid ${c}`;
  if (s.header === 'glow') bar.boxShadow = `0 2px 14px color-mix(in srgb, ${c} 45%, transparent)`;
  if (s.header === 'band') bar.backgroundImage = `linear-gradient(180deg, color-mix(in srgb, ${c} 30%, transparent), transparent)`;
  if (s.floating) Object.assign(bar, { margin: '4px 6px 0', borderRadius: 12, boxShadow: bar.boxShadow ?? 'var(--shadow-md)' });
  return bar;
}

function madeWindow(s: CustomSkin): React.CSSProperties {
  const c = s.color === 'accent' ? 'var(--accent-gold)' : s.color;
  if (s.windows === 'outline') return { outline: `1px solid color-mix(in srgb, ${c} 60%, transparent)`, outlineOffset: -3 };
  if (s.windows === 'shadow') return { boxShadow: '4px 4px 0 var(--border-strong)' };
  if (s.windows === 'glow') return { boxShadow: `0 0 14px color-mix(in srgb, ${c} 35%, transparent)` };
  if (s.windows === 'frost') return { backdropFilter: 'blur(6px)' };
  return {};
}

export const SkinMock: React.FC<{ id: string; custom?: CustomSkin[] }> = ({ id, custom }) => {
  const mine = custom?.find(s => s.id === id);
  return (
    <div style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border-subtle)', overflow: 'hidden', backgroundColor: 'var(--bg-app)' }}>
      <div style={{ height: 20, backgroundColor: 'var(--toolbar-bg)', borderBottom: '1px solid var(--border-subtle)', ...(mine ? madeBar(mine) : SKIN_BAR[id]) }} />
      <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mine && <div style={{ width: '50%', height: 20, borderRadius: 4, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', ...madeWindow(mine) }} />}
      </div>
    </div>
  );
};

export const ShelfMock: React.FC<{ id: string; custom?: CustomShelf[] }> = ({ id, custom }) => {
  const s = findShelf(id, custom);
  return (
    <div style={{ width: '82%', background: s.case, border: `1px solid ${s.edge}`, borderRadius: 8, padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'var(--accent-gold)', opacity: i === 2 ? 0.35 : 1, border: i === 2 ? '1px dashed currentColor' : 'none', color: s.label }} />)}
      </div>
      <div style={{ height: 6, borderRadius: 2, background: s.plank }} />
    </div>
  );
};

// ---- workshops ----

const FONT_SUGGESTIONS = [...new Set([...SYSTEM_FONTS, ...PAIRINGS.flatMap(p => [p.body, p.heading]).filter(Boolean)])];

export const PairingWorkshop: React.FC<{ editing: CustomPairing | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { makeMine } = useAsterism();
  const [draft, setDraft] = useState<CustomPairing>(() => editing ?? { id: `custom-${Date.now()}`, name: '', body: 'Lora', heading: '' });
  const set = (patch: Partial<CustomPairing>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanPairing(draft);
  return (
    <MakerFrame title="Font workshop" blurb="Name any Google font for the writing and one for titles. They load when you are online." saveLabel="Save fonts" editing={!!editing}
      onSave={() => { makeMine('pairing', { ...clean, name: draft.name.trim() || 'My fonts' }); onDone(); }} onCancel={onDone}>
      <div style={{ padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center' }}><PairingMock id={clean.id} custom={[clean]} /></div>
      <datalist id="font-suggestions">{FONT_SUGGESTIONS.map(f => <option key={f} value={f} />)}</datalist>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My fonts" aria-label="Fonts name" style={text} /></Row>
      <Row name="Font for the writing"><input list="font-suggestions" value={draft.body} onChange={e => set({ body: e.target.value })} aria-label="Body font" style={text} /></Row>
      <Row name="Font for titles (empty keeps your theme's)"><input list="font-suggestions" value={draft.heading} onChange={e => set({ heading: e.target.value })} aria-label="Title font" style={text} /></Row>
    </MakerFrame>
  );
};

export const TextureWorkshop: React.FC<{ editing: CustomTexture | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { makeMine } = useAsterism();
  const [draft, setDraft] = useState<CustomTexture>(() => editing ?? { id: `custom-${Date.now()}`, name: '', pattern: 'lines', color: 'ink', strength: 2, spacing: 28 });
  const set = (patch: Partial<CustomTexture>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanTexture(draft);
  const spaced = clean.pattern !== 'grain' && clean.pattern !== 'wash';
  return (
    <MakerFrame title="Page texture workshop" blurb="Lay a pattern over the paper." saveLabel="Save texture" editing={!!editing}
      onSave={() => { makeMine('texture', { ...clean, name: draft.name.trim() || 'My texture' }); onDone(); }} onCancel={onDone}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}><TextureMock id={clean.id} custom={[clean]} /></div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My texture" aria-label="Texture name" style={text} /></Row>
      <Row name="Pattern"><Chips options={Object.entries(PATTERNS) as Array<[PatternKind, string]>} value={clean.pattern} onPick={pattern => set({ pattern })} /></Row>
      <Row name="Strength"><Chips options={[[1, 'Faint'], [2, 'Clear'], [3, 'Bold']] as Array<[1 | 2 | 3, string]>} value={clean.strength} onPick={strength => set({ strength })} /></Row>
      {spaced && (
        <label style={fieldLabel}>Spacing: {clean.spacing}px
          <input type="range" min={MIN_SPACING} max={MAX_SPACING} value={draft.spacing} onChange={e => set({ spacing: Number(e.target.value) })} /></label>
      )}
      <Row name="Color">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => set({ color: 'ink' })} aria-pressed={clean.color === 'ink'} style={chip(clean.color === 'ink')}>Text color</button>
          <Color value={clean.color} onPick={color => set({ color })} />
        </div>
      </Row>
    </MakerFrame>
  );
};

const EDGE_GLYPHS = ['❦', '❧', '✦', '✿', '❄', '☀', '♡', '☾', '⚜', '❖', '•', '◆'];

export const EdgeWorkshop: React.FC<{ editing: CustomEdge | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { makeMine } = useAsterism();
  const [draft, setDraft] = useState<CustomEdge>(() => editing ?? { id: `custom-${Date.now()}`, name: '', style: 'border', line: 'solid', glyph: '❦', color: 'accent', inset: 12 });
  const set = (patch: Partial<CustomEdge>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanEdge(draft);
  const marks = clean.style === 'corners' || clean.style === 'rows';
  return (
    <MakerFrame title="Margin workshop" blurb="Decorate the edges of the page." saveLabel="Save margin" editing={!!editing}
      onSave={() => { makeMine('edge', { ...clean, name: draft.name.trim() || 'My margin' }); onDone(); }} onCancel={onDone}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}><EdgeMock id={clean.id} custom={[clean]} /></div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My margin" aria-label="Margin name" style={text} /></Row>
      <Row name="What it is"><Chips options={Object.entries(EDGE_STYLES) as Array<[EdgeStyle, string]>} value={clean.style} onPick={style => set({ style })} /></Row>
      {!marks && <Row name="Line"><Chips options={Object.entries(EDGE_LINES) as Array<[EdgeLine, string]>} value={clean.line} onPick={line => set({ line })} /></Row>}
      {marks && (
        <Row name="Mark">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {EDGE_GLYPHS.map(g => <button key={g} onClick={() => set({ glyph: g })} aria-pressed={clean.glyph === g} aria-label={`Use ${g}`} style={{ ...chip(clean.glyph === g), padding: '2px 9px', fontSize: '0.95rem' }}>{g}</button>)}
            <input value={draft.glyph} onChange={e => set({ glyph: Array.from(e.target.value).slice(-1).join('') })} aria-label="Your own mark" style={{ ...text, width: 70 }} />
          </div>
        </Row>
      )}
      <label style={fieldLabel}>Distance from the edge: {clean.inset}px
        <input type="range" min={MIN_INSET} max={MAX_INSET} value={draft.inset} onChange={e => set({ inset: Number(e.target.value) })} /></label>
      <Row name="Color"><Color value={clean.color} onPick={color => set({ color })} /></Row>
    </MakerFrame>
  );
};

export const SkinWorkshop: React.FC<{ editing: CustomSkin | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { makeMine } = useAsterism();
  const [draft, setDraft] = useState<CustomSkin>(() => editing ?? { id: `custom-${Date.now()}`, name: '', header: 'rule', windows: 'plain', floating: false, color: 'accent' });
  const set = (patch: Partial<CustomSkin>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanSkin(draft);
  return (
    <MakerFrame title="Window skin workshop" blurb="Dress the header bar and the windows." saveLabel="Save skin" editing={!!editing}
      onSave={() => { makeMine('skin', { ...clean, name: draft.name.trim() || 'My skin' }); onDone(); }} onCancel={onDone}>
      <div style={{ padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}><SkinMock id={clean.id} custom={[clean]} /></div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My skin" aria-label="Skin name" style={text} /></Row>
      <Row name="Header bar"><Chips options={Object.entries(SKIN_HEADERS) as Array<[SkinHeader, string]>} value={clean.header} onPick={header => set({ header })} /></Row>
      <Row name="Windows"><Chips options={Object.entries(SKIN_WINDOWS) as Array<[SkinWindows, string]>} value={clean.windows} onPick={windows => set({ windows })} /></Row>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={draft.floating} onChange={e => set({ floating: e.target.checked })} /> Let the header float, with rounded corners
      </label>
      <Row name="Color"><Color value={clean.color} onPick={color => set({ color })} /></Row>
    </MakerFrame>
  );
};

export const ShelfWorkshop: React.FC<{ editing: CustomShelf | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { makeMine } = useAsterism();
  const [draft, setDraft] = useState<CustomShelf>(() => editing ?? { id: `custom-${Date.now()}`, name: '', top: '#f2e6cf', bottom: '#e4d1ac', plank: '#a9743f', label: '#4a3320' });
  const set = (patch: Partial<CustomShelf>) => setDraft(d => ({ ...d, ...patch }));
  const clean = cleanShelf(draft);
  const pick = (name: string, key: 'top' | 'bottom' | 'plank' | 'label') => (
    <label style={{ ...fieldLabel, alignItems: 'flex-start', gap: 4 }}>{name}
      <input type="color" value={clean[key]} onChange={e => set({ [key]: e.target.value })} aria-label={name} style={picker} /></label>
  );
  return (
    <MakerFrame title="Badge shelf workshop" blurb="Choose the wall, the wood and the writing." saveLabel="Save shelf" editing={!!editing}
      onSave={() => { makeMine('shelf', { ...clean, name: draft.name.trim() || 'My shelf' }); onDone(); }} onCancel={onDone}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 12, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}><ShelfMock id={clean.id} custom={[clean]} /></div>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => set({ name: e.target.value })} placeholder="My shelf" aria-label="Shelf name" style={text} /></Row>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {pick('Wall, top', 'top')}{pick('Wall, bottom', 'bottom')}{pick('Ledge', 'plank')}{pick('Text', 'label')}
      </div>
    </MakerFrame>
  );
};

export const BundleWorkshop: React.FC<{ editing: CustomBundle | null; onDone: () => void }> = ({ editing, onDone }) => {
  const { makeMine, userStats } = useAsterism();
  const worn = wornIds(userStats);
  const [draft, setDraft] = useState<CustomBundle>(() => editing ?? { id: `custom-${Date.now()}`, name: '', items: worn });
  const clean = cleanBundle(draft);
  const toggle = (id: string) => setDraft(d => ({ ...d, items: d.items.includes(id) ? d.items.filter(x => x !== id) : d.items.length >= MAX_BUNDLE ? d.items : [...d.items, id] }));
  // what the bundle already holds, plus what is worn now
  const choices = [...new Set([...draft.items, ...worn])];
  return (
    <MakerFrame title="Bundle workshop" blurb="Save the looks you are wearing now so one press brings them all back." saveLabel="Save bundle" editing={!!editing}
      onSave={() => { if (clean.items.length) { makeMine('bundle', { ...clean, name: draft.name.trim() || 'My bundle' }); onDone(); } }} onCancel={onDone}>
      <Row name="Name"><input value={draft.name} maxLength={24} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="My bundle" aria-label="Bundle name" style={text} /></Row>
      <Row name="Looks to include">
        {choices.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Wear a texture, margin, trail, cover or other look first, then come back.</span> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {choices.map(id => {
              const { category, value } = splitId(id);
              return <button key={id} onClick={() => toggle(id)} aria-pressed={draft.items.includes(id)} style={chip(draft.items.includes(id))}>{category}: {value.replace(/^custom-\d+$/, 'made by you')}</button>;
            })}
          </div>
        )}
      </Row>
      <span style={{ fontSize: '0.74rem', color: accent }}>{clean.items.length} of {MAX_BUNDLE} chosen</span>
    </MakerFrame>
  );
};
