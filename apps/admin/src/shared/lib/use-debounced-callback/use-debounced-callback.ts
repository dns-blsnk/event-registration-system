import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Calls `callback` once input has paused for `delayMs`; a newer call replaces a pending one.
 * Returns the scheduler and a way to drop the pending call (applied at once, or cleared).
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): { schedule: (...args: TArgs) => void; cancel: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(callback);
  // Kept current after each commit, so a pending call uses the latest props, not a stale render's.
  useLayoutEffect(() => {
    latest.current = callback;
  });
  // A pending call must not fire after the field is gone (page left, filters reset).
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const cancel = (): void => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  return {
    schedule: (...args) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        latest.current(...args);
      }, delayMs);
    },
    cancel,
  };
}
