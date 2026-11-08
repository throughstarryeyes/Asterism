import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAsterism } from '../../context/AsterismContext';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  List, 
  ListOrdered, 
  Quote, 
  Heading2, 
  Heading3, 
  Undo, 
  Redo, 
  Indent, 
  Sparkles,
  CheckCircle2,
  Highlighter,
  ChevronDown,
  Upload,
  SeparatorHorizontal
} from 'lucide-react';
import { BUILT_IN_FONTS, FONT_EXTENSIONS } from '../../services/fontFiles';
import { SYSTEM_FONTS } from '../../services/systemFonts';
import { TEXT_SIZES, clampSize, parseSize, stepSize } from '../../services/textSize';
import { useActiveEditor } from '../../editor/active';
import { SavedHighlights } from '../Common/SavedHighlights';
import { formatState, run as runEditorCommand, setFont as setEditorFont, setHighlight as setEditorHighlight, setSize as setEditorSize, setTextColor as setEditorTextColor, sizeAt } from '../../editor/commands';

const editorRootOf = (node: Node | null): HTMLElement | null => {
  const el = node instanceof Element ? node : node?.parentElement;
  return (el?.closest('.editable-manuscript') as HTMLElement | null) ?? null;
};

// the size, in pixels, of the text at the start of the selection.
function sizeAtSelection(): number | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const node = sel.getRangeAt(0).startContainer;
  if (!editorRootOf(node)) return null;
  const el = node instanceof Element ? node : node.parentElement;
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null;
}

// give the selected text an exact pixel size. the browser's own size command only knows
// seven sizes, so we let it mark the text and then swap its marks for real sizes.
function applyTextSize(px: number, range: Range | null): void {
  const sel = window.getSelection();
  if (!sel) return;
  if (range) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
  if (!sel.rangeCount) return;
  const root = editorRootOf(sel.getRangeAt(0).commonAncestorContainer);
  if (!root) return;
  const size = `${clampSize(px)}px`;

  if (sel.getRangeAt(0).collapsed) {
    // nothing selected: the next thing typed gets this size.
    const span = document.createElement('span');
    span.style.fontSize = size;
    span.textContent = '\u200B';
    sel.getRangeAt(0).insertNode(span);
    const caret = document.createRange();
    caret.setStart(span.firstChild!, 1);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
  } else {
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    const made: HTMLElement[] = [];
    root.querySelectorAll('font[size="7"]').forEach(font => {
      const span = document.createElement('span');
      span.style.fontSize = size;
      while (font.firstChild) span.appendChild(font.firstChild);
      // anything inside that had its own size would otherwise win over the new one.
      span.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach(inner => { inner.style.removeProperty('font-size'); });
      font.replaceWith(span);
      made.push(span);
    });
    if (made.length) {
      const keep = document.createRange();
      keep.setStartBefore(made[0]);
      keep.setEndAfter(made[made.length - 1]);
      sel.removeAllRanges();
      sel.addRange(keep);
    }
  }
  // tell the editor the text changed so it saves.
  root.dispatchEvent(new Event('input', { bubbles: true }));
}

