'use client';

import { DragEvent, ReactNode, useState } from 'react';

interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// Wraps an existing file input (passed as children) so its area also accepts drag-and-drop,
// without changing how the input itself works - click-to-browse still behaves exactly as
// before, this just adds dropping a file (or several) as another way in.
export default function FileDropzone({ onFiles, disabled, className, children }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) onFiles(dropped);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
        isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
      } ${className || ''}`}
    >
      {children}
    </div>
  );
}
