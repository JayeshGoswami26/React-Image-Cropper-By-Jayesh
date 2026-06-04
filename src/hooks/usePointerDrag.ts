'use client';

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export interface DragState {
  /** total delta since drag start, in client px */
  dx: number;
  dy: number;
  /** current client coordinates */
  x: number;
  y: number;
  event: PointerEvent | ReactPointerEvent;
}

export interface UsePointerDragOptions {
  onStart?: (state: { x: number; y: number; event: ReactPointerEvent }) => void;
  onMove?: (state: DragState) => void;
  onEnd?: (state: { dx: number; dy: number }) => void;
  /** disable the interaction entirely */
  disabled?: boolean;
}

/**
 * Unified mouse + touch dragging via Pointer Events. Uses `setPointerCapture`
 * so a drag keeps tracking even if the pointer leaves the element. Returns an
 * `onPointerDown` handler to spread onto the draggable surface; pair it with
 * `touch-action: none` so touch drags don't scroll the page.
 */
export function usePointerDrag(options: UsePointerDragOptions) {
  const { onStart, onMove, onEnd, disabled } = options;
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lastRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled) return;
      // Only react to the primary button for mouse.
      if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        /* setPointerCapture can throw in some test/jsdom envs — ignore */
      }

      const startX = event.clientX;
      const startY = event.clientY;
      startRef.current = { x: startX, y: startY };
      lastRef.current = { dx: 0, dy: 0 };
      onStart?.({ x: startX, y: startY, event });

      const handleMove = (e: PointerEvent) => {
        if (!startRef.current) return;
        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;
        lastRef.current = { dx, dy };
        onMove?.({ dx, dy, x: e.clientX, y: e.clientY, event: e });
      };

      const handleUp = () => {
        startRef.current = null;
        onEnd?.({ ...lastRef.current });
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [disabled, onStart, onMove, onEnd],
  );

  return { onPointerDown: handlePointerDown };
}
