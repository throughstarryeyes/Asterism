import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// a modal's keyboard behavior: focus moves in, Tab stays inside, Escape closes, focus goes back on close
export function useDialog<T extends HTMLElement>(open: boolean, onClose: () => void, escape = true) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const items = () => (node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null || el === document.activeElement) : []);
    // leave focus alone if something inside already took it (an autofocus field)
    if (node && !node.contains(document.activeElement)) (items()[0] ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // a dialog with its own layered Escape handling opts out
        if (escape) { e.stopPropagation(); close.current(); }
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const list = items();
      if (list.length === 0) { e.preventDefault(); node.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (before && document.contains(before)) before.focus();
    };
  }, [open, escape]);

  return ref;
}
