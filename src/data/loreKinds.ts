import type { LoreEntry } from '../types';

export const LORE_KINDS: Array<{ id: LoreEntry['category']; label: string }> = [
  { id: 'magic_rules', label: 'Rules of magic' },
  { id: 'history', label: 'History' },
  { id: 'technology', label: 'Technology' },
  { id: 'faction', label: 'Group or faction' },
  { id: 'culture', label: 'Culture' },
  { id: 'custom', label: 'Other' },
];
