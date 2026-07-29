import { describe, it, expect } from 'vitest';
import { clampPanOffset } from '../src/utils/cropMath';
import { computeCoverScale, computeFrameRect } from '../src/utils/canvasHelpers';
import { resolveOutputSize } from '../src/utils/imageExport';

describe('computeFrameRect', () => {
  it('centers an aspect-locked frame inside the container', () => {
    // 0.9 fill of 400x300 -> 360x270; a 1:1 frame is capped by the height.
    const f = computeFrameRect(400, 300, 1, 0.9);
    expect(f).toMatchObject({ x: 65, y: 15, width: 270, height: 270 });
  });

  it('falls back to the container ratio with no aspect ratio', () => {
    const f = computeFrameRect(400, 300, undefined, 0.9);
    expect(f).toMatchObject({ x: 20, y: 15, width: 360, height: 270 });
  });

  it('uses the width when the ratio is wider than the container', () => {
    const f = computeFrameRect(400, 400, 16 / 9, 1);
    expect(f.width).toBeCloseTo(400);
    expect(f.height).toBeCloseTo(225);
  });
});

describe('computeCoverScale', () => {
  it('picks the axis that needs the most scaling', () => {
    // 400/1000 = 0.4 beats 300/800 = 0.375
    expect(computeCoverScale(1000, 800, 400, 300)).toBeCloseTo(0.4);
  });

  it('scales up when the image is smaller than the frame', () => {
    expect(computeCoverScale(100, 100, 400, 200)).toBeCloseTo(4);
  });

  it('accounts for rotation', () => {
    // At 90deg the frame's 400px width is measured along the image's height.
    expect(computeCoverScale(1000, 1000, 400, 200, 90)).toBeCloseTo(0.4);
  });

  it('needs more scale at 45deg than at 0deg', () => {
    const flat = computeCoverScale(1000, 1000, 400, 300, 0);
    const tilted = computeCoverScale(1000, 1000, 400, 300, 45);
    expect(tilted).toBeGreaterThan(flat);
  });
});

describe('clampPanOffset', () => {
  const frame = { frameWidth: 400, frameHeight: 300 };

  it('clamps to the slack on each axis', () => {
    const out = clampPanOffset(
      { x: 100, y: -80 },
      { displayWidth: 500, displayHeight: 400, ...frame },
    );
    expect(out.x).toBeCloseTo(50);
    expect(out.y).toBeCloseTo(-50);
  });

  it('leaves an in-range offset untouched', () => {
    const out = clampPanOffset(
      { x: 20, y: -10 },
      { displayWidth: 500, displayHeight: 400, ...frame },
    );
    expect(out.x).toBeCloseTo(20);
    expect(out.y).toBeCloseTo(-10);
  });

  it('locks the axis that is exactly covered', () => {
    // Width matches the frame exactly -> no horizontal slack at all.
    const out = clampPanOffset(
      { x: 30, y: 20 },
      { displayWidth: 400, displayHeight: 400, ...frame },
    );
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(20);
  });

  it('never allows panning at the cover scale', () => {
    const scale = computeCoverScale(1000, 800, 400, 300);
    const out = clampPanOffset(
      { x: 999, y: 999 },
      {
        displayWidth: 1000 * scale,
        displayHeight: 800 * scale,
        ...frame,
      },
    );
    // 1000*0.4 = 400 = frame width, so x is pinned; y keeps its slack.
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(10);
  });

  it('applies the limits in the rotated frame of reference', () => {
    // At 90deg a horizontal screen pan is bounded by the frame's height.
    const out = clampPanOffset(
      { x: 500, y: 0 },
      { displayWidth: 1000, displayHeight: 1000, frameWidth: 400, frameHeight: 200, rotation: 90 },
    );
    expect(out.x).toBeCloseTo(300);
    expect(out.y).toBeCloseTo(0);
  });
});

describe('resolveOutputSize', () => {
  it('returns the source size when nothing is requested', () => {
    expect(resolveOutputSize(1000, 800)).toEqual({ width: 1000, height: 800 });
  });

  it('derives the height from outputWidth', () => {
    expect(resolveOutputSize(1000, 800, { outputWidth: 500 })).toEqual({ width: 500, height: 400 });
  });

  it('derives the width from outputHeight', () => {
    expect(resolveOutputSize(1000, 800, { outputHeight: 400 })).toEqual({ width: 500, height: 400 });
  });

  it('honours both dimensions exactly', () => {
    expect(resolveOutputSize(1000, 800, { outputWidth: 512, outputHeight: 512 })).toEqual({
      width: 512,
      height: 512,
    });
  });

  it('ignores non-positive values', () => {
    expect(resolveOutputSize(1000, 800, { outputWidth: 0 })).toEqual({ width: 1000, height: 800 });
  });

  it('rounds to whole pixels', () => {
    expect(resolveOutputSize(1000, 333, { outputWidth: 100 })).toEqual({ width: 100, height: 33 });
  });
});
