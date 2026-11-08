import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { ArrowLeft, Gift, Heart, MessageCircle, Users } from 'lucide-react';

const accent = 'var(--accent-gold-text, var(--accent-gold))';

// where friends, gifts and readers will live. nothing here yet; the page only says what is coming.
const COMING: Array<{ icon: React.ReactNode; title: string; text: string }> = [
  { icon: <Users size={20} />, title: 'Friends and readers', text: 'People you write with and people who read your work.' },
  { icon: <MessageCircle size={20} />, title: 'Feedback', text: 'Ask for notes, and leave kind ones.' },
  { icon: <Gift size={20} />, title: 'Gifts', text: 'Send a look or a few Quill Points to someone who helped.' },
  { icon: <Heart size={20} />, title: 'Thank-you stamps', text: 'A small way to say a comment mattered.' },
];

export const SocialPage: React.FC = () => {
  const { setViewMode } = useAsterism();
  return (
    <div style={{ height: 'var(--app-vh)', overflowY: 'auto', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={() => setViewMode('home')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: 'var(--text-secondary)', cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.05rem' }}><Users size={18} style={{ color: accent }} /> Social</div>
      </header>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px 120px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ textAlign: 'center', padding: '28px 16px', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--accent-gold)', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-title)' }}>Nothing here yet</div>
          <p style={{ margin: '8px auto 0', maxWidth: 460, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            This is where the social side of Asterism will live. Your writing stays on your device until you choose to share it.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {COMING.map(c => (
            <div key={c.title} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', opacity: 0.85 }}>
              <span style={{ color: accent, display: 'flex', paddingTop: 2 }}>{c.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};
