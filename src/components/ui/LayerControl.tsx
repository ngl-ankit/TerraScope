'use client';

import { Layers, RefreshCw } from 'lucide-react';
import { LAYERS } from '@/lib/api/sources';
import { ErrorState } from '@/components/ui/ErrorState';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { useNow } from '@/lib/hooks/useNow';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { formatAge } from '@/lib/utils/format';
import type { LayerId, LayerDescriptor } from '@/lib/types';

/**
 * Layer control panel.
 *
 * One row per layer, each carrying its own live state: an event count, a
 * freshness label, a per-layer error and a per-layer retry. The panel never
 * shows a global "error" — a broken provider is reported exactly where it
 * belongs.
 */

interface LayerControlProps {
  retries: Record<LayerId, () => void>;
  /** `panel` for the desktop dock, `sheet` inside the mobile bottom sheet. */
  variant?: 'panel' | 'sheet';
  className?: string;
}

const COUNT_KEYS: Record<LayerId, 'earthquakes' | 'naturalEvents' | 'flights' | 'airQuality' | 'weather'> = {
  earthquakes: 'earthquakes',
  naturalEvents: 'naturalEvents',
  flights: 'flights',
  airQuality: 'airQuality',
  weather: 'weather',
};

export function LayerControl({ retries, variant = 'panel', className = '' }: LayerControlProps) {
  const layers = useTerraScope((s) => s.layers);
  const toggleLayer = useTerraScope((s) => s.toggleLayer);
  const state = useTerraScope((s) => ({
    earthquakes: s.earthquakes,
    naturalEvents: s.naturalEvents,
    flights: s.flights,
    airQuality: s.airQuality,
    weather: s.weather,
  }));
  const focusedPlace = useTerraScope((s) => s.focusedPlace);
  const now = useNow(1000);

  const counts = {
    earthquakes: state.earthquakes.data.length,
    naturalEvents: state.naturalEvents.data.length,
    flights: state.flights.data.aircraft.length,
    airQuality: state.airQuality.data.length,
    weather: state.weather.data ? 1 : 0,
  };

  return (
    <div className={className}>
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
        <Layers size={13} className="text-ink-faint" aria-hidden="true" />
        <h2 className="section-label">Data layers</h2>
      </header>

      <ul className="space-y-1 px-2 pb-2">
        {LAYERS.map((layer) => {
          const enabled = layers[layer.id];
          const layerState = state[COUNT_KEYS[layer.id]];
          const isLoading = layerState.status === 'loading' && layerState.lastSuccessAt === null;
          const hasError = layerState.status === 'error';
          const requiresLocation = layer.requiresLocation && !focusedPlace;

          return (
            <li key={layer.id}>
              <div
                className={`rounded-xl border transition duration-200 ${
                  enabled ? 'border-white/[0.09] bg-white/[0.035]' : 'border-transparent bg-transparent'
                }`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${layer.label} layer`}
                  onClick={() => toggleLayer(layer.id)}
                  className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.03]"
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition"
                    style={{
                      borderColor: enabled ? `${layer.color}80` : 'rgba(148,163,184,0.25)',
                      backgroundColor: enabled ? `${layer.color}26` : 'transparent',
                    }}
                    aria-hidden="true"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full transition"
                      style={{ backgroundColor: enabled ? layer.color : 'transparent' }}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-xs font-semibold transition ${
                          enabled ? 'text-ink' : 'text-ink-muted'
                        }`}
                      >
                        {layer.label}
                      </span>
                      {isLoading && enabled && (
                        <RefreshCw size={9} className="animate-spin text-accent" aria-hidden="true" />
                      )}
                    </span>

                    <span className="mt-0.5 block truncate text-2xs leading-relaxed text-ink-faint">
                      {layer.description}
                    </span>

                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="mono text-2xs" style={{ color: enabled ? layer.color : undefined }}>
                        {enabled ? `${counts[COUNT_KEYS[layer.id]]} items` : 'off'}
                      </span>
                      {enabled && layerState.meta && (
                        <span className="mono text-2xs text-ink-faint">
                          synced {formatAge(layerState.meta.updatedAt, now)}
                        </span>
                      )}
                      {enabled && requiresLocation && (
                        <span className="text-2xs text-ink-faint">needs a location</span>
                      )}
                    </span>
                  </span>
                </button>

                {enabled && hasError && (
                  <div className="px-2.5 pb-2.5">
                    <ErrorState
                      variant="inline"
                      subject={`${layer.shortLabel} data`}
                      message={layerState.error}
                      onRetry={retries[layer.id]}
                      retrying={layerState.retrying}
                      hasCachedData={layerState.data !== null && counts[COUNT_KEYS[layer.id]] > 0}
                    />
                  </div>
                )}

                {enabled && !hasError && layerState.meta && (
                  <div className="px-2.5 pb-2.5">
                    <DataFreshness
                      compact
                      observedAt={layerState.meta.observedAt}
                      updatedAt={layerState.meta.updatedAt}
                      cadence={layerState.meta.cadence}
                      stale={layerState.meta.stale}
                      loading={isLoading}
                      now={now}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Legend className="border-t border-white/[0.06] px-3.5 py-3" />

      {variant === 'sheet' && (
        <p className="border-t border-white/[0.06] px-3.5 py-3 text-2xs leading-relaxed text-ink-faint">
          Each layer polls its provider at its own interval and fails independently. Providers are listed under
          Data sources.
        </p>
      )}
    </div>
  );
}

/** Marker legend — the same tokens the globe layers use. */
function Legend({ className = '' }: { className?: string }) {
  const now = useNow(1000);

  return (
    <div className={className}>
      <p className="section-label mb-2">Legend</p>
      <ul className="space-y-1.5">
        {(
          [
            { color: '#ff8a4c', label: 'Earthquake', note: 'size scales with magnitude' },
            { color: '#8b9dff', label: 'Natural event', note: 'colour by category' },
            { color: '#7ee787', label: 'Aircraft climbing', note: 'green' },
            { color: '#4cc9f0', label: 'Aircraft level', note: 'cyan' },
            { color: '#ffd166', label: 'Aircraft descending', note: 'amber' },
            { color: '#c084fc', label: 'Air quality', note: 'European AQI band' },
          ] as const
        ).map((entry) => (
          <li key={entry.label} className="flex items-center gap-2 text-2xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="text-ink-muted">{entry.label}</span>
            <span className="ml-auto text-ink-faint">{entry.note}</span>
          </li>
        ))}
      </ul>
      <p className="mono mt-3 text-2xs text-ink-faint">
        Clock {new Date(now).toISOString().slice(11, 19)} UTC
      </p>
    </div>
  );
}

export type { LayerDescriptor };
