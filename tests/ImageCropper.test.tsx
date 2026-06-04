import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageCropper } from '../src/components/ImageCropper';

// ---- environment shims for jsdom ----------------------------------------
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  naturalWidth = 800;
  naturalHeight = 600;
  width = 800;
  height = 600;
  set src(_v: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    imageSmoothingQuality: 'low',
  };
}

beforeEach(() => {
  vi.stubGlobal('Image', MockImage);

  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

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

  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue(fakeCtx()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, type?: string) {
    cb(new Blob(['x'], { type: type || 'image/png' }));
  };
  HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
    return `data:${type || 'image/png'};base64,AAAA`;
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ImageCropper', () => {
  it('shows the dropzone when no image is provided', () => {
    render(<ImageCropper />);
    expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
  });

  it('does not render the crop controls without an image', () => {
    render(<ImageCropper />);
    expect(screen.queryByRole('toolbar', { name: /crop controls/i })).not.toBeInTheDocument();
  });

  it('routes an invalid dropped file to onError', () => {
    const onError = vi.fn();
    const { container } = render(<ImageCropper onError={onError} accept={['image/png']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bad = new File(['x'], 'a.gif', { type: 'image/gif' });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TYPE' }));
  });

  it('loads an image, shows controls, and onComplete fires with a CropResult', async () => {
    const onComplete = vi.fn();
    const onImageLoad = vi.fn();
    const { container } = render(
      <ImageCropper onComplete={onComplete} onImageLoad={onImageLoad} />,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['imgdata'], 'photo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    // controls appear once the (mocked) image has loaded
    const cropButton = await screen.findByRole('button', { name: /^crop$/i });
    expect(onImageLoad).toHaveBeenCalled();

    fireEvent.click(cropButton);

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0][0];
    expect(result).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
      dataUrl: expect.any(String),
    });
    expect(result.blob).toBeInstanceOf(Blob);
  });
});
