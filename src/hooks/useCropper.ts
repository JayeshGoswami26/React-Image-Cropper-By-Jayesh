'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Bounds,
  CropArea,
  CropperMode,
  CropResult,
  CropShape,
  OutputType,
  Point,
} from '../types';
import { isBrowser, useIsomorphicLayoutEffect } from '../utils/ssr';
import {
  computeCoverScale,
  computeFitScale,
  computeFrameRect,
  computeImageBounds,
  drawImageToCanvas,
} from '../utils/canvasHelpers';
import {
  applyAspectRatio,
  centerCrop,
  clamp,
  clampCropToImage,
  clampPanOffset,
} from '../utils/cropMath';
import { getCroppedImage as getCroppedImageUtil } from '../utils/imageExport';
import { useImageLoader, type ImageSource } from './useImageLoader';
import { useWheelZoom } from './useWheelZoom';
import { usePinchZoom } from './usePinchZoom';
import { useDragPan } from './useDragPan';

export interface UseCropperOptions {
  src?: ImageSource;
  /**
   * `'crop-box'` (default) fixes the image and moves a resizable crop box over
   * it. `'image'` fixes the crop frame and pans/zooms the image underneath.
   */
  mode?: CropperMode;
  aspectRatio?: number;
  cropShape?: CropShape;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  initialRotation?: number;
  minCropWidth?: number;
  minCropHeight?: number;
  /** fraction of the container the fixed frame occupies in `'image'` mode */
  frameFill?: number;
  /** zoom on wheel / trackpad scroll */
  wheelZoom?: boolean;
  /** two-finger pinch-to-zoom on touch */
  pinchZoom?: boolean;
  outputType?: OutputType;
  outputQuality?: number;
  /** exact output width in px; height follows the crop ratio unless also given */
  outputWidth?: number;
  /** exact output height in px; width follows the crop ratio unless also given */
  outputHeight?: number;
}

export interface CropperGeometry {
  /** base scale before zoom: "contain" in crop-box mode, "cover" in image mode */
  fitScale: number;
  displayScale: number;
  displayWidth: number;
  displayHeight: number;
  bounds: Bounds;
  /** the fixed crop frame in image mode; equals `bounds` in crop-box mode */
  frame: Bounds;
}

export interface UseCropperReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  state: {
    image: HTMLImageElement | null;
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    zoom: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    cropArea: CropArea;
    offset: Point;
  };
  status: ReturnType<typeof useImageLoader>['status'];
  error: ReturnType<typeof useImageLoader>['error'];
  bounds: Bounds;
  geometry: CropperGeometry;
  containerSize: { width: number; height: number };
  mode: CropperMode;
  cropShape: CropShape;
  aspectRatio: number | undefined;
  minCropWidth: number;
  minCropHeight: number;
  // crop
  cropArea: CropArea;
  setCropArea: (updater: CropArea | ((prev: CropArea) => CropArea)) => void;
  // zoom
  setZoom: (n: number) => void;
  /** multiply the zoom, optionally keeping `focal` (container px) stationary */
  zoomBy: (factor: number, focal?: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  minZoom: number;
  maxZoom: number;
  // pan (image mode)
  offset: Point;
  setOffset: (next: Point) => void;
  panBy: (dx: number, dy: number) => void;
  // rotate / flip
  rotate: (deg: number) => void;
  setRotation: (deg: number) => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  // aspect
  setAspectRatio: (n: number | undefined) => void;
  // lifecycle
  reset: () => void;
  loadImage: (fileOrUrl: ImageSource) => void;
  getCroppedImage: () => Promise<CropResult>;
}

const ZOOM_STEP = 0.2;
const ORIGIN: Point = { x: 0, y: 0 };

interface GeometryInput {
  naturalWidth: number;
  naturalHeight: number;
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  rotation: number;
  mode: CropperMode;
  aspectRatio: number | undefined;
  frameFill: number;
}

function geometryFor(input: GeometryInput): CropperGeometry {
  const {
    naturalWidth,
    naturalHeight,
    containerWidth,
    containerHeight,
    zoom,
    rotation,
    mode,
    aspectRatio,
    frameFill,
  } = input;

  if (mode === 'image') {
    const frame = computeFrameRect(containerWidth, containerHeight, aspectRatio, frameFill);
    const fitScale = computeCoverScale(
      naturalWidth,
      naturalHeight,
      frame.width,
      frame.height,
      rotation,
    );
    const displayScale = fitScale * zoom;
    return {
      fitScale,
      displayScale,
      displayWidth: naturalWidth * displayScale,
      displayHeight: naturalHeight * displayScale,
      bounds: frame,
      frame,
    };
  }

  const fitScale = computeFitScale(naturalWidth, naturalHeight, containerWidth, containerHeight);
  const displayScale = fitScale * zoom;
  const displayWidth = naturalWidth * displayScale;
  const displayHeight = naturalHeight * displayScale;
  const bounds = computeImageBounds(displayWidth, displayHeight, containerWidth, containerHeight);
  return { fitScale, displayScale, displayWidth, displayHeight, bounds, frame: bounds };
}

