/**
 * Shared domain types for TerraScope.
 *
 * Every external payload is normalised into one of these shapes inside
 * `src/lib/api/*`. UI components therefore never touch a raw upstream response
 * and never need to know which provider an item came from.
 */

export type LayerId = 'earthquakes' | 'naturalEvents' | 'weather' | 'flights' | 'airQuality';

export type LayerStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Freshness contract surfaced in the UI. `stale` means "last known good". */
export interface SourceMeta {
  /** Provider label, e.g. `USGS`. */
  source: string;
  /** Canonical link to the provider documentation / landing page. */
  sourceUrl: string;
  /** When the upstream payload was produced (ms epoch), if known. */
  observedAt: number | null;
  /** When TerraScope last successfully synchronised with the provider. */
  updatedAt: number | null;
  /** True when the values came from cache after a failed refresh. */
  stale: boolean;
  /** Whether the provider publishes continuously (`live`) or in batches. */
  cadence: 'live' | 'periodic' | 'near-real-time';
  /** Human-readable cadence note shown next to the timestamp. */
  cadenceNote: string;
}

export interface DataState<T> {
  status: LayerStatus;
  data: T;
  error: string | null;
  meta: SourceMeta | null;
}

/* ────────────────────────────── Earthquakes ─────────────────────────────── */

export interface Earthquake {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  updated: number;
  depthKm: number;
  lat: number;
  lon: number;
  url: string;
  detailUrl: string | null;
  status: string | null;
  tsunami: boolean;
  felt: number | null;
  alert: string | null;
  significance: number | null;
  magType: string | null;
  network: string | null;
}

/* ──────────────────────────── Natural events ────────────────────────────── */

export type NaturalEventCategory =
  | 'wildfires'
  | 'volcanoes'
  | 'severeStorms'
  | 'seaLakeIce'
  | 'drought'
  | 'dustHaze'
  | 'floods'
  | 'landslides'
  | 'manmade'
  | 'snow'
  | 'temperatureExtremes'
  | 'waterColor'
  | 'earthquakes'
  | 'other';

export interface NaturalEventSource {
  id: string;
  url: string;
}

export interface NaturalEvent {
  id: string;
  title: string;
  description: string | null;
  categories: NaturalEventCategory[];
  categoryLabel: string;
  sources: NaturalEventSource[];
  closed: string | null;
  lat: number;
  lon: number;
  /** Latest geometry timestamp (ms epoch). */
  time: number;
  /** Number of observations bundled into this event. */
  observationCount: number;
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  /** Every observed point, oldest first — used to draw storm tracks. */
  track: Array<{ lat: number; lon: number; time: number }>;
  link: string;
}

/* ─────────────────────────────── Weather ────────────────────────────────── */

export interface WeatherCurrent {
  time: string;
  temperatureC: number | null;
  apparentC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  condition: string;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
  windDirectionDeg: number | null;
  pressureHpa: number | null;
  cloudCoverPct: number | null;
  isDay: boolean | null;
}

export interface WeatherHour {
  time: string;
  temperatureC: number | null;
  weatherCode: number | null;
  precipitationProbabilityPct: number | null;
  windSpeedKmh: number | null;
}

export interface WeatherDay {
  date: string;
  weatherCode: number | null;
  condition: string;
  maxC: number | null;
  minC: number | null;
  precipitationMm: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface WeatherBundle {
  lat: number;
  lon: number;
  elevationM: number | null;
  timezone: string;
  timezoneAbbreviation: string;
  current: WeatherCurrent;
  hourly: WeatherHour[];
  daily: WeatherDay[];
}

/* ─────────────────────────────── Flights ────────────────────────────────── */

export interface Aircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  lat: number;
  lon: number;
  altitudeM: number | null;
  onGround: boolean;
  velocityMs: number | null;
  headingDeg: number | null;
  verticalRateMs: number | null;
  squawk: string | null;
  /** Seconds since the aircraft last reported. */
  ageSeconds: number | null;
  lastContact: number;
}

export interface FlightsSnapshot {
  /** Server timestamp of the upstream snapshot (ms epoch). */
  observedAt: number;
  aircraft: Aircraft[];
  /** Whether the sampled area covers the whole planet or a window. */
  coverage: 'global' | 'regional';
  regionLabel: string;
  /** Non-fatal provider notices (e.g. anonymous rate limits). */
  notice: string | null;
}

/* ───────────────────────────── Air quality ──────────────────────────────── */

export interface AirQualitySample {
  name: string;
  country: string;
  lat: number;
  lon: number;
  europeanAqi: number | null;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  ozone: number | null;
  category: string;
  observedAt: string | null;
}

/* ────────────────────────────── Geocoding ───────────────────────────────── */

export interface GeoPlace {
  id: string;
  name: string;
  /** Full display name, e.g. `Tokyo, Japan`. */
  label: string;
  /** Secondary line for the result row. */
  detail: string;
  lat: number;
  lon: number;
  kind: string;
  importance: number;
  boundingBox: [number, number, number, number] | null;
}

/* ─────────────────────────────── Selection ──────────────────────────────── */

export type Selection =
  | { kind: 'earthquake'; item: Earthquake }
  | { kind: 'naturalEvent'; item: NaturalEvent }
  | { kind: 'aircraft'; item: Aircraft }
  | { kind: 'place'; item: GeoPlace }
  | { kind: 'airQuality'; item: AirQualitySample };

export type SelectionKind = Selection['kind'];

/* ───────────────────────────── API envelopes ────────────────────────────── */

export interface ApiEnvelope<T> {
  data: T;
  meta: SourceMeta;
}

export interface ApiErrorBody {
  error: string;
  /** Machine-readable reason so the UI can tailor the retry copy. */
  code:
    | 'upstream_unavailable'
    | 'upstream_rate_limited'
    | 'upstream_unauthorized'
    | 'invalid_request'
    | 'timeout'
    | 'unknown';
  retryable: boolean;
}

/* ──────────────────────────── Layer descriptors ─────────────────────────── */

export interface LayerDescriptor {
  id: LayerId;
  label: string;
  shortLabel: string;
  description: string;
  source: string;
  sourceUrl: string;
  /** CSS colour token used for both the marker and the legend swatch. */
  color: string;
  cadenceNote: string;
  /** Layers that require a user-selected coordinate before they can load. */
  requiresLocation?: boolean;
}
