import { cached, TTL } from '@/lib/api/cache';
import { fetchAirQuality } from '@/lib/api/airQuality';
import { toRouteError } from '@/lib/api/http';
import type { AirQualitySample, ApiEnvelope, SourceMeta } from '@/lib/types';

/**
 * GET /api/air-quality
 *
 * Samples 32 major cities from the Open-Meteo air-quality model in a single
 * multi-coordinate request. The response is explicitly a city sample, not a
 * global pollution field.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const outcome = await cached(
      { key: 'openmeteo:aq:cities', ttlMs: TTL.airQuality() },
      () => fetchAirQuality(request.signal),
    );

    const meta: SourceMeta = {
      source: 'Open-Meteo Air Quality',
      sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
      observedAt: outcome.value.observedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'near-real-time',
      cadenceNote: 'Hourly model output sampled at 32 cities; TerraScope re-reads it every 15 minutes.',
    };

    const body: ApiEnvelope<AirQualitySample[]> = { data: outcome.value.samples, meta };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { body, status } = toRouteError(error, 'Open-Meteo Air Quality');
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
