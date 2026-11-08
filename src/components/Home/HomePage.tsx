import { DocumentCard } from './DocumentCard';
import { TagEditor } from '../Common/TagEditor';
import { TagManager } from './TagManager';
import { RecentlyDeleted } from './RecentlyDeleted';
import { BLANK_TEMPLATE, TEMPLATES } from '../../services/templates';
import { hasAllTags, retag, sameTag, suggestionsFor, tagCounts } from '../../services/tags';
import { previewOf, searchProjects } from '../../services/documentSearch';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { Project, SidebarTab, ToolKind } from '../../types';
import { TOOL_KINDS, TOOL_LABELS } from '../../services/toolKinds';
import { ThemeSelectorModal } from '../Header/ThemeSelectorModal';
import { DocPicker } from './DocPicker';
import { PaletteTool } from './PaletteTool';
import {
  PenTool,
  Compass,
  Network,
  Users,
  GitBranch,
  Brain,
  Trophy,
  Plus,
  Sparkles,
  Palette,
  Settings,
  ShoppingBag,
  Trash2,
  ArrowRight,
  FileText,
  BookMarked,
  Radio,
  Edit3,
  Folder,
  FolderPlus,
  FolderOpen,
  Search,
  Tag,
  X,
  Check,
  Save,
  SlidersHorizontal,
  Zap,
  BookOpen,
  ShieldCheck,
  Cloud,
  Gamepad2,
  StickyNote,
} from 'lucide-react';
import { DocTabs } from '../Common/DocTabs';
import { ScratchpadPicker } from '../Scratchpads/ScratchpadPicker';
import { BackupModal } from '../Modals/BackupModal';
import { SyncModal } from '../Modals/SyncModal';
import { TourModal } from '../Modals/TourModal';
import { PrivacyModal } from '../Modals/PrivacyModal';
import { CustomizeModal } from '../Modals/CustomizeModal';
import { isShown } from '../../services/layout';
import { CollaborationModal } from '../Modals/CollaborationModal';
import { DocumentDetailsModal } from '../Modals/DocumentDetailsModal';
import { DialogFrame } from '../Common/DialogFrame';
import { BrandMark } from '../Common/BrandMark';

