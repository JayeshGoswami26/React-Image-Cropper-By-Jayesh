# PLAN.md — React / Next.js Image Cropper Package

> **For: Claude Code**
> This document is the complete, authoritative build specification for an npm package.
> Build the entire package from this spec. Do not skip sections. Where a decision is
> already made here, follow it exactly. Where something is genuinely ambiguous, prefer
> the simplest correct implementation and leave a `// TODO(review):` comment.

---

## 0. Project Identity

- **Package name:** `react-easy-image-cropper` (change in `package.json` if taken on npm — check first with `npm view <name>`)
- **What it is:** A zero-dependency (runtime) React + Next.js image cropper component with a built-in drag-and-drop dropzone, full transform controls (crop, resize, rotate, flip, zoom, circular crop), and a fully themeable UI.
- **Target consumers:** React 17/18/19 and Next.js 13/14/15 (App Router + Pages Router, SSR-safe).
- **Language:** TypeScript, strict mode.
- **Distribution:** Dual ESM + CJS, with `.d.ts` types and tree-shaking support.
- **License:** MIT.

### Design goals (in priority order)
1. **SSR-safe** — must not crash in Next.js server components / during SSR. All canvas/DOM access guarded.
2. **Headless-friendly** — expose low-level hook + headless canvas AND a batteries-included component.
3. **Zero runtime deps** — only `react`/`react-dom` as peer deps. No `react-dropzone`, no `cropperjs`.
4. **Themeable** — consumer passes colors; defaults to a modern black + purple theme.
5. **Accessible** — keyboard operable, ARIA labelled, focus-visible handles.
6. **Tiny** — target < 15kb min+gzip for the core.

---

## 1. Tech Stack & Toolchain

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 5.x | `strict: true` |
| Bundler | **tsup** | Dual ESM+CJS+dts in one config |
| Test runner | **Vitest** + `@testing-library/react` + `jsdom` | |
| Lint | ESLint (`@typescript-eslint`) + `eslint-plugin-react-hooks` | |
| Format | Prettier | |
| Styling | Inline styles + CSS custom properties | No CSS-in-JS lib, no external stylesheet required |
| CI | GitHub Actions | lint → typecheck → test → build |
| Versioning | Changesets (optional but recommended) | |

### peerDependencies
```json
{
  "react": ">=17.0.0",
  "react-dom": ">=17.0.0"
}
```
`next` is NOT a peer dep — the package only needs React. It must simply *work* inside Next. Mark React peer deps as optional-friendly and add `peerDependenciesMeta` if needed.

---

## 2. Final Folder Structure

Create exactly this:

```
react-easy-image-cropper/
├── src/
│   ├── components/
│   │   ├── ImageCropper.tsx          # all-in-one: dropzone + canvas + controls
│   │   ├── CropperCanvas.tsx         # headless-ish canvas (the crop surface)
│   │   ├── CropperControls.tsx       # toolbar: rotate, flip, zoom, ratio, crop btn
│   │   ├── ImageDropzone.tsx         # drag-drop / click upload
│   │   ├── CropOverlay.tsx           # the selection box + 8 handles + grid
│   │   └── index.ts                  # re-export components
│   ├── hooks/
│   │   ├── useCropper.ts             # core state machine + transforms + export
│   │   ├── useDropzone.ts            # file selection / drag events / validation
│   │   ├── useImageLoader.ts         # load File/URL into HTMLImageElement (SSR-safe)
│   │   └── usePointerDrag.ts         # unified mouse+touch pointer drag helper
│   ├── theme/
│   │   ├── defaultTheme.ts           # black + purple defaults (light + dark)
│   │   ├── ThemeProvider.tsx         # context + CSS var injection
│   │   └── useTheme.ts               # consume theme context
│   ├── utils/
│   │   ├── canvasHelpers.ts          # draw, clip, rotate, flip math
│   │   ├── cropMath.ts               # geometry: clamp, aspect-lock, handle resize
│   │   ├── imageExport.ts            # toBlob / toDataURL / toCanvas
│   │   ├── fileValidation.ts         # type/size checks
│   │   └── ssr.ts                    # isBrowser, useIsomorphicLayoutEffect
│   ├── types.ts                      # all shared types/interfaces
│   └── index.ts                      # PUBLIC API barrel (the only entry)
├── tests/
│   ├── cropMath.test.ts
│   ├── imageExport.test.ts
│   ├── useCropper.test.tsx
│   └── ImageCropper.test.tsx
├── examples/
│   └── next-app/                     # minimal Next.js App Router demo
├── .github/workflows/ci.yml
├── tsup.config.ts
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── .npmignore
├── LICENSE
├── README.md
└── package.json
```

