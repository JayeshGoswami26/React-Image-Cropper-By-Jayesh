'use client';

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import type { AcceptedMime, CropperError } from '../types';
import { validateFile } from '../utils/fileValidation';

export interface UseDropzoneOptions {
  accept?: AcceptedMime[];
  maxSizeMB?: number;
  multiple?: boolean;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
  onError?: (error: CropperError) => void;
}

export interface UseDropzoneReturn {
  isDragging: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  open: () => void;
  getRootProps: () => {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
    role: string;
    tabIndex: number;
    'aria-disabled': boolean;
  };
  getInputProps: () => {
    ref: React.RefObject<HTMLInputElement>;
    type: 'file';
    accept: string;
    multiple: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    style: React.CSSProperties;
    tabIndex: number;
  };
}

/**
 * Headless drag-and-drop + click-to-upload logic with built-in file validation.
 */
export function useDropzone(options: UseDropzoneOptions = {}): UseDropzoneReturn {
  const {
    accept = ['image/png', 'image/jpeg', 'image/webp'],
    maxSizeMB = 10,
    multiple = false,
    disabled = false,
    onFiles,
    onError,
  } = options;

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const incoming = Array.from(fileList);
      const list = multiple ? incoming : incoming.slice(0, 1);
      const valid: File[] = [];

      for (const file of list) {
        const err = validateFile(file, { accept, maxSizeMB });
        if (err) {
          onError?.(err);
          return;
        }
        valid.push(file);
      }
      if (valid.length > 0) onFiles?.(valid);
    },
    [accept, maxSizeMB, multiple, onFiles, onError],
  );

  const open = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current += 1;
      setIsDragging(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    [disabled],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setIsDragging(false);
      processFiles(e.dataTransfer?.files ?? null);
    },
    [disabled, processFiles],
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      // reset so selecting the same file again still fires change
      e.target.value = '';
    },
    [processFiles],
  );

  const onClick = useCallback(() => open(), [open]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    },
    [open],
  );

  const getRootProps = useCallback(
    () => ({
      onDragOver,
      onDragLeave,
      onDrop,
      onClick,
      onKeyDown,
      role: 'button',
      tabIndex: disabled ? -1 : 0,
      'aria-disabled': disabled,
    }),
    [onDragOver, onDragLeave, onDrop, onClick, onKeyDown, disabled],
  );

  const getInputProps = useCallback(
    () => ({
      ref: inputRef,
      type: 'file' as const,
      accept: accept.join(','),
      multiple,
      onChange,
      tabIndex: -1,
      style: {
        position: 'absolute' as const,
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden' as const,
        clip: 'rect(0,0,0,0)',
        border: 0,
      },
    }),
    [accept, multiple, onChange],
  );

  return { isDragging, inputRef, open, getRootProps, getInputProps };
}
