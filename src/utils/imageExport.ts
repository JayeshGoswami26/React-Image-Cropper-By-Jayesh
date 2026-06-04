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
  } = params;

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const bboxWidth = naturalWidth * cos + naturalHeight * sin;
  const bboxHeight = naturalWidth * sin + naturalHeight * cos;

  const scale = displayScale || 1;

  // crop corner relative to container center, converted to natural px, then
  // offset by the bbox center (both the display canvas and the bbox canvas show
  // the image in the same screen orientation, only at different scales).
  const sx = bboxWidth / 2 + (cropArea.x - containerWidth / 2) / scale;
  const sy = bboxHeight / 2 + (cropArea.y - containerHeight / 2) / scale;
  const sw = cropArea.width / scale;
  const sh = cropArea.height / scale;

  // natural-space crop (for the consumer): position relative to the un-rotated
  // displayed image top-left.
  const imgLeft = (containerWidth - naturalWidth * scale) / 2;
  const imgTop = (containerHeight - naturalHeight * scale) / 2;
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

export interface GetCroppedImageParams extends ExportGeometryParams {
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

  const { image, flipX, flipY, cropShape, outputType, outputQuality } = params;
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

  // 2) Extract the crop region into the output canvas.
  const outW = Math.max(1, Math.round(geo.sw));
  const outH = Math.max(1, Math.round(geo.sh));
  const out = createCanvas(outW, outH);
  const octx = out.getContext('2d');
  if (!octx) {
    throw { code: 'EXPORT_FAILED', message: 'Could not acquire 2D context.' };
  }

  if (cropShape === 'round') {
    octx.beginPath();
    octx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
    octx.closePath();
    octx.clip();
  }

  octx.drawImage(bbox, geo.sx, geo.sy, geo.sw, geo.sh, 0, 0, outW, outH);

  // 3) Serialize.
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
