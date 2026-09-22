'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Loader2, MapPin, Plane, Search, X } from 'lucide-react';
import { apiGet, describeApiError } from '@/lib/client/http';
import { QUICK_PLACES } from '@/lib/api/airportLookup';
import { useTerraScope } from '@/lib/store/useTerraScope';
import type { GeoPlace } from '@/lib/types';

/**
 * Global location search.
 *
 * Behaviour:
 *  - Debounced 350 ms, with the previous request aborted, so typing "Reykjavik"
 *    issues one Nominatim call rather than nine.
 *  - Arrow keys / Enter / Escape are fully handled; the input is a proper
 *    combobox with `aria-activedescendant` so screen readers announce the active
 *    option.
 *  - Recent selections are kept in memory for the session (no persistence, no
 *    cookies) so repeat lookups cost nothing.
 */

const DEBOUNCE_MS = 350;
const MAX_RECENTS = 5;

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const focusPlace = useTerraScope((s) => s.focusPlace);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [recents, setRecents] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const visible = useMemo(() => {
    if (query.trim().length < 2) return recents.length > 0 ? recents : QUICK_PLACES;
    return results;
  }, [query, recents, results]);

  /* Debounced search with cancellation. */
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      controllerRef.current?.abort();
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        const envelope = await apiGet<GeoPlace[]>(
          `/api/geocode?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, timeoutMs: 15_000 },
        );
        setResults(envelope.data);
        setActiveIndex(envelope.data.length > 0 ? 0 : -1);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(describeApiError(caught, 'Location search'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  /* Close on outside interaction. */
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const choose = useCallback(
    (place: GeoPlace) => {
      focusPlace(place);
      setRecents((previous) => [place, ...previous.filter((p) => p.id !== place.id)].slice(0, MAX_RECENTS));
      setQuery(place.name);
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    },
    [focusPlace],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const place = visible[activeIndex] ?? visible[0];
      if (place) choose(place);
    }
  };

  const heading = query.trim().length < 2 ? (recents.length > 0 ? 'Recent locations' : 'Suggested places') : 'Results';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="terrascope-search-results"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `terrascope-option-${activeIndex}` : undefined}
          aria-label="Search for a country, city or airport"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search a city, country or airport"
          autoComplete="off"
          spellCheck={false}
          className="glass-soft h-10 w-full rounded-xl pl-9 pr-9 text-xs text-ink placeholder:text-ink-faint focus:border-accent/40 focus:outline-none"
        />

        {loading && (
          <Loader2
            size={13}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent"
            aria-hidden="true"
          />
        )}
        {!loading && query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint transition hover:bg-white/[0.06] hover:text-ink"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="terrascope-search-results"
          role="listbox"
          aria-label="Search results"
          className="glass scroll-thin absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(60vh,22rem)] overflow-y-auto rounded-xl p-1.5 shadow-panel"
        >
          <p className="section-label px-2.5 py-1.5">{heading}</p>

          {error && <p className="px-2.5 py-2 text-2xs text-layer-wildfire">{error}</p>}

          {!error && visible.length === 0 && !loading && (
            <p className="px-2.5 py-2 text-2xs text-ink-faint">
              No places matched that search. Try a city, a country, or an airport code such as LHR.
            </p>
          )}

          <ul>
            {visible.map((place, index) => {
              const isAirport = place.kind === 'airport';
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    id={`terrascope-option-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => choose(place)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                      index === activeIndex ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        isAirport
                          ? 'border-layer-flight/25 bg-layer-flight/10 text-layer-flight'
                          : 'border-accent/20 bg-accent/10 text-accent-soft'
                      }`}
                      aria-hidden="true"
                    >
                      {isAirport ? <Plane size={11} /> : <MapPin size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-ink">{place.name}</span>
                      <span className="block truncate text-2xs text-ink-faint">
                        {place.detail || place.label}
                      </span>
                    </span>
                    <span className="mono shrink-0 text-2xs text-ink-faint">
                      {place.lat.toFixed(1)}, {place.lon.toFixed(1)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-1 flex items-center gap-1.5 border-t border-white/[0.06] px-2.5 pb-1 pt-2 text-2xs text-ink-faint">
            <CornerDownLeft size={9} aria-hidden="true" />
            <span>
              Geocoding by{' '}
              <a
                href="https://nominatim.openstreetmap.org/"
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-dotted underline-offset-2 hover:text-ink-muted"
              >
                Nominatim / OpenStreetMap
              </a>
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
