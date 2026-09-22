import type { LayerDescriptor } from '@/lib/types';

/**
 * Single source of truth for data provenance.
 *
 * These labels are rendered in the layer panel, the details panel and the
 * sources dialog. Nothing here is invented: each `sourceUrl` is the provider's
 * canonical documentation or landing page, and each `cadenceNote` describes the
 * polling interval TerraScope actually applies.
 */
export const LAYERS: LayerDescriptor[] = [
  {
    id: 'earthquakes',
    label: 'Earthquakes',
    shortLabel: 'Seismic',
    description: 'Seismic events of magnitude 2.5 and above recorded in the last 24 hours.',
    source: 'USGS Earthquake Hazards Program',
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
    color: '#ff8a4c',
    cadenceNote: 'Polled every 60 seconds',
  },
  {
    id: 'naturalEvents',
    label: 'Natural Events',
    shortLabel: 'Events',
    description: 'Open wildfires, volcanic activity, severe storms and other tracked natural events.',
    source: 'NASA EONET v3',
    sourceUrl: 'https://eonet.gsfc.nasa.gov/',
    color: '#8b9dff',
    cadenceNote: 'Polled every 5 minutes',
  },
  {
    id: 'weather',
    label: 'Weather',
    shortLabel: 'Weather',
    description: 'Current conditions and a five-day outlook for the selected location.',
    source: 'Open-Meteo',
    sourceUrl: 'https://open-meteo.com/',
    color: '#4cc9f0',
    cadenceNote: 'Refreshed on selection, then every 10 minutes',
    requiresLocation: true,
  },
  {
    id: 'flights',
    label: 'Flights',
    shortLabel: 'Flights',
    description: 'Live aircraft positions from the OpenSky Network crowdsourced ADS-B feed.',
    source: 'OpenSky Network',
    sourceUrl: 'https://opensky-network.org/',
    color: '#7ee787',
    cadenceNote: 'Polled every 15 seconds, subject to provider rate limits',
  },
  {
    id: 'airQuality',
    label: 'Air Quality',
    shortLabel: 'Air',
    description: 'European AQI sampled at 32 major urban centres, updated hourly by the model.',
    source: 'Open-Meteo Air Quality',
    sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
    color: '#c084fc',
    cadenceNote: 'Polled every 15 minutes',
  },
];

export const LAYER_MAP: Record<string, LayerDescriptor> = Object.fromEntries(
  LAYERS.map((layer) => [layer.id, layer]),
);

/** The globe legend shown under the layer controls. */
export const EARTHQUAKE_MAGNITUDE_BANDS = [
  { label: 'M 2.5 – 3.9', scale: 0.0055, color: '#ffb27a' },
  { label: 'M 4.0 – 4.9', scale: 0.0085, color: '#ff8a4c' },
  { label: 'M 5.0 – 5.9', scale: 0.0125, color: '#ff6b2c' },
  { label: 'M 6.0 +', scale: 0.0185, color: '#ff3d2e' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  wildfires: '#ff6b3d',
  volcanoes: '#ff5d73',
  severeStorms: '#8b9dff',
  seaLakeIce: '#9fd8ff',
  drought: '#e0b980',
  dustHaze: '#d8c9a3',
  floods: '#4cc9f0',
  landslides: '#c08457',
  manmade: '#9aa5b8',
  snow: '#dbeafe',
  temperatureExtremes: '#ff8a4c',
  waterColor: '#4ad6b0',
  earthquakes: '#ff8a4c',
  other: '#93a3bd',
};

/** European AQI bands, per the Copernicus/EAQI definition. */
export function aqiCategory(value: number | null): { label: string; color: string } {
  if (value === null || !Number.isFinite(value)) return { label: 'No data', color: '#5d6b85' };
  if (value <= 20) return { label: 'Good', color: '#7ee787' };
  if (value <= 40) return { label: 'Fair', color: '#d7e57a' };
  if (value <= 60) return { label: 'Moderate', color: '#ffd166' };
  if (value <= 80) return { label: 'Poor', color: '#ff8a4c' };
  if (value <= 100) return { label: 'Very poor', color: '#ff5d73' };
  return { label: 'Extremely poor', color: '#c084fc' };
}

/** Attribution rows for the sources dialog. */
export const DATA_SOURCES = [
  {
    name: 'USGS Earthquake Hazards Program',
    url: 'https://earthquake.usgs.gov/',
    detail: 'Real-time GeoJSON summary feeds of global seismicity, updated within minutes of an event.',
  },
  {
    name: 'NASA EONET v3',
    url: 'https://eonet.gsfc.nasa.gov/',
    detail: 'Earth Observatory Natural Event Tracker — open natural events curated from NASA and partner sources.',
  },
  {
    name: 'Open-Meteo',
    url: 'https://open-meteo.com/',
    detail: 'Open forecast API and air-quality API built on national weather-service models. No API key required.',
  },
  {
    name: 'OpenSky Network',
    url: 'https://opensky-network.org/',
    detail: 'Crowdsourced ADS-B aircraft state vectors. Anonymous access is rate limited; credentials raise the quota.',
  },
  {
    name: 'Nominatim / OpenStreetMap',
    url: 'https://nominatim.openstreetmap.org/',
    detail: 'Geocoding and reverse geocoding over OpenStreetMap data, used for the location search.',
  },
  {
    name: 'Natural Earth',
    url: 'https://www.naturalearthdata.com/',
    detail: 'Public-domain 1:110m country boundaries, packaged for the globe as GeoJSON.',
  },
];
