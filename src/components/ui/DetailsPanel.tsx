'use client';

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Clock,
  ExternalLink,
  Flame,
  Gauge,
  Layers3,
  Minus,
  Mountain,
  Plane,
  Radio,
  Satellite,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { WeatherPanel } from '@/components/ui/WeatherPanel';
import { useNow } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { nearestAirports } from '@/lib/api/flights';
import { aqiCategory } from '@/lib/api/sources';
import { CATEGORY_COLORS } from '@/lib/api/sources';
import {
  bearingToCompass,
  formatAltitude,
  formatCoordinates,
  formatInteger,
  formatNumber,
  formatRelativeTime,
  formatSpeed,
  formatUtc,
  hostnameOf,
  titleCase,
} from '@/lib/utils/format';
import type { LayerId } from '@/lib/types';

/**
 * Details panel.
 *
 * One panel, five selection kinds, every field taken verbatim from the provider
 * payload (normalised upstream in `lib/api`). Each kind shows its own source
 * attribution and a link back to the original record, and the freshness block is
 * driven by the same `SourceMeta` contract as the layer control.
 *
 * For `place` selections the weather panel is embedded, because that is the
 * whole point of searching a location.
 */

interface DetailsPanelProps {
  retries: Record<LayerId, () => void>;
}

export function DetailsPanel({ retries }: DetailsPanelProps) {
  const selection = useTerraScope((s) => s.selection);
  const now = useNow(1000);

  if (!selection) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]"
          aria-hidden="true"
        >
          <Satellite size={16} className="text-ink-faint" />
        </span>
        <p className="text-xs font-medium text-ink-muted">Nothing selected</p>
        <p className="max-w-[15rem] text-2xs leading-relaxed text-ink-faint">
          Pick a marker on the globe, search a location, or click anywhere on the surface to inspect what is
          happening there.
        </p>
      </div>
    );
  }

  switch (selection.kind) {
    case 'earthquake':
      return <EarthquakeDetails now={now} />;
    case 'naturalEvent':
      return <NaturalEventDetails now={now} />;
    case 'aircraft':
      return <AircraftDetails now={now} />;
    case 'airQuality':
      return <AirQualityDetails now={now} />;
    case 'place':
      return <PlaceDetails retries={retries} />;
    default:
      return null;
  }
}

/* ────────────────────────────── Earthquakes ─────────────────────────────── */

