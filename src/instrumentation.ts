/**
 * Next.js instrumentation hook.
 *
 * `register()` runs exactly once per server process, before the application
 * starts serving requests, and — unlike a shared module — it is NEVER part of
 * the client bundle. That distinction is the whole reason the IPv4 preference
 * lives here: putting `node:dns` in `src/lib/api/http.ts` looked equivalent but
 * that module is reachable from client components (DetailsPanel -> flights ->
 * http), so webpack tried to bundle a Node builtin for the browser and the
 * production build failed with UnhandledSchemeError.
 *
 * Why IPv4 first: measured from the deployment's own egress,
 * eonet.gsfc.nasa.gov resolves to both 129.164.142.189 (v4) and
 * 2001:4d0:2310:170::189 (v6). A raw TCP :443 handshake succeeds on IPv4 in
 * ~404ms and fails immediately on IPv6 with ENETUNREACH, while Node's default
 * ordering picks IPv6 and the request then hangs until timeout — the cause of
 * the /api/natural-events 502 while USGS and Open-Meteo kept returning 200.
 *
 * Set in-process rather than through NODE_OPTIONS because render.yaml variables
 * are not applied to an already-created Render service, which would make an
 * env-only fix appear deployed while changing nothing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { default: dns } = await import('node:dns');
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // Older runtimes keep their default ordering; the EONET retry loop still
    // covers a failed first attempt, so this is a degradation, not a break.
  }
}
