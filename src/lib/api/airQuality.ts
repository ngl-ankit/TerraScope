import { fetchJson } from './http';
import { sanitizeText } from '@/lib/utils/format';
import { aqiCategory } from './sources';
import type { AirQualitySample } from '@/lib/types';

/**
 * Open-Meteo Air Quality API.
 *
 * The endpoint answers for a single coordinate, so a genuinely global layer
 * would need thousands of calls. Instead TerraScope samples a fixed set of 32
 * major urban centres and renders one marker per city — honest about what it
 * is (city sampling, hourly model output) rather than implying a global field.
 *
 * Docs: https://open-meteo.com/en/docs/air-quality-api
 */

export function airQualityBaseUrl(): string {
  return process.env.OPEN_METEO_AIR_QUALITY_URL ?? 'https://air-quality-api.open-meteo.com/v1/air-quality';
}

interface SampleCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/** Fixed, documented sample grid. Coordinates are city reference points. */
export const SAMPLE_CITIES: SampleCity[] = [
  { name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { name: 'Lahore', country: 'Pakistan', lat: 31.5204, lon: 74.3587 },
  { name: 'Beijing', country: 'China', lat: 39.9042, lon: 116.4074 },
  { name: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737 },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978 },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 },
  { name: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.8607, lon: 67.0011 },
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lon: 90.4125 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Dubai', country: 'UAE', lat: 25.2048, lon: 55.2708 },
  { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lon: 46.6753 },
  { name: 'Istanbul', country: 'Türkiye', lat: 41.0082, lon: 28.9784 },
  { name: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  { name: 'Warsaw', country: 'Poland', lat: 52.2297, lon: 21.0122 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219 },
  { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lon: 28.0473 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333 },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { name: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332 },
  { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', country: 'United States', lat: 34.0522, lon: -118.2437 },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
];

interface AqResponse {
  latitude?: number;
  longitude?: number;
  current?: Record<string, number | string | null>;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildUrl(cities: SampleCity[]): string {
  const params = new URLSearchParams({
    latitude: cities.map((c) => c.lat.toFixed(3)).join(','),
    longitude: cities.map((c) => c.lon.toFixed(3)).join(','),
    current: 'european_aqi,us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone',
    timezone: 'UTC',
  });
  return `${airQualityBaseUrl()}?${params.toString()}`;
}

/**
 * Open-Meteo answers a multi-coordinate request with an array (and a bare
 * object when only one coordinate was asked for), so both shapes are handled.
 */
export function normaliseAirQuality(payload: AqResponse | AqResponse[]): AirQualitySample[] {
  const list = Array.isArray(payload) ? payload : [payload];
  const samples: AirQualitySample[] = [];

  list.forEach((entry, index) => {
    const city = SAMPLE_CITIES[index];
    if (!city) return;

    const current = entry?.current ?? {};
    const europeanAqi = num(current.european_aqi);
    const observedAt = typeof current.time === 'string' ? current.time : null;

    samples.push({
      name: city.name,
      country: city.country,
      lat: num(entry?.latitude) ?? city.lat,
      lon: num(entry?.longitude) ?? city.lon,
      europeanAqi,
      usAqi: num(current.us_aqi),
      pm25: num(current.pm2_5),
      pm10: num(current.pm10),
      no2: num(current.nitrogen_dioxide),
      ozone: num(current.ozone),
      category: aqiCategory(europeanAqi).label,
      observedAt: observedAt ? sanitizeText(observedAt, 20) : null,
    });
  });

  return samples;
}

export async function fetchAirQuality(signal?: AbortSignal): Promise<{ samples: AirQualitySample[]; observedAt: number | null }> {
  const payload = await fetchJson<AqResponse | AqResponse[]>(buildUrl(SAMPLE_CITIES), {
    provider: 'Open-Meteo Air Quality',
    timeoutMs: 18_000,
    signal,
  });

  const samples = normaliseAirQuality(payload);
  const observedTimes = samples
    .map((s) => (s.observedAt ? new Date(s.observedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  const observedAt = observedTimes.length > 0 ? Math.max(...observedTimes) : null;

  return { samples, observedAt };
}
