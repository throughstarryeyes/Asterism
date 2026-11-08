import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { ToolDocBar } from '../Common/ToolDocBar';
import * as muse from '../../services/muse/generators';
import { STAT_KINDS, newSheet, rerollRow, rollSheet, setStarter, setStats } from '../../services/sheets';
import type { SheetData, StatKind } from '../../types';
import { ArrowLeft, Compass, Dices, Shuffle, Users } from 'lucide-react';

const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' };
const box: React.CSSProperties = { padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontFamily: 'var(--font-body)', fontSize: '0.9rem' };
const STAT_NAMES: Record<StatKind, string> = { none: 'None', classic: 'Classic', psych: 'Psych', both: 'Classic and psych' };

// a rolled character or scene you can edit, reroll and keep
export const SheetView: React.FC = () => {
  const { toolDoc, updateToolDoc, leaveTool } = useAsterism();
  const kind = toolDoc.kind === 'scene' ? 'scene' : 'character';
  const sheet = toolDoc.sheet ?? newSheet(kind);
  const save = (next: SheetData) => updateToolDoc({ sheet: next });
  const editRow = (key: string, value: string) => save({ ...sheet, rows: sheet.rows.map(r => (r.key === key ? { ...r, value } : r)) });
  const icon = kind === 'character' ? <Users size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} /> : <Compass size={18} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'var(--app-vh)', backgroundColor: 'var(--bg-app)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--toolbar-bg)' }}>
        <button onClick={leaveTool} style={pill}><ArrowLeft size={14} /> <span>Home</span></button>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontFamily: 'var(--font-title)', color: 'var(--text-main)' }}>
          {icon}
          {kind === 'character' ? 'Character' : 'Scene'}
        </h1>
        <ToolDocBar kind={kind} />
        <span style={{ flex: 1 }} />
        {kind === 'character' ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Stats
            <select value={sheet.stats} onChange={e => save(setStats(sheet, e.target.value as StatKind))} style={{ ...box, padding: '4px 8px' }}>
              {STAT_KINDS.map(k => <option key={k} value={k}>{STAT_NAMES[k]}</option>)}
            </select>
          </label>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Scene starter
            <select value={sheet.starter} onChange={e => save(setStarter(sheet, e.target.value))} style={{ ...box, padding: '4px 8px' }}>
              {['none', 'any', ...muse.SCENE_GOALS].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
        <button onClick={() => save(rollSheet(kind, sheet))} style={{ ...pill, backgroundColor: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600 }} title="Roll every row again"><Shuffle size={14} /> Roll again</button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 16px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sheet.rows.map(row => (
            <div key={row.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor={`row-${row.key}`} style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{row.label}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <textarea id={`row-${row.key}`} value={row.value} rows={row.key.startsWith('stat:') ? 1 : 2} onChange={e => editRow(row.key, e.target.value)} style={{ ...box, flex: 1, resize: 'vertical' }} />
                <button onClick={() => save(rerollRow(sheet, row.key))} title={`Roll ${row.label.toLowerCase()} again`} aria-label={`Roll ${row.label} again`} style={{ ...pill, alignSelf: 'flex-start', padding: '8px' }}><Dices size={14} /></button>
              </div>
            </div>
          ))}
          <label htmlFor="sheet-notes" style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: 8 }}>Notes</label>
          <textarea id="sheet-notes" value={sheet.notes} rows={5} onChange={e => save({ ...sheet, notes: e.target.value })} placeholder="Anything else worth keeping." style={{ ...box, resize: 'vertical' }} />
        </div>
      </main>
    </div>
  );
};
