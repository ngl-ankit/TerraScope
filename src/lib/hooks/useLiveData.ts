'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, describeApiError } from '@/lib/client/http';
import { usePolling } from '@/lib/hooks/usePolling';
import { useTerraScope } from '@/lib/store/useTerraScope';
import type { AirQualitySample, Earthquake, FlightsSnapshot, NaturalEvent, WeatherBundle } from '@/lib/types';

/**
 * Owns every polling loop in the application.
 *
 * Mounted once (in `AppShell`). Each provider has its own interval, its own
 * error channel and its own abort controller, so a failing API degrades exactly
 * one layer. Nothing here throws into React: failures land in the store and are
 * rendered by the layer-specific error states.
 *
 * Intervals are tuned to each provider's documented behaviour rather than a
 * single global tick:
 *   USGS        60s   (the summary feed regenerates every minute)
 *   EONET       300s  (events are curated, not streamed)
 *   OpenSky     15s   (live state vectors, but bounded by anonymous rate limits)
 *   Air Quality 900s  (hourly model output sampled at 32 cities)
 *   Weather     600s  (for the selected coordinate only)
 */

const INTERVALS = {
  earthquakes: 60_000,
  naturalEvents: 300_000,
  flights: 15_000,
  airQuality: 900_000,
  weather: 600_000,
} as const;

function useEarthquakesLoop(enabled: boolean) {
  const setEarthquakes = useTerraScope((s) => s.setEarthquakes);
  const setLayerError = useTerraScope((s) => s.setLayerError);
  const setRetrying = useTerraScope((s) => s.setRetrying);
  const setBootStep = useTerraScope((s) => s.setBootStep);

  const run = useMemo(
    () => async (signal: AbortSignal) => {
      try {
        const envelope = await apiGet<{ earthquakes: Earthquake[]; feedTitle: string }>('/api/earthquakes', {
          signal,
          timeoutMs: 18_000,
        });
        setEarthquakes(envelope.data.earthquakes, envelope.meta);
        setBootStep('earthquakes', 'done');
      } catch (error) {
        if (signal.aborted) return;
        setLayerError('earthquakes', describeApiError(error, 'USGS'));
        setBootStep('earthquakes', 'done');
      }
    },
    [setBootStep, setEarthquakes, setLayerError],
  );

  const { refresh } = usePolling({ enabled, intervalMs: INTERVALS.earthquakes, run });

  return () => {
    setRetrying('earthquakes', true);
    refresh();
  };
}

function useNaturalEventsLoop(enabled: boolean) {
  const setNaturalEvents = useTerraScope((s) => s.setNaturalEvents);
  const setLayerError = useTerraScope((s) => s.setLayerError);
  const setRetrying = useTerraScope((s) => s.setRetrying);
  const setBootStep = useTerraScope((s) => s.setBootStep);

  const run = useMemo(
    () => async (signal: AbortSignal) => {
      try {
        const envelope = await apiGet<NaturalEvent[]>('/api/natural-events', { signal, timeoutMs: 24_000 });
        setNaturalEvents(envelope.data, envelope.meta);
        setBootStep('naturalEvents', 'done');
      } catch (error) {
        if (signal.aborted) return;
        setLayerError('naturalEvents', describeApiError(error, 'NASA EONET'));
        setBootStep('naturalEvents', 'done');
      }
    },
    [setBootStep, setLayerError, setNaturalEvents],
  );

  const { refresh } = usePolling({ enabled, intervalMs: INTERVALS.naturalEvents, run });

  return () => {
    setRetrying('naturalEvents', true);
    refresh();
  };
}

function useFlightsLoop(enabled: boolean) {
  const setFlights = useTerraScope((s) => s.setFlights);
  const setLayerError = useTerraScope((s) => s.setLayerError);
  const setRetrying = useTerraScope((s) => s.setRetrying);
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0);

  const run = useMemo(
    () => async (signal: AbortSignal) => {
      if (Date.now() < rateLimitedUntil) return;
      try {
        const envelope = await apiGet<FlightsSnapshot>('/api/flights', { signal, timeoutMs: 22_000 });
        setFlights(envelope.data, envelope.meta);
      } catch (error) {
        if (signal.aborted) return;
        const message = describeApiError(error, 'OpenSky Network');
        setLayerError('flights', message);
        // Back the layer off for two minutes when the provider says 429 rather
        // than retrying every 15 seconds and deepening the rate-limit hole.
        if (typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 429) {
          setRateLimitedUntil(Date.now() + 120_000);
        }
      }
    },
    [rateLimitedUntil, setFlights, setLayerError],
  );

  const { refresh } = usePolling({ enabled, intervalMs: INTERVALS.flights, run });

  return () => {
    setRetrying('flights', true);
    setRateLimitedUntil(0);
    refresh();
  };
}

