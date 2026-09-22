'use client';

import { useEffect, useState } from 'react';

/** SSR-safe media query subscription. Returns false during server render. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    }
    // Safari < 14 fallback.
    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, [query]);

  return matches;
}

export const BREAKPOINTS = {
  xs: '(min-width: 320px)',
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  xxl: '(min-width: 1440px)',
} as const;

export function useIsMobile(): boolean {
  // 768px is the tablet/mobile split the whole layout keys off.
  return !useMediaQuery(BREAKPOINTS.md);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(BREAKPOINTS.lg);
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

export function usePrefersContrast(): boolean {
  return useMediaQuery('(prefers-contrast: more)');
}
