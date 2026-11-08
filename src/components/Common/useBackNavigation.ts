import { useEffect, useRef } from 'react';
import type { AppViewMode } from '../../types';
import { inDesktopApp } from '../../services/saveFile';

// "back" steps through the screens the writer has actually been on
export function useBackNavigation(viewMode: AppViewMode, setViewMode: (m: AppViewMode) => void): void {
  const state = useRef({ viewMode, setViewMode, trail: [] as AppViewMode[], going: false, last: viewMode });
  state.current.setViewMode = setViewMode;

  useEffect(() => {
    const s = state.current;
    if (s.going) { s.going = false; s.last = viewMode; return; }
    if (viewMode !== s.last) {
      s.trail.push(s.last);
      if (s.trail.length > 30) s.trail.shift();
      s.last = viewMode;
    }
    s.viewMode = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const s = state.current;
    // true when something was undone; false when there is nowhere left to go
    const stepBack = (): boolean => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      }
      const prev = s.trail.pop();
      if (prev !== undefined) { s.going = true; s.last = prev; s.viewMode = prev; s.setViewMode(prev); return true; }
      if (s.viewMode !== 'home') { s.going = true; s.last = 'home'; s.viewMode = 'home'; s.setViewMode('home'); return true; }
      return false;
    };

    const android = inDesktopApp() && /Android/i.test(navigator.userAgent);
    if (android) {
      let stop: (() => void) | undefined;
      let unmounted = false;
      void import('@tauri-apps/api/app').then(async ({ onBackButtonPress, exit }) => {
        const listener = await onBackButtonPress(() => { if (!stepBack()) void exit(0); });
        if (unmounted) void listener.unregister(); else stop = () => void listener.unregister();
      });
      return () => { unmounted = true; stop?.(); };
    }

    if (inDesktopApp()) return; // desktop window: no browser history to manage
    // the browser: one sentinel entry sits on top so the back button lands here instead of leaving the page
    const arm = () => window.history.pushState({ asterism: true }, '');
    arm();
    const onPop = () => { if (stepBack()) arm(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
