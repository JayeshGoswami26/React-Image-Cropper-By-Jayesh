'use client';

import {
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { AspectRatioOption } from '../types';
import { useTheme } from '../theme/useTheme';
import {
  CheckIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  ResetIcon,
  RotateLeftIcon,
  RotateRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons';

export const DEFAULT_ASPECT_OPTIONS: AspectRatioOption[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
];

export interface CropperControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  aspectRatio: number | undefined;
  aspectRatioOptions?: AspectRatioOption[];
  disabled?: boolean;
  busy?: boolean;
  onZoom: (n: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: (deg: number) => void;
  onSetRotation: (deg: number) => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onAspectRatio: (n: number | undefined) => void;
  onReset: () => void;
  onCrop: () => void;
  cropLabel?: string;
}

interface ToolButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  children: ReactNode;
}

function ToolButton({ label, onClick, disabled, active, primary, children }: ToolButtonProps) {
  const theme = useTheme();
  const [hover, setHover] = useState(false);

  const bg = primary
    ? theme.primary
    : active
      ? theme.primary
      : hover && !disabled
        ? theme.accent
        : 'transparent';
  const color = primary || active ? '#fff' : hover && !disabled ? '#fff' : theme.text;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 36,
        minWidth: 36,
        padding: primary ? '0 16px' : '0 8px',
        fontSize: 14,
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${primary || active ? theme.primary : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 120ms ease, color 120ms ease',
        outline: 'none',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }}
    />
  );
}

const sliderStyle: CSSProperties = {
  accentColor: 'var(--rc-primary)',
  cursor: 'pointer',
  height: 4,
};

/**
 * Toolbar: rotate (±90 + free slider), flip, zoom (slider + buttons), aspect
 * ratio dropdown, reset, and the primary Crop button. Fully themed; disabled
 * when there is no image.
 */
export function CropperControls({
  zoom,
  minZoom,
  maxZoom,
  rotation,
  flipX,
  flipY,
  aspectRatio,
  aspectRatioOptions = DEFAULT_ASPECT_OPTIONS,
  disabled = false,
  busy = false,
  onZoom,
  onZoomIn,
  onZoomOut,
  onRotate,
  onSetRotation,
  onFlipHorizontal,
  onFlipVertical,
  onAspectRatio,
  onReset,
  onCrop,
  cropLabel = 'Crop',
}: CropperControlsProps) {
  const theme = useTheme();

  // map a possibly-undefined ratio to the select value
  const currentRatioValue = (() => {
    const idx = aspectRatioOptions.findIndex((o) =>
      o.value === undefined ? aspectRatio === undefined : Math.abs((o.value ?? 0) - (aspectRatio ?? -1)) < 1e-6,
    );
    return idx >= 0 ? String(idx) : '0';
  })();

  const group: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
  const labelStyle: CSSProperties = { fontSize: 12, opacity: 0.7, marginRight: 2 };

  return (
    <div
      role="toolbar"
      aria-label="Image crop controls"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        background: theme.secondary,
        borderRadius: theme.borderRadius,
        color: theme.text,
        boxSizing: 'border-box',
      }}
    >
      <div style={group}>
        <ToolButton label="Rotate left 90°" onClick={() => onRotate(-90)} disabled={disabled}>
          <RotateLeftIcon />
        </ToolButton>
        <ToolButton label="Rotate right 90°" onClick={() => onRotate(90)} disabled={disabled}>
          <RotateRightIcon />
        </ToolButton>
      </div>

      <div style={group}>
        <ToolButton
          label="Flip horizontal"
          onClick={onFlipHorizontal}
          disabled={disabled}
          active={flipX}
        >
          <FlipHorizontalIcon />
        </ToolButton>
        <ToolButton
          label="Flip vertical"
          onClick={onFlipVertical}
          disabled={disabled}
          active={flipY}
        >
          <FlipVerticalIcon />
        </ToolButton>
      </div>

      <Divider />

      <div style={group}>
        <span style={labelStyle}>Angle</span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotation > 180 ? rotation - 360 : rotation}
          disabled={disabled}
          aria-label="Rotation angle"
          onChange={(e) => onSetRotation(Number(e.target.value))}
          style={{ ...sliderStyle, width: 90 }}
        />
      </div>

      <Divider />

      <div style={group}>
        <ToolButton label="Zoom out" onClick={onZoomOut} disabled={disabled}>
          <ZoomOutIcon />
        </ToolButton>
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.01}
          value={zoom}
          disabled={disabled}
          aria-label="Zoom level"
          onChange={(e) => onZoom(Number(e.target.value))}
          style={{ ...sliderStyle, width: 90 }}
        />
        <ToolButton label="Zoom in" onClick={onZoomIn} disabled={disabled}>
          <ZoomInIcon />
        </ToolButton>
      </div>

      <Divider />

      <div style={group}>
        <span style={labelStyle}>Ratio</span>
        <select
          aria-label="Aspect ratio"
          value={currentRatioValue}
          disabled={disabled}
          onChange={(e) => onAspectRatio(aspectRatioOptions[Number(e.target.value)]?.value)}
          style={{
            height: 36,
            padding: '0 8px',
            fontSize: 14,
            color: theme.text,
            background: theme.background,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
          }}
        >
          {aspectRatioOptions.map((opt, i) => (
            <option key={opt.label} value={i}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Divider />

      <ToolButton label="Reset" onClick={onReset} disabled={disabled}>
        <ResetIcon />
      </ToolButton>

      <div style={{ flex: 1 }} />

      <ToolButton label={cropLabel} onClick={onCrop} disabled={disabled || busy} primary>
        <CheckIcon />
        {busy ? 'Cropping…' : cropLabel}
      </ToolButton>
    </div>
  );
}
