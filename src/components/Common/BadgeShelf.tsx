import React, { useState } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { findShelf } from '../../services/looks';
import type { WritingBadge } from '../../types';
import { BookOpen, Compass, Crown, Feather, Flame, Hourglass, Moon, Pin, Sparkles, Star, Zap } from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { Flame, Hourglass, Zap, Moon, Compass, Feather, BookOpen, Star, Crown };

export const BadgeIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 18 }) => {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} />;
};

const ROW = 4;

const Medal: React.FC<{ badge: WritingBadge; pinned: boolean; selected: boolean; big?: boolean; onPick: () => void }> = ({ badge, pinned, selected, big, onPick }) => {
  const size = big ? 52 : 42;
  return (
    <button onClick={onPick} title={badge.name} aria-label={`${badge.name}${badge.unlocked ? '' : ', not earned yet'}`} aria-pressed={selected}
      style={{ position: 'relative', width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        backgroundColor: badge.unlocked ? 'var(--accent-gold-text, var(--accent-gold))' : 'transparent', color: badge.unlocked ? '#ffffff' : 'currentColor',
        border: badge.unlocked ? '2px solid rgba(255,255,255,0.55)' : '2px dashed currentColor', opacity: badge.unlocked ? 1 : 0.4,
        boxShadow: selected ? '0 0 0 3px var(--accent-gold)' : badge.unlocked ? '0 2px 6px rgba(0,0,0,0.25)' : 'none' }}>
      <BadgeIcon name={badge.icon} size={big ? 24 : 19} />
      {pinned && <Pin size={11} style={{ position: 'absolute', top: -3, right: -3, color: 'var(--accent-gold)', transform: 'rotate(35deg)' }} />}
    </button>
  );
};

// the badges on a shelf. the writer's best three can be pinned to the top.
export const BadgeShelf: React.FC = () => {
  const { badges, userStats, toggleShowcase } = useAsterism();
  const shelf = findShelf(userStats.activeShelf);
  const [picked, setPicked] = useState<string | null>(null);
  const pins = userStats.showcase ?? [];
  const pinned = pins.map(id => badges.find(b => b.id === id)).filter((b): b is WritingBadge => !!b && b.unlocked);
  const rest = badges.filter(b => !pinned.includes(b));
  const rows: WritingBadge[][] = [];
  for (let i = 0; i < rest.length; i += ROW) rows.push(rest.slice(i, i + ROW));
  const current = badges.find(b => b.id === picked);
  const earned = badges.filter(b => b.unlocked).length;

  const plank = (key: string) => <div key={key} style={{ height: 9, borderRadius: 3, background: shelf.plank, boxShadow: '0 3px 4px rgba(0,0,0,0.18)' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {earned} of {badges.length} earned. Badges come from writing, never from points. Tap an earned one to pin it up top.
      </div>
      <div role="group" aria-label="Badge shelf" style={{ background: shelf.case, border: `1px solid ${shelf.edge}`, borderRadius: 'var(--radius-md)', padding: '14px 14px 10px', color: shelf.label, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pinned.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'flex-end', minHeight: 56 }}>
              {pinned.map(b => <Medal key={b.id} badge={b} big pinned selected={picked === b.id} onPick={() => setPicked(b.id)} />)}
            </div>
            {plank('top')}
          </>
        )}
        {rows.map((row, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', minHeight: 44 }}>
              {row.map(b => <Medal key={b.id} badge={b} pinned={false} selected={picked === b.id} onPick={() => setPicked(b.id)} />)}
            </div>
            {plank(`row-${i}`)}
          </React.Fragment>
        ))}
      </div>
      {current && (
        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>{current.name}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{current.description}</div>
          {current.unlocked ? (
            <button onClick={() => toggleShowcase(current.id)} style={{ alignSelf: 'flex-start', marginTop: 4, padding: '3px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))' }}>
              {pins.includes(current.id) ? 'Unpin' : 'Pin to top'}
            </button>
          ) : (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Not earned yet.</div>
          )}
        </div>
      )}
    </div>
  );
};
