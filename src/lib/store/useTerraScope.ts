'use client';

import { create } from 'zustand';
import type {
  Aircraft,
  AirQualitySample,
  DataState,
  Earthquake,
  FlightsSnapshot,
  GeoPlace,
  LayerId,
  NaturalEvent,
  Selection,
  SourceMeta,
  WeatherBundle,
} from '@/lib/types';
import type { QualityTier } from '@/lib/hooks/useDeviceProfile';

/**
 * TerraScope application state.
 *
 * Deliberately split into small slices and consumed with narrow selectors so a
 * 60-second earthquake refresh does not re-render the control cluster, and a
 * camera fly-to does not re-render the event list.
 */

export interface LayerDataState<T> extends DataState<T> {
  /** When the last *successful* sync happened (ms epoch). */
  lastSuccessAt: number | null;
  /** True while a manual retry is in flight. */
  retrying: boolean;
}

const emptyState = <T,>(initial: T): LayerDataState<T> => ({
  status: 'idle',
  data: initial,
  error: null,
  meta: null,
  lastSuccessAt: null,
  retrying: false,
});

export interface FlyToRequest {
  lat: number;
  lon: number;
  /** Camera distance from the globe centre, in globe radii. */
  distance?: number;
  /** Bumped on every request so repeated fly-tos to the same point re-trigger. */
  nonce: number;
}

export interface ZoomRequest {
  direction: 'in' | 'out';
  nonce: number;
}

export type BootStepId = 'renderer' | 'textures' | 'borders' | 'earthquakes' | 'naturalEvents';

export interface BootStep {
  id: BootStepId;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  /** 0..1, only meaningful for the texture step. */
  progress?: number;
}

interface TerraScopeState {
  /* ── layers ─────────────────────────────────────────────────────────── */
  layers: Record<LayerId, boolean>;
  toggleLayer: (id: LayerId) => void;
  setLayer: (id: LayerId, enabled: boolean) => void;

  /* ── layer data ─────────────────────────────────────────────────────── */
  earthquakes: LayerDataState<Earthquake[]>;
  naturalEvents: LayerDataState<NaturalEvent[]>;
  flights: LayerDataState<FlightsSnapshot>;
  airQuality: LayerDataState<AirQualitySample[]>;
  weather: LayerDataState<WeatherBundle | null>;

  setEarthquakes: (data: Earthquake[], meta: SourceMeta) => void;
  setNaturalEvents: (data: NaturalEvent[], meta: SourceMeta) => void;
  setFlights: (data: FlightsSnapshot, meta: SourceMeta) => void;
  setAirQuality: (data: AirQualitySample[], meta: SourceMeta) => void;
  setWeather: (data: WeatherBundle | null, meta: SourceMeta | null) => void;

  setLayerError: (layer: Exclude<LayerId, 'weather'> | 'weather', message: string) => void;
  setLayerLoading: (layer: LayerId) => void;
  setRetrying: (layer: LayerId, retrying: boolean) => void;

  /* ── selection & camera ─────────────────────────────────────────────── */
  selection: Selection | null;
  hoveredId: string | null;
  focusedPlace: GeoPlace | null;
  flyTo: FlyToRequest | null;
  zoom: ZoomRequest | null;
  autoRotate: boolean;

  select: (selection: Selection | null) => void;
  setHovered: (id: string | null) => void;
  focusPlace: (place: GeoPlace) => void;
  requestFlyTo: (lat: number, lon: number, distance?: number) => void;
  requestZoom: (direction: 'in' | 'out') => void;
  resetView: () => void;
  toggleAutoRotate: () => void;
  setAutoRotate: (value: boolean) => void;

  /* ── ui ─────────────────────────────────────────────────────────────── */
  layerPanelOpen: boolean;
  sourcesOpen: boolean;
  detailsOpen: boolean;
  setLayerPanelOpen: (open: boolean) => void;
  setSourcesOpen: (open: boolean) => void;
  setDetailsOpen: (open: boolean) => void;

  qualityOverride: QualityTier | 'auto';
  setQualityOverride: (tier: QualityTier | 'auto') => void;

  /* ── boot ───────────────────────────────────────────────────────────── */
  bootSteps: BootStep[];
  bootProgress: number;
  bootDone: boolean;
  bootFailed: boolean;
  setBootStep: (id: BootStepId, status: BootStep['status'], progress?: number) => void;
  finishBoot: () => void;

  /* ── feedback ───────────────────────────────────────────────────────── */
  notice: string | null;
  setNotice: (notice: string | null) => void;
}

const INITIAL_BOOT_STEPS: BootStep[] = [
  { id: 'renderer', label: 'Initialising renderer', status: 'pending' },
  { id: 'textures', label: 'Loading Earth imagery', status: 'pending', progress: 0 },
  { id: 'borders', label: 'Building country boundaries', status: 'pending' },
  { id: 'earthquakes', label: 'Synchronising USGS seismic feed', status: 'pending' },
  { id: 'naturalEvents', label: 'Synchronising NASA EONET', status: 'pending' },
];

const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  earthquakes: true,
  naturalEvents: true,
  weather: true,
  flights: false,
  airQuality: false,
};

