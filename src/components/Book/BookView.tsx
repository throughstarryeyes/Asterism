import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAsterism } from '../../context/AsterismContext';
import { BookSettings } from './BookSettings';
import { BlankSheet, CoverSheet, PageSheet } from './Sheet';
import { PAPERS, bookVars, normalizeBook, paperOf, type BookDesign } from '../../services/book/design';
import { buildBookSource, pageKinds, pageNumber } from '../../services/book/source';
import { paginateBook, type Paginated } from '../../services/book/paginate';
import { findFlourish } from '../../services/ornaments';
import { fontStack } from '../../services/pairings';
import { fontLoader } from '../../services/fontLoader';
import { deleteAsset, getAssetUrl, newAssetId, putAsset } from '../../services/assetStore';
import { prepareImage, validateImageFile } from '../../services/imageUpload';
import { BLEED, cleanCover, coverAssetIds, geometry } from '../../services/cover/design';
import { loadFonts, loadPictures, renderToCanvas, toBlob } from '../../services/cover/render';
import { ArrowLeft, BookOpen, Brush, ChevronLeft, ChevronRight, LayoutGrid, Printer, SlidersHorizontal } from 'lucide-react';

// the fields that change where text falls. a change to anything else (paper, page numbers, the cover) needs no new typesetting.
const flowOf = (d: BookDesign) => ({
  trim: d.trim, width: d.width, height: d.height, inside: d.inside, outside: d.outside, top: d.top, bottom: d.bottom,
  font: d.font, fontSize: d.fontSize, lineHeight: d.lineHeight, indent: d.indent, justify: d.justify, hyphenate: d.hyphenate,
  dropCap: d.dropCap, chapterStart: d.chapterStart, chapterStyle: d.chapterStyle, sink: d.sink,
  toc: d.toc, copyright: d.copyright, copyrightText: d.copyrightText, dedication: d.dedication,
});

const bar: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' };

type Flip = { dir: 'next' | 'prev'; go: boolean } | null;

