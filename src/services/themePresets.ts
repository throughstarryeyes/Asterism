import type { CustomThemeConfig } from '../types';
import { GRADIENT_PRESETS, type Gradient, type Look } from './backdrops';
import { newCustomTheme } from './customTheme';

// themes the shop sells that are made of the same parts as a theme you make yourself. buying one adds a copy to your
// own themes, so you can change anything about it.

export interface ThemePreset {
  id: string;
  name: string;
  group: string;
  cost: number;
  description: string;
  icon: string;
  theme: CustomThemeConfig;
}

const grad = (id: string): Gradient => GRADIENT_PRESETS.find(p => p.id === id)!.gradient;
const lin = (angle: number, ...stops: Array<[string, number]>): Gradient => ({ kind: 'linear', angle, stops: stops.map(([color, at]) => ({ color, at })) });

interface Colors { app: string; paper: string; text: string; soft: string; accent: string; gold: string; line: string; edge: string }

function make(id: string, name: string, group: string, cost: number, icon: string, description: string, c: Colors, extra: Partial<CustomThemeConfig> = {}): ThemePreset {
  return {
    id, name, group, cost, description, icon,
    theme: newCustomTheme({
      id: `preset-${id}`, name, bgApp: c.app, bgPaper: c.paper, textMain: c.text, textSecondary: c.soft,
      accentPrimary: c.accent, accentGold: c.gold, borderSubtle: c.line, borderStrong: c.edge, cornerRoundness: 12, createdAt: undefined, ...extra,
    }),
  };
}

const look = (l: Look) => l;

