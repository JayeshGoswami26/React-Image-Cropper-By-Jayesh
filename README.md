# react-image-cropper-byjayesh

A zero-dependency, **SSR-safe** React & Next.js image cropper with a built-in
drag-and-drop dropzone, free / fixed-ratio cropping, resize, rotate, flip, zoom,
**circular crop**, and a fully themeable modern UI (black + purple by default).

- 🧩 **Batteries-included `<ImageCropper>`** _and_ a headless `useCropper()` hook
- 🖱️ **Drag & drop** upload with validation (type + size)
- ✂️ **Free or fixed aspect-ratio** crop with 8 resize handles + rule-of-thirds grid
- 🔄 **Rotate** (±90° + free slider), **flip** H/V, **zoom** (slider + buttons)
- ⭕ **Circular crop** (exports transparent PNG)
- 🎨 **Themeable** via a `theme` prop and CSS custom properties
- ♿ **Accessible** — keyboard-operable handles, ARIA labels, focusable controls
- 🌐 **SSR-safe** — no `window`/`document` at module scope; works in Next.js App & Pages Router
- 📦 **Dual ESM + CJS**, full TypeScript types, tree-shakeable, only `react` as a peer dep

---

## Install

```bash
npm install react-image-cropper-byjayesh
# or
yarn add react-image-cropper-byjayesh
# or
pnpm add react-image-cropper-byjayesh
```

`react` and `react-dom` (>=17) are peer dependencies.

---

## Quick start

```tsx
'use client'; // Next.js App Router: mark the file that renders the cropper

import { ImageCropper, type CropResult } from 'react-image-cropper-byjayesh';

export default function Demo() {
  return (
    <ImageCropper
      onComplete={(result: CropResult) => {
        // result.blob    -> upload it
        // result.dataUrl -> preview it
        console.log(result.width, result.height, result.blob);
      }}
    />
  );
}
```

With no `src`, the built-in dropzone is shown. Drop an image, adjust, and click
**Crop** to receive a `CropResult`.

### Provide an image directly

```tsx
<ImageCropper src="/photo.jpg" aspectRatio={1} cropShape="round" onComplete={save} />
```

---

## Next.js note (`'use client'`)

The package bundle already ships with a `"use client"` directive, so you can
import it from server components — it becomes a client boundary automatically.
In practice, just make sure the component **that renders** `<ImageCropper>` is a
client component (a file beginning with `'use client'`), because it manages
interactive state. The package is fully SSR-safe: it never touches
`window`/`document`/`canvas` during render — only inside effects and handlers.

Works with App Router and Pages Router, React 17 / 18 / 19, Next 13 / 14 / 15.

---

## `<ImageCropper />` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | `undefined` | Image URL. If omitted, the dropzone is shown. |
| `aspectRatio` | `number` | `undefined` | Lock crop to `width/height`. `undefined` = free. |
| `aspectRatioOptions` | `AspectRatioOption[]` | Free,1:1,4:3,16:9,3:2 | Options in the ratio dropdown. |
| `cropShape` | `'rect' \| 'round'` | `'rect'` | Circular crop exports a transparent PNG. |
| `minCropWidth` | `number` | `20` | Minimum crop width (display px). |
| `minCropHeight` | `number` | `20` | Minimum crop height (display px). |
| `initialZoom` | `number` | `1` | Initial zoom. |
| `minZoom` | `number` | `1` | Minimum zoom. |
| `maxZoom` | `number` | `4` | Maximum zoom. |
| `rotation` | `number` | `0` | Initial rotation in degrees. |
| `showDropzone` | `boolean` | `true` | Show built-in dropzone when there is no image. |
| `accept` | `string[]` | `['image/png','image/jpeg','image/webp']` | Accepted mime types (supports `image/*`). |
| `maxSizeMB` | `number` | `10` | Max upload size. |
| `outputType` | `'image/png' \| 'image/jpeg' \| 'image/webp'` | `'image/png'` | Export mime. |
| `outputQuality` | `number` | `0.92` | Quality `0..1` for jpeg/webp. |
| `theme` | `Partial<CropperTheme>` | dark purple | Theme overrides. |
| `showGrid` | `boolean` | `true` | Rule-of-thirds grid. |
| `showControls` | `boolean` | `true` | Show the toolbar. |
| `height` | `number \| string` | `400` | Height of the crop surface. |
| `onImageLoad` | `(img: HTMLImageElement) => void` | — | Fires when an image loads. |
| `onCropChange` | `(cropArea: CropArea) => void` | — | Fires live while dragging. |
| `onComplete` | `(result: CropResult) => void` | — | Fires when **Crop** is clicked. |
| `onError` | `(err: CropperError) => void` | — | Validation / load / export errors. |
| `className` / `style` | — | — | Applied to the root wrapper. |

### `CropResult`

