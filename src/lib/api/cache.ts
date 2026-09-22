/**
 * Tiny in-process TTL cache with single-flight de-duplication and
 * stale-on-error fallback.
 *
 * Why this exists:
 *  - Public providers (Nominatim, OpenSky) publish strict rate limits. Without
 *    a shared cache, ten browser tabs would mean ten upstream requests.
 *  - When a refresh fails, serving the last known good payload is far better
 *    than blanking a layer — the UI labels it as `stale` instead.
 *
 * The store is module-scoped, so it lives as long as the Node process (a
 * serverless instance or a long-running `next start` server). That is exactly
 * the lifetime we want: a cache that never outlives its deployment.
 */

interface Entry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export interface CacheOutcome<T> {
  value: T;
  /** True when the value came from a previous successful fetch after a failure. */
  stale: boolean;
  /** True when the value was served from cache without an upstream call. */
  cached: boolean;
}

export interface CachedOptions {
  key: string;
  ttlMs: number;
  /** Hard cap on the cache entry count; oldest entries are evicted first. */
  maxEntries?: number;
}

function evictIfNeeded(maxEntries: number) {
  if (store.size <= maxEntries) return;
  const overflow = store.size - maxEntries;
  const keys = [...store.keys()].slice(0, overflow);
  for (const key of keys) store.delete(key);
}

/**
 * Resolve a value through the cache.
 *
 * @param loader Called only on a miss (or expiry). Never called twice
 *   concurrently for the same key — the in-flight promise is shared.
 */
export async function cached<T>(
  options: CachedOptions,
  loader: () => Promise<T>,
): Promise<CacheOutcome<T>> {
  const { key, ttlMs, maxEntries = 120 } = options;
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;

  if (existing && now - existing.storedAt < existing.ttlMs) {
    return { value: existing.value, stale: false, cached: true };
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) {
    try {
      const value = await pending;
      return { value, stale: false, cached: true };
    } catch {
      // Fall through to a fresh attempt below.
    }
  }

  const attempt = loader();
  inflight.set(key, attempt);

  try {
    const value = await attempt;
    store.set(key, { value, storedAt: Date.now(), ttlMs });
    evictIfNeeded(maxEntries);
    return { value, stale: false, cached: false };
  } catch (error) {
    if (existing) {
      // Serve the last known good payload and let the UI label it stale.
      return { value: existing.value, stale: true, cached: true };
    }
    throw error;
  } finally {
    inflight.delete(key);
  }
}

/** Force-invalidate a key (or a prefix) so the next read refetches. */
export function invalidate(prefix: string) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Introspection for `/api/status`. */
export function cacheStats() {
  return { entries: store.size, keys: [...store.keys()] };
}

/** TTLs, overridable per-deployment through environment variables. */
function envSeconds(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const TTL = {
  earthquakes: () => envSeconds('CACHE_TTL_EARTHQUAKES', 45) * 1000,
  eonet: () => envSeconds('CACHE_TTL_EONET', 180) * 1000,
  flights: () => envSeconds('CACHE_TTL_FLIGHTS', 12) * 1000,
  airQuality: () => envSeconds('CACHE_TTL_AIR_QUALITY', 600) * 1000,
  geocode: () => envSeconds('CACHE_TTL_GEOCODE', 300) * 1000,
  weather: () => envSeconds('CACHE_TTL_WEATHER', 3600) * 1000,
};
