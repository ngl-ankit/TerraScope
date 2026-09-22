'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { latLngToVector3 } from '@/lib/utils/geo';
import { formatCoordinates } from '@/lib/utils/format';

/**
 * Selection + focus indicator.
 *
 * Drawn as a `THREE.Line` ring lying flat on the local tangent plane rather than
 * an imported model: a circle is exactly what is needed, it scales cleanly at
 * any camera distance, and it costs one draw call. The object is built
 * imperatively and mounted with `<primitive>` because the JSX name `<line>`
 * resolves to the SVG element, not the three.js one.
 *
 * The screen-space label is `drei`'s `Html`, which anchors DOM to a 3D point —
 * the reason a label can sit precisely over a coordinate without a second
 * projection pipeline.
 */

interface RingProps {
  lat: number;
  lon: number;
  color: string;
  radius?: number;
  lift?: number;
  opacity?: number;
}

export function SurfaceRing({
  lat,
  lon,
  color,
  radius = 0.03,
  lift = 0.004,
  opacity = 0.85,
}: RingProps) {
  const groupRef = useRef<THREE.Group>(null);

  const ring = useMemo(() => {
    const segments = 72;
    const positions = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 6;

    const position = latLngToVector3(lat, lon, 1 + lift);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      position.clone().normalize(),
    );

    return { line, position, quaternion };
  }, [color, lat, lift, lon, opacity, radius]);

  useLayoutEffect(
    () => () => {
      ring.line.geometry.dispose();
      (ring.line.material as THREE.Material).dispose();
    },
    [ring],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // A gentle breathing scale distinguishes the selection ring from static
    // markers without any glow or neon.
    groupRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.1) * 0.08);
  });

  return (
    <group ref={groupRef} position={ring.position} quaternion={ring.quaternion}>
      <primitive object={ring.line} />
    </group>
  );
}

export function SelectionMarker() {
  const selection = useTerraScope((s) => s.selection);
  const focusedPlace = useTerraScope((s) => s.focusedPlace);

  const target = useMemo(() => {
    if (!selection) return null;
    switch (selection.kind) {
      case 'earthquake':
        return {
          id: selection.item.id,
          lat: selection.item.lat,
          lon: selection.item.lon,
          color: '#ff8a4c',
          label: selection.item.place,
          meta: `M ${selection.item.magnitude.toFixed(1)} · ${selection.item.depthKm.toFixed(0)} km deep`,
        };
      case 'naturalEvent':
        return {
          id: selection.item.id,
          lat: selection.item.lat,
          lon: selection.item.lon,
          color: '#8b9dff',
          label: selection.item.title,
          meta: selection.item.categoryLabel,
        };
      case 'aircraft':
        return {
          id: selection.item.icao24,
          lat: selection.item.lat,
          lon: selection.item.lon,
          color: '#7ee787',
          label: selection.item.callsign ?? selection.item.icao24.toUpperCase(),
          meta: 'Live aircraft position',
        };
      case 'place':
        return {
          id: selection.item.id,
          lat: selection.item.lat,
          lon: selection.item.lon,
          color: '#4cc9f0',
          label: selection.item.name,
          meta: selection.item.detail || selection.item.kind,
        };
      case 'airQuality':
        return {
          id: `${selection.item.name}-${selection.item.lat}`,
          lat: selection.item.lat,
          lon: selection.item.lon,
          color: '#c084fc',
          label: selection.item.name,
          meta: `European AQI ${selection.item.europeanAqi ?? '--'}`,
        };
      default:
        return null;
    }
  }, [selection]);

  return (
    <group>
      {target && (
        <>
          <SurfaceRing lat={target.lat} lon={target.lon} color={target.color} radius={0.034} />
          <MarkerLabel
            lat={target.lat}
            lon={target.lon}
            title={target.label}
            subtitle={target.meta}
            coordinates={formatCoordinates(target.lat, target.lon, 2)}
            accent={target.color}
          />
        </>
      )}

      {/* The focused search result keeps its own ring so the user can see both
          the searched location and whatever they selected on top of it. */}
      {focusedPlace && (
        <SurfaceRing
          lat={focusedPlace.lat}
          lon={focusedPlace.lon}
          color="#4cc9f0"
          radius={0.052}
          lift={0.003}
          opacity={0.5}
        />
      )}
    </group>
  );
}

interface MarkerLabelProps {
  lat: number;
  lon: number;
  title: string;
  subtitle?: string;
  coordinates?: string;
  accent: string;
}

/**
 * Screen-space label anchored to a coordinate.
 *
 * Occlusion raycasting per label is expensive when several are on screen, so it
 * is not used. Instead the label is only rendered for the single current
 * selection, which makes the cost bounded and predictable.
 */
export function MarkerLabel({ lat, lon, title, subtitle, coordinates, accent }: MarkerLabelProps) {
  const position = useMemo(() => latLngToVector3(lat, lon, 1.03), [lat, lon]);

  return (
    <Html
      position={position}
      center
      distanceFactor={2.4}
      zIndexRange={[24, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className="pointer-events-none flex -translate-y-full flex-col items-center gap-1 pb-2">
        <div className="max-w-[220px] rounded-lg border border-white/[0.12] bg-[rgba(6,10,20,0.88)] px-2.5 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <span className="truncate text-[11px] font-semibold leading-none text-ink">{title}</span>
          </div>
          {(subtitle || coordinates) && (
            <div className="mono mt-1 flex items-center gap-1.5 text-[10px] leading-none text-ink-muted">
              {subtitle && <span className="truncate">{subtitle}</span>}
              {subtitle && coordinates && <span className="text-ink-faint">·</span>}
              {coordinates && <span className="truncate">{coordinates}</span>}
            </div>
          )}
        </div>
        <span className="h-3 w-px" style={{ backgroundColor: `${accent}66` }} aria-hidden="true" />
      </div>
    </Html>
  );
}
