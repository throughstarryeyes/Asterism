import React, { useEffect, useMemo, useRef } from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { findTrail, type TrailConfig } from '../../services/trails';
import { startTrail } from '../../services/trailEngine';

// the writer's pointer trail, over the whole app
export const CursorTrail: React.FC = () => {
  const { userStats } = useAsterism();
  const host = useRef<HTMLDivElement>(null);
  const trail = useMemo(() => findTrail(userStats.activeTrail, userStats.customTrails), [userStats.activeTrail, userStats.customTrails]);
  const now = useRef<TrailConfig | undefined>(trail);
  useEffect(() => { now.current = trail; }, [trail]);

  useEffect(() => (host.current ? startTrail(window, host.current, () => now.current) : undefined), []);

  return <div ref={host} aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 2000 }} />;
};

// a small box to try a trail in: move the pointer over it
export const TrailPad: React.FC<{ trail: TrailConfig | undefined; height?: number }> = ({ trail, height = 120 }) => {
  const pad = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const now = useRef<TrailConfig | undefined>(trail);
  useEffect(() => { now.current = trail; }, [trail]);

  useEffect(() => {
    const box = pad.current;
    const layer = host.current;
    if (!box || !layer) return undefined;
    return startTrail(box, layer, () => now.current, (x, y) => {
      const r = box.getBoundingClientRect();
      return [x - r.left, y - r.top];
    });
  }, []);

  return (
    <div ref={pad} style={{ position: 'relative', height, borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', backgroundColor: 'var(--bg-paper)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', cursor: 'crosshair' }}>
      {trail ? 'Move your pointer here' : 'No trail. Pick one to try it.'}
      <div ref={host} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </div>
  );
};
