import React, { useState, useEffect, useMemo } from 'react';
import { RevisionDiffView } from './RevisionDiffView';
import { useAsterism } from '../../context/AsterismContext';
import type { DocumentVersion } from '../../types';
import {
  History,
  RotateCcw,
  Copy,
  Trash2,
  Edit3,
  Check,
  Clock,
  ShieldAlert,
  Bookmark,
  Sparkles,
  Plus,
  X,
  FileText,
  Filter,
  GitCompare,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { useDialog } from '../Common/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    project,
    versions,
    createManualSnapshot,
    restoreVersion,
    deleteVersionSnapshot,
    renameVersionSnapshot,
    duplicateVersionAsNewProject,
    lastAutosaveTime
  } = useAsterism();

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [filterNamedOnly, setFilterNamedOnly] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  
  // inline naming / snapshot creation state
  const [isNamingNew, setIsNamingNew] = useState(false);
  const [newVersionTitle, setNewVersionTitle] = useState('');
  
  // inline renaming state for existing versions
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // confirmation modal state for restoration
  const [confirmRestoreVersion, setConfirmRestoreVersion] = useState<DocumentVersion | null>(null);

  // close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmRestoreVersion) {
          setConfirmRestoreVersion(null);
        } else if (isNamingNew) {
          setIsNamingNew(false);
        } else if (editingVersionId) {
          setEditingVersionId(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmRestoreVersion, isNamingNew, editingVersionId]);

  // filtered versions list
  const filteredVersions = useMemo(() => {
    if (!filterNamedOnly) return versions;
    return versions.filter(v => v.trigger === 'manual' || v.trigger === 'safety_net' || v.trigger === 'milestone');
  }, [versions, filterNamedOnly]);

  // set default selected version when modal opens or versions change
  useEffect(() => {
    if (isOpen && versions.length > 0) {
      if (!selectedVersionId || !versions.some(v => v.id === selectedVersionId)) {
        setSelectedVersionId(versions[0].id);
      }
    }
  }, [isOpen, versions, selectedVersionId]);

  // selected version object
  const activeVersion = useMemo(() => {
    return versions.find(v => v.id === selectedVersionId) || versions[0] || null;
  }, [versions, selectedVersionId]);

  // sync selected chapter
  useEffect(() => {
    if (activeVersion && activeVersion.chapters.length > 0) {
      if (!selectedChapterId || !activeVersion.chapters.some(c => c.id === selectedChapterId)) {
        setSelectedChapterId(activeVersion.chapters[0].id);
      }
    }
  }, [activeVersion, selectedChapterId]);

  const activeChapter = useMemo(() => {
    if (!activeVersion || !activeVersion.chapters.length) return null;
    return activeVersion.chapters.find(c => c.id === selectedChapterId) || activeVersion.chapters[0];
  }, [activeVersion, selectedChapterId]);

  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, false);

  if (!isOpen) return null;

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newVersionTitle.trim();
    createManualSnapshot(title || undefined);
    setNewVersionTitle('');
    setIsNamingNew(false);
  };

  const handleStartRename = (v: DocumentVersion, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVersionId(v.id);
    setEditingTitleText(v.title);
  };

  const handleSaveRename = (versionId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editingTitleText.trim()) {
      renameVersionSnapshot(versionId, editingTitleText.trim());
    }
    setEditingVersionId(null);
  };

  const formatTimestamp = (isoStr: string) => {
    const d = new Date(isoStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (isToday) {
      return `Today at ${time}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  };

  const renderTriggerBadge = (trigger: DocumentVersion['trigger']) => {
    switch (trigger) {
      case 'safety_net':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              fontSize: '0.68rem',
              fontWeight: 600
            }}
            title="Automatically saved before a large text deletion took place"
          >
            <ShieldAlert size={11} />
            <span>Safety Net</span>
          </span>
        );
      case 'manual':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontSize: '0.68rem',
              fontWeight: 600
            }}
          >
            <Bookmark size={11} />
            <span>Named</span>
          </span>
        );
      case 'milestone':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#8b5cf6',
              fontSize: '0.68rem',
              fontWeight: 600
            }}
          >
            <Sparkles size={11} />
            <span>Milestone</span>
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--tag-bg)',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              fontWeight: 500
            }}
          >
            <Clock size={11} />
            <span>Autosave</span>
          </span>
        );
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Version history"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(5px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '88vh',
          backgroundColor: 'var(--bg-app)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* top header */}
        <div
          style={{
            height: '56px',
            padding: '0 20px',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--toolbar-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-gold-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-gold-text, var(--accent-gold))'
              }}
            >
              <History size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Version History
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>
                  {project.title}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {versions.length} total snapshots saved • Last autosaved: {lastAutosaveTime ? lastAutosaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* quick button to name current version */}
            <button
              onClick={() => setIsNamingNew(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <Plus size={14} />
              <span>Name Current Version</span>
            </button>

            <button
              onClick={onClose}
              title="Close Version History (Esc)"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--tag-bg)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* modal body: 2 columns (left preview 68%, right version list 32%) */}
        <div className="history-body" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          
          {/* left: version preview pane */}
          <div
            className="history-preview"
            style={{
              flex: '1 1 68%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-paper)',
              borderRight: '1px solid var(--border-subtle)',
              minHeight: 0
            }}
          >
            {activeVersion ? (
              <>
                {/* preview toolbar */}
                <div
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-app)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-main)' }}>
                        {activeVersion.title}
                      </span>
                      {renderTriggerBadge(activeVersion.trigger)}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Snapshot created {formatTimestamp(activeVersion.createdAt)} • {activeVersion.wordCount} words • {activeVersion.chapterCount} chapters
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setShowChanges(v => !v)}
                      aria-pressed={showChanges}
                      title="Compare this version with your draft now"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 11px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: showChanges ? 'var(--accent-gold-bg)' : 'var(--badge-bg)',
                        border: showChanges ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                        color: showChanges ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      <GitCompare size={13} />
                      <span>Show changes</span>
                    </button>

                    {/* duplicate as new document button */}
                    <button
                      onClick={() => duplicateVersionAsNewProject(activeVersion.id)}
                      title="Make a separate copy of this snapshot as a new document"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 11px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--badge-bg)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      <Copy size={13} />
                      <span>Make a copy</span>
                    </button>

                    {/* restore button */}
                    <button
                      onClick={() => setConfirmRestoreVersion(activeVersion)}
                      title="Restore the document to this exact snapshot"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Restore this version</span>
                    </button>
                  </div>
                </div>

                {/* chapter selector tabs (if multiple chapters exist) */}
                {!showChanges && activeVersion.chapters.length > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 20px',
                      backgroundColor: 'var(--bg-app)',
                      borderBottom: '1px solid var(--border-subtle)',
                      overflowX: 'auto'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '6px' }}>
                      Chapter:
                    </span>
                    {activeVersion.chapters.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSelectedChapterId(ch.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.74rem',
                          fontWeight: selectedChapterId === ch.id ? 600 : 400,
                          backgroundColor: selectedChapterId === ch.id ? 'var(--accent-gold-bg)' : 'transparent',
                          color: selectedChapterId === ch.id ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                          border: selectedChapterId === ch.id ? '1px solid var(--accent-gold)' : '1px solid transparent',
                          cursor: 'pointer'
                        }}
                      >
                        <FileText size={12} />
                        <span>{ch.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* chapter prose reader preview */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '30px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '720px',
                      backgroundColor: 'var(--bg-paper)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-main)',
                      lineHeight: 1.8,
                      fontSize: '1.05rem',
                      fontFamily: 'var(--font-body)'
                    }}
                  >
                    {showChanges ? (
                      <RevisionDiffView older={activeVersion.chapters} newer={project.chapters} />
                    ) : activeChapter ? (
                      <>
                        <h3
                          style={{
                            fontFamily: 'var(--font-title)',
                            fontSize: '1.4rem',
                            fontWeight: 700,
                            marginBottom: '16px',
                            color: 'var(--text-main)',
                            borderBottom: '1px solid var(--border-subtle)',
                            paddingBottom: '8px'
                          }}
                        >
                          {activeChapter.title}
                        </h3>

                        {activeChapter.content && activeChapter.content.trim() ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: activeChapter.content }}
                            style={{
                              wordBreak: 'break-word',
                              userSelect: 'text'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              fontStyle: 'italic',
                              color: 'var(--text-muted)',
                              padding: '20px 0',
                              textAlign: 'center'
                            }}
                          >
                            (This chapter had no written content in this snapshot)
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                        No chapter selected
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center'
                }}
              >
                <History size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.6 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                  No Snapshots Recorded Yet
                </h3>
                <p style={{ maxWidth: '420px', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                  Asterism saves periodic snapshots and backups before big deletions. You can also name a snapshot anytime.
                </p>
                <button
                  onClick={() => createManualSnapshot('Initial Checkpoint')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} />
                  <span>Create First Named Checkpoint</span>
                </button>
              </div>
            )}
          </div>

          {/* right: versions list sidebar */}
          <div
            className="history-list"
            style={{
              flex: '0 0 32%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-app)',
              minHeight: 0
            }}
          >
            {/* sidebar controls */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Snapshots ({filteredVersions.length})
                </span>

                <button
                  onClick={() => setFilterNamedOnly(!filterNamedOnly)}
                  title={filterNamedOnly ? "Showing named & safety snapshots only. Click to show all." : "Showing all snapshots. Click to show only named & safety snapshots."}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: filterNamedOnly ? 'var(--accent-gold-bg)' : 'var(--tag-bg)',
                    color: filterNamedOnly ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                >
                  <Filter size={11} />
                  <span>{filterNamedOnly ? 'Named & Safety Only' : 'All Versions'}</span>
                </button>
              </div>

              {/* inline name new version form */}
              {isNamingNew && (
                <form
                  onSubmit={handleCreateSnapshot}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--badge-bg)',
                    border: '1px solid var(--accent-gold)'
                  }}
                >
                  <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))' }}>
                    Name this snapshot:
                  </div>
                  <input
                    type="text"
                    autoFocus
                    placeholder="e.g. Pre-Edit Draft, After Chapter 3 revision..."
                    value={newVersionTitle}
                    onChange={e => setNewVersionTitle(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-paper)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setIsNamingNew(false)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.74rem',
                        color: 'var(--text-secondary)',
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--accent-primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={12} />
                      <span>Save</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* list of version cards */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {filteredVersions.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No snapshots match this filter.
                </div>
              ) : (
                filteredVersions.map((ver, idx) => {
                  const isSelected = ver.id === selectedVersionId;
                  const isEditingThis = ver.id === editingVersionId;
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={ver.id}
                      onClick={() => setSelectedVersionId(ver.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isSelected ? 'var(--bg-paper)' : 'var(--badge-bg)',
                        border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                        boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {/* card title & edit icon */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                        {isEditingThis ? (
                          <form
                            onSubmit={e => handleSaveRename(ver.id, e)}
                            onClick={e => e.stopPropagation()}
                            style={{ display: 'flex', gap: '4px', flex: 1 }}
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingTitleText}
                              onChange={e => setEditingTitleText(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '2px 6px',
                                fontSize: '0.8rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--accent-gold)',
                                backgroundColor: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                outline: 'none'
                              }}
                            />
                            <button
                              type="submit"
                              style={{
                                padding: '3px 6px',
                                backgroundColor: 'var(--accent-primary)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer'
                              }}
                            >
                              <Check size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingVersionId(null)}
                              style={{
                                padding: '3px 6px',
                                background: 'none',
                                color: 'var(--text-muted)',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={11} />
                            </button>
                          </form>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: isSelected ? 700 : 600,
                                color: isSelected ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-main)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {ver.title}
                            </span>
                            {isLatest && (
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  fontWeight: 600
                                }}
                              >
                                Latest
                              </span>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={e => handleStartRename(ver, e)}
                            title="Rename snapshot"
                            style={{
                              padding: '3px',
                              color: 'var(--text-muted)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm('Delete this version snapshot? This cannot be undone.')) {
                                deleteVersionSnapshot(ver.id);
                              }
                            }}
                            title="Delete this snapshot"
                            style={{
                              padding: '3px',
                              color: 'var(--text-muted)',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* timestamp & trigger */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>{formatTimestamp(ver.createdAt)}</span>
                        {renderTriggerBadge(ver.trigger)}
                      </div>

                      {/* stats */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', paddingTop: '4px', borderTop: '1px solid var(--border-subtle)' }}>
                        <span>{ver.wordCount.toLocaleString()} words</span>
                        <span>{ver.chapterCount} {ver.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* reversion confirmation dialog */}
      {confirmRestoreVersion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 2100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--bg-app)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: '#10b981' }}>
              <RotateCcw size={22} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Restore this version?
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Your document will revert to <strong>"{confirmRestoreVersion.title}"</strong> ({formatTimestamp(confirmRestoreVersion.createdAt)}).
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                marginBottom: '20px',
                fontSize: '0.78rem',
                color: 'var(--text-main)'
              }}
            >
              <Check size={14} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Zero risk:</strong> A safety backup of your <em>current</em> document state will be created automatically before restoring, so you can revert anytime.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmRestoreVersion(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.84rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  restoreVersion(confirmRestoreVersion.id);
                  setConfirmRestoreVersion(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <RotateCcw size={14} />
                <span>Yes, Restore Version</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
