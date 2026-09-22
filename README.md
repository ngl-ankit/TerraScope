# TerraScope — Explore Earth in Real Time

An interactive 3D Earth that plots **live public geospatial data** on a real globe:
earthquakes, natural events, aircraft positions, weather and air quality. No mock
JSON, no seeded fixtures — every marker comes from a public API, fetched through
TerraScope's own server-side route handlers.

> **TerraScope | Explore Earth in Real Time**

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.9 (strict) |
| UI | React 19, Tailwind CSS 3.4, Lucide React |
| 3D | Three.js, @react-three/fiber, @react-three/drei |
| State | Zustand 5 (granular selectors) |
| Data | USGS, NASA EONET, Open-Meteo, OpenSky Network, Nominatim |

No auth, no database, no payments, no admin panel — by design.

---

## Data sources & honest labelling

| Layer | Source | Auth | Cadence shown in UI |
| --- | --- | --- | --- |
| Earthquakes | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | none | near-real-time |
| Natural events | [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) | none | near-real-time |
| Weather | [Open-Meteo](https://open-meteo.com/) | none | periodic |
| Air quality | [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | none | near-real-time |
| Flights | [OpenSky Network](https://openskynetwork.github.io/opensky-api/) | optional OAuth2 | live |
| Geocoding | [Nominatim / OpenStreetMap](https://nominatim.org/) | none | on demand |

Every payload carries a `meta` block (`source`, `observedAt`, `updatedAt`, `stale`,
`cadence`). The UI renders **"Updated 42 seconds ago"** / **"Last synchronized 3
minutes ago"** from that block. The word *live* is reserved for OpenSky's
`/states/all`; everything else is labelled as latest-available / periodic.

### When an API is unavailable
Each layer fails independently. A dead upstream produces a scoped error card with a
Retry button; the globe, the camera and every other layer keep working. Aircraft are
**never** synthesised — if OpenSky rate-limits, the flight layer reports that
explicitly and switches itself off.

---

## Architecture

```
src/
├── app/
│   ├── api/                  # every external call is proxied server-side
│   │   ├── earthquakes/      # USGS 2.5+_day feed
│   │   ├── natural-events/   # EONET v3 (open events, geojson)
│   │   ├── weather/          # Open-Meteo forecast
│   │   ├── air-quality/      # Open-Meteo AQ over major cities
│   │   ├── flights/          # OpenSky /states/all (+OAuth2 token)
│   │   ├── geocode/          # Nominatim search (rate-limit guarded)
│   │   ├── reverse-geocode/  # Nominatim reverse
│   │   └── health/           # provider + cache diagnostics
│   ├── layout.tsx            # metadata, OG, fonts, manifest
│   ├── manifest.ts           # PWA manifest
│   └── page.tsx              # renders the Earth immediately (no landing page)
├── components/
│   ├── globe/                # EarthMesh, Atmosphere, Starfield, CameraRig,
│   │   ├── layers/           #   GlobeControls, InstancedMarkers, SelectionMarker
│   │   └── ...               # EarthquakeLayer, NaturalEventsLayer, FlightLayer,
│   │                         #   AirQualityLayer
│   └── ui/                   # TopNav, SearchBar, LayerControl, DetailsPanel,
│                             #   WeatherPanel, EventList, StatusBar, StatusCards,
│                             #   ErrorState, LoadingScreen, MobileBottomSheet,
│                             #   SourcesDialog, DataFreshness
└── lib/
    ├── api/                  # typed clients + server cache (client/UI never
    │                         #   talks to a third party directly)
    ├── hooks/                # useLiveData, usePolling, useEarthTextures,
    │                         #   useCountryBorders, useDeviceProfile, useNow
    ├── store/                # Zustand store (single source of UI truth)
    ├── types.ts              # API response contracts
    └── utils/                # geo maths, formatters
```

**Rule enforced throughout:** API clients live in `lib/`, UI components live in
`components/`. A component never constructs a third-party URL.

---

## Globe

- Blue Marble day texture + Black Marble night texture blended by a real sun-direction
  terminator, so the day/night line tracks actual UTC.
- Specular ocean map + topology bump map, procedural atmosphere shell, starfield.
- Orbit controls with damping: mouse drag, wheel/pinch zoom, two-finger touch, full
  mobile gesture support.
- Country borders from a local `world-atlas` → GeoJSON build step (`npm run borders`),
  served from `public/data` — no runtime dependency on a border CDN.
- Selected locations are reached by a damped camera flight (`CameraRig`), not a jump cut.

### Marker rendering
Markers are drawn as **instanced geometry** — one draw call per layer regardless of
event count (9,600+ aircraft, 40+ earthquakes, 48 natural events). Magnitude maps to
instance scale; hover/selection is resolved by raycasting the instanced mesh, not by
mounting thousands of React components.

---

## Performance & device adaptation

- The WebGL bundle is loaded through `next/dynamic({ ssr: false })` inside a Client
  Component boundary, so the HTML/SEO shell ships instantly and the globe streams in.
- `useDeviceProfile` detects low-power/mobile hardware and reduces DPR, disables the
  bump/specular passes and thins the starfield accordingly.
- Textures ship in two resolutions (full and 2K) and the appropriate set is selected
  at runtime.
- Polling is per-source and conservative (earthquakes ~60s, EONET ~5min, flights ~15s,
  air quality ~10min, weather on location change). In-flight requests are aborted on
  unmount / parameter change via `AbortController`.
- Zustand selectors are granular to keep re-renders off the render loop.

---

## Accessibility

Keyboard-operable controls with visible focus rings, real `<button>`/`<input>`
semantics and `aria-label`s, `aria-live` regions for load/error announcements,
colour is never the only signal (magnitude is also printed), and
`prefers-reduced-motion` disables the camera flights and pulsing animations.

---

## Running it

```bash
npm install
npm run borders      # regenerates public/data/countries-110m.geojson (one-off)
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
```

### Environment
**Every variable is optional.** TerraScope runs with an empty environment because all
six providers are key-free. `.env.example` documents each one; nothing in it is read
by the browser — configuration is consumed only inside route handlers.

```bash
cp .env.example .env.local
```

Registering an OpenSky OAuth2 client (`OPEN_SKY_CLIENT_ID` / `OPEN_SKY_CLIENT_SECRET`)
is the only change that meaningfully raises a rate limit.

---

## Attribution

USGS Earthquake Hazards Program · NASA EONET · Open-Meteo · OpenSky Network ·
OpenStreetMap / Nominatim · NASA Blue Marble & Black Marble imagery ·
Natural Earth (via `world-atlas`).
