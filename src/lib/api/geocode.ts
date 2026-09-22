import { fetchJson } from './http';
import { sanitizeText } from '@/lib/utils/format';
import type { GeoPlace } from '@/lib/types';

/**
 * Nominatim (OpenStreetMap) geocoding.
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * requires: a descriptive User-Agent, no more than one request per second, no
 * bulk geocoding, and caching of results. TerraScope complies by:
 *
 *  - sending a configurable identifying User-Agent (NOMINATIM_USER_AGENT);
 *  - enforcing a 1.1s minimum gap between outbound calls, process-wide;
 *  - caching results for five minutes;
 *  - only ever issuing on-demand, single-query lookups.
 */

export function nominatimBaseUrl(): string {
  return (process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
}

function userAgent(): string {
  const base = process.env.NOMINATIM_USER_AGENT ?? 'TerraScope/1.0 (+https://github.com/ngl-ankit/TerraScope)';
  const email = process.env.NOMINATIM_EMAIL;
  return email ? `${base} ${email}` : base;
}

/**
 * Process-wide rate limiter.
 *
 * A simple promise chain guarantees the minimum gap even when several requests
 * arrive at once, without a background timer keeping the process alive.
 */
let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

const MIN_GAP_MS = 1100;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return task();
  });
  // Keep the chain alive even if a task rejects.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

interface NominatimResult {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  boundingbox?: [string, string, string, string];
}

function normalise(result: NominatimResult): GeoPlace | null {
  const lat = Number.parseFloat(result.lat ?? '');
  const lon = Number.parseFloat(result.lon ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const displayName = sanitizeText(result.display_name, 220);
  const name = sanitizeText(result.name, 120) || displayName.split(',')[0] || 'Unnamed place';
  const parts = displayName.split(',').map((p) => p.trim()).filter(Boolean);
  const detail = parts.slice(1, 4).join(', ') || sanitizeText(result.addresstype ?? result.type, 40);

  let boundingBox: [number, number, number, number] | null = null;
  if (Array.isArray(result.boundingbox) && result.boundingbox.length === 4) {
    const [south, north, west, east] = result.boundingbox.map((v) => Number.parseFloat(v));
    if ([south, north, west, east].every(Number.isFinite)) boundingBox = [south, north, west, east];
  }

  return {
    id: `osm-${result.osm_type ?? 'n'}-${result.osm_id ?? result.place_id ?? `${lat}-${lon}`}`,
    name,
    label: displayName || name,
    detail,
    lat,
    lon,
    kind: sanitizeText(result.addresstype ?? result.type ?? result.category, 32) || 'place',
    importance: typeof result.importance === 'number' ? result.importance : 0,
    boundingBox,
  };
}

export async function geocode(query: string, limit = 6, signal?: AbortSignal): Promise<GeoPlace[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    limit: String(Math.min(Math.max(limit, 1), 10)),
    addressdetails: '0',
    'accept-language': 'en',
  });

  return schedule(async () => {
    const results = await fetchJson<NominatimResult[]>(`${nominatimBaseUrl()}/search?${params.toString()}`, {
      provider: 'Nominatim',
      timeoutMs: 12_000,
      headers: { 'User-Agent': userAgent() },
      signal,
    });

    return (Array.isArray(results) ? results : [])
      .map(normalise)
      .filter((place): place is GeoPlace => place !== null);
  });
}

interface ReverseResult {
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
  addresstype?: string;
  type?: string;
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    format: 'jsonv2',
    zoom: '10',
    'accept-language': 'en',
  });

  return schedule(async () => {
    const result = await fetchJson<ReverseResult>(`${nominatimBaseUrl()}/reverse?${params.toString()}`, {
      provider: 'Nominatim',
      timeoutMs: 12_000,
      headers: { 'User-Agent': userAgent() },
      signal,
    });
    return sanitizeText(result?.display_name, 200) || null;
  });
}
