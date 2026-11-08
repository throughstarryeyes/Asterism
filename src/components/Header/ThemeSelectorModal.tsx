import React, { useEffect, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { ThemeMode, CursorStyle, EditorFont, CustomThemeConfig, KeystrokeSound } from '../../types';
import { storageService } from '../../services/storage';
import { parseThemeFile, themeFile } from '../../services/shareTheme';
import { Download, X, Sparkles, Palette, Type, Check, Volume2, Trash2, Pencil, Plus, Waves, CloudRain, Flame, Coffee, VolumeX, ImagePlus, Upload, Wind } from 'lucide-react';
import { CUSTOM_THEME_COST, PAPER_STYLES, contrastRatio, deriveThemeVars, newCustomTheme } from '../../services/customTheme';
import { getAssetUrl, putAsset, newAssetId } from '../../services/assetStore';
import { prepareImage } from '../../services/imageUpload';
import { DEFAULT_APP_DIM, DEFAULT_PAGE_DIM, imageLayer } from '../../services/themeImages';
import { FONT_EXTENSIONS } from '../../services/fontFiles';
import { SoundBuilder } from './SoundBuilder';
import { SoundscapeBuilder } from './SoundscapeBuilder';
import { CursorBuilder } from './CursorBuilder';
import { LookEditor } from './LookEditor';
import { hasBackdrop, previewStyle } from '../../services/backdrops';
import type { CosmeticItem } from '../../types';
import { ShopBrowser } from '../Shop/ShopBrowser';
import { keystrokeOptions } from '../../data/keystrokeSounds';
import { ownedKeystrokes } from '../../services/shop';
import { PAGE_LIMITS, PAGE_PRESETS, normalizePage, samePage } from '../../services/pageLayout';
import { useDialog } from '../Common/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // the tab to open on (the shop links straight to the sound makers)
  initialTab?: Tab;
}

export type Tab = 'theme' | 'type' | 'sound' | 'looks';

// everything with a look you can wear or make, so none of it is equipped from the shop
const LOOKS: Array<CosmeticItem['category']> = ['pack', 'pairing', 'texture', 'edge', 'cursor', 'trail', 'loader', 'separator', 'flourish', 'shape', 'skin', 'cover', 'shelf', 'chime', 'confetti'];

const THEMES: Array<{ id: ThemeMode; name: string; subtitle: string; bg: string; text: string; accent: string }> = [
  { id: 'duck', name: 'Rubber Duck Bath 🦆', subtitle: 'Take a dip!', bg: '#fef9c3', text: '#713f12', accent: '#0284c7' },
  { id: 'composition', name: 'Composition Notebook', subtitle: 'Scribble on the page.', bg: '#fcfcf7', text: '#1a2a44', accent: '#d32f2f' },
  { id: 'celestial', name: 'Celestial Starlight', subtitle: 'Write among the stars.', bg: '#080c18', text: '#f0f4ff', accent: '#f7c948' },
  { id: 'pasteldream', name: 'Pastel Dream Journal', subtitle: 'Make it cute!', bg: '#f5f3ff', text: '#4c1d95', accent: '#ec4899' },
  { id: 'parchment', name: 'Warm Parchment', subtitle: 'Get cozy and serious.', bg: '#f5f0e6', text: '#2c241b', accent: '#c9933b' },
  { id: 'solarium', name: 'Emerald Solarium', subtitle: 'Make it rich.', bg: '#0a1912', text: '#e8f5e9', accent: '#2ecc71' },
  { id: 'scriptorium', name: 'Amber Scriptorium', subtitle: 'Fit for a king.', bg: '#19110b', text: '#fcf3e6', accent: '#d97706' },
  { id: 'velvet', name: 'Midnight Velvet', subtitle: 'Get gothic.', bg: '#120e17', text: '#fceffe', accent: '#d4638c' },
  { id: 'black', name: 'Pure Obsidian OLED', subtitle: 'Black Contrast', bg: '#000000', text: '#f5f5f5', accent: '#7b7975' },
  { id: 'white', name: 'Architectural White', subtitle: 'White Contrast', bg: '#ffffff', text: '#0f172a', accent: '#838484' },
];