function normalizeDegrees(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

function sameRect(a: CropArea, b: Bounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function useCropper(options: UseCropperOptions = {}): UseCropperReturn {
  const {
    src,
    mode = 'crop-box',
    aspectRatio: aspectRatioOption,
    cropShape = 'rect',
    minZoom = 1,
    maxZoom = 4,
    initialZoom = 1,
    initialRotation = 0,
    minCropWidth = 20,
    minCropHeight = 20,
    frameFill = 0.9,
    wheelZoom = true,
    pinchZoom = true,
    outputType = 'image/png',
    outputQuality = 0.92,
    outputWidth,
    outputHeight,
  } = options;

  // Zooming below 1 in image mode would uncover the fixed frame.
  const effectiveMinZoom = mode === 'image' ? Math.max(1, minZoom) : minZoom;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [internalSource, setInternalSource] = useState<ImageSource>(src);
  const { image, status, error } = useImageLoader(internalSource);

  const [zoom, setZoomState] = useState(clamp(initialZoom, effectiveMinZoom, maxZoom));
  const [rotation, setRotationState] = useState(normalizeDegrees(initialRotation));
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [aspectRatio, setAspectRatioState] = useState<number | undefined>(aspectRatioOption);
  const [cropArea, setCropAreaState] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [offset, setOffsetState] = useState<Point>(ORIGIN);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // refs that mirror values needed inside imperative callbacks / observers
  const naturalRef = useRef({ w: 0, h: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const zoomRef = useRef(zoom);
  const rotationRef = useRef(rotation);
  const aspectRef = useRef(aspectRatio);
  const modeRef = useRef(mode);
  const frameFillRef = useRef(frameFill);
  const needsCenterRef = useRef(true);

  zoomRef.current = zoom;
  rotationRef.current = rotation;
  aspectRef.current = aspectRatio;
  modeRef.current = mode;
  frameFillRef.current = frameFill;
  // Keep the natural size in sync synchronously (during render) so the layout
  // draw effect, geometry, and crop math never read a stale/zero value — the
  // passive image effect runs too late for the first paint after a load.
  if (image && (naturalRef.current.w !== image.naturalWidth || naturalRef.current.h !== image.naturalHeight)) {
    naturalRef.current = { w: image.naturalWidth, h: image.naturalHeight };
  }

  // keep config src in sync with the internal source
  useEffect(() => {
    setInternalSource(src);
    needsCenterRef.current = true;
  }, [src]);

  const setCropArea = useCallback<UseCropperReturn['setCropArea']>((updater) => {
    setCropAreaState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  /** Current geometry straight from the refs — safe to call inside handlers. */
  const liveGeometry = useCallback((zoomValue: number, rotationValue: number) => {
    const { w, h } = naturalRef.current;
    const { width: cw, height: ch } = sizeRef.current;
    if (!w || !h || !cw || !ch) return null;
    return geometryFor({
      naturalWidth: w,
      naturalHeight: h,
      containerWidth: cw,
      containerHeight: ch,
      zoom: zoomValue,
      rotation: rotationValue,
      mode: modeRef.current,
      aspectRatio: aspectRef.current,
      frameFill: frameFillRef.current,
    });
  }, []);

  /** Constrain a pan offset so the image keeps covering the frame. */
  const clampOffsetFor = useCallback(
    (next: Point, zoomValue: number, rotationValue: number): Point => {
      if (modeRef.current !== 'image') return ORIGIN;
      const g = liveGeometry(zoomValue, rotationValue);
      if (!g) return next;
      return clampPanOffset(next, {
        displayWidth: g.displayWidth,
        displayHeight: g.displayHeight,
        frameWidth: g.frame.width,
        frameHeight: g.frame.height,
        rotation: rotationValue,
      });
    },
    [liveGeometry],
  );

  /** Recompute crop + offset after a geometry change (resize / zoom / ratio / load). */
  const reclampCrop = useCallback(() => {
    const g = liveGeometry(zoomRef.current, rotationRef.current);
    if (!g) return;

    if (modeRef.current === 'image') {
      // The crop *is* the frame; only the image moves.
      needsCenterRef.current = false;
      setCropAreaState((prev) => (sameRect(prev, g.frame) ? prev : { ...g.frame }));
      setOffsetState((prev) => {
        const next = clampOffsetFor(prev, zoomRef.current, rotationRef.current);
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
      return;
    }

    setCropAreaState((prev) => {
      if (needsCenterRef.current || prev.width === 0 || prev.height === 0) {
        needsCenterRef.current = false;
        return centerCrop(g.bounds, aspectRef.current);
      }
      const next = aspectRef.current
        ? applyAspectRatio(prev, aspectRef.current, 'center')
        : prev;
      return clampCropToImage(next, g.bounds);
    });
  }, [liveGeometry, clampOffsetFor]);

  // measure the container with a ResizeObserver
  useIsomorphicLayoutEffect(() => {
    if (!isBrowser) return;
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const size = { width: rect.width, height: rect.height };
      sizeRef.current = size;
      setContainerSize(size);
      reclampCrop();
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // `image` is intentional: the container only mounts once an image exists
    // (the dropzone is shown otherwise), so re-run to attach + measure it then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reclampCrop, image]);

  // when a new image loads, recenter the crop (natural size is set in render)
  useEffect(() => {
    if (!image) return;
    needsCenterRef.current = true;
    setOffsetState(ORIGIN);
    reclampCrop();
  }, [image, reclampCrop]);

  // switching mode / frame size changes what the crop and offset mean
  useEffect(() => {
    needsCenterRef.current = true;
    setOffsetState(ORIGIN);
    reclampCrop();
  }, [mode, frameFill, reclampCrop]);

  // draw the image whenever anything visual changes
  useIsomorphicLayoutEffect(() => {
    if (!isBrowser) return;
    const canvas = canvasRef.current;
    const { width: cw, height: ch } = sizeRef.current;
    if (!canvas || !image || !cw || !ch) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const g = liveGeometry(zoom, rotation);
    if (!g) return;

    drawImageToCanvas(ctx, image, {
      canvasWidth: cw,
      canvasHeight: ch,
      displayWidth: g.displayWidth,
      displayHeight: g.displayHeight,
      rotation,
      flipX,
      flipY,
      offsetX: offset.x,
      offsetY: offset.y,
      dpr,
    });
  }, [
    image,
    zoom,
    rotation,
    flipX,
    flipY,
    offset.x,
    offset.y,
    containerSize.width,
    containerSize.height,
    liveGeometry,
    mode,
    aspectRatio,
    frameFill,
  ]);

  // ---- public actions ------------------------------------------------------
  const applyZoom = useCallback(
    (value: number, focal?: Point) => {
      const prevZoom = zoomRef.current;
      const next = clamp(value, effectiveMinZoom, maxZoom);
      if (next === prevZoom) return;
      zoomRef.current = next;
      setZoomState(next);

      if (modeRef.current === 'image') {
        const ratio = next / prevZoom;
        const { width: cw, height: ch } = sizeRef.current;
        const cx = cw / 2;
        const cy = ch / 2;
        const px = focal?.x ?? cx;
        const py = focal?.y ?? cy;
        setOffsetState((prev) => {
          // Hold the image point under the focal point still: it sits at
          // `center + offset + v`, and v scales with the zoom.
          const vx = px - cx - prev.x;
          const vy = py - cy - prev.y;
          return clampOffsetFor(
            { x: prev.x + (1 - ratio) * vx, y: prev.y + (1 - ratio) * vy },
            next,
            rotationRef.current,
          );
        });
      }

      reclampCrop();
    },
    [effectiveMinZoom, maxZoom, reclampCrop, clampOffsetFor],
  );

  const setZoom = useCallback((n: number) => applyZoom(n), [applyZoom]);
  const zoomBy = useCallback(
    (factor: number, focal?: Point) => applyZoom(zoomRef.current * factor, focal),
    [applyZoom],
  );
  const zoomIn = useCallback(() => applyZoom(zoomRef.current + ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current - ZOOM_STEP), [applyZoom]);

  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (modeRef.current !== 'image') return;
      setOffsetState((prev) =>
        clampOffsetFor({ x: prev.x + dx, y: prev.y + dy }, zoomRef.current, rotationRef.current),
      );
    },
    [clampOffsetFor],
  );

  const setOffset = useCallback(
    (next: Point) => {
      setOffsetState(clampOffsetFor(next, zoomRef.current, rotationRef.current));
    },
    [clampOffsetFor],
  );

  const setRotation = useCallback(
    (deg: number) => {
      const next = normalizeDegrees(deg);
      rotationRef.current = next;
      setRotationState(next);
      // In image mode the cover scale depends on the angle, so the offset
      // limits move with it.
      reclampCrop();
    },
    [reclampCrop],
  );

  const rotate = useCallback(
    (deg: number) => setRotation(rotationRef.current + deg),
    [setRotation],
  );

  const flipHorizontal = useCallback(() => setFlipX((v) => !v), []);
  const flipVertical = useCallback(() => setFlipY((v) => !v), []);

  const setAspectRatio = useCallback(
    (n: number | undefined) => {
      aspectRef.current = n;
      setAspectRatioState(n);
      needsCenterRef.current = true;
      setOffsetState(ORIGIN);
      reclampCrop();
    },
    [reclampCrop],
  );

  const reset = useCallback(() => {
    const z = clamp(initialZoom, effectiveMinZoom, maxZoom);
    zoomRef.current = z;
    rotationRef.current = normalizeDegrees(initialRotation);
    aspectRef.current = aspectRatioOption;
    setZoomState(z);
    setRotationState(rotationRef.current);
    setFlipX(false);
    setFlipY(false);
    setAspectRatioState(aspectRatioOption);
    setOffsetState(ORIGIN);
    needsCenterRef.current = true;
    reclampCrop();
  }, [initialZoom, initialRotation, aspectRatioOption, effectiveMinZoom, maxZoom, reclampCrop]);

  const loadImage = useCallback((fileOrUrl: ImageSource) => {
    needsCenterRef.current = true;
    setInternalSource(fileOrUrl);
  }, []);

  const getCroppedImage = useCallback(async (): Promise<CropResult> => {
    if (!image) {
      throw { code: 'NO_IMAGE', message: 'No image loaded to crop.' };
    }
    const { w, h } = naturalRef.current;
    const { width: cw, height: ch } = sizeRef.current;
    const g = liveGeometry(zoom, rotation);
    return getCroppedImageUtil({
      image,
      naturalWidth: w,
      naturalHeight: h,
      cropArea,
      containerWidth: cw,
      containerHeight: ch,
      displayScale: g?.displayScale ?? 1,
      rotation,
      flipX,
      flipY,
      offsetX: offset.x,
      offsetY: offset.y,
      cropShape,
      outputType,
      outputQuality,
      outputWidth,
      outputHeight,
    });
  }, [
    image,
    zoom,
    rotation,
    flipX,
    flipY,
    offset.x,
    offset.y,
    cropArea,
    cropShape,
    outputType,
    outputQuality,
    outputWidth,
    outputHeight,
    liveGeometry,
  ]);

  // ---- gestures ------------------------------------------------------------
  // `disabled` doubles as the re-attach trigger: the container only mounts once
  // an image exists, and these flip false in the same commit that mounts it.
  useWheelZoom(containerRef, {
    disabled: !image || !wheelZoom,
    onZoom: useCallback(
      ({ factor, x, y }: { factor: number; x: number; y: number }) => zoomBy(factor, { x, y }),
      [zoomBy],
    ),
  });

  usePinchZoom(containerRef, {
    disabled: !image || !pinchZoom,
    onPinch: useCallback(
      ({ factor, x, y }: { factor: number; x: number; y: number }) => zoomBy(factor, { x, y }),
      [zoomBy],
    ),
  });

  useDragPan(containerRef, {
    disabled: !image || mode !== 'image',
    onPan: useCallback(({ dx, dy }: { dx: number; dy: number }) => panBy(dx, dy), [panBy]),
  });

  const geometry = useMemo(
    () =>
      geometryFor({
        naturalWidth: naturalRef.current.w,
        naturalHeight: naturalRef.current.h,
        containerWidth: containerSize.width,
        containerHeight: containerSize.height,
        zoom,
        rotation,
        mode,
        aspectRatio,
        frameFill,
      }),
    // `image` is intentional: natural size lives in naturalRef (non-reactive),
    // so recompute geometry once the loaded image changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [containerSize.width, containerSize.height, zoom, rotation, mode, aspectRatio, frameFill, image],
  );

  const state = useMemo(
    () => ({
      image,
      naturalWidth: naturalRef.current.w,
      naturalHeight: naturalRef.current.h,
      displayWidth: geometry.displayWidth,
      displayHeight: geometry.displayHeight,
      zoom,
      rotation,
      flipX,
      flipY,
      cropArea,
      offset,
    }),
    [
      image,
      geometry.displayWidth,
      geometry.displayHeight,
      zoom,
      rotation,
      flipX,
      flipY,
      cropArea,
      offset,
    ],
  );

  return {
    canvasRef,
    containerRef,
    state,
    status,
    error,
    bounds: geometry.bounds,
    geometry,
    containerSize,
    mode,
    cropShape,
    aspectRatio,
    minCropWidth,
    minCropHeight,
    cropArea,
    setCropArea,
    setZoom,
    zoomBy,
    zoomIn,
    zoomOut,
    minZoom: effectiveMinZoom,
    maxZoom,
    offset,
    setOffset,
    panBy,
    rotate,
    setRotation,
    flipHorizontal,
    flipVertical,
    setAspectRatio,
    reset,
    loadImage,
    getCroppedImage,
  };
}
