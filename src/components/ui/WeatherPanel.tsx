'use client';

import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Minus,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/ErrorState';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { useNow } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { weatherKind } from '@/lib/api/weather';
import { bearingToCompass, formatCoordinates, formatNumber } from '@/lib/utils/format';
import type { WeatherBundle } from '@/lib/types';

/**
 * Weather panel.
 *
 * Only ever rendered for a coordinate the user selected — TerraScope does not
 * claim to show global weather. The forecast is presented as Open-Meteo returns
 * it: a current observation plus hourly and daily model output for that point,
 * with the model's own timestamp visible.
 */
export function WeatherPanel({ onRetry }: { onRetry?: () => void }) {
  const weather = useTerraScope((s) => s.weather);
  const focusedPlace = useTerraScope((s) => s.focusedPlace);
  const layers = useTerraScope((s) => s.layers);
  const now = useNow(1000);

  const data: WeatherBundle | null = weather.data;

  if (!focusedPlace) {
    return (
      <EmptyState
        title="Select a location to load conditions"
        description="Search for a city or click anywhere on the globe. Open-Meteo forecasts are fetched per coordinate, so TerraScope only shows weather for a point you chose."
      />
    );
  }

  if (!layers.weather && !data) {
    return (
      <EmptyState
        title="Weather layer is off"
        description="Enable the Weather layer to load conditions for the selected location."
      />
    );
  }

  if (weather.status === 'error' && !data) {
    return (
      <ErrorState
        subject="Weather data"
        message={weather.error}
        onRetry={onRetry}
        retrying={weather.retrying}
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.03]" />
        <div className="h-16 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.03]" />
      </div>
    );
  }

  const { current, daily, hourly } = data;
  const isDay = current.isDay ?? true;

  return (
    <div className="space-y-3">
      {/* Current conditions */}
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{focusedPlace.name}</p>
            <p className="mono mt-0.5 text-2xs text-ink-faint">
              {formatCoordinates(data.lat, data.lon, 3)}
            </p>
            <p className="mt-1 text-2xs text-ink-muted">
              {current.condition}
              {data.elevationM !== null && ` · ${Math.round(data.elevationM)} m elevation`}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="mono text-3xl font-semibold leading-none tracking-tight text-ink">
              {formatNumber(current.temperatureC, 1)}
              <span className="text-lg text-ink-muted">°C</span>
            </p>
            {current.apparentC !== null && (
              <p className="mono mt-1 text-2xs text-ink-faint">
                feels like {formatNumber(current.apparentC, 1)}°C
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-2xs text-ink-faint">
          <span className="chip !px-2 !py-0.5 !text-[10px]">{isDay ? 'Daytime' : 'Night'}</span>
          <span className="mono truncate">{data.timezone}</span>
          <span className="mono ml-auto shrink-0">{data.timezoneAbbreviation}</span>
        </div>
      </div>

      {/* Metric grid */}
      <dl className="grid grid-cols-2 gap-1.5">
        <Metric
          icon={<Wind size={11} aria-hidden="true" />}
          label="Wind"
          value={current.windSpeedKmh === null ? '--' : `${formatNumber(current.windSpeedKmh, 0)} km/h`}
          detail={
            current.windDirectionDeg === null
              ? undefined
              : `${bearingToCompass(current.windDirectionDeg)} ${Math.round(current.windDirectionDeg)}°`
          }
        />
        <Metric
          icon={<Droplets size={11} aria-hidden="true" />}
          label="Humidity"
          value={current.humidityPct === null ? '--' : `${Math.round(current.humidityPct)}%`}
          detail={current.precipitationMm ? `${formatNumber(current.precipitationMm, 1)} mm now` : undefined}
        />
        <Metric
          icon={<Gauge size={11} aria-hidden="true" />}
          label="Pressure"
          value={current.pressureHpa === null ? '--' : `${formatNumber(current.pressureHpa, 0)} hPa`}
        />
        <Metric
          icon={<Eye size={11} aria-hidden="true" />}
          label="Cloud cover"
          value={current.cloudCoverPct === null ? '--' : `${Math.round(current.cloudCoverPct)}%`}
        />
        <Metric
          icon={<Thermometer size={11} aria-hidden="true" />}
          label="Gusts"
          value={current.windGustKmh === null ? '--' : `${formatNumber(current.windGustKmh, 0)} km/h`}
        />
        <Metric
          icon={<Compass size={11} aria-hidden="true" />}
          label="Direction"
          value={current.windDirectionDeg === null ? '--' : `${Math.round(current.windDirectionDeg)}°`}
          detail={bearingToCompass(current.windDirectionDeg) || undefined}
        />
      </dl>

      {/* Daily forecast */}
      {daily.length > 0 && (
        <section>
          <h3 className="section-label mb-1.5">Daily outlook</h3>
          <ul className="space-y-1">
            {daily.map((day, index) => {
              const kind = weatherKind(day.weatherCode);
              const date = new Date(`${day.date}T00:00:00Z`);
              const label =
                index === 0
                  ? 'Today'
                  : date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
              return (
                <li
                  key={day.date}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <span className="w-11 shrink-0 text-2xs font-semibold text-ink-muted">{label}</span>
                  <WeatherGlyph kind={kind} />
                  <span className="min-w-0 flex-1 truncate text-2xs text-ink-faint">{day.condition}</span>
                  <span className="mono shrink-0 text-2xs text-ink-muted">
                    {formatNumber(day.minC, 0)}° / {formatNumber(day.maxC, 0)}°
                  </span>
                  {day.precipitationMm !== null && day.precipitationMm > 0 && (
                    <span className="mono shrink-0 text-2xs text-accent-soft">
                      {formatNumber(day.precipitationMm, 1)}mm
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Next hours */}
      {hourly.length > 0 && (
        <section>
          <h3 className="section-label mb-1.5">Next 24 hours</h3>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {hourly.map((hour) => (
              <div
                key={hour.time}
                className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-1.5 py-2"
              >
                <span className="mono text-2xs text-ink-faint">{hour.time.slice(11, 13)}:00</span>
                <WeatherGlyph kind={weatherKind(hour.weatherCode)} />
                <span className="mono text-2xs font-semibold text-ink">
                  {formatNumber(hour.temperatureC, 0)}°
                </span>
                {hour.precipitationProbabilityPct !== null && hour.precipitationProbabilityPct > 15 && (
                  <span className="mono text-[9px] text-accent-soft">
                    {Math.round(hour.precipitationProbabilityPct)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sun times */}
      {daily[0]?.sunrise && daily[0]?.sunset && (
        <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <Sunrise size={12} className="text-ink-faint" aria-hidden="true" />
          <span className="mono text-2xs text-ink-muted">{daily[0].sunrise.slice(11, 16)}</span>
          <Sunset size={12} className="ml-2 text-ink-faint" aria-hidden="true" />
          <span className="mono text-2xs text-ink-muted">{daily[0].sunset.slice(11, 16)}</span>
          <span className="ml-auto text-2xs text-ink-faint">local time</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        <DataFreshness
          observedAt={weather.meta?.observedAt ?? null}
          updatedAt={weather.meta?.updatedAt ?? null}
          cadence={weather.meta?.cadence ?? 'periodic'}
          stale={weather.meta?.stale ?? false}
          loading={weather.status === 'loading'}
          now={now}
        />
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="text-2xs text-ink-faint underline decoration-dotted underline-offset-2 transition hover:text-ink-muted"
        >
          Open-Meteo
        </a>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <dt className="flex items-center gap-1.5 text-2xs text-ink-faint">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="mono mt-1 text-xs font-semibold text-ink">{value}</dd>
      {detail && <dd className="mono text-[10px] text-ink-faint">{detail}</dd>}
    </div>
  );
}

/** Compact condition glyph drawn from primitives — no emoji, no icon-font. */
function WeatherGlyph({ kind }: { kind: ReturnType<typeof weatherKind> }) {
  const common = 'text-ink-muted';
  switch (kind) {
    case 'clear':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" className="text-layer-wildfire" aria-hidden="true">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M12 2.4v2.6M12 19v2.6M2.4 12h2.6M19 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9" />
          </g>
        </svg>
      );
    case 'cloud':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" className={common} aria-hidden="true">
          <path
            d="M7 18h9.5a4 4 0 0 0 .3-8 5.6 5.6 0 0 0-10.6 1.4A3.4 3.4 0 0 0 7 18Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'rain':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" className="text-accent" aria-hidden="true">
          <path
            d="M7 15h9.5a3.6 3.6 0 0 0 .2-7.2A5.2 5.2 0 0 0 6.9 9.2 3.2 3.2 0 0 0 7 15Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8.6 18v2.2M12 18v2.2M15.4 18v2.2" />
          </g>
        </svg>
      );
    case 'snow':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" className="text-layer-ice" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
          </g>
        </svg>
      );
    case 'storm':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" className="text-layer-storm" aria-hidden="true">
          <path d="M13 3 6.5 13h4.2l-1 8 7.8-10.5h-4.6L13 3Z" fill="currentColor" />
        </svg>
      );
    case 'fog':
      return (
        <svg width="13" height="13" viewBox="0 0 24 24" className={common} aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 9h16M6 13h13M4 17h11" />
          </g>
        </svg>
      );
    default:
      return <Minus size={11} className={common} aria-hidden="true" />;
  }
}

/** Direction arrow for wind, rotated to the bearing. */
export function WindArrow({ degrees }: { degrees: number | null }) {
  const rotation = useMemo(() => (degrees === null ? 0 : degrees), [degrees]);
  if (degrees === null) return <Minus size={11} className="text-ink-faint" aria-hidden="true" />;
  return (
    <span style={{ transform: `rotate(${rotation}deg)` }} className="inline-flex">
      <ArrowUp size={11} className="text-ink-muted" aria-hidden="true" />
    </span>
  );
}

export { ArrowDown, ArrowUp };
