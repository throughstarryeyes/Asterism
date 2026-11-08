import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { SidebarTab, DocToolbox } from '../../types';
import { ChapterList } from './ChapterList';
import { StoryBiblePanel } from './StoryBiblePanel';
import { FoundationsDeck } from './FoundationsDeck';
import { PlotThreadsPanel } from './PlotThreadsPanel';
import { TimelinePanel } from './TimelinePanel';
import { GoalsRewardsPanel } from './GoalsRewardsPanel';
import { useNarrow } from '../Common/useNarrow';
import { CommentsDrawer } from '../Comments/CommentsDrawer';
import { CoachPanel } from '../Coach/CoachPanel';
import { ScratchpadPanel } from './ScratchpadPanel';
import { StoryAnalyzerPanel } from '../Analyzer/StoryAnalyzerPanel';
import { 
  BookOpen, 
  Users, 
  Compass, 
  GitBranch, 
  CalendarClock,
  Trophy, 
  Network, 
  Brain, 
  MessageSquare,
  Sparkles,
  Maximize2,
  StickyNote,
  SlidersHorizontal
} from 'lucide-react';

export const SidebarContainer: React.FC = () => {
  const { sidebarTab, setSidebarTab, isSidebarOpen, toggleSidebar, openTool, project, setToolbox } = useAsterism();
  const narrow = useNarrow();
  const [editing, setEditing] = React.useState(false);

  if (!isSidebarOpen) return null;

  const allTabs: Array<{ id: SidebarTab; label: string; icon: React.ReactNode }> = [
    { id: 'chapters', label: 'Outline', icon: <BookOpen size={15} /> },
    { id: 'bible', label: 'Bible', icon: <Users size={15} /> },
    { id: 'foundations', label: 'Cards', icon: <Compass size={15} /> },
    { id: 'threads', label: 'Threads', icon: <GitBranch size={15} /> },
    { id: 'timeline', label: 'Timeline', icon: <CalendarClock size={15} /> },
    { id: 'coach', label: 'Coach', icon: <Sparkles size={15} /> },
    { id: 'analyzer', label: 'Analyzer', icon: <Brain size={15} /> },
    { id: 'comments', label: 'Notes', icon: <MessageSquare size={15} /> },
    { id: 'goals', label: 'Goals', icon: <Trophy size={15} /> },
    { id: 'scratchpad', label: 'Pads', icon: <StickyNote size={15} /> },
    { id: 'mindmap', label: 'Map', icon: <Network size={15} /> }
  ];
  // this document's own choice of tools; the tool that is open can never be the one hidden
  const hidden = project.toolbox?.hiddenTabs ?? [];
  const tabs = allTabs.filter(t => !hidden.includes(t.id) || t.id === sidebarTab);
  const toggleTab = (id: SidebarTab) => setToolbox({ hiddenTabs: hidden.includes(id) ? hidden.filter(h => h !== id) : [...hidden, id] });

  // on a small window the sidebar slides over the writing instead of squeezing it
  const drawer: React.CSSProperties = narrow
    ? { position: 'fixed', top: '56px', bottom: 0, left: 0, zIndex: 95, width: 'min(350px, 88vw)', boxShadow: 'var(--shadow-xl)' }
    : { width: '350px', alignSelf: 'stretch' };

  return (
    <>
    {narrow && <button aria-label="Close the sidebar" tabIndex={-1} onClick={toggleSidebar} style={{ position: 'fixed', inset: '56px 0 0 0', zIndex: 94, backgroundColor: 'rgba(0,0,0,0.4)', cursor: 'default' }} />}
    <aside
      className="glass-panel"
      style={{
        ...drawer,
        borderRight: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* primary tab navigation */}
      <div
        role="tablist"
        aria-label="Story tools"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-paper)'
        }}
      >
        {tabs.map(tab => {
          const isActive = sidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              title={tab.label}
              onClick={() => {
                if (tab.id === 'mindmap') {
                  openTool('mindmap');
                } else {
                  setSidebarTab(tab.id);
                }
              }}
              style={{
                padding: '8px 2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                borderBottom: isActive ? '2px solid var(--accent-gold)' : '2px solid transparent',
                color: isActive ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--accent-gold-bg)' : 'transparent',
                fontSize: '0.68rem',
                fontWeight: isActive ? 600 : 500,
                transition: 'all var(--transition-fast)'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          title="Choose the tools this document shows"
          aria-label="Choose the tools this document shows"
          aria-pressed={editing}
          onClick={() => setEditing(v => !v)}
          style={{ padding: '8px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: editing ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-muted)' }}
        >
          <SlidersHorizontal size={15} />
          <span>Edit</span>
        </button>
      </div>

      {editing && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Tools in this document's sidebar</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {allTabs.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={!hidden.includes(t.id)} disabled={t.id === sidebarTab} onChange={() => toggleTab(t.id)} /> {t.label}
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Open with
            <select value={project.toolbox?.openTab ?? ''} onChange={e => setToolbox({ openTab: (e.target.value || undefined) as DocToolbox['openTab'] })} style={{ padding: '4px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: 'var(--text-main)' }}>
              <option value="">Whatever was open</option>
              <option value="closed">Sidebar closed</option>
              {allTabs.filter(t => t.id !== 'mindmap' && !hidden.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* active panel content */}
      <div role="tabpanel" aria-label={tabs.find(t => t.id === sidebarTab)?.label} style={{ flex: 1, padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {sidebarTab === 'chapters' && <ChapterList />}
        {sidebarTab === 'bible' && <StoryBiblePanel />}
        {sidebarTab === 'foundations' && <FoundationsDeck />}
        {sidebarTab === 'threads' && <PlotThreadsPanel />}
        {sidebarTab === 'timeline' && <TimelinePanel />}
        {sidebarTab === 'coach' && <CoachPanel />}
        {sidebarTab === 'analyzer' && <StoryAnalyzerPanel />}
        {sidebarTab === 'comments' && <CommentsDrawer />}
        {sidebarTab === 'scratchpad' && <ScratchpadPanel />}
        {sidebarTab === 'goals' && <GoalsRewardsPanel />}
        {sidebarTab === 'mindmap' && (
          <div style={{ textAlign: 'center', padding: '30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <Network size={36} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>Interactive Story Mind Map</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Plot relationships, character arcs and clues on an infinite canvas with arrows.
            </p>
            <button
              onClick={() => openTool('mindmap')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <Maximize2 size={16} />
              <span>Open Mind Map Canvas</span>
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
