'use client';

import { Menu, Satellite, Settings2 } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { useTerraScope } from '@/lib/store/useTerraScope';

/**
 * Top navigation.
 *
 * Deliberately thin — the globe is the interface, so the bar carries only
 * identity, search and two panel toggles. On mobile the search moves into the
 * bar itself (it is the primary way to drive the globe) and the identity block
 * collapses to the mark.
 */
export function TopNav() {
  const setLayerPanelOpen = useTerraScope((s) => s.setLayerPanelOpen);
  const setSourcesOpen = useTerraScope((s) => s.setSourcesOpen);
  const layerPanelOpen = useTerraScope((s) => s.layerPanelOpen);

  return (
    <header className="pointer-events-auto flex items-center gap-2 sm:gap-3">
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.08]"
          aria-hidden="true"
        >
          <Satellite size={15} className="text-accent-soft" />
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold tracking-tight text-ink">TerraScope</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Earth in real time</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <SearchBar />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setLayerPanelOpen(!layerPanelOpen)}
          aria-expanded={layerPanelOpen}
          aria-controls="terrascope-layer-panel"
          className="btn-ghost !px-2.5 lg:hidden"
          title="Data layers"
        >
          <Menu size={14} aria-hidden="true" />
          <span className="hidden xs:inline">Layers</span>
        </button>

        <button
          type="button"
          onClick={() => setSourcesOpen(true)}
          className="btn-icon !h-10 !w-10 lg:!h-9 lg:!w-9"
          title="Data sources and settings"
          aria-label="Data sources and settings"
        >
          <Settings2 size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
