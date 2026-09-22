export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/diag — outbound reachability probe.
 *
 * Reports, per upstream host, the real error behind a failed provider request
 * and whether a User-Agent changes the outcome. Only reachability is returned;
 * no key, credential or response payload is exposed.
 */

const UAS: Record<string, string | null> = {
  none: null,
  plain: 'TerraScope/1.0 (+https://github.com/ngl-ankit/TerraScope)',
  browser:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const TARGETS: Record<string, string> = {
  eonet_events: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=14&limit=140',
  eonet_geojson: 'https://eonet.gsfc.nasa.gov/api/v3/events/geojson?status=open&days=14',
  opensky_auth:
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
  openmeteo_forecast:
    'https://api.open-meteo.com/v1/forecast?latitude=30.1656&longitude=76.8465&current=temperature_2m',
  openmeteo_air:
    'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=30.1656&longitude=76.8465&current=european_aqi',
  usgs: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
};

async function probe(url: string, ua: string | null) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: ua ? { 'User-Agent': ua } : undefined,
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    return { ok: response.ok, status: response.status, ms: Date.now() - started };
  } catch (error) {
    const e = error as {
      name?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: `${e?.name ?? 'Error'}: ${e?.message ?? String(error)}`,
      cause: e?.cause?.code ?? e?.cause?.message ?? null,
    };
  }
}

export async function GET() {
  const entries = await Promise.all(
    Object.entries(TARGETS).map(async ([key, url]) => {
      const probes = await Promise.all(
        Object.entries(UAS).map(async ([label, ua]) => [label, await probe(url, ua)] as const),
      );
      return [key, Object.fromEntries(probes)] as const;
    }),
  );

  return Response.json(
    {
      commit: process.env.RENDER_GIT_COMMIT ?? null,
      time: new Date().toISOString(),
      targets: Object.fromEntries(entries),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
