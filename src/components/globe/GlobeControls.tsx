'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Minus, Pause, Play, Plus, RotateCcw, Target } from 'lucide-react';
import { apiGet } from '@/lib/client/http';
import { useFullscreen } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import type { GeoPlace } from '@/lib/types';

/**
 * On-canvas camera controls.
 *
 * Every control is a real button with an accessible name and a ≥40px touch
 * target on mobile. Nothing here is decorative: each maps to a store action the
 * camera rig or the globe honours.
 */
export function GlobeControls() {
  const requestZoom = useTerraScope((s) => s.requestZoom);
  const resetView = useTerraScope((s) => s.resetView);
  const autoRotate = useTerraScope((s) => s.autoRotate);
  const toggleAutoRotate = useTerraScope((s) => s.toggleAutoRotate);
  const focusPlace = useTerraScope((s) => s.focusPlace);
  const select = useTerraScope((s) => s.select);
  const setNotice = useTerraScope((s) => s.setNotice);

  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen();
  const [locating, setLocating] = useState(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  /** Uses the browser's own geolocation to frame the user's position. */
  const handleLocate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setNotice('This browser does not expose a location API.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const provisional: GeoPlace = {
          id: `geo-${latitude.toFixed(3)}-${longitude.toFixed(3)}`,
          name: 'Your location',
          label: 'Your location',
          detail: 'Reported by this device',
          lat: latitude,
          lon: longitude,
          kind: 'coordinate',
          importance: 0,
          boundingBox: null,
        };
        if (!mountedRef.current) return;
        focusPlace(provisional);
        select({ kind: 'place', item: provisional });
        setLocating(false);

        try {
          const envelope = await apiGet<string | null>(
            `/api/reverse-geocode?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`,
          );
          if (envelope.data && mountedRef.current) {
            const resolved: GeoPlace = {
              ...provisional,
              name: envelope.data.split(',')[0]?.trim() || provisional.name,
              label: envelope.data,
            };
            focusPlace(resolved);
            select({ kind: 'place', item: resolved });
          }
        } catch {
          // The pinned coordinate is still valid without a place name.
        }
      },
      (error) => {
        if (!mountedRef.current) return;
        setLocating(false);
        setNotice(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Your location could not be determined.',
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  }, [focusPlace, select, setNotice]);

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5" role="group" aria-label="Globe camera controls">
      <ControlButton
        label={autoRotate ? 'Pause automatic rotation' : 'Resume automatic rotation'}
        onClick={toggleAutoRotate}
        active={autoRotate}
      >
        {autoRotate ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
      </ControlButton>

      <ControlButton label="Zoom in" onClick={() => requestZoom('in')}>
        <Plus size={15} aria-hidden="true" />
      </ControlButton>

      <ControlButton label="Zoom out" onClick={() => requestZoom('out')}>
        <Minus size={15} aria-hidden="true" />
      </ControlButton>

      <ControlButton label="Fit the whole globe in view" onClick={resetView}>
        <RotateCcw size={15} aria-hidden="true" />
      </ControlButton>

      <ControlButton label="Centre the globe on your location" onClick={handleLocate} busy={locating}>
        <Target size={15} aria-hidden="true" />
      </ControlButton>

      {fullscreenSupported && (
        <ControlButton label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
        </ControlButton>
      )}
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  busy?: boolean;
}

function ControlButton({ label, onClick, children, active = false, busy = false }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={busy}
      className={`glass-soft flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted shadow-raised transition duration-150 hover:border-accent/40 hover:text-ink active:scale-[0.94] disabled:opacity-50 lg:h-9 lg:w-9 ${
        active ? 'border-accent/40 text-accent-soft' : ''
      }`}
    >
      {busy ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-t-accent" />
      ) : (
        children
      )}
    </button>
  );
}

/** Compact interaction hint, auto-dismissed and hidden on touch devices. */
export function GlobeHint() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDismissed(true), 9000);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <div className="pointer-events-none hidden select-none items-center gap-2 rounded-full border border-white/[0.07] bg-[rgba(6,10,20,0.6)] px-3 py-1.5 text-2xs text-ink-faint backdrop-blur-md lg:flex">
      <span>Drag to orbit · scroll to zoom · click a marker or the surface for detail</span>
    </div>
  );
}
