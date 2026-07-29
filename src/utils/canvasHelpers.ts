import type { Bounds } from '../types';

export interface DrawImageOptions {
  /** container / canvas CSS size in px */
  canvasWidth: number;
  canvasHeight: number;
  /** displayed image size = naturalSize * fitScale * zoom */
  displayWidth: number;
  displayHeight: number;
  rotation: number; // degrees
  flipX: boolean;
  flipY: boolean;
  /** pan offset of the image center from the canvas center (image mode) */
  offsetX?: number;
  offsetY?: number;
  /** device pixel ratio the backing store was scaled by */
  dpr?: number;
}

/**
 * Render an image into the on-screen crop canvas: centered (plus an optional pan
 * offset), zoomed (already baked into displayWidth/Height), rotated, and flipped.
 * The canvas only ever draws the image — the crop overlay is DOM on top, for
 * crisp accessible handles.
 *
 * Transform order matters and is mirrored by the export path and the pan-clamp
 * math: translate (screen space) → rotate → flip.
 */
export function drawImageToCanvas(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  o: DrawImageOptions,
): void {
  const dpr = o.dpr ?? 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, o.canvasWidth, o.canvasHeight);
  ctx.translate(o.canvasWidth / 2 + (o.offsetX ?? 0), o.canvasHeight / 2 + (o.offsetY ?? 0));
  ctx.rotate((o.rotation * Math.PI) / 180);
  ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, -o.displayWidth / 2, -o.displayHeight / 2, o.displayWidth, o.displayHeight);
  ctx.restore();
}

/**
 * "contain" fit scale: largest scale at which the natural image fits inside the
 * container without cropping. Multiply by zoom for the final display scale.
 */
export function computeFitScale(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1;
  return Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
}

/**
 * The fixed crop frame used by `'image'` mode: centered in the container,
 * locked to `aspectRatio` (or the container's own ratio when omitted), and
 * occupying `fill` of the available space.
 */
export function computeFrameRect(
  containerWidth: number,
  containerHeight: number,
  aspectRatio?: number,
  fill = 0.9,
): Bounds {
  const maxW = containerWidth * fill;
  const maxH = containerHeight * fill;

  let width = maxW;
  let height = maxH;

  if (aspectRatio && aspectRatio > 0) {
    height = width / aspectRatio;
    if (height > maxH) {
      height = maxH;
      width = height * aspectRatio;
    }
  }

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width: Math.max(0, width),
    height: Math.max(0, height),
  };
}

/**
 * "cover" scale: the smallest scale at which the image — once rotated by
 * `rotation` — still fully covers the frame, so `'image'` mode can never show
 * empty space inside the crop.
 *
 * Measured along the image's own axes: rotating the frame by `-rotation` gives
 * an axis-aligned box of `fw·|cos| + fh·|sin|` by `fw·|sin| + fh·|cos|`, which
 * is what the natural image has to span.
 */
export function computeCoverScale(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
  rotation = 0,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 1;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const needWidth = frameWidth * cos + frameHeight * sin;
  const needHeight = frameWidth * sin + frameHeight * cos;
  return Math.max(needWidth / naturalWidth, needHeight / naturalHeight);
}

/**
 * The crop bounds (where the crop box may live) = the displayed-image rectangle,
 * centered in the container and clipped to the container edges.
 */
export function computeImageBounds(
  displayWidth: number,
  displayHeight: number,
  containerWidth: number,
  containerHeight: number,
): Bounds {
  const imgLeft = (containerWidth - displayWidth) / 2;
  const imgTop = (containerHeight - displayHeight) / 2;
  const x = Math.max(0, imgLeft);
  const y = Math.max(0, imgTop);
  const right = Math.min(containerWidth, imgLeft + displayWidth);
  const bottom = Math.min(containerHeight, imgTop + displayHeight);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}
