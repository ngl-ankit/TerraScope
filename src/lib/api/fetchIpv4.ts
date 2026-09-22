/**
 * Server-only HTTPS GET pinned to IPv4.
 *
 * Measured from this deployment's egress: NASA EONET resolves to an IPv6 address
 * that is unreachable, and a hostname-based connect hangs on it instead of
 * falling back to the IPv4 route that demonstrably answers (a raw IPv4 TCP
 * handshake to the same host completes in ~370ms while the hostname connect
 * times out). DNS ordering flags did not change that, so the connection is
 * pinned at the socket level: connect to the IPv4 address, keep TLS SNI as the
 * real hostname, and preserve the Host header.
 *
 * Not for client use — `node:https` cannot be bundled for the browser.
 */
import dns from 'node:dns/promises';
import https from 'node:https';
import { UpstreamError } from './http';

export interface Ipv4GetOptions {
  provider: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function getJsonViaIpv4<T>(url: string, options: Ipv4GetOptions): Promise<T> {
  const { provider, timeoutMs = 12_000, headers = {}, signal } = options;
  const target = new URL(url);

  let address: string;
  try {
    const resolved = await dns.lookup(target.hostname, { family: 4 });
    address = resolved.address;
  } catch {
    throw new UpstreamError(`Could not resolve ${target.hostname} over IPv4.`, {
      code: 'upstream_unavailable', status: 502, retryable: true, provider,
    });
  }

  const text = await new Promise<string>((resolve, reject) => {
    const request = https.request(
      {
        host: address,
        servername: target.hostname,
        family: 4,
        port: target.port ? Number(target.port) : 443,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers: { Accept: 'application/json', 'Accept-Language': 'en', ...headers, Host: target.host },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new UpstreamError(`${provider} responded with HTTP ${status}.`, {
              code: status === 429 ? 'upstream_rate_limited' : 'upstream_unavailable',
              status: status === 429 ? 429 : 502,
              retryable: true,
              provider,
            }));
            return;
          }
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      },
    );

    const onAbort = () => request.destroy(new Error('aborted'));
    request.setTimeout(timeoutMs, () => request.destroy(new Error('timeout')));
    signal?.addEventListener('abort', onAbort, { once: true });
    request.on('error', () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new UpstreamError(`Could not reach ${provider}.`, {
        code: 'upstream_unavailable', status: 502, retryable: true, provider,
      }));
    });
    request.on('close', () => signal?.removeEventListener('abort', onAbort));
    request.end();
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(`${provider} returned a response that is not valid JSON.`, {
      code: 'upstream_unavailable', status: 502, retryable: true, provider,
    });
  }
}
