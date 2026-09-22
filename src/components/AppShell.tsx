'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PanelRightClose, X } from 'lucide-react';

import { Globe } from '@/components/globe/Globe';
import { GlobeControls, GlobeHint } from '@/components/globe/GlobeControls';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { LayerControl } from '@/components/ui/LayerControl';
import { DetailsPanel } from '@/components/ui/DetailsPanel';
import { EventList } from '@/components/ui/EventList';
import { StatusBar } from '@/components/ui/StatusBar';
import { StatusCards } from '@/components/ui/StatusCards';
import { SourcesDialog } from '@/components/ui/SourcesDialog';
import { TopNav } from '@/components/ui/TopNav';
import { MobileBottomSheet } from '@/components/ui/MobileBottomSheet';

import { useLiveData } from '@/lib/hooks/useLiveData';
import { useNow } from '@/lib/hooks/useNow';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { formatAge } from '@/lib/utils/format';
import type { LayerId } from '@/lib/types';

/**
 * Application shell.
 *
 * Layout strategy: the globe is a fixed, full-viewport layer (`fixed inset-0`),
 * and every panel floats above it in a separate stacking context. Nothing is in
 * normal document flow, which is what guarantees the globe can never be pushed
 * around by a long event list and that no panel can create horizontal overflow —
 * panels are bounded by `max-w-*` and their own scroll containers.
 *
 * Desktop (≥1024px): a left dock with layers, a right dock with the event feed
 * and details, and a status rail along the bottom.
 * Tablet (768–1023px): the left dock becomes a slide-over; the right dock stays.
 * Mobile (<768px): a compact top bar, on-canvas camera controls, and one bottom
 * sheet that switches between Layers / Feed / Details.
 */
