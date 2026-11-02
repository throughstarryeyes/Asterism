import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { ShopBrowser } from './ShopBrowser';
import { ThemeSelectorModal, type Tab } from '../Header/ThemeSelectorModal';
import { ArrowLeft, ShoppingBag, Sparkles } from 'lucide-react';

const accent = 'var(--accent-gold-text, var(--accent-gold))';

export const ShopPage: React.FC = () => {
  const { userStats, closeShop } = useAsterism();
  const [modalTab, setModalTab] = useState<Tab | null>(null);

  return (
    <div style={{ height: '100vh', overflowY: 'auto', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 5 }}>
        <button onClick={closeShop} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '1.05rem' }}>
          <ShoppingBag size={18} style={{ color: accent }} /> The Shop
        </div>
        <span style={{ flex: 1 }} />
        <div title="Your Quill Points" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-gold-bg)', color: accent, border: '1px solid var(--accent-gold)', fontSize: '0.82rem', fontWeight: 600 }}>
          <Sparkles size={14} /> {userStats.quillPoints} QP
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 120px' }}>
        <ShopBrowser onOpenTab={setModalTab} />
      </main>

      {modalTab && <ThemeSelectorModal key={modalTab} isOpen onClose={() => setModalTab(null)} initialTab={modalTab} />}
    </div>
  );
};