const FONTS: Array<{ id: EditorFont; name: string; sample: string }> = [
  { id: 'Caveat', name: 'Caveat (Scribble Handwriting)', sample: 'The Great Bell tolled across the water.' },
  { id: 'Patrick Hand', name: 'Patrick Hand (Pencil Script)', sample: 'The Great Bell tolled across the water.' },
  { id: 'Lora', name: 'Lora', sample: 'The Great Bell tolled across the water.' },
  { id: 'Playfair Display', name: 'Playfair Display', sample: 'The Great Bell tolled across the water.' },
  { id: 'Cinzel', name: 'Cinzel', sample: 'THE GREAT BELL TOLLED ACROSS THE WATER.' },
  { id: 'Courier Prime', name: 'Courier Prime', sample: 'The Great Bell tolled across the water.' },
  { id: 'Outfit', name: 'Outfit', sample: 'The Great Bell tolled across the water.' },
  { id: 'Times New Roman', name: 'Times New Roman', sample: 'The Great Bell tolled across the water.' },
  { id: 'Helvetica', name: 'Helvetica', sample: 'The Great Bell tolled across the water.' },
  { id: 'Arial', name: 'Arial', sample: 'The Great Bell tolled across the water.' },
];

const CURSORS: Array<{ id: CursorStyle; name: string; icon: string }> = [
  { id: 'default', name: 'Standard Caret', icon: 'I' },
  { id: 'quill', name: 'Golden Quill', icon: '✒️' },
  { id: 'wand', name: 'Starlight Wand', icon: '🪄' },
  { id: 'golden_nib', name: 'Calligrapher Nib', icon: '🖋️' },
];


const AMBIENT: Array<{ id: 'off' | 'ocean' | 'wind' | 'rain' | 'fire' | 'library'; label: string; icon: React.ReactNode }> = [
  { id: 'off', label: 'Silence', icon: <VolumeX size={15} /> },
  { id: 'ocean', label: 'Ocean Waves', icon: <Waves size={15} /> },
  { id: 'rain', label: 'Rain on Glass', icon: <CloudRain size={15} /> },
  { id: 'wind', label: 'Wind Through Trees', icon: <Wind size={15} /> },
  { id: 'fire', label: 'Actual Crackling Fire', icon: <Flame size={15} /> },
  { id: 'library', label: 'Library Drone', icon: <Coffee size={15} /> },
];

const COLOR_FIELDS: Array<{ key: 'bgApp' | 'bgPaper' | 'textMain' | 'textSecondary' | 'accentPrimary' | 'accentGold' | 'borderSubtle' | 'borderStrong'; label: string }> = [
  { key: 'bgApp', label: 'Background' },
  { key: 'bgPaper', label: 'Page' },
  { key: 'textMain', label: 'Text' },
  { key: 'textSecondary', label: 'Soft text' },
  { key: 'accentPrimary', label: 'Accent' },
  { key: 'accentGold', label: 'Highlight' },
  { key: 'borderSubtle', label: 'Soft border' },
  { key: 'borderStrong', label: 'Strong border' },
];

const sectionLabel: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' };
const row = (active: boolean): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: 'var(--radius-md)', textAlign: 'left',
  border: active ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
  backgroundColor: active ? 'var(--accent-gold-bg)' : 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.88rem',
});

interface PickerProps {
  title: string;
  imageId?: string;
  dim: number;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
  onDim: (dim: number) => void;
}

