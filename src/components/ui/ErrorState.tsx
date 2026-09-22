'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';

/**
 * Per-layer failure surface.
 *
 * Each data source fails independently: this component renders inside the panel
 * or over the globe for exactly one layer, so a USGS outage never affects the
 * EONET layer, the weather panel or the globe itself.
 */
export interface ErrorStateProps {
  /** What failed, in the user's terms: `Earthquake data`, `Flight positions`. */
  subject: string;
  /** Provider-specific detail, already humanised by `describeApiError`. */
  message?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  /** True when cached values are still being displayed underneath. */
  hasCachedData?: boolean;
  variant?: 'inline' | 'block';
  className?: string;
}

export function ErrorState({
  subject,
  message,
  onRetry,
  retrying = false,
  hasCachedData = false,
  variant = 'block',
  className = '',
}: ErrorStateProps) {
  if (variant === 'inline') {
    return (
      <div
        role="status"
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-layer-wildfire/25 bg-layer-wildfire/[0.07] px-2.5 py-1.5 ${className}`}
      >
        <TriangleAlert size={12} className="shrink-0 text-layer-wildfire" aria-hidden="true" />
        <span className="text-2xs font-medium text-ink-muted">
          {subject} temporarily unavailable.
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mono ml-auto inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-2xs font-semibold text-ink-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-50"
          >
            <RefreshCw size={9} className={retrying ? 'animate-spin' : ''} aria-hidden="true" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`rounded-xl border border-layer-wildfire/25 bg-layer-wildfire/[0.06] p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-layer-wildfire/30 bg-layer-wildfire/10"
          aria-hidden="true"
        >
          <TriangleAlert size={13} className="text-layer-wildfire" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink">{subject} temporarily unavailable.</p>
          <p className="mt-1 text-2xs leading-relaxed text-ink-muted">
            {message || 'The provider did not respond. The rest of TerraScope continues to work normally.'}
          </p>
          {hasCachedData && (
            <p className="mt-1 text-2xs leading-relaxed text-ink-faint">
              The last successfully synchronised values are still shown, labelled as cached.
            </p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="btn-ghost mt-3 h-8 px-2.5 text-2xs"
            >
              <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} aria-hidden="true" />
              {retrying ? 'Retrying' : 'Retry now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Neutral empty state, distinct from an error. */
export function EmptyState({
  title,
  description,
  className = '',
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-center ${className}`}>
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {description && <p className="mt-1 text-2xs leading-relaxed text-ink-faint">{description}</p>}
    </div>
  );
}

/** Skeleton row used while a list is loading for the first time. */
export function SkeletonRows({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-11 animate-pulse rounded-lg border border-white/[0.05] bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03] bg-[length:200%_100%]"
        />
      ))}
    </div>
  );
}
