import React from 'react';

// three asterisks in a triangle: the asterism, the name's own mark
export const BrandMark: React.FC<{ size?: number }> = ({ size = 22 }) => {
  const spokes = (cx: number, cy: number) => [0, 60, 120].map(a => {
    const r = (a * Math.PI) / 180, dx = Math.cos(r) * 5.2, dy = Math.sin(r) * 5.2;
    return <line key={`${cx}-${a}`} x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ color: 'var(--accent-gold-text, var(--accent-gold))', flexShrink: 0 }}>
      {spokes(16, 8.5)}{spokes(8.5, 22.5)}{spokes(23.5, 22.5)}
    </svg>
  );
};
