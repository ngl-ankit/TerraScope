'use client';

import dynamic from 'next/dynamic';

/**
 * Client-side entry point for the application shell.
 *
 * `next/dynamic` with `ssr: false` is only legal inside a Client Component, so
 * this thin wrapper exists purely to keep the shell out of the server bundle
 * (the globe, the polling loops and every panel are stateful and WebGL-bound).
 * The fallback is the same mark the boot screen uses, so the first paint is
 * branded rather than blank.
 */
const AppShell = dynamic(() => import('@/components/AppShell'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-void" role="status" aria-label="TerraScope is starting">
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 rounded-full border border-accent/25" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent/80 [animation-duration:1.5s]" />
        </div>
        <p className="text-xs font-medium tracking-wide text-ink-muted">TerraScope</p>
      </div>
    </div>
  ),
});

export function AppRoot() {
  return <AppShell />;
}

export default AppRoot;