---

## 3. Public API (the contract — build to this exactly)

Everything below is exported from `src/index.ts`.

### 3.1 `<ImageCropper />` — the all-in-one component

```tsx
import { ImageCropper } from 'react-easy-image-cropper';

<ImageCropper
  // --- image source (any one; if none, dropzone shows) ---
  src={undefined}                       // string URL or undefined
  // --- crop config ---
  aspectRatio={undefined}               // number | undefined (undefined = free)
  cropShape="rect"                      // "rect" | "round"
  minCropWidth={20}
  minCropHeight={20}
  initialZoom={1}
  minZoom={1}
  maxZoom={4}
  rotation={0}                          // initial degrees
  // --- dropzone ---
  showDropzone={true}                   // show built-in dropzone when no image
  accept={['image/png','image/jpeg','image/webp']}
  maxSizeMB={10}
  // --- output ---
  outputType="image/png"                // mime for export
  outputQuality={0.92}                  // 0..1 for jpeg/webp
  // --- theming ---
  theme={undefined}                     // Partial<CropperTheme>
  // --- ui toggles ---
  showGrid={true}
  showControls={true}
  // --- callbacks ---
  onImageLoad={(img) => {}}
  onCropChange={(cropArea) => {}}        // fires live as user drags
  onComplete={(result) => {}}           // fires when user clicks "Crop"
  onError={(err) => {}}
  className=""
  style={{}}
/>
```

`onComplete` receives a `CropResult` (see types). The component manages its own
state internally but every value can be controlled via props if provided.

### 3.2 `<CropperCanvas />` — headless surface

Renders ONLY the image + crop overlay (no toolbar, no dropzone). Driven by the
`useCropper` hook or by props. For consumers building custom UI.

### 3.3 `<ImageDropzone />` — standalone

```tsx
<ImageDropzone
  accept={['image/png','image/jpeg']}
  maxSizeMB={10}
  multiple={false}
  onFiles={(files) => {}}
  onError={(err) => {}}
>
  {/* optional custom children render-prop or node */}
</ImageDropzone>
```

### 3.4 `useCropper()` — the core hook

```ts
const cropper = useCropper({
  src,
  aspectRatio,
  cropShape,
  minZoom, maxZoom,
  outputType, outputQuality,
});

// returns:
cropper.canvasRef        // attach to <canvas>
cropper.containerRef     // attach to wrapper div
cropper.state            // { zoom, rotation, flipX, flipY, cropArea, image }
cropper.setZoom(n)
cropper.zoomIn() / cropper.zoomOut()
cropper.rotate(deg)      // relative
cropper.setRotation(deg) // absolute
cropper.flipHorizontal()
cropper.flipVertical()
cropper.setAspectRatio(n | undefined)
cropper.reset()
cropper.loadImage(fileOrUrl)
cropper.getCroppedImage(): Promise<CropResult>   // the money function
```

### 3.5 Theme exports
```ts
export { ThemeProvider, defaultTheme, defaultDarkTheme } from './theme';
export type { CropperTheme } from './types';
```

---

