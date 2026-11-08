import type { CustomSound } from '../services/soundRecipes';

// the built-in keystroke sounds, in one place so every menu shows the same list.
export const BUILT_IN_KEYSTROKES: Array<{ id: string; label: string; icon: string }> = [
  { id: 'duck', label: 'Ducky', icon: '🦆' },
  { id: 'droplet', label: 'Water Drops', icon: '💧' },
  { id: 'thocky', label: 'Thocky Mechanical', icon: '🪵' },
  { id: 'creamy', label: 'Creamy Smooth', icon: '🧈' },
  { id: 'clacky', label: 'Clacky Crisp', icon: '⚡' },
  { id: 'clicky', label: 'Clicky Tactile', icon: '🕹️' },
  { id: 'typewriter', label: 'Vintage Typewriter', icon: '⌨️' },
  { id: 'real-typewriter', label: 'Real Typewriter', icon: '📠' },
  { id: 'bubbles', label: 'Bubble Pops', icon: '🫧' },
  { id: 'thud', label: 'Felt Tapping', icon: '🛋️' },
];

const OFF = { id: 'off', label: 'Silent typing', icon: '🔇' };

// built-ins, then the writer's own, then "off" last.
// `owned` limits the built-ins to the ones the writer has (free, bought or earned); `keep` is the sound already picked, so it never vanishes from its own menu.
export function keystrokeOptions(custom: CustomSound[] = [], owned?: string[], keep?: string): Array<{ id: string; label: string; icon: string }> {
  const builtIns = owned ? BUILT_IN_KEYSTROKES.filter(k => owned.includes(k.id) || k.id === keep) : BUILT_IN_KEYSTROKES;
  return [...builtIns, ...custom.map(s => ({ id: s.id, label: s.name, icon: s.type === 'sample' ? '🎙️' : '✨' })), OFF];
}

// a readable name for the sound that is selected (never a raw id like "custom-lq2x…").
export function keystrokeLabel(id: string, custom: CustomSound[] = []): string {
  if (id === 'off') return 'Off';
  return keystrokeOptions(custom).find(o => o.id === id)?.label ?? 'Custom sound';
}
