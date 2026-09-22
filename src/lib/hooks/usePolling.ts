import { useCallback, useEffect, useRef } from 'react';

/**
 * Interval polling that behaves itself.
 *
 * Design notes:
 *  - A chained `setTimeout` (not `setInterval`) guarantees a slow response can
 *    never cause overlapping requests.
 *  - Polling pauses while the tab is hidden and fires once immediately on
 *    return, so a background tab costs nothing.
 *  - Failures back off exponentially (up to 8x the base interval) instead of
 *    hammering a provider that is already struggling.
 *  - Every in-flight request is aborted on unmount or when `enabled` flips.
 */

export interface UsePollingOptions {
  /** When false the timer is cleared and any in-flight request aborted. */
  enabled: boolean;
  /** Base interval between successful refreshes, in milliseconds. */
  intervalMs: number;
  /** Must be stable (wrap in `useCallback`) — it is a dependency of the loop. */
  run: (signal: AbortSignal) => Promise<void>;
  /** When false, no request fires until `refresh()` is called. Defaults to true. */
  immediate?: boolean;
}

export interface UsePollingResult {
  /** Trigger a refresh now (used by retry buttons). */
  refresh: () => void;
  /** Suspend/resume without unmounting the consumer. */
  setPaused: (paused: boolean) => void;
}

export function usePolling({ enabled, intervalMs, run, immediate = true }: UsePollingOptions): UsePollingResult {
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureRef = useRef(0);
  const pausedRef = useRef(false);
  const runRef = useRef(run);
  const immediateRef = useRef(immediate);
  const startedRef = useRef(false);

  // Keep the latest callback without restarting the polling loop.
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const tick = useCallback(async () => {
    if (pausedRef.current) return;

    abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      await runRef.current(controller.signal);
      failureRef.current = 0;
    } catch (error) {
      // An abort is a normal part of the lifecycle, not a failure to back off from.
      if ((error as Error)?.name === 'AbortError') return;
      failureRef.current = Math.min(failureRef.current + 1, 4);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [abort]);

  const schedule = useCallback(() => {
    clearTimer();
    if (!enabled || pausedRef.current) return;
    // Exponential backoff: 1x, 2x, 4x, 8x (capped at 4 doublings).
    const backoff = Math.pow(2, failureRef.current);
    const delay = Math.min(intervalMs * backoff, intervalMs * 8);
    timerRef.current = setTimeout(() => {
      void tick().then(() => schedule());
    }, delay);
  }, [clearTimer, enabled, intervalMs, tick]);

  const refresh = useCallback(() => {
    failureRef.current = 0;
    clearTimer();
    if (!enabled || pausedRef.current) return;
    void tick().then(() => schedule());
  }, [clearTimer, enabled, schedule, tick]);

  const setPaused = useCallback(
    (paused: boolean) => {
      pausedRef.current = paused;
      if (paused) {
        clearTimer();
        abort();
      } else if (enabled) {
        refresh();
      }
    },
    [abort, clearTimer, enabled, refresh],
  );

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      abort();
      startedRef.current = false;
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      if (immediateRef.current) {
        void tick().then(() => schedule());
      } else {
        schedule();
      }
    } else {
      schedule();
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Returning to the tab: refresh once, then resume the normal cadence.
        refresh();
      } else {
        clearTimer();
        abort();
      }
    };

    const onOnline = () => refresh();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      clearTimer();
      abort();
    };
  }, [abort, clearTimer, enabled, refresh, schedule, tick]);

  return { refresh, setPaused };
}
