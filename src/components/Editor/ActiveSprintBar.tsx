import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { Timer, CheckCircle, XCircle, Quote } from 'lucide-react';
import { CALLIOPE_MOODS } from '../../data/calliopeData';

export const ActiveSprintBar: React.FC = () => {
  const { activeSprint, completeSprint, cancelSprint, userStats } = useAsterism();

  if (!activeSprint || !activeSprint.isActive) return null;

  const currentMood = CALLIOPE_MOODS[userStats.calliopeMood || 'sparkly'];

  const minutes = Math.floor(activeSprint.remainingSeconds / 60);
  const seconds = activeSprint.remainingSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const progressPercent = Math.min(
    100,
    activeSprint.durationSeconds > 0
      ? ((activeSprint.durationSeconds - activeSprint.remainingSeconds) / activeSprint.durationSeconds) * 100
      : 0
  );

  const wordProgressPercent = activeSprint.targetWords > 0
    ? Math.min(100, (activeSprint.wordsWritten / activeSprint.targetWords) * 100)
    : 100;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'var(--bg-paper)',
        borderBottom: '2px solid var(--accent-gold)',
        boxShadow: 'var(--shadow-md)',
        padding: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        {/* timer & Word count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Timer size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
              {timeFormatted}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            <span>Words written:</span>
            <strong style={{ color: 'var(--accent-primary)', fontSize: '0.95rem' }}>
              +{activeSprint.wordsWritten}
            </strong>
            {activeSprint.targetWords > 0 && (
              <span>/ {activeSprint.targetWords} target</span>
            )}
          </div>

          {/* Calliope mood status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: 'var(--accent-gold-text, var(--accent-gold))',
              backgroundColor: 'var(--accent-gold-bg)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--accent-gold)'
            }}
          >
            <span>{currentMood.emoji}</span>
            <span style={{ fontWeight: 600 }}>Calliope: {currentMood.label}</span>
          </div>
        </div>

        {/* action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={completeSprint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 600
            }}
          >
            <CheckCircle size={14} />
            <span>Finish Early</span>
          </button>

          <button
            onClick={cancelSprint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--badge-bg)',
              color: 'var(--text-muted)',
              fontSize: '0.78rem'
            }}
          >
            <XCircle size={14} />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* pinned prompt snippet if exists */}
      {activeSprint.promptText && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <Quote size={12} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
          <span style={{ fontWeight: 500, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{activeSprint.promptText}"
          </span>
        </div>
      )}

      {/* live dual progress bar */}
      <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--badge-bg)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
            transition: 'width 0.5s ease'
          }}
        />
      </div>
    </div>
  );
};
