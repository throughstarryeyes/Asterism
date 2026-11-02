import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { CALLIOPE_MOODS } from '../../data/calliopeData';
import { Timer, Zap, Sparkles, X, Play, Target, Award, Quote } from 'lucide-react';
import { useDialog } from '../Common/useDialog';
import { sprintTotals } from '../../services/sprints';

export const WritingSprintModal: React.FC = () => {
  const { 
    isSprintModalOpen, 
    setIsSprintModalOpen, 
    sprintPresetPrompt, 
    setSprintPresetPrompt,
    startSprint,
    userStats,
    project
  } = useAsterism();

  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [targetWords, setTargetWords] = useState<number>(300);
  const [basePoints, setBasePoints] = useState<number>(20);
  const [bonusPer100, setBonusPer100] = useState<number>(5);

  const dialogRef = useDialog<HTMLDivElement>(isSprintModalOpen, () => setIsSprintModalOpen(false), true);

  if (!isSprintModalOpen) return null;

  const currentMood = CALLIOPE_MOODS[userStats.calliopeMood || 'sparkly'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSprint({
      durationMinutes,
      targetWords,
      basePoints,
      bonusPointsPer100Words: bonusPer100,
      promptText: sprintPresetPrompt || undefined
    });
  };

  const durationOptions = [5, 10, 15, 20, 25, 45];
  const targetWordOptions = [0, 150, 250, 350, 500, 750];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Writing sprint"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={() => {
        setIsSprintModalOpen(false);
        setSprintPresetPrompt(null);
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-paper)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-paper)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-gold-bg)',
                color: 'var(--accent-gold-text, var(--accent-gold))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--accent-gold)'
              }}
            >
              <Zap size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', fontFamily: 'var(--font-title)' }}>
                Writing Sprint Launcher
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Race the clock, earn Quill Points, and beat writer’s block
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setIsSprintModalOpen(false);
              setSprintPresetPrompt(null);
            }}
            style={{ color: 'var(--text-muted)', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* content */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sprintTotals(project.sprints).count > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {sprintTotals(project.sprints).count} sprint{sprintTotals(project.sprints).count === 1 ? '' : 's'} in this document, {sprintTotals(project.sprints).words.toLocaleString()} words in {sprintTotals(project.sprints).minutes} minutes.
            </div>
          )}
          {/* Calliope mood banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-gold-bg)',
              border: '1px solid var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '1.6rem' }}>{currentMood.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Calliope is Feeling {currentMood.label}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontStyle: 'italic', marginTop: '2px' }}>
                "{currentMood.statusLine}"
              </div>
            </div>
          </div>

          {/* preset prompt if attached */}
          {sprintPresetPrompt && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--tag-bg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '10px'
              }}
            >
              <Quote size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Target Sprint Prompt
                </div>
                <div style={{ fontSize: '0.86rem', color: 'var(--text-main)', fontWeight: 500, marginTop: '2px', lineHeight: 1.4 }}>
                  {sprintPresetPrompt}
                </div>
              </div>
            </div>
          )}

          {/* duration selector */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              <Timer size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <span>Sprint Duration (Minutes)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
              {durationOptions.map(mins => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDurationMinutes(mins)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: durationMinutes === mins ? 700 : 500,
                    backgroundColor: durationMinutes === mins ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--bg-card)',
                    color: durationMinutes === mins ? '#ffffff' : 'var(--text-secondary)',
                    border: durationMinutes === mins ? '1px solid var(--accent-gold)' : '1px solid var(--border-subtle)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* target words */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              <Target size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <span>Word Goal (Optional)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
              {targetWordOptions.map(words => (
                <button
                  type="button"
                  key={words}
                  onClick={() => setTargetWords(words)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: targetWords === words ? 700 : 500,
                    backgroundColor: targetWords === words ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: targetWords === words ? '#ffffff' : 'var(--text-secondary)',
                    border: targetWords === words ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {words === 0 ? 'Free' : `${words}w`}
                </button>
              ))}
            </div>
          </div>

          {/* configurable point rewards scaling */}
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Award size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
              <span>Configurable Point Reward Scaling</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.78rem' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Base Points (Surviving)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  step="5"
                  value={basePoints}
                  onChange={e => setBasePoints(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Bonus Per 100 Words</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={bonusPer100}
                  onChange={e => setBonusPer100(Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              Estimated payout: <strong style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }}>~{basePoints + Math.floor((targetWords || 200) / 100 * bonusPer100) + (targetWords > 0 ? 25 : 0)} Quill Points</strong>
            </div>
          </div>

          {/* action buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-fast)'
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>Start Writing Sprint ({durationMinutes}m)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
