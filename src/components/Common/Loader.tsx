import React from 'react';
import { useAsterism } from '../../context/AsterismContext';
import { SHAPES, cycleSeconds, findLoader, layoutBox, layoutPoints } from '../../services/loaders';
import type { LoaderConfig } from '../../types';

// shapes that light up one after another while something loads
// only opacity moves, so the browser keeps it going smoothly even while the page is busy

const Shape: React.FC<{ path: string; size: number; delay: number; cycle: number; x?: number; y?: number }> = ({ path, size, delay, cycle, x, y }) => {
  const place: React.CSSProperties = x === undefined || y === undefined
    ? {}
    : { position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' };
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-block', ...place }}>
      <svg viewBox="0 0 24 24" width={size} height={size} style={{ position: 'absolute', inset: 0, opacity: 0.45 }} aria-hidden>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 24 24" width={size} height={size} className="asterism-star-lit" style={{ position: 'absolute', inset: 0, animationDelay: `${delay}s`, animationDuration: `${cycle}s` }} aria-hidden>
        <path d={path} fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

// the animation for one loader, with no message or wrapper (the workshop and the shop use it directly)
export const LoaderArt: React.FC<{ config: LoaderConfig; size: number }> = ({ config, size }) => {
  const path = SHAPES[config.shape].path;
  const cycle = cycleSeconds(config);
  const color = config.color === 'accent' ? undefined : config.color;

  if (config.layout === 'row') {
    return (
      <span style={{ display: 'inline-flex', gap: size * 0.4, color }}>
        {Array.from({ length: config.count }, (_, i) => <Shape key={i} path={path} size={size} delay={i * config.step} cycle={cycle} />)}
      </span>
    );
  }

  const [bw, bh] = layoutBox(config.layout, config.count);
  const w = size * bw;
  const h = size * bh;
  const spots = layoutPoints(config.layout, config.count);
  return (
    <span style={{ position: 'relative', width: w, height: h, display: 'inline-block', color }}>
      {config.layout === 'constellation' && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width={w} height={h} style={{ position: 'absolute', inset: 0, opacity: 0.3 }} aria-hidden>
          <polyline points={spots.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {spots.map(([x, y], i) => <Shape key={i} path={path} size={size} delay={i * config.step} cycle={cycle} x={x} y={y} />)}
    </span>
  );
};

interface Props {
  // what is happening, in a few words ("Reading your story…")
  message?: string;
  size?: number;
  // a small one with no message, for inside a button
  inline?: boolean;
  // show this one instead of the one the writer picked
  config?: LoaderConfig;
}

export const Loader: React.FC<Props> = ({ message, size = 20, inline = false, config }) => {
  const { userStats } = useAsterism();
  const look = config ?? findLoader(userStats.activeLoader, userStats.customLoaders);
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: inline ? 'inline-flex' : 'flex', flexDirection: inline ? 'row' : 'column', alignItems: 'center', justifyContent: 'center',
        gap: inline ? 0 : 10, padding: inline ? 0 : '24px 12px', color: 'var(--accent-gold-text, var(--accent-gold))',
      }}
    >
      <LoaderArt config={look} size={inline ? 12 : size} />
      {message ? <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{message}</span> : <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Loading</span>}
    </span>
  );
};
