import { describe, it, expect } from 'vitest';
import { computeExportGeometry, resolveOutputType } from '../src/utils/imageExport';
import { validateFile, isMimeAccepted } from '../src/utils/fileValidation';

describe('computeExportGeometry - no rotation', () => {
  // 1000x800 image, displayed at scale 0.4 in a 400x320 container -> exact fit.
  const base = {
    naturalWidth: 1000,
    naturalHeight: 800,
    containerWidth: 400,
    containerHeight: 320,
    displayScale: 0.4,
    rotation: 0,
  };

  it('bbox equals natural size at 0 deg', () => {
    const g = computeExportGeometry({ ...base, cropArea: { x: 0, y: 0, width: 400, height: 320 } });
    expect(g.bboxWidth).toBeCloseTo(1000);
    expect(g.bboxHeight).toBeCloseTo(800);
  });

  it('maps a full-frame crop to the whole natural image', () => {
    const g = computeExportGeometry({ ...base, cropArea: { x: 0, y: 0, width: 400, height: 320 } });
    expect(g.sx).toBeCloseTo(0);
    expect(g.sy).toBeCloseTo(0);
    expect(g.sw).toBeCloseTo(1000);
    expect(g.sh).toBeCloseTo(800);
    expect(g.naturalCrop).toMatchObject({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('maps a centered half crop correctly', () => {
    // crop 200x160 centered in the container
    const g = computeExportGeometry({
      ...base,
      cropArea: { x: 100, y: 80, width: 200, height: 160 },
    });
    expect(g.sw).toBeCloseTo(500);
    expect(g.sh).toBeCloseTo(400);
    // centered -> source starts at quarter of the image
    expect(g.sx).toBeCloseTo(250);
    expect(g.sy).toBeCloseTo(200);
    expect(g.naturalCrop.x).toBeCloseTo(250);
    expect(g.naturalCrop.y).toBeCloseTo(200);
  });
});

describe('computeExportGeometry - rotation', () => {
  it('90 deg swaps the bounding box dimensions', () => {
    const g = computeExportGeometry({
      naturalWidth: 1000,
      naturalHeight: 800,
      containerWidth: 400,
      containerHeight: 320,
      displayScale: 0.4,
      rotation: 90,
      cropArea: { x: 0, y: 0, width: 10, height: 10 },
    });
    expect(g.bboxWidth).toBeCloseTo(800);
    expect(g.bboxHeight).toBeCloseTo(1000);
  });

  it('45 deg grows the bounding box', () => {
    const g = computeExportGeometry({
      naturalWidth: 100,
      naturalHeight: 100,
      containerWidth: 200,
      containerHeight: 200,
      displayScale: 1,
      rotation: 45,
      cropArea: { x: 0, y: 0, width: 10, height: 10 },
    });
    const expected = 100 * Math.SQRT2;
    expect(g.bboxWidth).toBeCloseTo(expected, 4);
    expect(g.bboxHeight).toBeCloseTo(expected, 4);
  });
});

describe('resolveOutputType', () => {
  it('forces PNG for round crops', () => {
    expect(resolveOutputType('round', 'image/jpeg')).toBe('image/png');
    expect(resolveOutputType('round', 'image/webp')).toBe('image/png');
  });
  it('keeps the requested type for rect crops', () => {
    expect(resolveOutputType('rect', 'image/jpeg')).toBe('image/jpeg');
    expect(resolveOutputType('rect', 'image/webp')).toBe('image/webp');
  });
});

describe('fileValidation', () => {
  const accept = ['image/png', 'image/jpeg'];

  it('accepts an allowed type', () => {
    expect(isMimeAccepted('image/png', accept)).toBe(true);
  });
  it('rejects a disallowed type', () => {
    expect(isMimeAccepted('image/gif', accept)).toBe(false);
  });
  it('supports wildcard accept', () => {
    expect(isMimeAccepted('image/gif', ['image/*'])).toBe(true);
    expect(isMimeAccepted('video/mp4', ['image/*'])).toBe(false);
  });

  it('returns INVALID_TYPE for the wrong mime', () => {
    const file = new File(['x'], 'a.gif', { type: 'image/gif' });
    const err = validateFile(file, { accept, maxSizeMB: 10 });
    expect(err?.code).toBe('INVALID_TYPE');
  });

  it('returns FILE_TOO_LARGE past the limit', () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'b.png', { type: 'image/png' });
    const err = validateFile(big, { accept, maxSizeMB: 2 });
    expect(err?.code).toBe('FILE_TOO_LARGE');
  });

  it('returns null for a valid file', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(validateFile(file, { accept, maxSizeMB: 10 })).toBeNull();
  });
});
