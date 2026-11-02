import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { DailyChallenges } from './DailyChallenges';
import { BadgeShelf } from '../Common/BadgeShelf';
import { goalReward } from '../../services/rewards';
import type { WritingGoal, GoalType } from '../../types';
import { 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  ShoppingBag, 
  Trophy, 
  Zap, 
  Award, 
  Timer 
} from 'lucide-react';

export const GoalsRewardsPanel: React.FC = () => {
  const { 
    project, 
    userStats, 
    saveGoal, 
    toggleGoalComplete, 
    deleteGoal,
    openShop,
    setIsSprintModalOpen,
    activeSprint
  } = useAsterism();

  const [activeTab, setActiveTab] = useState<'goals' | 'badges' | 'shop'>('goals');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState<Partial<WritingGoal>>({
    title: '',
    type: 'words',
    target: 500,
    current: 0,
    unit: 'words',
    pointsReward: 30,
    completed: false
  });

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (goalForm.title?.trim()) {
      saveGoal({
        ...goalForm,
        id: `goal-${Date.now()}`
      } as WritingGoal);
      setIsAddingGoal(false);
      setGoalForm({
        title: '',
        type: 'words',
        target: 500,
        current: 0,
        unit: 'words',
        pointsReward: 30,
        completed: false
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* quill points banner */}
      <div 
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--accent-gold-bg)',
          border: '1px solid var(--accent-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Earned Quill Points
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-title)', color: 'var(--accent-gold-text, var(--accent-gold))' }}>
            {userStats.quillPoints} pts
          </div>
        </div>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Sparkles size={18} />
        </div>
      </div>

      {/* subtab selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
        <button
          onClick={() => setActiveTab('goals')}
          style={{
            flex: 1,
            padding: '6px 4px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            backgroundColor: activeTab === 'goals' ? 'var(--accent-gold-bg)' : 'transparent',
            color: activeTab === 'goals' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <Trophy size={13} />
          <span>Goals & Sprint</span>
        </button>

        <button
          onClick={() => setActiveTab('badges')}
          style={{
            flex: 1,
            padding: '6px 4px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            backgroundColor: activeTab === 'badges' ? 'var(--accent-gold-bg)' : 'transparent',
            color: activeTab === 'badges' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <Award size={13} />
          <span>Badges</span>
        </button>

        <button
          onClick={() => setActiveTab('shop')}
          style={{
            flex: 1,
            padding: '6px 4px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            backgroundColor: activeTab === 'shop' ? 'var(--accent-gold-bg)' : 'transparent',
            color: activeTab === 'shop' ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-secondary)'
          }}
        >
          <ShoppingBag size={13} />
          <span>Shop</span>
        </button>
      </div>

      {/* tab 1: goals & sprints */}
      {activeTab === 'goals' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <DailyChallenges />

          {/* quick sprint launch card */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--accent-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
                <span>Writing Sprint</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {activeSprint ? 'Sprint in progress!' : 'Race the clock and scale your Quill Points.'}
              </div>
            </div>

            <button
              onClick={() => setIsSprintModalOpen(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-gold-text, var(--accent-gold))',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
            >
              <Timer size={13} />
              <span>{activeSprint ? 'View Sprint' : 'Launch'}</span>
            </button>
          </div>

          {!isAddingGoal && (
            <button
              onClick={() => setIsAddingGoal(true)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-strong)',
                color: 'var(--accent-gold-text, var(--accent-gold))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Plus size={14} />
              <span>Create Custom Goal</span>
            </button>
          )}

          {/* new goal form */}
          {isAddingGoal && (
            <form onSubmit={handleAddGoal} style={{ padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
              <div style={{ fontWeight: 600 }}>New Writing Progress Goal</div>

              <input
                type="text"
                placeholder="Goal title (e.g. Write Chapter 3 Climax)..."
                value={goalForm.title || ''}
                onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
                style={{ padding: '6px 10px' }}
                required
              />

              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={goalForm.type || 'words'}
                  onChange={e => setGoalForm({ ...goalForm, type: e.target.value as GoalType })}
                  style={{ flex: 1, padding: '5px' }}
                >
                  <option value="words">Word Count</option>
                  <option value="time">Focus Time</option>
                  <option value="scene">Draft Scene</option>
                  <option value="character">Character Sketch</option>
                  <option value="revision">Editing & Revision</option>
                  <option value="custom">Custom Goal</option>
                </select>

                <input
                  type="number"
                  placeholder="Target"
                  value={goalForm.target || 0}
                  onChange={e => setGoalForm({ ...goalForm, target: Number(e.target.value) })}
                  style={{ width: '80px', padding: '5px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="submit" style={{ flex: 1, padding: '6px', backgroundColor: 'var(--accent-primary)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                  Add Goal
                </button>
                <button type="button" onClick={() => setIsAddingGoal(false)} style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* goals list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {project.goals.map(goal => (
              <div
                key={goal.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: goal.completed ? 'var(--tag-bg)' : 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  opacity: goal.completed ? 0.75 : 1
                }}
              >
                <button aria-label={goal.completed ? 'Mark goal not done' : 'Mark goal done'}
                  onClick={() => toggleGoalComplete(goal.id)}
                  style={{ color: goal.completed ? '#10b981' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  {goal.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', textDecoration: goal.completed ? 'line-through' : 'none', color: 'var(--text-main)' }}>
                    {goal.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent-gold-text, var(--accent-gold))', marginTop: '2px' }}>
                    +{goalReward(goal.type, goal.target)} Quill Points
                  </div>
                </div>

                <button aria-label="Delete goal"
                  onClick={() => deleteGoal(goal.id)}
                  style={{ padding: '3px', color: 'var(--text-muted)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* tab 2: milestone badges on a shelf (earned by writing, never bought) */}
      {activeTab === 'badges' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <BadgeShelf />
        </div>
      )}

      {/* tab 3: the shop has its own page */}
      {activeTab === 'shop' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            The shop has a page of its own now, with room to look around.
          </div>
          <button
            onClick={openShop}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', color: '#ffffff' }}
          >
            <ShoppingBag size={14} /> Open the shop
          </button>
        </div>
      )}
    </div>
  );
};
