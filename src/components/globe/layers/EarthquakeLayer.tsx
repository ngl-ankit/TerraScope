'use client';

import { useMemo } from 'react';
import { InstancedMarkers, type MarkerPoint } from '@/components/globe/InstancedMarkers';
import { EARTHQUAKE_MAGNITUDE_BANDS } from '@/lib/api/sources';
import { useTerraScope } from '@/lib/store/useTerraScope';

/**
 * Earthquake layer.
 *
 * Magnitude → size and colour, using the same bands as the legend, so the
 * visual encoding is documented rather than decorative. Depth modulates the
 * lift above the surface: shallow events sit tight to the crust, deep ones ride
 * visibly higher, which reads as subduction at a glance.
 *
 * A second instanced pass draws halos on the strongest events only (magnitude
 * 5.0+). Pulsing every marker would turn the globe into a fairground; the halo
 * field is bounded to roughly a dozen markers even on a busy day.
 */

const HALO_MAGNITUDE_THRESHOLD = 5.0;
/** Hard ceiling protects frame time if a feed returns an unusual burst. */
const MAX_MARKERS = 260;

export function EarthquakeLayer() {
  const enabled = useTerraScope((s) => s.layers.earthquakes);
  const earthquakes = useTerraScope((s) => s.earthquakes.data);
  const selection = useTerraScope((s) => s.selection);
  const hoveredId = useTerraScope((s) => s.hoveredId);
  const select = useTerraScope((s) => s.select);
  const setHovered = useTerraScope((s) => s.setHovered);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  const selectedId = selection?.kind === 'earthquake' ? selection.item.id : null;

  const { dots, halos } = useMemo(() => {
    const visible = earthquakes.slice(0, MAX_MARKERS);
    const dots: MarkerPoint[] = [];
    const halos: MarkerPoint[] = [];

    for (const quake of visible) {
      const band =
        EARTHQUAKE_MAGNITUDE_BANDS.find((candidate, index) => {
          const lower = [2.5, 4.0, 5.0, 6.0][index];
          const upper = [3.9, 4.9, 5.9, Infinity][index];
          return quake.magnitude >= lower && quake.magnitude <= upper && candidate;
        }) ?? EARTHQUAKE_MAGNITUDE_BANDS[1];

      // Normalise the magnitude into a compact size multiplier.
      const scale = Math.max(0.7, Math.min(2.6, (quake.magnitude - 2) / 2.6));
      // Depth in kilometres maps to a small lift: 0 km → 0.003, 700 km → 0.016.
      const lift = 0.003 + Math.min(quake.depthKm, 700) / 700 * 0.013;

      dots.push({
        id: quake.id,
        lat: quake.lat,
        lon: quake.lon,
        color: band.color,
        scale,
        lift,
      });

      if (quake.magnitude >= HALO_MAGNITUDE_THRESHOLD) {
        halos.push({
          id: quake.id,
          lat: quake.lat,
          lon: quake.lon,
          color: band.color,
          scale: scale * 2.1,
          lift: lift + 0.002,
        });
      }
    }

    return { dots, halos };
  }, [earthquakes]);

  if (!enabled) return null;

  const findById = (id: string) => earthquakes.find((q) => q.id === id);

  return (
    <group>
      <InstancedMarkers
        points={dots}
        shape="sphere"
        baseScale={0.013}
        intensity={1.25}
        opacity={0.94}
        renderOrder={4}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={(id) => setHovered(id)}
        onSelect={(id) => {
          const item = findById(id);
          if (!item) return;
          select({ kind: 'earthquake', item });
          requestFlyTo(item.lat, item.lon, 1.75);
        }}
      />

      <InstancedMarkers
        points={halos}
        shape="halo"
        baseScale={0.05}
        lift={0.004}
        pulse
        opacity={0.5}
        renderOrder={3}
        selectedId={selectedId}
        hoveredId={hoveredId}
      />
    </group>
  );
}
