import { fetchJson } from './http';
import { getJsonViaIpv4 } from './fetchIpv4';
import { sanitizeText, sanitizeUrl, titleCase } from '@/lib/utils/format';
import type { NaturalEvent, NaturalEventCategory, NaturalEventSource } from '@/lib/types';

/** Contactable UA — nasa.gov is CDN-fronted and drops default agents. */
const OUTBOUND_USER_AGENT = 'TerraScope/1.0 (+https://github.com/ngl-ankit/TerraScope)';

/**
 * NASA EONET v3 — Earth Observatory Natural Event Tracker.
 *
 * We request only open events from the last two weeks. Each event carries one
 * or more geometries (a wildfire is a point, a hurricane is a track), so the
 * normaliser keeps the newest geometry as the marker position and retains the
 * whole sequence for track rendering.
 *
 * Docs: https://eonet.gsfc.nasa.gov/docs/v3
 */

const CATEGORY_LABELS: Record<string, string> = {
  wildfires: 'Wildfire',
  volcanoes: 'Volcano',
  severeStorms: 'Severe storm',
  seaLakeIce: 'Sea / lake ice',
  drought: 'Drought',
  dustHaze: 'Dust and haze',
  floods: 'Flood',
  landslides: 'Landslide',
  manmade: 'Human-made',
  snow: 'Snow',
  temperatureExtremes: 'Temperature extreme',
  waterColor: 'Water colour',
  earthquakes: 'Earthquake',
  other: 'Other',
};

interface EonetGeometry {
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
  date?: string;
  type?: string;
  coordinates?: unknown;
}

interface EonetRawEvent {
  id?: string;
  title?: string;
  description?: string | null;
  link?: string;
  closed?: string | null;
  categories?: Array<{ id?: string; title?: string }>;
  sources?: Array<{ id?: string; url?: string }>;
  geometry?: EonetGeometry[];
}

interface EonetResponse {
  title?: string;
  events?: EonetRawEvent[];
}

export interface NaturalEventsPayload {
  events: NaturalEvent[];
  /** Newest geometry timestamp across all events. */
  observedAt: number | null;
}

export function baseUrl(): string {
  return (process.env.EONET_BASE_URL ?? 'https://eonet.gsfc.nasa.gov/api/v3').replace(/\/$/, '');
}

function categoryLabel(categories: NaturalEventCategory[]): string {
  if (categories.length === 0) return 'Natural event';
  return CATEGORY_LABELS[categories[0]] ?? titleCase(categories[0]);
}

/** EONET geometries are `[lon, lat]`, but polygons appear for ice/water events. */
function centroidOf(coordinates: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

  const first = coordinates[0];

  // Point: [lon, lat]
  if (typeof first === 'number') {
    const lon = coordinates[0] as number;
    const lat = coordinates[1] as number;
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  }

  // Polygon / MultiPolygon: average the first ring's vertices.
  const ring = Array.isArray(first) && typeof first[0] === 'number' ? (coordinates as number[][]) : (first as number[][]);
  if (!Array.isArray(ring)) return null;

  let latSum = 0;
  let lonSum = 0;
  let count = 0;
  for (const pair of ring) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = pair[0];
    const lat = pair[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    latSum += lat;
    lonSum += lon;
    count += 1;
  }
  if (count === 0) return null;
  return { lat: latSum / count, lon: lonSum / count };
}

