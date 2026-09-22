/**
 * Builds the country-border dataset used by the 3D globe.
 *
 * Source: `world-atlas` countries-110m TopoJSON (Natural Earth 1:110m
 * public-domain boundaries, derived from Natural Earth data).
 *
 * The output is a GeoJSON FeatureCollection with a single `name` property and
 * coordinates rounded to 3 decimals — about a third of the size of the raw
 * source, and far cheaper to parse/upload on mobile connections.
 *
 * Usage: npm run data:borders
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const round = (n) => Math.round(n * 1000) / 1000;

function roundRing(ring) {
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const [x, y] = ring[i];
    const prev = out[out.length - 1];
    const p = [round(x), round(y)];
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
    out.push(p);
  }
  return out;
}

function roundGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map(roundRing).filter((r) => r.length > 3) };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates
        .map((poly) => poly.map(roundRing).filter((r) => r.length > 3))
        .filter((poly) => poly.length > 0),
    };
  }
  return null;
}

const topo = JSON.parse(readFileSync(resolve(root, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));
const collection = feature(topo, topo.objects.countries);

const features = collection.features
  .map((f) => {
    const geometry = roundGeometry(f.geometry);
    if (!geometry) return null;
    return {
      type: 'Feature',
      properties: { name: f.properties?.name ?? 'Unknown' },
      geometry,
    };
  })
  .filter(Boolean);

const out = {
  type: 'FeatureCollection',
  metadata: {
    name: 'Natural Earth 1:110m country boundaries',
    source: 'https://www.naturalearthdata.com/',
    packagedBy: 'world-atlas (https://github.com/topojson/world-atlas)',
    generatedAt: new Date().toISOString(),
    featureCount: features.length,
  },
  features,
};

const target = resolve(root, 'public/data/countries-110m.geojson');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out));

const bytes = Buffer.byteLength(JSON.stringify(out));
console.log(`countries-110m.geojson written: ${features.length} features, ${(bytes / 1024).toFixed(1)} KB`);
