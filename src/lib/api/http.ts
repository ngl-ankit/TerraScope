/**
 * Server-side HTTP plumbing shared by every API client.
 *
 * Responsibilities:
 *  - enforce a hard timeout so a hung upstream can never pin a route handler;
 *  - translate provider failures into a small, typed error vocabulary;
 *  - never leak an upstream stack trace or credential into a response body.
 */

export type UpstreamErrorCode =
  | 'upstream_unavailable'
  | 'upstream_rate_limited'
  | 'upstream_unauthorized'
  | 'invalid_request'
  | 'timeout'
  | 'unknown';

export class UpstreamError extends Error {
  readonly code: UpstreamErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly provider: string;

  constructor(
    message: string,
    options: { code: UpstreamErrorCode; status?: number; retryable?: boolean; provider: string },
  ) {
    super(message);
    this.name = 'UpstreamError';
    this.code = options.code;
    this.status = options.status ?? 502;
    this.retryable = options.retryable ?? true;
    this.provider = options.provider;
  }
}

function classify(provider: string, status: number): UpstreamError {
  if (status === 429) {
    return new UpstreamError(`${provider} is rate limiting requests.`, {
      code: 'upstream_rate_limited',
      status: 429,
      retryable: true,
      provider,
    });
  }
  if (status === 401 || status === 403) {
    return new UpstreamError(`${provider} rejected the request (credentials required or not permitted).`, {
      code: 'upstream_unauthorized',
      status: 502,
      retryable: false,
      provider,
    });
  }
  if (status === 400 || status === 404 || status === 422) {
    return new UpstreamError(`${provider} could not satisfy the request.`, {
      code: 'invalid_request',
      status: 400,
      retryable: false,
      provider,
    });
  }
  return new UpstreamError(`${provider} responded with HTTP ${status}.`, {
    code: 'upstream_unavailable',
    status: 502,
    retryable: true,
    provider,
  });
}

export interface FetchOptions {
  /** Provider name used in error messages and logs. */
  provider: string;
  /**
   * Extra attempts after a retryable failure (dropped connection, timeout, 5xx).
   * Bounded by design: a provider that is down stays down, and the caller
   * decides whether to serve a stale payload or a fallback provider instead.
   */
  retries?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Next.js fetch cache directive. TerraScope caches in its own layer, so this defaults to `no-store`. */
  cache?: RequestCache;
  /** Abort from the caller (e.g. the browser disconnected). */
  signal?: AbortSignal;
  accept?: 'json' | 'text';
}

/**
 * Fetch + parse JSON with a timeout and a typed error surface.
 *
 * `AbortSignal.any` keeps both the caller's cancellation and our timeout in
 * play, so a cancelled request is not reported as an upstream failure.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Capped exponential backoff: 400ms, 800ms, 1600ms — never longer. */
function backoffMs(attempt: number): number {
  return Math.min(400 * 2 ** attempt, 1_600);
}

export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  const { retries = 0 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJsonOnce<T>(url, options);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof UpstreamError && error.retryable;
      // A 429 is a quota signal, not a hiccup: retrying inside the request only
      // spends more of the same budget. The caller's cooldown and the fallback
      // provider handle it instead.
      const rateLimited = error instanceof UpstreamError && error.code === 'upstream_rate_limited';
      if (!retryable || rateLimited || attempt === retries || options.signal?.aborted) break;
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError;
}

async function fetchJsonOnce<T>(url: string, options: FetchOptions): Promise<T> {
  const { provider, timeoutMs = 12_000, headers = {}, cache = 'no-store', signal, accept = 'json' } = options;

  const timeout = AbortSignal.timeout(timeoutMs);
  const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      cache,
      signal: composite,
      redirect: 'follow',
      headers: {
        Accept: accept === 'json' ? 'application/json' : 'text/plain, application/json;q=0.8',
        'Accept-Language': 'en',
        ...headers,
      },
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new UpstreamError('Request cancelled.', {
        code: 'unknown',
        status: 499,
        retryable: false,
        provider,
      });
    }
    if (timeout.aborted) {
      throw new UpstreamError(`${provider} did not respond within ${Math.round(timeoutMs / 1000)}s.`, {
        code: 'timeout',
        status: 504,
        retryable: true,
        provider,
      });
    }
    throw new UpstreamError(`Could not reach ${provider}.`, {
      code: 'upstream_unavailable',
      status: 502,
      retryable: true,
      provider,
    });
  }

  if (!response.ok) throw classify(provider, response.status);

  if (accept === 'text') return (await response.text()) as unknown as T;

  try {
    return (await response.json()) as T;
  } catch {
    throw new UpstreamError(`${provider} returned a response that is not valid JSON.`, {
      code: 'upstream_unavailable',
      status: 502,
      retryable: true,
      provider,
    });
  }
}

/** Shape of the JSON body every route handler emits on failure. */
export interface RouteErrorBody {
  error: string;
  code: UpstreamErrorCode;
  retryable: boolean;
}

export function toRouteError(error: unknown, fallbackProvider: string): { body: RouteErrorBody; status: number } {
  if (error instanceof UpstreamError) {
    return {
      body: { error: error.message, code: error.code, retryable: error.retryable },
      status: error.status >= 400 && error.status < 600 ? error.status : 502,
    };
  }
  return {
    body: {
      error: `Unexpected failure while contacting ${fallbackProvider}.`,
      code: 'unknown',
      retryable: true,
    },
    status: 500,
  };
}
