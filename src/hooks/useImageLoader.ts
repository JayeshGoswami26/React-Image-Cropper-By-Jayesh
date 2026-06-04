'use client';

import { useEffect, useRef, useState } from 'react';
import type { CropperError } from '../types';
import { isBrowser } from '../utils/ssr';

export type ImageLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type ImageSource = File | Blob | string | null | undefined;

export interface UseImageLoaderResult {
  image: HTMLImageElement | null;
  status: ImageLoadStatus;
  error: CropperError | null;
}

/**
 * Load a `File`, `Blob`, or URL string into an `HTMLImageElement`. SSR-safe
 * (does nothing on the server). Object URLs are revoked on cleanup to avoid
 * memory leaks, and remote URLs use `crossOrigin = 'anonymous'` so the canvas
 * stays exportable.
 */
export function useImageLoader(source: ImageSource): UseImageLoaderResult {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<ImageLoadStatus>('idle');
  const [error, setError] = useState<CropperError | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isBrowser) return;

    // Reset any previously created object URL.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!source) {
      setImage(null);
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    const img = new Image();
    const isRemote = typeof source === 'string' && /^https?:\/\//i.test(source);
    if (isRemote) {
      img.crossOrigin = 'anonymous';
    }

    let url: string;
    if (typeof source === 'string') {
      url = source;
    } else {
      url = URL.createObjectURL(source);
      objectUrlRef.current = url;
    }

    img.onload = () => {
      if (cancelled) return;
      setImage(img);
      setStatus('loaded');
    };
    img.onerror = () => {
      if (cancelled) return;
      setImage(null);
      setStatus('error');
      setError({ code: 'LOAD_FAILED', message: 'The image could not be loaded.' });
    };
    img.src = url;

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [source]);

  return { image, status, error };
}
