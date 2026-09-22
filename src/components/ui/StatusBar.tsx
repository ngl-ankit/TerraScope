'use client';

import { useMemo } from 'react';
import { Activity, Database, Plane, Radio, Satellite, Waves, Wind } from 'lucide-react';
import { useOnlineStatus, useUtcClock } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { formatAge } from '@/lib/utils/format';
import type { LayerId } from '@/lib/types';

/**
 * Status bar.
 *
 * Reports what is actually true: a connectivity indicator, the current UTC
 * clock, per-source sync ages and the active layer count. It never says
 * "connected" for a source that is erroring — each pill has its own state and
 * the aggregate indicator only claims "all sources live" when every enabled
 * layer has synced successfully within its own cadence.
 */
export function StatusBar({ onOpenSources }: { onOpenSources: () => void }) {
  const { time, date } = useUtcClock();
  const online = useOnlineStatus();

  const layers = useTerraScope((s) => s.layers);
  const earthquakes = useTerraScope((s) => s.earthquakes);
  const naturalEvents = useTerraScope((s) => s.naturalEvents);
  const flights = useTerraScope((s) => s.flights);
  const airQuality = useTerraScope((s) => s.airQuality);

  const enabledCount = useMemo(
    () => Object.values(layers).filter(Boolean).length,
    [layers],
  );

  const sources = useMemo(
    () =>
      [
        { id: 'earthquakes' as LayerId, label: 'USGS', icon: Activity, state: earthquakes, color: '#ff8a4c' },
        { id: 'naturalEvents' as LayerId, label: 'EONET', icon: Satellite, state: naturalEvents, color: '#8b9dff' },
        { id: 'flights' as LayerId, label: 'OpenSky', icon: Plane, state: flights, color: '#7ee787' },
        { id: 'airQuality' as LayerId, label: 'Air', icon: Wind, state: airQuality, color: '#c084fc' },
      ].filter((source) => layers[source.id]),
    [airQuality, earthquakes, flights, layers, naturalEvents],
  );

  const healthyCount = sources.filter((source) => source.state.status === 'ready').length;
  const allHealthy = sources.length > 0 && healthyCount === sources.length;

  return (
    <div className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      {/* Connection */}
      <span className="flex items-center gap-1.5" title={online ? 'Network reachable' : 'Offline'}>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            !online ? 'bg-layer-wildfire' : allHealthy ? 'animate-pulse-soft bg-layer-flight' : 'bg-layer-seismic'
          }`}
          aria-hidden="true"
        />
        <span className="mono text-2xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
          {!online ? 'Offline' : allHealthy ? 'All sources live' : `${healthyCount}/${sources.length} sources`}
        </span>
      </span>

      <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />

      {/* Clock */}
      <span className="mono hidden items-center gap-1.5 text-2xs text-ink-muted sm:flex">
        <Radio size={10} className="text-ink-faint" aria-hidden="true" />
        {time}
        <span className="text-ink-faint">UTC</span>
      </span>

      <span className="hidden h-3 w-px bg-white/10 md:block" aria-hidden="true" />

      {/* Per-source ages */}
      <ul className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        {sources.map((source) => {
          const Icon = source.icon;
          const meta = source.state.meta;
          const isError = source.state.status === 'error';
          const isLoading = source.state.status === 'loading' && !meta;
          return (
            <li key={source.id} className="flex items-center gap-1" title={meta?.source ?? source.label}>
              <Icon
                size={10}
                style={{ color: isError ? '#ff6b3d' : source.color }}
                aria-hidden="true"
              />
              <span className="mono text-2xs text-ink-faint">{source.label}</span>
              <span className={`mono text-2xs ${isError ? 'text-layer-wildfire' : 'text-ink-muted'}`}>
                {isLoading ? '···' : isError ? 'error' : meta?.updatedAt ? formatAge(meta.updatedAt) : '--'}
              </span>
            </li>
          );
        })}
      </ul>

      <span className="hidden h-3 w-px bg-white/10 lg:block" aria-hidden="true" />

      <span className="mono hidden text-2xs text-ink-faint lg:inline">
        {enabledCount} {enabledCount === 1 ? 'layer' : 'layers'} active
      </span>

      <button
        type="button"
        onClick={onOpenSources}
        className="mono ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] px-2 py-1 text-2xs text-ink-faint transition hover:border-accent/30 hover:text-ink-muted"
      >
        <Database size={10} aria-hidden="true" />
        <span className="hidden xs:inline">Sources</span>
        <span className="xs:hidden">Info</span>
      </button>

      <span className="sr-only">
        Current date {date}, time {time} UTC.
      </span>
    </div>
  );
}

/** Compact status card used in the desktop HUD cluster. */
export function StatusCard({
  label,
  value,
  detail,
  accent = '#4cc9f0',
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="glass-soft min-w-0 flex-1 rounded-xl px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-2xs text-ink-faint">
        <span style={{ color: accent }} aria-hidden="true">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </p>
      <p className="mono mt-1 truncate text-sm font-semibold leading-none text-ink">{value}</p>
      {detail && <p className="mono mt-0.5 truncate text-2xs text-ink-faint">{detail}</p>}
    </div>
  );
}

export { Waves };
