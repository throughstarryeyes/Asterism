import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { Sparkles, CheckCircle2, Info } from 'lucide-react';
import { Loader } from './Loader';

export const ToastNotification: React.FC = () => {
  const { toasts, working } = useAsterism();

  // always mounted, so screen readers announce toasts as they arrive
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    }}>
      {working && (
        <div className="animate-fade-in glass-panel" style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-gold)', color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Loader inline /><span>{working}</span></span>
        </div>
      )}
      {toasts.map(toast => {
        let icon = <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />;
        let borderColor = 'var(--border-strong)';
        let glow = 'none';

        if (toast.type === 'reward') {
          icon = <Sparkles size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))', flexShrink: 0 }} />;
          borderColor = 'var(--accent-gold)';
          glow = 'var(--shadow-glow)';
        } else if (toast.type === 'success') {
          icon = <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0 }} />;
          borderColor = '#10b981';
        }

        return (
          <div
            key={toast.id}
            className="animate-fade-in glass-panel"
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              maxWidth: '380px',
              boxShadow: `${glow !== 'none' ? glow + ', ' : ''}var(--shadow-md)`,
              border: `1px solid ${borderColor}`,
              color: 'var(--text-main)',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            {icon}
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};
