import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { useDialog } from '../Common/useDialog';
import { TOUR_STEPS, markTourSeen } from '../../services/tour';

const link: React.CSSProperties = { fontSize: '0.84rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 4px' };

export const TourModal: React.FC = () => {
  const { isTourOpen, setIsTourOpen } = useAsterism();
  const [step, setStep] = useState(0);
  const close = () => { markTourSeen(); setIsTourOpen(false); setStep(0); };
  const dialogRef = useDialog<HTMLDivElement>(isTourOpen, close, true);
  if (!isTourOpen) return null;
  const last = step === TOUR_STEPS.length - 1;
  const s = TOUR_STEPS[step];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Tour" onClick={close}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: 24, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{step + 1} of {TOUR_STEPS.length}</span>
          <button aria-label="Close the tour" onClick={close} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-title)' }}>{s.title}</h3>
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-secondary)', minHeight: 110 }}>{s.body}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {TOUR_STEPS.map((_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i === step ? 'var(--accent-gold)' : 'var(--border-strong)' }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {last ? <span /> : <button onClick={close} style={link}>Skip</button>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step > 0 && <button onClick={() => setStep(step - 1)} style={link}>Back</button>}
            <button onClick={() => (last ? close() : setStep(step + 1))}
              style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}>
              {last ? 'Start writing' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
