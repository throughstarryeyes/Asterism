import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { LoaderArt } from '../Common/Loader';
import { BadgeShelf } from '../Common/BadgeShelf';
import { TrailPad } from '../Common/CursorTrail';
import { LoaderWorkshop } from './LoaderWorkshop';
import { FlourishWorkshop, SeparatorWorkshop } from './OrnamentWorkshops';
import { ShapeSample, ShapeWorkshop, TrailWorkshop } from './LookWorkshops';
import { ChimeAssign, ChimeWorkshop } from './SoundWorkshops';
import type { Tab } from '../Header/ThemeSelectorModal';
import { CATEGORIES, TIERS } from '../../services/shop';
import { findLoader } from '../../services/loaders';
import { findFlourish, flourishFrame, separatorHtml } from '../../services/ornaments';
import { findTrail } from '../../services/trails';
import { findChime, type ChimeConfig } from '../../services/chimes';
import { findShape, type ShapeConfig } from '../../services/shapes';
import type { CustomCover, CustomShelf, CustomSkin } from '../../services/looks';
import type { CustomEdge, CustomTexture } from '../../services/surfaces';
import type { CustomPairing } from '../../services/pairings';
import type { CustomBundle } from '../../services/bundles';
import { findCelebration, type CelebrationConfig } from '../../services/celebrations';
import { CoverMock, CoverWorkshop } from './CoverWorkshop';
import { BundleWorkshop, EdgeMock, EdgeWorkshop, PairingMock, PairingWorkshop, ShelfMock, ShelfWorkshop, SkinMock, SkinWorkshop, TextureMock, TextureWorkshop } from './MoreWorkshops';
import { CelebrationWorkshop, ConfettiSample } from './CelebrationWorkshop';
import { PAIRINGS, pairingFor } from '../../services/pairings';
import { SEASONS, inSeason } from '../../services/seasons';
import { findThemePreset } from '../../services/themePresets';
import { builtinAsTheme, findBuiltinTheme } from '../../services/builtinThemes';
import { previewStyle } from '../../services/backdrops';
import { fontLoader } from '../../services/fontLoader';
import type { CosmeticItem, CustomFlourish, CustomSeparator, KeystrokeSound, LoaderConfig } from '../../types';
import type { TrailConfig } from '../../services/trails';
import { Lock, Pencil, Share2, Trash2, Volume2 } from 'lucide-react';
import { MADE, type MadeKind } from '../../services/made';
import { canShare, parseShared, shareFile } from '../../services/shareMade';
import { storageService } from '../../services/storage';

type Category = CosmeticItem['category'];

const tail = (id: string) => id.slice(id.indexOf('-') + 1);
const accent = 'var(--accent-gold-text, var(--accent-gold))';

const FlourishMini: React.FC<{ f: ReturnType<typeof findFlourish> }> = ({ f }) => (
  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-main)', width: '78%', ...flourishFrame(f), padding: f.frame ? '10px 6px' : 0 }}>
    <div style={{ color: accent, minHeight: 12 }}>{f.top}</div>
    <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>Title</div>
    <div style={{ color: 'var(--text-secondary)' }}>By You</div>
    <div style={{ color: accent, minHeight: 12 }}>{f.bottom}</div>
  </div>
);

