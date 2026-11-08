import React, { useState, useRef } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import {
  Sparkles,
  Palette,
  FileDown,
  FileUp,
  MoreHorizontal,
  Maximize2,
  BookOpen,
  Volume2,
  VolumeX,
  PanelLeftClose,
  PanelLeft,
  Flame,
  CloudRain,
  Coffee,
    Network,
  Home,
  Radio,
  ScrollText,
  PenTool,
  Edit3,
  Lightbulb,
  MessageSquare,
  ChevronDown,
  Check,
  Zap,
  Timer,
  Waves,
  Plus,
  History,
  RefreshCw,
  GitBranch,
  ShoppingBag, Wind, Save, SlidersHorizontal, ShieldCheck, Compass, Gamepad2 } from 'lucide-react';
import type { KeystrokeSound } from '../../types';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { ExportModal } from '../Modals/ExportModal';
import { SyncModal } from '../Modals/SyncModal';
import { BackupModal } from '../Modals/BackupModal';
import { TourModal } from '../Modals/TourModal';
import { PrivacyModal } from '../Modals/PrivacyModal';
import { CustomizeModal } from '../Modals/CustomizeModal';
import { BAR_VIEWS, inOrder, isShown } from '../../services/layout';
import { CollaborationModal } from '../Modals/CollaborationModal';
import { DocumentDetailsModal } from '../Modals/DocumentDetailsModal';
import { VersionHistoryModal } from '../Modals/VersionHistoryModal';

