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
    const { body } = toRouteError(error, 'NASA EONET');

    // Graceful degradation: rather than a hard failure that blanks the layer,
    // answer with the empty-but-valid envelope the UI already understands and
    // carry the reason in `meta`. The layer renders as empty-with-notice and
    // recovers on its own once the provider is reachable again — no component
    // contract changes.
    const degraded: ApiEnvelope<NaturalEvent[]> = {
      data: [],
      meta: {
        source: 'NASA EONET v3',
        sourceUrl: 'https://eonet.gsfc.nasa.gov/',
        observedAt: null,
        updatedAt: Date.now(),
        stale: true,
        cadence: 'near-real-time',
        cadenceNote: `NASA EONET is unreachable from this deployment (${body.code}); the layer is temporarily empty and will recover automatically.`,
      },
    };

    return Response.json(degraded, {
      status: 200,
      headers: { 'Cache-Control': 'no-store', 'X-TerraScope-Degraded': '1' },
    });
  }
}
