import type { AppViewMode, ToolKind } from '../types';

export const TOOL_KINDS: ToolKind[] = ['mindmap', 'branching', 'character', 'scene', 'cards'];

// "Started a mind map", and the name on the card
export const TOOL_NAMES: Record<ToolKind, string> = { mindmap: 'a mind map', branching: 'a branching story', character: 'a character', scene: 'a scene', cards: 'a card deck' };
export const TOOL_LABELS: Record<ToolKind, string> = { mindmap: 'Mind map', branching: 'Branching story', character: 'Character', scene: 'Scene', cards: 'Cards' };

export const viewFor = (kind: ToolKind): AppViewMode => (kind === 'character' || kind === 'scene' ? 'sheet' : kind);
