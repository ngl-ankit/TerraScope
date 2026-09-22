import { fetchJson, UpstreamError } from './http';
import { sanitizeText } from '@/lib/utils/format';
import { AIRPORTS } from './flightCatalog';
import type { Aircraft, FlightsSnapshot } from '@/lib/types';

/**
 * Descriptive User-Agent for every outbound call.
 *
 * The default `node` UA is rejected outright by some providers and CDNs
 * fronting them; a contactable UA is also the documented requirement for
 * Nominatim. Sending one costs nothing and removes a whole class of blocks.
 */
const OUTBOUND_USER_AGENT = 'TerraScope/1.0 (+https://github.com/ngl-ankit/TerraScope)';

/**
 * OpenSky Network — live aircraft state vectors.
 *
 * Rate-limit reality (documented at https://openskynetwork.github.io/opensky-api/rest.html):
 * anonymous clients receive roughly 400 credits per day, and one bounding-box
 * `/states/all` call costs 4 credits. Continuous global polling is therefore
 * *not* possible without credentials, and TerraScope does not pretend
 * otherwise:
 *
 *  - The route samples a small number of fixed, high-traffic regions instead of
 *    the whole planet (cheaper, and the data is dense enough to be useful).
 *  - Results are cached server-side and the client polls at a conservative
 *    interval.
 *  - On HTTP 429 the route returns a typed `upstream_rate_limited` error and the
 *    UI pauses the layer, explains why, and offers a manual retry. Aircraft are
 *    never synthesised.
 *  - Setting OPEN_SKY_CLIENT_ID / OPEN_SKY_CLIENT_SECRET switches to OAuth2
 *    client-credentials, which raises the quota substantially.
 *
 * Docs: https://openskynetwork.github.io/opensky-api/
 */

/** `[lamin, lomin, lamax, lomax]` — dense, well-covered airspace only. */
export const SAMPLE_REGIONS = [
  { label: 'Western Europe', bbox: [36, -11, 60, 25] as const },
  { label: 'North America', bbox: [25, -125, 50, -66] as const },
  { label: 'East Asia', bbox: [20, 100, 46, 145] as const },
];

export function openSkyBaseUrl(): string {
  return (process.env.OPEN_SKY_BASE_URL ?? 'https://opensky-network.org/api').replace(/\/$/, '');
}

function tokenUrl(): string {
  return (
    process.env.OPEN_SKY_TOKEN_URL ??
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
  );
}

export function hasCredentials(): boolean {
  return Boolean(process.env.OPEN_SKY_CLIENT_ID && process.env.OPEN_SKY_CLIENT_SECRET);
}

/**
 * Cached OAuth2 access token. Kept in module scope so a warm server instance
 * reuses one token instead of authenticating per request.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (!hasCredentials()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.OPEN_SKY_CLIENT_ID as string,
    client_secret: process.env.OPEN_SKY_CLIENT_SECRET as string,
  });

  let response: Response;
  try {
    response = await fetch(tokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': OUTBOUND_USER_AGENT,
      },
      body,
      // Short budget: authenticating is an optimisation, not a requirement.
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    });
  } catch {
    // Root cause of the /api/flights 500: this call was unguarded, so an
    // unreachable token endpoint (observed: 10s abort on the host's egress)
    // threw straight out of the route -> "Unexpected failure" 500 with zero
    // aircraft. Anonymous OpenSky access still works, so degrade to it.
    return null;
  }

  if (!response.ok) return null;

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000,
  };
  return cachedToken.value;
}

/** Raw OpenSky `states` row, positionally defined by the API contract. */
type StateVector = [
  string, // 0  icao24
  string | null, // 1  callsign
  string, // 2  origin_country
  number, // 3  time_position
  number, // 4  last_contact
  number | null, // 5  longitude
  number | null, // 6  latitude
  number | null, // 7  baro_altitude (m)
  boolean, // 8  on_ground
  number | null, // 9  velocity (m/s)
  number | null, // 10 true_track (deg, clockwise from north)
  number | null, // 11 vertical_rate (m/s)
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude (m)
  string | null, // 14 squawk
  boolean, // 15 spi
  number, // 16 position_source
];

