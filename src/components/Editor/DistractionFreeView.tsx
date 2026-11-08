import { sceneCount } from '../../services/openDraft';
import { ambientLabel } from '../../services/soundscapes';
import { keystrokeLabel, keystrokeOptions } from '../../data/keystrokeSounds';
import { ownedKeystrokes } from '../../services/shop';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { Chapter } from '../../types';
import {
  Minimize2,
  Volume2,
  VolumeX,
  PanelRight,
  X,
  MessageSquare,
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Indent,
  Undo,
  Redo,
  ScrollText,
  FileText,
  Lightbulb,
  Edit3,
  Plus,
  Check,
  Keyboard
} from 'lucide-react';
import { CommentsDrawer } from '../Comments/CommentsDrawer';
import { EditorSurface } from '../../editor/EditorSurface';
import { getActiveEditor, useNewEditor } from '../../editor/active';
import { commentOn, commentOnText, paintActiveComment, suggestReplace } from '../../editor/review';
import { run as runEditorCommand } from '../../editor/commands';
import { ActiveSprintBar } from './ActiveSprintBar';

interface ZenChapterSheetProps {
  scope?: string;
  chapter: Chapter;
  isActive: boolean;
  userStats: any;
  onContentChange: (id: string, html: string, remote?: boolean) => void;
  onSelectText: () => void;
  onEditorClick: (e: React.MouseEvent) => void;
  onKeystroke?: (key: string) => void;
}

