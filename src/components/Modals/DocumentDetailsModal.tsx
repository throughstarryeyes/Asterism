import React, { useState, useEffect } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { X, User, BookOpen, Check, AlignLeft, Folder } from 'lucide-react';
import { TagEditor } from '../Common/TagEditor';
import { suggestionsFor, tagCounts, withGenreAsTag } from '../../services/tags';
import { useDialog } from '../Common/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetProjectId?: string; // optional if editing a project other than active
}

export const DocumentDetailsModal: React.FC<Props> = ({ isOpen, onClose, targetProjectId }) => {
  const { project, allProjects, updateAnyProject, userStats, createDocumentFolder, showToast } = useAsterism();

  const currentProject = targetProjectId 
    ? (allProjects.find(p => p.id === targetProjectId) || project) 
    : project;

  const [title, setTitle] = useState(currentProject.title || '');
  const [subtitle, setSubtitle] = useState(currentProject.subtitle || '');
  const [author, setAuthor] = useState(currentProject.author || '');
  const [tags, setTags] = useState<string[]>(withGenreAsTag(currentProject).tags ?? []);
  const [synopsis, setSynopsis] = useState(currentProject.synopsis || '');
  const [folder, setFolder] = useState(currentProject.folder || '');
  const [isNewFolderInputOpen, setIsNewFolderInputOpen] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle(currentProject.title || '');
      setSubtitle(currentProject.subtitle || '');
      setAuthor(currentProject.author || '');
      setTags(withGenreAsTag(currentProject).tags ?? []);
      setSynopsis(currentProject.synopsis || '');
      setFolder(currentProject.folder || '');
      setIsNewFolderInputOpen(false);
      setNewFolderNameInput('');
    }
  }, [isOpen, currentProject]);

  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);

  if (!isOpen) return null;

  // aggregate all unique folders available
  const existingFolders = Array.from(new Set([
    ...(userStats.documentFolders || []),
    ...allProjects.map(p => p.folder).filter(Boolean) as string[]
  ]));

  const handleCreateNewFolder = () => {
    const clean = newFolderNameInput.trim();
    if (!clean) return;
    createDocumentFolder(clean);
    setFolder(clean);
    setIsNewFolderInputOpen(false);
    setNewFolderNameInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || 'untitled document';

    updateAnyProject(currentProject.id, {
      title: finalTitle,
      subtitle: subtitle.trim(),
      author: author.trim(),
      genre: '',
      tags,
      synopsis: synopsis.trim(),
      folder: folder.trim() || undefined
    });

    showToast(`Updated document info for "${finalTitle}"`, 'success');
    onClose();
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Document details"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-paper)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-xl)',
          padding: '28px',
          color: 'var(--text-main)',
          boxSizing: 'border-box'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
              Document Details & Organization
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Organize into folders, set genre metadata, and configure premise notes.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Document Title
            </label>
            <input
              type="text"
              placeholder="e.g. Nereus, or Untitled Document"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              If left blank, this will automatically be saved as <em>untitled document</em>.
            </div>
          </div>

          {/* subtitle / tagline */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Subtitle / Edition (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. A Chronicle of Starlight and Brass, Volume I, or Draft Notes"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* folder & genre row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* folder selection */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Folder size={13} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                <span>Folder / Collection</span>
              </label>
              
              {!isNewFolderInputOpen ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={folder}
                    onChange={e => {
                      if (e.target.value === '__NEW__') {
                        setIsNewFolderInputOpen(true);
                      } else {
                        setFolder(e.target.value);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.86rem',
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="">(No Folder — Unfiled)</option>
                    {existingFolders.map(f => (
                      <option key={f} value={f}>📁 {f}</option>
                    ))}
                    <option value="__NEW__">+ New Folder...</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="New Folder Name..."
                    value={newFolderNameInput}
                    onChange={e => setNewFolderNameInput(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--accent-gold)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      fontSize: '0.84rem'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewFolder}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewFolderInputOpen(false)}
                    style={{
                      padding: '6px 8px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* tags */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <BookOpen size={13} />
              <span>Tags</span>
            </label>
            <TagEditor tags={tags} onChange={setTags} suggestions={suggestionsFor(tags, tagCounts(allProjects))} />
          </div>

          {/* author name */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <User size={13} />
              <span>Author Name</span>
            </label>
            <input
              type="text"
              placeholder="Author or Pen Name"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* description / synopsis */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <AlignLeft size={13} />
              <span>Description / Premise / Notes</span>
            </label>
            <textarea
              rows={4}
              placeholder="What is this document about? Core premise, logline, or project notes..."
              value={synopsis}
              onChange={e => setSynopsis(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '0.86rem',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5
              }}
            />
          </div>

          {/* actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
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
              <Check size={15} />
              <span>Save Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
