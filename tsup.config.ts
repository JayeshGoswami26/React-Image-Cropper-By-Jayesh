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
  // Keep the "use client" directive in the emitted bundles so the package
  // works seamlessly inside Next.js App Router server components.
  banner: { js: '"use client";' },
});
