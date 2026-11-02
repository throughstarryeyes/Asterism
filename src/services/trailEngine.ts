import { MAX_BITS, bitFrames, planBit, spacing, type TrailConfig } from './trails';

// draws a trail into `host` as the pointer moves over `listen`. needs a browser.
// `get` is read on every move, so changing the trail takes effect at once.
export function startTrail(
  listen: Window | HTMLElement,
  host: HTMLElement,
  get: () => TrailConfig | undefined,
  toLocal: (clientX: number, clientY: number) => [number, number] = (x, y) => [x, y],
): () => void {
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let last: [number, number] | null = null;
  let travelled = 0;
  let live = 0;

  const spawn = (t: TrailConfig, x: number, y: number) => {
    const bit = planBit(t);
    const el = document.createElement('span');
    el.textContent = bit.glyph;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;margin:-${t.size / 2}px 0 0 -${t.size / 2}px;`
      + `font-size:${t.size}px;line-height:1;pointer-events:none;user-select:none;will-change:transform,opacity;`
      + `color:${t.color === 'accent' ? 'var(--accent-gold)' : t.color};opacity:0;`;
    host.appendChild(el);
    live++;
    const done = () => { el.remove(); live--; };
    const anim = el.animate(bitFrames(t, bit), { duration: t.life, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = done;
    anim.oncancel = done;
  };

  const onMove = (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.pointerType === 'touch' || calm?.matches) return;
    const t = get();
    if (!t) { last = null; return; }
    if (last) travelled += Math.hypot(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
    if (travelled < spacing(t.rate) || live >= MAX_BITS) return;
    travelled = 0;
    const [x, y] = toLocal(e.clientX, e.clientY);
    spawn(t, x, y);
  };
  const onLeave = () => { last = null; };

  listen.addEventListener('pointermove', onMove, { passive: true });
  listen.addEventListener('pointerleave', onLeave, { passive: true });
  return () => {
    listen.removeEventListener('pointermove', onMove);
    listen.removeEventListener('pointerleave', onLeave);
    host.replaceChildren();
  };
}
