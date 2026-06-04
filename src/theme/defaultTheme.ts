import type { CropperTheme } from '../types';

/** The package default — a modern near-black surface with a soft purple accent. */
export const defaultDarkTheme: CropperTheme = {
  primary: '#7C77DD', // purple accent
  secondary: '#1A1A2E', // near-black surface
  accent: '#B39DDB',
  overlay: 'rgba(10, 10, 18, 0.6)',
  handleColor: '#FFFFFF',
  handleBorder: '#7C77DD',
  gridColor: 'rgba(255, 255, 255, 0.4)',
  text: '#EDEDED',
  background: '#0F0F1A',
  borderRadius: 12,
};

/** A light variant — purple on white. */
export const defaultLightTheme: CropperTheme = {
  primary: '#6C5CE7',
  secondary: '#F4F2FF',
  accent: '#8B7BF0',
  overlay: 'rgba(20, 18, 40, 0.45)',
  handleColor: '#FFFFFF',
  handleBorder: '#6C5CE7',
  gridColor: 'rgba(40, 30, 80, 0.35)',
  text: '#1A1A2E',
  background: '#FFFFFF',
  borderRadius: 12,
};

/** Package default = dark black + purple. */
export const defaultTheme: CropperTheme = defaultDarkTheme;

/** CSS custom-property name for a given theme key, e.g. `primary` -> `--rc-primary`. */
export function themeVarName(key: keyof CropperTheme): string {
  // camelCase -> kebab-case
  const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  return `--rc-${kebab}`;
}

/** Build the inline-style object of CSS custom properties for a theme. */
export function themeToCssVars(theme: CropperTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  (Object.keys(theme) as Array<keyof CropperTheme>).forEach((key) => {
    const value = theme[key];
    vars[themeVarName(key)] = typeof value === 'number' ? `${value}px` : String(value);
  });
  return vars;
}

/** Merge a partial override over the default theme. */
export function mergeTheme(
  base: CropperTheme,
  override?: Partial<CropperTheme>,
): CropperTheme {
  if (!override) return base;
  return { ...base, ...override };
}
