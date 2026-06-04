import type { Bounds, CropArea, CropHandle } from '../types';

/** Clamp a number into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export interface ResizeOptions {
  /** when set, the crop is locked to width / height === aspectRatio */
  aspectRatio?: number;
  minWidth: number;
  minHeight: number;
  bounds: Bounds;
}

/**
 * Force `crop` to fully sit inside `bounds`. Size is shrunk first (never larger
 * than the bounds), then the position is clamped so no edge escapes.
 */
export function clampCropToImage(crop: CropArea, bounds: Bounds): CropArea {
  const width = clamp(crop.width, 0, bounds.width);
  const height = clamp(crop.height, 0, bounds.height);
  const x = clamp(crop.x, bounds.x, bounds.x + bounds.width - width);
  const y = clamp(crop.y, bounds.y, bounds.y + bounds.height - height);
  return { x, y, width, height };
}

/** A nicely centered initial crop. `fill` is the fraction of bounds to occupy. */
export function centerCrop(bounds: Bounds, aspectRatio?: number, fill = 0.8): CropArea {
  const maxW = bounds.width * fill;
  const maxH = bounds.height * fill;

  let width: number;
  let height: number;

  if (aspectRatio && aspectRatio > 0) {
    width = maxW;
    height = width / aspectRatio;
    if (height > maxH) {
      height = maxH;
      width = height * aspectRatio;
    }
  } else {
    width = maxW;
    height = maxH;
  }

  const x = bounds.x + (bounds.width - width) / 2;
  const y = bounds.y + (bounds.height - height) / 2;
  return { x, y, width, height };
}

/**
 * Re-shape `crop` to `ratio` (width / height) keeping `anchor` fixed, then clamp.
 * Height is derived from the current width.
 */
export function applyAspectRatio(
  crop: CropArea,
  ratio: number,
  anchor: 'center' | CropHandle = 'center',
): CropArea {
  if (!ratio || ratio <= 0) return crop;

  const width = crop.width;
  const height = width / ratio;

  const left = crop.x;
  const top = crop.y;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;

  let x: number;
  let y: number;

  if (anchor === 'center') {
    x = cx - width / 2;
    y = cy - height / 2;
  } else {
    // `anchor` names the corner/edge that should stay fixed.
    const keepRight = anchor.includes('e');
    const keepBottom = anchor.includes('s');
    x = keepRight ? right - width : left;
    y = keepBottom ? bottom - height : top;
  }

  return { x, y, width, height };
}

/**
 * The core resize/move routine. Given the handle being dragged, the crop at the
 * start of the drag, and the pointer delta since drag-start, return the new
 * crop — respecting min size, optional aspect-lock, and image bounds.
 */
export function resizeFromHandle(
  handle: CropHandle,
  crop: CropArea,
  dx: number,
  dy: number,
  opts: ResizeOptions,
): CropArea {
  const { aspectRatio, minWidth, minHeight, bounds } = opts;

  const bx0 = bounds.x;
  const by0 = bounds.y;
  const bx1 = bounds.x + bounds.width;
  const by1 = bounds.y + bounds.height;

  if (handle === 'move') {
    const x = clamp(crop.x + dx, bx0, bx1 - crop.width);
    const y = clamp(crop.y + dy, by0, by1 - crop.height);
    return { x, y, width: crop.width, height: crop.height };
  }

  const left0 = crop.x;
  const top0 = crop.y;
  const right0 = crop.x + crop.width;
  const bottom0 = crop.y + crop.height;

  const moveLeft = handle.includes('w');
  const moveRight = handle.includes('e');
  const moveTop = handle.includes('n');
  const moveBottom = handle.includes('s');

  // ---- Aspect-ratio-locked resize -----------------------------------------
  if (aspectRatio && aspectRatio > 0) {
    const minW = Math.max(minWidth, minHeight * aspectRatio);
    const minH = minW / aspectRatio;
    const isCorner = (moveLeft || moveRight) && (moveTop || moveBottom);

    if (isCorner) {
      // Anchor = opposite corner (stays fixed).
      const anchorX = moveLeft ? right0 : left0;
      const anchorY = moveTop ? bottom0 : top0;

      const desiredWidth = Math.abs((moveLeft ? left0 + dx : right0 + dx) - anchorX);
      const desiredHeight = Math.abs((moveTop ? top0 + dy : bottom0 + dy) - anchorY);

      // Follow whichever axis the pointer pushed further.
      let width =
        desiredWidth / aspectRatio >= desiredHeight ? desiredWidth : desiredHeight * aspectRatio;
      width = Math.max(width, minW);

      // Clamp to bounds in the grow direction.
      const maxWidth = moveLeft ? anchorX - bx0 : bx1 - anchorX;
      const maxHeight = moveTop ? anchorY - by0 : by1 - anchorY;
      width = Math.min(width, maxWidth, maxHeight * aspectRatio);
      let height = width / aspectRatio;
      height = Math.max(height, minH);
      width = height * aspectRatio;

      const x = moveLeft ? anchorX - width : anchorX;
      const y = moveTop ? anchorY - height : anchorY;
      return { x, y, width, height };
    }

    // Edge handle with ratio: grow the dragged axis, center the other axis.
    if (moveLeft || moveRight) {
      const cy = top0 + crop.height / 2;
      const anchorX = moveLeft ? right0 : left0;
      const desiredWidth = Math.abs((moveLeft ? left0 + dx : right0 + dx) - anchorX);
      let width = Math.max(desiredWidth, minW);

      const maxWidth = moveLeft ? anchorX - bx0 : bx1 - anchorX;
      const maxHeightSpan = Math.min(cy - by0, by1 - cy) * 2;
      width = Math.min(width, maxWidth, maxHeightSpan * aspectRatio);
      width = Math.max(width, minW);
      const height = width / aspectRatio;

      const x = moveLeft ? anchorX - width : anchorX;
      const y = cy - height / 2;
      return { x, y, width, height };
    }

    // moveTop || moveBottom
    const cx = left0 + crop.width / 2;
    const anchorY = moveTop ? bottom0 : top0;
    const desiredHeight = Math.abs((moveTop ? top0 + dy : bottom0 + dy) - anchorY);
    let height = Math.max(desiredHeight, minH);

    const maxHeight = moveTop ? anchorY - by0 : by1 - anchorY;
    const maxWidthSpan = Math.min(cx - bx0, bx1 - cx) * 2;
    height = Math.min(height, maxHeight, maxWidthSpan / aspectRatio);
    height = Math.max(height, minH);
    const width = height * aspectRatio;

    const x = cx - width / 2;
    const y = moveTop ? anchorY - height : anchorY;
    return { x, y, width, height };
  }

  // ---- Free resize ---------------------------------------------------------
  let left = left0;
  let top = top0;
  let right = right0;
  let bottom = bottom0;

  if (moveLeft) left = clamp(left0 + dx, bx0, right0 - minWidth);
  if (moveRight) right = clamp(right0 + dx, left0 + minWidth, bx1);
  if (moveTop) top = clamp(top0 + dy, by0, bottom0 - minHeight);
  if (moveBottom) bottom = clamp(bottom0 + dy, top0 + minHeight, by1);

  return { x: left, y: top, width: right - left, height: bottom - top };
}
