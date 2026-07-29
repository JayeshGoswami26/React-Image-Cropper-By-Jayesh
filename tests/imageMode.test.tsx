import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useCropper, type UseCropperOptions, type UseCropperReturn } from '../src/hooks/useCropper';

const NATURAL_WIDTH = 1000;
const NATURAL_HEIGHT = 800;

/** jsdom never actually loads images — resolve synchronously with a known size. */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  naturalWidth = NATURAL_WIDTH;
  naturalHeight = NATURAL_HEIGHT;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

let originalImage: typeof Image;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 300,
    top: 0,
    left: 0,
    right: 400,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  originalImage = globalThis.Image;
  globalThis.Image = MockImage as unknown as typeof Image;
});

afterEach(() => {
  globalThis.Image = originalImage;
});

type HookRef = { current: UseCropperReturn | null };

function Harness({ hookRef, options }: { hookRef: HookRef; options: UseCropperOptions }) {
  const cropper = useCropper(options);
  hookRef.current = cropper;
  return <div ref={cropper.containerRef} />;
}

async function mountCropper(options: UseCropperOptions): Promise<HookRef> {
  const hookRef: HookRef = { current: null };
  render(<Harness hookRef={hookRef} options={options} />);
  await waitFor(() => expect(hookRef.current?.state.image).toBeTruthy());
  return hookRef;
}

// Container 400x300, frameFill 0.9 -> 360x270 available; a 1:1 frame is capped
// by the height, giving a 270x270 frame at (65, 15).
const FRAME = { x: 65, y: 15, width: 270, height: 270 };
// cover scale = max(270/1000, 270/800) = 0.3375 -> 337.5 x 270 displayed.
const COVER_SCALE = 0.3375;

describe('useCropper - image mode', () => {
  it('pins the crop area to the fixed frame', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    expect(hook.current!.cropArea.x).toBeCloseTo(FRAME.x);
    expect(hook.current!.cropArea.y).toBeCloseTo(FRAME.y);
    expect(hook.current!.cropArea.width).toBeCloseTo(FRAME.width);
    expect(hook.current!.cropArea.height).toBeCloseTo(FRAME.height);
    expect(hook.current!.geometry.frame.width).toBeCloseTo(FRAME.width);
  });

  it('scales the image to cover the frame', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    expect(hook.current!.geometry.fitScale).toBeCloseTo(COVER_SCALE);
    expect(hook.current!.state.displayWidth).toBeCloseTo(NATURAL_WIDTH * COVER_SCALE);
    expect(hook.current!.state.displayHeight).toBeCloseTo(NATURAL_HEIGHT * COVER_SCALE);
  });

  it('clamps panning to the slack left over the frame', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    // Horizontal slack is (337.5 - 270) / 2; vertically the image covers exactly.
    act(() => hook.current!.panBy(500, 500));
    expect(hook.current!.offset.x).toBeCloseTo(33.75);
    expect(hook.current!.offset.y).toBeCloseTo(0);

    act(() => hook.current!.panBy(-1000, 0));
    expect(hook.current!.offset.x).toBeCloseTo(-33.75);
  });

  it('opens up more pan room as it zooms in', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    act(() => hook.current!.setZoom(2));
    act(() => hook.current!.panBy(0, 500));
    // At 2x the displayed height is 540 against a 270 frame -> 135 of slack.
    expect(hook.current!.offset.y).toBeCloseTo(135);
  });

  it('zoomBy holds the focal point steady', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    // Zoom about the frame's left edge; the image has to shift right to keep
    // whatever sits under that point in place.
    act(() => hook.current!.zoomBy(2, { x: 0, y: 150 }));
    expect(hook.current!.state.zoom).toBeCloseTo(2);
    expect(hook.current!.offset.x).toBeGreaterThan(0);
  });

  it('refuses to zoom below cover', async () => {
    const hook = await mountCropper({
      src: 'photo.png',
      mode: 'image',
      aspectRatio: 1,
      minZoom: 0.25,
    });

    expect(hook.current!.minZoom).toBe(1);
    act(() => hook.current!.setZoom(0.25));
    expect(hook.current!.state.zoom).toBe(1);
  });

  it('re-clamps the offset when rotation changes the cover scale', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    act(() => hook.current!.panBy(500, 0));
    expect(hook.current!.offset.x).toBeCloseTo(33.75);

    // A square frame at 90deg needs the same cover scale but swaps which axis
    // has slack, so the old horizontal offset can no longer stand.
    act(() => hook.current!.setRotation(90));
    expect(hook.current!.offset.x).toBeCloseTo(0);
  });

  it('reset returns the image to the center', async () => {
    const hook = await mountCropper({ src: 'photo.png', mode: 'image', aspectRatio: 1 });

    act(() => hook.current!.panBy(500, 0));
    expect(hook.current!.offset.x).not.toBeCloseTo(0);

    act(() => hook.current!.reset());
    expect(hook.current!.offset.x).toBeCloseTo(0);
    expect(hook.current!.offset.y).toBeCloseTo(0);
  });
});

describe('useCropper - crop-box mode is unaffected', () => {
  it('keeps the image centered and allows sub-1 zoom', async () => {
    const hook = await mountCropper({ src: 'photo.png', minZoom: 0.5 });

    expect(hook.current!.minZoom).toBe(0.5);
    // "contain" fit: 400/1000 vs 300/800 -> 0.375
    expect(hook.current!.geometry.fitScale).toBeCloseTo(0.375);
    expect(hook.current!.offset).toEqual({ x: 0, y: 0 });

    act(() => hook.current!.panBy(100, 100));
    expect(hook.current!.offset).toEqual({ x: 0, y: 0 });
  });
});