// choose, replace or remove one background picture, and set how strongly the
// theme's color is laid over it.
const PicturePicker: React.FC<PickerProps> = ({ title, imageId, dim, onPick, onRemove, onDim }) => {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let live = true;
    (imageId ? getAssetUrl(imageId) : Promise.resolve(undefined)).then(u => { if (live) setUrl(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [imageId]);
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {imageId && url && <div style={{ height: 70, borderRadius: 6, backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--border-subtle)' }} />}
      <div style={{ display: 'flex', gap: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', cursor: 'pointer' }}>
          <ImagePlus size={13} /> {imageId ? 'Replace' : 'Choose image'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }}
            onChange={e => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {imageId && <button onClick={onRemove} style={{ padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Remove</button>}
      </div>
      {imageId && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--text-secondary)' }}>Tint over picture: {Math.round(dim * 100)}%
          <input type="range" min={0} max={90} value={Math.round(dim * 100)} onChange={e => onDim(Number(e.target.value) / 100)} style={{ accentColor: 'var(--accent-gold)' }} />
        </label>
      )}
    </div>
  );
};

export const ThemeSelectorModal: React.FC<Props> = ({ isOpen, onClose, initialTab }) => {
  const {
    userStats, setTheme, setCursor, setFont, setFontSize, setLineHeight, toggleIndentParagraphs, toggleTypewriterMode,
    setKeystrokeSound, setKeystrokeVolume, playKeystroke, setAmbientSound, setAmbientVolume,
    saveCustomTheme, importCustomTheme, showToast, deleteCustomTheme, applyCustomTheme,
    uploadFontFile, importCustomFont, deleteCustomFont, setThemeImages, setPageLayout,
    project, setStoryTheme, cosmeticShop,
  } = useAsterism();
  // only themes the writer owns (three to begin with); the rest are tried and bought in the shop. the one in use always shows.
  const ownedThemes = THEMES.filter(t => t.id === userStats.activeTheme || cosmeticShop.some(i => i.id === `theme-${t.id}` && i.unlocked));
  // a document can wear its own theme; the picker then shows and sets that one
  const story = project.storyTheme;
  const own = !!project.useStoryTheme && !!story?.activeTheme;
  const shownMode: ThemeMode = own ? story!.activeTheme! : userStats.activeTheme;
  const shownCustomId = own ? story!.customTheme?.id : userStats.activeCustomThemeId;
  const pickBuiltIn = (id: ThemeMode) => (own ? setStoryTheme({ ...story, activeTheme: id, customTheme: undefined, useStoryTheme: true }) : setTheme(id));
  const pickCustom = (t: CustomThemeConfig) => (own ? setStoryTheme({ ...story, activeTheme: 'custom', customTheme: t, useStoryTheme: true }) : applyCustomTheme(t.id));
  const setOwn = (on: boolean) => {
    if (!on) return setStoryTheme({ ...story, useStoryTheme: false });
    const current = userStats.activeTheme === 'custom' ? (userStats.customThemes || []).find(t => t.id === userStats.activeCustomThemeId) : undefined;
    setStoryTheme({ ...story, activeTheme: userStats.activeTheme, customTheme: current, useStoryTheme: true });
  };
  const [tab, setTab] = useState<Tab>(initialTab ?? 'theme');
  const [draft, setDraft] = useState<CustomThemeConfig | null>(null);
  const [imageUrls, setImageUrls] = useState<{ app?: string; page?: string }>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [googleFont, setGoogleFont] = useState('');

  // show the pictures already attached to the theme being edited.
  const appImageId = draft?.appBgImageId;
  const pageImageId = draft?.pageBgImageId;
  useEffect(() => {
    let live = true;
    Promise.all([
      appImageId ? getAssetUrl(appImageId) : undefined,
      pageImageId ? getAssetUrl(pageImageId) : undefined,
    ]).then(([app, page]) => { if (live) setImageUrls({ app, page }); }).catch(() => undefined);
    return () => { live = false; };
  }, [appImageId, pageImageId]);

  const pickImage = async (file: File | undefined, which: 'app' | 'page') => {
    if (!file || !draft) return;
    setImageError(null);
    try {
      const id = await putAsset(await prepareImage(file), newAssetId('img'));
      setDraft(d => d && (which === 'app' ? { ...d, appBgImageId: id } : { ...d, pageBgImageId: id }));
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  };
  // pictures added to the built-in theme that is currently active.
  const builtInId = String(shownMode);
  const builtInName = THEMES.find(t => t.id === builtInId)?.name;
  const builtInImages = userStats.themeImages?.[builtInId] ?? {};
  const pickBuiltInImage = async (file: File | undefined, which: 'app' | 'page') => {
    if (!file) return;
    setImageError(null);
    try {
      const id = await putAsset(await prepareImage(file), newAssetId('img'));
      setThemeImages(builtInId, which === 'app' ? { ...builtInImages, appBgImageId: id } : { ...builtInImages, pageBgImageId: id });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  };

  const removeImage = (which: 'app' | 'page') =>
    setDraft(d => d && (which === 'app' ? { ...d, appBgImageId: undefined } : { ...d, pageBgImageId: undefined }));

  const pickFont = async (file: File | undefined, forTheme: boolean) => {
    if (!file) return;
    const name = await uploadFontFile(file, undefined, false);
    if (name && forTheme) setDraft(d => d && { ...d, fontFamily: name });
  };
  const addGoogleFont = () => {
    const family = googleFont.trim();
    if (!family) return;
    importCustomFont({ id: `google-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name: family, family, source: 'google' }, false);
    setGoogleFont('');
  };

  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);

  if (!isOpen) return null;

  const customThemes = userStats.customThemes || [];
  const customFonts = userStats.customFonts || [];
  const fontChoices = [...FONTS.map(f => f.id as string), ...customFonts.map(f => f.family)];
  const draftIsNew = draft ? !customThemes.some(t => t.id === draft.id) : false;
  const canAfford = userStats.quillPoints >= CUSTOM_THEME_COST;

  const startFrom = (t: (typeof THEMES)[number]) => {
    if (!draft) return;
    setDraft({ ...draft, bgApp: t.bg, bgPaper: t.bg, textMain: t.text, accentPrimary: t.accent, accentGold: t.accent });
  };

  const renderPreview = (t: CustomThemeConfig) => {
    const vars = deriveThemeVars(t);
    const rule = vars['--paper-rule'];
    const paper: React.CSSProperties =
      t.paperStyle === 'lined' ? { backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 23px, ${rule} 23px, ${rule} 24px)`, backgroundSize: '100% 24px', backgroundPosition: '0 6px' }
      : t.paperStyle === 'grid' ? { backgroundImage: `linear-gradient(to right, ${rule} 1px, transparent 1px), linear-gradient(to bottom, ${rule} 1px, transparent 1px)`, backgroundSize: '20px 20px' }
      : t.paperStyle === 'dots' ? { backgroundImage: `radial-gradient(circle, ${rule} 1.2px, transparent 1.4px)`, backgroundSize: '18px 18px' }
      : {};
    const pill = (bg: string, color: string, text: string) => (
      <span style={{ background: bg, color, padding: '3px 10px', borderRadius: `${t.cornerRoundness}px`, fontSize: '0.8rem', lineHeight: 1.4 }}>{text}</span>
    );
    return (
      <div style={{
        backgroundColor: t.bgApp, padding: '16px', borderRadius: `${t.cornerRoundness}px`, border: `1px solid ${t.borderSubtle}`,
        ...(hasBackdrop(t.appLook) ? previewStyle(t.appLook) : {}),
        ...(imageUrls.app && t.appBgImageId ? { backgroundImage: imageLayer(imageUrls.app, t.bgApp, t.appBgDim ?? DEFAULT_APP_DIM), backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}>
        <div style={{
          ...paper, backgroundColor: t.bgPaper,
          ...(hasBackdrop(t.pageLook) ? previewStyle(t.pageLook) : {}),
          ...(t.pageLook?.glass ? { backgroundColor: `color-mix(in srgb, ${t.bgPaper} ${Math.round((1 - t.pageLook.glass * 0.82) * 100)}%, transparent)`, backdropFilter: 'blur(8px)' } : {}),
          ...(imageUrls.page && t.pageBgImageId
            ? {
                backgroundImage: [paper.backgroundImage, imageLayer(imageUrls.page, t.bgPaper, t.pageBgDim ?? DEFAULT_PAGE_DIM)].filter(Boolean).join(', '),
                backgroundSize: [paper.backgroundSize, 'cover'].filter(Boolean).join(', '),
                backgroundPosition: [paper.backgroundPosition, 'center'].filter(Boolean).join(', '),
              }
            : {}), color: t.textMain, padding: '16px 18px 16px 30px', borderRadius: `${t.cornerRoundness}px`,
          border: `1px solid ${t.borderStrong}`, borderLeft: t.marginLine ? `2px solid ${vars['--paper-margin']}` : `1px solid ${t.borderStrong}`,
          boxShadow: vars['--shadow-paper'], fontFamily: t.fontFamily ? `"${t.fontFamily}", serif` : t.handwriting ? 'Caveat, cursive' : 'inherit', fontSize: t.handwriting ? '1.2rem' : '0.95rem',
          lineHeight: t.paperStyle === 'lined' ? '24px' : 1.6,
        }}>
          <div style={{ fontWeight: 700 }}>Chapter One</div>
          <div style={{ color: t.textSecondary }}>The lamp flickered twice, and then the room was quiet.</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {pill(t.accentPrimary, '#fff', 'Button')}
            {pill(vars['--accent-gold-bg'], t.accentGold, 'Highlight')}
            {pill(vars['--tag-bg'], t.textSecondary, 'Tag')}
          </div>
        </div>
      </div>
    );
  };

  const tabBtn = (id: Tab, text: string, icon: React.ReactNode) => (
    <button key={id} onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.86rem', fontWeight: 600,
      color: tab === id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)', backgroundColor: tab === id ? 'var(--accent-gold-bg)' : 'transparent',
    }}>{icon}<span>{text}</span></button>
  );

  const inputStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Appearance" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: '24px', color: 'var(--text-main)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {tabBtn('theme', 'Theme', <Palette size={15} />)}
            {tabBtn('type', 'Type', <Type size={15} />)}
            {tabBtn('sound', 'Sound', <Volume2 size={15} />)}
            {tabBtn('looks', 'Looks', <Sparkles size={15} />)}
          </div>
          <button aria-label="Close" onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '6px', display: 'flex' }}><X size={20} /></button>
        </div>

        {tab === 'theme' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={own} onChange={e => setOwn(e.target.checked)} style={{ accentColor: 'var(--accent-gold)' }} />
              Use its own theme for “{project.title || 'this document'}”
            </label>
            <div>
              <div style={sectionLabel}>Themes</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {ownedThemes.map(t => {
                  const isActive = shownMode === t.id;
                  return (
                    <div key={t.id} onClick={() => pickBuiltIn(t.id)} style={{
                      backgroundColor: t.bg, color: t.text, borderRadius: 'var(--radius-md)', padding: '12px', cursor: 'pointer',
                      border: isActive ? `2px solid ${t.accent}` : '1px solid var(--border-subtle)', boxShadow: isActive ? `0 0 12px ${t.accent}40` : 'var(--shadow-sm)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{t.name}</span>
                        {isActive && <Check size={14} style={{ color: t.accent }} />}
                      </div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.75 }}>{t.subtitle}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>More themes are in the Shop, where you can preview each one before you buy it.</div>
            </div>

            {builtInName && (
              <div>
                <div style={sectionLabel}>Pictures for {builtInName}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
                  <PicturePicker title="Project background" imageId={builtInImages.appBgImageId} dim={builtInImages.appBgDim ?? DEFAULT_APP_DIM}
                    onPick={f => pickBuiltInImage(f, 'app')}
                    onRemove={() => setThemeImages(builtInId, { ...builtInImages, appBgImageId: undefined })}
                    onDim={d => setThemeImages(builtInId, { ...builtInImages, appBgDim: d })} />
                  <PicturePicker title="Document background" imageId={builtInImages.pageBgImageId} dim={builtInImages.pageBgDim ?? DEFAULT_PAGE_DIM}
                    onPick={f => pickBuiltInImage(f, 'page')}
                    onRemove={() => setThemeImages(builtInId, { ...builtInImages, pageBgImageId: undefined })}
                    onDim={d => setThemeImages(builtInId, { ...builtInImages, pageBgDim: d })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: 12 }}>
                  <LookEditor title="Behind the app" look={builtInImages.appLook} onChange={appLook => setThemeImages(builtInId, { ...builtInImages, appLook })} />
                  <LookEditor title="Behind the page" page look={builtInImages.pageLook} onChange={pageLook => setThemeImages(builtInId, { ...builtInImages, pageLook })} />
                </div>
                {!draft && imageError && <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: 6 }}>{imageError}</div>}
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6 }}>A document picture replaces this theme’s page texture. Each theme keeps its own pictures.</div>
              </div>
            )}

            <div>
              <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Your themes</span>
                {!draft && (
                  <button onClick={() => setDraft(newCustomTheme())} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 0 }}>
                    <Plus size={13} /> Make your own · {CUSTOM_THEME_COST} pts
                  </button>
                )}
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 8 }}><Upload size={12} /> Add a theme from a file
                <input type="file" accept=".json,application/json" hidden onChange={async e => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  const got = parseThemeFile(await f.text());
                  if ('error' in got) showToast(got.error, 'info'); else importCustomTheme(got);
                }} />
              </label>
              {customThemes.length === 0 && !draft && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>None yet. Each one costs {CUSTOM_THEME_COST} Quill Points to create. Editing it afterwards is free.</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {customThemes.map(t => {
                  const active = shownMode === 'custom' && shownCustomId === t.id;
                  return (
                    <div key={t.id} style={{ border: active ? `2px solid ${t.accentGold}` : '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div onClick={() => pickCustom(t)} style={{ background: t.bgApp, color: t.textMain, padding: '12px', cursor: 'pointer' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                          {[t.bgPaper, t.accentPrimary, t.accentGold, t.textMain].map((c, i) => (
                            <span key={i} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid rgba(128,128,128,.4)' }} />
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', background: 'var(--bg-card)' }}>
                        <button onClick={() => setDraft({ ...t })} title="Edit" style={{ flex: 1, padding: 6, display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)' }}><Pencil size={13} /></button>
                        <button onClick={() => { const f = themeFile(t); storageService.downloadTextFile(f.fileName, f.text, 'application/json'); }} title="Save as a file to share" aria-label={`Save ${t.name} as a file`} style={{ flex: 1, padding: 6, display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)' }}><Download size={13} /></button>
                        <button onClick={() => deleteCustomTheme(t.id)} title="Delete" style={{ flex: 1, padding: 6, display: 'flex', justifyContent: 'center', color: 'var(--text-secondary)' }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {draft && (
              <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {renderPreview(draft)}
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Theme name" style={inputStyle} />
                <div>
                  <div style={sectionLabel}>Start from</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {ownedThemes.map(t => (
                      <button key={t.id} onClick={() => startFrom(t)} title={t.name} style={{ width: 26, height: 26, borderRadius: 6, background: t.bg, border: `2px solid ${t.accent}` }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {COLOR_FIELDS.map(f => (
                    <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <input type="color" value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} style={{ width: 30, height: 26, padding: 0, border: 'none', background: 'none' }} />
                      {f.label}
                    </label>
                  ))}
                </div>
                {contrastRatio(draft.textMain, draft.bgPaper) < 4.5 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}>Your text and page colors are close, which may be hard to read.</div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', fontSize: '0.84rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Corner roundness: {draft.cornerRoundness}px
                    <input type="range" min={0} max={24} value={draft.cornerRoundness} onChange={e => setDraft({ ...draft, cornerRoundness: Number(e.target.value) })} style={{ accentColor: 'var(--accent-gold)' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>Paper
                    <select value={draft.paperStyle || 'plain'} onChange={e => setDraft({ ...draft, paperStyle: e.target.value as CustomThemeConfig['paperStyle'] })} style={inputStyle}>
                      {PAPER_STYLES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!draft.marginLine} onChange={e => setDraft({ ...draft, marginLine: e.target.checked })} /> Margin line</label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!draft.handwriting} onChange={e => setDraft({ ...draft, handwriting: e.target.checked })} /> Handwriting text</label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
                  <PicturePicker title="Project background" imageId={draft.appBgImageId} dim={draft.appBgDim ?? DEFAULT_APP_DIM}
                    onPick={f => pickImage(f, 'app')} onRemove={() => removeImage('app')} onDim={d => setDraft({ ...draft, appBgDim: d })} />
                  <PicturePicker title="Document background" imageId={draft.pageBgImageId} dim={draft.pageBgDim ?? DEFAULT_PAGE_DIM}
                    onPick={f => pickImage(f, 'page')} onRemove={() => removeImage('page')} onDim={d => setDraft({ ...draft, pageBgDim: d })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  <LookEditor title="Behind the app" look={draft.appLook} onChange={appLook => setDraft({ ...draft, appLook })} />
                  <LookEditor title="Behind the page" page look={draft.pageLook} onChange={pageLook => setDraft({ ...draft, pageLook })} />
                </div>
                {imageError && <div style={{ fontSize: '0.78rem', color: '#ef4444' }}>{imageError}</div>}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', fontSize: '0.84rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>Document font
                    <select value={draft.fontFamily || ''} onChange={e => setDraft({ ...draft, fontFamily: e.target.value || undefined })} style={inputStyle}>
                      <option value="">Use my usual font</option>
                      {fontChoices.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', cursor: 'pointer' }}>
                    <Upload size={13} /> Upload a font
                    <input type="file" accept={FONT_EXTENSIONS.map(e => `.${e}`).join(',')} style={{ display: 'none' }}
                      onChange={e => { pickFont(e.target.files?.[0], true); e.target.value = ''; }} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setDraft(null)} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Cancel</button>
                  <button
                    disabled={draftIsNew && !canAfford}
                    onClick={() => { if (saveCustomTheme({ ...draft, name: draft.name.trim() || 'My theme' })) setDraft(null); }}
                    style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: '#fff', fontWeight: 600, opacity: draftIsNew && !canAfford ? 0.5 : 1 }}>
                    {draftIsNew ? `Create · ${CUSTOM_THEME_COST} pts` : 'Save'}
                  </button>
                </div>
                {draftIsNew && !canAfford && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>You have {userStats.quillPoints} points. You need {CUSTOM_THEME_COST - userStats.quillPoints} more.</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <div style={sectionLabel}>Typeface</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[...FONTS, ...customFonts.map(c => ({ id: c.family as EditorFont, name: c.name, sample: 'The Great Bell tolled across the water.' }))].map(f => (
                  <button key={f.id} onClick={() => setFont(f.id)} style={{ ...row(userStats.activeFont === f.id), justifyContent: 'space-between' }}>
                    <span>
                      <span style={{ fontFamily: f.id, fontWeight: 600 }}>{f.name}</span>
                      <span style={{ display: 'block', fontFamily: f.id, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{f.sample}</span>
                    </span>
                    {userStats.activeFont === f.id && <Check size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={sectionLabel}>Your fonts</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))', cursor: 'pointer', fontSize: '0.84rem' }}>
                  <Upload size={14} /> Upload a font file
                  <input type="file" accept={FONT_EXTENSIONS.map(e => `.${e}`).join(',')} style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const name = await uploadFontFile(file, undefined, true);
                      if (name) setFont(name as EditorFont);
                    }} />
                </label>
                <input value={googleFont} onChange={e => setGoogleFont(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addGoogleFont(); }} placeholder="Or a Google Fonts name" style={{ ...inputStyle, minWidth: 190 }} />
                <button onClick={addGoogleFont} style={{ padding: '7px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', fontSize: '0.84rem' }}>Add</button>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6 }}>.ttf, .otf, .woff or .woff2. Fonts are saved in this browser and sync with your documents.</div>
              {customFonts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                  {customFonts.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.84rem' }}>
                      <span style={{ fontFamily: `"${f.family}", serif` }}>{f.name} <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>· {f.source === 'local' ? 'uploaded' : f.source}</span></span>
                      <button onClick={() => deleteCustomFont(f.id)} title="Remove" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <label style={{ fontSize: '0.88rem' }}>Font size: {userStats.fontSize}px
                <input type="range" min={14} max={26} value={userStats.fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
              </label>
              <label style={{ fontSize: '0.88rem' }}>Line height: {userStats.lineHeight}x
                <input type="range" min={1.4} max={2.4} step={0.1} value={userStats.lineHeight} onChange={e => setLineHeight(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={toggleIndentParagraphs} style={{ ...row(userStats.indentParagraphs), width: 'auto', flex: 1 }}>Paragraph indentation: {userStats.indentParagraphs ? 'on' : 'off'}</button>
              <button onClick={toggleTypewriterMode} style={{ ...row(userStats.typewriterMode), width: 'auto', flex: 1 }}>Typewriter scrolling: {userStats.typewriterMode ? 'on' : 'off'}</button>
            </div>
            <div>
              <div style={sectionLabel}>Page</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {PAGE_PRESETS.map(preset => {
                  const on = samePage(normalizePage(userStats.page), preset.page);
                  return (
                    <button key={preset.name} onClick={() => setPageLayout(preset.page)} style={{ ...row(on), width: 'auto', padding: '6px 12px', fontSize: '0.82rem' }}>
                      {preset.name}
                    </button>
                  );
                })}
              </div>
              {(() => {
                const page = normalizePage(userStats.page);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                    <label style={{ fontSize: '0.86rem' }}>Page width: {page.width}px
                      <input type="range" min={PAGE_LIMITS.width[0]} max={PAGE_LIMITS.width[1]} step={20} value={page.width}
                        onChange={e => setPageLayout({ width: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                    </label>
                    <label style={{ fontSize: '0.86rem' }}>Side margins: {page.marginX}px
                      <input type="range" min={PAGE_LIMITS.marginX[0]} max={PAGE_LIMITS.marginX[1]} step={4} value={page.marginX}
                        onChange={e => setPageLayout({ marginX: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                    </label>
                    <label style={{ fontSize: '0.86rem' }}>Top margin: {page.marginY}px
                      <input type="range" min={PAGE_LIMITS.marginY[0]} max={PAGE_LIMITS.marginY[1]} step={4} value={page.marginY}
                        onChange={e => setPageLayout({ marginY: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                    </label>
                  </div>
                );
              })()}
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6 }}>Margins shrink on narrow windows. These are for writing; the printed book layout is separate.</div>
            </div>

            <div>
              <div style={sectionLabel}>Cursor</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CURSORS.map(c => (
                  <button key={c.id} onClick={() => setCursor(c.id)} style={{ ...row(userStats.activeCursor === c.id), width: 'auto' }}>
                    <span>{c.icon}</span><span>{c.name}</span>
                  </button>
                ))}
              </div>
              <CursorBuilder />
            </div>
          </div>
        )}

        {tab === 'looks' && <ShopBrowser embedded categories={LOOKS} />}

        {tab === 'sound' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <div>
              <div style={sectionLabel}>Keystrokes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(keystrokeOptions([], ownedKeystrokes(userStats.unlockedCosmetics, userStats.unlockedBadges), userStats.keystrokeSound) as Array<{ id: KeystrokeSound; label: string; icon: string }>).map(k => (
                  <button key={k.id} onClick={() => { setKeystrokeSound(k.id); playKeystroke('a', k.id); }} style={row(userStats.keystrokeSound === k.id)}>
                    <span>{k.icon}</span><span style={{ flex: 1 }}>{k.label}</span>
                    {userStats.keystrokeSound === k.id && <Check size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                  </button>
                ))}
              </div>
              {userStats.keystrokeSound !== 'off' && (
                <label style={{ display: 'block', marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume
                  <input type="range" min={0.1} max={1} step={0.05} value={userStats.keystrokeVolume ?? 0.45} onChange={e => setKeystrokeVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                </label>
              )}
            </div>
            <div>
              <div style={sectionLabel}>Ambient</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[...AMBIENT, ...(userStats.customSoundscapes || []).map(s => ({ id: s.id, label: s.name, icon: <Volume2 size={15} /> }))].map(a => (
                  <button key={a.id} onClick={() => setAmbientSound(a.id)} style={row(userStats.ambientSound === a.id)}>
                    {a.icon}<span style={{ flex: 1 }}>{a.label}</span>
                    {userStats.ambientSound === a.id && <Check size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                  </button>
                ))}
              </div>
              {userStats.ambientSound !== 'off' && (
                <label style={{ display: 'block', marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume
                  <input type="range" min={0.05} max={1} step={0.05} value={userStats.ambientVolume} onChange={e => setAmbientVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-gold)' }} />
                </label>
              )}
            </div>
            <SoundscapeBuilder />
            <SoundBuilder />
          </div>
        )}
      </div>
    </div>
  );
};
