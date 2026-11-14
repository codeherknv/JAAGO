'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Capture currently focused element once when dialog opens
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Move initial focus into the dialog (preferring form inputs/textarea if available)
    const timer = setTimeout(() => {
      if (modalRef.current) {
        // If user is already focused on an element inside the modal, don't steal focus
        if (modalRef.current.contains(document.activeElement)) {
          return;
        }

        const formInput = modalRef.current.querySelector<HTMLElement>(
          'textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled])'
        );
        if (formInput) {
          formInput.focus();
          return;
        }

        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      // 2. Trap Tab Focus inside dialog
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // 3. Return focus to trigger element ONLY when dialog closes or unmounts
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (
        previouslyFocusedRef.current &&
        typeof previouslyFocusedRef.current.focus === 'function'
      ) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/50 backdrop-blur-sm"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-dialog-title' : undefined}
        tabIndex={-1}
        className={`relative z-10 w-full ${maxWidth} bg-white rounded-control border border-border shadow-sheet p-6 space-y-4 focus:outline-none`}
      >
        {title && (
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 id="modal-dialog-title" className="font-heading font-bold text-base text-asphalt">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 -mr-1 rounded-plate text-asphalt-muted hover:text-asphalt hover:bg-kerb transition"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}
