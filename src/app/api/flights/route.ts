import { cached, TTL } from '@/lib/api/cache';
import { fetchFlights, hasCredentials } from '@/lib/api/flights';
import { toRouteError, UpstreamError } from '@/lib/api/http';
import type { ApiEnvelope, FlightsSnapshot, SourceMeta } from '@/lib/types';

/**
 * GET /api/flights
 *
 * OpenSky is the one provider here with a hard rate limit. This route is
 * deliberately conservative: it samples three dense regions, caches for ~20s,
 * and translates HTTP 429 into a typed `upstream_rate_limited` response so the
 * UI can pause the layer and explain the situation instead of inventing data.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const outcome = await cached({ key: 'opensky:regions', ttlMs: TTL.flights() }, () =>
      fetchFlights(request.signal),
    );

    const authenticated = hasCredentials();
    const meta: SourceMeta = {
      source: 'OpenSky Network',
      sourceUrl: 'https://opensky-network.org/',
      observedAt: outcome.value.observedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'live',
      cadenceNote: authenticated
        ? 'Authenticated OpenSky access. TerraScope re-reads three sampled regions every 15 seconds.'
        : 'Anonymous OpenSky access (about 400 credits/day). TerraScope samples three regions and pauses automatically when the quota is reached.',
    };

    const body: ApiEnvelope<FlightsSnapshot> & { authenticated: boolean; regions: string[] } = {
      data: {
        observedAt: outcome.value.observedAt,
        aircraft: outcome.value.aircraft,
        coverage: outcome.value.coverage,
        regionLabel: outcome.value.regionLabel,
        notice: outcome.value.notice,
      },
      meta,
      authenticated,
      regions: outcome.value.regionsQueried,
    };

    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { body, status } = toRouteError(error, 'OpenSky Network');

    // A 429 from OpenSky is expected behaviour for anonymous clients, not a
    // bug: surface it as a clear, non-alarming state.
    if (error instanceof UpstreamError && error.code === 'upstream_rate_limited') {
      return Response.json(
        {
          error: 'OpenSky Network is rate limiting this deployment. The flights layer has been paused.',
          code: 'upstream_rate_limited',
          retryable: true,
        },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '120' } },
      );
    }

    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
