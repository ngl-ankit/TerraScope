'use client';

import { useMemo } from 'react';
import { InstancedMarkers, TrackLine, type MarkerPoint } from '@/components/globe/InstancedMarkers';
import { CATEGORY_COLORS } from '@/lib/api/sources';
import { useTerraScope } from '@/lib/store/useTerraScope';

/**
 * NASA EONET natural-events layer.
 *
 * Two visual encodings beyond a plain dot:
 *  - Category colour, from a shared token map, so wildfires / storms / volcanoes
 *    are distinguishable without reading the legend.
 *  - Storm tracks: events with more than one observed geometry (hurricanes,
 *    long-lived fires) get a polyline through every observation, which is the
 *    most informative thing EONET publishes.
 *
 * Tracks are capped to the 40 most recent multi-point events. Each track is a
 * separate line draw call, so an unbounded count would be the one place this
 * layer could hurt frame time.
 */

const MAX_MARKERS = 320;
const MAX_TRACKS = 40;

export function NaturalEventsLayer() {
  const enabled = useTerraScope((s) => s.layers.naturalEvents);
  const events = useTerraScope((s) => s.naturalEvents.data);
  const selection = useTerraScope((s) => s.selection);
  const hoveredId = useTerraScope((s) => s.hoveredId);
  const select = useTerraScope((s) => s.select);
  const setHovered = useTerraScope((s) => s.setHovered);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  const selectedId = selection?.kind === 'naturalEvent' ? selection.item.id : null;

  const { dots, halos, tracks } = useMemo(() => {
    const dots: MarkerPoint[] = [];
    const halos: MarkerPoint[] = [];
    const tracks: Array<{ id: string; color: string; points: Array<{ lat: number; lon: number }> }> = [];

    let trackCount = 0;

    for (const event of events.slice(0, MAX_MARKERS)) {
      const primary = event.categories[0] ?? 'other';
      const color = CATEGORY_COLORS[primary] ?? CATEGORY_COLORS.other;

      // Storms are the headline category, so they get a moat of scale on top of
      // their colour to stay legible against dense seismic clusters.
      const emphasis = primary === 'severeStorms' || primary === 'volcanoes' ? 1.25 : 1;

      dots.push({
        id: event.id,
        lat: event.lat,
        lon: event.lon,
        color,
        scale: emphasis,
        lift: 0.006,
      });

      if (primary === 'severeStorms' || primary === 'volcanoes') {
        halos.push({ id: event.id, lat: event.lat, lon: event.lon, color, scale: emphasis * 1.7, lift: 0.007 });
      }

      if (event.track.length > 1 && trackCount < MAX_TRACKS) {
        tracks.push({
          id: event.id,
          color,
          points: event.track.map((point) => ({ lat: point.lat, lon: point.lon })),
        });
        trackCount += 1;
      }
    }

    return { dots, halos, tracks };
  }, [events]);

  if (!enabled) return null;

  const findById = (id: string) => events.find((e) => e.id === id);

  return (
    <group>
      {tracks.map((track) => (
        <TrackLine key={track.id} points={track.points} color={track.color} lift={0.0045} opacity={0.42} />
      ))}

      <InstancedMarkers
        points={dots}
        shape="sphere"
        baseScale={0.011}
        intensity={1.2}
        opacity={0.9}
        renderOrder={4}
        selectedId={selectedId}
        hoveredId={hoveredId}
        onHover={(id) => setHovered(id)}
        onSelect={(id) => {
          const item = findById(id);
          if (!item) return;
          select({ kind: 'naturalEvent', item });
          requestFlyTo(item.lat, item.lon, 2);
        }}
      />

      <InstancedMarkers
        points={halos}
        shape="halo"
        baseScale={0.046}
        lift={0.007}
        pulse
        opacity={0.42}
        renderOrder={3}
        selectedId={selectedId}
        hoveredId={hoveredId}
      />
    </group>
  );
}
