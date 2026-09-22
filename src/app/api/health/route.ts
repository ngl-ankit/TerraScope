import { cacheStats } from '@/lib/api/cache';
import { hasCredentials } from '@/lib/api/flights';

/**
 * GET /api/health
 *
 * Reports which providers are configured and what the server-side cache is
 * holding. Deliberately does not call upstreams: this is a liveness probe, not
 * a synthetic uptime check that would consume rate-limit budget.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const stats = cacheStats();

  return Response.json(
    {
      status: 'ok',
      time: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      providers: {
        usgs: { configured: true, requiresKey: false },
        eonet: { configured: true, requiresKey: false },
        openMeteo: { configured: true, requiresKey: false },
        nominatim: { configured: true, requiresKey: false, userAgentConfigured: Boolean(process.env.NOMINATIM_USER_AGENT) },
        openSky: { configured: true, requiresKey: false, authenticated: hasCredentials() },
      },
      cache: { entries: stats.entries },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
