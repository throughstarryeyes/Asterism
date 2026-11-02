import React, { useState } from 'react';
import { X, Download, Upload } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { useDialog } from '../Common/useDialog';
import { storageService } from '../../services/storage';
import { buildBackup, parseBackup, restoreBackup, backupFileName } from '../../services/backup';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const button: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)',
  fontSize: '0.84rem', color: 'var(--text-main)', cursor: 'pointer', backgroundColor: 'var(--bg-paper)',
};
const small: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 };

const countDocs = (library: string | undefined) => {
  try { const p = JSON.parse(library ?? '[]'); return Array.isArray(p) ? p.length : 0; } catch { return 0; }
};

export const BackupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { showToast } = useAsterism();
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);
  if (!isOpen) return null;

  const save = async (name = backupFileName()) => {
    const b = await buildBackup();
    storageService.downloadTextFile(name, JSON.stringify(b), 'application/json');
    return b;
  };

  const makeBackup = async () => {
    setBusy(true);
    try {
      const b = await save();
      showToast(`Saved a backup of ${countDocs(b.data.asterism_projects_library)} documents.`, 'success');
    } catch (e) {
      showToast(`Could not make the backup: ${e instanceof Error ? e.message : 'something went wrong'}`, 'info');
    } finally { setBusy(false); }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const got = parseBackup(await file.text());
    if (!got.ok) { showToast(got.error, 'info'); return; }
    const docs = countDocs(got.backup.data.asterism_projects_library);
    const when = got.backup.made ? ` made ${new Date(got.backup.made).toLocaleString()}` : '';
    if (!window.confirm(`Restore the backup${when}, with ${docs} document${docs === 1 ? '' : 's'}?\n\nThis replaces everything on this device. A backup of what is here now will download first, so you can undo it.`)) return;
    setBusy(true);
    try {
      await save(`asterism-before-restore-${new Date().toISOString().slice(0, 10)}.json`);
      await restoreBackup(got.backup);
      window.location.reload();
    } catch (e) {
      showToast(`Could not restore: ${e instanceof Error ? e.message : 'something went wrong'}`, 'info');
      setBusy(false);
    }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Back up and restore" onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Back up and restore</h2>
          <button onClick={onClose} aria-label="Close" style={{ display: 'flex', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={18} /></button>
        </div>
        <p style={small}>
          Everything lives on this device: your writing, Quill Points, everything you have made or bought, your settings, and the pictures and sounds you added. A backup is one file that holds all of it. Keep one somewhere safe, and use it to move to another device.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={makeBackup} disabled={busy} style={button}><Download size={15} /> Save a backup file</button>
          <p style={small}>Large if you added many pictures or sounds.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ ...button, opacity: busy ? 0.6 : 1 }}>
            <Upload size={15} /> Restore from a backup file
            <input type="file" accept=".json,application/json" aria-label="Choose a backup file" disabled={busy} style={{ display: 'none' }}
              onChange={e => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <p style={small}>This replaces everything on this device. Sync links are not restored, so each device keeps its own.</p>
        </div>
      </div>
    </div>
  );
};
