'use client';

import { forwardRef, type CSSProperties } from 'react';
import type { Bounds, CropArea, CropperMode, CropShape } from '../types';
import { CropOverlay } from './CropOverlay';
import { useTheme } from '../theme/useTheme';

export interface CropperCanvasProps {
  /** ref to attach to the wrapper container (from useCropper) */
  containerRef: React.RefObject<HTMLDivElement>;
  /** ref to attach to the <canvas> (from useCropper) */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cropArea: CropArea;
  bounds: Bounds;
  containerSize: { width: number; height: number };
  /** `'image'` fixes the frame and lets the image be dragged underneath it */
  mode?: CropperMode;
  cropShape?: CropShape;
  aspectRatio?: number;
  minCropWidth?: number;
  minCropHeight?: number;
  showGrid?: boolean;
  showHandles?: boolean;
  showOverlay?: boolean;
  disabled?: boolean;
  onCropChange?: (next: CropArea) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The crop surface: a `<canvas>` that renders the image (zoom/rotate/flip) with
 * an accessible DOM `<CropOverlay>` on top. Headless-friendly — drive it with
 * the `useCropper` hook, or wire your own state.
 */
export const CropperCanvas = forwardRef<HTMLDivElement, CropperCanvasProps>(
  function CropperCanvas(props, _ref) {
    const {
      containerRef,
      canvasRef,
      cropArea,
      bounds,
      containerSize,
      mode = 'crop-box',
      cropShape = 'rect',
      aspectRatio,
      minCropWidth = 20,
      minCropHeight = 20,
      showGrid = true,
      showHandles = true,
      showOverlay = true,
      disabled = false,
      onCropChange,
      className,
      style,
    } = props;
    const theme = useTheme();
    const isImageMode = mode === 'image';

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: theme.background,
          borderRadius: theme.borderRadius,
          touchAction: 'none',
          userSelect: 'none',
          cursor: isImageMode && !disabled ? 'grab' : undefined,
          ...style,
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block' }} />
        {showOverlay && cropArea.width > 0 && cropArea.height > 0 && (
          <CropOverlay
            cropArea={cropArea}
            bounds={bounds}
            containerSize={containerSize}
            cropShape={cropShape}
            aspectRatio={aspectRatio}
            minCropWidth={minCropWidth}
            minCropHeight={minCropHeight}
            showGrid={showGrid}
            showHandles={showHandles}
            interactive={!isImageMode}
            disabled={disabled}
            onChange={(next) => onCropChange?.(next)}
          />
        )}
      </div>
    );
  },
);