export const THEME_PRESETS: ThemePreset[] = [
  // summer
  make('beach', 'Beach Day', 'Summer', 80, '🏖️', 'Warm sand sliding into shallow turquoise.',
    { app: '#f3e3b8', paper: '#fffaf0', text: '#2b3a42', soft: '#566a72', accent: '#1b8da8', gold: '#e4a23a', line: '#ead9ad', edge: '#d3bd88' },
    { appLook: look({ gradient: lin(180, ['#f7e7b9', 0], ['#e9d29b', 55], ['#8fd8e2', 100]) }) }),
  make('bright-summer', 'Bright Summer', 'Summer', 80, '🌞', 'Mango, coral and lagoon, all at full volume.',
    { app: '#fff3d6', paper: '#fffdf7', text: '#2d2a32', soft: '#5f5a68', accent: '#e8435e', gold: '#f0a500', line: '#f6e3b8', edge: '#e8cc90' },
    { appLook: look({ gradient: lin(135, ['#ffe29a', 0], ['#ff9ab0', 50], ['#7fe0d4', 100]) }) }),
  // winter
  make('frostlight', 'Frostlight', 'Winter', 80, '❄️', 'Muted icy blues, light and quiet.',
    { app: '#e8f1fa', paper: '#fbfdff', text: '#243447', soft: '#506579', accent: '#3f739f', gold: '#6f9cc4', line: '#cfe0ef', edge: '#a9c5de' },
    { appLook: look({ gradient: grad('frost') }) }),
  make('winter-night', 'Winter Night', 'Winter', 90, '🌨️', 'Deep slate-blue with a little snow falling.',
    { app: '#101a2b', paper: '#162338', text: '#e3edf8', soft: '#9fb4cc', accent: '#6fa8dc', gold: '#a9d0f5', line: '#25364f', edge: '#34496a' },
    { appLook: look({ gradient: lin(180, ['#0b1424', 0], ['#1b2f4a', 100]), stars: 'some' }) }),
  // autumn
  make('harvest', 'Harvest', 'Autumn', 80, '🍂', 'Yellow, orange and red on warm cream.',
    { app: '#f6e7cf', paper: '#fffaf1', text: '#3b2a1c', soft: '#6f5339', accent: '#bb4a1b', gold: '#d98d1a', line: '#ead4b0', edge: '#d1b283' },
    { appLook: look({ gradient: lin(160, ['#f7e4b8', 0], ['#f0b878', 55], ['#e08a5a', 100]) }) }),
  make('embers', 'Embers and Leaves', 'Autumn', 90, '🍁', 'Brown and rust in the dark, with a glow underneath.',
    { app: '#1c110c', paper: '#271913', text: '#f1e3d0', soft: '#c2a589', accent: '#e2622b', gold: '#f0a53a', line: '#3a2820', edge: '#54382a' },
    { appLook: look({ gradient: grad('ember') }) }),
  // spring
  make('blossom', 'Blossom', 'Spring', 80, '🌸', 'Pale pink, soft green and sky.',
    { app: '#fbeff3', paper: '#fffcfd', text: '#3a2f3a', soft: '#6f5f72', accent: '#c8567f', gold: '#6aa56a', line: '#f1d9e2', edge: '#dfbccb' },
    { appLook: look({ gradient: lin(160, ['#fde7ee', 0], ['#e4f3df', 50], ['#dcecf8', 100]) }) }),
  // skies
  make('dawn', 'Dawn', 'Skies', 120, '🌅', 'Dark blue at the top, then orange, pink and gold at the horizon.',
    { app: '#14224f', paper: '#1b1e45', text: '#fff3e4', soft: '#c9bcd4', accent: '#f0795a', gold: '#f5b45c', line: '#2c2f63', edge: '#454a8a' },
    { appLook: look({ gradient: grad('dawn') }) }),
  make('dusk', 'Dusk', 'Skies', 120, '🌆', 'Dark blue sinking into orange, with the first stars.',
    { app: '#0d1330', paper: '#201a3a', text: '#f2e8e0', soft: '#c2b0c8', accent: '#f08a3c', gold: '#f5b24a', line: '#322a55', edge: '#4a3d78' },
    { appLook: look({ gradient: grad('dusk'), stars: 'some' }) }),
  make('midnight', 'Midnight', 'Skies', 110, '🌌', 'Dark and quiet, with stars.',
    { app: '#05060f', paper: '#0f1226', text: '#e6e2f2', soft: '#a7a3c4', accent: '#7f8cff', gold: '#c9b8ff', line: '#1c2040', edge: '#2d3466' },
    { appLook: look({ gradient: grad('midnight'), stars: 'many' }) }),
  // holidays
  make('christmas', 'Christmas', 'Holidays', 90, '🎄', 'Evergreen, berry red and gold, with snow.',
    { app: '#102a1c', paper: '#17382a', text: '#f7f0e0', soft: '#bcd2c0', accent: '#e8525c', gold: '#e8c25a', line: '#245139', edge: '#37724f' },
    { appLook: look({ gradient: lin(180, ['#0f2a1b', 0], ['#1f4b32', 100]), stars: 'some' }) }),
  make('new-year', 'New Year’s Eve', 'Holidays', 90, '🎆', 'Navy, black, gold and silver, with sparks.',
    { app: '#070b1f', paper: '#0d1330', text: '#f4f1e6', soft: '#b9bbd0', accent: '#c9cfe0', gold: '#e7c365', line: '#1d2650', edge: '#2f3b76' },
    { appLook: look({ gradient: lin(180, ['#04060f', 0], ['#101c4a', 100]), stars: 'many' }) }),
  make('pumpkin-night', 'Pumpkin Night', 'Holidays', 90, '🎃', 'Purple-black and a bright pumpkin glow.',
    { app: '#140a1c', paper: '#1d1128', text: '#f3e6d4', soft: '#c4a98f', accent: '#ff7a1a', gold: '#ffb347', line: '#2d1a3d', edge: '#46285e' },
    { appLook: look({ gradient: lin(180, ['#0d0614', 0], ['#3a1a4a', 100]), stars: 'few' }) }),
  make('haunted', 'Haunted', 'Holidays', 90, '👻', 'Near-black with a sickly green light.',
    { app: '#0b0f0c', paper: '#121a15', text: '#d9ead8', soft: '#9bb59d', accent: '#7bd14a', gold: '#b8f070', line: '#1d2b22', edge: '#2e4536' },
    { appLook: look({ gradient: lin(180, ['#070a08', 0], ['#1a2a1f', 100]), stars: 'few' }) }),
  // materials
  make('workshop', 'Workshop', 'Materials', 100, '🪵', 'A wooden desk under cream pages.',
    { app: '#d9b98e', paper: '#fbf3e3', text: '#33261a', soft: '#6a5440', accent: '#8a4a1c', gold: '#c98a2c', line: '#e0cfae', edge: '#c4ab80' },
    { appLook: look({ material: 'wood' }) }),
  make('dunes', 'Dunes', 'Materials', 100, '🏜️', 'Sand underfoot and warm light.',
    { app: '#ecdcb6', paper: '#fffaf0', text: '#3a2f20', soft: '#6f5d44', accent: '#a8571f', gold: '#d08a2a', line: '#ead9ad', edge: '#d3bd88' },
    { appLook: look({ material: 'sand' }) }),
  make('tide-pool', 'Tide Pool', 'Materials', 100, '🌊', 'Clear water with light rippling across it.',
    { app: '#cfe6f1', paper: '#f6fbfd', text: '#12303f', soft: '#46687a', accent: '#1d6f96', gold: '#d8a032', line: '#c9e1ec', edge: '#9bc3d6' },
    { appLook: look({ material: 'water' }) }),
  make('marble-hall', 'Marble Hall', 'Materials', 100, '🏛️', 'Veined white stone.',
    { app: '#e4e4ea', paper: '#ffffff', text: '#202226', soft: '#53565e', accent: '#4c5a82', gold: '#b08d3c', line: '#e1e1e8', edge: '#c3c3cf' },
    { appLook: look({ material: 'marble' }) }),
  make('corkboard', 'Corkboard', 'Materials', 100, '📌', 'Pinned up on cork.',
    { app: '#dcbb88', paper: '#fffbf2', text: '#33271a', soft: '#6a5642', accent: '#a23d2a', gold: '#c98f2b', line: '#e6d6b8', edge: '#cdb48a' },
    { appLook: look({ material: 'cork' }) }),
  // see-through pages
  make('glass-day', 'Liquid Glass (Day)', 'Glass', 130, '🫧', 'A see-through page floating over a soft, bright gradient.',
    { app: '#bcd7f5', paper: '#ffffff', text: '#16202e', soft: '#445468', accent: '#2f6fd0', gold: '#e09420', line: '#d5e4f6', edge: '#b5cde9' },
    { appLook: look({ gradient: lin(135, ['#a9c9f5', 0], ['#e1c7f7', 55], ['#fbd6c8', 100]) }), pageLook: look({ glass: 0.6 }) }),
  make('glass-night', 'Liquid Glass (Night)', 'Glass', 130, '🔮', 'A see-through page over a deep, starry gradient.',
    { app: '#0e1224', paper: '#1b2140', text: '#eef0ff', soft: '#b2b7d6', accent: '#8c9bff', gold: '#ffc78a', line: '#2a3260', edge: '#3b4580' },
    { appLook: look({ gradient: lin(135, ['#141a40', 0], ['#3a2a6a', 55], ['#0f3a5a', 100]), stars: 'few' }), pageLook: look({ glass: 0.55 }) }),
];

export const findThemePreset = (id: string | undefined) => THEME_PRESETS.find(t => t.id === id);

// a fresh copy to add to the writer's own themes
export const presetCopy = (preset: ThemePreset): CustomThemeConfig => ({ ...preset.theme, createdAt: new Date().toISOString() });
