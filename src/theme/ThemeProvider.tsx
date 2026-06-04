'use client';

import { createContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { CropperTheme } from '../types';
import { defaultTheme, mergeTheme, themeToCssVars } from './defaultTheme';

export const ThemeContext = createContext<CropperTheme>(defaultTheme);

export interface ThemeProviderProps {
  /** Partial override merged over the default dark theme. */
  theme?: Partial<CropperTheme>;
  /** Base theme to merge onto (defaults to the dark theme). */
  baseTheme?: CropperTheme;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Provides the resolved theme via context AND injects each key as a CSS custom
 * property (`--rc-primary`, ...) on a wrapper element so consumer overrides
 * cascade to every child.
 */
export function ThemeProvider({
  theme,
  baseTheme = defaultTheme,
  children,
  className,
  style,
}: ThemeProviderProps) {
  const resolved = useMemo(() => mergeTheme(baseTheme, theme), [baseTheme, theme]);
  const cssVars = useMemo(() => themeToCssVars(resolved), [resolved]);

  return (
    <ThemeContext.Provider value={resolved}>
      <div
        className={className}
        style={{ ...(cssVars as CSSProperties), color: 'var(--rc-text)', ...style }}
        data-rc-theme-root=""
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
