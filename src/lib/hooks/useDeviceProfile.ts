'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery, usePrefersReducedMotion } from './useMediaQuery';

/**
 * Device capability tier.
 *
 * Drives the real performance levers: sphere tessellation, star count, texture
 * resolution, marker animation and the starfield itself. Deliberately
 * conservative — a wrong "high" guess degrades the experience on the exact
 * devices that can least afford it.
 */
export type QualityTier = 'low' | 'medium' | 'high';

export interface DeviceProfile {
  tier: QualityTier;
  /** True when the device reports few cores or very little memory. */
  constrained: boolean;
  isTouch: boolean;
  isMobile: boolean;
  reducedMotion: boolean;
  /** True when the user explicitly forced a tier from the UI. */
  overridden: boolean;
  /** Sphere width/height segments for the Earth mesh. */
  globeSegments: number;
  starCount: number;
  /** Which texture set to load (2048px assets are ~3x smaller). */
  textureSize: '2k' | '4k';
  /** Whether markers may pulse/animate. */
  animateMarkers: boolean;
  /** Whether the day/night terminator may be recomputed every minute. */
  animateTerminator: boolean;
}

export function useDeviceProfile(override?: QualityTier | 'auto'): DeviceProfile {
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const isTouch = useMediaQuery('(hover: none)');
  const reducedMotion = usePrefersReducedMotion();
  const [detected, setDetected] = useState<{ tier: QualityTier; constrained: boolean }>({
    tier: 'medium',
    constrained: false,
  });

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const dpr = window.devicePixelRatio || 1;
    const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 500;

    const constrained = cores <= 4 || memory <= 4;

    let tier: QualityTier = 'high';
    if (cores <= 2 || memory <= 2) tier = 'low';
    else if (constrained || (smallViewport && dpr > 2)) tier = 'medium';

    setDetected({ tier, constrained });
  }, []);

  const tier: QualityTier = override && override !== 'auto' ? override : detected.tier;

  return useMemo<DeviceProfile>(() => {
    const low = tier === 'low';
    const medium = tier === 'medium';

    return {
      tier,
      constrained: detected.constrained,
      isTouch,
      isMobile,
      reducedMotion,
      overridden: Boolean(override && override !== 'auto'),
      globeSegments: low ? 48 : medium ? 72 : 128,
      starCount: low ? 900 : medium ? 2200 : 5200,
      textureSize: low || medium ? '2k' : '4k',
      animateMarkers: !reducedMotion && !low,
      animateTerminator: !reducedMotion,
    };
  }, [detected.constrained, isTouch, isMobile, override, reducedMotion, tier]);
}
