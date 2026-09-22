'use client';

import { useMemo } from 'react';
import { InstancedMarkers, type MarkerPoint } from '@/components/globe/InstancedMarkers';
import { aqiCategory } from '@/lib/api/sources';
import { useTerraScope } from '@/lib/store/useTerraScope';

/**
 * Air-quality layer.
 *
 * One marker per sampled city, coloured by European AQI band, with the marker
 * radius scaled by the index. The panel copy is explicit that this is a
 * 32-city sample from an hourly model, not a global measurement field.
 */

const MAX_INDEX = 120;

export function AirQualityLayer() {
  const enabled = useTerraScope((s) => s.layers.airQuality);
  const samples = useTerraScope((s) => s.airQuality.data);
  const selection = useTerraScope((s) => s.selection);
  const hoveredId = useTerraScope((s) => s.hoveredId);
  const select = useTerraScope((s) => s.select);
  const setHovered = useTerraScope((s) => s.setHovered);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  const selectedId = selection?.kind === 'airQuality' ? `${selection.item.name}-${selection.item.lat}` : null;

  const { dots, halos } = useMemo(() => {
    const dots: MarkerPoint[] = [];
    const halos: MarkerPoint[] = [];

    for (const sample of samples) {
      const id = `${sample.name}-${sample.lat}`;
      const { color } = aqiCategory(sample.europeanAqi);
      const scale = 0.6 + Math.min(Math.max(sample.europeanAqi ?? 0, 0), MAX_INDEX) / MAX_INDEX * 1.4;

      dots.push({ id, lat: sample.lat, lon: sample.lon, color, scale, lift: 0.008 });

      // Halo only for genuinely poor air, so the signal stands out.
      if (sample.europeanAqi !== null && sample.europeanAqi > 60) {
        halos.push({ id, lat: sample.lat, lon: sample.lon, color, scale: scale * 1.6, lift: 0.009 });
      }
    }

    return { dots, halos };
  }, [samples]);

  if (!enabled || samples.length === 0) return null;

  return (
    <group>
      <InstancedMarkers
        points={dots}
        shape="sphere"
        baseScale={0.012}
        intensity={1.15}
        opacity={0.88}
        renderOrder={4}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={(id) => setHovered(id)}
        onSelect={(id) => {
          const item = samples.find((s) => `${s.name}-${s.lat}` === id);
          if (!item) return;
          select({ kind: 'airQuality', item });
          requestFlyTo(item.lat, item.lon, 1.9);
        }}
      />

      <InstancedMarkers
        points={halos}
        shape="halo"
        baseScale={0.05}
        lift={0.009}
        pulse
        opacity={0.38}
        renderOrder={3}
        selectedId={selectedId}
        hoveredId={hoveredId}
      />
    </group>
  );
}
