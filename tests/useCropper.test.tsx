import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCropper } from '../src/hooks/useCropper';

// jsdom doesn't lay out elements, so getBoundingClientRect returns zeros.
// Force a real container size so geometry/crop initialization runs.
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

  // ResizeObserver isn't in jsdom.
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

describe('useCropper - zoom', () => {
  it('clamps zoom within [minZoom, maxZoom]', () => {
    const { result } = renderHook(() => useCropper({ minZoom: 1, maxZoom: 3 }));

    act(() => result.current.setZoom(10));
    expect(result.current.state.zoom).toBe(3);

    act(() => result.current.setZoom(-5));
    expect(result.current.state.zoom).toBe(1);

    act(() => result.current.setZoom(2));
    expect(result.current.state.zoom).toBe(2);
  });

  it('zoomIn / zoomOut step and clamp', () => {
    const { result } = renderHook(() => useCropper({ minZoom: 1, maxZoom: 2, initialZoom: 1 }));
    act(() => result.current.zoomIn());
    expect(result.current.state.zoom).toBeGreaterThan(1);
    act(() => {
      for (let i = 0; i < 20; i++) result.current.zoomIn();
    });
    expect(result.current.state.zoom).toBe(2);
    act(() => {
      for (let i = 0; i < 20; i++) result.current.zoomOut();
    });
    expect(result.current.state.zoom).toBe(1);
  });
});

describe('useCropper - rotation', () => {
  it('normalizes rotation into 0..359', () => {
    const { result } = renderHook(() => useCropper());
    act(() => result.current.setRotation(450));
    expect(result.current.state.rotation).toBe(90);

    act(() => result.current.setRotation(-90));
    expect(result.current.state.rotation).toBe(270);
  });

  it('rotate is relative and wraps', () => {
    const { result } = renderHook(() => useCropper({ initialRotation: 0 }));
    act(() => result.current.rotate(90));
    expect(result.current.state.rotation).toBe(90);
    act(() => result.current.rotate(300));
    expect(result.current.state.rotation).toBe(30);
  });
});

describe('useCropper - flip & reset', () => {
  it('toggles flips', () => {
    const { result } = renderHook(() => useCropper());
    expect(result.current.state.flipX).toBe(false);
    act(() => result.current.flipHorizontal());
    expect(result.current.state.flipX).toBe(true);
    act(() => result.current.flipVertical());
    expect(result.current.state.flipY).toBe(true);
  });

  it('reset restores defaults', () => {
    const { result } = renderHook(() =>
      useCropper({ initialZoom: 1, minZoom: 1, maxZoom: 4, initialRotation: 0 }),
    );
    act(() => {
      result.current.setZoom(3);
      result.current.rotate(90);
      result.current.flipHorizontal();
    });
    act(() => result.current.reset());
    expect(result.current.state.zoom).toBe(1);
    expect(result.current.state.rotation).toBe(0);
    expect(result.current.state.flipX).toBe(false);
  });
});

describe('useCropper - getCroppedImage guards', () => {
  it('rejects with NO_IMAGE when nothing is loaded', async () => {
    const { result } = renderHook(() => useCropper());
    await expect(result.current.getCroppedImage()).rejects.toMatchObject({ code: 'NO_IMAGE' });
  });
});
