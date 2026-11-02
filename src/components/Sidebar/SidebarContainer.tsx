import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { SidebarTab } from '../../types';
import { ChapterList } from './ChapterList';
import { StoryBiblePanel } from './StoryBiblePanel';
import { FoundationsDeck } from './FoundationsDeck';
import { PlotThreadsPanel } from './PlotThreadsPanel';
import { TimelinePanel } from './TimelinePanel';
import { GoalsRewardsPanel } from './GoalsRewardsPanel';
import { useNarrow } from '../Common/useNarrow';
import { CommentsDrawer } from '../Comments/CommentsDrawer';
import { CoachPanel } from '../Coach/CoachPanel';
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
  Maximize2
} from 'lucide-react';

export const SidebarContainer: React.FC = () => {
  const { sidebarTab, setSidebarTab, isSidebarOpen, toggleSidebar, openTool } = useAsterism();
  const narrow = useNarrow();

  if (!isSidebarOpen) return null;

  const tabs: Array<{ id: SidebarTab; label: string; icon: React.ReactNode }> = [
    { id: 'chapters', label: 'Outline', icon: <BookOpen size={15} /> },
    { id: 'bible', label: 'Bible', icon: <Users size={15} /> },
    { id: 'foundations', label: 'Cards', icon: <Compass size={15} /> },
    { id: 'threads', label: 'Threads', icon: <GitBranch size={15} /> },
    { id: 'timeline', label: 'Timeline', icon: <CalendarClock size={15} /> },
    { id: 'coach', label: 'Coach', icon: <Sparkles size={15} /> },
    { id: 'analyzer', label: 'Analyzer', icon: <Brain size={15} /> },
    { id: 'comments', label: 'Notes', icon: <MessageSquare size={15} /> },
    { id: 'goals', label: 'Goals', icon: <Trophy size={15} /> },
    { id: 'mindmap', label: 'Map', icon: <Network size={15} /> }
  ];

  // on a small window the sidebar slides over the writing instead of squeezing it
  const drawer: React.CSSProperties = narrow
    ? { position: 'fixed', top: '56px', bottom: 0, left: 0, zIndex: 95, width: 'min(350px, 88vw)', boxShadow: 'var(--shadow-xl)' }
    : { width: '350px', height: 'calc(100vh - 56px)' };

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
          gridTemplateColumns: 'repeat(5, 1fr)',
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
      </div>

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
