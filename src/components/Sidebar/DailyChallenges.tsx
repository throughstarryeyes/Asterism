import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { REWARD } from '../../services/rewards';
import { multiplier, type Quest } from '../../services/quests';
import { SEASON_GOAL, SEASON_REWARD, SEASONS, progressNow, seasonOf } from '../../services/seasons';
import { Flame, Repeat, Snowflake } from 'lucide-react';

const bar = (q: Quest) => (
  <div aria-hidden style={{ height: 5, borderRadius: 3, backgroundColor: 'var(--border-subtle)', overflow: 'hidden', marginTop: 5 }}>
    <div style={{ width: `${Math.round((q.progress / q.target) * 100)}%`, height: '100%', backgroundColor: q.done ? 'var(--accent-success, #4a9d6a)' : 'var(--accent-gold)' }} />
  </div>
);

// today's challenges, the weekly quest and the streak
export const DailyChallenges: React.FC = () => {
  const { quests, streak, swapDailyQuest, buyStreakFreeze, userStats } = useAsterism();
  const season = progressNow(userStats.season);
  const seasonName = SEASONS[seasonOf()].label;
  const bonus = Math.round((multiplier(streak) - 1) * 100);
  const doneCount = quests.daily.filter(q => q.done).length;

  const row = (q: Quest, swap?: () => void) => (
    <div key={q.id + q.text} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', opacity: q.done ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-main)', textDecoration: q.done ? 'line-through' : 'none' }}>{q.text}</div>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-gold-text, var(--accent-gold))', whiteSpace: 'nowrap' }}>+{q.reward} QP</span>
        {swap && !q.done && !quests.swapped && (
          <button onClick={swap} title="Swap for another (once a day)" aria-label="Swap this challenge" style={{ display: 'flex', color: 'var(--text-muted)', cursor: 'pointer' }}><Repeat size={13} /></button>
        )}
      </div>
      {bar(q)}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>{q.progress.toLocaleString()} / {q.target.toLocaleString()}</div>
    </div>
  );

  return (
    <section aria-label="Daily challenges" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
          <Flame size={15} style={{ color: streak > 0 ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-muted)' }} />
          <span>{streak > 0 ? `${streak}-day streak` : 'No streak yet'}</span>
          {bonus > 0 && <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)' }}>+{bonus}% on challenges</span>}
        </div>
        <button
          onClick={buyStreakFreeze}
          title={`A freeze covers one missed day. ${REWARD.freezeCost} Quill Points, up to ${REWARD.freezeMax}.`}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', padding: '3px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <Snowflake size={12} /> {quests.freezes} saved
        </button>
      </div>

      {quests.daily.map((q, i) => row(q, () => swapDailyQuest(i)))}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
        {doneCount === quests.daily.length ? 'All done today. Nice.' : `${doneCount} of ${quests.daily.length} done. Finish all three for +${REWARD.dailySet} QP.`}
      </div>

      {quests.weekly && (
        <>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>This week</div>
          {row(quests.weekly)}
        </>
      )}

      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{seasonName} challenge</div>
      {row({ id: 'season', category: 'week', tier: 'hard', event: 'words', text: `Write ${SEASON_GOAL.toLocaleString()} words this ${seasonName.toLowerCase()} for a keepsake cover`, progress: Math.min(season.words, SEASON_GOAL), target: SEASON_GOAL, reward: SEASON_REWARD, done: !!season.paid } satisfies Quest)}
    </section>
  );
};
