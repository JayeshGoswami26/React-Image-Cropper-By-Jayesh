import { describe, it, expect } from 'vitest';
import {
  clamp,
  clampCropToImage,
  centerCrop,
  applyAspectRatio,
  resizeFromHandle,
} from '../src/utils/cropMath';
import type { Bounds, CropArea, CropHandle } from '../src/types';

const bounds: Bounds = { x: 0, y: 0, width: 400, height: 300 };
const opts = (over: Partial<Parameters<typeof resizeFromHandle>[4]> = {}) => ({
  minWidth: 20,
  minHeight: 20,
  bounds,
  ...over,
});

describe('clamp', () => {
  it('clamps within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
  it('handles inverted range gracefully', () => {
    expect(clamp(5, 10, 0)).toBe(10);
  });
});

describe('clampCropToImage', () => {
  it('keeps a crop already inside untouched', () => {
    const crop: CropArea = { x: 10, y: 10, width: 100, height: 100 };
    expect(clampCropToImage(crop, bounds)).toEqual(crop);
  });

  it('pulls a crop hanging off the right/bottom back inside', () => {
    const crop: CropArea = { x: 380, y: 280, width: 100, height: 100 };
    const r = clampCropToImage(crop, bounds);
    expect(r.x + r.width).toBeLessThanOrEqual(bounds.width);
    expect(r.y + r.height).toBeLessThanOrEqual(bounds.height);
  });

  it('shrinks a crop bigger than the bounds', () => {
    const crop: CropArea = { x: -50, y: -50, width: 1000, height: 1000 };
    const r = clampCropToImage(crop, bounds);
    expect(r).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });
});

describe('centerCrop', () => {
  it('centers a free crop at the configured fill', () => {
    const r = centerCrop(bounds, undefined, 0.8);
    expect(r.width).toBeCloseTo(320);
    expect(r.height).toBeCloseTo(240);
    expect(r.x).toBeCloseTo(40);
    expect(r.y).toBeCloseTo(30);
  });

  it('fits a 1:1 ratio inside the bounds', () => {
    const r = centerCrop(bounds, 1, 0.8);
    expect(r.width).toBeCloseTo(r.height);
    expect(r.width).toBeLessThanOrEqual(bounds.width);
    expect(r.height).toBeLessThanOrEqual(bounds.height);
  });

  it('fits a very wide ratio without exceeding width', () => {
    const r = centerCrop(bounds, 16 / 9, 0.9);
    expect(r.width / r.height).toBeCloseTo(16 / 9, 4);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.width).toBeLessThanOrEqual(bounds.width);
  });
});

describe('applyAspectRatio', () => {
  it('derives height from width at center anchor', () => {
    const crop: CropArea = { x: 100, y: 100, width: 100, height: 50 };
    const r = applyAspectRatio(crop, 1, 'center');
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    // center preserved
    expect(r.x + r.width / 2).toBeCloseTo(150);
    expect(r.y + r.height / 2).toBeCloseTo(125);
  });

  it('returns crop unchanged for invalid ratio', () => {
    const crop: CropArea = { x: 0, y: 0, width: 10, height: 10 };
    expect(applyAspectRatio(crop, 0)).toBe(crop);
  });

  it('keeps the opposite corner fixed for a corner anchor', () => {
    const crop: CropArea = { x: 100, y: 100, width: 80, height: 80 };
    // anchor 'se' => keep right/bottom fixed
    const r = applyAspectRatio(crop, 2, 'se');
    expect(r.x + r.width).toBeCloseTo(180);
    expect(r.y + r.height).toBeCloseTo(180);
  });
});

