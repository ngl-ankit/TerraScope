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

const OUTBOUND_USER_AGENT = 'TerraScope/1.0 (+https://github.com/ngl-ankit/TerraScope)';

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


/* ─────────────────────── MET Norway fallback provider ───────────────────────
 * Open-Meteo throttles by client IP, so a shared datacenter egress can be
 * rate-limited through no fault of this deployment (observed: persistent HTTP
 * 429 from the Render free instance while the same call answered 200 from
 * elsewhere). MET Norway publishes the same public forecast, needs no key, and
 * is not IP-throttled, so a throttled primary degrades to a working forecast
 * instead of an error the user cannot act on.
 *
 * Docs: https://api.met.no/weatherapi/locationforecast/2.0/documentation
 */

const MET_BASE_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

interface MetEntry {
  time?: string;
  data?: {
    instant?: { details?: Record<string, number | null | undefined> };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
  };
}

interface MetResponse {
  properties?: { timeseries?: MetEntry[] };
}

/** MET publishes `symbol_code`, not a WMO number; map back onto the WMO table. */
const MET_SYMBOL_WMO: Record<string, number> = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,
  lightrain: 61,
  lightrainshowers: 61,
  rain: 63,
  rainshowers: 63,
  heavyrain: 65,
  heavyrainshowers: 65,
  lightrainandthunder: 95,
  rainandthunder: 95,
  heavyrainandthunder: 95,
  lightrainshowersandthunder: 95,
  rainshowersandthunder: 95,
  heavyrainshowersandthunder: 95,
  thunderstorm: 95,
  lightsleet: 66,
  sleet: 67,
  heavysleet: 67,
  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  lightsnowshowers: 85,
  snowshowers: 85,
  heavysnowshowers: 86,
  lightsleetandthunder: 95,
  sleetandthunder: 95,
  lightsnowandthunder: 95,
  snowandthunder: 95,
  partlycloudyandrain: 80,
  partlycloudyandlightrain: 80,
  partlycloudyandsnow: 85,
};

function metSymbolToWmo(symbol: string | undefined): number | null {
  if (!symbol) return null;
  return MET_SYMBOL_WMO[symbol.replace(/_(day|night|polartwilight)$/, '')] ?? null;
}

function metNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** MET emits `2026-09-22T15:00:00Z`; Open-Meteo emits `2026-09-22T15:00`. */
function metTime(iso: string | undefined): string | null {
  return typeof iso === 'string' && iso.length >= 16 ? iso.slice(0, 16) : null;
}

function msToKmh(ms: number | null): number | null {
  return ms === null ? null : Math.round(ms * 3.6 * 10) / 10;
}

export function normaliseMetWeather(raw: MetResponse, lat: number, lon: number): WeatherBundle {
  const series = raw.properties?.timeseries ?? [];
  const first = series[0];
  const inst = first?.data?.instant?.details ?? {};
  const symbol =
    first?.data?.next_1_hours?.summary?.symbol_code ?? first?.data?.next_6_hours?.summary?.symbol_code;
  const code = metSymbolToWmo(symbol);

  const current: WeatherCurrent = {
    time: metTime(first?.time) ?? new Date().toISOString().slice(0, 16),
    temperatureC: metNum(inst.air_temperature),
    apparentC: null,
    humidityPct: metNum(inst.relative_humidity),
    precipitationMm: metNum(first?.data?.next_1_hours?.details?.precipitation_amount),
    weatherCode: code,
    condition: weatherCondition(code),
    windSpeedKmh: msToKmh(metNum(inst.wind_speed)),
    windGustKmh: null,
    windDirectionDeg: metNum(inst.wind_from_direction),
    pressureHpa: metNum(inst.air_pressure_at_sea_level),
    cloudCoverPct: metNum(inst.cloud_area_fraction),
    isDay: symbol ? !symbol.includes('_night') : null,
  };

  const hourly: WeatherHour[] = [];
  for (let i = 0; i < Math.min(series.length, 24); i += 1) {
    const entry = series[i];
    const time = metTime(entry?.time);
    if (!time) continue;
    const details = entry?.data?.instant?.details ?? {};
    hourly.push({
      time,
      temperatureC: metNum(details.air_temperature),
      weatherCode: metSymbolToWmo(
        entry?.data?.next_1_hours?.summary?.symbol_code ??
          entry?.data?.next_6_hours?.summary?.symbol_code,
      ),
      precipitationProbabilityPct: null,
      windSpeedKmh: msToKmh(metNum(details.wind_speed)),
    });
  }

  // MET returns ~one entry per hour; roll them up into calendar days.
  const days = new Map<string, { min: number | null; max: number | null; precip: number; codes: number[] }>();
  for (const entry of series) {
    const iso = entry?.time;
    if (!iso) continue;
    const day = iso.slice(0, 10);
    const bucket = days.get(day) ?? { min: null, max: null, precip: 0, codes: [] };
    const temp = metNum(entry?.data?.instant?.details?.air_temperature);
    if (temp !== null) {
      bucket.min = bucket.min === null ? temp : Math.min(bucket.min, temp);
      bucket.max = bucket.max === null ? temp : Math.max(bucket.max, temp);
    }
    const amount = metNum(entry?.data?.next_1_hours?.details?.precipitation_amount);
    if (amount !== null) bucket.precip += amount;
    const dayCode = metSymbolToWmo(
      entry?.data?.next_6_hours?.summary?.symbol_code ??
        entry?.data?.next_1_hours?.summary?.symbol_code,
    );
    if (dayCode !== null) bucket.codes.push(dayCode);
    days.set(day, bucket);
  }

  const daily: WeatherDay[] = [...days.entries()].slice(0, 6).map(([date, bucket]) => {
    const dayCode = bucket.codes.length > 0 ? bucket.codes[Math.floor(bucket.codes.length / 2)] : null;
    return {
      date,
      weatherCode: dayCode,
      condition: weatherCondition(dayCode),
      maxC: bucket.max,
      minC: bucket.min,
      precipitationMm: Math.round(bucket.precip * 10) / 10,
      // MET's compact document carries no sunrise/sunset.
      sunrise: null,
      sunset: null,
    };
  });

  return {
    lat,
    lon,
    elevationM: null,
    // MET timestamps are UTC; labelled as such rather than guessed from longitude.
    timezone: 'UTC',
    timezoneAbbreviation: 'UTC',
    current,
    hourly,
    daily,
  };
}

export async function fetchWeatherFromMet(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherBundle> {
  const raw = await fetchJson<MetResponse>(
    `${MET_BASE_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
    { provider: 'MET Norway', headers: { 'User-Agent': OUTBOUND_USER_AGENT }, timeoutMs: 12_000, signal },
  );
  return normaliseMetWeather(raw, lat, lon);
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

  try {
    const raw = await fetchJson<OpenMeteoResponse>(`${forecastBaseUrl()}?${params.toString()}`, {
      provider: 'Open-Meteo',
      headers: { 'User-Agent': OUTBOUND_USER_AGENT },
      timeoutMs: 12_000,
      // One retry absorbs a dropped connection; a 429 is not retried (see http.ts).
      retries: 1,
      signal,
    });
    return normaliseWeather(raw, lat, lon);
  } catch (error) {
    if (signal?.aborted) throw error;
    try {
      return await fetchWeatherFromMet(lat, lon, signal);
    } catch {
      // Both providers down: surface the primary provider's error.
      throw error;
    }
  }
}