export const BookView: React.FC = () => {
  const { project, userStats, setViewMode, updateProjectMeta, noteExport, showToast } = useAsterism();
  const design = useMemo(() => normalizeBook(project.book), [project.book]);
  const paper = paperOf(design.paper);
  const family = design.font || userStats.activeFont;
  const stack = fontStack(family);
  const flourish = findFlourish(userStats.activeFlourish, userStats.customFlourishes);
  const coverId = project.coverStyle ?? userStats.activeCover ?? 'plain';

  const [book, setBook] = useState<Paginated | null>(null);
  const [flow, setFlow] = useState(() => flowOf(design));
  const [busy, setBusy] = useState(true);
  const [fontsTick, setFontsTick] = useState(0);
  const [k, setK] = useState(0);
  const [flip, setFlip] = useState<Flip>(null);
  const [mode, setMode] = useState<'book' | 'pages'>('book');
  const [showSettings, setShowSettings] = useState(() => window.innerWidth >= 1100);
  const [printing, setPrinting] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [designedUrl, setDesignedUrl] = useState<string | undefined>();
  const [area, setArea] = useState({ w: 900, h: 600 });
  const areaRef = useRef<HTMLDivElement>(null);
  const committed = useRef(false);

  // the fonts the pages are set in
  useEffect(() => {
    if (!(userStats.customFonts || []).some(f => f.family === family && f.source === 'local')) fontLoader.loadGoogleFont(family);
  }, [family, userStats.customFonts]);
  // a font arriving late changes where lines break, so the pages are cut again
  useEffect(() => {
    const again = () => setFontsTick(n => n + 1);
    document.fonts?.addEventListener?.('loadingdone', again);
    return () => document.fonts?.removeEventListener?.('loadingdone', again);
  }, []);

  // the flow settings settle a moment after the last change
  const flowKey = JSON.stringify(flowOf(design));
  useEffect(() => {
    const t = setTimeout(() => setFlow(JSON.parse(flowKey)), 350);
    return () => clearTimeout(t);
  }, [flowKey]);

  const chapters = useMemo(() => [...project.chapters].sort((a, b) => a.order - b.order), [project.chapters]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const flowDesign: BookDesign = { ...design, ...flow };
    paginateBook({
      build: blanks => buildBookSource({ project, design: flowDesign, flourish, blanksBefore: blanks }),
      design: flowDesign,
      vars: bookVars(flowDesign, stack),
      fontCss: stack,
      chapterIds: chapters.map(c => c.id),
      isCancelled: () => cancelled,
    }).then(result => {
      if (cancelled || !result) return;
      setBook(result);
      setK(prev => Math.min(prev, Math.floor((result.pages.length + 2) / 2)));
      setBusy(false);
    }).catch(() => { if (!cancelled) { setBusy(false); showToast('Could not typeset the book.', 'info'); } });
    return () => { cancelled = true; };
    // the design object changes with every setting; only the flow fields matter here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, project.chapters, project.title, project.subtitle, project.author, project.draftMode, flourish, stack, fontsTick]);

  // a cover picture the writer added
  useEffect(() => {
    let live = true;
    if (!design.coverImage) { setCoverUrl(undefined); return undefined; }
    getAssetUrl(design.coverImage).then(u => { if (live) setCoverUrl(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [design.coverImage]);

  // the front of the cover made in the cover creator, drawn at screen size
  useEffect(() => {
    let live = true;
    let url: string | undefined;
    const made = cleanCover(project.coverDesign);
    if (!made) { setDesignedUrl(undefined); return undefined; }
    (async () => {
      const g = geometry(design.width, design.height, made.setup);
      const pics = await loadPictures(coverAssetIds(made));
      await loadFonts(made, (userStats.customFonts || []).map(f => f.family));
      const canvas = renderToCanvas(made, g, { ppi: 130, view: { x: g.front.x, y: BLEED, w: g.trimW, h: g.trimH }, pictures: pics });
      url = URL.createObjectURL(await toBlob(canvas, 'image/png'));
      if (live) setDesignedUrl(url); else URL.revokeObjectURL(url);
    })().catch(() => { if (live) setDesignedUrl(undefined); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [project.coverDesign, design.width, design.height, userStats.customFonts]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setArea({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageCount = book ? book.pages.length + (book.pages.length % 2) : 0;
  useEffect(() => {
    if (pageCount && design.typesetPages !== pageCount) updateProjectMeta({ book: normalizeBook({ ...design, typesetPages: pageCount }) });
    // only a new count matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount]);

  const change = useCallback((patch: Partial<BookDesign>) => updateProjectMeta({ book: normalizeBook({ ...design, ...patch }) }), [design, updateProjectMeta]);

  const onCoverFile = async (file: File) => {
    const bad = validateImageFile(file);
    if (bad) { showToast(bad, 'info'); return; }
    try {
      const id = await putAsset(await prepareImage(file), newAssetId('cover'));
      const old = design.coverImage;
      change({ coverImage: id });
      if (old) deleteAsset(old).catch(() => undefined);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Could not use that picture.', 'info'); }
  };
  const onClearCover = () => {
    const old = design.coverImage;
    change({ coverImage: undefined });
    if (old) deleteAsset(old).catch(() => undefined);
  };

  // what the pages look like now: the layout they were cut for, with the live paper, numbers and cover
  const shown: BookDesign = { ...design, ...(book ? flow : {}) };
  const vars = bookVars(shown, stack);
  const pages = useMemo(() => book?.pages ?? [], [book]);
  const kinds = useMemo(() => (book ? pageKinds(pages, book.firstChapterPage) : []), [book, pages]);

  const headFor = (i: number) => {
    if (shown.head === 'title') return project.title;
    return i % 2 === 0 ? project.title : project.author;
  };

  const faceCount = 2 + pages.length;
  const kMax = Math.max(1, Math.floor(faceCount / 2));
  const Wpx = shown.width * 96;
  const Hpx = shown.height * 96;
  const scale = Math.max(0.2, Math.min((area.w - 40) / (2 * Wpx), (area.h - 40) / Hpx, 1.6));

  const face = (f: number): React.ReactNode => {
    if (f < 0 || f >= faceCount) return null;
    if (f === 0) return <CoverSheet design={shown} vars={vars} paper={paper} title={project.title} author={project.author} coverId={coverId} custom={userStats.customCovers} imageUrl={design.coverImage ? coverUrl : designedUrl} />;
    if (f === 1) return <BlankSheet design={shown} vars={vars} paper={paper} tone={0.05} />;
    const i = f - 2;
    return <PageSheet design={shown} vars={vars} paper={paper} index={i} html={pages[i]} kind={kinds[i] ?? 'body'} number={book ? pageNumber(i, book.firstChapterPage) : null} head={headFor(i)} drop={shown.dropCap} />;
  };
  const solid = (f: number) => face(f) ?? <BlankSheet design={shown} vars={vars} paper={paper} />;

  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const commit = useCallback(() => {
    if (committed.current || !flip) return;
    committed.current = true;
    setK(prev => Math.max(0, Math.min(kMax, prev + (flip.dir === 'next' ? 1 : -1))));
    setFlip(null);
  }, [flip, kMax]);

  useEffect(() => {
    if (!flip) return undefined;
    committed.current = false;
    if (!flip.go) {
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setFlip(f => (f ? { ...f, go: true } : f))));
      return () => cancelAnimationFrame(id);
    }
    const t = setTimeout(commit, 1000);
    return () => clearTimeout(t);
  }, [flip, commit]);

  const turn = (dir: 'next' | 'prev') => {
    if (flip || !book) return;
    const target = k + (dir === 'next' ? 1 : -1);
    if (target < 0 || target > kMax) return;
    if (calm) setK(target);
    else setFlip({ dir, go: false });
  };
  const jump = (target: number) => { if (!flip) setK(Math.max(0, Math.min(kMax, target))); };

  const target = flip ? k + (flip.dir === 'next' ? 1 : -1) : k;
  // a closed book sits in the middle; so does the last page when nothing faces it
  const shift = target === 0 ? -Wpx / 2 : target === kMax && faceCount % 2 === 0 ? Wpx / 2 : 0;

  const spreadLabel = () => {
    const nums = [2 * k - 1, 2 * k].map(f => (f >= 2 && f < faceCount && book ? pageNumber(f - 2, book.firstChapterPage) : null)).filter((n): n is number => n !== null);
    if (k === 0) return 'Cover';
    return nums.length ? `Pages ${nums.join('–')}` : 'Front matter';
  };

  // printing: every page in its own box at the real trim size, in a layer only the printer sees
  const print = () => {
    if (!book || busy) return;
    noteExport('manuscript', project.id);
    document.body.classList.add('bk-printing');
    setPrinting(true);
  };
  useEffect(() => {
    if (!printing) return undefined;
    const done = () => { document.body.classList.remove('bk-printing'); setPrinting(false); };
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 250);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing]);
  useEffect(() => () => document.body.classList.remove('bk-printing'), []);

  const onKey = (e: React.KeyboardEvent) => {
    if (mode !== 'book') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); turn('next'); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn('prev'); }
    else if (e.key === 'Home') { e.preventDefault(); jump(0); }
    else if (e.key === 'End') { e.preventDefault(); jump(kMax); }
  };

  const slot = (f: number, side: 'left' | 'right', extra?: React.CSSProperties) => (
    <div style={{ position: 'absolute', top: 0, left: side === 'left' ? 0 : Wpx, width: Wpx, height: Hpx, ...extra }}>{face(f)}</div>
  );

  const leftNow = flip ? (flip.dir === 'next' ? 2 * k - 1 : 2 * k - 3) : 2 * k - 1;
  const rightNow = flip ? (flip.dir === 'next' ? 2 * k + 2 : 2 * k) : 2 * k;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative', backgroundColor: paper.desk, transition: 'background-color 0.3s' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 14px', backgroundColor: 'var(--toolbar-bg)', borderBottom: '1px solid var(--border-subtle)' }}>
          <button onClick={() => setViewMode('standard')} style={bar}><ArrowLeft size={15} /> Back to editor</button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}><BookOpen size={15} /> Book view</span>
          <span style={{ flex: 1 }} />
          {mode === 'book' && (
            <>
              <button onClick={() => turn('prev')} disabled={k === 0 || !!flip} aria-label="Previous pages" style={{ ...bar, padding: 5, opacity: k === 0 ? 0.4 : 1 }}><ChevronLeft size={17} /></button>
              <input type="range" min={0} max={kMax} value={k} onChange={e => jump(Number(e.target.value))} aria-label="Turn to a page" style={{ width: 160, accentColor: 'var(--accent-gold)' }} />
              <button onClick={() => turn('next')} disabled={k === kMax || !!flip} aria-label="Next pages" style={{ ...bar, padding: 5, opacity: k === kMax ? 0.4 : 1 }}><ChevronRight size={17} /></button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: 90 }}>{spreadLabel()}</span>
            </>
          )}
          <button onClick={() => setViewMode('cover')} style={{ ...bar, border: '1px solid var(--border-subtle)' }}><Brush size={14} /> Design the cover</button>
          <button onClick={() => setMode(m => (m === 'book' ? 'pages' : 'book'))} aria-pressed={mode === 'pages'} style={{ ...bar, border: '1px solid var(--border-subtle)' }}><LayoutGrid size={14} /> {mode === 'book' ? 'All pages' : 'Back to the book'}</button>
          <button onClick={() => setShowSettings(s => !s)} aria-pressed={showSettings} style={{ ...bar, border: '1px solid var(--border-subtle)' }}><SlidersHorizontal size={14} /> Layout</button>
          <button onClick={print} disabled={busy} style={{ ...bar, backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}><Printer size={14} /> Print / Save as PDF</button>
        </div>

        <div ref={areaRef} tabIndex={0} onKeyDown={onKey} aria-label="The book. Use the arrow keys to turn pages." style={{ flex: 1, minHeight: 0, position: 'relative', overflow: mode === 'pages' ? 'auto' : 'hidden', outline: 'none' }}>
          {busy && <div role="status" style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 5, padding: '4px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Typesetting…</div>}

          {mode === 'book' && book && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 2 * Wpx * scale, height: Hpx * scale, marginLeft: -(Wpx * scale), marginTop: -(Hpx * scale) / 2 }}>
              <div style={{ width: 2 * Wpx, height: Hpx, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative', perspective: 2800 }}>
                <div style={{ position: 'absolute', inset: 0, transform: `translateX(${shift}px)`, transition: calm ? 'none' : 'transform 0.75s cubic-bezier(0.45, 0.05, 0.25, 1)' }}>
                  {leftNow >= 0 && slot(leftNow, 'left')}
                  {slot(rightNow, 'right')}
                  {flip?.dir === 'next' && (
                    <div className="bk-leaf" onTransitionEnd={commit} style={{ left: Wpx, width: Wpx, height: Hpx, transformOrigin: 'left center', transform: flip.go ? 'rotateY(-180deg)' : 'rotateY(0deg)' }}>
                      <div className="bk-face">{solid(2 * k)}</div>
                      <div className="bk-face back">{solid(2 * k + 1)}</div>
                    </div>
                  )}
                  {flip?.dir === 'prev' && (
                    <div className="bk-leaf" onTransitionEnd={commit} style={{ left: 0, width: Wpx, height: Hpx, transformOrigin: 'right center', transform: flip.go ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                      <div className="bk-face">{solid(2 * k - 1)}</div>
                      <div className="bk-face back">{solid(2 * k - 2)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {mode === 'pages' && book && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: 24, justifyContent: 'center' }}>
              {Array.from({ length: faceCount }, (_, f) => f).map(f => (
                <button key={f} onClick={() => { setMode('book'); jump(f % 2 === 0 ? f / 2 : (f + 1) / 2); }} aria-label={f === 0 ? 'Cover' : f === 1 ? 'Inside cover' : `Page ${f - 1}`}
                  style={{ width: shown.width * 96 * 0.42, height: shown.height * 96 * 0.42, cursor: 'pointer', padding: 0, border: 'none', background: 'none', position: 'relative' }}>
                  <div style={{ width: Wpx, height: Hpx, transform: 'scale(0.42)', transformOrigin: 'top left', pointerEvents: 'none' }}>{face(f)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <div style={area.w + 320 < 760 ? { position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 30, boxShadow: '-8px 0 24px rgba(0,0,0,0.25)' } : { display: 'flex' }}>
        <BookSettings design={design} writingFont={userStats.activeFont} customFonts={(userStats.customFonts || []).map(f => f.family)} hasCoverImage={!!design.coverImage}
          onChange={change} onCoverFile={onCoverFile} onClearCover={onClearCover} onClose={() => setShowSettings(false)} />
        </div>
      )}

      {printing && book && createPortal(
        <div className="bk-print">
          <style>{`@page { size: ${shown.width}in ${shown.height}in; margin: 0; } .bk-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>
          {shown.printCover && <CoverSheet design={shown} vars={vars} paper={PAPERS[0]} title={project.title} author={project.author} coverId={coverId} custom={userStats.customCovers} imageUrl={design.coverImage ? coverUrl : designedUrl} />}
          {pages.map((html, i) => (
            <PageSheet key={i} design={shown} vars={vars} paper={PAPERS[0]} index={i} html={html} kind={kinds[i] ?? 'body'} number={pageNumber(i, book.firstChapterPage)} head={headFor(i)} drop={shown.dropCap} />
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};