## 4. Types (`src/types.ts`) — define these first

```ts
export interface CropArea {
  x: number;        // px, relative to displayed image top-left
  y: number;
  width: number;
  height: number;
}

export interface CropperState {
  image: HTMLImageElement | null;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  rotation: number;     // degrees, normalized 0..359
  flipX: boolean;
  flipY: boolean;
  cropArea: CropArea;
}

export interface CropResult {
  blob: Blob;
  dataUrl: string;
  width: number;        // output px
  height: number;
  cropArea: CropArea;   // in NATURAL image coordinates
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export type CropShape = 'rect' | 'round';

export interface CropperTheme {
  primary: string;        // accent: handles, active controls, crop button
  secondary: string;      // surfaces / toolbar bg
  accent: string;         // hover / highlights
  overlay: string;        // dark mask outside crop (rgba)
  handleColor: string;
  handleBorder: string;
  gridColor: string;
  text: string;
  background: string;
  borderRadius: number;   // px
}

export type AcceptedMime = 'image/png' | 'image/jpeg' | 'image/webp' | string;

export interface CropperError {
  code: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'LOAD_FAILED' | 'EXPORT_FAILED' | 'NO_IMAGE';
  message: string;
}
```

---

## 5. Implementation Detail per Module

### 5.1 `utils/ssr.ts`
- `export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';`
- `useIsomorphicLayoutEffect = isBrowser ? useLayoutEffect : useEffect` (silences SSR warning).
- Every direct `document`/`window`/`Image`/`canvas` access elsewhere must be inside effects or guarded by `isBrowser`.

### 5.2 `hooks/useImageLoader.ts`
- Accepts `File | Blob | string(url)`.
- Returns `{ image, status: 'idle'|'loading'|'loaded'|'error', error }`.
- Use `URL.createObjectURL` for File/Blob; **revoke** in cleanup to avoid leaks.
- Set `img.crossOrigin = 'anonymous'` for remote URLs so canvas export isn't tainted.
- Guard with `isBrowser`.

### 5.3 `hooks/usePointerDrag.ts`
- Unify mouse + touch via Pointer Events (`pointerdown/move/up`, `setPointerCapture`).
- Signature: `usePointerDrag({ onStart, onMove, onEnd })` → returns handlers `{ onPointerDown }`.
- `onMove` gets `{ dx, dy, x, y, event }` deltas since drag start.
- Prevent default + stop scrolling on touch (`touch-action: none` on the surface).

### 5.4 `utils/cropMath.ts` — pure functions, fully unit-tested
This is the geometric heart. Implement and export:

```ts
clampCropToImage(crop, imageBounds): CropArea
resizeFromHandle(handle, crop, dx, dy, opts): CropArea
  // handle ∈ 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'move'
  // opts: { aspectRatio?, minWidth, minHeight, bounds }
  // - 'move' translates the whole box, clamped to bounds
  // - corner/edge handles resize; if aspectRatio set, lock ratio
  // - never let width/height go below min or outside bounds
applyAspectRatio(crop, ratio, anchor): CropArea
centerCrop(imageBounds, aspectRatio?): CropArea   // initial centered crop
```

**Free crop + drag-resize algorithm (the part the user asked about earlier):**
1. Crop box stored as `{x,y,width,height}` in *display* pixels.
2. 8 handles + body. On `pointerdown` over a handle, record which handle + start crop.
3. On `pointermove`, call `resizeFromHandle(handle, startCrop, dx, dy, opts)`.
4. For corner handles, both dimensions change; for edge handles, one dimension.
5. If `aspectRatio` provided, after computing new size, force `height = width / ratio`
   (or vice-versa depending on dominant axis), then re-clamp.
6. Clamp final box inside image bounds; enforce min size.
7. Update state → triggers redraw + `onCropChange`.

