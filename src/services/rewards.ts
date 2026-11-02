// how many quill points things pay. starting is small; finishing pays most.
export const REWARD = {
  newDocument: 10,
  newChapter: 5,
  planning: 3,
  planningPerDay: 5,
  chapterRevised: 30,
  thread: 40,
  sprintTargetBonus: 40,
  dailySet: 20,
  weekly: 100,
  easy: 10,
  medium: 20,
  hard: 35,
  streakStep: 0.03,
  streakCap: 0.3,
  freezeCost: 60,
  freezeMax: 2,
  goalCap: 60,
  goalsPerDay: 150,
  draftCap: 1000,
  draftWordsPerPoint: 20,
  // the first time a manuscript is exported as a book file, and the first time a branching story is saved as a page
  exportFirst: 50,
  branchingFirst: 100,
} as const;

// a finished chapter: 60, and up to 30 more for a long one
export const chapterFinishReward = (words: number) => 60 + Math.min(30, Math.floor(words / 100));

// a finished first draft: 1 point per 20 words, up to 1,000 (20,000 words)
export const draftReward = (words: number) => Math.min(REWARD.draftCap, Math.floor(words / REWARD.draftWordsPerPoint));

// a goal pays by its size, so a tiny goal can't be farmed
export function goalReward(type: string, target: number): number {
  const t = Math.max(0, target);
  if (type === 'words') return Math.min(REWARD.goalCap, 10 + Math.floor(t / 50));
  if (type === 'time') return Math.min(REWARD.goalCap, 10 + Math.floor(t / 3));
  return 20;
}
