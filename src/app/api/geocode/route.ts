import { getGeocode } from '@/lib/api';
import { toRouteError } from '@/lib/api/http';
import { findAirports } from '@/lib/api/flightCatalog';
import type { ApiEnvelope, GeoPlace } from '@/lib/types';

/**
 * GET /api/geocode?q=&airports=1
 *
 * Server-side only: Nominatim requires a descriptive User-Agent and a
 * one-request-per-second ceiling, neither of which a browser can honour.
 * When `airports=1`, matching entries from the local airport catalogue are
 * merged in so "LHR" or "Heathrow" resolves without touching Nominatim at all.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();
  const includeAirports = searchParams.get('airports') !== '0';

  if (query.length < 2) {
    return Response.json(
      { error: 'Provide a search term of at least two characters via `q`.', code: 'invalid_request', retryable: false },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (query.length > 160) {
    return Response.json(
      { error: 'Search terms are limited to 160 characters.', code: 'invalid_request', retryable: false },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const airportPlaces: GeoPlace[] = includeAirports
    ? findAirports(query, 3).map((airport) => ({
        id: `airport-${airport.iata}`,
        name: `${airport.name} (${airport.iata})`,
        label: `${airport.city}, ${airport.country} — ${airport.name} (${airport.iata}/${airport.icao})`,
        detail: `Airport · ${airport.iata} · ${airport.city}`,
        lat: airport.lat,
        lon: airport.lon,
        kind: 'airport',
        importance: 0.95,
        boundingBox: null,
      }))
    : [];

  try {
    const { data, meta } = await getGeocode(query, request.signal);
    const body: ApiEnvelope<GeoPlace[]> = { data: [...airportPlaces, ...data], meta };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // A geocoding outage must not hide the local airport catalogue.
    if (airportPlaces.length > 0) {
      const body: ApiEnvelope<GeoPlace[]> = {
        data: airportPlaces,
        meta: {
          source: 'Nominatim / OpenStreetMap',
          sourceUrl: 'https://nominatim.openstreetmap.org/',
          observedAt: null,
          updatedAt: Date.now(),
          stale: true,
          cadence: 'periodic',
          cadenceNote: 'Geocoding unavailable — showing local airport matches only.',
        },
      };
      return Response.json(body, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    const { body, status } = toRouteError(error, 'Nominatim');
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