// dropdown drawn on the page itself, since the toolbar scrolls sideways and would clip it
const Dropdown: React.FC<{ className?: string; style: React.CSSProperties; children: React.ReactNode }> = ({ className, style, children }) => {
  const marker = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = marker.current?.parentElement;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      setPos({ top: r.bottom, left: Math.max(8, Math.min(r.left, window.innerWidth - 230)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, []);

  return (
    <>
      <span ref={marker} style={{ display: 'none' }} />
      {pos && createPortal(
        <div className={className} style={{ ...style, position: 'fixed', top: pos.top, left: pos.left, zIndex: 3000 }}>
          {children}
        </div>,
        document.body
      )}
    </>
  );
};

export const FormattingToolbar: React.FC = () => {
  const { activeChapter, userStats, toggleIndentParagraphs, updateChapterStatus, uploadFontFile, insertSceneBreak } = useAsterism();

  // the new editor, when it is the one being written in; otherwise the browser's own editing is used
  const editor = useActiveEditor();
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [isHighlightOpen, setIsHighlightOpen] = useState(false);
  const [activeTextColor, setActiveTextColor] = useState<string>('inherit');
  const [activeHighlightColor, setActiveHighlightColor] = useState<string>('transparent');

  const [isFontOpen, setIsFontOpen] = useState(false);
  const fontFileRef = useRef<HTMLInputElement>(null);
  // the selection to apply a font to, kept while the file picker has focus.
  const savedRange = useRef<Range | null>(null);
  const fontChoices = [...BUILT_IN_FONTS, ...SYSTEM_FONTS, ...(userStats.customFonts || []).map(f => f.family)];

  const [sizeNow, setSizeNow] = useState<number | null>(null);
  const [isSizeOpen, setIsSizeOpen] = useState(false);
  const [sizeText, setSizeText] = useState('');

  // show the size of whatever the cursor is in.
  useEffect(() => {
    if (editor) {
      const update = () => setSizeNow(sizeAt(editor));
      editor.on('selectionUpdate', update);
      return () => { editor.off('selectionUpdate', update); };
    }
    const update = () => setSizeNow(sizeAtSelection());
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [editor]);

  // which of the toolbar's formats the cursor is in, so those buttons show as pressed
  const [fmt, setFmt] = useState<Record<string, boolean>>({});
  const readFormats = () => {
    if (editor) { const next = formatState(editor); setFmt(prev => (Object.keys(next).every(k => prev[k] === next[k]) ? prev : next)); return; }
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRootOf(sel.anchorNode)) return;
    const on = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    let block = '';
    try { block = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, ''); } catch { /* not asked */ }
    const next: Record<string, boolean> = {
      bold: on('bold'), italic: on('italic'), underline: on('underline'), strike: on('strikeThrough'),
      ul: on('insertUnorderedList'), ol: on('insertOrderedList'),
      left: on('justifyLeft'), center: on('justifyCenter'), right: on('justifyRight'), full: on('justifyFull'),
      h2: block === 'h2', h3: block === 'h3', quote: block === 'blockquote',
    };
    setFmt(prev => (Object.keys(next).every(k => prev[k] === next[k]) ? prev : next));
  };
  useEffect(() => {
    if (editor) {
      // every change to the text or the selection, so a shortcut like Ctrl+B shows too
      editor.on('transaction', readFormats);
      readFormats();
      return () => { editor.off('transaction', readFormats); };
    }
    // a shortcut like Ctrl+B changes the format without moving the selection
    const events = ['selectionchange', 'keyup', 'input'] as const;
    events.forEach(e => document.addEventListener(e, readFormats));
    return () => events.forEach(e => document.removeEventListener(e, readFormats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  const tool = (key: string): React.CSSProperties => fmt[key]
    ? { ...btnStyle, backgroundColor: 'var(--accent-gold-bg)', color: 'var(--accent-gold-text, var(--accent-gold))', boxShadow: 'inset 0 0 0 1px var(--accent-gold)' }
    : btnStyle;

  const changeSize = (px: number) => {
    if (editor) { setEditorSize(editor, clampSize(px)); setSizeNow(sizeAt(editor)); return; }
    applyTextSize(px, null);
    setSizeNow(sizeAtSelection());
  };
  const chooseSize = (px: number) => {
    if (editor) { setEditorSize(editor, clampSize(px)); setIsSizeOpen(false); setSizeNow(sizeAt(editor)); return; }
    applyTextSize(px, savedRange.current);
    setIsSizeOpen(false);
    setSizeNow(sizeAtSelection());
  };

  const rememberSelection = () => {
    const sel = window.getSelection();
    savedRange.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  };
  const applyFont = (family: string) => {
    if (editor) { setEditorFont(editor, family); setIsFontOpen(false); return; }
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    // quote the name: unquoted, a family like "Name 2023" or "Name (2)" is invalid CSS and the
    // browser drops it, leaving the text in the theme font.
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontName', false, `"${family.replace(/["\\]/g, '\\$&')}"`);
    document.execCommand('styleWithCSS', false, 'false');
    setIsFontOpen(false);
  };
  const importFont = async (file: File | undefined) => {
    if (!file) return;
    const family = await uploadFontFile(file, undefined, false);
    if (family) applyFont(family);
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    if (editor) runEditorCommand(editor, command, value);
    else document.execCommand(command, false, value);
    readFormats();
  };

  const applyTextColor = (color: string) => {
    setActiveTextColor(color);
    if (editor) { setEditorTextColor(editor, color === 'inherit' ? null : color); setIsColorOpen(false); return; }
    if (color === 'inherit') {
      execCmd('removeFormat');
    } else {
      execCmd('foreColor', color);
    }
    setIsColorOpen(false);
  };

  const applyHighlightColor = (color: string) => {
    setActiveHighlightColor(color);
    if (editor) { setEditorHighlight(editor, color === 'transparent' ? null : color); setIsHighlightOpen(false); return; }
    if (color === 'transparent') {
      execCmd('hiliteColor', 'transparent');
      execCmd('backColor', 'transparent');
    } else {
      execCmd('hiliteColor', color);
      execCmd('backColor', color);
    }
    setIsHighlightOpen(false);
  };

  const handleStatusChange = (status: 'draft' | 'revised' | 'final') => {
    if (!activeChapter) return;
    updateChapterStatus(activeChapter.id, status);
  };

  return (
    <div
      className="glass-panel"
      // pressing any button here must not take the cursor or selection out of the page, or the format has nothing to apply to
      onMouseDown={e => { if (!(e.target as HTMLElement).closest('input, textarea, select')) e.preventDefault(); }}
      style={{
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--toolbar-bg)',
        gap: '8px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexWrap: 'nowrap',
        userSelect: 'none'
      }}
    >
      {/* left formatting tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'nowrap', flexShrink: 0 }}>
        {/* headings & blockquote */}
        <button
          onClick={() => execCmd('formatBlock', '<h2>')}
          title="Heading 2 (Chapter Section)"
          style={tool('h2')} aria-pressed={!!fmt.h2}
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => execCmd('formatBlock', '<h3>')}
          title="Heading 3 (Sub-scene)"
          style={tool('h3')} aria-pressed={!!fmt.h3}
        >
          <Heading3 size={16} />
        </button>
        <button
          onClick={() => execCmd('formatBlock', '<p>')}
          title="Standard Body Paragraph"
          style={btnStyle}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>¶</span>
        </button>
        <button
          onClick={() => execCmd('formatBlock', '<blockquote>')}
          title="Epigraph / Blockquote"
          style={tool('quote')} aria-pressed={!!fmt.quote}
        >
          <Quote size={15} />
        </button>

        <div style={separatorStyle} />

        {/* font family: built-in fonts, your fonts, and import */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              if (!isFontOpen) rememberSelection();
              setIsFontOpen(!isFontOpen);
            }}
            title="Font for the selected text"
            style={{ ...btnStyle, width: 'auto', padding: '0 8px', gap: '4px', fontSize: '0.74rem' }}
          >
            <span>Font</span>
            <ChevronDown size={12} />
          </button>
          {isFontOpen && (
            <Dropdown
              className="glass-panel animate-fade-in"
              style={{
                marginTop: '6px', minWidth: '210px', maxHeight: '320px', overflowY: 'auto',
                padding: '6px', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '1px'
              }}
            >
              {fontChoices.map(f => (
                <button
                  key={f}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => applyFont(f)}
                  style={{ padding: '6px 10px', textAlign: 'left', borderRadius: 'var(--radius-sm)', fontFamily: `"${f}", serif`, fontSize: '0.92rem', color: 'var(--text-main)' }}
                >
                  {f}
                </button>
              ))}
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => fontFileRef.current?.click()}
                style={{ padding: '6px 10px', textAlign: 'left', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload size={13} /> Import a font…
              </button>
            </Dropdown>
          )}
          <input
            ref={fontFileRef}
            type="file"
            accept={FONT_EXTENSIONS.map(e => `.${e}`).join(',')}
            style={{ display: 'none' }}
            onChange={e => { importFont(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>

        <div style={separatorStyle} />

        {/* text size for the selected text */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => changeSize(stepSize(sizeNow ?? userStats.fontSize, -1))}
            title="Smaller text"
            style={{ ...btnStyle, padding: '6px 7px', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1 }}
          >−</button>
          <input aria-label="Text size"
            value={isSizeOpen ? sizeText : (sizeNow ?? userStats.fontSize)}
            inputMode="numeric"
            title="Text size (px). Press Enter to apply."
            onFocus={() => { rememberSelection(); setSizeText(String(sizeNow ?? userStats.fontSize)); setIsSizeOpen(true); }}
            onChange={e => setSizeText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const n = parseSize(sizeText);
                if (n) chooseSize(n);
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setIsSizeOpen(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={() => window.setTimeout(() => setIsSizeOpen(false), 150)}
            style={{ width: 38, textAlign: 'center', padding: '4px 2px', fontSize: '0.78rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
          />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => changeSize(stepSize(sizeNow ?? userStats.fontSize, 1))}
            title="Bigger text"
            style={{ ...btnStyle, padding: '6px 7px', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1 }}
          >+</button>
          {isSizeOpen && (
            <Dropdown
              className="glass-panel animate-fade-in"
              style={{
                marginTop: 6, minWidth: 90, maxHeight: 260, overflowY: 'auto', padding: 4,
                backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', gap: 1
              }}
            >
              {TEXT_SIZES.map(n => (
                <button
                  key={n}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => chooseSize(n)}
                  style={{ padding: '4px 10px', textAlign: 'left', borderRadius: 'var(--radius-sm)', fontSize: '0.84rem', color: n === sizeNow ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)', fontWeight: n === sizeNow ? 700 : 400 }}
                >
                  {n}
                </button>
              ))}
            </Dropdown>
          )}
        </div>

        <div style={separatorStyle} />

        {/* inline styles */}
        <button onClick={() => execCmd('bold')} title="Bold (Ctrl+B)" style={tool('bold')} aria-pressed={!!fmt.bold}>
          <Bold size={15} />
        </button>
        <button onClick={() => execCmd('italic')} title="Italic (Ctrl+I)" style={tool('italic')} aria-pressed={!!fmt.italic}>
          <Italic size={15} />
        </button>
        <button onClick={() => execCmd('underline')} title="Underline (Ctrl+U)" style={tool('underline')} aria-pressed={!!fmt.underline}>
          <Underline size={15} />
        </button>
        <button onClick={() => execCmd('strikeThrough')} title="Strikethrough" style={tool('strike')} aria-pressed={!!fmt.strike}>
          <Strikethrough size={15} />
        </button>

        {/* text color picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setIsColorOpen(!isColorOpen);
              setIsHighlightOpen(false);
            }}
            title="Text Color"
            style={{
              ...btnStyle,
              backgroundColor: isColorOpen ? 'var(--accent-gold-bg)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 6px',
              gap: '2px'
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'serif', lineHeight: 1 }}>A</span>
            <div 
              style={{ 
                width: '14px', 
                height: '3px', 
                backgroundColor: activeTextColor === 'inherit' ? 'var(--text-main)' : activeTextColor,
                borderRadius: '1px' 
              }} 
            />
          </button>

          {isColorOpen && (
            <Dropdown
              className="glass-panel"
              style={{
                marginTop: '6px',
                backgroundColor: 'var(--bg-paper)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '10px',
                width: '210px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>Text Color</span>
                <button
                  onMouseDown={e => {
                    e.preventDefault();
                    applyTextColor('inherit');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-gold-text, var(--accent-gold))',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Reset
                </button>
              </div>

              {/* preset swatches */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {[
                  { name: 'Default', color: 'inherit', display: 'var(--text-main)' },
                  { name: 'Black', color: '#0f172a', display: '#0f172a' },
                  { name: 'Slate', color: '#64748b', display: '#64748b' },
                  { name: 'Red', color: '#dc2626', display: '#dc2626' },
                  { name: 'Orange', color: '#ea580c', display: '#ea580c' },
                  { name: 'Amber', color: '#d97706', display: '#d97706' },
                  { name: 'Gold', color: '#c9933b', display: '#c9933b' },
                  { name: 'Green', color: '#16a34a', display: '#16a34a' },
                  { name: 'Emerald', color: '#059669', display: '#059669' },
                  { name: 'Teal', color: '#0d9488', display: '#0d9488' },
                  { name: 'Blue', color: '#2563eb', display: '#2563eb' },
                  { name: 'Indigo', color: '#4f46e5', display: '#4f46e5' },
                  { name: 'Purple', color: '#9333ea', display: '#9333ea' },
                  { name: 'Magenta', color: '#c026d3', display: '#c026d3' },
                  { name: 'Rose', color: '#e11d48', display: '#e11d48' }
                ].map(item => (
                  <button
                    key={item.color}
                    onMouseDown={e => {
                      e.preventDefault();
                      applyTextColor(item.color);
                    }}
                    title={item.name}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: item.display,
                      border: activeTextColor === item.color ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-xs)'
                    }}
                  />
                ))}
              </div>

              {/* custom color input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Custom:</span>
                <input
                  type="color"
                  value={activeTextColor === 'inherit' ? '#000000' : activeTextColor}
                  onChange={e => applyTextColor(e.target.value)}
                  style={{
                    width: '28px',
                    height: '24px',
                    padding: 0,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                />
                <input
                  type="text"
                  placeholder="#hex..."
                  value={activeTextColor === 'inherit' ? '' : activeTextColor}
                  onChange={e => applyTextColor(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: '0.72rem',
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)'
                  }}
                />
              </div>
            </Dropdown>
          )}
        </div>

        {/* text highlight / background picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setIsHighlightOpen(!isHighlightOpen);
              setIsColorOpen(false);
            }}
            title="Text Highlight (Background Color)"
            style={{
              ...btnStyle,
              backgroundColor: isHighlightOpen ? 'var(--accent-gold-bg)' : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 6px',
              gap: '2px'
            }}
          >
            <Highlighter size={14} />
            <div 
              style={{ 
                width: '14px', 
                height: '3px', 
                backgroundColor: activeHighlightColor === 'transparent' ? 'transparent' : activeHighlightColor,
                border: activeHighlightColor === 'transparent' ? '1px dashed var(--text-muted)' : 'none',
                borderRadius: '1px' 
              }} 
            />
          </button>

          {isHighlightOpen && (
            <Dropdown
              className="glass-panel"
              style={{
                marginTop: '6px',
                backgroundColor: 'var(--bg-paper)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '10px',
                width: '210px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>Highlighter</span>
                <button
                  onMouseDown={e => {
                    e.preventDefault();
                    applyHighlightColor('transparent');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-gold-text, var(--accent-gold))',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Remove
                </button>
              </div>

              {/* preset highlight swatches */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { name: 'Yellow', color: '#fef08a' },
                  { name: 'Mint', color: '#bbf7d0' },
                  { name: 'Cyan Sky', color: '#bae6fd' },
                  { name: 'Blush Pink', color: '#fbcfe8' },
                  { name: 'Lavender', color: '#e9d5ff' },
                  { name: 'Peach', color: '#fed7aa' },
                  { name: 'Soft Rose', color: '#fecaca' },
                  { name: 'Sand Amber', color: '#fef3c7' }
                ].map(item => (
                  <button
                    key={item.color}
                    onMouseDown={e => {
                      e.preventDefault();
                      applyHighlightColor(item.color);
                    }}
                    title={item.name}
                    style={{
                      height: '24px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: item.color,
                      border: activeHighlightColor === item.color ? '2px solid var(--accent-gold)' : '1px solid rgba(0,0,0,0.12)',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-xs)'
                    }}
                  />
                ))}
              </div>

              <SavedHighlights current={activeHighlightColor} onPick={applyHighlightColor} />

              {/* custom highlight input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Custom:</span>
                <input
                  type="color"
                  value={activeHighlightColor === 'transparent' ? '#ffff00' : activeHighlightColor}
                  onChange={e => applyHighlightColor(e.target.value)}
                  style={{
                    width: '28px',
                    height: '24px',
                    padding: 0,
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                />
                <button
                  onMouseDown={e => {
                    e.preventDefault();
                    applyHighlightColor('transparent');
                  }}
                  style={{
                    flex: 1,
                    fontSize: '0.72rem',
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  Clear Highlight
                </button>
              </div>
            </Dropdown>
          )}
        </div>

        <div style={separatorStyle} />

        {/* alignment */}
        <button onClick={() => execCmd('justifyLeft')} title="Align Left" style={tool('left')} aria-pressed={!!fmt.left}>
          <AlignLeft size={15} />
        </button>
        <button onClick={() => execCmd('justifyCenter')} title="Align Center" style={tool('center')} aria-pressed={!!fmt.center}>
          <AlignCenter size={15} />
        </button>
        <button onClick={() => execCmd('justifyRight')} title="Align Right" style={tool('right')} aria-pressed={!!fmt.right}>
          <AlignRight size={15} />
        </button>
        <button onClick={() => execCmd('justifyFull')} title="Justify (Book standard)" style={tool('full')} aria-pressed={!!fmt.full}>
          <AlignJustify size={15} />
        </button>

        <div style={separatorStyle} />

        {/* lists */}
        <button onClick={() => execCmd('insertUnorderedList')} title="Bullet List" style={tool('ul')} aria-pressed={!!fmt.ul}>
          <List size={15} />
        </button>
        <button onClick={() => execCmd('insertOrderedList')} title="Numbered List" style={tool('ol')} aria-pressed={!!fmt.ol}>
          <ListOrdered size={15} />
        </button>

        <div style={separatorStyle} />

        {/* paragraph indent */}
        <button 
          onClick={toggleIndentParagraphs} 
          title="Toggle Book First-Line Paragraph Indentation"
          style={{
            ...btnStyle,
            backgroundColor: userStats.indentParagraphs ? 'var(--accent-gold-bg)' : 'transparent',
            color: userStats.indentParagraphs ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
            border: userStats.indentParagraphs ? '1px solid var(--accent-gold)' : '1px solid transparent'
          }}
        >
          <Indent size={15} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Indent</span>
        </button>

        {/* a scene break at the cursor, in any kind of document */}
        <button onMouseDown={e => e.preventDefault()} onClick={() => insertSceneBreak()} title="Scene break at the cursor" aria-label="Insert a scene break" style={btnStyle}>
          <SeparatorHorizontal size={15} />
        </button>

        <div style={separatorStyle} />

        {/* undo/redo */}
        <button onClick={() => execCmd('undo')} title="Undo (Ctrl+Z)" style={btnStyle}>
          <Undo size={15} />
        </button>
        <button onClick={() => execCmd('redo')} title="Redo (Ctrl+Y)" style={btnStyle}>
          <Redo size={15} />
        </button>
      </div>

      {/* right: chapter status & Word count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status:</span>
          <select aria-label="Chapter status"
            value={activeChapter?.status || 'draft'}
            onChange={e => handleStatusChange(e.target.value as 'draft' | 'revised' | 'final')}
            style={{
              fontSize: '0.78rem',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            <option value="draft">Drafting</option>
            <option value="revised">Revised</option>
            <option value="final">Final Polish</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  color: 'var(--text-main)',
  transition: 'background var(--transition-fast)'
};

const separatorStyle: React.CSSProperties = {
  width: '1px',
  height: '18px',
  backgroundColor: 'var(--border-subtle)',
  margin: '0 4px'
};
