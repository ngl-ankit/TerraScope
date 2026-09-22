'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, Preload } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';

import { EarthMesh } from '@/components/globe/EarthMesh';
import { Atmosphere } from '@/components/globe/Atmosphere';
import { Starfield } from '@/components/globe/Starfield';
import { CameraRig } from '@/components/globe/CameraRig';
import { SelectionMarker } from '@/components/globe/SelectionMarker';
import { EarthquakeLayer } from '@/components/globe/layers/EarthquakeLayer';
import { NaturalEventsLayer } from '@/components/globe/layers/NaturalEventsLayer';
import { FlightLayer } from '@/components/globe/layers/FlightLayer';
import { AirQualityLayer } from '@/components/globe/layers/AirQualityLayer';
import { useDeviceProfile } from '@/lib/hooks/useDeviceProfile';
import { apiGet } from '@/lib/client/http';
import { useTerraScope } from '@/lib/store/useTerraScope';
import type { GeoPlace } from '@/lib/types';

/**
 * WebGL scene root.
 *
 * Loaded via `next/dynamic` with `ssr: false` from `Globe.tsx`, so the renderer,
 * three.js and every shader stay out of the initial JS bundle and the server
 * never attempts to render WebGL.
 *
 * Performance posture:
 *  - `dpr` is clamped by device tier; a 3x-DPR phone rendering at full
 *    resolution is the single most common cause of a janky globe.
 *  - `powerPreference` is only `high-performance` on desktop, so mobile can pick
 *    the integrated GPU and save battery.
 *  - Every animated value is a shared uniform, so per-frame CPU cost is a
 *    handful of uniform writes rather than React work.
 */
export default function GlobeScene() {
  const qualityOverride = useTerraScope((s) => s.qualityOverride);
  const profile = useDeviceProfile(qualityOverride);

  const { focusPlace, select } = useTerraScope(
    useShallow((s) => ({ focusPlace: s.focusPlace, select: s.select })),
  );

  const setBootStep = useTerraScope((s) => s.setBootStep);
  const setAutoRotate = useTerraScope((s) => s.setAutoRotate);
  const [contextLost, setContextLost] = useState(false);

  /* The renderer is the first boot step: mount success is the signal. */
  useEffect(() => {
    setBootStep('renderer', 'done');
  }, [setBootStep]);

  /**
   * Clicking the Earth surface (not a marker) resolves the coordinate to a
   * place: reverse geocode for the label, then select it. This is what makes
   * "click anywhere and get conditions" work.
   */
  const handleSurfaceClick = useCallback(
    async (lat: number, lon: number) => {
      // Optimistic selection, so the ring and the panel appear immediately.
      const provisional: GeoPlace = {
        id: `pin-${lat.toFixed(3)}-${lon.toFixed(3)}`,
        name: 'Selected coordinate',
        label: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
        detail: 'Resolving place name',
        lat,
        lon,
        kind: 'coordinate',
        importance: 0,
        boundingBox: null,
      };
      focusPlace(provisional);
      select({ kind: 'place', item: provisional });

      try {
        const envelope = await apiGet<string | null>(
          `/api/reverse-geocode?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
        );
        if (!envelope.data) return;
        const label = envelope.data;
        const resolved: GeoPlace = {
          ...provisional,
          name: label.split(',')[0]?.trim() || provisional.name,
          label,
          detail: label.split(',').slice(1, 4).join(',').trim() || 'Reverse geocoded',
        };
        focusPlace(resolved);
        select({ kind: 'place', item: resolved });
      } catch {
        // Reverse geocoding is a nicety: the pin remains usable without it.
        focusPlace({ ...provisional, detail: 'Place name unavailable' });
      }
    },
    [focusPlace, select],
  );

  const dpr: [number, number] =
    profile.tier === 'low' ? [0.75, 1.2] : profile.tier === 'medium' ? [1, 1.6] : [1, 2];

  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas
        dpr={dpr}
        frameloop="always"
        gl={{
          antialias: profile.tier !== 'low',
          powerPreference: profile.tier === 'high' ? 'high-performance' : 'default',
          alpha: false,
          stencil: false,
          depth: true,
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [1.6, 1.1, 2.1], fov: 42, near: 0.01, far: 120 }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(new THREE.Color('#04060d'), 1);
          scene.fog = null;
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              setContextLost(true);
            },
            { once: true },
          );
          gl.domElement.addEventListener('webglcontextrestored', () => setContextLost(false), { once: true });
        }}
        className="touch-none"
        aria-label="Interactive 3D globe of Earth"
      >
        <CameraRig />

        {/* The Earth is self-lit by its own day/night shader; these lights only
            matter to the marker shaders, so there is no ambient wash over the
            terminator. */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 3, 5]} intensity={0.4} />

        <Suspense fallback={null}>
          <Starfield count={profile.starCount} animate={profile.tier !== 'low'} />

          <group>
            <EarthMesh profile={profile} onSurfaceClick={handleSurfaceClick} />
            <Atmosphere enableOuterShell={profile.tier !== 'low'} animateSun={profile.animateTerminator} />
          </group>

          <EarthquakeLayer />
          <NaturalEventsLayer />
          <FlightLayer />
          <AirQualityLayer />
          <SelectionMarker />

          <Preload all />
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={profile.tier === 'low' ? 0.12 : 0.055}
          enablePan={false}
          rotateSpeed={profile.tier === 'low' ? 0.36 : 0.42}
          zoomSpeed={0.85}
          minDistance={1.18}
          maxDistance={6.2}
          minPolarAngle={0.08}
          maxPolarAngle={Math.PI - 0.08}
          autoRotate={false}
          enableZoom
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
          onStart={() => setAutoRotate(false)}
          target={[0, 0, 0]}
        />
      </Canvas>

      {contextLost && (
        <div
          role="alert"
          className="pointer-events-auto absolute inset-x-4 top-4 z-30 flex items-center gap-3 rounded-xl border border-layer-wildfire/40 bg-[rgba(24,10,6,0.92)] px-4 py-3 text-xs text-ink backdrop-blur-md sm:inset-x-auto sm:right-4 sm:max-w-sm"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-layer-wildfire" aria-hidden="true" />
          <span>The 3D renderer lost its graphics context. Reload the page to restore the globe.</span>
        </div>
      )}
    </div>
  );
}
