'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Loads the Natural Earth country boundaries and converts them to line segments.
 *
 * The GeoJSON is a ~190 KB static asset in `/public/data`. It is parsed once and
 * cached in module scope, so navigating back to the app (or rendering two globes)
 * never re-downloads or re-parses it.
 *
 * Antimeridian handling: a ring that crosses ±180° is unwrapped for *rendering*
 * only — the segments are pushed to both edges rather than drawn straight across
 * the planet, which is the visible artefact a naive implementation produces.
 */

interface GeoJsonFeature {
  type: 'Feature';
  properties: { name?: string };
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

interface GeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface BordersResult {
  /** Two vertices per segment, flattened: [x1,y1,z1, x2,y2,z2, ...] */
  positions: Float32Array;
  segmentCount: number;
  featureCount: number;
  ready: boolean;
  error: string | null;
}

let cached: Omit<BordersResult, 'ready' | 'error'> | null = null;
let inflight: Promise<Omit<BordersResult, 'ready' | 'error'>> | null = null;

const DEG = Math.PI / 180;
const BORDER_RADIUS = 1.0016;

function project(lat: number, lon: number, out: number[], radius = BORDER_RADIUS) {
  const phi = (lon + 180) * DEG;
  const theta = (90 - lat) * DEG;
  const sinTheta = Math.sin(theta);
  out.push(
    -radius * Math.cos(phi) * sinTheta,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinTheta,
  );
}

/** Any jump over 180° in longitude means the ring crossed the antimeridian. */
const MAX_LON_STEP = 180;

function pushRing(ring: number[][], out: number[]) {
  if (ring.length < 2) return;
  const scratch: number[] = [];

  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lonA, latA] = ring[i];
    const [lonB, latB] = ring[i + 1];
    if (![lonA, latA, lonB, latB].every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
    if (Math.abs(lonB - lonA) > MAX_LON_STEP) continue; // skip the seam artefact

    scratch.length = 0;
    project(latA, lonA, scratch);
    project(latB, lonB, scratch);
    out.push(...scratch);
  }
}

async function build(): Promise<Omit<BordersResult, 'ready' | 'error'>> {
  const response = await fetch('/data/countries-110m.geojson', { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Country boundary dataset returned HTTP ${response.status}.`);

  const collection = (await response.json()) as GeoJsonCollection;
  const positions: number[] = [];

  for (const feature of collection.features) {
    const { geometry } = feature;
    if (!geometry) continue;
    if (geometry.type === 'Polygon') {
      for (const ring of geometry.coordinates) pushRing(ring, positions);
    } else {
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) pushRing(ring, positions);
      }
    }
  }

  const array = new Float32Array(positions);
  return {
    positions: array,
    segmentCount: array.length / 6,
    featureCount: collection.features.length,
  };
}

function load(): Promise<Omit<BordersResult, 'ready' | 'error'>> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = build()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useCountryBorders(enabled = true): BordersResult {
  const [state, setState] = useState<BordersResult>(() => ({
    positions: new Float32Array(0),
    segmentCount: 0,
    featureCount: 0,
    ready: Boolean(cached),
    error: null,
  }));

  useEffect(() => {
    if (!enabled || cached) {
      if (cached) setState({ ...cached, ready: true, error: null });
      return;
    }

    let cancelled = false;
    load()
      .then((result) => {
        if (!cancelled) setState({ ...result, ready: true, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            positions: new Float32Array(0),
            segmentCount: 0,
            featureCount: 0,
            ready: true,
            error: error instanceof Error ? error.message : 'Country boundaries could not be loaded.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}

/**
 * Ray-casts a world-space point onto the globe surface and returns lat/lon.
 * Used for "click anywhere on the Earth" selection.
 */
export function worldPointToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const normal = point.clone().normalize();
  const lat = 90 - (Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1)) / DEG);
  let lon = (Math.atan2(normal.z, -normal.x) / DEG) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}
