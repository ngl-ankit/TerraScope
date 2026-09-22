import { cached, TTL } from '@/lib/api/cache';
import { fetchNaturalEvents } from '@/lib/api/eonet';
import { toRouteError } from '@/lib/api/http';
import type { ApiEnvelope, NaturalEvent, SourceMeta } from '@/lib/types';

/** GET /api/natural-events — proxies NASA EONET v3 open events from the last 14 days. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const outcome = await cached(
      { key: 'eonet:open:14d', ttlMs: TTL.eonet() },
      () => fetchNaturalEvents(request.signal),
    );

    const meta: SourceMeta = {
      source: 'NASA EONET v3',
      sourceUrl: 'https://eonet.gsfc.nasa.gov/',
      observedAt: outcome.value.observedAt,
      updatedAt: Date.now(),
      stale: outcome.stale,
      cadence: 'near-real-time',
      cadenceNote: 'Events are curated as satellite observations arrive; TerraScope re-reads the feed every 5 minutes.',
    };

    const body: ApiEnvelope<NaturalEvent[]> = { data: outcome.value.events, meta };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { body, status } = toRouteError(error, 'NASA EONET');
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
