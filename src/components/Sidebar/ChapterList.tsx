import React, { useState, useMemo } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { SCENE_BREAK, sceneCount } from '../../services/openDraft';
import { 
  Plus, 
  Trash2, 
  FileText, 
  MoveUp, 
  MoveDown, 
  Scissors, 
  ArrowUpToLine, 
  Layers,
  ScrollText,
  Bookmark,
  Edit3,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  FolderInput
} from 'lucide-react';
import { DocumentDetailsModal } from '../Modals/DocumentDetailsModal';
import { countWordsFromHtml } from '../../services/storage';
import { htmlToPlainText } from '../../services/storyAnalyzer';
import { DialogFrame } from '../Common/DialogFrame';

export const ChapterList: React.FC = () => {
  const { 
    project, 
    activeChapterId, 
    setActiveChapterId, 
    createChapter, 
    deleteChapter,
    removeScene,
    moveScene,
    updateProjectMeta,
    updateChapterFolder,
    editorScrollMode,
    setEditorScrollMode,
    splitChapter,
    insertChapterAt,
    mergeChapterWithPrevious,
    setDraftMode,
    insertSceneBreak,
    showToast,
    createNewProject
  } = useAsterism();

  const [newTitle, setNewTitle] = useState('');
  const [newChapterAct, setNewChapterAct] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [splitModalChapterId, setSplitModalChapterId] = useState<string | null>(null);
  const [splitNewTitle, setSplitNewTitle] = useState('');
  const [isDocDetailsModalOpen, setIsDocDetailsModalOpen] = useState(false);

  // act / section management
  const [isAddingAct, setIsAddingAct] = useState(false);
  const [newActName, setNewActName] = useState('');
  const [collapsedActs, setCollapsedActs] = useState<Record<string, boolean>>({});
  const [movingChapterId, setMovingChapterId] = useState<string | null>(null);
  // the chapter or scene waiting for a second click before it is removed
  const [confirmChapterId, setConfirmChapterId] = useState<string | null>(null);
  const [confirmScene, setConfirmScene] = useState<number | null>(null);

  // derive scenes for open draft mode
  const openDraftScenes = useMemo(() => {
    if (project.draftMode !== 'open_draft') return [];
    const content = project.chapters[0]?.content || '';
    const dividerRegex = SCENE_BREAK;
    const rawChunks = content.split(dividerRegex).filter(s => s && s.trim().length > 0);
    
    if (rawChunks.length === 0) {
      return [{
        sceneIndex: 0,
        title: 'Draft Beginning',
        words: countWordsFromHtml(content),
        snippet: 'Start typing your continuous manuscript draft...'
      }];
    }

    return rawChunks.map((chunk, idx) => {
      const words = countWordsFromHtml(chunk);
      const text = htmlToPlainText(chunk);
      const firstLine = text.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
      const snippet = firstLine.length > 55 ? firstLine.slice(0, 52) + '...' : firstLine;
      
      let title = `Scene ${idx + 1}`;
      const headerMatch = chunk.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      if (headerMatch && headerMatch[1]) {
        title = headerMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      return {
        sceneIndex: idx,
        title,
        words,
        snippet: snippet || 'Scene text...'
      };
    });
  }, [project.draftMode, project.chapters]);

  const scrollToScene = (sceneIndex: number) => {
    const editor = document.querySelector('.editable-manuscript');
    if (editor) {
      if (sceneIndex === 0) {
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const dividers = Array.from(editor.querySelectorAll('hr, p')).filter(el => 
        el.tagName === 'HR' || (el.textContent && el.textContent.includes('* * *'))
      );
      if (dividers[sceneIndex - 1]) {
        dividers[sceneIndex - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleConvertToChapters = () => {
    const masterContent = project.chapters[0]?.content || '';
    const dividerRegex = SCENE_BREAK;
    const rawSegments = masterContent.split(dividerRegex).filter(s => s && s.trim().length > 0);

    if (rawSegments.length <= 1) {
      showToast('Add scene breaks (* * *) to your text first, then convert to chapters', 'info');
      return;
    }

    const newChapters = rawSegments.map((seg, idx) => ({
      id: `chap-${Date.now()}-${idx + 1}`,
      title: `Chapter ${idx + 1}`,
      order: idx + 1,
      content: seg,
      wordCount: countWordsFromHtml(seg),
      status: 'draft' as const,
      updatedAt: new Date().toISOString()
    }));

    updateProjectMeta({
      draftMode: 'chaptered',
      chapters: newChapters
    });
    setActiveChapterId(newChapters[0].id);
    showToast(`Converted ${newChapters.length} scenes into discrete chapters!`, 'success');
  };

  // derive all unique acts present in the manuscript
  const existingActs = useMemo(() => {
    const set = new Set<string>();
    project.chapters.forEach(c => {
      if (c.folder && c.folder.trim()) set.add(c.folder.trim());
    });
    return Array.from(set);
  }, [project.chapters]);

  // group chapters by act / folder
  const groupedChapters = useMemo(() => {
    const groups: { [key: string]: typeof project.chapters } = {};
    
    // ensure all existing acts have an entry in groups
    existingActs.forEach(act => {
      groups[act] = [];
    });

    // also have an unfiled / default group if any chapter has no folder
    const hasUnfiled = project.chapters.some(c => !c.folder || !c.folder.trim());
    if (hasUnfiled || existingActs.length === 0) {
      groups['__unfiled__'] = [];
    }

    project.chapters.forEach(chap => {
      const key = (chap.folder && chap.folder.trim()) ? chap.folder.trim() : '__unfiled__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(chap);
    });

    return groups;
  }, [project.chapters, existingActs]);

  const toggleActCollapse = (actKey: string) => {
    setCollapsedActs(prev => ({
      ...prev,
      [actKey]: !prev[actKey]
    }));
  };

  const handleAddAct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActName.trim()) return;
    const act = newActName.trim();
    // create first chapter inside this new act
    createChapter(`${act}: Chapter 1`);
    // assign that chapter to this act
    setTimeout(() => {
      // find the newly added chapter
      const latest = project.chapters[project.chapters.length - 1];
      if (latest) {
        updateChapterFolder(latest.id, act);
      }
    }, 50);
    setNewActName('');
    setIsAddingAct(false);
    showToast(`Created new act section "${act}"!`, 'info');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      createChapter(newTitle.trim());
      const act = newChapterAct.trim();
      if (act) {
        setTimeout(() => {
          const latest = project.chapters[project.chapters.length - 1];
          if (latest) {
            updateChapterFolder(latest.id, act);
          }
        }, 50);
      }
      setNewTitle('');
      setIsAdding(false);
    }
  };

  const handleChapterClick = (chapterId: string) => {
    setActiveChapterId(chapterId);
    if (editorScrollMode === 'infinite') {
      const el = document.getElementById(`chapter-section-${chapterId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const moveChapter = (index: number, direction: 'up' | 'down') => {
    const chapters = [...project.chapters];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const temp = chapters[index];
    chapters[index] = chapters[targetIndex];
    chapters[targetIndex] = temp;

    const reordered = chapters.map((c, i) => ({ ...c, order: i + 1 }));
    updateProjectMeta({ chapters: reordered });
  };

  const handleOpenSplitModal = (chapterId: string) => {
    const target = project.chapters.find(c => c.id === chapterId);
    if (!target) return;
    setSplitModalChapterId(chapterId);
    setSplitNewTitle(`Chapter ${target.order + 1}: Part II`);
  };

  const handleConfirmSplit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitModalChapterId) return;
    const target = project.chapters.find(c => c.id === splitModalChapterId);
    if (!target) return;

    // split HTML roughly at the midpoint paragraph if not cursor-specified
    const content = target.content || '<p></p>';
    const paragraphs = content.split('</p>');
    
    if (paragraphs.length <= 1) {
      // split into two equal halves
      const mid = Math.floor(content.length / 2);
      const before = content.slice(0, mid) + '</p>';
      const after = '<p>' + content.slice(mid);
      splitChapter(splitModalChapterId, before, after, splitNewTitle);
    } else {
      const midIdx = Math.max(1, Math.floor(paragraphs.length / 2));
      const before = paragraphs.slice(0, midIdx).join('</p>') + '</p>';
      const after = paragraphs.slice(midIdx).join('</p>');
      splitChapter(splitModalChapterId, before, after, splitNewTitle);
    }

    setSplitModalChapterId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      {/* active document overview card */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.title}
              </span>
              <button
                onClick={() => setIsDocDetailsModalOpen(true)}
                title="Edit document title, folder, genre & details"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Edit3 size={13} />
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>{project.tags?.length ? project.tags.slice(0, 2).join(' · ') : 'Document'}</span>
              {project.author && <span>• {project.author}</span>}
            </div>
          </div>

          <button
            onClick={() => createNewProject()}
            title="Create a new blank untitled document straight up"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--tag-bg)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Plus size={12} />
            <span>New Doc</span>
          </button>
        </div>

        {/* parent document folder badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.7rem' }}>
          <div 
            onClick={() => setIsDocDetailsModalOpen(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              color: project.folder ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-muted)',
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title="Click to organize this document into a folder / series"
          >
            <Folder size={11} />
            <span>{project.folder ? `Folder: ${project.folder}` : 'Unfiled Manuscript'}</span>
          </div>
          <button
            onClick={() => setIsDocDetailsModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              cursor: 'pointer',
              padding: '0 2px'
            }}
          >
            Change
          </button>
        </div>
      </div>

      {/* draft architecture: open draft vs chaptered */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span>Draft Mode:</span>
          <span style={{ fontWeight: 600, color: project.draftMode === 'open_draft' ? 'var(--accent-primary)' : 'var(--accent-gold-text, var(--accent-gold))' }}>
            {project.draftMode === 'open_draft' ? '📄 Open Continuous Draft' : '📑 Chaptered Mode'}
          </span>
        </div>
        <div 
          style={{ 
            display: 'flex', 
            padding: '2px', 
            backgroundColor: 'var(--bg-app)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <button
            onClick={() => setDraftMode('open_draft')}
            title="Draft freely as one continuous text, without chapter divisions"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.73rem',
              fontWeight: project.draftMode === 'open_draft' ? 600 : 500,
              color: project.draftMode === 'open_draft' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              backgroundColor: project.draftMode === 'open_draft' ? 'var(--bg-paper)' : 'transparent',
              boxShadow: project.draftMode === 'open_draft' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer'
            }}
          >
            <ScrollText size={12} />
            <span>Open Draft</span>
          </button>

          <button
            onClick={() => setDraftMode('chaptered')}
            title="Structure your manuscript as chapter cards, acts and numbered sections"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.73rem',
              fontWeight: project.draftMode !== 'open_draft' ? 600 : 500,
              color: project.draftMode !== 'open_draft' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
              backgroundColor: project.draftMode !== 'open_draft' ? 'var(--bg-paper)' : 'transparent',
              boxShadow: project.draftMode !== 'open_draft' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer'
            }}
          >
            <Layers size={12} />
            <span>Chaptered</span>
          </button>
        </div>
      </div>

      {project.draftMode === 'open_draft' ? (
        /* ============================================================== */
        /* open draft view: scenes & outline flow */
        /* ============================================================== */
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* quick scene break action */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              onClick={() => insertSceneBreak()}
              title="Insert a typographic scene divider (* * *) into the prose"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontSize: '0.74rem',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-gold-bg)',
                border: '1px solid var(--accent-gold)',
                color: 'var(--accent-gold-text, var(--accent-gold))',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={13} />
              <span>+ Scene Break (***)</span>
            </button>

            <button
              onClick={handleConvertToChapters}
              title="Split this flowing open draft into discrete chapters based on scene breaks"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                fontSize: '0.74rem',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--tag-bg)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Scissors size={13} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <span>Split to Chapters</span>
            </button>
          </div>

          {/* scene list header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Scene Flow ({openDraftScenes.length})
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Click to jump
            </span>
          </div>

          {/* scene cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {openDraftScenes.map((scene, sIdx) => (
              <div
                key={sIdx}
                onClick={() => scrollToScene(sIdx)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all var(--transition-fast)'
                }}
                className="hover-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bookmark size={12} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {scene.title}
                    </span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', backgroundColor: 'var(--tag-bg)', padding: '1px 5px', borderRadius: '10px' }}>
                      {scene.words} w
                    </span>
                    {confirmScene === sIdx ? (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); removeScene(sIdx); setConfirmScene(null); }}
                          title="Remove this scene. It stays in Version History."
                          style={{ padding: '1px 6px', fontSize: '0.68rem', color: '#fff', backgroundColor: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                        <button onClick={e => { e.stopPropagation(); setConfirmScene(null); }} style={{ padding: '1px 6px', fontSize: '0.68rem', color: 'var(--text-muted)', cursor: 'pointer' }}>Keep</button>
                      </>
                    ) : (
                      <>
                        <button onClick={e => { e.stopPropagation(); moveScene(sIdx, -1); }} disabled={sIdx === 0} title="Move scene up" style={{ padding: '2px', color: sIdx === 0 ? 'var(--border-strong)' : 'var(--text-muted)', cursor: sIdx === 0 ? 'default' : 'pointer' }}><MoveUp size={12} /></button>
                        <button onClick={e => { e.stopPropagation(); moveScene(sIdx, 1); }} disabled={sIdx === openDraftScenes.length - 1} title="Move scene down" style={{ padding: '2px', color: sIdx === openDraftScenes.length - 1 ? 'var(--border-strong)' : 'var(--text-muted)', cursor: sIdx === openDraftScenes.length - 1 ? 'default' : 'pointer' }}><MoveDown size={12} /></button>
                        <button onClick={e => { e.stopPropagation(); setConfirmScene(sIdx); }} title="Remove scene" style={{ padding: '2px', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                      </>
                    )}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  "{scene.snippet}"
                </div>
              </div>
            ))}
          </div>

          {openDraftScenes.length <= 1 && (
            <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px dashed var(--border-subtle)', textAlign: 'center', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Writing in Open Continuous Draft mode. Click <strong>+ Scene Break (***)</strong> whenever transitioning scenes or perspectives to populate your outline.
            </div>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* chaptered view: existing chapter & act cards */
        /* ============================================================== */
        <>
          {/* mode switcher: single chapter vs infinite scroll */}
          <div 
            style={{ 
              display: 'flex', 
              padding: '3px', 
              backgroundColor: 'var(--bg-app)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
        <button
          onClick={() => setEditorScrollMode('single')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.74rem',
            fontWeight: editorScrollMode === 'single' ? 600 : 500,
            color: editorScrollMode === 'single' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            backgroundColor: editorScrollMode === 'single' ? 'var(--bg-paper)' : 'transparent',
            boxShadow: editorScrollMode === 'single' ? 'var(--shadow-xs)' : 'none',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <FileText size={13} />
          <span>Single Chapter</span>
        </button>

        <button
          onClick={() => setEditorScrollMode('infinite')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.74rem',
            fontWeight: editorScrollMode === 'infinite' ? 600 : 500,
            color: editorScrollMode === 'infinite' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
            backgroundColor: editorScrollMode === 'infinite' ? 'var(--bg-paper)' : 'transparent',
            boxShadow: editorScrollMode === 'infinite' ? 'var(--shadow-xs)' : 'none',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <ScrollText size={13} />
          <span>Infinite Scroll</span>
        </button>
      </div>

      {/* action buttons: add act, insert at top & add chapter */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <button
          onClick={() => setIsAddingAct(true)}
          title="Create a new Act / Part / Section to organize chapters into folders"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            fontSize: '0.73rem',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--tag-bg)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          <FolderPlus size={12} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span>+ New Act / Section</span>
        </button>

        <button
          onClick={() => {
            setIsAdding(true);
            setNewChapterAct('');
          }}
          title="Add chapter at end of manuscript"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            fontSize: '0.73rem',
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-gold-bg)',
            border: '1px solid var(--accent-gold)',
            color: 'var(--accent-gold-text, var(--accent-gold))',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Plus size={12} />
          <span>+ New Chapter</span>
        </button>
      </div>

      {/* insert at top shortcut */}
      <button
        onClick={() => insertChapterAt(0, 'Prologue: Before the Dawn')}
        title="Add Prologue / Chapter at the top (lets you go up from the top!)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          fontSize: '0.7rem',
          padding: '4px 6px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'transparent',
          border: '1px dashed var(--border-subtle)',
          color: 'var(--text-muted)',
          cursor: 'pointer'
        }}
      >
        <ArrowUpToLine size={11} />
        <span>+ Add Prologue / Chapter at Top</span>
      </button>

      {/* new act input form */}
      {isAddingAct && (
        <form onSubmit={handleAddAct} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--accent-gold)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FolderPlus size={12} />
            <span>Create Act / Manuscript Section Folder</span>
          </div>
          <input
            type="text"
            value={newActName}
            onChange={e => setNewActName(e.target.value)}
            placeholder="e.g. Act I: The Awakening, Part 2..."
            autoFocus
            style={{
              padding: '6px 8px',
              fontSize: '0.8rem',
              backgroundColor: 'var(--bg-paper)',
              color: 'var(--text-main)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsAddingAct(false)}
              style={{
                padding: '4px 8px',
                color: 'var(--text-muted)',
                fontSize: '0.74rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '4px 10px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Create Act
            </button>
          </div>
        </form>
      )}

      {/* new chapter input form */}
      {isAdding && (
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)' }}>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Chapter title..."
            autoFocus
            style={{
              padding: '6px 8px',
              fontSize: '0.82rem',
              backgroundColor: 'var(--bg-paper)',
              color: 'var(--text-main)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}
          />
          {existingActs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Act/Folder:</span>
              <select
                value={newChapterAct}
                onChange={e => setNewChapterAct(e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 6px',
                  fontSize: '0.74rem',
                  backgroundColor: 'var(--bg-paper)',
                  color: 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <option value="">Default (Unassigned)</option>
                {existingActs.map(act => (
                  <option key={act} value={act}>{act}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              style={{
                padding: '4px 8px',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '4px 12px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Add Chapter
            </button>
          </div>
        </form>
      )}

      {/* chapters scrollable list grouped by act / folder */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {Object.entries(groupedChapters).map(([actKey, chaptersInGroup]) => {
          const isUnfiled = actKey === '__unfiled__';
          const isCollapsed = Boolean(collapsedActs[actKey]);
          const actTitle = isUnfiled ? (existingActs.length > 0 ? 'General / Other Chapters' : 'Chapters') : actKey;
          const totalWordsInAct = chaptersInGroup.reduce((acc, c) => acc + (c.wordCount || 0), 0);

          return (
            <div key={actKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* act / folder header if multiple acts exist or if this is a named act */}
              {(existingActs.length > 0 || !isUnfiled) && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleActCollapse(actKey)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                    {isCollapsed ? <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={13} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                    <Folder size={12} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                    <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {actTitle}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', backgroundColor: 'var(--tag-bg)', padding: '1px 5px', borderRadius: '10px' }}>
                      {chaptersInGroup.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {totalWordsInAct} w
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setIsAdding(true);
                        setNewChapterAct(isUnfiled ? '' : actKey);
                      }}
                      title={`Add chapter to ${actTitle}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-gold-text, var(--accent-gold))',
                        cursor: 'pointer',
                        padding: '1px 3px'
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* chapters list inside this act */}
              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: existingActs.length > 0 ? '4px' : '0' }}>
                  {chaptersInGroup.length === 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '6px 8px', fontStyle: 'italic' }}>
                      No chapters in this act yet. Click + to add one.
                    </div>
                  )}
                  {chaptersInGroup.map(chap => {
                    const idx = project.chapters.findIndex(c => c.id === chap.id);
                    const isActive = chap.id === activeChapterId;
                    return (
                      <div
                        key={chap.id}
                        onClick={() => handleChapterClick(chap.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isActive ? 'var(--accent-gold-bg)' : 'var(--bg-card)',
                          border: isActive ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {chap.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              <span>#{chap.order}</span>
                              <span>•</span>
                              <span>{chap.wordCount || 0} words</span>
                              {sceneCount(chap.content) > 1 && <><span>•</span><span>{sceneCount(chap.content)} scenes</span></>}
                              <span>•</span>
                              <span style={{ textTransform: 'capitalize' }}>{chap.status}</span>
                            </div>
                          </div>

                          {/* primary move actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <button
                              onClick={e => { e.stopPropagation(); moveChapter(idx, 'up'); }}
                              disabled={idx === 0}
                              title="Move Up"
                              style={{ padding: '3px', color: idx === 0 ? 'var(--border-strong)' : 'var(--text-muted)', cursor: idx === 0 ? 'default' : 'pointer' }}
                            >
                              <MoveUp size={13} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); moveChapter(idx, 'down'); }}
                              disabled={idx === project.chapters.length - 1}
                              title="Move Down"
                              style={{ padding: '3px', color: idx === project.chapters.length - 1 ? 'var(--border-strong)' : 'var(--text-muted)', cursor: idx === project.chapters.length - 1 ? 'default' : 'pointer' }}
                            >
                              <MoveDown size={13} />
                            </button>
                            {confirmChapterId === chap.id ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
                                <button
                                  onClick={e => { e.stopPropagation(); deleteChapter(chap.id); setConfirmChapterId(null); }}
                                  title="Remove this chapter. It stays in Version History."
                                  style={{ padding: '2px 6px', color: '#fff', backgroundColor: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                                >
                                  {project.chapters.length <= 1 ? 'Empty it' : 'Remove'}
                                </button>
                                <button onClick={e => { e.stopPropagation(); setConfirmChapterId(null); }} style={{ padding: '2px 6px', color: 'var(--text-muted)', cursor: 'pointer' }}>Keep</button>
                              </span>
                            ) : (
                              <button aria-label="Delete chapter"
                                onClick={e => { e.stopPropagation(); setConfirmChapterId(chap.id); }}
                                title={project.chapters.length <= 1 ? 'Empty this chapter' : 'Delete Chapter'}
                                style={{ padding: '3px', color: 'var(--text-muted)', cursor: 'pointer' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* sub-actions: assign act, split chapter & insert below */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setMovingChapterId(chap.id); }}
                            title="Assign to Act or Folder"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.7rem',
                              color: chap.folder ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-muted)',
                              background: 'none',
                              border: 'none',
                              padding: '2px 4px',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <FolderInput size={11} />
                            <span>{chap.folder ? 'Change Act' : 'Assign Act'}</span>
                          </button>

                          <button
                            onClick={e => { e.stopPropagation(); handleOpenSplitModal(chap.id); }}
                            title="Separate into two distinct chapters"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.7rem',
                              color: 'var(--accent-gold-text, var(--accent-gold))',
                              background: 'none',
                              border: 'none',
                              padding: '2px 4px',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <Scissors size={11} />
                            <span>Split</span>
                          </button>

                          <button
                            onClick={e => { e.stopPropagation(); insertChapterAt(idx + 1); }}
                            title="Insert new chapter directly after this one"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              background: 'none',
                              border: 'none',
                              padding: '2px 4px',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <Plus size={11} />
                            <span>Insert</span>
                          </button>

                          {idx > 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); mergeChapterWithPrevious(chap.id); }}
                              title="Merge with previous chapter"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                background: 'none',
                                border: 'none',
                                padding: '2px 4px',
                                cursor: 'pointer',
                                borderRadius: 'var(--radius-sm)'
                              }}
                            >
                              <Layers size={11} />
                              <span>Merge</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}

      {/* assign chapter to act / folder modal */}
      {movingChapterId && (
        <DialogFrame label="Move chapter" onClose={() => setMovingChapterId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            padding: '20px'
          }}
          onClick={() => setMovingChapterId(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderInput size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
                Move Chapter to Act / Folder
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Assign "{project.chapters.find(c => c.id === movingChapterId)?.title}" to an Act, Part, or Section folder:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  updateChapterFolder(movingChapterId, null);
                  setMovingChapterId(null);
                  showToast('Removed chapter from act folder', 'info');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Folder size={14} style={{ color: 'var(--text-muted)' }} />
                <span>None (Unassigned / General)</span>
              </button>

              {existingActs.map(act => (
                <button
                  key={act}
                  onClick={() => {
                    updateChapterFolder(movingChapterId, act);
                    setMovingChapterId(null);
                    showToast(`Moved chapter to "${act}"`, 'info');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Folder size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                  <span>{act}</span>
                </button>
              ))}
            </div>

            {/* create new act directly */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Or create new Act / Section:
              </label>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  const target = (e.currentTarget.elements.namedItem('newCustomAct') as HTMLInputElement).value;
                  if (target.trim()) {
                    updateChapterFolder(movingChapterId, target.trim());
                    setMovingChapterId(null);
                    showToast(`Assigned chapter to new act "${target.trim()}"`, 'info');
                  }
                }}
                style={{ display: 'flex', gap: '6px' }}
              >
                <input
                  name="newCustomAct"
                  type="text"
                  placeholder="e.g. Act III: The Convergence"
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: '0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Assign
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setMovingChapterId(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* split chapter modal */}
      {splitModalChapterId && (
        <DialogFrame label="Split chapter" onClose={() => setSplitModalChapterId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            padding: '20px'
          }}
          onClick={() => setSplitModalChapterId(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-lg)',
              padding: '22px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scissors size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
                Separate Chapter into Two
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              This splits the chapter into two chapters in your outline.
            </p>

            <form onSubmit={handleConfirmSplit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Title for New Second Chapter
                </label>
                <input
                  type="text"
                  required
                  value={splitNewTitle}
                  onChange={e => setSplitNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.86rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSplitModalChapterId(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Separate Chapter
                </button>
              </div>
            </form>
          </div>
        </DialogFrame>
      )}

      {/* document details modal */}
      <DocumentDetailsModal
        isOpen={isDocDetailsModalOpen}
        onClose={() => setIsDocDetailsModalOpen(false)}
      />
    </div>
  );
};
