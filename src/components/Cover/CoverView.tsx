import { saveBlob } from '../../services/saveFile';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { CoverInspector } from './CoverInspector';
import { BOOK_FONTS, normalizeBook } from '../../services/book/design';
import { estimatePages } from '../../services/cover/design';
import { BLEED, SAFE, cleanCover, cleanLayer, coverAssetIds, duplicateLayer, geometry, imageLayer, moveLayer, shapeLayer, spineText, starterCover, textLayer, type CoverDesign, type CoverLayer, type CoverSetup, type Fill, type Move, type Rect } from '../../services/cover/design';
import { drawCover, layerBox, loadFonts, loadPictures, renderToCanvas, toBlob, type Picture } from '../../services/cover/render';
import { jpegToPdf } from '../../services/cover/pdf';
import { newAssetId, putAsset } from '../../services/assetStore';
import { validateImageFile } from '../../services/imageUpload';
import { ArrowLeft, Download, Eye, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

const COVER_FONTS = [...BOOK_FONTS, 'Cinzel', 'Cinzel Decorative', 'Bebas Neue', 'Abril Fatface', 'Oswald', 'Montserrat', 'Raleway', 'Anton', 'Archivo Black', 'Great Vibes', 'Pacifico', 'Caveat', 'Permanent Marker', 'Special Elite', 'Orbitron', 'Lobster', 'UnifrakturCook'];

const bar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' };
const PX = 96; // css pixels per inch at a zoom of 1
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type Handle = (typeof HANDLES)[number];
const handlePos: Record<Handle, [number, number]> = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
const cursorFor: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

type Drag =
  | { mode: 'move'; id: string; px: number; py: number; orig: CoverLayer }
  | { mode: 'resize'; id: string; handle: Handle; px: number; py: number; orig: CoverLayer; box: { w: number; h: number } }
  | { mode: 'rotate'; id: string; orig: CoverLayer; box: { w: number; h: number } };

const rotate = (x: number, y: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

const stem = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cover';

function download(name: string, data: Blob | Uint8Array, type: string) {
  void saveBlob(name, data instanceof Blob ? data : new Blob([data as BlobPart], { type }));
}

export const CoverView: React.FC = () => {
  const { project, userStats, setViewMode, updateProjectMeta, showToast } = useAsterism();
  const book = useMemo(() => normalizeBook(project.book), [project.book]);

  const words = useMemo(() => project.chapters.reduce((n, c) => n + (c.wordCount || 0), 0), [project.chapters]);
  const startSetup = useCallback((): CoverSetup => ({
    pages: book.typesetPages ?? estimatePages(words, book.width - book.inside - book.outside, book.height - book.top - book.bottom, book.fontSize, book.lineHeight),
    paper: 'bw-white',
  }), [book, words]);

  const [design, setDesign] = useState<CoverDesign>(() => {
    const saved = cleanCover(project.coverDesign);
    if (saved) return saved;
    const setup = startSetup();
    return starterCover(geometry(book.width, book.height, setup), { title: project.title, author: project.author, synopsis: project.synopsis }, setup);
  });
  const geo = useMemo(() => geometry(book.width, book.height, design.setup), [book.width, book.height, design.setup]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'wrap' | 'front' | 'back'>('wrap');
  const [guides, setGuides] = useState(true);
  const [zoomMul, setZoomMul] = useState(1);
  const [pictures, setPictures] = useState<Map<string, Picture>>(new Map());
  const [fontsTick, setFontsTick] = useState(0);
  const [area, setArea] = useState({ w: 900, h: 600 });
  const [snap, setSnap] = useState<{ x?: number; y?: number }>({});
  const [menu, setMenu] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measure = useRef<CanvasRenderingContext2D | null>(null);
  const drag = useRef<Drag | null>(null);
  const designRef = useRef(design);
  designRef.current = design;
  const past = useRef<CoverDesign[]>([]);
  const future = useRef<CoverDesign[]>([]);
  const lastPush = useRef(0);
  const [, force] = useState(0);

  if (!measure.current && typeof document !== 'undefined') measure.current = document.createElement('canvas').getContext('2d');

  // ---- keeping and undoing -------------------------------------------------------------------

  // one history step for a run of small changes made close together, such as dragging a slider
  const remember = useCallback(() => {
    const now = Date.now();
    if (now - lastPush.current > 600) { past.current.push(designRef.current); if (past.current.length > 60) past.current.shift(); future.current = []; }
    lastPush.current = now;
  }, []);
  const commit = useCallback((next: CoverDesign) => { remember(); setDesign(next); force(n => n + 1); }, [remember]);
  const undo = () => { const prev = past.current.pop(); if (!prev) return; future.current.push(designRef.current); setDesign(prev); lastPush.current = 0; force(n => n + 1); };
  const redo = () => { const next = future.current.pop(); if (!next) return; past.current.push(designRef.current); setDesign(next); lastPush.current = 0; force(n => n + 1); };

  // save a moment after the last change, and when leaving
  const saved = useRef(JSON.stringify(project.coverDesign ?? null));
  const flush = useCallback(() => {
    const text = JSON.stringify(designRef.current);
    if (text !== saved.current) { saved.current = text; updateProjectMeta({ coverDesign: designRef.current }); }
  }, [updateProjectMeta]);
  useEffect(() => { const t = setTimeout(flush, 600); return () => clearTimeout(t); }, [design, flush]);
  useEffect(() => flush, [flush]);

  // ---- pictures and fonts ----------------------------------------------------------------------

  const customFamilies = useMemo(() => (userStats.customFonts || []).map(f => f.family), [userStats.customFonts]);
  const ids = coverAssetIds(design).join('|');
  useEffect(() => {
    let live = true;
    loadPictures(ids ? ids.split('|') : [], new Map(pictures)).then(m => { if (live) setPictures(m); });
    return () => { live = false; };
    // pictures is read only to keep what is already loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  const fontKey = [...new Set(design.layers.filter(l => l.kind === 'text').map(l => (l as { font: string }).font))].join('|');
  useEffect(() => {
    let live = true;
    loadFonts(design, customFamilies).then(() => { if (live) setFontsTick(t => t + 1); });
    return () => { live = false; };
    // only the set of fonts matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);
  useEffect(() => {
    const again = () => setFontsTick(n => n + 1);
    document.fonts?.addEventListener?.('loadingdone', again);
    return () => document.fonts?.removeEventListener?.('loadingdone', again);
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- what is on screen -------------------------------------------------------------------------

  const view: Rect = mode === 'front' ? { x: geo.front.x, y: 0, w: geo.trimW + BLEED, h: geo.totalH }
    : mode === 'back' ? { x: 0, y: 0, w: geo.trimW + BLEED, h: geo.totalH }
    : { x: 0, y: 0, w: geo.totalW, h: geo.totalH };
  const fit = Math.min((area.w - 48) / (view.w * PX), (area.h - 48) / (view.h * PX), 4);
  const scale = Math.max(0.05, fit * zoomMul) * PX; // css pixels per inch
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ppi = scale * dpr;
    canvas.width = Math.max(1, Math.round(view.w * ppi));
    canvas.height = Math.max(1, Math.round(view.h * ppi));
    drawCover(canvas.getContext('2d')!, design, geo, { ppi, view, pictures });
    // the view and sheet size are read through scale and mode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, geo, pictures, scale, dpr, mode, fontsTick]);

  const selected = design.layers.find(l => l.id === selectedId);
  const boxOf = useCallback((l: CoverLayer) => layerBox(measure.current!, l), []);

  // ---- editing ---------------------------------------------------------------------------------

  const updateLayer = useCallback((id: string, patch: Partial<CoverLayer>) => {
    const cur = designRef.current;
    const layers = cur.layers.map(l => {
      if (l.id !== id) return l;
      return cleanLayer({ ...l, ...patch }) ?? l;
    });
    commit({ ...cur, layers });
  }, [commit]);

  const addLayer = (l: CoverLayer) => {
    const cur = designRef.current;
    if (cur.layers.length >= 40) { showToast('A cover can have 40 layers. Delete one to add another.', 'info'); return; }
    commit({ ...cur, layers: [...cur.layers, l] });
    setSelectedId(l.id);
  };

  const onAdd = (kind: 'text' | 'rect' | 'ellipse' | 'line' | 'spine') => {
    const f = geo.front;
    if (kind === 'text') addLayer(textLayer({ x: f.x + 0.4, y: f.y + 1, w: geo.trimW - 0.8, text: 'Your text' }));
    else if (kind === 'spine') addLayer(spineText(geo, project.title));
    else if (kind === 'line') addLayer(shapeLayer({ shape: 'line', x: f.x + 0.6, y: f.y + geo.trimH / 2, w: geo.trimW - 1.2, h: 0.1, fill: { kind: 'solid', color: '#ffffff' }, stroke: { width: 2, color: '#ffffff' } }));
    else addLayer(shapeLayer({ shape: kind, x: f.x + 0.6, y: f.y + 1, w: geo.trimW - 1.2, h: kind === 'ellipse' ? geo.trimW - 1.2 : 1.5 }));
  };

  const onPicture = async (file: File, replaceId?: string) => {
    const bad = validateImageFile(file);
    if (bad) { showToast(bad, 'info'); return; }
    try {
      const assetId = await putAsset(file, newAssetId('cvr'));
      const bmp = await createImageBitmap(file);
      const ratio = bmp.height / bmp.width;
      bmp.close();
      if (replaceId) { updateLayer(replaceId, { assetId } as Partial<CoverLayer>); return; }
      const w = Math.min(geo.trimW * 0.85, 4), h = w * ratio;
      addLayer(imageLayer(assetId, { x: geo.front.x + (geo.trimW - w) / 2, y: geo.front.y + 0.5, w, h, name: file.name.replace(/\.[^.]+$/, '').slice(0, 30) }));
    } catch { showToast('Could not use that picture.', 'info'); }
  };

  const onFit = (id: string, where: 'sheet' | 'front' | 'back') => {
    const r: Rect = where === 'sheet' ? { x: 0, y: 0, w: geo.totalW, h: geo.totalH }
      : where === 'front' ? { x: geo.front.x, y: 0, w: geo.trimW + BLEED, h: geo.totalH }
        : { x: 0, y: 0, w: geo.trimW + BLEED, h: geo.totalH };
    updateLayer(id, { x: r.x, y: r.y, w: r.w, h: r.h, rotation: 0, fit: 'cover' } as Partial<CoverLayer>);
  };

  const onDelete = (id: string) => { commit({ ...designRef.current, layers: designRef.current.layers.filter(l => l.id !== id) }); setSelectedId(null); };
  const onDuplicate = (id: string) => { const r = duplicateLayer(designRef.current.layers, id); if (r.id) { commit({ ...designRef.current, layers: r.layers }); setSelectedId(r.id); } };
  const onMove = (id: string, move: Move) => commit({ ...designRef.current, layers: moveLayer(designRef.current.layers, id, move) });
  const onSetup = (patch: Partial<CoverSetup>) => { const cur = designRef.current; const next = cleanCover({ ...cur, setup: { ...cur.setup, ...patch } }); if (next) commit(next); };
  const onBackground = (background: Fill) => commit({ ...designRef.current, background });
  const onRestart = () => {
    if (!window.confirm('Start the cover over? Your layers will be replaced with a fresh title and author.')) return;
    const setup = startSetup();
    commit(starterCover(geometry(book.width, book.height, setup), { title: project.title, author: project.author, synopsis: project.synopsis }, setup));
    setSelectedId(null);
  };

  // ---- pointer ------------------------------------------------------------------------------------

  const toSheet = (e: { clientX: number; clientY: number }) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return { x: view.x + (e.clientX - r.left) / scale, y: view.y + (e.clientY - r.top) / scale };
  };

  const hit = (p: { x: number; y: number }): CoverLayer | undefined => {
    const layers = designRef.current.layers;
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.hidden || l.locked) continue;
      const b = boxOf(l);
      const [lx, ly] = rotate(p.x - (l.x + b.w / 2), p.y - (l.y + b.h / 2), -l.rotation);
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return l;
    }
    return undefined;
  };

  const onDown = (e: React.PointerEvent) => {
    overlayRef.current?.focus();
    const p = toSheet(e);
    const l = hit(p);
    setSelectedId(l?.id ?? null);
    if (!l) return;
    overlayRef.current?.setPointerCapture(e.pointerId);
    remember();
    drag.current = { mode: 'move', id: l.id, px: p.x, py: p.y, orig: l };
  };

  const startHandle = (e: React.PointerEvent, h: Handle | 'rot') => {
    if (!selected) return;
    e.stopPropagation();
    overlayRef.current?.setPointerCapture(e.pointerId);
    remember();
    const p = toSheet(e);
    const box = boxOf(selected);
    drag.current = h === 'rot' ? { mode: 'rotate', id: selected.id, orig: selected, box } : { mode: 'resize', id: selected.id, handle: h, px: p.x, py: p.y, orig: selected, box };
  };

  // lines worth lining things up with, across and down
  const lines = useMemo(() => {
    const xs = [0, BLEED, geo.back.x + SAFE, geo.back.x + geo.trimW / 2, geo.spineRect.x, geo.spineRect.x + geo.spine / 2, geo.front.x, geo.front.x + SAFE, geo.front.x + geo.trimW / 2, geo.front.x + geo.trimW - SAFE, geo.front.x + geo.trimW, geo.totalW - BLEED, geo.totalW];
    const ys = [0, BLEED, BLEED + SAFE, geo.totalH / 2, geo.totalH - BLEED - SAFE, geo.totalH - BLEED, geo.totalH];
    return { xs, ys };
  }, [geo]);

  const onMoveEvent = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toSheet(e);
    const cur = designRef.current;
    const live = (id: string, patch: Partial<CoverLayer>) => setDesign({ ...cur, layers: cur.layers.map(l => (l.id === id ? ({ ...l, ...patch } as CoverLayer) : l)) });

    if (d.mode === 'move') {
      let x = d.orig.x + (p.x - d.px), y = d.orig.y + (p.y - d.py);
      const b = boxOf(d.orig);
      const near = 6 / scale;
      const found: { x?: number; y?: number } = {};
      if (d.orig.rotation % 180 === 0 && !e.altKey) {
        const best = (starts: number[], size: number, targets: number[]) => {
          let off = near, pick: number | undefined, at: number | undefined;
          for (const s of starts) for (const t of targets) if (Math.abs(s - t) < Math.abs(off)) { off = s - t; pick = t; at = s; }
          return pick === undefined || at === undefined ? null : { shift: pick - at, line: pick };
        };
        const sx = best([x, x + b.w / 2, x + b.w], b.w, lines.xs);
        const sy = best([y, y + b.h / 2, y + b.h], b.h, lines.ys);
        if (sx) { x += sx.shift; found.x = sx.line; }
        if (sy) { y += sy.shift; found.y = sy.line; }
      }
      setSnap(found);
      live(d.id, { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
    } else if (d.mode === 'rotate') {
      const cx = d.orig.x + d.box.w / 2, cy = d.orig.y + d.box.h / 2;
      let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      live(d.id, { rotation: Math.round(deg * 10) / 10 });
    } else {
      const o = d.orig;
      const [ldx, ldy] = rotate(p.x - d.px, p.y - d.py, -o.rotation);
      const hd = d.handle;
      const isText = o.kind === 'text';
      let w = d.box.w + (hd.includes('e') ? ldx : hd.includes('w') ? -ldx : 0);
      let h = d.box.h + (hd.includes('s') ? ldy : hd.includes('n') ? -ldy : 0);
      const corner = hd.length === 2;
      if (corner && !isText && (o.kind === 'image' ? !e.shiftKey : e.shiftKey)) {
        const ratio = d.box.w / Math.max(0.01, d.box.h);
        if (Math.abs(w - d.box.w) / d.box.w > Math.abs(h - d.box.h) / d.box.h) h = w / ratio; else w = h * ratio;
      }
      w = Math.max(0.1, w);
      h = Math.max(0.1, h);
      const patched = { ...o, w, ...(isText ? {} : { h }) } as CoverLayer;
      const nb = boxOf(patched);
      // the edge opposite the one being dragged stays where it is
      const anchor = (bw: number, bh: number): [number, number] => [hd.includes('e') ? -bw / 2 : hd.includes('w') ? bw / 2 : 0, hd.includes('s') ? -bh / 2 : hd.includes('n') ? bh / 2 : isText ? -bh / 2 : 0];
      const a0 = anchor(d.box.w, d.box.h), a1 = anchor(nb.w, nb.h);
      const [r0x, r0y] = rotate(a0[0], a0[1], o.rotation), [r1x, r1y] = rotate(a1[0], a1[1], o.rotation);
      const cx = o.x + d.box.w / 2 + r0x - r1x, cy = o.y + d.box.h / 2 + r0y - r1y;
      live(d.id, { x: Math.round((cx - nb.w / 2) * 1000) / 1000, y: Math.round((cy - nb.h / 2) * 1000) / 1000, w: Math.round(nb.w * 1000) / 1000, ...(isText ? {} : { h: Math.round(nb.h * 1000) / 1000 }) });
    }
  };

  const onUp = () => {
    if (drag.current) { drag.current = null; setSnap({}); force(n => n + 1); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (!selected) return;
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); onDuplicate(selected.id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete(selected.id); return; }
    if (e.key === 'Escape') { setSelectedId(null); return; }
    const step = e.shiftKey ? 0.1 : 0.01;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (move[e.key] && !selected.locked) { e.preventDefault(); updateLayer(selected.id, { x: selected.x + move[e.key][0], y: selected.y + move[e.key][1] }); }
  };

  // ---- files -----------------------------------------------------------------------------------------

  const [busy, setBusy] = useState(false);
  const exportAs = async (what: 'pdf' | 'png' | 'front-png' | 'front-jpg') => {
    setBusy(true);
    setMenu(false);
    try {
      const d = designRef.current;
      const pics = await loadPictures(coverAssetIds(d), new Map(pictures));
      await loadFonts(d, customFamilies);
      const name = stem(project.title);
      const frontView: Rect = { x: geo.front.x, y: BLEED, w: geo.trimW, h: geo.trimH };
      if (what === 'png' || what === 'pdf') {
        const canvas = renderToCanvas(d, geo, { ppi: 300, pictures: pics });
        if (what === 'png') download(`${name}-cover-wrap.png`, await toBlob(canvas, 'image/png'), 'image/png');
        else {
          const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.94)).arrayBuffer());
          download(`${name}-cover-wrap.pdf`, jpegToPdf(jpeg, canvas.width, canvas.height, geo.totalW, geo.totalH), 'application/pdf');
        }
      } else if (what === 'front-png') {
        download(`${name}-front-cover.png`, await toBlob(renderToCanvas(d, geo, { ppi: 300, view: frontView, pictures: pics }), 'image/png'), 'image/png');
      } else {
        // the usual ebook size: 2560 pixels tall
        download(`${name}-front-cover.jpg`, await toBlob(renderToCanvas(d, geo, { ppi: 2560 / geo.trimH, view: frontView, pictures: pics }), 'image/jpeg', 0.92), 'image/jpeg');
      }
      showToast('Cover saved to your downloads', 'success');
    } catch { showToast('Could not make that file.', 'info'); }
    setBusy(false);
  };

  // ---- drawing the selection and the guides -------------------------------------------------------------

  const sheetPx = (x: number, y: number) => [(x - view.x) * scale, (y - view.y) * scale] as const;
  const selBox = selected && !selected.hidden ? boxOf(selected) : null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', backgroundColor: 'var(--bg-app)' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 14px', backgroundColor: 'var(--toolbar-bg)', borderBottom: '1px solid var(--border-subtle)', position: 'relative', zIndex: 5 }}>
          <button onClick={() => { flush(); setViewMode('book_preview'); }} style={bar}><ArrowLeft size={15} /> Back to the book</button>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>Cover creator</span>
          <span style={{ flex: 1 }} />
          <div role="group" aria-label="What to show" style={{ display: 'flex', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {([['wrap', 'Whole wrap'], ['front', 'Front'], ['back', 'Back']] as const).map(([id, name]) => (
              <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} style={{ ...bar, borderRadius: 0, backgroundColor: mode === id ? 'var(--accent-gold-bg)' : 'transparent', fontWeight: mode === id ? 700 : 500 }}>{name}</button>
            ))}
          </div>
          <button onClick={() => setGuides(g => !g)} aria-pressed={guides} style={{ ...bar, border: '1px solid var(--border-subtle)' }}><Eye size={14} /> Guides</button>
          <button onClick={() => setZoomMul(z => Math.max(0.4, z / 1.25))} aria-label="Zoom out" style={bar}><ZoomOut size={15} /></button>
          <button onClick={() => setZoomMul(1)} style={{ ...bar, fontSize: '0.74rem' }}>Fit</button>
          <button onClick={() => setZoomMul(z => Math.min(4, z * 1.25))} aria-label="Zoom in" style={bar}><ZoomIn size={15} /></button>
          <button onClick={undo} disabled={!past.current.length} aria-label="Undo" title="Undo (Ctrl+Z)" style={{ ...bar, opacity: past.current.length ? 1 : 0.4 }}><Undo2 size={15} /></button>
          <button onClick={redo} disabled={!future.current.length} aria-label="Redo" title="Redo (Ctrl+Y)" style={{ ...bar, opacity: future.current.length ? 1 : 0.4 }}><Redo2 size={15} /></button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenu(m => !m)} disabled={busy} aria-expanded={menu} style={{ ...bar, backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}><Download size={14} /> {busy ? 'Making the file…' : 'Save cover'}</button>
            {menu && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', width: 300, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {([['pdf', 'Print file (PDF)', 'The whole wrap at its exact size, with bleed. For your printer.'], ['png', 'Whole wrap (PNG)', 'Back, spine and front in one picture.'], ['front-jpg', 'Ebook cover (JPG)', 'The front only, 2560 pixels tall.'], ['front-png', 'Front cover (PNG)', 'The front only, at print quality.']] as const).map(([id, name, note]) => (
                  <button key={id} role="menuitem" onClick={() => void exportAs(id)} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-main)' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>{name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{note}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div ref={areaRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative', backgroundColor: 'color-mix(in srgb, var(--bg-app) 85%, #000)' }}>
          <div style={{ width: view.w * scale, height: view.h * scale, margin: `${Math.max(24, (area.h - view.h * scale) / 2)}px auto`, position: 'relative', boxShadow: '0 6px 30px rgba(0,0,0,0.35)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="The cover" />

            {guides && (
              <svg aria-hidden viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <path fillRule="evenodd" fill="rgba(220, 50, 50, 0.2)" d={`M0 0H${geo.totalW}V${geo.totalH}H0Z M${BLEED} ${BLEED}V${geo.totalH - BLEED}H${geo.totalW - BLEED}V${BLEED}Z`} />
                <rect x={BLEED} y={BLEED} width={geo.totalW - BLEED * 2} height={geo.trimH} fill="none" stroke="#e23b3b" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                {[geo.back, geo.front].map((r, i) => <rect key={i} x={r.x + SAFE} y={r.y + SAFE} width={r.w - SAFE * 2} height={r.h - SAFE * 2} fill="none" stroke="#2f8f5b" strokeWidth="1" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />)}
                <line x1={geo.spineRect.x} x2={geo.spineRect.x} y1={0} y2={geo.totalH} stroke="#4a7de0" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line x1={geo.spineRect.x + geo.spine} x2={geo.spineRect.x + geo.spine} y1={0} y2={geo.totalH} stroke="#4a7de0" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <rect x={geo.barcode.x} y={geo.barcode.y} width={geo.barcode.w} height={geo.barcode.h} fill="rgba(255,255,255,0.85)" stroke="#555" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
            {guides && (
              <>
                <div aria-hidden style={{ position: 'absolute', left: sheetPx(geo.barcode.x, 0)[0], top: sheetPx(0, geo.barcode.y)[1], width: geo.barcode.w * scale, height: geo.barcode.h * scale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(9, scale * 0.12), color: '#444', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.2 }}>Barcode goes here<br />2 × 1.2 in</div>
                {geo.spine > 0 && <div aria-hidden style={{ position: 'absolute', left: sheetPx(geo.spineRect.x, 0)[0], top: 4, width: geo.spine * scale, textAlign: 'center', fontSize: 10, color: '#4a7de0', pointerEvents: 'none', fontWeight: 700 }}>spine</div>}
              </>
            )}

            <div ref={overlayRef} tabIndex={0} role="application" aria-label="Cover canvas. Click a layer to select it, then drag, or use the arrow keys." onKeyDown={onKey}
              onPointerDown={onDown} onPointerMove={onMoveEvent} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ position: 'absolute', inset: 0, touchAction: 'none', outline: 'none', cursor: drag.current?.mode === 'move' ? 'grabbing' : 'default' }}>
              {snap.x !== undefined && <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: (snap.x - view.x) * scale, width: 0, borderLeft: '1px solid #ff3da5', pointerEvents: 'none' }} />}
              {snap.y !== undefined && <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: (snap.y - view.y) * scale, height: 0, borderTop: '1px solid #ff3da5', pointerEvents: 'none' }} />}
              {selected && selBox && (
                <div style={{ position: 'absolute', left: (selected.x - view.x) * scale, top: (selected.y - view.y) * scale, width: selBox.w * scale, height: selBox.h * scale, transform: `rotate(${selected.rotation}deg)`, transformOrigin: 'center', outline: '1.5px dashed var(--accent-gold)', pointerEvents: 'none' }}>
                  {!selected.locked && (selected.kind === 'text' ? (['e', 'w'] as Handle[]) : [...HANDLES]).map(h => (
                    <span key={h} onPointerDown={e => startHandle(e, h)} aria-hidden style={{ position: 'absolute', left: `${handlePos[h][0] * 100}%`, top: `${handlePos[h][1] * 100}%`, width: 11, height: 11, margin: -5.5, backgroundColor: '#fff', border: '1.5px solid var(--accent-gold)', borderRadius: 2, cursor: cursorFor[h], pointerEvents: 'auto' }} />
                  ))}
                  {!selected.locked && <span onPointerDown={e => startHandle(e, 'rot')} aria-hidden title="Turn (hold Shift to snap)" style={{ position: 'absolute', left: '50%', top: -26, width: 12, height: 12, margin: -6, backgroundColor: 'var(--accent-gold)', border: '1.5px solid #fff', borderRadius: '50%', cursor: 'grab', pointerEvents: 'auto' }} />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CoverInspector design={design} geo={geo} trimLabel={`${book.width} × ${book.height} in`} selected={selected} typesetPages={book.typesetPages} fonts={[...COVER_FONTS, ...customFamilies]}
        onSetup={onSetup} onBackground={onBackground} onSelect={setSelectedId} onUpdate={updateLayer} onMove={onMove} onAdd={onAdd} onPicture={(f, id) => void onPicture(f, id)}
        onDuplicate={onDuplicate} onDelete={onDelete} onFit={onFit} onOpenBookLayout={() => { flush(); setViewMode('book_preview'); }} onRestart={onRestart} />
    </div>
  );
};
