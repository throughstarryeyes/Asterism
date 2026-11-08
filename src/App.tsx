import { LiveBanner } from './components/Common/LiveBanner';
import { UpdateBanner } from './components/Common/UpdateBanner';
import React, { useState, useEffect } from 'react';
import { AsterismProvider, useAsterism } from './context/AsterismContext';
import { NavigationBar } from './components/Header/NavigationBar';
import { FormattingToolbar } from './components/Editor/FormattingToolbar';
import { WritingCanvas } from './components/Editor/WritingCanvas';
import { DistractionFreeView } from './components/Editor/DistractionFreeView';
import { BookView } from './components/Book/BookView';
import { CoverView } from './components/Cover/CoverView';
import { MindMapCanvas } from './components/MindMap/MindMapCanvas';
import { BranchingView } from './components/Branching/BranchingView';
import { PromptLabView } from './components/Prompts/PromptLabView';
import { PlayView } from './components/Play/PlayView';
import { ShopPage } from './components/Shop/ShopPage';
import { SocialPage } from './components/Social/SocialPage';
import { CursorTrail } from './components/Common/CursorTrail';
import { HomePage } from './components/Home/HomePage';
import { SheetView } from './components/Sheet/SheetView';
import { CardsView } from './components/Sheet/CardsView';
import { StandaloneToolView } from './components/Standalone/StandaloneToolView';
import { SidebarContainer } from './components/Sidebar/SidebarContainer';
import { ToastNotification } from './components/Common/ToastNotification';
import { FileUp, Sparkles } from 'lucide-react';
import { ScratchpadsPage } from './components/Scratchpads/ScratchpadsPage';
import { DocTabs } from './components/Common/DocTabs';
import { FloatingScratchpads } from './components/Common/FloatingScratchpads';
import { useBackNavigation } from './components/Common/useBackNavigation';
import { useAutoScale } from './components/Common/useAutoScale';

const AsterismApp: React.FC = () => {
  const { viewMode, setViewMode, setSidebarTab, importManuscriptFile, project } = useAsterism();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  useAutoScale();

  useBackNavigation(viewMode, setViewMode);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDraggingOver(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        await importManuscriptFile(file);
        setViewMode('standard');
        setSidebarTab('analyzer');
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [importManuscriptFile, setViewMode, setSidebarTab]);

  const dragOverlay = isDraggingOver && (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 60px',
          borderRadius: 'var(--radius-lg)',
          border: '3px dashed var(--accent-gold)',
          backgroundColor: 'var(--bg-app)',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          maxWidth: '520px'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-gold-bg)',
            color: 'var(--accent-gold-text, var(--accent-gold))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}
        >
          <FileUp size={32} />
        </div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>
          Drop Manuscript to Import
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Supports <strong>.txt</strong>, <strong>.md</strong>, and <strong>.json</strong>. Chapters will be detected and automatically analyzed for story continuity!
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 }}>
          <Sparkles size={14} />
          <span>Instant Narrative Continuity Audit</span>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'home') {
    return (
      <>
        <HomePage />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'shop') {
    return (
      <>
        <ShopPage />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'scratchpads') {
    return (
      <>
        <ScratchpadsPage />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'prompt_lab') {
    return (
      <>
        <PromptLabView />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'play') {
    return (
      <>
        <PlayView />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'tool') {
    return (
      <>
        <StandaloneToolView />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'distraction_free') {
    return (
      <>
        <DistractionFreeView />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'cover') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', width: '100%', overflow: 'hidden' }}>
        <NavigationBar />
        <CoverView />
        <ToastNotification />
      </div>
    );
  }

  if (viewMode === 'social') {
    return (
      <>
        <SocialPage />
        <ToastNotification />
      </>
    );
  }

  if (viewMode === 'book_preview') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', width: '100%', overflow: 'hidden' }}>
        <NavigationBar />
        <BookView />
        <ToastNotification />
        {dragOverlay}
      </div>
    );
  }

  if (viewMode === 'branching') {
    return (
      <>
        <BranchingView />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'sheet' || viewMode === 'cards') {
    return (
      <>
        {viewMode === 'sheet' ? <SheetView /> : <CardsView />}
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  if (viewMode === 'mindmap') {
    return (
      <>
        <MindMapCanvas />
        <ToastNotification />
        {dragOverlay}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', width: '100%', overflow: 'hidden' }}>
      <a className="skip-link" href="#writing-area">Skip to writing</a>
      <NavigationBar />
      <DocTabs />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <SidebarContainer />
        <main id="writing-area" tabIndex={-1} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', outline: 'none' }}>
          <h1 className="sr-only">{project.title}</h1>
          <FormattingToolbar />
          <WritingCanvas />
        </main>
      </div>
      <ToastNotification />
      {dragOverlay}
    </div>
  );
};

export function App() {
  return (
    <AsterismProvider>
      <AsterismApp />
      <CursorTrail />
      <FloatingScratchpads />
      <LiveBanner />
      <UpdateBanner />
    </AsterismProvider>
  );
}

export default App;
