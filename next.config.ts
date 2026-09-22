import type { NextConfig } from 'next';

/**
 * TerraScope Next.js configuration.
 *
 * Notes:
 * - `reactStrictMode` is on so that effect leaks (polling timers, RAF loops,
 *   listeners) surface during development instead of in production.
 * - Static assets under /textures and /data are immutable, so they get a long
 *   cache lifetime. That matters because the Earth texture set is ~2 MB.
 * - Every external API is proxied through `src/app/api/*` route handlers, so no
 *   third-party origin is contacted directly from the browser and no secret is
 *   ever shipped to the client bundle.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    const immutable = 'public, max-age=604800, stale-while-revalidate=86400';
    return [
      { source: '/textures/:path*', headers: [{ key: 'Cache-Control', value: immutable }] },
      { source: '/data/:path*', headers: [{ key: 'Cache-Control', value: immutable }] },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
