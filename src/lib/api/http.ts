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
export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
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
