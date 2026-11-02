import { ambientLabel } from '../../services/soundscapes';
import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import type { SidebarTab } from '../../types';
import { StoryBiblePanel } from '../Sidebar/StoryBiblePanel';
import { FoundationsDeck } from '../Sidebar/FoundationsDeck';
import { PlotThreadsPanel } from '../Sidebar/PlotThreadsPanel';
import { TimelinePanel } from '../Sidebar/TimelinePanel';
import { StoryAnalyzerPanel } from '../Analyzer/StoryAnalyzerPanel';
import { GoalsRewardsPanel } from '../Sidebar/GoalsRewardsPanel';
import { CommentsDrawer } from '../Comments/CommentsDrawer';
import { ThemeSelectorModal } from '../Header/ThemeSelectorModal';
import { BrandMark } from '../Common/BrandMark';
import {
  Home,
  PenTool,
  Users,
  Compass,
  GitBranch,
  CalendarClock,
  Brain,
  Network,
  Trophy,
  MessageSquare,
  Palette,
  Sparkles,
  Volume2,
  VolumeX,
  CloudRain,
  Flame,
  Coffee,
    ChevronRight, Wind } from 'lucide-react';

export const StandaloneToolView: React.FC = () => {
  const {
    project,
    sidebarTab,
    setSidebarTab,
    setViewMode,
    openTool,
    userStats,
    setAmbientSound
  } = useAsterism();

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);

  const tools: Array<{ id: SidebarTab; label: string; icon: React.ReactNode; desc: string }> = [
    { id: 'foundations', label: 'Foundations', icon: <Compass size={16} />, desc: 'Story DNA, Prompts & Creative Brainstorming' },
    { id: 'bible', label: 'Story Bible', icon: <Users size={16} />, desc: 'Characters, Motivations, Secrets, Locations & Lore' },
    { id: 'threads', label: 'Plot Threads', icon: <GitBranch size={16} />, desc: 'Mysteries, Narrative Setups & Clue Payoffs' },
    { id: 'timeline', label: 'Timeline', icon: <CalendarClock size={16} />, desc: 'What Happens When, Flashbacks & Date Checks' },
    { id: 'analyzer', label: 'Story Analyzer', icon: <Brain size={16} />, desc: 'Offline Continuity Radar, Contradictions & Rules' },
    { id: 'goals', label: 'Goals & Shop', icon: <Trophy size={16} />, desc: 'Writing Milestones, Streaks & Quill Rewards' },
    { id: 'comments', label: 'Comments', icon: <MessageSquare size={16} />, desc: 'In-Document Annotations & Review Notes' },
  ];

  const soundOptions = [
    { id: 'off', label: 'Silence', icon: <VolumeX size={15} /> },
    { id: 'rain', label: 'Rain on Glass', icon: <CloudRain size={15} /> },
    { id: 'wind', label: 'Wind Through Trees', icon: <Wind size={15} /> },
    { id: 'fire', label: 'Actual Crackling Fire', icon: <Flame size={15} /> },
    { id: 'library', label: 'Library Drone', icon: <Coffee size={15} /> },
    ...(userStats.customSoundscapes || []).map(s => ({ id: s.id, label: s.name, icon: <Volume2 size={15} /> })),
  ];

  const currentTool = tools.find(t => t.id === sidebarTab) || tools[0];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-app)'
      }}
    >
      {/* top header */}
      <header
        className="glass-panel"
        style={{
          height: '56px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--toolbar-bg)',
          zIndex: 100,
          flexShrink: 0,
          userSelect: 'none'
        }}
      >
        {/* left: home button & project context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setViewMode('home')}
            title="Return to Asterism Home"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-gold-bg)',
              border: '1px solid var(--accent-gold)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Home size={15} />
            <span>Home</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1.15rem', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--accent-gold-text, var(--accent-gold))' }}>
              <BrandMark size={18} /> Asterism
            </span>
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {project.title}
            </span>
          </div>
        </div>

        {/* center: tool switcher tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-paper)',
            padding: '3px 4px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {tools.map(tool => {
            const isActive = sidebarTab === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setSidebarTab(tool.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 11px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--accent-gold-bg)' : 'transparent',
                  border: isActive ? '1px solid var(--accent-gold)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {tool.icon}
                <span>{tool.label}</span>
              </button>
            );
          })}

          {/* quick jump to mind map canvas */}
          <button
            onClick={() => openTool('mindmap')}
            title="Launch Interactive 2D Story Mind Map"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Network size={16} />
            <span>Mind Map</span>
          </button>
        </div>

        {/* right: soundscapes, themes, points & open Word processor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* ambient sound dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
              title="Sensory Audio Soundscapes"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: userStats.ambientSound !== 'off' ? 'var(--accent-gold-bg)' : 'var(--badge-bg)',
                border: userStats.ambientSound !== 'off' ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                color: userStats.ambientSound !== 'off' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {userStats.ambientSound !== 'off' ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span>{ambientLabel(userStats.ambientSound, userStats.customSoundscapes)}</span>
            </button>

            {isAudioMenuOpen && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '180px',
                  backgroundColor: 'var(--bg-paper)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                {soundOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setAmbientSound(opt.id);
                      setIsAudioMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      color: userStats.ambientSound === opt.id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
                      backgroundColor: userStats.ambientSound === opt.id ? 'var(--accent-gold-bg)' : 'transparent',
                      textAlign: 'left'
                    }}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* theme selector */}
          <button
            onClick={() => setIsThemeModalOpen(true)}
            title="Sanctuary Theme Palette"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--badge-bg)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <Palette size={15} />
            <span style={{ textTransform: 'capitalize' }}>{userStats.activeTheme}</span>
          </button>

          {/* quill points badge */}
          <div
            title="Quill Points earned through writing and story crafting"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-gold-bg)',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: '1px solid var(--accent-gold)'
            }}
          >
            <Sparkles size={14} />
            <span>{userStats.quillPoints} QP</span>
          </div>

          {/* action: open in Word processor */}
          <button
            onClick={() => setViewMode('standard')}
            title="Open manuscript in the Word Processor"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--transition-fast)'
            }}
          >
            <PenTool size={14} />
            <span>Word Processor</span>
          </button>
        </div>
      </header>

      {/* main spacious tool workspace */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 20px',
          background: 'linear-gradient(180deg, var(--bg-app) 0%, var(--bg-paper) 100%)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1180px',
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* tool title banner */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 24px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-paper)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-gold-bg)',
                  color: 'var(--accent-gold-text, var(--accent-gold))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--accent-gold)'
                }}
              >
                {currentTool.icon}
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
                  {currentTool.label}
                </h1>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {currentTool.desc}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setViewMode('standard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--tag-bg)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <PenTool size={14} />
                <span>Write in Document</span>
              </button>
            </div>
          </div>

          {/* active tool content */}
          <div
            className="glass-panel"
            style={{
              flex: 1,
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-paper)',
              overflowY: 'auto',
              minHeight: '500px'
            }}
          >
            {sidebarTab === 'bible' && <StoryBiblePanel />}
            {sidebarTab === 'foundations' && <FoundationsDeck />}
            {sidebarTab === 'threads' && <PlotThreadsPanel />}
            {sidebarTab === 'timeline' && <TimelinePanel />}
            {sidebarTab === 'analyzer' && <StoryAnalyzerPanel />}
            {sidebarTab === 'goals' && <GoalsRewardsPanel />}
            {sidebarTab === 'comments' && <CommentsDrawer />}
          </div>
        </div>
      </main>

      {/* theme modal */}
      <ThemeSelectorModal isOpen={isThemeModalOpen} onClose={() => setIsThemeModalOpen(false)} />
    </div>
  );
};
