import type { CropArea, CropResult, CropShape, OutputType } from '../types';
import { isBrowser } from './ssr';

export interface ExportGeometryParams {
  naturalWidth: number;
  naturalHeight: number;
  /** crop rectangle in container (display) pixels */
  cropArea: CropArea;
  containerWidth: number;
  containerHeight: number;
  /** fitScale * zoom — display px per natural px */
  displayScale: number;
  rotation: number; // degrees
  /** pan offset of the image center from the container center (image mode) */
  offsetX?: number;
  offsetY?: number;
}

export interface ExportGeometry {
  /** size of the rotated-image bounding box at natural resolution */
  bboxWidth: number;
  bboxHeight: number;
  /** source rect inside the bbox canvas to extract */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** crop region expressed in natural image coordinates (exact when rotation = 0) */
  naturalCrop: CropArea;
}

/**
 * Pure geometry for export. Maps the on-screen (container-space) crop rectangle
 * back to natural-resolution source coordinates, accounting for zoom + rotation.
 * Factored out so it can be unit-tested without a real canvas.
 */
export function computeExportGeometry(params: ExportGeometryParams): ExportGeometry {
  const {
    naturalWidth,
    naturalHeight,
    cropArea,
    containerWidth,
    containerHeight,
    displayScale,
    rotation,
    offsetX = 0,
    offsetY = 0,
  } = params;

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const bboxWidth = naturalWidth * cos + naturalHeight * sin;
  const bboxHeight = naturalWidth * sin + naturalHeight * cos;

  const scale = displayScale || 1;

  // The image is drawn centered on (containerCenter + offset); the bbox canvas
  // shows the same screen orientation, only at natural scale and centered.
  const centerX = containerWidth / 2 + offsetX;
  const centerY = containerHeight / 2 + offsetY;

  // crop corner relative to that center, converted to natural px, then offset
  // by the bbox center.
  const sx = bboxWidth / 2 + (cropArea.x - centerX) / scale;
  const sy = bboxHeight / 2 + (cropArea.y - centerY) / scale;
  const sw = cropArea.width / scale;
  const sh = cropArea.height / scale;

  // natural-space crop (for the consumer): position relative to the un-rotated
  // displayed image top-left.
  const imgLeft = centerX - (naturalWidth * scale) / 2;
  const imgTop = centerY - (naturalHeight * scale) / 2;
  const naturalCrop: CropArea = {
    x: (cropArea.x - imgLeft) / scale,
    y: (cropArea.y - imgTop) / scale,
    width: sw,
    height: sh,
  };

  return { bboxWidth, bboxHeight, sx, sy, sw, sh, naturalCrop };
}

/** Round crops must be PNG so the transparent corners survive. */
export function resolveOutputType(shape: CropShape, outputType: OutputType): OutputType {
  return shape === 'round' ? 'image/png' : outputType;
}

export interface OutputSizeOptions {
  /** exact output width in px; height follows the crop ratio unless also given */
  outputWidth?: number;
  /** exact output height in px; width follows the crop ratio unless also given */
  outputHeight?: number;
}

/**
 * Resolve the final output pixel size from the crop's natural size.
 *
 * One of `outputWidth` / `outputHeight` scales the other proportionally. Giving
 * both is honoured exactly, which will distort the image unless it matches the
 * crop's aspect ratio (pair it with a locked `aspectRatio`).
 */
export function resolveOutputSize(
  sourceWidth: number,
  sourceHeight: number,
  { outputWidth, outputHeight }: OutputSizeOptions = {},
): { width: number; height: number } {
  const srcW = Math.max(1, sourceWidth);
  const srcH = Math.max(1, sourceHeight);

  const w = outputWidth && outputWidth > 0 ? outputWidth : undefined;
  const h = outputHeight && outputHeight > 0 ? outputHeight : undefined;

  if (w && h) return { width: Math.round(w), height: Math.round(h) };
  if (w) return { width: Math.round(w), height: Math.max(1, Math.round((w * srcH) / srcW)) };
  if (h) return { width: Math.max(1, Math.round((h * srcW) / srcH)), height: Math.round(h) };
  return { width: Math.round(srcW), height: Math.round(srcH) };
}

