import { fetchJson } from './http';
import { sanitizeText } from '@/lib/utils/format';
import type { WeatherBundle, WeatherCurrent, WeatherDay, WeatherHour } from '@/lib/types';

/**
 * Open-Meteo forecast API.
 *
 * TerraScope never claims to show global weather: a forecast is only requested
 * for a coordinate the user explicitly selected. `timezone=auto` makes the
 * daily forecast align with local sunrise/sunset rather than the server's zone.
 *
 * Docs: https://open-meteo.com/en/docs
 */

export function forecastBaseUrl(): string {
  return process.env.OPEN_METEO_FORECAST_URL ?? 'https://api.open-meteo.com/v1/forecast';
}

/** WMO 4677 weather-code interpretation, as published by Open-Meteo. */
export const WMO_CONDITIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export function weatherCondition(code: number | null): string {
  if (code === null || !Number.isFinite(code)) return 'Unavailable';
  return WMO_CONDITIONS[code] ?? `WMO code ${code}`;
}

/** Which Lucide icon family a code maps to, kept separate from the label. */
export function weatherKind(code: number | null): 'clear' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' | 'unknown' {
  if (code === null || !Number.isFinite(code)) return 'unknown';
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'unknown';
}

interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  current?: Record<string, number | string | null>;
  hourly?: Record<string, Array<number | string | null>>;
  daily?: Record<string, Array<number | string | null>>;
}

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'surface_pressure',
  'cloud_cover',
  'is_day',
].join(',');

const HOURLY_FIELDS = [
  'temperature_2m',
  'weather_code',
  'precipitation_probability',
  'wind_speed_10m',
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'sunrise',
  'sunset',
].join(',');

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function normaliseWeather(raw: OpenMeteoResponse, fallbackLat: number, fallbackLon: number): WeatherBundle {
  const currentRaw = raw.current ?? {};
  const code = num(currentRaw.weather_code);

  const current: WeatherCurrent = {
    time: str(currentRaw.time) ?? new Date().toISOString(),
    temperatureC: num(currentRaw.temperature_2m),
    apparentC: num(currentRaw.apparent_temperature),
    humidityPct: num(currentRaw.relative_humidity_2m),
    precipitationMm: num(currentRaw.precipitation),
    weatherCode: code,
    condition: weatherCondition(code),
    windSpeedKmh: num(currentRaw.wind_speed_10m),
    windGustKmh: num(currentRaw.wind_gusts_10m),
    windDirectionDeg: num(currentRaw.wind_direction_10m),
    pressureHpa: num(currentRaw.surface_pressure),
    cloudCoverPct: num(currentRaw.cloud_cover),
    isDay: num(currentRaw.is_day) === null ? null : num(currentRaw.is_day) === 1,
  };

  const hourlyTimes = raw.hourly?.time ?? [];
  const hourly: WeatherHour[] = [];
  const startIndex = Math.max(
    0,
    hourlyTimes.findIndex((t) => typeof t === 'string' && t >= current.time.slice(0, 13)),
  );
  for (let i = startIndex; i < Math.min(startIndex + 24, hourlyTimes.length); i += 1) {
    const time = str(hourlyTimes[i]);
    if (!time) continue;
    hourly.push({
      time,
      temperatureC: num(raw.hourly?.temperature_2m?.[i]),
      weatherCode: num(raw.hourly?.weather_code?.[i]),
      precipitationProbabilityPct: num(raw.hourly?.precipitation_probability?.[i]),
      windSpeedKmh: num(raw.hourly?.wind_speed_10m?.[i]),
    });
  }

  const dailyTimes = raw.daily?.time ?? [];
  const daily: WeatherDay[] = [];
  for (let i = 0; i < Math.min(dailyTimes.length, 6); i += 1) {
    const date = str(dailyTimes[i]);
    if (!date) continue;
    const dayCode = num(raw.daily?.weather_code?.[i]);
    daily.push({
      date,
      weatherCode: dayCode,
      condition: weatherCondition(dayCode),
      maxC: num(raw.daily?.temperature_2m_max?.[i]),
      minC: num(raw.daily?.temperature_2m_min?.[i]),
      precipitationMm: num(raw.daily?.precipitation_sum?.[i]),
      sunrise: str(raw.daily?.sunrise?.[i]),
      sunset: str(raw.daily?.sunset?.[i]),
    });
  }

  return {
    lat: num(raw.latitude) ?? fallbackLat,
    lon: num(raw.longitude) ?? fallbackLon,
    elevationM: num(raw.elevation),
    timezone: sanitizeText(raw.timezone, 48) || 'UTC',
    timezoneAbbreviation: sanitizeText(raw.timezone_abbreviation, 12) || 'UTC',
    current,
    hourly,
    daily,
  };
}

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherBundle> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: CURRENT_FIELDS,
    hourly: HOURLY_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    forecast_days: '6',
    wind_speed_unit: 'kmh',
  });

  const raw = await fetchJson<OpenMeteoResponse>(`${forecastBaseUrl()}?${params.toString()}`, {
    provider: 'Open-Meteo',
    timeoutMs: 12_000,
    signal,
  });

  return normaliseWeather(raw, lat, lon);
}
