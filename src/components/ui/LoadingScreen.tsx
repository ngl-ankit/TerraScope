'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, Globe2 } from 'lucide-react';
import { useTerraScope } from '@/lib/store/useTerraScope';

/**
 * Boot experience.
 *
 * Covers the viewport until the renderer, the texture set and the country
 * borders are ready — the three things without which the globe would look
 * broken. Live data is *not* part of the gate: the globe becomes interactive and
 * the data streams in behind it, which is the difference between "slow app" and
 * "app that is already there".
 *
 * Progress is real (texture bytes downloaded, boot steps completed), not a
 * decorative timer. After the gate opens the overlay cross-fades out, so the
 * first frame of the globe is never a blank canvas.
 */
export function LoadingScreen() {
  const steps = useTerraScope((s) => s.bootSteps);
  const progress = useTerraScope((s) => s.bootProgress);
  const done = useTerraScope((s) => s.bootDone);

  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!done) return;
    setFading(true);
    const timer = setTimeout(() => setVisible(false), 620);
    return () => clearTimeout(timer);
  }, [done]);

  if (!visible) return null;

  const completed = steps.filter((step) => step.status === 'done').length;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-void px-6 transition-opacity duration-500 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      role="status"
      aria-live="polite"
      aria-label="TerraScope is starting"
    >
      {/* Ambient background: two very soft radial washes, no animation on
          reduced-motion because the whole element is static anyway. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 42%, rgba(27,111,168,0.20) 0%, transparent 70%), radial-gradient(40% 40% at 78% 74%, rgba(76,201,240,0.10) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-accent/20" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent/80 [animation-duration:1.6s]" />
            <Globe2 size={18} className="text-accent-soft" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-ink">TerraScope</h1>
            <p className="text-2xs uppercase tracking-[0.18em] text-ink-faint">Explore Earth in real time</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-deep via-accent to-accent-soft transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
          />
        </div>
        <p className="mono mt-2 text-2xs text-ink-faint">
          {completed} of {steps.length} stages ready
        </p>

        {/* Real boot steps */}
        <ul className="mt-5 space-y-2">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2.5 text-xs">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  step.status === 'done'
                    ? 'border-accent/40 bg-accent/15 text-accent-soft'
                    : step.status === 'failed'
                      ? 'border-layer-wildfire/40 bg-layer-wildfire/10 text-layer-wildfire'
                      : step.status === 'active'
                        ? 'border-accent/40 text-accent'
                        : 'border-white/10 text-transparent'
                }`}
                aria-hidden="true"
              >
                {step.status === 'done' ? (
                  <Check size={9} />
                ) : step.status === 'failed' ? (
                  <AlertCircle size={9} />
                ) : step.status === 'active' ? (
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
                ) : null}
              </span>
              <span
                className={
                  step.status === 'pending'
                    ? 'text-ink-faint'
                    : step.status === 'failed'
                      ? 'text-layer-wildfire'
                      : 'text-ink-muted'
                }
              >
                {step.label}
                {step.id === 'textures' && step.status === 'active' && step.progress
                  ? ` — ${Math.round(step.progress * 100)}%`
                  : ''}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-2xs leading-relaxed text-ink-faint">
          Live layers: USGS earthquakes, NASA EONET natural events, Open-Meteo weather and air quality, OpenSky
          Network flight positions.
        </p>
      </div>
    </div>
  );
}
