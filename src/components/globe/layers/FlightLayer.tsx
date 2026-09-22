'use client';

import { useMemo } from 'react';
import { InstancedMarkers, type MarkerPoint } from '@/components/globe/InstancedMarkers';
import { useTerraScope } from '@/lib/store/useTerraScope';

/**
 * OpenSky aircraft layer.
 *
 * Aircraft are drawn as heading-oriented chevrons. Colour encodes vertical
 * motion (climbing, descending, level) because that is the one piece of state
 * that is genuinely useful at a glance and cannot be read from position alone.
 *
 * Deliberate constraints:
 *  - Positions are re-projected only when the data changes (every 15s), not per
 *    frame. The globe does not interpolate: showing a guessed intermediate
 *    position for a live ADS-B fix would be inventing data.
 *  - Stale fixes (older than 90s) and ground traffic are filtered out.
 *  - The marker count is capped; the tightest sample region can return thousands.
 */

const MAX_AIRCRAFT = 600;
const MAX_AGE_SECONDS = 90;

const CLIMB_COLOR = '#7ee787';
const DESCEND_COLOR = '#ffd166';
const LEVEL_COLOR = '#4cc9f0';
const GROUND_COLOR = '#8b93a7';

export function FlightLayer() {
  const enabled = useTerraScope((s) => s.layers.flights);
  const flights = useTerraScope((s) => s.flights.data);
  const selection = useTerraScope((s) => s.selection);
  const hoveredId = useTerraScope((s) => s.hoveredId);
  const select = useTerraScope((s) => s.select);
  const setHovered = useTerraScope((s) => s.setHovered);

  const selectedId = selection?.kind === 'aircraft' ? selection.item.icao24 : null;

  const { planes, ground } = useMemo(() => {
    const planes: MarkerPoint[] = [];
    const ground: MarkerPoint[] = [];

    for (const aircraft of flights.aircraft) {
      if ((aircraft.ageSeconds ?? 0) > MAX_AGE_SECONDS) continue;

      // Altitude scaled into the marker shell: 0 m → 0.004, 12 km → 0.02.
      const lift = 0.004 + Math.min(Math.max(aircraft.altitudeM ?? 0, 0), 12_000) / 12_000 * 0.016;

      const point: MarkerPoint = {
        id: aircraft.icao24,
        lat: aircraft.lat,
        lon: aircraft.lon,
        heading: aircraft.headingDeg ?? 0,
        lift,
        scale: 1,
        color: aircraft.onGround
          ? GROUND_COLOR
          : aircraft.verticalRateMs === null || Math.abs(aircraft.verticalRateMs) < 0.6
            ? LEVEL_COLOR
            : aircraft.verticalRateMs > 0
              ? CLIMB_COLOR
              : DESCEND_COLOR,
      };

      if (aircraft.onGround) {
        if (ground.length < MAX_AIRCRAFT / 8) ground.push(point);
      } else if (planes.length < MAX_AIRCRAFT) {
        planes.push(point);
      }
    }

    return { planes, ground };
  }, [flights.aircraft]);

  if (!enabled) return null;

  const findById = (id: string) => flights.aircraft.find((a) => a.icao24 === id);

  const handleSelect = (id: string) => {
    const item = findById(id);
    if (!item) return;
    select({ kind: 'aircraft', item });
    // Aircraft are moving targets: frame them without re-centring the globe, so
    // a refresh 15 seconds later does not yank the camera.
  };

  return (
    <group>
      <InstancedMarkers
        points={planes}
        shape="plane"
        baseScale={0.016}
        intensity={1.15}
        opacity={0.92}
        renderOrder={5}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={(id) => setHovered(id)}
        onSelect={handleSelect}
      />

      {ground.length > 0 && (
        <InstancedMarkers
          points={ground}
          shape="sphere"
          baseScale={0.0045}
          intensity={1}
          opacity={0.5}
          renderOrder={4}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onHover={(id) => setHovered(id)}
          onSelect={handleSelect}
        />
      )}
    </group>
  );
}