// a theme from the shop: the app behind, and a page with a line of text on it
const ThemeMock: React.FC<{ id: string }> = ({ id }) => {
  const t = (findThemePreset(id)?.theme ?? builtinAsTheme(id))!;
  // the notebook themes have their own paper
  const rule = `color-mix(in srgb, ${t.textSecondary} 30%, transparent)`;
  const paper = t.paperStyle === 'lined' ? { backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 9px, ${rule} 9px 10px)` }
    : t.paperStyle === 'grid' ? { backgroundImage: `linear-gradient(to right, ${rule} 1px, transparent 1px), linear-gradient(to bottom, ${rule} 1px, transparent 1px)`, backgroundSize: '10px 10px' }
      : t.paperStyle === 'dots' ? { backgroundImage: `radial-gradient(circle, ${rule} 1px, transparent 1.2px)`, backgroundSize: '9px 9px' } : {};
  return (
    <div style={{ width: '88%', height: 78, borderRadius: 8, border: `1px solid ${t.borderSubtle}`, backgroundColor: t.bgApp, ...previewStyle(t.appLook), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '62%', height: '72%', borderRadius: 4, border: `1px solid ${t.borderStrong}`, padding: '6px 8px', backgroundColor: t.pageLook?.glass ? `color-mix(in srgb, ${t.bgPaper} 48%, transparent)` : t.bgPaper, backdropFilter: t.pageLook?.glass ? 'blur(6px)' : undefined, ...paper, ...previewStyle(t.pageLook), borderLeft: t.marginLine ? `3px solid ${t.marginColor ?? t.accentPrimary}` : undefined, color: t.textMain, fontSize: '0.62rem', lineHeight: 1.3 }}>
        <div style={{ fontWeight: 700 }}>Chapter One</div>
        <div style={{ color: t.textSecondary }}>The lamp flickered twice.</div>
        <div style={{ marginTop: 3, height: 5, width: '40%', borderRadius: 3, backgroundColor: t.accentPrimary }} />
      </div>
    </div>
  );
};

// a small taste of the item, drawn the way it will look
const Preview: React.FC<{ item: CosmeticItem; custom: { chimes: ChimeConfig[]; trails: TrailConfig[]; covers: CustomCover[]; confetti: CelebrationConfig[]; pairings: CustomPairing[]; textures: CustomTexture[]; edges: CustomEdge[]; skins: CustomSkin[]; shelves: CustomShelf[] } }> = ({ item, custom }) => {
  const key = tail(item.id);
  if (item.category === 'loader') return <span style={{ color: accent }}><LoaderArt config={findLoader(key)} size={16} /></span>;
  if (item.category === 'separator') return <div className="sep-preview" style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: separatorHtml(key) }} />;
  if (item.category === 'flourish') return <FlourishMini f={findFlourish(key)} />;
  if (item.category === 'shape') return <ShapeSample shape={findShape(key)} />;
  if (item.category === 'texture') return <TextureMock id={key} custom={custom.textures} />;
  if (item.category === 'edge') return <EdgeMock id={key} custom={custom.edges} />;
  if (item.category === 'pairing') return <PairingMock id={key} custom={custom.pairings} />;
  if (item.category === 'pack') return <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'center' }}><div style={{ fontSize: '1.6rem' }}>🎁</div>{item.contains?.length ?? 0} looks together</div>;
  if (item.category === 'skin') return <SkinMock id={key} custom={custom.skins} />;
  if (item.category === 'cover') return <CoverMock id={key} custom={custom.covers} />;
  if (item.category === 'confetti' && key === 'none') return <span style={{ fontSize: '2rem' }}>∅</span>;
  if (item.category === 'confetti') return <ConfettiSample config={findCelebration(key, custom.confetti)} />;
  if (item.category === 'shelf') return <ShelfMock id={key} custom={custom.shelves} />;
  if (item.category === 'chime') return <span style={{ fontSize: '1.8rem', color: accent }}>{findChime(key, custom.chimes).notes.some(n => n > 0) ? '♪' : '·'}</span>;
  if (item.category === 'theme' && (findThemePreset(key) || findBuiltinTheme(key))) return <ThemeMock id={key} />;
  if (item.category === 'theme' && item.previewColor) {
    return <span style={{ width: 54, height: 54, borderRadius: '50%', backgroundColor: item.previewColor, border: '2px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>{item.previewIcon}</span>;
  }
  return <span style={{ fontSize: '2rem', color: item.category === 'trail' ? findTrail(key, custom.trails)?.color === 'accent' ? accent : findTrail(key, custom.trails)?.color : undefined }}>{item.previewIcon ?? '✦'}</span>;
};

const pill = (on: boolean): React.CSSProperties => ({
  padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', fontWeight: 600, cursor: on ? 'default' : 'pointer',
  backgroundColor: on ? 'var(--accent-gold-bg)' : 'var(--badge-bg)', color: on ? accent : 'var(--text-secondary)',
  border: on ? '1px solid var(--accent-gold)' : '1px solid transparent',
});

const heading: React.CSSProperties = { fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', margin: '0 0 8px' };

// what each section lets you make yourself, and where
type Maker =
  | { kind: 'loader'; editing: LoaderConfig | null }
  | { kind: 'separator'; editing: CustomSeparator | null }
  | { kind: 'flourish'; editing: CustomFlourish | null }
  | { kind: 'trail'; editing: TrailConfig | null }
  | { kind: 'chime'; editing: ChimeConfig | null }
  | { kind: 'shape'; editing: ShapeConfig | null }
  | { kind: 'cover'; editing: CustomCover | null }
  | { kind: 'confetti'; editing: CelebrationConfig | null }
  | { kind: 'pairing'; editing: CustomPairing | null }
  | { kind: 'texture'; editing: CustomTexture | null }
  | { kind: 'edge'; editing: CustomEdge | null }
  | { kind: 'skin'; editing: CustomSkin | null }
  | { kind: 'shelf'; editing: CustomShelf | null }
  | { kind: 'pack'; editing: CustomBundle | null };

// the made-things list each shelf holds
const KIND_OF: Partial<Record<Category, MadeKind>> = {
  loader: 'loader', separator: 'separator', flourish: 'flourish', trail: 'trail', chime: 'chime', shape: 'shape', cover: 'cover', confetti: 'celebration',
  pairing: 'pairing', texture: 'texture', edge: 'edge', skin: 'skin', shelf: 'shelf', pack: 'bundle',
};

const MAKE: Partial<Record<Category, { text: string; button: string }>> = {
  loader: { text: 'Design a loader from a shape, a layout and a pace.', button: 'Make your own loader' },
  separator: { text: 'Draw your own scene break from a line and an ornament.', button: 'Make your own scene break' },
  flourish: { text: 'Build a title page flourish with ornaments and a frame.', button: 'Make your own flourish' },
  trail: { text: 'Choose what falls off your pointer, and how it moves.', button: 'Make your own trail' },
  chime: { text: 'Compose your own tune, up to eight notes.', button: 'Compose a chime' },
  shape: { text: 'Shape your own comment cards and the marks they leave.', button: 'Design a comment shape' },
  cover: { text: 'Build a cover from a gradient, a material, stars and an emblem.', button: 'Make your own cover' },
  pairing: { text: 'Name any Google fonts for the writing and for titles.', button: 'Make your own fonts' },
  texture: { text: 'Lay a pattern of lines, dots, grain or stars over the paper.', button: 'Make your own texture' },
  edge: { text: 'Frame the page or mark its corners and edges.', button: 'Make your own margin' },
  skin: { text: 'Choose how the header bar and windows are dressed.', button: 'Make your own skin' },
  shelf: { text: 'Pick the wall, the ledge and the lettering for your badge shelf.', button: 'Make your own shelf' },
  pack: { text: 'Save the looks you are wearing now as a bundle you can wear again in one press.', button: 'Make your own bundle' },
  confetti: { text: 'Pick the shapes, colors and the way it moves: a burst, fireworks, a shooting star, snowfall.', button: 'Make your own confetti' },
};

const MODAL: Partial<Record<Category, { tab: Tab; text: string; button: string }>> = {
  theme: { tab: 'theme', text: 'You can also make your own theme, with your own colors and pictures, and add your own fonts.', button: 'Open theme maker' },
  cursor: { tab: 'theme', text: 'You can also upload a picture of your own to use as the pointer. Look for "Your cursors".', button: 'Upload a cursor' },
  keystroke: { tab: 'sound', text: 'You can also record or upload your own key sounds.', button: 'Make or upload sounds' },
  soundscape: { tab: 'sound', text: 'You can also build your own soundscape from layers, or upload your own sound files.', button: 'Build a soundscape' },
};

// the shop's shelves. the shop page shows all of them; the palette shows the ones you can customize, so nothing has to be equipped from the shop.
export const ShopBrowser: React.FC<{ categories?: Category[]; onOpenTab?: (tab: Tab) => void; embedded?: boolean }> = ({ categories, onOpenTab, embedded }) => {
  const {
    userStats, cosmeticShop, themePreview, previewTheme, buyCosmetic, equipCosmetic, playKeystroke, badges, previewChime, setDocCover,
    allProjects, project,
    deleteCustomLoader, deleteCustomSeparator, deleteCustomFlourish, deleteCustomTrail, deleteCustomChime, deleteCustomShape, deleteCustomCover, deleteCustomCelebration, previewCelebration, setQuietWriting, setNoPointNotes, removeMine, importMine, showToast,
  } = useAsterism();
  const shelves = CATEGORIES.filter(c => !categories || categories.includes(c.id));
  const [category, setCategory] = useState<Category>(shelves[0].id);
  const [ownedOnly, setOwnedOnly] = useState(false);
  // a try-on ends when the shop closes or the writer moves to another shelf
  useEffect(() => () => previewTheme(null), [previewTheme]);
  useEffect(() => { previewTheme(null); }, [category, previewTheme]);
  const [maker, setMaker] = useState<Maker | null>(null);
  const sharedInput = useRef<HTMLInputElement>(null);
  const [tryTrail, setTryTrail] = useState<string | null>(null);
  // covers can go on every document or just one
  const [coverFor, setCoverFor] = useState<string>('all');

  const info = CATEGORIES.find(c => c.id === category)!;

  // the font pairings need their fonts to show in the cards
  useEffect(() => {
    if (category === 'pairing') PAIRINGS.forEach(p => { fontLoader.loadGoogleFont(p.body); if (p.heading) fontLoader.loadGoogleFont(p.heading); });
  }, [category]);
  const points = userStats.quillPoints;
  const make = MAKE[category];
  const modal = onOpenTab ? MODAL[category] : undefined;
  const custom = { chimes: userStats.customChimes ?? [], trails: userStats.customTrails ?? [], covers: userStats.customCovers ?? [], confetti: userStats.customCelebrations ?? [], pairings: userStats.customPairings ?? [], textures: userStats.customTextures ?? [], edges: userStats.customEdges ?? [], skins: userStats.customSkins ?? [], shelves: userStats.customShelves ?? [] };
  const docs = useMemo(() => {
    const seen = new Set<string>();
    return [project, ...allProjects].filter(p => !p.kind && !seen.has(p.id) && seen.add(p.id));
  }, [project, allProjects]);
  const coverDoc = coverFor === 'all' ? undefined : docs.find(d => d.id === coverFor);

  const worn = (item: CosmeticItem): boolean => {
    const k = tail(item.id);
    switch (item.category) {
      case 'theme': return findThemePreset(k) ? userStats.activeTheme === 'custom' && userStats.activeCustomThemeId === `preset-${k}` : userStats.activeTheme === k && !userStats.activeCustomThemeId;
      case 'cursor': return userStats.activeCursor === k;
      case 'loader': return (userStats.activeLoader ?? 'stars') === k;
      case 'separator': return (userStats.activeSeparator ?? 'stars') === k;
      case 'flourish': return (userStats.activeFlourish ?? 'none') === k;
      case 'keystroke': return userStats.keystrokeSound === k;
      case 'soundscape': return userStats.ambientSound === k;
      case 'trail': return (userStats.activeTrail ?? 'none') === k;
      case 'chime': return Object.values(userStats.activeChimes ?? { sprint: 'fanfare' }).includes(k);
      case 'shape': return (userStats.activeShape ?? 'plain') === k;
      case 'confetti': return (userStats.activeCelebration ?? 'classic') === k;
      case 'texture': return (userStats.activeTexture ?? 'plain') === k;
      case 'edge': return (userStats.activeEdge ?? 'none') === k;
      case 'pairing': return pairingFor(userStats.activeFont, userStats.titleFont, custom.pairings)?.id === k;
      case 'pack': return !!item.contains?.every(id => { const part = cosmeticShop.find(c => c.id === id); return !part || worn(part); });
      case 'skin': return (userStats.activeSkin ?? 'plain') === k;
      case 'shelf': return (userStats.activeShelf ?? 'plain') === k;
      case 'cover': return (coverDoc ? coverDoc.coverStyle ?? userStats.activeCover ?? 'plain' : userStats.activeCover ?? 'plain') === k;
      default: return false;
    }
  };

  const groups = useMemo(() => {
    const items = cosmeticShop.filter(i => i.category === category && (!ownedOnly || i.unlocked));
    return TIERS.map(t => ({ tier: t, items: items.filter(i => i.tier === t.id).sort((a, b) => a.cost - b.cost) })).filter(g => g.items.length);
  }, [cosmeticShop, category, ownedOnly]);

  const wear = (item: CosmeticItem) => {
    if (item.category === 'cover') setDocCover(coverDoc?.id ?? null, tail(item.id));
    else equipCosmetic(item);
  };

  const card = (item: CosmeticItem) => {
    const on = worn(item);
    const badge = item.earnedWith ? badges.find(b => b.id === item.earnedWith) : undefined;
    return (
      <div key={item.id}
        onMouseEnter={() => item.category === 'trail' && setTryTrail(tail(item.id))} onFocus={() => item.category === 'trail' && setTryTrail(tail(item.id))}
        style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: 'var(--bg-paper)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          <Preview item={item} custom={custom} />
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)' }}>{item.name}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', flex: 1 }}>{item.description}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {item.category === 'keystroke' && (
              <button onClick={() => playKeystroke('a', tail(item.id) as KeystrokeSound)} title="Hear it" aria-label={`Hear ${item.name}`} style={{ display: 'flex', padding: 5, borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Volume2 size={13} /></button>
            )}
            {item.category === 'confetti' && item.unlocked && tail(item.id) !== 'none' && (
              <button onClick={() => previewCelebration(findCelebration(tail(item.id), custom.confetti))} style={{ ...pill(false), cursor: 'pointer' }}>Try it</button>
            )}
            {item.category === 'chime' && (
              <button onClick={() => previewChime(findChime(tail(item.id), custom.chimes))} title="Hear it" aria-label={`Hear ${item.name}`} style={{ display: 'flex', padding: 5, borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}><Volume2 size={13} /></button>
            )}
            {item.category === 'theme' && !item.unlocked && (
              <button onClick={() => previewTheme(themePreview === tail(item.id) ? null : tail(item.id))} aria-pressed={themePreview === tail(item.id)} style={{ ...pill(false), cursor: 'pointer' }}>
                {themePreview === tail(item.id) ? 'Stop preview' : 'Preview'}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {item.unlocked ? (
              <button onClick={() => wear(item)} disabled={on} style={pill(on)}>{on ? 'Equipped' : 'Equip'}</button>
            ) : item.earnedWith ? (
              <span title={badge?.description} style={{ ...pill(false), display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}><Lock size={11} /> Earn: {badge?.name ?? 'a streak badge'}</span>
            ) : !inSeason(item.season) ? (
              <span style={{ ...pill(false), display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}><Lock size={11} /> Back in {SEASONS[item.season!].label.toLowerCase()}</span>
            ) : (
              <button onClick={() => buyCosmetic(item)} style={{ ...pill(false), cursor: 'pointer', backgroundColor: points >= item.cost ? accent : 'var(--badge-bg)', color: points >= item.cost ? '#ffffff' : 'var(--text-muted)' }}>
                {item.cost} QP
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // sharing: the item as a file, and a file added back as a new item
  const madeKind = KIND_OF[category];
  const madeList = (): Array<{ id: string; name?: string }> => (madeKind ? ((userStats[MADE[madeKind].field] as Array<{ id: string; name?: string }> | undefined) ?? []) : []);
  const shareable = (id: string) => !!madeKind && canShare(madeKind) && madeList().some(x => x.id === id);
  const share = (id: string) => {
    const item = madeList().find(x => x.id === id);
    if (!madeKind || !item) return;
    const file = shareFile(madeKind, item);
    storageService.downloadTextFile(file.fileName, file.text, 'application/json');
  };
  const addShared = async (file: File | undefined) => {
    if (!file) return;
    const got = parseShared(await file.text());
    if ('error' in got) { showToast(got.error, 'info'); return; }
    importMine(got.kind, got.item);
    showToast(`Added "${got.item.name ?? 'it'}" to your ${got.kind === 'celebration' ? 'confetti' : got.kind} looks. Find it under Made by you.`, 'success');
  };

  // something the writer made: always owned, can be edited or deleted
  const ownCard = (id: string, name: string, preview: React.ReactNode, on: boolean, equip: () => void, edit: () => void, remove: () => void) => (
    <div key={id} style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      <div style={{ minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: 'var(--bg-paper)', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden', color: accent }}>
        {preview}
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', overflowWrap: 'anywhere' }}>{name}</div>
        <button onClick={edit} title="Edit" aria-label={`Edit ${name}`} style={{ display: 'flex', padding: 5, color: 'var(--text-secondary)', cursor: 'pointer' }}><Pencil size={13} /></button>
        {shareable(id) && <button onClick={() => share(id)} title="Share as a file" aria-label={`Share ${name}`} style={{ display: 'flex', padding: 5, color: 'var(--text-secondary)', cursor: 'pointer' }}><Share2 size={13} /></button>}
        <button onClick={remove} title="Delete" aria-label={`Delete ${name}`} style={{ display: 'flex', padding: 5, color: 'var(--text-secondary)', cursor: 'pointer' }}><Trash2 size={13} /></button>
        <button onClick={equip} disabled={on} style={pill(on)}>{on ? 'Equipped' : 'Equip'}</button>
      </div>
    </div>
  );

  const asItem = (id: string, name: string, cat: Category): CosmeticItem => ({ id: `${cat}-${id}`, name, category: cat, cost: 0, description: '', unlocked: true });

  const owns = (): React.ReactNode[] => {
    if (category === 'loader') {
      return (userStats.customLoaders ?? []).map(l => ownCard(
        l.id, l.name, <LoaderArt config={l} size={16} />, (userStats.activeLoader ?? 'stars') === l.id,
        () => equipCosmetic(asItem(l.id, l.name, 'loader')), () => setMaker({ kind: 'loader', editing: l }), () => deleteCustomLoader(l.id),
      ));
    }
    if (category === 'separator') {
      const mine = userStats.customSeparators ?? [];
      return mine.map(s => ownCard(
        s.id, s.name, <div className="sep-preview" style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: separatorHtml(s.id, mine) }} />, (userStats.activeSeparator ?? 'stars') === s.id,
        () => equipCosmetic(asItem(s.id, s.name, 'separator')), () => setMaker({ kind: 'separator', editing: s }), () => deleteCustomSeparator(s.id),
      ));
    }
    if (category === 'flourish') {
      return (userStats.customFlourishes ?? []).map(f => ownCard(
        f.id, f.name, <FlourishMini f={f} />, (userStats.activeFlourish ?? 'none') === f.id,
        () => equipCosmetic(asItem(f.id, f.name, 'flourish')), () => setMaker({ kind: 'flourish', editing: f }), () => deleteCustomFlourish(f.id),
      ));
    }
    if (category === 'trail') {
      return custom.trails.map(t => ownCard(
        t.id, t.name, <span style={{ fontSize: '2rem', color: t.color === 'accent' ? accent : t.color }}>{Array.from(t.glyph)[0]}</span>, (userStats.activeTrail ?? 'none') === t.id,
        () => equipCosmetic(asItem(t.id, t.name, 'trail')), () => setMaker({ kind: 'trail', editing: t }), () => deleteCustomTrail(t.id),
      ));
    }
    if (category === 'chime') {
      return custom.chimes.map(c => ownCard(
        c.id, c.name, <button onClick={() => previewChime(c)} aria-label={`Hear ${c.name}`} style={{ display: 'flex', padding: 10, borderRadius: '50%', border: '1px solid var(--border-strong)', color: accent, cursor: 'pointer' }}><Volume2 size={20} /></button>,
        Object.values(userStats.activeChimes ?? {}).includes(c.id),
        () => equipCosmetic(asItem(c.id, c.name, 'chime')), () => setMaker({ kind: 'chime', editing: c }), () => deleteCustomChime(c.id),
      ));
    }
    if (category === 'cover') {
      return custom.covers.map(c => ownCard(
        c.id, c.name, <CoverMock id={c.id} custom={custom.covers} />, (coverDoc ? coverDoc.coverStyle ?? userStats.activeCover ?? 'plain' : userStats.activeCover ?? 'plain') === c.id,
        () => setDocCover(coverDoc?.id ?? null, c.id), () => setMaker({ kind: 'cover', editing: c }), () => deleteCustomCover(c.id),
      ));
    }
    const simple = (kind: 'texture' | 'edge' | 'skin' | 'shelf' | 'pairing', list: Array<{ id: string; name: string }>, preview: (id: string) => React.ReactNode, isWorn: (id: string) => boolean) =>
      list.map(x => ownCard(x.id, x.name, preview(x.id), isWorn(x.id), () => equipCosmetic(asItem(x.id, x.name, kind)), () => setMaker({ kind, editing: x } as Maker), () => removeMine(kind, x.id)));
    if (category === 'texture') return simple('texture', custom.textures, id => <TextureMock id={id} custom={custom.textures} />, id => (userStats.activeTexture ?? 'plain') === id);
    if (category === 'edge') return simple('edge', custom.edges, id => <EdgeMock id={id} custom={custom.edges} />, id => (userStats.activeEdge ?? 'none') === id);
    if (category === 'skin') return simple('skin', custom.skins, id => <SkinMock id={id} custom={custom.skins} />, id => (userStats.activeSkin ?? 'plain') === id);
    if (category === 'shelf') return simple('shelf', custom.shelves, id => <ShelfMock id={id} custom={custom.shelves} />, id => (userStats.activeShelf ?? 'plain') === id);
    if (category === 'pairing') return simple('pairing', custom.pairings, id => <PairingMock id={id} custom={custom.pairings} />, id => pairingFor(userStats.activeFont, userStats.titleFont, custom.pairings)?.id === id);
    if (category === 'pack') {
      return (userStats.customBundles ?? []).map(b => ownCard(
        b.id, b.name, <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', textAlign: 'center' }}><div style={{ fontSize: '1.6rem' }}>🎁</div>{b.items.length} looks together</div>, false,
        () => equipCosmetic({ id: `pack-${b.id}`, name: b.name, category: 'pack', cost: 0, description: '', unlocked: true, contains: b.items }),
        () => setMaker({ kind: 'pack', editing: b }), () => removeMine('bundle', b.id),
      ));
    }
    if (category === 'confetti') {
      return custom.confetti.map(c => ownCard(
        c.id, c.name, <ConfettiSample config={c} />, (userStats.activeCelebration ?? 'classic') === c.id,
        () => equipCosmetic(asItem(c.id, c.name, 'confetti')), () => setMaker({ kind: 'confetti', editing: c }), () => deleteCustomCelebration(c.id),
      ));
    }
    if (category === 'shape') {
      return (userStats.customShapes ?? []).map(s => ownCard(
        s.id, s.name, <ShapeSample shape={s} />, (userStats.activeShape ?? 'plain') === s.id,
        () => equipCosmetic(asItem(s.id, s.name, 'shape')), () => setMaker({ kind: 'shape', editing: s }), () => deleteCustomShape(s.id),
      ));
    }
    return [];
  };
  const mine = owns();
  const closeMaker = () => setMaker(null);
  const makerView = () => {
    if (!maker) return null;
    const key = maker.editing?.id ?? 'new';
    switch (maker.kind) {
      case 'loader': return <LoaderWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'separator': return <SeparatorWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'flourish': return <FlourishWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'trail': return <TrailWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'chime': return <ChimeWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'shape': return <ShapeWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'pairing': return <PairingWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'texture': return <TextureWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'edge': return <EdgeWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'skin': return <SkinWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'shelf': return <ShelfWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'pack': return <BundleWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'cover': return <CoverWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
      case 'confetti': return <CelebrationWorkshop key={key} editing={maker.editing} onDone={closeMaker} />;
    }
  };

  const shownTrail = findTrail(tryTrail ?? userStats.activeTrail, custom.trails);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {themePreview && (
          <div role="status" style={{ position: 'sticky', top: 8, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--accent-gold)', boxShadow: 'var(--shadow-md)', fontSize: '0.84rem', color: 'var(--text-main)' }}>
            <span style={{ flex: 1 }}>Previewing {cosmeticShop.find(i => i.id === `theme-${themePreview}`)?.name ?? 'a theme'}. Nothing is bought or changed.</span>
            <button onClick={() => previewTheme(null)} style={{ ...pill(false), cursor: 'pointer' }}>Stop preview</button>
          </div>
        )}
        {!embedded && <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Quill Points buy looks, sounds and keepsakes. Every writing tool is free, always. You can make your own themes, sounds, pointers, trails, chimes, mixes, comment shapes, loaders, scene breaks and title page flourishes too. Everything you make follows you to your other devices. Anything you own can also be worn from the paint palette button, under Looks.
        </p>}

        <nav aria-label="Shop sections" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shelves.map(c => (
            <button key={c.id} onClick={() => { setCategory(c.id); setMaker(null); setTryTrail(null); }} aria-pressed={category === c.id} style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: category === c.id ? 700 : 500, cursor: 'pointer', backgroundColor: category === c.id ? accent : 'var(--bg-card)', color: category === c.id ? '#ffffff' : 'var(--text-secondary)', border: category === c.id ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)' }}>
              {c.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, minWidth: 220 }}>{info.blurb}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={ownedOnly} onChange={e => setOwnedOnly(e.target.checked)} /> Only what I own
          </label>
        </div>

        {modal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-gold)', backgroundColor: 'var(--bg-card)' }}>
            <span style={{ flex: 1, minWidth: 220, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{modal.text}</span>
            <button onClick={() => onOpenTab?.(modal.tab)} style={{ ...pill(false), padding: '6px 16px', color: accent, cursor: 'pointer' }}>{modal.button}</button>
          </div>
        )}

        {category === 'trail' && <TrailPad trail={shownTrail} />}
        {category === 'chime' && <ChimeAssign />}
        {category === 'shelf' && <BadgeShelf />}
        {category === 'confetti' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={userStats.quietWriting !== false} onChange={e => setQuietWriting(e.target.checked)} />
              Keep it quiet while I write: no confetti or glow when points tick up from ordinary writing
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!userStats.noPointNotes} onChange={e => setNoPointNotes(e.target.checked)} />
              Hide the "+N Quill Points" notes. Your points still count.
            </label>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>To turn confetti off completely, equip "No confetti" below. Otherwise finished chapters, goals, sprints and purchases still celebrate.</span>
          </div>
        )}
        {category === 'cover' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            Put the cover on
            <select value={coverFor} onChange={e => setCoverFor(e.target.value)} aria-label="Which document gets the cover"
              style={{ padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', maxWidth: 260 }}>
              <option value="all">all my documents</option>
              {docs.map(d => <option key={d.id} value={d.id}>{d.title || 'Untitled'}</option>)}
            </select>
          </label>
        )}

        {make && (maker ? makerView() : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--accent-gold)', backgroundColor: 'var(--bg-card)' }}>
            <span style={{ flex: 1, minWidth: 220, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{make.text}</span>
            <button onClick={() => setMaker({ kind: category, editing: null } as Maker)} style={{ ...pill(false), padding: '6px 16px', color: accent, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Pencil size={13} /> {make.button}</button>
            {madeKind && canShare(madeKind) && (
              <>
                <button onClick={() => sharedInput.current?.click()} style={{ ...pill(false), padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Share2 size={13} /> Add a shared one</button>
                <input ref={sharedInput} type="file" accept=".json,application/json" aria-label="Choose a shared cosmetic file" tabIndex={-1} onChange={e => { void addShared(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
              </>
            )}
          </div>
        ))}

        {mine.length > 0 && (
          <section aria-label="Made by you">
            <h2 style={heading}>Made by you</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>{mine}</div>
          </section>
        )}

        {groups.length === 0 && <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Nothing owned in this section yet.</div>}

        {groups.map(g => (
          <section key={g.tier.id} aria-label={g.tier.label}>
            <h2 style={heading}>
              {g.tier.label} <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {g.tier.range}</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>{g.items.map(card)}</div>
          </section>
        ))}
    </div>
  );
};
