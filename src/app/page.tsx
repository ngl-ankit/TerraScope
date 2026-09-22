import type { Metadata } from 'next';
import { AppRoot } from '@/components/AppRoot';

/**
 * TerraScope home.
 *
 * No landing page: the interactive Earth is the first thing rendered. The shell
 * itself is client-side (globe + live polling), so it is loaded through a Client
 * Component boundary in `AppRoot`, which keeps the server render instant and the
 * WebGL bundle out of the initial payload.
 */
export const metadata: Metadata = {
  title: 'TerraScope | Explore Earth in Real Time',
  description:
    'Open TerraScope and the interactive Earth loads immediately: live earthquakes, natural events, weather, air quality and aircraft positions on a real-time 3D globe.',
};

export default function HomePage() {
  return (
    <main className="fixed inset-0 overflow-hidden" aria-label="TerraScope live Earth">
      <AppRoot />

      {/*
        Server-rendered fallback. Inside `noscript` so the page is never blank
        without JavaScript, and so crawlers see what the application does and
        where its data comes from.
      */}
      <noscript>
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-void px-6">
          <div className="glass max-w-md rounded-2xl p-6 text-center">
            <h1 className="text-sm font-semibold text-ink">TerraScope needs JavaScript</h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              The interactive 3D globe is rendered with WebGL, which requires JavaScript. The data sources behind
              it are public and can be queried directly: USGS earthquakes, NASA EONET, Open-Meteo and the OpenSky
              Network.
            </p>
          </div>
        </div>
      </noscript>
    </main>
  );
}