export default function AppShell() {
  const now = useNow(1000);

  const layerPanelOpen = useTerraScope((s) => s.layerPanelOpen);
  const setLayerPanelOpen = useTerraScope((s) => s.setLayerPanelOpen);
  const detailsOpen = useTerraScope((s) => s.detailsOpen);
  const setDetailsOpen = useTerraScope((s) => s.setDetailsOpen);
  const selection = useTerraScope((s) => s.selection);
  const notice = useTerraScope((s) => s.notice);
  const setNotice = useTerraScope((s) => s.setNotice);
  const setSourcesOpen = useTerraScope((s) => s.setSourcesOpen);
  const earthquakesMeta = useTerraScope((s) => s.earthquakes.meta);
  const naturalEventsMeta = useTerraScope((s) => s.naturalEvents.meta);

  /* Mobile sheet: which pane is showing. */
  const [sheetPane, setSheetPane] = useState<'layers' | 'feed' | 'details'>('feed');
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * A selection made anywhere (globe click, list row, status card) should reveal
   * the details pane on mobile — but never yank the sheet open if the user has
   * deliberately closed it while browsing.
   */
  useEffect(() => {
    if (selection) setSheetPane('details');
  }, [selection]);

  /* Auto-dismiss transient notices. */
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  /**
   * Live data is started exactly once, here (one `useLiveData()` call owns every
   * polling loop). The retry callbacks are shared with the layer panel and the
   * error states; retries are per-layer, so retrying USGS cannot touch the EONET
   * or OpenSky loops.
   */
  const {
    retryEarthquakes,
    retryNaturalEvents,
    retryFlights,
    retryAirQuality,
    retryWeather,
  } = useLiveData();

  const retries = useMemo<Record<LayerId, () => void>>(
    () => ({
      earthquakes: retryEarthquakes,
      naturalEvents: retryNaturalEvents,
      flights: retryFlights,
      airQuality: retryAirQuality,
      weather: retryWeather,
    }),
    [retryAirQuality, retryEarthquakes, retryFlights, retryNaturalEvents, retryWeather],
  );

  const openSheet = useCallback(
    (pane: 'layers' | 'feed' | 'details') => {
      setSheetPane(pane);
      setSheetOpen(true);
    },
    [],
  );

  return (
    <>
      <LoadingScreen />

      {/* ── Globe: fixed, full-viewport, always behind the UI ── */}
      <div className="fixed inset-0 z-0">
        <Globe />
      </div>

      {/* Vignette: darkens the edges so panels keep contrast over bright terrain
          without resorting to heavy blur. Pointer-events off. */}
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, transparent 42%, rgba(4,6,13,0.42) 78%, rgba(4,6,13,0.78) 100%)',
        }}
        aria-hidden="true"
      />

      {/* ── Top bar ── */}
      <div className="safe-top safe-x pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-2">
          <TopNav />

          {/* Mobile: pane switcher */}
          <div className="pointer-events-auto flex items-center gap-1.5 lg:hidden">
            <PaneTab active={sheetOpen && sheetPane === 'layers'} onClick={() => openSheet('layers')}>
              Layers
            </PaneTab>
            <PaneTab active={sheetOpen && sheetPane === 'feed'} onClick={() => openSheet('feed')}>
              Feed
            </PaneTab>
            <PaneTab
              active={sheetOpen && sheetPane === 'details'}
              onClick={() => openSheet('details')}
              badge={selection ? '•' : undefined}
            >
              Details
            </PaneTab>
          </div>
        </div>
      </div>

      {/* ── Desktop / tablet: left dock ── */}
      {/*
        The dock and the HUD cluster below are both `fixed left-4 w-[19rem]`, so
        they must be given mutually exclusive vertical bands. Anchoring the dock
        to BOTH `top-24` and `bottom-[14.5rem]` reserves the HUD's height, and
        the inner panels then arbitrate: Data layers keeps its natural height
        (capped, scrolling if the viewport is very short) and the event feed
        takes the remainder and scrolls internally — previously neither panel
        was height-bounded, so the feed rendered at full length and the HUD was
        painted on top of it.
      */}
      <aside
        id="terrascope-layer-panel"
        className="fixed left-4 top-24 bottom-[14.5rem] z-20 hidden w-[19rem] flex-col gap-2 lg:flex"
        aria-label="Layer controls"
      >
        <div className="panel-shell flex max-h-[55%] shrink-0 flex-col overflow-hidden">
          <div className="scroll-thin min-h-0 overflow-y-auto">
            <LayerControl retries={retries} />
          </div>
        </div>

        <div className="panel-shell flex min-h-0 flex-1 flex-col overflow-hidden">
          <EventList retries={retries} />
        </div>
      </aside>

      {/* ── Tablet: slide-over layer panel ── */}
      {layerPanelOpen && (
        <div className="fixed inset-0 z-40 hidden md:block lg:hidden" role="dialog" aria-modal="true" aria-label="Layer controls">
          <button
            type="button"
            aria-label="Close layer controls"
            onClick={() => setLayerPanelOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            tabIndex={-1}
          />
          <div className="glass absolute left-0 top-0 h-full w-[21rem] max-w-[85vw] overflow-y-auto rounded-r-2xl shadow-panel">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-3.5 py-3">
              <h2 className="text-xs font-semibold text-ink">Layers &amp; feed</h2>
              <button
                type="button"
                onClick={() => setLayerPanelOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-ink-muted transition hover:text-ink"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <LayerControl retries={retries} variant="sheet" />
            <div className="border-t border-white/[0.07]">
              <EventList retries={retries} />
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop: right dock (details) ── */}
      <aside
        className="pointer-events-none fixed right-4 top-24 z-20 hidden max-h-[calc(100dvh-13rem)] w-[21.5rem] lg:block"
        aria-label="Event details"
      >
        {detailsOpen && (
          <div className="panel-shell animate-slide-right pointer-events-auto flex max-h-[calc(100dvh-13rem)] flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-3.5 py-2.5">
              <h2 className="section-label">Details</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSourcesOpen(true)}
                  className="mono rounded-md px-1.5 py-1 text-2xs text-ink-faint transition hover:text-ink-muted"
                >
                  {selection ? 'Source info' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  aria-label="Collapse details panel"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-white/[0.06] hover:text-ink"
                >
                  <PanelRightClose size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
              <DetailsPanel retries={retries} />
            </div>
          </div>
        )}

        {!detailsOpen && (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="glass pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-2xs font-semibold text-ink-muted shadow-raised transition hover:border-accent/30 hover:text-ink"
          >
            <ChevronLeft size={12} aria-hidden="true" />
            Open details
          </button>
        )}
      </aside>

      {/*
        Camera controls + HUD. On desktop the rail clears the details dock:
        both were anchored at `right-4`, so the rail was painted across the
        panel's right edge. `23.5rem` = 21.5rem dock + 1rem gap + 1rem gutter.
      */}
      <div className="pointer-events-none fixed right-3 z-30 flex flex-col items-end gap-2 sm:right-4 lg:right-[23.5rem]">
        <div className="absolute right-0 top-[calc(100dvh-4rem)] -translate-y-full">
          <GlobeControls />
        </div>
      </div>

      {/* Desktop HUD cluster, bottom-left */}
      <div className="pointer-events-none fixed bottom-4 left-4 z-20 hidden w-[19rem] lg:block">
        <div className="panel-shell p-2.5">
          <StatusCards />
        </div>
      </div>

      {/* Interaction hint, bottom-centre */}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-20 hidden -translate-x-1/2 lg:block">
        <GlobeHint />
      </div>

      {/* ── Mobile / tablet: status rail ── */}
      <div className="safe-bottom safe-x pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-3 lg:hidden">
        <div className="glass mx-auto max-w-2xl rounded-xl px-3 py-2.5 shadow-raised">
          <StatusBar onOpenSources={() => setSourcesOpen(true)} />
        </div>
      </div>

      {/* ── Mobile / tablet: bottom sheet ── */}
      <MobileBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={
          sheetPane === 'layers' ? 'Data layers' : sheetPane === 'feed' ? 'Event feed' : 'Details'
        }
        badge={
          sheetPane === 'details' && selection ? (
            <span className="chip !px-2 !py-0.5">{selection.kind}</span>
          ) : undefined
        }
      >
        {sheetPane === 'layers' && <LayerControl retries={retries} variant="sheet" />}
        {sheetPane === 'feed' && <EventList retries={retries} />}
        {sheetPane === 'details' && <DetailsPanel retries={retries} />}
      </MobileBottomSheet>

      {/* ── Transient notices ── */}
      {notice && (
        <div
          role="status"
          className="glass animate-slide-up fixed bottom-24 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-xl px-3.5 py-2.5 shadow-panel lg:bottom-6"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-layer-seismic" aria-hidden="true" />
          <span className="text-2xs text-ink-muted">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
            className="ml-1 shrink-0 text-ink-faint transition hover:text-ink"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      <SourcesDialog />

      {/* Visually hidden freshness summary for screen readers, so the state of
          every source is announced without depending on colour alone. */}
      <div className="sr-only" aria-live="polite">
        {`Earthquake data synced ${
          earthquakesMeta?.updatedAt ? formatAge(earthquakesMeta.updatedAt, now) : 'never'
        } ago. ${naturalEventsMeta?.updatedAt ? `Natural events synced ${formatAge(naturalEventsMeta.updatedAt, now)} ago.` : ''}`}
      </div>
    </>
  );
}

function PaneTab({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`glass-soft relative flex h-8 items-center gap-1 rounded-lg px-2.5 text-2xs font-semibold transition ${
        active ? 'border-accent/40 text-accent-soft' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
      {badge && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-layer-seismic" aria-hidden="true" />
      )}
    </button>
  );
}

export { ChevronRight };