### 5.5 `utils/canvasHelpers.ts`
- `drawImageToCanvas(ctx, image, { zoom, rotation, flipX, flipY, offset })`
  - translate to center, rotate (`rad = deg*Math.PI/180`), scale `(flipX?-1:1, flipY?-1:1)`, apply zoom, drawImage centered.
- `drawCropOverlay` is handled in the React overlay component (DOM), not canvas, so handles are crisp + accessible. The canvas only renders the image; the overlay (mask + handles + grid) is absolutely-positioned DOM on top. This is cleaner and keyboard-accessible.

### 5.6 `utils/imageExport.ts` — `getCroppedImage`
This must produce output in **natural resolution**, not display resolution.
1. Map the display-space `cropArea` back to natural image coordinates (account for
   zoom, current display scale, rotation, flips).
2. Create an offscreen canvas sized to the output crop (natural px).
3. Apply rotation/flip transforms, draw the source region.
4. If `cropShape === 'round'`: `ctx.beginPath(); ctx.arc(...); ctx.clip();` before draw, export PNG (preserve transparency — force `image/png` for round regardless of `outputType`).
5. `canvas.toBlob(cb, outputType, outputQuality)` → also produce `dataUrl` via `toDataURL`.
6. Wrap in `Promise`, reject with `{code:'EXPORT_FAILED'}` on null blob (e.g. tainted canvas).

### 5.7 `utils/fileValidation.ts`
- `validateFile(file, { accept, maxSizeMB })` → `CropperError | null`.
- Check `file.type` against accept list; check `file.size <= maxSizeMB*1024*1024`.

### 5.8 `theme/defaultTheme.ts`
```ts
export const defaultDarkTheme: CropperTheme = {
  primary: '#7C77DD',          // purple
  secondary: '#1A1A2E',        // near-black surface
  accent: '#B39DDB',
  overlay: 'rgba(10,10,18,0.6)',
  handleColor: '#FFFFFF',
  handleBorder: '#7C77DD',
  gridColor: 'rgba(255,255,255,0.4)',
  text: '#EDEDED',
  background: '#0F0F1A',
  borderRadius: 12,
};

export const defaultTheme = defaultDarkTheme; // package default = dark black+purple
// also provide a light variant
export const defaultLightTheme: CropperTheme = { ...purple on white... };
```
`ThemeProvider` merges `Partial<CropperTheme>` over `defaultTheme` and injects each
key as a CSS custom property (`--rc-primary`, etc.) on the wrapper, so consumer
overrides cascade. Components read both the context object and the CSS vars.

### 5.9 `components/CropOverlay.tsx`
- Absolutely positioned over the canvas.
- Renders: 4 mask rectangles (dark `overlay` outside crop) OR a single SVG with a
  cut-out; the crop rectangle border; optional rule-of-thirds grid; 8 handles.
- For `round` shape, mask uses an SVG circle cut-out and the border is a circle.
- Handles are focusable `<div role="slider" tabIndex=0 aria-label="...">`; arrow keys
  nudge that handle by 1px (10px with Shift). This delivers keyboard accessibility.
- Each handle wired to `usePointerDrag` → `resizeFromHandle`.

### 5.10 `components/CropperControls.tsx`
Toolbar with buttons (use inline SVG icons, no icon dep):
- Rotate left / right (±90°), free-rotate slider (−180..180)
- Flip horizontal / vertical
- Zoom slider + −/+ buttons
- Aspect ratio dropdown: Free, 1:1, 4:3, 16:9, 3:2 (+ values from a prop)
- Reset button
- **Crop** button (primary color) → calls `getCroppedImage()` → `onComplete`
All controls themed via CSS vars; disabled state when no image.

### 5.11 `components/ImageDropzone.tsx`
- Drag events: `onDragOver` (preventDefault + highlight), `onDragLeave`, `onDrop`.
- Hidden `<input type="file">` triggered by click / Enter / Space.
- Validates via `fileValidation`; calls `onFiles` or `onError`.
- Themed dashed-border drop area with upload icon + helper text.
- Accessible: `role="button"`, `tabIndex=0`, keyboard activatable.

