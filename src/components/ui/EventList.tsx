'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, Plane, Search as SearchIcon } from 'lucide-react';
import { CATEGORY_COLORS } from '@/lib/api/sources';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/ErrorState';
import { useNow } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { formatAge, formatCoordinates, formatNumber } from '@/lib/utils/format';
import type { LayerId } from '@/lib/types';

/**
 * Event list.
 *
 * A sortable, bounded feed of the strongest earthquakes and most recent natural
 * events. The cap matters: rendering 500 rows would cost more than the globe,
 * and nobody scrolls that far. Selecting a row drives the same store action as
 * clicking its marker, so the two entry points stay in sync.
 */

type ListTab = 'earthquakes' | 'naturalEvents';

const EARTHQUAKE_LIMIT = 60;
const EVENT_LIMIT = 60;

export function EventList({ retries }: { retries: Record<LayerId, () => void> }) {
  const [tab, setTab] = useState<ListTab>('earthquakes');
  const now = useNow(1000);

  const earthquakes = useTerraScope((s) => s.earthquakes);
  const naturalEvents = useTerraScope((s) => s.naturalEvents);
  const layers = useTerraScope((s) => s.layers);
  const selection = useTerraScope((s) => s.selection);
  const select = useTerraScope((s) => s.select);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  const quakeRows = useMemo(() => earthquakes.data.slice(0, EARTHQUAKE_LIMIT), [earthquakes.data]);
  const eventRows = useMemo(() => naturalEvents.data.slice(0, EVENT_LIMIT), [naturalEvents.data]);

  const activeState = tab === 'earthquakes' ? earthquakes : naturalEvents;
  const activeRetry = tab === 'earthquakes' ? retries.earthquakes : retries.naturalEvents;
  const isEnabled = tab === 'earthquakes' ? layers.earthquakes : layers.naturalEvents;

  const selectedId =
    selection?.kind === 'earthquake'
      ? selection.item.id
      : selection?.kind === 'naturalEvent'
        ? selection.item.id
        : null;

  return (
    <div className="flex min-h-0 flex-col">
      <header className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
        <SearchIcon size={13} className="text-ink-faint" aria-hidden="true" />
        <h2 className="section-label">Event feed</h2>
        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-white/[0.07] p-0.5">
          {(
            [
              { id: 'earthquakes' as ListTab, label: 'Seismic', count: earthquakes.data.length },
              { id: 'naturalEvents' as ListTab, label: 'Events', count: naturalEvents.data.length },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              aria-pressed={tab === option.id}
              className={`rounded-md px-2 py-1 text-2xs font-semibold transition ${
                tab === option.id ? 'bg-white/[0.08] text-ink' : 'text-ink-faint hover:text-ink-muted'
              }`}
            >
              {option.label}
              <span className="mono ml-1 text-ink-faint">{option.count}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!isEnabled ? (
          <EmptyState
            title={`${tab === 'earthquakes' ? 'Seismic' : 'Natural event'} layer is off`}
            description="Enable it in Data layers to load the feed."
            className="mx-1.5"
          />
        ) : activeState.status === 'error' && activeState.data.length === 0 ? (
          <ErrorState
            className="mx-1.5"
            subject={tab === 'earthquakes' ? 'Earthquake data' : 'Natural event data'}
            message={activeState.error}
            onRetry={activeRetry}
            retrying={activeState.retrying}
          />
        ) : activeState.status === 'loading' && activeState.data.length === 0 ? (
          <SkeletonRows rows={6} className="px-1.5" />
        ) : tab === 'earthquakes' ? (
          quakeRows.length === 0 ? (
            <EmptyState
              title="No earthquakes recorded"
              description="The USGS 2.5+ feed is empty for the last 24 hours."
              className="mx-1.5"
            />
          ) : (
            <ul className="space-y-0.5">
              {quakeRows.map((quake) => {
                const isSelected = selectedId === quake.id;
                return (
                  <li key={quake.id}>
                    <button
                      type="button"
                      onClick={() => {
                        select({ kind: 'earthquake', item: quake });
                        requestFlyTo(quake.lat, quake.lon, 1.5);
                      }}
                      aria-current={isSelected || undefined}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                        isSelected ? 'bg-layer-seismic/[0.12] ring-1 ring-inset ring-layer-seismic/30' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className="mono flex h-8 w-11 shrink-0 flex-col items-center justify-center rounded-md border text-2xs font-semibold leading-none"
                        style={{
                          borderColor: magnitudeColor(quake.magnitude, 0.35),
                          backgroundColor: magnitudeColor(quake.magnitude, 0.12),
                          color: magnitudeColor(quake.magnitude, 1),
                        }}
                      >
                        <span className="text-[11px]">{quake.magnitude.toFixed(1)}</span>
                        <span className="text-[8px] opacity-70">MAG</span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-2xs font-medium text-ink">{quake.place}</span>
                        <span className="mono mt-0.5 flex items-center gap-1.5 text-2xs text-ink-faint">
                          <span>{formatNumber(quake.depthKm, 0)} km deep</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatAge(quake.time, now)} ago</span>
                        </span>
                      </span>

                      {quake.tsunami && (
                        <span className="shrink-0 rounded bg-layer-volcano/15 px-1 py-0.5 text-[9px] font-semibold text-layer-volcano">
                          TSU
                        </span>
                      )}
                      <ArrowUpRight size={11} className="shrink-0 text-ink-faint" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : eventRows.length === 0 ? (
          <EmptyState
            title="No open natural events"
            description="NASA EONET reports no open events in the last 14 days."
            className="mx-1.5"
          />
        ) : (
          <ul className="space-y-0.5">
            {eventRows.map((event) => {
              const isSelected = selectedId === event.id;
              const color = CATEGORY_COLORS[event.categories[0] ?? 'other'] ?? CATEGORY_COLORS.other;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => {
                      select({ kind: 'naturalEvent', item: event });
                      requestFlyTo(event.lat, event.lon, 1.7);
                    }}
                    aria-current={isSelected || undefined}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                      isSelected ? 'bg-white/[0.07] ring-1 ring-inset ring-white/15' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-2xs font-medium text-ink">{event.title}</span>
                      <span className="mono mt-0.5 block truncate text-2xs text-ink-faint">
                        {event.categoryLabel} · {formatAge(event.time, now)} ago ·{' '}
                        {formatCoordinates(event.lat, event.lon, 1)}
                      </span>
                    </span>
                    {event.observationCount > 1 && (
                      <span className="mono shrink-0 rounded bg-white/[0.06] px-1 py-0.5 text-[9px] text-ink-faint">
                        {event.observationCount}pts
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* The list is capped; say so rather than silently truncating. */}
        {isEnabled && activeState.data.length > (tab === 'earthquakes' ? EARTHQUAKE_LIMIT : EVENT_LIMIT) && (
          <p className="mono px-2.5 py-2 text-2xs text-ink-faint">
            Showing the top {tab === 'earthquakes' ? EARTHQUAKE_LIMIT : EVENT_LIMIT} of {activeState.data.length}{' '}
            items.
          </p>
        )}
      </div>

      {activeState.meta && (
        <footer className="flex items-center gap-2 border-t border-white/[0.06] px-3.5 py-2.5">
          <Plane size={10} className="hidden text-ink-faint" aria-hidden="true" />
          <span className="mono text-2xs text-ink-faint">
            {activeState.meta.source} · synced {formatAge(activeState.meta.updatedAt, now)} ago
          </span>
          <ChevronDown size={10} className="ml-auto text-ink-faint" aria-hidden="true" />
        </footer>
      )}
    </div>
  );
}

/** Magnitude → colour, matching the globe's legend bands. */
function magnitudeColor(magnitude: number, alpha: number): string {
  const base =
    magnitude >= 6 ? [255, 61, 46] : magnitude >= 5 ? [255, 107, 44] : magnitude >= 4 ? [255, 138, 76] : [255, 178, 122];
  return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha})`;
}
