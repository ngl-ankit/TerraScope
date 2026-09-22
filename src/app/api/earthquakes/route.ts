import { cached, TTL } from '@/lib/api/cache';
import { fetchEarthquakes } from '@/lib/api/earthquakes';
import { toRouteError } from '@/lib/api/http';
import type { ApiEnvelope, Earthquake, SourceMeta } from '@/lib/types';

/**
 * GET /api/earthquakes
 *
 * Proxies the USGS 2.5+/24h GeoJSON summary feed and normalises it into the
 * internal `Earthquake` shape. Never contacted directly from the browser, so
 * the client bundle stays free of upstream URLs and CORS is a non-issue.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const outcome = await cached(
      { key: 'usgs:2.5_day', ttlMs: TTL.earthquakes() },
      () => fetchEarthquakes(request.signal),
    );

    const meta: SourceMeta = {
      source: 'USGS Earthquake Hazards Program',
      sourceUrl: 'https://earthquake.usgs.gov/',
      observedAt: outcome.value.generatedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'near-real-time',
      cadenceNote: 'USGS regenerates this summary feed every minute; TerraScope re-reads it every 60 seconds.',
    };

    const body: ApiEnvelope<{ earthquakes: Earthquake[]; feedTitle: string; feedUrl: string }> = {
      data: {
        earthquakes: outcome.value.earthquakes,
        feedTitle: outcome.value.feedTitle,
        feedUrl: outcome.value.feedUrl,
      },
      meta,
    };

    return Response.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const { body, status } = toRouteError(error, 'USGS');
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