export const HomePage: React.FC = () => {
  const {
    project,
    allProjects,
    openProject,
    updateAnyProject,
    makeAlternateDraft,
    trash,
    restoreDeleted,
    deleteForever,
    showToast,
    createNewProject,
    deleteExistingProject,
    createDocumentFolder,
    renameDocumentFolder,
    deleteDocumentFolder,
    moveProjectToFolder,
    setViewMode,
    setIsSprintModalOpen,
    setIsTourOpen,
    goToTool,
    openTool,
    createToolDoc,
    markDraftComplete,
    openShop,
    userStats,
    triggerConfetti,
    liveSessions,
    setIsCollabModalOpen,
    setHomeSettings,
  } = useAsterism();

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [showPalettes, setShowPalettes] = useState(false);
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [padPickerOpen, setPadPickerOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDocDetailsModalOpen, setIsDocDetailsModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // folder & genre organization state
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [editingFolderOldName, setEditingFolderOldName] = useState<string | null>(null);
  const [editingFolderNewName, setEditingFolderNewName] = useState('');
  const [projectToMove, setProjectToMove] = useState<Project | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [newMode, setNewMode] = useState<'chaptered' | 'open_draft'>('chaptered');
  const [newTemplate, setNewTemplate] = useState(BLANK_TEMPLATE);

  // new project form state
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [newSynopsis, setNewSynopsis] = useState('');

  // derived collections
  const allFolders = Array.from(new Set([
    ...(userStats.documentFolders || []),
    ...allProjects.map(p => p.folder).filter(Boolean) as string[]
  ]));

  const unfiledCount = allProjects.filter(p => !p.folder).length;

  // folders with nothing in them are not worth a button; the one being viewed stays
  const folderCount = (f: string) => allProjects.filter(p => p.folder === f).length;
  const visibleFolders = allFolders.filter(f => folderCount(f) > 0 || selectedFolder === f);
  const showUnfiled = unfiledCount > 0 && unfiledCount < allProjects.length;
  const showFolderRow = visibleFolders.length > 0 || showUnfiled;
  const tagList = useMemo(() => tagCounts(allProjects), [allProjects]);
  const showTagRow = tagList.length > 0 || selectedTags.length > 0;
  // rename, merge or delete a tag in every document that has it (an empty name deletes)
  const changeTag = (from: string, to: string) => {
    retag(allProjects, from, to).forEach(change => updateAnyProject(change.id, { tags: change.tags }));
    setSelectedTags(prev => {
      const next = to ? prev.map(t => (sameTag(t, from) ? to : t)) : prev.filter(t => !sameTag(t, from));
      return next.filter((t, i) => next.findIndex(u => sameTag(u, t)) === i);
    });
    showToast(to ? `Renamed “${from}” to “${to}”` : `Removed the tag “${from}”`, 'success');
  };
  const toggleTag = (tag: string) =>
    setSelectedTags(prev => (prev.some(t => sameTag(t, tag)) ? prev.filter(t => !sameTag(t, tag)) : [...prev, tag]));

  // one click opens the document in the editor
  const openAndWrite = (id: string) => {
    if (id !== project.id) openProject(id);
    setViewMode('standard');
  };

  // searching looks inside every document, so the typing stays quick and the search follows
  const sortBy = userStats.home?.sort ?? 'manual';
  const deferredQuery = useDeferredValue(searchQuery);
  const searching = deferredQuery.trim().length > 0;
  const hits = useMemo(() => searchProjects(allProjects, deferredQuery), [allProjects, deferredQuery]);
  const previews = useMemo(() => new Map(allProjects.map(p => [p.id, p.synopsis?.trim() ? '' : previewOf(p)])), [allProjects]);

  const filteredProjects = allProjects.filter(proj => {
    // 1. folder match
    if (selectedFolder === 'unfiled') {
      if (proj.folder) return false;
    } else if (selectedFolder !== 'all') {
      if (proj.folder !== selectedFolder) return false;
    }

    // 2. tags: a document needs every tag chosen
    if (selectedTags.length > 0 && !hasAllTags(proj, selectedTags)) return false;

    // 3. search: every word has to be somewhere in the document
    if (searching && !hits.has(proj.id)) return false;

    return true;
  }).sort((a, b) => {
    // a search ranks by how much it matched; otherwise the writer's chosen order (ties keep the saved order)
    if (searching) return (hits.get(b.id)?.count ?? 0) - (hits.get(a.id)?.count ?? 0);
    const time = (v?: string) => { const t = v ? Date.parse(v) : NaN; return Number.isNaN(t) ? 0 : t; };
    switch (sortBy) {
      case 'edited': return time(b.updatedAt) - time(a.updatedAt);
      case 'newest': return time(b.createdAt) - time(a.createdAt);
      case 'oldest': return time(a.createdAt) - time(b.createdAt);
      case 'az': return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true });
      case 'za': return (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base', numeric: true });
      default: return 0;
    }
  });

  const handleCreateBlankDoc = () => {
    const targetFolder = selectedFolder !== 'all' && selectedFolder !== 'unfiled' ? selectedFolder : undefined;
    createNewProject('untitled document', '', [], '', targetFolder);
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = newTitle.trim() || 'untitled document';
    const finalAuthor = (newAuthor.trim() && newAuthor !== 'Your Name (Or leave blank)') ? newAuthor.trim() : '';
    const finalSynopsis = newSynopsis.trim();
    const targetFolder = newFolder ? newFolder : (selectedFolder !== 'all' && selectedFolder !== 'unfiled' ? selectedFolder : undefined);

    createNewProject(finalTitle, finalAuthor, newTags, finalSynopsis, targetFolder, newMode, newTemplate);
    setNewMode('chaptered');
    setIsNewProjectModalOpen(false);
    setNewTitle('');
    setNewAuthor('');
    setNewTags([]);
    setNewTemplate(BLANK_TEMPLATE);
    setNewSynopsis('');
    setNewFolder('');
    triggerConfetti();
  };

  const handleConfirmDelete = () => {
    if (projectToDelete) {
      deleteExistingProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  // tools that work on a manuscript ask which one; nothing is open until the writer picks
  const [docPicker, setDocPicker] = useState<{ title: string; run: () => void } | null>(null);
  const manuscripts = allProjects.filter(p => !p.kind);
  const pickDoc = (id: string, run: () => void) => {
    if (id !== project.id) openProject(id);
    run();
  };
  const askWhichDoc = (title: string, run: () => void) => {
    if (manuscripts.length === 1) pickDoc(manuscripts[0].id, run);
    else setDocPicker({ title, run });
  };

  const individualTools: Array<{
    id: SidebarTab | 'editor' | 'sprint' | 'book' | 'mindmap' | 'prompt_lab' | 'play' | 'branching' | 'shop' | 'palette' | 'social';
    title: string;
    category: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    actionStandalone: () => void;
    actionSideBySide?: () => void;
    // opens inside a manuscript, so the writer picks which one first
    needsDoc?: boolean;
  }> = [
      {
        id: 'prompt_lab',
        title: 'Prompt Lab',
        category: 'Inspiration & Word Sprints',
        description: 'Prompts, characters, sparks',
        icon: <Sparkles size={22} />,
        color: '#ec4899',
        actionStandalone: () => setViewMode('prompt_lab'),
      },
      {
        id: 'scratchpad',
        title: 'Scratchpad',
        category: 'Brain Dump',
        description: 'Sticky notes: start one or find an old one',
        icon: <StickyNote size={22} />,
        color: '#eab308',
        actionStandalone: () => setPadPickerOpen(true),
      },
      {
        id: 'play',
        title: 'Play',
        category: 'Games for Writers',
        description: 'Story games, solo adventures, and games to play together',
        icon: <Gamepad2 size={22} />,
        color: '#f97316',
        actionStandalone: () => setViewMode('play'),
      },
      {
        id: 'prompt_lab',
        title: 'Characters',
        category: 'Character Generator',
        description: 'Start a new character',
        icon: <Users size={22} />,
        color: '#8b5cf6',
        actionStandalone: () => createToolDoc('character'),
      },
      {
        id: 'prompt_lab',
        title: 'Scenes',
        category: 'Scene Generator',
        description: 'Start a new scene',
        icon: <Compass size={22} />,
        color: '#f59e0b',
        actionStandalone: () => createToolDoc('scene'),
      },
      {
        id: 'editor',
        needsDoc: true,
        title: 'Editor',
        category: 'Writing Canvas',
        description: 'Just write',
        icon: <PenTool size={22} />,
        color: '#c9933b',
        actionStandalone: () => setViewMode('standard'),
      },
      {
        id: 'sprint',
        needsDoc: true,
        title: 'Sprint',
        category: 'Timed Writing',
        description: 'Race the clock',
        icon: <Zap size={22} />,
        color: '#c9933b',
        actionStandalone: () => { setViewMode('standard'); setIsSprintModalOpen(true); },
      },
      {
        id: 'book',
        needsDoc: true,
        title: 'Book preview',
        category: 'Typeset Pages',
        description: 'See it as a book',
        icon: <BookOpen size={22} />,
        color: '#8b5cf6',
        actionStandalone: () => setViewMode('book_preview'),
      },
      {
        id: 'foundations',
        title: 'Cards',
        category: 'Brainstorming & Prompts',
        description: 'Start a new deck',
        icon: <Compass size={22} />,
        color: '#d4883a',
        actionStandalone: () => createToolDoc('cards'),
        actionSideBySide: () => goToTool('foundations', false),
      },
      {
        id: 'mindmap',
        title: 'Mind Map',
        category: '2D Visual Canvas',
        description: 'Start a new mind map',
        icon: <Network size={22} />,
        color: '#3b82f6',
        actionStandalone: () => createToolDoc('mindmap'),
      },
      {
        id: 'branching',
        title: 'Branching story',
        category: 'Interactive fiction',
        description: 'Start a new story',
        icon: <GitBranch size={22} />,
        color: '#14b8a6',
        actionStandalone: () => createToolDoc('branching'),
      },
      {
        id: 'bible',
        needsDoc: true,
        title: 'Story Bible',
        category: 'Worldbuilding Codex',
        description: 'Characters, places, lore',
        icon: <Users size={22} />,
        color: '#8b5cf6',
        actionStandalone: () => goToTool('bible', true),
        actionSideBySide: () => goToTool('bible', false),
      },
      {
        id: 'threads',
        needsDoc: true,
        title: 'Threads',
        category: 'Narrative Arcs',
        description: 'Track open plot lines',
        icon: <GitBranch size={22} />,
        color: '#10b981',
        actionStandalone: () => goToTool('threads', true),
        actionSideBySide: () => goToTool('threads', false),
      },
      {
        id: 'analyzer',
        needsDoc: true,
        title: 'Analyzer',
        category: 'Continuity & Style Audit',
        description: 'Check continuity',
        icon: <Brain size={22} />,
        color: '#f59e0b',
        actionStandalone: () => goToTool('analyzer', true),
        actionSideBySide: () => goToTool('analyzer', false),
      },
      {
        id: 'goals',
        needsDoc: true,
        title: 'Goals',
        category: 'Habits & Customizations',
        description: 'Targets and rewards',
        icon: <Trophy size={22} />,
        color: '#eab308',
        actionStandalone: () => goToTool('goals', true),
        actionSideBySide: () => goToTool('goals', false),
      },
      {
        id: 'shop',
        title: 'Shop',
        category: 'Quill Points',
        description: 'Themes, sounds, looks',
        icon: <ShoppingBag size={22} />,
        color: '#c9933b',
        actionStandalone: openShop,
      },
      {
        id: 'social',
        title: 'Social',
        category: 'Community',
        description: 'Friends, gifts, readers',
        icon: <Users size={22} />,
        color: '#5b8def',
        actionStandalone: () => setViewMode('social'),
      },
      {
        id: 'palette',
        title: 'Palettes',
        category: 'Look and feel',
        description: 'Colors for a story',
        icon: <Palette size={22} />,
        color: '#d9622b',
        actionStandalone: () => setShowPalettes(true),
      }
    ];

  return (
    <div
      id="home-scroll-container"
      className="home-page-container"
      style={{
        height: 'var(--app-vh)',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        position: 'relative'
      }}
    >
      <DocTabs />
      {/* top sanctuary navigation bar */}
      <header
        className="glass-panel home-header"
        style={{
          height: '60px',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--toolbar-bg)',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}
      >
        {/* brand & offline sanctuary badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BrandMark size={26} />
            <div>
              <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent-gold-text, var(--accent-gold))' }}>
                Asterism
              </span>
            </div>
          </div>


        </div>

        {/* right tools: ambient sounds, themes, points, active project jump */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* theme palette modal button */}
          <button
            onClick={() => setIsThemeModalOpen(true)}
            title="Sanctuary Theme Palette"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--badge-bg)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <Palette size={15} />
          </button>

          {/* home settings */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsHomeMenuOpen(v => !v)}
              title="Home page options"
              style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--badge-bg)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <Settings size={15} />
            </button>
            {isHomeMenuOpen && (
              <div
                className="glass-panel animate-fade-in"
                style={{ position: 'absolute', top: '120%', right: 0, width: '230px', padding: '10px', zIndex: 300, backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}
              >
                <button
                  onClick={() => { setIsHomeMenuOpen(false); setIsCustomizeOpen(true); }}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}
                >
                  <SlidersHorizontal size={14} /> Customize
                </button>
                <button
                  onClick={() => { setIsHomeMenuOpen(false); openShop(); }}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}
                >
                  <ShoppingBag size={14} /> Shop
                </button>
                <button
                  onClick={() => { setIsHomeMenuOpen(false); setIsBackupOpen(true); }}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}
                >
                  <Save size={14} /> Back up and restore
                </button>
                <button
                  onClick={() => { setIsHomeMenuOpen(false); setIsDriveOpen(true); }}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}
                >
                  <Cloud size={14} /> Bring in from Google Drive
                </button>
                <button
                  onClick={() => { setIsHomeMenuOpen(false); setIsPrivacyOpen(true); }}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}
                >
                  <ShieldCheck size={14} /> Privacy
                </button>
                <button
                  onClick={() => { setIsHomeMenuOpen(false); setIsTourOpen(true); }}
                  style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}
                >
                  <Compass size={14} /> Take the tour
                </button>
              </div>
            )}
          </div>

          {/* self-hosted P2P collaboration button */}
          <button
            onClick={() => setIsCollabModalOpen(true)}
            title="Self-Hosted Collaboration: Connect directly with co-writers or beta readers"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: liveSessions.length > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--badge-bg)',
              border: liveSessions.length > 0 ? '1px solid #10b981' : '1px solid var(--border-subtle)',
              color: liveSessions.length > 0 ? '#10b981' : 'var(--text-main)',
              fontSize: '0.8rem',
              fontWeight: liveSessions.length > 0 ? 600 : 500,
              cursor: 'pointer'
            }}
          >
            <Radio size={14} style={{ color: liveSessions.length > 0 ? '#10b981' : 'var(--accent-gold-text, var(--accent-gold))' }} />
            <span className="nav-hide-sm">{liveSessions.length > 1 ? `Collab (${liveSessions.length} sessions)` : liveSessions.length === 1 ? `Collab (${liveSessions[0].people.length})` : 'Collaborate'}</span>
          </button>

          {/* quill points badge */}
          <button
            className="nav-hide-sm"
            onClick={openShop}
            title="Quill Points. Open the shop."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-gold-bg)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: '1px solid var(--accent-gold)',
              cursor: 'pointer'
            }}
          >
            <Sparkles size={14} />
            <span>{userStats.quillPoints} QP</span>
          </button>

        </div>
      </header>

      {/* main sanctuary dashboard body */}
      <main style={{ maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '36px 24px 140px 24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

        {/* optional resume line (settings: show recent document) */}
        {userStats.home?.showRecent && (
          <button
            onClick={() => setViewMode('standard')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              padding: '10px 16px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)',
              color: 'var(--text-main)', textAlign: 'left'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <BookMarked size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </span>
            <ArrowRight size={15} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', flexShrink: 0 }} />
          </button>
        )}


        {/* section 2: manuscripts & projects library */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* header & controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
                Documents
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* search bar */}
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search titles and everything you’ve written…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 30px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-paper)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* order */}
              <select
                value={sortBy}
                onChange={e => setHomeSettings({ sort: e.target.value as NonNullable<typeof userStats.home>['sort'] })}
                aria-label="Sort documents"
                title="Sort documents"
                style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', fontSize: '0.82rem' }}
              >
                <option value="manual">Saved order</option>
                <option value="edited">Recently edited</option>
                <option value="newest">Newest created</option>
                <option value="oldest">Oldest created</option>
                <option value="az">Title A–Z</option>
                <option value="za">Title Z–A</option>
              </select>

              {/* + blank document */}
              <button
                onClick={handleCreateBlankDoc}
                title="Start writing right away"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 15px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-primary)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <Plus size={16} />
                <span>New document</span>
              </button>

              {/* + detailed document */}
              <button
                onClick={() => {
                  setNewFolder(selectedFolder !== 'all' && selectedFolder !== 'unfiled' ? selectedFolder : '');
                  setIsNewProjectModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-gold-bg)',
                  border: '1px solid var(--accent-gold)',
                  color: 'var(--accent-gold-text, var(--accent-gold))',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <FileText size={15} />
                <span>New with details</span>
              </button>

              {/* + mind map / branching story, as documents of their own */}
              <select
                aria-label="Start something else"
                value=""
                onChange={e => { if (e.target.value) createToolDoc(e.target.value as ToolKind, selectedFolder !== 'all' && selectedFolder !== 'unfiled' ? selectedFolder : undefined); }}
                style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--tag-bg)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <option value="">New other…</option>
                {TOOL_KINDS.map(k => <option key={k} value={k}>{TOOL_LABELS[k]}</option>)}
              </select>

              {/* + new folder */}
              <button
                onClick={() => {
                  setFolderNameInput('');
                  setIsNewFolderModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--tag-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <FolderPlus size={15} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                <span>New folder</span>
              </button>
            </div>
          </div>

          {/* folders row / tabs */}
          {showFolderRow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', marginRight: '4px' }}>
              Folders:
            </span>

            {/* all documents tab */}
            <button
              onClick={() => setSelectedFolder('all')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: selectedFolder === 'all' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--bg-paper)',
                color: selectedFolder === 'all' ? '#ffffff' : 'var(--text-main)',
                border: selectedFolder === 'all' ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                fontWeight: selectedFolder === 'all' ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <FolderOpen size={14} />
              <span>All Documents</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.85, backgroundColor: selectedFolder === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--badge-bg)', padding: '1px 6px', borderRadius: '10px' }}>
                {allProjects.length}
              </span>
            </button>

            {/* unfiled tab */}
            {showUnfiled && (
            <button
              onClick={() => setSelectedFolder('unfiled')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: selectedFolder === 'unfiled' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--bg-paper)',
                color: selectedFolder === 'unfiled' ? '#ffffff' : 'var(--text-main)',
                border: selectedFolder === 'unfiled' ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                fontWeight: selectedFolder === 'unfiled' ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <FileText size={14} />
              <span>Unfiled</span>
              <span style={{ fontSize: '0.72rem', opacity: 0.85, backgroundColor: selectedFolder === 'unfiled' ? 'rgba(255,255,255,0.25)' : 'var(--badge-bg)', padding: '1px 6px', borderRadius: '10px' }}>
                {unfiledCount}
              </span>
            </button>
            )}

            {/* user folders */}
            {visibleFolders.map(f => {
              const count = folderCount(f);
              const isSelected = selectedFolder === f;
              return (
                <div
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px 4px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isSelected ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--bg-paper)',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <button
                    onClick={() => setSelectedFolder(f)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      fontSize: '0.82rem',
                      fontWeight: isSelected ? 600 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 0'
                    }}
                  >
                    <Folder size={14} />
                    <span>{f}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.85, backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--badge-bg)', padding: '1px 6px', borderRadius: '10px' }}>
                      {count}
                    </span>
                  </button>

                  {/* rename / delete for active folder */}
                  {isSelected && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingFolderOldName(f);
                          setEditingFolderNewName(f);
                        }}
                        title={`Rename folder "${f}"`}
                        style={{ padding: '2px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          deleteDocumentFolder(f);
                          setSelectedFolder('all');
                        }}
                        title={`Delete folder "${f}" (documents are kept safe in Unfiled)`}
                        style={{ padding: '2px', color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}

          {/* the writer's own tags */}
          {showTagRow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={12} />
                <span>Tags:</span>
              </span>
              {tagList.map(({ tag, count }) => {
                const on = selectedTags.some(t => sameTag(t, tag));
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: on ? 600 : 500,
                      backgroundColor: on ? 'var(--accent-gold-bg)' : 'transparent', color: on ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                      border: on ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span>{tag}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>({count})</span>
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button onClick={() => setSelectedTags([])} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Clear
                </button>
              )}
              <button onClick={() => setIsTagManagerOpen(true)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                Manage tags
              </button>
            </div>
          )}

          {/* dedicated folder banner (when viewing a specific folder) */}
          {selectedFolder !== 'all' && selectedFolder !== 'unfiled' && (
            <div
              style={{
                padding: '14px 20px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--accent-gold-bg)',
                border: '1px solid var(--accent-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Folder size={20} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text-main)' }}>
                    Folder: {selectedFolder}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {filteredProjects.length} document{filteredProjects.length === 1 ? '' : 's'} • {filteredProjects.reduce((sum, p) => sum + p.chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0), 0).toLocaleString()} total words in this collection
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => createNewProject('untitled document', '', [], '', selectedFolder)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Plus size={14} />
                  <span>Add Document to this Folder</span>
                </button>
              </div>
            </div>
          )}

          {/* grid of projects */}
          {filteredProjects.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--bg-paper)',
                border: '1px dashed var(--border-strong)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <Folder size={36} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                No documents found matching these filters
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px' }}>
                {searchQuery ? `No document has all of: ${searchQuery}. Quotes keep words together, like "brass key". ` : ''}
                {selectedFolder !== 'all' ? `Current folder: "${selectedFolder}". ` : ''}
                {selectedTags.length > 0 ? `Tags: ${selectedTags.join(', ')}. ` : ''}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  onClick={() => {
                    setSelectedFolder('all');
                    setSelectedTags([]);
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--tag-bg)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
                <button
                  onClick={handleCreateBlankDoc}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  + Create Document Here
                </button>
              </div>
            </div>
          ) : (
            <div className="doc-grid">
              {filteredProjects.map(proj => (
                <DocumentCard
                  key={proj.id}
                  project={proj}
                  lastOpened={false}
                  canDelete={!!proj.kind || allProjects.filter(p => !p.kind).length > 1}
                  preview={previews.get(proj.id)}
                  hit={searching ? hits.get(proj.id) : undefined}
                  onOpen={() => (proj.kind ? openTool(proj.kind, proj.id) : openAndWrite(proj.id))}
                  onToggleTag={toggleTag}
                  activeTags={selectedTags}
                  onMove={() => setProjectToMove(proj)}
                  onEdit={() => { setEditingProjectId(proj.id); setIsDocDetailsModalOpen(true); }}
                  onBible={() => { if (proj.id !== project.id) openProject(proj.id); goToTool('bible', true); }}
                  onMindMap={() => { if (proj.id !== project.id) openProject(proj.id); openTool('mindmap'); }}
                  onAlternate={() => makeAlternateDraft(proj.id)}
                  onDraftDone={() => markDraftComplete(proj.id)}
                  onDelete={() => setProjectToDelete(proj)}
                />
              ))}
            </div>
          )}
        </section>

        {trash.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setIsTrashOpen(true)} style={{ padding: '4px 10px', fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>
              Recently deleted ({trash.length})
            </button>
          </div>
        )}

        {/* tool cards (settings: show tools) */}
        {userStats.home?.showTools && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))', gap: '10px' }}>
            {individualTools.filter(tool => isShown(userStats.home?.hiddenCards, tool.title)).map(tool => (
              <button
                key={tool.title}
                onClick={() => (tool.needsDoc ? askWhichDoc(tool.title, tool.actionStandalone) : tool.actionStandalone())}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '14px',
                  borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', textAlign: 'left', cursor: 'pointer'
                }}
              >
                <span style={{ color: tool.color, display: 'flex' }}>{tool.icon}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{tool.title}</span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{tool.description}</span>
                </span>
              </button>
            ))}
          </section>
        )}


      </main>

      {docPicker && (
        <DocPicker
          title={docPicker.title}
          docs={manuscripts}
          onClose={() => setDocPicker(null)}
          onPick={id => { const run = docPicker.run; setDocPicker(null); pickDoc(id, run); }}
        />
      )}

      {isTrashOpen && (
        <RecentlyDeleted items={trash} onRestore={restoreDeleted} onDeleteForever={deleteForever} onClose={() => setIsTrashOpen(false)} />
      )}

      {isTagManagerOpen && (
        <TagManager tags={tagList} onRename={changeTag} onDelete={tag => changeTag(tag, '')} onClose={() => setIsTagManagerOpen(false)} />
      )}

      {/* modal: start new manuscript */}
      {isNewProjectModalOpen && (
        <DialogFrame label="New document" onClose={() => setIsNewProjectModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '540px',
              maxHeight: '100%',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-xl)',
              padding: '28px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
                  Start New Manuscript
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Create an offline-first writing sanctuary for your next story.
                </p>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProjectSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="untitled document (or leave blank)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Leave blank to name it "untitled document". You can change everything later.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Author Name
                  </label>
                  <input aria-label="Author name"
                    type="text"
                    value={newAuthor}
                    onChange={e => setNewAuthor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-strong)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Tags
                  </label>
                  <TagEditor tags={newTags} onChange={setNewTags} suggestions={suggestionsFor(newTags, tagList)} />
                </div>
              </div>

              {/* how it is written */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  How will you write it?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {([
                    ['chaptered', 'Chapters', 'Separate chapters in an outline'],
                    ['open_draft', 'Open draft', 'One flowing document, with scenes instead of chapters'],
                  ] as const).map(([id, name, hint]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setNewMode(id)}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                        border: newMode === id ? '1px solid var(--accent-gold)' : '1px solid var(--border-strong)',
                        backgroundColor: newMode === id ? 'var(--accent-gold-bg)' : 'var(--bg-app)',
                        color: 'var(--text-main)',
                      }}
                    >
                      <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>You can switch later in the Outline.</div>
              </div>

              {/* a starting outline, for chapters only */}
              {newMode === 'chaptered' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Start from
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewTemplate(t.id)}
                        aria-pressed={newTemplate === t.id}
                        title={t.blurb}
                        style={{
                          padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', cursor: 'pointer',
                          border: newTemplate === t.id ? '1px solid var(--accent-gold)' : '1px solid var(--border-strong)',
                          backgroundColor: newTemplate === t.id ? 'var(--accent-gold-bg)' : 'var(--bg-app)',
                          color: newTemplate === t.id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{TEMPLATES.find(t => t.id === newTemplate)?.blurb}</div>
                </div>
              )}

              {/* folder selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder / Collection
                </label>
                <select aria-label="Folder"
                  value={newFolder}
                  onChange={e => setNewFolder(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem'
                  }}
                >
                  <option value="">(No Folder — Unfiled)</option>
                  {allFolders.map(f => (
                    <option key={f} value={f}>📁 {f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Premise / Back-Cover Synopsis
                </label>
                <textarea
                  rows={4}
                  placeholder="What is the story about? What catalyst changes the protagonist's world?"
                  value={newSynopsis}
                  onChange={e => setNewSynopsis(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-strong)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    lineHeight: 1.5,
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  Create Manuscript
                </button>
              </div>
            </form>
          </div>
        </DialogFrame>
      )}

      {/* modal: create new folder */}
      {isNewFolderModalOpen && (
        <DialogFrame label="New folder" onClose={() => setIsNewFolderModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setIsNewFolderModalOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderPlus size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-title)' }}>
                Create New Folder
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Group multiple manuscripts, acts, or stories into a unified collection.
            </p>
            <input
              type="text"
              placeholder="e.g. The Chronos Trilogy, Grimdark Shorts, Worldbuilding..."
              value={folderNameInput}
              onChange={e => setFolderNameInput(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const clean = folderNameInput.trim();
                  if (clean) {
                    createDocumentFolder(clean);
                    setSelectedFolder(clean);
                    setIsNewFolderModalOpen(false);
                    setFolderNameInput('');
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsNewFolderModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!folderNameInput.trim()}
                onClick={() => {
                  const clean = folderNameInput.trim();
                  if (clean) {
                    createDocumentFolder(clean);
                    setSelectedFolder(clean);
                    setIsNewFolderModalOpen(false);
                    setFolderNameInput('');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: folderNameInput.trim() ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--border-subtle)',
                  color: folderNameInput.trim() ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: folderNameInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Create Folder
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* modal: rename folder */}
      {editingFolderOldName && (
        <DialogFrame label="Rename folder" onClose={() => setEditingFolderOldName(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setEditingFolderOldName(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit3 size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-title)' }}>
                Rename Folder
              </h3>
            </div>
            <input
              type="text"
              value={editingFolderNewName}
              onChange={e => setEditingFolderNewName(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const clean = editingFolderNewName.trim();
                  if (clean && clean !== editingFolderOldName) {
                    renameDocumentFolder(editingFolderOldName, clean);
                    setSelectedFolder(clean);
                  }
                  setEditingFolderOldName(null);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setEditingFolderOldName(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = editingFolderNewName.trim();
                  if (clean && clean !== editingFolderOldName) {
                    renameDocumentFolder(editingFolderOldName, clean);
                    setSelectedFolder(clean);
                  }
                  setEditingFolderOldName(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save Name
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* modal: move project to folder */}
      {projectToMove && (
        <DialogFrame label="Move document" onClose={() => setProjectToMove(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setProjectToMove(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-title)' }}>
                Move "{projectToMove.title}"
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Select a folder collection for this manuscript or keep it unfiled.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {/* unfiled option */}
              <button
                onClick={() => {
                  moveProjectToFolder(projectToMove.id, null);
                  setProjectToMove(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: !projectToMove.folder ? 'var(--accent-gold-bg)' : 'var(--bg-card)',
                  border: !projectToMove.folder ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={15} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.86rem' }}>(No Folder — Unfiled)</span>
                </div>
                {!projectToMove.folder && <Check size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
              </button>

              {/* all folder options */}
              {allFolders.map(f => {
                const isCurrent = projectToMove.folder === f;
                return (
                  <button
                    key={f}
                    onClick={() => {
                      moveProjectToFolder(projectToMove.id, f);
                      setProjectToMove(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isCurrent ? 'var(--accent-gold-bg)' : 'var(--bg-card)',
                      border: isCurrent ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Folder size={15} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                      <span style={{ fontSize: '0.86rem', fontWeight: isCurrent ? 600 : 400 }}>{f}</span>
                    </div>
                    {isCurrent && <Check size={16} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setProjectToMove(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* modal: delete project confirmation */}
      {projectToDelete && (
        <DialogFrame label="Delete document" onClose={() => setProjectToDelete(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-paper)',
              borderRadius: 'var(--radius-xl)',
              padding: '26px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-title)', color: '#ef4444' }}>
              Delete this document?
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong>"{projectToDelete.title}"</strong> moves to Recently deleted. You can restore it for 30 days.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setProjectToDelete(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                Keep it
              </button>

              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* theme modal */}
      <ThemeSelectorModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
      {showPalettes && <PaletteTool onClose={() => setShowPalettes(false)} />}
      <CollaborationModal />
      {/* modal: document details & metadata editor */}
      <DocumentDetailsModal
        isOpen={isDocDetailsModalOpen}
        onClose={() => {
          setIsDocDetailsModalOpen(false);
          setEditingProjectId(null);
        }}
        targetProjectId={editingProjectId || undefined}
      />
      <BackupModal isOpen={isBackupOpen} onClose={() => setIsBackupOpen(false)} />
      <TourModal />
      <SyncModal isOpen={isDriveOpen} onClose={() => setIsDriveOpen(false)} fromHome />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
      <CustomizeModal isOpen={isCustomizeOpen} onClose={() => setIsCustomizeOpen(false)} cards={individualTools.map(t => ({ id: t.title, label: t.title }))} />
      {padPickerOpen && <ScratchpadPicker onClose={() => setPadPickerOpen(false)} />}
    </div>
  );
};