interface StatesResponse {
  time: number;
  states: StateVector[] | null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Maps one positional row to the internal `Aircraft` shape. */
export function mapStateVector(row: StateVector, nowSeconds: number): Aircraft | null {
  const icao24 = sanitizeText(row[0], 8);
  if (!icao24) return null;

  const lon = num(row[5]);
  const lat = num(row[6]);
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const onGround = row[8] === true;
  const callsign = row[1] ? sanitizeText(row[1], 12) : null;
  const lastContact = num(row[4]) ?? nowSeconds;

  return {
    icao24,
    callsign: callsign && callsign.length > 0 ? callsign : null,
    originCountry: sanitizeText(row[2], 48) || 'Unknown',
    lat,
    lon,
    altitudeM: num(row[13]) ?? num(row[7]),
    onGround,
    velocityMs: num(row[9]),
    headingDeg: num(row[10]),
    verticalRateMs: num(row[11]),
    squawk: row[14] ? sanitizeText(row[14], 8) : null,
    ageSeconds: Math.max(0, Math.round(nowSeconds - lastContact)),
    lastContact: lastContact * 1000,
  };
}

export interface FlightsResult extends FlightsSnapshot {
  /** Which regions actually answered, for the status line. */
  regionsQueried: string[];
}

/* ───────────────────── Community ADS-B fallback (no credentials) ──────────
 * OpenSky is the primary source, but its REST API is unreachable from some
 * networks: measured from this deployment's egress the TCP handshake to
 * opensky-network.org times out on both IPv4 and IPv6, so every flights request
 * failed outright rather than being rate-limited. Community aggregators publish
 * the same ADS-B state vectors over a key-free JSON API, so a total OpenSky
 * failure degrades to live (coarser) data instead of an empty layer.
 *
 * Endpoint contract, verified against the live API:
 *   GET {base}/v2/point/{lat}/{lon}/{radiusNm}  ->  { now, ac: [ {...} ] }
 * `now` is a millisecond epoch; `alt_baro` is feet or the string "ground".
 * Docs: https://adsb.lol/docs/openapi/
 */

const COMMUNITY_ADSB_BASE_URL = (process.env.COMMUNITY_ADSB_BASE_URL ?? 'https://api.adsb.lol').replace(/\/$/, '');

/** Radius in nautical miles. A point query is capped at 250 nm. */
const COMMUNITY_RADIUS_NM = 250;

/** Dense-airspace centres, mirroring the OpenSky sample regions. */
interface CommunityPoint {
  label: string;
  lat: number;
  lon: number;
}

const COMMUNITY_POINTS: readonly CommunityPoint[] = [
  { label: 'Western Europe', lat: 50, lon: 7 },
  { label: 'North America', lat: 40, lon: -95 },
  { label: 'East Asia', lat: 35, lon: 135 },
];

interface CommunityRow {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  seen?: number;
}

interface CommunityResponse {
  now?: number;
  ac?: CommunityRow[];
}

/** Feet -> metres, knots -> m/s, feet per minute -> m/s. */
const FT_TO_M = 0.3048;
const KT_TO_MS = 0.514444;
const FPM_TO_MS = 0.00508;

function communityNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Maps one community ADS-B row onto the internal `Aircraft` shape. */
export function mapCommunityRow(row: CommunityRow, nowSeconds: number): Aircraft | null {
  const icao24 = sanitizeText(row.hex, 8).toLowerCase();
  if (!icao24) return null;

  const lat = communityNum(row.lat);
  const lon = communityNum(row.lon);
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const onGround = row.alt_baro === 'ground';
  const altFt = communityNum(row.alt_baro);
  const gsKt = communityNum(row.gs);
  const climbFpm = communityNum(row.baro_rate);
  const seen = communityNum(row.seen);
  const lastContact = seen === null ? nowSeconds : nowSeconds - seen;
  const callsign = row.flight ? sanitizeText(row.flight, 12) : null;

  return {
    icao24,
    callsign: callsign && callsign.length > 0 ? callsign : null,
    // The community feed carries no origin country. It is reported as unknown
    // rather than guessed from a callsign prefix.
    originCountry: 'Unknown',
    lat,
    lon,
    altitudeM: altFt === null ? null : Math.round(altFt * FT_TO_M),
    onGround,
    velocityMs: gsKt === null ? null : Math.round(gsKt * KT_TO_MS * 10) / 10,
    headingDeg: communityNum(row.track),
    verticalRateMs: climbFpm === null ? null : Math.round(climbFpm * FPM_TO_MS * 100) / 100,
    squawk: row.squawk ? sanitizeText(row.squawk, 8) : null,
    ageSeconds: seen === null ? null : Math.max(0, Math.round(seen)),
    lastContact: lastContact * 1000,
  };
}

/**
 * Reads the same regions from the community aggregator.
 *
 * Returns the identical `FlightsResult` shape so no consumer changes; a partial
 * answer is still an answer, and only a total miss propagates.
 */
export async function fetchCommunityFlights(signal?: AbortSignal): Promise<FlightsResult> {
  const results = await Promise.allSettled(
    COMMUNITY_POINTS.map(async (point) => {
      const response = await fetchJson<CommunityResponse>(
        `${COMMUNITY_ADSB_BASE_URL}/v2/point/${point.lat}/${point.lon}/${COMMUNITY_RADIUS_NM}`,
        {
          provider: 'Community ADS-B',
          timeoutMs: 12_000,
          retries: 1,
          headers: { 'User-Agent': OUTBOUND_USER_AGENT },
          signal,
        },
      );
      return { region: point.label, response };
    }),
  );

  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<{ region: string; response: CommunityResponse }> =>
      r.status === 'fulfilled',
  );

