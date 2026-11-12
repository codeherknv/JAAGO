'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  stepIndicator?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  stepIndicator,
  children,
  maxHeight = 'max-h-[90vh]',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-asphalt/40 transition-opacity"
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        className={`relative z-10 w-full sm:max-w-xl bg-white rounded-t-control sm:rounded-control border-t sm:border border-border shadow-sheet flex flex-col ${maxHeight} overflow-hidden`}
      >
        {/* Mobile Drag Bar */}
        <div className="flex sm:hidden justify-center pt-2.5 pb-1 cursor-grab" onClick={onClose}>
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-2.5">
            {title && (
              <h3
                id="bottom-sheet-title"
                className="text-base font-heading font-bold text-asphalt"
              >
                {title}
              </h3>
            )}
            {stepIndicator && (
              <span className="text-xs font-heading font-medium text-asphalt-muted px-2 py-0.5 bg-kerb rounded-plate border border-border-subtle">
                {stepIndicator}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-control text-asphalt-muted hover:text-asphalt hover:bg-kerb transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
