/**
 * Formatting helpers.
 *
 * Every value that reaches the UI passes through one of these so that the
 * display is consistent, locale-stable (UTC where a timestamp is involved) and
 * free of `NaN`/`undefined` leaking into the DOM.
 */

const EARTH_RADIUS_KM = 6371;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** `42 seconds ago`, `7 minutes ago`, `3 hours ago`. Never negative. */
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  if (!isFiniteNumber(timestampMs)) return 'unknown';
  const deltaSeconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (deltaSeconds < 5) return 'just now';
  if (deltaSeconds < 60) return `${deltaSeconds} seconds ago`;
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) === 1 ? '' : 's'} ago`;
}

/** Compact age used in status chips: `42s`, `7m`, `3h`, `2d`. */
export function formatAge(timestampMs: number | null, nowMs: number = Date.now()): string {
  if (!timestampMs || !isFiniteNumber(timestampMs)) return '--';
  const seconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Absolute UTC timestamp, e.g. `2026-09-22 15:04 UTC`. */
export function formatUtc(timestampMs: number | string | null | undefined): string {
  if (timestampMs === null || timestampMs === undefined) return 'Unavailable';
  const date = typeof timestampMs === 'string' ? new Date(timestampMs) : new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** `15:04:09` in UTC — used by the clock in the status bar. */
export function formatUtcClock(date: Date): string {
  return date.toISOString().slice(11, 19);
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `35.6769° N, 139.7639° E` */
export function formatCoordinates(lat: number, lon: number, precision = 4): string {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return 'Unavailable';
  const latHemisphere = lat >= 0 ? 'N' : 'S';
  const lonHemisphere = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(precision)}\u00B0 ${latHemisphere}, ${Math.abs(lon).toFixed(precision)}\u00B0 ${lonHemisphere}`;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (!isFiniteNumber(value)) return '--';
  return value.toFixed(digits);
}

export function formatInteger(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '--';
  return Math.round(value).toLocaleString('en-US');
}

/** Kilometres from the Earth's surface, for orbital objects. */
export function formatAltitude(metres: number | null | undefined): string {
  if (!isFiniteNumber(metres)) return '--';
  if (Math.abs(metres) >= 1000) return `${formatNumber(metres / 1000, 1)} km`;
  return `${formatNumber(metres, 0)} m`;
}

export function formatSpeed(metresPerSecond: number | null | undefined): string {
  if (!isFiniteNumber(metresPerSecond)) return '--';
  return `${formatNumber(metresPerSecond * 3.6, 0)} km/h`;
}

/** Meteorological compass label for a bearing in degrees. */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function bearingToCompass(degrees: number | null | undefined): string {
  if (!isFiniteNumber(degrees)) return '--';
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS[index];
}

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strips control characters and collapses whitespace in third-party strings. */
export function sanitizeText(value: unknown, maxLength = 600): string {
  if (typeof value !== 'string') return '';
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}\u2026` : cleaned;
}

/** Only allow http/https URLs through from third-party payloads. */
export function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Hostname of a URL, for compact source attribution. */
export function hostnameOf(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
