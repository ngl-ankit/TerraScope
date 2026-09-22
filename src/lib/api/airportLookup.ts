import { AIRPORTS, type Airport } from './flightCatalog';
import type { GeoPlace } from '@/lib/types';

/**
 * Airport code lookup shared by the search suggestions and the details panel.
 * Kept separate from `flightCatalog` so the ~150-entry dataset is tree-shaken
 * out of any bundle that only needs the lookup helper.
 */

const BY_IATA = new Map(AIRPORTS.map((airport) => [airport.iata, airport]));
const BY_ICAO = new Map(AIRPORTS.map((airport) => [airport.icao, airport]));

export function getAirportByCode(code: string): Airport | undefined {
  const normalised = code.trim().toUpperCase();
  if (normalised.length !== 3 && normalised.length !== 4) return undefined;
  return BY_IATA.get(normalised) ?? BY_ICAO.get(normalised);
}

/** Converts an airport into a place the search flow can consume. */
export function airportToPlace(airport: Airport): GeoPlace {
  return {
    id: `airport-${airport.iata}`,
    name: `${airport.name} (${airport.iata})`,
    label: `${airport.city}, ${airport.country} — ${airport.name} (${airport.iata}/${airport.icao})`,
    detail: `Airport · ${airport.iata} · ${airport.city}`,
    lat: airport.lat,
    lon: airport.lon,
    kind: 'airport',
    importance: 0.95,
    boundingBox: null,
  };
}

/** Curated quick-jump destinations for the empty search state. */
export const QUICK_PLACES: GeoPlace[] = [
  { id: 'quick-tokyo', name: 'Tokyo', label: 'Tokyo, Japan', detail: 'Japan', lat: 35.6762, lon: 139.6503, kind: 'city', importance: 0.9, boundingBox: null },
  { id: 'quick-san-francisco', name: 'San Francisco', label: 'San Francisco, California, United States', detail: 'United States', lat: 37.7749, lon: -122.4194, kind: 'city', importance: 0.88, boundingBox: null },
  { id: 'quick-london', name: 'London', label: 'London, United Kingdom', detail: 'United Kingdom', lat: 51.5074, lon: -0.1278, kind: 'city', importance: 0.9, boundingBox: null },
  { id: 'quick-reykjavik', name: 'Reykjavík', label: 'Reykjavík, Iceland', detail: 'Iceland', lat: 64.1466, lon: -21.9426, kind: 'city', importance: 0.85, boundingBox: null },
  { id: 'quick-nairobi', name: 'Nairobi', label: 'Nairobi, Kenya', detail: 'Kenya', lat: -1.2921, lon: 36.8219, kind: 'city', importance: 0.85, boundingBox: null },
  { id: 'quick-sydney', name: 'Sydney', label: 'Sydney, New South Wales, Australia', detail: 'Australia', lat: -33.8688, lon: 151.2093, kind: 'city', importance: 0.88, boundingBox: null },
];
