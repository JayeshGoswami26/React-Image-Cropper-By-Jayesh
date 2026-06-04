'use client';

import { useContext } from 'react';
import type { CropperTheme } from '../types';
import { ThemeContext } from './ThemeProvider';

/** Read the resolved cropper theme from context. */
export function useTheme(): CropperTheme {
  return useContext(ThemeContext);
}
