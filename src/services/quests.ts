// daily and weekly challenges, and the streak. everything here is a pure function of the state and the date.
import { REWARD } from './rewards';

export type QuestEvent =
  | { type: 'words'; n: number }
  | { type: 'sprint' }
  | { type: 'plan' }
  | { type: 'chapter_final' }
  | { type: 'chapter_revised' }
  | { type: 'finding' }
  | { type: 'thread' };

export type QuestCategory = 'write' | 'plan' | 'finish';
type Tier = 'easy' | 'medium' | 'hard';
type Needs = 'thread' | 'finding' | 'draft';

interface QuestDef {
  id: string;
  category: QuestCategory;
  tier: Tier;
  event: QuestEvent['type'] | 'day';
  target: number;
  text: string;
  needs?: Needs;
}

export interface Quest {
  id: string;
  category: QuestCategory | 'week';
  tier: Tier;
  event: QuestDef['event'];
  target: number;
  text: string;
  reward: number;
  progress: number;
  done: boolean;
}

export interface QuestState {
  day: string;
  daily: Quest[];
  swapped: boolean;
  setPaid: boolean;
  wordsToday: number;
  goalQp: number;
  // planning-tool awards given today
  planAwards: number;
  week: string;
  weekDays: string[];
  weekly: Quest | null;
  streak: number;
  best: number;
  lastDay: string;
  freezes: number;
  freezeAt: number;
}

// what the writer has to work with, so a challenge is never one they can't do
export interface QuestContext { hasThread: boolean; hasFinding: boolean; hasDraft: boolean }

const D: QuestDef[] = [
  { id: 'w150', category: 'write', tier: 'easy', event: 'words', target: 150, text: 'Write 150 words' },
  { id: 'w300', category: 'write', tier: 'easy', event: 'words', target: 300, text: 'Write 300 words' },
  { id: 'w600', category: 'write', tier: 'medium', event: 'words', target: 600, text: 'Write 600 words' },
  { id: 'w1000', category: 'write', tier: 'hard', event: 'words', target: 1000, text: 'Write 1,000 words' },
  { id: 's1', category: 'write', tier: 'easy', event: 'sprint', target: 1, text: 'Finish a writing sprint' },
  { id: 's2', category: 'write', tier: 'medium', event: 'sprint', target: 2, text: 'Finish two writing sprints' },
  { id: 'p2', category: 'plan', tier: 'easy', event: 'plan', target: 2, text: 'Use a planning tool twice: add a map note, save a card reflection or update a character' },
  { id: 'p4', category: 'plan', tier: 'medium', event: 'plan', target: 4, text: 'Use your planning tools four times' },
  { id: 'rev1', category: 'finish', tier: 'easy', event: 'chapter_revised', target: 1, text: 'Mark a chapter as revised', needs: 'draft' },
  { id: 'fin1', category: 'finish', tier: 'medium', event: 'chapter_final', target: 1, text: 'Finish a chapter', needs: 'draft' },
  { id: 'f1', category: 'finish', tier: 'easy', event: 'finding', target: 1, text: 'Answer one analyzer finding', needs: 'finding' },
  { id: 'f3', category: 'finish', tier: 'medium', event: 'finding', target: 3, text: 'Answer three analyzer findings', needs: 'finding' },
  { id: 't1', category: 'finish', tier: 'medium', event: 'thread', target: 1, text: 'Resolve a plot thread', needs: 'thread' },
];

const W: QuestDef[] = [
  { id: 'wk-days', category: 'write', tier: 'medium', event: 'day', target: 4, text: 'Write on 4 different days' },
  { id: 'wk-chapter', category: 'finish', tier: 'medium', event: 'chapter_final', target: 1, text: 'Finish a chapter', needs: 'draft' },
  { id: 'wk-sprints', category: 'write', tier: 'medium', event: 'sprint', target: 3, text: 'Finish 3 writing sprints' },
  { id: 'wk-words', category: 'write', tier: 'hard', event: 'words', target: 2500, text: 'Write 2,500 words this week' },
  { id: 'wk-plan', category: 'plan', tier: 'medium', event: 'plan', target: 8, text: 'Use your planning tools 8 times' },
];

const ok = (d: QuestDef, c: QuestContext) =>
  !d.needs || (d.needs === 'thread' ? c.hasThread : d.needs === 'finding' ? c.hasFinding : c.hasDraft);

