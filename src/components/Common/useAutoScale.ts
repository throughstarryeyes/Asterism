import { useEffect } from 'react';

// on small screens the whole interface is drawn on a slightly wider virtual canvas and shrunk to fit,
// so toolbars and buttons keep the layout (and the text wrapping) they have on a bigger window.
// the shorter side of the screen decides, so portrait and landscape both come out right.
const DESIGN_SHORT_SIDE = 440;
const MIN_SCALE = 0.78;

export function autoScaleFor(width: number, height: number): number {
  const short = Math.min(width, height);
  if (short >= 500) return 1;
  return Math.max(MIN_SCALE, Math.min(1, short / DESIGN_SHORT_SIDE));
}

function readOverride(): number | null {
  try {
    const q = new URLSearchParams(window.location.search).get('scale');
    const raw = q ?? window.localStorage.getItem('asterism-ui-scale');
    if (!raw || raw === 'auto') return null;
    const n = Number(raw);
    return n >= 0.5 && n <= 1 ? n : null;
  } catch {
    return null;
  }
}

export function useAutoScale(): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const s = readOverride() ?? autoScaleFor(window.innerWidth, window.innerHeight);
      if (s < 0.995) {
        root.style.setProperty('--ui-scale', s.toFixed(3));
        root.setAttribute('data-ui-scaled', '');
      } else {
        root.style.removeProperty('--ui-scale');
        root.removeAttribute('data-ui-scaled');
      }
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}
