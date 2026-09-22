'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Mobile bottom sheet.
 *
 * A hand-rolled sheet rather than a library, because the gesture behaviour is
 * the whole point: drag-to-dismiss with velocity, a backdrop that closes on tap,
 * body-scroll locking while open, and — critically — pointer events on the
 * handle only, so the globe keeps receiving drags everywhere else.
 *
 * Focus is moved into the sheet on open and returned to the trigger on close,
 * and Escape closes it.
 */

export interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Rendered to the right of the title, e.g. a freshness chip. */
  badge?: ReactNode;
  children: ReactNode;
  /** Extra classes applied to the scrollable body. */
  bodyClassName?: string;
}

export function MobileBottomSheet({
  open,
  onClose,
  title,
  badge,
  children,
  bodyClassName = '',
}: MobileBottomSheetProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startTime: number } | null>(null);

  /* Lock body scroll and restore focus on close. */
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) setDragOffset(0);
  }, [open]);

  if (!open) return null;

  const onPointerDown = (event: React.PointerEvent) => {
    dragState.current = { startY: event.clientY, startTime: performance.now() };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragState.current) return;
    const delta = event.clientY - dragState.current.startY;
    setDragOffset(Math.max(0, delta));
  };

  const onPointerUp = () => {
    if (!dragState.current) return;
    const elapsed = performance.now() - dragState.current.startTime;
    const velocity = dragOffset / Math.max(elapsed, 1); // px per ms
    const shouldClose = dragOffset > 96 || velocity > 0.65;
    dragState.current = null;
    setDragging(false);
    if (shouldClose) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        tabIndex={-1}
      />

      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`glass absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl shadow-panel outline-none ${
          dragging ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }`}
        style={{ transform: `translate3d(0, ${dragOffset}px, 0)` }}
      >
        {/* Drag handle: the only element that consumes pointer events, so the
            sheet body scrolls normally underneath it. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pb-2 pt-2.5 active:cursor-grabbing"
          role="presentation"
        >
          <span className="h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        </div>

        <header className="flex shrink-0 items-start gap-3 px-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h2>
            {badge && <div className="mt-1.5">{badge}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-ink-muted transition hover:text-ink active:scale-95"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <div className={`scroll-thin safe-bottom min-h-0 flex-1 overflow-y-auto px-4 pb-4 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
