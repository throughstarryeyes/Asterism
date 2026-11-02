import type { CustomFlourish, CustomSeparator } from '../types';

// scene break styles and title page flourishes. cost 0 means free from the start.

export interface Separator {
  id: string;
  name: string;
  cost: number;
  description: string;
  // the line above the ornament
  rule: 'dashed' | 'solid' | 'none' | 'gilt';
  // the ornament under it (empty for a plain rule)
  mark: string;
  gold?: boolean;
}

export const FREE_SEPARATOR = 'stars';

export const SEPARATORS: Separator[] = [
  { id: 'stars', name: 'Three stars', cost: 0, description: 'The classic * * *.', rule: 'dashed', mark: '* * *' },
  { id: 'plain', name: 'Plain rule', cost: 0, description: 'Just a thin line.', rule: 'solid', mark: '' },
  { id: 'dots', name: 'Three dots', cost: 0, description: 'Quiet and small.', rule: 'none', mark: '· · ·' },
  { id: 'fleuron', name: 'Fleuron', cost: 40, description: 'A printer\'s leaf.', rule: 'none', mark: '❦' },
  { id: 'asterism', name: 'Asterism', cost: 40, description: 'Three stars in a triangle.', rule: 'none', mark: '⁂' },
  { id: 'diamonds', name: 'Diamonds', cost: 50, description: 'Filled, hollow, filled.', rule: 'none', mark: '◆ ◇ ◆' },
  { id: 'tide', name: 'Tide', cost: 50, description: 'A little wave.', rule: 'none', mark: '~ ~ ~' },
  { id: 'crescents', name: 'Crescents', cost: 120, description: 'A star between two moons.', rule: 'solid', mark: '☽ ✦ ☾' },
  { id: 'laurel', name: 'Laurel', cost: 140, description: 'Leaves either side of a star.', rule: 'solid', mark: '❧ ✦ ☙' },
  { id: 'starfield', name: 'Starfield', cost: 300, description: 'Scattered stars in gold.', rule: 'gilt', mark: '· ✦ · ˖ ✧ ˖ · ✦ ·', gold: true },
  { id: 'seal', name: 'Gilt seal', cost: 320, description: 'A fleur-de-lis on a golden thread.', rule: 'gilt', mark: '⚜', gold: true },
];

type SepLook = Pick<Separator, 'id' | 'name' | 'rule' | 'mark' | 'gold'>;

export const findSeparator = (id?: string, custom: CustomSeparator[] = []): SepLook =>
  custom.find(s => s.id === id) ?? SEPARATORS.find(s => s.id === id) ?? SEPARATORS[0];

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const MAX_MARK = 16;

// a made-up separator, kept to what the editor can hold
export function cleanSeparator(raw: Partial<CustomSeparator> & { id: string }): CustomSeparator {
  return {
    id: raw.id,
    name: (raw.name ?? '').trim().slice(0, 24) || 'My scene break',
    rule: raw.rule && raw.rule in RULES ? raw.rule : 'none',
    mark: (raw.mark ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_MARK),
    gold: !!raw.gold,
  };
}

const RULES: Record<Separator['rule'], string> = {
  dashed: 'border: none; border-top: 1px dashed var(--border-subtle); margin: 32px 0;',
  solid: 'border: none; border-top: 1px solid var(--border-subtle); margin: 32px 20% 20px;',
  none: 'border: none; height: 0; margin: 28px 0 0;',
  gilt: 'border: none; height: 1px; margin: 32px 12% 12px; background: linear-gradient(90deg, transparent, var(--accent-gold), transparent);',
};

// the html put in the text. it always has an <hr>, which is what the scene detectors, exports and the analyzer look for.
export function separatorHtml(id?: string, custom: CustomSeparator[] = []): string {
  const s = findSeparator(id, custom);
  const hr = `<hr data-separator="${s.id}" style="${RULES[s.rule]}" />`;
  if (!s.mark) return hr;
  const color = s.gold ? 'var(--accent-gold-text, var(--accent-gold))' : 'var(--text-muted)';
  return `${hr}<p data-separator-mark="1" style="text-align: center; color: ${color}; font-style: italic; letter-spacing: 0.3em;">${escapeHtml(s.mark)}</p>`;
}

export interface Flourish {
  id: string;
  name: string;
  cost: number;
  description: string;
  // lines above the title and below the author
  top: string;
  bottom: string;
  // a border drawn around the title block
  frame?: 'double' | 'gilt';
}

export const FREE_FLOURISH = 'none';

export const FLOURISHES: Flourish[] = [
  { id: 'none', name: 'Bare', cost: 0, description: 'No flourish.', top: '', bottom: '' },
  { id: 'rule', name: 'Thin rule', cost: 0, description: 'A short line above and below.', top: '───', bottom: '───' },
  { id: 'fleuron', name: 'Fleuron', cost: 60, description: 'A printer\'s leaf under the title.', top: '', bottom: '❦' },
  { id: 'stars', name: 'Stars', cost: 60, description: 'A trail of stars both sides.', top: '✦ ✧ ✦', bottom: '✦ ✧ ✦' },
  { id: 'ornate', name: 'Ornate', cost: 150, description: 'Leaves above, a flourish below.', top: '❦ ✦ ❦', bottom: '· ❧ ·' },
  { id: 'frame', name: 'Double frame', cost: 180, description: 'A fine double border around the title.', top: '', bottom: '', frame: 'double' },
  { id: 'gilt', name: 'Gilt frame', cost: 400, description: 'A golden border with ornaments.', top: '❦ ✦ ❦', bottom: '⚜', frame: 'gilt' },
];

type FlourishLook = Pick<Flourish, 'id' | 'name' | 'top' | 'bottom' | 'frame'>;

export const findFlourish = (id?: string, custom: CustomFlourish[] = []): FlourishLook =>
  custom.find(f => f.id === id) ?? FLOURISHES.find(f => f.id === id) ?? FLOURISHES[0];

export function cleanFlourish(raw: Partial<CustomFlourish> & { id: string }): CustomFlourish {
  const line = (t?: string) => (t ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_MARK);
  return {
    id: raw.id,
    name: (raw.name ?? '').trim().slice(0, 24) || 'My flourish',
    top: line(raw.top),
    bottom: line(raw.bottom),
    frame: raw.frame === 'double' || raw.frame === 'gilt' ? raw.frame : undefined,
  };
}

// the border a flourish draws around the title block
export function flourishFrame(f: Pick<Flourish, 'frame'>): Record<string, string> | undefined {
  if (f.frame === 'double') return { border: '3px double var(--border-strong)', padding: '40px 32px', borderRadius: '2px' };
  if (f.frame === 'gilt') return { border: '2px solid var(--accent-gold)', outline: '1px solid var(--accent-gold)', outlineOffset: '5px', padding: '40px 32px', borderRadius: '2px' };
  return undefined;
}
