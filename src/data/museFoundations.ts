// foundation cards built from Callie's (Muse) content. nothing here is written
// by hand: every card comes from the JSON files in src/data/muse.
import type { FoundationCard } from '../types';
import {
  AUTOPSY_PACKETS,
  CHARACTER_FIELDS,
  CHARACTER_FIELD_LABELS,
  DESCENT_SEEDS,
  FAULTLINES,
  NARRATION_STYLES,
  SETTING_FIELDS,
  TROPES,
} from '../services/muse/generators';
import characterHelp from './muse/characterhelp.json';
import settingHelp from './muse/settinghelp.json';

const characterData = characterHelp as Record<string, string[]>;
const settingData = settingHelp as Record<string, string[]>;

const title = (s: string, max = 48) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

const autopsy: FoundationCard[] = AUTOPSY_PACKETS.map((p, i) => ({
  id: `autopsy-${i + 1}`,
  title: p.title,
  category: 'autopsy',
  prompt: p.questions[0],
  deepeningQuestions: p.questions.slice(1),
  tags: ['character'],
}));

const faultlines: FoundationCard[] = FAULTLINES.map((f, i) => ({
  id: `faultline-${i + 1}`,
  title: title(`${f.a_wants} vs. ${f.b_wants}`),
  category: 'faultline',
  prompt: `One wants ${f.a_wants}. The other wants ${f.b_wants}. But ${f.but}`,
  deepeningQuestions: [],
  tags: ['relationship', 'conflict'],
}));

const characters: FoundationCard[] = CHARACTER_FIELDS.flatMap(field =>
  (characterData[field] ?? []).map((text, i) => ({
    id: `character-${field}-${i + 1}`,
    title: CHARACTER_FIELD_LABELS[field],
    category: 'characters' as const,
    prompt: text,
    deepeningQuestions: [],
    tags: ['character', field],
  }))
);

const settings: FoundationCard[] = SETTING_FIELDS.flatMap(field =>
  (settingData[field] ?? []).map((text, i) => ({
    id: `setting-${field}-${i + 1}`,
    title: field.charAt(0).toUpperCase() + field.slice(1),
    category: 'world' as const,
    prompt: text,
    deepeningQuestions: [],
    tags: ['setting', field],
  }))
);

const descent: FoundationCard[] = DESCENT_SEEDS.map((text, i) => ({
  id: `descent-${i + 1}`,
  title: 'Descent',
  category: 'descent',
  prompt: text,
  deepeningQuestions: [],
  tags: ['arc', 'descent'],
}));

const tropes: FoundationCard[] = TROPES.map((t, i) => ({
  id: `trope-${i + 1}`,
  title: title(t.text, 40),
  category: 'tropes',
  prompt: t.text,
  deepeningQuestions: [],
  tags: t.tags,
}));

const narration: FoundationCard[] = NARRATION_STYLES.map((n, i) => ({
  id: `narration-${i + 1}`,
  title: n.name,
  category: 'narration',
  prompt: n.description,
  deepeningQuestions: [],
  tags: n.tags,
}));

export const MUSE_FOUNDATION_CARDS: FoundationCard[] = [
  ...autopsy, ...faultlines, ...characters, ...settings, ...descent, ...tropes, ...narration,
];