const ZenChapterSheet: React.FC<ZenChapterSheetProps> = ({
  scope,
  chapter,
  isActive,
  userStats,
  onContentChange,
  onSelectText,
  onEditorClick,
  onKeystroke
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const newEditor = useNewEditor();

  useEffect(() => {
    if (sheetRef.current) {
      if (document.activeElement !== sheetRef.current && sheetRef.current.innerHTML !== chapter.content) {
        sheetRef.current.innerHTML = chapter.content;
      }
    }
  }, [chapter.id, chapter.content]);

  const handleInput = () => {
    if (sheetRef.current) {
      onContentChange(chapter.id, sheetRef.current.innerHTML);
    }
  };

  return (
    <div
      id={`zen-chapter-${chapter.id}`}
      style={{
        width: '100%',
        maxWidth: 'calc(var(--page-width, 840px) - 60px)',
        margin: '0 auto 60px',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseUp={onSelectText}
      onClick={onEditorClick}
    >
      {/* zen chapter title header */}
      <div style={{ textAlign: 'center', marginBottom: '28px', paddingTop: '20px' }}>
        <h2
          style={{
            fontSize: '1.65rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            color: 'var(--text-main)',
            marginBottom: '6px'
          }}
        >
          {chapter.title}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
          Chapter {chapter.order} • {chapter.wordCount || 0} words
        </div>
      </div>

      {/* editable manuscript content */}
      {newEditor ? (
        <EditorSurface
          chapterId={chapter.id}
          scope={scope}
          html={chapter.content}
          onChange={(html, _e, meta) => onContentChange(chapter.id, html, meta?.remote)}
          onKeyDown={e => onKeystroke?.(e.key)}
          className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
          font={userStats.activeFont}
          style={{
            outline: 'none',
            fontSize: `${userStats.fontSize + 1}px`,
            lineHeight: userStats.lineHeight,
            minHeight: '400px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowWrap: 'break-word',
            wordBreak: 'break-word'
          }}
        />
      ) : (
        <div
          ref={sheetRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Manuscript text"
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={e => onKeystroke?.(e.key)}
          className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
          data-font={userStats.activeFont}
          style={{
            outline: 'none',
            fontSize: `${userStats.fontSize + 1}px`,
            lineHeight: userStats.lineHeight,
            minHeight: '400px',
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowWrap: 'break-word',
            wordBreak: 'break-word'
          }}
        />
      )}

      {/* subtle zen chapter separator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '48px auto 0', width: '220px', color: 'var(--text-muted)' }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-title)', color: 'var(--accent-gold-text, var(--accent-gold))' }}>❦</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
      </div>
    </div>
  );
};

export const DistractionFreeView: React.FC = () => {
  const newEditor = useNewEditor();
  const {
    activeChapter,
    updateChapterContent,
    userStats,
    setViewMode,
    project,
    setActiveChapterId,
    setAmbientSound,
    editorScrollMode,
    setEditorScrollMode,
    editorReviewMode,
    setEditorReviewMode,
    activeCommentId,
    setActiveCommentId,
    addComment,
    insertChapterAt,
    toggleIndentParagraphs,
    playKeystroke,
    setKeystrokeSound,
    setKeystrokeVolume,
    awardPoints
  } = useAsterism();

  const singleEditorRef = useRef<HTMLDivElement>(null);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isQuickDrawerOpen, setIsQuickDrawerOpen] = useState(false);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'characters' | 'threads' | 'comments'>('comments');
  const hideTimerRef = useRef<number | null>(null);

  // floating selection formatting & comment pill
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [isCommentInputOpen, setIsCommentInputOpen] = useState(false);
  const [isSuggestionInputOpen, setIsSuggestionInputOpen] = useState(false);
  const [commentInputText, setCommentInputText] = useState('');
  const [suggestionReplacementText, setSuggestionReplacementText] = useState('');
  const savedSelectionRangeRef = useRef<Range | null>(null);

  // sync content in single chapter mode
  useEffect(() => {
    if (editorScrollMode === 'single' && singleEditorRef.current && activeChapter) {
      if (document.activeElement !== singleEditorRef.current && singleEditorRef.current.innerHTML !== activeChapter.content) {
        singleEditorRef.current.innerHTML = activeChapter.content;
      }
    }
  }, [activeChapter?.id, activeChapter?.content, editorScrollMode]);

  // sync active comment highlighting across marks and jump to active comment
  useEffect(() => {
    if (newEditor) {
      paintActiveComment(activeCommentId ?? null);
    } else {
      const marks = document.querySelectorAll('[data-comment-id]');
      marks.forEach(m => {
        if (m.getAttribute('data-comment-id') === activeCommentId) {
          m.classList.add('active-comment');
        } else {
          m.classList.remove('active-comment');
        }
      });
    }

    if (activeCommentId) {
      const scrollTimer = setTimeout(() => {
        const targetEl = document.querySelector(`[data-comment-id="${activeCommentId}"]`) as HTMLElement;
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add('active-comment');
        }
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [activeCommentId]);

  // auto-hide top controls during writing activity
  const handleUserActivity = () => {
    setIsHeaderVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      // keep visible if user has an input popover or drawer open
      if (!isCommentInputOpen && !isSuggestionInputOpen && !isQuickDrawerOpen) {
        setIsHeaderVisible(false);
      }
    }, 4500);
  };

  // quill points for writing in zen (1 for every 12 words). each chapter keeps its own running count, so moving between
  // chapters never reads as words written, and a paste is capped: typing never adds more than a few words in one change
  const wordsSinceLastPointRef = useRef<number>(0);
  const zenWordCountsRef = useRef<Map<string, number>>(new Map());
  const trackZenWords = (chapterId: string, html: string) => {
    const text = html.replace(/<[^>]+>/g, ' ');
    const wordCount = (text.trim().match(/\S+/g) || []).length;
    const before = zenWordCountsRef.current.get(chapterId);
    zenWordCountsRef.current.set(chapterId, wordCount);
    if (before === undefined) return;
    const added = Math.min(wordCount - before, 12);
    if (added <= 0) return;
    wordsSinceLastPointRef.current += added;
    if (wordsSinceLastPointRef.current >= 12) {
      const pts = Math.floor(wordsSinceLastPointRef.current / 12);
      wordsSinceLastPointRef.current = wordsSinceLastPointRef.current % 12;
      awardPoints(pts, `${pts} Quill Point${pts > 1 ? 's' : ''} (Zen flow)`, true);
    }
  };

  // keep the line being typed in view: zen scrolls inside its own backdrop, never up while typing
  const zenRootRef = useRef<HTMLDivElement>(null);
  const keepCursorInView = () => {
    requestAnimationFrame(() => {
      const container = zenRootRef.current;
      const sel = window.getSelection();
      if (!container || !sel || sel.rangeCount === 0 || !container.contains(sel.anchorNode)) return;
      try {
        let rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.height === 0) {
          const node = sel.focusNode;
          const el = node && (node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement);
          if (el) rect = el.getBoundingClientRect();
        }
        if (rect.top === 0 && rect.bottom === 0) return;
        const box = container.getBoundingClientRect();
        const bottomLimit = box.bottom - 150;
        if (rect.bottom > bottomLimit) {
          container.scrollBy({ top: rect.bottom - bottomLimit + 36, behavior: 'smooth' });
        } else if (userStats.typewriterMode) {
          const delta = rect.top - (box.top + box.height / 2);
          if (delta > 35) container.scrollBy({ top: delta * 0.45, behavior: 'smooth' });
        }
      } catch {
        // ignore geometry errors
      }
    });
  };

  // one change to a chapter in zen, from either view
  const handleZenChange = (chapterId: string, html: string, remote = false) => {
    updateChapterContent(chapterId, html);
    handleUserActivity();
    // words that came from someone else do not earn points
    if (remote) {
      zenWordCountsRef.current.delete(chapterId);
      return;
    }
    trackZenWords(chapterId, html);
    keepCursorInView();
  };

  // keyboard shortcut for esc to exit & close popovers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCommentInputOpen || isSuggestionInputOpen || selectedText) {
          setIsCommentInputOpen(false);
          setIsSuggestionInputOpen(false);
          setSelectedText('');
          setSelectionCoords(null);
          return;
        }
        setViewMode('standard');
      }
    };

    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('.asterism-floating-popup') &&
        !target.closest('.asterism-format-bubble')
      ) {
        setIsCommentInputOpen(false);
        setIsSuggestionInputOpen(false);
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectedText('');
          setSelectionCoords(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [setViewMode, isCommentInputOpen, isSuggestionInputOpen, selectedText]);

  // handle single mode typing
  const handleSingleInput = (fromEditor?: string, remote = false) => {
    if (!activeChapter || (fromEditor === undefined && !singleEditorRef.current)) return;
    handleZenChange(activeChapter.id, fromEditor ?? singleEditorRef.current!.innerHTML, remote);
  };

  // execute standard formatting commands
  const execCmd = (command: string, value: string | undefined = undefined) => {
    const live = newEditor ? getActiveEditor() : null;
    if (live) runEditorCommand(live, command, value);
    else document.execCommand(command, false, value);
    handleUserActivity();
  };

  // text selection listener
  const handleSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 1) {
      const text = sel.toString().trim();
      setSelectedText(text);
      try {
        const range = sel.getRangeAt(0);
        savedSelectionRangeRef.current = range.cloneRange();
        const rect = range.getBoundingClientRect();
        setSelectionCoords({
          x: Math.min(window.innerWidth - 220, Math.max(120, rect.left + rect.width / 2)),
          y: Math.max(15, rect.top - 46)
        });
      } catch {
        // ignore selection rect errors
      }
    }
  };

  // editor click listener to detect clicking on a commented mark
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-comment-id]');
    if (target) {
      const commentId = target.getAttribute('data-comment-id');
      if (commentId) {
        setActiveCommentId(commentId);
        setIsQuickDrawerOpen(true);
        setDrawerTab('comments');
      }
    }
  };

  // save inline comment
  const handleSaveInlineComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInputText.trim() || !selectedText) return;

    const commentId = addComment(selectedText, commentInputText.trim(), 'comment');

    // wrap selection in mark using saved range
    let wrapped = false;
    const range = savedSelectionRangeRef.current;
    if (newEditor) {
      if (range) wrapped = commentOn(range, commentId);
      if (!wrapped) { const live = getActiveEditor(); wrapped = !!live && commentOnText(live, selectedText, commentId); }
    } else if (range) {
      try {
        const mark = document.createElement('mark');
        mark.className = 'asterism-comment-highlight active-comment';
        mark.setAttribute('data-comment-id', commentId);
        mark.textContent = selectedText;
        range.deleteContents();
        range.insertNode(mark);
        wrapped = true;

        if (editorScrollMode === 'single' && singleEditorRef.current && activeChapter) {
          updateChapterContent(activeChapter.id, singleEditorRef.current.innerHTML);
        }
      } catch (err) {
        console.warn('Range wrap fallback in zen mode', err);
      }
    }

    if (!wrapped && !newEditor && singleEditorRef.current && activeChapter) {
      const cleanText = selectedText.trim();
      const escaped = cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped);
      if (regex.test(singleEditorRef.current.innerHTML)) {
        singleEditorRef.current.innerHTML = singleEditorRef.current.innerHTML.replace(
          regex,
          `<mark class="asterism-comment-highlight active-comment" data-comment-id="${commentId}">${cleanText}</mark>`
        );
        updateChapterContent(activeChapter.id, singleEditorRef.current.innerHTML);
      }
    }

    savedSelectionRangeRef.current = null;
    setCommentInputText('');
    setIsCommentInputOpen(false);
    setSelectedText('');
    setSelectionCoords(null);
  };

  // save suggestion replacement
  const handleSaveSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionReplacementText.trim() || !selectedText) return;

    const commentId = addComment(
      selectedText,
      `Suggestion: "${suggestionReplacementText.trim()}"`,
      'suggestion',
      suggestionReplacementText.trim()
    );

    let replaced = false;
    const range = savedSelectionRangeRef.current;
    if (newEditor) {
      replaced = !!range && suggestReplace(range, commentId, suggestionReplacementText.trim());
    } else if (range) {
      try {
        const delEl = document.createElement('del');
        delEl.className = 'asterism-suggestion-del';
        delEl.setAttribute('data-suggestion-id', commentId);
        delEl.setAttribute('title', 'Suggested deletion');
        delEl.textContent = selectedText;

        const insEl = document.createElement('ins');
        insEl.className = 'asterism-suggestion-ins';
        insEl.setAttribute('data-suggestion-id', commentId);
        insEl.setAttribute('title', 'Suggested addition');
        insEl.textContent = suggestionReplacementText.trim();

        range.deleteContents();
        range.insertNode(delEl);
        delEl.after(insEl);
        replaced = true;

        if (editorScrollMode === 'single' && singleEditorRef.current && activeChapter) {
          updateChapterContent(activeChapter.id, singleEditorRef.current.innerHTML);
        }
      } catch (err) {
        console.warn('Suggestion replace fallback in zen mode', err);
      }
    }

    if (!replaced && !newEditor && singleEditorRef.current && activeChapter) {
      const cleanText = selectedText.trim();
      const escaped = cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped);
      if (regex.test(singleEditorRef.current.innerHTML)) {
        singleEditorRef.current.innerHTML = singleEditorRef.current.innerHTML.replace(
          regex,
          `<del class="asterism-suggestion-del" data-suggestion-id="${commentId}">${cleanText}</del><ins class="asterism-suggestion-ins" data-suggestion-id="${commentId}">${suggestionReplacementText.trim()}</ins>`
        );
        updateChapterContent(activeChapter.id, singleEditorRef.current.innerHTML);
      }
    }

    savedSelectionRangeRef.current = null;
    setSuggestionReplacementText('');
    setIsSuggestionInputOpen(false);
    setSelectedText('');
    setSelectionCoords(null);
  };

  const activeChapterComments = (project.comments || []).filter(c => c.chapterId === activeChapter?.id && !c.resolved);

  const totalManuscriptWords = project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

  return (
    <div
      className="zen-backdrop"
      ref={zenRootRef}
      onMouseMove={handleUserActivity}
      onMouseUp={handleSelection}
      style={{
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        width: '100%',
        height: 'var(--app-vh)',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative'
      }}
    >
      {/* ============================================================== */}
      {/* floating selection markdown & annotation capsule */}
      {/* ============================================================== */}
      {selectedText && selectionCoords && !isCommentInputOpen && !isSuggestionInputOpen && (
        <div
          className="glass-panel animate-fade-in asterism-format-bubble"
          style={{
            position: 'fixed',
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 1500,
            padding: '4px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--toolbar-bg)',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--accent-gold)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            userSelect: 'none'
          }}
        >
          {/* Markdown quick actions */}
          <button
            onClick={() => execCmd('bold')}
            title="Bold (**text**)"
            style={zenFloatingBtnStyle}
          >
            <Bold size={13} />
          </button>
          <button
            onClick={() => execCmd('italic')}
            title="Italic (*text*)"
            style={zenFloatingBtnStyle}
          >
            <Italic size={13} />
          </button>
          <button
            onClick={() => execCmd('strikeThrough')}
            title="Strikethrough (~~text~~)"
            style={zenFloatingBtnStyle}
          >
            <Strikethrough size={13} />
          </button>
          <button
            onClick={() => execCmd('formatBlock', '<h2>')}
            title="Heading 2 (## Title)"
            style={zenFloatingBtnStyle}
          >
            <Heading2 size={13} />
          </button>
          <button
            onClick={() => execCmd('formatBlock', '<blockquote>')}
            title="Epigraph / Quote (> quote)"
            style={zenFloatingBtnStyle}
          >
            <Quote size={13} />
          </button>

          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>|</span>

          {/* add note button */}
          <button
            onClick={() => {
              setIsCommentInputOpen(true);
              setIsSuggestionInputOpen(false);
            }}
            style={{
              ...zenFloatingBtnStyle,
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontWeight: 600,
              gap: '4px'
            }}
            title="Attach Note / Comment to highlighted text"
          >
            <MessageSquare size={13} />
            <span>Note</span>
          </button>

          {/* suggest edit button */}
          <button
            onClick={() => {
              setIsSuggestionInputOpen(true);
              setIsCommentInputOpen(false);
              setSuggestionReplacementText(selectedText);
            }}
            style={{
              ...zenFloatingBtnStyle,
              color: '#10b981',
              fontWeight: 600,
              gap: '4px'
            }}
            title="Suggest replacement text (Track Changes)"
          >
            <Lightbulb size={13} />
            <span>Suggest</span>
          </button>
        </div>
      )}

      {/* floating zen comment input popover */}
      {isCommentInputOpen && selectionCoords && (
        <div
          className="glass-panel animate-fade-in asterism-floating-popup"
          style={{
            position: 'fixed',
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1600,
            width: '290px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-paper)',
            boxShadow: 'var(--shadow-paper)',
            border: '1px solid var(--accent-gold)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>Attach Note to Selection</span>
            <button onClick={() => { setIsCommentInputOpen(false); setSelectedText(''); }} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleSaveInlineComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              placeholder="Zen observation, developmental reminder, or critique..."
              value={commentInputText}
              onChange={e => setCommentInputText(e.target.value)}
              rows={2}
              autoFocus
              style={{ width: '100%', padding: '6px', fontSize: '0.82rem', boxSizing: 'border-box', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
            />
            <button
              type="submit"
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                alignSelf: 'flex-end',
                cursor: 'pointer'
              }}
            >
              Attach Note
            </button>
          </form>
        </div>
      )}

      {/* floating zen suggestion input popover */}
      {isSuggestionInputOpen && selectionCoords && (
        <div
          className="glass-panel animate-fade-in asterism-floating-popup"
          style={{
            position: 'fixed',
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1600,
            width: '310px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-paper)',
            boxShadow: 'var(--shadow-paper)',
            border: '1px solid #10b981'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#10b981' }}>Suggest Replacement Text</span>
            <button onClick={() => { setIsSuggestionInputOpen(false); setSelectedText(''); }} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleSaveSuggestion} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              placeholder="Replacement text..."
              value={suggestionReplacementText}
              onChange={e => setSuggestionReplacementText(e.target.value)}
              rows={2}
              autoFocus
              style={{ width: '100%', padding: '6px', fontSize: '0.82rem', boxSizing: 'border-box', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
            />
            <button
              type="submit"
              style={{
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#10b981',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                alignSelf: 'flex-end',
                cursor: 'pointer'
              }}
            >
              Save Suggestion
            </button>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* floating zen top bar: markdown tools, scroll & peaks */}
      {/* ============================================================== */}
      <header
        className="glass-panel"
        style={{
          position: 'fixed',
          top: isHeaderVisible ? '16px' : '-100px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-lg)',
          backgroundColor: 'var(--toolbar-bg)',
          transition: 'top 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1100,
          userSelect: 'none',
          maxWidth: '96vw',
          overflowX: 'auto',
          scrollbarWidth: 'none'
        }}
      >
        {/* Markdown formatting controls at top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button onClick={() => execCmd('bold')} title="Bold (**B**)" style={zenBarBtnStyle}>
            <Bold size={13} />
          </button>
          <button onClick={() => execCmd('italic')} title="Italic (*I*)" style={zenBarBtnStyle}>
            <Italic size={13} />
          </button>
          <button onClick={() => execCmd('strikeThrough')} title="Strikethrough (~~S~~)" style={zenBarBtnStyle}>
            <Strikethrough size={13} />
          </button>
          <button onClick={() => execCmd('formatBlock', '<h2>')} title="Heading 2 (## Section)" style={zenBarBtnStyle}>
            <Heading2 size={13} />
          </button>
          <button onClick={() => execCmd('formatBlock', '<h3>')} title="Heading 3 (### Sub-scene)" style={zenBarBtnStyle}>
            <Heading3 size={13} />
          </button>
          <button onClick={() => execCmd('formatBlock', '<blockquote>')} title="Epigraph / Quote (>)" style={zenBarBtnStyle}>
            <Quote size={13} />
          </button>
          <button onClick={() => execCmd('insertUnorderedList')} title="Bullet List (-)" style={zenBarBtnStyle}>
            <List size={13} />
          </button>
          <button onClick={() => execCmd('insertOrderedList')} title="Numbered List (1.)" style={zenBarBtnStyle}>
            <ListOrdered size={13} />
          </button>
          <button
            onClick={toggleIndentParagraphs}
            title="Toggle Paragraph Indent (¶)"
            style={{
              ...zenBarBtnStyle,
              color: userStats.indentParagraphs ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
            }}
          >
            <Indent size={13} />
          </button>
          <button onClick={() => execCmd('undo')} title="Undo" style={zenBarBtnStyle}>
            <Undo size={13} />
          </button>
          <button onClick={() => execCmd('redo')} title="Redo" style={zenBarBtnStyle}>
            <Redo size={13} />
          </button>
        </div>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* continuous vs single scroll mode toggle in zen */}
        <button
          onClick={() => setEditorScrollMode(editorScrollMode === 'single' ? 'infinite' : 'single')}
          title={editorScrollMode === 'infinite' ? "Viewing All Chapters. Click to switch to Single Chapter." : "Viewing Single Chapter. Click to scroll All Chapters continuously."}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: editorScrollMode === 'infinite' ? 'var(--accent-gold-bg)' : 'transparent',
            border: editorScrollMode === 'infinite' ? '1px solid var(--accent-gold)' : '1px solid transparent',
            color: editorScrollMode === 'infinite' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {editorScrollMode === 'infinite' ? <ScrollText size={13} /> : <FileText size={13} />}
          <span>{editorScrollMode === 'infinite' ? 'Scroll All' : 'Single'}</span>
        </button>

        {/* Word count metric */}
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          <strong style={{ color: 'var(--text-main)' }}>
            {editorScrollMode === 'infinite' ? totalManuscriptWords.toLocaleString() : (activeChapter?.wordCount || 0)}
          </strong> words
        </div>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* sensory typing audio & ambient soundscape popover */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: (userStats.keystrokeSound !== 'off' || userStats.ambientSound !== 'off') ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
            title="Typing Keystroke Sounds & Ambient Soundscapes"
          >
            <Keyboard size={13} />
            <span style={{ textTransform: 'capitalize' }}>
              {userStats.keystrokeSound !== 'off' ? keystrokeLabel(userStats.keystrokeSound, userStats.customSounds) : (userStats.ambientSound !== 'off' ? ambientLabel(userStats.ambientSound, userStats.customSoundscapes) : 'Audio')}
            </span>
          </button>

          {isAudioMenuOpen && (
            <div
              className="glass-panel animate-fade-in"
              style={{
                position: 'absolute',
                bottom: '150%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '270px',
                backgroundColor: 'var(--bg-paper)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-subtle)',
                padding: '12px',
                zIndex: 500,
                maxHeight: '400px',
                overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold-text, var(--accent-gold))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Mechanical Keystroke Sound
                </span>
                <button onClick={() => setIsAudioMenuOpen(false)} style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>

              {keystrokeOptions(userStats.customSounds, ownedKeystrokes(userStats.unlockedCosmetics, userStats.unlockedBadges), userStats.keystrokeSound).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setKeystrokeSound(opt.id as any);
                    playKeystroke('a', opt.id as any);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    color: userStats.keystrokeSound === opt.id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
                    backgroundColor: userStats.keystrokeSound === opt.id ? 'var(--accent-gold-bg)' : 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <span>{opt.icon}</span>
                  <span style={{ fontWeight: userStats.keystrokeSound === opt.id ? 600 : 400, flex: 1 }}>{opt.label}</span>
                  {userStats.keystrokeSound === opt.id && <Check size={13} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                </button>
              ))}

              {userStats.keystrokeSound !== 'off' && (
                <div style={{ marginTop: '6px', marginBottom: '8px', padding: '0 4px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    Key Volume ({Math.round((userStats.keystrokeVolume ?? 0.45) * 100)}%)
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={userStats.keystrokeVolume ?? 0.45}
                    onChange={e => setKeystrokeVolume(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-gold)' }}
                  />
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '8px 0' }} />

              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-gold-text, var(--accent-gold))', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ambient Soundscape
              </div>

              {[
                { id: 'off', label: 'Silence', icon: <VolumeX size={13} /> },
                { id: 'ocean', label: 'Ocean Waves', icon: <Volume2 size={13} /> },
                { id: 'rain', label: 'Rain on Glass', icon: <Volume2 size={13} /> },
                { id: 'wind', label: 'Wind Through Trees', icon: <Volume2 size={13} /> },
                { id: 'fire', label: 'Actual Crackling Fire', icon: <Volume2 size={13} /> },
                { id: 'library', label: 'Silent Library', icon: <Volume2 size={13} /> },
                ...(userStats.customSoundscapes || []).map(s => ({ id: s.id, label: s.name, icon: <Volume2 size={13} /> })),
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setAmbientSound(opt.id as any)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.76rem',
                    color: userStats.ambientSound === opt.id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
                    backgroundColor: userStats.ambientSound === opt.id ? 'var(--accent-gold-bg)' : 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  {opt.icon}
                  <span style={{ fontWeight: userStats.ambientSound === opt.id ? 600 : 400 }}>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* notes quick peek */}
        <button
          onClick={() => {
            setIsQuickDrawerOpen(true);
            setDrawerTab('comments');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: activeChapterComments.length > 0 ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            fontSize: '0.76rem',
            cursor: 'pointer'
          }}
          title="View & leave notes in Zen Mode"
        >
          <MessageSquare size={13} />
          <span>Notes ({activeChapterComments.length})</span>
        </button>

        {/* bible peek */}
        <button
          onClick={() => {
            setIsQuickDrawerOpen(true);
            setDrawerTab('characters');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--text-secondary)',
            fontSize: '0.76rem',
            cursor: 'pointer'
          }}
          title="Quick look at characters or plot threads without leaving zen"
        >
          <PanelRight size={13} />
          <span>Peek</span>
        </button>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* exit zen button */}
        <button
          onClick={() => setViewMode('standard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--accent-primary)',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          title="Exit Zen Mode (Esc)"
        >
          <Minimize2 size={13} />
          <span>Exit</span>
        </button>
      </header>

      {/* active writing sprint bar */}
      <ActiveSprintBar />

      {/* ============================================================== */}
      {/* main zen manuscript canvas (continuous or single) */}
      {/* ============================================================== */}
      <main
        style={{
          maxWidth: '820px',
          margin: '90px auto 160px',
          padding: '0 24px',
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        {editorScrollMode === 'infinite' ? (
          /* continuous scroll: all chapters in zen */
          <div>
            {project.chapters.map((chap, idx) => (
              <ZenChapterSheet
                scope={project.id}
                key={chap.id}
                chapter={chap}
                isActive={chap.id === activeChapter?.id}
                userStats={userStats}
                onContentChange={(id, html, remote) => handleZenChange(id, html, remote)}
                onSelectText={handleSelection}
                onEditorClick={handleEditorClick}
                onKeystroke={playKeystroke}
              />
            ))}

            {/* bottom add chapter in zen */}
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <button
                onClick={() => insertChapterAt(project.chapters.length)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--tag-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Plus size={14} />
                <span>+ Add Next Chapter in Zen</span>
              </button>
            </div>
          </div>
        ) : (
          /* single chapter focus in zen */
          activeChapter && (
            <div onClick={handleEditorClick}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {activeChapter.title}
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {project.draftMode === 'open_draft' ? `${sceneCount(activeChapter.content)} scene${sceneCount(activeChapter.content) === 1 ? '' : 's'}` : `Chapter ${activeChapter.order} of ${project.chapters.length}`} • {activeChapter.wordCount || 0} words
                </div>
              </div>

              {newEditor ? (
                <EditorSurface
                  chapterId={activeChapter.id}
                  scope={project.id}
                  html={activeChapter.content}
                  onChange={(html, _e, meta) => handleSingleInput(html, meta?.remote)}
                  onKeyDown={e => playKeystroke(e.key)}
                  className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
                  font={userStats.activeFont}
                  style={{
                    outline: 'none',
                    fontSize: `${userStats.fontSize + 1}px`,
                    lineHeight: userStats.lineHeight,
                    minHeight: '75vh',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word'
                  }}
                />
              ) : (
                <div
                  ref={singleEditorRef}
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Manuscript text"
                  suppressContentEditableWarning
                  onInput={() => handleSingleInput()}
                  onKeyDown={e => playKeystroke(e.key)}
                  className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
                  data-font={userStats.activeFont}
                  style={{
                    outline: 'none',
                    fontSize: `${userStats.fontSize + 1}px`,
                    lineHeight: userStats.lineHeight,
                    minHeight: '75vh',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word'
                  }}
                />
              )}
            </div>
          )
        )}
      </main>

      {/* slide-out quick drawer (peek at characters, threads, OR comments without breaking flow) */}
      {isQuickDrawerOpen && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '360px',
            backgroundColor: 'var(--bg-paper)',
            boxShadow: 'var(--shadow-paper)',
            borderLeft: '1px solid var(--border-strong)',
            zIndex: 1400,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setDrawerTab('comments')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: drawerTab === 'comments' ? 'var(--accent-gold-bg)' : 'transparent',
                  color: drawerTab === 'comments' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Notes ({activeChapterComments.length})
              </button>
              <button
                onClick={() => setDrawerTab('characters')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: drawerTab === 'characters' ? 'var(--accent-gold-bg)' : 'transparent',
                  color: drawerTab === 'characters' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Characters
              </button>
              <button
                onClick={() => setDrawerTab('threads')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: drawerTab === 'threads' ? 'var(--accent-gold-bg)' : 'transparent',
                  color: drawerTab === 'threads' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Threads
              </button>
            </div>
            <button onClick={() => setIsQuickDrawerOpen(false)} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {drawerTab === 'comments' && (
              <CommentsDrawer isFloating={false} />
            )}

            {drawerTab === 'characters' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {project.storyBible.characters.map(c => (
                  <div key={c.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--accent-gold-text, var(--accent-gold))' }}>{c.name}</div>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>{c.role}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <strong>Core Desire:</strong> {c.coreDesire}
                    </div>
                    {c.theSecret && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <strong>Secret:</strong> {c.theSecret}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {drawerTab === 'threads' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {project.plotThreads.map(t => (
                  <div key={t.id} style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold-text, var(--accent-gold))', textTransform: 'capitalize', marginBottom: '4px' }}>
                      {t.type} • {t.status}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {t.notes}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const zenBarBtnStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'color var(--transition-fast)'
};

const zenFloatingBtnStyle: React.CSSProperties = {
  padding: '4px 7px',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-main)',
  fontSize: '0.76rem',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  transition: 'color var(--transition-fast)'
};
