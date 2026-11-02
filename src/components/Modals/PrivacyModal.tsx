import React from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../Common/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const FONT_CREDITS = 'Atkinson Hyperlegible, Caveat, Cinzel, Cinzel Decorative, Cormorant Garamond, Courier Prime, Crimson Pro, EB Garamond, Great Vibes, IBM Plex Serif, Lora, Merriweather, Orbitron, Outfit, Patrick Hand, Playfair Display, Source Serif 4, Special Elite';

const para: React.CSSProperties = { margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' };

export const PrivacyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);
  if (!isOpen) return null;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Privacy" onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: 24, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Privacy</h3>
          <button aria-label="Close" onClick={onClose} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <p style={{ ...para, color: 'var(--text-main)', fontWeight: 600 }}>We do not collect your data. At all.</p>
        <p style={para}>There are no accounts, no analytics and no tracking. Your writing, points and settings stay on this device, and nothing is sent to us.</p>
        <p style={para}>Sync is off until you turn it on. When you do, your writing goes straight to your other device, to a server you choose yourself, or to your own Google Drive. It never passes through anything of ours.</p>
        <p style={para}>If you pick Google Drive, Google’s sign-in code loads at that moment and not before. Your writing is saved in a hidden folder in your Drive that only Asterism can open, and nothing else in your Drive is touched. Themes and sounds are not sent.</p>
        <p style={para}>Writing together live works like hosting a game server yourself. The host runs a small relay on their own computer, and you join it with a password they give you. Your writing goes to that computer scrambled with the password, so even a tunnel in between cannot read it. Nothing goes through anything of ours, and Asterism still collects nothing.</p>
        <p style={para}>The fonts come with the app. The only time anything is asked of the web is if you add a font by its name, and then only that font’s name is sent, to Google Fonts. Your writing never is.</p>
        <p style={para}>You can save everything to a file under Back up and restore, and clearing this site’s data in your browser removes it from this device.</p>
        <details>
          <summary style={{ ...para, cursor: 'pointer', color: 'var(--text-main)', fontWeight: 600 }}>Credits</summary>
          <p style={{ ...para, marginTop: 8 }}>Fonts that come with Asterism: {FONT_CREDITS}. All are free and open, under the SIL Open Font License 1.1 except Special Elite, which is under Apache 2.0. Their full license texts are in NOTICES.md.</p>
          <p style={{ ...para, marginTop: 8 }}>The typewriter key sound is from Pixabay, by freesound_community.</p>
          <p style={{ ...para, marginTop: 8 }}>Asterism is copyright 2026 Asterism Writing, and free software under the GNU GPL version 3 or later.</p>
          <p style={{ ...para, marginTop: 8 }}>Built with React, lucide icons, compromise, canvas-confetti and Tauri, all under permissive licenses.</p>
        </details>
      </div>
    </div>
  );
};