export function normaliseNaturalEvents(response: EonetResponse): NaturalEventsPayload {
  const events: NaturalEvent[] = [];
  let newest = 0;

  for (const raw of response.events ?? []) {
    const id = sanitizeText(raw.id, 48);
    if (!id) continue;

    const geometries = (raw.geometry ?? []).filter((g) => g && g.date);
    if (geometries.length === 0) continue;

    // EONET returns geometries oldest-first for most feeds; sort defensively.
    const ordered = [...geometries].sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
    );
    const latest = ordered[ordered.length - 1];
    const position = centroidOf(latest.coordinates);
    if (!position) continue;
    if (position.lat < -90 || position.lat > 90 || position.lon < -180 || position.lon > 180) continue;

    const categories = (raw.categories ?? [])
      .map((c) => sanitizeText(c.id, 40) as NaturalEventCategory)
      .filter(Boolean);
    if (categories.length === 0) categories.push('other');

    const sources: NaturalEventSource[] = (raw.sources ?? [])
      .map((s) => ({ id: sanitizeText(s.id, 32), url: sanitizeUrl(s.url) ?? '' }))
      .filter((s) => s.id.length > 0);

    const time = new Date(latest.date as string).getTime();
    if (Number.isFinite(time) && time > newest) newest = time;

    const track = ordered
      .map((g) => {
        const point = centroidOf(g.coordinates);
        const pointTime = new Date(g.date as string).getTime();
        if (!point) return null;
        return { lat: point.lat, lon: point.lon, time: Number.isFinite(pointTime) ? pointTime : 0 };
      })
      .filter((p): p is { lat: number; lon: number; time: number } => p !== null);

    const magnitudeValue =
      typeof latest.magnitudeValue === 'number' && Number.isFinite(latest.magnitudeValue)
        ? latest.magnitudeValue
        : null;

    events.push({
      id,
      title: sanitizeText(raw.title, 140) || 'Untitled event',
      description: raw.description ? sanitizeText(raw.description, 700) : null,
      categories,
      categoryLabel: categoryLabel(categories),
      sources,
      closed: raw.closed ? sanitizeText(raw.closed, 40) : null,
      lat: position.lat,
      lon: position.lon,
      time: Number.isFinite(time) ? time : Date.now(),
      observationCount: ordered.length,
      magnitudeValue,
      magnitudeUnit: latest.magnitudeUnit ? sanitizeText(latest.magnitudeUnit, 12) : null,
      track,
      link: sanitizeUrl(raw.link) ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${id}`,
    });
  }

  events.sort((a, b) => b.time - a.time);

  return { events, observedAt: newest > 0 ? newest : null };
}


interface EonetFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: {
    id?: string;
    title?: string;
    description?: string | null;
    link?: string;
    closed?: string | null;
    date?: string;
    magnitudeValue?: number | null;
    magnitudeUnit?: string | null;
    categories?: Array<{ id?: string; title?: string }>;
    sources?: Array<{ id?: string; url?: string }>;
  };
}

/**
 * `/events/geojson` carries the newest geometry per event as a single feature.
 * It is a pre-built document (served in ~2s) rather than the per-request
 * `/events` collection, so it is the fallback before a layer is allowed to fail.
 */
export function normaliseEonetGeojson(response: { features?: EonetFeature[] }): NaturalEventsPayload {
  const events: EonetRawEvent[] = (response.features ?? []).map((feature) => {
    const properties = feature.properties ?? {};
    return {
      id: properties.id,
      title: properties.title,
      description: properties.description ?? null,
      link: properties.link,
      closed: properties.closed ?? null,
      categories: properties.categories,
      sources: properties.sources,
      geometry: [
        {
          date: properties.date,
          type: feature.geometry?.type,
          coordinates: feature.geometry?.coordinates,
          magnitudeValue: properties.magnitudeValue ?? null,
          magnitudeUnit: properties.magnitudeUnit ?? null,
        },
      ],
    };
  });
  return normaliseNaturalEvents({ events });
}

const ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads EONET over a connection pinned to IPv4.
 *
 * A hostname-based connect hangs on this host's unreachable IPv6 route (measured:
 * the IPv4 handshake answers in ~370ms while the hostname connect times out), so
 * the pinned transport is tried first and an ordinary fetch is kept as the
 * fallback for networks where IPv6 behaves normally.
 */
async function fetchEonetJson<T>(url: string, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  try {
    return await getJsonViaIpv4<T>(url, {
      provider: 'NASA EONET',
      timeoutMs,
      headers: { 'User-Agent': OUTBOUND_USER_AGENT },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return fetchJson<T>(url, {
      provider: 'NASA EONET',
      timeoutMs,
      retries: 1,
      headers: { 'User-Agent': OUTBOUND_USER_AGENT },
      signal,
    });
  }
}

export async function fetchNaturalEvents(signal?: AbortSignal): Promise<NaturalEventsPayload> {
  const url = `${baseUrl()}/events?status=open&days=14&limit=140`;
  let lastError: unknown;

  // EONET's /events collection is rebuilt per request: it is measurably slower
  // than /events/geojson and it occasionally drops the TLS connection outright.
  // A dropped connection surfaces as an instant failure (observed ~0.6s, not a
  // timeout), and a second attempt almost always clears it — so retry with
  // backoff before degrading the layer.
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (signal?.aborted) break;
    try {
      const response = await fetchEonetJson<EonetResponse>(url, attempt === 1 ? 20_000 : 25_000, signal);
      return normaliseNaturalEvents(response);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) break;
      if (attempt < ATTEMPTS) await delay(700 * attempt);
    }
  }

  // Last resort: the pre-built geojson document for the same feed.
  try {
    const geo = await fetchEonetJson<{ features?: EonetFeature[] }>(
      `${baseUrl()}/events/geojson?status=open&days=14&limit=140`,
      20_000,
      signal,
    );
    return normaliseEonetGeojson(geo);
  } catch (fallbackError) {
    lastError = fallbackError;
  }

  throw lastError;
}
