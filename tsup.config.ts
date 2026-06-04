import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  splitting: false,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // The "use client" directive is re-added after the build (see scripts/banner.mjs)
  // because esbuild strips module-level directives when bundling.
  onSuccess: 'node scripts/banner.mjs',
});
