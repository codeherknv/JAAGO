'use client';

import React from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-control border border-border">
      <div className="flex items-center justify-center w-12 h-12 rounded-control bg-kerb border border-border text-asphalt-muted mb-3">
        {icon || <MapPin className="w-6 h-6 stroke-[1.75]" />}
      </div>

      <h3 className="text-base font-heading font-bold text-asphalt max-w-sm">
        {title}
      </h3>

      {description && (
        <p className="text-xs text-asphalt-muted mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
