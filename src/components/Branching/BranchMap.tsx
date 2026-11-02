import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NODE_H, NODE_W, nodeById, type BranchingStory } from '../../services/branching';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  story: BranchingStory;
  selectedId: string | null;
  // scenes with a problem, for a red outline
  flagged: Set<string>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

// a line from the right side of one scene to the left side of another; loops back go around
function edgePath(ax: number, ay: number, bx: number, by: number): string {
  if (bx > ax + 20) {
    const c = Math.max(40, (bx - ax) / 2);
    return `M ${ax} ${ay} C ${ax + c} ${ay}, ${bx - c} ${by}, ${bx} ${by}`;
  }
  const lift = Math.min(ay, by) - 70;
  return `M ${ax} ${ay} C ${ax + 70} ${lift}, ${bx - 70} ${lift}, ${bx} ${by}`;
}

// the whole story as a map: scenes you can drag, arrows labeled with the choice
export const BranchMap: React.FC<Props> = ({ story, selectedId, flagged, onSelect, onMove }) => {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 30, y: 30, k: 1 });
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const gesture = useRef<{ kind: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const pos = (id: string) => {
    if (drag && drag.id === id) return { x: drag.x, y: drag.y };
    const n = nodeById(story, id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  // the wheel zooms toward the pointer; it needs a listener that can stop the page scrolling
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      setView(v => {
        const k = Math.max(0.3, Math.min(2.2, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const fit = () => {
    const el = box.current;
    if (!el || story.nodes.length === 0) return;
    const minX = Math.min(...story.nodes.map(n => n.x));
    const minY = Math.min(...story.nodes.map(n => n.y));
    const maxX = Math.max(...story.nodes.map(n => n.x + NODE_W));
    const maxY = Math.max(...story.nodes.map(n => n.y + NODE_H));
    const k = Math.max(0.3, Math.min(1.2, Math.min((el.clientWidth - 60) / (maxX - minX), (el.clientHeight - 60) / (maxY - minY))));
    setView({ k, x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k, y: (el.clientHeight - (maxY - minY) * k) / 2 - minY * k });
  };

  // show the whole story when the map opens
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomBy = (f: number) => setView(v => {
    const el = box.current;
    const cx = el ? el.clientWidth / 2 : 0;
    const cy = el ? el.clientHeight / 2 : 0;
    const k = Math.max(0.3, Math.min(2.2, v.k * f));
    return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
  });

  const down = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const n = id ? nodeById(story, id) : undefined;
    gesture.current = { kind: n ? 'node' : 'pan', id, sx: e.clientX, sy: e.clientY, ox: n ? n.x : view.x, oy: n ? n.y : view.y, moved: false };
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
    if (g.kind === 'pan') setView(v => ({ ...v, x: g.ox + dx, y: g.oy + dy }));
    else if (g.id && g.moved) setDrag({ id: g.id, x: Math.round(g.ox + dx / view.k), y: Math.round(g.oy + dy / view.k) });
  };

  const up = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'node' && g.id) {
      if (g.moved && drag) onMove(g.id, drag.x, drag.y);
      else onSelect(g.id);
      setDrag(null);
    } else if (!g.moved) onSelect(null);
  };

  const edges = useMemo(() => story.nodes.flatMap(n => n.choices.filter(c => c.to && nodeById(story, c.to)).map(c => ({ id: c.id, from: n.id, to: c.to, label: c.label }))), [story]);

  return (
    <div
      ref={box}
      onPointerDown={e => down(e)}
      onPointerMove={move}
      onPointerUp={up}
      style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', touchAction: 'none', cursor: 'grab', backgroundColor: 'var(--bg-app)', backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
    >
      <svg width="100%" height="100%" role="group" aria-label={`Map of ${story.nodes.length} scenes. The same story is listed in the List view.`} style={{ display: 'block' }}>
        <defs>
          <marker id="branch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map(e => {
            const a = pos(e.from);
            const b = pos(e.to);
            const ax = a.x + NODE_W;
            const ay = a.y + NODE_H / 2;
            const bx = b.x;
            const by = b.y + NODE_H / 2;
            const hot = e.from === selectedId || e.to === selectedId;
            const mx = bx > ax + 20 ? (ax + bx) / 2 : (ax + bx) / 2;
            const my = bx > ax + 20 ? (ay + by) / 2 : Math.min(ay, by) - 52;
            const text = clip(e.label || '…', 22);
            return (
              <g key={e.id} aria-hidden>
                <path d={edgePath(ax, ay, bx, by)} fill="none" stroke={hot ? 'var(--accent-gold)' : 'var(--text-muted)'} strokeWidth={hot ? 2.4 : 1.5} markerEnd="url(#branch-arrow)" opacity={hot || !selectedId ? 1 : 0.55} />
                <rect x={mx - text.length * 3.1 - 5} y={my - 9} width={text.length * 6.2 + 10} height={17} rx={8} fill="var(--bg-paper)" stroke="var(--border-subtle)" />
                <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="10.5" fill="var(--text-secondary)">{text}</text>
              </g>
            );
          })}
          {story.nodes.map(n => {
            const p = pos(n.id);
            const on = n.id === selectedId;
            const start = n.id === story.startId;
            const bad = flagged.has(n.id);
            const body = clip(n.text.replace(/\*/g, '').replace(/\s+/g, ' ').trim() || 'No text yet', 40);
            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                onPointerDown={e => down(e, n.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id); } }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                <rect width={NODE_W} height={NODE_H} rx={12} fill={n.ending ? 'var(--accent-gold-bg)' : 'var(--bg-paper)'} stroke={bad ? '#dc2626' : on || start ? 'var(--accent-gold)' : 'var(--border-strong)'} strokeWidth={on ? 3 : start ? 2.2 : 1.4} strokeDasharray={bad ? '5 3' : undefined} />
                <text x={12} y={24} fontSize="13" fontWeight="700" fill="var(--text-main)">{clip(n.title, 24)}</text>
                <text x={12} y={44} fontSize="10.5" fill="var(--text-secondary)">{body}</text>
                <text x={12} y={65} fontSize="10" fill="var(--accent-gold-text, var(--accent-gold))" fontWeight="600">
                  {bad ? 'CHECK THIS' : start ? 'START' : n.ending ? 'ENDING' : `${n.choices.length} choice${n.choices.length === 1 ? '' : 's'}`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 6, padding: 4, borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-paper)', border: '1px solid var(--border-subtle)' }}>
        <button onClick={() => zoomBy(1.2)} aria-label="Zoom in" title="Zoom in" style={{ padding: 6, display: 'flex', color: 'var(--text-secondary)' }}><ZoomIn size={16} /></button>
        <button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out" title="Zoom out" style={{ padding: 6, display: 'flex', color: 'var(--text-secondary)' }}><ZoomOut size={16} /></button>
        <button onClick={fit} aria-label="Fit the whole story" title="Fit the whole story" style={{ padding: 6, display: 'flex', color: 'var(--text-secondary)' }}><Maximize size={16} /></button>
      </div>
    </div>
  );
};
