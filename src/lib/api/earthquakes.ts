import { fetchJson } from './http';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/format';
import type { Earthquake } from '@/lib/types';

/**
 * USGS Earthquake Hazards Program — GeoJSON summary feeds.
 *
 * Feed choice: `2.5_day` (magnitude 2.5+, last 24 hours). It is the densest
 * feed that still yields a readable globe; the 4.5+ feeds are too sparse to
 * demonstrate the layer, and `all_day` produces thousands of sub-2.5 events.
 *
 * Docs: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 */

const FEED_PATH = '2.5_day.geojson';

export interface UsgsFeatureCollection {
  type: 'FeatureCollection';
  metadata?: {
    generated?: number;
    url?: string;
    title?: string;
    status?: number;
    count?: number;
  };
  features: Array<{
    type: 'Feature';
    id: string;
    properties: Record<string, unknown>;
    geometry: { type: 'Point'; coordinates: [number, number, number?] } | null;
  }>;
  bbox?: number[];
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export interface EarthquakePayload {
  earthquakes: Earthquake[];
  /** Feed generation time reported by USGS, used as `observedAt`. */
  generatedAt: number | null;
  feedTitle: string;
  feedUrl: string;
}

export function feedUrl(): string {
  const base = process.env.USGS_FEED_BASE_URL ?? 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';
  return `${base.replace(/\/$/, '')}/${FEED_PATH}`;
}

/** Normalises the raw feed into the internal `Earthquake` shape. */
export function normaliseEarthquakes(collection: UsgsFeatureCollection): EarthquakePayload {
  const earthquakes: Earthquake[] = [];

  for (const feature of collection.features ?? []) {
    const props = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) continue;

    const lon = numberOrNull(coordinates[0]);
    const lat = numberOrNull(coordinates[1]);
    const depth = numberOrNull(coordinates[2]);
    const magnitude = numberOrNull(props.mag);
    const time = numberOrNull(props.time);

    // An event without a magnitude or a timestamp cannot be placed on the globe.
    if (lat === null || lon === null || magnitude === null || time === null) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    earthquakes.push({
      id: sanitizeText(feature.id, 64) || `usgs-${time}-${lat}-${lon}`,
      magnitude,
      place: sanitizeText(props.place, 160) || 'Location not reported',
      time,
      updated: numberOrNull(props.updated) ?? time,
      depthKm: depth ?? 0,
      lat,
      lon,
      url: sanitizeUrl(props.url) ?? 'https://earthquake.usgs.gov/earthquakes/map/',
      detailUrl: sanitizeUrl(props.detail),
      status: typeof props.status === 'string' ? sanitizeText(props.status, 24) : null,
      tsunami: props.tsunami === 1,
      felt: numberOrNull(props.felt),
      alert: typeof props.alert === 'string' ? sanitizeText(props.alert, 24) : null,
      significance: numberOrNull(props.sig),
      magType: typeof props.magType === 'string' ? sanitizeText(props.magType, 12) : null,
      network: typeof props.net === 'string' ? sanitizeText(props.net, 16) : null,
    });
  }

  // Strongest first: the marker pass and the event list both read better this way.
  earthquakes.sort((a, b) => b.magnitude - a.magnitude || b.time - a.time);

  return {
    earthquakes,
    generatedAt: numberOrNull(collection.metadata?.generated),
    feedTitle: sanitizeText(collection.metadata?.title, 120) || 'USGS earthquake summary',
    feedUrl: sanitizeUrl(collection.metadata?.url) ?? feedUrl(),
  };
}

export async function fetchEarthquakes(signal?: AbortSignal): Promise<EarthquakePayload> {
  const url = feedUrl();
  const collection = await fetchJson<UsgsFeatureCollection>(url, {
    provider: 'USGS',
    timeoutMs: 14_000,
    signal,
  });
  return normaliseEarthquakes(collection);
}
