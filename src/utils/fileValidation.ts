import type { AcceptedMime, CropperError } from '../types';

export interface FileValidationOptions {
  accept: AcceptedMime[];
  maxSizeMB: number;
}

/**
 * Match a file's mime against an accept list. Supports wildcards like
 * `image/*` as well as exact types like `image/png`.
 */
export function isMimeAccepted(type: string, accept: AcceptedMime[]): boolean {
  if (!accept || accept.length === 0) return true;
  return accept.some((pattern) => {
    if (pattern === type) return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, pattern.indexOf('/'));
      return type.startsWith(prefix + '/');
    }
    return false;
  });
}

/**
 * Validate a single file's type and size. Returns a `CropperError` describing the
 * first problem, or `null` when the file is acceptable.
 */
export function validateFile(
  file: File | Blob,
  { accept, maxSizeMB }: FileValidationOptions,
): CropperError | null {
  const type = file.type || '';

  if (!isMimeAccepted(type, accept)) {
    return {
      code: 'INVALID_TYPE',
      message: `Unsupported file type "${type || 'unknown'}". Allowed: ${accept.join(', ')}.`,
    };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      code: 'FILE_TOO_LARGE',
      message: `File is ${sizeMB} MB, which exceeds the ${maxSizeMB} MB limit.`,
    };
  }

  return null;
}
