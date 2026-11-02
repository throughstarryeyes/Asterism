import { useEffect, useRef, useState } from 'react';

// run slow work after the page has painted, so a loading state shows first
// after the first result, changes wait for a pause (default 700 ms) and the last result stays on screen meanwhile
export function useDeferred<T>(compute: () => T | Promise<T>, deps: readonly unknown[], options: { enabled?: boolean; pause?: number } = {}): { value: T | null; pending: boolean } {
  const { enabled = true, pause = 700 } = options;
  const [value, setValue] = useState<T | null>(null);
  const [pending, setPending] = useState(enabled);
  const latest = useRef(compute);
  latest.current = compute;
  const first = useRef(true);
  // the newest request; an older one that finishes late is dropped
  const latestRun = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(null);
      setPending(false);
      first.current = true;
      return undefined;
    }
    setPending(true);
    const run = ++latestRun.current;
    const timer = setTimeout(() => {
      Promise.resolve(latest.current()).then(result => {
        if (run !== latestRun.current) return;
        setValue(result);
        setPending(false);
        first.current = false;
      }, () => { if (run === latestRun.current) setPending(false); });
    }, first.current ? 40 : pause);
    return () => { clearTimeout(timer); latestRun.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pause, ...deps]);

  return { value, pending };
}
