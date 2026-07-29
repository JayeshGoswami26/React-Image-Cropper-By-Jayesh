/**
 * Shared types for react-image-cropper-byjayesh.
 * Keep this file dependency-free so it can be imported anywhere (incl. SSR).
 */

/** A crop rectangle in *display* pixels relative to the displayed image top-left. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Axis-aligned bounds the crop must stay inside (the displayed image rect). */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A 2D point / offset in display pixels. */
export interface Point {
  x: number;
  y: number;
}

/**
 * How the crop surface behaves:
 * - `'crop-box'` — the image is fixed and a resizable crop box moves over it.
 * - `'image'` — the crop frame is fixed (Instagram/avatar style) and the image
 *   pans and zooms underneath it, always covering the frame.
 */
export type CropperMode = 'crop-box' | 'image';

/** The 8 resize handles plus the body-move target. */
export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export type CropShape = 'rect' | 'round';

export interface CropperState {
  image: HTMLImageElement | null;
  naturalWidth: number;
  naturalHeight: number;
  /** display size of the image inside the container (after fit). */
  displayWidth: number;
  displayHeight: number;
  zoom: number;
  /** degrees, normalized 0..359 */
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  cropArea: CropArea;
  /** pan offset of the image from the container center (image mode only). */
  offset: Point;
}

export interface CropResult {
  blob: Blob;
  dataUrl: string;
  /** output px */
  width: number;
  height: number;
  /** crop region expressed in NATURAL image coordinates */
  cropArea: CropArea;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export interface CropperTheme {
  /** accent: handles, active controls, crop button */
  primary: string;
  /** surfaces / toolbar bg */
  secondary: string;
  /** hover / highlights */
  accent: string;
  /** dark mask outside crop (rgba) */
  overlay: string;
  handleColor: string;
  handleBorder: string;
  gridColor: string;
  text: string;
  background: string;
  /** px */
  borderRadius: number;
}

export type AcceptedMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  // eslint-disable-next-line @typescript-eslint/ban-types -- keep literal autocomplete while allowing any mime string
  | (string & {});

export type CropperErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_TYPE'
  | 'LOAD_FAILED'
  | 'EXPORT_FAILED'
  | 'NO_IMAGE';

export interface CropperError {
  code: CropperErrorCode;
  message: string;
}

/** A labelled aspect ratio option for the controls dropdown. `value: undefined` = free. */
export interface AspectRatioOption {
  label: string;
  value: number | undefined;
}

export type OutputType = 'image/png' | 'image/jpeg' | 'image/webp';