function EarthquakeDetails({ now }: { now: number }) {
  const selection = useTerraScope((s) => s.selection);
  const layerState = useTerraScope((s) => s.earthquakes);
  const retry = useTerraScope((s) => s.setRetrying);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  if (selection?.kind !== 'earthquake') return null;
  const quake = selection.item;

  const severity = useMemo(() => {
    if (quake.magnitude >= 7) return { label: 'Major', tone: 'text-layer-volcano', bar: 'bg-layer-volcano' };
    if (quake.magnitude >= 6) return { label: 'Strong', tone: 'text-layer-wildfire', bar: 'bg-layer-wildfire' };
    if (quake.magnitude >= 5) return { label: 'Moderate', tone: 'text-layer-seismic', bar: 'bg-layer-seismic' };
    if (quake.magnitude >= 4) return { label: 'Light', tone: 'text-layer-air', bar: 'bg-layer-air' };
    return { label: 'Minor', tone: 'text-ink-muted', bar: 'bg-ink-faint' };
  }, [quake.magnitude]);

  return (
    <div className="space-y-3.5">
      <PanelHeader
        icon={<Activity size={13} aria-hidden="true" />}
        accent="#ff8a4c"
        eyebrow="Seismic event"
        title={quake.place}
        badge={
          <span className={`chip !px-2 !py-0.5 ${severity.tone}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${severity.bar}`} aria-hidden="true" />
            {severity.label}
          </span>
        }
      />

      {/* Magnitude hero */}
      <div className="rounded-xl border border-layer-seismic/20 bg-layer-seismic/[0.06] p-3.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="section-label">Magnitude</p>
            <p className="mono mt-1 text-3xl font-semibold leading-none tracking-tight text-ink">
              {quake.magnitude.toFixed(1)}
              {quake.magType && <span className="ml-1 text-sm text-ink-muted">{quake.magType}</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="section-label">Depth</p>
            <p className="mono mt-1 text-sm font-semibold text-ink">{formatNumber(quake.depthKm, 1)} km</p>
          </div>
        </div>
        {quake.tsunami && (
          <p className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-layer-volcano/30 bg-layer-volcano/10 px-2 py-1.5 text-2xs text-layer-volcano">
            <Waves size={11} aria-hidden="true" />
            USGS flagged a possible tsunami for this event.
          </p>
        )}
      </div>

      <FieldGrid
        fields={[
          { icon: <Clock size={11} />, label: 'Origin time', value: formatUtc(quake.time), mono: true },
          { icon: <Radio size={11} />, label: 'Reported', value: formatRelativeTime(quake.time, now) },
          { icon: <Satellite size={11} />, label: 'Coordinates', value: formatCoordinates(quake.lat, quake.lon, 3), mono: true },
          { icon: <Layers3 size={11} />, label: 'Network', value: quake.network ? quake.network.toUpperCase() : '--' },
          { icon: <Gauge size={11} />, label: 'Significance', value: quake.significance === null ? '--' : formatInteger(quake.significance) },
          { icon: <Activity size={11} />, label: 'Felt reports', value: quake.felt === null ? 'None reported' : formatInteger(quake.felt) },
        ]}
      />

      {quake.alert && (
        <p className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-2xs text-ink-muted">
          USGS PAGER alert level: <span className="font-semibold text-ink">{titleCase(quake.alert)}</span>
        </p>
      )}

      <div className="flex gap-1.5">
        <button type="button" onClick={() => requestFlyTo(quake.lat, quake.lon, 1.4)} className="btn-ghost flex-1">
          <Satellite size={11} aria-hidden="true" />
          Zoom to event
        </button>
        <a
          href={quake.url}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-ghost flex-1"
        >
          <ExternalLink size={11} aria-hidden="true" />
          USGS event page
        </a>
      </div>

      <SourceFooter
        label="Source: USGS Earthquake Hazards Program"
        url="https://earthquake.usgs.gov/"
        freshness={
          <DataFreshness
            observedAt={layerState.meta?.observedAt ?? quake.time}
            updatedAt={layerState.meta?.updatedAt ?? null}
            cadence={layerState.meta?.cadence ?? 'near-real-time'}
            stale={layerState.meta?.stale ?? false}
            now={now}
          />
        }
        onRetry={() => retry('earthquakes', true)}
      />
    </div>
  );
}

/* ──────────────────────────── Natural events ────────────────────────────── */

function NaturalEventDetails({ now }: { now: number }) {
  const selection = useTerraScope((s) => s.selection);
  const layerState = useTerraScope((s) => s.naturalEvents);
  const retry = useTerraScope((s) => s.setRetrying);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  if (selection?.kind !== 'naturalEvent') return null;
  const event = selection.item;

  const color = CATEGORY_COLORS[event.categories[0] ?? 'other'] ?? CATEGORY_COLORS.other;
  const primarySource = event.sources[0];

  return (
    <div className="space-y-3.5">
      <PanelHeader
        icon={<Flame size={13} aria-hidden="true" />}
        accent={color}
        eyebrow={event.categoryLabel}
        title={event.title}
        badge={
          <span className="chip !px-2 !py-0.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {event.closed ? 'Closed' : 'Open'}
          </span>
        }
      />

      <FieldGrid
        fields={[
          { icon: <Clock size={11} />, label: 'Latest observation', value: formatUtc(event.time), mono: true },
          { icon: <Radio size={11} />, label: 'Reported', value: formatRelativeTime(event.time, now) },
          { icon: <Satellite size={11} />, label: 'Coordinates', value: formatCoordinates(event.lat, event.lon, 3), mono: true },
          { icon: <Layers3 size={11} />, label: 'Observations', value: `${event.observationCount} geometry point${event.observationCount === 1 ? '' : 's'}` },
          ...(event.magnitudeValue !== null
            ? [
                {
                  icon: <Gauge size={11} />,
                  label: 'Reported magnitude',
                  value: `${formatNumber(event.magnitudeValue, 1)}${event.magnitudeUnit ? ` ${event.magnitudeUnit}` : ''}`,
                },
              ]
            : []),
          { icon: <Activity size={11} />, label: 'Categories', value: event.categories.map(titleCase).join(', ') },
        ]}
      />

      {event.description && (
        <section>
          <h3 className="section-label mb-1.5">Description</h3>
          <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-2xs leading-relaxed text-ink-muted">
            {event.description}
          </p>
        </section>
      )}

      {event.track.length > 1 && (
        <section>
          <h3 className="section-label mb-1.5">Track ({event.track.length} points)</h3>
          <ol className="scroll-thin max-h-40 space-y-1 overflow-y-auto">
            {[...event.track].reverse().map((point, index) => (
              <li
                key={`${point.time}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
              >
                <span className="mono w-4 shrink-0 text-2xs text-ink-faint">{event.track.length - index}</span>
                <span className="mono min-w-0 flex-1 truncate text-2xs text-ink-muted">
                  {formatCoordinates(point.lat, point.lon, 2)}
                </span>
                <span className="mono shrink-0 text-2xs text-ink-faint">
                  {point.time ? new Date(point.time).toISOString().slice(0, 10) : '--'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {event.sources.length > 0 && (
        <section>
          <h3 className="section-label mb-1.5">Upstream sources</h3>
          <ul className="space-y-1">
            {event.sources.map((source) => (
              <li key={`${source.id}-${source.url}`}>
                <a
                  href={source.url || 'https://eonet.gsfc.nasa.gov/'}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-2xs text-ink-muted transition hover:border-accent/30 hover:text-ink"
                >
                  <span className="mono shrink-0 font-semibold">{source.id}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-faint">{hostnameOf(source.url)}</span>
                  <ExternalLink size={10} className="shrink-0" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-1.5">
        <button type="button" onClick={() => requestFlyTo(event.lat, event.lon, 1.6)} className="btn-ghost flex-1">
          <Satellite size={11} aria-hidden="true" />
          Zoom to event
        </button>
        <a href={event.link} target="_blank" rel="noreferrer noopener" className="btn-ghost flex-1">
          <ExternalLink size={11} aria-hidden="true" />
          EONET record
        </a>
      </div>

      <SourceFooter
        label={primarySource ? `Source: NASA EONET · ${primarySource.id}` : 'Source: NASA EONET v3'}
        url="https://eonet.gsfc.nasa.gov/"
        freshness={
          <DataFreshness
            observedAt={layerState.meta?.observedAt ?? event.time}
            updatedAt={layerState.meta?.updatedAt ?? null}
            cadence={layerState.meta?.cadence ?? 'near-real-time'}
            stale={layerState.meta?.stale ?? false}
            now={now}
          />
        }
        onRetry={() => retry('naturalEvents', true)}
      />
    </div>
  );
}

/* ─────────────────────────────── Aircraft ───────────────────────────────── */

function AircraftDetails({ now }: { now: number }) {
  const selection = useTerraScope((s) => s.selection);
  const layerState = useTerraScope((s) => s.flights);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  if (selection?.kind !== 'aircraft') return null;
  const aircraft = selection.item;

  const verticalTone =
    aircraft.verticalRateMs === null || Math.abs(aircraft.verticalRateMs) < 0.6
      ? { label: 'Level', color: '#4cc9f0', icon: <Minus size={11} aria-hidden="true" /> }
      : aircraft.verticalRateMs > 0
        ? { label: 'Climbing', color: '#7ee787', icon: <ArrowUp size={11} aria-hidden="true" /> }
        : { label: 'Descending', color: '#ffd166', icon: <ArrowDown size={11} aria-hidden="true" /> };

  const nearby = useMemo(() => nearestAirports(aircraft.lat, aircraft.lon, 3), [aircraft.lat, aircraft.lon]);

  return (
    <div className="space-y-3.5">
      <PanelHeader
        icon={<Plane size={13} aria-hidden="true" />}
        accent="#7ee787"
        eyebrow="Live aircraft · OpenSky"
        title={aircraft.callsign ?? aircraft.icao24.toUpperCase()}
        badge={
          <span className="chip !px-2 !py-0.5" style={{ color: verticalTone.color }}>
            {verticalTone.icon}
            {verticalTone.label}
          </span>
        }
      />

      <FieldGrid
        fields={[
          { icon: <Plane size={11} />, label: 'ICAO24', value: aircraft.icao24.toUpperCase(), mono: true },
          { icon: <Satellite size={11} />, label: 'Registration country', value: aircraft.originCountry },
          { icon: <Mountain size={11} />, label: 'Altitude', value: formatAltitude(aircraft.altitudeM), mono: true },
          { icon: <Wind size={11} />, label: 'Ground speed', value: formatSpeed(aircraft.velocityMs), mono: true },
          {
            icon: <Radio size={11} />,
            label: 'Heading',
            value: aircraft.headingDeg === null ? '--' : `${Math.round(aircraft.headingDeg)}° ${bearingToCompass(aircraft.headingDeg)}`,
            mono: true,
          },
          {
            icon: <Activity size={11} />,
            label: 'Vertical rate',
            value: aircraft.verticalRateMs === null ? '--' : `${formatNumber(aircraft.verticalRateMs, 1)} m/s`,
            mono: true,
          },
          { icon: <Satellite size={11} />, label: 'Coordinates', value: formatCoordinates(aircraft.lat, aircraft.lon, 3), mono: true },
          { icon: <Clock size={11} />, label: 'Last position update', value: formatRelativeTime(aircraft.lastContact, now) },
          { icon: <Gauge size={11} />, label: 'Squawk', value: aircraft.squawk ?? '--', mono: true },
          { icon: <Layers3 size={11} />, label: 'On ground', value: aircraft.onGround ? 'Yes' : 'No' },
        ]}
      />

      {nearby.length > 0 && (
        <section>
          <h3 className="section-label mb-1.5">Nearest reference airports</h3>
          <ul className="space-y-1">
            {nearby.map(({ airport, km }) => (
              <li
                key={airport.iata}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-2xs"
              >
                <span className="mono shrink-0 font-semibold text-ink-muted">{airport.iata}</span>
                <span className="min-w-0 flex-1 truncate text-ink-faint">
                  {airport.name}, {airport.city}
                </span>
                <span className="mono shrink-0 text-ink-muted">{Math.round(km)} km</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => requestFlyTo(aircraft.lat, aircraft.lon, 1.35)}
        className="btn-ghost w-full"
      >
        <Satellite size={11} aria-hidden="true" />
        Zoom to aircraft
      </button>

      <SourceFooter
        label="Source: OpenSky Network"
        url="https://opensky-network.org/"
        freshness={
          <DataFreshness
            observedAt={aircraft.lastContact}
            updatedAt={layerState.meta?.updatedAt ?? null}
            cadence="live"
            stale={layerState.meta?.stale ?? false}
            now={now}
          />
        }
        note={layerState.meta?.cadenceNote}
      />
    </div>
  );
}

/* ────────────────────────────── Air quality ─────────────────────────────── */

function AirQualityDetails({ now }: { now: number }) {
  const selection = useTerraScope((s) => s.selection);
  const layerState = useTerraScope((s) => s.airQuality);

  if (selection?.kind !== 'airQuality') return null;
  const sample = selection.item;
  const category = aqiCategory(sample.europeanAqi);

  return (
    <div className="space-y-3.5">
      <PanelHeader
        icon={<Thermometer size={13} aria-hidden="true" />}
        accent={category.color}
        eyebrow="Air quality sample"
        title={sample.name}
        badge={
          <span className="chip !px-2 !py-0.5" style={{ color: category.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
            {category.label}
          </span>
        }
      />

      <div className="rounded-xl border p-3.5" style={{ borderColor: `${category.color}33`, backgroundColor: `${category.color}0f` }}>
        <p className="section-label">European AQI</p>
        <p className="mono mt-1 text-3xl font-semibold leading-none tracking-tight text-ink">
          {sample.europeanAqi ?? '--'}
        </p>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.min(100, ((sample.europeanAqi ?? 0) / 120) * 100)}%`,
              backgroundColor: category.color,
            }}
          />
        </div>
        <p className="mt-1.5 text-2xs text-ink-faint">Band 0–100+ · higher is worse</p>
      </div>

      <FieldGrid
        fields={[
          { icon: <Layers3 size={11} />, label: 'Country', value: sample.country },
          { icon: <Satellite size={11} />, label: 'Coordinates', value: formatCoordinates(sample.lat, sample.lon, 3), mono: true },
          { icon: <Activity size={11} />, label: 'PM2.5', value: sample.pm25 === null ? '--' : `${formatNumber(sample.pm25, 1)} µg/m³`, mono: true },
          { icon: <Activity size={11} />, label: 'PM10', value: sample.pm10 === null ? '--' : `${formatNumber(sample.pm10, 1)} µg/m³`, mono: true },
          { icon: <Wind size={11} />, label: 'NO₂', value: sample.no2 === null ? '--' : `${formatNumber(sample.no2, 1)} µg/m³`, mono: true },
          { icon: <Wind size={11} />, label: 'Ozone', value: sample.ozone === null ? '--' : `${formatNumber(sample.ozone, 1)} µg/m³`, mono: true },
          { icon: <Gauge size={11} />, label: 'US AQI', value: sample.usAqi === null ? '--' : formatInteger(sample.usAqi), mono: true },
          { icon: <Clock size={11} />, label: 'Model hour', value: sample.observedAt ?? '--', mono: true },
        ]}
      />

      <SourceFooter
        label="Source: Open-Meteo Air Quality (CAMS-based model)"
        url="https://open-meteo.com/en/docs/air-quality-api"
        freshness={
          <DataFreshness
            observedAt={layerState.meta?.observedAt ?? null}
            updatedAt={layerState.meta?.updatedAt ?? null}
            cadence="near-real-time"
            stale={layerState.meta?.stale ?? false}
            now={now}
          />
        }
        note="Sampled at 32 cities, not a global measurement grid."
      />
    </div>
  );
}

/* ──────────────────────────────── Place ─────────────────────────────────── */

function PlaceDetails({ retries }: { retries: Record<LayerId, () => void> }) {
  const selection = useTerraScope((s) => s.selection);
  const now = useNow(1000);
  const earthquakes = useTerraScope((s) => s.earthquakes.data);
  const events = useTerraScope((s) => s.naturalEvents.data);
  const weatherState = useTerraScope((s) => s.weather);

  if (selection?.kind !== 'place') return null;
  const place = selection.item;

  /**
   * Nearby events, computed client-side from the already-loaded layers so a
   * selection costs no extra provider requests.
   */
  const nearby = useMemo(() => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const distanceKm = (lat: number, lon: number) => {
      const dLat = toRad(lat - place.lat);
      const dLon = toRad(lon - place.lon);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(place.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
    };

    const quakes = earthquakes
      .map((quake) => ({ quake, km: distanceKm(quake.lat, quake.lon) }))
      .filter((entry) => entry.km <= 1500)
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);

    const naturalEvents = events
      .map((event) => ({ event, km: distanceKm(event.lat, event.lon) }))
      .filter((entry) => entry.km <= 1500)
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);

    return { quakes, naturalEvents };
  }, [earthquakes, events, place.lat, place.lon]);

  const select = useTerraScope((s) => s.select);
  const requestFlyTo = useTerraScope((s) => s.requestFlyTo);

  return (
    <div className="space-y-3.5">
      <PanelHeader
        icon={<Satellite size={13} aria-hidden="true" />}
        accent="#4cc9f0"
        eyebrow={place.kind === 'coordinate' ? 'Pinned coordinate' : titleCase(place.kind)}
        title={place.name}
        badge={
          <span className="chip !px-2 !py-0.5">
            {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
          </span>
        }
      />

      <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-2xs leading-relaxed text-ink-muted">
        {place.label}
      </p>

      <section>
        <h3 className="section-label mb-1.5">Conditions</h3>
        <WeatherPanel onRetry={retries.weather} />
      </section>

      {nearby.quakes.length > 0 && (
        <section>
          <h3 className="section-label mb-1.5">Nearby seismic events</h3>
          <ul className="space-y-1">
            {nearby.quakes.map(({ quake, km }) => (
              <li key={quake.id}>
                <button
                  type="button"
                  onClick={() => {
                    select({ kind: 'earthquake', item: quake });
                    requestFlyTo(quake.lat, quake.lon, 1.5);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-layer-seismic/30"
                >
                  <span className="mono shrink-0 rounded bg-layer-seismic/15 px-1.5 py-0.5 text-2xs font-semibold text-layer-seismic">
                    M{quake.magnitude.toFixed(1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">{quake.place}</span>
                  <span className="mono shrink-0 text-2xs text-ink-faint">{Math.round(km)} km</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearby.naturalEvents.length > 0 && (
        <section>
          <h3 className="section-label mb-1.5">Nearby natural events</h3>
          <ul className="space-y-1">
            {nearby.naturalEvents.map(({ event, km }) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => {
                    select({ kind: 'naturalEvent', item: event });
                    requestFlyTo(event.lat, event.lon, 1.7);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-layer-storm/30"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[event.categories[0] ?? 'other'] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">{event.title}</span>
                  <span className="mono shrink-0 text-2xs text-ink-faint">{Math.round(km)} km</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nearby.quakes.length === 0 && nearby.naturalEvents.length === 0 && (
        <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-2xs leading-relaxed text-ink-faint">
          No recorded seismic or natural events within 1,500 km in the current 24-hour and 14-day windows.
        </p>
      )}

      <SourceFooter
        label="Place names: Nominatim / OpenStreetMap · Weather: Open-Meteo"
        url="https://www.openstreetmap.org/copyright"
        freshness={
          <DataFreshness
            observedAt={weatherState.meta?.observedAt ?? null}
            updatedAt={weatherState.meta?.updatedAt ?? null}
            cadence={weatherState.meta?.cadence ?? 'periodic'}
            stale={weatherState.meta?.stale ?? false}
            loading={weatherState.status === 'loading'}
            now={now}
          />
        }
        onRetry={retries.weather}
      />
    </div>
  );
}

/* ──────────────────────────────── Shared ────────────────────────────────── */

function PanelHeader({
  icon,
  accent,
  eyebrow,
  title,
  badge,
}: {
  icon: React.ReactNode;
  accent: string;
  eyebrow: string;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <header className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
        style={{ borderColor: `${accent}40`, backgroundColor: `${accent}14`, color: accent }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="section-label">{eyebrow}</p>
        <h2 className="mt-0.5 text-balance text-sm font-semibold leading-snug tracking-tight text-ink">{title}</h2>
        {badge && <div className="mt-1.5">{badge}</div>}
      </div>
    </header>
  );
}

interface Field {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}

function FieldGrid({ fields }: { fields: Field[] }) {
  return (
    <dl className="grid grid-cols-2 gap-1.5">
      {fields.map((field) => (
        <div
          key={`${field.label}-${field.value}`}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
        >
          <dt className="flex items-center gap-1.5 text-2xs text-ink-faint">
            <span aria-hidden="true">{field.icon}</span>
            <span className="truncate">{field.label}</span>
          </dt>
          <dd className={`mt-1 truncate text-xs font-medium text-ink ${field.mono ? 'mono' : ''}`} title={field.value}>
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SourceFooter({
  label,
  url,
  freshness,
  onRetry,
  note,
}: {
  label: string;
  url: string;
  freshness: React.ReactNode;
  onRetry?: () => void;
  note?: string | null;
}) {
  return (
    <footer className="space-y-2 border-t border-white/[0.06] pt-2.5">
      {freshness}
      {note && <p className="text-2xs leading-relaxed text-ink-faint">{note}</p>}
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 flex-1 truncate text-2xs text-ink-faint underline decoration-dotted underline-offset-2 transition hover:text-ink-muted"
        >
          {label}
        </a>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-2xs text-ink-faint transition hover:text-ink-muted"
          >
            Refresh
          </button>
        )}
      </div>
    </footer>
  );
}

export { ErrorState };
