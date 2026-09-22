import type { ApiEnvelope, ApiErrorBody } from '@/lib/types';

/**
 * Browser-side fetch helper for TerraScope's own route handlers.
 *
 * Adds: a typed error surface, an abort signal that is respected, and a hard
 * timeout so a stalled request cannot leave a layer spinning forever.
 */

export class ApiClientError extends Error {
  readonly code: ApiErrorBody['code'];
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, options: { code: ApiErrorBody['code']; status: number; retryable: boolean }) {
    super(message);
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

export interface ApiGetOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * GETs one of our own `/api/*` endpoints and unwraps the envelope.
 *
 * The envelope (rather than the raw payload) is returned so callers can show
 * `meta.observedAt` / `meta.stale` without a second request.
 */
export async function apiGet<T>(path: string, options: ApiGetOptions = {}): Promise<ApiEnvelope<T>> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(path, { signal: composite, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) {
      throw new ApiClientError('Request cancelled.', { code: 'unknown', status: 499, retryable: false });
    }
    if (timeout.aborted) {
      throw new ApiClientError('The request timed out.', { code: 'timeout', status: 504, retryable: true });
    }
    throw new ApiClientError('Network request failed.', {
      code: 'upstream_unavailable',
      status: 503,
      retryable: true,
    });
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorBody = payload as Partial<ApiErrorBody> | null;
    throw new ApiClientError(errorBody?.error ?? `Request failed with HTTP ${response.status}.`, {
      code: errorBody?.code ?? 'unknown',
      status: response.status,
      retryable: errorBody?.retryable ?? response.status >= 500,
    });
  }

  return payload as ApiEnvelope<T>;
}

/** Human-facing copy for each failure mode, kept out of the components. */
export function describeApiError(error: unknown, subject: string): string {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case 'upstream_rate_limited':
        return `${subject} is rate limiting this deployment.`;
      case 'upstream_unauthorized':
        return `${subject} rejected the request because credentials are required.`;
      case 'timeout':
        return `${subject} did not respond in time.`;
      case 'invalid_request':
        return `${subject} could not satisfy that request.`;
      case 'upstream_unavailable':
        return `${subject} is temporarily unavailable.`;
      default:
        return error.message || `${subject} failed unexpectedly.`;
    }
  }
  if (error instanceof Error) return error.message;
  return `${subject} failed unexpectedly.`;
}
