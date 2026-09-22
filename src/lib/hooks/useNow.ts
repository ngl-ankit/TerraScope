'use client';

import { useEffect, useState } from 'react';

/**
 * A ticking clock for relative-time labels.
 *
 * One interval per consumer group keeps the UI honest about freshness
 * ("Updated 42 seconds ago") without re-rendering the whole tree every second:
 * `intervalMs` is deliberately coarse, and the value only changes when the
 * displayed string would.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

/** UTC wall clock, formatted, for the status bar. */
export function useUtcClock(): { time: string; date: string } {
  const now = useNow(1000);
  const date = new Date(now);
  return {
    time: date.toISOString().slice(11, 19),
    date: date.toISOString().slice(0, 10),
  };
}

/** Tracks `navigator.onLine` plus the browser's connectivity events. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}

/** Tracks fullscreen state for the fullscreen toggle. */
export function useFullscreen(): { isFullscreen: boolean; toggle: () => void; supported: boolean } {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return {
    isFullscreen,
    toggle,
    supported: typeof document !== 'undefined' && document.fullscreenEnabled === true,
  };
}
