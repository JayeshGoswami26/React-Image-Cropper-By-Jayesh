'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { isBrowser } from '../utils/ssr';

export interface PanEvent {
  /** movement since the previous pan event, in CSS px */
  dx: number;
  dy: number;
}

export interface UseDragPanOptions {
  disabled?: boolean;
  onPan: (e: PanEvent) => void;
  onPanStart?: () => void;
  onPanEnd?: () => void;
}

/**
 * Drag an element's contents with mouse, pen, or a single finger, reporting
 * **incremental** deltas (unlike `usePointerDrag`, which reports the total
 * offset from the drag start and returns props to spread).
 *
 * Attaches natively to `ref` so headless consumers get panning without having
 * to wire a handler onto their own container. A `pointercancel` on `window`
 * ends the drag, which is how `usePinchZoom` hands off when a second finger
 * lands mid-pan.
 */
export function useDragPan(ref: RefObject<HTMLElement>, options: UseDragPanOptions): void {
  const { disabled = false, onPan, onPanStart, onPanEnd } = options;

  const handlers = useRef({ onPan, onPanStart, onPanEnd });
  handlers.current = { onPan, onPanStart, onPanEnd };

  useEffect(() => {
    if (!isBrowser || disabled) return;
    const el = ref.current;
    if (!el) return;

    let pointerId: number | null = null;
    let last = { x: 0, y: 0 };

    const stop = () => {
      if (pointerId === null) return;
      pointerId = null;
      handlers.current.onPanEnd?.();
    };

    const handleDown = (event: PointerEvent) => {
      if (pointerId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;

      event.preventDefault();
      pointerId = event.pointerId;
      last = { x: event.clientX, y: event.clientY };
      handlers.current.onPanStart?.();
    };

    const handleMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      event.preventDefault();
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      if (dx || dy) handlers.current.onPan({ dx, dy });
    };

    const handleUp = (event: PointerEvent) => {
      // A bare `pointercancel` from usePinchZoom carries no id — always stop.
      if (event.pointerId !== undefined && event.pointerId !== pointerId) return;
      stop();
    };

    el.addEventListener('pointerdown', handleDown);
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      el.removeEventListener('pointerdown', handleDown);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      stop();
    };
  }, [ref, disabled]);
}
