import { useEffect, useLayoutEffect } from 'react';

/**
 * True only in a real browser environment. Use this to guard every direct
 * `window` / `document` / `Image` / `canvas` / `URL` access so the package
 * never crashes during SSR (Next.js server components, RSC, static export).
 */
export const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * `useLayoutEffect` warns when run on the server. Swap it for `useEffect`
 * during SSR to silence the warning while keeping browser behaviour.
 */
export const useIsomorphicLayoutEffect = isBrowser ? useLayoutEffect : useEffect;
