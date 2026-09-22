import { cached, TTL } from './cache';
import { UpstreamError } from './http';
import { fetchEarthquakes } from './earthquakes';
import { fetchNaturalEvents } from './eonet';
import { fetchFlights } from './flights';
import { fetchAirQuality } from './airQuality';
import { fetchWeather } from './weather';
import { geocode, reverseGeocode } from './geocode';
import { LAYER_MAP } from './sources';
import type { SourceMeta } from '@/lib/types';

/**
 * The single place that decides what "fresh" means for each provider.
 *
 * Every route handler goes through one of these functions, so the TTL, the
 * staleness labelling and the `observedAt` semantics are defined exactly once.
 */

export type Cadence = 'live' | 'periodic' | 'near-real-time';

function meta(
  layerId: keyof typeof LAYER_MAP,
  options: { observedAt: number | null; updatedAt: number; stale: boolean; cadence: Cadence },
): SourceMeta {
  const descriptor = LAYER_MAP[layerId];
  return {
    source: descriptor.source,
    sourceUrl: descriptor.sourceUrl,
    observedAt: options.observedAt,
    updatedAt: options.updatedAt,
    stale: options.stale,
    cadence: options.cadence,
    cadenceNote: descriptor.cadenceNote,
  };
}

export async function getEarthquakes(signal?: AbortSignal) {
  const outcome = await cached(
    { key: 'usgs:2.5_day', ttlMs: TTL.earthquakes() },
    () => fetchEarthquakes(signal),
  );
  return {
    data: outcome.value.earthquakes,
    meta: meta('earthquakes', {
      // USGS regenerates the summary feed every minute; that is the true
      // observation time, and it is what the UI reports.
      observedAt: outcome.value.generatedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'near-real-time',
    }),
    extra: { feedTitle: outcome.value.feedTitle, feedUrl: outcome.value.feedUrl },
  };
}

export async function getNaturalEvents(signal?: AbortSignal) {
  const outcome = await cached(
    { key: 'eonet:open:14d', ttlMs: TTL.eonet() },
    () => fetchNaturalEvents(signal),
  );
  return {
    data: outcome.value.events,
    meta: meta('naturalEvents', {
      observedAt: outcome.value.observedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'near-real-time',
    }),
  };
}

export async function getFlights(signal?: AbortSignal) {
  const outcome = await cached({ key: 'opensky:regions', ttlMs: TTL.flights() }, () => fetchFlights(signal));
  return {
    data: {
      observedAt: outcome.value.observedAt,
      aircraft: outcome.value.aircraft,
      coverage: outcome.value.coverage,
      regionLabel: outcome.value.regionLabel,
      notice: outcome.value.notice,
    },
    meta: meta('flights', {
      observedAt: outcome.value.observedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'live',
    }),
  };
}

export async function getAirQuality(signal?: AbortSignal) {
  const outcome = await cached(
    { key: 'openmeteo:aq:cities', ttlMs: TTL.airQuality() },
    () => fetchAirQuality(signal),
  );
  return {
    data: outcome.value.samples,
    meta: meta('airQuality', {
      observedAt: outcome.value.observedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'near-real-time',
    }),
  };
}

export async function getWeather(lat: number, lon: number, signal?: AbortSignal) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new UpstreamError('Latitude and longitude must be valid coordinates.', {
      code: 'invalid_request',
      status: 400,
      retryable: false,
      provider: 'Open-Meteo',
    });
  }

  // Rounded to ~1 km so that panning the globe does not cause a fetch storm.
  const key = `openmeteo:wx:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  const outcome = await cached({ key, ttlMs: 10 * 60 * 1000 }, () => fetchWeather(lat, lon, signal));

  return {
    data: outcome.value,
    meta: meta('weather', {
      observedAt: outcome.value.current.time ? new Date(outcome.value.current.time).getTime() : null,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'periodic',
    }),
  };
}

export async function getGeocode(query: string, signal?: AbortSignal) {
  const outcome = await cached(
    { key: `nominatim:search:${query.toLowerCase()}`, ttlMs: TTL.geocode() },
    () => geocode(query, 6, signal),
  );
  return {
    data: outcome.value,
    meta: {
      source: 'Nominatim / OpenStreetMap',
      sourceUrl: 'https://nominatim.openstreetmap.org/',
      observedAt: null,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'periodic' as Cadence,
      cadenceNote: 'Queried on demand, cached for 5 minutes',
    } satisfies SourceMeta,
  };
}

export async function getReverseGeocode(lat: number, lon: number, signal?: AbortSignal) {
  const key = `nominatim:reverse:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const outcome = await cached({ key, ttlMs: TTL.geocode() }, () => reverseGeocode(lat, lon, signal));
  return {
    data: outcome.value,
    meta: {
      source: 'Nominatim / OpenStreetMap',
      sourceUrl: 'https://nominatim.openstreetmap.org/',
      observedAt: null,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'periodic' as Cadence,
      cadenceNote: 'Queried on demand, cached for 5 minutes',
    } satisfies SourceMeta,
  };
}

export { UpstreamError };
