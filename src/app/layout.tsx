import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * Root layout.
 *
 * Metadata is complete on purpose: title, description, Open Graph, Twitter card,
 * canonical URL, theme colour and an SVG favicon. `viewport` uses
 * `viewport-fit=cover` so the safe-area insets in globals.css resolve on iOS.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://terrascope.local';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TerraScope | Explore Earth in Real Time',
    template: '%s | TerraScope',
  },
  description:
    'TerraScope is an interactive 3D Earth that streams live public data — USGS earthquakes, NASA EONET natural events, Open-Meteo weather and air quality, and OpenSky Network flight positions — onto a real-time globe.',
  applicationName: 'TerraScope',
  keywords: [
    '3D Earth',
    'live earthquakes',
    'NASA EONET',
    'USGS',
    'Open-Meteo',
    'OpenSky Network',
    'geospatial',
    'real-time data',
    'WebGL globe',
    'Next.js',
    'React Three Fiber',
  ],
  authors: [{ name: 'TerraScope' }],
  creator: 'TerraScope',
  category: 'Geospatial',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'TerraScope',
    title: 'TerraScope | Explore Earth in Real Time',
    description:
      'An interactive 3D Earth streaming live earthquakes, natural events, weather, air quality and aircraft positions from public APIs.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TerraScope | Explore Earth in Real Time',
    description:
      'An interactive 3D Earth streaming live earthquakes, natural events, weather, air quality and aircraft positions from public APIs.',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: '#04060d',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-void text-ink antialiased">
        {/* Skip link: the globe is the first interactive element, so keyboard
            users need a way past the canvas into the panels. */}
        <a
          href="#terrascope-panels"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:border focus:border-accent/40 focus:bg-void-800 focus:px-3 focus:py-2 focus:text-xs focus:text-ink"
        >
          Skip to data panels
        </a>
        <div id="terrascope-panels" className="contents">
          {children}
        </div>
      </body>
    </html>
  );
}
