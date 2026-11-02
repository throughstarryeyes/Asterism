import { countWordsFromHtml } from '../../services/storage';
import { sceneCount } from '../../services/openDraft';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { EditorSurface } from '../../editor/EditorSurface';
import { getActiveEditor, useNewEditor } from '../../editor/active';
import { commentOn, commentOnText, paintActiveComment, replaceRange, replaceRanges, resolveSuggestion, suggestReplace, suggesting } from '../../editor/review';
import { run as runEditorCommand, setHighlight as setEditorHighlight, setTextColor as setEditorTextColor } from '../../editor/commands';
import { useAsterism } from '../../context/AsterismContext';
import type { Chapter, UserStats } from '../../types';
import { 
  Sparkles, 
  Clock, 
  MessageSquare, 
  Check, 
  X, 
  Scissors, 
  Plus, 
  ArrowUpToLine, 
  ScrollText, 
  FileText, 
  Layers,
  ChevronDown,
  BookOpen,
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Quote,
  Lightbulb,
  Keyboard,
  Volume2,
  VolumeX,
  Highlighter,
  Search,
  ChevronUp,
  Replace
} from 'lucide-react';
import { CommentsDrawer } from '../Comments/CommentsDrawer';
import { keystrokeLabel, keystrokeOptions } from '../../data/keystrokeSounds';
import { withBaselines, wordsAddedThisSession, type Baseline } from '../../services/sessionWords';
import { quoteCandidates } from '../../services/passageSearch';
import { ActiveSprintBar } from './ActiveSprintBar';
import { WritingSprintModal } from './WritingSprintModal';

interface DocumentTextMatch {
  root: HTMLElement;
  range: Range;
  startOffset: number;
}

// same length in, same length out, so match positions still line up with the page.
const flattenQuotes = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\u00a0/g, ' ');

const findDocumentMatches = (rawQuery: string, onlyChapterId?: string): DocumentTextMatch[] => {
  const query = flattenQuotes(rawQuery);
  if (!query) return [];

  const matches: DocumentTextMatch[] = [];
  document.querySelectorAll<HTMLElement>('.editable-manuscript').forEach(root => {
    if (onlyChapterId && root.dataset.chapterId && root.dataset.chapterId !== onlyChapterId) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const segments: Array<{ node: Text; start: number; end: number }> = [];
    let text = '';
    let node = walker.nextNode() as Text | null;

    while (node) {
      const start = text.length;
      text += flattenQuotes(node.data);
      segments.push({ node, start, end: text.length });
      node = walker.nextNode() as Text | null;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escapedQuery, 'gi');
    let found: RegExpExecArray | null;
    while ((found = expression.exec(text))) {
      const end = found.index + found[0].length;
      const startSegment = segments.find(segment => found!.index >= segment.start && found!.index < segment.end);
      const endSegment = segments.find(segment => end > segment.start && end <= segment.end);
      if (!startSegment || !endSegment) continue;

      const range = document.createRange();
      range.setStart(startSegment.node, found.index - startSegment.start);
      range.setEnd(endSegment.node, end - endSegment.start);
      matches.push({ root, range, startOffset: found.index });
    }
  });

  return matches;
};

interface ContinuousChapterSheetProps {
  // the document the chapter belongs to
  scope?: string;
  chapter: Chapter;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isOpenDraft?: boolean;
  userStats: UserStats;
  isActive: boolean;
  onContentChange: (id: string, html: string, remote?: boolean) => void;
  onTitleChange: (id: string, title: string) => void;
  onSplit: (id: string) => void;
  onInsertBelow: (index: number) => void;
  onMergePrev: (id: string) => void;
  onSelectText: () => void;
  onEditorClick?: (e: React.MouseEvent) => void;
  onKeystroke?: (key: string, e?: React.KeyboardEvent<HTMLDivElement>, chapterId?: string) => void;
  onInsertSceneBreak?: () => void;
}

