'use client';

import { useCallback, useId, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { Bounds, CropArea, CropHandle, CropShape } from '../types';
import { resizeFromHandle } from '../utils/cropMath';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { useTheme } from '../theme/useTheme';

export interface CropOverlayProps {
  cropArea: CropArea;
  bounds: Bounds;
  containerSize: { width: number; height: number };
  cropShape: CropShape;
  aspectRatio?: number;
  minCropWidth: number;
  minCropHeight: number;
  showGrid?: boolean;
  showHandles?: boolean;
  disabled?: boolean;
  onChange: (next: CropArea) => void;
}

const RESIZE_HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_LABELS: Record<CropHandle, string> = {
  nw: 'top-left',
  n: 'top',
  ne: 'top-right',
  e: 'right',
  se: 'bottom-right',
  s: 'bottom',
  sw: 'bottom-left',
  w: 'left',
  move: 'crop region',
};

const HANDLE_POSITION: Record<Exclude<CropHandle, 'move'>, CSSProperties> = {
  nw: { top: 0, left: 0, cursor: 'nwse-resize' },
  n: { top: 0, left: '50%', cursor: 'ns-resize' },
  ne: { top: 0, left: '100%', cursor: 'nesw-resize' },
  e: { top: '50%', left: '100%', cursor: 'ew-resize' },
  se: { top: '100%', left: '100%', cursor: 'nwse-resize' },
  s: { top: '100%', left: '50%', cursor: 'ns-resize' },
  sw: { top: '100%', left: 0, cursor: 'nesw-resize' },
  w: { top: '50%', left: 0, cursor: 'ew-resize' },
};

function keyDelta(e: KeyboardEvent): { dx: number; dy: number } | null {
  const step = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return null;
  }
}

interface HandleProps {
  handle: CropHandle;
  cropRef: React.MutableRefObject<CropArea>;
  disabled?: boolean;
  onResize: (handle: CropHandle, startCrop: CropArea, dx: number, dy: number) => void;
  style: CSSProperties;
}

function Handle({ handle, cropRef, disabled, onResize, style }: HandleProps) {
  const theme = useTheme();
  const startRef = useRef<CropArea>(cropRef.current);

  const { onPointerDown } = usePointerDrag({
    disabled,
    onStart: () => {
      startRef.current = cropRef.current;
    },
    onMove: ({ dx, dy }) => onResize(handle, startRef.current, dx, dy),
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    const d = keyDelta(e);
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    onResize(handle, cropRef.current, d.dx, d.dy);
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Resize crop ${HANDLE_LABELS[handle]}`}
      aria-valuenow={Math.round(handle === 'move' ? cropRef.current.x : cropRef.current.width)}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        width: 14,
        height: 14,
        transform: 'translate(-50%, -50%)',
        background: theme.handleColor,
        border: `2px solid ${theme.handleBorder}`,
        borderRadius: 4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        touchAction: 'none',
        outlineOffset: 2,
        ...style,
      }}
    />
  );
}

/**
 * Absolutely-positioned crop selection layer: dark mask (SVG cut-out), crop
 * border, optional rule-of-thirds grid, draggable body, and 8 resize handles.
 * Handles are keyboard-operable sliders (arrow keys nudge, Shift = 10px).
 */
export function CropOverlay({
  cropArea,
  bounds,
  containerSize,
  cropShape,
  aspectRatio,
  minCropWidth,
  minCropHeight,
  showGrid = true,
  showHandles = true,
  disabled = false,
  onChange,
}: CropOverlayProps) {
  const theme = useTheme();
  const maskId = useId().replace(/:/g, '');
  const cropRef = useRef<CropArea>(cropArea);
  cropRef.current = cropArea;
  const moveStartRef = useRef<CropArea>(cropArea);

  const applyResize = useCallback(
    (handle: CropHandle, startCrop: CropArea, dx: number, dy: number) => {
      const next = resizeFromHandle(handle, startCrop, dx, dy, {
        aspectRatio,
        minWidth: minCropWidth,
        minHeight: minCropHeight,
        bounds,
      });
      onChange(next);
    },
    [aspectRatio, minCropWidth, minCropHeight, bounds, onChange],
  );

  const { onPointerDown: onBodyPointerDown } = usePointerDrag({
    disabled,
    onStart: () => {
      moveStartRef.current = cropRef.current;
    },
    onMove: ({ dx, dy }) => applyResize('move', moveStartRef.current, dx, dy),
  });

  const onBodyKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    const d = keyDelta(e);
    if (!d) return;
    e.preventDefault();
    applyResize('move', cropRef.current, d.dx, d.dy);
  };

  const isRound = cropShape === 'round';
  const cx = cropArea.x + cropArea.width / 2;
  const cy = cropArea.y + cropArea.height / 2;

  const gridLine: CSSProperties = {
    position: 'absolute',
    background: theme.gridColor,
    pointerEvents: 'none',
  };

  return (
    <div
      aria-hidden={false}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {/* dark mask with crop cut-out */}
      <svg
        width={containerSize.width}
        height={containerSize.height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'block' }}
      >
        <defs>
          <mask id={`rc-mask-${maskId}`}>
            <rect width={containerSize.width} height={containerSize.height} fill="white" />
            {isRound ? (
              <ellipse cx={cx} cy={cy} rx={cropArea.width / 2} ry={cropArea.height / 2} fill="black" />
            ) : (
              <rect
                x={cropArea.x}
                y={cropArea.y}
                width={cropArea.width}
                height={cropArea.height}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width={containerSize.width}
          height={containerSize.height}
          fill={theme.overlay}
          mask={`url(#rc-mask-${maskId})`}
        />
      </svg>

      {/* crop box: border + grid + body drag + handles */}
      <div
        role="group"
        aria-label="Crop region. Drag to move; use the handles to resize."
        tabIndex={disabled ? -1 : 0}
        onPointerDown={onBodyPointerDown}
        onKeyDown={onBodyKeyDown}
        style={{
          position: 'absolute',
          left: cropArea.x,
          top: cropArea.y,
          width: cropArea.width,
          height: cropArea.height,
          border: `2px solid ${theme.primary}`,
          borderRadius: isRound ? '50%' : 0,
          boxSizing: 'border-box',
          cursor: disabled ? 'default' : 'move',
          pointerEvents: disabled ? 'none' : 'auto',
          touchAction: 'none',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
        }}
      >
        {showGrid && !isRound && (
          <>
            <div style={{ ...gridLine, left: '33.333%', top: 0, width: 1, height: '100%' }} />
            <div style={{ ...gridLine, left: '66.666%', top: 0, width: 1, height: '100%' }} />
            <div style={{ ...gridLine, top: '33.333%', left: 0, height: 1, width: '100%' }} />
            <div style={{ ...gridLine, top: '66.666%', left: 0, height: 1, width: '100%' }} />
          </>
        )}

        {showHandles &&
          RESIZE_HANDLES.map((handle) => (
            <Handle
              key={handle}
              handle={handle}
              cropRef={cropRef}
              disabled={disabled}
              onResize={applyResize}
              style={HANDLE_POSITION[handle as Exclude<CropHandle, 'move'>]}
            />
          ))}
      </div>
    </div>
  );
}
