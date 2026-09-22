import { getWeather } from '@/lib/api';
import { cached, TTL, cooldownRemaining, setCooldown } from '@/lib/api/cache';
import { toRouteError, UpstreamError } from '@/lib/api/http';
import type { ApiEnvelope, WeatherBundle } from '@/lib/types';

/**
 * GET /api/weather?lat=&lon=
 *
 * A forecast is only ever requested for a coordinate the user selected, so this
 * route validates its input strictly and refuses anything outside the valid
 * geographic range.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get('lat') ?? '');
  const lon = Number.parseFloat(searchParams.get('lon') ?? '');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json(
      {
        error: 'Valid `lat` (-90..90) and `lon` (-180..180) query parameters are required.',
        code: 'invalid_request',
        retryable: false,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Cache per ~1 km grid cell. A forecast only changes hourly, but without this
  // every selection, every poll and every retry became its own upstream call,
  // which is what pushed Open-Meteo into answering 429 to Render's shared egress
  // IP. The cache also serves the last good forecast (stale) when the provider
  // refuses, so a 429 can no longer blank the panel.
  const cell = `${Math.round(lat * 100) / 100}:${Math.round(lon * 100) / 100}`;
  const key = `weather:${cell}`;

  // While the provider is refusing us, answer from the cooldown rather than
  // becoming another upstream call.
  const cooling = cooldownRemaining(key);
  if (cooling > 0) {
    return Response.json(
      { error: 'Open-Meteo is rate limiting requests.', code: 'upstream_rate_limited', retryable: true },
      {
        status: 429,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(Math.ceil(cooling / 1000)) },
      },
    );
  }

  try {
    const outcome = await cached({ key, ttlMs: TTL.weather() }, () => getWeather(lat, lon, request.signal));
    const body: ApiEnvelope<WeatherBundle> = {
      data: outcome.value.data,
      meta: { ...outcome.value.meta, stale: outcome.stale },
    };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { body, status } = toRouteError(error, 'Open-Meteo');

    // Both Open-Meteo and the MET Norway fallback refused: hold off before
    // asking again, and tell the client how long to wait.
    if (error instanceof UpstreamError && error.retryable) setCooldown(key, 60_000);

    return Response.json(body, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(error instanceof UpstreamError && error.retryable ? { 'Retry-After': '60' } : {}),
      },
    });
  }
}
