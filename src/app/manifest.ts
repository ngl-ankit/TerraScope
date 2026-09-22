import type { MetadataRoute } from 'next';

/** Web app manifest, so TerraScope installs cleanly on mobile. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TerraScope | Explore Earth in Real Time',
    short_name: 'TerraScope',
    description:
      'Interactive 3D Earth streaming live earthquakes, natural events, weather, air quality and aircraft positions from public APIs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#04060d',
    theme_color: '#04060d',
    orientation: 'any',
    categories: ['education', 'weather', 'navigation', 'utilities'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
