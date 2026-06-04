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
  /** device pixel ratio the backing store was scaled by */
  dpr?: number;
}

/**
 * Render an image into the on-screen crop canvas: centered, zoomed (already
 * baked into displayWidth/Height), rotated, and flipped. The canvas only ever
 * draws the image — the crop overlay is DOM on top, for crisp accessible handles.
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
  ctx.translate(o.canvasWidth / 2, o.canvasHeight / 2);
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