### 5.12 `components/ImageCropper.tsx` (compose everything)
- If no `src` and no loaded image and `showDropzone` → render `<ImageDropzone>`.
- Once an image is loaded → render wrapper with `<CropperCanvas>` + `<CropOverlay>`
  + (`showControls` && `<CropperControls>`).
- Wrap whole thing in `<ThemeProvider theme={theme}>`.
- Bridge all internal hook state to the public callback props.

---

## 6. SSR / Next.js Requirements (critical — verify)
- No top-level `window`/`document`/`Image`/`URL` access. All inside effects/handlers.
- Component renders a stable placeholder on first paint, hydrates canvas in effect.
- Add `"use client"` directive note in README (consumer must mark the wrapping file,
  or we export a pre-marked component). Add `'use client';` at the top of
  `ImageCropper.tsx`, `CropperCanvas.tsx`, and any file using hooks/DOM.
- Test by running the `examples/next-app` with `next build && next start`.

---

## 7. Config Files (generate these)

### tsup.config.ts
```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  banner: { js: '"use client";' }, // keeps client directive in output
});
```

### package.json (key fields)
```json
{
  "name": "react-easy-image-cropper",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src",
    "format": "prettier --write .",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": { "react": ">=17.0.0", "react-dom": ">=17.0.0" },
  "devDependencies": { "...": "fill in latest" },
  "keywords": ["react","nextjs","image","crop","cropper","upload","dropzone","circular-crop"]
}
```

### tsconfig.json — `strict: true`, `jsx: react-jsx`, `moduleResolution: bundler`, `declaration: true`, `lib: ["DOM","ES2020"]`.

---

## 8. Tests (must pass)
- `cropMath.test.ts`: clamping, min-size enforcement, aspect-lock on every handle, move stays in bounds. Cover edge cases (drag past edges, tiny boxes, ratio extremes).
- `imageExport.test.ts`: natural-coordinate mapping math; round crop forces PNG. (Mock canvas where needed.)
- `useCropper.test.tsx`: zoom clamp, rotate normalization, flip toggles, reset.
- `ImageCropper.test.tsx`: dropzone shows when no image; controls disabled without image; `onComplete` fires with a `CropResult` shape (mock `toBlob`).

---

## 9. README.md (write it)
Include: install, quick start (`<ImageCropper onComplete={...} />`), Next.js
`"use client"` note, full props table, theming example, headless `useCropper`
example, all 4 exports, browser support, contributing, license.

---

## 10. Build Order (do in this sequence)
1. Scaffold repo + all config files; confirm `npm run typecheck` passes on empty stubs.
2. `types.ts` → `utils/ssr.ts` → `utils/cropMath.ts` (+ tests, green).
3. `utils/canvasHelpers.ts`, `utils/imageExport.ts`, `utils/fileValidation.ts` (+ tests).
4. `theme/*`.
5. Hooks: `useImageLoader` → `usePointerDrag` → `useCropper`.
6. Components: `CropperCanvas` → `CropOverlay` → `CropperControls` → `ImageDropzone` → `ImageCropper`.
7. Barrel exports in `src/index.ts`.
8. `examples/next-app` smoke test (`next build`).
9. Full `npm run lint && typecheck && test && build` — all green.
10. Write README. Done.

## 11. Definition of Done
- [ ] `npm run build` emits ESM + CJS + d.ts, no warnings.
- [ ] All tests pass; cropMath fully covered.
- [ ] Example Next.js app builds and crops an image end-to-end.
- [ ] No SSR/window errors.
- [ ] All 5 features work: free crop+resize, fixed ratio, rotate/flip, zoom, circular.
- [ ] Theme prop visibly changes UI colors; default is black + purple.
- [ ] README complete with props table + examples.