const ContinuousChapterSheet: React.FC<ContinuousChapterSheetProps> = ({
  scope,
  chapter,
  index,
  isFirst,
  isLast,
  isOpenDraft,
  userStats,
  isActive,
  onContentChange,
  onTitleChange,
  onSplit,
  onInsertBelow,
  onMergePrev,
  onSelectText,
  onEditorClick,
  onKeystroke,
  onInsertSceneBreak
}) => {
  const sheetEditorRef = useRef<HTMLDivElement>(null);
  const newEditor = useNewEditor();

  useEffect(() => {
    if (sheetEditorRef.current) {
      if (document.activeElement !== sheetEditorRef.current && sheetEditorRef.current.innerHTML !== chapter.content) {
        sheetEditorRef.current.innerHTML = chapter.content;
      }
    }
  }, [chapter.id, chapter.content]);

  const handleInput = () => {
    if (sheetEditorRef.current) {
      onContentChange(chapter.id, sheetEditorRef.current.innerHTML);
    }
  };

  return (
    <div
      id={`chapter-section-${chapter.id}`}
      style={{
        width: '100%',
        maxWidth: 'var(--page-width, 840px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '40px'
      }}
    >
      {/* chapter page sheet */}
      <div
        className="manuscript-page"
        style={{
          width: '100%',
          maxWidth: 'var(--page-width, 840px)',
          padding: 'min(var(--page-margin-y, 64px), 12vw) min(var(--page-margin-x, 64px), 12vw) 80px',
          backgroundColor: 'var(--bg-paper)',
          color: 'var(--text-main)',
          fontSize: `${userStats.fontSize}px`,
          lineHeight: userStats.lineHeight,
          boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-paper)',
          borderRadius: 'var(--radius-paper, var(--radius-lg))',
          border: isActive ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
          boxSizing: 'border-box',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
          transition: 'border-color var(--transition-fast)'
        }}
        onMouseUp={onSelectText}
        onClick={onEditorClick}
      >
        {/* chapter / draft header */}
        <div style={{ marginBottom: isOpenDraft ? '20px' : '28px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: isOpenDraft ? '12px' : '16px' }}>
          <input
            type="text"
            value={chapter.title}
            onChange={e => onTitleChange(chapter.id, e.target.value)}
            style={{
              width: '100%',
              fontSize: isOpenDraft ? '1.8rem' : '1.5rem',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              textAlign: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-main)',
              outline: 'none',
              marginBottom: '6px'
            }}
            placeholder={isOpenDraft ? "Manuscript Title..." : "Chapter Title..."}
          />
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isOpenDraft ? (
              <>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Open Draft Canvas</span>
                <span>•</span>
                <span>{chapter.wordCount || 0} words</span>
              </>
            ) : (
              <>
                <span>Chapter {chapter.order}</span>
                <span>•</span>
                <span style={{ textTransform: 'capitalize' }}>{chapter.status}</span>
                <span>•</span>
                <span>{chapter.wordCount || 0} words</span>
              </>
            )}
          </div>
        </div>

        {/* editable rich text canvas for this chapter */}
        {newEditor ? (
          <EditorSurface
            chapterId={chapter.id}
            scope={scope}
            html={chapter.content}
            onChange={(html, _e, meta) => onContentChange(chapter.id, html, meta?.remote)}
            onKeyDown={e => onKeystroke?.(e.key, undefined, chapter.id)}
            className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
            font={userStats.activeFont}
            style={{
              minHeight: '280px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              outline: 'none',
              fontSize: `${userStats.fontSize}px`,
              lineHeight: userStats.lineHeight,
              overflowWrap: 'break-word',
              wordBreak: 'break-word'
            }}
          />
        ) : (
          <div
            ref={sheetEditorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Manuscript text"
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={e => onKeystroke?.(e.key, e, chapter.id)}
            onClick={onEditorClick}
            className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
            data-font={userStats.activeFont}
            data-chapter-id={chapter.id}
            style={{
              minHeight: '280px',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              outline: 'none',
              fontSize: `${userStats.fontSize}px`,
              lineHeight: userStats.lineHeight,
              overflowWrap: 'break-word',
              wordBreak: 'break-word'
            }}
          />
        )}
      </div>

      {/* chapter break separator & in-between controls (only in chaptered mode) */}
      {!isOpenDraft && (
        <div
          style={{
            width: '100%',
            maxWidth: 'var(--page-width, 840px)',
            marginTop: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          {/* ornamental ribbon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-title)', color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>❦</span>
              <span>End of Chapter {chapter.order}</span>
              <span>❦</span>
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          </div>

          {/* inter-chapter action bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.74rem'
            }}
          >
            <button
              onClick={() => onSplit(chapter.id)}
              title="Split this chapter into two distinct chapters"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                color: 'var(--accent-gold-text, var(--accent-gold))',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Scissors size={12} />
              <span>Split Chapter</span>
            </button>

            <span style={{ color: 'var(--border-strong)' }}>•</span>

            <button
              onClick={() => onInsertBelow(index + 1)}
              title="Insert a new chapter directly below"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              <Plus size={12} />
              <span>Insert Chapter Below</span>
            </button>

            {!isFirst && (
              <>
                <span style={{ color: 'var(--border-strong)' }}>•</span>
                <button
                  onClick={() => onMergePrev(chapter.id)}
                  title="Combine this chapter with previous"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    color: 'var(--text-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Layers size={12} />
                  <span>Merge with Previous</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* open draft scene break shortcut at bottom of draft */}
      {isOpenDraft && isLast && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => onInsertSceneBreak?.()}
            title="Insert a scene break (* * *) to transition scenes"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--tag-bg)',
              border: '1px dashed var(--border-subtle)',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <span>* * * Scene break at the end</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const WritingCanvas: React.FC = () => {
  const newEditor = useNewEditor();
  const { 
    project,
    activeChapter, 
    activeChapterId,
    setActiveChapterId,
    updateChapterContent, 
    updateChapterTitle,
    userStats, 
    awardPoints,
    addComment,
    updateSuggestionText,
    acceptSuggestion,
    rejectSuggestion,
    deleteComment,
    editorScrollMode,
    setEditorScrollMode,
    editorReviewMode,
    activeCommentId,
    setActiveCommentId,
    jumpTarget,
    splitChapter,
    insertChapterAt,
    mergeChapterWithPrevious,
    showToast,
    playKeystroke,
    setKeystrokeSound,
    setKeystrokeVolume,
    setAmbientSound,
    insertSceneBreak
  } = useAsterism();

  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // words added this session: how much longer the manuscript is than when you sat down.
  // each chapter's starting word count is remembered the first time it is seen.
  const [sessionBaseline, setSessionBaseline] = useState<Baseline>({});
  useEffect(() => {
    setSessionBaseline(prev => withBaselines(prev, project.chapters));
  }, [project.chapters]);
  const sessionWordsAdded = wordsAddedThisSession(project.chapters, sessionBaseline);

  // a small reward each time the session passes another 250 words.
  const lastMilestoneRef = useRef(0);
  useEffect(() => {
    const milestone = Math.floor(sessionWordsAdded / 250);
    if (milestone > lastMilestoneRef.current) {
      lastMilestoneRef.current = milestone;
      awardPoints(20, '250 Words Written Sprint Milestone', true);
    }
  }, [sessionWordsAdded, awardPoints]);

  // the bar along the bottom can be tucked away. remembered on this device.
  const [isBarHidden, setIsBarHidden] = useState(() => {
    try { return localStorage.getItem('asterism_hide_session_bar') === '1'; } catch { return false; }
  });
  const setBarHidden = (hidden: boolean) => {
    setIsBarHidden(hidden);
    if (hidden) setIsAudioMenuOpen(false);
    try { localStorage.setItem('asterism_hide_session_bar', hidden ? '1' : '0'); } catch { /* storage unavailable: it just won't be remembered */ }
  };
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findMatchIndex, setFindMatchIndex] = useState(-1);
  const [findMatchCount, setFindMatchCount] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // floating selection comment bubble & suggestion
  const [selectedText, setSelectedText] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [isCommentInputOpen, setIsCommentInputOpen] = useState(false);
  const [isSuggestionInputOpen, setIsSuggestionInputOpen] = useState(false);
  const [commentInputText, setCommentInputText] = useState('');
  const [suggestionReplacementText, setSuggestionReplacementText] = useState('');
  const savedSelectionRangeRef = useRef<Range | null>(null);

  // floating Google Docs style suggestion card
  const [activeInlineSuggestion, setActiveInlineSuggestion] = useState<{
    id: string;
    x: number;
    y: number;
    insText: string;
    delText: string;
    type: 'add' | 'delete' | 'replace';
  } | null>(null);

  // floating selection color & highlighter popovers
  const [isFormatColorOpen, setIsFormatColorOpen] = useState(false);
  const [isFormatHighlightOpen, setIsFormatHighlightOpen] = useState(false);
  const [formatTextColor, setFormatTextColor] = useState<string>('inherit');
  const [formatHighlightColor, setFormatHighlightColor] = useState<string>('transparent');

  // floating side comments drawer
  const [isSideCommentsOpen, setIsSideCommentsOpen] = useState(false);

  // normal writing word counter for frequent quill points reward (1 point per 12 words)
  const wordsSinceLastPointRef = useRef<number>(0);
  const lastSingleWordCountRef = useRef<number | null>(null);
  const lastContinuousWordCountRef = useRef<number | null>(null);

  // scroll so the match sits mid-screen. the page highlight (below) shows which one it is, so the
  // find box keeps the cursor and enter keeps stepping.
  const selectFindMatch = (match: DocumentTextMatch) => {
    const container = containerRef.current;
    const rect = match.range.getBoundingClientRect();
    if (container) {
      const box = container.getBoundingClientRect();
      container.scrollTo({ top: Math.max(0, container.scrollTop + (rect.top - box.top) - box.height / 2), behavior: 'smooth' });
    } else {
      match.root.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  // paint every match, with the current one stronger. highlights sit beside the text, so the
  // document itself is never changed by searching.
  useEffect(() => {
    const api = CSS as unknown as { highlights?: Map<string, unknown> };
    const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    const clear = () => { api.highlights?.delete('find-match'); api.highlights?.delete('find-current'); };
    if (!api.highlights || !HighlightCtor || !isFindReplaceOpen || !findQuery) {
      clear();
      return clear;
    }
    const matches = findDocumentMatches(findQuery);
    api.highlights.set('find-match', new HighlightCtor(...matches.map(m => m.range)));
    if (findMatchIndex >= 0 && matches[findMatchIndex]) {
      api.highlights.set('find-current', new HighlightCtor(matches[findMatchIndex].range));
    } else {
      api.highlights.delete('find-current');
    }
    return clear;
  }, [isFindReplaceOpen, findQuery, findMatchIndex, project.chapters]);

  const navigateFind = (direction: 1 | -1) => {
    const matches = findDocumentMatches(findQuery);
    setFindMatchCount(matches.length);
    if (matches.length === 0) {
      setFindMatchIndex(-1);
      return;
    }
    const nextIndex = findMatchIndex < 0
      ? (direction === 1 ? 0 : matches.length - 1)
      : (findMatchIndex + direction + matches.length) % matches.length;
    setFindMatchIndex(nextIndex);
    selectFindMatch(matches[nextIndex]);
  };

  const replaceCurrentMatch = () => {
    const matches = findDocumentMatches(findQuery);
    const match = matches[findMatchIndex < 0 ? 0 : findMatchIndex];
    if (!match) return;

    if (newEditor) {
      replaceRange(match.range, replaceText);
    } else {
      match.range.deleteContents();
      match.range.insertNode(document.createTextNode(replaceText));
      match.root.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const remainingMatches = findDocumentMatches(findQuery);
    setFindMatchCount(remainingMatches.length);
    const nextIndex = remainingMatches.length ? Math.min(findMatchIndex < 0 ? 0 : findMatchIndex, remainingMatches.length - 1) : -1;
    setFindMatchIndex(nextIndex);
    if (nextIndex >= 0) selectFindMatch(remainingMatches[nextIndex]);
  };

  const replaceAllMatches = () => {
    const matches = findDocumentMatches(findQuery);
    if (matches.length === 0) return;
    matches.sort((a, b) => {
      if (a.root === b.root) return b.startOffset - a.startOffset;
      return a.root.compareDocumentPosition(b.root) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1;
    });

    if (newEditor) {
      replaceRanges(matches.map(m => m.range), replaceText);
    } else {
      const changedRoots = new Set<HTMLElement>();
      matches.forEach(match => {
        match.range.deleteContents();
        match.range.insertNode(document.createTextNode(replaceText));
        changedRoots.add(match.root);
      });
      changedRoots.forEach(root => root.dispatchEvent(new Event('input', { bubbles: true })));
    }
    setFindMatchCount(findDocumentMatches(findQuery).length);
    setFindMatchIndex(-1);
  };

  // safe auto-scroll function: scrolls down to reveal text near bottom, and never scrolls up on enter or typing
  const ensureCursorVisible = useCallback((container: HTMLElement, typewriterMode: boolean) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    try {
      const range = sel.getRangeAt(0);
      let rect = range.getBoundingClientRect();

      // if empty node or newline, fallback to parent block element
      if ((rect.top === 0 && rect.bottom === 0) || rect.height === 0) {
        if (sel.focusNode) {
          const el = sel.focusNode.nodeType === Node.ELEMENT_NODE
            ? (sel.focusNode as HTMLElement)
            : sel.focusNode.parentElement;
          if (el) {
            rect = el.getBoundingClientRect();
          }
        }
      }

      // if still zero, do not scroll at all to prevent jumping
      if (rect.top === 0 && rect.bottom === 0) return;

      const containerRect = container.getBoundingClientRect();
      const bottomThreshold = containerRect.bottom - 170; // clearance above floating toolbar

      // 1. auto scroll down while writing near bottom edge
      if (rect.bottom > bottomThreshold) {
        const scrollNeeded = rect.bottom - bottomThreshold + 36;
        container.scrollBy({ top: scrollNeeded, behavior: 'smooth' });
        return;
      }

      // 2. typewriter mode: gently keep line centered, but never scroll UP during input
      if (typewriterMode) {
        const targetY = containerRect.top + containerRect.height / 2;
        const delta = rect.top - targetY;
        if (delta > 35) {
          container.scrollBy({ top: delta * 0.45, behavior: 'smooth' });
        }
      }
    } catch {
      // ignore geometry query errors
    }
  }, []);

  // dismiss comment/suggestion popups when clicking outside or pressing escape
  useEffect(() => {
    if (isFindReplaceOpen) findInputRef.current?.focus();
  }, [isFindReplaceOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'h')) {
        e.preventDefault();
        setIsFindReplaceOpen(true);
      }
      if (e.key === 'Escape') {
        setIsFindReplaceOpen(false);
        setIsCommentInputOpen(false);
        setIsSuggestionInputOpen(false);
        setActiveInlineSuggestion(null);
        setIsFormatColorOpen(false);
        setIsFormatHighlightOpen(false);
        setSelectedText('');
        setSelectionCoords(null);
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
        setIsFormatColorOpen(false);
        setIsFormatHighlightOpen(false);
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          setSelectedText('');
          setSelectionCoords(null);
        }
      }

      if (!target.closest('.asterism-suggestion-card') && !target.closest('ins.asterism-suggestion-ins, del.asterism-suggestion-del')) {
        setActiveInlineSuggestion(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, []);

  // sync editor content in single chapter mode
  useEffect(() => {
    if (editorScrollMode === 'single' && editorRef.current && activeChapter) {
      if (document.activeElement !== editorRef.current && editorRef.current.innerHTML !== activeChapter.content) {
        editorRef.current.innerHTML = activeChapter.content;
      }
      lastSingleWordCountRef.current = activeChapter.wordCount || 0;
    }
  }, [activeChapter?.id, activeChapter?.content, editorScrollMode]);

  // jump to a passage a finding pointed at: open its chapter, find the text (even if
  // it was cut short or edited a little), scroll it into view and flash it.
  useEffect(() => {
    if (!jumpTarget) return;
    const candidates = quoteCandidates(jumpTarget.quote);
    let tries = 0;

    const attempt = (): boolean => {
      for (const candidate of candidates) {
        const match = findDocumentMatches(candidate, jumpTarget.chapterId)[0];
        if (!match) continue;
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(match.range);

        const container = containerRef.current;
        const rect = match.range.getBoundingClientRect();
        if (container) {
          const box = container.getBoundingClientRect();
          container.scrollTo({ top: Math.max(0, container.scrollTop + (rect.top - box.top) - box.height / 2), behavior: 'smooth' });
        } else {
          match.root.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }

        // where supported, a highlight that fades on its own without touching the text.
        const api = CSS as unknown as { highlights?: Map<string, unknown> };
        const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
        if (api.highlights && HighlightCtor) {
          api.highlights.set('asterism-jump', new HighlightCtor(match.range));
          window.setTimeout(() => api.highlights?.delete('asterism-jump'), 2600);
        }
        return true;
      }
      return false;
    };

    // the chapter may still be opening, so look a few times before giving up.
    const timer = window.setInterval(() => {
      tries += 1;
      if (attempt()) {
        window.clearInterval(timer);
      } else if (tries >= 12) {
        window.clearInterval(timer);
        showToast('Couldn’t find that passage. It may have been edited since.', 'info');
      }
    }, 90);
    return () => window.clearInterval(timer);
    // only a new jump request should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTarget]);

  // synchronize active comment highlight across marks and jump to active comment
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
        let targetEl = document.querySelector(`[data-comment-id="${activeCommentId}"]`) as HTMLElement;

        // the new editor: the passage is found by its words and marked
        if (!targetEl && newEditor) {
          const comment = project.comments.find(c => c.id === activeCommentId);
          const live = getActiveEditor();
          if (comment?.passageText?.trim() && comment.chapterId === activeChapterId && live && commentOnText(live, comment.passageText, activeCommentId!)) {
            targetEl = document.querySelector(`[data-comment-id="${activeCommentId}"]`) as HTMLElement;
          }
        }

        // dynamic fallback: if target element is not in DOM yet, find the comment and wrap passageText
        if (!targetEl && editorRef.current) {
          const comment = project.comments.find(c => c.id === activeCommentId);
          if (comment && comment.passageText && comment.passageText.trim() && comment.chapterId === activeChapterId) {
            const cleanText = comment.passageText.trim();
            const escaped = cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped);
            if (regex.test(editorRef.current.innerHTML)) {
              editorRef.current.innerHTML = editorRef.current.innerHTML.replace(
                regex,
                `<mark class="asterism-comment-highlight active-comment" data-comment-id="${activeCommentId}">${cleanText}</mark>`
              );
              updateChapterContent(activeChapterId, editorRef.current.innerHTML);
              targetEl = document.querySelector(`[data-comment-id="${activeCommentId}"]`) as HTMLElement;
            }
          }
        }

        if (targetEl && containerRef.current) {
          const container = containerRef.current;
          const containerRect = container.getBoundingClientRect();
          const elRect = targetEl.getBoundingClientRect();
          const scrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height / 2);
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          });

          if (!newEditor) targetEl.classList.add('active-comment');
        }
      }, 50);
      return () => clearTimeout(scrollTimer);
    }
  }, [activeCommentId, activeChapter?.id, activeChapter?.content, activeChapterId, project.comments, updateChapterContent, newEditor]);

  // suggesting mode in the new editor: typing and deleting become suggestions, kept in step with the comments list
  useEffect(() => {
    suggesting.on = newEditor && editorReviewMode === 'suggesting';
    suggesting.add = (deleted, label, replacement, id) => { addComment(deleted, label, 'suggestion', replacement, id); };
    suggesting.update = (id, text) => updateSuggestionText(id, text);
    suggesting.remove = id => deleteComment(id);
    return () => { suggesting.on = false; };
  }, [newEditor, editorReviewMode, addComment, updateSuggestionText, deleteComment]);

  // words that came from someone else in a live session are not words written here: move the starting point with them
  const absorbRemote = useCallback((chapterId: string, html: string) => {
    const now = countWordsFromHtml(html);
    const before = project.chapters.find(c => c.id === chapterId)?.wordCount ?? 0;
    setSessionBaseline(b => ({ ...b, [chapterId]: (b[chapterId] ?? before) + (now - before) }));
  }, [project.chapters]);

  // handle single mode typing
  // `fromEditor` is the text when the new editor reports a change; the old one is read off the page
  const handleSingleInput = useCallback((fromEditor?: string, remote = false) => {
    if (!activeChapter || (fromEditor === undefined && !editorRef.current)) return;
    const html = fromEditor ?? editorRef.current!.innerHTML;
    if (remote) absorbRemote(activeChapter.id, html);
    updateChapterContent(activeChapter.id, html);
    setFindMatchCount(findDocumentMatches(findQuery).length);

    const currentWords = activeChapter.wordCount || 0;

    // continuous quill points reward: 1 point for every 12 words written normally! words that arrive from someone else do not count
    if (!remote && lastSingleWordCountRef.current !== null) {
      const added = currentWords - lastSingleWordCountRef.current;
      if (added > 0) {
        wordsSinceLastPointRef.current += added;
        if (wordsSinceLastPointRef.current >= 12) {
          const pts = Math.floor(wordsSinceLastPointRef.current / 12);
          wordsSinceLastPointRef.current = wordsSinceLastPointRef.current % 12;
          awardPoints(pts, `${pts} Quill Point${pts > 1 ? 's' : ''} (Writing flow)`, true);
        }
      }
    }
    lastSingleWordCountRef.current = currentWords;

    if (containerRef.current) {
      ensureCursorVisible(containerRef.current, userStats.typewriterMode);
    }
  }, [activeChapter, updateChapterContent, awardPoints, userStats.typewriterMode, ensureCursorVisible, findQuery]);

  // handle continuous mode typing
  const handleContinuousContentChange = useCallback((chapterId: string, html: string, remote = false) => {
    if (remote) absorbRemote(chapterId, html);
    updateChapterContent(chapterId, html);
    setFindMatchCount(findDocumentMatches(findQuery).length);
    if (remote) return;

    // track words for quill points in continuous mode
    const text = html.replace(/<[^>]+>/g, ' ');
    const words = (text.trim().match(/\S+/g) || []).length;
    if (lastContinuousWordCountRef.current !== null) {
      const added = words - lastContinuousWordCountRef.current;
      if (added > 0) {
        wordsSinceLastPointRef.current += added;
        if (wordsSinceLastPointRef.current >= 12) {
          const pts = Math.floor(wordsSinceLastPointRef.current / 12);
          wordsSinceLastPointRef.current = wordsSinceLastPointRef.current % 12;
          awardPoints(pts, `${pts} Quill Point${pts > 1 ? 's' : ''} (Writing flow)`, true);
        }
      }
    }
    lastContinuousWordCountRef.current = words;

    if (containerRef.current) {
      ensureCursorVisible(containerRef.current, userStats.typewriterMode);
    }
  }, [updateChapterContent, awardPoints, userStats.typewriterMode, ensureCursorVisible, findQuery]);

  // execute standard formatting commands
  const execCmd = (command: string, value: string | undefined = undefined) => {
    const live = newEditor ? getActiveEditor() : null;
    if (live) runEditorCommand(live, command, value);
    else document.execCommand(command, false, value);
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
          x: Math.min(window.innerWidth - 220, Math.max(100, rect.left + rect.width / 2)),
          y: Math.max(10, rect.top - 46)
        });

        // trigger review mode behavior
        if (editorReviewMode === 'commenting') {
          setIsCommentInputOpen(true);
          setIsSuggestionInputOpen(false);
        } else if (editorReviewMode === 'suggesting') {
          // in Google Docs suggesting mode, selecting text allows typing or backspacing directly in place.
          // do not pop open an input modal that steals keyboard focus!
          setIsSuggestionInputOpen(false);
          setIsCommentInputOpen(false);
        }
      } catch {
        // ignore selection rect errors
      }
    }
  };

  // click on commented mark or suggestion tag listener
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // check for suggestion <ins> or <del>
    const sugEl = target.closest('ins.asterism-suggestion-ins, del.asterism-suggestion-del');
    if (sugEl) {
      const sugId = sugEl.getAttribute('data-suggestion-id') || sugEl.getAttribute('data-comment-id');
      if (sugId) {
        const rect = sugEl.getBoundingClientRect();
        const isIns = sugEl.tagName.toLowerCase() === 'ins';
        const relatedDel = document.querySelector(`del[data-suggestion-id="${sugId}"], del[data-comment-id="${sugId}"]`);
        const relatedIns = document.querySelector(`ins[data-suggestion-id="${sugId}"], ins[data-comment-id="${sugId}"]`);

        let sugType: 'add' | 'delete' | 'replace' = isIns ? 'add' : 'delete';
        if (relatedDel && relatedIns) sugType = 'replace';

        setActiveInlineSuggestion({
          id: sugId,
          x: Math.min(window.innerWidth - 240, Math.max(120, rect.left + rect.width / 2)),
          y: Math.max(20, rect.top - 62),
          insText: relatedIns?.textContent || (isIns ? sugEl.textContent : '') || '',
          delText: relatedDel?.textContent || (!isIns ? sugEl.textContent : '') || '',
          type: sugType
        });
        setActiveCommentId(sugId);
        return;
      }
    }

    // check for standard commented mark
    const commentTarget = target.closest('[data-comment-id]');
    if (commentTarget) {
      const commentId = commentTarget.getAttribute('data-comment-id');
      if (commentId) {
        setActiveCommentId(commentId);
        setIsSideCommentsOpen(true);
      }
    }
  };

  const handleAcceptSuggestion = (id: string, targetChapterId?: string) => {
    const chapId = targetChapterId || activeChapter?.id;
    const comment = project.comments.find(c => c.id === id);
    const suggestedText = comment?.suggestedText || '';

    if (newEditor) {
      resolveSuggestion(id, true, suggestedText);
      acceptSuggestion(id);
      setActiveInlineSuggestion(null);
      return;
    }
    // unwrap ins into plain text, remove del completely
    const dels = document.querySelectorAll(`del[data-suggestion-id="${id}"], del[data-comment-id="${id}"]`);
    const inss = document.querySelectorAll(`ins[data-suggestion-id="${id}"], ins[data-comment-id="${id}"]`);

    if (inss.length > 0) {
      dels.forEach(d => d.remove());
      inss.forEach(ins => {
        const parent = ins.parentNode;
        while (ins.firstChild) parent?.insertBefore(ins.firstChild, ins);
        ins.remove();
      });
    } else if (dels.length > 0) {
      if (suggestedText) {
        dels.forEach((del, idx) => {
          if (idx === 0) {
            const textNode = document.createTextNode(suggestedText);
            del.parentNode?.insertBefore(textNode, del);
          }
          del.remove();
        });
      } else {
        dels.forEach(d => d.remove());
      }
    }

    acceptSuggestion(id);
    setActiveInlineSuggestion(null);

    if (chapId && editorRef.current) {
      updateChapterContent(chapId, editorRef.current.innerHTML);
    }
  };

  const handleRejectSuggestion = (id: string, targetChapterId?: string) => {
    const chapId = targetChapterId || activeChapter?.id;
    if (newEditor) {
      resolveSuggestion(id, false);
      rejectSuggestion(id);
      setActiveInlineSuggestion(null);
      return;
    }
    // remove ins completely, unwrap del back to normal text
    const inss = document.querySelectorAll(`ins[data-suggestion-id="${id}"], ins[data-comment-id="${id}"]`);
    inss.forEach(ins => ins.remove());

    const dels = document.querySelectorAll(`del[data-suggestion-id="${id}"], del[data-comment-id="${id}"]`);
    dels.forEach(del => {
      const parent = del.parentNode;
      while (del.firstChild) parent?.insertBefore(del.firstChild, del);
      del.remove();
    });

    rejectSuggestion(id);
    setActiveInlineSuggestion(null);

    if (chapId && editorRef.current) {
      updateChapterContent(chapId, editorRef.current.innerHTML);
    }
  };

  // Google Docs-style live suggesting mode typing listener
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, targetChapterId?: string) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Escape', 'Tab'].includes(e.key)) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    const chapId = targetChapterId || activeChapter?.id;
    if (!chapId) return;

    // 1. backspace or delete
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (!sel.isCollapsed) {
        e.preventDefault();
        const textToDelete = sel.toString();
        if (!textToDelete) return;

        const sugId = `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const delEl = document.createElement('del');
        delEl.className = 'asterism-suggestion-del';
        delEl.setAttribute('data-suggestion-id', sugId);
        delEl.setAttribute('title', 'Suggested deletion (Click to accept or reject)');

        try {
          const contents = range.extractContents();
          delEl.appendChild(contents);
          range.insertNode(delEl);
        } catch {
          delEl.textContent = textToDelete;
          range.deleteContents();
          range.insertNode(delEl);
        }

        const newRange = document.createRange();
        newRange.setStartAfter(delEl);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        addComment(textToDelete, `Delete: "${textToDelete}"`, 'suggestion', '', sugId);
        const activeContainer = (e.currentTarget as HTMLElement);
        if (activeContainer) {
          updateChapterContent(chapId, activeContainer.innerHTML);
        }
        return;
      } else {
        // caret is collapsed:
        const parentIns = (sel.anchorNode?.parentElement as HTMLElement)?.closest('ins.asterism-suggestion-ins');
        if (parentIns) {
          // inside <ins>, let backspace delete normally inside the suggestion
          const container = e.currentTarget as HTMLElement;
          const sugId = parentIns.getAttribute('data-suggestion-id');
          setTimeout(() => {
            if (sugId) {
              const currentText = parentIns.textContent || '';
              if (currentText.length === 0) {
                parentIns.remove();
                deleteComment(sugId);
              } else {
                updateSuggestionText(sugId, currentText);
              }
            }
            if (container) updateChapterContent(chapId, container.innerHTML);
          }, 10);
          return;
        }

        // caret in regular text -> convert single character before/after to <del> without rogue spaces
        e.preventDefault();
        const container = e.currentTarget as HTMLElement;
        const isBackspace = e.key === 'Backspace';

        if (isBackspace) {
          // target character immediately before caret
          let targetTextNode: Text | null = null;
          let charOffset = -1;
          let adjacentDel: HTMLElement | null = null;

          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer as Text;
            if (range.startOffset > 0) {
              targetTextNode = textNode;
              charOffset = range.startOffset - 1;
              const nextSib = textNode.nextSibling as HTMLElement;
              if (range.startOffset === textNode.length && nextSib?.matches?.('del.asterism-suggestion-del')) {
                adjacentDel = nextSib;
              }
            } else {
              // startOffset === 0, check previous sibling
              const prevSib = textNode.previousSibling as HTMLElement;
              if (prevSib?.matches?.('del.asterism-suggestion-del')) {
                adjacentDel = prevSib;
                const prevText = adjacentDel.previousSibling;
                if (prevText?.nodeType === Node.TEXT_NODE) {
                  targetTextNode = prevText as Text;
                  charOffset = targetTextNode.length - 1;
                }
              }
            }
          } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
            const el = range.startContainer as HTMLElement;
            const prevChild = el.childNodes[range.startOffset - 1];
            if (prevChild?.nodeType === Node.TEXT_NODE) {
              targetTextNode = prevChild as Text;
              charOffset = targetTextNode.length - 1;
            } else if (prevChild && (prevChild as HTMLElement)?.matches?.('del.asterism-suggestion-del')) {
              adjacentDel = prevChild as HTMLElement;
              const beforeDel = adjacentDel.previousSibling;
              if (beforeDel?.nodeType === Node.TEXT_NODE) {
                targetTextNode = beforeDel as Text;
                charOffset = targetTextNode.length - 1;
              }
            }
          }

          if (targetTextNode && charOffset >= 0 && charOffset < targetTextNode.length) {
            const charToDelete = targetTextNode.textContent?.[charOffset] || '';
            if (charToDelete) {
              if (adjacentDel) {
                const sugId = adjacentDel.getAttribute('data-suggestion-id');
                adjacentDel.textContent = charToDelete + (adjacentDel.textContent || '');
                targetTextNode.deleteData(charOffset, 1);
                if (sugId) updateSuggestionText(sugId, adjacentDel.textContent);
              } else {
                const sugId = `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                const delEl = document.createElement('del');
                delEl.className = 'asterism-suggestion-del';
                delEl.setAttribute('data-suggestion-id', sugId);
                delEl.setAttribute('title', 'Suggested deletion');
                delEl.textContent = charToDelete;

                targetTextNode.deleteData(charOffset, 1);
                const afterNode = targetTextNode.splitText(charOffset);
                afterNode.parentNode?.insertBefore(delEl, afterNode);
                addComment(charToDelete, `Delete: "${charToDelete}"`, 'suggestion', '', sugId);
              }

              const newRange = document.createRange();
              newRange.setStart(targetTextNode, charOffset);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              updateChapterContent(chapId, container.innerHTML);
              return;
            }
          }
        } else {
          // delete key (forward)
          let targetTextNode: Text | null = null;
          let charOffset = -1;
          let adjacentDel: HTMLElement | null = null;

          if (range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer as Text;
            if (range.startOffset < textNode.length) {
              targetTextNode = textNode;
              charOffset = range.startOffset;
              const prevSib = textNode.previousSibling as HTMLElement;
              if (range.startOffset === 0 && prevSib?.matches?.('del.asterism-suggestion-del')) {
                adjacentDel = prevSib;
              }
            }
          }

          if (targetTextNode && charOffset >= 0 && charOffset < targetTextNode.length) {
            const charToDelete = targetTextNode.textContent?.[charOffset] || '';
            if (charToDelete) {
              if (adjacentDel) {
                const sugId = adjacentDel.getAttribute('data-suggestion-id');
                adjacentDel.textContent = (adjacentDel.textContent || '') + charToDelete;
                targetTextNode.deleteData(charOffset, 1);
                if (sugId) updateSuggestionText(sugId, adjacentDel.textContent);
              } else {
                const sugId = `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
                const delEl = document.createElement('del');
                delEl.className = 'asterism-suggestion-del';
                delEl.setAttribute('data-suggestion-id', sugId);
                delEl.setAttribute('title', 'Suggested deletion');
                delEl.textContent = charToDelete;

                targetTextNode.deleteData(charOffset, 1);
                const afterNode = targetTextNode.splitText(charOffset);
                afterNode.parentNode?.insertBefore(delEl, afterNode);
                addComment(charToDelete, `Delete: "${charToDelete}"`, 'suggestion', '', sugId);
              }

              const newRange = document.createRange();
              newRange.setStart(targetTextNode, charOffset);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              updateChapterContent(chapId, container.innerHTML);
              return;
            }
          }
        }
        return;
      }
    }

    // 2. regular character or enter
    if (e.key.length === 1 || e.key === 'Enter') {
      const charToInsert = e.key === 'Enter' ? '\n' : e.key;

      if (!sel.isCollapsed) {
        // replacing selection with new character!
        e.preventDefault();
        const textToReplace = sel.toString();
        const sugId = `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const delEl = document.createElement('del');
        delEl.className = 'asterism-suggestion-del';
        delEl.setAttribute('data-suggestion-id', sugId);
        delEl.setAttribute('title', 'Suggested deletion');
        delEl.textContent = textToReplace;

        const insEl = document.createElement('ins');
        insEl.className = 'asterism-suggestion-ins';
        insEl.setAttribute('data-suggestion-id', sugId);
        insEl.setAttribute('title', 'Suggested addition (Click to accept/reject)');
        insEl.textContent = charToInsert;

        range.deleteContents();
        range.insertNode(delEl);
        delEl.after(insEl);

        range.selectNodeContents(insEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        addComment(textToReplace, `Replace "${textToReplace}" with "${charToInsert}"`, 'suggestion', charToInsert, sugId);
        const activeContainer = (e.currentTarget as HTMLElement);
        if (activeContainer) {
          updateChapterContent(chapId, activeContainer.innerHTML);
        }
        return;
      }

      // caret is collapsed:
      const parentIns = (sel.anchorNode?.parentElement as HTMLElement)?.closest('ins.asterism-suggestion-ins');
      if (parentIns) {
        // already typing inside an <ins>
        const container = e.currentTarget as HTMLElement;
        const sugId = parentIns.getAttribute('data-suggestion-id');
        setTimeout(() => {
          if (sugId) {
            const fullText = parentIns.textContent || '';
            updateSuggestionText(sugId, fullText);
          }
          if (container) updateChapterContent(chapId, container.innerHTML);
        }, 10);
        return;
      }

      // caret is in normal text -> create new <ins>
      e.preventDefault();
      const sugId = `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const insEl = document.createElement('ins');
      insEl.className = 'asterism-suggestion-ins';
      insEl.setAttribute('data-suggestion-id', sugId);
      insEl.setAttribute('title', 'Suggested addition (Click to accept/reject)');
      insEl.textContent = charToInsert;

      range.insertNode(insEl);

      range.selectNodeContents(insEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      addComment('', `Add: "${charToInsert}"`, 'suggestion', charToInsert, sugId);
      const activeContainer = (e.currentTarget as HTMLElement);
      if (activeContainer) {
        updateChapterContent(chapId, activeContainer.innerHTML);
      }
    }
  };

  const applyBubbleTextColor = (color: string) => {
    setFormatTextColor(color);
    const live = newEditor ? getActiveEditor() : null;
    if (live) {
      setEditorTextColor(live, color === 'inherit' ? null : color);
    } else if (color === 'inherit') {
      execCmd('removeFormat');
    } else {
      execCmd('foreColor', color);
    }
    setIsFormatColorOpen(false);
  };

  const applyBubbleHighlightColor = (color: string) => {
    setFormatHighlightColor(color);
    const live = newEditor ? getActiveEditor() : null;
    if (live) {
      setEditorHighlight(live, color === 'transparent' ? null : color);
    } else if (color === 'transparent') {
      execCmd('hiliteColor', 'transparent');
      execCmd('backColor', 'transparent');
    } else {
      execCmd('hiliteColor', color);
      execCmd('backColor', color);
    }
    setIsFormatHighlightOpen(false);
  };

  const handleSaveInlineComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInputText.trim() || !selectedText) return;

    const commentId = addComment(selectedText, commentInputText.trim(), 'comment');

    // wrap current selection using saved range
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

        if (editorScrollMode === 'single' && editorRef.current && activeChapter) {
          updateChapterContent(activeChapter.id, editorRef.current.innerHTML);
        }
      } catch (err) {
        console.warn('Range wrap fallback', err);
      }
    }

    if (!wrapped && !newEditor && editorRef.current && activeChapter) {
      const cleanText = selectedText.trim();
      const escaped = cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped);
      if (regex.test(editorRef.current.innerHTML)) {
        editorRef.current.innerHTML = editorRef.current.innerHTML.replace(
          regex,
          `<mark class="asterism-comment-highlight active-comment" data-comment-id="${commentId}">${cleanText}</mark>`
        );
        updateChapterContent(activeChapter.id, editorRef.current.innerHTML);
      }
    }

    savedSelectionRangeRef.current = null;
    setCommentInputText('');
    setIsCommentInputOpen(false);
    setSelectedText('');
    setSelectionCoords(null);
  };

  const handleSaveSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionReplacementText.trim() || !selectedText) return;

    const commentId = addComment(
      selectedText, 
      `Replace "${selectedText}" with "${suggestionReplacementText.trim()}"`, 
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

        if (editorScrollMode === 'single' && editorRef.current && activeChapter) {
          updateChapterContent(activeChapter.id, editorRef.current.innerHTML);
        }
      } catch (err) {
        console.warn('Suggestion range replace fallback', err);
      }
    }

    if (!replaced && !newEditor && editorRef.current && activeChapter) {
      const cleanText = selectedText.trim();
      const escaped = cleanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped);
      if (regex.test(editorRef.current.innerHTML)) {
        editorRef.current.innerHTML = editorRef.current.innerHTML.replace(
          regex,
          `<del class="asterism-suggestion-del" data-suggestion-id="${commentId}">${cleanText}</del><ins class="asterism-suggestion-ins" data-suggestion-id="${commentId}">${suggestionReplacementText.trim()}</ins>`
        );
        updateChapterContent(activeChapter.id, editorRef.current.innerHTML);
      }
    }

    savedSelectionRangeRef.current = null;
    setSuggestionReplacementText('');
    setIsSuggestionInputOpen(false);
    setSelectedText('');
    setSelectionCoords(null);
  };

  // split chapter at the currently highlighted selection
  const handleSplitAtSelection = () => {
    if (!activeChapter || !selectedText) return;
    const content = activeChapter.content || '';
    const selIndex = content.indexOf(selectedText);
    if (selIndex !== -1) {
      const before = content.slice(0, selIndex) + '</p>';
      const after = '<p>' + content.slice(selIndex);
      splitChapter(activeChapter.id, before, after, `Chapter ${activeChapter.order + 1}: Split Scene`);
    } else {
      // split roughly at midpoint
      const mid = Math.floor(content.length / 2);
      splitChapter(activeChapter.id, content.slice(0, mid), content.slice(mid));
    }
    setSelectedText('');
    setSelectionCoords(null);
  };

  // writing timer interval
  useEffect(() => {
    let interval: number | undefined;
    if (isTimerRunning) {
      interval = window.setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // track active chapter while scrolling in infinite scroll mode
  useEffect(() => {
    if (editorScrollMode !== 'infinite' || !containerRef.current) return;

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerMid = container.scrollTop + container.clientHeight / 3;
      for (const chap of project.chapters) {
        const el = document.getElementById(`chapter-section-${chap.id}`);
        if (el) {
          const top = el.offsetTop;
          const bottom = top + el.offsetHeight;
          if (containerMid >= top && containerMid <= bottom) {
            if (chap.id !== activeChapterId) {
              setActiveChapterId(chap.id);
            }
            break;
          }
        }
      }
    };

    const c = containerRef.current;
    c.addEventListener('scroll', handleScroll, { passive: true });
    return () => c.removeEventListener('scroll', handleScroll);
  }, [editorScrollMode, project.chapters, activeChapterId, setActiveChapterId]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalManuscriptWords = useMemo(() => {
    return project.chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
  }, [project.chapters]);

  return (
    <div
      ref={containerRef}
      className="writing-scroll"
      onMouseUp={handleSelection}
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'var(--bg-app)',
        padding: '36px 20px 160px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      {/* active writing sprint bar */}
      <ActiveSprintBar />

      {/* floating selection Markdown formatting & annotation bubble */}
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
            gap: '6px'
          }}
        >
          {/* quick Markdown formatting controls */}
          <button
            onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}
            title="Bold (**text**)"
            style={{
              padding: '4px 7px',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            B
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); execCmd('italic'); }}
            title="Italic (*text*)"
            style={{
              padding: '4px 7px',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontStyle: 'italic',
              cursor: 'pointer'
            }}
          >
            I
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); execCmd('strikeThrough'); }}
            title="Strikethrough (~~text~~)"
            style={{
              padding: '4px 7px',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              textDecoration: 'line-through',
              cursor: 'pointer'
            }}
          >
            S
          </button>

          {/* quick text color in bubble */}
          <div style={{ position: 'relative' }}>
            <button
              onMouseDown={e => {
                e.preventDefault();
                setIsFormatColorOpen(!isFormatColorOpen);
                setIsFormatHighlightOpen(false);
              }}
              title="Text Color"
              style={{
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
                background: isFormatColorOpen ? 'var(--accent-gold-bg)' : 'none',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span style={{ fontWeight: 800, fontFamily: 'serif', lineHeight: 1 }}>A</span>
              <div style={{ width: '12px', height: '2px', backgroundColor: formatTextColor === 'inherit' ? 'var(--text-main)' : formatTextColor, borderRadius: '1px' }} />
            </button>

            {isFormatColorOpen && (
              <div
                className="glass-panel asterism-color-popover animate-fade-in"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '6px',
                  zIndex: 2000,
                  backgroundColor: 'var(--bg-paper)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  width: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                  {[
                    { color: 'inherit', display: 'var(--text-main)' },
                    { color: '#dc2626', display: '#dc2626' },
                    { color: '#ea580c', display: '#ea580c' },
                    { color: '#d97706', display: '#d97706' },
                    { color: '#c9933b', display: '#c9933b' },
                    { color: '#16a34a', display: '#16a34a' },
                    { color: '#0d9488', display: '#0d9488' },
                    { color: '#2563eb', display: '#2563eb' },
                    { color: '#4f46e5', display: '#4f46e5' },
                    { color: '#9333ea', display: '#9333ea' }
                  ].map(item => (
                    <button
                      key={item.color}
                      onMouseDown={e => {
                        e.preventDefault();
                        applyBubbleTextColor(item.color);
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: item.display,
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* quick highlighter in bubble */}
          <div style={{ position: 'relative' }}>
            <button
              onMouseDown={e => {
                e.preventDefault();
                setIsFormatHighlightOpen(!isFormatHighlightOpen);
                setIsFormatColorOpen(false);
              }}
              title="Text Highlight"
              style={{
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
                background: isFormatHighlightOpen ? 'var(--accent-gold-bg)' : 'none',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <Highlighter size={13} />
              <div style={{ width: '12px', height: '2px', backgroundColor: formatHighlightColor === 'transparent' ? 'transparent' : formatHighlightColor, border: formatHighlightColor === 'transparent' ? '1px dashed var(--text-muted)' : 'none', borderRadius: '1px' }} />
            </button>

            {isFormatHighlightOpen && (
              <div
                className="glass-panel asterism-color-popover animate-fade-in"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '6px',
                  zIndex: 2000,
                  backgroundColor: 'var(--bg-paper)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  width: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  {[
                    { color: '#fef08a' },
                    { color: '#bbf7d0' },
                    { color: '#bae6fd' },
                    { color: '#fbcfe8' },
                    { color: '#e9d5ff' },
                    { color: '#fed7aa' },
                    { color: '#fecaca' },
                    { color: 'transparent' }
                  ].map(item => (
                    <button
                      key={item.color}
                      onMouseDown={e => {
                        e.preventDefault();
                        applyBubbleHighlightColor(item.color);
                      }}
                      title={item.color === 'transparent' ? 'Remove Highlight' : 'Highlight'}
                      style={{
                        height: '22px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: item.color === 'transparent' ? 'var(--bg-app)' : item.color,
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {item.color === 'transparent' ? '✕' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', '<h2>'); }}
            title="Heading 2 (## Header)"
            style={{
              padding: '4px 7px',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            H2
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', '<blockquote>'); }}
            title="Blockquote (> Quote)"
            style={{
              padding: '4px 7px',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            " "
          </button>

          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>|</span>

          {/* add note button */}
          <button
            onClick={() => {
              setIsCommentInputOpen(true);
              setIsSuggestionInputOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--accent-gold-text, var(--accent-gold))',
              background: 'none',
              border: 'none',
              padding: '3px 6px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}
          >
            <MessageSquare size={13} />
            <span>Note</span>
          </button>

          {/* suggest revision button */}
          <button
            onClick={() => {
              setIsSuggestionInputOpen(true);
              setIsCommentInputOpen(false);
              setSuggestionReplacementText(selectedText);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--accent-emerald)',
              background: 'none',
              border: 'none',
              padding: '3px 6px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}
          >
            <Lightbulb size={13} />
            <span>Suggest</span>
          </button>

          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>|</span>

          {/* split chapter button */}
          <button
            onClick={handleSplitAtSelection}
            title="Split chapter at this selected sentence into a new chapter"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.78rem',
              fontWeight: 500,
              color: 'var(--text-main)',
              background: 'none',
              border: 'none',
              padding: '3px 6px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}
          >
            <Scissors size={13} />
            <span>Split</span>
          </button>
        </div>
      )}

      {/* floating Google Docs style inline suggestion card */}
      {activeInlineSuggestion && (
        <div
          className="glass-panel animate-fade-in asterism-suggestion-card"
          style={{
            position: 'fixed',
            left: `${activeInlineSuggestion.x}px`,
            top: `${activeInlineSuggestion.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 2500,
            backgroundColor: 'var(--bg-paper)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            border: '1.5px solid var(--accent-gold)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '280px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lightbulb size={11} />
              <span>
                {activeInlineSuggestion.type === 'replace' ? 'Replace Suggestion' : activeInlineSuggestion.type === 'add' ? 'Insertion Suggestion' : 'Deletion Suggestion'}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeInlineSuggestion.type === 'replace' && (
                <span>
                  <del style={{ color: 'var(--text-muted)' }}>"{activeInlineSuggestion.delText}"</del> → <ins style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>"{activeInlineSuggestion.insText}"</ins>
                </span>
              )}
              {activeInlineSuggestion.type === 'add' && (
                <ins style={{ color: '#10b981', textDecoration: 'none', fontWeight: 600 }}>
                  + Add: "{activeInlineSuggestion.insText}"
                </ins>
              )}
              {activeInlineSuggestion.type === 'delete' && (
                <del style={{ color: 'var(--text-muted)' }}>
                  - Delete: "{activeInlineSuggestion.delText}"
                </del>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => handleAcceptSuggestion(activeInlineSuggestion.id)}
              title="Accept Suggestion (Apply permanently to manuscript)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                boxShadow: 'var(--shadow-xs)'
              }}
            >
              <Check size={13} />
              <span>Accept</span>
            </button>

            <button
              onClick={() => handleRejectSuggestion(activeInlineSuggestion.id)}
              title="Reject Suggestion (Discard)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tag-bg)',
                color: 'var(--text-secondary)',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <X size={13} />
              <span>Reject</span>
            </button>
          </div>
        </div>
      )}

      {/* inline comment input box */}
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
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>Add Critique Note</span>
            <button onClick={() => { setIsCommentInputOpen(false); setSelectedText(''); }} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '6px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{selectedText}"
          </div>
          <form onSubmit={handleSaveInlineComment} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <textarea
              placeholder="Your thoughts, review feedback, or plot reminder..."
              value={commentInputText}
              onChange={e => setCommentInputText(e.target.value)}
              rows={2}
              autoFocus
              style={{ width: '100%', padding: '6px', fontSize: '0.82rem', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', resize: 'none' }}
            />
            <button
              type="submit"
              style={{
                padding: '4px 10px',
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

      {/* inline suggestion input box */}
      {isSuggestionInputOpen && selectionCoords && (
        <div
          className="glass-panel animate-fade-in asterism-floating-popup"
          style={{
            position: 'fixed',
            left: `${selectionCoords.x}px`,
            top: `${selectionCoords.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1600,
            width: '320px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-paper)',
            boxShadow: 'var(--shadow-paper)',
            border: '1px solid var(--accent-emerald)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lightbulb size={13} />
              <span>Propose Revision (Track Changes)</span>
            </span>
            <button onClick={() => { setIsSuggestionInputOpen(false); setSelectedText(''); }} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Replace: <del style={{ color: 'var(--accent-crimson)' }}>{selectedText}</del>
          </div>

          <form onSubmit={handleSaveSuggestion} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              placeholder="Type your revised wording..."
              value={suggestionReplacementText}
              onChange={e => setSuggestionReplacementText(e.target.value)}
              rows={2}
              autoFocus
              style={{ width: '100%', padding: '6px', fontSize: '0.82rem', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button
                type="button"
                onClick={() => { setIsSuggestionInputOpen(false); setSelectedText(''); }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-emerald)',
                  color: '#fff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                Suggest Revision
              </button>
            </div>
          </form>
        </div>
      )}

      {isFindReplaceOpen && (
        <div
          className="glass-panel asterism-floating-popup"
          style={{
            position: 'fixed',
            top: '72px',
            right: '24px',
            zIndex: 1800,
            width: 'min(420px, calc(100vw - 32px))',
            padding: '12px',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-paper)',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-main)', fontSize: '0.84rem' }}>
              <Search size={15} /> Find and Replace
            </strong>
            <button
              onClick={() => setIsFindReplaceOpen(false)}
              title="Close"
              aria-label="Close find and replace"
              style={{ display: 'flex', padding: '4px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              ref={findInputRef}
              value={findQuery}
              onChange={e => {
                const query = e.target.value;
                setFindQuery(query);
                // land on the first match as you type, like a browser's find.
                const matches = findDocumentMatches(query);
                setFindMatchCount(matches.length);
                setFindMatchIndex(matches.length ? 0 : -1);
                if (matches.length) selectFindMatch(matches[0]);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  navigateFind(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Find in document"
              aria-label="Find in document"
              style={{ flex: 1, minWidth: 0, padding: '7px 9px', color: 'var(--text-main)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}
            />
            <span aria-live="polite" style={{ minWidth: '48px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
              {findMatchCount ? `${findMatchIndex < 0 ? 0 : findMatchIndex + 1}/${findMatchCount}` : '0/0'}
            </span>
            <button onClick={() => navigateFind(-1)} title="Previous match" aria-label="Previous match" style={{ display: 'flex', padding: '6px', color: 'var(--text-main)', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <ChevronUp size={15} />
            </button>
            <button onClick={() => navigateFind(1)} title="Next match" aria-label="Next match" style={{ display: 'flex', padding: '6px', color: 'var(--text-main)', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <ChevronDown size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '7px' }}>
            <input
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  replaceCurrentMatch();
                }
              }}
              placeholder="Replace with"
              aria-label="Replace with"
              style={{ flex: 1, minWidth: 0, padding: '7px 9px', color: 'var(--text-main)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}
            />
            <button onClick={replaceCurrentMatch} title="Replace current match" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 9px', color: 'var(--text-main)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>
              <Replace size={14} /> Replace
            </button>
            <button onClick={replaceAllMatches} title="Replace all matches" style={{ padding: '6px 9px', color: 'var(--text-main)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer' }}>
              All
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* mode 1: infinite scrolling continuous manuscript mode */}
      {/* ============================================================== */}
      {editorScrollMode === 'infinite' ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* infinite scroll top banner */}
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 'var(--page-width, 840px)',
              padding: '14px 20px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-paper)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-gold-bg)',
                  color: 'var(--accent-gold-text, var(--accent-gold))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ScrollText size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Continuous Manuscript Scroll
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {project.draftMode === 'open_draft' ? `${sceneCount(project.chapters[0]?.content ?? '')} scenes` : `${project.chapters.length} chapter${project.chapters.length === 1 ? '' : 's'}`} • {totalManuscriptWords.toLocaleString()} total words • Scroll up or down freely
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* insert at top: prologue / chapter (allows going up from top) */}
              <button
                onClick={() => insertChapterAt(0, 'Prologue: Before the Beginning')}
                title="Insert Chapter / Prologue at the top"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--tag-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <ArrowUpToLine size={13} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                <span>+ Insert at Top</span>
              </button>

              <button
                onClick={() => setEditorScrollMode('single')}
                title="Switch to Focused Single Chapter view"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--tag-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <FileText size={13} />
                <span>Single Chapter Mode</span>
              </button>
            </div>
          </div>

          {/* render all chapters in continuous flow */}
          {project.chapters.map((chap, idx) => (
            <ContinuousChapterSheet
              scope={project.id}
              key={chap.id}
              chapter={chap}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === project.chapters.length - 1}
              isOpenDraft={project.draftMode === 'open_draft'}
              onInsertSceneBreak={() => insertSceneBreak(chap.id)}
              userStats={userStats}
              isActive={chap.id === activeChapterId}
              onContentChange={handleContinuousContentChange}
              onTitleChange={updateChapterTitle}
              onSplit={chapterId => {
                const target = project.chapters.find(c => c.id === chapterId);
                if (!target) return;
                const mid = Math.floor(target.content.length / 2);
                splitChapter(chapterId, target.content.slice(0, mid), target.content.slice(mid));
              }}
              onInsertBelow={index => insertChapterAt(index)}
              onMergePrev={mergeChapterWithPrevious}
              onSelectText={handleSelection}
              onEditorClick={handleEditorClick}
              onKeystroke={(key, e, chId) => {
                playKeystroke(key);
                if (e && editorReviewMode === 'suggesting') {
                  handleSuggestionKeyDown(e, chId);
                }
              }}
            />
          ))}

          {/* bottom add chapter button */}
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => insertChapterAt(project.chapters.length)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={16} />
              <span>+ Add Next Chapter at End of Manuscript</span>
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* mode 2: focused single chapter mode */
        /* ============================================================== */
        activeChapter && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* single chapter mode top banner */}
            <div
              className="glass-panel"
              style={{
                width: '100%',
                maxWidth: 'var(--page-width, 840px)',
                padding: '12px 20px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-paper)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--tag-bg)',
                    color: 'var(--accent-gold-text, var(--accent-gold))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileText size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {project.draftMode === 'open_draft' ? 'Open draft' : `Single Chapter Mode • ${activeChapter.title}`}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {project.draftMode === 'open_draft' ? `${sceneCount(activeChapter.content)} scene${sceneCount(activeChapter.content) === 1 ? '' : 's'}` : `Chapter ${activeChapter.order} of ${project.chapters.length}`} • {activeChapter.wordCount || 0} words
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeChapter.order > 1 && (
                  <button
                    onClick={() => {
                      const prev = project.chapters.find(c => c.order === activeChapter.order - 1);
                      if (prev) setActiveChapterId(prev.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--tag-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.76rem',
                      cursor: 'pointer'
                    }}
                    title="Previous Chapter"
                  >
                    ← Prev
                  </button>
                )}

                {activeChapter.order < project.chapters.length && (
                  <button
                    onClick={() => {
                      const next = project.chapters.find(c => c.order === activeChapter.order + 1);
                      if (next) setActiveChapterId(next.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--tag-bg)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.76rem',
                      cursor: 'pointer'
                    }}
                    title="Next Chapter"
                  >
                    Next →
                  </button>
                )}

                <button
                  onClick={() => setEditorScrollMode('infinite')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-gold-bg)',
                    border: '1px solid var(--accent-gold)',
                    color: 'var(--accent-gold-text, var(--accent-gold))',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Switch to continuous scroll to see all chapters together"
                >
                  <ScrollText size={14} />
                  <span>Show All Chapters (Continuous Scroll)</span>
                </button>
              </div>
            </div>

            {/* manuscript sheet */}
            <div 
              className="manuscript-page"
              onClick={handleEditorClick}
              style={{
                width: '100%',
                maxWidth: 'var(--page-width, 840px)',
                minHeight: '85vh',
                padding: 'min(var(--page-margin-y, 64px), 12vw) min(var(--page-margin-x, 64px), 12vw) 80px',
                backgroundColor: 'var(--bg-paper)',
                color: 'var(--text-main)',
                fontSize: `${userStats.fontSize}px`,
                lineHeight: userStats.lineHeight,
                boxShadow: 'var(--shadow-paper)',
                position: 'relative',
                borderRadius: 'var(--radius-paper, var(--radius-lg))',
                border: '1px solid var(--border-subtle)',
                boxSizing: 'border-box',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              {/* chapter title input header */}
              <div style={{ marginBottom: '32px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '20px' }}>
                <input
                  type="text"
                  value={activeChapter.title}
                  onChange={e => updateChapterTitle(activeChapter.id, e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '1.6rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    textAlign: 'center',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-main)',
                    outline: 'none',
                    marginBottom: '6px'
                  }}
                  placeholder="Chapter Title..."
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>Chapter {activeChapter.order}</span>
                  <span>•</span>
                  <span style={{ textTransform: 'capitalize' }}>{activeChapter.status}</span>
                  <span>•</span>
                  <span>{activeChapter.wordCount || 0} words</span>
                </div>
              </div>

              {/* editable rich text canvas */}
              {newEditor ? (
                <div onClick={handleEditorClick}>
                <EditorSurface
                  chapterId={activeChapter.id}
                  scope={project.id}
                  html={activeChapter.content}
                  onChange={(html, _e, meta) => handleSingleInput(html, meta?.remote)}
                  onKeyDown={e => {
                    playKeystroke(e.key);
                    if (e.key === 'Enter') {
                      requestAnimationFrame(() => {
                        if (containerRef.current) ensureCursorVisible(containerRef.current, userStats.typewriterMode);
                      });
                    }
                  }}
                  className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
                  font={userStats.activeFont}
                  style={{
                    minHeight: '60vh',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontSize: `${userStats.fontSize}px`,
                    lineHeight: userStats.lineHeight,
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word'
                  }}
                />
                </div>
              ) : (
                <div
                  ref={editorRef}
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Manuscript text"
                  suppressContentEditableWarning
                  onInput={() => handleSingleInput()}
                  onKeyDown={e => {
                    playKeystroke(e.key);
                    if (e.key === 'Enter') {
                      requestAnimationFrame(() => {
                        if (containerRef.current) {
                          ensureCursorVisible(containerRef.current, userStats.typewriterMode);
                        }
                      });
                    }
                    if (editorReviewMode === 'suggesting') {
                      handleSuggestionKeyDown(e, activeChapter.id);
                    }
                  }}
                  onClick={handleEditorClick}
                  className={`editable-manuscript ${userStats.indentParagraphs ? 'indent-paragraphs' : ''}`}
                  data-font={userStats.activeFont}
                  data-chapter-id={activeChapter.id}
                  style={{
                    minHeight: '60vh',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontSize: `${userStats.fontSize}px`,
                    lineHeight: userStats.lineHeight,
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word'
                  }}
                />
              )}
              {/* open draft: a scene break after the last line */}
              {project.draftMode === 'open_draft' && (
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                  <button
                    onClick={() => insertSceneBreak(activeChapter.id)}
                    title="Add a scene break (* * *) at the end"
                    style={{ padding: '8px 18px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--tag-bg)', border: '1px dashed var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer' }}
                  >
                    * * * Scene break at the end
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* caret that brings the bottom bar back */}
      {isBarHidden && (
        // zero-height strip that sticks to the bottom of the writing area, so the button
        // sits in the empty space beside the page and stays put while you scroll.
        <div style={{ position: 'sticky', bottom: 0, height: 0, width: '100%', zIndex: 90, flexShrink: 0, pointerEvents: 'none' }}>
          <button
            onClick={() => setBarHidden(false)}
            title="Show the session bar (timer, word count, sounds)"
            aria-label="Show the session bar"
            style={{
              position: 'absolute', bottom: '16px', left: '12px', pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px',
              borderRadius: 'var(--radius-full)', color: 'var(--accent-gold-text, var(--accent-gold))', cursor: 'pointer',
              backgroundColor: 'var(--toolbar-bg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-md)'
            }}
          >
            <ChevronUp size={18} />
          </button>
        </div>
      )}

      {/* floating session focus capsule */}
      <div
        className="glass-panel session-capsule"
        style={{
          display: isBarHidden ? 'none' : 'flex',
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          alignItems: 'center',
          gap: '14px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-md)',
          backgroundColor: 'var(--toolbar-bg)',
          zIndex: 90,
          userSelect: 'none'
        }}
      >
        <button
          onClick={() => setBarHidden(true)}
          title="Tuck this bar away"
          aria-label="Hide the session bar"
          style={{ display: 'flex', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <ChevronDown size={15} />
        </button>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* timer toggle */}
        <button
          onClick={() => setIsTimerRunning(!isTimerRunning)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: isTimerRunning ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 500,
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Clock size={15} />
          <span>{formatTimer(timerSeconds)}</span>
        </button>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* live words sprint metric */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-main)' }}>
          <Sparkles size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span className="capsule-label">+{sessionWordsAdded} words this session</span><span className="capsule-short">+{sessionWordsAdded}</span>
        </div>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* view mode indicator toggle */}
        <button
          onClick={() => setEditorScrollMode(editorScrollMode === 'single' ? 'infinite' : 'single')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {editorScrollMode === 'infinite' ? <ScrollText size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} /> : <FileText size={14} />}
          <span className="capsule-label">{editorScrollMode === 'infinite' ? 'Infinite Scroll' : 'Single Chapter'}</span>
        </button>

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* sensory typing audio & keystroke switcher */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
            title="Active Typing Sound: Mechanical, Typewriter, or Ambient"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: (userStats.keystrokeSound !== 'off' || userStats.ambientSound !== 'off') ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Keyboard size={15} />
            <span style={{ textTransform: 'capitalize' }}>
              {userStats.keystrokeSound !== 'off' ? keystrokeLabel(userStats.keystrokeSound, userStats.customSounds) : 'Keys: Off'}
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
                width: '280px',
                backgroundColor: 'var(--bg-paper)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-subtle)',
                padding: '12px',
                zIndex: 500,
                maxHeight: '420px',
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

              {keystrokeOptions(userStats.customSounds).map(opt => (
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

        <span style={{ color: 'var(--border-strong)' }}>|</span>

        {/* notes / critique drawer trigger */}
        <button
          onClick={() => setIsSideCommentsOpen(!isSideCommentsOpen)}
          title="Toggle inline comments drawer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: project.comments.length > 0 ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 500,
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <MessageSquare size={14} />
          <span>{project.comments.length} notes</span>
        </button>
      </div>

      {/* floating side comments drawer */}
      {isSideCommentsOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            top: '70px',
            right: '24px',
            width: '320px',
            height: 'calc(100vh - 120px)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            backgroundColor: 'var(--bg-paper)',
            border: '1px solid var(--border-subtle)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Critique Notes & Annotations</span>
            <button onClick={() => setIsSideCommentsOpen(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CommentsDrawer />
          </div>
        </div>
      )}

      {/* writing sprint launcher modal */}
      <WritingSprintModal />
    </div>
  );
};
