'use client';

import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { DATA_SOURCES, LAYERS } from '@/lib/api/sources';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { useDeviceProfile } from '@/lib/hooks/useDeviceProfile';
import type { QualityTier } from '@/lib/hooks/useDeviceProfile';

/**
 * Data sources & settings dialog.
 *
 * Two jobs: honest attribution for every provider TerraScope reads, and the
 * render-quality control. Both matter for the "is this a real product" question —
 * attribution because the data is not ours, and quality because the same build
 * has to run on a phone and a workstation.
 */

const QUALITY_OPTIONS: Array<{ value: QualityTier | 'auto'; label: string; description: string }> = [
  { value: 'auto', label: 'Automatic', description: 'Detected from CPU cores, memory and screen density' },
  { value: 'high', label: 'High', description: '4K textures, full starfield, 128-segment sphere' },
  { value: 'medium', label: 'Balanced', description: '2K textures, reduced starfield, 72-segment sphere' },
  { value: 'low', label: 'Performance', description: '2K textures, no atmosphere shell, 48-segment sphere' },
];

export function SourcesDialog() {
  const open = useTerraScope((s) => s.sourcesOpen);
  const setOpen = useTerraScope((s) => s.setSourcesOpen);
  const qualityOverride = useTerraScope((s) => s.qualityOverride);
  const setQualityOverride = useTerraScope((s) => s.setQualityOverride);
  const profile = useDeviceProfile(qualityOverride);

  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, setOpen]);

  const activeLayers = useMemo(() => LAYERS, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terrascope-sources-title"
    >
      <button
        type="button"
        aria-label="Close data sources"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        tabIndex={-1}
      />

      <div className="glass scroll-thin relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl shadow-panel sm:rounded-2xl">
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-white/[0.07] bg-[rgba(9,14,26,0.92)] px-4 py-3.5 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <h2 id="terrascope-sources-title" className="text-sm font-semibold tracking-tight text-ink">
              Data sources &amp; settings
            </h2>
            <p className="mt-0.5 text-2xs text-ink-faint">
              TerraScope reads public APIs directly. Nothing here is simulated.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-ink-muted transition hover:text-ink"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-5 px-4 py-4">
          {/* Providers */}
          <section>
            <h3 className="section-label mb-2">Providers</h3>
            <ul className="space-y-1.5">
              {DATA_SOURCES.map((source) => (
                <li key={source.name} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-semibold text-ink underline decoration-dotted underline-offset-2 transition hover:text-accent-soft"
                  >
                    {source.name}
                  </a>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-faint">{source.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Layer cadences */}
          <section>
            <h3 className="section-label mb-2">Layer cadence</h3>
            <ul className="space-y-1">
              {activeLayers.map((layer) => (
                <li
                  key={layer.id}
                  className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: layer.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold text-ink-muted">{layer.label}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-ink-faint">{layer.cadenceNote}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Render quality */}
          <section>
            <h3 className="section-label mb-2">Render quality</h3>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Render quality">
              {QUALITY_OPTIONS.map((option) => {
                const selected = qualityOverride === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setQualityOverride(option.value)}
                    className={`rounded-xl border px-2.5 py-2 text-left transition ${
                      selected
                        ? 'border-accent/40 bg-accent/[0.08]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    <span className={`block text-2xs font-semibold ${selected ? 'text-accent-soft' : 'text-ink-muted'}`}>
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mono mt-2 text-2xs text-ink-faint">
              Active: {profile.tier} · {profile.globeSegments}-segment sphere · {profile.starCount.toLocaleString('en-US')}{' '}
              stars · {profile.textureSize.toUpperCase()} textures
              {profile.reducedMotion && ' · reduced motion'}
            </p>
          </section>

          {/* Honest limitations */}
          <section>
            <h3 className="section-label mb-2">Known limitations</h3>
            <ul className="space-y-1.5 text-2xs leading-relaxed text-ink-faint">
              <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <span className="font-semibold text-ink-muted">Flights.</span> OpenSky Network gives anonymous
                clients roughly 400 credits per day, so TerraScope samples three dense regions every 15 seconds
                rather than polling globally. If the quota is reached the layer pauses and says so — aircraft are
                never invented.
              </li>
              <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <span className="font-semibold text-ink-muted">Air quality.</span> Sampled at 32 cities from an
                hourly model. It is a city sample, not a global pollution field.
              </li>
              <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <span className="font-semibold text-ink-muted">Weather.</span> Fetched only for the coordinate you
                select, because Open-Meteo answers per point.
              </li>
              <li className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <span className="font-semibold text-ink-muted">Freshness.</span> Labels distinguish live, latest
                available, and cached data. A failed refresh keeps the last good values and marks them stale
                rather than showing an empty layer.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
