import { getReverseGeocode } from '@/lib/api';
import { toRouteError } from '@/lib/api/http';
import type { ApiEnvelope } from '@/lib/types';

/** GET /api/reverse-geocode?lat=&lon= — label for a coordinate picked on the globe. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number.parseFloat(searchParams.get('lat') ?? '');
  const lon = Number.parseFloat(searchParams.get('lon') ?? '');

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json(
      { error: 'Valid `lat` and `lon` query parameters are required.', code: 'invalid_request', retryable: false },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const { data, meta } = await getReverseGeocode(lat, lon, request.signal);
    const body: ApiEnvelope<string | null> = { data, meta };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { body, status } = toRouteError(error, 'Nominatim');
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
