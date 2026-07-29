'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { isBrowser } from '../utils/ssr';

export interface PinchZoomEvent {
  /** multiplicative zoom factor since the previous pinch event (>1 zooms in) */
  factor: number;
  /** midpoint between the two fingers, relative to the element's top-left */
  x: number;
  y: number;
}

export interface UsePinchZoomOptions {
  disabled?: boolean;
  onPinch: (e: PinchZoomEvent) => void;
  onPinchStart?: () => void;
  onPinchEnd?: () => void;
}

interface PointerPos {
  x: number;
  y: number;
}

function distance(a: PointerPos, b: PointerPos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Two-finger pinch-to-zoom on a touch surface.
 *
 * `pointerdown` is listened for in the **capture** phase so the gesture is seen
 * even when it starts on top of a child that calls `stopPropagation` (the crop
 * box and its handles do). When the second finger lands, a `pointercancel` is
 * dispatched on `window` to end any single-pointer drag already in flight —
 * `usePointerDrag` listens for exactly that — so a pinch never also drags the
 * crop box.
 */
export function usePinchZoom(ref: RefObject<HTMLElement>, options: UsePinchZoomOptions): void {
  const { disabled = false, onPinch, onPinchStart, onPinchEnd } = options;

  const handlers = useRef({ onPinch, onPinchStart, onPinchEnd });
  handlers.current = { onPinch, onPinchStart, onPinchEnd };

  useEffect(() => {
    if (!isBrowser || disabled) return;
    const el = ref.current;
    if (!el) return;

    const pointers = new Map<number, PointerPos>();
    let lastDistance = 0;
    let pinching = false;

    const activePair = (): [PointerPos, PointerPos] | null => {
      const values = Array.from(pointers.values());
      return values.length >= 2 ? [values[0], values[1]] : null;
    };

    const endPinch = () => {
      if (!pinching) return;
      pinching = false;
      lastDistance = 0;
      handlers.current.onPinchEnd?.();
    };

    const handleDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const pair = activePair();
      if (!pair || pinching) return;

      pinching = true;
      lastDistance = distance(pair[0], pair[1]);
      // Abort any crop drag started by the first finger.
      window.dispatchEvent(new Event('pointercancel'));
      handlers.current.onPinchStart?.();
    };

    const handleMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinching) return;

      const pair = activePair();
      if (!pair) return;

      const next = distance(pair[0], pair[1]);
      if (!next || !lastDistance) return;

      event.preventDefault();
      const rect = el.getBoundingClientRect();
      handlers.current.onPinch({
        factor: next / lastDistance,
        x: (pair[0].x + pair[1].x) / 2 - rect.left,
        y: (pair[0].y + pair[1].y) / 2 - rect.top,
      });
      lastDistance = next;
    };

    const handleUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) {
        endPinch();
        return;
      }
      // Still pinching, but with a different pair — re-baseline so the next
      // move reports a delta rather than a jump.
      const pair = activePair();
      if (pinching && pair) lastDistance = distance(pair[0], pair[1]);
    };

    el.addEventListener('pointerdown', handleDown, true);
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      el.removeEventListener('pointerdown', handleDown, true);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      endPinch();
    };
  }, [ref, disabled]);
}
