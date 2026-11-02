import React from 'react';
import { useSessions } from '../../editor/collab/live';
import { useAsterism } from '../../context/AsterismContext';

// a thin note across the top while a live session has lost its connection, or has ended, so a writer is never typing into a dead line unaware.
// with several sessions it says which document.
export const LiveBanner: React.FC = () => {
  const sessions = useSessions();
  const { allProjects } = useAsterism();
  const trouble = sessions.filter(s => (s.mode === 'joined' && s.connection === 'reconnecting') || s.mode === 'ended');
  if (!trouble.length) return null;
  const titleOf = (id: string) => allProjects.find(p => p.id === id)?.title ?? 'a document';
  const many = sessions.length > 1;
  return (
    <div role="status" style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 4000, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 'min(92vw, 560px)' }}>
      {trouble.map(s => {
        const lost = s.mode === 'joined';
        return (
          <div key={s.projectId} style={{
            padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', textAlign: 'center',
            backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', border: `1px solid ${lost ? '#b9770e' : 'var(--border-strong)'}`, boxShadow: 'var(--shadow-lg)',
          }}>
            {many ? `“${titleOf(s.projectId)}”: ` : ''}
            {lost ? 'Connection lost. Trying to get back in. You can keep writing, and your changes will join in when it returns.' : 'The session has ended. What you see here is saved in your library.'}
          </div>
        );
      })}
    </div>
  );
};
