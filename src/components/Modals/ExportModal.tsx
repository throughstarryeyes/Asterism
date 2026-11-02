import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { X, FileDown, BookOpen, FileText, Code2, Printer, Globe, FileType, Tablet } from 'lucide-react';
import { useDialog } from '../Common/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    project, 
    activeChapter, 
    exportActiveChapterMd, 
    exportFullManuscriptMd, 
    exportProject,
    exportStandaloneHtml,
    exportDocx,
    exportEpub,
    setViewMode
  } = useAsterism();

  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);

  if (!isOpen) return null;

  const handlePrint = () => {
    // the book view has its own print button, and a layout to check first
    onClose();
    setViewMode('book_preview');
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Export" 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
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
          maxWidth: '540px',
          backgroundColor: 'var(--bg-paper)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-paper)',
          padding: '28px',
          color: 'var(--text-main)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileDown size={22} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
            <h2 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-display)', margin: 0 }}>Export Manuscript</h2>
          </div>
          <button aria-label="Close" 
            onClick={onClose}
            style={{ 
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          Your stories are yours. Export anytime: no watermarks, lock-in or internet needed.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* active chapter MD */}
          <div 
            onClick={() => { exportActiveChapterMd(); onClose(); }}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Active Chapter (.md)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  "{activeChapter?.title}" in clean Markdown format
                </div>
              </div>
            </div>
            <FileDown size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* full manuscript MD */}
          <div 
            onClick={() => { exportFullManuscriptMd(); onClose(); }}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <BookOpen size={20} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Complete Manuscript (.md)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {project.draftMode === 'open_draft' ? 'The whole draft' : `All ${project.chapters.length} chapters`} stitched with metadata & title page
                </div>
              </div>
            </div>
            <FileDown size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* Word document */}
          <div
            onClick={() => { exportDocx(); onClose(); }}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <FileType size={20} style={{ color: '#2563eb' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Word Document (.docx)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Title page, chapter headings, page numbers. Opens in Word, Pages and Google Docs
                </div>
              </div>
            </div>
            <FileDown size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* e-book */}
          <div
            onClick={() => { exportEpub(); onClose(); }}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Tablet size={20} style={{ color: '#a855f7' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>E-book (.epub)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  For Kindle apps, Apple Books and Kobo, with a contents page and your uploaded fonts inside
                </div>
              </div>
            </div>
            <FileDown size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* web page with fonts embedded */}
          <div
            onClick={() => { exportStandaloneHtml(); onClose(); }}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Globe size={20} style={{ color: '#0ea5e9' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Web Page (.html)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  One file that opens anywhere, with your uploaded fonts inside it
                </div>
              </div>
            </div>
            <FileDown size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* print / PDF */}
          <div 
            onClick={handlePrint}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Printer size={20} style={{ color: '#10b981' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Print / Save to PDF</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Book layout through your print dialog. Fonts you use are embedded in the PDF
                </div>
              </div>
            </div>
            <Printer size={18} style={{ color: 'var(--text-muted)' }} />
          </div>

          {/* full JSON backup */}
          <div 
            onClick={() => { exportProject(); onClose(); }}
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Code2 size={20} style={{ color: 'var(--accent-primary)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Complete Asterism Project (.json)</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Chapters, Story Bible, Reflections, Plot Threads, and your uploaded fonts
                </div>
              </div>
            </div>
            <FileDown size={18} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