export const useTerraScope = create<TerraScopeState>((set, get) => ({
  layers: { ...DEFAULT_LAYERS },
  toggleLayer: (id) => set((state) => ({ layers: { ...state.layers, [id]: !state.layers[id] } })),
  setLayer: (id, enabled) => set((state) => ({ layers: { ...state.layers, [id]: enabled } })),

  earthquakes: emptyState<Earthquake[]>([]),
  naturalEvents: emptyState<NaturalEvent[]>([]),
  flights: emptyState<FlightsSnapshot>({
    observedAt: 0,
    aircraft: [],
    coverage: 'regional',
    regionLabel: '',
    notice: null,
  }),
  airQuality: emptyState<AirQualitySample[]>([]),
  weather: emptyState<WeatherBundle | null>(null),

  setEarthquakes: (data, meta) =>
    set({
      earthquakes: { status: 'ready', data, error: null, meta, lastSuccessAt: Date.now(), retrying: false },
    }),
  setNaturalEvents: (data, meta) =>
    set({
      naturalEvents: { status: 'ready', data, error: null, meta, lastSuccessAt: Date.now(), retrying: false },
    }),
  setFlights: (data, meta) =>
    set({ flights: { status: 'ready', data, error: null, meta, lastSuccessAt: Date.now(), retrying: false } }),
  setAirQuality: (data, meta) =>
    set({ airQuality: { status: 'ready', data, error: null, meta, lastSuccessAt: Date.now(), retrying: false } }),
  setWeather: (data, meta) =>
    set({ weather: { status: 'ready', data, error: null, meta, lastSuccessAt: Date.now(), retrying: false } }),

  setLayerError: (layer, message) =>
    set((state) => {
      // A failure never discards the last good payload: it is relabelled stale.
      const previous = state[layer];
      return {
        [layer]: {
          ...previous,
          status: 'error',
          error: message,
          retrying: false,
          meta: previous.meta ? { ...previous.meta, stale: true } : null,
        },
      } as Partial<TerraScopeState>;
    }),

  setLayerLoading: (layer) =>
    set((state) => ({ [layer]: { ...state[layer], status: 'loading' } }) as Partial<TerraScopeState>),

  setRetrying: (layer, retrying) =>
    set((state) => ({ [layer]: { ...state[layer], retrying } }) as Partial<TerraScopeState>),

  selection: null,
  hoveredId: null,
  focusedPlace: null,
  flyTo: null,
  zoom: null,
  autoRotate: true,

  select: (selection) => set({ selection, detailsOpen: selection !== null }),

  setHovered: (id) => set({ hoveredId: id }),

  focusPlace: (place) => {
    set({ focusedPlace: place, autoRotate: false });
    get().requestFlyTo(place.lat, place.lon, 1.85);
  },

  requestFlyTo: (lat, lon, distance) =>
    set((state) => ({ flyTo: { lat, lon, distance, nonce: (state.flyTo?.nonce ?? 0) + 1 } })),

  requestZoom: (direction) => set((state) => ({ zoom: { direction, nonce: (state.zoom?.nonce ?? 0) + 1 } })),

  resetView: () =>
    set((state) => ({
      flyTo: { lat: 18, lon: 12, distance: 2.95, nonce: (state.flyTo?.nonce ?? 0) + 1 },
      selection: null,
      focusedPlace: null,
      detailsOpen: false,
      autoRotate: true,
    })),

  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setAutoRotate: (value) => set({ autoRotate: value }),

  layerPanelOpen: false,
  sourcesOpen: false,
  detailsOpen: false,
  setLayerPanelOpen: (open) => set({ layerPanelOpen: open }),
  setSourcesOpen: (open) => set({ sourcesOpen: open }),
  setDetailsOpen: (open) => set({ detailsOpen: open }),

  qualityOverride: 'auto',
  setQualityOverride: (tier) => set({ qualityOverride: tier }),

  bootSteps: INITIAL_BOOT_STEPS,
  bootProgress: 0,
  bootDone: false,
  bootFailed: false,

  setBootStep: (id, status, progress) =>
    set((state) => {
      const bootSteps = state.bootSteps.map((step) =>
        step.id === id ? { ...step, status, progress: progress ?? step.progress } : step,
      );
      const completed = bootSteps.filter((step) => step.status === 'done').length;
      const failed = bootSteps.some((step) => step.status === 'failed');
      const bootFailed = failed && completed < 2;
      return {
        bootSteps,
        bootProgress: completed / bootSteps.length,
        bootFailed,
        // The globe is usable as soon as the renderer, textures and borders are
        // ready; live data can arrive afterwards without blocking entry.
        bootDone: bootSteps
          .filter((step) => step.id === 'renderer' || step.id === 'textures' || step.id === 'borders')
          .every((step) => step.status === 'done'),
      };
    }),

  finishBoot: () => set({ bootDone: true, bootProgress: 1 }),

  notice: null,
  setNotice: (notice) => set({ notice }),
}));

/* ── Narrow selectors (avoid object identity churn in components) ───────── */

export const selectLayers = (state: TerraScopeState) => state.layers;
export const selectSelection = (state: TerraScopeState) => state.selection;
export const selectFocusedPlace = (state: TerraScopeState) => state.focusedPlace;
export const selectBootState = (state: TerraScopeState) => ({
  steps: state.bootSteps,
  progress: state.bootProgress,
  done: state.bootDone,
  failed: state.bootFailed,
});

/** Counts shown in the status bar, derived once per data change. */
export function selectCounts(state: TerraScopeState) {
  return {
    earthquakes: state.earthquakes.data.length,
    naturalEvents: state.naturalEvents.data.length,
    flights: state.flights.data.aircraft.length,
    airQuality: state.airQuality.data.length,
  };
}

export function selectAircraftById(state: TerraScopeState, id: string): Aircraft | undefined {
  return state.flights.data.aircraft.find((a) => a.icao24 === id);
}
