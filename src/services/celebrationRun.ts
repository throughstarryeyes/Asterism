import confetti from 'canvas-confetti';
import { FLAT_SHAPES, planCelebration, type CelebrationConfig } from './celebrations';

// draws a celebration: the plan's steps, timed. glyph shapes are drawn once per color and size, then remembered.
// above every dialog and the toasts, so the palette and the shop can show it too
export const CONFETTI_Z = 10000;

const drawn = new Map<string, confetti.Shape>();

function shapesFor(c: CelebrationConfig, scalar: number): confetti.Shape[] {
  const out: confetti.Shape[] = [];
  for (const s of c.shapes) {
    if (FLAT_SHAPES.includes(s)) { out.push(s as confetti.Shape); continue; }
    for (const color of c.colors) {
      const key = `${s}|${color}|${scalar}`;
      let shape = drawn.get(key);
      if (!shape) { shape = confetti.shapeFromText({ text: s, scalar, color }); drawn.set(key, shape); }
      out.push(shape);
    }
  }
  return out;
}

export function runCelebration(c: CelebrationConfig): void {
  for (const step of planCelebration(c)) {
    const go = () => confetti({ ...step.puff, colors: c.colors, shapes: shapesFor(c, step.puff.scalar), disableForReducedMotion: true, zIndex: CONFETTI_Z });
    if (step.at <= 0) go(); else setTimeout(go, step.at);
  }
}