function useAirQualityLoop(enabled: boolean) {
  const setAirQuality = useTerraScope((s) => s.setAirQuality);
  const setLayerError = useTerraScope((s) => s.setLayerError);
  const setRetrying = useTerraScope((s) => s.setRetrying);

  const run = useMemo(
    () => async (signal: AbortSignal) => {
      try {
        const envelope = await apiGet<AirQualitySample[]>('/api/air-quality', { signal, timeoutMs: 24_000 });
        setAirQuality(envelope.data, envelope.meta);
      } catch (error) {
        if (signal.aborted) return;
        setLayerError('airQuality', describeApiError(error, 'Open-Meteo Air Quality'));
      }
    },
    [setAirQuality, setLayerError],
  );

  const { refresh } = usePolling({ enabled, intervalMs: INTERVALS.airQuality, run });

  return () => {
    setRetrying('airQuality', true);
    refresh();
  };
}

/** Weather is only ever fetched for a coordinate the user chose. */
function useWeatherLoop(lat: number | null, lon: number | null, enabled: boolean) {
  const setWeather = useTerraScope((s) => s.setWeather);
  const setLayerError = useTerraScope((s) => s.setLayerError);
  const setRetrying = useTerraScope((s) => s.setRetrying);
  // Open-Meteo limits per IP and the server now caches per coordinate, so a 429
  // arriving here means the edge refused us. Back the loop off for two minutes
  // instead of retrying on the normal cadence and deepening the hole.
  const [rateLimitedUntil, setRateLimitedUntil] = useState(0);

  const run = useMemo(
    () => async (signal: AbortSignal) => {
      if (Date.now() < rateLimitedUntil) return;
      if (lat === null || lon === null) return;
      try {
        const envelope = await apiGet<WeatherBundle>(
          `/api/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
          { signal, timeoutMs: 18_000 },
        );
        setWeather(envelope.data, envelope.meta);
      } catch (error) {
        if (signal.aborted) return;
        setLayerError('weather', describeApiError(error, 'Open-Meteo'));
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          (error as { status: number }).status === 429
        ) {
          setRateLimitedUntil(Date.now() + 120_000);
        }
      }
    },
    [lat, lon, rateLimitedUntil, setLayerError, setWeather],
  );

  const active = enabled && lat !== null && lon !== null;
  const { refresh } = usePolling({ enabled: active, intervalMs: INTERVALS.weather, run });

  return () => {
    setRetrying('weather', true);
    setRateLimitedUntil(0);
    refresh();
  };
}

export interface LiveDataControls {
  retryEarthquakes: () => void;
  retryNaturalEvents: () => void;
  retryFlights: () => void;
  retryAirQuality: () => void;
  retryWeather: () => void;
}

/**
 * Starts every loop that has its layer enabled.
 * Returns per-layer retry callbacks for the error states.
 */
export function useLiveData(): LiveDataControls {
  const layers = useTerraScope((s) => s.layers);
  const focusedPlace = useTerraScope((s) => s.focusedPlace);

  // The weather layer is useful whenever a location is selected, independently
  // of the (cosmetic) weather toggle — selection always fetches conditions.
  const weatherEnabled = Boolean(focusedPlace) || layers.weather;

  const retryEarthquakes = useEarthquakesLoop(layers.earthquakes);
  const retryNaturalEvents = useNaturalEventsLoop(layers.naturalEvents);
  const retryFlights = useFlightsLoop(layers.flights);
  const retryAirQuality = useAirQualityLoop(layers.airQuality);
  const retryWeather = useWeatherLoop(
    focusedPlace?.lat ?? null,
    focusedPlace?.lon ?? null,
    weatherEnabled,
  );

  // A layer that has just been switched off should not keep its error badge.
  useEffect(() => {
    const { setLayerLoading } = useTerraScope.getState();
    if (layers.earthquakes) setLayerLoading('earthquakes');
    if (layers.naturalEvents) setLayerLoading('naturalEvents');
    if (layers.flights) setLayerLoading('flights');
    if (layers.airQuality) setLayerLoading('airQuality');
  }, [layers.airQuality, layers.earthquakes, layers.flights, layers.naturalEvents]);

  return {
    retryEarthquakes,
    retryNaturalEvents,
    retryFlights,
    retryAirQuality,
    retryWeather,
  };
}
