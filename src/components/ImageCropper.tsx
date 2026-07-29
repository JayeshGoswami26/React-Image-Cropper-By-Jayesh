'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type {
  AcceptedMime,
  AspectRatioOption,
  CropArea,
  CropperError,
  CropperMode,
  CropperTheme,
  CropResult,
  CropShape,
  OutputType,
} from '../types';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useCropper } from '../hooks/useCropper';
import { CropperCanvas } from './CropperCanvas';
import { CropperControls } from './CropperControls';
import { ImageDropzone } from './ImageDropzone';

export interface ImageCropperProps {
  // --- image source ---
  src?: string;
  // --- crop config ---
  /**
   * `'crop-box'` (default) fixes the image and moves a resizable crop box over
   * it. `'image'` fixes the crop frame and pans/zooms the image underneath,
   * the way avatar and cover-photo pickers work.
   */
  mode?: CropperMode;
  aspectRatio?: number;
  aspectRatioOptions?: AspectRatioOption[];
  cropShape?: CropShape;
  minCropWidth?: number;
  minCropHeight?: number;
  initialZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  /** initial rotation in degrees */
  rotation?: number;
  /** fraction of the surface the fixed frame occupies in `'image'` mode */
  frameFill?: number;
  // --- gestures ---
  /** zoom on wheel / trackpad scroll */
  wheelZoom?: boolean;
  /** two-finger pinch-to-zoom on touch */
  pinchZoom?: boolean;
  // --- dropzone ---
  showDropzone?: boolean;
  accept?: AcceptedMime[];
  maxSizeMB?: number;
  // --- output ---
  outputType?: OutputType;
  outputQuality?: number;
  /** exact output width in px; height follows the crop ratio unless also given */
  outputWidth?: number;
  /** exact output height in px; width follows the crop ratio unless also given */
  outputHeight?: number;
  // --- theming ---
  theme?: Partial<CropperTheme>;
  // --- ui toggles ---
  showGrid?: boolean;
  showControls?: boolean;
  /** height of the crop surface (px or any CSS length) */
  height?: number | string;
  // --- callbacks ---
  onImageLoad?: (img: HTMLImageElement) => void;
  onCropChange?: (cropArea: CropArea) => void;
  onComplete?: (result: CropResult) => void;
  onError?: (err: CropperError) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * The batteries-included image cropper: dropzone + canvas + overlay + controls,
 * themed and SSR-safe. Manages its own state; bridge it to your app via the
 * callback props (`onComplete` gives you a ready-to-upload `CropResult`).
 */
export function ImageCropper({
  src,
  mode = 'crop-box',
  aspectRatio,
  aspectRatioOptions,
  cropShape = 'rect',
  minCropWidth = 20,
  minCropHeight = 20,
  initialZoom = 1,
  minZoom = 1,
  maxZoom = 4,
  rotation = 0,
  frameFill = 0.9,
  wheelZoom = true,
  pinchZoom = true,
  showDropzone = true,
  accept = ['image/png', 'image/jpeg', 'image/webp'],
  maxSizeMB = 10,
  outputType = 'image/png',
  outputQuality = 0.92,
  outputWidth,
  outputHeight,
  theme,
  showGrid = true,
  showControls = true,
  height = 400,
  onImageLoad,
  onCropChange,
  onComplete,
  onError,
  className,
  style,
}: ImageCropperProps) {
  const cropper = useCropper({
    src,
    mode,
    aspectRatio,
    cropShape,
    minZoom,
    maxZoom,
    initialZoom,
    initialRotation: rotation,
    minCropWidth,
    minCropHeight,
    frameFill,
    wheelZoom,
    pinchZoom,
    outputType,
    outputQuality,
    outputWidth,
    outputHeight,
  });

  const [busy, setBusy] = useState(false);
  const lastLoadedRef = useRef<HTMLImageElement | null>(null);

  const hasImage = !!cropper.state.image;

  // bridge: image loaded
  useEffect(() => {
    const img = cropper.state.image;
    if (img && img !== lastLoadedRef.current) {
      lastLoadedRef.current = img;
      onImageLoad?.(img);
    }
  }, [cropper.state.image, onImageLoad]);

  // bridge: load errors
  useEffect(() => {
    if (cropper.error) onError?.(cropper.error);
  }, [cropper.error, onError]);

  const handleCropChange = useCallback(
    (next: CropArea) => {
      cropper.setCropArea(next);
      onCropChange?.(next);
    },
    [cropper, onCropChange],
  );

  const handleCrop = useCallback(async () => {
    if (!hasImage) {
      onError?.({ code: 'NO_IMAGE', message: 'No image loaded to crop.' });
      return;
    }
    setBusy(true);
    try {
      const result = await cropper.getCroppedImage();
      onComplete?.(result);
    } catch (e) {
      const err = e as CropperError;
      onError?.(err?.code ? err : { code: 'EXPORT_FAILED', message: 'Failed to crop the image.' });
    } finally {
      setBusy(false);
    }
  }, [hasImage, cropper, onComplete, onError]);

  const surfaceStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height,
  };

  return (
    <ThemeProvider
      theme={theme}
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', ...style }}
    >
      {!hasImage && showDropzone ? (
        <ImageDropzone
          accept={accept}
          maxSizeMB={maxSizeMB}
          onFiles={(files) => cropper.loadImage(files[0])}
          onError={onError}
          style={{ height }}
        />
      ) : (
        <div style={surfaceStyle}>
          <CropperCanvas
            containerRef={cropper.containerRef}
            canvasRef={cropper.canvasRef}
            cropArea={cropper.cropArea}
            bounds={cropper.bounds}
            containerSize={cropper.containerSize}
            mode={mode}
            cropShape={cropShape}
            aspectRatio={cropper.aspectRatio}
            minCropWidth={minCropWidth}
            minCropHeight={minCropHeight}
            showGrid={showGrid}
            disabled={!hasImage}
            onCropChange={handleCropChange}
          />
        </div>
      )}

      {showControls && hasImage && (
        <CropperControls
          zoom={cropper.state.zoom}
          minZoom={cropper.minZoom}
          maxZoom={cropper.maxZoom}
          rotation={cropper.state.rotation}
          flipX={cropper.state.flipX}
          flipY={cropper.state.flipY}
          aspectRatio={cropper.aspectRatio}
          aspectRatioOptions={aspectRatioOptions}
          disabled={!hasImage}
          busy={busy}
          onZoom={cropper.setZoom}
          onZoomIn={cropper.zoomIn}
          onZoomOut={cropper.zoomOut}
          onRotate={cropper.rotate}
          onSetRotation={cropper.setRotation}
          onFlipHorizontal={cropper.flipHorizontal}
          onFlipVertical={cropper.flipVertical}
          onAspectRatio={cropper.setAspectRatio}
          onReset={cropper.reset}
          onCrop={handleCrop}
        />
      )}
    </ThemeProvider>
  );
}