```ts
interface CropResult {
  blob: Blob;
  dataUrl: string;
  width: number;        // output px (natural resolution)
  height: number;
  cropArea: CropArea;   // in natural image coordinates
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}
```

---

## Theming

Pass a partial theme; it merges over the default dark theme and is injected as
CSS custom properties (`--rc-primary`, `--rc-secondary`, …) on the wrapper.

```tsx
<ImageCropper
  theme={{
    primary: '#22c55e',          // accent / handles / Crop button
    secondary: '#0b1220',        // toolbar surface
    background: '#05080f',
    overlay: 'rgba(0,0,0,0.65)', // mask outside the crop
    borderRadius: 16,
  }}
/>
```

Full theme shape:

```ts
interface CropperTheme {
  primary: string;
  secondary: string;
  accent: string;
  overlay: string;
  handleColor: string;
  handleBorder: string;
  gridColor: string;
  text: string;
  background: string;
  borderRadius: number;
}
```

Prebuilt themes are exported: `defaultTheme` (dark), `defaultDarkTheme`,
`defaultLightTheme`.

```tsx
import { defaultLightTheme } from 'react-image-cropper-byjayesh';
<ImageCropper theme={defaultLightTheme} />
```

---

## Headless: `useCropper()`

Build your own UI around the core state machine.

```tsx
'use client';

import { useCropper, CropperCanvas } from 'react-image-cropper-byjayesh';

function CustomCropper({ src }: { src: string }) {
  const c = useCropper({ src, aspectRatio: 16 / 9, maxZoom: 5 });

  return (
    <div>
      <div style={{ height: 420 }}>
        <CropperCanvas
          containerRef={c.containerRef}
          canvasRef={c.canvasRef}
          cropArea={c.cropArea}
          bounds={c.bounds}
          containerSize={c.containerSize}
          aspectRatio={c.aspectRatio}
          onCropChange={c.setCropArea}
        />
      </div>

      <button onClick={() => c.rotate(90)}>Rotate</button>
      <button onClick={c.flipHorizontal}>Flip</button>
      <button onClick={() => c.setZoom(c.state.zoom + 0.2)}>Zoom in</button>
      <button
        onClick={async () => {
          const result = await c.getCroppedImage();
          // ...do something with result
        }}
      >
        Crop
      </button>
    </div>
  );
}
```

`useCropper` returns: `canvasRef`, `containerRef`, `state`
(`{ image, zoom, rotation, flipX, flipY, cropArea, ... }`), `cropArea` /
`setCropArea`, `setZoom` / `zoomIn` / `zoomOut`, `rotate` / `setRotation`,
`flipHorizontal` / `flipVertical`, `setAspectRatio`, `reset`, `loadImage`, and
`getCroppedImage(): Promise<CropResult>`, plus `bounds`, `geometry`,
`containerSize`, `status`, and `error`.

---

## Standalone `<ImageDropzone />`

```tsx
import { ImageDropzone } from 'react-image-cropper-byjayesh';

<ImageDropzone
  accept={['image/png', 'image/jpeg']}
  maxSizeMB={10}
  onFiles={(files) => console.log(files[0])}
  onError={(err) => console.warn(err.code, err.message)}
/>;
```

It also supports a render-prop child: `{({ isDragging, open }) => <YourUI />}`.

---

## Exports

```ts
// Components
import {
  ImageCropper,
  CropperCanvas,
  CropOverlay,
  CropperControls,
  ImageDropzone,
} from 'react-image-cropper-byjayesh';

// Hooks
import {
  useCropper,
  useDropzone,
  useImageLoader,
  usePointerDrag,
} from 'react-image-cropper-byjayesh';

// Theme
import {
  ThemeProvider,
  useTheme,
  defaultTheme,
  defaultDarkTheme,
  defaultLightTheme,
} from 'react-image-cropper-byjayesh';

// Pure helpers (handy for custom UIs)
import {
  resizeFromHandle,
  clampCropToImage,
  centerCrop,
  computeExportGeometry,
  getCroppedImage,
  validateFile,
} from 'react-image-cropper-byjayesh';
```

---

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari) with Pointer Events
and `canvas.toBlob`. Remote images need CORS (`Access-Control-Allow-Origin`) to
be exportable; the loader sets `crossOrigin="anonymous"` for `http(s)` URLs.

---

## Example app

A minimal Next.js App Router demo lives in [`examples/next-app`](./examples/next-app).

```bash
npm run build
cd examples/next-app && npm install && npm run dev
```

---

## Contributing

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run lint        # eslint
npm run build       # tsup -> dist (ESM + CJS + d.ts)
```

PRs welcome. The geometry core (`src/utils/cropMath.ts`) is fully unit-tested —
please keep it green.

---

## License

[MIT](./LICENSE) © Jayesh Puri Goswami
