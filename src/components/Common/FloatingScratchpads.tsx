import React, { useRef, useState } from 'react';
import { GripHorizontal, Palette, X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { NoteStyleEditor, NotePlacement } from './NoteControls';
import { NOTE_SAFE, noteCss, shownOn } from '../../services/scratchpads';
import type { Scratchpad } from '../../types';

const uiScale = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;

// a note on the page. pets will use the same frame: dismiss, where it shows, move, and a corner to start in.
const Sticky: React.FC<{ pad: Scratchpad }> = ({ pad }) => {
  const { saveScratchpad } = useAsterism();
  const [panel, setPanel] = useState(false);
  // the pointer's distance from the note's corner, in screen pixels
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const x = pad.x ?? 40, y = pad.y ?? 90, w = pad.w ?? 260, h = pad.h ?? 220;
  const look = noteCss(pad.style);
  const shape = pad.style?.shape ?? 'square';
  const border = pad.style?.border ?? 'none';
  const ink = look.color as string;
  const safe = NOTE_SAFE[shape];
  // the color belongs to the words; the see-through setting only fades the paper behind them
  const { color: _ink, ...paper } = look;
  const grow = useRef<{ w: number; h: number; px: number; py: number } | null>(null);
  return (
    <div role="group" aria-label={`Sticky note: ${pad.title}`} style={{ position: 'fixed', left: x, top: y, width: w, height: h, zIndex: 90 }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.28))', pointerEvents: 'none' }}>
        <div style={{ ...paper, position: 'absolute', inset: 0, boxSizing: 'border-box' }} />
      </div>
      <div style={{ position: 'absolute', inset: safe.inset, display: 'flex', flexDirection: 'column', color: ink, overflow: 'hidden', minHeight: 0 }}>
        <div
          onPointerDown={e => { const s = uiScale(); drag.current = { dx: e.clientX - x * s, dy: e.clientY - y * s }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={e => {
            if (!drag.current) return;
            const s = uiScale();
            const host = document.getElementById('root');
            const maxX = (host?.clientWidth ?? window.innerWidth) - 60;
            const maxY = (host?.clientHeight ?? window.innerHeight) - 30;
            saveScratchpad({ ...pad, x: Math.max(0, Math.min((e.clientX - drag.current.dx) / s, maxX)), y: Math.max(0, Math.min((e.clientY - drag.current.dy) / s, maxY)) });
          }}
          onPointerUp={() => { drag.current = null; }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px 4px 10px', background: 'rgba(0,0,0,0.10)', cursor: 'grab', touchAction: 'none', fontSize: '0.78rem', fontWeight: 700, color: ink, flexShrink: 0 }}
        >
          <GripHorizontal size={14} aria-hidden style={{ opacity: 0.6, flexShrink: 0 }} />
          <input
            aria-label="Scratchpad title" value={pad.title} maxLength={60} placeholder="Scratchpad"
            onPointerDown={e => e.stopPropagation()}
            onChange={e => saveScratchpad({ ...pad, title: e.target.value })}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', font: 'inherit', cursor: 'text', userSelect: 'text', padding: '1px 2px' }}
          />
          <button aria-label="Change how this note looks" title="Look and where it shows" onPointerDown={e => e.stopPropagation()} onClick={() => setPanel(v => !v)} style={{ display: 'flex', padding: 3, color: ink, cursor: 'pointer' }}><Palette size={14} /></button>
          <button aria-label="Dismiss this note" title="Dismiss. It stays in your scratchpads." onPointerDown={e => e.stopPropagation()} onClick={() => saveScratchpad({ ...pad, floating: false })} style={{ display: 'flex', padding: 3, color: ink, cursor: 'pointer' }}><X size={14} /></button>
        </div>
        <textarea
          aria-label={`${pad.title} text`}
          value={pad.text}
          placeholder="Brain dump here..."
          onChange={e => saveScratchpad({ ...pad, text: e.target.value })}
          style={{ flex: 1, minHeight: 0, border: 'none', outline: 'none', background: 'transparent', color: 'inherit', padding: '8px 10px 18px', fontSize: '0.88rem', lineHeight: 1.45, resize: 'none', fontFamily: 'var(--font-sans)', userSelect: 'text', textAlign: shape === 'oval' || shape === 'blob' ? 'center' : undefined }}
        />
      </div>
      <div
        role="separator" aria-label="Resize this note" title="Drag to resize"
        onPointerDown={e => { grow.current = { w, h, px: e.clientX, py: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation(); }}
        onPointerMove={e => {
          const g = grow.current;
          if (!g) return;
          const s = uiScale();
          saveScratchpad({ ...pad, w: Math.round(Math.min(900, Math.max(160, g.w + (e.clientX - g.px) / s))), h: Math.round(Math.min(900, Math.max(120, g.h + (e.clientY - g.py) / s))) });
        }}
        onPointerUp={() => { grow.current = null; }}
        style={{ position: 'absolute', right: safe.handle.right, bottom: safe.handle.bottom, width: 18, height: 18, cursor: 'nwse-resize', touchAction: 'none', color: ink, opacity: 0.55, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M11 3 3 11M11 7 7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </div>
      {border === 'tape' && <div aria-hidden style={{ position: 'absolute', top: -9, left: '50%', width: 70, height: 18, marginLeft: -35, background: 'rgba(240,226,160,0.8)', transform: 'rotate(-3deg)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', pointerEvents: 'none' }} />}
      {border === 'pin' && <div aria-hidden style={{ position: 'absolute', top: -8, left: '50%', width: 16, height: 16, marginLeft: -8, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #ff8a8a, #c0392b)', boxShadow: '0 2px 3px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />}
      {panel && (
        <div className="glass-panel" onPointerDown={e => e.stopPropagation()}
          style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: 270, maxHeight: '60vh', overflowY: 'auto', padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-paper)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NoteStyleEditor style={pad.style} onChange={style => saveScratchpad({ ...pad, style })} />
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <NotePlacement pad={pad} onChange={saveScratchpad} />
          </div>
        </div>
      )}
    </div>
  );
};

// notes sit over whatever screen the writer is on: the ones on this document and the ones on every document
export const FloatingScratchpads: React.FC = () => {
  const { project, userStats } = useAsterism();
  const shown = (userStats.scratchpads ?? []).filter(p => (p.kind ?? 'note') === 'note' && shownOn(p, project.id));
  if (!shown.length) return null;
  return <>{shown.map(p => <Sticky key={p.id} pad={p} />)}</>;
};