// a small seeded random, so the same date always gives the same challenges
function seeded(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const make = (d: QuestDef): Quest => ({
  id: d.id, category: d.category, tier: d.tier, event: d.event, target: d.target, text: d.text,
  reward: REWARD[d.tier], progress: 0, done: false,
});

// ---- dates (local, as YYYY-MM-DD) ----
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
// the Monday of that week
export function weekKey(key: string): string {
  const d = toDate(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

export function newQuestState(): QuestState {
  return { day: '', daily: [], swapped: false, setPaid: false, wordsToday: 0, goalQp: 0, planAwards: 0, week: '', weekDays: [], weekly: null, streak: 0, best: 0, lastDay: '', freezes: 0, freezeAt: 0 };
}

// the streak as it stands today: it holds if the days missed are covered by freezes
export function liveStreak(s: QuestState, today: string): number {
  if (!s.lastDay) return 0;
  const missed = daysBetween(s.lastDay, today) - 1;
  return missed <= 0 || missed <= s.freezes ? s.streak : 0;
}

export function multiplier(streak: number): number {
  return 1 + Math.min(REWARD.streakCap, REWARD.streakStep * streak);
}

// start a new day (and week) when the date has moved on
export function ensureDay(s: QuestState, today: string, ctx: QuestContext): QuestState {
  let next = s;
  if (s.day !== today) {
    const rand = seeded(today);
    const daily: Quest[] = [];
    (['write', 'plan', 'finish'] as const).forEach(cat => {
      // a category with nothing to offer borrows a planning challenge that isn't already in the set
      const open = (list: QuestDef[]) => list.filter(d => ok(d, ctx) && !daily.some(q => q.id === d.id));
      let pool = open(D.filter(d => d.category === cat));
      if (!pool.length) pool = open(D.filter(d => d.category === 'plan'));
      daily.push(make(pool[Math.floor(rand() * pool.length)]));
    });
    next = { ...next, day: today, daily, swapped: false, setPaid: false, wordsToday: 0, goalQp: 0, planAwards: 0 };
  }
  const wk = weekKey(today);
  if (next.week !== wk) {
    const pool = W.filter(d => ok(d, ctx));
    const pick = pool[Math.floor(seeded(wk)() * pool.length)];
    next = { ...next, week: wk, weekDays: [], weekly: { ...make(pick), reward: REWARD.weekly } };
  }
  return next;
}

// swap one challenge for another of its kind, once a day
export function swapQuest(s: QuestState, index: number, ctx: QuestContext): QuestState {
  const q = s.daily[index];
  if (!q || s.swapped || q.done) return s;
  const others = D.filter(d => d.category === q.category && d.id !== q.id && !s.daily.some(x => x.id === d.id) && ok(d, ctx));
  if (!others.length) return s;
  const pick = others[Math.floor(seeded(`${s.day}${q.id}${index}`)() * others.length)];
  return { ...s, swapped: true, daily: s.daily.map((x, i) => (i === index ? make(pick) : x)) };
}

export interface QuestResult {
  state: QuestState;
  // quill points earned, and why, one line each
  awards: Array<{ qp: number; reason: string }>;
}

const advance = (q: Quest, event: QuestEvent): Quest => {
  if (q.done || q.event !== event.type) return q;
  const progress = Math.min(q.target, q.progress + (event.type === 'words' ? event.n : 1));
  return { ...q, progress, done: progress >= q.target };
};

// the day counts toward the streak once a challenge is done or 100 words are written
function markActive(s: QuestState, today: string, awards: QuestResult['awards']): QuestState {
  if (s.lastDay === today) return s;
  let streak = 1;
  if (s.lastDay) {
    const missed = daysBetween(s.lastDay, today) - 1;
    if (missed <= 0) streak = s.streak + 1;
    else if (missed <= s.freezes) streak = s.streak + 1;
  }
  const spent = s.lastDay ? Math.max(0, Math.min(s.freezes, daysBetween(s.lastDay, today) - 1)) : 0;
  let freezes = streak === 1 ? s.freezes : s.freezes - spent;
  let freezeAt = s.freezeAt;
  if (streak % 7 === 0 && streak > freezeAt) {
    freezes = Math.min(REWARD.freezeMax, freezes + 1);
    freezeAt = streak;
    awards.push({ qp: 0, reason: `${streak}-day streak! A streak freeze is saved for you` });
  }
  const weekDays = s.weekDays.includes(today) ? s.weekDays : [...s.weekDays, today];
  const weekly = s.weekly && s.weekly.event === 'day' && !s.weekly.done ? bump(s.weekly, weekDays.length) : s.weekly;
  return { ...s, streak, best: Math.max(s.best, streak), lastDay: today, freezes, freezeAt: streak === 1 ? 0 : freezeAt, weekDays, weekly };
}

const bump = (q: Quest, progress: number): Quest => ({ ...q, progress: Math.min(q.target, progress), done: progress >= q.target });

// record something the writer did, and say what it earned
export function applyEvent(prev: QuestState, event: QuestEvent, today: string, ctx: QuestContext): QuestResult {
  const awards: QuestResult['awards'] = [];
  let s = ensureDay(prev, today, ctx);
  if (event.type === 'words') s = { ...s, wordsToday: s.wordsToday + event.n };

  const mult = multiplier(liveStreak(s, today));
  const before = s.daily;
  s = { ...s, daily: s.daily.map(q => advance(q, event)) };
  s.daily.forEach((q, i) => {
    if (q.done && !before[i].done) awards.push({ qp: Math.round(q.reward * mult), reason: `Challenge done: ${q.text}` });
  });
  if (s.daily.length && s.daily.every(q => q.done) && !s.setPaid) {
    s = { ...s, setPaid: true };
    awards.push({ qp: REWARD.dailySet, reason: 'All three daily challenges done' });
  }
  if (s.weekly && s.weekly.event === event.type && !s.weekly.done) {
    const w = advance(s.weekly, event);
    s = { ...s, weekly: w };
    if (w.done) awards.push({ qp: w.reward, reason: `Weekly quest done: ${w.text}` });
  }
  if (s.daily.some(q => q.done) || s.wordsToday >= 100) s = markActive(s, today, awards);
  return { state: s, awards };
}

// a goal's points count toward a daily limit
export function takeGoalPoints(s: QuestState, qp: number): { state: QuestState; qp: number } {
  const room = Math.max(0, REWARD.goalsPerDay - s.goalQp);
  const paid = Math.min(qp, room);
  return { state: { ...s, goalQp: s.goalQp + paid }, qp: paid };
}

// using a planning tool pays a little, up to 5 times a day
export function takePlanAward(s: QuestState): { state: QuestState; qp: number } {
  if (s.planAwards >= REWARD.planningPerDay) return { state: s, qp: 0 };
  return { state: { ...s, planAwards: s.planAwards + 1 }, qp: REWARD.planning };
}

export function buyFreeze(s: QuestState): QuestState | null {
  return s.freezes >= REWARD.freezeMax ? null : { ...s, freezes: s.freezes + 1 };
}
