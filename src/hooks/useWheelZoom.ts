'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { isBrowser } from '../utils/ssr';

export interface WheelZoomEvent {
  /** multiplicative zoom factor for this notch (>1 zooms in) */
  factor: number;
  /** pointer position relative to the element's top-left, in CSS px */
  x: number;
  y: number;
  event: WheelEvent;
}

export interface UseWheelZoomOptions {
  disabled?: boolean;
  /**
   * Exponent applied per normalized wheel pixel. Higher = faster zoom.
   * A typical mouse notch is ~100px, so 0.002 gives ~18% per notch.
   */
  sensitivity?: number;
  /** only zoom while Ctrl/Cmd is held (leaves plain scrolling to the page) */
  requireModifier?: boolean;
  onZoom: (e: WheelZoomEvent) => void;
}

/** Wheel deltas arrive in px, lines, or pages — normalize everything to px. */
function normalizeDelta(event: WheelEvent): number {
  const { deltaY, deltaMode } = event;
  if (deltaMode === 1) return deltaY * 16; // DOM_DELTA_LINE
  if (deltaMode === 2) return deltaY * 100; // DOM_DELTA_PAGE
  return deltaY;
}

/**
 * Zoom an element on wheel / trackpad scroll.
 *
 * Attached natively rather than through React's `onWheel`: React registers
 * wheel listeners passively at the root, so `preventDefault` there is a no-op
 * and the page would scroll behind the cropper.
 */
export function useWheelZoom(
  ref: RefObject<HTMLElement>,
  options: UseWheelZoomOptions,
): void {
  const { disabled = false, sensitivity = 0.002, requireModifier = false, onZoom } = options;

  // Keep the latest callback without re-attaching the listener each render.
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  useEffect(() => {
    if (!isBrowser || disabled) return;
    const el = ref.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (requireModifier && !event.ctrlKey && !event.metaKey) return;

      const delta = normalizeDelta(event);
      // Let purely horizontal scrolls through rather than swallowing them.
      if (!delta) return;
      event.preventDefault();

      const rect = el.getBoundingClientRect();
      onZoomRef.current({
        factor: Math.exp(-delta * sensitivity),
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        event,
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [ref, disabled, sensitivity, requireModifier]);
}
