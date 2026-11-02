import type { CustomThemeConfig } from '../types';
import { newCustomTheme } from './customTheme';

// the themes that come with the app are written in index.css. this is the same set of colors, so the shop can draw a
// preview of each one. keep it in step with the stylesheet.

interface Builtin {
  id: string;
  bgApp: string; bgPaper: string; textMain: string; textSecondary: string; accentPrimary: string; accentGold: string; borderSubtle: string; borderStrong: string;
  paperStyle?: CustomThemeConfig['paperStyle'];
  marginLine?: boolean;
  stars?: 'few' | 'some' | 'many';
}

export const BUILTIN_THEMES: Builtin[] = [
  { id: 'parchment', bgApp: '#f5f0e6', bgPaper: '#fbf8f1', textMain: '#2c241b', textSecondary: '#665849', accentPrimary: '#8f4c24', accentGold: '#c9933b', borderSubtle: '#e0d5c1', borderStrong: '#c8b79b' },
  { id: 'black', bgApp: '#000000', bgPaper: '#080808', textMain: '#f5f5f5', textSecondary: '#a3a3a3', accentPrimary: '#6c6b6b', accentGold: '#9f8548', borderSubtle: '#242424', borderStrong: '#3d3d3d' },
  { id: 'white', bgApp: '#f8fafc', bgPaper: '#ffffff', textMain: '#0f172a', textSecondary: '#475569', accentPrimary: '#0284c7', accentGold: '#d97706', borderSubtle: '#e2e8f0', borderStrong: '#cbd5e1' },
  { id: 'celestial', bgApp: '#080c18', bgPaper: '#0f1629', textMain: '#f0f4ff', textSecondary: '#9cb1d6', accentPrimary: '#4f80ff', accentGold: '#f7c948', borderSubtle: '#202c4f', borderStrong: '#334373', stars: 'some' },
  { id: 'velvet', bgApp: '#120e17', bgPaper: '#1c1524', textMain: '#fceffe', textSecondary: '#c9b1d6', accentPrimary: '#d4638c', accentGold: '#e5a952', borderSubtle: '#3a2c4b', borderStrong: '#543f6c' },
  { id: 'solarium', bgApp: '#06120d', bgPaper: '#0b1e16', textMain: '#f0fdf4', textSecondary: '#a7f3d0', accentPrimary: '#10b981', accentGold: '#e2b342', borderSubtle: '#1c3b2d', borderStrong: '#2a5542' },
  { id: 'scriptorium', bgApp: '#120b06', bgPaper: '#1c120a', textMain: '#fef3c7', textSecondary: '#fde68a', accentPrimary: '#d97706', accentGold: '#f59e0b', borderSubtle: '#3d2717', borderStrong: '#5a3a22' },
  { id: 'composition', bgApp: '#dfd8cc', bgPaper: '#fbfbf6', textMain: '#1a2a44', textSecondary: '#475a75', accentPrimary: '#d32f2f', accentGold: '#eab308', borderSubtle: '#cac0af', borderStrong: '#ae9f89', paperStyle: 'lined', marginLine: true },
  { id: 'pasteldream', bgApp: '#f4effe', bgPaper: '#ffffff', textMain: '#3b1d75', textSecondary: '#6d3ec9', accentPrimary: '#ec4899', accentGold: '#06b6d4', borderSubtle: '#e4d4fc', borderStrong: '#cfb5fa', paperStyle: 'grid' },
  { id: 'duck', bgApp: '#fff3b0', bgPaper: '#fffbe0', textMain: '#3b3208', textSecondary: '#6b5d12', accentPrimary: '#1778b3', accentGold: '#f5a300', borderSubtle: '#f3dd7a', borderStrong: '#e3c43f', marginLine: true },
];

export const findBuiltinTheme = (id: string | undefined) => BUILTIN_THEMES.find(t => t.id === id);

// the same colors in the shape a theme you make yourself has, so one preview can draw either
export function builtinAsTheme(id: string): CustomThemeConfig | undefined {
  const b = findBuiltinTheme(id);
  if (!b) return undefined;
  return newCustomTheme({
    id: `builtin-${b.id}`, name: b.id, bgApp: b.bgApp, bgPaper: b.bgPaper, textMain: b.textMain, textSecondary: b.textSecondary,
    accentPrimary: b.accentPrimary, accentGold: b.accentGold, borderSubtle: b.borderSubtle, borderStrong: b.borderStrong,
    paperStyle: b.paperStyle ?? 'plain', marginLine: !!b.marginLine, marginColor: b.id === 'duck' ? '#5ab6e8' : undefined,
    appLook: b.stars ? { stars: b.stars } : undefined, createdAt: undefined,
  });
}
