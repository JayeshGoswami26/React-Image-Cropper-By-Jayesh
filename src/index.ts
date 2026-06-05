
// ---- Components ----
export {
  ImageCropper,
  type ImageCropperProps,
  CropperCanvas,
  type CropperCanvasProps,
  CropOverlay,
  type CropOverlayProps,
  CropperControls,
  DEFAULT_ASPECT_OPTIONS,
  type CropperControlsProps,
  ImageDropzone,
  type ImageDropzoneProps,
} from './components';

// ---- Hooks ----
export {
  useCropper,
  type UseCropperOptions,
  type UseCropperReturn,
  type CropperGeometry,
  useDropzone,
  type UseDropzoneOptions,
  type UseDropzoneReturn,
  useImageLoader,
  type ImageSource,
  type ImageLoadStatus,
  type UseImageLoaderResult,
  usePointerDrag,
  type UsePointerDragOptions,
  type DragState,
} from './hooks';

// ---- Theme ----
export {
  ThemeProvider,
  ThemeContext,
  type ThemeProviderProps,
  useTheme,
  defaultTheme,
  defaultDarkTheme,
  defaultLightTheme,
  themeVarName,
  themeToCssVars,
  mergeTheme,
} from './theme';

// ---- Utils (pure helpers, handy for custom UIs) ----
export {
  clamp,
  clampCropToImage,
  centerCrop,
  applyAspectRatio,
  resizeFromHandle,
  type ResizeOptions,
} from './utils/cropMath';
export {
  computeExportGeometry,
  resolveOutputType,
  getCroppedImage,
  type ExportGeometry,
  type ExportGeometryParams,
  type GetCroppedImageParams,
} from './utils/imageExport';
export {
  drawImageToCanvas,
  computeFitScale,
  computeImageBounds,
  type DrawImageOptions,
} from './utils/canvasHelpers';
export {
  validateFile,
  isMimeAccepted,
  type FileValidationOptions,
} from './utils/fileValidation';
export { isBrowser, useIsomorphicLayoutEffect } from './utils/ssr';

// ---- Types ----
export type {
  CropArea,
  Bounds,
  CropHandle,
  CropShape,
  CropperState,
  CropResult,
  CropperTheme,
  AcceptedMime,
  AspectRatioOption,
  OutputType,
  CropperError,
  CropperErrorCode,
} from './types';
