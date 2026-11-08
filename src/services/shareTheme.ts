import type { CustomThemeConfig } from '../types';
import { newCustomTheme } from './customTheme';

// a custom theme as one small file. the pictures a theme can use are kept on the device, so they stay behind.
export const THEME_FILE_TYPE = 'asterism-theme';
const MAX_BYTES = 100 * 1024;
const HEX = /^#[0-9a-f]{6}$/i;
const COLORS = ['bgApp', 'bgPaper', 'textMain', 'textSecondary', 'accentPrimary', 'accentGold', 'borderSubtle', 'borderStrong'] as const;

export function themeFile(t: CustomThemeConfig): { fileName: string; text: string } {
  const name = t.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'theme';
  const { id: _id, appBgImageId: _a, pageBgImageId: _p, createdAt: _c, ...keep } = t;
  return { fileName: `${name}.theme.asterism.json`, text: JSON.stringify({ type: THEME_FILE_TYPE, version: 1, theme: keep }, null, 2) };
}

export function parseThemeFile(text: string): CustomThemeConfig | { error: string } {
  if (text.length > MAX_BYTES) return { error: 'That file is too big to be a theme.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: 'That is not an Asterism theme file.' }; }
  const r = raw as { type?: unknown; theme?: unknown } | null;
  if (!r || r.type !== THEME_FILE_TYPE || !r.theme || typeof r.theme !== 'object') return { error: 'That is not an Asterism theme file.' };
  const t = r.theme as Record<string, unknown>;
  const partial: Partial<CustomThemeConfig> = {
    name: (typeof t.name === 'string' ? t.name : '').replace(/[<>]/g, '').trim().slice(0, 40) || 'Shared theme',
    cornerRoundness: typeof t.cornerRoundness === 'number' ? Math.min(24, Math.max(0, t.cornerRoundness)) : 10,
  };
  for (const key of COLORS) if (typeof t[key] === 'string' && HEX.test(t[key] as string)) partial[key] = t[key] as string;
  if (['plain', 'lined', 'grid', 'dots'].includes(t.paperStyle as string)) partial.paperStyle = t.paperStyle as CustomThemeConfig['paperStyle'];
  if (typeof t.ruleColor === 'string' && HEX.test(t.ruleColor)) partial.ruleColor = t.ruleColor;
  if (typeof t.marginColor === 'string' && HEX.test(t.marginColor)) partial.marginColor = t.marginColor;
  if (typeof t.marginLine === 'boolean') partial.marginLine = t.marginLine;
  if (typeof t.handwriting === 'boolean') partial.handwriting = t.handwriting;
  return newCustomTheme({ ...partial, id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
}
