'use client';

import { type CSSProperties, type ReactNode } from 'react';
import type { AcceptedMime, CropperError } from '../types';
import { useDropzone } from '../hooks/useDropzone';
import { useTheme } from '../theme/useTheme';

export interface ImageDropzoneProps {
  accept?: AcceptedMime[];
  maxSizeMB?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  onError?: (error: CropperError) => void;
  /** custom content; receives the current drag state */
  children?: ReactNode | ((state: { isDragging: boolean; open: () => void }) => ReactNode);
  className?: string;
  style?: CSSProperties;
  label?: string;
  hint?: string;
}

function UploadIcon({ color }: { color: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Drag-and-drop / click-to-upload zone with validation. Accessible: it is a
 * focusable button activatable with Enter/Space.
 */
export function ImageDropzone({
  accept = ['image/png', 'image/jpeg', 'image/webp'],
  maxSizeMB = 10,
  multiple = false,
  disabled = false,
  onFiles,
  onError,
  children,
  className,
  style,
  label = 'Drag & drop an image here',
  hint,
}: ImageDropzoneProps) {
  const theme = useTheme();
  const { isDragging, open, getRootProps, getInputProps } = useDropzone({
    accept,
    maxSizeMB,
    multiple,
    disabled,
    onFiles,
    onError,
  });

  const defaultHint =
    hint ?? `or click to browse · ${accept.map((a) => a.replace('image/', '')).join(', ')} · up to ${maxSizeMB}MB`;

  return (
    <div
      {...getRootProps()}
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        minHeight: 220,
        padding: 24,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: theme.text,
        background: theme.secondary,
        border: `2px dashed ${isDragging ? theme.primary : theme.handleBorder}`,
        borderRadius: theme.borderRadius,
        outline: 'none',
        transition: 'border-color 120ms ease, background 120ms ease, transform 120ms ease',
        transform: isDragging ? 'scale(1.01)' : 'scale(1)',
        boxSizing: 'border-box',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      <input {...getInputProps()} />
      {typeof children === 'function' ? (
        children({ isDragging, open })
      ) : children ? (
        children
      ) : (
        <>
          <UploadIcon color={isDragging ? theme.primary : theme.accent} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {isDragging ? 'Drop to upload' : label}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>{defaultHint}</div>
        </>
      )}
    </div>
  );
}
