// every coaching feature is optional. nothing in the coach UI or engine should
// surface unless `isCoachFeatureOn` says so.

export const COACH_FEATURES = {
  askLater: {
    label: 'Ask-later loop',
    description: 'Remembers questions you raise in the text and resurfaces them when a scene could answer them.',
  },
  echoPrompts: {
    label: 'Echo prompts',
    description: 'Quotes a line of yours back with a deeper question.',
  },
  whyChains: {
    label: 'Why-chains',
    description: 'Follow-up questions that go a level deeper each time you answer.',
  },
  unseenScenes: {
    label: 'Unseen scenes',
    description: 'Notices big events that are mentioned but never shown on the page.',
  },
  whosMissing: {
    label: "Who's missing",
    description: 'Shows who is present, mentioned, or absent in each scene.',
  },
  characterLedger: {
    label: 'Fear / want / lie ledger',
    description: 'Builds up what each character fears and wants, and asks about the gaps.',
  },
  relationshipWeather: {
    label: 'Relationship weather',
    description: 'Tracks how two characters feel toward each other over the manuscript.',
  },
  actingStrange: {
    label: 'Acting-strange detector',
    description: 'Flags when a character departs from their usual behavior.',
  },
  promiseBoard: {
    label: 'Promise board',
    description: 'Tracks promises, secrets, warnings, and open questions and how long they have been open.',
  },
  nextSceneMenu: {
    label: 'Next-scene menu',
    description: 'Offers a few scene ideas drawn from your own open threads.',
  },
  yourTells: {
    label: 'Your tells',
    description: 'Shows words, gestures, and sentence shapes you reuse, without judging them.',
  },
  storyRules: {
    label: 'Your story’s rules',
    description: 'Checks the rules you teach it (for example “magic always costs something”) and learns from your answers.',
  },
  sparks: {
    label: 'Sparks',
    description: 'Jumping-off points built from the Muse generators and your own cast.',
  },
} as const;

export type CoachFeatureKey = keyof typeof COACH_FEATURES;

export interface CoachSettings {
  // master switch: when false, no coach feature runs or appears.
  enabled: boolean;
  features: Record<CoachFeatureKey, boolean>;
  // whether confirmations and corrections may teach the coach new phrases.
  learning: boolean;
}

export function defaultCoachSettings(): CoachSettings {
  const features = {} as Record<CoachFeatureKey, boolean>;
  (Object.keys(COACH_FEATURES) as CoachFeatureKey[]).forEach(key => {
    features[key] = true;
  });
  return { enabled: true, features, learning: true };
}

// fills in anything missing from saved data so new features appear with their
// default, and unknown keys from older/newer saves are dropped.
export function normalizeCoachSettings(raw: unknown): CoachSettings {
  const base = defaultCoachSettings();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<CoachSettings>;
  const features = { ...base.features };
  if (input.features && typeof input.features === 'object') {
    (Object.keys(features) as CoachFeatureKey[]).forEach(key => {
      if (typeof input.features![key] === 'boolean') features[key] = input.features![key];
    });
  }
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : base.enabled,
    features,
    learning: typeof input.learning === 'boolean' ? input.learning : base.learning,
  };
}

export function isCoachFeatureOn(settings: CoachSettings | undefined, key: CoachFeatureKey): boolean {
  const s = settings ?? defaultCoachSettings();
  return s.enabled && s.features[key];
}