describe('resizeFromHandle - move', () => {
  const crop: CropArea = { x: 100, y: 100, width: 100, height: 100 };

  it('translates the box', () => {
    const r = resizeFromHandle('move', crop, 20, 30, opts());
    expect(r).toEqual({ x: 120, y: 130, width: 100, height: 100 });
  });

  it('clamps movement to bounds', () => {
    const r = resizeFromHandle('move', crop, 9999, 9999, opts());
    expect(r.x).toBe(bounds.width - crop.width);
    expect(r.y).toBe(bounds.height - crop.height);
  });

  it('clamps negative movement to bounds', () => {
    const r = resizeFromHandle('move', crop, -9999, -9999, opts());
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

describe('resizeFromHandle - free resize', () => {
  const crop: CropArea = { x: 100, y: 100, width: 100, height: 100 };

  it('se grows width and height', () => {
    const r = resizeFromHandle('se', crop, 50, 40, opts());
    expect(r.width).toBe(150);
    expect(r.height).toBe(140);
    expect(r.x).toBe(100);
    expect(r.y).toBe(100);
  });

  it('nw moves the top-left corner', () => {
    const r = resizeFromHandle('nw', crop, -30, -20, opts());
    expect(r.x).toBe(70);
    expect(r.y).toBe(80);
    expect(r.width).toBe(130);
    expect(r.height).toBe(120);
  });

  it('e changes only width', () => {
    const r = resizeFromHandle('e', crop, 25, 999, opts());
    expect(r.width).toBe(125);
    expect(r.height).toBe(100);
    expect(r.y).toBe(100);
  });

  it('n changes only height and moves top', () => {
    const r = resizeFromHandle('n', crop, 999, -40, opts());
    expect(r.height).toBe(140);
    expect(r.y).toBe(60);
    expect(r.width).toBe(100);
  });

  it('enforces min width when shrinking past it', () => {
    const r = resizeFromHandle('e', crop, -999, 0, opts({ minWidth: 20 }));
    expect(r.width).toBe(20);
    expect(r.x).toBe(100);
  });

  it('enforces min height from the n handle', () => {
    const r = resizeFromHandle('n', crop, 0, 999, opts({ minHeight: 20 }));
    expect(r.height).toBe(20);
    // top must not pass bottom - minHeight
    expect(r.y).toBe(180);
  });

  it('never lets a resized box leave the bounds', () => {
    const r = resizeFromHandle('se', crop, 9999, 9999, opts());
    expect(r.x + r.width).toBeLessThanOrEqual(bounds.width);
    expect(r.y + r.height).toBeLessThanOrEqual(bounds.height);
  });

  it('clamps nw against the top-left edge', () => {
    const r = resizeFromHandle('nw', crop, -9999, -9999, opts());
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

describe('resizeFromHandle - aspect locked', () => {
  const crop: CropArea = { x: 100, y: 100, width: 100, height: 100 };

  it('locks a corner to 1:1', () => {
    const r = resizeFromHandle('se', crop, 60, 20, opts({ aspectRatio: 1 }));
    expect(r.width).toBeCloseTo(r.height, 5);
  });

  it('locks a corner to 2:1', () => {
    const r = resizeFromHandle('se', crop, 80, 0, opts({ aspectRatio: 2 }));
    expect(r.width / r.height).toBeCloseTo(2, 5);
  });

  it('keeps the opposite corner anchored on se (ratio)', () => {
    const r = resizeFromHandle('se', crop, 80, 80, opts({ aspectRatio: 1 }));
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(100);
  });

  it('keeps the se corner anchored when dragging nw (ratio)', () => {
    const r = resizeFromHandle('nw', crop, -60, -60, opts({ aspectRatio: 1 }));
    expect(r.x + r.width).toBeCloseTo(200);
    expect(r.y + r.height).toBeCloseTo(200);
    expect(r.width / r.height).toBeCloseTo(1, 5);
  });

  it('edge handle e keeps ratio and centers vertically', () => {
    const r = resizeFromHandle('e', crop, 100, 0, opts({ aspectRatio: 1 }));
    expect(r.width / r.height).toBeCloseTo(1, 5);
    // vertical center preserved
    expect(r.y + r.height / 2).toBeCloseTo(150, 5);
  });

  it('edge handle s keeps ratio and centers horizontally', () => {
    const r = resizeFromHandle('s', crop, 0, 60, opts({ aspectRatio: 2 }));
    expect(r.width / r.height).toBeCloseTo(2, 5);
    expect(r.x + r.width / 2).toBeCloseTo(150, 5);
  });

  it('respects min size with ratio', () => {
    const r = resizeFromHandle('se', crop, -999, -999, opts({ aspectRatio: 1, minWidth: 30, minHeight: 30 }));
    expect(r.width).toBeGreaterThanOrEqual(30);
    expect(r.height).toBeGreaterThanOrEqual(30);
    expect(r.width / r.height).toBeCloseTo(1, 5);
  });

  it('stays inside bounds with an extreme ratio drag', () => {
    const r = resizeFromHandle('se', crop, 9999, 9999, opts({ aspectRatio: 1 }));
    expect(r.x + r.width).toBeLessThanOrEqual(bounds.width + 0.001);
    expect(r.y + r.height).toBeLessThanOrEqual(bounds.height + 0.001);
    expect(r.width / r.height).toBeCloseTo(1, 4);
  });
});

describe('resizeFromHandle - all handles produce valid boxes', () => {
  const handles: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const crop: CropArea = { x: 150, y: 120, width: 100, height: 80 };

  it.each(handles)('handle %s never produces negative size', (h) => {
    for (const [dx, dy] of [
      [50, 50],
      [-50, -50],
      [200, -200],
      [-200, 200],
    ]) {
      const r = resizeFromHandle(h, crop, dx, dy, opts());
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeGreaterThanOrEqual(-0.001);
      expect(r.y).toBeGreaterThanOrEqual(-0.001);
      expect(r.x + r.width).toBeLessThanOrEqual(bounds.width + 0.001);
      expect(r.y + r.height).toBeLessThanOrEqual(bounds.height + 0.001);
    }
  });
});
