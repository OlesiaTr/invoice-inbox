import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

/**
 * Subscribes to a CSS media query. The MediaQueryList is created inside the hook, not at
 * module scope, so importing this module doesn't require a DOM (tests, any SSR later).
 */
export function useMediaQuery(query: string): boolean {
  const list = useMemo(() => (typeof window === 'undefined' ? null : window.matchMedia(query)), [query]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!list) return () => undefined;
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [list],
  );

  return useSyncExternalStore(
    subscribe,
    () => list?.matches ?? false,
    () => false,
  );
}

/**
 * Re-renders on an interval so relative timestamps ("2 minutes ago") keep up. Without it
 * they are frozen at whatever the last data fetch rendered.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
