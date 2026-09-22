'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';

/**
 * The freshness contract, rendered.
 *
 * TerraScope never claims more than the provider does. `SourceMeta` carries both
 * the provider's observation time and our own sync time, and this component
 * picks the honest label: a `live` cadence that is more than two minutes old is
 * reported as "Last synchronised", not "Live".
 */

export interface DataFreshnessProps {
  /** Provider observation time (ms epoch). */
  observedAt: number | null;
  /** Last successful TerraScope sync (ms epoch). */
  updatedAt: number | null;
  /** Provider cadence, from `SourceMeta`. */
  cadence: 'live' | 'periodic' | 'near-real-time';
  stale: boolean;
  /** Current time, supplied by a single ticking clock upstream. */
  now: number;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}

function ageLabel(deltaSeconds: number): string {
  if (deltaSeconds < 5) return 'just now';
  if (deltaSeconds < 60) return `${deltaSeconds} seconds ago`;
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`;
}

export function DataFreshness({
  observedAt,
  updatedAt,
  cadence,
  stale,
  now,
  loading = false,
  compact = false,
  className = '',
}: DataFreshnessProps) {
  const reference = observedAt ?? updatedAt;
  const deltaSeconds = reference ? Math.max(0, Math.round((now - reference) / 1000)) : null;
  const age = deltaSeconds === null ? 'unknown' : ageLabel(deltaSeconds);

  // A "live" badge is only honest while the value really is recent.
  const isGenuinelyLive = cadence === 'live' && deltaSeconds !== null && deltaSeconds < 120 && !stale;

  const tone = stale
    ? 'text-layer-wildfire'
    : isGenuinelyLive
      ? 'text-layer-flight'
      : 'text-ink-muted';

  const headline = loading && !reference
    ? 'Synchronising'
    : stale
      ? 'Cached data'
      : isGenuinelyLive
        ? 'Live data'
        : cadence === 'periodic'
          ? 'Latest available data'
          : 'Near-real-time data';

  if (compact) {
    return (
      <span className={`mono inline-flex items-center gap-1.5 text-2xs ${tone} ${className}`}>
        {loading && <RefreshCw size={10} className="animate-spin" aria-hidden="true" />}
        {stale && <TriangleAlert size={10} aria-hidden="true" />}
        {headline}
        {age !== 'unknown' && <span className="text-ink-faint">· {age}</span>}
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs ${className}`}>
      <span className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.12em] ${tone}`}>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            stale ? 'bg-layer-wildfire' : isGenuinelyLive ? 'animate-pulse-soft bg-layer-flight' : 'bg-ink-faint'
          }`}
          aria-hidden="true"
        />
        {headline}
      </span>
      {age !== 'unknown' && <span className="mono text-ink-faint">Updated {age}</span>}
      {stale && <span className="text-layer-wildfire">Retry to refresh</span>}
    </div>
  );
}

/** One-line explanation of what a layer's cadence actually is. */
export function CadenceNote({ note, className = '' }: { note: string; className?: string }) {
  return <p className={`text-2xs leading-relaxed text-ink-faint ${className}`}>{note}</p>;
}
