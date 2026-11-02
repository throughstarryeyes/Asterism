// the rolled character and scene documents (see components/Sheet)
import * as muse from './muse/generators';
import type { SheetData, SheetRow, StatKind, ToolKind } from '../types';

export const STAT_KINDS: StatKind[] = ['none', 'classic', 'psych', 'both'];

const isPsych = (name: string) => name in muse.generateStats('psych');

export function statRows(kind: StatKind): SheetRow[] {
  const kinds = kind === 'both' ? (['classic', 'psych'] as const) : kind === 'none' ? [] : [kind];
  return kinds.flatMap(k => Object.entries(muse.generateStats(k)).map(([name, v]) => ({ label: name, value: String(v), key: `stat:${name}` })));
}

// a new number for one stat, on the scale it uses
export const rollStat = (key: string) => String(1 + Math.floor(Math.random() * (isPsych(key.slice(5)) ? 10 : 20)));

const characterRows = (): SheetRow[] => {
  const c = muse.generateCharacter();
  return muse.CHARACTER_FIELDS.map(f => ({ label: muse.CHARACTER_FIELD_LABELS[f], value: c[f], key: f }));
};

const starterRow = (goal: string): SheetRow[] => {
  if (goal === 'none') return [];
  const s = muse.randomSceneStarter(goal === 'any' ? undefined : goal);
  return s ? [{ label: `Scene starter (${s.goal})`, value: s.text, key: 'starter' }] : [];
};

const sceneRows = (starter: string): SheetRow[] => [
  ...muse.SETTING_FIELDS.map(f => ({ label: f.charAt(0).toUpperCase() + f.slice(1), value: muse.rerollSettingField(f), key: f })),
  ...starterRow(starter),
];

export function newSheet(kind: 'character' | 'scene'): SheetData {
  const base = { stats: 'none' as StatKind, starter: kind === 'scene' ? 'any' : 'none', notes: '' };
  return { ...base, rows: kind === 'character' ? characterRows() : sceneRows(base.starter) };
}

// roll every row again
export function rollSheet(kind: ToolKind, sheet: SheetData): SheetData {
  if (kind === 'character') return { ...sheet, rows: [...characterRows(), ...statRows(sheet.stats)] };
  return { ...sheet, rows: sceneRows(sheet.starter) };
}

// roll one row again
export function rerollRow(sheet: SheetData, key: string): SheetData {
  const rows = sheet.rows.map(row => {
    if (row.key !== key) return row;
    if (key.startsWith('stat:')) return { ...row, value: rollStat(key) };
    if (key === 'starter') return starterRow(sheet.starter === 'none' ? 'any' : sheet.starter)[0] ?? row;
    const field = key as muse.CharacterField & muse.SettingField;
    const scene = (muse.SETTING_FIELDS as readonly string[]).includes(key);
    return { ...row, value: scene ? muse.rerollSettingField(field) : muse.rerollCharacterField(field) };
  });
  return { ...sheet, rows };
}

export function setStats(character: SheetData, stats: StatKind): SheetData {
  return { ...character, stats, rows: [...character.rows.filter(r => !r.key.startsWith('stat:')), ...statRows(stats)] };
}

export function setStarter(scene: SheetData, starter: string): SheetData {
  return { ...scene, starter, rows: [...scene.rows.filter(r => r.key !== 'starter'), ...starterRow(starter)] };
}
