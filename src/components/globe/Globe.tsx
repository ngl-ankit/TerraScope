'use client';

import dynamic from 'next/dynamic';
import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Globe entry point.
 *
 * three.js, every shader and the renderer are pulled in exclusively through
 * `next/dynamic({ ssr: false })`: they never appear in the server bundle, and
 * the first paint is the app shell rather than a blocked HTML stream.
 *
 * The error boundary is not decoration. A WebGL failure (no context, a driver
 * bug, a lost context on iOS Safari after backgrounding) must not take the whole
 * command centre down: the panels, the search and every data layer keep working,
 * and the user gets an explanation plus a retry that remounts the canvas.
 */

const GlobeScene = dynamic(() => import('@/components/globe/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative h-14 w-14">
          <span className="absolute inset-0 rounded-full border border-accent/25" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent/80 [animation-duration:1.4s]" />
        </div>
        <p className="text-xs font-medium tracking-wide text-ink-muted">Initialising renderer</p>
      </div>
    </div>
  ),
});

interface GlobeErrorBoundaryProps {
  children: ReactNode;
}

interface GlobeErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

class GlobeErrorBoundary extends Component<GlobeErrorBoundaryProps, GlobeErrorBoundaryState> {
  constructor(props: GlobeErrorBoundaryProps) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<GlobeErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as a console warning rather than a silent swallow: a WebGL failure is
    // worth seeing in a support report.
    console.warn('TerraScope globe failed to render:', error.message, info.componentStack);
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="glass max-w-md rounded-2xl p-6 text-center">
            <div
              className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-layer-wildfire/40 bg-layer-wildfire/10"
              aria-hidden="true"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-layer-wildfire" />
            </div>
            <h2 className="text-sm font-semibold text-ink">The 3D globe could not start</h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Your browser reported: {this.state.error.message || 'WebGL is unavailable.'} The rest of TerraScope
              remains usable — search, layer data and details still work.
            </p>
            <button type="button" onClick={this.handleRetry} className="btn-ghost mt-4">
              Retry renderer
            </button>
          </div>
        </div>
      );
    }

    // `key` forces a clean remount of the canvas on retry, which is the only
    // reliable way to recover from a lost WebGL context.
    return <GlobeScene key={this.state.attempt} />;
  }
}

export function Globe() {
  return (
    <GlobeErrorBoundary>
      <div className="absolute inset-0">
        <GlobeScene />
      </div>
    </GlobeErrorBoundary>
  );
}

export default Globe;
