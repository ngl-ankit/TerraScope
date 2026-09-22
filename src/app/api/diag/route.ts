import dns from 'node:dns/promises';
import net from 'node:net';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/diag — outbound reachability probe.
 *
 * Several providers time out from this deployment's network while working from
 * elsewhere, so this reports the *mechanism*, not just the outcome: which
 * address families each host resolves to, whether a raw TCP handshake on :443
 * succeeds, and whether the HTTP call succeeds when pinned to IPv4 or IPv6.
 * Returns reachability only — no key, credential or response payload.
 */

const HOSTS = [
  'eonet.gsfc.nasa.gov',
  'opensky-network.org',
  'auth.opensky-network.org',
  'api.open-meteo.com',
  'air-quality-api.open-meteo.com',
  'earthquake.usgs.gov',
];

async function tcp(host: string, ms = 6000, family?: 4 | 6) {
  const started = Date.now();
  return new Promise<{ ok: boolean; ms: number; err: string | null }>((resolve) => {
    const socket = family ? net.connect({ host, port: 443, family }) : net.connect({ host, port: 443 });
    let settled = false;
    const finish = (ok: boolean, err: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, ms: Date.now() - started, err });
    };
    socket.setTimeout(ms);
    socket.once('connect', () => finish(true, null));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (e: NodeJS.ErrnoException) => finish(false, e.code ?? e.message));
  });
}

async function lookup(host: string) {
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.map((a) => `v${a.family}:${a.address}`);
  } catch (e) {
    return [`dns-error:${(e as Error).message}`];
  }
}

export async function GET() {
  const results = await Promise.all(
    HOSTS.map(async (host) => {
      const addresses = await lookup(host);
      const [hostname, v4, v6] = await Promise.all([
        tcp(host),
        tcp(host, 6000, 4),
        tcp(host, 6000, 6),
      ]);
      return [host, { addresses, tcpHostname: hostname, tcpIPv4: v4, tcpIPv6: v6 }] as const;
    }),
  );

  return Response.json(
    {
      commit: process.env.RENDER_GIT_COMMIT ?? null,
      nodeOptions: process.env.NODE_OPTIONS ?? null,
      time: new Date().toISOString(),
      network: Object.fromEntries(results),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