  const byIcao = new Map<string, Aircraft>();
  let observedAt = 0;
  const regionsQueried: string[] = [];

  for (const entry of fulfilled) {
    regionsQueried.push(entry.value.region);
    const now = communityNum(entry.value.response.now) ?? Date.now();
    observedAt = Math.max(observedAt, now);
    const nowSeconds = Math.floor(now / 1000);
    for (const row of entry.value.response.ac ?? []) {
      const aircraft = mapCommunityRow(row, nowSeconds);
      if (!aircraft) continue;
      const existing = byIcao.get(aircraft.icao24);
      if (!existing || (aircraft.ageSeconds ?? 999) < (existing.ageSeconds ?? 999)) {
        byIcao.set(aircraft.icao24, aircraft);
      }
    }
  }

  const aircraft = [...byIcao.values()].sort((a, b) => (a.ageSeconds ?? 0) - (b.ageSeconds ?? 0));
  const failed = results.length - fulfilled.length;

  return {
    observedAt: observedAt || Date.now(),
    aircraft,
    coverage: 'regional',
    regionLabel: regionsQueried.join(' · '),
    notice:
      failed > 0
        ? `OpenSky Network was unreachable; showing community ADS-B data (${failed} of ${results.length} sampled regions did not respond).`
        : 'OpenSky Network was unreachable; showing community ADS-B data (coarser coverage, origin country unavailable).',
    regionsQueried,
  };
}

/**
 * Samples the configured regions concurrently.
 *
 * A partial failure is not fatal: whatever regions answered are returned with a
 * notice. Only a total failure propagates as an error, which keeps the globe
 * alive when OpenSky is having a bad day.
 */
export async function fetchFlights(signal?: AbortSignal): Promise<FlightsResult> {
  const token = await accessToken();
  const headers: Record<string, string> = { 'User-Agent': OUTBOUND_USER_AGENT };
  if (token) headers.Authorization = `Bearer ${token}`;

  const results = await Promise.allSettled(
    SAMPLE_REGIONS.map(async (region) => {
      const [lamin, lomin, lamax, lomax] = region.bbox;
      const params = new URLSearchParams({
        lamin: String(lamin),
        lomin: String(lomin),
        lamax: String(lamax),
        lomax: String(lomax),
      });
      const response = await fetchJson<StatesResponse>(`${openSkyBaseUrl()}/states/all?${params.toString()}`, {
        provider: 'OpenSky Network',
        timeoutMs: 15_000,
        headers,
        signal,
      });
      return { region: region.label, response };
    }),
  );

  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<{ region: string; response: StatesResponse }> => r.status === 'fulfilled',
  );

  if (fulfilled.length === 0) {
    // OpenSky is unreachable from some hosts (measured: the TCP handshake times
    // out on both address families from this deployment's egress), so a
    // key-free community aggregator takes over rather than the layer going blank.
    const fallback = await fetchCommunityFlights(signal).catch(() => null);
    if (fallback && fallback.aircraft.length > 0) return fallback;

    const first = results[0];
    if (first && first.status === 'rejected' && first.reason instanceof UpstreamError) throw first.reason;
    throw new UpstreamError('OpenSky Network did not return any state vectors.', {
      code: 'upstream_unavailable',
      provider: 'OpenSky Network',
    });
  }

  const byIcao = new Map<string, Aircraft>();
  let observedAt = 0;
  const regionsQueried: string[] = [];

  for (const entry of fulfilled) {
    regionsQueried.push(entry.value.region);
    const time = num(entry.value.response.time) ?? Math.floor(Date.now() / 1000);
    observedAt = Math.max(observedAt, time * 1000);
    for (const row of entry.value.response.states ?? []) {
      const aircraft = mapStateVector(row, time);
      if (!aircraft) continue;
      // An aircraft seen in two overlapping regions keeps its freshest fix.
      const existing = byIcao.get(aircraft.icao24);
      if (!existing || (aircraft.ageSeconds ?? 999) < (existing.ageSeconds ?? 999)) {
        byIcao.set(aircraft.icao24, aircraft);
      }
    }
  }

  const aircraft = [...byIcao.values()].sort(
    (a, b) => (a.ageSeconds ?? 0) - (b.ageSeconds ?? 0),
  );

  const failed = results.length - fulfilled.length;
  const notice = failed > 0 ? `${failed} of ${results.length} sampled regions did not respond.` : null;

  return {
    observedAt: observedAt || Date.now(),
    aircraft,
    coverage: 'regional',
    regionLabel: regionsQueried.join(' · '),
    notice,
    regionsQueried,
  };
}

/** Nearby-airport lookup used by the details panel for a selected aircraft. */
export function nearestAirports(lat: number, lon: number, limit = 3) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const distance = (aLat: number, aLon: number) => {
    const dLat = toRad(aLat - lat);
    const dLon = toRad(aLon - lon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(aLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  };

  return AIRPORTS.map((airport) => ({ airport, km: distance(airport.lat, airport.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