export interface GetCroppedImageParams extends ExportGeometryParams, OutputSizeOptions {
  image: CanvasImageSource;
  flipX: boolean;
  flipY: boolean;
  cropShape: CropShape;
  outputType: OutputType;
  outputQuality: number;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/**
 * Downscale in halving steps rather than one big `drawImage`. A single-shot
 * downscale past ~2x aliases badly outside Chrome, so step down until the
 * remaining reduction is small enough for the built-in filter to handle well.
 */
function downscaleCanvas(
  source: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  let current = source;

  for (;;) {
    // `min` with the current size keeps a lopsided target from upscaling an axis.
    const nextW = Math.min(current.width, Math.max(targetWidth, Math.floor(current.width / 2)));
    const nextH = Math.min(current.height, Math.max(targetHeight, Math.floor(current.height / 2)));
    if (nextW <= targetWidth && nextH <= targetHeight) break;
    if (nextW === current.width && nextH === current.height) break;

    const step = createCanvas(nextW, nextH);
    const sctx = step.getContext('2d');
    if (!sctx) break;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(current, 0, 0, current.width, current.height, 0, 0, step.width, step.height);
    current = step;
  }

  return current;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Produce the cropped image at natural resolution. Returns a `CropResult` with
 * both a `Blob` and a `dataUrl`. Rejects with EXPORT_FAILED on a null/tainted
 * blob, or NO_IMAGE if called outside the browser.
 */
export async function getCroppedImage(params: GetCroppedImageParams): Promise<CropResult> {
  if (!isBrowser) {
    throw { code: 'NO_IMAGE', message: 'Cannot export image outside the browser.' };
  }

  const { image, flipX, flipY, cropShape, outputType, outputQuality, outputWidth, outputHeight } =
    params;
  const geo = computeExportGeometry(params);
  const type = resolveOutputType(cropShape, outputType);

  // 1) Render the full rotated/flipped image at natural resolution.
  const bbox = createCanvas(geo.bboxWidth, geo.bboxHeight);
  const bctx = bbox.getContext('2d');
  if (!bctx) {
    throw { code: 'EXPORT_FAILED', message: 'Could not acquire 2D context.' };
  }
  bctx.translate(bbox.width / 2, bbox.height / 2);
  bctx.rotate((params.rotation * Math.PI) / 180);
  bctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(
    image,
    -params.naturalWidth / 2,
    -params.naturalHeight / 2,
    params.naturalWidth,
    params.naturalHeight,
  );

  // 2) Extract the crop region at natural resolution.
  const crop = createCanvas(geo.sw, geo.sh);
  const cctx = crop.getContext('2d');
  if (!cctx) {
    throw { code: 'EXPORT_FAILED', message: 'Could not acquire 2D context.' };
  }
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(bbox, geo.sx, geo.sy, geo.sw, geo.sh, 0, 0, crop.width, crop.height);

  // 3) Resize to the requested output size, then mask — the round clip has to
  //    land on the final pixel grid or the edge would be resampled and fringe.
  const target = resolveOutputSize(crop.width, crop.height, { outputWidth, outputHeight });
  const needsResize = target.width !== crop.width || target.height !== crop.height;
  const isRound = cropShape === 'round';

  let out = crop;
  if (needsResize || isRound) {
    const scaled =
      target.width < crop.width || target.height < crop.height
        ? downscaleCanvas(crop, target.width, target.height)
        : crop;

    out = createCanvas(target.width, target.height);
    const octx = out.getContext('2d');
    if (!octx) {
      throw { code: 'EXPORT_FAILED', message: 'Could not acquire 2D context.' };
    }
    if (isRound) {
      octx.beginPath();
      octx.ellipse(out.width / 2, out.height / 2, out.width / 2, out.height / 2, 0, 0, Math.PI * 2);
      octx.closePath();
      octx.clip();
    }
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(scaled, 0, 0, scaled.width, scaled.height, 0, 0, out.width, out.height);
  }

  const outW = out.width;
  const outH = out.height;

  // 4) Serialize.
  let blob: Blob | null;
  let dataUrl: string;
  try {
    blob = await canvasToBlob(out, type, outputQuality);
    dataUrl = out.toDataURL(type, outputQuality);
  } catch {
    throw {
      code: 'EXPORT_FAILED',
      message: 'Canvas is tainted (cross-origin image without CORS) and cannot be exported.',
    };
  }

  if (!blob) {
    throw { code: 'EXPORT_FAILED', message: 'Failed to produce an image blob.' };
  }

  return {
    blob,
    dataUrl,
    width: outW,
    height: outH,
    cropArea: geo.naturalCrop,
    rotation: params.rotation,
    flipX,
    flipY,
  };
}
