'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Bounds, CropArea, CropResult, CropShape, OutputType } from '../types';
import { isBrowser, useIsomorphicLayoutEffect } from '../utils/ssr';
import {
  computeFitScale,
  computeImageBounds,
  drawImageToCanvas,
} from '../utils/canvasHelpers';
import { applyAspectRatio, centerCrop, clamp, clampCropToImage } from '../utils/cropMath';
import { getCroppedImage as getCroppedImageUtil } from '../utils/imageExport';
import { useImageLoader, type ImageSource } from './useImageLoader';

export interface UseCropperOptions {
  src?: ImageSource;
  aspectRatio?: number;
  cropShape?: CropShape;
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  initialRotation?: number;
  minCropWidth?: number;
  minCropHeight?: number;
  outputType?: OutputType;
  outputQuality?: number;
}

export interface CropperGeometry {
  fitScale: number;
  displayScale: number;
  displayWidth: number;
  displayHeight: number;
  bounds: Bounds;
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
  };
  status: ReturnType<typeof useImageLoader>['status'];
  error: ReturnType<typeof useImageLoader>['error'];
  bounds: Bounds;
  geometry: CropperGeometry;
  containerSize: { width: number; height: number };
  cropShape: CropShape;
  aspectRatio: number | undefined;
  minCropWidth: number;
  minCropHeight: number;
  // crop
  cropArea: CropArea;
  setCropArea: (updater: CropArea | ((prev: CropArea) => CropArea)) => void;
  // zoom
  setZoom: (n: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  minZoom: number;
  maxZoom: number;
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

function geometryFor(
  naturalW: number,
  naturalH: number,
  cw: number,
  ch: number,
  zoom: number,
): CropperGeometry {
  const fitScale = computeFitScale(naturalW, naturalH, cw, ch);
  const displayScale = fitScale * zoom;
  const displayWidth = naturalW * displayScale;
  const displayHeight = naturalH * displayScale;
  const bounds = computeImageBounds(displayWidth, displayHeight, cw, ch);
  return { fitScale, displayScale, displayWidth, displayHeight, bounds };
}

function normalizeDegrees(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

export function useCropper(options: UseCropperOptions = {}): UseCropperReturn {
  const {
    src,
    aspectRatio: aspectRatioOption,
    cropShape = 'rect',
    minZoom = 1,
    maxZoom = 4,
    initialZoom = 1,
    initialRotation = 0,
    minCropWidth = 20,
    minCropHeight = 20,
    outputType = 'image/png',
    outputQuality = 0.92,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [internalSource, setInternalSource] = useState<ImageSource>(src);
  const { image, status, error } = useImageLoader(internalSource);

  const [zoom, setZoomState] = useState(clamp(initialZoom, minZoom, maxZoom));
  const [rotation, setRotationState] = useState(normalizeDegrees(initialRotation));
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [aspectRatio, setAspectRatioState] = useState<number | undefined>(aspectRatioOption);
  const [cropArea, setCropAreaState] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // refs that mirror values needed inside imperative callbacks / observers
  const naturalRef = useRef({ w: 0, h: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });
  const zoomRef = useRef(zoom);
  const aspectRef = useRef(aspectRatio);
  const needsCenterRef = useRef(true);

  zoomRef.current = zoom;
  aspectRef.current = aspectRatio;

  // keep config src in sync with the internal source
  useEffect(() => {
    setInternalSource(src);
    needsCenterRef.current = true;
  }, [src]);

  const setCropArea = useCallback<UseCropperReturn['setCropArea']>((updater) => {
    setCropAreaState((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  /** Recompute the crop after a geometry change (resize / zoom / ratio / load). */
  const reclampCrop = useCallback(() => {
    const { w, h } = naturalRef.current;
    const { width: cw, height: ch } = sizeRef.current;
    if (!w || !h || !cw || !ch) return;
    const { bounds } = geometryFor(w, h, cw, ch, zoomRef.current);
    setCropAreaState((prev) => {
      if (needsCenterRef.current || prev.width === 0 || prev.height === 0) {
        needsCenterRef.current = false;
        return centerCrop(bounds, aspectRef.current);
      }
      const next = aspectRef.current
        ? applyAspectRatio(prev, aspectRef.current, 'center')
        : prev;
      return clampCropToImage(next, bounds);
    });
  }, []);

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
  }, [reclampCrop]);

  // when a new image loads, record natural size and recenter the crop
  useEffect(() => {
    if (!image) return;
    naturalRef.current = { w: image.naturalWidth, h: image.naturalHeight };
    needsCenterRef.current = true;
    reclampCrop();
  }, [image, reclampCrop]);

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

    const { displayWidth, displayHeight } = geometryFor(
      naturalRef.current.w,
      naturalRef.current.h,
      cw,
      ch,
      zoom,
    );
    drawImageToCanvas(ctx, image, {
      canvasWidth: cw,
      canvasHeight: ch,
      displayWidth,
      displayHeight,
      rotation,
      flipX,
      flipY,
      dpr,
    });
  }, [image, zoom, rotation, flipX, flipY, containerSize.width, containerSize.height]);

  // ---- public actions ------------------------------------------------------
  const setZoom = useCallback(
    (n: number) => {
      const clamped = clamp(n, minZoom, maxZoom);
      zoomRef.current = clamped;
      setZoomState(clamped);
      reclampCrop();
    },
    [minZoom, maxZoom, reclampCrop],
  );

  const zoomIn = useCallback(() => setZoom(zoomRef.current + ZOOM_STEP), [setZoom]);
  const zoomOut = useCallback(() => setZoom(zoomRef.current - ZOOM_STEP), [setZoom]);

  const setRotation = useCallback((deg: number) => {
    setRotationState(normalizeDegrees(deg));
  }, []);
  const rotate = useCallback((deg: number) => {
    setRotationState((prev) => normalizeDegrees(prev + deg));
  }, []);

  const flipHorizontal = useCallback(() => setFlipX((v) => !v), []);
  const flipVertical = useCallback(() => setFlipY((v) => !v), []);

  const setAspectRatio = useCallback(
    (n: number | undefined) => {
      aspectRef.current = n;
      setAspectRatioState(n);
      needsCenterRef.current = true;
      reclampCrop();
    },
    [reclampCrop],
  );

  const reset = useCallback(() => {
    const z = clamp(initialZoom, minZoom, maxZoom);
    zoomRef.current = z;
    aspectRef.current = aspectRatioOption;
    setZoomState(z);
    setRotationState(normalizeDegrees(initialRotation));
    setFlipX(false);
    setFlipY(false);
    setAspectRatioState(aspectRatioOption);
    needsCenterRef.current = true;
    reclampCrop();
  }, [initialZoom, initialRotation, aspectRatioOption, minZoom, maxZoom, reclampCrop]);

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
    const { displayScale } = geometryFor(w, h, cw, ch, zoom);
    return getCroppedImageUtil({
      image,
      naturalWidth: w,
      naturalHeight: h,
      cropArea,
      containerWidth: cw,
      containerHeight: ch,
      displayScale,
      rotation,
      flipX,
      flipY,
      cropShape,
      outputType,
      outputQuality,
    });
  }, [image, zoom, rotation, flipX, flipY, cropArea, cropShape, outputType, outputQuality]);

  const geometry = useMemo(
    () =>
      geometryFor(
        naturalRef.current.w,
        naturalRef.current.h,
        containerSize.width,
        containerSize.height,
        zoom,
      ),
    [containerSize.width, containerSize.height, zoom, image],
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
    }),
    [image, geometry.displayWidth, geometry.displayHeight, zoom, rotation, flipX, flipY, cropArea],
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
    cropShape,
    aspectRatio,
    minCropWidth,
    minCropHeight,
    cropArea,
    setCropArea,
    setZoom,
    zoomIn,
    zoomOut,
    minZoom,
    maxZoom,
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
