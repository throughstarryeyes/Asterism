import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { ToolDocBar } from '../Common/ToolDocBar';
import { FoundationsDeck } from '../Sidebar/FoundationsDeck';
import { ArrowLeft, Compass } from 'lucide-react';

const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' };

// a deck of cards and the reflections kept on it, as a document of its own
export const CardsView: React.FC = () => {
  const { toolDoc, leaveTool } = useAsterism();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-app)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--toolbar-bg)' }}>
        <button onClick={leaveTool} style={pill}><ArrowLeft size={14} /> <span>Home</span></button>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
          <Compass size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} /> Cards
        </h1>
        <ToolDocBar kind="cards" />
      </header>
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', height: '100%' }}>
          <FoundationsDeck doc={toolDoc} />
        </div>
      </main>
    </div>
  );
};