export const NavigationBar: React.FC = () => {
  const {
    project,
    activeChapter,
    userStats,
    sidebarTab,
    setSidebarTab,
    isSidebarOpen,
    toggleSidebar,
    viewMode,
    setViewMode,
    setAmbientSound,
    setAmbientVolume,
    setKeystrokeSound,
    setKeystrokeVolume,
    setIsSprintModalOpen,
    editorScrollMode,
    setEditorScrollMode,
    editorReviewMode,
    setEditorReviewMode,
    liveSessions,
    setIsCollabModalOpen,
    playKeystroke,
    createNewProject,
    openTool,
    isVersionHistoryOpen,
    setIsVersionHistoryOpen,
    lastAutosaveTime,
    importManuscriptFile,
    openShop,
    setIsTourOpen
  } = useAsterism();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const show = (id: string) => isShown(userStats.home?.hiddenBar, id);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isReviewMenuOpen, setIsReviewMenuOpen] = useState(false);
  const [isDocDetailsModalOpen, setIsDocDetailsModalOpen] = useState(false);

  // total words across all chapters
  const totalWords = project.chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);

  const soundOptions = [
    { id: 'off', label: 'Silence', icon: <VolumeX size={15} /> },
    { id: 'ocean', label: 'Ocean Waves', icon: <Waves size={15} /> },
    { id: 'rain', label: 'Rain on Glass', icon: <CloudRain size={15} /> },
    { id: 'wind', label: 'Wind Through Trees', icon: <Wind size={15} /> },
    { id: 'fire', label: 'Actual Crackling Fire', icon: <Flame size={15} /> },
    { id: 'library', label: 'Library Drone', icon: <Coffee size={15} /> },
  ] as const;

  const views: Record<string, { icon: React.ReactNode; title: string; on: boolean; run: () => void; narrow?: boolean }> = {
    editor: { icon: <PenTool size={13} />, title: 'Standard Word Processor Canvas', on: viewMode === 'standard', run: () => setViewMode('standard') },
    zen: { icon: <Maximize2 size={13} />, title: 'Distraction-Free Zen Mode (Esc to return)', on: viewMode === 'distraction_free', run: () => setViewMode('distraction_free') },
    book: { icon: <BookOpen size={13} />, title: 'Typeset Book Preview', on: viewMode === 'book_preview', run: () => setViewMode(viewMode === 'book_preview' ? 'standard' : 'book_preview') },
    map: { icon: <Network size={13} />, title: 'Story 2D Mind Map & Character Web', on: viewMode === 'mindmap', run: () => (viewMode === 'mindmap' ? setViewMode('standard') : openTool('mindmap')), narrow: true },
    prompts: { icon: <Sparkles size={13} />, title: 'Calliope’s Prompt Lab (Browse prompts, draft sparks, or roll random situations)', on: viewMode === 'prompt_lab', run: () => setViewMode(viewMode === 'prompt_lab' ? 'standard' : 'prompt_lab'), narrow: true },
    play: { icon: <Gamepad2 size={13} />, title: 'Play (Story games, character scenarios, solo adventures, and games to play with others)', on: viewMode === 'play', run: () => setViewMode(viewMode === 'play' ? 'standard' : 'play'), narrow: true },
  };

  return (
    <>
      <header
        className="glass-panel"
        style={{
          height: '56px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--toolbar-bg)',
          zIndex: 100,
          userSelect: 'none',
          gap: '10px'
        }}
      >
        {/* left section: sanctuary button, sidebar toggle & project title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* sanctuary home button */}
          <button
            onClick={() => setViewMode('home')}
            title="Return to Asterism Home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--badge-bg)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Home size={14} />
            <span className="nav-btn-text">Home</span>
          </button>

          {/* sidebar toggle button */}
          <button
            onClick={toggleSidebar}
            title={isSidebarOpen ? 'Hide story sidebar' : 'Show story sidebar'}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              backgroundColor: isSidebarOpen ? 'var(--tag-bg)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>

          {/* brand & project title (click to edit document metadata) */}
          {show('title') && <button
            className="nav-hide-sm"
            onClick={() => setIsDocDetailsModalOpen(true)}
            title={`Document: "${project.title}" — Click to edit title, author, genre & premise`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: '1px solid transparent',
              cursor: 'pointer',
              color: 'inherit',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
          >
            <span style={{ fontSize: '1.05rem', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--accent-gold-text, var(--accent-gold))' }}>
              ✒️
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: '0.88rem',
                color: 'var(--text-main)',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {project.title}
            </span>
            <Edit3 size={12} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
          </button>}

          {/* autosave status indicator pill */}
          {show('saved') && <button
            onClick={() => setIsVersionHistoryOpen(true)}
            title={lastAutosaveTime ? `Saved at ${lastAutosaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Open version history.` : 'Saved. Open version history.'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#0b7a56',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Check size={12} strokeWidth={2.5} />
            <span className="nav-btn-text">Saved</span>
            <History size={12} />
          </button>}

          {/* review mode selector (editing, suggesting, commenting) */}
          <div className="nav-hide-md" style={{ position: 'relative' }}>
            <button
              onClick={() => setIsReviewMenuOpen(!isReviewMenuOpen)}
              title="Change Writing Mode: Direct Editing, Suggesting (Self-Track Changes), or Commenting (Review Notes)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 9px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: editorReviewMode === 'suggesting'
                  ? 'rgba(16, 185, 129, 0.12)'
                  : editorReviewMode === 'commenting'
                    ? 'var(--accent-gold-bg)'
                    : 'var(--tag-bg)',
                border: editorReviewMode === 'suggesting'
                  ? '1px solid #10b981'
                  : editorReviewMode === 'commenting'
                    ? '1px solid var(--accent-gold)'
                    : '1px solid var(--border-subtle)',
                color: editorReviewMode === 'suggesting'
                  ? '#10b981'
                  : editorReviewMode === 'commenting'
                    ? 'var(--accent-gold)'
                    : 'var(--text-main)',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {editorReviewMode === 'editing' && <Edit3 size={13} />}
              {editorReviewMode === 'suggesting' && <Lightbulb size={13} />}
              {editorReviewMode === 'commenting' && <MessageSquare size={13} />}
              <span style={{ textTransform: 'capitalize' }}>{editorReviewMode}</span>
              <ChevronDown size={11} />
            </button>

            {isReviewMenuOpen && (
              <div
                className="glass-panel animate-fade-in"
                style={{
                  position: 'absolute',
                  top: '120%',
                  left: 0,
                  width: '240px',
                  backgroundColor: 'var(--bg-paper)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px',
                  zIndex: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Author Mode
                </div>

                <button
                  onClick={() => {
                    setEditorReviewMode('editing');
                    setIsReviewMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    backgroundColor: editorReviewMode === 'editing' ? 'var(--tag-bg)' : 'transparent',
                    color: 'var(--text-main)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Edit3 size={15} style={{ color: 'var(--accent-primary)' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Editing Mode</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Direct drafting & revisions</div>
                    </div>
                  </div>
                  {editorReviewMode === 'editing' && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
                </button>

                <button
                  onClick={() => {
                    setEditorReviewMode('suggesting');
                    setIsReviewMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    backgroundColor: editorReviewMode === 'suggesting' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    color: 'var(--text-main)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lightbulb size={15} style={{ color: '#10b981' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#0b7a56' }}>Suggesting Mode</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Track changes & self-edits</div>
                    </div>
                  </div>
                  {editorReviewMode === 'suggesting' && <Check size={14} style={{ color: '#10b981' }} />}
                </button>

                <button
                  onClick={() => {
                    setEditorReviewMode('commenting');
                    setIsReviewMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    backgroundColor: editorReviewMode === 'commenting' ? 'var(--accent-gold-bg)' : 'transparent',
                    color: 'var(--text-main)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={15} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>Commenting Mode</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Leave critique notes & ideas</div>
                    </div>
                  </div>
                  {editorReviewMode === 'commenting' && <Check size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* center: live words (compact pill) */}
        {show('count') && (
        <div
          className="nav-hide-md"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-app)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
            flexShrink: 0
          }}
        >
          {project.draftMode !== 'open_draft' && project.chapters.length > 1 && (
            <>
              <span title="Words in this chapter">This chapter: <strong style={{ color: 'var(--text-main)' }}>{(activeChapter?.wordCount || 0).toLocaleString()}</strong></span>
              <span style={{ color: 'var(--border-strong)' }}>•</span>
            </>
          )}
          <span title="Words in the whole manuscript"><strong style={{ color: 'var(--text-main)' }}>{totalWords.toLocaleString()}</strong> words</span>
        </div>
        )}

        {/* right section: view mode switcher, scroll mode, sounds, points, themes, collab & export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>

          {/* the view buttons: editor, zen and whatever else the writer keeps up here, in the order they chose */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              padding: '2px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            {inOrder(BAR_VIEWS, userStats.home?.barOrder).filter(v => v.essential || show(v.id)).map(v => {
              const view = views[v.id];
              const on = view.on;
              return (
                <button
                  key={v.id}
                  className={view.narrow ? 'nav-hide-sm' : undefined}
                  onClick={view.run}
                  title={view.title}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.76rem',
                    fontWeight: on ? 600 : 500,
                    color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                    backgroundColor: on ? 'var(--bg-paper)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  {view.icon}
                  <span className="nav-btn-text">{v.label}</span>
                </button>
              );
            })}
          </div>

          {/* quick writing sprint launcher */}
            {show('sprint') && (
          <button
            className="nav-hide-md"
            onClick={() => setIsSprintModalOpen(true)}
            title="Launch Timed Writing Sprint"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 9px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-gold-bg)',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Zap size={13} fill="currentColor" />
            <span className="nav-btn-text">Sprint</span>
          </button>
            )}

          {/* quill points badge */}
            {show('points') && (
          <button
            className="nav-hide-md"
            onClick={() => {
              setSidebarTab('goals');
              if (!isSidebarOpen) toggleSidebar();
            }}
            title="Quill Points earned through writing. Click to view Goals & Rewards."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-gold-bg)',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Sparkles size={12} />
            <span>{userStats.quillPoints}</span>
          </button>
            )}

          {/* the shop is its own page */}
            {show('shop') && (
          <button
            className="nav-hide-md"
            onClick={openShop}
            title="Shop: spend Quill Points on looks and sounds"
            aria-label="Open the shop"
            style={{ padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
          >
            <ShoppingBag size={14} />
          </button>
            )}

          {/* theme palette */}
          {show('appearance') && <button
            onClick={() => setIsThemeModalOpen(true)}
            title="Appearance: theme, type, sound"
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.76rem',
              cursor: 'pointer'
            }}
          >
            <Palette size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          </button>}

          {/* more: collaboration, import, export */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsMoreMenuOpen(v => !v)}
              title="New document, import, export, sync"
              style={{
                padding: '6px 8px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
                border: liveSessions.length > 0 ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card)', color: liveSessions.length > 0 ? '#10b981' : 'var(--text-main)', cursor: 'pointer'
              }}
            >
              <MoreHorizontal size={15} />
            </button>
            {isMoreMenuOpen && (
              <div
                className="glass-panel animate-fade-in"
                onClick={() => setIsMoreMenuOpen(false)}
                style={{
                  position: 'absolute', top: '120%', right: 0, minWidth: '190px', padding: '6px', zIndex: 300,
                  backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '2px'
                }}
              >
                {[
                  { label: 'Appearance', icon: <Palette size={14} />, run: () => setIsThemeModalOpen(true) },
                  { label: 'Version history', icon: <History size={14} />, run: () => setIsVersionHistoryOpen(true) },
                  { label: 'Document details', icon: <Edit3 size={14} />, run: () => setIsDocDetailsModalOpen(true) },
                  { label: 'Branching story', icon: <GitBranch size={14} />, run: () => openTool('branching') },
                  { label: 'New document', icon: <Plus size={14} />, run: () => createNewProject() },
                  { label: editorScrollMode === 'infinite' ? 'Show one chapter at a time' : 'Scroll all chapters', icon: <ScrollText size={14} />, run: () => setEditorScrollMode(editorScrollMode === 'single' ? 'infinite' : 'single') },
                  { label: liveSessions.length > 1 ? `Collaborate (${liveSessions.length} sessions)` : liveSessions.length === 1 ? `Collaborate (${liveSessions[0].people.length})` : 'Collaborate', icon: <Radio size={14} />, run: () => setIsCollabModalOpen(true) },
                  { label: 'Import manuscript', icon: <FileUp size={14} />, run: () => fileInputRef.current?.click() },
                  { label: 'Export', icon: <FileDown size={14} />, run: () => setIsExportModalOpen(true) },
                  { label: 'Sync', icon: <RefreshCw size={14} />, run: () => setIsSyncModalOpen(true) },
                  { label: 'Customize', icon: <SlidersHorizontal size={14} />, run: () => setIsCustomizeOpen(true) },
                  { label: 'Back up and restore', icon: <Save size={14} />, run: () => setIsBackupOpen(true) },
                  { label: 'Take the tour', icon: <Compass size={14} />, run: () => setIsTourOpen(true) },
                  { label: 'Privacy', icon: <ShieldCheck size={14} />, run: () => setIsPrivacyOpen(true) },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.run}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-main)', textAlign: 'left' }}
                  >
                    <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                await importManuscriptFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

        </div>
      </header>

      <ThemeSelectorModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
      <SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
      <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
      <TourModal />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <CustomizeModal isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} cards={[]} />
      <DocumentDetailsModal isOpen={isDocDetailsModalOpen} onClose={() => setIsDocDetailsModalOpen(false)} />
      <VersionHistoryModal isOpen={isVersionHistoryOpen} onClose={() => setIsVersionHistoryOpen(false)} />
      <CollaborationModal />
    </>
  );
};
