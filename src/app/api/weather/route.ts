import { getWeather } from '@/lib/api';
import { toRouteError } from '@/lib/api/http';
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

  try {
    const { data, meta } = await getWeather(lat, lon, request.signal);
    const body: ApiEnvelope<WeatherBundle> = { data, meta };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { body, status } = toRouteError(error, 'Open-Meteo');
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
